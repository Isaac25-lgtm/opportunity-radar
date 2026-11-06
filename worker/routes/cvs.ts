import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { careerProfileSchema } from '../../shared/schemas';
import { cvDataSchema, cvFromCareerProfile, cvSaveSchema, emptyCv, type CvData } from '../../shared/cv';
import { CV_TEMPLATES } from '../../shared/constants';
import { requireUser } from '../lib/auth';
import { badRequest, body, notFound } from '../lib/http';
import { aiProvider } from '../lib/providers';
import { rateLimit } from '../lib/security';
import { incrementUsage, requireFeature, requireWithin, usage, userPlan } from '../lib/store';
import { newId, nowIso, parseJson } from '../lib/util';
import { analyzeForOpportunity, draftCoverLetter, tailoredCopy } from '../domain/tailor';

export const cvRoutes = new Hono<AppEnv>();

async function ownCv(c: any, id: string) {
  const u = requireUser(c);
  const r = await c.env.DB.prepare('SELECT * FROM cvs WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(id, u.id)
    .first();
  if (!r) throw notFound('CV not found.');
  return { u, row: r as any, data: cvDataSchema.parse(parseJson(r.data, {})) };
}

async function snapshot(env: any, cvId: string, template: string, data: CvData, note: string) {
  const last = await env.DB.prepare('SELECT MAX(version) AS v FROM cv_versions WHERE cv_id = ?')
    .bind(cvId)
    .first();
  const v = (last?.v ?? 0) + 1;
  await env.DB.prepare(
    'INSERT INTO cv_versions (id, cv_id, version, template, data, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('cvv'), cvId, v, template, JSON.stringify(data), note.slice(0, 200), nowIso())
    .run();
  // Keep the 30 most recent versions.
  await env.DB.prepare('DELETE FROM cv_versions WHERE cv_id = ? AND version <= ?')
    .bind(cvId, v - 30)
    .run();
  return v;
}

cvRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT id, title, template, target_opportunity_id, created_at, updated_at, data FROM cvs WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
    )
      .bind(u.id)
      .all<any>()
  ).results;
  return c.json({ cvs: rows.map((r) => ({ ...r, data: parseJson(r.data, {}) })) });
});

cvRoutes.post('/', async (c) => {
  const u = requireUser(c);
  const input = await body(
    c,
    z.object({
      title: z.string().trim().min(1).max(150).default('My CV'),
      template: z.enum(CV_TEMPLATES).default('modern'),
      from: z.enum(['blank', 'profile', 'data']).default('blank'),
      data: z.unknown().optional(),
    }),
  );
  const plan = await userPlan(c.env, u.id);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cvs WHERE user_id = ? AND deleted_at IS NULL')
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_cvs', n?.n ?? 0, 'CV(s)');
  let data: CvData;
  if (input.from === 'profile') {
    const p = await c.env.DB.prepare(
      "SELECT data FROM profiles WHERE user_id = ? AND type = 'career' AND deleted_at IS NULL",
    )
      .bind(u.id)
      .first<any>();
    if (!p) throw badRequest('Create a career profile first, or start from a blank CV.');
    data = cvFromCareerProfile(careerProfileSchema.parse(parseJson(p.data, {})), u.name, u.email);
  } else if (input.from === 'data') {
    const parsed = cvDataSchema.safeParse(input.data);
    if (!parsed.success) throw badRequest('CV data is invalid.');
    data = parsed.data;
  } else data = emptyCv(u.name, u.email);
  const id = newId('cv');
  const ts = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO cvs (id, user_id, title, template, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, input.title, input.template, JSON.stringify(data), ts, ts)
    .run();
  await snapshot(c.env, id, input.template, data, 'Created');
  return c.json({ id }, 201);
});

/** CV text → structured draft for the user to review. Uses the AI provider when enabled, else the deterministic parser. */
cvRoutes.post('/parse', async (c) => {
  const u = requireUser(c);
  await rateLimit(c, 'cv-parse', 30, 3600, u.id);
  const { text } = await body(
    c,
    z.object({ text: z.string().min(30, 'Not enough text was found in the document.').max(80000) }),
  );
  const result = await aiProvider(c.env).extractCv(text);
  return c.json(result);
});

cvRoutes.get('/:id', async (c) => {
  const { row, data } = await ownCv(c, c.req.param('id'));
  return c.json({
    cv: {
      id: row.id,
      title: row.title,
      template: row.template,
      target_opportunity_id: row.target_opportunity_id,
      updated_at: row.updated_at,
      data,
    },
  });
});

cvRoutes.put('/:id', async (c) => {
  const { u, row } = await ownCv(c, c.req.param('id'));
  const input = await body(
    c,
    cvSaveSchema.extend({ snapshot: z.boolean().optional(), note: z.string().max(200).optional() }),
  );
  const ts = nowIso();
  await c.env.DB.prepare(
    'UPDATE cvs SET title = ?, template = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
  )
    .bind(input.title, input.template, JSON.stringify(input.data), ts, row.id, u.id)
    .run();
  // Automatic snapshot at most every 10 minutes, or on explicit request.
  const last = await c.env.DB.prepare(
    'SELECT created_at FROM cv_versions WHERE cv_id = ? ORDER BY version DESC LIMIT 1',
  )
    .bind(row.id)
    .first<any>();
  let version: number | null = null;
  if (input.snapshot || !last || Date.now() - Date.parse(last.created_at) > 10 * 60_000)
    version = await snapshot(
      c.env,
      row.id,
      input.template,
      input.data,
      input.note ?? (input.snapshot ? 'Saved version' : 'Autosave'),
    );
  return c.json({ ok: true, updated_at: ts, version });
});

cvRoutes.delete('/:id', async (c) => {
  const { u, row } = await ownCv(c, c.req.param('id'));
  await c.env.DB.prepare('UPDATE cvs SET deleted_at = ? WHERE id = ? AND user_id = ?')
    .bind(nowIso(), row.id, u.id)
    .run();
  return c.json({ ok: true });
});

cvRoutes.post('/:id/duplicate', async (c) => {
  const { u, row, data } = await ownCv(c, c.req.param('id'));
  const plan = await userPlan(c.env, u.id);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cvs WHERE user_id = ? AND deleted_at IS NULL')
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_cvs', n?.n ?? 0, 'CV(s)');
  const id = newId('cv');
  const ts = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO cvs (id, user_id, title, template, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, `${row.title} (copy)`.slice(0, 150), row.template, JSON.stringify(data), ts, ts)
    .run();
  await snapshot(c.env, id, row.template, data, 'Duplicated');
  return c.json({ id }, 201);
});

cvRoutes.get('/:id/versions', async (c) => {
  const { row } = await ownCv(c, c.req.param('id'));
  const rows = (
    await c.env.DB.prepare(
      'SELECT version, template, note, created_at FROM cv_versions WHERE cv_id = ? ORDER BY version DESC',
    )
      .bind(row.id)
      .all()
  ).results;
  return c.json({ versions: rows });
});

cvRoutes.post('/:id/versions/:v/restore', async (c) => {
  const { u, row, data } = await ownCv(c, c.req.param('id'));
  const v = Number(c.req.param('v'));
  const ver = await c.env.DB.prepare('SELECT template, data FROM cv_versions WHERE cv_id = ? AND version = ?')
    .bind(row.id, v)
    .first<any>();
  if (!ver) throw notFound('Version not found.');
  await snapshot(c.env, row.id, row.template, data, `Before restoring version ${v}`);
  await c.env.DB.prepare('UPDATE cvs SET template = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(ver.template, ver.data, nowIso(), row.id, u.id)
    .run();
  return c.json({ ok: true });
});

/** Export gate: checks plan entitlements and counts usage. The file itself is rendered client-side. */
cvRoutes.post('/:id/export', async (c) => {
  const { u } = await ownCv(c, c.req.param('id'));
  const { format } = await body(c, z.object({ format: z.enum(['pdf', 'docx']) }));
  const plan = await userPlan(c.env, u.id);
  if (format === 'docx') requireFeature(plan, 'docx_export', 'Word (DOCX) export');
  requireWithin(plan, 'cv_exports_per_month', await usage(c.env, u.id, 'cv_export'), 'CV exports per month');
  const used = await incrementUsage(c.env, u.id, 'cv_export');
  return c.json({ ok: true, used, limit: plan.entitlements.cv_exports_per_month });
});

async function loadOpp(env: any, id: string) {
  const o = await env.DB.prepare(
    "SELECT id, title, organization, description, reference_no, requirements FROM opportunities WHERE id = ? AND moderation = 'approved'",
  )
    .bind(id)
    .first();
  if (!o) throw notFound('Opportunity not found.');
  return { ...o, requirements: parseJson(o.requirements, {}) } as any;
}

cvRoutes.post('/:id/tailor', async (c) => {
  const { u, row, data } = await ownCv(c, c.req.param('id'));
  const input = await body(
    c,
    z.object({ opportunity_id: z.string().max(60), create_copy: z.boolean().default(false) }),
  );
  const opp = await loadOpp(c.env, input.opportunity_id);
  const analysis = analyzeForOpportunity(data, opp);
  if (!input.create_copy) return c.json({ analysis });
  const plan = await userPlan(c.env, u.id);
  requireFeature(plan, 'cv_tailoring', 'Job-specific CV tailoring');
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cvs WHERE user_id = ? AND deleted_at IS NULL')
    .bind(u.id)
    .first<{ n: number }>();
  requireWithin(plan, 'max_cvs', n?.n ?? 0, 'CV(s)');
  const copy = tailoredCopy(data, analysis);
  const id = newId('cv');
  const ts = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO cvs (id, user_id, title, template, data, target_opportunity_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      id,
      u.id,
      `${row.title} — ${opp.title}`.slice(0, 150),
      row.template,
      JSON.stringify(copy),
      opp.id,
      ts,
      ts,
    )
    .run();
  await snapshot(c.env, id, row.template, copy, `Tailored for ${opp.title}`);
  return c.json({ analysis, id }, 201);
});

/* ---------- Cover letters ---------- */
export const coverLetterRoutes = new Hono<AppEnv>();

coverLetterRoutes.get('/', async (c) => {
  const u = requireUser(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT id, title, body, cv_id, opportunity_id, updated_at FROM cover_letters WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
    )
      .bind(u.id)
      .all()
  ).results;
  return c.json({ letters: rows });
});

coverLetterRoutes.post('/draft', async (c) => {
  const u = requireUser(c);
  const input = await body(c, z.object({ cv_id: z.string().max(60), opportunity_id: z.string().max(60) }));
  const plan = await userPlan(c.env, u.id);
  requireFeature(plan, 'cover_letters', 'Cover-letter drafting');
  const cvRow = await c.env.DB.prepare(
    'SELECT data FROM cvs WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(input.cv_id, u.id)
    .first<any>();
  if (!cvRow) throw notFound('CV not found.');
  const opp = await loadOpp(c.env, input.opportunity_id);
  const text = draftCoverLetter(cvDataSchema.parse(parseJson(cvRow.data, {})), opp);
  const id = newId('cl');
  const ts = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO cover_letters (id, user_id, cv_id, opportunity_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, u.id, input.cv_id, opp.id, `Cover letter — ${opp.title}`.slice(0, 150), text, ts, ts)
    .run();
  return c.json({ id, body: text }, 201);
});

coverLetterRoutes.put('/:id', async (c) => {
  const u = requireUser(c);
  const input = await body(
    c,
    z.object({ title: z.string().trim().min(1).max(150), body: z.string().max(10000) }),
  );
  const r = await c.env.DB.prepare(
    'UPDATE cover_letters SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(input.title, input.body, nowIso(), c.req.param('id'), u.id)
    .run();
  if (!r.meta.changes) throw notFound('Cover letter not found.');
  return c.json({ ok: true });
});

coverLetterRoutes.delete('/:id', async (c) => {
  const u = requireUser(c);
  const r = await c.env.DB.prepare(
    'UPDATE cover_letters SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
  )
    .bind(nowIso(), c.req.param('id'), u.id)
    .run();
  if (!r.meta.changes) throw notFound('Cover letter not found.');
  return c.json({ ok: true });
});
