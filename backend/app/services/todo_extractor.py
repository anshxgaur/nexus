import json
import httpx
import structlog
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.user import Message, Meeting, Todo

log = structlog.get_logger()

OLLAMA_URL = f"{settings.OLLAMA_URL}/api/generate"

async def extract_todos_for_user(user_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    
    msg_query = select(Message).where(
        Message.user_id == user_id, 
        Message.created_at >= yesterday
    ).limit(50)
    msg_result = await db.execute(msg_query)
    messages = msg_result.scalars().all()
    
    text_context = "Recent messages:\n"
    for m in messages:
        text_context += f"- {m.text}\n"

    prompt = f"""
    You are an AI assistant that extracts actionable tasks (To-dos) from a user's recent messages.
    Return ONLY a JSON array of objects. Do not include markdown formatting or any other text.
    Each object should have:
    - "title": a clear, concise task description
    - "priority": "low", "medium", or "high"
    
    Context:
    {text_context}
    """
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(OLLAMA_URL, json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            })
            resp.raise_for_status()
            data = resp.json()
            
            response_text = data.get("response", "[]")
            tasks = json.loads(response_text)
            
            if not isinstance(tasks, list):
                log.warning("todo_extractor.not_a_list", response=response_text)
                return []
                
            return tasks
            
    except Exception as e:
        log.error("todo_extractor.failed", error=str(e))
        return []
