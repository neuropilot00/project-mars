-- ══════════════════════════════════════════════════════
--  070: Guild War Minigame Settings
-- ══════════════════════════════════════════════════════

INSERT INTO settings (key, value, description, category) VALUES
  ('guild_war_game_plays_per_day', '3', 'Max minigame plays per member per day during war', 'guild'),
  ('guild_war_game_score_multiplier', '1', 'Score multiplier for minigame points', 'guild')
ON CONFLICT (key) DO NOTHING;
