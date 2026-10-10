-- Manual rollback only; export budget and claim ledger first.
BEGIN;
DROP TABLE IF EXISTS ship_salvage_claims;
DROP TABLE IF EXISTS ship_salvage_daily_budget;
DELETE FROM schema_migrations WHERE filename='343_salvage_budget.sql';
COMMIT;
