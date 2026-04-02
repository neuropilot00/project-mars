-- ═══════════════════════════════════════════════════════
--  005: Sectors, Ranks, Mining, Quests, Governor, Citizen
--  Phase A — foundation tables for OCCUPY MARS v2
-- ═══════════════════════════════════════════════════════

-- ── Sectors: 24 zones on Mars ──
CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('core','mid','frontier')),
  center_lat DECIMAL(8,2) NOT NULL,
  center_lng DECIMAL(8,2) NOT NULL,
  lat_min DECIMAL(8,2) NOT NULL,
  lat_max DECIMAL(8,2) NOT NULL,
  lng_min DECIMAL(8,2) NOT NULL,
  lng_max DECIMAL(8,2) NOT NULL,
  base_price DECIMAL(20,6) DEFAULT 0.02,
  governor_wallet VARCHAR(42),
  governor_since TIMESTAMPTZ,
  total_pixels INT DEFAULT 0,
  occupied_pixels INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Rank definitions (20 levels) ──
CREATE TABLE IF NOT EXISTS rank_definitions (
  level INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  required_xp INT NOT NULL,
  reward_pp DECIMAL(20,6) DEFAULT 0
);

-- ── Users: add XP & rank columns ──
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_level INTEGER DEFAULT 1;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS total_actions INTEGER DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Pixels: add sector_id ──
DO $$ BEGIN
  ALTER TABLE pixels ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Mining log ──
CREATE TABLE IF NOT EXISTS user_mining (
  wallet_address VARCHAR(42) PRIMARY KEY REFERENCES users(wallet_address),
  last_harvest_at TIMESTAMPTZ,
  total_mined_pp DECIMAL(20,6) DEFAULT 0,
  today_mined_pp DECIMAL(20,6) DEFAULT 0,
  today_date DATE DEFAULT CURRENT_DATE
);

-- ── Quest definitions ──
CREATE TABLE IF NOT EXISTS quest_definitions (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('daily','weekly','sector','achievement','event')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  reward_pp DECIMAL(20,6) DEFAULT 0,
  reward_xp INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User quest progress ──
CREATE TABLE IF NOT EXISTS user_quests (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  quest_id INT NOT NULL REFERENCES quest_definitions(id),
  progress JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, quest_id)
);

-- ── Governor fee log ──
CREATE TABLE IF NOT EXISTS governor_fees (
  id SERIAL PRIMARY KEY,
  sector_id INT NOT NULL REFERENCES sectors(id),
  governor_wallet VARCHAR(42) NOT NULL,
  pp_amount DECIMAL(20,6) NOT NULL,
  trigger_type VARCHAR(20) NOT NULL,
  trigger_tx_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Citizen tax distribution log ──
CREATE TABLE IF NOT EXISTS citizen_rewards (
  id SERIAL PRIMARY KEY,
  sector_id INT NOT NULL REFERENCES sectors(id),
  wallet_address VARCHAR(42) NOT NULL,
  pp_amount DECIMAL(20,6) NOT NULL,
  pixel_count INT NOT NULL,
  payout_cycle TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User sector activity tracking ──
CREATE TABLE IF NOT EXISTS user_sector_activity (
  wallet_address VARCHAR(42) NOT NULL,
  sector_id INT NOT NULL REFERENCES sectors(id),
  action_count INT DEFAULT 0,
  last_action_at TIMESTAMPTZ DEFAULT NOW(),
  week_start DATE NOT NULL DEFAULT (DATE_TRUNC('week', CURRENT_DATE))::DATE,
  PRIMARY KEY (wallet_address, sector_id, week_start)
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_sectors_tier ON sectors(tier);
CREATE INDEX IF NOT EXISTS idx_pixels_sector ON pixels(sector_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_wallet ON user_quests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_quests_quest ON user_quests(quest_id);
CREATE INDEX IF NOT EXISTS idx_governor_fees_sector ON governor_fees(sector_id);
CREATE INDEX IF NOT EXISTS idx_citizen_rewards_wallet ON citizen_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_citizen_rewards_cycle ON citizen_rewards(payout_cycle);
CREATE INDEX IF NOT EXISTS idx_user_sector_activity_sector ON user_sector_activity(sector_id);
CREATE INDEX IF NOT EXISTS idx_users_rank ON users(rank_level DESC);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- ═══════════════════════════════════════════════════════
--  Seed: 24 sectors (4 Core + 8 Mid + 12 Frontier)
--  Mars coordinates mapped to lat/lng
-- ═══════════════════════════════════════════════════════

INSERT INTO sectors (name, tier, center_lat, center_lng, lat_min, lat_max, lng_min, lng_max, base_price) VALUES
  -- CORE (4) — iconic Mars landmarks
  ('Olympus Mons',       'core',     18.65,  226.20,   10.00,  27.00,  216.00, 236.00, 0.15),
  ('Valles Marineris',   'core',    -14.00,  293.00,  -22.00,  -6.00,  265.00, 321.00, 0.15),
  ('Hellas Basin',        'core',    -42.70,   70.00,  -55.00, -30.00,   50.00,  90.00, 0.15),
  ('Elysium Mons',       'core',     25.02,  147.21,   17.00,  33.00,  137.00, 157.00, 0.15),

  -- MID (8) — major regions
  ('Tharsis Plateau',    'mid',       1.00,  253.00,   -8.00,  10.00,  238.00, 268.00, 0.05),
  ('Syrtis Major',       'mid',       8.40,   69.50,    0.00,  17.00,   60.00,  79.00, 0.05),
  ('Amazonis Planitia',  'mid',      24.80,  196.00,   15.00,  35.00,  180.00, 212.00, 0.05),
  ('Isidis Planitia',    'mid',      12.90,   87.00,    4.00,  22.00,   77.00,  97.00, 0.05),
  ('Argyre Basin',       'mid',     -49.70,  316.00,  -58.00, -41.00,  303.00, 329.00, 0.05),
  ('Chryse Planitia',    'mid',      28.40,  320.00,   20.00,  37.00,  308.00, 332.00, 0.05),
  ('Utopia Planitia',    'mid',      49.70,  118.00,   40.00,  59.00,  100.00, 136.00, 0.05),
  ('Acidalia Planitia',  'mid',      46.70,  338.00,   37.00,  56.00,  325.00, 351.00, 0.05),

  -- FRONTIER (12) — exploration zones
  ('Terra Cimmeria',     'frontier', -34.70,  145.00,  -45.00, -25.00,  130.00, 160.00, 0.02),
  ('Terra Sirenum',      'frontier', -39.70,  210.00,  -50.00, -30.00,  195.00, 225.00, 0.02),
  ('Noachis Terra',      'frontier', -45.00,  350.00,  -55.00, -35.00,  335.00,   5.00, 0.02),
  ('Arabia Terra',       'frontier',  20.00,   15.00,   10.00,  30.00,    0.00,  30.00, 0.02),
  ('Arcadia Planitia',   'frontier',  47.20,  184.00,   37.00,  57.00,  170.00, 198.00, 0.02),
  ('Vastitas Borealis W','frontier',  62.00,  210.00,   55.00,  69.00,  180.00, 240.00, 0.02),
  ('Vastitas Borealis E','frontier',  62.00,   30.00,   55.00,  69.00,    0.00,  60.00, 0.02),
  ('Aonia Terra',        'frontier', -58.00,  250.00,  -67.00, -49.00,  235.00, 265.00, 0.02),
  ('Promethei Terra',    'frontier', -58.00,  110.00,  -67.00, -49.00,   95.00, 125.00, 0.02),
  ('Tempe Terra',        'frontier',  40.00,  290.00,   31.00,  49.00,  278.00, 302.00, 0.02),
  ('Lunae Planum',       'frontier',  10.00,  295.00,    2.00,  18.00,  285.00, 305.00, 0.02),
  ('Daedalia Planum',    'frontier', -22.00,  230.00,  -32.00, -12.00,  218.00, 242.00, 0.02)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
--  Seed: 20 rank levels
-- ═══════════════════════════════════════════════════════

INSERT INTO rank_definitions (level, name, required_xp, reward_pp) VALUES
  (1,  'Dust Walker',       0,      0),
  (2,  'Sand Drifter',      100,    10),
  (3,  'Crater Scout',      300,    15),
  (4,  'Ridge Runner',      600,    20),
  (5,  'Storm Chaser',      1000,   30),
  (6,  'Canyon Ranger',     1600,   40),
  (7,  'Mesa Guardian',     2400,   50),
  (8,  'Dust Devil',        3500,   65),
  (9,  'Iron Prospector',   5000,   80),
  (10, 'Lava Walker',       7000,   100),
  (11, 'Dome Builder',      9500,   120),
  (12, 'Terrain Marshal',   12500,  150),
  (13, 'Sector Warden',     16000,  180),
  (14, 'Colony Architect',  20000,  220),
  (15, 'Storm Commander',   25000,  260),
  (16, 'Rift Master',       31000,  310),
  (17, 'Olympus Elite',     38000,  370),
  (18, 'Mars Sovereign',    46000,  440),
  (19, 'Red Emperor',       55000,  520),
  (20, 'God of Mars',       65000,  700)
ON CONFLICT (level) DO NOTHING;
