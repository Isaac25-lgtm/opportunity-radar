import {
  OPPORTUNITY_CATEGORIES,
  type OpportunityCategory,
  type VerificationState,
} from '../../../../shared/constants';
import { clean, decodeEntities, htmlToText } from '../../../lib/sanitize';
import { FetchError, isPublicHttpUrl, safeFetch } from '../../../lib/url';
import { sha256Hex } from '../../../lib/crypto';
import { extractRequirements } from '../extract';
import { parseDate } from '../normalize';
import type { Connector, NormalizedItem, SourceRow } from '../types';

const VERIFICATION_FOR: Record<SourceRow['source_type'], VerificationState> = {
  official: 'verified_official',
  ats: 'verified_ats',
  aggregator: 'aggregator_only',
  partner: 'unverified',
  curated: 'unverified',
};

/* ============ Minimal, safe RSS 2.0 / Atom parser (no entity expansion, no DTDs) ============ */
export type FeedEntry = {
  id: string;
  title: string;
  link: string;
  description: string;
  published: string | null;
  categories: string[];
};

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

export function parseFeed(xml: string): FeedEntry[] {
  if (/<!ENTITY/i.test(xml)) throw new FetchError('Feed declares XML entities; refused', undefined, false);
  const out: FeedEntry[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks.slice(0, 300)) {
    let link = '';
    if (isAtom) {
      const alt =
        b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
        b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : '';
    } else link = decodeEntities(tag(b, 'link'));
    const title = htmlToText(tag(b, 'title'), 300);
    const description = htmlToText(
      isAtom ? tag(b, 'content') || tag(b, 'summary') : tag(b, 'content:encoded') || tag(b, 'description'),
    );
    const id = decodeEntities(tag(b, isAtom ? 'id' : 'guid')) || link;
    const published = parseDate(
      tag(b, isAtom ? 'published' : 'pubDate') || tag(b, 'updated') || tag(b, 'dc:date'),
    );
    const categories = [
      ...b.matchAll(
        /<category[^>]*?(?:term=["']([^"']+)["'][^>]*)?>([\s\S]*?)<\/category>|<category[^>]*term=["']([^"']+)["'][^>]*\/>/gi,
      ),
    ]
      .map((m) => clean(m[1] || m[2] || m[3], 60))
      .filter(Boolean);
    if (title && link) out.push({ id, title, link, description, published, categories });
  }
  return out;
}

function asCategory(v: unknown, fallback: OpportunityCategory): OpportunityCategory {
  return typeof v === 'string' && (OPPORTUNITY_CATEGORIES as readonly string[]).includes(v)
    ? (v as OpportunityCategory)
    : fallback;
}

export const rssConnector: Connector = {
  type: 'rss',
  async fetch(source, config, ctx) {
    const url = String(config.url ?? '');
    if (!isPublicHttpUrl(url))
      throw new FetchError('RSS source needs a public https config.url', undefined, false);
    const res = await safeFetch(url, { fetcher: ctx.fetcher, maxBytes: 3_000_000 });
    const entries = parseFeed(res.text);
    const category = asCategory(config.category, 'other');
    const items: NormalizedItem[] = [];
    let skipped = 0;
    for (const e of entries) {
      if (!isPublicHttpUrl(e.link, { allowHttp: true })) {
        skipped++;
        continue;
      }
      items.push({
        external_id: e.id.slice(0, 300) || (await sha256Hex(e.link)).slice(0, 32),
        category,
        title: e.title,
        organization: String(config.organization ?? source.owner),
        description: e.description,
        country: config.country ? String(config.country) : null,
        countries: config.country ? [String(config.country)] : [],
        location: config.country ? String(config.country) : null,
        remote: 'unknown',
        source_url: e.link,
        application_url: e.link,
        official_url: source.source_type === 'official' ? e.link : null,
        reference_no: null,
        published_at: e.published,
        deadline_at: null,
        deadline_tz: null,
        deadline_note: 'Deadline not provided in the feed; check the source page.',
        status_hint: 'open',
        verification: VERIFICATION_FOR[source.source_type],
        meta: { feed_categories: e.categories },
        requirements: extractRequirements(e.description, { category }),
        requirements_source: 'heuristic',
      });
    }
    return { items, complete: false, skipped };
  },
};

/* ============ Generic documented JSON API with a field mapping ============ */
function pick(obj: any, path: string | undefined): any {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export const jsonConnector: Connector = {
  type: 'json',
  async fetch(source, config, ctx) {
    const url = String(config.url ?? '');
    if (!isPublicHttpUrl(url))
      throw new FetchError('JSON source needs a public https config.url', undefined, false);
    const map = (config.mapping ?? {}) as Record<string, string>;
    if (!map.id || !map.title || !map.url)
      throw new FetchError('JSON source mapping must define id, title and url', undefined, false);
    const res = await safeFetch(url, { fetcher: ctx.fetcher });
    let j: any;
    try {
      j = JSON.parse(res.text);
    } catch {
      throw new FetchError('JSON source returned invalid JSON', res.status, true);
    }
    const list = config.items_path ? pick(j, String(config.items_path)) : j;
    if (!Array.isArray(list))
      throw new FetchError('JSON source: items_path did not resolve to an array', res.status, false);
    const category = asCategory(config.category, 'other');
    const items: NormalizedItem[] = [];
    let skipped = 0;
    for (const r of list.slice(0, 500)) {
      const link = String(pick(r, map.url) ?? '');
      const title = clean(pick(r, map.title), 300);
      if (!title || !isPublicHttpUrl(link, { allowHttp: true })) {
        skipped++;
        continue;
      }
      const description = htmlToText(String(pick(r, map.description) ?? ''));
      items.push({
        external_id: String(pick(r, map.id)),
        category: asCategory(pick(r, map.category), category),
        title,
        organization: clean(pick(r, map.organization), 200) || source.owner,
        description,
        country: clean(pick(r, map.country), 80) || null,
        countries: [],
        location: clean(pick(r, map.location), 200) || null,
        remote: 'unknown',
        source_url: link,
        application_url: link,
        official_url: source.source_type === 'official' ? link : null,
        reference_no: clean(pick(r, map.reference), 120) || null,
        published_at: parseDate(pick(r, map.published)),
        deadline_at: parseDate(pick(r, map.deadline)),
        deadline_tz: pick(r, map.deadline) ? 'UTC' : null,
        deadline_note: null,
        status_hint: 'open',
        verification: VERIFICATION_FOR[source.source_type],
        meta: {},
        requirements: extractRequirements(description, { category }),
        requirements_source: 'heuristic',
      });
    }
    return { items, complete: Boolean(config.complete), skipped };
  },
};

/** Curated sources are populated by administrators; scheduled runs only refresh their health. */
export const manualConnector: Connector = {
  type: 'manual',
  async fetch() {
    return { items: [], complete: false, skipped: 0 };
  },
};
