-- 047: Season System

CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  theme VARCHAR(20) NOT NULL DEFAULT 'volcanic'
    CHECK (theme IN ('volcanic','ice_age','solar_storm','dust_epoch')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT false,
  rewards_json JSONB DEFAULT '[]',
  weather_weights JSONB DEFAULT '{}',
  visual_tint VARCHAR(20) DEFAULT 'rgba(255,80,30,0.06)',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS season_scores (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  score INT DEFAULT 0,
  pixels_claimed INT DEFAULT 0,
  harvests INT DEFAULT 0,
  hijacks_won INT DEFAULT 0,
  pois_discovered INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, wallet)
);

CREATE TABLE IF NOT EXISTS season_rewards (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  rank INT NOT NULL,
  reward_type VARCHAR(20) NOT NULL DEFAULT 'pp'
    CHECK (reward_type IN ('pp','gp','usdt','cosmetic','title')),
  reward_amount DECIMAL(20,6) DEFAULT 0,
  reward_meta JSONB DEFAULT '{}',
  claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_scores_season ON season_scores(season_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_season_scores_wallet ON season_scores(wallet);
CREATE INDEX IF NOT EXISTS idx_season_rewards_wallet ON season_rewards(wallet, claimed);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(active);

-- Insert first season
INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint)
VALUES (
  'Season 1: Volcanic Dawn',
  'volcanic',
  NOW(),
  NOW() + INTERVAL '30 days',
  true,
  '[{"rank":1,"type":"pp","amount":5000,"title":"Mars Conqueror"},{"rank":2,"type":"pp","amount":3000},{"rank":3,"type":"pp","amount":2000},{"rank":10,"type":"pp","amount":500},{"rank":50,"type":"gp","amount":100}]',
  '{"dust_storm":0.15,"meteor_shower":0.12,"solar_flare":0.08,"clear":0.65}',
  'rgba(255,80,30,0.06)'
)
ON CONFLICT DO NOTHING;
