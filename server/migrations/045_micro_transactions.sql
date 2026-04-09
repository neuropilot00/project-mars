-- 045: Micro-transactions ("drizzle revenue") system
-- Auto-renewal, instant harvest, territory rename, POI hints, loot priority

-- Add auto_renew flag to active effects
ALTER TABLE user_active_effects ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
-- Store the item code that created this effect (for re-purchase)
ALTER TABLE user_active_effects ADD COLUMN IF NOT EXISTS source_item_code VARCHAR(20) DEFAULT NULL;

-- Add auto_renew flag to pixel shields
ALTER TABLE pixel_shields ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

-- Add custom territory name to claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS custom_name VARCHAR(20) DEFAULT NULL;

-- Loot priority tracking
CREATE TABLE IF NOT EXISTS loot_priority_claims (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  rocket_event_id INT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(wallet, rocket_event_id)
);
CREATE INDEX IF NOT EXISTS idx_loot_priority_wallet ON loot_priority_claims(wallet);

-- Update transaction type check to include new micro-transaction types
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
    'instant_harvest','rename_fee','poi_hint','loot_priority','auto_renew'
  ));

-- Settings for micro-transaction costs
INSERT INTO settings (key, value, description, category) VALUES
  ('instant_harvest_cost_pp', '0.5', 'PP cost to skip harvest cooldown', 'micro'),
  ('rename_cost_pp', '0.3', 'PP cost to rename territory', 'micro'),
  ('poi_hint_cost_pp', '0.2', 'PP cost for POI direction hint', 'micro'),
  ('loot_priority_cost_pp', '0.3', 'PP cost for rocket loot priority notification', 'micro')
ON CONFLICT (key) DO NOTHING;
