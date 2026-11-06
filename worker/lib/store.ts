import type { Env } from '../env';
import { FREE_ENTITLEMENTS, entitlementsSchema, type Entitlements } from '../../shared/entitlements';
import { mergeWeights, type Weights } from '../domain/matching/common';
import type { ProfileType } from '../../shared/constants';
import { paymentRequired } from './http';
import { monthKey, newId, nowIso, parseJson } from './util';

/* ---------- Audit ---------- */
export async function audit(
  env: Env,
  actorId: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail: Record<string, unknown> = {},
) {
  await env.DB.prepare(
    'INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      newId('aud'),
      actorId,
      action,
      targetType,
      targetId,
      JSON.stringify(detail).slice(0, 4000),
      nowIso(),
    )
    .run();
}

/* ---------- System config ---------- */
export async function getConfig<T>(env: Env, key: string, fallback: T): Promise<T> {
  const row = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row ? parseJson<T>(row.value, fallback) : fallback;
}

export async function setConfig(env: Env, key: string, value: unknown, actorId: string | null) {
  await env.DB.prepare(
    `INSERT INTO system_config (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  )
    .bind(key, JSON.stringify(value), actorId, nowIso())
    .run();
}

export async function getWeights(env: Env): Promise<Record<ProfileType, Weights>> {
  return mergeWeights(await getConfig(env, 'matching.weights', {}));
}

/* ---------- Plans & entitlements ---------- */
export type PlanInfo = { code: string; name: string; entitlements: Entitlements; period_end: string | null };

export async function userPlan(env: Env, userId: string): Promise<PlanInfo> {
  const row = await env.DB.prepare(
    `SELECT p.code, p.name, p.entitlements, s.current_period_end
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = ? AND s.status = 'active' AND s.current_period_end > ?
     ORDER BY p.sort DESC LIMIT 1`,
  )
    .bind(userId, nowIso())
    .first<any>();
  if (row) {
    const parsed = entitlementsSchema.safeParse(parseJson(row.entitlements, {}));
    return {
      code: row.code,
      name: row.name,
      entitlements: parsed.success ? parsed.data : FREE_ENTITLEMENTS,
      period_end: row.current_period_end,
    };
  }
  const free = await env.DB.prepare("SELECT name, entitlements FROM plans WHERE code = 'free'").first<any>();
  const parsed = entitlementsSchema.safeParse(parseJson(free?.entitlements, {}));
  return {
    code: 'free',
    name: free?.name ?? 'Free',
    entitlements: parsed.success ? parsed.data : FREE_ENTITLEMENTS,
    period_end: null,
  };
}

export async function usage(env: Env, userId: string, metric: string): Promise<number> {
  const r = await env.DB.prepare(
    'SELECT count FROM usage_counters WHERE user_id = ? AND metric = ? AND period = ?',
  )
    .bind(userId, metric, monthKey())
    .first<{ count: number }>();
  return r?.count ?? 0;
}

export async function incrementUsage(env: Env, userId: string, metric: string): Promise<number> {
  const r = await env.DB.prepare(
    `INSERT INTO usage_counters (user_id, metric, period, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, metric, period) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(userId, metric, monthKey())
    .first<{ count: number }>();
  return r?.count ?? 1;
}

/** Throws 402 with a clear message when an entitlement is not included in the user's plan. */
export function requireFeature(plan: PlanInfo, feature: keyof Entitlements, label: string) {
  const v = plan.entitlements[feature];
  if (v === false)
    throw paymentRequired(`${label} is not included in the ${plan.name} plan.`, { feature, plan: plan.code });
}

export function requireWithin(plan: PlanInfo, feature: keyof Entitlements, used: number, label: string) {
  const limit = plan.entitlements[feature] as number;
  if (limit >= 0 && used >= limit)
    throw paymentRequired(`Your ${plan.name} plan allows ${limit} ${label}. Upgrade to add more.`, {
      feature,
      plan: plan.code,
      limit,
      used,
    });
}
