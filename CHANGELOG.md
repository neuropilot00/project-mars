# OCCUPY MARS — Changelog

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
