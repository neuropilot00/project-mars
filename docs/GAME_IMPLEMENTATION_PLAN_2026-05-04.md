# OCCUPY MARS — Concrete Implementation Plan

> Date: 2026-05-04
> Based on: `docs/GAME_DIRECTION_2026-05-04.md`
> Goal: 방향성 문서를 실제 개발 단위로 쪼개고, 캠페인/영토/함대/경제를 하나의 플레이 루프로 연결한다.

## 1. Development Rule

앞으로 새 기능은 아래 네 기둥 중 하나와 연결되어야 한다.

- Campaign: 플레이어에게 이유와 다음 목표를 준다.
- Territory: 소유, 표현, 생산, 영향력을 만든다.
- Fleet: 제작, 강화, 거래, 전투 자산이 된다.
- War/Economy: 전쟁과 시장이 서로 가격과 수요를 흔든다.

연결되지 않는 단발성 기능은 보류한다.

## 2. P1 — Campaign as Main Quest

캠페인을 새로 쓰지 않는다. 기존 챕터와 에셋을 유지하고, 실제 게임 행동과 연결한다.

### 2.1 Immediate Implementation

- 서버 `campaign` 서비스가 챕터별 `objectives`와 `nextObjective`를 내려준다.
- 프론트 캠페인 카드가 다음 할 일을 보여준다.
- 브리핑 모달에도 작전 목표를 표시한다.

### 2.2 Next Implementation

- objective 타입을 실제 시스템 데이터와 연결한다. (v5.71 시작)
- 현재 연결됨: claim count, territory image count, owned ship count, fleet count, fleet battle count, market listing count.
- objective action 동선 연결됨: territory, territory_art, shipyard, fleet, fleet_battle, market. (v5.73)
- 캠페인 에디터와 인게임 story stage 좌표계를 9:16 기준으로 통일했다. 저장한 캐릭터/대사박스 위치는 모바일에서도 같은 좌표계로 해석한다. (v5.74)
- 에디터 layout은 캐시가 남지 않도록 no-store/timestamp로 불러온다. (v5.74)
- 완료 hard gate 연결됨: 서버가 필수 DB 기반 objective 미달 시 완료/보상을 막고, 프론트는 `readyToComplete`가 true일 때만 자동 완료한다. (v5.75)
- 다음 연결 후보: territory production count, campaign reward claim count.
- ship upgrade count 연결됨: MCC CH3에서 함선 스탯 강화 1회를 실제 DB 로그 기반 objective로 요구한다. (v5.78)
- 완료 조건은 클라이언트가 아니라 서버가 판정한다. (v5.75부터 적용 시작)

### 2.3 Campaign Scope Control

하지 않는다:

- 전체 캠페인 재작성
- 모든 이미지 교체
- 모든 대사 재작성

한다:

- 기존 챕터 목표화
- 보상/잠금 해제 정리
- 실제 시스템 행동과 연결

## 3. P2 — Fleet Battle Feel

현재 세로 탑뷰 함대전 방향을 유지한다.

### 3.1 Required Feel

- 함대는 장거리 교전을 한다.
- 함선은 화면 밖으로 나가지 않는다.
- 함선은 공격 대상을 바라본다.
- 작은 전투는 크게 보이고, 큰 전투는 전체 전장이 보인다.
- 빔포/미사일/무전/사운드로 박력을 만든다.

### 3.2 Production Rule

`assets/fleet-assault-demo.html`과 `assets/tactical-lab-v11.html`은 계속 동기화한다.

## 4. P3 — Ship Economy

함선은 자산이어야 한다.

### 4.1 Shipyard

- 제작 가능/불가능은 재료 보유량으로 즉시 보여준다.
- 강화는 확률, 재료, GP, 실패 시 소모를 명확히 보여준다.
- 판매중 함선에는 스티커를 붙인다.
- 제작/강화가 막혀도 상세 모달은 열어 `보유 / 필요`와 부족 항목을 확인할 수 있어야 한다. 실행 버튼만 막는다. (v5.76)
- 인벤토리 resource code는 소문자로 정규화해 보유 재료가 UI에 누락되지 않게 한다. (v5.76)

### 4.2 Market

- 강화된 함선 판매가 핵심 재미다.
- 판매중 함선은 강화/해체/전투 편입 제한이 명확해야 한다.

## 5. P4 — Territory Utility

영토는 이미지 등록과 생산/전쟁/캠페인 조건을 연결한다.

### 5.1 Near-Term

- 캠페인 목표에 첫 영토 확보/확인 연결.
- 내 영토와 남의 영토 식별성 강화.
- 영토 이미지 등록을 캠페인 초반 과제로 연결.

### 5.2 Later

- 섹터 장악과 자원 생산량 연결.
- 영토 가치가 함선 제작 재료 흐름에 영향을 주게 한다.

## 6. First Sprint

### Sprint 1 목표

캠페인이 플레이어에게 다음 행동을 알려주는 상태로 만든다.

작업:

- `campaign.objectives` 서버 스키마 추가.
- 캠페인 카드 objective UI 추가.
- 캠페인 브리핑 objective UI 추가.
- 문서/오딧/체인지로그 업데이트.

성공 기준:

- 캠페인 리스트에서 진행 가능한 챕터의 다음 목표가 보인다.
- 완료 챕터는 계속 접혀 있다.
- 잠긴 챕터는 기존처럼 숨김/펼침 구조를 유지한다.

## 7. Second Sprint

목표:

캠페인 objective를 실제 게임 상태와 연결한다.

후보 objective:

- first_claim: 영토 1개 확보 (v5.71 연결)
- first_art: 영토 이미지 등록 (v5.72 연결)
- first_ship: 함선 1척 보유 (v5.71 연결)
- first_fleet: 함대 1개 구성 (v5.71 연결)
- first_battle: 함대전 1회 완료 (v5.72 연결)
- first_upgrade: 함선 스탯 강화 1회 (v5.78 연결)
- first_listing: 함선/자원 마켓 등록 1회 (v5.72 연결)

v5.71 구현 메모:

- `/api/campaign/status` 응답에 `objectiveState`를 내려준다.
- objective 항목은 `current`, `target`, `requirementMet`을 포함할 수 있다.
- 완료 hard gate는 아직 적용하지 않았다. 우선 플레이어가 무엇이 부족한지 알 수 있게 표시하고, 다음 단계에서 챕터별로 gate를 선별 적용한다.

v5.72 구현 메모:

- `artClaims`, `completedFleetBattles`, `marketListings`를 추가했다.
- MCC CH1은 영토 확보 뒤 이미지 등록까지 이어지게 했다.
- MCC CH3은 함대전과 마켓 등록을 처음으로 요구하는 중반 진입 지점으로 잡았다.

v5.73 구현 메모:

- objective의 `action` 값을 프론트 동선으로 연결했다.
- 영토/이미지 목표는 BASE 내 영토 탭, 함선 목표는 조선소, 함대 목표는 Fleet Command, 함대전 목표는 Battle Hub, 마켓 목표는 Market 탭으로 이동한다.
- 완료 objective와 story/result/choice 계열은 클릭하지 않는다.

v5.75 구현 메모:

- `/api/campaign/progress`는 현재 진행률뿐 아니라 objective 목록, 미달 objective, 다음 objective, `readyToComplete`를 내려준다.
- `/api/campaign/complete`는 `stat` 기반 필수 objective가 부족하면 완료/보상 처리를 막는다.
- 프론트는 진행률 100%만으로 완료하지 않는다. 시간이 끝났지만 목표가 남아 있으면 캠페인 모달 안에 남은 목표와 GO 동선을 보여준다.
- 현재 hard gate 대상은 실제 DB로 판정 가능한 objective다. story/choice/result 계열은 별도 UX 안정화 뒤 선별 gate한다.

v5.78 구현 메모:

- `shipUpgrades`를 objective state에 추가했다.
- `ship_stat_upgrade_log.success = true` 기준으로 성공 강화 횟수를 집계한다.
- v210 이전 DB처럼 `success` 컬럼이 없는 경우 기존 강화 로그 전체를 카운트해 운영 DB 버전 차이로 캠페인 상태가 터지지 않게 했다.
- MCC CH3의 흐름은 이제 `함대전 완료 -> 함선 강화 -> 마켓 등록 -> 결과 수령` 순서로 중반 경제 루프를 체험하게 한다.

## 8. Third Sprint

목표:

함대전과 함선 경제를 캠페인 보상/요구 조건과 연결한다.

작업:

- CH1~CH2 보상으로 재료/함선 제작 동기 부여.
- CH3~CH4에서 함대 지휘/전투 진입.
- 강화/마켓은 중반 캠페인에서 열리게 정리.

## 9. Risk

가장 큰 위험은 작업량 폭발이다.

대응:

- 새 콘텐츠 제작보다 기존 콘텐츠 연결을 우선한다.
- 실제 판정은 서버부터 만든다.
- UI는 목표를 보여주는 역할에 집중한다.
- 캠페인 리라이트는 마지막에 필요할 때만 한다.
