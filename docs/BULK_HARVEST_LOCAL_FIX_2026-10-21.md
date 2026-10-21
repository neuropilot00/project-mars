# 일괄 영토 수확 트랜잭션 오류 수정

실제 로컬 전체 앱의 `POST /api/territory/harvest-all`이500으로 실패하고 개별 수확 fallback만200으로 지급되는 상황을 수정했다. QA 계정이나 기존 DB는 이 작업에서 변경하지 않았다.

## 원인과 수정

`getSectorInfluenceProductionBonus`가 `guild_members.status = 'active'`를 조회했지만 migration046과 현재 전체 앱 스키마의 `guild_members`에는 `status` 컬럼이 없다. 이 조회의42703 오류를 helper가 삼켜도 PostgreSQL 트랜잭션은 중단 상태로 남아, 후속 SQL이25P02로 실패했다. 실제 저장된 멤버십 행을 기준으로 조회하도록 존재하지 않는 조건을 제거했다. 다른 소유자의 claim 변경 구간은 수정하지 않았다.

일괄 수확의 선택 보너스/부수효과에서 SQL 오류를 허용할 때는 savepoint로 해당 작업만 되돌린 뒤 필수 지급을 계속하도록 했다. 주지갑 GP·영토 쿨다운·수확 통계·거래 원장은 같은 필수 트랜잭션이다. 보상에 사용한 일회성 surge 소모는 필수 작업으로, 소모 실패 시 보상 전체를 되돌린다. 실패한 광물 부수효과는 재고·응답 수량에 부분 반영하지 않는다.

개별 수확 성공 원인이 helper의 cache였을 가능성은 있으나 이번 브라우저 네트워크 기록만으로 확정하지 않았다. 개별 수확이 helper를 트랜잭션 시작 전에 호출한다는 초기 추정은 소스 확인으로 폐기했다.

## 실제 PostgreSQL 검증

재사용 검사: `server/tools/bulk_harvest_private_pg_regression.js`.

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node server/tools/bulk_harvest_private_pg_regression.js
```

기본 실행은 새 증거 디렉터리를 `/tmp/mars-bulk-evidence-*`에 만들고 경로를 출력한다. 보존된 수정 전 handler/helper가 있는 증거 디렉터리를 인자로 주면 수정 전 실제 handler의500도 재현한다:

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node server/tools/bulk_harvest_private_pg_regression.js /Users/jongho/Documents/Codex/2026-10-10/oc/outputs/evidence/release-20261021/journey/bulk-harvest
```

**10/10 통과**, 임시 PostgreSQL 종료·삭제 확인. 기본 모드와 보존된 수정 전 source를 사용하는 모드 모두 실행했다.

1. 실제 migration 스키마에서 잘못된 `guild_members.status`가42703을 일으키고 다음 SQL이25P02가 되는 것을 확인. 보존된 수정 전 실제 handler에서는500·지급0·원장0 재현.
2. 소유 영토0: `no_territory`, 지급·수확 통계 행 없음.
3. 소유 영토1: 지급/원장/쿨다운1회, 재요청429·추가 지급 없음.
4. 소유 영토3 중1개 쿨다운:2개만 수확, 통계와 지급 합계 일치.
5. 동시 일괄 요청: 사용자 수확 행 잠금으로200/429 한 번씩, 영토별 원장/지급 중복 없음.
6. 일회성 surge:2개 영토 중1개만 배율, 사용 횟수0/비활성화와 지급이 함께 commit.
7. 선택 효과 테이블 부재: 필수 지급 트랜잭션은 정상 완료.
8. 선택 XP 작업이 일부를 쓴 뒤 실제 SQL 실패: XP만 rollback, 지급/원장 유지.
9. 두 번째 영토 필수 원장에 실제 trigger 오류 주입: 첫 원장·모든 쿨다운·통계·GP 전체 rollback.
10. surge 소모에 실제 trigger 오류 주입: 보상·원장 rollback, 사용 가능 횟수 보존.

검사는 새 Unix 소켓 전용 PG16과 선택한 실제 migration의 DDL/ALTER만 사용한다. 생성한 DDL과 migration SHA-256, 실제 오류 코드, handler/helper SHA-256을 기록한다. 필수 상태/수확 SQL은 실제 PostgreSQL에서 실행한다. Express HTTP/auth, 전체 migration chain, 운영 스키마, 실제 QA 계정은 이 검사 범위가 아니다. reward cfg 및 외부 선택 서비스는 고정 fixture이며 네트워크·`.env`·앱 bootstrap·메일·키·체인을 사용하지 않는다.

증거: `outputs/evidence/release-20261021/journey/bulk-harvest/`의 `private-pg-result.json`, `private-pg.log`, `reusable-tool.log`, `actual-migration-ddl.sql`, 수정 전 두 source 사본. 기존 전체 앱은 부모 작업이 데이터 보존 후 재시작해 실제 브라우저 수확 동선을 별도로 확인해야 한다.
