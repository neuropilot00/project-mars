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
- 함선 손실: `applyBattleResults` 경로 확장. **공성 full-loss(전사) = ON 확정**(`siege_full_loss_enabled` 기본 true). 일반 hijack/duel은 HP보존 유지 권장(`siege_full_loss_only`, §12). → 경제 재균형 §12 동시 진행 필수.

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

## 9. 확정된 설계 결정 (2026-05-29 사용자 승인)

| 항목 | 결정 | 영향 |
|---|---|---|
| **함선 전사 (full-loss)** | ✅ **ON** | 패배 시 함선 영구 파괴. EVE식 demand 생성. 조선소/보험/경제 sink-source 재균형 필수(§7, §11). |
| **혈맹 정원** | **50~100명** (설정값, 기본 50, 상한 100) | `guild_max_members` 상향. 대규모전 체감. 채팅/정산 부하 점검. |
| **공성 시각** | **고정 스케줄** | 주간 공성 캘린더 슬롯. 자유 선언 아님 → 관전 집중. |
| **관전 모드** | ✅ 도입 | 비참여자도 실시간 WS 관전. 대형 공성을 "구경거리"로. |
| 거버너 선출 | **공성 기반** (§10) | "픽셀 최다 자동" → 섹터 공성 승자. |
| 커맨더 선출 | **커맨더 공성** (§10) | 거버너들이 모여 최고 권력자 결정. |

→ **모든 항목 확정. 다음 단계는 Phase 1 실행 지시서 분해 후 개발 착수.**

---

## 10. 2단 권력 구조 — 거버너 & 커맨더 (확정 반영)

리니지 "성주 → 왕" / EVE "sov 보유 → 연합 맹주" 구조를 2계층 공성으로 구현한다.

### 10.1 섹터 거버너 (Sector Governor) — 하위 공성
- **권한**: 해당 섹터 1개 통치 + 세금(1~10%) 징수.
- **선출 = 섹터 공성** (Phase 1~2): 도전 혈맹 vs 현 거버너 혈맹의 **고정 시각 함대전**. 승자가 거버너.
  - 자격: 섹터 내 영토 ≥ 3 + 공성 비용 GP. (기존 `siege.js` 조건 재사용/상향)
  - 기존 "픽셀 최다 자동 거버너"(`governance.js`)는 **공성이 없을 때의 기본값**으로만 남기고, 공성이 열리면 전투 결과가 우선.
- **임기/방어**: 다음 공성 슬롯까지 유지. 방어 성공 시 세수 보너스(설정값).

### 10.2 커맨더 (Commander) — 상위 공성
- **권한**: 전역 최고 권력(전 섹터 영향, 세율 상한 조정/전쟁 선포권 등 — 범위는 Phase 4에서 확정).
- **선출 = 커맨더 공성** (Phase 3~4): **각 섹터 거버너(혹은 그 혈맹/동맹)들이 모여** 벌이는 대규모 다자 공성.
  - 자격: 현직 섹터 거버너 혈맹만 출전(또는 거버너 N명 이상 보유 동맹).
  - 형식: 중앙 섹터(수도) 또는 전용 전장에서 다(多)혈맹 난전(Phase 2의 N-side 엔진 필수) → 최후 승자/최다 점수 혈맹의 수장이 커맨더.
  - 주기: 섹터 공성보다 드물게(예: 시즌/월 1회) → 희소성·이벤트성.
- **기존 커맨더**(`governance.js` 전역 픽셀 1위)는 커맨더 공성 도입 전까지 폴백으로 유지.

### 10.3 선출 방식 설계 노트
- 순수 전투(combat-only) 1안 vs 전투+영토점유 혼합 2안. **1안(전투 우선) + 영토 자격 게이트**로 시작.
- 무혈 점령 방지: 공성 미발생 시에만 픽셀 폴백, 공성 발생 시 반드시 전투로 결정.
- 어뷰징: 거버너/커맨더 자격에 혈맹 가입 쿨다운·최소 활동 게이트(시빌 방지, §7).

---

## 11. 관전 모드 (Spectator Mode) — 확정 반영

> 대형 공성/커맨더전을 비참여자도 실시간으로 본다. "구경하며 자란" 그 경험.

- **진입**: sov 지도/공성 캘린더/배틀 허브에서 진행 중(또는 예정) 공성 클릭 → 관전.
- **기술**: 기존 함대전 WS 8x 스트리밍(`battleScheduler` 프레임) 재사용. 관전자는 read-only 구독(명령 불가).
  - WS 채널에 `spectator` 역할 추가. 참여자 명령 권한과 분리.
  - 관전 인원 상한(설정값) + Redis pub/sub 팬아웃으로 다수 관전 부하 분산(이미 구축된 WS Redis 팬아웃 활용).
- **UI**: 관전 전용 오버레이(양측 전력/HP/킬로그/콜아웃), 명령 버튼 숨김, "관전 중" 배지.
- **full-loss 시너지**: 함선이 진짜 죽으므로 관전 긴장감↑. 킬로그/격침 하이라이트 강조.

---

## 12. full-loss(전사) 경제 재균형 (ON 확정 — 필수 작업)

함선 영구 파괴를 켜는 순간 경제 영향이 크다. Phase 1 착수와 **동시에** 다음을 설계/검증한다.
- **공급(source)**: 조선소 건조 회전율 점검 — 전사로 줄어든 함대를 재건할 수 있는 재료/GP 수급.
- **싱크(sink) 균형**: 전사 = 강력한 함선 sink. 기존 sink(수리/강화)와 중복되지 않게 조정.
- **보험(옵션)**: EVE식 함선 보험(건조비 일부 GP 환급) 설정값 — 신규 유저 진입장벽 완화. 기본 OFF로 시작, 데이터 보고 결정.
- **공성 한정 vs 전면**: full-loss를 **공성/커맨더전에만** 적용하고 일반 hijack/duel은 HP보존 유지하는 옵션(`siege_full_loss_only`) 권장 — 캐주얼 PvP 보호.
- **PP=USDT 1:1, 무담보 mint 금지** 등 머니플로 보안 규칙 절대 불변.

---

---

## 13. 거버너 = 길드 소유 (Codex + 아키텍트 독립 검토 합의, 2026-05-29)

사용자 결정 "거버너를 처음부터 길드가 먹게". Codex(codex-rescue) + Plan(opus) 병렬 독립 검토 결과 강하게 수렴.

### 13.1 🔴 선결 — 거버넌스 테이블 이원화 해소 (가장 큰 리스크)
코드에 **병렬 거버넌스 2개**가 존재:
- `sectors`(정수 id): `governance.js` 픽셀 최다 **개인 자동 산정** + `routes/api.js` claim/hijack 시 호출(`recalculateGovernor`/`collectTax`).
- `sector_governance`(sector_code): `siege.js` **공성으로만** 교체.

→ **`sector_governance`를 길드 거버너 정본으로 단일화**, `sectors.governor_wallet`은 표시용 미러로 강등. 길드 거버너 존재 시 픽셀 자동산정 skip(`governor_auto_seed_enabled`는 미점령 섹터 부트스트랩만).

### 13.2 확정 데이터 모델 (mig 259 적용 완료, 동작 무변경)
- `sector_governance.governor_guild_id`(nullable, FK guilds ON DELETE SET NULL) + `governor_member_wallet`(표시용, FK 미검 — 탈퇴 내성). `governor_wallet` 유지.
- `governor_sieges.challenger_guild_id`/`defender_guild_id`/`winner_guild_id`.
- `guilds.sector_tax_collected`.
- Backfill: 기존 개인 거버너 → `users.guild_id` 길드 승계(무길드면 NULL=기존 동작, 길드 생성 안 함).
- 설정: `guild_governance_enabled`(false), `governor_auto_seed_enabled`(true), `sector_tax_to_guild_treasury`(true).

### 13.3 권한·세금 (구현 시)
- 멤버십 정본 = `guild_members(guild_id, wallet, role)` (role: leader/officer/member). `users.guild_id` = 현 소속.
- `declareSiege`/`commitSiegeFleet`: **리더/오피서**만(현재 본인 지갑만 → 재정의). 함대는 길드 대표 함대.
- 세금: 길드 거버너면 `guilds.gp_treasury` 적립 + `guild_treasury_ledger` 기록(인프라 존재). 자동분배 금지, 리더/오피서 출금(`withdrawTreasury` 신규, ledger 필수).

### 13.4 ✅ 확정 적용 순서 (두 검토 공통 강권)
1. **Phase 1a(개인) 플래그 ON 검증** — `siege_fleet_combat_enabled=true`로 개인 vs 개인 공성이 함대전으로 정상 해결됨을 먼저 확인. (동시 길드화 금지 — 실패 격리 불가)
2. **mig 259** 적용(완료, 읽기 호환).
3. **읽기 길드화** — 조회/UI에 길드명 표시(쓰기 불변).
4. **쓰기 길드화** — declare/commit/resolve를 `governor_guild_id` 정본으로, `guild_governance_enabled` 게이트.
5. **세금 금고 전환** + `withdrawTreasury`.
6. 자동산정 skip 활성화.

### 13.5 Codex가 Phase 1a(v7.240)에서 발견한 결함 (길드-쓰기 단계에서 수정)
- `commitSiegeFleet` 인증이 **본인 지갑만** → 길드원/오피서 참여 불가(길드 모델에서 역할 체크로 교체).
- `resolveSiege` 전투 종료 훅이 **해결 시점 현 거버너 재검증 안 함** → race 가능. 길드-쓰기 시 `sector_governance` 행 FOR UPDATE 잠금 추가.
- GP 이중지불: 없음(FOR UPDATE 보호 확인).

### 13.6 리스크 가드 (구현 시)
- 길드 해체(`disbandGuild`): 트랜잭션 안에서 `sector_governance` 무주공산화(다음 공성 대기). FK ON DELETE SET NULL.
- 탈퇴/추방: 권한 근거 = `guild_id`+role(표시용 wallet 아님). 대표 탈퇴 시 leader_wallet 재해석.
- 금고 어뷰징: 세수 직입금 후 즉시 disband 인출 방지 — 출금 쿨다운/리더 전용/ledger 필수, disband 잔액 정책 명시.

---

*§9 + §13 합의 완료. mig 258(공성→함대전)·259(거버너=길드) 데이터 모델 적용됨(플래그 OFF). 다음: Phase 1a 플래그 ON 검증 → 길드 읽기/쓰기 단계.*
