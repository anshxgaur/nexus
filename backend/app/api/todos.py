from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Todo, User
from app.services.todo_extractor import extract_todos_for_user

router = APIRouter()

class TodoCreateReq(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: str = "medium"

class TodoUpdateReq(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    is_done: Optional[bool] = None

class TodoOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    due_date: Optional[datetime]
    is_done: bool
    priority: str
    source: str
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=List[TodoOut])
async def get_todos(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Todo).where(Todo.user_id == current_user.id).order_by(desc(Todo.created_at))
    res = await db.execute(query)
    return res.scalars().all()


@router.post("", response_model=TodoOut, status_code=201)
async def create_todo(body: TodoCreateReq, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    todo = Todo(
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
        priority=body.priority,
        source="manual"
    )
    db.add(todo)
    await db.flush()
    await db.refresh(todo)
    return todo


@router.patch("/{id}", response_model=TodoOut)
async def update_todo(id: str, body: TodoUpdateReq, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Todo).where(Todo.id == id, Todo.user_id == current_user.id))
    todo = res.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    if body.title is not None:
        todo.title = body.title
    if body.description is not None:
        todo.description = body.description
    if body.due_date is not None:
        todo.due_date = body.due_date
    if body.priority is not None:
        todo.priority = body.priority
    if body.is_done is not None:
        if body.is_done and not todo.is_done:
            from datetime import timezone
            todo.completed_at = datetime.now(timezone.utc)
        elif not body.is_done:
            todo.completed_at = None
        todo.is_done = body.is_done

    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{id}")
async def delete_todo(id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Todo).where(Todo.id == id, Todo.user_id == current_user.id))
    todo = res.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    await db.delete(todo)
    await db.commit()
    return {"status": "ok"}


@router.post("/summarise", response_model=List[TodoOut])
async def summarise_todos(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Call AI service
    extracted_tasks = await extract_todos_for_user(current_user.id, db)
    
    new_todos = []
    for task in extracted_tasks:
        todo = Todo(
            user_id=current_user.id,
            title=task.get("title", "Untitled Task"),
            priority=task.get("priority", "medium"),
            source="ai_summary"
        )
        db.add(todo)
        new_todos.append(todo)
        
    await db.flush()
    for t in new_todos:
        await db.refresh(t)
        
    await db.commit()
    return new_todos
