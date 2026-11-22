# AI and matching

## AI: optional Python service

AI lives in a separate Python (FastAPI) service, `ai-service/`, that calls Claude. The Worker uses it only when
`AI_PROVIDER=python`, `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` are set. Otherwise, and whenever the service fails,
is slow, refuses, or returns something that does not pass the app's zod schemas, the built-in tools below are used.
The service is built and tested but not hosted yet, so production runs on the built-in tools.

| Capability             | Built-in (always available)                                                                      | With the AI service                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| CV extraction          | `shared/cvParser.ts`: section, date and contact parser that only copies text present in the file | `POST /v1/cv/parse`, wired through `AiProvider.extractCv`       |
| Cover letters          | Template filled only with CV facts; `[bracketed prompts]` for anything else                      | `POST /v1/cover-letter`, wired through `AiProvider.coverLetter` |
| Wording improvements   | None                                                                                             | `POST /v1/cv/improve` (service ready; no button in the app yet) |
| Requirement extraction | `worker/domain/ingestion/extract.ts`: conservative patterns; results labelled `heuristic`        | `POST /v1/requirements/extract` (service ready; not wired yet)  |
| Tailoring              | `worker/domain/tailor.ts`: reorders existing content and lists matching/missing keywords         | None                                                            |
| Match explanations     | Generated from the matcher's evidence                                                            | None: eligibility is never decided by AI                        |

Rules the service enforces, not just asks for (details in `ai-service/README.md`):

- Answers are structured JSON that matches a strict schema.
- Parsed CV fields are kept only when they can be found in the CV text; the rest are dropped and listed.
- Wording suggestions and cover letters that add a number or name not in the CV are rejected.
- Only the current user's own text is sent. Documents are never logged. Source text is treated as data, never as
  instructions.

The Worker validates every answer again (`cvDataSchema`), adds rate limits (CV parsing 30/hour, AI cover letters
20/hour per user), and refuses a plain-http service address in production.

## Ask Opportunity Radar AI (help assistant)

A floating "Ask Opportunity Radar AI" button on every page (except the CV editor, print view and admin) opens a chat
that explains the product and links to the right page. It is powered by DeepSeek (`deepseek-flash`, thinking off,
streamed) and is switched on by the `DEEPSEEK_API_KEY` Worker secret: without it, the button is hidden.

- **Code:** `worker/domain/assistant.ts` (instructions, DeepSeek call, stream reader), `worker/routes/assistant.ts`
  (`GET /api/assistant/status`, `POST /api/assistant/chat`), `src/components/Assistant.tsx` (widget),
  `shared/assistant.ts` (suggested questions, limits), `shared/help.ts` (help answers shared with the Help page).
- **Page-aware questions:** the one-tap questions change with the page (`PAGE_SUGGESTIONS` in
  `shared/assistant.ts`, tested in `tests/unit/assistant.test.ts`). Each must be answerable from the
  product guide in `worker/domain/assistant.ts`; add a fact there before adding a question.
- **Always current:** plans and prices are read from the database on every chat; payment and Google sign-in status
  come from the live configuration.
- **Privacy:** only the conversation, the page path and the plan name are sent; never names, emails, profiles, CVs
  or documents. Chats are kept in the browser tab only. Message text is never logged.
- **Limits:** questions up to 1,500 characters; the last 12 turns are sent; replies up to 700 tokens; 20 questions
  per person per 10 minutes, 150 per day, and 5,000 per day across the site (cost ceiling).
- **Failures:** an invalid key or empty balance shows "not available right now"; DeepSeek rate limits show "busy".

## Matching

Implemented in `worker/domain/matching/`. Two separate outputs:

- **Eligibility** — from hard constraints only: `eligible`, `potential`, `not_eligible`, `insufficient`.
- **Relevance** — a 0–100 score from weighted components; `null` when too little is known (coverage below 45%, 35%
  for academic, 40% for business). A high score never overrides a failed requirement.

### Hard constraints

| Profile  | Checks                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Career   | open status and deadline; firm-only notices excluded; stated nationality list; minimum education; minimum years (≥2 years short → not eligible, otherwise "confirm"); languages                                                                                                                                          |
| Academic | open status and deadline; nationality/residence (missing → insufficient); prerequisite qualification for the level offered; minimum education; minimum GPA (normalised by scale); languages                                                                                                                              |
| Business | open status and deadline; individual-consultant notices excluded; registration; bidder country; minimum turnover (band entirely below → not eligible, overlapping → confirm, unknown → confirm); years in operation; past contracts; certifications and licences (never assumed); tax clearance (expired → not eligible) |

### Relevance weights (defaults; override in Admin → Configuration → `matching.weights`)

| Career            | Academic             | Business                              |
| ----------------- | -------------------- | ------------------------------------- |
| skills 35         | field 35             | scope (services/products/category) 40 |
| role/title 25     | level offered 25     | geography 20                          |
| experience 15     | destination 15       | sector 15                             |
| education 10      | language 10          | capacity (contract size) 15           |
| location 10       | academic standing 10 | track record 10                       |
| employment type 5 | funding 5            |                                       |

Only components that can be evaluated count, so missing data lowers _confidence_ rather than inventing a value. When
an opportunity lists few extracted skills, the skills component blends requirement overlap with how many of the
profile's skills the notice mentions, so one keyword cannot max out relevance.

### Confidence

High when ≥75% of the weight could be evaluated; medium ≥50%; otherwise low. Heuristic requirements cap confidence at
medium; listings without structured requirements are low.

### Every match includes

Score and its meaning, eligibility, confidence, positive reasons, missing information, disqualifiers, the profile
facts used, the requirements used, and a next action. The same functions power the feed, the dashboard and alerts
(`worker/domain/feed.ts`).
