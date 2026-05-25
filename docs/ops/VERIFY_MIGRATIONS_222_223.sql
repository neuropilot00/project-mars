-- OCCUPY MARS — verify referral/pricing migrations 222 + 223
-- 사용법 예시:
--   psql "$DATABASE_URL" -f docs/ops/VERIFY_MIGRATIONS_222_223.sql

-- 1) migration 적용 여부
SELECT filename, applied_at
FROM schema_migrations
WHERE filename IN (
  '222_operator_safe_referral_stage1.sql',
  '223_week1_pricing_soften.sql'
)
ORDER BY filename;

-- 2) referral/operator-safe 기본값 확인
SELECT key, value, category, description
FROM settings
WHERE key IN (
  'referral_hijack_pct',
  'referral_enhance_pct',
  'referral_auction_buy_pct',
  'referral_harvest_pct'
)
ORDER BY key;

-- 3) week-1 pricing 기본값 확인
SELECT key, value, category, description
FROM settings
WHERE key IN (
  'season_pass_premium_cost_gp',
  'land_base_price_pp'
)
ORDER BY key;

-- 4) expected snapshot (human-readable)
SELECT
  MAX(CASE WHEN key = 'referral_hijack_pct' THEN value END) AS referral_hijack_pct,
  MAX(CASE WHEN key = 'referral_enhance_pct' THEN value END) AS referral_enhance_pct,
  MAX(CASE WHEN key = 'referral_auction_buy_pct' THEN value END) AS referral_auction_buy_pct,
  MAX(CASE WHEN key = 'referral_harvest_pct' THEN value END) AS referral_harvest_pct,
  MAX(CASE WHEN key = 'season_pass_premium_cost_gp' THEN value END) AS season_pass_premium_cost_gp,
  MAX(CASE WHEN key = 'land_base_price_pp' THEN value END) AS land_base_price_pp
FROM settings
WHERE key IN (
  'referral_hijack_pct',
  'referral_enhance_pct',
  'referral_auction_buy_pct',
  'referral_harvest_pct',
  'season_pass_premium_cost_gp',
  'land_base_price_pp'
);

-- expected values:
-- referral_hijack_pct = 0
-- referral_enhance_pct = 0
-- referral_auction_buy_pct = 0
-- referral_harvest_pct = 0
-- season_pass_premium_cost_gp = 150
-- land_base_price_pp = 0.08
