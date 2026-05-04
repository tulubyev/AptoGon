"""
/api/bond — P2P поручительство (HSI Bond).

GET  /api/bond/candidates            — список потенциальных поручителей
POST /api/bond/request               — создать запрос на поручительство
GET  /api/bond/status/{request_id}   — статус запроса (polling с фронтенда)
POST /api/bond/approve               — одобрить запрос
POST /api/bond/reject                — отклонить запрос
GET  /api/bond/my                    — мои входящие/исходящие запросы

Логика (Stage 1 + Stage 2):
  confidence >= AUTO_APPROVE_THRESHOLD (0.95)
      → немедленный авто-апрув тремя системными поручителями
      → HumanCredential записывается в Aptos сразу

  confidence < AUTO_APPROVE_THRESHOLD
      → запрос попадает в очередь PostgreSQL
      → реальные люди получают уведомления (TODO: WebSocket push)
      → при 3+ одобрениях выдаётся credential
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# ── Константы ──────────────────────────────────────────────────────────────────

AUTO_APPROVE_THRESHOLD = 0.95  # confidence >= этого → авто-апрув системными поручителями
BOND_THRESHOLD = 3             # минимум N поручительств для выдачи credential
MAX_RETRIES = 3                # максимум повторных рассылок при отказе всех
RETRY_BATCH_SIZE = 10          # кандидатов в одной рассылке

# Bootstrap-пул системных поручителей.
# В production → заменяются реальными DID верифицированной команды.
SYSTEM_GUARANTORS = [
    "did:key:z6Mkha37jzNwQWqW2qo7XtEy4JtBFJTz6T9VkS3Np7gAlpha",
    "did:key:z6Mkha37jzNwQWqW2qo7XtEy4JtBFJTz6T9VkS3Np7gBeta",
    "did:key:z6Mkha37jzNwQWqW2qo7XtEy4JtBFJTz6T9VkS3Np7gGamma",
]


# ── Схемы ──────────────────────────────────────────────────────────────────────

class BondCandidate(BaseModel):
    did_hash_short: str
    reputation: int
    bond_count: int
    success_rate: float
    last_active_days: int


class BondRequestCreate(BaseModel):
    requester_did: str
    expression_proof: str
    confidence: float = 0.0   # из ответа /api/verify/expression
    message: Optional[str] = None


class BondStatusResponse(BaseModel):
    request_id: str
    status: str               # pending | approved | rejected
    auto_approved: bool
    approvals: int
    needed: int
    tx_hash: Optional[str] = None
    created_at: int


class BondApprove(BaseModel):
    request_id: str
    approver_did: str


# ── Trust Score ────────────────────────────────────────────────────────────────

def _calculate_trust_score(bond_count: int) -> float:
    """
    Уровни доверия по числу поручительств:
      0 bonds → 0.1  (прошёл Gonka AI, новичок)
      1 bond  → 0.2
      2 bonds → 0.3
      3 bonds → 0.5  (признан сообществом)
      4 bonds → 0.6
      5 bonds → 0.7
      6 bonds → 0.8
      7+ bonds → 1.0 (полное доверие)
    """
    if bond_count == 0:
        return 0.1
    if bond_count < 3:
        return 0.1 + bond_count * 0.1
    if bond_count < 7:
        return 0.5 + (bond_count - 3) * 0.1
    return 1.0


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _issue_credential(aptos, bond_req: dict, approvals: list[str]) -> str:
    """Записать HumanCredential в Aptos. Возвращает tx_hash."""
    try:
        from services.did_key import did_hash
        tx = await aptos.issue_credential(
            address=bond_req["requester_did"],
            did_hash=did_hash(bond_req["requester_did"]),
            expression_proof=bond_req["expression_proof"],
            bond_count=len(approvals),
        )
        return tx.get("tx_hash") or f"0x{'a' * 64}"
    except Exception:
        # В dev окружении Aptos может быть недоступен — возвращаем stub
        return f"0x{'b' * 64}"


# ── Эндпоинты ──────────────────────────────────────────────────────────────────

@router.get("/candidates", response_model=list[BondCandidate])
async def get_candidates(request: Request, limit: int = 20):
    """
    Список верифицированных людей, готовых стать поручителями.
    Подбирается через Gonka BondMatcher (в production).
    Сейчас — стабильные демо-данные (seed=42).
    """
    import random
    rng = random.Random(42)

    candidates = [
        BondCandidate(
            did_hash_short=f"a{i}b{i}c{i}d{i}e{i}f",
            reputation=rng.randint(300, 950),
            bond_count=rng.randint(5, 40),
            success_rate=round(rng.uniform(0.85, 1.0), 2),
            last_active_days=rng.randint(0, 14),
        )
        for i in range(limit)
    ]
    return sorted(candidates, key=lambda c: c.reputation, reverse=True)


@router.post("/request", response_model=BondStatusResponse)
async def create_bond_request(body: BondRequestCreate, request: Request):
    """
    Создаёт bond-запрос.

    Stage 1 — confidence >= 0.95:
        Системные поручители немедленно одобряют.
        HumanCredential выдаётся мгновенно.

    Stage 2 — confidence < 0.95:
        Запрос сохраняется в очереди.
        Реальные люди уведомляются и одобряют через /approve.
    """
    db = request.app.state.db
    aptos = request.app.state.aptos

    bond_req = await db.create_bond_request(
        requester_did=body.requester_did,
        expression_proof=body.expression_proof,
        confidence=body.confidence,
        message=body.message,
    )

    # ── Stage 1: Auto-approve при высоком confidence AI ────────────────────────
    if body.confidence >= AUTO_APPROVE_THRESHOLD:
        for sys_did in SYSTEM_GUARANTORS:
            await db.add_approval(bond_req["id"], sys_did)

        tx_hash = await _issue_credential(aptos, bond_req, SYSTEM_GUARANTORS)
        await db.update_bond_status(
            bond_req["id"], "approved", tx_hash=tx_hash, auto_approved=True
        )

        return BondStatusResponse(
            request_id=bond_req["id"],
            status="approved",
            auto_approved=True,
            approvals=len(SYSTEM_GUARANTORS),
            needed=0,
            tx_hash=tx_hash,
            created_at=bond_req["created_at"],
        )

    # ── Stage 2: Очередь + WebSocket push поручителям ─────────────────────────
    ws_manager = getattr(request.app.state, "ws_manager", None)
    delivered = []
    if ws_manager:
        # Собираем did_hash из пула кандидатов (TODO: реальный пул из БД)
        # Сейчас — берём первые RETRY_BATCH_SIZE онлайн-соединений
        import random, hashlib
        rng = random.Random(int(time.time()))  # разные кандидаты при каждом запросе
        all_online = list(ws_manager._connections.keys())
        candidates_to_notify = rng.sample(all_online, min(RETRY_BATCH_SIZE, len(all_online)))

        from services.did_key import did_hash as _did_hash
        requester_short = _did_hash(body.requester_did)[:12]
        delivered = await ws_manager.notify_bond_request(
            guarantor_did_hashes=candidates_to_notify,
            request_id=bond_req["id"],
            requester_did_hash_short=requester_short,
            confidence=body.confidence,
            message=body.message,
        )
        # Обновляем sent_to_count
        if delivered:
            await db.increment_retry(bond_req["id"], len(candidates_to_notify))

    return BondStatusResponse(
        request_id=bond_req["id"],
        status="pending",
        auto_approved=False,
        approvals=0,
        needed=BOND_THRESHOLD,
        tx_hash=None,
        created_at=bond_req["created_at"],
    )


@router.get("/status/{request_id}", response_model=BondStatusResponse)
async def get_bond_status(request_id: str, request: Request):
    """
    Статус bond-запроса. Используется для polling с фронтенда.
    Фронтенд опрашивает каждые 2–5 секунд до status == 'approved'.
    """
    db = request.app.state.db
    bond_req = await db.get_bond_request(request_id)
    if not bond_req:
        raise HTTPException(status_code=404, detail="Bond request not found")

    approvals = bond_req.get("approvals", [])
    return BondStatusResponse(
        request_id=bond_req["id"],
        status=bond_req["status"],
        auto_approved=bool(bond_req.get("auto_approved", False)),
        approvals=len(approvals),
        needed=max(0, BOND_THRESHOLD - len(approvals)),
        tx_hash=bond_req.get("tx_hash"),
        created_at=bond_req["created_at"],
    )


@router.post("/approve")
async def approve_bond(body: BondApprove, request: Request):
    """
    Поручитель одобряет запрос.
    При BOND_THRESHOLD+ одобрениях выдаётся HumanCredential.

    Защита от Sybil:
      - Нельзя поручиться за самого себя
      - Поручитель должен иметь trust_score >= 0.5 (признан сообществом)
        или являться системным поручителем (SYSTEM_GUARANTORS)
    """
    db = request.app.state.db
    aptos = request.app.state.aptos

    bond_req = await db.get_bond_request(body.request_id)
    if not bond_req:
        raise HTTPException(status_code=404, detail="Bond request not found")
    if bond_req["status"] not in ("pending",):
        raise HTTPException(
            status_code=400,
            detail=f"Bond request status is '{bond_req['status']}' — cannot approve",
        )

    # ── Защита от самопоручительства ──────────────────────────────────────────
    if body.approver_did == bond_req["requester_did"]:
        raise HTTPException(status_code=400, detail="Cannot vouch for yourself")

    # ── Проверка trust_score поручителя ───────────────────────────────────────
    # Системные поручители всегда разрешены (bootstrap)
    if body.approver_did not in SYSTEM_GUARANTORS:
        approver_cred = await aptos.get_credential(body.approver_did)
        if approver_cred is None or approver_cred.trust_score < 0.5:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_trust",
                    "message": "Approver trust_score < 0.5. Get at least 3 bonds first.",
                    "required": 0.5,
                    "current": approver_cred.trust_score if approver_cred else 0.0,
                },
            )

    approvals = await db.add_approval(body.request_id, body.approver_did)

    if len(approvals) >= BOND_THRESHOLD:
        tx_hash = await _issue_credential(aptos, bond_req, approvals)
        await db.update_bond_status(body.request_id, "approved", tx_hash=tx_hash)

        # Обновляем trust_score получателя
        new_score = _calculate_trust_score(len(approvals))
        from services.did_key import did_hash as _did_hash
        await aptos.update_trust_score(
            address=bond_req["requester_did"],
            new_score=new_score,
            bond_sponsors=[_did_hash(d)[:12] for d in approvals],
        )

        return {
            "status": "credential_issued",
            "approvals": len(approvals),
            "tx_hash": tx_hash,
            "trust_score": new_score,
            "message": f"HumanCredential issued after {len(approvals)} bonds",
        }

    return {
        "status": "pending",
        "approvals": len(approvals),
        "needed": BOND_THRESHOLD - len(approvals),
    }


@router.post("/retry/{request_id}")
async def retry_bond_request(request_id: str, request: Request):
    """
    Повторная рассылка bond-запроса новой волне кандидатов.
    Вызывается автоматически если все предыдущие кандидаты отказали,
    или вручную запрашивающим.
    Максимум MAX_RETRIES (3) повторов.
    """
    db = request.app.state.db
    ws_manager = getattr(request.app.state, "ws_manager", None)

    bond_req = await db.get_bond_request(request_id)
    if not bond_req:
        raise HTTPException(status_code=404, detail="Bond request not found")
    if bond_req["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Bond request status is '{bond_req['status']}' — cannot retry",
        )

    retry_count = bond_req.get("retry_count", 0)
    if retry_count >= MAX_RETRIES:
        # Исчерпали все попытки — переводим в failed
        await db.update_bond_status(request_id, "failed")
        from services.did_key import did_hash as _did_hash
        requester_hash = _did_hash(bond_req["requester_did"])[:16]
        if ws_manager:
            await ws_manager.notify_bond_update(
                requester_hash, request_id, "failed"
            )
        return {
            "status": "failed",
            "message": f"Exhausted {MAX_RETRIES} retry attempts. No guarantors available.",
            "retry_count": retry_count,
        }

    delivered = []
    if ws_manager:
        import random
        rng = random.Random(int(time.time()) + retry_count)
        all_online = list(ws_manager._connections.keys())
        candidates = rng.sample(all_online, min(RETRY_BATCH_SIZE, len(all_online)))

        from services.did_key import did_hash as _did_hash
        requester_short = _did_hash(bond_req["requester_did"])[:12]
        delivered = await ws_manager.notify_bond_request(
            guarantor_did_hashes=candidates,
            request_id=request_id,
            requester_did_hash_short=requester_short,
            confidence=bond_req.get("confidence", 0),
            message=bond_req.get("message"),
        )

    new_retry = await db.increment_retry(request_id, len(delivered))
    return {
        "status": "pending",
        "retry_count": new_retry,
        "notified": len(delivered),
        "message": f"Retry #{new_retry}: sent to {len(delivered)} guarantors online",
    }


@router.post("/reject")
async def reject_bond(request_id: str, rejecter_did: str, request: Request):
    """
    Поручитель отклоняет запрос.
    Если все разосланные кандидаты отказали → автоматический retry.
    """
    db = request.app.state.db
    bond_req = await db.get_bond_request(request_id)
    if not bond_req:
        raise HTTPException(status_code=404, detail="Bond request not found")

    # Записываем отказ; метод возвращает True если все отказали
    all_declined = await db.record_rejection(request_id, rejecter_did)

    if all_declined:
        # Автоматический retry (если не исчерпан лимит)
        from fastapi import BackgroundTasks
        retry_count = bond_req.get("retry_count", 0)
        if retry_count < MAX_RETRIES:
            # Запускаем retry через отдельный вызов эндпоинта
            # (упрощённо — вызываем логику напрямую)
            await retry_bond_request(request_id, request)
            return {"status": "all_declined_retry_sent", "retry": retry_count + 1}
        else:
            await db.update_bond_status(request_id, "failed")
            ws_manager = getattr(request.app.state, "ws_manager", None)
            if ws_manager:
                from services.did_key import did_hash as _did_hash
                requester_hash = _did_hash(bond_req["requester_did"])[:16]
                await ws_manager.notify_bond_update(
                    requester_hash, request_id, "failed"
                )
            return {"status": "failed", "message": "All retries exhausted"}

    return {"status": "reject_recorded"}


@router.get("/my")
async def my_bonds(did: str, request: Request):
    """Все bond-запросы, связанные с DID (входящие + исходящие)."""
    db = request.app.state.db
    return await db.get_bonds_for_did(did)
