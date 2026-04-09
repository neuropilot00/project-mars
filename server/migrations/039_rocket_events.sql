-- Rocket Supply Drop Events

CREATE TABLE IF NOT EXISTS rocket_events (
  id SERIAL PRIMARY KEY,
  landing_lat DOUBLE PRECISION NOT NULL,
  landing_lng DOUBLE PRECISION NOT NULL,
  sector_id INT REFERENCES sectors(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL DEFAULT 'supply_drop' CHECK (event_type IN ('supply_drop','rud_explosion')),
  status VARCHAR(20) NOT NULL DEFAULT 'incoming' CHECK (status IN ('incoming','landed','looting','completed')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  landing_at TIMESTAMPTZ NOT NULL,
  looting_ends_at TIMESTAMPTZ,
  rewards_json JSONB NOT NULL DEFAULT '[]',
  total_rewards INT NOT NULL DEFAULT 0,
  claimed_rewards INT NOT NULL DEFAULT 0,
  triggered_by VARCHAR(42),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rocket_events_status ON rocket_events(status) WHERE status != 'completed';

-- Loot claims from rocket events
CREATE TABLE IF NOT EXISTS rocket_loot_claims (
  id SERIAL PRIMARY KEY,
  rocket_event_id INT NOT NULL REFERENCES rocket_events(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  loot_index INT NOT NULL,
  reward_type VARCHAR(20) NOT NULL DEFAULT 'pp',
  reward_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_item_code VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rocket_event_id, loot_index)
);

-- Rocket config settings
INSERT INTO settings (key, value) VALUES
  ('rocket_enabled', 'true'),
  ('rocket_interval_hours', '12'),
  ('rocket_advance_notice_hours', '2'),
  ('rocket_looting_hours', '1'),
  ('rocket_rud_chance', '5'),
  ('rocket_loot_count_normal', '15'),
  ('rocket_loot_count_rud', '30'),
  ('rocket_loot_min_pp', '0.1'),
  ('rocket_loot_max_pp', '1.0'),
  ('rocket_loot_radius', '5'),
  ('rocket_rud_radius', '10')
ON CONFLICT (key) DO NOTHING;

-- Starship border cosmetic (drop-only, not purchasable)
INSERT INTO item_types (code, name, description, category, price_pp, max_supply, tradeable)
VALUES ('starship_border', 'Starship Border', 'Rare animated border from rocket supply drops', 'cosmetic', 0, 100, false)
ON CONFLICT (code) DO NOTHING;
