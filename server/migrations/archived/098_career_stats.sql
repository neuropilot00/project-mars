-- Migration 098: Career Stats & Category Leaderboard Optimizations
-- Adds composite indexes for fast per-category season leaderboard queries
-- and settings for the career stats system

-- Fast category leaderboard queries
CREATE INDEX IF NOT EXISTS idx_season_scores_enhancements
  ON season_scores(season_id, enhancements_done DESC)
  WHERE enhancements_done > 0;

CREATE INDEX IF NOT EXISTS idx_season_scores_trades
  ON season_scores(season_id, trades_completed DESC)
  WHERE trades_completed > 0;

CREATE INDEX IF NOT EXISTS idx_season_scores_naval
  ON season_scores(season_id, naval_wins DESC)
  WHERE naval_wins > 0;

CREATE INDEX IF NOT EXISTS idx_season_scores_ships
  ON season_scores(season_id, ships_built DESC)
  WHERE ships_built > 0;

-- Career stats settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('career_stats_enabled',    'true', 'Show career stats to players', 'system'),
  ('career_stats_public',     'true', 'Allow viewing other players career stats', 'system'),
  ('category_lb_size',        '10',   'Number of entries per category leaderboard', 'season')
ON CONFLICT (key) DO NOTHING;
