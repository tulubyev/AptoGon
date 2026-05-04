"""
WebSocketManager — P2P-уведомления для HSI Bond системы.

Архитектура:
  Каждый DID может иметь одно активное WebSocket-соединение.
  Сервер выступает как relay (не хранит сообщения постоянно).
  Сообщения шифруются на транспортном уровне (wss://).

Каналы уведомлений:
  bond:request   → поручителю пришёл запрос на поручительство
  bond:approved  → запрашивающему: поручительство одобрено
  bond:rejected  → запрашивающему: поручительство отклонено
  bond:retry     → запрашивающему: не хватило согласий, повторный запрос
  bond:complete  → запрашивающему: 3/3 собраны, credential выдан
  bond:chat      → анонимное сообщение в рамках bond-запроса
  ping           → keepalive

Приватность:
  В сообщениях НЕТ имён, IP, email.
  Поручитель видит только: request_id, краткий хэш DID, confidence-бейдж.
  Запрашивающий видит только: request_id, статус.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Optional

from fastapi import WebSocket


class ConnectionManager:
    """
    Хранит активные WebSocket-соединения по did_hash.
    did_hash = первые 16 символов SHA3-256(did) — анонимный идентификатор сессии.

    Использование:
        manager = ConnectionManager()
        # В WS-эндпоинте:
        await manager.connect(websocket, did_hash)
        # Для отправки уведомления поручителю:
        await manager.send(did_hash, {"type": "bond:request", ...})
        # Широковещательная рассылка:
        await manager.broadcast_to(did_hashes, payload)
    """

    def __init__(self) -> None:
        # did_hash → WebSocket
        self._connections: dict[str, WebSocket] = {}
        # did_hash → last_seen timestamp
        self._last_seen: dict[str, float] = {}

    async def connect(self, websocket: WebSocket, did_hash: str) -> None:
        await websocket.accept()
        # Закрываем старое соединение если есть (переподключение)
        old = self._connections.get(did_hash)
        if old:
            try:
                await old.close(1001)
            except Exception:
                pass
        self._connections[did_hash] = websocket
        self._last_seen[did_hash] = time.time()

    def disconnect(self, did_hash: str) -> None:
        self._connections.pop(did_hash, None)
        self._last_seen.pop(did_hash, None)

    def is_online(self, did_hash: str) -> bool:
        return did_hash in self._connections

    def online_count(self) -> int:
        return len(self._connections)

    async def send(self, did_hash: str, payload: dict) -> bool:
        """Отправить сообщение конкретному DID. Возвращает True если доставлено."""
        ws = self._connections.get(did_hash)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
            self._last_seen[did_hash] = time.time()
            return True
        except Exception:
            self.disconnect(did_hash)
            return False

    async def broadcast_to(
        self,
        did_hashes: list[str],
        payload: dict,
    ) -> dict[str, bool]:
        """Разослать сообщение списку DID. Возвращает {did_hash: delivered}."""
        results = {}
        tasks = [self.send(dh, payload) for dh in did_hashes]
        delivered = await asyncio.gather(*tasks, return_exceptions=True)
        for dh, ok in zip(did_hashes, delivered):
            results[dh] = ok is True
        return results

    async def notify_bond_request(
        self,
        guarantor_did_hashes: list[str],
        request_id: str,
        requester_did_hash_short: str,
        confidence: float,
        message: Optional[str] = None,
    ) -> list[str]:
        """
        Уведомить потенциальных поручителей о новом запросе.
        Возвращает список did_hash тех, кто получил уведомление (онлайн).
        """
        payload = {
            "type": "bond:request",
            "request_id": request_id,
            "requester": requester_did_hash_short,  # только короткий хэш
            "confidence_badge": _confidence_badge(confidence),
            "message": message or "",
            "ts": int(time.time()),
        }
        results = await self.broadcast_to(guarantor_did_hashes, payload)
        return [dh for dh, ok in results.items() if ok]

    async def notify_bond_update(
        self,
        requester_did_hash: str,
        request_id: str,
        event: str,       # approved | rejected | retry | complete
        approvals: int = 0,
        tx_hash: Optional[str] = None,
        retry_num: int = 0,
    ) -> bool:
        """Уведомить запрашивающего об изменении статуса его bond-запроса."""
        payload = {
            "type": f"bond:{event}",
            "request_id": request_id,
            "approvals": approvals,
            "tx_hash": tx_hash,
            "retry_num": retry_num,
            "ts": int(time.time()),
        }
        return await self.send(requester_did_hash, payload)

    async def send_bond_chat(
        self,
        to_did_hash: str,
        request_id: str,
        from_role: str,   # "requester" | "guarantor"
        text: str,
    ) -> bool:
        """
        Анонимное сообщение в рамках bond-запроса.
        Получатель видит только роль отправителя, не его DID.
        """
        if len(text) > 500:
            text = text[:500]
        payload = {
            "type": "bond:chat",
            "request_id": request_id,
            "from": from_role,
            "text": text,
            "ts": int(time.time()),
        }
        return await self.send(to_did_hash, payload)

    async def ping_all(self) -> None:
        """Keepalive — отправить ping всем соединениям, убрать мёртвые."""
        dead = []
        for did_hash, ws in list(self._connections.items()):
            try:
                await ws.send_text('{"type":"ping"}')
            except Exception:
                dead.append(did_hash)
        for dh in dead:
            self.disconnect(dh)

    def stats(self) -> dict:
        return {
            "online": self.online_count(),
            "connections": list(self._connections.keys()),
        }


def _confidence_badge(confidence: float) -> str:
    """Бейдж уровня уверенности AI — не раскрывает точное значение."""
    if confidence >= 0.95:
        return "⭐ high"
    if confidence >= 0.85:
        return "✓ good"
    return "~ ok"
