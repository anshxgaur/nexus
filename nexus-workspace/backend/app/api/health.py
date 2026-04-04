from fastapi import APIRouter
from app.core.redis_client import redis_client
from app.core.qdrant_client import qdrant_service

router = APIRouter()


@router.get("/health")
async def health():
    checks = {"status": "ok", "services": {}}

    # Redis
    try:
        await redis_client.client.ping()
        checks["services"]["redis"] = "ok"
    except Exception as e:
        checks["services"]["redis"] = f"error: {e}"
        checks["status"] = "degraded"

    # Qdrant
    try:
        await qdrant_service.client.get_collections()
        checks["services"]["qdrant"] = "ok"
    except Exception as e:
        checks["services"]["qdrant"] = f"error: {e}"
        checks["status"] = "degraded"

    return checks
