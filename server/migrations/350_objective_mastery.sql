-- Bounded account reward: one first-clear receipt per registered operation mode.
CREATE TABLE IF NOT EXISTS objective_operation_claims (
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  mode VARCHAR(24) NOT NULL CHECK(mode IN('escort','hold','flagship')),
  battle_id BIGINT NOT NULL REFERENCES objective_operation_runs(battle_id),
  rewards JSONB NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(wallet_address,mode)
);
CREATE INDEX IF NOT EXISTS idx_objective_mastery_history ON objective_operation_runs(wallet_address,mode,started_at DESC);
INSERT INTO schema_migrations(filename) VALUES('350_objective_mastery.sql') ON CONFLICT DO NOTHING;
