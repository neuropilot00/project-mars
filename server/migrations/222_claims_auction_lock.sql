-- Active auction code uses claims.auction_locked to prevent a territory from
-- being listed twice or hijacked/sold while escrowed. The column previously
-- existed only in an archived migration, so fresh deployments could miss it.
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS auction_locked BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_claims_auction_locked
  ON claims(auction_locked)
  WHERE auction_locked = TRUE;

INSERT INTO schema_migrations (filename)
VALUES ('222_claims_auction_lock.sql')
ON CONFLICT DO NOTHING;
