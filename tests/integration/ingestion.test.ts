import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  drainTasks,
  startRun,
  maybeStartScheduledRun,
  expireOpportunities,
} from '../../worker/domain/ingestion/pipeline';
import { createEnv, json, mockFetch, type TestEnv } from './helpers';

const wb = JSON.parse(readFileSync('tests/fixtures/worldbank-uganda.json', 'utf8'));
const grants = JSON.parse(readFileSync('tests/fixtures/grantsgov.json', 'utf8'));
const remotive = JSON.parse(readFileSync('tests/fixtures/remotive.json', 'utf8'));
const NOW = new Date('2026-11-06T12:00:00Z');

/** One open World Bank notice per country so counts are predictable. */
function wbNotice(id: string, over: Record<string, unknown> = {}) {
  return {
    ...wb.procnotices[0],
    id,
    notice_type: 'Invitation for Bids',
    notice_status: 'Published',
    procurement_method_code: 'RFB',
    procurement_group: 'GO',
    project_ctry_name: 'Uganda',
    bid_reference_no: `REF-${id}`,
    bid_description: `Supply of equipment ${id}`,
    contact_organization: 'Ministry of Health',
    submission_deadline_date: '2026-12-01T00:00:00Z',
    submission_deadline_time: '10:00',
    notice_text: '<p>Bidders must submit a valid tax clearance certificate.</p>',
    ...over,
  };
}

let env: TestEnv;
let wbNotices: any[] = [];
let grantsFail = false;
const fetcher = mockFetch([
  [
    /search\.worldbank\.org/,
    (req) =>
      new URL(req.url).searchParams.get('project_ctry_name_exact') === 'Uganda'
        ? json({ procnotices: wbNotices })
        : json({ procnotices: [] }),
  ],
  [/api\.grants\.gov/, () => (grantsFail ? new Response('down', { status: 503 }) : json(grants))],
  [/remotive\.com/, () => json(remotive)],
]);

async function runAll(now = NOW) {
  const r = await startRun(env, 'test', { now });
  for (let i = 0; i < 6; i++)
    await drainTasks(env, { max: 5, now: new Date(now.getTime() + i * 3600_000), fetcher });
  return r;
}
const count = async (sql: string, ...b: unknown[]) =>
  (await env.DB.prepare(sql)
    .bind(...b)
    .first<{ n: number }>())!.n;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.__dispose());

describe('ingestion pipeline', () => {
  it('ingests a valid fixture from each connector with provenance', async () => {
    wbNotices = [
      wbNotice('OP1'),
      wbNotice('OP2'),
      wbNotice('OPOLD', { submission_deadline_date: '2026-01-01T00:00:00Z' }),
    ];
    const r = await runAll();
    expect(r.started).toBe(true);
    const run = await env.DB.prepare('SELECT * FROM ingestion_runs WHERE id = ?').bind(r.runId).first<any>();
    expect(run.status).toBe('completed');
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunities WHERE verification = 'verified_official' AND category = 'tender'",
      ),
    ).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM opportunities WHERE reference_no = 'REF-OPOLD'")).toBe(0); // already expired → not stored
    expect(await count("SELECT COUNT(*) n FROM opportunities WHERE category = 'research_grant'")).toBe(
      grants.data.oppHits.length,
    );
    expect(
      await count("SELECT COUNT(*) n FROM opportunities WHERE verification = 'aggregator_only'"),
    ).toBeGreaterThan(0);
    expect(await count('SELECT COUNT(*) n FROM source_records')).toBe(
      await count('SELECT COUNT(*) n FROM opportunities'),
    );
    const o = await env.DB.prepare("SELECT * FROM opportunities WHERE reference_no = 'REF-OP1'").first<any>();
    expect(o.source_url).toContain('procurement-detail/OP1');
    expect(o.deadline_at).toBe('2026-12-01T07:00:00.000Z');
    expect(o.deadline_tz).toBe('Africa/Kampala');
    expect(JSON.parse(o.requirements).tax_clearance_required).toBe(true);
  });

  it('a repeated run creates no duplicates and no spurious updates', async () => {
    const before = await count('SELECT COUNT(*) n FROM opportunities');
    const events = await count('SELECT COUNT(*) n FROM opportunity_events');
    await runAll(new Date(NOW.getTime() + 7 * 3600_000));
    expect(await count('SELECT COUNT(*) n FROM opportunities')).toBe(before);
    expect(await count('SELECT COUNT(*) n FROM opportunity_events')).toBe(events);
    const run = await env.DB.prepare(
      'SELECT * FROM ingestion_runs ORDER BY started_at DESC LIMIT 1',
    ).first<any>();
    expect(run.items_new).toBe(0);
    expect(run.items_updated).toBe(0);
  });

  it('records a deadline change as an event without duplicating the opportunity', async () => {
    wbNotices = [wbNotice('OP1', { submission_deadline_date: '2026-12-15T00:00:00Z' }), wbNotice('OP2')];
    await runAll(new Date(NOW.getTime() + 14 * 3600_000));
    const o = await env.DB.prepare(
      "SELECT id, deadline_at FROM opportunities WHERE reference_no = 'REF-OP1'",
    ).first<any>();
    expect(o.deadline_at).toBe('2026-12-15T07:00:00.000Z');
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunity_events WHERE opportunity_id = ? AND kind = 'deadline_changed'",
        o.id,
      ),
    ).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM opportunities WHERE reference_no = 'REF-OP1'")).toBe(1);
  });

  it('a duplicate listing from a second source is merged, keeping the higher-trust verification', async () => {
    // Same notice arriving through an RSS aggregator with identical org/title/country/deadline.
    const { upsertItems } = await import('../../worker/domain/ingestion/pipeline');
    await env.DB.prepare(
      "INSERT INTO sources (id, slug, name, owner, website, source_type, connector, access_method, automation, enabled, verification_policy, created_at, updated_at) VALUES ('src_agg','agg','Agg','Agg','https://agg.example','aggregator','rss','rss','automated',0,'x','2026-01-01','2026-01-01')",
    ).run();
    const o = await env.DB.prepare("SELECT * FROM opportunities WHERE reference_no = 'REF-OP2'").first<any>();
    const src = await env.DB.prepare("SELECT * FROM sources WHERE id = 'src_agg'").first<any>();
    await upsertItems(
      env,
      src,
      [
        {
          external_id: 'agg-1',
          category: 'tender',
          title: o.title,
          organization: o.organization,
          description: 'copy',
          country: o.country,
          countries: [],
          location: o.country,
          remote: 'onsite',
          source_url: 'https://agg.example/t/1',
          application_url: 'https://agg.example/t/1',
          official_url: null,
          reference_no: null,
          published_at: null,
          deadline_at: o.deadline_at,
          deadline_tz: null,
          deadline_note: null,
          status_hint: 'open',
          verification: 'aggregator_only',
          meta: {},
          requirements: {},
          requirements_source: 'heuristic',
        },
      ],
      null,
      NOW,
    );
    expect(await count('SELECT COUNT(*) n FROM opportunities WHERE title = ?', o.title)).toBe(1);
    expect(await count('SELECT COUNT(*) n FROM source_records WHERE opportunity_id = ?', o.id)).toBe(2);
    const after = await env.DB.prepare('SELECT verification, application_url FROM opportunities WHERE id = ?')
      .bind(o.id)
      .first<any>();
    expect(after.verification).toBe('verified_official');
    expect(after.application_url).not.toContain('agg.example');
  });

  it('one failing source does not stop the others; failures retry with backoff then dead-letter', async () => {
    grantsFail = true;
    const r = await startRun(env, 'test', { now: new Date(NOW.getTime() + 20 * 3600_000) });
    for (let i = 0; i < 8; i++)
      await drainTasks(env, { max: 5, now: new Date(NOW.getTime() + (20 + i) * 3600_000), fetcher });
    const tasks = (
      await env.DB.prepare(
        'SELECT t.status, t.attempts, s.slug FROM ingestion_tasks t JOIN sources s ON s.id = t.source_id WHERE run_id = ?',
      )
        .bind(r.runId)
        .all<any>()
    ).results;
    expect(tasks.find((t) => t.slug === 'grants-gov-africa')).toMatchObject({ status: 'dead', attempts: 3 });
    expect(tasks.filter((t) => t.slug !== 'grants-gov-africa').every((t) => t.status === 'done')).toBe(true);
    const run = await env.DB.prepare('SELECT status FROM ingestion_runs WHERE id = ?')
      .bind(r.runId)
      .first<any>();
    expect(run.status).toBe('completed_with_errors');
    const src = await env.DB.prepare(
      "SELECT consecutive_failures, last_error FROM sources WHERE slug = 'grants-gov-africa'",
    ).first<any>();
    expect(src.consecutive_failures).toBeGreaterThan(0);
    expect(src.last_error).toMatch(/503/);
    // A source failure never closes its listings.
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunities WHERE category = 'research_grant' AND status = 'open'",
      ),
    ).toBe(grants.data.oppHits.length);
    grantsFail = false;
  });

  it('prevents overlapping runs and duplicate cron triggers', async () => {
    const t = new Date(NOW.getTime() + 30 * 3600_000);
    const a = await startRun(env, 'admin', { now: t });
    const b = await startRun(env, 'admin', { now: t });
    expect(a.started).toBe(true);
    expect(b).toMatchObject({ started: false, reason: 'run_in_progress', runId: a.runId });
    for (let i = 0; i < 4; i++) await drainTasks(env, { max: 5, now: t, fetcher });
    const c1 = await startRun(env, 'cron', { idempotencyKey: 'cron:fixed', now: t });
    for (let i = 0; i < 4; i++) await drainTasks(env, { max: 5, now: t, fetcher });
    const c2 = await startRun(env, 'cron', { idempotencyKey: 'cron:fixed', now: t });
    expect(c1.started).toBe(true);
    expect(c2).toMatchObject({ started: false, reason: 'duplicate_trigger' });
  });

  it('the scheduler only starts a run when the configured interval has elapsed', async () => {
    const last = await env.DB.prepare(
      'SELECT started_at FROM ingestion_runs ORDER BY started_at DESC LIMIT 1',
    ).first<any>();
    const soon = new Date(Date.parse(last.started_at) + 60 * 60_000);
    expect(await maybeStartScheduledRun(env, soon)).toBeNull();
    const later = new Date(Date.parse(last.started_at) + 6 * 3600_000);
    const r = await maybeStartScheduledRun(env, later);
    expect(r?.started).toBe(true);
    for (let i = 0; i < 4; i++) await drainTasks(env, { max: 5, now: later, fetcher });
  });

  it('a listing missing from a complete source becomes "status uncertain" only after repeated misses', async () => {
    await env.DB.prepare(
      "INSERT INTO sources (id, slug, name, owner, website, source_type, connector, config, access_method, automation, enabled, verification_policy, created_at, updated_at) VALUES ('src_lever','lever-acme','Acme jobs','Acme','https://acme.example','ats','lever','{\"company\":\"acme\",\"employer_name\":\"Acme\"}','api','automated',0,'x','2026-01-01','2026-01-01')",
    ).run();
    let postings = [
      {
        id: 'p1',
        text: 'Data Analyst',
        hostedUrl: 'https://jobs.lever.co/acme/p1',
        applyUrl: 'https://jobs.lever.co/acme/p1/apply',
        categories: { location: 'Kampala' },
        createdAt: Date.parse('2026-11-01'),
      },
      {
        id: 'p2',
        text: 'Accountant',
        hostedUrl: 'https://jobs.lever.co/acme/p2',
        applyUrl: 'https://jobs.lever.co/acme/p2/apply',
        categories: { location: 'Kampala' },
        createdAt: Date.parse('2026-11-01'),
      },
    ];
    const lf = mockFetch([[/api\.lever\.co/, () => json(postings)]]);
    const run = async (h: number) => {
      const t = new Date(NOW.getTime() + h * 3600_000);
      const r = await startRun(env, 'test', { sourceIds: ['src_lever'], now: t });
      await drainTasks(env, { max: 5, now: t, fetcher: lf });
      return r;
    };
    await run(100);
    expect(
      await count("SELECT COUNT(*) n FROM opportunities WHERE source_id = 'src_lever' AND status = 'open'"),
    ).toBe(2);
    postings = postings.slice(0, 1);
    await run(107);
    await run(114);
    expect(
      await count("SELECT COUNT(*) n FROM opportunities WHERE source_id = 'src_lever' AND status = 'open'"),
    ).toBe(2);
    await run(121);
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunities WHERE source_id = 'src_lever' AND status = 'status_uncertain'",
      ),
    ).toBe(1);
    // Reappearing restores it.
    postings = [
      ...postings,
      {
        id: 'p2',
        text: 'Accountant',
        hostedUrl: 'https://jobs.lever.co/acme/p2',
        applyUrl: 'https://jobs.lever.co/acme/p2/apply',
        categories: { location: 'Kampala' },
        createdAt: Date.parse('2026-11-01'),
      },
    ];
    await run(128);
    expect(
      await count("SELECT COUNT(*) n FROM opportunities WHERE source_id = 'src_lever' AND status = 'open'"),
    ).toBe(2);
  });

  it('expires opportunities whose published deadline has passed', async () => {
    await expireOpportunities(env, new Date('2027-01-01T00:00:00Z'));
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunities WHERE reference_no = 'REF-OP2' AND status = 'expired'",
      ),
    ).toBe(1);
    expect(
      await count(
        "SELECT COUNT(*) n FROM opportunity_events WHERE kind = 'status_changed' AND detail LIKE '%deadline passed%'",
      ),
    ).toBeGreaterThan(0);
  });
});
