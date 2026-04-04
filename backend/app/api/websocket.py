"""
WebSocket endpoints for real-time chat and meeting transcript streaming.
Uses Redis pub/sub as the message bus so multiple backend instances stay in sync.
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.core.config import settings
from app.core.redis_client import redis_client
import structlog

router = APIRouter()
log = structlog.get_logger()


def _decode_token_ws(token: str) -> Optional[str]:
    """Return user_id or None on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None


@router.websocket("/chat/{channel_id}")
async def chat_ws(
    websocket: WebSocket,
    channel_id: str,
    token: str = Query(...),
):
    user_id = _decode_token_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    log.info("ws.chat.connected", channel_id=channel_id, user_id=user_id)

    redis_channel = f"channel:{channel_id}"
    pubsub = await redis_client.subscribe(redis_channel)

    async def _sender():
        """Forward Redis messages → WebSocket client."""
        try:
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                data = json.loads(raw["data"])
                await websocket.send_json(data)
        except Exception as e:
            log.warning("ws.chat.sender.error", error=str(e))

    sender_task = asyncio.create_task(_sender())

    try:
        while True:
            # Keep-alive: client can send ping
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        log.info("ws.chat.disconnected", channel_id=channel_id, user_id=user_id)
    finally:
        sender_task.cancel()
        await pubsub.unsubscribe(redis_channel)
        await pubsub.aclose()


@router.websocket("/meeting/{meeting_id}/transcript")
async def transcript_ws(
    websocket: WebSocket,
    meeting_id: str,
    token: str = Query(...),
):
    user_id = _decode_token_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    log.info("ws.transcript.connected", meeting_id=meeting_id, user_id=user_id)

    redis_channel = f"meeting:{meeting_id}:transcript"
    pubsub = await redis_client.subscribe(redis_channel)

    async def _sender():
        try:
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                data = json.loads(raw["data"])
                await websocket.send_json(data)
        except Exception as e:
            log.warning("ws.transcript.sender.error", error=str(e))

    sender_task = asyncio.create_task(_sender())

    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        log.info("ws.transcript.disconnected", meeting_id=meeting_id, user_id=user_id)
    finally:
        sender_task.cancel()
        await pubsub.unsubscribe(redis_channel)
        await pubsub.aclose()
