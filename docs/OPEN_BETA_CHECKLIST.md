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
- ✅ **`engines.node >=18.0.0` 지정됨** (package.json)
- ✅ **DB 백업 스크립트 존재** (`server/scripts/backup.sh`, `server/tools/backup_verify.js`)
- ✅ **레이트리밋 광범위 적용** (auth/api/arena/marketplace/staking/governance/lottery/dividends/claimUpgrades)
- ✅ 버그 인박스/DB 미처리 0건

**실제 갭 (베타 전 처리):**
- ⚠️ **프로덕션 노드 버전이 로컬 v25** — `engines`는 `>=18`이라 통과하지만 프로덕션 노드 버전을 베타 기간 고정(예 20.x LTS) 권장
- ⚠️ **server console.log 167개** — 프로덕션 로그 노이즈/민감정보 노출 가능, 정리 또는 로그레벨 가드 권장
- ⚠️ DB 백업 스크립트는 있으나 **자동 스케줄·복구 리허설 확인 필요** (스크립트 ≠ 자동 실행)
- 🔴 **법무/약관 부재** (COMMERCIAL_OPEN_READINESS 기준 🔴) — 약관·개인정보·환불 정책. 단, "법무는 패스" 방침이면 베타 한정 고지문으로 대체 가능
- ⚠️ `AUDIT_FINDINGS.md` 잔여 🟡(저위험/도달불가 위주) — 베타 차단 아님, 모니터

---

## 1. 🔴 차단 — 베타 시작 전 반드시
- [ ] **프로덕션 시크릿 강도 확인**: `JWT_SECRET`, `ADMIN_SECRET`이 추측 불가한 랜덤 32자+ 인지 (Railway 환경변수). 로컬 기본값/약한 값 금지.
- [ ] **DB 백업·복구 리허설**: 백업 스크립트(`server/scripts/backup.sh`)는 존재 — **자동 스케줄(cron/Railway)로 실제 돌고 있는지** + 복구를 한 번 실제로 테스트. 베타 중 데이터 날리면 신뢰 즉사.
- [ ] **베타 고지문**: 법무 정식 약관이 없으면(방침상 패스), 최소한 "오픈베타 — 데이터 초기화 가능/실험 단계" 고지 + 결제/환불 관련 한 줄 안내라도 노출. (정식 약관은 `COMMERCIAL_OPEN_READINESS` 🔴 항목 — 상용 오픈 시 필수)
- [ ] **마이그레이션 프로덕션 적용 확인**: 배포 직후 `schema_migrations`에 최신(295까지) 전부 적용됐는지. 특히 최근 핫픽스:
  - `291_crash_round_cleanup.sql` (칸티나 크래시 고아 라운드)
  - `292_war_bet_events_weekly_columns.sql` (gamblingAuto 컬럼)
  - `295_ship_build_refunded_status.sql` (건조 완성 실패 전액 환불, v7.349)
- [ ] **에러 로그 0 확인**: 배포 후 1시간 로그에서 빨간 `ERROR:` / `does not exist` / `500`이 없는지. (정상: checkpoint/Saving 류 LOG는 무시)
- [x] **돈 흐름 정합성** ✅ (2026-06-03 라이브 검증): GP/PP/USDT 음수잔액 0(DB 제약 `chk_users_balances_nonneg`가 물리적 차단), 음수 자원재고 0, 좀비 건조잡 0, 칸티나 크래시 고아 라운드 0(전부 terminal), 환전/도박/마켓 음수금액 0, 수송 이중정산 0, 함대전 보상 중복 0, 함선 한도위반 0. **프로덕션 배포 후 동일 쿼리 재확인 권장**.
- [x] **회원가입→첫 플레이 풀 루프** ✅ (2026-06-03 격리 검증, 13/13 PASS): 신규 지갑 → JWT → `POST /api/claim`(frontier Arabia Terra, 픽셀 4개) → `POST /api/territory/:id/harvest`(PP/GP/자원 지급) → `startBuild`+`completeBuildJob`(GP 차감·함선 생성·자동 기함) → `simulateBattle`(승부 결정, 1161틱) 전 구간 막힘 없음. 잔여 0. **주의**: 신규(레벨1)는 core 티어 섹터 클레임 불가(`level_too_low`) — 온보딩이 frontier 섹터로 유도해야 함(§3 온보딩 항목과 연결).

## 2. ⚠️ 안정성/운영 (베타 중 사고 방지)
- [x] ~~헬스체크 엔드포인트~~ — `GET /health`(DB ping) 이미 존재. Railway 헬스체크 경로로 연결만 확인.
- [x] ~~레이트리밋~~ — auth/api/arena/marketplace/staking/governance/lottery/dividends 적용됨. 신규 경제 라우트 추가 시 동일 적용 유지.
- [ ] **프로덕션 노드 버전 고정**: `engines.node`는 `>=18`이라 통과하나, 베타 기간엔 Railway 노드 버전을 LTS(20.x/22.x)로 고정해 로컬 v25와의 미세 차이 방지.
- [ ] **console.log 정리**: server 167개 → 민감정보(지갑/금액) 출력 점검 + 프로덕션 로그레벨 가드(또는 noisy 로그 제거).
- [ ] **uncaughtException/unhandledRejection 핸들러** 존재 확인. 없으면 추가(크래시 로그 + graceful).
- [ ] **스케줄러 중복 실행 방지**: 멀티 인스턴스로 늘릴 때 cron/스케줄러가 leader에서만 돌게(현재 numReplicas=1이면 OK, 늘리면 재점검).
- [ ] **부하 테스트(가벼운)**: 동시 50~100명 가정 — 함대전 시뮬, 수확, 칸티나 라운드가 버티는지. (전술랩 대규모전 성능은 v7.335에서 1차 개선됨)

## 3. ⚠️ 콘텐츠/밸런스 (베타 경험)
- [ ] **신규 유저 온보딩**: 첫 진입 시 뭘 해야 할지 안내(튜토리얼/퀘스트 동선)가 끊기지 않는지.
- [ ] **무료 수급 밸런스**: 무료/활동 미션 GP(현 floor 3/8/20), 자원 출항 등 F2P 사다리가 과하지도 빈약하지도 않은지.
- [ ] **경제 인플레/싱크**: GP 발행 vs 소각(소각 메커니즘) 균형. 어드민 경제 탭으로 모니터.
- [ ] **자동 콘텐츠 정상 가동**: gamblingAuto(주간 파벌 베팅), 칸티나 크래시 라운드, 월드이벤트/래플/토너먼트가 어드민 개입 없이 자동으로 도는지 (사용자 요청사항).
- [ ] **캠페인 진행 막힘 없음**: 챕터 objective 게이트가 정상 해제되는지(과거 dead-end 이슈 영역).
- [ ] **4개국어 로컬라이징 누락 점검**: ko/en/ja/zh — 최근 진형/기동(v7.342)·부스트 배지(v7.343) 외 잔여 한글 하드코딩 스윕.

## 4. ⚠️ 보안/남용 방지
- [ ] **어드민 패널 접근 차단**: `admin.html` / `/admin/api`가 `ADMIN_SECRET` 없이는 완전 차단되는지.
- [ ] **지갑 위조/타인 자원 접근 불가**: 모든 경제·함대 액션이 서버에서 owner 검증(대소문자 무시) 하는지.
- [ ] **도박(칸티나) 공정성·한도**: min/max 베팅, provably-fair, 잔액 음수 방지. 미성년/법무 고지 문구(필요 시).
- [ ] **입력 검증/XSS**: 닉네임·영토 설명·그래피티·튜브 메시지 등 사용자 입력 escape(이미 escapeHtmlSafe 사용 중 — 신규 입력처 점검).
- [ ] **버그 리포터 동작**: 인게임 🐛 제출 → `bug_reports` 저장 + inbox 미러링 정상.

## 5. ⚠️ 배포/인프라
- [ ] **railway.json 정리**: `deploy` 키 중복 여부 확인(마지막 값만 적용됨 — 정리 권장).
- [ ] **정적 에셋 캐시버스트**: 배포 시 `ASSET_VER` / iframe `?v=` 갱신 흐름 확인(스프라이트·전술랩).
- [ ] **CDN/정적 파일 서빙**: assets(이미지 다수, 합체 PNG 등) 응답 속도.
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
