#!/bin/bash
# [v7.214] 동적 inline onclick 회귀 감지 — 신규/수정 라인만 검사 (CLAUDE.md §19).
#
# 사용:
#   1) git pre-commit hook 으로:  ln -sf ../../scripts/check_inline_onclick.sh .git/hooks/pre-commit
#   2) 수동:                       bash scripts/check_inline_onclick.sh
#
# 정책:
# - 기존 회귀 (총 100+ 라인) 는 점진적 마이그 — pre-commit 차단 안 함.
# - 새로 추가/수정된 줄에서 위험 패턴 발견 시만 차단.
# - 우회: git commit --no-verify (권장 안 함)
#
# 신호: onclick="...\\047... " 또는 ".replace(/'/g,..." (escape 깨질 위험 문자)

set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

TARGET="index.html"
[ ! -f "$TARGET" ] && exit 0

# Staged diff 에서 추가된 라인 (+ 시작) 만 검사. 기존 라인은 패스.
DIFF=$(git diff --cached -- "$TARGET" 2>/dev/null || true)
[ -z "$DIFF" ] && DIFF=$(git diff -- "$TARGET" 2>/dev/null || true)  # uncommitted 도 봄

if [ -z "$DIFF" ]; then
  echo "✅ index.html 변경 없음 — onclick 검사 스킵."
  exit 0
fi

# + 로 시작하는 추가 라인만 (---/+++ header 제외)
ADDED=$(echo "$DIFF" | grep -E '^\+' | grep -vE '^\+\+\+')

# 위험 패턴 — onclick attribute 안에 escape 문자
BAD=$(echo "$ADDED" | grep -nE 'onclick="[^"]*(\\047|\\x27)|onclick="[^"]*\.replace\(/.*''.*\/g' || true)
BAD_COUNT=$(echo -n "$BAD" | grep -c . || true)

if [ "$BAD_COUNT" -gt 0 ]; then
  echo ""
  echo "🚨 [v7.214] 신규 코드에서 동적 onclick concat 감지 ($BAD_COUNT 라인)"
  echo "   CLAUDE.md §19 — inline onclick 금지. data-action + delegated listener 사용."
  echo ""
  echo "$BAD" | head -10
  echo ""
  echo "   회피하려면:  git commit --no-verify  (권장 안 함, 회귀 위험)"
  exit 1
fi

echo "✅ 신규 변경분 inline onclick concat 0건. (기존 회귀는 별도 마이그)"
exit 0
