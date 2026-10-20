# UI 독립검수 후속 수정 — 2026-10-21

후속: 이 문서는 이전 VM 전용 실행 기록이다. 이후 허용된 실제 로컬 HTTP·모바일 브라우저 검수 결과는 `UI_MOBILE_RUNTIME_2026-10-21.md`를 참조한다.

## 범위

작업본 `6819e74`의 기존 미커밋 통합 변경을 유지하고, 독립검수에서 재현된 UI 결함 세 가지를 수정했다. 이 후속 실행에서는 서버/HTTP/WS/DB/브라우저를 시작하거나 접속하지 않았다. 인증키·메일·실계정·자금·운영·푸시·배포 작업도 없다. Desktop 원본이나 독립검수 사본은 수정하지 않았다.

## 수정

1. **토너먼트**: guarded read의 HTTP500·429·네트워크 실패가 `null`로 끝나도 로딩 표시를 종료한다. 일반 실패와 요청 제한을 구분하고, 기존 30초 간격/429 backoff를 지키는 대기 안내·재시도 버튼을 제공한다. 성공한 빈 배열은 기존 빈 목록으로 표시한다. 탭 변경 뒤 이전 응답이 새 탭을 덮지 않도록 요청 순서를 확인한다.
2. **캠페인**: HTTP 성공 여부, 최상위 payload와 chapters 배열/행의 기본 형태를 확인한다. 오류를 `_campaignData`에 저장하거나 정상 빈 목록으로 처리하지 않는다. 실패하면 이전 데이터와 보상/평판 표시를 비우고 재시도를 제공한다. 더 늦게 온 오류가 새 성공 응답을 지우거나 이전 계정 응답이 표시되는 것을 막는다. 정상 `chapters: []`는 여전히 성공이다.
3. **자원 수량**: `parseInt(value)||1` 자동 보정을 제거했다. 전체 입력이 숫자로 된 양의 안전 정수이고 재고 이하여야 비용 확인으로 진행한다. 빈칸·0·음수·소수·지수·문자 혼합·초과 재고는 요청 전에 거절한다. 정상 수량1·3·10과 묶음 총가격6은 그대로 전달한다.

오류 버튼은 기존 `bc-btn` / `campaign-btn secondary` 디자인을 사용하며 최소높이44px를 명시했다. 신규 세 문구를7개 언어로 연결했고 SEA 파일은 도구로 재생성했다. 이 버튼의 실제 렌더링/터치 크기는 이번 VM 검사만으로 합격 처리하지 않는다.

## 실행 증거

- 패치 전 신규/기존 좁은 VM 묶음:30개 중17통과·13실패. 세 결함의 실패 경로를 현재 소스에서 재현한 결과다.
- 패치 후 전체 guarded unit/VM: **126/126 통과**, 실패/건너뜀0. 기존107개에 후속19개를 추가했다. 이 숫자는 실제 유저나 실제 API 호출 수가 아니다.
- 토너먼트 VM은 실제 `core-runtime.js`의 guarded fetch와 battleHub wrapper를 실행한다. HTTP 응답만 합성 객체이며 실제 네트워크는 차단된다.429 재시도에서 합성 fetch도 backoff 동안 추가 호출되지 않는 것을 확인했다.
- 캠페인 VM은 실제 loader를 실행하고 렌더러/DOM/HTTP를 주입한다. HTTP500·429·네트워크·잘못된JSON·누락/잘못된chapters·오류payload와 성공/빈 목록/재시도를 구분한다.
- 기존 connected feature UI 회귀 PASS.
- SEA **2677/2677**, 미번역·영어누수·placeholder/HTML 불일치0.
- 관련 JS 문법 및 `git diff --check` PASS. 상세 파일 해시는 `ui-followup-validation.json`.

실행 명령(작업본 루트):

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs --test tests/*.test.js server/tests/*.test.js
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs tools/sea-i18n.js check
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs server/tools/connected_feature_ui_regression.js
```

근거: 부모 workspace `outputs/evidence/totp-integration-20261021/ui-followup-before.tap`, `ui-followup-all.tap`, `ui-followup-validation.json`, `ui-followup-sea/`.

## 남은 검증

새 오류 화면의 실제 브라우저·휴대폰 검증, 실제 서버 통합은 이번 후속 실행에서 수행하지 않았다. 앞선 통합 보고서의 PostgreSQL/브라우저 결과는 그때 확인한 범위의 과거 증거이며 이번 세 수정의 실제 서버/렌더 검증으로 바꾸어 부르지 않는다. ACE 등 다른 화면, 전체 신규계정 게임 완주·모든 전투/산업/길드/경매/시즌·실기기·재미/리텐션은 계속 미검증이다. 신규 opt-in 밈 기능은 추가하지 않았다.
