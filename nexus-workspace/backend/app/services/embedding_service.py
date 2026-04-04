"""
Embedding service — wraps sentence-transformers for async-safe usage.
Runs model inference in a thread pool to avoid blocking the event loop.
"""
import asyncio
from functools import lru_cache
from typing import List

import structlog
from sentence_transformers import SentenceTransformer

from app.core.config import settings
from app.core.qdrant_client import qdrant_service

log = structlog.get_logger()


class EmbeddingService:
    def __init__(self):
        self._model: SentenceTransformer | None = None

    def _load_model(self) -> SentenceTransformer:
        if self._model is None:
            log.info("embedding.model.loading", model=settings.EMBEDDING_MODEL)
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            log.info("embedding.model.ready")
        return self._model

    async def embed(self, text: str) -> List[float]:
        """Embed a single text asynchronously."""
        loop = asyncio.get_event_loop()
        vector = await loop.run_in_executor(
            None,
            lambda: self._load_model().encode(text, normalize_embeddings=True).tolist(),
        )
        return vector

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts in one forward pass."""
        loop = asyncio.get_event_loop()
        vectors = await loop.run_in_executor(
            None,
            lambda: self._load_model()
            .encode(texts, batch_size=32, normalize_embeddings=True)
            .tolist(),
        )
        return vectors

    @property
    def qdrant(self):
        return qdrant_service

    async def embed_and_store(
        self,
        collection: str,
        text: str,
        payload: dict,
        point_id: str | None = None,
    ) -> str:
        """Convenience: embed text and immediately upsert to Qdrant."""
        vector = await self.embed(text)
        pid = await qdrant_service.upsert(
            collection=collection,
            vector=vector,
            payload=payload,
            point_id=point_id,
        )
        return pid


def chunk_text(text: str, size: int = None, overlap: int = None) -> List[str]:
    """
    Split text into overlapping chunks for embedding.
    Tries to split on sentence boundaries first.
    """
    size = size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP

    # Split on sentences (naive but fast)
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current = []
    current_len = 0

    for sentence in sentences:
        words = sentence.split()
        if current_len + len(words) > size and current:
            chunks.append(" ".join(current))
            # Keep overlap
            overlap_words = current[-overlap:] if overlap else []
            current = overlap_words + words
            current_len = len(current)
        else:
            current.extend(words)
            current_len += len(words)

    if current:
        chunks.append(" ".join(current))

    return [c for c in chunks if c.strip()]


embedding_service = EmbeddingService()
