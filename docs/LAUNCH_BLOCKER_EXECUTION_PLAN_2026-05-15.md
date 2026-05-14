# Occupy Mars Launch Blocker Execution Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 상업 오픈을 막는 Stop-Ship / Regression / Ops blocker를 실제 구현 가능한 작은 작업 단위로 분해한다.

**Architecture:** 이 문서는 새 기능 기획서가 아니라 출시 안정화 실행서다. `index.html` 대형 단일 파일 구조는 유지하고, 위험도 높은 변경은 서버/스크립트/문서/체크리스트 레벨에서 먼저 잠근다. 프론트 대형 수정은 오픈 blocker가 정리된 뒤에만 진행한다.

**Tech Stack:** Node.js/Express, PostgreSQL, 단일 파일 프론트엔드 `index.html`, GitHub → Railway 배포, 쉘 스크립트/Markdown 문서.

---

## 0. Source Ledger

### User-stated
- 사용자는 프로젝트마스 전체 검수, 버그 수정, 게임 내용 파악, 성공 전략과 상용화 기획 정리를 원했다.
- 사용자는 중간 체크포인트와 재개 가능한 작업 묶음을 선호한다.
- 사용자는 관리형 프로젝트 작업에서 커밋+푸시까지 완료되길 원한다.

### Tool-verified
- `server/package.json`에는 `start`, `dev`만 있고 `test` 스크립트가 없다.
- `start-test.sh`는 `cloudflared tunnel --url http://localhost:3000`로 외부 공개를 열고, 출력문에 관리자 비밀번호 `admin1234`를 그대로 노출한다.
- `docs/COMMERCIAL_OPEN_READINESS_2026-05-11.md`는 테스트 공개 경로 제거, 회귀팩, 운영 런북 부족을 주요 blocker로 정리한다.
- `docs/HANDOFF.md`는 배포가 `GitHub push → Railway 자동 배포` 흐름임을 설명한다.
- 현재 저장소에는 방향성 문서는 많지만, 즉시 쓸 수 있는 릴리즈 스모크 체크리스트/운영 런북 문서는 바로 확인되지 않았다.

### Proposed by agent
- blocker 해소는 `보안/공개경로 차단 → 운영 기본선 → 회귀 검증 팩 → UX polish` 순서가 가장 안전하다.
- 자동 테스트가 당장 없으므로, 첫 단계는 반자동 체크리스트와 배포 게이트 문서화가 최우선이다.

---

## 1. Launch Relationship / Sequencing Rule

- 이 작업은 새 프로젝트를 만드는 것이 아니라 기존 `occupy-mars` 저장소를 **상업 오픈 가능한 운영 빌드**로 안정화하는 작업이다.
- 우선순위는 **구조/운영 통제 > 회귀 방지 > UI polish** 이다.
- `index.html` 분리는 하지 않는다. 대신 서버/스크립트/문서/운영 절차에서 먼저 리스크를 줄인다.

---

## 2. Success Criteria

아래가 충족되면 1차 blocker 정리 완료로 본다.

1. 테스트용 외부 공개 경로가 상업 경로에서 제거된다.
2. 관리자 접근 방식과 시크릿 회수/교체 절차가 문서화된다.
3. 배포 전 반드시 도는 L1/L2 회귀 체크리스트가 저장소에 존재한다.
4. 운영자 2명이 봐도 따라 할 수 있는 최소 런북이 존재한다.
5. 최근 고위험 회귀 지점(관리자/출금/캠페인 에디터/영토/인벤토리)이 체크리스트에 포함된다.

---

## 3. Phase Map

### Phase A — Stop-Ship Security / Exposure
- `start-test.sh`를 상업 경로에서 제외
- 기본 관리자 비밀번호/테스트 공개 흐름 제거
- 관리자 시크릿 관리 규칙 문서화

### Phase B — Ops Baseline
- 환경변수 표준
- health 기준
- 배포/롤백 순서
- 백업/복구 순서

### Phase C — Regression Gate
- L1 10분 스모크
- L2 오픈 전 1시간 핵심 리허설
- 증빙 규칙(스크린샷/로그)

### Phase D — First-session UX Polish
- 첫 30분 핵심 루프 문구 통일
- 혼합 언어/개발자 톤 제거
- 초반 액션 유도 카피 정리

---

## 4. Task Breakdown

### Task 1: 테스트 공개 스크립트의 역할 재정의

**Objective:** `start-test.sh`를 상업 운영 경로와 분리해 accidental public exposure를 막는다.

**Files:**
- Modify: `start-test.sh`
- Create: `docs/ops/TEST_LAUNCHER_USAGE.md`
- Modify: `docs/HANDOFF.md`

**Step 1: 현재 위험 요소를 주석으로 표기**
- `start-test.sh` 상단에 "지인 테스트 전용 / 상업 운영 금지" 경고를 명시한다.

**Step 2: 기본 관리자 비밀번호 출력 제거**
- 스크립트 출력에서 `admin1234` 같은 고정 비밀번호 노출을 제거한다.
- 필요 시 환경변수 미설정 시 실행 중단으로 바꾼다.

**Step 3: 외부 공개를 명시 opt-in으로 전환**
- 기본 실행은 로컬만 열고,
- `ALLOW_PUBLIC_TUNNEL=1` 같은 명시적 환경변수일 때만 터널을 연다.

**Step 4: 테스트 스크립트 사용 문서 작성**
- 어디까지가 테스트용인지,
- 상업 운영에서는 왜 쓰면 안 되는지,
- 대체 운영 경로가 무엇인지 문서화한다.

**Step 5: 검증**
Run:
```bash
bash -n start-test.sh
```
Expected:
- syntax error 없음
- 기본 실행 경로가 비밀번호/터널을 자동 노출하지 않음

**Step 6: Commit**
```bash
git add start-test.sh docs/ops/TEST_LAUNCHER_USAGE.md docs/HANDOFF.md
git commit -m "fix: gate test launcher public exposure"
```

---

### Task 2: 관리자 인증 운영 규칙 문서화

**Objective:** 관리자 시크릿 발급/보관/교체/유출 대응 규칙을 문서로 고정한다.

**Files:**
- Create: `docs/ops/ADMIN_ACCESS_POLICY.md`
- Modify: `docs/HANDOFF.md`

**Step 1: 현재 인증 방식 기록**
- `server/middleware/adminAuth.js` 기준 `x-admin-secret` 사용을 문서에 명시.

**Step 2: 운영 규칙 작성**
- 저장 위치
- 교체 주기
- 공유 금지 규칙
- 유출 시 즉시 회수 절차
- 테스트/운영 시크릿 분리 규칙

**Step 3: 최소 체크리스트 작성**
- 오픈 전 확인 항목 5~10개

**Step 4: 검증**
- 문서에 실제 파일/환경변수/헤더명이 정확히 반영됐는지 수동 검토.

**Step 5: Commit**
```bash
git add docs/ops/ADMIN_ACCESS_POLICY.md docs/HANDOFF.md
git commit -m "docs: add admin access policy"
```

---

### Task 3: 운영 기본선 문서 세트 만들기

**Objective:** 배포/복구/헬스 기준 없이 오픈하는 상태를 끝낸다.

**Files:**
- Create: `docs/ops/OPERATIONS_RUNBOOK.md`
- Create: `docs/ops/DEPLOY_ROLLBACK_CHECKLIST.md`
- Create: `docs/ops/BACKUP_RECOVERY_BASELINE.md`

**Step 1: health 기준 정의**
- HTTP 응답
- DB 연결
- WebSocket 생존
- 관리자 패널 접속 여부

**Step 2: 배포 전/중/후 체크 정의**
- 배포 전 git 상태
- env 확인
- 배포 후 smoke 항목
- 실패 시 롤백 조건

**Step 3: 백업/복구 기준 정의**
- DB 백업 주기
- 복구 테스트 주기
- 담당자
- 목표 복구 시간

**Step 4: 검증**
- 문서만 보고 다른 운영자가 절차를 따라갈 수 있는지 셀프리뷰.

**Step 5: Commit**
```bash
git add docs/ops/OPERATIONS_RUNBOOK.md docs/ops/DEPLOY_ROLLBACK_CHECKLIST.md docs/ops/BACKUP_RECOVERY_BASELINE.md
git commit -m "docs: add ops baseline runbooks"
```

---

### Task 4: 릴리즈 회귀 체크리스트 작성

**Objective:** 최근 고위험 수정분이 다시 깨지지 않게 릴리즈 게이트를 만든다.

**Files:**
- Create: `docs/RELEASE_REGRESSION_CHECKLIST_2026-05-15.md`

**Step 1: L1 10분 스모크 작성**
- 서버 기동
- 메인 접속
- 로그인
- 영토 보기
- 인벤토리
- 관리자 로그인

**Step 2: L2 1시간 리허설 작성**
- 캠페인 에디터 auth
- 출금 최소값
- withdraw-all 잔액
- 함선 건조/함대 배치
- 영토 점령/수확
- 캠페인 진입

**Step 3: 증빙 규칙 추가**
- PASS/FAIL
- 스크린샷 또는 로그 경로
- 재현 메모

**Step 4: 검증**
- 최근 감사 문서에 있는 고위험 항목이 모두 포함됐는지 매칭 검토.

**Step 5: Commit**
```bash
git add docs/RELEASE_REGRESSION_CHECKLIST_2026-05-15.md
git commit -m "docs: add release regression checklist"
```

---

### Task 5: 첫 30분 UX polish backlog 고정

**Objective:** 첫 세션 재미 개선 작업을 blocker 해소 후 바로 이어갈 수 있게 backlog를 고정한다.

**Files:**
- Modify: `docs/FIRST_30_MIN_FUN_FLOW_2026-05-15.md`
- Create: `docs/FIRST_SESSION_POLISH_BACKLOG_2026-05-15.md`

**Step 1: 초반 4단계 목표를 backlog 항목으로 전개**
- 첫 영토
- 첫 수확
- 첫 함선 목표
- 첫 분쟁 예고

**Step 2: 화면별 수정 후보를 적는다**
- landing
- onboarding
- territory panel
- shipyard
- campaign card

**Step 3: blocker 의존성 표기**
- 어떤 UI 수정이 blocker 해소 후 진행돼야 하는지 표시.

**Step 4: 검증**
- backlog가 기능 추가 욕심이 아니라 첫 세션 전환율 개선에 집중하는지 리뷰.

**Step 5: Commit**
```bash
git add docs/FIRST_30_MIN_FUN_FLOW_2026-05-15.md docs/FIRST_SESSION_POLISH_BACKLOG_2026-05-15.md
git commit -m "docs: add first-session polish backlog"
```

---

## 5. Recommended Execution Order

1. Task 1 — 테스트 공개 스크립트 차단
2. Task 2 — 관리자 접근 정책 문서화
3. Task 3 — 운영 기본선 문서 세트
4. Task 4 — 회귀 체크리스트
5. Task 5 — 첫 세션 polish backlog

이 순서는 "가장 멋진 것"이 아니라 **실제로 오픈 리스크를 먼저 줄이는 순서**다.

---

## 6. Out of Scope

이번 플랜 범위 밖:
- `index.html` 구조 분리
- 신규 대형 콘텐츠 시스템 추가
- 전면 UI 리브랜딩
- 토큰/체인 구조 개편
- 자동 E2E 테스트 프레임워크 도입

---

## 7. Final Verification Gate

작업 완료 후 아래 질문에 모두 YES여야 한다.

- 테스트용 공개 흐름이 기본 경로에서 빠졌는가?
- 관리자 접근 방식이 사람/문서/절차로 관리 가능한가?
- 배포 전에 반드시 보는 체크리스트가 존재하는가?
- 운영 장애가 났을 때 누가 무엇을 어떻게 할지 문서가 있는가?
- 첫 30분 재미 개선이 blocker 작업 뒤에 이어질 준비가 되어 있는가?
