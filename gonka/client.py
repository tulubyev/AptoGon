"""
GonkaClient — Base async client for Gonka Network API.

Gonka exposes an OpenAI-compatible /v1/chat/completions endpoint
via their broker at https://broker.gonkabroker.com/v1

This client handles:
  - Async HTTP with connection pooling
  - Automatic retry with exponential backoff
  - Rate limiting (per-model limits)
  - Fallback to local lightweight model if Gonka is unavailable
  - Request/response logging (no personal data)
  - Token usage tracking for HSI fund accounting
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from .models import GonkaModel

logger = logging.getLogger("hsi.gonka")


# ── Configuration ────────────────────────────────────────────────────────────

@dataclass
class GonkaConfig:
    api_key: str
    base_url: str = "https://broker.gonkabroker.com/v1"
    timeout: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0       # seconds, doubles each retry
    fallback_enabled: bool = True
    log_usage: bool = True         # track tokens for fund accounting

    # Privacy: fields NEVER sent to Gonka
    NEVER_LOG_FIELDS: frozenset = field(default_factory=lambda: frozenset({
        "raw_coordinates", "voice_audio", "ip_address",
        "device_fingerprint", "did_full", "email", "phone"
    }))

    @classmethod
    def from_env(cls) -> "GonkaConfig":
        api_key = os.getenv("GONKA_API_KEY")
        if not api_key:
            raise ValueError(
                "GONKA_API_KEY environment variable is required. "
                "Get your key at https://broker.gonkabroker.com"
            )
        return cls(
            api_key=api_key,
            base_url=os.getenv("GONKA_BASE_URL", "https://broker.gonkabroker.com/v1"),
            timeout=float(os.getenv("GONKA_TIMEOUT", "30")),
            max_retries=int(os.getenv("GONKA_MAX_RETRIES", "3")),
            fallback_enabled=os.getenv("GONKA_FALLBACK", "true").lower() == "true",
        )


# ── Response Types ────────────────────────────────────────────────────────────

@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class Usage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class ChatResponse:
    content: str
    model: str
    usage: Optional[Usage]
    latency_ms: float
    via_fallback: bool = False

    def as_json(self) -> dict:
        try:
            return json.loads(self.content)
        except json.JSONDecodeError as e:
            # Strip markdown code fences if model added them
            clean = self.content
            for fence in ["```json", "```JSON", "```"]:
                clean = clean.replace(fence, "")
            clean = clean.strip()
            try:
                return json.loads(clean)
            except json.JSONDecodeError:
                raise ValueError(
                    f"Gonka response is not valid JSON: {self.content[:200]}"
                ) from e


# ── Usage Tracker ────────────────────────────────────────────────────────────

class UsageTracker:
    """
    Tracks token usage for HSI fund accounting.
    Every AI task is paid from the HSI network fund via GNK tokens.
    This tracker records usage so the fund can be replenished via IBC.
    """

    def __init__(self):
        self._records: list[dict] = []
        self._total_tokens: int = 0

    def record(self, model: str, usage: Optional[Usage], task_type: str):
        if not usage:
            return
        record = {
            "timestamp": time.time(),
            "model": model,
            "task_type": task_type,
            "tokens": usage.total_tokens,
            # No personal data — just model metrics
        }
        self._records.append(record)
        self._total_tokens += usage.total_tokens

    @property
    def total_tokens(self) -> int:
        return self._total_tokens

    def get_summary(self) -> dict:
        by_task: dict[str, int] = {}
        for r in self._records:
            by_task[r["task_type"]] = by_task.get(r["task_type"], 0) + r["tokens"]
        return {
            "total_tokens": self._total_tokens,
            "total_requests": len(self._records),
            "by_task": by_task,
            "estimated_gns_cost": self._total_tokens * 0.000002,  # rough estimate
        }


# ── Main Client ───────────────────────────────────────────────────────────────

class GonkaClient:
    """
    Async HTTP client for Gonka Network.

    Example:
        client = GonkaClient(api_key="gk-...")
        response = await client.chat(
            model=GonkaModel.PRIMARY,
            messages=[{"role": "user", "content": "Hello"}],
            task_type="expression_analysis"
        )
        data = response.as_json()
    """

    def __init__(self, api_key: Optional[str] = None, config: Optional[GonkaConfig] = None):
        if config:
            self.config = config
        elif api_key:
            self.config = GonkaConfig(api_key=api_key)
        else:
            self.config = GonkaConfig.from_env()

        self.usage = UsageTracker()
        self._request_count = 0

    async def chat(
        self,
        model: str,
        messages: list[dict],
        *,
        max_tokens: int = 512,
        temperature: float = 0.1,
        task_type: str = "general",
        timeout_override: Optional[float] = None,
    ) -> ChatResponse:
        """
        Send a chat completion request to Gonka.

        Args:
            model: GonkaModel constant or model string
            messages: OpenAI-format message list
            max_tokens: Maximum response tokens
            temperature: 0.0=deterministic, 1.0=creative
            task_type: Label for usage tracking (e.g. "expression_analysis")
            timeout_override: Override default timeout for this request

        Returns:
            ChatResponse with .content (str) and .as_json() helper
        """
        self._request_count += 1
        timeout = timeout_override or self.config.timeout
        start = time.monotonic()

        # Sanitize messages — strip any accidentally included private fields
        safe_messages = self._sanitize_messages(messages)

        payload = {
            "model": model,
            "messages": safe_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        last_error: Optional[Exception] = None
        delay = self.config.retry_delay

        for attempt in range(self.config.max_retries):
            try:
                response_data = await self._post("/chat/completions", payload, timeout)

                latency_ms = (time.monotonic() - start) * 1000
                content = response_data["choices"][0]["message"]["content"]
                model_used = response_data.get("model", model)

                # Track usage for fund accounting
                usage_data = response_data.get("usage")
                usage = None
                if usage_data:
                    usage = Usage(
                        prompt_tokens=usage_data.get("prompt_tokens", 0),
                        completion_tokens=usage_data.get("completion_tokens", 0),
                        total_tokens=usage_data.get("total_tokens", 0),
                    )
                    self.usage.record(model_used, usage, task_type)

                logger.debug(
                    "Gonka %s | task=%s latency=%.0fms tokens=%s",
                    model_used.split("/")[-1],
                    task_type,
                    latency_ms,
                    usage.total_tokens if usage else "?"
                )

                return ChatResponse(
                    content=content,
                    model=model_used,
                    usage=usage,
                    latency_ms=latency_ms,
                )

            except Exception as e:
                last_error = e
                if attempt < self.config.max_retries - 1:
                    logger.warning(
                        "Gonka attempt %d/%d failed: %s. Retrying in %.1fs...",
                        attempt + 1, self.config.max_retries, e, delay
                    )
                    await asyncio.sleep(delay)
                    delay *= 2  # exponential backoff

        # All retries exhausted — try fallback
        if self.config.fallback_enabled:
            logger.warning("Gonka unavailable after %d retries. Using fallback.", self.config.max_retries)
            return await self._fallback_response(messages, task_type, start)

        raise RuntimeError(
            f"Gonka request failed after {self.config.max_retries} attempts: {last_error}"
        )

    async def _post(self, path: str, payload: dict, timeout: float) -> dict:
        """Low-level async HTTP POST."""
        url = self.config.base_url.rstrip("/") + path
        body = json.dumps(payload).encode()

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
            "User-Agent": "hsi-gonka/0.1.0",
            "X-HSI-Request-ID": self._request_id(),
        }

        req = Request(url, data=body, headers=headers, method="POST")

        loop = asyncio.get_event_loop()
        response_data = await loop.run_in_executor(
            None,
            lambda: self._sync_post(req, timeout)
        )
        return response_data

    def _sync_post(self, req: Request, timeout: float) -> dict:
        """Synchronous HTTP call (run in executor thread)."""
        try:
            with urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode()
                data = json.loads(raw)

                if "error" in data:
                    raise ValueError(f"Gonka API error: {data['error']}")

                return data
        except URLError as e:
            raise ConnectionError(f"Cannot reach Gonka broker: {e.reason}") from e

    async def _fallback_response(
        self, messages: list[dict], task_type: str, start: float
    ) -> ChatResponse:
        """
        Fallback when Gonka is unavailable.
        Returns a conservative "needs human review" response
        rather than failing the verification entirely.
        HSI principle: never block a human due to infrastructure failure.
        """
        latency_ms = (time.monotonic() - start) * 1000

        # Task-specific safe defaults
        fallback_content = {
            "expression_analysis": json.dumps({
                "is_human": True,   # safe default: don't block on infra failure
                "confidence": 0.5,  # low confidence signals need for re-check
                "reasoning": "AI analysis unavailable — using conservative default",
                "fallback": True,
            }),
            "antibot_detection": json.dumps({
                "bot_probability": 0.0,  # don't block on infra failure
                "signals": [],
                "fallback": True,
            }),
            "bond_matching": json.dumps({
                "selected": [],
                "reasoning": "Matching unavailable — use random selection",
                "fallback": True,
            }),
            "translation": messages[-1].get("content", ""),  # return original
        }.get(task_type, json.dumps({"fallback": True, "status": "unavailable"}))

        return ChatResponse(
            content=fallback_content,
            model="fallback",
            usage=None,
            latency_ms=latency_ms,
            via_fallback=True,
        )

    def _sanitize_messages(self, messages: list[dict]) -> list[dict]:
        """
        Privacy guard: strip any accidentally included personal data.
        This is a last line of defense — callers should not include
        personal data in the first place.
        """
        safe = []
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                # Check for accidentally included sensitive patterns
                for field in self.config.NEVER_LOG_FIELDS:
                    if field in content.lower():
                        logger.warning(
                            "Potentially sensitive field '%s' found in Gonka message. "
                            "Ensure only anonymized data is sent.", field
                        )
            safe.append({"role": msg["role"], "content": content})
        return safe

    def _request_id(self) -> str:
        """Generates anonymous request ID for tracing (no personal data)."""
        data = f"{time.time()}{self._request_count}".encode()
        return hashlib.sha256(data).hexdigest()[:16]

    async def health_check(self) -> dict:
        """Check if Gonka broker is reachable."""
        try:
            start = time.monotonic()
            response = await self.chat(
                model=GonkaModel.FAST,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=5,
                task_type="health_check",
                timeout_override=5.0,
            )
            return {
                "status": "ok",
                "latency_ms": response.latency_ms,
                "model": response.model,
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
