import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { OPPORTUNITY_CATEGORIES } from '../../../shared/constants';
import { requireAdmin } from '../../lib/auth';
import { badRequest, body, conflict, notFound } from '../../lib/http';
import { audit, getConfig } from '../../lib/store';
import { isPublicHttpUrl } from '../../lib/url';
import { newId, nowIso, parseJson } from '../../lib/util';
import { CONNECTOR_TYPES } from '../../domain/ingestion/connectors';
import { drainTasks, startRun } from '../../domain/ingestion/pipeline';
import { processMatchAlerts } from '../../domain/alerts';

/** Admin: opportunity source registry and ingestion runs. */
export const sourceRoutes = new Hono<AppEnv>();

/* ---------- Sources ---------- */
const sourceSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().trim().min(3).max(150),
  owner: z.string().trim().min(2).max(150),
  website: z.string().trim().max(300),
  source_type: z.enum(['official', 'ats', 'aggregator', 'partner', 'curated']),
  connector: z.string().refine((v) => CONNECTOR_TYPES.includes(v), 'Unknown connector'),
  config: z.record(z.string(), z.unknown()).default({}),
  categories: z.array(z.enum(OPPORTUNITY_CATEGORIES)).max(16).default([]),
  geography: z.array(z.string().max(80)).max(30).default([]),
  access_method: z.string().trim().min(3).max(300),
  terms_url: z.string().trim().max(300).nullable().optional(),
  automation: z.enum(['automated', 'partial', 'curated']),
  enabled: z.boolean().default(false),
  refresh_minutes: z.number().int().min(60).max(10080).default(360),
  rate_limit_per_hour: z.number().int().min(0).max(1000).default(4),
  verification_policy: z.string().trim().min(3).max(500),
  notes: z.string().max(2000).nullable().optional(),
});

function validateSourceConfig(s: z.infer<typeof sourceSchema>) {
  if ((s.connector === 'rss' || s.connector === 'json') && !isPublicHttpUrl(String(s.config.url ?? '')))
    throw badRequest('This connector needs a public https URL in config.url.', {
      config: 'config.url must be a public https URL',
    });
  if (s.connector === 'lever' && !/^[a-z0-9-]{2,80}$/i.test(String(s.config.company ?? '')))
    throw badRequest('Lever needs config.company.');
  if (s.connector === 'greenhouse' && !/^[a-z0-9-]{2,80}$/i.test(String(s.config.board ?? '')))
    throw badRequest('Greenhouse needs config.board.');
}

sourceRoutes.get('/sources', async (c) => {
  const rows = (
    await c.env.DB.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM source_records sr WHERE sr.source_id = s.id) AS records,
              (SELECT COUNT(*) FROM opportunities o WHERE o.source_id = s.id AND o.status = 'open') AS open_items
       FROM sources s ORDER BY s.enabled DESC, s.name`,
    ).all<any>()
  ).results;
  return c.json({
    sources: rows.map((r) => ({
      ...r,
      config: parseJson(r.config, {}),
      categories: parseJson(r.categories, []),
      geography: parseJson(r.geography, []),
    })),
    connectors: CONNECTOR_TYPES,
  });
});

sourceRoutes.post('/sources', async (c) => {
  const admin = requireAdmin(c);
  const s = await body(c, sourceSchema);
  validateSourceConfig(s);
  const id = newId('src');
  const ts = nowIso();
  try {
    await c.env.DB.prepare(
      `INSERT INTO sources (id, slug, name, owner, website, source_type, connector, config, categories, geography, access_method, terms_url, automation, enabled,
         refresh_minutes, rate_limit_per_hour, verification_policy, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        s.slug,
        s.name,
        s.owner,
        s.website,
        s.source_type,
        s.connector,
        JSON.stringify(s.config),
        JSON.stringify(s.categories),
        JSON.stringify(s.geography),
        s.access_method,
        s.terms_url ?? null,
        s.automation,
        s.enabled ? 1 : 0,
        s.refresh_minutes,
        s.rate_limit_per_hour,
        s.verification_policy,
        s.notes ?? null,
        ts,
        ts,
      )
      .run();
  } catch (e) {
    if (/UNIQUE/.test(String(e))) throw conflict('A source with that slug already exists.');
    throw e;
  }
  await audit(c.env, admin.id, 'admin.source_created', 'source', id, {
    slug: s.slug,
    connector: s.connector,
  });
  return c.json({ id }, 201);
});

sourceRoutes.put('/sources/:id', async (c) => {
  const admin = requireAdmin(c);
  const s = await body(c, sourceSchema);
  validateSourceConfig(s);
  const r = await c.env.DB.prepare(
    `UPDATE sources SET slug = ?, name = ?, owner = ?, website = ?, source_type = ?, connector = ?, config = ?, categories = ?, geography = ?, access_method = ?, terms_url = ?,
       automation = ?, enabled = ?, refresh_minutes = ?, rate_limit_per_hour = ?, verification_policy = ?, notes = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      s.slug,
      s.name,
      s.owner,
      s.website,
      s.source_type,
      s.connector,
      JSON.stringify(s.config),
      JSON.stringify(s.categories),
      JSON.stringify(s.geography),
      s.access_method,
      s.terms_url ?? null,
      s.automation,
      s.enabled ? 1 : 0,
      s.refresh_minutes,
      s.rate_limit_per_hour,
      s.verification_policy,
      s.notes ?? null,
      nowIso(),
      c.req.param('id'),
    )
    .run();
  if (!r.meta.changes) throw notFound('Source not found.');
  await audit(c.env, admin.id, 'admin.source_updated', 'source', c.req.param('id'), { enabled: s.enabled });
  return c.json({ ok: true });
});

sourceRoutes.post('/sources/:id/toggle', async (c) => {
  const admin = requireAdmin(c);
  const { enabled } = await body(c, z.object({ enabled: z.boolean() }));
  const r = await c.env.DB.prepare('UPDATE sources SET enabled = ?, updated_at = ? WHERE id = ?')
    .bind(enabled ? 1 : 0, nowIso(), c.req.param('id'))
    .run();
  if (!r.meta.changes) throw notFound('Source not found.');
  await audit(
    c.env,
    admin.id,
    enabled ? 'admin.source_enabled' : 'admin.source_disabled',
    'source',
    c.req.param('id'),
  );
  return c.json({ ok: true });
});

/* ---------- Ingestion runs ---------- */
sourceRoutes.get('/runs', async (c) => {
  const runs = (
    await c.env.DB.prepare('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 50').all()
  ).results;
  const schedule = {
    interval_hours: await getConfig(c.env, 'ingestion.interval_hours', 6),
    cron: '*/15 * * * * (tick; runs start when the interval has elapsed)',
  };
  return c.json({ runs, schedule });
});

sourceRoutes.get('/runs/:id', async (c) => {
  const run = await c.env.DB.prepare('SELECT * FROM ingestion_runs WHERE id = ?')
    .bind(c.req.param('id'))
    .first();
  if (!run) throw notFound('Run not found.');
  const tasks = (
    await c.env.DB.prepare(
      'SELECT t.*, s.name AS source_name, s.slug FROM ingestion_tasks t JOIN sources s ON s.id = t.source_id WHERE t.run_id = ? ORDER BY s.name',
    )
      .bind(c.req.param('id'))
      .all()
  ).results;
  return c.json({ run, tasks });
});

sourceRoutes.post('/runs', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(c, z.object({ source_ids: z.array(z.string().max(60)).max(50).optional() }));
  const res = await startRun(c.env, 'admin', { actorId: admin.id, sourceIds: input.source_ids });
  await audit(c.env, admin.id, 'admin.ingestion_run', 'ingestion_run', res.runId, {
    started: res.started,
    reason: res.reason ?? null,
  });
  if (res.started) {
    // Process a first batch now; the scheduler drains the rest. Alerts follow in the background.
    await drainTasks(c.env, { max: 3 });
    c.executionCtx.waitUntil(
      processMatchAlerts(c.env)
        .then(() => undefined)
        .catch(() => undefined),
    );
  }
  return c.json(res, res.started ? 201 : 200);
});

sourceRoutes.post('/tasks/:id/retry', async (c) => {
  const admin = requireAdmin(c);
  const t = await c.env.DB.prepare('SELECT run_id, status FROM ingestion_tasks WHERE id = ?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!t) throw notFound('Task not found.');
  if (t.status !== 'dead') throw badRequest('Only failed tasks can be retried.');
  const ts = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE ingestion_tasks SET status = 'pending', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE id = ?",
    ).bind(ts, ts, c.req.param('id')),
    c.env.DB.prepare(
      "UPDATE ingestion_runs SET status = 'running', finished_at = NULL WHERE id = ? AND status IN ('failed','completed_with_errors')",
    ).bind(t.run_id),
  ]);
  await audit(c.env, admin.id, 'admin.task_retry', 'ingestion_task', c.req.param('id'));
  await drainTasks(c.env, { max: 1 });
  return c.json({ ok: true });
});

sourceRoutes.post('/drain', async (c) => {
  requireAdmin(c);
  const processed = await drainTasks(c.env, { max: 3 });
  return c.json({ processed });
});
