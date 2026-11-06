import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createEnv, signup, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.__dispose());

describe('authentication', () => {
  it('registers, reads session, signs out and signs back in', async () => {
    const c = await signup(env, 'alice@example.test', 'Alice Nakato');
    let me = await c.get('/api/auth/me');
    expect(me.json.user.email).toBe('alice@example.test');
    expect(me.json.plan.code).toBe('free');
    await c.post('/api/auth/signout');
    me = await c.get('/api/auth/me');
    expect(me.json.user).toBeNull();
    const bad = await c.post('/api/auth/signin', {
      email: 'alice@example.test',
      password: 'wrong-password1',
    });
    expect(bad.status).toBe(401);
    const ok = await c.post('/api/auth/signin', { email: 'alice@example.test', password: 'Password1234' });
    expect(ok.status).toBe(200);
    expect((await c.get('/api/auth/me')).json.user.name).toBe('Alice Nakato');
  });

  it('rejects duplicate emails, weak passwords and missing terms', async () => {
    const c = new Client(env);
    expect(
      (
        await c.post('/api/auth/signup', {
          name: 'A',
          email: 'alice@example.test',
          password: 'Password1234',
          accept_terms: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await c.post('/api/auth/signup', {
          name: 'Al Two',
          email: 'ALICE@example.test',
          password: 'Password1234',
          accept_terms: true,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await c.post('/api/auth/signup', {
          name: 'Bob',
          email: 'bob@example.test',
          password: 'short',
          accept_terms: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await c.post('/api/auth/signup', {
          name: 'Bob',
          email: 'bob@example.test',
          password: 'Password1234',
          accept_terms: false,
        })
      ).status,
    ).toBe(400);
  });

  it('password reset: token works once and invalidates sessions', async () => {
    const c = await signup(env, 'reset@example.test');
    const anon = new Client(env);
    const r = await anon.post('/api/auth/forgot', { email: 'reset@example.test' });
    expect(r.status).toBe(200);
    expect(r.json.dev_reset_link).toContain('/reset-password?token=');
    const unknown = await anon.post('/api/auth/forgot', { email: 'nobody@example.test' });
    expect(unknown.json.message).toBe(r.json.message);
    expect(unknown.json.dev_reset_link).toBeNull();
    const token = new URL(r.json.dev_reset_link).searchParams.get('token');
    const passwords = ['NewPassword99', 'NewPassword98'];
    const attempts = await Promise.all(
      passwords.map((password) => anon.post('/api/auth/reset', { token, password })),
    );
    expect(attempts.map(({ status }) => status).sort()).toEqual([200, 400]);
    expect((await c.get('/api/auth/me')).json.user).toBeNull();
    expect(
      (
        await anon.post('/api/auth/signin', {
          email: 'reset@example.test',
          password: passwords[attempts.findIndex(({ status }) => status === 200)],
        })
      ).status,
    ).toBe(200);
  });

  it('requires an explicitly provisioned administrator in production', async () => {
    const email = 'production-admin@example.test';
    const production = { ...env, ENVIRONMENT: 'production', ADMIN_EMAILS: email } as TestEnv;
    const c = await signup(production, email);
    expect((await c.get('/api/auth/me')).json.user.role).toBe('user');
    await c.post('/api/auth/signout');
    expect((await c.post('/api/auth/signin', { email, password: 'Password1234' })).status).toBe(200);
    expect((await c.get('/api/auth/me')).json.user.role).toBe('user');
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE email = ?").bind(email).run();
    expect((await c.get('/api/auth/me')).json.user.role).toBe('admin');
  });

  it('refuses state-changing requests without the CSRF header or from another origin', async () => {
    const c = await signup(env, 'csrf@example.test');
    const noHeader = await c.req('PUT', '/api/profiles/career', { data: {} }, { 'x-or-csrf': '' });
    expect(noHeader.status).toBe(403);
    const cross = await c.req(
      'PUT',
      '/api/profiles/career',
      { data: {} },
      { 'x-or-csrf': '1', origin: 'https://evil.example' },
    );
    expect(cross.status).toBe(403);
  });

  it('rejects oversized JSON bodies before validation', async () => {
    const c = await signup(env, 'big@example.test');
    const r = await c.put('/api/profiles/career', { data: { summary: 'x'.repeat(1_100_000) } });
    expect(r.status).toBe(413);
  });

  it('protected routes require a session', async () => {
    const anon = new Client(env);
    for (const p of [
      '/api/profiles',
      '/api/cvs',
      '/api/documents',
      '/api/applications',
      '/api/notifications',
      '/api/dashboard',
      '/api/billing',
    ])
      expect((await anon.get(p)).status, p).toBe(401);
  });
});

describe('account isolation (IDOR)', () => {
  it("user B cannot read or modify user A's CVs, documents, applications or notifications", async () => {
    const a = await signup(env, 'a-iso@example.test');
    const b = await signup(env, 'b-iso@example.test');
    await a.put('/api/profiles/career', { data: { headline: 'Data analyst', skills: ['SQL'] } });
    const cv = await a.post('/api/cvs', { title: 'A CV' });
    expect(cv.status).toBe(201);
    const app = await a.post('/api/applications', { kind: 'application', title: 'Job at X' });
    expect(app.status).toBe(201);

    expect((await b.get(`/api/cvs/${cv.json.id}`)).status).toBe(404);
    expect(
      (await b.put(`/api/cvs/${cv.json.id}`, { title: 'hacked', template: 'ats', data: {} })).status,
    ).toBe(404);
    expect((await b.del(`/api/cvs/${cv.json.id}`)).status).toBe(404);
    expect((await b.get(`/api/cvs/${cv.json.id}/versions`)).status).toBe(404);
    expect(
      (await b.put(`/api/applications/${app.json.id}`, { kind: 'application', title: 'x' })).status,
    ).toBe(404);
    expect((await b.del(`/api/applications/${app.json.id}`)).status).toBe(404);
    expect(
      (await b.post('/api/applications', { kind: 'application', title: 'x', cv_id: cv.json.id })).status,
    ).toBe(404);
    expect((await b.get('/api/profiles/career')).json.profile).toBeNull();
    expect((await b.get('/api/cvs')).json.cvs).toHaveLength(0);
    // A's data is intact
    expect((await a.get(`/api/cvs/${cv.json.id}`)).json.cv.title).toBe('A CV');
  });

  it('non-admins cannot reach admin routes; bootstrap admin can', async () => {
    const u = await signup(env, 'plain@example.test');
    for (const p of [
      '/api/admin/metrics',
      '/api/admin/users',
      '/api/admin/sources',
      '/api/admin/runs',
      '/api/admin/audit',
      '/api/admin/config',
    ])
      expect((await u.get(p)).status, p).toBe(403);
    expect((await u.post('/api/admin/runs', {})).status).toBe(403);
    const admin = await signup(env, 'admin@example.test', 'Admin');
    expect((await admin.get('/api/admin/metrics')).status).toBe(200);
    // an admin cannot be created by an ordinary user changing their own role
    const self = await u.get('/api/auth/me');
    expect((await u.patch(`/api/admin/users/${self.json.user.id}`, { role: 'admin' })).status).toBe(403);
  });

  it('suspended users lose their sessions', async () => {
    const admin = new Client(env);
    await admin.post('/api/auth/signin', { email: 'admin@example.test', password: 'Password1234' });
    const s = await signup(env, 'suspend@example.test');
    const me = await s.get('/api/auth/me');
    expect((await admin.patch(`/api/admin/users/${me.json.user.id}`, { status: 'suspended' })).status).toBe(
      200,
    );
    expect((await s.get('/api/auth/me')).json.user).toBeNull();
    expect(
      (await s.post('/api/auth/signin', { email: 'suspend@example.test', password: 'Password1234' })).status,
    ).toBe(401);
  });
});
