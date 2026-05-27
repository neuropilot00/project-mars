-- Migration 235: 지역(섹터) 마켓 차별화 — sector_id 활성화 + 동일섹터 매수옵션
-- ───────────────────────────────────────────────────────────────────────────
-- marketplace_listings.sector_id(mig 156)는 존재하나 항상 null 로 들어가 섹터 관세/
-- 거버너 시스템(computeSectorTariff)이 휴면 상태였다. 이제 리스팅 시 판매자/claim 의
-- pixels.sector_id(최빈) 로 자동 태깅한다(서비스 코드). 이 마이그레이션은:
--   1) sector_id 브라우징/관세 조회용 인덱스,
--   2) 동일 섹터 매수 제한 토글(기본 OFF — 켜면 물류 강제로 허브/차익거래 유발).
-- 기본 동작: sector_id 채워지면 해당 섹터 거버너 관세만 적용(기존 시스템), 매수 자체는 자유.

CREATE INDEX IF NOT EXISTS idx_mkt_listings_sector
  ON marketplace_listings (sector_id, status, listing_type);

INSERT INTO settings (category, key, value, description) VALUES
  ('market', 'marketplace_sector_restricted_buy', 'false', '동일 섹터에서만 매수 허용(기본 OFF). 켜면 타섹터 매물 차단 → 물류/차익거래 유발')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('235_regional_market.sql') ON CONFLICT DO NOTHING;
