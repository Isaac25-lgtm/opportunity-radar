import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://127.0.0.1:8787';

/** Runs SQL against the LOCAL D1 database via a temporary file (no shell quoting). */
function localSql(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'or-e2e-'));
  const file = join(dir, 'setup.sql');
  try {
    writeFileSync(file, sql);
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'opportunity-radar-db', '--local', `--file=${file}`], {
      stdio: 'ignore',
      shell: true,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Prepares the LOCAL environment for end-to-end tests (never runs against a deployment):
 * - applies migrations to the local D1 database;
 * - resets local rate-limit counters (the suite signs up many accounts from one IP, which correctly trips them);
 * - upserts one opportunity flagged as demo data so feed tests do not depend on live third-party APIs;
 * - ensures the admin test account (listed in .dev.vars ADMIN_EMAILS) exists.
 */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'opportunity-radar-db', '--local'], {
    stdio: 'ignore',
    shell: true,
  });
  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + 60 * 86400_000).toISOString();
  localSql(`
DELETE FROM rate_limits;
INSERT OR REPLACE INTO opportunities (id, canonical_key, category, title, organization, description, summary, country,
  countries, location, remote, source_id, source_url, application_url, official_url, deadline_at, status, verification,
  moderation, meta, requirements, requirements_source, is_demo, first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
VALUES ('opp_e2e_fixture', 'e2e:fixture', 'job', 'Procurement Officer (demo)', 'Demo Organisation',
  'Demo listing for automated tests. Requires procurement, contract management and Excel.', 'Demo listing for automated tests.',
  'Uganda', '[]', 'Kampala', 'onsite', 'src_curated_jobs', 'https://example.org/demo', 'https://example.org/demo',
  'https://example.org/demo', '${deadline}', 'open', 'admin_verified', 'approved', '{}',
  '{"skills":["procurement","excel"]}', 'admin', 1, '${now}', '${now}', '${now}', '${now}', '${now}');
`);
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-or-csrf': '1' },
    body: JSON.stringify({
      name: 'Admin',
      email: 'admin@example.test',
      password: 'Password1234',
      accept_terms: true,
    }),
  });
  if (res.status !== 201 && res.status !== 409)
    throw new Error(`Could not prepare admin test account (${res.status})`);
  localSql('DELETE FROM rate_limits;');
}
