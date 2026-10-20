# 아이디 + Google Authenticator 로컬 통합 결과 — 2026-10-21

로컬 통합과 격리 인증 회귀는 통과했다. 운영 기능은 기본 OFF이며 운영 서버, 환경 파일, DB, 메일, 체인, 지갑, 실제 계정·인증기 등록 및 배포는 사용하지 않았다. 전체 게임·실제 휴대폰·운영 활성화 합격을 뜻하지 않는다.

## 통합 범위와 보존

- 기준은 `work/occupy-upgrade`의 `6819e74`와 보존된 미커밋 작업이다. Desktop `6c10b5d`의 검토 패치에서 신규 TOTP 서비스/암호화/라우터/테스트를 옮기고, 기존 파일은 공통 조상과 3방향 비교했다.
- `server/index.js`에는 기존 라우트 앞의 TOTP 세션 경계 및 `/api/auth/totp` 연결만 추가했다. 이후 산업·목표·첫 작전 API도 그 경계를 통과한다.
- WS 3개 충돌(crypto import, battle ID, 명령 처리)은 수동 결합했다. 현행 BigInt ID, commandId/ack, 전술 명령, Redis 전달/결과 코드를 보존하면서 handshake/privileged cmd에 버전 검사를 추가했다.
- `server/routes/auth.js`는 기존 이메일 OTP 실험을 분리한 뒤 target HEAD의 이메일/비밀번호 경로로 복원했다. 차이는 TOTP의 `/link-wallet` 토큰 downgrade 차단 5줄뿐이다. `server/services/email.js`는 target HEAD와 바이트가 같다. 이 보존 비교는 `legacy-preservation.json`에 기록했다.
- 개발 중이던 이메일 OTP 파일 3개(`emailOtp.js`, migration352, `email_otp_regression.js`)는 활성 트리 밖 `email-otp-retired/`로 이동했다. 원본 사본/해시는 `pre-integration/`에도 있다. 삭제·reset·일괄 덮어쓰기는 하지 않았다.
- 신규 migration 이름은 **`353_totp_auth.sql`**이다. 소스의 337과 현재 `337_duel_invitations.sql`의 혼동을 피했다. 352 번호의 공백은 보관한 이메일 OTP 실험 때문이다.

## 확인한 동작

가입은 username + 첫 TOTP 증명 + 복구코드 보관 확인 뒤에만 유저/identity/정상 JWT를 만든다. 확인에 쓴 복구코드 하나를 소모하여 9개를 남긴다. SHA-1/30초/6자리 ±1 counter를 재사용 없이 소비한다. 가입 광물·관리자 GP 보상은 기존 설정으로 한 번만 적용하고 PP는 지급하지 않는다.

복구는 일회용 복구코드를 원자적으로 소비하고 seed를 비우며 session version을 올린다. 이 단계에 JWT는 없다. 새 인증기와 새 복구코드를 확인한 뒤 같은 wallet의 새 JWT를 발급하며 기존 토큰은 계속 폐기된다. 비활성·삭제된 사용자는 로그인/복구/교체/기존 세션을 사용할 수 없다.

HTTP 경계는 raw JWT, Bearer의 대소문자/탭/복수 공백, 기존 split 방식, body token을 검사한다. 기존 라우트의 인증 허용 범위는 확대하지 않았다. 같은 요청의 다른 legacy token이 유효해도 폐기된 TOTP body token을 우회하지 못한다. TOTP wallet linking은 서명만 있는 토큰으로 재발급되는 downgrade를 차단한다.

공개 `/api/auth/totp/config`는 flag/32-byte canonical Base64 암호화 키/JWT 설정과 필수 TOTP DB 컬럼을 확인한다. 없거나 부분 적용된 스키마에서는 `enabled=false,schemaReady=false`다. flag는 미설정 시 OFF이며 mutation은 설정/SQL/암호화/서명/seed 실패에 503으로 닫힌다. 스키마 확인은 테이블/컬럼 존재 확인이고 전체 운영 migration·제약·데이터 검증을 대신하지 않는다.

## 실제 실행 결과

| 검증 | 결과 | 실제 범위 |
|---|---:|---|
| guarded auth primitive/state/router/boundary/WS VM | 39/39 | 네트워크/운영 DB·메일·체인·환경 파일 금지 preload, 고정 fixture entropy |
| 실제 PostgreSQL + Express HTTP + WS Unix socket | 16/16 | 통합 source 고정 사본, 실제 SQL/HS256/row locks/migration353 두 번 |
| 기존 이메일·비밀번호 PG/HTTP | 12/12 | 기존 고정 bcrypt 계정, 로그인/프로필/오류/lockout/fallback/wallet guard |
| 기존 WS battle-channel 회귀 | 5/5 | 새 loopback fixture, BigInt/인접 ID/프레임/명령 routing/정리 |

실제 PG는 부모 작업이 만든 Unix 소켓 전용 클러스터 `/tmp/mars-oc-20261021-socket`, port55441, `mars_fixture`, `postgres`, SSL=false를 사용했다. 이 작업이 소유한 schema는 `totp_fixture`, `totp_email_fixture`뿐이다. fixture는 부모 PG를 중단하지 않고 자신이 연 HTTP/WS만 종료했다. 상속 환경은 `/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin`로 비웠다.

16개 시나리오에는 default OFF, missing/partial schema, 가입 전 사용자 없음, 백업 확인, TOTP replay, 실제 row-lock 동시 로그인/복구/동명 가입 단일 승자, inactive target, 자원/서명 실패 rollback이 포함된다. 실제 TOTP JWT로 기존 `/auth/me`가 같은 wallet·email=null·설정된 14GP를 반환했다. 신규 광물 3종은 실제 inventory에 한 번만 적재되고 복구 후 중복 지급되지 않았다.

현재 frontier/objective/starter **실제 라우터 본문**을 Express에 장착하여 여섯 header shape를 확인했다. 정상 토큰은 각 경로에 도달하고, 복구 후에는 모두 `session_expired`로 서비스 호출 전에 차단된다. 이 fixture의 gameplay 서비스는 명시적 더미이므로 산업 생산/전투/첫 작전의 게임 동작 합격 근거는 아니다.

실제 WS 모듈 본문과 실제 WS 라이브러리로 Unix socket 접속, `9007199254740993` ID, 현행 commandId/ack를 확인했다. 실제 PG 복구 후 열린 socket의 다음 명령은 1008 `session_expired`로 종료되고 재접속은 HTTP401이었다. command dispatch 서비스와 Redis는 fixture 경계이며 실제 다중 worker/Redis는 실행하지 않았다.

기존 이메일 signup 구현은 HEAD와 동일함을 비교했다. 이메일 회귀 12개는 기존 계정 로그인 중심이며 새 이메일 가입/메일 수신/비밀번호 복구 발송/실제 wallet relinking을 실행한 증거는 아니다.

## 재현 명령과 산출물

repo `server/`에서:

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --require ./tests/isolation-guard.cjs --test ./tests/totp-crypto.test.js ./tests/totp-auth.test.js ./tests/totp-boundary.test.js ./tests/totp-websocket.test.js ./tests/isolation-guard.test.js
```

부모가 위 전용 임시 PG를 구동한 상태에서만:

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node /Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/totp-integration-20261021/auth-integration.cjs --run-authorized-fixture
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node /Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/totp-integration-20261021/email-regression.cjs
```

repo 루트에서 기존 WS 회귀:

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node server/tools/ws_battle_channel_regression.js
```

근거는 [auth 결과](../../../outputs/evidence/totp-integration-20261021/auth-integration-result.json), [email 결과](../../../outputs/evidence/totp-integration-20261021/email-regression-result.json), [WS 결과](../../../outputs/evidence/totp-integration-20261021/ws-battle-regression.txt), [원본 보존 비교](../../../outputs/evidence/totp-integration-20261021/legacy-preservation.json)에 있다. auth 결과에는 실행 직전/직후 10개 source의 SHA-256 일치와 migration hash가 들어 있다. 테스트 timestamp는 도구의 UTC 값이며 문서 날짜는 작업 요청의 Asia/Tokyo 기준이다.

## 남은 경계와 롤백

실제 Google Authenticator/휴대폰, 운영 HTTPS·Origin·proxy, 7언어·스크린리더, 전체 production migration/bootstrap, 실제 메일/지갑, 키 보관·회전·backup 지원/abuse 정책, Redis/다중 worker, 전체 신규 플레이어 완주는 이번 인증 검증 범위 밖이다. TOTP 단일 요소이며 MFA·피싱 저항 인증이 아니다. 공개 username의 24시간 실패 예산을 악용한 서비스 거부와 복구코드 전부 분실 시 지원 정책도 운영 결정이 필요하다.

TOTP 계정을 만든 뒤 버전 경계 없는 옛 서버로 롤백하면 폐기 JWT가 다시 통과할 수 있다. 그 경우 HTTP/WS 경계·TOTP 테이블·암호화 키를 함께 보존해야 한다. 키를 교체만 하거나 테이블을 없애면 복구/로그인이 막힌다. flag OFF도 기존 TOTP 세션을 차단한다. migration은 서버 bootstrap에서 flag와 별도로 실행되므로 운영 적용은 별도 단계다.
