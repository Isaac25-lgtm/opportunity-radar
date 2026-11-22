"""Settings read from the environment. Nothing secret is ever logged or returned."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Shared secret the Cloudflare Worker sends as "Authorization: Bearer <token>".
    service_token: str
    # Claude model and effort. Opus 5.5 by default; override with AI_MODEL / AI_EFFORT.
    model: str
    effort: str
    # Largest text the service accepts in one request (characters).
    max_input_chars: int
    # True when an Anthropic credential is present (the SDK reads it itself).
    has_api_key: bool


def load_settings() -> Settings:
    effort = os.environ.get("AI_EFFORT", "medium").strip().lower()
    if effort not in {"low", "medium", "high", "xhigh", "max"}:
        effort = "medium"
    return Settings(
        service_token=os.environ.get("AI_SERVICE_TOKEN", "").strip(),
        model=os.environ.get("AI_MODEL", "").strip() or "claude-opus-5-5",
        effort=effort,
        max_input_chars=int(os.environ.get("AI_MAX_INPUT_CHARS", "80000")),
        has_api_key=bool(
            os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
        ),
    )
