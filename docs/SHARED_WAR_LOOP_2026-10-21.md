# 공동 공성 작전 — 구현 및 검증 범위 (2026-10-21)

현재 체크아웃에서 **두 사람이 같은 전투의 각자 함대를 지휘하는 서버 경로는 기존에 있었다.** WebSocket 연결만으로 판단한 것이 아니다. 실제 엔진과 localhost WebSocket에 독립 더미 클라이언트 2개를 연결하여 각자의 명령이 적용되고, 상대의 기동·진형과 이동 좌표, 동일 전투 결과를 관측했다. 이번 변경은 여기에 일반 길드원 입장, 정확한 클라이언트 좌표 소비, 공동 결과 기록과 재건 진입을 연결한다. 대규모 MMO·운영 배포·실제 사람의 재미 검증 완료라는 뜻은 아니다.

작업 범위는 `/Users/jongho/Documents/Codex/2026-10-10/oc/work/occupy-upgrade`다. 기존 dirty 변경을 보존했다. `.env`, 운영 DB/계정, 메일, 지갑·키·자금·체인, 배포·push를 사용하지 않았다. 새 migration·보상 재화·통화 발행은 없다. 기존 `FEATURE_VERIFICATION.md`의 source/fixture/실제 운영 검증 구분을 따른다.

## 기존에 있던 부분과 이번 연결

| 구간 | 기존 source | 이번 변경 |
|---|---|---|
| 공동 목표·공격 시간 | `server/services/siege.js`: declareSiege/getSiegeSchedule, `266_siege_schedule.sql` | 기존 섹터 거버너 공성을 재사용한다. 선언 권한·비용·일정 규칙을 바꾸지 않았다. |
| 역할·참여 | `siege_fleet_commits`, migration263, `commitSiegeFleet` | 과거에는 대표자 또는 길드 leader/officer만 함대를 배치할 수 있었다. 이제 참전 길드 일반 member도 **자기 함대 1개**를 배치한다. 새 private `GET /api/siege/:siegeId/participation`으로 서버가 고른 진영·정원·참가 가능 여부를 반환한다. body의 공격/수비 선택을 신뢰하지 않는다. |
| 입장·결전 생성 | `siegeFleetBridge.createSiegeBattleMulti` → `fleet_battle_participants` | 같은 공성 row를 잠그고 이미 생성된 전투 ID를 재사용한다. 현재 함대 소유자·소속 진영·기존 점유·정원을 생성 직전에 재검증한다. 커밋/생성 시 membership row에 `FOR SHARE`, 공성·함대에 `FOR UPDATE`를 사용한다. 실제 PG 경합 실행은 이번 fixture 범위 밖이다. |
| 기여·상호 방해 | `battleEngine.simulateBattleLive`, `liveBattle`, `wsServer` | 기존 formation/maneuver/focus/충전 skill의 서버 명령 경로를 재사용한다. 새 전쟁 프레임워크나 클라이언트 점수 제출을 만들지 않았다. |
| 같은 전장의 표시 | `assets/tactical-lab-v11.html`의 frame consumer | 기존에는 함대 raw 좌표만 부분 반영하고 함선 x/y를 무시했으며 로컬 이동이 다시 덮어썼다. 기존 `objectiveMapPoint`로 서버1000×440 좌표를 canvas460×600에 대응시켜 함대·함선·격침 연출을 일치시킨다. battle 모드는 로컬 이동/무작위 발사/로컬 승패 결정을 중단한다. sandbox는 기존 시뮬레이션을 유지한다. 서버 전체 함선 스냅샷으로 미대응 가짜 hull을 숨기고 중도접속 시 필요한 시각 instance를 만든다. DB 함선을 생성하는 코드가 아니다. |
| 결과·세계 변화 | `battleScheduler` → `applyBattleResults` → `siegeFleetBridge.applySiegeResult` → `siege.resolveSiege` | 기존 거버너/sector_governance 결과 처리를 재사용한다. 새 `siege_resolved` Chronicle은 sector·winner side·battle/siege ID·기존 점유 수치만 기록한다. 새 기록에는 wallet/nickname/대화 원문을 전달하지 않는다. 기존의 수비 성공을 자기 자신을 몰아낸 것으로 쓰던 문구를 교정한다. |
| 결과 확인·다음 작전 | 기존 siege roster/viewer, command center의 fleet/front | 활성 공성이 사라진 뒤에도 최근 resolved siege를 불러와 결과·공동 전투 다시보기를 제공한다. 패자도 수리·재건 및 생산·운송으로 돌아갈 수 있다. private role 조회 실패는 Retry로 표시한다. |

실제 수정 source: `server/services/siege.js`, `server/services/siegeFleetBridge.js`, `server/routes/siege.js`, `assets/world-live-feeds.js`, `assets/tactical-lab-v11.html`. 기존 HTTP replay 회귀 도구 `server/tools/objective_replay_ui_regression.js`에는 새 좌표 소비 함수의 fixture 의존성(W/H/objectiveMapPoint)을 추가했다.

## 신입·집중 방지·손실 후 복귀

- 신입은 참전 길드 일반 member로 입장할 수 있다. 길드가 없거나 다른 길드면 참전 버튼을 표시하지 않고 가입/준비 역할을 안내한다. 함대가 없으면 건조·수리를 안내한다. 리더의 선언·통치 권한은 이 변경으로 주어지지 않는다.
- 기존 공성당 지갑별1함대 upsert와 진영당 정원(설정 기본20), 서버 소유권/참가자 검증, WS 초당3명령 및 권위 queue의 지갑별5명령 제한을 유지한다. 정원 추가 구매나 새 보상을 만들지 않았다. 이 규칙은 많은 hull/강한 hull 보유에 따른 우위를 제거하지 않으며, 여러 계정·고래 집중이 해결됐다고 주장하지 않는다.
- 합류 전에 기존 `gameConfirm`으로 현재 손실 규칙에 따른 손상·영구 파괴 가능성과 **전투 생성 이후 정산까지 다른 임무에 사용할 수 없음**을 명시한다. 취소하면 POST가 발생하지 않는다. 확인 UI를 사용할 수 없으면 동의 없이 합류하지 않는다.
- 생산/공동 창고/화물·약탈/수리 기능은 `server/services/frontierIndustry.js`와 `assets/command-center.js`에 이미 있다. 새 버튼은 그 실제 front/fleet 진입을 연결한다. **생산품이 이 공성의 전투 수치나 보급 버프를 올리는 연결은 만들지 않았다.** 별도 공동 경제의 보급·복구 활동을 직접 공성 버프로 설명하지 않는다. 새 외교/배신 시스템도 만들지 않았다.
- 입장 전에 탈퇴/진영 변경/함대 양도가 있었다면 결전 생성 검증이 이를 거부한다. 생성 후 참가 진영은 그 전투의 등록된 참가자로 고정된다. 탈퇴 후 모든 후속 서비스의 권한을 전수 검증한 것은 아니다.

## 동시 전투 판정에 사용한 source

1. **권위·룸**: `wsServer.js`는 battle ID별 channel을 가진다. `battleScheduler.runBattle`은 DB의 preparing→active 조건부 UPDATE로 작업을 획득하고 liveBattle.markActive 뒤 실제 엔진을 실행한다. 엔진에는 shouldAbort hook이 있으나 현재 scheduler live 호출은 그 hook을 전달하지 않는다. 다중 replica 장애·failover 검증은 없다.
2. **독립 플레이어 entity**: `battleEngine.loadBattleData`는 등록 participant별 owner_wallet·fleet·ships를 로드한다. `siegeFleetBridge`는 각 커밋을 같은 battle_id의 참가자로 등록한다. 좌표/진형/HP/명령은 fleet별이다.
3. **동기화·충돌·승패**: 200ms 시뮬 상수와 별도로 scheduler의 tick pacing을 받으며, 매 tick 명령을 drain하고 이동·진형·타격/데미지·퇴각·승패를 계산한다. frame은5tick마다 보낸다. 공격·거리 판정은 서버 엔진의 같은 상태를 사용한다. 이것은 클라이언트마다 따로 굴리는 전투 결과를 합치는 방식이 아니다.
4. **AOI·규모**: 현재는 해당 battle의 전체 함대/함선 frame을 모든 구독자에게 보낸다. 별도 거리 기반 AOI/sharding은 없다. WS 전체20000/IP당50은 접속 방어 설정값이며 실제 수용량 측정값이 아니다. 1MB 송신 버퍼에서 느린 socket을 종료한다. queue500/지갑별5명령·WS3명령 제한이 있다. 엔진은 진영별5개 spawn preset 이후 중앙 fallback을 쓰므로 많은 함대의 표시/밀집은 추가 검증이 필요하다.
5. **재접속·늦은 접속**: 클라이언트가 재접속하고 다음 전체 frame으로 현재 상태를 다시 받는다. 별도의 최근 frame/end 보관·즉시 snapshot replay·진행 중 새 함대 편입 프로토콜은 없다. 이 테스트의 재접속은 기존 참가자의 새 socket이다. 임의 신입 함대를 진행 중 전투에 넣은 것이 아니다.
6. **현재 기본값과 live 여부**: migration261은 guild_governance_enabled/siege_fleet_combat_enabled를 true로 활성화하고264는 siege_realtime_enabled=true/250ms/10분을 seed한다. scheduler의 설정이 없을 때 fallback은 false다. **현재 운영 설정을 조회하지 않았으므로 운영에서 live가 켜져 있다고 단정하지 않는다.** 비공성 fleet_realtime_mode의 기본은 ai이며 all/off 분기가 있다. 비공성 live는 동시성 포화 시 precompute/replay로 내려간다. siege는 별도 게이트이며 같은 포화 fallback 코드 분기를 타지 않는다. viewer는 실제 realtime frame을 받아야 live 명령을 연다. replay·관전·연결 끊김에서는 명령을 잠근다.

## 실행 증거

### 서비스·UI·좌표 소비 fixture

```sh
node --require ./server/tests/isolation-guard.cjs --test server/tests/shared-war.test.js server/tests/shared-war-ui.test.js server/tests/shared-battle-render.test.js
```

**27/27 통과, 실패0·skip0.** 기록: `work/shared-war-2026-10-21/focused-tests.tap`.

실제 서비스/브리지 함수를 fixture queryable로 실행하여 신입 일반 member 입장, 소속 진영, outsiders/정원/소유권/전투중/채굴/empty/기존 결전 차단, 단일 전투 생성·중복 재사용, 생성 전 소유/소속 변경 거부, 공격·수비·무승부의 기존 통치 결과와 aggregate Chronicle, 종료 후 재건 receipt를 확인했다. SQL 문자열 assertion만으로 합격시킨 검사가 아니다. 단, DB adapter는 명시적 메모리 fixture이며 PostgreSQL SQL 실행/실제 row-lock 경합·정산 원장 검증은 아니다.

UI는 실제 함수의 VM/DOM stub으로 한쪽 진영 버튼만 표시, 명시 동의 후 mutation, 취소 시 POST0, role 오류 Retry, 계정이 바뀐 늦은 응답 무시, 결과/replay/fleet/front 라우팅을 실행했다. 실제 client coordinate consumer는 맵 변환·HP·facing·없는 hull/late-join 시각 instance·로컬 drift 중단과 sandbox 경로를 확인했다.

### 실제 엔진 + 실제 localhost WS + 독립 클라이언트2개

```sh
node server/tools/shared_battle_clients_regression.js
```

**통과.** `work/shared-war-2026-10-21/ws-result.json`, `ws-clients.log`, `source-hashes.json`을 보존했다.

- 실제 `simulateBattleLive`, `liveBattle`, `wsServer`를 사용했다. 서로 다른 두 WebSocket 인스턴스가 같은 battle71에 연결됐다.
- alpha의 formation(screen), beta의 maneuver(flank)가 각자 실제 엔진 tick에 적용됐다. 양쪽 frame에서 두 변경이 함께 보였다.
- alpha가 beta 함대에 명령한 시도는 `not_your_fleet`로 거부됐다. 개인 command acknowledgment가 상대에게 전달되지 않음도 확인했다.
- 함대 위치가 움직였고, beta socket을 닫은 뒤 새 socket으로 재접속해 더 늦은 실제 frame을 받았다.
- 마지막 실행의 공통 관측 tick15·frame22개·combat 결과def였다. 실제 랜덤 시뮬레이션이므로 duration tick 등은 재실행 때 달라질 수 있다. 두 활성 연결은 같은 end를 받았다.
- 각 연결 frame을 **독립적으로 평가한 실제 tactical-lab processBattleMessage/syncServerShips/updateFleets source**에 공급했다. 두 소비자의 투영된 함대/함선 좌표·HP가 같고, frame 사이 local update20회로 좌표가 달라지지 않으며, 서버 end로 종료되는 것을 확인했다.
- DB 행, 계정 검증, objective/duel 등록, 장착·직업 로더는 명시적 dummy/stub이다. 실제 DB/가입/auth/부품 계산·scheduler 전체·applyBattleResults 영속 정산·자원/보상 이전을 실행한 테스트가 아니다. 두 사람의 동시 접속이나 EVE 규모 부하/지연/신뢰성·pixel-identical browser canvas를 증명하지 않는다.

### 실제 브라우저 관측

`node server/tools/shared_war_ui_fixture.js`로 뽑은 현재 siege 패널 함수 + 고정 dummy adapter를 localhost에서 IAB로 열었다. 공격 합류→손실/점유 설명 dialog→취소, 종료된 방어 성공 결과→공동 전투 다시보기 클릭과 `공동 전투: 81` dummy 라우팅을 관측했다. 최종 render에서 수리·재건/생산·운송/다시보기 버튼의 DOM height는 모두44px였다. 임시 탭과 본 작업자의 server는 닫았다.

이 fixture의 wrapper/CSS/확인 dialog는 고정 검사용이다. 실제 product main.css·전체 앱 모달·실제 gameConfirm·실폰/모바일/다중 브라우저 live canvas QA로 세지 않는다. parent가 수행하는 별도 product-theme 관측은 해당 결과에 따로 기록해야 한다.

## 부모 통합의 추가 모바일 확인

`outputs/evidence/play-loop-followup-20261021/`에 부모가 별도로 실행한 현재 테마 검수를 저장했다. 패널 본문을13px, 함대 선택을16px/44px로 맞추고 기존 `main.css`를 유지했다. 함대 수 비교는 실제 전투력 예측으로 오해되지 않도록 ‘함대 수 동일/공격 함대 수 많음/수비 함대 수 많음’으로 표시한다. 주변 명칭·개수·오류·확인문도7언어로 연결했다.

- 390×560의 공격 합류/수리·재건/생산·운송, 320px의 결과/다시보기에서 버튼44px 이상과 가로 넘침0을 확인했다. 신규 비참가자에게 합류 버튼0, 생산 패널 연결을 확인했다.
- 초기 native dialog adapter 검수 후, 실제 `index.html` 확인창 마크업·`game-dialogs.js`·`main.css`로 다시 검사했다. 태국어320×400에서 실제 확인 카드 top47.72/bottom352.28, 두 버튼44px였다. 취소는 POST0/버튼 복구, 한국어 동의는 더미 합류 요청으로 연결됐다. `shared-product-dialog.json`, `shared-product-join.json`, `shared-product-confirm-th-320.jpg` 참조.
- 7언어 패널을320×400에서 실제 번역 파일로 읽어 버튼44px/선택16px, 미치환 placeholder0/가로 넘침0을 확인했다. 함대명은 사용자 입력에 해당하는 고정 더미 이름이며 번역 대상 UI와 구분한다.

이 검수는 실제 소스와 스타일에 고정 API 응답을 연결한 로컬 화면 검수다. 게임 서버·실자산·실제 공성 DB·물리 휴대전화·두 브라우저의 실전 완주로 확대하지 않는다. 임시 서버와 탭을 종료하고 viewport를 복원했다.

## 남은 경계

- 같은 전장의 좌표 소비 회귀는 실제 source consumer를 통해 확인했지만, full game에서 두 브라우저가 같은 실전 siege를 끝까지 화면으로 함께 플레이하는 검사는 없다.
- 전투 frame에는 위치·HP·facing은 있으나 발사체/표적 발사 이벤트가 없다. battle 모드의 기존 무작위 로컬 발사 VFX는 이번에 끊었다. 서버 HP 변화의 flash·격침 폭발은 남지만, 정확한 공격자→피격자 beam/탄도 연출은 별도 서버 이벤트 연결이 필요하다. sandbox 발사에는 영향이 없다.
- `node server/tools/objective_replay_ui_regression.js`는 실제 종료된 objective battle HTTP/API가 필요하여 이번에 실행하지 않았다. fixture dependency만 새 coordinate consumer에 맞게 갱신했다.
- 새 Chronicle은 기존 서비스의 best-effort post-commit 기록이다. 통치 결과와 Chronicle insert의 outbox/원자성 보장은 추가하지 않았다. 기록 실패를 통치 rollback으로 처리하지 않는다.
- 수리/재건 CTA가 실제 기능으로 연결되더라도 파괴된 함선의 무료 복구·자동 재지급을 추가한 것은 아니다. 재료·GP·소유권 등 기존 수리/건조 규칙을 따른다.
- 다중 서버/Redis·worker crash/restart·대규모 AOI·모든 mode 권한·실제 장기간 경제/외교·자연 거래·사용자 재미/협력·리텐션은 미검증이다.

## 후속: 실전 데이터 오류의 데모 대체 차단

독립 검토에서 `/api/tactical-lab/fleet-presets?bid=...`의 DB 오류/빈 결과가 demo로 내려가고, 실전 viewer의 catalog/preset HTTP 오류가 하드코딩 함대를 남기는 문제가 확인됐다. `server/routes/tacticalLab.js`는 요청된 battle에 대해 ID 오류400·참가자 없음404·owner/side/실제 함선 정보 없음409·DB 오류500을 명시하고 demo를 반환하지 않는다. 정상 응답은 `source:battle:{id}`와 실제 fleet ID를 사용하며 공개 owner 표시는 기존 마스킹을 유지한다.

`TL_MODE=battle`은 bid·성공한 catalog·source가 일치하는 실제 fleet preset을 요구한다.401/404/500·빈 함대·owner 없는 함대·demo source·missing bid는 배열을 비우고 canvas/명령을 잠근 뒤7언어 오류/Retry를 표시하며 initBattle/loop/WS를 실행하지 않는다. Retry는 명시적 page reload다. sandbox demo fallback은 보존했다. 기존 server coordinate consumer 변경은 유지한다.

`server/tests/tactical-battle-loading.test.js`의 실제 route handler와 실제 loader/boot 함수 fixture24/24, 기존 shared27건을 합친 최신 focused51/51 통과(`work/shared-war-2026-10-21/all-shared-tests-latest.tap`). 실제 WS/엔진/독립 client consumer 회귀도 다시 통과(`ws-clients-loading-followup.log`). DB/auth는 여전히 dummy이며 정상 실제 계정·실전 완료로 확대하지 않는다.

`server/tools/tactical_load_error_fixture.js`는 원본 tactical HTML·inline CSS·실제 loader/boot와 고정 localhost catalog/preset API만 제공한다. failure=401/404/500/empty/noowner를 지원하며 다른 요청404·self-only CSP·WS upgrade 차단·POST405다. 서버 DB/config/bootstrap은 실행하지 않는다. parent에게 실제 browser의320/390 짧은 화면·Retry 재요청 관측용으로 넘겼으며, 그 관측 결과는 parent 결과에서 확인해야 한다.


부모 최종 브라우저 확인: 원본 전술 HTML/loader의500 한국어390×560/320×400에서 오류·Retry를 확인하고 실제 재요청을 관측했다.404는7언어320×400에서 가로 넘침0, Retry45.59px와 명령 잠금을 확인했다. fixture누적catalog/presets각10요청,WS upgrade0/POST0. `outputs/evidence/play-loop-followup-20261021/battle-error-browser.json` 및 화면 참조. 이 증거는 고정 API 오류 UI이며 실제 게임 DB/인증/실전 완료와 구분한다. 임시탭 종료·viewport복원·fixture포트56133 종료(ECONNREFUSED)를 확인했다.
