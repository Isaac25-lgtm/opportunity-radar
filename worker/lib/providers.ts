import type { Env } from '../env';
import { isProduction } from '../env';
import { parseCvText, type ParseResult } from '../../shared/cvParser';
import { log } from './util';

/* =================== Email =================== */
export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type EmailResult = {
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string;
  error?: string;
  provider: string;
};

export interface EmailProvider {
  name: string;
  configured: boolean;
  send(msg: EmailMessage): Promise<EmailResult>;
}

class DisabledEmail implements EmailProvider {
  name = 'none';
  configured = false;
  async send(): Promise<EmailResult> {
    return { status: 'skipped', provider: this.name, error: 'Email provider not configured' };
  }
}

class SendGridEmail implements EmailProvider {
  name = 'sendgrid';
  configured = true;
  constructor(
    private key: string,
    private from: string,
  ) {}
  async send(msg: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: msg.to }] }],
          from: { email: this.from, name: 'Opportunity Radar' },
          subject: msg.subject,
          content: [
            { type: 'text/plain', value: msg.text },
            ...(msg.html ? [{ type: 'text/html', value: msg.html }] : []),
          ],
        }),
      });
      if (res.status >= 200 && res.status < 300)
        return {
          status: 'sent',
          provider: this.name,
          providerMessageId: res.headers.get('x-message-id') ?? undefined,
        };
      return { status: 'failed', provider: this.name, error: `SendGrid HTTP ${res.status}` };
    } catch (e) {
      return { status: 'failed', provider: this.name, error: (e as Error).message.slice(0, 200) };
    }
  }
}

class ResendEmail implements EmailProvider {
  name = 'resend';
  configured = true;
  constructor(
    private key: string,
    private from: string,
  ) {}
  async send(msg: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      if (res.ok) return { status: 'sent', provider: this.name, providerMessageId: j.id };
      return { status: 'failed', provider: this.name, error: `Resend HTTP ${res.status}` };
    } catch (e) {
      return { status: 'failed', provider: this.name, error: (e as Error).message.slice(0, 200) };
    }
  }
}

export function emailProvider(env: Env): EmailProvider {
  const p = (env.EMAIL_PROVIDER ?? 'none').toLowerCase();
  if (p === 'sendgrid' && env.EMAIL_API_KEY && env.EMAIL_FROM)
    return new SendGridEmail(env.EMAIL_API_KEY, env.EMAIL_FROM);
  if (p === 'resend' && env.EMAIL_API_KEY && env.EMAIL_FROM)
    return new ResendEmail(env.EMAIL_API_KEY, env.EMAIL_FROM);
  return new DisabledEmail();
}

/* =================== AI =================== */
/**
 * AI provider abstraction. AI integration is deferred: with AI_PROVIDER=none (default) every capability
 * uses a deterministic, non-generative fallback that only reuses the user's own text.
 * A model-backed provider must validate output with the same zod schemas before anything is saved.
 */
export interface AiProvider {
  name: string;
  enabled: boolean;
  extractCv(text: string): Promise<ParseResult>;
}

class NoAi implements AiProvider {
  name = 'none';
  enabled = false;
  async extractCv(text: string): Promise<ParseResult> {
    return parseCvText(text);
  }
}

export function aiProvider(env: Env): AiProvider {
  const p = (env.AI_PROVIDER ?? 'none').toLowerCase();
  if (p !== 'none') log('warn', 'ai.provider_not_implemented', { provider: p });
  return new NoAi();
}

/* =================== Document storage =================== */
/**
 * Private object storage. Backed by a KV namespace that is only reachable through this Worker's binding
 * (no public URL exists). Swap for R2 by implementing the same interface.
 */
export interface DocumentStore {
  put(key: string, bytes: ArrayBuffer, meta: { mime: string }): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export function documentStore(env: Env): DocumentStore {
  return {
    async put(key, bytes, meta) {
      await env.DOCS.put(key, bytes, { metadata: meta });
    },
    async get(key) {
      return env.DOCS.get(key, 'arrayBuffer');
    },
    async delete(key) {
      await env.DOCS.delete(key);
    },
  };
}

/* =================== Environment validation =================== */
export type EnvCheck = { name: string; required: boolean; present: boolean; purpose: string };

export function checkEnv(env: Env): EnvCheck[] {
  const prod = isProduction(env);
  const has = (v?: string) => typeof v === 'string' && v.length > 0;
  const pay = (env.PAYMENT_PROVIDER ?? 'none').toLowerCase();
  const mail = (env.EMAIL_PROVIDER ?? 'none').toLowerCase();
  return [
    { name: 'DB (D1 binding)', required: true, present: !!env.DB, purpose: 'Primary database' },
    { name: 'DOCS (KV binding)', required: true, present: !!env.DOCS, purpose: 'Private document storage' },
    {
      name: 'APP_URL',
      required: prod,
      present: has(env.APP_URL),
      purpose: 'Absolute links in emails and payment callbacks',
    },
    ...(!prod
      ? [
          {
            name: 'ADMIN_EMAILS',
            required: false,
            present: has(env.ADMIN_EMAILS),
            purpose: 'Bootstrap local administrator accounts',
          },
        ]
      : []),
    {
      name: 'EMAIL_PROVIDER',
      required: false,
      present: mail !== 'none',
      purpose: 'Email alerts (sendgrid | resend)',
    },
    {
      name: 'EMAIL_API_KEY',
      required: mail !== 'none',
      present: has(env.EMAIL_API_KEY),
      purpose: 'Email provider key',
    },
    {
      name: 'EMAIL_FROM',
      required: mail !== 'none',
      present: has(env.EMAIL_FROM),
      purpose: 'Verified sender address',
    },
    {
      name: 'PAYMENT_PROVIDER',
      required: false,
      present: pay !== 'none',
      purpose: 'Payments (pesapal | mock in dev)',
    },
    {
      name: 'PESAPAL_CONSUMER_KEY',
      required: pay === 'pesapal',
      present: has(env.PESAPAL_CONSUMER_KEY),
      purpose: 'Pesapal merchant key',
    },
    {
      name: 'PESAPAL_CONSUMER_SECRET',
      required: pay === 'pesapal',
      present: has(env.PESAPAL_CONSUMER_SECRET),
      purpose: 'Pesapal merchant secret',
    },
    {
      name: 'PESAPAL_IPN_ID',
      required: pay === 'pesapal',
      present: has(env.PESAPAL_IPN_ID),
      purpose: 'Registered IPN id',
    },
    {
      name: 'PESAPAL_IPN_SECRET',
      required: pay === 'pesapal',
      present: has(env.PESAPAL_IPN_SECRET),
      purpose: 'Secret path segment for the IPN URL',
    },
    {
      name: 'RELIEFWEB_APPNAME',
      required: false,
      present: has(env.RELIEFWEB_APPNAME),
      purpose: 'ReliefWeb API (approved appname)',
    },
    {
      name: 'AI_PROVIDER',
      required: false,
      present: (env.AI_PROVIDER ?? 'none') !== 'none',
      purpose: 'AI assistance (deferred)',
    },
  ];
}
