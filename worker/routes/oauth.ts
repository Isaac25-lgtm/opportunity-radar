/**
 * "Continue with Google" (OpenID Connect, authorization-code flow with PKCE).
 *
 * Off until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set; the redirect URI to register with Google is
 * `${APP_URL}/api/auth/google/callback`. Security:
 * - `state` and the PKCE verifier live in a short-lived HttpOnly cookie and must match on return;
 * - the code is exchanged server-side with the client secret; the ID token comes straight from Google over TLS,
 *   and its issuer, audience and expiry are checked;
 * - only Google-verified email addresses are accepted, so linking to an existing account by email is safe.
 */
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, Env } from '../env';
import { isProduction } from '../env';
import { safeNext } from '../../shared/redirect';
import { createSession, isBootstrapAdmin } from '../lib/auth';
import { fromB64url, randomToken, toB64url } from '../lib/crypto';
import { rateLimit } from '../lib/security';
import { audit } from '../lib/store';
import { log, newId, nowIso } from '../lib/util';

export const oauthRoutes = new Hono<AppEnv>();

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const FLOW_COOKIE = 'or_oauth';
const FLOW_MINUTES = 10;

export const googleConfigured = (env: Env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

const appUrl = (c: Context<AppEnv>) => c.env.APP_URL ?? new URL(c.req.url).origin;
const redirectUri = (c: Context<AppEnv>) => `${appUrl(c)}/api/auth/google/callback`;
const fail = (c: Context<AppEnv>, reason: string) => c.redirect(`/signin?error=google_${reason}`, 302);

type Flow = { s: string; v: string; n: string };
const encodeFlow = (f: Flow) => toB64url(new TextEncoder().encode(JSON.stringify(f)));
function decodeFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(new TextDecoder().decode(fromB64url(raw)));
    return typeof f?.s === 'string' && typeof f?.v === 'string' && typeof f?.n === 'string' ? f : null;
  } catch {
    return null;
  }
}

async function codeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toB64url(new Uint8Array(digest));
}

/** Claims from an ID token received directly from Google's token endpoint over TLS (OIDC Core 3.1.3.7). */
function idTokenClaims(idToken: string, clientId: string, now = Date.now()) {
  const part = idToken.split('.')[1];
  if (!part) return null;
  let claims: any;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromB64url(part)));
  } catch {
    return null;
  }
  const audOk = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  if (!ISSUERS.has(claims.iss) || !audOk || typeof claims.exp !== 'number' || claims.exp * 1000 < now)
    return null;
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
  return {
    sub: claims.sub as string,
    email: (claims.email as string).trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 120) : '',
  };
}

/** Which external sign-in methods are switched on (the sign-in page shows the rest as "coming soon"). */
oauthRoutes.get('/providers', (c) => c.json({ google: googleConfigured(c.env) }));

oauthRoutes.get('/google/start', async (c) => {
  if (!googleConfigured(c.env)) return fail(c, 'unavailable');
  await rateLimit(c, 'oauth-start', 30, 900);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const next = safeNext(c.req.query('next'), '/app');
  setCookie(c, FLOW_COOKIE, encodeFlow({ s: state, v: verifier, n: next }), {
    httpOnly: true,
    secure: isProduction(c.env) || new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax', // must survive the top-level redirect back from Google
    path: '/api/auth/google',
    maxAge: FLOW_MINUTES * 60,
  });
  const qs = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(c),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return c.redirect(`${AUTH_URL}?${qs}`, 302);
});

oauthRoutes.get('/google/callback', async (c) => {
  if (!googleConfigured(c.env)) return fail(c, 'unavailable');
  await rateLimit(c, 'oauth-callback', 30, 900);
  const flow = decodeFlow(getCookie(c, FLOW_COOKIE));
  deleteCookie(c, FLOW_COOKIE, { path: '/api/auth/google' });
  const code = c.req.query('code');
  if (c.req.query('error')) return fail(c, 'cancelled');
  if (!flow || !code || c.req.query('state') !== flow.s) return fail(c, 'failed');

  let claims: ReturnType<typeof idTokenClaims> = null;
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID!,
        client_secret: c.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(c),
        grant_type: 'authorization_code',
        code_verifier: flow.v,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await res.json().catch(() => null);
    if (res.ok && typeof j?.id_token === 'string')
      claims = idTokenClaims(j.id_token, c.env.GOOGLE_CLIENT_ID!);
    else log('warn', 'oauth.google.token_failed', { status: res.status, error: String(j?.error ?? '') });
  } catch (e) {
    log('warn', 'oauth.google.token_error', { error: (e as Error).message.slice(0, 200) });
  }
  if (!claims) return fail(c, 'failed');
  if (!claims.emailVerified) return fail(c, 'unverified');

  const ts = nowIso();
  const linked = await c.env.DB.prepare(
    "SELECT u.id, u.status FROM user_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = 'google' AND i.subject = ?",
  )
    .bind(claims.sub)
    .first<{ id: string; status: string }>();
  let userId: string;
  let isNew = false;
  if (linked) {
    if (linked.status !== 'active') return fail(c, 'failed');
    userId = linked.id;
    await c.env.DB.prepare(
      "UPDATE user_identities SET last_used_at = ?, email = ? WHERE provider = 'google' AND subject = ?",
    )
      .bind(ts, claims.email, claims.sub)
      .run();
  } else {
    const existing = await c.env.DB.prepare('SELECT id, status FROM users WHERE email = ?')
      .bind(claims.email)
      .first<{ id: string; status: string }>();
    if (existing) {
      if (existing.status !== 'active') return fail(c, 'failed');
      userId = existing.id; // Google has verified this address, so it is the same person
      await audit(c.env, userId, 'user.identity_linked', 'user', userId, { provider: 'google' });
    } else {
      userId = newId('usr');
      isNew = true;
      const role = isBootstrapAdmin(c.env, claims.email) ? 'admin' : 'user';
      const name = claims.name || claims.email.split('@')[0];
      await c.env.DB.batch([
        // No usable password: password sign-in stays closed until the person sets one.
        c.env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(userId, claims.email, `oauth$${randomToken(16)}`, name, role, ts, ts),
        c.env.DB.prepare('INSERT INTO notification_prefs (user_id, updated_at) VALUES (?, ?)').bind(
          userId,
          ts,
        ),
      ]);
      await audit(c.env, userId, 'user.signup', 'user', userId, { role, method: 'google' });
    }
    await c.env.DB.prepare(
      "INSERT INTO user_identities (provider, subject, user_id, email, created_at, last_used_at) VALUES ('google', ?, ?, ?, ?, ?)",
    )
      .bind(claims.sub, userId, claims.email, ts, ts)
      .run();
  }
  await createSession(c, userId);
  return c.redirect(isNew ? '/app/onboarding' : safeNext(flow.n, '/app'), 302);
});
