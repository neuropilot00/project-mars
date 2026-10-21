# 파벌 통계 집계 오류 수정 — 2026-10-21

운영 `GET /api/factions/stats`가 HTTP500 `SERVER_ERROR`를 반환했다. 해당 요청만 필터링한 Railway 로그에는 PostgreSQL 임시 파일 쓰기 실패 `No space left on device`가 반복됐다. 운영 DB·설정·계정은 변경하지 않았다.

`server/services/faction.js`의 기존 쿼리는 파벌에 사용자와 함선을 함께 연결한 뒤 `COUNT(DISTINCT)`로 중복을 제거했다. 파벌별 사용자 수×함선 수만큼 중간 결과가 늘어나 정렬·임시 파일 부담이 커졌다. 두 수치를 별도로 파벌별 집계한 뒤 연결하도록 해당 쿼리만 수정했다. 사용자 수는 기존처럼 `users.faction_code`, 생존 함선 수는 기존처럼 함종의 파벌과 `ships.is_alive`를 따른다. 활성 파벌 필터, 정렬, 0개 표시, 결과 필드와 PostgreSQL bigint 문자열 형식은 유지한다.

독립 회귀 `server/tests/faction-stats-http-pg.cjs`는 전용 임시 PostgreSQL16 클러스터와 Unix HTTP 소켓에서 실제 서비스·Express 라우터를 실행하고 종료 시 정리한다. 운영 연결·환경 파일·계정·외부 네트워크를 사용하지 않는다. 실제 SQL로 기존 결과와 수정 결과가 같음을 확인하고, 사망/null 함선·파벌 미선택·비활성 파벌·0개 파벌·정렬을 검증한다. 실제 HTTP200과 결과도 확인한다. fixture의 `EXPLAIN ANALYZE` 최대 중간 행은 기존647개에서 수정33개로 줄었다.

```sh
/usr/bin/env -i PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/node --test server/tests/faction-stats-http-pg.cjs
```

결과: 1 passed, 0 failed, 0 skipped. 서비스와 테스트 구문 검사도 통과했다. PostgreSQL16 바이너리는 이 워크스페이스의 `/opt/homebrew/opt/postgresql@16/bin`을 사용한다. 소켓을 금지한 일반 `*.test.js` 격리 묶음과 구분하기 위해 명시 실행하는 `.cjs` 테스트로 두었다.

증거: `outputs/production-mobile-qa-20261021/faction-stats-fix/`의 `production-before.txt`, `filtered-production-errors.txt`, `isolated-http-pg.tap`(저장소 밖 작업 산출물 경로).

운영에는 아직 이 변경을 배포하지 않았다. 코드가 대형 중간 결과를 제거한다는 검증이며, 운영 볼륨의 여유 공간을 복구하거나 다른 디스크 사용 원인을 해소했다는 뜻은 아니다. 통합 배포 뒤 실제 통계 응답을 다시 확인해야 한다.
