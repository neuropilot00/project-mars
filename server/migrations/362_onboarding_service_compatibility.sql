-- Restore fields already required by the onboarding service but absent from 083.
-- Add missing fields only. Do not infer a job or historical per-step payouts from
-- current_step/reward_claimed; preserve every existing row, balance and marker.
ALTER TABLE user_onboarding
  ADD COLUMN IF NOT EXISTS job_selected VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pp_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shield_given BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gp_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS title_given BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO schema_migrations (filename) VALUES ('362_onboarding_service_compatibility.sql') ON CONFLICT DO NOTHING;
