# Architecture

## Runtime

```
Browser ──► Cloudflare Worker "opportunity-radar"
             ├─ Static assets (Vite build in dist/, SPA fallback, security headers via public/_headers)
             ├─ /api/*  → Hono app (worker/index.ts)
             └─ scheduled() every 15 min → tick()
                    ├─ recover stale runs
                    ├─ start a discovery run when the configured interval (default 6 h) has elapsed
                    ├─ drain ingestion tasks (bounded per tick)
                    ├─ expire past-deadline opportunities
                    ├─ new-match alerts · reminders · digests · email deliveries
                    └─ expire stale payment checkouts
Bindings: DB (D1), DOCS (Workers KV, private documents)
```

### Why this stack

The original repository could not be accessed (see the release report), so the application was built new for the
user's Cloudflare account. Choices:

| Concern    | Choice                               | Reason                                                                                                                    |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | Cloudflare Workers + static assets   | Single deployable unit; no servers to manage.                                                                             |
| API        | Hono                                 | Small, Workers-native, typed middleware.                                                                                  |
| Database   | D1 (SQLite)                          | Available on the account without external credentials; relational with FKs and indexes.                                   |
| Documents  | Workers KV (private binding)         | The Cloudflare login has no R2 permission; KV has no public URL. Behind a `DocumentStore` interface so R2 can replace it. |
| Queue      | D1 task table with leases            | Works on any plan; gives idempotency, retries with backoff and a dead-letter state that is easy to inspect and test.      |
| Scheduler  | One Cron Trigger (`*/15 * * * *`)    | The interval itself lives in `system_config` so admins can change it without a deploy.                                    |
| Client     | React 18 + React Router 7 + Tailwind | Fast to iterate, good mobile performance, code-split per page.                                                            |
| Validation | zod 4 schemas in `shared/`           | One schema for client forms and server validation.                                                                        |

## Layering (Worker)

```
routes/   HTTP only: parse + validate input (zod), enforce auth/ownership/entitlements, call domain, shape JSON.
domain/   Business rules, no HTTP: matching/, ingestion/ (pipeline + connectors), feed.ts, alerts.ts,
          payments/, tailor.ts, opportunities.ts (row → API shape).
lib/      Infrastructure: auth.ts (sessions), security.ts (CSRF, headers, rate limit), crypto.ts, url.ts (SSRF-safe
          fetch), sanitize.ts, filetype.ts, providers.ts (email, AI, document storage, env checks), store.ts
          (config, plans/entitlements, usage, audit), http.ts (errors, body parsing).
```

Rules followed:

- Every user-owned query filters by `user_id` from the session (no IDs trusted from the client).
- Admin routes are mounted under one router that applies `requireAdmin` to everything.
- Domain functions take `env` and plain data; they are unit-tested without HTTP.
- Connectors implement one `Connector` interface and return normalised items plus a `complete` flag.

## Ingestion pipeline

1. `startRun` acquires a lease lock (`scheduler_locks`), records an `ingestion_runs` row with an idempotency key
   (`cron:<interval>:<slot>` for scheduled runs) and creates one `ingestion_tasks` row per enabled source.
2. `drainTasks` claims due tasks with a conditional `UPDATE` (lease of 10 minutes), runs the connector, upserts items,
   and records success or failure. Failures retry with exponential backoff (5, 10, 20 min); permanent errors or the
   third failure mark the task `dead`. One source failing never affects another.
3. `upsertItems` compares content hashes per `(source, external_id)`; unchanged items are bulk-touched, changed items
   are updated with events (`deadline_changed`, `url_changed`, `status_changed`, `amended`), new items are matched to an
   existing canonical opportunity (reference number → URL → organisation/title/country/deadline signature) or inserted.
   Verification only ever upgrades, and aggregator URLs never replace official ones.
4. When a source returns its _complete_ listing, records not seen for N runs (default 3) become `status_uncertain`;
   a single failed fetch never closes anything. Past published deadlines become `expired`.
5. The run is finalised (`completed`, `completed_with_errors`, `failed`) and the lock released.

## Matching

`domain/matching` has one matcher per profile type (career, academic, business). Each produces hard-constraint
results (disqualifiers, missing facts) and weighted relevance components. `common.finalize` combines them into
eligibility, a 0–100 score (or `null` when coverage is too low), confidence and the next action. `domain/feed.ts`
applies the matchers to stored rows for the feed, dashboard and alerts so all surfaces rank identically. Details in
[AI_AND_MATCHING.md](AI_AND_MATCHING.md).

## Client

- `src/App.tsx` declares routes; every page is lazy-loaded.
- `src/lib/api.ts` adds the CSRF header and normalises errors; `src/lib/auth.tsx` holds the session context.
- `src/components/ui.tsx` contains the design-system primitives; `FormBuilder.tsx` renders the three profile forms
  from configuration (`pages/app/profileConfigs.ts`).
- CV: `src/cv/templates.tsx` (three A4 templates), `src/cv/exporters.ts` (DOCX export and in-browser PDF/DOCX text
  extraction), `src/cv/editor/*` (editor panels), `pages/app/CvEditor.tsx` (state, autosave, layout).
- PDF export uses a print-optimised A4 page (`/app/cvs/:id/print`) and the browser's "Save as PDF", which produces a
  text-based PDF that applicant-tracking systems can read.
