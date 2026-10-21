-- The archived 094 economy integration added these counters, but the active
-- migration chain does not run archived SQL. Current season reads/writes require
-- all four. Add missing columns only; preserve existing counters and nullability.
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS enhancements_done INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trades_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naval_wins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ships_built INTEGER NOT NULL DEFAULT 0;

INSERT INTO schema_migrations (filename) VALUES ('360_season_score_compatibility.sql') ON CONFLICT DO NOTHING;
