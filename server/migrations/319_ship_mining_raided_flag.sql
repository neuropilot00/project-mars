-- Persist whether a resource run was raided so recent-run history matches the collect result.

ALTER TABLE ship_mining_jobs
  ADD COLUMN IF NOT EXISTS raided BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO schema_migrations (filename)
VALUES ('319_ship_mining_raided_flag.sql')
ON CONFLICT DO NOTHING;
