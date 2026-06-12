BEGIN;

INSERT INTO settings (category, key, value, description) VALUES
  ('alliance', 'alliance_withdraw_min_gp', '10', 'Minimum alliance treasury withdrawal amount'),
  ('alliance', 'alliance_withdraw_fee_pct', '5', 'Alliance treasury withdrawal fee percentage burned')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('321_alliance_treasury_withdraw_settings.sql')
ON CONFLICT DO NOTHING;

COMMIT;
