-- Migration 071: PP → GP Exchange & Guild War Continue Settings
--
-- Adds admin-configurable settings for:
--   1. PP → GP Exchange — lets players convert PP (real-money token) into GP
--      at a configurable rate. Acts as a PP sink (deflationary for PP supply).
--   2. Guild War Continues — tiered continue costs (GP for first 3, then PP).

-- PP → GP Exchange Settings
INSERT INTO settings (key, value, description, category) VALUES
  ('pp_to_gp_exchange_rate', '4', 'How much GP per 1 PP exchanged', 'economy'),
  ('pp_to_gp_exchange_min', '0.1', 'Minimum PP per exchange transaction', 'economy'),
  ('pp_to_gp_exchange_max', '10', 'Maximum PP per single exchange', 'economy'),
  ('pp_to_gp_exchange_fee_pct', '5', 'Fee percentage on PP→GP exchange (PP burned)', 'economy'),
  ('pp_to_gp_exchange_daily_limit', '50', 'Max PP exchangeable per wallet per day', 'economy'),
  ('pp_to_gp_exchange_enabled', 'true', 'Enable/disable PP→GP exchange', 'economy')
ON CONFLICT (key) DO NOTHING;

-- Guild War Continue Settings
INSERT INTO settings (key, value, description, category) VALUES
  ('guild_war_continue_gp_costs', '[5,15,30]', 'GP costs for continues 1-3 (JSON array)', 'guild'),
  ('guild_war_continue_pp_base', '0.1', 'Base PP cost for continue #4+', 'guild'),
  ('guild_war_continue_pp_multiplier', '2', 'PP cost multiplier per additional continue', 'guild'),
  ('guild_war_continue_max', '10', 'Maximum continues per game session', 'guild')
ON CONFLICT (key) DO NOTHING;

-- Add new transaction types to constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit','claim','hijack','battle_failed','swap','withdraw','withdraw_all',
    'mining','rank_reward','referral','quest','shop_purchase',
    'crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win',
    'dice_bet','dice_win',
    'hilo_bet','hilo_win',
    'maintenance_fee',
    'instant_harvest','rename_fee','poi_hint','loot_priority','auto_renew',
    'pp_to_gp_exchange','war_game_continue'
  ));
