import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { notificationPrefsSchema } from '../../shared/schemas';
import { requireUser } from '../lib/auth';
import { badRequest, body } from '../lib/http';
import { userPlan } from '../lib/store';
import { nowIso, parseJson } from '../lib/util';

/** In-app notifications and alert preferences. */
export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT id, kind, title, body, link, opportunity_id, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    )
      .bind(u.id)
      .all()
  ).results;
  return c.json({ notifications: rows });
});
notificationRoutes.post('/:id/read', async (c) => {
  const u = requireUser(c);
  await c.env.DB.prepare(
    'UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?',
  )
    .bind(nowIso(), c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});
notificationRoutes.post('/read-all', async (c) => {
  const u = requireUser(c);
  await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .bind(nowIso(), u.id)
    .run();
  return c.json({ ok: true });
});
notificationRoutes.get('/prefs', async (c) => {
  const u = requireUser(c);
  const p = await c.env.DB.prepare('SELECT * FROM notification_prefs WHERE user_id = ?')
    .bind(u.id)
    .first<any>();
  const plan = await userPlan(c.env, u.id);
  const prefs = p
    ? {
        ...p,
        email_enabled: !!p.email_enabled,
        in_app_enabled: !!p.in_app_enabled,
        categories: parseJson(p.categories, []),
      }
    : {
        email_enabled: true,
        in_app_enabled: true,
        frequency: 'weekly',
        categories: ['new_match', 'deadline', 'follow_up', 'status_change'],
        min_score: 60,
        quiet_start: null,
        quiet_end: null,
      };
  return c.json({ prefs, allowed_frequencies: plan.entitlements.alert_frequencies });
});
notificationRoutes.put('/prefs', async (c) => {
  const u = requireUser(c);
  const input = await body(c, notificationPrefsSchema);
  const plan = await userPlan(c.env, u.id);
  if (input.frequency !== 'off' && !plan.entitlements.alert_frequencies.includes(input.frequency))
    throw badRequest(`${input.frequency} alerts are not included in the ${plan.name} plan.`, {
      frequency: 'Not included in your plan',
    });
  await c.env.DB.prepare(
    `INSERT INTO notification_prefs (user_id, email_enabled, in_app_enabled, frequency, categories, min_score, quiet_start, quiet_end, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET email_enabled = excluded.email_enabled, in_app_enabled = excluded.in_app_enabled, frequency = excluded.frequency,
       categories = excluded.categories, min_score = excluded.min_score, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, updated_at = excluded.updated_at`,
  )
    .bind(
      u.id,
      input.email_enabled ? 1 : 0,
      input.in_app_enabled ? 1 : 0,
      input.frequency,
      JSON.stringify(input.categories),
      input.min_score,
      input.quiet_start,
      input.quiet_end,
      nowIso(),
    )
    .run();
  return c.json({ ok: true });
});
