-- Bounded first-season industrial front. Values are test hypotheses, not validated balance.
CREATE TABLE IF NOT EXISTS frontier_nodes (
 id BIGSERIAL PRIMARY KEY, front_key TEXT NOT NULL, node_type TEXT NOT NULL CHECK(node_type IN ('resource','logistics','repair')),
 name TEXT NOT NULL, sector_id INTEGER REFERENCES sectors(id), owner_key TEXT, controller_wallet VARCHAR(42) REFERENCES users(wallet_address),
 generation INTEGER NOT NULL DEFAULT 0, captured_at TIMESTAMPTZ, protected_until TIMESTAMPTZ,
 production_at TIMESTAMPTZ, stored_batches INTEGER NOT NULL DEFAULT 0 CHECK(stored_batches BETWEEN 0 AND 4),
 UNIQUE(front_key,node_type)
);
CREATE TABLE IF NOT EXISTS frontier_stocks (
 owner_key TEXT NOT NULL, depot TEXT NOT NULL CHECK(depot IN ('mine','repair')),
 resource_code VARCHAR(30) NOT NULL REFERENCES resources(code), quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 10000),
 PRIMARY KEY(owner_key,depot,resource_code)
);
CREATE TABLE IF NOT EXISTS frontier_cargo (
 id BIGSERIAL PRIMARY KEY, wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address), owner_key TEXT NOT NULL,
 fleet_id BIGINT NOT NULL REFERENCES fleets(id), front_key TEXT NOT NULL, resource_code VARCHAR(30) NOT NULL REFERENCES resources(code),
 mission_id INTEGER, amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 100), received INTEGER NOT NULL DEFAULT 0 CHECK(received>=0),
 status TEXT NOT NULL DEFAULT 'moving' CHECK(status IN ('moving','arrived','cancelled','raided')),
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), arrives_at TIMESTAMPTZ NOT NULL, settled_at TIMESTAMPTZ, raid_battle_id BIGINT UNIQUE REFERENCES fleet_battles(id),
 CHECK(received<=amount)
);
CREATE UNIQUE INDEX IF NOT EXISTS frontier_cargo_busy_fleet ON frontier_cargo(fleet_id) WHERE status='moving';
CREATE TABLE IF NOT EXISTS frontier_battles (
 battle_id BIGINT PRIMARY KEY REFERENCES fleet_battles(id), wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
 owner_key TEXT NOT NULL, node_id BIGINT REFERENCES frontier_nodes(id), cargo_id BIGINT REFERENCES frontier_cargo(id),
 generation INTEGER, mission_id INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), settled_at TIMESTAMPTZ,
 result TEXT CHECK(result IN ('captured','lost','stale','raided','defended','cancelled')),
 CHECK((node_id IS NOT NULL)::integer+(cargo_id IS NOT NULL)::integer=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS frontier_node_one_battle ON frontier_battles(node_id) WHERE settled_at IS NULL;
CREATE TABLE IF NOT EXISTS frontier_repairs (
 id BIGSERIAL PRIMARY KEY, wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address), owner_key TEXT NOT NULL,
 ship_id BIGINT NOT NULL REFERENCES ships(id), mission_id INTEGER, healed INTEGER NOT NULL CHECK(healed>0), iron_used INTEGER NOT NULL, gp_cost INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS frontier_defense (
 node_id BIGINT PRIMARY KEY REFERENCES frontier_nodes(id), wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
 owner_key TEXT NOT NULL, fleet_id BIGINT NOT NULL REFERENCES fleets(id), preset JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS frontier_objective_progress (
 owner_key TEXT NOT NULL, wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address), day DATE NOT NULL DEFAULT CURRENT_DATE,
 produced INTEGER NOT NULL DEFAULT 0, delivered INTEGER NOT NULL DEFAULT 0, repaired INTEGER NOT NULL DEFAULT 0, defended INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_key,wallet,day)
);
CREATE TABLE IF NOT EXISTS frontier_season_score (
 owner_key TEXT NOT NULL, season TEXT NOT NULL, hold_points INTEGER NOT NULL DEFAULT 0, delivery_points INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_key,season)
);
-- Immutable provenance for mission completion and analytics (aggregates are not proof).
CREATE TABLE IF NOT EXISTS frontier_production_events (
 id BIGSERIAL PRIMARY KEY, wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address), owner_key TEXT NOT NULL,
 node_id BIGINT NOT NULL REFERENCES frontier_nodes(id), mission_id INTEGER, batches INTEGER NOT NULL CHECK(batches BETWEEN 1 AND 4),
 iron_dust INTEGER NOT NULL, hull_plate INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS frontier_defense_events (
 id BIGSERIAL PRIMARY KEY, wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address), owner_key TEXT NOT NULL,
 node_id BIGINT NOT NULL REFERENCES frontier_nodes(id), fleet_id BIGINT NOT NULL REFERENCES fleets(id), mission_id INTEGER,
 preset JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE frontier_cargo ADD COLUMN IF NOT EXISTS mission_id INTEGER;
ALTER TABLE frontier_repairs ADD COLUMN IF NOT EXISTS mission_id INTEGER;
-- Dedicated guards must not enter generic opponent discovery or generic reward battles.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frontier_npc BOOLEAN NOT NULL DEFAULT false;
-- Account-bound mission 4 material subsidy; only a verified active granted-hull repair can consume it.
ALTER TABLE frontier_repairs ADD COLUMN IF NOT EXISTS tutorial_subsidy BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS frontier_one_tutorial_repair ON frontier_repairs(wallet)
 WHERE mission_id=4 AND tutorial_subsidy=true;
