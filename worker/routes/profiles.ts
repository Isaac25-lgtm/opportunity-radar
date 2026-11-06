import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { PROFILE_TYPES, type ProfileType } from '../../shared/constants';
import { profileSchemas } from '../../shared/schemas';
import { profileCompleteness } from '../../shared/completeness';
import { requireUser } from '../lib/auth';
import { badRequest, body, notFound } from '../lib/http';
import { requireWithin, userPlan } from '../lib/store';
import { newId, nowIso, parseJson } from '../lib/util';

export const profileRoutes = new Hono<AppEnv>();

const TITLES: Record<ProfileType, string> = {
  career: 'Career profile',
  academic: 'Academic profile',
  business: 'Business profile',
};

function typeParam(v: string): ProfileType {
  if (!(PROFILE_TYPES as readonly string[]).includes(v)) throw notFound('Unknown profile type.');
  return v as ProfileType;
}

profileRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT id, type, title, data, completeness, updated_at FROM profiles WHERE user_id = ? AND deleted_at IS NULL',
    )
      .bind(u.id)
      .all<any>()
  ).results;
  return c.json({
    profiles: rows.map((r) => ({
      ...r,
      data: parseJson(r.data, {}),
      missing: profileCompleteness(r.type, parseJson(r.data, {})).missing,
    })),
  });
});

profileRoutes.get('/:type', async (c) => {
  const u = requireUser(c);
  const type = typeParam(c.req.param('type'));
  const r = await c.env.DB.prepare(
    'SELECT id, type, title, data, completeness, updated_at FROM profiles WHERE user_id = ? AND type = ? AND deleted_at IS NULL',
  )
    .bind(u.id, type)
    .first<any>();
  if (!r) return c.json({ profile: null });
  const data = parseJson(r.data, {});
  return c.json({ profile: { ...r, data, missing: profileCompleteness(type, data).missing } });
});

profileRoutes.put('/:type', async (c) => {
  const u = requireUser(c);
  const type = typeParam(c.req.param('type'));
  const input = await body(c, z.object({ data: z.unknown() }));
  const parsed = profileSchemas[type].safeParse(input.data ?? {});
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const i of parsed.error.issues) details[i.path.join('.')] ??= i.message;
    throw badRequest('Please check the highlighted fields.', details);
  }
  const data = parsed.data;
  const { score } = profileCompleteness(type, data);
  const ts = nowIso();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM profiles WHERE user_id = ? AND type = ? AND deleted_at IS NULL',
  )
    .bind(u.id, type)
    .first<{ id: string }>();
  if (existing) {
    await c.env.DB.prepare(
      'UPDATE profiles SET data = ?, completeness = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    )
      .bind(JSON.stringify(data), score, ts, existing.id, u.id)
      .run();
    return c.json({ id: existing.id, completeness: score });
  }
  const plan = await userPlan(c.env, u.id);
  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM profiles WHERE user_id = ? AND deleted_at IS NULL',
  )
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_profiles', count?.n ?? 0, 'active profile(s)');
  const id = newId('prf');
  await c.env.DB.prepare(
    'INSERT INTO profiles (id, user_id, type, title, data, completeness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, type, TITLES[type], JSON.stringify(data), score, ts, ts)
    .run();
  return c.json({ id, completeness: score }, 201);
});

profileRoutes.delete('/:type', async (c) => {
  const u = requireUser(c);
  const type = typeParam(c.req.param('type'));
  const r = await c.env.DB.prepare(
    'UPDATE profiles SET deleted_at = ?, data = ? WHERE user_id = ? AND type = ? AND deleted_at IS NULL',
  )
    .bind(nowIso(), '{}', u.id, type)
    .run();
  if (!r.meta.changes) throw notFound('Profile not found.');
  return c.json({ ok: true });
});
