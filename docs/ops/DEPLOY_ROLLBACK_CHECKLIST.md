# OCCUPY MARS — Deploy / Rollback Checklist

> 목적: 배포를 감으로 하지 않고, 같은 순서로 확인하고 실패 시 같은 기준으로 롤백한다.

---

## 1. Pre-deploy

### Git
- [ ] 배포 대상 커밋 SHA 기록
- [ ] 직전 정상 커밋 SHA 기록
- [ ] 변경 파일 목록 확인
- [ ] `git status` 깨끗함 확인

### Risk Review
- [ ] 관리자/경제/출금/캠페인/인증 변경 포함 여부 확인
- [ ] 포함 시 `RELEASE_REGRESSION_CHECKLIST_2026-05-15.md`의 L2까지 수행 예정 표시

### Environment
- [ ] Railway 접근 가능
- [ ] 운영 URL 확인
- [ ] `ADMIN_SECRET` 준비
- [ ] 핵심 env 누락 없음
- [ ] 필요 시 `npm run smoke:db` 실행 가능

---

## 2. Deploy

기본 배포 흐름:
1. `main`에 커밋 반영
2. `git push origin main`
3. Railway 자동 배포 대기
4. 배포 완료 후 L1 스모크 수행

기록할 것:
- 배포 시작 시각
- 커밋 SHA
- 배포 완료 시각
- 담당자

---

## 3. Immediate Post-deploy Smoke

### HTTP
- [ ] 메인 URL 접속
- [ ] `/health`가 200인지 확인
- [ ] `/admin` 접속

### User Flow
- [ ] 로그인 가능
- [ ] 내 영토/인벤토리/Shipyard/Campaign 중 3개 이상 정상

### Admin Flow
- [ ] 관리자 로그인 가능
- [ ] 통계 또는 핵심 탭 정상

### Economy
- [ ] `/api/config` 로드
- [ ] 최소 출금값 이상 없음

---

## 4. Rollback Triggers

아래 중 하나면 즉시 롤백 검토:
- 메인 접속 불가
- 로그인 불가
- 관리자 핵심 탭 불가
- 경제/출금 정합성 이상
- 테스트용 공개 경로/시크릿 노출
- 원인 불명 P0 장애

---

## 5. Rollback Procedure

1. 직전 정상 커밋 SHA 확인
2. 해당 SHA로 되돌릴 방법 결정
   - revert commit
   - known-good SHA 재배포
3. Railway 재배포 확인
4. 롤백 후 L1 스모크 재실행
5. 장애 기록 남김

기록할 것:
- 롤백 기준이 된 증상
- 롤백 대상 SHA
- 롤백 완료 시각
- 롤백 후 상태

---

## 6. Hotfix vs Rollback Rule

### Hotfix 가능
- 영향 범위가 작음
- 경제/권한/오픈 경로와 무관
- 30분 이내 수정/검증 가능

### Rollback 우선
- 경제/권한/시크릿/관리자 회귀
- 첫 진입 불가
- 원인 불명
- 운영자가 즉시 안전성 확신 불가

---

## 7. Postmortem Minimum Notes

- 날짜/시각
- 배포 SHA
- 장애 증상
- 사용자 영향 범위
- 핫픽스 또는 롤백 여부
- 다음 재발 방지 항목
