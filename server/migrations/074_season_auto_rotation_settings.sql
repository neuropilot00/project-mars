-- Season auto-rotation settings
INSERT INTO settings (key, value, description, category)
VALUES
  ('season_auto_rotation', 'true', 'Enable automatic season rotation when current season ends', 'season'),
  ('season_duration_days', '30', 'Duration of each auto-created season in days', 'season')
ON CONFLICT (key) DO NOTHING;
