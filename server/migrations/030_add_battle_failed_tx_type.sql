-- Add 'battle_failed' and 'shop_purchase' to transactions type check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit','claim','hijack','battle_failed','swap','withdraw','withdraw_all',
    'mining','rank_reward','referral','quest','shop_purchase',
    'crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win',
    'dice_bet','dice_win',
    'hilo_bet','hilo_win'
  ));
