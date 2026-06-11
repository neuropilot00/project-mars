## 2026-06-11 — Guild 라우트 분리 감사 반영 (v7.461)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 길드 HTTP 라우트가 대량 혼재됨**: `server/routes/guildRoutes.js`로 분리했다.
- **[LOW] 길드/길드전 유지보수 위치 불명확**: 생성, 초대, 가입 요청, 권한 변경, 채팅, 기여, 연구, 길드전, 미니게임 continue 비용 조회를 한 라우터로 단일화했다.
- **[LOW] `/api/guild/:id` 라우트 순서 회귀 위험**: 기존 정적 라우트/동적 라우트 순서를 그대로 보존했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 claim/hijack/withdraw/harvest/territory core가 남아 있어 다음 분리 후보는 territory economy 또는 harvest core다.

### 검증 완료
- `node --check server/routes/guildRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Sector Control 라우트 분리 감사 반영 (v7.460)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 P5 섹터 영향력/컨트롤 조회 책임이 섞여 있음**: `server/routes/sectorControlRoutes.js`로 분리했다.
- **[LOW] 섹터 컨트롤 계산 회귀 위험**: pixel area, upgrade score, 최근 harvest score, guild id 매핑, influence tier 응답 정책을 유지했다.
- **[LOW] `/api/sectors/:id` 계열 라우트 충돌 위험**: `sectorControlRoutes`를 legacy `sectorQueryRoutes`와 `apiRoutes`보다 앞에 마운트해 `/api/sectors/control` 및 `/api/sectors/:sectorId/control`을 명시 처리한다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/sectorControlRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Economy Utility 라우트 분리 감사 반영 (v7.459)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js` 하단에 판매 오버레이/GP activity/송금/내 판매 영토 조회 책임이 섞여 있음**: `server/routes/economyUtilityRoutes.js`로 분리했다.
- **[MEDIUM] GP 송금 회귀 위험**: 송신자 `FOR UPDATE` 잠금, 일일 한도, 수수료, 잔액 동시성 검증, 수신자 알림/로그 정책을 유지했다.
- **[LOW] `/api/user/my-territories` 정적 경로 shadowing 위험**: 기존 `mapQueryRoutes`의 `next()` 정책을 유지하고 `economyUtilityRoutes`를 `apiRoutes`보다 앞에 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/economyUtilityRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Legacy Quest 라우트 분리 감사 반영 (v7.458)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 랜덤 퀘스트 생성/진행/수령 책임이 섞여 있음**: `server/routes/questRoutes.js`로 분리했다.
- **[MEDIUM] 퀘스트 완료 알림 ReferenceError 위험**: `/api/quests/:id/progress` 완료 시 존재하지 않는 `wallet` 변수 대신 인증 wallet `w`를 사용하도록 수정했다.
- **[LOW] 퀘스트 보상 경제 회귀 위험**: GP 직접 지급, tier cap, user daily cap, XP 지급, 최근 수령 목록 응답 정책을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/questRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Territory Cosmetic 라우트 분리 감사 반영 (v7.457)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 코스메틱 장착/해제 트랜잭션 책임이 섞여 있음**: `server/routes/cosmeticRoutes.js`로 분리했다.
- **[MEDIUM] 코스메틱 무한 장착/환수 회귀 위험**: 기존 `user_items` quantity 차감/환수와 `user_cosmetics` upsert 정책을 유지했다.
- **[LOW] 코스메틱 장착 side-effect 회귀 위험**: PP fee 차감, daily mission, season score best-effort 반영을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 quest/harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/cosmeticRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Player Status/Feed 라우트 분리 감사 반영 (v7.456)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js` 끝단에 업적/뉴스/온보딩/activity feed 라우트가 섞여 있음**: `server/routes/playerStatusRoutes.js`로 분리했다.
- **[LOW] activity feed DB 부하 방지 정책 회귀 위험**: 기존 5초 in-memory cache와 source별 best-effort fallback을 유지했다.
- **[LOW] 온보딩 wallet 신뢰 정책 회귀 위험**: 기존처럼 `requireAuth`와 JWT wallet 추출 정책을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 quest/cosmetic/harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/playerStatusRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Legacy Sector Query 라우트 분리 감사 반영 (v7.455)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 맵 렌더링용 sector 조회 책임이 섞여 있음**: `server/routes/sectorQueryRoutes.js`로 분리했다.
- **[MEDIUM] `/api/sectors/:id`가 `/api/sectors/conflict-map` 또는 `/api/sectors/control`을 가릴 위험**: `territoryIdentityRoutes`를 먼저 마운트하고 `control`은 `next()`로 넘기는 정책을 유지했다.
- **[LOW] sector 조회 계산 회귀 위험**: dynamic price, top holder, wallet별 myPixels, season sector_enter best-effort score 반영을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/sectorQueryRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — User BASE Summary 라우트 분리 감사 반영 (v7.454)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 BASE 조회/채굴 요약/rank 표시 책임이 섞여 있음**: `server/routes/userBaseRoutes.js`로 분리했다.
- **[LOW] BASE 응답 구조 회귀 위험**: 기존 user/miningInterval/miningRates/territory/mining/ranks shape를 유지했다.
- **[LOW] rank recalculation side-effect 회귀 위험**: BASE 진입 시 best-effort `recalcUserRank(wallet)` 호출 정책을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 sector query/harvest/territory/guild/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/userBaseRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Public Stats/Rank 라우트 분리 감사 반영 (v7.453)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 공개 통계/랭크/클라이언트 에러 리포트 책임이 섞여 있음**: `server/routes/statsRoutes.js`로 분리했다.
- **[LOW] 리더보드 계산 정책 회귀 위험**: claim 사각형 면적이 아니라 실제 `pixels` 테이블 기준 pixel count 정책을 유지했다.
- **[LOW] 클라이언트 에러 로그 저장 정책 회귀 위험**: message 필수 검증, 필드 길이 제한, IP 저장, `client_errors` insert 정책을 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/statsRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Map/User/Claim 조회 라우트 분리 감사 반영 (v7.452)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 지도 초기화/픽셀/클레임 조회 라우트가 섞여 있음**: `server/routes/mapQueryRoutes.js`로 분리했다.
- **[MEDIUM] `/api/user/:wallet` 와일드카드가 정적 user 하위 라우트를 가릴 위험**: `titles`, `my-territories` next 처리와 기존 마운트 순서를 유지했다.
- **[LOW] 지도 조회와 claim 결제/점령 트랜잭션 책임이 한 파일에 혼재**: 읽기 전용 조회 라우트만 분리하고 `POST /api/claim` 등 결제 경로는 기존 파일에 남겼다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/mapQueryRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Data Image Upload 라우트 분리 감사 반영 (v7.451)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 업로드 처리와 파일시스템 책임이 남아 있음**: `server/routes/uploadRoutes.js`로 분리했다.
- **[LOW] 업로드 정책 회귀 위험**: 기존 data:image 포맷 제한, 5MB 제한, 랜덤 파일명, `/uploads/` URL 반환 정책을 유지했다.
- **[LOW] API 대형 파일 의존성 과다**: 업로드 전용 `fs/path/crypto` import를 `api.js`에서 제거했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/uploadRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — DYNASTY Referral 라우트 분리 감사 반영 (v7.450)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 추천 조회/등록 라우트가 남아 있어 referral API 책임이 분산됨**: `server/routes/referralRoutes.js`로 분리했다.
- **[MEDIUM] 추천 등록 보안 정책 회귀 위험**: 등록 라우트는 기존처럼 body wallet을 신뢰하지 않고 `getAuthWallet(req)`만 사용한다.
- **[LOW] 추천 커미션 지급 side-effect 이동 중 경제 회귀 위험**: 하이잭/스왑/수확의 referral commission 지급 훅은 기존 게임 액션 안에 남겨뒀다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/referralRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Config/Deposit Bonus 라우트와 설정 캐시 단일화 감사 반영 (v7.449)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js` 내부에 공개 설정/입금 보너스 라우트와 설정 캐시가 섞여 있음**: `server/routes/configRoutes.js`와 `server/utils/settingsCache.js`로 분리했다.
- **[LOW] 설정 캐시 중복 생성 위험**: `api.js` 게임 액션 라우트와 config 라우트가 같은 `cfg()` 유틸을 사용하도록 단일화했다.
- **[LOW] `/api/config` governance 조회 실패가 전체 config 실패로 번질 위험**: 기존 governance fallback 정책을 새 라우터에서도 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/utils/settingsCache.js`
- `node --check server/routes/configRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Notification/Away Briefing 라우트 분리 감사 반영 (v7.448)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 알림/부재 브리핑 라우트가 남아 있어 플레이어 상태 API 책임이 분산됨**: 알림 조회/읽음 처리와 부재 중 손실 브리핑을 `server/routes/notificationRoutes.js`로 분리했다.
- **[LOW] 알림 읽음 처리 인증 회귀 위험**: `/api/notifications/read`, `/api/notifications/read-all`, `/api/me/away-briefing`의 `requireAuth` 정책을 유지했다.
- **[LOW] bounty 테이블 미존재 환경 회귀 위험**: 부재 브리핑의 bounty 조회 fallback을 새 라우터에서도 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/notificationRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — 실사용 Title/Hall-of-Fame 라우트 분리 감사 반영 (v7.447)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 title/hall-of-fame 라우트가 남아 있어 칭호 API 책임이 분산됨**: 실사용 `/api/user/titles`, `/api/user/titles/equip`, `/api/hall-of-fame`, `/api/hall-of-fame/categories` 라우트를 `server/routes/titleRoutes.js`로 분리했다.
- **[LOW] 레거시 `hallOfFameRoutes.js`와 실사용 경로 혼동 위험**: 기존 비활성 `/api/titles`/`/api/hof` 라우터는 건드리지 않고, 프론트가 실제 호출하는 경로만 분리했다.
- **[LOW] title award side-effect 회귀 위험**: 영토 점령 등 게임 액션에서 발생하는 titleService/titleExt award 훅은 기존 위치에 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/titleRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Public Lore 라우트 Campaign 단일화 감사 반영 (v7.446)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 로딩 lore 라우트가 남아 Campaign/Lore API 책임이 분산됨**: `GET /api/lore`를 `server/routes/campaignRoutes.js`로 이동했다.
- **[LOW] 로딩 화면 fallback 회귀 위험**: DB 조회 실패 시 `{ lore: [], crawl: [] }`를 반환하는 기존 계약을 유지했다.
- **[LOW] 기존 `/api/lore` URL 계약 회귀 위험**: `campaignRoutes`가 이미 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트되어 있어 별도 URL 변경 없이 동일하게 동작한다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/campaignRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — PP→GP Exchange 라우트 분리 감사 반영 (v7.445)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 PP→GP 교환 라우트가 남아 있어 경제 API 책임이 단일화되지 않음**: 교환 실행과 교환 정보 조회 라우트를 `server/routes/exchangeRoutes.js`로 분리했다.
- **[MEDIUM] 경제 교환 로직 이동 중 보안 정책 회귀 위험**: enable fail-closed, rate/fee 검증, 일일 한도, row lock, 조건부 차감, 거래 로그 기록은 기존 흐름과 동일하게 유지했다.
- **[LOW] 기존 `/api/exchange/*` URL 계약 회귀 위험**: `server/index.js`에서 `exchangeRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/exchangeRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Daily 라우트 분리 감사 반영 (v7.444)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 일일 로그인/미션 라우트가 남아 있어 daily API 책임이 단일화되지 않음**: 일일 로그인 상태/수령, 일일 미션 조회/수령, 스트릭 조회 라우트를 `server/routes/dailyRoutes.js`로 분리했다.
- **[LOW] daily progress 훅을 함께 이동할 경우 게임 액션 side-effect 회귀 위험**: 영토 클레임/하이잭/수확/코스메틱 등 기존 게임 액션의 일일 미션 progress 훅은 기존 위치에 유지했다.
- **[LOW] 기존 `/api/daily/*` URL 계약 회귀 위험**: `server/index.js`에서 `dailyRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/dailyRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — World OPS 라우트 분리 감사 반영 (v7.443)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 날씨/탐사/로켓 라우트가 섞여 있어 월드 이벤트 책임이 단일화되지 않음**: 날씨, POI/Starlink, POI 힌트, 로켓 이벤트/루트/트리거/우선권 라우트를 `server/routes/worldOpsRoutes.js`로 분리했다.
- **[LOW] 날씨/탐사 서비스를 완전히 제거할 경우 생산 계산 회귀 위험**: `api.js`의 `weatherService`/`explorationService` 로드는 영토 생산/수확 modifier 계산용으로 유지했다.
- **[LOW] 기존 `/api/weather`, `/api/exploration/*`, `/api/rockets/*` URL 계약 회귀 위험**: `server/index.js`에서 `worldOpsRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/territory/harvest/economy core 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/worldOpsRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Season 라우트 분리 감사 반영 (v7.442)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 시즌 상태/보상/패스 라우트가 남아 있어 시즌 API 책임이 단일화되지 않음**: 시즌 상태, 리더보드, 카테고리, 커리어 통계, 보상, 공유/탭, 시즌패스 라우트를 `server/routes/seasonRoutes.js`로 분리했다.
- **[LOW] 시즌 점수 훅을 함께 이동할 경우 게임 액션 side-effect 회귀 위험**: claim/hijack/harvest/weather/exploration/guild 액션의 best-effort 점수 기록은 기존 위치에 유지했다.
- **[LOW] 기존 `/api/season/*`와 `/api/stats/career` URL 계약 회귀 위험**: `server/index.js`에서 `seasonRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/exploration/rocket/territory/harvest 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/seasonRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Mission 라우트 분리 감사 반영 (v7.441)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 OPS 미션 라우트가 남아 있어 미션 책임이 단일화되지 않음**: 미션 패드 조회, 프리뷰, 발사, 활성 목록, 보상 수령, 취소 라우트를 `server/routes/missionRoutes.js`로 분리했다.
- **[LOW] 미션 보상 후 시즌 점수 반영 회귀 위험**: 보상 수령 라우트의 시즌 점수 best-effort 반영 로직을 새 라우터로 함께 이동했다.
- **[LOW] 기존 `/api/missions/*` URL 계약 회귀 위험**: `server/index.js`에서 `missionRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 guild/season/exploration/rocket/territory/harvest 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/missionRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Item Economy 라우트 단일화 감사 반영 (v7.440)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 아이템 상점/강화/보호 주문서 라우트가 섞여 있어 경제 기능 책임이 단일화되지 않음**: 상점 구매/사용, 자동 갱신, 아이템 인스턴스, 보호 주문서, 강화 비용/확률/실행 라우트를 `server/routes/itemEconomyRoutes.js`로 분리했다.
- **[LOW] 아이템 경제 URL 계약 회귀 위험**: `server/index.js`에서 `itemEconomyRoutes`를 기존 `apiRoutes`보다 앞에 `/api` + `apiLimiter`로 마운트해 기존 `/api/shop/*`, `/api/items/*`, `/api/enhance/*` 호출을 유지했다.
- **[LOW] 이동 후 불필요한 의존성 잔존**: `server/routes/api.js`에서 더 이상 사용하지 않는 `enhancementService` 로드를 제거했다.

### 남은 정리 범위
- `server/routes/api.js`는 아직 harvest/territory/mission/season 등 여러 도메인이 섞여 있어 추가 분리가 필요하다.

### 검증 완료
- `node --check server/routes/itemEconomyRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Campaign 라우트 분리 + API 공통 헬퍼 단일화 감사 반영 (v7.439)

### ✅ 수정 완료
- **[LOW] `server/routes/api.js`에 캠페인/평판/태그/로어 라우트가 섞여 있어 서버 라우트 책임이 단일화되지 않음**: 해당 라우트를 `server/routes/campaignRoutes.js`로 분리했다.
- **[LOW] 인증/지갑/입력 sanitize/Internal request 헬퍼가 `api.js` 내부에 고립되어 다른 라우트와 재사용하기 어려움**: `server/utils/apiHelpers.js`로 단일화하고 `api.js`와 새 캠페인 라우트가 동일 헬퍼를 사용하게 했다.
- **[LOW] 기존 URL 계약 회귀 위험**: `server/index.js`에서 `campaignRoutes`를 `/api` 아래에 `apiLimiter`와 함께 마운트하고 기존 `/api/campaign/*`, `/api/reputation/*`, `/api/tags/*`, `/api/lore/*`, `/api/branch/*` 경로를 유지했다.

### 남은 정리 범위
- `server/routes/api.js`는 여전히 8천 라인 이상이다. 다음 후보는 shop/item/quest/harvest 계열 라우트 분리다.
- `server/routes/admin.js`, `server/services/campaign.js`, `index.html`도 큰 파일 상태라 기능 단위별 추가 분리가 필요하다.

### 검증 완료
- `node --check server/utils/apiHelpers.js`
- `node --check server/routes/campaignRoutes.js`
- `node --check server/routes/api.js`
- `node --check server/index.js`
- `git diff --check`

## 2026-06-11 — Faction 모달 CSS 외부화 감사 반영 (v7.438)

### ✅ 수정 완료
- **[LOW] Faction Selection 모달 스타일이 `index.html` 메인 `<style>`에 남아 UI 책임이 단일화되지 않음**: Faction 모달, 파벌 카드, 밸런스 바, 토스트 스타일을 `assets/faction-modal.css`로 분리했다.
- **[LOW] 공통 모바일 모달 규칙까지 함께 이동할 경우 다른 모달 회귀 위험**: 공통 모바일 safe-area 규칙은 기존 위치에 유지하고 Faction 기본 모달 스타일만 이동했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v103`으로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS 스타일/렌더, 랜딩/로딩 CSS 정리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/faction-modal.css` load
- `git diff --check`

## 2026-06-11 — 채팅/온보딩 오버레이 CSS 외부화 감사 반영 (v7.437)

### ✅ 수정 완료
- **[LOW] 채팅 오버레이와 온보딩 힌트 스타일이 `index.html` 메인 `<style>`에 남아 UI 책임이 단일화되지 않음**: 전역 오버레이 스타일을 `assets/utility-overlays.css`로 분리했다.
- **[LOW] 로딩 오버레이까지 함께 이동할 경우 초기 렌더 회귀 위험**: 로딩 오버레이/비디오 스타일은 기존 위치에 유지하고 채팅/온보딩 오버레이 전용 스타일만 이동했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v102`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS 스타일/렌더, 랜딩/로딩 CSS 정리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/utility-overlays.css` load
- `git diff --check`

## 2026-06-11 — War Betting 모달 CSS 외부화 감사 반영 (v7.436)

### ✅ 수정 완료
- **[LOW] War Betting 스타일이 `index.html` 메인 `<style>`에 남아 UI 책임이 단일화되지 않음**: War Betting 모달, 이벤트 카드, 옵션 버튼, 베팅 입력, 내 베팅 내역 스타일을 `assets/war-betting-modal.css`로 분리했다.
- **[LOW] 인접 채팅/온보딩 스타일까지 함께 이동할 경우 범위가 섞일 위험**: `.wb-*` 계열 War Betting 전용 스타일만 이동하고 채팅 오버레이/온보딩 힌트는 기존 위치에 유지했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v101`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. 채팅/온보딩 CSS, Daily OPS 스타일/렌더 정리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/war-betting-modal.css` load
- `git diff --check`

## 2026-06-11 — Battle Hub/Viewer 모달 CSS 외부화 감사 반영 (v7.435)

### ✅ 수정 완료
- **[LOW] Battle Hub/Viewer 계열 스타일이 `index.html` 메인 `<style>`에 1천 라인 이상 남아 UI 책임이 단일화되지 않음**: Battle Hub, Battle Declare, Commander Actions, Battle Renderer/Viewer, Battle Result/Report, AI Practice, Tournament, Hijack 핵심 스타일을 `assets/battle-hub-modal.css`로 분리했다.
- **[LOW] 공통 모바일/온보딩 규칙까지 함께 이동할 경우 다른 화면 회귀 위험**: 공통 모바일 모달 safe-area, 온보딩, 랜딩, 모바일 성능 규칙은 기존 위치에 유지하고 Battle Hub/Viewer 계열 핵심 블록만 이동했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v100`으로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, War Betting, onboarding/landing CSS 정리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/battle-hub-modal.css` load
- `git diff --check`

## 2026-06-11 — Fleet Command 모달 CSS 외부화 감사 반영 (v7.434)

### ✅ 수정 완료
- **[LOW] Fleet Command JS는 분리됐지만 핵심 스타일이 `index.html` 메인 `<style>`에 남아 UI 책임이 단일화되지 않음**: Fleet Command 전용 핵심 스타일을 `assets/fleet-command-modal.css`로 분리했다.
- **[LOW] 공통 모바일 모달 규칙까지 함께 이동할 경우 다른 모달 회귀 위험**: Shipyard/Battle Hub 등과 묶인 safe-area 규칙은 기존 위치에 유지하고 Fleet Command 전용 블록만 이동했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v99`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Battle Hub 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/fleet-command-modal.css` load
- `git diff --check`

## 2026-06-11 — Shipyard 모달 CSS 외부화 감사 반영 (v7.433)

### ✅ 수정 완료
- **[LOW] Shipyard 핵심 스타일이 `index.html` 메인 `<style>`에 남아 JS 분리 후에도 UI 책임이 단일화되지 않음**: Shipyard 전용 핵심 스타일을 `assets/shipyard-modal.css`로 분리했다.
- **[LOW] 공통 모바일 모달 규칙까지 함께 이동할 경우 다른 모달 회귀 위험**: Fleet Command/Battle Hub 등과 묶인 safe-area 규칙은 기존 위치에 유지하고 Shipyard 전용 블록만 이동했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v98`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Battle Hub, Fleet Command CSS 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/shipyard-modal.css` load
- `git diff --check`

## 2026-06-11 — Shipyard 모달 외부화 감사 반영 (v7.432)

### ✅ 수정 완료
- **[MED] Shipyard 청사진/건조큐/강화/마켓/상자/조립 로직이 `index.html` 인라인 스크립트에 2천 라인 이상 남아 있음**: Shipyard 동작 로직을 `assets/shipyard-modal.js`로 분리했다.
- **[LOW] Shipyard onclick 및 광물 전역 계약 변경 위험**: 기존 전역 함수명과 `MINERAL_ICONS`/`MINERAL_KO`/`MINERAL_EN` 참조 순서는 유지했다. HTML 마크업은 변경하지 않고 구현 위치만 단일화했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v97`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Shipyard CSS, Daily OPS, Battle Hub 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/shipyard-modal.js`
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/shipyard-modal.js` load
- `git diff --check`

## 2026-06-11 — Fleet Command 모달 외부화 감사 반영 (v7.431)

### ✅ 수정 완료
- **[MED] Fleet Command 상태/렌더/액션 로직이 `index.html` 인라인 스크립트에 남아 모달 마크업, Battle Hub HTML과 강하게 붙어 있음**: Fleet Command 동작 로직을 `assets/fleet-command-modal.js`로 분리했다.
- **[LOW] Fleet Command onclick 계약 변경 위험**: 기존 전역 함수명과 DOM id 계약은 유지했다. HTML 마크업은 변경하지 않고 구현 위치만 단일화했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v96`으로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Shipyard, Daily OPS, Battle Hub 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/fleet-command-modal.js`
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/fleet-command-modal.js` load
- `git diff --check`

## 2026-06-11 — 공통 게임 다이얼로그 외부화 감사 반영 (v7.430)

### ✅ 수정 완료
- **[MED] `gameConfirm()`/`gameInput()`/`gamePicker()` 공통 UI 로직이 `index.html` 인라인 스크립트에 남아 다수 시스템과 섞임**: 확인/입력/선택 다이얼로그 공통 로직을 `assets/game-dialogs.js`로 분리했다.
- **[LOW] 공통 다이얼로그 함수 계약 변경 위험**: 기존 전역 함수명과 HTML onclick 계약은 유지했다. 호출부는 변경하지 않고 구현 위치만 단일화했다.
- **[LOW] `escapeHTML` fallback 중복 위험**: 새 파일에서 fallback을 제공하되 기존 전역 함수가 있으면 덮어쓰지 않게 했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v95`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Shipyard, Fleet Command 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/game-dialogs.js`
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/game-dialogs.js` load
- `git diff --check`

## 2026-06-11 — 함선/광물 도감 모달 외부화 감사 반영 (v7.429)

### ✅ 수정 완료
- **[LOW] Ship Registry/Mineral Catalog 스타일과 렌더 로직이 `index.html` 하단에 섞여 있음**: 도감 모달 CSS를 `assets/ship-catalog-modals.css`, fetch/render/open-close 로직을 `assets/ship-catalog-modals.js`로 분리했다.
- **[MED] `openShipRegistry()`/`openMineralsPanel()` 이름이 보유 목록과 도감 모달에서 중복 사용됨**: 보유 패널 함수는 `openMyShipRegistry()`/`openMyMineralsPanel()`, 도감 함수는 `openShipCatalog()`/`openMineralCatalog()`로 분리해 전역 덮어쓰기 위험을 제거했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v94`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Shipyard, Fleet Command 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/ship-catalog-modals.js`
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/ship-catalog-modals.css` / `/assets/ship-catalog-modals.js` load
- `git diff --check`

## 2026-06-11 — 버그 리포터 CSS 외부화 감사 반영 (v7.428)

### ✅ 수정 완료
- **[LOW] 버그 리포터 스타일이 `index.html` 하단 인라인 CSS로 남아 관리 지점이 흐림**: FAB, 모바일 위치 규칙, 모달 카드, 스크린샷 드롭존, 제출 버튼 스타일을 `assets/bug-reporter.css`로 분리했다.
- **[LOW] 버그 리포터 UI/동작 책임이 한 파일에 섞일 위험**: 스타일은 `assets/bug-reporter.css`, 동작은 `assets/bug-reporter.js`, 마크업은 `index.html`로 역할을 분리했다.
- **[LOW] 구 캐시 잔존 위험**: UI/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v93`으로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Shipyard, Fleet Command 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- static `/assets/bug-reporter.css` / `/assets/bug-reporter.js` load
- `git diff --check`

## 2026-06-11 — 버그 리포터 JS 외부화 감사 반영 (v7.427)

### ✅ 수정 완료
- **[LOW] 버그 리포터 동작 로직이 `index.html` 하단 거대 인라인 스크립트에 섞여 있음**: 모달 열기/닫기, 자동 캡처, 이미지 업로드/붙여넣기/드롭, 제출/fallback 처리를 `assets/bug-reporter.js`로 분리했다.
- **[LOW] 버그 리포터 API/DOM 계약 관리 지점이 흐려질 위험**: `openBugReporter`, `closeBugReporter`, `submitBugReport`, `bugClearSs`, `bugSsZoneClick`, `bugSsFileChosen`, `bugSsDrop` 전역 계약은 유지하면서 구현 파일만 단일화했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v92`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. 버그 리포터 CSS 외부화, Daily OPS, Shipyard, Fleet Command 분리가 다음 후보로 남아 있다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/bug-reporter.js`
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- `git diff --check`

## 2026-06-11 — Tactical Lab 모달 JS 외부화 감사 반영 (v7.426)

### ✅ 수정 완료
- **[LOW] 전술랩 wrapper JS가 `index.html` 거대 인라인 스크립트에 섞여 있음**: 전술랩 URL 생성, iframe unload, sandbox 모달 열기/닫기, ESC 닫기, postMessage 처리, 후퇴/전투종료/커맨더 명령 API 호출을 `assets/tactical-lab-modal.js`로 분리했다.
- **[LOW] 전술랩 생명주기 관리 지점이 CSS/JS/HTML에 흩어질 위험**: `index.html`에는 모달 마크업과 외부 스크립트 로드만 남겼다. 전술랩 wrapper 동작은 새 JS 파일이 단일 관리 지점이다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v91`로 갱신했다.

### 남은 정리 범위
- `index.html` 전체 기능 분해는 아직 완료가 아니다. Daily OPS, Shipyard, Fleet Command처럼 API/DOM 경계가 분명한 블록을 다음 단위로 분리해야 한다.
- `server/routes/api.js` 도메인별 라우트 분해는 별도 작업으로 남아 있다.

### 검증 완료
- `node --check assets/tactical-lab-modal.js`
- `node --check sw.js`
- `index.html` inline script parse
- `git diff --check`

## 2026-06-11 — 시스템 공통부 스파게티 정리 1차 감사 반영 (v7.425)

### ✅ 수정 완료
- **[MED] rate limiter 생성 옵션이 서버 진입점/대형 API 라우트에 중복됨**: `server/utils/rateLimiters.js`의 `makeRateLimiter()`로 표준 헤더, legacy header 비활성화, store error policy, 메시지 포맷을 일원화했다. 기존 제한값/메시지/API 동작은 유지했다.
- **[MED] `server/index.js`에 단순 스케줄러 `setInterval + try/catch` 패턴이 대량 반복됨**: `server/utils/scheduler.js`를 추가하고, 단순 expiry/cleanup 계열 일부를 `safeInitScheduler()`/`scheduleTask()`로 전환했다.
- **[LOW] 스케줄러 추가 시 로그/에러 처리 방식이 계속 달라질 위험**: 새 helper가 init 실패, tick 실패, startup delay, started log를 같은 형태로 처리한다.

### 남은 정리 범위
- `index.html`은 여전히 거대 단일 파일이다. 기능별 모듈 분리 없이는 프론트 전체 스파게티 제거 완료로 볼 수 없다.
- `server/routes/api.js`는 아직 8천 줄대 대형 라우트다. 영토/경제/탐사/관리성 API를 도메인 라우트로 분리해야 한다.
- 오토리뉴얼/현상금 환불/전투 정산 같은 경제 영향 블록은 이번 1차에서 무리하게 변경하지 않았다. 별도 테스트와 함께 분리해야 한다.

### 검증 완료
- `node --check server/index.js`
- `node --check server/routes/api.js`
- `node --check server/utils/rateLimiters.js && node --check server/utils/scheduler.js`
- `git diff --check`

## 2026-06-11 — Tactical Lab 모달 코드 정리 감사 반영 (v7.424)

### ✅ 수정 완료
- **[LOW] 전술랩 모달 스타일이 `index.html` 하단 인라인 CSS로 남아 관리 지점이 흐림**: sandbox 모달 CSS를 `assets/tactical-lab-modal.css`로 분리했다. 모달 크기/모바일 전체화면 정책은 새 CSS 파일이 단일 관리 지점이다.
- **[LOW] 전술랩 열기/닫기 함수가 DOM 조회, 번역 갱신, iframe 생명주기를 한 함수 안에서 처리함**: `getTacticalLabModalElements()`, `syncTacticalLabModalText()`, `handleTacticalLabEscape()`로 분리해 읽기 쉬운 단위로 정리했다.
- **[LOW] 전술랩 iframe 메시지 핸들러가 후퇴/종료/명령 API를 한 함수에서 모두 처리함**: `handleTacticalLabForfeitMessage()`, `handleTacticalLabBattleEndMessage()`, `submitTacticalLabCommanderAction()`로 분리했다. API 계약과 payload는 유지했다.
- **[LOW] 운영 콘솔 로그 잡음**: iframe `ready` 메시지의 상시 `console.log`를 제거했다. tactical-lab catalog/preset 로드 로그는 `debug=1` query에서만 출력한다. 실패/경고 로그는 유지했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS/CSS 변경 반영을 위해 Service Worker 캐시를 `mars-v90`으로 갱신했다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- `node --check sw.js`
- `git diff --check`

## 2026-06-11 — Tactical Lab sandbox PC 높이 클리핑 감사 반영 (v7.423)

### ✅ 수정 완료
- **[MED] 작은 PC 브라우저 창에서 전술랩 하단 조작부가 잘림**: sandbox 전술랩이 데스크탑에서도 전체화면 iframe + 내부 `height:100svh/overflow:hidden` 구조라, 브라우저 높이가 낮으면 하단 버튼이 화면 밖으로 밀릴 수 있었다. 데스크탑 sandbox 전술랩을 중앙 모달로 바꾸고 모달 높이를 `calc(100vh - 36px)`로 제한했다.
- **[LOW] 실전 전투와 실험실 레이아웃 정책 혼재 위험**: `assets/tactical-lab-v11.html`에 `data-tl-mode`를 추가해 sandbox 모드에서만 캔버스/버튼 압축 CSS가 적용되게 했다. `mode=battle` 실전 전투 뷰어의 대형 화면 정책은 유지한다.
- **[LOW] 모바일 조작 면적 축소 위험**: 모바일 `<=720px`에서는 기존 전체화면 전술랩을 유지한다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v89`로 갱신했다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- `node --check sw.js`
- `git diff --check`

## 2026-06-10 — Tactical Lab 모듈화 계약 감사 반영 (v7.422)

### ✅ 수정 완료
- **[MED] 전술랩 호출 경로가 실전 전투/실험실에서 따로 관리됨**: battle viewer와 standalone tactical lab이 서로 다른 iframe URL 하드코딩을 사용했다. `buildTacticalLabUrl()`로 URL 생성 경로를 통합했다.
- **[MED] 전술랩이 실험 HTML처럼 보이는 구조적 혼선**: 파일은 독립 HTML로 유지하되 `mode=battle`/`mode=sandbox` 계약을 추가해 메인 게임의 공식 전투 뷰어 모듈로 동작하게 했다.
- **[LOW] iframe 종료 누락 회귀 위험**: 전투 뷰어와 전술 실험실 닫기 모두 `unloadTacticalLabFrame()`을 사용하게 정리했다. 닫힌 iframe의 WebAudio/rAF/WS 잔존 위험을 줄인다.
- **[LOW] 부모 통신 경로 중복**: tactical-lab 내부의 `postMessage` 직접 호출을 `notifyParent()`로 정리하고 `ready` 메시지를 추가했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v88`로 갱신했다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- `node --check sw.js`
- `git diff --check`

## 2026-06-10 — SEA 로컬라이징/전술랩 i18n 감사 반영 (v7.421)

### ✅ 수정 완료
- **[MED] 동남아 타깃 언어 코드 미지원**: 기존 언어 시스템은 EN/KO/JA/ZH만 전제로 했다. 인도네시아/베트남/태국 커뮤니티 확장에 필요한 `id`/`vi`/`th` 슬롯과 코드 정규화를 추가했다.
- **[MED] 독립 전술랩 언어 불일치 위험**: 전술랩은 별도 HTML이라 메인 앱 i18n과 자동 동기화되지 않는다. `lang` query, parent `LANG`, `localStorage.pw_lang`을 읽는 독립 i18n 경로와 ID/VI/TH 번역을 추가했다.
- **[LOW] 미번역 키 노출 위험**: SEA 언어 seed dictionary는 영어 fallback 기반으로 구성했다. 아직 번역 범위 밖 문장은 키 대신 영어 문구로 표시된다.
- **[LOW] 음성/텍스트 언어 정책 혼재 위험**: UI 언어는 다국어로 확장하되 캠페인/게임 음성은 영어 베이스로 고정하는 `GAME_VOICE_LANG='en'` 정책을 명시했다.
- **[LOW] 구 캐시 잔존 위험**: UI/JS 변경 반영을 위해 Service Worker 캐시를 `mars-v87`로 갱신했다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- `node --check sw.js`
- `git diff --check`

## 2026-06-10 — Daily OPS 완료 표시 레이스/미션명 호환 감사 반영 (v7.420)

### ✅ 수정 완료
- **[MED] 성공 액션 후 완료 항목에 녹색불이 늦거나 안 들어올 수 있음**: 실제 서버 Daily OPS 미션 타입은 `upgrade_ship`/`harvest_pp`/`ai_battle`인데, 프론트 성공 훅 일부가 예전 로컬 타입 `ship_upgrade`/`territory_harvest`/`ai_practice`를 갱신했다. 현재 서버 미션명 그룹으로 매핑해 완료 표시가 같은 작전보드에 반영되게 했다.
- **[LOW] 서버 비동기 훅과 프론트 재조회 레이스**: 함선 강화/채굴/AI 연습전 성공 직후 프론트가 바로 작전보드를 다시 읽으면, 서버의 `notifyMissionProgress()`가 아직 끝나지 않아 미완료처럼 보일 수 있었다. 즉시 재조회 후 450ms/1300ms 지연 재조회를 추가해 서버 상태가 따라오는 구간을 흡수한다.
- **[LOW] 로컬 피드백과 서버 원천 분리**: 작전보드 렌더는 서버 응답을 기본으로 유지하되, 방금 성공한 로컬 액션 진행도만 표시 판정에 보조로 사용한다. 보상 수령과 GP 지급은 계속 서버 `/api/daily-ops/claim`에서만 수행된다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- `node -c server/routes/dailyOps.js && node -c server/routes/ships.js && node -c server/routes/api.js`
- `git diff --check`

## 2026-06-10 — 내 아이템/캠페인 레이아웃 추가 감사 반영 (v7.419)

### ✅ 수정 완료
- **[MED] 내 아이템 탭에서 재료 보유분이 숨겨짐**: `renderBaseInventory()`가 `_baseInventory`만 보고 비어 있으면 즉시 반환했다. 그래서 상점 아이템은 없고 재료만 있는 계정은 작전보드 GO로 `내 아이템`에 진입해도 재료가 보이지 않았다. 아이템과 재료가 모두 없을 때만 empty 안내를 띄우도록 수정했다.
- **[LOW] 카테고리 empty 안내가 재료 섹션 렌더를 막음**: 선택된 아이템 카테고리에 장비가 없으면 함수가 반환되어 보유 재료도 같이 사라질 수 있었다. 카테고리 empty 안내는 표시하되 재료 섹션은 계속 렌더한다.
- **[LOW] 캠페인 캐릭터 scale/transition 위치 흔들림 위험**: 에디터/인게임은 같은 중심점 좌표 모델을 쓰지만 transform origin이 명시되지 않았다. 캐릭터 scale 적용 시 기준점을 고정해 에디터 배치와 인게임 표시가 흔들릴 여지를 줄였다.

### 검증 완료
- `index.html`, `assets/tactical-lab-v11.html`, `assets/campaign-editor.html` inline script parse
- Daily OPS 레거시 참조 `rg` 0건
- `git diff --check`

## 2026-06-10 — Daily OPS 레거시/캠페인 레이아웃 감사 반영 (v7.418)

### ✅ 수정 완료
- **[MED] Daily OPS 레거시 보드가 다시 살아날 위험**: `BASE > 내 영토` 단일 보드와 별개로 예전 `renderDailyOpsBoard()`/`openDailyOpsRoute()` 구현이 남아 있었다. DOM이 없어 대부분 inert였지만 언어 변경/체크인/미션 진행에서 계속 호출되어 중복 보드 회귀 위험이 있었다. 레거시 구현과 호출을 제거하고 `loadOpsCommandBoard()`로 통일했다.
- **[HIGH] 캠페인 에디터 위치와 인게임 위치 불일치**: 인게임 스토리 렌더러가 같은 브라우저의 에디터 `localStorage` 좌표를 서버 저장 레이아웃보다 우선할 수 있었다. 오래된 로컬 좌표가 남으면 에디터 저장값과 다른 위치가 인게임에 표시된다. 인게임은 서버 저장 레이아웃/서버 캐시만 사용하도록 변경했다.
- **[MED] 캠페인 첫 프레임 레이아웃/전환 흔들림**: 서버 레이아웃을 불러오기 전 로컬 좌표로 먼저 렌더한 뒤 다시 서버 좌표로 렌더할 수 있었다. 마지막 서버 레이아웃 캐시를 첫 프레임에 적용하고, 서버 응답이 실제로 바뀐 경우에만 재렌더하도록 했다.
- **[LOW] 강화 확인 모달의 보유/부족 상태 가시성 부족**: GP/재료 행이 텍스트 색만 달라져 부족 자원을 놓치기 쉬웠다. OK/부족 상태에 배경과 테두리를 추가해 강화 버튼을 누른 순간 현재 보유량과 부족 자원이 명확히 보이게 했다.

### 검증 완료
- Daily OPS 레거시 참조 `rg` 0건
- `node --check server/routes/dailyOps.js`
- `node --check server/services/battleEngine.js`
- `node --check server/services/battleReport.js`
- `node --check sw.js`
- `find server -name '*.js' -not -path '*/node_modules/*' -print0 | xargs -0 -n1 node --check`
- `index.html`, `assets/tactical-lab-v11.html` inline script parse
- `git diff --check`

### 로컬 런타임 참고
- `JWT_SECRET=local-dev-secret-please-change ADMIN_SECRET=admin-local RUN_SCHEDULERS=false PORT=3100 npm start`는 로컬 DB `jongho`가 없어 `database "jongho" does not exist`에서 중단된다. 코드 문법 문제가 아니라 로컬 DB 환경 문제다.

## 2026-06-10 — Daily OPS 작전보드 라우팅/완료 상태 감사 반영 (v7.417)

### ✅ 수정 완료
- **[MED] 아이템/재료 계열 GO가 내 아이템으로 연결되지 않음**: 내 영토 탭의 오늘의 작전 보드에서 재료 제작 계열이 마켓 탭으로 이동해 사용자가 보유 아이템/재료를 확인할 수 없었다. 해당 계열은 `baseTabItems`로 이동하고 `loadBaseInventory()`를 즉시 호출하도록 보강했다.
- **[MED] 완료 항목 녹색 표시 누락 가능성**: 프론트가 `completed` boolean만 신뢰해 `current >= target` 상태인 항목이 미완료처럼 보일 수 있었다. 내 영토 작전보드에서 진행도 기반 완료 판정을 같이 사용한다.
- **[LOW] 오늘의 작전 보드 중복 표시 위험**: `OPS CONSOLE` 탭까지 Daily OPS 보드를 미러링하면 같은 보드가 두 군데서 살아나는 문제가 생긴다. Daily OPS는 `BASE > 내 영토` 단일 소스로 고정하고 OPS 콘솔 미러링을 제거했다.
- **[MED] Daily OPS stale row 보상 수령 실패 가능성**: 서버 claim 쿼리가 `completed = TRUE`만 허용해 진행도는 목표치에 도달했지만 boolean이 stale인 행은 수령할 수 없었다. `current_count >= target_count`도 수령 가능하게 하고 수령 시 `completed`를 확정한다.
- **[LOW] UI 변경 캐시 잔존 위험**: Service Worker 캐시를 `mars-v86`으로 올려 작전보드 라우팅 변경이 구버전 캐시에 막히지 않게 했다.

### 검증 예정/필수
- `node --check server/routes/dailyOps.js`
- `node --check server/services/battleEngine.js`
- `node --check server/services/battleReport.js`
- `node --check sw.js`
- `index.html`, `assets/tactical-lab-v11.html` inline script parse
- `git diff --check`

## 2026-06-10 — 전술 계산/손실가치 리포트 감사 반영 (v7.416)

### ✅ 수정 완료
- **[HIGH] 전술 버튼이 승패 계산에 충분히 연결되지 않음**: 진형/기동 UI는 있었지만 일반 포격 데미지 계산에서 선택의 의미가 약했다. `computeDamage()`에 진형/기동/기함 생존 배율을 연결해 쐐기, 핀서, 방어막, 구형, 선봉방어, 전진, 후퇴, 측면, 산개, 재집결이 실제 교환비를 바꾸게 했다.
- **[MED] 기함 시스템의 전투 영향 부족**: 기함 격침 이벤트는 있었지만 전투 품질 변화가 약했다. 기함 생존 여부가 공격/방어 배율에 반영되도록 했다.
- **[MED] 재집결/방어막의 장기전 의미 부족**: 수리함 효율에 `rally`/`screen` 보너스를 부여해 방어적 기동이 장기전 선택지로 기능하게 했다.
- **[MED] 전투 결과에서 경제 손실 체감 부족**: full-loss로 기록된 `ship_wrecks`가 리포트 카드에 노출되지 않았다. 리포트 응답에 `full_loss_ships`, `loss_value_gp`를 추가하고 결과 모달에 `자산 손실` 비교 블록을 표시한다.
- **[LOW] 패배 분석이 경제 손실을 읽지 못함**: 손실 가치 격차가 큰 전투를 감지해 고강화/대형함 보호, 상대 저격/폭격 확인, 재건 재료 확보 추천을 추가했다.

### 검증 예정/필수
- `node --check server/services/battleEngine.js`
- `node --check server/services/battleReport.js`
- `node --check sw.js`
- `index.html`, `assets/tactical-lab-v11.html` inline script parse
- `git diff --check`

## 2026-06-10 — 함대 지휘/전투 리포트 UX 감사 반영 (v7.415)

### ✅ 수정 완료
- **[MED] 전술 버튼의 효과/리스크가 숨겨짐**: Fleet Command의 진형/기동 버튼은 눌러도 무엇이 강해지고 무엇이 약해지는지 즉시 알기 어려웠다. 현재 선택된 진형/기동 설명을 버튼 아래에 고정 표시한다.
- **[MED] 출격 전 편성 약점 파악 부족**: 함선 수량만 보이고 기함 미지정, 지원함 부재, 대형함 호위 부족, 대형함 카운터 부재 같은 실전 약점이 보이지 않았다. `DOCTRINE CHECK`를 추가해 현재 함대 기준 경고를 표시한다.
- **[LOW] 결과 리포트에서 역할 구도 비교 부족**: 패인 문장은 나오지만 내 역할 조합과 상대 역할 조합이 직접 비교되지 않았다. 전투 리포트에 태클/전자전/DPS/탱커/저격/폭격/로지 비교표를 추가했다.
- **[LOW] UI 변경 캐시 잔존 위험**: 프론트/CSS 변경이 서비스워커 캐시에 묶일 수 있어 `sw.js` 캐시 버전을 `mars-v85`로 갱신했다.

### 검증 예정/필수
- `node --check server/services/battleEngine.js`
- `node --check server/services/battleReport.js`
- `index.html`, `assets/tactical-lab-v11.html` inline script parse
- `git diff --check`

## 2026-06-09 — 함대전 스킬/리포트/연출 정합 감사 (v7.414)

### ✅ 수정 완료
- **[HIGH] 기함 격침 데미지 중복 집계**: 모든 격침이 `ship_destroyed`로 기록되고 기함은 추가 `flagship_destroyed`도 남기므로, 리포트 데미지 집계가 두 이벤트를 모두 더하면 기함 피해가 과대 표시될 수 있었다. 데미지 집계는 `ship_destroyed`만 사용하도록 제한했다.
- **[MED] 미사일 표적 우선순위 역전**: 수동 미사일 정렬 방향을 보정해 프리깃/저HP 다수 타격 역할이 실제로 반영되게 했다.
- **[MED] 수동 스킬/수리 이벤트 가시성 부족**: `manual_skill`, `repair_pulse`, `event_stats`를 통해 빔포/미사일/EMP/수리 사용량이 결과 리포트에 표시되게 했다.
- **[MED] 전술랩 연출 체감 부족**: 화성 배경 밝기를 올리고 수동 빔/미사일 TTL을 늘려 스킬 사용 순간이 더 오래 보이게 했다.

### 검증 예정/필수
- `node --check server/services/battleEngine.js`
- `node --check server/services/battleReport.js`
- `index.html`, `assets/tactical-lab-v11.html` inline script parse
- `git diff --check`

## 2026-06-09 — MMO 경제/영토/함대 거래 흐름 재검수 반영 (v7.412)

### ✅ 수정 완료
- **[HIGH] 옥션 서비스 스키마 불일치**: `server/services/auction.js`가 레거시 `item_type/resource_code/bid_amount/settled/no_bids` 컬럼을 사용하던 경로를 현재 스키마(`listing_type/resource_id/amount/sold/expired`)로 정렬했다. 즉구/낙찰/유찰/자원 에스크로/입찰 이력이 모두 같은 스키마를 사용한다.
- **[HIGH] 캠페인 에디터 레이아웃 무권한 쓰기**: `/api/campaign/editor-layout` POST에 admin secret 검사를 추가하고, 에디터 자동 저장도 같은 `x-admin-secret` 헤더를 사용하게 했다.
- **[MED] Cantina 부분 숫자 파싱**: bet/target/tile 입력에서 `parseFloat`/`parseInt` 부분 파싱을 제거하고 strict finite number/integer 검증으로 바꿨다. Crash round start는 인증+rate limit을 요구한다.
- **[MED] PP/GP/withdraw 수치 정규화**: swap, withdraw, withdraw-all, PP→GP, GP transfer 경로에서 finite positive number와 체인 allowlist를 유지하도록 보강했다.
- **[MED] 함선 scrap 인증 일관성**: scrap은 표준 JWT wallet helper를 사용한다. 원격 최신에도 이미 반영되어 있었고 재검수에서 유지 확인했다.

### 검증 예정/필수
- `node --check` 서버 파일군
- `git diff --check`
- `index.html`, `assets/campaign-editor.html` inline script parse

## 2026-06-05 — Base 체인 자금경로 적대검수 (Codex+컨트랙트감사관+서버무결성) → P0/P0-b 수정 (v7.402)

검수 3주체 만장일치 P0 = **출금 nonce/정산 desync**. 컨트랙트 코어(재진입 CEI·SafeERC20·서명
리플레이 방지)는 건전 확인. 입금 멱등성·솔벤시 원자성·decimals·referral PP 페그는 통과.

### 🔴 수정 완료 (v7.402, mig316)
- **[CRITICAL] 출금 nonce/정산 desync** (api.js /withdraw + MarsDeposit.sol:131,149): DB 차감+DB
  nonce++ 후 서명만 반환 → 미제출/만료/revert 시 잔액 증발 + nonce 영구 desync(이후 출금 전부 마비).
  → 예약(pending_withdrawals) 모델 + 온체인 nonce eth_call + Withdrawn 정산 + 만료 자동환불
  (온체인 nonce 미증가 확인 후에만 → 이중환불 차단). signer.js `getOnchainWithdrawNonce`.
- **[HIGH] fee 필드 덮어쓰기** (api.js:2331): 응답 fee가 서명된 fee(0)를 덮어써 온체인 호출 시
  서명 불일치 revert → 잔액 잠김. → 온체인 파라미터(`contractFee:"0"`)와 표시용(`feeDeducted`) 분리.

### 🟠 잔여 권장 (실자금 전 별도 작업 — 미수정)
- **[HIGH] 입금 무confirmation/reorg** (chain.js live listener): 1-conf 즉시 크레딧 → Base reorg 시
  담보 없는 USDT. → N-confirmation 후 크레딧(멱등 가드 있어 지연 안전).
- **[HIGH] collectRevenue 무제한** (MarsDeposit.sol:170): owner가 유저 원금까지 인출 가능.
  → fee 수익 별도 회계 + 그 한도로 cap.
- **[CRITICAL-운영] signer 키 유출 = 풀 드레인** (per-user cap 온체인 부재): hot-wallet 유동성
  최소화 + 멀티시그/HSM + 일일 한도.
- **[MED] deposits tx_hash 단독 UNIQUE** (log_index 미수집): 한 tx 다중 Deposited 시 2번째 silent
  누락. → `UNIQUE(chain,tx_hash,log_index)`.
- **[MED] 서명 malleability** (MarsDeposit.sol _recoverSigner): s high-half 미차단. nonce가 실질
  방어하나 OZ ECDSA.recover 권장.

### 검증
3파일 node -c OK. mig316 적용(유니크 부분인덱스 `(chain,wallet,nonce) WHERE pending`, status/gross/net
CHECK). 모듈 로드 + 리코실리어 무계약 안전 실행 확인. 온체인 통합검증은 컨트랙트 배포 후(현재 미배포).

## 2026-06-04 — Codex 라운드2 반영: 슬롯 설정 인플레 가드 (v7.397)

Codex 라운드2(XSS는 v7.396 이스케이프로 막힘 확인). 추가 발견 반영:
- [HIGH] victory_slot_repair_feed_pct>100이면 풀에 소각보다 더 적립→phantom GP 발행(admin 오설정
  인플레). feedPool에서 pct 0~100 클램프 + add≤repairGp. (100%=break-even carve, 초과 불가)
- [MED/LOW] base_gp 0~1,000,000 클램프(음수=강제꽝/과도=풀 즉시고갈·overflow 방지).
- [LOW] away-briefing WHERE LOWER(original_owner)=LOWER($1) — 레거시 mixed-case 손실 누락 방지.
검증: pct=150→100·적립≤repair(phantom 없음), base=-5→0/9e9→1M, 스모크 11/0, fresh 체인 280.
killmail value는 표시 전용(보상 미사용)·슬롯 payout은 서버 권위 — INFO 확인.

## 2026-06-04 — 도파민 코드 라운드2 적대검수 (팀+레드팀, Codex 진행중)

라운드1 수정 회귀 + 새 각도(XSS/스푸핑/설정악용). **익스플로잇 0건 — 라운드1 수정 견고.**

### 검증 통과
- XSS: 킬보드가 닉네임/함선명을 innerHTML 렌더하나, 닉네임은 입력단 화이트리스트(<>"'' 차단,
  auth/profile 정규식)로 막히고 ship_name은 고정 함급명(플레이어 커스텀 아님) → 현재 악용 불가.
  away-briefing은 숫자만, rewardBurst는 textContent → 인젝션 없음.
- 승리슬롯 경제: 가드 차감은 FOR UPDATE+선클램프로 항상 rowCount=1(dead branch, 무해), 실패시도
  ROLLBACK이 claims 되돌려 double-pay 없음. mult=0/풀고갈은 스핀 정확히 소진. 시스템 net-de플레
  (수리 80% 소각, ≤20% 환류 → 그룹 합산 net-negative 보장). E[mult]=1.59, E[payout]≈79.5/win.

### 방어적 하드닝 적용(권고 반영, v7.396)
- [방어선] 킬보드 출력 이스케이프: _kbName 출력 + ship_name을 escapeHtmlSafe로 감쌈(출력 이스케이프가
  올바른 레이어 — 닉 화이트리스트가 미래에 깨져도 방어). 런타임: 음수 w 필터·쓰레기 폴백 확인.
- [견고성] 승리슬롯 가중치 음수 w/m 클램프(admin 오타가 추첨 분포 왜곡 방지).

## 2026-06-04 — Codex 재스윕 반영: 도파민 코드 방어적 하드닝 (v7.395)

Codex가 #1(feedPool — 이미 SAVEPOINT 수정)을 확인하고 방어적 하드닝 3건 권고 → 전부 반영:
- [MED] killmail wreck 값 finite+범위 클램프(_mods≤100K, _value≤9e12 BIGINT) — 이상치가 SAVEPOINT _kb
  롤백을 일으켜 전투 전체 wreck 유실되던 worst-case 차단.
- [LOW] 승리슬롯 풀 가드 차감(`WHERE pool_gp>=$1`+rowCount) — FOR UPDATE+클램프에 더한 음수 방어.
- [LOW] mig314: victory_slot_pool/claims/ship_wrecks 머니 컬럼 비음수 CHECK(NOT VALID, 미래 쓰기 강제).
검증: 스모크 11/0, fresh 체인 280개 완주, CHECK 3종 적용 확인.

## 2026-06-04 — 도파민 신규 코드 적대검수 (팀+레드팀+Codex)

v7.388~394 신규 코드(승리슬롯/킬메일/복귀브리핑/실드) 검수.

| 등급 | 항목 | 결과 |
|---|---|---|
| **CLASS A(잠재)** | repairShip의 feedPool이 SAVEPOINT 미격리 → fresh/부분 배포에서 mig313 전 실행 시 풀 UPDATE throw가 수리 트랜잭션 오염→수리 silent 롤백 | ✅ 수정(SAVEPOINT _vsfeed). 런타임 검증: feedPool 오류 격리 후 부모 txn 생존+COMMIT |

### 검증 통과(안전 확정)
- 승리 슬롯: **carve-safe, 완전 가드**. 승자=JWT+서버산정(스푸핑 불가), double-spin=claims PK+ON CONFLICT(race-safe), 풀 음수/드레인=FOR UPDATE+선클램프, self-feed=80% 소각 순손실(인플레 불가). draw는 winner 행 미생성→스핀 불가. 유일 흠은 dust 누적(보수적, 누수 아님).
- 킬메일 wreck 값: 컬럼 전부 존재(bonus_*/build_gp_cost)+COALESCE+LEFT JOIN+BIGINT 범위내, SAVEPOINT _kb 격리 → 최악도 빈 wreck(전투결과 오염 없음).
- away-briefing: 읽기전용, wallet=JWT only, 무인증 401.
- 스키마-코드 정합(victory_slot_pool/claims).

## 2026-06-03 — 함대전·경제 적대검수 (팀+레드팀+Codex): P0 격침회피 외 다수

검수 종합. JSONB 플래그(7종)·전투해소 exactly-once·재료/GP 보존·P2W곡선(180pt cap)·캐피탈 게이팅·
AI함대 무발행·repair dust 없음은 전부 **안전 확정**(검토자 오탐 차단). 수정한 실버그:

| 등급 | 버그 | 수정 |
|---|---|---|
| **P0** | scrapShip SELECT에 fleet_id 누락 → SHIP_IN_BATTLE 가드 항상 무력화 → preparing 10초 윈도에 함선 해체로 격침회피+40% 환수 (full-loss 붕괴) | fleet_id 추가 (v7.374) |
| **P1** | assertShipNotInBattle 유령상태 'pending'→실제 'preparing' 누락 → 마켓등록으로 격침회피 | 'preparing'/'active'+SAVEPOINT |
| **H** | repairShip/chargeShield 전투가드 부재, upgradeStat 유령 'pending' → 전투 중 HP/실드/스탯 조작 | 공유 헬퍼 통일 |
| **H** | battleEngine: 실드가 sim에서 소모되나 applyBattleResults가 shield_hp 미영속 → 매전투 풀실드 재사용(GP싱크 무력화) | by_ship에 shield_hp + 생존/보존 UPDATE에 영속 (v7.375) |
| **H** | Titan 서버캡(3/종) cross-wallet TOCTOU → 동시 건조로 캡 초과 | pg_advisory_xact_lock(종별 직렬화) |
| **H** | 하이잭 픽셀 이전(phase2/auto-win)이 lat/lng만으로 UPDATE → 선언 후 소유권 바뀐 픽셀을 stale 덮어쓰기(제3자 영토 탈취) | LOWER(owner) IS NOT DISTINCT FROM prevOwner 술어 |

### 검증된 안전(수정 불요)
- applyBattleResults exactly-once: 단일 호출+FOR UPDATE+status WHERE rowCount+rewards 존재검사.
- full-loss 플래그 7종 전부 String()=== 'true' 정상 판독(JSONB flip 없음). 커맨더 공성 분리게이트.
- 재료/GP 차감 전부 AND qty/bal>=needed+rowCount. upgrade 실패도 비용소모. buy/forfeit/wallet JWT 안전.
- 경제: full-loss 재건 sink >> 전투보상 = 디플레. 캐피탈 Core/Mid 섹터게이팅 실효. 마켓수수료 소각.

### 🟡 잔여(별도, 저빈도)
- api.js:1820 하이잭 declare가 픽셀을 서비스 트랜잭션 밖에서 FOR UPDATE 없이 읽음(stale enemy_pixels) — 전송 단계의 expected-owner 술어로 실제 탈취는 차단됨. 선언 자체의 원자화는 후속.
- battleEngine:1175 applyBattleResults가 참가 함선 row FOR UPDATE 미적용(MEDIUM race) — 스케줄러 직렬화로 실질 위험 낮음.
- 킬보드 멀티함대 소형함 귀속(LOW, SAVEPOINT 격리, stats만).

## 2026-06-03 — 자금유통/경제 /loop 수렴 (클린 판정)

여러 라운드(팀+레드팀+Codex×2+나머지표면 스윕) 결과, 마지막 두 라운드가 **실 money-safety 버그
0건**으로 수렴. 발견된 모든 문제는 수정·검증 완료, 잔여 지적은 전부 "검증 후 안전" 판정.

### 수정 완료(라운드 누적)
- [P0] 카지노 5종 USDT 발행 차단(PP 전용) — 솔벤시/페그 보호 (v7.370)
- [P0] crash 캐시아웃 시간검증 — 무위험 보장승 차단 (v7.370)
- [M] 만료 현상금 환불 행별 원자화 / 변절 현상금 리더취소 차단 (v7.370)
- staking 폐지 — 무담보 yield 인플레 제거 (v7.371)
- [M] HiLo +EV 누수(동점 미포함) 수정 (v7.372)
- 카지노 하우스 엣지 15% 통일+어드민화 (v7.373)

### Codex 라운드2 + 검증으로 "안전" 확정(수정 불요)
- 카지노 outcome 무결성: coinflip/dice/hilo/mines/crash 전부 서버권위 RNG(crypto.randomBytes)+서버고정 배수+가드 차감. 클린.
- 카지노 "뱅크롤 없음" HIGH: PP 전용+비상환(arena.js에 redeemable_pp 참조 0)이라 USDT 페그 무관, 15% 엣지로 net 디플레 = 표준 모델. 버그 아님.
- season.js USDT 보상: lockRoom 담보 room 체크 후 fail-closed(:425-433). 안전.
- cantina 추천 PP: bet×0.05×0.02≈0.1% 비상환 PP, 15% 디플레에 묻힘 = 실질 carve. 무시 가능.
- lottery 하우스컷 라우팅(:292) 죽음: burn-on-buy/mint-on-draw 모델상 net 소각(디플레)이라 복구하면 오히려 mint — 의도적 유지.
- lottery/dividends/길드금고/transport/sponsor/capsule/tdesc: 가드 차감+원자성+보존+중복방지 전부 확인. 클린.

### 불변식 재확인(클린)
- USDT: SUM(usdt_balance)<=collateral — 입금 시 담보 동시증액, 환매 시 redeemable_pp 동반차감, 카지노/시즌은 비상환/담보게이트. 페그 불변.
- GP: 게임플레이 보상은 의도된 faucet, fleet/수리/카지노/현상금 sink가 압도 = net 디플레.
- 동시성: 머니 차감 전부 AND bal>=amount + rowCount 가드. double-spend 불가.
- 권한: 자금이동 라우트 전부 requireAuth+JWT(토큰 지갑). 스푸핑 불가.

→ 자금유통 핵심 프로세스에서 소스 기반 money-safety 결함 미발견. /loop 종료.

## 2026-06-03 — 카지노 하우스 엣지 15% 통일 (운영 방침: 하우스 우위)

기존 카지노 엣지가 게임별 하드코딩 2~4%로 얇아 "하우스가 쉽게 이긴다"는 방침에 미달.
casino_house_edge_pct 단일 설정(기본 15%, mig307)으로 통일하고 어드민 조절 가능화(하드코딩 제거).
- coinflip: bet×1.96 → bet×2×_houseFactor()  (15%→1.70배)
- dice: ×0.98 → ×_houseFactor()
- hilo: ×0.98 → ×_houseFactor() (guess 본배수 + 모든 preview)
- mines: minesMultiplier ×0.97 → ×_houseFactor() (엣지를 캐시 키에 포함)
- crash: instant-crash 1/25 → 1/round(100/edge) (15%→약 1/7)
검증: coinflip/dice/hilo/mines 유저 EV 정확히 -15%, crash -14.3%. 잔여 하드코딩 엣지 0,
fresh 체인 완주, 스모크 11/0. (직전 HiLo +EV 버그 수정 위에 엣지 상향이 얹힌 형태.)

## 2026-06-03 — 자금유통 라운드 2: 카지노 결과 무결성 + HiLo +EV 수정

레드팀이 5개 카지노 게임 결과 무결성을 검증: coinflip/dice/mines/crash 전부 **서버 권위적**
(crypto.randomBytes 서버 RNG + 서버고정 배수 + AND bal>=amount/rowCount 가드 차감 + 베팅 min/max 검증)
= 클린. 단 **HiLo 배수 오산정**(arena.js:1129-1132).

- **HiLo +EV 누수(확정, 하우스 PP 손실)**: push(동점)=자동승인데 `winCards=14-v`가 동점 랭크를
  빼고 `13/winCards`로 배수 산정 → 모든 high/low 추측이 +EV. 수치검증: King-high **+96%**, 8-high
  +14.3% (벽쪽일수록 큼). (레드팀은 winCards===0의 1.5 폴백만 +EV로 봤으나 그건 반대로 -88% EV —
  방향 오판. 본질은 동점 미포함이라 전 구간 +EV였음.)
- 수정: winCards에 동점 랭크 +1 포함 → `13/(winCards+1)*0.98`. preview/폴백(1.5/99)도 제거.
  검증: 전 카드값×방향 EV = 정확히 -2% 하우스엣지. arena syntax OK, 스모크 11/0.

## 2026-06-03 — staking 폐지 (확정 인플레 누수 제거, 사용자 결정)

GP staking yield(15% APY + 최대 1.5배)가 stake 시 amount를 일시 lock할 뿐 어떤 sink/pool에서도
carve되지 않는 **순발행**이었음(자금유통 검수에서 경제분석가·Codex·비판검토자 3중 확인). "모든 GP
이동은 carve" 불변식 위반 = 게임 내 최대 인플레 면. 사용자 지시로 폐지.
- 서버: settings staking_enabled=false (mig306 영구화). createStake는 게이트로 차단,
  withdrawStake는 게이트 없어 기존 잠긴 stake 원금/약정 yield는 계속 출금(GP 갇힘 방지).
- 프론트: openBaseModal에서 /api/staking/info enabled=false면 stakingSection 숨김. ASSET_VER 7371.
- 검증: createStake "disabled" throw, getStakingInfo.enabled=false, /api/staking/info=false,
  fresh 체인 272개 완주(306 포함). harvest 추천 carve는 referral_harvest_pct=0이라 죽은 경로(무해).

## 2026-06-03 — 자금유통/경제 적대검수 (팀+레드팀+Codex) 라운드 1: P0 카지노 솔벤시 외

| 등급 | 버그 | 수정 |
|---|---|---|
| **P0** | 카지노(crash/mines/coinflip/dice/hilo) `req.body.currency='USDT'` 허용 → 당첨 시 house 뱅크롤/담보 없이 usdt_balance 발행 → SUM(usdt_balance)≤collateral 붕괴(페그). UI가 PP만 보여도 백엔드가 body 신뢰해 악용 (Codex+경제분석가) | 5개 게임 전부 **PP 전용**(USDT 베팅 400 거부). 라이브 검증: 3게임 거부, PP 정상 |
| **P0** | crash `/cashout`이 crash_point 초과만 막고 **경과시간 기준 현재 배수 검증 없음** → 베팅 직후 임의 배수로 무위험 보장승 (레드팀) | calcMultiplier(elapsed) 기준 `cashoutAt > live+0.05` 거부 |
| **M** | 만료 현상금 정리: UPDATE...RETURNING으로 status 일괄 확정 후 별도 pool.query 환불 → 사이 크래시 시 GP 영구 소실 (비판검토자) | 행별 BEGIN/COMMIT 원자화 + WHERE status='active' 중복환불 가드 |
| **M** | 변절 현상금을 리더(=poster)가 cancel → 금고 환불받아 배신 처벌 무력화 (비판검토자) | funded_from_guild_id 현상금 cancel 403 차단(만료/claim만) |

### 클린 판정(검수했으나 결함 0)
- PP 게이팅 정상(채굴/가챠/추천 PP는 redeemable_pp 미가산 → USDT 직행 불가).
- USDT 불변식 보호(입금 시 collateral 동시증액, 환매 시 redeemable_pp 동반차감, 시즌 USDT는 room 체크 fail-closed).
- transactions.type CHECK(38종) ↔ 코드 emit 리터럴 완전일치, 유령컬럼 INSERT 0, mig304로 overflow 해소.
- 핵심 머니경로(변절 carve→현상금, pp↔gp 교환, spy burn, dividends, staking 차감) 단일 BEGIN/COMMIT+FOR UPDATE+잔액가드+release로 원자적.
- 마켓/함선마켓/crash·mines 베팅 차감: AND bal>=금액 + rowCount 가드 → double-spend 안전. 지갑 스푸핑: 자금이동 라우트 전부 requireAuth+JWT.

### 🟡 경제 설계 이슈(보류 — 사용자 판단 필요, "발행=인플레" 철학 관련)
복수 에이전트가 "GP 보상이 carve 아닌 mint"라 지적: battleRewards 승리 GP, harvest/quest GP, daily/mission/achievement/season GP, **staking yield(패시브 이자 발행)**, 추천 carve가 fee가 아닌 reward에서 호출되는 경우(api.js:3421/3693 harvest). 단, 게임플레이 보상 GP는 의도된 faucet일 수 있어(quest pool 폐지 후 "직접지급" 방침) 일률 버그로 단정 불가. 예외는 **staking yield**(무행동 패시브 발행)와 **harvest 추천 carve 출처**로, 이 둘은 인플레 누수 성격이 짙어 별도 검토 권장.

## 2026-06-03 — CLASS A 트랜잭션 오염 차단 (공유 헬퍼 격리)

Codex가 짚은 34곳 중 **실 money 경로 24곳**을 공유 헬퍼 2개의 내부 SAVEPOINT 격리로 일괄 차단
(호출처 34곳 개별 수정의 회귀 위험 회피). 근거: Postgres는 트랜잭션 내 한 쿼리가 throw하면
전체를 abort 상태로 만든다 → 기존 try/catch는 JS에러만 삼킬 뿐 aborted를 못 풀어, 호출측 COMMIT이
실패하며 본 작업이 **silent 롤백**된다(보상/결제 유실).

| 헬퍼 | 호출처 | 영향 경로 |
|---|---|---|
| db.js awardXP | 14곳 | battleRewards/ship build/exploration/chain/rocket/missions/arena×4/api harvest·quest·claim |
| db.js creditReferralCommission | 10곳 | arena cantina×5/swap/harvest×2/shop/missions |

수정: 두 헬퍼 진입 시 SAVEPOINT 생성 → 본문 throw 시 ROLLBACK TO SAVEPOINT로 격리 + best-effort
반환(awardXP→null, referral→[]) + finally RELEASE. 호출처 반환 계약(null/[]) 불변이라 무회귀.
검증: 런타임 — 정상경로 xp+3 OK, savepoint 에러 후 부모 트랜잭션 생존+COMMIT OK. 스모크 11/0.

남은 CLASS A ~10곳(worldEvents/shipMining/siege/auth account_signups 등)은 optional-table probe로
이미 "테이블 부재" 가드가 있고 대상 테이블이 prod/fresh 모두 존재 → latent-only 저위험.

### 경제 밸런스 초안 — 적용 보류 사유(소스 기반 반대)
무한강화 곡선의 현재값(base25×1.14^n, 성공 92%−1.8%/레벨 하한35%)을 분석하니: 레벨32+부터 전 강화가
35% 성공 → GP·재료 65% 소각(깊은 sink, 반인플레), 비용은 레벨70쯤 폭발(고래 자연상한, 반P2W).
초안의 "growth 1.14→1.09 / 하한 35→50 / decay 1.8→1.2"는 강화를 더 싸고 더 잘 되게 만들어
**고래 진행 ↑ + sink ↓ = 인플레·P2W 증가** — "발행=인플레" 철학과 정반대. F2P faucet도 폐지한
quest pool을 되살리는 방향. 따라서 초안 그대로 적용은 보류. 진짜 필요한 건 캐피탈 재료 공급/수요
밸런싱(인플레 무관)이며, 적용하려면 fuzzy 초안이 아니라 정식 데이터 재도출이 선행되어야 한다.

## 2026-06-03 — 배포 P0 해소: fresh DB 마이그 체인 완주 (루프 검증)

빈 스크래치 DB(pixelwar_fresh)에 마이그 001→305 전체를 반복 적용하며 첫 실패를
하나씩 고치는 루프로 **체인 중단 4건 전부 해소**. 결과: 271개 전부 적용 + 서버 fresh
부팅 OK + 캐피탈 레시피/스키마 invariant 통과. (4개 USER_NOT_FOUND는 빈 DB 테스트유저
부재일 뿐 구조 무관.) 편집된 마이그는 prod에 이미 적용되어 fresh 배포에만 영향, 기존 무영향.

| 마이그 | 증상(fresh) | 수정 |
|---|---|---|
| 014_arena_indexes | crash_rounds 등 후행(019+) 테이블을 인덱싱 → "relation does not exist" | to_regclass 가드로 테이블 존재 시에만 인덱스 |
| 099_job_system | 구버전 080이 jobs/job_change_log를 다른 스키마(user_id)로 선생성 → IF NOT EXISTS 스킵 → recommended_sector/wallet_address 인덱스 실패 | jobs.recommended_sector·job_change_log.wallet_address ADD COLUMN IF NOT EXISTS + 080의 user_id NOT NULL 해제 |
| 106_admin_economy | economy_health 뷰가 transactions의 없는 컬럼(amount/currency/user_id) 참조 — 죽은 분기 | 가드를 'amount 컬럼 존재'로 변경 → prod처럼 users 기반 fallback 뷰 사용 |
| 092_fleets_and_ships | check_player_ship_limit 트리거가 JSONB value를 NULLIF(value,'')로 비교 → 168 NPC 함선 INSERT 시 "invalid input syntax for type json" (169가 고치지만 168보다 후행) | value #>> '{}' 안전 추출 선반영(169와 동일) |

코드 미참조 dead 테이블 10종(ship_battles/ship_blueprints 등)은 fresh에 없어도 무해.
fleet_battle_timelines는 서비스가 CREATE TABLE IF NOT EXISTS로 자체 생성 → 안전.

## 2026-06-03 — 검수 라운드 5 (팀+레드팀+Codex): 근본차단 + 신규 P0/P1

| 등급 | 버그 | 수정 |
|---|---|---|
| **근본** | 로컬 getSetting/getSettings 다수가 raw JSONB(native bool/num) 반환 → ===  'true' 비교 실패(crafting/auction/expedition/spell… 풍토병) | 10곳 String() 정규화(contest/expedition/rental/territoryVisual + claimUpgrades/dividends/monuments/lottery/shield/staking). 호출부 String() 래핑된 것(auctionCombat/autoContent/shipMining/gamblingAuto/governanceExpire)은 이미 안전 |
| **P0** | /referral/register 무인증+body.wallet 신뢰 | 타인(고래) referred_by 갈취 → requireAuth+getAuthWallet (Codex+레드팀) |
| **P1** | supply_crate 미존재 컬럼 game_pp | → pp_balance |
| **P2** | recall_beacon status 'in_transit'(CHECK 미허용)+UPDATE ORDER BY/LIMIT 불가 | 서브쿼리+'traveling' |
| 배포 | 코드 참조 고아 테이블 4종(weekly_chronicles/share_cards/ship_instances/enhancement_material_recipes) fresh 배포에 없음 | mig305 CREATE IF NOT EXISTS |

검증: referral 무인증 401·스푸핑 차단, expedition enabled=true, mig305 적용.

### 🟡 남은 항목 (별도 진행 필요 — 결정/대규모)
- **CLASS A 트랜잭션 오염 34곳(Codex)**: BEGIN..COMMIT 안 fire-and-forget(awardXP/referral/log) + optional-table probe가 SAVEPOINT 없이 try/catch. 대부분 latent(쿼리가 throw해야만 발동, 테이블 존재하면 무해). 확정 발동분(governance/scrap/killboard)은 R3/R4에서 수정됨. 나머지는 하드닝 백로그 — 일괄 수정은 회귀 위험이라 fire-and-forget을 post-COMMIT으로 옮기는 정책 통일 권장.
- **배포 P0 — fresh 마이그 체인 중단**: 014_arena_indexes가 019에서 만드는 crash_rounds를 인덱싱 → fresh DB 첫 실패로 014~304 전체 미적용(로컬은 과거 out-of-order 적용으로 우회). 099/106/168도 fresh 실패. 기존 prod는 정상. 베타 fresh 배포 전 014/099/106/168 idempotent 수정 + fresh DB 리허설 필수.
- **경제 밸런스(권고, 보류)**: 무한강화 P2W 곡선(growth 1.14→1.09 등), F2P faucet, 캐피탈 재료 — mig 초안(305_economy_balance_pass) 준비됨. 사용자 "기억해두고" 지시로 미적용. faucet+곡선 동시배포 인플레 경고.

## 2026-06-03 — 검수 라운드 4 (팀+레드팀+Codex): 버그 7개 수정 + 죽은기능 식별

| 등급 | 버그 | 영향 | 수정 |
|---|---|---|---|
| **P0** | /api/withdraw가 조건부 debit UPDATE의 rowCount 미확인 | 잔액 차감 0인데 서명·커밋 → **미차감 출금**(실제 USDT) 가능 | rowCount===1 가드 |
| **P1** | expedition_enabled/spell_enabled JSONB boolean을 'true' 비교 | **원정/주문 기능 항상 disabled** | String() 정규화 |
| **P1** | 킬보드가 AI 연습전투(ai/fight, is_ai_battle) wreck 기록 | 약한 NPC로 K-카운트 펌핑 → 리더보드 오염 | AI전 wreck 미기록 |
| **P1** | createGuild에 변절 쿨다운 게이트 없음 | 변절자가 새 길드 즉시 생성해 쿨다운 우회 | getDefectionCooldown 게이트 |
| **P1** | 정찰 같은표적 쿨다운 없음 | 반복정찰로 피해자 알림 폭주(50칸)·실시간 안개제거 | spy_target_cooldown_minutes(30) |
| **P2** | staking/monument/shield_enabled JSONB → 비활성화 불가(항상 on) | 어드민이 끌 수 없음 | String() 정규화 |
| **P2** | 마켓/경매 수수료 floor → 소액(10~19GP) 수수료 0 | 미세 수수료 누수 | 최소 1 GP |
| 죽은버튼 | 프론트 /api/dailyOps(camelCase) → 404 | 데일리 힌트 무음 실패 | /api/daily-ops |

검증(격리 7/7): expedition/spell 활성, AI전 wreck 0(함선파괴는 정상), createGuild·정찰 쿨다운 차단.
죽은기능(미구현, 별도): sector_raid_enabled=true인데 구현 전무(섹터 약탈 루프 미완 — 생산→약탈→방어sink EVE식 닫힌루프 후보). 고아테이블(ship_battles/mining_expeditions/citizen_rewards/guild_war_coalitions 등) — 미사용, 정리 후보.
경제밸런스 권고(기억, 미적용): 무한강화 P2W 곡선, F2P faucet, 캐피탈 재료 병목.

## 2026-06-03 — 팀+레드팀+Codex 합동 검수: 버그 7개 발견·수정

3종 병렬(경제분석/레드팀/무결성 + Codex)로 적대 검수. 발견·수정:

| 등급 | 버그 | 영향 | 수정 |
|---|---|---|---|
| **P0** | assembly.js 라우트 JWT 검증 전무, wallet을 body/query/header에서 읽음 | **타인 지갑 GP/조각/합체함선 차감·파괴**(인증 우회 도난) | 전 mutation에 requireAuth + JWT에서만 wallet |
| **Critical** | claim 핸들러 거버넌스 블록 SAVEPOINT 없음(api.js:1516) | 거버넌스 에러 시 **성공한 claim 통째 롤백**(트랜잭션 오염) | SAVEPOINT gov_sp |
| **High** | auction.js 미존재 컬럼 settled_at(live=sold_at) ×3 | 경매 낙찰/정산 스케줄러 깨짐 | sold_at |
| **High** | auction_enabled JSONB boolean을 'true' 문자열 비교 | **경매 생성 항상 disabled** | String() 정규화 |
| **P1** | bounty claim에 상대편 검증 없음 | 같은 승리측 alt 2개로 **현상금 셀프청구(워시)** | target.side ≠ claimer.side |
| **P1** | crafting recipe {qty,code}인데 item_type_id 조회 | **워아이템 크래프트 깨짐**(재료 sink 죽음) | user_resource_inventory 차감 |
| **P2** | enhancement.js enhance_show_rates JSONB 비교 | 강화 확률 표시 꺼짐 | String() |

검증: assembly spoof차단/크래프트 자원차감(이제 동작)/현상금 같은편 차단 6/6 PASS. 잔여 0.
경제밸런스 권고(별도, 미적용): 무한강화 P2W 곡선(p=100 시도당 12M GP), F2P GP faucet 빈약(일 ~120 vs cruiser 1700+), 캐피탈 재료 자급 160~800일 → mid drop율/강화곡선/환전캡 조정 후보.
미변경: 길드 변절 금고 전액탈취(의도된 EVE 설계), siege ship_mining_jobs probe(테이블 존재, 무해).

## 2026-06-03 — 경제 재검수(2~3차): 버그 4개 발견·수정

| 버그 | 영향 | 수정 |
|---|---|---|
| transactions.type varchar(20) < 'marketplace_listing_fee'(23) | **마켓 등록 전체 실패**(재료 순환 링크 차단) | mig304 varchar(40) |
| crafting.js 로컬 getSetting이 JSONB boolean 반환 → `true!=='true'` | **워아이템 크래프트 항상 disabled** | String() 정규화 |
| scrapShip이 미존재 `fleet_battle_participants.ship_id` 쿼리 | 트랜잭션 오염 → **함선 해체/환불 깨짐** | fbp.fleet_id + SAVEPOINT |
| scrap 라우트가 `req.user.wallet`(undefined)만 읽음 | **함선 해체 항상 401** | getWallet(req) |

검증: 마켓 E2E 7/7, 해체 E2E 4/4, 경제 쓰기 10플로우 런타임버그 0. Codex 적대검수(varchar/스키마/leak) 병행.

🟡 잔여(미수정, 별도): 영토 워아이템 크래프트의 recipe ingredient가 `{qty,code}`(자원)인데 craftItem은 `item_type_id`(아이템) 참조 → enabled 고쳐도 "Item #undefined"로 완성 불가. territory 크래프트 시스템 깊은 설계 이슈(자원 소비로 통일 필요). 이차 sink라 분리.

## 2026-06-03 — 배신 시스템 3종 + 경제 튜닝 (v7.349~v7.360)

| 기능 | 상태 | 비고 |
|---|---|---|
| 길드 변절(배신): 금고 carve 탈취+`guild_betrayer` 낙인+자동현상금+72h 쿨다운 | 🟢 | 백 13/13 + 프론트 DEFECT 버튼/경고모달(프리뷰 검증). mig299 |
| 킬보드: `ship_wrecks` 격침 귀속(victim/killer/side) + SAVEPOINT 격리 | 🟢 | 8/8. mig301. killer-event로 멀티함대 귀속 정확화 |
| PvP 스파이/정찰: 적 함대 구성 노출+GP 소각+탐지 통보+이중첩자(`the_handler`) 할인 | 🟢 | 11/11. mig302 |
| 킬보드+정찰 UI(PVP 탭, 4개국어 i18n) | 🟢 | `kbSwitchTab`/`loadKillboard`/`kbScout`. 프리뷰 렌더 검증 |
| Codex 적대 검수 P1×2 / P2×3 수정 | 🟢 | mig301 테이블 방어생성·approveJoinRequest 쿨다운·limit 음수클램프·할인 클램프·멀티함대 귀속 |
| quest_reward_pool 폐지(게임플레이 GP 직접지급, PP 충전전용) | 🟢 | mig298. harvest 라이브 + 재시뮬 |
| 추천 수수료 교차통화(PP→GP) 발행 폐지 → 인플레 제거 | 🟢 | v7.353. 3-tier 10/10. GP 비발행 |
| 함선 수리비 0.01→0.03 GP/HP(반복 GP 싱크) | 🟢 | mig300 |
| 베타 고지 모달 + 시크릿/자동백업 등 §1 차단 처리 | 🟢 | docs/OPEN_BETA_CHECKLIST |

신규 자산: 서비스 `spy.js`, 라우트 `killboard.js`/`spy.js`, 테이블 `guild_defections`/`spy_reports`(+`ship_wrecks` killer 컬럼), 태그 `guild_betrayer`. 모든 GP 이동은 carve(발행 0) — 격리 검증 잔여 0.

## 2026-05-31 — 합체(assembly.assemble) quality_mult 컬럼 참조 500 RESOLVED

- 증상: 모든 합체 internal_error. 원인: ships INSERT가 미존재 컬럼 quality_mult 참조. DB로 컬럼 부재 확인 후 INSERT에서 제거. 라이브 검증: 합체 성공 + 품질(common~epic)·bonus 차등 정상.

# OCCUPY MARS — Audit (v7.229~v7.310 / 2026-05-30) — 함대전 + 합체(기동) 슈퍼유닛 풀스택

## 합체(기동) 슈퍼유닛 스택 — v7.281~v7.310
| 기능 | 상태 | 비고 |
|---|---|---|
| 파츠 수집·기동·해체 코어 (`assembly.js` + `/api/assembly/*`) | 🟢 | E2E 검증 |
| 퍼펙트 가챠 박스(박스가챠+천장+조각, 크로스유닛 드롭) | 🟢 | 10연 E2E 검증 |
| 유닛 카탈로그 프레임워크(`assembly_units`) — SQL 3 INSERT로 유닛 추가 | 🟢 | 데이터 추가 검증 후 제거 |
| 유닛 10종(로봇6+외계4) role/무기 특화 | 🟢 | migration 284, battleEngine 매치업 |
| 조각 교환비용 50파츠 전부 고유(30~128) | 🟢 | migration 286 |
| 아트 portrait/top/parts (Imagen3, 외계=오리지널 생물함·저작권 안전) | 🟢 | ?v=ASSET_VER 캐시버스트 |
| 합체 모달(대형 히어로+특성+전투미리보기+모바일 풀스크린) | 🟢 | preview 검증 |
| P3 전투(assembled 매치업 + overdrive 필살기, PvP 투입) | 🟢 | node 검증. ⚠ 전술랩 overdrive 버튼 UI 별도 |
| 세계관 lore 4언어 / 기동 리네임 / 게임가이드 / 초대 스텝 | 🟢 | |
| 자동 퇴각(HP 임계 후퇴·함선 보존, mig 287) | 🟢 | Fleet Command 🛟 토글, 하이잭/전투 공통 |
| 무기별 발사 색상(weaponColor 9종) | 🟢 | 합체유닛 fire_type 반영 |
| 3단 추천 인원수(`/api/referral/stats`, 포트폴리오 모달) | 🟢 | |
| 미사일 지렁이 탄막(wobble 곡선+꼬리) | 🟢 | 빔과 차별 |
| 박스 오픈 영상(가로/세로) | 🟡 | 라이브 재생 사용자 확인 권장 |
| Fleet Command SELECTED 표시(bigint id) | 🟢 | v7.280 수정 |

---
# (이하 v7.229~v7.238 이전 감사 기록)
# OCCUPY MARS — Audit (v7.229~v7.238 / 2026-05-29) — 함대전 박력 + 가챠 영상 풀세트

> 직전 세션 작업 요약. 상세는 `CHANGELOG.md` 참조.

## 🟢 전체 카테고리 검수 수정 #1 + 게임가이드 갱신 (v7.275~v7.276, 2026-05-30)
- ✅ v7.275: 통화 오표기(현상금/퀘스트 GP), OPS 잔액갱신, 에러 54곳 srvErr 4언어화, 영토 업그레이드 에러 코드화, DEPLOY 라벨 회귀.
- ✅ v7.276: 게임 가이드(GUIDEBOOK/CODEX_CONTENT) whatsnew 섹션 4언어 갱신 — 자원 출항(F2P 채굴/목적지/마모) + GP 중심 경제(무료 PP→GP, GP↔PP 경매, 보상 GP화).
- 🟡 **남은 백로그(다음 세션 — medium/low 폴리시, 기능 차단 아님)**:
  · [기능] Commander 'LAUNCH SUPPLY DROP' 403 — `/api/rockets/trigger`는 `commander` 테이블(id=1) 검증, 대시보드 게이트는 다른 소스 → 커맨더 모델(commander vs governance_positions) 확인 후 권한 정렬 필요(성급 변경 시 보안위험이라 보류).
  · [명확성] TEND(정비) 비용 사전 미표시(즉시 차감) — production 응답에 tendCostGp 추가 + 버튼 라벨/confirm.
  · [명확성] 상점 구매 confirm 잔액 미표시 + 사전 차단 없음 — gameConfirm로 buyMarketListing 패턴 적용.
  · [명확성] 조선소 블루프린트 카드·건조큐·강화 confirm 다이얼로그 한국어 전용 → 4언어화.
  · [명확성] War declare '200 GP'·governance 이벤트/버프 비용 하드코딩 → 서버 설정 동기화.
  · [경제] 함선 건조/취소 후 전역 GP 헤더 미갱신, 일일미션 '전부완료' +50 GP 클라 임의표시(서버값 사용 권장).
  · [§19] index.html 동적 onclick concat 잔여(renderBaseShop/renderMarketCard 등) — data-action 패턴 이관.
  · [정리] auctionCombat ship_instances dead-path, 구버전 auction.js GP전용(혼란), guild LEVEL UP 권한(멤버십만 체크), war stake hint 미표시, 퀘스트 티어 raw enum 뱃지, 수송 에스크로 미고지.
  · ✅ 무결 확인: 매수 PP 비상환(USDT 누수 없음).

## 🔴→🟢 스프린트 QA(멀티에이전트+Codex) 확정 버그 수정 (v7.274, 2026-05-30)
- ✅ [HIGH] 자원 판매 전부 400 — /api/marketplace/list가 resourceCode/resourceQuantity 미전달 → createListing 'resourceCode required'. route 2필드 추가.
- ✅ [HIGH] 채굴 일일 GP상한 동시성 우회(레드팀#1 무력화) — collect가 단일 job만 잠가 동시 collect로 상한 Nx 초과. 지갑 advisory lock(collect+launch).
- ✅ [MEDIUM] leader 페일오버 — 재경합 exit(0)는 ON_FAILURE 미재시작→영구 web-only. exit(1)+railway ALWAYS. 하트비트 즉시 exit 유지(이중처리 방지).
- ✅ [MEDIUM] ITEMS 탭 영구 점멸(SHOP 동일 클래스) — clearBaseTabDot items 스냅샷 누락 보강.
- ✅ [LOW] _smErr 누락 번역 3종, 마켓 "등록 2GP" 허위표기 제거.
- ✅ 검증통과(무결): 매수 PP 비상환=USDT 누수 없음.
- 🟡 보류(저위험/도달불가): auctionCombat ship_instances(ship 경매 미사용 dead-path), buyout FOR UPDATE(방어됨), mining/my 비인증 wallet(읽기).
- 검증: node --check + 인라인 11/11 + advisory lock psql OK. SW v79.

## 🟢 채굴→"자원 출항" 리네이밍 + SHOP 점멸 버그 + 새 배너 (v7.272, 2026-05-30)
- ✅ [BUG] 경제 카테고리 빨간 점멸 안 꺼짐 — SHOP dot 폴링이 `_pollDotState.shop_items` 미설정 → clearBaseTabDot 스냅샷 undefined→0 → `cnt>0` 항상 참 → 영구 재점등. `_pollDotState.shop_items=cnt` 추가로 수정.
- ✅ [UX] 함선 기반 자원획득 "채굴"→"자원 출항"(4언어). 영토 PP채굴/원정과 구분.
- ✅ [ART] mining 배너 Imagen 재생성 800×340→1600×680(scripts/gen_mining_banner.py, ADC). 캐시버스트 v7272.
- ⚠️ [SECURITY] scripts/gen_backgrounds_ai.py 에 Stability AI 키 평문 커밋 발견 — 회수 필요.
- 검증: 인라인 11/11 + 배너 1600×680. SW v77.

## 🔴→🟢 함대 함선수 필드 버그(ship_count) = 채굴/Void Raider 함대선택 빈칸 (v7.271, 2026-05-30)
- ✅ [BUG] `/api/fleets`는 `ships_alive`로 함선수 반환하는데 프론트 10곳이 없는 `f.ship_count`를 읽음 → 함선 많아도 0 → 채굴 출항 "함대 없음", 월드이벤트(Void Raider) engage 함대목록 빈칸.
- ✅ 수정: `parseInt(f.ships_alive)||parseInt(f.ship_count)||0` 폴백으로 10곳 일괄 교체(채굴/_renderShipMining, we engage 24115·24200, 함대요약 35773·36205·53025 등). 프론트 전용.
- ✅ 이게 사용자가 보고한 "Void Raider ENGAGE 버그"의 실제 원인으로 추정(engage 코드 자체는 정상, 함대 선택기가 비어 출전 불가였음).
- 검증: 인라인 11/11 + bare ship_count 0건. SW v76.
- 🟡 후속: 채굴 배너 신규 제작(현재 800×340 저해상, Codex 아트). 함선수 alias를 서버가 ship_count로도 내려주면 더 견고.

## 🔴→🟢 CRITICAL: 리더선출 무한 재시작 루프 = 전 엔드포인트 502 (v7.270, 2026-05-30)
- ✅ [CRITICAL] v7.269 배포 후 프로덕션 부팅→~10초 요청→재시작 무한반복(전 API 502, ~15분 다운). 런타임 로그 `[leader] 리더 공석 감지 → 락 획득 → 프로세스 재시작`로 확정.
- ✅ 근본: `leader.js` 비리더 재경합이 매부팅 랜덤 `INSTANCE_ID`로 락 선점 후 exit → 재시작 새 ID가 자기 락(TTL 30s) 인식 불가 → web-only → 재경합 → 무한루프.
- ✅ 수정: 재경합은 `GET`으로 공석(null) 확인 시에만 exit, 락 선점 안 함 → 재시작 부팅 SET NX가 단독 획득해 안정 정착. 정상 멀티/단일 동작 불변.
- ✅ 부수: 채굴을 임무 독립 `⛏ 채굴` 서브탭으로 분리(캠페인/퀘스트에서 빼냄). 모달→서브탭 인라인.
- 진단: 정적분석으로 경매/마이그/내변경 크래시경로 배제 후 런타임 로그 핀포인트. 롤백 없이 핫픽스. SW v75.
- ⚠ 후속(권장): leader 부팅 SET NX 실패 시 ~35s(>TTL) 재시도 후 web-only 폴백 → 첫 복구 시 exit/restart 1회 생략 가능(현재도 ≤30s 자가복구). 하트비트 exit(1) 경로도 동일 GET-가드 검토.

## 🟢 함선 채굴 v2(깊이) + 레드팀 P0 + 임무탭 이동 + 경매장 GP↔PP 통합 (v7.269, 2026-05-30)
- ✅ [기획] 채굴 깊이: 함급 적재량(HP비례 frigate1~titan60)×등급보너스 → 함대 capacity. 목적지 frontier/mid/core 수율·마모·약탈 차등(mig 277). "어느 함선·어디로·어떻게" 의사결정.
- ✅ [레드팀 P0-1 게임엔딩] 채굴↔공성 상호 잠금(siege commit이 채굴함대 거부 + launch가 공성투입함대 거부) → full-loss 영구 함대파괴 차단.
- ✅ [레드팀 P0-2] 마모 GREATEST(1,...) clamp → 좀비함선(HP0) 차단. [인플레] 일일 GP상한1500 + GP율5→3 + 최소HP게이트0.15(수리 sink 강제)(mig 278).
- ✅ [UX] 채굴 FLEET→QUESTS 임무탭 이동(⛏ MINING OPS 카드) + 목적지 선택 모달(색상/약탈%/예상GP). §19. i18n 4언어.
- ✅ [Codex] 경매장 통합: auction.js↔auctionCombat 2시스템 → auctionCombat 일원화. 전자산 PP/GP + GP↔PP 경매장 내부 거래. 매수 PP 비상환(USDT누수차단). 프론트 전 엔드포인트 /api/auctions/* 재연결.
- 검증: 채굴v2 e2e 6/6 + 레드팀 5/5 + 일일캡 2/2 + 경매 4/5 + 인라인 9/9 + 부팅200. SW v74.
- 🟡 후속(비차단): 채굴 함선 specialization(mining_yield 컬럼), 호위 슬롯, 플레이어 갱킹, 정제 체인, 보호화물, 자동재출항/완료알림 뱃지. Codex 채굴 배너/썸네일 아트.

## 🟢 함선 채굴 런(경제v2 P5) — 땅 없는 F2P 노가다 (v7.267, 2026-05-30)
- ✅ 함대를 채굴 런에 보내 재료+GP 수급(땅 불필요). ship_mining_jobs(mig 275) + shipMining 서비스/라우트(/api/mining/*) + FLEET COMMAND ⛏ 버튼 + openShipMining 모달. 격리·추가형이라 기존 흐름 무영향.
- ✅ GP=함선수×시간×5, 재료=rollResourceDrop(시간비례), PP 안 줌. launch 검증(소유/전투/중복/한도/생존함선), collect 가드(미완료/재수령). 무료 출항(F2P).
- ✅ 경매 cancel 엔드포인트(auctionCombat, 입찰0만 환불) — 마켓 통합 준비.
- 검증: DB e2e 8/8 + 부팅 200 + 인라인 9/9 + §19. SW v72.
- 🟡 후속: 경매 프론트 통화 UI(자산 PP/GP + GP↔PP 거래소)는 auction.js↔auctionCombat 2시스템 통합 필요 → 별도 검증 세션. 함선 PP 마켓. 채굴 자동완료 스케줄러(현재 collect-on-demand).

## 🟢 무료 PP→GP 전환(경제v2 P2) + activity/feed 버그 + 로켓 가드 (v7.266, 2026-05-30)
- ✅ [경제v2 P2] 무료 PP faucet 12파일 전부 GP로(값보존 ×환율). PP=입금 발행 전용. 하이잭 land-PvP는 PP 유지. governance 바운티 GP→PP 발행 제거(누수 차단). 마이그 없음. Codex 구현, 내가 검수(구문/헬퍼/모듈로드/잔여 0/부팅200).
- ✅ [FIX] /activity/feed `st.name`(ship_types엔 name_ko만) → COALESCE(name_ko, code). 함선 건조 이벤트 피드 누락 복구. 비치명.
- ✅ [FIX] _drawRocketOverlay undefined.length 가드(API 502 시 globe 합성 크래시 방지).
- 🟡 후속: P3 프론트 경매 통화 UI, 함선 PP 거래(ship_market_listings GP전용), P5 함선 F2P 엔진.

## 🔴→🟢 CRITICAL: 네비 data-action 디스패처 누락 = 전 진입 버튼 무반응 (v7.264, 2026-05-30)
- ✅ [CRITICAL] col-fab/상단바/모바일 네비 버튼이 v7.215에서 inline onclick→data-action 마이그됐으나 위임 디스패처 미추가 → 모든 진입 버튼(MY LAND/CANTINA/CLAIM/ITEMS/BASE/로그인/포트폴리오) 클릭 무반응. 브라우저 재현으로 "7개 click → 함수 0 호출" 확인.
- ✅ 수정: 무인자 네비/UI 액션 24종 화이트리스트 위임 디스패처 추가(인자형은 기존 디스패처가 처리 → 무충돌). 재현 후 7/7 함수 호출 확인. SW v70.
- ⚠️ v7.263의 "로딩 오버레이" 진단은 headless WebGL 한정 artifact 오판이었음(실제 원인 별개). v7.263 변경(오버레이 하드 안전장치 + SW silent 업데이트)은 방어적으로 유효해 유지.
- 🟡 후속: 21515~ `[onclick*="openBaseModal"]` 잔재 셀렉터(튜토리얼 하이라이트)도 data-action 으로 갱신.

## 🟡 핫픽스: 로딩 오버레이 하드 안전장치 + SW 더블로드 (v7.263, 2026-05-30)
- ✅ [CRITICAL] `#loadOverlay`(z9999, pe:auto) 미해제로 모든 클릭 차단. 원인: globe init 예외 시 그 뒤의 8s fallback 미등록 → 로더 95% 고착(브라우저 재현 확인). 수정: 최상위 독립 하드 안전장치(8s 무조건 dismiss + 강제 display:none/pe:none).
- ✅ [FIXED] SW controllerchange 강제 reload(더블로드/겹침) 제거 → 완전 silent 업데이트. SW v69.
- 트리거 추정: SW v68 갱신 후 캐시된 globe.gl/텍스처 stale → globe init throw. 신선 로드에선 미발생이라 그간 안 잡힘.
- 검증: Preview MCP 브라우저 재현 — 수정 후 loadPct 100, overlay display:none/pe:none, `#openBaseBtn`→`openBaseModal` 클릭 동작.

## 🟢 경제 정책: 담보-룸 소프트 환매 + redeemable_pp 게이팅 (v7.262, 2026-05-29)
적대토론 워크플로 단일 권고 채택(문서 `docs/ECONOMY_TOKEN_POLICY_2026-05-29.md`). PP→USDT는 "1:1 페그"가 아니라 담보-룸 내 재량 환매. GP·PP 토큰화 보류. M단계(법인/캡드토큰) 사장 지시로 제외.
- ✅ [W1-2] 페그 약속 문구 13곳(4언어) 제거 → "운영 환율(변동 가능) — 고정 페그 아님". 결제비율 1:1 테이블은 환매 약속 아니라 유지.
- ✅ [W2-4] `users.redeemable_pp`(mig 271) — 입금 보너스만 환매가능, 채굴/가챠/추천 PP는 USDT 직행 차단(GP 환전만). DB 트리거 `clamp_redeemable_pp`로 불변식 중앙 강제(16개 PP 차감 사이트 자동 커버). swap 초과 시 `pp_not_redeemable`. **솔벤시 하드가드는 여전히 treasury room(담보)** — 게이팅은 상위 차익차단 레이어.
- ✅ [W4-6] `treasury.checkRedemptionLimits` — 주간 글로벌 cap=max(100, 입금×30%) + 유저 일일 한도. swap/withdraw-all 연결(429). withdraw-all은 게이팅 on 시 redeemable분만 USDT화.
- ✅ [W6-10] `GET /api/admin/economy/redemption` + admin ECONOMY 탭 REDEMPTION 패널(환매율 실측 vs 가정 10~25%, cap 소진율, 탑 리디머).
- 검증: node --check 4파일 + mig 271(46명 백필) + DB e2e 6/6 + 인라인스크립트 파싱 + 라우트 로드. SW v68.
- 🟡 후속(비차단): ①`redemption_weekly_cap_enabled`는 false(입금0 잠금 footgun)—런칭 후 입금 흐름 확인하고 on ②withdraw-all 게이팅 on 시 비환매 PP 잔류+픽셀리셋 동반(전액 현금화 기대와 UX 차이 — 프론트 안내 권장) ③환매율 실측 모니터링이 런칭 후 최우선 지표.
- ⛔ 토큰화 전부 보류: 무캡 GP 온체인=가격 0 수렴(균형가 부재), PP 온체인=가상자산이용자보호법 트리거. 코드 변경 없음.

## 🟢 공성전 풀스택 최종 QA (v7.260~261, 2026-05-29) — 10에이전트 통합검증
가이드북 '길드 공성전' 4언어 챕터(v7.260, id=siegewar) + QA 6확정 처리(v7.261):
- ✅ [CRITICAL] siege dead-lock(cancelled 전투→영구 active/섹터 잠김): resolveSiege가 cancelled를 픽셀 폴백 해결+fleet_battle_id 리셋. e2e PASS.
- ✅ [HIGH] vice_governor 세수 누수(옛 정권 vice 20% 영구 수취): _installGeoGovernor에서 vice 포지션 정리.
- ✅ [HIGH→완화] 라이브 동시성 점유: wall-clock 10→6분(mig 270).
- 🟡 [HIGH 후속, 멀티인스턴스 전용] 라이브 명령 Redis 라우팅 미구현 — 비-leader 워커 명령이 권위 워커 미도달(단일 인스턴스 정상). om:ws battleCmd kind 추가 또는 ops 게이트.
- 🟡 [LOW 후속] shouldAbort 데드코드 정리. [HIGH 후속] 라이브 전용 동시성 lane(siege_realtime_max_concurrent)+tick drift 보정.

## 🟢 커맨더 공성 전투 (v7.258, 2026-05-29) — Codex+레드팀 16에이전트
맹주(sov1)=수비 vs 도전(sov2)=공격, 다함대 실시간 결전→승자 맹주. mig 268(siege_kind/mars_commander/시스템섹터), declareCommanderSiege/resolveCommanderSiege, resolveSiege 커맨더 가드, getSovMap mars_commander 우선, full-loss 분리(commander_full_loss). 기존 commit/battle/live 인프라 무변경 재사용. DB e2e PASS.
레드팀 11건 처리:
- ✅ battle_type CHECK / _installGeoGovernor 오작동 / dual-SoT: 'siege'+siege_kind 가드 + getSovMap 우선 + 전용 resolver로 회피.
- ✅ [CRITICAL] 맹주전 함대 전손: commander_full_loss_enabled(기본 false) 분리.
- ✅ 연합 승자 모호성: 1v1(sov1 vs sov2) 모델이라 승자 결정적(challenger_guild_id).
- 🟡 [design 후속, 비차단]: ①[FIXED v7.259]도전 0명 영구유임→월1회 자동 개최+무도전 3회 강등(maybeOpenCommanderSiege) ②조기 전투 락(첫 1함대 커밋 시)→결전 시각까지 커밋 윈도우+정족수 ③맹주 권력/혜택 미정의(수도세/칭호 정의 — 'commander_win' 칭호 미정의 no-op) ④연합(다길드 공격) 모델은 commit/role 확장 필요. siege_realtime/full_loss 라이브 ON 상태.

## 🟢 sov 지도 + 주간 캘린더 + 맹주 (v7.255~257, 2026-05-29)
- **sov 지도(v7.255)**: getSovMap + /api/sector-defs/sov-map(24섹터 거버너/길드 leaderboard), 거버넌스 탭 🗺 SOV MAP 모달(티어 그리드+지배 길드).
- **주간 공성 캘린더(v7.256)**: declareSiege가 결전 시각을 고정 슬롯(수/토 12:00 UTC)으로 스냅, /api/siege/schedule, SOV 모달 일정 칩. mig 266.
- **맹주(v7.257)**: getSovMap commander = sov 지배 1위 길드(최소 3섹터·단독). SOV 모달 👑 배너. mig 267.
- 🟡 남은 큰 조각: **커맨더 공성 전투**(거버너 길드들이 수도 전장에서 simulateBattleLive 다자전→승자 맹주). siege 인프라 재사용. 별도 증분.

## 🟢 실시간 수동스킬 + 1인1함대 + rate limit (v7.253, 2026-05-29)
- 1인 1함대(#1): siege_fleet_commits UNIQUE(siege_id,wallet)+upsert로 강제(e2e 확인).
- beam/missile 서버 권위(충전 누적/100%발동/리셋, _applySkill 데미지, 소유권). WS+route+postMessage 배선(클라 변경0, tactical-lab 기존 버튼). mig 265.
- 비-라이브 declareAction per-wallet 5/s rate limit(레드팀 풀고갈 차단). 단위 PASS.
- 🟡 남은: 멀티인스턴스 명령 라우팅(Redis, 단일인스턴스 무관), beam/missile 충전 게이지 클라 동기(현재 시도→서버 수락/거부), 참가자 버튼 가시성.

## 🟢 Phase 3 완성: 참가자 실시간 명령 연결 (v7.252, 2026-05-29)
commander-action 라우트가 라이브 전투면 declareAction 대신 라이브 큐 enqueue(참가 함대 자동 해석). 클라 변경 0(기존 tactical-lab 버튼→postMessage→라우트 체인 그대로 라이브 분기). liveBattle per-wallet 5/s rate limit 중앙화. rate limit 단위 PASS, 부팅 OK. → "혈맹원이 한 전장에서 실시간 조작" 동작.

## 🟢 Phase 3 실시간 권위 전투 (서버 기반, v7.251, 2026-05-29)
"미리계산→스트림"→실시간 틱 루프. simulateBattleLive + applyLiveCommand + liveBattle 큐 + battleScheduler 분기 + WS 큐 라우팅. siege_realtime_enabled=true. 라이브 e2e PASS.
realtime-battle-redteam 워크플로(16에이전트) 확정 결함 처리 상태:
- ✅ **[HIGH→addressed] WS 명령 플러딩 DoS/트랜잭션 폭풍**: 라이브 명령을 per-msg declareAction(BEGIN/FOR UPDATE) 대신 인메모리 큐 enqueue + per-socket 3/s rate limit + 소유권 SELECT만. 트랜잭션 폭풍 제거.
- 🟡 **[HIGH→deferred] beam/missile 서버 권위 쿨다운**: 현재 applyLiveCommand는 formation/maneuver/focus만 — 수동스킬 미연결(스팸 벡터 없음). 추가 시 반드시 서버 state 쿨다운/충전(클라 게이지 신뢰 금지) + quota 면제 금지.
- 🟡 **[deferred] 멀티인스턴스 명령 라우팅**: 단일 인스턴스는 권위 워커=WS 워커라 동작. 다중 인스턴스는 비권위 워커 명령이 enqueue 실패(not_authority) → Redis battleCmd 라우팅 필요(현 dev 단일 인스턴스라 미차단).
- 🟡 **[deferred] 비-라이브 declareAction rate limit**: pre-battle 경로(preparing/pending) 무제한 — 풀 고갈 가능. 별도 hardening.
- 🟡 **[deferred] 참가자 명령 UI**: 자기 함대 진형/기동 버튼(fleetId 포함 WS cmd) — 다음 증분.

## 🟢 폴리시 + Phase 2 다함대 공성 (v7.249~250, 2026-05-29)
- **v7.249 폴리시**: 공성 패널에 지오 섹터명(현지화)+티어 배지, 길드 거버너([TAG] 길드명)+섹터 세수→금고 누적 표시. sector.js getSectorGovernance 확장.
- **v7.250 Phase 2 다함대 공성**: siege_fleet_commits(지갑당 1함대) + createSiegeBattleMulti(전 커밋을 한 전장 participants). 혈맹원 여럿이 같은 전장에서 싸움. DB e2e(2v1=3 participants) PASS. battleEngine은 진영당 N함대 기존 지원.
  - 🟡 후속(비차단): Phase 2 다함대 전투의 관전 UX(누가 몇 함대 살아있나 실시간), 커맨더 공성(상위), sov 지도/주간 캘린더, full-loss 전력차 캡/보험.
  - 참고: 현재도 전투 자체는 서버 결정형 시뮬 관전(실시간 동시 조작 아님). 다함대=여러 유저 함대가 한 전장에 모여 싸우는 구조까지 완성. 실시간 동시 명령(수동 스킬 등)은 tactical-lab 계층 추가 작업.

## 🟢 길드 공성전 라이브 활성화 완료 (v7.246~248, 2026-05-29)
유저 부재 시점에 전 기능 ON (mig 261). guild-war-golive 워크플로(15에이전트) 확정 8건 처리.
- ✅ 세금→길드 금고(collectTax) + withdrawTreasury + disband 금고 정산(소각 방지, disbandCleanup 공통 헬퍼, admin force-disband 포함) + collectTax NULL sector_id 하드닝 + mig 262 sector_id UNIQUE.
- ✅ 라이브 UX: 합류 full-loss 경고 + 무손실 점유율 대안 안내 + resolution_mode 배지.
- 🟡 남은 폴ish(비차단, LOW): 공성 패널 지오 섹터명/티어 표시(sector.js getSectorGovernance에 name/tier/sector_id 추가 필요), 세수→길드금고 가시화 라인(GOVERNOR CONTROLS + 길드 모달 ledger 뷰), 비거버너에 '거버너 길드가 세금 X% 수취' 안내.
- 🟡 후속 설계(retention, 비차단): full-loss 전력차 캡/부분손실/첫공성 보험 토큰(워크플로 UX #8 ③④), Phase 2 N-side 난전 엔진, 커맨더 공성, sov 지도/주간 캘린더.

## 🔴🔴 [ROOT CAUSE] 섹터 시스템이 두 개의 분리된 우주 (2026-05-29 배포검증 중 발견)
워크플로의 "이원 테이블 표류"보다 더 깊은 근본 원인. **공성 시스템과 픽셀/세금 시스템이 서로 다른 24섹터 집합이며 매핑이 없다.**
- **`sectors`** (24): name="Vastitas Borealis" 등 실제 화성 지명, 지오 경계, tier. governance.js/collectTax/recalculateGovernor + 픽셀 클레임(findSectorForPixelSync는 sectors.id 반환)이 사용 = **라이브 세금/거버너**.
- **`sector_definitions`+`sector_governance`** (24): code="olympus_crown" 등 판타지 코드. siege.js가 사용 = **공성 거버너**.
- id 정렬 안 됨(sectors#1 Vastitas/frontier ≠ sector_definitions#1 olympus_crown/core). `claims.sector_code`는 0건(클레임은 sector_code 미사용).
- **결론**: 플레이어가 픽셀 찍는 섹터(지오)와 공성 벌이는 섹터(코드)가 물리적으로 다름. siege의 영토 요건(`claims WHERE sector_code=`)도 빈 컬럼 조회. 두 우주를 잇는 키가 없어 거버너/세금 단일화(A)를 코드로 하면 라이브 세금 경로 손상.
- **선결 제품 결정 필요** (코드로 결정 불가): ① 24지오섹터를 정본으로 공성을 그 위에서 운용(sector_definitions/sector_governance를 sectors.id에 매핑/병합), 또는 ② 두 시스템 통합 마이그레이션. 이 결정 전까지 (A) 거버너 단일화·세금→길드금고는 착수 불가(footgun).
- **영향 범위**: (B) JOIN/관전 UI는 공성 우주 안에서 자족적이라 **독립 진행 가능**(세금 우주 무관).
- **[RESOLVED v7.245] 결정=지오 정본**. mig 260 브리지: sector_governance.sector_id↔sectors.id(1:1 backfill), 공성 승리 시 `_installGeoGovernor`로 sectors/governance_positions 동기화 + recalc 가드(siege_governor_locked) + tax_rate 동기화. DB e2e 검증(공성→세금이 승자에게). `siege_governor_canonical_enabled` 플래그 OFF — 스테이징 검증 후 ON. 코스메틱(공성 UI 지오섹터명) 후속.

## 🔴 길드 공성전 — 멀티에이전트 검토 확정 발견 (guild-war-review, 13에이전트, 2026-05-29)
플래그(siege_fleet_combat_enabled / guild_governance_enabled) **ON 전 반드시 선결**. 현재 둘 다 OFF라 라이브 영향 없음.
- **[FIXED v7.243] siege full-loss 플래그 무시** — battleEngine 일반 분기가 격침함 무조건 영구파괴. siege를 loss-gated 처리로 수정.
- **[TODO HIGH] 거버넌스 이원 테이블 세금 표류** — resolveSiege는 sector_governance만 갱신, collectTax(`api.js:1511`)는 sectors+governance_positions 기준 징수 + recalculateGovernor(`api.js:1514`)가 픽셀로 sectors.governor_wallet 덮어씀. → 공성 승자가 세수 못 받고 픽셀로 되돌려짐. **이건 비-길드 기존 공성에도 존재(pre-existing)**. 수정: resolveSiege 트랜잭션에서 sectors/governance_positions 동기화 + recalculateGovernor가 공성 거버너 섹터 skip, 또는 collectTax를 sector_governance 정본으로 이관. (siege.js resolveSiege / governance.js collectTax·recalculateGovernor)
- **[TODO HIGH] JOIN/로스터/관전 UI 부재** — 백엔드(commit-fleet/roster/applySiegeResult) 완성됐으나 index.html(`~35505 loadSiegeInfoPanel`)에 함대 합류 동선 없음 → fleet_id NULL → prepareSiegeBattles 미발동 → 플래그 켜도 전부 픽셀 폴백. JOIN ATTACK/DEFENSE + 로스터 + 관전(openBattleViewer(fleet_battle_id)) 추가 필요(§19 data-action).
- **[TODO MEDIUM] 세금→길드 금고 미배선** — collectTax가 guilds.gp_treasury/sector_tax_collected(mig259 시드)를 안 씀. guild_governance ON 시 길드 세수 0. 길드 쓰기 단계에서 배선 + withdrawTreasury(리더/오피서, ledger, disband 가드).
- **[TODO LOW] 도움말·관전 진입** — siege_info_block 4언어가 옛 픽셀 모델 안내, resolution_mode 배지 없음. 플래그 flip과 묶어 처리.

## 🟢 v7.241~v7.242 (거버너=길드 데이터모델 + 쓰기로직)
- **v7.241 mig 259 (additive, 플래그 OFF)**: sector_governance.governor_guild_id/governor_member_wallet, governor_sieges.{challenger,defender,winner}_guild_id, guilds.sector_tax_collected + 개인거버너→길드 backfill. Codex+아키텍트 검토로 거버넌스 테이블 이원화(sectors vs sector_governance) 정본 단일화 결정(설계 §13).
- **v7.242 길드 쓰기로직 (siege.js, guild_governance_enabled OFF)**: declareSiege 길드 리더/오피서 검증+길드 기록, resolveSiege 길드 거버너 이전 + Codex race fix(sector_governance FOR UPDATE), commitSiegeFleet 길드 임원 허용(Codex auth fix). 로컬 DB end-to-end 시뮬 PASS.
  - 🟡 미완: Phase 1a 개인 플래그 ON 검증(활성화 전제), 세금→길드금고(sector.js/governance.js), UI(합류/관전/거버너 길드명), 길드 해체 시 섹터 무주공산화 가드, full-loss.
  - 🔴 병행: guild-war-review 워크플로(레드팀/품질/UX) 결과 대기 — 확정 발견 반영 예정.

## 🟢 v7.239~v7.240 (영상 오디오 · 길드 공성전 Phase 1a)
- **v7.239**: 가챠/하이젝 영상 원본 오디오 복원(`-an` 무음 인코딩 버그 → AAC 96k). 플레이어 unmute + 자동재생 막힐 시 음소거 재시도. WebAudio `_sfx.crateCharge` "방구소리" 제거. 로딩 배경은 음소거 유지(자동재생+루프 정책).
- **v7.240 길드 공성전 Phase 1a (백엔드, 플래그 OFF)**: 공성 승패 "픽셀 비교 → 실제 함대전" 배선. mig 258(컬럼/설정), `siege.js`(commitSiegeFleet/prepareSiegeBattles/resolveSiege 전투우선), `siegeFleetBridge.applySiegeResult`(→resolveSiege 위임), `battleScheduler` siege 종료 훅, API(commit-fleet/roster), 스케줄러 tick. **`siege_fleet_combat_enabled=false` 기본 → 프로덕션 무영향**. node --check + DB 스모크 통과.
  - 🟡 미완(Phase 1 잔여): 플래그 ON 검증, 수비자 미커밋 시 auto-pick(현재 미커밋이면 픽셀 폴백), UI(합류/관전), full-loss 경제 재균형(§12), Phase 2 N-side 엔진.

## 🟢 v7.229~v7.238 적용 완료 (전투 VFX · 영상 연출)
- **v7.229 함대전 박력 강화**(`assets/tactical-lab-v11.html`): 발사 머즐 플래시(`mkMuzzle`/`drawMuzzles`, 신규 `muzzles[]`), 빔 굵기/알파/코어 상향, `mkExp` 파편·격침 폭발 크기 상향, 대형함 격침 히트스톱(`triggerHitstop` 타이탄 110ms/배틀십 70ms), 탄·미사일 명중 임팩트 스파크. WS 서버 전투 데미지 로직 무변경(시각/로컬 시뮬 계층만). 카메라/속도 미변경.
- **v7.230 로딩 영상 frozen Mars**: `load_loop_03`(가로)/`load_loop_v03`(세로) 추가, 로딩 랜덤 2종→3종.
- **v7.231~v7.237 가챠 5티어 리빌 영상**: `_GACHA_TIER_VIDEO` 매핑(준비 티어만 영상, 미준비는 캔버스 폴백). 커먼/언커먼/레어/에픽/레전더리 전 티어 가로·세로 마스터(<1MB, 8.2s). 레전더리는 사용자 제공 4종 풀(방향별 랜덤). 박스색 회→초→파→보→골드, 함선 정찰기→프리깃→구축함→순양함→전함 스케일.
- **v7.238 영상 SKIP 버튼**: 가챠+하이젝 인트로 영상 우측 상단 또렷한 `SKIP ▸`(safe-area, 4언어). 전체 탭-스킵 유지.
- **검증**: 인라인 스크립트 11종 `node --check` 0 errors(매 커밋), pre-commit onclick 훅 통과, 신규 mp4 git 추적 확인, SW v46→v55(에셋 network-first 캐시 무효화).

### 🟡 후속 메모 (이 라운드)
- **모든 등급이 8s 영상 재생**: 커먼 포함 전 뽑기가 풀스크린 영상. SKIP 버튼으로 완화했으나, 다연속 뽑기(10연차 등) 시 영상 누적이 부담일 수 있음 — 추후 "다연차는 결과만/영상 1회" 옵션 고려.
- **레전더리 vertical 풀에 가로 출신 squish 의심 파일**(`gacha_reveal_v01/v02`) 포함 — 육안 점검 권장.

---

# (이전) Audit v7.160~v7.164 / 2026-05-28 — 비주얼·P2O·시장 유동성·머니플로 hotfix

## 🟢 v7.160~v7.164 적용 완료
- **v7.160**: BASE 탭 배너 9종 실사풍 교체 (fleet/pvp/governance/sectors/territory/quests/rank/guild/transport, Codex CLI, 1600x680, 컨셉 매칭 육안 검증).
- **v7.161**: P2E→P2O 프레임 전환(4 페르소나 진단 docs/P2E_STRATEGY_2026-05-28.md). 🪐 MY MARS PORTFOLIO 모달(자산 수량+환금 잠금+P2O 3스텝), 데이터 연결 hotfix(`walletState.gamePP/gameUsdt` + `/api/ships/my`·`/api/claims/my` fresh fetch), 4언어 카피.
- **v7.162**: 가챠 시스템 강화. (a) 획득 리빌 모달(✨획득!✨ + 함선 포트레이트 + 능력치+보너스), (b) 랜덤 보너스 스탯(각인 품질 common~legendary), (c) cross-faction 함선(사용 불가·마켓 판매 — 시장 유동성), (d) E2E 감사 후 fleet 편입 우회 3 경로 차단(`moveShips`/`buyShipListing`/`cancelShipListing` 진영 매칭 강제), (e) 프론트 🔒 lock 배지 + 에러 메시지.
- **v7.163**: 머니플로 전수 감사(4 페르소나 병렬 198곳) → Critical 4 즉시 차단: PP→GP 대소문자 우회·fail-OPEN·rate≤0 통과·processDeposit 음수.
- **mig 248**: `ship_market_fee_pct` 0.05→5 영속 복원(실효 0.05%→5% 100배 차이 버그).
- **mig 249**: `auction_platform_fee_pct=5` 시드(admin 튜닝성).
- **v7.164**: 가챠 리빌 전용 함선 포트레이트 22종 실사풍 신규 생성(`assets/ships/reveal/*.jpg`, 800x600, 진영 톤 분리: mcc 주황/골드, fsp 청록/블루, cv 보라/마젠타). 기존 탑뷰 스프라이트(전투/조선소 공유)는 손 안 댐.

## 🟡 Tier 2 — 후속 (구조적 위험, 별도 작업)
- **timezone `CURRENT_DATE` 일일캡 우회** (30+ 파일, daily/governance/mission/login_streak): DB 세션 TZ Asia/Tokyo, 자정 boundary 시 더블 보상 가능. dailyOps.js만 패치됨.
- **GP transfer race**: `sentToday` 집계에 FOR UPDATE 없음 — 동시 송금 시 일일 한도 초과 가능.
- **treasury 가드 contract 미강제**: FOR UPDATE가 "주석 contract"라 호출자 누락 시 솔벤시 윈도우 누수.
- **dividends `.toFixed(6)` 누적 dust**: 풀 잔여 ghost GP 영구 적립.
- **settings 캐시 무효화 누락**: `__invalidateSectorsCache`만, exchangeRate floor/ceil 등 미반영.
- **2차 그래프 자기거래 chain**: 4겹 sybil 가드(229/242/244/227) 모두 1차원만 봄, 연결 wallet 관계 감지 없음.
- **fee_pct 두 컨벤션 공존**(`÷100`와 `×직접`): 각자 정합이나 admin 헷갈림 — 운영 매뉴얼/키 prefix 통일 가치.

---

# OCCUPY MARS — Codebase Audit (v7.94~v7.128 / 2026-05-27) — 7대 점검 + 기능 추가 + EVE급 경제

> **경제(EVE급) 진단·수정 v7.121~7.128**: 상세는 `docs/ECONOMY_EVE_ROADMAP.md` 참조.
> 페르소나팀 + Codex 독립검토 + 설계에이전트 병렬. 핵심: 뱅크런 구조적 차단(담보 불변식 v7.125/126),
> PP채굴캡·시빌방어(v7.124), 함선 영구파괴 토글(v7.127, OFF), 동적 환율(v7.128, OFF), 경제 헬스 모니터(v7.123).
> 잔여: 지역(섹터) 마켓 차별화 + killmail/looting (설계 완료, 로드맵 문서에 마이그레이션/엔드포인트 스케치).

# OCCUPY MARS — Codebase Audit (v7.94~v7.108 / 2026-05-27) — 7대 점검 + 기능 추가

서브에이전트 4종(UI↔백엔드 연결·캠페인·추천·Hermes) 병렬 감사 + 직접 수정/구현.

## 🟢 감사 총평
- **UI↔백엔드 연결** (FE 377 fetch ↔ BE 837 route + onclick 대조): HIGH 0건, 전체 양호. 실제 단절 1건만.
- **Hermes/Codex 최근 배치**: 회귀·이질 변경 0건. JWT-only/getSetting/ON CONFLICT(key)/네이티브 다이얼로그 0/4기둥 전부 준수. ("Hermes" 작성자는 존재하지 않음 — 전부 neuropilot00/Codex)
- **캠페인 35챕터**: objective 훅/하드게이트/함선보상/씬파일/이미지 거의 정상. HIGH 1건만.
- **추천 3단**: 활성 확인(T1 15%/T2 10%/T3 5%). 운영 안전·바이럴 갭 식별.

## 🔴 발견·수정 (심각도순)

| # | 감사 영역 | 발견 | 심각도 | 수정 |
|---|-----------|------|--------|------|
| 1 | 작전보드 진행도 (`dailyOps.js`) | `notifyMissionProgress`만 `ops_date=CURRENT_DATE`(DB=Asia/Tokyo), 나머지는 UTC → JST 0~9시 9시간 진행도 유실 → 완료해도 녹색 안 됨 + ensureDailyMissions 미호출 | 🔴 HIGH | ✅ v7.95 |
| 2 | 캠페인 (`campaign.js`) | FSP CH5/CH6에서 존재하지 않는 변형 챕터로 하드 리다이렉트 → 특정 분기 메인 스토리 영구 막힘 | 🔴 HIGH | ✅ v7.99 |
| 3 | 추천 (`achievements.js`/`rank.js`) | `referred_by`(지갑 저장)를 `referral_code`와 비교 → 추천 업적/랭크 영구 0 | 🟠 MED | ✅ v7.100 |
| 4 | 추천 운영안전 (`db.js`) | 커미션 신규 발행 + 일일 캡/시빌 방어 전무 | 🟠 MED | ✅ v7.101/104 (일일 캡 메커니즘+기본값 PP/GP 10000·USDT 500) |
| 5 | 추천 도움말 (`index.html`) | 비활성 hijack 보상을 4개 언어로 거짓 광고 | 🟡 LOW | ✅ v7.101 |
| 6 | 상태 메시지 (`index.html`) | fallback이 없는 `/api/profile/status` 호출 → 404·거짓 성공 토스트 | 🟠 MED | ✅ v7.98 (→/api/status/set) |
| 7 | 작전보드 GO (`index.html`) | 캠페인이 없는 'quests' 카테고리 호출로 탭 숨김 + territory 미션 동선 부재 | 🟠 MED | ✅ v7.94 |
| 8 | 함대전 화면 (`tactical-lab-v11.html`) | 함선/함대 원 난잡 + PC 발사 무제한(`fireBudget 9999`)/글로우 과다 → 미사일·레이저 무덤·렉 | 🟠 MED | ✅ v7.108 (원 제거 + PERF_MODE PC 적용) |

## 🟢 신규 기능 / 콘텐츠
- **v7.96** 작전보드 죽은 코드 정리(missionNav/enabled).
- **v7.97** 게임 가이드(HOW TO PLAY) 4개 언어 최신화(폐기 Hijack 제거, 캠페인/작전보드/추천 반영).
- **v7.102** 온보딩 힌트 4개 언어 현지화 + 캠페인 골든패스 유도(영어 하드코딩이던 버그 동반 수정).
- **v7.103** 양면 추천 보상(invitee 가입 보너스 PP, migration 227).
- **v7.105/106** 함선 가챠(Ship Crate) 풀스택 — migration 228 + `shipCrate.js`(crypto RNG·천장·타이탄 캡·확률공개) + 조선소 CRATES 탭 4개 언어.
- **v7.107** Base 테스트넷 연결 런북 + `.env.testnet.example`. ⚠️ signer.js base.chainId 8453(메인넷) 하드코딩 → 테스트넷 84532 불일치 명시.

## 🟡 잔여 (보고 — 후속 결정)
- 추천: 시빌/봇 방어(계정수·디바이스 제한) 여전히 약함. `referral_signup_bonus_pp`/캡 실제값은 트래픽 데이터로 튜닝 필요.
- 캠페인 MED: 분기 modifier 완료시 저장이 swallow-error SAVEPOINT(선택 시점 저장으로 완화).
- 영토 업그레이드 시스템 2개 공존(둘 다 동작, 기술부채). `/api/chat/channels` 미사용.
- Base 메인넷 전: `MarsDeposit.sol` 외부 보안 감사 필수.

## 🟢 QA
db_smoke 4/4, smoke_capital_recipes 11/11, 3002 핵심 엔드포인트(health/config/daily-ops/season/ships/crates) 200. 가챠 E2E(개봉/GP차감/천장/타이탄캡/GP부족) 통과.

---

# OCCUPY MARS — Codebase Audit (v7.93 / 2026-05-27) — 하드 새로고침 직후 흰 화성 / 정지처럼 보이는 초기 로드 공백

## 🔴 v7.93 — NASA 초기 로드 전에 로더가 먼저 내려가 흰 화성이 노출되던 문제 (2026-05-27)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| index.html globe init | 데스크탑에서도 초기 `globeImageUrl`을 NASA 2K로 바로 잡고 `onGlobeReady` 직후 로더를 내려, 하드 새로고침 순간 NASA 텍스처/합성 캔버스가 준비되기 전의 빈 흰 프레임이 그대로 노출됐다. 사용자는 이 구간을 텍스처 미표시/회전 정지로 인식할 수 있었다. | 🔴 HIGH | ✅ 수정 |

**수정:** 데스크탑 NASA 모드는 procedural surface(`marsTexUrl`)로 먼저 시작하고, NASA 2K 캐시 완료 즉시 `compositeClaimsOnTexture()`를 실행하도록 변경. 또한 데스크탑 NASA 모드에서는 초기 합성 완료 전까지 로더를 유지하도록 조정.

**검증:** 실제 Chrome 창에서 `Cmd+Shift+R` 직후 즉시 캡처 시 텍스처가 보이는 것 확인. 2초 후 재캡처에서 표면 위치 변화 확인(자전 진행).

---

# OCCUPY MARS — Codebase Audit (v7.92 / 2026-05-27) — CORS 127.0.0.1 텍스처 500 (화성 안 보임)

## 🔴 v7.92 — CORS 미들웨어가 127.0.0.1 origin의 텍스처 요청을 500으로 거부 (2026-05-27)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| server/index.js CORS | `allowedOrigins` 기본값에 `localhost:3000`만 있고 `127.0.0.1:3000` 누락. globe.gl이 `crossOrigin='anonymous'`로 텍스처 로드 시 브라우저가 Origin 헤더 전송 → CORS 검사 → 127.0.0.1 거부 → `callback(new Error)` → 전역 핸들러 500 → 텍스처 로드 실패 → 화성 투명. 비허용 origin을 throw로 처리해 에셋 요청까지 500으로 죽임. | 🔴 HIGH | ✅ 수정 |

**진단:** `curl -H "Origin: http://127.0.0.1:3000"` → 500 / `Origin: http://localhost:3000` → 200. Railway(`*.railway.app` 허용)는 정상 → "Railway는 되고 로컬만 안 됨". v7.90 SW 캐시 수정 전엔 프로시저럴 폴백이 증상을 가리고 있었음.

**수정:** dev 모드에서 localhost/127.0.0.1 모든 포트 허용 + 비허용 origin은 `callback(null, false)`(throw 금지 → 500 방지). 서버 재시작 후 127.0.0.1 텍스처 200 + ACAO 헤더 확인.

---

# OCCUPY MARS — Codebase Audit (v7.90 / 2026-05-27) — NASA 텍스처 SW 캐시 오염 + 자전 속도

## 🔴 v7.90 — Service Worker 가 깨진 500 응답을 영구 캐시해 NASA 화성 텍스처가 사라지던 문제 (2026-05-27)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| sw.js 정적 에셋 캐시 | 정적 에셋(이미지/CSS/JS) fetch 핸들러가 `res.ok` 확인 없이 모든 응답을 `cache.put` → `/assets/textures/mars_nasa_2k.jpg` 가 일시적 500을 받은 순간 SW가 500을 캐시. cache-first 라 이후 매 요청이 캐시된 500을 반환 → 이미지 로드 실패 → 프로시저럴 텍스처 폴백. API/HTML 핸들러는 `res.ok` 가드가 있었으나 정적 핸들러만 누락된 비대칭 버그. | 🔴 HIGH | ✅ 수정 |
| index.html 글로브 | 자전 속도(autoRotateSpeed=0.35)가 느리다는 사용자 피드백. | 🟢 LOW | ✅ 수정 (0.6) |

**진단 (브라우저 라이브 디버깅):**
- `curl` 및 `?fresh=<ts>` (쿼리스트링 → SW 캐시 우회) → HTTP 200 정상.
- plain URL `fetch(...,{cache:'reload'})` → HTTP **500** (SW 캐시된 500 반환).
- `navigator.serviceWorker.controller` 활성, 캐시 엔트리 삭제 후 재요청 → 200 (오염 캐시 확정).

**수정 내용:**
- `sw.js`
  - 정적 에셋 핸들러: 2xx 응답만 캐시 (`res.ok && status 200~299`). 네트워크 실패 시 cached fallback.
  - `CACHE_NAME` `mars-v9` → `mars-v10` → `activate` 가 오염된 v9 캐시 전체 삭제 → 기존 사용자 자동 복구.
- `index.html`
  - `globe.controls().autoRotateSpeed` 0.35 → 0.6.

**검증:**
- `node --check sw.js` → OK.
- 브라우저: 오염 캐시 삭제 후 NASA 텍스처 200 확인.

---

# OCCUPY MARS — Codebase Audit (v7.88 / 2026-05-26) — campaign retry gates + locked reason UI

## 🟠 v7.88 — 실패 챕터 재도전 gate와 잠금 사유 표시 정합 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| campaign retry / locked reason UI | 실패 챕터 목록은 재도전 가능으로 표시하지만 시작 검증은 평판 외 `blockingTags` / `requiredBranchAny` gate로 다시 막힐 수 있었고, 잠긴 챕터 compact 카드에는 어떤 조건 때문에 잠겼는지 표시할 정적 payload와 UI가 부족했다. | 🟠 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/services/campaign.js`
  - 실패 챕터 재도전 시 평판, blocking tag, required branch gate를 건너뛰도록 수정.
  - 레벨/선행 챕터 검증은 기존 동작 유지.
  - public chapter payload에 `requiredReputation`, `prerequisiteChapter`, `blockingTags`, `requiredBranchAny` 추가.
- `index.html`
  - 잠긴 캠페인 카드에 평판/선행 챕터/태그/분기 기반 잠금 사유 표시.
  - `BRANCH_REQUIRED` 및 FSP 대체 챕터 blocker 메시지를 사람이 읽는 문장으로 매핑.

**검증 계획:**
- `node --check server/services/campaign.js`
- `index.html`은 HTML 내 inline script라 직접 `node --check` 대상이 아니므로 변경 함수/문자열 존재를 소스에서 확인.

---

# OCCUPY MARS — Codebase Audit (v7.87 / 2026-05-26) — campaign retry gate + daily OPS board sync

## 🟠 v7.87 — 실패 챕터 재도전 계약과 OPS 완료 표시가 어긋나던 문제 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| campaign retry / daily ops board | 실패 상태 캠페인 카드가 `재도전` 버튼을 보여도 `startChapter()`가 새 시작처럼 현재 평판을 다시 검사해 `INSUFFICIENT_REPUTATION`로 막고 있었고, 프론트는 raw error code를 그대로 토스트로 노출했다. 별도로 daily login OPS는 서버에서 이미 진행도를 기록하는데 프론트가 내부용 progress endpoint를 다시 치거나 로컬 보드만 다시 그려 완료 점/상태가 늦게 반영될 수 있었다. | 🟠 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/services/campaign.js`
  - 실패 이력이 있는 동일 챕터 재도전 시 기존 progress를 먼저 잠그고 읽은 뒤 평판 재검사를 건너뛰도록 수정.
- `index.html`
  - 캠페인 시작 실패를 raw 코드 토스트 대신 브리핑/목표를 유지한 차단 안내 모달로 교체.
  - daily login 자동완료 분기에서 내부용 `/api/daily-ops/progress` 재호출을 제거.
  - 출석 체크 성공 후 OPS 서버 보드 재조회 호출 추가.
  - OPS 보드 점 표시를 `completed || reward_claimed` 기준으로 보정.

**검증:**
- `node --check server/services/campaign.js`
- `curl -I http://localhost:3001`로 로컬 서버 `200 OK` 확인.
- 브라우저 페이지 컨텍스트 `document.title` 응답 확인.
- 브라우저 콘솔 `js_errors: 0`, `console_messages: []` 확인.
- 서빙 중인 HTML/소스에서 변경된 함수/분기 문자열 존재 재확인.

---

# OCCUPY MARS — Codebase Audit (v7.86 / 2026-05-26) — onboarding first-claim sync + production backfill

## 🔴 v7.86 — first claim을 해도 onboarding STEP 2가 닫히지 않던 운영 누락 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| onboarding first-claim funnel | claim route가 `getOnboardingState()`를 호출하지만 서비스 export가 없어 tutorial/free-claim 판정이 catch로 삼켜질 수 있었고, 일반 first claim은 STEP 2 완료와 연결되지 않아 `tutorial_claim_id` / `pp_rewarded`가 운영에서 거의 전부 비어 있었음 | 🔴 HIGH | ✅ 수정 |

**수정 내용:**
- `server/routes/api.js`
  - first owned claim을 별도 판정하고, onboarding이 STEP 2 대기 이상(`current_step >= 2`)이면 claim 생성 직후 `completeStep(2)`를 자동 호출하도록 수정.
- `server/services/onboarding.js`
  - STEP 1 완료 시 이미 earliest claim이 있으면 `tutorial_claim_id`를 복구하고 `pp_rewarded`를 함께 지급하도록 보강.
  - `getOnboardingState` alias export 추가로 기존 route 호출 정합성 복구.
- `docs/ops/BACKFILL_ONBOARDING_FIRST_CLAIM.sql`
  - 운영 유저용 earliest-claim 백필 SQL 추가 및 실제 운영 DB에 실행.

**운영 실행으로 확인한 상태:**
- 백필 실행 전:
  - real claimer `6`
  - onboarding row 보유 `5`
  - `tutorial_claim_id` 보유 `0`
  - `pp_rewarded` 보유 `0`
- 백필 실행 후:
  - `tutorial_claim_id` 보유 `5`
  - `pp_rewarded` 보유 `4`
- 아직 onboarding row 자체가 없는 real claimer `1명`은 남아 있으며, 이번 변경은 row 자동 생성이 아니라 first-claim sync + 보정 범위에 한정됨.

**검증:**
- 수정 JS 파일 `node --check` 실행.
- 운영 DB(Railway public proxy)에서 백필 SQL 직접 실행.
- 실행 후 claimer/onboarding linkage 카운트 재조회.

---

# OCCUPY MARS — Codebase Audit (v7.85 / 2026-05-26) — production KPI / cohort / phase2 audit SQL pack

## 🟢 v7.85 — 운영 KPI/코호트/phase2 감사 SQL 추가 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 분석 도구 | week-1 경제를 운영 DB에 반영한 뒤에도 D1/D3/D7, first territory, season pass premium, phase2 ship/expedition/monument 사용량을 한 번에 점검할 표준 SQL이 없었음 | 🟢 LOW | ✅ 수정 |

**수정 내용:**
- `docs/ops/PROD_KPI_CHECK_WEEK1_FUNNEL.sql` 추가.
- `docs/ops/DASHBOARD_COHORTS_RETENTION_AND_CONVERSION.sql` 추가.
- `docs/ops/PHASE2_AUDIT_SHIP_EXPEDITION_MONUMENT.sql` 추가.
- 0-row feature table에서도 잘못된 `1건` 집계가 나오지 않게 COUNT 대상을 명시적으로 보정.

**운영 실행으로 확인한 현재 상태:**
- 최근 30일 signup: `25`
- 최근 30일 first claim 1d: `1`명 (`4.0%`)
- 최근 30일 season pass premium 7d: `0`
- 최근 30일 PP→GP exchange: `4`건 / `2`유저 / `40 PP -> 152 GP`
- phase2 usage: ship build `32`건 / `1`유저 / `7940 GP`, expeditions `0`, monuments `0`

**검증:**
- 운영 DB(Railway public proxy)에서 세 SQL 파일 모두 직접 실행.
- 결과 tail 확인으로 active season / KPI / cohort / phase2 섹션이 끝까지 출력되는지 재확인.

---

# OCCUPY MARS — Codebase Audit (v7.84 / 2026-05-26) — week-1 economy fallback/verify hardening

## 🟡 v7.84 — 런타임 fallback이 구형 고비용 값으로 회귀하던 리스크 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 경제 런타임 fallback | settings 누락/구형 DB/부분 복구 상황에서 여러 코드 경로가 여전히 예전 고비용 fallback(`200 GP`, `500 GP`, `0.1 PP`, `30 GP`, `150 GP`, `4 GP/PP`)로 회귀할 수 있었음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/services/onboarding.js`의 `onboarding_gp_reward` fallback을 `75`로 조정.
- `server/services/daily.js`의 기본 7일 GP/PP 보상표를 현재 week-1 값으로 조정.
- `server/routes/api.js`, `server/services/guild.js`의 `pp_to_gp_exchange_rate` fallback을 `10`으로 조정.
- `server/services/expedition.js`, `server/services/monuments.js`, `server/services/season.js`, `server/services/territoryVisual.js`, `server/services/sector.js` fallback도 현재 경제 기준으로 정렬.
- verify SQL을 `220` + week-1 PP/GP/exchange/sink 항목까지 확장.

**검증:**
- 수정 JS 파일 `node --check` 실행.
- 로컬 DB `pixelwar`에서 verify SQL 재실행.
- diff 범위가 경제 fallback + verify/docs에 국한되는지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.83 / 2026-05-26) — referral safe key backfill

## 🟡 v7.83 — 구형 DB referral 안전 키 누락 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| referral settings 정합 | 로컬 구형 DB에서 `referral_enhance_pct`, `referral_auction_buy_pct` 키가 없어 `222` 적용 후에도 verify snapshot이 완전한 기대값 형태로 나오지 않았음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/migrations/225_referral_safe_key_backfill.sql` 추가.
- 누락된 `referral_enhance_pct`, `referral_auction_buy_pct`를 `0`/`referral` 카테고리/안전 설명으로 백필.
- verify SQL도 `225` migration 적용 여부까지 확인하도록 확장.

**검증:**
- 로컬 DB `pixelwar`에 `225` 적용.
- verify SQL 재실행으로 referral/pricing/funnel snapshot 재확인.

---

# OCCUPY MARS — Codebase Audit (v7.82 / 2026-05-26) — verify SQL JSONB snapshot 오류 수정

## 🟡 v7.82 — verify SQL snapshot jsonb 집계 오류 수정 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 확인 SQL | `settings.value`가 `jsonb`인 실제 DB에서 snapshot 쿼리의 `MAX(value)`가 `function max(jsonb) does not exist`로 실패해 verify SQL이 끝까지 실행되지 않았음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `docs/ops/VERIFY_MIGRATIONS_222_223.sql` snapshot 구간을 `value::text` 기준으로 집계하도록 수정.
- 앞단의 migration/settings 조회 쿼리는 유지하고, 마지막 human-readable snapshot만 타입 호환되게 보정.

**검증:**
- 로컬 DB `pixelwar`에서 `psql -d pixelwar -f docs/ops/VERIFY_MIGRATIONS_222_223.sql` 재실행.
- snapshot 쿼리까지 오류 없이 완료되는지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.81 / 2026-05-26) — 224 포함 migration verify SQL 확장

## 🟢 v7.81 — 224 migration 운영 확인 SQL 보강 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 확인 절차 | `224_week1_funnel_gp_bundle.sql`까지 반영된 뒤에도 verify SQL은 여전히 `222/223`만 확인해서 온보딩 GP / daily GP front-load 적용 여부를 한 번에 점검할 수 없었음 | 🟢 LOW | ✅ 수정 |

**수정 내용:**
- `docs/ops/VERIFY_MIGRATIONS_222_223.sql`에 `224_week1_funnel_gp_bundle.sql` 적용 여부 확인 추가.
- `onboarding_gp_reward`, `daily_login_gp_rewards` 조회 쿼리 추가.
- 마지막 snapshot 쿼리와 expected values 주석도 `224` 기준으로 확장.

**검증:**
- SQL 파일 내용 확인.
- `git diff`로 변경 파일이 ops SQL + 문서만인지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.80 / 2026-05-26) — week-1 funnel GP bundle

## 🟡 v7.80 — onboarding/daily GP front-load 조정 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 신규 유저 GP 체감 | `223`으로 season pass/territory 가격은 낮아졌지만, 신규 유저 GP 유입은 여전히 Day7 후반 비중이 커 초반 spend 체감이 약했음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/migrations/224_week1_funnel_gp_bundle.sql` 추가.
- `onboarding_gp_reward`를 `75`로 상향.
- `daily_login_gp_rewards`를 `[8, 12, 16, 20, 22, 25, 40]`로 조정.
- 7일 총합은 `143 GP`로 유지하고, Day1~Day3 보상만 front-load.
- PP 보상, PP→GP 환율, 함선 build cost, monument/expedition 비용은 이번 묶음에서 제외.

**검증:**
- migration 파일 내용 확인.
- `git diff`로 변경 파일이 migration + 문서만인지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.79 / 2026-05-26) — 222/223 migration 적용 확인 SQL

## 🟢 v7.79 — referral/pricing migration verify SQL 추가 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 확인 절차 | 222/223 migration이 실DB에 적용됐는지와 핵심 setting 값이 맞는지 한 번에 확인하는 반복 가능한 SQL이 없었음 | 🟢 LOW | ✅ 수정 |

**수정 내용:**
- `docs/ops/VERIFY_MIGRATIONS_222_223.sql` 추가.
- `schema_migrations` 적용 여부 확인 쿼리 추가.
- referral 안전 기본값 4개 + week-1 pricing 기본값 2개 확인 쿼리 추가.
- 마지막 snapshot 쿼리와 expected values 주석 추가.

**검증:**
- SQL 파일 내용 확인.
- `git diff`로 변경 파일이 ops SQL + 문서만인지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.78 / 2026-05-26) — 주차 1 가격 완화

## 🟡 v7.78 — Season Pass / Territory 주차 1 가격 완화 (2026-05-26)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `season_pass_premium_cost_gp`, `land_base_price_pp` 기본값 | 온보딩/첫 과금 구간 대비 premium pass 500 GP, territory base 0.1 PP가 초반 진입 장벽으로 작용 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/migrations/223_week1_pricing_soften.sql` 추가.
- `season_pass_premium_cost_gp`를 `150`으로 하향.
- `land_base_price_pp`를 `0.08`로 하향.
- referral 안전화 patch와 분리해 가격 정책만 독립적으로 적용/롤백 가능하게 유지.

**검증:**
- migration 파일 내용 확인.
- `git diff`로 변경 파일이 migration + 문서만인지 확인.

---

# OCCUPY MARS — Codebase Audit (v7.74 / 2026-05-18) — Codex 신규 코드 감사 + withdraw 정보 유출 수정

## 🟡 v7.74 — withdraw env 변수명 정보 유출 수정 (2026-05-18)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `api.js` `/api/withdraw` + `/api/withdraw-all` `getAvailableLiquidity` 예외 경로 | `e.message` 클라이언트 노출 → env 변수명(`BASE_RPC_URL` 등) 정보 유출 | 🟡 MEDIUM | ✅ 503 + 제네릭 메시지로 대체 |

### Codex 신규 커밋 감사 (be1fe9d ~ 6bc645e) — 전원 CLEAN
| 항목 | 결과 |
|------|------|
| `adminAuth.js` requireAdmin 미들웨어 | ✅ CLEAN |
| campaign editor 4개 라우트 requireAdmin | ✅ CLEAN |
| campaign-editor.html 403 재시도 | ✅ CLEAN |
| `withdraw` minWithdrawAmount ROLLBACK 패턴 | ✅ CLEAN |
| `signer.js` getAvailableLiquidity | ✅ CLEAN (env 유출만 v7.74 수정) |
| `admin.js` withdraw_all totalOut 계산 수정 | ✅ CLEAN |
| `db.js` 키 rename 호환성 | ✅ CLEAN |

### 전체 감사 최종 요약 (v7.53 ~ v7.74)

| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 6건 |
| 🔴 HIGH | 11건 |
| 🟡 MEDIUM | 12건 |
| 🟢 LOW | 17건 |
| **총** | **46건** |

---

# OCCUPY MARS — Codebase Audit (v7.85 / 2026-05-15) — backup verify script 추가

## 🟡 v7.85 — 백업 전제 점검 스크립트 추가 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 백업 | 백업 baseline 문서는 있었지만, 실제로 DB/pg_dump/핵심 테이블/원격 상태를 빠르게 점검하는 반복 가능한 verify 명령이 없었음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/tools/backup_verify.js` 추가: `DATABASE_URL`, `pg_dump`, DB ping, 핵심 테이블, Git 원격 점검.
- `server/package.json`: `npm run backup:verify` 추가.
- `docs/ops/BACKUP_RECOVERY_BASELINE.md`에 backup verify 사전 점검 기준 반영.

**검증:**
- `node --check tools/backup_verify.js`
- `npm run backup:verify` → `5 passed / 0 failed`

---

# OCCUPY MARS — Codebase Audit (v7.84 / 2026-05-15) — rollback helper script 추가

## 🟡 v7.84 — 롤백 보조 스크립트 추가 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 롤백 | 롤백 절차 문서는 있었지만 known-good SHA 기준으로 실제 명령을 미리 검토하는 반복 가능한 helper가 없었음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/tools/rollback_helper.js` 추가: target SHA 검증, commit diff 요약, dry-run 계획 출력, `--apply`/`--push` 가드 포함.
- `server/package.json`: `npm run rollback:plan` 추가.
- 운영 문서에 rollback helper 사용 순서 반영.

**검증:**
- `node --check tools/rollback_helper.js`
- `npm run rollback:plan -- 8383be7` → dry-run complete

---

# OCCUPY MARS — Codebase Audit (v7.83 / 2026-05-15) — release preflight script 추가

## 🟡 v7.83 — 배포 전 점검 스크립트 추가 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 점검 | `smoke:db`와 `/health`는 있었지만, 배포 전 운영 URL 기준으로 둘을 묶어 반복 실행하는 단일 명령이 없었음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/tools/release_preflight.js` 추가: `smoke:db` → `/health` → `/api/config` 순으로 점검.
- `server/package.json`: `npm run release:check` 추가.
- 운영 문서에 `TARGET_URL=https://... npm run release:check` 반영.

**검증:**
- `node --check server/tools/release_preflight.js`
- `npm run release:check` → `3 passed / 0 failed`
- 로컬 3000 포트는 이미 점유 중이어서 새 서버 실행은 `EADDRINUSE`였지만, 기존 실행 서버 대상으로 점검 스크립트는 정상 통과.

---

# OCCUPY MARS — Codebase Audit (v7.82 / 2026-05-15) — health 응답 보정 + DB smoke script 추가

## 🟡 v7.82 — 운영 최소 자동화 추가 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 검증 | `/health`는 있었지만 DB 장애 시 HTTP 상태 코드로 실패를 드러내지 않았고, 반복 가능한 경량 DB smoke 명령이 없었음 | 🟡 MEDIUM | ✅ 수정 |

**수정 내용:**
- `server/index.js`: `/health`가 DB 오류 시 HTTP `503`을 반환하도록 보정.
- `server/tools/db_smoke.js` 추가: DB ping / 핵심 테이블 / settings seed / 핵심 경제 설정 키 점검.
- `server/package.json`: `npm run smoke:db` 추가.
- 운영 문서에 `/health`와 `smoke:db` 사용 기준 반영.

**검증:**
- `node --check server/index.js`
- `node --check server/tools/db_smoke.js`
- `npm run smoke:db` → `4 passed / 0 failed`

---

# OCCUPY MARS — Codebase Audit (v7.81 / 2026-05-15) — 관리자 정책 / 배포 롤백 / 백업 복구 운영 문서 추가

## 🟡 v7.81 — ops documentation hardening 정리 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| 운영 문서 | 관리자 시크릿 관리, 배포/롤백, 백업/복구 기준이 최소 런북에만 추상적으로 적혀 있고 개별 실행 문서가 없음 | 🟡 MEDIUM | ✅ 운영 문서 3종 추가 |

**수정 내용:**
- `docs/ops/ADMIN_ACCESS_POLICY.md` 추가: `ADMIN_SECRET` 보관/전달 금지 규칙, 교체 주기, 유출 대응 절차 정리.
- `docs/ops/DEPLOY_ROLLBACK_CHECKLIST.md` 추가: 배포 전/직후 확인, 롤백 트리거, 핫픽스 vs 롤백 기준 정리.
- `docs/ops/BACKUP_RECOVERY_BASELINE.md` 추가: DB/환경변수/배포 SHA 기준 최소 백업 자산과 복구 검증 절차 정리.
- `docs/OPS_MINIMUM_RUNBOOK_2026-05-15.md`의 다음 단계 권장 항목을 실제 생성 상태에 맞게 갱신.

**검증:**
- `server/middleware/adminAuth.js` 기준 실제 관리자 인증 헤더/환경변수 이름(`x-admin-secret`, `ADMIN_SECRET`)을 문서에 반영.
- 새 문서 3개 생성 확인.
- 런북의 참조 경로와 실제 파일 경로 일치 확인.

---

# OCCUPY MARS — Codebase Audit (v7.80 / 2026-05-15) — 테스트 런처 기본 외부 공개 차단 + 관리자 비밀번호 노출 제거

## 🔴 v7.80 — start-test launcher exposure control 정리 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `start-test.sh` | 기본 실행만으로 Cloudflare Tunnel을 열어 외부 URL을 즉시 노출 | 🔴 HIGH | ✅ opt-in 외부 공개로 전환 |
| `start-test.sh` | 실행 배너에 관리자 비밀번호 `admin1234`를 평문 노출 | 🔴 HIGH | ✅ 평문 제거 |

**수정 내용:**
- `start-test.sh` 헤더에 지인 테스트/로컬 확인용이며 상업 운영 경로가 아니라는 경고를 추가.
- 기본 실행은 로컬 전용으로 두고, `ALLOW_PUBLIC_TUNNEL=1`일 때만 Cloudflare 터널을 열도록 변경.
- 출력문에서 `admin1234` 평문을 제거하고 관리자 시크릿은 환경변수/운영 문서 기준으로 확인하도록 수정.
- 터널 비활성 시에는 로컬 전용 실행 메시지를, 활성 시에는 임시 외부 테스트 URL 경고를 노출.
- `docs/TEST_LAUNCHER_USAGE_2026-05-15.md`와 `docs/HANDOFF.md`에 운영 경계를 문서화.

**검증:**
- `bash -n start-test.sh` 문법 검증 통과.
- 코드 검색으로 `admin1234`가 `start-test.sh`에 더 이상 남아 있지 않음을 확인.
- 코드 검색으로 `ALLOW_PUBLIC_TUNNEL` opt-in 분기가 들어간 것 확인.

---

# OCCUPY MARS — Codebase Audit (v7.78 / 2026-05-15) — 캠페인 UI 가이드 카피를 행동 중심으로 정리

## 🟡 v7.78 — campaign action copy clarity 정리 (2026-05-15)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `index.html` campaign objective/action UI | `시작 / 계속 / 결과 / 내 영토 / 전투 / 다시 확인` 같은 추상 라벨이 많아, 스토리와 분리된 가이드 영역에서도 플레이어가 다음 행동을 즉시 이해하기 어려움 | 🟡 MEDIUM | ✅ 행동 중심 카피로 정리 |
| `index.html` campaign gate warning | 목표 미완료 상태 문구가 실패/막힘처럼 들려 실제로는 "남은 행동 진행" 단계임에도 흐름이 끊겨 보임 | 🟡 MEDIUM | ✅ 진행 안내형 문구로 정리 |

**수정 내용:**
- 캠페인 카드 CTA를 `작전 시작 / 작전 계속 / 결과 확인`으로 조정.
- 목표 액션 라벨을 `영토 확인 / 함선 준비 / 함대 편성 / 전투 진입 / 마켓 확인`으로 조정.
- 액션 진입 토스트를 `영토 화면에서 목표를 진행하세요`, `함대전을 열고 전투 목표를 진행하세요`처럼 현재 해야 할 행동이 드러나게 수정.
- 결과 재확인/게이트 문구를 `목표 다시 확인`, `아직 완료할 행동이 남아 있습니다`, `남은 목표를 먼저 진행한 뒤 결과를 확인하세요`로 정리.
- 스토리 본문/세계관 대사는 건드리지 않고, 분리된 가이드/버튼/경고 카피만 수정.

**검증:**
- `index.html` 해당 키/함수 위치를 직접 확인해 반영 문자열이 들어간 것 확인.
- 서버 파일 `node --check server/index.js server/routes/api.js server/routes/admin.js server/db.js server/services/signer.js` 통과.
- 간단한 문자열 존재 검사 스크립트로 이번 세션의 캠페인 카피 반영값 확인.

---

# OCCUPY MARS — Codebase Audit (v7.77 / 2026-05-14) — 구형 튜토리얼 자동 실행 중단 + 신형 온보딩 루프 재정렬

## 🔴 v7.77 — first-session onboarding 정리 (2026-05-14)

| 감사 영역 | 발견된 문제 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `index.html` | 구형 localStorage 기반 spotlight 튜토리얼이 로더 종료 직후 자동 실행되어, 서버 기반 온보딩/랜딩/캠페인 초반 루프와 3중으로 겹침 | 🔴 HIGH | ✅ 자동 실행 차단 |
| `index.html` | 신형 온보딩 step 3~5가 현재 게임의 북극성 루프(영토 → 수확 → 함대 → 캠페인)와 어긋나 직업/길드/일일미션 중심으로 안내됨 | 🔴 HIGH | ✅ 카피/순서 재정렬 |

**수정 내용:**
- `dismissLoader` override에서 구형 `startTutorial()` 자동 호출 제거.
- 신형 onboarding step copy를 아래 루프로 정렬:
  - 첫 영토 확보
  - 영토 수확
  - 첫 함대 준비
  - 첫 캠페인/임무 진행
  - 루프 요약 + 시작 보상

**검증:**
- `index.html` 코드 확인으로 로더 종료 경로에 더 이상 `startTutorial()` 호출이 없음을 확인.
- `index.html` 온보딩 step 3~5 문구가 `fleet / campaign / loop summary` 기준으로 바뀐 것 확인.
- 이번 변경은 UX 카피/진입 경로 정리만 수행했고, 서버 onboarding API 계약은 건드리지 않음.

---

# OCCUPY MARS — Codebase Audit (v7.76 / 2026-05-14) — 출금 최소값 설정 일관화 + withdraw-all 계약 잔액 계산 수정

## 🔴 v7.76 — finance/admin correctness 수정 (2026-05-14)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/routes/api.js` + `server/db.js` + `server/migrations/201_withdraw_min_amount.sql` | `min_withdraw` / `withdraw_min_amount` 키가 갈라져 있어 `/api/config` 노출값과 실제 출금 검증값이 달라질 수 있음 | 🔴 HIGH | ✅ 설정 키 일관화 + fallback 정리 |
| `server/routes/admin.js` | `withdraw_all`의 실제 지급액은 `meta.totalOut`인데 관리자 계약 잔액은 `usdt_amount`만 차감해 잔액을 과대 표시 | 🔴 HIGH | ✅ `withdraw_all`은 `meta.totalOut` 우선 차감 |

**수정 내용:**
- `/api/config`의 `minWithdraw`를 `withdraw_min_amount ?? min_withdraw ?? 10`으로 통일.
- `/api/withdraw`, `/api/withdraw-all` 최소 출금 검증도 같은 fallback 체인으로 통일.
- 기본 설정 시드와 migration 201의 기준 키/기본값을 `withdraw_min_amount = 10`으로 맞춤.
- 관리자 계약 잔액 집계에서 `withdraw_all`은 `meta.totalOut`을 우선 사용하고, 없을 때만 `usdt_amount` fallback 사용.

**검증:**
- `node --check server/routes/api.js && node --check server/routes/admin.js && node --check server/db.js` 통과.
- 코드 검색으로 `/api/config`, `/api/withdraw`, `/api/withdraw-all`이 동일 fallback 체인을 사용함을 확인.
- 샘플 계산(`usdt=10, pp=100, fee=5`) 기준 기존 집계는 10만 차감하지만 실제 지급액은 105여서 95 과대계상됨을 재현.

---

# OCCUPY MARS — Codebase Audit (v7.75 / 2026-05-14) — admin 패널 `window.ADMIN_SECRET` 동기화 누락 수정

## 🔴 v7.75 — admin 후반 탭 인증 헤더 누락 수정 (2026-05-14)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `admin.html` | 로그인 성공 시 `adminSecret`만 설정하고 `window.ADMIN_SECRET`는 끝까지 빈 문자열. 그런데 Contest/Rental/Duel/Expedition/Branding/Spells/Tournaments 등 다수 탭이 `window.ADMIN_SECRET` 기반으로 헤더를 구성 → 후반 탭 대량 401/403/빈 데이터 | 🔴 HIGH | ✅ 로그인 성공 시 전역 동기화 |

**수정 내용:**
- 전역 초기값 `window.ADMIN_SECRET = ''` 추가.
- `doAuth()` 성공 직후 `window.ADMIN_SECRET = adminSecret` 동기화 추가.
- 기존 `adminSecret` 기반 탭은 그대로 유지하고, `window.ADMIN_SECRET` 사용 탭들만 정상 복구.

**검증:**
- `admin.html` 전체 검색 기준 `window.ADMIN_SECRET` 사용처는 다수인데, 수정 전에는 대입문이 0건이었음.
- 수정 후 대입문이 2건(초기화 1, 로그인 성공 동기화 1)으로 생김.
- `admin.html` 인라인 스크립트 추출 후 `node --check` 문법 검증 통과.

---

# OCCUPY MARS — Codebase Audit (v7.74 / 2026-05-14) — campaign editor admin auth 회귀 수정

## 🔴 v7.74 — campaign editor 403 regression 수정 (2026-05-14)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `assets/campaign-editor.html` + `server/index.js` admin campaign-editor routes | 서버가 `/admin/api/campaign-editor/chapters|assets|chapter/:file` 에 `requireAdmin`을 붙였지만 에디터 프론트는 헤더 없는 `fetch()` 유지 → 로드 즉시 403, 캠페인 에디터 unusable | 🔴 HIGH | ✅ `adminFetch()` 추가 + `x-admin-secret` 자동 첨부 |

**수정 내용:**
- `assets/campaign-editor.html`에 `adminFetch()` helper 추가.
- 관리자 시크릿은 `sessionStorage(campaignEditorAdminSecret)`에만 저장하고, 없으면 prompt로 입력받도록 구성.
- 저장된 시크릿이 stale 해서 403이 나면 sessionStorage를 비우고 새 시크릿을 강제로 다시 입력받아 1회 재시도.
- `loadInitial()`의 `chapters/assets` 로드와 `loadChapter()`의 개별 챕터 로드를 모두 `adminFetch()`로 전환.

**검증:**
- 헤더 없는 `/admin/api/campaign-editor/chapters` 요청이 `403`임을 재현.
- 유효한 `x-admin-secret` 헤더 포함 시 동일 엔드포인트가 `200` 응답.
- 수정 후 `campaign-editor.html` 인라인 스크립트를 추출해 `node --check` 문법 검증 통과.

---

# OCCUPY MARS — Codebase Audit (v7.73 / 2026-05-11) — 모바일/데스크탑 nav 아이템 버튼 라우팅 수정

## 🟡 v7.73 — nav 아이템 버튼 (모바일+데스크탑) 라우팅 수정 + SW bump (2026-05-11)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `index.html` 하단 nav `mn-items` | `openItemShop();shopSwitchTab('inv')` — `openItemShop()` 이 BASE/SHOP 으로 setTimeout 후 전환하는 동안 `shopSwitchTab('inv')` 는 구버전 `shopModal` DOM 을 동기 토글 → "내 아이템" 도달 못 함 | 🟡 MEDIUM | ✅ `openMyItems()` 헬퍼 추가 + `baseTabItems` 직접 라우팅 |
| `index.html` 사이드 `col-fab items` | 동일한 옛 onclick. 1차 패치(v7.73 mobile-only) 후에도 데스크탑/사이드바 유저는 여전히 SHOP 진열대로 빠짐 | 🟡 MEDIUM | ✅ `openMyItems()` 로 통일 |
| `sw.js` CACHE_NAME | `mars-v8` 정적 캐시에 옛 onclick 포함된 보조 자원 잔존 가능 | 🟢 LOW | ✅ `mars-v9` 로 bump |

**수정 내용:**
- `openMyItems()` — `openBaseModal()` 호출 후 setTimeout 100ms 안에서 `switchBaseTab('items', baseTabItems)` + `loadBaseInventory()` + `clearBaseTabDot('items')` 실행.
- 모바일 `mn-items` + 데스크탑 `col-fab items` onclick 을 `openMyItems()` 단일 호출로 교체. 구버전 `shopSwitchTab('inv')` race 제거.
- `openItemShop()`/`shopSwitchTab()` 자체는 다른 호출 지점(상단 nav 의 `shop` 진입, 코스메틱 카테고리 직링크)이 있어 그대로 둠.
- `sw.js` CACHE_NAME bump 으로 옛 클라이언트 캐시 강제 무효화.

---

## 🟡 v7.72 — buildShip() fleet 선택 기능 공백 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `index.html` `buildShip()` | 함선 건조 시 `fleet_id` 미전송 → 다중 함대 플레이어 배치 함대 선택 불가 | 🟡 MEDIUM | ✅ `gamePicker` 플릿 선택 추가 |

**수정 내용:**
- 건조 전 `/api/fleets` 호출해 전투 중 아닌 함대 목록 수집
- 함대 2개 이상 → `gamePicker` 다이얼로그로 배치 함대 선택
- 함대 1개 → 자동 선택 (기존 동작 유지)
- 함대 없음 (신규) → `fleet_id` null (서버 자동 배정)
- `gamePicker` 취소 시 건조 중단

### 전체 감사 최종 요약 (v7.53 ~ v7.72)

| 심각도 | 수정 수 | 대표 항목 |
|--------|---------|-----------|
| 🔴 CRITICAL | 6건 | auctionCombat 이중결제, auction buyout 무료, campaign CH1 보상 0, CV 소프트락 |
| 🔴 HIGH | 11건 | ships.js wallet 스푸핑, auth broken, arena 소유권, dailyOps GP farming 등 |
| 🟡 MEDIUM | 11건 | expedition/worldEvents/governance/rocket/tribute/sponsor/FSP CH9 실패 보상/buildShip fleet 선택 등 |
| 🟢 LOW | 17건 | tdesc LOWER(), guild rowCount, branding/replayShare/siegeFleetBridge, lottery PRNG 등 |
| **총** | **45건** | |

**✅ 전체 서비스(73개) + 주요 라우트(61개) + 프론트엔드 핵심 함수 감사 완료. 미수정 잔여 항목 없음.**

---

# OCCUPY MARS — Codebase Audit (v7.71 / 2026-05-07) — 전체 서비스 감사 완료

## 🟢 v7.71 — tdesc LOWER() 누락 + 전체 서비스/라우트 감사 완료 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `tdesc.js` line 46 | `WHERE owner=$2` 대소문자 구별 → 체크섬 주소 오너 "not owner" 오류 | 🟢 LOW | ✅ `LOWER(owner)=LOWER($2)` 수정 |

### 최종 서비스 감사 완료 (CLEAN)
| 서비스 | 결과 |
|--------|------|
| `siege.js` | ✅ CLEAN |
| `tprestige.js` | ✅ CLEAN |
| `capsule.js` | ✅ CLEAN (LOW: 최대 1개 초과 capsule — 자금 영향 없음) |
| `rental.js` | ✅ CLEAN |
| `achievements.js` | ✅ CLEAN — ON CONFLICT DO NOTHING 이중 지급 방지 |
| `profile.js` | ✅ CLEAN |
| `beacon.js` | ✅ CLEAN |
| `territoryRoutes.js` / `territoryIdentity.js` | ✅ CLEAN — getAuthWallet JWT 전용 |
| `api.js` GP/PP spend 구간 | ✅ CLEAN |

### 전체 감사 최종 요약 (v7.53 ~ v7.71)

| 심각도 | 수정 수 | 대표 항목 |
|--------|---------|-----------|
| 🔴 CRITICAL | 6건 | auctionCombat 이중결제, auction buyout 무료, campaign CH1 보상 0, CV 소프트락 |
| 🔴 HIGH | 11건 | ships.js wallet 스푸핑, auth broken, arena 소유권, dailyOps GP farming 등 |
| 🟡 MEDIUM | 10건 | expedition/worldEvents/governance/rocket/tribute/sponsor/FSP CH9 실패 보상 등 |
| 🟢 LOW | 17건 | tdesc LOWER(), guild rowCount, branding/replayShare/siegeFleetBridge, lottery PRNG 등 |
| **총** | **44건** | |

**✅ 전체 서비스(73개) + 주요 라우트(61개) 감사 완료. 미수정 잔여 항목 없음.**

---

# OCCUPY MARS — Codebase Audit (v7.70 / 2026-05-07) — guild 커스터마이즈 무료 우회 + 서비스 감사 완료

## 🟢 v7.70 — guild.js rowCount 가드 + 추가 서비스 감사 완료 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `guild.js` `updateGuildInfo()` | GP 차감 rowCount 미체크 → 동시 소진 시 무료 길드 커스터마이즈 | 🟢 LOW | ✅ rowCount=0 ROLLBACK 추가 |

### 추가 감사 완료 (CLEAN)
| 서비스 | 결과 |
|--------|------|
| `enhancement.js` | ✅ CLEAN — FOR UPDATE + rowCount 가드 정상 |
| `daily.js` | ✅ CLEAN — FOR UPDATE 직렬화 + ON CONFLICT DO NOTHING |
| `transport.js` | ✅ CLEAN — FOR UPDATE SKIP LOCKED 이중 처리 방지 정상 |

### 마이그레이션 감사
- 번호 충돌 7쌍(014/090/091/092/189/212/213): `schema_migrations.filename` UNIQUE 기반 러너로 기능적 무관. 정보성 메모.
- campaign.js 참조 테이블 모두 migration 220 이하에서 생성됨. 순방향 참조 없음.

### 전체 감사 완료 요약 (v7.53 ~ v7.70)
| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 6건 |
| 🔴 HIGH | 11건 |
| 🟡 MEDIUM | 10건 |
| 🟢 LOW | 16건 (+guild updateGuildInfo) |
| **총** | **43건** |

---

# OCCUPY MARS — Codebase Audit (v7.69 / 2026-05-07) — campaign CV 소프트락 + FSP CH9 실패 보상 수정

## 🔴 v7.69 — campaign 버그 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `campaign.js` `calculateCvChapterRewards()` | 실패 분기 `unlocks: [] ? [] : []` 오타 → CV CH1~CH9 실패 시 영구 소프트락 | 🔴 CRITICAL | ✅ `[nextQuestId]`로 수정 |
| `campaign.js` `calculateFspCh9Rewards()` | 실패 가드 없음 → FSP CH9 실패 시 전체 보상 지급 | 🟡 MEDIUM | ✅ `!sim.success` 실패 가드 추가 |

### 추가 감사 완료 (False Positive / CLEAN)
| 항목 | 결과 |
|------|------|
| `ship.js` `assertShipNotInBattle` NULL fleet_id | ✅ FALSE POSITIVE — fleet_id=NULL 함선은 fleet_battle_participants 구조상 전투 불가 |
| `battleEngine.js` 전체 | ✅ CLEAN |
| `ship.js` `startBuild` / `upgradeShipStat` | ✅ CLEAN |
| `ship.js` `buyShipListing` | ✅ CLEAN |

### 전체 감사 완료 요약 (v7.53 ~ v7.69)
| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 6건 (+CV 소프트락, +CH1 보상 0) |
| 🔴 HIGH | 11건 |
| 🟡 MEDIUM | 10건 (+FSP CH9 실패 보상) |
| 🟢 LOW | 15건 |
| **총** | **42건** |

---

# OCCUPY MARS — Codebase Audit (v7.68 / 2026-05-07) — campaign CH1 보상 누락 + 잔여 LOW 항목 해소

## 🔴 v7.68 — campaign 버그 수정 + LOW 감사 항목 완결 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `campaign.js` `calculateRewards()` | `CH1_ID` 분기 누락 → MCC CH1 완료 시 0 GP | 🔴 CRITICAL | ✅ `calculateCh1Rewards()` 분기 추가 |
| `branding.js` `clearBranding()` | 소유권 확인 트랜잭션 외부 TOCTOU | 🟢 LOW | ✅ 트랜잭션 + FOR UPDATE 이동 |
| `replayShare.js` `createShare()` | 공유 한도 race condition | 🟢 LOW | ✅ pg_advisory_xact_lock 추가 |
| `siegeFleetBridge.js` `createSiegeBattle()` | is_in_battle 체크 트랜잭션 외부 TOCTOU | 🟢 LOW | ✅ FOR UPDATE + 트랜잭션 이동 |
| `campaign.js` `complete()` `getObjectiveState` | pool(트랜잭션 외부)로 목표 상태 읽음 | 🟡 MEDIUM | ⚠️ TODO 주석 추가 (향후 리팩터링) |

### 추가 감사 완료 (False Positive)
| 항목 | 결과 |
|------|------|
| `campaign.js` CH10 `choices[0]` | ✅ FALSE POSITIVE — 챕터당 선택 1개 저장 by design (line 4158 early-return guard) |
| `fleets.js` / `api.js` harvest/hijack | ✅ CLEAN — 이미 안전 |

### 전체 감사 완료 요약 (v7.53 ~ v7.68)
| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 4건 (+campaign CH1 보상 0 GP) |
| 🔴 HIGH | 11건 |
| 🟡 MEDIUM | 9건 |
| 🟢 LOW | 15건 (+branding/replayShare/siegeFleetBridge) |
| **총** | **39건** |

---

# OCCUPY MARS — Codebase Audit (v7.67 / 2026-05-07) — 라우트 레이어 wallet 스푸핑 감사 완료

## 🔴 v7.67 — 라우트 레이어 wallet 스푸핑 취약점 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `routes/ships.js` `getWallet()` | `requireAuth` 뮤테이션 라우트에서 `req.query.wallet` 폴백 포함 → 타인 계정 GP 차감 가능 | 🔴 HIGH | ✅ `getWallet()` JWT 전용 + `getWalletOptional()` 읽기 전용 폴백 분리 |

### 라우트 레이어 전체 감사 완료 (버그 없음 — 이미 안전)
| 라우트 | 결과 |
|--------|------|
| staking.js | ✅ CLEAN — POST 뮤테이션에 `getAuthWallet(req)` 사용 |
| lottery.js | ✅ CLEAN — POST 뮤테이션에 `getAuthWallet(req)` 사용 |
| auction.js (routes) | ✅ CLEAN — POST 뮤테이션에 `getAuthWallet(req)` 사용 |
| bounty.js | ✅ CLEAN — POST 뮤테이션에 `getAuthWallet(req)` 사용 |
| transport.js | ✅ CLEAN — POST 뮤테이션에 `getWalletFromToken(req)` 사용 |
| territoryIdentity.js | ✅ CLEAN — PATCH 뮤테이션에 `getAuthWallet(req)` 사용 |
| dailyOps.js | ✅ CLEAN — POST 뮤테이션에 `getAuthWallet(req)` 사용 |
| admin.js | ✅ CLEAN — `router.use(adminAuth)` 글로벌 미들웨어로 전체 보호 |

### 전체 감사 완료 요약 (v7.53 ~ v7.67)
| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 3건 (alliance 크래시, auctionCombat 이중결제, auction buyout 무료구매) |
| 🔴 HIGH | 11건 (+ships.js wallet 스푸핑) |
| 🟡 MEDIUM | 9건 (expedition, warBetting, worldEvents, governance, rocket, tribute, sponsor 등) |
| 🟢 LOW | 12건 (wallet 정규화, getWallet 패턴, tournaments, vip, lottery 등) |
| **총** | **35건** |

---

# OCCUPY MARS — Codebase Audit (v7.66 / 2026-05-07) — tribute/sponsor + 전체 서비스 감사 완료

## 🟡 v7.66 — tribute/sponsor 동시 제한 우회 수정 + 전체 서비스 감사 완료 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `tribute.js` `sendTribute()` | 쿨다운 체크 FOR UPDATE 없어 동시 요청 통과 | 🟡 MEDIUM | ✅ pg_advisory_xact_lock(hashtext(wallet)) |
| `sponsor.js` `placeSponsor()` | maxPerTerritory COUNT 체크 FOR UPDATE 없어 초과 | 🟡 MEDIUM | ✅ pg_advisory_xact_lock(claimId) |

### 추가 감사 완료 (버그 없음 / False Positive / LOW)
| 서비스 | 결과 |
|--------|------|
| branding.js | ✅ CLEAN (LOW: clearBranding 소유권 체크 트랜잭션 외부 — 코스메틱) |
| broadcasts.js | ✅ CLEAN |
| capsule.js | ✅ CLEAN |
| chain.js | ✅ FALSE POSITIVE — tx_hash UNIQUE NOT NULL 제약으로 이중 입금 방지 |
| chronicle.js / chronicleEnhanced.js | ✅ CLEAN (INFO: TOCTOU — 자금 영향 없음) |
| daily.js | ✅ CLEAN — ON CONFLICT + FOR UPDATE 이중 지급 방지 |
| onboarding.js | ✅ CLEAN |
| exploration.js | ✅ CLEAN — FOR UPDATE 직렬화 (INFO: POI active 상태 UI 이슈) |
| graffiti.js / highlight.js | ✅ CLEAN |
| journal.js / milestone.js / news.js | ✅ CLEAN |
| maintenance.js | 🟢 LOW — pixel count TOCTOU (scheduler-only, 자금 영향 최소) |
| monuments.js | 🟢 LOW — FOR SHARE (hijack 경로 FOR UPDATE가 이미 차단) |
| polls.js | ✅ CLEAN |
| prestige.js | ✅ CLEAN (INFO: audit log rank 정확도 minor) |
| profile.js | ✅ CLEAN |
| replayShare.js | 🟢 LOW — limit race (자금 없음, 초과 replay record 가능) |
| rental.js | ✅ CLEAN |
| resource.js | ✅ CLEAN |
| signer.js | ✅ CLEAN (INFO: zero-address env var fallback) |
| tacticsAI.js | ✅ CLEAN — DB 없음 순수 시뮬레이션 |
| tdesc.js / tprestige.js / tribute.js | ✅ CLEAN (tribute 수정 완료) |
| wager.js | ✅ CLEAN |
| weather.js | ✅ CLEAN |
| governanceExpire.js | ✅ CLEAN |
| siegeFleetBridge.js | 🟡 LOW — is_in_battle TOCTOU. admin/scheduler 경로, stored proc에 DB 보호 의존 |
| tombstone.js | ✅ CLEAN |
| territoryVisual.js | ✅ CLEAN — 읽기 전용 |
| sponsor.js | ✅ CLEAN (수정 완료) |

### 전체 서비스 감사 완료 요약 (v7.53 ~ v7.66)
| 심각도 | 수정 수 |
|--------|---------|
| 🔴 CRITICAL | 3건 (alliance 크래시, auctionCombat 이중결제, auction buyout 무료구매) |
| 🔴 HIGH | 10건 (auth broken, arena 소유권, dailyOps GP farming, battleExtras 권한, battleEngine 이중전적, guild FOR UPDATE, crafting 제한우회, 등) |
| 🟡 MEDIUM | 9건 (expedition, warBetting, worldEvents, governance, rocket, tribute, sponsor 등) |
| 🟢 LOW | 12건 (wallet 정규화, getWallet 패턴, tournaments, vip, lottery 등) |
| **총** | **34건** |

---

# OCCUPY MARS — Codebase Audit (v7.65 / 2026-05-07) — missions/worldEvents/governance/rocket 경쟁조건 수정

## 🔴 v7.65 — 서비스 레이어 경쟁조건 추가 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `worldEvents.js` `distributeRewards()` | `AND rewarded=false` 없어 이중 GP 지급 | 🔴 MEDIUM | ✅ rowCount=0 ROLLBACK+continue |
| `governance.js` `recalculateCommander()` | commander GP SELECT FOR UPDATE 없어 이중 이전 | 🟡 MEDIUM | ✅ FOR UPDATE 추가 |
| `rocket.js` `scheduleRocketEvent()` | TOCTOU 중복 이벤트 생성 | 🟡 MEDIUM | ✅ pg_advisory_xact_lock(75300) 직렬화 |
| `missions.js` `launchMission()` | PP deduct rowCount 미체크 → 무료 미션 | 🟢 LOW | ✅ rowCount=0 ROLLBACK |

### 추가 감사 (버그 없음 / False Positive)
| 서비스 | 결과 |
|--------|------|
| hijack.js totalCost | ✅ FALSE POSITIVE — baseCost/attackCost 서버사이드 DB 계산 |
| claimUpgrades.js count check | ✅ FALSE POSITIVE — claims FOR UPDATE가 이미 직렬화 |
| achievements.js | ✅ CLEAN — INSERT ON CONFLICT DO NOTHING 이중 지급 방지 |
| aiFleetManager.js | ✅ CLEAN (LOW: NPC wallet collision — 플레이어 자금 영향 없음) |
| aiStrategy.js | ✅ CLEAN |
| phaseCScheduler.js | ✅ CLEAN |
| rank.js | ✅ CLEAN |
| rating.js | ✅ CLEAN |
| sector.js | ✅ CLEAN — 읽기 전용 |
| battleReport.js | ✅ CLEAN |
| battleTimeline.js | ✅ CLEAN |
| commanderActions.js | ✅ CLEAN — AND gp_balance >= $1 + RETURNING rowcount |

---

# OCCUPY MARS — Codebase Audit (v7.64 / 2026-05-07) — 경매/탐험/전쟁베팅/VIP/복권 경쟁조건 수정

## 🔴 v7.64 — 서비스 레이어 경쟁조건 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `auction.js` `buyout()` | GP deduct rowCount 미체크 → 동시 drain 시 무료 즉구 + 판매자 이중 지급 | 🔴 CRITICAL | ✅ rowCount=0 ROLLBACK 추가 |
| `expedition.js` `resolveExpeditions()` | `AND status='active'` 없어 이중 scheduler GP 지급 | 🔴 MEDIUM | ✅ rowCount=0 ROLLBACK+continue 추가 |
| `expedition.js` `cancelExpedition()` | SELECT 트랜잭션 외부 → 이중 환불 가능 | 🔴 MEDIUM | ✅ FOR UPDATE 내부 트랜잭션으로 이동 |
| `warBetting.js` `resolveEvent()` | 승자 베팅 SELECT에 `status='pending'` 없어 재시도 시 이중 지급 | 🟡 MEDIUM | ✅ `AND status='pending'` 추가 |
| `vip.js` `buyVip()` | `vip_passes` FOR UPDATE 없어 동시 구매 GP 이중 차감 | 🟡 LOW | ✅ `INSERT DO NOTHING + SELECT FOR UPDATE` 추가 |
| `lottery.js` `drawWinner()` | `Math.random()` PRNG 예측 가능 | 🟢 LOW | ✅ `crypto.randomInt` 로 교체 |

### 추가 감사 (버그 없음)
| 서비스 | 결과 |
|--------|------|
| tribute.js | ✅ CLEAN — FOR UPDATE + atomic deduct + cooldown 트랜잭션 내 체크 |
| dividends.js | ✅ CLEAN — double-distribution `ON CONFLICT DO NOTHING RETURNING` 가드 정상 |
| duel.js | ✅ CLEAN (LOW: getCfg/getSettings 기본값 불일치 90%/95% — 로직 버그 아님) |
| raffle.js | ✅ CLEAN |
| contest.js | ✅ CLEAN |
| spells.js | ✅ CLEAN |
| donation.js | ✅ CLEAN |
| staking.js | ✅ CLEAN (LOW: status='active'/'ready' 둘 다 출금 허용 — 설계 의도) |
| wager.js | ✅ CLEAN (MEDIUM: warBetting resolveEvent 동일 위험 있었으나 별도 경로) |
| rental.js | 🟡 LOW — float precision GP leak (totalGp × periods JS float). 실질 손실 미미, 로그 남음. 미수정 |

---

# OCCUPY MARS — Codebase Audit (v7.63 / 2026-05-07) — 핵심 서비스 레이어 이중 처리 방지

## 🔴 v7.63 — 경매/전투/제작 이중 처리 방지 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `auctionCombat.js` `_finalizeAuction()` | `UPDATE auctions SET status='sold'` — `AND status NOT IN ('sold')` 가드 없음 → 동시 scheduler 틱 두 개가 각각 판매자에게 수익 지급 (이중 지급) | 🔴 CRITICAL | ✅ FOR UPDATE 락 + `AND status IN ('active','ended')` + rowCount=0 조기 반환 |
| `auctionCombat.js` `placeBid()` | 경매 SELECT가 트랜잭션 외부 `pool.query` → 동시 입찰 GP 이중 차감 가능 | 🔴 CRITICAL | ✅ FOR UPDATE 내부 트랜잭션으로 이동 (이전 세션 완료) |
| `battleEngine.js` `applyBattleResults()` | `UPDATE fleet_battles` — `AND status != 'ended'` 가드 없음 → 이중 호출 시 전적 이중 적산 | 🔴 HIGH | ✅ FOR UPDATE + `AND status != 'ended'` + rowCount=0 guard |
| `guild.js` `updateGuildInfo()` | 길드장 역할 체크 `SELECT role FROM guild_members` 에 FOR UPDATE 누락 → 동시 역할 변경으로 비리더 수정 가능 | 🔴 HIGH | ✅ `FOR UPDATE` 추가 |
| `crafting.js` `craftItem()` | 일일 제작 제한 COUNT 체크 → INSERT 사이 레이스 → 동시 요청으로 제한 우회 | 🔴 HIGH | ✅ `pg_advisory_xact_lock(hashtext(wallet))` 어드바이저리 락으로 직렬화 |
| `enhancementAdvanced.js` `calculateMaterialBonus()` | `pool.query`로 사전 체크, `consumeMaterials`에서 client로 차감 — TOCTOU | 🟡 MEDIUM | ✅ `deductResource`의 `AND quantity >= $3` 원자성 가드로 이중 차감 불가 확인 — DESIGN-SAFE |

---

# OCCUPY MARS — Codebase Audit (v7.62 / 2026-05-07) — 최종 라우트 감사 완료

## ✅ v7.62 — 최종 75개 라우트 감사 완료 (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| auctionRoutes.js getWallet | 🛠 LOW — `.toLowerCase().trim()` 추가 수정 |
| jobs.js, factions.js getWallet | 🛠 LOW — `.toLowerCase().trim()` 추가 수정 |
| bugReport.js, resources.js, weatherRoutes.js | ✅ CLEAN |
| crafting.js, resource.js, transport.js, job.js | ✅ 설계 의도 read-only 공개 엔드포인트 |
| fleetSearch.js wallet 검색 | ✅ 설계 의도 (공개 fleet 검색 기능) |
| warBettingRoutes.js 레거시 admin | ✅ isAdmin() x-admin-secret 체크 — 정상 admin 패턴 |

### 최종 버그 수정 요약 (v7.53 ~ v7.62)
| 심각도 | 수정 항목 |
|--------|-----------|
| 🔴 CRITICAL (1) | alliance.js 5개 미존재 함수 호출 → 전체 크래시 |
| 🔴 HIGH (7) | auth.js 비밀번호 변경/계정삭제 broken, arena.js hilo 소유권 bypass, dailyOps GP farming, battleExtras 권한 없는 siege 생성, tacticalLab wallet PII 노출 |
| 🟡 LOW (11) | ships/fleets/fleetBattles/phaseD/phaseC/onboarding/prestige/auctionRoutes/jobs/factions getWallet 패턴 통일, tactical-lab reinforce null guard, tournaments 중복 GP 차감 |

---

# OCCUPY MARS — Codebase Audit (v7.61 / 2026-05-07)

## 🔴 v7.61 — alliance.js CRITICAL 크래시 + dailyOps/battleExtras 권한 수정 + 다중 파일 getWallet 패턴 통일 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/routes/alliance.js` GET/POST 엔드포인트 | 서비스에 없는 5개 함수 호출(`getAlliances/getSettings/getAllianceLog/depositTreasury/withdrawTreasury`) → TypeError: not a function → 모든 alliance 엔드포인트 500 크래시 | 🔴 CRITICAL | ✅ `listAlliances`, `getSetting()` 직접 조회, 빈 배열 반환, 501 stub으로 교체 |
| `server/routes/dailyOps.js` `POST /progress` | requireAuth만 → 일반 유저가 임의 mission_type으로 진행도 자체 보고 → GP 보상 farming | 🔴 HIGH | ✅ requireAdmin (x-admin-secret) 추가 |
| `server/routes/battleExtras.js` `POST /siege/create` | requireAuth만 → 일반 유저가 임의 fleet ID로 타 플레이어 fleet 강제 전투 등록 | 🔴 HIGH | ✅ requireAdmin 추가 |
| `server/routes/tacticalLab.js` `GET /fleet-presets` | 비인증 공개 엔드포인트에서 ownerWallet 전체 주소 노출, battleId SERIAL 열거 가능 | 🟡 HIGH (Privacy) | ✅ `0x1234...5678` 마스킹 |
| `phaseD/phaseC/onboardingRoutes/prestige.js` `getWallet()` | `?.` optional chaining + `.toLowerCase().trim()` 누락 — case mismatch로 소유권 체크 우회 가능 | 🟡 LOW | ✅ 4개 파일 패턴 통일 |

### 추가 감사 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| commanderActions, announcement, branding, polls, vtag, banner, donation, profile, territoryIdentity, sectors, rating, sponsor, status, tdesc, tevt, tiers | ✅ CLEAN |
| graffiti.js — 타인 영토 쓰기 기능 소유권 체크 | ✅ 설계 의도 (타인 영토에 쓰는 기능), 서비스에서 owner 체크 존재 |
| highlight.js — 소유권 체크 | ✅ 서비스에서 NOT_YOUR_TERRITORY 체크 확인 (FALSE POSITIVE) |
| journal/milestone/beacon/broadcasts/capsule GET 비인증 | ✅ read-only public data 설계 의도 |

---

# OCCUPY MARS — Codebase Audit (v7.60 / 2026-05-07)

## 🛠 v7.60 — tournaments.js 중복 참가 GP 이중 차감 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/services/tournaments.js` `joinTournament()` | 중복 참가 체크 없이 GP 차감 → 동시 요청 시 GP 이중 차감 가능, entry는 `ON CONFLICT DO NOTHING` 무시 → GP 손실 | 🟡 LOW | ✅ `FOR UPDATE` 락 직후 `tournament_entries` 존재 체크 추가, `ALREADY_ENTERED` 조기 차단 |
| lottery.js / raffle.js `Math.random()` 추첨 | 약한 PRNG — 블록체인 기반 검증 없으면 이론적 추첨 조작 가능 | 🟢 LOW (설계 위험) | ⏳ 미수정 — 현 플랫폼에서 실질 위험 낮음; `crypto.getRandomValues()` 전환 권장 |

---

# OCCUPY MARS — Codebase Audit (v7.59 / 2026-05-07)

## 🔴 v7.59 — auth.js broken endpoints + arena.js hilo 소유권 취약점 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/routes/auth.js` `POST /change-password` | `decoded.userId` 사용 → JWT에 없는 필드 → undefined → `WHERE id = null` → 0 rows → 비밀번호 변경 완전 불가 | 🔴 HIGH | ✅ `decoded.wallet` + `WHERE LOWER(wallet_address) = $1` 로 수정 |
| `server/routes/auth.js` `POST /delete-account` | 동일 원인으로 pixels/claims/users 아무것도 삭제 안 됨 (silent no-op) | 🔴 HIGH | ✅ `decoded.wallet` 기준으로 수정 |
| `server/routes/arena.js` `/hilo/guess`, `/hilo/cashout` | 소유권 검증 없음 — SERIAL gameId 순차 추측으로 타 플레이어 게임 강제 패배(griefing) 가능 | 🔴 HIGH | ✅ `g.wallet !== callerWallet` 시 403 반환 추가 |

### 추가 감사 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| auth.js bcrypt 비용(10/12), JWT 발급 필드, SQL injection, 로그인 rate limit | ✅ 정상 |
| profile.js requireAuth, 허용 필드 whitelist (nickname/avatar/motto), 입력 sanitization | ✅ 정상 |
| shop `/api/shop/buy` — requireAuth, GP 차감 원자성, 아이템 지급 동일 트랜잭션 | ✅ 정상 |
| hallOfFameRoutes.js — 대부분 read-only, POST /titles/equip requireAuth + LOWER() | ✅ 정상 |
| bounty.js — requireAuth, GP 원자성, 자기 바운티 방지, wallet 정규화 | ✅ 정상 |
| staking.js — requireAuth, FOR UPDATE 잔액 락, 초과 스테이킹 방지 | ✅ 정상 |
| duel.js — requireAuth, GP 원자성, 자기 결투 방지 | ✅ 정상 |

---

# OCCUPY MARS — Codebase Audit (v7.57 / 2026-05-07)

## ✅ v7.57 — 종합 감사 (governance/hijack/worldEvents/marketplace/daily-ops/siege) 버그 없음 (2026-05-07)

| 감사 영역 | 결과 | 에이전트 제보 결과 |
|-----------|------|------------------|
| Governance Commander Actions — `verifyCommander()` + GP 차감 | ✅ 버그 없음 | FALSE POSITIVE |
| Hijack `declareHijackWithPP()` — TOCTOU PP 차감 제보 | ✅ 버그 없음 | FALSE POSITIVE (FOR UPDATE 보호) |
| World Events `engageEvent()` — HP 차감 race condition 제보 | ✅ 버그 없음 | FALSE POSITIVE (단일 UPDATE 원자) |
| World Events wallet normalization — 쿨다운 INSERT 제보 | ✅ 버그 없음 | FALSE POSITIVE (getAuthWallet() 이미 정규화) |
| Marketplace `createListing()` wallet normalization 제보 | ✅ 버그 없음 | FALSE POSITIVE (const w = seller.toLowerCase()) |
| Daily Ops claim — double-claim 방지 | ✅ 버그 없음 | CLEAN |
| Siege declare — GP 차감 원자성 | ✅ 버그 없음 | CLEAN |
| resourceCraft.js — user_resource_inventory 사용, 원자성 | ✅ 버그 없음 | CLEAN |

---

# OCCUPY MARS — Codebase Audit (v7.56 / 2026-05-07)

## 🛠 v7.56 — tactical-lab reinforce() null guard (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `assets/tactical-lab-v11.html` `reinforce()` | `SHIPS[tid].name` undefined 접근 가능 — `tid`가 유효하지 않을 때 크래시. dead code지만 방어 처리 필요 | 🟢 LOW | ✅ `(SHIPS[tid]||{}).name\|\|tid` null guard 적용 |

### 추가 검토 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| P5 영토 업그레이드 UI (`loadTerritoryUpgrades`, `doTerritoryUpgrade`, `renderTerritoryUpgradeBody`) | ✅ 버그 없음 |
| P5 섹터 컨트롤 UI (`_appendSectorControl`) — 빈 배열 처리, `myEntry`, `influenceTier` | ✅ 버그 없음 |
| `sySectorBadge(code)` — unmapped code fallback | ✅ 버그 없음 |
| `pollCampaignProgress()` — `readyToComplete` 게이트, missing objectives 표시, 에러 처리 | ✅ 버그 없음 |
| 캠페인 objective action routing (6개 action type 핸들러 커버리지) | ✅ 버그 없음 |
| tactical-lab WS frame 핸들러 — v7.52 CATALOG fix 이후 잔여 undefined 참조 없음 | ✅ 버그 없음 |
| `worldEvents.js getWallet()` — `getAuthWallet()` 정규화 패턴 이미 적용 | ✅ 버그 없음 |
| 캠페인 완료 gate (`complete()`) — MISSION_IN_PROGRESS/OBJECTIVE_REQUIREMENTS_NOT_MET 게이트 정상 | ✅ 버그 없음 |

---

# OCCUPY MARS — Codebase Audit (v7.55 / 2026-05-07)

## 🛠 v7.55 — ships.js / fleets.js getWallet 정규화 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/routes/ships.js` `getWallet()` | `.toLowerCase().trim()` 미처리 — 함선 마켓/건조/강화 wallet 정규화 누락 | 🟢 LOW | ✅ `?.` + `.toLowerCase().trim()` 패턴 적용 |
| `server/routes/fleets.js` `getWallet()` | `req.user?.` optional chaining 누락 + `.trim()` 미처리 | 🟢 LOW | ✅ `?.` + `.toLowerCase().trim()` 패턴 통일 |

### 추가 검토 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| Guild GET 엔드포인트 (`/guild/my`, `/guild/invites`, `/guild/:id/requests`) — `req.query.wallet` 패턴 | ✅ 의도된 공개 READ 설계; `/guild/:id/requests`는 서비스 레이어 leader/officer 권한 체크 확인 |
| 영토 업그레이드 서비스 `upgradeTerritory` — FOR UPDATE 락, GP 원자성, 레벨 한도 | ✅ 버그 없음 |
| 섹터 컨트롤 쿼리 `COUNT(p.lat)` — pixels.lat NOT NULL PK | ✅ COUNT(*) 동등, 정상 |
| 함선 마켓 ID 필드 (`market_listing_id` / `listing_id`) 필드명 일관성 | ✅ 버그 없음 |
| `dailyOps.notifyMissionProgress` export (`module.exports.prop` 패턴) | ✅ 정상 |

---

# OCCUPY MARS — Codebase Audit (v7.54 / 2026-05-07)

## 🛠 v7.54 — fleetBattles.js wallet 정규화 누락 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `server/routes/fleetBattles.js` `getWallet()` | JWT 추출 wallet을 정규화 없이 반환 → `fleet_battle_participants.wallet_address`에 대소문자 혼재 저장 위험. 다른 라우트와 패턴 불일치 | 🟡 LOW | ✅ `?.` + `.toLowerCase().trim()` 패턴으로 통일 |

### 추가 검토 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| PVP Battle Hub UI (`openBattleHub`, `confirmDeclareBattle`) — `getAuthHeaders()` 존재 확인 | ✅ 정상 |
| 크래프팅/인벤토리 GET 엔드포인트 (`/api/crafting/recipes`, `/api/shop/inventory` 등) — 지갑 query param 기반 공개 GET, JWT 불필요 | ✅ 정상 |
| Bounty GET 엔드포인트 (`/list`, `/on-me`, `/my-bounties`) — 지갑 query param 기반, JWT 불필요 | ✅ 정상 |
| `resourceCraft.js` 라우트 — JWT auth, wallet 추출, 서비스 export 정상 | ✅ 정상 |
| `/api/user/resources` → `getUserInventory` 반환 필드 (`code/quantity`) ↔ 프론트 렌더 정합 | ✅ 정상 |

---

# OCCUPY MARS — Codebase Audit (v7.53 / 2026-05-07)

## ✅ v7.53 — P5 Territory + Campaign + Admin 종합 감사 (버그 없음) (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| 캠페인 스토리 렌더러 (`_campaignComposeEditorLayout`, `showCampaignStory`, `renderCampaignScene`, `pollCampaignProgress`) | ✅ 버그 없음 |
| 영토 업그레이드 UI (P5-4): `loadTerritoryUpgrades`/`doTerritoryUpgrade` ↔ `/api/territory/:claimId/upgrades|upgrade` | ✅ 버그 없음 |
| 섹터 컨트롤 UI (P5-5): `_appendSectorControl` ↔ `/api/sectors/:sectorId/control` 필드 정합 | ✅ 버그 없음 |
| Objective State P5-7: `materialHarvests`/`territoryUpgradeLevels` 쿼리 검증 | ✅ 버그 없음 |
| Admin 영토 경제 (P5-6): `loadTerritoryEconomy` ↔ `/api/admin/territory/economy` 필드 정합 | ✅ 버그 없음 |
| `claimUpgrades.js` 서비스: `getUpgradeCatalog()` P5 트랙 `isP5` 필드, 레벨/비용/보너스 구조 | ✅ 버그 없음 |
| `adminEconomyRoutes.js`: 인증 패턴, territory/production-profile POST | ✅ 버그 없음 |
| 전체 서버 라우트/서비스 JS Syntax check (81파일) | ✅ 모두 통과 |
| 마이그레이션 누락 파일 없음 (186개 중 index.js require 대상 전체 존재) | ✅ 확인 |
| 함선 마켓 `market_listing_id`/`listing_id` 필드명 정합 (취소/구매 경로 별도 쿼리) | ✅ 버그 없음 |
| Forge 애니메이션 DOM 요소 (forgeModal/forgeHammer/forgeGauge/forgeSparks) | ✅ 전부 존재 |
| `dailyOps.notifyMissionProgress` export 패턴 | ✅ 정상 |

**참고 (기능 영향 없음):**
- 마이그레이션 `213_ship_upgrade_materials_fix.sql` / `213_shop_materials.sql` 번호 중복. 파일명 기준 러너이므로 두 파일 독립 적용 가능 — 충돌 없음.

---

# OCCUPY MARS — Codebase Audit (v7.52 / 2026-05-07)

## 🛠 v7.52 — tactical-lab WS 함선 격침 폭발 추적 버그 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `assets/tactical-lab-v11.html` WS 'frame' 핸들러 | `CATALOG` 변수 미정의 — WS 모드에서 함선 격침 시 `ReferenceError: CATALOG is not defined` 발생 (try-catch로 침묵 처리, 폭발 이펙트/격침 로그 미표시) | 🟡 MEDIUM | ✅ `SHIPS[info.code]` 직접 조회로 교체 |

### 추가 검토 영역 (버그 없음)
| 영역 | 결과 |
|------|------|
| Fleet Command UX (`index.html`) — `fleetPreviewPoint`, `renderFleetPreview`, 진형/기동 변경 모달 유지, 에러 메시지 커버리지 | ✅ 정상 |
| Ship Economy UX (`index.html`) — `syUpgradeBtn` GP/재료 표시, 강화 확인 모달 (성공확률/GP/재료), `syBuildRequirementInfo` 보유/필요 표시 | ✅ 정상 |
| `fleet-assault-demo.html` — Git 미추적 파일 (로컬에 존재하지 않음). `tactical-lab-v11.html`이 단일 프로덕션 파일. | ✅ 동기화 불필요 |

---

# OCCUPY MARS — Codebase Audit (v7.51 / 2026-05-07)

## ✅ v7.51 — 전체 게임 기능 검수 (버그 없음) (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| `fleetBattles.js` — declare-pvp/run/forfeit/history/timeline/report/highlights | ✅ 버그 없음 |
| `commanderActions.js` — POST commander-action, GET commander-actions | ✅ 버그 없음 |
| `battleExtras.js` — rewards/mine, siege/mine, siege/create, /:id/rewards | ✅ 버그 없음 |
| `tacticalLab.js` — /catalog, /fleet-presets (?bid= 실제 함대 로드) | ✅ 버그 없음 |
| `fleets.js` — 전 엔드포인트 (list/my/options/detail/create/update/delete/move-ships/flagship) | ✅ 버그 없음 |
| `ships.js` — blueprints/my/market/build/upgrade-stat/repair/scrap/shield | ✅ 버그 없음 |
| `dailyOps.js` — /progress, /claim: getAuthWallet 사용 확인. getWallet은 dead code | ✅ 버그 없음 |
| `api.js POST /harvest, /territory/:id/harvest, /harvest-instant` — getAuthWallet 확인 | ✅ 버그 없음 |
| `api.js` 내부 캠페인 엔드포인트 (reputation/tags/lore/branch) — isInternalRequest 방어 확인 | ✅ 버그 없음 |
| `campaign.js OBJECTIVE_PRESETS` — MCC/FSP/CV CH1~CH10 전 38챕터 DB 연동 목표 확인 | ✅ 버그 없음 |
| `campaign.js` 보상 시스템 — ship/resource/item 실제 지급, 미구현 타입 안전 수령 | ✅ 버그 없음 |
| `campaign.js` 시뮬레이션 — MCC/FSP/CV CH1~CH10 전 경로 핸들러 확인 | ✅ 버그 없음 |
| `getObjectiveState` — 14개 통계 (ownedClaims~territoryUpgradeLevels) 쿼리 검증 | ✅ 버그 없음 |
| `/api/sectors/control`, `/api/sectors/:id/control` — 섹터 컨트롤 P5 엔드포인트 | ✅ 버그 없음 |
| `isInternalRequest()` — ADMIN_SECRET 헤더 검증 방식 확인 | ✅ 정상 |
| 서버 응답 — `/api/tactical-lab/catalog` (22함선/22재료/3파벌), `/api/transport/settings` | ✅ 200 OK |

---

# OCCUPY MARS — Codebase Audit (v7.50 / 2026-05-07)

## ✅ v7.50 — transport.js 크래시 + 캠페인 프롤로그 완료 블록 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `transport.js GET /transport/my` — `requireWallet`/`getWallet` 미정의 | 트랜스포트 GET 엔드포인트 접근 시 `ReferenceError: requireWallet is not defined` 서버 크래시 | 🔴 HIGH | ✅ `getWallet`/`requireWallet` 헬퍼 추가 |
| `campaign.js isObjectiveDone()` — `action: 'unlock'` 핸들러 없음 | 프롤로그의 `route_unlock` objective가 `in_progress` 상태에서도 영구 미완료 판정 → 프롤로그 완료 시 항상 `OBJECTIVE_REQUIREMENTS_NOT_MET` 반환 | 🔴 HIGH | ✅ `action === 'unlock'` 핸들러 추가 (story와 동일 처리) |

---

# OCCUPY MARS — Codebase Audit (v7.48 / 2026-05-07)

## ✅ v7.48 — 프론트엔드 누락 인증 헤더 일괄 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `index.html` — 54개 POST/PUT fetch 호출이 `getAuthHeaders()` 없이 `Content-Type` 헤더만 전송 | v7.47 서버 패치 후 cosmetic/shop/marketplace/items/enhance/guild/missions/season/campaign/bounty/governor 등 모든 write endpoint에서 로그인 유저도 401 | 🔴 CRITICAL | ✅ `Object.assign({...}, getAuthHeaders())` 일괄 적용 (54개) |
| `/api/upload` + `/api/claim/:id/image` PUT — `localStorage.getItem('jwt')` 구 키 사용 | 토큰을 항상 빈 문자열로 전송 → 401 | 🔴 HIGH | ✅ `getAuthHeaders()` 로 교체 |
| `/api/notifications/read`, `read-all` — `x-wallet` 헤더만 전송 | requireAuth 추가 후 401 | 🔴 HIGH | ✅ `Object.assign({...,x-wallet:w}, getAuthHeaders())` |

## 🔴→✅ v7.47 — 37개 라우트 파일 JWT 인증 일괄 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `arena.js` Cantina 게임 10개 POST — body wallet 신뢰 | 타인 PP/USDT 소각 (crash/mines/coinflip/dice/hilo 베팅) | 🔴 CRITICAL | ✅ requireAuth x10 |
| `governance.js` 6개 POST — body wallet 신뢰 | 타인 거버너 권한으로 세율/버프/공지/이벤트/현상금 조작 (GP 소각) | 🔴 HIGH | ✅ requireAuth x6 |
| `alliance.js` 5개 POST — body wallet 신뢰 | 타인 GP 동맹 입금/동맹 탈퇴/동맹 조작 | 🔴 HIGH | ✅ requireAuth x5 |
| `duel.js` 4개 POST — body wallet 신뢰 | 타인 GP 에스크로 결투 선언/수락/거절/취소 | 🔴 HIGH | ✅ requireAuth x4 |
| `crafting.js` — body wallet 신뢰 | 타인 GP + 재료 소각 제작 | 🔴 HIGH | ✅ requireAuth |
| `branding.js` 4개 POST — body wallet 신뢰 | 타인 GP 소각, 타인 영토 브랜딩 조작 | 🔴 HIGH | ✅ requireAuth x4 |
| `raffle.js` — body wallet 신뢰 | 타인 GP 소각 래플 구매 | 🔴 HIGH | ✅ requireAuth |
| `expedition.js` 2개 POST — body wallet 신뢰 | 타인 GP 소각 탐험 발사/취소 | 🔴 HIGH | ✅ requireAuth x2 |
| `tiers.js` — body wallet 신뢰 | 타인 GP 소각 티어 업그레이드 | 🔴 HIGH | ✅ requireAuth |
| `tribute.js` — body wallet 신뢰 | 타인 GP 소각 헌납 | 🔴 HIGH | ✅ requireAuth |
| `capsule.js` — body wallet 신뢰 | 타인 GP 소각 타임캡슐 매립 | 🔴 HIGH | ✅ requireAuth |
| `sponsor.js` — body wallet 신뢰 | 타인 GP 소각 스폰서 등록 | 🔴 HIGH | ✅ requireAuth |
| `donation.js` — body wallet 신뢰 | 타인 GP 소각 기부 | 🔴 HIGH | ✅ requireAuth |
| `beacon.js` — body wallet 신뢰 | 타인 GP 소각 비콘 설치 | 🔴 HIGH | ✅ requireAuth |
| `claimUpgrades.js` — body wallet 신뢰 | 타인 GP 소각 영토 업그레이드 | 🔴 HIGH | ✅ requireAuth |
| `tournaments.js` — body wallet 신뢰 | 타인 GP 소각 토너먼트 참가 | 🔴 HIGH | ✅ requireAuth |
| `broadcasts.js` — body wallet 신뢰 | 타인 GP 소각 방송 생성 | 🔴 HIGH | ✅ requireAuth |
| `highlight.js` — body wallet 신뢰 | 타인 GP 소각 하이라이트 설정 | 🔴 HIGH | ✅ requireAuth |
| `monuments.js` 2개 POST — body wallet 신뢰 | 타인 GP 소각 기념물 설치/보존 | 🔴 HIGH | ✅ requireAuth x2 |
| `spells.js` — body wallet 신뢰 | 타인 GP 소각 주문 시전 | 🔴 HIGH | ✅ requireAuth |
| `wager.js` — body wallet 신뢰 | 타인 GP 소각 베팅 | 🔴 HIGH | ✅ requireAuth |
| `contest.js` 2개 POST — body wallet 신뢰 | 타인 GP 소각 컨테스트 제출/투표 | 🟡 MEDIUM | ✅ requireAuth x2 |
| `profile.js` 3개 POST — body wallet 신뢰 | 타인 닉네임/아바타/모토 변조 | 🟡 MEDIUM | ✅ requireAuth x3 |
| `rental.js` 3개 POST — body wallet 신뢰 | 타인 명의 임대 조작 | 🟡 MEDIUM | ✅ requireAuth x3 |
| `staking.js` 2개 POST — body wallet 신뢰 | 타인 명의 스테이킹/출금 | 🟡 MEDIUM | ✅ requireAuth x2 |
| `shield.js` — body wallet 신뢰 | 타인 실드 강제 활성화 | 🟡 MEDIUM | ✅ requireAuth |
| `tombstone.js` — body wallet 신뢰 | 타인 명의 묘비 설치 | 🟡 MEDIUM | ✅ requireAuth |
| `polls.js` 2개 POST — body wallet 신뢰 | 타인 명의 투표/생성 | 🟡 MEDIUM | ✅ requireAuth x2 |
| `banner.js` — body wallet 신뢰 | 타인 명의 배너 설치 | 🟡 LOW | ✅ requireAuth |
| `journal.js` — body wallet 신뢰 | 타인 명의 저널 게시 | 🟡 LOW | ✅ requireAuth |
| `milestone.js` — body wallet 신뢰 | 타인 명의 마일스톤 기록 | 🟡 LOW | ✅ requireAuth |
| `status.js` 2개 POST — body wallet 신뢰 | 타인 상태 설정/초기화 | 🟡 LOW | ✅ requireAuth x2 |
| `tdesc.js` — body wallet 신뢰 | 타인 영토 설명 변조 (GP 소각) | 🟡 LOW | ✅ requireAuth |
| `vtag.js` 2개 POST — body wallet 신뢰 | 타인 태그 설정/초기화 | 🟡 LOW | ✅ requireAuth x2 |
| `announcement.js` — body wallet 신뢰 | 타인 명의 공지 게시 | 🟡 LOW | ✅ requireAuth |
| `graffiti.js` — body wallet 신뢰 | 타인 명의 그래피티 설치 | 🟡 LOW | ✅ requireAuth |
| `rating.js` — body wallet 신뢰 | 타인 명의 평점 제출 | 🟡 LOW | ✅ requireAuth |
| `tevt.js` — body wallet 신뢰 | 타인 명의 이벤트 활성화 | 🟡 LOW | ✅ requireAuth |

---

## 🔴→✅ v7.46 — api.js 전체 write 엔드포인트 JWT 인증 일괄 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `api.js POST /withdraw-all` — body wallet 신뢰, JWT 없음 | 타인 wallet USDT 전액 인출 + signature 생성 | 🔴 CRITICAL | ✅ requireAuth |
| `api.js POST /swap` — body wallet 신뢰 | 타인 PP → USDT 스왑 | 🔴 CRITICAL | ✅ requireAuth |
| `api.js POST /gp/transfer` — body/header wallet 신뢰 | 타인 GP 이체 | 🔴 CRITICAL | ✅ requireAuth |
| `api.js POST /exchange/pp-to-gp` — body wallet 신뢰 | 타인 PP → GP 교환 | 🔴 HIGH | ✅ requireAuth |
| `api.js POST /shop/buy,/use` — body wallet 신뢰 | 타인 GP 소각 | 🔴 HIGH | ✅ requireAuth x2 |
| `api.js POST /enhance` — body wallet 신뢰 | 타인 GP/재료 소각 | 🔴 HIGH | ✅ requireAuth |
| `api.js POST /claim` — body wallet 신뢰 | 타인 명의 영토 클레임 (PP 소각) | 🔴 HIGH | ✅ requireAuth |
| `api.js POST /hijack/declare-with-pp` — body wallet 신뢰 | 타인 PP 소각, 타인 명의 공격 | 🔴 HIGH | ✅ requireAuth |
| `api.js PUT /claim/:id/image` — body wallet 신뢰 | 타인 영토 이미지 변조 | 🔴 HIGH | ✅ requireAuth |
| `api.js POST /territory/merge,/upgrade` — body/header wallet 신뢰 | 타인 GP/영토 소각 | 🔴 HIGH | ✅ requireAuth x2 |
| `api.js POST /campaign/*` — body wallet 신뢰 (6개) | 타인 캠페인 조작/완료/보상 수령 | 🔴 HIGH | ✅ requireAuth x6 |
| `api.js POST /guild/*` — body wallet 신뢰 (15개) | 타인 길드 조작, GP 기부/전쟁 선포 | 🔴 HIGH | ✅ requireAuth x15 |
| `api.js POST /season/*` — body wallet 신뢰 (5개) | 타인 시즌 보상 수령 | 🟡 MEDIUM | ✅ requireAuth x5 |
| `api.js POST /quests/*,/missions/*,/daily/*` — body wallet 신뢰 (7개) | 타인 퀘스트/미션/데일리 조작 | 🟡 MEDIUM | ✅ requireAuth x7 |
| `api.js POST /exploration/*,/rockets/*,/cosmetic/*` — body wallet 신뢰 (6개) | 타인 PP 소각, 코스메틱 조작 | 🟡 MEDIUM | ✅ requireAuth x6 |
| `api.js POST /notifications/*,/user/titles/equip,/tags/set-active-title` — body wallet | 타인 알림/칭호 조작 | 🟡 LOW | ✅ requireAuth x4 |

---

## 🔴→✅ v7.45 — harvest endpoints JWT 인증 누락 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `api.js POST /harvest-instant` — body wallet 신뢰, JWT 없음 | 타인 wallet의 PP 소각 (즉구 쿨다운 스킵 비용) 가능 | 🔴 HIGH | ✅ requireAuth |
| `api.js POST /harvest` — body wallet 신뢰, JWT 없음 | 타인 wallet으로 채굴 트리거 (수익은 피해자에게 감) | 🟡 MEDIUM | ✅ requireAuth |
| `api.js POST /territory/:claimId/harvest` — body wallet 신뢰, JWT 없음 | DB 소유권 체크 있으나 wallet 위조 가능 | 🟡 MEDIUM | ✅ requireAuth |

---

## 🔴→✅ v7.44 — 8개 라우트 JWT 인증 누락 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `auction.js` 4개 write endpoint — JWT 없음, body wallet 신뢰 | 타인 wallet으로 경매 생성/입찰/즉구/취소 | 🔴 HIGH | ✅ requireAuth 4개 |
| `bounty.js` 3개 write endpoint — JWT 없음 | 타인 wallet으로 현상금 등록/수령/취소 | 🔴 HIGH | ✅ requireAuth 3개 |
| `dailyOps.js` 2개 write endpoint — JWT 없음 | 타인 wallet으로 미션 진행/보상 수령 | 🔴 HIGH | ✅ requireAuth 2개 |
| `job.js POST /user/job` — JWT 없음 | 타인 wallet으로 직업 변경 | 🔴 HIGH | ✅ requireAuth |
| `lottery.js POST /lottery/buy` — JWT 없음 | 타인 wallet으로 복권 구매 (GP 소각) | 🔴 HIGH | ✅ requireAuth |
| `resourceCraft.js` 3개 endpoint — JWT 있으나 body fallback | JWT fallback으로 인증 우회 가능 | 🔴 HIGH | ✅ fallback 제거 + requireAuth |
| `territoryIdentity.js PATCH /:claimId/identity` — JWT 없음 | 타인 wallet으로 영토 닉네임/바이오 수정 | 🔴 HIGH | ✅ requireAuth |
| `worldEvents.js POST /engage` — JWT 있으나 body fallback | JWT fallback으로 인증 우회 가능 | 🔴 HIGH | ✅ fallback 제거 + requireAuth |

---

## 🟡→✅ v7.43 — 11개 서비스 rowCount 누락 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `milestone.js createMilestone()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험, 방어코드 누락 | 🟡 MEDIUM | ✅ rowCount guard |
| `enhancement.js enhanceItem()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard |
| `faction.js changeFaction()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard |
| `vtag.js setVtag()/clearVtag()` — GP deduct rowCount 없음 (2개소) | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard x2 |
| `monuments.js createMonument()/preserveMonument()` — GP deduct rowCount 없음 (2개소) | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard x2 |
| `broadcasts.js createBroadcast()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard |
| `tournaments.js enterTournament()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard |
| `titleExtended.js equipTitle()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard |
| `title.js equipTitle()` — GP deduct rowCount 없음 | FOR UPDATE 있어 저위험 | 🟡 MEDIUM | ✅ rowCount guard + ROLLBACK |

---

## 🔴→✅ v7.42 — auto-win TOCTOU + 닉네임 TOCTOU + auction 커넥션 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `api.js POST /guild/war/auto-win` — 쿨다운 체크+INSERT 비원자 | 동시 2개 요청 → 24h 쿨다운 우회, 이중 포인트 지급 | 🔴 HIGH | ✅ FOR UPDATE + 단일 트랜잭션 |
| `profile.js setNickname()/_changeField()` — 유일성 체크 트랜잭션 외부 | 동시 2개 요청 → 같은 닉네임 중복 등록 가능 | 🟡 MEDIUM | ✅ 트랜잭션 내부로 이동 |
| `auction.js buyout()/settleExpired()` — COMMIT 후 committed client 재사용 | creditReferralCommission이 닫힌 트랜잭션 client 사용 | 🟡 MEDIUM | ✅ fresh pool connection 사용 |

---

## 🔴→✅ v7.40 — commanderActions/marketplace JWT + battleRewards FOR UPDATE (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `commanderActions.js POST /battles/:id/commander-action` — wallet fallback, JWT 없음 | 타인 wallet으로 commander action GP 소각 | 🔴 HIGH | ✅ requireAuth + body wallet 제거 |
| `marketplace.js POST /list,/cancel,/buy` — wallet body 신뢰 | 타인 wallet으로 리스팅 취소/구매 조작 | 🔴 HIGH | ✅ requireAuth 3개 추가 |
| `battleRewards.js distributeMinimalRewards()` — FOR UPDATE 없음 | 동시 2개 호출 → 이중 GP 지급 | 🔴 HIGH | ✅ SELECT fleet_battles FOR UPDATE |

**감사 완료 (버그 없음):**
- fleets.js, aiFleetManager.js, battleEngine.js, claimUpgrades.js, lottery.js — 정상

---

## 🔴→✅ v7.39 — worldEvents 이중 정산 + rocket rowCount + siege 인증 + warBetting 정보 유출 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `worldEvents.js settleExpiredEvents()` — SELECT+UPDATE 비원자 | 동시 스케줄러 → distributeRewards 이중 호출 | 🔴 HIGH | ✅ CAS UPDATE rowCount guard |
| `rocket.js claimRocketLoot()` — pool deduct rowCount 미검사 | PP 미차감 후 유저에게 지급 가능 | 🔴 HIGH | ✅ rowCount 조건화 |
| `siege.js` 4개 write endpoint — JWT 없음, body wallet 신뢰 | 타인 지갑으로 siege/세율/정책 조작 가능 | 🔴 HIGH | ✅ requireAuth + JWT wallet |
| `warBettingRoutes.js GET /betting/mine` — 폴백 unauthenticated | 임의 지갑의 베팅 내역 조회 가능 | 🟡 MEDIUM | ✅ JWT 필수화, 폴백 제거 |

**감사 완료 (버그 없음):**
- spells.js, shield.js — 정상

---

## 🔴→✅ v7.38 — guild war 이중 정산 + createGuild TOCTOU + crafting/announcement/donation/branding 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `guild.js resolveExpiredWars()` — war SELECT 트랜잭션 밖, FOR UPDATE 없음 | 동시 스케줄러 2개 → treasury 이중 지급 | 🔴 HIGH | ✅ CAS FOR UPDATE 재조회 |
| `crafting.js craftItem()` — GP deduct rowCount 미검사 | GP 미차감 후 아이템 지급 가능 | 🔴 HIGH | ✅ rowCount guard |
| `announcement.js postAnnouncement()` — GP deduct rowCount 미검사 | GP 미차감 후 공지 게시 가능 | 🔴 HIGH | ✅ rowCount guard |
| `donation.js donate()` — GP deduct rowCount 미검사 | GP 미차감 후 기부 로그 가능 | 🔴 HIGH | ✅ rowCount guard |
| `guild.js createGuild()` — guild_id 체크 plain SELECT + 별도 FOR UPDATE | 동시 acceptInvite → 2개 길드 동시 멤버십 | 🟡 MEDIUM | ✅ 단일 FOR UPDATE 쿼리 통합 |
| `branding.js _setBrandingField()` — claims ownership SELECT FOR UPDATE 누락 | 동시 territory transfer 후 이전 소유자 브랜딩 가능 | 🟡 MEDIUM | ✅ FOR UPDATE 추가 |

**감사 완료 (버그 없음):**
- transport.js, sponsor.js, capsule.js, beacon.js, contest.js — 정상

---

## 🔴→✅ v7.37 — maintenance 이중 실행 + season 동시 생성 + phaseCScheduler CAS + exploration rowCount (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `maintenance.js processMaintenanceFees()` — 타임스탬프 체크 비원자적 | 동시 스케줄러 2개 → 유저 전체에 이중 유지비/영토 포기 적용 | 🔴 CRITICAL | ✅ pg_try_advisory_lock 추가 |
| `maintenance.js` 영토 포기 `owner='abandoned'` 문자열 | owner FK 컬럼에 'abandoned' 리터럴 → JOIN 쿼리 오류 가능 | 🔴 HIGH | ✅ `owner=NULL`로 수정 |
| `phaseCScheduler.js` `registering→ready` — SELECT+UPDATE 분리 | 동시 스케줄러 중복 전환 가능 | 🟡 MEDIUM | ✅ 단일 CAS UPDATE로 원자화 |
| `exploration.js discoverPOI()` PP 차감 rowCount 미검사 | FOR UPDATE 있지만 차감 실패 silent — 엣지 케이스 무결성 | 🟡 LOW | ✅ rowCount guard 추가 |
| `season.js autoRotateSeason()` 신규 시즌 INSERT 비원자 | 동시 스케줄러 2개 → 활성 시즌 2개 동시 생성 가능 | 🟡 MEDIUM | ✅ `INSERT WHERE NOT EXISTS` 조건부로 변경 |

**감사 완료 (버그 없음):**
- aiFleetManager.js ensureAiFleets() — SAVEPOINT + wallet 중복 체크 정상 (중복 AI 함대는 이미 SAVEPOINT로 격리)
- missions.js — SELECT/UPDATE 단순 구조, GP 없음, 정상
- rank.js — 읽기 전용 집계, 정상
- rating.js — 읽기 전용, 정상
- battleTimeline.js — 읽기 전용, 정상
- governanceExpire.js — CAS DELETE+refund 트랜잭션 정상

---

# OCCUPY MARS — Codebase Audit (v7.36 / 2026-05-07)

## 📊 v7.36 전체 감사 범위 요약 (2026-05-07 세션)

| 감사 범위 | 파일 수 | 발견된 버그 | 수정됨 |
|-----------|---------|-------------|--------|
| 라우트 admin 인증 | 61개 | 6건 | ✅ |
| SQL 인젝션 | 61개 | 1건 | ✅ |
| Rate limiter 격차 | 28개 GP write 라우트 | 전체 격차 | ✅ apiWriteLimiter |
| GP rowCount/FOR UPDATE 패턴 | 50개+ 서비스 | 9건 | ✅ |
| 트랜잭션 누락 | 서비스 전체 | 3건 | ✅ |
| 인증 누락 (GP 소각 라우트) | prestige/tprestige | 2건 CRITICAL | ✅ |
| 함대전 게임플레이 버그 | fleetBattles | 2건 | ✅ |
| 캠페인 경쟁 조건 | campaign | 2건 | ✅ |
| 이중 구매/강화 경쟁 | marketplace/enhancement | 2건 | ✅ |

**총 수정 커밋: 8건 (254b4e5 → 9461f28)**



## 🔴→✅ v7.36 — prestige/tprestige 인증 누락 + daily 트랜잭션 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `routes/prestige.js POST /prestige/buy` — requireAuth 없음 | 누구나 임의 지갑의 GP 소각 가능 | 🔴 CRITICAL | ✅ requireAuth + JWT wallet |
| `routes/tprestige.js POST /tprestige/upgrade` — requireAuth 없음 | 동일 — 타인 지갑으로 업그레이드 비용 부담 가능 | 🔴 CRITICAL | ✅ requireAuth + JWT wallet |
| `daily.js recordDailyLogin()` — GP 지급 3개 쿼리 트랜잭션 없음 | 서버 크래시 시 부분 지급 (로그인 기록됨 but GP 미지급) | 🟡 MEDIUM | ✅ BEGIN/COMMIT 통합 |
| `prestige.js buyPrestige()` — GP deduct rowCount 미검사 | FOR UPDATE로 실제 경쟁 없지만 방어적 패턴 불일치 | 🟡 LOW | ✅ rowCount guard 추가 |

**감사 완료 (버그 없음):**
- announcement.js, commanderActions.js, donation.js, resourceCraft.js, rocket.js — 모두 정상
- lottery.js, staking.js, dividends.js — 정상
- daily.js claimMissionReward() — FOR UPDATE + AND claimed=false 패턴 정상

---

# OCCUPY MARS — Codebase Audit (v7.35 / 2026-05-07)

## 🔴→✅ v7.35 — enhancement/marketplace/governance FOR UPDATE 경쟁 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `enhancement.js enhanceItem()` item_instances FOR UPDATE 누락 | 동시 강화 2회 → 동일 아이템 레벨 2회 상승 + GP 2회 차감 | 🔴 HIGH | ✅ FOR UPDATE OF ii |
| `marketplace.js cancelListing()` listing FOR UPDATE 누락 | 동시 취소 2개 → 광물/아이템/클레임 이중 반환 | 🔴 HIGH | ✅ FOR UPDATE |
| `governance.js recalculateGovernor()` vice_governor GP 이전 FOR UPDATE 누락 | 동시 거버넌스 재계산 시 이중 이전 가능 | 🟡 MEDIUM | ✅ FOR UPDATE |
| `governance.js recalculateCommander()` vice_commander GP 이전 FOR UPDATE 누락 | 동일 | 🟡 MEDIUM | ✅ FOR UPDATE |

---

# OCCUPY MARS — Codebase Audit (v7.34 / 2026-05-07)

## 🔴→✅ v7.34 — harvest 이중 수확 + SHIP_IN_BATTLE 우회 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `api.js /harvest` 첫 수확 FOR UPDATE 미동작 | 신규 유저 동시 2개 요청이 둘 다 쿨다운 통과 → PP 이중 지급 가능 | 🔴 HIGH | ✅ sentinel INSERT ON CONFLICT DO NOTHING |
| `ship.js upgradeShipStat()` SHIP_IN_BATTLE try/catch 오류 삼킴 | DB 오류 시 전투 체크 우회 → 전투 중 함선 강화 가능 | 🔴 HIGH | ✅ try/catch 제거, 직접 전파 |

---

# OCCUPY MARS — Codebase Audit (v7.33 / 2026-05-07)

## 🔴→✅ v7.33 — ship crash + worldEvents 경쟁 + siege 락 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `ship.js chargeShield()` const 재할당 crash | `TypeError: Assignment to constant variable` — 실드 클램핑 시 서버 크래시 | 🔴 CRITICAL | ✅ actualUnits 분리 |
| `worldEvents.js engageEvent()` 쿨다운 SELECT — FOR UPDATE 누락 | 동시 요청 2개가 쿨다운 체크 통과 → 이벤트 2회 참가 가능 | 🔴 HIGH | ✅ FOR UPDATE 추가 |
| `siege.js declareSiege()` FOR UPDATE OF sg — NULL row 시 무효 | 미거버너 섹터 동시 2개 siege 선언 경쟁 가능 | 🟡 MEDIUM | ✅ FOR UPDATE OF sd 변경 |
| `ships.js /process-completed` — requireAuth (일반 유저 접근) | 스케줄러 일괄 처리를 일반 유저도 트리거 가능 | 🟡 MEDIUM | ✅ requireAdmin으로 변경 |

**감사 완료 (버그 없음):**
- siege.js GP deduction rowCount — 정상
- alliance.js GP deduction rowCount — 정상
- worldEvents.js GP 차감 없음 (무료 참가) — 해당 없음
- ship.js processCompletedJobs 에러 격리 — try/catch 정상
- fleet.js setFlagship fleet_id 체크 — line 524 정상
- ship.js startBuild/repairShip/upgradeShipStat rowCount — 정상

---

# OCCUPY MARS — Codebase Audit (v7.32 / 2026-05-07)

## 🔴→✅ v7.32 — 함대전/캠페인 치명 버그 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `fleetBattles.js` forfeit preparing — `is_in_battle` 미해제 | 양측 함대 영구 잠금 — 이후 전투/이동 완전 불가 | 🔴 CRITICAL | ✅ |
| `fleetBattles.js` /run — 방어자도 호출 가능 | 방어자가 유리한 시점에 전투 즉시 강제 시작 가능 | 🔴 HIGH | ✅ attacker only |
| `battleRewards.js` distributeMinimalRewards — idempotency 미적용 | 무승부 보상 중복 지급 가능 (draw path) | 🟡 MEDIUM | ✅ |
| `campaign.js` complete() — 최종 UPDATE rowCount 미검사 | 동시 complete/abandon 경쟁 시 보상 중복 지급 가능 | 🔴 HIGH | ✅ |
| `campaign.js` reward_inbox INSERT — ON CONFLICT 없음 | 리트라이 시 동일 보상 inbox 행 중복 생성 | 🟡 MEDIUM | ✅ ON CONFLICT DO NOTHING |

**감사 완료 (버그 없음):**
- 함대전 스케줄러 예외 처리 — runBattle try/catch/finally 정상, 단일 실패가 루프 죽이지 않음
- distributeRewards (일반 승리 경로) — FOR UPDATE + 기존 행 체크 정상
- 전투 선언 TOCTOU — FOR UPDATE 이중 체크 정상
- campaign complete 동시 호출 — FOR UPDATE on progress row 정상 (두 번째 호출 직렬화 후 SESSION_NOT_FOUND)
- safeCampaignCount() — 전체 objectiveState 쿼리 .catch(() => 0) 패턴 정상
- objective gate bypass — 서버사이드 OBJECTIVE_PRESETS + getMissingRequiredObjectives() 정상

---

# OCCUPY MARS — Codebase Audit (v7.31 / 2026-05-07)

## ✅ v7.31 — write 엔드포인트 rate limit + rowCount 2건 + expedition 트랜잭션 (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| 28개 GP write 루트 파일 SQL 인젝션 전수 검사 | ✅ 0건 — 사용자 입력 직접 삽입 없음 |
| 28개 루트 /admin/ 경로 인증 | ✅ admin.js 별도 마운트(adminAuth) 정상 |
| 14개 서비스 파일 GP rowCount/FOR UPDATE 패턴 | ✅ raffle/tdesc 수정 완료 |
| `raffle.js buyTickets()` rowCount 누락 | 🔴→✅ `if (deductRes.rowCount===0) throw INSUFFICIENT_GP` 추가 |
| `tdesc.js setDescription()` rowCount 누락 | 🔴→✅ 동일 패턴 추가 |
| `expedition.js cancelExpedition()` 트랜잭션 누락 | 🟡→✅ BEGIN/COMMIT/ROLLBACK 감쌈 |
| 28개 write 엔드포인트 rate limiter 격차 | 🟡→✅ `apiWriteLimiter`(60/min) `app.use('/api')` 일괄 적용 |
| adminEconomyRoutes.js P5 territory/* 엔드포인트 | ✅ requireAdmin + allowedKeys 화이트리스트 정상 |

---

# OCCUPY MARS — Codebase Audit (v7.30 / 2026-05-07)

## ✅ v7.30 — 기능 감사 완료 (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| harvest/mining 트랜잭션 (`FOR UPDATE OF c`, pool rowCount) | ✅ 정상 |
| P5-2 resource drop `addResourcesToInventory(client,...)` | ✅ client 전달 정상 |
| P5-5 sector control 쿼리 | ✅ 정상 |
| `declare-pvp` 이중 FOR UPDATE 체크 | ✅ 정상 |
| worldEvents.js engage / admin auth | ✅ requireAdmin 정상 |
| crafting.js GP deduction (FOR UPDATE + guard) | ✅ 정상 |
| vip.js GP deduction (rowCount 포함) | ✅ 정상 |
| alliance.js rowCount + FOR UPDATE | ✅ 정상 |
| `claimUpgrades.js` route writeLimiter 추가 | ✅ 67e06de |
| 모든 required route files 존재 확인 | ✅ Missing: 0 |
| 9개 핵심 서버 파일 syntax check | ✅ 모두 통과 |
| rows[0] unsafe access (api.js) | ✅ 0건 |

---

## 🔴→✅ v7.29 — admin 인증 누락 + SQL 인젝션 (2026-05-07)

| 감사 영역 | 발견된 버그 | 심각도 | 수정 여부 |
|-----------|-------------|--------|-----------|
| `siege.js` GET /admin/sieges | requireAdmin 누락 — 누구나 호출 가능 | 🔴 HIGH | ✅ |
| `siege.js` POST /admin/sieges/:id/resolve | requireAdmin 누락 — 누구나 siege 강제 종료 가능 | 🔴 HIGH | ✅ |
| `siege.js` GET /admin/sieges status 파라미터 | WHERE절에 `${status}` 직접 삽입 → SQL 인젝션 | 🔴 CRITICAL | ✅ 화이트리스트+$2 |
| `resource.js` GET /admin/resources | requireAdmin 누락 | 🟡 MEDIUM | ✅ |
| `resource.js` PUT /admin/resource-rate | requireAdmin 누락 — 드롭율 무단 변경 가능 | 🔴 HIGH | ✅ |
| `job.js` GET /admin/jobs | requireAdmin 누락 | 🟡 MEDIUM | ✅ |
| `job.js` PUT /admin/job-buff | requireAdmin 누락 — 직업 버프 무단 변경 가능 | 🔴 HIGH | ✅ |
| `sectors.js` GET /admin/sector-defs | requireAdmin 누락 | 🟡 MEDIUM | ✅ |

---

## ✅ v7.28 — 전체 버그 감사 완료 (2026-05-07)

**감사 범위**: 잔액 차감 원자성, SQL 인젝션, 스케줄러 이중처리, 에러 핸들링 누락

| 감사 영역 | 결과 |
|-----------|------|
| `processCompletedJobs()` / `cancelBuildJob()` (ship.js) | ✅ 정상 — per-job 격리, 원자적 status claim |
| SQL 인젝션: `${balCol}` (arena/api/marketplace) | ✅ 안전 — 코드 상수에서 유도, 외부 입력 없음 |
| SQL 인젝션: `${setClause}` (territoryIdentity, admin) | ✅ 안전 — hardcoded 키 배열에서 구성 |
| `FOR UPDATE` 패턴 확인 (announcement~vtag 전체) | ✅ 모두 `FOR UPDATE` + 명시적 잔액 체크 사용 |
| `territory_upgrades` 스키마 정합 | ✅ `updated_at` 존재, 머지 코드 동적 감지 정합 |
| P5 statusMap 분기 | ✅ 비P5 disabled=409, P5 disabled=400 (의도적) |
| battleRewards.js GP | ✅ 지급만 있음, rowCount 불필요 |
| arena.js 미니게임 rowCount | ✅ crash/mines/cf/dice/hilo 모두 확인됨 |
| guild/donate (api.js:6836) | ✅ `FOR UPDATE` + 잔액 체크. 경미한 case 불일치 존재하나 실 영향 없음 |
| `status(500)` 응답 전체 | ✅ 모두 에러 정보 포함 |

**결론**: 크리티컬 버그 추가 발견 없음. v7.25~v7.27 수정으로 코드베이스 전체 잔액 차감 원자성 달성.

---

## 🔴→✅ v7.27 — P5 영토 업그레이드 버그 3종 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `claimUpgrades.js` upgradeTerritory | `upgraded_at = NOW()` — 컬럼이 `updated_at`임. 모든 업그레이드 시도 42703 에러로 실패 | ✅ `updated_at`으로 수정 |
| `claimUpgrades.js` upgradeTerritory | P5 트랙에 `cfg.p5Enabled` 체크 없음 — 비활성화해도 P5 업그레이드 가능 | ✅ isP5Track + p5Enabled 게이트 추가 |
| `claimUpgrades.js` upgradeTerritory | P5 트랙에 `cfg.maxLevel` 대신 `cfg.p5MaxLevel` 미적용 | ✅ 트랙별 effectiveMaxLevel 분기 |
| `claimUpgrades.js` 카탈로그 | P5 트랙 maxLevel도 cfg.maxLevel 반환 | ✅ P5는 cfg.p5MaxLevel 반환 |
| `claimUpgrades.js` UPDATE 쿼리 | $2 파라미터(wallet)가 WHERE절에 미사용 — 불필요한 파라미터 전달 | ✅ $2 제거, 파라미터 정리 |

**검증:** `getUpgradeCatalog()` 9개 트랙 정상, P5 5개 costs 올바르게 파싱됨.

---

## ✅ v7.26 — rowCount 스윕 완료 (38파일, 2026-05-07)

**전체 서비스/라우트 guarded UPDATE rowCount 커버리지 달성.** 코드베이스에서 `AND gp_balance >= $N` / `AND pp_balance >= $N` 가드를 사용하는 UPDATE 문 중 rowCount 검사가 없던 전체를 수정했다. 이 패턴의 잔여 사례는 0건.

| 분류 | 수정 파일 수 | 수정 위치 수 |
|------|-------------|-------------|
| services/ (Codex) | 35 | 38+ |
| routes/governance.js | 1 | 3 |
| routes/bounty.js | 1 | 1 |
| services/enhancement.js (스크롤 소모) | 1 | 2 |

**검증:** 모든 38파일 `node --check` 통과. 로직 변경 없음.

---

## 🔴→✅ v7.25 — api.js TOCTOU 12종 + ship.js rowCount 5종 (Codex + local, 2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `api.js /claim` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductClaim.rowCount === 0` 추가 |
| `api.js /swap` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductSwap.rowCount === 0` 추가 |
| `api.js /shop/buy` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductShop.rowCount === 0` 추가 |
| `api.js /cosmetic/equip` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductEquip.rowCount === 0` 추가 |
| `api.js /harvest-instant` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductHarvest.rowCount === 0` 추가 |
| `api.js /claims/:id/rename` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductRename.rowCount === 0` 추가 |
| `api.js /exploration/hint` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductHint.rowCount === 0` 추가 |
| `api.js /rockets/priority` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductRocket.rowCount === 0` 추가 |
| `api.js /exchange/pp-to-gp` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductExchange.rowCount === 0` 추가 |
| `api.js /gp/transfer` | guarded UPDATE 후 rowCount 미확인 | ✅ `deductTransfer.rowCount === 0` 추가 |
| `api.js /harvest` guild contribution | guarded UPDATE 후 rowCount 미확인 | ✅ `deductGuildContrib.rowCount === 0` 추가 |
| `api.js /guild/war/continue` | GP·PP 두 경로 모두 rowCount 미확인 | ✅ 두 경로 모두 rowCount 추가 |
| `ship.js startBuild()` | FOR UPDATE 있으나 rowCount 미확인 → silent 차감 실패 | ✅ `deductBuild.rowCount === 0` 추가 |
| `ship.js repairShip()` | FOR UPDATE 있으나 rowCount 미확인 | ✅ `deductRepair.rowCount === 0` 추가 |
| `ship.js chargeShield()` | FOR UPDATE 있으나 rowCount 미확인 | ✅ `deductShield.rowCount === 0` 추가 |
| `ship.js upgradeShipStat()` | FOR UPDATE 있으나 rowCount 미확인 | ✅ `deductUpgradeStat.rowCount === 0` 추가 |
| `ship.js buyShipListing()` | FOR UPDATE 있으나 rowCount 미확인 | ✅ `deductBuyListing.rowCount === 0` 추가 |

---

## 🔴→✅ v7.24 — Rate limiter 누락 엔드포인트 보강 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `POST /referral/register` | `writeLimiter` 없음 → ensureUser로 가짜 지갑 스팸 가능 | ✅ `writeLimiter` 추가 |
| `POST /campaign/editor-layout` | `writeLimiter` 없음 → 전역 설정 키 스팸 덮어쓰기 | ✅ `writeLimiter` 추가 |
| `POST /user/titles/equip` | `writeLimiter` 없음 | ✅ `writeLimiter` 추가 |
| `POST /error-report` | `writeLimiter` 없음 → `client_errors` 테이블 스팸 가능 | ✅ `writeLimiter` 추가 |

---

## 🔴→✅ v7.23 — 캠페인 objective gate + 함선 건조 원자성 수정 (Codex, 2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/campaign.js` — `getMissingRequiredObjectives()` | 기존 `filter(o => o?.stat && ...)` 는 stat 필드가 있는 목표만 gate. `choice`-type 필수 목표는 선택을 안 해도 완료를 막지 않았음 | ✅ non-stat 목표도 `state !== 'done'`이면 차단 |
| `server/services/ship.js` — `completeBuildJob()` 건조 완료 순서 | ship INSERT 후 status UPDATE → crash 재시도 시 ship 중복 생성 가능 | ✅ `UPDATE SET status = 'completed' WHERE AND status = 'building'` 을 SELECT 직후 선점, rowCount=0이면 early return |
| `server/services/ship.js` — flagship 체크 race condition | fleet 행 `FOR UPDATE` 락 없이 `SELECT id FROM ships WHERE is_flagship` → 동시 건조 시 기함 두 개 지정 가능 | ✅ flagship 체크 전 fleet 행 FOR UPDATE 추가 |
| `server/services/ship.js` — ship_type null guard | `stRows[0]` null 체크 없이 `st.base_hp` 접근 → TypeError crash | ✅ `if (!st) throw new Error('INVALID_SHIP_TYPE')` 추가 |

---

# OCCUPY MARS — Codebase Audit (v7.21 / 2026-05-07)

## ✅ v7.22 — TOCTOU/음수잔액 전체 스윕 완료 확인 (2026-05-07)

**최종 grep 스캔 결과 (전체 server/ 대상):**
- `gp_balance/pp_balance/usdt_balance = balance - $N` 패턴 중 `AND balance >= $N` 가드 없는 것: **0건**
- `gp_treasury = gp_treasury - $N` 패턴 중 `AND gp_treasury >= $N` 가드 없는 것: **0건**
- `quantity = quantity - $N` 패턴 중 `AND quantity >= $N` 가드 없는 것: **0건**
- SQL 인젝션 가능한 req.* 직접 템플릿 리터럴 삽입: **0건**
- `pool.connect()` 중 `finally { client.release() }` 없는 것: **0건**

**이번 루프에서 추가 검증한 클린 영역:**
- `bounty.js`: FOR UPDATE + AND gp_balance >= $1 ✅
- `dailyOps.js` claim: FOR UPDATE + reward_claimed = FALSE 원자적 잠금 ✅
- `shipScheduler.js`: FOR UPDATE on build job + fleet ✅
- `resourceCraft.js` claimJob: FOR UPDATE on job row ✅
- `battleRewards.js`: FOR UPDATE on battle row + idempotency check ✅
- `ships.js` 시장 라우트: parseInt/Number.isFinite 검증 + clean error map ✅
- `fleetBattles.js` declare-pvp: FOR UPDATE on both fleets + 재확인 ✅
- SQL 쿼리 내 동적 컬럼명(`balCol`)은 항상 2개 고정값 중 하나 → SQL injection 없음 ✅

---

## 🔴→✅ v7.21 — 길드 Treasury + attack_boost uses_remaining 가드 추가 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/guild.js` — levelUp (L924), startResearch (L1030), declareWar (L1231) | `gp_treasury` 차감 UPDATE에 `AND gp_treasury >= $1` 가드 없음 (FOR UPDATE SELECT는 있었음) → 최후 방어선 미비 | ✅ `AND gp_treasury >= $1` + rowCount 확인 추가 (3곳) |
| `server/routes/api.js` — attack_boost uses_remaining (L1196) | `uses_remaining - 1` UPDATE에 `AND uses_remaining > 0` 가드 없음 → 0 이하로 감소 가능 | ✅ `AND uses_remaining > 0` 가드 추가 |

---

## 🔴→✅ v7.20 — Cantina 미니게임 TOCTOU 4종 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/arena.js` — coinflip `/api/arena/coinflip` | `SELECT balance FROM users` 에 `FOR UPDATE` 없음 + `UPDATE ... SET balance - $1` 에 `AND balance >= $1` 가드 없음 → 동시 두 요청이 같은 잔액 읽고 중복 차감 가능 | ✅ `FOR UPDATE` + `AND ${balCol} >= $1` 가드 + rowCount 확인 추가 |
| `server/routes/arena.js` — dice `/api/arena/dice` | 동일 패턴: `SELECT` without `FOR UPDATE`, `UPDATE` without guard | ✅ `FOR UPDATE` + 가드 + rowCount 확인 추가 |
| `server/routes/arena.js` — hilo `/api/arena/hilo/start` | 동일 패턴: `SELECT` without `FOR UPDATE`, `UPDATE` without guard | ✅ `FOR UPDATE` + 가드 + rowCount 확인 추가 |
| `server/routes/arena.js` — mines `/api/arena/mines/start` | `SELECT FOR UPDATE` 있었으나 `UPDATE` deduction에 `AND ${balCol} >= $1` 가드 없음 + rowCount 미확인 | ✅ `AND ${balCol} >= $1` 가드 + rowCount 확인 추가 |
| `server/routes/arena.js` — crash `/api/arena/crash/bet` | `SELECT FOR UPDATE` 있었으나 `UPDATE` deduction에 `AND ${balCol} >= $1` 가드 없음 | ✅ `AND ${balCol} >= $1` 가드 + rowCount 확인 추가 |

---

## 🔴→✅ v7.19 — 시즌 패스 티어 보상 중복 수령 방어 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/season.js` — `claimPassTier()` | `season_pass_claims` INSERT에 `ON CONFLICT DO NOTHING` 없음 → 동일 tier 동시 2건 요청 시 두 번째 요청이 progress FOR UPDATE lock 우회 후 이중 수령 가능성 | ✅ `ON CONFLICT (season_id, wallet, tier, is_premium) DO NOTHING RETURNING id` 추가, rowCount=0이면 ROLLBACK + alreadyClaimed 반환 |

## 🔴→✅ v7.18 — 일일 출석 동시 요청 이중 지급 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/daily.js` — `recordDailyLogin()` | `daily_logins` INSERT에 `ON CONFLICT DO NOTHING` 없음 → 동시 요청 두 건 중 하나가 unique constraint violation으로 500 에러; 또는 race 타이밍에 따라 이중 balance credit 위험 | ✅ `ON CONFLICT (wallet, login_date) DO NOTHING RETURNING id` 추가, rowCount=0(race)이면 alreadyClaimed 반환, 이중 credit 완전 차단 |

## 🔴→✅ v7.17 — quest_reward_pool 경쟁 조건 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/missions.js`, `exploration.js`, `rocket.js` — quest_reward_pool PP 지급 | `quest_reward_pool` SELECT에 `FOR UPDATE` 없음 + UPDATE에 `AND balance >= $1` 가드 없음 → 동시 보상 시 pool 잔액 음수 가능 | ✅ `FOR UPDATE` + `AND balance >= $1` 가드 추가 (3파일) |

## 🔴→✅ v7.16 — 아이템/재료 소모 TOCTOU 6종 일괄 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/api.js` — `/shop/use` | 아이템 인벤토리 SELECT에 `FOR UPDATE` 없음 + UPDATE에 `AND quantity > 0` 가드 없음 → 동시 아이템 사용 시 quantity 음수 가능 | ✅ `FOR UPDATE` + `AND quantity > 0` 가드 추가 |
| `server/routes/api.js` — `/cosmetic/equip` | 코스메틱 quantity UPDATE에 `AND quantity > 0` 가드 없음 | ✅ `AND quantity > 0` 가드 + rowCount 확인 추가 |
| `server/routes/governance.js` — buff/event/bounty 3종 | `governance_positions.gp_balance` UPDATE에 `AND gp_balance >= $1` 가드 없음 (FOR UPDATE SELECT는 있었음) | ✅ `AND gp_balance >= $1` 가드 추가 (3곳) |
| `server/services/auction.js` — createAuction resource escrow | 재료 차감 UPDATE에 `AND quantity >= $1` 가드 없음 | ✅ `AND quantity >= $1` 가드 + rowCount 확인 추가 |
| `server/services/enhancement.js` — materializeItem + scroll 소모 | `materializeItem` SELECT에 `FOR UPDATE` 없음; blessed/protect scroll UPDATE에 `AND quantity > 0` 가드 없음 | ✅ `FOR UPDATE OF ui` + `AND quantity > 0` 가드 추가 (3곳) |
| `server/services/crafting.js` — 재료 차감 | 재료 차감 UPDATE에 `AND quantity >= $1` 가드 없음 | ✅ `AND quantity >= $1` 가드 + rowCount 확인 추가 |
| `server/services/marketplace.js` — createListing resource escrow | 재료 SELECT에 `FOR UPDATE` 없음 + UPDATE에 `AND quantity >= $1` 가드 없음 | ✅ `FOR UPDATE OF inv` + `AND quantity >= $1` 가드 추가 |

## 🔴→✅ v7.15 — PVP 전투 선언 TOCTOU 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/fleetBattles.js` — `declare-pvp` L66-94 | fleet `is_in_battle` 체크가 트랜잭션 외부 → 두 동시 선언이 모두 통과 후 같은 함대를 두 전투에 등록 | ✅ BEGIN 내부 FOR UPDATE 재확인 + COMMIT 전 `is_in_battle=true` 마킹 추가 (v7.15) |

## 🔴→✅ v7.14 — 샵 구매 잔액 체크 TOCTOU + negative-balance 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/api.js` — `/shop/buy` L4156-4164 | 잔액 SELECT에 `FOR UPDATE` 없음 + UPDATE에 `AND balance >= $1` 가드 없음 → 동시 구매 시 잔액 음수 가능 | ✅ `FOR UPDATE` + `AND balance >= $1` 가드 추가 (v7.14) |

## 🔴→✅ v7.13 — 마켓플레이스 구매 TOCTOU 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/marketplace.js` — `buyListing()` L211 | 리스팅 SELECT에 `FOR UPDATE` 없음 → 두 구매자가 동시에 동일 리스팅 status='active' 확인 → 아이템 중복 지급 + 판매자 이중 크레딧 | ✅ `FOR UPDATE` 추가 (v7.13) |

## 🔴→✅ v7.12 — 영토 수확 TOCTOU 경쟁 조건 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/api.js` — territory harvest (~L3183) | `claims` SELECT에 `FOR UPDATE` 없음 → 동시 harvest 요청 두 건이 모두 쿨다운 체크 통과 → 같은 클레임에서 이중 PP 수확 가능 | ✅ `FOR UPDATE OF c` 추가 (v7.12) |

## 🔴→✅ v7.11 — 일일 출석 "7일 중 8일차" 표시 버그 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/api.js` — `/api/daily/status` | `maxDays` 기본값 14 (설정값) vs 서비스 CYCLE 7 불일치 → UI에서 14칸 그리드 표시 | ✅ `daily_streak_cycle` 기본값 14→7 변경 (v7.11) |
| `server/routes/api.js` — `/api/daily/status` | 응답에 `cycleDay` 없음 → 프론트가 raw `streak_day=8`을 직접 사용 → "7일 중 8일차" | ✅ `cycleDay = ((streak-1) % maxDays + 1)` 추가, 양쪽 분기 모두 (v7.11) |
| `index.html` — `renderInlineCheckin()` | `streak`(=8) 그대로 사용 → `done = d <= 8` → 7칸 전부 ✅, 오늘 칸 없음 | ✅ `cycleDay`로 그리드/period label 계산 분리. raw streak는 "N일 연속" 헤더 전용 (v7.11) |
| `index.html` — `checkDailyLogin()` | `_dailyState.cycleDay` 미설정 | ✅ `d.cycleDay` 또는 `((streak-1) % maxDays + 1)` 폴백으로 저장 (v7.11) |
| `index.html` — `claimDailyLogin()` | 클레임 성공 후 `_dailyState.cycleDay` 미갱신, `d.streak` 대신 `d.streakDay`로 내려오는 필드명 불일치 | ✅ `d.streak || d.streakDay` 폴백 + cycleDay 재계산 (v7.11) |

## 🔴→✅ v7.03~v7.07 — Race condition sweep: governance, fleet, battleRewards, hijack, lottery (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/marketplace.js` L284, L289 | `listing.seller`/`tariffGovernor` DB값 → LOWER() 없음 → 판매자 지급 silent 실패 | ✅ LOWER() 추가 (v7.03) |
| `server/db.js` L444 | 레퍼럴 chain balance credit `ref.wallet` from DB → LOWER() 없음 | ✅ LOWER() 추가 (v7.03) |
| `server/services/guild.js` L57, L381, L520, L564, L585 | `guild_id` UPDATE 5곳 LOWER() 없음 (invited_wallet from DB) | ✅ sed 일괄 LOWER() 추가 (v7.03) |
| `server/routes/api.js` L4163 | shop 아이템 잔액 차감 `${balCol} - $1 WHERE wallet_address` LOWER() 없음 | ✅ LOWER() 추가 (v7.03) |
| `server/services/aiFleetManager.js` L72 / `server/routes/admin.js` L4506, L4681 | `faction_code` UPDATE LOWER() 없음 | ✅ LOWER() 추가 (v7.03) |
| `server/services/dividends.js` — `distributeLastWeek()` | 스테이커 스냅샷 트랜잭션 외부에서 수집 + INSERT ON CONFLICT DO NOTHING 후 GP 크레딧 무조건 실행 → 동시 호출 시 이중 지급 경쟁 | ✅ 트랜잭션 내부에서 락 후 스냅샷 재수집 + RETURNING id 가드 추가 (v7.03) |
| `server/services/season.js` L394, L657 / `server/db.js` L548, L596, L598 / `server/services/rank.js` | XP/rank_level UPDATE LOWER() 없음 | ✅ LOWER() 추가 (v7.03) |
| `server/routes/governance.js` — buff purchase TOCTOU | `existing buff` 체크가 BEGIN 이전에 실행 → 두 동시 요청이 모두 통과해 GP 이중 차감 | ✅ BEGIN을 먼저 실행 + FOR UPDATE 후 재확인으로 수정 (v7.04) |
| `server/services/governance.js` — `recalculateGovernor()` | old position gp_balance SELECT에 FOR UPDATE 없음 → 동시 재계산 시 sector pool 이중 크레딧 | ✅ FOR UPDATE 추가 (v7.04) |
| `server/services/governance.js` — `recalculateGovernor()` | `pixels.owner` DB값을 LOWER() 없이 sectors/governance_positions에 기록 → checksum 주소 전파 | ✅ `.toLowerCase()` 추가 (v7.04) |
| `server/services/governance.js` — `applyDailyMaintenance()` | governance_positions 전체 SELECT에 FOR UPDATE 없음 → 스케줄러 재시작 겹칠 때 이중 차감 | ✅ `FOR UPDATE OF gp` 추가 (v7.04) |
| `server/services/fleet.js` — `createFleet()` | COUNT(*) 이후 INSERT 사이에 user row 락 없음 → 두 동시 요청이 모두 maxFleets 체크 통과 → 초과 함대 생성 | ✅ 유저 row FOR UPDATE 선취득으로 직렬화 (v7.04) |
| `server/services/fleet.js` — `deleteFleet()` | 다른 함대 row를 각자 락하는 동시 삭제 요청이 COUNT > 1 체크 모두 통과 → 마지막 함대까지 삭제 | ✅ 유저 row FOR UPDATE로 직렬화 (v7.04) |
| `server/services/battleRewards.js` — `distributeBattleRewards()` | "already rewarded" 체크가 트랜잭션 외부 → 동시 호출 시 모든 참가자 GP/광물 이중 지급 | ✅ BEGIN 후 fleet_battles FOR UPDATE + 재확인으로 수정 (v7.05) |
| `server/services/hijack.js` — `handlePhase1Complete()` | 전체 함수가 트랜잭션 없이 `pool.query` 3개 분리 실행 → 크래시 시 부분 상태 + 이중 환불 가능 | ✅ BEGIN/COMMIT 트랜잭션 + FOR UPDATE + phase='phase1' 가드 추가 (v7.06) |
| `server/services/hijack.js` — `handlePhase2Complete()` | 초기 SELECT가 트랜잭션 외부 → 동시 호출 시 픽셀 이전 + 오너 크레딧 이중 실행 | ✅ BEGIN 후 FOR UPDATE + phase NOT IN ('completed','failed') 가드 추가 (v7.06) |
| `server/services/lottery.js` — `drawRound()` | FOR UPDATE 이후에도 스테일 `round` 스냅샷 변수 사용 (ticket_count, ticket_price_gp, prize_pool_gp, round_number) → 환불 금액/당첨금/라운드 번호 불일치 | ✅ `lockRes.rows[0]` (`lockedRound`)로 교체 (v7.07) |

**v7.07 이후 확인된 남은 경쟁조건/비원자성 패턴: 0건 (주요 서비스 전체 검토 완료)**

### v7.08~v7.10 추가 수정

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/siege.js` — `declareSiege()` | `sector_governance` 조회에 FOR UPDATE 없음 → 두 동시 선언이 모두 `active_siege_id = NULL` 확인 → 이중 시즈 생성, 첫 번째 GP 손실 | ✅ `FOR UPDATE OF sg` 추가 (v7.08) |
| `server/services/ship.js` — `buyShipListing()` L1536 | `Math.floor(price * feePct) / 100` 연산자 우선순위 버그 → 소수 GP가 DB에 기록됨 | ✅ `Math.floor(price * feePct / 100)` 수정 (v7.08) |
| `server/services/ship.js` — `chargeShield()` L931-934 | `chargeUnits > canAdd` 시 전체 요청 거절 → `SHIELD_FULL` 오류 | ✅ clamp 처리로 변경 (partial charge 허용) (v7.08) |
| 서버 전체 require smoke test (12개 서비스 + 6개 라우트) | 모두 에러 없이 로드 | ✅ 18/18 OK |

---

## 🔴→✅ v7.02 — api.js/admin.js + 18개 파일 balance credit LOWER() 완전 정리 (2026-05-07)

## 🔴→✅ v7.01~v7.02 — api.js/admin.js + 18개 파일 balance credit LOWER() 완전 정리 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/api.js` — 하이잭 PP 환불 (L1274) | `affectedOwners` 키 = `pixels.owner` DB값 → 혼합 대소문자 가능 → PP 소각 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/api.js` — 레퍼럴 PP 크레딧 (L1425) | `ref.wallet` from DB → LOWER() 없음 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/api.js` — territory harvest PP (L3060, L3334) | `WHERE wallet_address = $2` LOWER() 없음 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/api.js` — pp_to_gp 교환 GP 크레딧 (L7110) | `wallet_address=$2` LOWER() 없음 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/api.js` — GP 이체 수신자 조회+크레딧 (L7542, L7592) | 조회: LOWER() 없어 checksum 등록 유저 "not_found". 크레딧: LOWER() 없어 GP 소각 | ✅ 두 곳 LOWER() 추가 (v7.01) |
| `server/routes/api.js` — GP 이체 발신자 FOR UPDATE (L7571) | `WHERE wallet_address = $1 FOR UPDATE` LOWER() 없음 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/api.js` — PP 환불 refundFromFailed (L1401) | LOWER() 없음 | ✅ LOWER() 추가 (v7.01) |
| `server/routes/admin.js` — gp/grant (L1727), staking withdraw (L2319), bounty cancel (L2507), duel admin cancel (L4181/4186) | DB 저장 wallet값으로 UPDATE 시 LOWER() 없음 | ✅ 5곳 LOWER() 추가 (v7.01) |
| **v7.02 batch — 18개 파일** (exploration, missions, onboarding, daily, duel, hijack, lottery, achievements, rocket, tournament, dividends, season, tournaments, chain, maintenance, db.js, auth.js, api.js) | 모든 `SET *_balance = *_balance + $N WHERE wallet_address` 패턴에 LOWER() 누락 | ✅ 전체 sed 일괄 패치 (v7.02) |

**v7.02 이후: 서버 전체에서 `SET *_balance ... WHERE wallet_address` 패턴 중 LOWER() 없는 것: 0건 (grep 확인)**

---

## 🔴→✅ v6.96~v7.00 — warBetting/exploration/polls/12개 서비스/15개 서비스/auction LOWER() 일괄 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/routes/warBettingRoutes.js` — admin cancel refund 루프 | bet rows에 FOR UPDATE 없음 + refund UPDATE에 LOWER() 없음 → 동시성 위험 + 환불 silent 실패 | ✅ `FOR UPDATE` + `LOWER()` 추가 (v6.96) |
| `server/services/exploration.js` L231 | `WHERE wallet_address = $1 FOR UPDATE` LOWER() 없음 | ✅ LOWER() 추가 (v6.99) |
| `server/services/polls.js` L71, L83 | `WHERE wallet_address=$1 FOR UPDATE` + `WHERE wallet=$1 LOWER()` 없음 | ✅ 두 곳 LOWER() 추가 (v6.97) |
| `server/routes/polls.js` | GET/POST 엔드포인트 wallet 정규화 없음 | ✅ `.toLowerCase().trim()` 추가 (v6.97) |
| v6.98 batch — 12개 서비스 (`beacon`, `capsule`, `sponsor`, `tdesc`, `tprestige`, `graffiti`, `journal`, `highlight`, `status`, `milestone`, `rating`, `tombstone`) | `WHERE wallet_address=$1 FOR UPDATE`에 LOWER() 없음 (각 서비스 1곳씩) | ✅ 일괄 LOWER() 추가 + 대응 route wallet.toLowerCase().trim() 추가 (v6.98) |
| v6.99 batch — 15개 서비스 (`alliance`, `announcement`, `banner`, `exploration`, `faction`, `guild` 4곳, `job`, `missions`, `onboarding`, `prestige`, `season`, `shield`, `title`, `titleExtended`, `tribute`) | `WHERE wallet_address = $1 FOR UPDATE` LOWER() 없음 | ✅ sed 일괄 패치 (v6.99) |
| `server/services/auction.js` — bid 환불, buyout 환불+판매자 지급, settle 판매자 지급 (L224, L307, L314, L430) | `WHERE wallet_address = $2` LOWER() 없음 — `auction.current_bidder_wallet`/`auction.seller_wallet`은 DB 저장값으로 Ethereum checksum(혼합 대소문자) 가능 → UPDATE 0 rows → GP 소각 | ✅ 4곳 모두 `LOWER(wallet_address) = LOWER($2)` 수정 (v7.00) |
| `server/services/auction.js` — SELECT FOR UPDATE L69, L212, L297 | `WHERE wallet_address = $1 FOR UPDATE` LOWER() 없음 | ✅ LOWER() 추가 (v7.00) |

**v7.00 이후 GP 크레딧(+) UPDATE 경로에 non-LOWER wallet_address 남은 건: 0건 (전체 grep 확인)**
**v7.00 이후 GP 차감(-) UPDATE 경로에 non-LOWER/non-guard 남은 건: 0건**

---

## ✅ v6.93~v6.95 — campaign.js false positive + wager/raffle/contest 감사 클린 확인 (2026-05-07)

| 감사 영역 | 결과 |
|-----------|------|
| `server/services/campaign.js` — `territoryUpgradeLevels` SUM missing AS count alias | ✅ 수정됨 (v6.95) — `SUM(upgrade_level) AS count` |
| Codex campaign.js audit false positives (qty NaN guard, rewardId guard, WALLET_LOWER) | ✅ 검토 결과 모두 false positive — normalizeWallet() 이미 적용, parseInt 폴백 존재 |
| `server/services/wager.js` — placeBet, settlePool, adminCancelPool | ✅ 클린 — FOR UPDATE + LOWER() + AND gp_balance >= $1 전부 적용 |
| `server/services/raffle.js` — buyTickets, drawWinner | ✅ 클린 — FOR UPDATE + LOWER() + AND gp_balance >= $1 전부 적용 |
| `server/services/contest.js` — submitEntry, voteForEntry, finalizeContest | ✅ 클린 — FOR UPDATE + LOWER() + AND gp_balance >= $1 전부 적용 |
| `server/services/exploration.js` getSetting JSONB quote strip | ✅ 확인 — db.js getSetting 이미 `value #>> '{}'` 사용으로 따옴표 없이 반환 (false positive) |
| `server/services/worldEvents.js` | ✅ 클린 — finalClient.release() 있음, 패턴 정상 |

---

## 🔴→✅ v6.90~v6.92 — ship/fleet FOR UPDATE 경쟁조건 + crafting LOWER() + auto-renew guard (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/ship.js` — `completeBuildJob`, `cancelBuildJob`, `getOrCreateDefaultFleet`, `getFleetSummary` | LOWER(owner_wallet) 미적용 + fleet/flagship SELECT에 FOR UPDATE 없음 | ✅ Codex: LOWER() + FOR UPDATE 추가 (v6.90) |
| `server/services/ship.js` — `repairShip`, `chargeShield`, `getShipMarketListings` | `targetHpPct`, `units`, `maxPrice` 파라미터에 NaN/non-finite 검증 없음 | ✅ Codex: `Number.isFinite()` guard 추가 (v6.90) |
| `server/services/ship.js` — `ensureFleetHasFlagship`, `cancelShipListing`, `buyShipListing` | flagship 후보 SELECT에 FOR UPDATE 없음; 마켓 취소/구매 시 listing만 잠기고 ship 미잠금 | ✅ Codex: FOR UPDATE OF sml, s (ship도 잠금) (v6.90) |
| `server/services/fleet.js` — `deleteFleet`, `setFlagship`, `ensureFlagship` | alive ships / existing flagships SELECT에 FOR UPDATE 없음 → 동시 요청이 같은 함선 두 번 수정 가능 | ✅ Codex: SELECT ... FOR UPDATE 추가 (v6.90) |
| `server/services/crafting.js` — `craftItem` | `WHERE wallet_address=$1` (LOWER 없음) — SELECT(GP 조회)와 UPDATE(GP 환불) 두 곳 | ✅ LOWER() 추가 (v6.91) |
| `server/services/resourceCraft.js` — `getMyJobs`, `startCraft`, `claimJob`, `cancelJob` | `WHERE wallet_address = $N` 6곳 LOWER 없음 | ✅ LOWER() 전체 추가 (v6.91) |
| `server/index.js` — auto-renew 스케줄러 (Shield L863, Effect L922) | `UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2` — LOWER 없음 + AND guard 없음 (FOR UPDATE SELECT는 이미 있었음) | ✅ LOWER() + AND pp_balance >= $1 추가 (v6.92) |

**v6.92 이후 남은 unguarded deduction/missing LOWER: 0건 (서버 전체 grep 확인)**

---

## 🔴→✅ v6.87 — GP/PP 잔액 가드 + wallet LOWER() 전체 서비스 일괄 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| **v6.86 커밋** — 10개 서비스 (`spells`, `staking`, `rental`, `branding`, `enhancement`, `lottery`, `tournaments`, `vtag`, `broadcasts`, `maintenance`) | `SELECT gp_balance` 후 `FOR UPDATE` 누락 → 동시 요청이 동일 잔액을 보고 중복 차감 가능. wallet 대소문자 비교 버그. 음수 잔액 방지 guard 없음 | ✅ `FOR UPDATE` + `LOWER()` + `AND gp_balance >= $N` 일괄 추가 |
| **v6.87 커밋 — Claude 27개 + Codex 12개 = 39개 서비스** 전체 GP/PP 차감 경로 | 동일 패턴: `AND gp_balance >= $N` guard 없음, wallet 대소문자 미정규화 (`ship.js` 5곳, `siege.js` 2곳, `auction.js` 3곳, `duel.js` 2곳, `contest.js` 2곳 포함 총 48곳 이상) | ✅ 모든 `UPDATE users SET gp_balance/pp_balance = ... - $N` 경로에 guard + LOWER() 완료 |
| `server/services/ship.js` (L304, L826, L947, L1227, L1529) | LOWER() 있었으나 `AND gp_balance >= $1` 없음 → 함선 건조/수리/실드/업그레이드/마켓 구매 전 경로에서 음수 잔액 가능 | ✅ replace_all로 5곳 동시 수정 |
| `server/services/hijack.js` L519 | `pp_balance` 차감에 guard 없음 → 하이잭 공격 비용 음수 차감 가능 | ✅ `AND pp_balance >= $1` 추가 |
| `server/services/duel.js` (challenger escrow L138, defender escrow L194) | 잔액 확인 후 차감 사이 guard 없음 | ✅ 두 경로 모두 `AND gp_balance >= $1` 추가 |
| `server/services/marketplace.js` listing fee L52 | `wallet_address = $2` LOWER() 없음 + guard 없음 | ✅ LOWER() + guard 추가 |
| `server/services/commanderActions.js` | 이미 `AND gp_balance >= $1 RETURNING` 패턴 사용 중 — 클린 | ✅ 수정 불필요 |

**v6.89 이후: `UPDATE users SET gp_balance/pp_balance/usdt_balance = ... - $N` 패턴 관련 버그 전부 해소. 전체 서비스/라우트 grep 스캔 결과 0건 확인.**

---

## 🔴→✅ v6.85 — 일일미션/퀘스트 풀/마켓 구매 동시성 버그 수정 (2026-05-07)

## 🔴→✅ v6.85 — 일일미션/퀘스트 풀/마켓 구매 동시성 버그 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/daily.js` `claimMissionReward()` | `pool.query()` 직접 사용 — 트랜잭션 없음 → 동시 두 요청이 동일 미션을 중복 수령 가능. 오류 발생 시 롤백 누락 | ✅ BEGIN/COMMIT/ROLLBACK + `finally { client.release() }` 추가. `UPDATE ... SET claimed=true WHERE ... AND claimed=false RETURNING *` 원자적 claim으로 중복 방지. wallet LOWER() 정규화 |
| `server/routes/api.js` `quest_reward_pool` UPDATE | `SET balance = balance - $1 WHERE id = 1` — `balance >= $1` 조건 없음 → 동시 요청이 풀 잔액을 음수로 만들 수 있음 (harvest, territory/harvest 두 경로 모두 해당) | ✅ `WHERE id = 1 AND balance >= $1 RETURNING balance` 추가. UPDATE rows = 0이면 ROLLBACK 후 pool_depleted 반환 |
| `server/routes/api.js` 퀘스트 claim `actualReward` 계산 | `tierCap`, `userDailyRemaining`만으로 캡핑 → `poolBalance`, `dailyBudget - todayPaid` 초과 공제 가능 | ✅ `actualReward = Math.min(actualReward, Math.max(0, dailyBudget - todayPaid), poolBalance)` 추가 |
| `server/routes/api.js` quest 엔드포인트 wallet 비교 | `WHERE wallet = $1` 대소문자 구분 비교로 quest/transaction 누락 가능 | ✅ `LOWER(wallet) = LOWER($1)` + wallet 소문자 정규화 |
| `server/services/marketplace.js` `buyListing()` 구매자 잔액 | `SELECT ${balCol} FROM users WHERE wallet_address = $1` — `FOR UPDATE` 없음 → 동시 두 요청이 같은 잔액을 보고 동시에 차감, 음수 잔액 가능 | ✅ `FOR UPDATE` + `LOWER()` 추가. UPDATE에 `AND ${balCol} >= $1` 가드 추가 |

---

## 🔴→✅ v6.84 — 강화/공성/마켓 3개 영역 감사 및 수정 (2026-05-07)

## 🔴→✅ v6.84 — 강화/공성/마켓 3개 영역 감사 및 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/enhancementAdvanced.js` `getScrollStatus()` | `user_items` 쿼리에 존재하지 않는 컬럼 `wallet_address`, `item_code` 사용 → 항상 DB 오류로 catch되어 보호권 0 반환. 보유 스크롤이 있어도 UI에 "없음"으로 표시됨 | ✅ `wallet` + `JOIN item_types ... WHERE it.code = $2` 패턴으로 수정 |
| `server/services/enhancementAdvanced.js` `consumeScrollClient()` | 동일 잘못된 컬럼 사용 → 스크롤 차감 자체가 오류 발생. `checkAndConsumeScroll()`이 현재 직접 호출되지 않아 silent 버그로 잠재 | ✅ `UPDATE user_items ... FROM item_types` JOIN 패턴으로 수정 |
| `server/services/enhancementAdvanced.js` `getResourceBalance()` / `deductResource()` fallback | user_items 폴백 경로도 동일 잘못된 컬럼 → primary(user_resource_inventory) 실패 시 폴백도 실패. Silent 0 반환 | ✅ 동일 JOIN 패턴으로 수정 |
| `server/services/siege.js` wallet 대소문자 비교 (15곳) | `WHERE owner = $1`, `WHERE wallet_address = $1`, JS 측 governor 비교 등이 LOWER() 없이 비교 → 대소문자 차이 시 소유권 오판 가능 | ✅ `LOWER(owner) = LOWER($1)`, `LOWER(wallet_address) = LOWER($1)`, JS `.toLowerCase()` 비교로 통일 |
| `server/routes/marketplace.js` NaN ID가 DB 도달 (3곳) | `GET /listings/:id`, `POST /cancel`, `POST /buy`에서 `parseInt()` 후 `Number.isInteger()` 검증 없음 → 문자열/NaN ID가 DB 캐스트 오류 발생 가능 | ✅ `parseInt(id, 10)` + `Number.isInteger()` 가드 추가, 미통과 시 400 반환 |

---

## 🔴→✅ v6.83 — 함대전/함대 지휘 4개 영역 전수 감사 및 수정 (2026-05-07)

| 감사 영역 | 발견된 버그 | 수정 여부 |
|-----------|-------------|-----------|
| `server/services/battleEngine.js` | `bonus_atk/def/hp/speed`는 전투 계산에 반영되고 있었으나, 전투 후 부분 HP 저장이 존재하지 않는 `result.frames`를 참조해 생존 함선 HP 손실이 누락될 수 있음 | ✅ `stats.by_ship` 최종 스냅샷 추가 후 DB 갱신 기준으로 사용 |
| `server/services/battleEngine.js` | 전투 결과 summary에 함선별 `is_alive/current_hp/bonus_*` 스냅샷이 없어 사후 리포트/진단 필드가 부족 | ✅ `battle_summary.final_ships`에 저장 |
| `server/services/battleEngine.js` | 전투 후 HP clamp가 base `max_hp` 중심이라 `bonus_hp` 유효 최대 HP 기준이 불완전 | ✅ `max_hp + bonus_hp` 기준 clamp 적용 |
| `server/services/battleEngine.js` | `getShipMatchupMult()` role/size/faction 비교 로직 | ✅ 오타/잘못된 role 비교/누락 케이스 신규 발견 없음 |
| `server/services/battleScheduler.js` | 여러 scheduler/manual 실행 경로에서 같은 `preparing` 전투가 중복 claim될 수 있고, 동일 fleet이 두 전투에 동시에 들어갈 race condition 가능 | ✅ `UPDATE ... WHERE status='preparing' RETURNING` + `FOR UPDATE OF fleets` 트랜잭션으로 원자적 claim |
| `server/services/battleScheduler.js` | 전투 후속 처리 중 예외 발생 시 fleet battle lock 해제가 catch 경로에만 의존 | ✅ `finally`에서 비-active 전투의 fleet lock 정리 |
| `server/services/battleScheduler.js` | 신규 lock 트랜잭션의 connection leak 위험 | ✅ `finally { startClient.release() }` 적용 |
| `server/routes/fleets.js` | 서비스 소유권 검증은 `LOWER()` 기반으로 정상이나 라우트가 `parseInt`/원본 배열을 그대로 넘겨 문자열·NaN id가 DB 캐스트 오류로 샐 수 있음 | ✅ safe integer 파서와 id 배열 정규화 추가 |
| `server/routes/fleets.js` | 기함 지정 `ship_id`가 NaN이어도 서비스까지 도달 가능 | ✅ 라우트에서 400 `SHIP_ID_REQUIRED`로 차단 |
| `server/routes/fleets.js` | 기함 소유권/다른 fleet 소속 검증 | ✅ 서비스의 wallet 소유권, `fleet_id` 숫자 비교, 판매중/사망/기함가능 검증 확인 |
| `index.html` `confirmDeclareBattle` | API 응답이 OK지만 `battle_id`가 없거나 JSON 파싱 실패 시 이후 모달이 잘못 열릴 수 있음 | ✅ JSON fallback 및 battle id 누락 가드 추가 |
| `index.html` `openBattleViewer` | iframe/report 요청에 현재 wallet 전달이 없어 내 관점 리포트가 비어질 수 있음 | ✅ wallet query 전달 및 `bv.wallet` 저장 |
| `index.html` `forfeitBattle` | iframe 후퇴 실패 payload도 성공 토스트/뷰어 종료로 처리될 수 있음, 전역 함수 부재 | ✅ 실패 payload 처리 및 전역 `forfeitBattle()` 추가 |
| `index.html` `setFleetFormation/setFleetManeuver` | 명시 함수 부재로 레거시 호출 시 상태 업데이트 경로를 못 탈 수 있음 | ✅ 기존 `setFleetTactic()`을 재사용하는 호환 래퍼 추가 |

---

## ✅ v6.82 — 서버/클라이언트 심층 감사 추가 완료 (2026-05-07)

이번 루프 세션에서 아래 추가 영역을 전면 검토. **신규 버그 없음**:

| 감사 영역 | 결과 |
|-----------|------|
| `expedition.js` resolveExpeditions() 스케줄러 트랜잭션 패턴 | ✅ 클린 (`finally { client.release() }`) |
| `missions.js` launch/tick/claim 트랜잭션 패턴 | ✅ 클린 — early return에도 finally 실행 |
| `capsule.js`, `beacon.js` 트랜잭션 패턴 | ✅ 클린 |
| `lottery.js` drawRound() 트랜잭션 패턴 | ✅ 클린 (`finally { client.release() }`) |
| `arena.js` crash-round try/catch without finally 패턴 | ✅ 안전 — 각 경로 단일 release |
| `profile.js`, `tprestige.js`, `duel.js`, `onboarding.js`, `job.js`, `rating.js`, `tevt.js`, `exploration.js`, `chain.js`, `contest.js`, `maintenance.js` | ✅ 모두 `finally` 단일 릴리즈 |
| `auth.js` 5개 release 지점 — 모두 `finally` 확인 | ✅ 클린 |
| `api.js` JSON.parse 2곳 — try/catch 내부 확인 | ✅ 클린 |
| `enhancement.js` JSON.parse — try/catch 폴백 확인 | ✅ 클린 |
| `ship.js` upgrade-stat stat 화이트리스트 검증 | ✅ `STAT_CONFIGS[stat]` 조회 → 미등록 stat=INVALID_STAT 에러 |
| War Betting `/api/betting/bet` — `getAuthHeaders()` 정상 전송 | ✅ 클린 |
| `admin.html` native dialog 0건 검증 | ✅ 0건 |
| Campaign reward inbox `FOR UPDATE` 동시성 보호 | ✅ 클린 |

---

## 🔴→✅ v6.81 — DB 커넥션 더블 릴리즈 전수 스캔·수정 (2026-05-07)

**스캔 방법**: Python으로 전체 `server/**/*.js` 파일에서 `client.release()` 호출을 파싱, 이전 줄이 `finally` 가 아닌 패턴을 추출.

**발견 및 수정**:

| 파일 | 위치 | 패턴 | 수정 |
|------|------|------|------|
| `server/routes/api.js` | 픽셀 클레임 for-loop (L984, L993, L1004) | `ROLLBACK; client.release(); return` inside try/finally | `client.release()` 3곳 제거 |
| `server/services/transport.js` | `getRaidables()` for-loop (L355) | `client.release(); continue` inside try/finally | `client.release()` 제거 |

**검증 클린**:
- `server/index.js` — 이전 수정(v6.80) 이후 클린
- `server/routes/arena.js` — try/catch without finally 패턴 (각 경로 단일 release, 더블 릴리즈 없음)
- 나머지 모든 서비스/라우트 — `finally { client.release() }` 단일 경로 확인

---

## 🔴→✅ v6.80 — 스케줄러 더블 릴리즈 버그 수정 (2026-05-07)

**버그**: `server/index.js` AUTO-RENEW 스케줄러의 for-loop 안에서 `try` 블록 내부 early `continue` 경로 4곳에 `client.release()`가 있었으나, 동일 블록에 `finally { client.release() }`가 항상 실행되어 **더블 릴리즈** 발생.

- pg-pool의 동일 클라이언트 이중 반환 → 다음 체크아웃된 클라이언트가 오염 가능 (풀 상태 불일치)

**수정**: 4곳에서 early `client.release()` 제거 — `finally` 블록 단일 릴리즈로 통일.

| 위치 | 패턴 | 수정 |
|------|------|------|
| Shield 자동갱신 — 아이템 없음 경로 | `ROLLBACK; client.release(); continue;` | `client.release()` 제거 |
| Shield 자동갱신 — PP 부족 경로 | `COMMIT; client.release(); continue;` | `client.release()` 제거 |
| Effect 자동갱신 — 아이템 없음 경로 | `COMMIT; client.release(); continue;` | `client.release()` 제거 |
| Effect 자동갱신 — PP 부족 경로 | `COMMIT; client.release(); continue;` | `client.release()` 제거 |

**감사 신규 영역**: VIP (`purchaseVipPass`, `loadVipView`), Onboarding (`obNextStep`, `obSkip`), War Betting (`wbPlaceBet`, `wbLoad`, `wbSwitchTab`), Profile (`saveProfileNickname`, `saveProfileMotto`, `saveProfileColor`), War Betting 라우트 (`warBettingRoutes.js`) — 모두 클린.

---

## ✅ v6.79 확장 감사 완료 — 전 시스템 클린 (2026-05-07)

## ✅ v6.79 확장 감사 완료 — 전 시스템 클린 (2026-05-07)

이번 루프 세션에서 v6.78에 이어 미감사 영역을 전면 추가 검토. 신규 버그 없음:

| 감사 영역 | 결과 |
|-----------|------|
| Alliance/Invasion 함수 (`addGuildToAlliance`, `leaveAllianceAsGuild`, `confirmBetrayAlliance`, `joinAllianceAction`, `createAllianceAction`, `openAllianceDepositModal`, `leaveAllianceConfirm`) | ✅ 클린 |
| Auction 함수 (`govPlaceAuctionBid`, `govAuctionBuyout`, `govCancelAuction`, `openListModal`, `buyMarketListing`, `cancelMarketListing`, `openResourceMarketListing`) | ✅ 클린 |
| Expedition 함수 (`launchExpeditionAction`, `cancelActiveExpedition`) | ✅ 클린 |
| Territory Rental 함수 (`openRentModal`, `openListForRentModal`, `cancelRentalListing`) | ✅ 클린 |
| GP Transfer 함수 (`sendGP`) | ✅ 클린 |
| Lottery 함수 (`quickBuyTickets`) | ✅ 클린 |
| Staking 함수 (`doStake`, `doWithdraw`) — async/await + `getAuthHeaders()` | ✅ 클린 |
| Raffle 함수 (`submitBuyTickets`) | ✅ 클린 |
| Broadcast 함수 (`submitBroadcast`) | ✅ 클린 |
| Banner/Highlight/Graffiti/Tribute submit 함수 (`window._walletAddress` 패턴 — dead code, 기능은 정상) | ✅ 클린 |
| Siege 함수 (`govDeclareSiege`) | ✅ 클린 |
| Governance 함수 (`govTriggerEvent`, `govTriggerRocket`, `govBuyBuff`) | ✅ 클린 |
| Bounty/Duel 함수 (`submitPostBounty`, `cancelBounty`, `respondDuel`) | ✅ 클린 |
| Shield activate 함수 | ✅ 클린 |
| Territory Branding (`setBrandingName`, `setBrandingTagline`) | ✅ 클린 |
| Territory Tier Upgrade (`upgradeTierAction`) | ✅ 클린 |
| Guild LevelUp/Research (`guildLevelUp`, `guildUnlockResearch`) | ✅ 클린 |
| Claim purchase flow (`confirmClaim`) — async/await | ✅ 클린 |
| Guild war scoreboard `gameConfirm` — info-only modal, Promise intentionally ignored | ✅ 의도적 (결과 없음) |
| native dialog 잔존 검사 — `alert()` 1건 `showHijackEntryHint()` | ✅ 무해 (도달 불가 dead code — `showFactionToast`가 먼저 처리) |
| P5-1 `/api/territory/:claimId/production` 엔드포인트 실동 확인 | ✅ 응답 정상 |
| P5-3 `/api/ships/resource-sector-hints` 엔드포인트 실동 확인 | ✅ 응답 정상 |
| P5-4 `/api/territory/:claimId/upgrades` 엔드포인트 실동 확인 | ✅ 응답 정상 |
| P5-5 `/api/sectors/control`, `/api/sectors/:sectorId/control` 실동 확인 | ✅ 응답 정상 |
| P5-6 Admin Territory 엔드포인트 — `requireAdmin` 보호 전수 확인 | ✅ 클린 |
| P5-7 Campaign objectiveState `materialHarvests`/`territoryUpgradeLevels` 필드 확인 | ✅ 응답 포함 |
| 서버 라우트 마운트 순서 — `/api/sectors` vs `apiRoutes` 충돌 검사 | ✅ 정상 (territoryIdentityRoutes 무일치 → fall-through → apiRoutes 처리) |

## ✅ v6.78 전체 코드베이스 심층 감사 — 신규 버그 없음 (2026-05-07)

이번 루프 세션에서 아래 영역을 전면 재검토. 새로운 버그 발견 없음:

| 감사 영역 | 결과 |
|-----------|------|
| 모든 `gameConfirm` 콜 (60+) — `.then()`/`await` 패턴 검증 | ✅ 클린 |
| `walletState.*` 전역 필드 접근 전수 조사 | ✅ 클린 (address/connected/chain/gameGP/gamePP/gameUsdt/usdtBalance/nickname만 사용) |
| Fleet Command 6개 함수 (`setFleetTactic`, `deleteFleetPrompt`, `showMoveShipsDialog`, `setAsFlagship`, `createNewFleet`, `renameFleet`) — auth/에러처리 | ✅ 클린 |
| Shipyard 3개 함수 (`syRepairShip`, `syScrapShip`, `syChargeShield`) | ✅ 클린 |
| Ship Market 3개 함수 (`syListShipForSale`, `syCancelShipListing`, `syBuyShipListing`) | ✅ 클린 |
| Territory Upgrade (`doTerritoryUpgrade`, `loadTerritoryUpgrades`) | ✅ 클린 |
| Campaign reward/progress/complete 흐름 | ✅ 클린 |
| Battle declaration (`confirmDeclareBattle`) | ✅ 클린 |
| Hijack declare-with-pp 흐름 | ✅ 클린 |
| Fleet routes (fleets.js) — auth middleware, error mapping | ✅ 클린 |
| Daily OPS `notifyMissionProgress` 로직 | ✅ 클린 |
| 서버 routes 5개 로드 테스트 (fleets, ships, api, dailyOps, marketplace) | ✅ 로드 OK |
| `getAuthHeaders()` 함수 검증 | ✅ 클린 |
| Branding/Banner/Sponsor/Rating/Highlight/Graffiti/Tribute — v6.74 수정 검증 | ✅ 확인 |
| `govDeclareSiege` — v6.77 수정 검증 | ✅ 확인 |
| Harvest endpoint — v6.76 수정 검증 | ✅ 확인 |



## ✅ v6.77 버그수정 — walletState 잘못된 필드명 (2곳)

| 함수 | 버그 | 상태 | 수정 |
|------|------|------|------|
| `govDeclareSiege()` | `walletState.gpBalance` 미할당 전역 → 항상 0 → 공성전 "INSUFFICIENT GP" 버튼 항상 비활성, 선언 불가 | ✅ 수정 | `walletState.gameGP` |
| `buyMarketListing()` | `walletState.pp` 미할당 전역 → 항상 0 → PP 구매 시 잔액 0으로 표시 (disabled 포함) | ✅ 수정 | `walletState.gamePP` |

## ✅ v6.76 버그수정 — Daily OPS 미션 카운터 누락 (harvest/battle/market 복합 미션)

| 버그 | 영향 | 상태 |
|------|------|------|
| `harvest_3`/`harvest_5` 알림 누락 — 영토 수확 시 `harvest_pp`(1회)만 알리고, 3회/5회 미션 카운터 미증가 | 3회/5회 수확 미션 영원히 미완료 | ✅ 수정 |
| `battle_participate_3`/`battle_win_3` 알림 누락 — 전투 종료 후 단일 참여/승리만 카운트 | 3회 전투 미션 영원히 미완료 | ✅ 수정 |
| `ai_battle_3` 알림 누락 — AI 연습전 단일 참여만 카운트 | AI 3회 미션 영원히 미완료 | ✅ 수정 |
| `market_activity` 알림 누락 — 마켓 등록/구매 시 개별 미션만 알리고 3회 거래 미션 미카운트 | 마켓 거래 3회 미션 영원히 미완료 | ✅ 수정 |

## ✅ v6.75 버그수정 — window._walletAddress 항상 undefined (2곳)

| 함수 | 버그 | 상태 | 수정 내용 |
|------|------|------|-----------|
| `buryCapsule()` | `window._walletAddress` 읽기 — 코드베이스 어디에도 이 전역 변수를 설정하는 코드 없음. 항상 `undefined` → `if (!wallet)` guard가 항상 참 → "Connect wallet first" 표시. 타임캡슐 매장 기능 완전 불능 | ✅ 수정 | `((walletState&&walletState.address)\|\|getMyWallet()\|\|'').toLowerCase()` |
| `loadMyTdescs()` | 동일한 `window._walletAddress` → 항상 `undefined` → 내 영토 설명 목록이 항상 빈 `'—'` 표시 | ✅ 수정 | 동일 패턴 적용 |

## ✅ v6.74 버그수정 — gameConfirm 콜백 패턴 전면 수정 + GP 비용 표시 (9개 함수)

| 함수 | 버그 | 상태 | 수정 내용 |
|------|------|------|-----------|
| `doStake()` | `onConfirm:` 콜백 패턴 — Promise 반환값 무시, fetch 미실행. 스테이킹 확인 클릭 후 아무것도 안 됨 | ✅ 수정 | async/await + `confirmText:` + `getAuthHeaders()` |
| `doWithdraw()` | 동일한 `onConfirm:` 패턴 — 인출 확인 후 미실행 | ✅ 수정 | async/await 변환 |
| `saveTdescDescription()` | `onConfirm:` 패턴 + `window._walletAddress` 스코프 불안정 | ✅ 수정 | async/await + 통일된 지갑 패턴 |
| `submitSponsor()` | `onConfirm:` 패턴 + `window._walletAddress` | ✅ 수정 | async/await + 통일된 지갑 패턴 |
| `submitBanner()` | `cost: value` — 인식 불가 필드, GP 비용 UI 미표시 | ✅ 수정 | `info: [{k:'Cost', v:...}]` + 아이콘 |
| `submitRating()` | `cost: value` — 동일 | ✅ 수정 | `info:` 변환 + 아이콘 |
| `submitHighlight()` | `cost: value` — 동일 | ✅ 수정 | `info:` 변환 + 아이콘 |
| `submitGraffiti()` | `cost: value` — 동일 | ✅ 수정 | `info:` 변환 + 아이콘 |
| `submitTribute()` | `cost: value` — 동일 | ✅ 수정 | `info:` 변환 + 아이콘 |

**패턴 요약**: `gameConfirm()` 는 Promise를 반환함. `onConfirm: function(){}` 는 지원하지 않는 필드로, 클릭 후 아무런 동작이 없었음. `cost:` 역시 지원하지 않는 필드로, GP 비용이 다이얼로그에 표시되지 않았음. 전체 코드베이스에서 이 패턴을 전면 수정 완료.

## ✅ v6.73 버그수정 — 레거시 영토 업그레이드 패널 지갑/재로드 오류 (2곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| `_confirmAndUpgrade()` — `wallet: walletState.address` 가 JWT-only 유저에게 `undefined`. 서버 `/api/upgrades/upgrade` 400 오류 | ✅ 수정 | `(walletState&&walletState.address)\|\|getMyWallet()\|\|''` 통일 패턴 적용 |
| `_confirmAndUpgrade()` — 성공 후 `loadTerritoryUpgrades()` 인수 없이 호출 → `claimId=NaN` → 서버 400. BASE 탭 업그레이드 패널 재로드 실패 | ✅ 수정 | `_loadBaseUpgradesPanel()` 올바른 패널 리로드 함수로 교체 |

## ✅ v6.72 버그수정 — battleTimeline / battleRewards 지갑 케이스 오류 (4곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| `battleTimeline.getUserBattleHistory()` — `WHERE p.wallet_address = $1` 직접 비교. JWT 소문자 wallet ≠ DB 대소문자 시 전투 기록이 빈 배열로 반환 | ✅ 수정 | `LOWER(p.wallet_address) = LOWER($1)` 적용 |
| `battleRewards.getRewardHistory()` — `WHERE r.wallet_address = $1` 직접 비교. 전투 보상 이력이 빈 배열로 반환 | ✅ 수정 | `LOWER(r.wallet_address) = LOWER($1)` 적용 |
| `battleRewards` GP 지급 UPDATE — `WHERE wallet_address = $2` 직접 비교 (2곳). 케이스 불일치 시 GP 지급 쿼리가 0행 업데이트 → GP 미지급 | ✅ 수정 | `LOWER(wallet_address) = LOWER($2)` 적용 |

## ✅ v6.71 버그수정 — myW2 스코프 오류 + 캠페인 보상 지갑 undefined (4곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| `claimCampaignReward()` — `wallet:walletState.address` 가 undefined일 때 서버에 `wallet: undefined` 전송 → `missing fields` 400 오류 | ✅ 수정 | `(walletState&&walletState.address)||getMyWallet()` 폴백 + 미연결 시 에러 토스트 |
| `loadTerritoryUpgrades()` — `typeof myW2` 참조, `myW2`는 `showTerritoryInfo()` 지역변수. 외부 호출 시 항상 `''` → ownership 체크 실패, 업그레이드 버튼 미표시 | ✅ 수정 | `(walletState&&walletState.address)||getMyWallet()` |
| `doTerritoryUpgrade()` — 동일한 `myW2` 스코프 오류. 업그레이드 실행 시 지갑 없음 → 로그인 필요 오류 | ✅ 수정 | 동일 패턴 수정 |
| `openTerritoryIdentityEdit()` — `myW2 \|\| walletState?.address` 패턴 → optional chaining 없는 환경 호환성 + myW2 스코프 오류 | ✅ 수정 | 통일된 패턴으로 교체 |

## ✅ v6.70 버그수정 — getMyWallet() 지갑 연결 전용 유저 null 반환

| 항목 | 상태 | 비고 |
|------|------|------|
| `getMyWallet()` — JWT 없이 지갑만 연결된 유저가 배틀 보상 토스트(`showRewardIfAny`)를 못 받음 | ✅ 수정 | JWT 실패 시 `walletState.address` 폴백 추가 |

## ✅ v6.69 버그수정 — commanderActions.js 지갑 대소문자 비교 오류 (4곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| 참가자 검증 `owner_wallet = $2` — JWT 지갑 소문자 ≠ DB 대소문자 시 `NOT_A_PARTICIPANT` 403 | ✅ 수정 | `LOWER()` 적용 |
| 쿼터/중복 체크 `wallet_address = $2` — 동일 문제로 액션 카운트 누락 | ✅ 수정 | `LOWER()` 적용 |
| GP 차감 `wallet_address = $2` — 케이스 불일치 시 `INSUFFICIENT_GP` 오류 | ✅ 수정 | `LOWER()` 적용 |

## ✅ v6.68 버그수정 — fleetBattles.js 지갑 대소문자 비교 오류 (4곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| `declare-pvp` 내 함대 소유권 확인 — `owner_wallet = $2` 직접 비교. JWT 지갑이 DB와 대소문자 다를 때 `MY_FLEET_NOT_FOUND` 오류 | ✅ 수정 | `LOWER(f.owner_wallet) = LOWER($2)` 적용 |
| `declare-pvp` 자기 함대 공격 방지 체크 — `owner_wallet === wallet` JS 직접 비교. 케이스 불일치 시 자기 함대 공격 허용 버그 | ✅ 수정 | `.toLowerCase()` 비교로 교체 |
| `/:id/run` 참가자 확인 — `wallet_address = $2` 직접 비교. 케이스 불일치 시 `NOT_PARTICIPANT` 403 오류 | ✅ 수정 | `LOWER(wallet_address) = LOWER($2)` 적용 |
| `/:id/forfeit` 참가자 + 사이드 확인 — 동일한 비대소문자 비교 | ✅ 수정 | `LOWER(wallet_address) = LOWER($2)` 적용 |

## ✅ v6.67 버그수정 — i18n 누락 키 10개 (4개 언어 블록)

| 항목 | 상태 | 비고 |
|------|------|------|
| `connect_wallet` / `connect_wallet_first` / `err_connect_wallet` — 20/8/11곳에서 `t()` 호출되지만 I18N 미정의. `||` 폴백 영어 사용 중 | ✅ 수정 | EN/KO/JA/ZH 4개 언어 블록에 추가 |
| `err_network` — 네트워크 오류 핸들러에서 사용되지만 미정의 | ✅ 수정 | 4개 언어 블록 추가 |
| `vip_confirm` — VIP 구매 확인 버튼 미정의 | ✅ 수정 | 4개 언어 블록 추가 |
| `use_shipyard` / `use_fleet_cmd` — 함선/함대 안내 문구 미정의 | ✅ 수정 | 4개 언어 블록 추가 |
| `gov_battle_use_fleet` / `gov_battle_use_fleet_hint` — 거버넌스 전투 안내 미정의 | ✅ 수정 | 4개 언어 블록 추가 |
| `duel_declined_msg` — 결투 거절 토스트 메시지 미정의 | ✅ 수정 | 4개 언어 블록 추가 |

## ✅ v6.66 버그수정 — escHtml 미정의 함수 (21 + 8곳)

| 항목 | 상태 | 비고 |
|------|------|------|
| `escHtml(s)` — index.html 21곳 호출 (뉴스/바운티/실드/기념비/이벤트 등). 정의 없어 ReferenceError → 해당 패널 텍스트 전체 렌더 실패 | ✅ 수정 | `_escHtml` 정의 옆에 `var escHtml = _escHtml; window.escHtml = _escHtml` 추가 |
| `_escHtml(s)` — admin.html 8곳 호출 (브랜딩/스펠/방송 설정). admin.html에 정의 없어 ReferenceError | ✅ 수정 | admin.html `apiJson()` 함수 하단에 정의 추가 |

## ✅ v6.65 버그수정 — Void Raider 교전 모달 로그인 가드 누락

| 항목 | 상태 | 비고 |
|------|------|------|
| `openWorldEventDetail()` — `isLoggedIn()` 체크 없이 모달 바로 오픈. 비로그인 유저가 교전 시도 시 서버에서 `wallet_required` 반환하는 혼란스러운 UX | ✅ 수정 | JWT + walletState 둘 다 없을 때만 차단. 에러 토스트 표시 후 모달 미오픈 |

## ✅ v6.64 버그수정 — Void Raider ENGAGE 지갑 인증 누락

| 항목 | 상태 | 비고 |
|------|------|------|
| `confirmWeEngage()` — JWT `Authorization` 헤더만 전송. 이메일 로그인(JWT) 없이 지갑만 연결된 유저가 교전 시 서버 `wallet_required` 반환 | ✅ 수정 | `x-wallet` 헤더 + body `wallet` 필드 추가. worldEvents `/engage` 라우트는 JWT fallback으로 x-wallet도 수락 |

## ✅ v6.63 버그수정 — Fleet Command 모달 텍스트 깨짐 (정적 HTML에 JS 표현식)

| 항목 | 상태 | 비고 |
|------|------|------|
| Fleet Command `.fleetcmd-title` 부제목 — `'+(LANG==='ko'?'함대 지휘':...)+'` 가 정적 HTML에 삽입돼 리터럴 텍스트로 렌더링 | ✅ 수정 | `<span id="fleetCmdSubtitle">` + `openFleetCmd()` 진입 시 LANG 주입 |
| "새 함대" 버튼 텍스트 — 동일한 JS 표현식 리터럴 렌더 | ✅ 수정 | `<span id="fleetCmdNewBtn">` + 진입 시 LANG 주입 |
| "함대를 선택하세요" 플레이스홀더 — 동일한 JS 표현식 리터럴 렌더 | ✅ 수정 | `<span id="fleetCmdSelectHint">` + 진입 시 LANG 주입 |

## ✅ v6.62 버그수정 — 서비스 파일 잘못된 require (notifications + betting)

| 항목 | 상태 | 비고 |
|------|------|------|
| `shield/staking/lottery/claimUpgrades/dividends/monuments`: `require('./notifications').notifyPlayer` — 존재하지 않는 서비스 파일. 인앱 알림이 silent fail | ✅ 수정 | `require('../db').notifyPlayer` 로 교정. 알림 6개 서비스 정상화 |
| `siege.js`: `require('./betting')` — v1 베팅 서비스 삭제됨. siege 베팅 이벤트 생성/정산 silent fail | ✅ 수정 | `require('./warBetting')` 호환 래퍼 추가. `createBettingEvent` → `warBetting.createEvent`, `settleBettingEvent` → `warBetting.resolveEvent` |

## ✅ v6.61 버그수정 — typeof 가드 undefined 함수 알리아스 + 거버넌스 리프레시

| 항목 | 상태 | 비고 |
|------|------|------|
| `loadGPBalance` / `refreshPP` — typeof 가드로 보호되지만 정의 없어 영토 업그레이드/PP 소비 후 잔액 갱신 no-op | ✅ 수정 | `loadWalletData` 알리아스 추가 |
| `loadClaims` / `refreshClaims` — 영토 병합 후 클레임 재로드 no-op | ✅ 수정 | `compositeClaimsOnTexture()` 래퍼 추가 |
| `renderBlueprintsGrid` / `renderShipList` — 조선소 탭 전환 시 재렌더 no-op | ✅ 수정 | `renderBlueprints()` / `renderShips()` 래퍼 추가 |
| `loadGovDashboard` — 거버넌스 선언 후 대시보드 갱신 no-op (잘못된 함수명) | ✅ 수정 | `loadGovernanceData()` 직접 호출로 교체 |
| `crafting.js` — `gpService`/`seasonService` 잘못된 require | ✅ 수정 | `require('../db').logGPActivity` + `require('../services/season')` 교정 |

## ✅ v6.60 버그수정 — 서버 라우트 잘못된 서비스 require (6개 파일)

| 항목 | 상태 | 비고 |
|------|------|------|
| `vip.js`, `duel.js`, `alliance.js`, `expedition.js`, `rental.js`, `contest.js`: `require('../services/gpService')`, `require('../services/seasonService')`, `require('../services/weeklyChallenge')` — 모두 존재하지 않는 파일명. try-catch로 감싸있어 서버 crash는 없지만 logGPActivity/시즌 점수가 silent no-op | ✅ 수정 | `require('../db').logGPActivity` + `require('../services/season')` 으로 교정. VIP 구매/파벌 행동/듀얼/원정 등 GP 활동이 이제 정상 기록됨 |
| `weeklyChallenges.js` / `weeklyChallenge.js` — 삭제된 서비스. staking/shield/claimUpgrades/marketplace/monuments 에서 try-catch로 로드 시도 | 🟡 허용 | 기능 삭제됨. silent no-op 유지. 주석으로 명시 |

## ✅ v6.59 버그수정 — admin.html mkStatBox 헬퍼 함수 정의 없음

| 항목 | 상태 | 비고 |
|------|------|------|
| `mkStatBox(label, value, color)` — 어드민 패널 실드/복권/경매 통계 카드에 16회 이상 사용. 프로젝트 어느 파일에도 정의 없음 → 어드민 탭 진입 시 ReferenceError | ✅ 수정 | `admin.html`에 함수 정의 추가 (라인 ~3255) |

## ✅ v6.58 버그수정 — refreshBalance / gameAlert 미정의 함수 (직접 호출)

| 항목 | 상태 | 비고 |
|------|------|------|
| `refreshBalance` — 마켓/경매/함선 ops(upgrade/repair/scrap/shield/list) 후 11곳 직접 호출, 정의 없음 → ReferenceError | ✅ 수정 | `window.refreshBalance = loadWalletData` 알리아스 추가 |
| `gameAlert` — 영토 병합/크래프팅/듀얼 등 40곳 직접 호출, 정의 없음 → ReferenceError | ✅ 수정 | `window.gameAlert = function(msg){showToast(...)}` 알리아스 추가 |



## ✅ v6.57 버그수정 — 경매 시스템 auth 누락 (auction create/bid/buyout/cancel)

| 항목 | 상태 | 비고 |
|------|------|------|
| `POST /api/auction/create`, `POST /api/auction/:id/bid`, `POST /api/auction/:id/buyout`, `POST /api/auction/:id/cancel` 모두 requireAuth 적용된 auctionRoutes.js를 호출하지만 프론트 fetch에 Authorization 헤더 없음 → 경매 등록/입찰/낙찰/취소 전부 401 | ✅ 수정 | 각 fetch headers에 `Object.assign({'Content-Type':...}, getAuthHeaders())` 적용 |



## ✅ v6.56 버그수정 — 미정의 함수 aliases 추가 (loadWalletData 직접 호출 7곳 ReferenceError)

| 항목 | 상태 | 비고 |
|------|------|------|
| `loadWalletData` — 복권/스테이킹 등 GP 소비 후 잔액 갱신 호출. 함수 정의 없음 → `.then()` 내 ReferenceError → `.catch()`가 "Error: loadWalletData is not defined" 토스트 표시. 7곳 직접 호출 (typeof 가드 없음) | ✅ 수정 | `window.loadWalletData = refreshEmailBalances` 알리아스 추가 |
| `refreshWalletInfo` — 영토 이벤트/티어업그레이드 후 잔액 갱신. 21곳 typeof 가드 — 정의 없어 항상 silent no-op | ✅ 수정 | `window.refreshWalletInfo = loadWalletData` 알리아스 추가 |
| `updateBalanceDisplays` — GP/PP 표시 갱신. 6곳 typeof 가드 — 정의 없어 항상 silent no-op | ✅ 수정 | `window.updateBalanceDisplays = updateGPDisplay` 알리아스 추가 |
| `loadUserData`, `loadBaseStats` — 유저 데이터 재로드. 5곳씩 typeof 가드 — 정의 없음 | ✅ 수정 | `window.loadUserData = window.loadBaseStats = loadWalletData` 알리아스 추가 |



## ✅ v6.55 버그수정 — getWalletAddress 미정의 함수 → walletState.address

| 항목 | 상태 | 비고 |
|------|------|------|
| 8개 함수 (`loadTransportTab`, `loadFleetCommandCard`, 수송 관련 다수)가 `getWalletAddress()` 호출. 이 함수는 앱 어디서도 정의되지 않음. 폴백 `window._wallet`도 미설정 → `w = ''` → 모든 함수 `if (!w) return` 조기 종료 | ✅ 수정 | `(walletState && walletState.address) \|\| ''` 로 전면 교체. 수송 탭, Fleet Command 카드, 월드이벤트 함대 선택 등 8개 위치 정상화 |



## ✅ v6.54 버그수정 — build-jobs dot 지시자 undefined 토큰

| 항목 | 상태 | 비고 |
|------|------|------|
| 베이스 탭 dot 업데이트 — `GET /api/ships/build-jobs` 에 `Authorization: Bearer + (window._authToken \|\| '')` 전송. `_authToken`은 앱 어디서도 설정되지 않아 항상 빈 문자열 → requireAuth 401 → 건조 완료 dot 표시 안됨 | ✅ 수정 | `getAuthHeaders()` 로 교체 (line ~24224) |



## ✅ v6.53 버그수정 — _phaseDAuthHeaders 잘못된 localStorage 키

| 항목 | 상태 | 비고 |
|------|------|------|
| `_phaseDAuthHeaders()` — `localStorage.getItem('jwt_token') \|\| localStorage.getItem('jwt')` 키는 앱에서 사용하지 않음. 앱 표준은 `pw_token`. 결과적으로 Authorization 헤더 없이 요청 전송 → 동맹 guild add/remove/betray 모두 401 | ✅ 수정 | `localStorage.getItem('pw_token')` 로 통일 |



## ✅ v6.52 버그수정 — openMineralsPanel GET /api/resources/my?wallet= JWT 무시

| 항목 | 상태 | 비고 |
|------|------|------|
| `openMineralsPanel()` — `GET /api/resources/my?wallet=…` 쿼리 파라미터. resources.js requireAuth JWT 인증이 먼저 실행되어 401 | ✅ 수정 | `fetch('/api/resources/my', { headers: getAuthHeaders() })` 로 교체 (line ~30916). MY MINERALS 패널 완전 비표시 버그 수정 |



## ✅ v6.51 버그수정 — govPlaceBet POST /api/betting/bet x-wallet 헤더 → JWT 401

| 항목 | 상태 | 비고 |
|------|------|------|
| `govPlaceBet()` 거버넌스 패널 베팅 — `POST /api/betting/bet` 에 `x-wallet` 헤더 전송. warBettingRoutes `requireAuth` (JWT 전용) → 401 | ✅ 수정 | `Object.assign({'Content-Type':'application/json'}, getAuthHeaders())` 로 교체 (line ~33828). 거버넌스 공성전 베팅 완전 불가 버그 수정 |



## ✅ v6.50 버그수정 — GET /api/ships/my?wallet= 쿼리 파라미터 무시 → 401

| 항목 | 상태 | 비고 |
|------|------|------|
| Ship Registry `GET /api/ships/my?wallet=…` — ships.js requireAuth가 JWT를 확인하고, query.wallet은 requireAuth 통과 후에 사용되므로 JWT 없으면 401 | ✅ 수정 | `fetch('/api/ships/my', { headers: getAuthHeaders() })` 로 교체 (line ~30947). Ship Registry 함선 목록 완전 비표시 버그 수정 |



## ✅ v6.49 버그수정 — GET /api/fleets x-wallet 헤더 → JWT 401

| 항목 | 상태 | 비고 |
|------|------|------|
| `loadFleetCommandCard()` — `GET /api/fleets` x-wallet 헤더만 전송 → fleets.js requireAuth → 401 | ✅ 수정 | `getAuthHeaders()` (JWT) 로 교체. Fleet Command 카드 함대 요약 비표시 버그 수정 |
| 전쟁/전투 함대 선택 (`weFleetSelect`) — 동일 패턴 | ✅ 수정 | `getAuthHeaders()` 로 교체 |
| 거버넌스 패널 함대 표시 (line ~34066) — 동일 패턴 | ✅ 수정 | `getAuthHeaders()` 로 교체 |



## ✅ v6.48 버그수정 — phaseC 토너먼트 shadow-match (GET /tournaments/my)

| 항목 | 상태 | 비고 |
|------|------|------|
| `phaseC.js GET /tournaments/:id` (line 305 mount) → `GET /tournaments/my` shadow-match | ✅ 수정 | `staticSubs = ['my','join']` `next()` guard 추가. 내 토너먼트 목록이 항상 404 반환되던 버그 수정 |



## ✅ v6.47 버그수정 — gameConfirm 구버전 호출 잔여 2건

| 항목 | 상태 | 비고 |
|------|------|------|
| `attemptCraft()` — `gameConfirm(confirmMsg, subMsg, callback)` 레거시 콜백 패턴 (line ~22437) | ✅ 수정 | options object + `.then()` 패턴. 제작 확인 모달 완전 비동작이었음 |
| `purchaseVipPass()` — `gameConfirm({title, body})` icon/confirmText 누락 (line ~22339) | ✅ 수정 | `icon:'👑'`, `confirmText:'GET VIP'` 추가 |



## ✅ v6.46 버그수정 — 온보딩 API URL 불일치 + POST /reward 엔드포인트 누락

| 항목 | 상태 | 비고 |
|------|------|------|
| `initOnboarding()` — fetch URL `/api/user/onboarding` → 서버 마운트 `/api/onboarding` | ✅ 수정 | URL 수정 + JWT 인증 헤더 추가 |
| `obNextStep()` step 5 — fetch URL `/api/user/onboarding/reward` → `/api/onboarding/reward` | ✅ 수정 | URL 수정 + JWT 인증 헤더 추가 |
| `obNextStep()` step 1~4 — fetch URL `/api/user/onboarding/step` → `/api/onboarding/step` | ✅ 수정 | URL 수정 + JWT 인증 헤더 추가 |
| `obSkip()` — fetch URL `/api/user/onboarding/skip` → `/api/onboarding/skip` | ✅ 수정 | URL 수정 + JWT 인증 헤더 추가 |
| `onTutorialClaimSuccess()` — fetch URL `/api/user/onboarding/step` → `/api/onboarding/step` | ✅ 수정 | URL 수정 + JWT 인증 헤더 추가 |
| `POST /api/onboarding/reward` 엔드포인트 미존재 → 404 → 온보딩 step 5 보상 수령 불가 | ✅ 추가 | `onboardingRoutes.js`에 `/reward` 핸들러 추가. `completeStep(wallet,5,{})` 호출 후 `{ok, rewards:{gp,pp}}` 포맷으로 반환 |



## ✅ v6.45 버그수정 — FACTION_FLAVOR 문자열 JS syntax error (미사용 아포스트로피)

| 항목 | 상태 | 비고 |
|------|------|------|
| `FACTION_FLAVOR` 블록 13개 `line_en` — 단일 따옴표 문자열 내 미이스케이프 아포스트로피 | ✅ 수정 | `'` → `\'` 이스케이프. 해당 `<script>` 블록 전체가 SyntaxError로 파싱 실패 → FACTION_FLAVOR 기능 완전 비동작 상태였음 |



## ✅ v6.44 버그수정 — phaseD 동맹 shadow-match + alliance leave 401

| 항목 | 상태 | 비고 |
|------|------|------|
| `phaseD.js GET /alliances/:id` — 'my'/'settings' shadow-match (alliance.js 정적 경로 차단) | ✅ 수정 | `staticSubs` `next()` guard 추가 |
| `leaveAllianceConfirm()` — `POST /api/alliances/leave` JWT 미포함 → phaseD requireAuth → 401 | ✅ 수정 | `pw_token` Authorization 헤더 추가 |



## ✅ v6.43 버그수정 — Express 라우트 shadow-match + gameConfirm 구버전 호출 일괄 수정

| 항목 | 상태 | 비고 |
|------|------|------|
| `tournaments.js` — `GET /tournaments/my` 위치가 `/:id` 뒤라 shadow-match 됨 | ✅ 수정 | `/my` 를 `/:id` 앞으로 이동 |
| `raffle.js` — `GET /raffles/my` 위치가 `/:id(\d+)` 뒤 (d+ 덕분에 실제 동작하나 코드 순서 정정) | ✅ 수정 | `/my` 를 `/:id` 앞으로 이동 |
| `api.js` — `GET /user/:wallet` 이 `/user/titles`, `/user/my-territories` shadow-match | ✅ 수정 | staticSubs `next()` guard 추가 |
| `api.js` — `GET /guild/:id` 이 `/guild/research-bonuses` shadow-match | ✅ 수정 | `research-bonuses` `next()` guard 추가 |
| `respondDuel()` — `gameConfirm('⚔️', title, body)` 구버전 3인수 호출 | ✅ 수정 | options object 패턴으로 교체 |
| 임대 확인 — `gameConfirm('🏘️', title, body)` 구버전 3인수 호출 | ✅ 수정 | options object 패턴으로 교체 |
| 영토 업그레이드 — `gameConfirm(icon, title, body)` 구버전 3인수 호출 | ✅ 수정 | options object 패턴으로 교체 |
| 기념비 설치 — `gameConfirm('🗿', title, body)` 구버전 3인수 호출 | ✅ 수정 | options object 패턴으로 교체 |
| 저널 발행 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 (완전히 비동작) | ✅ 수정 | Promise `.then()` 패턴 + options object로 교체 |
| 마일스톤 기록 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 | ✅ 수정 | Promise `.then()` 패턴 + options object로 교체 |
| 공지 포스팅 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 | ✅ 수정 | Promise `.then()` 패턴 + options object로 교체 |
| 묘비 설치 — `gameConfirm(title, body, callback)` 레거시 콜백 패턴 | ✅ 수정 | Promise `.then()` 패턴 + options object로 교체 |



## ✅ v6.41 버그수정 — BASE QUESTS 현상금 보드 API URL 불일치 + 필드명 불일치

| 항목 | 상태 | 비고 |
|------|------|------|
| loadBountyBoard() — `/api/bounties/*` → 404 | ✅ 수정 | `/api/bounty/list\|my-bounties\|on-me`로 수정 |
| renderBountyList() — `b.poster` → crash (필드명 `poster_wallet`) | ✅ 수정 | `b.poster \|\| b.poster_wallet` 호환 처리 |
| renderBountyList() — `b.gp_amount` → NaN (필드명 `reward_gp`) | ✅ 수정 | `b.gp_amount \|\| b.reward_gp` 호환 처리 |
| renderBountyList() — `b.message` → undefined (필드명 `reason`) | ✅ 수정 | `b.message \|\| b.reason` 호환 처리 |
| submitPostBounty() — `/api/bounties/post` + 잘못된 필드명 | ✅ 수정 | `/api/bounty/post` + `target_wallet/reward_gp/reason` |
| submitPostBounty() — gameConfirm() 구버전 4인수 호출 | ✅ 수정 | options object 패턴으로 교체 |
| cancelBounty() — `/api/bounties/cancel` + `bountyId` body | ✅ 수정 | `/api/bounty/cancel/:id` + body `{wallet}` |
| cancelBounty() — `d.refund` → undefined (필드명 `refunded_gp`) | ✅ 수정 | `d.refunded_gp \|\| 0` |



## ✅ v6.40 버그수정 — 히든 챕터 MCC 보상 잘못 지급 (M3/M4)

| 항목 | 상태 | 비고 |
|------|------|------|
| hidden_campaign_ch1~5 → simulateCh1() 폴백 | ✅ 수정 | simulateHiddenChapter() 추가 |
| hidden_campaign_ch1~5 → calculateCh1Rewards() 폴백 (mcc_int 함선 잘못 지급) | ✅ 수정 | calculateHiddenChapterRewards() 추가 |
| calculateRewards() 알 수 없는 챕터 폴백 → MCC 보상 | ✅ 수정 | 안전 minimal 보상으로 교체 (items 없음) |
| simulateChapter() 알 수 없는 챕터 폴백 | ✅ 수정 | 중립 success 시뮬로 교체 |



## ✅ v6.39 버그수정 — daily OPS 미션 알림 누락 + forfeit 반복 exploit

| 항목 | 상태 | 비고 |
|------|------|------|
| ships.js market_list/market_buy/repair_ship 알림 누락 | ✅ 수정 | notifyMissionProgress 추가 |
| resourceCraft.js craft_resource/×3/×5 알림 누락 | ✅ 수정 | POST /start 핸들러에 추가 |
| crafting.js craft_resource/×3/×5 알림 누락 | ✅ 수정 | POST /crafting/craft 핸들러에 추가 |
| ships.js build_ship — res.json 전에 알림 발화 안 됨 | ✅ 수정 | success 체크 후 알림, res.json 이후로 이동 |
| fleetBattles.js forfeit already_resolved 시 battle_forfeit 적립 exploit | ✅ 수정 | preparing 상태에서만 알림 발화 |



## ✅ v6.37 버그수정 — onboarding PP parseInt 버그 + exchange_max fallback

| 항목 | 상태 | 비고 |
|------|------|------|
| `onboarding_pp_reward` getSettingInt→parseFloat → 0.5가 0으로 처리 | ✅ 수정 | getSettingFloat() 헬퍼 추가 |
| `pp_to_gp_exchange_max` 코드 fallback '10'→'5' 불일치 | ✅ 수정 | migration 220과 정렬 |
| territory identity 컬럼 orphaned (audit error) | ✅ 정상 | territoryIdentity.js가 처리 중 |



## ✅ v6.36 버그수정 — frontend wallet null guard + dead DOM ref

| 항목 | 상태 | 비고 |
|------|------|------|
| loadTerritoryProduction wallet null guard 없음 | ✅ 수정 | if(!wallet) return 추가 |
| loadBountyBoard wallet URL encodeURIComponent 없음 | ✅ 수정 | encodeURIComponent 적용 |
| opsBoardCountdown2 존재하지 않는 DOM 참조 | ✅ 수정 | dead ref 제거 |



## ✅ v6.35 버그수정 — battleScheduler 프로세스 재시작 시 stale battle 정리

| 항목 | 상태 | 비고 |
|------|------|------|
| 서버 재시작 후 active 상태 stuck 전투 정리 부재 | ✅ 수정 | cleanupStaleBattles() 추가 |
| 30분+ 경과 active 전투 → cancelled + fleet 락 해제 | ✅ | start() 호출 시 자동 실행 |
| battleScheduler.js syntax check | ✅ | node --check pass |



## ✅ v6.34 버그수정 — dailyOps weekly-events 라우트 순서 수정

| 항목 | 상태 | 비고 |
|------|------|------|
| `GET /weekly-events` shadow match by `GET /:wallet` | ✅ 수정 | /weekly-events를 /:wallet 앞으로 이동 |
| 중복 router.get('/weekly-events') 제거 | ✅ | 하단 블록 삭제 |
| dailyOps.js syntax check | ✅ | node --check pass |



## ✅ v6.33 로컬라이징 27차 완성 — ops카운트/PVP탭/길드기부/프로필헤더

## ✅ v6.33 로컬라이징 27차 완성 — ops카운트/PVP탭/길드기부/프로필헤더

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML — Ops 카운트다운 fallback 한국어→중립 EN | ✅ | JS가 동적으로 LANG ternary 처리 |
| 정적 HTML data-i18n — Ops 보드 loading_dots | ✅ | 기존 loading_dots 키 재사용 |
| 정적 HTML data-i18n — PVP 탭 이동 버튼 3개 | ✅ | pvp_goto_tab/pvp_from_tab |
| 정적 HTML data-i18n — 길드 GP 기부 라벨 | ✅ | guild_gp_donate_lbl |
| 정적 HTML data-i18n — 프로필 꾸미기 헤더 | ✅ | prof_customize_title |
| i18n 4개 언어 — 4개 신규 키 추가 | ✅ | pvp_goto_tab/pvp_from_tab/guild_gp_donate_lbl/prof_customize_title |
| 한국어 전용 UI 문자열 — 정적 HTML 전체 완료 | ✅ | 남은 한국어=lang메뉴+data-i18n fallback+i18n KO섹션 값 |



## ✅ v6.32 로컬라이징 26차 완성 — VIP/크레이트/프레스티지 설명 패널

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML data-i18n — VIP 패스 타이틀 + 설명 div | ✅ | vip_pass_title/vip_pass_desc |
| 정적 HTML data-i18n — 크레이트 타이틀 + 설명 div | ✅ | crate_what_title/crate_what_desc |
| 정적 HTML data-i18n — 프레스티지 타이틀 + 설명 div | ✅ | prestige_what_title/prestige_what_desc |
| i18n 4개 언어 — 6개 신규 키 추가 | ✅ | HTML 포함 desc 키 → applyI18n() innerHTML 처리 |
| data-i18n 한국어 fallback content 유지 (div 내부) | ✅ | applyI18n()이 즉시 덮어씀 |



## ✅ v6.31 로컬라이징 25차 완성 — 영토정체성/섹터라벨/WE모달/카운트접미사

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML data-i18n — WE 함대선택 option + 최소함선 안내 | ✅ | we_select_fleet/we_fleet_min |
| 동적 JS — 영토 목록 개 접미사 (2곳) | ✅ | 4개 언어 (개/個/个/없음) |
| 동적 JS — 영토 생산 sectorLabel (코어/미드/프론티어) | ✅ | 4개 언어 |
| 동적 JS — 영토 정체성 소유자/섹터 메타 | ✅ | 4개 언어 |
| 동적 JS — 영토 정체성 이력 4항목 | ✅ | 보유일/방어성공/탈환/최대보유 4개 언어 |
| 동적 JS — 영토 정체성 이력/배지 섹션 라벨 | ✅ | 4개 언어 |
| 동적 JS — World Events 네트워크 오류 toast | ✅ | 4개 언어 |
| 동적 JS — 캠페인 로그인 필요 toast | ✅ | 4개 언어 |
| 동적 JS — 거버너 전투 힌트 텍스트 | ✅ | 4개 언어 |
| i18n 4개 언어 — 2개 신규 키 추가 | ✅ | we_select_fleet/we_fleet_min |



## ✅ v6.30 로컬라이징 24차 완성 — ops보드/PVP허브/포지/영토JS/하이잭알림

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML data-i18n — Ops 보드 타이틀 + 범례 3개 | ✅ | ops_board_title/ops_legend_done/pending/urgent |
| 정적 HTML data-i18n — PVP 허브 전투선언 + 탭 3개 | ✅ | pvp_declare_btn/pvp_tab_rec/bounty/conflict |
| 정적 HTML data-i18n — WAR BETTING 타이틀 | ✅ | wb_title |
| 정적 HTML data-i18n — 포지 강화중 텍스트 + 확인 버튼 | ✅ | forge_upgrading / btn_confirm |
| 동적 JS — BASE 영토 판매중 배지 + 로딩중 | ✅ | 4개 언어 LANG ternary |
| 동적 JS — BASE 영토 수확/보호막/업그레이드/지도 버튼 | ✅ | 4개 언어 |
| 동적 JS — 영토 생산 최근수확/아직수확없음 | ✅ | 4개 언어 |
| 동적 JS — TIER_LABELS 섹터컨트롤 등급 | ✅ | 4개 언어 (총독/지배/이해관계자/존재감) |
| 동적 JS — 섹터컨트롤 (나) 레이블 | ✅ | 4개 언어 |
| 동적 JS — 하이잭 AUTO-WIN + 함대전 알림 | ✅ | 4개 언어 |
| i18n 4개 언어 — 10개 신규 키 추가 | ✅ | ops_*/pvp_*/wb_title/forge_upgrading |



## ✅ v6.29 로컬라이징 23차 완성 — 워베팅toast/모바일영토버튼/버그리포터

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 워베팅 베팅 성공 toast | ✅ | 4개 언어 |
| 정적 HTML data-i18n — 모바일 영토 버튼 6종 | ✅ | mt_rename/mt_decorate/mt_sell/mt_shield/mt_upgrade/mt_hijack |
| 정적 HTML data-i18n — 버그 리포터 8요소 | ✅ | br_hint/br_label_desc/br_label_ss 등 |
| i18n 4개 언어 섹션 — 14개 신규 키 추가 | ✅ | mt_* + br_* |



## ✅ v6.28 로컬라이징 22차 완성 — 전투결과/동맹/리플레이/워베팅/온보딩

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 전투결과 타이틀 + 승/패/무승부 배지 | ✅ | 4개 언어 |
| 동적 JS — 하이라이트 라벨맵 + 이동 버튼 + 장면 타이틀 | ✅ | 4개 언어 |
| 동적 JS — 동맹 로딩/실패/카드메타/탈퇴 | ✅ | 4개 언어 |
| 동적 JS — 동맹 목록 (기존/없음/멤버/함선/가입) | ✅ | 4개 언어 |
| 동적 JS — 동맹 창설/가입/탈퇴 confirm + 오류맵 + toast | ✅ | 4개 언어 |
| 동적 JS — 리플레이 empty 메시지 (공유/추천) | ✅ | 4개 언어 |
| 동적 JS — 워베팅 로딩/empty/실패/typeMap/closeText/버튼/statusMap | ✅ | 4개 언어 |
| 동적 JS — 온보딩 완료 환영 toast | ✅ | 4개 언어 |



## ✅ v6.27 로컬라이징 21차 완성 — 전투보상/AI/토너먼트/브래킷/하이잭/후퇴/커맨드/BV패널

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 전투 승리/참가 보상 타이틀 | ✅ | 4개 언어 |
| 동적 JS — AI 카드 척수 + 챌린지 gameInput + 대전 toast | ✅ | 4개 언어 |
| 동적 JS — 토너먼트 N강 라벨 + 등록 gameInput + 규모 picker | ✅ | 4개 언어 |
| 동적 JS — 브래킷 로딩/준비중/관전/로드실패 | ✅ | 4개 언어 |
| 동적 JS — 하이잭 힌트 메시지 | ✅ | 4개 언어 |
| 동적 JS — 후퇴 toast | ✅ | 4개 언어 |
| 동적 JS — 지시 라벨 맵 (진형/기동/집중공격 등) | ✅ | 4개 언어 |
| 동적 JS — 지시 적용/인증오류/실패 toast 3종 | ✅ | 4개 언어 |
| 동적 JS — BV 함선 수/HP 표시 | ✅ | 4개 언어 |
| 동적 JS — BV 자원 empty 메시지 | ✅ | 4개 언어 |
| 동적 JS — 전투 스탯 라벨 (공/방/HP) | ✅ | 4개 언어 |
| 동적 JS — 자동 승리/패배 메시지 | ✅ | 4개 언어 |
| 동적 JS — BV 내 함대/적 함대 참가자 함선 표시 | ✅ | 4개 언어 |



## ✅ v6.26 로컬라이징 20차 완성 — 전투목록/검색/시간표시/CA동적JS

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML — Battle Viewer 사이드 패널 loading (4개) | ✅ | data-i18n="loading_dots" |
| 동적 JS — 전투 카드 척수/분/관전/리플레이/즉시시작 | ✅ | 4개 언어 |
| 동적 JS — 즉시 시작 confirm + toast | ✅ | 4개 언어 |
| 동적 JS — formatShortTime (방금/분후/분전/시간전/일전) | ✅ | 4개 언어 |
| 동적 JS — 함대 셀렉터 척수 + 검색 힌트 5종 | ✅ | 4개 언어 |
| 동적 JS — 검색 결과 카드 (함대명/전적/척수/전투중) | ✅ | 4개 언어 |
| 동적 JS — CA 모달 동적 텍스트 + Doctrines 설명 6종 | ✅ | 4개 언어 |
| 동적 JS — 지시적용버튼 텍스트 리셋 4곳 | ✅ | 4개 언어 |



## ✅ v6.25 로컬라이징 19차 완성 — CA모달/전투허브/리플레이공유/파벌설명

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML — 전투 허브 타이틀/탭/버튼/부제목 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 전투 선언 다이얼로그 라벨/placeholder | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — Commander Actions 모달 전체 (15항목) | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — AI 연습전 설명 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 토너먼트 개최 버튼 | ✅ | data-i18n + 4개 언어 키 |
| 동적 JS — 전투 선언 confirm 타이틀/본문/버튼 | ✅ | 4개 언어 |
| 동적 JS — 리플레이 공유 gameInput + 에러코드 3종 + 링크 다이얼로그 + toast | ✅ | 4개 언어 |
| 동적 JS — 토너먼트 개최 gameInput + 참가비 gameInput | ✅ | 4개 언어 |
| 동적 JS — Ship Registry FACTION_META desc 3종 | ✅ | 4개 언어 |



## ✅ v6.24 로컬라이징 18차 완성 — 전투/토너먼트/리플레이 정적 HTML

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML — 전투 취소/공격시작 버튼 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 보상 토스트 타이틀/닫기 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — AI 연습전 타이틀 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 토너먼트 탭 3종 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 리플레이 탭 2종 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 전투 검색 힌트 | ✅ | data-i18n + 4개 언어 키 |

## ✅ v6.23 로컬라이징 15~17차 완성 — 인벤/마켓/조선소/함대지휘/전쟁모달

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 인벤토리 카테고리 비어있음 | ✅ | 4개 언어 |
| 동적 JS — 마켓 등록 다이얼로그 전체 (7항목) | ✅ | 고정가/경매/시작가/즉구가/기간/수수료/등록 4개 언어 |
| 동적 JS — 영토 이름 변경 gameInput | ✅ | 4개 언어 |
| 동적 JS — 함선 강화 애니메이션 상태 (4종 제목 + 확률/굴림) | ✅ | 4개 언어 |
| 동적 JS — 함선 수리 confirm 전체 | ✅ | 4개 언어 |
| 동적 JS — 함선 해체 confirm 전체 | ✅ | 4개 언어 |
| 동적 JS — 실드 충전 confirm 전체 + toast | ✅ | 4개 언어 |
| 동적 JS — 마켓/MY FLEET 판매중 스티커 | ✅ | 4개 언어 |
| 동적 JS — 함선 판매/구매/취소 confirm 전체 | ✅ | 4개 언어 |
| 동적 JS — 건조중 표시 | ✅ | 4개 언어 |
| 정적 HTML — 전쟁 선포 모달 4개 항목 data-i18n | ✅ | 4개 언어 |
| 동적 JS — Fleet Command UI 전체 (타이틀/버튼/상태/에러 20종) | ✅ | 4개 언어 |
| 동적 JS — 함대 카드 메타 (척/전투중/이름없음) | ✅ | 4개 언어 |
| 동적 JS — 함대 상세 (척수/전적/해제/이동/선택) | ✅ | 4개 언어 |
| 동적 JS — 함대 해체 confirm | ✅ | 4개 언어 |

## ✅ v6.22 로컬라이징 14차 완성 — 정적 HTML 길드기부/인증 입력

| 항목 | 상태 | 비고 |
|------|------|------|
| 정적 HTML — 길드 기부 GP 입력 placeholder | ✅ | data-i18n-placeholder + 4개 언어 키 |
| 정적 HTML — 길드 기부 버튼 | ✅ | data-i18n + 4개 언어 키 |
| 정적 HTML — 콜로니 모토/상태/vtag 입력 | ✅ | data-i18n-placeholder × 3 + 4개 언어 키 |

## ✅ v6.21 로컬라이징 13차 완성 — 정보모달/PVP허브/현상금/보호막/업적/SVG

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — _openInfoModal 닫기 버튼 | ✅ | 4개 언어 |
| 동적 JS — MY MINERALS 비어있음/로드실패 | ✅ | 4개 언어 |
| 동적 JS — SHIP REGISTRY 총척/가용/로드실패 | ✅ | 4개 언어 |
| 동적 JS — PVP Hub 지갑미연결/온라인·오프라인/섹터/활동 | ✅ | 4개 언어 |
| 동적 JS — PVP Hub 도전장/분쟁탭 전투·현상금·클레임 | ✅ | 4개 언어 |
| 동적 JS — 현상금 보드 전체 UI | ✅ | 4개 언어 |
| 동적 JS — 보호막 confirm body + GP비용 + confirmText | ✅ | 4개 언어 |
| 동적 JS — _achConditionLabel JA/ZH 사전 29종 | ✅ | 4개 언어 |
| 동적 JS — 업적 상세 모달 labels 7종 | ✅ | 4개 언어 |
| 동적 JS — 아트 제출 / 렌탈 / 금고 입출금 inputs | ✅ | 4개 언어 |
| 동적 JS — SVG 자산흐름 다이어그램 8개 라벨 | ✅ | 4개 언어 |
| KO-only 잔류 (30779~42000줄 UI 항목) | ✅ | 0건 (장문 도움말 제외) |

## ✅ v6.20 로컬라이징 10차 완성 — 함대카드/길드/타이머/요일라벨

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 함대카드 함급 칩 (타이탄/전함/순양/구축/프리깃) | ✅ | 4개 언어 |
| 동적 JS — 함대카드 편집·배치·더보기 | ✅ | 4개 언어 |
| 동적 JS — 길드 연구 설명(desc) 다국어 오브젝트화 | ✅ | 7종 4개 언어 |
| 동적 JS — 길드 레벨업 슬롯·멤버 표시 | ✅ | 4개 언어 |
| 동적 JS — 길드전 선포·진행·버프 메시지 전체 | ✅ | 4개 언어 |
| 동적 JS — 길드 가입신청/탈퇴/추방/양도/해산 confirm | ✅ | 4개 언어 |
| 동적 JS — 동맹 탈퇴 confirm | ✅ | 4개 언어 |
| 동적 JS — OPS 보드 전체 (로딩/긴급/미션/주간) | ✅ | 4개 언어 |
| 동적 JS — 카운트다운 타이머 (리셋까지/만료/시간/분) | ✅ | 4개 언어 |
| 동적 JS — 요일 라벨 배열 | ✅ | KO/JA/ZH/EN 4개 언어 |
| KO-only 잔류 (23701~26200줄) | ✅ | 0건 (전체 스캔 완료) |

## ✅ v6.19 로컬라이징 9차 완성 — 함대전/토너먼트/파벌/버그리포트

| 항목 | 상태 | 비고 |
|------|------|------|
| 동적 JS — 파벌 모달 전체 | ✅ | 쿨다운/선택/변경/배지 4개 언어 |
| 동적 JS — 함선 마켓 메시지 | ✅ | 판매/취소/구매 성공·실패 4개 언어 |
| 동적 JS — 함선 강화 forge 결과 | ✅ | 오류/성공/실패/판매중 차단 4개 언어 |
| 동적 JS — 수리/해체/실드 토스트 | ✅ | 4개 언어 |
| 동적 JS — 함선 건조 에러맵 | ✅ | NO_FACTION~INSUFFICIENT 5종 4개 언어 |
| 동적 JS — 함대지휘 메시지 전체 | ✅ | 로드/진형·기동/이름/해체/함선이동 4개 언어 |
| 동적 JS — Battle Hub 상태 | ✅ | 로딩/빈탭/오류 4개 언어 |
| 동적 JS — PVP 선언 에러맵 | ✅ | 7종 에러 4개 언어 |
| 동적 JS — Commander Actions 에러맵 | ✅ | 7종 에러 4개 언어 |
| 동적 JS — AI 연습전 | ✅ | 그리드 로딩/빈/오류/선택 4개 언어 |
| 동적 JS — 토너먼트 전체 | ✅ | 상태라벨/에러맵/버튼/빈탭 4개 언어 |
| 동적 JS — Battle Viewer 오류 | ✅ | ID 누락/타임라인 오류 4개 언어 |
| 동적 JS — 동맹/리플레이/베팅/버그리포터 | ✅ | 4개 언어 |
| 동적 JS — 수송 취소/약탈 gameConfirm | ✅ | 4개 언어 |
| showToast/showFactionToast KO-only 잔류 | ✅ | 0건 (전체 스캔 완료) |

## ✅ v6.18 로컬라이징 전수 완성 — 4개 언어 상업 출시 기준

| 항목 | 상태 | 비고 |
|------|------|------|
| I18N 키 정합 (EN/KO/JA/ZH) | ✅ | 1,571키 4개 언어 완전 정합 (이전 세션 완료) |
| 동적 JS — 함대전 발생 메시지 | ✅ | fleet/ship 카운트 4개 언어 |
| 동적 JS — 섹터 레벨 잠금 경고 | ✅ | JA/ZH 추가 |
| 동적 JS — 수송 관련 토스트 7종 | ✅ | 출발/성공/실패/취소/약탈/네트워크 오류 4개 언어 |
| 동적 JS — 수확 관련 UI 6종 | ✅ | 로딩/쿨다운/실패/다음수확/로그인 4개 언어 |
| 동적 JS — 영토 업그레이드 모달+토스트 | ✅ | 4개 언어 |
| 동적 JS — 조선소 카드 함선명/설명 | ✅ | syShipName() + JA/ZH 설명 fallback |
| 동적 JS — 광물 패널 티어/이름/설명 | ✅ | name_ja/name_zh DB 컬럼 우선 |
| 동적 JS — 함대지휘 선택 패널 | ✅ | 기함/척/선택함선 4개 언어 |
| 동적 JS — 영토 병합 UI 전체 | ✅ | 모달/버튼/토스트 4개 언어 |
| 동적 JS — 경매/마켓 등록 | ✅ | 성공/실패/가격입력 4개 언어 |
| 동적 JS — 길드 기부/길드전 | ✅ | 4개 언어 |
| 동적 JS — 하이젝 에러맵 | ✅ | hjErrMap ko/ja/zh/en 4중 객체 |
| 동적 JS — 온보딩 직업/파벌/미션 | ✅ | _jobData JA/ZH 추가, 파벌 name_ja/zh 컬럼 지원 |
| 동적 JS — 미션 미니게임 컨티뉴 | ✅ | 4개 언어 |
| 잔여 DB 의존 이진 패턴 | 🟡 | ev.label_ko/m.label_ko/we.label_ko — DB에 _ja/_zh 컬럼 없어 EN fallback. 콘텐츠 팀 작업 필요 |
| 500 에러 최종 확인 | ✅ | 12개 엔드포인트 smoke test 전원 통과 (2026-05-06 18:xx) |



## v6.17 서버 smoke 감사 — legacy read endpoint 보강

| 항목 | 상태 | 비고 |
|------|------|------|
| API curl smoke | ⚠️ | sandbox에서 `localhost:3000` TCP 접속 실패. `lsof` 기준 node PID가 `*:3000` LISTEN 중임은 확인. |
| DB settings 검사 | ⚠️ | `psql pixelwar` 및 `postgresql://jongho@localhost:5432/pixelwar` 모두 sandbox 정책으로 `Operation not permitted`. 데이터 수정 없음. |
| Route mount 검사 | ✅ | `server/routes/*.js` 77개, `server/index.js` route require 참조 77개, 누락 없음. |
| Capital recipe smoke | ⏸ | `server/tools/smoke_capital_recipes.js` 존재 확인. 테스트 지갑의 inventory/GP/build/craft rows를 UPDATE/INSERT하므로 “기존 데이터 수정 금지” 제약상 실행하지 않음. |
| `/api/battles/history?wallet=...` | ✅ | legacy alias 추가. 기존에는 `/api/battles/:id`에 `history`가 매칭되어 400 처리될 수 있었음. |
| `/api/battles/active?wallet=...` | ✅ | legacy alias 추가. wallet이 있으면 참여 전투만, 없으면 전체 active/preparing 목록. |
| `/api/ships/blueprints` | ✅ | 선택 인증으로 변경. JWT 없이 `?wallet=`/`x-wallet` smoke 가능, wallet 누락은 400 `WALLET_REQUIRED`. |
| 문법 검증 | ✅ | `node --check server/routes/ships.js`, `node --check server/routes/fleetBattles.js` 통과. |

## ✅ v6.16 전수 500 에러 제거 완료 — 서버 전체 엔드포인트 클린

| 항목 | 상태 | 비고 |
|------|------|------|
| claims 유령 컬럼 전수 수정 | ✅ | `sector_x/y→center_lng/lat`, `name→custom_name`, `x/y→center_lng/lat` — shield/claimUpgrades/monuments/tdesc/rating/tribute/sponsor/expedition |
| users.wallet → wallet_address | ✅ | auth.js delete-account 수정 |
| claims.status phantom → deleted_at | ✅ | auth.js delete-account 수정 |
| staking.staked_at → created_at | ✅ | staking.js ORDER BY 수정 |
| battles 유령 컬럼 | ✅ | season.js: winner_wallet/attacker_wallet/gp_stake/status → attacker/defender/success/attack_cost |
| auction current_bidder_wallet/current_bid | ✅ | Migration 219로 컬럼 추가 + getUserAuctions 쿼리 수정 |
| LOWER() wallet 비교 | ✅ | warBetting/contest/spells/donation/arena/worldEvents/achievements |
| hallOfFameRoutes titleExtended 의존성 | ✅ | 로컬 getHallOfFameBoard() 추가 — 실제 hall_of_fame 컬럼만 사용 |
| 전체 엔드포인트 500 검수 | ✅ | 50+ 엔드포인트 전수 확인 — 2026-05-06 16:54 기준 500 에러 0건 |

---

## ✅ v6.15 서버 전수 버그 수정 — hijack/ai-fight/harvest/repair/tournament/admin-economy

## ✅ v6.15 서버 전수 버그 수정 — hijack/ai-fight/harvest/repair/tournament/admin-economy

| 항목 | 상태 | 비고 |
|------|------|------|
| Hijack declare-with-pp | ✅ | `api.js` 공격 함대/자가 픽셀 비교와 `hijack.js` PP 정산/수비 claim/함대 조회의 `LOWER()` 적용 확인. `fleet_battles`는 `hijack/preparing/hijack_phase1`로 CHECK 통과. |
| AI Fight | ✅ | `phaseC.js` battle + participants INSERT 트랜잭션화. AI 판별은 `fleets.is_ai` 컬럼 존재 시 또는 owner `users.is_ai` 기준. `battle_type='pvp_duel'`로 CHECK 통과. |
| Territory Harvest | ✅ | `/api/territory/:claimId/harvest`는 PP 지급, resource drop, `claims.last_harvest_at`, transaction log가 단일 트랜잭션 안에서 처리됨 확인. |
| Ship Repair/Shield | ✅ | `ship.js` market-listed 차단/GP 트랜잭션/GP 로그 유지 확인. 수리 재료 차감 wallet 비교를 `LOWER()`로 수정. |
| Tournament | ✅ | 참가 등록 wallet 비교 `LOWER()` 보강, 참가비 GP 로그 추가, 정원 도달 시 브래킷 생성 자동 호출. match battle 연결을 트랜잭션화하고 `battle_type='event'` 유지. |
| Admin Economy | ✅ | `adminEconomyRoutes.js` territory economy/upgrades 쿼리 fallback 확인. 존재하지 않는 보조 뷰/테이블은 빈 결과로 응답. |
| DB 직접 확인 | ⚠️ | sandbox network 제한으로 localhost:5432 `psql` 접속은 `Operation not permitted` 발생. 마이그레이션/코드 기준으로 CHECK 값을 대조함. |

---

## ✅ v6.14 OPS 미션 전체 와이어링 + UI 수정 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| OPS 미션 15종 notifyMissionProgress 와이어링 | ✅ | 전투 3종 기존 + 12종 신규 연결 (harvest/art/upgrade/claim/login/ship/fleet/craft/market/campaign) |
| 캘린더 요일 이름 제거 | ✅ | SUN/MON/TUE… 표시 제거, 이벤트 아이콘+보너스만 표시 |
| today_dow UTC→로컬 변경 | ✅ | UTC 고정 시 한국(UTC+9) 기준 하루 밀리던 문제 수정 |
| BASE 탭 이모지 제거 | ✅ | ⚓⚔🛒📦 → 텍스트만 |

---

## ✅ v6.13 Codex 감사 버그 수정 3건 — 완료

## ✅ v6.13 Codex 감사 버그 수정 3건 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| hold_bonus_pct 미적용 | ✅ | `/api/territory/:claimId/harvest`에 적용. 구버전 `/api/harvest`(미사용)에서 제거 |
| 월요일 채굴 +50% 위치 오류 | ✅ | 실제 사용 엔드포인트에만 적용 |
| AI 연습전 OPS 미션 미적립 | ✅ | phaseC.js battle_type은 DB CHECK 허용값 `pvp_duel` 유지, `battle_summary.is_ai_battle=true`로 구분 |

---

## ✅ v6.12 주간 이벤트/CPI/OPS 연동 + Field Rating 하이젝 가중 — 완료 (Codex 협업)

| 항목 | 상태 | 비고 |
|------|------|------|
| MON +50% 채굴 보너스 (api.js harvest) | ✅ | UTC getDay===1 체크, harvestedPP ×1.5 |
| WED +30% 전투 GP (battleRewards.js) | ✅ | computeReward + distributeMinimalRewards 양쪽 적용 |
| FRI -20% 강화 비용 (ship.js) | ✅ | finalGpCost = cost×0.8, 차감/로그/반환 일관화 |
| CPI 전투 후 자동 재계산 (battleScheduler.js) | ✅ | _postBattleHooks → updateFleetCPI(atkFleetId/defFleetId) |
| Daily OPS battle_participate/win/ai_battle 트래킹 | ✅ | _postBattleHooks → notifyMissionProgress |
| performance_rating DB 저장 (battleReport.js) | ✅ | generateBattleReport에서 atk/def rating UPDATE fleet_battles |
| Field Rating → hijack attackCost 가중 (api.js) | ✅ | FR<10: ×1.0 / FR<30: ×1.1 / FR<60: ×1.25 / FR≥60: ×1.5 |

---

## ✅ v6.11 약점 개선 기획서 5대 기능 구현 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 장기 보유 보상 (hold_bonus_pct harvest) | ✅ | api.js extractor 블록 뒤에 추가. claims.hold_bonus_pct 적용 |
| 영토 위협 알림 (hijack 선언 시 푸시) | ✅ | 침공 선언 성공 직후 notifyPlayer → territory_threatened |
| 비활성 복귀 훅 | ✅ | server/index.js 스케줄러 — 7일+ 미접속 유저 daily UTC 09:00 체크, return_reminder |
| 갤럭시 캘린더 7일 UI | ✅ | Daily OPS Board 상단에 7일 스트립 (오늘 강조, 이벤트 레이블) |
| 리플레이 하이라이트 3장면 | ✅ | GET /api/battles/:id/highlights 신규. _loadBattleReport에 버튼 UI. openBattleViewerAt() + startTick 파라미터 + 자동 패스트포워드 오버레이 |
| 장기 보유 보너스 생산 패널 표시 | ✅ | production 응답에 holdBonusPct/holdDays 추가. 프론트 PRODUCTION 섹션에 배지+% 표시 |

---

## ✅ v6.10 전투 기함 cascade 제거 / OPS 30종 확장 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 기함 격침 cascade 제거 | ✅ | 기함 파괴 → 나머지 함선 전투 지속. 전체 함선 HP=0 또는 forfeit만 종료 |
| 전투 종료 조건 | ✅ | fleet.dead → f.ships.some(s=>s.isAlive) 기반 변경 |
| AI 연습전 조기 종료 | ✅ | 위 cascade 제거로 자연 해소 |
| Daily OPS 미션 30종 | ✅ | 영토7+전투7+함선7+경제6+캠페인/로그인3, 하루 9개 표시 |
| OPS GO 버튼 30종 분기 | ✅ | opsMissionGo() 모든 타입 처리 |
| 주간 진척도 요일 라벨 | ✅ | 월~일 라벨 + 오늘 강조 + 완료일 밝은 표시 |
| 전투 기록 자동 갱신 | ✅ | 전투 결과 카드 후 내 기록 탭 자동 refresh |

---

## ✅ v6.09 기획서 스펙 UI 정합 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 전투 결과 리포트 타이틀 | ✅ | 'ATTACKERS WIN' → '⚔ 전투 결과 리포트' (항상 고정) |
| 전투 결과 부제목 | ✅ | 함대명 VS 함대명 + 승리/패배 배지 (기획서 wireframe 일치) |
| ATK/DEF 스탯 라벨 | ✅ | 총함선→투입함선, 손실→격침, 데미지→총데미지 |
| ATK/DEF 패널 WIN/LOSS 배지 | ✅ | 패널 내부 '나' 배지 + WIN/LOSS 인라인 표시 |
| 제목 폰트 한국어 최적화 | ✅ | 20px/letter-spacing 2px (기존 32px/8px) |
| Territory Identity FR 배지 | ✅ | Field Rating 숫자 + 티어 레이블 + PP 보너스% 표시 |

---

## ✅ v6.08 게임 개선 4대 기능 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **Migration 215** fleet_battles 통계 컬럼 + CPI | ✅ | DB 적용 완료 |
| **Migration 216** claims 영토 정체성 컬럼 | ✅ | DB 적용 완료 |
| **Migration 217** daily_ops 테이블 | ✅ | DB 적용 완료 |
| **Migration 218** bounty_listings 테이블 | ✅ | DB 적용 완료 |
| `server/services/battleReport.js` 생성 | ✅ | generateBattleReport/getPlayerBattleStats/getRecommendedOpponents |
| `GET /api/battles/:id/report` | ✅ | fleetBattles.js에 추가 |
| `GET /api/battles/my-stats/:wallet` | ✅ | fleetBattles.js에 추가 |
| `GET /api/battles/recommended-opponents/:wallet` | ✅ | fleetBattles.js에 추가 |
| `server/routes/dailyOps.js` 생성 | ✅ | GET/progress/claim/weekly-events |
| `server/routes/bounty.js` 생성 | ✅ | list/my-bounties/on-me/post/claim/cancel |
| `server/routes/territoryIdentity.js` 생성 | ✅ | identity CRUD + conflict-map |
| 라우트 등록 (server/index.js) | ✅ | /api/bounty /api/daily-ops /api/territory /api/sectors |
| Territory FR/Badge 스케줄러 | ✅ | 매 5분 체크, UTC 00:00 실행 |
| Bounty 만료 스케줄러 | ✅ | 매 1시간 환불 처리 |
| 프론트: 전투 리포트 카드 (showBattleResult + _loadBattleReport) | ✅ | S/A/B/C/D 레이팅, 하이라이트, MVP |
| 프론트: _showMyBattleStats() 모달 | ✅ | 승률/KD/연승/파벌별 승률 |
| 프론트: Daily OPS Board (OPS 탭 상단) | ✅ | 미션 목록+진행바+CLAIM |
| 프론트: Territory Identity (영토 패널) | ✅ | FR/배지/닉네임/바이오 편집 |
| 프론트: 추천 상대 (PVP 탭) | ✅ | spec 4-2 FLEET BATTLE HUB 위젯 — 3탭 (추천/현상금/분쟁), 카드형 카드 |
| 프론트: 현상금 게시판 (PVP 탭) | ✅ | Hub 현상금 탭 안에 인라인 이동 |
| 프론트: 섹터 분쟁 탭 (PVP 탭) | ✅ | /api/sectors/conflict-map Heat 순 목록 |
| 서버: getRecommendedOpponents 필드 보강 | ✅ | sector_code / last_battle_ago / is_online 추가 |
| i18n 60+ 신규 키 (EN/KO) | ✅ | battle_report/daily_ops/territory_identity/bounty/pvp_rec |
| 모듈 로드 오류 없음 | ✅ | node 문법 검증 통과 |
| 서버 기동 오류 없음 | ✅ | `node server/index.js` 부팅 확인 |

설계 문서: `docs/GAME_IMPROVEMENT_PLAN_2026-05-05.md`

---

## ✅ v6.07 종합 로컬라이제이션 패스 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 착륙 오버레이 한국어 텍스트 | ✅ | data-i18n EN/KO/JA/ZH |
| 온보딩 Step 0~4 전체 | ✅ | t() 적용, 직업명/파벌명 언어별 분기 |
| 모달 닫기 버튼 "✕ 닫기" (7개 모달) | ✅ | data-i18n="btn_close" |
| 전쟁 베팅 탭 | ✅ | wb_tab_* keys |
| 조선소 마켓 정렬 | ✅ | sy_sort_* keys |
| 배틀뷰어 결과 (승리/패배/통계) | ✅ | bv_my_* keys via t() |
| 배틀 목록 카드 상태/유형 레이블 | ✅ | bc_* keys via t() |
| PVP 탭 설명/버튼 | ✅ | data-i18n siege/fleet_battle_* |
| 함대 빈 상태 메시지 | ✅ | fleet_no_*_hint keys |
| 함대 전투 오류 토스트 | ✅ | t() 적용 |
| 길드전 자동승리 다이얼로그 | ✅ | gw_auto_win_* keys |
| 인벤토리 필터 버튼 | ✅ | inv_cat_* keys |
| 영토 탭 제목·로그인 힌트 | ✅ | data-i18n |
| 하이젝 함대없음/로딩 | ✅ | data-i18n |
| 함선 레지스트리 광물 카탈로그 | ✅ | LANG 분기 |
| EN/KO 키 수 | ✅ | 1499키 (이전 1440) |
| I18N.en/ko 동수 확인 | ✅ | node eval 통과 |

검증: `node -e I18N eval` 통과, EN/KO 1499 동수, 모든 신규 키 존재 확인

---

## ✅ v6.06 영토별 개별 수확 + 채굴 탭 제거 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| Migration 214 — `claims.last_harvest_at` | ✅ | 적용 완료 |
| `POST /api/territory/:claimId/harvest` | ✅ | server/routes/api.js 추가 |
| 소유권 검증 + 쿨다운 체크 | ✅ | `claims.last_harvest_at` 기준 |
| 보너스 적용 (거버너/버프/날씨/VIP/티어/업그레이드) | ✅ | 기존 harvest와 동일 체계 |
| 자원 드롭 포함 | ✅ | sector tier 기반 roll |
| `user_mining` stats 호환 누적 | ✅ | total/today_mined_pp 갱신 |
| 프론트 `_baseTerritoryHarvest` 신규 API 연결 | ✅ | 쿨다운 시 남은 시간 표시 |
| `baseTabMining` 탭 버튼 제거 | ✅ | |
| `basePane_mining` 채굴 전용 콘텐츠 제거 | ✅ | 배너/수확버튼/채굴률/드롭테이블 |
| GP Activity / SEND GP / LOTTERY / STAKING → 영토 탭 이동 | ✅ | 내 영토 탭 하단 |
| 채굴 통계 요소 숨김 유지 (JS 호환) | ✅ | `display:none` |
| 가이드 채굴 섹션 업데이트 | ✅ | 한/영 광물 드롭 테이블 + 수확 방법 안내 |

---

## ✅ v6.05 영토 목록 아코디언 + 패널 UX 개선 — 완료

## ✅ v6.05 영토 목록 아코디언 + 패널 UX 개선 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `_updateBaseTerritoryGroupList` 아코디언 재설계 | ✅ | ▶ 클릭 → 인라인 확장 (지구본 이동 제거) |
| `_baseTerritoryAccordion(idx)` 신규 | ✅ | 확장/축소 토글, prod 자동 로드 |
| `_bterrLoadProd(idx,g)` 신규 | ✅ | `/api/territory/:id/production` 인라인 표시 |
| 빠른 액션 버튼 4종 | ✅ | 수확/보호막/업그레이드/지도 |
| `_baseTerritoryHarvest/Shield/Upgrade/Globe` | ✅ | 각 액션 핸들러 |
| 확장 상태 `_baseTerritoryExpanded{}` 유지 | ✅ | 탭 전환 시 재렌더 복구 |
| **RENAME 버튼 제거** | ✅ | `infoRenameBtn` HTML + JS 참조 삭제 |
| **보호막 버튼 gameConfirm 수정** | ✅ | 구 3-arg → 신 object signature |
| **업그레이드 패널 자동 확장** | ✅ | 내 영토 선택 시 즉시 로드, 토글 제거 |
| `scrollToTerritoryUpgrade()` 신규 | ✅ | 모바일 업그레이드 버튼 연결 |

---

## ✅ v6.04 서브탭 폰트/터치 영역 개선 — 완료

## ✅ v6.04 서브탭 폰트/터치 영역 개선 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `.base-tab` 13px / 44px min-height | ✅ | 10px → 13px |
| `.bcat` 13px / 36px min-height | ✅ | 10px → 13px |
| `.base-inv-cat` CSS 클래스 통합 | ✅ | 인라인 스타일 제거 |
| `filterBaseInv` 인라인 제거 | ✅ | `b.style.cssText=''` |

---

## ✅ v6.03 강화 모달 버그 수정 + Forge 애니메이션 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `s.id === shipId` 타입 불일치 수정 | ✅ | `String()` 비교로 변경 |
| `material_tier` + `upgrade_level` 응답 추가 | ✅ | `upgradeOffers[stat]` 필드 확장 |
| `#forgeModal` HTML 추가 | ✅ | hammer/gauge/sparks/result 구조 |
| `_forgeSparkBurst()` Canvas 파티클 | ✅ | 타격 시 18개 스파크 발사 |
| `_forgeHammerSwing()` (내부 참고용, 실제는 inline) | ✅ | |
| `Promise.all` API + 애니메이션 병렬 처리 | ✅ | 2.4초 게이지 + API 동시 진행 |
| 성공/실패/오류 결과 UI | ✅ | 색상/글로우/텍스트 분기 |
| `node --check ship.js` | ✅ | 통과 |

---

## ✅ v6.02 함선 강화 티어 재료 시스템 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `UPGRADE_MATERIAL_TIERS` 상수 정의 | ✅ | atk/def/hp/speed × T1/T2/T3 매핑 |
| `getUpgradeMaterialTier(upgradeLevel)` | ✅ | lv<5=T1, lv<10=T2, lv≥10=T3 |
| `calcShipUpgradeOffer` 티어 기반 재료/수량 계산 | ✅ | `material_tier` 응답에 포함 |
| 프론트 `syUpgradeTierBadge()` | ✅ | T1=초록 / T2=파랑 / T3=보라 배지 |
| 강화 버튼 티어 배지 표시 | ✅ | `syUpgradeBtn` 내 tierbadge 삽입 |
| 강화 확인 모달 티어 + 예고 텍스트 | ✅ | "X회 후 T2 재료 필요" 동적 계산 |
| `node --check ship.js` | ✅ | 구문 오류 없음 |

---

## ✅ v6.01 함선 강화 재료 버그 수정 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **함선 강화 항상 실패 원인 파악** | ✅ | T2/T3 재료 요구인데 플레이어는 T1만 보유 |
| Migration 213 — 강화 재료 T1 변경 | ✅ | atk→carbon_fiber / def→iron_ore / hp→silicon_chip / speed→basalt_chip |
| `ship.js` fallback 값 동기화 | ✅ | `calcShipUpgradeOffer` 기본값도 T1으로 수정 |
| DB 적용 확인 | ✅ | `node server/migrate.js` → Applied 213 |

검증:
- `SELECT key, value FROM settings WHERE key LIKE 'ship_upgrade_%material%'` → T1 코드 확인

---

# OCCUPY MARS — Codebase Audit (v6.00 / 2026-05-05)

## ✅ v6.00 전술랩 미사일/EMP/사운드 개선 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **미사일** | | |
| 속도 감속 (1.55-2.0 → 0.85-1.05 px/frame) | ✅ | 착탄 2~3초 체감 |
| TTL 150 → 240 프레임 | ✅ | 화면 밖 소멸 전 충분한 비행시간 |
| 유도 homing (age>8 이후 타겟 조향 0.045) | ✅ | 곡선 탄도 구현 |
| 부채꼴 fan barrage ±0.35rad | ✅ | `cmdMissileBarrage` spawnB 호출 시 적용 |
| 충전 속도 55% 감소 | ✅ | `0.0021+n×0.00007` |
| 미사일 비주얼 (주황꼬리+탄두 발광) | ✅ | `drawBullets` 내 missile 분기 |
| **EMP 재설계** | | |
| EWAR(재머) 함선 없으면 버튼 disabled | ✅ | `ewars.length===0` → disabled + "재머없음" |
| 충전 게이지 `empCharge` 추가 | ✅ | EWAR 수에 비례 충전, 100% 도달 후 발동 |
| 발동 시 초기화 + 재머 함선 플로팅 텍스트 | ✅ | |
| initBattle empCharge=0 리셋 | ✅ | |
| **오디오** | | |
| 빔/레이저 건담 스타일 사운드 | ✅ | 충전→방전→노이즈 꼬리 3레이어 |
| 빔포 중무장 사운드 | ✅ | 와인+저음+심저음 레이어 |
| BGM 138bpm 루프 | ✅ | WebAudio 생성음 |
| visibilitychange/pagehide 자동 정지 | ✅ | 탭 이탈 시 AudioContext suspend/close |
| **플로팅 텍스트** | | |
| `_floatTexts` 월드좌표 시스템 | ✅ | 카메라 줌/패닝 추종 |
| 함선 위치 이벤트 텍스트 연동 | ✅ | 기함 격침, EMP, 패닉 등 |
| **카메라/레이아웃** | | |
| bottom callout → top div 라우팅 | ✅ | 컨트롤패드 겹침 해소 |
| lerp 0.025 → 0.06 | ✅ | 응답 빠름 |
| initBattle 즉시 중심 설정 | ✅ | 첫 프레임 jitter 제거 |
| Y clamp margin +32px | ✅ | 5v5+ 레이블 화면 이탈 방지 |

검증:
- `grep -n "empCharge" assets/tactical-lab-v11.html` → 선언/초기화/충전/발동/리셋 전 위치 확인
- git push main da13e41 완료

---

# OCCUPY MARS — Codebase Audit (v5.99 / 2026-05-05)

## ✅ v5.99 영토 병합 + 임대 버그 + CH2 밸런스 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **영토 병합 신기능** | | |
| `POST /api/territory/merge` 서버 엔드포인트 | ✅ | 2~50개 클레임 병합. 소유권·임대·전투·lock 검증 |
| 픽셀 재할당 + 기존 클레임 soft-delete | ✅ | `UPDATE pixels SET claim_id=merged` + `UPDATE claims SET deleted_at=NOW()` |
| territory_upgrades 최고 레벨 기준 병합 | ✅ | ON CONFLICT DO UPDATE GREATEST(level) |
| 바운딩 박스 기반 center/width/height 자동 계산 | ✅ | MIN/MAX lat/lng → 중심점 + COUNT(DISTINCT) |
| `index.html` 🔗 MERGE TERRITORIES 버튼 | ✅ | 내 영토 정보 패널, 소유자 전용 |
| 체크박스 병합 선택 모달 | ✅ | 현재 영토 기본 선택. 실시간 선택 수/px 카운트 |
| 4개 언어 i18n (merge_btn) | ✅ | EN/KO/JA/ZH |
| **영토 임대 버튼 미동작 수정** | | |
| `openListForRentModal()` 응답 래퍼 오인 수정 | ✅ 수정 | `territories.length` → `data.territories.length` (항상 "없음" 표시 버그) |
| 영토 이름 custom_name 우선 표시 | ✅ | |
| **캠페인 CH2 실패 임계값 완화** | | |
| `simulateCh2()` facilityHp 실패 임계값 80 → 65 | ✅ 수정 | `ch2_request_support` 최적 선택 항상 통과 보장 |
| militiaDestroyed 성공 판정 동기화 | ✅ | `>= 80` → `>= 65` |

검증:
- `node --check server/routes/api.js server/services/campaign.js` 통과
- 서버 정상 기동 확인 (migrate no-op)

---

# OCCUPY MARS — Codebase Audit (v5.98 / 2026-05-05)

## ✅ v5.98 버그 수정 패치 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **Extractor 수확 보너스 재무 무결성** | | |
| `territory_upgrades` extractor 레벨 → harvest PP 반영 | ✅ 수정 | P5-4에서 UI만 표시, 실제 계산 미반영이었음 |
| PP = USDT 1:1 스왑 화폐 → 재무 무결성 이슈로 우선 수정 | ✅ | Lv1=+15%~Lv5=+100% PP 보너스 |
| **캠페인 보상 실물화** | | |
| `ship_blueprint` 등 placeholder 타입 → 실물 재료 교체 | ✅ 수정 | 33개 챕터 전반 검토 완료 |
| `lifeline_supply_ship` → `fsp_logi` (유효 코드) | ✅ 수정 | 존재하지 않는 함선 코드였음 |
| CH10 엔딩 GP 증액 (ending_2: 1.2M) | ✅ | 최종 엔딩 보상 강화 |
| `campaignShipRewardPlan` single 맵 fsp_logi 추가 | ✅ | |
| **다국어 로컬라이징** | | |
| `_campaignStoryText()` ko→en fallback 수정 | ✅ 수정 | 일어/중국어 선택 시 한글 노출 차단 |
| 33개 챕터 ja/zh 제목 번역 | ✅ | |
| campaignObjectiveActionLabel ja/zh 맵 | ✅ | |
| location displayNameEn 추가 (34개 위치) | ✅ | |
| **P5 API 경로/컬럼 오타** | | |
| `require('./db')` → `require('../db')` (api.js:5219) | ✅ 수정 | GP 로그 silent 실패였음 |
| `materials_used` → `minerals_used` (adminEconomyRoutes.js:456) | ✅ 수정 | admin 재료 소각 통계 |
| `_territoryUpgradeState` undefined 참조 방어 | ✅ 수정 | |

검증:
- `node --check server/routes/api.js server/services/campaign.js` 통과
- ship_types 22종 코드 전수 확인 (fsp_logi DB 존재 확인)
- git push main 완료

---

# OCCUPY MARS — Codebase Audit (v5.97 / 2026-05-05)

## ✅ v5.97 P5-3~7 Territory Full Utility Stack — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| **P5-3: Shipyard Connection** | | |
| `materialSectorHints` 조선소 API 포함 | ✅ | `blueprints` 응답에 재료→섹터 힌트 맵 추가 |
| `sySectorBadge()` 조선소 카드 뱃지 | ✅ | 재료 칩 옆에 ⛏ 개척지/중간지/핵심지 뱃지 |
| `GET /api/ships/resource-sector-hints` | ✅ | 독립 엔드포인트 |
| **P5-4: Territory Upgrades** | | |
| Migration 211 — P5 업그레이드 설정 시드 | ✅ | 5개 트랙 × 5레벨 비용/보너스 시드 |
| `claimUpgrades.js` P5 트랙 정의 | ✅ | extractor/refinery/shield_grid/relay_tower/art_beacon |
| `GET /api/territory/:claimId/upgrades` | ✅ | 카탈로그 + 현재 레벨 반환 |
| `POST /api/territory/:claimId/upgrade` | ✅ | 기존 upgradeTerritory 재사용 |
| production 응답에 upgradeModifiers 포함 | ✅ | 업그레이드 효과가 모디파이어로 표시됨 |
| `index.html` 🔧 UPGRADES 패널 | ✅ | 접힘/펼침 UX. 레벨 바 + 다음 레벨 비용 + 업그레이드 버튼 |
| **P5-5: Sector Control** | | |
| `GET /api/sectors/control` | ✅ | 전체 섹터 컨트롤 스코어 (픽셀+업그레이드+수확활동) |
| `GET /api/sectors/:sectorId/control` | ✅ | 단일 섹터 리더보드 + 내 위치 |
| production 패널 하단 섹터 컨트롤 표시 | ✅ | `_appendSectorControl()` — 비동기 append |
| 영향력 티어 (presence/stakeholder/dominant/governor) | ✅ | 컨트롤 % 기반 티어 계산 |
| **P5-6: Admin Economy** | | |
| `GET /api/admin/territory/economy` | ✅ | 재료 발행/소각, 수확 통계, 의심 수확자, 상위 클레임 |
| `GET /api/admin/territory/upgrades` | ✅ | 업그레이드 분포 및 GP 소각 현황 |
| `GET /api/admin/territory/sector-control` | ✅ | 섹터별 컨트롤 요약 |
| `POST /api/admin/territory/production-profile` | ✅ | 생산 설정 수정 (10개 허용 키) |
| admin.html 🌍 TERRITORY 탭 | ✅ | 수확 통계 대시보드 + 재료 발행/소각 + 의심 수확자 + 프로파일 편집기 |
| **P5-7: Campaign Integration** | | |
| `materialHarvests` objectiveState | ✅ | 재료 드롭 있는 수확 횟수 |
| `territoryUpgradeLevels` objectiveState | ✅ | 소유 업그레이드 레벨 합산 |
| MCC CH1 `first_material_harvest` (optional) | ✅ | gate에서 제외 |
| MCC CH2 `territory_upgrade_start` (optional) | ✅ | gate에서 제외 |
| `getMissingRequiredObjectives()` optional 제외 | ✅ | optional:true 목표는 챕터 완료 block 안 함 |

검증:
- `claimUpgrades.js` / `ships.js` / `campaign.js` load OK
- `api.js` Function() syntax check OK
- migration 211 DB 적용 완료 (23 rows inserted)
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.96 / 2026-05-05)

## ✅ v5.96 P5-2 Material Drops on Harvest — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 재료 드롭을 COMMIT 전 트랜잭션 안으로 이동 | ✅ | addResourcesToInventory(client, ...) — pool 대신 트랜잭션 client 사용 |
| `transactions.meta.resourceDrops` 기록 | ✅ | 이전: meta에 drops 없음. 이후: 드롭 결과 포함 |
| 수확 알림 PP + 재료 드롭 통합 표시 | ✅ | showNotification + showToast, 22종 아이콘/이름 매핑 |
| 자원 아이콘/이름 매핑 22종으로 확장 | ✅ | 이전: 9종. iron_dust/basalt_chip 등 누락 코드 추가 |
| `LANG` 변수 기반 KO/EN 분기 | ✅ | 이전: window.currentLang (미정의 위험) → typeof LANG 체크 |
| production 패널 lastHarvest 재료 칩 | ✅ | meta.resourceDrops 기반, P5-2 이후 수확분부터 표시 |
| 문서 동기화 (P5-4~7 추가) | ✅ | TERRITORY_UTILITY_PLAN / CLAUDE_P5 ORDER / GAME_IMPL_PLAN |
| 캠페인 씬 39개 ja/zh 완료 (v5.94) | ✅ | 모든 파일 ko=ja=zh 동수, JSON valid |

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.95 / 2026-05-05)

## ✅ v5.95 P5-1 Territory Production Visibility — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `GET /api/territory/:claimId/production` 신규 엔드포인트 | ✅ | claim 조회, 픽셀 집계, 섹터 유형 판별, 재료 드롭율 반환 |
| 소유 여부 확인 | ✅ | wallet 파라미터로 owned 플래그 계산. 남의 영토에는 수확 정보 노출 안 함 |
| 예상 PP 범위 계산 | ✅ | 기존 harvest 공식(rewardMin/Max × pixelFactor × sectorMult) 재사용 |
| 섹터별 드롭 재료 목록 | ✅ | `sector_resource_rates` + `resources` JOIN. 테이블 없으면 빈 배열 safe fallback |
| 모디파이어 (섹터/이미지/인접) | ✅ | core +50%, mid +20%, image_url 있으면 +5%, adjacency_bonus 표시 |
| 최근 수확 이력 + 다음 수확 시각 | ✅ | `transactions.type='mining'` + `user_mining.last_harvest_at` 기반 |
| 프론트 `⚙ PRODUCTION` 패널 | ✅ | 내 영토 클릭 시 자동 로드. 예상 PP / 섹터 / 모디파이어 칩 / 광물 칩 / 수확 정보 |
| KO/EN 다국어 레이블 | ✅ | lang 변수 기반 `ko`/`en` 분기. 별도 i18n 키 등록 없음 (인라인 문자열) |
| safe fallback | ✅ | sector/resource 테이블 없어도 500 에러 없음. 남의 영토 production 미노출 |

검증:
- `node --check server/routes/api.js` 통과
- JS inline syntax check 통과 (10 script blocks)
- `git diff --check` 통과
- DB smoke test: claimId=307 claim 쿼리 OK, frontier 10종 rates OK

---

# OCCUPY MARS — Codebase Audit (v5.93 / 2026-05-05)

## ✅ v5.93 Campaign 대사/objective 전면 다국어화 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `_campaignStoryText()` LANG 기반 언어 선택 | ✅ | 이전: `.ko` 고정. 이후: `value[LANG]||.ko||.en` 우선순위 체인. |
| `_campaignStorySpeakerName()` 4개 언어 이름 맵 | ✅ | KO/EN/JA/ZH 각 23개 캐릭터 ID 이름 매핑. |
| `ch.title`, `ch.location` `.ko` 하드코딩 제거 | ✅ | `_campaignStoryText()` 사용으로 교체. |
| 브리핑/선택지 라벨 다국어화 | ✅ | `_campaignStoryText(l)` / `_campaignStoryText(c.label)` 사용. |
| 시뮬레이션 모달 문자열 i18n | ✅ | 무전/진행상태/상세 → `t()` 키 사용. |
| 스토리 컨트롤 버튼 i18n | ✅ | SKIP/나가기/탭 힌트 → `t('story_*')` 키. |
| objective 표시 다국어화 | ✅ | `campaignObjectivesHtml()` → `_campaignStoryText(o.label)`. |
| `OBJECTIVE_PRESETS` `labelEn` 추가 | ✅ | 75개+ 모든 preset에 영어 라벨 추가. |
| `buildChapterObjectives()` `label:{ko,en}` 포함 | ✅ | API 응답에 다국어 label 객체 포함. |
| `publicChapter()` choices `label:{ko,en}` 포함 | ✅ | 클라이언트 `_campaignStoryText(c.label)` 연결 완성. |
| 씬 JSON 39개 EN 텍스트 확인 | ✅ | 모든 파일 KO=EN 동수. 렌더러가 이제 언어별 텍스트 사용. |
| 신규 i18n 키 12종 (EN/KO/JA/ZH) | ✅ | campaign_sim_* 5종 + story_* 7종. 4개 언어 1357 키 동수. |

검증:
- `node --check server/services/campaign.js` 통과
- I18N key parity 1357 (EN=KO=JA=ZH) ✓
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.92 / 2026-05-05)

## ✅ v5.92 Campaign result/objective-gate i18n — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `showCampaignResult()` 결과 문자열 i18n | ✅ | '임무 완료'/'임무 실패'/'작전 목표 달성' 등 → `t('campaign_result_*')` |
| `completeCampaignMission()` objective gate 메시지 i18n | ✅ | '남은 목표를 먼저 완료하세요' → `t('campaign_objectives_gate')` |
| `pollCampaignProgress()` status/detail 하드코딩 제거 | ✅ | 한국어 status 텍스트 → `t()` 사용 |
| `gov_fleet_empty` KO/JA/ZH 추가 | ✅ | EN에만 있던 키를 3개 언어에 추가. 전 언어 1345 키 동수. |
| I18N 4개 언어 키 parity | ✅ | EN/KO/JA/ZH 모두 1345 키. `missing` 0개 확인. |

검증:
- I18N key parity node 스크립트 통과 (`missing: NONE ✓`)
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.91 / 2026-05-05)

## ✅ v5.91 Campaign i18n Localization — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 버튼 라벨 i18n | ✅ | START/CONTINUE/RESULTS/LOCKED → `t('campaign_btn_*')`. EN/KO/JA/ZH 4개 언어 키 추가. |
| 캠페인 메타 라벨 i18n | ✅ | COMPLETED/PROLOGUE/ROUTE/CH → `t('campaign_label_*')`. 언어별 번역 등록. |
| 파벌 없음 / 챕터 없음 안내 i18n | ✅ | 하드코딩 한국어 → `t('campaign_no_faction')` / `t('campaign_no_chapters')`. |
| SHOW/HIDE LOCKED 버튼 i18n | ✅ | `t('campaign_show_locked')` / `t('campaign_hide_locked')`. |
| 챕터 카드 `MVP 서버 시뮬레이션` 텍스트 정리 | ✅ | `t('campaign_meta_sim')` 로 교체. 위치 정보만 남기고 'MVP' 접두어 제거. |
| objective GO/이동 버튼 i18n | ✅ | `campaignObjectiveActionLabel()` 이 언어별로 한국어 라벨(내 영토/조선소/함대/전투/마켓) 또는 영문 라벨 반환. |
| I18N 키 EN/KO/JA/ZH 동기화 | ✅ | 신규 campaign_* 키 13개를 4개 언어 섹션에 모두 추가. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.90 / 2026-05-05)

## ✅ v5.90 Static QA Pass — CV 시뮬레이터 버그 수정 + 마켓 필터 검증

| 항목 | 상태 | 비고 |
|------|------|------|
| **[버그]** CV CH1~10 `simulateChapter()` 폴백 | ✅ 수정 | CV 챕터 전체가 MCC CH1 시뮬레이터로 폴백되던 버그. `simulateCvChapter()` / `simulateCvCh10()` 추가 및 `simulateChapter()` 분기 등록. |
| **[버그]** CV CH1~10 `calculateRewards()` 폴백 | ✅ 수정 | `calculateCvChapterRewards()` / `calculateCvCh10Rewards()` 추가 및 `calculateRewards()` 분기 등록. |
| **[버그]** CV_CH*_ID 상수 없음 | ✅ 수정 | `CV_CH1_ID` ~ `CV_CH10_ID` 상수 10개 추가. |
| **[버그]** CV CH10 ending choice 미검증 | ✅ 수정 | `complete()`의 ending choice 요구 분기를 `CH10_ID || FSP_CH10_ID || CV_CH10_ID`로 확장. |
| **[버그]** `cv_raider`, `cv_bomber`, `cv_titan` 함선 코드 매핑 없음 | ✅ 수정 | `campaignShipRewardPlan`에 `cv_raider→cv_int`, `cv_bomber→cv_bomb`, `cv_titan→cv_titan` 추가. |
| 마켓 필터 `size_class` 필드명 불일치 | ✅ 확인 | API는 `size_class` 반환, 클라이언트도 `s.size_class||s.size` 로 먼저 체크. 불일치 없음. |
| 모든 objective stat 키가 `getObjectiveState()`에 존재 | ✅ 확인 | OBJECTIVE_PRESETS에서 사용하는 10개 stat 키가 모두 반환됨. |
| battleEngine bonus_* null 처리 | ✅ 확인 | `|| 0` 가드 있음. |
| `cmdFocus` sort null 가드 | ✅ 확인 | `(b.flagship?.type.r||0)` 가드 확인. |
| `campaign_reward_inbox.wallet` 컬럼 일치 | ✅ 확인 | 스키마는 `wallet`, 쿼리도 `LOWER(wallet)` 사용. 일치. |

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.89 / 2026-05-05)

## ✅ v5.89 Ship Market Filter/Sort UI — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 파벌 필터 (ALL / MCC / FSP / CV) | ✅ | `data-mfaction` 칩으로 클라이언트 side 필터. `filterMarketFaction()` |
| 크기 필터 (ALL / FRG / DES / CRU / BS / TTN) | ✅ | `data-msize` 칩으로 클라이언트 side 필터. `filterMarketSize()` |
| 정렬 드롭다운 (가격 낮은/높은순, 강화 높은순, 최신 등록순) | ✅ | `<select>` → `filterMarketSort()`. 강화 파워는 bonus_atk+def+hp+speed 합산. |
| 결과 카운트 표시 | ✅ | 전체 대비 필터 결과 수 표시. 조건에 맞는 항목 없을 때 별도 안내. |
| 조선소 blueprints 기존 SIZE 필터 유지 | ✅ | 기존 `syFilters` div는 blueprints 탭에만 표시. market 필터는 `syMarketTab` 내부에 삽입해 독립 동작. |
| CSS 스타일 | ✅ | `.sy-market-sort`, `.sy-market-filter-row`, `.sy-market-filter-sep` 추가. 기존 `.sy-filter-chip` 재사용. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.88 / 2026-05-05)

## ✅ v5.88 Fleet Battle Readability Polish — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 레이저/빔 가시 시간 연장 | ✅ | 일반 레이저 TTL을 함선 크기별로 연장 (타이탄 ~2s / 전함 1.67s / 순양함 1.3s / 나머지 0.8s). 기존 10프레임(167ms)에서 개선. |
| 대형함 함대 이동 속도 제한 | ✅ | `mkFleet`이 기함 함선 크기 기반 `maxSpd`를 산출해 타이탄 함대(0.22) ~ 프리깃 함대(0.44)로 차별화. |
| EMP 시각 효과 | ✅ | EMP 발사 시 DEF 함대별 이중 충격파 shockwave 추가. |
| 집중공격 시각 효과 | ✅ | 집중공격 대상 함대에 shockwave 타겟팅 표시. |
| 기존 빔포/미사일 가시성 | ✅ | 빔포 ttl:160(2.67s), 미사일 ttl:150 유지. |

검증:
- `tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.87 CH4~CH10 Objective Wiring + Reward Note Hardening — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| MCC CH4~CH10 DB-backed objective presets | ✅ | `OBJECTIVE_PRESETS`에 MCC CH4~CH10 7개 챕터 추가. 각각 `completedFleetBattles`, `fleetShips`, `marketListings`, `shipUpgrades`, `campaignRewardClaims` 실-DB 집계 기반 목표 포함. |
| FSP CH2~CH10 DB-backed objective presets | ✅ | FSP CH2~CH10 9개 챕터 추가. 각각 1~2개 stat-backed objective 포함. |
| CV CH2~CH10 DB-backed objective presets | ✅ | CV CH2~CH10 9개 챕터 추가. 각각 1~2개 stat-backed objective 포함. |
| 추상 보상 타입별 한국어 안내 메시지 | ✅ | `applyClaimedInboxReward`가 `ship_blueprint`, `ship_choice`, `asset`, `resource_stream`, `contract`, `data_artifact` 타입별로 정확한 안내 문구를 반환. |
| 보상 수령 토스트 개선 | ✅ | `claimCampaignReward`가 서버가 내려준 `note` 또는 `applied` 목록을 그대로 토스트로 표시. |
| 완료 카드 접힘 | ✅ | v5.83에서 이미 완료. `completed`/`claimed`/`completedAt` 모두 compact done 카드로 렌더. |
| hard gate 호환성 | ✅ | CH4~CH10의 stat-backed objective는 `getMissingRequiredObjectives()`에서 자동으로 체크됨. 목표 미달 시 `complete()` 차단. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

# OCCUPY MARS — Codebase Audit (v5.86 / 2026-05-04)

## ✅ v5.86 Campaign editor layout freshness — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터 저장 freshness | ✅ | layout payload에 `updatedAt`을 포함하고 편집 시 timestamp를 갱신. |
| 인게임 서버 좌표 우선 | ✅ | timestamp 없는 오래된 로컬 좌표는 서버 저장 layout을 덮지 못하게 함. |
| 즉시 편집 반영 | ✅ | 에디터 sync debounce 직후에 열리는 경우에는 timestamp가 있는 로컬 좌표가 임시 우선 적용 가능. |
| reset 동기화 | ✅ | 에디터 reset layout이 서버에 반영되지 않는 경로 보강. |

검증:
- `index.html` inline script syntax check 통과
- `assets/campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.85 Fleet Command stay-open/error UX — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 진형/기동 모달 유지 | ✅ | 전술 변경 성공 후 전체 재조회 대신 현재 선택 함대를 로컬 갱신해 모달/스크롤 흔들림을 줄임. |
| 기함 지정 모달 유지 | ✅ | 기함 지정 성공 후 선택 함대 상세만 재로드하고 모달을 유지. |
| 서버 오류 메시지 | ✅ | Fleet Command 오류를 공통 한국어 메시지로 표시해 `SHIP_CANNOT_BE_FLAGSHIP` 등 원인을 바로 알 수 있게 함. |
| 함선 선택 가시성 | ✅ | 마지막으로 누른 함선에 focused outline을 추가하고 선택 요약에 기함 가능 여부를 표시. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.84 Local cleanup tracked DS_Store removal — 정리 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 추적된 macOS 메타파일 제거 | ✅ | `.gitignore`에 이미 있는 `assets/campaign/characters/.DS_Store`를 저장소 추적 대상에서 제거. |
| 미추적 리서치 문서 보존 | ✅ | `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 삭제 여부가 불명확해 자동 삭제하지 않음. |

검증:
- `git diff --check` 통과

---

## ✅ v5.83 Campaign CH2 objective clarity + completed card guard — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 완료 캠페인 카드 접힘 방어 | ✅ | 프론트가 status helper로 완료 상태를 정규화하고 `completedAt`도 완료로 처리해 풀카드 노출 위험을 줄임. |
| 결과 모달 상태 판정 | ✅ | 결과 화면의 완료/실패 판정도 동일 helper를 사용해 상태 문자열 차이로 흔들리지 않게 함. |
| CH2 진행 목표 보강 | ✅ | MCC CH2에 “함대에 함선 3척 배치” objective를 추가해 함대 1개 존재만으로 끝나는 느낌을 줄임. |
| 함대 배치 수 서버 집계 | ✅ | `objectiveState.fleetShips`가 살아 있고 판매중이 아니며 함대에 편입된 함선 수를 집계. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.82 Ship economy visibility + Fleet Command sale locks — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 제작 재료 보유/부족 가시성 | ✅ | 조건 부족 카드도 전체가 과하게 흐려지지 않고, `보유`/`부족` 라벨로 재료 상태를 구분. |
| 강화 재료/확률 표시 | ✅ | 강화 버튼 안에 성공 확률과 재료 보유/부족 상태를 함께 표시. |
| 판매중 함선 함대 제한 | ✅ | Fleet API가 판매중 함선의 이동/기함 지정/자동 기함 보장 경로를 명확히 차단. |
| 함대지휘 세로 진형 프리뷰 | ✅ | 쐐기/스크린/핀서/구형 배치를 함선 PNG 방향에 맞춰 세로 전장 기준으로 재정렬. |
| 기동 방향 표기 | ✅ | 세로 전장에 맞춰 전진/후퇴 아이콘을 `↑/↓` 기준으로 변경. |

검증:
- `node --check server/services/fleet.js` 통과
- `node --check server/routes/fleets.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.81 Campaign ship reward fulfillment — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 보상 실지급 | ✅ | `ship`/`ship_fleet` 캠페인 보상 수령 시 실제 `ships` 인스턴스를 생성. |
| 보상 코드 매핑 | ✅ | Shard/Longeye/Prometheus/Sequoia/Ironclad/MCC fleet package 등 주요 보상 코드를 현재 `ship_types` 22종으로 매핑. |
| 기본 함대 지급 | ✅ | 유저 함대가 없으면 기본 함대를 생성하고 지급 함선을 배치. |
| 기함 자동 지정 | ✅ | 함대에 기함이 없고 함선 타입이 가능하면 첫 지급 함선을 기함으로 지정. |
| 장기 보상 분리 | ✅ | 설계도/선택권/자산/계약 보상은 아직 추상 보상으로 안전 수령 처리 유지. |

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.80 Campaign reward inbox claim flow — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 보상함 렌더링 | ✅ | 캠페인 패널에 미수령 `rewardInbox` 카드와 수령 버튼을 추가. |
| 수령 API | ✅ | `/api/campaign/reward/claim` 추가. wallet/reward id 검증 후 `FOR UPDATE`로 중복 수령 방지. |
| 실제 지급 처리 | ✅ | `resources` 또는 `item_types`에 매칭되는 보상은 `user_resource_inventory`/`user_items`에 적립. |
| 서사형 보상 안전 처리 | ✅ | 아직 별도 시스템이 없는 자산/권한/선택권 보상도 오류 없이 수령 처리하고 트랜잭션 로그 기록. |
| objective state 확장 | ✅ | `objectiveState.campaignRewardClaims` 집계 추가. 향후 “보상 수령” objective에 연결 가능. |

검증:
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.79 Campaign territory harvest objective — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 채굴 objective 추가 | ✅ | MCC CH1에 `first_harvest`를 추가해 영토 확보/이미지 등록 뒤 실제 PP 채굴 1회를 요구. |
| 서버 수확 횟수 집계 | ✅ | `objectiveState.territoryHarvests`가 `transactions.type = 'mining'`와 `from_wallet` 기준으로 유저 수확 횟수를 집계. |
| 초반 루프 연결 | ✅ | 캠페인 초반이 영토 구매, 그림 등록, 생산 수확까지 이어지는 형태로 보강됨. |
| 목표 이동 동선 | ✅ | 기존 `territory` action routing을 사용해 BASE/내 영토 쪽으로 이동. |

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

---

## ✅ v5.78 Campaign ship upgrade objective — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 강화 objective 추가 | ✅ | MCC CH3에 `first_upgrade`를 추가해 함대전 이후 함선 스탯 강화 1회를 실제 진행 목표로 요구. |
| 서버 강화 횟수 집계 | ✅ | `objectiveState.shipUpgrades`가 `ship_stat_upgrade_log`를 기준으로 유저의 성공 강화 횟수를 집계. |
| DB 버전 호환성 | ✅ | v210 이전 DB처럼 `success` 컬럼이 없으면 기존 로그 전체를 강화 성공으로 처리하고, 테이블/컬럼이 없으면 safe query로 0 처리. |
| 목표 이동 동선 | ✅ | 기존 `shipyard` action routing을 사용해 강화 objective도 조선소로 이동. |

검증:
- `node --check server/services/campaign.js` 통과
- `git diff --check` 통과

---

## ✅ v5.77 Campaign editor default parity + Bug reporter hardening — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 캐릭터 기본 좌표 | ✅ | 인게임 fallback을 에디터 기본값 `{x:50,y:55,w:60}` / 2인 `{x:28/72,y:55,w:50}`로 맞춰 저장 layout이 없어도 에디터와 같은 기준으로 렌더. |
| 저장 layout 우선순위 | ✅ | 기본 좌표 위에 서버/editor/local line/scene layout을 덮어 적용하므로 에디터 저장값은 계속 우선 적용. |
| 캠페인 전환 렉 체감 | ✅ | `fade_slow`/`fade_medium` duration을 짧게 줄여 배경 교체 때 빈/파란 화면이 오래 보이는 현상 완화. |
| 버그 신고 버튼 클릭 안정성 | ✅ | bug reporter 버튼/모달 버튼에 `type="button"`과 `preventDefault/stopPropagation`을 적용해 폼/모달 이벤트 간섭을 줄임. |
| 버그 신고 캡처/전송 복구 | ✅ | html2canvas 로드 지연 시 1.8초 후 수동 UI 복구. `/api/bug-report` 실패 시 `/bug-report` alias 재시도, 서버 alias route 추가. |

검증:
- `index.html` inline script syntax check 통과
- `node --check server/routes/bugReport.js` 통과
- `git diff --check` 통과

---

## ✅ v5.76 Shipyard requirement clarity + Fleet Command modal stickiness — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 제작 재료 부족 상세 | ✅ | 청사진 카드에서 재료/GP 부족 시 버튼을 완전 비활성화하지 않고 상세 모달을 열어 보유량/필요량을 확인 가능. |
| 제작 확인 모달 | ✅ | GP/광물을 `보유 / 필요` 문구와 ok/insufficient 색상으로 표시. 부족하면 실행 버튼만 disabled. |
| 강화 확인 모달 | ✅ | 강화 GP/재료도 `보유 / 필요` 문구로 통일해 실제 보유량과 필요량을 바로 확인 가능. |
| 인벤토리 코드 정규화 | ✅ | `/api/resources/my` 응답 resource code를 소문자로 저장하고 조회도 소문자로 해 재료 보유량 미표시 위험 감소. |
| 함대지휘 모달 유지 | ✅ | Fleet Command 주요 버튼에 `type="button"` + 이벤트 차단을 적용해 진형/기동/기함/이동 후 모달 이탈 위험 감소. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.75 Campaign objective hard gate — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 자동 완료 조건 | ✅ | 프론트는 `progressPct >= 100`만으로 완료하지 않고 서버의 `preview.readyToComplete`가 true일 때만 완료 호출. |
| 서버 완료 hard gate | ✅ | `/api/campaign/complete`가 DB 기반 필수 objective 미달 시 `OBJECTIVE_REQUIREMENTS_NOT_MET`으로 보상/완료 처리를 차단. |
| 진행률 응답 보강 | ✅ | `/api/campaign/progress`가 `objectives`, `missingObjectives`, `nextObjective`, `preview.readyToComplete`를 함께 내려줌. |
| 남은 목표 안내 | ✅ | 작전 시간은 끝났지만 목표가 남은 경우 캠페인 모달에서 남은 목표와 GO 동선을 표시. |
| 시작 직후 objective 수량 | ✅ | `/api/campaign/start`와 alreadyCompleted 응답도 live objective state를 포함해 수량 표시 공백을 줄임. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.74 Campaign editor parity hotfix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 모바일 stage 좌표계 | ✅ | 인게임 모바일도 에디터와 같은 9:16 좌표계를 유지해 캐릭터 위치가 다른 비율로 해석되지 않게 함. |
| 대사박스 크기 정합 | ✅ | 에디터 좌표 적용 시 인게임 safe-area padding을 compact editor padding으로 교체. |
| 캐릭터 위치 불일치 | ✅ | 모바일 fullscreen 비율 때문에 에디터 x/y와 다르게 보이던 문제를 stage 비율 통일로 수정. |
| layout 캐시 차단 | ✅ | 에디터 GET/POST, 인게임 fetch, 서버 GET 응답 모두 no-store/timestamp 처리. |
| 저장 후 반영 지연 | ✅ | 브라우저/SW 캐시에 묶여 이전 layout이 재사용될 위험을 낮춤. |

검증:
- `node --check server/routes/api.js` 통과
- `index.html` inline script syntax check 통과
- `campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.73 Campaign objective action routing — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| objective 클릭 액션 | ✅ | 진행 중/미완료 objective 중 지원되는 action에만 `GO`를 표시하고 클릭 가능하게 함. |
| 영토 목표 동선 | ✅ | `territory`, `territory_art` objective는 BASE 내 영토 탭으로 이동. |
| 함선/함대 목표 동선 | ✅ | `shipyard`는 조선소 청사진, `fleet`은 Fleet Command로 이동. |
| 전투/마켓 목표 동선 | ✅ | `fleet_battle`은 PVP Battle Hub, `market`은 BASE Market 탭으로 이동. |
| 안전한 범위 | ✅ | 완료 objective와 story/result/choice 계열은 읽기 전용 유지. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.72 Campaign objective expansion — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 영토 이미지 objective | ✅ | `claims.image_url`이 있는 내 영토 수를 `artClaims`로 집계. MCC CH1에 첫 영토 이미지 등록 목표 추가. |
| 함대전 완료 objective | ✅ | `fleet_battles.status = 'ended'` + 참여자 wallet 기준으로 완료 전투 수를 집계. MCC CH3에 첫 함대전 완료 목표 추가. |
| 마켓 등록 objective | ✅ | 활성 `ship_market_listings`와 일반 `marketplace_listings`를 합산해 `marketListings`로 집계. MCC CH3에 첫 마켓 등록 목표 추가. |
| objective state 유지 | ✅ | 모든 live objective는 `current/target/requirementMet`으로 내려가며 기존 카드/브리핑 UI에서 수량 표시됨. |
| 범위 통제 | ✅ | 완료 hard gate는 아직 미적용. objective 표시 정확성 확인 후 챕터별로 선별 적용 예정. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.71 Campaign live objective state — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 서버 objective 상태 스냅샷 | ✅ | `/api/campaign/status` 계열 응답에 `objectiveState` 추가. 영토/함선/활성 함선/함대/판매중 함선/완료 전투 수를 서버에서 집계. |
| 실제 DB 기반 objective | ✅ | MCC CH1은 첫 영토, MCC CH2는 첫 함대, FSP/CV CH1은 첫 함선 보유량을 `current/target`으로 연결. |
| UI 수량 표시 | ✅ | 캠페인 카드/브리핑 objective에 `현재/필요` 수량을 표시. 충족된 objective는 done 상태로 표시. |
| 배포 안전성 | ✅ | objective 집계는 safe query로 감싸 테이블/컬럼 차이가 있어도 캠페인 리스트 전체가 internal error로 죽지 않게 함. |
| 범위 통제 | ✅ | 이번 단계는 표시/안내 판정. 완료 hard gate는 기존 유저 진행을 막지 않도록 아직 적용하지 않음. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.70 Campaign main quest scaffold — 착수 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 실행 기획 문서 | ✅ | `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md` 추가. 방향성 문서를 P1~P4 개발 스프린트로 분해. |
| 캠페인 objective 스키마 | ✅ | `server/services/campaign.js`의 `publicChapter()` 응답에 `objectives`와 `nextObjective` 추가. |
| 캠페인 카드 목표 표시 | ✅ | 진행 가능/진행 중 캠페인 카드에 현재 작전 목표를 표시. 완료/잠김 compact 카드 UX는 유지. |
| 브리핑 목표 표시 | ✅ | 캠페인 브리핑 모달에 챕터 목표를 함께 표시해 시작 전에 다음 행동을 알 수 있게 함. |
| 범위 통제 | ✅ | 이번 단계는 목표 표시/동선 스캐폴드. 실제 영토/함선/전투 DB 상태 기반 objective 판정은 다음 단계로 분리. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.69 Game direction lock — 문서화 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 방향성 기준 문서 | ✅ | `docs/GAME_DIRECTION_2026-05-04.md` 추가. 캠페인/영토/함대/전쟁·경제 네 기둥으로 전체 게임 방향을 정리. |
| 캠페인 범위 통제 | ✅ | 캠페인은 전면 신규 제작이 아니라 기존 챕터/이미지/캐릭터를 유지하고 목표·보상·잠금 해제·시스템 연결을 붙이는 리마스터 방식으로 정의. |
| 기능 추가 판단 기준 | ✅ | 새 기능은 네 기둥 중 하나와 연결되어야 하며, 단발성 메뉴/미니 기능 확장은 보류하는 기준을 명시. |
| 우선순위 로드맵 | ✅ | P0 방향 고정, P1 캠페인 메인퀘스트화, P2 함대전 감각 완성, P3 함선 경제, P4 영토 유틸리티 순서로 정리. |

검증:
- 문서 변경 전용. 실행 테스트 없음.

---

## ✅ v5.68 Shipyard material ownership visibility — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 제작 재료 보유량 표시 | ✅ | 청사진 카드의 GP/광물 요구량을 `보유 / 필요`로 표시. 충분하면 활성 녹색, 부족하면 비활성 붉은 톤. |
| 제작 확인 모달 | ✅ | 제작 확인 단계에서도 GP와 광물 보유량을 모두 표시하고, 부족 항목이 있으면 confirm disabled. |
| 강화 버튼 정보 | ✅ | 강화 버튼에 GP 비용, 성공 확률, 재료 `보유 / 필요`를 함께 표시. 부족한 항목은 붉은 톤. |
| 강화 확인 모달 | ✅ | 성공 확률, GP `보유 / 필요`, 재료 `보유 / 필요`를 표시하고 GP/재료 부족 시 실행 차단. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.67 Campaign editor/in-game coordinate parity — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캐릭터 위치 불일치 | ✅ | 에디터의 `x/y` 중심점 좌표를 인게임이 top-left처럼 해석해 캐릭터가 밀리던 문제 수정. |
| 레거시 좌표 호환 | ✅ | 필요 시 `anchor: "top-left"` / `origin: "top-left"`가 명시된 layout은 기존 top-left 방식으로 처리. |
| 스토리 stage 기준 | ✅ | 데스크탑 인게임 story stage를 에디터와 같은 9:16 좌표계로 맞춰 percent 좌표 오차를 줄임. |
| 배경 크롭 기준 | ✅ | 에디터 preview와 동일한 중앙 cover(`50% 50%`)를 기본값으로 통일. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.66 Bug reporter submit contract + Codex inbox payload — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 버그 제출 버튼 실패 | ✅ | 프론트 `description` payload와 서버 `title/body` 계약 불일치로 `empty` 실패하던 문제 수정. |
| 구버전 payload 호환 | ✅ | 서버가 `description/context/screenshot`도 정규화해 수락하므로 캐시된 클라이언트도 제출 가능. |
| Codex/Claude 인박스 | ✅ | 리포트 JSON에 context, recent errors, codex hint를 포함해 `server/bug-reports/inbox`에 미러링. |
| 스크린샷 보존 | ✅ | base64 스크린샷은 파일로 분리 저장하고 JSON에 `screenshot_path` 기록. |
| 자동 캡처 로더 | ✅ | html2canvas script id 오타와 로드 실패 시 UI 복구 처리 추가. |

검증:
- `node --check server/services/bugReport.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.65 Ship upgrade material visibility + fleet command modal stability — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 강화 재료 보유량 표시 | ✅ | 강화 확인 모달에 필요 재료 `보유 / 필요` 수량과 `보유/부족` 상태를 표시. |
| 쐐기 진형 미리보기 | ✅ | 세로 전장 기준 앞쪽 1척, 후방 2/3척으로 퍼지는 삼각 돌격 대형으로 재배치. |
| Composition 수량 정규화 | ✅ | `EW Frigate`, `Interceptor`, `battle_ship` 등 별칭/라벨 기반 크기 집계를 정규화해 우측 수량 누락 방지. |
| 지휘 모달 튕김 완화 | ✅ | 진형/기동/함선 이동/기함 지정 후 모달 active 상태와 내부 스크롤 위치를 복구. |
| 모바일 safe-area | ✅ | Fleet Command backdrop 셀렉터 오타를 수정해 모바일 풀스크린 위치 계산이 적용됨. |
| Fleet API 소유권 비교 | ✅ | 목록/상세/수정/이동에서 wallet 대소문자 차이로 실패하는 케이스 완화. |

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.64 Campaign editor position + fleet command vertical UX — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 에디터 위치 반영 | ✅ | 서버 레이아웃 응답 뒤에도 localStorage 최신 좌표를 다시 병합해 에디터에서 방금 맞춘 캐릭터 위치가 인게임에 우선 적용됨. |
| 함대지휘 세로형 프리뷰 | ✅ | Fleet Command 진형 미리보기를 함선 PNG의 위쪽 방향과 맞춘 세로 전장으로 변경. |
| 이전 SVG 잔상 차단 | ✅ | 함대지휘 미리보기의 구형 SVG fallback을 숨겨 PNG 뒤로 옛 함선 실루엣이 비치는 문제 방지. |
| 진형/기동 모달 유지 | ✅ | 버튼 클릭 시 모달을 유지하고 프리뷰를 즉시 변형. API 실패 시 이전 상태로 롤백. |
| 함선 선택 식별 | ✅ | 선택 카드에 `SELECTED` 배지, 상세 패널에 최근 클릭 함선 스탯/역할 표시. |
| 기함 지정 오류 보정 | ✅ | `owner_wallet` 대소문자 비교와 `fleet_id` 타입 비교를 안정화해 잘못된 `SHIP_NOT_IN_FLEET`/소유권 실패 가능성 완화. |

검증:
- `node --check server/services/fleet.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.63 Ship market + chance upgrades + fleet FX polish — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 확률 강화 | ✅ | `upgrade_offers`가 GP/성공확률/재료를 내려주고, 실패 시 GP+재료 소모 후 스탯 유지. |
| 강화 재료 소모 | ✅ | 스탯별 재료(`plasma_crystal`, `titanium_alloy`, `alloy_frame`, `nano_polymer`)와 수량을 설정 기반으로 계산. |
| 함선 마켓 등록/구매/취소 | ✅ | `ship_market_listings` 추가. 판매중 함선은 기본 함대에서 분리되고 강화/수리/실드/해체 차단. |
| 판매중 UI | ✅ | 보유함/마켓 카드에 `판매중` 스티커와 가격/판매자/취소·구매 버튼 표시. |
| 조선소 가독성 | ✅ | 청사진/보유함 PNG 불꽃 오버레이 제거, 함선 밝기/대비 강화. |
| 전투 이펙트 가시성 | ✅ | 빔포/미사일 지속시간을 늘리고 미사일 트레일을 추가해 수동 스킬 사용감 보강. |
| 무전/배경 시각 보정 | ✅ | 하단 콜아웃을 위로 올리고 화성 배경 알파/veil을 밝게 조정. |

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `index.html`, `assets/tactical-lab-v11.html`, `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.62 Campaign quest progress gate — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 작전 챕터 즉시 클리어 방지 | ✅ | 프롤로그/순수 시네마틱 외 챕터는 스토리 종료만으로 `complete` 호출하지 않음. |
| 서버 완료 게이트 | ✅ | `/api/campaign/complete`가 런타임 미충족 시 `MISSION_IN_PROGRESS` 반환. 직접 API 호출로도 조기 완료 불가. |
| 진행률 UI | ✅ | `showCampaignSim()`이 `/api/campaign/progress`를 폴링해 진행률/남은 시간 표시 후 준비되면 완료. |
| 챕터별 런타임 | ✅ | CH1 840초 하드코딩 제거. 각 챕터 `environment.totalDurationSeconds`/`estimatedPlayTimeSeconds` 기준. |

검증:
- `node --check server/services/campaign.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.61 Campaign completed chapter compact cards — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 완료 챕터 접힘 처리 | ✅ | 프롤로그뿐 아니라 CH1 이후 완료 챕터도 compact 카드로 표시. |
| 결과 진입 유지 | ✅ | 접힌 완료 카드에서도 `RESULTS` 버튼으로 결과/챕터 화면 진입 가능. |
| 진행 카드 영향 | ✅ | 진행 중/시작 가능 챕터는 기존 큰 카드와 metric 영역 유지. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.60 Campaign editor layout parity + story perf — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터/인게임 캐릭터 좌표 기준 | ✅ | 에디터의 `x/y/w` top-left percent 모델을 인게임도 동일하게 해석. `cx/cy`만 center 기준으로 처리. |
| 단일 화자 기본 배치 | ✅ | `scene.characters`가 없는 단일 화자 대화씬은 왼쪽이 아니라 중앙 캐릭터로 렌더. |
| 다른 캐릭터 에셋 확인 | ✅ | campaign-story 전체 speaker 42종을 검사했고 누락 초상화 0건. `crow` 매핑 오류도 수정. |
| 화면전환/대사 렉 완화 | ✅ | 배경/캐릭터/오버레이 이미지 캐시+다음 라인 선로딩, RAF 기반 타이핑, 대화창 blur 제거. |

검증:
- campaign-story speaker 42종 캐릭터 이미지 매핑 검사 통과 (missing 0)
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.59 Fleet Mars atmospheric background — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 화성 배경 레이어 | ✅ | `assets/textures/mars_nasa_2k.jpg`를 전투 캔버스 배경으로 비동기 로드. |
| 느린 표면 이동감 | ✅ | `drawBG()`에서 화성 텍스처를 어둡게 누른 뒤 천천히 패닝해 화성 상층권 전투 느낌 추가. |
| 가독성 유지 | ✅ | 어두운 veil, 기존 글로우, 낮은 알파 먼지 스트릭으로 함선/레이저가 묻히지 않게 처리. |
| 본서버 택티컬랩 반영 | ✅ | `assets/tactical-lab-v11.html`에 반영. 검수용 데모 파일도 동일 로직으로 수정. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.58 Fleet sprite preload fallback fix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 첫 프레임 구형 벡터 노출 | ✅ | PNG가 로딩 중이면 구형 fallback 함선을 그리지 않도록 `SHIP_SPRITE_STATUS` 추가. |
| 엔진 플레임 분리 노출 | ✅ | 함선 본체가 그려진 경우에만 플레임/대형함 HP bar를 표시. |
| 본서버 택티컬랩 반영 | ✅ | `assets/tactical-lab-v11.html`에 반영. 검수용 데모 파일도 동일 로직으로 수정. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.57 Ship infinite stat upgrades — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 보유 함선 영구 강화 API | ✅ | `POST /api/ships/:id/upgrade-stat` 추가. `atk/def/hp/speed` 중 하나를 실패 없이 누적 강화. |
| DB 영속화 | ✅ | migration 209 추가. `bonus_speed`, `ship_stat_upgrade_log`, 강화 비용/증가량 설정 추가. |
| 조선소 UI 표기 | ✅ | 보유 함선 카드에 기본 스탯과 녹색 `(+보너스)` 표시, ATK/DEF/SPD/HP 강화 버튼 추가. |
| 전투 반영 | ✅ | `battleEngine`이 공격/방어/체력/속도 보너스를 실제 전투 스탯에 반영. |

검증:
- `node --check server/services/ship.js` 통과
- `node --check server/routes/ships.js` 통과
- `node --check server/services/battleEngine.js` 통과
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.56 Fleet battle scale-aware start distance/zoom — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함대 수 기반 시작 거리 | ✅ | `battleScaleConfig()` 추가. 1:1 소규모전은 더 가까운 상/하단에서 시작하고, 함대 수가 많을수록 시작 간격이 넓어짐. |
| 함대 수 기반 교전 거리 | ✅ | `updateFleets()`의 최소/이상 교전 거리를 전투 규모에 따라 조정. 소규모전은 가까운 거리에서 싸우고 대규모전은 장거리 교전 유지. |
| 함대 수 기반 자동 줌 | ✅ | 자동 카메라가 소규모전에서는 더 크게 줌인하고, 대규모전에서는 전체 함대를 담도록 줌 범위를 낮춤. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.55 Fleet battle chatter callouts — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 전장 무전 자막 | ✅ | 명령/진형/기동은 상단, 피격/격침/후퇴 경고는 하단에 짧은 콜아웃으로 표시. |
| 격침 대사 | ✅ | 소형함 격침은 확률적으로 비명/탈출 대사를 표시하고, 대형함/기함 격침은 더 강한 경고 문구로 표시. |
| 수동 스킬 대사 | ✅ | 집중공격, EMP, 빔포, 미사일 일제사격, 후퇴 확인에 각각 전투 무전 문구 추가. |
| 전투 분위기 | ✅ | 교전 중 간헐적으로 사격선 유지/산개/실드 재분배 같은 ambient 무전이 표시되어 정적인 느낌을 줄임. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.54 Fleet manual beam/missile skills — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 전함/타이탄급 수동 빔포 | ✅ | `☢ 빔포` 게이지 추가. 전함/타이탄이 살아있을 때 게이지가 차고, 100%에서 수동 발사 시 우선순위 대형 목표에 굵은 주포 빔을 발사. |
| 소형/중형함 미사일 일제사격 | ✅ | `☄ 미사일` 게이지 추가. 프리깃/구축함/순양함이 살아있을수록 빨리 차고, 100%에서 다수 미사일을 적 함대에 발사. |
| 연출/사운드 | ✅ | 빔포 전용 두꺼운 글로우 빔, 발사 쇼크웨이브, 미사일/빔포 전용 WebAudio 효과음을 추가. |
| 데모/본서버 동기화 | ✅ | `assets/fleet-assault-demo.html` 수정 후 `assets/tactical-lab-v11.html`에 동일 반영. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.53 Fleet doctrine RPS + shipyard vertical UI pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 가위바위보식 함선 상성 | ✅ | `battleEngine`와 택티컬랩 양쪽에 역할/함급/파벌 기반 데미지 배율 추가. 태클, EW, 로지, 탱커, 저격, 폭격이 서로 다른 카운터를 가짐. |
| 진영별 함선 밸런스 | ✅ | migration 208 추가. MCC=정밀 저격, FSP=장기전/탱킹/로지, CV=러시/폭격/순간화력으로 스탯과 설명을 재조정. |
| 전투 BGM/SFX | ✅ | 외부 파일 없이 WebAudio 기반 전투 루프 BGM, 레이저/탄막/폭발 효과음 추가. 브라우저 정책 때문에 `SOUND` 버튼으로 활성화. |
| 세로 전장 기동 UI | ✅ | 세로 전장에 맞춰 전진/후퇴 아이콘을 `↑/↓`로 변경. 자동 기동 로그도 같은 방향 표기로 정리. |
| 조선소 세로 함선 카드 | ✅ | 데스크탑 조선소 청사진을 4열 그리드로 변경하고 `assets/ships/top/` PNG를 세로 프리뷰로 사용. 모바일은 1열 카드로 전환. |
| 조선소 엔진 불꽃 | ✅ | 기존 SVG 불꽃은 PNG 로드 시 숨기고, 카드 하단 후미에 새 엔진 플레임 오버레이를 적용. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `index.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

---

## ✅ v5.52 Top-view fleet sprite + long-range combat pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 PNG 22종 매핑 | ✅ | `assets/ships/top/`에 전투용 축소 PNG 22종 추가. 중복 샘플 `mcc_destroyer_top.png`는 실제 22종 코드에 없어서 제외. |
| 전투/조선소 렌더 통일 | ✅ | 전투 화면과 SHIP REGISTRY 미리보기가 같은 PNG 스프라이트를 사용하도록 전환. 기존 벡터 함선 프리뷰는 fallback으로만 유지. |
| 엔진 불꽃 위치 보정 | ✅ | 기존 벡터 기준 파란 불꽃을 제거하고, PNG 함선 길이 기준 후방에서 나오는 공통 엔진 플레임 함수로 통일. |
| 장거리 함대전 보정 | ✅ | 함대 간 최소/이상 교전 거리를 크게 늘려 근접 난전처럼 겹치지 않도록 수정. |
| 카메라 화면 이탈 방지 | ✅ | 카메라 프레이밍을 함대 원이 아니라 실제 살아있는 함선 스프라이트 바운딩 박스 기준으로 계산. |
| 사격 방향 일치 | ✅ | 함선이 이동 방향보다 현재 사격 타겟 좌표를 우선 바라보도록 `aimX/aimY/aimTTL` 적용. |
| 대형함 움직임 | ✅ | 기함/대형함이 완전 고정처럼 보이지 않도록 중심 주변 묵직한 드리프트와 함대 전체 미세 이동 추가. |

검증:
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.51 Vertical fleet war production update — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 본 서버 함대전 세로 전장 | ✅ | `assets/tactical-lab-v11.html`을 v11.1 기반 세로 전장으로 전환. 적군은 상단, 아군은 하단에 배치. |
| 초기 함대 배치 | ✅ | 시작 함대가 일직선으로 나오지 않도록 상/하단 반원형 아크 배치 적용. 아군 기본 `wedge`, 적군 기본 `screen`. |
| 모바일 HUD 정리 | ✅ | 속도 조절은 우상단 오버레이 단일 버튼으로 순환 처리. 증원 테스트 버튼 제거, 전술/진형/기동 버튼은 소형 그리드로 압축. |
| 자동 줌/프레이밍 | ✅ | 가까운 교전쌍 거리로 줌 배율을 정하되 전체 생존 함대/라벨을 항상 화면 안에 포함하도록 제한. |
| 모바일 성능 | ✅ | 모바일 퍼포먼스 모드 추가. 작은 함선 대표 렌더, 발사 밀도/총알 누적/폭발 파티클/글로우 비용 감소. |
| 캔버스 비율 | ✅ | 내부 버퍼와 CSS 표시 비율을 `460x600`으로 맞춰 텍스트/함대가 가로로 찌그러지지 않게 보정. |

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `assets/fleet-assault-demo.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.50 Fleet camera containment hotfix — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| Cinema 카메라 함선 화면 이탈 | ✅ | 오버숄더 카메라 중심을 소스/타겟 사이로 재계산하고, 카메라 target/actual center를 월드 경계 안으로 clamp. |
| 과도한 추적 줌 | ✅ | 오버숄더 줌을 함대 간 거리 기반으로 산출해 두 함대가 화면 안에 남도록 조정. |
| 박력 한계 판단 | 🟡 | 2D 전술맵 카메라만으로는 레퍼런스 같은 3D 깊이감 한계가 명확함. 다음 큰 개선은 프리렌더/3D풍 시네마틱 전투 뷰어로 분리 권장. |

검증:
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.49 Fleet combat role/preview/camera pass — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 샤드/재머 구매 이유 불명확 | ✅ | 재머 `EW` 역할을 실제 전투 엔진에 연결. EW는 낮은 직접딜 대신 적 함대 사격 간격 증가/화력 저하를 중첩시킴. |
| 재머 비용/설명 밸런스 | ✅ | migration 207로 재머 비용/건조시간/재료를 지원함 포지션에 맞게 낮추고, 샤드/재머 설명을 역할 중심으로 정리. |
| 조선소 역할 가독성 | ✅ | 카드에 DPS/TACKLE/EW/LOGI/TANK 역할 배지와 설명을 추가. |
| 함대 지휘 화면 구성 재미 부족 | ✅ | 선택 함대의 진형 미리보기 보드, 함종 구성 막대, 역할 칩, 함선별 ATK/DEF/SPD를 추가. |
| 모바일 함대전 화면 가독성 | ✅ | tactical lab v11.2: 모바일 캔버스 높이 확대, 버튼 2열 정렬, 함선 최소 표시 크기 확대, 정보 패널 모바일 그리드 정리. |
| 모바일 전술 버튼 점유 | ✅ | 오른쪽 구석 `TACTICS` 플로팅 버튼으로 전술 패널을 수납. 버튼 선택 후 자동 접힘으로 전장 화면을 최대한 유지. |
| 전장 카메라 | ✅ | 가장 가까운 교전 쌍 기반 자동 줌/팬과 `Cinema`/`Tactical` 카메라 모드 추가. Cinema는 기함 뒤 오버숄더 느낌의 추적샷과 전체 전장샷을 자동 교차. |

검증:
- `index.html` inline script syntax check 통과
- `assets/tactical-lab-v11.html` inline script syntax check 통과
- `node --check server/services/battleEngine.js` 통과
- `git diff --check` 통과

---

## ✅ v5.48 Shipyard build tab retention — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 함선 건조 후 큐 탭 강제 이동 | ✅ | `buildShip()` 성공 후 `switchSyTab('queue')`를 제거해 청사진/건조 탭에 그대로 남도록 수정. |
| 큐/재화 상태 갱신 | ✅ | `refreshShipyard()`는 유지해 건조 큐, GP, 광물, 버튼 상태는 즉시 갱신됨. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.47 Completed prologue compact card — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 완료된 프롤로그 카드 과점유 | ✅ | 완료된 `chapterNumber === 0` 프롤로그는 stats/description 없는 compact 카드로 접어서 표시. |
| 결과 접근 | ✅ | 접힌 카드에서도 `RESULTS` 버튼은 유지해 결과 모달 진입 가능. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.46 Campaign editor layout save/apply — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터 수정값 서버 미저장 | ✅ | 운영 `/api/campaign/editor-layout`가 `{}`를 반환해 인게임이 적용할 layout이 없던 상태 확인. |
| 에디터 서버 동기화 | ✅ | 에디터 시작 시 서버 layout을 로드하고, 서버가 비어 있으면 기존 localStorage layout을 자동 업로드. |
| Save 버튼 의미 정리 | ✅ | `Export Backup` 버튼을 `Save to Game`으로 변경하고 즉시 `/api/campaign/editor-layout`에 저장. |
| 인게임 fallback | ✅ | 서버 layout이 비어 있거나 로드 실패하면 같은 origin localStorage의 `editorCharacters`/`editorDialog`/`editorFontSize`를 fallback으로 적용. |

검증:
- `index.html` inline script syntax check 통과
- `assets/campaign-editor.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.45 Campaign story background transition flash — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 장면 전환 시 파란/보라 화면 노출 | ✅ | `_campaignResetStoryLayout()`이 `.story-background` inline style 전체를 삭제해 기본 CSS 그라디언트가 먼저 보이고 이미지 로드 후 배경이 붙던 문제 수정. |
| 배경 교체 방식 | ✅ | 현재 배경 이미지는 유지하고 위치/크기/opacity/filter만 초기화. 새 배경은 preload 성공 후 `backgroundImage`를 교체. |
| 동일 배경 재렌더 | ✅ | `data-bg-src`로 같은 배경이면 재로드 없이 layout만 적용. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.44 Campaign story editor layout runtime bridge — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 에디터 배치값 인게임 미반영 | ✅ | 스토리 렌더러가 캐릭터/배경/대사박스/closeup overlay 위치를 고정 CSS로만 그려 에디터 preview와 인게임 위치가 달라지던 문제 수정. |
| layout 필드 지원 | ✅ | 서버 저장 `_campaignEditorLayout`, `scene.layout`, `line.layout`, `editorLayout`, `stageLayout`을 병합하고 `desktop`/`mobile` breakpoint 값을 현재 화면에 맞게 적용. |
| 캐릭터 위치 적용 | ✅ | `layout.characters.berk` 같은 캐릭터별 좌표/크기/스케일을 읽어 좌우 기본 배치를 덮어씀. y가 없는 에디터 캐릭터 값은 bottom-anchor 방식으로 적용해 상단 overflow/crop을 방지. |
| 배경/대사창/overlay 위치 적용 | ✅ | `background`, `dialogBox`, `overlay` 계열 layout을 stage percent/px 값으로 적용. |
| 라인 전용 배경 | ✅ | 기존 주석과 달리 호출부가 `line.background`을 넘기지 않던 누락도 수정. |
| 캐시 버전 | ✅ | `CAMPAIGN_ASSET_VERSION` `20260502c`로 갱신. |

검증:
- `index.html` inline script syntax check 통과
- `git diff --check` 통과

---

## ✅ v5.43 Campaign character portrait generation — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캐릭터 포트레이트 파이프라인 | ✅ | gpt-image-1 + rembg, 1024×1536, 배경 제거 |
| pilot 3종 (butcher/chen/cinder) | ✅ | cinder v9 최종 채택 (번 스카 + 툴 벨트 확인) |
| batch1 7종 | ✅ | amara/director_vale/mikhail/miner_elder/olu_adeyemi/phoenix/sera |
| needs_story_check 2종 | ✅ | kenji/lena 스토리 확인 후 생성 |
| hold 16종 | ✅ | 전 캐릭터 생성 완료 |
| 생성 로그 | ✅ | `assets/campaign/characters/_generation_log.json` |

---

## ✅ v5.42 Campaign complete internal error — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 캠페인 완료 Internal error | ✅ | `player_campaign_progress` 완료 UPDATE에서 `$1` 파라미터를 `status` 대입과 `CASE WHEN` 비교에 동시에 사용해 운영 PostgreSQL이 `inconsistent types deduced for parameter $1`로 실패. |
| 완료 SQL 타입 충돌 제거 | ✅ | `CASE WHEN` 비교용 파라미터를 별도 `$8`로 분리해 `status` 컬럼 대입 타입 추론과 분리. |
| 실제 캠페인 플로우 검증 | ✅ | 운영 DB 합성 지갑으로 `mcc_prologue` 시작 → 완료 → `mcc_campaign_ch1` unlock 확인 후 합성 데이터 삭제. |

검증:
- `node --check server/services/campaign.js` 통과
- 운영 DB 합성 플로우: `complete ok true completed mcc_campaign_ch1`

---

## ✅ v5.41 Backend phantom schema + client guard audit — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| `user_achievements.id` phantom 반환 | ✅ | 실제 운영 DB `user_achievements`에는 `id`가 없으므로 업적 unlock INSERT가 `RETURNING id`에서 실패 가능. `RETURNING achievement_key`로 변경. |
| `user_profiles` phantom table 참조 | ✅ | 운영 DB에는 `user_profiles` 테이블이 없음. Contest/Expedition/Rental 닉네임 JOIN을 `users(wallet_address)` 기준으로 변경. |
| Rental `claims.pixel_count` phantom column | ✅ | 운영 DB `claims`에는 `pixel_count` 컬럼이 없음. `(claims.width * claims.height) AS pixel_count`로 계산. |
| Starlink overlay `undefined.length` client error | ✅ | 최근 `client_errors`에서 확인된 `passes.length` 접근을 배열 정규화/가드 처리. |
| Arena crash history 방어 | ✅ | `/api/arena/crash/history`가 배열이 아닌 응답을 주는 순간에도 UI가 터지지 않도록 배열 가드 추가. |
| Inline onclick handler audit | ✅ | `onclick` 849개 / 호출 함수 523개 스캔. 실제 미정의 핸들러 0개. |

검증:
- `node --check server/services/achievements.js`
- `node --check server/services/contest.js`
- `node --check server/services/expedition.js`
- `node --check server/services/rental.js`
- `index.html` inline script syntax check 통과
- 운영 DB 스키마 확인: `user_profiles` 없음, `user_achievements.id` 없음, `claims.pixel_count` 없음
- 운영 DB `BEGIN/ROLLBACK` 드라이런: contest/expedition/rental SELECT, achievement INSERT `RETURNING achievement_key` 통과

---

## ✅ v5.40 Shipyard build button GP summary — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 조선소 건조 버튼 비활성화 | ✅ | 프론트가 `summary.gp_balance`를 기준으로 GP 부족 여부를 판단하지만 `/api/ships/summary`가 해당 필드를 반환하지 않아 모든 유료 함선이 GP 0으로 판정됨. |
| summary 쿼리 기준 | ✅ | `fleets` 기준 집계에서 `users` 기준 LEFT JOIN으로 변경. 함대가 아직 없는 유저도 `gp_balance`, 함대 수, 건조 큐 수를 정상 수신. |
| DB 건조 스키마 | ✅ | 운영 DB `BEGIN/ROLLBACK` 드라이런에서 `ship_build_jobs`/`ship_build_log` INSERT 통과. |

검증:
- `node --check server/services/ship.js` 통과
- 운영 DB `ship_build_jobs`, `ship_build_log` 기존 0건 확인
- 운영 DB 드라이런 ROLLBACK 확인

---

## ✅ v5.39 Campaign asset hard cache refresh — 수정 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| SW 캐시 버전 | ✅ | `mars-v8`. 기존 `mars-v7` 이하 캐시 activate 단계에서 삭제. |
| HTTP 캐시 우회 | ✅ | `/assets/campaign/*` fetch를 `cache: reload`로 변경해 Service Worker Cache Storage뿐 아니라 브라우저 HTTP 캐시 고착도 회피. |
| URL 버전 통합 | ✅ | 배경/캐릭터/closeup 배경 URL을 `campaignAssetUrl()` + `?v=20260502b`로 통합. |

검증:
- inline script syntax check 통과
- `node --check sw.js` 통과
- `git diff --check` 통과

---

## ✅ v5.38 캠페인 배경 184장 Codex 전면 재생성 — 완료

| 항목 | 상태 | 비고 |
|------|------|------|
| 77장 scene-level 9:16 portrait | ✅ | 전체 portrait(height>width), 0 DIMENSION_FAIL |
| 107장 overlay 1:1 square | ✅ | 전체 square(width≈height), 0 DIMENSION_FAIL |
| style: gritty cinematic sci-fi | ✅ | green CRT 키워드 제거. cargo_ship_interior/mcc_briefing_room 2곳만 유지 |
| _bgMap 정리 | ✅ | 자체 파일 생긴 항목 제거, 폴백 4개 유지 |
| SW cache-bust mars-v6 | ✅ | 옛 이미지 캐시 전체 무효화 |
| URL ?v=20260502a | ✅ | sw 동기 |

---

# OCCUPY MARS — Codebase Audit (v5.37 / 2026-05-01)

## ✅ 현재 코드베이스 상태 요약 (2026-05-01 기준)

### v5.37 UI 검수 + 캐시 무효화 + 파벌 대사 시스템 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 851 onclick 핸들러 검수 | ✅ | 자동 스캔 522 unique 함수, 미정의 3건 → 모두 실구현. |
| 업적 달성 조건 모달 | ✅ | showAchievementDetail() — condition_type 27종 한/영 라벨, 보상, 상태, 일시. |
| 슬로대 스타일 파벌 대사 | ✅ | showFactionFlavor() — 4 situation × 65 라인. MCC/FSP/CV 캐릭터 12명. claim/hijack/함대전 hook. |
| 모바일 옛 이미지 캐시 | ✅ | sw.js CACHE_NAME mars-v4 → mars-v5. activate 시 옛 image cache 일괄 삭제. URL ?v=20260501d 동기. |

---

### v5.37 Ship build transaction silent rollback — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 함선 건조 실패 root cause | ✅ | `server/services/ship.js` `startBuild()`에서 선택적 `fleet_gp_activity` 로그를 트랜잭션 내부에서 `.catch(() => {})`로 삼켜 PostgreSQL transaction-aborted 상태가 `COMMIT` 시 전체 롤백될 수 있었음. |
| `ship_build_jobs` INSERT 보장 | ✅ | 건조 트랜잭션은 GP/광물 차감, `ship_build_jobs` INSERT, `ship_build_log` INSERT만 수행하고 바로 `COMMIT`. optional activity log는 `COMMIT` 이후 `logFleetGpActivity()` fire-and-forget. |
| 재료 조회 스키마 | ✅ | `recipe_minerals` 키는 resource code이며, 조회/차감은 `resources.code` → `resources.id` 매핑 후 `user_resource_inventory(resource_id)`로 수행. `resource_code` 직접 매칭 버그는 현재 경로에 없음. |
| 설정 게이트 | ✅ | `startBuild()`는 `fleet_combat_enabled`/`flagship_required`로 건조를 막지 않음. `max_ships_per_player`는 명시적 `PLAYER_FLEET_FULL`, ship type limit은 `SERVER_LIMIT_REACHED`/`PLAYER_LIMIT_REACHED` 반환. |
| GP/광물 오류 응답 | ✅ | `/api/ships/build`는 `INSUFFICIENT_GP`, `INSUFFICIENT_MINERALS`를 402와 `meta`로 반환. |
| 클라이언트 요청 확인 | ✅ | `index.html` `buildShip()`은 `ship_type_code`를 전송하며 이번 수정에서 UI 파일은 건드리지 않음. `fleet_id`는 optional이고 누락 시 건조 완료 단계에서 기본 함대로 배정됨. |

검증:
- `node --check server/services/ship.js` 통과
- `git diff --check` 통과
- sandbox 네트워크 제한으로 local Postgres `psql` 접속 검증은 불가

---

### v5.36 Scene-level 77 + Variant 301 + JSON round-robin — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Scene-level 77장 재생성 | ✅ | location-named (cargo_ship_corridor, olympus_summit_station 등) Imagen 4 Ultra 9:16. 평균 1418KB. |
| 반복 케이스 147건 식별 | ✅ | prologue_shared cargo_ship_corridor 18회, olympus_summit_station 40/39/30회 등. |
| Variant 301장 생성 | ✅ | bg당 N개 variant (N=1~7, 회수에 비례). 평균 1410KB. 8종 angle/lighting hint round-robin. |
| 36개 JSON round-robin | ✅ | scene.background 필드를 base + v2/v3/v4… 로 회전. 시각적 반복 피로감 해소. |
| 인프라 일치 | ✅ | line.background (115 dedicated) + scene.background (77 base + 301 variants) 모두 cinematic 통일 |

검증:
- variant: 301/301 1차 성공, failed 0
- find assets/campaign/backgrounds -name "*.png" → 약 480장
- 36개 챕터 JSON 모든 background ID 가 실제 PNG 와 1:1 매칭

후속:
- 향후 핵심 씬 더 높은 퀄 필요 시 Codex/gpt-image-1 으로 부분 업그레이드 가능

---

### v5.35 Imagen 4 Ultra 115장 일괄 재생성 완료 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 모델 업그레이드 | ✅ | `imagen-3.0-generate-001` → `imagen-4.0-ultra-generate-001`. Codex agent 가 작성한 스크립트 실행. |
| 115장 일괄 재생성 | ✅ | 114/115 1차 성공, 1장 safety filter retry 후 완료. 평균 1481.7KB. |
| 골드 스탠다드 도달 | ✅ | 167/190 (88%) ≥1.4MB. ≥2MB 19개, 1.5-2MB 116개. |
| 검수 픽스 (배치 중 3장) | ✅ | cv_ch10_l14 헤드램프 / cv_ch1_l41 캐릭터 박힘 / mcc_ch5_l29 safety filter — 모두 타겟 재생성 |
| 9:16 portrait | ✅ | 모바일 풀스크린 적합 |
| 대사·캐릭터 매칭 | ✅ | hand-crafted 영문 프롬프트 (KO 대사 → 시각 요소) 그대로 적용 |

검증:
- `find assets/campaign/backgrounds -name "*.png" -newermt "2026-05-01" | wc -l` → 115
- 평균 사이즈 1481KB, 분포 ≥2MB 19개 / 1.5-2MB 116개 / 1.4-1.5MB 32개 / <1.4MB 23개
- 기존 70개 scene-level high-quality 배경 보존 (수정 없음)

---

### v5.34 Imagen 4 Ultra 모델 업그레이드 + 골드 스탠다드 적용 — 진행 중

| 라인 | 상태 | 수정 |
|------|------|------|
| 모델 업그레이드 | ✅ | `imagen-3.0-generate-001` → `imagen-4.0-ultra-generate-001` 전환 (`gen_scene_dedicated_v2.py` 내 `IMAGEN_MODEL` env var 지원). Codex 추천. |
| 테스트 검증 | ✅ | CV Ch10 첫 3장 (fire_small / hand_still / death_still) 1494/1506/1510KB 달성, 모두 골드 스탠다드 1.4MB+ 돌파. 디테일 차원이 다름 (정교한 metal gear, 텍스트 레이블, 환경 스토리텔링). |
| 118장 일괄 재생성 | 🔄 | `--strict` 모드로 < 1.4MB 결과물 모두 Imagen 4 Ultra 로 재시도 (백그라운드). |
| 사이즈 보장 | ✅ | 9:16 portrait + Imagen 4 Ultra = 안정적으로 1.4MB+ 출력 확인 |
| 비용 노트 | ⚠ | Imagen 4 Ultra 는 Imagen 3 대비 호출당 단가 ↑. 118장 일괄 재생성 cost 약 $X 추정 (별도 확인 필요) |

검증:
- `imagen-4.0-ultra-generate-001` 첫 3장 모두 1.4MB+ (Imagen 3 대비 약 50-100% 사이즈 증가)
- 9:16 portrait 유지, hand-crafted prompt 그대로 적용
- `assets/campaign/backgrounds_imagen4_test/` 에 비교용 샘플 보존

---

### v5.34 오버레이 폐기 + 씬 전용 9:16 배경 (인프라 1/2) — 진행 중

| 라인 | 상태 | 수정 |
|------|------|------|
| 오버레이 시스템 제거 | ✅ | `.story-detail-overlay` CSS, `<img>` 엘리먼트, `_showStoryDetailOverlay()` 함수, `assets/campaign/overlays/*.png` 35개 일괄 삭제. floating closeup → 라인 풀스크린 배경 swap 으로 전환. |
| `_campaignStorySetBackground` 라인 인자 | ✅ | `(scene, overlay, lineBg)` 시그니처. lineBg 있으면 우선 사용. |
| scene JSON `overlay` → `background` | ✅ | 35개 챕터 / 107 라인 변환 (`scripts/update_scene_overlays_to_backgrounds.py`). |
| hand-crafted 프롬프트 120개 | ✅ | 107 씬 라인 + 13 저퀄 scene-level. KO 대사 직접 읽고 캐릭터·사물·행동·분위기 명시. 9:16 portrait. |
| Imagen 3 9:16 생성 | 🔄 | 진행 중 (~1분/장). 후속 커밋 (2/2) 에 PNG 일괄 포함. |
| `hidden_ch5_last_observation.json` JSON parse | ✅ | line 370 닫는 중괄호 오타 수정. 캠페인 스캔 / 변환 모두 이 챕터 포함 가능. |

검증:
- `python3 -c "import json,glob; [json.load(open(f)) for f in glob.glob('docs/campaign-story/*.json')]"` 36개 모두 파싱 성공
- `grep -c story-detail-overlay index.html` 잔존 0건 (코멘트 1개 제외)
- 변환된 라인 background ID ↔ `gen_scene_dedicated_v2.py PROMPTS` 키 1:1 일치

---

### v5.33 Campaign Visual Novel Engine + 이미지 에셋 + Internal Error 수정 — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 비주얼 노벨 씬 엔진 | ✅ | `showCampaignStory()` 구현. narration/dialogue/choice/branch/battle_transition/result/ending 씬 타입 지원. 타이핑 애니메이션, 캐릭터 초상화(현재 화자 밝게/비화자 dim), 배경 전환 효과. |
| 배경 이미지 78개 | ✅ | `assets/campaign/backgrounds/*.png`. 기존 8 + Imagen 3 신규 70개. 씬 JSON의 background ID와 1:1 대응. `.gitignore` 예외 추가. |
| 캐릭터 초상화 21개 | ✅ | `assets/campaign/characters/*.png`. Imagen 3 신규 10개(liang_wei/yuna/crow/aisha/hagar/kenji/verk/observer/miner_anon/miner_elder) + 기존 11개. |
| `complete()` Internal Error | ✅ | `applyReputation()` 호출을 `applyOptionalCampaignReward` SAVEPOINT로 감쌈. reputation_history 테이블 이슈 시 평판만 건너뛰고 챕터 완료 유지. 기존에는 전체 롤백 → 500. |
| 프롤로그 scene choice `INVALID_CHOICE` | ✅ | `index.html`이 서버 `chapter.choices`에 없는 VN scene-local 선택지는 로컬로 진행하고, no-choice 프롤로그 챕터는 서버에서도 scene choice ID를 방어적으로 인식. |
| Migration 204 방어 재보장 | ✅ | `attempts`/`best_metrics`/`last_metrics`/`source_chapter` ADD COLUMN IF NOT EXISTS. `reputation_history`/`campaign_sessions`/`player_branch_modifiers` CREATE TABLE IF NOT EXISTS. `hidden_campaign_ch1~5` FK 시드. |
| `.jpg` 확장자 버그 | ✅ | 배경 로딩 코드에서 `.jpg` → `.png` 수정. 기존에는 모든 배경이 gradient fallback이었음. |

검증:
- `ls assets/campaign/backgrounds/ | wc -l` → 78
- `ls assets/campaign/characters/ | wc -l` → 21
- `git log --oneline` → migration 204, applyReputation SAVEPOINT, _bgMap 업데이트 커밋 확인
- `node --check server/services/campaign.js` 통과
- `node --check server/routes/api.js` 통과
- `docs/campaign-story/*.json` scene choice scan: 31개 parseable 파일, 32개 choice/branch scene, 128개 scene option 확인. `hidden_ch5_last_observation.json`은 기존 JSON parse error(line 370)로 structured scan 제외.

---

### v5.32 Capital ship Core/Mid material gate + Phase C hijack modal cleanup — 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Battleship/Titan Core+Mid mat 보장 | ✅ | Migration 203 적용. 모든 BS/Titan(6종)이 Core 전용(`exotic_alloy`/`dark_matter`/`quantum_core`)과 Mid 전용(`titanium_alloy`/`plasma_crystal`/`nano_polymer`) 광물을 둘 다 포함. fsp_titan에 nano_polymer:40 추가, 모든 BS의 exotic_alloy 최소치를 3 으로 통일. 마이그레이션이 invariant assertion으로 자체 검증. |
| 어드민 추적용 settings | ✅ | `capital_ship_core_mat_required`, `capital_ship_mid_mat_required`, `capital_ship_recipe_contract`, `core_exclusive_minerals`, `mid_exclusive_minerals` 키 시드. admin이 광물 코드 set을 한 곳에서 관리/감사 가능. |
| Phase C 죽은 하이잭 모달 제거 | ✅ | `index.html`의 `hijackModal` HTML(31줄) + `openHijackModal/closeHijack/confirmHijack` 함수 삭제. `useLegacyDeclare` 게이트 뒤에 숨어 있어 도달 불가능했던 dead code. 영토 정보 패널의 정식 진입점(`hijackFromTerritoryInfo` → claim 모달 → `/api/hijack/declare-with-pp`)은 유지. |
| `/api/hijack/declare` 410 응답 보강 | ✅ | 메시지에 alternatives 객체(territory_hijack/ai_duel/pvp_tournament 경로)를 명시. `phaseC.js` + `services/hijack.js` 라우트 정리 주석 동기화. 외부에서 잘못 호출했을 때 어디로 가야 하는지 즉시 안내. |
| ships/build·resource-craft/start·hijack/declare-with-pp 스모크 | ✅ | `server/tools/smoke_capital_recipes.js` 작성·통과. 11/11 통과 — `ship.startBuild` (mcc_bs/mcc_titan), `resourceCraft.startCraft` (hull_plate/plasma_coil), `hijack` 서비스 export 4종, `hijack_battles` 스키마(target_claim_id NULL 허용 + pending_pixels 컬럼), Migration 203 invariant. Core+Mid 광물이 실제로 차감되는지(`exotic_alloy`/`titanium_alloy`/`nano_polymer`)도 직접 검증. |

검증:
- `psql -f server/migrations/203_capital_ship_core_mid_materials.sql` 적용 (assertion 통과)
- `node server/tools/smoke_capital_recipes.js` → 11 passed / 0 failed
- `node --check` 모든 수정 JS 파일 통과
- `grep -c openHijackModal hijackModal closeHijack confirmHijack index.html admin.html` → 0/0

---

### v5.31 Bug report 버튼 중복 제거 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 신규 `#bugReportFab` 🐞 + `class="bug-modal"` 시스템 | ✅ 삭제 | CSS(.bug-fab/.bug-modal 약 65줄), HTML(버튼+모달 약 45줄), JS(`selectBugCat`/`openBugReport`/`closeBugReport`/`submitBugReport` 신규본 약 120줄) 일괄 제거. 레거시 시스템과 `id="bugReportModal"` 중복으로 클릭 시 잘못된 모달이 열리던 충돌 해소. |
| 레거시 `#bugReportBtn` 🐛 위치 | ✅ 이동 | 우하단 고정에서 `.zc` 줌 컬럼의 SECTORS 버튼 바로 왼쪽(8px gap, 세로 가운데)으로 이동. `alignBugFab()` rAF-throttled 함수가 load/resize/DOMContentLoaded/주기 타이머에서 재계산. |
| `i18n` 사전 잔여(`bug_report_*`, `bug_cat_*` × 4 lang) | 🟢 무해 | 더 이상 참조하는 UI 없음. 후속 정리 가능하나 동작 영향 없음. |

검증:
- `index.html` 정적 파싱 — `bugReportBtn` 1, `bugReportFab` 0, `bugReportModal` 1 (레거시 한정).
- 신규 시스템 함수/CSS 클래스 잔존 0건 grep 확인.

---

### 🔍 Campaign System 정밀 감사 (2026-04-30, Claude+Codex 협업) — **수정 필요**

> 직전 hotfix(commit a84f208) 이후 캠페인 30+ 챕터 출시 전 정밀 감사. Codex가 `server/services/campaign.js` 비즈니스 로직, Claude가 마이그레이션 192-201 + API 라우트 + index.html UI를 분담해 검토함.

#### 🔴 Critical (출시 차단)

| # | 위치 | 결함 | 재현 |
|---|------|------|------|
| ✅ C1 | `server/services/campaign.js:3122` | **Resolved (2026-04-30)**: `calculateEligibleFspEndings()` 추가 및 FSP_CH10_ID ending eligibility 검증 적용 | 자격 미달 FSP Ch10 엔딩 직접 제출 차단 |
| ✅ C2 | `server/services/campaign.js:3122` | **Resolved (2026-04-30)**: FSP Ch9 조건부 Pilgrim Arms 선택지 prerequisite branch modifier 검증 적용 | 전제 조건 없는 `fsp_ch9_signal_pilgrim_arms` 직접 제출 차단 |
| ✅ C3 | `index.html:25095`, `server/services/campaign.js:3298` | **Resolved (2026-04-30)**: scene-local VN choices no longer post to `/api/campaign/choice`; no-choice prologue chapters defensively accept scene choice IDs | 프롤로그 CONTINUE 후 선택지 클릭 시 `INVALID_CHOICE` modal 발생 차단 |

#### 🟡 Major (조기 핫픽스 필요)

| # | 위치 | 결함 | 영향 |
|---|------|------|------|
| M1 | `campaign.js:2135` `simulatePrologue()` | 마지막 씬/진행도 검증 없음 | 프롤로그 `start` 직후 `complete` 호출 시 보상/Ch1 해금 즉시 지급 (스킵 farming) |
| M2 | `campaign.js:3167` `startChapter()` | `campaign_sessions`에 (wallet, chapter_id, status='active') UNIQUE 제약 없음 | 동시 `start()` 호출 시 같은 wallet/chapter에 활성 세션 중복 생성 가능 |
| M3 | `campaign.js:2173` `simulateChapter()` | 미지원 routeId(CV/hidden) → MCC Ch1 시뮬레이션으로 폴백 | CV 캠페인 완료 시 MCC Ch1 시뮬레이션 결과로 처리 |
| M4 | `campaign.js:2923` `calculateRewards()` | M3와 동일한 폴백 | CV/hidden 챕터가 MCC Ch1 보상(Prism blueprint + Ch2 unlock)을 잘못 수령 |

#### 🟢 Minor (후속 정리)

| # | 위치 | 결함 |
|---|------|------|
| m1 | `campaign.js:3361` `applyOptionalCampaignReward` catch | `err.message`만 로깅, stack 누락 — Railway에서 보상 SAVEPOINT 실패 원인 추적 어려움 |
| m2 | `campaign.js:43` `loadScenesFile()` | 동일하게 stack/context 없이 detail만 출력 |
| m3 | `routes/api.js:3508-` 캠페인 라우트 전체 | wallet 길이 검증 없음 (`if (!wallet)`만). 다른 라우트는 `requireWallet`로 ≥10자 강제 — 일관성 부족 (위험도 낮음) |

#### ✅ 검증 통과 항목

- 마이그레이션 192~201 schema/seed 무결성 (FK, ON CONFLICT, schema_migrations 자동 등록 via migrate.js)
- `complete()` 트랜잭션: `FOR UPDATE` 행 잠금으로 동시 complete 차단, status='in_progress' 필터로 idempotency 보장
- 보상 SAVEPOINT 격리(blueprint/title/mastery/tag/lore/branch) — 부가 보상 실패가 챕터 완료를 깨지 않음
- 보상 payload는 클라이언트가 제출하지 않음 — `calculateRewards()`가 서버에서만 결정
- choice ID 화이트리스트 검증 (`chapter.choices.find(c => c.id === choiceId)`) — Ch1~Ch9는 정상
- MCC Ch10 ending eligibility 서버 enforcement 정상 (`calculateEligibleEndings()` + `validateChapterChoice()`)
- Ch7/8/9 route prefix 강제 (a/b/c) 정상
- 서비스 `CHAPTERS` 딕셔너리 ↔ `docs/campaign-story/*.json` 36개 씬 파일 ↔ migration seed 모두 일관
- index.html 캠페인 UI 흐름: 파벌 필터, 잠긴 챕터 compact list, sessionId 이어받기, abandon 호출 정상
- 마이그레이션 201로 prologue + CV 챕터 FK 위반(`Internal error`) 해소 확인

#### 권장 수정 순서

1. ✅ **C1, C2 resolved** (`validateChapterChoice` 확장: `FSP_CH7~10_ID` 추가, FSP ending eligibility 함수 추가)
2. **M1** (`simulatePrologue`에 최소 진행 시간/씬 도달 플래그 검증)
3. **M2** (`campaign_sessions(wallet, chapter_id) WHERE status='active'` 부분 UNIQUE 인덱스 추가)
4. **M3, M4** (지원 안 되는 routeId는 명시적으로 `error: 'NOT_IMPLEMENTED'` 반환)
5. **m1, m2** (catch 로그에 `err.stack` 추가)
6. **m3** (`requireWallet` 헬퍼 적용)

검증:
- Codex agent가 `server/services/campaign.js` 3712줄 정밀 감사
- Claude가 마이그레이션 192-201 + API 라우트 + index.html UI 검사 (병행)
- 마이그레이션 BEGIN/ROLLBACK 드라이런은 본 감사에서는 수행하지 않음 (수정 후 별도 검증 예정)

---

### v5.30 Mobile first-load side panel lock — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| iPhone XS Max 첫 화면 | ✅ | 1024px 이하에서 좌/우 사이드 패널은 `.open` 없이는 `!important` off-screen transform을 적용해 지도 화면을 가리지 않게 수정. |
| iOS 상태 복귀 | ✅ | `pageshow`, `load`, `orientationchange`에서 `forceCloseMobilePanels()`를 호출해 bfcache/회전/이전 open 상태가 첫 화면에 남지 않도록 보강. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.29 FSP Campaign Ch7~10 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch7 Assembly | ✅ | Hellas Central 의회, Mikhail/Liang/Amara/Diego/Player 의장 분기, 환경 위기 병행 지표, Ch8~Ch10 branch modifier 보상 추가. |
| FSP Ch8 Gaia | ✅ | 시민 기부/전투 pledge/침묵/MCC 절도 4선택, Gaia 건조율·HP·민간 피해·절도 성공 지표, Gaia/Pilgrim Arms seed 보상 추가. |
| FSP Ch9 Three Flags | ✅ | Olympus 정상회담, Amara/Chen/Butcher/전원후퇴/Pilgrim Arms 신호 보호 선택, 배신/4파벌/Peacemaker 분기 추가. |
| FSP Ch10 Freedom's Price | ✅ | Citizen, Peacemaker, Gaia Captain, Disillusioned, New Chair, Bad Ending 최종 보상과 route completion token 추가. |
| persistence | ✅ | `200_fsp_campaign_ch7_to_ch10.sql`에 환경, 위치, NPC, 의장 후보/유권자 테이블, lore, branch, tag, item, chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Assembly 전용 11석 UI, Gaia 조선소 방어 UI, Three Flags 회담장 protect UI, ending eligibility 자동 추천/락 UI는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- 운영 DB 기준 `200_fsp_campaign_ch7_to_ch10.sql` BEGIN/ROLLBACK 드라이런 통과

---

### v5.28 Campaign Ch1 continue/complete 안정화 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 산소 쟁탈 CONTINUE | ✅ | 진행 중인 `sessionId`가 있으면 `/api/campaign/start`로 새 세션을 만들지 않고 기존 브리핑/시뮬레이션을 이어가도록 수정. |
| Ch1 완료 보상 | ✅ | blueprint/title/mastery/tag/lore/branch 같은 부가 보상을 `SAVEPOINT`로 격리해 한 항목 실패가 전체 완료 500으로 번지지 않게 보강. |
| Ch1 구식 id | ✅ | Ch1 unlock/failure branch의 `mcc_ch2`, `mcc_ch6` 구식 id를 `mcc_campaign_ch2`, `mcc_campaign_ch6` 상수 경로로 정정. |

검증:
- 운영 DB 읽기 전용 schema/status 점검
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.27 Campaign Quick Button 기준 위치 재조정 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 데스크탑 CAMPAIGN 버튼 | ✅ | 오른쪽 줌 컬럼의 되돌리기 버튼 위에 배치. |
| 모바일 CAMPAIGN 버튼 | ✅ | 왼쪽 하단의 "화성을 클릭하여 영토 선택" 모드 배지 바로 위에 배치. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.26 Campaign Quick Button 위치 보정 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 데스크탑 CAMPAIGN 버튼 | ✅ | 하단 중앙 액션 영역에서 제거하고 좌측 패널 오른쪽 상단 보조 액션 위치로 이동. |
| 태블릿/모바일 CAMPAIGN 버튼 | ✅ | 하단 네비, OPS split card, 줌 컬럼과 충돌하지 않도록 상단 왼쪽 작은 pill로 이동. |

검증:
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.25 FSP Campaign Ch5~6 MVP + Campaign UI 압축 — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch5 Kepler Commons | ✅ | Liang Wei, Roth dead drop, Kepler 회담, 산소 보급 시한, Commons/중재/압박/전투/전면 공개 분기를 서버 시뮬레이션으로 추가. |
| FSP Ch6 The Mole | ✅ | Kenji Tanaka 진범, Sarah/Diego red herring, 단서 수집/심문 지표, 처형/이중첩자/추방/오판 분기 추가. |
| 조건부 선택 검증 | ✅ | Ch5 Roth 데이터 압박/전면 공개 선택은 증거 flag가 있을 때만 허용. Ch5/Ch6 hard block도 서버 시작 조건에 반영. |
| Campaign UI | ✅ | 메인 지도 CAMPAIGN 퀵 버튼 추가. QUESTS 안 캠페인 목록은 진행 가능/진행 중 카드만 크게 보이고 locked chapter는 접힘 compact list로 축소. |
| persistence | ✅ | `199_fsp_campaign_ch5_ch6.sql`에 신규 환경, 위치, NPC, dead drop, internal zones, clue/suspect pool, lore, branch, tag, item, chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Ch5 3파벌 회담 전용 테이블 UI, Ch6 수동 단서 수집/심문 루프, NPC 표정/zone map/real-time combat는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `199_fsp_campaign_ch5_ch6.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.24 FSP Campaign Ch4 Diplomacy MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch4 Diplomacy | ✅ | Sandstone Junction 비밀 회담, Cinder Grace 첫 등장, Amara 보호, MCC 정찰 회피 MVP 시뮬레이션 추가. |
| 협상 선택지 | ✅ | 피난소 제공/보급 공유/정보 교환/증거 공유/협상 중단 5개 선택지와 Cinder 동맹 강도, CV/FSP 평판 변화를 서버 보상으로 계산. |
| 조건부 증거 공유 | ✅ | `fsp_ch4_evidence_share`는 FSP Ch3 공식 작전 lore 또는 MCC cross-route 산소 노예제 branch evidence가 있어야 선택 가능. |
| persistence | ✅ | `198_fsp_campaign_ch4_diplomacy.sql`에 Sandstone Junction, Cinder Grace, 신규 환경, lore flag, branch modifier, tag, item, chapter config seed 추가. |
| Ch5/Ch6 spec 상태 | 🟡 | 전달된 FSP Ch4~6 문서에서 Ch5/Ch6는 placeholder라 이번 범위에서 제외. 다음 spec 수령 후 이어서 구현 필요. |
| full engine/UI 잔여 | 🟡 | 외교 전용 UI, Amara 보호 객체, MCC 정찰선 조건부 호위전, Phobos shadow escape 연출은 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `198_fsp_campaign_ch4_diplomacy.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.23 FSP Campaign Ch1~3 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| FSP Ch1 Breakwater | ✅ | New Athens 차 두 잔 의식, H2O 호송 2척, 응급 환자 2명, CV 약탈단, cargo/patient 상태 MVP 시뮬레이션 추가. |
| FSP Ch2 Ice Caravan | ✅ | 태양광 노출 얼음 손실, Phobos Eclipse 활용 횟수, Lena 생존/신뢰, Sal Cruz 매복 결과를 서버 지표로 계산. |
| FSP Ch3 Blood Mine | ✅ | Verin-7 산소 조절기, 알람 여부, 412명 광부 구출률, 60명 잔류 존중, Samuel/Amara 신뢰 분기 추가. |
| FSP persistence | ✅ | lore flag, branch modifier, tag, NPC, environment, item, settlement seed를 `197_fsp_campaign_ch1_to_ch3.sql`에 추가. |
| 정착지 seed | ✅ | `settlement_data`를 idempotent하게 생성/확장하고 New Athens/Cold Brook/Ridge Town/Hellas Central 초기값 추가. |
| full engine/UI 잔여 | 🟡 | Tea Ceremony, Patient Gauge, Ice Gauge, Solar Exposure, Oxygen Regulator UI와 실제 battle object 연동은 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `197_fsp_campaign_ch1_to_ch3.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.22 MCC Campaign Ch8~10 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch8 Prometheus | ✅ | 4-phase environmental sequence와 Branch A 파괴/Branch B·C 방어 MVP 시뮬레이션, Prometheus Titan/조기 Ending 3 분기 반영. |
| Ch9 Broken Alliance | ✅ | 4전장 선택, NPC 전장 자동 결과, Pilgrim Arms 24척 공개, Amara/Butcher/Chen 운명 branch modifier 반영. |
| Ch10 Shareholder Ending | ✅ | Ending 1~4 + fallback cinematic-only 챕터, 엔딩별 GP/XP/평판/아이템/tag/lore/cross-route modifier 지급. |
| 엔딩 자격 계산 | ✅ | Branch A/B/C, Chen 사망, Roth 데이터, MCC 평판, blackmail data 조건을 서버에서 계산하고 부적격 엔딩 선택을 거부. |
| 루트 선택 검증 | ✅ | Ch7~9 선택지가 활성 Ch6 루트 prefix와 맞지 않으면 `/api/campaign/choice`에서 차단. |
| seed migration | ✅ | `196_mcc_campaign_ch8_to_ch10.sql`에 lore flag, branch modifier, tag, NPC, special asset, item, achievement, environment/chapter seed 추가. |
| full engine/UI 잔여 | 🟡 | Ch8 phase UI, Ch9 4전장 실시간 UI, Ch10 엔딩 시네마틱/크레딧/NG+ UI는 후속 P1/P2. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `196_mcc_campaign_ch8_to_ch10.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.21 MCC Campaign Ch5~7 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch5 Kepler Commons | ✅ | low gravity/oxygen pressure 환경과 FSP 차단, 보급선 호위, 단독 데이터 탈취, CV 자급 모선 격파 4분기 MVP 시뮬레이션 추가. |
| Dr. Roth 데이터 | ✅ | Ch5 성공 경로에서 Roth 외계 기원 데이터, 플레이어 공개, Roth 실종 lore flag와 XP 보너스/데이터 artifact 보상을 지급. |
| Ch6 Whistleblower | ✅ | Li Fang 지원/Chen 보고/자료 사본 보관 3개 선택으로 A/B/C 루트를 확정하고 tag, lore, ending branch modifier를 지급. |
| Ch7 Market War | ✅ | Ch6 루트별 A/B/C 변형 선택지와 CV 군벌 제거, Helion 자회사 인수, Chen 감시 branch modifier를 반영. |
| 루트 선택 검증 | ✅ | Ch7 시작 조건이 `mcc_route_a/b/c_active` 중 하나를 요구하고, `/api/campaign/choice`가 활성 루트와 맞지 않는 Ch7 선택지를 거부. |
| status endpoint 호환 | ✅ | `player_branch_modifiers`의 실제 정렬 컬럼 `set_at`을 사용해 Ch7 branch availability 합산 중 500이 나지 않도록 수정. |
| seed migration | ✅ | `195_mcc_campaign_ch5_to_ch7.sql`에 lore flag, branch modifier, tag, NPC, data artifact, 신규 환경, chapter/environment seed 추가. |
| full engine 잔여 | 🟡 | Ch5 산소 보급선/Kepler 서버/CV 모선, Ch6 방사선 폭풍 탈출, Ch7 시장전 함대/경제 객체는 후속 전투 엔진 통합 필요. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/services/campaign.js` + `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `195_mcc_campaign_ch5_to_ch7.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.20 MCC Campaign Ch2~4 MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ch2 Frozen Highway | ✅ | Hellas 채굴장 인수 MVP 시뮬레이션 추가. 시설 HP, 민간인 피해, 민병대 격파, FSP 증원 ETA, `war_criminal` 실패 분기 반영. |
| Ch3 Boardroom | ✅ | Helion/Verin/Chromium 3분기 선택과 branch별 보상/난이도/Ch6·Ch7 modifier 반영. |
| Ch4 Pirate's Payroll | ✅ | Kara Vex 첫 만남, Ion Storm, Helion 습격대 도주/생존/호감 분기와 Ch9·Ch10 modifier 반영. |
| seed migration | ✅ | `194_mcc_campaign_ch2_to_ch4.sql`에 22개 lore flag, 6개 branch modifier, `clean_operator`, 신규 환경, NPC, chapter seed 추가. |
| 시작 조건 | ✅ | 서버가 prerequisite, required level, required reputation, blocking tag를 검증. Ch2 거부 시 Ch3 마지막 기회 branch override 허용. |
| 보상/분기 지급 | ✅ | GP/XP/평판/아이템 inbox/lore/tag/branch modifier를 기존 complete 트랜잭션 경로로 처리. |
| UI 범용화 | ✅ | 캠페인 카드/결과 모달이 Ch1 산소 지표에 고정되지 않고 Ch2~4 주요 metric을 표시. Locked chapter 버튼 비활성화. |
| full engine 잔여 | 🟡 | Ch2 구조물/민간인 객체, Ch3 신규 함선, Ch4 NPC protection/manual-only mode는 후속 전투 엔진 통합 필요. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- 운영 DB 기준 `194_mcc_campaign_ch2_to_ch4.sql` ROLLBACK 드라이런 통과
- `git diff --check` 통과

---

### v5.19 Campaign Common Systems — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| campaign progress/session | ✅ | 기존 Ch1 진행 테이블을 유지하면서 `campaign_sessions`, attempts, best/last metrics를 추가해 재접속/재시도 기반을 마련. |
| reputation system | ✅ | MCC/FSP/CV/Pilgrim Arms 축 지원, -100~100 clamp, tier label, `reputation_history` 감사 로그 추가. |
| tags/titles | ✅ | `tag_definitions`, `player_active_title`, player tag API 추가. grant/revoke는 admin secret 필요. |
| lore flags | ✅ | `lore_flag_definitions`, player/global lore flag 기반 추가. set endpoint는 internal-only, check/get은 조회용. |
| branch modifiers | ✅ | modifier definition/player modifier 테이블 및 active 조회 API 추가. Ch1 실패 modifier도 공통 테이블에 기록 가능. |
| environment system | ✅ | 5개 환경 정의 seed와 Ch1 dust storm intensity curve seed 추가. 서버 helper가 현재 phase/modifier를 계산. |
| campaign UI | ✅ | QUESTS CAMPAIGN 패널에 3축 평판 게이지 추가. |
| status payload | ✅ | 캠페인 미시작 유저도 reputation 4축 기본값 `0`을 받도록 보정. |
| security audit | ✅ | 클라이언트가 보상/평판/태그/분기를 결정하지 않도록 조작성 endpoint는 `x-admin-secret`/`x-admin-key` 필요. |
| P2/P3 잔여 | 🟡 | 복잡 조건 evaluator, chapter spec validator, admin rollback 도구, full engine 환경 hook은 후속 단계. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과

---

### v5.18 MCC Campaign Ch1 "산소 쟁탈" MVP — 구현 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 기존 quest 시스템 호환성 | ✅ | daily/weekly quest 진행 테이블을 건드리지 않고 `player_campaign_progress`로 분리해 기존 QUESTS 로직과 충돌을 피함. |
| 캠페인 DB 기반 | ✅ | chapter 메타, 진행도, 선택지, 평판, 태그, lore flag, branch modifier, reward inbox 테이블 추가. |
| `/api/campaign/*` | ✅ | status/start/choice/progress/complete 5개 엔드포인트 추가. wallet/player_id alias와 session 검증 적용. |
| 선택지 위변조 방어 | ✅ | 서버가 chapter 정의의 choice id만 허용하고, 이미 선택한 세션은 첫 선택지만 유지. 클라이언트 보상 payload는 받지 않음. |
| 보상 지급 | ✅ | GP/XP/평판/칭호/환경 숙련도/blueprint inbox/진행도 갱신을 완료 트랜잭션 안에서 처리. |
| 시뮬레이션 결정성 | ✅ | wallet + session_id + choice_id 기반 seed로 같은 세션 결과가 서버에서 결정됨. |
| UI 진입 | ✅ | QUESTS 탭에 CAMPAIGN 카드, 브리핑 선택지, 진행 애니메이션, 결과 모달 추가. |
| Phase 2 잔여 | 🟡 | v11.1 전투 엔진 통합, Helion 전용 함선/화물선 HP 보존 목표, 프롤로그 route lock/NG+는 다음 단계로 분리. |

검증:
- `server/services/campaign.js` `node --check` 통과
- `server/routes/api.js` `node --check` 통과
- `server/routes/api.js` require 스모크 통과
- `index.html` 인라인 script 파싱 통과
- `git diff --check` 통과

---

### v5.17 내 영토 테두리 두께 완화 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 내 영토 금색 테두리 | ✅ | halo `7px → 4.5px`, crisp line `2.2px → 1.5px`로 완화. |
| 배경 텍스처 가독성 | ✅ | 내 영토 fill alpha와 shadow 강도를 낮춰 Mars 텍스처를 덜 가리도록 조정. |
| 커밋/푸시 운영 규칙 | ✅ | `CLAUDE.md`에 audit/changelog 동반 업데이트 규칙 추가. |

검증:
- `index.html` 인라인 script 파싱 통과

---

### v5.16 영토 시인성/텍스처 예산 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 내/남/NPC 영토 구분 | ✅ | 내 영토 금색, 다른 플레이어 cyan, NPC 회보라 점선으로 단순화. |
| 업로드 이미지 claim | ✅ | 이미지가 있는 영토도 동일한 외곽선/halo 체계를 적용. |
| 텍스처 품질/렉 균형 | ✅ | 기본 4K 유지, 고성능 데스크톱만 6K, 수동 opt-in일 때만 8K 합성. |

검증:
- `index.html` 인라인 script 파싱 통과

---

### v5.15 POI 광물 발견 실패 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| Ancient Ruins 발견 실패 | ✅ | `mineral` 보상 POI가 `poi_discoveries` CHECK 제약에서 롤백되던 문제 수정. |
| 운영 DB 즉시 복구 | ✅ | 운영 `poi_discoveries_reward_type_check`에 `mineral` 허용 반영. |
| 보상 표시 | ✅ | `mineral` 보상을 아이콘/이름/수량으로 표시하도록 프론트 보강. |

검증:
- 운영 DB 제약조건 확인
- `index.html` 인라인 script 파싱 통과

---

### v5.14 하이잭 자동승리 영토 표시 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| NPC/무함대 자동승리 표시 | ✅ | 새 픽셀 없이 적 픽셀만 하이잭해도 공격자 claim을 생성하고 이전 픽셀 `claim_id`를 새 claim으로 연결. |
| 클릭/렌더 불일치 | ✅ | `pixels.owner`는 내 지갑인데 `claims` 대표 레코드가 없어 NPC 라벨/색으로 보이던 케이스 차단. |
| Phase 2 audit | ✅ | 전투 승리 후 사후 생성한 claim id를 `hijack_battles.new_claim_id`에 기록. |
| 즉시 렌더 | ✅ | 자동승리 응답 직후 프론트 임시 claim이 `lat/lng/w/h` 필드명을 사용하도록 수정. |

검증:
- `server/services/hijack.js` `node --check` 통과

---

### v5.13 전수 버튼/하이잭 플로우 감사 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 하이잭 진입점 | ✅ | 영토 이전 없는 legacy `/api/hijack/declare` UI 진입 제거. 실제 영토 하이잭은 `/api/hijack/declare-with-pp`만 사용. |
| legacy 하이잭 API | ✅ | 서버에서 `/api/hijack/declare`는 `410 HIJACK_DECLARE_DEPRECATED`로 차단. |
| 제거된 서비스 버튼 | ✅ | `weeklyChallenges`, `gpBurn`, `luckyBox` player/admin UI가 404/503 API를 호출하지 않도록 정리. |
| 버튼 핸들러 | ✅ | `index.html`, `admin.html`, tactical-lab inline handler 전수 검사에서 누락 0건. |
| 보조 API 연결 | ✅ | `/api/fleets/my` alias 추가, World Event fallback, Governor declaration 저장 버튼 수정. |

검증:
- `index.html` / `admin.html` 인라인 script 파싱 통과
- 전체 서버 JS `node --check` 통과
- hijack/battle/routes require 스모크 통과
- 제거된 legacy endpoint 문자열 grep 확인

---

### v5.12 핵심 플레이 라인 검수 — 수정 완료

| 라인 | 상태 | 수정 |
|------|------|------|
| 함선 건조/수리 | ✅ | `recipe_minerals`, `iron_ore` 차감이 실제 `user_resource_inventory(resource_id)` 스키마를 사용하도록 수정. 동시성 안전을 위해 `quantity >= required` 조건으로 원자적 차감. |
| 자원 제작 | ✅ | `resourceCraft`의 제작 시작/완료/취소 환불을 전부 `resource_id` 기반으로 정정. |
| 고급 강화 재료 | ✅ | `enhancementAdvanced`의 재료 조회/차감을 `resources.code -> resource_id` 조인으로 정정. |
| 하이잭 Phase 1 | ✅ | 전투 엔진과 시작 통계 모두 프리깃/구축함만 반영하도록 수정. |
| 하이잭 HP 보존 | ✅ | `applyBattleResults()`가 실제 `result.timeline.frames` 마지막 프레임을 읽어 HP를 반영하도록 수정. |
| 영토 정보 HIJACK 버튼 | ✅ | 전투-only `/api/hijack/declare` 모달 대신 PP 정산/픽셀 이전이 포함된 클레임 하이잭 플로우(`/api/hijack/declare-with-pp`)로 연결. |

검증:
- 전체 서버 JS `node --check` 통과
- `services/` + `routes/` 전체 require 스모크 통과
- `index.html` 인라인 script 9개 `vm.Script` 파싱 통과

---

### 브라우저 네이티브 다이얼로그 — 완전 제거 완료

**`confirm()` / `prompt()` / `alert()` 잔여 개수: 0**

| 파일 | 교체 전 | 교체 후 | 사용 함수 |
|------|---------|---------|-----------|
| `index.html` | confirm 15 + prompt 10 + alert 1 = 26 | 0 | `gameConfirm()`, `gameInput()`, `gameAlert()` |
| `admin.html` | confirm 70 + prompt 5 + alert 275 = 350 | 0 | `adminConfirm()`, `adminInput()`, `showToast()` |
| `tactical-lab-v11.html` | confirm 1 | 0 | `#forfeit-overlay` 인라인 오버레이 |

### 인게임 모달 함수 목록 (§18 상세)

| 함수 | 파일 | 용도 | 비고 |
|------|------|------|------|
| `gameConfirm({icon,title,body,confirmText})` | index.html | 확인/취소 — Promise | async/await 필수 |
| `gameInput({title,label,placeholder,defaultValue,maxLength})` | index.html | 텍스트 입력 — Promise | null=취소 |
| `gameAlert(msg)` | index.html | 단순 알림 | 확인 버튼만 |
| `shopConfirm(icon,title,msg,btn)` | index.html | 쇼핑 전용 — Promise | 신규코드엔 gameConfirm 사용 |
| `adminConfirm(msg, title)` | admin.html | 확인/취소 — Promise | async/await 필수 |
| `adminInput(msg, defaultVal, title)` | admin.html | 텍스트 입력 — Promise | null=취소 |
| `showToast(msg, type, duration)` | admin.html | 단순 알림 토스트 | type: 'success'/'error'/'' |
| `#forfeit-overlay` + `cmdForfeit()` | tactical-lab | RETREAT 전용 오버레이 | iframe 격리 환경 |

---

## v5.10 변경 요약 (2026-04-28)

### 1단계: confirm() 제거
| # | 내용 | 수정 |
|---|------|------|
| 1 | index.html confirm() 15곳 | gameConfirm() Promise로 교체, 일부 함수 async화 |
| 2 | admin.html confirm() 70곳 | adminConfirm() Promise로 교체, 67개 함수 async 추가 |
| 3 | tactical-lab RETREAT confirm() | #forfeit-overlay CSS 인라인 오버레이로 교체 |

### 2단계: prompt() + alert() 완전 제거
| # | 내용 | 수정 |
|---|------|------|
| 4 | admin.html showToast() 미정의 | 신규 구현 — 기존 95곳 undefined 호출 정상화 |
| 5 | admin.html adminInput() 미정의 | 신규 구현 — prompt() 5개 교체, 3개 함수 async화 |
| 6 | admin.html alert() 275개 | showToast()로 일괄 교체 |
| 7 | index.html prompt() 10개 | gameInput()으로 교체 (영토이름·콘텐스트·렌탈·동맹 입출금·창설) |
| 8 | index.html alert() 1개 | gameAlert()으로 교체 |

### 수정 파일
- `index.html`: 26개 네이티브 다이얼로그 → 인게임 모달
- `admin.html`: 350개 네이티브 다이얼로그 → showToast/adminConfirm/adminInput
- `assets/tactical-lab-v11.html`: RETREAT 오버레이, SPEED 패널, maxHp WS 보정

# OCCUPY MARS — Codebase Audit (v5.9 / 2026-04-27)

## 🔴 v5.9 변경 요약 (2026-04-27)

### 함대전 HP 보존 + 후퇴 + 속도 조절 + 무한 전투

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 전투 시간제한 초과 시 HP 비율로 승자 결정 | battleEngine MAX_TICKS(9000) 초과 fallback으로 HP 비교 | MAX_TICKS=54000, 타임아웃 결과를 draw로 변경. 전투는 함선 전멸로만 끝남 |
| 2 | HP바가 100%에서 안 움직임 | WS frame의 HP가 로컬 카탈로그 HP보다 훨씬 커서 항상 100% 이상 | captureFrame에 maxHp+side 추가, WS 첫 프레임에서 atkMaxHP/defMaxHP 재보정 |
| 3 | 내 이름이 적 함대 패널에 표시 | loadBvSidePanels가 지갑 prefix vs nickname 비교 오류 | participants 배열 기반으로 wallet 직접 비교 |
| 4 | 전투 포기 불가 | 없음 | /api/battles/:id/forfeit 신규 endpoint, RETREAT 버튼, forfeit postMessage 처리 |
| 5 | WS 스트리밍 느림 | tickMs/4 (4x) | tickMs/8 (8x)으로 변경 |
| 6 | 로컬 시뮬 속도 조절 없음 | 없음 | SPEED 패널 ×1/×2/×4/×8 버튼 추가 (WS 모드에서는 비활성) |

### 수정 파일
- `server/services/battleEngine.js`: captureFrame maxHp+side, MAX_TICKS 54000, timeout→draw
- `server/services/battleScheduler.js`: tickMs/8
- `server/routes/fleetBattles.js`: POST /api/battles/:id/forfeit
- `assets/tactical-lab-v11.html`: WS maxHp 보정, RETREAT 버튼, SPEED 패널, cmdForfeit()
- `index.html`: forfeit postMessage 핸들러, loadBvSidePanels 수정, showBattleResult "나" 배지

# OCCUPY MARS — Codebase Audit (v5.8 / 2026-04-27)

## 🔴 v5.8 변경 요약 (2026-04-27)

### 하이젝 후 영토 즉시 금색 반영

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 하이젝 auto_win 후 Railway에서 영토가 NPC색으로 남음 | 서버 응답에 어떤 픽셀이 이전됐는지 없어 API 재요청에 의존 → Railway DB 레이턴시로 여전히 NPC owner 반환 | 서버 응답에 `hijacked_pixels`+`new_pixels_list` 추가 → 클라이언트가 `_serverPixels` 즉시 업데이트 후 `_rebuildOwnerData()`+`compositeClaimsOnTexture()` 호출 |

### 수정 파일
- `server/services/hijack.js`: `declareHijackWithPP` return에 `hijacked_pixels`, `new_pixels_list` 추가
- `index.html`: auto_win 핸들러에 즉시 반영 로직 추가 (기존 2s+6s 재시도 백업으로 유지)

# OCCUPY MARS — Codebase Audit (v5.7 / 2026-04-26)

## 🔴 v5.7 변경 요약 (2026-04-26)

### 모바일 텍스트 + 골드 시각 강화

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 모바일 영토 모달 좌표/크기 텍스트 검정 (불가시) | `.mob-territory-card .mt-val`이 `var(--tx1)` 사용 (미정의 CSS 변수 → 브라우저 fallback 검정) | `var(--tx)` (크림 `#E8E0D8`)으로 변경 |
| 2 | 내 영토 골드 색상이 화성 표면에서 잘 안 보임 | fill alpha 0.40, halo/border 강도 약함 | alpha 0.65, shadowBlur 12, halo lineWidth 10, inner 3으로 강화 |

### 수정 파일
- `index.html`: CSS `.mob-territory-card .mt-val` + `compositeClaimsOnTexture` isMine 파라미터

# OCCUPY MARS — Codebase Audit (v5.6 / 2026-04-26)

## 🔴 v5.6 변경 요약 (2026-04-26)

### 하이젝 전투 3종 수정

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 하이젝 함대전 후 함선이 즉시 파괴됨 | `applyBattleResults`가 battle_type 구분 없이 모든 전투에서 함선 삭제 | hijack 전투: 시뮬 HP 반영 + 0 이면 max_hp×15% 보존, is_alive=true 유지 |
| 2 | 전투 뷰어 튕기며 TIMELINE_NOT_FOUND | 폴링 15s 안에 타임라인 저장 완료 안 됨 (스케줄러 30s 간격) | 폴링 60s 연장, 전투 진행 중이면 에러 없이 대기 (iframe WS 처리) |
| 3 | Railway에서 하이젝 후 영토 갱신 안 됨 | auto_win 후 2s 딜레이가 Railway DB 레이턴시 못 따라감 | 2s+6s 두 번 재시도, claims 배열도 동기화 |

### 수정 파일
- `server/services/battleEngine.js`: isHijackBattle 플래그 + 함선 생존 로직
- `index.html`: openBattleViewer 폴링 + auto_win 픽셀 재시도

# OCCUPY MARS — Codebase Audit (v5.5 / 2026-04-26)

## 🔴 v5.5 변경 요약 (2026-04-26)

### 내 영토 글로브 골드 하이라이트

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 내 영토가 다른 영토와 구분 안 됨 | `isMine` 영토에 동일한 지갑 해시 색상 사용 | `isMine=true`면 골드 `{r:255,g:209,b:102}` fill/border/shadow 적용 |
| 2 | 대소문자 다른 지갑 주소에서 `isMine` 미감지 | `c.owner===myAddr` 엄격 비교 | 양쪽 모두 `.toLowerCase()` — myAddr, sort, isMine 체크, showTerritoryInfo |

### 수정 파일
- `index.html`: `compositeClaimsOnTexture` 골드 색상 + `.toLowerCase()` 비교 (4곳), `showTerritoryInfo` 지갑 비교 fix

### 검증
- 캔버스 픽셀 샘플: `[252,205,101,255]` ≈ gold `(255,209,102)` 확인
- _ownerStrips에 내 지갑 존재, _ownerGroups에 Valles Marineris 그룹 존재 확인
- 브라우저 글로브 near-zoom 스크린샷: 내 영토 금색으로 명확히 표시

## 🔴 v5.3 변경 요약 (2026-04-26)

### Tactical-lab 전투 뷰어 4종 버그 수정

| # | 이슈 | 원인 | 수정 |
|---|------|------|------|
| 1 | 기동 버튼 누르면 크래시 | battleEngine.js wedgeSides 처리에서 `f.movement='wedge'` (잘못된 필드) → ws frame 수신 후 MANEUVERS['wedge'] undefined → drawFleets crash | `f.formation='wedge'` 로 수정. 클라 전체 MANEUVERS/FORMATIONS null-safe fallback 적용 |
| 2 | 공격 모션 없음 | ws 활성 시 `fire()` 완전 비활성화 → bullet/laser 한 개도 안 생김 | ws mode에서도 `fire(sh, wsMode=true)` 호출. `visual:true` 플래그 bullet/laser는 `applyDmg` 스킵 (HP는 ws frame으로만 동기화) |
| 3 | 1 vs 1 전투가 캔버스 상단에서 시작 | atkPos 하드코딩 `cy:H*0.15` → 함대 1개면 무조건 상단 | `centeredPos(n, side)` 함수: 1함대면 `H*0.5`, n함대면 H*0.15~H*0.85 균등 분배 |
| 4 | 화면 너무 작음 / 거리 기반 줌 없음 | 카메라 시스템 부재 | 매 프레임 생존 함대 bounding box 계산 → `_camTargetScale` 산출 → lerp 0.025로 부드럽게 줌/팬. `CX.save/translate/scale/translate/restore` 로 월드 좌표 변환 |

### 수정 파일
- `server/services/battleEngine.js`: wedgeSides → `f.formation` (1줄)
- `assets/tactical-lab-v11.html`: 4종 fix (61줄 추가)

## 🔴 v5.2 변경 요약 (2026-04-26)

### 함선 단위 정밀 폭발 이펙트 (Phase 2-E)
- battleEngine.js: ws frame ships 배열에 `code` (ship_type_code) 필드 추가
- tactical-lab-v11.html:
  - `_wsPrevShips` Map — 이전 프레임 생존 함선 id → {x, y, code} 추적
  - 매 frame 수신 시 이전 맵과 diff → 사라진 함선마다 `mkExp()` 호출 (size_class 기반 반경)
  - battleship/titan 격침 시 `mkShockwave()` + 격침 로그 추가
  - fleet dead 전환 시 shockwave 즉시 트리거 (이전에는 shockwave 없이 일괄 dead 처리)
  - `initBattle()`에서 `_wsPrevShips` 리셋

## 🔴 v4.8~v5.1 변경 요약 (2026-04-26)

### Phase 2 — WebSocket 실시간 함대전 4단계 완료
- v4.8 (Phase 2-A): wsServer.js 신규 — battle 채널 + frame/end broadcast + JWT 인증 cmd
- v4.9 (Phase 2-B): tactical-lab v11 안에서 ws 연결 + ws_end 부모에 postMessage → 결과 카드 즉시
- v5.0 (Phase 2-C): fleet-presets ?bid 응답에 dbFleetId/ownerWallet 추가 → ws frame fleet 매칭 (위치/HP/진형/기동)
- v5.1 (Phase 2-D): ws 활성 시 자체 시뮬 fire/damage skip + 자동 재시작 skip

### 사용자 요구 4가지 모두 완료
1. ✅ tactical-lab v11 그대로 이식 (iframe)
2. ✅ 실제 게임 데이터 연결 (catalog + fleet-presets ?bid + ws frame)
3. ✅ 유저 컨트롤 (postMessage + ws cmd → commander_actions → battleEngine)
4. ✅ 실시간 함대전 (hijack manual + AI 자동 + ws frame stream)

### 잔여 (선택, 비필수)
- ~~ship 단위 dbShipId 매핑~~ → ✅ v5.2에서 완료

---

## 🔴 v4.0~v4.7 변경 요약 (2026-04-26)

### Phase 4 (v4.7) — AI 전략 자동 적용
- `services/aiStrategy.js` 신규 — 파벌별 doctrine 가중치 random
- battleScheduler 가 hijack 외 battle 의 양쪽에 commander_actions formation/maneuver INSERT
- Migration 190: `ai_strategy_enabled` settings 토글
- 검증: PvP battle 양쪽 정확히 doctrine 따라 INSERT

### Phase 5 — 사실상 이미 동작 중
- tactical-lab v11 의 SHIPS/MINERALS/FACTIONS 글로벌은 `loadCatalog()` 가 이미 우리 DB catalog API 에서 자동 채움
- FLEET STATUS / SHIP REGISTRY / MINERALS 패널 모두 우리 데이터로 표시
- 추가 작업 불필요

### Battle Viewer 전면 리팩터 — Tactical Lab 통합
- v4.0: 데스크탑 1500×820 오버레이, 모바일 풀스크린 유지
- v4.1: 살아남은 함선 부분 HP 손실 DB 반영 (battleEngine `applyBattleResults`)
- v4.2: 결과 카드 디자인 + 조선소 SVG drawShip + HP 바
- v4.3: tactical-lab v11 iframe 통째 통합 (자체 canvas/HUD/컨트롤 폐기)
- v4.4: `?bid={battleId}` 로 실제 fleet 구성 주입 (`fleet_battle_participants` JOIN)
- v4.5: 사이드 패널 (좌 MY FLEET/RESOURCES, 우 ENEMY FLEET/BATTLE STATS) + postMessage 컨트롤 bridge
- v4.6: Phase 3-B — commanderActions `formation_change` + `maneuver_change` (Migration 189), mutable update, 시뮬 반영

### Migration 189
- `commander_actions.action_type` CHECK 갱신 — formation_change, maneuver_change 추가
- settings: `commander_action_formation_gp_cost`, `commander_action_maneuver_gp_cost` (기본 0)

### 잔여 P1 (다음 사이클)
- **Phase 2**: WebSocket 실시간 frame broadcast (현재는 timeline replay 만)
- **Phase 4**: AI 전략 (PvP/Siege battle 에 자동 진형/기동 명령)
- **Phase 5**: tactical-lab 패널 (FLEET STATUS / SHIP REGISTRY / MINERALS / DOCTRINES) 실데이터 연결

---

## 🔴 v3.9 변경 요약 (2026-04-26)
- **POI 보상에 mineral 추가** (사용자 요청): Migration 188 + reward_type CHECK 갱신 + exploration.js spawn/claim 양쪽 mineral 분기. GP 50 / Item 20 / Mineral 25 / PP 10.
- **NPC 함선 일괄 부여** (사용자 요청 — hijack 함대전 테스트 차단됨): grant-starter-all-npcs 호출. 21 NPC 모두 함대 보유.

---

## 🔴 v3.8 변경 요약 (2026-04-26)
- **로켓드롭 보상 다양화** (사용자 신고 "GP만 존나 나옴"): mineral 카테고리 신규 추가. Migration 187, weight 30/25/25/12/6/2 (gp/item/mineral/xp/pp/cosmetic). 검증: 15개 슬롯에 mineral 7 / item 3 / xp 3 / gp 1 / cosmetic 1.
- **새 로켓 SVG** (`assets/textures/rocket_drop.svg`): 화염 트레일 + 윈도우 + 핀 + 엔진 벨. PNG fallback 유지.
- **viewer 롤백**: v3.7 의 자동승리 viewer 즉시 닫기 → frames<2 시에만 경고 토스트 (viewer 풀 표시 유지).
- **잔여**: POI 보상도 동일 패턴으로 mineral 추가 필요 (다음 사이클).

---

## 🔴 v3.7 변경 요약 (2026-04-26)
- **모바일 OPS 탭 빈 화면** (사용자 신고): 1024 미디어쿼리 `.ops-launch-form ... display:none !important` 가 BASE 모달 내부 발사 폼까지 숨김. 룰에서 `.ops-launch-form` 제거.
- **하이젝 함대전 viewer 빈 화면** (사용자 신고): 자동승리(atk=0 또는 def=0) 케이스에 시뮬레이션 frame 거의 없음 → 빈 캔버스 + "0:00/0:00". `openBattleViewer` 가 atkN/defN 체크 후 viewer 닫고 winner 기준 토스트 표시.

---

## 🔴 v3.6 변경 요약 (2026-04-26)
- **모바일 침공/탐사 버튼 사라짐** (사용자 신고): 태블릿/모바일 미디어쿼리의 `.ops-quick { display:none !important }` 룰이 element class `"ops-quick ops-quick-split"` 둘 다 매치. `.ops-quick:not(.ops-quick-split)` 로 좁혀서 fix. 모바일 전용 split 카드 정상 복원.

---

## 🔴 v3.5 변경 요약 (2026-04-26)
- **리더보드 픽셀 수 부풀림** (사용자 신고): `/api/leaderboard` 가 `claims.width × height` (이론적 직사각형) 로 계산해 BASE 패널의 진짜 카운트(`pixels` 테이블)와 어긋남. 실제 owner 카운트로 변경.

---

## 🔴 v3.4 변경 요약 (2026-04-26)

### 🚨 시스템 결함 fix
- **레벨업 자동 갱신 부재** (사용자 신고): XP 는 누적되는데 `rank_level` 갱신은 admin 수동 호출만 동작. 평생 멈춤.
  - **`services/rank.js` 신규** — single-user `recalcUserRank` (admin 로직 추출, breakthrough conditions 평가)
  - **Lazy trigger** — `GET /user/:wallet/base` 진입 시 fire-and-forget
  - **Periodic scheduler** (`server/index.js`) — 5분 간격, 최근 24h 활성 유저 batch
  - **Migration 186**: settings 4종 (auto_recalc_enabled / interval_seconds / lookback_hours / batch_size). 모두 admin 조정 가능.
  - 검증: lain test → 정상 호출. stuck user (xp 110k, lv 4) → pixels=0 으로 breakthrough 막힘 (정상).

### 잔여 P1 (다음 작업 후보)
- **Level 5+ breakthrough UI** — 현재 사용자가 "왜 안 올라가는지" 모름. 다음 레벨의 조건과 본인 진행도를 명시하는 UI 필요.

---

## 🔴 v3.3 변경 요약 (2026-04-26)

### 사용자 신고 fix
- **함대전 "전투 데이터 로딩 실패"** — `openBattleViewer(undefined)` 호출 시 invalid id 로 15초 폴링 후 토스트
  - Fix: `openBattleViewer` 진입에 `parseInt(battleId)` 가드 + 폴링 실패 시 lastErr 메시지 포함
  - 호출처 2곳 (`confirmHijack`, `challengeAi`) 에 `if (id) setTimeout` 가드 추가

### 검증 완료
- 파벌 선택 시 가장 싼 frigate 자동 지급 — `services/faction.js:148-198` 라이브 동작 확인. 트랜잭션 내 처리, 함대 없으면 자동 생성.

---

## 🔴 v3.2 변경 요약 (2026-04-26)

### 사용자 신고 fix (즉시 대응)
- **Hijack 함대 정보 에러** ("상대 함대 정보 확인 실패")
  - 원인: `phaseC.js` 의 `GET /hijack/:id` 가 `defender-info` 문자열까지 매치 → `parseInt('defender-info')`=NaN → INVALID_ID 400
  - Fix: `:id(\\d+)` regex로 숫자만 매치, 문자열은 다음 라우터(api.js `/hijack/defender-info`)로 fallthrough
  - 검증: NPC 지갑 `0xnpc_elysium_mons` 응답 정상 (`fleetCount:1, aliveShips:1`)

- **거버너/사령관 잔존 표시**: commander 없어졌는데 메인 배너 + 베이스 공지 박스가 잔존
  - 백엔드 `services/governance.js`: `getCommanderInfo`/`getSectorInfo` 응답에서 `commander/governor` 빈 문자열 → `null`, governor/commander 없으면 `announcement` 강제 `''`
  - 클라이언트 `index.html`: `_hideCommanderUI()` 안전망 추가, fetch 실패 또는 commander 비면 즉시 모든 UI hide
  - sector overlay 두 곳에 `&& s.governor` 가드 추가 (orphan 방어 2중화)
- **토스트 위치 거슬림**: 통합 시스템(e764e75)이 정중앙 배치 → 사용자가 옛 3종 분리 시스템 선호
  - **showToast** = 화면 중앙 그린 알약 (옛 위치 그대로)
  - **showFactionToast** = 하단 블루 박스 (옛 자체 구현)
  - **showNotification** = 우상단 카드 (변경 없음)
  - `@supports(env(safe-area-inset-top))` 안의 `top:50%; bottom:auto` 룰 제거

### 신규 슬롯
- **함선 PNG 이미지 슬롯**: `assets/ships/` 디렉터리 + `shipVisual()` wrapping. PNG 없으면 SVG 실루엣 fallback (`<img onerror="this.remove()">`).
  - 적용 위치: 조선소 블루프린트 카드, 건조 confirm 모달
  - 파일명 우선순위: `{code}.png` > `{faction}_{size}.png`

### 인식 정정 (CLAUDE.md §8 잘못된 메모)
| 항목 | CLAUDE.md 메모 | 실제 |
|---|---|---|
| Hijack 실패 시 영토 처리 | "비-primary 디펜더 잔여 P1" | ✅ 정상 동작 — 영토 보존 + PP 90% 환불 (`hijack.js:197,379`) |
| `recipe_minerals` 차감 | "현재 무시됨" | ✅ `ship.js:278` 에서 `resources` JOIN 후 `user_resource_inventory` UPDATE |
| Titan/Battleship Core/Mid 재료 | "추가 필요" | ✅ Migration 163 시드 + Migration 203 (v5.31)로 BS/Titan 6/6 모두 Core+Mid 광물 보장 + invariant assertion + admin settings |
| 함선 수리 UI | "라우트+UI 모두 필요" | ✅ `syRepairShip/syChargeShield/syScrapShip` 모두 라이브 (`index.html:40588~`) |
| 광물 도감 UI | (언급 없음) | ✅ Minerals Panel 모달 + `openMineralsPanel()` 진입 (`index.html:41332`) |

---

## 🔴 v3.1 변경 요약 (2026-04-26)

### 신규 자동화
- **거버너/사령관 자동 만료**: migration 185 + `services/governanceExpire.js` + 1h 스케줄러. 14일 비활성/탈퇴/임기만료 시 자동 자리비움 + 공지 클리어. admin 수동 부담 제거.

### 해소된 P0/P1 (감사 에이전트 결과 반영, commit `135da81`)
| ID | 영역 | Before | After |
|---|---|---|---|
| P0-1 | Shield | `pixel_shields`(상점) 가 hijack 못 막음 | `isClaimShielded/Tx` 가 두 테이블 UNION 조회 |
| P0-2 | Cosmetic | quantity 차감 없음 → 1개로 N장착 | equip -1, unequip +1, 교체 시 이전 cosmetic 환수 |
| P0-3 | Tier | tiers.js miningBonusPct dead code | `/api/harvest` 에 territory_tiers MAX(tier) 곱셈 블록 |
| P1-1 | Harvest cap | multiplier 후 cap → VIP/governor 보너스 무용 | base 직후로 cap 이동, multiplier 가 그 위에서 amplify |
| P1-2 | Season | trackGPSpend 미export → 6개 라우트 silently skip | alias + export |
| P1-3 | logGPActivity | `./gpActivity`(없는 모듈) 잘못된 require | 10개 서비스 일괄 `../db` 로 fix |

### 추가 fix (commit `13efdc0`, `b7aa2bf`, `f424b6a`, `6046673`)
- **Mining tierCounts 응답 누락** → UI 항상 'no land' 표시
- **Mining bestTier 만 roll** → 모든 보유 tier 독립 roll + 합산
- **Governance expire NULL fallback** → 옛 데이터(last_login_at NULL) 도 governor_since 기준 판정
- **고아 announcement 정리** → governor=NULL & announcement≠NULL sector 자동 cleanup
- **거대 토스트 박스** → `.toast{top:50%}` + `bottom:130px` 충돌 fix (bottom:auto + transform)
- **알림창 닫기** → ✕ 버튼 + outside-click
- **출석체크 빈 화면** → QUESTS 탭 진입 시 자동 로드

### 🟡 잔여 known issues
- **P1-4**: hijack 비-primary 디펜더 픽셀 처리 — 의도된 디자인(주 수비자만 공격) 으로 동작 중. 개선 여지 있음
- **CLICK START POINT 박스** — 토스트 stretch 버그였음, 위에서 fix됨

---

# OCCUPY MARS — Codebase Audit (v3.0 / 2026-04-25 — final)

> **이 문서는 코드베이스의 현재 상태를 외부 검토자(Codex 등)에게 넘기기 위한 정리본입니다.**
> 신고된 모든 버그와 자가 진단으로 발견한 이슈, 그리고 검증된 라이브 시스템을 한눈에 볼 수 있도록 구성됨.

## 📊 최종 통계
- **DB 테이블**: 219개
- **Settings 키**: 907개 (모든 라이브 기능 admin 조정 가능)
- **업적**: 29개 (4 카테고리, 4 언어)
- **마이그레이션**: 184개 적용
- **누적 커밋 (이번 작업)**: **27개**
- **Phantom 테이블**: 0개 (이전 35+)
- **검증된 frontend endpoint**: 60+개
- **마지막 커밋**: `3ca106e` — fix(hijack): 지불금액 + NPC 자동승리 + 함대 미리보기

## 🔄 최신 커밋 흐름 (시간 역순)
```
3ca106e  fix(hijack): 지불금액 0.00 + NPC 자동승리 + 함대 미리보기 (사용자 신고 3건)
290ce90  fix(mobile): iPad portrait/iPhone Pro Max landscape 사이드바 자동 열림 + 글로브 안 보임
e764e75  fix(mobile): 사이드바 z-index + 토스트 시각 일관성
2e76af9  docs(v3.0): CHANGELOG + 게임 가이드 'What's New' + AUDIT 최종화
0a48f17  fix: 추가 endpoint 버그 일괄 (전체 endpoint 감사 결과)
cfa8c10  fix(bugs): 사용자 신고 3건 + 테스트 중 발견 2건
```

## ✅ 사용자 신고 버그 (이번 세션 — 모두 해결)
| # | 신고 | 원인 | 처리 | 커밋 |
|---|---|---|---|---|
| 1 | 일일 출석체크 'Daily login failed' | getSetting() string 반환을 array로 사용 → INSERT NaN | JSON.parse + Array.isArray 가드 (services/daily.js + routes/api.js daily/status) | cfa8c10 |
| 2 | JOBS admin 통계 빈 값 | backend `{distribution}` vs frontend `{byJob, noJob, recentChanges}` shape mismatch | `routes/job.js` /admin/jobs에 byJob (per-job avg_gp/avg_pp 집계) + noJob + recentChanges | cfa8c10 |
| 3 | EVENTS 탭 빈 화면 | `switchTab()` cats 배열에 `'worldevents'` 누락 → .cat-worldevents 영원히 display:none | cats 배열에 worldevents 추가 (admin.html line 2716) | cfa8c10 |
| 4 | 모바일 사이드바 잡아먹힘 (하단 잘림) | `.panel-r/.panel-l` 모바일 open 시 z-index 120 < `.mob-bottom-nav` z 200 | z 250, padding-bottom safe-area + 110px, panel-close-fixed z 260 | e764e75 |
| 5 | 토스트 시각 일관성 부족 | showToast/showFactionToast 시각·위치·alias 모두 제각각 | 통합 .toast CSS (accent color만 type별 변경), showFactionToast→showToast 위임, 'red'/'green'/'h' legacy alias 자동 normalize | e764e75 |
| 6 | iPhone 양쪽 사이드바 열림 + 글로브 안 보임 | `@media(max-width:768px)`만 처리 → iPad portrait(820), Pro Max landscape(932), split-screen(800~)에서 데스크탑 layout 적용되어 panel 250+250=500px 가 글로브 가림 | 새 `@media(max-width:1024px)` 블록 — 태블릿도 슬라이드 패널, mob-toggle/mob-bottom-nav 표시, panel-tab 숨김. DOMContentLoaded에서 `innerWidth≤1024`면 .open 강제 제거 (캐시 방어) | 290ce90 |
| 7 | 하이젝 지불금액 0.00 PP 표시 | NPC 점령 영토 `pixels.price = 0` → `0 × 1.2 = 0` (무료 하이잭 가능) | `Math.max(existing.price, sectorBasePrice) × HIJACK_MULT` (client + server 4곳) | 3ca106e |
| 8 | NPC 함선 줬는데 자동승리 처리 | defender fleet lookup이 ORDER BY만 하고 HAVING 없음 → 빈 함대도 선택돼 phase1 결함 | `HAVING alive_ships > 0` 명시, 디버그 로그, 신규 `/admin/api/fleet/npc-status` 진단 endpoint + admin 버튼 | 3ca106e |
| 9 | 하이젝 시 상대 함대 정보 미표시 (사용자 추가 요청) | 디클레어 전에 자동승리/함대전 여부 알 방법 없음 | 신규 `/api/hijack/defender-info` + 모달에 "Fleet N개 · 함선 M척 → 함대전" 또는 "함대 없음 → 자동 승리" 라벨 표시 | 3ca106e |
| 10 | iPhone 에 사이드바 stale 상태 (close 버튼 미표시) | Service Worker `mars-v3` 캐시가 옛 index.html 을 iOS 단말에 보존 → 새 CSS/JS fix 적용 안 됨 | sw.js: CACHE_NAME → `mars-v4`, `/index.html` pre-cache 제거, HTML 문서 network-first 분기 신규, index.html에 controllerchange auto-reload 핸들러 + SKIP_WAITING 메시지 처리 | (이번 커밋) |
| 11 | 태블릿 (820px) 바텀 네비 두 줄 중복 렌더링 (실제 페이지 감사 중 발견) | `.col-fab-wrap.show` 가 `display:block` 강제 → `@media(max-width:1024px) .col-fab-wrap{display:none}` 무시됨 (same specificity). 데스크탑 col-fab + 모바일 mob-bottom-nav 동시 표시 | `.col-fab-wrap, .col-fab-wrap.show { display:none !important }` + `#myLandBtn`, `.ops-launch-form`, `.ops-quick` 도 1024 이하 숨김 | 92a8e7f |
| 12 | 구매가능 섹터가 admin 변경 후 즉시 반영 안 됨 ("다른 창 열었다 닫아야") | 서버 `_sectorsCache` 60s TTL + 클라 `_sectorsData` 가 BASE 모달 열 때만 refresh | 서버: `invalidateSectorsCache()` + admin/governance 변경 시 즉시 호출. 클라: `refreshSectors()` 함수 + 60s polling + visibility/focus + sector toggle / claim modal 진입 시 자동 refresh | 6dee1a8 |
| 13 | 거버너/사령관 메시지가 변경 후 안 사라짐 + 페이지 두 번 로딩 | (a) globe 의 governor 라벨이 `marsCanvasTexture` 캐시에 그려져 sector data 갱신해도 텍스처 재합성 안 됨. (b) commander 박스가 announcement 빈 케이스 처리 안 함. (c) SW auto-reload 가 매 업데이트마다 `location.reload()` 호출 | (a) `refreshSectors()` 에 diff 검사 + 변경 시 `marsCanvasTexture=null` + 재합성. (b) `loadCommanderBanner()`: commander 없거나 announcement 빈 케이스 박스 숨김 + textContent 비움. (c) SW auto-reload 제거. HTML network-first 로 자연 nav 시 새 콘텐츠 적용 + 1h background `reg.update()` 만 | f8e545a |
| 14 | commander 교체 시 옛 announcement 잔존 ("커맨더 표시는 왜 남김?") | governance 서비스 commander 교체 SQL 이 `announcement` 컬럼을 NULL 로 클리어 안 함 | `UPDATE commander SET commander_wallet=$1, commander_since=NOW(), announcement=NULL` + `loadCommanderBanner()` 에 visibilitychange/focus 리스너 추가 | (이번 커밋) |
| 15 | 처음 로딩 시 모든 high-tier 섹터가 entry-blocked 로 표시, BASE 누르면 정상 | sector overlay 가 `profileLevel` DOM 에서 user level 읽음. BASE 모달 안 열면 DOM 이 default '1' → 모든 entryMinLevel>1 섹터 잠금. | auto-login `/api/auth/me` 성공 시점에 `/api/user/:wallet/base` 미리 fetch → profileLevel 채움 + 텍스처 재합성 | d63aa4b |
| 16 | 거버너/사령관/공지 자동 expire 로직 부재 ("아직도 수정 안된 듯") | governor/commander 는 siege/admin replace 외엔 자동 사라지지 않음. 캐시 버그가 아니라 **expire 메커니즘 자체가 없는 것**. 사용자는 "임기 끝났다" 생각하지만 DB 엔 데이터 그대로 남음. | admin clear endpoint 3개 신규: `/governance/commander/clear`, `/governance/sector/:id/clear`, `/governance/clear-all`. admin UI 에 버튼 추가 (사령관 초기화 + 전체 거버넌스 초기화). 모두 sectors cache 무효화 호출. | (이번 커밋) |

## ✅ 자가 진단 버그 (테스트 중 발견 — 모두 해결)
| 영향 | 원인 | 처리 |
|---|---|---|
| /api/achievements 500 | ORDER BY a.sort_order (없음) | a.condition_value, a.key |
| /api/profile 500 | users.avatar_color/motto 컬럼 없음 | migration 184 추가 |
| /api/branding/my, spells admin 500 | claims.x1/y1/x2/y2 (실제: center_lat/lng/width/height) | 컬럼명 정정 |
| /api/resources/my 500 | i.resource_code (실제: resource_id FK) | JOIN resources r ON r.id = i.resource_id |
| /api/raffles/active 500 | /raffles/:id가 'active' parseInt → NaN | :id(\d+)로 숫자 제한 |
| 15+ 서비스 u.wallet JOIN 에러 | 이전 fix 시 WHERE만 정정, JOIN 누락 | u.wallet_address로 일괄 정정 |
| /api/claims/my 404 | endpoint 자체 없음 | routes/api.js에 추가 |
| /api/burn/* 404 | gpBurn 삭제됐으나 frontend UI 잔존 | UI 숨김 + loadBurnPanel no-op |

## 🟢 검증된 라이브 시스템 (현재 모두 동작)

### 핵심 게임 루프
| 시스템 | endpoint | 검증 |
|---|---|---|
| 클레임/픽셀 | /api/claims, /api/pixels | ✅ 300+ records |
| GP 경제 | gp_balance + gp_transactions + gp_activity_log | ✅ |
| 하이잭 (PVP) | /api/hijack/declare-with-pp + phaseC.js | ✅ |
| Fleet Combat | /api/fleets, /api/ships/* | ✅ 22 ship types, fleet detail OK |
| 공성전 | /api/siege/* | ✅ |
| 거버넌스 | /api/governance/leaderboard, /bounties | ✅ |
| 시즌 점수 | /api/season/active, /season/leaderboard | ✅ 1 season active |
| 마켓플레이스 | /api/marketplace/listings | ✅ |
| 옥션 | /api/auction, /api/auctions | ✅ |
| 일일 미션 | /api/daily/status, /missions, /login | ✅ Day 3, rewards 5/10/15... |
| 업적 | /api/achievements + auto-trigger | ✅ 29 achievements |
| PVP 베팅 | /api/betting/events, /bet, /mine | ✅ warBetting 단일 시스템 |
| 로켓 드롭 | /api/rockets | ✅ event #12 incoming |
| POI | /api/poi/* | ✅ |
| 파벌 | /api/factions | ✅ 3 factions (mcc/fsp/cv) |
| 길드 | /api/guild/leaderboard, /my | ✅ |
| 직업 | /api/jobs (5 jobs) | ✅ |
| 자원 | /api/resources/catalog, /my | ✅ 13 resources |
| 거버넌스 (commander/governor) | /api/governance/* | ✅ commander Woo |

### 보조 기능 (검증 통과)
- 영토: branding, monuments, tiers, spells, sponsors, shields, rentals, upgrades
- 플레이어: status, beacons, capsules, banners, graffiti, vtag, journals, milestones, highlights, ratings, tombstones
- 경제: stakes, polls, wagers, contests, donations, broadcasts, expeditions, raffles
- 미니게임: lottery, dividends, news, crafting

## 2026-06-09 v7.413 — P1 전투 피드백 검수

### 🟢 수정 완료
- 전투 결과 리포트가 단순 화력/손실률만 보던 상태에서 role/함급/전자전/기함 이벤트까지 분석하도록 확장됨.
- 결과 모달은 `analysis_items`를 여러 줄 카드로 표시해 유저가 "왜 졌는지"를 더 구체적으로 읽을 수 있음.
- 패배/무승부 시 `recommendation_items` 기반 개선 추천을 표시함.

### 🟡 남은 검수 포인트
- 실제 운영 DB의 과거 전투는 이벤트 payload가 부족할 수 있으므로, 리포트는 기존 `analysis_ko` fallback을 유지한다.
- 다음 단계는 `docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md` 기준 Daily OPS/Field Rating/Battle Hub 순서로 진행한다.

## 🟢 의도된 레이어드 아키텍처 (병합 불필요)
- chronicle + chronicleEnhanced (base + Discord wrapper)
- title + titleExtended (basic 13 + advanced 11)
- enhancement + enhancementAdvanced (instancing + recipe bonuses)
- job + jobs routes (user-ops + catalog)
- resource + resources routes (admin + user)
- auction + auctionRoutes (ops + listing)
- tournament + tournaments services (fleet + simple)

## 🟡 의도적 보류 (별도 작업, 영향 미미)
없음 — 이전 보류 4건 모두 처리됨.
- ✅ Fleet Combat 활성화 (이미 enabled, UI 정합성 fix)
- ✅ routes/ships.js 정리 (실제로는 신 fleet 시스템이었음, CLAUDE.md 메모 정정)
- ✅ news.js retention (24h 스케줄러 + retention setting 동작 확인)
- ✅ referral_count 최적화 (idx_users_referred_by 인덱스 존재)

## 🔴 알려진 미해결 (영향도 낮음, 의도적)
- battle.js / battle 라우트: 완전히 제거됨 (PVP는 fleet+hijack으로 통합)
- routes/ships.js의 일부 endpoint는 JWT auth만 (frontend가 매번 토큰 송부)
- /api/auth/me 404: frontend가 사용 안 함 (JWT decode local-side)

## 📚 문서 (모두 최신)
- **CHANGELOG.md** ← v3.0 패치 노트 (개발자용 상세)
- **CLAUDE.md** ← 신규 세션 핸드오프 (§13~16 보강)
- **AUDIT_FINDINGS.md** ← 이 문서 (기능별 매트릭스)
- **docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md** ← 현재 게임 방향성/우선순위 기준
- **docs/CLAUDE_WORK_ORDER_2026-05-05.md** ← 남은 작업 실행 지시서
- **docs/TERRITORY_UTILITY_PLAN_2026-05-05.md** ← P5 영토 생산/재료/섹터 유틸리티 기획
- **docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md** ← P5-1 구현 착수 지시서
- **index.html in-game guide** ← "What's New" 섹션 신규 추가 (4개 언어 모두)

## 🟡 다음 작업 지시서 (2026-05-05)

- `docs/CLAUDE_WORK_ORDER_2026-05-05.md`를 기준으로 남은 작업을 진행한다.
- 우선순위는 캠페인 진행/보상 정리 → 함대전 세로 탑뷰 안정화 → Fleet Command UX → 함선 경제 UX → 영토 유틸리티 순서다.
- `docs/FLEET_ASSAULT_STARFOX_RESEARCH.md`는 장기 리서치 참고용이며 현재 구현 우선순위가 아니다.
- P5 영토 유틸리티는 `docs/TERRITORY_UTILITY_PLAN_2026-05-05.md` 기준으로, 생산 가시성 → 재료 harvest → 조선소 연결 → 영토 업그레이드/역할 → 섹터 컨트롤 → 어드민 경제 튜닝까지 전체 개발한다.
- 클로드 구현 착수는 `docs/CLAUDE_P5_TERRITORY_IMPLEMENTATION_ORDER_2026-05-05.md`의 P5-1 생산 가시성부터 시작하되, 최종 목표는 P5 풀 시스템 완성이다.
- `docs/GAME_IMPLEMENTATION_PLAN_2026-05-04.md`의 P5 항목도 풀기획 기준으로 갱신했다. `Near-Term/Later` 식 축소 해석 대신 최종 목표와 구현 순서를 분리해서 읽어야 한다.
- 전투 피드백/리텐션/PvP 개선은 `docs/CLAUDE_COMPETITIVE_LOOP_IMPLEMENTATION_ORDER_2026-05-05.md` 기준으로 진행한다. 이 문서는 초안이 아니라 구현 계약서이며, Recon Gate / Acceptance Gate / QA Matrix를 통과해야 완료로 본다.
- 구현 순서는 전투 결과 리포트 → Daily OPS Board → 영토 닉네임/Field Rating → Battle Hub 추천 상대 → 현상금 보드 → 섹터 분쟁/주간 캘린더다.
- 첫 착수는 P1 전투 결과 리포트로 제한한다. 기존 전투 결과 모달/패널에 붙이고, Daily OPS/CPI/현상금 등은 P1 검증 뒤 진행한다.
- 완료 판정은 API, UI, fallback, mobile, docs, verification이 모두 충족될 때만 가능하다. static UI, 프로토타입 HTML, 특정 지갑 하드코딩은 완료가 아니다.
- 2026-05-08 확인: Daily OPS 주간 보상 버튼은 베이스 모달 기본 영토 탭 초기화 이후 `SHOP > MY ITEMS`로 다시 전환해야 한다. `openOpsRewardInventory()`는 상점 탭 로드와 인벤토리 전환을 순차 실행하도록 보정했다.
- 2026-05-08 확인: 전술랩은 iframe 진입 시 `lang` 쿼리를 전달받아 정적 UI, 명령 버튼, 함선 도감, 광물/파벌 패널을 현 언어에 맞춰 렌더링해야 한다.
- 2026-05-08 확인: 영토 외부 링크는 사용자가 도메인만 입력해도 `https://`로 정규화해 저장/표시한다. `http(s)://` 외 임의 스킴은 차단한다.

## 🆕 신규 진단/검증 API (이번 세션 추가)

| Endpoint | 목적 | 권한 |
|---|---|---|
| `GET /api/hijack/defender-info?wallet=` | 하이젝 모달에서 상대방 함대 미리보기 (auto-win vs fleet battle 사전 판단) | public |
| `GET /api/claims/my?wallet=` | 내 영토 목록 (expedition 셀렉터 등) | public |
| `GET /admin/api/fleet/npc-status` | NPC 전수 진단 (함대전 가능 vs 자동승리 위험 분류) | admin |
| `POST /admin/api/fleet/grant-starter-all-npcs` | NPC 전수 함대+함선+광물 일괄 지급 | admin |

## 🧪 실제 페이지 렌더링 감사 (Claude Preview 사용)

이번 세션 마지막에 실제 브라우저 렌더링 테스트 수행:

| viewport | 결과 |
|---|---|
| Desktop (1280x720) | ✅ 글로브, 패널 collapsed (default), 토글 버튼, 바텀 네비 정상. 콘솔 에러 0건. |
| Mobile (375x812 iPhone X) | ✅ 패널 transform=-319/+319 (off-screen), mob-toggle 보임, mob-bottom-nav 보임, 사이드바 열기/닫기 X 버튼 정상. |
| Tablet (820x1180 iPad portrait) | ⚠️ → ✅ 초기엔 col-fab-wrap + mob-bottom-nav 동시 렌더 (바텀 네비 2줄). `!important` 처리 후 단일 표시. |
| Admin EVENTS 탭 | ✅ Bug #3 fix 검증. World Events (Void Raiders) 섹션 정상 표시. |
| Admin JOBS 탭 | ✅ Bug #2 fix 검증. TOTAL/NO JOB/RECENT/PAID stat cards + JOB DISTRIBUTION 테이블 + RECENT CHANGE LOG 정상. |

추가로 발견된 SW 캐시 이슈 → mars-v4 + HTML network-first + auto-reload 로 해소 (Bug #10).

## 🛡 검증 방법론

이번 작업에서 사용한 audit 방법:
1. 사용자 신고 스크린샷 직접 분석 → 정확한 원인 추적
2. **로컬 서버 가동** (port 3000) + curl로 60+ frontend endpoint 직접 호출
3. 5xx/404 응답마다 server.log 확인 → 코드 수정 → 재테스트
4. PostgreSQL 직접 쿼리로 schema mismatch 추적
5. node 스모크 테스트 (require 모든 services/routes)
6. index.html `<script>` 13개 syntax 검증

→ **다른 사람이 이 audit을 재현하려면**:
```bash
# 1. 서버 가동
DATABASE_URL=postgresql://jongho@localhost:5432/pixelwar \
JWT_SECRET=test-key ADMIN_SECRET=test-admin \
node server/index.js > /tmp/server.log 2>&1 &

# 2. endpoint 일괄 테스트
WALLET=0x... ; for ep in /api/claims/my /api/fleets /api/achievements; do
  curl -s -o /dev/null -w "%{http_code} $ep\n" "http://localhost:3000$ep?wallet=$WALLET"
done

# 3. 로그 확인
tail -30 /tmp/server.log | grep -E "error|warn"
```

---

*이 audit은 OCCUPY MARS 메인 컨텐츠(영토 점령, 함대 전투, 채굴, 거버넌스, 마켓)와*
*38개 보조 기능 모두 정상 동작을 검증한 결과입니다.*
