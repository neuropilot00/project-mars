# OCCUPY MARS — Changelog

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
