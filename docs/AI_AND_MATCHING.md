# AI and matching

## AI status: deferred by design

As requested, AI APIs will be integrated later. Every AI-shaped capability works today without a model:

| Capability | Current implementation | AI hook |
| --- | --- | --- |
| CV extraction | `shared/cvParser.ts` — deterministic section/date/contact parser that only copies text present in the file | `AiProvider.extractCv` in `worker/lib/providers.ts` |
| Requirement extraction | `worker/domain/ingestion/extract.ts` — conservative patterns that only record explicit wording; results labelled `heuristic` | connector post-processing |
| Tailoring | `worker/domain/tailor.ts` — reorders existing content and lists matching/missing keywords | — |
| Cover letters | Template filled only with CV facts; `[bracketed prompts]` for anything else | — |
| Match explanations | Generated from the matcher's evidence | — |

To add a provider later: implement `AiProvider` (and set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` secrets), validate
every response with the same zod schemas (`cvDataSchema`, `requirementsSchema`) before saving, send only the current
user's text, never log documents, and keep the deterministic path as the fallback on timeouts or invalid output.
Treat source text and uploaded documents as untrusted data: never let them change instructions, data or tools.
The AI must never be the only authority on hard eligibility.

## Matching

Implemented in `worker/domain/matching/`. Two separate outputs:

- **Eligibility** — from hard constraints only: `eligible`, `potential`, `not_eligible`, `insufficient`.
- **Relevance** — a 0–100 score from weighted components; `null` when too little is known (coverage below 45%, 35%
  for academic, 40% for business). A high score never overrides a failed requirement.

### Hard constraints

| Profile | Checks |
| --- | --- |
| Career | open status and deadline; firm-only notices excluded; stated nationality list; minimum education; minimum years (≥2 years short → not eligible, otherwise "confirm"); languages |
| Academic | open status and deadline; nationality/residence (missing → insufficient); prerequisite qualification for the level offered; minimum education; minimum GPA (normalised by scale); languages |
| Business | open status and deadline; individual-consultant notices excluded; registration; bidder country; minimum turnover (band entirely below → not eligible, overlapping → confirm, unknown → confirm); years in operation; past contracts; certifications and licences (never assumed); tax clearance (expired → not eligible) |

### Relevance weights (defaults; override in Admin → Configuration → `matching.weights`)

| Career | Academic | Business |
| --- | --- | --- |
| skills 35 | field 35 | scope (services/products/category) 40 |
| role/title 25 | level offered 25 | geography 20 |
| experience 15 | destination 15 | sector 15 |
| education 10 | language 10 | capacity (contract size) 15 |
| location 10 | academic standing 10 | track record 10 |
| employment type 5 | funding 5 | |

Only components that can be evaluated count, so missing data lowers *confidence* rather than inventing a value. When
an opportunity lists few extracted skills, the skills component blends requirement overlap with how many of the
profile's skills the notice mentions, so one keyword cannot max out relevance.

### Confidence

High when ≥75% of the weight could be evaluated; medium ≥50%; otherwise low. Heuristic requirements cap confidence at
medium; listings without structured requirements are low.

### Every match includes

Score and its meaning, eligibility, confidence, positive reasons, missing information, disqualifiers, the profile
facts used, the requirements used, and a next action. The same functions power the feed, the dashboard and alerts
(`worker/domain/feed.ts`).
