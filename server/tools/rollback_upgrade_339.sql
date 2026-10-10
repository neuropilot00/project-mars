-- Manual only; destructive to frontier progress. Existing pixels/fleets/ships remain.
DROP TABLE IF EXISTS frontier_defense_events,frontier_production_events,frontier_season_score,frontier_objective_progress,frontier_defense,frontier_repairs,frontier_battles,frontier_cargo,frontier_stocks,frontier_nodes;
ALTER TABLE users DROP COLUMN IF EXISTS is_frontier_npc;
DELETE FROM schema_migrations WHERE filename='339_frontier_industry.sql';
