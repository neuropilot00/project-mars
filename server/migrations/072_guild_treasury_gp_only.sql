-- ══════════════════════════════════════════════════════
--  072: Guild Treasury — Convert PP to GP
--  PP = real money. Guild treasury must run on GP only.
-- ══════════════════════════════════════════════════════

-- Merge any PP treasury into GP treasury (at 4:1 rate, matching pp_to_gp_exchange_rate)
UPDATE guilds SET gp_treasury = COALESCE(gp_treasury, 0) + COALESCE(pp_treasury, 0) * 4;

-- Research costs: replace PP costs with GP costs
UPDATE settings SET key = 'guild_research_mining_eff_1_gp', value = '500', description = 'Research cost: Mining Efficiency I (GP)' WHERE key = 'guild_research_mining_eff_1_pp';
UPDATE settings SET key = 'guild_research_shield_disc_gp', value = '500', description = 'Research cost: Shield Discipline (GP)' WHERE key = 'guild_research_shield_disc_pp';
UPDATE settings SET key = 'guild_research_diplomatic_gp', value = '500', description = 'Research cost: Diplomatic Immunity (GP)' WHERE key = 'guild_research_diplomatic_pp';
UPDATE settings SET key = 'guild_research_orbital_scan_gp', value = '2000', description = 'Research cost: Orbital Scanning (GP)' WHERE key = 'guild_research_orbital_scan_pp';
UPDATE settings SET key = 'guild_research_rapid_deploy_gp', value = '2000', description = 'Research cost: Rapid Deployment (GP)' WHERE key = 'guild_research_rapid_deploy_pp';
UPDATE settings SET key = 'guild_research_logistics_gp', value = '2000', description = 'Research cost: Logistics Network (GP)' WHERE key = 'guild_research_logistics_pp';
UPDATE settings SET key = 'guild_research_mars_dominion_gp', value = '5000', description = 'Research cost: Mars Dominion (GP)' WHERE key = 'guild_research_mars_dominion_pp';

-- Level costs: replace PP costs with GP costs
UPDATE settings SET key = 'guild_level_2_cost_gp', value = '200', description = 'GP treasury cost to reach level 2' WHERE key = 'guild_level_2_cost_pp';
UPDATE settings SET key = 'guild_level_3_cost_gp', value = '500', description = 'GP treasury cost to reach level 3' WHERE key = 'guild_level_3_cost_pp';
UPDATE settings SET key = 'guild_level_4_cost_gp', value = '1500', description = 'GP treasury cost to reach level 4' WHERE key = 'guild_level_4_cost_pp';
UPDATE settings SET key = 'guild_level_5_cost_gp', value = '5000', description = 'GP treasury cost to reach level 5' WHERE key = 'guild_level_5_cost_pp';
UPDATE settings SET key = 'guild_level_6_cost_gp', value = '15000', description = 'GP treasury cost to reach level 6' WHERE key = 'guild_level_6_cost_pp';

-- Rename contribution column (GP contribution, not PP)
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS gp_contribution_pct INT DEFAULT 5;
UPDATE guild_members SET gp_contribution_pct = COALESCE(pp_contribution_pct, 5);

-- Rename ledger column
ALTER TABLE guild_treasury_ledger ADD COLUMN IF NOT EXISTS delta_gp NUMERIC(20,6) DEFAULT 0;
UPDATE guild_treasury_ledger SET delta_gp = COALESCE(delta_pp, 0) * 4;

-- Update contribution setting names
UPDATE settings SET key = 'guild_contrib_default_pct', value = '5' WHERE key = 'guild_contrib_default_pct';
