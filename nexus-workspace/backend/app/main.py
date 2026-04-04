"""
Nexus Workspace — FastAPI Application Entry Point
"""
import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.core.redis_client import redis_client
from app.core.qdrant_client import qdrant_service
from app.api import auth, channels, messages, meetings, transcripts, ai, websocket, health

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle."""
    log.info("nexus.startup", env=settings.ENVIRONMENT)

    # Create DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("database.tables.ready")

    # Connect Redis
    await redis_client.connect()
    log.info("redis.connected")

    # Init Qdrant collections
    await qdrant_service.init_collections()
    log.info("qdrant.collections.ready")

    yield  # ← app runs here

    # Teardown
    await redis_client.disconnect()
    await engine.dispose()
    log.info("nexus.shutdown")


app = FastAPI(
    title="Nexus Workspace API",
    version="1.0.0",
    description="AI-powered corporate workspace platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(auth.router,        prefix="/auth",        tags=["auth"])
app.include_router(channels.router,    prefix="/channels",    tags=["channels"])
app.include_router(messages.router,    prefix="/messages",    tags=["messages"])
app.include_router(meetings.router,    prefix="/meetings",    tags=["meetings"])
app.include_router(transcripts.router, prefix="/transcripts", tags=["transcripts"])
app.include_router(ai.router,          prefix="/ai",          tags=["ai"])
app.include_router(websocket.router,   prefix="/ws",          tags=["websocket"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log.error("unhandled.exception", error=str(exc), path=request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
