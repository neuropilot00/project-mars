-- Maintenance fee log table
CREATE TABLE IF NOT EXISTS maintenance_log (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  total_pixels INT NOT NULL,
  fee_amount DECIMAL(20,6) NOT NULL DEFAULT 0,
  pixels_abandoned INT NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_wallet ON maintenance_log(wallet);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_processed ON maintenance_log(processed_at DESC);

-- Track last maintenance run timestamp
INSERT INTO settings (key, value, description, category)
VALUES ('maintenance_last_run', '"1970-01-01T00:00:00.000Z"', 'Last maintenance fee processing timestamp', 'system')
ON CONFLICT (key) DO NOTHING;

-- Add maintenance_fee to allowed transaction types
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit','claim','hijack','battle_failed','swap','withdraw','withdraw_all',
    'mining','rank_reward','referral','quest','shop_purchase',
    'crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win',
    'dice_bet','dice_win',
    'hilo_bet','hilo_win',
    'maintenance_fee'
  ));
