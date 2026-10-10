-- Existing GP pass rewards and seasons are intentionally preserved.
-- Record committed industrial actions independently from browser requests.
CREATE TABLE IF NOT EXISTS season_pass_contributions (
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  source_type TEXT NOT NULL CHECK (source_type IN ('production','delivery','repair')),
  source_id BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_day DATE NOT NULL,
  xp INT NOT NULL CHECK (xp BETWEEN 0 AND 10000),
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, wallet, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS season_pass_contributions_day
  ON season_pass_contributions(season_id, wallet, event_day);

INSERT INTO settings(key,value,description,category) VALUES
  ('season_pass_industry_daily_xp_cap','100','Daily pass XP cap for committed industrial contributions; actual event day','season'),
  ('season_pass_xp_per_production','5','Pass XP per committed industrial collection','season'),
  ('season_pass_xp_per_delivery','10','Pass XP per arrived industrial cargo','season'),
  ('season_pass_xp_per_repair','5','Pass XP per completed industrial repair','season'),
  ('cosmetic_equip_fee_pp','0','PP fee for equipping owned cosmetics; default free','micro')
ON CONFLICT(key) DO NOTHING;

-- Replace the previous shipped 0.5 PP default only. Preserve custom admin fees.
UPDATE settings SET value='0'::jsonb,
  description='PP fee for equipping owned cosmetics; default free (349)'
WHERE key='cosmetic_equip_fee_pp'
  AND value #>> '{}' IN ('0.5','0.50','0.500000');

INSERT INTO schema_migrations(filename) VALUES('349_gp_pass_cosmetic_foundation.sql')
ON CONFLICT DO NOTHING;
