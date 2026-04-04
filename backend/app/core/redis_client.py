import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings
import structlog

log = structlog.get_logger()


class RedisClient:
    def __init__(self):
        self._client: Optional[aioredis.Redis] = None

    async def connect(self):
        self._client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
        await self._client.ping()
        log.info("redis.ping.ok")

    async def disconnect(self):
        if self._client:
            await self._client.aclose()

    @property
    def client(self) -> aioredis.Redis:
        if not self._client:
            raise RuntimeError("Redis not connected")
        return self._client

    async def publish(self, channel: str, data: dict):
        await self.client.publish(channel, json.dumps(data))

    async def subscribe(self, *channels: str):
        pubsub = self.client.pubsub()
        await pubsub.subscribe(*channels)
        return pubsub

    async def set(self, key: str, value: Any, ex: int = None):
        payload = json.dumps(value) if not isinstance(value, str) else value
        await self.client.set(key, payload, ex=ex)

    async def get(self, key: str) -> Optional[Any]:
        val = await self.client.get(key)
        if val is None:
            return None
        try:
            return json.loads(val)
        except Exception:
            return val

    async def delete(self, *keys: str):
        await self.client.delete(*keys)

    async def lpush(self, key: str, *values):
        await self.client.lpush(key, *[json.dumps(v) for v in values])

    async def brpop(self, key: str, timeout: int = 0):
        result = await self.client.brpop(key, timeout=timeout)
        if result:
            _, val = result
            return json.loads(val)
        return None


redis_client = RedisClient()
