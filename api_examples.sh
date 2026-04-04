#!/usr/bin/env bash
# ============================================================
# Nexus Workspace — Example API Requests
# Run each block manually or with: bash api_examples.sh
# ============================================================

BASE="http://localhost:8000"
WHISPER="http://localhost:8001"

echo "=== 1. Register a user ==="
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Chen","email":"alice@company.com","password":"password123"}' | jq .

echo ""
echo "=== 2. Login (save token) ==="
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@company.com","password":"password123"}' | jq -r .access_token)
echo "Token: ${TOKEN:0:40}..."

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== 3. List channels ==="
curl -s -X GET "$BASE/channels" -H "$AUTH" | jq .

echo ""
echo "=== 4. Create a channel ==="
curl -s -X POST "$BASE/channels" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"backend-team","description":"Backend engineering discussions"}' | jq .

echo ""
echo "=== 5. Get channel ID and send a message ==="
CHANNEL_ID=$(curl -s "$BASE/channels" -H "$AUTH" | jq -r '.[0].id')
echo "Using channel: $CHANNEL_ID"

curl -s -X POST "$BASE/messages" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"channel_id\":\"$CHANNEL_ID\",\"text\":\"Has anyone reviewed the Q3 performance report?\"}" | jq .

echo ""
echo "=== 6. Get messages from channel ==="
curl -s "$BASE/messages/$CHANNEL_ID?limit=20" -H "$AUTH" | jq .

echo ""
echo "=== 7. Create a meeting ==="
MEETING=$(curl -s -X POST "$BASE/meetings" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"Q3 Planning Sprint"}')
MEETING_ID=$(echo $MEETING | jq -r .id)
echo "Meeting ID: $MEETING_ID"
echo $MEETING | jq .

echo ""
echo "=== 8. Join meeting (get LiveKit token) ==="
curl -s -X POST "$BASE/meetings/$MEETING_ID/join" -H "$AUTH" | jq .

echo ""
echo "=== 9. Ingest a transcript segment ==="
curl -s -X POST "$BASE/transcripts" \
  -H "Content-Type: application/json" \
  -d "{
    \"meeting_id\": \"$MEETING_ID\",
    \"speaker\": \"Alice Chen\",
    \"text\": \"We need to prioritize the authentication refactor before the Q4 launch. Bob, can you take point on that?\",
    \"start_time\": 0.0,
    \"end_time\": 5.2,
    \"confidence\": 0.94
  }" | jq .

curl -s -X POST "$BASE/transcripts" \
  -H "Content-Type: application/json" \
  -d "{
    \"meeting_id\": \"$MEETING_ID\",
    \"speaker\": \"Bob Smith\",
    \"text\": \"Yes, I can own the auth refactor. I'll have a plan ready by Friday.\",
    \"start_time\": 5.5,
    \"end_time\": 9.1,
    \"confidence\": 0.97
  }" | jq .

echo ""
echo "=== 10. Get transcripts for meeting ==="
curl -s "$BASE/transcripts/$MEETING_ID" -H "$AUTH" | jq .

echo ""
echo "=== 11. AI: Summarize the meeting ==="
curl -s -X POST "$BASE/ai/summarize" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"meeting_id\":\"$MEETING_ID\",\"style\":\"bullet\"}" | jq .

echo ""
echo "=== 12. AI: Semantic search across all knowledge ==="
curl -s -X POST "$BASE/ai/search" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "query": "Who is responsible for the authentication refactor?",
    "collections": ["chat_messages","transcripts","documents"],
    "limit": 5,
    "score_threshold": 0.25
  }' | jq .

echo ""
echo "=== 13. AI: Extract tasks and decisions from text ==="
curl -s -X POST "$BASE/ai/extract" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "text": "After discussion, we decided to move the release date to November 15th. Sarah will update the roadmap document by EOD Thursday. The team agreed to drop Feature X from scope and focus on core stability. John to review PRs by Wednesday.",
    "extract_types": ["tasks","decisions","entities"]
  }' | jq .

echo ""
echo "=== 14. End the meeting (triggers AI processing) ==="
curl -s -X POST "$BASE/meetings/$MEETING_ID/end" -H "$AUTH" | jq .

echo ""
echo "=== 15. Health check ==="
curl -s "$BASE/health" | jq .

echo ""
echo "=== 16. Whisper: Transcribe an audio file ==="
# Replace test.wav with a real audio file
# curl -s -X POST "$WHISPER/transcribe" \
#   -F "audio=@test.wav" \
#   -F "meeting_id=$MEETING_ID" \
#   -F "speaker=Alice" | jq .

echo "Done ✓"
