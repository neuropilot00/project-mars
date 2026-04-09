-- Add CHECK constraint to governance_transactions type column
ALTER TABLE governance_transactions DROP CONSTRAINT IF EXISTS gov_tx_type_check;
ALTER TABLE governance_transactions ADD CONSTRAINT gov_tx_type_check
  CHECK (type IN (
    'position_transfer','tax_income','pool_distribute',
    'maintenance','buff_purchase','event_spend','bounty_spend'
  ));
