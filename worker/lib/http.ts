import type { Context } from 'hono';
import type { ZodError, ZodTypeAny, z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have permission to do that.') =>
  new HttpError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, 'not_found', msg);
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);
export const paymentRequired = (msg: string, details?: unknown) =>
  new HttpError(402, 'upgrade_required', msg, details);
export const tooLarge = () => new HttpError(413, 'too_large', 'The request is too large.');
export const tooMany = (msg = 'Too many requests. Please wait and try again.') =>
  new HttpError(429, 'rate_limited', msg);

/** Largest JSON request body accepted by any endpoint (file uploads use multipart and their own limit). */
export const MAX_JSON_BYTES = 1_000_000;

export async function body<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  if (Number(c.req.header('content-length') ?? '0') > MAX_JSON_BYTES) throw tooLarge();
  const text = await c.req.text();
  if (text.length > MAX_JSON_BYTES) throw tooLarge();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw badRequest('Request body must be JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest('Please check the highlighted fields.', flattenZod(parsed.error));
  return parsed.data;
}

export function flattenZod(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = issue.path.join('.') || '_';
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}
