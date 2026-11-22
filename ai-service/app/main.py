"""Opportunity Radar AI service (FastAPI).

Only the Cloudflare Worker calls this service, with a shared bearer token. The Worker keeps working
without it: if this service is down or refuses, the Worker falls back to its built-in, non-AI tools.
"""

from __future__ import annotations

import hmac
import logging
from functools import lru_cache
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from . import tasks
from .config import Settings, load_settings
from .llm import ClaudeLlm, Llm, LlmError
from .schemas import CoverLetterIn, ImproveIn, ParseIn, RequirementsIn

log = logging.getLogger("ai-service")

app = FastAPI(title="Opportunity Radar AI service", version="1.0.0", docs_url=None, redoc_url=None)


@lru_cache
def get_settings() -> Settings:
    return load_settings()


@lru_cache
def _claude() -> ClaudeLlm:
    s = get_settings()
    return ClaudeLlm(model=s.model, effort=s.effort)


def get_llm() -> Llm:
    if not get_settings().has_api_key:
        raise HTTPException(503, {"code": "not_configured", "message": "AI is not configured."})
    return _claude()


def require_token(
    authorization: str = Header(default=""), settings: Settings = Depends(get_settings)
) -> None:
    if not settings.service_token:
        raise HTTPException(503, {"code": "not_configured", "message": "AI is not configured."})
    given = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given.encode(), settings.service_token.encode()):
        raise HTTPException(401, {"code": "unauthorized", "message": "Not allowed."})


@app.exception_handler(LlmError)
async def _llm_error(_: Request, e: LlmError) -> JSONResponse:
    status = 503 if e.retryable or e.code == "not_configured" else 502
    if e.code == "refused":
        status = 422
    log.warning("llm_error code=%s", e.code)
    return JSONResponse({"detail": {"code": e.code, "message": e.message}}, status_code=status)


@app.exception_handler(tasks.GroundingError)
async def _grounding_error(_: Request, e: tasks.GroundingError) -> JSONResponse:
    log.warning("grounding_rejected problems=%d", len(e.problems))
    return JSONResponse(
        {"detail": {"code": "ungrounded", "message": "The draft used details that are not in your CV."}},
        status_code=422,
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    s = get_settings()
    return {"ok": True, "model": s.model, "configured": bool(s.service_token and s.has_api_key)}


@app.post("/v1/cv/parse", dependencies=[Depends(require_token)])
async def parse(body: ParseIn, llm: Llm = Depends(get_llm)) -> dict[str, Any]:
    return await tasks.parse_cv(llm, body.text)


@app.post("/v1/cv/improve", dependencies=[Depends(require_token)])
async def improve(body: ImproveIn, llm: Llm = Depends(get_llm)) -> dict[str, Any]:
    return await tasks.improve(llm, body)


@app.post("/v1/cover-letter", dependencies=[Depends(require_token)])
async def cover_letter(body: CoverLetterIn, llm: Llm = Depends(get_llm)) -> dict[str, Any]:
    return await tasks.cover_letter(llm, body)


@app.post("/v1/requirements/extract", dependencies=[Depends(require_token)])
async def requirements(body: RequirementsIn, llm: Llm = Depends(get_llm)) -> dict[str, Any]:
    return await tasks.extract_requirements(llm, body)
