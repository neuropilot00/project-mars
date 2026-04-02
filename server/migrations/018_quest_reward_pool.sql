-- ═══════════════════════════════════════════
--  018: Quest Reward Pool — sustainable economics
--  Rewards come from fee revenue, not thin air
-- ═══════════════════════════════════════════

-- Pool tracking table
CREATE TABLE IF NOT EXISTS quest_reward_pool (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  balance NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_funded NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_paid NUMERIC(14,4) NOT NULL DEFAULT 0,
  today_paid NUMERIC(14,4) NOT NULL DEFAULT 0,
  today_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the singleton row
INSERT INTO quest_reward_pool (id, balance) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Add pool-related settings
INSERT INTO settings (key, value) VALUES
  ('quest_pool_fee_rate', '0.20'),
  ('quest_daily_budget', '50'),
  ('quest_pool_min_balance', '1'),
  ('quest_reward_multiplier_min', '0.1'),
  ('quest_reward_multiplier_max', '1.5')
ON CONFLICT (key) DO NOTHING;
