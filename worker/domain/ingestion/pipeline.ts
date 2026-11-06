import type { Env } from '../../env';
import { requirementsSchema } from '../../../shared/schemas';
import { summarize } from '../../lib/sanitize';
import { getConfig } from '../../lib/store';
import { FetchError } from '../../lib/url';
import { addMinutes, log, newId, nowIso, parseJson } from '../../lib/util';
import { norm } from '../matching/common';
import { CONNECTORS } from './connectors';
import { VERIFICATION_RANK, canonicalKey, contentHash, validItem } from './normalize';
import type { NormalizedItem, SourceRow } from './types';

const LOCK = 'ingestion';
const LOCK_HOURS = 3;

/* ======================= Locking ======================= */
async function acquireLock(env: Env, holder: string, now: Date): Promise<boolean> {
  const exp = new Date(now.getTime() + LOCK_HOURS * 3600_000).toISOString();
  const r = await env.DB.prepare(
    `INSERT INTO scheduler_locks (name, holder, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET holder = excluded.holder, expires_at = excluded.expires_at
     WHERE scheduler_locks.expires_at < ?`,
  )
    .bind(LOCK, holder, exp, nowIso(now))
    .run();
  return (r.meta.changes ?? 0) > 0;
}
async function releaseLock(env: Env, holder: string) {
  await env.DB.prepare('DELETE FROM scheduler_locks WHERE name = ? AND holder = ?').bind(LOCK, holder).run();
}

/* ======================= Runs ======================= */
export type StartRunResult = { started: boolean; runId: string | null; reason?: string; tasks: number };

export async function startRun(
  env: Env,
  trigger: 'cron' | 'admin' | 'test',
  opts: { actorId?: string | null; sourceIds?: string[]; idempotencyKey?: string; now?: Date } = {},
): Promise<StartRunResult> {
  const now = opts.now ?? new Date();
  const runId = newId('run');
  const key = opts.idempotencyKey ?? `${trigger}:${runId}`;
  const dup = await env.DB.prepare('SELECT id FROM ingestion_runs WHERE idempotency_key = ?')
    .bind(key)
    .first<{ id: string }>();
  if (dup) return { started: false, runId: dup.id, reason: 'duplicate_trigger', tasks: 0 };
  if (!(await acquireLock(env, runId, now))) {
    const active = await env.DB.prepare(
      "SELECT id FROM ingestion_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1",
    ).first<{ id: string }>();
    return { started: false, runId: active?.id ?? null, reason: 'run_in_progress', tasks: 0 };
  }
  let sql = "SELECT id FROM sources WHERE enabled = 1 AND connector != 'manual'";
  const binds: string[] = [];
  if (opts.sourceIds?.length) {
    sql = `SELECT id FROM sources WHERE connector != 'manual' AND id IN (${opts.sourceIds.map(() => '?').join(',')})`;
    binds.push(...opts.sourceIds);
  }
  const sources = (
    await env.DB.prepare(sql)
      .bind(...binds)
      .all<{ id: string }>()
  ).results;
  const ts = nowIso(now);
  try {
    await env.DB.prepare(
      `INSERT INTO ingestion_runs (id, trigger, status, idempotency_key, created_by, started_at, sources_total)
       VALUES (?, ?, 'running', ?, ?, ?, ?)`,
    )
      .bind(runId, trigger, key, opts.actorId ?? null, ts, sources.length)
      .run();
  } catch (e) {
    await releaseLock(env, runId);
    if (/UNIQUE/i.test(String(e)))
      return { started: false, runId: null, reason: 'duplicate_trigger', tasks: 0 };
    throw e;
  }
  if (sources.length) {
    await env.DB.batch(
      sources.map((s) =>
        env.DB.prepare(
          `INSERT INTO ingestion_tasks (id, run_id, source_id, status, attempts, max_attempts, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', 0, 3, ?, ?, ?)`,
        ).bind(newId('tsk'), runId, s.id, ts, ts, ts),
      ),
    );
  }
  log('info', 'ingestion.run_started', { runId, trigger, sources: sources.length });
  if (!sources.length) await finalizeRunIfDone(env, runId, now);
  return { started: true, runId, tasks: sources.length };
}

/** Called on every cron tick: starts a run when the configured interval has elapsed. */
export async function maybeStartScheduledRun(env: Env, now = new Date()): Promise<StartRunResult | null> {
  const hours = Math.max(1, Math.min(48, Number(await getConfig(env, 'ingestion.interval_hours', 6)) || 6));
  const last = await env.DB.prepare(
    "SELECT started_at FROM ingestion_runs WHERE status != 'skipped' ORDER BY started_at DESC LIMIT 1",
  ).first<{ started_at: string }>();
  const due = !last || now.getTime() - Date.parse(last.started_at) >= hours * 3600_000 - 5 * 60_000;
  if (!due) return null;
  const slot = Math.floor(now.getTime() / (hours * 3600_000));
  return startRun(env, 'cron', { idempotencyKey: `cron:${hours}h:${slot}`, now });
}

/* ======================= Task queue ======================= */
export async function drainTasks(env: Env, opts: { max?: number; now?: Date; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? new Date();
  const max =
    opts.max ??
    Math.max(1, Math.min(10, Number(await getConfig(env, 'ingestion.max_tasks_per_tick', 3)) || 3));
  const ts = nowIso(now);
  const candidates = (
    await env.DB.prepare(
      `SELECT id FROM ingestion_tasks
       WHERE (status = 'pending' AND next_attempt_at <= ?) OR (status = 'running' AND lease_until < ?)
       ORDER BY next_attempt_at LIMIT ?`,
    )
      .bind(ts, ts, max)
      .all<{ id: string }>()
  ).results;
  const processed: string[] = [];
  for (const c of candidates) {
    const lease = addMinutes(now, 10).toISOString();
    const claim = await env.DB.prepare(
      `UPDATE ingestion_tasks SET status = 'running', lease_until = ?, attempts = attempts + 1, updated_at = ?
       WHERE id = ? AND ((status = 'pending' AND next_attempt_at <= ?) OR (status = 'running' AND lease_until < ?))`,
    )
      .bind(lease, ts, c.id, ts, ts)
      .run();
    if ((claim.meta.changes ?? 0) === 0) continue; // another invocation claimed it
    await processTask(env, c.id, now, opts.fetcher);
    processed.push(c.id);
  }
  return processed;
}

async function processTask(env: Env, taskId: string, now: Date, fetcher?: typeof fetch) {
  const task = await env.DB.prepare('SELECT * FROM ingestion_tasks WHERE id = ?').bind(taskId).first<any>();
  const source = await env.DB.prepare('SELECT * FROM sources WHERE id = ?')
    .bind(task.source_id)
    .first<SourceRow>();
  const ts = nowIso(now);
  if (!source) {
    await env.DB.prepare(
      "UPDATE ingestion_tasks SET status = 'dead', last_error = 'source deleted', updated_at = ? WHERE id = ?",
    )
      .bind(ts, taskId)
      .run();
    return finalizeRunIfDone(env, task.run_id, now);
  }
  await env.DB.prepare('UPDATE sources SET last_attempt_at = ? WHERE id = ?').bind(ts, source.id).run();
  const connector = CONNECTORS[source.connector];
  try {
    if (!connector) throw new FetchError(`Unknown connector "${source.connector}"`, undefined, false);
    const config = parseJson<Record<string, any>>(source.config, {});
    const result = await connector.fetch(source, config, { env, fetcher, now });
    const stats = await upsertItems(env, source, result.items, task.run_id, now);
    if (result.complete && result.items.length > 0) await markMissing(env, source.id, task.run_id, now);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE ingestion_tasks SET status = 'done', lease_until = NULL, last_error = NULL, items_seen = ?, items_new = ?, items_updated = ?, updated_at = ? WHERE id = ?`,
      ).bind(stats.seen, stats.created, stats.updated, ts, taskId),
      env.DB.prepare(
        `UPDATE sources SET last_success_at = ?, consecutive_failures = 0, last_error = ?, last_item_at = COALESCE(?, last_item_at), updated_at = ? WHERE id = ?`,
      ).bind(
        ts,
        stats.invalid ? `${stats.invalid} invalid record(s) skipped` : null,
        stats.created ? ts : null,
        ts,
        source.id,
      ),
    ]);
    log('info', 'ingestion.source_done', {
      source: source.slug,
      seen: stats.seen,
      created: stats.created,
      updated: stats.updated,
      skipped: result.skipped,
    });
  } catch (e) {
    const err =
      e instanceof FetchError ? e : new FetchError((e as Error).message ?? String(e), undefined, true);
    const retryable = err.retryable && task.attempts < task.max_attempts;
    const backoffMin = 5 * 2 ** Math.max(0, task.attempts - 1);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE ingestion_tasks SET status = ?, lease_until = NULL, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?`,
      ).bind(
        retryable ? 'pending' : 'dead',
        err.message.slice(0, 500),
        addMinutes(now, backoffMin).toISOString(),
        ts,
        taskId,
      ),
      env.DB.prepare(
        `UPDATE sources SET error_count = error_count + 1, consecutive_failures = consecutive_failures + ?, last_error = ?, updated_at = ? WHERE id = ?`,
      ).bind(retryable ? 0 : 1, err.message.slice(0, 500), ts, source.id),
    ]);
    log('warn', 'ingestion.source_failed', {
      source: source.slug,
      error: err.message.slice(0, 200),
      retry: retryable,
    });
  }
  await finalizeRunIfDone(env, task.run_id, now);
}

export async function finalizeRunIfDone(env: Env, runId: string, now = new Date()) {
  const agg = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('pending','running') THEN 1 ELSE 0 END) AS open,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
       SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END) AS dead,
       COALESCE(SUM(items_seen),0) AS seen, COALESCE(SUM(items_new),0) AS created, COALESCE(SUM(items_updated),0) AS updated
     FROM ingestion_tasks WHERE run_id = ?`,
  )
    .bind(runId)
    .first<any>();
  const open = Number(agg?.open ?? 0);
  const done = Number(agg?.done ?? 0);
  const dead = Number(agg?.dead ?? 0);
  await env.DB.prepare(
    `UPDATE ingestion_runs SET sources_done = ?, sources_failed = ?, items_seen = ?, items_new = ?, items_updated = ? WHERE id = ?`,
  )
    .bind(done, dead, agg?.seen ?? 0, agg?.created ?? 0, agg?.updated ?? 0, runId)
    .run();
  if (open > 0) return false;
  const status = dead === 0 ? 'completed' : done === 0 ? 'failed' : 'completed_with_errors';
  const r = await env.DB.prepare(
    "UPDATE ingestion_runs SET status = ?, finished_at = ? WHERE id = ? AND status = 'running'",
  )
    .bind(status, nowIso(now), runId)
    .run();
  if ((r.meta.changes ?? 0) > 0) {
    await releaseLock(env, runId);
    await expireOpportunities(env, now);
    log('info', 'ingestion.run_finished', { runId, status, done, dead });
  }
  return true;
}

/* ======================= Upsert / dedupe ======================= */
type UpsertStats = { seen: number; created: number; updated: number; invalid: number; changedIds: string[] };

export async function upsertItems(
  env: Env,
  source: SourceRow,
  items: NormalizedItem[],
  runId: string | null,
  now = new Date(),
): Promise<UpsertStats> {
  const ts = nowIso(now);
  const stats: UpsertStats = { seen: 0, created: 0, updated: 0, invalid: 0, changedIds: [] };
  const existing = new Map<string, { opportunity_id: string; content_hash: string }>();
  const recs = await env.DB.prepare(
    'SELECT external_id, opportunity_id, content_hash FROM source_records WHERE source_id = ?',
  )
    .bind(source.id)
    .all<{ external_id: string; opportunity_id: string; content_hash: string }>();
  for (const r of recs.results) existing.set(r.external_id, r);

  const unchanged: string[] = [];
  const unchangedOpp: string[] = [];
  const seenInBatch = new Set<string>();
  for (const item of items) {
    const bad = validItem(item);
    if (bad || seenInBatch.has(item.external_id)) {
      stats.invalid++;
      continue;
    }
    seenInBatch.add(item.external_id);
    stats.seen++;
    const hash = await contentHash(item);
    const rec = existing.get(item.external_id);
    if (rec && rec.content_hash === hash) {
      unchanged.push(item.external_id);
      unchangedOpp.push(rec.opportunity_id);
      continue;
    }
    if (rec) {
      if (await applyUpdate(env, rec.opportunity_id, item, hash, now)) {
        stats.updated++;
        stats.changedIds.push(rec.opportunity_id);
      }
      await env.DB.prepare(
        'UPDATE source_records SET content_hash = ?, url = ?, last_seen_at = ?, last_run_id = ?, missing_count = 0 WHERE source_id = ? AND external_id = ?',
      )
        .bind(hash, item.source_url, ts, runId, source.id, item.external_id)
        .run();
      continue;
    }
    // A notice first seen after its published deadline has no value to users: record nothing.
    if (item.deadline_at && Date.parse(item.deadline_at) < now.getTime()) {
      stats.seen--;
      stats.invalid++;
      continue;
    }
    // New source record: find an existing canonical opportunity (cross-source dedupe) or create one.
    const key = await canonicalKey(item);
    let oppId = (
      await env.DB.prepare('SELECT id FROM opportunities WHERE canonical_key = ?')
        .bind(key)
        .first<{ id: string }>()
    )?.id;
    if (!oppId) oppId = await findDuplicate(env, item);
    if (oppId) {
      await env.DB.prepare(
        `INSERT INTO source_records (id, source_id, external_id, opportunity_id, url, content_hash, first_seen_at, last_seen_at, last_run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(newId('srec'), source.id, item.external_id, oppId, item.source_url, hash, ts, ts, runId)
        .run();
      if (await applyUpdate(env, oppId, item, hash, now, { mergeOnly: true })) stats.updated++;
      continue;
    }
    oppId = newId('opp');
    const req = requirementsSchema.parse(item.requirements ?? {});
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO opportunities (id, canonical_key, category, title, organization, description, summary, country, countries, location, remote,
           source_id, source_url, application_url, official_url, reference_no, published_at, deadline_at, deadline_tz, deadline_note, status,
           verification, moderation, meta, requirements, requirements_source, content_hash, is_demo, first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      ).bind(
        oppId,
        key,
        item.category,
        item.title,
        item.organization,
        item.description,
        summarize(item.description),
        item.country,
        JSON.stringify(item.countries),
        item.location,
        item.remote,
        source.id,
        item.source_url,
        item.application_url,
        item.official_url,
        item.reference_no,
        item.published_at,
        item.deadline_at,
        item.deadline_tz,
        item.deadline_note,
        item.status_hint === 'cancelled' ? 'cancelled' : item.status_hint === 'closed' ? 'closed' : 'open',
        item.verification,
        JSON.stringify(item.meta),
        JSON.stringify(req),
        item.requirements_source,
        hash,
        ts,
        ts,
        ts,
        ts,
        ts,
      ),
      env.DB.prepare(
        `INSERT INTO source_records (id, source_id, external_id, opportunity_id, url, content_hash, first_seen_at, last_seen_at, last_run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId('srec'), source.id, item.external_id, oppId, item.source_url, hash, ts, ts, runId),
      env.DB.prepare(
        "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, created_at) VALUES (?, ?, 'created', ?, ?)",
      ).bind(
        newId('oev'),
        oppId,
        JSON.stringify({ source: source.slug, verification: item.verification }),
        ts,
      ),
    ]);
    stats.created++;
    stats.changedIds.push(oppId);
  }
  // Bulk-touch unchanged records (bounded parameter lists).
  for (let i = 0; i < unchanged.length; i += 80) {
    const chunk = unchanged.slice(i, i + 80);
    await env.DB.prepare(
      `UPDATE source_records SET last_seen_at = ?, last_run_id = ?, missing_count = 0 WHERE source_id = ? AND external_id IN (${chunk.map(() => '?').join(',')})`,
    )
      .bind(ts, runId, source.id, ...chunk)
      .run();
  }
  for (let i = 0; i < unchangedOpp.length; i += 90) {
    const chunk = unchangedOpp.slice(i, i + 90);
    await env.DB.prepare(
      `UPDATE opportunities SET last_seen_at = ?, last_checked_at = ?,
         status = CASE WHEN status = 'status_uncertain' THEN 'open' ELSE status END
       WHERE id IN (${chunk.map(() => '?').join(',')})`,
    )
      .bind(ts, ts, ...chunk)
      .run();
  }
  return stats;
}

/** Same organisation + same title + same country + same deadline day, and no conflicting reference number. */
async function findDuplicate(env: Env, item: NormalizedItem): Promise<string | undefined> {
  const rows = (
    await env.DB.prepare(
      `SELECT id, title, organization, country, deadline_at, reference_no FROM opportunities
       WHERE lower(organization) = lower(?) AND lower(title) = lower(?) LIMIT 5`,
    )
      .bind(item.organization, item.title)
      .all<any>()
  ).results;
  for (const r of rows) {
    if (norm(r.country) !== norm(item.country)) continue;
    if ((r.deadline_at ?? '').slice(0, 10) !== (item.deadline_at ?? '').slice(0, 10)) continue;
    if (r.reference_no && item.reference_no && norm(r.reference_no) !== norm(item.reference_no)) continue;
    return r.id as string;
  }
  return undefined;
}

async function applyUpdate(
  env: Env,
  oppId: string,
  item: NormalizedItem,
  hash: string,
  now: Date,
  opts: { mergeOnly?: boolean } = {},
): Promise<boolean> {
  const cur = await env.DB.prepare('SELECT * FROM opportunities WHERE id = ?').bind(oppId).first<any>();
  if (!cur) return false;
  const ts = nowIso(now);
  const events: Array<[string, Record<string, unknown>]> = [];
  const set: Record<string, unknown> = { last_seen_at: ts, last_checked_at: ts };

  // Verification/URLs: only ever upgrade trust; never replace an official URL with an aggregator URL.
  const curRank = VERIFICATION_RANK[cur.verification] ?? 0;
  const newRank = VERIFICATION_RANK[item.verification] ?? 0;
  if (newRank > curRank) {
    set.verification = item.verification;
    if (item.official_url) set.official_url = item.official_url;
    if (item.application_url) set.application_url = item.application_url;
    events.push(['verified', { from: cur.verification, to: item.verification }]);
  }
  if (!opts.mergeOnly) {
    if ((cur.deadline_at ?? null) !== (item.deadline_at ?? null)) {
      set.deadline_at = item.deadline_at;
      set.deadline_tz = item.deadline_tz;
      set.deadline_note = item.deadline_note;
      events.push(['deadline_changed', { from: cur.deadline_at, to: item.deadline_at }]);
      if (
        (cur.status === 'expired' || cur.status === 'closed') &&
        item.deadline_at &&
        Date.parse(item.deadline_at) > now.getTime()
      ) {
        set.status = 'open';
        events.push(['status_changed', { from: cur.status, to: 'open', reason: 'deadline extended' }]);
      }
    }
    if (newRank >= curRank && item.application_url && item.application_url !== cur.application_url) {
      set.application_url = item.application_url;
      events.push(['url_changed', { from: cur.application_url, to: item.application_url }]);
    }
    if (item.status_hint === 'cancelled' && cur.status !== 'cancelled') {
      set.status = 'cancelled';
      events.push(['status_changed', { from: cur.status, to: 'cancelled', evidence: 'source notice' }]);
    } else if (item.status_hint === 'closed' && cur.status === 'open') {
      set.status = 'closed';
      events.push(['status_changed', { from: cur.status, to: 'closed', evidence: 'source status' }]);
    } else if (cur.status === 'status_uncertain' && !set.status) set.status = 'open';
    if (item.title !== cur.title || item.description !== cur.description) {
      set.title = item.title;
      set.description = item.description;
      set.summary = summarize(item.description);
      if (cur.title !== item.title || cur.content_hash)
        events.push(['amended', { title_changed: cur.title !== item.title }]);
    }
    set.meta = JSON.stringify({ ...parseJson(cur.meta, {}), ...item.meta });
    if (cur.requirements_source !== 'admin') {
      set.requirements = JSON.stringify(requirementsSchema.parse(item.requirements ?? {}));
      set.requirements_source = item.requirements_source;
    }
    set.content_hash = hash;
  }
  const keys = Object.keys(set);
  const stmts = [
    env.DB.prepare(
      `UPDATE opportunities SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ).bind(...keys.map((k) => set[k] as any), ts, oppId),
    ...events.map(([kind, detail]) =>
      env.DB.prepare(
        'INSERT INTO opportunity_events (id, opportunity_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(newId('oev'), oppId, kind, JSON.stringify(detail), ts),
    ),
  ];
  const statusChange = events.find(([k]) => k === 'status_changed');
  if (statusChange) {
    const to = String(statusChange[1].to);
    if (to === 'cancelled' || to === 'closed')
      stmts.push(...savedUsersStatusNotifications(env, oppId, cur.title, to, ts));
  }
  await env.DB.batch(stmts);
  return events.length > 0 || !opts.mergeOnly;
}

function savedUsersStatusNotifications(env: Env, oppId: string, title: string, status: string, ts: string) {
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, opportunity_id, dedupe_key, created_at)
       SELECT 'ntf_' || lower(hex(randomblob(10))), uo.user_id, 'status_change', ?, ?, ?, ?, ?, ?
       FROM user_opportunity uo WHERE uo.opportunity_id = ? AND uo.state = 'saved'`,
    ).bind(
      `Status update: ${title.slice(0, 120)}`,
      `The source now shows this opportunity as ${status}.`,
      `/app/opportunities/${oppId}`,
      oppId,
      `status:${oppId}:${status}`,
      ts,
      oppId,
    ),
  ];
}

/** Records not seen in a complete listing for N consecutive runs become "status uncertain" (never closed on one miss). */
export async function markMissing(env: Env, sourceId: string, runId: string, now = new Date()) {
  const threshold = Math.max(
    1,
    Number(await getConfig(env, 'ingestion.missing_runs_before_uncertain', 3)) || 3,
  );
  const ts = nowIso(now);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE source_records SET missing_count = missing_count + 1 WHERE source_id = ? AND (last_run_id IS NULL OR last_run_id != ?)',
    ).bind(sourceId, runId),
    env.DB.prepare(
      `INSERT INTO opportunity_events (id, opportunity_id, kind, detail, created_at)
       SELECT 'oev_' || lower(hex(randomblob(10))), o.id, 'status_changed', '{"from":"open","to":"status_uncertain","evidence":"missing from complete source listing"}', ?
       FROM opportunities o WHERE o.status = 'open' AND o.id IN (
         SELECT sr.opportunity_id FROM source_records sr WHERE sr.source_id = ? AND sr.missing_count >= ?
       ) AND NOT EXISTS (
         SELECT 1 FROM source_records s2 WHERE s2.opportunity_id = o.id AND s2.missing_count = 0
       )`,
    ).bind(ts, sourceId, threshold),
    env.DB.prepare(
      `UPDATE opportunities SET status = 'status_uncertain', updated_at = ?
       WHERE status = 'open' AND id IN (SELECT opportunity_id FROM source_records WHERE source_id = ? AND missing_count >= ?)
       AND NOT EXISTS (SELECT 1 FROM source_records s2 WHERE s2.opportunity_id = opportunities.id AND s2.missing_count = 0)`,
    ).bind(ts, sourceId, threshold),
  ]);
}

/** Deadline-based expiry is evidence-backed (the published deadline), so it is applied directly. */
export async function expireOpportunities(env: Env, now = new Date()) {
  const ts = nowIso(now);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO opportunity_events (id, opportunity_id, kind, detail, created_at)
       SELECT 'oev_' || lower(hex(randomblob(10))), id, 'status_changed', '{"to":"expired","evidence":"published deadline passed"}', ?
       FROM opportunities WHERE status IN ('open','status_uncertain') AND deadline_at IS NOT NULL AND deadline_at < ?`,
    ).bind(ts, ts),
    env.DB.prepare(
      `UPDATE opportunities SET status = 'expired', updated_at = ? WHERE status IN ('open','status_uncertain') AND deadline_at IS NOT NULL AND deadline_at < ?`,
    ).bind(ts, ts),
  ]);
}

/** Recover tasks/runs abandoned by a crashed invocation. */
export async function recoverStaleRuns(env: Env, now = new Date()) {
  const cutoff = new Date(now.getTime() - LOCK_HOURS * 3600_000).toISOString();
  const stale = (
    await env.DB.prepare("SELECT id FROM ingestion_runs WHERE status = 'running' AND started_at < ?")
      .bind(cutoff)
      .all<{ id: string }>()
  ).results;
  for (const r of stale) {
    await env.DB.prepare(
      "UPDATE ingestion_tasks SET status = 'dead', last_error = COALESCE(last_error, 'abandoned: run exceeded time limit'), updated_at = ? WHERE run_id = ? AND status IN ('pending','running')",
    )
      .bind(nowIso(now), r.id)
      .run();
    await finalizeRunIfDone(env, r.id, now);
    await env.DB.prepare('DELETE FROM scheduler_locks WHERE name = ? AND holder = ?').bind(LOCK, r.id).run();
  }
}
