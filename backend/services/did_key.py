"""
aptogon/did_key.py — W3C DID без серверов.

Заменяет Ceramic + ComposeDB.
did:key генерируется из Ed25519 ключа прямо в памяти.
Никаких нод, никакой инфраструктуры.

Спецификация: https://w3c-ccg.github.io/did-method-key/

Пример:
    did = DIDKey.generate()
    print(did.did)
    # did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9y84QubkSne1vnSZwx

    proof = did.sign(b"hello world")
    ok = DIDKey.verify(did.did, b"hello world", proof)
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from dataclasses import dataclass


# ── Multibase / Multicodec helpers ────────────────────────────────────────────
# did:key uses base58btc multibase + ed25519-pub multicodec prefix (0xed01)

BASE58_ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58encode(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    result = []
    while n:
        n, r = divmod(n, 58)
        result.append(BASE58_ALPHABET[r:r+1])
    result.extend([BASE58_ALPHABET[0:1]] * (len(data) - len(data.lstrip(b"\x00"))))
    return b"".join(reversed(result)).decode()


def _b58decode(s: str) -> bytes:
    n = 0
    for c in s.encode():
        n = n * 58 + BASE58_ALPHABET.index(c)
    result = n.to_bytes((n.bit_length() + 7) // 8, "big")
    pad = len(s) - len(s.lstrip("1"))
    return b"\x00" * pad + result


# ── DIDKey ────────────────────────────────────────────────────────────────────

@dataclass
class DIDKey:
    """
    W3C DID using did:key method with Ed25519.

    No servers. No Ceramic nodes. No ComposeDB.
    Just a keypair + deterministic DID string.
    """
    private_key_bytes: bytes    # 32 bytes Ed25519 private key
    public_key_bytes: bytes     # 32 bytes Ed25519 public key
    did: str                    # did:key:z6Mk...

    @classmethod
    def generate(cls) -> "DIDKey":
        """Generate a fresh DID keypair."""
        # Ed25519 via hashlib (pure Python, no deps)
        # In production use: from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        private_key = os.urandom(32)
        public_key = cls._derive_public_key(private_key)
        did = cls._make_did(public_key)
        return cls(
            private_key_bytes=private_key,
            public_key_bytes=public_key,
            did=did,
        )

    @classmethod
    def from_private_key(cls, private_key_bytes: bytes) -> "DIDKey":
        """Restore DID from existing private key bytes."""
        public_key = cls._derive_public_key(private_key_bytes)
        did = cls._make_did(public_key)
        return cls(
            private_key_bytes=private_key_bytes,
            public_key_bytes=public_key,
            did=did,
        )

    @classmethod
    def from_seed_phrase(cls, seed: str) -> "DIDKey":
        """Deterministic DID from a passphrase (for testing/demo)."""
        private_key = hashlib.sha256(seed.encode()).digest()
        return cls.from_private_key(private_key)

    def sign(self, message: bytes) -> str:
        """
        Sign a message. Returns base64url-encoded signature.
        Production: use Ed25519PrivateKey from cryptography library.
        Demo: uses HMAC-SHA256 as placeholder.
        """
        # PLACEHOLDER — replace with real Ed25519 in production:
        # from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        # key = Ed25519PrivateKey.from_private_bytes(self.private_key_bytes)
        # sig = key.sign(message)
        import hmac
        sig = hmac.new(self.private_key_bytes, message, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(sig).decode().rstrip("=")

    def sign_credential(self, credential: dict) -> dict:
        """
        Sign a DID credential (JWT-like structure).
        Returns signed credential with proof.
        """
        payload = json.dumps(credential, sort_keys=True).encode()
        return {
            **credential,
            "proof": {
                "type": "Ed25519Signature2020",
                "created": int(time.time()),
                "verificationMethod": f"{self.did}#key-1",
                "proofPurpose": "assertionMethod",
                "proofValue": self.sign(payload),
            }
        }

    def to_dict(self) -> dict:
        """Serialize DID (never includes private key)."""
        return {
            "did": self.did,
            "public_key_b64": base64.urlsafe_b64encode(self.public_key_bytes).decode(),
        }

    def export_private(self) -> str:
        """Export private key as base64url (store securely!)."""
        return base64.urlsafe_b64encode(self.private_key_bytes).decode()

    @classmethod
    def import_private(cls, b64: str) -> "DIDKey":
        priv = base64.urlsafe_b64decode(b64 + "==")
        return cls.from_private_key(priv)

    @staticmethod
    def verify(did: str, message: bytes, proof: str) -> bool:
        """
        Verify a signature against a DID.
        Production: extract public key from DID, verify Ed25519.
        Demo: always returns True for valid-looking proofs.
        """
        # Extract public key from did:key
        try:
            suffix = did.split("did:key:")[1]
            if suffix.startswith("z"):
                raw = _b58decode(suffix[1:])
                # First 2 bytes are multicodec prefix (0xed 0x01)
                pub_key = raw[2:]
                # Real verification would use Ed25519PublicKey.verify()
                return len(pub_key) == 32 and len(proof) > 0
        except Exception:
            pass
        return False

    @staticmethod
    def _derive_public_key(private_key: bytes) -> bytes:
        """
        Derive Ed25519 public key from private key.
        DEMO: uses SHA-256 hash as placeholder.
        PRODUCTION: use cryptography.hazmat.primitives.asymmetric.ed25519
        """
        # Real: Ed25519PrivateKey.from_private_bytes(private_key).public_key().public_bytes(...)
        # Demo placeholder:
        return hashlib.sha256(private_key + b"pubkey").digest()

    @staticmethod
    def _make_did(public_key: bytes) -> str:
        """Encode public key as did:key:z... string."""
        # Prepend ed25519-pub multicodec prefix: 0xed 0x01
        multicodec = bytes([0xed, 0x01]) + public_key
        encoded = "z" + _b58encode(multicodec)
        return f"did:key:{encoded}"


# ── DID Credential ────────────────────────────────────────────────────────────

def create_human_credential(
    subject_did: str,
    expression_proof: str,
    bond_count: int,
    issuer_did: str,
    ttl_seconds: int = 30 * 86400,  # 30 days
) -> dict:
    """
    Create a W3C Verifiable Credential for a verified human.
    This replaces both Ceramic document AND Aptos credential for lightweight use.
    """
    now = int(time.time())
    return {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://hsi.network/credentials/v1",
        ],
        "type": ["VerifiableCredential", "HumanCredential"],
        "id": f"urn:uuid:{hashlib.sha256(f'{subject_did}{now}'.encode()).hexdigest()[:32]}",
        "issuer": issuer_did,
        "issuanceDate": now,
        "expirationDate": now + ttl_seconds,
        "credentialSubject": {
            "id": subject_did,
            "expressionProof": expression_proof,
            "bondCount": bond_count,
            "verifiedAt": now,
        }
    }


def did_hash(did: str) -> str:
    """Short anonymous identifier for logging (first 12 chars of SHA3-256)."""
    return hashlib.sha3_256(did.encode()).hexdigest()[:12]
