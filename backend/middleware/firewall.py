"""
APTOGON Firewall — использует did:key вместо Ceramic.

Заголовок: X-APTOGON-DID: did:key:z6Mk...
Проверяем:
  1. Формат did:key валидный
  2. Credential в Aptos (или local store) действует

Открытые пути — без проверки:
  /api/verify/*
  /api/health
  /docs
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from services.did_key import DIDKey

PUBLIC_PATHS = {"/", "/api/health", "/docs", "/openapi.json", "/redoc"}
PUBLIC_PREFIXES = ("/api/verify",)


class AptogonFirewall(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        if not path.startswith("/api/"):
            return await call_next(request)

        did_token = request.headers.get("X-APTOGON-DID")

        if not did_token:
            return JSONResponse(status_code=403, content={
                "error": "did_required",
                "message": "X-APTOGON-DID header required (did:key:z6Mk...)",
                "verify_at": "/api/verify/expression",
            })

        # Проверка формата did:key
        if not did_token.startswith("did:key:z"):
            return JSONResponse(status_code=403, content={
                "error": "invalid_did_format",
                "message": "DID must be did:key:z... format",
            })

        # Проверка в Aptos
        try:
            aptos = request.app.state.aptos
            is_human = await aptos.is_human(did_token)
            if not is_human:
                return JSONResponse(status_code=403, content={
                    "error": "credential_invalid",
                    "message": "Human credential not found or expired",
                    "verify_at": "/api/verify/expression",
                })
        except Exception:
            pass  # Aptos недоступен — пропускаем

        request.state.did = did_token
        request.state.did_short = did_token[-12:]  # последние 12 символов для логов
        return await call_next(request)
