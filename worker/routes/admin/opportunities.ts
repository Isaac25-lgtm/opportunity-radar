import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { opportunityInputSchema, requirementsSchema } from '../../../shared/schemas';
import { requireAdmin } from '../../lib/auth';
import { badRequest, body, conflict, notFound } from '../../lib/http';
import { summarize, htmlToText } from '../../lib/sanitize';
import { audit } from '../../lib/store';
import { isPublicHttpUrl, safeFetch, atsHost } from '../../lib/url';
import { clampInt, newId, nowIso } from '../../lib/util';
import { canonicalKey } from '../../domain/ingestion/normalize';
import type { NormalizedItem } from '../../domain/ingestion/types';
import { OPP_LIST_COLUMNS, publicOpportunity } from '../../domain/opportunities';

/** Admin: opportunity curation, verification, moderation and merging. */
export const opportunityAdminRoutes = new Hono<AppEnv>();

/* ---------- Opportunities (moderation, curation) ---------- */
opportunityAdminRoutes.get('/opportunities', async (c) => {
  const q = c.req.query();
  const where: string[] = ['1 = 1'];
  const binds: unknown[] = [];
  if (q.moderation) {
    where.push('o.moderation = ?');
    binds.push(q.moderation);
  }
  if (q.status) {
    where.push('o.status = ?');
    binds.push(q.status);
  }
  if (q.verification) {
    where.push('o.verification = ?');
    binds.push(q.verification);
  }
  if (q.source_id) {
    where.push('o.source_id = ?');
    binds.push(q.source_id);
  }
  if (q.stale === '1') {
    where.push("o.status = 'open' AND o.last_checked_at < ?");
    binds.push(new Date(Date.now() - 72 * 3600_000).toISOString());
  }
  if (q.q) {
    where.push('(o.title LIKE ? OR o.organization LIKE ? OR o.reference_no LIKE ?)');
    const t = `%${q.q.slice(0, 80).replace(/[%_]/g, '')}%`;
    binds.push(t, t, t);
  }
  const page = clampInt(q.page, 1, 1000, 1);
  const rows = (
    await c.env.DB.prepare(
      `SELECT ${OPP_LIST_COLUMNS}, o.moderation FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE ${where.join(' AND ')} ORDER BY o.updated_at DESC LIMIT 50 OFFSET ?`,
    )
      .bind(...binds, (page - 1) * 50)
      .all<any>()
  ).results;
  return c.json({ items: rows.map((r) => ({ ...publicOpportunity(r, 72), moderation: r.moderation })) });
});

opportunityAdminRoutes.get('/opportunities/:id', async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT ${OPP_LIST_COLUMNS}, o.moderation, o.verified_by FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE o.id = ?`,
  )
    .bind(c.req.param('id'))
    .first<any>();
  if (!r) throw notFound('Opportunity not found.');
  const events = (
    await c.env.DB.prepare(
      'SELECT * FROM opportunity_events WHERE opportunity_id = ? ORDER BY created_at DESC LIMIT 50',
    )
      .bind(r.id)
      .all()
  ).results;
  return c.json({
    opportunity: {
      ...publicOpportunity(r, 72, { full: true }),
      moderation: r.moderation,
      verified_by: r.verified_by,
    },
    events,
  });
});

function toIsoOrNull(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest('Invalid date.', { deadline_at: 'Invalid date' });
  return d.toISOString();
}

opportunityAdminRoutes.post('/opportunities', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(c, opportunityInputSchema);
  const src = await c.env.DB.prepare('SELECT id, slug FROM sources WHERE id = ?')
    .bind(input.source_id)
    .first<any>();
  if (!src) throw badRequest('Choose a source.', { source_id: 'Unknown source' });
  if (!isPublicHttpUrl(input.source_url, { allowHttp: true }))
    throw badRequest('Source URL must be a public web address.', { source_url: 'Invalid URL' });
  const description = htmlToText(input.description);
  const item: NormalizedItem = {
    external_id: `manual:${newId('m')}`,
    category: input.category,
    title: input.title,
    organization: input.organization,
    description,
    country: input.country || null,
    countries: input.countries,
    location: input.location || input.country || null,
    remote: input.remote,
    source_url: input.source_url,
    application_url: input.application_url || null,
    official_url: input.official_url || null,
    reference_no: input.reference_no || null,
    published_at: toIsoOrNull(input.published_at),
    deadline_at: toIsoOrNull(input.deadline_at),
    deadline_tz: input.deadline_tz || null,
    deadline_note: null,
    status_hint: 'open',
    verification: input.verification,
    meta: input.meta,
    requirements: input.requirements,
    requirements_source: 'admin',
  };
  const key = await canonicalKey(item);
  const dup = await c.env.DB.prepare('SELECT id FROM opportunities WHERE canonical_key = ?')
    .bind(key)
    .first<any>();
  if (dup) throw conflict(`This opportunity already exists (${dup.id}).`);
  const id = newId('opp');
  const ts = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO opportunities (id, canonical_key, category, title, organization, description, summary, country, countries, location, remote, source_id, source_url,
         application_url, official_url, reference_no, published_at, deadline_at, deadline_tz, status, verification, verified_by, verified_at, moderation, meta, requirements,
         requirements_source, first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, 'admin', ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      key,
      item.category,
      item.title,
      item.organization,
      description,
      input.summary || summarize(description),
      item.country,
      JSON.stringify(item.countries),
      item.location,
      item.remote,
      src.id,
      item.source_url,
      item.application_url,
      item.official_url,
      item.reference_no,
      item.published_at,
      item.deadline_at,
      item.deadline_tz,
      input.status,
      input.verification,
      input.verification === 'admin_verified' ? admin.id : null,
      input.verification === 'admin_verified' ? ts : null,
      JSON.stringify(item.meta),
      JSON.stringify(requirementsSchema.parse(item.requirements)),
      ts,
      ts,
      ts,
      ts,
      ts,
    ),
    c.env.DB.prepare(
      'INSERT INTO source_records (id, source_id, external_id, opportunity_id, url, content_hash, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(newId('srec'), src.id, item.external_id, id, item.source_url, 'manual', ts, ts),
    c.env.DB.prepare(
      "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, 'created', ?, ?, ?)",
    ).bind(
      newId('oev'),
      id,
      JSON.stringify({ curated: true, verification: input.verification }),
      admin.id,
      ts,
    ),
  ]);
  await audit(c.env, admin.id, 'admin.opportunity_created', 'opportunity', id, { title: item.title });
  return c.json({ id }, 201);
});

opportunityAdminRoutes.put('/opportunities/:id', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(c, opportunityInputSchema);
  const cur = await c.env.DB.prepare('SELECT * FROM opportunities WHERE id = ?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!cur) throw notFound('Opportunity not found.');
  const description = htmlToText(input.description);
  const ts = nowIso();
  const deadline = toIsoOrNull(input.deadline_at);
  const events: D1PreparedStatement[] = [];
  if ((cur.deadline_at ?? null) !== deadline)
    events.push(
      c.env.DB.prepare(
        "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, 'deadline_changed', ?, ?, ?)",
      ).bind(newId('oev'), cur.id, JSON.stringify({ from: cur.deadline_at, to: deadline }), admin.id, ts),
    );
  if (cur.status !== input.status)
    events.push(
      c.env.DB.prepare(
        "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, 'status_changed', ?, ?, ?)",
      ).bind(
        newId('oev'),
        cur.id,
        JSON.stringify({ from: cur.status, to: input.status, evidence: 'admin' }),
        admin.id,
        ts,
      ),
    );
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE opportunities SET category = ?, title = ?, organization = ?, description = ?, summary = ?, country = ?, countries = ?, location = ?, remote = ?, source_url = ?,
         application_url = ?, official_url = ?, reference_no = ?, published_at = ?, deadline_at = ?, deadline_tz = ?, status = ?, verification = ?, meta = ?, requirements = ?,
         requirements_source = 'admin', last_checked_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(
      input.category,
      input.title,
      input.organization,
      description,
      input.summary || summarize(description),
      input.country || null,
      JSON.stringify(input.countries),
      input.location || null,
      input.remote,
      input.source_url,
      input.application_url || null,
      input.official_url || null,
      input.reference_no || null,
      toIsoOrNull(input.published_at),
      deadline,
      input.deadline_tz || null,
      input.status,
      input.verification,
      JSON.stringify(input.meta),
      JSON.stringify(requirementsSchema.parse(input.requirements)),
      ts,
      ts,
      cur.id,
    ),
    ...events,
  ]);
  await audit(c.env, admin.id, 'admin.opportunity_updated', 'opportunity', cur.id);
  return c.json({ ok: true });
});

opportunityAdminRoutes.post('/opportunities/:id/moderate', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(
    c,
    z.object({
      action: z.enum(['verify', 'approve', 'reject', 'expire', 'cancel', 'reopen']),
      note: z.string().max(500).optional(),
    }),
  );
  const cur = await c.env.DB.prepare('SELECT id, status FROM opportunities WHERE id = ?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!cur) throw notFound('Opportunity not found.');
  const ts = nowIso();
  const updates: Record<string, string> = {
    verify: "verification = 'admin_verified', verified_by = ?, verified_at = ?, last_checked_at = ?",
    approve: "moderation = 'approved'",
    reject: "moderation = 'rejected'",
    expire: "status = 'expired'",
    cancel: "status = 'cancelled'",
    reopen: "status = 'open'",
  };
  const binds = input.action === 'verify' ? [admin.id, ts, ts] : [];
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE opportunities SET ${updates[input.action]}, updated_at = ? WHERE id = ?`).bind(
      ...binds,
      ts,
      cur.id,
    ),
    c.env.DB.prepare(
      'INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(
      newId('oev'),
      cur.id,
      input.action === 'verify' ? 'verified' : 'status_changed',
      JSON.stringify({ action: input.action, note: input.note ?? null, from: cur.status }),
      admin.id,
      ts,
    ),
  ]);
  await audit(c.env, admin.id, `admin.opportunity_${input.action}`, 'opportunity', cur.id, {
    note: input.note ?? null,
  });
  return c.json({ ok: true });
});

/** Merge a confirmed duplicate into a canonical record: records, saves, applications and matches move over. */
opportunityAdminRoutes.post('/opportunities/:id/merge', async (c) => {
  const admin = requireAdmin(c);
  const { into } = await body(c, z.object({ into: z.string().max(60) }));
  const from = c.req.param('id');
  if (from === into) throw badRequest('Choose a different opportunity.');
  const a = await c.env.DB.prepare('SELECT id FROM opportunities WHERE id = ?').bind(from).first();
  const b = await c.env.DB.prepare('SELECT id FROM opportunities WHERE id = ?').bind(into).first();
  if (!a || !b) throw notFound('Opportunity not found.');
  const ts = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE source_records SET opportunity_id = ? WHERE opportunity_id = ?').bind(
      into,
      from,
    ),
    c.env.DB.prepare(
      'UPDATE OR IGNORE user_opportunity SET opportunity_id = ? WHERE opportunity_id = ?',
    ).bind(into, from),
    c.env.DB.prepare('DELETE FROM user_opportunity WHERE opportunity_id = ?').bind(from),
    c.env.DB.prepare('UPDATE applications SET opportunity_id = ? WHERE opportunity_id = ?').bind(into, from),
    c.env.DB.prepare('DELETE FROM matches WHERE opportunity_id = ?').bind(from),
    c.env.DB.prepare(
      "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, 'merged', ?, ?, ?)",
    ).bind(newId('oev'), into, JSON.stringify({ merged_from: from }), admin.id, ts),
    c.env.DB.prepare(
      "UPDATE opportunities SET moderation = 'rejected', status = 'closed', updated_at = ? WHERE id = ?",
    ).bind(ts, from),
  ]);
  await audit(c.env, admin.id, 'admin.opportunity_merged', 'opportunity', into, { from });
  return c.json({ ok: true });
});

/** Check that the application URL resolves; upgrades to verified_ats only for recognised ATS hosts. */
opportunityAdminRoutes.post('/opportunities/:id/check-link', async (c) => {
  const admin = requireAdmin(c);
  const o = await c.env.DB.prepare('SELECT id, application_url, verification FROM opportunities WHERE id = ?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!o?.application_url) throw notFound('No application URL.');
  let status = 0;
  let error: string | null = null;
  try {
    status = (await safeFetch(o.application_url, { method: 'GET', timeoutMs: 15000, maxBytes: 3_000_000 }))
      .status;
  } catch (e) {
    error = (e as Error).message;
  }
  const ats = atsHost(o.application_url);
  const ts = nowIso();
  await c.env.DB.prepare(
    "INSERT INTO opportunity_events (id, opportunity_id, kind, detail, actor_id, created_at) VALUES (?, ?, 'link_checked', ?, ?, ?)",
  )
    .bind(newId('oev'), o.id, JSON.stringify({ status, error, ats }), admin.id, ts)
    .run();
  if (status >= 200 && status < 300)
    await c.env.DB.prepare('UPDATE opportunities SET last_checked_at = ? WHERE id = ?').bind(ts, o.id).run();
  return c.json({ status, error, ats_host: ats });
});
