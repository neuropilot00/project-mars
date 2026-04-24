-- Migration 153: Fix missing columns on production DB
-- Several earlier features added columns via direct psql ALTER on local DB
-- without shipping the corresponding migration file. Production (Railway)
-- never received those ALTERs, so /api/referral, /api/onboarding,
-- /api/season/leaderboard all 500 on production. This migration re-applies
-- those ALTERs idempotently so both local and prod converge.
--
-- Safe to re-run: every statement is IF NOT EXISTS.

-- ─── 1. referral_rewards: GP commission tracking (archived 099) ───
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS gp_amount DECIMAL(20,6) NOT NULL DEFAULT 0;
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS currency  VARCHAR(10)   NOT NULL DEFAULT 'pp';
CREATE INDEX IF NOT EXISTS idx_referral_rewards_to_gp
  ON referral_rewards(to_wallet, currency, created_at DESC);

-- ─── 2. user_onboarding: Tutorial v2 extra state (missing from commit 745553d) ───
ALTER TABLE user_onboarding
  ADD COLUMN IF NOT EXISTS job_selected VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shield_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gp_rewarded  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pp_rewarded  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS title_given  BOOLEAN DEFAULT FALSE;

-- ─── 3. season_scores: additional scoring categories ───
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS enhancements_done INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trades_completed  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naval_wins        INT DEFAULT 0;
