#!/bin/bash
# ============================================
# OCCUPY MARS — Test Server Launcher
# 지인 테스트 전용 로컬 런처 (상업 운영 경로 금지)
# 외부 공개는 ALLOW_PUBLIC_TUNNEL=1 일 때만 허용
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

# 3. 외부 공개는 명시 opt-in 일 때만 허용
TUNNEL_PID=""
TUNNEL_URL=""
TUNNEL_ENABLED=0
if [ "${ALLOW_PUBLIC_TUNNEL:-0}" = "1" ]; then
  TUNNEL_ENABLED=1
  echo "[3/3] Cloudflare Tunnel 생성 중..."
  TUNNEL_LOG="/tmp/occupy-mars-tunnel.log"
  cloudflared tunnel --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  # 터널 URL 추출 대기
  for i in $(seq 1 15); do
    TUNNEL_URL=$(grep -o 'https://[^ ]*trycloudflare.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then break; fi
    sleep 1
  done
else
  echo "[3/3] Public tunnel skipped (set ALLOW_PUBLIC_TUNNEL=1 to enable)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                                                      ║"
echo "║  🔴 OCCUPY MARS 테스트 서버 실행 중!                  ║"
echo "║                                                      ║"
echo "║  로컬:   http://localhost:3000                        ║"
if [ -n "$TUNNEL_URL" ]; then
echo "║  외부:   $TUNNEL_URL"
else
  if [ "$TUNNEL_ENABLED" = "1" ]; then
    echo "║  외부:   (터널 생성 실패 — 로컬에서만 접속 가능)       ║"
  else
    echo "║  외부:   (비활성화됨 — ALLOW_PUBLIC_TUNNEL=1 필요)     ║"
  fi
fi
echo "║                                                      ║"
echo "║  관리자:  http://localhost:3000/admin                  ║"
echo "║  관리자 시크릿: 환경변수/운영 문서 기준 확인           ║"
echo "║                                                      ║"
if [ -n "$TUNNEL_URL" ]; then
  echo "║  ⚠ 외부 공유 전용 임시 테스트 URL 입니다                ║"
else
  echo "║  로컬 전용 실행 — 외부 공개 비활성화                   ║"
fi
echo "║                                                      ║"
echo "║  종료: Ctrl+C                                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 종료 핸들러
cleanup() {
  echo ""
  echo "서버 종료 중..."
  kill $SERVER_PID 2>/dev/null
  if [ -n "$TUNNEL_PID" ]; then
    kill $TUNNEL_PID 2>/dev/null
  fi
  echo "완료!"
  exit 0
}
trap cleanup INT TERM

# 대기
wait $SERVER_PID
