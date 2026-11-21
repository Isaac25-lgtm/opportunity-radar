# Codex handoff — Opportunity Radar, professional visual refresh

Date: 22 November 2026 · Production: https://opportunity-radar.omodingisaac123.workers.dev

## 1. Where things are

| Item                | Value                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Repository          | https://github.com/Isaac25-lgtm/opportunity-radar                                          |
| Working branch      | `design/professional-refresh` (pushed), based on `audit/release-v1.0` @ `fdf5fdb`          |
| Refresh commit      | `21a3270` “Professional visual refresh, browser-tested fixes”                              |
| Main branch for PRs | `release/v1.0` — the refresh branch is **not merged yet**; open a PR when the owner agrees |
| Live Worker version | `89bdb22a-5373-40d9-b8db-fa90406df00d` at 100%                                             |
| Rollback version    | `6757f62d-945a-4f63-8969-3320705e07c9` (audit hardening, previous production)              |
| Database migrations | None in this release                                                                       |

## 2. What the owner asked for, and the rule that came out of it

The owner asked for a site that looks professional and not AI-generated, modelled on their own SaaS site
(imprintsites.omodingisaac123.workers.dev, with motionimprints.tech as a second reference). Midway they clarified:

> everything remains organized the same way but the aesthetic premium like i guided

**Rule: change only the look. Keep every page's sections, order, copy, links and nav items.** A first draft of the home
page that reorganised sections (adding pricing and a showcase, dropping features) was reverted to the original
structure. Before restyling any page, read `git show fdf5fdb:<file>` and keep its section list. Removing AI-sounding
tells (emoji, em-dash flourishes) is fine; adding or removing sections is not.

## 3. Design system (Imprint Sites language)

All tokens live in `tailwind.config.js` and `src/index.css`.

- **Type:** Outfit for headings (`font-display`, weights 500–600, tight tracking), Inter for body at 15.5px. CV
  documents keep their own fonts (`.cv-paper h*` resets).
- **Colour:** zinc neutrals (`ink-*`), near-black surfaces (`night`, `night-700/800`), and hairlines in `line` (#ececec).
  Blue (`brand-600`, #2563eb) is only for links, focus and informational states. Status colours are `ok`, `warn` and
  `bad`.
- **Components:**
  - `.btn` has a 10px radius; `btn-primary` is near-black.
  - `.card` is rounded-2xl with a 1px `line` border and `shadow-panel`.
  - `shadow-card` and `shadow-paper` are long, soft shadows.
- **Headings inherit colour.** The base layer no longer forces `text-ink`, because that made headings on dark panels
  invisible. Do not reintroduce it.
- **Dark sections:**
  - home hero, home matching section and home CTA (`bg-night`);
  - auth side panel;
  - CV editor preview and toolbar (`bg-night` / `bg-night-700`).
  - On dark backgrounds use `text-white/…` opacities and white primary buttons (`bg-white text-ink`).
- **Marketing helpers:** `src/components/marketing.tsx` has `SectionHeading` and `Faq`.
- **Product imagery:** real screenshots only, no stock photos.
  - The home profile cards use `public/product/card-*.jpg`, regenerated with `scripts/capture-product-shots.mjs`.
  - The script needs a local server and `OR_SESSION`; see its header.
  - Never capture production user data.

## 4. Changes in this release

### Visual

- Restyled the entire public site, app and admin console in the system above.
- Home page: original sections and order kept (hero → live source strip → three profiles → features → templates →
  how matching works → FAQ → CTA). The hero is now dark, and the profile cards show real listing screenshots.
- Header nav (CV Builder, Opportunities, How it works, Pricing, Help) and footer columns (Product / For you / Support)
  are unchanged in content.
- New logo mark and favicon (`LogoMark` in `src/components/Layout.tsx`, `public/favicon.svg`).
- Toasts are dark with a coloured status icon. Tabs draw their baseline as an inset shadow.

### Bugs found and fixed during browser testing

| Bug                                                                               | Fix / location                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `?view=<invalid>` crashed the opportunities feed                                  | View validated against `PROFILE_TYPES` (`src/pages/app/Opportunities.tsx`)                  |
| HTML entities such as `&eacute;`, `&laquo;` and `&ordm;` shown raw in tender text | Full Latin-1 and typographic entity table, case-sensitive (`worker/lib/sanitize.ts`) + test |
| Headings on dark panels rendered dark on dark (e.g. sign-up side panel)           | Base heading colour now inherited (`src/index.css`)                                         |
| Sign-up/sign-in card: the dark panel did not reach the card edge                  | Card moved inside `container-page` (`src/pages/public/Auth.tsx`)                            |
| Every switch knob rendered outside its track                                      | `left-0` on the knob (`Toggle` in `src/components/ui.tsx`)                                  |
| Vertical scrollbar beside every tab bar                                           | Inset-shadow baseline instead of border + `-mb-px` (`Tabs` in `ui.tsx`)                     |
| Selected CV template not visible on the dark editor panel                         | White ring with offset (`src/cv/editor/TemplatePanel.tsx`)                                  |
| Cover letter pasted bullet lists inline (“Programme, - Run tenders … - Lead …”)   | First bullet becomes one sentence: “…, I run tenders …” (`worker/domain/tailor.ts`) + test  |
| Degree text repeated the field (“MSc Procurement & Supply Chain, Procurement”)    | `degreeWithField()` in `shared/cv.ts` + test                                                |
| Tailor-CV picker rows had no clickable affordance                                 | Bordered rows with chevron (`src/pages/app/OpportunityDetail.tsx`)                          |
| Plan price wrapped (“UGX 10,000 /” then “month”)                                  | No-wrap price line (`src/pages/public/Pricing.tsx`)                                         |
| `/login` showed a 404                                                             | Redirects to `/signin` (`src/App.tsx`)                                                      |
| Wave emoji in the onboarding heading                                              | Removed                                                                                     |

## 5. Verification (actual results)

| Check                                                                     | Result                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `npx vitest run` (unit + integration, local D1/KV)                        | 142 passed, 0 failed (9 files)                  |
| `npx playwright test` against `wrangler dev`                              | 15 passed, 3 skipped (intentional mobile skips) |
| Route sweep: 47 routes × desktop 1366px + phone 390px, visitor/user/admin | 0 page errors, 0 failed requests, 0 overflow    |
| Manual Chrome walk-through                                                | All passed (see below)                          |
| `npm run typecheck`, `eslint .`, `prettier --check .`                     | Clean                                           |
| Preview version: health + public Playwright + 9-step signed-in smoke      | All passed; smoke account deleted               |
| Production after promotion: public Playwright suite                       | 5 passed, 1 skipped                             |

The Chrome walk-through covered:

- sign-in and sign-out;
- save and dismiss in the feed;
- tracker add and status change;
- Tailor CV and a cover-letter draft;
- template and accent switching, and version history;
- settings saves;
- the payment simulator's failure path;
- an admin manual source run (Remotive: 7 seen, 0 new).

## 6. How to run and verify locally (Windows notes)

```bash
npm ci
npx vite build
npx wrangler dev --port 8787 --ip 127.0.0.1 --test-scheduled
npx vitest run
npx playwright test          # needs the dev server above
```

- **Rebuild means restart.** After `npx vite build`, restart `wrangler dev`. Rebuilding replaces `dist/` while Wrangler
  is serving it, and every route then returns 404 until restart.
- **Playwright browsers:** if the default cache directory can't be created, set `PLAYWRIGHT_BROWSERS_PATH` to a
  writable folder and run `npx playwright install chromium`.
- **Git Bash paths:** prefix commands that pass a bare `/` argument with `MSYS_NO_PATHCONV=1`.
- **Production requests from Windows:** use `curl --ssl-no-revoke` and `node --dns-result-order=ipv6first`.
- **Local admin:** `admin@example.test` / `Password1234`. This is a local seed only; production admin is provisioned by
  D1 user ID.
- **Demo fixture:** e2e global setup creates a clearly labelled "DEMO DATA" listing (`opp_e2e_fixture`) locally.

## 7. Deploying

1. Run `npx vite build`.
2. Run `npx wrangler versions upload --message "…"`. This prints a preview URL.
3. Smoke-test the preview:
   - `/api/health`;
   - `E2E_BASE_URL=<preview> npx playwright test -g "public site"`;
   - a signed-in smoke test that creates its own account and **deletes it** via `POST /api/auth/delete-account`.
4. Promote: `npx wrangler versions deploy <id>@100% --yes`.
5. Update `docs/RELEASE_REPORT.md` §12.

## 8. Constraints the owner set (still in force)

- **Product scope:**
  - International product; no "Uganda / East Africa" positioning in marketing copy.
  - Use the resume.io-like layout only. Never copy another company's branding or text.
- **Cloudflare:**
  - Don't change custom domains, routes or DNS.
  - Don't touch other resources (`fip-prod`, `jerseyville-db`, KV `link-publishers-orders`).
  - Don't add paid services without asking.
- **Secrets and auth:**
  - Never commit secrets; `.dev.vars` is git-ignored.
  - A `wrangler secret put ADMIN_EMAILS` attempt was refused. Don't work around it; production admin is by D1 user ID.
- **Status claims:**
  - Pesapal payments are **not activated** and outbound email is **not configured**. Don't claim otherwise.
  - AI features are deferred by request.
- **Code quality:** "no spaghetti code". Keep components small, typed and tested; prefer the shared `ui.tsx` primitives.

## 9. Open items and suggestions

1. **Merge:** open a PR from `design/professional-refresh` into `release/v1.0` once the owner approves the look. Production
   already runs this branch's build.
2. **Copy polish:** about 20 em-dashes remain in UI copy (help text, labels). They were kept to respect "content stays
   the same". Replace them only if the owner asks.
3. **Screenshot refresh:** `card-*.jpg` show local listings from November 2026. Refresh them occasionally with the
   capture script so dates don't look stale.
4. **Admin styling:** admin tables still use small uppercase column headers. That is fine for an admin console, but
   could match the 13px label style used elsewhere.
5. **Existing limitations:** see `docs/KNOWN_LIMITATIONS.md` (scholarship and PPDA feeds curated by admins, AI provider
   deferred, payments and email not activated).
