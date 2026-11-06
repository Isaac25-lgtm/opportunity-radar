import { Hono } from 'hono';
import type { AppEnv } from '../env';
import {
  CATEGORIES_BY_PROFILE,
  OPPORTUNITY_CATEGORIES,
  PROFILE_TYPES,
  type ProfileType,
} from '../../shared/constants';
import { requireUser } from '../lib/auth';
import { badRequest, notFound } from '../lib/http';
import { getConfig, getWeights, userPlan } from '../lib/store';
import { clampInt, nowIso, parseJson } from '../lib/util';
import { scoreRows, toMatchOpportunity, toProfileRecord } from '../domain/feed';
import { matchProfile, rankMatches } from '../domain/matching';
import { OPP_LIST_COLUMNS, publicOpportunity } from '../domain/opportunities';

export const opportunityRoutes = new Hono<AppEnv>();

const PAGE = 20;

/**
 * Feed. For signed-in users with a profile matching the selected view, every candidate is scored live
 * against the current profile (so edits take effect immediately). Anonymous visitors see a plain list.
 */
opportunityRoutes.get('/', async (c) => {
  const u = c.get('user');
  const q = c.req.query();
  const view = (q.view ?? 'all') as ProfileType | 'all';
  if (view !== 'all' && !(PROFILE_TYPES as readonly string[]).includes(view))
    throw badRequest('Unknown view.');
  const page = clampInt(q.page, 1, 500, 1);
  const where: string[] = ["o.moderation = 'approved'"];
  const binds: unknown[] = [];
  let cats: string[] = view === 'all' ? [...OPPORTUNITY_CATEGORIES] : CATEGORIES_BY_PROFILE[view];
  if (q.category) {
    const req = q.category
      .split(',')
      .filter((x) => (OPPORTUNITY_CATEGORIES as readonly string[]).includes(x));
    cats = cats.filter((x) => req.includes(x));
    if (!cats.length) return c.json({ items: [], total: 0, page, pages: 0, matched: false });
  }
  where.push(`o.category IN (${cats.map(() => '?').join(',')})`);
  binds.push(...cats);
  if (q.status !== 'all') where.push("o.status IN ('open','status_uncertain')");
  if (q.q) {
    const term = `%${q.q.slice(0, 80).replace(/[%_]/g, '')}%`;
    where.push('(o.title LIKE ? OR o.organization LIKE ? OR o.summary LIKE ? OR o.location LIKE ?)');
    binds.push(term, term, term, term);
  }
  if (q.country) {
    where.push('(o.country = ? OR o.location LIKE ?)');
    binds.push(q.country.slice(0, 80), `%${q.country.slice(0, 80)}%`);
  }
  if (q.remote === 'remote') where.push("o.remote = 'remote'");
  if (q.organization) {
    where.push('o.organization LIKE ?');
    binds.push(`%${q.organization.slice(0, 80)}%`);
  }
  if (q.verification === 'verified')
    where.push("o.verification IN ('verified_official','verified_ats','admin_verified')");
  if (q.deadline_days) {
    const days = clampInt(q.deadline_days, 1, 365, 30);
    where.push('o.deadline_at IS NOT NULL AND o.deadline_at <= ?');
    binds.push(new Date(Date.now() + days * 86400_000).toISOString());
  }
  if (q.published_days) {
    const days = clampInt(q.published_days, 1, 365, 7);
    where.push('COALESCE(o.published_at, o.first_seen_at) >= ?');
    binds.push(new Date(Date.now() - days * 86400_000).toISOString());
  }
  if (u && q.include_dismissed !== '1') {
    where.push(
      "NOT EXISTS (SELECT 1 FROM user_opportunity uo WHERE uo.user_id = ? AND uo.opportunity_id = o.id AND uo.state = 'dismissed')",
    );
    binds.push(u.id);
  }
  const staleHours = Number(await getConfig(c.env, 'ingestion.stale_after_hours', 72)) || 72;
  const sort = q.sort ?? 'match';
  const order =
    sort === 'deadline'
      ? 'CASE WHEN o.deadline_at IS NULL THEN 1 ELSE 0 END, o.deadline_at ASC'
      : 'COALESCE(o.published_at, o.first_seen_at) DESC';
  const whereSql = where.join(' AND ');

  let profile: any = null;
  if (u && view !== 'all') {
    profile = await c.env.DB.prepare(
      'SELECT id, type, data FROM profiles WHERE user_id = ? AND type = ? AND deleted_at IS NULL',
    )
      .bind(u.id, view)
      .first<any>();
  }
  const savedRows = u
    ? (
        await c.env.DB.prepare('SELECT opportunity_id, state FROM user_opportunity WHERE user_id = ?')
          .bind(u.id)
          .all<any>()
      ).results
    : [];
  const saved = new Map(savedRows.map((r) => [r.opportunity_id, r.state]));

  if (profile) {
    const plan = await userPlan(c.env, u!.id);
    const gated = view === 'business' && !plan.entitlements.business_matching;
    const rows = (
      await c.env.DB.prepare(
        `SELECT ${OPP_LIST_COLUMNS} FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE ${whereSql} ORDER BY ${order} LIMIT 400`,
      )
        .bind(...binds)
        .all<any>()
    ).results;
    if (!gated) {
      const weights = await getWeights(c.env);
      let scored = scoreRows(profile, rows, weights);
      const minScore = q.min_score ? clampInt(q.min_score, 0, 100, 0) : 0;
      if (minScore) scored = scored.filter((s) => (s.match.score ?? 0) >= minScore);
      if (q.eligibility) scored = scored.filter((s) => s.match.eligibility === q.eligibility);
      if (sort === 'match') scored = rankMatches(scored);
      const total = scored.length;
      const slice = scored.slice((page - 1) * PAGE, page * PAGE);
      return c.json({
        items: slice.map(({ row: r, match }) => ({
          ...publicOpportunity(r, staleHours),
          match: {
            score: match.score,
            eligibility: match.eligibility,
            confidence: match.confidence,
            top_reason: match.reasons[0]?.detail ?? null,
            missing_count: match.missing.length,
          },
          user_state: saved.get(r.id) ?? null,
        })),
        total,
        page,
        pages: Math.ceil(total / PAGE),
        matched: true,
        capped: rows.length >= 400,
      });
    }
    const total = rows.length;
    return c.json({
      items: rows.slice((page - 1) * PAGE, page * PAGE).map((r) => ({
        ...publicOpportunity(r, staleHours),
        match: null,
        user_state: saved.get(r.id) ?? null,
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE),
      matched: false,
      gated: 'business_matching',
    });
  }

  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM opportunities o WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const rows = (
    await c.env.DB.prepare(
      `SELECT ${OPP_LIST_COLUMNS} FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
      .bind(...binds, PAGE, (page - 1) * PAGE)
      .all<any>()
  ).results;
  const total = count?.n ?? 0;
  return c.json({
    items: rows.map((r) => ({
      ...publicOpportunity(r, staleHours),
      match: null,
      user_state: saved.get(r.id) ?? null,
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE),
    matched: false,
    needs_profile: !!u && view !== 'all',
  });
});

opportunityRoutes.get('/saved', async (c) => {
  const u = requireUser(c);
  const staleHours = Number(await getConfig(c.env, 'ingestion.stale_after_hours', 72)) || 72;
  const rows = (
    await c.env.DB.prepare(
      `SELECT ${OPP_LIST_COLUMNS}, uo.created_at AS saved_at FROM user_opportunity uo JOIN opportunities o ON o.id = uo.opportunity_id
       LEFT JOIN sources s ON s.id = o.source_id WHERE uo.user_id = ? AND uo.state = 'saved' ORDER BY uo.created_at DESC LIMIT 200`,
    )
      .bind(u.id)
      .all<any>()
  ).results;
  return c.json({
    items: rows.map((r) => ({
      ...publicOpportunity(r, staleHours),
      user_state: 'saved',
      saved_at: r.saved_at,
    })),
  });
});

opportunityRoutes.get('/:id', async (c) => {
  const u = c.get('user');
  const staleHours = Number(await getConfig(c.env, 'ingestion.stale_after_hours', 72)) || 72;
  const r = await c.env.DB.prepare(
    `SELECT ${OPP_LIST_COLUMNS} FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE o.id = ? AND o.moderation = 'approved'`,
  )
    .bind(c.req.param('id'))
    .first<any>();
  if (!r) throw notFound('Opportunity not found.');
  const events = (
    await c.env.DB.prepare(
      'SELECT kind, detail, created_at FROM opportunity_events WHERE opportunity_id = ? ORDER BY created_at DESC LIMIT 20',
    )
      .bind(r.id)
      .all<any>()
  ).results.map((e) => ({ ...e, detail: parseJson(e.detail, {}) }));
  const sources = (
    await c.env.DB.prepare(
      'SELECT s.name, s.source_type, sr.url, sr.first_seen_at, sr.last_seen_at FROM source_records sr JOIN sources s ON s.id = sr.source_id WHERE sr.opportunity_id = ?',
    )
      .bind(r.id)
      .all()
  ).results;
  const out: Record<string, unknown> = {
    opportunity: publicOpportunity(r, staleHours, { full: true }),
    events,
    sources,
    matches: [],
    user_state: null,
  };
  if (u) {
    const plan = await userPlan(c.env, u.id);
    const profiles = (
      await c.env.DB.prepare('SELECT id, type, data FROM profiles WHERE user_id = ? AND deleted_at IS NULL')
        .bind(u.id)
        .all<any>()
    ).results;
    const weights = await getWeights(c.env);
    const mo = toMatchOpportunity(r);
    out.matches = profiles
      .filter((p) => (CATEGORIES_BY_PROFILE[p.type as ProfileType] as string[]).includes(r.category))
      .map((p) =>
        p.type === 'business' && !plan.entitlements.business_matching
          ? { profile_type: p.type, gated: 'business_matching' }
          : matchProfile(toProfileRecord(p), mo, weights),
      );
    const st = await c.env.DB.prepare(
      'SELECT state FROM user_opportunity WHERE user_id = ? AND opportunity_id = ?',
    )
      .bind(u.id, r.id)
      .first<any>();
    out.user_state = st?.state ?? null;
    const app = await c.env.DB.prepare(
      'SELECT id, status, kind FROM applications WHERE user_id = ? AND opportunity_id = ? AND deleted_at IS NULL',
    )
      .bind(u.id, r.id)
      .first();
    out.application = app ?? null;
  }
  return c.json(out);
});

async function setState(c: any, state: 'saved' | 'dismissed') {
  const u = requireUser(c);
  const id = c.req.param('id');
  const exists = await c.env.DB.prepare(
    "SELECT id FROM opportunities WHERE id = ? AND moderation = 'approved'",
  )
    .bind(id)
    .first();
  if (!exists) throw notFound('Opportunity not found.');
  await c.env.DB.prepare(
    `INSERT INTO user_opportunity (user_id, opportunity_id, state, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, opportunity_id) DO UPDATE SET state = excluded.state, created_at = excluded.created_at`,
  )
    .bind(u.id, id, state, nowIso())
    .run();
  return c.json({ ok: true, state });
}
opportunityRoutes.post('/:id/save', (c) => setState(c, 'saved'));
opportunityRoutes.post('/:id/dismiss', (c) => setState(c, 'dismissed'));
opportunityRoutes.delete('/:id/state', async (c) => {
  const u = requireUser(c);
  await c.env.DB.prepare('DELETE FROM user_opportunity WHERE user_id = ? AND opportunity_id = ?')
    .bind(u.id, c.req.param('id'))
    .run();
  return c.json({ ok: true, state: null });
});
