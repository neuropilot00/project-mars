# TOTP 운영 설정 — 2026-10-21

기존 앱: https://project-mars-production-916a.up.railway.app/ · Railway project `exemplary-generosity`, service `project-mars`, environment `production`.

아래 운영 현황은 부모 릴리스 작업이 CLI와 공개 GET으로 확인해 전달한 결과다. 이 문서 작성 작업은 소스만 읽었으며 운영 계정·DB·환경값·체인에 접근하지 않았다.

| 항목 | 전달받은 확인 결과 |
| --- | --- |
| 배포 | `889038e8-a9ce-4ea9-99a5-c4287bc4b52b`, 기준 SHA `6819e74` |
| `/health`, `/ready` | GET 200; TOTP 활성화나 스키마·암호문 검증을 뜻하지 않음 |
| `TOTP_ENCRYPTION_KEY` | 변수 존재 여부만 확인: 없음. 값 조회·출력 없음 |
| `TOTP_AUTH_ENABLED` | 미설정: 소스 기본값 OFF |
| 기존 TOTP 계정·암호문 수 | DB 미확인. 0개라고 추정하지 않음 |
| 이번 직접 승인 범위 | 사용자: “이번에는 코드만 배포하고 비활성 유지.” 코드 배포만 승인. 키 생성·환경변수 등록·활성화는 실행하지 않음. 대기 중인 키 승인 질문 없음 |

## 설정과 장애 시 동작

이번 릴리스에서는 `TOTP_AUTH_ENABLED`를 미설정/OFF로 유지하고 `TOTP_ENCRYPTION_KEY`를 생성하거나 등록하지 않는다. 아래 키 보관 설명은 향후 별도 활성화를 위한 소스 계약이며 이번 실행 지시가 아니다.

`TOTP_ENCRYPTION_KEY`는 인증기 seed와 임시 등록 seed를 AES-256-GCM으로 암호화하는 서버 전용 키다. 지갑 개인키나 출금 서명키, `JWT_SECRET`와 용도가 다르다. 정확히 32바이트를 canonical Base64로 표현해야 한다. 향후 별도 승인 시 기존 Railway 서비스의 production secret 환경변수로 보관하고 같은 DB를 사용하는 모든 웹·WS 프로세스에 같은 값을 공급한다. 저장소·브라우저 코드·문서·로그·일반 증거 파일에 값을 넣지 않는다.

활성화 조건은 `TOTP_AUTH_ENABLED`가 정확히 `true`, 유효한 암호화 키, 기존 `JWT_SECRET`, migration `353_totp_auth.sql`의 필수 컬럼이다. 공개 [config 경로](https://project-mars-production-916a.up.railway.app/api/auth/totp/config)는 키 값을 반환하지 않는다. flag/키/JWT가 준비되지 않았거나 컬럼 조회가 실패하면 `enabled=false, schemaReady=false`를 반환한다. 이 결과만으로 스키마가 없다고 판단할 수는 없다. 준비되지 않은 설정, SQL·암호화·서명 장애에서는 TOTP 변경 요청이 일반화된 `503 auth_unavailable`로 닫힌다. Origin/JSON 형식·입력·횟수 제한 오류는 별도 403/415/401/429 응답을 사용한다.

새 화면의 배포 경로는 [인증기 로그인 경로](https://project-mars-production-916a.up.railway.app/authenticator.html)이며 코드 배포 후에도 기능은 OFF다. 새 username 계정을 만드는 방식이며 기존 이메일/비밀번호 계정의 자산이나 인증을 이전하지 않는다. 기존 이메일 로그인·지갑·기존 JWT 계약은 보존한다. 새 계정은 placeholder wallet 주소를 사용하며 실제 지갑 개인키를 생성하지 않는다. 향후 활성화되는 TOTP 세션의 기존 wallet-link 경로는 버전 없는 JWT 재발급을 막기 위해 403으로 차단된다.

## 롤백·분실·교체

TOTP 사용 이력이 있을 수 있으므로 키와 TOTP 테이블을 보존한다. 운영 DB의 계정·암호문 수를 확인하지 않은 상태에서 키를 새 값으로 덮어쓰거나 테이블을 제거하면 안 된다. 기존 키의 별도 복구 가능한 보관과 접근 통제도 운영자가 유지해야 한다.

동일 DB로 롤백할 때 동일 키, TOTP HTTP/WS 세션 버전 검사, 테이블을 함께 보존해야 한다. 버전 검사가 없는 옛 서버는 복구로 폐기된 JWT를 다시 허용할 수 있다. flag OFF 또는 키 미설정/형식 오류는 기존 TOTP 세션 검사도 실패시켜 HTTP 401 및 WS 종료/재접속 거부를 유발한다. 기존 이메일 로그인은 별도 경로다.

현재 암호문에는 key ID가 없고 여러 키를 순차 복호화하는 기능이나 자동 재암호화 도구가 없다. 키를 다른 정상 형식 값으로 바꾸면 기존 seed와 진행 중인 등록 seed를 복호화할 수 없어 해당 TOTP 로그인·등록 완료가 실패한다. 정상 형식의 잘못된 키도 config에는 준비된 것으로 보일 수 있으며, 기존 JWT는 seed 복호화를 거치지 않으므로 키 교체만으로 자동 폐기되지 않는다. 계획된 교체에는 기존 키로 복호화한 뒤 새 키로 원자적으로 재암호화하는 별도 절차가 필요하다.

복구코드는 키와 별개인 해시로 보관된다. 키가 없거나 형식이 잘못된 동안은 복구도 503이다. 유효한 키가 구성된 상태에서는 남은 일회용 복구코드로 기존 seed를 복호화하지 않고 새 인증기를 등록할 수 있다. 이때 기존 세션을 폐기하고 새 seed·복구코드를 확인해야 한다. 진행 중인 등록을 잃으면 다른 미사용 복구코드가 필요할 수 있다. 인증기·원래 키를 잃고 유효한 복구코드도 없으면 이 구현에 추가 이메일/지원 복구 경로는 없다.

소스 근거: [설정·스키마·복구·세션 검사](../server/services/totpAuth.js), [키 형식·암호문](../server/services/totpCrypto.js), [라우터 응답](../server/routes/totpAuthRoutes.js), [HTTP 세션 경계](../server/utils/totpSessionBoundary.js), [WS 경계](../server/wsServer.js), [migration353](../server/migrations/353_totp_auth.sql). 실제 사용자 인증기 등록·운영 활성화·키 생성/변경은 이 문서로 검증하지 않았다.
