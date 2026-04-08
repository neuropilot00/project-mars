-- 027_item_shop.sql
-- Item shop: purchasable battle items for territory warfare

CREATE TABLE IF NOT EXISTS item_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL DEFAULT 'battle',
  price_pp DECIMAL(20,6) NOT NULL DEFAULT 0,
  price_usdt DECIMAL(20,6) NOT NULL DEFAULT 0,
  duration_hours INT DEFAULT 0,
  effect_value INT DEFAULT 0,
  icon VARCHAR(10) DEFAULT '',
  max_stack INT DEFAULT 5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_items (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  item_type_id INT REFERENCES item_types(id),
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, item_type_id)
);

CREATE TABLE IF NOT EXISTS item_usage_log (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  item_type_id INT REFERENCES item_types(id),
  claim_id INT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pixel_shields (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL,
  owner VARCHAR(42) NOT NULL,
  shield_type VARCHAR(20) NOT NULL DEFAULT 'basic',
  hp INT NOT NULL DEFAULT 100,
  max_hp INT NOT NULL DEFAULT 100,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_items_wallet ON user_items(wallet);
CREATE INDEX IF NOT EXISTS idx_pixel_shields_claim ON pixel_shields(claim_id);
CREATE INDEX IF NOT EXISTS idx_pixel_shields_owner ON pixel_shields(owner);
CREATE INDEX IF NOT EXISTS idx_item_usage_wallet ON item_usage_log(wallet);

-- Seed default items
INSERT INTO item_types (code, name, description, category, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack) VALUES
  ('shield_basic', 'Energy Shield', 'Protects your territory from attacks for 12 hours. Absorbs 50% damage.', 'defense', 2.5, 2.5, 12, 50, '🛡️', 10),
  ('shield_advanced', 'Plasma Shield', 'Advanced shield. Protects for 24 hours. Absorbs 75% damage.', 'defense', 5.0, 5.0, 24, 75, '🔰', 5),
  ('emp_strike', 'EMP Strike', 'Disables target shields for 6 hours. Use before attacking shielded territory.', 'attack', 3.5, 3.5, 6, 100, '⚡', 10),
  ('attack_boost', 'Mars Rage', 'Increases attack success rate by 20% for next 3 attacks.', 'attack', 2.0, 2.0, 0, 20, '🔥', 10),
  ('stealth_cloak', 'Stealth Cloak', 'Hide your territory from other players for 8 hours.', 'utility', 1.5, 1.5, 8, 0, '👻', 5),
  ('radar_scan', 'Radar Scan', 'Reveal all hidden (cloaked) territories in your sector.', 'utility', 1.0, 1.0, 0, 0, '📡', 10),
  ('pixel_doubler', 'Pixel Doubler', 'Next land claim counts double pixels for ranking.', 'boost', 4.0, 4.0, 0, 2, '✨', 3),
  ('mining_boost', 'Mining Accelerator', 'Double mining rewards for 6 hours.', 'boost', 3.0, 3.0, 6, 2, '⛏️', 5)
ON CONFLICT (code) DO NOTHING;
