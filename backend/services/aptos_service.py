"""
aptogon/aptos_service.py — Единственный блокчейн в APTOGON.

Cosmos SDK убран полностью.
Ceramic убран полностью.
Остался только Aptos — для одной задачи:
  Хранить факт верификации человека on-chain.

Два смарт-контракта:
  hsi::credential::issue_credential(did_hash, expression_proof, bond_count)
  hsi::credential::is_human(address) → bool
  hsi::credential::revoke(address)

Всё остальное (профили, сообщения, репутация) — off-chain в PostgreSQL/Redis.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen


@dataclass
class CredentialRecord:
    """Запись в Aptos блокчейне."""
    address: str
    did_hash: str
    expression_proof: str
    bond_count: int
    issued_at: int
    valid_until: int
    revoked: bool = False

    @property
    def is_valid(self) -> bool:
        return not self.revoked and time.time() < self.valid_until


class AptosService:
    """
    Взаимодействие с Aptos — только для HumanCredential.

    Testnet: https://fullnode.testnet.aptoslabs.com/v1
    Explorer: https://explorer.aptoslabs.com/?network=testnet
    Faucet:   https://aptoslabs.com/testnet-faucet

    Получить тестовые APT:
        curl -X POST https://faucet.testnet.aptoslabs.com/mint \
          -d '{"address":"YOUR_ADDRESS","amount":10000}'
    """

    # TTL credential по умолчанию
    CREDENTIAL_TTL = 30 * 86400  # 30 дней

    def __init__(self):
        self.node_url = os.getenv(
            "APTOS_NODE_URL",
            "https://fullnode.testnet.aptoslabs.com/v1"
        )
        self.contract = os.getenv("APTOGON_CONTRACT", "0x1")
        self.private_key = os.getenv("APTOS_PRIVATE_KEY")
        self.signer_address = os.getenv("APTOS_SIGNER_ADDRESS")

        # In-memory fallback для MVP без реального Aptos
        self._local_store: dict[str, CredentialRecord] = {}
        self._use_local = not bool(self.private_key)

        if self._use_local:
            print("⚠️  APTOS_PRIVATE_KEY не задан — используется local store (только для MVP)")

    async def issue_credential(
        self,
        address: str,
        did_hash: str,
        expression_proof: str,
        bond_count: int = 0,
    ) -> dict:
        """
        Выдаёт HumanCredential.
        В production записывает в Aptos Move контракт.
        В MVP — хранит локально.
        """
        now = int(time.time())
        record = CredentialRecord(
            address=address,
            did_hash=did_hash,
            expression_proof=expression_proof,
            bond_count=bond_count,
            issued_at=now,
            valid_until=now + self.CREDENTIAL_TTL,
        )

        if self._use_local:
            self._local_store[address] = record
            return {
                "tx_hash": f"local:{hashlib.sha256(address.encode()).hexdigest()[:16]}",
                "network": "local_mock",
                "valid_until": record.valid_until,
                "explorer_url": None,
            }

        # Production: вызываем Aptos Move контракт
        try:
            tx_hash = await self._submit_tx(
                function=f"{self.contract}::credential::issue_credential",
                args=[did_hash, expression_proof, str(bond_count)],
            )
            return {
                "tx_hash": tx_hash,
                "network": "testnet" if "testnet" in self.node_url else "mainnet",
                "valid_until": record.valid_until,
                "explorer_url": f"https://explorer.aptoslabs.com/txn/{tx_hash}",
            }
        except Exception as e:
            # Aptos недоступен — сохраняем локально
            self._local_store[address] = record
            return {
                "tx_hash": f"fallback:{hashlib.sha256(address.encode()).hexdigest()[:16]}",
                "network": "local_fallback",
                "valid_until": record.valid_until,
                "error": str(e),
            }

    async def is_human(self, address: str) -> bool:
        """Проверяет наличие действующего credential."""
        # Сначала проверяем локальный store
        if address in self._local_store:
            return self._local_store[address].is_valid

        if self._use_local:
            return False

        # Запрос к Aptos view-function
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._view(
                    f"{self.contract}::credential::is_human",
                    [address]
                )
            )
            return bool(result)
        except Exception:
            return True  # оптимистично при недоступности ноды

    async def get_credential(self, address: str) -> Optional[CredentialRecord]:
        """Получить полную запись credential."""
        if address in self._local_store:
            return self._local_store[address]
        return None

    async def revoke(self, address: str) -> bool:
        """Отозвать credential (бот обнаружен)."""
        if address in self._local_store:
            self._local_store[address].revoked = True
            return True
        return False

    async def get_stats(self) -> dict:
        """Статистика для дашборда."""
        total = len(self._local_store)
        valid = sum(1 for r in self._local_store.values() if r.is_valid)
        return {
            "total_credentials": total,
            "valid_credentials": valid,
            "revoked": total - valid,
            "network": "local_mock" if self._use_local else "aptos_testnet",
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _view(self, function: str, args: list):
        """Вызов view-функции Aptos."""
        url = f"{self.node_url}/view"
        payload = json.dumps({
            "function": function,
            "type_arguments": [],
            "arguments": args,
        }).encode()
        req = Request(url, data=payload,
                     headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            return data[0] if data else None

    async def _submit_tx(self, function: str, args: list) -> str:
        """
        Отправить транзакцию в Aptos.
        Требует APTOS_PRIVATE_KEY в окружении.

        Production: используй aptos-sdk-python:
            pip install aptos-sdk
        """
        # Заглушка — в production замени на:
        # from aptos_sdk.account import Account
        # from aptos_sdk.async_client import RestClient
        # client = RestClient(self.node_url)
        # account = Account.load_key(self.private_key)
        # txn_hash = await client.bcs_transaction(account, ...)
        raise NotImplementedError(
            "Установи aptos-sdk и реализуй подпись транзакции. "
            "Для MVP достаточно local store."
        )
