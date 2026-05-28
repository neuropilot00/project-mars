# OCCUPY MARS — 보안/안정성 하드닝 v7.187 ~ v7.191

> 다음 사람이 이어받아도 즉시 파악할 수 있도록 작성.
> 마지막 갱신: 2026-05-28

---

## 0. 한눈에 보기

5명 페르소나 팀 + Codex 독립 리뷰 + 후속 회귀 감사 (총 3라운드) 결과 발견된 보안/안정성 결함을 수정한 패치 묶음.

| 버전 | 핵심 | 영향 |
|---|---|---|
| v7.187 | CSP `frame-ancestors` `'none'→'self'` | 🔴 전술 실험실이 열리지 않던 문제 핫픽스 |
| v7.188 | 함대전 + VFX 1차 감사 픽스 (5건) | 🔴 forfeit race, Phase 2 stuck, VFX silent fallback |
| v7.189 | 5도메인 + Codex 감사 픽스 (8건) | 🔴 머니플로, 솔벤시, postMessage, 온보딩, leader |
| v7.190 | UI 재배치 + Defer 7건 | 🟡 좌측 컬럼 정렬, referral cap, WS backpressure, srvErr 헬퍼 |
| v7.191 | 캐시 무효화 + 잔여 하드닝 (4건) | 🔴 전술랩 VFX 가시화, JWT, HSTS, bcrypt 통일 |

---

## 1. 변경 인벤토리

### v7.187 — CSP 핫픽스
- **위치**: `server/index.js:210`
- **변경**: `frame-ancestors 'none'` → `'self'`
- **이유**: tactical-lab-v11.html iframe 이 같은 도메인에서도 차단되어 전술 실험실이 안 열림.
- **영향 범위**: same-origin iframe 임베드만 허용, cross-origin clickjacking 보호는 유지.

### v7.188 — 함대전 + VFX 1차 감사 픽스
| ID | 위치 | 수정 |
|---|---|---|
| B1 | `assets/tactical-lab-v11.html:~862` | `VFX_EXPLOSION_FAIL` 카운터 추가 — 1장 404 시 캔버스 폴백 |
| B2 | `routes/fleetBattles.js:399` forfeit | `SELECT ... FOR UPDATE` + `WHERE status='preparing'` 가드 |
| B3 | `services/hijack.js:265` startPhase2 | atk 함대 alive=0 차단 → 영구 잠금 방지 |
| B4 | `services/hijack.js:807` recoverOrphanedPhase2 | 부팅 시 sweep — setTimeout(3s) 중 프로세스 사망 복구 |
| B5 | `services/battleScheduler.js:18` | `MAX_CONCURRENT` 하드코딩 제거 → `battle_max_concurrent` settings 매 tick 재조회 |

### v7.189 — 5도메인 + Codex 감사 픽스
| ID | 위치 | 수정 |
|---|---|---|
| C1 | `routes/api.js:2073` `/swap` | `lockRoom(client, w)` → `wallet` (정의 안 된 변수) |
| C2 | `routes/api.js:2206,2350` withdraw | `try{}catch(_){}` 제거 — `adjustCollateral` 실패 시 fail-CLOSED |
| C3 | `index.html:51576` postMessage | `ev.origin !== location.origin` 검증 추가 |
| C4 | `services/onboarding.js:193` UPDATE | NOW() 분리 + 재인덱싱 — step 진행 차단 위험 해소 |
| C5 | `services/leader.js:46,65` | ioredis 미설치 / Redis 다운 시 fail-CLOSED 통일 |
| C6 | `index.html:41943` `_updateBaseBtnDot` | 누락 6개 카테고리 추가 (shop/market/items/pvp/transport/fleet) |
| C7 | `services/hijack.js:807` | `FOR UPDATE SKIP LOCKED` + TX wrapping |
| C8 | `wsServer.js:70~87` | upgrade 실패 시 _releaseConn 누수 차단 (upgradeGuard) |

### v7.190 — UI 재배치 + Defer 7건
| ID | 위치 | 수정 |
|---|---|---|
| D1 | `index.html` CSS | 오늘의 추천 + 캠페인 + 함선 가챠 모두 좌측 컬럼으로 통일 (데탑/모바일) |
| D2 | `db.js:450` referral pool | `poolRemaining` 트래킹 — t1+t2+t3 > 100% 시 pool 초과 mint 차단 |
| D3 | `services/campaign.js:1565,1568` | `type IN ('mining','instant_harvest')` 확장 |
| D4 | `migrations/237_*.sql:25` | `WHERE grade IS NULL` 가드 — schema_migrations 수동 재실행 보호 |
| D5 | `wsServer.js:~200` | `_safeSendOrTerminate` — `bufferedAmount > 1MB` 시 `terminate()` |
| D6 | `index.html:20572` | `srvErr(code)` 4언어 매핑 헬퍼 (28 코드) + 10 hot-spot 패치 |
| D7 | `index.html:~24291` sparkline | `dataset.sparkToken` race 가드 |

### v7.191 — 캐시 무효화 + 잔여 하드닝
| ID | 위치 | 수정 |
|---|---|---|
| E1 | `index.html:54071` openTacticalLab | `?v=20260502b → ?v=20260528-vfx` 캐시 강제 무효화 |
| E2 | `sw.js:19` CACHE_NAME | `mars-v13 → mars-v14` (v13 캐시 전부 삭제) |
| E3 | `tactical-lab-v11.html:1` | 상단 큰 주석 블록 — 누적 VFX 패치 인벤토리 + 변경 라인 + 백업/롤백 |
| E4 | `routes/auth.js:943,972` | `process.env.JWT_SECRET \|\| 'dev-secret'` → `JWT_SECRET` 상수 |
| E5 | `routes/auth.js:5` | `BCRYPT_COST=12` 통일 (이전 10/12 혼재) |
| E6 | `index.js:~207` | HSTS 헤더 `max-age=63072000` (production only) |
| E7 | `services/leader.js:37` | production + REDIS_URL 누락 + RUN_SCHEDULERS≠'true' → fail-CLOSED |
| E8 | `routes/admin.js:1796` `/gp/grant` | `gp_activity_log` 도 기록 (유저 거래원장 일관성) |

---

## 2. 운영 가이드

### 환경 변수 (필수)
```bash
# Production
NODE_ENV=production
JWT_SECRET=<32+ char random>           # 필수 — 누락 시 부팅 fatal
ADMIN_SECRET=<long random>             # admin 라우트 인증
DATABASE_URL=postgresql://...

# 멀티 인스턴스 (Railway 다중 워커)
REDIS_URL=redis://...                  # 리더 election + WS 팬아웃

# 단일 인스턴스 (REDIS_URL 없을 때)
RUN_SCHEDULERS=true                    # 명시적으로 단일 워커임을 선언

# 또는 명시적 web-only 워커
RUN_SCHEDULERS=false
```

### Leader 동작 매트릭스 (v7.191 기준)

| REDIS_URL | NODE_ENV | RUN_SCHEDULERS | 결과 |
|---|---|---|---|
| 있음 | * | * | Redis 락 경쟁 (정상) |
| 없음 | production | "true" | 단일 워커 → 리더 |
| 없음 | production | (미설정) | **fail-CLOSED 미실행** ⚠ |
| 없음 | development | * | 리더 (개발 편의) |
| 있음 | * | "false" | 명시적 web-only |

### tactical-lab 수정 시
파일 (`assets/tactical-lab-v11.html`) 수정 후 반드시:
1. `index.html` 의 `openTacticalLab()` 안 `?v=` 값을 새 날짜로 갱신
2. `sw.js` CACHE_NAME 도 같이 bump (선택 — VFX 폴더만 바뀐 경우 network-first 라 자동)

이 두 조치 없으면 사용자에게 옛 버전 노출 (v7.190 까지 발생했던 문제).

### 다음 사람을 위한 메모
- `srvErr(code)` 헬퍼: 새 코드에서 `showToast(srvErr(d.error), 'error')` 형태 사용. 기존 raw 호출도 점진 마이그 가능
- `triggerScreenShake(intensity, ms)` / `triggerMiniSlowmo(durMs)`: VFX 트리거 — applyDmg 외에서도 호출 가능 (예: 영토 정복 성공 시)
- `recoverOrphanedPhase2()`: scheduler.start() 안에서 자동 호출. 별도 cron 안 만들어도 됨

---

## 3. 회귀 감사 결과 (v7.187~v7.191)

총 4 라운드 + Codex 1회. 발견 23건 중:
- **수정 완료**: 18건 (위 인벤토리)
- **Defer 진행**: 5건 (다음 항목)

### Defer (다음 스프린트)
| ID | 영역 | 내용 |
|---|---|---|
| F1 | WS scheduler | 멀티 워커 frame stream 중복 — claim TX 가 차단하나 N배 부하 |
| F2 | CSP | 페이지별 frame-ancestors (현재 'self' 는 same-origin XSS 시 위험) |
| F3 | 캠페인 | FSP CH10 함선 보상 의도 명확화 (token-only인지 ship-grant 누락인지) |
| F4 | 마켓 | wash-trade 탐지 (같은 IP/referrer 자기거래 패턴) — 새 스키마 필요 |
| F5 | 라우트 청소 | dead endpoint 5건 정리 (branding/clear, highlight/active 등) |

---

## 4. 검수 매트릭스

```
[ ] tactical-lab 진입 → 폭발 PNG + 화면 흔들림 + 슬로모 보임
[ ] 모바일 좌측: 오늘의 추천 / 가챠 / 캠페인 세로 정렬
[ ] 마켓 함선 구매 모달 → 가격 sparkline (잠시 후 모달 닫기 시 다른 모달 미오염)
[ ] 마켓 에러 토스트 4언어 (INSUFFICIENT_GP / SHIP_LISTED_FOR_SALE 등)
[ ] BASE 임무 카테고리 dot → 영토/경제/커뮤니티 카테고리에도 동시 점멸
[ ] forfeit 동시 2회 클릭 → 한 쪽 cancelled, 다른 쪽 already_resolved
[ ] hijack Phase 1 종료 직후 서버 재시작 → 부팅 후 sweep 로그 + Phase 2 진행
[ ] withdraw → adjustCollateral 실패 시 잔액 변경 ROLLBACK 확인
[ ] HSTS 헤더 응답 확인 (production): curl -I → Strict-Transport-Security present
[ ] JWT 인증 password-change/delete 정상 (dev-secret fallback 제거됨)
```

---

## 5. 롤백 절차

각 변경은 단일 commit. 롤백 명령:

```bash
# 전부 되돌리기 (v7.187 ~ v7.191)
git revert 4efdb02 5f98633 aeedd86 2632938 cf35f4a c84a2f5

# 일부만 (예: VFX 만)
git revert 4efdb02 cf35f4a 338c38c 3c6d903

# 한 줄짜리 핵심 핫픽스 (CSP)
git revert c84a2f5  # → 전술 실험실 다시 안 열림 (주의!)

# 자산 백업 (PNG 폴더)
rm -rf assets/fx/  # 캔버스 폴백 자동 동작

# tactical-lab 백업
cp assets/_backup_v178_tactical-lab-v11.html assets/tactical-lab-v11.html
```

---

## 6. 코드 주석 정책 (v7.191 이후)

다음 사람이 이어서 작업할 수 있도록 모든 머니/보안/race 관련 변경은:

```javascript
// [vX.Y.Z fix] 무엇이 바뀌었는지 한 줄
// 이전 동작: ... (왜 깨졌는지)
// 새 동작: ... (어떻게 고쳤는지)
// 영향: ... (다른 파일/시스템 관련)
```

3줄 주석 형식. `[vX.Y.Z fix]` 태그가 있으면 grep 으로 모든 보안 패치 한 번에 찾을 수 있음.

검색 명령:
```bash
grep -rn "\[v7\." server/ index.html assets/tactical-lab-v11.html | sort
```

---

*다음 손볼 사람: 이 문서 + `docs/FLEET_BATTLE_CHANGELOG_v7.179-188.md` + `tactical-lab-v11.html` 상단 주석 블록 먼저 읽으면 됨.*
