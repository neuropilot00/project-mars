-- One finite cold-start seed per normalized NPC identity. No periodic refill.
-- Requires users (is_ai, wallet_address) and schema_migrations. The migration
-- runner wraps this file in a transaction; block user inserts during backfill.
LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS npc_economy_seed_ledger (
  wallet_address TEXT PRIMARY KEY CHECK (wallet_address = LOWER(wallet_address)),
  seed_kind TEXT NOT NULL CHECK (seed_kind IN ('legacy_existing', 'initial_seed')),
  gp_issued NUMERIC NOT NULL CHECK (gp_issued >= 0 AND gp_issued <= 200),
  resources_issued JSONB NOT NULL CHECK (jsonb_typeof(resources_issued) = 'object'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing NPC balances/inventory are historical stock, not a fresh allowance.
-- No FK/cascade: deleting and recreating an identity must not grant another seed.
INSERT INTO npc_economy_seed_ledger (wallet_address, seed_kind, gp_issued, resources_issued)
SELECT DISTINCT LOWER(wallet_address), 'legacy_existing', 0, '{}'::jsonb
  FROM users WHERE is_ai = TRUE
ON CONFLICT (wallet_address) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('354_npc_seed_budget.sql') ON CONFLICT DO NOTHING;
