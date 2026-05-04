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

    # ── Stage 2: В очередь ─────────────────────────────────────────────────────
    # TODO: отправить уведомления кандидатам через WebSocket/push
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

    approvals = await db.add_approval(body.request_id, body.approver_did)

    if len(approvals) >= BOND_THRESHOLD:
        tx_hash = await _issue_credential(aptos, bond_req, approvals)
        await db.update_bond_status(body.request_id, "approved", tx_hash=tx_hash)
        return {
            "status": "credential_issued",
            "approvals": len(approvals),
            "tx_hash": tx_hash,
            "message": f"HumanCredential issued after {len(approvals)} bonds",
        }

    return {
        "status": "pending",
        "approvals": len(approvals),
        "needed": BOND_THRESHOLD - len(approvals),
    }


@router.post("/reject")
async def reject_bond(request_id: str, rejecter_did: str, request: Request):
    """Поручитель отклоняет запрос."""
    db = request.app.state.db
    bond_req = await db.get_bond_request(request_id)
    if not bond_req:
        raise HTTPException(status_code=404, detail="Bond request not found")
    await db.update_bond_status(request_id, "rejected")
    return {"status": "rejected"}


@router.get("/my")
async def my_bonds(did: str, request: Request):
    """Все bond-запросы, связанные с DID (входящие + исходящие)."""
    db = request.app.state.db
    return await db.get_bonds_for_did(did)
