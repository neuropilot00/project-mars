# 세 UI 로컬 HTTP·모바일 브라우저 후속 검수

2026-10-21. 작업본 `codex/occupy-mobile-review`, 기준 HEAD `6819e74`. 앞선 `UI_FAILURE_FOLLOWUP_2026-10-21.md`의 VM 결과 이후, 사용자가 허용한 토너먼트·캠페인 목록·자원 판매의 실제 로컬 브라우저 검수를 수행했다. 운영·배포·푸시·커밋 없음.

## 검수 환경과 경계

- `server/tests/ui-failure-browser.cjs`를 비밀값 없는 `env -i`로 실행했다. `127.0.0.1:52580`에만 바인딩하고 실제 HTML/CSS/JS를 매 요청 읽는다.
- Chrome에서 실제 클릭·입력·HTTP 요청을 실행했다. 320×568, 390×844, 360×400, 844×390 뷰포트를 사용했다. 물리 휴대폰, OS 키보드, Safari 검증은 아니다.
- API는 명시적인 고정 더미 성공/실패 응답이다. 게임 전체 bootstrap, PostgreSQL, 인증키, 메일, 실제 계정·지갑·자금은 사용하지 않았다. 더미 판매 등록은 메모리 응답만 반환하며 거래를 저장하지 않는다.
- CSP로 같은 출처만 허용했다. 외부 웹폰트는 제외되므로 실기기 폰트·네트워크 성능 합격으로 확대하지 않는다. 이번 fixture의 캠페인 라이프사이클은 콜백 등록만 보존하며 플레이 중 폴링은 범위 밖이다.

## 직접 발견해 수정한 문제

1. **토너먼트**: 무응답이 영구 로딩으로 남았다. 8초 요청 취소를 추가하고, 닫기/계정 변경 후 늦은 응답이 화면에 반영되지 않도록 했다. 재시도 안내가 30초로 고정되던 것을 실제 남은 시간으로 갱신하며 대기 중 버튼은 비활성화한다. 기존 요청 간격·429 backoff를 보존했다. 탭·닫기·개최·재시도 버튼은 최소44px, 오류 문구는14px로 정리했다.
2. **캠페인 목록**: 무응답 처리를 추가했다. HTTP/형식 오류 시 평판을 0·중립으로 꾸며 표시하던 것을 제거하고 오류·재시도만 표시한다. 프로필/재시도 버튼44px를 확보했다.
3. **자원 판매**: 잘못된 수량을 거절하면서 입력창까지 닫던 문제를 고쳤다. 이제 입력값을 유지하고 해당 필드에 오류·포커스를 표시한다. 공용 확인창의 선택적 validator를 사용하고 취소·기존 확인창 동작은 유지한다. 입력 글자16px, 연결된 label, aria-invalid/alert, 번역된 취소/통화/수량 안내를 적용했다. 견적의 판매 자산은 재고에서 가져온 이름을 표시하며 서버 요청의 자원 코드는 유지한다.

기존 게임 색상·아트와 견적 수수료/경제 정책은 보존했다. 변경된 리소스의 로컬 캐시 표식은 `local-totp3`으로 올렸다. 배포는 하지 않았다.

## 실제 브라우저 결과

| 대상 | 실제 실행한 경로 | 결과 |
|---|---|---|
| 토너먼트 | 500/429, 연결 끊김, 응답 없음, 깨진 JSON, 잘못된 데이터 | 영구 로딩 없이 오류·대기·재시도 표시 |
| 토너먼트 | 429 이후 대기 종료 → 재시도 | 실제 추가 GET200과 정상 빈 목록 확인. 대기 중 자동 재요청 없음 |
| 토너먼트 | 정상 데이터 / 닫기 | 토너먼트 카드 표시, 오류 화면 닫기 동작 |
| 캠페인 | 500, 지속 연결 끊김, 무응답, 깨진 JSON, 잘못된 데이터 | 오류·재시도 표시, 오류 상태 평판 영역 비움 |
| 캠페인 | 500 → 재시도200, 정상 빈 목록 / 정상 데이터 | 빈 목록과 오류 구분, 실제 챕터 카드 렌더 확인 |
| 판매 | 소수1.5·0·빈칸·음수·재고초과11 | API 요청 없이 거절. 입력창·값 유지 |
| 판매 | 수량3·총가격6 GP → 견적 → 취소 | 단가로 재해석하지 않고 묶음 총가격6 보존. 등록 요청 없음 |
| 판매 | 수량10·총가격6 PP → 견적 → 더미 등록 | quote와 list 각200, 수량10 등록 완료 표시. 실거래 없음 |
| 모바일 | 320×568 입력 오류, 390×844 토너먼트, 360×400·844×390 긴 견적 | 기록한 화면에서 가로 넘침 없음. 입력 글자16px, 확인/취소 버튼44px, 카드·버튼이 뷰포트 안에 있음 |

처음 한 번만 소켓을 끊는 fixture에서는 Chrome이 GET을 자동 재시도하여200을 받았다. 이를 프런트 네트워크 실패 통과로 세지 않고, 지속 소켓 종료 조건으로 바꾸어 실제 오류 경로를 확인했다. 첫 fixture의 `_onPageVisible` 등록 누락도 보완했다. 최종 새로고침 후 세 화면의 앱 콘솔 오류는0이었다. 브라우저 확장 자체 경고와 의도한 HTTP 실패는 앱 결함으로 세지 않았다.

## 회귀·보존

- 전체 격리 unit/VM **137 통과, 실패0, 건너뜀0**. 실제 사용자137명이나 실제 API 테스트137회라는 뜻은 아니다.
- SEA **2678/2678**, 미번역/영문누수/placeholder·HTML 불일치0. 생성 도구로 갱신했다.
- connected feature UI 회귀 PASS, 관련 JS/CJS11파일 문법 PASS, `git diff --check` PASS.
- Desktop 원본40개 파일의 기존 해시와 현재 해시가 모두 동일하다. 기존 미커밋 통합 변경과 별도 `work/`는 보존했다.
- 별도 독립검수에서 전달된 유휴 TOTP 전투 연결의 개인 결과 수신 문제를 좁게 수정했다. 세션 재검사를 추가했고 WS+경계 VM16/16 통과(위137에 포함). 이 패치 뒤 실제 PG 복구/WS/Redis 재통합은 수행하지 않았다. 상세: `IDLE_WS_LOCAL_FIX_2026-10-21.md`.

실행 명령(작업본 루트):

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node server/tests/ui-failure-browser.cjs 52580
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs --test tests/*.test.js server/tests/*.test.js
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs tools/sea-i18n.js check
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./server/tests/isolation-guard.cjs server/tools/connected_feature_ui_regression.js
```

## 증거와 남은 범위

부모 workspace `outputs/evidence/ui-mobile-runtime-20261021/`: `requests.jsonl`은 실제 로컬 요청, `browser-checks.json`은 DOM·치수·동작 기록, `all-tests.tap`은 회귀 결과, `validation.json`은 현재 소스 해시·문법·원본 보존 결과다. 화면 JPG와 번역 생성 입력도 보관했다. 검토보드 `outputs/local-integration-board-20261021/`에 이번 결과를 반영했다.

세 목록/판매 UI의 확인된 결함은 수정·검수했다. 전체 게임 서버의 신규 플레이어 완주, 토너먼트 생성/참가/정산, 캠페인 실제 전투/보상, 실기기 및 운영 검증을 완료했다고 주장하지 않는다. 앞선 PG 통합 결과는 과거 실행의 증거로 구분해 보존한다.
