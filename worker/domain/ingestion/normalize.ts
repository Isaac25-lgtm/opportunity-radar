import { sha256Hex } from '../../lib/crypto';
import { normalizeUrl } from '../../lib/url';
import { norm } from '../matching/common';
import type { NormalizedItem } from './types';

/** IANA zones and UTC offsets (hours) for countries we commonly ingest. */
export const COUNTRY_TZ: Record<string, { tz: string; offset: number }> = {
  uganda: { tz: 'Africa/Kampala', offset: 3 },
  kenya: { tz: 'Africa/Nairobi', offset: 3 },
  tanzania: { tz: 'Africa/Dar_es_Salaam', offset: 3 },
  'south sudan': { tz: 'Africa/Juba', offset: 2 },
  rwanda: { tz: 'Africa/Kigali', offset: 2 },
  burundi: { tz: 'Africa/Bujumbura', offset: 2 },
  ethiopia: { tz: 'Africa/Addis_Ababa', offset: 3 },
  somalia: { tz: 'Africa/Mogadishu', offset: 3 },
};

/**
 * Convert a local wall-clock date/time in a known country to a UTC ISO string.
 * Returns the date at 23:59 local when no time is published.
 */
export function localToUtc(
  dateYmd: string,
  time: string | null | undefined,
  country: string | null,
): { iso: string; tz: string | null; note: string | null } | null {
  const m = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = (time ?? '').match(/^(\d{1,2}):(\d{2})/);
  const hh = t ? Number(t[1]) : 23;
  const mm = t ? Number(t[2]) : 59;
  const zone = country ? COUNTRY_TZ[norm(country)] : undefined;
  const offset = zone?.offset ?? 0;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh - offset, mm);
  if (!Number.isFinite(utc)) return null;
  return {
    iso: new Date(utc).toISOString(),
    tz: zone?.tz ?? (country ? null : 'UTC'),
    note: t ? null : 'No closing time published; shown as end of day.',
  };
}

/** Parse common published date formats to ISO (UTC). Returns null when unparseable. */
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // MM/DD/YYYY (grants.gov)
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 23, 59)).toISOString();
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/); // 04-Nov-2026 (World Bank)
  if (m) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
      m[2].toLowerCase(),
    );
    if (mon >= 0) return new Date(Date.UTC(Number(m[3]), mon, Number(m[1]))).toISOString();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return d.toISOString();
}

const hashShort = async (s: string) => (await sha256Hex(s)).slice(0, 32);

/**
 * Canonical identity. Preference: (organisation + reference number) → official/application URL →
 * signature of organisation, title, location and deadline date. Titles alone never define identity.
 */
export async function canonicalKey(i: NormalizedItem): Promise<string> {
  if (i.reference_no && i.organization)
    return `ref:${await hashShort(`${norm(i.organization)}|${norm(i.reference_no)}`)}`;
  const url = normalizeUrl(i.official_url) ?? normalizeUrl(i.application_url) ?? normalizeUrl(i.source_url);
  if (url) return `url:${await hashShort(url)}`;
  return `sig:${await hashShort([norm(i.organization), norm(i.title), norm(i.location ?? i.country ?? ''), (i.deadline_at ?? '').slice(0, 10)].join('|'))}`;
}

export async function contentHash(i: NormalizedItem): Promise<string> {
  return hashShort(
    JSON.stringify([
      i.title,
      i.organization,
      i.deadline_at,
      i.application_url,
      i.official_url,
      i.status_hint,
      i.description.slice(0, 5000),
      i.reference_no,
    ]),
  );
}

/** Basic validation: drop records that cannot be shown honestly. */
export function validItem(i: NormalizedItem): string | null {
  if (!i.external_id) return 'missing external id';
  if (!i.title || i.title.length < 3) return 'missing title';
  if (!i.organization) return 'missing organisation';
  if (!i.source_url || !/^https?:\/\//.test(i.source_url)) return 'missing source url';
  return null;
}

export const VERIFICATION_RANK: Record<string, number> = {
  verified_official: 5,
  admin_verified: 4,
  verified_ats: 3,
  aggregator_only: 2,
  unverified: 1,
};
