# 마켓·여정 로컬 통합 결과 — 2026-10-21

`6819e74` 작업본에 Desktop `6c10b5d` 기반 검토 패치를 파일별 3방향 비교로 통합했다. 기존 파일 전체 교체 없이 변경 구간을 적용했다. 운영 bootstrap, `.env`, 운영 DB·메일·지갑·계정, 배포·commit·push는 실행하지 않았다.

## 반영한 동작

- 고정가 아이템·영토·자원 판매 전에 실제 서버 견적을 확인한다. 자원 입력은 **묶음 총가격**이며 수량으로 다시 곱하지 않는다. GP 등록비와 PP 수령액을 분리하고, 현재 할인·동적 등록비·판매세·관세 범위·개당 가격·NPC 공급을 표시한다. 수수료·보상 설정은 변경하지 않았다.
- 견적과 등록이 같은 등록비 계산을 사용한다. 같은 판매자 사용자 행 잠금 뒤 매물 수와 견적 만료를 다시 검사한다. 견적은 무료이고 수수료를 예약하지 않는다. 실패·취소·만료·다른 모달로 전환된 지연 응답은 자동 등록하지 않는다.
- 최신 마켓 아트·HTML escaping과 자원 만료/관리자 제거 에스크로 반환을 보존했다. 만료 반환은 상태 변경과 같은 트랜잭션이며 재실행으로 중복 반환되지 않는다.
- `/api/onboarding/status`는 기존 `step/completed` 계약을 유지하고 `journey`를 추가한다. 실제 영토/과거 점령, 양수 수확 거래, 보유 함선/완료 건조, 다른 인간 사용자에게 완료된 판매 또는 양수 길드 기여 원장을 읽는다. 자기 거래·NPC·미완료·0원 판매는 완료 근거가 아니다. 조회 실패는 초기화된 진행 대신 재시도 가능한 503이다.
- 새 플레이어는 무료 **첫 출격 → 작전실**로 연결한다. 초기 작전 5개 중 시작된 작전이 있고 모두 보상 수령되기 전에는 경제 여정 패널을 숨긴다. 작전실이나 기존 초기 설정 화면이 열려 있을 때도 숨긴다. 작전 완료 뒤에는 서버에서 확인한 장기 경제 단계로 연결한다. 첫 수확은 함선이 필요한 Mining 탭 대신 Territory 탭으로 연결한다.

## 실행 검증

증거 디렉터리: `/Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/totp-integration-20261021/market-journey/`.

| 검증 | 실제 결과 | 범위 |
|---|---|---|
| Node 단위/VM | **48/48 통과**, `unit-tests.tap` | 수수료·통화·견적/모달 경합·타임아웃·JWT fixture·여정 SQL 계약·초기 작전 우선순위 |
| 실제 PostgreSQL+Express 여정 | **18/18 통과**, `journey-results.json` | 실제 병합 `playerJourney.js`/상태 라우트, 최소 fixture DDL, 실제 SQL·Unix HTTP. 인증은 fixture. rollback 후 `journey_fixture` 제거 확인 |
| 실제 PostgreSQL+Express 마켓 | **11/11 통과**, `market-integration-result.json` | 실제 병합 서비스/라우트, 실제 JWT/SQL/Unix HTTP. 등록·구매·정산·동시 잠금·견적 만료·에스크로 반환 |
| JavaScript 문법·patch 공백 | 통과 | 두 변경 UI 파일 `node --check`, 대상 `git diff --check` |
| 브라우저 UI | fixture 제공, 본 하위 작업에서 미실행 | 부모 통합 검증에서 결과를 별도 기록. 실제 병합 handler/dialog/CSS/아트 사용, 고정 견적만 제공 |

PostgreSQL은 새 `/tmp/mars-oc-20261021-socket`, port `55441`, role `mars_fixture`, DB `postgres`, `ssl:false`만 사용했다. 마켓은 `market_fixture`, 여정은 `journey_fixture`로 격리했다. 모든 실행은 `/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin`으로 시작했다. 마켓 fixture는 TCP/DNS/TLS와 다른 Unix 소켓, `.env`·지갑·메일 의존성 로드를 거부한다. PG 프로세스는 부모 작업이 계속 사용하므로 중지하지 않았다.

마켓 실제 SQL에서 확인한 추가 보존 회귀:

1. 자원 10개 등록 → 만료 → 재고 10개 반환. 두 번째 만료 처리 반환 0개. 등록비 반환 없음.
2. 자원 등록 → 관리자 제거 → 재고 반환. 반복 제거는 active 매물이 없어 거절되고 중복 지급 없음.
3. 실제 PostgreSQL trigger로 재고 쓰기 실패 주입 → 만료 상태 변경 전체 rollback 및 재고 보존. trigger 제거 후 재시도 1회만 반환.

재현 명령은 작업본 루트에서 실행한다:

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs --test tests/journey-*.test.js tests/market-*.test.js
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node /Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/totp-integration-20261021/market-journey/journey-integration.cjs --run-local-fixture
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node /Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/totp-integration-20261021/market-journey/market-integration.cjs --run
```

두 SQL fixture는 `task-2/integration`의 이전 준비본을 **새 증거 디렉터리로 복사·적응**했다. 원래 검수 증거는 수정하지 않았다. 소스 SHA-256을 현재 병합 파일로 고정하고 실행 종료 때 마켓 소스가 그대로인지 다시 확인한다. 마켓 재실행은 해당 fixture 스키마의 더미 표만 초기화한다.

## 브라우저 fixture와 남은 범위

`build-browser-fixture.py`가 `browser/market-fixture.html`과 로컬 아트를 생성한다. 실제 병합 `market-transport.js`, `game-dialogs.js`, `index.html`의 확인창 마크업, 전체 `main.css`, economy 아트 도우미와 실제 atlas를 사용한다. 수량·총가격·GP/PP·지연·오류·8초 타임아웃을 360/390×560에서 검증할 수 있다. `connect-src 'none'`과 고정 fetch가 외부 요청을 막고 실제 등록 요청은 항상 거절한다. CSS/소스가 뒤에서 수정되면 generator를 다시 실행해 해시를 갱신해야 한다.

최소 fixture 스키마와 고정 정책값을 사용했다. 직업/영토 할인·관세 정책 서비스·시즌 등 부수효과는 주입 fixture다. 실제 운영 스키마 전체 migration, TOTP 세션을 포함한 전체 앱 로그인, 아이템·영토 자산 분기, 별도 함선/경매 시장, 초기 작전 실제 전 과정과 장기 사람 플레이는 이 결과의 합격 범위가 아니다. 모달의 짧은 화면 scroll/버튼 접근은 부모의 브라우저 확인이 필요하다.

롤백 시 견적 UI·라우트·공통 계산을 일관되게 되돌려야 한다. 기존 최신 자원 에스크로 반환과 아트/escaping은 유지해야 한다. 여정은 읽기 전용이며 별도 migration이나 보상 데이터를 만들지 않는다.

## 부모 브라우저 통합 확인 — 2026-10-21

실제 Chrome 360×400에서 긴 견적창이 화면 위·아래로 잘리는 현상을 재현해 `main.css`의 최대높이, 내부 스크롤, 하단 고정 행동영역을 수정했다. 변경 CSS로 fixture를 재생성했으며 360×400 및 390×560에서 창과 44px 버튼 접근을 확인했다. 견적 조회 오류가 등록 요청/차감으로 이어지지 않는 더미 UI 경로도 확인했다. 실제 거래는 수행하지 않았다. `market-390.jpg`는 실제390×560 viewport의 결과다.
