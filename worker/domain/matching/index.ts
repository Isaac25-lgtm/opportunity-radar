import { CATEGORIES_BY_PROFILE, type ProfileType } from '../../../shared/constants';
import {
  academicProfileSchema,
  businessProfileSchema,
  careerProfileSchema,
  requirementsSchema,
} from '../../../shared/schemas';
import { matchAcademic } from './academic';
import { matchBusiness } from './business';
import { matchCareer } from './career';
import { mergeWeights, type MatchOpportunity, type MatchResult, type Weights } from './common';

export * from './common';

export type ProfileRecord = { id: string; type: ProfileType; data: unknown };

export function profileAccepts(type: ProfileType, category: string): boolean {
  return (CATEGORIES_BY_PROFILE[type] as string[]).includes(category);
}

export function matchProfile(
  profile: ProfileRecord,
  opp: MatchOpportunity,
  weights: Record<ProfileType, Weights> = mergeWeights(undefined),
  now = new Date(),
): MatchResult {
  const o = { ...opp, requirements: requirementsSchema.parse(opp.requirements ?? {}) };
  switch (profile.type) {
    case 'career':
      return matchCareer(careerProfileSchema.parse(profile.data ?? {}), o, weights.career, now);
    case 'academic':
      return matchAcademic(academicProfileSchema.parse(profile.data ?? {}), o, weights.academic, now);
    case 'business':
      return matchBusiness(businessProfileSchema.parse(profile.data ?? {}), o, weights.business, now);
  }
}

/** Sort: eligible/potential first, by score; not-eligible last. */
/** A "potential" match meets every known requirement but has one to confirm: rank it with eligible ones. */
const POTENTIAL_PENALTY = 5;

/**
 * Order: opportunities the person can apply for (eligible or potential) by relevance, then those with
 * too little information to judge, then those they are not eligible for. Relevance never lifts a
 * not-eligible opportunity above one they can apply for.
 */
export function rankMatches<T extends { match: MatchResult }>(items: T[]): T[] {
  const tier = (m: MatchResult) =>
    m.eligibility === 'eligible' || m.eligibility === 'potential'
      ? 0
      : m.eligibility === 'insufficient'
        ? 1
        : 2;
  const rank = (m: MatchResult) => (m.score ?? -1) - (m.eligibility === 'potential' ? POTENTIAL_PENALTY : 0);
  return [...items].sort((a, b) => tier(a.match) - tier(b.match) || rank(b.match) - rank(a.match));
}
