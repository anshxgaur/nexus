"""
LiveKit service — generates access tokens for participants to join rooms.
"""
import time
from app.core.config import settings
import structlog

log = structlog.get_logger()


class LiveKitService:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.host = settings.LIVEKIT_URL
        # WebSocket URL for client SDK
        self.ws_url = settings.LIVEKIT_URL.replace("http://", "ws://").replace("https://", "wss://")

    def create_token(self, room_name: str, user_id: str, user_name: str) -> str:
        """
        Create a LiveKit access token.
        Uses livekit-api library if available, falls back to manual JWT.
        """
        try:
            from livekit.api import AccessToken, VideoGrants
            token = (
                AccessToken(self.api_key, self.api_secret)
                .with_identity(user_id)
                .with_name(user_name)
                .with_grants(
                    VideoGrants(
                        room_join=True,
                        room=room_name,
                        can_publish=True,
                        can_subscribe=True,
                        can_publish_data=True,
                    )
                )
                .to_jwt()
            )
            return token
        except ImportError:
            # Manual JWT fallback
            return self._manual_jwt(room_name, user_id, user_name)

    def _manual_jwt(self, room_name: str, user_id: str, user_name: str) -> str:
        """Manual LiveKit JWT construction."""
        import jwt as pyjwt
        import json

        now = int(time.time())
        claims = {
            "iss": self.api_key,
            "sub": user_id,
            "iat": now,
            "exp": now + 3600 * 6,  # 6 hours
            "name": user_name,
            "video": {
                "roomJoin": True,
                "room": room_name,
                "canPublish": True,
                "canSubscribe": True,
                "canPublishData": True,
            },
        }
        return pyjwt.encode(claims, self.api_secret, algorithm="HS256")


livekit_service = LiveKitService()
