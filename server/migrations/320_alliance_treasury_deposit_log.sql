BEGIN;

CREATE TABLE IF NOT EXISTS alliance_log (
  id BIGSERIAL PRIMARY KEY,
  alliance_id BIGINT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  wallet VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  amount_gp INTEGER DEFAULT 0,
  note VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alliance_log_alliance_created
  ON alliance_log(alliance_id, created_at DESC);

INSERT INTO schema_migrations (filename)
VALUES ('320_alliance_treasury_deposit_log.sql')
ON CONFLICT DO NOTHING;

COMMIT;
