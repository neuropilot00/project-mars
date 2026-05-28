-- 249_seed_auction_platform_fee.sql
-- auction.js:40 이 'auction_platform_fee_pct' 키를 읽지만 DB에 시드된 적이 없어
-- 코드 폴백(5/100 = 5%)으로 동작 중. admin 패널에서 조정 가능하도록 명시 시드.
-- 동작 변경 0 (실효 5% 동일), 운영자 튜닝성 회복만.
INSERT INTO settings (category, key, value, description) VALUES
  ('auction', 'auction_platform_fee_pct', '5', '옥션 플랫폼 수수료(%) — auction.js:40 에서 /100 컨벤션으로 사용')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('249_seed_auction_platform_fee.sql') ON CONFLICT DO NOTHING;
