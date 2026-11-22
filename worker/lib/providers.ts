import type { Env } from '../env';
import { isProduction } from '../env';
import { z } from 'zod';
import { parseCvText, type ParseResult } from '../../shared/cvParser';
import { cvDataSchema, rid, type CvData } from '../../shared/cv';
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
 * AI provider abstraction. With AI_PROVIDER=none (the default) every capability uses a deterministic,
 * non-generative fallback that only reuses the user's own text.
 *
 * AI_PROVIDER=python sends the work to the separate Python AI service (ai-service/), which calls Claude
 * and removes anything it cannot trace back to the user's own text. Its answers are validated again here
 * with the app's zod schemas, and any failure (down, slow, refused, malformed) falls back to the
 * built-in tools, so AI is never required for the app to work.
 */
export type CoverLetterOpportunity = {
  title: string;
  organization: string;
  reference_no?: string | null;
  description: string;
  requirements: unknown;
};

export interface AiProvider {
  name: string;
  enabled: boolean;
  extractCv(text: string): Promise<ParseResult>;
  /** An AI-written cover letter, or null to use the built-in draft. */
  coverLetter(cv: CvData, opp: CoverLetterOpportunity): Promise<string | null>;
}

class NoAi implements AiProvider {
  name = 'none';
  enabled = false;
  async extractCv(text: string): Promise<ParseResult> {
    return parseCvText(text);
  }
  async coverLetter(): Promise<string | null> {
    return null;
  }
}

const LIST_SECTIONS = [
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'publications',
  'awards',
  'memberships',
] as const;

const aiParseResponse = z.object({
  data: z.record(z.string(), z.unknown()),
  found: z.array(z.string().max(40)).max(20).default([]),
  unassigned: z.array(z.string().max(300)).max(40).default([]),
});
const aiLetterResponse = z.object({ body: z.string().min(1).max(10000) });

/** Give every list item an id, then validate against the CV schema. Null when it does not fit. */
export function cvFromAi(data: Record<string, unknown>): CvData | null {
  const withIds: Record<string, unknown> = { ...data };
  for (const key of LIST_SECTIONS) {
    const items = data[key];
    withIds[key] = Array.isArray(items)
      ? items.filter((i) => i && typeof i === 'object').map((i) => ({ ...(i as object), id: rid() }))
      : [];
  }
  const parsed = cvDataSchema.safeParse(withIds);
  return parsed.success ? parsed.data : null;
}

export class PythonAi implements AiProvider {
  name = 'python';
  enabled = true;
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
    private readonly timeoutMs = 45000,
  ) {}

  private async call<T>(path: string, payload: unknown, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const res = await this.fetcher(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        log('warn', 'ai.call_failed', { path, status: res.status });
        return null;
      }
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) {
        log('warn', 'ai.bad_response', { path });
        return null;
      }
      return parsed.data;
    } catch (e) {
      log('warn', 'ai.unreachable', { path, error: String(e).slice(0, 200) });
      return null;
    }
  }

  async extractCv(text: string): Promise<ParseResult> {
    const r = await this.call('/v1/cv/parse', { text }, aiParseResponse);
    const data = r && cvFromAi(r.data);
    if (!r || !data) return parseCvText(text);
    return { data, found: r.found, unassigned: r.unassigned, method: 'ai' };
  }

  async coverLetter(cv: CvData, opp: CoverLetterOpportunity): Promise<string | null> {
    const r = await this.call(
      '/v1/cover-letter',
      {
        cv,
        opportunity: {
          title: opp.title.slice(0, 300),
          organization: opp.organization.slice(0, 300),
          reference_no: opp.reference_no ? opp.reference_no.slice(0, 120) : null,
          description: (opp.description ?? '').slice(0, 20000),
          requirements: opp.requirements && typeof opp.requirements === 'object' ? opp.requirements : {},
        },
      },
      aiLetterResponse,
    );
    return r?.body ?? null;
  }
}

/** The service URL must be https in production; plain http is accepted for local development. */
function aiServiceUrl(env: Env): string | null {
  const url = (env.AI_SERVICE_URL ?? '').trim();
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (!isProduction(env) && /^http:\/\//i.test(url)) return url;
  return null;
}

export function aiProvider(env: Env): AiProvider {
  const p = (env.AI_PROVIDER ?? 'none').toLowerCase();
  if (p === 'python') {
    const url = aiServiceUrl(env);
    if (url && env.AI_SERVICE_TOKEN) return new PythonAi(url, env.AI_SERVICE_TOKEN);
    log('warn', 'ai.not_configured', { provider: p });
  } else if (p !== 'none') log('warn', 'ai.provider_not_implemented', { provider: p });
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
  const ai = (env.AI_PROVIDER ?? 'none').toLowerCase();
  return [
    { name: 'DB (D1 binding)', required: true, present: !!env.DB, purpose: 'Primary database' },
    { name: 'DOCS (KV binding)', required: true, present: !!env.DOCS, purpose: 'Private document storage' },
    {
      name: 'GOOGLE_CLIENT_ID',
      required: has(env.GOOGLE_CLIENT_SECRET),
      present: has(env.GOOGLE_CLIENT_ID),
      purpose: 'Google sign-in client',
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      required: has(env.GOOGLE_CLIENT_ID),
      present: has(env.GOOGLE_CLIENT_SECRET),
      purpose: 'Google sign-in client secret',
    },
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
      name: 'DEEPSEEK_API_KEY',
      required: false,
      present: has(env.DEEPSEEK_API_KEY),
      purpose: 'Ask Opportunity Radar assistant (DeepSeek)',
    },
    {
      name: 'AI_PROVIDER',
      required: false,
      present: ai !== 'none',
      purpose: 'AI assistance (none | python)',
    },
    {
      name: 'AI_SERVICE_URL',
      required: ai === 'python',
      present: has(env.AI_SERVICE_URL),
      purpose: 'Python AI service address (https)',
    },
    {
      name: 'AI_SERVICE_TOKEN',
      required: ai === 'python',
      present: has(env.AI_SERVICE_TOKEN),
      purpose: 'Shared secret for the Python AI service',
    },
  ];
}
