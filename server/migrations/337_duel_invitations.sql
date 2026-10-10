-- Fleet PvP requires explicit defender consent. Pending invitations occupy no fleet.
CREATE TABLE IF NOT EXISTS fleet_duel_invitations (
  id BIGSERIAL PRIMARY KEY,
  inviter_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  defender_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  inviter_fleet_id BIGINT NOT NULL REFERENCES fleets(id),
  defender_fleet_id BIGINT NOT NULL REFERENCES fleets(id),
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired')),
  fleet_snapshot JSONB NOT NULL,
  loss_terms JSONB NOT NULL,
  terms_token VARCHAR(64) NOT NULL,
  battle_id BIGINT UNIQUE REFERENCES fleet_battles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (inviter_wallet <> defender_wallet),
  CHECK (inviter_fleet_id <> defender_fleet_id),
  CHECK ((status = 'accepted') = (battle_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS fleet_duel_pending_pair ON fleet_duel_invitations
  (LEAST(inviter_fleet_id, defender_fleet_id), GREATEST(inviter_fleet_id, defender_fleet_id))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS fleet_duel_inviter ON fleet_duel_invitations(inviter_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS fleet_duel_defender ON fleet_duel_invitations(defender_wallet, created_at DESC);
INSERT INTO schema_migrations(filename) VALUES ('337_duel_invitations.sql') ON CONFLICT DO NOTHING;
