-- Starter operations are isolated from onboarding and narrative campaign progress.
BEGIN;

CREATE TABLE IF NOT EXISTS starter_operation_progress (
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  mission_id VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'locked',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, mission_id),
  CHECK (mission_id IN ('first_sortie','secure_node','move_yield','restore_fleet','hold_front')),
  CHECK (status IN ('locked','active','completed','claimed'))
);

CREATE TABLE IF NOT EXISTS starter_operation_events (
  id BIGSERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  mission_id VARCHAR(40) NOT NULL,
  objective_key VARCHAR(40) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  source_created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (mission_id IN ('first_sortie','secure_node','move_yield','restore_fleet','hold_front')),
  UNIQUE (wallet_address, mission_id, objective_key, source_type, source_id),
  FOREIGN KEY (wallet_address, mission_id)
    REFERENCES starter_operation_progress(wallet_address, mission_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_starter_operation_events_source
  ON starter_operation_events(source_type, source_id);

CREATE TABLE IF NOT EXISTS starter_fleet_grants (
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  grant_code VARCHAR(40) NOT NULL,
  fleet_id BIGINT NOT NULL REFERENCES fleets(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, grant_code),
  UNIQUE (fleet_id)
);

CREATE TABLE IF NOT EXISTS starter_fleet_grant_ships (
  ship_id BIGINT PRIMARY KEY REFERENCES ships(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  grant_code VARCHAR(40) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (wallet_address, grant_code)
    REFERENCES starter_fleet_grants(wallet_address, grant_code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_starter_fleet_grant_ships_wallet
  ON starter_fleet_grant_ships(wallet_address);

INSERT INTO schema_migrations (filename)
VALUES ('338_mission_operations.sql')
ON CONFLICT DO NOTHING;

COMMIT;
