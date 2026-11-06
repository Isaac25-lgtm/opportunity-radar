import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { applicationInputSchema } from '../../shared/schemas';
import { requireUser } from '../lib/auth';
import { badRequest, body, notFound } from '../lib/http';
import { requireWithin, userPlan } from '../lib/store';
import { newId, nowIso, parseJson } from '../lib/util';

/** Application and business-bid tracking. */
export const applicationRoutes = new Hono<AppEnv>();

const isoOrNull = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest('Invalid date.');
  return d.toISOString();
};

async function validateRefs(
  c: any,
  userId: string,
  input: {
    opportunity_id: string | null;
    profile_id: string | null;
    cv_id: string | null;
    document_ids: string[];
  },
) {
  if (
    input.opportunity_id &&
    !(await c.env.DB.prepare('SELECT id FROM opportunities WHERE id = ?').bind(input.opportunity_id).first())
  )
    throw notFound('Opportunity not found.');
  if (
    input.profile_id &&
    !(await c.env.DB.prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(input.profile_id, userId)
      .first())
  )
    throw notFound('Profile not found.');
  if (
    input.cv_id &&
    !(await c.env.DB.prepare('SELECT id FROM cvs WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(input.cv_id, userId)
      .first())
  )
    throw notFound('CV not found.');
  for (const d of input.document_ids)
    if (
      !(await c.env.DB.prepare('SELECT id FROM documents WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
        .bind(d, userId)
        .first())
    )
      throw notFound('Document not found.');
}

applicationRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const kind = c.req.query('kind');
  const rows = (
    await c.env.DB.prepare(
      `SELECT a.*, o.deadline_at AS opp_deadline, o.status AS opp_status FROM applications a LEFT JOIN opportunities o ON o.id = a.opportunity_id
       WHERE a.user_id = ? AND a.deleted_at IS NULL ${kind === 'bid' || kind === 'application' ? 'AND a.kind = ?' : ''} ORDER BY a.updated_at DESC`,
    )
      .bind(...(kind === 'bid' || kind === 'application' ? [u.id, kind] : [u.id]))
      .all<any>()
  ).results;
  return c.json({ applications: rows.map((r) => ({ ...r, document_ids: parseJson(r.document_ids, []) })) });
});

applicationRoutes.post('/', async (c) => {
  const u = requireUser(c);
  const input = await body(c, applicationInputSchema);
  await validateRefs(c, u.id, input);
  const plan = await userPlan(c.env, u.id);
  const n = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM applications WHERE user_id = ? AND deleted_at IS NULL',
  )
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_tracked', n?.n ?? 0, 'tracked applications/bids');
  if (input.opportunity_id) {
    const dup = await c.env.DB.prepare(
      'SELECT id FROM applications WHERE user_id = ? AND opportunity_id = ? AND deleted_at IS NULL',
    )
      .bind(u.id, input.opportunity_id)
      .first<any>();
    if (dup) return c.json({ id: dup.id, existing: true });
  }
  const id = newId('app');
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO applications (id, user_id, profile_id, opportunity_id, kind, title, organization, status, applied_at, follow_up_at, deadline_at, notes, cv_id, document_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      u.id,
      input.profile_id,
      input.opportunity_id,
      input.kind,
      input.title,
      input.organization,
      input.status,
      isoOrNull(input.applied_at),
      isoOrNull(input.follow_up_at),
      isoOrNull(input.deadline_at),
      input.notes,
      input.cv_id,
      JSON.stringify(input.document_ids),
      ts,
      ts,
    )
    .run();
  return c.json({ id }, 201);
});

applicationRoutes.put('/:id', async (c) => {
  const u = requireUser(c);
  const input = await body(c, applicationInputSchema);
  await validateRefs(c, u.id, input);
  const r = await c.env.DB.prepare(
    `UPDATE applications SET kind = ?, title = ?, organization = ?, status = ?, applied_at = ?, follow_up_at = ?, deadline_at = ?, notes = ?, cv_id = ?, document_ids = ?, profile_id = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  )
    .bind(
      input.kind,
      input.title,
      input.organization,
      input.status,
      isoOrNull(input.applied_at),
      isoOrNull(input.follow_up_at),
      isoOrNull(input.deadline_at),
      input.notes,
      input.cv_id,
      JSON.stringify(input.document_ids),
      input.profile_id,
      nowIso(),
      c.req.param('id'),
      u.id,
    )
    .run();
  if (!r.meta.changes) throw notFound('Application not found.');
  return c.json({ ok: true });
});

applicationRoutes.delete('/:id', async (c) => {
  const u = requireUser(c);
  const r = await c.env.DB.prepare(
    'UPDATE applications SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(nowIso(), c.req.param('id'), u.id)
    .run();
  if (!r.meta.changes) throw notFound('Application not found.');
  return c.json({ ok: true });
});
