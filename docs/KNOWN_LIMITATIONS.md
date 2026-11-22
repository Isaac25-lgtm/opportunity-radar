# Known limitations and risks

## Product scope

- **Original repository not used.** `github.com/Isaac25-lgtm/opportunity-radar` returned "Repository not found" (it is
  private or renamed, and this machine has no GitHub credentials). The application was built new in this folder.
  Nothing from the earlier Next.js/Prisma codebase was reused or migrated, and no existing production data was touched.
- **The help assistant can be wrong.** Ask Opportunity Radar (DeepSeek) answers from a product guide and is told
  not to invent facts, but like any AI it can make mistakes; it says so in the chat. It cannot see accounts or the
  live list of opportunities.
- **AI is built but not switched on.** The Python AI service (`ai-service/`) is tested but not hosted, so CV parsing and cover letters use the built-in tools, which can miss unusual CV layouts. Wording suggestions and AI requirement extraction exist in the service but are not yet used by the app. Before switching AI on, update the privacy notice to say CV text is sent to an AI provider.
- **Scholarship and Uganda public-procurement coverage depends on administrators** until permitted feeds are
  confirmed (see OPPORTUNITY_SOURCES.md). Out of the box the academic feed contains Grants.gov research grants only.
- **ReliefWeb** needs an approved appname before it can be enabled.
- **Payments are not activated.** The Pesapal adapter is complete and unit-tested against the documented API 3.0
  contract with mocked responses, but it has **not** been exercised against the Pesapal sandbox or production (no
  merchant credentials). Checkout returns "Online payments are not yet activated" in production until credentials are
  set and `payments.enabled` is switched on.
- **Email is not configured.** Notifications are recorded in-app; email deliveries are marked `skipped` until
  `EMAIL_PROVIDER`, `EMAIL_API_KEY` and `EMAIL_FROM` are set. Password-reset emails therefore cannot be delivered in
  production yet; administrators can help users through the contact form.
- **WhatsApp/SMS** channels are not implemented.
- **Business money fields are in Uganda shillings.** Turnover bands, contract sizes and minimum-turnover requirements
  (`turnover_band`, `*_ugx`) predate the international positioning. Companies outside Uganda must convert, and a
  notice's minimum in another currency is not converted. A currency-aware model (amount + currency, with FX) is the
  next step for international tenders.
- **Prices are in US dollars.** Pesapal accepts USD card payments; whether mobile-money methods are offered for USD
  depends on the merchant account. Confirm with Pesapal before launch, or offer local-currency prices per country.
- **No company capability statement.** Companies get tender matching and a tracker, but the CV builder produces
  personal CVs only (useful for key-expert CVs in bids). A company profile/capability-statement document is not built.
- **`plans.price_ugx` is unused** since migration 0004 (kept so the previous Worker version kept working during the
  switch). Drop it in a later migration.

## Technical

- **Documents use Workers KV**, because the Cloudflare login has no R2 permission. KV is eventually consistent
  (a download right after upload from another region can briefly 404) and the free tier allows 1,000 writes/day.
  Switching to R2 is a contained change behind `DocumentStore` in `worker/lib/providers.ts`.
- **Feed ranking scores the newest 400 matching candidates per request** (live matching keeps results fresh after
  profile edits). Very large catalogues will need pre-computed match tables.
- **Alert job loads up to 2,000 profiles per tick.** Fine for launch; needs batching by cursor at larger scale.
- **Workers Free plan limits** (10 ms CPU and 50 subrequests per invocation) can be reached by large ingestion
  batches; `ingestion.max_tasks_per_tick` (default 3) keeps each tick small. If runs show CPU-limit errors, lower it to
  1 or move to the Workers Paid plan (ask before enabling any paid service).
- **Heuristic requirement extraction** can produce generic "skills mentioned" (e.g. "research"). Listings are labelled
  "extracted automatically — confirm on the official page", and confidence is capped at medium.
- **Deadline timezones** are inferred from the country for World Bank notices; other sources' deadlines are stored
  as published (UTC where unspecified).
- **Open Graph image is SVG**, which some social platforms do not render; replace with a PNG for rich previews.
- **Privacy policy and terms** have not had legal review.
- **Lint-time dependency advisory**: moderate `minimatch` issue inside `typescript-eslint` (development only).

## Accessibility

Keyboard navigation, visible focus, labelled controls, skip link, dialog focus management and colour-contrast-safe
palette were implemented and spot-checked; there has been no full WCAG 2.2 AA audit with assistive technology.
Known gaps: the kanban tracker relies on modal editing rather than drag-and-drop (keyboard-friendly, but no live region
announcements of moves), and CV preview thumbnails are decorative (`aria-hidden`) with the content available in the
form fields.
