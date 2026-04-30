"""
/api/bond — P2P поручительство между людьми.

GET  /api/bond/candidates    — список потенциальных поручителей
POST /api/bond/request       — запросить поручительство
POST /api/bond/approve       — одобрить запрос (поручиться)
POST /api/bond/reject        — отклонить запрос
GET  /api/bond/my            — мои входящие/исходящие запросы
"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# В production — хранится в PostgreSQL + Ceramic
# В MVP — in-memory хранилище для демо
_bond_requests: dict[str, dict] = {}


# ── Схемы ─────────────────────────────────────────────────────────────────────

class BondCandidate(BaseModel):
    did_hash_short: str    # первые 12 символов (анонимно)
    reputation: int
    bond_count: int
    success_rate: float
    last_active_days: int


class BondRequestCreate(BaseModel):
    requester_did: str
    expression_proof: str   # из /api/verify/expression
    message: Optional[str] = None   # короткое сообщение поручителю


class BondRequestResponse(BaseModel):
    request_id: str
    status: str             # pending | approved | rejected
    created_at: int


class BondApprove(BaseModel):
    request_id: str
    approver_did: str


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.get("/candidates", response_model=list[BondCandidate])
async def get_candidates(request: Request, limit: int = 20):
    """
    Возвращает список верифицированных людей готовых поручиться.
    AI-подбор через Gonka BondMatcher.
    """
    gonka = request.app.state.gonka
    aptos = request.app.state.aptos

    # В production — берём реальный пул из Aptos/GUN.js
    # В MVP — возвращаем демо-данных
    import random
    rng = random.Random(42)

    mock_candidates = [
        BondCandidate(
            did_hash_short=f"a{i}b{i}c{i}d{i}e{i}f",
            reputation=rng.randint(300, 950),
            bond_count=rng.randint(5, 40),
            success_rate=round(rng.uniform(0.85, 1.0), 2),
            last_active_days=rng.randint(0, 14),
        )
        for i in range(limit)
    ]

    return sorted(mock_candidates, key=lambda c: c.reputation, reverse=True)


@router.post("/request", response_model=BondRequestResponse)
async def create_bond_request(body: BondRequestCreate, request: Request):
    """
    Создаёт запрос на поручительство.
    Уведомляет выбранных кандидатов через P2P (libp2p/WebSocket).
    """
    request_id = str(uuid.uuid4())
    _bond_requests[request_id] = {
        "id": request_id,
        "requester": body.requester_did,
        "expression_proof": body.expression_proof,
        "message": body.message,
        "status": "pending",
        "approvals": [],
        "created_at": int(time.time()),
    }

    return BondRequestResponse(
        request_id=request_id,
        status="pending",
        created_at=_bond_requests[request_id]["created_at"],
    )


@router.post("/approve")
async def approve_bond(body: BondApprove, request: Request):
    """
    Поручитель одобряет запрос.
    При 3+ одобрениях — HumanCredential записывается в Aptos.
    """
    aptos = request.app.state.aptos
    bond_req = _bond_requests.get(body.request_id)
    if not bond_req:
        raise HTTPException(404, "Bond request not found")
    if bond_req["status"] != "pending":
        raise HTTPException(400, "Bond request already resolved")

    # Добавляем одобрение
    if body.approver_did not in bond_req["approvals"]:
        bond_req["approvals"].append(body.approver_did)

    # 3+ одобрений → выдаём credential
    threshold = int(3)
    if len(bond_req["approvals"]) >= threshold:
        bond_req["status"] = "approved"
        # В production — вызываем Aptos issue_credential
        tx_hash = f"0x{'b' * 64}"
        return {
            "status": "credential_issued",
            "approvals": len(bond_req["approvals"]),
            "tx_hash": tx_hash,
            "message": f"Human credential issued after {threshold} bonds",
        }

    return {
        "status": "pending",
        "approvals": len(bond_req["approvals"]),
        "needed": threshold - len(bond_req["approvals"]),
    }


@router.post("/reject")
async def reject_bond(request_id: str, rejecter_did: str):
    """Поручитель отклоняет запрос."""
    bond_req = _bond_requests.get(request_id)
    if not bond_req:
        raise HTTPException(404, "Bond request not found")
    bond_req["status"] = "rejected"
    return {"status": "rejected"}


@router.get("/my")
async def my_bonds(did: str):
    """Возвращает все bond-запросы связанные с DID."""
    incoming = [
        r for r in _bond_requests.values()
        if did in r.get("approvals", [])
    ]
    outgoing = [
        r for r in _bond_requests.values()
        if r.get("requester") == did
    ]
    return {
        "incoming": incoming,
        "outgoing": outgoing,
    }
