-- Manual rollback; export operation result records first.
BEGIN;
DROP TABLE IF EXISTS objective_operation_runs;
ALTER TABLE users DROP COLUMN IF EXISTS is_objective_npc;
DELETE FROM schema_migrations WHERE filename='345_objective_operations.sql';
COMMIT;
