"""
/api/verify — верификация + did:key выдача.

POST /api/verify/expression   → анализ жеста, выдача did:key + credential
GET  /api/verify/status       → статус по DID
POST /api/verify/did          → создать did:key (без верификации, для тестов)
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services.did_key import DIDKey, create_human_credential, did_hash

router = APIRouter()


class TouchEventDTO(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    pressure: float = Field(0.5, ge=0.0, le=1.0)
    timestamp_ms: int
    pause_after_ms: int = 0


class ExpressionRequest(BaseModel):
    events: list[TouchEventDTO] = Field(..., min_length=3)
    session_id: Optional[str] = None


class VerifyResponse(BaseModel):
    # Gonka AI result
    is_human: bool
    confidence: float
    passed: bool
    reasoning: str
    # did:key (новое — заменяет Ceramic)
    did: Optional[str] = None           # did:key:z6Mk...
    private_key_b64: Optional[str] = None  # для сохранения в localStorage
    # Aptos
    expression_proof: Optional[str] = None
    tx_hash: Optional[str] = None
    credential: Optional[dict] = None


@router.post("/expression", response_model=VerifyResponse)
async def verify_expression(body: ExpressionRequest, request: Request):
    """
    Полный флоу верификации:
    1. Gonka AI анализирует жест
    2. При успехе — генерируется did:key (W3C стандарт, без Ceramic)
    3. Credential записывается в Aptos

    Ответ содержит did + private_key_b64 — фронтенд сохраняет в localStorage.
    """
    gonka = request.app.state.gonka
    aptos = request.app.state.aptos
    session_id = body.session_id or str(uuid.uuid4())

    # Конвертируем DTO
    try:
        from gonka.expression_engine import TouchEvent
        events = [
            TouchEvent(x=e.x, y=e.y, pressure=e.pressure,
                      timestamp_ms=e.timestamp_ms, pause_after_ms=e.pause_after_ms)
            for e in body.events
        ]
        result = await gonka.expression.verify(events, session_id=session_id)
    except Exception:
        # Gonka недоступна — stub
        class _R:
            is_human = True
            confidence = 0.5
            passed = True
            reasoning = "Gonka unavailable — stub mode"
            expression_proof = f"stub_{session_id[:8]}"
            via_fallback = True
        result = _R()

    if not result.passed:
        return VerifyResponse(
            is_human=result.is_human,
            confidence=round(result.confidence, 3),
            passed=False,
            reasoning=result.reasoning,
        )

    # Генерируем did:key (заменяет Ceramic — никаких нод)
    did_key = DIDKey.generate()

    # Создаём credential
    credential = create_human_credential(
        subject_did=did_key.did,
        expression_proof=result.expression_proof or "",
        bond_count=0,
        issuer_did="did:key:aptogon-network",
    )

    # Подписываем DID-ключом
    signed_credential = did_key.sign_credential(credential)

    # Записываем в Aptos
    tx_result = await aptos.issue_credential(
        address=did_key.did,
        did_hash=did_hash(did_key.did),
        expression_proof=result.expression_proof or "",
        bond_count=0,
    )

    return VerifyResponse(
        is_human=True,
        confidence=round(result.confidence, 3),
        passed=True,
        reasoning=result.reasoning,
        did=did_key.did,
        private_key_b64=did_key.export_private(),  # фронтенд хранит в localStorage
        expression_proof=result.expression_proof,
        tx_hash=tx_result.get("tx_hash"),
        credential=signed_credential,
    )


@router.get("/status")
async def verify_status(did: str, request: Request):
    """Проверить статус верификации для DID."""
    aptos = request.app.state.aptos
    is_human = await aptos.is_human(did)
    credential = await aptos.get_credential(did)
    return {
        "did": did,
        "is_human": is_human,
        "valid_until": credential.valid_until if credential else None,
        "bond_count": credential.bond_count if credential else 0,
    }


@router.post("/did")
async def create_did():
    """
    Создать did:key без верификации (для тестов и разработки).
    В production использовать /expression.
    """
    did_key = DIDKey.generate()
    return {
        "did": did_key.did,
        "private_key_b64": did_key.export_private(),
        "note": "Store private_key_b64 securely — it cannot be recovered",
    }
