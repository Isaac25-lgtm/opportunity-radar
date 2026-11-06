import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { entitlementsSchema } from '../../../shared/entitlements';
import { requireAdmin } from '../../lib/auth';
import { badRequest, body, notFound } from '../../lib/http';
import { checkEnv } from '../../lib/providers';
import { audit, setConfig } from '../../lib/store';
import { clampInt, nowIso, parseJson } from '../../lib/util';

/** Admin: plans and entitlements, payments, audit log and runtime configuration. */
export const settingsRoutes = new Hono<AppEnv>();

/* ---------- Plans ---------- */
settingsRoutes.get('/plans', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM plans ORDER BY sort').all<any>()).results;
  return c.json({ plans: rows.map((r) => ({ ...r, entitlements: parseJson(r.entitlements, {}) })) });
});
settingsRoutes.put('/plans/:code', async (c) => {
  const admin = requireAdmin(c);
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(2).max(60),
      description: z.string().max(300),
      price_ugx: z.number().int().min(0).max(10_000_000),
      active: z.boolean(),
      entitlements: entitlementsSchema,
    }),
  );
  if (c.req.param('code') === 'free' && input.price_ugx !== 0) throw badRequest('The free plan must cost 0.');
  const r = await c.env.DB.prepare(
    'UPDATE plans SET name = ?, description = ?, price_ugx = ?, active = ?, entitlements = ?, updated_at = ? WHERE code = ?',
  )
    .bind(
      input.name,
      input.description,
      input.price_ugx,
      input.active ? 1 : 0,
      JSON.stringify(input.entitlements),
      nowIso(),
      c.req.param('code'),
    )
    .run();
  if (!r.meta.changes) throw notFound('Plan not found.');
  await audit(c.env, admin.id, 'admin.plan_updated', 'plan', c.req.param('code'), {
    price_ugx: input.price_ugx,
    active: input.active,
  });
  return c.json({ ok: true });
});

/* ---------- Payments, audit, config ---------- */
settingsRoutes.get('/payments', async (c) => {
  const rows = (
    await c.env.DB.prepare(
      'SELECT p.id, p.merchant_reference, p.provider, p.provider_tracking_id, p.amount, p.currency, p.status, p.status_detail, p.created_at, p.completed_at, u.email, pl.name AS plan_name FROM payments p JOIN users u ON u.id = p.user_id JOIN plans pl ON pl.id = p.plan_id ORDER BY p.created_at DESC LIMIT 100',
    ).all()
  ).results;
  const subs = (
    await c.env.DB.prepare(
      'SELECT s.id, s.status, s.current_period_end, u.email, pl.name AS plan_name FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans pl ON pl.id = s.plan_id ORDER BY s.created_at DESC LIMIT 100',
    ).all()
  ).results;
  return c.json({ payments: rows, subscriptions: subs });
});

settingsRoutes.get('/audit', async (c) => {
  const page = clampInt(c.req.query('page'), 1, 1000, 1);
  const rows = (
    await c.env.DB.prepare(
      'SELECT a.*, u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 100 OFFSET ?',
    )
      .bind((page - 1) * 100)
      .all<any>()
  ).results;
  return c.json({ entries: rows.map((r) => ({ ...r, detail: parseJson(r.detail, {}) })) });
});

const EDITABLE_CONFIG: Record<string, z.ZodTypeAny> = {
  'ingestion.interval_hours': z.number().int().min(1).max(48),
  'ingestion.max_tasks_per_tick': z.number().int().min(1).max(10),
  'ingestion.stale_after_hours': z.number().int().min(6).max(720),
  'ingestion.missing_runs_before_uncertain': z.number().int().min(1).max(10),
  'alerts.min_score_default': z.number().int().min(0).max(100),
  'matching.weights': z.record(z.string(), z.record(z.string(), z.number().min(0).max(100))),
  'payments.enabled': z.boolean(),
};

settingsRoutes.get('/config', async (c) => {
  const rows = (
    await c.env.DB.prepare(
      'SELECT key, value, updated_at, updated_by FROM system_config ORDER BY key',
    ).all<any>()
  ).results;
  return c.json({
    config: rows
      .filter((r) => r.key in EDITABLE_CONFIG)
      .map((r) => ({ ...r, value: parseJson(r.value, null) })),
    environment: checkEnv(c.env),
    environment_name: c.env.ENVIRONMENT,
  });
});

settingsRoutes.put('/config/:key', async (c) => {
  const admin = requireAdmin(c);
  const key = c.req.param('key');
  const schema = EDITABLE_CONFIG[key];
  if (!schema) throw notFound('Unknown setting.');
  const { value } = await body(c, z.object({ value: schema }));
  await setConfig(c.env, key, value, admin.id);
  await audit(c.env, admin.id, 'admin.config_updated', 'config', key, { value });
  return c.json({ ok: true });
});
