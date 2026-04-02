-- Add 'mining' and 'rank_reward' to transactions type check
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all','mining','rank_reward','referral'));
