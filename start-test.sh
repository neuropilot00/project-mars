#!/bin/bash
# ============================================
# PIXEL WAR — Test Server Launcher
# 지인 테스트용 간편 실행 스크립트
# ============================================

export PATH="/Users/jongho/.openclaw/tools/node-v22.22.0/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  PIXEL WAR v9.3 — Test Launcher          ║"
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

# 3. 터널 시작
echo "[3/3] 외부 접속 터널 생성..."
echo ""

# localtunnel 시작
lt --port 3000 --subdomain pixelwar-test 2>/dev/null &
LT_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║                                                  ║"
echo "║  🔴 PIXEL WAR 테스트 서버 실행 중!                ║"
echo "║                                                  ║"
echo "║  로컬:  http://localhost:3000                     ║"
echo "║  외부:  https://pixelwar-test.loca.lt             ║"
echo "║  관리자: http://localhost:3000/admin               ║"
echo "║  관리자 비밀번호: admin1234                         ║"
echo "║                                                  ║"
echo "║  ⚡ 지인들에게 외부 URL을 공유하세요!               ║"
echo "║  ⚡ 첫 접속시 'Click to Continue' 버튼 클릭 필요   ║"
echo "║                                                  ║"
echo "║  종료: Ctrl+C                                    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 종료 핸들러
cleanup() {
  echo ""
  echo "서버 종료 중..."
  kill $SERVER_PID 2>/dev/null
  kill $LT_PID 2>/dev/null
  echo "완료!"
  exit 0
}
trap cleanup INT TERM

# 대기
wait $SERVER_PID
