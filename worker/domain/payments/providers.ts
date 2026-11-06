import type { Env } from '../../env';
import { isProduction } from '../../env';
import { nowIso } from '../../lib/util';

export type NormalizedPaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type ProviderStatus = {
  status: NormalizedPaymentStatus;
  amount: number | null;
  currency: string | null;
  merchantReference: string | null;
  confirmationCode: string | null;
  paymentMethod: string | null;
  description: string;
  raw: Record<string, unknown>;
};

export type CheckoutRequest = {
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  email: string;
  name: string;
};

export interface PaymentProvider {
  name: string;
  live: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string; trackingId: string }>;
  /** Authoritative, server-to-server status lookup. The only input that may activate a subscription. */
  getStatus(trackingId: string): Promise<ProviderStatus>;
}

/* ============ Pesapal API 3.0 ============ */
export function mapPesapalStatus(code: unknown, description: unknown): NormalizedPaymentStatus {
  const d = String(description ?? '').toLowerCase();
  const c = Number(code);
  if (c === 1 || d === 'completed') return 'completed';
  if (c === 3 || d === 'reversed') return 'refunded';
  if (c === 2 || d === 'failed') return 'failed';
  if (d === 'invalid') return 'failed';
  if (d.includes('cancel')) return 'cancelled';
  return 'pending';
}

export class PesapalProvider implements PaymentProvider {
  name = 'pesapal';
  live: boolean;
  private base: string;
  private token: { value: string; exp: number } | null = null;
  constructor(
    private key: string,
    private secret: string,
    private ipnId: string,
    env: 'sandbox' | 'live',
    private fetcher: typeof fetch = fetch,
  ) {
    this.live = env === 'live';
    this.base = this.live ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3';
  }

  private async auth(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 30_000) return this.token.value;
    const res = await this.fetcher(`${this.base}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumer_key: this.key, consumer_secret: this.secret }),
    });
    const j = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !j.token)
      throw new Error(`Pesapal auth failed (${res.status}${j?.error?.code ? ` ${j.error.code}` : ''})`);
    this.token = { value: j.token, exp: Date.parse(j.expiryDate ?? '') || Date.now() + 4 * 60_000 };
    return j.token;
  }

  async createCheckout(req: CheckoutRequest) {
    const token = await this.auth();
    const [first, ...rest] = req.name.split(' ');
    const res = await this.fetcher(`${this.base}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: req.merchantReference,
        currency: req.currency,
        amount: req.amount,
        description: req.description.slice(0, 100),
        callback_url: req.callbackUrl,
        notification_id: this.ipnId,
        billing_address: { email_address: req.email, first_name: first ?? '', last_name: rest.join(' ') },
      }),
    });
    const j = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !j.order_tracking_id || !j.redirect_url)
      throw new Error(`Pesapal order failed (${res.status}${j?.error?.code ? ` ${j.error.code}` : ''})`);
    return { redirectUrl: String(j.redirect_url), trackingId: String(j.order_tracking_id) };
  }

  async getStatus(trackingId: string): Promise<ProviderStatus> {
    const token = await this.auth();
    const res = await this.fetcher(
      `${this.base}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
      {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      },
    );
    const j = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(`Pesapal status failed (${res.status})`);
    return {
      status: mapPesapalStatus(j.status_code, j.payment_status_description),
      amount: typeof j.amount === 'number' ? j.amount : j.amount ? Number(j.amount) : null,
      currency: j.currency ? String(j.currency) : null,
      merchantReference: j.merchant_reference ? String(j.merchant_reference) : null,
      confirmationCode: j.confirmation_code ? String(j.confirmation_code) : null,
      paymentMethod: j.payment_method ? String(j.payment_method) : null,
      description: String(j.payment_status_description ?? ''),
      raw: {
        status_code: j.status_code,
        description: j.payment_status_description,
        created_date: j.created_date,
      },
    };
  }
}

/* ============ Mock provider (development and automated tests only) ============ */
export class MockProvider implements PaymentProvider {
  name = 'mock';
  live = false;
  constructor(
    private env: Env,
    private appUrl: string,
  ) {}
  async createCheckout(req: CheckoutRequest) {
    const trackingId = `mock_${crypto.randomUUID()}`;
    await this.env.DB.prepare(
      'INSERT INTO mock_payments (tracking_id, merchant_reference, amount, currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(trackingId, req.merchantReference, req.amount, req.currency, 'pending', nowIso())
      .run();
    return { redirectUrl: `${this.appUrl}/mock-checkout/${trackingId}`, trackingId };
  }
  async getStatus(trackingId: string): Promise<ProviderStatus> {
    const r = await this.env.DB.prepare('SELECT * FROM mock_payments WHERE tracking_id = ?')
      .bind(trackingId)
      .first<any>();
    if (!r) throw new Error('Unknown mock transaction');
    return {
      status: r.status as NormalizedPaymentStatus,
      amount: r.amount,
      currency: r.currency,
      merchantReference: r.merchant_reference,
      confirmationCode: r.status === 'completed' ? `MOCK-${trackingId.slice(-6)}` : null,
      paymentMethod: 'Mock',
      description: r.status,
      raw: { mock: true },
    };
  }
}

export function paymentProvider(env: Env, appUrl: string): PaymentProvider | null {
  const p = (env.PAYMENT_PROVIDER ?? 'none').toLowerCase();
  if (p === 'pesapal') {
    if (!env.PESAPAL_CONSUMER_KEY || !env.PESAPAL_CONSUMER_SECRET || !env.PESAPAL_IPN_ID) return null;
    return new PesapalProvider(
      env.PESAPAL_CONSUMER_KEY,
      env.PESAPAL_CONSUMER_SECRET,
      env.PESAPAL_IPN_ID,
      env.PESAPAL_ENV === 'live' ? 'live' : 'sandbox',
    );
  }
  if (p === 'mock' && !isProduction(env)) return new MockProvider(env, appUrl);
  return null;
}
