# Test plan and results

## Levels

| Level               | Tooling                                                                                 | Location              | Runs against                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                | Vitest                                                                                  | `tests/unit`          | Pure functions (matching, parser, extraction, connectors with real API fixtures, URL policy, sanitiser, file sniffing, crypto, Pesapal adapter with mocked HTTP, redirect guard) |
| Integration         | Vitest + Wrangler `getPlatformProxy`                                                    | `tests/integration`   | The real Hono app with a fresh in-memory local D1 and KV per file, all migrations applied                                                                                        |
| End-to-end          | Playwright (Chromium desktop 1366×860 and Pixel 7)                                      | `tests/e2e`           | `wrangler dev` serving the production build with a local D1                                                                                                                      |
| Visual / responsive | Playwright screenshots of 22 pages × 2 viewports with overflow and console-error checks | ad hoc script         | `wrangler dev`                                                                                                                                                                   |
| Deployed smoke      | curl + Playwright against the workers.dev URL                                           | see RELEASE_REPORT.md | Production Worker                                                                                                                                                                |

## Scenario coverage

### Authentication and isolation (`auth-isolation.test.ts`)

Registration, sign-in/out, wrong password, duplicate email (case-insensitive), weak password, terms required, password
reset single-use with session revocation, identical response for unknown emails, CSRF header and cross-origin refusal,
401 on every protected route, cross-user access to CVs/versions/applications/profiles refused, non-admins refused on
every admin route and cannot self-promote, suspended users lose sessions, oversized JSON → 413.

### Profiles, documents, feed, tracker, alerts, CV (`flows.test.ts`)

Create/edit/delete career profile; free-plan profile limit (402); three profiles on a paid plan; invalid profile data;
valid PDF upload with owner-only download, attachment headers, random storage key and byte deletion; executable,
HTML, mismatched extension, empty and oversized uploads rejected; feed ranks eligible above a PhD-required listing and
explains it; save/dismiss/hide; application vs bid kept separate with duplicate protection; new-match alert sent once,
never for expired listings, weekly preference → no instant email; plan-gated alert frequency; deadline and follow-up
reminders once per day; email provider failure recorded with retry while the in-app notification remains; no-provider
→ `skipped`; CV from profile, snapshot/restore, plan limits on CVs/DOCX/exports, tailoring analysis, paid-only tailored
copy and cover letters; CV text parsing without invented facts; data export and permanent account deletion.

### Ingestion (`ingestion.test.ts`, `tests/unit/ingestion.test.ts`)

Real World Bank, Grants.gov, Remotive and Lever fixtures; provenance and verification labels; local deadline → UTC;
contract awards skipped; individual consultancy vs firm; repeated run → no duplicates or spurious updates; deadline
change recorded as an event; cross-source duplicate merged keeping official verification and URL; failing source
retried with backoff then dead-lettered while others complete; no closure on fetch failure; overlapping runs and
duplicate cron triggers refused; interval-based scheduling; "status uncertain" only after 3 complete-listing misses and
restored on reappearance; deadline expiry; RSS/Atom parsing, XXE refusal, SSRF refusal; requirement extraction.

### Matching (`matching.test.ts`)

Relevant job explained with facts; incompatible mandatory requirement (PhD, experience gap, nationality); missing
nationality → potential/insufficient; empty profile → no score; passed deadline; firm-only notice for a career
profile; single keyword cannot max out relevance; scholarship match on stated criteria; GPA and level prerequisites;
relevant tender; missing certifications/turnover flagged; turnover below minimum; past contracts; individual
consultancy never treated as a tender; expired tax clearance; region-aware country rules; ranking; bounded weights.

### Payments and admin (`payments-admin.test.ts`, `security.test.ts`)

Plan listing; pending provider status changes nothing; completion activates exactly once (duplicate callbacks);
entitlements unlocked server-side; failed and cancelled; late failure cannot downgrade; refund revokes; amount or
currency mismatch never activates; other users cannot drive a checkout; Pesapal IPN wrong secret → 403 and unknown
order acknowledged without change; mock provider refused in production; Pesapal adapter request/response contract.
Admin: SSRF-unsafe source refused, source creation/enabling audited, curated listing with HTML stripped, duplicate
refused, reject hides from public, approve, merge; plan price change visible publicly, free plan price fixed, config
bounds, environment check without values, non-admins refused, admins cannot self-demote.

### End-to-end (`tests/e2e/app.spec.ts`)

Home/pricing/opportunities render without console errors or horizontal overflow; skip link; 404 and protected-route
redirect; sign-up → onboarding → career profile → ranked opportunities → detail with explanation → save → saved list;
PDF CV import → review → editor → autosave → template switch → print view, and the career profile filled from the CV;
DOCX import; unsupported file rejected; development payment simulator upgrade confirmed server-side; admin console
access and redirect for non-admins.

## Latest results (6 Nov 2026, local)

| Check                           | Result                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | pass                                                                                          |
| `npm run lint`                  | pass (0 problems)                                                                             |
| `npm run format:check`          | pass                                                                                          |
| `npm test` (unit + integration) | **133 passed / 0 failed** (9 files)                                                           |
| Coverage (`worker/`, `shared/`) | 82% statements, 67% branches, 90% functions; matching 90%, payments 93%                       |
| `npm run test:e2e`              | **12 passed / 0 failed / 6 skipped** (desktop + mobile; desktop-only flows skipped on mobile) |
| Production                      | public e2e suite 5 passed; authenticated smoke script 14/14                                   |
| `npm audit --omit=dev`          | 0 vulnerabilities                                                                             |
