"""
Nexus Whisper Service
=====================
Standalone microservice that:
  1. Accepts audio uploads (wav / webm / mp4 / ogg)
  2. Transcribes using faster-whisper
  3. POSTs each segment to the backend /transcripts endpoint
  4. Streams results over WebSocket for real-time display
"""
import asyncio
import io
import os
import tempfile
import time
from typing import Optional

import httpx
import structlog
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

log = structlog.get_logger()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

app = FastAPI(title="Nexus Whisper Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Lazy-load model
_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        log.info("whisper.model.loading", model=WHISPER_MODEL, device=DEVICE)
        _model = WhisperModel(WHISPER_MODEL, device=DEVICE, compute_type=COMPUTE_TYPE)
        log.info("whisper.model.ready")
    return _model


async def post_transcript(
    meeting_id: str,
    speaker: Optional[str],
    text: str,
    start_time: float,
    end_time: float,
    confidence: float,
):
    """Fire-and-forget POST to backend."""
    payload = {
        "meeting_id": meeting_id,
        "speaker": speaker,
        "text": text,
        "start_time": start_time,
        "end_time": end_time,
        "confidence": confidence,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{BACKEND_URL}/transcripts", json=payload)
            r.raise_for_status()
    except Exception as e:
        log.error("whisper.post_transcript.failed", error=str(e), meeting_id=meeting_id)


# ── HTTP: batch transcription ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": WHISPER_MODEL}


@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    meeting_id: str = Form(...),
    speaker: Optional[str] = Form(default=None),
    language: Optional[str] = Form(default=None),
):
    """
    Upload an audio file and get transcription.
    Automatically POSTs each segment to the backend.
    """
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    log.info("whisper.transcribe.start", meeting_id=meeting_id, bytes=len(audio_bytes))

    # Write to temp file (faster-whisper needs a path)
    suffix = "." + (audio.filename.split(".")[-1] if audio.filename else "wav")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        loop = asyncio.get_event_loop()
        segments_data = await loop.run_in_executor(
            None, _run_whisper, tmp_path, language
        )
    finally:
        os.unlink(tmp_path)

    # Post each segment async
    tasks = []
    for seg in segments_data:
        tasks.append(post_transcript(
            meeting_id=meeting_id,
            speaker=speaker,
            text=seg["text"],
            start_time=seg["start"],
            end_time=seg["end"],
            confidence=seg["confidence"],
        ))
    await asyncio.gather(*tasks, return_exceptions=True)

    log.info("whisper.transcribe.done", segments=len(segments_data))
    return {
        "meeting_id": meeting_id,
        "segments": segments_data,
        "total_segments": len(segments_data),
    }


def _run_whisper(audio_path: str, language: Optional[str]) -> list:
    """Synchronous whisper inference (runs in thread pool)."""
    model = get_model()
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        word_timestamps=False,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )
    results = []
    for seg in segments:
        avg_logprob = getattr(seg, "avg_logprob", -0.5)
        confidence = max(0.0, min(1.0, (avg_logprob + 1.0)))  # normalize roughly
        text = seg.text.strip()
        if text:
            results.append({
                "start": seg.start,
                "end": seg.end,
                "text": text,
                "confidence": round(confidence, 3),
            })
    return results


# ── WebSocket: real-time streaming transcription ──────────────────────────────

@app.websocket("/ws/stream/{meeting_id}")
async def stream_transcription(
    websocket: WebSocket,
    meeting_id: str,
    speaker: Optional[str] = None,
):
    """
    Real-time audio streaming endpoint.
    Client sends raw PCM audio chunks; server transcribes and returns segments.
    
    Protocol:
    - Client sends: binary audio chunks (16kHz, 16-bit, mono PCM)
    - Client sends: text "END" to signal end of stream
    - Server sends: JSON transcript segments
    """
    await websocket.accept()
    log.info("ws.stream.connected", meeting_id=meeting_id)

    audio_buffer = bytearray()
    CHUNK_DURATION_S = 3.0  # Process every ~3 seconds
    SAMPLE_RATE = 16000
    CHUNK_BYTES = int(CHUNK_DURATION_S * SAMPLE_RATE * 2)  # 16-bit = 2 bytes/sample

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "keepalive"})
                continue

            if data["type"] == "websocket.disconnect":
                break

            if "text" in data and data["text"] == "END":
                # Process remaining buffer
                if len(audio_buffer) > 0:
                    await _process_audio_chunk(
                        bytes(audio_buffer), meeting_id, speaker, websocket
                    )
                await websocket.send_json({"type": "stream_ended"})
                break

            if "bytes" in data:
                audio_buffer.extend(data["bytes"])
                # Process when buffer is large enough
                while len(audio_buffer) >= CHUNK_BYTES:
                    chunk = bytes(audio_buffer[:CHUNK_BYTES])
                    audio_buffer = audio_buffer[CHUNK_BYTES:]
                    await _process_audio_chunk(chunk, meeting_id, speaker, websocket)

    except WebSocketDisconnect:
        log.info("ws.stream.disconnected", meeting_id=meeting_id)
    except Exception as e:
        log.error("ws.stream.error", error=str(e))
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        log.info("ws.stream.closed", meeting_id=meeting_id)


async def _process_audio_chunk(
    chunk: bytes,
    meeting_id: str,
    speaker: Optional[str],
    websocket: WebSocket,
):
    """Transcribe a PCM chunk and send result over WebSocket."""
    import numpy as np

    # Convert PCM bytes → numpy float32 array
    audio_array = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0

    loop = asyncio.get_event_loop()

    def _transcribe():
        model = get_model()
        segments, _ = model.transcribe(
            audio_array,
            beam_size=3,
            vad_filter=True,
        )
        return list(segments)

    try:
        segments = await loop.run_in_executor(None, _transcribe)
    except Exception as e:
        log.warning("chunk.transcribe.failed", error=str(e))
        return

    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue

        confidence = max(0.0, min(1.0, (getattr(seg, "avg_logprob", -0.5) + 1.0)))
        result = {
            "type": "segment",
            "text": text,
            "start": seg.start,
            "end": seg.end,
            "confidence": round(confidence, 3),
            "speaker": speaker,
        }
        await websocket.send_json(result)

        # Post to backend
        asyncio.create_task(
            post_transcript(
                meeting_id=meeting_id,
                speaker=speaker,
                text=text,
                start_time=seg.start,
                end_time=seg.end,
                confidence=confidence,
            )
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
