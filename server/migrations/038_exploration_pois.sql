-- Exploration POI system: discoverable points of interest on Mars

CREATE TABLE IF NOT EXISTS exploration_pois (
  id SERIAL PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  sector_id INT REFERENCES sectors(id) ON DELETE SET NULL,
  poi_type VARCHAR(30) NOT NULL CHECK (poi_type IN ('ancient_ruins','ore_deposit','crashed_probe','water_ice','alien_artifact')),
  reward_type VARCHAR(20) NOT NULL DEFAULT 'pp' CHECK (reward_type IN ('pp','item','xp')),
  reward_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_item_code VARCHAR(50),
  discovered_by VARCHAR(42),
  discovered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pois_active ON exploration_pois(active, expires_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_pois_sector ON exploration_pois(sector_id);

-- Discovery log
CREATE TABLE IF NOT EXISTS poi_discoveries (
  id SERIAL PRIMARY KEY,
  poi_id INT NOT NULL REFERENCES exploration_pois(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  reward_type VARCHAR(20) NOT NULL,
  reward_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_item_code VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Starlink satellite passes (sector boosts)
CREATE TABLE IF NOT EXISTS starlink_passes (
  id SERIAL PRIMARY KEY,
  satellite_id INT NOT NULL,
  sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  boost_value DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_starlink_active ON starlink_passes(active, ends_at) WHERE active = true;

-- Exploration config settings
INSERT INTO settings (key, value) VALUES
  ('poi_enabled', 'true'),
  ('poi_spawn_interval_hours', '4'),
  ('poi_count_per_cycle', '6'),
  ('poi_expire_hours', '12'),
  ('poi_reward_min_pp', '0.05'),
  ('poi_reward_max_pp', '0.5'),
  ('poi_cosmetic_chance', '5'),
  ('starlink_enabled', 'true'),
  ('starlink_boost_percent', '10'),
  ('starlink_pass_duration_hours', '1')
ON CONFLICT (key) DO NOTHING;
