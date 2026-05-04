# OCCUPY MARS — Fleet Assault Combat Design

기획서 v0.3 · Star Fox: Assault 리서치 기반 · 2026-05-02

## 0. 목표

현재 OCCUPY MARS 함대전은 전술 데이터와 경제 보상은 있는데, “내가 전투 한가운데 있다”는 감각이 약하다. 목표는 Star Fox: Assault의 좋은 부분을 그대로 베끼는 것이 아니라, 그 전투 감각을 OCCUPY MARS의 강점인 함대 지휘, 영토 전쟁, 경제 시스템에 맞게 번역하는 것이다.

최종 목표는 하나의 전투를 두 레이어로 플레이하게 만드는 것이다.

- `FLEET MODE`: 함대 전체를 지휘하는 전략/전술 레이어
- `ACE MODE`: 플레이어 기체 1기를 직접 조종하는 액션 레이어
- 두 모드는 같은 전장 상태를 공유하고, `TAB`으로 즉시 전환한다.

## 1. Star Fox: Assault 리서치 요약

Star Fox: Assault는 세 가지 플레이 타입을 가진다: Arwing 비행, Landmaster 탱크, 도보 3인칭 슈터. Arwing 미션은 우주 또는 지표 가까이에서 적을 격추하는 구조이며, 일부는 온레일, 일부는 제한된 공간에서 자유 이동하는 올레인지 전투다. 동료들이 적에게 쫓기며 구조 요청을 하는 상황도 핵심 흐름이다.

OCCUPY MARS에 그대로 가져올 요소:

- 후방 3인칭 비행 카메라
- 전방 원거리에서 접근하는 적 편대
- 락온/차지샷/버스트샷 중심의 슈팅
- 동료/윙맨 구조 요청
- 전투 중 통신 대사
- 작은 전장 안에서 다수 적을 처리하는 올레인지 감각
- 특정 순간 직접 개입하면 전황이 바뀌는 구조

OCCUPY MARS에 그대로 가져오면 안 되는 요소:

- 도보 슈터/탱크를 그대로 넣기
- 캐릭터 IP/기체 실루엣 복제
- 단순 아케이드 점수전으로 축소
- 함대전 경제/영토 전쟁과 분리된 미니게임화

## 2. OCCUPY MARS 번역 원칙

Star Fox: Assault의 “Arwing/Landmaster/On-foot 전환”은 OCCUPY MARS에서는 “Fleet/Ace 전환”으로 번역한다.

| Star Fox: Assault 요소 | OCCUPY MARS 번역 |
|---|---|
| Arwing 직접 조종 | `ACE MODE`: 플레이어 에이스 기체 직접 조작 |
| Wingmates 구조 | 아군 크루저/수송선/윙맨 보호 이벤트 |
| On-rails 구간 | 캠페인 시네마틱 전투/침공 루트 |
| All-range 구간 | PvP/하이잭 함대전 직접 개입 구간 |
| Landmaster/도보 전환 | `FLEET MODE`: 함대 전술 지휘 |
| Charge/Lock-on | 에이스 락온, 차지 버스트, 미사일 포드 |
| Mission dialogue | 파벌별 실시간 전투 대사 |
| Formation bonus | 함대 대형/모멘텀 보너스 |

핵심은 “한 명의 파일럿 액션”과 “함대 지휘”를 같은 전장에 묶는 것이다. 에이스 모드가 미니게임이면 안 된다. 에이스 행동은 함대 전투 결과에 직접 영향을 줘야 한다.

## 3. 전투 모드 구조

### 3.1 전투 시작

전투는 항상 `FLEET MODE`로 시작한다.

플레이어는 먼저 다음을 본다.

- 아군/적 함대 배치
- 전장 크기와 충돌 방향
- 현재 대형
- 모멘텀 게이지
- 집중 타겟
- 보호 대상
- 에이스 출격 가능 여부

이후 플레이어가 직접 개입하고 싶을 때 `TAB`으로 `ACE MODE`에 들어간다.

### 3.2 FLEET MODE

시점:

- 탑뷰 + 살짝 기울어진 전술 카메라
- 전체 전장 파악이 우선
- 함선은 아이콘/간단한 3D 실루엣으로 표시
- 대형 고스트를 보여줘서 “내 함대가 어떤 모양으로 움직이는지” 즉시 이해 가능

주요 입력:

- `1`: Vanguard
- `2`: Pincer
- `3`: Screen
- `4`: Wolfpack
- `5`: Spearhead
- 적 함선 클릭: 집중 타겟 지정
- 아군 함선 클릭: 선택/능력 사용
- `TAB`: Ace Mode 전환

FLEET MODE에서 플레이어는 “전략적 우위”를 만든다. 적절한 대형과 타겟 지정이 전투 전체의 DPS, 생존율, 모멘텀에 영향을 준다.

### 3.3 ACE MODE

시점:

- 플레이어 기체가 화면 오른쪽 아래 또는 하단 중앙에 크게 보이는 후방 3/4 카메라
- 조준점은 화면 중앙보다 약간 위
- 적 편대는 전방 원거리에서 접근
- 화성 표면 전투라면 배경은 우주가 아니라 성층권 고도: 붉은 지평선, 먼지층, 얇은 대기광, 지표 곡률
- 카메라 흔들림은 기본 OFF. 피격/폭발 때만 짧게 사용

주요 입력:

- 이동: 마우스/터치 드래그 또는 WASD
- 발사: 클릭/스페이스
- 락온: 누르고 있기
- 차지샷: 락온 유지 후 발사
- 회피: 더블탭 또는 버튼
- `TAB`: Fleet Mode 복귀

ACE MODE에서 플레이어는 “전술적 개입”을 한다. 특정 적의 엔진, 실드, 미사일 포드, 추격기 등을 직접 처리해 함대의 불리한 상황을 뒤집는다.

## 4. 화면 구성

### 4.1 ACE MODE 레이아웃

```
┌────────────────────────────────────┐
│ OCCUPY MARS            0044 HIT     │
│                                    │
│      적 편대 / 락온 박스             │
│              □                     │
│                                    │
│                       내 기체        │
│                  후방 3/4 대형 표시  │
│                                    │
│ SHIELD       통신창 / 명령 버튼       │
└────────────────────────────────────┘
```

필수 시각 요소:

- 플레이어 기체는 “한 대만 먼저 제대로” 만든다.
- 기체는 단순 삼각형이 아니라 노즈, 캐노피, 좌우 주익, 후방 엔진 노즐이 보여야 한다.
- 적기는 작고 멀리 있다가 접근하며 커져야 한다.
- 레이저는 플레이어 기체에서 조준점으로 뻗는다.
- 락온 대상은 사각형/코너 브래킷으로 표시한다.
- 통신창은 하단 중앙, 체력/실드는 좌하단, 명령 버튼은 하단 우측 또는 하단 중앙.

### 4.2 FLEET MODE 레이아웃

```
┌────────────────────────────────────┐
│ FLEET MODE / TAB -> ACE             │
│ Formation: Spearhead                │
│ Momentum: ███████░░ 72%             │
│                                    │
│       아군 대형 → 집중 타겟 → 적 전열 │
│                                    │
│ 대형 버튼 / 타겟 / 특수능력           │
└────────────────────────────────────┘
```

필수 시각 요소:

- 대형 고스트
- 선택 함대 하이라이트
- 집중 타겟 라인
- 모멘텀 게이지
- 에이스 개입 가능한 위험 포인트 표시
- 전장 좌표는 Ace Mode와 공유

## 5. 전투 리듬

### 5.1 기본 루프

1. FLEET MODE에서 대형 선택
2. 함대가 자동 교전
3. 위험 이벤트 발생
4. ACE MODE로 전환
5. 직접 적 약점/추격기/미사일 제거
6. FLEET MODE로 복귀
7. 모멘텀 상승 또는 적 디버프 적용
8. 함대가 전황을 밀어붙임

### 5.2 위험 이벤트

위험 이벤트는 ACE MODE 전환의 이유를 만든다.

| 이벤트 | ACE 목표 | 성공 효과 |
|---|---|---|
| 아군 크루저 추격 | 추격기 3기 격추 | 크루저 수리 속도 2배 |
| 적 배틀십 주포 충전 | 주포 모듈 파괴 | 적 대형 DPS -20% |
| 적 기함 실드 노출 | 실드 노드 락온 파괴 | 아군 집중 타격 가능 |
| 미사일 포화 | 미사일 요격 | 아군 피해 방지 |
| EW 재머 출현 | 재머 제거 | 아군 명중률 복구 |

## 6. 함대/에이스 연동 규칙

| ACE 행동 | FLEET 결과 |
|---|---|
| 적 에이스 격추 | 적 모멘텀 -15 |
| 적 기함 실드 노드 파괴 | 30초간 집중 타격 피해 +20% |
| 적 배틀십 엔진 파괴 | 해당 함선 이동/회피 불가 |
| 아군 크루저 보호 | 아군 회복량 2배 |
| 미사일 요격 성공 | 해당 tick 광역 피해 무효 |
| 에이스 피격 누적 | 아군 모멘텀 -10 |
| 에이스 격추 | 아군 모멘텀 -30, ACE 잠금 60초 |

## 7. 카메라/비주얼 규칙

### 7.1 ACE 카메라

- 기본 카메라는 플레이어 기체 뒤/오른쪽 3/4 위치
- 기체가 화면 55~70% 아래, 58~78% 오른쪽에 걸친다.
- 조준점은 화면 중앙보다 위쪽
- 카메라 흔들림은 평상시 금지
- 피격/근접 폭발 때만 0.15초 이하로 짧게 흔든다.
- 성층권 배경은 고정된 큰 행성이 아니라 낮은 지평선/먼지층/얇은 대기광으로 처리한다.

### 7.2 기체 실루엣

1차 목표는 “기체 한 대”를 제대로 만드는 것이다.

기체 구성:

- 긴 노즈
- 캐노피
- 좌우 주익
- 후방 엔진 2기
- 엔진 글로우
- 상하 명암으로 3D 볼륨
- 화면 오른쪽 아래 후방 3/4 시점

금지:

- 종이비행기 같은 평면 삼각형
- 모든 함선이 옆으로 누운 실루엣
- 아군/적군 같은 모양에 색만 변경
- 화면을 가리는 과도한 UI

## 8. 구현 단계

### Phase A — Combat Feel Prototype

목표: 한 대의 에이스 기체가 스타폭스 어설트식으로 보이는지 검증.

범위:

- `assets/fleet-assault-demo.html`
- ACE MODE만 우선
- 플레이어 기체 1대 퀄리티 확보
- 적기 3~5대 접근
- 락온/레이저/버스트
- 화성 성층권 배경
- 통신창/HIT/SHIELD HUD

완료 기준:

- 스크린샷만 봐도 “후방 3인칭 비행 슈터”로 보인다.
- 플레이어 기체가 조잡한 삼각형으로 보이지 않는다.
- 적기가 원근으로 다가오는 것이 보인다.
- UI 없이도 전투 방향을 이해할 수 있다.

### Phase B — Fleet/Ace Dual Layer

목표: 같은 전장 데이터를 FLEET/ACE 두 방식으로 보여준다.

범위:

- TAB 전환
- FLEET MODE 탑뷰
- 대형 5종
- 집중 타겟
- 모멘텀
- ACE 성공/실패가 FLEET에 반영

완료 기준:

- FLEET MODE에서 전황을 이해할 수 있다.
- ACE MODE에서 직접 개입 이유가 보인다.
- TAB 전환이 게임 구조상 의미가 있다.

### Phase C — Existing Fleet Battle Integration

목표: 실제 `fleet_battles`와 연결.

범위:

- `GET /api/battle/:id/fleet-state`
- `POST /api/battle/:id/command`
- `POST /api/battle/:id/ace-action`
- WebSocket frame과 연동
- 기존 battleEngine 결과와 reconcile

완료 기준:

- 실제 전투 데이터로 데모가 동작한다.
- ACE 행동이 서버 이벤트로 기록된다.
- 전투 결과 보상 계산에 ACE 기여도가 반영된다.

## 9. 데이터 설계 초안

### `fleet_battle_commands`

```sql
battle_id
tick
wallet
mode              -- fleet | ace
command_type      -- formation | focus | ability | ace_action
payload_json
created_at
```

### `battle_momentum_log`

```sql
battle_id
tick
side              -- atk | def
momentum
reason
delta
created_at
```

### `ace_pilots`

```sql
wallet
pilot_name
faction
rank
ship_code
shield
hull
weapon_loadout_json
created_at
updated_at
```

### `ace_battle_events`

```sql
battle_id
tick
wallet
event_type        -- lock_on | module_destroyed | wingmate_saved | ace_down
target_id
effect_json
created_at
```

## 10. 다음 작업 지시

다음 개발은 기존 캔버스 데모를 억지로 살리지 말고 아래 순서로 진행한다.

1. `fleet-assault-demo.html`에서 적/윙맨 다 숨기고 플레이어 기체 한 대만 완성한다.
2. 기체가 만족스러워지면 적기 1대 추가.
3. 적기 원근 접근/락온/레이저만 구현.
4. 그 다음 편대/윙맨 추가.
5. 마지막에 FLEET MODE 붙인다.

이 순서를 지키지 않으면 다시 “많은 것이 있는데 전부 조잡한 화면”이 된다.

## Sources

- Star Fox Wiki, “Star Fox: Assault” gameplay overview: https://starfoxwiki.info/wiki/Star_Fox%3A_Assault
- Arwingpedia/Fandom, “Star Fox Assault” gameplay and control table: https://starfox.fandom.com/wiki/Star_Fox_Assault
- Arwingpedia/Fandom, “Charge” lock-on/charged shot behavior: https://starfox.fandom.com/wiki/Charge
- Giant Bomb Wiki, “Star Fox Assault” gameplay structure: https://giantbomb.com/wiki/Games/Star_Fox_Assault
- Wired review, notes on on-rails space action, enemy swarms, wingmate protection, and combat shortcomings: https://www.wired.com/2005/02/star-fox-assault-a-shaky-flight
