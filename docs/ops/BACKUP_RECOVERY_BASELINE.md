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

경제/권한 이슈가 있었으면 추가 확인:
- [ ] 출금 최소값 응답 정상
- [ ] 관리자 핵심 탭 정상
- [ ] 시크릿/테스트 공개 경로 노출 없음

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
- 실제 DB 백업 명령/도구 명시
- 복구 리허설 주기 고정
- 운영 env inventory 문서화
- backup artifact 보관 위치/보존 주기 문서화
