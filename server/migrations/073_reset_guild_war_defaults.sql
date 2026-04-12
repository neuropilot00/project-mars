-- Reset guild war settings to production defaults (undo test overrides)
UPDATE settings SET value = '48' WHERE key = 'guild_war_cooldown_hours';
UPDATE settings SET value = '24' WHERE key = 'guild_war_duration_hours';
UPDATE settings SET value = '1' WHERE key = 'guild_war_min_members';
UPDATE settings SET value = '200' WHERE key = 'guild_war_declare_cost_gp';
UPDATE settings SET value = '10' WHERE key = 'guild_war_hijack_points';
UPDATE settings SET value = '5' WHERE key = 'guild_war_defend_points';
UPDATE settings SET value = '1' WHERE key = 'guild_war_harvest_points';
UPDATE settings SET value = '500' WHERE key = 'guild_war_winner_gp';
UPDATE settings SET value = '1' WHERE key = 'guild_war_max_active';
UPDATE settings SET value = '3' WHERE key = 'guild_war_game_plays_per_day';
UPDATE settings SET value = '1' WHERE key = 'guild_war_game_score_multiplier';
UPDATE settings SET value = '[5,15,30]' WHERE key = 'guild_war_continue_gp_costs';
UPDATE settings SET value = '0.1' WHERE key = 'guild_war_continue_pp_base';
UPDATE settings SET value = '2' WHERE key = 'guild_war_continue_pp_multiplier';
UPDATE settings SET value = '10' WHERE key = 'guild_war_continue_max';
