# 함대전 변경 인벤토리 (v7.179 ~ v7.188)

> 검수 체크리스트. 각 항목은 파일/라인/검증 방법 명시.
> 마지막 갱신: 2026-05-28

---

## A. 클라이언트 (tactical-lab-v11.html) — 시각 업그레이드

### A1. v7.179 격침 시네마틱 — 화면 흔들림 + 미니 슬로모
**파일**: `assets/tactical-lab-v11.html`

| 변경 | 라인 (대략) | 검증 |
|---|---|---|
| 새 전역 변수 `_shakeIntensity`, `_shakeDecay`, `_miniSlowmoUntil` | ~2197 | grep 결과 다른 변수와 충돌 없음 |
| 함수 `triggerScreenShake(intensity, ms)` | ~2207 | function declaration (hoist OK) |
| 함수 `triggerMiniSlowmo(durMs)` | ~2212 | `_slowmoActive` 가드 — 마지막 격침 슬로모와 충돌 방지 |
| `applyDmg` 안 함급별 cascade 분기 | ~1581 | titan=14/900ms shake, BS=9/650, cruiser=5/400, dst=3/280, frg=1.5/180 |
| 타이탄 격침 → 충격파 + 2차 폭발 3발 연쇄 | ~1591 | `setTimeout(...,i*90+60)` |
| 메인 loop dt 계산에 `_slowmoMul=0.45` | ~2360 | WS 모드/메인 슬로모 중에는 적용 안 함 |
| `CX.translate(W/2+_shakeX, H/2+_shakeY)` | ~2447 | save/restore 균형 유지 |

**검수 시나리오**:
1. AI vs AI 함대전 띄우고 타이탄 격침 시 화면 흔들림 + 0.45x 시뮬 속도 다운 확인
2. 동시 다중 격침 — shake 중첩되지 않고 더 강한 게 우선
3. 마지막 함선 격침 슬로모와 미니 슬로모 동시 트리거 시 마지막 슬로모만 적용

### A2. v7.179 폭발 다층화
**파일**: `assets/tactical-lab-v11.html`

| 변경 | 라인 | 검증 |
|---|---|---|
| `mkExp` smoke 파티클 + decay | ~1648 | exps 객체에 `smoke` 배열 추가 |
| `drawExps` 렌더 단계: 연기 → 코어 플래시(radial gradient) → 파편(additive) → 흰 코어 | ~2238 | `globalCompositeOperation` lighter ↔ source-over 균형 |
| `drawLasers` 빔 끝점 임팩트 플래시 (radial gradient) | ~2216 | `prog<.3` 동안만, additive |

### A3. v7.180 PNG VFX 스프라이트
**파일**: `assets/tactical-lab-v11.html`, `assets/fx/`

| 변경 | 라인 / 경로 | 검증 |
|---|---|---|
| 8단계 폭발 PNG 프리로드 | ~860 | `explosion_01.png ~ explosion_08.png` 모두 존재 |
| 4종 빔 임팩트 PNG 프리로드 | ~870 | `impact_red/orange/cyan/white.png` |
| 색상 → impact key 매핑 `vfxImpactKeyForColor()` | ~878 | ff6/ef5 → orange, 00b/cyan → cyan, e53/f00 → red, fallback white |
| drawExps PNG 시퀀스 합성 (additive) | ~2244 | `spritesReady` true 시에만 실행, 캔버스 폴백 유지 |
| drawLasers PNG 임팩트 우선, gradient fallback | ~2217 | `imImpact.complete && naturalWidth>0` 체크 |

### A4. v7.188 VFX fallback 견고화
**파일**: `assets/tactical-lab-v11.html`

| 변경 | 라인 | 검증 |
|---|---|---|
| `VFX_EXPLOSION_FAIL` 카운터 추가 (onerror) | ~862 | 8 중 일부 404 면 PNG 합성 비활성화 → 캔버스 폴백 |
| `spritesReady = READY===8 && FAIL===0` 게이트 | ~2244 | half-loaded silent state 방지 |

### A5. sw.js v13 — `/assets/fx/` network-first
**파일**: `sw.js`

| 변경 | 라인 | 검증 |
|---|---|---|
| CACHE_NAME `mars-v12` → `mars-v13` | 19 | activate 시 v12 캐시 폐기 |
| network-first 등록 | ~107 | fx 폴더 미래 재생성 시 stale 캐시 방지 |

---

## B. 서버 — 함대전 백엔드 견고화 (v7.188)

### B1. Forfeit race 차단
**파일**: `server/routes/fleetBattles.js`
**위치**: `router.post('/:id/forfeit')` 약 line 399~

| 변경 | 검증 |
|---|---|
| `SELECT status FROM fleet_battles WHERE id=$1 FOR UPDATE` (row lock) | 동시 forfeit POST 2회 — 한 쪽만 처리, 다른 쪽은 `already_resolved` 반환 |
| UPDATE 에 `WHERE id=$1 AND status='preparing'` 추가 가드 | scheduler 가 중간에 claim 했어도 zeros 덮어쓰기 안 함 |
| rowCount=0 → `already_resolved` 반환 | 데이터 손실 0 |

**검수**: 같은 battleId 로 2탭에서 동시에 FORFEIT 버튼 클릭 → 한 쪽 cancelled, 다른 쪽 already_resolved

### B2. Hijack Phase 2 빈 함대 가드
**파일**: `server/services/hijack.js`
**위치**: `startPhase2()` 약 line 264~

| 변경 | 검증 |
|---|---|
| TX 안에서 `SELECT COUNT(*) FROM ships WHERE fleet_id=$atk AND is_alive=true` | atk alive=0 이면 즉시 hijack 실패 처리 |
| 빈 함대 시 `phase='failed'`, fleets `is_in_battle=false` 해제 | 영구 잠금 차단 |

**검수**: `hijack_ship_loss_enabled=true` 설정 후 Phase 1 에서 attacker 전멸 → Phase 2 자동 실행 시 즉시 종료, 함대 잠금 해제됨

### B3. Hijack Phase 2 orphan 복구
**파일**: `server/services/hijack.js`, `server/services/battleScheduler.js`

| 변경 | 위치 | 검증 |
|---|---|---|
| 함수 `recoverOrphanedPhase2()` export | hijack.js line ~807 | `phase='phase2' AND phase2_battle_id IS NULL AND phase1_ended_at < NOW()-30s` sweep |
| `battleScheduler.start()` 안에서 호출 | battleScheduler.js line ~63 | 서버 부팅 시 1회 자동 실행 |

**검수**: Phase 1 종료 직후 (setTimeout 3s 대기 중) 서버 kill -9 → 재시작 → orphan sweep 로그 + Phase 2 자동 시작

### B4. `battle_max_concurrent` 설정 honor
**파일**: `server/services/battleScheduler.js`

| 변경 | 위치 | 검증 |
|---|---|---|
| 하드코딩 `MAX_CONCURRENT=2` 제거 | line 18 | grep 결과 더 이상 const 아님 |
| `_readMaxConcurrent()` 매 tick 마다 settings 재조회 + cache fallback (default 3) | line ~22 | admin 이 런타임에 5로 바꾸면 즉시 적용 |
| LIMIT 쿼리에 `maxC - currentlyRunning` 사용 | line ~80 | 동시 N개 실행 보장 |

**검수**: `psql ... -c "UPDATE settings SET value='\"5\"'::jsonb WHERE key='battle_max_concurrent'"` 후 다음 tick 안에 5 까지 실행됨

### B5. CSP `frame-ancestors` 'self' (v7.187 핫픽스)
**파일**: `server/index.js` line ~210

| 변경 | 검증 |
|---|---|
| `frame-ancestors 'none'` → `'self'` | tactical-lab-v11.html iframe 임베드 차단 해제. cross-origin clickjacking 보호는 유지 |

**검수**: Fleet Command → 🧪 TACTICAL LAB 클릭 시 iframe 로드 성공

---

## C. 감사에서 ✅ 통과 확인 (수정 불필요)

- `applyBattleResults` — 단일 TX + `SELECT ... FOR UPDATE` + `status!='ended'` 이중 적용 가드
- `aiFleetManager` SAVEPOINT 올바른 RELEASE/ROLLBACK TO
- Redis leader election + Lua self-renew (services/leader.js)
- CORS regex 메타 이스케이프 + `[a-z0-9-]+` 와일드카드 (v7.170)
- Rate limit Redis 공유 스토어 (apiLimiter + apiWriteLimiter)
- 함선 bonus_atk/def/hp/speed — battleEngine initShip 에서 1회만 합산 (이중 적용 없음)
- VFX 변수 호이스팅, save/restore 균형, world 좌표 합성

---

## D. 알려진 미해결 (다음 스프린트 후보)

| ID | 위험 | 위치 | 내용 |
|---|---|---|---|
| D1 | 🟡 | battleScheduler.js | WS 프레임 mid-simulation 스트리밍 안 됨 — 현재는 시뮬 끝나고 일괄 push. 중간 입장 viewer 가 frame 못 받음. |
| D2 | 🟡 | hijack.js setTimeout | Phase 2 자동 시작이 in-process 3초 타이머 — recoverOrphanedPhase2 sweep 으로 mitigate 했지만 DB-backed schedule 이 더 견고함 |
| D3 | 🟡 | runBattle 호출 경로 | hijack/tournament/worldEvents/phaseC/phaseD/fleetBattles `run_immediately` 가 web 인스턴스에서 직접 runBattle 호출 → leader 게이트 우회 (단 claim TX 가 중복 실행 차단) |
| D4 | 🟡 | combatPowerMult 적용 | 현재 atk 에만 곱셈 — def/speed/hp 는 base 그대로. 디자인 의도 확인 필요 (직업 페널티가 ATK 만 영향) |
| D5 | 🟡 | wsServer.js _admitConn | upgrade 실패 시 _releaseConn 미호출 → IP 카운터 누수 |
| D6 | ⚙ | hijack_battles 스키마 | EVE full-loss 와 Phase 1/2 보존 정책의 일관성 — `hijack_ship_loss_enabled` 토글 시 양 phase 동작 차이 |

---

## E. 검수 시나리오 매트릭스

| 시나리오 | 기대 결과 | 확인 |
|---|---|---|
| AI vs AI 전투, 타이탄 격침 | 화면 14px 흔들림 900ms + 0.45x 슬로모 280-450ms + 폭발 PNG 8장 시퀀스 + 충격파 2차 폭발 3발 | □ |
| AI vs AI 전투, frigate 격침 | 화면 1.5px 가벼운 흔들림 180ms, 슬로모 없음 | □ |
| 전술 실험실 진입 | iframe 로드 + 데모 전투 자동 시작 | □ |
| Forfeit 동시 2회 클릭 | 첫 번째 cancelled, 두 번째 already_resolved, 데이터 그대로 | □ |
| Hijack `ship_loss=true` + 전멸 후 Phase 2 | 즉시 hijack 실패, 함대 잠금 해제 | □ |
| Phase 1 종료 직후 서버 재시작 | 부팅 후 30초 안에 orphan sweep 로그 + Phase 2 자동 시작 | □ |
| `UPDATE settings SET battle_max_concurrent='\"5\"'` | 다음 30s tick 에 5개까지 동시 실행 | □ |
| 폭발 PNG 1장 의도적 404 | 캔버스 폴백으로 깨끗히 fallback (silent half-state 안 남음) | □ |

---

## F. 롤백 절차

| 변경 | 롤백 명령 |
|---|---|
| tactical-lab VFX 전체 | `cp assets/_backup_v178_tactical-lab-v11.html assets/tactical-lab-v11.html` |
| 서버 패치 | `git revert cf35f4a c84a2f5` |
| VFX PNG 폴더만 | `rm -rf assets/fx/` (캔버스 폴백 자동 작동) |
| CSP 변경만 | `server/index.js` line 211 `'self'` → `'none'` (단 tactical-lab 다시 안 열림) |
