#!/usr/bin/env bash
#
# bug-fix-loop.sh — 헤드리스 Claude Code 버그 픽업 데몬
#
# 매 INTERVAL 마다 다음을 수행:
#   1. node scripts/bug-report-watch.js next-and-fix 로 큐 확인 (exit 1 = 비어있음 → skip)
#   2. 큐에 있으면 `claude -p "/fix-next-bug"` 헤드리스 세션으로 1건 처리
#   3. INTERVAL 만큼 sleep
#
# 사용법:
#   ./scripts/bug-fix-loop.sh                    # 600s 간격 (기본)
#   INTERVAL=300 ./scripts/bug-fix-loop.sh       # 5분 간격
#   ./scripts/bug-fix-loop.sh --once             # 1회만 실행 후 종료 (cron용)
#
# 백그라운드 실행:
#   nohup ./scripts/bug-fix-loop.sh > /tmp/bug-fix-loop.log 2>&1 &
#   tmux new -d -s bugloop './scripts/bug-fix-loop.sh'
#
# 중지:
#   pkill -f bug-fix-loop.sh

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

INTERVAL="${INTERVAL:-600}"      # 초 단위, 기본 10분
ONCE=0
if [ "${1:-}" = "--once" ]; then ONCE=1; fi

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

# claude CLI 존재 확인
if ! command -v claude >/dev/null 2>&1; then
  log "ERROR: 'claude' CLI not found in PATH. Install Claude Code first."
  exit 127
fi

# Node 존재 확인
if ! command -v node >/dev/null 2>&1; then
  log "ERROR: 'node' not found in PATH."
  exit 127
fi

run_once() {
  # 1. 큐 확인 — next-and-fix 는 비어있으면 exit 1
  if ! node scripts/bug-report-watch.js next-and-fix > /tmp/bug-next.json 2>/dev/null; then
    log "queue empty — skipping iteration"
    return 0
  fi

  local id title
  id=$(node -e 'try{const r=JSON.parse(require("fs").readFileSync("/tmp/bug-next.json","utf8"));process.stdout.write(String(r.id||""))}catch(e){}')
  title=$(node -e 'try{const r=JSON.parse(require("fs").readFileSync("/tmp/bug-next.json","utf8"));process.stdout.write(String(r.title||"").slice(0,60))}catch(e){}')
  log "picking up bug #${id}: ${title}"

  # 2. /fix-next-bug 헤드리스 호출
  #    --permission-mode acceptEdits → 파일 편집/Bash 자동 승인
  #    --dangerously-skip-permissions 는 쓰지 않음 (권한 묻기 회피용 acceptEdits 만)
  if claude -p "/fix-next-bug" \
       --permission-mode acceptEdits \
       --output-format text \
       >> /tmp/bug-fix-loop.log 2>&1; then
    log "iteration done for #${id}"
  else
    local rc=$?
    log "claude -p exited with code ${rc} for #${id} (see /tmp/bug-fix-loop.log)"
  fi
}

if [ "$ONCE" = "1" ]; then
  run_once
  exit 0
fi

log "starting bug-fix-loop (interval=${INTERVAL}s, repo=${REPO_ROOT})"
trap 'log "received SIGINT/SIGTERM — exiting"; exit 0' INT TERM

while true; do
  run_once
  sleep "$INTERVAL"
done
