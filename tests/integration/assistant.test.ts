/**
 * "Ask Opportunity Radar": hidden without a key; with a key, the Worker streams DeepSeek's answer as plain
 * text, sends the product guide and page context (never personal data), and handles upstream failures.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client, createEnv, signup, type TestEnv } from './helpers';
import { sseToText } from '../../worker/domain/assistant';

let env: TestEnv;
let off: TestEnv;

const sse = (...parts: string[]) =>
  parts.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') +
  'data: [DONE]\n\n';

/** Stands in for DeepSeek; records each request body. */
function stubDeepSeek(respond: () => Response) {
  const seen: any[] = [];
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== 'https://api.deepseek.com/chat/completions') return realFetch(input, init);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
    seen.push(JSON.parse(String(init?.body)));
    return respond();
  });
  return seen;
}

const ask = (c: Client, content: string, path = '/pricing') =>
  c.post('/api/assistant/chat', { messages: [{ role: 'user', content }], path });

beforeAll(async () => {
  env = await createEnv({ DEEPSEEK_API_KEY: 'test-key' });
  off = await createEnv();
});
afterAll(async () => {
  await env.__dispose();
  await off.__dispose();
});
afterEach(() => vi.unstubAllGlobals());

describe('Ask Opportunity Radar', () => {
  it('is hidden and refuses chats until a key is set', async () => {
    const c = new Client(off);
    expect((await c.get('/api/assistant/status')).json).toEqual({ enabled: false });
    expect((await ask(c, 'Hello')).status).toBe(503);
  });

  it('streams the answer as plain text for a visitor', async () => {
    const seen = stubDeepSeek(
      () => new Response(sse('The Jobs & ', 'Scholarships plan ', 'covers that.'), { status: 200 }),
    );
    const c = new Client(env);
    expect((await c.get('/api/assistant/status')).json).toEqual({ enabled: true });
    const r = await ask(c, 'Which plan covers scholarships?');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/plain');
    expect(r.json).toBe('The Jobs & Scholarships plan covers that.');

    const body = seen[0];
    expect(body.model).toBe('deepseek-flash');
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: 'disabled' });
    const system = body.messages[0];
    expect(system.role).toBe('system');
    // Live plan data and context, with no personal details.
    expect(system.content).toContain('Jobs & Scholarships ($15 per month)');
    expect(system.content).toContain('Page: /pricing');
    expect(system.content).toContain('Not signed in');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Which plan covers scholarships?' });
  });

  it('tells the model the plan of a signed-in member, but not their name or email', async () => {
    const seen = stubDeepSeek(() => new Response(sse('Hi'), { status: 200 }));
    const c = await signup(env, 'assistant-member@example.test', 'Amina Private');
    await ask(c, 'What can I do on my plan?', '/app');
    const system = seen[0].messages[0].content as string;
    expect(system).toContain('Signed in, on the Free plan.');
    expect(system).not.toContain('Amina');
    expect(system).not.toContain('assistant-member@example.test');
  });

  it('sends only the recent conversation', async () => {
    const seen = stubDeepSeek(() => new Response(sse('ok'), { status: 200 }));
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `message ${i}`,
    }));
    const r = await new Client(env).post('/api/assistant/chat', { messages, path: '/' });
    expect(r.status).toBe(200);
    expect(seen[0].messages).toHaveLength(13); // system + last 12
    expect(seen[0].messages.at(-1).content).toBe('message 20');
  });

  it('rejects empty, overlong or badly ordered conversations', async () => {
    const c = new Client(env);
    expect((await ask(c, '   ')).status).toBe(400);
    expect((await ask(c, 'x'.repeat(1501))).status).toBe(400);
    const r = await c.post('/api/assistant/chat', {
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ],
    });
    expect(r.status).toBe(400);
  });

  it('needs the CSRF header like every other write', async () => {
    const r = await new Client(env).req(
      'POST',
      '/api/assistant/chat',
      { messages: [{ role: 'user', content: 'Hi' }] },
      { 'x-or-csrf': '' },
    );
    expect(r.status).toBe(403);
  });

  it('explains when DeepSeek is unavailable or busy', async () => {
    stubDeepSeek(() => new Response('{"error":"Insufficient Balance"}', { status: 402 }));
    const down = await ask(new Client(env), 'Hello');
    expect(down.status).toBe(503);
    expect(down.json.error.code).toBe('assistant_unavailable');

    stubDeepSeek(() => new Response('{}', { status: 429 }));
    const busy = await ask(new Client(env), 'Hello');
    expect(busy.status).toBe(429);
    expect(busy.json.error.code).toBe('assistant_busy');
  });

  it('limits how many questions one person can ask in ten minutes', async () => {
    stubDeepSeek(() => new Response(sse('ok'), { status: 200 }));
    const c = new Client(env, '10.9.9.9');
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await ask(c, `Question ${i}`)).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe('sseToText', () => {
  it('joins deltas split across chunks and ignores noise', async () => {
    const raw =
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n' +
      ': keep-alive\n\n' +
      'data: {"choices":[{"delta":{"content":"Hel' +
      'lo"}}]}\n\ndata: not-json\n\n' +
      'data: {"choices":[{"delta":{"content":" there"},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"after done"}}]}\n\n';
    const bytes = new TextEncoder().encode(raw);
    // Feed it in awkward 7-byte pieces, as a network might.
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        for (let i = 0; i < bytes.length; i += 7) ctrl.enqueue(bytes.slice(i, i + 7));
        ctrl.close();
      },
    });
    const text = await new Response(stream.pipeThrough(sseToText())).text();
    expect(text).toBe('Hello there');
  });
});
