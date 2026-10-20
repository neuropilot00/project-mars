-- Existing auctions have no reliable resource/currency escrow provenance.
-- Leave their balances/assets untouched; require reconciliation before writes.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS escrow_version SMALLINT NOT NULL DEFAULT 0;
COMMENT ON COLUMN auctions.escrow_version IS '0: unproven legacy escrow, review required; 1: created after verified transactional escrow';
