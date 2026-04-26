# OCCUPY MARS — Codebase Audit (v5.5 / 2026-04-26)

## 🔴 v5.5 변경 요약 (2026-04-26)

### 내 영토 글로브 골드 하이라이트

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 내 영토가 다른 영토와 구분 안 됨 | `isMine` 영토에 동일한 지갑 해시 색상 사용 | `isMine=true`면 골드 `{r:255,g:209,b:102}` fill/border/shadow 적용 |
| 2 | 대소문자 다른 지갑 주소에서 `isMine` 미감지 | `c.owner===myAddr` 엄격 비교 | 양쪽 모두 `.toLowerCase()` — myAddr, sort, isMine 체크, showTerritoryInfo |

### 수정 파일
- `index.html`: `compositeClaimsOnTexture` 골드 색상 + `.toLowerCase()` 비교 (4곳), `showTerritoryInfo` 지갑 비교 fix

### 검증
- 캔버스 픽셀 샘플: `[252,205,101,255]` ≈ gold `(255,209,102)` 확인
- _ownerStrips에 내 지갑 존재, _ownerGroups에 Valles Marineris 그룹 존재 확인
- 브라우저 글로브 near-zoom 스크린샷: 내 영토 금색으로 명확히 표시

## 🔴 v5.3 변경 요약 (2026-04-26)

### Tactical-lab 전투 뷰어 4종 버그 수정

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 기동 버튼 누르면 크래시 | battleEngine.js wedgeSides 처리에서 `f.movement='wedge'` (잘못된 필드) → ws frame 수신 후 MANEUVERS['wedge'] undefined → drawFleets crash | `f.formation='wedge'` 로 수정. 클라 전체 MANEUVERS/FORMATIONS null-safe fallback 적용 |
| 2 | 공격 모션 없음 | ws 활성 시 `fire()` 완전 비활성화 → bullet/laser 한 개도 안 생김 | ws mode에서도 `fire(sh, wsMode=true)` 호출. `visual:true` 플래그 bullet/laser는 `applyDmg` 스킵 (HP는 ws frame으로만 동기화) |
| 3 | 1 vs 1 전투가 캔버스 상단에서 시작 | atkPos 하드코딩 `cy:H*0.15` → 함대 1개면 무조건 상단 | `centeredPos(n, side)` 함수: 1함대면 `H*0.5`, n함대면 H*0.15~H*0.85 균등 분배 |
| 4 | 화면 너무 작음 / 거리 기반 줌 없음 | 카메라 시스템 부재 | 매 프레임 생존 함대 bounding box 계산 → `_camTargetScale` 산출 → lerp 0.025로 부드럽게 줌/팬. `CX.save/translate/scale/translate/restore` 로 월드 좌표 변환 |

### 수정 파일
- `server/services/battleEngine.js`: wedgeSides → `f.formation` (1줄)
- `assets/tactical-lab-v11.html`: 4종 fix (61줄 추가)

## 🔴 v5.2 변경 요약 (2026-04-26)

### 함선 단위 정밀 폭발 이펙트 (Phase 2-E)
- battleEngine.js: ws frame ships 배열에 `code` (ship_type_code) 필드 추가
- tactical-lab-v11.html:
  - `_wsPrevShips` Map — 이전 프레임 생존 함선 id → {x, y, code} 추적
  - 매 frame 수신 시 이전 맵과 diff → 사라진 함선마다 `mkExp()` 호출 (size_class 기반 반경)
  - battleship/titan 격침 시 `mkShockwave()` + 격침 로그 추가
  - fleet dead 전환 시 shockwave 즉시 트리거 (이전에는 shockwave 없이 일괄 dead 처리)
  - `initBattle()`에서 `_wsPrevShips` 리셋

## 🔴 v4.8~v5.1 변경 요약 (2026-04-26)

### Phase 2 — WebSocket 실시간 함대전 4단계 완료
- v4.8 (Phase 2-A): wsServer.js 신규 — battle 채널 + frame/end broadcast + JWT 인증 cmd
- v4.9 (Phase 2-B): tactical-lab v11 안에서 ws 연결 + ws_end 부모에 postMessage → 결과 카드 즉시
- v5.0 (Phase 2-C): fleet-presets ?bid 응답에 dbFleetId/ownerWallet 추가 → ws frame fleet 매칭 (위치/HP/진형/기동)
- v5.1 (Phase 2-D): ws 활성 시 자체 시뮬 fire/damage skip + 자동 재시작 skip

### 사용자 요구 4가지 모두 완료
1. ✅ tactical-lab v11 그대로 이식 (iframe)
2. ✅ 실제 게임 데이터 연결 (catalog + fleet-presets ?bid + ws frame)
3. ✅ 유저 컨트롤 (postMessage + ws cmd → commander_actions → battleEngine)
4. ✅ 실시간 함대전 (hijack manual + AI 자동 + ws frame stream)

### 잔여 (선택, 비필수)
- ~~ship 단위 dbShipId 매핑~~ → ✅ v5.2에서 완료

---

## 🔴 v4.0~v4.7 변경 요약 (2026-04-26)

### Phase 4 (v4.7) — AI 전략 자동 적용
- `services/aiStrategy.js` 신규 — 파벌별 doctrine 가중치 random
- battleScheduler 가 hijack 외 battle 의 양쪽에 commander_actions formation/maneuver INSERT
- Migration 190: `ai_strategy_enabled` settings 토글
- 검증: PvP battle 양쪽 정확히 doctrine 따라 INSERT

### Phase 5 — 사실상 이미 동작 중
- tactical-lab v11 의 SHIPS/MINERALS/FACTIONS 글로벌은 `loadCatalog()` 가 이미 우리 DB catalog API 에서 자동 채움
- FLEET STATUS / SHIP REGISTRY / MINERALS 패널 모두 우리 데이터로 표시
- 추가 작업 불필요

### Battle Viewer 전면 리팩터 — Tactical Lab 통합
- v4.0: 데스크탑 1500×820 오버레이, 모바일 풀스크린 유지
- v4.1: 살아남은 함선 부분 HP 손실 DB 반영 (battleEngine `applyBattleResults`)
- v4.2: 결과 카드 디자인 + 조선소 SVG drawShip + HP 바
- v4.3: tactical-lab v11 iframe 통째 통합 (자체 canvas/HUD/컨트롤 폐기)
- v4.4: `?bid={battleId}` 로 실제 fleet 구성 주입 (`fleet_battle_participants` JOIN)
- v4.5: 사이드 패널 (좌 MY FLEET/RESOURCES, 우 ENEMY FLEET/BATTLE STATS) + postMessage 컨트롤 bridge
- v4.6: Phase 3-B — commanderActions `formation_change` + `maneuver_change` (Migration 189), mutable update, 시뮬 반영

### Migration 189
- `commander_actions.action_type` CHECK 갱신 — formation_change, maneuver_change 추가
- settings: `commander_action_formation_gp_cost`, `commander_action_maneuver_gp_cost` (기본 0)

### 잔여 P1 (다음 사이클)
- **Phase 2**: WebSocket 실시간 frame broadcast (현재는 timeline replay 만)
- **Phase 4**: AI 전략 (PvP/Siege battle 에 자동 진형/기동 명령)
- **Phase 5**: tactical-lab 패널 (FLEET STATUS / SHIP REGISTRY / MINERALS / DOCTRINES) 실데이터 연결

---

## 🔴 v3.9 변경 요약 (2026-04-26)
- **POI 보상에 mineral 추가** (사용자 요청): Migration 188 + reward_type CHECK 갱신 + exploration.js spawn/claim 양쪽 mineral 분기. GP 50 / Item 20 / Mineral 25 / PP 10.
- **NPC 함선 일괄 부여** (사용자 요청 — hijack 함대전 테스트 차단됨): grant-starter-all-npcs 호출. 21 NPC 모두 함대 보유.

---

## 🔴 v3.8 변경 요약 (2026-04-26)
- **로켓드롭 보상 다양화** (사용자 신고 "GP만 존나 나옴"): mineral 카테고리 신규 추가. Migration 187, weight 30/25/25/12/6/2 (gp/item/mineral/xp/pp/cosmetic). 검증: 15개 슬롯에 mineral 7 / item 3 / xp 3 / gp 1 / cosmetic 1.
- **새 로켓 SVG** (`assets/textures/rocket_drop.svg`): 화염 트레일 + 윈도우 + 핀 + 엔진 벨. PNG fallback 유지.
- **viewer 롤백**: v3.7 의 자동승리 viewer 즉시 닫기 → frames<2 시에만 경고 토스트 (viewer 풀 표시 유지).
- **잔여**: POI 보상도 동일 패턴으로 mineral 추가 필요 (다음 사이클).

---

## 🔴 v3.7 변경 요약 (2026-04-26)
- **모바일 OPS 탭 빈 화면** (사용자 신고): 1024 미디어쿼리 `.ops-launch-form ... display:none !important` 가 BASE 모달 내부 발사 폼까지 숨김. 룰에서 `.ops-launch-form` 제거.
- **하이젝 함대전 viewer 빈 화면** (사용자 신고): 자동승리(atk=0 또는 def=0) 케이스에 시뮬레이션 frame 거의 없음 → 빈 캔버스 + "0:00/0:00". `openBattleViewer` 가 atkN/defN 체크 후 viewer 닫고 winner 기준 토스트 표시.

---

## 🔴 v3.6 변경 요약 (2026-04-26)
- **모바일 침공/탐사 버튼 사라짐** (사용자 신고): 태블릿/모바일 미디어쿼리의 `.ops-quick { display:none !important }` 룰이 element class `"ops-quick ops-quick-split"` 둘 다 매치. `.ops-quick:not(.ops-quick-split)` 로 좁혀서 fix. 모바일 전용 split 카드 정상 복원.

---

## 🔴 v3.5 변경 요약 (2026-04-26)
- **리더보드 픽셀 수 부풀림** (사용자 신고): `/api/leaderboard` 가 `claims.width × height` (이론적 직사각형) 로 계산해 BASE 패널의 진짜 카운트(`pixels` 테이블)와 어긋남. 실제 owner 카운트로 변경.

---

## 🔴 v3.4 변경 요약 (2026-04-26)

### 🚨 시스템 결함 fix
- **레벨업 자동 갱신 부재** (사용자 신고): XP 는 누적되는데 `rank_level` 갱신은 admin 수동 호출만 동작. 평생 멈춤.
  - **`services/rank.js` 신규** — single-user `recalcUserRank` (admin 로직 추출, breakthrough conditions 평가)
  - **Lazy trigger** — `GET /user/:wallet/base` 진입 시 fire-and-forget
  - **Periodic scheduler** (`server/index.js`) — 5분 간격, 최근 24h 활성 유저 batch
  - **Migration 186**: settings 4종 (auto_recalc_enabled / interval_seconds / lookback_hours / batch_size). 모두 admin 조정 가능.
  - 검증: lain test → 정상 호출. stuck user (xp 110k, lv 4) → pixels=0 으로 breakthrough 막힘 (정상).

### 잔여 P1 (다음 작업 후보)
- **Level 5+ breakthrough UI** — 현재 사용자가 "왜 안 올라가는지" 모름. 다음 레벨의 조건과 본인 진행도를 명시하는 UI 필요.

---

## 🔴 v3.3 변경 요약 (2026-04-26)

### 사용자 신고 fix
- **함대전 "전투 데이터 로딩 실패"** — `openBattleViewer(undefined)` 호출 시 invalid id 로 15초 폴링 후 토스트
  - Fix: `openBattleViewer` 진입에 `parseInt(battleId)` 가드 + 폴링 실패 시 lastErr 메시지 포함
  - 호출처 2곳 (`confirmHijack`, `challengeAi`) 에 `if (id) setTimeout` 가드 추가

### 검증 완료
- 파벌 선택 시 가장 싼 frigate 자동 지급 — `services/faction.js:148-198` 라이브 동작 확인. 트랜잭션 내 처리, 함대 없으면 자동 생성.

---

## 🔴 v3.2 변경 요약 (2026-04-26)

### 사용자 신고 fix (즉시 대응)
- **Hijack 함대 정보 에러** ("상대 함대 정보 확인 실패")
  - 원인: `phaseC.js` 의 `GET /hijack/:id` 가 `defender-info` 문자열까지 매치 → `parseInt('defender-info')`=NaN → INVALID_ID 400
  - Fix: `:id(\\d+)` regex로 숫자만 매치, 문자열은 다음 라우터(api.js `/hijack/defender-info`)로 fallthrough
  - 검증: NPC 지갑 `0xnpc_elysium_mons` 응답 정상 (`fleetCount:1, aliveShips:1`)

- **거버너/사령관 잔존 표시**: commander 없어졌는데 메인 배너 + 베이스 공지 박스가 잔존
  - 백엔드 `services/governance.js`: `getCommanderInfo`/`getSectorInfo` 응답에서 `commander/governor` 빈 문자열 → `null`, governor/commander 없으면 `announcement` 강제 `''`
  - 클라이언트 `index.html`: `_hideCommanderUI()` 안전망 추가, fetch 실패 또는 commander 비면 즉시 모든 UI hide
  - sector overlay 두 곳에 `&& s.governor` 가드 추가 (orphan 방어 2중화)
- **토스트 위치 거슬림**: 통합 시스템(e764e75)이 정중앙 배치 → 사용자가 옛 3종 분리 시스템 선호
  - **showToast** = 화면 중앙 그린 알약 (옛 위치 그대로)
  - **showFactionToast** = 하단 블루 박스 (옛 자체 구현)
  - **showNotification** = 우상단 카드 (변경 없음)
  - `@supports(env(safe-area-inset-top))` 안의 `top:50%; bottom:auto` 룰 제거

### 신규 슬롯
- **함선 PNG 이미지 슬롯**: `assets/ships/` 디렉터리 + `shipVisual()` wrapping. PNG 없으면 SVG 실루엣 fallback (`<img onerror="this.remove()">`).
  - 적용 위치: 조선소 블루프린트 카드, 건조 confirm 모달
  - 파일명 우선순위: `{code}.png` > `{faction}_{size}.png`

### 인식 정정 (CLAUDE.md §8 잘못된 메모)
| 항목 | CLAUDE.md 메모 | 실제 |
|---|---|---|
| Hijack 실패 시 영토 처리 | "비-primary 디펜더 잔여 P1" | ✅ 정상 동작 — 영토 보존 + PP 90% 환불 (`hijack.js:197,379`) |
| `recipe_minerals` 차감 | "현재 무시됨" | ✅ `ship.js:278` 에서 `resources` JOIN 후 `user_resource_inventory` UPDATE |
| Titan/Battleship Core/Mid 재료 | "추가 필요" | ✅ Migration 163 시드됨 (titan = dark_matter+quantum_core+exotic_alloy) |
| 함선 수리 UI | "라우트+UI 모두 필요" | ✅ `syRepairShip/syChargeShield/syScrapShip` 모두 라이브 (`index.html:40588~`) |
| 광물 도감 UI | (언급 없음) | ✅ Minerals Panel 모달 + `openMineralsPanel()` 진입 (`index.html:41332`) |

---

## 🔴 v3.1 변경 요약 (2026-04-26)

### 신규 자동화
- **거버너/사령관 자동 만료**: migration 185 + `services/governanceExpire.js` + 1h 스케줄러. 14일 비활성/탈퇴/임기만료 시 자동 자리비움 + 공지 클리어. admin 수동 부담 제거.

### 해소된 P0/P1 (감사 에이전트 결과 반영, commit `135da81`)
| ID | 영역 | Before | After |
|---|---|---|---|
| P0-1 | Shield | `pixel_shields`(상점) 가 hijack 못 막음 | `isClaimShielded/Tx` 가 두 테이블 UNION 조회 |
| P0-2 | Cosmetic | quantity 차감 없음 → 1개로 N장착 | equip -1, unequip +1, 교체 시 이전 cosmetic 환수 |
| P0-3 | Tier | tiers.js miningBonusPct dead code | `/api/harvest` 에 territory_tiers MAX(tier) 곱셈 블록 |
| P1-1 | Harvest cap | multiplier 후 cap → VIP/governor 보너스 무용 | base 직후로 cap 이동, multiplier 가 그 위에서 amplify |
| P1-2 | Season | trackGPSpend 미export → 6개 라우트 silently skip | alias + export |
| P1-3 | logGPActivity | `./gpActivity`(없는 모듈) 잘못된 require | 10개 서비스 일괄 `../db` 로 fix |

### 추가 fix (commit `13efdc0`, `b7aa2bf`, `f424b6a`, `6046673`)
- **Mining tierCounts 응답 누락** → UI 항상 'no land' 표시
- **Mining bestTier 만 roll** → 모든 보유 tier 독립 roll + 합산
- **Governance expire NULL fallback** → 옛 데이터(last_login_at NULL) 도 governor_since 기준 판정
- **고아 announcement 정리** → governor=NULL & announcement≠NULL sector 자동 cleanup
- **거대 토스트 박스** → `.toast{top:50%}` + `bottom:130px` 충돌 fix (bottom:auto + transform)
- **알림창 닫기** → ✕ 버튼 + outside-click
- **출석체크 빈 화면** → QUESTS 탭 진입 시 자동 로드

### 🟡 잔여 known issues
- **P1-4**: hijack 비-primary 디펜더 픽셀 처리 — 의도된 디자인(주 수비자만 공격) 으로 동작 중. 개선 여지 있음
- **CLICK START POINT 박스** — 토스트 stretch 버그였음, 위에서 fix됨

---

# OCCUPY MARS — Codebase Audit (v3.0 / 2026-04-25 — final)

> **이 문서는 코드베이스의 현재 상태를 외부 검토자(Codex 등)에게 넘기기 위한 정리본입니다.**
> 신고된 모든 버그와 자가 진단으로 발견한 이슈, 그리고 검증된 라이브 시스템을 한눈에 볼 수 있도록 구성됨.

## 📊 최종 통계
- **DB 테이블**: 219개
- **Settings 키**: 907개 (모든 라이브 기능 admin 조정 가능)
- **업적**: 29개 (4 카테고리, 4 언어)
- **마이그레이션**: 184개 적용
- **누적 커밋 (이번 작업)**: **27개**
- **Phantom 테이블**: 0개 (이전 35+)
- **검증된 frontend endpoint**: 60+개
- **마지막 커밋**: `3ca106e` — fix(hijack): 지불금액 + NPC 자동승리 + 함대 미리보기

## 🔄 최신 커밋 흐름 (시간 역순)
```
3ca106e  fix(hijack): 지불금액 0.00 + NPC 자동승리 + 함대 미리보기 (사용자 신고 3건)
290ce90  fix(mobile): iPad portrait/iPhone Pro Max landscape 사이드바 자동 열림 + 글로브 안 보임
e764e75  fix(mobile): 사이드바 z-index + 토스트 시각 일관성
2e76af9  docs(v3.0): CHANGELOG + 게임 가이드 'What's New' + AUDIT 최종화
0a48f17  fix: 추가 endpoint 버그 일괄 (전체 endpoint 감사 결과)
cfa8c10  fix(bugs): 사용자 신고 3건 + 테스트 중 발견 2건
```

## ✅ 사용자 신고 버그 (이번 세션 — 모두 해결)
| # | 신고 | 원인 | 처리 | 커밋 |
|---|---|---|---|---|
| 1 | 일일 출석체크 'Daily login failed' | getSetting() string 반환을 array로 사용 → INSERT NaN | JSON.parse + Array.isArray 가드 (services/daily.js + routes/api.js daily/status) | cfa8c10 |
| 2 | JOBS admin 통계 빈 값 | backend `{distribution}` vs frontend `{byJob, noJob, recentChanges}` shape mismatch | `routes/job.js` /admin/jobs에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges | cfa8c10 |
| 3 | EVENTS 탭 빈 화면 | `switchTab()` cats 배열에 `'worldevents'` 누락 → .cat-worldevents 영원히 display:none | cats 배열에 worldevents 추가 (admin.html line 2716) | cfa8c10 |
| 4 | 모바일 사이드바 잡아먹힘 (하단 잘림) | `.panel-r/.panel-l` 모바일 open 시 z-index 120 < `.mob-bottom-nav` z 200 | z 250, padding-bottom safe-area + 110px, panel-close-fixed z 260 | e764e75 |
| 5 | 토스트 시각 일관성 부족 | showToast/showFactionToast 시각·위치·alias 모두 제각각 | 통합 .toast CSS (accent color만 type별 변경), showFactionToast→showToast 위임, 'red'/'green'/'h' legacy alias 자동 normalize | e764e75 |
| 6 | iPhone 양쪽 사이드바 열림 + 글로브 안 보임 | `@media(max-width:768px)`만 처리 → iPad portrait(820), Pro Max landscape(932), split-screen(800~)에서 데스크탑 layout 적용되어 panel 250+250=500px 가 글로브 가림 | 새 `@media(max-width:1024px)` 블록 — 태블릿도 슬라이드 패널, mob-toggle/mob-bottom-nav 표시, panel-tab 숨김. DOMContentLoaded에서 `innerWidth≤1024`면 .open 강제 제거 (캐시 방어) | 290ce90 |
| 7 | 하이젝 지불금액 0.00 PP 표시 | NPC 점령 영토 `pixels.price = 0` → `0 × 1.2 = 0` (무료 하이잭 가능) | `Math.max(existing.price, sectorBasePrice) × HIJACK_MULT` (client + server 4곳) | 3ca106e |
| 8 | NPC 함선 줬는데 자동승리 처리 | defender fleet lookup이 ORDER BY만 하고 HAVING 없음 → 빈 함대도 선택돼 phase1 결함 | `HAVING alive_ships > 0` 명시, 디버그 로그, 신규 `/admin/api/fleet/npc-status` 진단 endpoint + admin 버튼 | 3ca106e |
| 9 | 하이젝 시 상대 함대 정보 미표시 (사용자 추가 요청) | 디클레어 전에 자동승리/함대전 여부 알 방법 없음 | 신규 `/api/hijack/defender-info` + 모달에 "Fleet N개 · 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 라벨 표시 | 3ca106e |
| 10 | iPhone 에 사이드바 stale 상태 (close 버튼 미표시) | Service Worker `mars-v3` 캐시가 옛 index.html 을 iOS 단말에 보존 → 새 CSS/JS fix 적용 안 됨 | sw.js: CACHE_NAME → `mars-v4`, `/index.html` pre-cache 제거, HTML 문서 network-first 분기 신규, index.html에 controllerchange auto-reload 핸들러 + SKIP_WAITING 메시지 처리 | (이번 커밋) |
| 11 | 태블릿 (820px) 바텀 네비 두 줄 중복 렌더링 (실제 페이지 감사 중 발견) | `.col-fab-wrap.show` 가 `display:block` 강제 → `@media(max-width:1024px) .col-fab-wrap{display:none}` 무시됨 (same specificity). 데스크탑 col-fab + 모바일 mob-bottom-nav 동시 표시 | `.col-fab-wrap, .col-fab-wrap.show { display:none !important }` + `#myLandBtn`, `.ops-launch-form`, `.ops-quick` 도 1024 이하 숨김 | 92a8e7f |
| 12 | 구매가능 섹터가 admin 변경 후 즉시 반영 안 됨 ("다른 창 열었다 닫아야") | 서버 `_sectorsCache` 60s TTL + 클라 `_sectorsData` 가 BASE 모달 열 때만 refresh | 서버: `invalidateSectorsCache()` + admin/governance 변경 시 즉시 호출. 클라: `refreshSectors()` 함수 + 60s polling + visibility/focus + sector toggle / claim modal 진입 시 자동 refresh | 6dee1a8 |
| 13 | 거버너/사령관 메시지가 변경 후 안 사라짐 + 페이지 두 번 로딩 | (a) globe 의 governor 라벨이 `marsCanvasTexture` 캐시에 그려져 sector data 갱신해도 텍스처 재합성 안 됨. (b) commander 박스가 announcement 빈 케이스 처리 안 함. (c) SW auto-reload 가 매 업데이트마다 `location.reload()` 호출 | (a) `refreshSectors()` 에 diff 검사 + 변경 시 `marsCanvasTexture=null` + 재합성. (b) `loadCommanderBanner()`: commander 없거나 announcement 빈 케이스 박스 숨김 + textContent 비움. (c) SW auto-reload 제거. HTML network-first 로 자연 nav 시 새 콘텐츠 적용 + 1h background `reg.update()` 만 | f8e545a |
| 14 | commander 교체 시 옛 announcement 잔존 ("커맨더 표시는 왜 남김?") | governance 서비스 commander 교체 SQL 이 `announcement` 컬럼을 NULL 로 클리어 안 함 | `UPDATE commander SET commander_wallet=$1, commander_since=NOW(), announcement=NULL` + `loadCommanderBanner()` 에 visibilitychange/focus 리스너 추가 | (이번 커밋) |
| 15 | 처음 로딩 시 모든 high-tier 섹터가 entry-blocked 로 표시, BASE 누르면 정상 | sector overlay 가 `profileLevel` DOM 에서 user level 읽음. BASE 모달 안 열면 DOM 이 default '1' → 모든 entryMinLevel>1 섹터 잠금. | auto-login `/api/auth/me` 성공 시점에 `/api/user/:wallet/base` 미리 fetch → profileLevel 채움 + 텍스처 재합성 | d63aa4b |
| 16 | 거버너/사령관/공지 자동 expire 로직 부재 ("아직도 수정 안된 듯") | governor/commander 는 siege/admin replace 외엔 자동 사라지지 않음. 캐시 버그가 아니라 **expire 메커니즘 자체가 없는 것**. 사용자는 "임기 끝났다" 생각하지만 DB 엔 데이터 그대로 남음. | admin clear endpoint 3개 신규: `/governance/commander/clear`, `/governance/sector/:id/clear`, `/governance/clear-all`. admin UI 에 버튼 추가 (사령관 초기화 + 전체 거버넌스 초기화). 모두 sectors cache 무효화 호출. | (이번 커밋) |

## ✅ 자가 진단 버그 (테스트 중 발견 — 모두 해결)
| 영향 | 원인 | 처리 |
|---|---|---|
| /api/achievements 500 | ORDER BY a.sort_order (없음) | a.condition_value, a.key |
| /api/profile 500 | users.avatar_color/motto 컬럼 없음 | migration 184 추가 |
| /api/branding/my, spells admin 500 | claims.x1/y1/x2/y2 (실제: center_lat/lng/width/height) | 컬럼명 정정 |
| /api/resources/my 500 | i.resource_code (실제: resource_id FK) | JOIN resources r ON r.id = i.resource_id |
| /api/raffles/active 500 | /raffles/:id가 'active' parseInt → NaN | :id(\d+)로 숫자 제한 |
| 15+ 서비스 u.wallet JOIN 에러 | 이전 fix 시 WHERE만 정정, JOIN 누락 | u.wallet_address로 일괄 정정 |
| /api/claims/my 404 | endpoint 자체 없음 | routes/api.js에 추가 |
| /api/burn/* 404 | gpBurn 삭제됐으나 frontend UI 잔존 | UI 숨김 + loadBurnPanel no-op |

## 🟢 검증된 라이브 시스템 (현재 모두 동작)

### 핵심 게임 루프
| 시스템 | endpoint | 검증 |
|---|---|---|
| 클레임/픽셀 | /api/claims, /api/pixels | ✅ 300+ records |
| GP 경제 | gp_balance + gp_transactions + gp_activity_log | ✅ |
| 하이잭 (PVP) | /api/hijack/declare-with-pp + phaseC.js | ✅ |
| Fleet Combat | /api/fleets, /api/ships/* | ✅ 22 ship types, fleet detail OK |
| 공성전 | /api/siege/* | ✅ |
| 거버넌스 | /api/governance/leaderboard, /bounties | ✅ |
| 시즌 점수 | /api/season/active, /season/leaderboard | ✅ 1 season active |
| 마켓플레이스 | /api/marketplace/listings | ✅ |
| 옥션 | /api/auction, /api/auctions | ✅ |
| 일일 미션 | /api/daily/status, /missions, /login | ✅ Day 3, rewards 5/10/15... |
| 업적 | /api/achievements + auto-trigger | ✅ 29 achievements |
| PVP 베팅 | /api/betting/events, /bet, /mine | ✅ warBetting 단일 시스템 |
| 로켓 드롭 | /api/rockets | ✅ event #12 incoming |
| POI | /api/poi/* | ✅ |
| 파벌 | /api/factions | ✅ 3 factions (mcc/fsp/cv) |
| 길드 | /api/guild/leaderboard, /my | ✅ |
| 직업 | /api/jobs (5 jobs) | ✅ |
| 자원 | /api/resources/catalog, /my | ✅ 13 resources |
| 거버넌스 (commander/governor) | /api/governance/* | ✅ commander Woo |

### 보조 기능 (검증 통과)
- 영토: branding, monuments, tiers, spells, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, vtag, journals, milestones, highlights, ratings, tombstones
- 경제: stakes, polls, wagers, contests, donations, broadcasts, expeditions, raffles
- 미니게임: lottery, dividends, news, crafting

## 🟢 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced (base + Discord wrapper)
- title + titleExtended (basic 13 + advanced 11)
- enhancement + enhancementAdvanced (instancing + recipe bonuses)
- job + jobs routes (user-ops + catalog)
- resource + resources routes (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments services (fleet + simple)

## 🟡 의도적 보류 (별도 작업, 영향 미미)
없음 — 이전 보류 4건 모두 처리됨.
- ✅ Fleet Combat 활성화 (이미 enabled, UI 정합성 fix)
- ✅ routes/ships.js 정리 (실제로는 신 fleet 시스템이었음, CLAUDE.md 메모 정정)
- ✅ news.js retention (24h 스케줄러 + retention setting 동작 확인)
- ✅ referral_count 최적화 (idx_users_referred_by 인덱스 존재)

## 🔴 알려진 미해결 (영향도 낮음, 의도적)
- battle.js / battle 라우트: 완전히 제거됨 (PVP는 fleet+hijack으로 통합)
- routes/ships.js의 일부 endpoint는 JWT auth만 (frontend가 매번 토큰 송부)
- /api/auth/me 404: frontend가 사용 안 함 (JWT decode local-side)

## 📚 문서 (모두 최신)
- **CHANGELOG.md** ← v3.0 패치 노트 (개발자용 상세)
- **CLAUDE.md** ← 신규 세션 핸드오프 (§13~16 보강)
- **AUDIT_FINDINGS.md** ← 이 문서 (기능별 매트릭스)
- **index.html in-game guide** ← "What's New" 섹션 신규 추가 (4개 언어 모두)

## 🆕 신규 진단/검증 API (이번 세션 추가)

| Endpoint | 목적 | 권한 |
|---|---|---|
| `GET /api/hijack/defender-info?wallet=` | 하이젝 모달에서 상대방 함대 미리보기 (auto-win vs fleet battle 사전 판단) | public |
| `GET /api/claims/my?wallet=` | 내 영토 목록 (expedition 셀렉터 등) | public |
| `GET /admin/api/fleet/npc-status` | NPC 전수 진단 (함대전 가능 vs 자동승리 위험 분류) | admin |
| `POST /admin/api/fleet/grant-starter-all-npcs` | NPC 전수 함대+함선+광물 일괄 지급 | admin |

## 🧪 실제 페이지 렌더링 감사 (Claude Preview 사용)

이번 세션 마지막에 실제 브라우저 렌더링 테스트 수행:

| viewport | 결과 |
|---|---|
| Desktop (1280x720) | ✅ 글로브, 패널 collapsed (default), 토글 버튼, 바텀 네비 정상. 콘솔 에러 0건. |
| Mobile (375x812 iPhone X) | ✅ 패널 transform=-319/+319 (off-screen), mob-toggle 보임, mob-bottom-nav 보임, 사이드바 열기/닫기 X 버튼 정상. |
| Tablet (820x1180 iPad portrait) | ⚠️ → ✅ 초기엔 col-fab-wrap + mob-bottom-nav 동시 렌더 (바텀 네비 2줄). `!important` 처리 후 단일 표시. |
| Admin EVENTS 탭 | ✅ Bug #3 fix 검증. World Events (Void Raiders) 섹션 정상 표시. |
| Admin JOBS 탭 | ✅ Bug #2 fix 검증. TOTAL/NO JOB/RECENT/PAID stat cards + JOB DISTRIBUTION 테이블 + RECENT CHANGE LOG 정상. |

추가로 발견된 SW 캐시 이슈 → mars-v4 + HTML network-first + auto-reload 로 해소 (Bug #10).

## 🛡 검증 방법론

이번 작업에서 사용한 audit 방법:
1. 사용자 신고 스크린샷 직접 분석 → 정확한 원인 추적
2. **로컬 서버 가동** (port 3000) + curl로 60+ frontend endpoint 직접 호출
3. 5xx/404 응답마다 server.log 확인 → 코드 수정 → 재테스트
4. PostgreSQL 직접 쿼리로 schema mismatch 추적
5. node 스모크 테스트 (require 모든 services/routes)
6. index.html `<script>` 13개 syntax 검증

→ **다른 사람이 이 audit을 재현하려면**:
```bash
# 1. 서버 가동
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar \
JWT_SECRET=test-key ADMIN_SECRET=test-admin \
node server/index.js > /tmp/server.log 2>&1 &

# 2. endpoint 일괄 테스트
WALLET=0x... ; for ep in /api/claims/my /api/fleets /api/achievements; do
  curl -s -o /dev/null -w "%{http_code} $ep\n" "http://localhost:3000$ep?wallet=$WALLET"
done

# 3. 로그 확인
tail -30 /tmp/server.log | grep -E "error|warn"
```

---

*이 audit은 OCCUPY MARS 메인 컨텐츠(영토 점령, 함대 전투, 채굴, 거버넌스, 마켓)와*
*38개 보조 기능 모두 정상 동작을 검증한 결과입니다.*
