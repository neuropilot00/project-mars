# OCCUPY MARS — 오픈베타 체크리스트
> 작성: 2026-05-31 | 코드베이스 실측 기반 점검. 항목별 상태: ✅ 완료 / ⚠️ 확인·작업 필요 / 🔴 차단(반드시 해결) / ⬜ 미확인

이 문서는 "오픈베타 시작 전에 반드시 끝내야 할 것"을 **실행 단위 체크리스트**로 정리한다.
배경/전략은 기존 문서를 따른다 — 중복 작성하지 말고 아래를 선행 참조:
- `docs/LAUNCH_ROADMAP_2026.md` — 상용 런칭 3단계 로드맵
- `docs/COMMERCIAL_OPEN_READINESS_2026-05-11.md` — 보안·정산·운영 준비도 점검
- `docs/LAUNCH_BLOCKER_EXECUTION_PLAN_2026-05-15.md` — 런칭 블로커 실행안
- `docs/RELEASE_REGRESSION_CHECKLIST_2026-05-15.md` — 배포 회귀 테스트
- `docs/OPS_MINIMUM_RUNBOOK_2026-05-15.md` — 최소 운영 런북

---

## 0. 한눈 요약 (실측 2026-05-31)
**이미 갖춰진 것 (실측 확인):**
- ✅ 서버 JS 전체 문법 정상 (routes/services `node --check` 통과)
- ✅ index.html / admin.html 인라인 스크립트 문법오류 0
- ✅ 로컬 DB 미적용 마이그레이션 0건 (최신 292까지)
- ✅ 하드코딩 시크릿/비밀번호 없음 (전부 `process.env`), `.env`는 .gitignore 처리됨
- ✅ 배포 설정 존재 (`railway.json` — NIXPACKS, `cd server && node index.js`, restart ALWAYS)
- ✅ 핵심 기능 토글 ON (`fleet_combat_enabled`, `cantina_enabled`, `vip_enabled`)
- ✅ **헬스체크 `GET /health` 존재** (DB ping 포함, index.js:224)
- ✅ **`engines.node 22.x`로 고정됨** (root/server package.json)
- ✅ **DB 백업 스크립트 존재** (`server/scripts/backup.sh`, `server/tools/backup_verify.js`)
- ✅ **레이트리밋 광범위 적용** (auth/api/arena/marketplace/staking/governance/lottery/dividends/claimUpgrades)
- ✅ 버그 인박스/DB 미처리 0건

**실제 갭 (베타 전 처리):**
- ✅ **프로덕션 노드 버전 고정** — root/server `package.json` 모두 `engines.node=22.x`
- ⚠️ **server console.log 167개** — 프로덕션 로그 노이즈/민감정보 노출 가능, 정리 또는 로그레벨 가드 권장
- ⚠️ DB 백업 스크립트는 있으나 **자동 스케줄·복구 리허설 확인 필요** (스크립트 ≠ 자동 실행)
- 🔴 **법무/약관 부재** (COMMERCIAL_OPEN_READINESS 기준 🔴) — 약관·개인정보·환불 정책. 단, "법무는 패스" 방침이면 베타 한정 고지문으로 대체 가능
- ⚠️ `AUDIT_FINDINGS.md` 잔여 🟡(저위험/도달불가 위주) — 베타 차단 아님, 모니터

---

## 1. 🔴 차단 — 베타 시작 전 반드시
- [ ] **프로덕션 시크릿 강도 확인**: `JWT_SECRET`, `ADMIN_SECRET`은 production 부팅 시 32자 미만/기본값 패턴/반복문자면 즉시 실패하도록 서버 가드 적용. Railway 실제 값 자체의 랜덤성은 배포 전 운영자가 환경변수 화면에서 최종 확인.
- [ ] **DB 백업·복구 리허설**: 백업 스크립트(`server/scripts/backup.sh`)와 검증 도구(`npm run backup:verify`)는 최신 백업 파일 존재/gzip 무결성/복구 가능한 SQL 신호까지 확인. **자동 스케줄(cron/Railway)로 실제 돌고 있는지** + 격리 DB 복구 테스트 증거는 운영 환경에서 필요.
- [x] **베타 고지문** ✅ (v7.351): 신규 진입 1회 노출 모달 구현(`index.html`, 반투명+화성 오렌지). 실험 단계/데이터 초기화 가능/게임 재화 현금가치·환불 없음/버그 신고 4줄, 4개국어. `localStorage 'pw_beta_notice_v1'` 1회 게이트. (정식 약관은 `COMMERCIAL_OPEN_READINESS` 🔴 — 상용 오픈 시 필수, 베타는 이 고지로 대체.)
- [ ] **마이그레이션 프로덕션 적용 확인**: release preflight의 DB smoke가 `schema_migrations`에 현재 repo 최신 migration 및 핵심 핫픽스가 적용됐는지 확인하도록 보강. 배포 직후 프로덕션 `DATABASE_URL`로 실행해 통과 증거 필요. 특히 최근 핫픽스:
  - `291_crash_round_cleanup.sql` (칸티나 크래시 고아 라운드)
  - `292_war_bet_events_weekly_columns.sql` (gamblingAuto 컬럼)
  - `295_ship_build_refunded_status.sql` (건조 완성 실패 전액 환불, v7.349)
- [ ] **에러 로그 0 확인**: 배포 후 1시간 로그에서 빨간 `ERROR:` / `does not exist` / `500`이 없는지. (정상: checkpoint/Saving 류 LOG는 무시)
- [x] **돈 흐름 정합성** ✅ (2026-06-03 라이브 검증): GP/PP/USDT 음수잔액 0(DB 제약 `chk_users_balances_nonneg`가 물리적 차단), 음수 자원재고 0, 좀비 건조잡 0, 칸티나 크래시 고아 라운드 0(전부 terminal), 환전/도박/마켓 음수금액 0, 수송 이중정산 0, 함대전 보상 중복 0, 함선 한도위반 0. **프로덕션 배포 후 동일 쿼리 재확인 권장**.
- [x] **회원가입→첫 플레이 풀 루프** ✅ (2026-06-03 격리 검증, 13/13 PASS): 신규 지갑 → JWT → `POST /api/claim`(frontier Arabia Terra, 픽셀 4개) → `POST /api/territory/:id/harvest`(PP/GP/자원 지급) → `startBuild`+`completeBuildJob`(GP 차감·함선 생성·자동 기함) → `simulateBattle`(승부 결정, 1161틱) 전 구간 막힘 없음. 잔여 0. **주의**: 신규(레벨1)는 core 티어 섹터 클레임 불가(`level_too_low`) — 온보딩이 frontier 섹터로 유도해야 함(§3 온보딩 항목과 연결).

## 2. ⚠️ 안정성/운영 (베타 중 사고 방지)
- [x] ~~헬스체크 엔드포인트~~ — `GET /health`(DB ping) 이미 존재. Railway 헬스체크 경로로 연결만 확인.
- [x] ~~레이트리밋~~ — auth/api/arena/marketplace/staking/governance/lottery/dividends 적용됨. 신규 경제 라우트 추가 시 동일 적용 유지.
- [x] **프로덕션 노드 버전 고정**: root/server `package.json` 모두 `engines.node=22.x`로 고정해 로컬 v25와의 미세 차이 방지.
- [ ] **console.log 정리**: production 기본 `LOG_LEVEL=warn`에서 `console.log`를 억제하는 전역 가드 적용(`warn/error` 유지, `LOG_LEVEL=debug`이면 log 허용). 개별 민감 로그 문구 스윕은 계속 필요.
- [x] **uncaughtException/unhandledRejection 핸들러** 존재 확인. `server/index.js`에서 크래시 로그 + graceful shutdown 경로 적용.
- [x] **스케줄러 중복 실행 방지**: Redis leader gate + scheduler start guard/`unref()` 적용. 멀티 인스턴스 확장 시에도 leader 인스턴스 1개만 실행.
- [ ] **부하 테스트(가벼운)**: 동시 50~100명 가정 — 함대전 시뮬, 수확, 칸티나 라운드가 버티는지. (전술랩 대규모전 성능은 v7.335에서 1차 개선됨)

## 3. ⚠️ 콘텐츠/밸런스 (베타 경험)
- [ ] **신규 유저 온보딩**: 첫 진입 시 뭘 해야 할지 안내(튜토리얼/퀘스트 동선)가 끊기지 않는지.
- [ ] **무료 수급 밸런스**: 무료/활동 미션 GP(현 floor 3/8/20), 자원 출항 등 F2P 사다리가 과하지도 빈약하지도 않은지.
- [ ] **경제 인플레/싱크**: GP 발행 vs 소각(소각 메커니즘) 균형. 일일 미션/현상금 보상 수령은 numeric 문자열 결합 없이 숫자 합산/유저 지급 확인으로 보강. 전체 어드민 경제 탭 모니터와 밸런스 조정은 계속 필요.
- [ ] **자동 콘텐츠 정상 가동**: gamblingAuto(주간 파벌 베팅), 칸티나 크래시 라운드, 월드이벤트/래플/토너먼트가 어드민 개입 없이 자동으로 도는지 (사용자 요청사항).
- [ ] **캠페인 진행 막힘 없음**: 챕터 objective 게이트가 정상 해제되는지(과거 dead-end 이슈 영역).
- [ ] **4개국어 로컬라이징 누락 점검**: ko/en/ja/zh — 최근 진형/기동(v7.342)·부스트 배지(v7.343) 외 잔여 한글 하드코딩 스윕.

## 4. ⚠️ 보안/남용 방지
- [x] **어드민 패널 접근 차단**: `/admin/api/stats`, `/admin/api/campaign-editor/chapters` 무인증 차단을 release preflight에 추가.
- [ ] **지갑 위조/타인 자원 접근 불가**: 대표 경제·함대 mutation 라우트(`/api/fleets`, `/api/transport/start`, `/api/gp/transfer`, `/api/shop/use`, `/api/territory/:id/harvest`) 및 내 옥션/현상금/베팅/듀얼/와저/라플/동맹/길드/수송/프레스티지/영토설명/업그레이드/모뉴먼트/복권/스테이킹/GP활동·전송/알림/상태/실드/렌탈/원정/브랜딩/주문/티어/토너먼트/VIP/자원/직업/아이템/마켓/칭호/일일미션/영토/OPS read(`/api/user/auctions`, `/api/bounty/my-bounties`, `/api/bounty/on-me`, `/api/betting/mine`, `/api/duels/my`, `/api/duels/pending`, `/api/wager/my`, `/api/raffles/my`, `/api/alliances/my`, `/api/guild/my`, `/api/guild/invites`, `/api/transport/my`, `/api/prestige/my`, `/api/tdesc/my`, `/api/upgrades/my-upgrades`, `/api/monuments/my-monuments`, `/api/lottery/my-tickets`, `/api/staking/my-stakes`, `/api/gp/activity`, `/api/gp/transfers`, `/api/notifications`, `/api/status/my`, `/api/shield/my-shields`, `/api/rental/my`, `/api/expeditions/my`, `/api/claims/my`, `/api/branding/my`, `/api/spells/my`, `/api/tiers/my`, `/api/tournaments/my`, `/api/vip/my`, `/api/user/resources`, `/api/user/job`, `/api/shop/inventory`, `/api/shop/active-effects`, `/api/items/instances`, `/api/marketplace/my-listings`, `/api/user/titles`, `/api/daily/status`, `/api/daily/missions`, `/api/user/my-territories`, `/api/missions/active`) 무인증 차단을 release preflight에 추가. 전체 owner 검증 감사는 계속 필요.
- [ ] **도박(칸티나) 공정성·한도**: 래플 티켓 단가/house cut 경계 및 메모리 폭증 없는 crypto 추첨 적용. war betting/lottery min/max·잔액 음수 방지는 일부 확인됐지만 provably-fair 공개성·법무 고지는 별도 필요.
- [x] **입력 검증/XSS**: 신규 입력처 스윕 중 영토 owner/guild 표시의 `innerHTML` 렌더링 escape 및 guild emblem URL scheme guard 적용.
- [x] **버그 리포터 동작** ✅ (2026-06-03 라이브 E2E): `POST /api/bug-report` + 별칭 `/bug-report` 둘 다 `ok:true`, `bug_reports` DB 저장(recent_errors/viewport/lang/context 포함), inbox JSON 미러(`00000003_gameplay.json` 등 codex_hint 포함), 스크린샷 디스크 미러(`screenshots/00000003.png`), 어드민 조회 `GET /admin/api/bug-reports`는 시크릿 없으면 403·있으면 목록 반환. 격리 데이터 정리 완료.

## 5. ⚠️ 배포/인프라
- [x] **railway.json 정리**: `deploy` 키 단일 정의 확인(중복 없음).
- [x] **정적 에셋 캐시버스트**: `index.html` 전역 `ASSET_VER=7440` 정의. 함선 top sprite와 tactical-lab iframe URL이 해당 버전을 사용하고, tactical-lab modal script 태그도 `?v=7440`으로 갱신.
- [ ] **CDN/정적 파일 서빙**: release preflight에 전술랩 HTML/함선 top PNG/전투 배경 PNG 200 응답 확인 추가. CDN 응답 속도와 장기 캐시 정책은 프로덕션에서 별도 측정 필요.
- [ ] **롤백 플랜**: 베타 중 치명 버그 시 직전 커밋으로 즉시 롤백 가능한지(태그/배포 이력).
- [ ] **도메인/SSL**: 프로덕션 도메인 HTTPS 정상.

## 6. ⬜ 베타 운영 준비 (게임 외)
- [ ] **피드백 채널**: 디스코드/폼 등 유저 버그·건의 받을 곳.
- [ ] **공지/패치노트 루트**: 베타 변경사항 알릴 방법(CHANGELOG는 내부용).
- [ ] **모니터링 대시보드**: 동접·에러율·DB 부하 한눈에.
- [ ] **베타 범위·기간 공지**: "오픈베타"임을 명시(데이터 초기화 가능성 등 고지).
- [ ] **초기화/시즌 정책**: 베타 종료 시 자산 이월/리셋 여부를 미리 공지.

---

## 부록 A — 최근 세션 핫픽스 (베타 직전 반영분, 2026-05-31)
| 버전 | 내용 |
|---|---|
| v7.331 | 합체유닛(로봇) 탑뷰 마크로스풍 비행 포즈 재생성 |
| v7.332 | Fleet Command 미리보기 로봇 톤다운 |
| v7.333 / v7.335 | 전술랩 대규모전 멈춤 수정(호밍 미사일 성능 가드 + fire() O(n²) 제거) |
| v7.337 | 전술랩 1초 후 멈춤(targets ReferenceError) 핫픽스 |
| v7.338 | 수동 미사일이 빔으로 나가던 문제 |
| v7.340b | 수동 미사일 시안 대형 구별 |
| v7.339 | 전술랩 닫아도 전투 계속/리셋 안되던 문제 |
| v7.334 / mig 291 | 칸티나 CRASH 무한 WAITING(고아 라운드) |
| v7.336 / mig 292 | gamblingAuto war_bet_events 누락 컬럼/제약 |
| v7.341b | 함대 요약 합체유닛 카운트 표시 |
| v7.342 | 함대 진형/기동 로컬라이징 |
| v7.343b | 좌상단 부스트 배지(🔥) 가독성/시간표시 |

## 부록 B — 빠른 점검 명령
```bash
# 전 서버 JS 문법
for f in server/index.js server/routes/*.js server/services/*.js; do node --check "$f" || echo "FAIL $f"; done

# 미적용 마이그레이션(프로덕션 DB 대상으로 DATABASE_URL 바꿔 실행)
psql "$DATABASE_URL" -At -c "SELECT filename FROM schema_migrations ORDER BY filename;" 

# 에러 로그만 추리기 (배포 로그에서)
#   ERROR: / does not exist / 500  → 진짜 문제
#   checkpoint / Saving... / success → 정상(무시)
```

---
*우선순위: 1(차단) → 2(안정성) → 3·4(콘텐츠/보안) → 5·6(인프라/운영). 1번이 다 ✅ 되기 전엔 오픈베타 시작하지 말 것.*
