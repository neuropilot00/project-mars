# OCCUPY MARS — Claude Code 핸드오프 문서
> 최종 업데이트: 2026-06-11 v7.452 (System Cleanup Pass 28) | 이 파일을 먼저 읽으면 코드베이스를 즉시 파악할 수 있습니다.

> **❗ 새 세션이 가장 먼저 읽을 곳**:
> 1. **AUDIT_FINDINGS.md** — 기능별 동작 상태 매트릭스 (🟢/🟡/🔴 + 우선순위)
> 2. **CLAUDE.md의 알려진 이슈 섹션** — 해소/잔여 이슈
> 3. **docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md** — 현재 게임 방향성/우선순위 기준
> 4. **docs/CLAUDE_WORK_ORDER_2026-05-05.md** — 다음 작업 실행 지시서
> 5. **docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md** — P5 영토 유틸리티 구현 지시서
> 6. **docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md** — 전투 피드백/리텐션/PvP 구현 지시서
> 7. **CLAUDE.md의 서비스 카탈로그 섹션** — 주요 API/서비스 위치

---

## 0. 작업 규칙

- 코드 변경을 커밋/푸시할 때는 관련 `CHANGELOG.md`와 `AUDIT_FINDINGS.md` 업데이트를 같은 변경 묶음에 포함한다.
- 빠른 핫픽스로 코드 커밋이 먼저 나간 경우에도 즉시 후속 커밋으로 audit/changelog를 보강한다.
- 남은 작업은 `docs/CLAUDE_WORK_ORDER_2026-05-05.md`를 우선 작업지시서로 삼는다. `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 장기 리서치 참고용이며 현재 구현 우선순위가 아니다.

### v7.452 최신 핸드오프 — Map/User/Claim 조회 라우트 분리

- `server/routes/mapQueryRoutes.js`를 추가했다. 지도 초기화/픽셀/클레임/소유자 검색/방어자 미리보기/내 영토 목록 조회를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/user/:wallet`, `/api/pixel/:lat/:lng`, `/api/search/owner/:query`, `/api/pixels`, `/api/claims`, `/api/hijack/defender-info`, `/api/claims/my` 호출은 동일하게 동작한다.
- `/api/user/titles`, `/api/user/my-territories` 같은 정적 user 하위 라우트는 `:wallet` 라우트가 shadowing하지 않도록 next 처리와 마운트 순서를 유지했다.
- 이번 변경은 서버 스파게티 정리 14차다. 다음 후보는 `api.js` 내 guild 또는 user/base 계열 분리다.
- 검증 기준: `node --check server/routes/mapQueryRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.451 최신 핸드오프 — Data Image Upload 라우트 분리

- `server/routes/uploadRoutes.js`를 추가했다. data:image 업로드 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `POST /api/upload` 호출은 동일하게 동작하며 `/uploads/<filename>` URL을 반환한다.
- 허용 포맷, 5MB 제한, 파일명 랜덤화, 업로드 폴더 생성 정책은 기존 그대로 유지했다.
- `server/index.js`는 `uploadRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 13차다. 다음 후보는 `api.js` 내 guild 또는 map/claim query 계열 분리다.
- 검증 기준: `node --check server/routes/uploadRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.448 최신 핸드오프 — Notification/Away Briefing 라우트 분리

- `server/routes/notificationRoutes.js`를 추가했다. 플레이어 알림 조회/읽음 처리와 부재 중 브리핑 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/notifications`, `/api/notifications/read`, `/api/notifications/read-all`, `/api/me/away-briefing` 호출은 동일하게 동작한다.
- 알림 조회의 `x-wallet`/query wallet 허용, 읽음 처리의 `requireAuth`, 부재 브리핑의 bounty fallback 정책은 기존 그대로 유지했다.
- `server/index.js`는 `notificationRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 10차다. 다음 후보는 `api.js` 내 guild 또는 territory/harvest core 계열 분리다.
- 검증 기준: `node --check server/routes/notificationRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.449 최신 핸드오프 — Config/Deposit Bonus 라우트와 설정 캐시 단일화

- `server/utils/settingsCache.js`를 추가했다. 기존 `api.js` 로컬 `cfg()` 캐시와 입금 보너스 계산을 공통 유틸로 분리했다.
- `server/routes/configRoutes.js`를 추가했다. `/api/public/swap-info`, `/api/wallet/deposit-bonus-info`, `/api/config` 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 프론트 설정/스왑/입금 보너스 조회 호출은 동일하게 동작한다.
- `api.js`의 기존 게임 액션 라우트는 같은 `cfg()` 유틸을 import해서 설정 조회 방식만 단일화했다.
- 검증 기준: `node --check server/utils/settingsCache.js`, `node --check server/routes/configRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.450 최신 핸드오프 — DYNASTY Referral 라우트 분리

- `server/routes/referralRoutes.js`를 추가했다. 추천 등록, 추천 통계, 추천 코드/수익 조회, DYNASTY 리더보드, 추천 트리 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/referral/register`, `/api/referral/stats/:wallet`, `/api/referral/:wallet`, `/api/referral/leaderboard/top`, `/api/referral/tree/:wallet` 호출은 동일하게 동작한다.
- 등록 라우트의 JWT wallet 신뢰 정책, 자기추천 방지, season/achievement best-effort side-effect는 유지했다.
- 하이잭/스왑/수확의 referral commission side-effect는 돈 흐름과 직접 연결되어 있어 기존 게임 액션 라우트에 남겨뒀다.
- 검증 기준: `node --check server/routes/referralRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.447 최신 핸드오프 — 실사용 Title/Hall-of-Fame 라우트 분리

- `server/routes/titleRoutes.js`를 추가했다. 프론트가 실제 호출하는 `/api/user/titles`, `/api/user/titles/equip`, `/api/hall-of-fame`, `/api/hall-of-fame/categories` 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 title 목록/장착과 명예의 전당 조회 호출은 동일하게 동작한다.
- 기존 `server/routes/hallOfFameRoutes.js`는 `/api/titles`/`/api/hof`용 레거시 라우터이며 현재 `server/index.js`에서 비활성 상태다. 이번 변경은 실사용 경로만 대상으로 했다.
- `api.js`의 `titleService`/`titleExt` 로드는 유지한다. 영토 점령 등 게임 액션에서 title award side-effect가 아직 해당 파일에 남아 있기 때문이다.
- 검증 기준: `node --check server/routes/titleRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.446 최신 핸드오프 — Public Lore 라우트 Campaign 단일화

- 로딩 화면용 `GET /api/lore`를 `server/routes/api.js`에서 `server/routes/campaignRoutes.js`로 이동했다.
- URL 계약은 유지한다. 기존 `/api/lore` 호출과 실패 시 `{ lore: [], crawl: [] }` fallback은 동일하다.
- `campaignRoutes.js`가 이미 `/api/lore/flags/*`, `/api/lore/flag/*`를 소유하므로 lore 계열 API 책임이 한 파일로 모였다.
- `server/index.js` 마운트 순서는 변경하지 않았다. `campaignRoutes`는 이미 기존 `apiRoutes`보다 앞에 마운트되어 있다.
- 검증 기준: `node --check server/routes/campaignRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.445 최신 핸드오프 — PP→GP Exchange 라우트 분리

- `server/routes/exchangeRoutes.js`를 추가했다. PP→GP 교환 실행과 교환 정보 조회 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/exchange/pp-to-gp`, `/api/exchange/pp-to-gp/info` 호출은 동일하게 동작한다.
- 교환 라우트의 fail-closed enable 체크, rate/fee 검증, 일일 한도, row lock, 잔액 차감 조건부 UPDATE, 거래 로그 기록은 기존 정책 그대로 유지했다.
- `server/index.js`는 `exchangeRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 7차다. 다음 후보는 `api.js` 내 guild 또는 harvest/territory core 계열 분리다.
- 검증 기준: `node --check server/routes/exchangeRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.444 최신 핸드오프 — Daily 라우트 분리

- `server/routes/dailyRoutes.js`를 추가했다. 일일 로그인 상태/수령, 일일 미션 조회/수령, 스트릭 조회 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/daily/status`, `/api/daily/login`, `/api/daily/missions`, `/api/daily/missions/:id/claim`, `/api/daily/streak` 호출은 동일하게 동작한다.
- `api.js`의 `dailyService` 로드는 유지한다. 영토 클레임/하이잭/수확/코스메틱 등 게임 액션의 일일 미션 progress 훅이 아직 해당 파일에 남아 있기 때문이다.
- `server/index.js`는 `dailyRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 6차다. 다음 후보는 `api.js` 내 guild/territory/harvest/economy core 계열 분리다.
- 검증 기준: `node --check server/routes/dailyRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.443 최신 핸드오프 — World OPS 라우트 분리

- `server/routes/worldOpsRoutes.js`를 추가했다. 날씨 조회, POI/Starlink 탐사, POI 힌트, 로켓 이벤트/루트/트리거/우선권 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/weather`, `/api/exploration/*`, `/api/rockets/*` 호출은 동일하게 동작한다.
- `api.js`의 `weatherService`/`explorationService` 로드는 유지한다. 영토 생산/수확 계산에서 날씨 modifier와 Starlink boost를 아직 직접 참조하기 때문이다.
- `rocketService`는 엔드포인트 전용이어서 `api.js`에서 제거하고 새 라우터로 이동했다.
- `server/index.js`는 `worldOpsRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 5차다. 다음 후보는 `api.js` 내 guild/territory/harvest 계열 분리다.
- 검증 기준: `node --check server/routes/worldOpsRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.442 최신 핸드오프 — Season 라우트 분리

- `server/routes/seasonRoutes.js`를 추가했다. 시즌 상태, 리더보드, 카테고리 리더보드, 커리어 통계, 보상 조회/수령, 공유/탭 기록, 시즌패스 조회/구매/수령 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/season/*`와 `/api/stats/career` 호출은 동일하게 동작한다.
- `api.js`의 `seasonService` 로드는 유지한다. claim/hijack/harvest/weather/exploration/guild 등 게임 액션에서 발생하는 시즌 점수 best-effort 훅이 아직 해당 파일에 남아 있기 때문이다.
- `server/index.js`는 `seasonRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 4차다. 다음 후보는 `api.js` 내 guild/exploration/rocket/territory 계열 분리다.
- 검증 기준: `node --check server/routes/seasonRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.441 최신 핸드오프 — Mission 라우트 분리

- `server/routes/missionRoutes.js`를 추가했다. 단일 플레이 OPS 미션의 패드 조회, 프리뷰, 발사, 활성 목록, 보상 수령, 취소 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/missions/pads`, `/api/missions/preview`, `/api/missions/launch`, `/api/missions/active`, `/api/missions/:id/claim`, `/api/missions/:id/cancel` 호출은 동일하게 동작한다.
- 미션 보상 수령 후 시즌 점수 best-effort 반영은 새 라우터 안으로 함께 이동했다. `missionRoutes`는 `missionService`와 `seasonService`만 직접 참조한다.
- `server/index.js`는 `missionRoutes`를 `/api` 아래에 `apiLimiter`와 함께 기존 `apiRoutes`보다 앞에 마운트한다.
- 이번 변경은 서버 스파게티 정리 3차다. 다음 후보는 `api.js` 내 guild/season/exploration/rocket/territory 계열 분리다.
- 검증 기준: `node --check server/routes/missionRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.440 최신 핸드오프 — Item Economy 라우트 단일화

- `server/routes/itemEconomyRoutes.js`를 추가했다. 아이템 상점, 아이템 인스턴스, 강화 비용/확률/실행, 자동 갱신, 보호 주문서 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/shop/items`, `/api/shop/inventory`, `/api/shop/buy`, `/api/shop/use`, `/api/shop/shields`, `/api/shop/active-effects`, `/api/shop/auto-renew`, `/api/items/instances`, `/api/items/materialize`, `/api/items/dematerialize`, `/api/items/scrolls`, `/api/enhance/*` 호출은 동일하게 동작한다.
- `server/index.js`는 `itemEconomyRoutes`를 `/api` 아래에 `apiLimiter`와 함께 마운트한다. 기존 `apiRoutes` 마운트 앞에 위치해 `api.js`의 넓은 라우트와 충돌하지 않게 했다.
- 이번 변경은 서버 스파게티 정리 2차다. Item Economy 계열의 흩어진 라우트는 새 파일로 모았다. 다음 후보는 `api.js` 내 mission/season/territory/harvest 계열 분리다.
- 검증 기준: `node --check server/routes/itemEconomyRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.439 최신 핸드오프 — Campaign 라우트 분리 + API 공통 헬퍼 단일화

- `server/routes/campaignRoutes.js`를 추가했다. 캠페인 진행, 에디터 레이아웃, 평판, 태그, 로어 플래그, 브랜치 modifier 라우트를 `server/routes/api.js`에서 분리했다.
- URL 계약은 유지한다. 기존 `/api/campaign/*`, `/api/reputation/*`, `/api/tags/*`, `/api/lore/*`, `/api/branch/*` 호출은 동일하게 동작한다.
- `server/utils/apiHelpers.js`를 추가해 `requireAuth`, `getAuthWallet`, `sanitize`, `isInternalRequest` 공통 헬퍼를 단일화했다. `server/routes/api.js`는 기존 로컬 정의 대신 이 헬퍼를 사용한다.
- `server/index.js`는 `campaignRoutes`를 `/api` 아래에 `apiLimiter`와 함께 마운트한다. 기존 `apiRoutes` 마운트 앞에 위치해 `api.js`의 넓은 와일드카드 라우트와 충돌하지 않게 했다.
- 이번 변경은 서버 스파게티 정리 1차다. 다음 후보는 `server/routes/api.js` 내 shop/item/quest/harvest 계열 라우트 또는 `server/routes/admin.js` 도메인별 분리다.
- 검증 기준: `node --check server/utils/apiHelpers.js`, `node --check server/routes/campaignRoutes.js`, `node --check server/routes/api.js`, `node --check server/index.js`, `git diff --check`.

### v7.438 핸드오프 — Faction 모달 CSS 외부화

- `assets/faction-modal.css`를 추가했다. Faction Selection 모달, 파벌 카드, 파벌 밸런스 바, 파벌 토스트 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 공통 모바일 모달 safe-area 규칙은 다른 모달과 묶여 있어 `index.html`에 유지했다. 이번 변경은 Faction 기본 모달 스타일만 단일화한다.
- `index.html`에는 `assets/faction-modal.css?v=7438` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v103`으로 올렸다.
- 이번 변경은 프론트 스파게티 정리 14차다. 다음 후보는 Daily OPS 스타일/렌더, 랜딩/로딩 CSS, `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/faction-modal.css` load, `git diff --check`.

### v7.437 핸드오프 — 채팅/온보딩 오버레이 CSS 외부화

- `assets/utility-overlays.css`를 추가했다. 우하단 채팅 오버레이와 온보딩 힌트 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 로딩 오버레이/비디오 스타일은 초기 렌더와 강하게 묶여 있어 `index.html`에 유지했다. 이번 변경은 채팅/온보딩 오버레이 전용 스타일만 단일화한다.
- `index.html`에는 `assets/utility-overlays.css?v=7437` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v102`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 13차다. 다음 후보는 Daily OPS 스타일/렌더, 랜딩/로딩 CSS, `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/utility-overlays.css` load, `git diff --check`.

### v7.436 핸드오프 — War Betting 모달 CSS 외부화

- `assets/war-betting-modal.css`를 추가했다. War Betting 모달, 이벤트 카드, 옵션 버튼, 베팅 입력, 내 베팅 내역 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 바로 뒤에 붙어 있던 채팅 오버레이/온보딩 힌트 스타일은 별도 시스템이라 `index.html`에 유지했다. 이번 변경은 `.wb-*` 계열 War Betting 전용 스타일만 단일화한다.
- `index.html`에는 `assets/war-betting-modal.css?v=7436` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v101`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 12차다. 다음 후보는 채팅/온보딩 CSS, Daily OPS 스타일/렌더, `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/war-betting-modal.css` load, `git diff --check`.

### v7.435 핸드오프 — Battle Hub/Viewer 모달 CSS 외부화

- `assets/battle-hub-modal.css`를 추가했다. Battle Hub, Battle Declare, Commander Actions, Battle Renderer/Viewer, Battle Result/Report, AI Practice, Tournament, Hijack 핵심 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 공통 모바일 모달 safe-area, 온보딩, 랜딩, 모바일 성능 규칙은 여러 시스템과 묶여 있어 `index.html`에 유지했다. 이번 변경은 Battle Hub/Viewer 계열 핵심 스타일만 단일화한다.
- `index.html`에는 `assets/battle-hub-modal.css?v=7435` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v100`으로 올렸다.
- 이번 변경은 프론트 스파게티 정리 11차다. 다음 후보는 Daily OPS/War Betting/onboarding CSS처럼 아직 `index.html` 안에 남은 기능 블록과 `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/battle-hub-modal.css` load, `git diff --check`.

### v7.434 핸드오프 — Fleet Command 모달 CSS 외부화

- `assets/fleet-command-modal.css`를 추가했다. Fleet Command 모달, 함대 목록/상세, 전술 패널, 세로 편성 프리뷰, 함선 선택 카드 핵심 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 공통 모바일 모달 safe-area 규칙은 Shipyard/Battle Hub 등 여러 모달과 묶여 있어 `index.html`에 유지했다. 이번 변경은 Fleet Command 전용 핵심 스타일만 단일화한다.
- `index.html`에는 `assets/fleet-command-modal.css?v=7434` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v99`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 10차다. 다음 후보는 Daily OPS, Battle Hub처럼 아직 `index.html` 안에 남은 대형 기능 블록과 `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/fleet-command-modal.css` load, `git diff --check`.

### v7.433 핸드오프 — Shipyard 모달 CSS 외부화

- `assets/shipyard-modal.css`를 추가했다. Shipyard 모달, 청사진 카드, 건조큐, 보유함, 강화, 함선 마켓, 모바일 반응형 핵심 스타일을 `index.html` 메인 `<style>`에서 분리했다.
- 공통 모바일 모달 safe-area 규칙은 Fleet Command/Battle Hub 등 여러 모달과 묶여 있어 `index.html`에 유지했다. 이번 변경은 Shipyard 전용 핵심 스타일만 단일화한다.
- `index.html`에는 `assets/shipyard-modal.css?v=7433` 로드만 남긴다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v98`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 9차다. 다음 후보는 Daily OPS, Battle Hub, Fleet Command CSS처럼 아직 `index.html` 안에 남은 대형 기능 블록과 `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/shipyard-modal.css` load, `git diff --check`.

### v7.432 최신 핸드오프 — Shipyard 모달 JS 외부화

- `assets/shipyard-modal.js`를 추가했다. Shipyard 상태(`shipyardState`), 청사진/건조큐/보유함/강화/마켓/상자/조립 렌더와 액션 로직을 `index.html` 인라인 스크립트에서 분리했다.
- `index.html`에는 Shipyard 모달 마크업과 외부 스크립트 로드만 남긴다. Shipyard 동작의 단일 관리 지점은 `assets/shipyard-modal.js`다.
- 기존 HTML onclick 계약과 전역 함수명(`openShipyard`, `closeShipyard`, `switchSyTab`, `buildShip`, `upgradeShip`, `renderBlueprintsGrid` 등)은 유지했다.
- `MINERAL_ICONS`/`MINERAL_KO`/`MINERAL_EN` 전역은 새 파일 안에서 기존 순서대로 초기화된다. 뒤쪽 인라인 코드가 참조하는 계약을 유지했다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v97`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 8차다. 다음 후보는 Shipyard CSS, Daily OPS, Battle Hub처럼 아직 `index.html` 안에 남은 대형 기능 블록과 `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/shipyard-modal.js`, `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/shipyard-modal.js` load, `git diff --check`.

### v7.431 최신 핸드오프 — Fleet Command 모달 JS 외부화

- `assets/fleet-command-modal.js`를 추가했다. Fleet Command 상태(`fleetCmdState`), 함대 목록/상세 렌더, 진형/기동/기함/분리/삭제 액션 로직을 `index.html` 인라인 스크립트에서 분리했다.
- `index.html`에는 Fleet Command 모달 마크업과 외부 스크립트 로드만 남긴다. Fleet Command 동작의 단일 관리 지점은 `assets/fleet-command-modal.js`다.
- 기존 HTML onclick 계약과 전역 함수명(`openFleetCmd`, `closeFleetCmd`, `createNewFleet`, `setFleetMode`, `setAsFlagship` 등)은 유지했다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v96`으로 올렸다.
- 이번 변경은 프론트 스파게티 정리 7차다. 다음 후보는 Shipyard, Daily OPS, Battle Hub처럼 아직 `index.html` 안에 남은 대형 기능 블록과 `server/routes/api.js` 도메인 라우트 분해다.
- 검증 기준: `node --check assets/fleet-command-modal.js`, `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/fleet-command-modal.js` load, `git diff --check`.

### v7.430 최신 핸드오프 — 공통 게임 다이얼로그 JS 외부화

- `assets/game-dialogs.js`를 추가했다. `gameConfirm()`, `gameConfirmResolve()`, `gameInput()`, `_giSubmit()`, `closeGameInput()`, `gamePicker()`, `closeGamePicker()`를 `index.html` 인라인 스크립트에서 분리했다.
- 강화/마켓/길드/동맹/전투/영토 등 여러 시스템이 공유하는 확인/입력/선택 다이얼로그의 단일 관리 지점은 `assets/game-dialogs.js`다.
- 기존 HTML onclick 계약과 호출 함수명은 유지했다. `gameConfirm`/`gameInput` 호출부는 변경하지 않았다.
- `escapeHTML` fallback은 새 파일 내부에서 보장한다. 기존 전역 `escapeHTML`이 있으면 덮어쓰지 않는다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v95`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 6차다. 다음 후보는 Daily OPS, Shipyard, Fleet Command처럼 아직 `index.html` 안에 남은 대형 기능 블록이다.
- 검증 기준: `node --check assets/game-dialogs.js`, `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/game-dialogs.js` load, `git diff --check`.

### v7.429 핸드오프 — 함선/광물 도감 모달 CSS/JS 외부화

- `assets/ship-catalog-modals.css`를 추가했다. Ship Registry와 Mineral Catalog 모달 스타일을 `index.html` 하단 인라인 CSS에서 분리했다.
- `assets/ship-catalog-modals.js`를 추가했다. `/api/tactical-lab/catalog` 함선 도감 fetch/render, `/api/resources/catalog` 광물 도감 fetch/render, 파벌 탭 전환, 모달 open/close 동작을 이 파일로 이동했다.
- `index.html`에는 도감 모달 마크업과 외부 CSS/JS 로드만 남긴다. 도감 UI의 단일 관리 지점은 `assets/ship-catalog-modals.*`다.
- 기존 `openShipRegistry()`/`openMineralsPanel()` 이름은 보유 함선/보유 광물 패널 의미로 이미 쓰이고 있어 도감 함수와 충돌했다. 보유 패널은 `openMyShipRegistry()`/`openMyMineralsPanel()`, 도감은 `openShipCatalog()`/`openMineralCatalog()`로 분리했다.
- UI/CSS/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v94`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 5차다. 다음 후보는 Daily OPS, Shipyard, Fleet Command처럼 아직 `index.html` 안에 남은 대형 기능 블록이다.
- 검증 기준: `node --check assets/ship-catalog-modals.js`, `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/ship-catalog-modals.css`/`.js` load, `git diff --check`.

### v7.428 핸드오프 — 버그 리포터 CSS 외부화

- `assets/bug-reporter.css`를 추가했다. 버그 신고 FAB, 모바일 위치 복구 규칙, 모달 카드, 스크린샷 드롭존, 제출/삭제 버튼 스타일을 이 파일로 이동했다.
- `index.html`은 버그 리포터 모달 마크업과 `assets/bug-reporter.css`/`assets/bug-reporter.js` 로드만 남긴다. 버그 리포터 UI/동작의 단일 관리 지점은 각각 CSS/JS 파일이다.
- 기존 모바일 좌표와 `#bugReportModal` z-index 계약은 유지했다.
- UI/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v93`으로 올렸다.
- 이번 변경은 프론트 스파게티 정리 4차다. 다음 후보는 Daily OPS, Shipyard, Fleet Command처럼 아직 `index.html` 안에 남은 대형 기능 블록이다.
- 검증 기준: `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, static `/assets/bug-reporter.css`/`bug-reporter.js` load, `git diff --check`.

### v7.427 최신 핸드오프 — 버그 리포터 JS 외부화

- `assets/bug-reporter.js`를 추가했다. 버그 신고 모달 열기/닫기, 자동 스크린샷 캡처, 파일/붙여넣기/드롭 이미지 처리, `/api/bug-report` 제출과 `/bug-report` fallback 로직을 이 파일로 이동했다.
- `index.html`은 버그 리포터 버튼/모달 마크업과 외부 스크립트 로드만 남긴다. 버그 리포터 동작 로직은 더 이상 하단 거대 인라인 스크립트 안에 섞이지 않는다.
- 기존 인라인 `onclick` 계약(`openBugReporter`, `closeBugReporter`, `submitBugReport`, `bugClearSs`, `bugSsZoneClick`, `bugSsFileChosen`, `bugSsDrop`)은 그대로 유지한다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v92`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 3차다. `index.html` 전체 분해 완료가 아니다. 다음 저위험 후보는 버그 리포터 CSS 외부화, Daily OPS, Shipyard, Fleet Command처럼 DOM id와 API 경계가 명확한 블록이다.
- 검증 기준: `node --check assets/bug-reporter.js`, `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, `git diff --check`.

### v7.426 최신 핸드오프 — 전술랩 모달 JS 외부화

- `assets/tactical-lab-modal.js`를 추가했다. 전술랩 iframe URL 생성, iframe unload, sandbox 모달 열기/닫기, ESC 닫기, postMessage 처리, 후퇴/전투종료/커맨더 명령 API 호출을 이 파일로 이동했다.
- `index.html`은 전술랩 모달 마크업과 외부 스크립트 로드만 남긴다. 전술랩 wrapper 로직은 더 이상 거대 인라인 스크립트 안에 섞이지 않는다.
- 실전 전투 뷰어의 `openBattleViewer()`/`closeBattleViewer()`는 기존처럼 `buildTacticalLabUrl()`/`unloadTacticalLabFrame()`을 호출한다. 함수는 외부 파일에서 전역으로 제공한다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v91`로 올렸다.
- 이번 변경은 프론트 스파게티 정리 2차다. `index.html` 전체 분해 완료가 아니다. 다음 저위험 후보는 Daily OPS/Shipyard/Fleet Command처럼 DOM id와 API 경계가 명확한 블록을 파일 단위로 분리하는 것이다.
- 검증 기준: `node --check assets/tactical-lab-modal.js`, `node --check sw.js`, `index.html` inline script parse, `git diff --check`.

### v7.425 핸드오프 — 시스템 공통부 스파게티 정리 1차

- `server/utils/rateLimiters.js`를 추가했다. `express-rate-limit`의 `standardHeaders`, `legacyHeaders`, Redis store error policy, string/object message 변환을 한 곳에서 처리한다.
- `server/index.js`와 `server/routes/api.js`의 rate limiter 생성은 `makeRateLimiter()`를 사용한다. API 계약과 제한값은 유지했다.
- `server/utils/scheduler.js`를 추가했다. 반복되는 `setInterval + try/catch + console.warn` 패턴을 `scheduleTask()`와 `safeInitScheduler()`로 묶었다.
- `server/index.js`의 단순 expiry/cleanup 계열 스케줄러 일부를 공통 helper로 이전했다. 전투 정산, GP 환불, 복잡한 트랜잭션 블록은 동작 위험 때문에 이번 1차에서 무리하게 접지 않았다.
- 이번 변경은 전체 스파게티 제거 완료가 아니다. 1차 완료 범위는 서버 공통부 중복 제거다. 남은 큰 작업은 `index.html` 기능별 모듈 분리와 `server/routes/api.js` 도메인별 라우트 분해다.
- 검증 기준: `node --check server/index.js`, `node --check server/routes/api.js`, `node --check server/utils/rateLimiters.js`, `node --check server/utils/scheduler.js`, `git diff --check`.

### v7.424 핸드오프 — 전술랩 모달 CSS/JS 1차 정리

- 전술랩 sandbox 모달 스타일을 `index.html` 인라인 `<style>`에서 `assets/tactical-lab-modal.css`로 분리했다. 모달 크기/모바일 전체화면 정책은 이 CSS 파일에서 관리한다.
- `openTacticalLab()`/`closeTacticalLab()` 주변 DOM 조회, 헤더 i18n 갱신, ESC 닫기 로직을 `getTacticalLabModalElements()`, `syncTacticalLabModalText()`, `handleTacticalLabEscape()`로 분리했다.
- tactical-lab iframe `postMessage` 핸들러를 후퇴/전투종료/커맨더 명령 헬퍼로 분리했다. 서버 명령 API 계약은 그대로 유지한다.
- 전술랩 iframe `ready` 메시지의 운영 콘솔 로그를 제거했다. tactical-lab 내부 catalog/preset 로드 로그는 `debug=1` query에서만 출력한다. 실패/경고 로그는 유지한다.
- 동작 계약은 유지한다. sandbox는 `mode=sandbox`, 실전 전투는 `mode=battle` 경로를 계속 사용한다.
- UI/JS/CSS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v90`으로 올렸다.

### v7.423 최신 핸드오프 — 전술랩 sandbox 모달 PC 높이 클리핑 보정

- 메인 실전 전투 뷰어는 기존처럼 큰 전투 화면을 유지한다. 이번 변경은 `openTacticalLab()`로 여는 sandbox 전술 실험실에 한정한다.
- 데스크탑 sandbox 전술랩은 전체화면 고정 대신 중앙 모달로 열린다. 모달은 `1120px x 880px` 상한과 `calc(100vh - 36px)` 높이 제한을 가져 작은 브라우저 창에서 하단 버튼이 브라우저 밖으로 밀리지 않는다.
- 모바일 `<=720px`에서는 기존처럼 전체화면을 유지한다. 조작 면적을 줄이지 않기 위한 정책이다.
- `assets/tactical-lab-v11.html`은 `data-tl-mode="sandbox|battle"`를 HTML 루트에 표시한다. sandbox 모드에서만 캔버스 행을 축소 가능하게 만들고 짧은 데스크탑 높이에서는 버튼/로그 영역을 압축한다.
- 실전 `mode=battle` 레이아웃 정책은 유지한다. 전술랩 실험 모달의 PC 클리핑만 보정한 변경이다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v89`로 올렸다.

### v7.422 최신 핸드오프 — Tactical Lab 독립 전투 뷰어 모듈 계약 정리

- `assets/tactical-lab-v11.html`은 계속 독립 iframe으로 유지한다. 메인 `index.html`에 병합하지 않는다.
- 메인 게임의 실전 전투 뷰어와 전술 실험실은 모두 `buildTacticalLabUrl()`을 통해 같은 모듈 URL을 만든다.
- 실전 전투는 `mode=battle&bid=...&wallet=...&lang=...`, 전술 실험은 `mode=sandbox&lang=...` 계약을 사용한다.
- iframe unload는 `unloadTacticalLabFrame()`으로 통일했다. 닫힌 뒤 WebAudio/rAF/WS가 살아남는 회귀를 막는다.
- tactical-lab 내부는 `TL_QUERY`, `TL_MODE`, `tlQuery()`, `notifyParent()`를 사용한다. 부모 통신은 `ready`, `ws_end`, `battle_final_done`, `forfeit`, commander command로 정리한다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v88`로 올렸다.

### v7.421 최신 핸드오프 — SEA 로컬라이징 슬롯 + 전술랩 번역 부트스트랩

- `index.html`은 언어 코드를 `en/ko/ja/zh/id/vi/th`로 정규화한다. `in`은 `id`, `vn`은 `vi`, `thai`는 `th`로 흡수한다.
- 상단/드롭다운/프로필 언어 UI에 ID/VI/TH 슬롯을 추가했다. 현재 프로필 언어 버튼이 가장 확실한 사용자 진입점이다.
- `I18N.id/vi/th`는 영어 fallback 기반 seed dictionary다. 핵심 메뉴/BASE/오늘의 작전 보드/함대/상점/버그 리포트 문구부터 현지화했다.
- `tl()`은 7언어 인자를 받을 수 있다. 기존 4언어 호출은 SEA 언어에서 영어로 안전 fallback된다.
- `assets/tactical-lab-v11.html`은 독립 HTML이므로 별도 i18n을 가진다. `lang` query, parent `LANG`, `localStorage.pw_lang` 순서로 언어를 읽고 ID/VI/TH UI/기동/콜아웃 번역을 적용한다.
- 게임 음성은 UI 언어와 분리한다. `GAME_VOICE_LANG='en'`을 기본 정책으로 유지해 캠페인 보이스는 영어 베이스로 제작한다.
- UI/JS 캐시 반영을 위해 `sw.js` 캐시를 `mars-v87`로 올렸다.

### v7.420 최신 핸드오프 — Daily OPS 완료 반영 레이스/미션명 호환 보정

- `BASE > 내 영토 > 오늘의 작전 보드`는 여전히 단일 소스다. 별도 Daily OPS 보드를 되살리지 않는다.
- 일부 프론트 성공 훅은 예전 로컬 미션명(`ship_upgrade`, `territory_harvest`, `ai_practice`)을 호출한다. `markDailyOpsAction()`은 이를 서버 미션명 그룹(`upgrade_ship*`, `harvest_*`, `ai_battle*`)으로 매핑한다.
- 서버의 실제 진행도 원천은 `server/routes/dailyOps.js`의 `notifyMissionProgress()`와 `daily_ops` 테이블이다. 프론트 로컬 진행도는 성공 직후 녹색 완료 표시를 늦지 않게 보여주는 보조 피드백이다.
- 함선 강화/영토 채굴/AI 연습전처럼 서버가 성공 후 비동기 훅을 돌리는 액션은 `loadOpsCommandBoard()`를 즉시 1회, 450ms/1300ms 지연 2회 재조회한다. 완료 항목 녹색불 누락 신고가 있으면 이 레이스를 먼저 의심한다.
- 보상 수령/GP 지급은 `/api/daily-ops/claim`만 사용한다. 프론트에서 임의 보상 지급 API를 만들지 않는다.
- 검증 기준: `index.html`/`assets/tactical-lab-v11.html`/`assets/campaign-editor.html` inline script parse, `node -c server/routes/dailyOps.js && node -c server/routes/ships.js && node -c server/routes/api.js`, `git diff --check`.

### v7.419 최신 핸드오프 — 내 아이템 재료 표시 + 캠페인 캐릭터 transform 안정화

- `BASE > 내 영토 > 오늘의 작전 보드`의 재료/아이템 계열 GO는 `내 아이템` 탭으로 이동한다. 이때 `renderBaseInventory()`가 아이템 인벤토리만 비어 있으면 즉시 empty return 하던 문제를 고쳤다.
- 이제 상점 아이템이 0개여도 `resource_inventory` 보유 재료가 있으면 `내 아이템` 탭에 `⚒ 광물 자원` 섹션이 표시된다. 작전보드에서 아이템을 눌렀는데 “내 아이템에 아무것도 없는 것처럼 보이는” 회귀를 막는다.
- 특정 카테고리에 장비 아이템이 없어도 재료 보유분은 같은 탭 하단에 계속 표시한다. 카테고리 empty 안내가 재료 렌더를 막지 않는다.
- 캠페인 캐릭터 레이아웃 적용 시 transform origin을 명시했다. 에디터와 동일한 중심점 좌표 모델을 유지하되, scale/transition이 섞일 때 캐릭터 위치가 흔들리는 위험을 줄인다.
- 검증 기준: `index.html`/`assets/tactical-lab-v11.html`/`assets/campaign-editor.html` inline script parse, Daily OPS 레거시 참조 `rg` 0건, `git diff --check`.

### v7.418 최신 핸드오프 — Daily OPS 레거시 보드 제거 + 캠페인 에디터 레이아웃 서버 기준화

- `index.html`에서 예전 `renderDailyOpsBoard()`/`openDailyOpsRoute()` 레거시 Daily OPS 보드 구현을 제거했다. 이제 Daily OPS는 `BASE > 내 영토`의 `#opsCommandBoard`만 사용한다.
- 언어 변경, 체크인, 미션 진행 갱신은 레거시 보드 대신 `loadOpsCommandBoard()`를 호출한다. `OPS CONSOLE`은 침공/탐사 콘솔로만 유지된다.
- 캠페인 인게임 스토리 렌더러가 에디터 `localStorage`를 서버 저장 레이아웃보다 우선하던 경로를 제거했다. 같은 브라우저의 오래된 에디터 좌표가 인게임 위치를 덮어쓰지 않는다.
- 인게임은 `/api/campaign/editor-layout` 서버 응답을 기준으로 캐시하고, 첫 프레임에는 마지막 서버 레이아웃 캐시만 적용한다. 서버 응답이 도착하면 캐시를 갱신하고 필요한 경우에만 다시 렌더한다.
- `gameConfirm()` 정보 행의 OK/부족 상태를 배경/테두리까지 다르게 표시한다. 함선 강화 확인 시 GP/재료 보유량과 부족 자원이 더 명확히 보인다.
- 검증 기준: Daily OPS 레거시 참조 `rg` 0건, `node --check` 서버 파일군, `sw.js`, `index.html`/`assets/tactical-lab-v11.html` inline script parse, `git diff --check`.

### v7.417 최신 핸드오프 — 내 영토 작전보드 GO 라우팅/완료 상태 보강

- `index.html` 내 영토 탭의 오늘의 작전 보드에서 재료/아이템 계열 GO가 마켓으로 빠지던 경로를 `내 아이템` 탭으로 보냈다. 보유 재료/아이템 확인은 `loadBaseInventory()`를 통해 같은 화면에서 갱신된다.
- 작전보드 GO는 이제 필요한 경우 BASE 모달을 열고 대상 탭을 클릭한다. 숨겨진 카테고리 탭도 `switchBaseTab()`이 카테고리 표시를 동기화하므로 직접 진입 가능하다.
- 오늘의 작전 보드는 `BASE > 내 영토`의 `#opsCommandBoard`만 단일 소스로 사용한다. `OPS CONSOLE` 탭은 침공/탐사 미션 발사 콘솔이므로 Daily OPS 보드를 미러링하지 않는다.
- 완료 표시/수령 버튼 판정을 `completed` boolean뿐 아니라 `current >= target` 또는 `progress_pct >= 100`도 인정하도록 보강했다. 서버/프론트 상태가 잠깐 어긋나도 완료 항목에 녹색 표시와 수령 버튼이 나온다.
- `server/routes/dailyOps.js` GET 응답도 진행도 기반 완료를 계산한다. claim 경로는 기존 stale row를 위해 `completed=true`뿐 아니라 `current_count >= target_count`도 수령 가능하게 하고, 수령 시 `completed`를 확정한다.
- UI 변경 캐시 반영을 위해 `sw.js` 캐시를 `mars-v86`으로 올렸다.
- 검증 기준: `node --check server/routes/dailyOps.js`, `node --check server/services/battleEngine.js`, `node --check server/services/battleReport.js`, `node --check sw.js`, `index.html`/`assets/tactical-lab-v11.html` inline script parse, `git diff --check`.

### v7.416 최신 핸드오프 — 전술 버튼 실제 전투 계산 반영 + 영구 손실가치 리포트

- `server/services/battleEngine.js` 일반 포격 데미지 계산에 진형/기동/기함 생존 상태 배율을 연결했다.
  - 쐐기: 기함/돌파 압박 증가, 폭격/저격에 더 취약.
  - 핀서/측면 기동: 산개하지 않은 상대와 라인/쐐기 상대에게 더 강함.
  - 방어막/구형/선봉방어: 기함/대형함 보호가 좋아지지만 화력 압박은 낮아짐.
  - 산개/후퇴/재집결: 피해 감소 또는 회복 강화 대신 화력/압박 손실.
  - 기함이 살아 있으면 지휘 보너스를 유지하고, 기함이 죽으면 공격/방어 교환 품질이 떨어진다.
- `processRepair()`는 `rally`와 `screen` 상태에서 수리 효율을 높인다. 기동 버튼이 단순 알림이 아니라 장기전 운영 선택이 된다.
- `server/services/battleReport.js`가 `ship_wrecks`를 집계해 `full_loss_ships`, `loss_value_gp`를 ATK/DEF 리포트에 포함한다.
- 패배 분석은 손실 가치 격차가 큰 전투를 별도 감지해 고강화/대형함 보호, 저격/폭격 카운터 확인, 재건 재료 확보를 추천한다.
- `index.html` 전투 결과 리포트에 `자산 손실` 블록을 추가했다. 내 함대와 상대의 영구 손실 척수/GP 가치를 비교 표시한다.
- 검증 기준: `node --check server/services/battleEngine.js`, `node --check server/services/battleReport.js`, `node --check sw.js`, `index.html`/`assets/tactical-lab-v11.html` inline script parse, `git diff --check`.

### v7.415 최신 핸드오프 — 함대 지휘 사전 상성 경고/전술 설명 보강

- `index.html` Fleet Command 모달에 현재 진형/기동의 효과와 리스크를 직접 표시한다. 버튼 tooltip에 묻히지 않고 선택 즉시 설명이 바뀐다.
- 함대 미리보기 우측 `DOCTRINE CHECK`가 기함 미지정, 지원함 부재, 대형함 호위 부족, 대형함 카운터 부재, 소형 편중, 전진 리스크를 사전 경고한다.
- 전투 결과 리포트에 역할 구도(태클/전자전/DPS/탱커/저격/폭격/로지)를 내 함대와 상대 함대로 비교 표시한다.
- UI/CSS 변경이므로 `sw.js` 캐시를 `mars-v85`로 올렸다. 배포 후 구버전 화면이 남으면 브라우저 새로고침/다음 navigation에서 새 캐시가 잡힌다.
- 검증 기준: `node --check server/services/battleEngine.js`, `node --check server/services/battleReport.js`, `index.html`/`assets/tactical-lab-v11.html` inline script parse, `git diff --check`.

### v7.414 핸드오프 — 전투 스킬 이벤트/연출 정합 보강

- `server/services/battleEngine.js` 수동 스킬이 실제 격침 이벤트를 남긴다. 빔포는 기함/대형함 우선, 미사일은 프리깃/저HP 다수 분산, 합체 필살은 대형 목표 광역 타격으로 분리했다.
- 전투 프레임의 함선 `facing`을 실제 최근접 적 방향으로 기록해 전술랩/리플레이가 공격 대상 방향을 알 수 있게 했다.
- 수리함은 `repair_pulse` 이벤트를 남기며, 전투 리포트의 스킬 요약에 수리량이 반영된다.
- `flagship_destroyed`는 기함 경고용 이벤트로 유지하고, 데미지 집계는 `ship_destroyed`만 사용해 기함 격침 중복 데미지를 막았다.
- `assets/tactical-lab-v11.html`은 화성 배경 밝기와 수동 빔/미사일 TTL을 보강했다. 빔포/미사일을 눌렀는지 2~3초 체감되도록 지속시간을 늘렸다.

### v7.413 최신 핸드오프 — 함대전 결과 리포트 전술 분석 강화

- `server/services/battleReport.js`가 전투 이벤트/함선 role/함급 분포를 합산해 패인과 개선 추천을 만든다.
- 분석 신호: 데미지 교환 격차, 손실률 격차, 대형함이 저격/폭격에 카운터된 경우, 소형 러시가 구축함/탱커에 막힌 경우, 전자전 피격 후 태클 부재, 지원함 격차, 기함 격침.
- `/api/battles/:id/report` 응답은 기존 `analysis_ko`/`recommendations_ko`를 유지하면서 `analysis_items`, `recommendation_items`, `role_counts`, `size_counts`, `event_stats`를 추가로 내려준다.
- `index.html` 전투 결과 모달은 새 분석 항목을 3줄 카드로 표시한다. 패배/무승부 시에는 추천 개선도 함께 표시한다.
- 구현 범위는 P1 전투 피드백 강화에 한정했다. Daily OPS, Field Rating, 현상금, 섹터 캘린더는 이번 변경에서 건드리지 않았다.

### v7.412 최신 핸드오프 — MMO 경제/영토/함대 거래 흐름 하드닝

- **옥션 스키마 정합**: `server/services/auction.js`를 현재 DB 스키마(`listing_type`, `resource_id`, `amount`, `current_price`, `fee_pct`, `sold/expired`) 기준으로 재정렬. 예전 `item_type/resource_code/bid_amount/settled/no_bids` 경로로 인한 런타임 실패를 차단.
- **영토 거래 잠금 보강**: 옥션/마켓/하이젝 흐름이 `claims.auction_locked`, `marketplace_locked`, `claim_id` 기준으로 충돌하지 않게 유지. 관련 migration: `221_transactions_type_length.sql`, `222_claims_auction_lock.sql`.
- **실자금/게임머니 입력 하드닝**: `/swap`, `/withdraw`, `/withdraw-all`, `/exchange/pp-to-gp`, `/gp/transfer`의 수치 입력을 finite positive number로 정규화하고, 체인 allowlist를 유지.
- **Cantina 악용 차단**: Crash round start는 인증된 호출만 허용. Cantina bet/target/tile 입력은 `strictNumber`/`strictInteger`로 검증해 `"1abc"`류 부분 파싱을 차단.
- **캠페인 에디터 보호**: 챕터 API와 레이아웃 저장이 동일한 `x-admin-secret` 흐름을 사용한다. `/api/campaign/editor-layout` POST는 admin secret 없는 외부 쓰기를 거부한다.
- **검증 기준**: 변경 후 `node --check` 대상 서버 파일, `git diff --check`, `index.html`/`assets/campaign-editor.html` inline script parse를 통과해야 한다.

### v7.360 최신 핸드오프 — 배신 시스템 3종 + 경제 튜닝 (EVE식 수요엔진)

배신(treachery)이 갈등을 만들고 → 함선 파괴(full-loss) → 재건/수리 GP 싱크로 이어지는 EVE식 루프 구축. **모든 GP 이동은 carve(발행 0)**.

- **시스템1 — 길드 변절(`/api/guild/defect`)**: 길드원 변절 시 금고 일부 탈취(carve), 제명, `guild_betrayer` 낙인(캠페인 전용이던 grantTag를 PvP로 확장), 남은 금고로 자동 현상금(기존 `bounty_listings` 재사용), 재가입 쿨다운. 서비스 `guild.js#defectFromGuild`/`getDefectionCooldown`. 프론트 길드패널 `⚔ DEFECT` 버튼+`guildDefect()`. mig299. 쿨다운 게이트: acceptInvite/createJoinRequest/approveJoinRequest.
- **시스템3 — 킬보드(`/api/killboard`, `/:wallet`)**: full-loss 격침 시 `applyBattleResults`가 `ship_wrecks`에 victim/killer/side 귀속 기록(SAVEPOINT `_kb`로 격리 — 로깅 실패가 전투결과 오염 방지). 대형함 ship_destroyed 이벤트의 killer_wallet으로 멀티함대 귀속 정확화, 소형함은 상대측 대표 폴백. 라우트 `killboard.js`. mig301(`ship_wrecks` killer 컬럼 + 레거시 ship_battles FK 제거 + 방어적 CREATE).
- **시스템2 — PvP 스파이/정찰(`/api/spy/scout`, `/reports`)**: 숨겨진 적 함대 구성/전투력을 GP 소각해 노출, 탐지 롤(notifyPlayer 통보 → 보복), 이중첩자(`the_handler` 캠페인 태그) 할인. 서비스 `spy.js`. 테이블 `spy_reports`. mig302.
- **프론트**: PVP 탭에 킬보드+정찰 섹션(`kbSwitchTab`/`loadKillboard`/`kbScout`/`renderScoutPanel`/`_kbIntelCard`), 4개국어 i18n(`kb_*` 키 + `_kbL()` 헬퍼).
- **Codex 적대 검수 반영**: mig301 테이블 방어생성, approveJoinRequest 쿨다운, killboard/spy limit 음수 클램프, 스파이 할인 0~95% 클램프, 멀티함대 killer 귀속.
- **경제 동반 변경**: quest_reward_pool **폐지**(게임플레이 보상 GP 직접지급, PP는 충전 전용 — mig298), 추천 수수료 **교차통화 발행 폐지**(인플레 제거, v7.353), 함선 **수리비 0.01→0.03**(반복 GP 싱크, mig300). 함대전 손실은 **EVE식 full-loss**(hijack/siege `*_loss_enabled=true`) — §8/§13 참조.
- **신규 자산**: 서비스 spy.js / 라우트 killboard.js·spy.js / 테이블 guild_defections·spy_reports·(ship_wrecks 확장) / 태그 guild_betrayer. 조정값 전부 admin settings(`guild_defect_*`, `spy_*`, `ship_repair_gp_per_hp`).

### v5.97 최신 핸드오프 — P5-3~7 Territory Full Utility Stack

- **P5-3 Shipyard Connection**: `GET /api/ships/blueprints` 응답에 `materialSectorHints` 포함. 조선소 카드 재료 칩 옆에 ⛏ 섹터 뱃지 표시 (frontier/mid/core). `GET /api/ships/resource-sector-hints` 독립 엔드포인트 추가. `sySectorBadge(code)` 헬퍼 추가.
- **P5-4 Territory Upgrades**: Migration 211 — P5 업그레이드 설정 시드. `claimUpgrades.js`에 `extractor/refinery/shield_grid/relay_tower/art_beacon` 5개 트랙 추가. `GET /api/territory/:claimId/upgrades` + `POST /api/territory/:claimId/upgrade` 엔드포인트. `index.html` 영토 패널에 `🔧 UPGRADES` 접힘 섹션. production 응답에 upgradeModifiers 포함.
- **P5-5 Sector Control**: `GET /api/sectors/control` (전체 섹터별 컨트롤 스코어). `GET /api/sectors/:sectorId/control` (단일 섹터 리더보드 + 내 위치). 영향력 티어: presence(10%)/stakeholder(25%)/dominant(50%)/governor(75%). production 패널 하단에 섹터 컨트롤 리더보드 표시.
- **P5-6 Admin Economy**: `adminEconomyRoutes.js`에 territory economy/upgrades/sector-control 엔드포인트 추가. `admin.html` 🌍 TERRITORY 탭 — 수확 통계, 재료 발행/소각, 의심 수확자, 생산 프로파일 편집기.
- **P5-7 Campaign Integration**: `objectiveState`에 `materialHarvests` + `territoryUpgradeLevels` 추가. MCC CH1 `first_material_harvest` + MCC CH2 `territory_upgrade_start` optional 목표 추가. optional 목표는 챕터 완료 gate 미적용.

### v5.96 최신 핸드오프 — P5-2 재료 드롭 harvest 연동

- 재료 드롭을 COMMIT 전 트랜잭션 안에서 처리하도록 변경 (`server/routes/api.js`).
  - `rollResourceDrop()` SELECT-only라 COMMIT 전 호출 안전.
  - `addResourcesToInventory(client, ...)` — 트랜잭션 client 전달.
  - `transactions.meta.resourceDrops` 에 드롭 결과 포함.
- 수확 알림 PP + 재료 드롭 통합 표시. 아이콘/이름 매핑 22종으로 확장.
- `loadTerritoryProduction()` lastHarvest 패널에 재료 칩 추가.
- P5-3(조선소 연결)은 P5-2 안정화 후 진행.

### v5.95 최신 핸드오프 — P5-1 영토 생산 요약

- `GET /api/territory/:claimId/production?wallet=...` 신규 엔드포인트 추가 (`server/routes/api.js`).
- 클레임 픽셀 수, 섹터 유형, 드롭 재료 목록(base_rate 기준), 예상 PP 범위, 수확 이력을 한 번에 반환.
- 프론트 영토 정보 패널에 `⚙ PRODUCTION` 섹션 추가 (`infoProdRow`/`infoProdBody`).
  - 내 영토 클릭 시 자동 로드. 예상 PP / 섹터 / 모디파이어 칩 / 광물 칩 / 수확 정보 표시.
  - 남의 영토에는 production 섹션 노출하지 않음.
- 관련 함수: `loadTerritoryProduction(claimId, wallet)`, `_timeAgo(date)` in `index.html`.

### v5.96 최신 핸드오프 — 전투 피드백/리텐션/PvP 실행 지시서

- `docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가했다.
- 이 문서는 초안이 아니라 구현 계약서다. 클로드는 이 문서의 Read Order, Recon Gate, Acceptance Gate, QA Matrix, final report format을 따라야 한다.
- 전투 결과 리포트, Daily OPS Board, 영토 닉네임/Field Rating, Battle Hub 추천 상대, 현상금 보드, 섹터 분쟁/주간 캘린더의 구현 순서를 고정한다.
- 첫 착수는 P1 전투 결과 리포트만 진행한다. 전투 리포트가 실제 API/UI로 동작하기 전에는 Daily OPS, Field Rating, CPI, 현상금, 캘린더를 건드리지 않는다.
- 클로드가 기획을 넓게 해석해 새 페이지/프로토타입으로 빠지지 않도록, 모든 기능은 기존 BASE/Battle Hub/영토 패널/전투 결과 모달에 붙인다.
- 완료 판정은 "API + UI + fallback + mobile + docs + verification" 전체가 충족될 때만 가능하다.

### v5.97 최신 핸드오프 — Daily OPS / 전술랩 로컬라이징 핫픽스

- Daily OPS 주간 보상 버튼은 `openOpsRewardInventory()`를 통해 `BASE > SHOP > MY ITEMS`로 이동한다.
- `openBaseModal()`이 기본적으로 내 영토 탭을 여는 흐름이 있으므로, 상점/인벤토리 이동은 모달 오픈 후 지연 실행되어야 한다.
- 전술랩은 `lang` 쿼리 또는 부모 `LANG`을 읽어 UI 문구/명령/함선 도감/광물/함대 상태 패널을 현 언어로 렌더링한다.
- 영토 외부 링크는 `_normalizeExternalLink()`와 `_applyExternalLinkDisplay()`를 통해 데스크탑/모바일 모두 같은 정규화 규칙을 사용한다.

### v5.87 최신 핸드오프 — Claude 남은 작업 실행 지시서

- `docs/CLAUDE_WORK_ORDER_2026-05-05.md`를 추가했다.
- 이 문서는 캠페인 진행 정리, 함대전 세로 탑뷰 안정화, Fleet Command UX, 함선 경제 UX, 영토 유틸리티 순으로 남은 작업을 실행 단위로 정리한다.
- 클로드가 오래된 리서치/프로토타입 문서를 기준으로 엇나가지 않도록 현재 source of truth와 금지 범위를 명시했다.

### v5.91 최신 핸드오프 — P5 영토 유틸리티 풀기획

- `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md`를 추가했다.
- `docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md`를 추가해 클로드가 P5-1 생산 가시성부터 구현하도록 지시했다.
- 영토는 개인 캔버스, 생산 노드, 전쟁/경제 앵커라는 세 역할을 동시에 가져야 한다.
- P5는 최종적으로 생산, 재료 harvest, 조선소/마켓 연결, 영토 업그레이드/역할, 섹터 컨트롤, 어드민 경제 튜닝까지 개발한다.
- 구현 순서는 생산 가시성, 재료 harvest, 조선소 연결을 먼저 안정화한 뒤 영토 업그레이드/역할, 섹터 컨트롤, 어드민 튜닝으로 확장한다.
- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`의 P5 항목도 MVP가 아니라 풀 시스템 기준으로 갱신했다.

### v5.86 최신 핸드오프 — 캠페인 에디터 좌표 freshness 정합

- 캠페인 에디터 layout payload에 `updatedAt`을 포함하고, 캐릭터/오버레이/대사박스/폰트 변경 시 localStorage timestamp를 갱신한다.
- 인게임 스토리 렌더러는 로컬 에디터 좌표가 timestamp를 가진 최신 변경일 때만 서버 layout보다 우선한다.
- 기존에는 게임 화면 쪽 브라우저에 남아 있던 오래된 `editorCharacters`/`editorDialog` localStorage가 서버에 저장된 최신 좌표를 덮어쓸 수 있었다. 이 경로를 차단했다.
- 에디터 reset layout도 서버에 즉시 동기화되도록 보강했다.
- 관련 위치: `assets/campaign-editor.html`, `index.html` `_campaignComposeEditorLayout`.

### v5.85 최신 핸드오프 — Fleet Command 모달 유지 + 실패 사유 UX

- Fleet Command의 진형/기동 변경은 성공 후 전체 함대 목록을 다시 당겨오지 않고 현재 모달 상태를 제자리에서 갱신한다. 버튼 조작 후 화면이 닫히거나 튕기는 것처럼 느껴지는 재렌더를 줄였다.
- 기함 지정은 성공 후 선택 함대 상세만 다시 로드하고 모달/스크롤을 유지한다.
- Fleet Command 공통 오류 메시지 helper를 추가해 `SHIP_CANNOT_BE_FLAGSHIP`, `SHIP_LISTED_FOR_SALE`, `FLEET_IN_BATTLE` 같은 서버 에러를 한국어 원인으로 보여준다.
- 함선 카드 선택 시 마지막으로 누른 함선에 focused outline을 추가하고, 선택 요약 패널에 `기함/기함 가능/기함 불가` 상태를 표시한다.
- 관련 위치: `index.html` Fleet Command state/render/action helpers.

### v5.84 최신 핸드오프 — 로컬 찌꺼기 파일 정리

- `.gitignore`에는 이미 `.DS_Store`가 등록되어 있었지만, 과거에 추적된 `assets/campaign/characters/.DS_Store`가 남아 있어 저장소에서 제거했다.
- 미추적 `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 스타폭스/함대전 리서치 문서일 수 있어 자동 삭제하지 않았다. 필요 없으면 별도 지시로 삭제하면 된다.

### v5.83 최신 핸드오프 — 캠페인 CH2 목표 보강 + 완료 카드 접힘 방어

- 캠페인 카드 렌더링은 이제 `campaignProgressStatus()` / `isCampaignProgressDone()` helper로 상태를 정규화한다. `completed`/`claimed`뿐 아니라 `completedAt`이 있는 진행도도 완료 compact 카드로 처리한다.
- 완료 결과 모달도 같은 status helper를 사용해 상태 문자열 차이로 완료/실패 판정이 흔들리는 위험을 줄였다.
- MCC CH2에 `fleet_line` objective를 추가했다. 플레이어는 함대 1개 구성뿐 아니라 살아 있고 판매중이 아니며 함대에 편입된 함선 3척을 갖춰야 한다.
- 서버 `objectiveState.fleetShips`는 `ships.fleet_id IS NOT NULL`, `is_alive = true`, `is_market_listed = false` 조건으로 집계한다.
- 관련 위치: `index.html` campaign UI helpers, `server/services/campaign.js` objective presets + live objective state.

### v5.82 최신 핸드오프 — 함선 경제 가시성 + 함대지휘 판매중 잠금

- 조선소 청사진 카드가 조건 부족 상태여도 카드 전체를 과하게 흐리지 않는다. 보유 재료는 `보유`, 부족 재료는 `부족` 라벨과 색으로 즉시 구분된다.
- 강화 버튼도 성공 확률과 강화 재료 보유/부족 상태를 버튼 안에서 바로 읽을 수 있게 했다. 판매중 함선은 계속 강화/수리/실드/해체가 막힌다.
- Fleet API는 판매중 함선이 함대 이동/기함 지정/자동 기함 보장 경로에 들어오면 `SHIP_LISTED_FOR_SALE`로 명확히 차단한다.
- Fleet Command 미리보기는 함선 PNG가 위를 보는 세로 전장 기준으로 다시 정렬했다. 쐐기는 소형함 선두, 대형함/기함 후방 중심으로 읽힌다.
- 관련 위치: `index.html` shipyard/fleet command UI, `server/services/fleet.js`, `server/routes/fleets.js`.

### v5.81 최신 핸드오프 — 캠페인 함선 보상 실제 지급

- 캠페인 보상함 수령 시 `ship`/`ship_fleet` 타입은 실제 `ships` 인스턴스를 생성해 기본 함대에 지급한다.
- `shard_frigate`, `longeye_sniper`, `captured_sequoia`, `captured_ironclad`, `prometheus_titan`, MCC 함대 패키지 등 주요 캠페인 보상 코드를 현재 22종 `ship_types` 코드로 매핑했다.
- 유저에게 함대가 없으면 `wedge/advance` 기본 함대를 만들고, 첫 지급 함선은 기함 가능 조건에 따라 자동 기함 지정된다.
- `ship_blueprint`, `ship_choice`, `asset`, `stream`류는 아직 별도 영구 시스템이 없으므로 v5.80의 안전 수령 처리에 남겨둔다.
- 관련 위치: `server/services/campaign.js` `grantCampaignShips`, `campaignShipRewardPlan`.

### v5.80 최신 핸드오프 — 캠페인 보상함 수령 플로우

- 캠페인 완료 후 `campaign_reward_inbox`에 쌓이는 아이템형 보상을 BASE/퀘스트 캠페인 패널에서 확인하고 수령할 수 있게 했다.
- `/api/campaign/reward/claim`이 추가됐다. 미수령 보상을 row lock으로 잡고, 실제 `resources`/`item_types`에 매칭되는 보상은 유저 인벤토리에 지급한 뒤 `claimed = TRUE`로 닫는다.
- 아직 별도 시스템이 없는 서사형 보상(`asset`, `data_artifact`, `resource_stream`, `ship_choice` 등)은 오류로 막지 않고 수령 처리/트랜잭션 기록까지 진행한다. 장기 시스템화 전까지 캠페인 진행이 dead-end로 막히지 않게 하는 임시 안전장치다.
- 캠페인 상태 응답의 `rewardInbox`는 이제 `id`를 포함하고, `objectiveState.campaignRewardClaims`도 내려준다.
- 관련 위치: `server/services/campaign.js`, `server/routes/api.js`, `index.html` campaign panel.

### v5.79 최신 핸드오프 — 캠페인 영토 채굴 objective 연결

- MCC CH1 objective에 `first_harvest`를 추가했다. 초반 캠페인은 이제 영토 확보/이미지 등록 후 실제 PP 채굴 1회를 요구한다.
- `objectiveState.territoryHarvests`는 `transactions.type = 'mining'`와 `from_wallet` 기준으로 유저의 영토 수확 횟수를 집계한다.
- 기존 `territory` action routing을 사용해 채굴 objective는 BASE/내 영토 동선으로 이동한다.
- 관련 위치: `server/services/campaign.js` objective presets + live objective state.

### v5.78 핸드오프 — 캠페인 함선 강화 objective 연결

- MCC CH3 objective에 `first_upgrade`를 추가했다. 플레이어는 함대전 완료 뒤 함선 스탯 강화 1회를 진행해야 마켓 등록/결과 수령 루프로 넘어간다.
- `objectiveState.shipUpgrades`는 `ship_stat_upgrade_log`에서 유저의 성공 강화 횟수를 집계한다.
- 서버 DB가 v210 이전이라 `success` 컬럼이 없으면 기존 로그 전체를 성공 강화로 간주하고, 테이블/컬럼이 없으면 safe query로 0 처리한다.
- 기존 objective action routing을 그대로 사용해 강화 objective는 조선소(`shipyard`)로 이동한다.
- 관련 위치: `server/services/campaign.js` objective presets + live objective state.

### v5.77 최신 핸드오프 — 캠페인 에디터 기본 좌표/버그 신고 안정화

- 캠페인 스토리 캐릭터 기본 배치를 에디터 기본값과 맞췄다. 단일 캐릭터는 `{x:50,y:55,w:60}`, 2인 대화는 left/right `{x:28/72,y:55,w:50}` 기준으로 시작하고, 저장된 layout이 있으면 그 위에 덮는다.
- 저장 layout이 없는 씬도 더 이상 인게임 CSS의 bottom-anchor fallback으로 렌더되지 않아 에디터 미리보기와 인게임 기본 위치가 크게 어긋나는 위험이 줄었다.
- 캠페인 background `fade_slow`/`fade_medium` 시간을 줄여 화면 전환 때 파란/빈 화면이 길게 보이는 체감을 완화했다.
- 버그 신고 버튼/모달 버튼에 `type="button"`과 이벤트 차단을 적용하고, html2canvas CDN 로드가 늦거나 실패해도 1.8초 후 수동 스크린샷 UI가 복구되게 했다.
- 버그 신고 제출은 `/api/bug-report` 실패 시 `/bug-report` alias로 재시도하고, 서버도 `/bug-report` 호환 submit route를 제공한다.
- 관련 위치: `index.html` campaign story renderer + bug reporter, `server/routes/bugReport.js`.

### v5.76 최신 핸드오프 — 조선소 조건 상세/함대지휘 모달 유지

- 조선소 청사진 카드에서 GP/재료가 부족해도 버튼을 disabled로 막지 않고, `재료 확인`/잠금 상세 모달을 열어 보유량과 필요량을 확인하게 했다.
- 제작 확인 모달은 GP/광물을 `보유 / 필요` 문구로 표시하고, 부족한 항목은 붉은색, 충분한 항목은 녹색으로 표시한다. 조건 부족 시 실행 버튼만 disabled다.
- 강화 확인 모달도 GP와 재료를 같은 `보유 / 필요` 문구로 통일했다.
- 인벤토리 resource code를 소문자로 정규화해 보유 재료가 있는데도 부족으로 표시되는 위험을 낮췄다.
- Fleet Command 내부 버튼에 `type="button"`과 `preventDefault/stopPropagation`을 적용해 진형/기동/기함/이동/이름/해체 동작 후 모달이 닫히는 현상을 줄였다.
- 관련 위치: `index.html` shipyard requirement helpers, blueprint build dialog, fleet command controls.

### v5.75 최신 핸드오프 — 캠페인 objective 완료 hard gate

- 캠페인 완료는 이제 클라이언트 진행률 100%만으로 처리되지 않는다.
- `/api/campaign/progress`는 진행률과 함께 `objectives`, `missingObjectives`, `nextObjective`, `preview.readyToComplete`를 내려준다.
- `/api/campaign/complete`는 필수 DB 기반 objective가 부족하면 `OBJECTIVE_REQUIREMENTS_NOT_MET`을 반환하고 보상/완료 처리를 막는다.
- 프론트 `pollCampaignProgress()`는 `preview.readyToComplete === true`일 때만 자동 완료한다. 타이머가 100%여도 목표가 남아 있으면 남은 objective와 GO 동선을 보여준다.
- 캠페인 start/alreadyCompleted 응답도 live objective state를 포함해 시작 직후 목표 수량이 비지 않게 했다.
- 관련 위치: `server/services/campaign.js` objective gate/progress, `index.html` campaign sim modal.

### v5.74 최신 핸드오프 — 캠페인 에디터/인게임 위치 정합 핫픽스

- 모바일 인게임 story stage가 화면 전체 비율로 늘어나 에디터의 9:16 좌표와 다르게 해석되던 문제를 수정했다.
- 모바일도 에디터와 같은 9:16 stage 좌표계를 유지한다. 캐릭터/대사박스 `x/y/w/h`는 이제 에디터 프리뷰와 같은 기준으로 렌더된다.
- 에디터 layout GET/POST, 인게임 layout fetch, 서버 GET 응답 모두 `no-store`/timestamp를 적용해 저장 후 이전 layout이 보이는 위험을 낮췄다.
- 에디터 layout이 적용된 대사박스는 인게임 기본 mobile safe-area padding 대신 compact editor padding을 쓴다.
- 관련 위치: `index.html` story CSS + `_campaignApplyDialogLayout`, `assets/campaign-editor.html` layout sync, `server/routes/api.js` `/api/campaign/editor-layout`.

### v5.73 최신 핸드오프 — 캠페인 objective 클릭 동선

- 캠페인 objective가 이제 지원되는 action에 한해 `GO` 버튼처럼 동작한다.
- `territory`, `territory_art`는 BASE 내 영토 탭으로 보낸다.
- `shipyard`는 조선소 청사진 탭으로, `fleet`은 Fleet Command로 보낸다.
- `fleet_battle`은 PVP 탭을 열고 Battle Hub를 시도한다.
- `market`은 BASE Market 탭으로 보낸다.
- 완료된 objective와 story/result/choice 등 직접 이동할 화면이 없는 objective는 읽기 전용으로 유지한다.
- 관련 프론트 함수: `campaignObjectivesHtml`, `campaignObjectiveActionTarget`, `handleCampaignObjectiveAction` in `index.html`.

### v5.72 최신 핸드오프 — 캠페인 objective 확장

- `first_art`, `first_battle`, `first_listing` objective를 실제 DB 상태와 연결했다.
- `objectiveState.artClaims`는 플레이어 소유 `claims.image_url`이 있는 영토 수를 센다.
- `objectiveState.completedFleetBattles`는 `fleet_battles.status = 'ended'`와 `fleet_battle_participants.wallet_address` 기준으로 완료 전투 수를 센다.
- `objectiveState.marketListings`는 활성 `ship_market_listings`와 일반 `marketplace_listings`를 합산한다.
- MCC CH1에는 영토 이미지 등록 objective를 추가했고, MCC CH3에는 첫 함대전 완료/첫 마켓 등록 objective를 추가했다.
- 아직 완료 hard gate는 적용하지 않았다. 캠페인 목표 노출이 실제 상태와 잘 맞는지 먼저 확인한 뒤 챕터별 gate를 넣는 순서가 안전하다.

### v5.71 최신 핸드오프 — 캠페인 objective 실제 상태 연결

- 캠페인 상태 응답에 `objectiveState`를 추가했다. 현재는 `ownedClaims`, `ownedShips`, `activeShips`, `fleets`, `marketListedShips`, `completedFleetBattles`를 서버에서 집계한다.
- CH1은 첫 영토 확보, CH2는 첫 함대 구성, FSP/CV CH1은 첫 함선 보유 objective를 실제 DB 보유량과 연결한다.
- objective 항목은 `current`, `target`, `requirementMet`을 내려주며 프론트 카드/브리핑에서 `현재/필요` 수량을 표시한다.
- 없는 테이블/컬럼이나 마이그레이션 차이가 있어도 캠페인 리스트 전체가 터지지 않도록 objective count는 safe query로 0 처리한다.
- 이번 단계는 표시/안내 판정까지다. 캠페인 완료를 강제로 막는 hard gate는 유저 진행이 갑자기 막히지 않도록 아직 적용하지 않았다.

### v5.70 최신 핸드오프 — 캠페인 메인퀘스트 스캐폴드

- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`를 추가해 방향성 문서를 실제 개발 스프린트로 쪼갔다.
- 캠페인 서버 공개 스키마에 `objectives`와 `nextObjective`를 추가했다.
- 프론트 캠페인 카드와 브리핑 모달은 챕터별 작전 목표를 표시한다.
- 이번 단계는 목표 표시/동선 정리 스캐폴드다. 다음 단계는 `first_claim`, `first_ship`, `first_battle`, `first_listing` 같은 objective를 실제 DB 상태와 연결하는 것이다.
- 캠페인은 여전히 전면 신규 제작이 아니라 기존 챕터를 메인퀘스트처럼 재배선하는 방향을 유지한다.

### v5.69 최신 핸드오프 — 게임 방향성 기준 문서

- `docs/GAME_DIRECTION_2026-05-04.md`에 OCCUPY MARS의 핵심 방향성을 문서화했다.
- 게임의 한 줄 정의는 "화성의 영토를 사고 꾸미고 생산지로 키우며, 캠페인으로 세계관을 따라가고, 함선을 자산처럼 제작·강화·거래해 전쟁과 시장에서 영향력을 넓히는 화성 개척 경제 전략 게임"이다.
- 앞으로의 기능 판단 기준은 캠페인, 영토, 함대, 전쟁/경제 네 기둥이다.
- 캠페인은 전면 신규 제작이 아니라 기존 챕터/이미지/캐릭터를 유지한 "캠페인 리마스터" 방향으로 잡았다. 새로 필요한 것은 전체 재작성보다 목표, 보상, 잠금 해제, 시스템 연결이다.
- 새 기능은 위 네 기둥 중 어디에 연결되는지 먼저 확인한다. 연결되지 않는 단발성 기능은 보류한다.

### v5.68 최신 핸드오프 — 조선소 제작/강화 재료 보유량 표시

- 조선소 청사진 카드의 GP/광물 비용은 이제 `보유 / 필요`로 표시된다. 충분한 항목은 녹색 활성 톤, 부족한 항목은 붉은 비활성 톤으로 표시된다.
- 함선 제작 확인 모달도 같은 기준으로 GP와 모든 광물 요구량을 보여준다. 하나라도 부족하면 확인 버튼이 disabled 상태가 된다.
- 보유 함선 강화 버튼은 GP 비용, 성공 확률, 강화 재료의 현재 보유량/필요량을 함께 표시한다. 부족한 GP나 재료는 버튼 안에서도 붉은 톤으로 보인다.
- 강화 확인 모달은 성공 확률, GP `보유 / 필요`, 재료 `보유 / 필요`를 모두 표시하며, 부족하면 강화 실행 버튼을 막는다.

### v5.67 최신 핸드오프 — 캠페인 에디터/인게임 좌표 정합

- 캠페인 에디터는 캐릭터 `x/y`를 **중심점 기준**으로 저장하고 `translate(-50%,-50%)`로 렌더한다. 인게임도 같은 기준으로 되돌려 에디터에서 맞춘 캐릭터 위치가 오른쪽/아래로 밀리지 않게 했다.
- 레거시 top-left 좌표가 필요하면 캐릭터 layout에 `anchor: "top-left"` 또는 `origin: "top-left"`를 명시하면 된다. 기본은 에디터와 동일한 center anchor다.
- 데스크탑 스토리 stage는 에디터와 같은 9:16 좌표계로 고정했다. 모바일은 기존처럼 전체화면을 유지하되 같은 좌표 적용 로직을 쓴다.
- 배경 기본 크롭을 에디터와 같은 `50% 50%` 중앙 cover로 통일했다. 별도 배경 layout이 있으면 해당 값이 우선한다.

### v5.66 핸드오프 — 버그 리포터 제출/코덱스 인박스

- 인게임 버그 리포터 프론트와 서버 payload 계약을 맞췄다. 프론트는 이제 `title/body/category/url/wallet/viewport/lang/recentErrors/context/screenshot`을 함께 보낸다.
- 서버 `bugReport.submitReport()`는 구버전 `description/context/screenshot` payload도 정규화해 받는다. 기존 배포 캐시가 남아 있어도 `empty`로 실패하면 안 된다.
- 새 리포트는 DB `bug_reports`에 저장되고, Claude/Codex가 바로 읽을 수 있도록 `server/bug-reports/inbox/<id>_<category>.json`에 `context`, `recent_errors`, `codex_hint`를 포함해 미러링한다.
- 스크린샷이 있으면 DB에 넣지 않고 `server/bug-reports/screenshots/<id>.<ext>`로 저장한 뒤 JSON에 `screenshot_path`를 기록한다.
- html2canvas 로더의 ID 오타를 고쳐 중복 로딩을 막고, CDN 로드 실패 시에도 제출 폼은 계속 사용할 수 있게 했다.

### v5.65 최신 핸드오프 — 함선 강화 재료 표시 + 함대지휘 모달 안정화

- 조선소 보유함에서 강화 버튼을 누르면 확인 모달에 필요 재료의 `보유 / 필요` 수량이 표시된다. 부족하면 `부족` 상태와 `insufficient` 플래그가 함께 들어간다.
- Fleet Command 모바일 safe-area CSS 셀렉터 오타를 `.fleetcmd-modal-backdrop`으로 수정했다.
- Fleet Command 모달 내부 클릭은 상위 레이어로 전파되지 않도록 막았다.
- 진형/기동/함선 이동/기함 지정 후 `fleetcmd-body` 스크롤 위치와 모달 active 상태를 복구한다. 버튼을 눌렀다고 모달이 튕겨 나가거나 상단으로 점프하면 안 된다.
- 쐐기 진형 미리보기는 함선이 위를 보는 세로 전장 기준으로 앞쪽 1척 → 후방 2척 → 후방 3척 식의 삼각 돌격 대형으로 표시한다. 기함은 후방 중심에 둔다.
- Composition 수량은 `size_class`와 `class_label`을 정규화해 집계한다. `EW Frigate`, `Interceptor`, `battle_ship` 같은 별칭이 누락 카운트로 빠지지 않게 했다.
- Fleet API의 함대 목록/상세/수정/이동 소유권 체크는 wallet 대소문자를 무시하도록 정리했다.

### v5.64 최신 핸드오프 — 캠페인 에디터 위치 우선 + 함대지휘 세로 UX

- 캠페인 스토리 렌더러는 서버 `/api/campaign/editor-layout` 응답을 받은 뒤에도 브라우저 localStorage의 최신 에디터 좌표를 다시 병합한다.
- 에디터는 좌표를 즉시 localStorage에 저장하고 서버 동기화는 debounce 되므로, 인게임은 `serverLayout + localLayout` 순서로 합쳐 local editor 값이 우선한다.
- 함대지휘 프리뷰는 함선 PNG가 위를 보는 전제에 맞춰 세로 진형으로 표시한다. 기함은 후방 중심, 쐐기/스크린/핀서/구형 진형은 위쪽 전선으로 읽히게 배치한다.
- 함대지휘 미리보기에서는 구형 SVG fallback을 숨겨 PNG 뒤로 예전 벡터 실루엣이 비치는 현상을 차단한다.
- 진형/기동 버튼은 클릭 즉시 미리보기를 바꾸고 모달을 유지한다. API 실패 시 이전 상태로 되돌리고 에러 토스트를 띄운다.
- 함선 카드 선택 시 `SELECTED` 배지와 선택 상세 패널이 표시된다. 마지막으로 누른 함선이 패널에 뜬다.
- 기함 지정은 owner wallet 대소문자 차이와 `fleet_id` 타입 차이 때문에 실패할 수 있어 서버 쿼리를 `LOWER()` 비교 + 숫자 비교로 보정했다.

### v5.63 최신 핸드오프 — 함선 확률 강화/마켓 + 전투/조선소 시각 보정

- 보유 함선 강화는 이제 `ship.upgrade_offers`로 GP 비용, 성공 확률, 필요 재료를 함께 제공한다.
- `POST /api/ships/:id/upgrade-stat`는 무조건 성공하지 않는다. 성공/실패 모두 GP와 재료를 소모하고, 성공 시에만 스탯 보너스를 누적한다.
- 강화 로그 `ship_stat_upgrade_log`는 `success`, `success_chance`, `roll`, `materials_used`를 기록한다.
- 함선 마켓은 `ship_market_listings`와 `ships.is_market_listed`를 사용한다. 판매중 함선은 강화/수리/실드/해체가 막히고, UI에 `판매중` 스티커가 붙는다.
- 신규 API: `GET /api/ships/market/listings`, `POST /api/ships/:id/list`, `POST /api/ships/market/listings/:id/buy`, `POST /api/ships/market/listings/:id/cancel`.
- 조선소 청사진/보유함 미리보기는 불꽃 오버레이를 제거하고 PNG 밝기/대비를 올려 함선 본체 가독성을 우선한다.
- 택티컬랩 빔포/미사일 이펙트는 2~3초 정도 유지되도록 길어졌고, 하단 무전 콜아웃은 버튼과 덜 겹치게 위로 올렸다.
- 화성 상층권 배경은 기존보다 밝게 조정했다. 데모(`assets/fleet-assault-demo.html`)와 본서버(`assets/tactical-lab-v11.html`) 양쪽을 같이 수정해야 한다.

### v5.62 최신 핸드오프 — 캠페인 퀘스트 즉시 클리어 방지

- 캠페인 작전 챕터는 더 이상 스토리/결과 씬을 넘겼다는 이유만으로 즉시 `complete` 처리하지 않는다.
- 프론트 `showCampaignSim()`은 `/api/campaign/progress`를 폴링해 서버 진행률/남은 시간을 표시하고, `readyToComplete`가 true일 때만 완료 API를 호출한다.
- 서버 `campaign.complete()`는 프롤로그/순수 시네마틱을 제외한 챕터에서 챕터 런타임이 차기 전 `MISSION_IN_PROGRESS`를 반환한다.
- 챕터 런타임은 `environment.totalDurationSeconds` 또는 `estimatedPlayTimeSeconds` 기준이며, 서버 진행률은 기존 압축 배율 28x를 유지한다.
- `getProgress()`는 하드코딩된 CH1 840초 대신 각 챕터 런타임 기반 `progressPct`, `remainingSec`, `readyToComplete`를 반환한다.

### v5.61 최신 핸드오프 — 완료 캠페인 챕터 전체 접힘 처리

- 캠페인 리스트에서 완료(`completed`/`claimed`)된 챕터는 챕터 번호와 관계없이 compact 카드로 접어서 표시한다.
- 기존에는 `chapterNumber === 0` 프롤로그만 접고 CH1 이후 완료 챕터는 큰 카드로 남는 조건 버그가 있었다.
- compact 완료 카드의 메타는 `PROLOGUE` 또는 `CH N`을 표시하고, 버튼은 `RESULTS`를 유지한다.
- 진행 중/시작 가능 챕터만 큰 카드와 metric 영역을 표시한다.

### v5.60 최신 핸드오프 — 캠페인 에디터/인게임 배치 일치 + 전환 렉 완화

- 캠페인 스토리 캐릭터 배치는 에디터와 같은 top-left percent `x/y/w` 기준으로 해석한다. `cx/centerX`, `cy/centerY`를 쓴 경우에만 center transform을 적용한다.
- 단일 캐릭터 대화씬은 기본 중앙 배치(`story-character-center`)를 사용한다. `mcc_ch2_frozen_highway` s08처럼 `scene.characters`가 없는 단일 화자 씬이 왼쪽으로 밀리면 안 된다.
- 스토리 진입 시 localStorage 에디터 레이아웃을 첫 프레임부터 적용하고, 서버 `/api/campaign/editor-layout` 응답이 다르면 재렌더한다.
- 배경/캐릭터/오버레이 이미지는 `_campaignPreloadImage()` 캐시를 통해 현재/다음 라인을 선로딩한다.
- 대사 타이핑은 `setInterval` 대신 `requestAnimationFrame` 기반으로 갱신한다. 대화창 blur는 제거해 화면전환/타이핑 중 repaint 비용을 줄였다.
- 캐릭터 에셋 매핑은 전체 campaign-story speaker 42종 기준 누락 없음. `crow`는 존재하지 않는 `kara_vex`가 아니라 `crow.png`로 매핑한다.

### v5.59 핸드오프 — 화성 상층권 전투 배경

- 택티컬랩 전투 배경은 `assets/textures/mars_nasa_2k.jpg`를 사용한다.
- `MARS_BATTLE_BG`가 비동기로 로드되고, `drawBG()`에서 어둡게 누른 화성 표면 텍스처를 아주 느리게 패닝한다.
- 배경 위에 어두운 veil/기존 주황·푸른 글로우/희미한 먼지 스트릭을 덧씌워 함선·레이저 가독성을 우선한다.
- 검수용 `assets/fleet-assault-demo.html`과 본서버 `assets/tactical-lab-v11.html` 양쪽에 동일 반영해야 한다.
- 배경 밝기/속도 조정 시 `drawBG()`의 `globalAlpha`, `drift`, `veil` 값을 조정한다. 함대전 가독성을 해치지 말 것.

### v5.58 핸드오프 — 함대전 PNG 로드 전 구형 벡터 차단

- 택티컬랩 전투 렌더러는 `SHIP_SPRITE_STATUS`로 22종 PNG 로드 상태를 추적한다.
- PNG가 아직 `loading`인 함선은 구형 벡터/SVG fallback을 그리지 않는다. 첫 프레임에서 예전 실루엣이 깨져 보이는 현상을 막기 위한 처리다.
- PNG 로드가 실제로 실패한 경우에만 구형 벡터 fallback을 허용한다.
- 엔진 플레임/대형함 HP bar도 함선 본체가 그려진 프레임에서만 표시한다.

### v5.57 핸드오프 — 보유 함선 무한 스탯 강화

- 보유 함선은 `POST /api/ships/:id/upgrade-stat`로 `atk`, `def`, `hp`, `speed` 중 하나를 영구 강화할 수 있다.
- 강화는 실패/파괴/등급명 없이 누적된다. 조선소 보유 함선 카드에는 기본 스탯 옆에 녹색 `(+N)` 보너스가 표시된다.
- `server/migrations/209_ship_infinite_stat_upgrades.sql`가 `ships.bonus_speed`, `ship_stat_upgrade_log`, 강화 비용/증가량 설정을 추가한다.
- 강화 비용은 총 투자 횟수 기반으로 증가한다. 설정 키는 `ship_upgrade_base_gp`, `ship_upgrade_growth`, `ship_upgrade_*_step`.
- HP 강화는 `bonus_hp`와 `current_hp`를 같이 올린다. 수리/실드/전투 계산은 `max_hp + bonus_hp` 기준을 유지한다.
- 서버 전투 엔진은 `bonus_atk`, `bonus_def`, `bonus_hp`, `bonus_speed`를 실제 전투 스탯에 반영한다.

### v5.56 핸드오프 — 함대 수 기반 전투 거리/줌

- 택티컬랩 전투에는 `battleScaleConfig()`가 있음.
- 함대 수가 적을수록 시작 간격(`startGap`), 최소/이상 교전 거리(`minPad`, `idealPad`)가 줄고 최대 카메라 줌(`maxZoom`)이 커진다.
- 함대 수가 많을수록 시작 거리와 교전 거리가 멀어지고 자동 카메라는 전체 전장 프레이밍을 우선한다.
- 1:1 소규모전은 더 가까운 거리에서 크게 보이는 방향으로 조정되어야 한다. 소규모전 카메라를 다시 멀게 만들지 말 것.
- 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.

### v5.55 핸드오프 — 함대전 무전 콜아웃

- 택티컬랩 전투 화면에 `.battle-comms.top/bottom` 콜아웃 레이어가 있음.
- 명령/진형/기동/승리 문구는 상단, 피격/격침/후퇴 경고는 하단에 표시한다.
- `battleCallout()`, `panicCallout()`, `maybeAmbientCallout()`이 전장 무전 UI를 담당한다.
- 소형함 격침은 확률적으로 짧은 비명/탈출 대사를 표시하고, 대형함/기함 격침은 강한 경고 문구를 표시한다.
- 수동 스킬(`cmdFocus`, `cmdEMP`, `cmdBeamCannon`, `cmdMissileBarrage`)과 `cmdFormation`, `cmdManeuver`는 전투 로그와 별도로 콜아웃도 띄운다.
- 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.

### v5.54 핸드오프 — 수동 빔포/미사일 스킬

- 택티컬랩에 `☢ 빔포`와 `☄ 미사일` 수동 스킬 버튼이 있음.
- `beamCharge`는 살아있는 ATK 전함/타이탄 수에 따라 충전된다. 100%에서 `cmdBeamCannon()`이 우선순위 대형 목표에 두꺼운 주포 빔을 발사한다.
- `missileCharge`는 살아있는 ATK 프리깃/구축함/순양함 수에 따라 충전된다. 100%에서 `cmdMissileBarrage()`가 다수 미사일을 적 함대에 뿌린다.
- 빔포는 `lasers[]`의 `beamCannon` 플래그로 굵기/글로우를 다르게 렌더한다.
- 수동 스킬은 데모/본서버 택티컬랩 양쪽에 동일 반영해야 한다. `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`로 복사하는 흐름 유지.
- 현재 수동 스킬은 택티컬랩 시뮬레이션 계층 명령이다. 실제 서버 전투 명령으로 영구 반영하려면 별도 API/WS command 타입(`beam_cannon`, `missile_barrage`)을 서버 전투 상태에 연결해야 한다.

### v5.53 핸드오프 — 함선 상성/진영 밸런스 + 조선소 세로 UI

- `server/services/battleEngine.js`의 `getShipMatchupMult()`가 역할/함급/파벌 상성을 실제 데미지에 반영한다.
- 기본 상성은 `tackle > ewar/logi`, `sniper > tank/capital`, `bomb > battleship/titan`, `tank/screen > small rush`, `logi = 직접 화력 낮음`.
- 파벌 교리는 MCC=정밀 저격/대형함 처리, FSP=장기전/탱킹/로지, CV=러시/폭격/순간화력이다.
- `server/migrations/208_ship_matchups_and_doctrine.sql`은 22종 함선 스탯/설명/일부 role(`mcc_snp=sniper`, `cv_bomb=bomb`)을 재조정한다.
- `assets/tactical-lab-v11.html`에도 같은 상성 계산이 들어가 있어 데모 전투 결과와 서버 결과의 방향성이 맞아야 한다.
- 택티컬랩 사운드는 외부 음원 없이 WebAudio로 생성한다. 브라우저 자동재생 제한 때문에 `SOUND` 버튼을 눌러야 BGM/SFX가 켜진다.
- 세로 전장 기동 표기는 `↑ Advance`, `↓ Retreat`를 사용한다. 가로 화살표로 되돌리지 말 것.
- 조선소 청사진은 데스크탑 4열, 모바일 1열 카드이며 `assets/ships/top/{ship_code}.png` 세로 함선 이미지를 사용한다.
- PNG 로드 시 기존 SVG 실루엣은 숨기고 새 `.bp-engine-flame` 오버레이를 후미 불꽃으로 사용한다.

### v5.52 핸드오프 — 탑뷰 함선 PNG + 장거리 함대전

- `assets/tactical-lab-v11.html`은 v11.1 기반 세로 전장으로 전환됨. 적군 상단, 아군 하단.
- `assets/fleet-assault-demo.html`은 데모/검수용 원본이며, 현재 내용은 `assets/tactical-lab-v11.html`에도 복사되어 본서버 택티컬랩과 동일해야 함.
- `assets/ships/top/`에 실제 사용되는 22종 함선 PNG 축소본이 있음. `mcc_destroyer_top.png`는 코드상 22종에 포함되지 않는 중복 샘플이므로 매핑 제외.
- 전투와 SHIP REGISTRY 미리보기는 같은 PNG 스프라이트 렌더러를 사용. 기존 벡터 함선은 PNG 로드 실패 시 fallback 용도로만 유지.
- 엔진 플레임은 `drawEngineFlame()`으로 통일. 예전 벡터 기준 파란 불꽃을 별도로 되살리지 말 것.
- 함선은 사격 시 `aimX/aimY/aimTTL`로 현재 타겟 좌표를 바라본다. 이동 방향보다 공격 대상 방향이 우선.
- 장거리 함대전 느낌을 위해 `updateFleets()`의 `minDist`/`idealDist`는 넓게 잡혀 있음. 근접 난전처럼 함대가 겹치지 않게 유지.
- 자동 카메라는 함대 반경이 아니라 살아있는 함선 스프라이트 바운딩 박스 기준으로 프레이밍한다.
- 모바일 HUD는 속도 오버레이 단일 버튼(`x1/x2/x4/x8` 순환) + 소형 전술/진형/기동 그리드.
- 증원 테스트 버튼(`MCC x10`, `FSP x10`, `Cruiser`)은 본서버 함대전 UI에서 제거.
- 모바일 퍼포먼스 모드가 작은 함선 대표 렌더, 발사 밀도/총알 누적/폭발 파티클/글로우 비용을 제한함.

## 1. 프로젝트 한 줄 요약

**화성 세계 지도 위 픽셀 영토를 GP(게임 포인트)로 클레임하고, 섹터 거버넌스·함대전·길드전을 벌이는 Web3 게임형 광고 플랫폼.**
백엔드 Express + PostgreSQL, 프론트 단일 파일 `index.html` (35k줄 인라인 앱).

---

## 2. 환경 & 실행

```bash
# DB
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar   # 로컬
# 로컬 서버 시작
cd server && node index.js          # 또는 npm run dev (watch 모드)
# 포트
3000 (기본, PORT env로 오버라이드)
```

**필수 env 변수** (`server/.env`):
```
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar
JWT_SECRET=...
ADMIN_SECRET=...          # 어드민 API 인증 헤더값
NODE_ENV=development
```

---

## 3. 디렉터리 구조

```
/
├── index.html              ← 메인 앱 (CSS+HTML+JS 인라인, 35k줄 — 절대 분리 시도하지 말 것)
├── admin.html              ← 어드민 패널 (동일 구조, 인라인)
├── CLAUDE.md               ← 이 파일
├── CLAUDE_CODE_BRIEF.md    ← 구버전 브리핑 (v1.0, 참고용만)
├── server/
│   ├── index.js            ← Express 앱 + 스케줄러 (~1,151줄)
│   ├── db.js               ← Pool + initDB + getSetting + logGPActivity + 공통 유틸
│   ├── migrate.js          ← 파일 기반 마이그레이션 러너
│   ├── migrations/         ← SQL 파일 001~199 (2026-04-29 기준)
│   │   └── archived/       ← 사용 안 하는 구버전 마이그레이션 (51개, 건드리지 말 것)
│   ├── routes/             ← 61개 라우트 파일 (/api/* 경로)
│   └── services/           ← 73개 서비스 파일 (비즈니스 로직)
├── public/
│   └── js/                 ← 미니게임 3개 (minigame-invaders/runner/digger.js)
└── assets/
    ├── lib/globe.gl.min.js ← 3D 지구본
    ├── base/, nav/, textures/, avatars/
```

---

## 4. DB 현재 상태

- **DB명**: `pixelwar` (PostgreSQL)
- **적용된 마이그레이션**: 001 ~ **203** (2026-04-29 기준)
- **총 테이블 수**: 109개+
- **마지막 마이그레이션**: `203_capital_ship_core_mid_materials.sql`

### 핵심 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | wallet_address PK, gp_balance, pp_balance, faction_code |
| `claims` | 영토 클레임 (owner, sector_code, pixels) |
| `pixels` | 개별 픽셀 소유권 |
| `settings` | key PK (JSONB value) — 모든 게임 밸런스 값 저장 |
| `schema_migrations` | filename UNIQUE — 적용된 마이그레이션 기록 |
| **Fleet Combat** | |
| `factions` | mcc/fsp/cv 3파벌 |
| `ship_types` | 22종 함선 (frigate/destroyer/cruiser/battleship/titan × 3파벌) |
| `fleets` | 유저 함대 인스턴스 |
| `ships` | 개별 함선 인스턴스 |
| `ship_build_jobs` | 건조 큐 (비동기) |
| `fleet_battles` | 함대전 세션 |
| `fleet_battle_participants` | 전투 참여자 |
| `fleet_battle_events` | 전투 이벤트 로그 (tick별) |
| `hijack_battles` | hijack 2단계 전투 연결 |
| `hijack_stats` | hijack 통계 누적 |
| `fleet_gp_activity` | 함대 GP 소비 로그 |
| **Resources** | |
| `resources` | 채굴 재료 정의 (tier 0~3, 13종) |
| `sector_resource_rates` | 구역별 채굴 재료 드롭률 (frontier/mid/core별 차별화) |
| `user_resource_inventory` | 유저 보유 광물 재고 |
| **VIP** | |
| `vip_tiers` | VIP 등급 정의 |
| `user_vip` | 유저 VIP 상태 |
| **알림** | |
| `player_notifications` | 플레이어 알림 (in-game) |
| **Campaign** | |
| `campaign_chapters` | 캠페인 챕터 메타/콘텐츠 |
| `player_campaign_progress` | 캠페인 세션/진행도/결과/보상 payload |
| `player_reputation` | mcc/fsp/cv 평판 |
| `player_chapter_choices` | 브리핑 선택지 영구 기록 |
| `player_lore_flags` | 서사 플래그 |
| `chapter_branch_modifiers` | 향후 챕터 분기 영향 |
| `campaign_reward_inbox` | blueprint 등 지연 수령 보상 |
| `campaigns` / `chapters` | 30개 캠페인 챕터용 공통 정의 |
| `campaign_sessions` | 진행 중 캠페인 세션/재접속 복구 |
| `reputation_history` | 평판 변경 감사 로그 |
| `tag_definitions` / `player_active_title` | 태그/칭호 정의 및 활성 칭호 |
| `lore_flag_definitions` / `global_lore_flags` | player/global 서사 플래그 정의 |
| `branch_modifier_definitions` / `player_branch_modifiers` | 챕터 간 분기 영향 정의/적용 |
| `environment_definitions` / `chapter_environment_configs` | Dust Storm 등 환경 정의/phase curve |

### DB 뷰
- `v_player_fleet_summary` — 유저별 함대 요약
- `v_fleet_composition` — 함대 구성 (함선 종류별)
- `v_titan_status` — Titan 함선 서버 제한 현황 (max 3척/종)

---

## 5. Campaign System Architecture

### 현재 구현 상태 (v5.33)
- **비주얼 노벨 씬 엔진**: `showCampaignStory()` 가 `showCampaignBriefing()` 를 대체. 씬 타입(`narration`, `dialogue`, `choice`, `branch`, `battle_transition`, `result`, `ending`)별로 배경·캐릭터 초상화·타이핑 애니메이션을 렌더한다. `ch.scenes` 없는 챕터는 기존 briefing 폴백.
- **이미지 에셋**: `assets/campaign/backgrounds/` 78개 PNG + `assets/campaign/characters/` 21개 PNG. 모두 GCP Vertex AI Imagen 3 (32-bit pixel art, semi-realistic, Mars sci-fi). `.gitignore` 예외 추가로 git 추적.
- **배경 매핑**: `_bgMap` (index.html)이 씬 background ID → 파일명을 매핑. 실제 파일이 있는 ID는 직접 참조, 없는 ID만 폴백.
- **씬 파일**: `docs/campaign-story/` 36개 JSON (MCC/FSP/CV Ch1~10 + Prologue 3종). `campaign.js`의 `CHAPTERS[id].scenesFile` 필드로 참조.
- **MVP 방식**: MCC Campaign Ch1~10과 FSP Campaign Ch1~10은 `server/services/campaign.js`의 서버 결정형 시뮬레이션으로 처리한다.
- **API**: `server/routes/api.js`의 `/api/campaign/status/:wallet`, `/api/campaign/start`, `/api/campaign/choice`, `/api/campaign/progress`, `/api/campaign/complete`.
- **DB**: 192~204번 마이그레이션. 204는 방어적 `IF NOT EXISTS` 재보장 + `hidden_campaign_ch1~5` FK 시드.
- **보상 정책**: `complete()` 에서 평판 포함 모든 선택적 보상이 SAVEPOINT 안에서 실행된다. 스키마 누락이 있어도 챕터 완료 자체가 500으로 죽지 않는다.
- **세션 복구**: QUESTS 탭의 `CONTINUE`는 기존 `sessionId`를 이어서 씬 엔진 또는 시뮬레이션으로 복구한다.

### MCC Route Implemented Chapters
- `mcc_campaign_ch1`: 산소 쟁탈 / Dust Storm / 산소 회수율.
- `mcc_campaign_ch2`: 동결된 고속도로 / night_freezing / 시설 HP, 민간인 피해, FSP 증원.
- `mcc_campaign_ch3`: 이사회 / phobos_eclipse_periodic / Helion·Verin·Chromium 3분기.
- `mcc_campaign_ch4`: 해적 매수 / ion_storm_active / Kara Vex, 회담 호위, Helion 습격대.
- `mcc_campaign_ch5`: 케플러 분쟁 / low gravity + oxygen pressure / Roth 데이터, Kepler 서버, CV 자급 모선.
- `mcc_campaign_ch6`: 내부고발자 / solar radiation storm / Li Fang 선택, A·B·C 루트 확정.
- `mcc_campaign_ch7`: 시장 전쟁 / dust storm season peak / Ch6 루트별 Market War 변형.
- `mcc_campaign_ch8`: 프로메테우스 / 4-phase environmental sequence / Prometheus 방어·파괴·조기 엔딩.
- `mcc_campaign_ch9`: 깨진 동맹 / 4전장 병렬 시뮬레이션 / Pilgrim Arms 공개와 NPC 운명.
- `mcc_campaign_ch10`: 주주 엔딩 / cinematic-only / 4 엔딩 + fallback, NG+ cross-route modifier.

### FSP Route Implemented Chapters
- `fsp_campaign_ch1`: 방파제 / dust storm recovery + night freezing / H2O 호송, 응급 환자, 차 두 잔 의식.
- `fsp_campaign_ch2`: 얼음 캐러밴 / solar exposure + Phobos eclipse / 6대 얼음 운반선, Lena 개인 서사, Sal Cruz 매복.
- `fsp_campaign_ch3`: 피의 광산 / high altitude thin air / Verin-7 산소 노예제, 412명 광부 해방, 60명 잔류 결정.
- `fsp_campaign_ch4`: 외교 / subterranean dust + equatorial Phobos pattern / Cinder Grace 비밀 회담, Amara 보호, MCC 정찰 회피, CV 동맹 강도 분기.
- `fsp_campaign_ch5`: Kepler 공유지 / low gravity crater + oxygen supply critical / Liang Wei, Roth dead drop, 3파벌 회담, Commons·중재·압박·전투·공개 5분기.
- `fsp_campaign_ch6`: 두더지 / settlement interior + time pressure attack / Kenji Tanaka 색출, Sarah/Diego red herring, 처형·이중첩자·추방 영구 분기.
- `fsp_campaign_ch7`: 의회 / assembly_session + dynamic_crisis / 영구 의장 선출, 외부인 의장 출마, 외곽 위기 병행, Ch10 엔딩 alignment seed.
- `fsp_campaign_ch8`: 가이아 / civilian_donation_drive + shipyard_wave_defense / 시민 기부, Gaia 건조, MCC/CV/Pilgrim Arms wave 방어, Gaia 함장·Pilgrim Arms seed.
- `fsp_campaign_ch9`: 세 개의 깃발 / neutral_summit + pilgrim_arms_assault / MCC·FSP·CV 정상회담, 보호 대상 선택, Pilgrim Arms 공개 등장, 엔딩 강제 분기.
- `fsp_campaign_ch10`: 자유의 대가 / ending_evaluation_and_cinematic / Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 최종 보상.

### Adding New Chapter Workflow
1. `campaign_chapters` seed 또는 `CHAPTERS` 정의에 새 `questId`를 추가한다.
2. `simulate*()`와 `calculateRewards()`를 챕터별로 분기한다.
3. 시작 조건, choice id, reward id는 서버에서만 검증한다.
4. UI는 `status` 응답의 chapter list를 렌더하므로, 가능하면 API payload 호환성을 유지한다.
5. 커밋/푸시 전 `CHANGELOG.md`와 `AUDIT_FINDINGS.md`를 함께 갱신한다.

### Branch Modifier System
- `player_lore_flags`: 한 번 켜지는 서사 플래그.
- `player_tags`: 플레이어 성향/업적 태그.
- `chapter_branch_modifiers`: 특정 향후 챕터에만 영향을 주는 modifier.
- 실패 분기 예: `cold_death` → `cold_sister_frozen`, `mcc_ch6/chen_distrust_increased`.
- Ch6 루트 분기: `mcc_route_a_active`(Li Fang 지원), `mcc_route_b_active`(Chen 보고), `mcc_route_c_active`(자료 복사). Ch7~9는 서버에서 해당 루트 선택지만 허용한다.
- Ch10 엔딩 자격은 `calculateEligibleEndings()`가 서버에서 계산한다. Branch A/Chen 사망은 Ending 3, Branch B는 Ending 1(+조건부 Ending 2), Branch C는 Ending 1/2/4 조건부.

### Battle Resolution Modes
- `server_simulation`: 현재 Ch1 MVP. 서버 seed로 결과를 계산하고 보상을 지급한다.
- `full_engine`: Phase 2 예정. v11.1 전투 엔진 환경 modifier, Helion 함선/화물선 보존 목표, 실시간 진행 UI를 연결한다.

### Reputation / Tags / Lore Flags Distinction
- `player_reputation`: MCC/FSP/CV/Pilgrim Arms 수치 평판. 변경 시 -100~100으로 clamp하고 `reputation_history`에 남긴다.
- `player_tags`: 플레이어 속성/칭호/불명예 상태. 예: `cold_death`, `efficient_operator`, `war_criminal`.
- `player_lore_flags`: 플레이어별 서사 사건 발생 기록. 예: `cold_sister_frozen`, `lifang_personal_arc_unlocked`.
- `chapter_branch_modifiers`/`player_branch_modifiers`: 특정 향후 챕터에 적용되는 분기 효과. 현재는 단순 조회/적용, 복잡 조건 evaluator는 P2.

### Campaign API Map
- `/api/campaign/status/:wallet`: 챕터, active session, reputation, tags, branch, inbox 조회.
- `/api/campaign/start|choice|progress|complete|abandon`: 챕터 플레이 lifecycle.
- `/api/reputation/:wallet`: 평판 조회. `/api/reputation/delta`는 internal-only.
- `/api/tags/:wallet`, `/api/tags/set-active-title`: 플레이어 조회/칭호 설정. `/api/tags/grant|revoke`는 internal-only.
- `/api/lore/flags/:wallet`, `/api/lore/flag/check`: lore 조회. `/api/lore/flag/set`은 internal-only.
- `/api/branch/active/:wallet/:targetChapter`: 활성 branch 조회. `/api/branch/set`은 internal-only.

### Environment System Phases
- 정적 정의는 `environment_definitions`, 챕터별 curve는 `chapter_environment_configs`에 seed한다.
- 런타임 helper는 `server/services/campaign.js#getEnvironmentState()`에 있다.
- Ch1은 `dust_storm_incoming` 4단계: 0s/280s/560s/750s. `railgun`은 accuracy penalty 면역.

---

## 6. 코딩 패턴 — 반드시 준수

### ① 설정값 조회 (하드코딩 금지)
```javascript
// db.js에서 export된 getSetting 사용
const { getSetting } = require('../db');  // services에서
// 또는 로컬 함수로:
async function getSetting(key, fallback = null) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch (_) { return fallback; }
}
// 사용 예:
const enabled = await getSetting('fleet_combat_enabled', 'false');
const maxFleets = parseInt(await getSetting('max_fleets_per_player', '5')) || 5;
```

### ② 트랜잭션 패턴
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... DB 작업 ...
  await client.query('COMMIT');
  return { success: true, ... };
} catch (err) {
  await client.query('ROLLBACK');
  console.error('[SERVICE_NAME] funcName error:', err.message);
  return { success: false, error: 'internal_error' };
} finally {
  client.release();  // 반드시 release
}
```

### ③ GP 활동 로그 (fire-and-forget)
```javascript
// COMMIT 후 실행 — 실패해도 메인 로직 영향 없음
try {
  const { logGPActivity } = require('../db');
  logGPActivity(wallet, -gpCost, 'action_type', '설명').catch(() => {});
} catch (_) {}
```

### ④ 시즌 점수 업데이트 (fire-and-forget)
```javascript
try {
  const seasonSvc = require('./season');
  seasonSvc.addSeasonScore(wallet, 'gp_spend', gpCost).catch(() => {});
  seasonSvc.addSeasonScore(wallet, 'fleet_action', 1).catch(() => {});
} catch (_) {}
```

### ⑤ 어드민 인증
```javascript
function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}
```

### ⑥ wallet 추출 (라우트 공통)
```javascript
function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) { res.status(400).json({ error: 'wallet_required' }); return null; }
  return w;
}
```

### ⑦ settings INSERT (SQL 파일)
```sql
-- settings PK는 key 단독 — (category, key) 복합 아님
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'some_key', 'true', '설명')
ON CONFLICT (key) DO NOTHING;  -- ← 반드시 (key)만 사용

-- value 컬럼은 JSONB:
-- 문자열: '"text_value"'  (쌍따옴표 포함)
-- 숫자:   '42'            (따옴표로 감싸도 jsonb가 파싱)
-- 불린:   'true'/'false'
-- 1.0.0 같은 버전 문자열: '"1.0.0"'  ← jsonb는 점(.)이 있으면 에러
```

### ⑧ 마이그레이션 등록 (psql 직접 실행 시)
```bash
# psql로 직접 실행하면 schema_migrations에 자동 등록 안 됨
# 수동으로 등록 필요:
psql $DATABASE_URL -c "INSERT INTO schema_migrations (filename) VALUES ('096_xxx.sql') ON CONFLICT DO NOTHING;"
```

---

## 6. 인증 시스템

- **방식**: JWT (email + bcrypt password)
- **토큰**: `Authorization: Bearer <token>` 헤더
- **wallet**: 모든 게임 행동의 PK — `x-wallet` 헤더 또는 body.wallet
- **WebSocket**: 미구현 (REST + polling 방식)

---

## 7. 라우트 등록 방식 (server/index.js)

모든 API 라우트는 `/api` prefix:
```javascript
// server/index.js
const fleetRoutes = require('./routes/fleets');
app.use('/api', fleetRoutes);
```

어드민 라우트:
```javascript
app.use('/admin/api', adminRoutes);  // 단일 파일 admin.js로 통합
```

---

## 8. 현재 개발 상태 & 다음 작업

### ✅ 완료된 것 (2026-04-28 기준)
- Migration 001~168 전부 DB 적용 완료
- Fleet Combat 전체 스택 활성화 (`fleet_combat_enabled = true` — DB 확인 완료)
- 파벌 시드 데이터 (mcc/fsp/cv), 함선 22종, 광물 tier 0~3 (13종)
- VIP 시스템 (migration 162)
- **함대전 손실 (⚠️ v7.354 갱신 — EVE식 full-loss)** — 라이브 플래그 `hijack_ship_loss_enabled=true`, `siege_full_loss_enabled=true`라 **하이잭/공성 모두 격침 함선 영구 소멸**(is_alive=false). 일반전(AI/토너먼트)도 영구 파괴. 생존함은 감소된 HP로 남아 조선소 수리 연계. (`commander_full_loss_enabled=false`만 예외 — 커맨더 공성은 손실 면제.) 과거 "HP 보존" 서술은 폐기됨.
- **전투 무한전** — MAX_TICKS=54000 (실질 무제한), 타임아웃 결과=draw (HP비율 승자 제거)
- **WS 스트리밍 8x** — battleScheduler.js `tickMs/8`
- **후퇴 (forfeit)** — `POST /api/battles/:id/forfeit` 신규 endpoint
- **전투 뷰어 fixes** — HP바 실시간 감소, 내 함대/적 함대 올바른 구분, "나" 배지
- **속도 조절 버튼** — tactical-lab SPEED 패널 (×1/×2/×4/×8, WS 없는 로컬 시뮬 전용)
- **브라우저 네이티브 다이얼로그 제거** — confirm() 전면 인게임 모달로 교체 (§18 참조)
- **핵심 플레이 라인 검수 v5.12** — 함선 건조/수리 재료 차감, 자원 제작, 고급 강화 재료, 하이잭 Phase 1/영토 HIJACK 버튼 연결 수정 (※ 당시의 "HP 보존"은 v7.354에서 full-loss로 대체됨 — 위 항목 참조)
- 내 영토 금색 하이라이트 (compositeClaimsOnTexture)
- 하이젝 auto_win 후 영토 즉시 금색 반영 (Railway 레이턴시 우회)

### ✅ v5.31 (2026-04-29) 완료

1. ✅ **타이탄/배틀십 Core/Mid 전용 재료**: Migration 163 시드 + Migration 203 강화. BS/Titan 6/6 모두 Core 전용(`exotic_alloy`/`dark_matter`/`quantum_core`)과 Mid 전용(`titanium_alloy`/`plasma_crystal`/`nano_polymer`) 광물을 둘 다 포함하도록 invariant assertion으로 보장. fsp_titan에 nano_polymer 추가, 모든 BS의 exotic_alloy 최소치 3 통일. admin settings 5종 시드.
2. ✅ **DB 스모크 테스트**: `server/tools/smoke_capital_recipes.js` (11/11 pass). `ship.startBuild` (mcc_bs/mcc_titan recipe 차감 검증), `resourceCraft.startCraft` (hull_plate/plasma_coil), `hijack` 서비스 export·`hijack_battles` 스키마, Migration 203 invariant 직접 검증.
3. ✅ **Phase C 죽은 하이잭 모달 정리**: `index.html`의 `hijackModal` HTML(31줄) + `openHijackModal/closeHijack/confirmHijack` 함수 삭제 (도달 불가능 dead code). `/api/hijack/declare` 410 응답 메시지에 alternatives(territory/AI duel/tournament) 명시. `phaseC.js`+`services/hijack.js` 라우트 정리 주석 동기화.

### 🔴 다음 작업

(현재 비어 있음 — 다음 우선순위 작업이 정해지면 여기에 추가)

---

## 9. 주요 기존 서비스 파일 역할 요약

| 파일 | 역할 |
|------|------|
| `services/season.js` | 시즌 점수 추적 — addSeasonScore(wallet, category, amount) |
| `services/battle.js` | 구버전 픽셀 전투 (Migration 026기반) — fleet battle과 다름 |
| `services/siege.js` | 섹터 거버너 공성전 (Migration 085) |
| `services/ship.js` | 구버전 단순 함선 건조 (archived migrations 기반) — fleet ship과 다름 |
| `services/gpBurn.js` | GP 소각 메커니즘 |
| `services/guild.js` | 길드 시스템 |
| `services/marketplace.js` | 아이템 마켓플레이스 |
| `services/enhancement.js` | 아이템 강화 시스템 |
| `services/achievement.js` | 업적 시스템 |
| `services/daily.js` | 일일 미션 |
| `services/lottery.js` | 복권 시스템 |
| `services/profile.js` | 유저 프로필 (motto, avatar) |
| `services/tdesc.js` | 영토 설명 (GP 비용) |
| `services/capsule.js` | 타임캡슐 (GP 비용) |
| `services/sponsor.js` | 영토 스폰서 (GP 비용) |

---

## 10. index.html 구조 (35k줄 단일 파일)

> ⚠️ **절대 파일 분리 시도 금지** — 너무 복잡하게 얽혀있어 깨질 위험이 높음
> 섹션 검색: `Ctrl+F` 또는 grep으로 아래 키워드 찾기

| 섹션 | 찾는 방법 |
|------|-----------|
| CSS 변수 / 테마 | `:root{` |
| 전역 컴포넌트 CSS | `/* BASE MODAL` 또는 `/* TERRITORY` |
| HTML 구조 시작 | `<body>` |
| 지구본 초기화 | `initGlobe(` |
| BASE 모달 탭들 | `baseTabTerritory\|baseTabQuests\|baseTabShop` |
| 영토 정보 패널 | `showTerritoryInfo(` |
| GP 관련 함수 | `loadGPBalance\|refreshGP` |
| i18n 번역 | `const i18n = {` (EN/KO/JA/ZH) |
| 인게임 확인 모달 | `id="gameConfirm"` (HTML) / `function gameConfirm(` (JS, ~line 26442) |
| 인게임 입력 모달 | `id="gameInput"` (HTML) / `function gameInput(` (JS, ~line 26481) |
| 쇼핑 확인 모달 | `id="shopConfirmModal"` — gameConfirm 이전 버전, 쇼핑 탭 한정 사용 |
| WebSocket 없음 | polling 방식 — `setInterval` + `fetch('/api/...')` |

---

## 11. 설정값 (fleet 카테고리) — settings 테이블

```
fleet_combat_enabled       = true   ← 2026-04-26 활성화 완료
max_fleets_per_player      = 5
max_ships_per_fleet        = 1000
max_ships_per_player       = 200
faction_change_cooldown_hours = 168
faction_change_fee_gp      = 500
flagship_required          = true
battle_max_concurrent      = 3
battle_tick_rate_ms        = 200
hijack_phase1_duration_seconds = 300
hijack_phase1_ships_max    = 20
ship_repair_enabled        = true
shield_enabled             = true
vip_enabled                = true
```

---

## 12. Git 상태 & 커밋 규칙

- **마이그레이션 적용 후 반드시 커밋 & 푸시**
- 커밋 메시지 형식: `Migration XXX: 기능명` 또는 `feat: 기능명`
- Branch: `main`

---

## 13. 알려진 이슈 (2026-04-28 최신 업데이트)

### ✅ 최근 수정됨 (migration 176~179, commits 62fb37f ~ 164d2ff)
- **로켓드롭 트리거 403** — `commander_wallet` 조회 위치 fix (`game_settings` → `commander` 테이블).
- **`game_settings` 테이블 부재** — migration 176으로 `settings`→`game_settings` 호환 VIEW.
- **`users.wallet` 컬럼 오타** — 18개 GP 서비스가 `WHERE wallet=$1` 사용. 모두 `wallet_address`로 일괄 수정.
- **GP 감사 로그 부재** — migration 177로 `gp_transactions` + `gp_activity_log` + `colony_prestige` + `prestige_log` 생성. 30+ 서비스의 silent 실패 복구.
- **NPC 스타터팩 일괄 지급 UI 없음** — admin.html에 버튼 추가.
- **admin.js JSONB UPDATE 일괄 fix** — 25곳 `::jsonb` 캐스트 + 38곳 `JSON.stringify(value)`.
- **dead 서비스 4개 정리** — weeklyChallenges, gpBurn, bounty, luckyBox (테이블 + UI 둘 다 없음). service + route + scheduler 일괄 삭제.
- **phantom 인벤토리 참조 정정** — auction(`user_resources`→`user_resource_inventory`+`resources` JOIN), worldEvents(`user_minerals`→`user_resource_inventory`), tombstone(`hijack_log`→`hijack_battles`).
- **Migration 178: phantom 테이블 30개 일괄 생성** — branding, tdesc, monuments, expedition, contest, tiers, staking, spells, polls, capsule, wager, tevt, status, sponsor, shield, raffle, donation, crafting, broadcasts, beacon (총 20 라이브 기능 복구).
- **`gp_balances` → `users.gp_balance` 패치** — 6개 서비스 (branding, contest, expedition, spells, crafting, broadcasts).
- **Migration 179: 잔여 phantom 테이블** — lottery_rounds/tickets, gp_dividend_pool/claims, planet_news (3 라이브 기능 복구).

→ **2026-04-25 시점, 코드베이스에 알려진 phantom 테이블 참조는 모두 해소됨.**

### ✅ 해소 완료 (심화 작업 완료)
- **battle.js fragmentation 제거** — UI + 라우트 + 서비스 + 스케줄러 일괄 삭제. PVP는 fleet_battles + Hijack로 통합.
- **betting v1 → warBetting v2 통합** — 단일 시스템 (호환 endpoint 추가됨).
- **achievements auto-trigger 와이어링** — claim/battle/marketplace/ship/guild/signup 이벤트마다 자동 unlock.
- **38개 카테고리 settings 시드** — admin이 모든 라이브 기능 조정 가능 (No Hardcoding 100%).
- **레이어드 아키텍처 명확화** — chronicle/title/enhancement는 의도된 base+extension 구조.
- **v5.12 핵심 루프 단절 수정** — 영토 정보 HIJACK 버튼을 `/api/hijack/declare-with-pp` 플로우로 연결, hijack phase1 소형함 필터와 HP 반영 수정, resource_id 기반 인벤토리 일관화.

### 🔴 남아있는 알려진 이슈

#### A. 라우트 명명 혼동 (양쪽 실사용 — 그대로 유지, 문서화)
| 페어 | 책임 |
|---|---|
| `routes/job.js` vs `routes/jobs.js` | job=user 직업 ops + admin / jobs=catalog + select |
| `routes/resource.js` vs `routes/resources.js` | resource=admin + rate / resources=user catalog |
| `routes/auction.js` vs `routes/auctionRoutes.js` | auction=거래 ops (declare/bid) / auctionRoutes=목록 (`/api/auctions`) |
| `services/tournament.js` vs `services/tournaments.js` | tournament=fleet 토너먼트 (phaseC) / tournaments=단순 GP entry-fee |

#### B. 의도된 레이어드 아키텍처 (병합 불필요)
모두 base + extension 패턴:
| 페어 | 역할 |
|---|---|
| `services/chronicle.js` + `chronicleEnhanced.js` | base 이벤트 + Discord/특수 이벤트 wrapper |
| `services/title.js` + `titleExtended.js` | 기본 13종 타이틀 + 확장 11종 |
| `services/enhancement.js` + `enhancementAdvanced.js` | 인스턴싱 ops + 레시피 보너스 |

#### C. 기타 메모
1. `server/routes/ships.js` — **신** fleet 시스템. `/api/ships/blueprints`, `/api/ships/my`, `/api/ships/build` 정상 동작. 폐기 대상 아님.
2. `server/migrations/archived/` — 89~139번 구버전. 건드리지 말 것.
3. settings.value는 JSONB — 문자열은 `'"text"'`, 점 포함 버전은 `'"1.0.0"'`으로 감싸야 함.
4. 로컬 테스트 유저: `0xlainworld000000000000000000000000000000`.
5. `idx_users_referred_by` 인덱스 존재 — referral COUNT(*) 쿼리 최적화됨.
6. 새 fleet UI 진입점: `openShipyard()` (조선소), `openFleetCmd()` (함대 관리).
7. **함대전 시스템 동작 흐름**: hijack 선언 → fleet_battles 생성 → battleScheduler.runBattle() → battleEngine 시뮬 → WS 8x 스트리밍 → applyBattleResults (감소 HP 영속 기록 + 격침함 is_alive=false 영구 소멸 — full-loss 플래그 ON) → battleRewards. (예외: commander_full_loss_enabled=false.)
8. **forfeit endpoint**: `POST /api/battles/:id/forfeit` — 공격자(atk)만 가능. preparing이면 즉시 취소(winner=def), 이미 ended면 OK 반환. HP는 applyBattleResults에서 이미 적용됨.
9. **네이티브 다이얼로그**: 전면 제거 완료 (2026-04-28). confirm/prompt/alert 0곳. §18 참조.

#### D. 2026-04-28 신규 추가 (resolve됨)
- **브라우저 confirm() 전면 제거** — `index.html` 15곳 `gameConfirm()`, `admin.html` 70곳 `adminConfirm()`, tactical-lab `#forfeit-overlay`로 교체.
- **HP바 실시간 감소 안 됨** — WS frame에 `maxHp`+`side` 추가, 첫 프레임에서 atkMaxHP/defMaxHP 재보정 (`_wsMaxHpCalibrated`).
- **내 함대/적 함대 혼동** — `loadBvSidePanels` participants 배열 기반 wallet 비교로 수정.
- **전투 타임아웃 HP 비율 승자** — MAX_TICKS=54000, 타임아웃=draw로 변경.

---

## 14. 서비스 카탈로그 (현재 상태)

### 🟢 동작 확인된 핵심 시스템 (수정 우선순위 ↑)
| 서비스 | 라우트 | 비고 |
|---|---|---|
| `hijack.js` | `routes/api.js` (`/api/hijack/*`) | 최근 다수 fix (commits 8d2148b, c2d35c8, 240ae43). 정상. |
| `fleet.js` | `routes/fleets.js` | fleet_combat_enabled 게이트. 함선 22종 정의됨. |
| `siege.js` | `routes/siege.js` | 섹터 거버너 공성전 |
| `governance.js` | `routes/governance.js` | 커맨더/거버너/세금 (`commander` 테이블 사용) |
| `season.js` | (서비스 직접 호출) | 시즌 점수 — `addSeasonScore()` 모든 서비스에서 fire-and-forget |
| `weather.js` | `routes/weatherRoutes.js` | migration 174로 strategic columns 추가됨 |
| `guild.js` | `routes/api.js` | commit 6bbc166으로 레벨업 + 수송 동작 복구 |
| `transport.js` | `routes/transport.js` | 수송 시스템 |
| `daily.js` | `routes/api.js` | 일일 미션 — settings에 daily_mission_* 키 |
| `marketplace.js` | `routes/marketplace.js` | 아이템 마켓 |
| `enhancement.js` | `routes/api.js` | 아이템 강화 |
| `auction.js` | `routes/auctionRoutes.js` | ✅ user_resources → user_resource_inventory + resources JOIN (commit 601757a) |
| `rocket.js` | `routes/api.js` (`/api/rockets/*`) | 트리거 fix됨 (commit 62fb37f). 12h 자동 스케줄. |
| `vip.js` | `routes/vip.js` | migration 162 |
| `tprestige.js` | `routes/api.js` | territory_prestige 테이블 OK. wallet 컬럼 fix됨. |
| `prestige.js` | `routes/api.js` | colony_prestige 테이블 추가됨 (migration 177). wallet 컬럼 fix됨. |
| `siegeFleetBridge.js` | (스케줄러) | siege와 fleet 연계 |
| `aiFleetManager.js` | (NPC 함대 관리) | commit a84e7dc로 SAVEPOINT 추가됨 |

### 🟡 부분 동작 (정리 필요)
| 서비스 | 상태 |
|---|---|
| `worldEvents.js` | ✅ user_minerals → user_resource_inventory 정정 (commit 601757a) |
| `battle.js` | 구버전 픽셀 전투. battle_ships phantom 참조 — fleet battle 활성화 후 정리 |
| `ship.js` | 구버전 단순 함선. 새 fleet ship과 충돌 가능 |
| `tournament.js` vs `tournaments.js` | 두 파일 공존. tournaments.js는 phantom (`tournament_entries`) — 정리 필요 |

### 🔴 잔여 phantom (소수, §13.A 참조)
§13.A 표 참조. 모두 둘 중 하나로 처리 필요:
- (a) 누락 테이블 마이그레이션 추가 → 기능 활성화
- (b) 서비스 파일 + 라우트 마운트 + 스케줄러 등록 일괄 삭제 → 코드베이스 정리

### 🔵 로깅/감사
- `gp_activity_log` (db.js의 logGPActivity) — migration 177로 생성됨
- `gp_transactions` (서비스 직접 INSERT) — migration 177로 생성됨, 컬럼명 양쪽 호환
- 같은 GP 활동을 두 테이블에 중복 기록함. 정리 필요(향후).

---

## 15. 라우트 카탈로그 (61개)

`server/index.js`에서 mount되는 prefix는 모두 `/api`(단일 파일 admin.js만 `/admin/api`).

```
api.js              ← 메인 통합 라우트 (가장 큰 파일, 다수 도메인)
admin.js            ← 어드민 패널 (단일 파일, 5000줄+)
adminEconomyRoutes  ← 경제 밸런스 어드민 (migration 173 추가)
auth.js             ← JWT 로그인/회원가입
fleets/fleetBattles/fleetSearch  ← Fleet Combat
factions/factionRoutes ← 파벌
governance/commanderActions  ← 거버너/커맨더
sectors             ← 섹터 정보
hallOfFameRoutes    ← 명예의 전당
weatherRoutes       ← 날씨/재해
warBettingRoutes    ← 전쟁 베팅
publicRoutes/public ← 비-로그인 통계
territoryRoutes     ← 영토 (claim과 별개)
onboarding/onboardingRoutes ← 온보딩
phaseC/phaseD       ← 길드전 페이즈
... (총 61개)
```

⚠ **공존하는 동명/유사 라우트 정리 필요**: `auction.js` vs `auctionRoutes.js`, `factions.js` vs `factionRoutes.js`, `public.js` vs `publicRoutes.js`, `onboarding.js` vs `onboardingRoutes.js`, `territoryRoutes.js` vs api.js의 territory 핸들러.

---

## 16. 마이그레이션 누적 인덱스 (001~203)

| 범위 | 주제 |
|---|---|
| 001~050 | 초기 스키마 (users, claims, pixels, settings, GP/PP) |
| 051~080 | 게임 시스템 (battle, sector, governance, weather, hijack) |
| 081~110 | 어드민/통계/시즌/cosmetic |
| 111~140 | (대부분 archived) — 폐기된 미니게임/실험 |
| 141~160 | Fleet Combat 기반 (factions, ship_types, fleets, ships) |
| 161~170 | VIP / 광물 tier / NPC / 트리거 fix |
| 171~177 | 최근 fix 패키지 (cantina, prestige, economy balance, weather strategic, hijack target_claim, game_settings view, phantom tables) |
| 178~191 | phantom 테이블 정리, settings 시드, achievements/profile/governance/rank/rocket/poi/AI strategy/hijack target nullable |
| 192~202 | Campaign chapters (MCC Ch1~10, FSP Ch1~10, Prologue+CV seed), 인게임 버그 리포트 |
| 203 | Capital ship Core/Mid material gate (BS/Titan invariant + admin settings) |
| `archived/` | 89~139번 구버전 — **건드리지 말 것** |

새 마이그레이션 작성 규칙:
1. 파일명: `NNN_short_name.sql` (NNN = 204부터 시작)
2. `INSERT INTO schema_migrations (filename) VALUES (...) ON CONFLICT DO NOTHING;` 마지막에 추가
3. settings INSERT는 `(key)`만 ON CONFLICT, `(category, key)` 복합 아님
4. JSONB value: 문자열은 `'"text"'`, 숫자는 `'42'`, 불린은 `'true'`/`'false'`, 점이 있는 버전은 `'"1.0.0"'`

---

## 17. Sub-agent 사용 원칙 (Advisor 패턴)

> **컨셉**: 메인 모델(작업자)이 직접 실행하고, 막히는 순간에만 더 큰 모델(어드바이저)에게 판단을 escalation. 큰 모델은 방향만 잡고, 작업은 메인이 한다.

### 메인이 직접 처리 (sub-agent 부르지 말 것)
- 단일 파일 편집 (Edit/Write)
- 명령 실행 (Bash 단발성: psql 쿼리, git status, npm run 등)
- 알려진 경로 파일 읽기 (Read with known path)
- 특정 심볼/문자열 grep
- 한 두 개 파일에 국한된 버그 픽스

### 반드시 sub-agent로 위임
| 상황 | Agent 타입 | 모델 |
|---|---|---|
| 3개 이상 파일에 걸친 설계 변경 | `Plan` | opus |
| 마이그레이션 순서·의존성 판단 | `Plan` | opus |
| "어떻게 할지 모르겠는" 디버깅 — 30초 이상 막힘 | `Plan` 또는 `general-purpose` | opus |
| 코드베이스 광범위 탐색 ("이 기능 어디 있어?") | `Explore` | (기본) |
| 모르는 라우트/서비스 동작 추적 | `Explore` (thoroughness: medium) | (기본) |
| 보안·아키텍처 second opinion 필요 | `general-purpose` | opus |
| 독립적인 병렬 작업 (서로 영향 X) | 단일 메시지에 여러 Agent 동시 호출 | (작업별) |

### 호출 규칙
1. **Plan/Advisor agent는 "방향만" 받는다** — 실제 코드 수정은 메인이 한다.
2. **Explore agent는 보고만 받는다** — 응답 길이 200~500단어로 제한 요청.
3. **prompt는 self-contained** — 대화 맥락 없이도 이해 가능하게 파일 경로·이슈·목표 명시.
4. **메인 모델은 Sonnet 유지** — Opus는 sub-agent로만 호출 (비용 효율).

### 안티패턴
- ❌ 단순 파일 1개 수정에 Plan agent 호출 (오버킬)
- ❌ Plan agent에게 "분석한 후 수정까지 해줘" 위임 (이해를 위임하지 말 것)
- ❌ Explore agent로 이미 경로 아는 파일 읽기 (Read 직접 쓰기)
- ❌ Sub-agent 결과를 그대로 사용자에게 전달 (메인이 검증·요약)

---

## 18. UI 모달 패턴 — 네이티브 다이얼로그 대체 규칙

> ⚠️ `confirm()` / `prompt()` / `alert()` 절대 사용 금지. 항상 아래 인게임 모달 사용.

### index.html — 사용 가능한 모달 함수

#### ① gameConfirm (확인/취소)
```javascript
// Promise 반환 — async 함수에서 await 필수
const ok = await gameConfirm({
  icon: '⚔',           // 이모지
  title: '전투 선언',   // 제목 (대문자 권장)
  body: '선언 후 전술 지시를 선택합니다.',  // HTML 가능
  confirmText: '선언',  // 확인 버튼 텍스트 (기본: CONFIRM)
  // info: [{k:'비용', v:'500 GP', insufficient: false}]  // 옵션: 비용 테이블
  // disabled: true  // 옵션: 확인 버튼 비활성
});
if (!ok) return;
```

#### ② gameInput (텍스트 입력, prompt 대체)
```javascript
const name = await gameInput({
  title: '함대 이름',
  label: '이름을 입력하세요',
  placeholder: '예: 1함대',
  defaultValue: '',     // 선택
  maxLength: 60,
});
if (name === null || name === undefined) return; // 취소
```

#### ③ shopConfirm (쇼핑 전용 — 신규 코드에서는 gameConfirm 사용)
```javascript
// 기존 쇼핑 탭에서만 사용. 신규 코드는 gameConfirm 사용할 것.
const ok = await shopConfirm(icon, title, msgHTML, btnText);
```

### admin.html — 사용 가능한 모달 함수

#### ① adminConfirm (확인/취소)
```javascript
// Promise 반환 — async 함수에서 await 필수
async function doSomething(id) {
  if (!await adminConfirm('Delete item #' + id + '?', 'DELETE')) return;
  // ... 실제 작업
}
// 두 번째 인자 title 생략 시 'CONFIRM'
```

> ✅ `admin.html` `prompt()` / `alert()` 전부 제거 완료 (2026-04-28). `adminInput()` + `showToast()` 구현됨.

### assets/tactical-lab-v11.html — 독립 iframe 전투 뷰어 모듈

메인 게임은 `buildTacticalLabUrl()`로만 tactical-lab URL을 만든다.
```javascript
// 실전 전투
buildTacticalLabUrl({ mode:'battle', battleId, wallet, startTick });

// 전술 실험
buildTacticalLabUrl({ mode:'sandbox' });
```

URL 계약:
```text
/assets/tactical-lab-v11.html?mode=battle&bid={battleId}&wallet={wallet}&lang={lang}&v={ASSET_VER}&t={Date.now()}
/assets/tactical-lab-v11.html?mode=sandbox&lang={lang}&v={ASSET_VER}&t={Date.now()}
```

tactical-lab은 iframe으로 실행되므로 부모의 `gameConfirm`에 접근 불가. 인라인 오버레이 방식 사용:
```javascript
// 오버레이 표시 (CSS id="forfeit-overlay")
function cmdForfeit() {
  document.getElementById('forfeit-overlay').classList.add('on');
}
function closeForfeitOverlay() {
  document.getElementById('forfeit-overlay').classList.remove('on');
}
async function confirmForfeit() {
  closeForfeitOverlay();
  // ... 실제 작업
}
// 새 확인 팝업 필요 시 동일 패턴으로 별도 오버레이 추가
```

부모(index.html)와 통신은 postMessage:
```javascript
notifyParent('forfeit', d, battleId);
// 부모에서: window.addEventListener('message', function(e) { if (e.data.cmd==='forfeit') ... })
```

---

---

## 19. 동적 렌더 버튼 패턴 — Inline onclick 금지

> ⚠️ **반복된 회귀 (v7.205, v7.211, v7.214)** — inline `onclick="someFn('+val+')"` 동적 string concat 은 escape 깨짐으로 클릭 무반응. **신규 코드는 금지**.

### ❌ 금지 패턴

```js
// 동적 값을 inline onclick 문자열에 concat — escape 깨짐 위험
listEl.innerHTML = rows.map(function(r){
  return '<button onclick="doFn(\''+r.id+'\',\''+r.name+'\')">Click</button>';
}).join('');
```

깨지는 조건:
- `r.name` 에 `'`, `"`, 한글, 특수문자, 또는 사용자 입력 텍스트
- escapeHtmlSafe / fcEsc 가 entity 변환 (`'` → `&#39;`) 후 JS 안에서 다시 decode 실패
- 결과: onclick attribute 자체가 syntax error → 핸들러 등록 안 됨 → 클릭 무반응

### ✅ 표준 패턴 — data-action + delegated listener

```js
// 1) 데이터 캐시
window._myRows = rows.slice();

// 2) 버튼은 data-action + data-idx 만
container.innerHTML = rows.map(function(r, idx){
  return '<button type="button" data-action="myAction" data-idx="'+idx+'">Click</button>';
}).join('');

// 3) 한 번만 등록되는 delegated listener
if (!container.dataset.delegated) {
  container.dataset.delegated = '1';
  container.addEventListener('click', function(ev){
    var btn = ev.target.closest('button[data-action="myAction"]');
    if (!btn) return;
    ev.stopPropagation();
    var idx = parseInt(btn.getAttribute('data-idx'), 10);
    var row = (window._myRows || [])[idx];
    if (!row) return;
    console.log('[BTN] myAction triggered', row.id);
    // 처리 중 가드 (중복 클릭 race)
    if (btn.disabled) return;
    btn.disabled = true;
    var prev = btn.textContent; btn.textContent = '...';
    Promise.resolve(doFn(row.id, row.name)).finally(function(){
      try { if (btn) { btn.disabled = false; btn.textContent = prev; } } catch(_){}
    });
  });
}
```

### Checklist (신규 버튼 만들 때)

- [ ] inline `onclick="someFn(...)"` 사용 안 함
- [ ] data-action + data-* 속성으로 메타 전달
- [ ] 부모 컨테이너에 delegated listener 한 번만 등록 (`dataset.delegated` 가드)
- [ ] listener 안 `console.log('[BTN] xxx triggered', ...)` 진입 로그
- [ ] `event.stopPropagation()` (모달 안 버튼이라면)
- [ ] async 액션은 in-flight 가드 (btn.disabled + busy + textContent 변경)
- [ ] 비용/조건 미충족 시 버튼 자체 disabled (클릭 후 confirm 모달에서 거부 X)

### pre-commit hook (제안 — 별도 작업)

```bash
# index.html 안에 'innerHTML' + 'onclick=' 같은 라인 → 회귀 신호
grep -nE 'innerHTML.*onclick=' index.html && {
  echo "[v7.214 규칙] 동적 onclick concat 감지. data-action + delegated 패턴 사용."
  exit 1
}
```

### 이미 fix 완료된 사례 (회귀 방지 reference)

| 버전 | 위치 | 증상 |
|---|---|---|
| v7.205 | 영토 업그레이드 버튼 | 클릭 무반응 |
| v7.211 | 캠페인 프로필 칭호 장착 | 클릭 무반응 |
| v7.213 | + 중복 클릭 race 가드 | GP 이중 차감 위험 |
| v7.214 | shipyard/alliance/AI fight/replay/tdesc 일괄 마이그 | 잠재 무반응 |

---

*이 문서는 새 Claude Code 세션이 컨텍스트 없이도 즉시 작업을 이어갈 수 있도록 작성됐습니다.*
*상세 히스토리가 필요하면 git log 또는 server/migrations/ 파일 순서를 참고하세요.*
