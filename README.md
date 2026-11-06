# Opportunity Radar

One profile, every opportunity that fits. Opportunity Radar combines a professional CV builder with explainable
matching of jobs, scholarships, grants and tenders, worldwide.

- **Career, academic and business profiles** in one account.
- **CV Builder**: build from scratch or import a PDF/DOCX CV, live A4 preview, three templates, PDF and DOCX export,
  version history, job-specific tailoring and cover-letter drafts. It never invents facts.
- **Opportunity discovery** from official and permitted sources on a configurable schedule (default every six hours),
  with deduplication, verification labels and status tracking.
- **Explainable matching** that keeps _eligibility_ separate from _relevance_, per profile type.
- **Alerts, saved opportunities and an application/bid tracker.**
- **Plans and payments** (Pesapal adapter, server-side verification) and a full **admin console**.

Runs entirely on Cloudflare Workers (static assets + API), D1 (database), Workers KV (private documents) and Cron
Triggers (scheduler).

## Quick start (local)

Requirements: Node.js 20+ (tested on 24), npm.

```bash
npm install
cp .dev.vars.example .dev.vars        # edit values; never commit .dev.vars
npm run db:migrate:local               # creates the local D1 database
npm run build                          # type-checks and builds the client into dist/
npx wrangler dev --port 8787 --test-scheduled
```

Open http://127.0.0.1:8787. Sign up with an address listed in `ADMIN_EMAILS` to get the admin console at `/admin`.

For front-end hot reload run `npm run dev` (Vite on :5173 proxying `/api` to Wrangler on :8787).

Trigger one scheduler tick locally (runs ingestion, alerts, reminders and deliveries):

```bash
curl "http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*"
```

## Tests and checks

| Command                                 | What it runs                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run typecheck`                     | TypeScript for client and Worker                                                         |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                                                                        |
| `npm test`                              | Unit + integration tests (Vitest; integration tests use a real local D1/KV via Wrangler) |
| `npm run test:coverage`                 | Same, with coverage                                                                      |
| `npm run test:e2e`                      | Playwright browser tests (desktop + mobile) against a running `wrangler dev`             |
| `node scripts/make-fixtures.mjs`        | Regenerates the sample CV fixtures used by e2e tests                                     |

See [docs/TEST_PLAN.md](docs/TEST_PLAN.md) for scenarios and current results.

## Project layout

```
shared/            Types, zod schemas, CV model and parser used by both client and Worker
worker/            Cloudflare Worker (Hono API + scheduled handler)
  domain/          Business logic: matching, ingestion pipeline + connectors, alerts, payments, tailoring
  lib/             Infrastructure: auth/sessions, security middleware, crypto, URL policy, providers, storage
  routes/          HTTP routes (thin: validate → call domain → respond); routes/admin/ for the admin API
src/               React client (Vite, Tailwind)
  cv/              CV templates, exporters, editor modules
  pages/           public/, app/ (signed-in), admin/
migrations/        D1 SQL migrations (applied in order)
tests/             unit/, integration/, e2e/, fixtures/ (real API samples)
docs/              Product, architecture, data model, sources, matching, security, tests, deployment, release
```

## Administration

- **Sources** (`/admin/sources`): add/enable/disable connectors, run one source now, see health and last errors.
- **Ingestion runs** (`/admin/runs`): run history, per-source task status, retry dead tasks.
- **Opportunities** (`/admin/opportunities`): add curated listings, edit requirements, verify, reject, expire,
  merge duplicates, check links.
- **Plans** (`/admin/plans`): prices and entitlements (server-enforced).
- **Configuration** (`/admin/config`): discovery interval, stale thresholds, matching weights, payment switch, and a
  list of required environment variables by name (values are never shown).
- **Audit log** (`/admin/audit`): who did what, when.

## Deployment

See [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md). In short:

```bash
npx wrangler d1 migrations apply opportunity-radar-db --remote
npm run build && npx wrangler deploy
```

Secrets are set with `npx wrangler secret put NAME` and are listed by name in the deployment guide.

## Documentation

[Product spec](docs/PRODUCT_SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) ·
[Opportunity sources](docs/OPPORTUNITY_SOURCES.md) · [AI and matching](docs/AI_AND_MATCHING.md) ·
[Security and privacy](docs/SECURITY_AND_PRIVACY.md) · [Test plan](docs/TEST_PLAN.md) ·
[Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md) ·
[Release report](docs/RELEASE_REPORT.md)
