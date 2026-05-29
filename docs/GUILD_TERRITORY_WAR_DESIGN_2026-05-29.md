# OCCUPY MARS — 길드·영토 전쟁 풀 설계도 (EVE 동맹전 / 리니지 혈맹 공성전)

> 작성: 2026-05-29 · 상태: **설계 합의용 (코드 착수 전)** · 작성자: Claude Opus 4.8
> 목표: 흩어져 있는 길드/거버너/공성/동맹 시스템을 "대규모 길드·영토 전쟁"으로 통합.
> 북극성: **EVE Online 동맹 sov 전쟁 + 리니지 혈맹 공성전**.

이 문서는 초안이 아니라 **구현 계약서**다. 착수 시 각 Phase의 DB→서비스→API→UI→수용기준 순서를 따른다.
Phase 1이 실제 동작(함대전으로 공성 해결)하기 전에는 Phase 2~4를 건드리지 않는다.

---

## 0. 한 줄 요약

지금 공성전은 결전 시각에 **영토 픽셀 수만 비교**해서 성주를 바꾼다. "싸움"이 없다.
이미 있는 함대전 엔진(v7.229로 박력 강화 완료)에 공성을 연결하면, 그 순간 **혈맹 공성전**이 된다.
나머지는 그 위에 다(多)혈맹 난전 → sov 지도 → 전쟁 메타를 얹는 것이다.

---

## 1. 현 토대 진단 (Explore 검증 결과, 2026-05-29)

| 시스템 | 상태 | 핵심 근거 |
|---|---|---|
| 길드 (생성/역할/금고, 최대 20명) | 🟢 동작 | `services/guild.js`, mig 046/055/058/070 |
| 섹터 거버너 = 세금 징수 (세율 1~10%) | 🟢 동작 | `services/governance.js`, mig 029/035 |
| 공성전 (48h 예고 → 24h 결전) | 🟡 **승패=픽셀 수 비교** | `services/siege.js` ~L230-237, mig 085 |
| Siege ↔ Fleet Battle 브리지 | 🔴 **코드만 있고 미호출** | `services/siegeFleetBridge.js`, mig 096 `create_siege_battle()` |
| 함대전 엔진 (2진영 atk/def) | 🟢 동작 | `fleet_battles`, `battleScheduler`, mig 093 |
| 동맹 (길드 연합, 최대 3길드) | 🟡 기초만 | `services/alliance.js`, `routes/phaseD.js`, mig 098/157 |

**완성도: 대규모 영토전 기준 ~30-40%.** 개별 부품은 견고, 연결이 끊김.

### 끊긴 곳 3 (우선순위 순)
1. 🔴 **공성 결과가 함대전과 무관** — `siege.js`가 `fleet_battles`를 만들지 않고 `siegeFleetBridge.js`는 아무도 호출 안 함.
2. 🔴 **전장이 2진영(atk/def)뿐** — `fleet_battle_participants.side` CHECK가 atk/def만. 다혈맹 난전 불가.
3. 🟡 **길드전 ↔ 동맹전 분리** — 동맹전(team_battle)이 길드와 무관한 개인 연합 기반.

---

## 2. 타겟 경험 (무엇을 만드는가)

### 리니지 혈맹 공성전 (Phase 1~2가 담당)
- 혈맹(=길드)이 섹터(=성)에 **공성 선포** → 48시간 예고 → 정해진 **결전 시각**에 공격 혈맹 함대 vs 수비 혈맹 함대 **실시간 함대전**.
- 승리 혈맹이 **성주** 차지 → 그 섹터 **세금 징수권**.
- 패배 시 함선 손실(전사), 다음 공성까지 쿨다운.

### EVE 동맹 sov 전쟁 (Phase 3~4가 담당)
- 여러 혈맹이 **동맹(얼라이언스)**으로 묶여 여러 섹터를 동시 분쟁.
- **sov 지도**: 누가 어느 섹터를 쥐었는지 전쟁 지도 + **주간 공성 캘린더**.
- 동맹 단위 전쟁 선포, 세수의 동맹 금고 환류, 전쟁 시즌 랭킹/보상.

---

## 3. Phase 1 — 혈맹 공성전 코어 (siege → 실제 함대전)

> **목표**: 공성 결전을 픽셀 비교가 아니라 함대전 엔진으로 해결. `siegeFleetBridge` 활성화.
> **원칙**: 기존 `fleet_battles`/`battleScheduler`/`applyBattleResults` 재사용. 신규 전투 엔진 만들지 않음.

### 3.1 DB (마이그레이션 — 새 번호는 현 최신 +1)
대부분 **이미 존재**(mig 093 `governor_siege_id`, mig 096 `create_siege_battle()`)하므로 신규 컬럼은 최소.
- `governor_sieges` 에 컬럼 보강 (idempotent `ADD COLUMN IF NOT EXISTS`):
  - `fleet_battle_id BIGINT REFERENCES fleet_battles(id)` — 결전에 생성된 전투 연결.
  - `resolution_mode TEXT DEFAULT 'fleet_battle'` — `'fleet_battle'` | `'pixel_fallback'`(참여 함대 0일 때 폴백).
  - `decisive_battle_started_at TIMESTAMPTZ` — 결전 전투 시작 시각.
- 기존 `create_siege_battle()` 헬퍼 시그니처 점검 후 재사용. 없으면 서비스 레이어에서 직접 INSERT.

### 3.2 서비스 (`siege.js` + `siegeFleetBridge.js`)
- `declareSiege()` (변경): 선언 시점엔 전투 미생성 — 예고 타이머만. (현 동작 유지)
- **신규 스케줄러 훅** (`server/index.js` RUN_SCHEDULERS 블록 안): 결전 시각 도달한 siege를 폴링 →
  `siegeFleetBridge.startSiegeBattle(siegeId)` 호출:
  1. 공격측 = 도전자(+합류 혈맹원) 함대, 수비측 = 현 거버너(+합류 혈맹원) 함대 수집.
  2. `fleet_battles` row 생성(`type='siege'`, `governor_siege_id`, `fleet_battle_id` 역링크).
  3. `fleet_battle_participants` 에 양측 함대 INSERT (현 단계는 side=atk/def 2진영).
  4. `battleScheduler.runBattle()` 로 시뮬 + WS 8x 스트리밍.
- `resolveSiege()` (변경): 픽셀 비교 → **함대전 결과(`fleet_battles.winner_side`)로 성주 결정**.
  - 참여 함대가 양측 다 0이면 `resolution_mode='pixel_fallback'`로 기존 픽셀 비교 유지(데드락 방지).
  - 승리 시 거버너 이전 + `governance_history`/`hall_of_fame` 기록(기존 로직 재사용).
- 함선 손실: `applyBattleResults`의 HP 반영 경로 재사용. 공성은 **full-loss 옵션**(전사) 가능하게 설정값 `siege_full_loss_enabled` (기본 false=HP보존, true=리니지식 전사). → §6 경제 영향 주의.

### 3.3 API
- 기존 `/api/siege/*` 유지. 추가:
  - `POST /api/siege/:id/join` — 공성/수성 측에 자기 함대 합류(혈맹원). 마감: 결전 시작 전까지.
  - `GET /api/siege/:id/roster` — 양측 합류 함대/전력 미리보기.
  - `GET /api/siege/:id/battle` — 연결된 `fleet_battle_id` 반환 → 기존 전투 뷰어/WS 재사용.

### 3.4 UI (index.html — 기존 Governor/공성 패널 확장)
- 공성 상세에 **합류(JOIN ATTACK / JOIN DEFENSE)** 버튼 + 로스터 전력 표시.
- 결전 시각에 기존 함대전 뷰어(WS)로 자동 진입 동선.
- §19 규칙: 동적 버튼은 `data-action` + delegated listener (inline onclick 금지).

### 3.5 수용 기준 (Phase 1 완료 판정)
- [ ] 공성 선언 → 합류 → 결전 시각 자동 함대전 생성 → WS로 관전 → 승자 혈맹이 성주.
- [ ] 참여 0일 때 픽셀 폴백으로 데드락 없음.
- [ ] 함선 HP/전사 반영이 `applyBattleResults` 한 경로로 일관.
- [ ] 모바일/데스크탑 동선, 4언어, fallback, 문서/CHANGELOG/AUDIT.

---

## 4. Phase 2 — 다(多)혈맹 난전 (N-side 전장)

> **목표**: 공/수 2진영 너머, 여러 혈맹이 한 전장에. 엔진 코어 변경 — **리스크 큼**.

### 4.1 DB
- `fleet_battle_participants` 에 `team_id INT` 추가 (NULL=레거시 2진영 호환). CHECK 완화 또는 `team_id` 우선.
- `fleet_battle_teams(battle_id, team_id, label, alliance_id NULL, side_role)` 신규.

### 4.2 엔진 (`battleEngine.js` / `battleScheduler.js`)
- 적군 판정을 `side==='def'` 하드코딩 → **`team_id != myTeam` (적대 관계 테이블)** 로 일반화.
- 타겟 선정/승패 집계를 팀 단위로. WS 프레임에 `team_id` 추가.
- 성능: 함선 수 상한(현 perf mode) 유지 + 팀 수 상한(예: 8) 설정값.

### 4.3 수용 기준
- [ ] 2진영 기존 전투 회귀 없음(team_id NULL 경로).
- [ ] 4~8팀 난전이 시뮬/WS/뷰어에서 정상 집계·표시.

---

## 5. Phase 3 — sov 지도 + 주간 공성 캘린더

> **목표**: "어디서 누가 싸우나"를 한눈에. EVE sov 지도 / 리니지 공성 시간표.

- **섹터 컨트롤 지도**: 24섹터 각 거버너 혈맹/동맹 색상 오버레이(globe.gl 또는 BASE 패널). 기존 `sector control` 데이터(P5-5) 재사용.
- **주간 공성 캘린더**: 섹터별 공성 가능 요일/시각 슬롯(설정값). 무분별 공성 방지 + 관전 모이는 시간 고정.
- **동맹=N길드 통합**: `alliance_max_guilds` 상향, 동맹 단위 공성 선포(`/api/alliances/:id/siege`).
- **DB**: `sector_siege_schedule`, `alliance_sieges`.

---

## 6. Phase 4 — 전쟁 메타 (시즌·세수·보상)

- 승리 혈맹/동맹 금고로 섹터 **세수 환류** (기존 governance 세금 → guild/alliance treasury).
- **전쟁 선포 / 휴전 / 배신** (동맹 배신 쿨다운 168h 기존 로직 확장).
- **전쟁 시즌 랭킹**: `season.js addSeasonScore('siege_win'|'sov_held_days')` 연동.
- 공성 승리 보상(GP/재료/칭호/엠블럼), 패배 페널티.

---

## 7. 경제·밸런스 리스크 (필수 검토)

> 보안/경제 규칙(머니플로 fail-closed, PP=USDT 1:1, 무담보 mint 금지)을 절대 위반하지 않는다.

1. **함선 full-loss vs HP보존**: 리니지식 전사는 함선 demand를 만들지만(EVE 핵심), 현 경제는 HP보존 기반. full-loss는 설정값으로 **기본 OFF**, 켤 때 조선소/보험 sink-source 균형 재검토.
2. **세수 집중**: 강한 혈맹이 다섹터 독점 → 세수 눈덩이. 섹터당 세율 상한·반독점(거버너 섹터 수 캡) 검토.
3. **봇/시빌 공성**: 합류 함대 최소 조건(함선 등급/수), 혈맹 가입 쿨다운으로 다계정 공성 방지.
4. **무참여 공성 어뷰징**: 폴백 픽셀 비교를 악용한 무혈 점령 — 합류 마감/최소 전력 게이트.

---

## 8. 구현 순서 요약 (의존성)

```
Phase 1 (siege→fleet)  ← 단독 가능, 최우선, 기존 엔진 재사용
   └─ Phase 2 (N-side)  ← 엔진 코어 변경, Phase 1 위에
        └─ Phase 3 (sov 지도/캘린더/동맹통합)
             └─ Phase 4 (세수/시즌/보상 메타)
```

각 Phase는 독립 배포 + 검증. Phase 1만으로도 "혈맹 공성전"의 핵심 체감(관전 가능한 실시간 공성)이 완성된다.

---

## 9. 착수 전 확인 필요 (오픈 퀘스천)
- [ ] 함선 full-loss(전사) 도입 여부 — 게임 정체성(P2O 경제)과 충돌 가능. 기본 OFF로 시작 권장.
- [ ] 혈맹 정원 20 유지 vs 상향 — 대규모전 체감 위해 50~100?
- [ ] 공성 캘린더 고정 시각 vs 자유 선언 — 관전 집중도 vs 자유도.
- [ ] Phase 1 착수 승인 여부.

*이 문서는 합의 후 `docs/CLAUDE_*_IMPLEMENTATION_ORDER` 형식의 실행 지시서로 분해해 착수한다.*
