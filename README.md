# Nexus Workspace

**Self-hosted, open-source, AI-powered corporate workspace platform.**

Team chat · Video meetings · Live transcription · RAG search · Task extraction

----

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri Desktop App (React + TailwindCSS + Zustand)              │
│  • Chat UI  • Meeting UI  • AI Panel  • Live transcript         │
└───────────────────────┬─────────────────────────────────────────┘
                        │  HTTP + WebSocket
┌───────────────────────▼─────────────────────────────────────────┐
│  Nginx (reverse proxy / gateway)                                 │
└───────────┬───────────┬───────────────────────────────┬─────────┘
            │           │                               │
┌───────────▼──┐ ┌──────▼──────┐                ┌──────▼──────┐
│  FastAPI     │ │  Whisper    │                │  LiveKit    │
│  Backend     │ │  Service    │                │  (WebRTC)   │
│  :8000       │ │  :8001      │                │  :7880      │
└──┬───┬───┬───┘ └──────┬──────┘                └─────────────┘
   │   │   │            │ POST /transcripts
   │   │   │     ┌──────▼──────────────────────────────────────┐
   │   │   │     │  FastAPI receives → Redis pub/sub → WS      │
   │   │   │     └─────────────────────────────────────────────┘
   │   │   │
   │   │   └──── Qdrant :6333 (vector search)
   │   │              ↑ embeddings (sentence-transformers)
   │   │
   │   └──────── Redis :6379 (pub/sub + queues)
   │
   └──────────── PostgreSQL :5432 (primary DB)
                      ↓
               Ollama :11434 (local LLM - Mistral 7B)
```

### Data Flow

```
Chat Message  →  PostgreSQL  →  sentence-transformers  →  Qdrant
Meeting Audio →  LiveKit     →  Whisper  →  Backend  →  PostgreSQL  →  Qdrant
User Query    →  Qdrant search  →  Ollama (RAG)  →  Response
Meeting End   →  AI Pipeline  →  Tasks/Decisions  →  PostgreSQL
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| (Optional) NVIDIA GPU | For Ollama GPU acceleration |
| (Optional) Rust + Node.js | For Tauri desktop build |

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/nexus-workspace.git
cd nexus-workspace

# 2. Start all services (first run pulls ~10 GB of images/models)
docker-compose up -d

# 3. Wait for services to be healthy (~3-5 minutes on first run)
docker-compose ps

# 4. Seed default channels and admin user
docker-compose exec backend python scripts/seed.py

# 5. Open the web UI
open http://localhost:80

# Default credentials:
# Email:    admin@nexus.local
# Password: admin1234
```

That's it. Single command, everything runs.

---

## Services & Ports

| Service | Port | Description |
|---|---|---|
| Nginx | 80 | Main gateway (all traffic routes here) |
| Backend API | 8000 | FastAPI — also via `/api/` through Nginx |
| Whisper | 8001 | Transcription service — via `/whisper/` |
| LiveKit | 7880 | WebRTC meeting server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Pub/sub and queues |
| Qdrant | 6333 | Vector database (UI at :6333/dashboard) |
| Ollama | 11434 | Local LLM API |

---

## Desktop App (Tauri)

```bash
# Prerequisites: Rust, Node.js 20+, platform build tools

cd frontend
npm install

# Development (connects to local backend)
npm run tauri:dev

# Production build
npm run tauri:build
# Output: src-tauri/target/release/bundle/
```

### Environment Variables (Frontend)

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

---

## Backend Development

```bash
cd backend

# Create virtualenv
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run with hot reload
uvicorn app.main:app --reload --port 8000

# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "add new table"

# API docs
open http://localhost:8000/docs
```

### Environment Variables (Backend)

```bash
DATABASE_URL=postgresql+asyncpg://nexus:nexuspass@localhost:5432/nexus
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct
SECRET_KEY=your-super-secret-key-change-this
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

---

## Whisper Service

```bash
cd whisper-service
pip install -r requirements.txt
uvicorn main:app --port 8001

# Transcribe a file
curl -X POST http://localhost:8001/transcribe \
  -F "audio=@meeting.wav" \
  -F "meeting_id=<uuid>" \
  -F "speaker=Alice"

# Real-time streaming (WebSocket)
# Connect to: ws://localhost:8001/ws/stream/<meeting_id>
# Send binary PCM chunks (16kHz, 16-bit mono)
# Send "END" text frame to finalize
```

### Whisper Model Options

Set `WHISPER_MODEL` env var:

| Model | Size | Speed | Accuracy |
|---|---|---|---|
| `tiny.en` | 75 MB | Fastest | Lower |
| `base.en` | 145 MB | Fast | Good |
| `small.en` | 466 MB | Moderate | Better |
| `medium.en` | 1.5 GB | Slow | High |
| `large-v3` | 3 GB | Slowest | Best |

---

## Ollama Models

```bash
# Pull additional models
docker-compose exec ollama ollama pull phi3:mini        # Lighter, faster
docker-compose exec ollama ollama pull mistral:7b-instruct  # Default
docker-compose exec ollama ollama pull llama3:8b        # Alternative

# Change model via env var
OLLAMA_MODEL=phi3:mini docker-compose up -d backend
```

---

## API Reference

### Auth
```
POST /auth/register   { name, email, password }
POST /auth/login      { email, password }        → { access_token }
```

### Channels
```
GET  /channels
POST /channels        { name, description?, is_private? }
GET  /channels/:id
DELETE /channels/:id
```

### Messages
```
POST /messages        { channel_id, text, thread_id? }
GET  /messages/:channel_id?limit=50
```

### Meetings
```
POST /meetings            { title }
GET  /meetings?status=
GET  /meetings/:id
POST /meetings/:id/join   → { livekit_token, livekit_url }
POST /meetings/:id/end
```

### Transcripts
```
POST /transcripts     { meeting_id, speaker?, text, start_time?, end_time?, confidence? }
GET  /transcripts/:meeting_id
```

### AI
```
POST /ai/search       { query, collections?, limit?, score_threshold? }
POST /ai/summarize    { meeting_id?, text?, style? }
POST /ai/extract      { text, extract_types? }
```

### WebSocket
```
ws://localhost:8000/ws/chat/:channel_id?token=<jwt>
ws://localhost:8000/ws/meeting/:meeting_id/transcript?token=<jwt>
```

---

## Production Deployment

### Change Secret Keys
```bash
# backend/.env
SECRET_KEY=$(openssl rand -hex 32)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
```

### Update livekit.yaml
```yaml
keys:
  your-api-key: your-very-long-random-secret
```

### TLS / HTTPS
1. Add SSL cert to `nginx/` directory
2. Update `nginx/nginx.conf` to add HTTPS server block
3. Set `VITE_API_URL=https://your-domain.com` in frontend

### Scale Backend
```bash
docker-compose up -d --scale backend=4
```

### Backup Database
```bash
docker-compose exec postgres pg_dump -U nexus nexus > backup.sql
```

---

## Project Structure

```
nexus-workspace/
├── docker-compose.yml          # All services
├── livekit.yaml                # LiveKit config
├── nginx/nginx.conf            # Reverse proxy
├── api_examples.sh             # Example API calls
├── scripts/seed.py             # DB seeder
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py             # FastAPI entry, lifespan
│   │   ├── core/
│   │   │   ├── config.py       # Settings (pydantic-settings)
│   │   │   ├── database.py     # SQLAlchemy async engine
│   │   │   ├── redis_client.py # Redis wrapper
│   │   │   ├── qdrant_client.py# Qdrant wrapper
│   │   │   └── security.py     # JWT auth
│   │   ├── models/
│   │   │   └── user.py         # All SQLAlchemy models
│   │   ├── api/
│   │   │   ├── auth.py         # POST /auth/*
│   │   │   ├── channels.py     # GET/POST /channels
│   │   │   ├── messages.py     # POST /messages
│   │   │   ├── meetings.py     # POST /meetings
│   │   │   ├── transcripts.py  # POST /transcripts
│   │   │   ├── ai.py           # POST /ai/*
│   │   │   ├── websocket.py    # WS /ws/*
│   │   │   └── health.py       # GET /health
│   │   ├── services/
│   │   │   ├── embedding_service.py  # sentence-transformers
│   │   │   └── livekit_service.py    # token generation
│   │   └── pipelines/
│   │       └── ai_pipeline.py  # Post-meeting AI processing
│   └── alembic/                # DB migrations
│
├── whisper-service/            # Transcription microservice
│   ├── main.py                 # FastAPI + faster-whisper
│   ├── requirements.txt
│   └── Dockerfile
│
└── frontend/                   # Tauri + React desktop app
    ├── src/
    │   ├── App.tsx             # Root + auth gate
    │   ├── lib/api.ts          # Axios client
    │   ├── stores/
    │   │   ├── authStore.ts    # JWT + user state
    │   │   ├── chatStore.ts    # Channels + messages + WS
    │   │   ├── meetingStore.ts # Meetings + transcripts + WS
    │   │   └── aiStore.ts      # RAG search + summaries
    │   └── components/
    │       ├── layout/         # AppShell, Sidebar, AuthPage
    │       ├── chat/           # ChatView
    │       ├── meeting/        # MeetingView + TranscriptPanel
    │       └── ai/             # AIPanel (RAG search)
    └── src-tauri/              # Rust Tauri wrapper
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Tauri (Rust + WebView2/WKWebView) |
| Frontend | React 18, TailwindCSS, Zustand, Framer Motion |
| Video | LiveKit (WebRTC) |
| Backend | FastAPI, Python 3.11, asyncpg |
| Database | PostgreSQL 16 |
| Realtime | Redis 7 (pub/sub) |
| Vector DB | Qdrant |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| LLM | Ollama + Mistral 7B Instruct (100% local) |
| STT | faster-whisper |
| Migrations | Alembic |
| Auth | JWT (python-jose + bcrypt) |
| Gateway | Nginx |
| Container | Docker + Compose |

All open-source. No external API calls. Runs entirely on-premise.

---

## License

MIT
