# Cloudflare deployment

## Target (as deployed on 6 Nov 2026)

| Item          | Value                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| Account       | Omodingisaac123@gmail.com's Account (`84426f09872bd9b45fe44cf292757220`)                    |
| Worker        | `opportunity-radar`                                                                         |
| URL           | https://opportunity-radar.omodingisaac123.workers.dev (no custom domain, no DNS changes)    |
| D1 database   | `opportunity-radar-db` (`153ae2e2-636c-4d09-a01d-013caa6eb2db`) — created for this app      |
| KV namespace  | `opportunity-radar-docs` (`9d0fbd6b65a7421c9e7484151f300486`) — created for this app        |
| Cron Trigger  | `*/15 * * * *` (scheduler tick; discovery runs every `ingestion.interval_hours`, default 6) |
| Observability | Workers Logs enabled                                                                        |

Existing account resources (`fip-prod`, `jerseyville-db` D1 databases and the `link-publishers-orders` KV namespace)
were not touched. No R2, Queues, Hyperdrive or paid add-ons are used.

## Configuration

Plain variables (in `wrangler.jsonc`): `ENVIRONMENT=production`, `APP_NAME`, `APP_URL`.

Secrets (set with `npx wrangler secret put NAME`; never commit them):

| Secret                                            | Required     | Purpose                                                                        |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `ADMIN_EMAILS`                                    | **Yes**      | Comma-separated emails that become administrators when they sign up or sign in |
| `EMAIL_PROVIDER`                                  | for email    | `sendgrid` or `resend`                                                         |
| `EMAIL_API_KEY`                                   | for email    | Provider API key                                                               |
| `EMAIL_FROM`                                      | for email    | Verified sender address                                                        |
| `PAYMENT_PROVIDER`                                | for payments | `pesapal`                                                                      |
| `PESAPAL_ENV`                                     | for payments | `sandbox` (default) or `live`                                                  |
| `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET` | for payments | Merchant credentials from Pesapal                                              |
| `PESAPAL_IPN_ID`                                  | for payments | ID returned when registering the IPN URL                                       |
| `PESAPAL_IPN_SECRET`                              | for payments | A long random string used in the IPN URL path                                  |
| `RELIEFWEB_APPNAME`                               | optional     | Approved ReliefWeb API appname                                                 |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`           | deferred     | Reserved for the future AI integration                                         |

Admin → Configuration lists each of these by name with present/missing status (values are never displayed).

## Deploy / update

```bash
npm ci
npm run typecheck && npm run lint && npm test          # quality gates
npx wrangler d1 migrations apply opportunity-radar-db --remote   # only applies new migrations
npm run build
npx wrangler versions upload                            # preview version (staging) with its own preview URL
#   smoke-test the preview URL, then promote:
npx wrangler versions deploy
```

(`npx wrangler deploy` uploads and promotes in one step; it was used for the first release because a Worker must exist
before preview versions can be uploaded.)

## Activating Pesapal (after merchant approval)

1. In Pesapal, obtain sandbox consumer key/secret. Set `PAYMENT_PROVIDER=pesapal`, `PESAPAL_ENV=sandbox`, the key and
   secret, and a random `PESAPAL_IPN_SECRET` as secrets.
2. Register the IPN URL `https://opportunity-radar.omodingisaac123.workers.dev/api/billing/ipn/pesapal/<PESAPAL_IPN_SECRET>`
   (GET) with Pesapal's `RegisterIPN` endpoint; store the returned id as `PESAPAL_IPN_ID`.
3. Turn on Admin → Configuration → "Enable live checkout" and complete a sandbox payment end to end; confirm the
   subscription activates and the payment appears in Admin → Payments.
4. Repeat with live credentials and `PESAPAL_ENV=live`. Only then describe payments as live.

## Rollback

```bash
npx wrangler deployments list            # find the previous version id
npx wrangler rollback <version-id>       # instant rollback of code and assets
```

Database migrations are additive; a rollback of code does not require a schema rollback. Before any destructive
migration, export the database: `npx wrangler d1 export opportunity-radar-db --remote --output backup.sql`.

## Operations

- Watch scheduler runs in Admin → Ingestion runs; failed source tasks show the error and can be retried.
- `npx wrangler tail opportunity-radar` streams structured logs (`ingestion.*`, `tick.*`, `email.*`, `payment.*`).
- If ticks hit Workers Free CPU limits, lower `ingestion.max_tasks_per_tick` to 1 in Admin → Configuration.
