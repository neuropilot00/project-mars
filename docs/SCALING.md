# OCCUPY MARS — 수평 확장(MMO) 로드맵

단일 인스턴스 기준으로 베타~수백 동접은 무리 없음. 수천+ 동접(진짜 MMO)으로 가려면 아래를
순서대로 적용한다. **전면 재작성 불필요 — 인프라 리엔지니어링.**

## ✅ 완료 (이번 작업)
- **워커 게이트** (`RUN_SCHEDULERS`): 스케줄러 50여 개 + 온체인 입금 리스너를 1개 워커에만.
  web 인스턴스는 `RUN_SCHEDULERS=false` → 중복 스폰/중복 입금 크레딧 방지. (v7.109)
- **WebSocket 푸시** (`/ws/live`): 채팅/활동피드 실시간 → 폴링 부하 대폭 감소. (v7.110)
- **캐시 추상화** (`services/cache.js`): REDIS_URL 있으면 Redis, 없으면 인메모리 폴백.

## 🔜 멀티 인스턴스 전환 체크리스트

### 1. Redis 프로비저닝
- Railway Redis 등 추가 → `REDIS_URL` 설정 + `npm i ioredis`.
- `services/cache.js` 가 자동으로 Redis 모드로 전환(코드 변경 불필요).

### 2. ⚠️ WebSocket 팬아웃 (중요)
- 현재 `broadcastChat/broadcastFeed/broadcastBattleFrame` 은 **자기 인스턴스에 연결된 클라이언트에게만** 전송한다.
- 멀티 인스턴스에서는 인스턴스 A에서 보낸 채팅이 인스턴스 B에 붙은 유저에게 안 간다.
- **해결**: Redis Pub/Sub 팬아웃. send 시 `redis.publish('live', payload)` →
  각 인스턴스가 `subscribe('live')` 해서 자기 로컬 `_live` 로 broadcast.
  (`wsServer.js` 에 pub/sub 레이어 추가 — 단일 인스턴스 땐 불필요.)
- 또는 WS 전용 게이트웨이(예: 별도 WS 인스턴스 + sticky session).

### 3. 레이트리밋 공유 스토어
- 현재 `express-rate-limit` 인메모리 → 인스턴스별 독립(확장 시 무력).
- `npm i rate-limit-redis` + Redis store 연결 → 전역 레이트리밋.

### 4. 로드밸런서 / 세션
- JWT 무상태라 세션 스티키 불필요(HTTP). 단 **WebSocket 은 sticky 또는 위 pub/sub** 필요.
- web 인스턴스 N개 + 워커 1개(RUN_SCHEDULERS=true) 구성.

### 5. DB 스케일
- read replica + 핫 읽기(리더보드/피드/클레임) 캐싱(`services/cache.js`).
- 커넥션 풀 상한 점검(`pg` Pool).

### 6. 전투 시뮬 워커 분리 + 동시성 캡 상향
- `battleScheduler` 를 전용 워커로. `battle_max_concurrent` 상향.

### 7. 월드 샤딩 (장기)
- 채팅/피드/전장을 섹터/존 단위로 분할.

## 폴링 현황(WS 전환 후)
- 채팅: WS 실시간 + 폴백 15s
- 활동피드: WS(클레임 소스 연결) + 폴백 15s. 나머지 피드 소스(전투/건조/채굴)도
  `wsServer.broadcastFeed({type})` 호출 추가하면 실시간화(클라이언트는 poke 받아 재조회).
- 기타(리더보드 60s, 공개통계 30s, 날씨/로켓 등)는 현 수준 유지 가능.
