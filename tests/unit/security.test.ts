import { describe, expect, it } from 'vitest';
import { isPublicHttpUrl, normalizeUrl, safeFetch, atsHost } from '../../worker/lib/url';
import { htmlToText } from '../../worker/lib/sanitize';
import { safeFilename, sniffFile } from '../../worker/lib/filetype';
import { hashPassword, verifyPassword } from '../../worker/lib/crypto';
import { mapPesapalStatus, PesapalProvider } from '../../worker/domain/payments/providers';
import { inQuietHours, localHour } from '../../worker/domain/alerts';

describe('URL policy (SSRF)', () => {
  it.each([
    'http://localhost/x',
    'https://127.0.0.1/',
    'https://10.0.0.5/',
    'https://[::1]/',
    'https://169.254.169.254/latest/meta-data',
    'https://0x7f000001/',
    'https://2130706433/',
    'ftp://example.org/x',
    'https://user:pw@example.org/',
    'https://example.org:8443/',
    'https://intranet/',
    'https://printer.local/',
    'javascript:alert(1)',
  ])('blocks %s', (u) => expect(isPublicHttpUrl(u)).toBe(false));
  it('allows public https hosts', () => {
    expect(isPublicHttpUrl('https://search.worldbank.org/api/v2/procnotices')).toBe(true);
    expect(isPublicHttpUrl('http://example.org/', { allowHttp: true })).toBe(true);
    expect(isPublicHttpUrl('http://example.org/')).toBe(false);
  });
  it('re-validates redirects', async () => {
    const fetcher = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/admin' },
      })) as unknown as typeof fetch;
    await expect(safeFetch('https://example.org/', { fetcher })).rejects.toThrow(/Blocked/);
  });
  it('enforces response size limits and timeouts', async () => {
    const big = (async () => new Response('x'.repeat(2000), { status: 200 })) as unknown as typeof fetch;
    await expect(safeFetch('https://example.org/', { fetcher: big, maxBytes: 100 })).rejects.toThrow(
      /too large/,
    );
    const slow = ((_: any, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal?.addEventListener('abort', () => rej(new Error('aborted'))),
      )) as unknown as typeof fetch;
    await expect(safeFetch('https://example.org/', { fetcher: slow, timeoutMs: 50 })).rejects.toThrow(
      /timed out/,
    );
  });
  it('classifies retryable vs permanent HTTP failures', async () => {
    const f429 = (async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const f404 = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(safeFetch('https://example.org/', { fetcher: f429 })).rejects.toMatchObject({
      retryable: true,
    });
    await expect(safeFetch('https://example.org/', { fetcher: f404 })).rejects.toMatchObject({
      retryable: false,
    });
  });
  it('normalises URLs and recognises ATS hosts', () => {
    expect(normalizeUrl('https://WWW.Example.org/a/?utm_source=x&id=2#top')).toBe(
      'https://example.org/a?id=2',
    );
    expect(atsHost('https://acme.wd3.myworkdayjobs.com/x')).toBe('myworkdayjobs.com');
    expect(atsHost('https://greenhouse.io.evil.com/x')).toBeNull();
  });
});

describe('HTML sanitising (XSS from sources)', () => {
  it('removes scripts, handlers and tags, keeping text', () => {
    const t = htmlToText(
      '<p onclick="x()">Hello <img src=x onerror=alert(1)><script>alert(2)</script><style>p{}</style><b>world</b></p><ul><li>One</li></ul>',
    );
    expect(t).toBe('Hello world\n\n• One');
    expect(t).not.toMatch(/alert|<|onerror/);
  });
  it('decodes double-encoded HTML safely', () => {
    expect(htmlToText('&lt;p&gt;Hi &amp;amp; bye&lt;/p&gt;')).toBe('Hi & bye');
    expect(htmlToText('&#0;&#x110000;ok')).toBe('ok');
  });
});

describe('file signature checks', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it('accepts real PDF and DOCX signatures with matching extensions', () => {
    expect(sniffFile(enc('%PDF-1.7 ...'), 'cv.pdf')?.mime).toBe('application/pdf');
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc('....word/document.xml....')]);
    expect(sniffFile(zip, 'cv.docx')?.ext).toBe('docx');
  });
  it('rejects mismatches, executables, macro documents and HTML', () => {
    expect(sniffFile(enc('%PDF-1.7'), 'cv.docx')).toBeNull();
    expect(sniffFile(enc('MZ\x90\x00'), 'cv.pdf')).toBeNull();
    expect(sniffFile(enc('<html><script>'), 'cv.pdf')).toBeNull();
    const macro = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc('word/vbaProject.bin')]);
    expect(sniffFile(macro, 'cv.docx')).toBeNull();
    const plainZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...enc('payload.exe')]);
    expect(sniffFile(plainZip, 'cv.docx')).toBeNull();
  });
  it('sanitises file names (path traversal)', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\x\\My CV<script>.pdf')).toBe('My CV_script_.pdf');
  });
});

describe('passwords', () => {
  it('hashes with salt and verifies', async () => {
    const h1 = await hashPassword('Password1234');
    const h2 = await hashPassword('Password1234');
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword('Password1234', h1)).toBe(true);
    expect(await verifyPassword('Password1235', h1)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('Pesapal adapter', () => {
  it('maps provider statuses', () => {
    expect(mapPesapalStatus(1, 'Completed')).toBe('completed');
    expect(mapPesapalStatus(2, 'Failed')).toBe('failed');
    expect(mapPesapalStatus(3, 'Reversed')).toBe('refunded');
    expect(mapPesapalStatus(0, 'INVALID')).toBe('failed');
    expect(mapPesapalStatus(undefined, 'Pending')).toBe('pending');
  });
  it('authenticates, submits orders and reads status against the sandbox base URL', async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/api/Auth/RequestToken'))
        return Response.json({ token: 't', expiryDate: new Date(Date.now() + 300000).toISOString() });
      if (url.endsWith('/api/Transactions/SubmitOrderRequest')) {
        const b = JSON.parse(String(init.body));
        expect(b).toMatchObject({ id: 'OR-1', currency: 'UGX', amount: 10000, notification_id: 'ipn' });
        return Response.json({
          order_tracking_id: 'trk',
          merchant_reference: 'OR-1',
          redirect_url: 'https://cybqa.pesapal.com/pay/x',
        });
      }
      if (url.includes('GetTransactionStatus'))
        return Response.json({
          status_code: 1,
          payment_status_description: 'Completed',
          amount: 10000,
          currency: 'UGX',
          merchant_reference: 'OR-1',
          confirmation_code: 'C1',
          payment_method: 'MTN',
        });
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    const p = new PesapalProvider('k', 's', 'ipn', 'sandbox', fetcher);
    const c = await p.createCheckout({
      merchantReference: 'OR-1',
      amount: 10000,
      currency: 'UGX',
      description: 'x',
      callbackUrl: 'https://app/cb',
      email: 'a@b.c',
      name: 'A B',
    });
    expect(c.trackingId).toBe('trk');
    const st = await p.getStatus('trk');
    expect(st).toMatchObject({
      status: 'completed',
      amount: 10000,
      currency: 'UGX',
      merchantReference: 'OR-1',
    });
    expect(calls[0]).toBe('POST https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken');
    expect(calls.filter((x) => x.includes('RequestToken'))).toHaveLength(1); // token is cached
    expect(p.live).toBe(false);
  });
});

describe('quiet hours', () => {
  it('handles windows that cross midnight', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(6, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
    expect(inQuietHours(12, null, null)).toBe(false);
  });
  it('computes local hour in a timezone', () => {
    expect(localHour(new Date('2026-11-06T10:00:00Z'), 'Africa/Kampala')).toBe(13);
  });
});
