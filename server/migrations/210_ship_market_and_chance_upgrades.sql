-- v5.63 Ship market + probabilistic stat upgrades
-- 강화된 개별 함선을 그대로 거래하고, 강화는 GP + 광물 + 확률 기반으로 전환.

ALTER TABLE ships ADD COLUMN IF NOT EXISTS is_market_listed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ship_market_listings (
  id BIGSERIAL PRIMARY KEY,
  ship_id BIGINT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  seller_wallet VARCHAR(42) NOT NULL,
  buyer_wallet VARCHAR(42),
  price_gp NUMERIC(18,4) NOT NULL CHECK (price_gp > 0),
  fee_gp NUMERIC(18,4) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'cancelled')),
  snapshot JSONB NOT NULL DEFAULT '{}',
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ship_market_active_ship
  ON ship_market_listings(ship_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ship_market_active_price
  ON ship_market_listings(status, price_gp, listed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_market_seller
  ON ship_market_listings(seller_wallet, status, listed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_market_buyer
  ON ship_market_listings(buyer_wallet, sold_at DESC);

CREATE TABLE IF NOT EXISTS ship_market_sale_log (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES ship_market_listings(id) ON DELETE SET NULL,
  ship_id BIGINT REFERENCES ships(id) ON DELETE SET NULL,
  seller_wallet VARCHAR(42) NOT NULL,
  buyer_wallet VARCHAR(42) NOT NULL,
  price_gp NUMERIC(18,4) NOT NULL,
  fee_gp NUMERIC(18,4) NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_market_sale_log_ship ON ship_market_sale_log(ship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_market_sale_log_wallets ON ship_market_sale_log(seller_wallet, buyer_wallet, created_at DESC);

ALTER TABLE ship_stat_upgrade_log ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ship_stat_upgrade_log ADD COLUMN IF NOT EXISTS success_chance NUMERIC(6,2) NOT NULL DEFAULT 100;
ALTER TABLE ship_stat_upgrade_log ADD COLUMN IF NOT EXISTS roll NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE ship_stat_upgrade_log ADD COLUMN IF NOT EXISTS materials_used JSONB NOT NULL DEFAULT '{}';

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'ship_market_enabled', 'true', '함선 전용 마켓 활성화'),
  ('fleet', 'ship_market_fee_pct', '5', '함선 판매 수수료 %'),
  ('fleet', 'ship_market_min_price_gp', '10', '함선 마켓 최소 판매가 GP'),
  ('fleet', 'ship_market_max_price_gp', '10000000', '함선 마켓 최대 판매가 GP'),
  ('fleet', 'ship_upgrade_success_base_pct', '92', '함선 강화 기본 성공 확률 %'),
  ('fleet', 'ship_upgrade_success_decay_pct', '1.8', '누적 강화 1회당 성공 확률 감소 %'),
  ('fleet', 'ship_upgrade_success_floor_pct', '35', '함선 강화 최저 성공 확률 %'),
  ('fleet', 'ship_upgrade_material_base_qty', '2', '함선 강화 기본 재료 수량'),
  ('fleet', 'ship_upgrade_material_growth_per_5', '1', '누적 강화 5회마다 추가되는 재료 수량'),
  ('fleet', 'ship_upgrade_atk_material', '"plasma_crystal"', '공격력 강화 소모 재료'),
  ('fleet', 'ship_upgrade_def_material', '"titanium_alloy"', '방어력 강화 소모 재료'),
  ('fleet', 'ship_upgrade_hp_material', '"alloy_frame"', '체력 강화 소모 재료'),
  ('fleet', 'ship_upgrade_speed_material', '"nano_polymer"', '속도 강화 소모 재료')
ON CONFLICT (key) DO NOTHING;
