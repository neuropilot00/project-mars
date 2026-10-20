-- Finalized receipts are identified by chain + transaction + log, not tx alone.
-- Legacy rows cannot be assigned a log/hash without chain evidence. -1 is a
-- conservative tombstone: replay must not credit their transaction a second time.
LOCK TABLE deposits IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS log_index INTEGER NOT NULL DEFAULT -1;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS block_hash TEXT;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_tx_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposit_chain_log ON deposits (chain, tx_hash, log_index);
INSERT INTO schema_migrations (filename) VALUES ('357_deposit_finality_identity.sql') ON CONFLICT DO NOTHING;
