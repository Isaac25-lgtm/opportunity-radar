# Opportunity Radar AI service

A small Python (FastAPI) service that does the AI work for Opportunity Radar, using Claude. The main app on
Cloudflare calls it; people never call it directly.

The app works without it. When the service is not configured, slow, down or refuses, the app uses its built-in,
non-AI tools instead.

## What it does

| Endpoint                        | Used for                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `POST /v1/cv/parse`             | Reading a pasted or uploaded CV into the CV builder's fields             |
| `POST /v1/cv/improve`           | Clearer, stronger wording for CV lines (ready; not yet shown in the app) |
| `POST /v1/cover-letter`         | Cover-letter drafts from a CV and an opportunity                         |
| `POST /v1/requirements/extract` | Reading requirements from an opportunity notice (ready; not yet wired)   |
| `GET /health`                   | Status check (no token needed)                                           |

## Never inventing facts

Claude is told not to invent anything. The service also checks every answer against what the person gave it,
and does not trust the model to follow the rule on its own:

- **CV parsing:** a name, employer, title, school or skill is kept only if it appears in the CV text. A
  description is kept only if almost all its words come from the CV, and a date only if its year is in the CV.
  Everything else is dropped and listed in `dropped`.
- **Wording and cover letters:** a draft that adds a number or a name the CV does not contain is rejected.
  Placeholders in square brackets, such as `[add a result]`, are allowed. A rejected wording suggestion keeps
  the person's own text; a rejected cover letter makes the app use its built-in draft.
- **Requirements:** a stated number such as "3 years" is kept only if that number is in the notice, and a skill
  or field only if its words are.

## Security

- Every endpoint except `/health` needs `Authorization: Bearer <AI_SERVICE_TOKEN>`. The token is compared in
  constant time. With no token set, the service refuses all work.
- The Claude API key stays in this service. The Cloudflare Worker only holds the service URL and token.
- Inputs are size-limited, and the interactive API docs are switched off.

## Run locally

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                                  # set ANTHROPIC_API_KEY and AI_SERVICE_TOKEN
.venv/Scripts/python -m uvicorn app.main:app --port 8000 --env-file .env
```

Then, in the app's `.dev.vars`, set `AI_PROVIDER=python`, `AI_SERVICE_URL=http://127.0.0.1:8000`, and the same
`AI_SERVICE_TOKEN`, and restart `wrangler dev`.

## Tests

```bash
.venv/Scripts/python -m pytest
```

The tests use a fake model, so they need no API key and cost nothing.

## Settings

| Variable            | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Claude credentials                                          |
| `AI_SERVICE_TOKEN`  | Shared secret; set the same value on the Worker             |
| `AI_MODEL`          | Optional; default `claude-opus-5-5`                         |
| `AI_EFFORT`         | Optional; `low`, `medium` (default), `high`, `xhigh`, `max` |

Requests use structured outputs (JSON that matches a schema) and server-side refusal fallback.

## Deploying

The `Dockerfile` runs on any container host (Render, Railway, Fly.io, Google Cloud Run and others). It listens
on `$PORT` (default 8000). It must be served over HTTPS, because the Worker refuses a plain-http address in
production. After deploying, set these on the Worker:

```bash
npx wrangler secret put AI_SERVICE_URL      # e.g. https://ai.example.com
npx wrangler secret put AI_SERVICE_TOKEN
npx wrangler secret put AI_PROVIDER         # python
```
