# Data model (Cloudflare D1)

Migrations live in `migrations/` and are applied in order with
`wrangler d1 migrations apply opportunity-radar-db [--local|--remote]`. All timestamps are ISO-8601 UTC strings.
JSON columns hold text validated by the zod schemas in `shared/`.

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `users` | Accounts, role (`user`/`admin`), status, timezone | `email` unique (case-insensitive) |
| `sessions` | Session id = SHA-256 of the cookie token | FK user (cascade), index on expiry |
| `password_resets` | Hashed one-time reset tokens, 1 h expiry | FK user |
| `rate_limits` | Fixed-window counters per action and hashed client key | PK key |
| `profiles` | `career` / `academic` / `business` data JSON, completeness | one active profile per user and type (partial unique index) |
| `documents` | Metadata for private files; bytes in KV under a random key | `storage_key` unique |
| `cvs`, `cv_versions` | CV JSON and numbered snapshots (30 kept) | `(cv_id, version)` unique |
| `cover_letters` | Draft letters | FK user |
| `sources` | Source registry: owner, type, connector, config, terms, automation, refresh, health | `slug` unique |
| `ingestion_runs` | One per run, with counts | `idempotency_key` unique |
| `ingestion_tasks` | One per source per run: status, attempts, lease, backoff, last error | `(run_id, source_id)` unique |
| `opportunities` | Canonical opportunity with category, requirements, meta, URLs, deadline + tz, status, verification, moderation | `canonical_key` unique; indexes on category/status, deadline, first_seen, country, source |
| `source_records` | Each source's record of an opportunity (provenance), content hash, missing count | `(source_id, external_id)` unique |
| `opportunity_events` | Created, deadline/status/URL changes, verification, merges, link checks | index by opportunity |
| `matches` | Stored match explanations for alerted opportunities | `(profile_id, opportunity_id)` unique |
| `user_opportunity` | Saved / dismissed | PK `(user_id, opportunity_id)` |
| `applications` | Applications and bids (kind), statuses, dates, notes, CV and document links | indexes by user and follow-up |
| `notifications` | In-app notifications | `(user_id, dedupe_key)` unique (alert de-duplication) |
| `notification_deliveries` | Email deliveries: status, attempts, provider message id/error, send-after (quiet hours) | `(notification_id, channel)` unique |
| `notification_prefs` | Per-user alert preferences | PK user |
| `plans` | Plans, prices, entitlements JSON | `code` unique |
| `subscriptions` | Active periods, linked payment | index by user/status |
| `payments` | Checkout records with provider references and normalised status | `merchant_reference` and `provider_tracking_id` unique |
| `payment_events` | Every provider status observed | `event_key` unique (idempotency) |
| `mock_payments` | Development payment simulator only (refused in production) | |
| `usage_counters` | Monthly counters (e.g. CV exports) | PK `(user_id, metric, period)` |
| `audit_logs` | Admin and security-relevant actions | indexes by time and actor |
| `system_config` | Runtime settings editable by admins | PK key |
| `scheduler_locks` | Lease lock preventing overlapping ingestion runs | PK name |
| `contact_messages` | Contact form submissions (admin-only) | |

## Retention and deletion

- Soft delete (`deleted_at`) for profiles, CVs, documents, applications and cover letters, so recent mistakes can be
  investigated; document bytes are deleted from storage immediately.
- Account deletion removes profiles, CVs, letters, documents (and their bytes), applications, saved items,
  notifications, matches and sessions, and anonymises the user row. Payment rows are kept for accounting.
- Seed data (`0002_reference_data.sql`) contains plans, the source registry and configuration only — no users and no
  opportunities. Nothing is ever shown as live unless it came from a source or an administrator.
