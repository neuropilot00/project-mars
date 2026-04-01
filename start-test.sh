#!/bin/bash
# ============================================
# OCCUPY MARS — Test Server Launcher
# 지인 테스트용 간편 실행 스크립트
# ============================================

export PATH="/Users/jongho/.openclaw/tools/node-v22.22.0/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  OCCUPY MARS — Test Launcher             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. PostgreSQL 확인/시작
echo "[1/3] PostgreSQL 확인..."
if ! pg_isready -q 2>/dev/null; then
  echo "  → PostgreSQL 시작 중..."
  brew services start postgresql@16 2>/dev/null
  sleep 2
fi

if pg_isready -q 2>/dev/null; then
  echo "  ✓ PostgreSQL 실행 중"
else
  echo "  ✗ PostgreSQL 시작 실패! 수동으로 확인하세요."
  exit 1
fi

# 2. 서버 시작
echo "[2/3] Node.js 서버 시작..."
kill $(lsof -ti:3000) 2>/dev/null
sleep 1
cd server
npm install --silent 2>/dev/null
node index.js &
SERVER_PID=$!
cd ..
sleep 2

if kill -0 $SERVER_PID 2>/dev/null; then
  echo "  ✓ 서버 실행 중 (PID: $SERVER_PID)"
else
  echo "  ✗ 서버 시작 실패!"
  exit 1
fi

# 3. Cloudflare Tunnel (보안 페이지 없이 바로 접속)
echo "[3/3] Cloudflare Tunnel 생성 중..."
TUNNEL_LOG="/tmp/occupy-mars-tunnel.log"
cloudflared tunnel --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# 터널 URL 추출 대기
TUNNEL_URL=""
for i in $(seq 1 15); do
  TUNNEL_URL=$(grep -o 'https://[^ ]*trycloudflare.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then break; fi
  sleep 1
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                                                      ║"
echo "║  🔴 OCCUPY MARS 테스트 서버 실행 중!                  ║"
echo "║                                                      ║"
echo "║  로컬:   http://localhost:3000                        ║"
if [ -n "$TUNNEL_URL" ]; then
echo "║  외부:   $TUNNEL_URL"
else
echo "║  외부:   (터널 생성 실패 — 로컬에서만 접속 가능)       ║"
fi
echo "║                                                      ║"
echo "║  관리자:  http://localhost:3000/admin                  ║"
echo "║  비밀번호: admin1234                                   ║"
echo "║                                                      ║"
echo "║  ⚡ 지인들에게 외부 URL을 공유하세요!                  ║"
echo "║  ⚡ 보안 페이지 없이 바로 접속됩니다!                  ║"
echo "║                                                      ║"
echo "║  종료: Ctrl+C                                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 종료 핸들러
cleanup() {
  echo ""
  echo "서버 종료 중..."
  kill $SERVER_PID 2>/dev/null
  kill $TUNNEL_PID 2>/dev/null
  echo "완료!"
  exit 0
}
trap cleanup INT TERM

# 대기
wait $SERVER_PID
