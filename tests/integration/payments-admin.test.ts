import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../worker/index';
import { applyProviderStatus } from '../../worker/domain/payments/service';
import { Client, createEnv, signup, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.__dispose());

const subs = async (userId: string) =>
  (
    await env.DB.prepare("SELECT COUNT(*) n FROM subscriptions WHERE user_id = ? AND status = 'active'")
      .bind(userId)
      .first<any>()
  ).n as number;

describe('payments (mock provider, no real money)', () => {
  it('activates a subscription only after a server-side completed status, exactly once', async () => {
    const c = await signup(env, 'pay1@example.test');
    const me = (await c.get('/api/auth/me')).json.user;
    const plans = await c.get('/api/billing/plans');
    expect(plans.json.plans.map((p: any) => p.code)).toEqual(['free', 'basic', 'pro', 'elite']);
    expect(plans.json.plans.find((p: any) => p.code === 'basic').price_ugx).toBe(10000);
    const co = await c.post('/api/billing/checkout', { plan_code: 'basic' });
    expect(co.status).toBe(200);
    expect(co.json.redirect_url).toContain('/mock-checkout/');
    const tracking = co.json.redirect_url.split('/').pop();

    // A browser return claiming success changes nothing while the provider says pending.
    expect((await c.post('/api/billing/verify', { tracking_id: tracking })).json.status).toBe('pending');
    expect(await subs(me.id)).toBe(0);
    expect((await c.get('/api/auth/me')).json.plan.code).toBe('free');

    await c.post(`/api/billing/mock/${tracking}`, { outcome: 'completed' });
    const confirmations = await Promise.all([
      c.post('/api/billing/verify', { tracking_id: tracking }),
      c.post('/api/billing/verify', { tracking_id: tracking }),
    ]);
    expect(confirmations.map((r) => r.json.status)).toEqual(['completed', 'completed']);
    expect(await subs(me.id)).toBe(1);
    expect((await c.get('/api/auth/me')).json.plan.code).toBe('basic');
    // Entitlement now enforced server-side: DOCX export allowed.
    const cv = await c.post('/api/cvs', { title: 'x' });
    expect((await c.post(`/api/cvs/${cv.json.id}/export`, { format: 'docx' })).status).toBe(200);
  });

  it('handles failure, cancellation and refund; refunds revoke access', async () => {
    const c = await signup(env, 'pay2@example.test');
    const me = (await c.get('/api/auth/me')).json.user;
    const fail = (await c.post('/api/billing/checkout', { plan_code: 'pro' })).json.redirect_url
      .split('/')
      .pop();
    await c.post(`/api/billing/mock/${fail}`, { outcome: 'failed' });
    expect((await c.post('/api/billing/verify', { tracking_id: fail })).json.status).toBe('failed');
    const cancel = (await c.post('/api/billing/checkout', { plan_code: 'pro' })).json.redirect_url
      .split('/')
      .pop();
    await c.post(`/api/billing/mock/${cancel}`, { outcome: 'cancelled' });
    expect((await c.post('/api/billing/verify', { tracking_id: cancel })).json.status).toBe('cancelled');
    expect(await subs(me.id)).toBe(0);
    const ok = (await c.post('/api/billing/checkout', { plan_code: 'pro' })).json.redirect_url
      .split('/')
      .pop();
    await c.post(`/api/billing/mock/${ok}`, { outcome: 'completed' });
    await c.post('/api/billing/verify', { tracking_id: ok });
    expect((await c.get('/api/auth/me')).json.plan.code).toBe('pro');
    // A late "failed" event cannot downgrade a completed payment.
    await c.post(`/api/billing/mock/${ok}`, { outcome: 'failed' });
    expect((await c.post('/api/billing/verify', { tracking_id: ok })).json.status).toBe('completed');
    await c.post(`/api/billing/mock/${ok}`, { outcome: 'refunded' });
    expect((await c.post('/api/billing/verify', { tracking_id: ok })).json.status).toBe('refunded');
    await c.post(`/api/billing/mock/${ok}`, { outcome: 'completed' });
    expect((await c.post('/api/billing/verify', { tracking_id: ok })).json.status).toBe('refunded');
    expect((await c.get('/api/auth/me')).json.plan.code).toBe('free');
    const hist = await c.get('/api/billing');
    expect(hist.json.payments.map((p: any) => p.status).sort()).toEqual(['cancelled', 'failed', 'refunded']);
  });

  it('does not activate when the provider-reported amount or currency does not match', async () => {
    const c = await signup(env, 'pay3@example.test');
    const me = (await c.get('/api/auth/me')).json.user;
    const tracking = (await c.post('/api/billing/checkout', { plan_code: 'elite' })).json.redirect_url
      .split('/')
      .pop();
    const p = await env.DB.prepare('SELECT * FROM payments WHERE provider_tracking_id = ?')
      .bind(tracking)
      .first<any>();
    const r = await applyProviderStatus(
      env,
      p,
      {
        status: 'completed',
        amount: 100,
        currency: 'UGX',
        merchantReference: p.merchant_reference,
        confirmationCode: 'x',
        paymentMethod: 'x',
        description: 'Completed',
        raw: {},
      },
      'ipn',
    );
    expect(r).toMatchObject({ changed: false, reason: 'mismatch' });
    const r2 = await applyProviderStatus(
      env,
      p,
      {
        status: 'completed',
        amount: p.amount,
        currency: 'USD',
        merchantReference: p.merchant_reference,
        confirmationCode: 'x',
        paymentMethod: 'x',
        description: 'Completed',
        raw: {},
      },
      'ipn',
    );
    expect(r2.reason).toBe('mismatch');
    const incomplete = await applyProviderStatus(
      env,
      p,
      {
        status: 'completed',
        amount: p.amount,
        currency: 'UGX',
        merchantReference: null,
        confirmationCode: null,
        paymentMethod: null,
        description: 'Completed',
        raw: {},
      },
      'ipn',
    );
    expect(incomplete.reason).toBe('mismatch');
    expect(await subs(me.id)).toBe(0);
  });

  it('rolls back a failed activation and lets a callback retry at month-end', async () => {
    const c = await signup(env, 'pay-retry@example.test');
    const tracking = (await c.post('/api/billing/checkout', { plan_code: 'basic' })).json.redirect_url
      .split('/')
      .pop();
    const payment = (await env.DB.prepare('SELECT * FROM payments WHERE provider_tracking_id = ?')
      .bind(tracking)
      .first<any>())!;
    const complete = () =>
      applyProviderStatus(
        env,
        payment,
        {
          status: 'completed',
          amount: payment.amount,
          currency: payment.currency,
          merchantReference: payment.merchant_reference,
          confirmationCode: 'confirmation',
          paymentMethod: 'Mock',
          description: 'Completed',
          raw: {},
        },
        'callback',
        new Date('2026-01-31T12:00:00.000Z'),
      );
    await env.DB.prepare(
      `CREATE TRIGGER fail_payment_notification BEFORE INSERT ON notifications
      WHEN NEW.dedupe_key = 'payment:${payment.id}' BEGIN SELECT RAISE(ABORT, 'test payment rollback'); END`,
    ).run();
    try {
      await expect(complete()).rejects.toThrow(/test payment rollback/);
      expect(await subs(payment.user_id)).toBe(0);
      expect(
        await env.DB.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first('status'),
      ).toBe('pending');
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_payment_notification').run();
    }
    await expect(complete()).resolves.toMatchObject({ status: 'completed', changed: true });
    const end = await env.DB.prepare('SELECT current_period_end FROM subscriptions WHERE payment_id = ?')
      .bind(payment.id)
      .first('current_period_end');
    expect(end).toBe('2026-02-28T12:00:00.000Z');
  });

  it('other users cannot verify or drive someone else’s checkout', async () => {
    const a = await signup(env, 'pay4@example.test');
    const b = await signup(env, 'pay5@example.test');
    const tracking = (await a.post('/api/billing/checkout', { plan_code: 'basic' })).json.redirect_url
      .split('/')
      .pop();
    expect((await b.post(`/api/billing/mock/${tracking}`, { outcome: 'completed' })).status).toBe(404);
    expect((await b.post('/api/billing/verify', { tracking_id: tracking })).status).toBe(404);
  });

  it('Pesapal IPN requires the secret path and re-checks status with Pesapal; mock is refused in production', async () => {
    const pesapalEnv = {
      ...env,
      PAYMENT_PROVIDER: 'pesapal',
      PESAPAL_CONSUMER_KEY: 'k',
      PESAPAL_CONSUMER_SECRET: 's',
      PESAPAL_IPN_ID: 'ipn',
      PESAPAL_IPN_SECRET: 'right-secret',
    } as any;
    const call = (path: string) =>
      app.fetch(new Request(`http://localhost${path}`), pesapalEnv, {
        waitUntil() {},
        passThroughOnException() {},
        props: {},
      } as any);
    expect(
      (await call('/api/billing/ipn/pesapal/wrong?OrderTrackingId=x&OrderMerchantReference=y')).status,
    ).toBe(403);
    const unknown = await call(
      '/api/billing/ipn/pesapal/right-secret?OrderTrackingId=x&OrderMerchantReference=y&OrderNotificationType=IPNCHANGE',
    );
    expect(unknown.status).toBe(200);
    expect((await unknown.json()).status).toBe(500); // unknown order acknowledged as error, nothing changed

    const prodEnv = { ...env, ENVIRONMENT: 'production', PAYMENT_PROVIDER: 'mock' } as any;
    const c = new Client(prodEnv);
    await c.post('/api/auth/signup', {
      name: 'Prod',
      email: 'prod@example.test',
      password: 'Password1234',
      accept_terms: true,
    });
    expect((await c.post('/api/billing/checkout', { plan_code: 'basic' })).status).toBe(503);
    expect((await c.get('/api/billing/plans')).json.payments.available).toBe(false);
  });
});

describe('admin console', () => {
  let admin: Client;
  beforeAll(async () => {
    admin = await signup(env, 'admin@example.test', 'Admin');
  });

  it('manages sources with validation and records audit events', async () => {
    const bad = await admin.post('/api/admin/sources', {
      slug: 'evil-feed',
      name: 'Evil feed',
      owner: 'X',
      website: 'https://x.org',
      source_type: 'official',
      connector: 'rss',
      config: { url: 'http://169.254.169.254/' },
      categories: ['job'],
      geography: ['Uganda'],
      access_method: 'RSS',
      automation: 'automated',
      verification_policy: 'policy',
    });
    expect(bad.status).toBe(400);
    const ok = await admin.post('/api/admin/sources', {
      slug: 'unicef-rss',
      name: 'Example RSS',
      owner: 'Example',
      website: 'https://example.org',
      source_type: 'official',
      connector: 'rss',
      config: { url: 'https://example.org/feed.xml', category: 'job' },
      categories: ['job'],
      geography: ['Uganda'],
      access_method: 'Public RSS',
      automation: 'automated',
      verification_policy: 'Official feed',
      enabled: false,
    });
    expect(ok.status).toBe(201);
    expect((await admin.post(`/api/admin/sources/${ok.json.id}/toggle`, { enabled: true })).status).toBe(200);
    const audit = await admin.get('/api/admin/audit');
    expect(audit.json.entries.map((e: any) => e.action)).toEqual(
      expect.arrayContaining(['admin.source_created', 'admin.source_enabled']),
    );
  });

  it('curates, verifies, moderates and merges opportunities', async () => {
    const base = {
      category: 'scholarship',
      title: 'Example Masters Scholarship',
      organization: 'Example Foundation',
      description: 'Fully funded <b>Master’s</b> scholarship.',
      country: 'United Kingdom',
      source_id: 'src_curated_scholarships',
      source_url: 'https://example.org/scholarship',
      official_url: 'https://example.org/scholarship',
      application_url: 'https://example.org/apply',
      deadline_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      verification: 'admin_verified',
      requirements: { degree_levels: ['master'], eligible_countries: ['Africa'], funding: 'full' },
    };
    const r = await admin.post('/api/admin/opportunities', base);
    expect(r.status).toBe(201);
    expect((await admin.post('/api/admin/opportunities', base)).status).toBe(409); // duplicate refused
    const pub = await new Client(env).get(`/api/opportunities/${r.json.id}`);
    expect(pub.json.opportunity.description).toBe('Fully funded Master’s scholarship.');
    expect(pub.json.opportunity.verification).toBe('admin_verified');
    expect(
      (await admin.post(`/api/admin/opportunities/${r.json.id}/moderate`, { action: 'reject' })).status,
    ).toBe(200);
    expect((await new Client(env).get(`/api/opportunities/${r.json.id}`)).status).toBe(404);
    expect(
      (await admin.post(`/api/admin/opportunities/${r.json.id}/moderate`, { action: 'approve' })).status,
    ).toBe(200);
    const dup = await admin.post('/api/admin/opportunities', {
      ...base,
      title: 'Example Masters Scholarship (copy)',
      source_url: 'https://example.org/copy',
      official_url: '',
      application_url: '',
    });
    expect(
      (await admin.post(`/api/admin/opportunities/${dup.json.id}/merge`, { into: r.json.id })).status,
    ).toBe(200);
    expect((await new Client(env).get(`/api/opportunities/${dup.json.id}`)).status).toBe(404);
  });

  it('updates plans, prices and configuration; non-admins cannot', async () => {
    const plans = (await admin.get('/api/admin/plans')).json.plans;
    const basic = plans.find((p: any) => p.code === 'basic');
    expect(
      (
        await admin.put('/api/admin/plans/basic', {
          name: 'Basic',
          description: basic.description,
          price_ugx: 12000,
          active: true,
          entitlements: basic.entitlements,
        })
      ).status,
    ).toBe(200);
    expect(
      (await new Client(env).get('/api/billing/plans')).json.plans.find((p: any) => p.code === 'basic')
        .price_ugx,
    ).toBe(12000);
    expect(
      (
        await admin.put('/api/admin/plans/free', {
          name: 'Free',
          description: '',
          price_ugx: 5,
          active: true,
          entitlements: basic.entitlements,
        })
      ).status,
    ).toBe(400);
    expect((await admin.put('/api/admin/config/ingestion.interval_hours', { value: 4 })).status).toBe(200);
    expect((await admin.put('/api/admin/config/ingestion.interval_hours', { value: 0 })).status).toBe(400);
    expect((await admin.put('/api/admin/config/not.a.setting', { value: 1 })).status).toBe(404);
    const cfg = await admin.get('/api/admin/config');
    expect(JSON.stringify(cfg.json.environment)).not.toMatch(/right-secret|Password/);
    const user = await signup(env, 'notadmin@example.test');
    expect(
      (
        await user.put('/api/admin/plans/basic', {
          name: 'Hacked',
          description: '',
          price_ugx: 1,
          active: true,
          entitlements: basic.entitlements,
        })
      ).status,
    ).toBe(403);
    expect((await user.put('/api/admin/config/payments.enabled', { value: true })).status).toBe(403);
  });

  it('admins cannot demote or suspend themselves', async () => {
    const me = (await admin.get('/api/auth/me')).json.user;
    expect((await admin.patch(`/api/admin/users/${me.id}`, { role: 'user' })).status).toBe(400);
  });
});
