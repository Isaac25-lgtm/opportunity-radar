/**
 * Live matching of stored opportunities against a user's profiles. Shared by the opportunity feed,
 * the dashboard and the alert job so that every surface ranks with exactly the same rules.
 */
import type { Env } from '../env';
import { CATEGORIES_BY_PROFILE, type ProfileType } from '../../shared/constants';
import { parseJson } from '../lib/util';
import {
  matchProfile,
  type MatchOpportunity,
  type MatchResult,
  type ProfileRecord,
  type Weights,
} from './matching';
import { OPP_LIST_COLUMNS } from './opportunities';

export type ProfileRow = { id: string; type: ProfileType; data: string };
export type Scored<R> = { row: R; match: MatchResult };

/** Database row (opportunities table) → matcher input. */
export function toMatchOpportunity(r: any): MatchOpportunity {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    organization: r.organization,
    description: r.description ?? '',
    country: r.country,
    countries: parseJson(r.countries, []),
    location: r.location,
    remote: r.remote,
    deadline_at: r.deadline_at,
    status: r.status,
    requirements: parseJson(r.requirements, {}) as MatchOpportunity['requirements'],
    requirements_source: r.requirements_source,
    meta: parseJson(r.meta, {}),
  };
}

export function toProfileRecord(p: ProfileRow): ProfileRecord {
  return { id: p.id, type: p.type, data: parseJson(p.data, {}) };
}

export function scoreRows<R>(
  profile: ProfileRow,
  rows: R[],
  weights: Record<ProfileType, Weights>,
  now = new Date(),
): Scored<R>[] {
  const record = toProfileRecord(profile);
  return rows.map((row) => ({ row, match: matchProfile(record, toMatchOpportunity(row), weights, now) }));
}

/**
 * Best current matches across all of a user's profiles: open, not dismissed, eligible or potential,
 * relevance at or above `minScore`, de-duplicated across profiles, highest relevance first.
 */
export async function topMatchesForUser(
  env: Env,
  userId: string,
  profiles: ProfileRow[],
  opts: {
    weights: Record<ProfileType, Weights>;
    allowBusiness: boolean;
    limit?: number;
    minScore?: number;
    now?: Date;
  },
): Promise<Scored<any>[]> {
  const now = opts.now ?? new Date();
  const best = new Map<string, Scored<any>>();
  for (const p of profiles) {
    if (p.type === 'business' && !opts.allowBusiness) continue;
    const cats = CATEGORIES_BY_PROFILE[p.type];
    const rows = (
      await env.DB.prepare(
        `SELECT ${OPP_LIST_COLUMNS} FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id
         WHERE o.moderation = 'approved' AND o.status = 'open' AND o.category IN (${cats.map(() => '?').join(',')})
           AND (o.deadline_at IS NULL OR o.deadline_at > ?)
           AND NOT EXISTS (SELECT 1 FROM user_opportunity uo WHERE uo.user_id = ? AND uo.opportunity_id = o.id AND uo.state = 'dismissed')
         ORDER BY COALESCE(o.published_at, o.first_seen_at) DESC LIMIT 200`,
      )
        .bind(...cats, now.toISOString(), userId)
        .all<any>()
    ).results;
    for (const s of scoreRows(p, rows, opts.weights, now)) {
      const { eligibility, score } = s.match;
      if (eligibility !== 'eligible' && eligibility !== 'potential') continue;
      if ((score ?? 0) < (opts.minScore ?? 40)) continue;
      const prev = best.get(s.row.id);
      if (!prev || (prev.match.score ?? 0) < (score ?? 0)) best.set(s.row.id, s);
    }
  }
  return [...best.values()]
    .sort((a, b) => (b.match.score ?? 0) - (a.match.score ?? 0))
    .slice(0, opts.limit ?? 6);
}
