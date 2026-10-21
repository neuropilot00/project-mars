# 시즌·추천 조회 스키마 호환 수정 — 2026-10-21

실제 전체 앱 모바일 QA의 private DB에서 발생한 두 500을 현재 서비스가 요구하는 컬럼의 누락으로 확인했다. 서비스의 빈 결과 폴백으로 숨기지 않고, 필요한 컬럼만 두 additive migration으로 복구했다. 이번 작업에서 `season.js`, 시즌359 멱등성 수정, 추천 helper/라우트, 설정·보상·잔액 정책은 변경하지 않았다.

## 확인한 원인과 변경

| 실제 오류 | 원인 | 최소 변경 |
|---|---|---|
| `/api/season/leaderboard?limit=20`: `column ss.enhancements_done does not exist` | 최상위047/050은 기본·확장 카운터,094_siege는 `ships_built`를 추가한다. `enhancements_done/trades_completed/naval_wins`는 **archived/094_economy_integration.sql**에만 정의되고, archived098은 인덱스만 추가한다. 현재 migration runner는 archived 디렉터리를 실행하지 않는다. | **360_season_score_compatibility.sql**: 네 카운터에 `ADD COLUMN IF NOT EXISTS INTEGER NOT NULL DEFAULT 0`. 이미 있는 ships_built의 값·nullable 계약은 바꾸지 않는다. |
| `/api/referral/:wallet`: `column currency does not exist` | 기본001 referral_rewards는 PP ledger 8컬럼이다. 현재 읽기/commission 기록은 `gp_amount/currency`도 요구하지만 해당 DDL은 **archived/099_referral_gp_fix.sql**에만 존재한다. | **361_referral_currency_compatibility.sql**: `gp_amount DECIMAL(20,6) NOT NULL DEFAULT 0`, `currency VARCHAR(10) NOT NULL DEFAULT 'pp'` 두 컬럼만 `IF NOT EXISTS` 추가. |

과거행·원래 PP 금액·trigger 이름을 보고 GP 통화를 추정하거나 보상을 재지급하지 않는다. `UPDATE`, 과거행 삭제/청구/환급, 추천 금액·설정 변경은 없다. 이미 GP/currency 컬럼과 기록이 있는 DB에서는 그 값들을 보존한다. archived 파일의 다른 설정/수수료 정책을 통째로 복구하지 않았다.

## 실제 QA DB 관측의 범위

`outputs/mobile-play-qa-20261021/runtime.json`이 지정한 **소유자가 실행 중인 private fixture DB만** `psql -X`의 `BEGIN READ ONLY … ROLLBACK`으로 조회했다. 조회 대상은 `information_schema.columns`뿐이며 운영 DB·사용자행·환경 파일에 접근하지 않았다.

- QA 소스 head: `f952af3ef037ed89f55bcca24f3c0fa62835502d`.
- `season_scores` 35컬럼에서 누락은 enhancements_done/trades_completed/naval_wins 3개. ships_built는 integer DEFAULT0 nullable로 이미 존재했다. 다른31개 현재 category의 스키마 계약은 아래 별도 fixture에서 전부 확인했다.
- `referral_rewards`에는 기본001의 8컬럼이 있고 gp_amount/currency 2개만 누락됐다.
- 기존 앱/DB에는 migration 적용·재시작·종료를 하지 않았다. 이 두 migration의 QA 앱 적용 및 정상 전체 앱 재확인은 root/앱 소유자가 수행할 단계다.

## 별도 실제 PostgreSQL·HTTP 회귀

각 도구는 `env -i`에서 새 private PostgreSQL16 cluster와 Unix socket HTTP listener를 만들고, 네트워크를 자기 PG/HTTP socket에만 제한한다. 실제 `.env`/bootstrap/메일/체인/기존 계정은 로드하지 않는다. 두 실행 모두 종료0 및 임시 cluster·HTTP socket 삭제를 확인했다. 새 행동 모델 실행은 없다.

```sh
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/season_schema_isolated_regression.js
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/referral_schema_isolated_regression.js
```

시즌 **6개 묶음 통과**:

- 실제047/050 SQL과094의 시즌 확장 DO블록,359를 적용한 스키마에서 실제 seasonRoutes GET500 및 `addSeasonScore('enhance')` 42703을 먼저 재현했다.
- 360 후 동일한 실제 leaderboard GET200, 기존 score125/ships_built7 보존, 새 카운터0을 확인했다.
- 현재 `ALL_CATEGORIES`의 **31개 category GET 전부200**. enhance/trade/naval_win/ship_build의 실제 쓰기가 score165, 카운터2/3/1/8로 반영됐다.
- 기존 GP/PP·기존 reward/claimed·359 finalization 원장·기존 점수는 migration 전후 같았다. 재적용 후에도 생성된 nonzero 카운터와 migration receipt1개를 보존했다.
- 새 세 카운터는 integer/NOT NULL/default0, 기존 ships_built nullable은 유지했다.

추천 **5개 묶음 통과**:

- 실제001의 referral_rewards DDL을 추출한 스키마에서 실제 referral info/leaderboard GET500을 먼저 재현했다.
- 361 후 기존 PP3.75/GP0을 보고하고 기존/신규 사용자 GET200을 확인했다. `legacy_gp_name` trigger가 있어도 추정 전환 없이 PP로 보존했다. 신규 코드 생성도 실제 라우트 경로를 사용했다.
- `db.js`의 현재 `getReferralChain/creditReferralCommission` 함수를 bootstrap 없이 추출하여 실제 SQL로 실행했다. **fixture의 자금 확보된 호출자**가 GP10/PP10을 먼저 차감한 후, 실제 helper가 각각 같은 통화로 기록·수령액을 지급했다. 각 단계 전체 GP/PP 잔액 합은 같았다. 이는 테스트용 100% trigger/tier 설정이며 운영 기본 수수료가 아니다.
- 실제 info/leaderboard는 PP13.75/GP10을 구분해서 응답했고 stats GET도200이었다. 새 컬럼으로 실패 없이 기록하는 현재 계약을 확인한 것이며 전체 추천 운영 정책의 새 승인은 아니다.
- migration 전후 기존 8컬럼·유저 잔액은 같았고, 재적용도 현재 GP/PP 기록·잔액·receipt1개를 보존했다.

두 전용 도구의 `node --check` 및 작업 파일 whitespace 검사도 통과했다. 별도 fixture는 필요한 실제 migration DDL/라우트/서비스와 더미 테이블만 구성했으며 **전체325 migration 앱을 새로 실행한 것과 구분**한다. 기존 QA 앱의 실제 가입 후 두 화면 조회200 검증은 앱 소유자의 통합 단계다.

## 소스 SHA256

| 파일 | SHA256 |
|---|---|
| `server/migrations/360_season_score_compatibility.sql` | `2b6b49f499dbf0071dc34af6f9fdd6a5227fdfd6c7c2127cc9353a7ea6c8db70` |
| `server/migrations/361_referral_currency_compatibility.sql` | `4dabce4c2aae11620d77719211e1de71a98da3e8bb5d80909948bc776b5a260e` |
| `server/tools/season_schema_isolated_regression.js` | `a59d79dbd3cc765a5c6c6fc25c4e4e7cb7f576efac0ec24c2950d2044b94cf96` |
| `server/tools/referral_schema_isolated_regression.js` | `96db0bd4e1434f1066fe689422f120409a43258891cdc792b015cb470dd498b4` |
| 기존 `server/services/season.js` (이번 변경 없음) | `c233b8c253383a31487495bee661e7a7665a49bd165ff61e3e83d60fb9aeb3b6` |
| 기존 `server/routes/referralRoutes.js` (이번 변경 없음) | `58e1f1c4eadd3cb2e5577e65b83448734312f0e949e713c8d623dc6a2d26309c` |

360/361은 정상 migration 경로로 적용해야 하며 실행 중인 공유 QA DB나 운영 DB에 이 담당이 임의 적용하지 않았다. 과거 기록의 통화 정정이나 보상 재산정은 이번 수정 범위에 포함하지 않는다.
