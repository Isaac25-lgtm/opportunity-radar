import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { isProduction } from './env';
import { sessionMiddleware } from './lib/auth';
import { z } from 'zod';
import { HttpError, body } from './lib/http';
import { csrfMiddleware, rateLimit, securityHeaders } from './lib/security';
import { log, newId } from './lib/util';
import { adminRoutes } from './routes/admin';
import { accountRoutes } from './routes/account';
import { authRoutes } from './routes/auth';
import { billingRoutes } from './routes/billing';
import { coverLetterRoutes, cvRoutes } from './routes/cvs';
import { documentRoutes } from './routes/documents';
import { opportunityRoutes } from './routes/opportunities';
import { profileRoutes } from './routes/profiles';
import { applicationRoutes } from './routes/applications';
import { dashboardRoutes } from './routes/dashboard';
import { notificationRoutes } from './routes/notifications';
import {
  drainTasks,
  maybeStartScheduledRun,
  recoverStaleRuns,
  expireOpportunities,
} from './domain/ingestion/pipeline';
import { processDigests, processMatchAlerts, processReminders, sendDeliveries } from './domain/alerts';
import { expireStalePayments } from './domain/payments/service';

export const app = new Hono<AppEnv>().basePath('/api');

app.use('*', securityHeaders);
app.use('*', sessionMiddleware);
app.use('*', csrfMiddleware);

app.get('/health', async (c) => {
  const db = await c.env.DB.prepare('SELECT 1 AS ok')
    .first<{ ok: number }>()
    .catch(() => null);
  return c.json({ ok: !!db, environment: c.env.ENVIRONMENT, time: new Date().toISOString() });
});

/** Public transparency data: what sources exist and how fresh they are. */
app.get('/public/sources', async (c) => {
  const rows = (
    await c.env.DB.prepare(
      `SELECT name, owner, source_type, automation, enabled, categories, geography, last_success_at, terms_url,
        (SELECT COUNT(*) FROM opportunities o WHERE o.source_id = s.id AND o.status = 'open' AND o.moderation = 'approved') AS open_items
       FROM sources s ORDER BY enabled DESC, name`,
    ).all<any>()
  ).results;
  const totals = (
    await c.env.DB.prepare(
      "SELECT category, COUNT(*) AS n FROM opportunities WHERE status = 'open' AND moderation = 'approved' GROUP BY category",
    ).all()
  ).results;
  return c.json({
    sources: rows.map((r) => ({
      ...r,
      categories: JSON.parse(r.categories || '[]'),
      geography: JSON.parse(r.geography || '[]'),
      enabled: !!r.enabled,
    })),
    totals,
  });
});

app.post('/public/contact', async (c) => {
  await rateLimit(c, 'contact', 5, 3600);
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(200),
      topic: z.enum(['account', 'opportunity', 'payment', 'privacy', 'partnership', 'other']),
      message: z.string().trim().min(10).max(5000),
    }),
  );
  await c.env.DB.prepare(
    'INSERT INTO contact_messages (id, user_id, name, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      newId('msg'),
      c.get('user')?.id ?? null,
      input.name,
      input.email,
      input.topic,
      input.message,
      new Date().toISOString(),
    )
    .run();
  return c.json({ ok: true }, 201);
});

app.route('/auth', authRoutes);
app.route('/auth', accountRoutes);
app.route('/profiles', profileRoutes);
app.route('/documents', documentRoutes);
app.route('/cvs', cvRoutes);
app.route('/cover-letters', coverLetterRoutes);
app.route('/opportunities', opportunityRoutes);
app.route('/applications', applicationRoutes);
app.route('/notifications', notificationRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/billing', billingRoutes);
app.route('/admin', adminRoutes);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      err.status as any,
    );
  }
  // Unexpected: log a reference without request bodies or personal data; never leak internals.
  const ref = crypto.randomUUID().slice(0, 8);
  log('error', 'unhandled', {
    ref,
    path: new URL(c.req.url).pathname,
    error: String((err as Error)?.message ?? err).slice(0, 300),
  });
  return c.json(
    { error: { code: 'server_error', message: `Something went wrong (ref ${ref}). Please try again.` } },
    500,
  );
});

/** One scheduler tick (cron every 15 minutes). Each step is bounded and isolated. */
export async function tick(env: Env, now = new Date()) {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['recover', () => recoverStaleRuns(env, now)],
    ['schedule', () => maybeStartScheduledRun(env, now)],
    ['drain', () => drainTasks(env, { now })],
    ['expire', () => expireOpportunities(env, now)],
    ['alerts', () => processMatchAlerts(env, now)],
    ['reminders', () => processReminders(env, now)],
    ['digests', () => processDigests(env, now)],
    ['deliveries', () => sendDeliveries(env, now)],
    ['payments', () => expireStalePayments(env, now)],
  ];
  const out: Record<string, unknown> = {};
  for (const [name, fn] of steps) {
    try {
      out[name] = await fn();
    } catch (e) {
      out[name] = { error: String((e as Error).message ?? e).slice(0, 200) };
      log('error', 'tick.step_failed', {
        step: name,
        error: String((e as Error).message ?? e).slice(0, 200),
      });
    }
  }
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      const h = new Headers(res.headers);
      h.set('X-Content-Type-Options', 'nosniff');
      h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      h.set('X-Frame-Options', 'DENY');
      h.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      if (isProduction(env)) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      return new Response(res.body, { status: res.status, headers: h });
    }
    return new Response('Not found', { status: 404 });
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      tick(env, new Date(controller.scheduledTime)).then((r) =>
        log('info', 'tick.done', { steps: Object.keys(r) }),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
