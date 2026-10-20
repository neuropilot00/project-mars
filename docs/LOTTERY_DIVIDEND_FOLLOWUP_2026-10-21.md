# 복권·배당 적립 원자성 후속 — 2026-10-21

**이미 양수로 기록된 하우스 원금의 배당 적립은 이제 당첨금·당첨표·회차 완료와 같은 트랜잭션에서 처리된다.** 적립 오류를 삼켜 당첨금만 확정하는 경로를 제거했다. 배당률·당첨금·상품 가격·이전 잔액은 바꾸지 않았다. 운영·배포·실제 데이터 작업은 하지 않았다.

## 확인한 결함과 최소 수정

수정 전 `lottery.drawRound()`는 당첨금·표·회차 완료를 COMMIT한 후, `dividends.addToPool(houseGp,'lottery')`를 다른 연결에서 실행하고 실패를 삼켰다. fresh private PostgreSQL에 수정 전 두 서비스의 보존본을 실행해, 합성 원금100GP 중 당첨금95/하우스5인 사례에서 **당첨금95 지급·회차 완료·당첨표1개, pool0**이 남는 것을 재현했다. 이는 부분 정산 증거이며 추가 발행이나 중복 당첨이 입증됐다는 뜻은 아니다.

변경은 실제 게임 서비스2파일로 한정했다.

- `lottery.js`: 양수 `lockedRound.house_gp`에 대한 `await addToPool(houseGp,'lottery',client,houseGp,{requireSchema:true})`를 COMMIT 전으로 이동했다. 호출자 오류 삼킴을 제거해 실패 시 기존 회차 트랜잭션이 롤백된다.
- `dividends.js`: 선택한 호출에만 적용하는 `requireSchema` 옵션을 추가했다. savepoint를 복구한 뒤 `42P01`/`42703`도 상위에 전파한다. 다른 호출의 기본값은false여서 마켓의 기존 optional-schema 적립0 반환은 유지한다.

명시적 배당 비활성화·배당률0·원금0은 성공적인 무적립 정책이다. 실제 적립액이0이면 strict 옵션이라도 pool 테이블을 불필요하게 요구하지 않는다. 정상률30%와 금액 반올림/원금 한도는 기존 helper의 것을 그대로 쓴다.

## 실제 PG 검증

새 도구는 환경을 비운 `NODE_ENV=test/RUN_SCHEDULERS=false`에서 자기 전용 임시 PostgreSQL을 만든다. TCP·외부 의존성·환경 파일 읽기를 차단하고 지정한 Unix socket에만 연결한다. 애플리케이션 부팅·전체 migration·실제 계정·체인·API 호출은 없다. 실제 lottery/dividend 소스와 SQL을 실행하고 별도 연결로 정산 상태를 읽었다.

9개 검증군이 통과했다.

1. 수정 전 보존본의 당첨금/회차만 commit되고 별도 적립은 실패하는 재현.
2. 실제 SQL division-by-zero 적립 실패 후 당첨금0·당첨표0·회차open·pool0으로 전체 복구. 정상 재시도 후 당첨금95·pool1.5가 한 번 정산되며 중복 호출은 그대로 유지.
3. 동시 추첨 호출에서도 당첨금95/pool1.5/당첨표1개만 유지.
4. pool 테이블 부재42P01에서 전체 롤백, 테이블 복구 후 한 번 정산.
5. pool 금액 컬럼 부재42703에서도 전체 롤백, 컬럼 복구 후 한 번 정산.
6. `dividends_enabled=false`면 pool 부재에서도 의도된 무적립으로 정산.
7. `dividends_lottery_pct=0`도 동일한 무적립 정책 유지.
8. 현행179/296 형태의 `house_gp` 없는 회차는 기존 당첨금만 처리하며 원금을 추정하지 않음.
9. 마켓의 optional missing-pool 반환0 후에도 같은 트랜잭션의 `SELECT 1`과 COMMIT이 정상.

추가 좁은 unit/VM10/10(새5+기존 마켓/ship5), 실패0·skip0. await 순서·같은 client·전체 rollback·explicit0/disabled·현행 base 부재를 확인했다. unit과 PG 검증군은 서로 다른 단위이므로 합산된 테스트 수로 표시하지 않는다. 소스 syntax 검사도 통과했다. 독립 읽기 리뷰에서 이 범위의 추가 material bug는 발견되지 않았다.

```sh
node --require ./server/tests/isolation-guard.cjs --test server/tests/lottery-dividend-safety.test.js server/tests/market-dividend-safety.test.js
/usr/bin/env -i PATH=/Users/jongho/.local/bin:/opt/homebrew/bin:/usr/bin:/bin NODE_ENV=test RUN_SCHEDULERS=false node server/tools/lottery_dividend_isolated_regression.js
```

[실제 PG 원문](../../../outputs/evidence/lottery-dividend-followup-20261021/private-pg.log), [unit 원문](../../../outputs/evidence/lottery-dividend-followup-20261021/unit-tests.tap), [수정 전 소스 해시](../../../outputs/evidence/lottery-dividend-followup-20261021/before-source.json), [최종 검증 기록](../../../outputs/evidence/lottery-dividend-followup-20261021/final-receipt.json). 도구는 자기 PG를 종료하고 `/tmp/oc-lottery-VG6y3a`를 삭제했으며 idle-in-transaction 연결도 남기지 않았다.

## 유지한 정책과 남은 경계

**현행 migration179에는 `house_gp`가 없고, 현재 `buyTickets()`도 계산한 하우스 금액을 저장하지 않는다.** archived105에는 컬럼이 있지만 자동 적용 대상이 아니다. 이번 수정은 이미 기록된 양수 legacy 원금의 원자성을 보호한다. 현행 무기록 원금을 과거 티켓 수나 현재 설정으로 역산하지 않았고, 새로운 컬럼·하우스 누적·과거 pool을 발행하지 않았다. 따라서 현재 구매부터 배당 기준액이 계속 적립되는 전체 복권 경제를 완료했다고 보고할 수 없다. 이 부재는 실제 소스 근거가 있는 별도 데이터/정책 경계다.

다음 회차 생성은 기존처럼 COMMIT 후 별도 작업이다. `drawRound()`는 오류를 기록하고 삼키며 `drawExpiredRounds()`는 시도한 회차도 `drawn++`한다. 그 반환 개수는 성공 증거로 사용하지 않았다. 검증은 DB 잔액·회차·당첨표·pool 상태로 판정했다. 스케줄러 집계·다음 회차 생성·전체 복권 상품 개편·주간 배당 지급은 이번 좁은 수정에 포함하지 않았다.

원본 Desktop 프로젝트와 다른 작업자의 변경은 건드리지 않았다. 기존42회 모델 산출물도 바꾸지 않았다. 이 실제 PG 회귀는 오프라인 행동 모델의100초 CPU 예산과 별도인 좁은 코드 정합성 검증이다.
