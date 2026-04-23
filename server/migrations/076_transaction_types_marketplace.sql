-- Expand transaction types for marketplace & enhancement system
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
    'pp_to_gp_exchange','war_game_continue',
    'enhance_attempt',
    'marketplace_sale','marketplace_fee','marketplace_listing_fee',
    'marketplace_bid_hold','marketplace_bid_refund'
  ));
