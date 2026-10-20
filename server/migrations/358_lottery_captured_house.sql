-- Capture only future purchase funding. Do not infer historical house cuts
-- from old ticket counts, prices or today's settings.
ALTER TABLE lottery_rounds ADD COLUMN IF NOT EXISTS house_gp NUMERIC(20,6) NOT NULL DEFAULT 0;
-- Nullable deliberately: historical ticket principal was not recorded. New
-- purchases record their actual debit for exact cancellation refunds even if
-- the configured ticket price changes while the round remains open.
ALTER TABLE lottery_tickets ADD COLUMN IF NOT EXISTS paid_gp NUMERIC(20,6);
INSERT INTO schema_migrations (filename) VALUES ('358_lottery_captured_house.sql') ON CONFLICT DO NOTHING;
