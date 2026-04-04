@echo off
echo Starting Nexus Workspace Ecosystem...

:: 1. Start Docker Infrastructure
echo [1/3] Starting Docker Infrastructure (Postgres, Redis, Qdrant, Ollama)...
docker-compose up -d
if %errorlevel% neq 0 (
    echo Error: Docker Compose failed. Make sure Docker is running.
    pause
    exit /b %errorlevel%
)

:: 2. Start Backend API
echo [2/3] Starting Backend API...
start "Nexus Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"

:: 3. Start Frontend UI
echo [3/3] Starting Frontend UI...
start "Nexus Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo All systems are launching! 
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000/docs
echo.
pause
