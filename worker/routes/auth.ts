import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { isProduction } from '../env';
import { passwordSchema, signinSchema, signupSchema } from '../../shared/schemas';
import { createSession, destroySession, isBootstrapAdmin, requireUser } from '../lib/auth';
import { hashPassword, randomToken, sha256Hex, verifyPassword } from '../lib/crypto';
import { HttpError, badRequest, body, conflict, unauthorized } from '../lib/http';
import { emailProvider } from '../lib/providers';
import { rateLimit } from '../lib/security';
import { audit, userPlan } from '../lib/store';
import { log, newId, nowIso } from '../lib/util';

export const authRoutes = new Hono<AppEnv>();

// A fixed dummy hash so sign-in takes the same time whether or not the email exists.
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

authRoutes.post('/signup', async (c) => {
  await rateLimit(c, 'signup', 10, 3600);
  const input = await body(c, signupSchema);
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(input.email).first();
  if (exists) throw conflict('An account with this email already exists. Sign in instead.');
  const id = newId('usr');
  const ts = nowIso();
  const role = isBootstrapAdmin(c.env, input.email) ? 'admin' : 'user';
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, input.email, await hashPassword(input.password), input.name, role, ts, ts),
    c.env.DB.prepare('INSERT INTO notification_prefs (user_id, updated_at) VALUES (?, ?)').bind(id, ts),
  ]);
  await audit(c.env, id, 'user.signup', 'user', id, { role });
  await createSession(c, id);
  return c.json({ ok: true }, 201);
});

authRoutes.post('/signin', async (c) => {
  await rateLimit(c, 'signin', 20, 900);
  const input = await body(c, signinSchema);
  await rateLimit(c, 'signin-account', 10, 900, (await sha256Hex(input.email)).slice(0, 24));
  const u = await c.env.DB.prepare('SELECT id, password_hash, status, role, email FROM users WHERE email = ?')
    .bind(input.email)
    .first<any>();
  const ok = await verifyPassword(input.password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok || u.status !== 'active') throw unauthorized('Email or password is incorrect.');
  if (u.role !== 'admin' && isBootstrapAdmin(c.env, u.email)) {
    await c.env.DB.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?")
      .bind(nowIso(), u.id)
      .run();
    await audit(c.env, u.id, 'user.bootstrap_admin', 'user', u.id);
  }
  await createSession(c, u.id);
  return c.json({ ok: true });
});

authRoutes.post('/signout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const u = c.get('user');
  if (!u) return c.json({ user: null });
  const plan = await userPlan(c.env, u.id);
  const profiles = (
    await c.env.DB.prepare('SELECT type, completeness FROM profiles WHERE user_id = ? AND deleted_at IS NULL')
      .bind(u.id)
      .all()
  ).results;
  const unread = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
  )
    .bind(u.id)
    .first<{ n: number }>();
  return c.json({ user: { ...u }, plan, profiles, unread: unread?.n ?? 0 });
});

authRoutes.patch('/me', async (c) => {
  const u = requireUser(c);
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      timezone: z.string().max(60).optional(),
      onboarded: z.boolean().optional(),
    }),
  );
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone });
    } catch {
      throw badRequest('Unknown timezone.');
    }
  }
  await c.env.DB.prepare(
    'UPDATE users SET name = COALESCE(?, name), timezone = COALESCE(?, timezone), onboarded_at = CASE WHEN ? = 1 AND onboarded_at IS NULL THEN ? ELSE onboarded_at END, updated_at = ? WHERE id = ?',
  )
    .bind(input.name ?? null, input.timezone ?? null, input.onboarded ? 1 : 0, nowIso(), nowIso(), u.id)
    .run();
  return c.json({ ok: true });
});

authRoutes.post('/change-password', async (c) => {
  const u = requireUser(c);
  await rateLimit(c, 'change-password', 10, 3600, u.id);
  const input = await body(c, z.object({ current: z.string().min(1).max(200), next: passwordSchema }));
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<any>();
  if (!(await verifyPassword(input.current, row.password_hash)))
    throw badRequest('Current password is incorrect.', { current: 'Incorrect password' });
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(
      await hashPassword(input.next),
      nowIso(),
      u.id,
    ),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(u.id, c.get('sessionId')),
  ]);
  await audit(c.env, u.id, 'user.password_changed', 'user', u.id);
  return c.json({ ok: true });
});

/** Always responds the same way so it cannot be used to discover registered emails. */
authRoutes.post('/forgot', async (c) => {
  await rateLimit(c, 'forgot', 5, 3600);
  const { email } = await body(c, z.object({ email: z.string().trim().toLowerCase().email().max(200) }));
  const u = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND status = 'active'")
    .bind(email)
    .first<{ id: string }>();
  let devLink: string | null = null;
  if (u) {
    const token = randomToken(32);
    const ts = new Date();
    await c.env.DB.prepare(
      'INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind(await sha256Hex(token), u.id, nowIso(ts), new Date(ts.getTime() + 3600_000).toISOString())
      .run();
    const base = c.env.APP_URL ?? new URL(c.req.url).origin;
    const link = `${base}/reset-password?token=${token}`;
    const res = await emailProvider(c.env).send({
      to: email,
      subject: 'Reset your Opportunity Radar password',
      text: `Use this link within 1 hour to choose a new password:\n\n${link}\n\nIf you did not request this, ignore this email.`,
    });
    if (res.status !== 'sent')
      log('warn', 'auth.reset_email_not_sent', { provider: res.provider, status: res.status });
    // Only outside production, and only when no email provider is configured, return the link for local testing.
    if (!isProduction(c.env) && res.status === 'skipped') devLink = link;
  }
  return c.json({
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.',
    dev_reset_link: devLink,
  });
});

authRoutes.post('/reset', async (c) => {
  await rateLimit(c, 'reset', 10, 3600);
  const input = await body(c, z.object({ token: z.string().min(20).max(200), password: passwordSchema }));
  const hash = await sha256Hex(input.token);
  const r = await c.env.DB.prepare(
    'SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
  )
    .bind(hash, nowIso())
    .first<{ user_id: string }>();
  if (!r) throw new HttpError(400, 'invalid_token', 'This reset link is invalid or has expired.');
  const passwordHash = await hashPassword(input.password);
  const ts = nowIso();
  const valid = 'token_hash = ? AND used_at IS NULL AND expires_at > ?';
  const [, , claimed] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
       AND EXISTS (SELECT 1 FROM password_resets WHERE ${valid})`,
    ).bind(passwordHash, ts, r.user_id, hash, ts),
    c.env.DB.prepare(
      `DELETE FROM sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM password_resets WHERE ${valid})`,
    ).bind(r.user_id, hash, ts),
    c.env.DB.prepare(`UPDATE password_resets SET used_at = ? WHERE ${valid}`).bind(ts, hash, ts),
  ]);
  if (!claimed.meta.changes)
    throw new HttpError(400, 'invalid_token', 'This reset link is invalid or has expired.');
  await audit(c.env, r.user_id, 'user.password_reset', 'user', r.user_id);
  return c.json({ ok: true });
});
