import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractRequirements } from '../../worker/domain/ingestion/extract';
import { mapGrantsGov, mapWorldBankNotice } from '../../worker/domain/ingestion/connectors/official';
import {
  mapLever,
  mapRemotive,
  mapGreenhouse,
  mapReliefWeb,
} from '../../worker/domain/ingestion/connectors/jobs';
import { parseFeed, rssConnector } from '../../worker/domain/ingestion/connectors/generic';
import {
  canonicalKey,
  contentHash,
  localToUtc,
  parseDate,
  validItem,
} from '../../worker/domain/ingestion/normalize';

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/${n}`, 'utf8'));

describe('World Bank connector mapping (real fixture)', () => {
  const notices = fx('worldbank-uganda.json').procnotices as any[];
  const items = notices.map(mapWorldBankNotice).filter(Boolean) as any[];
  it('maps every open notice with provenance and official verification', () => {
    expect(items.length).toBeGreaterThan(10);
    for (const i of items) {
      expect(validItem(i)).toBeNull();
      expect(i.verification).toBe('verified_official');
      expect(i.official_url).toMatch(
        /^https:\/\/projects\.worldbank\.org\/en\/projects-operations\/procurement-detail\/OP/,
      );
      expect(i.description).not.toMatch(/<[a-z]+[\s>]/i);
      expect(['tender', 'eoi', 'rfq', 'rfp', 'consultancy']).toContain(i.category);
    }
  });
  it('separates individual consultancies from firm procurement', () => {
    for (const i of items) {
      if (i.category === 'consultancy') expect(i.requirements.applicant_type).toBe('individual');
      else expect(i.requirements.applicant_type).toBe('business');
    }
  });
  it('converts local deadlines to UTC with the country timezone', () => {
    const i = items.find((x) => x.deadline_at && x.country === 'Uganda');
    expect(i.deadline_tz).toBe('Africa/Kampala');
    const n = mapWorldBankNotice({
      ...notices[0],
      notice_type: 'Invitation for Bids',
      project_ctry_name: 'Uganda',
      submission_deadline_date: '2026-11-20T00:00:00Z',
      submission_deadline_time: '14:00',
    })!;
    expect(n.deadline_at).toBe('2026-11-20T11:00:00.000Z');
  });
  it('skips contract awards and general notices', () => {
    expect(mapWorldBankNotice({ ...notices[0], notice_type: 'Contract Award' })).toBeNull();
    expect(mapWorldBankNotice({ ...notices[0], notice_type: 'General Procurement Notice' })).toBeNull();
  });
});

describe('other connectors (real fixtures)', () => {
  it('Grants.gov maps to official research grants without assuming eligibility', () => {
    const h = fx('grantsgov.json').data.oppHits;
    const i = mapGrantsGov(h[0])!;
    expect(i.verification).toBe('verified_official');
    expect(i.official_url).toBe(`https://www.grants.gov/search-results-detail/${h[0].id}`);
    expect(i.requirements_source).toBe('none');
    expect(i.deadline_at).toMatch(/^2027-02-14/);
  });
  it('Remotive listings are aggregator-only with attribution and location filtering', () => {
    const jobs = fx('remotive.json').jobs;
    const kept = jobs.map((j: any) => mapRemotive(j, ['worldwide'])).filter(Boolean);
    const dropped = jobs.map((j: any) => mapRemotive(j, ['uganda'])).filter(Boolean);
    expect(kept.length).toBeGreaterThan(0);
    expect(dropped.length).toBeLessThan(kept.length);
    expect(kept[0].verification).toBe('aggregator_only');
    expect(kept[0].official_url).toBeNull();
    expect(kept[0].meta.attribution).toMatch(/Remotive/);
  });
  it('Lever postings are verified ATS listings', () => {
    const p = fx('lever.json');
    const i = mapLever(p[0], 'Palantir')!;
    expect(i.verification).toBe('verified_ats');
    expect(i.official_url).toMatch(/^https:\/\/jobs\.lever\.co\//);
    expect(i.organization).toBe('Palantir');
  });
  it('Greenhouse and ReliefWeb mappers handle minimal records', () => {
    expect(
      mapGreenhouse(
        {
          id: 1,
          title: 'Engineer',
          absolute_url: 'https://boards.greenhouse.io/x/jobs/1',
          content: '&lt;p&gt;Hi&lt;/p&gt;',
          location: { name: 'Remote' },
        },
        'X',
      )!.description,
    ).toBe('Hi');
    const rw = mapReliefWeb({
      fields: {
        id: 9,
        title: 'M&E Officer',
        source: [{ name: 'NGO' }],
        country: [{ name: 'Uganda' }],
        date: { closing: '2026-12-01T00:00:00+00:00' },
        url_alias: 'https://reliefweb.int/job/9',
      },
    })!;
    expect(rw.verification).toBe('aggregator_only');
    expect(rw.deadline_at).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('RSS / Atom parsing', () => {
  it('parses RSS items and strips unsafe HTML', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>Scholarship &amp; Grant</title><link>https://example.org/a</link><guid>a1</guid>
      <description><![CDATA[<p>Open to <b>Ugandan nationals</b><script>alert(1)</script></p>]]></description><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const e = parseFeed(xml);
    expect(e).toHaveLength(1);
    expect(e[0].title).toBe('Scholarship & Grant');
    expect(e[0].description).toBe('Open to Ugandan nationals');
    expect(e[0].published).toBe('2026-11-02T10:00:00.000Z');
  });
  it('parses Atom entries', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>x</id><title>Fellowship</title><link rel="alternate" href="https://ex.org/f"/><summary>Text</summary><updated>2026-11-01T00:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml)[0]).toMatchObject({ id: 'x', title: 'Fellowship', link: 'https://ex.org/f' });
  });
  it('refuses feeds that declare entities (XXE / billion laughs)', () => {
    expect(() => parseFeed('<!DOCTYPE x [<!ENTITY a "b">]><rss></rss>')).toThrow();
  });
  it('the RSS connector refuses non-public URLs (SSRF)', async () => {
    const src: any = { owner: 'X', source_type: 'official' };
    await expect(
      rssConnector.fetch(src, { url: 'http://169.254.169.254/latest' }, { env: {} as any, now: new Date() }),
    ).rejects.toThrow(/public https/);
    await expect(
      rssConnector.fetch(src, { url: 'https://localhost/feed' }, { env: {} as any, now: new Date() }),
    ).rejects.toThrow();
  });
});

describe('requirement extraction', () => {
  it('extracts experience, education, nationality, languages and skills from explicit wording', () => {
    const r = extractRequirements(
      "Applicants must hold a Bachelor's degree in Statistics; a Master's is an advantage. At least 5 years of relevant experience. Open to Ugandan nationals only. Fluency in English is required. Knowledge of Stata and DHIS2.",
    );
    expect(r.min_experience_years).toBe(5);
    expect(r.education_level).toBe('bachelor');
    expect(r.eligible_countries).toEqual(['Uganda']);
    expect(r.languages).toEqual(['English']);
    expect(r.skills).toEqual(expect.arrayContaining(['stata', 'dhis2']));
  });
  it('extracts procurement requirements', () => {
    const r = extractRequirements(
      'Bidders must submit a certificate of incorporation, a valid tax clearance certificate, a trading licence and proof of registration with the PPDA register of providers. Average annual turnover of UGX 500 million. At least two (2) similar contracts. ISO 9001:2015 certification. Bid security required.',
    );
    expect(r.registration_required).toBe(true);
    expect(r.tax_clearance_required).toBe(true);
    expect(r.licenses).toContain('Trading licence');
    expect(r.certifications).toEqual(expect.arrayContaining(['PPDA register of providers', 'ISO 9001']));
    expect(r.min_turnover_ugx).toBe(500_000_000);
    expect(r.min_past_contracts).toBe(2);
    expect(r.applicant_type).toBe('business');
    expect(r.required_documents).toContain('Bid security / bid-securing declaration');
  });
  it('extracts scholarship facts', () => {
    const r = extractRequirements(
      "Fully funded Master's and PhD scholarships. Minimum CGPA of 3.5 out of 5.",
      { category: 'scholarship' },
    );
    expect(r.degree_levels).toEqual(['master', 'phd']);
    expect(r.funding).toBe('full');
    expect(r.min_gpa).toBe(3.5);
    expect(r.gpa_scale).toBe(5);
  });
  it('records nothing when there is no explicit wording', () => {
    expect(extractRequirements('A wonderful opportunity to grow.')).toEqual({});
  });
});

describe('normalisation and identity', () => {
  const base: any = {
    external_id: '1',
    category: 'job',
    title: 'Analyst',
    organization: 'Org',
    description: 'd',
    country: 'Uganda',
    countries: [],
    location: 'Kampala',
    remote: 'onsite',
    source_url: 'https://a.org/jobs/1?utm_source=x',
    application_url: null,
    official_url: null,
    reference_no: null,
    published_at: null,
    deadline_at: null,
    deadline_tz: null,
    deadline_note: null,
    status_hint: 'open',
    verification: 'unverified',
    meta: {},
    requirements: {},
    requirements_source: 'none',
  };
  it('canonical key prefers organisation + reference, then URL (tracking params removed)', async () => {
    expect(await canonicalKey({ ...base, reference_no: 'REF-1' })).toMatch(/^ref:/);
    const a = await canonicalKey(base);
    const b = await canonicalKey({ ...base, source_url: 'https://www.a.org/jobs/1' });
    expect(a).toBe(b);
    expect(a).toMatch(/^url:/);
  });
  it('different reference numbers are different opportunities even with identical titles', async () => {
    expect(await canonicalKey({ ...base, reference_no: 'A' })).not.toBe(
      await canonicalKey({ ...base, reference_no: 'B' }),
    );
  });
  it('content hash changes when the deadline changes', async () => {
    expect(await contentHash(base)).not.toBe(
      await contentHash({ ...base, deadline_at: '2026-12-01T00:00:00.000Z' }),
    );
  });
  it('parses published date formats', () => {
    expect(parseDate('04-Nov-2026')).toBe('2026-11-04T00:00:00.000Z');
    expect(parseDate('02/14/2027')).toBe('2027-02-14T23:59:00.000Z');
    expect(parseDate(1786469891368)).toMatch(/^2026-/);
    expect(parseDate('not a date')).toBeNull();
    expect(localToUtc('2026-11-20', null, 'Rwanda')).toMatchObject({
      iso: '2026-11-20T21:59:00.000Z',
      tz: 'Africa/Kigali',
    });
  });
});
