-- Transport routes into stronger sectors pay a configurable risk premium.

INSERT INTO settings (category, key, value, description) VALUES
  ('transport', 'transport_mid_tier_reward_bonus_pct', '5',
   'Additional transport reward % for shipments whose destination sector tier is mid.'),
  ('transport', 'transport_core_tier_reward_bonus_pct', '12',
   'Additional transport reward % for shipments whose destination sector tier is core.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('325_transport_tier_reward_bonus.sql')
ON CONFLICT DO NOTHING;
