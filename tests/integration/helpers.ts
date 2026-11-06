import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { app } from '../../worker/index';
import type { Env } from '../../worker/env';

export type TestEnv = Env & { __dispose: () => Promise<void> };

export async function createEnv(overrides: Partial<Env> = {}): Promise<TestEnv> {
  const proxy = await getPlatformProxy<Env>({ configPath: 'wrangler.jsonc', persist: false });
  const env = {
    ...(proxy.env as Env),
    ENVIRONMENT: 'test',
    ADMIN_EMAILS: 'admin@example.test',
    PAYMENT_PROVIDER: 'mock',
    ...overrides,
  } as TestEnv;
  const dir = 'migrations';
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean))
      await env.DB.prepare(stmt).run();
  }
  env.__dispose = () => proxy.dispose();
  return env;
}

class Ctx {
  promises: Promise<unknown>[] = [];
  waitUntil(p: Promise<unknown>) {
    this.promises.push(p);
  }
  passThroughOnException() {}
  props = {};
}

export class Client {
  cookie = '';
  constructor(
    private env: Env,
    public ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`,
  ) {}

  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { 'cf-connecting-ip': this.ip, ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    if (method !== 'GET' && !('x-or-csrf' in extra)) headers['x-or-csrf'] = '1';
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const ctx = new Ctx();
    const res = await app.fetch(
      new Request(`http://localhost${path}`, { method, headers, body: payload }),
      this.env,
      ctx as any,
    );
    await Promise.all(ctx.promises);
    const set = res.headers.get('set-cookie');
    if (set) {
      const m = set.match(/or_session=([^;]*)/);
      if (m) this.cookie = m[1] ? `or_session=${m[1]}` : '';
      if (/Max-Age=0/i.test(set)) this.cookie = '';
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  put = (p: string, b?: unknown) => this.req('PUT', p, b ?? {});
  patch = (p: string, b?: unknown) => this.req('PATCH', p, b ?? {});
  del = (p: string) => this.req('DELETE', p);
}

export async function signup(env: Env, email: string, name = 'Test User', password = 'Password1234') {
  const c = new Client(env);
  const r = await c.post('/api/auth/signup', { name, email, password, accept_terms: true });
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.json)}`);
  return c;
}

export function mockFetch(
  routes: Array<[RegExp, (req: Request) => Response | Promise<Response>]>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as any, init);
    for (const [re, h] of routes) if (re.test(req.url)) return h(req);
    return new Response('not mocked', { status: 404 });
  }) as typeof fetch;
}

export const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
