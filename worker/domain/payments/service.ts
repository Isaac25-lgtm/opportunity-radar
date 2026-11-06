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
  await env.DB.prepare(
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
  if (st.status === 'completed') {
    const mismatch =
      st.amount !== payment.amount ||
      st.currency?.toUpperCase() !== payment.currency.toUpperCase() ||
      st.merchantReference !== payment.merchant_reference;
    if (mismatch) {
      const review = await env.DB.prepare(
        "UPDATE payments SET status_detail = 'amount/currency/reference mismatch — manual review', updated_at = ? WHERE id = ? AND status NOT IN ('completed', 'refunded')",
      )
        .bind(ts, payment.id)
        .run();
      if (review.meta.changes) {
        await audit(env, null, 'payment.mismatch', 'payment', payment.id, {
          provider_amount: st.amount,
          expected: payment.amount,
        });
        log('warn', 'payment.mismatch', { paymentId: payment.id });
      }
      return { status: await currentStatus(env, payment), changed: false, reason: 'mismatch' };
    }
    if (!(await activateSubscription(env, payment, st, ts)))
      return { status: await currentStatus(env, payment), changed: false };
    await audit(env, null, 'payment.completed', 'payment', payment.id, { source });
    return { status: 'completed', changed: true };
  }

  if (st.status === 'refunded') {
    const [upd] = await env.DB.batch([
      env.DB.prepare(
        "UPDATE payments SET status = 'refunded', status_detail = ?, updated_at = ? WHERE id = ? AND status != 'refunded'",
      ).bind(st.description.slice(0, 200), ts, payment.id),
      env.DB.prepare(
        "UPDATE subscriptions SET status = 'revoked', updated_at = ? WHERE payment_id = ? AND status = 'active'",
      ).bind(ts, payment.id),
    ]);
    if ((upd.meta.changes ?? 0) > 0) {
      await audit(env, null, 'payment.refunded', 'payment', payment.id, { source });
      return { status: 'refunded', changed: true };
    }
    return { status: 'refunded', changed: false };
  }

  if (st.status === 'pending') return { status: await currentStatus(env, payment), changed: false };
  // failed / cancelled / expired: never downgrade a completed payment because of a late or spoofed event.
  const upd = await env.DB.prepare(
    'UPDATE payments SET status = ?, status_detail = ?, updated_at = ? WHERE id = ? AND status = ?',
  )
    .bind(st.status, st.description.slice(0, 200), ts, payment.id, 'pending')
    .run();
  return upd.meta.changes
    ? { status: st.status, changed: true }
    : { status: await currentStatus(env, payment), changed: false };
}

async function currentStatus(env: Env, payment: PaymentRow) {
  const row = await env.DB.prepare('SELECT status FROM payments WHERE id = ?')
    .bind(payment.id)
    .first<{ status: string }>();
  return row?.status ?? payment.status;
}

async function activateSubscription(env: Env, payment: PaymentRow, st: ProviderStatus, ts: string) {
  const subId = newId('sub');
  // Compute the renewal start inside the transaction so simultaneous purchases stack.
  // Clamp the day to the last day of the target month, preserving the UTC time.
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      `WITH period AS (
         SELECT p.id, p.user_id, p.plan_id, COALESCE((
           SELECT MAX(s.current_period_end) FROM subscriptions s
           WHERE s.user_id = p.user_id AND s.plan_id = p.plan_id AND s.status = 'active'
             AND s.current_period_end > ?2
         ), ?2) AS start_at
         FROM payments p WHERE p.id = ?3 AND p.status NOT IN ('completed', 'refunded')
       )
       INSERT INTO subscriptions (id, user_id, plan_id, status, payment_id, current_period_start, current_period_end, created_at, updated_at)
       SELECT ?1, user_id, plan_id, 'active', id, start_at,
         MIN(date(start_at, '+1 month'), date(start_at, 'start of month', '+2 months', '-1 day')) || substr(start_at, 11), ?2, ?2
       FROM period`,
    ).bind(subId, ts, payment.id),
    env.DB.prepare(
      `UPDATE payments SET status = 'completed', status_detail = ?, confirmation_code = ?, payment_method = ?, completed_at = ?, updated_at = ?
       WHERE id = ? AND EXISTS (SELECT 1 FROM subscriptions WHERE id = ?)`,
    ).bind(st.description.slice(0, 200), st.confirmationCode, st.paymentMethod, ts, ts, payment.id, subId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, dedupe_key, created_at)
       SELECT ?, user_id, 'system', 'Payment confirmed', 'Your subscription is active until ' || substr(current_period_end, 1, 10) || '.', '/app/billing', ?, ?
       FROM subscriptions WHERE id = ?`,
    ).bind(newId('ntf'), `payment:${payment.id}`, ts, subId),
  ]);
  return Boolean(inserted.meta.changes);
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
