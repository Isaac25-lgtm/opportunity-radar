import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { requireAdmin } from '../../lib/auth';
import { badRequest, body, notFound } from '../../lib/http';
import { audit } from '../../lib/store';
import { clampInt, nowIso } from '../../lib/util';

/** Admin: platform metrics, contact messages and user management. */
export const overviewRoutes = new Hono<AppEnv>();

/* ---------- Metrics ---------- */
overviewRoutes.get('/metrics', async (c) => {
  const one = (sql: string) =>
    c.env.DB.prepare(sql)
      .first<{ n: number }>()
      .then((r) => r?.n ?? 0);
  const [
    users,
    profiles,
    openOpps,
    totalOpps,
    sources,
    enabledSources,
    notifications,
    delivered,
    failedDeliveries,
    activeSubs,
    payments,
    pendingMod,
  ] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
    one('SELECT COUNT(*) AS n FROM profiles WHERE deleted_at IS NULL'),
    one("SELECT COUNT(*) AS n FROM opportunities WHERE status = 'open'"),
    one('SELECT COUNT(*) AS n FROM opportunities'),
    one('SELECT COUNT(*) AS n FROM sources'),
    one('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1'),
    one('SELECT COUNT(*) AS n FROM notifications'),
    one("SELECT COUNT(*) AS n FROM notification_deliveries WHERE status = 'sent'"),
    one("SELECT COUNT(*) AS n FROM notification_deliveries WHERE status = 'failed'"),
    one(
      "SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND current_period_end > datetime('now')",
    ),
    one("SELECT COUNT(*) AS n FROM payments WHERE status = 'completed'"),
    one("SELECT COUNT(*) AS n FROM opportunities WHERE moderation = 'pending'"),
  ]);
  const byCategory = (
    await c.env.DB.prepare(
      "SELECT category, COUNT(*) AS n FROM opportunities WHERE status = 'open' GROUP BY category ORDER BY n DESC",
    ).all()
  ).results;
  const byVerification = (
    await c.env.DB.prepare(
      "SELECT verification, COUNT(*) AS n FROM opportunities WHERE status = 'open' GROUP BY verification",
    ).all()
  ).results;
  const runs = (await c.env.DB.prepare('SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 5').all())
    .results;
  const matches = await one('SELECT COUNT(*) AS n FROM matches');
  return c.json({
    users,
    profiles,
    open_opportunities: openOpps,
    total_opportunities: totalOpps,
    sources,
    enabled_sources: enabledSources,
    notifications,
    deliveries_sent: delivered,
    deliveries_failed: failedDeliveries,
    active_subscriptions: activeSubs,
    completed_payments: payments,
    pending_moderation: pendingMod,
    matches,
    by_category: byCategory,
    by_verification: byVerification,
    recent_runs: runs,
  });
});

/* ---------- Contact messages ---------- */
overviewRoutes.get('/messages', async (c) => {
  const rows = (
    await c.env.DB.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100').all()
  ).results;
  return c.json({ messages: rows });
});
overviewRoutes.post('/messages/:id/handled', async (c) => {
  const admin = requireAdmin(c);
  await c.env.DB.prepare("UPDATE contact_messages SET status = 'handled' WHERE id = ?")
    .bind(c.req.param('id'))
    .run();
  await audit(c.env, admin.id, 'admin.message_handled', 'contact_message', c.req.param('id'));
  return c.json({ ok: true });
});

/* ---------- Users ---------- */
overviewRoutes.get('/users', async (c) => {
  const q = c.req.query('q')?.slice(0, 80) ?? '';
  const page = clampInt(c.req.query('page'), 1, 1000, 1);
  const rows = (
    await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at,
         (SELECT COUNT(*) FROM profiles p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS profiles,
         (SELECT pl.name FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id WHERE s.user_id = u.id AND s.status = 'active' AND s.current_period_end > datetime('now') ORDER BY pl.sort DESC LIMIT 1) AS plan
       FROM users u WHERE u.status != 'deleted' AND (u.email LIKE ?1 OR u.name LIKE ?1) ORDER BY u.created_at DESC LIMIT 50 OFFSET ?2`,
    )
      .bind(`%${q.replace(/[%_]/g, '')}%`, (page - 1) * 50)
      .all()
  ).results;
  return c.json({ users: rows });
});

overviewRoutes.patch('/users/:id', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(
    c,
    z.object({
      role: z.enum(['user', 'admin']).optional(),
      status: z.enum(['active', 'suspended']).optional(),
    }),
  );
  const id = c.req.param('id');
  if (id === admin.id && (input.role === 'user' || input.status === 'suspended'))
    throw badRequest('You cannot remove your own admin access or suspend yourself.');
  const r = await c.env.DB.prepare(
    "UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status), updated_at = ? WHERE id = ? AND status != 'deleted'",
  )
    .bind(input.role ?? null, input.status ?? null, nowIso(), id)
    .run();
  if (!r.meta.changes) throw notFound('User not found.');
  if (input.status === 'suspended')
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await audit(c.env, admin.id, 'admin.user_updated', 'user', id, input);
  return c.json({ ok: true });
});
