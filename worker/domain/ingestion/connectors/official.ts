import type { OpportunityCategory } from '../../../../shared/constants';
import { htmlToText, clean } from '../../../lib/sanitize';
import { FetchError, safeFetch } from '../../../lib/url';
import { extractRequirements } from '../extract';
import { localToUtc, parseDate } from '../normalize';
import type { Connector, NormalizedItem } from '../types';

/* ============ World Bank procurement notices ============ */
const WB_TYPES = [
  'Invitation for Bids',
  'Request for Expression of Interest',
  'Invitation for Prequalification',
  'Request for Proposals',
];
const WB_GROUP: Record<string, 'goods' | 'works' | 'consultancy' | 'services'> = {
  GO: 'goods',
  CW: 'works',
  CS: 'consultancy',
  NC: 'services',
};

export function mapWorldBankNotice(n: any): NormalizedItem | null {
  const type = String(n.notice_type ?? '');
  if (!WB_TYPES.includes(type)) return null;
  if (n.notice_status && String(n.notice_status).toLowerCase() !== 'published') return null;
  const method = String(n.procurement_method_code ?? '').toUpperCase();
  const methodName = String(n.procurement_method_name ?? '');
  let category: OpportunityCategory = 'tender';
  const individual = method === 'INDV' || /individual/i.test(methodName);
  if (individual) category = 'consultancy';
  else if (type === 'Request for Expression of Interest') category = 'eoi';
  else if (method === 'RFQ') category = 'rfq';
  else if (type === 'Request for Proposals' || method === 'RFP') category = 'rfp';
  const country = clean(n.project_ctry_name, 80) || null;
  const description = htmlToText(n.notice_text ?? '');
  const extracted = extractRequirements(description, { category });
  const group = WB_GROUP[String(n.procurement_group ?? '')];
  const deadline = n.submission_deadline_date
    ? localToUtc(String(n.submission_deadline_date).slice(0, 10), n.submission_deadline_time, country)
    : null;
  const url = `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(n.id)}`;
  const org =
    clean(n.contact_organization, 200) ||
    (country ? `${country} — ${clean(n.project_name, 150)}` : clean(n.project_name, 200));
  return {
    external_id: String(n.id),
    category,
    title: clean(n.bid_description, 300) || clean(n.project_name, 300),
    organization: org || 'World Bank-financed project',
    description,
    country,
    countries: country ? [country] : [],
    location: country,
    remote: 'onsite',
    source_url: url,
    application_url: url,
    official_url: url,
    reference_no: clean(n.bid_reference_no, 120) || null,
    published_at: parseDate(n.noticedate) ?? parseDate(n.submission_date),
    deadline_at: deadline?.iso ?? null,
    deadline_tz: deadline?.tz ?? null,
    deadline_note: deadline ? (deadline.note ?? 'Local time at the procuring entity, as published.') : null,
    status_hint: /cancel/i.test(type) ? 'cancelled' : 'open',
    verification: 'verified_official',
    meta: {
      notice_type: type,
      procurement_method: methodName,
      procurement_group: group ?? null,
      project_id: n.project_id ?? null,
      project_name: clean(n.project_name, 300),
      buyer: org,
      language: n.notice_lang_name ?? null,
      buyer_website:
        typeof n.contact_web_url === 'string' && /^https?:\/\//.test(n.contact_web_url)
          ? n.contact_web_url
          : null,
      submission_method: 'See official notice',
    },
    requirements: {
      ...extracted,
      applicant_type: individual ? 'individual' : 'business',
      procurement_categories: group ? [group] : [],
      places: country ? [country] : [],
    },
    requirements_source: 'heuristic',
  };
}

export const worldBankConnector: Connector = {
  type: 'worldbank',
  async fetch(_source, config, ctx) {
    const countries: string[] =
      Array.isArray(config.countries) && config.countries.length ? config.countries : ['Uganda'];
    const rows = Math.min(100, Math.max(5, Number(config.rows) || 50));
    const items: NormalizedItem[] = [];
    let skipped = 0;
    for (const country of countries.slice(0, 10)) {
      const qs = new URLSearchParams({
        format: 'json',
        rows: String(rows),
        project_ctry_name_exact: country,
        notice_type_exact: WB_TYPES.join('^'),
        srt: 'submission_date',
        order: 'desc',
      });
      const res = await safeFetch(`https://search.worldbank.org/api/v2/procnotices?${qs}`, {
        fetcher: ctx.fetcher,
        timeoutMs: 25000,
      });
      let j: any;
      try {
        j = JSON.parse(res.text);
      } catch {
        throw new FetchError('World Bank API returned invalid JSON', res.status, true);
      }
      if (!Array.isArray(j?.procnotices))
        throw new FetchError('World Bank API: unexpected response shape', res.status, false);
      for (const n of j.procnotices) {
        const item = mapWorldBankNotice(n);
        if (item) items.push(item);
        else skipped++;
      }
    }
    return { items, complete: false, skipped };
  },
};

/* ============ Grants.gov ============ */
export function mapGrantsGov(h: any): NormalizedItem | null {
  if (!h?.id || !h?.title) return null;
  const url = `https://www.grants.gov/search-results-detail/${encodeURIComponent(h.id)}`;
  const status = String(h.oppStatus ?? '').toLowerCase();
  return {
    external_id: String(h.id),
    category: 'research_grant',
    title: clean(h.title, 300),
    organization: clean(h.agency, 200) || clean(h.agencyCode, 100) || 'U.S. federal agency',
    description: `Federal funding opportunity ${clean(h.number, 60)} published on Grants.gov by ${clean(h.agency, 200)}. Applicant eligibility, award amounts and full requirements are listed on the official opportunity page.`,
    country: 'United States',
    countries: [],
    location: 'Grants.gov (U.S. federal funding)',
    remote: 'unknown',
    source_url: url,
    application_url: url,
    official_url: url,
    reference_no: clean(h.number, 120) || null,
    published_at: parseDate(h.openDate),
    deadline_at: parseDate(h.closeDate),
    deadline_tz: h.closeDate ? 'America/New_York' : null,
    deadline_note: h.closeDate
      ? 'Grants.gov closing date; check the notice for the exact time.'
      : 'No closing date published.',
    status_hint: status === 'closed' || status === 'archived' ? 'closed' : 'open',
    verification: 'verified_official',
    meta: {
      agency_code: h.agencyCode ?? null,
      doc_type: h.docType ?? null,
      cfda: h.cfdaList ?? [],
      opp_status: status,
    },
    requirements: {
      applicant_type: 'either',
      notes: [
        'Applicant eligibility is defined in the official notice and is often limited to specific organisation types.',
      ],
    },
    requirements_source: 'none',
  };
}

export const grantsGovConnector: Connector = {
  type: 'grantsgov',
  async fetch(_source, config, ctx) {
    const keywords: string[] =
      Array.isArray(config.keywords) && config.keywords.length ? config.keywords : ['Uganda'];
    const rows = Math.min(50, Math.max(5, Number(config.rows) || 25));
    const items: NormalizedItem[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    for (const keyword of keywords.slice(0, 5)) {
      const res = await safeFetch('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, keyword, oppStatuses: 'forecasted|posted' }),
        fetcher: ctx.fetcher,
      });
      let j: any;
      try {
        j = JSON.parse(res.text);
      } catch {
        throw new FetchError('Grants.gov returned invalid JSON', res.status, true);
      }
      if (j?.errorcode !== 0 || !Array.isArray(j?.data?.oppHits))
        throw new FetchError(
          `Grants.gov error: ${String(j?.msg ?? 'unexpected response').slice(0, 100)}`,
          res.status,
          true,
        );
      for (const h of j.data.oppHits) {
        if (seen.has(String(h.id))) continue;
        seen.add(String(h.id));
        const item = mapGrantsGov(h);
        if (item) items.push(item);
        else skipped++;
      }
    }
    return { items, complete: false, skipped };
  },
};
