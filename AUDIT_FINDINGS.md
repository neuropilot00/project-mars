# 코드베이스 일제 감사 결과 (2026-04-25 — 심화 작업 완료)

## 📊 최종 통계
- **DB 테이블**: 219개
- **Settings 키**: 907개 (모든 라이브 기능 admin 조정 가능)
- **업적**: 29개 (4 카테고리, 4 언어)
- **마이그레이션**: 156개 적용 (~001 - 183)
- **세션 누적 커밋**: 19+

## 🟢 라이브 핵심 시스템 (모두 정상)

| 시스템 | 상태 | 비고 |
|---|---|---|
| 유저 인증/지갑 | ✅ | JWT + email + wallet_address |
| 클레임/픽셀 | ✅ | 핵심 게임 루프 |
| GP 경제 | ✅ | gp_balance + gp_transactions + gp_activity_log |
| 하이잭 | ✅ | 2-Phase 전투, 자동 배틀뷰어 |
| Fleet Combat | 🟡 | `fleet_combat_enabled = false` (게이트됨) |
| 공성전 | ✅ | 섹터 거버너 |
| 거버넌스 | ✅ | 커맨더/거버너/세금 |
| 시즌 점수 | ✅ | addSeasonScore |
| 날씨 | ✅ | 전략 컬럼 추가됨 |
| 길드 | ✅ | 레벨업/수송 동작 |
| 수송/약탈 | ✅ | Phase C |
| 일일 미션 | ✅ | settings 시드됨 |
| 마켓플레이스 | ✅ | 아이템 거래 |
| 아이템 강화 | ✅ | 코스메틱 +1~+10 |
| 옥션 | ✅ | inventory 정정 완료 |
| 로켓 보급 드롭 | ✅ | 트리거 fix |
| POI 탐험 | ✅ | 4h 스폰 |
| VIP | ✅ | |
| Colony Prestige | ✅ | settings 시드됨 |
| Territory Prestige | ✅ | |
| **PVP 베팅** | ✅ | warBetting 단일 시스템 통합 |
| **업적** | ✅ | 29개 + 자동 트리거 와이어링 |

## 🟢 보조 기능 (모두 동작 + admin 조정 가능)

| 기능 | DB | Settings | UI | 트리거 |
|---|---|---|---|---|
| 영토 브랜딩 | ✅ | ✅ | ✅ | — |
| 영토 설명 (tdesc) | ✅ | ✅ | ✅ | — |
| 기념물 (monuments) | ✅ | ✅ | ✅ | — |
| 영토 티어 (tiers) | ✅ | ✅ | ✅ | — |
| 영토 주문 (spells) | ✅ | ✅ | ✅ | — |
| 영토 이벤트 (tevt) | ✅ | ✅ | ✅ | — |
| 영토 스폰서 | ✅ | ✅ | ✅ | — |
| 영토 실드 | ✅ | ✅ | ✅ | — |
| 영토 임대 (rental) | ✅ | — | ✅ | — |
| 영토 업그레이드 | ✅ | — | ✅ | — |
| 무덤/그래피티/평가/명함/공물/일기/마일스톤/하이라이트/배너 | ✅ | ✅ | ✅ | — |
| 상태 메시지 / 비콘 / 캡슐 | ✅ | ✅ | ✅ | — |
| 스테이킹 | ✅ | ✅ | ✅ | — |
| 투표 (polls) | ✅ | ✅ | ✅ | — |
| 베팅 (wager) | ✅ | ✅ | ✅ | — |
| 미술 콘테스트 | ✅ | ✅ | ✅ | — |
| 기부 (donation) | ✅ | ✅ | ✅ | — |
| 공지 (broadcast) | ✅ | ✅ | ✅ | — |
| 원정 (expedition) | ✅ | ✅ | ✅ | — |
| 복권 (lottery) | ✅ | — | ✅ | — |
| 배당 (dividends) | ✅ | — | ✅ | — |
| 행성 뉴스 | ✅ | ✅ | — | auto |
| 래플 (raffle) | ✅ | ✅ | ✅ admin | — |
| 크래프팅 | ✅ | ✅ | ✅ | — |
| 토너먼트 (단순) | ✅ | — | ✅ | — |
| 프로필 변경 로그 | ✅ | — | — | auto |
| 업적 | ✅ | ✅ | ✅ | ✅ auto-trigger |

## 🏗️ 의도된 레이어드 아키텍처 (병합 불필요)

| 페어 | 역할 |
|---|---|
| chronicle + chronicleEnhanced | base 이벤트 + Discord/특수 이벤트 wrapper |
| title + titleExtended | 기본 13종 + 확장 11종 |
| enhancement + enhancementAdvanced | 인스턴싱 ops + 레시피 보너스 |
| job + jobs (routes) | user-ops + admin / catalog + select |
| resource + resources (routes) | admin + rate / user catalog |
| auction + auctionRoutes | 거래 ops / 목록 |
| tournament + tournaments | fleet 토너먼트 / 단순 GP entry-fee |

## ❌ 정리 완료 (이번 심화 작업)

### Dead 코드 일괄 제거 (10 파일)
- weeklyChallenges, gpBurn, bounty, luckyBox (서비스 + 라우트)
- factionRoutes (v2), factionSystem (서비스)
- onboarding (v1), territoryRoutes, public, publicRoutes, betting, battle (서비스+라우트)

### 통합 / 마이그레이션
- betting v1 → warBetting v2 (호환 endpoint 추가, 5min/60s 스케줄러 통합)
- battle.js 깨진 시스템 제거 → fleet_battles + Hijack로 PVP 통합
- 39개 phantom 테이블 생성 (migration 176~180)
- 88개 + 78개 settings 시드 (migration 181, 182)
- 29개 업적 + 4 언어 (migration 183)

### 일괄 버그 수정
- users.wallet → wallet_address (18 서비스)
- gp_balances → users.gp_balance (8 서비스: branding, contest, expedition, spells, crafting, broadcasts, rental, tournaments)
- admin.js JSONB UPDATE 일괄 fix (25곳 cast + 38곳 stringify)
- 인벤토리 컬럼 mismatch (auction, worldEvents, tombstone)
- achievements condition_type 정합성 (battle_wins → battle_win_count 등)

### 추가 기능 와이어링
- achievements auto-trigger: claim, battle, marketplace, ship build, guild join, signup
- routes/auth.js: 추천인 referral_count 자동 체크
- 모든 핵심 서비스 헤더에 STATUS/Flow/DB/Settings 주석 (hijack, rocket, prestige, tprestige, battle)

## 🟡 의도적 보류 (향후 작업)

| 항목 | 사유 |
|---|---|
| Fleet Combat 활성화 | `fleet_combat_enabled = true`로 변경 + UI 점검 필요 |
| routes/ships.js (구버전) | fleet 활성화 시 비활성화 검토 |
| services/news.js news_max_items 폴리시 | retention 관리 작동 중 |
| referral_count 진행 컬럼 캐싱 | 현재 매 호출 COUNT(*) — 대용량 시 최적화 필요 |

## ✅ 최종 무결성 검증
- DB 219 tables, 907 settings, 29 achievements, 156 migrations
- 모든 services/routes require 스모크 테스트 통과
- 서버 부팅 정상 (스케줄러 모두 깨끗하게 시작)
- AUDIT_FINDINGS.md / CLAUDE.md 최신화

→ **새 Claude/사람이 와도 이 문서만 읽으면 즉시 작업 가능 상태.**
