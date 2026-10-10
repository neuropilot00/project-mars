-- One-time recovery of the original starter hull IDs during the restore-fleet mission.
BEGIN;
CREATE TABLE IF NOT EXISTS starter_fleet_recoveries (
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  grant_code VARCHAR(40) NOT NULL,
  mission_id VARCHAR(40) NOT NULL DEFAULT 'restore_fleet' CHECK (mission_id='restore_fleet'),
  recovered_ship_ids BIGINT[] NOT NULL,
  recovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet_address, grant_code, mission_id),
  FOREIGN KEY (wallet_address, grant_code)
    REFERENCES starter_fleet_grants(wallet_address, grant_code) ON DELETE CASCADE
);
INSERT INTO schema_migrations(filename)
VALUES ('347_starter_fleet_recovery.sql')
ON CONFLICT DO NOTHING;
COMMIT;
