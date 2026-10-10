-- Optional consented standard fleet duel; ordinary duels retain their loss policy.
ALTER TABLE fleet_duel_invitations ADD COLUMN IF NOT EXISTS mode VARCHAR(16) NOT NULL DEFAULT 'normal';
ALTER TABLE fleet_duel_invitations DROP CONSTRAINT IF EXISTS fleet_duel_mode_check;
ALTER TABLE fleet_duel_invitations ADD CONSTRAINT fleet_duel_mode_check CHECK(mode IN('normal','standard_v1'));
INSERT INTO settings(category,key,value,description) VALUES('fleet','standard_duels_enabled','true'::jsonb,'Enable consented standard_v1 no-loss fleet duels; existing registered matches stay protected') ON CONFLICT(key) DO NOTHING;
INSERT INTO schema_migrations(filename) VALUES('346_standard_duels.sql') ON CONFLICT DO NOTHING;
