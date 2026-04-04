"""
AI Processing Pipeline
======================
Runs after a meeting ends:
  1. Fetch all transcripts
  2. Chunk & embed → Qdrant
  3. Call Ollama → extract tasks + decisions + summary
  4. Persist results to PostgreSQL
"""
import re
import json
import asyncio
from typing import List

import httpx
import structlog

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.qdrant_client import qdrant_service
from app.models.user import Meeting, Transcript, Task, Decision
from app.services.embedding_service import embedding_service, chunk_text

log = structlog.get_logger()


class AIPipeline:

    # ── Ollama helper ─────────────────────────────────────────────────────────
    async def _ollama(self, prompt: str, system: str = "", max_tokens: int = 2048) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{settings.OLLAMA_URL}/api/chat",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {"num_predict": max_tokens, "temperature": 0.05},
                },
            )
            r.raise_for_status()
            return r.json()["message"]["content"].strip()

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _parse_json_response(self, raw: str) -> dict:
        """Robustly extract JSON object from LLM response."""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {}

    def _build_full_transcript(self, transcripts: List[Transcript]) -> str:
        lines = []
        for t in transcripts:
            prefix = f"[{t.speaker}]" if t.speaker else "[Speaker]"
            if t.start_time is not None:
                mins = int(t.start_time // 60)
                secs = int(t.start_time % 60)
                prefix = f"[{mins:02d}:{secs:02d}] {prefix}"
            lines.append(f"{prefix} {t.text}")
        return "\n".join(lines)

    # ── Core pipeline ─────────────────────────────────────────────────────────
    async def process_meeting(self, meeting_id: str):
        log.info("ai_pipeline.meeting.start", meeting_id=meeting_id)

        async with AsyncSessionLocal() as db:
            from sqlalchemy import select

            # 1. Load meeting + transcripts
            meeting_result = await db.execute(
                select(Meeting).where(Meeting.id == meeting_id)
            )
            meeting = meeting_result.scalar_one_or_none()
            if not meeting:
                log.warning("ai_pipeline.meeting.not_found", meeting_id=meeting_id)
                return

            trans_result = await db.execute(
                select(Transcript)
                .where(Transcript.meeting_id == meeting_id)
                .order_by(Transcript.created_at)
            )
            transcripts: List[Transcript] = trans_result.scalars().all()

            if not transcripts:
                log.info("ai_pipeline.no_transcripts", meeting_id=meeting_id)
                return

            full_text = self._build_full_transcript(transcripts)
            log.info("ai_pipeline.transcript.built", chars=len(full_text))

            # 2. Chunk + embed into Qdrant (batch)
            await self._embed_transcript_chunks(meeting_id, meeting.title, full_text)

            # 3. Extract tasks, decisions, summary via Ollama
            extraction = await self._extract_insights(full_text, meeting.title)

            # 4. Persist tasks
            for task_text in extraction.get("tasks", []):
                task_text = task_text.strip()
                if task_text:
                    assigned = self._extract_assignee(task_text)
                    db.add(Task(
                        text=task_text,
                        assigned_to=assigned,
                        source="meeting",
                        meeting_id=meeting_id,
                    ))

            # 5. Persist decisions
            for decision_text in extraction.get("decisions", []):
                decision_text = decision_text.strip()
                if decision_text:
                    db.add(Decision(
                        text=decision_text,
                        meeting_id=meeting_id,
                    ))

            # 6. Update meeting summary
            summary = extraction.get("summary", "")
            if summary:
                meeting.summary = summary

            await db.commit()
            log.info(
                "ai_pipeline.meeting.done",
                meeting_id=meeting_id,
                tasks=len(extraction.get("tasks", [])),
                decisions=len(extraction.get("decisions", [])),
            )

    async def _embed_transcript_chunks(
        self, meeting_id: str, meeting_title: str, full_text: str
    ):
        chunks = chunk_text(full_text)
        if not chunks:
            return

        log.info("ai_pipeline.embedding.chunks", count=len(chunks))

        # Embed in batches of 16
        batch_size = 16
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i: i + batch_size]
            try:
                vectors = await embedding_service.embed_batch(batch)
                for j, (chunk, vector) in enumerate(zip(batch, vectors)):
                    await qdrant_service.upsert(
                        collection=settings.QDRANT_TRANSCRIPT_COLLECTION,
                        vector=vector,
                        payload={
                            "meeting_id": meeting_id,
                            "meeting_title": meeting_title,
                            "text": chunk,
                            "chunk_index": i + j,
                            "source": "transcript",
                        },
                    )
            except Exception as e:
                log.error("ai_pipeline.embed.batch.failed", error=str(e))

    async def _extract_insights(self, full_text: str, meeting_title: str) -> dict:
        # Truncate to avoid context overflow (≈ 6 000 words)
        truncated = full_text[:12000]

        prompt = f"""You are analyzing a meeting transcript titled "{meeting_title}".

TRANSCRIPT:
{truncated}

Extract the following and respond ONLY with valid JSON (no markdown):
{{
  "summary": "3-5 sentence executive summary of the meeting",
  "tasks": [
    "Action item 1 (owner if mentioned)",
    "Action item 2"
  ],
  "decisions": [
    "Decision 1",
    "Decision 2"
  ],
  "key_topics": ["topic1", "topic2"]
}}

Rules:
- Tasks must be concrete and actionable
- Decisions must be clearly stated outcomes
- Do NOT include vague or duplicate items
"""
        try:
            raw = await self._ollama(prompt, max_tokens=2048)
            return self._parse_json_response(raw)
        except Exception as e:
            log.error("ai_pipeline.extract.failed", error=str(e))
            return {}

    def _extract_assignee(self, task_text: str) -> str | None:
        """Simple heuristic to extract person name from task string."""
        patterns = [
            r'\(([A-Z][a-z]+ [A-Z][a-z]+)\)',  # (First Last)
            r'([A-Z][a-z]+) (?:to|will|should)',  # "Alice to review"
            r'assigned to ([A-Z][a-z]+)',
        ]
        for p in patterns:
            m = re.search(p, task_text)
            if m:
                return m.group(1)
        return None

    # ── Chat processing pipeline ──────────────────────────────────────────────
    async def process_channel_history(self, channel_id: str, messages: list):
        """
        Embed a batch of chat messages into Qdrant.
        Called when a channel crosses a threshold or on schedule.
        """
        if not messages:
            return

        texts = [m["text"] for m in messages]
        vectors = await embedding_service.embed_batch(texts)

        for msg, vector in zip(messages, vectors):
            await qdrant_service.upsert(
                collection=settings.QDRANT_CHAT_COLLECTION,
                vector=vector,
                payload={
                    "message_id": msg["id"],
                    "channel_id": channel_id,
                    "user_name": msg.get("user_name", "unknown"),
                    "text": msg["text"],
                    "source": "chat",
                },
                point_id=msg["id"],
            )

    # ── Document ingestion ────────────────────────────────────────────────────
    async def ingest_document(self, doc_id: str, title: str, content: str):
        """Chunk and embed a document into Qdrant."""
        chunks = chunk_text(content)
        if not chunks:
            return

        texts = chunks
        vectors = await embedding_service.embed_batch(texts)

        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            await qdrant_service.upsert(
                collection=settings.QDRANT_DOCUMENT_COLLECTION,
                vector=vector,
                payload={
                    "doc_id": doc_id,
                    "title": title,
                    "text": chunk,
                    "chunk_index": i,
                    "source": "document",
                },
            )
        log.info("ai_pipeline.document.ingested", doc_id=doc_id, chunks=len(chunks))


ai_pipeline = AIPipeline()
