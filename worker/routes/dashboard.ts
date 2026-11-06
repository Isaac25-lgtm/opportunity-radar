import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireUser } from '../lib/auth';
import { getConfig, getWeights, userPlan } from '../lib/store';
import { topMatchesForUser } from '../domain/feed';
import { nowIso, parseJson } from '../lib/util';
import { OPP_LIST_COLUMNS, publicOpportunity } from '../domain/opportunities';
import { profileCompleteness } from '../../shared/completeness';

/** Signed-in dashboard summary. */
export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const staleHours = Number(await getConfig(c.env, 'ingestion.stale_after_hours', 72)) || 72;
  const now = nowIso();
  const soon = new Date(Date.now() + 14 * 86400_000).toISOString();
  const [profiles, deadlines, savedCount, apps, alerts, lastRun, openCount] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, type, data, completeness FROM profiles WHERE user_id = ? AND deleted_at IS NULL',
    )
      .bind(u.id)
      .all<any>(),
    c.env.DB.prepare(
      `SELECT ${OPP_LIST_COLUMNS} FROM user_opportunity uo JOIN opportunities o ON o.id = uo.opportunity_id LEFT JOIN sources s ON s.id = o.source_id
       WHERE uo.user_id = ? AND uo.state = 'saved' AND o.status = 'open' AND o.deadline_at > ? AND o.deadline_at <= ? ORDER BY o.deadline_at LIMIT 6`,
    )
      .bind(u.id, now, soon)
      .all<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM user_opportunity WHERE user_id = ? AND state = 'saved'")
      .bind(u.id)
      .first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT id, kind, title, organization, status, follow_up_at, deadline_at FROM applications WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY CASE WHEN follow_up_at IS NULL THEN 1 ELSE 0 END, follow_up_at, updated_at DESC LIMIT 6`,
    )
      .bind(u.id)
      .all<any>(),
    c.env.DB.prepare(
      'SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    )
      .bind(u.id)
      .all<any>(),
    c.env.DB.prepare(
      "SELECT status, started_at, finished_at, items_new FROM ingestion_runs WHERE status != 'skipped' ORDER BY started_at DESC LIMIT 1",
    ).first<any>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM opportunities WHERE status = 'open' AND moderation = 'approved'",
    ).first<{ n: number }>(),
  ]);
  const plan = await userPlan(c.env, u.id);
  const topMatches = await topMatchesForUser(c.env, u.id, profiles.results, {
    weights: await getWeights(c.env),
    allowBusiness: plan.entitlements.business_matching,
  });
  return c.json({
    profiles: profiles.results.map((p) => ({
      id: p.id,
      type: p.type,
      completeness: p.completeness,
      missing: profileCompleteness(p.type, parseJson(p.data, {})).missing.slice(0, 4),
    })),
    top_matches: topMatches.map(({ row, match }) => ({
      ...publicOpportunity(row, staleHours),
      match: {
        score: match.score,
        eligibility: match.eligibility,
        profile_type: match.profile_type,
        top_reason: match.reasons[0]?.detail ?? null,
      },
    })),
    deadlines: deadlines.results.map((r) => publicOpportunity(r, staleHours)),
    saved_count: savedCount?.n ?? 0,
    applications: apps.results,
    alerts: alerts.results,
    discovery: { last_run: lastRun ?? null, open_opportunities: openCount?.n ?? 0 },
  });
});
