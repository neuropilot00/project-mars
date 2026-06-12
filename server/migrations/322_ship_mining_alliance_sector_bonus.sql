-- 322_ship_mining_alliance_sector_bonus.sql
-- Alliance-governed sectors give a capped same-tier resource run bonus.

INSERT INTO settings (category, key, value, description) VALUES
  ('mining', 'ship_mining_alliance_sector_bonus_pct', '5',
   'Ship mining bonus % per same-tier sector governed by your alliance.'),
  ('mining', 'ship_mining_alliance_sector_bonus_cap_pct', '25',
   'Maximum ship mining bonus % from alliance-governed sectors.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('322_ship_mining_alliance_sector_bonus.sql')
ON CONFLICT DO NOTHING;
