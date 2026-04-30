"""chat.py — /api/chat — защищённый чат только для верифицированных людей."""

import time
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel

router = APIRouter()

# In-memory хранилище сообщений для MVP (в production — Matrix/Ceramic)
_messages: list[dict] = []
_connections: list[WebSocket] = []


class MessageCreate(BaseModel):
    content: str
    room: str = "agora"


class MessageOut(BaseModel):
    id: str
    sender_short: str   # первые 8 символов DID (анонимно)
    content: str
    room: str
    timestamp: int


@router.get("/messages", response_model=list[MessageOut])
async def get_messages(room: str = "agora", limit: int = 50):
    """Последние сообщения в комнате."""
    room_msgs = [m for m in _messages if m["room"] == room]
    return room_msgs[-limit:]


@router.post("/messages", response_model=MessageOut)
async def post_message(body: MessageCreate, request: Request):
    """Отправить сообщение. Требует human credential."""
    sender = getattr(request.state, "human_address", "anonymous")
    msg = {
        "id": str(uuid.uuid4()),
        "sender_short": sender[:8],
        "content": body.content,
        "room": body.room,
        "timestamp": int(time.time()),
    }
    _messages.append(msg)

    # Рассылаем всем WebSocket подключениям
    dead = []
    for ws in _connections:
        try:
            import json
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)

    return msg


@router.websocket("/ws/{room}")
async def websocket_chat(websocket: WebSocket, room: str):
    """WebSocket для real-time чата."""
    await websocket.accept()
    _connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive
    except WebSocketDisconnect:
        _connections.remove(websocket)
