-- ══════════════════════════════════════════════════════
--  068: Season Pass System
-- ══════════════════════════════════════════════════════

-- Season Pass Tiers (free + premium tracks)
CREATE TABLE IF NOT EXISTS season_pass_tiers (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier INT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  reward_type VARCHAR(20) NOT NULL,
  reward_amount DECIMAL(20,6) DEFAULT 0,
  reward_meta JSONB DEFAULT '{}',
  xp_required INT NOT NULL,
  UNIQUE (season_id, tier, is_premium)
);

-- Player Season Pass Progress
CREATE TABLE IF NOT EXISTS season_pass_progress (
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  pass_xp INT DEFAULT 0,
  current_tier INT DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ,
  PRIMARY KEY (season_id, wallet)
);

-- Season Pass Tier Claims
CREATE TABLE IF NOT EXISTS season_pass_claims (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL,
  wallet VARCHAR(42) NOT NULL,
  tier INT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, wallet, tier, is_premium)
);

-- ── Season Pass Settings ──
INSERT INTO settings (key, value, description, category) VALUES
  ('season_pass_premium_cost_gp', '500', 'GP cost for premium season pass', 'season'),
  ('season_pass_xp_per_harvest', '5', 'Pass XP earned per harvest', 'season'),
  ('season_pass_xp_per_claim', '10', 'Pass XP earned per land claim', 'season'),
  ('season_pass_xp_per_invasion', '20', 'Pass XP earned per invasion launched', 'season'),
  ('season_pass_xp_per_exploration', '15', 'Pass XP earned per exploration', 'season'),
  ('season_pass_xp_per_quest', '25', 'Pass XP earned per quest completed', 'season'),
  ('season_pass_max_tier', '30', 'Maximum season pass tier', 'season'),
  ('season_pass_xp_per_tier', '100', 'Base XP needed per tier (scales 1.15x per level)', 'season')
ON CONFLICT (key) DO NOTHING;

-- Seed default tiers for existing active season (if any)
-- These will be generated dynamically if not present
