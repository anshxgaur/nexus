import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Meeting, MeetingParticipant, User
from app.services.livekit_service import livekit_service

router = APIRouter()


class MeetingCreate(BaseModel):
    title: str
    scheduled_at: Optional[datetime] = None


class MeetingOut(BaseModel):
    id: str
    title: str
    room_name: str
    status: str
    created_by: str
    summary: Optional[str]
    scheduled_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ParticipantOut(BaseModel):
    user_id: str
    joined_at: datetime
    model_config = {"from_attributes": True}


class JoinMeetingResponse(BaseModel):
    meeting: MeetingOut
    livekit_token: str
    livekit_url: str


@router.post("", response_model=MeetingOut, status_code=201)
async def create_meeting(
    body: MeetingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    room_name = f"nexus-{uuid.uuid4().hex[:8]}"
    meeting = Meeting(
        title=body.title,
        room_name=room_name,
        created_by=user.id,
        scheduled_at=body.scheduled_at,
        status="scheduled",
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)
    # Also add creator as participant
    db.add(MeetingParticipant(meeting_id=meeting.id, user_id=user.id))
    await db.flush()
    return meeting


@router.get("/{meeting_id}/participants", response_model=List[ParticipantOut])
async def get_participants(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting_id)
    )
    return result.scalars().all()


@router.get("", response_model=List[MeetingOut])
async def list_meetings(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Meeting).order_by(Meeting.created_at.desc())
    if status:
        query = query.where(Meeting.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{meeting_id}", response_model=MeetingOut)
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
async def join_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status == "ended":
        raise HTTPException(status_code=400, detail="Meeting has ended")

    # Activate meeting
    if meeting.status == "scheduled":
        meeting.status = "active"

    # Add participant (idempotent)
    part_result = await db.execute(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting_id,
            MeetingParticipant.user_id == user.id,
        )
    )
    if not part_result.scalar_one_or_none():
        db.add(MeetingParticipant(meeting_id=meeting_id, user_id=user.id))

    token = livekit_service.create_token(meeting.room_name, user.id, user.name)

    return JoinMeetingResponse(
        meeting=MeetingOut.model_validate(meeting),
        livekit_token=token,
        livekit_url=livekit_service.ws_url,
    )


@router.post("/{meeting_id}/end", response_model=MeetingOut)
async def end_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting.status = "ended"
    meeting.ended_at = datetime.now(timezone.utc)

    # Trigger AI processing async
    import asyncio
    asyncio.create_task(_process_meeting_after_end(meeting_id))

    return meeting


async def _process_meeting_after_end(meeting_id: str):
    from app.pipelines.ai_pipeline import ai_pipeline
    try:
        await ai_pipeline.process_meeting(meeting_id)
    except Exception as e:
        import structlog
        structlog.get_logger().error("meeting.ai_process.failed", meeting_id=meeting_id, error=str(e))
