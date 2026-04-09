-- Mars Weather System: dynamic sector events with buffs/debuffs

CREATE TABLE IF NOT EXISTS mars_weather (
  id SERIAL PRIMARY KEY,
  sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  weather_type VARCHAR(30) NOT NULL CHECK (weather_type IN ('sandstorm','solar_flare','meteor_shower','dust_devil')),
  effects JSONB NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mars_weather_active ON mars_weather(active, starts_at, ends_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_mars_weather_sector ON mars_weather(sector_id);

-- Weather config settings
INSERT INTO settings (key, value) VALUES
  ('weather_enabled', 'true'),
  ('weather_spawn_interval_hours', '6'),
  ('weather_sectors_per_cycle', '3'),
  ('weather_duration_min_hours', '2'),
  ('weather_duration_max_hours', '4')
ON CONFLICT (key) DO NOTHING;
