-- 058: Guild Upgrades
--
-- Adds: guild levels, PP treasury (separate from existing gp_treasury),
-- per-member contribution slider, research perks, raid records.

-- New guild columns -----------------------------------------------------
ALTER TABLE guilds
  ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pp_treasury NUMERIC(20,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS research_flags JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raid_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_raid_at TIMESTAMPTZ DEFAULT NULL;

-- Per-member treasury contribution rate (0-30%), stored on guild_members
ALTER TABLE guild_members
  ADD COLUMN IF NOT EXISTS pp_contribution_pct INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS total_contributed NUMERIC(20,6) DEFAULT 0;

-- Treasury ledger: full audit trail of every credit/debit --------------
CREATE TABLE IF NOT EXISTS guild_treasury_ledger (
  id SERIAL PRIMARY KEY,
  guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  wallet VARCHAR(42) DEFAULT NULL,                -- NULL for system entries
  kind VARCHAR(24) NOT NULL,                      -- 'harvest_contrib', 'buff_spend', 'levelup', 'raid_reward', 'research'...
  delta_pp NUMERIC(20,6) NOT NULL,                -- positive = credit, negative = debit
  balance_after NUMERIC(20,6) NOT NULL,
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guild_ledger_guild_time
  ON guild_treasury_ledger(guild_id, created_at DESC);

-- Guild raids: coordinated multi-member invasions ----------------------
CREATE TABLE IF NOT EXISTS guild_raids (
  id SERIAL PRIMARY KEY,
  guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  target_wallet VARCHAR(42) NOT NULL,
  target_lat FLOAT NOT NULL,
  target_lng FLOAT NOT NULL,
  declared_by VARCHAR(42) NOT NULL,
  declared_at TIMESTAMPTZ DEFAULT NOW(),
  participant_count INT DEFAULT 1,
  participants JSONB DEFAULT '[]'::jsonb,         -- list of wallets that joined
  status VARCHAR(16) DEFAULT 'forming'
    CHECK (status IN ('forming','active','complete','cancelled')),
  result_json JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_guild_raids_guild_status
  ON guild_raids(guild_id, status);

-- Settings -------------------------------------------------------------
INSERT INTO settings (key, value, category, description) VALUES
  -- Guild leveling
  ('guild_level_max',              '6',   'guilds', 'Max guild level'),
  ('guild_level_2_cost_pp',        '500', 'guilds', 'PP treasury cost to reach level 2'),
  ('guild_level_3_cost_pp',        '2000','guilds', 'PP treasury cost to reach level 3'),
  ('guild_level_4_cost_pp',        '8000','guilds', 'PP treasury cost to reach level 4'),
  ('guild_level_5_cost_pp',        '25000','guilds','PP treasury cost to reach level 5'),
  ('guild_level_6_cost_pp',        '80000','guilds','PP treasury cost to reach level 6'),
  -- Member slot bonuses per level (total = base 20 + sum of these)
  ('guild_level_2_member_bonus',   '2',   'guilds', '+2 member slots at Lv.2'),
  ('guild_level_3_member_bonus',   '3',   'guilds', '+3 member slots at Lv.3'),
  ('guild_level_4_member_bonus',   '3',   'guilds', '+3 member slots at Lv.4'),
  ('guild_level_5_member_bonus',   '4',   'guilds', '+4 member slots at Lv.5'),
  ('guild_level_6_member_bonus',   '5',   'guilds', '+5 member slots at Lv.6'),

  -- Treasury contribution
  ('guild_contrib_min_pct',        '0',   'guilds', 'Min per-member treasury contribution %'),
  ('guild_contrib_max_pct',        '30',  'guilds', 'Max per-member treasury contribution %'),
  ('guild_contrib_default_pct',    '5',   'guilds', 'Default new-member contribution %'),

  -- Guild raid
  ('guild_raid_min_participants',  '3',   'guilds', 'Min members to launch a raid'),
  ('guild_raid_cooldown_hours',    '6',   'guilds', 'Hours between guild raids'),
  ('guild_raid_success_bonus',     '0.15','guilds', 'Flat success rate bonus'),
  ('guild_raid_steal_multiplier',  '1.5', 'guilds', 'Multiplier on pixels stolen'),

  -- Sector shelter (cluster bonus when 5+ members hold pixels in same sector)
  ('guild_shelter_min_members',    '5',   'guilds', 'Min same-sector members for shelter'),
  ('guild_shelter_defense_bonus',  '0.15','guilds', 'Defense rate bonus for shelter'),

  -- Research costs (JSON not needed — flat prices)
  ('guild_research_mining_eff_1_pp',    '1000','guilds', 'Research: Mining Efficiency I'),
  ('guild_research_shield_disc_pp',     '1000','guilds', 'Research: Shield Discipline'),
  ('guild_research_diplomatic_pp',      '1000','guilds', 'Research: Diplomatic Immunity'),
  ('guild_research_orbital_scan_pp',    '5000','guilds', 'Research: Orbital Scanning'),
  ('guild_research_rapid_deploy_pp',    '5000','guilds', 'Research: Rapid Deployment'),
  ('guild_research_logistics_pp',       '5000','guilds', 'Research: Logistics Network'),
  ('guild_research_mars_dominion_pp',   '20000','guilds','Research: Mars Dominion')
ON CONFLICT (key) DO NOTHING;
