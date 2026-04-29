---
description: Claim and fix the next pending bug report (one iteration — designed for /loop)
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# /fix-next-bug — 다음 버그 리포트 1건 자동 픽업·수정

이 슬래시 커맨드는 **버그 리포트 큐에서 1건만** 처리하고 끝납니다.
`/loop 10m /fix-next-bug` 형태로 무한 반복하거나, `scripts/bug-fix-loop.sh` 헤드리스 데몬에서 호출하도록 설계됐습니다.

## 작업 순서 (반드시 이 순서대로 — 단축 금지)

### 1. 큐 확인
```bash
node scripts/bug-report-watch.js next-and-fix
```
- exit code **1** = 인박스 비어있음 → **즉시 종료** (메시지 한 줄: "No pending bug reports."). commit/push 하지 말 것.
- exit code **0** + JSON 출력 = 처리 대상 있음 → 계속 진행.

### 2. 리포트 파싱
JSON 출력에서 다음 필드를 읽는다:
- `id` — 리포트 ID (정수)
- `category` — `gameplay` / `ui` / `economy` / `crash` / `other`
- `title`, `body` — 사용자 문제 설명
- `url`, `viewport`, `recent_errors` — 재현 컨텍스트
- `wallet` — 신고자 wallet (응답 시 nickname 우선 — 메모리 참조)

### 3. 클레임
```bash
node scripts/bug-report-watch.js claim <id>
```
이게 성공해야만 다음 단계로 간다 (`processed/`로 이동되고 `claude_attempts++`).

### 4. 조사 + 수정
- 카테고리·재현 단서·`recent_errors`·URL 기반으로 관련 코드 위치 추정.
- 단일 파일 수정이면 `Read` + `Edit`로 직접. 여러 파일·아키텍처 영향이면 멈추고 **6번 (skip)** 으로 가서 사람에게 넘긴다.
- `CLAUDE.md` §13~§14 (알려진 이슈/서비스 카탈로그) 와 §5 (코딩 패턴) 반드시 준수:
  - 하드코딩 금지 (`getSetting()` 사용)
  - 트랜잭션 client.release()
  - 네이티브 다이얼로그 0개 유지 (§18)
- 수정 후 `node` 문법 체크 (`node --check <file>`) 또는 sql 마이그레이션이면 `psql -d pixelwar -f <file>` 로컬 적용.

### 5. 커밋 + push + resolve
수정이 끝나면 **반드시** 다음을 순서대로:

```bash
git add <touched files>
git commit -m "fix: <한 줄 설명> (bug #<id>)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
SHA=$(git rev-parse HEAD)
node scripts/bug-report-watch.js resolve <id> --commit "$SHA" --note "<수정 요약 1~2 문장>"
```

§13~§14 변경이면 `CLAUDE.md`/`AUDIT_FINDINGS.md`/`CHANGELOG.md` 도 같이 업데이트 (자동 메모리 [Completion Workflow](https://...) 5종 세트).

### 6. skip 조건 (어느 하나라도 해당하면 skip)
- 재현 정보 부족 (어디서·어떻게 발생하는지 추정 불가)
- 3개 이상 파일에 걸친 설계 변경 필요 (Plan agent 영역)
- DB 스키마 변경 필요 (마이그레이션은 사람 검토 거쳐야)
- 외부 API 키·시크릿 필요
- 동일 ID 가 이미 한 번 skip 된 적 있음 (`claude_attempts >= 2`)

```bash
node scripts/bug-report-watch.js skip <id> --reason "<왜 못 고치는지 한 줄>"
```

### 7. 끝
처리 결과를 한 줄로 보고:
- `Fixed #<id> @ <sha>: <title>`
- `Skipped #<id>: <reason>`
- `No pending bug reports.`

추가 설명 금지. 다음 루프 이터레이션이 깨끗하게 시작되도록 컨텍스트 가볍게 둘 것.

## 실패 시 동작

- 클레임 실패 (이미 다른 워커가 가져감): exit, 다음 이터레이션 대기.
- commit hook 실패: hook 메시지 그대로 노출 + skip (수정 결과 폐기 금지 — 그대로 두고 사람이 마무리).
- push 실패 (네트워크/권한): commit 까지만 두고 skip (`--reason "push_failed_<reason>"`).
- 어떤 경우에도 `--no-verify` 또는 `git reset --hard` 사용 금지.
