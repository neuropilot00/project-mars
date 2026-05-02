# OCCUPY MARS — Claude Code 핸드오프 문서
> 최종 업데이트: 2026-05-03 v5.59 (Fleet Mars atmospheric background) | 이 파일을 먼저 읽으면 코드베이스를 즉시 파악할 수 있습니다.

> **❗ 새 세션이 가장 먼저 읽을 곳**:
> 1. **AUDIT_FINDINGS.md** — 기능별 동작 상태 매트릭스 (🟢/🟡/🔴 + 우선순위)
> 2. **CLAUDE.md의 알려진 이슈 섹션** — 해소/잔여 이슈
> 3. **CLAUDE.md의 서비스 카탈로그 섹션** — 주요 API/서비스 위치

---

## 0. 작업 규칙

- 코드 변경을 커밋/푸시할 때는 관련 `CHANGELOG.md`와 `AUDIT_FINDINGS.md` 업데이트를 같은 변경 묶음에 포함한다.
- 빠른 핫픽스로 코드 커밋이 먼저 나간 경우에도 즉시 후속 커밋으로 audit/changelog를 보강한다.

### v5.59 최신 핸드오프 — 화성 상층권 전투 배경

- 택티컬랩 전투 배경은 `assets/textures/mars_nasa_2k.jpg`를 사용한다.
- `MARS_BATTLE_BG`가 비동기로 로드되고, `drawBG()`에서 어둡게 누른 화성 표면 텍스처를 아주 느리게 패닝한다.
- 배경 위에 어두운 veil/기존 주황·푸른 글로우/희미한 먼지 스트릭을 덧씌워 함선·레이저 가독성을 우선한다.
- 검수용 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html` 양쪽에 동일 반영해야 한다.
- 배경 밝기/속도 조정 시 `drawBG()`의 `globalAlpha`, `drift`, `veil` 값을 조정한다. 함대전 가독성을 해치지 말 것.

### v5.58 핸드오프 — 함대전 PNG 로드 전 구형 벡터 차단

- 택티컬랩 전투 렌더러는 `SHIP_SPRITE_STATUS`로 22종 PNG 로드 상태를 추적한다.
- PNG가 아직 `loading`인 함선은 구형 벡터/SVG fallback을 그리지 않는다. 첫 프레임에서 예전 실루엣이 깨져 보이는 현상을 막기 위한 처리다.
- PNG 로드가 실제로 실패한 경우에만 구형 벡터 fallback을 허용한다.
- 엔진 플레임/대형함 HP bar도 함선 본체가 그려진 프레임에서만 표시한다.

### v5.57 핸드오프 — 보유 함선 무한 스탯 강화

- 보유 함선은 `POST /api/ships/:id/upgrade-stat`로 `atk`, `def`, `hp`, `speed` 중 하나를 영구 강화할 수 있다.
- 강화는 실패/파괴/등급명 없이 누적된다. 조선소 보유 함선 카드에는 기본 스탯 옆에 녹색 `(+N)` 보너스가 표시된다.
- `server/migrations/209_ship_infinite_stat_upgrades.sql`가 `ships.bonus_speed`, `ship_stat_upgrade_log`, 강화 비용/증가량 설정을 추가한다.
- 강화 비용은 총 투자 횟수 기반으로 증가한다. 설정 키는 `ship_upgrade_base_gp`, `ship_upgrade_growth`, `ship_upgrade_*_step`.
- HP 강화는 `bonus_hp`와 `current_hp`를 같이 올린다. 수리/실드/전투 계산은 `max_hp + bonus_hp` 기준을 유지한다.
- 서버 전투 엔진은 `bonus_atk`, `bonus_def`, `bonus_hp`, `bonus_speed`를 실제 전투 스탯에 반영한다.

### v5.56 핸드오프 — 함대 수 기반 전투 거리/줌

- 택티컬랩 전투에는 `battleScaleConfig()`가 있음.
- 함대 수가 적을수록 시작 간격(`startGap`), 최소/이상 교전 거리(`minPad`, `idealPad`)가 줄고 최대 카메라 줌(`maxZoom`)이 커진다.
- 함대 수가 많을수록 시작 거리와 교전 거리가 멀어지고 자동 카메라는 전체 전장 프레이밍을 우선한다.
- 1:1 소규모전은 더 가까운 거리에서 크게 보이는 방향으로 조정되어야 한다. 소규모전 카메라를 다시 멀게 만들지 말 것.
- 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.

### v5.55 핸드오프 — 함대전 무전 콜아웃

- 택티컬랩 전투 화면에 `.battle-comms.top/bottom` 콜아웃 레이어가 있음.
- 명령/진형/기동/승리 문구는 상단, 피격/격침/후퇴 경고는 하단에 표시한다.
- `battleCallout()`, `panicCallout()`, `maybeAmbientCallout()`이 전장 무전 UI를 담당한다.
- 소형함 격침은 확률적으로 짧은 비명/탈출 대사를 표시하고, 대형함/기함 격침은 강한 경고 문구를 표시한다.
- 수동 스킬(`cmdFocus`, `cmdEMP`, `cmdBeamCannon`, `cmdMissileBarrage`)과 `cmdFormation`, `cmdManeuver`는 전투 로그와 별도로 콜아웃도 띄운다.
- 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.

### v5.54 핸드오프 — 수동 빔포/미사일 스킬

- 택티컬랩에 `☢ 빔포`와 `☄ 미사일` 수동 스킬 버튼이 있음.
- `beamCharge`는 살아있는 ATK 전함/타이탄 수에 따라 충전된다. 100%에서 `cmdBeamCannon()`이 우선순위 대형 목표에 두꺼운 주포 빔을 발사한다.
- `missileCharge`는 살아있는 ATK 프리깃/구축함/순양함 수에 따라 충전된다. 100%에서 `cmdMissileBarrage()`가 다수 미사일을 적 함대에 뿌린다.
- 빔포는 `lasers[]`의 `beamCannon` 플래그로 굵기/글로우를 다르게 렌더한다.
- 수동 스킬은 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.
- 현재 수동 스킬은 택티컬랩 시뮬레이션 계층 명령이다. 실제 서버 전투 명령으로 영구 반영하려면 별도 API/WS command 타입(`beam_cannon`, `missile_barrage`)을 서버 전투 상태에 연결해야 한다.

### v5.53 핸드오프 — 함선 상성/진영 밸런스 + 조선소 세로 UI

- `server/services/battleEngine.js`의 `getShipMatchupMult()`가 역할/함급/파벌 상성을 실제 데미지에 반영한다.
- 기본 상성은 `tackle > ewar/logi`, `sniper > tank/capital`, `bomb > battleship/titan`, `tank/screen > small rush`, `logi = 직접 화력 낮음`.
- 파벌 교리는 MCC=정밀 저격/대형함 처리, FSP=장기전/탱킹/로지, CV=러시/폭격/순간화력이다.
- `server/migrations/208_ship_matchups_and_doctrine.sql`은 22종 함선 스탯/설명/일부 role(`mcc_snp=sniper`, `cv_bomb=bomb`)을 재조정한다.
- `assets/tactical-lab-v11.html`에도 같은 상성 계산이 들어가 있어 데모 전투 결과와 서버 결과의 방향성이 맞아야 한다.
- 택티컬랩 사운드는 외부 음원 없이 WebAudio로 생성한다. 브라우저 자동재생 제한 때문에 `SOUND` 버튼을 눌러야 BGM/SFX가 켜진다.
- 세로 전장 기동 표기는 `↑ Advance`, `↓ Retreat`를 사용한다. 가로 화살표로 되돌리지 말 것.
- 조선소 청사진은 데스크탑 4열, 모바일 1열 카드이며 `assets/ships/top/{ship_code}.png` 세로 함선 이미지를 사용한다.
- PNG 로드 시 기존 SVG 실루엣은 숨기고 새 `.bp-engine-flame` 오버레이를 후미 불꽃으로 사용한다.

### v5.52 핸드오프 — 탑뷰 함선 PNG + 장거리 함대전

- `assets/tactical-lab-v11.html`은 v11.1 기반 세로 전장으로 전환됨. 적군 상단, 아군 하단.
- `assets/fleet-assault-demo.html`은 데모/검수용 원본이며, 현재 내용은 `assets/tactical-lab-v11.html`에도 복사되어 본서버 택티컬랩과 동일해야 함.
- `assets/ships/top/`에 실제 사용되는 22종 함선 PNG 축소본이 있음. `mcc_destroyer_top.png`는 코드상 22종에 포함되지 않는 중복 샘플이므로 매핑 제외.
- 전투와 SHIP REGISTRY 미리보기는 같은 PNG 스프라이트 렌더러를 사용. 기존 벡터 함선은 PNG 로드 실패 시 fallback 용도로만 유지.
- 엔진 플레임은 `drawEngineFlame()`으로 통일. 예전 벡터 기준 파란 불꽃을 별도로 되살리지 말 것.
- 함선은 사격 시 `aimX/aimY/aimTTL`로 현재 타겟 좌표를 바라본다. 이동 방향보다 공격 대상 방향이 우선.
- 장거리 함대전 느낌을 위해 `updateFleets()`의 `minDist`/`idealDist`는 넓게 잡혀 있음. 근접 난전처럼 함대가 겹치지 않게 유지.
- 자동 카메라는 함대 반경이 아니라 살아있는 함선 스프라이트 바운딩 박스 기준으로 프레이밍한다.
- 모바일 HUD는 속도 오버레이 단일 버튼(`x1/x2/x4/x8` 순환) + 소형 전술/진형/기동 그리드.
- 증원 테스트 버튼(`MCC x10`, `FSP x10`, `Cruiser`)은 본서버 함대전 UI에서 제거.
- 모바일 퍼포먼스 모드가 작은 함선 대표 렌더, 발사 밀도/총알 누적/폭발 파티클/글로우 비용을 제한함.

## 1. 프로젝트 한 줄 요약

**화성 세계 지도 위 픽셀 영토를 GP(게임 포인트)로 클레임하고, 섹터 거버넌스·함대전·길드전을 벌이는 Web3 게임형 광고 플랫폼.**
백엔드 Express + PostgreSQL, 프론트 단일 파일 `index.html` (35k줄 인라인 앱).

---

## 2. 환경 & 실행

```bash
# DB
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar   # 로컬
# 로컬 서버 시작
cd server && node index.js          # 또는 npm run dev (watch 모드)
# 포트
3000 (기본, PORT env로 오버라이드)
```

**필수 env 변수** (`server/.env`):
```
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar
JWT_SECRET=...
ADMIN_SECRET=...          # 어드민 API 인증 헤더값
NODE_ENV=development
```

---

## 3. 디렉터리 구조

```
/
├── index.html              ← 메인 앱 (CSS+HTML+JS 인라인, 35k줄 — 절대 분리 시도하지 말 것)
├── admin.html              ← 어드민 패널 (동일 구조, 인라인)
├── CLAUDE.md               ← 이 파일
├── CLAUDE_CODE_BRIEF.md    ← 구버전 브리핑 (v1.0, 참고용만)
├── server/
│   ├── index.js            ← Express 앱 + 스케줄러 (~1,151줄)
│   ├── db.js               ← Pool + initDB + getSetting + logGPActivity + 공통 유틸
│   ├── migrate.js          ← 파일 기반 마이그레이션 러너
│   ├── migrations/         ← SQL 파일 001~199 (2026-04-29 기준)
│   │   └── archived/       ← 사용 안 하는 구버전 마이그레이션 (51개, 건드리지 말 것)
│   ├── routes/             ← 61개 라우트 파일 (/api/* 경로)
│   └── services/           ← 73개 서비스 파일 (비즈니스 로직)
├── public/
│   └── js/                 ← 미니게임 3개 (minigame-invaders/runner/digger.js)
└── assets/
    ├── lib/globe.gl.min.js ← 3D 지구본
    ├── base/, nav/, textures/, avatars/
```

---

## 4. DB 현재 상태

- **DB명**: `pixelwar` (PostgreSQL)
- **적용된 마이그레이션**: 001 ~ **203** (2026-04-29 기준)
- **총 테이블 수**: 109개+
- **마지막 마이그레이션**: `203_capital_ship_core_mid_materials.sql`

### 핵심 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | wallet_address PK, gp_balance, pp_balance, faction_code |
| `claims` | 영토 클레임 (owner, sector_code, pixels) |
| `pixels` | 개별 픽셀 소유권 |
| `settings` | key PK (JSONB value) — 모든 게임 밸런스 값 저장 |
| `schema_migrations` | filename UNIQUE — 적용된 마이그레이션 기록 |
| **Fleet Combat** | |
| `factions` | mcc/fsp/cv 3파벌 |
| `ship_types` | 22종 함선 (frigate/destroyer/cruiser/battleship/titan × 3파벌) |
| `fleets` | 유저 함대 인스턴스 |
| `ships` | 개별 함선 인스턴스 |
| `ship_build_jobs` | 건조 큐 (비동기) |
| `fleet_battles` | 함대전 세션 |
| `fleet_battle_participants` | 전투 참여자 |
| `fleet_battle_events` | 전투 이벤트 로그 (tick별) |
| `hijack_battles` | hijack 2단계 전투 연결 |
| `hijack_stats` | hijack 통계 누적 |
| `fleet_gp_activity` | 함대 GP 소비 로그 |
| **Resources** | |
| `resources` | 채굴 재료 정의 (tier 0~3, 13종) |
| `sector_resource_rates` | 구역별 채굴 재료 드롭률 (frontier/mid/core별 차별화) |
| `user_resource_inventory` | 유저 보유 광물 재고 |
| **VIP** | |
| `vip_tiers` | VIP 등급 정의 |
| `user_vip` | 유저 VIP 상태 |
| **알림** | |
| `player_notifications` | 플레이어 알림 (in-game) |
| **Campaign** | |
| `campaign_chapters` | 캠페인 챕터 메타/콘텐츠 |
| `player_campaign_progress` | 캠페인 세션/진행도/결과/보상 payload |
| `player_reputation` | mcc/fsp/cv 평판 |
| `player_chapter_choices` | 브리핑 선택지 영구 기록 |
| `player_lore_flags` | 서사 플래그 |
| `chapter_branch_modifiers` | 향후 챕터 분기 영향 |
| `campaign_reward_inbox` | blueprint 등 지연 수령 보상 |
| `campaigns` / `chapters` | 30개 캠페인 챕터용 공통 정의 |
| `campaign_sessions` | 진행 중 캠페인 세션/재접속 복구 |
| `reputation_history` | 평판 변경 감사 로그 |
| `tag_definitions` / `player_active_title` | 태그/칭호 정의 및 활성 칭호 |
| `lore_flag_definitions` / `global_lore_flags` | player/global 서사 플래그 정의 |
| `branch_modifier_definitions` / `player_branch_modifiers` | 챕터 간 분기 영향 정의/적용 |
| `environment_definitions` / `chapter_environment_configs` | Dust Storm 등 환경 정의/phase curve |

### DB 뷰
- `v_player_fleet_summary` — 유저별 함대 요약
- `v_fleet_composition` — 함대 구성 (함선 종류별)
- `v_titan_status` — Titan 함선 서버 제한 현황 (max 3척/종)

---

## 5. Campaign System Architecture

### 현재 구현 상태 (v5.33)
- **비주얼 노벨 씬 엔진**: `showCampaignStory()` 가 `showCampaignBriefing()` 를 대체. 씬 타입(`narration`, `dialogue`, `choice`, `branch`, `battle_transition`, `result`, `ending`)별로 배경·캐릭터 초상화·타이핑 애니메이션을 렌더한다. `ch.scenes` 없는 챕터는 기존 briefing 폴백.
- **이미지 에셋**: `assets/campaign/backgrounds/` 78개 PNG + `assets/campaign/characters/` 21개 PNG. 모두 GCP Vertex AI Imagen 3 (32-bit pixel art, semi-realistic, Mars sci-fi). `.gitignore` 예외 추가로 git 추적.
- **배경 매핑**: `_bgMap` (index.html)이 씬 background ID → 파일명을 매핑. 실제 파일이 있는 ID는 직접 참조, 없는 ID만 폴백.
- **씬 파일**: `docs/campaign-story/` 36개 JSON (MCC/FSP/CV Ch1~10 + Prologue 3종). `campaign.js`의 `CHAPTERS[id].scenesFile` 필드로 참조.
- **MVP 방식**: MCC Campaign Ch1~10과 FSP Campaign Ch1~10은 `server/services/campaign.js`의 서버 결정형 시뮬레이션으로 처리한다.
- **API**: `server/routes/api.js`의 `/api/campaign/status/:wallet`, `/api/campaign/start`, `/api/campaign/choice`, `/api/campaign/progress`, `/api/campaign/complete`.
- **DB**: 192~204번 마이그레이션. 204는 방어적 `IF NOT EXISTS` 재보장 + `hidden_campaign_ch1~5` FK 시드.
- **보상 정책**: `complete()` 에서 평판 포함 모든 선택적 보상이 SAVEPOINT 안에서 실행된다. 스키마 누락이 있어도 챕터 완료 자체가 500으로 죽지 않는다.
- **세션 복구**: QUESTS 탭의 `CONTINUE`는 기존 `sessionId`를 이어서 씬 엔진 또는 시뮬레이션으로 복구한다.

### MCC Route Implemented Chapters
- `mcc_campaign_ch1`: 산소 쟁탈 / Dust Storm / 산소 회수율.
- `mcc_campaign_ch2`: 동결된 고속도로 / night_freezing / 시설 HP, 민간인 피해, FSP 증원.
- `mcc_campaign_ch3`: 이사회 / phobos_eclipse_periodic / Helion·Verin·Chromium 3분기.
- `mcc_campaign_ch4`: 해적 매수 / ion_storm_active / Kara Vex, 회담 호위, Helion 습격대.
- `mcc_campaign_ch5`: 케플러 분쟁 / low gravity + oxygen pressure / Roth 데이터, Kepler 서버, CV 자급 모선.
- `mcc_campaign_ch6`: 내부고발자 / solar radiation storm / Li Fang 선택, A·B·C 루트 확정.
- `mcc_campaign_ch7`: 시장 전쟁 / dust storm season peak / Ch6 루트별 Market War 변형.
- `mcc_campaign_ch8`: 프로메테우스 / 4-phase environmental sequence / Prometheus 방어·파괴·조기 엔딩.
- `mcc_campaign_ch9`: 깨진 동맹 / 4전장 병렬 시뮬레이션 / Pilgrim Arms 공개와 NPC 운명.
- `mcc_campaign_ch10`: 주주 엔딩 / cinematic-only / 4 엔딩 + fallback, NG+ cross-route modifier.

### FSP Route Implemented Chapters
- `fsp_campaign_ch1`: 방파제 / dust storm recovery + night freezing / H2O 호송, 응급 환자, 차 두 잔 의식.
- `fsp_campaign_ch2`: 얼음 캐러밴 / solar exposure + Phobos eclipse / 6대 얼음 운반선, Lena 개인 서사, Sal Cruz 매복.
- `fsp_campaign_ch3`: 피의 광산 / high altitude thin air / Verin-7 산소 노예제, 412명 광부 해방, 60명 잔류 결정.
- `fsp_campaign_ch4`: 외교 / subterranean dust + equatorial Phobos pattern / Cinder Grace 비밀 회담, Amara 보호, MCC 정찰 회피, CV 동맹 강도 분기.
- `fsp_campaign_ch5`: Kepler 공유지 / low gravity crater + oxygen supply critical / Liang Wei, Roth dead drop, 3파벌 회담, Commons·중재·압박·전투·공개 5분기.
- `fsp_campaign_ch6`: 두더지 / settlement interior + time pressure attack / Kenji Tanaka 색출, Sarah/Diego red herring, 처형·이중첩자·추방 영구 분기.
- `fsp_campaign_ch7`: 의회 / assembly_session + dynamic_crisis / 영구 의장 선출, 외부인 의장 출마, 외곽 위기 병행, Ch10 엔딩 alignment seed.
- `fsp_campaign_ch8`: 가이아 / civilian_donation_drive + shipyard_wave_defense / 시민 기부, Gaia 건조, MCC/CV/Pilgrim Arms wave 방어, Gaia 함장·Pilgrim Arms seed.
- `fsp_campaign_ch9`: 세 개의 깃발 / neutral_summit + pilgrim_arms_assault / MCC·FSP·CV 정상회담, 보호 대상 선택, Pilgrim Arms 공개 등장, 엔딩 강제 분기.
- `fsp_campaign_ch10`: 자유의 대가 / ending_evaluation_and_cinematic / Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 최종 보상.

### Adding New Chapter Workflow
1. `campaign_chapters` seed 또는 `CHAPTERS` 정의에 새 `questId`를 추가한다.
2. `simulate*()`와 `calculateRewards()`를 챕터별로 분기한다.
3. 시작 조건, choice id, reward id는 서버에서만 검증한다.
4. UI는 `status` 응답의 chapter list를 렌더하므로, 가능하면 API payload 호환성을 유지한다.
5. 커밋/푸시 전 `CHANGELOG.md`와 `AUDIT_FINDINGS.md`를 함께 갱신한다.

### Branch Modifier System
- `player_lore_flags`: 한 번 켜지는 서사 플래그.
- `player_tags`: 플레이어 성향/업적 태그.
- `chapter_branch_modifiers`: 특정 향후 챕터에만 영향을 주는 modifier.
- 실패 분기 예: `cold_death` → `cold_sister_frozen`, `mcc_ch6/chen_distrust_increased`.
- Ch6 루트 분기: `mcc_route_a_active`(Li Fang 지원), `mcc_route_b_active`(Chen 보고), `mcc_route_c_active`(자료 복사). Ch7~9는 서버에서 해당 루트 선택지만 허용한다.
- Ch10 엔딩 자격은 `calculateEligibleEndings()`가 서버에서 계산한다. Branch A/Chen 사망은 Ending 3, Branch B는 Ending 1(+조건부 Ending 2), Branch C는 Ending 1/2/4 조건부.

### Battle Resolution Modes
- `server_simulation`: 현재 Ch1 MVP. 서버 seed로 결과를 계산하고 보상을 지급한다.
- `full_engine`: Phase 2 예정. v11.1 전투 엔진 환경 modifier, Helion 함선/화물선 보존 목표, 실시간 진행 UI를 연결한다.

### Reputation / Tags / Lore Flags Distinction
- `player_reputation`: MCC/FSP/CV/Pilgrim Arms 수치 평판. 변경 시 -100~100으로 clamp하고 `reputation_history`에 남긴다.
- `player_tags`: 플레이어 속성/칭호/불명예 상태. 예: `cold_death`, `efficient_operator`, `war_criminal`.
- `player_lore_flags`: 플레이어별 서사 사건 발생 기록. 예: `cold_sister_frozen`, `lifang_personal_arc_unlocked`.
- `chapter_branch_modifiers`/`player_branch_modifiers`: 특정 향후 챕터에 적용되는 분기 효과. 현재는 단순 조회/적용, 복잡 조건 evaluator는 P2.

### Campaign API Map
- `/api/campaign/status/:wallet`: 챕터, active session, reputation, tags, branch, inbox 조회.
- `/api/campaign/start|choice|progress|complete|abandon`: 챕터 플레이 lifecycle.
- `/api/reputation/:wallet`: 평판 조회. `/api/reputation/delta`는 internal-only.
- `/api/tags/:wallet`, `/api/tags/set-active-title`: 플레이어 조회/칭호 설정. `/api/tags/grant|revoke`는 internal-only.
- `/api/lore/flags/:wallet`, `/api/lore/flag/check`: lore 조회. `/api/lore/flag/set`은 internal-only.
- `/api/branch/active/:wallet/:targetChapter`: 활성 branch 조회. `/api/branch/set`은 internal-only.

### Environment System Phases
- 정적 정의는 `environment_definitions`, 챕터별 curve는 `chapter_environment_configs`에 seed한다.
- 런타임 helper는 `server/services/campaign.js#getEnvironmentState()`에 있다.
- Ch1은 `dust_storm_incoming` 4단계: 0s/280s/560s/750s. `railgun`은 accuracy penalty 면역.

---

## 6. 코딩 패턴 — 반드시 준수

### ① 설정값 조회 (하드코딩 금지)
```javascript
// db.js에서 export된 getSetting 사용
const { getSetting } = require('../db');  // services에서
// 또는 로컬 함수로:
async function getSetting(key, fallback = null) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch (_) { return fallback; }
}
// 사용 예:
const enabled = await getSetting('fleet_combat_enabled', 'false');
const maxFleets = parseInt(await getSetting('max_fleets_per_player', '5')) || 5;
```

### ② 트랜잭션 패턴
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... DB 작업 ...
  await client.query('COMMIT');
  return { success: true, ... };
} catch (err) {
  await client.query('ROLLBACK');
  console.error('[SERVICE_NAME] funcName error:', err.message);
  return { success: false, error: 'internal_error' };
} finally {
  client.release();  // 반드시 release
}
```

### ③ GP 활동 로그 (fire-and-forget)
```javascript
// COMMIT 후 실행 — 실패해도 메인 로직 영향 없음
try {
  const { logGPActivity } = require('../db');
  logGPActivity(wallet, -gpCost, 'action_type', '설명').catch(() => {});
} catch (_) {}
```

### ④ 시즌 점수 업데이트 (fire-and-forget)
```javascript
try {
  const seasonSvc = require('./season');
  seasonSvc.addSeasonScore(wallet, 'gp_spend', gpCost).catch(() => {});
  seasonSvc.addSeasonScore(wallet, 'fleet_action', 1).catch(() => {});
} catch (_) {}
```

### ⑤ 어드민 인증
```javascript
function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}
```

### ⑥ wallet 추출 (라우트 공통)
```javascript
function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) { res.status(400).json({ error: 'wallet_required' }); return null; }
  return w;
}
```

### ⑦ settings INSERT (SQL 파일)
```sql
-- settings PK는 key 단독 — (category, key) 복합 아님
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'some_key', 'true', '설명')
ON CONFLICT (key) DO NOTHING;  -- ← 반드시 (key)만 사용

-- value 컬럼은 JSONB:
-- 문자열: '"text_value"'  (쌍따옴표 포함)
-- 숫자:   '42'            (따옴표로 감싸도 jsonb가 파싱)
-- 불린:   'true'/'false'
-- 1.0.0 같은 버전 문자열: '"1.0.0"'  ← jsonb는 점(.)이 있으면 에러
```

### ⑧ 마이그레이션 등록 (psql 직접 실행 시)
```bash
# psql로 직접 실행하면 schema_migrations에 자동 등록 안 됨
# 수동으로 등록 필요:
psql $DATABASE_URL -c "INSERT INTO schema_migrations (filename) VALUES ('096_xxx.sql') ON CONFLICT DO NOTHING;"
```

---

## 6. 인증 시스템

- **방식**: JWT (email + bcrypt password)
- **토큰**: `Authorization: Bearer <token>` 헤더
- **wallet**: 모든 게임 행동의 PK — `x-wallet` 헤더 또는 body.wallet
- **WebSocket**: 미구현 (REST + polling 방식)

---

## 7. 라우트 등록 방식 (server/index.js)

모든 API 라우트는 `/api` prefix:
```javascript
// server/index.js
const fleetRoutes = require('./routes/fleets');
app.use('/api', fleetRoutes);
```

어드민 라우트:
```javascript
app.use('/admin/api', adminRoutes);  // 단일 파일 admin.js로 통합
```

---

## 8. 현재 개발 상태 & 다음 작업

### ✅ 완료된 것 (2026-04-28 기준)
- Migration 001~168 전부 DB 적용 완료
- Fleet Combat 전체 스택 활성화 (`fleet_combat_enabled = true` — DB 확인 완료)
- 파벌 시드 데이터 (mcc/fsp/cv), 함선 22종, 광물 tier 0~3 (13종)
- VIP 시스템 (migration 162)
- **함대전 HP 보존** — hijack 전투 후 함선 HP 그대로 유지 (is_alive=true), 조선소 수리 연계
- **전투 무한전** — MAX_TICKS=54000 (실질 무제한), 타임아웃 결과=draw (HP비율 승자 제거)
- **WS 스트리밍 8x** — battleScheduler.js `tickMs/8`
- **후퇴 (forfeit)** — `POST /api/battles/:id/forfeit` 신규 endpoint
- **전투 뷰어 fixes** — HP바 실시간 감소, 내 함대/적 함대 올바른 구분, "나" 배지
- **속도 조절 버튼** — tactical-lab SPEED 패널 (×1/×2/×4/×8, WS 없는 로컬 시뮬 전용)
- **브라우저 네이티브 다이얼로그 제거** — confirm() 전면 인게임 모달로 교체 (§18 참조)
- **핵심 플레이 라인 검수 v5.12** — 함선 건조/수리 재료 차감, 자원 제작, 고급 강화 재료, 하이잭 Phase 1/HP 보존/영토 HIJACK 버튼 연결 수정
- 내 영토 금색 하이라이트 (compositeClaimsOnTexture)
- 하이젝 auto_win 후 영토 즉시 금색 반영 (Railway 레이턴시 우회)

### ✅ v5.31 (2026-04-29) 완료

1. ✅ **타이탄/배틀십 Core/Mid 전용 재료**: Migration 163 시드 + Migration 203 강화. BS/Titan 6/6 모두 Core 전용(`exotic_alloy`/`dark_matter`/`quantum_core`)과 Mid 전용(`titanium_alloy`/`plasma_crystal`/`nano_polymer`) 광물을 둘 다 포함하도록 invariant assertion으로 보장. fsp_titan에 nano_polymer 추가, 모든 BS의 exotic_alloy 최소치 3 통일. admin settings 5종 시드.
2. ✅ **DB 스모크 테스트**: `server/tools/smoke_capital_recipes.js` (11/11 pass). `ship.startBuild` (mcc_bs/mcc_titan recipe 차감 검증), `resourceCraft.startCraft` (hull_plate/plasma_coil), `hijack` 서비스 export·`hijack_battles` 스키마, Migration 203 invariant 직접 검증.
3. ✅ **Phase C 죽은 하이잭 모달 정리**: `index.html`의 `hijackModal` HTML(31줄) + `openHijackModal/closeHijack/confirmHijack` 함수 삭제 (도달 불가능 dead code). `/api/hijack/declare` 410 응답 메시지에 alternatives(territory/AI duel/tournament) 명시. `phaseC.js`+`services/hijack.js` 라우트 정리 주석 동기화.

### 🔴 다음 작업

(현재 비어 있음 — 다음 우선순위 작업이 정해지면 여기에 추가)

---

## 9. 주요 기존 서비스 파일 역할 요약

| 파일 | 역할 |
|------|------|
| `services/season.js` | 시즌 점수 추적 — addSeasonScore(wallet, category, amount) |
| `services/battle.js` | 구버전 픽셀 전투 (Migration 026기반) — fleet battle과 다름 |
| `services/siege.js` | 섹터 거버너 공성전 (Migration 085) |
| `services/ship.js` | 구버전 단순 함선 건조 (archived migrations 기반) — fleet ship과 다름 |
| `services/gpBurn.js` | GP 소각 메커니즘 |
| `services/guild.js` | 길드 시스템 |
| `services/marketplace.js` | 아이템 마켓플레이스 |
| `services/enhancement.js` | 아이템 강화 시스템 |
| `services/achievement.js` | 업적 시스템 |
| `services/daily.js` | 일일 미션 |
| `services/lottery.js` | 복권 시스템 |
| `services/profile.js` | 유저 프로필 (motto, avatar) |
| `services/tdesc.js` | 영토 설명 (GP 비용) |
| `services/capsule.js` | 타임캡슐 (GP 비용) |
| `services/sponsor.js` | 영토 스폰서 (GP 비용) |

---

## 10. index.html 구조 (35k줄 단일 파일)

> ⚠️ **절대 파일 분리 시도 금지** — 너무 복잡하게 얽혀있어 깨질 위험이 높음
> 섹션 검색: `Ctrl+F` 또는 grep으로 아래 키워드 찾기

| 섹션 | 찾는 방법 |
|------|-----------|
| CSS 변수 / 테마 | `:root{` |
| 전역 컴포넌트 CSS | `/* BASE MODAL` 또는 `/* TERRITORY` |
| HTML 구조 시작 | `<body>` |
| 지구본 초기화 | `initGlobe(` |
| BASE 모달 탭들 | `baseTabTerritory\|baseTabQuests\|baseTabShop` |
| 영토 정보 패널 | `showTerritoryInfo(` |
| GP 관련 함수 | `loadGPBalance\|refreshGP` |
| i18n 번역 | `const i18n = {` (EN/KO/JA/ZH) |
| 인게임 확인 모달 | `id="gameConfirm"` (HTML) / `function gameConfirm(` (JS, ~line 26442) |
| 인게임 입력 모달 | `id="gameInput"` (HTML) / `function gameInput(` (JS, ~line 26481) |
| 쇼핑 확인 모달 | `id="shopConfirmModal"` — gameConfirm 이전 버전, 쇼핑 탭 한정 사용 |
| WebSocket 없음 | polling 방식 — `setInterval` + `fetch('/api/...')` |

---

## 11. 설정값 (fleet 카테고리) — settings 테이블

```
fleet_combat_enabled       = true   ← 2026-04-26 활성화 완료
max_fleets_per_player      = 5
max_ships_per_fleet        = 1000
max_ships_per_player       = 200
faction_change_cooldown_hours = 168
faction_change_fee_gp      = 500
flagship_required          = true
battle_max_concurrent      = 3
battle_tick_rate_ms        = 200
hijack_phase1_duration_seconds = 300
hijack_phase1_ships_max    = 20
ship_repair_enabled        = true
shield_enabled             = true
vip_enabled                = true
```

---

## 12. Git 상태 & 커밋 규칙

- **마이그레이션 적용 후 반드시 커밋 & 푸시**
- 커밋 메시지 형식: `Migration XXX: 기능명` 또는 `feat: 기능명`
- Branch: `main`

---

## 13. 알려진 이슈 (2026-04-28 최신 업데이트)

### ✅ 최근 수정됨 (migration 176~179, commits 62fb37f ~ 164d2ff)
- **로켓드롭 트리거 403** — `commander_wallet` 조회 위치 fix (`game_settings` → `commander` 테이블).
- **`game_settings` 테이블 부재** — migration 176으로 `settings`→`game_settings` 호환 VIEW.
- **`users.wallet` 컬럼 오타** — 18개 GP 서비스가 `WHERE wallet=$1` 사용. 모두 `wallet_address`로 일괄 수정.
- **GP 감사 로그 부재** — migration 177로 `gp_transactions` + `gp_activity_log` + `colony_prestige` + `prestige_log` 생성. 30+ 서비스의 silent 실패 복구.
- **NPC 스타터팩 일괄 지급 UI 없음** — admin.html에 버튼 추가.
- **admin.js JSONB UPDATE 일괄 fix** — 25곳 `::jsonb` 캐스트 + 38곳 `JSON.stringify(value)`.
- **dead 서비스 4개 정리** — weeklyChallenges, gpBurn, bounty, luckyBox (테이블 + UI 둘 다 없음). service + route + scheduler 일괄 삭제.
- **phantom 인벤토리 참조 정정** — auction(`user_resources`→`user_resource_inventory`+`resources` JOIN), worldEvents(`user_minerals`→`user_resource_inventory`), tombstone(`hijack_log`→`hijack_battles`).
- **Migration 178: phantom 테이블 30개 일괄 생성** — branding, tdesc, monuments, expedition, contest, tiers, staking, spells, polls, capsule, wager, tevt, status, sponsor, shield, raffle, donation, crafting, broadcasts, beacon (총 20 라이브 기능 복구).
- **`gp_balances` → `users.gp_balance` 패치** — 6개 서비스 (branding, contest, expedition, spells, crafting, broadcasts).
- **Migration 179: 잔여 phantom 테이블** — lottery_rounds/tickets, gp_dividend_pool/claims, planet_news (3 라이브 기능 복구).

→ **2026-04-25 시점, 코드베이스에 알려진 phantom 테이블 참조는 모두 해소됨.**

### ✅ 해소 완료 (심화 작업 완료)
- **battle.js fragmentation 제거** — UI + 라우트 + 서비스 + 스케줄러 일괄 삭제. PVP는 fleet_battles + Hijack로 통합.
- **betting v1 → warBetting v2 통합** — 단일 시스템 (호환 endpoint 추가됨).
- **achievements auto-trigger 와이어링** — claim/battle/marketplace/ship/guild/signup 이벤트마다 자동 unlock.
- **38개 카테고리 settings 시드** — admin이 모든 라이브 기능 조정 가능 (No Hardcoding 100%).
- **레이어드 아키텍처 명확화** — chronicle/title/enhancement는 의도된 base+extension 구조.
- **v5.12 핵심 루프 단절 수정** — 영토 정보 HIJACK 버튼을 `/api/hijack/declare-with-pp` 플로우로 연결, hijack phase1 소형함 필터와 HP 반영 수정, resource_id 기반 인벤토리 일관화.

### 🔴 남아있는 알려진 이슈

#### A. 라우트 명명 혼동 (양쪽 실사용 — 그대로 유지, 문서화)
| 페어 | 책임 |
|---|---|
| `routes/job.js` vs `routes/jobs.js` | job=user 직업 ops + admin / jobs=catalog + select |
| `routes/resource.js` vs `routes/resources.js` | resource=admin + rate / resources=user catalog |
| `routes/auction.js` vs `routes/auctionRoutes.js` | auction=거래 ops (declare/bid) / auctionRoutes=목록 (`/api/auctions`) |
| `services/tournament.js` vs `services/tournaments.js` | tournament=fleet 토너먼트 (phaseC) / tournaments=단순 GP entry-fee |

#### B. 의도된 레이어드 아키텍처 (병합 불필요)
모두 base + extension 패턴:
| 페어 | 역할 |
|---|---|
| `services/chronicle.js` + `chronicleEnhanced.js` | base 이벤트 + Discord/특수 이벤트 wrapper |
| `services/title.js` + `titleExtended.js` | 기본 13종 타이틀 + 확장 11종 |
| `services/enhancement.js` + `enhancementAdvanced.js` | 인스턴싱 ops + 레시피 보너스 |

#### C. 기타 메모
1. `server/routes/ships.js` — **신** fleet 시스템. `/api/ships/blueprints`, `/api/ships/my`, `/api/ships/build` 정상 동작. 폐기 대상 아님.
2. `server/migrations/archived/` — 89~139번 구버전. 건드리지 말 것.
3. settings.value는 JSONB — 문자열은 `'"text"'`, 점 포함 버전은 `'"1.0.0"'`으로 감싸야 함.
4. 로컬 테스트 유저: `0xlainworld000000000000000000000000000000`.
5. `idx_users_referred_by` 인덱스 존재 — referral COUNT(*) 쿼리 최적화됨.
6. 새 fleet UI 진입점: `openShipyard()` (조선소), `openFleetCmd()` (함대 관리).
7. **함대전 시스템 동작 흐름**: hijack 선언 → fleet_battles 생성 → battleScheduler.runBattle() → battleEngine 시뮬 → WS 8x 스트리밍 → applyBattleResults (HP 반영, hijack=함선보존) → battleRewards.
8. **forfeit endpoint**: `POST /api/battles/:id/forfeit` — 공격자(atk)만 가능. preparing이면 즉시 취소(winner=def), 이미 ended면 OK 반환. HP는 applyBattleResults에서 이미 적용됨.
9. **네이티브 다이얼로그**: 전면 제거 완료 (2026-04-28). confirm/prompt/alert 0곳. §18 참조.

#### D. 2026-04-28 신규 추가 (resolve됨)
- **브라우저 confirm() 전면 제거** — `index.html` 15곳 `gameConfirm()`, `admin.html` 70곳 `adminConfirm()`, tactical-lab `#forfeit-overlay`로 교체.
- **HP바 실시간 감소 안 됨** — WS frame에 `maxHp`+`side` 추가, 첫 프레임에서 atkMaxHP/defMaxHP 재보정 (`_wsMaxHpCalibrated`).
- **내 함대/적 함대 혼동** — `loadBvSidePanels` participants 배열 기반 wallet 비교로 수정.
- **전투 타임아웃 HP 비율 승자** — MAX_TICKS=54000, 타임아웃=draw로 변경.

---

## 14. 서비스 카탈로그 (현재 상태)

### 🟢 동작 확인된 핵심 시스템 (수정 우선순위 ↑)
| 서비스 | 라우트 | 비고 |
|---|---|---|
| `hijack.js` | `routes/api.js` (`/api/hijack/*`) | 최근 다수 fix (commits 8d2148b, c2d35c8, 240ae43). 정상. |
| `fleet.js` | `routes/fleets.js` | fleet_combat_enabled 게이트. 함선 22종 정의됨. |
| `siege.js` | `routes/siege.js` | 섹터 거버너 공성전 |
| `governance.js` | `routes/governance.js` | 커맨더/거버너/세금 (`commander` 테이블 사용) |
| `season.js` | (서비스 직접 호출) | 시즌 점수 — `addSeasonScore()` 모든 서비스에서 fire-and-forget |
| `weather.js` | `routes/weatherRoutes.js` | migration 174로 strategic columns 추가됨 |
| `guild.js` | `routes/api.js` | commit 6bbc166으로 레벨업 + 수송 동작 복구 |
| `transport.js` | `routes/transport.js` | 수송 시스템 |
| `daily.js` | `routes/api.js` | 일일 미션 — settings에 daily_mission_* 키 |
| `marketplace.js` | `routes/marketplace.js` | 아이템 마켓 |
| `enhancement.js` | `routes/api.js` | 아이템 강화 |
| `auction.js` | `routes/auctionRoutes.js` | ✅ user_resources → user_resource_inventory + resources JOIN (commit 601757a) |
| `rocket.js` | `routes/api.js` (`/api/rockets/*`) | 트리거 fix됨 (commit 62fb37f). 12h 자동 스케줄. |
| `vip.js` | `routes/vip.js` | migration 162 |
| `tprestige.js` | `routes/api.js` | territory_prestige 테이블 OK. wallet 컬럼 fix됨. |
| `prestige.js` | `routes/api.js` | colony_prestige 테이블 추가됨 (migration 177). wallet 컬럼 fix됨. |
| `siegeFleetBridge.js` | (스케줄러) | siege와 fleet 연계 |
| `aiFleetManager.js` | (NPC 함대 관리) | commit a84e7dc로 SAVEPOINT 추가됨 |

### 🟡 부분 동작 (정리 필요)
| 서비스 | 상태 |
|---|---|
| `worldEvents.js` | ✅ user_minerals → user_resource_inventory 정정 (commit 601757a) |
| `battle.js` | 구버전 픽셀 전투. battle_ships phantom 참조 — fleet battle 활성화 후 정리 |
| `ship.js` | 구버전 단순 함선. 새 fleet ship과 충돌 가능 |
| `tournament.js` vs `tournaments.js` | 두 파일 공존. tournaments.js는 phantom (`tournament_entries`) — 정리 필요 |

### 🔴 잔여 phantom (소수, §13.A 참조)
§13.A 표 참조. 모두 둘 중 하나로 처리 필요:
- (a) 누락 테이블 마이그레이션 추가 → 기능 활성화
- (b) 서비스 파일 + 라우트 마운트 + 스케줄러 등록 일괄 삭제 → 코드베이스 정리

### 🔵 로깅/감사
- `gp_activity_log` (db.js의 logGPActivity) — migration 177로 생성됨
- `gp_transactions` (서비스 직접 INSERT) — migration 177로 생성됨, 컬럼명 양쪽 호환
- 같은 GP 활동을 두 테이블에 중복 기록함. 정리 필요(향후).

---

## 15. 라우트 카탈로그 (61개)

`server/index.js`에서 mount되는 prefix는 모두 `/api`(단일 파일 admin.js만 `/admin/api`).

```
api.js              ← 메인 통합 라우트 (가장 큰 파일, 다수 도메인)
admin.js            ← 어드민 패널 (단일 파일, 5000줄+)
adminEconomyRoutes  ← 경제 밸런스 어드민 (migration 173 추가)
auth.js             ← JWT 로그인/회원가입
fleets/fleetBattles/fleetSearch  ← Fleet Combat
factions/factionRoutes ← 파벌
governance/commanderActions  ← 거버너/커맨더
sectors             ← 섹터 정보
hallOfFameRoutes    ← 명예의 전당
weatherRoutes       ← 날씨/재해
warBettingRoutes    ← 전쟁 베팅
publicRoutes/public ← 비-로그인 통계
territoryRoutes     ← 영토 (claim과 별개)
onboarding/onboardingRoutes ← 온보딩
phaseC/phaseD       ← 길드전 페이즈
... (총 61개)
```

⚠ **공존하는 동명/유사 라우트 정리 필요**: `auction.js` vs `auctionRoutes.js`, `factions.js` vs `factionRoutes.js`, `public.js` vs `publicRoutes.js`, `onboarding.js` vs `onboardingRoutes.js`, `territoryRoutes.js` vs api.js의 territory 핸들러.

---

## 16. 마이그레이션 누적 인덱스 (001~203)

| 범위 | 주제 |
|---|---|
| 001~050 | 초기 스키마 (users, claims, pixels, settings, GP/PP) |
| 051~080 | 게임 시스템 (battle, sector, governance, weather, hijack) |
| 081~110 | 어드민/통계/시즌/cosmetic |
| 111~140 | (대부분 archived) — 폐기된 미니게임/실험 |
| 141~160 | Fleet Combat 기반 (factions, ship_types, fleets, ships) |
| 161~170 | VIP / 광물 tier / NPC / 트리거 fix |
| 171~177 | 최근 fix 패키지 (cantina, prestige, economy balance, weather strategic, hijack target_claim, game_settings view, phantom tables) |
| 178~191 | phantom 테이블 정리, settings 시드, achievements/profile/governance/rank/rocket/poi/AI strategy/hijack target nullable |
| 192~202 | Campaign chapters (MCC Ch1~10, FSP Ch1~10, Prologue+CV seed), 인게임 버그 리포트 |
| 203 | Capital ship Core/Mid material gate (BS/Titan invariant + admin settings) |
| `archived/` | 89~139번 구버전 — **건드리지 말 것** |

새 마이그레이션 작성 규칙:
1. 파일명: `NNN_short_name.sql` (NNN = 204부터 시작)
2. `INSERT INTO schema_migrations (filename) VALUES (...) ON CONFLICT DO NOTHING;` 마지막에 추가
3. settings INSERT는 `(key)`만 ON CONFLICT, `(category, key)` 복합 아님
4. JSONB value: 문자열은 `'"text"'`, 숫자는 `'42'`, 불린은 `'true'`/`'false'`, 점이 있는 버전은 `'"1.0.0"'`

---

## 17. Sub-agent 사용 원칙 (Advisor 패턴)

> **컨셉**: 메인 모델(작업자)이 직접 실행하고, 막히는 순간에만 더 큰 모델(어드바이저)에게 판단을 escalation. 큰 모델은 방향만 잡고, 작업은 메인이 한다.

### 메인이 직접 처리 (sub-agent 부르지 말 것)
- 단일 파일 편집 (Edit/Write)
- 명령 실행 (Bash 단발성: psql 쿼리, git status, npm run 등)
- 알려진 경로 파일 읽기 (Read with known path)
- 특정 심볼/문자열 grep
- 한 두 개 파일에 국한된 버그 픽스

### 반드시 sub-agent로 위임
| 상황 | Agent 타입 | 모델 |
|---|---|---|
| 3개 이상 파일에 걸친 설계 변경 | `Plan` | opus |
| 마이그레이션 순서·의존성 판단 | `Plan` | opus |
| "어떻게 할지 모르겠는" 디버깅 — 30초 이상 막힘 | `Plan` 또는 `general-purpose` | opus |
| 코드베이스 광범위 탐색 ("이 기능 어디 있어?") | `Explore` | (기본) |
| 모르는 라우트/서비스 동작 추적 | `Explore` (thoroughness: medium) | (기본) |
| 보안·아키텍처 second opinion 필요 | `general-purpose` | opus |
| 독립적인 병렬 작업 (서로 영향 X) | 단일 메시지에 여러 Agent 동시 호출 | (작업별) |

### 호출 규칙
1. **Plan/Advisor agent는 "방향만" 받는다** — 실제 코드 수정은 메인이 한다.
2. **Explore agent는 보고만 받는다** — 응답 길이 200~500단어로 제한 요청.
3. **prompt는 self-contained** — 대화 맥락 없이도 이해 가능하게 파일 경로·이슈·목표 명시.
4. **메인 모델은 Sonnet 유지** — Opus는 sub-agent로만 호출 (비용 효율).

### 안티패턴
- ❌ 단순 파일 1개 수정에 Plan agent 호출 (오버킬)
- ❌ Plan agent에게 "분석한 후 수정까지 해줘" 위임 (이해를 위임하지 말 것)
- ❌ Explore agent로 이미 경로 아는 파일 읽기 (Read 직접 쓰기)
- ❌ Sub-agent 결과를 그대로 사용자에게 전달 (메인이 검증·요약)

---

## 18. UI 모달 패턴 — 네이티브 다이얼로그 대체 규칙

> ⚠️ `confirm()` / `prompt()` / `alert()` 절대 사용 금지. 항상 아래 인게임 모달 사용.

### index.html — 사용 가능한 모달 함수

#### ① gameConfirm (확인/취소)
```javascript
// Promise 반환 — async 함수에서 await 필수
const ok = await gameConfirm({
  icon: '⚔',           // 이모지
  title: '전투 선언',   // 제목 (대문자 권장)
  body: '선언 후 전술 지시를 선택합니다.',  // HTML 가능
  confirmText: '선언',  // 확인 버튼 텍스트 (기본: CONFIRM)
  // info: [{k:'비용', v:'500 GP', insufficient: false}]  // 옵션: 비용 테이블
  // disabled: true  // 옵션: 확인 버튼 비활성
});
if (!ok) return;
```

#### ② gameInput (텍스트 입력, prompt 대체)
```javascript
const name = await gameInput({
  title: '함대 이름',
  label: '이름을 입력하세요',
  placeholder: '예: 1함대',
  defaultValue: '',     // 선택
  maxLength: 60,
});
if (name === null || name === undefined) return; // 취소
```

#### ③ shopConfirm (쇼핑 전용 — 신규 코드에서는 gameConfirm 사용)
```javascript
// 기존 쇼핑 탭에서만 사용. 신규 코드는 gameConfirm 사용할 것.
const ok = await shopConfirm(icon, title, msgHTML, btnText);
```

### admin.html — 사용 가능한 모달 함수

#### ① adminConfirm (확인/취소)
```javascript
// Promise 반환 — async 함수에서 await 필수
async function doSomething(id) {
  if (!await adminConfirm('Delete item #' + id + '?', 'DELETE')) return;
  // ... 실제 작업
}
// 두 번째 인자 title 생략 시 'CONFIRM'
```

> ✅ `admin.html` `prompt()` / `alert()` 전부 제거 완료 (2026-04-28). `adminInput()` + `showToast()` 구현됨.

### assets/tactical-lab-v11.html — 독립 iframe

tactical-lab은 iframe으로 실행되므로 부모의 `gameConfirm`에 접근 불가. 인라인 오버레이 방식 사용:
```javascript
// 오버레이 표시 (CSS id="forfeit-overlay")
function cmdForfeit() {
  document.getElementById('forfeit-overlay').classList.add('on');
}
function closeForfeitOverlay() {
  document.getElementById('forfeit-overlay').classList.remove('on');
}
async function confirmForfeit() {
  closeForfeitOverlay();
  // ... 실제 작업
}
// 새 확인 팝업 필요 시 동일 패턴으로 별도 오버레이 추가
```

부모(index.html)와 통신은 postMessage:
```javascript
window.parent.postMessage({ source:'tactical-lab', battleId, cmd:'forfeit', payload:d }, '*');
// 부모에서: window.addEventListener('message', function(e) { if (e.data.cmd==='forfeit') ... })
```

---

*이 문서는 새 Claude Code 세션이 컨텍스트 없이도 즉시 작업을 이어갈 수 있도록 작성됐습니다.*
*상세 히스토리가 필요하면 git log 또는 server/migrations/ 파일 순서를 참고하세요.*
