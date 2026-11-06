import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { MAX_UPLOAD_BYTES } from '../../shared/constants';
import { documentKindSchema } from '../../shared/schemas';
import { requireUser } from '../lib/auth';
import { sha256Hex, randomToken } from '../lib/crypto';
import { safeFilename, sniffFile } from '../lib/filetype';
import { HttpError, badRequest, notFound } from '../lib/http';
import { documentStore } from '../lib/providers';
import { rateLimit } from '../lib/security';
import { requireWithin, userPlan } from '../lib/store';
import { newId, nowIso } from '../lib/util';

export const documentRoutes = new Hono<AppEnv>();

documentRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT id, kind, filename, mime, size, profile_id, created_at FROM documents WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    )
      .bind(u.id)
      .all()
  ).results;
  return c.json({ documents: rows });
});

documentRoutes.post('/', async (c) => {
  const u = requireUser(c);
  await rateLimit(c, 'upload', 30, 3600, u.id);
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > MAX_UPLOAD_BYTES + 64 * 1024)
    throw new HttpError(413, 'too_large', 'Files must be 5 MB or smaller.');
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw badRequest('Upload must be multipart/form-data.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') throw badRequest('Choose a file to upload.');
  const kind = documentKindSchema.safeParse(form.get('kind') ?? 'other');
  if (!kind.success) throw badRequest('Unknown document type.');
  if (file.size === 0) throw badRequest('The file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'too_large', 'Files must be 5 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = safeFilename(file.name || 'document');
  const type = sniffFile(bytes, name);
  if (!type)
    throw new HttpError(
      415,
      'unsupported_type',
      'Only PDF, Word (.docx), PNG and JPG files are accepted, and the file contents must match the extension.',
    );

  const plan = await userPlan(c.env, u.id);
  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM documents WHERE user_id = ? AND deleted_at IS NULL',
  )
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_documents', count?.n ?? 0, 'stored document(s)');

  const profileId = form.get('profile_id');
  let pid: string | null = null;
  if (typeof profileId === 'string' && profileId) {
    const own = await c.env.DB.prepare(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    )
      .bind(profileId, u.id)
      .first();
    if (!own) throw notFound('Profile not found.');
    pid = profileId;
  }
  const id = newId('doc');
  const key = `u/${u.id}/${randomToken(18)}`; // random key; never derived from the filename
  await documentStore(c.env).put(key, bytes.buffer as ArrayBuffer, { mime: type.mime });
  await c.env.DB.prepare(
    'INSERT INTO documents (id, user_id, profile_id, kind, filename, mime, size, sha256, storage_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, pid, kind.data, name, type.mime, bytes.byteLength, await sha256Hex(bytes), key, nowIso())
    .run();
  return c.json(
    { document: { id, kind: kind.data, filename: name, mime: type.mime, size: bytes.byteLength } },
    201,
  );
});

documentRoutes.get('/:id/download', async (c) => {
  const u = requireUser(c);
  const d = await c.env.DB.prepare(
    'SELECT filename, mime, storage_key FROM documents WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(c.req.param('id'), u.id)
    .first<any>();
  if (!d) throw notFound('Document not found.');
  const buf = await documentStore(c.env).get(d.storage_key);
  if (!buf) throw notFound('Document content is no longer available.');
  return new Response(buf, {
    headers: {
      'Content-Type': d.mime,
      'Content-Disposition': `attachment; filename="${d.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});

documentRoutes.delete('/:id', async (c) => {
  const u = requireUser(c);
  const d = await c.env.DB.prepare(
    'SELECT storage_key FROM documents WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(c.req.param('id'), u.id)
    .first<any>();
  if (!d) throw notFound('Document not found.');
  await documentStore(c.env).delete(d.storage_key);
  await c.env.DB.prepare('UPDATE documents SET deleted_at = ? WHERE id = ? AND user_id = ?')
    .bind(nowIso(), c.req.param('id'), u.id)
    .run();
  return c.json({ ok: true });
});
