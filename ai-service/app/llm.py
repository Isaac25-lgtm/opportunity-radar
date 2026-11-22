"""The only place that talks to Claude.

Every call asks for JSON that matches a schema (structured outputs), so the rest of the service works
with plain dicts. Failures are turned into LlmError with a short code the API maps to a status.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

import anthropic


class LlmError(Exception):
    """A model call failed. `code` is safe to show; `retryable` tells the caller whether to try later."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


class Llm(Protocol):
    async def json(self, *, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]: ...


class ClaudeLlm:
    """Claude through the official SDK. Credentials come from ANTHROPIC_API_KEY (or an ant profile)."""

    def __init__(self, model: str, effort: str) -> None:
        self.model = model
        self.effort = effort
        self.client = anthropic.AsyncAnthropic(timeout=90.0, max_retries=2)

    async def json(self, *, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                # If a safety classifier declines, the API retries on a suitable model in the same call.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={
                    "effort": self.effort,
                    "format": {"type": "json_schema", "schema": schema},
                },
            )
        except anthropic.RateLimitError as e:
            raise LlmError("busy", "The AI service is busy. Try again shortly.", True) from e
        except anthropic.AuthenticationError as e:
            raise LlmError("not_configured", "The AI service credentials are not valid.") from e
        except anthropic.BadRequestError as e:
            raise LlmError("bad_request", "The AI request was rejected.") from e
        except anthropic.APIStatusError as e:
            raise LlmError("upstream", "The AI provider returned an error.", e.status_code >= 500) from e
        except anthropic.APIConnectionError as e:
            raise LlmError("unreachable", "The AI provider could not be reached.", True) from e

        if response.stop_reason == "refusal":
            raise LlmError("refused", "The AI declined this request.")
        if response.stop_reason == "max_tokens":
            raise LlmError("too_long", "The document is too long to process in one go.")
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise LlmError("bad_output", "The AI returned an unreadable answer.", True) from e
        if not isinstance(data, dict):
            raise LlmError("bad_output", "The AI returned an unreadable answer.", True)
        return data
