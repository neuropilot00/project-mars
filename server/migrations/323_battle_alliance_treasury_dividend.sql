-- 323_battle_alliance_treasury_dividend.sql
-- Winning battle rewards also fund the winner's active alliance treasury.

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'reward_alliance_treasury_pct', '5',
   'Percent of a winning participant battle GP reward minted into their active alliance treasury.'),
  ('fleet', 'reward_alliance_treasury_cap_gp', '100',
   'Max alliance treasury GP dividend per winning battle participant. 0 means uncapped.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('323_battle_alliance_treasury_dividend.sql')
ON CONFLICT DO NOTHING;
