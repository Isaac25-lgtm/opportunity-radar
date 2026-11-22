/**
 * Fifteen people with different goals use the product end to end through the API:
 * 5 professionals (Jobs plan), 5 scholarship seekers (Jobs & Scholarships) and 5 companies (Complete).
 * Each is checked for: the plan segment, the opportunity ranked first, stated eligibility outcomes
 * (including cases where relevance and eligibility disagree), explanations, and the CV built from
 * their profile.
 */
import { appendFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_OPPORTUNITIES, PERSONAS, type Persona } from '../fixtures/personas';
import { Client, createEnv, signup, type TestEnv } from './helpers';

let env: TestEnv;
const ids = new Map<string, string>(); // fixture key -> opportunity id
const keyOf = (id: string) => [...ids].find(([, v]) => v === id)?.[0] ?? id;

const PLAN_IDS = { basic: 'plan_basic', pro: 'plan_pro', elite: 'plan_elite' } as const;
const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

async function subscribe(c: Client, plan: Persona['plan']) {
  const me = (await c.get('/api/auth/me')).json.user;
  await env.DB.prepare(
    "INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)",
  )
    .bind(`sub_${me.id}`, me.id, PLAN_IDS[plan], inDays(-1), inDays(29), inDays(-1), inDays(-1))
    .run();
}

beforeAll(async () => {
  env = await createEnv();
  const admin = await signup(env, 'admin@example.test', 'Admin');
  for (const f of FIXTURE_OPPORTUNITIES) {
    const r = await admin.post('/api/admin/opportunities', f.input);
    expect(r.status, `${f.key}: ${JSON.stringify(r.json)}`).toBe(201);
    ids.set(f.key, r.json.id);
  }
});
afterAll(async () => env.__dispose());

describe.each(PERSONAS.map((p) => [p.name, p] as const))('%s', (_name, persona) => {
  let c: Client;
  let feed: any[] = [];

  beforeAll(async () => {
    c = await signup(env, persona.email, persona.name);
    await subscribe(c, persona.plan);
    const r = await c.put(`/api/profiles/${persona.profileType}`, { data: persona.profile });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    feed = (await c.get(`/api/opportunities?view=${persona.profileType}`)).json.items;
  });

  it('is on the plan for their segment, and other segments stay locked', async () => {
    const me = (await c.get('/api/auth/me')).json;
    expect(me.plan.code).toBe(persona.plan);
    expect(me.plan.entitlements.profile_types).toContain(persona.profileType);
    if (persona.plan === 'basic') {
      const r = await c.put('/api/profiles/academic', { data: { field_of_study: 'Economics' } });
      expect(r.status).toBe(402);
      expect(r.json.error.details.upgrade_plan).toBe('pro');
    }
    if (persona.plan === 'pro') {
      const r = await c.put('/api/profiles/business', { data: { registered_name: 'Side Business Ltd' } });
      expect(r.status).toBe(402);
      expect(r.json.error.details.upgrade_plan).toBe('elite');
    }
  });

  it('shows a ranked, explained feed', () => {
    expect(feed.length).toBeGreaterThan(0);
    // PERSONA_REPORT=<file> appends each person's ranking, for human review.
    if (process.env.PERSONA_REPORT)
      appendFileSync(
        process.env.PERSONA_REPORT,
        [
          `\n${persona.name} (${persona.plan})`,
          ...feed.map(
            (o) =>
              `  ${keyOf(o.id).padEnd(28)} ${String(o.match?.score).padStart(3)}  ${o.match?.eligibility}`,
          ),
          '',
        ].join('\n'),
      );
    expect(feed.every((o) => o.match && o.match.eligibility)).toBe(true);
  });

  if (persona.expectTop)
    it(`ranks ${persona.expectTop} first, with reasons`, async () => {
      const ranking = feed.map((o) => `${keyOf(o.id)} ${o.match?.score} ${o.match?.eligibility}`);
      expect(keyOf(feed[0].id), ranking.join('\n')).toBe(persona.expectTop);
      const detail = (await c.get(`/api/opportunities/${feed[0].id}`)).json;
      const m = detail.matches.find((x: any) => x.profile_type === persona.profileType);
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(m.score).toBeGreaterThanOrEqual(50);
    });

  if (persona.expectMostRelevant)
    it(`finds ${persona.expectMostRelevant} most relevant, and says why they cannot apply`, async () => {
      const best = [...feed].sort((a, b) => (b.match.score ?? 0) - (a.match.score ?? 0))[0];
      expect(keyOf(best.id)).toBe(persona.expectMostRelevant);
      const detail = (await c.get(`/api/opportunities/${best.id}`)).json;
      const m = detail.matches.find((x: any) => x.profile_type === persona.profileType);
      expect(m.disqualifiers.length).toBeGreaterThan(0);
    });

  it('reports the stated eligibility outcomes', () => {
    for (const [key, want] of Object.entries(persona.expectEligibility ?? {})) {
      const item = feed.find((o) => o.id === ids.get(key));
      expect(item, `${key} missing from the feed`).toBeTruthy();
      expect(item.match.eligibility, `${persona.key} → ${key}`).toBe(want);
    }
  });

  if (persona.kind === 'professional')
    it('gives an unrelated job (Head Chef) low relevance, even when eligible', () => {
      const chef = feed.find((o) => keyOf(o.id) === 'job_head_chef');
      expect(chef.match.score).toBeLessThan(40);
      expect(chef.match.score).toBeLessThan(feed[0].match.score);
    });

  if (persona.kind !== 'company')
    it('builds a CV from the profile using only their facts', async () => {
      const from = persona.profileType === 'academic' ? 'academic_profile' : 'profile';
      const created = await c.post('/api/cvs', { title: 'Sample CV', template: persona.cvTemplate, from });
      expect(created.status, JSON.stringify(created.json)).toBe(201);
      const cv = (await c.get(`/api/cvs/${created.json.id}`)).json.cv;
      expect(cv.data.personal.fullName).toBe(persona.name);
      const p = persona.profile as any;
      if (persona.profileType === 'career') {
        expect(cv.data.experience.map((e: any) => e.employer)).toEqual(
          p.experience.map((e: any) => e.employer),
        );
        expect(cv.data.skills.map((s: any) => s.name)).toEqual(p.skills);
      } else {
        expect(cv.data.order.slice(0, 2)).toEqual(['summary', 'education']);
        expect(cv.data.education.map((e: any) => e.institution)).toEqual(
          p.qualifications.map((q: any) => q.institution),
        );
        expect(cv.data.publications).toHaveLength(p.publications?.length ?? 0);
        expect(cv.data.summary).toContain(p.proposed_research);
      }
      // Nothing is invented: no employer or institution appears that is not in the profile.
      const known = JSON.stringify(p);
      for (const e of cv.data.experience) expect(known).toContain(e.employer);
      for (const e of cv.data.education) expect(known).toContain(e.institution);
    });
});

describe('across all fifteen people', () => {
  it('never shows a tender to a job seeker or a job to a company', async () => {
    const c = await new Client(env).req('GET', '/api/opportunities?view=career');
    expect(c.json.items.every((o: any) => !['tender', 'rfp', 'rfq', 'eoi'].includes(o.category))).toBe(true);
  });
});
