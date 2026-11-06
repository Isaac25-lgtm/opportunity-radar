import type { Env } from '../../env';
import { audit } from '../../lib/store';
import { log, newId, nowIso } from '../../lib/util';
import type { PaymentProvider, ProviderStatus } from './providers';

export type PaymentRow = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: string;
  merchant_reference: string;
  provider_tracking_id: string | null;
  amount: number;
  currency: string;
  status: string;
  completed_at: string | null;
};

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'expired', 'refunded']);

/**
 * Apply an authoritative status fetched server-side from the provider. Idempotent:
 * - duplicate notifications for the same status are recorded once (unique event key) and change nothing;
 * - a subscription is activated exactly once, only for 'completed' with matching amount/currency/reference.
 */
export async function applyProviderStatus(
  env: Env,
  payment: PaymentRow,
  st: ProviderStatus,
  source: 'ipn' | 'callback' | 'poll' | 'admin',
  now = new Date(),
): Promise<{ status: string; changed: boolean; reason?: string }> {
  const ts = nowIso(now);
  const eventKey = `${payment.provider}:${payment.provider_tracking_id}:${st.status}`;
  const ev = await env.DB.prepare(
    'INSERT OR IGNORE INTO payment_events (id, payment_id, provider, event_key, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      newId('pev'),
      payment.id,
      payment.provider,
      eventKey,
      `${source}:${st.status}`,
      JSON.stringify(st.raw).slice(0, 2000),
      ts,
    )
    .run();
  const firstTime = (ev.meta.changes ?? 0) > 0;

  if (st.status === 'completed') {
    if (payment.status === 'completed')
      return { status: 'completed', changed: false, reason: 'already_completed' };
    const mismatch =
      (st.amount !== null && Math.round(st.amount) !== payment.amount) ||
      (st.currency !== null && st.currency.toUpperCase() !== payment.currency.toUpperCase()) ||
      (st.merchantReference !== null && st.merchantReference !== payment.merchant_reference);
    if (mismatch) {
      await env.DB.prepare(
        "UPDATE payments SET status_detail = 'amount/currency/reference mismatch — manual review', updated_at = ? WHERE id = ?",
      )
        .bind(ts, payment.id)
        .run();
      await audit(env, null, 'payment.mismatch', 'payment', payment.id, {
        provider_amount: st.amount,
        expected: payment.amount,
      });
      log('warn', 'payment.mismatch', { paymentId: payment.id });
      return { status: payment.status, changed: false, reason: 'mismatch' };
    }
    // Conditional update guarantees a single activation under concurrent IPN + callback.
    const upd = await env.DB.prepare(
      `UPDATE payments SET status = 'completed', status_detail = ?, confirmation_code = ?, payment_method = ?, completed_at = ?, updated_at = ?
       WHERE id = ? AND status != 'completed'`,
    )
      .bind(st.description.slice(0, 200), st.confirmationCode, st.paymentMethod, ts, ts, payment.id)
      .run();
    if ((upd.meta.changes ?? 0) === 0)
      return { status: 'completed', changed: false, reason: 'already_completed' };
    await activateSubscription(env, payment, now);
    await audit(env, null, 'payment.completed', 'payment', payment.id, { source });
    return { status: 'completed', changed: true };
  }

  if (st.status === 'refunded') {
    const upd = await env.DB.prepare(
      "UPDATE payments SET status = 'refunded', status_detail = ?, updated_at = ? WHERE id = ? AND status != 'refunded'",
    )
      .bind(st.description.slice(0, 200), ts, payment.id)
      .run();
    if ((upd.meta.changes ?? 0) > 0) {
      await env.DB.prepare(
        "UPDATE subscriptions SET status = 'revoked', updated_at = ? WHERE payment_id = ? AND status = 'active'",
      )
        .bind(ts, payment.id)
        .run();
      await audit(env, null, 'payment.refunded', 'payment', payment.id, { source });
      return { status: 'refunded', changed: true };
    }
    return { status: 'refunded', changed: false };
  }

  if (st.status === 'pending') return { status: payment.status, changed: false };
  // failed / cancelled / expired: never downgrade a completed payment because of a late or spoofed event.
  if (TERMINAL.has(payment.status) && payment.status !== 'pending')
    return { status: payment.status, changed: false };
  await env.DB.prepare(
    'UPDATE payments SET status = ?, status_detail = ?, updated_at = ? WHERE id = ? AND status = ?',
  )
    .bind(st.status, st.description.slice(0, 200), ts, payment.id, 'pending')
    .run();
  return { status: st.status, changed: firstTime };
}

async function activateSubscription(env: Env, payment: PaymentRow, now: Date) {
  const ts = nowIso(now);
  // Extend from the end of any active period on the same plan, otherwise from now.
  const cur = await env.DB.prepare(
    "SELECT id, current_period_end FROM subscriptions WHERE user_id = ? AND plan_id = ? AND status = 'active' AND current_period_end > ? ORDER BY current_period_end DESC LIMIT 1",
  )
    .bind(payment.user_id, payment.plan_id, ts)
    .first<{ id: string; current_period_end: string }>();
  const start = cur ? new Date(cur.current_period_end) : now;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  await env.DB.prepare(
    `INSERT INTO subscriptions (id, user_id, plan_id, status, payment_id, current_period_start, current_period_end, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId('sub'),
      payment.user_id,
      payment.plan_id,
      payment.id,
      start.toISOString(),
      end.toISOString(),
      ts,
      ts,
    )
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, dedupe_key, created_at)
     VALUES (?, ?, 'system', 'Payment confirmed', 'Your subscription is active until ' || ? || '.', '/app/billing', ?, ?)`,
  )
    .bind(newId('ntf'), payment.user_id, end.toISOString().slice(0, 10), `payment:${payment.id}`, ts)
    .run();
}

export async function verifyAndApply(
  env: Env,
  provider: PaymentProvider,
  payment: PaymentRow,
  source: 'ipn' | 'callback' | 'poll' | 'admin',
) {
  if (!payment.provider_tracking_id)
    return { status: payment.status, changed: false, reason: 'no_tracking_id' };
  const st = await provider.getStatus(payment.provider_tracking_id);
  return applyProviderStatus(env, payment, st, source);
}

/** Pending checkouts older than 24h without a completed status become expired. */
export async function expireStalePayments(env: Env, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3600_000).toISOString();
  await env.DB.prepare(
    "UPDATE payments SET status = 'expired', status_detail = 'checkout not completed within 24h', updated_at = ? WHERE status = 'pending' AND created_at < ?",
  )
    .bind(nowIso(now), cutoff)
    .run();
}
