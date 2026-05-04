"""
DatabaseService — хранилище bond-запросов.

В production: asyncpg + PostgreSQL (DATABASE_URL env).
В dev:        in-memory dict (fallback, если DATABASE_URL не задан).
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Optional

try:
    import asyncpg
    _HAS_ASYNCPG = True
except ImportError:
    _HAS_ASYNCPG = False

DATABASE_URL = os.getenv("DATABASE_URL", "")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS bond_requests (
    id               TEXT    PRIMARY KEY,
    requester_did    TEXT    NOT NULL,
    expression_proof TEXT    NOT NULL,
    confidence       REAL    NOT NULL DEFAULT 0.0,
    message          TEXT,
    status           TEXT    NOT NULL DEFAULT 'pending',
    auto_approved    BOOLEAN NOT NULL DEFAULT FALSE,
    tx_hash          TEXT,
    created_at       BIGINT  NOT NULL,
    updated_at       BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS bond_approvals (
    id           SERIAL PRIMARY KEY,
    request_id   TEXT   NOT NULL REFERENCES bond_requests(id) ON DELETE CASCADE,
    approver_did TEXT   NOT NULL,
    approved_at  BIGINT NOT NULL,
    UNIQUE (request_id, approver_did)
);

CREATE INDEX IF NOT EXISTS idx_bond_req_requester ON bond_requests (requester_did);
CREATE INDEX IF NOT EXISTS idx_bond_req_status    ON bond_requests (status);
CREATE INDEX IF NOT EXISTS idx_bond_approvals_req ON bond_approvals (request_id);
"""


class DatabaseService:
    """
    Thin async data layer.  All callers use the same interface regardless of
    whether they're backed by PostgreSQL or the in-memory fallback.
    """

    def __init__(self) -> None:
        self._pool: "asyncpg.Pool | None" = None
        self._mem: dict[str, dict] = {}
        self._mem_approvals: dict[str, list[str]] = {}  # request_id → [dids]
        self._use_mem = not (DATABASE_URL and _HAS_ASYNCPG)

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    async def connect(self) -> None:
        if self._use_mem:
            reason = "asyncpg not installed" if not _HAS_ASYNCPG else "no DATABASE_URL"
            print(f"⚠️  DatabaseService: {reason} — using in-memory store (dev mode)")
            return
        self._pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        await self._migrate()
        print(f"✅ DatabaseService: connected to PostgreSQL ({DATABASE_URL[:30]}…)")

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def _migrate(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)

    # ── Bond Requests ──────────────────────────────────────────────────────────

    async def create_bond_request(
        self,
        requester_did: str,
        expression_proof: str,
        confidence: float,
        message: Optional[str] = None,
    ) -> dict:
        now = int(time.time())
        rid = str(uuid.uuid4())
        record: dict = {
            "id": rid,
            "requester_did": requester_did,
            "expression_proof": expression_proof,
            "confidence": confidence,
            "message": message,
            "status": "pending",
            "auto_approved": False,
            "tx_hash": None,
            "approvals": [],
            "created_at": now,
            "updated_at": now,
        }
        if self._use_mem:
            self._mem[rid] = record
            self._mem_approvals[rid] = []
            return record

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO bond_requests
                    (id, requester_did, expression_proof, confidence, message,
                     status, auto_approved, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,'pending',FALSE,$6,$6)
                """,
                rid, requester_did, expression_proof, confidence, message, now,
            )
        return record

    async def get_bond_request(self, request_id: str) -> Optional[dict]:
        if self._use_mem:
            rec = self._mem.get(request_id)
            if rec is None:
                return None
            return {**rec, "approvals": list(self._mem_approvals.get(request_id, []))}

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM bond_requests WHERE id = $1", request_id
            )
            if not row:
                return None
            approval_rows = await conn.fetch(
                "SELECT approver_did FROM bond_approvals WHERE request_id = $1",
                request_id,
            )
            result = dict(row)
            result["approvals"] = [r["approver_did"] for r in approval_rows]
            return result

    async def add_approval(self, request_id: str, approver_did: str) -> list[str]:
        """Add an approval (idempotent). Returns updated approvals list."""
        if self._use_mem:
            bucket = self._mem_approvals.setdefault(request_id, [])
            if approver_did not in bucket:
                bucket.append(approver_did)
            if request_id in self._mem:
                self._mem[request_id]["updated_at"] = int(time.time())
            return list(bucket)

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO bond_approvals (request_id, approver_did, approved_at)
                VALUES ($1,$2,$3)
                ON CONFLICT (request_id, approver_did) DO NOTHING
                """,
                request_id, approver_did, int(time.time()),
            )
            rows = await conn.fetch(
                "SELECT approver_did FROM bond_approvals WHERE request_id = $1",
                request_id,
            )
            return [r["approver_did"] for r in rows]

    async def update_bond_status(
        self,
        request_id: str,
        status: str,
        tx_hash: Optional[str] = None,
        auto_approved: bool = False,
    ) -> None:
        now = int(time.time())
        if self._use_mem:
            rec = self._mem.get(request_id)
            if rec:
                rec["status"] = status
                rec["tx_hash"] = tx_hash
                rec["auto_approved"] = auto_approved
                rec["updated_at"] = now
            return

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE bond_requests
                SET status=$2, tx_hash=$3, auto_approved=$4, updated_at=$5
                WHERE id=$1
                """,
                request_id, status, tx_hash, auto_approved, now,
            )

    async def get_bonds_for_did(self, did: str) -> dict:
        if self._use_mem:
            all_reqs = list(self._mem.values())
            outgoing = [
                {**r, "approvals": self._mem_approvals.get(r["id"], [])}
                for r in all_reqs if r["requester_did"] == did
            ]
            incoming = [
                {**r, "approvals": self._mem_approvals.get(r["id"], [])}
                for r in all_reqs if did in self._mem_approvals.get(r["id"], [])
            ]
            return {"outgoing": outgoing, "incoming": incoming}

        async with self._pool.acquire() as conn:
            out_rows = await conn.fetch(
                "SELECT * FROM bond_requests WHERE requester_did=$1 ORDER BY created_at DESC LIMIT 50",
                did,
            )
            in_rows = await conn.fetch(
                """
                SELECT br.* FROM bond_requests br
                JOIN bond_approvals ba ON ba.request_id = br.id
                WHERE ba.approver_did = $1
                ORDER BY br.created_at DESC LIMIT 50
                """,
                did,
            )
            return {
                "outgoing": [dict(r) for r in out_rows],
                "incoming": [dict(r) for r in in_rows],
            }
