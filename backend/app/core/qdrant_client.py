from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PointStruct,
    SearchRequest, Filter, FieldCondition, MatchValue,
)
from typing import List, Optional
import structlog
import uuid

from app.core.config import settings

log = structlog.get_logger()


class QdrantService:
    def __init__(self):
        self._client: Optional[AsyncQdrantClient] = None

    @property
    def client(self) -> AsyncQdrantClient:
        if not self._client:
            self._client = AsyncQdrantClient(url=settings.QDRANT_URL)
        return self._client

    async def init_collections(self):
        collections = [
            settings.QDRANT_CHAT_COLLECTION,
            settings.QDRANT_TRANSCRIPT_COLLECTION,
            settings.QDRANT_DOCUMENT_COLLECTION,
        ]
        existing = {c.name for c in (await self.client.get_collections()).collections}

        for name in collections:
            if name not in existing:
                await self.client.create_collection(
                    collection_name=name,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIM,
                        distance=Distance.COSINE,
                    ),
                )
                log.info("qdrant.collection.created", name=name)

    async def upsert(
        self,
        collection: str,
        vector: List[float],
        payload: dict,
        point_id: Optional[str] = None,
    ) -> str:
        pid = point_id or str(uuid.uuid4())
        await self.client.upsert(
            collection_name=collection,
            points=[PointStruct(id=pid, vector=vector, payload=payload)],
        )
        return pid

    async def search(
        self,
        collection: str,
        vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.3,
        filter_conditions: Optional[dict] = None,
    ) -> List[dict]:
        filter_obj = None
        if filter_conditions:
            must = []
            for key, val in filter_conditions.items():
                must.append(FieldCondition(key=key, match=MatchValue(value=val)))
            filter_obj = Filter(must=must)

        results = await self.client.search(
            collection_name=collection,
            query_vector=vector,
            limit=limit,
            score_threshold=score_threshold,
            query_filter=filter_obj,
            with_payload=True,
        )
        return [{"score": r.score, "payload": r.payload} for r in results]

    async def delete_by_payload(self, collection: str, field: str, value: str):
        from qdrant_client.models import FilterSelector
        await self.client.delete(
            collection_name=collection,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key=field, match=MatchValue(value=value))]
                )
            ),
        )


qdrant_service = QdrantService()
