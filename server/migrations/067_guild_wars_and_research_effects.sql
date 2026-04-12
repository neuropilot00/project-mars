-- ══════════════════════════════════════════════════════
--  067: Guild Wars + Research Effect Settings
-- ══════════════════════════════════════════════════════

-- Guild Wars table
CREATE TABLE IF NOT EXISTS guild_wars (
  id SERIAL PRIMARY KEY,
  attacker_guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  defender_guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  declared_by VARCHAR(42) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'declared'
    CHECK (status IN ('declared','active','resolved','cancelled')),
  war_start TIMESTAMPTZ,
  war_end TIMESTAMPTZ,
  duration_hours INT DEFAULT 24,
  attacker_score INT DEFAULT 0,
  defender_score INT DEFAULT 0,
  winner_guild_id INT,
  reward_pp DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guild_wars_status ON guild_wars(status);
CREATE INDEX IF NOT EXISTS idx_guild_wars_attacker ON guild_wars(attacker_guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_wars_defender ON guild_wars(defender_guild_id);

-- Guild War Actions (kill feed / score log)
CREATE TABLE IF NOT EXISTS guild_war_actions (
  id SERIAL PRIMARY KEY,
  war_id INT NOT NULL REFERENCES guild_wars(id) ON DELETE CASCADE,
  guild_id INT NOT NULL,
  wallet VARCHAR(42) NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  points INT DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gwa_war ON guild_war_actions(war_id);

-- ── Research Effect Settings ──
-- Each research has a bonus % stored in settings for admin tuning
INSERT INTO settings (key, value, description, category) VALUES
  ('guild_research_mining_eff_1_bonus', '3', 'Mining Efficiency I: +X% harvest PP for guild members (small bonus)', 'guild'),
  ('guild_research_shield_disc_bonus', '15', 'Shield Discipline: +X% defense (reduce invasion success against members)', 'guild'),
  ('guild_research_diplomatic_bonus', '10', 'Diplomatic Immunity: -X% invasion success against guild members', 'guild'),
  ('guild_research_orbital_scan_bonus', '15', 'Orbital Scanning: +X% exploration rewards', 'guild'),
  ('guild_research_rapid_deploy_bonus', '20', 'Rapid Deployment: -X% mission travel time', 'guild'),
  ('guild_research_logistics_bonus', '10', 'Logistics Network: -X% claim costs', 'guild'),
  ('guild_research_mars_dominion_bonus', '5', 'Mars Dominion: +X% all bonuses stacked', 'guild')
ON CONFLICT (key) DO NOTHING;

-- ── Guild War Settings ──
INSERT INTO settings (key, value, description, category) VALUES
  ('guild_war_cooldown_hours', '48', 'Hours between declaring wars (per guild pair)', 'guild'),
  ('guild_war_duration_hours', '24', 'Default war duration in hours', 'guild'),
  ('guild_war_min_members', '3', 'Minimum members to declare war', 'guild'),
  ('guild_war_declare_cost_gp', '200', 'GP cost from treasury to declare war', 'guild'),
  ('guild_war_hijack_points', '10', 'Points for hijacking enemy territory during war', 'guild'),
  ('guild_war_defend_points', '5', 'Points for defending against enemy during war', 'guild'),
  ('guild_war_harvest_points', '1', 'Points per harvest during war', 'guild'),
  ('guild_war_winner_gp', '500', 'GP reward for winning guild', 'guild'),
  ('guild_war_max_active', '1', 'Max simultaneous active wars per guild', 'guild')
ON CONFLICT (key) DO NOTHING;
