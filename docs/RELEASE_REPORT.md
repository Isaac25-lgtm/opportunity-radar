# Release report — Opportunity Radar v1.0 (6 Nov 2026)

The release code is now on [GitHub](https://github.com/Isaac25-lgtm/opportunity-radar/tree/release/v1.0).
For current production administrator setup, use [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md#provisioning-production-administrators).

## 1. Summary

Opportunity Radar is live on the owner's Cloudflare account at
**https://opportunity-radar.omodingisaac123.workers.dev**. It provides career, academic and business profiles, a
resume.io-style CV builder (import, edit, three templates, PDF/DOCX export, versions, tailoring, cover letters),
scheduled discovery from official and permitted sources, explainable matching, alerts, a tracker, plans with
server-enforced entitlements, a Pesapal payment adapter, and an admin console.

**Important deviation:** the specified repository `github.com/Isaac25-lgtm/opportunity-radar` could not be accessed
(GitHub returned "Repository not found"; it is private or renamed and no GitHub credentials are available on this
machine). As instructed by the owner ("build the fully functional site"), the application was built new in
`F:\MY FILES\DATA SCIENCE\CV BUILDER`. No earlier code or data was reused or altered.

## 2. Architecture

Cloudflare Workers (Hono API + static assets) · D1 · Workers KV for private documents · one Cron Trigger. See
ARCHITECTURE.md. Deviations from the brief, with reasons:

| Brief                                                 | Built                                                                                                                                              | Why                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Preserve the existing Next.js/Prisma/PostgreSQL stack | Workers + Hono + D1                                                                                                                                | Existing code was inaccessible; D1 needs no external credentials and is native to the account. |
| R2 for documents                                      | Workers KV (private binding) behind a storage interface                                                                                            | The Cloudflare login lacks R2 permission.                                                      |
| Cloudflare Queues                                     | D1 task table with leases, backoff and dead-letter state                                                                                           | Works on any plan and is fully testable; Queues can replace it later.                          |
| AI-assisted parsing and writing                       | Deterministic, non-generative implementations with an AI provider interface                                                                        | Owner asked for AI integration later.                                                          |
| Copy resume.io's look                                 | Same layout conventions (split editor, dark preview pane, blue CTAs, template gallery) with Opportunity Radar's own name, logo, copy and templates | Copying another company's brand, logo or text would misrepresent the product.                  |

## 3. Completed features

Accounts (sign-up, sign-in, password change/reset, data export, account deletion) · three profile types with
completeness · document vault · CV import (PDF/DOCX), editor, templates, accent colours, autosave, history/restore,
duplicate, tailoring, cover-letter drafts, PDF/DOCX export · opportunity feed with filters and live matching ·
opportunity detail with requirements, explanation, provenance, history and outbound-link warning · save/dismiss ·
application and bid tracker · in-app notifications, preferences, quiet hours, reminders, digests, email delivery
pipeline · plans/entitlements, checkout, return verification, IPN · admin: metrics, users, sources, runs, curation,
verification, moderation, merge, link check, plans, payments, audit, configuration, contact messages · public site:
home, CV builder, templates, how it works, pricing, sources, help, contact, privacy, terms.

## 4. Integrations that are live

| Integration                                   | Evidence                                 |
| --------------------------------------------- | ---------------------------------------- |
| World Bank procurement API                    | Production run 13:15 UTC: 47 new notices |
| Grants.gov search API                         | 26 new opportunities                     |
| Remotive API (aggregator, attributed)         | 9 new jobs                               |
| Cloudflare D1, KV, Cron Trigger, Workers Logs | In use in production                     |

## 5. Integrations that need credentials, approval or setup

| Integration                 | What is needed                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Admin access**            | Provision a verified account by user ID in D1. See the Cloudflare deployment guide.                                                |
| Email (SendGrid or Resend)  | `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` secrets. Until then alerts are in-app only and password-reset emails are not sent. |
| Pesapal payments            | Merchant approval and credentials; sandbox verification (steps in CLOUDFLARE_DEPLOYMENT.md). **Payments are not activated.**       |
| ReliefWeb                   | Approved appname → `RELIEFWEB_APPNAME`, then enable the source.                                                                    |
| AI provider                 | Deferred by request.                                                                                                               |
| Scholarships / PPDA tenders | Administrator curation until permitted feeds are confirmed.                                                                        |

## 6. Database migrations

`0001_init.sql`, `0002_reference_data.sql`, `0003_contact_messages.sql` — applied to the new production database
`opportunity-radar-db` (all ✅). No destructive migrations.

## 7. Tests executed (actual results)

| Command                                                                        | Result                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npx vitest run` (unit + integration)                                          | **133 passed, 0 failed** (9 files)                                        |
| `npx playwright test` (local, desktop + mobile)                                | **12 passed, 0 failed, 6 skipped** (desktop-only flows skipped on mobile) |
| Playwright public-site suite against production and the staged preview version | 5 passed, 1 skipped                                                       |
| Authenticated production smoke script (creates and deletes its own account)    | 14/14 checks passed                                                       |
| Coverage (`worker/`, `shared/`)                                                | 82% statements, 67% branches, 90% functions (matching 90%, payments 93%)  |

## 8. Type-check, lint, build

`tsc` (client and Worker): pass · ESLint: 0 problems · Prettier: clean · `vite build`: pass · Worker bundle
1.1 MiB (205 KiB gzip), startup 31 ms.

## 9. Security findings and resolution

| Finding                                                                                              | Resolution                                                                        |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| zod < 4.6.6 memory exhaustion on oversized collections (high)                                        | Upgraded to zod 4.6.7; added a 1 MB JSON body cap                                 |
| React Router open redirect via backslash (high/moderate)                                             | Upgraded to React Router 7.18.5; redirect guard rejects backslashes (unit-tested) |
| mammoth (moderate)                                                                                   | Upgraded to 1.13.0                                                                |
| Vite, Vitest/tinypool, Playwright, PostCSS (dev tooling)                                             | Upgraded                                                                          |
| `window.scrollTo()` returns a Promise in current Chromium → React effect-cleanup crash on navigation | Fixed; lint rule now forbids expression-bodied effects                            |
| minimatch via typescript-eslint (moderate, dev only)                                                 | Accepted; not shipped                                                             |

`npm audit --omit=dev`: 0 vulnerabilities. Full control list in SECURITY_AND_PRIVACY.md.

## 10. Cloudflare target

Account "Omodingisaac123@gmail.com's Account" (`84426f09872bd9b45fe44cf292757220`), Worker `opportunity-radar`.
Existing Workers, D1 databases (`fip-prod`, `jerseyville-db`) and KV namespace (`link-publishers-orders`) untouched.
No custom domain, routes or DNS changed.

## 11. Deployed URL

https://opportunity-radar.omodingisaac123.workers.dev

## 12. Deployed version

Worker version `43a679b9-aafd-4108-9c4d-bab478754803` (uploaded as a preview, smoke-tested at its preview URL,
then promoted to 100%). Previous version `37f1879a-2483-4481-b71d-438a52c3941c` is available for rollback.
Git branch `release/v1.0` (local), commit recorded in the final hand-over message.

## 13. Cron schedule

`*/15 * * * *` — **active**. Discovery runs when `ingestion.interval_hours` (default 6) has elapsed. First production
run: started 13:15:31 UTC, completed, 3/3 sources, 82 opportunities.

## 14. Bindings

Created: D1 `opportunity-radar-db` (`153ae2e2-636c-4d09-a01d-013caa6eb2db`), KV `opportunity-radar-docs`
(`9d0fbd6b65a7421c9e7484151f300486`). Reused: none. Not used: R2, Queues, Hyperdrive.

## 15. Environment variables and secrets (names only)

Vars: `ENVIRONMENT`, `APP_NAME`, `APP_URL`. Secrets: `EMAIL_PROVIDER`,
`EMAIL_API_KEY`, `EMAIL_FROM`, `PAYMENT_PROVIDER`, `PESAPAL_ENV`, `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`,
`PESAPAL_IPN_ID`, `PESAPAL_IPN_SECRET`, `RELIEFWEB_APPNAME`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`.

## 16. Remaining limitations and risks

See KNOWN_LIMITATIONS.md. Main items: admin secret to set; email and payments not activated; scholarship/PPDA
coverage relies on curation; KV instead of R2; heuristic requirement extraction; Workers Free CPU limits at scale;
privacy policy not legally reviewed.

## 17. Rollback

```bash
npx wrangler rollback 37f1879a-2483-4481-b71d-438a52c3941c
```

Schema changes are additive, so code rollback needs no database rollback.

## 18. Git

All work is committed on the local branch `release/v1.0`. It has **not** been pushed: the target repository is not
accessible from this machine. To publish it, grant access (or create the repository), then
`git remote add origin <url> && git push -u origin release/v1.0`.
