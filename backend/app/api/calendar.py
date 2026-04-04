from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import CalendarEvent, User

router = APIRouter()

class EventCreateReq(BaseModel):
    title: str
    description: Optional[str] = None
    start_dt: datetime
    end_dt: datetime
    color: str = "#6c63ff"
    all_day: bool = False

class EventUpdateReq(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None
    color: Optional[str] = None
    all_day: Optional[bool] = None

class EventOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    start_dt: datetime
    end_dt: datetime
    color: str
    all_day: bool
    created_at: datetime

    model_config = {"from_attributes": True}

@router.get("/events", response_model=List[EventOut])
async def get_events(
    start_dt: Optional[datetime] = Query(None),
    end_dt: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    query = select(CalendarEvent).where(CalendarEvent.user_id == current_user.id)
    if start_dt:
        query = query.where(CalendarEvent.end_dt >= start_dt)
    if end_dt:
        query = query.where(CalendarEvent.start_dt <= end_dt)
        
    query = query.order_by(CalendarEvent.start_dt)
    res = await db.execute(query)
    return res.scalars().all()


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(body: EventCreateReq, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = CalendarEvent(
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        start_dt=body.start_dt,
        end_dt=body.end_dt,
        color=body.color,
        all_day=body.all_day
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event

@router.patch("/events/{id}", response_model=EventOut)
async def update_event(id: str, body: EventUpdateReq, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(CalendarEvent).where(CalendarEvent.id == id, CalendarEvent.user_id == current_user.id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
        
    await db.commit()
    await db.refresh(event)
    return event

@router.delete("/events/{id}")
async def delete_event(id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(CalendarEvent).where(CalendarEvent.id == id, CalendarEvent.user_id == current_user.id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
    return {"status": "ok"}
