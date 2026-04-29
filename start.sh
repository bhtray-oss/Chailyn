#!/bin/bash
# Chailyn APP — 一鍵啟動全部服務
# 使用方式：./start.sh
# 停止方式：./stop.sh 或 Ctrl+C

BASE="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$BASE/.logs"
mkdir -p "$LOG_DIR"

echo "🚀 啟動 Chailyn APP 服務..."

# ── 關閉舊服務 ────────────────────────────────────────────────────────────────
for port in 3000 3001 3002 8000; do
  pid=$(lsof -ti:$port 2>/dev/null)
  [ -n "$pid" ] && kill $pid 2>/dev/null && echo "  停止舊服務 :$port (PID $pid)"
done
sleep 1

# ── Pattern Engine (FreeSewing) ───────────────────────────────────────────────
cd "$BASE/services/pattern-engine"
node src/index.mjs > "$LOG_DIR/engine.log" 2>&1 &
ENGINE_PID=$!
echo "  ✅ Pattern Engine   :3001  (PID $ENGINE_PID)"

# ── FastAPI 主 API ────────────────────────────────────────────────────────────
cd "$BASE/services/api"
set -a && . .env && set +a
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo "  ✅ FastAPI API       :8000  (PID $API_PID)"

# ── GarmentCode Bridge ────────────────────────────────────────────────────────
cd "$BASE/services/garmentcode-bridge"
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 3002 > "$LOG_DIR/bridge.log" 2>&1 &
BRIDGE_PID=$!
echo "  ✅ GarmentCode Bridge:3002  (PID $BRIDGE_PID)"

# ── Next.js Web ───────────────────────────────────────────────────────────────
cd "$BASE/apps/web"
pnpm dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "  ✅ Next.js Web       :3000  (PID $WEB_PID)"

# ── 等待 Next.js 編譯完成 ────────────────────────────────────────────────────
echo ""
echo "⏳ 等待 Next.js 編譯（約 5-10 秒）..."
for i in $(seq 1 20); do
  sleep 1
  code=$(curl -s http://localhost:3000 -o /dev/null -w "%{http_code}" --max-time 2 2>/dev/null)
  [ "$code" = "200" ] && break
done

echo ""
echo "✨ 全部服務已啟動！"
echo "   瀏覽器開啟：http://localhost:3000"
echo ""
echo "   停止所有服務：./stop.sh"
echo "   查看 logs：  tail -f .logs/api.log"
echo ""

# 保持前景執行（Ctrl+C 可一次停全部）
wait