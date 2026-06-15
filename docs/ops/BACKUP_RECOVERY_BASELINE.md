# OCCUPY MARS — Backup / Recovery Baseline

> 목적: 장애가 나도 복구 절차가 전혀 없는 상태를 끝낸다.

---

## 1. Scope

이 문서는 최소 기준을 정의한다.
- 무엇을 백업해야 하는가
- 얼마나 자주 백업하는가
- 복구 시 무엇을 확인하는가
- 최소 복구 기록은 무엇인가

---

## 2. Minimum Assets to Protect

우선순위 순:
1. PostgreSQL 데이터
2. 배포 환경변수 (`ADMIN_SECRET` 포함)
3. 운영 커밋 SHA / 배포 이력
4. 캠페인/운영 문서

---

## 3. Backup Baseline

### Database
- 최소 일 1회 전체 백업
- 주요 배포 전 추가 백업 권장
- 보관 주기: 최근 7일 이상 권장
- 사전 점검은 `npm run backup:verify`로 수행 가능
- 복구 리허설은 격리된 빈 DB를 만든 뒤 `RESTORE_DATABASE_URL=<throwaway-db-url> npm run backup:rehearse`로 수행한다.
  - 최신 `server/backups/backup_*.sql.gz`를 실제로 `psql`에 적용한다.
  - 복원된 DB에서 `users`, `settings`, `transactions`, `admin_audit_log` 테이블 존재/조회와 핵심 경제 설정을 확인한다.
  - `RESTORE_DATABASE_URL`이 없거나 `DATABASE_URL`과 같으면 실패한다.

### Environment / Secrets
- 값 자체를 평문 문서화하지 말고,
- 어떤 env가 필수인지 목록만 관리
- 변경 시각과 담당자만 기록

### Code / Docs
- GitHub 원격 저장소가 1차 기준
- 배포 직전 커밋 SHA를 운영 기록에 남김

---

## 4. Recovery Targets

권장 목표:
- 장애 인지 후 15분 안에 상태 판단
- 30분 안에 롤백 또는 임시 복구 결정
- 60분 안에 기본 플레이 루프 복구 목표

이 수치는 운영 성숙도에 따라 조정 가능.

---

## 5. Recovery Procedure (Minimum)

1. 장애 범위 확인
2. 앱 문제인지 DB 문제인지 구분
3. 최근 정상 SHA 확인
4. DB 백업 시점 확인
5. 아래 중 하나 선택
   - 코드 롤백
   - DB 복구
   - 둘 다
6. 복구 후 L1 스모크 실행
7. 경제/권한/관리자 동선 재확인

---

## 6. Recovery Validation

복구 후 최소 확인:
- [ ] 메인 진입 가능
- [ ] 로그인 가능
- [ ] 관리자 로그인 가능
- [ ] `/api/config` 응답 정상
- [ ] 내 영토/인벤토리/Shipyard/Campaign 중 3개 이상 정상

백업 리허설에서 자동으로 확인하는 최소 DB 증거:
- [ ] 백업 SQL이 격리 DB에 에러 없이 적용됨
- [ ] 핵심 테이블이 존재하고 `SELECT COUNT(*)` 가능
- [ ] 핵심 경제 설정(`deposit_pp_bonus`, `withdraw_fee_percent`, `signup_pp_bonus`) 조회 가능

경제/권한 이슈가 있었으면 추가 확인:
- [ ] 출금 최소값 응답 정상
- [ ] 관리자 핵심 탭 정상
- [ ] 시크릿/테스트 공개 경로 노출 없음

운영 환경에서만 최종 확인 가능한 항목:
- [ ] Railway/cron 등 자동 백업 스케줄이 실제 운영 DB 대상으로 실행 중인지
- [ ] 운영 백업 보관 위치와 보존 주기가 정책과 일치하는지
- [ ] 운영 백업 파일을 운영과 같은 PostgreSQL 버전/권한 모델의 격리 DB에 복원했는지
- [ ] 복원 DB로 서버를 부팅한 뒤 로그인/관리자/기본 플레이 루프 L1 스모크가 통과하는지
- [ ] 실제 RTO/RPO와 담당자 접근 권한이 사고 대응 목표를 만족하는지

---

## 7. Recovery Log Template

```md
- incident:
- detected_at:
- impact:
- app_or_db:
- backup_point_used:
- rollback_sha:
- recovered_at:
- validation_result:
- followup:
```

---

## 8. Next Step

이 문서는 baseline이다. 다음 보강 후보:
- 복구 리허설 주기 고정
- 운영 env inventory 문서화
- backup artifact 보관 위치/보존 주기 문서화
