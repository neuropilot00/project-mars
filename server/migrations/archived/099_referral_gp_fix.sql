-- Migration 099: Referral GP Commission Fix
-- The referral_rewards table previously only tracked PP amounts.
-- GP-based commissions (enhance, marketplace, ship_build, etc.) were
-- incorrectly credited to pp_balance. This migration adds gp_amount tracking
-- and the currency column so each reward row is self-describing.

-- Add gp_amount column to record GP-denominated commissions
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS gp_amount DECIMAL(20,6) NOT NULL DEFAULT 0;

-- Add explicit currency column for clarity
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'pp';

-- Index for fast GP earnings queries
CREATE INDEX IF NOT EXISTS idx_referral_rewards_to_gp
  ON referral_rewards(to_wallet, currency, created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('referral_gp_enabled', 'true', 'Enable GP commissions flowing through referral tree', 'referral'),
  ('referral_show_gp_earnings', 'true', 'Show GP earnings in player referral dashboard', 'referral')
ON CONFLICT (key) DO NOTHING;
