import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { destroySession, requireUser } from '../lib/auth';
import { verifyPassword } from '../lib/crypto';
import { badRequest, body } from '../lib/http';
import { documentStore } from '../lib/providers';
import { audit } from '../lib/store';
import { nowIso } from '../lib/util';

/** Account data rights: export everything and permanent deletion. Mounted under /api/auth. */
export const accountRoutes = new Hono<AppEnv>();

/** Personal data export (JSON). Documents are listed by metadata; each can be downloaded separately. */
accountRoutes.get('/export', async (c) => {
  const u = requireUser(c);
  const q = (sql: string) =>
    c.env.DB.prepare(sql)
      .bind(u.id)
      .all()
      .then((r) => r.results);
  const data = {
    exported_at: nowIso(),
    account: u,
    profiles: await q(
      'SELECT type, title, data, created_at, updated_at FROM profiles WHERE user_id = ? AND deleted_at IS NULL',
    ),
    cvs: await q(
      'SELECT id, title, template, data, created_at, updated_at FROM cvs WHERE user_id = ? AND deleted_at IS NULL',
    ),
    cover_letters: await q(
      'SELECT title, body, created_at FROM cover_letters WHERE user_id = ? AND deleted_at IS NULL',
    ),
    documents: await q(
      'SELECT id, kind, filename, mime, size, created_at FROM documents WHERE user_id = ? AND deleted_at IS NULL',
    ),
    applications: await q('SELECT * FROM applications WHERE user_id = ? AND deleted_at IS NULL'),
    saved: await q('SELECT opportunity_id, state, created_at FROM user_opportunity WHERE user_id = ?'),
    notifications: await q(
      'SELECT kind, title, body, created_at, read_at FROM notifications WHERE user_id = ?',
    ),
    notification_prefs: await q('SELECT * FROM notification_prefs WHERE user_id = ?'),
    subscriptions: await q(
      'SELECT plan_id, status, current_period_start, current_period_end FROM subscriptions WHERE user_id = ?',
    ),
    payments: await q(
      'SELECT merchant_reference, amount, currency, status, created_at, completed_at FROM payments WHERE user_id = ?',
    ),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="opportunity-radar-export.json"',
    },
  });
});

/** Permanent account deletion: removes documents from storage and all personal rows (payments kept anonymised for accounting). */
accountRoutes.post('/delete-account', async (c) => {
  const u = requireUser(c);
  const { password } = await body(c, z.object({ password: z.string().min(1).max(200) }));
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<any>();
  if (!(await verifyPassword(password, row.password_hash)))
    throw badRequest('Password is incorrect.', { password: 'Incorrect password' });
  const docs = (
    await c.env.DB.prepare('SELECT storage_key FROM documents WHERE user_id = ?')
      .bind(u.id)
      .all<{ storage_key: string }>()
  ).results;
  const store = documentStore(c.env);
  for (const d of docs) await store.delete(d.storage_key);
  const ts = nowIso();
  const tomb = `deleted+${u.id}@deleted.invalid`;
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM documents WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM cvs WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM cover_letters WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM applications WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM user_opportunity WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM matches WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
    c.env.DB.prepare(
      "UPDATE users SET email = ?, name = 'Deleted user', password_hash = 'x', status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?",
    ).bind(tomb, ts, ts, u.id),
  ]);
  await audit(c.env, u.id, 'user.deleted', 'user', u.id);
  await destroySession(c);
  return c.json({ ok: true });
});
