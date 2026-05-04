"""
/api/verify — верификация + did:key выдача.

POST /api/verify/expression   → анализ жеста, выдача did:key + credential
GET  /api/verify/status       → статус по DID
POST /api/verify/did          → создать did:key (без верификации, для тестов)
GET  /api/verify/debug        → последние попытки верификации (для отладки)
"""

import json
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

_DEBUG_LOG = Path("/tmp/aptogon_attempts.jsonl")


def _save_attempt(record: dict):
    with open(_DEBUG_LOG, "a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

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
    fp_hash: Optional[str] = Field(None, min_length=16, max_length=128,
                                   description="SHA-256 device fingerprint hash (64 hex chars)")


class VerifyResponse(BaseModel):
    # Gonka AI result
    is_human: bool
    confidence: float
    passed: bool
    reasoning: str
    via_fallback: bool = False
    anomalies: list[str] = []
    # did:key (новое — заменяет Ceramic)
    did: Optional[str] = None
    private_key_b64: Optional[str] = None
    # Aptos
    expression_proof: Optional[str] = None
    tx_hash: Optional[str] = None
    credential: Optional[dict] = None
    # Sybil Protection B: Trust Score
    trust_score: float = 0.1
    trust_label: str = "newcomer"   # newcomer | community_verified | trusted
    # Debug: pattern metrics
    debug: Optional[dict] = None


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

    # ── [Sybil Protection C] Device fingerprint rate-limit ────────────────────
    if body.fp_hash:
        fp_store = getattr(request.app.state, "fp_store", None)
        if fp_store:
            fp_result = fp_store.check_and_record(
                fp_hash=body.fp_hash,
                did_hash_short="pending",
            )
            if not fp_result.allowed:
                import datetime
                next_dt = datetime.datetime.utcfromtimestamp(
                    fp_result.next_allowed_at
                ).strftime("%Y-%m-%d") if fp_result.next_allowed_at else "N/A"
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "verification_rate_limit",
                        "message": (
                            f"Too many verifications from this device "
                            f"({fp_result.count}/{fp_result.limit} "
                            f"in {fp_result.window_days} days). "
                            f"Next allowed: {next_dt}"
                        ),
                        "next_allowed_at": fp_result.next_allowed_at,
                        "count": fp_result.count,
                        "limit": fp_result.limit,
                    },
                )

    # Конвертируем DTO
    pattern_debug = {}
    try:
        from gonka.expression_engine import TouchEvent, PatternExtractor
        events = [
            TouchEvent(x=e.x, y=e.y, pressure=e.pressure,
                      timestamp_ms=e.timestamp_ms, pause_after_ms=e.pause_after_ms)
            for e in body.events
        ]
        # Extract pattern for debug BEFORE sending to AI
        extractor = PatternExtractor()
        pattern = extractor.extract(events)
        pattern_debug = {
            "velocity_std": round(pattern.velocity_std, 4),
            "velocity_mean": round(pattern.velocity_mean, 4),
            "pause_entropy": round(pattern.pause_entropy, 4),
            "correction_count": pattern.correction_count,
            "rhythm_irregularity": round(pattern.rhythm_irregularity, 4),
            "total_duration_ms": pattern.total_duration_ms,
            "point_count": pattern.point_count,
            "possible_motor_difficulty": pattern.possible_motor_difficulty,
        }
        result = await gonka.expression.verify(events, session_id=session_id)
    except Exception as exc:
        class _R:
            is_human = True
            confidence = 0.5
            passed = True
            reasoning = f"Gonka unavailable: {exc}"
            expression_proof = f"stub_{session_id[:8]}"
            via_fallback = True
            anomalies = []
            analysis_latency_ms = 0
        result = _R()

    # Save debug record
    _save_attempt({
        "ts": time.time(),
        "session_id": session_id,
        "passed": result.passed,
        "is_human": result.is_human,
        "confidence": round(result.confidence, 3),
        "via_fallback": result.via_fallback,
        "reasoning": result.reasoning,
        "anomalies": getattr(result, "anomalies", []),
        "latency_ms": round(getattr(result, "analysis_latency_ms", 0)),
        "pattern": pattern_debug,
        "event_count": len(body.events),
    })

    if not result.passed:
        return VerifyResponse(
            is_human=result.is_human,
            confidence=round(result.confidence, 3),
            passed=False,
            reasoning=result.reasoning,
            via_fallback=result.via_fallback,
            anomalies=getattr(result, "anomalies", []),
            debug=pattern_debug,
        )

    # Генерируем did:key (заменяет Ceramic — никаких нод)
    did_key = DIDKey.generate()

    # Обновляем did_hash_short в fingerprint-записи (была "pending")
    if body.fp_hash:
        fp_store = getattr(request.app.state, "fp_store", None)
        if fp_store:
            from services.did_key import did_hash as _did_hash
            fp_store.update_did_hash(body.fp_hash, _did_hash(did_key.did)[:12])

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
        via_fallback=result.via_fallback,
        anomalies=getattr(result, "anomalies", []),
        did=did_key.did,
        private_key_b64=did_key.export_private(),
        expression_proof=result.expression_proof,
        tx_hash=tx_result.get("tx_hash"),
        credential=signed_credential,
        trust_score=0.1,
        trust_label="newcomer",
        debug=pattern_debug,
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


@router.get("/debug")
async def debug_attempts(last: int = 20):
    """Последние N попыток верификации — для отладки механизма."""
    if not _DEBUG_LOG.exists():
        return {"attempts": [], "total": 0}
    lines = _DEBUG_LOG.read_text().strip().splitlines()
    attempts = [json.loads(l) for l in lines[-last:]]
    attempts.reverse()
    return {
        "total": len(lines),
        "showing": len(attempts),
        "attempts": attempts,
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
