-- Migration 219: Add current_bid and current_bidder_wallet to auctions table
-- These columns are required by auction.js service but were missing from the schema

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS current_bid NUMERIC(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_bidder_wallet VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL;

-- Sync current_bid from current_price for any existing rows
UPDATE auctions SET current_bid = current_price WHERE current_bid = 0 AND current_price > 0;

-- Sync current_bidder_wallet from winner_wallet for settled auctions
UPDATE auctions SET current_bidder_wallet = winner_wallet WHERE current_bidder_wallet IS NULL AND winner_wallet IS NOT NULL;

-- Index for bidder lookups
CREATE INDEX IF NOT EXISTS idx_auctions_current_bidder ON auctions(current_bidder_wallet) WHERE current_bidder_wallet IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('219_auction_current_bid_columns.sql') ON CONFLICT DO NOTHING;
