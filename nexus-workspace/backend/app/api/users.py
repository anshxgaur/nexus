from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Todo, MeetingParticipant

router = APIRouter()

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    role: Optional[str] = None
    name: Optional[str] = None

@router.get("", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if body.role:
        user.role = body.role
    if body.name:
        user.name = body.name
        
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Task completion
    t_res = await db.execute(select(Todo.is_done, func.count(Todo.id)).where(Todo.user_id == user_id).group_by(Todo.is_done))
    counts = dict(t_res.all())
    
    # Meeting participation
    m_res = await db.execute(select(func.count(MeetingParticipant.id)).where(MeetingParticipant.user_id == user_id))
    
    return {
        "tasks_done": counts.get(True, 0),
        "tasks_pending": counts.get(False, 0),
        "meetings": m_res.scalar() or 0
    }
