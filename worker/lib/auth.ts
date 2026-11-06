import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, AppUser, Env } from '../env';
import { isProduction } from '../env';
import { randomToken, sha256Hex } from './crypto';
import { forbidden, unauthorized } from './http';
import { nowIso } from './util';

export const SESSION_COOKIE = 'or_session';
const SESSION_DAYS = 30;

export async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      id,
      userId,
      nowIso(now),
      nowIso(expires),
      nowIso(now),
      (c.req.header('user-agent') ?? '').slice(0, 200),
    )
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(c.env) || new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token)
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(await sha256Hex(token))
      .run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function loadUserFromToken(
  env: Env,
  token: string,
): Promise<{ user: AppUser; sessionId: string } | null> {
  const id = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, s.last_seen_at, u.id, u.email, u.name, u.role, u.status, u.timezone, u.onboarded_at, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  )
    .bind(id)
    .first<any>();
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now() || row.status !== 'active') {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    return null;
  }
  // Touch at most hourly to limit writes.
  if (Date.now() - Date.parse(row.last_seen_at) > 3600_000) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(nowIso(), id).run();
  }
  const { sid, expires_at: _e, last_seen_at: _l, ...user } = row;
  return { user: user as AppUser, sessionId: sid };
}

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null);
  c.set('sessionId', null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token && token.length < 200) {
    const s = await loadUserFromToken(c.env, token);
    if (s) {
      c.set('user', s.user);
      c.set('sessionId', s.sessionId);
    }
  }
  await next();
};

export function requireUser(c: Context<AppEnv>): AppUser {
  const u = c.get('user');
  if (!u) throw unauthorized();
  return u;
}

export function requireAdmin(c: Context<AppEnv>): AppUser {
  const u = requireUser(c);
  if (u.role !== 'admin') throw forbidden();
  return u;
}

export function isBootstrapAdmin(env: Env, email: string): boolean {
  const list = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
