from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import asyncio

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import redis_client
from app.models.user import Message, Channel, User
from app.services.embedding_service import embedding_service
from app.core.config import settings

router = APIRouter()


class MessageCreate(BaseModel):
    channel_id: str
    text: str
    thread_id: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    channel_id: str
    user_id: str
    text: str
    is_ai: bool
    thread_id: Optional[str]
    created_at: datetime
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify channel exists
    ch_result = await db.execute(select(Channel).where(Channel.id == body.channel_id))
    if not ch_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Channel not found")

    msg = Message(
        channel_id=body.channel_id,
        user_id=user.id,
        text=body.text,
        thread_id=body.thread_id,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    # Publish to Redis for WebSocket broadcast
    await redis_client.publish(
        f"channel:{body.channel_id}",
        {
            "type": "message",
            "id": msg.id,
            "channel_id": msg.channel_id,
            "user_id": msg.user_id,
            "user_name": user.name,
            "text": msg.text,
            "is_ai": msg.is_ai,
            "created_at": msg.created_at.isoformat(),
        },
    )

    # Background: embed and store in Qdrant
    asyncio.create_task(
        _embed_message(msg.id, body.channel_id, user.name, body.text)
    )

    return MessageOut(
        id=msg.id,
        channel_id=msg.channel_id,
        user_id=msg.user_id,
        text=msg.text,
        is_ai=msg.is_ai,
        thread_id=msg.thread_id,
        created_at=msg.created_at,
        user=UserOut(id=user.id, name=user.name, avatar_url=user.avatar_url),
    )


async def _embed_message(msg_id: str, channel_id: str, user_name: str, text: str):
    try:
        vector = await embedding_service.embed(text)
        await embedding_service.qdrant.upsert(
            collection=settings.QDRANT_CHAT_COLLECTION,
            vector=vector,
            payload={
                "message_id": msg_id,
                "channel_id": channel_id,
                "user_name": user_name,
                "text": text,
                "source": "chat",
            },
            point_id=msg_id,
        )
    except Exception as e:
        import structlog
        structlog.get_logger().warning("embed.message.failed", error=str(e))


@router.get("/{channel_id}", response_model=List[MessageOut])
async def get_messages(
    channel_id: str,
    limit: int = Query(default=50, le=200),
    before_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = (
        select(Message)
        .where(Message.channel_id == channel_id)
        .options(selectinload(Message.user))
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    messages = result.scalars().all()
    return list(reversed(messages))
