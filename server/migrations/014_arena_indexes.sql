-- Arena performance indexes
CREATE INDEX IF NOT EXISTS idx_crash_rounds_status ON crash_rounds (status);
CREATE INDEX IF NOT EXISTS idx_crash_bets_round_id ON crash_bets (round_id);
CREATE INDEX IF NOT EXISTS idx_crash_bets_wallet ON crash_bets (wallet);
CREATE INDEX IF NOT EXISTS idx_mines_games_wallet_status ON mines_games (wallet, status);
CREATE INDEX IF NOT EXISTS idx_transactions_type_created ON transactions (type, created_at);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims (created_at);
CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels (owner);
