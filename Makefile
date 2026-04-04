.PHONY: up down logs seed shell-backend shell-db pull-model restart clean build-frontend

# ── Docker ────────────────────────────────────────────────────────────────────
up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f --tail=100

logs-backend:
	docker-compose logs -f backend

logs-whisper:
	docker-compose logs -f whisper

# ── Setup ─────────────────────────────────────────────────────────────────────
seed:
	docker-compose exec backend python scripts/seed.py

pull-model:
	docker-compose exec ollama ollama pull mistral:7b-instruct

pull-model-small:
	docker-compose exec ollama ollama pull phi3:mini

# ── Shells ────────────────────────────────────────────────────────────────────
shell-backend:
	docker-compose exec backend bash

shell-db:
	docker-compose exec postgres psql -U nexus nexus

shell-redis:
	docker-compose exec redis redis-cli

# ── Migrations ────────────────────────────────────────────────────────────────
migrate:
	docker-compose exec backend alembic upgrade head

migration:
	docker-compose exec backend alembic revision --autogenerate -m "$(msg)"

# ── Frontend ──────────────────────────────────────────────────────────────────
build-frontend:
	cd frontend && npm install && npm run build

dev-frontend:
	cd frontend && npm run dev

tauri-dev:
	cd frontend && npm run tauri:dev

tauri-build:
	cd frontend && npm run tauri:build

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	docker-compose down -v --remove-orphans
	docker system prune -f

# ── Health ────────────────────────────────────────────────────────────────────
health:
	@curl -s http://localhost:8000/health | python3 -m json.tool
	@echo ""
	@curl -s http://localhost:8001/health | python3 -m json.tool

# ── Test ─────────────────────────────────────────────────────────────────────
test-api:
	bash api_examples.sh

# ── Production secrets ────────────────────────────────────────────────────────
gen-secrets:
	@echo "SECRET_KEY=$$(openssl rand -hex 32)"
	@echo "LIVEKIT_API_SECRET=$$(openssl rand -hex 32)"
