# 공성 준비 → 공동 보급 → 내 함대 복구 연결

공성 패널의 수리·재건/생산·운송 버튼이 탭 이름만 전달해 작전 ID를 잃고, 진행 중인 초보 작전이 있으면 공동 보급 대신 개인 훈련으로 전환되던 경로를 수정했다.

## 구현 범위

- `world-live-feeds.js`가 명시적인 `kind:'siege'` 문맥에 공성 ID·섹터·전투 ID·계정·자기 함대 힌트·준비 목적을 전달한다. 문맥은 이동 안내이며 권한/보상 증거로 쓰지 않는다. 늦은 다른 계정의 버튼은 이동하지 않는다.
- `command-center.js`는 이 명시적 문맥에서만 초보 자동 훈련과 초보 함대 강제 선택을 우회한다. 일반 `openCommandCenter(tab)`는 기존 초기 작전과 훈련 API를 사용한다. 공성 준비의 수령/운송/정비는 기존 `/frontier` API를 사용하며 초보 지원 수리나 mission ID를 붙이지 않는다.
- 현재 공성 ID/섹터, 실제 내 함대 HP, 서버가 반환한 길드 공동/개인 창고 범위, 오늘 자신의 생산/운송/수리 기여를 표시한다. 자기 함대 힌트는 `/fleets` 응답에 있는 함대로 다시 확인한다. 준비 화면 안의 이동은 문맥을 유지하고 공성 복귀는 원래 섹터를 다시 연다.
- 보급은 도착한 정비 창고 자원과 자기 GP로 생존 함선 HP를 수리한다. 격침 함체는 기존 도감 재건 경로로 안내한다. `supplyAffectsSiege:false`를 UI 문맥과 `data-supply-affects-siege="false"`에 고정하며 **공성 전투 버프를 주지 않는다**고 7개 언어로 명시한다.
- 새 시설·버프·보상·경제 정책·서버 서비스는 추가하지 않았다. `assets/frontier-industry.js`는 존재하지 않으며 현재 산업 UI는 `command-center.js`에 있다. 다른 소유자의 마켓/전투/auth/index/SW/SEA 파일은 수정하지 않았다.

## 실행한 검증

증거: `/Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/release-20261021/journey/`.

| 검증 | 결과 | 근거 |
|---|---|---|
| 새 공성 준비 UI 경로 | **7/7 통과** | `server/tests/siege-preparation-journey.test.js`의 실제 UI source VM 실행 |
| 기존 공성 UI 회귀 | **7/7 통과** | `server/tests/shared-war-ui.test.js`; 새 결과는 `ui-tests.tap`에 합계14/14 |
| 기존 작전실 회귀 | 통과 | `command-center-regression.log`; 기존 초보 임무2~5·견적·위험 동의·오래된 응답/로그아웃·필드 연결 유지 |
| 실제 새 private PostgreSQL | **7/7 통과** | `private-pg-result.json`, `private-pg.log`; 실제 `frontierIndustry`, `ship.getRepairQuote`, `fleetOccupancy` 실행 |
| JavaScript 문법/patch | 통과 | 두 UI 파일 `node --check`, 대상 `git diff --check` |
| 실제 브라우저 | 부모가 제품 스타일 fixture에서 확인 | 390×844/320×568 화면·버튼·스크롤·복귀와 고정 더미 생산/운송/수리 동선 |

UI 전용 테스트는 신규 길드원의 활성 초보 임무가 있어도 명시적 공성 준비가 일반 산업 API로 이동하는지, 수리 임무가 활성화되어도 일반 정비 견적을 쓰는지, 기존 기본 진입은 훈련을 유지하는지 확인한다. 공급/수리/기여를 서버 응답으로만 표시하고, 계정 변경 시 mutation을 보내지 않으며, 원래 공성 섹터 복귀 및 7언어 본문을 실행한다.

실제 PostgreSQL 검증의 고정 더미 흐름:

1. 일반 길드원이 저장 생산 1회분을 동시 수령 → 1회 성공. 철 분말20/함체 판재4와 생산 이력1개, 중복은 `PRODUCTION_NOT_READY`.
2. 다른 길드의 생산 수령 거부, 일반 길드원의 개인 재고 인출 거부, 다른 길드원 함대 사용 거부.
3. 자기 생존 함대로 철20개 일반 운송을 동시에 시작 → 1회 성공, 정상 운송기간10분, 초보 mission ID 없음. 운송 중 수리 거부.
4. fixture의 도착 시각만 앞당긴 뒤 실제 정산을 동시 조회 → 공동 정비 창고20개·운송 기여20·배송 점수20이 한 번만 반영.
5. 남의 함선/죽은 함선 수리 견적 거부. 자기 생존 함선의 실제 `ship.getRepairQuote`가 철5/GP100/회복50을 계산.
6. 동시 수리 → 1회 성공, 다른 요청은 `ALREADY_FULL`. 공동 철20→15, 자기 GP500→400, HP50→100, 수리 원장1개·수리 기여50. 실제 방어 승리 없이 공동 목표 완료로 만들지 않음.
7. 자기 GP가 부족하면 공동 재고 차감과 HP 변경 모두 rollback. 기존 수리 원장/기여 보존.

`private-pg.cjs`는 `/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node <absolute-file>`로 실행했다. 새 `/tmp/mars-journey-pg-*` 데이터/Unix socket, TCP listen 없음, 고정 dummy role과 최소 fixture DDL, 관련 migration339/351만 사용한다. 기존 DB·환경·계정·전체 앱 bootstrap·메일·체인·외부 네트워크를 사용하지 않는다. source SHA-256을 기록하고 종료 시 서비스 소스 동일성을 재확인했다. 임시 PostgreSQL 중지와 전체 임시 폴더 삭제를 확인했다.

## UI fixture와 남은 경계

`serve-ui.cjs`는 실제 두 UI 파일·제품 `main.css`/`command-center.css`/게임 아이콘·`index.html`의 작전실/확인창 마크업·실제 언어/확인창 helper를 고정해 localhost에서 제공한다. 처음 fixture의 별도 `command-center.css` 누락을 부모 브라우저에서 발견하여 해당 원본 스타일·아이콘을 추가하고 fixture만 재시작했다. 재시작 뒤 HTTP로 받은 CSS/아이콘이 원본 SHA-256과 같음을 확인했다. 제품 디자인은 수정하지 않았다. `?lang=ko|en|ja|zh|id|vi|th`를 지원한다. API는 고정 메모리 fixture이며 CSP `connect-src 'none'`이다. 별도 “Fixture: cargo arrived” 버튼은 UI 검사용 시간 단축이며 제품에 추가되지 않는다. 소스/스타일 해시는 `ui-source-hashes.json`이다.

새 UX 검증과 실제 서비스 PG 검증은 별개다. 실제 공성 참가 권한·결전·거버너 변경, 생산 거점 점령 전투, 10분 실제 대기, 운영 스키마 전체, 실제 사람/기기·부하·재미·길드 경제 지속성은 이 하위 작업의 합격 범위가 아니다. 운영 배포·push는 실행하지 않았다. inline 신규 문구11개의 7언어 원문은 `inline-seven-language-keys.json`으로 부모에게 전달했으며 `i18n-sea.js`는 수정하지 않았다.

### 부모 브라우저 최종 확인

부모가 스타일 보완 후 실제 localhost fixture에서 다음을 확인했다.

- **390×844**: 구리색 강조의 어두운 고정 작전실이 표시됐다. 영역 내 모든 버튼 높이44px, 작전실 높이764px로 하단 내비게이션 공간이 남았다.
- **320×568**: 영역 너비320px, 가로 넘침 없음. `.cc-body` 높이366px, scrollHeight2016px, `overflow:auto`로 본문을 스크롤할 수 있었고 공성 복귀가 동작했다.
- **고정 더미 동선**: 생산20 수령 → 철20 운송 → 자기 함선 HP50→100 수리 → 기여20/20/50 표시 → 공성 복귀를 확인했다. 이 기능 동선은 스타일 보완 전 확인한 같은 handler의 고정 메모리 응답이며 실제 거래·DB 동선으로 세지 않는다. 실제 서버 SQL의 private PostgreSQL 7/7 결과는 위 별도 검증이다.

이후 이 하위 작업이 실행한 fixture 서버(session18509, localhost55831)만 종료했다. 제품 파일은 추가 수정하지 않았다.
