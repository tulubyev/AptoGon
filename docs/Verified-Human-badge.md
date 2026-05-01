# Verified Human Badge — Design, Protection & Implementation

> Part of the APTOGON / HSI (Homo Sapience Internet) protocol  
> Domain: homosapience.org

---

## What Is the Verified Human Badge?

The **Verified Human Badge** (VHB) is a visual + cryptographic proof that a specific action or account is associated with a verified human being — not a bot, script, or AI agent.

Unlike the Twitter blue checkmark (which signals fame or payment), the VHB signals **existence**: this is a real person who passed gesture-based biometric verification.

Key properties:
- **Cannot be bought** — only earned through verification
- **Cannot be transferred** — tied to a device-generated Ed25519 keypair
- **Cannot be faked** — backed by on-chain ExpressionProof (Aptos)
- **Privacy-preserving** — no name, email, or biometric image stored
- **Anonymous** — identified only by a `did:key:z6Mk...` decentralized identifier

---

## How the Badge Is Created

### Step 1: Gesture Verification
The user draws a freehand gesture on the GestureCanvas. Raw coordinates stay in the browser — only statistical features (velocity variance, pause entropy, correction count, rhythm irregularity, etc.) are sent to the backend.

### Step 2: AI Analysis (Gonka / Qwen3-14B)
The feature vector is analyzed by Qwen3-14B via OpenRouter. The model returns:
```json
{
  "is_human": true,
  "confidence": 0.92,
  "anomalies": []
}
```

### Step 3: DID Generation (in browser)
If `is_human = true` and `confidence >= 0.85`, the browser generates:
- Ed25519 keypair via `@noble/ed25519`
- DID: `did:key:z6Mk<base58-encoded-public-key>`
- Stored in `localStorage` (never sent to any server)

### Step 4: ExpressionProof (on-chain)
```
expression_proof = SHA3-256(
  gesture_stats_json +
  did +
  unix_timestamp
)
```
This hash is written to the Aptos blockchain via Move contract.

### Step 5: HumanCredential (W3C VC)
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "HumanCredential"],
  "issuer": "did:web:homosapience.org",
  "credentialSubject": {
    "id": "did:key:z6Mk...",
    "isHuman": true,
    "confidence": 0.92,
    "expressionProof": "sha3:abc123...",
    "chain": "aptos",
    "txHash": "0x..."
  },
  "issuanceDate": "2025-01-01T00:00:00Z",
  "expirationDate": "2025-01-31T00:00:00Z",
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:key:z6Mk...#key-1",
    "signatureValue": "<base64url>"
  }
}
```

Stored in `localStorage['hsi_credential']`. Valid for 30 days, then re-verification required.

---

## How the Badge Is Protected

### Cryptographic Layer
| Attack | Defense |
|--------|---------|
| Copy DID from localStorage | DID is keypair — private key required to sign new credentials |
| Replay stolen credential | Credential expires in 30 days; ExpressionProof is unique per session |
| Bot mimics gesture stats | AI detects statistical impossibility of perfect regularity |
| Deepfake gesture | Entropy of human movement is mathematically distinct from generated motion |
| Sybil (multiple DIDs) | Each verification costs AI inference; rate limiting per IP + device fingerprint |
| Forge ExpressionProof | SHA3-256 is pre-image resistant; Aptos timestamp prevents backdating |

### Social Layer (HSI Bond)
Verified humans can **vouch** for others by signing a bond:
```
bond = sign(private_key, "vouch:" + friend_did + ":" + timestamp)
```
A DID with 3+ bonds has a higher trust score. A DID found to be a bot causes bonded DIDs to lose reputation.

### Visual Layer
The badge SVG is signed with the HSI issuer key. Unsigned badges are visually distinguishable (missing shimmer effect). Browser extensions verify the signature in real time.

---

## Implementation Strategy

### Phase 1 — Browser Extension
A Chrome/Firefox extension that:
1. Reads `localStorage['hsi_credential']` from any tab
2. Verifies the Ed25519 signature locally
3. Checks expiry and ExpressionProof hash
4. Injects the ✅ badge SVG next to the user's name on supported sites (Twitter/X, GitHub, Reddit, Telegram Web)
5. Shows a popup with DID, confidence, issuance date, bond count

### Phase 2 — Forum/Platform SDK
Drop-in SDK for Discourse, Flarum, Ghost, Wordpress:
```html
<script src="https://sdk.homosapience.org/hsi.js"></script>
<div id="hsi-verify-btn"></div>
```
- Renders GestureCanvas inline
- On success: calls platform webhook with DID + ExpressionProof
- Platform stores `{user_id: "...", hsi_did: "did:key:z6Mk...", verified_at: "..."}`
- Badge appears in user profile automatically

### Phase 3 — Web Standard Proposal
Propose `<meta name="hsi:verified">` header and HTTP header `HSI-DID: did:key:z6Mk...`:
```html
<meta name="hsi:did" content="did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK">
<meta name="hsi:proof" content="sha3:abc123...">
<meta name="hsi:issuer" content="https://homosapience.org">
```
Submit to W3C Credentials Community Group and IETF.

### Phase 4 — HSI Directory (homosapience.org)
Public registry where anyone can:
- Look up a DID and verify its ExpressionProof on-chain
- See bond count and trust score
- Revoke their own credential (invalidates future bonds)

---

## Badge Visual Design

```
┌─────────────────────────┐
│  ✅  VERIFIED HUMAN      │
│  did:key:z6Mk...8a4b    │
│  HSI · Aptos · 30d      │
│  Confidence: 0.92       │
└─────────────────────────┘
```

SVG badge (for embedding in profiles):
- Green checkmark with shimmer animation
- Text: "Verified Human"  
- Subtext: truncated DID (first 8 + last 4 chars)
- Color theme: purple gradient (`#7c3aed` → `#06b6d4`)
- Signed with HSI issuer Ed25519 key

---

## API Endpoints for Badge Verification

### Verify a credential (anyone can check)
```
GET https://api.homosapience.org/badge/verify?did=did:key:z6Mk...
```
Returns:
```json
{
  "valid": true,
  "did": "did:key:z6Mk...",
  "is_human": true,
  "confidence": 0.92,
  "verified_at": "2025-01-01T00:00:00Z",
  "expires_at": "2025-01-31T00:00:00Z",
  "tx_hash": "0x...",
  "bond_count": 2
}
```

### Get badge SVG
```
GET https://api.homosapience.org/badge/svg?did=did:key:z6Mk...
```
Returns signed SVG for embedding.

---

## Privacy Guarantees

| What is stored | Where | Who can see |
|---------------|-------|-------------|
| Ed25519 private key | Browser localStorage only | Nobody (not even HSI servers) |
| HumanCredential JSON | Browser localStorage | User only |
| ExpressionProof hash | Aptos blockchain | Public (hash only, no gesture data) |
| DID (public key) | Aptos + HSI directory | Public (by choice) |
| Gesture coordinates | Discarded after stats | Nobody |
| Gesture stats vector | Backend RAM, not stored | Used for AI inference only |

The system is designed so that **even if the HSI backend is fully compromised**, the attacker learns nothing about the user's identity or biometric profile.

---

## Roadmap

| Milestone | Target |
|-----------|--------|
| ✅ Gesture verification (Qwen3-14B) | Done |
| ✅ ExpressionProof on Aptos | Done |
| ✅ HumanCredential in browser | Done |
| 🔧 Browser extension (Chrome/Firefox) | Next |
| 📋 Discourse plugin | Q2 2025 |
| 📋 homosapience.org directory | Q2 2025 |
| 📋 W3C/IETF standard proposal | Q3 2025 |
| 📋 HSI Bond social graph | Q3 2025 |
| 📋 GNK governance token | Q4 2025 |

---

*homosapience.org — The internet knows your address. We prove you're alive.*
