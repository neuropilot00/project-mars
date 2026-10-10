-- Manual rollback only. Export ship_collection before dropping permanent discoveries.
BEGIN;
DROP TRIGGER IF EXISTS trg_ship_collection ON ships;
DROP FUNCTION IF EXISTS record_ship_collection();
DROP INDEX IF EXISTS idx_ship_rebuild_once;
ALTER TABLE ship_build_jobs DROP COLUMN IF EXISTS rebuild_source_ship_id;
ALTER TABLE ships ALTER COLUMN quality DROP DEFAULT;
DROP TABLE IF EXISTS ship_collection;
DELETE FROM schema_migrations WHERE filename='340_ship_collection.sql';
COMMIT;
