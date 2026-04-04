from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Todo, MeetingParticipant, PerformanceRecord, User

router = APIRouter()

class PerformanceStats(BaseModel):
    tasks_done: int
    tasks_pending: int
    meetings_attended: int
    completion_rate: float
    daily_activity: List[Dict[str, Any]]

@router.get("/me", response_model=PerformanceStats)
async def get_my_performance(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Tasks stats
    res = await db.execute(select(Todo.is_done, func.count(Todo.id)).where(Todo.user_id == current_user.id).group_by(Todo.is_done))
    counts = dict(res.all())
    done = counts.get(True, 0)
    pending = counts.get(False, 0)
    total = done + pending
    rate = (done / total * 100) if total > 0 else 0.0
    
    # Meetings stats
    res_m = await db.execute(select(func.count(MeetingParticipant.id)).where(MeetingParticipant.user_id == current_user.id))
    meetings_attended = res_m.scalar() or 0
    
    # Daily activity (last 7 days completed tasks)
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    
    daily_res = await db.execute(
        select(func.date(Todo.completed_at), func.count(Todo.id))
        .where(Todo.user_id == current_user.id, Todo.is_done == True, Todo.completed_at >= seven_days_ago) # noqa: E712
        .group_by(func.date(Todo.completed_at))
    )
    activity = [{"date": str(row[0]), "count": row[1]} for row in daily_res.all() if row[0] is not None]
    
    return PerformanceStats(
        tasks_done=done,
        tasks_pending=pending,
        meetings_attended=meetings_attended,
        completion_rate=round(rate, 2),
        daily_activity=activity
    )

@router.get("/team")
async def get_team_performance(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
        
    res = await db.execute(select(User))
    users = res.scalars().all()
    
    team_stats = []
    for u in users:
        t_res = await db.execute(select(Todo.is_done, func.count(Todo.id)).where(Todo.user_id == u.id).group_by(Todo.is_done))
        counts = dict(t_res.all())
        done = counts.get(True, 0)
        pending = counts.get(False, 0)
        team_stats.append({
            "user_id": u.id,
            "name": u.name,
            "tasks_done": done,
            "tasks_pending": pending
        })
        
    return team_stats
