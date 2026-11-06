import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { isProduction } from '../env';
import { sha256Hex } from './crypto';
import { HttpError, tooMany } from './http';

/**
 * CSRF defence for cookie-authenticated JSON APIs: state-changing requests must carry a custom header
 * (cannot be set cross-site without a CORS preflight, which we never grant) and, when present, an Origin
 * that matches this host. Provider callbacks are exempt and verified server-side instead.
 */
const CSRF_EXEMPT = [/^\/api\/billing\/ipn\//, /^\/api\/health$/];

export const csrfMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  const path = new URL(c.req.url).pathname;
  if (CSRF_EXEMPT.some((r) => r.test(path))) return next();
  if (c.req.header('x-or-csrf') !== '1') throw new HttpError(403, 'csrf', 'Missing request header.');
  const origin = c.req.header('origin');
  if (origin) {
    const self = new URL(c.req.url);
    let ok = false;
    try {
      const o = new URL(origin);
      ok = o.host === self.host || (!isProduction(c.env) && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(o.host));
    } catch {
      ok = false;
    }
    if (!ok) throw new HttpError(403, 'csrf', 'Cross-site request refused.');
  }
  return next();
};

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  if (isProduction(c.env)) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
};

export async function clientKey(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
  return (await sha256Hex(`ip:${ip}`)).slice(0, 24);
}

/** Fixed-window limiter stored in D1. */
export async function rateLimit(
  c: Context<AppEnv>,
  action: string,
  limit: number,
  windowSec: number,
  subject?: string,
) {
  const who = subject ?? (await clientKey(c));
  const key = `${action}:${who}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > limit) throw tooMany();
}
