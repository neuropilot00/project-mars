# OCCUPY MARS — EVE급 경제 로드맵 (진행 현황 + 잔여 설계)
> 최종 업데이트: 2026-05-27 (v7.123~7.128). 페르소나팀 + Codex 독립검토 + 설계 에이전트 병렬 산출물 종합.

게임 목표: "EVE Online처럼 탄탄한 경제". EVE 견고함의 4축 — ① full-loss 파괴로 수요 생성, ② 플레이어 주도 시장, ③ 생산 체인, ④ 희소성/싱크 + faucet=sink 모니터링.

---

## ✅ 완료 (커밋됨)

| 버전 | 항목 | 핵심 |
|------|------|------|
| v7.121 | AI 연습전 보상 차단 | 무한 mint 현금화 익스플로잇 봉쇄 |
| v7.123 | 경제 헬스 모니터링 | `GET /api/admin/economy/health` — 유통량/담보율/GP·PP flow (EVE MER 대응) |
| v7.124 | PP 일일 채굴 캡 + 시빌 방어 | `pp_daily_earn_cap_per_user` enforce(무제한 farm 차단) + IP당 가입캡/셀프추천 차단(mig 229) |
| v7.125 | **뱅크런 구조적 차단** | 불변식 `SUM(usdt_balance) ≤ collateral_usdt`. /swap·/withdraw-all room 가드(mig 230) |
| v7.126 | 뱅크런 하드닝 | Codex 검토 결함 3개(담보 초기식/season usdt/입금 동기화) 보강(mig 231) |
| v7.127 | **함선 영구파괴 토글** | `hijack_ship_loss_enabled`(기본 OFF). EVE full-loss 수요엔진(mig 232) |
| v7.128 | **동적 PP↔GP 환율** | 24h 수급 밴딩 ±2% step-cap, [5,20] 하드밴드(기본 OFF, mig 233) |

### 운영자 켜는 순서 권장
1. **담보 적립** `POST /api/admin/economy/treasury/topup {amount}` — 실수익으로 PP→USDT 환금풀 적립(현재 room=0이라 환금 OFF).
2. **full-loss** 수리/재건조/보험 밸런스 정비 후 `hijack_ship_loss_enabled=true`.
3. **동적 환율** `pp_to_gp_dynamic_enabled=true` + floor/ceil/target 검토.
4. **PP 채굴 캡** `pp_daily_earn_cap_per_user` 실밸런스값으로 상향(현 0.3은 보수적).

---

## 🔜 잔여 — 지역(섹터) 마켓 차별화 (설계 완료, 미구현)

**현 상태**: `marketplace_listings`/`ship_market_listings` 둘 다 섹터 차원 없음(전역 단일). `transport_jobs.cargo_type`은 `'gp'|'item'|'resource'` 정의되나 gp만 와이어됨. `claims`엔 `sector_id` 없고 `pixels.sector_id`로만 섹터 귀속. `sectors.center_lat/lng` + `transport.js#sectorDistance()` 재사용 가능.

### MVP
- 두 마켓 테이블에 `sector_id` 추가, 리스팅 시 판매자 거점 섹터 자동 태깅, **동일 섹터만 매수** 허용. 섹터별 시세 뷰 1개. 차익거래는 "운송 후 재리스팅"으로 자연 발생.

### 풀버전
- 섹터별 호가 → `transport_jobs(cargo_type='resource'/'item')` 와이어로 물리 이송 강제 → 허브(Jita형) 자연 형성 + 운송 raid 리스크.

### 마이그레이션 스케치 (212 또는 차기 번호)
```sql
ALTER TABLE marketplace_listings ADD COLUMN sector_id INT REFERENCES sectors(id);
ALTER TABLE ship_market_listings  ADD COLUMN sector_id INT REFERENCES sectors(id);
CREATE INDEX idx_mkt_sector ON marketplace_listings(sector_id, status, listing_type);
CREATE MATERIALIZED VIEW v_sector_market_price AS
  SELECT sector_id, item_type_id, AVG(sale_price) avg, MIN(sale_price) low, COUNT(*) vol_24h
  FROM marketplace_price_history JOIN ... WHERE sold_at > NOW()-INTERVAL '24h' GROUP BY ...;
```
- `sector_id` 결정: 리스팅 시 `pixels.sector_id`로 판매자 최대 claim 섹터 추정(없으면 frontier). `/api/sectors/control` 로직 재사용.
- 신규 엔드포인트: `GET /api/market/sectors/:sectorId`(섹터 호가판), `GET /api/market/price-spread/:itemTypeId`(섹터간 차익). 기존 `marketplace.js` createListing/buy 에 `sector_id` 분기만 추가 — 재작성 불필요.

### 익스플로잇/방어
- 자전거래 시세 펌핑(price_history 오염): 동일 wallet/같은 길드 seller↔buyer 거래는 price_history 기록 제외 + 운송 raid 노출(`transport_raid_*` 설정 존재).
- 순간이동 차익거래 봉쇄의 본질 = 물류 강제(MVP는 동일섹터 매수 제한으로 갈음).

### 재사용 포인트
`transport.js#sectorDistance/getCfg`(운송비=거리×설정), `marketplace_price_history`, `pixels.sector_id`(mig 005), `/api/sectors/control`.

**공통 권고**: `settings` 토글 default OFF → 카나리. 모든 동적 경제 파라미터는 `adminEconomyRoutes.js` override 경로 유지.

---

## 🔜 잔여 — killmail / looting (중기)
- 데이터 소스 이미 존재: `fleet_battle_events.event_type='ship_destroyed'`, `fleet_battle_participants.ships_lost`.
- full-loss(v7.127) 켜진 뒤 격침 함선에서 재료/GP 일부 looting → 승자 보상. killmail 피드 UI(전투 결과 모달/Battle Hub).

---

## EVE 4축 대비 현 갭 요약
| 축 | 상태 |
|----|------|
| ① full-loss 수요 | 🟡 일반전투 O, 하이젝 토글 완비(기본 OFF) |
| ② 플레이어 주도 시장 | 🟡 함선/아이템 마켓 O, 지역 차별화 미구현 |
| ③ 생산 체인 | 🟢 채굴→정제→건조→마켓 존재 |
| ④ 희소성/싱크 + 모니터링 | 🟢 싱크 다수 + health 모니터 + 담보가드, PP채굴캡/동적환율 완비 |
