-- Migration 149: GP Territory Tombstone
-- When a territory changes hands (hijack), the previous owner can pay GP
-- to leave a permanent tombstone/epitaph on the territory.
-- Multiple tombstones can exist per territory, visible as history.

CREATE TABLE IF NOT EXISTS territory_tombstones (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  wallet      TEXT         NOT NULL,
  epitaph     VARCHAR(60)  NOT NULL DEFAULT 'I was here.',
  gp_paid     INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tombstone_claim ON territory_tombstones(claim_id);
CREATE INDEX IF NOT EXISTS idx_tombstone_wallet ON territory_tombstones(wallet);

-- Settings
INSERT INTO settings (key, value, category, description) VALUES
  ('tombstone_enabled',    'true', 'tombstone', 'Enable Territory Tombstones'),
  ('tombstone_cost_gp',    '35',   'tombstone', 'GP cost to place a tombstone'),
  ('tombstone_max_length', '60',   'tombstone', 'Max epitaph length'),
  ('tombstone_max_per_claim', '5', 'tombstone', 'Max tombstones per territory'),
  ('tombstone_require_prev_owner', 'true', 'tombstone', 'Require wallet was previous owner')
ON CONFLICT (key) DO NOTHING;
