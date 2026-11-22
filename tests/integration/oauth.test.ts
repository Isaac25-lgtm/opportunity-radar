/**
 * "Continue with Google": off without keys; with keys, a full code + PKCE round trip against a stand-in for
 * Google's token endpoint. Covers new accounts, returning users, linking to an existing email account, and the
 * checks that must reject (state mismatch, unverified email, wrong audience).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client, createEnv, signup, type TestEnv } from './helpers';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
let env: TestEnv;
let off: TestEnv;

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims: Record<string, unknown>) =>
  `${b64url({ alg: 'RS256' })}.${b64url({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    email_verified: true,
    ...claims,
  })}.signature`;

/** Answers Google's token endpoint with the given ID token; checks PKCE and the client secret were sent. */
function stubGoogle(token: string) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== 'https://oauth2.googleapis.com/token') return realFetch(input, init);
    const form = new URLSearchParams(String(init?.body));
    expect(form.get('client_secret')).toBe('test-secret');
    expect(form.get('code_verifier')?.length).toBeGreaterThan(40);
    return Response.json({ id_token: token, access_token: 'x' });
  });
}

/** Starts the flow and returns what the browser would carry back: the flow cookie and the state. */
async function start(c: Client, next = '/app/cvs') {
  const r = await c.req('GET', `/api/auth/google/start?next=${encodeURIComponent(next)}`);
  expect(r.status).toBe(302);
  const loc = new URL(r.headers.get('location')!);
  expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
  expect(loc.searchParams.get('client_id')).toBe(CLIENT_ID);
  const flow = /or_oauth=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')![1];
  return { flow, state: loc.searchParams.get('state')! };
}

async function callback(c: Client, flow: string, state: string) {
  return c.req('GET', `/api/auth/google/callback?code=abc&state=${state}`, undefined, {
    cookie: `or_oauth=${flow}`,
  });
}

beforeAll(async () => {
  env = await createEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: 'test-secret' });
  off = await createEnv();
});
afterAll(async () => {
  await env.__dispose();
  await off.__dispose();
});
afterEach(() => vi.unstubAllGlobals());

describe('Google sign-in', () => {
  it('is visible but off until keys are configured', async () => {
    const c = new Client(off);
    expect((await c.get('/api/auth/providers')).json).toEqual({ google: false });
    const r = await c.req('GET', '/api/auth/google/start');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/signin?error=google_unavailable');
    expect((await new Client(env).get('/api/auth/providers')).json).toEqual({ google: true });
  });

  it('creates an account on first use, then signs the same person in again', async () => {
    stubGoogle(idToken({ sub: 'g-100', email: 'New.Person@example.com', name: 'New Person' }));
    const c = new Client(env);
    const { flow, state } = await start(c);
    const r = await callback(c, flow, state);
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/app/onboarding');
    const me = (await c.get('/api/auth/me')).json;
    expect(me.user).toMatchObject({
      email: 'new.person@example.com',
      name: 'New Person',
      has_password: false,
    });
    expect(me.plan.code).toBe('free');

    const again = new Client(env);
    const second = await start(again, '/app/cvs');
    const r2 = await callback(again, second.flow, second.state);
    expect(r2.headers.get('location')).toBe('/app/cvs');
    expect((await again.get('/api/auth/me')).json.user.email).toBe('new.person@example.com');
    const users = await env.DB.prepare(
      "SELECT COUNT(*) n FROM users WHERE email = 'new.person@example.com'",
    ).first<any>();
    expect(users.n).toBe(1);
  });

  it('links to an existing email account instead of creating a duplicate', async () => {
    const existing = await signup(env, 'linked@example.com', 'Linked Person');
    const id = (await existing.get('/api/auth/me')).json.user.id;
    stubGoogle(idToken({ sub: 'g-200', email: 'linked@example.com', name: 'Other Name' }));
    const c = new Client(env);
    const { flow, state } = await start(c);
    expect((await callback(c, flow, state)).headers.get('location')).toBe('/app/cvs');
    const me = (await c.get('/api/auth/me')).json.user;
    expect(me.id).toBe(id);
    expect(me.has_password).toBe(true); // their password still works
  });

  it('rejects a mismatched state, an unverified email and a token for another app', async () => {
    const c = new Client(env);
    stubGoogle(idToken({ sub: 'g-300', email: 'x@example.com' }));
    const a = await start(c);
    expect((await callback(c, a.flow, 'forged-state')).headers.get('location')).toBe(
      '/signin?error=google_failed',
    );

    stubGoogle(idToken({ sub: 'g-301', email: 'y@example.com', email_verified: false }));
    const b = await start(c);
    expect((await callback(c, b.flow, b.state)).headers.get('location')).toBe(
      '/signin?error=google_unverified',
    );

    stubGoogle(idToken({ sub: 'g-302', email: 'z@example.com', aud: 'someone-else' }));
    const d = await start(c);
    expect((await callback(c, d.flow, d.state)).headers.get('location')).toBe('/signin?error=google_failed');
    expect((await c.get('/api/auth/me')).json.user).toBeNull();
  });

  it('lets a Google-only person set a password and delete their account by typing DELETE', async () => {
    stubGoogle(idToken({ sub: 'g-400', email: 'leaver@example.com', name: 'Leaver' }));
    const c = new Client(env);
    const { flow, state } = await start(c);
    await callback(c, flow, state);
    expect((await c.post('/api/auth/delete-account', { confirm: 'nope' })).status).toBe(400);
    expect((await c.post('/api/auth/delete-account', { confirm: 'DELETE' })).status).toBe(200);
    const left = await env.DB.prepare(
      "SELECT COUNT(*) n FROM user_identities WHERE subject = 'g-400'",
    ).first<any>();
    expect(left.n).toBe(0);

    stubGoogle(idToken({ sub: 'g-401', email: 'setter@example.com', name: 'Setter' }));
    const s = new Client(env);
    const f = await start(s);
    await callback(s, f.flow, f.state);
    expect((await s.post('/api/auth/change-password', { next: 'NewPassword123' })).status).toBe(200);
    expect((await s.get('/api/auth/me')).json.user.has_password).toBe(true);
  });
});
