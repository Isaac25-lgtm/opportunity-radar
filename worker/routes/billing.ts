import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { isProduction } from '../env';
import { requireUser } from '../lib/auth';
import { safeEqualStrings } from '../lib/crypto';
import { HttpError, badRequest, body, forbidden, notFound } from '../lib/http';
import { rateLimit } from '../lib/security';
import { audit, getConfig, usage, userPlan } from '../lib/store';
import { log, newId, nowIso, parseJson } from '../lib/util';
import { paymentProvider } from '../domain/payments/providers';
import { verifyAndApply, type PaymentRow } from '../domain/payments/service';

export const billingRoutes = new Hono<AppEnv>();

const appUrl = (c: any) => c.env.APP_URL ?? new URL(c.req.url).origin;

billingRoutes.get('/plans', async (c) => {
  const rows = (
    await c.env.DB.prepare(
      'SELECT code, name, description, price_ugx, interval, entitlements, sort FROM plans WHERE active = 1 ORDER BY sort',
    ).all<any>()
  ).results;
  const provider = paymentProvider(c.env, appUrl(c));
  const enabled = await getConfig(c.env, 'payments.enabled', false);
  return c.json({
    plans: rows.map((r) => ({ ...r, entitlements: parseJson(r.entitlements, {}) })),
    payments: {
      provider: provider?.name ?? 'none',
      live: !!provider?.live,
      available: !!provider && (enabled === true || provider.name === 'mock'),
      note: !provider
        ? 'Online payments are not yet activated.'
        : provider.name === 'mock'
          ? 'Development payment simulator — no real money is charged.'
          : provider.live
            ? 'Payments are processed by Pesapal.'
            : 'Pesapal sandbox (test mode) — no real money is charged.',
    },
  });
});

billingRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const plan = await userPlan(c.env, u.id);
  const payments = (
    await c.env.DB.prepare(
      'SELECT p.merchant_reference, p.amount, p.currency, p.status, p.status_detail, p.provider, p.created_at, p.completed_at, pl.name AS plan_name FROM payments p JOIN plans pl ON pl.id = p.plan_id WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 50',
    )
      .bind(u.id)
      .all()
  ).results;
  const counts = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM profiles WHERE user_id = ?1 AND deleted_at IS NULL) AS profiles,
            (SELECT COUNT(*) FROM cvs WHERE user_id = ?1 AND deleted_at IS NULL) AS cvs,
            (SELECT COUNT(*) FROM documents WHERE user_id = ?1 AND deleted_at IS NULL) AS documents,
            (SELECT COUNT(*) FROM applications WHERE user_id = ?1 AND deleted_at IS NULL) AS tracked`,
  )
    .bind(u.id)
    .first<any>();
  return c.json({ plan, payments, usage: { ...counts, cv_exports: await usage(c.env, u.id, 'cv_export') } });
});

billingRoutes.post('/checkout', async (c) => {
  const u = requireUser(c);
  await rateLimit(c, 'checkout', 10, 3600, u.id);
  const { plan_code } = await body(c, z.object({ plan_code: z.string().max(30) }));
  const plan = await c.env.DB.prepare(
    'SELECT id, code, name, price_ugx FROM plans WHERE code = ? AND active = 1',
  )
    .bind(plan_code)
    .first<any>();
  if (!plan || plan.price_ugx <= 0) throw badRequest('Choose a paid plan.');
  const provider = paymentProvider(c.env, appUrl(c));
  const enabled = await getConfig(c.env, 'payments.enabled', false);
  if (!provider || (provider.name !== 'mock' && enabled !== true))
    throw new HttpError(
      503,
      'payments_unavailable',
      'Online payments are not yet activated. Please check back soon.',
    );
  const ref = `OR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const id = newId('pay');
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO payments (id, user_id, plan_id, provider, merchant_reference, amount, currency, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'UGX', 'pending', ?, ?)`,
  )
    .bind(id, u.id, plan.id, provider.name, ref, plan.price_ugx, ts, ts)
    .run();
  try {
    const res = await provider.createCheckout({
      merchantReference: ref,
      amount: plan.price_ugx,
      currency: 'UGX',
      description: `Opportunity Radar ${plan.name} — 1 month`,
      callbackUrl: `${appUrl(c)}/app/billing/return`,
      email: u.email,
      name: u.name,
    });
    await c.env.DB.prepare('UPDATE payments SET provider_tracking_id = ?, updated_at = ? WHERE id = ?')
      .bind(res.trackingId, nowIso(), id)
      .run();
    await audit(c.env, u.id, 'payment.checkout_started', 'payment', id, {
      plan: plan.code,
      provider: provider.name,
    });
    return c.json({ redirect_url: res.redirectUrl, merchant_reference: ref });
  } catch (e) {
    await c.env.DB.prepare(
      "UPDATE payments SET status = 'failed', status_detail = ?, updated_at = ? WHERE id = ?",
    )
      .bind('checkout could not be created', nowIso(), id)
      .run();
    log('error', 'payment.checkout_failed', {
      provider: provider.name,
      error: (e as Error).message.slice(0, 200),
    });
    throw new HttpError(
      502,
      'payment_provider_error',
      'The payment provider could not start checkout. Please try again.',
    );
  }
});

/** Browser return: never trusted by itself — we query the provider server-side before changing anything. */
billingRoutes.post('/verify', async (c) => {
  const u = requireUser(c);
  const input = await body(
    c,
    z.object({
      tracking_id: z.string().max(120).optional(),
      merchant_reference: z.string().max(120).optional(),
    }),
  );
  const p = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE user_id = ? AND (provider_tracking_id = ? OR merchant_reference = ?)',
  )
    .bind(u.id, input.tracking_id ?? '', input.merchant_reference ?? '')
    .first<PaymentRow>();
  if (!p) throw notFound('Payment not found.');
  const provider = paymentProvider(c.env, appUrl(c));
  if (!provider || provider.name !== p.provider) return c.json({ status: p.status });
  const result = await verifyAndApply(c.env, provider, p, 'callback');
  return c.json({ status: result.status });
});

/**
 * Pesapal IPN. Pesapal does not sign IPNs, so: (1) the URL carries a secret path segment, and (2) the
 * notification is only a hint — status is always re-fetched from Pesapal with our credentials.
 */
async function handleIpn(c: any) {
  const secret = c.env.PESAPAL_IPN_SECRET;
  if (!secret || !safeEqualStrings(c.req.param('secret') ?? '', secret))
    throw forbidden('Invalid notification endpoint.');
  let trackingId = c.req.query('OrderTrackingId');
  let ref = c.req.query('OrderMerchantReference');
  let type = c.req.query('OrderNotificationType');
  if (c.req.method === 'POST') {
    const j = (await c.req.json().catch(() => ({}))) as any;
    trackingId ??= j.OrderTrackingId;
    ref ??= j.OrderMerchantReference;
    type ??= j.OrderNotificationType;
  }
  if (!trackingId || !ref) throw badRequest('Missing order identifiers.');
  const p = await c.env.DB.prepare(
    "SELECT * FROM payments WHERE provider = 'pesapal' AND provider_tracking_id = ? AND merchant_reference = ?",
  )
    .bind(String(trackingId), String(ref))
    .first();
  const ack = {
    orderNotificationType: type ?? 'IPNCHANGE',
    orderTrackingId: trackingId,
    orderMerchantReference: ref,
    status: 200,
  };
  if (!p) return c.json({ ...ack, status: 500 });
  const provider = paymentProvider(c.env, appUrl(c));
  if (!provider || provider.name !== 'pesapal') return c.json({ ...ack, status: 500 });
  try {
    await verifyAndApply(c.env, provider, p as PaymentRow, 'ipn');
    return c.json(ack);
  } catch (e) {
    log('error', 'payment.ipn_failed', { error: (e as Error).message.slice(0, 200) });
    return c.json({ ...ack, status: 500 });
  }
}
billingRoutes.get('/ipn/pesapal/:secret', handleIpn);
billingRoutes.post('/ipn/pesapal/:secret', handleIpn);

/* ---------- Development payment simulator (refused in production) ---------- */
billingRoutes.get('/mock/:tracking', async (c) => {
  if (isProduction(c.env)) throw notFound();
  const u = requireUser(c);
  const r = await c.env.DB.prepare(
    'SELECT m.tracking_id, m.amount, m.currency, m.status, pl.name AS plan_name FROM mock_payments m JOIN payments p ON p.provider_tracking_id = m.tracking_id JOIN plans pl ON pl.id = p.plan_id WHERE m.tracking_id = ? AND p.user_id = ?',
  )
    .bind(c.req.param('tracking'), u.id)
    .first();
  if (!r) throw notFound();
  return c.json({ payment: r });
});
billingRoutes.post('/mock/:tracking', async (c) => {
  if (isProduction(c.env)) throw notFound();
  const u = requireUser(c);
  const { outcome } = await body(
    c,
    z.object({ outcome: z.enum(['completed', 'failed', 'cancelled', 'refunded']) }),
  );
  const own = await c.env.DB.prepare(
    'SELECT p.* FROM payments p WHERE p.provider_tracking_id = ? AND p.user_id = ?',
  )
    .bind(c.req.param('tracking'), u.id)
    .first<PaymentRow>();
  if (!own) throw notFound();
  await c.env.DB.prepare('UPDATE mock_payments SET status = ? WHERE tracking_id = ?')
    .bind(outcome, c.req.param('tracking'))
    .run();
  return c.json({
    ok: true,
    return_url: `/app/billing/return?OrderTrackingId=${encodeURIComponent(own.provider_tracking_id ?? '')}&OrderMerchantReference=${encodeURIComponent(own.merchant_reference)}`,
  });
});
