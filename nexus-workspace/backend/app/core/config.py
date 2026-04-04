from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://nexus:nexuspass@localhost:5432/nexus"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_CHAT_COLLECTION: str = "chat_messages"
    QDRANT_TRANSCRIPT_COLLECTION: str = "transcripts"
    QDRANT_DOCUMENT_COLLECTION: str = "documents"

    # Ollama
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "mistral:7b-instruct"

    # Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384

    # LiveKit
    LIVEKIT_URL: str = "http://localhost:7880"
    LIVEKIT_API_KEY: str = "devkey"
    LIVEKIT_API_SECRET: str = "secret"

    # Chunking
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
