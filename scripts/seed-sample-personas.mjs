// Seeds the fifteen fictional people from tests/fixtures/personas.ts into a LOCAL dev server, with the
// fixture opportunities (marked as demo data), their plans, profiles and CVs.
//
//   npx vite build && npx wrangler dev --port 8787        (another terminal)
//   node scripts/seed-sample-personas.mjs <out.json> [baseUrl]
//
// Writes <out.json> with each person's session cookie and CV id, for scripts/capture-sample-cvs.mjs.
// Refuses to run against anything but localhost. Re-running replaces the same fictional accounts.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURE_OPPORTUNITIES, PERSONAS } from '../tests/fixtures/personas.ts';

const out = process.argv[2];
const base = process.argv[3] ?? 'http://127.0.0.1:8787';
if (!out) throw new Error('Usage: node scripts/seed-sample-personas.mjs <out.json> [baseUrl]');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Local servers only.');

const PLAN_IDS = { basic: 'plan_basic', pro: 'plan_pro', elite: 'plan_elite' };
const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Runs SQL against the local D1 database through Wrangler. */
function localSql(sql) {
  const dir = mkdtempSync(join(tmpdir(), 'or-seed-'));
  const file = join(dir, 'seed.sql');
  writeFileSync(file, sql);
  const r = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'opportunity-radar-db', '--local', '--file', file],
    {
      shell: true,
      encoding: 'utf8',
    },
  );
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`SQL failed: ${r.stderr || r.stdout}`);
}

async function call(method, path, body, cookie) {
  const r = await fetch(base + '/api' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: base,
      'x-or-csrf': '1',
      ...(cookie ? { cookie: `or_session=${cookie}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = /or_session=([^;]+)/.exec(r.headers.get('set-cookie') ?? '');
  const json = await r.json().catch(() => null);
  if (r.status >= 400) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(json)}`);
  return { json, cookie: set?.[1] ?? cookie };
}

// Fresh start for the fictional accounts and fixtures (local database only).
localSql(
  [
    'DELETE FROM rate_limits;',
    `DELETE FROM users WHERE email IN (${PERSONAS.map((p) => sqlString(p.email)).join(', ')});`,
    "DELETE FROM opportunities WHERE source_url LIKE 'https://example.org/fixtures/%';",
  ].join('\n'),
);

const admin = await call('POST', '/auth/signin', {
  email: process.env.ADMIN_EMAIL ?? 'admin@example.test',
  password: process.env.ADMIN_PASSWORD ?? 'Password1234',
});
for (const f of FIXTURE_OPPORTUNITIES) await call('POST', '/admin/opportunities', f.input, admin.cookie);
// Label them as demo data so they are never mistaken for real listings.
localSql("UPDATE opportunities SET is_demo = 1 WHERE source_url LIKE 'https://example.org/fixtures/%';");
console.log(`created ${FIXTURE_OPPORTUNITIES.length} demo opportunities`);

const results = [];
const now = Date.now();
const iso = (days) => new Date(now + days * 86400000).toISOString();
for (const p of PERSONAS) {
  const password = `Sample-${randomUUID()}`; // never reused or stored
  const signupBody = { name: p.name, email: p.email, password, accept_terms: true };
  // The app limits signups per address per hour; this is local seeding, so reset the limit and retry once.
  const s = await call('POST', '/auth/signup', signupBody).catch(async (e) => {
    if (!String(e.message).includes('429')) throw e;
    localSql('DELETE FROM rate_limits;');
    return call('POST', '/auth/signup', signupBody);
  });
  const me = await call('GET', '/auth/me', undefined, s.cookie);
  localSql(
    `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
     VALUES (${sqlString(`sub_sample_${p.key}`)}, ${sqlString(me.json.user.id)}, ${sqlString(PLAN_IDS[p.plan])}, 'active',
       ${sqlString(iso(-1))}, ${sqlString(iso(29))}, ${sqlString(iso(-1))}, ${sqlString(iso(-1))});`,
  );
  await call('PATCH', '/auth/me', { onboarded: true }, s.cookie);
  await call('PUT', `/profiles/${p.profileType}`, { data: p.profile }, s.cookie);
  let cvId = null;
  if (p.kind !== 'company') {
    const from = p.profileType === 'academic' ? 'academic_profile' : 'profile';
    const title = p.kind === 'scholar' ? 'Scholarship CV' : 'Main CV';
    cvId = (await call('POST', '/cvs', { title, template: p.cvTemplate, from }, s.cookie)).json.id;
  }
  results.push({
    key: p.key,
    name: p.name,
    kind: p.kind,
    plan: p.plan,
    cookie: s.cookie,
    cvId,
    template: p.cvTemplate,
  });
  console.log(`seeded ${p.name}`);
}
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`wrote ${out}`);
