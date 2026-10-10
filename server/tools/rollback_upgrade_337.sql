-- Explicit maintenance only; never loaded by the automatic migration runner.
-- Existing accepted battles and their results are preserved.
DROP TABLE IF EXISTS fleet_duel_invitations;
DELETE FROM schema_migrations WHERE filename = '337_duel_invitations.sql';
