# 코드베이스 일제 감사 결과 (2026-04-25)

## 🟢 동작 확인 — 라이브 핵심 시스템

| 시스템 | 상태 | 비고 |
|---|---|---|
| **유저 인증/지갑** | ✅ 정상 | JWT + email + wallet_address |
| **클레임/픽셀** | ✅ 정상 | 핵심 게임 루프 |
| **GP 경제** | ✅ 정상 | gp_balance + gp_transactions + gp_activity_log (migration 177) |
| **하이잭 (Hijack)** | ✅ 정상 | 2-Phase 전투 (commits 8d2148b, c2d35c8, 240ae43) |
| **Fleet Combat** | 🟡 게이트됨 | `fleet_combat_enabled = false`. DB/서비스 준비됨, 활성화만 남음 |
| **공성전 (Siege)** | ✅ 정상 | 섹터 거버너 |
| **거버넌스** | ✅ 정상 | 커맨더/거버너/세금 |
| **시즌 점수** | ✅ 정상 | addSeasonScore fire-and-forget |
| **날씨** | ✅ 정상 | migration 174 |
| **길드** | ✅ 정상 | commit 6bbc166 |
| **수송/약탈** | ✅ 정상 | Phase C |
| **일일 미션** | ✅ 정상 | settings 시드됨 |
| **마켓플레이스** | ✅ 정상 | 아이템 거래 |
| **아이템 강화** | ✅ 정상 | 코스메틱 +1~+10 |
| **옥션** | ✅ 정상 | user_resource_inventory 컬럼 fix됨 |
| **로켓 보급 드롭** | ✅ 정상 | 트리거 fix됨 (commit 62fb37f) |
| **POI (탐험)** | ✅ 정상 | 4h 스폰 / 5min 만료 |
| **VIP** | ✅ 정상 | migration 162 |
| **Colony Prestige** | ✅ 정상 | migration 177 (테이블) + settings 시드 (181) |
| **Territory Prestige** | ✅ 정상 | 클레임 단위 티어 |

## 🟢 동작 확인 — 보조 기능 (migration 178~181로 복구)

| 기능 | 카테고리 | DB | Settings | UI |
|---|---|---|---|---|
| 영토 브랜딩 | territory | ✅ 178 | ✅ 181 | ✅ |
| 영토 설명 (tdesc) | territory | ✅ 178 | ✅ 181 | ✅ |
| 기념물 (monuments) | territory | ✅ 178 | — | ✅ |
| 영토 티어 (tiers) | territory | ✅ 178 | ✅ 181 | ✅ |
| 영토 주문 (spells) | territory | ✅ 178 | — | ✅ |
| 영토 이벤트 (tevt) | territory | ✅ 178 | ✅ 181 | ✅ |
| 영토 스폰서 | territory | ✅ 178 | ✅ 181 | ✅ |
| 영토 실드 | territory | ✅ 178 | — | ✅ |
| 영토 임대 (rental) | territory | ✅ 180 | — | ✅ |
| 영토 업그레이드 | territory | ✅ 180 | — | ✅ |
| 무덤 (tombstone) | player | ✅ | ✅ | ✅ |
| 그래피티 | player | ✅ | ✅ | ✅ |
| 평가 (rating) | player | ✅ | ✅ | ✅ |
| 명함 (vtag) | player | ✅ | ✅ | ✅ |
| 공물 (tribute) | player | ✅ | ✅ | ✅ |
| 일기 (journal) | player | ✅ | ✅ | ✅ |
| 마일스톤 | player | ✅ | ✅ | ✅ |
| 하이라이트 | player | ✅ | ✅ | ✅ |
| 배너 | player | ✅ | ✅ | ✅ |
| 상태 메시지 | player | ✅ 178 | ✅ 181 | ✅ |
| 비콘 (beacon) | player | ✅ 178 | ✅ 181 | ✅ |
| 캡슐 (time capsule) | player | ✅ 178 | ✅ 181 | ✅ |
| 스테이킹 (staking) | economy | ✅ 178 | — | ✅ |
| 투표 (polls) | social | ✅ 178 | ✅ 181 | ✅ |
| 베팅 (wager) | social | ✅ 178 | ✅ 181 | ✅ |
| 미술 콘테스트 | social | ✅ 178 | — | ✅ |
| 기부 (donation) | social | ✅ 178 | ✅ 181 | ✅ |
| 공지 (broadcast) | social | ✅ 178 | — | ✅ |
| 원정 (expedition) | game | ✅ 178 | — | ✅ |
| 복권 (lottery) | game | ✅ 179 | — | ✅ |
| 배당 (dividends) | game | ✅ 179 | — | ✅ |
| 행성 뉴스 | game | ✅ 179 | ✅ 181 | ✅ |
| 래플 (raffle) | game | ✅ 178 | — | ✅ |
| 크래프팅 | game | ✅ 178 | — | ✅ |
| 업적 | meta | ✅ 180 | — | ✅ |
| 토너먼트 (단순) | meta | ✅ 180 | — | ✅ |
| 프로필 변경 로그 | meta | ✅ 180 | — | — |

## 🔴 깨진 / 보류 기능

| 기능 | 상태 | 권장 조치 |
|---|---|---|
| **legacy battle.js (`/api/battle/declare`)** | 🔴 backend 500 | UI 있음, DB 스키마 mismatch. UI 삭제 OR fleet_battles로 재배선 OR ALTER battles 테이블 |
| **user_ships / battle_ships** | 🔴 phantom | battle.js 결정에 종속 |
| **art_contests 스케줄러** | 🟡 작동하나 0 데이터 | 시드 필요 (운영자 콘테스트 직접 생성) |
| **wager_pools 스케줄러** | 🟡 동일 | 동일 |
| **raffles 스케줄러** | 🟡 동일 | 동일 |
| **routes/ships.js** | 🔴 구버전 | fleet 활성화 시 비활성화/삭제 |

## 🟡 명확화 필요 (이름 헷갈림)

| Pair | 책임 | 권장 |
|---|---|---|
| `routes/job.js` vs `jobs.js` | job=user-ops+admin / jobs=catalog+select | 이름 그대로 (책임 분리됨) |
| `routes/resource.js` vs `resources.js` | resource=admin+rate / resources=user catalog | 이름 그대로 |
| `routes/auction.js` vs `auctionRoutes.js` | auction=v1 (declare/bid/buyout) / auctionRoutes=v2 (list /api/auctions) | 양쪽 실사용 — 그대로 유지 |
| `routes/betting.js` vs `warBettingRoutes.js` | 둘 다 `/api/betting`에 마운트, frontend 혼용 | **HIGH risk 통합 필요** (별도 작업) |
| `services/tournament.js` vs `tournaments.js` | tournament=fleet 토너먼트 (phaseC) / tournaments=단순 GP entry-fee | 별도 시스템 — 그대로 |
| `services/chronicle.js` vs `chronicleEnhanced.js` | 다른 surface (api vs publicRoutes) | publicRoutes 삭제됐으므로 chronicleEnhanced 죽었을 가능성 — 점검 필요 |
| `services/title.js` vs `titleExtended.js` | 양쪽 다 사용 (api/HoF) | 검토 필요 |
| `services/enhancement.js` vs `enhancementAdvanced.js` | 양쪽 다 api.js에서 사용 | 검토 필요 |
| `services/battle.js` (legacy) vs `battleEngine.js`/`battleRewards.js`/`battleScheduler.js`/`battleTimeline.js` | legacy=깨짐, 나머지=fleet 보조 | battle.js 결정 후 정리 |

## ❌ 완료된 정리 (이번 세션)

- ✅ Dead 서비스 4개 삭제: weeklyChallenges, gpBurn, bounty, luckyBox
- ✅ Dead 라우트 5개 삭제: factionRoutes (v2), factionSystem 서비스, onboarding (v1), territoryRoutes, public, publicRoutes
- ✅ Phantom 테이블 39개 생성 (migration 176~180)
- ✅ users.wallet → wallet_address (18 서비스)
- ✅ gp_balances → users.gp_balance (6 서비스 + rental + tournaments)
- ✅ admin.js JSONB UPDATE 일괄 fix (25곳)
- ✅ 인벤토리 컬럼 mismatch 정정 (auction, worldEvents, tombstone)
- ✅ 88개 settings 키 시드 (migration 181)

## 🟡 추가 개발 후보 (밸런스/완성도)

1. **monuments, spells, shield, staking, expedition, raffle, broadcast, contest, crafting** settings 시드 — Migration 182에서 처리하면 끝
2. **achievements 자동 추적 트리거** — 현재 service 코드는 있지만 게임 이벤트와 연결 안 됨 (claim하면 자동 체크 등)
3. **tournament 자동 진행 스케줄러** — tournament.js는 fleet 기반인데 실제 매칭 스케줄러 없음
4. **art_contests, wager_pools, raffles 시드 콘텐츠** — 첫 운영자가 콘테스트/래플 직접 생성해야 하는데 admin UI 부재
5. **battle.js 결정** — 살릴지/죽일지 결정 필요 (UI에 declare battle 버튼 있는데 backend 500)

## 권장 우선순위 (다음 작업)

| # | 작업 | 시간 | 영향 |
|---|---|---|---|
| 1 | 잔여 settings 시드 (10개 카테고리) | 30min | admin이 모든 라이브 기능 조정 가능 |
| 2 | battle.js 결정 (UI 삭제 권장) | 1h | UX 정합성 (500 에러 안 보이게) |
| 3 | betting/warBetting 통합 | 2h | 라우팅 명확화 |
| 4 | chronicle/title/enhancement 중복 정리 | 2h | 코드 가독성 |
| 5 | achievements 자동 트리거 통합 | 4h | 업적 시스템 의미 부여 |
| 6 | art_contest/raffle/wager admin UI | 6h | 운영 편의성 |
