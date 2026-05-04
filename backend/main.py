"""
APTOGON Backend
───────────────
Стек:
  Gonka AI  → верификация человека
  did:key   → анонимный DID (без Ceramic)
  Aptos     → HumanCredential on-chain
  FastAPI   → API
  Redis     → кэш бот-скоров

Убрано:
  ✗ Cosmos SDK / HSI Chain
  ✗ Ceramic / ComposeDB
  ✗ IBC Bridge

Запуск:
  uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import verify, bond, chat, translate, governance
from routers import ws as ws_router
from middleware.firewall import AptogonFirewall
from services.gonka_service import GonkaService
from services.aptos_service import AptosService
from services.db_service import DatabaseService
from services.device_fingerprint import DeviceFingerprintStore
from services.ws_manager import ConnectionManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.gonka = GonkaService()
    app.state.aptos = AptosService()
    app.state.db = DatabaseService()
    app.state.fp_store = DeviceFingerprintStore()
    app.state.ws_manager = ConnectionManager()
    await app.state.db.connect()
    stats = await app.state.aptos.get_stats()
    print(f"""
╔══════════════════════════════════════╗
║  APTOGON v0.2.0 — Human Firewall     ║
║  Gonka AI + did:key + Aptos          ║
╠══════════════════════════════════════╣
║  Credentials: {stats['valid_credentials']:>6} valid             ║
║  Network:     {stats['network']:<20}  ║
╚══════════════════════════════════════╝
    """)
    yield
    await app.state.db.close()


app = FastAPI(
    title="APTOGON API",
    description="HSI Human Firewall — Gonka AI + did:key + Aptos",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://aptogon.network"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
app.add_middleware(AptogonFirewall)

app.include_router(verify.router,      prefix="/api/verify",     tags=["Verification"])
app.include_router(bond.router,        prefix="/api/bond",       tags=["Bond"])
app.include_router(chat.router,        prefix="/api/chat",       tags=["Chat"])
app.include_router(translate.router,   prefix="/api/translate",  tags=["Translation"])
app.include_router(governance.router,  prefix="/api/governance", tags=["Governance"])
app.include_router(ws_router.router,   prefix="/ws",             tags=["WebSocket"])


@app.get("/api/health")
async def health(request=None):
    aptos = request.app.state.aptos if request else None
    stats = await aptos.get_stats() if aptos else {}
    return {"status": "ok", "version": "0.2.0", "project": "APTOGON", **stats}


@app.get("/")
async def root():
    return {
        "project": "APTOGON",
        "stack": ["Gonka AI", "did:key", "Aptos"],
        "removed": ["Cosmos SDK", "Ceramic", "IBC"],
        "docs": "/docs",
    }
