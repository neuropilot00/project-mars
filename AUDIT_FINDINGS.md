# 코드베이스 일제 감사 결과 (2026-04-25)

## 1. Settings 시드 누락 (CLAUDE.md "No Hardcoding" 위반)
다음 13개 서비스가 `getSetting()`을 사용하지만 settings 테이블에 키가 시드되지 않음 → 모두 하드코딩 default fallback 사용 중. admin이 조정 불가능.

| 서비스 | getSetting() 호출 | seeded |
|---|---|---|
| prestige | 7 | 0 ❌ |
| news | 8 | 0 ❌ |
| branding | 7 | 0 ❌ |
| tdesc | 5 | 0 ❌ |
| tiers | 8 | 0 ❌ |
| donation | 6 | 0 ❌ |
| capsule | 7 | 0 ❌ |
| sponsor | 6 | 0 ❌ |
| beacon | 8 | 0 ❌ |
| status | 6 | 0 ❌ |
| tevt | 14 | 0 ❌ |
| polls | 9 | 0 ❌ |
| wager | 5 | 0 ❌ |

→ **Migration 필요**: 각 서비스가 사용하는 키 추출 → settings에 default 값 시드.
→ **추가 작업**: admin.html에 각 카테고리 편집 섹션 추가.

## 2. Phantom 테이블 (해소됨, migration 176~180)
모두 처리됨.

## 3. 코드 fragmentation (audit agent 진행 중)
대기 중.

## 4. 처리 보류 (의도적)
- battle.js 구버전 픽셀 전투 — fleet system과 fragmentation. 결정 필요.
- routes/ships.js 구버전 단순 함선 — fleet ship과 충돌 가능.

## 5. 기능별 동작 상태 정리 (예정)
duplicate audit 결과 + settings 시드 처리 후 작성.
