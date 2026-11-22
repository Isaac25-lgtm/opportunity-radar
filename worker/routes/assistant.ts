import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { assistantRequestSchema } from '../../shared/assistant';
import { HttpError, body } from '../lib/http';
import { rateLimit } from '../lib/security';
import { getConfig, userPlan } from '../lib/store';
import { log } from '../lib/util';
import { paymentProvider } from '../domain/payments/providers';
import { googleConfigured } from './oauth';
import {
  AssistantUpstreamError,
  assistantConfigured,
  buildSystemPrompt,
  callDeepSeek,
  sseToText,
  type PlanRow,
} from '../domain/assistant';

/** "Ask Opportunity Radar AI". Open to visitors and members; switched on by the DEEPSEEK_API_KEY secret. */
export const assistantRoutes = new Hono<AppEnv>();

const unavailable = () =>
  new HttpError(
    503,
    'assistant_unavailable',
    'The assistant is not available right now. Please try again later, or see the Help centre.',
  );

assistantRoutes.get('/status', (c) => c.json({ enabled: assistantConfigured(c.env) }));

assistantRoutes.post('/chat', async (c) => {
  if (!assistantConfigured(c.env)) throw unavailable();
  const input = await body(c, assistantRequestSchema);
  const user = c.get('user');
  // Per person (signed-in user or network address), plus a site-wide daily ceiling that bounds cost.
  await rateLimit(c, 'assistant-10m', 20, 600, user?.id);
  await rateLimit(c, 'assistant-day', 150, 86_400, user?.id);
  await rateLimit(c, 'assistant-site-day', 5000, 86_400, 'site');

  const plans = (
    await c.env.DB.prepare(
      'SELECT code, name, description, price_minor, currency, entitlements FROM plans WHERE active = 1 ORDER BY sort',
    ).all<PlanRow>()
  ).results;
  const provider = paymentProvider(c.env, c.env.APP_URL ?? new URL(c.req.url).origin);
  const paymentsOn = (await getConfig(c.env, 'payments.enabled', false)) === true;
  const system = buildSystemPrompt(plans, {
    path: input.path,
    signedIn: !!user,
    planName: user ? (await userPlan(c.env, user.id)).name : null,
    paymentsLive: !!provider?.live && paymentsOn,
    googleSignIn: googleConfigured(c.env),
  });

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await callDeepSeek(c.env, system, input.messages);
  } catch (e) {
    // Message text is never logged.
    const status = e instanceof AssistantUpstreamError ? e.status : 0;
    log('warn', 'assistant.upstream_failed', { status, error: status ? undefined : String(e).slice(0, 200) });
    if (status === 429)
      throw new HttpError(429, 'assistant_busy', 'The assistant is busy. Please try again in a minute.');
    throw unavailable();
  }
  return new Response(upstream.pipeThrough(sseToText()), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
});
