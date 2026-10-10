-- Bound the actual resource issuance, not only individual wreck display values.
CREATE TABLE IF NOT EXISTS ship_salvage_daily_budget (
  wallet_address VARCHAR(42) NOT NULL,
  budget_day DATE NOT NULL,
  resource_code VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  PRIMARY KEY(wallet_address,budget_day,resource_code),
  CHECK(wallet_address=LOWER(wallet_address))
);
CREATE TABLE IF NOT EXISTS ship_salvage_claims (
  wreck_id BIGINT PRIMARY KEY REFERENCES ship_wrecks(id),
  source_ship_id BIGINT NOT NULL UNIQUE REFERENCES ships(id),
  wallet_address VARCHAR(42) NOT NULL,
  battle_id BIGINT NOT NULL REFERENCES fleet_battles(id),
  drops JSONB NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Backfill previous claims into today's ledger so deployment cannot reset the daily issuance budget.
INSERT INTO ship_salvage_daily_budget(wallet_address,budget_day,resource_code,quantity)
SELECT LOWER(w.salvaged_by),w.salvaged_at::date,e.key,
  LEAST(2147483647,SUM(CASE WHEN e.value #>> '{}' ~ '^[0-9]+$' THEN LEAST(2147483647,(e.value #>> '{}')::numeric) ELSE 0 END))::int
FROM ship_wrecks w CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(w.resources)='object' THEN w.resources ELSE '{}'::jsonb END) e
WHERE w.salvaged_by IS NOT NULL AND w.salvaged_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM ship_salvage_claims c WHERE c.wreck_id=w.id)
GROUP BY LOWER(w.salvaged_by),w.salvaged_at::date,e.key
ON CONFLICT(wallet_address,budget_day,resource_code) DO UPDATE SET quantity=GREATEST(ship_salvage_daily_budget.quantity,EXCLUDED.quantity);
INSERT INTO ship_salvage_claims(wreck_id,source_ship_id,wallet_address,battle_id,drops,claimed_at)
SELECT DISTINCT ON(s.id) w.id,s.id,LOWER(w.salvaged_by),w.battle_id,COALESCE(w.resources,'{}'),COALESCE(w.salvaged_at,NOW())
FROM ship_wrecks w JOIN ships s ON s.id=w.ship_instance_id JOIN fleet_battles b ON b.id=w.battle_id
WHERE w.salvaged_by IS NOT NULL ORDER BY s.id,w.salvaged_at,w.id
ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations(filename) VALUES('343_salvage_budget.sql') ON CONFLICT DO NOTHING;
