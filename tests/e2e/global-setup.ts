import { execSync } from 'node:child_process';

/**
 * End-to-end runs sign up many accounts from one IP, which (correctly) trips the signup rate limit.
 * For local runs only, reset the local D1 rate-limit counters before the suite. Never touches a deployment.
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  execSync('npx wrangler d1 execute opportunity-radar-db --local --command "DELETE FROM rate_limits"', {
    stdio: 'ignore',
  });
}
