import type { Eligibility, OpportunityCategory, ProfileType } from '../../../shared/constants';
import type { Requirements } from '../../../shared/schemas';

export type MatchOpportunity = {
  id: string;
  category: OpportunityCategory;
  title: string;
  organization: string;
  description: string;
  country: string | null;
  countries: string[];
  location: string | null;
  remote: 'onsite' | 'remote' | 'hybrid' | 'unknown';
  deadline_at: string | null;
  status: string;
  requirements: Requirements;
  requirements_source: 'structured' | 'heuristic' | 'admin' | 'none';
  meta: Record<string, any>;
};

export type MatchReason = { label: string; detail: string };

export type MatchResult = {
  profile_type: ProfileType;
  eligibility: Eligibility;
  /** Relevance 0–100. null when there is not enough profile information to score honestly. */
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasons: MatchReason[];
  missing: string[];
  disqualifiers: string[];
  facts_used: string[];
  requirements_used: string[];
  components: Array<{ key: string; weight: number; value: number | null }>;
  next_action: string;
};

export type Component = { key: string; weight: number; value: number | null };

/** Collects evidence while a matcher runs. */
export class Evidence {
  reasons: MatchReason[] = [];
  missing: string[] = [];
  disqualifiers: string[] = [];
  facts: string[] = [];
  reqs: string[] = [];
  components: Component[] = [];
  insufficient = false;
  /** Upper bound on relevance, set when the core fit (field, scope, role) is clearly absent. */
  cap: number | null = null;

  reason(label: string, detail: string) {
    this.reasons.push({ label, detail });
  }
  miss(m: string) {
    if (!this.missing.includes(m)) this.missing.push(m);
  }
  disqualify(d: string) {
    if (!this.disqualifiers.includes(d)) this.disqualifiers.push(d);
  }
  fact(f: string) {
    if (f && !this.facts.includes(f)) this.facts.push(f);
  }
  req(r: string) {
    if (r && !this.reqs.includes(r)) this.reqs.push(r);
  }
  capScore(max: number) {
    this.cap = this.cap === null ? max : Math.min(this.cap, max);
  }
  component(key: string, weight: number, value: number | null) {
    this.components.push({ key, weight, value: value === null ? null : Math.max(0, Math.min(1, value)) });
  }
}

export function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'and',
  'or',
  'the',
  'of',
  'for',
  'in',
  'to',
  'a',
  'an',
  'with',
  'on',
  'at',
  'by',
  'senior',
  'junior',
  'officer',
  'assistant',
  'lead',
  'head',
  'team',
  'member',
  'specialist',
  'manager',
  'ii',
  'i',
  'iii',
  'consultant',
  'national',
  'international',
  'project',
  'programme',
  'program',
  'services',
  'service',
]);

export function words(s: string): string[] {
  return norm(s)
    .split(/[\s/-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

const reCache = new Map<string, RegExp>();
/** Whole-word / phrase containment, case-insensitive. */
export function containsTerm(haystackNorm: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  let re = reCache.get(t);
  if (!re) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    re = new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`);
    if (reCache.size > 5000) reCache.clear();
    reCache.set(t, re);
  }
  return re.test(haystackNorm);
}

/**
 * Words shared by unrelated disciplines ("Computer Science" vs "Environmental Science"). They are ignored
 * when comparing phrases unless a phrase has no other words.
 */
const GENERIC = new Set([
  'science',
  'sciences',
  'studies',
  'study',
  'applied',
  'general',
  'introduction',
  'public',
  'international',
  'global',
  'national',
  'advanced',
  // Procurement filler: "Supply of …", "Provision of … services".
  'supply',
  'supplies',
  'delivery',
  'provision',
  'service',
  'services',
]);
const specificWords = (s: string) => {
  const all = words(s);
  const specific = all.filter((w) => !GENERIC.has(w));
  return specific.length ? specific : all;
};

/**
 * Balanced overlap (Dice coefficient) of discipline names: "Agricultural economics" vs "Economics" is
 * related (0.67) but not identical, unlike the containment ratio used for job titles.
 */
export function fieldSimilarity(candidates: string[], target: string): { value: number; best: string } {
  const tw = new Set(specificWords(target));
  let best = { value: 0, best: '' };
  if (!tw.size) return best;
  for (const c of candidates) {
    const cw = [...new Set(specificWords(c))];
    if (!cw.length) continue;
    const v = (2 * cw.filter((w) => tw.has(w)).length) / (cw.length + tw.size);
    if (v > best.value) best = { value: v, best: c };
  }
  return best;
}

/** Relevance ceiling when the core fit is missing: other factors alone cannot make a good match. */
export const OFF_TOPIC_CAP = 35;

/** Best word-overlap ratio of any candidate phrase against the target phrase. */
export function phraseSimilarity(candidates: string[], target: string): { value: number; best: string } {
  const tw = new Set(specificWords(target));
  let best = { value: 0, best: '' };
  if (!tw.size) return best;
  for (const c of candidates) {
    const cw = specificWords(c);
    if (!cw.length) continue;
    const hit = cw.filter((w) => tw.has(w)).length;
    const v = hit / Math.min(cw.length, tw.size);
    if (v > best.value) best = { value: v, best: c };
  }
  return best;
}

// Country names, demonyms and groups live in shared/countries so the client and Worker agree.
export { canonicalCountry, countryEligibility, isEastAfrican, sameRegion } from '../../../shared/countries';

export function yearsFromExperience(
  items: Array<{ start?: string; end?: string; current?: boolean }>,
  now = new Date(),
): number | null {
  let months = 0;
  let any = false;
  for (const e of items) {
    const s = parseYm(e.start);
    if (!s) continue;
    const end = e.current ? { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 } : parseYm(e.end);
    if (!end) continue;
    const diff = (end.y - s.y) * 12 + (end.m - s.m);
    if (diff > 0 && diff < 600) {
      months += diff;
      any = true;
    }
  }
  return any ? Math.round((months / 12) * 10) / 10 : null;
}
function parseYm(v?: string): { y: number; m: number } | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!m) return null;
  return { y: Number(m[1]), m: m[2] ? Number(m[2]) : 6 };
}

export function deadlinePassed(o: MatchOpportunity, now: Date): boolean {
  if (!o.deadline_at) return false;
  const d = Date.parse(o.deadline_at);
  return Number.isFinite(d) && d < now.getTime();
}

export function formatDeadline(o: MatchOpportunity): string {
  if (!o.deadline_at) return '';
  const d = new Date(o.deadline_at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Combine components into a 0-100 relevance score; null when known coverage is too low. */
export function combine(
  components: Component[],
  minCoverage = 0.45,
): { score: number | null; coverage: number } {
  const total = components.reduce((a, c) => a + c.weight, 0);
  const known = components.filter((c) => c.value !== null);
  const knownW = known.reduce((a, c) => a + c.weight, 0);
  const coverage = total ? knownW / total : 0;
  if (!knownW || coverage < minCoverage) return { score: null, coverage };
  const v = known.reduce((a, c) => a + c.weight * (c.value as number), 0) / knownW;
  return { score: Math.round(v * 100), coverage };
}

export function finalize(
  profileType: ProfileType,
  o: MatchOpportunity,
  ev: Evidence,
  minCoverage = 0.45,
): MatchResult {
  const combined = combine(ev.components, minCoverage);
  const coverage = combined.coverage;
  const score =
    combined.score !== null && ev.cap !== null ? Math.min(combined.score, ev.cap) : combined.score;
  let eligibility: Eligibility;
  if (ev.disqualifiers.length) eligibility = 'not_eligible';
  else if (ev.insufficient || score === null) eligibility = 'insufficient';
  else if (ev.missing.length) eligibility = 'potential';
  else eligibility = 'eligible';

  let confidence: MatchResult['confidence'] = coverage >= 0.75 ? 'high' : coverage >= 0.5 ? 'medium' : 'low';
  if (o.requirements_source === 'heuristic' && confidence === 'high') confidence = 'medium';
  if (o.requirements_source === 'none') confidence = 'low';
  if (ev.missing.length >= 3 && confidence === 'high') confidence = 'medium';

  const dl = formatDeadline(o);
  let next: string;
  switch (eligibility) {
    case 'not_eligible':
      next = `Not recommended: ${ev.disqualifiers[0]}`;
      break;
    case 'insufficient':
      next = ev.missing.length
        ? `Complete your profile to assess this: ${ev.missing[0]}`
        : 'Add more detail to your profile so this can be assessed.';
      break;
    case 'potential':
      next = `Confirm ${ev.missing.length === 1 ? 'this requirement' : 'these requirements'} on the official page${dl ? `, then apply before ${dl}` : ''}.`;
      break;
    default:
      next = `Review the official notice and apply${dl ? ` before ${dl}` : ''}.`;
  }
  return {
    profile_type: profileType,
    eligibility,
    score,
    confidence,
    reasons: ev.reasons,
    missing: ev.missing,
    disqualifiers: ev.disqualifiers,
    facts_used: ev.facts,
    requirements_used: ev.reqs,
    components: ev.components,
    next_action: next,
  };
}

export type Weights = Record<string, number>;
export const DEFAULT_WEIGHTS: Record<ProfileType, Weights> = {
  career: { skills: 35, role: 25, experience: 15, education: 10, location: 10, employment_type: 5 },
  academic: { field: 35, level: 25, destination: 15, language: 10, academic_standing: 10, funding: 5 },
  business: { scope: 40, geography: 20, sector: 15, capacity: 15, track_record: 10 },
};

export function mergeWeights(
  overrides: Partial<Record<ProfileType, Weights>> | undefined,
): Record<ProfileType, Weights> {
  const out = structuredClone(DEFAULT_WEIGHTS);
  if (!overrides) return out;
  for (const t of Object.keys(out) as ProfileType[]) {
    const o = overrides[t];
    if (!o) continue;
    for (const [k, v] of Object.entries(o))
      if (k in out[t] && typeof v === 'number' && v >= 0 && v <= 100) out[t][k] = v;
  }
  return out;
}
