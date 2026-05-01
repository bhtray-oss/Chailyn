#!/bin/bash
# Chailyn APP — 停止全部服務
echo "🛑 停止 Chailyn APP 服務..."
for port in 3000 3001 3002 8000; do
  pid=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null
    echo "  停止 :$port (PID $pid)"
  fi
done
echo "✅ 已全部停止"
