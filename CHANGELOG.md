# OCCUPY MARS — Changelog

## 2026-05-15 v7.79 — 상용 오픈 blocker 실행 문서 / 회귀 체크리스트 / 최소 런북 추가

**수정 (DOCS — launch readiness):**

- `docs/LAUNCH_BLOCKER_EXECUTION_PLAN_2026-05-15.md` 추가
  - 테스트 공개 경로 차단 → 관리자 정책 → 운영 기본선 → 회귀 게이트 → 첫 세션 polish 순서로 실제 작업 단위를 분해했다.
- `docs/RELEASE_REGRESSION_CHECKLIST_2026-05-15.md` 추가
  - L1 10분 스모크 / L2 1시간 리허설 / L3 주간 회귀팩 기준을 정리했다.
- `docs/OPS_MINIMUM_RUNBOOK_2026-05-15.md` 추가
  - 배포 전/후 확인, 기본 health 판단, 장애 분류, 롤백 기준을 정리했다.

---

## 2026-05-15 v7.78 — 캠페인 가이드 카피를 행동 중심으로 정리

**수정 (LOW — onboarding/campaign UX clarity):**

- 캠페인 카드 CTA를 `시작/계속/결과` 같은 추상 라벨에서 `작전 시작 / 작전 계속 / 결과 확인`으로 구체화했다.
- 캠페인 목표 액션 버튼을 `영토 확인 / 함선 준비 / 함대 편성 / 전투 진입 / 마켓 확인`처럼 실제 플레이 행동이 보이도록 조정했다.
- 목표 미완료 경고를 `아직 완료할 행동이 남아 있습니다 / 남은 목표를 먼저 진행한 뒤 결과를 확인하세요`로 바꿔, 실패처럼 보이던 문구를 진행 안내형으로 정리했다.
- 결과 모달의 `다시 확인`을 `목표 다시 확인`으로 바꿔 의미를 명확히 했다.

---

## 2026-05-14 v7.77 — 구형 튜토리얼 자동 실행 중단 + 신형 온보딩 루프 재정렬

**수정 (HIGH — first-session UX):**

- 로더 종료 후 `startTutorial()`를 자동 실행하던 구형 spotlight 튜토리얼 경로를 비활성화했다.
- 이제 첫 실행 가이드는 `server-backed onboarding` 흐름이 단일 진입점이 된다.
- 신형 온보딩 step 3~5를 `직업 선택 / 길드 / 일일 미션` 중심에서 **영토 → 수확 → 함대 → 캠페인** 중심 루프로 재정렬했다.
- 최종 온보딩 보상 step도 현재 게임의 북극성 루프를 한 줄로 요약하도록 바꿨다.

---

## 2026-05-14 v7.76 — 출금 최소값 설정 일관화 + withdraw-all 계약 잔액 계산 수정

**수정 (HIGH — finance/admin correctness):**

- `min_withdraw` / `withdraw_min_amount` 이중화로 인해 `/api/config`가 보여주는 최소 출금값과 실제 `/api/withdraw`, `/api/withdraw-all` 서버 검증값이 달라질 수 있었다.
- `/api/config`와 출금 검증 로직 모두 `withdraw_min_amount` 우선, 없으면 `min_withdraw` fallback을 쓰도록 통일했다.
- 기본 설정 시드(`server/db.js`)와 migration `201_withdraw_min_amount.sql`도 `withdraw_min_amount = 10` 기준으로 맞췄다.
- `withdraw-all`은 실제 지급액 `meta.totalOut`을 기록해두고도 관리자 대시보드 계약 잔액 계산에서 `usdt_amount`만 차감하고 있어 잔액을 과대 표시할 수 있었다.
- `server/routes/admin.js` 계약 잔액 계산을 수정해 `withdraw_all`은 `meta.totalOut`을 우선 차감하고, 구데이터/예외 시에만 `usdt_amount` fallback을 사용한다.

---

## 2026-05-14 v7.75 — admin 패널 `window.ADMIN_SECRET` 동기화 누락 수정

**수정 (HIGH — admin tab breakage):**

- `admin.html`은 로그인 시 `adminSecret` 지역 변수만 채우고, 다수의 후반 탭(Contest/Rental/Duel/Expedition/Branding/Spells/Tournaments/... 다수)은 `window.ADMIN_SECRET`를 헤더 소스로 사용하고 있었다.
- 그런데 `window.ADMIN_SECRET`에 값을 넣는 코드가 전혀 없어, 로그인 성공 후에도 해당 탭들은 빈 `x-admin-secret`로 요청을 보내며 401/403 또는 빈 데이터 상태가 났다.
- 초기 전역값 `window.ADMIN_SECRET = ''`를 선언하고, `doAuth()` 성공 직후 `window.ADMIN_SECRET = adminSecret`으로 동기화하도록 수정.

---

## 2026-05-14 v7.74 — campaign editor admin auth 회귀 수정

**수정 (HIGH — admin tool regression):**

- `server/index.js`에서 `/admin/api/campaign-editor/*` read endpoints에 `requireAdmin`이 붙은 뒤, `assets/campaign-editor.html`은 여전히 헤더 없는 `fetch()`로 `chapters/assets/chapter`를 읽고 있어 즉시 `403 FORBIDDEN`으로 깨졌다.
- `assets/campaign-editor.html`에 `adminFetch()`를 추가해 `x-admin-secret`을 자동 첨부하도록 수정.
  - `sessionStorage(campaignEditorAdminSecret)`에 저장된 시크릿을 우선 사용하고, 없으면 prompt로 입력받음
  - 저장된 시크릿으로 403이 나면 sessionStorage를 비우고 새 시크릿을 강제로 다시 입력받아 1회 재시도
- 결과적으로 캠페인 에디터가 다시 챕터 목록/에셋/개별 챕터를 정상 로드할 수 있는 상태로 복구.

---

## 2026-05-11 v7.73 — 모바일/데스크탑 nav 아이템 버튼 라우팅 수정 + SW 캐시 bump

**수정 (MEDIUM — UX 단절):**

- `index.html` 하단 nav `mn-items` 버튼이 `openItemShop();shopSwitchTab('inv')` 를 호출. `openItemShop()` 은 BASE 모달을 열어 SHOP 탭으로 가지만(setTimeout 100/150ms), 직후 동기 호출되는 `shopSwitchTab('inv')` 는 더 이상 화면에 떠 있지 않은 구버전 `shopModal` DOM(`shopTabShop`/`shopTabInv`/`shopInventoryView`)을 토글한다. 결과적으로 사용자에게는 "내 아이템"이 아니라 SHOP 진열대가 보이거나 아무 변화도 없는 것처럼 보임.
- 데스크탑 사이드 FAB `col-fab items` 도 동일한 옛 onclick 을 쓰고 있어 같이 수정. v7.73 1차 패치는 `mn-items` 만 고쳐서 데스크탑/사이드바 사용자에게는 그대로 안 통했음.
- BASE 모달은 이미 `baseTabItems`(내 아이템) 탭을 별도 카테고리로 가지고 있음. nav 버튼이 `loadBaseInventory()` 를 거쳐 그 탭으로 직접 이동하도록 `openMyItems()` 헬퍼 추가하고 `mn-items` + `col-fab items` onclick 을 교체.
- `sw.js` CACHE_NAME `mars-v8` → `mars-v9`. HTML 은 이미 network-first 라 영향 없지만, 옛 빌드의 정적 캐시(JS bundle 같은 부수 자원) 를 강제로 비워서 재발 방지.

---

## 2026-05-07 v7.72 — buildShip 다중 함대 선택 UI 추가

**수정 (MEDIUM — UX gap):**

- `index.html` `buildShip()` — 함선 건조 시 `fleet_id`를 서버에 전달하지 않아 다중 함대 보유 플레이어가 건조된 함선의 배치 함대를 선택할 수 없는 기능 공백 수정.
  - 건조 확인 전 `/api/fleets` 호출해 전투 중 아닌 함대 목록 조회.
  - 함대가 2개 이상이면 `gamePicker`로 배치 함대 선택 다이얼로그 표시.
  - 함대 1개면 자동 선택, 함대 없으면(신규 플레이어) `fleet_id` 미전송(서버 자동 배정).
  - `gamePicker` 취소 시 건조 중단.
  - 선택된 `fleet_id`를 `/api/ships/build` POST body에 포함.

---

## 2026-05-07 v7.71 — tdesc 소유권 체크 LOWER() 누락 + 최종 감사 완료

**수정 (LOW):**

- `server/services/tdesc.js` line 46 — 영토 설명 등록 소유권 체크가 `WHERE owner=$2` 로 대소문자 구별. 체크섬 주소(EIP-55)로 로그인한 오너가 "소유하지 않은 영토" 오류를 받는 버그. `LOWER(owner)=LOWER($2)` 로 수정.

**최종 감사 완료 (CLEAN):**
- `siege.js` — CLEAN (FOR UPDATE + rowCount 패턴 정상)
- `tprestige.js` — CLEAN (FOR UPDATE 직렬화 정상)
- `capsule.js` — CLEAN (LOW: 최대 1개 초과 생성 가능, 자금 영향 없음)
- `rental.js` — CLEAN (FOR UPDATE + status 체크 정상)
- `achievements.js` — CLEAN (INSERT ON CONFLICT DO NOTHING 이중 지급 방지)
- `profile.js` — CLEAN (rowCount 가드 정상)
- `beacon.js` — CLEAN (FOR UPDATE + rowCount 가드 정상)
- `territoryIdentity.js` routes — CLEAN (getAuthWallet JWT 전용)
- `api.js` GP/PP spend 구간 — CLEAN (FOR UPDATE + atomic 가드)

---

## 2026-05-07 v7.70 — guild 커스터마이즈 무료 우회 버그 수정 + 감사 완료

**수정 (LOW):**

- `server/services/guild.js` `updateGuildInfo()` — GP 차감 후 `rowCount` 미체크. 동시 GP 소진 시 무료로 길드 이름/엠블럼 변경 가능. 다른 guild.js GP 차감(createGuild/levelUp/declareWar)은 이미 `rowCount === 0` 가드 있음. 같은 패턴 적용.

**감사 완료 (CLEAN):**
- `enhancement.js` — FOR UPDATE + AND quantity >= $1 + rowCount 가드 정상
- `daily.js` — FOR UPDATE 직렬화 + ON CONFLICT DO NOTHING 로그인 보너스 보호
- `transport.js` — FOR UPDATE SKIP LOCKED 스케줄러 이중 처리 방지 정상

**정보 (변경 없음):**
- 마이그레이션 번호 충돌 7쌍(014/090/091/092/189/212/213) — `schema_migrations.filename` UNIQUE 키 기반 러너라 실행 순서 이슈 없음. 기능적 무관.

---

## 2026-05-07 v7.69 — campaign CV 소프트락 + FSP CH9 실패 보상 버그 수정

**수정 (CRITICAL — campaign):**

- `server/services/campaign.js` `calculateCvChapterRewards()` 실패 분기 — `unlocks: nextQuestId ? [] : []` 오타. 두 분기 모두 `[]`여서 CV CH1~CH9 실패 시 다음 챕터가 잠금 해제되지 않아 영구 소프트락. `[nextQuestId]` 로 수정.

**수정 (MEDIUM — campaign):**

- `server/services/campaign.js` `calculateFspCh9Rewards()` — 다른 FSP CH 함수와 달리 `if (!sim.success) return ...` 가드 없음. FSP CH9 실패 시 9000+ GP, branchModifiers, loreFlags 전체 지급. 실패 가드 추가 (GP=0, 디시루전드 엔딩 경로 seed).

**조사 결과 (False Positive):**
- `ship.js` `assertShipNotInBattle` NULL fleet_id bypass — FALSE POSITIVE. `fleet_battle_participants`는 fleet_id 기준 참여 추적. fleet_id=NULL 함선은 구조상 전투 중 불가. early-return 정상.

---

## 2026-05-07 v7.68 — campaign CH1 보상 누락 버그 수정 + 잔여 LOW 감사 항목 해소

**수정 (CRITICAL — campaign):**

- `server/services/campaign.js` `calculateRewards()` — `CH1_ID`(`mcc_campaign_ch1`) 분기가 누락되어 MCC CH1 완료 시 GP/XP/아이템 보상이 0으로 지급됨. `calculateCh1Rewards()` 호출 분기 추가.

**수정 (LOW — 잔여 감사 항목):**

- `server/services/branding.js` `clearBranding()` — 소유권 확인(`SELECT owner FROM claims`)이 트랜잭션 외부. 동시 영토 이전과 TOCTOU 가능. 트랜잭션 + `FOR UPDATE`로 이동.
- `server/services/replayShare.js` `createShare()` — 공유 한도 COUNT 체크와 INSERT 사이 advisory lock 없어 동시 요청 시 한도 초과 가능. `pg_advisory_xact_lock(hashtext(wallet))` 추가.
- `server/services/siegeFleetBridge.js` `createSiegeBattle()` — `is_in_battle` 체크가 트랜잭션 외부. 동시 함대 배정과 TOCTOU 가능. FOR UPDATE + 트랜잭션으로 이동.

**문서화 (변경 없음):**

- `campaign.js` `complete()` `getObjectiveState` — 트랜잭션 외부에서 읽혀 목표 게이트가 FOR UPDATE lock과 엄격하게 직렬화되지 않음. 실용적 위험 낮음. TODO 주석 추가, 향후 리팩터링 대상.
- `campaign.js` CH10 `choices[0]` — 에이전트 보고 FALSE POSITIVE. 챕터당 선택 1개만 저장(line 4158 early-return guard)이 의도된 설계.

---

## 2026-05-07 v7.67 — ships.js 라우트 wallet 스푸핑 취약점 수정

**수정 (HIGH):**

- `server/routes/ships.js` `getWallet()` — `requireAuth` 뮤테이션 라우트(build, upgrade-stat, repair, shield, disassemble, market list/buy/cancel)가 `req.query.wallet` / `req.headers['x-wallet']` 폴백을 포함하는 단일 `getWallet()` 사용. 공격자가 자신의 JWT로 인증 후 `?wallet=victim`으로 타인 계정 GP 차감 가능. `getWallet()` (JWT 전용)와 `getWalletOptional()` (optionalAuth 읽기 전용 폴백 허용)으로 분리.

**감사 완료 (이미 안전):**
- `staking.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` (JWT 전용) 사용
- `lottery.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `auction.js` (routes) — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `bounty.js` — 뮤테이션 POST 라우트는 이미 `getAuthWallet(req)` 사용
- `transport.js` — 뮤테이션 POST 라우트는 이미 `getWalletFromToken(req)` 사용
- `territoryIdentity.js` / `dailyOps.js` — 뮤테이션 라우트는 이미 `getAuthWallet(req)` 사용

---

## 2026-05-07 v7.66 — tribute/sponsor 동시 요청 제한 우회 방지

**수정 (MEDIUM):**

- `server/services/tribute.js` `sendTribute()` — 쿨다운 체크(`SELECT FROM territory_tributes WHERE from_wallet=... ORDER BY created_at DESC`) 가 `FOR UPDATE` 없이 진행. 동시 요청 두 개가 쿨다운 체크를 동시에 통과해 이중 tribute 가능. `pg_advisory_xact_lock(hashtext(wallet))` 추가로 동일 wallet 직렬화.
- `server/services/sponsor.js` `placeSponsor()` — `maxPerTerritory` COUNT 체크가 `FOR UPDATE` 없이 진행. 동시 요청 두 개가 같은 클레임 COUNT < max 통과 → 초과 sponsor 삽입. `pg_advisory_xact_lock(claimId)` 추가로 동일 클레임 직렬화.

**조사 결과 (변경 없음):**
- chain.js `processDeposit` — false positive. `deposits.tx_hash UNIQUE NOT NULL` 제약(migration 001)으로 이중 입금 방지됨.
- exploration.js POI deactivation — `FOR UPDATE` on POI row가 이미 직렬화. UI 상태 이슈. 보안 무관.
- siegeFleetBridge.js — admin/scheduler 경로. `create_siege_battle` stored proc에 DB 수준 보호 의존. 플레이어 직접 제어 불가.
- replayShare.js limit race — 자금 손실 없음. 최대 몇 개 초과 replay record. 낮은 우선순위.

---

## 2026-05-07 v7.65 — missions/worldEvents/governance/rocket 경쟁조건 수정

**수정 (MEDIUM):**

- `server/services/worldEvents.js` `distributeRewards()` — `UPDATE world_event_participants SET rewarded=true` 에 `AND rewarded=false` 가드 없음. 동시 `engageEvent`/`settleExpiredEvents` 호출 시 같은 참가자에게 GP+광물 이중 지급. `rowCount=0` 시 ROLLBACK+continue 추가.
- `server/services/governance.js` `recalculateCommander()` — `SELECT gp_balance FROM governance_positions WHERE role='commander'` 에 `FOR UPDATE` 없음. 동시 호출 시 같은 GP를 이중으로 commander_pool에 이전. `FOR UPDATE` 추가.
- `server/services/rocket.js` `scheduleRocketEvent()` — `SELECT ... WHERE status IN ('incoming','landed','looting')` 가 트랜잭션 외부. 동시 scheduler 틱 두 개가 각각 이벤트 생성. `pg_advisory_xact_lock(75300)` + `BEGIN/ROLLBACK/COMMIT` 블록으로 직렬화.

**수정 (LOW):**

- `server/services/missions.js` `launchMission()` — PP deduct `rowCount` 미체크. 동시 PP 소진 시 atomic guard 실패 무시하고 미션 생성됨. `rowCount=0` 시 ROLLBACK 추가.

**조사 결과 (변경 없음):**

- `hijack.js` `declareHijackWithPP()` `totalCost` — agent 보고 false positive. `baseCost`/`attackCost`는 route가 DB 픽셀 가격에서 서버사이드 계산. 클라이언트 조작 불가.
- `claimUpgrades.js` count check after GP deduction — false positive. `claims FOR UPDATE` 가 동일 영토의 모든 업그레이드를 직렬화함.

---

## 2026-05-07 v7.64 — auction/expedition/warBetting/vip/lottery 서비스 경쟁조건 수정

**수정 (CRITICAL):**

- `server/services/auction.js` `buyout()` — GP 차감 후 `rowCount` 미체크. 동시 GP 소진 시 `rowCount=0` 무시하고 auction이 `settled`로 닫히며 판매자에게 수익 지급 + 아이템 이전됨. 구매자 GP는 차감 안 됨 → 무료 즉구 가능. `rowCount === 0` 시 ROLLBACK 추가.

**수정 (MEDIUM):**

- `server/services/expedition.js` `resolveExpeditions()` — `UPDATE expeditions SET status='completed'` 에 `AND status='active'` 가드 없음. 동시 scheduler 틱 두 개가 같은 expedition 처리 → GP 이중 지급. `rowCount=0` 시 ROLLBACK + continue 추가.
- `server/services/expedition.js` `cancelExpedition()` — SELECT 가 트랜잭션 외부(`pool.query`). 동시 취소 두 요청이 같은 expedition 읽고 이중 환불. SELECT를 `BEGIN` 내 `FOR UPDATE + AND status='active'` 로 이동.
- `server/services/warBetting.js` `resolveEvent()` — 승자 베팅 `SELECT ... WHERE option=$2` 에 `AND status='pending'` 없음. 트랜잭션 충돌 후 재시도 시 `status='won'` 베팅에도 재지급. `AND status='pending'` 추가.

**수정 (LOW):**

- `server/services/vip.js` `buyVip()` — `vip_passes` FOR UPDATE 없어 동시 구매 두 요청이 각각 GP 차감 후 같은 pass row에 upsert → 패스는 1개지만 GP는 이중 차감. `INSERT DO NOTHING + SELECT FOR UPDATE` 직렬화 추가.
- `server/services/lottery.js` `drawWinner()` — `Math.random()` → `crypto.randomInt` 로 교체 (PRNG 예측 가능성 제거).

---

## 2026-05-07 v7.63 — 핵심 서비스 이중 처리 방지 + 경쟁 조건 수정

**수정 (CRITICAL — 서비스 레이어):**

- `server/services/auctionCombat.js` `_finalizeAuction()` — 동시 scheduler 틱 / buyout 요청 두 개가 같은 경매를 동시에 정산할 경우 `UPDATE auctions SET status='sold'`가 두 번 성공해 판매자에게 수익이 이중 지급됨.
  - `BEGIN` 직후 `SELECT ... FOR UPDATE`로 경매 행 잠금, `status IN ('active','ended')` 재확인
  - `UPDATE ... WHERE status IN ('active','ended')` + `rowCount === 0` 시 ROLLBACK & 조기 반환
- `server/services/auctionCombat.js` `placeBid()` — 이전 세션에서 시작된 수정: 경매 SELECT를 트랜잭션 외부(`pool.query`)에서 읽어 동시 입찰 시 GP 이중 차감 가능. FOR UPDATE 내부 트랜잭션으로 이동 완료.

**수정 (HIGH — 서비스 레이어):**

- `server/services/battleEngine.js` `applyBattleResults()` — 동시 호출 시(스케줄러 버그 or 네트워크 재시도) `fleet_battles` status='ended' 없이 UPDATE → 함대 전적(`battles_won/lost/total_kills`) 이중 적산.
  - `BEGIN` 직후 `SELECT ... FOR UPDATE`로 전투 행 잠금, `status === 'ended'` 시 ROLLBACK & skip
  - `UPDATE ... WHERE status != 'ended'` + `rowCount === 0` guard 추가
- `server/services/guild.js` `updateGuildInfo()` — 길드장 역할 체크 `SELECT role FROM guild_members WHERE ...` 에 `FOR UPDATE` 누락. 동시 요청 시 역할 변경 레이스로 비리더가 정보 수정 가능.
  - `SELECT role FROM guild_members WHERE guild_id=$1 AND wallet=$2 FOR UPDATE` 로 수정

**수정 (HIGH — 서비스 레이어):**

- `server/services/crafting.js` `craftItem()` — 일일 제작 횟수 제한 `COUNT(*) FROM crafting_log` 체크가 동시 요청 시 레이스 — 두 요청이 동시에 `count < max` 통과 후 모두 제작 진행.
  - `pg_advisory_xact_lock(hashtext(wallet))` 트랜잭션 어드바이저리 락으로 동일 wallet 직렬화

**조사 결과 (변경 없음):**

- `server/services/enhancementAdvanced.js` `calculateMaterialBonus()` — `pool.query`로 재료 잔액 사전 체크 후 `consumeMaterials(client, ...)` 내 atomic deduct. `AND quantity >= $3` 원자성 가드로 실제 이중 차감 불가. MEDIUM → DESIGN-SAFE 판정.

---

## 2026-05-07 v7.62 — 최종 라우트 감사 완료 + getWallet 정규화 마무리

**수정 (LOW):**

- `server/routes/auctionRoutes.js`, `jobs.js`, `factions.js` `getWallet()` — `.toLowerCase().trim()` 누락. 대소문자 불일치로 경매 self-deal 체크 우회 가능성. 패턴 통일.

**감사 확인 (버그 없음):**
- bugReport.js, crafting.js, resource.js, resources.js, transport.js — CLEAN (read-only 공개 설계)
- fleetSearch.js — wallet 검색 기능은 의도된 설계 (공개 fleet 검색)
- warBettingRoutes.js 레거시 admin 엔드포인트 — isAdmin(req)로 x-admin-secret 체크, JWT 불필요. 정상 패턴.
- weatherRoutes.js — CLEAN
- job.js, transport.js GET 비인증 — read-only 공개 데이터 (직업/수송 정보). 민감 정보 없음.

**최종 감사 범위:**
- 총 75개 라우트 파일 감사 완료
- 수정된 버그: CRITICAL 1개, HIGH 7개, LOW 11개 (v7.53~v7.62)

---

## 2026-05-07 v7.61 — alliance.js CRITICAL 런타임 크래시 + dailyOps GP 조작 + 다중 getWallet 패턴 수정

**수정 (CRITICAL):**

- `server/routes/alliance.js` — 서비스에 없는 5개 함수(`getAlliances`, `getSettings`, `getAllianceLog`, `depositTreasury`, `withdrawTreasury`) 호출로 모든 alliance 엔드포인트가 500 크래시 발생.
  - `getAlliances` → `listAlliances` 로 수정
  - `getSettings` → `getSetting('alliance_create_cost_gp')` 직접 DB 조회로 대체
  - `getAllianceLog` → 미구현 기능, 빈 배열 반환
  - `depositTreasury` / `withdrawTreasury` → 501 NOT_IMPLEMENTED (서비스에 아직 없음)

**수정 (HIGH):**

- `server/routes/dailyOps.js` `POST /daily-ops/progress` — `requireAuth`만 있어 일반 유저가 임의 `mission_type`으로 자신의 미션 진행도를 직접 올려 GP 보상 farming 가능. `requireAdmin` (x-admin-secret 헤더 체크) 추가. 서버 내부 호출은 `module.exports.notifyMissionProgress()` 직접 함수 export 경로 사용이므로 영향 없음.
- `server/routes/battleExtras.js` `POST /battles/siege/create` — "관리자/테스트 전용" 엔드포인트가 `requireAuth`만 있어 일반 유저가 임의 fleet ID로 타인 fleet을 강제 전투에 등록 가능. `requireAdmin` 추가.
- `server/routes/tacticalLab.js` `GET /tactical-lab/fleet-presets` — 비인증 공개 엔드포인트에서 전체 `ownerWallet` 주소 노출. SERIAL `battleId`로 열거 가능. `0x1234...5678` 형식 마스킹 처리.

**수정 (LOW):**

- `server/routes/phaseD.js` `getWallet()` — `?.` optional chaining + `.toLowerCase().trim()` 누락. team-battle 참가자 체크 `p.wallet === wallet` 대소문자 불일치 우회 방지.
- `server/routes/phaseC.js` `getWallet()` — 동일 패턴 수정.
- `server/routes/onboardingRoutes.js` `getWallet()` — 동일 패턴 수정.
- `server/routes/prestige.js` `/prestige/buy` 인라인 wallet 추출 — 동일 패턴 수정.

**감사 확인 (버그 없음):**
- commanderActions.js, announcement.js, branding.js, polls.js, vtag.js, banner.js, donation.js, profile.js, territoryIdentity.js, sectors.js, rating.js, sponsor.js, status.js, tdesc.js, tevt.js, tiers.js — CLEAN
- graffiti.js `placeGraffiti` — 서비스에서 owner 체크 존재 (`SELECT id, owner FROM claims`). 설계상 타인 영토에 쓰는 기능이므로 소유권 차단 아님. DESIGN INTENT.
- highlight.js `setHighlight` — 서비스에서 `NOT your territory` 소유권 체크 확인. FALSE POSITIVE.
- journal.js / milestone.js / beacon.js / broadcasts.js / capsule.js GET 엔드포인트 비인증 — read-only public data 설계. 민감 정보 없음. DESIGN INTENT.
- tombstone.js `svc` 로드 실패 시 TypeError — 서비스 파일 존재 확인, 실제 크래시 없음. LOW 위험.
- tprestige.js `claimId` parseInt 누락 — PostgreSQL 드라이버 자동 coerce, 실질 영향 없음.
- resourceCraft.js `GET /jobs` requireAuth 미들웨어 누락 — wallet length check로 기능적 보호. 방어적 패턴 개선 권장.

---

## 2026-05-07 v7.60 — tournaments.js 중복 참가 GP 이중 차감 수정

**수정 (LOW):**

- `server/services/tournaments.js` `joinTournament()` — 동일 wallet이 동시에 같은 토너먼트에 두 번 참가 요청 시 GP가 두 번 차감되나 entry는 `ON CONFLICT DO NOTHING`으로 한 번만 등록됨. tournament row의 `FOR UPDATE` 락이 직렬화하므로 실질 위험은 낮으나 두 번째 차감분 GP 손실 가능. `FOR UPDATE` 락 직후 `SELECT 1 FROM tournament_entries` 존재 체크를 추가해 `ALREADY_ENTERED` 에러로 조기 차단.

**감사 확인 (버그 없음):**
- `Math.random()` 기반 lottery/raffle 추첨 — 약한 PRNG이나 현재 Web3 블록체인 검증 없는 플랫폼 특성상 실질 조작 위험 낮음. 개선 필요 시 `crypto.getRandomValues()` 전환 권장.

---

## 2026-05-07 v7.59 — auth.js 비밀번호 변경/계정삭제 broken + arena.js hilo 소유권 검증 누락 수정

**수정 (HIGH):**

- `server/routes/auth.js` `POST /change-password` — JWT payload에 `userId` 없음 (`{ wallet, email, nickname }` 만 포함). `decoded.userId = undefined` → `WHERE id = $1` 조건이 null과 비교 → 사용자 미발견 → 비밀번호 변경 불가. `decoded.wallet` 기준 `WHERE LOWER(wallet_address) = $1` 로 수정.
- `server/routes/auth.js` `POST /delete-account` — 동일 원인으로 계정 삭제가 실제로 아무것도 하지 않음. pixels/claims/users 모두 `decoded.wallet` 기준으로 수정.
- `server/routes/arena.js` `POST /hilo/guess`, `POST /hilo/cashout` — 게임 소유권 검증 누락. `hilo_games.id`가 SERIAL(순차 정수)이므로 다른 플레이어의 게임에 guess를 실행해 강제 패배시킬 수 있는 griefing 공격 가능. 두 엔드포인트 모두 `g.wallet !== callerWallet` 시 403 반환하도록 소유권 체크 추가.

---

## 2026-05-07 v7.57 — 종합 감사 (governance/hijack/worldEvents/marketplace/daily-ops/siege) — 버그 없음

**감사 확인 (버그 없음):**
- **Governance/Commander Actions** — `verifyCommander(wallet, role)` 가 governance_positions WHERE wallet = $1 AND role = $2 로 실제 커맨더 권한을 확인. 글로벌 이벤트/바운티 GP 차감은 단일 커맨더 포지션 row에서만 발생. 에이전트가 제보한 "다른 커맨더 GP 도용" 시나리오는 UNIQUE(role, sector_id) 제약 + verifyCommander 게이트로 불가능.
- **Hijack `declareHijackWithPP()`** — `FOR UPDATE` 락 이후 잔액 체크, UPDATE에 `AND pp_balance >= $1` 이중 보호. 에이전트의 TOCTOU 제보는 FOR UPDATE가 행 잠금을 유지하는 한 불가능한 시나리오. FALSE POSITIVE.
- **World Events `engageEvent()`** — HP 차감 `UPDATE ... SET hp = GREATEST(0, hp - $2)` 단일 문장 원자 처리. FOR UPDATE 불필요. 쿨다운 삽입 wallet은 `getAuthWallet()`에서 이미 `.toLowerCase().trim()` 정규화됨. FALSE POSITIVE.
- **Marketplace `createListing()`** — `const w = seller.toLowerCase()` 함수 진입 시 정규화. SELECT/UPDATE 모두 `w`(소문자) 사용. 에이전트의 "wallet normalization mismatch" 제보는 FALSE POSITIVE.
- **Daily Ops claim** — `reward_claimed = FALSE FOR UPDATE` 이중 잠금, 트랜잭션 내 원자 처리. CLEAN.
- **Siege declare** — `requireAuth` 사용, JWT wallet 추출, GP 차감 `AND gp_balance >= $1` 원자 처리. CLEAN.
- **resourceCraft.js** — `user_resource_inventory` 올바르게 사용, 재료 차감과 결과 지급 동일 트랜잭션, `AND quantity >= $1` 원자 처리. CLEAN.

---

## 2026-05-07 v7.56 — tactical-lab reinforce() null guard 수정

**수정 (LOW):**

- `assets/tactical-lab-v11.html` `reinforce()` 함수 — `SHIPS[tid].name` 참조 시 `tid`가 유효하지 않은 코드인 경우 `Cannot read property 'name' of undefined` 크래시. `(SHIPS[tid]||{}).name||tid` 로 null guard 추가. (reinforce는 현재 UI에서 호출되지 않는 dead code지만 방어 처리.)

**감사 확인 (버그 없음):**
- P5-4 영토 업그레이드 UI (`loadTerritoryUpgrades`, `doTerritoryUpgrade`, `renderTerritoryUpgradeBody`) — wallet 전달, endpoint, 에러 처리, UI 갱신 모두 정상
- P5-5 섹터 컨트롤 (`_appendSectorControl`) — 빈 `owners` 배열 graceful 처리, `myEntry`, `influenceTier`/`controlPct` 렌더 정상
- P5-3 섹터 배지 (`sySectorBadge`) — unmapped code 안전 fallback 정상
- 캠페인 `pollCampaignProgress()` — `readyToComplete` 게이트, 미완료 objective 표시, complete 4xx/5xx 에러 처리 정상
- 캠페인 objective action routing — 6개 action type (`territory/territory_art/shipyard/fleet/fleet_battle/market`) 모두 핸들러 존재
- tactical-lab WS frame 핸들러 — v7.52 수정 후 `CATALOG` 참조 없음, `SHIPS[info.code]` null guard 정상
- 세계 이벤트 engage (`worldEvents.js`) — `getAuthWallet()` 정규화 패턴 (`?.` + `.toLowerCase().trim()`) 이미 적용됨

---

## 2026-05-07 v7.55 — ships.js / fleets.js getWallet 정규화 누락 수정

**수정 (LOW):**

- `server/routes/ships.js` `getWallet()` — JWT wallet 추출 시 `.toLowerCase().trim()` 정규화 없이 반환. ship market 등록/구매/취소, 건조, 강화 등 모든 함선 작업에서 미정규화 wallet 전달 가능성. `fleetBattles.js` v7.54 수정과 동일 패턴으로 통일.
- `server/routes/fleets.js` `getWallet()` — `req.user.wallet_address` optional chaining 누락 + `.trim()` 미처리. `?.` 추가 및 `.toLowerCase().trim()` 패턴 통일.

**참고:** 두 파일 모두 하위 서비스 레이어에서 `LOWER($1)` 비교 및 내부 `.toLowerCase()` 정규화가 있어 실제 데이터 불일치 위험은 낮음. 방어적 코드 품질 통일 목적.

**감사 확인 (버그 없음):**
- Guild GET 엔드포인트 (`/guild/my`, `/guild/invites`, `/guild/:id/requests`, `/guild/:id/search-users`) — `req.query.wallet` 기반 공개 READ 패턴은 의도된 설계. `/guild/:id/requests`는 서비스 레이어에서 leader/officer 권한 체크 확인.
- 영토 업그레이드 서비스 (`upgradeTerritory`) — FOR UPDATE 락, GP 차감 원자성, 레벨 한도 체크 정상
- 섹터 컨트롤 쿼리 (`COUNT(p.lat)`) — pixels.lat이 NOT NULL PRIMARY KEY이므로 `COUNT(*)` 동등. 정상.
- 함선 마켓 ID 필드명 — 내 함선 목록 `market_listing_id`, 마켓 목록 `listing_id` 일관성 확인.

---

## 2026-05-07 v7.54 — fleetBattles.js getWallet 정규화 누락 수정

**수정 (LOW):**

- `server/routes/fleetBattles.js` `getWallet()` — JWT 토큰에서 wallet 추출 시 `.toLowerCase().trim()` 정규화 없이 원본 케이스 그대로 반환. `fleet_battle_participants.wallet_address`에 대소문자 혼재 지갑 주소가 저장될 수 있어 향후 case-sensitive 쿼리에서 불일치 위험. 모든 다른 route 파일의 패턴 (`?.` + `toLowerCase().trim()`)으로 통일.

---

## 2026-05-07 v7.53 — 전체 코드베이스 종합 감사 (P5 Territory + Campaign + Admin) — 버그 없음

**감사 완료 (버그 없음):**

- **캠페인 스토리 렌더러** — `_campaignComposeEditorLayout` 병합 로직, `showCampaignStory`, `renderCampaignScene`, `pollCampaignProgress` 정상. `readyToComplete` 게이트, `campaign_objectives_gate` i18n 키 4개 언어 정의 확인
- **영토 업그레이드 UI (P5-4)** — `loadTerritoryUpgrades`/`doTerritoryUpgrade` 가 `/api/territory/:claimId/upgrades|upgrade` 엔드포인트 정확히 호출. `getUpgradeCatalog()` 반환 필드(`key/icon/name/nameEn/desc/bonusUnit/color/isP5/levels`) 프론트 렌더와 일치
- **섹터 컨트롤 UI (P5-5)** — `_appendSectorControl` → `/api/sectors/:sectorId/control` 정상 호출. 응답 필드(`owners/myEntry/influenceTier/controlPct`) 렌더와 일치
- **캠페인 Objective State (P5-7)** — `getObjectiveState` `materialHarvests`(resourceDrops JSONB 쿼리)/`territoryUpgradeLevels`(territory_upgrades SUM(level)) P5 추가 통계 확인
- **Admin 영토 경제 (P5-6)** — `loadTerritoryEconomy` → `/api/admin/territory/economy` 응답 필드(`harvestStats/materialIssued/materialBurn/suspiciousHarvesters/topClaims`) 일치. `_buildProfileEditor`/`saveTerritoryProductionProfile` → `/api/admin/territory/production-profile` 정상
- **서버 라우트 파일** — 전체 라우트/서비스 파일 Syntax check 통과. 모든 require 대상 파일 존재 확인 (`weeklyChallenges` try-catch 안전 처리 확인)
- **함선 마켓** — `syCancelShipListing(market_listing_id)` 취소, `syBuyShipListing(listing_id)` 구매 필드명 정합 확인
- **Daily Ops** — `notifyMissionProgress` 함수 `module.exports.prop` 패턴으로 올바르게 export됨
- **Forge 애니메이션** — DOM 요소(`forgeModal/forgeHammer/forgeGauge/forgeSparks` 등) 모두 존재 확인

**참고 (기능 영향 없음):**
- 마이그레이션 번호 중복: `213_ship_upgrade_materials_fix.sql`과 `213_shop_materials.sql` 동시 존재. 러너는 전체 파일명 기준 추적이므로 두 파일 모두 독립 적용 가능. 충돌 없음.

---

## 2026-05-07 v7.52 — tactical-lab WS 함선 격침 폭발 버그 수정

**수정 (MEDIUM):**

- `assets/tactical-lab-v11.html` — WS 'frame' 핸들러에서 `CATALOG` 미정의 변수 참조 수정. WS 모드에서 이전 프레임 대비 사라진 함선(격침) 감지 시 `CATALOG.ships` 조회가 ReferenceError를 발생시켜 폭발 이펙트/격침 로그가 표시되지 않는 버그. `CATALOG` → `SHIPS[info.code]` 직접 조회로 교체.

**검수 (버그 없음):**

- Fleet Command UX — 진형/기동 변경 모달 유지, 에러 메시지 커버리지, 형성 미리보기 로직 정상
- Ship Economy UX — 강화 확인 모달 (성공확률/GP/재료 보유/필요), 청사진 카드 재료 표시 정상
- `fleet-assault-demo.html` — Git 미추적 파일. `tactical-lab-v11.html`이 단일 프로덕션 파일임 확인

---

## 2026-05-07 v7.51 — 전체 게임 기능 검수 (버그 없음)

**감사 완료 (버그 없음):**

- Fleet Battle 전 경로 (declare-pvp, run, forfeit, history, timeline, report, highlights) — 인증/로직 정상
- Commander Actions (POST/GET) — requireAuth + JWT wallet 정상
- Battle Extras (rewards, siege) — 인증 정상
- Tactical Lab 카탈로그/fleet-presets (?bid= 실제 함대 로드) — 정상
- Fleets 전 엔드포인트 — JWT wallet 정상
- Ships 전 엔드포인트 (blueprints/market/build/upgrade-stat/repair) — 인증 정상
- Daily Ops /progress,/claim — getAuthWallet 사용 확인, getWallet dead code
- Harvest 엔드포인트 — getAuthWallet 확인
- 내부 캠페인 엔드포인트 (reputation/tags/lore/branch) — isInternalRequest 방어 확인
- Campaign OBJECTIVE_PRESETS MCC/FSP/CV 38챕터 전체 DB 연동 확인
- Campaign 보상 시스템 — 실제 지급/안전 수령 정상
- Campaign 시뮬레이션 — 전 경로 핸들러 확인
- Sector Control P5 엔드포인트 — 정상
- 서버 응답 확인 — tactical-lab/catalog, transport/settings 200 OK

---

## 2026-05-07 v7.50 — transport.js 크래시 + 캠페인 프롤로그 완료 블록 수정

**수정 (HIGH — 서버 크래시):**

- `server/routes/transport.js` — `requireWallet`/`getWallet` 미정의 참조 오류 수정. GET `/transport/my` 호출 시 서버가 `ReferenceError`로 크래시하는 버그 수정. `getWallet`/`requireWallet` 헬퍼 함수 추가.

**수정 (MEDIUM — 캠페인 프롤로그 완료 불가):**

- `server/services/campaign.js` — `isObjectiveDone()`에서 `action: 'unlock'`을 `action: 'story'`와 동일하게 처리. 프롤로그의 `route_unlock` objective가 `in_progress` 상태에서도 never-done으로 판정돼 프롤로그 챕터가 영구 OBJECTIVE_REQUIREMENTS_NOT_MET 상태가 되는 버그 수정.

---

## 2026-05-07 v7.48 — 프론트엔드 누락 인증 헤더 일괄 수정 (v7.47 후속 패치)

**수정 (HIGH — index.html 57개 fetch 호출):**

v7.47에서 서버 write endpoint에 requireAuth를 추가한 후 프론트엔드 호출이 Authorization 헤더 없이 요청을 보내 로그인 유저도 401을 받는 회귀 버그 수정.

- `index.html` — 50개 단일라인 `method:'POST',headers:{'Content-Type':'application/json'}` → `headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders())` 일괄 교체 (Python 스크립트 /api/auth/* 제외)
- `index.html` — governor tax-rate PUT, governor policy PUT, governor commander/bounty POST auth 헤더 추가
- `index.html` — `/api/upload` POST + `/api/claim/:id/image` PUT의 구 `localStorage.getItem('jwt')` 키를 `getAuthHeaders()`로 교체
- `index.html` — `/api/notifications/read`, `read-all`에 `getAuthHeaders()` 추가 (기존 x-wallet 헤더는 유지)
- `index.html` — `/api/bounty/post`, `/api/bounty/cancel` (3개 call site) auth 헤더 추가
- Arena `arenaAuthHeaders()` 함수 추가 + 10개 Cantina POST 적용 (v7.47 내 별도 커밋)

**영향 없는 호출 (의도적으로 미수정):**
- `/api/auth/login`, `/api/auth/find-email`, `/api/auth/reset-password`, `/api/auth/reset-password/verify` — 사전 인증 endpoint

## 2026-05-07 v7.47 — 37개 라우트 파일 JWT 인증 일괄 적용 (CRITICAL 보안 패치)

**수정 (CRITICAL / HIGH — 37개 라우트 파일, 70+ 엔드포인트):**

기존 `req.body.wallet` / `req.headers['x-wallet']` 신뢰 취약점을 전체 해소.
모든 파일에 표준 `requireAuth` JWT 미들웨어 + `getAuthWallet(req)` 패턴 적용.

- `profile.js` — `/profile/nickname`, `/avatar-color`, `/motto`
- `rental.js` — `/rental/list`, `/rent`, `/cancel`
- `staking.js` — `/staking/stake`, `/withdraw`
- `shield.js` — `/shield/activate`
- `tombstone.js` — `/tombstone/place`
- `wager.js` — `/wager/bet`
- `branding.js` — `/branding/name`, `/tagline`, `/color`, `/clear` (GP 소각)
- `graffiti.js` — `/graffiti/place`
- `spells.js` — `/spells/cast` (GP 소각)
- `rating.js` — `/rating/rate`
- `duel.js` — `/duels/challenge`, `/accept`, `/decline`, `/cancel` (GP 에스크로)
- `contest.js` — `/contests/submit`, `/vote`
- `tevt.js` — `/tevt/activate`
- `alliance.js` — `/alliances/create`, `/join`, `/leave`, `/deposit`, `/withdraw` (GP 소각)
- `raffle.js` — `/raffles/buy` (GP 소각)
- `crafting.js` — `/crafting/craft` (GP + 재료 소각)
- `expedition.js` — `/expeditions/launch`, `/cancel` (GP 소각)
- `tiers.js` — `/tiers/upgrade` (GP 소각)
- `tribute.js` — `/tribute/send` (GP 소각)
- `capsule.js` — `/capsule/bury` (GP 소각)
- `sponsor.js` — `/sponsor/place` (GP 소각)
- `donation.js` — `/donation/donate` (GP 소각)
- `beacon.js` — `/beacons/place` (GP 소각)
- `claimUpgrades.js` — `/upgrades/upgrade` (GP 소각, writeLimiter 유지)
- `tournaments.js` — `/tournaments/join` (GP 참가비)
- `polls.js` — `/polls/create`, `/vote`
- `banner.js` — `/banner/plant`
- `broadcasts.js` — `/broadcasts/create` (GP 소각)
- `highlight.js` — `/highlight/set` (GP 소각)
- `journal.js` — `/journal/publish`
- `milestone.js` — `/milestone/record`
- `monuments.js` — `/monuments/place`, `/preserve` (GP 소각)
- `status.js` — `/status/set`, `/clear`
- `tdesc.js` — `/tdesc/set` (GP 소각)
- `vtag.js` — `/vtag/set`, `/clear`
- `announcement.js` — `/announce/post`
- `governance.js` — `/sector/:id/tax-rate`, `/buff`, `/announcement`, `/commander/event`, `/announcement`, `/bounty` (GP 소각)
- `arena.js` — `/crash/bet`, `/cashout`, `/mines/start`, `/reveal`, `/cashout`, `/coinflip/play`, `/dice/play`, `/hilo/start`, `/guess`, `/cashout` (PP/USDT 소각 — Cantina 게임)

---

## 2026-05-07 v7.46 — api.js 전체 write 엔드포인트 JWT 인증 일괄 적용

**수정 (CRITICAL / HIGH — 60+ 엔드포인트):**
- `POST /withdraw-all`: body wallet → `requireAuth` (CRITICAL — USDT 전액 인출 취약점)
- `POST /swap`: body wallet → `requireAuth` (PP→USDT 스왑)
- `POST /exchange/pp-to-gp`: body wallet → `requireAuth` (PP→GP 교환)
- `POST /gp/transfer`: body/header wallet → `requireAuth` (GP 이체)
- `POST /shop/buy`, `/shop/use`, `/shop/auto-renew`: body wallet → `requireAuth`
- `POST /enhance`: body wallet → `requireAuth`
- `POST /claim`: body wallet → `requireAuth` (영토 클레임)
- `POST /hijack/declare-with-pp`: body wallet → `requireAuth`
- `PUT /claim/:id/image`: body wallet → `requireAuth`
- `POST /territory/merge`, `/territory/:claimId/upgrade`: body/header wallet → `requireAuth`
- `POST /claims/:id/rename`: body wallet → `requireAuth`
- `POST /campaign/start,/choice,/progress,/complete,/reward/claim,/abandon`: body wallet → `requireAuth`
- `POST /quests/:id/progress,/claim,/track`: body wallet → `requireAuth`
- `POST /season/claim,/share,/taps,/pass/purchase,/pass/claim`: body wallet → `requireAuth`
- `POST /guild/create,/invite,/invite/accept,/invite/decline,/join-request`: body wallet → `requireAuth`
- `POST /guild/request/approve,/reject,/leave,/kick,/promote,/demote,/transfer`: body wallet → `requireAuth`
- `POST /guild/update,/disband,/chat,/contribution,/levelup,/donate,/research`: body wallet → `requireAuth`
- `POST /guild/war/declare,/auto-win,/score,/continue`: body wallet → `requireAuth`
- `POST /missions/launch,/:id/claim,/:id/cancel`: body wallet → `requireAuth`
- `POST /items/materialize,/dematerialize`: body wallet → `requireAuth`
- `POST /exploration/discover,/hint`: body wallet → `requireAuth`
- `POST /rockets/trigger,/claim-loot,/priority`: body wallet → `requireAuth`
- `POST /cosmetic/equip,/unequip`: body wallet → `requireAuth`
- `POST /daily/login,/missions/:id/claim`: body wallet → `requireAuth`
- `POST /notifications/read,/read-all`: body/header wallet → `requireAuth`
- `POST /user/titles/equip`: body wallet → `requireAuth`
- `POST /tags/set-active-title`: body wallet → `requireAuth`

---

## 2026-05-07 v7.45 — harvest 3개 엔드포인트 JWT 인증 + api.js requireAuth 추가

**수정 (HIGH):**
- `server/routes/api.js` `POST /harvest`, `/territory/:claimId/harvest`, `/harvest-instant`: body wallet → `requireAuth` JWT. `/harvest-instant`는 body wallet으로 타인 PP 소각 가능한 치명적 취약점 차단.
- `server/routes/api.js`에 JWT `requireAuth` 미들웨어 추가 (공통 사용 가능).

---

## 2026-05-07 v7.44 — 8개 라우트 JWT 인증 추가

**수정 (HIGH):**
- `server/routes/auction.js` `POST /auction/create,/bid,/buyout,/cancel`: body wallet → `requireAuth` JWT
- `server/routes/bounty.js` `POST /post,/claim,/cancel/:id`: body wallet → `requireAuth` JWT
- `server/routes/dailyOps.js` `POST /progress,/claim`: body wallet → `requireAuth` JWT
- `server/routes/job.js` `POST /user/job`: body wallet → `requireAuth` JWT
- `server/routes/lottery.js` `POST /lottery/buy`: body wallet → `requireAuth` JWT
- `server/routes/resourceCraft.js` `POST /start,/:id/claim,/:id/cancel`: JWT fallback 제거, `requireAuth` 강제
- `server/routes/territoryIdentity.js` `PATCH /:claimId/identity`: body wallet → `requireAuth` JWT
- `server/routes/worldEvents.js` `POST /world-events/:id/engage`: JWT fallback 제거, `requireAuth` 강제

---

## 2026-05-07 v7.43 — 11개 서비스 rowCount 누락 수정

**수정 (MEDIUM — FOR UPDATE 후 rowCount 미검사):**
- `server/services/milestone.js` `createMilestone()`: rowCount guard 추가
- `server/services/enhancement.js` `enhanceItem()`: rowCount guard 추가
- `server/services/faction.js` `changeFaction()`: rowCount guard 추가
- `server/services/vtag.js` `setVtag()` + `clearVtag()`: rowCount guard 2개 추가
- `server/services/monuments.js` `createMonument()` + `preserveMonument()`: rowCount guard 2개 추가
- `server/services/broadcasts.js` `createBroadcast()`: rowCount guard 추가
- `server/services/tournaments.js` `enterTournament()`: rowCount guard 추가
- `server/services/titleExtended.js` `equipTitleExtended()`: rowCount guard 추가
- `server/services/title.js` `equipTitle()`: rowCount guard + ROLLBACK 추가

---

## 2026-05-07 v7.42 — auto-win TOCTOU + 닉네임 TOCTOU + auction 커넥션 수정

**수정 (HIGH):**
- `server/routes/api.js` `/guild/war/auto-win`: 쿨다운 체크(SELECT)와 포인트 INSERT가 별도 `pool.query()` → 동시 요청 2개가 쿨다운을 통과 후 이중 포인트 지급 가능. 전체 로직을 단일 트랜잭션으로 묶고 `guild_wars FOR UPDATE`로 직렬화.

**수정 (MEDIUM):**
- `server/services/profile.js` `_changeField()`: `setNickname()`의 닉네임 중복 체크가 트랜잭션 외부(pool.query) → 동시 2개 요청이 같은 닉네임 선점 가능. 유일성 체크를 `_changeField()` 트랜잭션 내부로 이동.
- `server/services/auction.js` `buyout()` + `settleExpired()`: `COMMIT` 후 이미 사용된 transaction `client`로 `creditReferralCommission()` 호출 → pool에서 fresh connection(`rc`) 획득 후 커미션 처리로 변경.

---

## 2026-05-07 v7.41 — transport/vip JWT 인증 + auction/donate rowCount 수정

**수정 (HIGH):**
- `server/routes/transport.js` `POST /transport/start`, `/raid`, `/cancel`: wallet body/header fallback → 타인 wallet으로 화물 시작/레이드/취소(GP 환불 포함) 가능. `requireAuth` JWT 미들웨어 추가, wallet 토큰에서 추출.
- `server/routes/vip.js` `POST /vip/purchase`: 동일 — JWT 없이 타인 wallet으로 VIP 구매 GP 소각 가능. `requireAuth` 추가.
- `server/services/auction.js` `createAuction()` + `placeBid()`: GP deduct UPDATE rowCount 미검사 → 리스팅비/입찰금 미차감 후 경매 진행 가능. rowCount === 0 → INSUFFICIENT_GP ROLLBACK 추가.
- `server/routes/api.js` `/guild/donate`: GP deduct rowCount 미검사 → GP 미차감 후 treasury 증가 가능. rowCount guard 추가.

**잔여 알려진 이슈 (다음 이터레이션):**
- `api.js /guild/war/auto-win` 쿨다운 체크 TOCTOU (포인트 이중 지급, GP 없음) — medium priority
- `profile.js setNickname()` 닉네임 중복 체크 TOCTOU — DB unique constraint로 해결 필요
- `auction.js creditReferralCommission` post-COMMIT released client — 커미션 신뢰성 문제

---

## 2026-05-07 v7.40 — commanderActions/marketplace JWT 인증 + battleRewards FOR UPDATE

**수정 (HIGH):**
- `server/routes/commanderActions.js` `POST /battles/:id/commander-action`: wallet body/header fallback 허용 → JWT 없이 타인 wallet으로 commander action GP 소각 가능. `requireAuth` 미들웨어 추가, `body.wallet`/`x-wallet` fallback 제거.
- `server/routes/marketplace.js` `POST /list`, `POST /cancel`, `POST /buy`: wallet body에서 신뢰 (JWT 없음) → 타인 wallet으로 리스팅 취소/구매 조작 가능. `requireAuth` JWT 추가, wallet 토큰에서 추출.
- `server/services/battleRewards.js` `distributeMinimalRewards()`: `fleet_battles` FOR UPDATE 없이 idempotency check → 동시 2개 호출이 둘 다 기존 보상 없음으로 판정 후 이중 지급. `SELECT id FROM fleet_battles WHERE id=$1 FOR UPDATE`를 BEGIN 직후에 추가.

**감사 완료 (버그 없음):**
- fleets.js — requireAuth + JWT wallet 정상
- lottery.js buyTickets — FOR UPDATE 있어 ticket 번호 충돌 방지됨 (fragile but safe)
- tprestige.js ownership check — LOW (이미 prestige row FOR UPDATE + service-level 체크로 완화)
- aiFleetManager.js, battleEngine.js, claimUpgrades.js — 정상

---

## 2026-05-07 v7.39 — worldEvents 이중 정산 + rocket rowCount + siege 인증 누락 + warBetting 정보 유출

**수정 (HIGH):**
- `server/services/worldEvents.js` `settleExpiredEvents()`: 만료 이벤트 목록 SELECT 후 별도 UPDATE → 동시 스케줄러 2개가 동일 이벤트 처리 → `distributeRewards` 이중 호출 가능. CAS `UPDATE ... WHERE id=$1 AND status IN ('active','engaged')` + `rowCount===0` → continue 추가.
- `server/services/rocket.js` `claimRocketLoot()`: quest_reward_pool deduct UPDATE rowCount 미검사 → 풀에서 차감 실패 시에도 PP가 유저에게 지급됨. `rowCount===0` 시 콘솔 경고 후 직접 민팅 경로로 이동 (reward 변수 업데이트 조건화).
- `server/routes/siege.js` `POST /siege/declare`, `POST /governor/declaration`, `PUT /governor/tax-rate`, `PUT /governor/policy`: wallet을 body에서 신뢰 (JWT 없음) → 타인 지갑으로 siege 선언/세율 변경/정책 변경 가능. `requireAuth` JWT 미들웨어 추가, wallet은 토큰에서 추출.

**수정 (MEDIUM):**
- `server/routes/warBettingRoutes.js` `GET /betting/mine`: JWT 실패 시 `?wallet=` query param 폴백 → 누구나 임의 지갑의 베팅 내역 조회 가능. 폴백 제거, JWT 필수화.

**감사 완료 (버그 없음):**
- spells.js, shield.js — FOR UPDATE + rowCount 정상
- rocket.js autoScheduleRocket — MEDIUM (스케줄러 중복 INSERT), 이중 이벤트는 서버 재시작 시에만 발생하고 6h 최근 체크로 억제. 향후 advisory lock으로 개선 가능.

---

## 2026-05-07 v7.38 — guild war 이중 정산·createGuild TOCTOU + crafting/announcement/donation/branding rowCount/FOR UPDATE

**수정 (HIGH):**
- `server/services/guild.js` `resolveExpiredWars()`: 전쟁 행을 트랜잭션 밖에서 일괄 SELECT → 동시 스케줄러 2개가 동일 war를 처리해 treasury 이중 지급 가능. 루프 내부 BEGIN 후 `SELECT ... WHERE id=$1 AND status='active' FOR UPDATE` CAS 재조회 추가 — 이미 처리된 war는 ROLLBACK+continue.
- `server/services/crafting.js` `craftItem()`: GP deduct UPDATE rowCount 미검사 → GP 미차감 후 아이템 지급 가능. `rowCount === 0` → `INSUFFICIENT_GP` throw 추가.
- `server/services/announcement.js` `postAnnouncement()`: 동일 — rowCount guard 추가.
- `server/services/donation.js` `donate()`: 동일 — rowCount guard 추가.

**수정 (MEDIUM):**
- `server/services/guild.js` `createGuild()`: guild_id 멤버십 체크를 별도 plain SELECT로 확인 후 FOR UPDATE → TOCTOU — 동시 acceptInvite가 guild_id를 바꿔 2개 길드 동시 멤버십 가능. 단일 `SELECT guild_id, gp_balance ... FOR UPDATE` 쿼리로 통합. GP deduct rowCount guard도 추가.
- `server/services/branding.js` `_setBrandingField()`: 영토 ownership check가 `FOR UPDATE` 없음 → 동시 territory transfer 후에도 이전 소유자가 브랜딩 가능. `SELECT owner FROM claims WHERE id=$1 FOR UPDATE`로 변경.

**감사 완료 (버그 없음):**
- transport.js, sponsor.js, capsule.js — FOR UPDATE + rowCount 정상
- beacon.js, contest.js, announcement.js (잔여 조회) — 정상
- wager.js autoLockExpired — 이중 UPDATE가 idempotent (LOW, 무시)

---

## 2026-05-07 v7.37 — maintenance 이중 실행 + season 동시 생성 + phaseCScheduler CAS + exploration rowCount

**수정 (CRITICAL):**
- `server/services/maintenance.js` `processMaintenanceFees()`: 주간 타임스탬프 체크가 비원자적 → 동시 스케줄러 2개가 둘 다 체크를 통과해 유저에게 이중 유지비/영토 포기 적용 가능. `pg_try_advisory_lock(ADVISORY_LOCK_KEY)` 추가 — 락 획득 실패 시 `concurrent_run`으로 즉시 반환. 타임스탬프 재조회를 락 획득 후로 이동.
- `server/services/maintenance.js` `processMaintenanceFees()`: 영토 포기 시 `owner = 'abandoned'` (리터럴 문자열) → `owner = NULL`로 수정. 문자열 'abandoned'는 `claims.owner`가 `users.wallet_address`를 참조하는 FK 컬럼 의미상 잘못된 값. `deleted_at`만으로 soft-delete 신호 전달.

**수정 (경쟁 조건):**
- `server/services/phaseCScheduler.js` 마감 토너먼트 `registering→ready` 전환: `SELECT + UPDATE` 분리 비원자적 → 동시 2개 스케줄러가 동일 행 중복 전환 가능. 단일 `UPDATE ... WHERE status='registering' ... RETURNING id`로 CAS 원자화.
- `server/services/exploration.js` `discoverPOI()` 탐색비 PP 차감: `FOR UPDATE` 락 후 deduct UPDATE의 `rowCount` 미검사 → 엣지 케이스에서 차감 실패 무시 가능. `rowCount === 0` 시 ROLLBACK + error 반환 추가.
- `server/services/season.js` `autoRotateSeason()` 신규 시즌 INSERT: 동시 2개 스케줄러가 "활성 시즌 없음" 체크 통과 → 2개 시즌 동시 생성 가능. `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE active=true)` 조건부 INSERT로 변경. `rowCount===0` 시 silent skip.

---

## 2026-05-07 v7.36 — prestige/tprestige 인증 추가 + daily 트랜잭션 + prestige rowCount 수정

**수정 (보안):**
- `server/routes/prestige.js` `POST /prestige/buy`: `requireAuth` 미들웨어 없음 — 누구나 임의 지갑의 GP를 소각 가능. JWT `requireAuth` 추가, wallet은 토큰에서 추출 (body.wallet 신뢰 안 함).
- `server/routes/tprestige.js` `POST /tprestige/upgrade`: 동일 문제 — `requireAuth` 추가, wallet 토큰 추출.

**수정 (데이터 정합):**
- `server/services/daily.js` `recordDailyLogin()`: 로그인 INSERT + GP 지급 + 마일스톤 GP 지급이 별도 `pool.query` 3개로 트랜잭션 없이 실행됨 → 서버 크래시 시 부분 지급 가능. BEGIN/COMMIT 단일 트랜잭션으로 통합.
- `server/services/prestige.js` `buyPrestige()`: GP deduct UPDATE rowCount 미검사 → `INSUFFICIENT_GP` throw 추가.

---

## 2026-05-07 v7.35 — enhancement/marketplace/governance FOR UPDATE 경쟁 수정

**수정:**
- `server/services/enhancement.js` `enhanceItem()`: `item_instances` 조회에 `FOR UPDATE OF ii` 누락 → 동시 강화 2회 요청이 둘 다 레벨 올릴 수 있는 경쟁 가능 → `FOR UPDATE OF ii` 추가.
- `server/services/marketplace.js` `cancelListing()`: 리스팅 조회에 `FOR UPDATE` 누락 → 동시 취소 2개 요청이 에스크로(광물/클레임/아이템)를 이중 반환 가능 → `FOR UPDATE` 추가.
- `server/services/governance.js` `recalculateGovernor()` vice_governor GP 이전 SELECT — `FOR UPDATE` 누락 → 동시 거버넌스 재계산 시 이중 이전 가능 → `FOR UPDATE` 추가.
- `server/services/governance.js` `recalculateCommander()` vice_commander GP 이전 SELECT — 동일 수정.

**감사 완료 (버그 없음):**
- lottery.js — FOR UPDATE + rowCount 패턴 정상.
- staking.js — FOR UPDATE + rowCount 패턴 정상. withdrawStake FOR UPDATE + status 체크 정상.
- dividends.js — distributeLastWeek FOR UPDATE + ON CONFLICT DO NOTHING 정상.
- marketplace.js buyListing — FOR UPDATE 정상, 동시 구매 경쟁 차단됨.
- enhancement.js GP deduction — FOR UPDATE + AND balance>= + rowCount 정상.
- achievement.js — ON CONFLICT (wallet, achievement_key) DO NOTHING RETURNING 정상.

---

## 2026-05-07 v7.34 — harvest 첫 수확 경쟁 + SHIP_IN_BATTLE 검사 우회 수정

**수정:**
- `server/routes/api.js` `POST /harvest`: 신규 유저(user_mining 행 없음) 대상 `FOR UPDATE`가 행이 없어 락 미동작 → 동시 2개 요청이 모두 쿨다운 체크 통과해 이중 수확 가능. 쿨다운 SELECT 전에 `INSERT INTO user_mining … ON CONFLICT DO NOTHING` 센티넬 INSERT 추가 → 항상 실제 행에 FOR UPDATE 락 적용.
- `server/services/ship.js` `upgradeShipStat()` SHIP_IN_BATTLE 체크: `try/catch`가 `e.message === 'SHIP_IN_BATTLE'`만 re-throw하고 나머지 DB 오류는 삼킴 → 전투 체크 쿼리가 실패해도 업그레이드 진행 가능. `try/catch` 제거하고 쿼리 오류를 정상 전파하도록 수정.

---

## 2026-05-07 v7.33 — shield 충전 crash 수정 + worldEvents 쿨다운 경쟁 + siege 락 + 스케줄러 admin gate

**수정:**
- `server/services/ship.js` `chargeShield()`: `const chargeUnits` 재할당으로 `TypeError: Assignment to constant variable` crash 발생 → `actualUnits` 변수로 분리. 요청량이 여유 용량 초과 시 크래시 대신 클램핑 처리.
- `server/services/worldEvents.js` `engageEvent()`: 쿨다운 SELECT에 `FOR UPDATE` 누락 → 동시 요청 2개가 쿨다운 체크를 동시에 통과해 동일 이벤트 2회 참가 가능 → `FOR UPDATE` 추가.
- `server/services/siege.js` `declareSiege()`: `FOR UPDATE OF sg` (LEFT JOIN 결과가 NULL인 미거버너 섹터에서 락 없음) → `FOR UPDATE OF sd` (sector_definitions는 항상 존재)로 변경. 동시 2회 siege 선언 경쟁 차단.
- `server/routes/ships.js` `POST /process-completed`: `requireAuth` (일반 유저도 접근 가능) → `requireAdmin` (어드민 시크릿 필수)으로 변경. 스케줄러급 일괄 처리 엔드포인트를 일반 유저에게 노출하지 않음.

---

## 2026-05-07 v7.32 — 함대전 치명 버그 4건 수정 + 캠페인 안전성 강화

**수정:**
- `server/routes/fleetBattles.js` `POST /:id/forfeit`: `status='preparing'` 포기 시 `fleets.is_in_battle` 해제 누락 → 양측 함대 영구 잠금 버그 수정. BEGIN/COMMIT 트랜잭션 안에서 fleet_battle_participants → fleet_id 조회 후 `UPDATE fleets SET is_in_battle=false` 추가.
- `server/routes/fleetBattles.js` `POST /:id/run`: `SELECT 1 FROM fleet_battle_participants` (참가자 여부만 확인)를 `SELECT side` (공격자 확인)로 변경. 방어자가 유리한 시점에 강제 시뮬 시작하는 게임플레이 악용 차단 (`ONLY_ATTACKER_CAN_RUN`).
- `server/services/battleRewards.js` `distributeMinimalRewards()`: 무승부 보상 중복 방지 idempotency guard 추가 — `fleet_battle_rewards` 기존 행 존재 시 즉시 ROLLBACK 반환.
- `server/services/campaign.js` `complete()`: 최종 `UPDATE player_campaign_progress WHERE status='in_progress'` rowCount 미검사 → `if (updated.rowCount === 0)` ROLLBACK + `SESSION_NOT_FOUND` 에러 추가. 동시 호출/abandon 경쟁 시 보상 중복 지급 방지.
- `server/services/campaign.js` campaign_reward_inbox INSERT에 `ON CONFLICT DO NOTHING` 추가 — 리트라이/재시도 시 inbox 중복 행 생성 방지.

---

## 2026-05-07 v7.31 — 28개 write 엔드포인트 rate limiter 추가 + rowCount 누락 2건 수정 + expedition 트랜잭션 수정

**수정:**
- `server/index.js`: `apiWriteLimiter`(60req/min, GET/HEAD/OPTIONS skip) 추가 → `app.use('/api', apiWriteLimiter)`로 모든 API write 엔드포인트에 일괄 적용. 28개 라우트 파일의 GP 소각 write 엔드포인트가 globalLimiter(3000/15min)만 적용된 격차를 해소.
- `server/services/raffle.js`: `buyTickets()` GP deduct UPDATE rowCount 체크 누락 → `if (deductRes.rowCount === 0) throw new Error('INSUFFICIENT_GP')` 추가.
- `server/services/tdesc.js`: `setDescription()` GP deduct UPDATE rowCount 체크 누락 → 동일 패턴으로 추가.
- `server/services/expedition.js`: `cancelExpedition()` 취소 처리 2개 쿼리(status UPDATE + refund credit)가 트랜잭션 없이 별도 `pool.query`로 실행됨 → `BEGIN/COMMIT/ROLLBACK` 트랜잭션으로 감쌈.

**감사 완료 (버그 없음):**
- adminEconomyRoutes.js P5 territory/upgrades, territory/sector-control, territory/production-profile 엔드포인트 → 모두 requireAdmin + allowedKeys 화이트리스트 정상.
- 28개 루트 파일 SQL 인젝션 전수 검사 → 실제 사용자 입력이 SQL에 직접 삽입되는 사례 0건.
- 28개 루트 파일 /admin/ 경로 인증 검사 → admin.js (adminAuth 미들웨어) 별도 마운트로 모두 보호됨.
- 14개 서비스 파일 GP rowCount/FOR UPDATE 패턴 전수 검사 → raffle/tdesc 2건 제외 모두 정상.

---

## 2026-05-07 v7.30 — 기능 감사 완료 + claimUpgrades rate limiter 추가

**기능 감사 (버그 없음):**
- harvest/mining 트랜잭션, P5-2 자원 드롭, P5-5 섹터 컨트롤, declare-pvp, crafting, vip 모두 정상.
- 9개 핵심 서버 파일 `node --check` 통과. 필요 라우트 파일 전부 존재 확인.

**수정:**
- `server/routes/claimUpgrades.js` POST /upgrades/upgrade writeLimiter(30req/min) 추가. 기존에는 globalLimiter(3000req/15min)만 적용됐음.

---

## 2026-05-07 v7.29 — admin 엔드포인트 인증 누락 6건 + SQL 인젝션 1건 수정

**발견 및 수정:**

- **server/routes/siege.js**
  - `GET /admin/sieges`: `requireAdmin` 누락 → 추가
  - `POST /admin/sieges/:id/resolve`: `requireAdmin` 누락 → 추가
  - `GET /admin/sieges`의 `status` 쿼리 파라미터 SQL 직접 삽입 → 화이트리스트(`ALLOWED_STATUSES`) + 파라미터화(`$2`)로 수정
- **server/routes/resource.js**: `GET /admin/resources`, `PUT /admin/resource-rate` — `requireAdmin` 추가
- **server/routes/job.js**: `GET /admin/jobs`, `PUT /admin/job-buff` — `requireAdmin` 추가
- **server/routes/sectors.js**: `GET /admin/sector-defs` — `requireAdmin` 추가

**검증:** `node --check` 전부 통과. 커밋 a2e0006.

**추가 감사 결과 (버그 없음):**
- `declare-pvp` 트랜잭션 내 `FOR UPDATE` 이중 체크 확인
- worldEvents.js engage 플로우 정상
- P5-5 sector control 쿼리 정상
- alliance.js rowCount + FOR UPDATE 기존 적용 확인

---

## 2026-05-07 v7.28 — 전체 코드베이스 버그 감사 완료 (shipScheduler + SQL 정합성)

**감사 완료 항목**:
- `processCompletedJobs()` (ship.js line 566): per-job try/catch 격리 확인, 이중처리 없음 (`WHERE status = 'building'` 원자 claim).
- `cancelBuildJob()` (ship.js line 592): `FOR UPDATE` + 상태 체크 + 환불 트랜잭션 정상.
- SQL 인젝션 스캔: `${balCol}` (arena.js/api.js/marketplace.js) — 모두 코드 내 상수에서 유도됨. `${setClause}` (territoryIdentity.js, admin.js) — hardcoded 키 배열에서 구성됨. 외부 입력 삽입 경로 없음.
- `FOR UPDATE` + 명시적 잔액 체크 패턴 확인: announcement, donation, milestone, monuments, faction, raffle, prestige, tdesc, vtag, tournaments, title, titleExtended, season — 모두 동일한 안전 패턴. rowCount 생략은 `FOR UPDATE` 락이 보장하므로 문제 없음.
- P5 업그레이드 statusMap: `'P5 territory upgrades are currently disabled'` → 400 반환 (의도적, 기능 비활성화는 클라이언트 에러).
- `territory_upgrades` 스키마 확인: `updated_at` 컬럼 존재 (migration 180). 머지 코드(api.js:5638)의 동적 컬럼 감지도 `updated_at` 우선 처리로 정합.
- battleRewards.js: GP 지급만 있고 차감 없음. rowCount 불필요.
- arena.js: crash/mines/coinflip/dice/hilo 모두 rowCount 가드 존재 확인.
- guild/donate (api.js:6836): `FOR UPDATE` + 명시적 잔액 체크로 안전. wallet_address 대소문자 경로 경미한 불일치 존재하나 `w`가 이미 소문자이므로 실 영향 없음.

**결론**: 전체 코드베이스 rowCount/TOCTOU 스윕 완료. SQL 인젝션 경로 없음. 잔액 차감 원자성 보장됨. 새로 발견된 크리티컬 버그 없음.

---

## 2026-05-07 v7.27 — P5 영토 업그레이드 버그 3종 수정

**server/services/claimUpgrades.js**:
- `upgraded_at` → `updated_at`: territory_upgrades 테이블 실제 컬럼명. 이 버그로 모든 업그레이드 시도가 PostgreSQL `42703` 에러로 실패했음.
- P5 활성화 게이트 추가: P5 트랙(effect 필드가 있는 타입)은 `cfg.p5Enabled = false`일 때 차단됨.
- P5 maxLevel 분리: 카탈로그 + upgradeTerritory 모두 P5 트랙에 `cfg.p5MaxLevel`, 클래식 트랙에 `cfg.maxLevel` 사용.
- UPDATE 쿼리 $2 파라미터 정리: wallet이 $2로 전달됐으나 WHERE 절에 미사용 — $2 제거.
- 검증: `getUpgradeCatalog()` 9개 트랙, P5 5개 maxLevel=5, extractor 비용 `[50,150,350,800,2000]` 정상 파싱 확인.

---

## 2026-05-07 v7.26 — 서비스 전체 rowCount 스윕 완료 (38파일)

**rowCount 가드 전체 서비스 적용 완료.** 모든 `AND gp_balance >= $N` / `AND pp_balance >= $N` guarded UPDATE에 `rowCount === 0` 검사 추가:

**server/services/** (Codex 35파일): alliance, banner, beacon, branding, capsule, contest, duel, expedition, graffiti, highlight, hijack, job, journal, lottery, maintenance, polls, profile, rating, rental, shield, siege, spells, sponsor, staking, status, tevt, tiers, tombstone, tournament, tprestige, transport, tribute, vip, wager, warBetting.

**server/routes/governance.js** — governance_positions 차감 3곳 rowCount 추가.
**server/routes/bounty.js** — 현상금 등록 GP 차감 rowCount 추가.
**server/services/enhancement.js** — blessed_scroll/protect_scroll 소모 rowCount 추가 (`BLESSED_SCROLL_UNAVAILABLE` / `PROTECT_SCROLL_UNAVAILABLE`).

모든 38파일 `node --check` 통과. 로직 변경 없음 — 경쟁 조건 시 silent no-op이 명시적 에러로 표면화됨.

---

## 2026-05-07 v7.25 — api.js TOCTOU 12종 + ship.js rowCount 5종 완료

**server/routes/api.js** (Codex) — 12개 엔드포인트 guarded UPDATE 이후 `rowCount === 0` 누락 수정:
- `/claim` · `/swap` · `/shop/buy` · `/cosmetic/equip` · `/harvest-instant` · `/claims/:id/rename`
- `/exploration/hint` · `/rockets/priority` · `/exchange/pp-to-gp` · `/gp/transfer`
- `/harvest` guild contribution · `/guild/war/continue` (GP·PP 두 경로 모두)

모든 위치에 `SELECT ... FOR UPDATE`는 이미 존재했음. 누락된 것은 `deductXxx.rowCount === 0` 시 ROLLBACK + 400 응답 뿐이었음. 이제 완전한 원자적 잔액 차감 보장.

**server/services/ship.js** — 5개 GP 차감 위치 rowCount 검사 추가:
- `startBuild()` (line ~304): `deductBuild.rowCount === 0` → `INSUFFICIENT_GP`
- `repairShip()` (line ~850): `deductRepair.rowCount === 0` → `INSUFFICIENT_GP`
- `chargeShield()` (line ~971): `deductShield.rowCount === 0` → `INSUFFICIENT_GP`
- `upgradeShipStat()` (line ~1251): `deductUpgradeStat.rowCount === 0` → `INSUFFICIENT_GP`
- `buyShipListing()` (line ~1556): `deductBuyListing.rowCount === 0` → `INSUFFICIENT_GP`

모두 FOR UPDATE 락은 이미 있었으나 silent failure 가능성이 있었음. 이제 잔액 경쟁 조건 시 정확한 에러 반환.

---

## 2026-05-07 v7.24 — Rate limiter 누락 엔드포인트 보강

**server/routes/api.js** — `writeLimiter` 누락 엔드포인트 4곳 추가:
- `POST /referral/register`: `ensureUser` 내부에서 wallet 값으로 신규 유저를 생성하므로 스팸 시 DB 블로트 가능. `writeLimiter` 추가.
- `POST /campaign/editor-layout`: 전역 `settings.campaign_editor_layout` 키를 덮어쓰는 공유 엔드포인트 — 스팸 방지.
- `POST /user/titles/equip`: 타이틀 장착 변경 요청 스팸 방지.
- `POST /error-report`: `client_errors` 테이블 INSERT 경로 — 스팸 방지.

---

## 2026-05-07 v7.23 — 캠페인 objective gate + 함선 건조 완료 원자성 수정 (Codex)

**server/services/campaign.js** — `getMissingRequiredObjectives()`: 기존에는 `stat` 필드가 있는 목표만 gate했음. `choice`-type 필수 목표(분기 선택을 아직 안 한 챕터)가 완료 조건으로 작동하지 않던 버그 수정. 이제 모든 non-optional, non-claim_result 목표가 `state !== 'done'`이면 완료를 막는다.

**server/services/ship.js** — `completeBuildJob()`: 함선 INSERT 전에 `UPDATE ship_build_jobs SET status = 'completed' WHERE id = $1 AND status = 'building'` 을 먼저 실행해 원자적으로 작업을 선점. rowCount=0이면 이미 다른 프로세스가 처리 중이므로 ROLLBACK + `already_completed` 반환. 기존에는 CRASH 재시도 시 ship이 중복 생성될 수 있었음. fleet 행 `FOR UPDATE` 락도 flagship 체크 전으로 앞당겨 동시 건조 완료 race condition 차단. `ship_type_code` null check 추가.

---

## 2026-05-07 v7.22 — TOCTOU 전체 스윕 완료 확인

전체 server/ 대상 최종 grep 스캔: 미보호 balance/quantity 차감 0건, SQL 인젝션 경로 0건, connection leak 0건. 추가 확인: bounty/dailyOps/shipScheduler/resourceCraft/battleRewards/fleetBattles 모두 클린.

---

## 2026-05-07 v7.21 — 길드 Treasury + attack_boost 가드 추가

**server/services/guild.js** — levelUp/startResearch/declareWar 3곳 `gp_treasury` 차감 UPDATE에 `AND gp_treasury >= $1` 가드 + rowCount 확인 추가.
**server/routes/api.js** — attack_boost `uses_remaining - 1` 에 `AND uses_remaining > 0` 가드 추가.

---

## 2026-05-07 v7.20 — Cantina 미니게임 TOCTOU 5종 수정

**server/routes/arena.js** — coinflip/dice/hilo: `SELECT balance FROM users` 에 `FOR UPDATE` 추가. mines/crash: `UPDATE users SET balCol = balCol - $1` 에 `AND ${balCol} >= $1` 가드 + rowCount 확인 추가. 5개 미니게임 베팅 경로 동시성 취약점 전부 해소.

---

## 2026-05-07 v7.19 — 시즌 패스 티어 보상 중복 수령 방어

**server/services/season.js** — `claimPassTier()`: `season_pass_claims` INSERT에 `ON CONFLICT DO NOTHING RETURNING id` 추가. rowCount=0이면 ROLLBACK + already claimed 반환. DB unique constraint (`season_id, wallet, tier, is_premium`)를 최후 방어선으로 활용.

---

## 2026-05-07 v7.18 — 일일 출석 동시 요청 이중 지급 수정

**server/services/daily.js** — `recordDailyLogin()`: `INSERT INTO daily_logins`에 `ON CONFLICT (wallet, login_date) DO NOTHING RETURNING id` 추가. rowCount=0이면 race condition으로 다른 요청이 이미 INSERT한 것이므로 alreadyClaimed 반환. 동시 출석 요청 시 unique violation 500 에러 + 이중 GP/PP credit 위험 완전 차단.

---

## 2026-05-07 v7.17 — quest_reward_pool 경쟁 조건 수정

**server/services/missions.js, exploration.js, rocket.js** — `quest_reward_pool` SELECT에 `FOR UPDATE` 추가, UPDATE에 `AND balance >= $1` 가드 추가. 동시 보상 지급 시 pool 잔액이 음수로 가는 경쟁 조건 수정 (3파일).

---

## 2026-05-07 v7.16 — 아이템/재료 소모 TOCTOU 6종 일괄 수정

- **server/routes/api.js** — `/shop/use`: 인벤토리 SELECT에 `FOR UPDATE` + UPDATE에 `AND quantity > 0` 가드 추가.
- **server/routes/api.js** — `/cosmetic/equip`: 코스메틱 quantity deduct에 `AND quantity > 0` 가드 + rowCount 확인 추가.
- **server/routes/governance.js** — buff/event/bounty: `governance_positions` gp_balance UPDATE 3곳에 `AND gp_balance >= $1` 가드 추가.
- **server/services/auction.js** — `createAuction`: resource escrow 차감에 `AND quantity >= $1` 가드 추가.
- **server/services/enhancement.js** — `materializeItem`: SELECT에 `FOR UPDATE`; blessed/protect scroll 소모 UPDATE에 `AND quantity > 0` 가드 추가 (3곳).
- **server/services/crafting.js** — 재료 차감: `AND quantity >= $1` 가드 + rowCount 확인 추가.
- **server/services/marketplace.js** — `createListing` resource escrow: `FOR UPDATE OF inv` + `AND quantity >= $1` 가드 추가.

---

## 2026-05-07 v7.15 — PVP 전투 선언 TOCTOU 수정

**server/routes/fleetBattles.js** — `declare-pvp`: fleet `is_in_battle` 체크를 트랜잭션 외부에서 수행하던 로직을 BEGIN 내부로 이동. `FOR UPDATE` 재확인으로 동시 선언 두 건이 같은 함대를 두 전투에 등록하는 경쟁 조건 수정. COMMIT 전 `is_in_battle = true` 마킹으로 원자성 보장.

---

## 2026-05-07 v7.14 — 샵 구매 잔액 체크 TOCTOU + negative-balance 수정

**server/routes/api.js** — `/shop/buy`: 잔액 SELECT에 `FOR UPDATE` 추가, UPDATE에 `AND ${balCol} >= $1` 가드 추가.
동시 구매 시 잔액 음수 진행 가능한 경쟁 조건 수정.

---

## 2026-05-07 v7.13 — 마켓플레이스 구매 TOCTOU 수정

**server/services/marketplace.js** — `buyListing()` 리스팅 SELECT에 `FOR UPDATE` 추가.
동시 구매 요청 두 건이 모두 `status='active'` 확인 후 진행 → 아이템 중복 지급 + 판매자 이중 크레딧 경쟁 조건 수정.

---

## 2026-05-07 v7.12 — 영토 수확 TOCTOU 경쟁 조건 수정

**server/routes/api.js** — territory harvest claims SELECT에 `FOR UPDATE OF c` 추가.
동시 수확 요청 두 건이 쿨다운 체크를 모두 통과해 이중 PP를 지급하는 경쟁 조건 수정.

---

## 2026-05-07 v7.11 — 일일 출석 cycleDay 수정 ("7일 중 8일차" 버그)

### 수정 내용
**server/routes/api.js** — `/api/daily/status` 응답에 `cycleDay` 필드 추가.
- `daily_streak_cycle` 기본값 14 → 7 (서비스 CYCLE=7과 일치)
- `cycleDay = ((rawStreak - 1) % maxDays + 1)`: streak=8, maxDays=7이면 cycleDay=1
- claimed/not-claimed 양쪽 분기 모두 반환

**index.html** — `renderInlineCheckin()` 및 `checkDailyLogin()` / `claimDailyLogin()`:
- `_dailyState.cycleDay` 저장 (d.cycleDay 또는 폴백 계산)
- 그리드 done/isToday/isFuture: raw `streak` → `cycleDay` 기준으로 변경
- period label: `streak` → `cycleDay` 기준으로 변경 (예: "7일 중 1일차")
- "N일 연속" 헤더는 raw `streak` 유지

---

## 2026-05-07 v7.03~v7.08 — 경쟁 조건 전체 sweep + 캠페인 SAVEPOINT 수정

### 핵심 수정 내용

**marketplace.js** — 판매자/거버너 tariff 지급 LOWER() 누락 수정 (listing.seller, tariffGovernor = DB값)
**db.js** — 레퍼럴 chain 잔액 크레딧 LOWER() 추가 (ref.wallet from DB)
**guild.js** — guild_id UPDATE 5곳 LOWER() 추가 (invited_wallet from DB)
**api.js** — shop 잔액 차감 LOWER() 추가
**aiFleetManager.js / admin.js** — faction_code UPDATE LOWER() 추가
**rank.js, season.js, db.js** — XP/rank_level UPDATE LOWER() 추가

**dividends.js** — CRITICAL 경쟁 조건: 스테이커 스냅샷을 트랜잭션 외부에서 수집 + INSERT ON CONFLICT DO NOTHING 후 GP 크레딧 무조건 실행 → 동시 호출 시 이중 지급. 수정: 락 후 스냅샷 재수집 + RETURNING id 가드.

**governance route (buff purchase)** — TOCTOU: BEGIN 이전에 buff 존재 확인 → 두 동시 요청 모두 통과 후 GP 이중 차감. 수정: BEGIN을 먼저, FOR UPDATE 후 재확인.

**governance service** — `recalculateGovernor()`: old gp_balance SELECT에 FOR UPDATE 없음; pixels.owner LOWER() 없이 sectors에 기록. `applyDailyMaintenance()`: governance_positions SELECT에 FOR UPDATE 없음. 모두 수정.

**fleet.js** — `createFleet()` / `deleteFleet()`: COUNT 기반 체크 전 user row FOR UPDATE 선취득 없음 → 최대 함대 수 초과 / 마지막 함대 삭제 경쟁 조건. 유저 row 락으로 직렬화.

**battleRewards.js** — "already rewarded" 체크가 트랜잭션 외부 → 동시 호출 시 전 참가자 GP/광물 이중 지급. fleet_battles FOR UPDATE + 트랜잭션 내부 재확인으로 수정.

**hijack.js** — `handlePhase1Complete()`: 전체 함수가 트랜잭션 없이 pool.query 3개 분리 → 크래시 시 이중 환불. `handlePhase2Complete()`: 초기 SELECT 트랜잭션 외부 → 동시 호출 시 픽셀 이전 이중 실행. 모두 BEGIN/COMMIT + FOR UPDATE + phase 가드로 수정.

**lottery.js (drawRound)** — FOR UPDATE 이후에도 스테일 `round` 스냅샷 변수 사용 (ticket_count, ticket_price_gp, prize_pool_gp, round_number). `lockRes.rows[0]` (`lockedRound`)로 교체.

**campaign.js** — `applyOptionalCampaignReward()`: ROLLBACK/RELEASE SAVEPOINT가 연결 수준 오류 시 throw → 전체 chapter completion 트랜잭션 중단. try/catch로 삼켜 외부 ROLLBACK에 위임. `complete()` 최종 UPDATE에 `AND status = 'in_progress'` 가드 추가. 중복 `displayNameEn` 키 제거.

---

## 2026-05-07 v7.02 — balance credit LOWER() 전체 서버 완전 정리 (18개 파일)

### 수정 대상 파일
`exploration.js`, `missions.js`, `onboarding.js`, `daily.js`, `duel.js`, `hijack.js`,
`lottery.js`, `achievements.js`, `rocket.js`, `tournament.js`, `dividends.js`,
`season.js`, `tournaments.js`, `chain.js`, `maintenance.js`, `db.js`, `auth.js`, `api.js`

### 수정 내용
- `SET *_balance = *_balance + $N WHERE wallet_address = $N` 패턴 전체 → `LOWER(wallet_address) = LOWER($N)` 변경
- 체인 USDT/PP 입금(chain.js), 시즌 보상(season.js), 복권 당첨(lottery.js), 업적 보상(achievements.js), 로켓 보상(rocket.js), 듀얼 정산(duel.js) 등 실제 GP/PP 지급 경로 모두 커버
- 서버 전체 grep 기준: 0건 잔여

---

## 2026-05-07 v7.01 — api.js + admin.js 핵심 크레딧 경로 LOWER() 수정

### server/routes/api.js
- 하이잭 피해자 PP 환불 (`affectedOwners` 키 = DB `pixels.owner`): LOWER() 추가
- 레퍼럴 PP 크레딧 (`ref.wallet` from DB): LOWER() 추가
- territory harvest PP 지급 x2: LOWER() 추가
- pp→gp 교환 GP 크레딧: LOWER() 추가
- GP 이체 수신자 조회(LOWER 없으면 checksum 지갑 not_found) + 크레딧: LOWER() 추가
- GP 이체 발신자 FOR UPDATE: LOWER() 추가
- hijack 실패 환불 PP: LOWER() 추가

### server/routes/admin.js
- gp/grant 엔드포인트: LOWER() 추가
- staking withdraw 판매자 지급: LOWER() 추가
- bounty cancel 환불: LOWER() 추가
- duel admin cancel challenger/defender 환불 x2: LOWER() 추가

---

## 2026-05-07 v7.00 — auction.js LOWER() 누락으로 인한 GP 소각 버그 수정

### server/services/auction.js — 핵심 GP 지급 경로 LOWER() 누락 수정

**버그**: `auction.current_bidder_wallet`, `auction.seller_wallet`은 DB에서 가져온 값으로 Ethereum 체크섬 주소(혼합 대소문자)일 수 있음.
해당 값을 `WHERE wallet_address = $2` (LOWER 없음)로 업데이트하면 0 rows matched → GP가 허공에 사라짐.

**영향 경로**:
- 입찰(bid): 이전 최고 입찰자 환불 (L224)
- 즉시구매(buyout): 이전 입찰자 환불 (L307) + 판매자 지급 (L314)
- 낙찰 정산(settle): 판매자 지급 (L430)

**수정**: 4곳 → `WHERE LOWER(wallet_address) = LOWER($2)` 변경
**추가**: SELECT FOR UPDATE 3곳 (L69, L212, L297)도 LOWER() 추가 (일관성)

---

## 2026-05-07 v6.99 — SELECT FOR UPDATE LOWER() 2차 일괄 수정 (15개 서비스)

### 서비스 (SELECT FOR UPDATE wallet_address → LOWER 추가)
`alliance.js`, `announcement.js`, `banner.js`, `exploration.js`, `faction.js`, `guild.js` (4곳),
`job.js`, `missions.js`, `onboarding.js`, `prestige.js`, `season.js`, `shield.js`,
`title.js`, `titleExtended.js`, `tribute.js`

이로써 서버 전체(services/) `SELECT ... FOR UPDATE` 유저 잔액/상태 쿼리에서
`WHERE wallet_address = $1` 패턴 없음. 모두 `LOWER(wallet_address) = LOWER($1)` 사용.

---

## 2026-05-07 v6.98 — SELECT FOR UPDATE LOWER() + 라우트 wallet 정규화 (16개 서비스)

### 공통 패턴 수정
- `SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE` 패턴이 혼합 대소문자 wallet에서 "User not found" 오류를 유발하는 문제 일괄 수정
- `WHERE wallet_address=$1 FOR UPDATE` → `WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`
- 각 라우트도 `wallet.toLowerCase().trim()` 정규화 추가 (서비스 호출 전)

### 서비스 (SELECT FOR UPDATE LOWER() 추가)
`beacon.js`, `capsule.js`, `sponsor.js`, `tdesc.js`, `tprestige.js`, `graffiti.js`, `journal.js`, `highlight.js`, `status.js`, `milestone.js`, `rating.js`, `tombstone.js`

### 라우트 (wallet 정규화 추가)
`beacon.js`, `capsule.js`, `polls.js`, `tprestige.js`, `tombstone.js`, `journal.js`, `graffiti.js`, `milestone.js`, `highlight.js`, `status.js`, `rating.js`

---

## 2026-05-07 v6.97 — exploration getSetting NaN + polls LOWER() 정규화

### server/services/exploration.js
- `discoverPOI` L229: `getSetting` 반환값이 JSONB 따옴표 포함 문자열(`'"0.5"'`)일 때 `parseFloat` → NaN → 탐사 수수료 무과금 버그 수정
- 수정: `parseFloat(String(...).replace(/^"|"$/g, ''))` — 외부 따옴표 제거 후 파싱

### server/services/polls.js + server/routes/polls.js
- `createPoll` SELECT FOR UPDATE: `WHERE wallet_address=$1` → `LOWER(wallet_address)=LOWER($1)`
- `createPoll` cooldown 조회: `WHERE wallet=$1` → `LOWER(wallet)=LOWER($1)`
- 라우트 `/polls` GET, `/polls/create` POST, `/polls/vote` POST: wallet 파라미터 `.toLowerCase().trim()` 정규화

---

## 2026-05-07 v6.96 — warBetting 환불 LOWER() + FOR UPDATE

### server/routes/warBettingRoutes.js
- admin cancel fallback 환불 루프 L257: `SELECT war_bets ... FOR UPDATE` 추가 (이중 환불 경쟁 방지)
- admin cancel fallback 환불 루프 L259: `WHERE wallet_address = $1` → `WHERE LOWER(wallet_address) = LOWER($1)` (혼합 대소문자 저장 wallet 환불 누락 방지)

---

## 2026-05-07 v6.92 — auto-renew 스케줄러 + ship/fleet FOR UPDATE + crafting LOWER()

### server/index.js (v6.92)
- Shield auto-renew 스케줄러: SELECT LOWER() + FOR UPDATE 이미 있음, UPDATE에 LOWER() + `AND pp_balance >= $1` guard 추가
- Effect auto-renew 스케줄러: 동일 패턴 수정

### server/services/ship.js (v6.90, Codex 14개 수정)
- `completeBuildJob`: LOWER(owner_wallet) + FOR UPDATE on fleet ownership read + flagship existence check
- `cancelBuildJob`: LOWER(wallet_address) on job ownership check
- `getOrCreateDefaultFleet`: LOWER(owner_wallet) + FOR UPDATE on fleet lookup
- `getFleetSummary`: LOWER() on all wallet comparisons
- `repairShip`: NaN/non-finite guard on targetHpPct
- `chargeShield`: NaN/non-finite guard on units
- `consumeShipUpgradeMaterial`: LOWER(wallet_address) on inventory deduction
- `getShipMarketListings`: NaN/non-finite guard on maxPrice
- `ensureFleetHasFlagship`: FOR UPDATE on flagship and candidate ship locks
- `cancelShipListing`, `buyShipListing`: FOR UPDATE OF sml, s (ship locked alongside listing)

### server/services/fleet.js (v6.90, Codex 4개 수정)
- `deleteFleet`: FOR UPDATE on alive ships + FOR UPDATE on target fleet
- `setFlagship`: FOR UPDATE on existing flagships before clearing
- `ensureFlagship`: FOR UPDATE on flagship/candidate selection

### server/services/crafting.js (v6.91)
- craftItem: SELECT + refund UPDATE wallet_address → LOWER()

### server/services/resourceCraft.js (v6.91)
- getMyJobs, startCraft (사용자 확인/재고 JOIN/재료 차감), claimJob, cancelJob: 모든 wallet_address → LOWER()

---

## 2026-05-07 v6.89 — api.js + 최종 잔액 가드 완성 (전체 완료)

### server/routes/api.js
- Codex: 13개 GP/PP 차감 경로 LOWER() + AND guard 추가. 잔액 SELECT에 FOR UPDATE 보강.
- Claude: usdt_balance 출금 L2088 — `AND usdt_balance >= $1` + LOWER() 추가.

**이 커밋 이후 서버 전체(services/ + routes/)에서 unguarded balance deduction 0건 확인.**

---

## 2026-05-07 v6.88 — guild/monuments/crafting/vip/faction/title/tribute/status/season/transport + bounty

### server/services/ (Codex 수정 10개)
- `guild.js`, `monuments.js` (2곳), `crafting.js`, `vip.js`, `faction.js`, `title.js`, `tribute.js`, `status.js`, `season.js`, `transport.js`: LOWER() + AND guard

### server/routes/bounty.js
- L137: `LOWER(wallet_address) = $2` → `LOWER(wallet_address) = LOWER($2)` (LOWER() 누락 버그 수정) + AND guard 추가

---

## 2026-05-07 v6.87 — GP/PP 잔액 가드 전체 서비스 일괄 수정 (39개 서비스)

### 수정 패턴 (전체 공통)
- 모든 `UPDATE users SET gp_balance/pp_balance = balance - $N` 경로에 `AND gp_balance >= $N` (또는 `pp_balance >= $N`) 음수 방지 가드 추가
- `WHERE wallet_address = $N` → `WHERE LOWER(wallet_address) = LOWER($N)` wallet 대소문자 정규화
- 잔액 SELECT에 `FOR UPDATE` 누락 시 추가 (동시 이중 차감 방지)

### v6.86 커밋 (10개 서비스 — Claude + Codex 협업)
- `spells.js`: SELECT에 FOR UPDATE 추가
- `staking.js`: FOR UPDATE + AND guard
- `rental.js`: LOWER() + AND guard (3곳)
- `branding.js`: LOWER() + FOR UPDATE + AND guard
- `enhancement.js`: FOR UPDATE + LOWER() + AND guard
- `lottery.js`: FOR UPDATE + LOWER() + AND guard
- `tournaments.js`: LOWER() + FOR UPDATE + AND guard
- `vtag.js`: setTag + clearTag 양쪽 LOWER() + FOR UPDATE + AND guard
- `broadcasts.js`: LOWER() + FOR UPDATE + AND guard
- `maintenance.js`: LOWER() + FOR UPDATE + SELECT guard + UPDATE guard

### v6.87 커밋 (39개 서비스 — Claude 27개 + Codex 12개)
- `ship.js` 5곳 (건조/수리/실드/업그레이드/마켓 구매): `AND gp_balance >= $1` 일괄 추가
- `hijack.js`: pp_balance 차감 guard 추가
- `duel.js`: challenger 에스크로 + defender 에스크로 양쪽 guard
- `marketplace.js` listing fee: LOWER() + guard
- `auction.js` 3곳 (listing fee/bid/buyout): LOWER() + guard
- `siege.js` 2곳: guard 추가
- `contest.js` 2곳 (entry fee/vote fee): guard 추가
- 나머지 22개 서비스 (`graffiti`, `prestige`, `capsule`, `announcement`, `alliance`, `beacon`, `sponsor`, `banner`, `tdesc`, `highlight`, `titleExtended`, `tprestige`, `shield`, `tombstone`, `rating`, `journal`, `milestone`, `polls`, `profile`, `job`, `missions`, `exploration`, `claimUpgrades`, `warBetting`, `raffle`, `tiers`, `expedition`, `wager`, `tevt`, `tournament`, `donation`): 동일 패턴 수정

---

## 2026-05-07 v6.85 — 일일미션/퀘스트 풀/마켓 구매 동시성 수정

### server/services/daily.js
- `claimMissionReward()`: `pool.query()` 직접 사용 → `BEGIN/COMMIT/ROLLBACK + finally { client.release() }` 패턴으로 리팩터링.
- 중복 수령 방지: `UPDATE ... SET claimed=true WHERE ... AND claimed=false RETURNING *` 원자적 처리.
- wallet 대소문자 정규화 (`LOWER()`).

### server/routes/api.js
- `quest_reward_pool` UPDATE (harvest, territory/harvest): `AND balance >= $1 RETURNING balance` 조건 추가. 0 rows 반환 시 ROLLBACK + pool_depleted 오류.
- 퀘스트 claim `actualReward`: 풀 잔액(`poolBalance`)과 일별 예산 잔여(`dailyBudget - todayPaid`) 캡 추가.
- quest 엔드포인트 wallet 비교: `LOWER(wallet) = LOWER($1)` 통일.

### server/services/marketplace.js
- `buyListing()` 구매자 잔액 SELECT에 `FOR UPDATE` 추가 → 동시 구매 이중 차감 방지.
- 잔액 UPDATE에 `AND ${balCol} >= $1` 음수 방지 가드 추가. `LOWER()` 정규화.

---

## 2026-05-07 v6.84 — 강화/공성/마켓 감사 버그 수정

### server/services/enhancementAdvanced.js
- `getScrollStatus()` / `getScrollCountClient()`: `user_items` 쿼리의 `wallet_address`/`item_code` → `wallet` + `JOIN item_types ... WHERE it.code = $2`로 수정. 보호권 보유 여부가 항상 false로 반환되던 버그 수정.
- `consumeScrollClient()`: 동일 잘못된 컬럼 → `UPDATE user_items ... FROM item_types` JOIN 패턴으로 수정.
- `getResourceBalance()` / `deductResource()` user_items fallback: 동일 컬럼 오류 → JOIN 패턴으로 수정.
- 모든 쿼리에서 wallet을 `.toLowerCase()` 정규화 추가.

### server/services/siege.js
- `declareSiege`, `resolveSiege`, `updateGovernorDeclaration` 등 15곳의 wallet/owner 비교에 `LOWER()` 추가. 대소문자 차이로 공성 참여자 소유권 오판 방지.

### server/routes/marketplace.js
- `GET /listings/:id`, `POST /cancel`, `POST /buy` 3곳에 `parseInt(id, 10)` + `Number.isInteger()` 가드 추가. 무효 ID 입력 시 400 반환.

---

## 2026-05-07 v6.83 — 함대전/함대 지휘 감사 버그 수정

### server/services/battleEngine.js
- 함선별 최종 전투 스냅샷(`is_alive`, `current_hp`, `bonus_atk/def/hp/speed`)을 결과 통계와 `battle_summary.final_ships`에 저장.
- 일반 전투의 생존 함선 HP 반영이 `result.frames`를 참조해 누락될 수 있던 버그를 `result.stats.by_ship` 기반 갱신으로 수정.
- `bonus_hp`가 적용된 유효 최대 HP 기준으로 전투 후 HP를 clamp하도록 보강.

### server/services/battleScheduler.js
- `preparing → active` 전환과 참가 함대 lock을 단일 트랜잭션으로 묶어 동일 전투/동일 함대 중복 실행 race condition 방지.
- 전투 실패·후속 훅 실패 경로 이후에도 `fleet.is_in_battle/current_battle_id`가 정리되도록 `finally` 방어 업데이트 추가.
- 신규 `pool.connect()` 사용 경로에 `finally { release() }` 적용.

### server/routes/fleets.js
- JWT wallet을 소문자로 정규화하고, fleet/ship id를 safe integer로 검증.
- `move-ships`의 문자열/NaN/중복 id 입력을 라우트에서 정규화해 DB 캐스트 오류와 타입 비교 흔들림 방지.
- 기함 지정 `ship_id` NaN 경로를 400 응답으로 차단.

### index.html
- `confirmDeclareBattle()`에서 JSON 파싱 실패와 `battle_id` 누락 응답을 명시적으로 처리.
- `openBattleViewer()`가 battle id와 현재 wallet을 iframe/report 요청에 전달하도록 보강.
- `forfeitBattle()` 클라이언트 함수를 추가하고 iframe 후퇴 메시지의 실패 payload를 성공 처리하지 않도록 수정.
- `setFleetFormation()`/`setFleetManeuver()` 호환 래퍼를 추가해 기존 Fleet Command 상태 업데이트 경로를 재사용.

---

## 2026-05-07 v6.82 — 서버/클라이언트 심층 감사 (신규 버그 없음)

### 추가 감사 완료
- expedition, missions, capsule, beacon, lottery, arena, 11개 서비스 트랜잭션 패턴 전수 확인 — 모두 클린
- auth.js 5개 / api.js JSON.parse / enhancement.js 폴백 — 모두 클린
- ship upgrade-stat stat 화이트리스트 보호 확인
- War Betting 인증 헤더 정상 전송 확인
- admin.html native dialog 0건 확인
- Campaign reward inbox FOR UPDATE 동시성 보호 확인
- **신규 버그 없음**

---

## 2026-05-07 v6.81 — DB 커넥션 더블 릴리즈 전수 스캔 및 추가 수정

### server/routes/api.js (3곳)
- 픽셀 클레임 라우트 내 for-loop 픽셀 검증 로직 3곳에서 `client.release()` 제거.
  - Peace Treaty 차단 경로, Marketplace lock 차단 경로, Shield 차단 경로
  - `finally { client.release() }` 가 항상 실행되므로 이중 릴리즈 발생했던 버그 수정.

### server/services/transport.js (1곳)
- `getRaidables()` 함수의 guild 면제 검사 for-loop 내 `client.release(); continue` → `continue`만 남김.
  - `finally { client.release() }` 와 이중 릴리즈 발생했던 버그 수정.

### 전수 스캔 결과
- Python 스크립트로 `server/**/*.js` 전체 파일 자동 스캔 — 위 2건 외 추가 더블 릴리즈 없음.
- `arena.js` 3곳: try/catch without finally 패턴 — 각 경로 단일 release로 안전.

---

## 2026-05-07 v6.80 — 스케줄러 DB 커넥션 더블 릴리즈 수정

### server/index.js (4곳)
- AUTO-RENEW 스케줄러 Shield/Effect 자동갱신 for-loop에서 early `continue` 경로 4곳에 있던 `client.release()` 제거.
- `finally { client.release() }` 블록이 항상 실행되므로 이중 호출 발생 — pg-pool 더블 릴리즈로 커넥션 풀 오염 가능.
- 동일한 `finally` 단일 경로로 정리.

### 추가 감사 (이번 루프)
- VIP Pass, Onboarding, War Betting, Profile 저장 함수 모두 클린.
- `warBettingRoutes.js` 인증 패턴 전수 검토 — 정상.
- 서버 서비스 `WHERE wallet` vs `WHERE wallet_address` 오용 검사 — users 테이블 접근은 전부 `wallet_address` 정상 사용.

---

## 2026-05-07 v6.79 — 확장 감사 완료 (전 시스템 클린 확인)

### 감사 범위 (v6.78 이후 추가)
- Alliance/Invasion, Auction, Expedition, Rental, GP Transfer, Lottery, Staking, Raffle, Broadcast, Banner/Highlight/Graffiti/Tribute, Siege, Governance, Bounty, Duel, Shield, Branding, Tier Upgrade, Guild, Claim Purchase — 모든 `gameConfirm` 패턴 정상
- P5-1~7 엔드포인트 실동 확인: territory production, resource-sector-hints, territory upgrades, sectors control 전부 응답 정상
- Campaign objectiveState에 `materialHarvests`/`territoryUpgradeLevels` 필드 정상 포함 확인
- 서버 라우트 마운트 순서 충돌 없음 확인 (`/api/sectors` → fall-through → apiRoutes 정상 처리)
- native dialog 잔존 1건 (`showHijackEntryHint` 내 `alert`) — `showFactionToast` 우선 처리로 도달 불가 dead code, 무해
- **신규 버그 발견 없음**

---

## 2026-05-07 v6.78 — 전체 코드베이스 심층 감사 완료 (신규 버그 없음)

### 감사 범위
- `gameConfirm` 60+ 콜 전수 검토 — `.then()`/`await` 패턴 모두 정상
- `walletState.*` 전역 필드 접근 전수 조사 — 유효 필드만 사용 확인
- Fleet Command / Shipyard / Ship Market / Campaign / Battle / Hijack / Territory 전 주요 흐름 점검
- 서버 라우트 5개 로드 테스트 통과
- v6.74~v6.77 수정 사항 전면 검증 완료
- **신규 버그 발견 없음**

---

## 2026-05-07 v6.77 — walletState 잘못된 필드명 수정 (gpBalance, pp → gameGP, gamePP)

### index.html (2곳)
- `govDeclareSiege()`: `walletState.gpBalance` (할당된 곳 없음, 항상 0) → `walletState.gameGP`. 공성전 선언 시 GP 잔액이 항상 0으로 표시되어 버튼이 "INSUFFICIENT GP"로 비활성화되는 버그 수정. 충분한 GP가 있어도 공성전 선언 불가했던 버그 수정.
- `buyMarketListing()`: `walletState.pp` (할당된 곳 없음, 항상 0) → `walletState.gamePP`. PP 구매 시 PP 잔액이 항상 0으로 표시되는 버그 수정.

---

## 2026-05-07 v6.76 — Daily OPS 미션 카운터 누락 수정 (harvest_3/5, battle_3, market_activity)

### server/routes/api.js (1곳)
- 영토 harvest 완료 후 `harvest_pp` 외 `harvest_3`, `harvest_5` 미션 진행도 알림 추가. 기존에는 3회/5회 수확 미션이 실제 수확을 해도 영원히 0으로 남았음.

### server/services/battleScheduler.js (1곳)
- 전투 참여/승리 후 `battle_participate_3`, `battle_win_3`, `ai_battle_3` 미션 진행도 알림 추가. 기존에는 단일 참여/승리 미션만 카운트되고 3회 미션은 영원히 미완료.

### server/routes/ships.js (2곳)
- 함선 마켓 등록/구매 후 `market_activity` (3회 거래 미션) 진행도 알림 추가. 기존에는 market_list/market_buy만 카운트되어 market_activity 미션은 영원히 0.

---

## 2026-05-07 v6.75 — window._walletAddress 항상 undefined 버그 수정 (2곳)

### index.html (2곳)
- `buryCapsule()`: `window._walletAddress` (항상 undefined, 코드베이스 어디서도 할당 없음) → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()`. 타임캡슐 묻기 기능이 항상 "Connect wallet first" 오류를 반환하던 버그 수정.
- `loadMyTdescs()`: 동일한 `window._walletAddress` 사용 → 동일 패턴으로 수정. 내 영토 설명 목록이 항상 `'—'` (빈 상태)로 표시되던 버그 수정.

---

## 2026-05-07 v6.74 — gameConfirm 콜백 패턴 전면 수정 + GP 비용 표시

### index.html (9개 함수)
- `doStake()` / `doWithdraw()`: `onConfirm: function(){}` + `confirmLabel:` (Promise 무시, fetch 미실행) → async/await + `confirmText:` + `getAuthHeaders()`. GP 스테이킹/인출 확인 시 실제 fetch가 실행되지 않던 치명 버그 수정.
- `saveTdescDescription()` / `submitSponsor()`: 동일한 `onConfirm:` 콜백 패턴 → async/await 변환. 지갑 주소도 `window._walletAddress` → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()` 통일. 영토 설명 저장 / 스폰서 배치가 확인 클릭 후 실제 실행되지 않던 버그 수정.
- `submitBanner()` / `submitRating()` / `submitHighlight()` / `submitGraffiti()` / `submitTribute()`: `cost: value` (인식 불가 필드, UI 표시 안 됨) → `info: [{k:'Cost', v: value}]`. GP 비용이 확인 다이얼로그에 표시되지 않던 UX 버그 수정. 아이콘 추가.

---

## 2026-05-07 v6.73 — 레거시 영토 업그레이드 패널 지갑/재로드 버그 수정

### index.html (2곳)
- `_confirmAndUpgrade()`: `wallet: walletState.address` → `((walletState&&walletState.address)||getMyWallet()||'').toLowerCase()`. JWT-only 유저가 레거시 업그레이드 확인 시 `wallet: undefined` 전송 → 400 오류 수정.
- `_confirmAndUpgrade()`: 성공 후 `loadTerritoryUpgrades()` (args 없음, 항상 400) → `_loadBaseUpgradesPanel()` 호출로 교정. 기존 BASE 탭 업그레이드 패널 재로드 정상화.

---

## 2026-05-07 v6.72 — battleTimeline / battleRewards 지갑 대소문자 비교 수정

### server/services/battleTimeline.js (1곳)
- `getUserBattleHistory()`: `WHERE p.wallet_address = $1` → `LOWER(p.wallet_address) = LOWER($1)`. 전투 기록이 빈 목록으로 반환되는 케이스 수정.

### server/services/battleRewards.js (3곳)
- `getRewardHistory()`: `WHERE r.wallet_address = $1` → `LOWER(r.wallet_address) = LOWER($1)`.
- GP 지급 UPDATE: `WHERE wallet_address = $2` → `WHERE LOWER(wallet_address) = LOWER($2)` (2곳). 케이스 불일치 시 GP 미지급 버그 수정.

## 2026-05-07 v6.71 — 영토 업그레이드/아이덴티티/캠페인 보상 지갑 컨텍스트 수정

### index.html (4곳)
- `claimCampaignReward()`: `wallet:walletState.address` → `getMyWallet()` 폴백 추가. JWT 이메일 유저이면서 지갑 미연결 시 `wallet: undefined`가 서버로 전송되어 `missing fields` 400 오류 발생하던 버그 수정. 지갑 미연결 시 명시적 에러 토스트 표시.
- `loadTerritoryUpgrades()`: `typeof myW2 !== 'undefined' ? myW2 : ''` → `(walletState&&walletState.address)||getMyWallet()`. `myW2`는 `showTerritoryInfo()` 로컬 변수로, 외부 호출(`toggleTerritoryUpgradePanel`) 시 항상 빈 문자열 → ownership 체크 실패 + 업그레이드 버튼 미표시.
- `doTerritoryUpgrade()`: 동일한 `myW2` 스코프 오류 수정. 업그레이드 버튼 클릭 시 지갑 주소 없음으로 `로그인 필요` 오류 수정.
- `openTerritoryIdentityEdit()`: 동일한 `myW2 || walletState?.address` 패턴 → `(walletState&&walletState.address)||getMyWallet()` 통일.

## 2026-05-07 v6.70 — getMyWallet 지갑 연결 전용 유저 누락 수정 + 보상 토스트 개선

### index.html (1곳)
- `getMyWallet()`: JWT pw_token이 없는 지갑 연결 전용 유저는 null 반환 → 배틀 보상 토스트 미표시. `walletState.address` 폴백 추가.

## 2026-05-07 v6.69 — commanderActions.js 지갑 대소문자 비교 버그 수정

### server/services/commanderActions.js (4곳)
- 참가자 검증: `owner_wallet = $2` → `LOWER(owner_wallet) = LOWER($2)`.
- 쿼터 체크: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- 중복 액션 체크: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- GP 차감: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- JWT wallet 소문자 정규화 후 DB 비교 시 케이스 불일치로 `NOT_A_PARTICIPANT` / `INSUFFICIENT_GP` 오류 발생하던 버그 해소.

## 2026-05-07 v6.68 — fleetBattles.js 지갑 대소문자 비교 버그 수정

### server/routes/fleetBattles.js (4곳)
- `declare-pvp` — 내 함대 소유권 체크: `owner_wallet = $2` → `LOWER(owner_wallet) = LOWER($2)`. 지갑 대소문자가 JWT ≠ DB일 때 `MY_FLEET_NOT_FOUND` 오류 수정.
- `declare-pvp` — 자기 함대 공격 방지: `owner_wallet === wallet` → `.toLowerCase()` 비교. 케이스 불일치 시 자기 함대 공격 가능한 버그 수정.
- `/:id/run` — 참가자 확인 쿼리: `wallet_address = $2` → `LOWER(wallet_address) = LOWER($2)`.
- `/:id/forfeit` — 참가자 + 사이드 확인 쿼리: 동일하게 LOWER() 적용.

## 2026-05-07 v6.67 — i18n 누락 키 10개 추가 (4개 언어 블록)

### index.html (4개 언어 블록)
- `connect_wallet` / `connect_wallet_first` / `err_connect_wallet`: 지갑 연결 요청 메시지 — 20/8/11곳에서 `t()` 호출되지만 I18N 미정의 → 키 그대로 표시 또는 || 폴백 영어 사용. 4개 언어 블록에 추가.
- `err_network`: 네트워크 오류 메시지 — 여러 fetch 오류 핸들러에서 사용.
- `vip_confirm`: VIP 구매 확인 버튼 텍스트.
- `use_shipyard` / `use_fleet_cmd`: 함선/함대 관련 안내 문구.
- `gov_battle_use_fleet` / `gov_battle_use_fleet_hint`: 거버넌스 전투 안내 메시지.
- `duel_declined_msg`: 결투 거절 토스트 메시지.

## 2026-05-07 v6.66 — escHtml 미정의 함수 수정 (index.html 21곳 + admin.html 8곳)

### index.html
- `escHtml(s)` — 21곳에서 직접 호출되지만 정의 없음 (ReferenceError). 뉴스 패널/바운티/실드/기념비/이벤트/토너먼트 등 텍스트 렌더 전부 오류. `_escHtml`의 전역 alias `var escHtml = _escHtml` 추가.

### admin.html
- `_escHtml(s)` — 브랜딩/스펠/토너먼트/방송 설정 패널 8곳에서 사용되지만 admin.html에 정의 없음. 함수 정의 추가 + `escHtml` 별칭.

## 2026-05-07 v6.65 — Void Raider 교전 모달 로그인 가드 추가

### index.html (1곳)
- `openWorldEventDetail()`: 비로그인 유저가 Void Raider ENGAGE 버튼을 눌러도 모달이 열리던 문제 수정. `isLoggedIn()` + 지갑 연결 여부 확인 후 미로그인 시 에러 토스트 표시.

## 2026-05-07 v6.64 — Void Raider ENGAGE 지갑 인증 누락 수정

### index.html (1곳)
- `confirmWeEngage()`: `Authorization: Bearer` 헤더만 전송해, JWT 없이 지갑만 연결된 유저가 교전 시 `wallet_required` 오류 수신. `x-wallet` 헤더 + body `wallet` 필드도 함께 전송하도록 수정.

## 2026-05-07 v6.63 — Fleet Command 모달 텍스트 깨짐 수정

### index.html (3곳)
- Fleet Command 모달 정적 HTML에 JS 삼항 표현식(`'+(LANG==='ko'?...)+'`)이 그대로 삽입돼 브라우저가 리터럴 텍스트로 렌더링하는 버그 수정.
  - `.fleetcmd-title` 부제목: `<span id="fleetCmdSubtitle">` 교체 + `openFleetCmd()` 진입 시 LANG 기반 텍스트 설정.
  - "새 함대" 버튼 내부 텍스트: `<span id="fleetCmdNewBtn">` 교체.
  - "함대를 선택하세요" 플레이스홀더: `<span id="fleetCmdSelectHint">` 교체.
- `openFleetCmd()` 시작 시 3개 span에 `LANG` 기반 텍스트 즉시 주입.

## 2026-05-06 v6.62 — 서비스 파일 잘못된 require 수정 (notifications + betting)

### server/services/ (7개 파일)
- `shield.js`, `staking.js`, `lottery.js`, `claimUpgrades.js`, `dividends.js`, `monuments.js`: `require('./notifications').notifyPlayer` → `require('../db').notifyPlayer`. 실드 활성화/스테이킹/복권/영토 업그레이드/배당금 이벤트 알림 이제 정상 작동.
- `siege.js`: `require('./betting')` (삭제된 서비스) → `require('./warBetting')` 호환 래퍼 추가. siege 선언/종료 시 전쟁 베팅 이벤트 자동 생성/정산 이제 작동. (기존에는 try-catch로 silent fail)

## 2026-05-06 v6.61 — typeof 가드 undefined 함수 알리아스 추가 + 거버넌스 리프레시 수정

### index.html
- `loadGPBalance` (1곳 typeof 가드), `refreshPP` (1곳): GP/PP 잔액 갱신 함수 — 정의 없어 silent no-op. `loadWalletData` 알리아스 추가.
- `loadClaims` / `refreshClaims` (영토 병합 후 재로드): 정의 없어 silent no-op. `compositeClaimsOnTexture()` 래퍼 추가.
- `renderBlueprintsGrid` / `renderShipList` (조선소 탭 전환 시 갱신): 정의 없어 silent no-op. `renderBlueprints()` / `renderShips()` 래퍼 추가.
- `loadGovDashboard` (거버넌스 선언 후 대시보드 갱신): 잘못된 함수명. `loadGovernanceData()` 직접 호출로 교체.

### server/routes/crafting.js
- `require('../services/gpService')` / `require('../services/seasonService')`: 존재하지 않는 파일명 → `require('../db').logGPActivity` + `require('../services/season')` 교정. 크래프팅 GP 활동 이제 정상 기록.

## 2026-05-06 v6.60 — 서버 라우트 서비스 require 오류 수정 (6개 파일)

### server/routes/ (6개 파일)
- `vip.js`, `duel.js`, `alliance.js`, `expedition.js`, `rental.js`, `contest.js`: 존재하지 않는 `gpService.js`, `seasonService.js`, `weeklyChallenge.js`를 require하고 있었음.
- 실제 서비스로 교정: `require('../db').logGPActivity` (GP 로깅) + `require('../services/season')` (시즌 점수). 이제 VIP 구매/파벌 행동/듀얼 등 GP 활동이 gp_activity_log에 정상 기록됨.
- `weeklyChallenges`는 삭제된 서비스이므로 주석으로 표시.

## 2026-05-06 v6.59 — admin.html mkStatBox 헬퍼 함수 정의 추가

### admin.html (1곳)
- `mkStatBox(label, value, color)`: 어드민 패널 실드/복권/경매 탭 스탯 카드에 16회 이상 사용되지만 프로젝트 어디에도 정의 없음 → ReferenceError. 함수 정의 추가.

## 2026-05-06 v6.58 — refreshBalance / gameAlert 미정의 함수 수정

### index.html (2곳)
- `refreshBalance`: 마켓/경매/함선 repair/scrap/shield/list 후 11곳 직접 호출 → ReferenceError. `window.refreshBalance = loadWalletData` 알리아스 추가.
- `gameAlert`: 영토 병합/크래프팅/듀얼 등 40곳 직접 호출 → ReferenceError. `window.gameAlert = showToast 래퍼` 추가.

## 2026-05-06 v6.56-v6.57 — 미정의 함수 aliases + 경매 시스템 auth 수정

### index.html (12곳)
- **v6.56** `loadWalletData` 미정의 함수: 복권/스테이킹 등 GP 소비 후 7곳에서 직접 호출 → ReferenceError → catch가 오류 토스트 표시. `window.loadWalletData = refreshEmailBalances` 알리아스로 수정.
- **v6.56** `refreshWalletInfo` (21곳 typeof 가드), `updateBalanceDisplays` (6곳), `loadUserData`/`loadBaseStats` (각 5곳): 모두 정의 없어 silent no-op. window 알리아스 추가.
- **v6.57** `POST /api/auction/create|bid|buyout|cancel`: auctionRoutes.js requireAuth 경로인데 Authorization 헤더 없이 요청 → 경매 등록/입찰/낙찰/취소 전부 401. `getAuthHeaders()` 추가.

## 2026-05-06 v6.55 — getWalletAddress 미정의 함수 수정 (8곳)

### index.html (8곳)
- `loadTransportTab`, `loadFleetCommandCard`, 수송 5개 함수, 월드이벤트 함대 선택에서 `getWalletAddress()` 호출. 이 함수는 앱에 정의되지 않고 폴백 `window._wallet`도 미설정 → 모두 빈 문자열 반환 → 함수 즉시 반환. 수송 탭, Fleet Command 카드, 월드이벤트 함대 선택 완전 비동작.
- `(walletState && walletState.address) || ''` 로 전면 교체.

## 2026-05-06 v6.54 — build-jobs dot 지시자 JWT 수정

### index.html (1곳)
- 베이스 탭 FLEET dot 업데이트 코드: `GET /api/ships/build-jobs` 호출에 `window._authToken` (미정의 변수) → `getAuthHeaders()`. 건조 완료 dot이 항상 보이지 않던 버그 수정.

## 2026-05-06 v6.51-v6.53 — auth 버그 3건 수정

### index.html (3곳)
- `govPlaceBet()`: `POST /api/betting/bet` — `x-wallet` 헤더 → `getAuthHeaders()` JWT 헤더. warBettingRoutes requireAuth는 JWT 전용으로 공성전 베팅이 항상 401 반환되던 버그 수정.
- `openMineralsPanel()`: `GET /api/resources/my?wallet=…` → `fetch('/api/resources/my', { headers: getAuthHeaders() })`. resources.js requireAuth 통과 불가로 MY MINERALS 패널 항상 비어 있던 버그 수정.
- `_phaseDAuthHeaders()`: `localStorage.getItem('jwt_token') || localStorage.getItem('jwt')` → `localStorage.getItem('pw_token')`. 앱 표준 키가 `pw_token`인데 잘못된 키를 조회해 동맹 guild add/remove/betray 모두 401 반환되던 버그 수정.

## 2026-05-06 — bugfix: GET /api/ships/my?wallet= → JWT auth (v6.50)

### index.html (1곳)
- `loadMyShips()` Ship Registry: `fetch('/api/ships/my?wallet='+encodeURIComponent(w))` → `fetch('/api/ships/my', { headers: getAuthHeaders() })`. ships.js requireAuth가 JWT만 인증하므로 쿼리 파라미터 wallet은 401 이후 도달 불가.

## 2026-05-06 — bugfix: GET /api/fleets x-wallet → JWT auth (v6.49)

### index.html (3곳)
- **버그**: `loadFleetCommandCard()`, 전쟁 함대 선택, 거버넌스 패널 — `GET /api/fleets` 호출 시 `x-wallet` 헤더만 사용
  - `fleets.js` 라우터는 `requireAuth` (JWT-only) → 401 UNAUTHORIZED → 함대 데이터 미표시
- **수정**: 3곳 모두 `{ 'x-wallet': w }` → `getAuthHeaders()` (JWT Bearer 토큰) 으로 교체

## 2026-05-06 — bugfix: phaseC tournament shadow-match (v6.48)

### server/routes/phaseC.js
- **버그**: `GET /tournaments/:id` (phaseC, line 305 mount) 이 `GET /tournaments/my` (tournaments.js, line 340 mount) shadow-match
  - `id='my'` → `parseInt('my')=NaN` → `INVALID_ID 400` 반환 → 내 토너먼트 목록 완전 비동작
- **수정**: `staticSubs = ['my','join']` `next()` guard 추가

## 2026-05-06 — bugfix: gameConfirm legacy calls — crafting + VIP (v6.47)

### index.html
- **버그**: `attemptCraft()` — `gameConfirm(confirmMsg, subMsg, callback)` 구버전 콜백 패턴 → 제작 확인 모달 완전 비동작
- **수정**: options object + `.then()` 패턴으로 교체. `\n` → `<br>` 변환 추가
- **버그**: `purchaseVipPass()` — `gameConfirm({title, body})` icon/confirmText 누락
- **수정**: `icon:'👑'`, `confirmText:'GET VIP'` 추가

## 2026-05-06 — bugfix: onboarding API URL mismatch + missing /reward endpoint

### index.html (5개 fetch 수정)
- **버그**: 온보딩 관련 모든 fetch URL이 `/api/user/onboarding/*` 을 사용했으나, 서버는 `/api/onboarding`에 마운트 → 전체 온보딩 API 404
- **버그**: `requireAuth` 미들웨어가 JWT를 요구하지만 Authorization 헤더 미포함 → 401
- **수정**: URL 5곳 모두 `/api/onboarding/*` 로 변경 + `pw_token` JWT 헤더 추가
  - `initOnboarding()`, `obNextStep()` (step advance + reward), `obSkip()`, `onTutorialClaimSuccess()`

### server/routes/onboardingRoutes.js
- **버그**: `POST /api/onboarding/reward` 엔드포인트 미존재 → step 5 보상 수령 버튼 항상 404 → 온보딩 완료 불가
- **수정**: `/reward` POST 핸들러 추가
  - `onboardingService.completeStep(wallet, 5, {})` 호출
  - 프론트 기대 포맷 `{ ok: true, rewards: { gp, pp } }` 로 변환
  - `ALREADY_DONE` → `{ error: 'already_claimed' }` 매핑

## 2026-05-06 — bugfix: FACTION_FLAVOR JS syntax error — unescaped apostrophes

### index.html
- **버그**: `FACTION_FLAVOR` 객체의 `line_en` 값 13개가 단일 따옴표로 감싸인 문자열 안에 미이스케이프 아포스트로피(`'`)를 포함
- 해당 `<script>` 블록(약 25k줄) 전체가 SyntaxError로 파싱 실패 → 클레임/하이잭/함대전 파벌 대사 기능 완전 비동작
- **수정**: 13개 아포스트로피를 `\'`로 이스케이프. 전체 스크립트 블록 파싱 복구 확인

## 2026-05-06 — bugfix: phaseD alliance shadow-match + leave 401

### server/routes/phaseD.js
- **버그**: `GET /alliances/:id` (phaseD, line 90) 이 `GET /alliances/my`, `GET /alliances/settings` (alliance.js) shadow-match
  - phaseD는 line 306 마운트 (alliance.js는 line 334) → phaseD가 먼저 처리
  - `id='settings'` → `parseInt('settings')=NaN → INVALID_ID 400` 반환
- **수정**: `staticSubs = ['my','settings','create','betray']` `next()` guard 추가

### index.html
- **버그**: `leaveAllianceConfirm()` — `POST /api/alliances/leave` JWT 없이 body wallet만 전송
  - phaseD `requireAuth` 가 먼저 처리 → 401 UNAUTHORIZED
- **수정**: `pw_token` 있으면 Authorization 헤더 추가

## 2026-05-06 — bugfix: Express route shadow-match + legacy gameConfirm callback patterns

### server/routes/tournaments.js
- **버그**: `GET /tournaments/my`가 `GET /tournaments/:id` 뒤에 등록 → 항상 `:id` 핸들러에 shadow-match
- **수정**: `/my` 라우트를 `/:id` 앞으로 이동

### server/routes/raffle.js
- `GET /raffles/my` → `/:id(\d+)` 앞으로 이동 (코드 순서 정정)

### server/routes/api.js
- **버그**: `GET /user/:wallet`이 `/user/titles`, `/user/my-territories` shadow-match → user 조회 응답 반환
- **수정**: `staticSubs` `next()` guard 추가 (`titles`, `my-territories`)
- **버그**: `GET /guild/:id`가 `/guild/research-bonuses` shadow-match
- **수정**: `research-bonuses` `next()` guard 추가

### index.html
- **버그**: `respondDuel()`, 임대, 영토 업그레이드, 기념비 설치 — `gameConfirm(icon, title, body)` 구버전 3인수 패턴 (opts=string → 모달 공백)
- **버그**: 저널/마일스톤/공지/묘비 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 (Promise 기반 함수에서 완전히 비동작)
- **수정**: 모든 8개 호출을 `gameConfirm({icon,title,body,confirmText})` + `.then(ok=>{...})` 패턴으로 교체

## 2026-05-06 — bugfix: BASE QUESTS bounty board broken API + field mismatches

### index.html
- **버그**: `loadBountyBoard()` — `/api/bounties/*` URL 사용 (서버는 `/api/bounty/*` 마운트) → 전체 404
- **버그**: `renderBountyList()` — `b.poster`(없음), `b.gp_amount`(없음), `b.message`(없음) 접근 → JS 오류/NaN
- **버그**: `submitPostBounty()` — `/api/bounties/post` + 잘못된 필드 `targetWallet/gpAmount/message`
- **버그**: `submitPostBounty()` — `gameConfirm('icon','title','body')` 구버전 4인수 호출 패턴
- **버그**: `cancelBounty()` — `/api/bounties/cancel` + body `{bountyId}` (서버는 `/api/bounty/cancel/:id`)
- **버그**: `cancelBounty()` — `d.refund` 미존재 (서버 응답은 `refunded_gp`)
- **수정**: 모든 URL `/api/bounty/...`로 통일, 필드명 `poster_wallet/reward_gp/reason`으로 정렬, gameConfirm options object 패턴으로 교체

## 2026-05-06 — bugfix: hidden campaign chapter wrong rewards (M3/M4)

### server/services/campaign.js
- **버그 M3**: `hidden_campaign_ch1~5` 완료 시 `simulateCh1()` 폴백 실행 — MCC 산소전쟁 시뮬레이션 결과로 처리
- **버그 M4**: `calculateRewards()` 히든 챕터 → `calculateCh1Rewards()` 폴백 — Prism Interceptor (`mcc_int`) 함선 잘못 지급
- **수정**: `simulateHiddenChapter()` 추가 — 관찰 중심 성공 시뮬레이션, 히든 루트 GP 보상 반환
- **수정**: `calculateHiddenChapterRewards()` 추가 — 소량 GP/XP, `the_observer` 태그(ch5), 히든 고유 loreFlag
- **수정**: `simulateChapter()`, `calculateRewards()` 양쪽 HIDDEN_CH1~5 분기 추가
- **수정**: 알 수 없는 챕터 폴백을 중립 시뮬/빈 보상으로 교체 (MCC 아이템 잘못 지급 방지)

## 2026-05-06 — bugfix: daily OPS mission notifications + forfeit exploit patch

### server/routes/ships.js
- **버그**: `POST /:id/list`, `POST /market/listings/:id/buy`, `POST /:id/repair` 에 `notifyMissionProgress` 호출 없음 → market_list/market_buy/repair_ship/repair_ship_3 미션 미적립
- **수정**: 각 핸들러에 성공 시 fire-and-forget notify 추가
- **버그**: `build_ship` — `res.json(result)` 전에 notify 호출, success 체크 없음
- **수정**: 성공(`result.success || result.job`) 확인 후 notify, res.json을 notify 이후로 이동

### server/routes/resourceCraft.js
- **버그**: `POST /start` — craft_resource 미션 알림 없음
- **수정**: craft_resource/craft_resource_3/craft_resource_5 notify 추가

### server/routes/crafting.js
- **버그**: `POST /crafting/craft` — craft_resource 미션 알림 없음
- **수정**: 동일 3종 notify 추가

### server/routes/fleetBattles.js
- **버그**: `POST /:id/forfeit` — already_resolved 분기에서도 `battle_forfeit` 미션 적립 → 반복 호출로 무한 적립 가능
- **수정**: `preparing` 상태에서만 알림 발화, already_resolved에서는 notify 제거

## 2026-05-06 — bugfix: onboarding PP reward parseInt→parseFloat + exchange_max fallback

### server/services/onboarding.js
- **버그**: `onboarding_pp_reward` 설정값 0.5를 `getSettingInt()`로 읽어 `parseInt('0.5')=0` 처리 → PP 보상 0 지급
- **수정**: `getSettingFloat()` 헬퍼 추가 + ppReward 조회를 parseFloat 기반으로 변경
- 기본값(fallback)도 `100`→`0.5`로 경제 밸런스 정렬

### server/routes/api.js
- **수정**: `pp_to_gp_exchange_max` 코드 fallback 값 `'10'`→`'5'` (migration 220 설정값과 일치)

## 2026-05-06 — bugfix: frontend wallet null guards + dead el ref cleanup

### index.html
- `loadTerritoryProduction`: wallet null guard 추가 (undefined가 API URL에 'undefined' 문자열로 들어가는 버그 수정)
- `loadBountyBoard`: 'mine'/'onme' 탭 wallet URL에 encodeURIComponent 적용
- `opsBoardCountdown2` 존재하지 않는 DOM 요소 dead reference 제거 (el 자체는 if 가드로 안전했으나 코드 정리)

## 2026-05-06 — bugfix: battleScheduler stale battle cleanup on startup

### server/services/battleScheduler.js
- **버그**: 서버 재시작 시 `'active'` 상태로 남은 전투가 영구적으로 스케줄러 슬롯을 점유
- **수정**: `cleanupStaleBattles()` 함수 추가 — 시작 시 30분 이상 경과된 `'active'` 전투를 `'cancelled'`로 처리하고 함대 락 해제
- `start()` 호출 시 `cleanupStaleBattles()` 비동기 실행 추가

## 2026-05-06 — bugfix: dailyOps weekly-events 라우트 shadow match 수정

### server/routes/dailyOps.js
- **버그**: `GET /weekly-events` 가 `GET /:wallet` 보다 뒤에 등록되어 있어, `/api/daily-ops/weekly-events` 요청이 wallet='weekly-events'로 처리됨
- **수정**: `/weekly-events` 라우트를 `/:wallet` 라우트 앞으로 이동 (Express 라우트 등록 순서 원칙 적용)
- 하단 중복 `/weekly-events` 블록 제거

## 2026-05-06 — 로컬라이징 27차 — ops카운트/PVP탭버튼/길드기부/프로필헤더 (루프 27차)

### 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 27 (11항목)
- Ops 카운트다운 정적 한국어 fallback → 영어 중립 placeholder (JS가 동적으로 LANG처리)
- Ops 보드 loading span data-i18n="loading_dots" 처리
- PVP 탭 이동 버튼 3개 (GP Duels/Sector Siege/Naval Battles) data-i18n 처리
- 길드 GP 기부 라벨 data-i18n 처리
- 프로필 꾸미기 섹션 헤더 data-i18n 처리
- i18n 4개 언어 섹션에 4개 키 추가 (pvp_goto_tab/pvp_from_tab/guild_gp_donate_lbl/prof_customize_title)

## 2026-05-06 — 로컬라이징 26차 — VIP/크레이트/프레스티지 설명 패널 (루프 26차)

### 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 26 (7항목)
- VIP 패스 설명 배너 타이틀 + 설명 div data-i18n 처리
- 크레이트 설명 배너 타이틀 + 설명 div data-i18n 처리
- 프레스티지 설명 배너 타이틀 + 설명 div data-i18n 처리
- i18n 4개 언어 섹션에 6개 키 추가 (vip_pass_title/vip_pass_desc/crate_what_title/crate_what_desc/prestige_what_title/prestige_what_desc)
- 모든 HTML 설명 desc 키는 applyI18n()이 innerHTML로 처리 (< 포함 값 자동 감지)

## 2026-05-06 — 로컬라이징 25차 — 영토정체성/섹터라벨/WE모달/카운트/로그인토스트 (루프 25차)

### 정적 HTML data-i18n + 동적 JS LANG 4개 언어 확장 (index.html) — 배치 25 (19항목)
- WE 모달 함대 선택 option + 최소 함선 안내 data-i18n 처리
- 영토 목록 클레임 수 `개` 접미사 4개 언어 처리
- 영토 생산 패널 sectorLabel (코어/미드/프론티어 섹터) 4개 언어 처리
- 영토 정체성 패널 소유자/섹터 메타 4개 언어 처리
- 영토 정체성 이력 4개 항목 (보유일/방어성공/탈환/최대보유) 4개 언어
- 영토 정체성 섹션 라벨 (이력/배지) 4개 언어
- World Events 네트워크 오류 toast 4개 언어
- 캠페인 로그인 필요 toast 4개 언어
- 거버너 전투 힌트 텍스트 4개 언어
- i18n 4개 언어 섹션에 2개 키 추가 (we_select_fleet/we_fleet_min)

## 2026-05-06 — 로컬라이징 24차 — ops보드/PVP허브/워베팅타이틀/포지/영토JS/하이잭알림 (루프 24차)

### 정적 HTML data-i18n + 동적 JS LANG 4개 언어 확장 (index.html) — 배치 24 (24항목)
- Ops 작전 보드 타이틀 + 범례 3개 (완료/미완료/긴급) data-i18n 처리
- PVP 허브 전투 선언 버튼 + 탭 3개 (추천상대/현상금/섹터분쟁) data-i18n 처리
- WAR BETTING 모달 타이틀 + 포지 강화중 텍스트 + 포지 확인 버튼 data-i18n 처리
- BASE 영토 패널 JS: 판매중 배지, 로딩중, 수확/보호막/업그레이드/지도 버튼 4개 언어
- 영토 생산 패널 JS: 최근 수확/아직 수확 없음 4개 언어
- TIER_LABELS (총독/지배/이해관계자/존재감) 4개 언어
- 섹터 컨트롤 `(나)` 레이블 4개 언어
- 하이잭 알림 (AUTO-WIN, 함대전 진행 중) 4개 언어
- i18n 4개 언어 섹션에 10개 키 추가 (ops_board_title/ops_legend_*/pvp_*/wb_title/forge_upgrading)

## 2026-05-06 — 로컬라이징 23차 — 워베팅 toast/모바일 영토 버튼/버그리포터 (루프 23차)

### 동적 JS + 정적 HTML data-i18n + i18n 키 추가 (index.html) — 배치 23 (19항목)
- 워베팅 베팅 성공 toast 4개 언어
- 모바일 영토 액션 버튼 6개 (이름변경/꾸미기/판매/보호막/업그레이드/HIJACK) data-i18n 처리
- 버그 리포터 정적 HTML 8개 요소 (힌트/설명라벨/SS라벨/SS placeholder/드래그/캡처중/제출/지우기) data-i18n 처리
- i18n 4개 언어 섹션에 14개 키 추가 (mt_rename~mt_hijack, br_hint~br_clear_ss)

## 2026-05-06 — 로컬라이징 22차 — 전투결과/동맹/리플레이/워베팅/온보딩 (루프 22차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 22 (41항목)
- 전투 결과 리포트 타이틀, 승/패/무승부 배지 4개 언어
- 하이라이트 라벨맵 (첫 격침/기함 위기/전세 역전), 이동 버튼, 장면 타이틀 4개 언어
- 동맹 로딩/실패, 카드 메타 (멤버/전적/금고/소속), 탈퇴 버튼 4개 언어
- 동맹 목록 (기존 동맹/없음/멤버/함선/가입버튼) 4개 언어
- 동맹 창설/가입/탈퇴 gameInput + gameConfirm + 오류맵 + 성공 toast 4개 언어
- 리플레이 empty 메시지 (공유/추천) 4개 언어
- 워베팅 로딩/empty/실패/typeMap/closeText/베팅버튼/선택/풀/statusMap 4개 언어
- 온보딩 완료 환영 toast 4개 언어

## 2026-05-06 — 로컬라이징 21차 — 전투보상/AI/토너먼트/브래킷/하이잭/후퇴/커맨드/BV패널 (루프 21차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 21 (23항목)
- 전투 승리/참가 보상 타이틀 4개 언어
- AI 카드 척수 표시 + 챌린지 AI gameInput + 대전 시작 toast 4개 언어
- 토너먼트 N강 라운드 라벨 4개 언어
- 토너먼트 등록 gameInput + 규모 선택 picker 4개 언어
- 브래킷 로딩/아직 준비중/관전/로드실패 4개 언어
- 하이잭 힌트 메시지 4개 언어
- 후퇴 toast 4개 언어
- 지시(커맨드) 라벨 맵 (진형/기동/집중공격 등) 4개 언어
- 지시 적용/인증오류/실패 toast 3종 4개 언어
- BV 사이드 패널 함선 수/HP 표시 4개 언어
- BV 자원 empty 메시지 4개 언어
- 전투 스탯 라벨 (공/방/HP) 4개 언어
- 자동 승리/패배 메시지 4개 언어
- BV 내 함대 + 적 함대 참가자 함선 수 표시 4개 언어

## 2026-05-06 — 로컬라이징 20차 — 전투목록/검색/시간표시/CA동적JS (루프 20차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 20 (29항목)
- Battle Viewer 사이드 패널 loading 텍스트 data-i18n 처리 (4개)
- 전투 카드 척수/분 단위 표시 4개 언어
- 관전/리플레이/즉시 시작 버튼 텍스트 4개 언어
- 전투 즉시 시작 gameConfirm + 성공/실패 toast 4개 언어
- formatShortTime: 방금/N분 후/N분 전/N시간 전/N일 전 4개 언어
- 함대 셀렉터 옵션 척수 4개 언어
- 전투 선언 검색 힌트 5종 (최소 글자/검색중/실패/결과없음/오류) 4개 언어
- 검색 결과 카드: 함대/전적/척수/전투중 4개 언어
- 함대 선택 toast 4개 언어
- CA 모달 동적 JS: focus 타겟 자동지정/reinforce 함선선택/최대선택 toast 4개 언어
- CA Doctrines 설명 6종 4개 언어
- caApplyAndFight 버튼 텍스트 리셋 4곳 4개 언어

## 2026-05-06 — 로컬라이징 19차 — CA모달/전투허브/리플레이공유/파벌설명 (루프 19차)

### 동적 JS + 정적 HTML 4개 언어 확장 (index.html) — 배치 19 (38항목)
- 전투 선언 허브 정적 HTML: 타이틀/탭(최근·내기록)/선언버튼/부제목 data-i18n
- 전투 선언 달이얼로그: 내함대/추천상대/상대검색 라벨, 검색 placeholder data-i18n
- Commander Actions 모달 전체: 부제목/프리셋 라벨/SNIPER 액션/카드설명4종/파라미터라벨3종/힌트4종/선택수/버튼2개 data-i18n
- AI 연습전 설명 div data-i18n
- 토너먼트 개최 버튼 span data-i18n
- JS — 전투 선언 gameConfirm 타이틀/본문/확인 4개 언어
- JS — 리플레이 공유 gameInput 타이틀/레이블/placeholder 4개 언어
- JS — 리플레이 에러코드 3종 (NOT_PARTICIPANT/BATTLE_NOT_ENDED/REPLAY_LIMIT_REACHED) 4개 언어
- JS — 리플레이 공유 링크 gameInput + 완료 toast 4개 언어
- JS — 토너먼트 개최 gameInput 타이틀/레이블/placeholder + 참가비 gameInput 4개 언어
- JS — Ship Registry FACTION_META desc 3종 (mcc/fsp/cv) 4개 언어
- i18n 4개 언어 섹션에 30개 키 추가

## 2026-05-06 — 로컬라이징 18차 — 전투/토너먼트/리플레이 정적 HTML (루프 18차)

### 정적 HTML data-i18n 속성 + I18N 4개 언어 키 추가 (index.html) — 배치 18 (11개 항목)
- 전투 취소 버튼 → `data-i18n="btn_cancel"` + 4개 언어 키
- 공격 시작 span → `data-i18n="battle_attack_start"` + 4개 언어 키
- 보상 토스트 타이틀/닫기 → `data-i18n="reward_battle_title"` / `"btn_confirm"` + 4개 언어 키
- AI 연습전 타이틀 → `data-i18n="ai_practice_title"` + 4개 언어 키
- 토너먼트 탭 (모집중/진행중/완료) → `data-i18n` 3종 + 4개 언어 키
- 리플레이 탭 (추천/내 공유) → `data-i18n` 2종 + 4개 언어 키
- 전투 검색 힌트 → `data-i18n="bd_search_hint"` + 4개 언어 키

## 2026-05-06 — 로컬라이징 15~17차 — 인벤/마켓/조선소/함대지휘/전쟁모달 (루프 15-17차)

### 동적 JS + 정적 HTML 4개 언어 확장 (index.html) — 배치 15~17 (70+ 항목)
- 인벤토리 카테고리 비어있음 4개 언어
- 마켓플레이스 등록 다이얼로그 전체: 고정가/경매 버튼, 시작가/즉구가/즉시구매/기간 라벨, 기간 옵션, 수수료 텍스트, 등록하기 confirmText 4개 언어
- 영토 이름 변경 gameInput 타이틀·레이블 4개 언어
- 함선 강화 애니메이션 상태: 강화중/오류/성공/실패 제목, 확률/굴림 결과 텍스트 4개 언어
- 함선 수리 confirm: 타이틀/GP비용/iron_ore 수량/confirmText 4개 언어
- 함선 해체 confirm: 타이틀/body 설명/환불률/confirmText 4개 언어
- 실드 충전 confirm: 이미최대 toast/타이틀/body 설명/GP비용/confirmText/완료 toast 4개 언어
- 함선 마켓 카드: 판매중 스티커/항목 수 4개 언어
- MY FLEET 판매중 스티커 4개 언어
- 함선 판매 등록 gameInput 타이틀/레이블/placeholder 4개 언어
- 판매 취소 confirm: 타이틀/body/confirmText 4개 언어
- 함선 구매 confirm: 타이틀/body/가격 key/confirmText 4개 언어
- 건조중 표시 4개 언어
- 전쟁 선포 모달 정적 HTML: data-i18n 속성 추가 (선포비용/길드재무/검색입력/2글자힌트)
- i18n 4개 언어 섹션에 4개 전쟁모달 키 추가
- Fleet Command 모달: 타이틀/새함대/선택없음/함선없음/이름없음/전투중/리네임/해체 버튼 4개 언어
- Fleet Command 에러 메시지 맵 20종 4개 언어화 (NO_WALLET ~ SHIP_CANNOT_BE_FLAGSHIP)
- 함대 카드 메타: 척/전투중 배지 4개 언어
- 함대 상세: 총N척/전적/해제/이동/척선택 4개 언어
- 함대 해체 confirm: 타이틀/body/confirmText 4개 언어
- 함대 선택 드롭다운 N척 4개 언어

## 2026-05-06 — 로컬라이징 14차 — 정적 HTML 길드기부/인증 입력 (루프 14차)

### 정적 HTML data-i18n 속성 + I18N 4개 언어 키 추가 (index.html) — 배치 14 (9개 항목)
- 길드 기부 GP 입력 placeholder → `data-i18n-placeholder="guild_donate_placeholder"` + 4개 언어 키
- 길드 기부 버튼 → `data-i18n="guild_donate_btn"` + 4개 언어 키
- 콜로니 모토 입력 placeholder → `data-i18n-placeholder="auth_motto_placeholder"` + 4개 언어 키
- 콜로니 상태 입력 placeholder → `data-i18n-placeholder="auth_status_placeholder"` + 4개 언어 키
- vtag 입력 placeholder → `data-i18n-placeholder="auth_vtag_placeholder"` + 4개 언어 키

## 2026-05-06 — 로컬라이징 13차 — 정보모달/PVP허브/현상금/보호막/업적/SVG (루프 13차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 13 (43개 항목)
- `_openInfoModal` 닫기 버튼 4개 언어
- MY MINERALS 비어있음/로드실패 4개 언어
- SHIP REGISTRY 총 N척·가용 N척·로드실패 4개 언어
- PVP Hub 지갑미연결/추천상대 설명 4개 언어
- PVP Hub 온라인·오프라인 상태 점 4개 언어
- PVP Hub 섹터 접미사·오늘활동·도전장 보내기 4개 언어
- PVP 분쟁탭 전투·현상금·클레임 수·로딩실패 4개 언어
- 현상금 보드 전체: 헤더/GP최소/사유/등록/전체·내현상금·내가등록 탭/로딩중 4개 언어
- 보호막 gameConfirm body + GP비용 라벨 + confirmText 4개 언어
- `_achConditionLabel` JA/ZH 사전 29개 항목 추가 → 4개 언어 lookup
- 업적 상세 모달 labels (달성조건/보상/상태/달성됨/미달성/닫기/달성일) 4개 언어
- 아트 제출 gameInput 타이틀·레이블·confirm 4개 언어
- 렌탈 요금 gameInput 4개 언어
- 동맹 금고 입금·출금·최소출금액·메모 gameInput 4개 언어
- SVG 자산 흐름 다이어그램 라벨 8개 4개 언어 (실제화폐/인게임통화/정치권력/환전X/채굴커미션/영토보유/입금/footer)

## 2026-05-06 — 로컬라이징 10차 — 함대카드/길드/타이머/요일라벨 (루프 10차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 10
- 함대카드 함급 칩 (타이탄/전함/순양/구축/프리깃) 4개 언어
- 함대카드 편집 버튼·배치된 척·더보기 텍스트 4개 언어
- 기본 함대명 ("함대") 4개 언어 fallback
- 길드 연구 desc → 다국어 오브젝트 변환 (7종 × 4개 언어), 슬롯 잠금 "필요" 4개 언어
- 길드 레벨업 "연구 N슬롯 · 최대 N명" 4개 언어
- 길드전 없음/선포/진행 설명/함대전 버튼 전체 4개 언어
- 길드전 모달 로딩/오류/빈 상태/선포 완료 토스트 4개 언어
- 길드 전쟁 승리 버프 활성/남은시간 4개 언어
- openGuildWarFight 대화상자 4개 언어
- 동맹 탈퇴 confirm 4개 언어
- 동맹 미가입 상태 (window._lang → LANG + JA/ZH 추가)
- 길드 가입신청/탈퇴/추방/양도/해산 gameConfirm 전체 4개 언어
- 길드 기부 실패 toast 4개 언어
- 얼라이언스 길드 목록 "명" 접미사 4개 언어
- OPS 보드: 로딩/긴급이벤트(남음/지금참여)/미션(PP예상/수령완료/GP수령)/미션없음 4개 언어
- 주간 보드: 완료일/X/Y일/이번 주 보상 4개 언어
- 카운트다운 타이머: 리셋까지/만료/시간·분 포맷 4개 언어
- 요일 라벨 배열 KO/JA/ZH/EN

## 2026-05-06 — 로컬라이징 9차 — 함대전/토너먼트/파벌/버그리포트 전체 (루프 8~9차)

### 동적 JS 4개 언어 확장 (index.html) — 배치 9
- 추천 상대 없음 메시지 4개 언어
- 파벌 모달 전체 (쿨다운/선택/변경 토스트, 배지, 처리 중 버튼) 4개 언어
- 함선 마켓 (판매/취소/구매 성공·실패 토스트, 빈 리스트 문구) 4개 언어
- 함선 강화 (오류/성공/실패 forge 결과, 판매중 차단) 4개 언어
- 함선 수리/해체/실드충전 토스트 전체 4개 언어
- 함선 건조 에러맵 (NO_FACTION/RANK_REQUIRED/INSUFFICIENT 등) 4개 언어
- 함대지휘 (로드/진형/기동/이름변경/해체/함선이동) 모든 메시지 4개 언어
- Battle Hub (로딩/빈 탭/오류 상태) 4개 언어
- PVP 선언 (함대 선택 오류/자기공격/에러맵) 4개 언어
- Commander Actions 지시 적용 (증원 선택/count/에러맵) 4개 언어
- 전투 시작/종료 메시지 4개 언어
- AI 연습전 (그리드 로딩/빈/오류/선택) 4개 언어
- 토너먼트 (상태 라벨/빈 탭/참가비·상금/참가·브래킷 버튼/에러맵) 4개 언어
- Battle Viewer (ID 누락/타임라인 오류) 4개 언어
- 동맹 탈퇴 성공·실패 4개 언어
- 리플레이 (찾을 수 없음/로딩 실패/공유 없음) 4개 언어
- 전쟁 베팅 (옵션 선택/최소/에러맵) 4개 언어
- 버그 리포터 버튼/상태 텍스트 4개 언어 (전송중/제출/저장됨/완료/실패)
- 수송 취소/약탈 gameConfirm 4개 언어
- World Events 교전 실패 fallback 4개 언어

### 검증
- 전체 스캔 후 KO-only 동적 문자열 0건 (showToast/showFactionToast/innerHTML/textContent 기준)

## 2026-05-06 — 로컬라이징 전수 완성 7차 (루프 4~7차)

### 동적 JS 4개 언어 확장 (index.html)
- 함대전 발생 메시지 / 섹터 레벨 잠금 / 수송 관련 토스트 7종
- 수확 UI (로딩/쿨다운/실패/다음수확/로그인) 4개 언어
- 영토 업그레이드 확인 모달+성공/실패 토스트
- 조선소 청사진 카드 함선명/설명 syShipName() 활용
- 광물 패널 티어 제목/이름/설명 name_ja/name_zh DB 컬럼 우선
- 함대지휘 선택 패널 기함/척/선택함선
- 영토 병합 UI 전체 (모달/버튼/카운트/토스트)
- 경매/마켓 등록 성공/실패
- 길드 기부/길드전 참여
- 하이젝 에러맵 ko/ja/zh/en 4중 객체 전환
- 온보딩 직업 선택 카드 JA/ZH 번역 추가 (4개 직업 × 4항목)
- 온보딩 파벌/미션/보상 타이틀 name_ja/name_zh 지원
- 미션 미니게임 컨티뉴 제한 경고
- 글로벌 '함선'/'로그인이 필요합니다' fallback 4개 언어

### 검증
- 12개 핵심 엔드포인트 smoke: 500 에러 0건
- 모든 라우트 마운트 확인 (77/77)

## 2026-05-06 — 서버 smoke 감사 후 legacy read endpoint 보강 (Codex)

### 수정
- `server/routes/fleetBattles.js`
  - `GET /api/battles/history?wallet=...` legacy alias 추가
  - `GET /api/battles/active?wallet=...` legacy alias 추가
  - 기존 `/api/battles/list/history`, `/api/battles/list/active`는 유지
- `server/routes/ships.js`
  - `GET /api/ships/blueprints`를 선택 인증으로 변경
  - JWT가 없을 때도 `?wallet=` 또는 `x-wallet`으로 읽기 smoke 가능
  - wallet 누락은 401 대신 400 `WALLET_REQUIRED`로 분류

### 검증 메모
- `node --check server/routes/ships.js`: 통과
- `node --check server/routes/fleetBattles.js`: 통과
- `server/routes/*.js` 77개 vs `server/index.js` route require 참조 77개: 누락 없음
- sandbox 제한으로 `localhost:3000` curl 및 `localhost:5432`/socket psql 직접 접속은 `Operation not permitted`/connect fail
- `server/tools/smoke_capital_recipes.js`는 테스트 지갑 데이터 UPDATE/INSERT가 포함되어 있어 “기존 데이터 수정 금지” 제약상 실행하지 않음
- `git push` 없음

## 2026-05-06 — 전수 500 에러 제거 완료 (Claude + Codex 협업)

### 수정된 파일 및 내용

#### `server/services/shield.js`, `claimUpgrades.js`, `monuments.js`
- `c.sector_x/y` → `c.center_lng AS sector_x, c.center_lat AS sector_y` 수정

#### `server/services/tdesc.js`, `rating.js`, `tribute.js`, `sponsor.js`, `expedition.js`
- `c.name` → `c.custom_name` 수정
- `tdesc.js`: `c.x/y` → `c.center_lng/lat` 수정

#### `server/routes/auth.js`
- delete-account: `users.wallet` → `users.wallet_address`, `claims.status` → `deleted_at`

#### `server/services/staking.js`
- `ORDER BY staked_at` → `ORDER BY created_at`

#### `server/services/season.js`
- `battles.winner_wallet/attacker_wallet/gp_stake/status` 유령 컬럼 → 실제 스키마(`attacker/defender/success/attack_cost`)로 교체

#### `server/services/auction.js`
- `getUserAuctions`: `current_bidder_wallet` → `winner_wallet` + `bids` EXISTS 서브쿼리

#### `server/migrations/219_auction_current_bid_columns.sql` (신규)
- `auctions` 테이블에 `current_bid`, `current_bidder_wallet` 컬럼 추가

#### `server/services/warBetting.js`, `contest.js`, `spells.js`, `donation.js`
- wallet 비교 `LOWER()` 적용

#### `server/routes/arena.js`
- crash_bets/mines_games/hilo_games wallet 비교 `LOWER()` 적용

#### `server/services/worldEvents.js`
- 보스 보상 중복 지급 방지(idempotent), top-damage wallet 대소문자 무시

#### `server/services/achievements.js`
- `battles.winner_wallet/status` 유령 컬럼 제거, safe `[]` fallback

#### `server/routes/api.js`
- territory production sector_code 수정, upgrade column variance 처리

#### `server/routes/hallOfFameRoutes.js` (Codex)
- `titleExtended.getHallOfFameBoard()` 의존성 제거 → 로컬 구현으로 교체

### 검증
- 50+ 엔드포인트 전수 스모크 테스트: **500 에러 0건** (2026-05-06 16:54 KST)

---

## 2026-05-06 — 서버 전수 버그 수정: hijack/ai-fight/harvest/repair/tournament/admin-economy

### `server/routes/api.js`, `server/services/hijack.js`
- `/api/hijack/declare-with-pp`: 공격 함대/소유 픽셀/유저 PP/수비 claim 조회와 정산 쿼리의 `LOWER()` 지갑 비교 확인
- `fleet_battles.battle_type='hijack'`, `status='preparing'`, `phase='hijack_phase1'` 유지 확인

### `server/routes/phaseC.js`
- `/api/ai/fight`: battle/participants INSERT를 `BEGIN/COMMIT/ROLLBACK/finally release` 트랜잭션으로 원자화
- AI 함대 판별을 `fleets.is_ai` 컬럼 존재 시 + `users.is_ai` owner 기준으로 보강
- DB CHECK constraint 통과를 위해 AI 연습전 battle_type은 허용값 `pvp_duel` 유지, `battle_summary.is_ai_battle=true`로 구분

### `server/services/ship.js`
- `repairShip`, `chargeShield`: wallet 정규화 및 재료 차감 `LOWER(wallet_address)=LOWER($1)` 적용
- market-listed 함선 차단, GP 차감 트랜잭션, GP 로그 fire-and-forget 유지 확인

### `server/services/tournament.js`
- 참가 등록 wallet/fleet/user 비교를 `LOWER()` 기준으로 보강하고 참가비 GP 로그를 fire-and-forget으로 기록
- 정원 도달 시 등록 커밋 후 `startTournament()`를 호출해 브래킷 생성까지 이어지도록 수정
- tournament match의 fleet_battles/participants/match 연결을 트랜잭션으로 원자화, battle_type은 허용값 `event` 유지

### `server/routes/adminEconomyRoutes.js`
- territory economy/upgrades/admin stats 쿼리는 존재하지 않는 보조 뷰/테이블에 대해 `.catch(() => ...)` fallback이 적용되어 있음 확인

---

## 2026-05-06 — OPS 미션 전체 와이어링 + 캘린더 요일 제거 + BASE 탭 이모지 제거

### `server/routes/dailyOps.js`
- `today_dow` UTC → 로컬 시간 기준으로 변경 (UTC 고정 시 한국 기준 하루 밀림)

### `index.html`
- 7일 캘린더 스트립: 요일 이름(SUN/MON/TUE…) 제거 — 국가별 혼동 방지, 이벤트 아이콘+보너스만 표시
- BASE 메인 탭 이모지 전부 제거 (⚓ Fleet → Fleet, ⚔ PVP → PVP, 🛒 SHOP → SHOP, 📦 내 아이템 → 내 아이템)

### OPS 미션 notifyMissionProgress 전체 와이어링 (Codex 협업)
- `harvest_pp` — `/api/territory/:claimId/harvest` 성공 후
- `territory_art` — `/api/claim/:id/image` 성공 후
- `territory_upgrade`, `territory_upgrade_3` — `/api/territory/:claimId/upgrade` 성공 후
- `territory_claim` — 신규 claim 성공 후
- `daily_login` — 일일 로그인 후
- `upgrade_ship`, `upgrade_ship_3`, `upgrade_ship_5` — `ship.js upgradeShipStat()` 후
- `build_ship` — `ship.js startBuild()` 후
- `repair_ship`, `repair_ship_3` — `ship.js repairShip()` 후
- `market_list` — `ship.js listShipForSale()` 후
- `market_buy` — `ship.js buyShip()` 후
- `fleet_formation` — `fleets.js` formation 변경 후
- `craft_resource`, `craft_resource_3`, `craft_resource_5` — `resourceCraft.js` 후
- `battle_forfeit` — `fleetBattles.js` 항복 후
- `campaign_progress`, `campaign_complete` — `campaign.js` 후

---

## 2026-05-06 — Codex 감사 버그 수정 3건

### `server/routes/api.js`
- `/api/territory/:claimId/harvest`: `hold_bonus_pct` (장기 보유 보너스) + 월요일 +50% 보너스 올바른 엔드포인트에 적용
- `/api/harvest` (구버전 미사용): 잘못 추가된 보너스 블록 제거, 미사용 표시

### `server/routes/phaseC.js`
- AI 연습전은 DB CHECK constraint 허용값인 `pvp_duel`을 유지하고 `battle_summary.is_ai_battle=true`로 미션 트래킹 구분

---

## 2026-05-06 — 주간 이벤트/CPI/OPS 연동 + Field Rating 하이젝 가중 (Codex 협업)

### `server/routes/api.js`
- `harvest`: MON(월요일) +50% PP 보너스 적용 (UTC getDay===1)
- `hijack/declare-with-pp`: 수비 영토 Field Rating 구간별 attackCost 가중 (FR 0~9: ×1.0 / FR 10~29: ×1.1 / FR 30~59: ×1.25 / FR 60+: ×1.5)

### `server/services/ship.js`
- `upgradeShipStat`: FRI(금요일) 강화 GP 비용 -20% (UTC getDay===5), finalGpCost 기반으로 차감/로그/반환값 일관화

### `server/services/battleRewards.js`
- `computeReward` + `distributeMinimalRewards`: WED(수요일) 전투 GP 수령 +30% (UTC getDay===3), breakdown에 weekly_event 키 추가

### `server/services/battleScheduler.js`
- `_postBattleHooks()` 신규: 전투 종료 후 CPI 재계산 + Daily OPS 미션 트래킹 (battle_participate/battle_win/ai_battle) 자동 연동

### `server/services/battleReport.js`
- 전투 리포트 생성 시 atk/def performance_rating 계산 후 `fleet_battles.performance_rating_atk/def` DB UPDATE

---

## 2026-05-06 — 약점 개선 기획서 5대 기능 전면 구현

### `server/routes/api.js`
- `harvest`: extractor 업그레이드 보너스 뒤에 `hold_bonus_pct` 장기 보유 보너스 적용
- `hijack/declare-with-pp` 성공 시 수비 소유자에게 `territory_threatened` 알림
- `/api/territory/:claimId/production` 응답에 `holdBonusPct`, `holdDays`, 장기 보유 modifier 추가

### `server/routes/fleetBattles.js`
- `GET /api/battles/:id/highlights` 신규 — 하이라이트 3장면 (first_kill/flagship_threatened/turning_point)

### `server/index.js`
- 비활성 복귀 훅: UTC 09:00 매일, 7~30일 미접속 유저 `return_reminder` 알림 (7일 중복 방지)

### `index.html`
- Daily OPS: 7일 갤럭시 캘린더 스트립 (`#dailyOpsWeekCalendar`), 오늘 강조
- 전투 결과 리포트: 🎬 하이라이트 장면 버튼 3개, `openBattleViewerAt(battleId, tick)`
- 영토 PRODUCTION: 장기 보유 보너스 배지(정착민/토지주/개척자) + % 표시

### `assets/tactical-lab-v11.html`
- `?startTick=N` 파라미터: x8 패스트포워드 후 x1 복귀, 이동 오버레이 표시

---

## 2026-05-05 — 전투 기함 cascade 제거 / Daily OPS 30종 확장

### `server/services/battleEngine.js` — 전투 종료 조건 수정
- 기함 격침 시 전체 함대 즉시 괴멸(`fleet.dead = true`) cascade 제거
- 전투는 사이드의 **모든 함선 HP=0** 또는 항복(`forfeit`)으로만 종료
- `fleet.dead` 체크 → `f.ships.some(s => s.isAlive)` 기반으로 전환
- 기함 파괴 이벤트(`flagship_destroyed`) 로깅은 유지, 나머지 함선 전투 지속

### `server/routes/dailyOps.js` — 미션 30종으로 확장
- 13종 → 30종 (영토7 + 전투7 + 함선7 + 경제6 + 캠페인/로그인3)
- 하루 표시 미션: 5개 → 9개
- 요일별 다양한 조합 순환

### `index.html` — OPS Board + 전투 기록
- `opsMissionGo()`: 30종 미션 타입 GO 분기 전부 처리
- 주간 진척도 UI: 요일 라벨(월~일) + 오늘 강조 + 완료일 밝은 표시
- 전투 결과 카드 표시 후 `내 기록(history)` 탭 자동 갱신

---

## 2026-05-05 — 기획서 스펙 UI 정합 (전투 결과 리포트 + Territory FR)

### `index.html` — 전투 결과 리포트 UI
- `showBattleResult()` 타이틀: `'⚔ ATTACKERS WIN'` → `'⚔ 전투 결과 리포트'` (항상 고정)
- 부제목: 승리/패배 텍스트 → 함대명 `ATK함대 VS DEF함대` + 배지
- ATK/DEF 스탯 라벨: `총 함선→투입 함선`, `손실→격침`, `데미지→총 데미지`
- ATK/DEF 패널에 `나` 배지 + `WIN`/`LOSS` 배지 인라인 표시
- 타이틀 폰트: 32px/8px letter-spacing → 20px/2px (한국어 최적화)

### `index.html` — Territory Identity Field Rating 배지
- `loadTerritoryIdentity()`: FR 숫자 + 티어 레이블 + PP 보너스% 배지 추가
- 신규/개척자/정착민/요새/전설 티어별 색상 + 아이콘 + 보너스% 표시

---

## 2026-05-05 — PvP 매치메이킹 FLEET BATTLE HUB (spec 4-2)

### `server/services/battleReport.js`
- `getRecommendedOpponents`: `sector_code` / `last_battle_at` / `is_online` (1시간 기준) 반환 추가

### `index.html` — PVP 탭 FLEET BATTLE HUB 위젯
- NAVAL BATTLES + RECOMMENDED OPPONENTS + BOUNTY BOARD 3개 섹션 → 단일 `⚔ FLEET BATTLE HUB` 위젯으로 통합
- 3탭: [🎯 추천 상대] — CPI 기반 추천 / [💰 현상금] — 현상금 등록+목록 / [🔥 섹터 분쟁] — conflict-map 기반 Heat 순위
- 추천 상대 카드: 함대명 + 파벌 배지 + `●온라인/●오프라인` + CPI + 섹터 · 전투 시간 + `도전장 보내기` 버튼
- 헤더: `🔴 LIVE` (Battle Hub 모달) + `⚔ 전투 선언` 버튼
- pvp 탭 진입 시 자동 로드, `pvpHubSwitchTab('rec')` API
- 퀵 액션 그리드(FLEET CMD / AI Practice / TOURNAMENT / SHIPYARD) 하단 유지

---

## 2026-05-05 — 게임 개선 4대 기능 구현 (v6.08)

### 기획서: `docs/GAME_IMPROVEMENT_PLAN_2026-05-05.md`

### Migration 215: fleet_battles 전투 통계 컬럼 + CPI
- `fleet_battles`: `atk/def_damage_dealt`, `atk/def_flagship_survived`, `duration_ticks`, `performance_rating_atk/def`
- `fleets.cpi`: Combat Power Index 컬럼
- `ships.total_kills`: 누적 킬 카운터

### Migration 216: claims 영토 정체성 컬럼
- `nickname`, `bio`, `defense_wins`, `times_hijacked`, `battle_wins`, `field_rating`
- `badge_pioneer/settler/veteran/fortress`, `hold_bonus_pct`, `claimed_at`
- FR 공식 설정값 시드 (7/30/90일 보유 보너스)

### Migration 217: daily_ops 테이블 (Daily OPS 미션)
- `daily_ops`: 매일 UTC 00:00 리셋, wallet×date×mission_type UNIQUE
- 5종 미션 타입 + 보상 GP 설정값
- 주간 이벤트 캘린더 설정값 (월/수/금/토)

### Migration 218: bounty_listings 테이블 (현상금 게시판)
- `bounty_listings`: poster/target/reward_gp/reason/status/expires_at
- 만료 자동 환불, 수수료 5%, 최대 3개 동시 게재

### 서버: `server/services/battleReport.js`
- `generateBattleReport(battleId)` — 전투 리포트 카드 (S/A/B/C/D 레이팅, 하이라이트, MVP)
- `getPlayerBattleStats(wallet)` — 전투 통계 집계 (승률/KD/연승/파벌별 승률)
- `calcFleetCPI(ships)` / `updateFleetCPI(fleetId)` — CPI 계산/업데이트
- `getRecommendedOpponents(wallet)` — CPI 기반 추천 상대

### 서버: 신규 라우트
- `GET /api/battles/:id/report` — 전투 리포트 카드
- `GET /api/battles/my-stats/:wallet` — 플레이어 전투 통계
- `GET /api/battles/recommended-opponents/:wallet` — 추천 상대
- `GET /api/daily-ops/:wallet`, `POST /api/daily-ops/progress`, `POST /api/daily-ops/claim` — Daily OPS
- `GET /api/daily-ops/weekly-events` — 주간 이벤트 캘린더
- `GET /api/bounty/list|my-bounties|on-me`, `POST /api/bounty/post|claim|cancel/:id` — 현상금 게시판
- `GET /api/territory/:claimId/identity`, `PATCH /api/territory/:claimId/identity` — 영토 정체성
- `GET /api/sectors/conflict-map` — 섹터 갈등 지도

### 서버: 스케줄러 추가
- Territory Field Rating + Badge (매 5분 체크, UTC 00:00 실행)
- Bounty 만료 처리 + GP 환불 (매 1시간)

### 프론트: `index.html`
- **전투 결과 리포트 카드**: `showBattleResult()` → 비동기 리포트 로드, S/A/B/C/D 레이팅 표시, 하이라이트, MVP
- **내 전투 기록 모달**: `_showMyBattleStats()` — 승률/KD/연승/최고 레이팅
- **Daily OPS Board**: OPS 탭 상단에 미션 목록 + 진행바 + CLAIM 버튼
- **Territory Identity**: 영토 정보 패널에 FR/배지/보유 기간/방어 승리 표시, 닉네임/바이오 편집
- **추천 상대 (PVP 탭)**: CPI 기반 추천 상대 목록 + 도전 버튼
- **현상금 게시판 (PVP 탭)**: 등록/목록/취소 UI
- i18n: 60+ 신규 키 (EN/KO)

## 2026-05-05 — 종합 로컬라이제이션 패스 (v6.07)

### 영문/일문/중문 사용자에게 보이던 한국어 텍스트 전면 수정 (cc2c6df)
- **착륙 오버레이**: 태그라인, 기능 설명, CTA 버튼 → `data-i18n`
- **온보딩 플로우 (Step 0~4)**: 전체 한국어 텍스트 → `t()` 호출
  - 직업 선택: 언어별 직업명·설명·버프/디버프
  - 파벌 선택: 로딩·확인/취소·에러/성공 토스트
  - Step 3 (영토), Step 4 (완료): `t()` 적용
  - 보상 토스트: GP/PP/아이템/칭호 모두 `t()`
- **모달 닫기 버튼**: 모든 "✕ 닫기" → `data-i18n="btn_close"`
  (조선소·함대지휘·전쟁베팅·AI전투·토너먼트·브래킷·동맹·리플레이·배틀뷰어)
- **전쟁 베팅 탭**: `data-i18n="wb_tab_*"`
- **조선소 마켓 정렬**: `data-i18n="sy_sort_*"`
- **배틀뷰어 결과**: 승리/패배/무승부 및 통계 레이블 → `t()`
- **배틀 목록 카드**: 상태 레이블(대기/라이브/공격승/수비승), 전투 유형 맵, 결과 레이블
- **PVP 탭**: 공성전·함대전 설명 블록 `data-i18n`, AI연습전·토너먼트·조선소 버튼
- **함대 빈 상태**: `t('fleet_no_fleet_hint')`, `t('fleet_no_ships_hint')`
- **함대 전투 오류 토스트**: 전투 가능한 함대 없음 → `t()`
- **길드전 자동승리 다이얼로그**: 제목·본문·버튼·에러맵·토스트 → `t()`
- **인벤토리 필터 버튼**: `data-i18n="inv_cat_*"`
- **영토 탭 제목·로그인 힌트**: `data-i18n`
- **하이젝 함대 없음 경고·로딩**: `data-i18n`
- **함선 레지스트리 광물 카탈로그**: 언어별 티어 제목·광물명·설명
- 총 EN/KO 1499 키 (이전 1440), JA/ZH는 신규 키에서 EN 폴백 적용

## 2026-05-05 — 영토별 개별 수확 + 채굴 탭 제거 (v6.06)

### 신기능: 영토별 개별 수확 API (`POST /api/territory/:claimId/harvest`)
- `claims.last_harvest_at` 컬럼 추가 (Migration 214)
- 각 클레임별 독립 쿨다운 (CORE=24h / MID=48h / FRONTIER=72h)
- 기존 `user_mining` stats와 호환 유지 (일일/전체 채굴 통계 누적)
- 모든 보너스 적용 (거버너·섹터 버프·날씨·VIP·위상·티어·업그레이드)
- 자원 드롭 포함 (sector tier 기반)
- `_baseTerritoryHarvest(idx)` → 신규 API 호출, 쿨다운 시 남은 시간 표시

### 채굴 탭 제거 + GP 섹션 영토 탭 하단 이동
- `baseTabMining` + `basePane_mining` 제거
- GP Activity Log / SEND GP / GP LOTTERY / GP STAKING → 영토 탭 하단으로 이동
- 채굴 통계 요소(`baseMineAvail` 등) 숨김 유지로 JS 참조 호환

### 가이드(GUIDEBOOK) 업데이트
- 채굴 섹션: "BASE → MINE 탭" 언급 제거
- 영토 탭 아코디언에서 개별 수확하는 방법 안내 추가 (한/영)
- 광물 드롭 테이블 섹션 추가: FRONTIER(T1) / MID(T2) / CORE(T3) × 용도
- 강화 티어와 드롭 연결 callout 추가

## 2026-05-05 — 영토 목록 아코디언 + 패널 UX 개선 (v6.05)

### 신기능: BASE 내 영토 목록 인라인 아코디언
- `▶` 클릭 시 지구본 이동 → 인라인 아코디언 확장으로 변경
- 아코디언 본문: 예상 PP, 섹터 타입, 최근 수확, 드롭 광물 목록
- 빠른 액션 버튼: ⛏ 수확 / 🛡 보호막 / 🔧 업그레이드 / 🌐 지도
- 🌐 지도 버튼만 지구본으로 이동 (나머지는 BASE 내에서 처리)
- `_baseTerritoryAccordion()` / `_bterrLoadProd()` 신규 함수 추가
- 확장 상태 `_baseTerritoryExpanded{}` 에 유지 (탭 전환 시 복구)

### 영토 정보 패널 UX 수정
- RENAME 버튼 제거 (영토 이름이 화면에 표시되지 않아 사용성 없음)
- 보호막 버튼 `gameConfirm` 호출 방식 수정 (구 3-arg → 신 object 형식)
  - 보호막 버튼 클릭 시 아무 반응 없던 버그 수정
- 업그레이드 패널: 토글 제거, 내 영토 선택 시 자동 확장 + 즉시 데이터 로드
- `scrollToTerritoryUpgrade()` 신규 함수 (모바일 업그레이드 버튼 연결)

## 2026-05-05 — 서브탭 폰트/패딩 개선 (v6.04)

### UI: BASE 탭 가독성/터치 영역 개선
- `.base-tab` 폰트 10px → 13px, 패딩 `9px 12px` → `11px 16px`, min-height 44px
- `.bcat` (상단 카테고리 필) 폰트 10px → 13px, 패딩 `6px 14px` → `8px 18px`, min-height 36px
- `.base-inv-cat` (내 아이템 카테고리 탭) 인라인 스타일 → CSS 클래스로 통합, 폰트 9px → 12px, 패딩 `4px 10px` → `7px 14px`
- `filterBaseInv()` 인라인 스타일 강제 제거 → CSS 클래스 `.active` 위임

## 2026-05-05 — 강화 확인 모달 정보 표시 버그 수정 + Forge 애니메이션 (v6.03)

### 버그 수정: 강화 확인 모달 성공률/재료 미표시
- **원인**: `s.id === shipId` 엄격 일치 실패 (서버는 string `'208'`, onclick은 number `208`) → `ship` 조회 undefined → `offer` undefined → info 테이블 숨겨짐
- **수정**: `String(s.id) === String(shipId)` 비교로 변경

### 신기능: Forge 강화 애니메이션 모달 (`index.html`)
- 강화 확인 후 망치 뚝딱 애니메이션 + 게이지 바 표시 (2.4초)
- 망치 6회 스윙 + 타격 시 스파크 파티클 (Canvas 기반)
- API 호출과 애니메이션 병렬 진행 (`Promise.all`)
- 결과 표시:
  - ✅ 성공: 초록 글로우 + 스파크 버스트 + `+N스탯 (MOD X)`
  - 💔 실패: 주황/붉은 게이지 + GP 소모 확인
  - ⚠ 오류: 빨간 글로우 + 에러 코드
- 결과 서브텍스트: `-GP  ·  확률%  ·  굴림값`

### 강화 확인 모달 정보 개선
- 성공 확률, GP 비용(보유량 포함), 재료명+보유/필요 수량 info 테이블 표시
- `material_tier`, `upgrade_level` 서버 응답에 추가 (`ship.js` upgradeOffers)

## 2026-05-05 — 함선 강화 티어 재료 시스템 (v6.02)

### 함선 강화 재료 티어 시스템 (`server/services/ship.js`, `index.html`)
- 강화 횟수(upgrade_level)에 따라 요구 재료가 T1→T2→T3으로 상승
  - Lv 0-4 (강화 1~5회): T1 기본 광물
  - Lv 5-9 (강화 6~10회): T2 희귀 광물
  - Lv 10+ (강화 11회~): T3 전설 광물
- 스탯별 재료 매핑:

| 스탯 | T1 | T2 | T3 |
|------|-----|-----|-----|
| 공격력 | 탄소섬유 | 플라즈마 결정 | 이그조틱 합금 |
| 방어력 | 철광석 | 티타늄 합금 | 장갑판 |
| 체력 | 실리콘 칩 | 운석 파편 | 합금 프레임 |
| 속도 | 현무암 조각 | 나노 폴리머 | 암흑물질 |

- 강화 확인 모달에 현재 티어(T1/T2/T3) 색상 배지 표시
- "X회 후 T2 희귀 재료 필요" 예고 텍스트 표시
- 강화 버튼에 티어 배지 (초록=T1, 파랑=T2, 보라=T3)
- 높은 강화 함선은 희귀 재료가 소모된 만큼 마켓 가치 차별화

## 2026-05-05 — 함선 강화 재료 T1 광물로 수정 (v6.01)

### 버그 수정: 함선 강화 항상 실패 (`INSUFFICIENT_MATERIALS`)
- **원인**: `ship_upgrade_*_material` 설정값이 T2/T3 재료(`plasma_crystal`, `titanium_alloy`, `alloy_frame`, `nano_polymer`)로 되어 있었는데, 초반 플레이어는 T1 광물만 보유 → 항상 재료 부족 실패
- Migration 213: 강화 재료를 T1 광물로 변경
  - `atk` 공격력: `plasma_crystal` → `carbon_fiber` (탄소섬유, T1)
  - `def` 방어력: `titanium_alloy` → `iron_ore` (철광석, T1)
  - `hp` 체력: `alloy_frame` → `silicon_chip` (실리콘 칩, T1)
  - `speed` 속도: `nano_polymer` → `basalt_chip` (현무암 조각, T1)
- `server/services/ship.js` `calcShipUpgradeOffer` fallback 값도 동일하게 수정

## 2026-05-05 — 전술랩 미사일/EMP/사운드/플로팅텍스트 대폭 개선 (v6.00)

### 전술랩 미사일 개선 (`assets/tactical-lab-v11.html`)
- 미사일 속도 1.55-2.0 → 0.85-1.05 px/frame 감속, TTL 150 → 240 프레임 (착탄 2~3초)
- 유도 미사일(homing): 발사 8프레임 후 타겟 방향 0.045 비율 조향, 곡선 탄도
- 부채꼴 발사 (fan barrage): ±0.35rad 산탄 효과
- 충전 속도 약 55% 감소 (`0.0021+n×0.00007`)
- 미사일 비주얼: 주황 그라디언트 꼬리 + 흰 발광 탄두

### EMP — EWAR(재머) 함선 요구 + 충전 게이지 시스템
- EW Frigate 없으면 버튼 disabled + "재머없음" 표시
- EWAR 함선 수에 비례해 충전, 100% 도달 시에만 발동
- 발동 시 재머 함선 위치에 `⚡ EMP` 플로팅 텍스트 + 충전 초기화

### 오디오 시스템 전면 개편
- 빔/레이저: 충전 180→2200Hz + 방전 2800→90Hz 톱니 + 노이즈 꼬리 (건담 스타일)
- 빔포: 와인 + "콰아앙" 저음 + 심저음 레이어
- BGM: 138bpm 4/4 루프 (킥/스네어/하이햇/베이스/리드)
- `visibilitychange`/`pagehide`: 탭 숨김 시 자동 정지, 복귀 시 재개

### 플로팅 월드좌표 텍스트
- 피격/이벤트 메시지가 해당 함선 위치에서 떠오름 (카메라 추종)
- 기함 격침, EMP 발동, 패닉/피해 이벤트 연동

### 전투 메시지 + 카메라 개선
- bottom slot 메시지 → 상단 div 라우팅 (컨트롤패드 겹침 해소)
- 카메라 lerp 0.025 → 0.06, initBattle 즉시 중심 설정 (jitter 제거)
- 5v5+ 함대 레이블 화면 이탈 방지 (Y clamp +32px)

## 2026-05-05 — 영토 병합 + 임대 버그 + 캠페인 CH2 밸런스 (v5.99)

### 신기능: 영토 병합 (Territory Merge)
- `POST /api/territory/merge` — 여러 영토 클레임을 하나로 병합하는 서버 엔드포인트 추가 (`server/routes/api.js`)
  - body: `{ wallet, claimIds: [id1, id2, ...] }` (2~50개)
  - 검증: 소유권, soft-delete 여부, 활성 임대, 활성 전투, marketplace_locked 체크
  - 모든 픽셀의 `claim_id` → 신규 병합 클레임으로 재할당
  - `territory_upgrades`도 최고 레벨 기준으로 병합 클레임에 복사
  - 기존 클레임 soft-delete (`deleted_at = NOW()`)
  - 바운딩 박스 기반 `center_lat/lng`, `width/height` 자동 계산
- `index.html` 내 영토 정보 패널에 `🔗 MERGE TERRITORIES` / `🔗 영토 병합` 버튼 추가
  - 소유자 전용 표시 (`infoMergeBtn`)
  - `openTerritoryMergePanel()` — 내 영토 체크박스 목록 모달. 현재 영토 기본 선택
  - `doTerritoryMerge()` — 병합 실행 + 완료 후 클레임 재로드
- 4개 언어 i18n (`merge_btn`) 추가: EN/KO/JA/ZH

### 버그 수정: 영토 임대 버튼 미동작
- `openListForRentModal()` — `/api/user/my-territories` 응답이 `{ territories: [...] }` 래퍼로 오는데 `.length` 직접 체크해 항상 "영토 없음" 알림이 뜨던 버그 수정
  - `data.territories || data || []` 로 배열 추출
  - 영토 이름 표시도 `custom_name` 우선으로 개선

### 버그 수정: 캠페인 CH2 실패 임계값 완화
- `server/services/campaign.js` — `simulateCh2()` 시설 HP 실패 임계값 80 → 65
  - 최적 선택(`ch2_request_support`)으로 항상 통과 가능하도록 조정 (기존: 40% 확률 실패)
  - 시드 기반 RNG로 특정 wallet이 항상 실패하는 문제 해소
  - `ch2_intel_query`: ~7% 실패율, `ch2_warn_civilians`: ~27% 실패율로 조정

## 2026-05-05 — P5 버그 수정 + 캠페인 보상 실물화 (v5.98)

### 버그 수정: Extractor 수확 보너스 미반영 (재무 무결성)
- `POST /api/harvest` — `territory_upgrades` 테이블의 extractor 업그레이드 레벨을 실제 PP 수확량에 반영하지 않던 버그 수정 (`server/routes/api.js`)
  - PP는 USDT 1:1 스왑 가능한 실물 화폐이므로 수확 정확도는 재무 무결성 이슈
  - MAX(extractor level) 쿼리 → bonusMap (Lv1=+15%~Lv5=+100%) 적용 후 `harvestedPP` 재계산

### 버그 수정: 캠페인 보상 placeholder → 실물 지급
- `server/services/campaign.js` — 미지급 placeholder 보상 전종을 실제 DB 재료(+GP)로 교체
  - `ship_blueprint/data_artifact/safe_house_access/permanent_buff/residence/corporate_asset/gp_stream/weapon_system/title_position` 등 → exotic_alloy/quantum_core/xenomatter/plasma_crystal 등 실물 재료
  - CH10 엔딩 보상 GP 증액 (ending_2: 800k→1.2M)
  - `lifeline_supply_ship`(존재하지 않는 코드) → `fsp_logi` (유효 함선 코드)
  - `campaignShipRewardPlan` single 맵에 `fsp_logi`, `fsp_logi_crs` 추가

### 버그 수정: 다국어 로컬라이징
- `index.html` `_campaignStoryText()` — 비한국어 유저의 fallback 우선순위를 `ko` → `en`으로 수정 (일어/중국어 선택 시 한글 노출 차단)
- 캠페인 챕터 목록 location 표시도 언어별 분기 (`displayNameEn` / `displayNameKo`)
- `campaignObjectiveActionLabel()` 일어/중국어 번역 맵 추가
- 33개 챕터 제목에 `ja`/`zh` 번역 추가

### 버그 수정: P5 API 경로 오류
- `server/routes/api.js:5219` `require('./db')` → `require('../db')` (영토 업그레이드 GP 로그 silent 실패 수정)
- `server/routes/adminEconomyRoutes.js:456` `materials_used` → `minerals_used` (admin 재료 소각 통계 컬럼명 오타)
- `index.html` `_territoryUpgradeState` reset 시 undefined 참조 방어 코드 추가

## 2026-05-05 — P5-3~7 Territory Full Utility Stack (v5.97)

### P5-3: Shipyard Connection
- `GET /api/ships/blueprints` 응답에 `materialSectorHints` 포함 (`server/routes/ships.js`).
  - `sector_resource_rates` 기반으로 재료별 주요 드롭 섹터(`frontier/mid/core`) 맵 생성 (10분 캐시).
  - `GET /api/ships/resource-sector-hints` 독립 엔드포인트 추가.
- `index.html` 조선소 카드에 재료 칩 옆 섹터 뱃지 추가 (`⛏ 개척지 / ⛏ 중간지 / ⛏ 핵심지`).
  - `shipyardState.materialSectorHints` 저장.
  - `sySectorBadge(resourceCode)` 헬퍼 추가.
  - `syBuildRequirementInfo()` 에도 섹터 정보 포함.

### P5-4: Territory Upgrades & Roles
- `server/migrations/211_territory_upgrade_p5_tracks.sql` — P5 업그레이드 트랙 settings 시드.
  - 5개 트랙: `extractor`, `refinery`, `shield_grid`, `relay_tower`, `art_beacon` (각 5레벨).
- `server/services/claimUpgrades.js` — P5 트랙 정의 + 설정 로딩 확장.
  - `effect` 필드: `material_drop / advanced_material / defense / visibility / pp_bonus`.
  - `getSettings()` 이제 `upgrade_%` 패턴으로 모든 업그레이드 설정 동적 로드.
  - `getUpgradeCatalog()` 에 `isP5`, `effect`, `nameEn` 포함.
- `GET /api/territory/:claimId/upgrades?wallet=` 신규 엔드포인트.
- `POST /api/territory/:claimId/upgrade` 신규 엔드포인트 (기존 `upgradeTerritory` 서비스 재사용).
- `GET /api/territory/:claimId/production` — 업그레이드 보너스 모디파이어 포함.
- `index.html` 영토 정보 패널에 `🔧 UPGRADES` 접힘 섹션 추가.
  - `toggleTerritoryUpgradePanel()`, `loadTerritoryUpgrades()`, `renderTerritoryUpgradeBody()`, `doTerritoryUpgrade()` 함수 추가.

### P5-5: Sector Control
- `GET /api/sectors/control` — 전체 섹터별 컨트롤 스코어 (픽셀+업그레이드+수확 활동).
  - 상위 3위 + 영향력 티어 (presence/stakeholder/dominant/governor).
- `GET /api/sectors/:sectorId/control?wallet=` — 단일 섹터 상세 + 내 위치.
- `index.html` 프로덕션 패널 하단에 섹터 컨트롤 리더보드 append (`_appendSectorControl()`).

### P5-6: Admin Economy Tuning
- `server/routes/adminEconomyRoutes.js` — 3개 신규 엔드포인트:
  - `GET /api/admin/territory/economy` — 재료 발행량, 수확 통계, 의심스러운 고빈도 수확자, 상위 클레임.
  - `GET /api/admin/territory/upgrades` — 업그레이드 분포 및 GP 소각.
  - `GET /api/admin/territory/sector-control` — 섹터별 컨트롤 현황.
  - `POST /api/admin/territory/production-profile` — 생산 설정 수정.
- `admin.html` — `🌍 TERRITORY` 탭 추가 (수확 통계, 재료 발행/소각, 의심 수확자, 상위 클레임, 생산 프로파일 편집기).

### P5-7: Campaign & Season Integration
- `server/services/campaign.js` objectiveState에 2개 신규 지표:
  - `materialHarvests` — 재료 드롭이 있는 수확 횟수.
  - `territoryUpgradeLevels` — 소유 업그레이드 레벨 합산.
- MCC CH1 objectives에 `first_material_harvest` (optional) 추가.
- MCC CH2 objectives에 `territory_upgrade_start` (optional) 추가.
- `getMissingRequiredObjectives()` — `optional: true` 목표는 챕터 완료 gate에서 제외.

검증:
- `server/services/claimUpgrades.js` load OK
- `server/routes/ships.js` load OK
- `server/services/campaign.js` load OK
- `api.js` syntax check OK
- migration 211 DB 적용 완료

## 2026-05-05 — P5-2 Material Drops on Harvest + Doc Sync (v5.96)

**재료 드롭 트랜잭션 통합**
- 수확 시 재료 드롭을 COMMIT 전 트랜잭션 안에서 처리하도록 변경 (`server/routes/api.js`).
  - `rollResourceDrop()` 는 SELECT만 하므로 COMMIT 전 호출 안전.
  - `addResourcesToInventory(client, ...)` — pool 대신 트랜잭션 client 전달.
  - `transactions.meta.resourceDrops` 에 드롭 결과 포함 (이전에는 meta에 없었음).

**프론트 수확 알림 개선**
- 수확 결과 알림이 PP + 재료 드롭을 통합 표시 (`showNotification` + `showToast`).
- 아이콘/이름 매핑을 22종 전체로 확장 (이전: 9종). KO/EN `LANG` 변수 분기.
- `loadTerritoryProduction()` lastHarvest 패널에 재료 드롭 칩 추가.

**문서 동기화**
- `docs/TERRITORY_UTILITY_PLAN`, `CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER`, `GAME_IMPLEMENTATION_PLAN` — P5-4~7 포함 풀 플랜으로 동기화.

**캠페인 씬 i18n (v5.94 완료)**
- 39개 씬 JSON 파일 전체 `ja`/`zh` 번역 완료. KO=JA=ZH 동수 검증.

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — P5-1 Territory Production Visibility (v5.95)

**서버 신규 엔드포인트**
- `GET /api/territory/:claimId/production?wallet=...` 추가.
  - claim 소유 여부 확인, 픽셀 수 + 섹터 유형(frontier/mid/core) 집계.
  - `sector_resource_rates` + `resources` JOIN으로 해당 섹터 드롭 재료 목록 반환.
  - 예상 PP 범위(`ppMin`/`ppMax`) — 기존 harvest 공식(`rewardMin × pixelFactor × sectorMult`) 그대로 사용.
  - 모디파이어: 섹터 유형 보너스, 이미지 등록 여부, adjacency_bonus.
  - 소유자일 때만 최근 수확 이력(`lastHarvest`) + 다음 수확 가능 시각(`nextHarvestAt`) 포함.
  - missing sector/resource 테이블 safe fallback — 500 에러 없음.

**프론트 territory info 패널**
- 내 영토 상세 패널에 `⚙ PRODUCTION` 섹션 추가 (`infoProdRow`/`infoProdBody`).
  - 예상 PP 범위, 섹터 유형, 모디파이어 칩, 드롭 광물 칩(% 표시), 최근/다음 수확 정보.
  - KO/EN 다국어 대응 (lang 기반 레이블 선택).
  - 남의 영토에는 production 섹션 노출하지 않음.
- `loadTerritoryProduction(claimId, wallet)` JS 함수 추가.
- `_timeAgo(date)` 헬퍼 추가.

**범위 밖 (아직 미구현)**
- 섹터 컨트롤, 영토 역할, 영토 업그레이드, 생산 배율 경제 영향.
- P5-2 (재료 드롭 harvest 연동), P5-3 (조선소 연결) — P5-1 안정화 후 진행.

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과
- `git diff --check` 통과
- DB 쿼리 smoke test 통과 (claimId=307, frontier 10종 rates)

## 2026-05-05 — Campaign dialogue & objective full i18n (v5.93)

**스토리 렌더러 다국어화**
- `_campaignStoryText(value)`: LANG 변수 기반으로 `value[lang]||value.ko||value.en` 우선순위 체인으로 텍스트를 반환한다. 이전에는 항상 `.ko` 고정이었다.
- `_campaignStorySpeakerName(id)`: KO/EN/JA/ZH 4개 언어 이름 맵 추가. 23개 캐릭터 ID (리팡, 천 회장, 미하일 등) 를 언어별로 적합한 이름으로 반환한다.
- `ch.title`, `ch.location.displayName` — `.ko` 하드코딩 제거, `_campaignStoryText()` 사용.
- `showCampaignBriefing()`: briefing 라인과 선택지 라벨이 `_campaignStoryText(l)` / `_campaignStoryText(c.label)` 로 다국어화.
- `showCampaignSim()`: 무전/진행상태/상세 문자열을 `t()` i18n 키로 교체.
- 스토리 컨트롤 버튼(SKIP/나가기/탭하여 계속)과 abandon 확인 다이얼로그를 `t()` 키 사용.
- `campaignObjectivesHtml()`: `o.label` 다국어 객체를 `_campaignStoryText()` 로 읽어 표시.

**campaign.js 서버 사이드**
- `OBJECTIVE_PRESETS` 75개 이상 objective 항목 전체에 `labelEn` 추가 (프롤로그 + MCC/FSP/CV CH1-10).
- `buildChapterObjectives()`: `label: {ko, en}` 객체를 `labelKo`와 함께 API 응답에 포함.
- `publicChapter()`: `choices`도 `label: {ko, en}` 포함.
- `getMissingRequiredObjectives()`: missing objectives에도 `label: {ko, en}` 포함.

**신규 i18n 키 (EN/KO/JA/ZH)**: `campaign_sim_in_progress`, `campaign_sim_radio_prefix`, `campaign_sim_radio_default`, `campaign_sim_syncing`, `campaign_sim_detail`, `story_skip`, `story_skip_title`, `story_abandon`, `story_abandon_title`, `story_tap_hint`, `story_abandon_confirm_title`, `story_abandon_confirm_body`.

**씬 JSON**: 39개 파일 전체 KO+EN 동수 텍스트 확인 — 렌더러가 이제 EN 언어 설정 시 영어 대사를 표시한다.

검증:
- `node --check server/services/campaign.js` 통과
- I18N 4개 언어 key parity 1357 ✓
- `git diff --check` 통과

## 2026-05-05 — Campaign result/objective-gate i18n (v5.92)

- `showCampaignResult()` 내 '임무 완료'/'임무 실패'/'작전 목표 달성' 등 하드코딩 한국어를 `t()` 호출로 교체.
- `completeCampaignMission()` OBJECTIVE_REQUIREMENTS_NOT_MET 게이트 메시지도 `t()` 사용.
- `pollCampaignProgress()` status/detail 텍스트 한국어 하드코딩 제거.
- `gov_fleet_empty` 키를 KO/JA/ZH에 추가해 전 언어 1345 키 동수 달성.
- 신규 키 13종: `campaign_result_success/failure`, `campaign_result_npc_success/failure`, `campaign_result_reward/confirm/recheck`, `campaign_objectives_gate/gate_sub` — EN/KO/JA/ZH 전부.

검증:
- I18N 전 언어 key parity 1345 ✓
- `git diff --check` 통과

## 2026-05-05 — Campaign UI i18n localization (v5.91)

- `renderCampaignList()` 내 버튼 텍스트/메타 라벨/잠금 토글 문자열을 `t()` 호출로 교체.
- `campaignObjectiveActionLabel()` 언어별 맵으로 한국어(내 영토/조선소/함대/전투/마켓)와 영어(MY LAND/SHIPYARD/FLEET/BATTLE/MARKET)를 분리.
- 신규 i18n 키 15종: `campaign_btn_start/continue/results/locked`, `campaign_label_completed/prologue/route/ch`, `campaign_no_chapters/no_faction`, `campaign_show_locked/hide_locked`, `campaign_meta_sim`, `campaign_reward_claimed`, `campaign_objective_go` — EN/KO/JA/ZH 전부.

검증:
- `git diff --check` 통과

## 2026-05-05 — Static QA: CV campaign simulator bug fix (v5.90)

- **[버그 수정] CV 챕터 시뮬레이터 없음**: CV CH1~CH10 전체가 `simulateChapter()`에서 MCC CH1(`simulateCh1`)으로 폴백되는 버그를 수정했다. `simulateCvChapter(progress)` (CH1~9 공통)와 `simulateCvCh10(progress)` (엔딩)를 추가하고 `simulateChapter()` 분기에 등록했다.
- **[버그 수정] CV 보상 계산기 없음**: `calculateRewards()`도 CV 챕터에서 MCC CH1 보상으로 폴백되는 버그를 수정했다. `calculateCvChapterRewards(progress, sim)` (CH1~9)와 `calculateCvCh10Rewards(progress, sim)` (엔딩 A/B/C/D 분기)를 추가했다.
- **[버그 수정] CV_CH*_ID 상수 미정의**: `CV_CH1_ID` ~ `CV_CH10_ID` 상수 10개를 파일 상단에 추가했다. FSP와 동일한 패턴.
- **[버그 수정] CV CH10 ending choice 미검증**: `complete()`의 ending choice 요구 조건이 MCC CH10만 확인했다. `FSP_CH10_ID`, `CV_CH10_ID`를 포함하는 조건으로 확장했다. CV CH10은 `validateChapterChoice` 함수가 처리하지 않으므로 choice 요구만 적용하고 라우트 검증은 skip.
- **[버그 수정] cv_raider / cv_bomber 함선 코드 미매핑**: `campaignShipRewardPlan`에 `cv_raider→cv_int`, `cv_bomber→cv_bomb`, `cv_titan→cv_titan`, `fsp_ironclad→fsp_bs` 매핑을 추가했다. 미매핑 상태로는 inbox 함선 보상 수령 시 빈 함선이 지급되는 대신 추상 보상 안내만 나왔다.
- **정적 QA 통과 항목**: 마켓 필터 `size_class` 불일치 없음, objective stat 키 전체 정합, battleEngine bonus_* null 가드, cmdFocus sort null 가드, campaign_reward_inbox 컬럼명 일치 확인.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-05 — Ship market filter/sort UI (v5.89)

- **파벌 필터 칩 추가**: SHIP MARKET 탭 상단에 ALL / MCC / FSP / CV 파벌 필터 칩을 추가했다. 선택한 파벌 코드와 일치하는 함선만 표시된다.
- **크기 필터 칩 추가**: ALL / FRG / DES / CRU / BS / TTN 크기 필터 칩을 추가했다. `size_class` 기준으로 클라이언트 side 필터링.
- **정렬 드롭다운 추가**: 가격 낮은순 / 높은순 / 강화 높은순(bonus_atk+def+hp+speed 합산) / 최신 등록순 정렬을 선택할 수 있다.
- **결과 카운트 표시**: 필터 조건 적용 시 "N / 전체" 형식으로 표시 항목 수를 보여준다. 조건에 맞는 항목이 없을 때는 별도 안내 메시지.
- **기존 blueprints SIZE 필터와 충돌 없음**: blueprints용 `syFilters` 바는 blueprints 탭에만 표시되고, market 필터는 `syMarketTab` 내부에 독립 삽입돼 탭별 필터가 상호 간섭하지 않는다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — Fleet battle readability polish (v5.88)

- **레이저 가시 시간 연장**: 일반 레이저 fireType의 TTL을 함선 크기별로 차등화했다. 타이탄은 120프레임(~2s), 전함 100프레임(1.67s), 순양함 78프레임(1.3s), 그 외 48프레임(0.8s). 기존 10프레임(167ms)에서 전투 가독성이 대폭 향상된다.
- **대형함 함대 이동 속도 제한**: `mkFleet`이 기함 함선 크기 기반 `maxSpd`를 계산한다. 타이탄 기함 함대는 0.22, 전함 0.28, 순양함 0.36, 구축함 0.42, 프리깃 0.44. 대형함 중심 함대가 소형함 함대보다 눈에 띄게 느리게 이동한다.
- **EMP 시각 효과 추가**: EMP 발사 시 DEF 함대 위치에 이중 충격파 shockwave를 표시해 EMP가 뭔가 했다는 시각적 피드백을 제공한다.
- **집중공격 시각 효과 추가**: 집중공격 대상 함대에 타겟팅 shockwave를 표시한다.
- **mixed 레이저 TTL 개선**: mixed fireType의 레이저 보조 빔도 7프레임→40프레임으로 연장.

검증:
- `tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-05 — CH4~CH10 objective wiring + reward note hardening (v5.87)

- **MCC CH4~CH10 목표 와이어링**: `OBJECTIVE_PRESETS`에 MCC CH4~CH10 7개 챕터를 추가했다. 각 챕터에는 `completedFleetBattles`, `fleetShips`, `marketListings`, `shipUpgrades`, `campaignRewardClaims` 중 1~2개의 실-DB 집계 기반 stat 목표가 포함되며, 서버 hard gate를 통과해야 챕터를 완료할 수 있다.
- **FSP CH2~CH10 목표 와이어링**: FSP CH2~CH10 9개 챕터를 추가했다. 서사적 선택이 있는 챕터는 `choice` + 1개 stat 목표, 전투 중심 챕터는 `completedFleetBattles`/`fleetShips` 목표를 가진다.
- **CV CH2~CH10 목표 와이어링**: CV CH2~CH10 9개 챕터를 추가했다. 습격·확장·총력전 서사에 맞게 stat 목표를 설계했다.
- **추상 보상 타입별 안내 메시지**: `applyClaimedInboxReward`가 `ship_blueprint`, `ship_choice`, `asset`, `resource_stream`, `contract`, `data_artifact` 각 타입에 대해 명확한 한국어 안내 메시지를 반환한다.
- **보상 수령 토스트 개선**: `claimCampaignReward`가 서버의 `note` 필드를 우선 표시하고, 실제 지급된 경우에는 `applied` 목록(함선·자원·아이템 코드와 수량)을 토스트로 보여준다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Local cleanup tracked DS_Store removal (v5.84)

- **로컬 찌꺼기 정리**: `.gitignore`에는 이미 등록되어 있었지만 과거에 추적된 `assets/campaign/characters/.DS_Store`를 저장소에서 제거했다.
- **정리 범위 통제**: 미추적 `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 기획/리서치 문서일 수 있어 자동 삭제하지 않고 로컬에 남겼다.

검증:
- `git diff --check` 통과

## 2026-05-04 — Campaign CH2 objective clarity + completed card guard (v5.83)

- **완료 카드 판정 보강**: 캠페인 카드 렌더링이 `status` 문자열만 직접 비교하지 않고 정규화 helper를 사용한다. `completedAt`이 있는 완료 진행도도 compact 완료 카드로 처리해 완료 챕터가 풀카드로 풀리는 위험을 줄였다.
- **결과 모달 판정 보강**: 완료/실패 결과 화면도 같은 status helper를 사용해 상태 문자열 차이로 결과 라벨이 흔들리지 않게 했다.
- **CH2 진행 목표 보강**: MCC CH2에 “작전에 투입할 함선 3척을 함대에 배치” objective를 추가했다. 단순히 함대 1개만 있으면 진행 조건이 끝나는 느낌을 줄이고, 캠페인이 함대 편성 루프로 더 명확히 이어진다.
- **함대 배치 수 집계**: 캠페인 `objectiveState.fleetShips`를 추가해 살아 있고 판매중이 아니며 함대에 배치된 함선 수를 서버에서 내려준다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Ship economy visibility + Fleet Command sale locks (v5.82)

- **제작 재료 가시성**: 조선소 청사진 카드가 조건 부족 상태여도 보유 재료까지 흐려 보이지 않게 조정했다. 재료 칩은 `보유`/`부족` 라벨과 색으로 상태를 보여준다.
- **강화 버튼 정보 강화**: 강화 버튼 안에 성공 확률과 강화 재료 보유량/필요량을 함께 표시한다.
- **판매중 함선 잠금 강화**: Fleet API에서 판매중 함선의 이동, 기함 지정, 자동 기함 지정 경로를 `SHIP_LISTED_FOR_SALE`로 차단한다.
- **함대지휘 세로 진형 개선**: Fleet Command 미리보기의 쐐기/스크린/핀서/구형 배치를 세로 전장 기준으로 재정렬했다.
- **세로 기동 표기**: 전진/후퇴 기동 아이콘과 설명을 `↑/↓` 기준으로 바꿔 함선 방향과 맞췄다.

검증:
- `node --check server/services/fleet.js` 통과
- `node --check server/routes/fleets.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign ship reward fulfillment (v5.81)

- **함선 보상 실지급**: 캠페인 보상함에서 `ship`/`ship_fleet` 타입 보상을 수령하면 실제 `ships` 레코드가 생성된다.
- **보상 코드 매핑**: Shard, Longeye, Prometheus, Sequoia, Ironclad, MCC 함대 패키지 등 캠페인 보상 코드를 현재 `ship_types` 22종 코드에 연결했다.
- **기본 함대 자동 생성**: 보상을 받을 함대가 없으면 `wedge/advance` 기본 함대를 만들고 지급 함선을 넣는다.
- **기함 처리**: 함대에 기함이 없고 해당 함종이 기함 가능하면 첫 지급 함선을 자동 기함으로 지정한다.
- **장기 보상 분리**: 설계도/선택권/계약/자산 보상은 아직 별도 시스템이 없으므로 보상함 안전 수령 처리에 남겨둔다.

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign reward inbox claim flow (v5.80)

- **캠페인 보상함 UI**: BASE/퀘스트의 캠페인 패널에서 미수령 보상을 카드로 보여주고 바로 수령할 수 있게 했다.
- **보상 수령 API**: `/api/campaign/reward/claim`을 추가해 wallet/reward id 검증, row lock, 중복 수령 방지, 수령 완료 처리를 수행한다.
- **실제 인벤토리 지급**: 보상 코드가 `resources`나 `item_types`에 매칭되면 자원/아이템 인벤토리에 적립된다.
- **서사형 보상 안전 처리**: 아직 독립 시스템이 없는 함선 선택권, 계약, 자산, 데이터 보상은 캠페인이 막히지 않도록 수령 처리와 로그 기록까지 진행한다.
- **상태 확장**: 캠페인 상태 응답의 `rewardInbox`에 `id`를 포함하고 `objectiveState.campaignRewardClaims`를 추가했다.

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign territory harvest objective (v5.79)

- **채굴 목표 연결**: MCC CH1에 영토 PP 채굴 1회 objective를 추가해 초반 캠페인이 영토 확보, 이미지 등록, 생산 수확까지 이어지게 했다.
- **수확 횟수 집계**: 캠페인 상태 응답의 `objectiveState.territoryHarvests`가 `transactions.type = 'mining'`와 `from_wallet` 기준으로 실제 수확 횟수를 내려준다.
- **초반 루프 강화**: 캠페인이 플레이어에게 “내 영토가 돈/PP를 만든다”는 핵심 루프를 직접 경험시키는 구조로 보강됐다.
- **동선 재사용**: 채굴 objective는 기존 `territory` action을 사용해 BASE/내 영토 쪽으로 이동한다.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign ship upgrade objective (v5.78)

- **강화 목표 연결**: MCC CH3에 함선 스탯 강화 1회 objective를 추가해 함대전 뒤 조선소 강화 루프가 캠페인 진행 조건으로 들어간다.
- **성공 강화 횟수 집계**: 캠페인 상태 응답의 `objectiveState.shipUpgrades`가 `ship_stat_upgrade_log` 기준으로 성공 강화 횟수를 내려준다.
- **DB 호환 처리**: `success` 컬럼이 있는 DB는 성공 로그만 세고, 이전 DB는 기존 강화 로그 전체를 카운트한다. 테이블/컬럼 차이로 캠페인 상태 전체가 터지지 않도록 safe query를 유지했다.
- **동선 재사용**: 강화 objective는 기존 `shipyard` action을 사용해 조선소로 이동한다.

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign editor default parity + Bug reporter hardening (v5.77)

- **캠페인 기본 좌표 정합**: 인게임 스토리 캐릭터 fallback을 에디터 기본값과 맞췄다. 저장 layout이 없는 씬도 더 이상 bottom-anchor CSS로 튀지 않고 에디터와 같은 중심 좌표 기준에서 시작한다.
- **저장 좌표 우선 유지**: 에디터/씬/라인/캐릭터 layout은 기본 좌표 위에 계속 덮어 적용된다.
- **전환 렉 체감 완화**: 캠페인 배경 `fade_slow`/`fade_medium` 시간을 줄여 대사/화면 전환 때 빈 화면이 오래 보이는 현상을 줄였다.
- **버그 신고 제출 안정화**: 신고 모달 버튼에 `type="button"`과 이벤트 차단을 추가하고, html2canvas 로드 지연 시 수동 스크린샷 UI로 복구한다.
- **버그 신고 API 호환성**: 프론트는 `/api/bug-report` 실패 시 `/bug-report`로 재시도하고, 서버도 `/bug-report` alias를 받는다.

검증:
- `index.html` inline script syntax check 통과
- `node --check server/routes/bugReport.js` 통과
- `git diff --check` 통과

## 2026-05-04 — Shipyard requirement clarity + Fleet Command modal stickiness (v5.76)

- **제작 조건 상세화**: 청사진 카드에서 GP/재료가 부족해도 버튼을 눌러 상세 모달을 볼 수 있게 변경했다. 실행 버튼만 조건 부족 시 disabled 처리된다.
- **보유량/필요량 문구 통일**: 제작/강화 확인 모달의 GP와 재료 표시를 `보유 / 필요` 형식으로 통일하고, 충분/부족 상태를 색으로 구분했다.
- **재료 보유량 정규화**: 인벤토리 resource code를 소문자로 저장/조회해 실제 보유 재료가 있는데 부족으로 보이는 위험을 낮췄다.
- **함대지휘 모달 안정화**: 진형, 기동, 기함 지정, 함선 이동, 이름 변경, 해체 등 Fleet Command 내부 버튼에 `type="button"`과 이벤트 차단을 적용해 클릭 후 모달이 닫히는 흐름을 줄였다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective hard gate (v5.75)

- **서버 완료 판정 강화**: 캠페인 완료 API가 필수 DB 기반 objective를 확인하고, 부족하면 `OBJECTIVE_REQUIREMENTS_NOT_MET`으로 완료/보상 처리를 막는다.
- **진행률 응답 보강**: 캠페인 progress 응답에 `objectives`, `missingObjectives`, `nextObjective`, `preview.readyToComplete`를 포함한다.
- **자동 완료 오작동 수정**: 프론트가 진행률 100%만 보고 자동 완료하던 흐름을 중단하고, 서버가 완료 가능하다고 판단한 경우에만 완료 호출한다.
- **남은 목표 UI**: 작전 시간이 끝났지만 영토/이미지/함대/전투/마켓 목표가 남은 경우 캠페인 모달에서 남은 목표와 GO 동선을 보여준다.
- **시작 응답 정합**: 캠페인 start/alreadyCompleted 응답도 live objective 수량을 포함해 시작 직후 목표 상태가 비어 보이지 않게 했다.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign editor parity hotfix (v5.74)

- **에디터/인게임 대사박스 정합**: 에디터 좌표를 적용할 때 인게임 기본 safe-area padding이 남아 대사박스가 과하게 커지던 문제를 수정했다.
- **모바일 좌표계 정합**: 모바일 스토리 화면도 에디터와 같은 9:16 stage 비율을 유지해 캐릭터/대사박스 위치가 다른 비율로 재해석되지 않게 했다.
- **레이아웃 캐시 차단**: 에디터 layout GET/POST와 인게임 layout fetch에 `no-store`/timestamp를 적용하고 서버 응답도 `Cache-Control: no-store`로 내려준다.
- **좌표 적용 안정화**: 에디터에서 저장한 x/y/w가 인게임에서 이전 캐시나 기본 모바일 padding에 묻히지 않도록 정리했다.

검증:
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective action routing (v5.73)

- **목표 클릭 동선 연결**: 캠페인 objective 중 영토, 조선소, 함대, 함대전, 마켓 목표에 `GO` 액션을 붙였다.
- **실제 화면 이동**: 목표를 누르면 BASE 내 영토, 조선소 청사진, Fleet Command, PVP Battle Hub, Market 탭으로 바로 이동한다.
- **읽기 전용 유지**: 완료된 objective와 아직 직접 이동할 화면이 없는 story/result objective는 클릭되지 않게 유지했다.
- **캠페인 안내성 강화**: 캠페인이 단순 목록이 아니라 “다음에 뭘 해야 하는지 누르면 이동하는” 메인퀘스트 허브로 한 단계 진입했다.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign objective expansion (v5.72)

- **영토 이미지 목표 연결**: 내 영토 중 `image_url`이 등록된 영토 수를 `artClaims`로 집계하고 MCC CH1 objective에 추가.
- **함대전 완료 목표 연결**: `fleet_battles`와 `fleet_battle_participants` 기준으로 유저의 완료 함대전 수를 집계하고 MCC CH3 objective에 추가.
- **마켓 등록 목표 연결**: 활성 함선 마켓 등록과 일반 마켓 등록을 합산해 `marketListings`로 내려주고 MCC CH3 objective에 추가.
- **목표 표시 확장**: 추가 objective도 기존 UI의 `현재/필요` 수량 표시와 done/active 상태 판정을 그대로 사용.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-04 — Campaign live objective state (v5.71)

- **캠페인 목표 실제 상태 연결**: 캠페인 상태 응답에 `objectiveState`를 추가해 영토, 함선, 함대, 판매중 함선, 완료 함대전 수를 서버에서 집계.
- **초반 objective 보유량 표시**: MCC CH1은 첫 영토, MCC CH2는 첫 함대, FSP/CV CH1은 첫 함선 보유량을 `current/target`으로 내려줌.
- **목표 UI 보강**: 캠페인 카드와 브리핑 모달에서 objective 옆에 `현재/필요` 수량을 표시하고, 조건 충족 시 done 상태로 표시.
- **안전한 집계 처리**: 마이그레이션 차이로 일부 테이블/컬럼이 없어도 캠페인 리스트가 internal error로 죽지 않도록 objective 집계는 실패 시 0으로 처리.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor/in-game coordinate parity (v5.67)

- **캐릭터 좌표 기준 통일**: 캠페인 에디터가 저장하는 `x/y` 중심점 좌표를 인게임 스토리 렌더러도 동일하게 `translate(-50%,-50%)`로 적용하도록 수정.
- **레거시 top-left 호환**: 기존 top-left 방식이 필요한 layout은 `anchor: "top-left"` 또는 `origin: "top-left"`를 명시하면 그대로 동작.
- **스토리 stage 비율 정합**: 데스크탑 인게임 스토리 컨테이너를 에디터와 같은 9:16 기준으로 맞춰 percent 좌표가 다른 비율에서 어긋나지 않게 변경.
- **배경 기본 크롭 통일**: 에디터 preview와 인게임 story background의 기본 cover 위치를 `50% 50%` 중앙 기준으로 맞춤.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Bug reporter submit contract + Codex inbox payload (v5.66)

- **버그 제출 버튼 수정**: 프론트가 보내던 `description/context/screenshot` payload를 서버가 `title/body/category`로 정규화해 받도록 수정.
- **프론트 payload 보강**: 버그 리포트 제출 시 제목, 본문, URL, 지갑, viewport, 언어, 최근 콘솔 에러, 열린 모달 정보를 함께 전송.
- **Codex 인박스 보강**: 신규 리포트 JSON 미러에 `context`, `recent_errors`, `screenshot_path`, `codex_hint`를 포함해 바로 재현/수정 흐름으로 이어지게 변경.
- **스크린샷 파일 저장**: base64 스크린샷은 DB에 넣지 않고 `server/bug-reports/screenshots`에 파일로 저장.
- **자동 캡처 안정화**: html2canvas script id 오타와 CDN 로드 실패 시 placeholder 복구를 수정.

검증:
- `node --check server/services/bugReport.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship upgrade material visibility + fleet command modal stability (v5.65)

- **강화 재료 보유량 표시**: 함선 강화 확인 모달에 필요 재료의 보유량/필요량과 부족 여부를 표시.
- **쐐기 진형 재배치**: 세로 전장 기준으로 앞쪽 1척에서 후방으로 퍼지는 삼각 돌격 대형으로 수정.
- **Composition 집계 안정화**: 함선 `size_class` 별칭과 `class_label`을 정규화해 우측 수량 표시 누락을 방지.
- **함대지휘 모달 안정화**: 진형/기동/함선 이동/기함 지정 후 모달 상태와 내부 스크롤 위치를 유지.
- **Fleet API wallet 비교 보강**: 함대 목록/상세/수정/이동 소유권 체크에서 wallet 대소문자 차이를 허용.
- **모바일 safe-area 보정**: Fleet Command backdrop CSS 셀렉터 오타를 수정해 모바일 모달 위치 보정이 적용되도록 변경.

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor position + fleet command vertical UX (v5.64)

- **캠페인 에디터 위치 우선 적용**: 인게임 스토리 화면이 서버 에디터 레이아웃을 받은 뒤에도 localStorage의 최신 에디터 좌표를 다시 병합해, 방금 수정한 캐릭터 위치가 덮이지 않도록 수정.
- **함대지휘 세로 프리뷰**: 함선 PNG가 위를 보는 방향에 맞춰 Fleet Command 미리보기를 세로 전장/세로 진형으로 재배치.
- **구형 SVG 잔상 차단**: 함대지휘 미리보기에서 PNG 뒤로 예전 SVG 함선이 비쳐 보이지 않도록 fallback을 숨김.
- **진형/기동 모달 유지**: 진형/기동 버튼 클릭 시 모달을 닫지 않고, 즉시 프리뷰가 변형되며 서버 실패 시 이전 상태로 복구.
- **함선 선택 피드백**: 클릭한 함선이 명확히 보이도록 `SELECTED` 배지와 선택 상세 패널 추가.
- **기함 지정 안정화**: 서버 기함 지정 로직에서 wallet 대소문자와 `fleet_id` 타입 차이로 발생할 수 있는 오류를 보정.

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship market + chance upgrades + fleet FX polish (v5.63)

- **함선 확률 강화**: 보유 함선 `ATK/DEF/SPD/HP` 강화가 성공 확률과 재료 소모를 가지도록 변경. 실패해도 GP와 재료는 소모되고 스탯은 유지됨.
- **강화 재료 표시**: 조선소 보유함 카드에 강화 비용, 성공 확률, 필요 재료를 함께 표시.
- **함선 마켓 추가**: 강화한 함선을 GP 가격으로 판매 등록/취소/구매할 수 있는 API와 UI 추가. 판매중 함선은 `판매중` 스티커가 붙고 강화/수리/실드/해체가 차단됨.
- **조선소 함선 가독성 개선**: 청사진/보유함 미리보기에서 엔진 불꽃 오버레이를 제거하고, PNG 함선 밝기/대비를 올려 어둡게 묻히는 문제 완화.
- **전투 수동 스킬 가시성 보강**: 빔포와 미사일 이펙트 지속시간을 늘리고 미사일 트레일을 추가해 사용 여부가 더 분명하게 보이도록 수정.
- **전투 UI 보정**: 하단 무전 콜아웃을 버튼 위로 올리고 화성 배경을 더 밝게 조정.

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `index.html`, `assets/tactical-lab-v11.html`, `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign quest progress gate (v5.62)

- **캠페인 작전 즉시 클리어 방지**: 스토리/결과 씬을 넘기면 바로 완료되던 흐름을 제거하고, 작전 챕터는 진행률 화면으로 이동하도록 수정.
- **서버 완료 조건 강화**: `/api/campaign/complete`가 프롤로그/순수 시네마틱 외 챕터에서 런타임이 차기 전 `MISSION_IN_PROGRESS`를 반환하도록 변경.
- **진행률 폴링 UI**: 캠페인 작전 화면이 `/api/campaign/progress`를 주기적으로 읽어 진행률, 남은 시간, 경과 시간을 표시하고 완료 가능 시점에만 결과를 띄움.
- **챕터별 런타임 적용**: 진행률 계산에서 CH1 840초 고정값을 제거하고 각 챕터의 `environment.totalDurationSeconds` 또는 `estimatedPlayTimeSeconds`를 사용.

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign completed chapter compact cards (v5.61)

- **완료 챕터 전체 접힘 처리**: 캠페인 리스트에서 완료된 챕터는 프롤로그뿐 아니라 CH1 이후도 compact 카드로 접어서 표시.
- **결과 확인 유지**: 접힌 완료 카드의 `RESULTS` 버튼은 그대로 유지해 결과 화면 접근 가능.
- **진행 카드 영향 없음**: 진행 중/시작 가능 챕터만 기존 큰 카드와 metric 영역을 표시.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Campaign editor layout parity + story perf (v5.60)

- **에디터/인게임 캐릭터 배치 일치**: 에디터가 저장하는 `x/y/w` top-left percent 좌표를 인게임 렌더러도 그대로 적용하도록 수정. `cx/cy` 계열만 중앙 기준으로 처리.
- **단일 화자 중앙 배치**: `scene.characters`가 없는 단일 화자 대화씬은 에디터처럼 중앙 캐릭터로 표시. 광부 어르신 같은 씬이 왼쪽으로 밀리는 문제 수정.
- **캐릭터 에셋 매핑 점검**: campaign-story 전체 speaker 42종을 검사해 누락 초상화 0건 확인. `crow → kara_vex` 잘못된 매핑을 실제 존재하는 `crow.png`로 수정.
- **스토리 전환 렉 완화**: 현재/다음 라인의 배경·캐릭터·오버레이 이미지를 캐시 선로딩하고, 대사 타이핑을 `requestAnimationFrame` 기반으로 변경. 대화창 blur 제거로 repaint 비용 감소.

검증:
- campaign-story speaker 42종 캐릭터 이미지 매핑 검사 통과 (missing 0)
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet Mars atmospheric background (v5.59)

- **화성 상층권 배경 추가**: 택티컬랩 전투 캔버스에 `assets/textures/mars_nasa_2k.jpg`를 배경 레이어로 로드.
- **느린 표면 패닝**: 화성 표면이 매우 천천히 지나가도록 처리해 전투가 검은 우주 공간에 떠 있는 느낌을 줄임.
- **전투 가독성 보강**: 어두운 veil과 기존 주황/푸른 글로우, 낮은 알파 먼지 스트릭으로 함선/레이저가 묻히지 않게 조정.
- **본서버 택티컬랩 반영**: `assets/tactical-lab-v11.html`에 적용하고 검수용 데모 파일에도 동일 로직 반영.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet sprite preload fallback fix (v5.58)

- **첫 프레임 구형 함선 노출 차단**: PNG 함선 이미지가 로드되기 전에는 구형 벡터/SVG fallback 함선을 그리지 않도록 변경.
- **플레임 표시 안정화**: 함선 본체가 실제로 그려진 프레임에서만 엔진 플레임과 대형함 HP bar를 표시.
- **본서버 택티컬랩 반영**: `assets/tactical-lab-v11.html`에 적용하고 검수용 데모 파일에도 동일 로직 반영.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Ship infinite stat upgrades (v5.57)

- **보유 함선 무한 강화 추가**: 개별 함선에 `ATK/DEF/SPD/HP`를 영구 투자하는 API와 DB 로그를 추가. 실패/파괴/`+강` 등급명 없이 누적 성장.
- **조선소 강화 UI 추가**: 내 함선 카드에서 기본 스탯 옆에 녹색 `(+보너스)`가 표시되고, 각 스탯 강화 버튼을 바로 누를 수 있음.
- **전투 스탯 반영**: 서버 전투 엔진이 강화된 공격력, 방어력, 체력, 속도를 실제 전투 계산에 반영.
- **경제 설정 추가**: `ship_upgrade_base_gp`, `ship_upgrade_growth`, `ship_upgrade_*_step` 설정으로 강화 비용과 증가량 조절 가능.

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `node --check server/services/battleEngine.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet battle scale-aware start distance/zoom (v5.56)

- **함대 수 기반 시작 거리**: `battleScaleConfig()` 추가. 1:1 소규모전은 더 가까운 상/하단에서 시작하고, 함대 수가 많을수록 시작 간격이 넓어짐.
- **함대 수 기반 교전 거리**: 함대 AI의 최소/이상 교전 거리를 전투 규모에 따라 조정. 소규모전은 가까운 거리, 대규모전은 장거리 교전 유지.
- **함대 수 기반 자동 줌**: 자동 카메라가 소규모전에서는 더 크게 줌인하고, 대규모전에서는 전체 함대를 담도록 최대 줌과 프레이밍 여백을 조정.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet battle chatter callouts (v5.55)

- **전장 무전 자막 추가**: 명령/진형/기동은 상단, 피격/격침/후퇴 경고는 하단에 짧게 뜨는 콜아웃으로 표시.
- **격침 대사 추가**: 소형함 격침은 확률적으로 비명/탈출 대사가 나오고, 대형함/기함 격침은 더 강한 경고 문구 표시.
- **수동 스킬 연출 강화**: 집중공격, EMP, 빔포, 미사일 일제사격, 후퇴 확인에 전투 무전 문구 추가.
- **간헐 무전 추가**: 교전 중 사격선 유지, 산개, 실드 재분배 같은 ambient 콜아웃이 드물게 표시되어 전투가 덜 정적으로 보임.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-03 — Fleet manual beam/missile skills (v5.54)

- **수동 빔포 추가**: 전함/타이탄이 살아있으면 `☢ 빔포` 게이지가 차고, 100%에서 우선순위 대형 목표에 굵은 주포 빔을 수동 발사.
- **미사일 일제사격 추가**: 프리깃/구축함/순양함이 살아있으면 `☄ 미사일` 게이지가 차고, 100%에서 소형/중형함들이 다수 미사일을 발사.
- **전투 연출 강화**: 빔포 전용 두꺼운 글로우, 발사 쇼크웨이브, 미사일/빔포 전용 WebAudio 효과음 추가.
- **본서버 택티컬랩 반영**: 데모 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html`을 동일하게 유지.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Fleet doctrine RPS + shipyard vertical UI pass (v5.53)

- **함선 상성 적용**: 전투 엔진과 택티컬랩에 역할/함급/파벌 기반 데미지 배율을 추가. 태클, EW, 로지, 탱커, 저격, 폭격이 서로 카운터를 갖도록 변경.
- **진영별 밸런스 재정리**: migration 208로 MCC는 정밀 저격/대형함 처리, FSP는 장기전/탱킹/로지, CV는 러시/폭격/순간화력 중심으로 스탯과 설명 조정.
- **전투 사운드 추가**: WebAudio 기반 BGM 루프와 레이저/탄막/폭발 SFX를 추가. 브라우저 자동재생 제한 때문에 `SOUND` 버튼으로 활성화.
- **세로 전장 기동 표기**: 전진/후퇴 버튼과 자동 기동 로그를 세로 전장에 맞춰 `↑/↓`로 변경.
- **조선소 세로 카드 UI**: 데스크탑 청사진은 4열 그리드, 모바일은 1열 카드로 정리. `assets/ships/top/` PNG를 세로 함선 프리뷰로 사용.
- **조선소 엔진 플레임 보정**: PNG 로드 시 기존 SVG 프리뷰는 숨기고, 카드 하단 후미에서 새 엔진 플레임이 나오도록 변경.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `index.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

## 2026-05-02 — Top-view fleet sprite + long-range combat pass (v5.52)

- **함선 PNG 22종 매핑**: `assets/ships/top/`에 전투용 축소 PNG 22종을 추가하고 `mcc_destroyer_top.png` 중복 샘플은 제외.
- **전투/조선소 렌더 통일**: 함대전 캔버스와 SHIP REGISTRY 미리보기가 같은 PNG 스프라이트를 사용하도록 변경.
- **엔진 불꽃 통일**: 기존 벡터 기준 파란 불꽃 대신 PNG 함선 길이 기준 후방 엔진 플레임으로 전투/미리보기 모두 통일.
- **장거리 함대전 보정**: 함대 간 최소/이상 교전 거리를 늘려 근접 난전처럼 겹치지 않게 수정.
- **카메라 프레이밍 개선**: 실제 살아있는 함선 스프라이트 바운딩 박스 기준으로 자동 줌/팬을 계산해 함선이 화면 밖으로 잘리는 문제 완화.
- **사격 방향 보정**: 함선이 현재 사격 타겟 좌표를 우선 바라보도록 조준 상태를 저장해 레이저 방향과 함체 방향을 맞춤.
- **대형함 움직임 추가**: 기함/대형함에 묵직한 드리프트와 함대 전체 미세 이동을 추가해 정지된 장식처럼 보이지 않게 수정.

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Vertical fleet war production update (v5.51)

- **본 서버 함대전 세로화**: `assets/tactical-lab-v11.html`을 v11.1 기반 세로 전장으로 전환. 적군은 상단, 아군은 하단에 배치.
- **초기 배치 개선**: 함대가 일직선으로 시작하지 않도록 상/하단 반원형 아크로 배치하고, 아군 기본 `wedge`, 적군 기본 `screen` 진형 적용.
- **모바일 HUD 압축**: 속도 조절을 우상단 오버레이 단일 버튼으로 변경하고, 클릭마다 `x1/x2/x4/x8` 순환. 증원 테스트 버튼 제거, 전술 버튼은 소형 그리드로 정리.
- **자동 줌 안전화**: 가까운 교전쌍으로 줌 강도를 계산하되 전체 생존 함대와 라벨이 화면 밖으로 나가지 않도록 프레이밍 제한.
- **모바일 성능 최적화**: 작은 함선 대표 렌더, 발사 밀도 제한, 총알 누적 제한, 폭발 파티클 감소, 모바일 shadowBlur 축소로 렉 완화.
- **캔버스 찌그러짐 보정**: 내부 버퍼와 CSS 표시 비율을 `460x600`으로 맞춰 텍스트/함대가 가로로 늘어나 보이던 문제 수정.

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Fleet camera containment hotfix (v5.50)

- **Cinema 카메라 이탈 방지**: 오버숄더 카메라가 함선을 화면 밖으로 밀어내던 문제를 수정. 카메라 중심을 소스/타겟 사이로 잡고 월드 경계 안으로 clamp.
- **거리 기반 줌 안정화**: 오버숄더 줌을 함대 간 거리와 반경 기준으로 산출해 두 함대가 화면 안에 남도록 조정.
- **시네마틱 한계 기록**: 현재 2D tactical-lab 카메라만으로는 레퍼런스 같은 3D 박력 구현에 한계가 있어, 후속으로 프리렌더/3D풍 전투 뷰어 분리 개발 권장.

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Fleet combat role/preview/camera pass (v5.49)

- **함선 역할 밸런스 기획 반영**: 샤드는 저렴한 주력 DPS, 재머는 비싼 약한 딜러가 아니라 적 함대 사격 지연/화력 저하를 중첩시키는 EW 지원함으로 정리.
- **EW 전투 엔진 적용**: `battleEngine`에서 `fire_type='ew'`가 적 함대에 발사 간격 증가와 공격력 저하 디버프를 부여하도록 구현.
- **조선소 카드 개선**: 함선 카드에 역할 배지와 설명을 표시해 왜 이 함선을 사야 하는지 바로 보이게 수정.
- **함대 지휘 UX 개선**: 선택 함대의 진형 미리보기 보드, 함종 구성 막대, 역할 칩, 함선별 ATK/DEF/SPD 표시 추가.
- **모바일 함대전 v11.2**: 전투 캔버스 높이 확대, 버튼 2열 정렬, 함선 표시 크기 확대, 정보 패널 모바일 정리.
- **모바일 전술 패널 수납**: 오른쪽 구석 `TACTICS` 플로팅 버튼을 추가하고, 전술/진형/기동/카메라 버튼은 사이드 패널로 열리며 선택 후 자동 접힘.
- **시네마틱 카메라**: `Cinema`/`Tactical` 카메라 모드 추가. Cinema는 기함 뒤 오버숄더 추적샷과 전체 전장샷을 자동 전환.

검증:
- `index.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

## 2026-05-02 — Shipyard build stays on blueprints (v5.48)

- **연속 함선 건조 UX 수정**: 함선 건조 성공 후 Build Queue 탭으로 강제 이동하던 동작을 제거해, 청사진/건조 탭에 머문 채 계속 건조할 수 있도록 수정.
- **상태 갱신 유지**: 탭 이동만 제거하고 `refreshShipyard()`는 유지해 건조 큐, 재화, 버튼 비활성 상태는 즉시 갱신.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Completed prologue compact campaign card (v5.47)

- **완료된 프롤로그 접기**: 캠페인 목록에서 완료된 `chapterNumber === 0` 프롤로그는 한 줄 compact 카드로 표시하도록 수정.
- **결과 접근 유지**: 접힌 프롤로그 카드에도 `RESULTS` 버튼을 유지해 결과 확인은 가능.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign editor layout save/apply fix (v5.46)

- **에디터 수정값 서버 저장 보장**: 운영 `/api/campaign/editor-layout`가 `{}`인 상태를 확인하고, 에디터 시작 시 서버가 비어 있으면 localStorage layout을 자동 업로드하도록 수정.
- **Save 버튼 정리**: `Export Backup` 버튼을 `Save to Game`으로 바꾸고, 클릭 시 즉시 서버 layout API에 저장.
- **인게임 fallback 추가**: 서버 layout이 비어 있거나 로드 실패하면 같은 origin의 `editorCharacters`, `editorDialog`, `editorFontSize` localStorage 값을 fallback으로 적용.

검증:
- `index.html` inline script syntax check 통과
- `assets/campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign story background transition flash fix (v5.45)

- **장면 전환 파란/보라 화면 제거**: 스토리 렌더러가 장면마다 `.story-background` inline style을 통째로 지워 기본 그라디언트가 잠깐 노출되던 문제 수정.
- **배경 preload 후 교체**: 기존 배경 이미지를 유지한 채 새 이미지를 로드하고, 로드 성공 후에만 `backgroundImage`를 교체하도록 변경.
- **동일 배경 재로드 방지**: `data-bg-src`로 현재 배경과 같은 경우 이미지 재로드 없이 layout만 적용.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign story editor layout runtime bridge (v5.44)

- **에디터 배치값 인게임 반영**: 캠페인 스토리 렌더러가 서버 저장 `_campaignEditorLayout`, `scene.layout`, `line.layout`, `editorLayout`, `stageLayout`을 읽어 캐릭터/배경/대사박스/closeup overlay 위치를 적용하도록 수정.
- **모바일/데스크탑 분리 지원**: `layout.desktop`, `layout.mobile` 값을 현재 화면 폭에 맞게 병합해 적용.
- **캐릭터별 좌표 지원**: `layout.characters.berk` 또는 `layout.characters.left/right` 형식으로 x/y/w/h/scale 값을 지정하면 기본 좌우 CSS 배치를 덮어씀. 에디터 저장값처럼 y가 없으면 bottom-anchor로 배치해 캐릭터가 위로 잘리지 않게 처리.
- **라인 전용 배경 수정**: 기존 `_campaignStorySetBackground()`는 line-level background를 지원한다고 주석만 있었고 호출부가 값을 넘기지 않아 적용되지 않던 문제 수정.
- **캐시 버전 갱신**: `CAMPAIGN_ASSET_VERSION=20260502c`.

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

## 2026-05-02 — Campaign character portrait generation complete (v5.43)

- **캠페인 캐릭터 포트레이트 28종 생성 완료**: gpt-image-1 (1024×1536, quality=high) + rembg 배경 제거 파이프라인.
- **생성 대상**: pilot 3종 (butcher/chen/cinder), batch1 7종, needs_story_check 2종 (kenji/lena), hold 16종 — 총 28종.
- **주요 이슈 해결**: cinder 번 스카 identity anchor v9에서 확정 (물리적 묘사 + 얼굴 각도 + 조명 변경), chen 찻잔 제거 + MCC 뱃지 유지, 구도 1024×1536 세로 비율로 전환.
- **생성 로그**: `assets/campaign/characters/_generation_log.json` (각 버전별 prompt/evaluation 기록).
- **character_manifest_v2.json**: `/tmp/character_manifest_v2.json` 로컬 정의 파일 (alias/canonical/variant/create_now/hold 상태 관리).

## 2026-05-02 — Campaign complete internal error fix (v5.42)

- **캠페인 완료 Internal error 수정**: `player_campaign_progress` 완료 UPDATE에서 `$1` 파라미터가 `status` 대입과 `CASE WHEN` 비교에 동시에 쓰이며 운영 PostgreSQL에서 타입 추론 충돌이 발생하던 문제 수정.
- **완료 단계 검증**: 운영 DB 합성 지갑으로 `mcc_prologue` 시작 → 완료 → `mcc_campaign_ch1` unlock까지 확인하고 합성 데이터 삭제.

검증:
- `node --check server/services/campaign.js` 통과
- 운영 DB 합성 플로우 `complete ok true completed mcc_campaign_ch1` 확인

## 2026-05-02 — Backend phantom schema audit + client guard fixes (v5.41)

- **업적 unlock 오류 수정**: `user_achievements` 실제 운영 스키마에는 `id` 컬럼이 없어서 `RETURNING id`가 실패하던 경로를 `RETURNING achievement_key`로 변경.
- **없는 `user_profiles` 참조 제거**: Contest/Expedition/Rental 서비스의 닉네임 JOIN을 실제 `users.wallet_address` 기준으로 변경.
- **Rental 목록 오류 수정**: `claims.pixel_count` 없는 컬럼 참조를 `(width * height)` 계산식으로 변경.
- **지도 합성 클라이언트 오류 방어**: Starlink 응답의 `passes` 배열을 정규화하고, 주기 합성 루프에서 `undefined.length`가 터지지 않도록 가드.
- **Arena crash history 방어**: history 응답이 배열이 아니어도 모달 전체가 죽지 않도록 가드.

검증:
- `onclick` 849개 / 호출 함수 523개 자동 스캔, 실제 미정의 핸들러 0개
- `node --check` 변경 서비스 4개 통과
- `index.html` inline script syntax check 통과
- 운영 DB 스키마 확인 및 `BEGIN/ROLLBACK` 쿼리 드라이런 통과

## 2026-05-02 — Shipyard build button GP summary fix (v5.40)

- **조선소 건조 버튼 비활성화 수정**: `/api/ships/summary`가 `gp_balance`를 반환하지 않아 프론트가 GP를 항상 0으로 판단하던 문제 수정.
- **함대 없는 유저 지원**: summary 쿼리를 `fleets` 기준에서 `users` 기준 LEFT JOIN으로 바꿔, 아직 함대가 없어도 GP/큐 요약을 정상 반환.

검증:
- `node --check server/services/ship.js` 통과
- 운영 DB `ship_build_jobs`/`ship_build_log` 0건 확인 → 건조 시작 요청 자체가 UI에서 막히던 증상과 일치
- 운영 DB `BEGIN/ROLLBACK` 건조 INSERT 드라이런 통과

## 2026-05-02 — Campaign asset hard cache refresh (v5.39)

- `sw.js`: `CACHE_NAME`을 `mars-v8`로 갱신. `/assets/campaign/*`는 `fetch(new Request(..., { cache: 'reload' }))`로 HTTP 캐시까지 우회해 같은 파일명 이미지 교체가 바로 반영되도록 강화.
- `index.html`: 캠페인 배경/캐릭터/closeup 배경 URL을 `campaignAssetUrl()`로 통합하고 `?v=20260502b`를 적용.
- `package.json`: 버전 `5.39.0`으로 갱신.

검증:
- inline script syntax check 통과
- `node --check sw.js` 통과
- `git diff --check` 통과

## 2026-05-02 — SW mars-v6 캐시 버전 업 + 캠페인 배경 184장 Codex gpt-image-1 전면 재생성

변경:
- `assets/campaign/backgrounds/` 184장 PNG 전면 교체:
  - 77장 scene-level (9:16 portrait, ~2200–2800KB): gritty cinematic sci-fi concept art 스타일.
  - 107장 overlay closeup (1:1 square, ~1800–3000KB): 동일 스타일, 1:1 square.
  - 생성 도구: Codex gpt-image-1 (`codex exec`), 0 DIMENSION_FAIL.
  - style lock: "gritty cinematic sci-fi concept art, dense mechanical detail, rusty worn metal,
    warm orange rim lighting, dark shadows, high-detail painterly realism, dramatic framing,
    worn industrial spaceship atmosphere" — green CRT 키워드 제거 (cargo_ship_interior, mcc_briefing_room 2곳만 유지).
- `sw.js`: CACHE_NAME 'mars-v5' → 'mars-v6' — 옛 이미지 캐시 전체 무효화.
- `index.html`:
  - 이미지 URL `?v=20260501d` → `?v=20260502a`.
  - `_bgMap` 정리: 직접 파일 생긴 4개 항목 제거 (cargo_ship_interior, hellas_mining_outpost,
    kepler_crater, kepler_crater_dusk, mine_interior).
  - 폴백 유지: hellas_central_underground, hellas_outer_relay_interior, erebus_base_medical,
    hellas_various_night.

## 2026-05-01 — SW mars-v5 캐시 버전 업 + 파벌 대사 풀 65개 + 함대전 hook

사용자 보고:
1) "옛날 이미지 계속 보임" — Service Worker 가 image cache-first 정책으로 이전 PNG 영구 보관
2) "대사 엄청 많아야 함, 함대전에도 있어야"

수정:
- sw.js: CACHE_NAME 'mars-v4' → 'mars-v5' 버전 업.
  SW activate 이벤트가 옛 캐시 일괄 삭제 → 신규 Imagen 4 Ultra 480장 PNG 강제 fresh fetch.
- index.html 이미지 URL 쿼리 파라미터 ?v=20260501c → ?v=20260501d (sw 동기).
- FACTION_FLAVOR 풀 대폭 확장 (총 65 라인):
  - claim_new: 4 → 16 (MCC/FSP/CV/neutral)
  - claim_executing: 3 → 15
  - hijack_start: 4 → 18
  - 신규 fleet_battle_engage: 16 (함대전 진입)
- 등장인물 확장: Chen Weiss / Li Fang / Director Osei (MCC), Mikhail / Lena / Hagar / Yuna /
  Olu Adeyemi (FSP), Butcher / Aisha / Cinder Grace / Crow (CV),
  Mission Control / AI Scout / Fleet Command / Tactical AI / Battle Bridge (neutral)
- 함대전 hook: hijack 후 openBattleViewer 진입 직전 fleet_battle_engage 대사 await.
  setTimeout 1500ms → 2400ms 로 늘려 2.2s 대사 표시 시간 확보.

## 2026-05-01 — UI 검수 + 누락 버튼 구현 + 업적 모달 + 슬로대 파벌 대사 + 캐시 부스트

사용자 검수 보고:
1) 함선 건조 안됨 (별도 commit 8291b9a)
2) 모든 버튼 동작 검수
3) 업적 달성 조건 안 보임 → 모달
4) 미구현 stub 대신 실제 구현
5) 영토/하이잭 시 캐릭터 대사 (슬로대 스타일)
6) 모바일 옛날 이미지

수정:
- 851개 onclick 핸들러 자동 검사 → 누락 3개 식별·실구현:
  - openMineralsPanel: /api/resources/my 모달
  - openShipRegistry: /api/ships/my 모달 (HP/상태)
  - openWorldEventDetail: /api/world-events/:id 모달
- 업적 카드 클릭 → showAchievementDetail() 모달:
  달성 조건 (한/영, condition_type 27종 라벨), 보상 GP, 상태, 달성일시.
- showFactionFlavor() — 슬로대 풍 사전 대사 시스템 (claim_new/claim_executing/hijack_start)
- /assets/campaign/backgrounds/<id>.png?v=20260501c 캐시 부스트.

## 2026-05-01 — Ship build transaction silent rollback fix

사용자 리포트: "재료가 있는데도 함선 건조가 실패함".

원인:
- `server/services/ship.js` `startBuild()`가 `ship_build_jobs` INSERT 후, 같은 트랜잭션 안에서 선택적
  `fleet_gp_activity` 로그를 쓰고 `.catch(() => {})`로 에러를 삼켰음.
- PostgreSQL은 트랜잭션 내부 statement 에러가 한 번 나면 이후 `COMMIT`이 전체 변경을 롤백할 수 있다.
  이 경우 서비스는 이미 받은 `job.id`로 성공 응답을 만들 수 있어 HTTP 200인데 `ship_build_jobs` 행이
  남지 않는 silent fail 경로가 생김.

수정:
- `fleet_gp_activity` 로그를 `COMMIT` 이후 fire-and-forget으로 이동.
- 건조 트랜잭션은 필수 변경만 포함: 유저/함선 검증 → GP 차감 → `user_resource_inventory(resource_id)`
  원자적 광물 차감 → `ship_build_jobs` INSERT → `ship_build_log` INSERT → `COMMIT`.
- 동일한 패턴의 건조 취소 환불 로그도 트랜잭션 밖으로 이동.

검증:
- `node --check server/services/ship.js` 통과
- `git diff --check` 통과
- DB 접속은 sandbox 네트워크 제한으로 실행 불가. 코드 경로상 `ship_build_jobs` INSERT는
  `server/services/ship.js` `startBuild()`의 `COMMIT` 이전 필수 쿼리로 유지됨.

## 2026-05-01 — Scene-level 77장 + Variant 301장 + JSON round-robin (6-7/N)

사용자 지적: "이전 것도 다 바꾸라고 했을텐데" + "이미지 반복사용 하지말고 씬이미지 늘려라".

scene-level (Step 6):
- 77개 location-named scene-level 배경 (cargo_ship_corridor, hellas_central_exterior 등)
  Imagen 4 Ultra 9:16 cinematic 일괄 재생성. 평균 1418KB. 신규 dedicated 115장과 스타일 일관.
- 누락 케이스: 이전 단계는 사이즈 < 1.4MB 만 재생성했으나 1.4MB+ 라도 옛날 8-bit pixel art
  스타일 다수 잔존. 사용자 지적 후 전체 일괄 처리.

Variant (Step 7):
- 3회 이상 반복되는 (chapter, bg) 케이스 147건에서 variant 생성 + 36개 JSON round-robin 배정.
- prologue_shared `cargo_ship_corridor` 18회, `olympus_summit_station` fsp_ch9 40회/cv_ch9 39회/
  mcc_ch9 30회 등 가장 두드러진 반복 분산.
- 변주 hint 8종 (wide establishing / intimate close / high angle / low angle / side profile /
  dawn / deep dusk / with crowds) round-robin.
- 결과: 301/301 1차 성공, 평균 1410KB.

스크립트:
- scripts/gen_scene_level_v2.py (77 hand-crafted prompts)
- scripts/gen_scene_variants.py (variant 생성 + JSON round-robin)

총 변경: 301 신규 PNG + 39 JSON 갱신.

## 2026-05-01 — Imagen 4 Ultra 115장 일괄 재생성 완료 (5/N)

Imagen 3 → Imagen 4 Ultra 전환 후 115장 모두 재생성 완료. Codex agent 가 작성한
`/tmp/codex_generate_campaign_bgs.py` 를 `IMAGEN_MODEL=imagen-4.0-ultra-generate-001`
환경변수로 실행, 115장 중 114장 1차 성공 + 1장 (mcc_ch5_kepler_dispute_l29 candle_flame)
safety filter retry 후 완료.

성과:
- 평균 사이즈: 1481.7KB (직전 Imagen 3 평균 700-1000KB 대비 약 1.5배)
- 골드 스탠다드 (≥1.4MB) 도달: 167/190 (88%)
- 사이즈 분포: ≥2MB 19개, 1.5-2MB 116개, 1.4-1.5MB 32개, 1.0-1.4MB 20개, <1.0MB 3개
- 9:16 portrait 모바일 우선, 캐릭터·사물·대사 매칭 hand-crafted 영문 프롬프트 그대로 적용

검수 픽스 (배치 중 3장):
- `cv_ch10_from_flames_l14_00_hand_still`: 사용자가 이마 미닝 헤드램프 어색하다 지적 → "no headgear" 명시 재생성
- `cv_ch1_baptism_l41_00_candle_flame`: Aisha 하반신이 바닥에 박힘 → 풀바디 + 명확 구도 재생성
- `mcc_ch5_kepler_dispute_l29_00_candle_flame`: 1차 safety filter 차단 → 표현 다듬어 retry 성공

검증:
- `find assets/campaign/backgrounds -name "*.png" -newermt "2026-05-01" | wc -l` → 115
- `ls -la assets/campaign/backgrounds/*.png` 사이즈 분포 위 통계 확인
- 기존 70개 scene-level high-quality 배경은 보존 (수정 없음)

## 2026-04-30 — Imagen 4 Ultra 모델 업그레이드 (4/N)

사용자 피드백 "이미지 퀄리티 기준은 엄격하게 지킬것" 반영.
Imagen 3 → Imagen 4 Ultra 로 모델 전환. Codex agent 추천 따름.

배경:
- Imagen 3 (`imagen-3.0-generate-001`) 9:16 portrait 픽셀아트 출력이 일관되게
  700-1000KB 로 골드 스탠다드(`hellas_central_exterior` 2MB) 못 미침
- 강화 STYLE 프롬프트 + best-of-2 도입해도 마진 개선만 (~1MB 도달 정도)
- Codex sandbox 분석 결과: 모델 자체의 출력 해상도/디테일이 병목

해결:
- `scripts/gen_scene_dedicated_v2.py` 의 `model=` 인자를 환경변수
  `IMAGEN_MODEL` 로 추출. 기본값 `imagen-3.0-generate-001`,
  override `imagen-4.0-ultra-generate-001`.
- 첫 3장 테스트 (CV Ch10 fire_small/hand_still/death_still) 1494/1506/1510KB 달성
- 시각 디테일 차원이 다름: 정교한 metal gear, 텍스트 레이블 ('BUTCHER VASQUEZ'),
  환경 스토리텔링 (벽 그래피티, 산소 호스, 광부 헬멧 자국 등) 모두 1차 시도에서
  픽셀아트로 표현됨

진행:
- 118장 < 1.4MB 결과물 모두 Imagen 4 Ultra 로 `--strict` 재생성 (백그라운드)
- ETA ~1.5-2시간 (rate limit 포함)
- 완료 후 후속 커밋 (5/N) 에 PNG 일괄 포함

검증:
- `assets/campaign/backgrounds_imagen4_test/` 에 비교용 샘플 3장 보존
- `IMAGEN_MODEL=imagen-4.0-ultra-generate-001 python3 scripts/gen_scene_dedicated_v2.py --strict` 동작 확인

## 2026-04-30 — Campaign 오버레이 시스템 폐기 + 씬 전용 9:16 배경 인프라 (1/2)

본 커밋은 오버레이 → 씬 전용 배경 전환의 **인프라 변경분**만 반영. Imagen 3 9:16 신규 배경 약 120개는 후속 커밋에서 추가.

- **오버레이 시스템 전면 제거**: `index.html` 의 `.story-detail-overlay` CSS, `<img class="story-detail-overlay">` 엘리먼트, `_showStoryDetailOverlay()` 함수 폐기. `assets/campaign/overlays/*.png` 35개 파일 일괄 삭제. 사용자 피드백("오버레이는 오히려 보는데 더 방해되니까 차라리 씬 전용 배경으로 바꾸는게 낫겠더라") 반영.
- **라인 단위 풀스크린 배경 swap**: `_campaignStorySetBackground(scene, overlay, lineBg)` 신규 인자. 라인의 `background` 필드가 있으면 씬 배경 대신 라인 전용 배경으로 풀스크린 전환. 모바일 9:16 portrait 우선.
- **scene JSON 일괄 변환**: `scripts/update_scene_overlays_to_backgrounds.py` 가 `docs/campaign-story/*.json` 의 모든 `"overlay": "X"` 라인 필드를 `"background": "<chapter>_l<scene>_<line>_X"` 로 변환. 35개 챕터 / 107개 라인 처리.
- **신규 hand-crafted 프롬프트**: `scripts/gen_scene_dedicated_v2.py` 에 107개 씬 라인 + 13개 저퀄 scene-level 배경 (총 120개) hand-written 영문 프롬프트 정의. 각 라인의 KO 대사를 직접 읽고 캐릭터(Butcher 의수, Lena 문신, Chen 25도 차) / 사물 / 행동 / 분위기를 명시. 모두 9:16 portrait. 현재 백그라운드 생성 중, 완료 후 후속 커밋 (2/2).
- **hidden_ch5_last_observation.json**: line 370 JSON parse error 수정 — 오타로 들어간 닫는 중괄호 제거. 이제 `update_scene_overlays_to_backgrounds.py` 와 Codex prologue scan 모두 이 챕터 포함 가능.

검증:
- `index.html` 정적 파싱 통과, `story-detail-overlay` 잔존 0건
- `python3 -c "import json; [json.load(open(f)) for f in glob.glob('docs/campaign-story/*.json')]"` 36개 모두 파싱 성공
- 변환된 라인 background ID 가 `gen_scene_dedicated_v2.py PROMPTS` 키와 1:1 일치

## 2026-04-30 — Campaign scene choice INVALID_CHOICE hotfix

- **Resolved**: visual novel `type:"choice"` scene options that are not present in server `chapter.choices` now advance locally instead of posting to `/api/campaign/choice`, fixing the prologue `INVALID_CHOICE` modal after CONTINUE.
- **Server guard**: no-choice story chapters such as `mcc_prologue`, `fsp_prologue`, and `cv_prologue` now recognize scene-local choice IDs defensively if a stale client posts them.
- **Scan**: checked all `docs/campaign-story/*.json` files with `type:"choice"` / `type:"branch"` scenes. 31 parseable files contain 32 scene choice/branch scenes and 128 options; the same class of UI bug is covered across MCC/FSP/CV chapters.
- **Note**: `docs/campaign-story/hidden_ch5_last_observation.json` currently has a JSON parse error at line 370, so it could not be included in the structured choice scan.
- **검증**: `node --check server/services/campaign.js`, `node --check server/routes/api.js` 통과.

## 2026-04-30 — Campaign C1/C2 critical hotfix

- **Resolved C1/C2**: `server/services/campaign.js` now gates FSP Ch10 endings with `calculateEligibleFspEndings()` and blocks the FSP Ch9 Pilgrim Arms signal unless the stored Ch7/Ch8 ending-4 seed modifiers are active.
- **검증**: `node --check server/services/campaign.js` 통과. `git diff server/services/campaign.js` 확인 결과 targeted eligibility/choice validation 함수만 변경.

## 2026-04-30 — Campaign system 정밀 감사 (Claude + Codex 협업)

- **감사 범위**: v5.33 출시 직후 캠페인 30+ 챕터(MCC/FSP/CV 프롤로그 + 1~10 + hidden 1~5) 정밀 감사. Codex가 `server/services/campaign.js` 비즈니스 로직, Claude가 마이그레이션 192-205 + API 라우트 + index.html UI를 분담.
- **Critical 2건**: `validateChapterChoice()`가 `[CH7_ID, CH8_ID, CH9_ID, CH10_ID]`만 게이팅(line 3124) — FSP_CH7~10은 화이트리스트 누락. FSP Ch10 ending eligibility 함수 부재로 자격 미달 엔딩 선택지 직접 제출 시 `calculateFspCh10Rewards`(~line 2855)의 100만 GP급 보상 farming 가능. FSP Ch9 `fsp_ch9_signal_pilgrim_arms`도 동일.
- **Major 4건**: `simulatePrologue()`(line 2138) 마지막 씬 도달 검증 없음 → 스킵 farming, `campaign_sessions` 부분 UNIQUE 누락(동시 활성 세션 중복), `simulateChapter`/`calculateRewards` CV/hidden 라우트가 MCC Ch1으로 폴백(line 2175 / 2920+).
- **Minor 3건**: `applyOptionalCampaignReward`/`loadScenesFile` catch 로그 stack 누락, 캠페인 라우트 wallet 길이 검증 누락(`requireWallet` 미적용).
- **결함 외 통과 확인**: 마이그레이션 192-205 무결성, `complete()` `FOR UPDATE` idempotency, v5.33 `applyReputation` SAVEPOINT 격리, 서버 보상 결정성, choice 화이트리스트(Ch1~9, FSP Ch1~6), MCC Ch10 ending eligibility, MCC Ch7/8/9 route prefix 강제, 36개 씬 파일 ↔ CHAPTERS dict ↔ seed 일관, 78개 배경 + 21개 캐릭터 에셋 매핑 일관, index.html 캠페인 UI 흐름.
- **권장 수정 순서**: C1/C2 → M1 → M2 → M3/M4 → m1/m2/m3. 본 커밋은 감사 보고서만 반영하며 코드 수정은 별도 후속.

검증:
- Codex sub-agent가 `server/services/campaign.js` 3716줄 감사
- Claude가 마이그레이션 192-205, `routes/api.js` 캠페인 라우트, `index.html` 캠페인 UI 검사

## 2026-04-30 — Campaign Visual Novel Engine + 배경·캐릭터 에셋 완성 + Internal Error 수정 (v5.33)

### 비주얼 노벨 씬 엔진 (Codex 구현)
- **`showCampaignStory()` 씬 엔진**: 기존 `showCampaignBriefing()` 를 교체하는 새 비주얼 노벨 엔진. 씬 타입별 렌더링(`narration`, `dialogue`, `choice`, `branch`, `battle_transition`, `result`, `ending`)을 지원한다.
- **타이핑 애니메이션**: 한 글자씩 30ms 간격, 탭하면 즉시 전체 표시. `typeText()` + `advanceCampaignScene()`.
- **캐릭터 초상화**: 현재 화자 밝게, 비화자 opacity 0.5. `/assets/campaign/characters/{id}.png`. `_portraitMap`으로 scene speaker ID → 파일명 매핑.
- **배경 이미지**: `/assets/campaign/backgrounds/{id}.png`. `_bgMap`으로 씬 background ID → 파일명 폴백 매핑. 미존재 시 gradient fallback.
- **폴백 라우팅**: `ch.scenes` 없는 챕터는 기존 `showCampaignBriefing()` 유지.

### 이미지 에셋 — Gemini Imagen 3 (GCP Vertex AI)
- **배경 78개**: `assets/campaign/backgrounds/*.png`
  - 기존 8개 (mcc_briefing_room, cargo_ship_interior, mars_sunset 등)
  - Imagen 3 신규 20개: hellas_zone4_deep_tunnel, mcc_board_chamber, erebus_throne_hall, fsp_assembly_hall, olympus_exterior 등
  - Imagen 3 신규 50개 (씬별 전용): kariope_cargo_bay, cargo_ship_corridor, deep_space_window, new_athens_shipyard_dawn/interior/night, hellas_central_exterior 시리즈, mine_shaft/exterior/interior, erebus_crater_panorama/exterior, argyre_canyon_depot, mars_surface_dust_storm 등
- **캐릭터 초상화 21개**: `assets/campaign/characters/*.png`
  - liang_wei, yuna, crow, aisha, hagar, kenji, verk, observer, miner_anon, miner_elder (Imagen 3)
  - 기존 11개 유지
- **스타일**: 32-bit pixel art, semi-realistic concept art, Mars sci-fi, 16:9(배경)/3:4(캐릭터).
- **생성 스크립트**: `scripts/gen_ai_assets.py`, `scripts/gen_missing_backgrounds.py` (GCP ADC 인증).

### 씬 파일 전면 확충
- 36개 챕터 JSON (`docs/campaign-story/`): MCC Ch1~10, FSP Ch1~10, CV Ch1~10, Prologue 3종.
- 각 파일 배경 ID가 `_bgMap` + 실제 파일 78개와 1:1 대응되도록 정렬.

### 버그 수정
- **`complete()` Internal Error**: `applyReputation()` 호출을 `applyOptionalCampaignReward` SAVEPOINT 로 감쌈. `reputation_history` 테이블 이슈 또는 스키마 미적용 시 평판 변경만 건너뛰고 챕터 완료는 유지. 기존에는 이 경우 전체 트랜잭션이 ROLLBACK → 500 "Internal error" 였다.
- **Migration 204**: 방어적 재보장
  - `player_campaign_progress`: `attempts`/`best_metrics`/`last_metrics` ADD COLUMN IF NOT EXISTS
  - `player_lore_flags`: `source_chapter`/`metadata` ADD COLUMN IF NOT EXISTS
  - `reputation_history`, `campaign_sessions`, `player_branch_modifiers` CREATE TABLE IF NOT EXISTS
  - `hidden_campaign_ch1~5` `campaign_chapters` 시드 — hidden 챕터 start 시 FK 위반 방지.
- **`.jpg` → `.png` 확장자 버그**: 배경 로딩 코드가 `.jpg`를 참조해 모든 배경이 gradient fallback으로 표시되던 문제 수정.
- **에러 메시지 개선**: `complete` 라우트에서 DB 스키마 관련 에러 시 힌트 포함 — Railway 로그 없이도 디버깅 가능.

검증:
- `git log --oneline` 확인: 이미지 커밋 78개, 씬 엔진 코드, migration 204 적용 확인
- `ls assets/campaign/backgrounds/ | wc -l` → 78
- `ls assets/campaign/characters/ | wc -l` → 21

## 2026-04-30 — Capital ship Core/Mid material gate + Phase C hijack modal cleanup (v5.32)

- **Migration 203 추가**: `203_capital_ship_core_mid_materials.sql`. `fsp_titan` 에 `nano_polymer:40` 추가(다른 두 Titan 처럼 Mid mat 2종 보유), 모든 Battleship의 `exotic_alloy` 최소치를 3 으로 통일. 어드민 추적용 5개 settings 키 시드 (`capital_ship_core_mat_required`, `capital_ship_mid_mat_required`, `capital_ship_recipe_contract`, `core_exclusive_minerals`, `mid_exclusive_minerals`). 마이그레이션 안에 invariant assertion 포함 — 모든 BS/Titan 이 Core+Mid 광물을 둘 다 포함하지 않으면 적용 실패.
- **CLAUDE.md §8 task #1 클로즈**: Migration 163이 이미 시드한 Core/Mid 전용 재료 정책(Frontier=iron_ore/carbon_fiber/silicon_chip, Mid=titanium_alloy/plasma_crystal/nano_polymer, Core=exotic_alloy/dark_matter/quantum_core)을 강화·문서화 완료. AUDIT_FINDINGS.md 라인 643이 이미 ✅ 표시했지만 CLAUDE.md TODO에서 누락 — 이번에 정합 처리.
- **Phase C 하이잭 모달 정리 (CLAUDE.md §8 task #3)**: `index.html`의 죽은 `hijackModal` HTML(31줄)과 `openHijackModal/closeHijack/confirmHijack` 함수 일괄 제거. `useLegacyDeclare` 게이트 뒤에 숨어 있어 사용자에게 도달 불가능했던 dead code. 진입 헬퍼 `showHijackEntryHint`와 영토 정보 패널의 `hijackFromTerritoryInfo`(claim 모달 → `/api/hijack/declare-with-pp` 경로)는 유지.
- **`/api/hijack/declare` 410 응답 개선**: 메시지를 사용자가 알 수 있는 대안 경로(영토 하이잭=`/api/hijack/declare-with-pp`, AI 결투=`/api/ai/fight`, PvP 토너먼트=`/api/tournaments/:id/register`)와 함께 반환하도록 수정. `phaseC.js` + `services/hijack.js` 라우트 정리 주석 동기화.
- **Smoke 테스트 도구 추가**: `server/tools/smoke_capital_recipes.js`. `node ./server/tools/smoke_capital_recipes.js` 로 `ship.startBuild` (battleship+titan recipe 검증), `resourceCraft.startCraft` (hull_plate, plasma_coil), `hijack` 서비스 export·hijack_battles 스키마, Migration 203 invariant 까지 11항목 직접 검증. CLAUDE.md §8 task #2 검수 통과.

검증:
- `psql ... -f server/migrations/203_capital_ship_core_mid_materials.sql` 적용 (assertion 통과, schema_migrations 등록)
- `psql -c "SELECT recipe_minerals ? 'exotic_alloy' OR recipe_minerals ? 'dark_matter' OR recipe_minerals ? 'quantum_core' AS has_core, recipe_minerals ? 'titanium_alloy' OR recipe_minerals ? 'plasma_crystal' OR recipe_minerals ? 'nano_polymer' AS has_mid FROM ship_types WHERE size_class IN ('battleship','titan')"` → 6/6 모두 t,t
- `node server/tools/smoke_capital_recipes.js` → 11 passed / 0 failed (ship build, resource craft, hijack 서비스, schema, recipe invariant)
- `node --check server/routes/phaseC.js`, `node --check server/services/hijack.js`, `node --check server/tools/smoke_capital_recipes.js`
- `grep -c openHijackModal hijackModal closeHijack confirmHijack index.html admin.html` → 0/0 (ghost ref 없음)

## 2026-04-29 — Bug report 버튼 중복 제거 + SECTORS 좌측 배치 (v5.31)

- **버그리포트 버튼 중복 제거**: `index.html`에 동시에 살아 있던 두 개의 버그리포트 시스템(신규 `#bugReportFab` 🐞 + `class="bug-modal"` / 레거시 `#bugReportBtn` 🐛 + `class="br-*"`)이 같은 `id="bugReportModal"`을 공유해 DOM 충돌을 일으키던 문제를 정리. 신규 시스템(버튼 + 모달 + CSS + JS)을 전부 삭제하고 레거시 단일 시스템만 유지.
- **SECTORS 좌측 정렬**: 살아남은 `#bugReportBtn` 🐛 버튼을 화면 우하단 고정 위치 대신 SECTORS 버튼 바로 왼쪽(8px 간격, 세로 가운데 정렬)에 정렬되도록 `alignBugFab()` rAF-throttled 루틴으로 재배치. 패널 접힘/반응형 변화에도 추적되도록 resize/load/주기 타이머에 묶음.
- **삭제 범위**: `.bug-fab`/`.bug-modal` CSS 블록(약 65줄), 신규 버튼 + 모달 HTML(약 45줄), 신규 시스템 JS(`alignBugFab` 구버전, `selectBugCat`, `openBugReport`, `closeBugReport`, 신규 `submitBugReport`; 약 120줄). 신규 시스템 전용 i18n 키(`bug_report_*`, `bug_cat_*`)는 4개 언어 사전에 남아 있으나 참조하는 UI가 없어 무해한 dead 데이터로 둠.

검증:
- `index.html` 정적 파싱 — `bugReportBtn` 1개, `bugReportFab` 0개, `bugReportModal` 1개(레거시 onclick→`closeBugReporter`).
- 신규 시스템 함수/클래스 잔존 0건 grep 확인.
- `alignBugFab` 리스너(load/resize/DOMContentLoaded/setInterval) 1세트 유지.

## 2026-04-29 — Mobile first-load side panel lock (v5.30)

- **iPhone 첫 화면 패널 잠금**: 1024px 이하에서 좌/우 사이드 패널이 `.open` 상태가 아닐 때 `!important` off-screen transform을 적용해, 첫 진입 시 지도 대신 사이드 화면이 열려 보이는 문제를 차단.
- **iOS 상태 복귀 보강**: `pageshow`, `load`, `orientationchange`에서 `forceCloseMobilePanels()`를 호출해 Safari/Chrome iOS bfcache나 회전 후 이전 open 상태가 남지 않도록 수정.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch7~10 MVP 구현 (v5.29)

- **FSP Ch7 "의회" 추가**: Hellas Central 의회 회기, 5개 의장 후보(Mikhail/Liang/Amara/Diego/Player), 환경 위기 병행 지표, 의장별 Ch8~Ch10 분기 modifier를 서버 시뮬레이션으로 구현.
- **FSP Ch8 "가이아" 추가**: 시민 기부 호소, Gaia 건조율/HP, MCC 절도 성공/실패, 전투 pledge/침묵/개인 기부 선택과 Gaia·Pilgrim Arms seed 보상을 추가.
- **FSP Ch9 "세 개의 깃발" 추가**: MCC/FSP/CV 정상회담, Pilgrim Arms 암살단, 보호 대상 선택(Amara/Chen/Butcher/전원후퇴/신호)과 배신·4파벌·Peacemaker 분기를 추가.
- **FSP Ch10 "자유의 대가" 추가**: Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 보상과 FSP route completion token을 추가.
- **Ch7~10 seed migration 추가**: 신규 환경, 위치, NPC, 의장 후보/지원 modifier/유권자 pool, lore flags, branch modifiers, tags, items, chapter config를 `200_fsp_campaign_ch7_to_ch10.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 FSP Ch1~10 완료/v5.29 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- 운영 DB 기준 migration BEGIN/ROLLBACK 드라이런

## 2026-04-29 — Campaign Ch1 continue/complete 안정화 (v5.28)

- **산소 쟁탈 CONTINUE 복구**: 진행 중인 캠페인 카드의 `CONTINUE`가 기존 `sessionId`를 이어가도록 수정해, 이미 선택지를 고른 Ch1을 다시 시작/초기화하지 않게 했다.
- **완료 트랜잭션 안정화**: blueprint inbox, 칭호, 환경 숙련도, 태그, lore flag, branch modifier 지급을 `SAVEPOINT`로 격리해 부가 보상 하나가 실패해도 GP/XP/평판/진행 완료가 500으로 죽지 않도록 보강.
- **Ch1 구식 id 정리**: Ch1 보상의 다음 챕터 unlock과 cold death failure branch에 남아 있던 `mcc_ch2`/`mcc_ch6` 구식 id를 캠페인 상수 기반 id로 교체.

검증:
- 운영 DB 읽기 전용 schema/status 점검
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — Campaign Quick Button 기준 위치 재조정 (v5.27)

- **데스크탑 위치 재조정**: CAMPAIGN 퀵 버튼을 오른쪽 줌 컬럼의 되돌리기 버튼 위로 이동.
- **모바일 위치 재조정**: CAMPAIGN 퀵 버튼을 왼쪽 하단의 "화성을 클릭하여 영토 선택" 모드 배지 바로 위로 이동.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — Campaign Quick Button 위치 보정 (v5.26)

- **데스크탑 위치 보정**: CAMPAIGN 퀵 버튼을 하단 중앙 액션 영역에서 빼고, 좌측 패널 오른쪽 상단 보조 액션 위치로 이동.
- **태블릿/모바일 위치 보정**: 하단 네비/오른쪽 OPS·줌 조작과 겹치지 않도록 상단 왼쪽 작은 pill 위치로 이동.

검증:
- `index.html` 인라인 script 파싱
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch5~6 MVP + Campaign UI 압축 (v5.25)

- **FSP Ch5 "Kepler 공유지" 추가**: Liang Wei, Roth dead drop, Kepler 3파벌 회담, 산소 보급 시한, Commons/중재/압박/전투/외계 기원 공개 5분기 서버 시뮬레이션 추가.
- **FSP Ch6 "두더지" 추가**: Kenji Tanaka 내부 스파이 색출, Sarah/Diego red herring, 단서 수집 지표, 처형/이중첩자/추방/오판 분기와 Ch7~Ch9 branch modifier 추가.
- **조건부 선택 검증 보강**: Ch5 Roth 데이터 압박/전면 공개 선택은 Roth/Lenag Wei 관련 증거 flag가 있을 때만 서버에서 허용.
- **캠페인 UI 압축**: QUESTS 탭의 잠긴 챕터 카드를 기본 접힘 compact list로 바꾸고, 메인 지도에 CAMPAIGN 퀵 진입 버튼을 추가.
- **Ch5~6 seed migration 추가**: 신규 환경, 위치, NPC, dead drop, internal zones, clue pool, suspect pool, lore flags, branch modifiers, tags, item, chapter config를 `199_fsp_campaign_ch5_ch6.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 MCC Ch1~10 + FSP Ch1~6/v5.25 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

## 2026-04-29 — FSP Campaign Ch4 Diplomacy MVP 구현 (v5.24)

- **FSP Ch4 "외교" 추가**: Sandstone Junction 비밀 회담, Cinder Grace 첫 등장, Amara 보호, MCC 정찰 회피/조건부 교전 MVP 시뮬레이션 추가.
- **협상 선택지/분기 구현**: 피난소 제공, 보급 공유, MCC 정보 교환, 산소 노예제 증거 공유, 협상 중단 5개 선택지와 Cinder 동맹 강도/적대 branch modifier를 반영.
- **조건부 증거 선택 검증**: `fsp_ch4_evidence_share`는 FSP Ch3 lore flag 또는 MCC cross-route branch modifier가 있을 때만 서버에서 허용하도록 보강.
- **Ch4 seed migration 추가**: `198_fsp_campaign_ch4_diplomacy.sql`에 Sandstone Junction, Cinder Grace, 신규 환경, lore flags, branch modifiers, tags, item, chapter config를 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`와 audit 문서를 MCC Ch1~10 + FSP Ch1~4/v5.24 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- 전달된 FSP Ch4~6 spec에서 Ch5/Ch6는 “Sprint 2/3 작성 예정” placeholder라 이번 커밋에는 Ch4만 구현했다.

## 2026-04-29 — FSP Campaign Ch1~3 MVP 구현 (v5.23)

- **FSP Ch1 "방파제" 추가**: New Athens 차 두 잔 의식, H2O 호송 2척, 응급 환자 2명, CV 약탈단 4파 MVP 시뮬레이션과 낮은 FSP 단가 보상 구조 추가.
- **FSP Ch2 "얼음 캐러밴" 추가**: 북극관 → New Athens 얼음 운반, 태양광 노출 누적 손실, Phobos Eclipse 그늘 점프, Lena 개인 서사와 Sal Cruz 매복 분기 추가.
- **FSP Ch3 "피의 광산" 추가**: Verin-7 고도 8km 산소 노예제, 산소 조절기 5개, 광부 412명 구출, 60명 잔류 결정과 Samuel/Amara 분기 추가.
- **FSP 전용 seed migration 추가**: lore flags, branch modifiers, tags, NPC, 환경, item, settlement seed와 FSP Ch1~3 chapter config를 `197_fsp_campaign_ch1_to_ch3.sql`에 추가.
- **정착지 기반 seed 추가**: `settlement_data`를 안전하게 생성/확장하고 New Athens/Cold Brook/Ridge Town/Hellas Central 초기 데이터를 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위를 MCC Ch1~10 + FSP Ch1~3/v5.23 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- FSP Ch1~3도 MVP server simulation 단계이며, Tea Ceremony/Patient Gauge/Ice Gauge/Oxygen Regulator UI와 full battle engine 객체화는 후속 P1/P2.

## 2026-04-29 — MCC Campaign Ch8~10 MVP 구현 (v5.22)

- **MCC Ch8 "프로메테우스" 추가**: Deimos 조선소 4-phase 환경 시퀀스, Branch A 파괴 작전, Branch B/C 방어 작전, Prometheus Titan/조기 Ending 3 분기를 서버 시뮬레이션으로 구현.
- **MCC Ch9 "깨진 동맹" 추가**: Olympus/Hellas/Valles/Kepler 4전장 병렬 MVP, Pilgrim Arms 24척 침입, Amara/Butcher/Chen 관련 NPC 운명과 Ch10 branch modifier 반영.
- **MCC Ch10 "주주 엔딩" 추가**: cinematic-only 엔딩 챕터와 Ending 1~4/fallback 보상, lore flag, title tag, NG+ cross-route modifier 지급 추가.
- **엔딩 자격 서버 검증**: `calculateEligibleEndings()`를 추가해 Branch A/B/C, Roth 데이터, MCC 평판, blackmail data, Chen 사망 조건에 맞는 엔딩만 선택 가능하게 제한.
- **루트 선택 검증 확장**: Ch7뿐 아니라 Ch8/Ch9도 활성 Ch6 루트와 맞지 않는 선택지를 `/api/campaign/choice`에서 거부.
- **통합 seed migration 추가**: Ch8~10 lore flags, branch modifiers, tags, NPC, special asset, item definitions, achievements, environment/chapter config를 `196_mcc_campaign_ch8_to_ch10.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위를 MCC Ch1~10 완료/v5.22 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch8~10도 MVP server simulation 단계이며, Ch8 full environmental sequence UI, Ch9 parallel battlefield UI, Ch10 cinematic playback/credits roll은 후속 P1/P2.

## 2026-04-29 — MCC Campaign Ch5~7 MVP 구현 (v5.21)

- **MCC Ch5 "케플러 분쟁" 추가**: low gravity/oxygen pressure 환경, Roth 데이터 공개, FSP 차단/보급선 호위/단독 데이터 탈취/CV 자급 모선 격파 4분기와 보상/실패 분기 추가.
- **MCC Ch6 "내부고발자" 추가**: Li Fang 지원, Chen 보고, 자료 사본 보관 3개 루트 확정 선택과 `mcc_route_a/b/c_active` branch modifier, ending modifier, 태그/서사 플래그 지급 추가.
- **MCC Ch7 "시장 전쟁" 추가**: Ch6 루트 기반 A/B/C 변형 선택지와 Market War 결과, CV 불안정/Chen 감시/Helion 자회사 인수 분기 추가.
- **루트 잠금 검증 보강**: Ch7 시작 조건은 Ch6 루트 branch modifier를 요구하고, 선택 API도 활성 루트에 맞지 않는 Ch7 선택지를 서버에서 거부.
- **운영 status 호환 수정**: `player_branch_modifiers` 조회가 실제 스키마의 `set_at` 컬럼을 사용하도록 정정해 `/api/campaign/status/:wallet` 500을 방지.
- **통합 seed migration 추가**: Ch5~7 lore flags, branch modifiers, tags, NPC, data artifact, 신규 환경, chapter/environment config를 `195_mcc_campaign_ch5_to_ch7.sql`에 추가.
- **핸드오프 문서 업데이트**: `CLAUDE.md`의 현재 캠페인 구현 범위와 마지막 migration 정보를 Ch1~7/v5.21 기준으로 갱신.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/services/campaign.js` + `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch5~7도 MVP server simulation 단계이며, 실제 함선/건물/NPC 전투 객체를 v11.1 full battle engine에 연결하는 작업은 후속 P2/P3.

## 2026-04-29 — MCC Campaign Ch2~4 MVP 구현 (v5.20)

- **MCC Ch2 "동결된 고속도로" 추가**: Hellas 채굴장 인수, `night_freezing` 환경, 시설 HP/민간인 피해/민병대 격파 서버 시뮬레이션과 보상/실패 분기 추가.
- **MCC Ch3 "이사회" 추가**: Chen Weiss 첫 등장, Helion/Verin/Chromium 3분기 선택, Phobos Eclipse MVP 시뮬레이션, 분기별 보상과 Ch6/Ch7 branch modifier 추가.
- **MCC Ch4 "해적 매수" 추가**: Kara Vex 첫 등장, Ion Storm 회담 호위, 함대 명령 차단 상태, Helion 습격대/생존/도주 분기 시뮬레이션 추가.
- **통합 seed migration 추가**: Ch2~4 lore flags, branch modifiers, `clean_operator`, 신규 환경, NPC 정의, chapter/environment config를 `194_mcc_campaign_ch2_to_ch4.sql`에 추가.
- **캠페인 UI 범용화**: QUESTS 캠페인 카드/모달/결과 화면이 Ch1 전용 문구와 지표에 묶이지 않도록 챕터별 위치/환경/주요 metric을 표시.
- **시작 조건 적용**: prerequisite, required level, required reputation, blocking tags를 서버에서 검증하고 locked chapter는 UI에서 비활성화.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- 운영 DB 기준 migration ROLLBACK 드라이런
- `git diff --check`

비고:
- Ch2 구조물/민간인 객체, Ch3 자회사 함선 6종, Ch4 NPC protection/manual-only mode의 full battle engine 통합은 후속 P2/P3.

## 2026-04-28 — Campaign Common Systems 기반 확장 (v5.19)

- **공통 캠페인 DB 추가**: `campaigns`, `chapters`, `campaign_sessions`, `reputation_history`, tag/lore/branch/environment 정의 테이블과 Ch1 환경 config seed 추가.
- **평판 시스템 확장**: MCC/FSP/CV/Pilgrim Arms 4축을 지원하고, -100~100 clamp와 `reputation_history` 감사 로그를 추가.
- **공통 API 추가**: `/api/campaign/abandon`, `/api/reputation/*`, `/api/tags/*`, `/api/lore/*`, `/api/branch/*` 추가. 보상/평판/태그/lore/branch 조작 endpoint는 admin secret 기반 internal-only로 제한.
- **환경 시스템 MVP 추가**: 챕터 환경 phase 상태와 전투 modifier 계산 helper를 추가해 MVP 시뮬레이션과 추후 full engine 양쪽에서 재사용 가능하게 정리.
- **캠페인 UI 보강**: QUESTS > CAMPAIGN 패널에 MCC/FSP/CV 평판 게이지를 추가.
- **status payload 보정**: 캠페인을 아직 시작하지 않은 유저도 `reputation` 4축 기본값 `0`을 받도록 정리.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱

비고:
- 복잡한 branch modifier 조건 평가 엔진, 챕터 spec 자동 검증 스크립트, v11.1 full engine 환경 hook은 P2/P3로 분리.

## 2026-04-28 — MCC 캠페인 Ch1 MVP 구현 (v5.18)

- **캠페인 기반 DB 추가**: `campaign_chapters`, `player_campaign_progress`, `player_reputation`, 선택지/태그/서사 플래그/분기 modifier/보상 inbox 테이블을 추가.
- **MCC Route Ch1 "산소 쟁탈" 추가**: `server/services/campaign.js`에서 브리핑 선택지, 평판 변화, dust storm 단계, 산소 회수율, 성공/실패 결과를 서버 결정형 시뮬레이션으로 계산.
- **캠페인 API 추가**: `/api/campaign/status/:wallet`, `/api/campaign/start`, `/api/campaign/choice`, `/api/campaign/progress`, `/api/campaign/complete` 추가.
- **QUESTS 탭 CAMPAIGN UI 추가**: MCC Ch1 카드, Li Fang 브리핑 모달, 선택지, 압축 진행 화면, 결과/보상 모달을 추가.
- **보상 지급 트랜잭션화**: GP/XP/평판/칭호/환경 숙련도/아이템 inbox 기록을 완료 처리 트랜잭션 안에서 처리.

검증:
- `server/services/campaign.js` `node --check`
- `server/routes/api.js` `node --check`
- `server/routes/api.js` require 스모크
- `index.html` 인라인 script 파싱
- `git diff --check`

비고:
- v11.1 실시간 전투 엔진 완전 통합, Helion 전용 함선/화물선 보존 전투 로직, 프롤로그 route lock은 Phase 2로 분리.

## 2026-04-28 — 내 영토 테두리 두께 완화 (v5.17)

- **내 영토 금색 테두리 완화**: halo 두께와 crisp line 두께를 낮춰 지도 위에서 과하게 떠 보이지 않도록 조정.
- **내 영토 fill/광도 조정**: 금색 fill alpha와 shadow 강도를 낮춰 배경 텍스처 가독성을 회복.
- **작업 규칙 명문화**: `CLAUDE.md`에 커밋/푸시 시 `CHANGELOG.md`와 `AUDIT_FINDINGS.md`를 함께 갱신하는 규칙 추가.

검증:
- `index.html` 인라인 script 파싱

## 2026-04-28 — 영토 시인성/텍스처 예산 개선 (v5.16)

- **영토 색 체계 단순화**: 내 영토는 금색, 다른 플레이어는 cyan, NPC는 회보라 점선으로 통일해 지도에서 즉시 구분되도록 정리.
- **이미지 영토 외곽선 개선**: 업로드 이미지가 있는 claim도 같은 색 체계를 따르는 두께/halo 외곽선을 적용.
- **텍스처 품질 예산화**: 기본 데스크톱은 안정적인 4K 유지, 고성능 데스크톱만 6K 자동 사용, `localStorage.marsHiResTexture='1'`일 때만 8K 합성 사용.

검증:
- `index.html` 인라인 script 파싱

## 2026-04-28 — POI 광물 발견 실패 수정 (v5.15)

- **POI mineral 로그 제약 수정**: `exploration_pois`는 `mineral` 보상을 생성하지만 `poi_discoveries` 로그 제약이 `mineral`을 허용하지 않아 발견 트랜잭션이 롤백되던 문제 수정.
- **광물 보상 표시 개선**: POI 발견 결과에서 `mineral` 보상을 아이템처럼 아이콘/이름/수량으로 표시.

검증:
- 운영 DB `poi_discoveries_reward_type_check`에 `mineral` 허용 확인
- `index.html` 인라인 script 파싱

## 2026-04-28 — 하이잭 자동승리 영토 표시 수정 (v5.14)

- **NPC/무함대 자동승리 claim 생성 보강**: 새 픽셀 없이 기존 적 픽셀만 하이잭한 경우에도 공격자 `claims` 레코드를 생성하고, 이전된 픽셀의 `claim_id`를 새 claim에 연결.
- **Phase 2 승리 audit 보강**: 전투 승리 후 새 claim을 사후 생성한 경우 `hijack_battles.new_claim_id`에도 기록.
- **자동승리 즉시 렌더 수정**: 클라이언트가 새 claim을 임시 추가할 때 `lat/lng/w/h` 필드명을 사용하도록 수정해 새로고침 전에도 내 영토 골드 표시가 안정적으로 보이게 함.

검증:
- `server/services/hijack.js` `node --check`

## 2026-04-28 — 전수 버튼/하이잭 플로우 감사 (v5.13)

- **하이잭 전투-only 진입점 차단**: Governor 대시보드 `HIJACK` 버튼과 Phase C 하이잭 모달이 `/api/hijack/declare`를 통해 영토 이전 없는 전투만 만들 수 있던 경로를 제거.
- **`/api/hijack/declare` 서버 안전장치**: legacy endpoint는 `410 HIJACK_DECLARE_DEPRECATED`를 반환하도록 변경. 실제 영토 하이잭은 `/api/hijack/declare-with-pp`만 사용.
- **죽은 서비스 UI 정리**: 제거된 `weeklyChallenges`, `gpBurn`, `luckyBox` 관련 player/admin 버튼이 404/503 API를 호출하지 않도록 no-op/안내 상태로 정리.
- **보조 버튼 플로우 보강**: `govSaveDeclaration()` 누락, `/api/fleets/my` alias, World Event detail fallback 문제 수정.

검증:
- `index.html` / `admin.html` 인라인 script 파싱
- `index.html` / `admin.html` / tactical-lab inline handler 전수 검사
- 서버 JS 전체 `node --check`
- hijack/battle/routes require 스모크
- 제거된 legacy endpoint 문자열 grep 확인

## 2026-04-28 — 핵심 플레이 라인 검수 및 버그 수정 (v5.12)

- **함선 건조/수리 재료 차감 수정**: `user_resource_inventory.resource_code`로 접근하던 경로를 실제 스키마인 `resource_id` 기반으로 정정.
- **자원 제작 루프 수정**: tier 자원 제작 시작/완료/취소 환불이 `resources.code -> resource_id` 조인을 통해 일관되게 동작.
- **고급 강화 재료 차감 수정**: `enhancementAdvanced` 재료 조회/차감이 실제 인벤토리 스키마와 일치.
- **하이잭 Phase 1 전투 수정**: 프리깃/구축함만 투입된다는 UI/문서 규칙을 battleEngine과 battleScheduler 통계에 반영.
- **하이잭 HP 보존 수정**: 전투 결과 HP 반영이 `result.timeline.frames`를 보도록 수정.
- **영토 정보 HIJACK 버튼 수정**: 전투-only Phase C 모달 대신 PP 정산/픽셀 이전이 포함된 `/api/hijack/declare-with-pp` 플로우로 연결.
- **admin resource circulation view 수정**: `user_resource_inventory` 조인을 `resource_id` 기준으로 정정.

검증:
- 서버 JS 전체 `node --check`
- route/service require 스모크
- `index.html` 인라인 script 파싱

## 2026-04-28 — 네이티브 다이얼로그 전면 제거 (v5.10)

### 브라우저 confirm() / prompt() / alert() → 인게임 모달

| 위치 | 함수 | 용도 |
|------|------|------|
| `index.html` | `gameConfirm({icon,title,body,confirmText})` → Promise | 범용 확인 모달 (기존) |
| `index.html` | `gameInput({title,label,placeholder,defaultValue,maxLength})` → Promise | 텍스트 입력 모달 (기존) |
| `admin.html` | `adminConfirm(msg, title)` → Promise | 어드민 전용 확인 모달 (신규) |
| `tactical-lab-v11.html` | 인라인 `#forfeit-overlay` CSS 오버레이 | RETREAT 전용 |

**변경 내역:**
- `index.html` `confirm()` 15곳 전부 `gameConfirm()` 교체 (수송·길드·동맹·함대·건조 취소·계정 삭제)
- `admin.html` `confirm()` 70곳 전부 `adminConfirm()` 교체, 67개 함수에 `async` 자동 추가
- `tactical-lab-v11.html` RETREAT `confirm()` → `#forfeit-overlay` 인라인 오버레이
- `admin.html`에 `adminConfirm` CSS + HTML + JS 삽입 (어드민 스타일 오렌지 테마)

**추가 완료 (같은 세션):**
- `admin.html` `showToast()` 신규 구현 — 기존 95곳 undefined 호출 정상화, `alert()` 275개 교체
- `admin.html` `adminInput()` 신규 구현 — `prompt()` 5개 교체
- `index.html` `prompt()` 10곳 → `gameInput()` 전부 교체 (영토이름, 콘텐스트, 렌탈, 동맹 입출금/창설)
- `index.html` 잔여 `alert()` 1곳 → `gameAlert()` 교체
- **결과: 코드베이스 전체에 브라우저 네이티브 다이얼로그 0개**

## 2026-04-27 — 함대전 HP 보존 + 속도 조절 + 무한 전투 (v5.9)

- **battleEngine.js** 타임아웃(MAX_TICKS 54000) 시 HP 비교 승자 선정 → `draw`로 변경 — 전투는 함선 전멸로만 끝남
- **battleScheduler.js** WS frame 스트리밍 `tickMs/4` → `tickMs/8` (기본 2배 빠른 전송)
- **tactical-lab-v11.html** SPEED 버튼 패널 추가 (×1/×2/×4/×8) — WS 없는 로컬 시뮬 전용, WS 모드는 서버 8x 스트리밍 적용
- **fleetBattles.js** `POST /api/battles/:id/forfeit` 신규 endpoint — 공격자가 전투 포기 시 preparing이면 즉시 취소, 이미 시뮬됐으면 현재 HP 보존
- **tactical-lab-v11.html** 🏳 RETREAT 버튼 → `/api/battles/:id/forfeit` 호출 → 부모에 `forfeit` postMessage → 조선소 FLEET 탭 자동 열기
- **index.html** forfeit postMessage 핸들러: 뷰어 닫기 → 토스트 → 조선소 FLEET 탭 이동
- **battleEngine.js** `captureFrame` 에 `maxHp`, `side` 추가 — WS 첫 프레임에서 HP바 최대값 보정
- **tactical-lab-v11.html** WS 첫 프레임 수신 시 `atkMaxHP`/`defMaxHP` 서버값으로 재보정 (`_wsMaxHpCalibrated`)
- **index.html** `loadBvSidePanels`: participants 배열 기반으로 내 함대 vs 적 함대 구분 — 지갑 비교 기준 수정
- **index.html** `showBattleResult`: "나" 배지 + 승리/패배 서브타이틀 표시

## 2026-04-27 — 하이젝 후 영토 즉시 금색 반영 (v5.8)

- **server/services/hijack.js** `declareHijackWithPP` 응답에 `hijacked_pixels`, `new_pixels_list` 추가 — auto_win 시 이전된 픽셀 좌표 반환
- **index.html** auto_win 핸들러: 서버 응답으로 `_serverPixels` 즉시 업데이트 → `_rebuildOwnerData()` + `compositeClaimsOnTexture()` 즉시 호출 — Railway DB 레이턴시와 무관하게 하이젝 즉시 금색 표시
- 기존 2s+6s API 재시도는 백업으로 유지

## 2026-04-26 — 모바일 영토 텍스트 색 + 골드 강도 향상 (v5.7)

- **index.html** CSS `.mob-territory-card .mt-val`: `var(--tx1)` (미정의 → 검정) → `var(--tx)` (크림 `#E8E0D8`) — 모바일 좌표/크기 텍스트 가독성 복구
- **index.html** `compositeClaimsOnTexture` isMine 골드 시각 강화: fill alpha 0.40→0.65, shadowBlur 8→12, 외곽선 alpha 0.35→0.6, halo lineWidth 6→10, inner line 2.2→3

## 2026-04-26 — 하이젝 전투 3종 수정 (v5.6)

- **battleEngine.js** `applyBattleResults`: 하이젝 전투(`battle_type LIKE 'hijack%'`) 시 함선 파괴 없음 — 시뮬 최종 HP 반영, 0 이면 max_hp×15% 보존 (is_alive=true 유지)
- **index.html** `openBattleViewer`: TIMELINE_NOT_FOUND 시 전투 진행 중이면 에러 없이 대기(iframe WS 처리). 폴링 15s→60s 연장. 전투 종료 확인 후에만 에러 토스트.
- **index.html** 하이젝 auto_win 후 픽셀 갱신: 2s+6s 두 번 재시도 + claims 배열도 동시 갱신 (Railway DB 레이턴시 대응)

## 2026-04-26 — 내 영토 골드 하이라이트 (v5.5)

- **index.html** `compositeClaimsOnTexture`: `isMine` 영토 골드 색상 `{r:255,g:209,b:102}` 적용 (fill alpha 0.40, border shadowBlur:8 글로우, lineWidth 2.2)
- **index.html** 지갑 주소 대소문자 무관 비교 — `myAddr`, sortedClaims sort, isMine 체크, `showTerritoryInfo` 전부 `.toLowerCase()` 적용
- 결과: 글로브에서 내 영토가 NPC/타인 영토와 명확히 구분되는 금색으로 표시됨 (캔버스 픽셀 샘플 `[252,205,101,255]` 확인)

## 2026-04-26 — 내 영토 표시 + 전투 버튼 정리 (v5.4)

- **index.html** `compositeClaimsOnTexture`: `isMine` 에서 `_myLandMode &&` 조건 제거 → 내 영토 항상 밝게 렌더
- **index.html** `showTerritoryInfo`: 내 영토 클릭 시 상단 오렌지 border + "✦ 내 영토 ✦" 배지
- **tactical-lab-v11.html**: Reinforce 3개 버튼 제거 (ws 전투에서 서버 미반영)
- **tactical-lab-v11.html**: Scatter, Rally 기동 버튼 추가 (기존 MANEUVERS 정의는 있었으나 버튼 누락)

## 2026-04-26 — Tactical-lab 전투 뷰어 4종 버그 수정 (v5.3)

- **battleEngine.js**: wedgeSides 처리 `f.movement='wedge'` → `f.formation='wedge'` (크래시 root cause)
- **tactical-lab-v11.html**:
  - MANEUVERS/FORMATIONS null-safe fallback (`||MANEUVERS.advance`, `||FORMATIONS.sphere`) 전체 적용
  - ws sync 시 MANEUVERS/FORMATIONS 유효성 검사 후 적용
  - ws mode에서도 `fire(sh, wsMode)` 시각 전용 bullet/laser 활성화 (`visual:true` → applyDmg 스킵)
  - `centeredPos(n, side)` 함수: 1 vs 1 → 캔버스 정중앙(H*0.5), n대 → 균등 분배
  - 자동 줌/팬 카메라: 생존 함대 bounding box → `camScale/camCx/camCy` lerp, canvas transform 적용

## 2026-04-26 — 함선 단위 정밀 폭발 이펙트 (v5.2)

- **battleEngine.js**: ws frame ships 배열에 `code` 필드 추가 (ship_type_code)
- **tactical-lab-v11.html**:
  - 매 ws frame 수신 시 이전 프레임과 diff → 격침 함선마다 위치 기반 `mkExp()` 트리거
  - size_class 별 폭발 반경 차별화 (frigate 1.2 → titan 6.0)
  - battleship/titan 격침 시 추가 shockwave + 격침 로그
  - fleet dead 전환 시 shockwave 즉시 트리거
  - `initBattle()` 에서 `_wsPrevShips` 리셋

## 2026-04-26 — Phase 2 완료: WebSocket 실시간 함대전 (v4.8~v5.1)

### Phase 2 4가지 모두 ✅
| Phase | 내용 | 커밋 |
|---|---|---|
| 2-A | WebSocket 인프라 (server/wsServer.js + index.js attach + battleScheduler frame stream) | v4.8 `ba34f9a` |
| 2-B | 클라이언트 ws 연결 + ws_end → 결과 카드 즉시 표시 | v4.9 `7d9fcd3` |
| 2-C | fleet 단위 동기화 (위치/HP/진형/기동) — dbFleetId 매핑 | v5.0 `ccbdfb0` |
| 2-D | 자체 시뮬 fire/damage + 자동 재시작 비활성화 | v5.1 `49d0138` |

### 동작 흐름 (사용자 hijack 후)
1. viewer → tactical-lab iframe 로드 → ws 연결 (`ws://.../ws/battle/{id}?token=`)
2. 명령 로그: "🔌 실시간 연결됨"
3. 서버 battleScheduler 가 시뮬 결과 frames 를 4x speed 로 ws stream
4. iframe 가 매 frame 받아 자체 fleets 의 cx/cy/hp/formation/maneuver 갱신
5. 자체 시뮬 fire/damage 비활성 — 진짜 데이터로만 시각화
6. 사용자 컨트롤 (진형 변경 등) → ws cmd → commanderActions → 다음 battle 적용
7. 시뮬 종료 → ws_end → 부모 viewer 의 결과 카드 즉시 표시
8. 자동 재시작 안 함 (실제 hijack 결과 영구)

### 사용자 요구 4가지 최종 진행도
| # | 요구 | 상태 |
|---|---|---|
| 1 | tactical-lab 모든 항목 그대로 이식 | ✅ iframe + 우리 catalog/fleet-presets |
| 2 | 모든 항목 실제 게임과 연결 | ✅ ?bid → fleet 데이터 + ws frame 동기화 |
| 3 | 유저 컨트롤 (진형/기동/EMP/집중) | ✅ postMessage + ws cmd → commander_actions → battleEngine |
| 4 | 실시간 (hijack manual + AI 자동) | ✅ AI strategy + ws 실시간 frame + end 즉시 결과 |

---

## 2026-04-26 — Phase 4: AI Strategy + Phase 5 검증 (v4.7)

### Phase 4 — AI 전략 (PvP/Siege/Event 자동 진형/기동)
- **`services/aiStrategy.js`** 신규
  - 파벌별 doctrine:
    - MCC: screen 50% / sphere 30% / wedge 20% + advance 50% / flank 30% / rally 20%
    - FSP: sphere 50% / screen 30% / pincer 20% + advance 40% / rally 35% / retreat 25%
    - CV : wedge 50% / pincer 30% / sphere 20% + flank 50% / advance 35% / scatter 15%
  - `applyAIStrategy(battleId, battleType)` — hijack 외 battle 양쪽에 자동 commander_actions INSERT
  - `pickFormation(faction)` / `pickManeuver(faction)` weighted random
- **Migration 190**: `ai_strategy_enabled=true` settings (admin 토글 가능)
- **`battleScheduler.js`**: simulate 직전 hook 추가 — hijack 외 battle 자동 적용
- 검증: 테스트 battle #20 (PvP) → atk(MCC): screen+rally, def(FSP): sphere+retreat 정확히 INSERT

### Phase 5 — tactical-lab 패널 실데이터 연결 (이미 동작 중)
- tactical-lab v11 의 `loadCatalog()` 가 이미 `/api/tactical-lab/catalog` 에서 우리 DB 데이터 fetch:
  - `MINERALS` (13종 광물) ← `resources` 테이블
  - `FACTIONS` (3파벌) ← `factions` 테이블
  - `SHIPS` (22종 함선) ← `ship_types` 테이블
- FLEET STATUS 패널 → 시뮬 중인 fleets (?bid=N 으로 받은 진짜 함대)
- SHIP REGISTRY 패널 → 우리 ship_types 22종 자동 표시
- MINERALS 패널 → 우리 resources 13종 자동 표시
- DOCTRINES 패널 → 별도 분석 화면 (시뮬 데이터 기반)
- **추가 작업 불필요** — 검증 완료

### 누적 v4.0~v4.7 (Battle Viewer = Tactical Lab 통합)
- viewer 자체 canvas/HUD/컨트롤 폐기, tactical-lab v11 iframe 통째 통합
- `?bid={battleId}` 로 실제 fleet 구성 주입
- 데스크탑 1500×820, 양쪽 240px 사이드 패널 (MY FLEET / RESOURCES / ENEMY FLEET / BATTLE STATS)
- 모바일 풀스크린 유지
- 컨트롤 (진형 4종 / 기동 5종 / EMP / 집중공격) → postMessage → API → 시뮬 실제 적용
- AI 전략으로 PvP/Siege 자동 명령
- 결과 카드 디자인 + 재시작 버튼 제거 + 함선 HP DB 반영

### 잔여 Phase
- **Phase 2 (다음 사이클)**: WebSocket 실시간 frame broadcast — battleScheduler tick → ws emit, 클라 실시간 렌더링. 진정한 "실시간" 함대전.

---

## 2026-04-26 — Phase 3-B: Commander Actions → Sim Apply (v4.6)

### 사용자 요청 4가지 (Phase 1~3 단계 완료):
1. ✅ tactical-lab 모든 항목 우리 게임에 그대로 이식
2. ✅ 모든 항목 실제 게임과 연결 (fleet-presets ?bid)
3. ✅ 함대전 유저 컨트롤 가능 (postMessage bridge)
4. 🟡 실시간 함대전 (WebSocket) — Phase 2 다음 사이클

### Migration 189 — commander_actions formation/maneuver 지원
- CHECK constraint 에 `formation_change`, `maneuver_change` 추가
- settings: `commander_action_formation_gp_cost=0`, `commander_action_maneuver_gp_cost=0` (잦은 변경 무료)

### `services/commanderActions.js` 강화
- `VALID_FORMATIONS` (sphere/wedge/screen/pincer) + `VALID_MANEUVERS` (advance/flank/retreat/scatter/rally) 검증
- mutable 액션 (formation/maneuver):
  - quota 카운트 제외
  - 중복 시 UPDATE (params 변경 가능)
  - GP 재차감 안 함
- `loadForBattle` 결과에 `formationsBySide` + `maneuversBySide` 추가

### `services/battleEngine.js` 적용
- `initializeBattle` 가 양쪽 함대에 commanderActions 의 formation/maneuver 적용
- focus_fire / wedge / EMP / reinforce 는 기존대로

### 검증 (preview)
- 테스트 battle #19 에 lain 등록 후:
  - formation_change wedge → 200 OK
  - maneuver_change flank → 200 OK
  - formation_change sphere (mutable update) → 200 OK
  - emp → 200 OK
  - 최종 list 3건 (sphere, flank, emp)

### 잔여 Phase
- **Phase 2**: WebSocket 실시간 frame broadcast (battle scheduler tick → ws emit)
- **Phase 4**: AI 전략 (services/aiStrategy.js) — hijack 외 battle 에 자동 진형/기동 INSERT
- **Phase 5**: tactical-lab FLEET STATUS / SHIP REGISTRY / MINERALS / DOCTRINES 패널을 실제 게임 데이터에 연결

---

## 2026-04-26 — Battle Viewer 데스크탑 오버레이 (v4.0)

### 🟢 사용자 요청: "데스크탑에서 전투화면 좀 오버레이로 작게 보여야 할 텐데 너무 풀화면이더라고"
- **Fix**: `.bv-backdrop` 에 데스크탑 미디어쿼리 추가 — `min-width:769px` 일 때 중앙 오버레이 (max 1100×680, 92vw/88vh, border-radius 12px, dim 배경 rgba(0,0,0,.82))
- 모바일 (≤768px) 은 풀스크린 유지 (기존 그대로)
- 사용자 데스크탑에서 hijack/declare 후 viewer 가 적당한 사이즈로 떠 globe 화면을 일부 가림 → 게임 컨텍스트 유지

---

## 2026-04-26 — POI Mineral Loot + NPC 함선 일괄 부여 (v3.9)

### 🟢 사용자 요청: "POI 에도 GP/아이템/광물 섞여서 나오는게 맞지?"
- **Migration 188**: `poi_drop_mineral_weight=25` + 광물 풀 (rocket 과 동일 6종) + qty 1~4 settings
- **`exploration_pois.reward_type` CHECK constraint** 갱신: `'mineral'` 추가
- **`spawnPOIs`**: weighted pick 에 mineral 분기 추가 (resources random + qty)
- **`claimPOI`**: mineral 처리 — `user_resource_inventory` ON CONFLICT 적립
- 기존 GP weight 70 → 50 으로 균형 조정
- POI 50 / Item 20 / Mineral 25 / PP 10 분포 (admin 조정 가능)

### 🟢 사용자 요청: "NPC 들에게 함선 부여 — hijack 함대전 테스트 안 됨"
- `/admin/api/fleet/grant-starter-all-npcs` 호출
- 결과: total 21 NPC, granted 3 (새로 부여), alreadyHad 18 (이미 보유), errors 0
- 모든 NPC 함대 보유 → hijack 시 함대전 정상 트리거 가능

---

## 2026-04-26 — Rocket Drop Mineral Loot + 새 Rocket SVG + viewer 롤백 (v3.8)

### 🔴 사용자 신고: "자원드롭 15개인데 GP만 존나 나옴"
- **원인**: `services/rocket.js` 보상 풀이 GP 50% / Item 25% / XP 17% / PP 6% / Cosmetic 2% — 광물(mineral) 카테고리 자체가 없음.
- **Fix**: mineral 카테고리 추가
  - **Migration 187**: `rocket_drop_mineral_weight=25`, `rocket_drop_mineral_pool` (6종 광물 admin 조정), `rocket_drop_mineral_min_qty/max_qty=1~5`. 기존 GP weight 50→30 으로 균형 조정.
  - rocket.js: weighted pick 에 mineral 분기 추가 (resources 테이블에서 random pick + qty)
  - claim 로직: `user_resource_inventory` 적립 (resource_id 기반 INSERT...ON CONFLICT)
- **검증** (rocket 13, 15 loot): mineral 7 / item 3 / xp 3 / gp 1 / cosmetic 1 — 다양하게 섞임 ✅

### 🟢 사용자 요청: "로켓드롭 이미지 어울리는 거로 만들어"
- **신규**: `assets/textures/rocket_drop.svg` 인라인 SVG 로 새 로켓 디자인 (화염 트레일 + 윈도우 + 핀 + 엔진 벨)
- 기존 starship.png 대체. PNG 로드 실패 시 자동 fallback (`onerror`).
- 적용 위치: globe overlay 의 incoming 마커 + `.rocket-banner` 의 인라인 아이콘

### 🟡 v3.7 viewer 롤백
- **이전 v3.7 fix 가 너무 공격적**: atk=0 또는 def=0 시 viewer 즉시 닫음 → 사용자 요청 "1:1 이어도 풀 viewer 떠야" 와 충돌.
- **Fix**: viewer 정상적으로 풀 시각화 띄우되, frames<2 (시뮬 이상 의심) 일 때만 경고 토스트 + viewer 유지. 사용자가 ✕ 로 닫게.

### 🟢 사용자 신고 1: "영토 있는데 OPS 발사대 슬롯 0"
- v3.7 의 모바일 OPS 탭 launch-form 살린 fix 로 자동 해결 (사용자 "어 슬롯 이제 나왔다" 확인).

---

## 2026-04-26 — Mobile OPS Pane + Hijack 자동승리 Viewer Fix (v3.7)

### 🔴 사용자 신고 1: 모바일에서 OPS 탭 진입 후 내용 빈 화면
- **원인**: 1024 미디어쿼리 룰 `.ops-launch-form, .ops-quick:not(...) { display:none !important }` 가 BASE 모달 내부 OPS 탭 발사 폼 (`.ops-launch-form`) 까지 숨김. OPS 탭 본문이 launch-form 이라 모바일에서 빈 페이지로 보임.
- **Fix**: 룰에서 `.ops-launch-form` 제거. `.ops-quick:not(.ops-quick-split)` 만 남김 — 데스크탑 floating launcher 만 숨기고 BASE 모달 내부 발사 폼은 모바일에서도 표시.
- 검증: ops-launch-form display:block h:316px ✅, basePane_ops h:433px ✅

### 🔴 사용자 신고 2: 하이젝 함대전 viewer 빈 화면
- **원인**: 자동승리 케이스 (atk_ships_total=0 또는 def_ships_total=0) 에 시뮬레이션 frame 이 사실상 1개라 캔버스에 그릴 게 없음 → 빈 화면 + "0:00 / 0:00"
- **Fix**: `openBattleViewer` 가 timeline 로드 후 `atkN === 0 || defN === 0` 체크 → viewer 모달 닫고 winner 기준 명확한 토스트 표시 ("⚔ 자동 승리" / "🛡 자동 패배" / "⚡ 자동 종료").
- 검증: battle 10 (atk 1, def 0) 호출 → 793ms 만에 토스트 + viewer 닫힘 ✅

---

## 2026-04-26 — Mobile 침공/탐사 퀵카드 복원 (v3.6)

### 🔴 사용자 신고: "모바일 메인 화면에서 침공/탐사 버튼이 안 보임"
- **원인**: 1024 이하(태블릿) 미디어쿼리의 `.ops-launch-form, .ops-quick { display:none !important }` 룰이 element class `"ops-quick ops-quick-split"` 둘 다 매치 → 모바일 전용 split 카드까지 숨김
- **Fix**: `.ops-quick:not(.ops-quick-split)` 로 좁혀서 옛 desktop-only `.ops-quick` 만 숨기고 모바일 split 카드 살림
- 검증 (preview, 375×812): 우측 가운데 침공/탐사 분할 카드 60×120 정상 표시 ✅

---

## 2026-04-26 — Leaderboard Pixel Count Fix (v3.5)

### 🔴 사용자 신고: "리더보드 픽셀 수가 BASE 패널과 안 맞음"
- 스크린샷 비교: 리더보드 1위 Woo = **9,260 px** vs BASE 패널 "총 픽셀" = **7,173 px**
- **원인**: `/api/leaderboard` 의 `pixel_count` 가 `SUM(claims.width × height)` (이론적 직사각형) 로 계산. claim 안에서 hijack 당하거나 NPC 영역인 픽셀까지 포함해 부풀려짐.
- **Fix**: `pixels` 테이블에서 실제 `owner = wallet` 카운트로 변경. BASE 패널과 동일한 SSOT.
- 검증: Woo = 7,173 px ✅, NPC들도 정확.

---

## 2026-04-26 — Rank Auto-Recalc System (v3.4)

### 🔴 사용자 신고: "레벨업 기준 다 통과한 상태인데 레벨업이 안 됨"
- **진짜 원인**: XP 는 daily/season/worldEvents 에서 += 되지만 `rank_level` 갱신은 admin 수동 `/admin/api/recalc-ranks` 호출 때만. **자동 트리거가 없어서 평생 lv 4에 멈춤**.
- **Fix 1: `services/rank.js` 신규** — `recalcUserRank(wallet)` 헬퍼 (admin 로직 single-user 버전 추출, breakthrough conditions 평가까지)
- **Fix 2: Lazy trigger** — `GET /api/user/:wallet/base` (BASE 패널 진입 hot path) 에서 매번 fire-and-forget recalc → 사용자가 화면 보면 즉시 반영
- **Fix 3: Periodic scheduler** — `server/index.js` 에 5분 (settings 조정 가능) 간격 batch. 최근 24h 내 로그인 유저만 처리해서 full-table scan 회피.
- **Migration 186** (`186_rank_auto_recalc.sql`): settings 4종 (`rank_auto_recalc_enabled`/`interval_seconds`/`lookback_hours`/`batch_size`)

### 🟢 진단 결과 — 사용자 본인 케이스
- 신고 wallet `0x68556e2e...` 상태:
  - XP **110,997** ✅ (level 5 required 1,600)
  - play_days **24일** ✅ (level 5 require 3일)
  - **pixels 0개** ❌ (level 5 breakthrough require ≥ 10개)
- Level 5 (Storm Chaser) breakthrough = `pixels ≥ 10 AND play_days ≥ 3` 미충족 → 정상 동작.
- 자동 recalc 가 동작해도 동일한 결과 — XP 외 추가 조건이 막는 케이스. UI 에서 "다음 레벨 진입 조건" 명시 필요 (다음 작업 후보).

---

## 2026-04-26 — Battle Viewer Guard + Faction Auto-Starter Verify (v3.3)

### 🔴 함대전 데이터 로딩 실패 (사용자 신고 — "전투 데이터 로딩 실패" 토스트)
- **원인 1**: `openBattleViewer(undefined)` 호출 시 `/api/battles/undefined/timeline` 을 1.5s × 10회 폴링 → 모두 실패 → 토스트.
- **원인 2 가능성**: 응답에 `phase1_battle_id` / `battle_id` 누락 시에도 `setTimeout` 으로 호출됨 → 위와 동일.
- **Fix**:
  - `openBattleViewer()` 에 `parseInt(battleId)` 가드 추가. falsy/invalid 면 즉시 명확 토스트 + return.
  - 폴링 실패 시 마지막 에러 메시지를 토스트와 console.error 에 포함 — 진단 가능.
  - 호출처 2곳에 `if (id) setTimeout(...) else console.warn` 가드 추가 (hijack confirmHijack + challengeAi).
- **검증** (preview): `openBattleViewer(undefined)` → 4ms 만에 토스트 + return, 모달 안 열림 ✅. battle 9/10 정상 응답 200 OK ✅.

### 🟢 파벌 선택 시 스타터 함선 자동 지급 (사용자 확인 요청)
- **이미 구현 라이브** ([faction.js:148-198](server/services/faction.js:148))
  - 파벌 선택 시 활성 함선 0척이면 가장 싼 frigate 자동 지급 + 함대 자동 생성 + 기함 지정.
  - 트랜잭션 내, 함선 지급 실패해도 파벌 선택 자체는 성공 (방어적).
- **파벌별 자동 지급될 함선** (`build_gp_cost ASC LIMIT 1`):
  - MCC → 프리즘 (mcc_int, 50 GP)
  - FSP → 스프라이트 (fsp_int, 80 GP)
  - CV  → 슬래셔 (cv_int, 45 GP)

---

## 2026-04-26 — Toast 3-style Restore + Orphan Display Defense + Ship Image Slot + Hijack Defender Info Fix (v3.2)

### 🔴 Hijack 함대 정보 에러 (사용자 신고 — "상대 함대 정보 확인 실패")
- **원인**: `phaseC.js:211` 의 `GET /hijack/:id` 가 `:id` 패턴에 `defender-info` 문자열도 매치 → `parseInt('defender-info')` = NaN → `INVALID_ID 400` 반환. NPC 지갑(예: `0xnpc_elysium_mons`) hijack 모달에서 함대 미리보기 실패.
- **Fix**: phaseC.js 의 `:id` path 를 `:id(\\d+)` 정규식으로 강제 → 숫자만 매치, 다른 문자열은 다음 핸들러(api.js `/hijack/defender-info`)로 fallthrough.
- 검증: `GET /api/hijack/defender-info?wallet=0xnpc_elysium_mons` → 200 `{fleetCount:1, aliveShips:1, willAutoWin:false}` ✅


### 🔴 사용자 신고 fix
- **거버너/사령관 없는데 메인화면에 옛 표시 잔존** (스크린샷 신고)
  - 백엔드: `services/governance.js` `getCommanderInfo`/`getSectorInfo` 응답 정규화 — `commander/governor` 빈 문자열 → `null`, governor/commander 없으면 `announcement` 강제 `''`
  - 클라이언트: `_hideCommanderUI()` 안전망 추가 — `loadCommanderBanner` 응답이 비거나 fetch 실패 시 즉시 banner+박스 hide
  - `_drawSectorOverlay`/sector 카드: `s.announcement` 표시 조건에 `&& s.governor` 추가 (orphan 잔존 방어 2중화)
- **토스트 3종 시스템 복원** (사용자 신고 "옛날 토스트 3종류였던게 좋았는데")
  - `e764e75`(통합) + `f424b6a`(stretch fix) 모두 무효화
  - **showToast** = 화면 중앙 그린 알약 (1줄 함수)
  - **showFactionToast** = 하단 블루 박스 (자체 구현 복원)
  - **showNotification** = 우상단 카드 스택 (변경 없음)
  - `@supports(env(safe-area-inset-top))` 안의 `top:50%; bottom:auto` rule 제거 → 옛 위치 그대로

### 🟢 함선 이미지 슬롯 (사용자 요청 — nano-banana 등으로 교체 가능)
- **`assets/ships/`** 디렉터리 + README (네이밍 규칙 + 파벌 컬러 가이드)
- **`shipVisual()`** 신규 함수: SVG 실루엣 + PNG 오버레이 (PNG 로드 성공 시 덮어씀, 실패 시 `onerror`로 자동 제거 → SVG fallback)
- 조선소 블루프린트 카드 + 건조 confirm 모달 두 곳에 적용. 컨테이너에 `position:relative; overflow:hidden` 추가
- 파일명 우선순위: `{code}.png` > `{faction}_{size}.png`. 22종 함선 코드는 README 참조

### 📝 코드베이스 인식 정정 (CLAUDE.md §8)
- **함선 건조 `recipe_minerals` 무시됨** → ❌ 잘못된 메모. 이미 `services/ship.js:278-321` 에서 차감 중. Migration 163 이 zone-tier 기반 광물(iron_ore/titanium_alloy/exotic_alloy/dark_matter/quantum_core 등)로 22종 모두 시드 완료
- **타이탄/배틀십 Core/Mid 재료** → ❌ 잘못된 메모. 타이탄은 `dark_matter+quantum_core+exotic_alloy` 필수, 배틀십은 `exotic_alloy` 포함. Migration 163 시드됨
- **함선 수리 UI 미완** → ❌ 잘못된 메모. `index.html:40588-40700` `syRepairShip/syChargeShield/syScrapShip` 모두 라이브
- **광물 도감 UI 부재** → ❌ 잘못된 메모. `index.html:41332` Minerals Panel 모달 + `openMineralsPanel()` 진입 버튼 존재
- **Hijack 비-primary 디펜더 픽셀 처리** → ❌ "잔여 P1" 아님. 의도된 디자인. Phase 1/2 패배 시 영토 보존 + PP 90% 환불 정상 동작 (`services/hijack.js:197,379`)

### 📝 Commits (시간순 예정)
```
d0b1adf  docs: v3.1 audit findings + changelog (이전 커밋)
[다음]   feat(v3.2): toast 3-style restore + orphan display defense + ship image slot
```

---

## 2026-04-26 — Audit Punch List + Governance Auto-Expire + UX (v3.1)

### 🔴 Governance 자동 만료 (사용자 신고 — admin 수동 클리어 부담 제거)
- **Migration 185** (`185_governance_auto_expire.sql`): settings + idx_users_last_login_at
- **`server/services/governanceExpire.js`** NEW: governor/commander 자동 자리비움 로직
  - 조건: orphaned wallet | `COALESCE(last_login_at, governor_since)` 14일 이전 | term_expired
  - 1시간 스케줄러 (`server/index.js`)
  - `__invalidateSectorsCache()` 자동 호출
- **`server/routes/auth.js`**: 로그인 + /me 시 `last_login_at = NOW()` 갱신
- **고아 announcement 정리**: governor=NULL & announcement≠NULL sector 자동 cleanup
- **즉시 결과**: 15 sectors + commander + 9 orphan announcements 모두 클리어

### 🟡 Audit P0/P1 punch list (commit `135da81`)
- **P0-1 Shield 일원화**: `services/shield.js isClaimShielded/Tx` 가 `territory_shields` 만 조회 → `pixel_shields`(상점) UNION 추가. 상점 shield 가 hijack 못 막던 버그 fix.
- **P0-2 Cosmetic decrement**: `/api/cosmetic/equip` 가 `user_items.quantity` 차감 안 해 1개로 N장착 가능했음 → equip -1, unequip +1, 교체 시 이전 cosmetic 환수 트랜잭션화.
- **P0-3 Tier 보너스 적용**: `services/tiers.js miningBonusPct` 가 dead code → `/api/harvest` 에 territory_tiers MAX(tier) → cfg.tiers[].miningBonusPct 곱셈 블록 추가.
- **P1-1 Harvest cap 순서**: cap=1.0PP 가 모든 multiplier 후 적용돼 VIP/buff/governor 보너스가 cap 에 흡수됨 → cap 을 base 직후로 이동, multiplier 가 그 위에서 amplify.
- **P1-2 season.trackGPSpend**: 미export 라 6개 라우트 silently skip → `addSeasonScore('gp_spend')` alias + export.
- **P1-3 gpActivity require**: 10개 서비스가 `require('./gpActivity')` (없는 모듈) → `require('../db')` 일괄 fix.

### 🟢 Mining 광물 드롭 (사용자 신고 — "PP 만 표시")
- **Bug 1**: `/api/users/:wallet/base` 응답 territory 에 `tierCounts` 누락 → UI 가 항상 'no land' 표시
- **Bug 2**: `/api/harvest` 가 `bestTier` 한 개만 roll → mid+frontier 보유 시 frontier 광물 누락
- **수정**: tierCounts 응답 추가 + 보유한 모든 tier 별로 독립 roll, 결과 합산
- **UX**: 채굴 버튼 라벨에 `+ 🪨` 추가 (`(0.03~1.50 PP + 🪨)`)

### 🐛 UI/UX 버그
- **거대 토스트 박스** (사용자 신고 "이게 뭐야?"): `.toast` 가 `top:50%` + `bottom:130px` 동시 적용으로 viewport 절반 만큼 세로로 stretch. `bottom:auto` + `transform:translate(-50%,-50%)` 로 fix.
- **알림창 닫기**: ✕ 버튼 + outside-click 닫기 (`closeNotifPanel`, `_notifOutsideClick`)
- **출석체크/데일리미션 빈 화면**: QUESTS 탭 진입 시 `checkDailyLogin/renderInlineCheckin/loadDailyMissions` 자동 호출
- **Hijack 모달 undefined**: `data-i18n="hijack_def_label"` 키 노출 + parseInt 방어, `willAutoWin` auto-detection

### 📝 Commits (시간순)
```
f424b6a  fix(toast): 거대 박스 (top+bottom 충돌) fix
b7aa2bf  fix(governance-expire): NULL last_login_at fallback + orphan announcement cleanup
135da81  fix(audit): P0/P1 punch list — shield, cosmetic, tier, harvest cap, season, gpActivity
13efdc0  fix(mining): tierCounts 응답 + 모든 tier roll
6046673  fix(ux): notif 닫기 + daily refresh + mining 라벨 + governance auto-expire
```

---

## 2026-04-25 — Major Stability & Polish Pass (v3.0)

### 🐛 사용자 신고 버그 수정

- **일일 출석체크 'Daily login failed'** 오류 수정
  - 원인: `getSetting()`이 string 반환하는데 array로 사용 → INSERT NaN
  - 수정: JSON 파싱 + Array.isArray 가드 추가
- **JOBS admin 통계 빈 값** 수정
  - 원인: backend response shape (distribution) vs frontend expects (byJob/noJob/recentChanges)
  - 수정: backend 응답에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges 추가
- **EVENTS admin 탭 빈 화면** 수정
  - 원인: `switchTab()` cats 배열에 `'worldevents'` 누락
  - 수정: cats 배열에 worldevents 추가
- **모바일 사이드바 잡아먹힘** 수정
  - 원인: `.panel-r/.panel-l` 모바일 open 상태 z-index 120 < `.mob-bottom-nav` 200
    → 사이드바 하단이 바텀 네비/FAB에 가려짐
  - 수정: 사이드바 z-index 250 (200 위, 모달 510 아래), `padding-bottom: safe-area + 110px`로 마지막 항목 스크롤 가능,
    `panel-close-fixed` z 260로 닫기 버튼 항상 위

- **하이젝 지불금액 0.00 PP 표시 + NPC 자동승리 +함대 미리보기 부재** 수정 (사용자 신고)
  - 원인: NPC가 점령한 영토는 `pixels.price = 0` (무료 점령) → `existing.price × HIJACK_MULT = 0`
    → "지불금액 0.00 PP" 표시 + 무료 하이잭 가능. 또한 "함대전 준비" 약속했는데 NPC에 함선 없으면 즉시 자동승리.
  - 수정 1: 하이잭 비용 = `max(existing.price, sectorBasePrice) × HIJACK_MULT` (4곳: client + server 3 path)
  - 수정 2: defender fleet lookup에 `HAVING alive_ships > 0` 조건 + 디버그 로그
  - 수정 3: hijack 모달에 상대방 함대 미리보기 (`/api/hijack/defender-info` 신규 endpoint)
    → "Fleet N개 · 살아있는 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 명시
  - 수정 4: admin에 "🔍 NPC 함대 진단" 버튼 (`/admin/api/fleet/npc-status`)
    → 현재 NPC들 중 함대전 가능 vs 자동승리 위험 분류 표시. 하이잭 정상 동작 검증 도구.

- **처음 로딩 시 모든 high-tier 섹터가 entry-blocked로 잘못 표시 + BASE 한번 누르면 정상화** — 사용자 신고
  - 원인: globe sector overlay 렌더링이 `document.getElementById('profileLevel').textContent` 로 user level 을 읽음. 이 DOM 은 BASE 모달 열 때 `loadBaseData()` → `renderBaseUser()` 가 채움. boot 시점엔 default '1' → 모든 entryMinLevel>1 섹터가 잠금 표시.
  - 수정: auto-login(`/api/auth/me` 성공) 시점에 `/api/user/:wallet/base` 미리 fetch → `profileLevel`/`profileLevelBadge` 채움 + 텍스처 재합성. 두 auto-login IIFE 모두 처리.
  - 효과: 페이지 처음 로드 직후 sector overlay가 정확한 잠금 상태로 그려짐. BASE 안 눌러도 정상.

- **거버너/사령관 자동 expire 로직 부재 + 옛 데이터 클리어 도구 부재** — 사용자 신고 ("아직도 수정 안된 듯")
  - 원인 분석: governor/commander 는 siege/admin replace 외엔 자동으로 사라지지 않음. 사용자가 "임기 끝났다"고 생각해도 DB 에 데이터 남아 있어 frontend 가 정확히 표시 중. 즉 캐시/렌더링 버그가 아니라 **expire 메커니즘 자체가 없어 admin 수동 클리어 도구가 필요한 상태**.
  - 추가 (admin endpoint 3개):
    * `POST /admin/api/governance/commander/clear` — commander_wallet/vice_commander_wallet/announcement 모두 NULL
    * `POST /admin/api/governance/sector/:id/clear` — 특정 섹터 governor/vice/announcement 클리어 + governance_positions 삭제
    * `POST /admin/api/governance/clear-all` — 전체 거버넌스 일괄 클리어 (claims/pixels 유지)
    * 모두 `__invalidateSectorsCache()` 호출 → 클라 즉시 반영
  - 추가 (admin UI):
    * GOVERNANCE 탭 헤더에 "🧹 사령관 초기화" + "🗑 전체 거버넌스 초기화" 버튼
    * 확인 dialog 후 실행, 토스트 알림

- **governor 교체 시 옛 sector announcement 잔존** — commander fix 와 동일 패턴, governor 측에도 동일 처리
  - 원인: `services/governance.js` 의 governor 교체 SQL 이 sector `announcement` 컬럼을 클리어 안 함. 새 governor 가 자기 메시지 올리기 전까지 옛 governor 메시지가 sector에 표시.
  - 수정: `UPDATE sectors SET governor_wallet=$1, governor_since=NOW(), announcement=NULL` — governor 교체 시 sector announcement 자동 NULL.
  - 추가: governor/vice_governor/sector announcement post 모든 경로에서 `__invalidateSectorsCache()` 호출 → 클라이언트 다음 polling/visibility 시 즉시 fresh.

- **commander 변경 시 옛 announcement 잔존** — 사용자 신고 ("커맨더 표시는 왜 남김?")
  - 원인: governance 서비스의 commander 교체 SQL이 `commander_wallet` 만 갱신, `announcement` 컬럼은 NULL 로 클리어 안 함. 새 commander 가 자기 메시지 올리기 전까지 옛 commander 메시지가 박스에 남음.
  - 수정: `UPDATE commander SET commander_wallet=$1, commander_since=NOW(), announcement=NULL WHERE id=1` — commander 교체 시 announcement 자동 초기화.
  - 추가: `loadCommanderBanner()` 에 visibilitychange + focus 리스너 추가 — 탭 복귀 시 즉시 fresh.

- **거버너/사령관 메시지가 변경 후 안 사라짐 + 페이지 두 번 로딩** — 사용자 신고
  - 원인 1 (텍스처 캐시): globe 의 governor 이름·자물쇠·tier 라벨은 `marsCanvasTexture` 에 그려져 GPU 캐시. `_sectorsData` 만 갱신해도 텍스처 재합성이 안 일어나 옛 governor 이름 그대로 남음.
  - 원인 2 (commander 박스): commander 가 임기 종료되거나 announcement 가 비어도 BASE > TERRITORY 의 announcement 박스가 숨겨지지 않아 옛 메시지 표시.
  - 원인 3 (이중 로딩): SW auto-reload 가 SW 업데이트 시마다 `location.reload()` 호출 → 사용자가 페이지를 두 번 로드.
  - 수정:
    * `refreshSectors()` 에 sector data diff 검사 + 변경 감지 시 `marsCanvasTexture/claimsSnapshot` 무효화 + `compositeClaimsOnTexture()` 재호출 → 텍스처 재합성으로 옛 라벨 사라짐
    * `toggleSectorOverlay()` 토글 ON/OFF 어느 쪽이든 무조건 refresh 후 텍스처 재합성
    * `loadCommanderBanner()`: commander 가 null 이거나 announcement 가 비면 박스 명시적으로 숨김 + textContent 비움
    * SW 등록 — auto-reload 제거. HTML network-first 로 다음 자연 nav 시 새 콘텐츠 자동 적용. 1시간마다 background `reg.update()` 만 수행 → 사용자에게 보이지 않음.

- **구매가능 섹터가 admin 변경 후 즉시 반영 안 됨** ("다른 창 열었다 닫아야 반영") — 사용자 신고
  - 원인 (서버): `routes/api.js`의 `_sectorsCache` 60초 TTL. admin 이 sector tier/price/entry-level 을 변경해도 60초 동안 옛 값 반환.
  - 원인 (클라이언트): `_sectorsData` boot 시 1회만 로드. BASE 모달 열 때(`loadBaseData`)에만 refresh → 사용자 입장에서 "다른 창 열었다 닫아야 반영"으로 보임.
  - 수정 (서버):
    * `invalidateSectorsCache()` 함수 + `global.__invalidateSectorsCache` 노출
    * `PUT /admin/api/sectors/:id` 변경 후 즉시 캐시 무효화
    * `POST /admin/api/setting/:key` 가 `price_pixel_*` 또는 `sector_*_min_level` 변경 시 무효화
    * `POST /api/governance/sector/:id/tax` 변경 후 무효화
  - 수정 (클라이언트):
    * `window.refreshSectors()` 함수 신규 (boot/주기/이벤트 모두에서 재사용)
    * 60초 polling refresh (서버 TTL 과 동일)
    * `visibilitychange`/`focus` 이벤트 시 즉시 refresh (탭/창 복귀 시)
    * `toggleSectorOverlay()` 활성화 시 즉시 refresh
    * `openClaimModal()` 호출 시 즉시 refresh — admin 가격 변경이 다음 클레임에 즉시 반영
  - 효과: admin 변경 → 최대 60초 (활동 사용자) / 즉시 (탭 복귀/모달 열기 시) 반영

- **iPhone 사이드바 stale 상태 (close 버튼 안 보임 + 사이드바 강제 열림)** — Service Worker 캐시 이슈 수정
  - 원인: `sw.js`의 `CACHE_NAME = 'mars-v3'` 가 옛 `index.html` 을 보존. iOS Safari 가 SW 캐시를 적극 활용해서 사용자 단말에 사이드바 옛 코드가 그대로 남음.
  - 수정:
    * `CACHE_NAME` `mars-v3` → `mars-v4` (activate 이벤트로 옛 캐시 자동 제거)
    * `STATIC_ASSETS` 에서 `/index.html` 제거 (pre-cache 안 함)
    * **HTML 문서는 NETWORK-FIRST 로 변경** (이전: cache-first 가능 분기) — 매번 fresh 받기
    * `index.html` 에 SW updatefound + controllerchange 핸들러 추가 — 새 SW 활성화되면 자동 1회 reload (`sessionStorage` guard)
    * `SKIP_WAITING` 메시지로 waiting SW 강제 활성화
  - 효과: iOS 사용자도 다음 방문 시 fix 자동 적용, 강력 새로고침 불필요.

- **태블릿 (iPad portrait 820px) 바텀 네비 두 줄 중복 렌더링** — 실제 페이지 렌더링 감사 중 발견
  - 원인: `.col-fab-wrap.show` 셀렉터가 `display:block` 강제 → 새로 만든 `@media(max-width:1024px) .col-fab-wrap{display:none}` (specificity 동일) 무시됨. 데스크탑 col-fab + 모바일 mob-bottom-nav 가 동시 표시되어 바텀이 두 줄로 보임.
  - 수정: `.col-fab-wrap, .col-fab-wrap.show { display:none !important }` + `#myLandBtn`, `.ops-launch-form`, `.ops-quick` 도 1024 이하에서 숨김
  - 검증: 820x1180 viewport 에서 mob-bottom-nav 단일 표시 확인.

- **iPhone/iPad 사이드바 자동 열림 + 글로브 안 보임** 수정 (iPhone 사용자 신고)
  - 원인: 기존 `@media(max-width:768px)` 만 적용 → iPad portrait(820px), iPhone Pro Max landscape(932px),
    Safari split-screen 등 769~1024px 구간에서는 데스크탑 레이아웃이 적용되어 panel-l(250px) + panel-r(250px) = 500px가
    좁은 화면을 채워 글로브가 안 보이고 양쪽 사이드바가 열린 것처럼 보임.
  - 수정:
    * 새 `@media(max-width:1024px)` 블록 추가 — 태블릿/내로우 데스크톱에서도 패널이 슬라이드 인/아웃 작동
    * `mob-toggle`, `mob-bottom-nav` 1024 이하에서도 표시 (사용자가 패널을 열 수 있도록)
    * 패널 폭: 768~1024 구간은 `min(360px, 70vw)`, 768 이하는 기존 `85% / max 320px`
    * DOMContentLoaded 시 `window.innerWidth ≤ 1024`면 panels의 .open 클래스를 강제 제거
      (브라우저 캐시/이전 세션 잔재 방어)
    * `.panel-tab` 1024 이하 숨김 (mob-toggle만 사용)
- **토스트 일관성 부족** 수정
  - 원인: `showToast` (중앙 그린 알약), `showFactionToast` (하단 블루 알약), `showNotification` (우측상단 카드) — 시각/위치/스타일 모두 제각각
  - 수정: 통합 `.toast` CSS (글래스 효과 + accent border, 색상만 type별 변경: success/error/warn/info),
    바닥은 `safe-area-inset-bottom + 110px`로 mob-bottom-nav 위 자동 배치,
    `showFactionToast` → `showToast` 위임, legacy type ('red'/'h'/'green' 등) 자동 정규화 호환

### 🐛 자가 진단 버그 수정 (테스트 중 발견)

- `/api/achievements`: `column "sort_order" does not exist` → `condition_value, key`로 ORDER BY 정정
- `/api/profile`: `column "avatar_color" does not exist` → migration 184로 컬럼 추가 (avatar_color, motto)
- `/api/branding/my, /api/spells admin`: `c.x1, c.y1, c.x2, c.y2` (없는 컬럼) → `center_lat, center_lng, width, height`
- `/api/resources/my`: `i.resource_code` (없음) → `JOIN resources r ON r.id = i.resource_id`로 정정
- `/api/raffles/active`: `:id` 라우트가 'active' 매칭 → `:id(\d+)`로 숫자만 허용
- **u.wallet JOIN 다수 (15개 서비스)**: `u.wallet → u.wallet_address`로 일괄 정정
  (prestige, tprestige, tombstone, graffiti, capsule, beacon, sponsor, highlight, journal, milestone, tdesc, polls, status, banner, vtag, tribute, donation 등)
- `/api/claims/my`: 누락 endpoint 추가 (expedition 영토 셀렉터용)
- `/api/burn/*`: 죽은 시스템 (gpBurn 삭제됨) → frontend UI 숨김 + loadBurnPanel no-op

### 🚀 기능 활성화 / 콘텐츠 확장

- **Fleet Combat 시스템 정합성** — `loadFleetPanel()`이 `/api/fleets`로 재배선됨
- **govBuildShip / govRepairShip / govUpgradeShip** UI는 `openShipyard()` / `openFleetCmd()` 모달로 redirect
- **업적 자동 트리거 와이어링** — claim/battle/marketplace/ship/guild/signup 6개 게임 이벤트
- **29개 업적 시드** — territory(5), combat(11), economy(7), social(6), 4개 언어 (ko/en/ja/zh)
- **Phantom 테이블 39개 일괄 생성** (migration 176~184)
- **907개 settings 키 시드** — admin이 모든 라이브 기능 조정 가능 (No Hardcoding 100%)

### 🧹 코드 정리 / 통합

- **dead 서비스 4개 삭제**: weeklyChallenges, gpBurn, bounty, luckyBox
- **dead 라우트 5개 삭제**: factionRoutes (v2), onboarding (v1), territoryRoutes, public, publicRoutes
- **legacy battle.js 일괄 제거** — schema mismatch + UI 제거 → Fleet + Hijack로 통합
- **betting v1 → warBetting v2 통합** — 단일 시스템, 5min/60s 중복 스케줄러 제거

### 🗄 DB 마이그레이션

| ID | 내용 |
|---|---|
| 176 | game_settings 호환 VIEW (legacy 코드 호환) |
| 177 | gp_activity_log + gp_transactions + colony_prestige + prestige_log |
| 178 | phantom 테이블 30개 일괄 생성 (territory_*, gp_*, raffles, contests 등) |
| 179 | lottery_rounds + lottery_tickets + gp_dividend_pool + planet_news |
| 180 | achievements + user_achievements + territory_rentals + rental_log + territory_upgrades + profile_change_log + tournament_entries (+ 14 업적 시드) |
| 181 | 88개 settings 시드 (prestige/news/branding/tdesc/tiers/donation/capsule/sponsor/beacon/status/tevt/polls/wager) |
| 182 | 78개 settings 시드 (monuments/spells/shield/staking/expedition/raffle/broadcasts/contest/crafting/achievements) |
| 183 | 29개 업적 (확장 15개) + 4개 언어 + cosmetic/enhancement 종류 |
| 184 | users.avatar_color + users.motto 컬럼 추가 |

### 📚 문서

- **AUDIT_FINDINGS.md** — 기능별 동작 매트릭스 신규 작성 (🟢/🟡/🔴 + 우선순위)
- **CLAUDE.md §13~16** — 신규 세션 핸드오프 정보 대폭 보강
- **핵심 서비스 헤더 주석** — hijack, rocket, prestige, tprestige (STATUS / Flow / DB / Settings)

### 📊 시스템 상태 (현재)

| 항목 | 값 |
|---|---|
| DB 테이블 | 219개 |
| Settings 키 | 907개 |
| 업적 | 29개 (4 카테고리, 4 언어) |
| 마이그레이션 | 156+ (~184) |
| Phantom 테이블 | 0개 |
| 누적 커밋 (이번 작업) | 22개 |

---

## 2026-05-08 v5.97 — Daily OPS 내 아이템 이동 + 전술랩 로컬라이징

- 오늘의 작전 보드 주간 보상 버튼이 실제 `BASE > SHOP > MY ITEMS`로 이동하도록 베이스 모달/상점 탭 초기화 순서를 보정했다.
- 완료된 Daily OPS 항목은 초록 상태등으로 표시되도록 로컬 상태 렌더링을 연결했다.
- 영토 외부 링크 입력은 도메인만 넣어도 `https://`로 정규화되게 수정하고, 데스크탑/모바일 표시 로직을 통합했다.
- 전술랩 iframe에 현재 언어를 전달하고, 전술랩 정적 UI/명령 버튼/함선 도감/광물/함대 상태 패널 로컬라이징을 적용했다.
- 검증: `git diff --check` 통과.

---

## 2026-05-05 v5.96 — 전투 피드백/리텐션/PvP 실행 지시서

- `docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가했다.
- 클로드 약점 개선 기획을 실제 개발 지시서가 아니라 구현 계약서 수준으로 재정리했다.
- Source of Truth, Meaning of Done, Delivery Gates, Commit Packet Rules, Recon Gate, Acceptance Gate, QA Matrix, API/DB 계약, final report format을 추가했다.
- 구현 순서를 전투 결과 리포트 → Daily OPS Board → 영토 닉네임/Field Rating → Battle Hub 추천 상대 → 현상금 보드 → 섹터 분쟁/주간 캘린더로 고정했다.
- 첫 착수 범위를 P1 전투 결과 리포트로 제한하고, 기존 전투 결과 모달/패널에 붙이도록 명시했다.
- `CLAUDE.md`의 새 세션 읽기 순서에 경쟁 루프 구현 지시서를 추가했다.

---

## 2026-05-05 v5.91 — P5 영토 유틸리티 풀기획

- `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`를 추가했다.
- `docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가했다.
- 영토를 개인 캔버스, 생산 노드, 전쟁/경제 앵커로 정의했다.
- P5 풀기획을 생산 가시성, 재료 harvest, 조선소 연결, 영토 업그레이드/역할, 섹터 컨트롤, 어드민 경제 튜닝까지 확장했다.
- 클로드가 풀 시스템을 개발하되 P5-1 생산 가시성부터 순차 착수하도록 구현 지시서를 분리했다.
- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`의 P5 항목을 MVP 기준이 아니라 최종 풀 시스템 기준으로 갱신했다.

## 2026-05-05 v5.87 — Claude 남은 작업 실행 지시서

- `docs/CLAUDE_WORK_ORDER_2026-05-05.md`를 추가했다.
- 남은 작업을 캠페인 진행 정리, 함대전 세로 탑뷰 안정화, Fleet Command UX, 함선 경제 UX, 영토 유틸리티 순서로 정리했다.
- `CLAUDE.md`의 새 세션 읽기 순서에 기준 기획서와 작업지시서를 추가했다.
- 스타폭스/함대전 리서치 문서는 장기 참고용이며 현재 구현 기준이 아님을 명시했다.

## 2026-05-04 v5.86 — 캠페인 에디터 좌표 최신성 정합

- 캠페인 에디터 layout payload에 `updatedAt`을 추가했다.
- 캐릭터/오버레이/대사박스/폰트 위치를 바꾸면 `editorLayoutUpdatedAt` localStorage가 함께 갱신된다.
- 인게임 스토리 렌더러는 timestamp가 있는 최신 로컬 편집만 서버 layout보다 우선하도록 바꿨다.
- 게임 화면에 남은 오래된 localStorage 좌표가 서버 저장 좌표를 덮어쓰는 문제를 막았다.
- 에디터의 reset layout이 서버에 동기화되지 않던 경로도 보강했다.

## 2026-05-04 v5.85 — Fleet Command 모달 유지/선택 UX

- Fleet Command에서 진형/기동 변경 후 전체 목록 재조회 대신 현재 선택 함대 상태를 즉시 갱신하도록 변경했다.
- 기함 지정 성공 후에도 모달과 스크롤 위치를 유지하고, 선택 함대 상세만 다시 읽어오게 했다.
- Fleet Command 서버 오류를 한국어 원인 메시지로 통일했다.
- 함선 카드에 focused 상태를 추가해 마지막으로 누른 함선이 무엇인지 더 명확히 보이게 했다.
- 선택 요약 패널에 기함 가능 여부를 표시해 기함 지정 불가 이유를 추측하지 않아도 되게 했다.

## 2026-05-04 v5.70 — 캠페인 메인퀘스트 스캐폴드

- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`를 추가해 게임 방향성 문서를 실제 개발 스프린트로 쪼갰다.
- 캠페인 서버 응답에 `objectives`와 `nextObjective`를 추가했다.
- 캠페인 리스트 카드에 챕터별 현재 목표를 표시해 유저가 다음 할 일을 바로 볼 수 있게 했다.
- 캠페인 브리핑 모달에도 작전 목표를 표시한다.
- 이번 단계는 목표 표시/동선 스캐폴드이며, 다음 단계에서 영토 확보, 함선 보유, 함대전 완료, 마켓 등록 같은 실제 DB 기반 objective 판정을 연결한다.

## 2026-05-04 v5.69 — 게임 방향성 기준 문서

- `docs/GAME_DIRECTION_2026-05-04.md`를 추가해 OCCUPY MARS의 핵심 방향성을 문서화했다.
- 게임을 "캠페인으로 몰입시키고, 영토로 소유하게 하고, 함선으로 욕심나게 하고, 전쟁과 시장으로 부딪히게 하는 화성 개척 경제 전략 게임"으로 정의했다.
- 캠페인/영토/함대/전쟁·경제 네 기둥을 앞으로의 기능 판단 기준으로 정리했다.
- 캠페인은 전면 신규 제작이 아니라 기존 챕터와 에셋을 유지하면서 목표, 보상, 잠금 해제, 실제 게임 행동 연결을 붙이는 리마스터 방식으로 범위를 제한했다.
- P0 방향 고정 → P1 캠페인 메인퀘스트화 → P2 함대전 감각 완성 → P3 함선 경제 → P4 영토 유틸리티 순서의 우선순위 로드맵을 정리했다.

## 2026-05-03 v5.68 — 조선소 제작/강화 재료 보유량 UX

- 조선소 청사진 카드의 GP/광물 요구량을 `보유 / 필요` 형식으로 변경했다.
- 충분한 재료는 활성 녹색 톤, 부족한 재료는 비활성 붉은 톤으로 표시해 어떤 재료가 막고 있는지 바로 보이게 했다.
- 함선 제작 확인 모달에 GP와 광물 보유량을 모두 표시하고, 부족 시 확인 버튼을 비활성화했다.
- 함선 강화 버튼과 강화 확인 모달에 GP 보유량, 성공 확률, 강화 재료 보유량/필요량을 함께 표시했다.
- 강화 재료뿐 아니라 GP가 부족한 경우도 강화 모달에서 명확히 막히도록 정리했다.

## 게임 시스템 요약

### 🟢 라이브 핵심
- 클레임/픽셀, GP/PP 경제, 하이잭, Fleet Combat, 공성전, 거버넌스, 마켓플레이스, 강화, 옥션, 로켓 드롭, POI, VIP, 일일 미션, 업적, PVP 베팅, 시즌 점수, 길드/수송, 날씨, Colony/Territory Prestige

### 🟢 보조 기능 (모두 admin 조정 가능)
- 영토 시스템: branding, descriptions, monuments, tiers, spells, events, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, tombstones, vtag, journals, ratings, milestones, highlights
- 경제/소셜: stakes, polls, wagers, art contests, donations, broadcasts, expeditions, raffles, lottery, dividends, news, crafting
- 메타: 토너먼트, 프로필 변경 로그

### 🟡 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced
- title + titleExtended
- enhancement + enhancementAdvanced
- job + jobs (catalog + admin)
- resource + resources (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments (fleet + simple)
- fix: 하이젝 에러맵 + 병합 버튼 JA/ZH 로컬라이징

## 2026-05-07 v7.49 — 프론트엔드 나머지 API 인증 헤더 완전 적용

**수정 (HIGH — index.html ~100개 추가 fetch 호출):**

v7.48에서 누락된 나머지 write endpoint fetch 호출에 `getAuthHeaders()` 완전 적용.

- governance sector tax-rate/buff/announcement, siege/declare, governor/declaration
- rockets/trigger, duels (challenge/cancel/accept), shield/activate
- contests (submit/vote), rental (list/rent/cancel)
- expeditions (launch/cancel), capsule/bury, broadcasts/create
- alliances (join/create/deposit/withdraw), territory/merge, territory/identity PATCH
- user/job, user/titles/equip, vip/purchase, lottery/buy
- daily-ops (progress/claim), campaign/reward/claim, gp/transfer
- exploration/discover, rockets/claim-loot, claims/rename 등

전체 index.html API write 호출 커버리지 완성. `/api/auth/*` + `emailAuth` 패턴 사용 호출은 의도적으로 미수정.
