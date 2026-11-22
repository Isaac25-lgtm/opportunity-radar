# Codex handoff — Opportunity Radar

Date: 22 November 2026 · Production: https://opportunity-radar.omodingisaac123.workers.dev

## 1. Where things are

| Item                | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Repository          | https://github.com/Isaac25-lgtm/opportunity-radar                                           |
| Working branch      | `design/professional-refresh` (pushed), based on `audit/release-v1.0` @ `fdf5fdb`           |
| Latest commits      | `21a3270` visual refresh · `07bd191` photo hero · `3dc0d41` USD segments + countries ·      |
|                     | `6323736` 15-person check + relevance fixes · `c765ee2` scripts + docs                      |
| Main branch         | `main` on GitHub; all work is pushed there                                                  |
| Live Worker version | `7e20f5e3-a04d-42f5-9ff9-75483d5c1d9a` at 100% (help assistant, off until key set)          |
| Rollback version    | `2a80ba45-0504-4563-b791-95e6880325eb` (audit fixes, before the assistant)                  |
| Migrations          | `0004_usd_plan_segments.sql` applied to production (additive)                               |
| Sample CVs          | `C:\Users\USER\Documents\ChatGPT\CV builder\sample-cvs\` (10 PDFs + PNGs, fictional people) |

## 2. What the owner asked for (in their words), and the rules that came out of it

1. "make this site look very professional and not AI generated looking … especialy
   https://imprintsites.omodingisaac123.workers.dev/ because they are both Saas products"
2. "everything remains organized the same way but the aesthetic premium like i guided"
   → **Rule: change only the look.** Keep every page's sections, order, copy, links and nav items.
3. "this is just DARK BACKGROUND" / "SURELY WE CAN DO BETTER … THIS IS JUST WHITE"
   → Imagery like Imprint: a darkened photo slideshow hero and photo-backed profile cards (owner approved six
   Unsplash photos).
4. "look at how clumsy its edges look" → no rotated elements (they alias in Chrome); stacked, straight, opaque.
5. "make sure it can work for atleast 5 different professionals, 5 different companies and 5 different people looking
   for scholarships. the first payment thing will be 10 dollars, then 15 and 25 with the most popular being 15 you
   segment them. only jobs, then jobs and scholarships then the third one is for those looking also for contracts …
   add what you think i missed"
6. "after checking how each CV works i want to see samples"
7. "allow everything": production migration and deploy approved.

## 2b. Later requests in this session (in the owner's words)

8. "put the pricing on the landing page": the home page shows the plan cards before the FAQ. `PlanCards` in
   `src/components/PlanCards.tsx` is shared with the Pricing page, so the two never disagree.
9. "go through the mobile view well - the hero section epsecially". On phones:
   - the photo overlay darkens evenly so the photo shows;
   - the CV picture is centred and cropped with a fade, under the match card;
   - spacing is tighter and the source strip sits on two lines;
   - the templates become a swipeable row.
10. "clients have to enter details not upload stuff … when they create a profile they have to enter details but most
    importantly the system has to give suggestions so that they can click on them". Guided entry:

    - **Rules and vocabularies:** `shared/suggestions.ts` has the lists (job titles, skills, industries, fields of
      study, research interests, company services and products, certifications, licences, buyers, languages, every
      country). Its rules read the form so far:
      - Civil Engineer → AutoCAD, Road design;
      - Economics → Public finance;
      - a solar company's description → Solar installation.
    - **Family detection:** role families come from job titles first, so a skill word ("Road design") can't switch
      them. Description keywords describe what a company does, not its customers.
    - **Inputs:** `TagInput` and `SuggestInput` in `src/components/ui.tsx` offer an ARIA combobox type-ahead and
      "Suggested" chips. Enter keeps the typed text unless an option was chosen with the arrow keys.
    - **Forms:** `FieldDef` takes `vocab` and `suggest(ctx)`. All three forms are wired in `profileConfigs.ts`, and the
      Uganda-only lists were replaced.
    - **Onboarding:** leads into filling in the profile. CV import remains on the CVs page only.
    - **Tests:** `tests/unit/suggestions.test.ts`.

11. "i hope the option of users selecting regions or countries where they want their opportunities from is there …
    worldwide … this should be advertised as a worldwide thing" / "this should be stated clearly in the landing page".

    - **Sources:** migration 0005 makes the World Bank source worldwide (one request, no country filter), widens
      Grants.gov to international keywords and removes Remotive's location filter. `shared/countries.ts` knows World
      Bank naming ("Kyrgyz Republic", "Congo, Democratic Republic of") and regional labels.
    - **Profiles:** each opens with "Where should we look?" (`preferred_countries` / `preferred_geographies`). It
      offers Worldwide, regions (`REGION_CHOICES`) or countries, with suggestions from `suggestWhere()`.
    - **Matching:** `placeCovers(preference, country)` in career, academic and business matching.
    - **Feed:** the "Where" filter calls `/api/opportunities?region=` (Worldwide, `remote`, a region or a country),
      filtered in SQL with `json_each`.
    - **Landing page:**
      - a Worldwide badge in the hero, and "around the world" in the intro;
      - a band of clickable regions linking to the filtered feed;
      - a new FAQ and a worldwide meta description.

12. "DARK BACKGROUND A BIT TOO STRONG. MAKE IT NATURAL AND ALSO ADD GOOGLE AUTH EVEN IF NOT ACTIVE":
    - **Auth panel:** the sign-in/up side panel is a photo with a soft bottom fade.
    - **Google sign-in:** lives in `worker/routes/oauth.ts`. It is OpenID Connect with PKCE; state and verifier are
      kept in an HttpOnly cookie scoped to `/api/auth/google`.
      - Google must verify the email. Existing users sign in first and choose **Connect Google** in Settings to link the accounts.
      - Google-created accounts get an unusable `oauth$…` password hash. They can set a first password in Settings
        and delete by typing DELETE.
      - Links are stored in `user_identities` (migration 0006).
    - **Switch:** it is off until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. `/api/auth/providers` tells
      the UI, which shows "Coming soon" until then. Activation steps are in `RELEASE_REPORT.md` §12.
    - **Tests:** `tests/integration/oauth.test.ts`.
13. "MAKE SURE THESE ARE WELL EXPLAINED - THESE ARE RANDOM USERS" (the How it works links):

    - **How it works page:** rewritten as a plain guide. Each part says who it is for, how to start, what we check,
      how fit is decided, gives an example and names the plan.
    - **Labels:** shown labels are plain everywhere ("You qualify", "You may qualify", "Need more details", "Official
      source", "Job board", "Checked by our team"; "how well it fits" instead of "relevance").
    - **Rule for future copy:** write for someone new to the product; no internal terms.

14. "i anticipated my backend to be python because i will be integrating AI": the owner chose a separate Python
    AI service, keeping the Cloudflare app as is.
    - **Service:** `ai-service/` (FastAPI + Claude, `claude-opus-5-5` by default). Endpoints: CV parsing, wording
      suggestions, cover letters, requirement extraction. Structured outputs; bearer-token auth; 17 pytest tests
      with a fake model (no key, no cost). See `ai-service/README.md`.
    - **Never inventing facts** is enforced in code: parsed fields must be found in the CV text; wording and letters
      that add numbers or names not in the CV are rejected.
    - **Worker:** `AI_PROVIDER=python` with `AI_SERVICE_URL` (https in production) and `AI_SERVICE_TOKEN`. Answers
      are re-validated with `cvDataSchema`; any failure falls back to the built-in tools. Cover letters use it when on.
    - **Status:** built and tested, not hosted. Hosting needs the owner's choice (it costs money), an Anthropic key,
      and a privacy-notice update.
15. A Codex audit (`docs/CLAUDE_AUDIT_HANDOFF.md`) was reviewed and merged. Its fixes were kept, with these changes:
    - **Regions:** East and Southern Africa keep their common-usage meaning (Zambia, Zimbabwe, Malawi and
      Mozambique are Southern Africa, matching `regionOf`), Cyprus stays in Europe, and sub-Saharan Africa
      includes Sudan (World Bank usage). The audit's ECOWAS, Horn of Africa, "Congolese", Middle East/MENA and
      Asia fixes are kept.
    - **CV saves:** the audit made saves without a revision fail when two arrive together (the existing
      concurrent-snapshot test caught it on real local D1). The revision check now applies only when the client
      sends one; the editor always does.
    - **Settings:** the Google connect link and error use the design system's button and alert.
16. Found while re-testing: PDF import failed on browsers older than Chrome 119 / Safari 17.4
    (`Promise.withResolvers`). PDF reading now uses pdf.js's legacy build, which includes the polyfills.

17. "create an AI chatbot guiding users through the system ... Ask Opportunity Radar", with a DeepSeek key and
    sample questions, "even in the landing page":
    - **Widget:** floating dark pill bottom-right on every page including the home page (hidden in the CV editor,
      print view and admin; raised above fixed save bars). Opens a chat styled like the owner's reference: dark
      header, greeting with an AI disclaimer, six suggested questions, streamed answers with page links. Full screen
      on phones.
    - **Server:** `POST /api/assistant/chat` streams DeepSeek (`deepseek-flash`) as plain text. Details, privacy and
      limits in `AI_AND_MATCHING.md`. Privacy notice updated.
    - **Key:** read from the `DEEPSEEK_API_KEY` Worker secret, never stored in the repository. The owner sets it
      with `npx wrangler secret put DEEPSEEK_API_KEY`; the button appears without a redeploy.
    - **Tests:** `tests/integration/assistant.test.ts` (9, with a stand-in for DeepSeek).

## 3. Plans are segments (new)

| Code    | Name                | Price | `profile_types`                 |
| ------- | ------------------- | ----- | ------------------------------- |
| `free`  | Free                | $0    | career                          |
| `basic` | Jobs                | $10   | career                          |
| `pro`   | Jobs & Scholarships | $15   | career, academic (Most popular) |
| `elite` | Complete            | $25   | career, academic, business      |

- **Entitlement:** `profile_types` (in `shared/entitlements.ts`) replaces `business_matching`. It is enforced
  server-side in four places:
  - profile creation (`requireProfileType` in `worker/lib/store.ts`, a 402 naming the plan that unlocks it);
  - feeds and match details (`gated: 'plan_segment'` plus `upgrade_plan`);
  - the dashboard top matches;
  - alerts.
- **Browsing:** every listing stays free to browse.
- **Money handling:**
  - Prices are stored in **minor units** with a currency: `plans.price_minor` and `plans.currency`.
  - Payments store minor units in their own currency, so historical UGX payments stay correct.
  - `shared/money.ts` converts at the provider boundary, because Pesapal speaks major units. `formatMoney()` formats
    for display.
  - `plans.price_ugx` is now unused and can be dropped in a later migration.
- **UI updated:**
  - Pricing: segment checklist and comparison rows.
  - Billing, mock checkout, and admin plans/payments.
  - Profiles page: locked types link to the plans page.
  - Dashboard tiles, onboarding hints and the feed notice.

## 4. Matching changes (new)

- **Countries:** `shared/countries.ts` covers all UN member states with demonyms and aliases. It also knows the groups
  notices use: Africa, Sub-Saharan Africa, East Africa/EAC, West Africa/ECOWAS, Southern Africa/SADC, Commonwealth,
  EU, MENA, Asia, Latin America and the Caribbean.
  - `countryEligibility()` returns `yes`, `no` or `unknown`.
  - Unknown countries, and groups that can't be resolved reliably ("developing countries", "low and middle income"),
    ask the user to confirm instead of disqualifying them.
  - The old helper wrongly treated "Commonwealth" and "developing countries" as Africa only.
- **No home assumption:** the career matcher no longer assumes the user lives in Uganda when no country is set. The
  "nearby" bonus now means the same UN sub-region.
- **Ranking:** eligible and potential matches rank together by relevance, with potential taking a −5 penalty. Not
  eligible always comes last.
- **Fields:**
  - Generic words (science, studies, public, global, supply, services…) are ignored in similarity.
  - Academic fields use a balanced (Dice) overlap.
- **Off-topic cap:** relevance is capped at 35 when the core fit is missing. The core fit is the field of study for
  scholarships, the firm's services for tenders, and the procurement category for tenders.
- **Academic CVs:** `from: 'academic_profile'` builds an academic CV from the academic profile, with education,
  publications and awards first and the Scholar template (`cvFromAcademicProfile` in `shared/cv.ts`). The new-CV
  dialog offers it.

## 5. Fifteen-person verification (new)

- **Data:**
  - `tests/fixtures/personas.ts` holds 5 professionals, 5 scholarship seekers and 5 companies, all fictional with
    example.com emails.
  - It also holds 18 fictional opportunities, including deliberate traps: country-restricted jobs, a Commonwealth job,
    a Kenya-only scholarship, a "developing countries" PhD, a turnover-gated tender and an unrelated Head Chef job.
- **Test:** `tests/integration/personas.test.ts` signs each person up on their plan through the API and checks:
  - plan locks;
  - the top match;
  - stated eligibility outcomes, including relevance ≠ eligibility (BrightPrint: printing tender 100 relevance, not
    eligible on turnover);
  - that CVs contain only the person's own facts.
- **Report:** `PERSONA_REPORT=<file> npx vitest run tests/integration/personas.test.ts` writes each person's full
  ranking for review.
- **Samples:**
  - `scripts/seed-sample-personas.mjs` seeds the 15 people into a **local** server. Fixtures are marked as demo data.
  - `scripts/capture-sample-cvs.mjs` renders their CVs through the app's print view as PDF and PNG.
  - Both refuse non-local URLs.

## 6. Design system (Imprint Sites language)

- **Type:** Outfit headings and Inter body text.
- **Colour:**
  - zinc neutrals (`ink-*`) and near-black surfaces (`night*`);
  - hairlines in `line`;
  - blue (`brand-600`) only for links, focus and informational states.
- **Components:** `.btn` has a 10px radius and near-black primary; `.card` is rounded-2xl with a `line` border.
- **Headings inherit colour.** Don't add `text-ink` to base headings, because it breaks dark panels.
- **Imagery:**
  - The hero is `HeroSlideshow` in `src/components/marketing.tsx`: cross-fade, caption pill, dots and pause.
    Auto-play is off for prefers-reduced-motion.
  - Photos are in `public/photos/`, Unsplash License, owner-approved:
    - photo-1499750310107 · 1541339907198 · 1517245386807 (hero);
    - 1522202176988 · 1523240795612 · 1600880292203 (cards).
  - Product shots are `public/product/card-*.jpg`, from `scripts/capture-product-shots.mjs` (local only).

## 7. Verification (actual results, this release)

| Check                                                                   | Result                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `npx vitest run`                                                        | 252 passed (13 files, incl. 76 persona checks) |
| `ai-service`: `python -m pytest`                                        | 17 passed                                      |
| `npx playwright test` against `wrangler dev` (Chrome 107)               | 15 passed, 3 skipped (intentional)             |
| Route sweep: 47 routes × desktop + phone, visitor/user/admin            | 0 errors, 0 failed requests, 0 overflow        |
| Typecheck, ESLint, Prettier                                             | Clean                                          |
| Preview: health, plans, 11-step signed-in smoke (deleted), public suite | All passed                                     |
| Production after promotion: public Playwright suite                     | 5 passed, 1 skipped                            |

Chrome checks:

- **Slideshow:** dots, captions and pause.
- **Pricing page:** USD prices and segment checklist.
- **As a $10 "Jobs" user:**
  - the scholarship feed shows the upgrade notice naming Jobs & Scholarships;
  - the profile cards for other segments are locked.
- **Earlier pass:** save/dismiss, tracker, tailoring, cover letters, templates, history, settings, payment-simulator
  failure path and admin source run.

## 8. How to run locally (Windows notes)

```bash
npm ci && npx vite build
npx wrangler d1 migrations apply opportunity-radar-db --local
npx wrangler dev --port 8787 --ip 127.0.0.1 --test-scheduled
npx vitest run && npx playwright test
```

- **Restart after rebuilds:** restart `wrangler dev` after every `vite build`, or routes 404.
- **Chained commands:** a failing lint step in an `&&` chain skips the build. Check the build actually ran before
  testing in a browser.
- **Python-written files:** when writing TS from Python, `\n` inside JS strings becomes a real newline. Use the editor
  tools or raw strings.
- **Playwright:** set `PLAYWRIGHT_BROWSERS_PATH` if the default cache can't be created.
- **Git Bash:** use `MSYS_NO_PATHCONV=1` for bare `/` arguments.
- **Production requests from Windows:** use `curl --ssl-no-revoke` and `node --dns-result-order=ipv6first`.
- **Local admin seed:** `admin@example.test` / `Password1234`. Production admin is set by D1 user ID.

## 9. Deploying

1. `npx vite build`, then `npx wrangler versions upload --message "…"`.
2. If there are migrations, keep them **additive** and run
   `npx wrangler d1 migrations apply opportunity-radar-db --remote`. The owner approved this in this session; ask
   again for future releases.
3. Smoke-test the preview URL:
   - health;
   - the public Playwright suite with `E2E_BASE_URL`;
   - a signed-in smoke that deletes its own account.
4. Run `npx wrangler versions deploy <id>@100% --yes`, then re-run the public suite on production.
5. Update `docs/RELEASE_REPORT.md` §12.

## 10. Constraints still in force

- **Product scope:**
  - International product; no "Uganda / East Africa" positioning in marketing copy.
  - resume.io-like layout only, no copied branding.
- **Cloudflare:**
  - Don't change custom domains, routes or DNS.
  - Don't touch `fip-prod`, `jerseyville-db` or KV `link-publishers-orders`.
  - No paid services without asking.
- **Secrets:** never commit secrets. Don't work around the refused `wrangler secret put ADMIN_EMAILS`.
- **Status claims:** Pesapal payments are **not activated**, email is **not configured**, and AI is deferred. Don't
  claim otherwise.
- **Code quality:** "no spaghetti code". Keep it small, typed and tested.

## 11. Gaps found ("what you think i missed") and suggested next steps

1. **Real scholarships in production.** The live academic feed has only Grants.gov research grants. Scholarship seekers
   need curated, verified listings (admin console → Add curated opportunity) or a permitted feed. This is the biggest
   gap for the $15 plan.
2. **Company money is in UGX.** Turnover bands, contract sizes and minimum turnover (`*_ugx`) should become
   amount + currency with FX for international companies.
3. **Company capability statement.** Companies get matching and a bid tracker but no company document. Key-expert CVs
   work through the CV builder.
4. **USD and mobile money.** Confirm with Pesapal which methods are available for USD on the merchant account, or offer
   local-currency prices.
5. **Annual billing or a discount.** Not built. Plans are monthly and don't auto-renew.
6. **Drop `plans.price_ugx`** in a later migration.
7. **Merge the branch** into `release/v1.0` via PR.
