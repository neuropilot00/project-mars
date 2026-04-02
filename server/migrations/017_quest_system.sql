-- ═══════════════════════════════════════════
--  017: Quest System — random generation, 3 tiers
-- ═══════════════════════════════════════════

-- Drop old quest tables if they exist (schema mismatch)
DROP TABLE IF EXISTS user_quests CASCADE;
DROP TABLE IF EXISTS quest_templates CASCADE;

-- Quest templates: defines possible quest types
CREATE TABLE quest_templates (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('free','activity','spending')),
  quest_type VARCHAR(30) NOT NULL,
  title_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  requirement_type VARCHAR(30) NOT NULL,
  requirement_min NUMERIC NOT NULL DEFAULT 1,
  requirement_max NUMERIC NOT NULL DEFAULT 1,
  reward_pp_min NUMERIC(12,4) NOT NULL DEFAULT 1,
  reward_pp_max NUMERIC(12,4) NOT NULL DEFAULT 10,
  cooldown_hours INT NOT NULL DEFAULT 24,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active quests assigned to users
CREATE TABLE user_quests (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(255) NOT NULL,
  template_id INT REFERENCES quest_templates(id),
  tier VARCHAR(10) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement_type VARCHAR(30) NOT NULL,
  requirement_value NUMERIC NOT NULL,
  current_progress NUMERIC NOT NULL DEFAULT 0,
  reward_pp NUMERIC(12,4) NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','claimed','expired')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_quests_wallet ON user_quests(wallet);
CREATE INDEX IF NOT EXISTS idx_user_quests_status ON user_quests(wallet, status);

-- Add 'quest' to transaction types
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all','mining','rank_reward','referral','quest'));

-- ═══ Seed quest templates ═══

INSERT INTO quest_templates (tier, quest_type, title_template, description_template, requirement_type, requirement_min, requirement_max, reward_pp_min, reward_pp_max, cooldown_hours) VALUES
-- FREE tier (1PP=$1, so 1~5 cents max)
('free','daily_login','Daily Recon','Commander, report to HQ. Your daily check-in keeps the colony alive.','login',1,1,0.01,0.03,24),
('free','view_sectors','Orbital Survey','Scan {n} sector reports from mission control. Knowledge is power on Mars.','view_sectors',2,5,0.02,0.05,24),
('free','view_leaderboard','Intel Briefing','Review the colony leaderboard. Know your allies and rivals.','view_leaderboard',1,1,0.01,0.02,24),
('free','first_pixel','First Footprint','Claim your first pixel on Mars. One small step for a colonist.','claim_pixels',1,1,0.03,0.05,0),
('free','visit_base','Base Inspection','Open your Base dashboard and review colony status.','visit_base',1,1,0.01,0.02,24),

-- ACTIVITY tier (5~50 cents)
('activity','claim_pixels','Territory Expansion','Claim {n} new pixels to expand your Martian territory.','claim_pixels',3,15,0.05,0.20,24),
('activity','claim_in_sector','Sector Conquest','Claim {n} pixels in a specific sector. Strategic positioning matters.','claim_pixels_sector',5,20,0.08,0.25,24),
('activity','harvest_mining','Dust Collector','Harvest your mining rewards. The red dust holds valuable resources.','harvest',1,1,0.05,0.10,24),
('activity','explore_sectors','Deep Scan','Explore {n} different sectors on the Mars globe.','explore_sectors',3,6,0.06,0.15,24),
('activity','consecutive_login','Endurance Mission','Log in for {n} consecutive days. Persistence builds empires.','consecutive_login',3,7,0.10,0.50,168),

-- SPENDING tier (cashback 2~5% of spend, $0.30~$1.50)
('spending','spend_usdt','Supply Drop','Deposit {n} USDT to fund your Mars colony operations.','deposit_usdt',5,50,0.30,1.00,48),
('spending','premium_claim','Premium Territory','Claim {n} pixels in Core sector zones. Premium land for ambitious colonists.','claim_core_pixels',5,15,0.40,0.80,48),
('spending','big_expansion','Manifest Destiny','Claim {n} total pixels in a single session. Go big or go home.','claim_pixels',20,50,0.50,1.50,72),
('spending','swap_tokens','Resource Exchange','Swap {n} USDT worth of tokens at the Mars Exchange.','swap_usdt',10,30,0.30,0.80,48);
