import type { OpportunityCategory } from '../../../../shared/constants';
import { clean, htmlToText } from '../../../lib/sanitize';
import { FetchError, isPublicHttpUrl, safeFetch } from '../../../lib/url';
import { extractRequirements } from '../extract';
import { parseDate } from '../normalize';
import type { Connector, NormalizedItem } from '../types';

function jobCategory(title: string, type?: string): OpportunityCategory {
  const t = `${title} ${type ?? ''}`.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return 'internship';
  if (/graduate (trainee|programme|program)/.test(t)) return 'graduate_programme';
  if (
    /\bconsultan(t|cy)\b/.test(t) &&
    /individual|national consultant|international consultant|\bic\b/.test(t)
  )
    return 'consultancy';
  if (/\bfellowship\b/.test(t)) return 'fellowship';
  return 'job';
}

const parseJson = (text: string, name: string) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new FetchError(`${name} returned invalid JSON`, undefined, true);
  }
};

/* ============ Remotive (aggregator) ============ */
export function mapRemotive(j: any, allowedLocations: string[]): NormalizedItem | null {
  if (!j?.id || !j?.url) return null;
  const loc = String(j.candidate_required_location ?? '').toLowerCase();
  if (allowedLocations.length && !allowedLocations.some((a) => loc.includes(a.toLowerCase()))) return null;
  const description = htmlToText(j.description);
  const title = clean(j.title, 300);
  const category = jobCategory(title, j.job_type);
  return {
    external_id: String(j.id),
    category,
    title,
    organization: clean(j.company_name, 200) || 'Unknown company',
    description,
    country: null,
    countries: [],
    location: `Remote — ${clean(j.candidate_required_location, 150) || 'location not stated'}`,
    remote: 'remote',
    source_url: j.url,
    application_url: j.url,
    official_url: null,
    reference_no: null,
    published_at: parseDate(j.publication_date),
    deadline_at: null,
    deadline_tz: null,
    deadline_note: 'No deadline published by the source.',
    status_hint: 'open',
    verification: 'aggregator_only',
    meta: {
      employment_type: clean(j.job_type, 40),
      salary: clean(j.salary, 80) || null,
      tags: Array.isArray(j.tags) ? j.tags.slice(0, 15).map((t: unknown) => clean(t, 40)) : [],
      job_category: clean(j.category, 80),
      attribution: 'Listing via Remotive (remotive.com). Apply through the Remotive listing.',
      candidate_required_location: clean(j.candidate_required_location, 150),
    },
    requirements: {
      ...extractRequirements(description, { category }),
      applicant_type: 'individual',
      employment_type: clean(j.job_type, 40),
    },
    requirements_source: 'heuristic',
  };
}

export const remotiveConnector: Connector = {
  type: 'remotive',
  async fetch(_s, config, ctx) {
    const limit = Math.min(200, Math.max(10, Number(config.limit) || 100));
    const qs = new URLSearchParams({ limit: String(limit) });
    if (config.category) qs.set('category', String(config.category));
    const res = await safeFetch(`https://remotive.com/api/remote-jobs?${qs}`, { fetcher: ctx.fetcher });
    const j = parseJson(res.text, 'Remotive');
    if (!Array.isArray(j?.jobs))
      throw new FetchError('Remotive: unexpected response shape', res.status, false);
    const allowed: string[] = Array.isArray(config.locations) ? config.locations : [];
    const items: NormalizedItem[] = [];
    let skipped = 0;
    for (const job of j.jobs) {
      const m = mapRemotive(job, allowed);
      if (m) items.push(m);
      else skipped++;
    }
    return { items, complete: false, skipped };
  },
};

/* ============ Lever postings API (official ATS) ============ */
export function mapLever(p: any, employer: string): NormalizedItem | null {
  if (!p?.id || !p?.hostedUrl) return null;
  const description = [
    p.openingPlain,
    p.descriptionPlain,
    ...(Array.isArray(p.lists) ? p.lists.map((l: any) => `${l.text}\n${htmlToText(l.content)}`) : []),
    p.additionalPlain,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 20000);
  const title = clean(p.text, 300);
  const category = jobCategory(title, p.categories?.commitment);
  const wp = String(p.workplaceType ?? '').toLowerCase();
  const remote =
    wp === 'remote'
      ? 'remote'
      : wp === 'hybrid'
        ? 'hybrid'
        : wp === 'onsite' || wp === 'on-site'
          ? 'onsite'
          : 'unknown';
  return {
    external_id: String(p.id),
    category,
    title,
    organization: employer,
    description: htmlToText(description),
    country: clean(p.country, 80) || null,
    countries: p.country ? [clean(p.country, 80)] : [],
    location: clean(p.categories?.location, 200) || null,
    remote,
    source_url: p.hostedUrl,
    application_url: isPublicHttpUrl(p.applyUrl ?? '') ? p.applyUrl : p.hostedUrl,
    official_url: p.hostedUrl,
    reference_no: null,
    published_at: parseDate(p.createdAt),
    deadline_at: null,
    deadline_tz: null,
    deadline_note: 'Open until filled (no deadline published).',
    status_hint: 'open',
    verification: 'verified_ats',
    meta: {
      employment_type: clean(p.categories?.commitment, 60),
      team: clean(p.categories?.team, 100),
      ats: 'lever',
    },
    requirements: { ...extractRequirements(description, { category }), applicant_type: 'individual' },
    requirements_source: 'heuristic',
  };
}

export const leverConnector: Connector = {
  type: 'lever',
  async fetch(source, config, ctx) {
    const company = String(config.company ?? '').trim();
    if (!/^[a-z0-9-]{2,80}$/i.test(company))
      throw new FetchError('Lever source needs config.company (the jobs.lever.co slug)', undefined, false);
    const res = await safeFetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
      fetcher: ctx.fetcher,
    });
    const j = parseJson(res.text, 'Lever');
    if (!Array.isArray(j)) throw new FetchError('Lever: unexpected response shape', res.status, false);
    const employer = String(config.employer_name ?? source.owner);
    const items = j.map((p: any) => mapLever(p, employer)).filter(Boolean) as NormalizedItem[];
    return { items, complete: true, skipped: j.length - items.length };
  },
};

/* ============ Greenhouse job board API (official ATS) ============ */
export function mapGreenhouse(p: any, employer: string): NormalizedItem | null {
  if (!p?.id || !p?.absolute_url) return null;
  const description = htmlToText(p.content ?? '');
  const title = clean(p.title, 300);
  const category = jobCategory(title);
  const loc = clean(p.location?.name, 200);
  return {
    external_id: String(p.id),
    category,
    title,
    organization: employer,
    description,
    country: null,
    countries: [],
    location: loc || null,
    remote: /remote/i.test(loc) ? 'remote' : 'unknown',
    source_url: p.absolute_url,
    application_url: p.absolute_url,
    official_url: p.absolute_url,
    reference_no: p.requisition_id ? clean(p.requisition_id, 80) : null,
    published_at: parseDate(p.first_published ?? p.updated_at),
    deadline_at: null,
    deadline_tz: null,
    deadline_note: 'Open until filled (no deadline published).',
    status_hint: 'open',
    verification: 'verified_ats',
    meta: { ats: 'greenhouse' },
    requirements: { ...extractRequirements(description, { category }), applicant_type: 'individual' },
    requirements_source: 'heuristic',
  };
}

export const greenhouseConnector: Connector = {
  type: 'greenhouse',
  async fetch(source, config, ctx) {
    const board = String(config.board ?? '').trim();
    if (!/^[a-z0-9-]{2,80}$/i.test(board))
      throw new FetchError('Greenhouse source needs config.board (board token)', undefined, false);
    const res = await safeFetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, {
      fetcher: ctx.fetcher,
    });
    const j = parseJson(res.text, 'Greenhouse');
    if (!Array.isArray(j?.jobs))
      throw new FetchError('Greenhouse: unexpected response shape', res.status, false);
    const employer = String(config.employer_name ?? source.owner);
    const items = j.jobs.map((p: any) => mapGreenhouse(p, employer)).filter(Boolean) as NormalizedItem[];
    return { items, complete: true, skipped: j.jobs.length - items.length };
  },
};

/* ============ ReliefWeb API v2 (requires approved appname) ============ */
export function mapReliefWeb(r: any): NormalizedItem | null {
  const f = r?.fields;
  if (!f?.id || !f?.title) return null;
  const description = htmlToText([f.body, f['how_to_apply']].filter(Boolean).join('\n\n'));
  const title = clean(f.title, 300);
  const type = Array.isArray(f.type) ? f.type.map((t: any) => t.name).join(' ') : '';
  const category = /intern/i.test(type)
    ? 'internship'
    : /consultan/i.test(type)
      ? 'consultancy'
      : jobCategory(title);
  const country = Array.isArray(f.country) && f.country[0]?.name ? clean(f.country[0].name, 80) : null;
  const url = typeof f.url_alias === 'string' ? f.url_alias : `https://reliefweb.int/job/${f.id}`;
  const deadline = f.date?.closing ? parseDate(f.date.closing) : null;
  return {
    external_id: String(f.id),
    category,
    title,
    organization:
      Array.isArray(f.source) && f.source[0]?.name ? clean(f.source[0].name, 200) : 'Unknown organisation',
    description,
    country,
    countries: Array.isArray(f.country) ? f.country.map((c: any) => clean(c.name, 80)) : [],
    location:
      Array.isArray(f.city) && f.city[0]?.name
        ? `${clean(f.city[0].name, 80)}, ${country ?? ''}`.replace(/, $/, '')
        : country,
    remote: 'unknown',
    source_url: url,
    application_url: url,
    official_url: null,
    reference_no: null,
    published_at: parseDate(f.date?.created),
    deadline_at: deadline,
    deadline_tz: deadline ? 'UTC' : null,
    deadline_note: deadline ? 'Closing date as published on ReliefWeb.' : 'No closing date published.',
    status_hint: 'open',
    verification: 'aggregator_only',
    meta: {
      career_categories: Array.isArray(f.career_categories)
        ? f.career_categories.map((c: any) => c.name)
        : [],
      attribution: 'Listing via ReliefWeb (UN OCHA).',
    },
    requirements: { ...extractRequirements(description, { category }), applicant_type: 'individual' },
    requirements_source: 'heuristic',
  };
}

export const reliefWebConnector: Connector = {
  type: 'reliefweb',
  async fetch(_s, config, ctx) {
    const appname = ctx.env.RELIEFWEB_APPNAME;
    if (!appname)
      throw new FetchError(
        'ReliefWeb requires an approved appname (RELIEFWEB_APPNAME is not set)',
        undefined,
        false,
      );
    const country = String(config.country ?? 'Uganda');
    const limit = Math.min(100, Math.max(5, Number(config.limit) || 50));
    const res = await safeFetch(`https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appname)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit,
        profile: 'full',
        filter: { field: 'country.name', value: country },
        sort: ['date.created:desc'],
      }),
      fetcher: ctx.fetcher,
    });
    const j = parseJson(res.text, 'ReliefWeb');
    if (!Array.isArray(j?.data))
      throw new FetchError('ReliefWeb: unexpected response shape', res.status, false);
    const items = j.data.map(mapReliefWeb).filter(Boolean) as NormalizedItem[];
    return { items, complete: false, skipped: j.data.length - items.length };
  },
};
