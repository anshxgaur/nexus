import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.redis_client import redis_client
from app.models.user import Transcript, Meeting, User
from app.services.embedding_service import embedding_service
from app.core.config import settings

router = APIRouter()


class TranscriptIngest(BaseModel):
    meeting_id: str
    speaker: Optional[str] = None
    text: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    confidence: Optional[float] = None


class TranscriptOut(BaseModel):
    id: str
    meeting_id: str
    speaker: Optional[str]
    text: str
    start_time: Optional[float]
    end_time: Optional[float]
    confidence: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("", response_model=TranscriptOut, status_code=201)
async def ingest_transcript(
    body: TranscriptIngest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingestion endpoint called by Whisper service (no auth required for internal use).
    In production, secure this with an internal API key.
    """
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == body.meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = Transcript(
        meeting_id=body.meeting_id,
        speaker=body.speaker,
        text=body.text,
        start_time=body.start_time,
        end_time=body.end_time,
        confidence=body.confidence,
    )
    db.add(transcript)
    await db.flush()
    await db.refresh(transcript)

    # Stream to WebSocket subscribers
    await redis_client.publish(
        f"meeting:{body.meeting_id}:transcript",
        {
            "type": "transcript",
            "id": transcript.id,
            "meeting_id": body.meeting_id,
            "speaker": body.speaker,
            "text": body.text,
            "start_time": body.start_time,
            "end_time": body.end_time,
            "created_at": transcript.created_at.isoformat(),
        },
    )

    # Background: embed transcript chunk
    asyncio.create_task(
        _embed_transcript(transcript.id, body.meeting_id, body.speaker or "unknown", body.text)
    )

    return transcript


async def _embed_transcript(tid: str, meeting_id: str, speaker: str, text: str):
    try:
        vector = await embedding_service.embed(text)
        await embedding_service.qdrant.upsert(
            collection=settings.QDRANT_TRANSCRIPT_COLLECTION,
            vector=vector,
            payload={
                "transcript_id": tid,
                "meeting_id": meeting_id,
                "speaker": speaker,
                "text": text,
                "source": "transcript",
            },
            point_id=tid,
        )
    except Exception as e:
        import structlog
        structlog.get_logger().warning("embed.transcript.failed", error=str(e))


@router.get("/{meeting_id}", response_model=List[TranscriptOut])
async def get_transcripts(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transcript)
        .where(Transcript.meeting_id == meeting_id)
        .order_by(Transcript.start_time.asc().nullsfirst(), Transcript.created_at.asc())
    )
    return result.scalars().all()
