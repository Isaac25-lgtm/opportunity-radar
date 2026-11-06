import type { DisplayState } from '../../shared/constants';
import { parseJson } from '../lib/util';

export function displayState(
  o: { status: string; verification: string; last_checked_at: string },
  automation: string | null,
  staleHours: number,
  now = new Date(),
): DisplayState {
  if (o.status === 'closed' || o.status === 'expired' || o.status === 'cancelled') return o.status;
  if (o.status === 'status_uncertain') return 'status_uncertain';
  const ageH = (now.getTime() - Date.parse(o.last_checked_at)) / 3600_000;
  const limit = automation === 'curated' ? 24 * 45 : staleHours;
  if (ageH > limit) return 'stale';
  return o.verification as DisplayState;
}

export const OPP_LIST_COLUMNS = `o.id, o.category, o.title, o.organization, o.summary, o.country, o.countries, o.location, o.remote, o.source_id,
  o.source_url, o.application_url, o.official_url, o.reference_no, o.published_at, o.deadline_at, o.deadline_tz, o.deadline_note, o.status,
  o.verification, o.verified_at, o.first_seen_at, o.last_seen_at, o.last_checked_at, o.is_demo, o.meta, o.requirements, o.requirements_source,
  o.description, s.name AS source_name, s.automation AS source_automation, s.source_type AS source_type, s.terms_url AS source_terms_url`;

export function publicOpportunity(r: any, staleHours: number, opts: { full?: boolean } = {}) {
  const meta = parseJson<Record<string, unknown>>(r.meta, {});
  const out: Record<string, unknown> = {
    id: r.id,
    category: r.category,
    title: r.title,
    organization: r.organization,
    summary: r.summary,
    country: r.country,
    location: r.location,
    remote: r.remote,
    source: {
      id: r.source_id,
      name: r.source_name ?? 'Unknown source',
      type: r.source_type ?? null,
      automation: r.source_automation ?? null,
      terms_url: r.source_terms_url ?? null,
    },
    source_url: r.source_url,
    application_url: r.application_url,
    official_url: r.official_url,
    reference_no: r.reference_no,
    published_at: r.published_at,
    deadline_at: r.deadline_at,
    deadline_tz: r.deadline_tz,
    deadline_note: r.deadline_note,
    status: r.status,
    verification: r.verification,
    verified_at: r.verified_at,
    display_state: displayState(r, r.source_automation ?? null, staleHours),
    first_seen_at: r.first_seen_at,
    last_checked_at: r.last_checked_at,
    is_demo: !!r.is_demo,
    attribution: typeof meta.attribution === 'string' ? meta.attribution : null,
  };
  if (opts.full) {
    out.description = r.description;
    out.meta = meta;
    out.requirements = parseJson(r.requirements, {});
    out.requirements_source = r.requirements_source;
  }
  return out;
}
