#!/bin/bash
set -e
BASE="/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app"

echo "=== pattern-engine ==="
PORT=3001 node "$BASE/services/pattern-engine/src/index.mjs" &
PE_PID=$!
sleep 2
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
  echo "OK: pattern-engine healthy"
  curl -s http://localhost:3001/health
  echo ""
  curl -s http://localhost:3001/designs | head -c 200
  echo ""
else
  echo "FAIL: pattern-engine not responding"
fi
kill $PE_PID 2>/dev/null
wait $PE_PID 2>/dev/null

echo ""
echo "=== Python API check ==="
cd "$BASE/services/api"
python3 -c "import fastapi, uvicorn, sqlalchemy, asyncpg, anthropic, httpx; print('All Python deps OK')" 2>&1

echo ""
echo "=== Next.js typecheck ==="
cd "$BASE/apps/web"
node_modules/.bin/tsc --noEmit 2>&1 | head -40
