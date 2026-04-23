-- ============================================================
-- Migration 081: 광물 & 자원 시스템 (Resource System)
-- MASTER_PLAN Phase 2
-- ============================================================

-- ── 1. resources 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS resources (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(30) UNIQUE NOT NULL,
  name_en       VARCHAR(50),
  name_ko       VARCHAR(50),
  name_ja       VARCHAR(50),
  name_zh       VARCHAR(50),
  rarity        VARCHAR(20) DEFAULT 'common',  -- common / rare / special
  icon_emoji    VARCHAR(10),
  base_pp_value DECIMAL(10,2) DEFAULT 1.0,     -- PP 기준가 (마켓 참고가)
  is_tradeable  BOOLEAN DEFAULT TRUE,
  is_active     BOOLEAN DEFAULT TRUE
);

-- ── 2. 초기 자원 데이터 (9종) ────────────────────────────────
INSERT INTO resources (code, name_en, name_ko, name_ja, name_zh, rarity, icon_emoji, base_pp_value, is_tradeable, is_active) VALUES
  ('iron_dust',            'Iron Dust',           '철분',          '鉄粉',       '铁尘',       'common',  '🟤', 0.50,  TRUE, TRUE),
  ('red_sand',             'Red Sand',            '붉은 모래',      '赤砂',       '红沙',       'common',  '🔴', 0.60,  TRUE, TRUE),
  ('basalt_chip',          'Basalt Chip',         '현무암 조각',    '玄武岩片',   '玄武岩碎片', 'common',  '⬛', 0.80,  TRUE, TRUE),
  ('ice_crystal',          'Ice Crystal',         '얼음 결정',      '氷結晶',     '冰晶',       'rare',    '🔵', 8.00,  TRUE, TRUE),
  ('regolith_ore',         'Regolith Ore',        '레골리스 광석',  'レゴリス鉱石', '风化层矿石', 'rare',    '🟠', 10.00, TRUE, TRUE),
  ('volcanic_shard',       'Volcanic Shard',      '화산 파편',      '火山片',     '火山碎片',   'rare',    '🌋', 12.00, TRUE, TRUE),
  ('ancient_metal',        'Ancient Metal',       '고대 금속',      '古代金属',   '远古金属',   'special', '⭐', 80.00, TRUE, TRUE),
  ('plasma_dust',          'Plasma Dust',         '플라즈마 먼지',  'プラズマ塵', '等离子尘',   'special', '💜', 60.00, TRUE, TRUE),
  ('meteorite_fragment',   'Meteorite Fragment',  '운석 파편',      '隕石破片',   '陨石碎片',   'special', '☄️',  100.00, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ── 3. sector_resource_rates 테이블 ─────────────────────────
CREATE TABLE IF NOT EXISTS sector_resource_rates (
  id            SERIAL PRIMARY KEY,
  sector_type   VARCHAR(20) NOT NULL,   -- 'core' / 'mid' / 'frontier'
  resource_code VARCHAR(30) NOT NULL REFERENCES resources(code),
  base_rate     DECIMAL(6,4) NOT NULL,  -- 0~1 기본 드롭 확률
  miner_bonus   DECIMAL(6,4) DEFAULT 0, -- Miner 직업 추가 확률 (flat)
  is_active     BOOLEAN DEFAULT TRUE,
  UNIQUE(sector_type, resource_code)
);

-- ── 4. 섹터별 자원 산출 확률 데이터 ─────────────────────────
-- Frontier 섹터
INSERT INTO sector_resource_rates (sector_type, resource_code, base_rate, miner_bonus) VALUES
  ('frontier', 'iron_dust',       0.3000, 0.0500),
  ('frontier', 'red_sand',        0.2500, 0.0500),
  ('frontier', 'basalt_chip',     0.0500, 0.0200),
  ('frontier', 'ice_crystal',     0.1500, 0.0500),
  ('frontier', 'regolith_ore',    0.1200, 0.0500),
  ('frontier', 'volcanic_shard',  0.0800, 0.0400),
  ('frontier', 'ancient_metal',   0.0050, 0.0025)
ON CONFLICT (sector_type, resource_code) DO NOTHING;

-- Mid 섹터
INSERT INTO sector_resource_rates (sector_type, resource_code, base_rate, miner_bonus) VALUES
  ('mid', 'iron_dust',       0.2500, 0.0400),
  ('mid', 'red_sand',        0.1000, 0.0300),
  ('mid', 'basalt_chip',     0.2000, 0.0300),
  ('mid', 'ice_crystal',     0.0800, 0.0300),
  ('mid', 'regolith_ore',    0.0500, 0.0200),
  ('mid', 'volcanic_shard',  0.0500, 0.0200),
  ('mid', 'ancient_metal',   0.0010, 0.0005)
ON CONFLICT (sector_type, resource_code) DO NOTHING;

-- Core 섹터
INSERT INTO sector_resource_rates (sector_type, resource_code, base_rate, miner_bonus) VALUES
  ('core', 'iron_dust',       0.1500, 0.0300),
  ('core', 'red_sand',        0.0500, 0.0200),
  ('core', 'basalt_chip',     0.3000, 0.0300),
  ('core', 'ice_crystal',     0.0200, 0.0100),
  ('core', 'regolith_ore',    0.0200, 0.0100),
  ('core', 'volcanic_shard',  0.0100, 0.0050)
ON CONFLICT (sector_type, resource_code) DO NOTHING;

-- ── 5. user_resource_inventory 테이블 ──────────────────────
CREATE TABLE IF NOT EXISTS user_resource_inventory (
  id           SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  resource_id  INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  quantity     INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_inv_wallet ON user_resource_inventory(wallet_address);

-- ── 6. marketplace_listings: resource 타입 + 컬럼 추가 ──────
-- 기존 listing_type CHECK 제약 제거 후 resource 포함 재추가
ALTER TABLE marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_listing_type_check;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_listing_type_check
  CHECK (listing_type IN ('item','cosmetic','claim','resource'));

ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS resource_code     VARCHAR(30) REFERENCES resources(code),
  ADD COLUMN IF NOT EXISTS resource_quantity INT DEFAULT 1;

-- ── 7. transactions: resource_sale 타입 추가 ────────────────
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN (
    'deposit','claim','hijack','battle_failed','swap',
    'withdraw','withdraw_all','mining','rank_reward','referral',
    'quest','shop_purchase',
    'crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win','dice_bet','dice_win',
    'hilo_bet','hilo_win',
    'maintenance_fee','instant_harvest','rename_fee',
    'poi_hint','loot_priority','auto_renew',
    'pp_to_gp_exchange','war_game_continue',
    'enhance_attempt',
    'marketplace_sale','marketplace_fee','marketplace_listing_fee',
    'marketplace_bid_hold','marketplace_bid_refund',
    'resource_sale'
  ));

-- ── 8. settings: 자원 시스템 설정 ───────────────────────────
INSERT INTO settings (key, value, category, description) VALUES
  ('resource_drop_enabled',         'true', 'resource', '자원 드롭 활성화 여부'),
  ('resource_max_drop_per_harvest', '3',    'resource', 'Harvest당 최대 드롭 자원 종류 수'),
  ('resource_drop_quantity_min',    '1',    'resource', '자원 드롭 최소 수량'),
  ('resource_drop_quantity_max',    '5',    'resource', '자원 드롭 최대 수량'),
  ('resource_rare_multiplier',      '1.3',  'resource', 'Miner 희귀 자원 확률 배율 (miner_rare_resource_chance 연동)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
--   ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (...원본...));
--   ALTER TABLE marketplace_listings DROP COLUMN resource_code, DROP COLUMN resource_quantity;
--   ALTER TABLE marketplace_listings DROP CONSTRAINT marketplace_listings_listing_type_check;
--   ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_listing_type_check CHECK (listing_type IN ('item','cosmetic','claim'));
--   DROP TABLE IF EXISTS user_resource_inventory;
--   DROP TABLE IF EXISTS sector_resource_rates;
--   DROP TABLE IF EXISTS resources;
--   DELETE FROM settings WHERE key IN ('resource_drop_enabled','resource_max_drop_per_harvest','resource_drop_quantity_min','resource_drop_quantity_max','resource_rare_multiplier');
-- ============================================================
