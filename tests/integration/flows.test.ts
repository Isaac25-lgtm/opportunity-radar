import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processMatchAlerts, processReminders, sendDeliveries } from '../../worker/domain/alerts';
import { newId } from '../../worker/lib/util';
import { Client, createEnv, signup, type TestEnv } from './helpers';

let env: TestEnv;
const NOW = new Date();
const inDays = (d: number) => new Date(NOW.getTime() + d * 86400_000).toISOString();

async function addOpp(over: Record<string, unknown>) {
  const id = newId('opp');
  const o = {
    category: 'job',
    title: 'Data Analyst',
    organization: 'Acme',
    description: 'We need SQL and Python.',
    country: 'Uganda',
    location: 'Kampala',
    remote: 'onsite',
    deadline_at: inDays(20),
    status: 'open',
    verification: 'verified_official',
    requirements: '{"skills":["sql","python"],"education_level":"bachelor"}',
    ...over,
  } as any;
  const ts = new Date(Date.now() + Math.floor(Math.random() * 1000)).toISOString();
  await env.DB.prepare(
    `INSERT INTO opportunities (id, canonical_key, category, title, organization, description, summary, country, countries, location, remote, source_id, source_url, application_url, official_url,
      deadline_at, status, verification, moderation, meta, requirements, requirements_source, first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '', ?, '[]', ?, ?, 'src_worldbank_ea', ?, ?, ?, ?, ?, ?, 'approved', '{}', ?, 'structured', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      `test:${id}`,
      o.category,
      o.title,
      o.organization,
      o.description,
      o.country,
      o.location,
      o.remote,
      `https://example.org/${id}`,
      `https://example.org/${id}`,
      `https://example.org/${id}`,
      o.deadline_at,
      o.status,
      o.verification,
      o.requirements,
      ts,
      ts,
      ts,
      ts,
      ts,
    )
    .run();
  return id;
}

const careerData = {
  headline: 'Data analyst',
  nationality: 'Ugandan',
  country: 'Uganda',
  highest_education: 'bachelor',
  target_titles: ['Data Analyst'],
  skills: ['SQL', 'Python', 'Excel', 'Power BI', 'Statistics'],
  experience: [
    { title: 'Data Analyst', employer: 'Bank', start: '2019-01', end: '', current: true, description: 'x' },
  ],
};

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.__dispose());

describe('profiles and entitlements', () => {
  it('creates, edits and deletes a career profile; the free plan covers jobs only', async () => {
    const c = await signup(env, 'p1@example.test');
    const r = await c.put('/api/profiles/career', { data: careerData });
    expect(r.status).toBe(201);
    expect(r.json.completeness).toBeGreaterThan(50);
    expect(
      (await c.put('/api/profiles/career', { data: { ...careerData, headline: 'Senior analyst' } })).status,
    ).toBe(200);
    expect((await c.get('/api/profiles/career')).json.profile.data.headline).toBe('Senior analyst');
    const academic = await c.put('/api/profiles/academic', { data: { field_of_study: 'Statistics' } });
    expect(academic.status).toBe(402);
    expect(academic.json.error.details).toMatchObject({
      feature: 'profile_types',
      profile_type: 'academic',
      plan: 'free',
      upgrade_plan: 'pro',
    });
    expect((await c.del('/api/profiles/career')).status).toBe(200);
    expect((await c.get('/api/profiles/career')).json.profile).toBeNull();
    // Deleting a profile frees the slot, but the segment rule still applies.
    expect((await c.put('/api/profiles/academic', { data: { field_of_study: 'Statistics' } })).status).toBe(
      402,
    );
    expect((await c.put('/api/profiles/career', { data: careerData })).status).toBe(201);
  });

  it('each paid plan unlocks its segment: Jobs, Jobs & Scholarships, Complete', async () => {
    const subscribe = async (c: Awaited<ReturnType<typeof signup>>, planId: string) => {
      const me = await c.get('/api/auth/me');
      await env.DB.prepare(
        "INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)",
      )
        .bind(newId('sub'), me.json.user.id, planId, inDays(-1), inDays(29), inDays(-1), inDays(-1))
        .run();
    };
    const academicData = { current_level: 'bachelor', field_of_study: 'Statistics' };
    const businessData = { registered_name: 'Acme Ltd', is_registered: true, service_lines: ['printing'] };

    const jobs = await signup(env, 'seg-jobs@example.test');
    await subscribe(jobs, 'plan_basic');
    expect((await jobs.put('/api/profiles/career', { data: careerData })).status).toBe(201);
    expect(
      (await jobs.put('/api/profiles/academic', { data: academicData })).json.error.details,
    ).toMatchObject({ feature: 'profile_types', upgrade_plan: 'pro' });
    // Browsing stays open, but matching for a segment outside the plan is withheld.
    const academicFeed = await jobs.get('/api/opportunities?view=academic');
    expect(academicFeed.status).toBe(200);
    expect(academicFeed.json.matched).toBe(false);

    const study = await signup(env, 'seg-study@example.test');
    await subscribe(study, 'plan_pro');
    expect((await study.put('/api/profiles/career', { data: careerData })).status).toBe(201);
    expect((await study.put('/api/profiles/academic', { data: academicData })).status).toBe(201);
    expect(
      (await study.put('/api/profiles/business', { data: businessData })).json.error.details,
    ).toMatchObject({ feature: 'profile_types', profile_type: 'business', upgrade_plan: 'elite' });

    const complete = await signup(env, 'seg-all@example.test');
    await subscribe(complete, 'plan_elite');
    for (const [type, data] of [
      ['career', careerData],
      ['academic', academicData],
      ['business', businessData],
    ] as const)
      expect((await complete.put(`/api/profiles/${type}`, { data })).status).toBe(201);
    expect((await complete.get('/api/profiles')).json.profiles).toHaveLength(3);
    expect((await complete.get('/api/auth/me')).json.plan.code).toBe('elite');
  });

  it('validates profile input and rejects unknown profile types', async () => {
    const c = await signup(env, 'p4@example.test');
    expect((await c.put('/api/profiles/career', { data: { highest_education: 'wizard' } })).status).toBe(400);
    expect((await c.put('/api/profiles/hacker', { data: {} })).status).toBe(404);
  });
});

describe('documents (private storage)', () => {
  const pdf = () =>
    new Blob([new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], {
      type: 'application/pdf',
    });
  it('accepts a real PDF and lets only the owner download it', async () => {
    const a = await signup(env, 'd1@example.test');
    const b = await signup(env, 'd2@example.test');
    const fd = new FormData();
    fd.append('file', pdf(), '../../My CV.pdf');
    fd.append('kind', 'cv');
    const up = await a.req('POST', '/api/documents', fd);
    expect(up.status).toBe(201);
    expect(up.json.document.filename).toBe('My CV.pdf');
    const id = up.json.document.id;
    const dl = await a.get(`/api/documents/${id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-disposition')).toContain('attachment');
    expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await b.get(`/api/documents/${id}/download`)).status).toBe(404);
    expect((await b.del(`/api/documents/${id}`)).status).toBe(404);
    const key = (await env.DB.prepare('SELECT storage_key FROM documents WHERE id = ?').bind(id).first<any>())
      .storage_key;
    expect(key).not.toContain('My CV');
    expect((await a.del(`/api/documents/${id}`)).status).toBe(200);
    expect(await env.DOCS.get(key)).toBeNull();
  });

  it('rejects unsafe, mismatched, empty and oversized uploads', async () => {
    const a = await signup(env, 'd3@example.test');
    const send = (blob: Blob, name: string) => {
      const fd = new FormData();
      fd.append('file', blob, name);
      fd.append('kind', 'other');
      return a.req('POST', '/api/documents', fd);
    };
    expect((await send(new Blob(['MZ\x90\x00 executable']), 'cv.pdf')).status).toBe(415);
    expect((await send(new Blob(['<html><script>alert(1)</script>']), 'cv.pdf')).status).toBe(415);
    expect((await send(pdf(), 'cv.exe')).status).toBe(415);
    expect((await send(new Blob([]), 'cv.pdf')).status).toBe(400);
    expect((await send(new Blob([new Uint8Array(5 * 1024 * 1024 + 10)]), 'big.pdf')).status).toBe(413);
  });
});

describe('opportunity feed, saving and tracking', () => {
  it('preserves full browsing with an academic profile after paid access ends', async () => {
    const c = await signup(env, 'downgrade-feed@example.test');
    const user = (await c.get('/api/auth/me')).json.user;
    await env.DB.prepare(
      "INSERT INTO profiles (id, user_id, type, title, data, completeness, created_at, updated_at) VALUES ('retained-profile', ?, 'academic', 'Academic', '{}', 20, ?, ?)",
    )
      .bind(user.id, inDays(-1), inDays(-1))
      .run();
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<401)
      INSERT INTO opportunities (id, canonical_key, category, title, organization, source_url, first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
      SELECT 'bulk-'||n, 'bulk-'||n, 'scholarship', 'Pagination scholarship', 'University', 'https://example.org', ?1, ?1, ?1, ?1, ?1 FROM seq`,
    )
      .bind(inDays(-1))
      .run();
    const feed = (await c.get('/api/opportunities?view=academic&q=Pagination&page=21')).json;
    expect(feed).toMatchObject({
      total: 401,
      pages: 21,
      matched: false,
      upgrade_plan: 'Jobs & Scholarships',
    });
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].match).toBeNull();
    await env.DB.prepare("DELETE FROM opportunities WHERE title = 'Pagination scholarship'").run();
  });
  it('ranks opportunities for a profile with separate eligibility and relevance', async () => {
    const c = await signup(env, 'f1@example.test');
    await c.put('/api/profiles/career', { data: careerData });
    const good = await addOpp({
      title: 'Data Analyst',
      requirements: '{"skills":["sql","python"],"education_level":"bachelor"}',
    });
    const phd = await addOpp({
      title: 'Senior Data Analyst',
      requirements: '{"skills":["sql"],"education_level":"phd"}',
    });
    const feed = await c.get('/api/opportunities?view=career');
    expect(feed.json.matched).toBe(true);
    const ids = feed.json.items.map((i: any) => i.id);
    expect(ids.indexOf(good)).toBeLessThan(ids.indexOf(phd));
    expect(feed.json.items.find((i: any) => i.id === phd).match.eligibility).toBe('not_eligible');
    const detail = await c.get(`/api/opportunities/${good}`);
    expect(detail.json.matches[0]).toMatchObject({ profile_type: 'career', eligibility: 'eligible' });
    expect(detail.json.opportunity.source_url).toContain('example.org');
  });

  it('keeps consultancy listings browsable while reserving their matches for paid accounts', async () => {
    const c = await signup(env, 'free-consultancy@example.test');
    await c.put('/api/profiles/career', { data: careerData });
    const id = await addOpp({ category: 'consultancy' });
    const feed = await c.get('/api/opportunities?view=career&category=consultancy');
    expect(feed.json.items.find((item: any) => item.id === id)).toMatchObject({
      match: null,
      upgrade_plan: 'Jobs',
    });
    expect(
      (await c.get('/api/opportunities?view=career&category=consultancy&min_score=1')).json.items,
    ).toHaveLength(0);
    expect((await c.get('/api/opportunities/' + id)).json.matches[0]).toMatchObject({
      gated: 'plan_segment',
      upgrade_plan: 'Jobs',
    });
  });

  it('saves, dismisses and hides dismissed items from the feed', async () => {
    const c = await signup(env, 'f2@example.test');
    const id = await addOpp({ title: 'Dismiss me' });
    await c.post(`/api/opportunities/${id}/save`);
    expect((await c.get('/api/opportunities/saved')).json.items.map((i: any) => i.id)).toContain(id);
    await c.post(`/api/opportunities/${id}/dismiss`);
    expect((await c.get('/api/opportunities/saved')).json.items.map((i: any) => i.id)).not.toContain(id);
    const feed = await c.get('/api/opportunities?view=all&q=Dismiss');
    expect(feed.json.items.map((i: any) => i.id)).not.toContain(id);
    expect((await c.post('/api/opportunities/opp_doesnotexist/save')).status).toBe(404);
  });

  it('tracks an application and a business bid separately', async () => {
    const c = await signup(env, 'f3@example.test');
    const job = await addOpp({ title: 'Job X' });
    const tender = await addOpp({ title: 'Tender Y', category: 'tender' });
    expect(
      (
        await c.post('/api/applications', {
          kind: 'application',
          title: 'Job X',
          opportunity_id: job,
          status: 'applied',
          follow_up_at: inDays(0.5),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await c.post('/api/applications', {
          kind: 'bid',
          title: 'Tender Y',
          opportunity_id: tender,
          status: 'preparing',
        })
      ).status,
    ).toBe(201);
    const dup = await c.post('/api/applications', {
      kind: 'application',
      title: 'Job X',
      opportunity_id: job,
    });
    expect(dup.json.existing).toBe(true);
    expect((await c.get('/api/applications?kind=application')).json.applications).toHaveLength(1);
    expect((await c.get('/api/applications?kind=bid')).json.applications).toHaveLength(1);
    expect(
      (await c.post('/api/applications', { kind: 'application', title: 'x', status: 'nonsense' })).status,
    ).toBe(400);
  });
});

describe('alerts and notifications', () => {
  it('hides optional in-app alerts on every surface when the channel is disabled', async () => {
    const c = await signup(env, 'quiet-inbox@example.test');
    const user = (await c.get('/api/auth/me')).json.user;
    await env.DB.prepare('UPDATE notification_prefs SET in_app_enabled = 0 WHERE user_id = ?')
      .bind(user.id)
      .run();
    for (const kind of ['deadline', 'system']) {
      await env.DB.prepare(
        "INSERT INTO notifications (id, user_id, kind, title, body, dedupe_key, created_at) VALUES (?, ?, ?, ?, '', ?, ?)",
      )
        .bind(newId('ntf'), user.id, kind, kind, kind, inDays(0))
        .run();
    }
    expect((await c.get('/api/notifications')).json.notifications.map((n: any) => n.kind)).toEqual([
      'system',
    ]);
    expect((await c.get('/api/auth/me')).json.unread).toBe(1);
    expect((await c.get('/api/dashboard')).json.alerts.map((n: any) => n.kind)).toEqual(['system']);
  });

  it('continues across a page boundary shared by multiple listings', async () => {
    const time = inDays(1);
    const ids = await Promise.all([addOpp({}), addOpp({}), addOpp({})]);
    await env.DB.prepare('UPDATE opportunities SET first_seen_at = ? WHERE id IN (?, ?, ?)')
      .bind(time, ...ids)
      .run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO system_config (key,value,updated_at) VALUES ('alerts.cursor',?,?)",
    )
      .bind(JSON.stringify(time), time)
      .run();
    expect((await processMatchAlerts(env, new Date(), 2)).opportunities).toBe(2);
    expect((await processMatchAlerts(env, new Date(), 2)).opportunities).toBe(1);
    expect((await processMatchAlerts(env, new Date(), 2)).opportunities).toBe(0);
    await env.DB.prepare('DELETE FROM opportunities WHERE id IN (?, ?, ?)')
      .bind(...ids)
      .run();
  });
  it('sends a new-match alert once, never for expired listings, and respects preferences', async () => {
    const c = await signup(env, 'n1@example.test');
    const me = await c.get('/api/auth/me');
    await c.put('/api/profiles/career', { data: careerData });
    await c.put('/api/notifications/prefs', {
      email_enabled: true,
      in_app_enabled: true,
      frequency: 'weekly',
      categories: ['new_match', 'deadline'],
      min_score: 50,
      quiet_start: null,
      quiet_end: null,
    });
    // Start the alert cursor from now so only new listings count.
    await env.DB.prepare(
      "INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES ('alerts.cursor', ?, ?)",
    )
      .bind(JSON.stringify(new Date(Date.now() - 1000).toISOString()), new Date().toISOString())
      .run();
    const match = await addOpp({ title: 'Data Analyst II' });
    const expired = await addOpp({
      title: 'Data Analyst (closed)',
      deadline_at: inDays(-1),
      status: 'expired',
    });
    await processMatchAlerts(env);
    await processMatchAlerts(env); // second cycle: nothing new
    const notes = (
      await env.DB.prepare(
        "SELECT opportunity_id FROM notifications WHERE user_id = ? AND kind = 'new_match'",
      )
        .bind(me.json.user.id)
        .all<any>()
    ).results;
    expect(notes.filter((n) => n.opportunity_id === match)).toHaveLength(1);
    expect(notes.filter((n) => n.opportunity_id === expired)).toHaveLength(0);
    // Weekly frequency → no instant email queued.
    expect(
      await env.DB.prepare('SELECT COUNT(*) n FROM notification_deliveries WHERE user_id = ?')
        .bind(me.json.user.id)
        .first<any>(),
    ).toMatchObject({ n: 0 });
  });

  it('refuses alert frequencies the plan does not include', async () => {
    const c = await signup(env, 'n2@example.test');
    const r = await c.put('/api/notifications/prefs', {
      email_enabled: true,
      in_app_enabled: true,
      frequency: 'instant',
      categories: ['new_match'],
      min_score: 50,
      quiet_start: null,
      quiet_end: null,
    });
    expect(r.status).toBe(400);
  });

  it('creates deadline and follow-up reminders once per day', async () => {
    const c = await signup(env, 'n3@example.test');
    const me = await c.get('/api/auth/me');
    const soon = await addOpp({ title: 'Closing soon', deadline_at: inDays(2) });
    await c.post(`/api/opportunities/${soon}/save`);
    await c.post('/api/applications', {
      kind: 'application',
      title: 'Follow me',
      status: 'applied',
      follow_up_at: inDays(0.5),
    });
    await env.DB.prepare("DELETE FROM system_config WHERE key = 'alerts.reminders_day'").run();
    await processReminders(env);
    await processReminders(env);
    const kinds = (
      await env.DB.prepare('SELECT kind FROM notifications WHERE user_id = ?')
        .bind(me.json.user.id)
        .all<any>()
    ).results.map((r) => r.kind);
    expect(kinds.filter((k) => k === 'deadline')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'follow_up')).toHaveLength(1);
  });

  it('records email provider failures without losing the in-app notification', async () => {
    const c = await signup(env, 'n4@example.test');
    const me = await c.get('/api/auth/me');
    const nid = newId('ntf');
    const ts = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO notifications (id, user_id, kind, title, body, dedupe_key, created_at) VALUES (?, ?, 'system', 'Hi', 'Body', 'k1', ?)",
      ).bind(nid, me.json.user.id, ts),
      env.DB.prepare(
        "INSERT INTO notification_deliveries (id, notification_id, user_id, channel, status, send_after, created_at, updated_at) VALUES (?, ?, ?, 'email', 'pending', ?, ?, ?)",
      ).bind(newId('dlv'), nid, me.json.user.id, ts, ts, ts),
    ]);
    // Provider configured but failing (no network to SendGrid in tests → fetch is stubbed to fail).
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('err', { status: 500 })) as any;
    try {
      await sendDeliveries({
        ...env,
        EMAIL_PROVIDER: 'sendgrid',
        EMAIL_API_KEY: 'k',
        EMAIL_FROM: 'a@b.test',
      } as any);
    } finally {
      globalThis.fetch = realFetch;
    }
    const d = await env.DB.prepare(
      'SELECT status, attempts, error FROM notification_deliveries WHERE notification_id = ?',
    )
      .bind(nid)
      .first<any>();
    expect(d).toMatchObject({ status: 'pending', attempts: 1 });
    expect(d.error).toMatch(/500/);
    expect((await c.get('/api/notifications')).json.notifications.map((n: any) => n.id)).toContain(nid);
    // With no provider configured the delivery is marked skipped, not lost.
    await env.DB.prepare('UPDATE notification_deliveries SET send_after = ? WHERE notification_id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), nid)
      .run();
    await sendDeliveries(env);
    expect(
      (
        await env.DB.prepare('SELECT status FROM notification_deliveries WHERE notification_id = ?')
          .bind(nid)
          .first<any>()
      ).status,
    ).toBe('skipped');
  });
});

describe('CV builder API', () => {
  it('preserves the winning CV edit and its history when another editor saves or restores a stale revision', async () => {
    const c = await signup(env, 'cv-race@example.test', 'CV Editor');
    const created = await c.post('/api/cvs', { title: 'Original' });
    const path = `/api/cvs/${created.json.id}`;
    const original = (await c.get(path)).json.cv;
    const guard = `?base_updated_at=${encodeURIComponent(original.updated_at)}`;
    const edits = ['First tab', 'Second tab'];
    const writes = await Promise.all(
      edits.map((title) =>
        c.put(path + guard, { title, data: original.data, template: original.template, snapshot: true }),
      ),
    );
    expect(writes.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await c.post(path + '/versions/1/restore' + guard)).status).toBe(409);
    const current = (await c.get(path)).json.cv;
    expect(current.title).toBe(edits[writes.findIndex((r) => r.status === 200)]);
    expect(current.updated_at).not.toBe(original.updated_at);
    expect((await c.get(path + '/versions')).json.versions).toHaveLength(2);
    expect(
      (await c.post(path + '/versions/1/restore?base_updated_at=' + encodeURIComponent(current.updated_at)))
        .status,
    ).toBe(200);
  });

  it('creates from profile, autosaves, versions, restores, exports within plan limits and tailors', async () => {
    const c = await signup(env, 'cv1@example.test', 'CV Person');
    await c.put('/api/profiles/career', { data: careerData });
    const cv = await c.post('/api/cvs', { title: 'Main', from: 'profile' });
    expect(cv.status).toBe(201);
    const got = (await c.get(`/api/cvs/${cv.json.id}`)).json.cv;
    expect(got.data.personal.fullName).toBe('CV Person');
    expect(got.data.experience[0].employer).toBe('Bank');
    const d2 = { ...got.data, summary: 'Changed summary' };
    expect(
      (await c.put(`/api/cvs/${cv.json.id}`, { title: 'Main', template: 'ats', data: d2, snapshot: true }))
        .json.version,
    ).toBe(2);
    await c.post(`/api/cvs/${cv.json.id}/versions/1/restore`);
    expect((await c.get(`/api/cvs/${cv.json.id}`)).json.cv.data.summary).not.toBe('Changed summary');
    expect((await c.get(`/api/cvs/${cv.json.id}/versions`)).json.versions.length).toBeGreaterThanOrEqual(3);
    // Free plan: second CV refused, DOCX refused, PDF allowed 5 times
    expect((await c.post('/api/cvs', { title: 'Second' })).status).toBe(402);
    expect((await c.post(`/api/cvs/${cv.json.id}/export`, { format: 'docx' })).status).toBe(402);
    const exports = await Promise.all(
      Array.from({ length: 6 }, () => c.post(`/api/cvs/${cv.json.id}/export`, { format: 'pdf' })),
    );
    expect(exports.map(({ status }) => status).sort()).toEqual([200, 200, 200, 200, 200, 402]);
    expect((await c.post(`/api/cvs/${cv.json.id}/export`, { format: 'pdf' })).status).toBe(402);
    // Tailoring analysis is available; creating a tailored copy needs a paid plan
    const opp = await addOpp({ title: 'Analyst', description: 'SQL and Tableau required' });
    const t = await c.post(`/api/cvs/${cv.json.id}/tailor`, { opportunity_id: opp });
    expect(t.json.analysis.matched_skills).toContain('SQL');
    expect(
      (await c.post(`/api/cvs/${cv.json.id}/tailor`, { opportunity_id: opp, create_copy: true })).status,
    ).toBe(402);
    expect(
      (await c.post('/api/cover-letters/draft', { cv_id: cv.json.id, opportunity_id: opp })).status,
    ).toBe(402);
  });

  it('assigns distinct version numbers to concurrent snapshots', async () => {
    const c = await signup(env, 'cv-versions@example.test');
    const created = await c.post('/api/cvs', { title: 'Main' });
    const path = `/api/cvs/${created.json.id}`;
    const { cv } = (await c.get(path)).json;
    const snapshots = await Promise.all(
      ['First change', 'Second change'].map((summary) =>
        c.put(path, {
          title: cv.title,
          template: cv.template,
          data: { ...cv.data, summary },
          snapshot: true,
        }),
      ),
    );
    expect(snapshots.map(({ status }) => status)).toEqual([200, 200]);
    expect(snapshots.map(({ json }) => json.version).sort()).toEqual([2, 3]);
  });

  it('parses CV text without inventing facts', async () => {
    const c = await signup(env, 'cv2@example.test');
    const r = await c.post('/api/cvs/parse', {
      text: 'Jane Doe\njane@example.com\n\nSKILLS\nSQL, Excel\n\nEDUCATION\nBSc Statistics, Makerere University\n2014 - 2017',
    });
    expect(r.status).toBe(200);
    expect(r.json.data.personal.email).toBe('jane@example.com');
    expect(r.json.data.skills.map((s: any) => s.name)).toEqual(['SQL', 'Excel']);
    expect(r.json.data.experience).toHaveLength(0);
    expect((await c.post('/api/cvs/parse', { text: 'short' })).status).toBe(400);
  });
});

describe('account data rights', () => {
  it('exports and permanently deletes an account', async () => {
    const c = await signup(env, 'gone@example.test');
    expect(
      (
        await c.post('/api/public/contact', {
          name: 'Private Name',
          email: 'gone@example.test',
          topic: 'account',
          message: 'Private support request',
        })
      ).status,
    ).toBe(201);
    await c.put('/api/profiles/career', { data: careerData });
    const ex = await c.get('/api/auth/export');
    expect(ex.json.profiles).toHaveLength(1);
    expect(ex.json.account.email).toBe('gone@example.test');
    expect(ex.json.contact_messages).toHaveLength(1);
    expect(JSON.stringify(ex.json)).not.toContain('password_hash');
    expect((await c.post('/api/auth/delete-account', { password: 'wrong' })).status).toBe(400);
    expect((await c.post('/api/auth/delete-account', { password: 'Password1234' })).status).toBe(200);
    expect(
      await env.DB.prepare('SELECT id FROM contact_messages WHERE user_id = ?')
        .bind(ex.json.account.id)
        .first(),
    ).toBeNull();
    expect((await c.get('/api/auth/me')).json.user).toBeNull();
    const again = new Client(env);
    expect(
      (await again.post('/api/auth/signin', { email: 'gone@example.test', password: 'Password1234' })).status,
    ).toBe(401);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) n FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.status = 'deleted'",
      ).first<any>(),
    ).toMatchObject({ n: 0 });
  });
});
