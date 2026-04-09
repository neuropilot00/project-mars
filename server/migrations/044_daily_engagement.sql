-- 044: Daily Engagement System (GP as primary reward currency)

-- Add GP balance to individual users
ALTER TABLE users ADD COLUMN IF NOT EXISTS gp_balance DECIMAL(20,6) DEFAULT 0;

-- Daily login tracking
CREATE TABLE IF NOT EXISTS daily_logins (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_day INT NOT NULL DEFAULT 1,
  reward_gp DECIMAL(20,6) DEFAULT 0,
  reward_pp DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, login_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_logins_wallet ON daily_logins(wallet, login_date DESC);

-- Daily missions
CREATE TABLE IF NOT EXISTS daily_missions (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  slot INT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  mission_type VARCHAR(30) NOT NULL,
  target_value INT NOT NULL DEFAULT 1,
  current_value INT NOT NULL DEFAULT 0,
  reward_gp DECIMAL(20,6) NOT NULL DEFAULT 10,
  reward_xp INT DEFAULT 5,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  UNIQUE(wallet, mission_date, slot)
);
CREATE INDEX IF NOT EXISTS idx_daily_missions_wallet ON daily_missions(wallet, mission_date);

-- Settings
INSERT INTO settings (key, value, description, category) VALUES
  ('daily_login_gp_rewards', '[5,10,15,20,30,40,100]', 'GP rewards for days 1-7 of login streak', 'daily'),
  ('daily_login_pp_rewards', '[0,0,0,0,0,0,0.05]', 'PP rewards for days 1-7 (only day 7 gives tiny PP)', 'daily'),
  ('daily_mission_bonus_gp', '50', 'Bonus GP for completing all 3 daily missions', 'daily'),
  ('streak_7_gp', '200', 'GP bonus at 7-day milestone', 'daily'),
  ('streak_14_gp', '500', 'GP bonus at 14-day milestone', 'daily'),
  ('streak_30_gp', '1500', 'GP bonus at 30-day milestone', 'daily'),
  ('streak_30_pp', '0.5', 'PP bonus at 30-day milestone', 'daily')
ON CONFLICT (key) DO NOTHING;
