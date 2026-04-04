from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import structlog

from app.core.security import get_current_user
from app.core.config import settings
from app.services.embedding_service import embedding_service
from app.core.qdrant_client import qdrant_service
from app.models.user import User

router = APIRouter()
log = structlog.get_logger()

RAG_SYSTEM_PROMPT = """You are Nexus AI, the intelligent assistant for a corporate workspace platform.
You have access to the company's chat history, meeting transcripts, and documents.
Answer questions accurately using the provided context. Be concise and professional.
If the context doesn't contain enough information, say so clearly.
Always cite which meeting or channel the information comes from when relevant."""


class SearchRequest(BaseModel):
    query: str
    collections: List[str] = ["chat_messages", "transcripts", "documents"]
    limit: int = 10
    score_threshold: float = 0.3


class SearchResult(BaseModel):
    text: str
    source: str
    score: float
    metadata: dict


class SearchResponse(BaseModel):
    results: List[SearchResult]
    answer: str
    query: str


class SummarizeRequest(BaseModel):
    meeting_id: Optional[str] = None
    text: Optional[str] = None
    style: str = "bullet"  # bullet | narrative | action_items


class SummarizeResponse(BaseModel):
    summary: str
    tasks: List[str]
    decisions: List[str]


class ExtractRequest(BaseModel):
    text: str
    extract_types: List[str] = ["tasks", "decisions", "entities"]


class ExtractResponse(BaseModel):
    tasks: List[str]
    decisions: List[str]
    entities: List[str]
    key_points: List[str]


async def call_ollama(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """Call local Ollama LLM."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.OLLAMA_URL}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"num_predict": max_tokens, "temperature": 0.1},
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"].strip()


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
    body: SearchRequest,
    user: User = Depends(get_current_user),
):
    """RAG-powered search across all company knowledge."""
    # Embed query
    query_vector = await embedding_service.embed(body.query)

    # Search across requested collections
    all_results = []
    collection_map = {
        "chat_messages": settings.QDRANT_CHAT_COLLECTION,
        "transcripts": settings.QDRANT_TRANSCRIPT_COLLECTION,
        "documents": settings.QDRANT_DOCUMENT_COLLECTION,
    }

    for col_name in body.collections:
        collection = collection_map.get(col_name)
        if not collection:
            continue
        try:
            results = await qdrant_service.search(
                collection=collection,
                vector=query_vector,
                limit=body.limit // len(body.collections) + 2,
                score_threshold=body.score_threshold,
            )
            for r in results:
                all_results.append(SearchResult(
                    text=r["payload"].get("text", ""),
                    source=col_name,
                    score=r["score"],
                    metadata=r["payload"],
                ))
        except Exception as e:
            log.warning("qdrant.search.failed", collection=col_name, error=str(e))

    # Sort by score, take top-k
    all_results.sort(key=lambda x: x.score, reverse=True)
    top_results = all_results[:body.limit]

    # Build context for LLM
    if top_results:
        context_parts = []
        for i, r in enumerate(top_results[:6], 1):
            source_label = {
                "chat_messages": f"Chat (channel: {r.metadata.get('channel_id', 'unknown')})",
                "transcripts": f"Meeting transcript (meeting: {r.metadata.get('meeting_id', 'unknown')}, speaker: {r.metadata.get('speaker', 'unknown')})",
                "documents": f"Document: {r.metadata.get('title', 'unknown')}",
            }.get(r.source, r.source)
            context_parts.append(f"[{i}] {source_label}\n{r.text}")

        context = "\n\n".join(context_parts)
        prompt = f"""Context from company knowledge base:

{context}

Question: {body.query}

Answer based on the context above. Reference specific sources where relevant."""

        try:
            answer = await call_ollama(prompt, system=RAG_SYSTEM_PROMPT)
        except Exception as e:
            log.error("ollama.call.failed", error=str(e))
            answer = "AI service temporarily unavailable. Here are the relevant results from your search."
    else:
        answer = "No relevant information found in the company knowledge base for your query."

    return SearchResponse(
        results=top_results,
        answer=answer,
        query=body.query,
    )


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(
    body: SummarizeRequest,
    user: User = Depends(get_current_user),
):
    """Summarize a meeting or arbitrary text with task/decision extraction."""
    text_to_summarize = body.text

    if body.meeting_id and not body.text:
        # Fetch transcripts from DB
        from app.core.database import AsyncSessionLocal
        from app.models.user import Transcript
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Transcript)
                .where(Transcript.meeting_id == body.meeting_id)
                .order_by(Transcript.created_at)
            )
            transcripts = result.scalars().all()

        if not transcripts:
            raise HTTPException(status_code=404, detail="No transcripts found for this meeting")

        lines = []
        for t in transcripts:
            speaker_label = f"{t.speaker}: " if t.speaker else ""
            lines.append(f"{speaker_label}{t.text}")
        text_to_summarize = "\n".join(lines)

    if not text_to_summarize:
        raise HTTPException(status_code=400, detail="Provide meeting_id or text")

    style_instruction = {
        "bullet": "Format as bullet points. Start with a 2-sentence overview, then bullet points.",
        "narrative": "Write in flowing paragraphs as a professional meeting summary.",
        "action_items": "Focus primarily on action items and next steps.",
    }.get(body.style, "Use bullet points.")

    prompt = f"""Analyze this meeting transcript or text and provide:

TEXT:
{text_to_summarize[:8000]}  

Respond ONLY with valid JSON in this exact format:
{{
  "summary": "...",
  "tasks": ["task 1", "task 2", ...],
  "decisions": ["decision 1", "decision 2", ...]
}}

Style: {style_instruction}
Extract all actionable tasks (with owner if mentioned) and all decisions made.
"""

    try:
        raw = await call_ollama(prompt, max_tokens=2048)
        import json
        import re
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return SummarizeResponse(
                summary=data.get("summary", ""),
                tasks=data.get("tasks", []),
                decisions=data.get("decisions", []),
            )
    except Exception as e:
        log.error("summarize.parse.failed", error=str(e))

    # Fallback: plain text summary
    summary_prompt = f"Summarize this text in 3-5 bullet points:\n\n{text_to_summarize[:4000]}"
    summary = await call_ollama(summary_prompt)
    return SummarizeResponse(summary=summary, tasks=[], decisions=[])


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    body: ExtractRequest,
    user: User = Depends(get_current_user),
):
    """Extract structured information from text."""
    prompt = f"""Extract structured information from this text.

TEXT:
{body.text[:6000]}

Respond ONLY with valid JSON:
{{
  "tasks": ["actionable task 1", ...],
  "decisions": ["decision made 1", ...],
  "entities": ["person/org/product name", ...],
  "key_points": ["important point 1", ...]
}}

Be precise. Only include items clearly present in the text."""

    try:
        raw = await call_ollama(prompt, max_tokens=1024)
        import json, re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return ExtractResponse(
                tasks=data.get("tasks", []),
                decisions=data.get("decisions", []),
                entities=data.get("entities", []),
                key_points=data.get("key_points", []),
            )
    except Exception as e:
        log.error("extract.failed", error=str(e))

    return ExtractResponse(tasks=[], decisions=[], entities=[], key_points=[])
