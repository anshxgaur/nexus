from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Mail, User

router = APIRouter()

class MailSendReq(BaseModel):
    recipient_id: str
    subject: str
    body: str

class UserPreview(BaseModel):
    id: str
    name: str

class MailOut(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    subject: str
    body: str
    is_read: bool
    created_at: datetime
    sender: Optional[UserPreview] = None
    recipient: Optional[UserPreview] = None

    model_config = {"from_attributes": True}


@router.post("/send", response_model=MailOut, status_code=201)
async def send_mail(body: MailSendReq, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(User).where(User.id == body.recipient_id))
    recipient = res.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    mail = Mail(
        sender_id=current_user.id,
        recipient_id=body.recipient_id,
        subject=body.subject,
        body=body.body
    )
    db.add(mail)
    await db.flush()
    await db.refresh(mail)
    
    # Reload with relations for the return model
    res = await db.execute(select(Mail).where(Mail.id == mail.id).options(selectinload(Mail.sender), selectinload(Mail.recipient)))
    mail = res.scalar_one()

    return mail


@router.get("/inbox", response_model=List[MailOut])
async def get_inbox(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        select(Mail)
        .where(Mail.recipient_id == current_user.id)
        .options(selectinload(Mail.sender), selectinload(Mail.recipient))
        .order_by(desc(Mail.created_at))
    )
    res = await db.execute(query)
    mails = res.scalars().all()
    return mails

@router.get("/sent", response_model=List[MailOut])
async def get_sent(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        select(Mail)
        .where(Mail.sender_id == current_user.id)
        .options(selectinload(Mail.sender), selectinload(Mail.recipient))
        .order_by(desc(Mail.created_at))
    )
    res = await db.execute(query)
    return res.scalars().all()


@router.patch("/{id}/read")
async def mark_read(id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Mail).where(Mail.id == id, Mail.recipient_id == current_user.id))
    mail = res.scalar_one_or_none()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    mail.is_read = True
    await db.commit()
    return {"status": "ok"}

@router.delete("/{id}")
async def delete_mail(id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Mail).where(Mail.id == id, Mail.recipient_id == current_user.id))
    mail = res.scalar_one_or_none()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    await db.delete(mail)
    await db.commit()
    return {"status": "ok"}


@router.get("/users", response_model=List[UserPreview])
async def get_users_for_mail(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(User).where(User.id != current_user.id))
    users = res.scalars().all()
    return users
