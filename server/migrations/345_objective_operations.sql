-- Only server-registered NPC operations may use objective/safe-loss rules.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_objective_npc BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS objective_operation_runs (
  battle_id BIGINT PRIMARY KEY REFERENCES fleet_battles(id),
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  mode VARCHAR(24) NOT NULL CHECK(mode IN('escort','hold','flagship')),
  request_key UUID NOT NULL,
  fleet_ids JSONB NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK(status IN('queued','active','succeeded','failed','aborted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  result JSONB,
  UNIQUE(wallet_address,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_objective_one_active_wallet ON objective_operation_runs(wallet_address) WHERE status IN('queued','active');
INSERT INTO schema_migrations(filename) VALUES('345_objective_operations.sql') ON CONFLICT DO NOTHING;
