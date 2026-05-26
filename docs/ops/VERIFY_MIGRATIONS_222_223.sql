-- OCCUPY MARS — verify migrations 220 + 222 + 223 + 224 + 225
-- 사용법 예시:
--   psql "$DATABASE_URL" -f docs/ops/VERIFY_MIGRATIONS_222_223.sql

-- 1) migration 적용 여부
SELECT filename, applied_at
FROM schema_migrations
WHERE filename IN (
  '220_economy_balance_sea.sql',
  '222_operator_safe_referral_stage1.sql',
  '223_week1_pricing_soften.sql',
  '224_week1_funnel_gp_bundle.sql',
  '225_referral_safe_key_backfill.sql'
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

-- 4) week-1 funnel GP/PP 기본값 확인
SELECT key, value, category, description
FROM settings
WHERE key IN (
  'onboarding_pp_reward',
  'onboarding_gp_reward',
  'daily_login_pp_rewards',
  'daily_login_gp_rewards'
)
ORDER BY key;

-- 5) PP→GP / sink 기본값 확인
SELECT key, value, category, description
FROM settings
WHERE key IN (
  'pp_to_gp_exchange_rate',
  'pp_to_gp_exchange_max',
  'marketplace_listing_fee_gp',
  'expedition_base_cost_gp',
  'monument_cost_base'
)
ORDER BY key;

-- 6) expected snapshot (human-readable)
SELECT
  MAX(CASE WHEN key = 'referral_hijack_pct' THEN value::text END) AS referral_hijack_pct,
  MAX(CASE WHEN key = 'referral_enhance_pct' THEN value::text END) AS referral_enhance_pct,
  MAX(CASE WHEN key = 'referral_auction_buy_pct' THEN value::text END) AS referral_auction_buy_pct,
  MAX(CASE WHEN key = 'referral_harvest_pct' THEN value::text END) AS referral_harvest_pct,
  MAX(CASE WHEN key = 'season_pass_premium_cost_gp' THEN value::text END) AS season_pass_premium_cost_gp,
  MAX(CASE WHEN key = 'land_base_price_pp' THEN value::text END) AS land_base_price_pp,
  MAX(CASE WHEN key = 'onboarding_pp_reward' THEN value::text END) AS onboarding_pp_reward,
  MAX(CASE WHEN key = 'onboarding_gp_reward' THEN value::text END) AS onboarding_gp_reward,
  MAX(CASE WHEN key = 'daily_login_pp_rewards' THEN value::text END) AS daily_login_pp_rewards,
  MAX(CASE WHEN key = 'daily_login_gp_rewards' THEN value::text END) AS daily_login_gp_rewards,
  MAX(CASE WHEN key = 'pp_to_gp_exchange_rate' THEN value::text END) AS pp_to_gp_exchange_rate,
  MAX(CASE WHEN key = 'pp_to_gp_exchange_max' THEN value::text END) AS pp_to_gp_exchange_max,
  MAX(CASE WHEN key = 'marketplace_listing_fee_gp' THEN value::text END) AS marketplace_listing_fee_gp,
  MAX(CASE WHEN key = 'expedition_base_cost_gp' THEN value::text END) AS expedition_base_cost_gp,
  MAX(CASE WHEN key = 'monument_cost_base' THEN value::text END) AS monument_cost_base
FROM settings
WHERE key IN (
  'referral_hijack_pct',
  'referral_enhance_pct',
  'referral_auction_buy_pct',
  'referral_harvest_pct',
  'season_pass_premium_cost_gp',
  'land_base_price_pp',
  'onboarding_pp_reward',
  'onboarding_gp_reward',
  'daily_login_pp_rewards',
  'daily_login_gp_rewards',
  'pp_to_gp_exchange_rate',
  'pp_to_gp_exchange_max',
  'marketplace_listing_fee_gp',
  'expedition_base_cost_gp',
  'monument_cost_base'
);

-- expected values:
-- referral_hijack_pct = 0
-- referral_enhance_pct = 0
-- referral_auction_buy_pct = 0
-- referral_harvest_pct = 0
-- season_pass_premium_cost_gp = 150
-- land_base_price_pp = 0.08
-- onboarding_pp_reward = 0.5
-- onboarding_gp_reward = 75
-- daily_login_pp_rewards = [0, 0, 0, 0, 0, 0, 0.1]
-- daily_login_gp_rewards = [8, 12, 16, 20, 22, 25, 40]
-- pp_to_gp_exchange_rate = 10
-- pp_to_gp_exchange_max = 5
-- marketplace_listing_fee_gp = 5
-- expedition_base_cost_gp = 15
-- monument_cost_base = 100
