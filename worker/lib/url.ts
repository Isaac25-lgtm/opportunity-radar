/**
 * Outbound URL policy (SSRF defence). Only public http(s) hosts on default ports are fetched; IP literals,
 * localhost, private/link-local ranges, internal TLDs and credentials-in-URL are refused.
 */
const BLOCKED_HOST_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.intranet',
  '.arpa',
];

export function isPublicHttpUrl(raw: string, { allowHttp = false } = {}): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) return false;
  if (u.username || u.password) return false;
  if (u.port) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || !host.includes('.')) return false;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
  // Reject any IPv4/IPv6 literal outright: legitimate sources use DNS names.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':')) return false;
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) return false;
  return true;
}

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(p)) u.searchParams.delete(p);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return null;
  }
}

export const KNOWN_ATS_HOSTS = [
  'myworkdayjobs.com',
  'greenhouse.io',
  'lever.co',
  'smartrecruiters.com',
  'icims.com',
  'taleo.net',
  'successfactors.com',
  'bamboohr.com',
  'workable.com',
  'recruitee.com',
  'jobvite.com',
];

export function atsHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const h = new URL(raw).hostname.toLowerCase();
    return KNOWN_ATS_HOSTS.find((a) => h === a || h.endsWith('.' + a)) ?? null;
  } catch {
    return null;
  }
}

export type SafeFetchOptions = {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetcher?: typeof fetch;
};

export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = true,
  ) {
    super(message);
  }
}

/** Fetch with URL policy, timeout, manual redirect validation and response-size cap. */
export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<{ status: number; text: string; finalUrl: string }> {
  const f = opts.fetcher ?? fetch;
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isPublicHttpUrl(current)) throw new FetchError('Blocked URL', undefined, false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
    try {
      const res = await f(current, {
        method: opts.method ?? 'GET',
        headers: {
          'User-Agent': 'OpportunityRadarBot/1.0 (+opportunity matching; respects robots and terms)',
          Accept: 'application/json, application/rss+xml, application/xml, text/xml, */*',
          ...opts.headers,
        },
        body: opts.body,
        redirect: 'manual',
        signal: ctrl.signal,
      });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        void res.body?.cancel().catch(() => {});
        const next = new URL(location, current);
        if ((opts.body || opts.headers) && next.origin !== new URL(current).origin)
          throw new FetchError('Blocked cross-origin redirect with request data', undefined, false);
        current = next.toString();
        continue;
      }
      if (res.status === 429) throw new FetchError('Rate limited by source (429)', 429, true);
      if (res.status >= 500) throw new FetchError(`Source error ${res.status}`, res.status, true);
      if (res.status >= 400 && opts.method !== 'HEAD')
        throw new FetchError(`Source returned ${res.status}`, res.status, false);
      const max = opts.maxBytes ?? 5_000_000;
      let text = '';
      if (opts.method !== 'HEAD' && res.body) {
        if (Number(res.headers.get('content-length') ?? '0') > max) {
          void res.body.cancel().catch(() => {});
          throw new FetchError('Response too large', res.status, false);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > max) throw new FetchError('Response too large', res.status, false);
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          void reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      }
      return { status: res.status, text, finalUrl: current };
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError(
        ctrl.signal.aborted ? 'Request timed out' : `Network error: ${(e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchError('Too many redirects', undefined, false);
}
