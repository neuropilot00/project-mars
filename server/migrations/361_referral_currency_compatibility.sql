-- The active migration chain does not run archived 099. Preserve legacy PP rows
-- and add the denomination fields required by current referral reads/writes.
-- No historical trigger-based denomination inference, balance change or replay.
ALTER TABLE referral_rewards
  ADD COLUMN IF NOT EXISTS gp_amount DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'pp';

INSERT INTO schema_migrations (filename) VALUES ('361_referral_currency_compatibility.sql') ON CONFLICT DO NOTHING;
