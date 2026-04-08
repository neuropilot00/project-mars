-- ═══════════════════════════════════════════════════════
--  029: Governance System — Governor, Commander, GP
--  Governor (sector 1st), Vice Governor (2nd)
--  Commander (global 1st), Vice Commander (global 2nd)
--  GP (Governance Point) — position-bound, non-transferable
-- ═══════════════════════════════════════════════════════

-- ── Extend sectors table for governance ──
DO $$ BEGIN
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(4,2) DEFAULT 2.00;
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS vice_governor_wallet VARCHAR(42);
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS vice_governor_since TIMESTAMPTZ;
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS sector_pool_gp DECIMAL(20,6) DEFAULT 0;
  ALTER TABLE sectors ADD COLUMN IF NOT EXISTS buff_fund_gp DECIMAL(20,6) DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Governance positions (GP stored per position, not per user) ──
CREATE TABLE IF NOT EXISTS governance_positions (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('governor','vice_governor','commander','vice_commander')),
  sector_id INT REFERENCES sectors(id),
  gp_balance DECIMAL(20,6) DEFAULT 0,
  appointed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, sector_id)
);

-- ── Commander (global singleton) ──
CREATE TABLE IF NOT EXISTS commander (
  id SERIAL PRIMARY KEY,
  commander_wallet VARCHAR(42),
  vice_commander_wallet VARCHAR(42),
  commander_since TIMESTAMPTZ,
  vice_commander_since TIMESTAMPTZ,
  announcement TEXT DEFAULT '',
  commander_pool_gp DECIMAL(20,6) DEFAULT 0
);
-- Seed one row
INSERT INTO commander (id, commander_wallet) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;

-- ── Governance transaction log ──
CREATE TABLE IF NOT EXISTS governance_transactions (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  from_role VARCHAR(30),
  to_role VARCHAR(30),
  sector_id INT,
  wallet VARCHAR(42),
  gp_amount DECIMAL(20,6),
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sector buffs (purchased by governor with GP) ──
CREATE TABLE IF NOT EXISTS sector_buffs (
  id SERIAL PRIMARY KEY,
  sector_id INT NOT NULL REFERENCES sectors(id),
  buff_type VARCHAR(30) NOT NULL CHECK (buff_type IN ('mining_boost','defense_bonus','claim_discount')),
  effect_value DECIMAL(6,2) NOT NULL,
  gp_cost DECIMAL(20,6) NOT NULL,
  activated_by VARCHAR(42) NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true
);

-- ── Global events (triggered by commander) ──
CREATE TABLE IF NOT EXISTS global_events_gov (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('double_mining','war_time','peace_treaty')),
  triggered_by VARCHAR(42) NOT NULL,
  gp_cost DECIMAL(20,6) NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bounties (placed by commander) ──
CREATE TABLE IF NOT EXISTS bounties (
  id SERIAL PRIMARY KEY,
  placed_by VARCHAR(42) NOT NULL,
  target_wallet VARCHAR(42) NOT NULL,
  gp_reward DECIMAL(20,6) NOT NULL,
  pp_reward DECIMAL(20,6) DEFAULT 0,
  reason TEXT,
  claimed_by VARCHAR(42),
  claimed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','claimed','expired','cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_gov_positions_wallet ON governance_positions(wallet);
CREATE INDEX IF NOT EXISTS idx_gov_positions_role_sector ON governance_positions(role, sector_id);
CREATE INDEX IF NOT EXISTS idx_gov_transactions_sector ON governance_transactions(sector_id);
CREATE INDEX IF NOT EXISTS idx_gov_transactions_wallet ON governance_transactions(wallet);
CREATE INDEX IF NOT EXISTS idx_sector_buffs_active ON sector_buffs(sector_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_global_events_gov_active ON global_events_gov(active, ends_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_wallet, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status) WHERE status = 'active';

-- ── Seed governance settings ──
INSERT INTO settings (key, value) VALUES
  ('governance_tax_min', '1'),
  ('governance_tax_max', '5'),
  ('governance_tax_default', '2'),
  ('governor_tax_share', '70'),
  ('vice_governor_tax_share', '20'),
  ('sector_pool_share', '10'),
  ('sector_pool_buff_split', '50'),
  ('commander_pool_commander_share', '70'),
  ('commander_pool_vice_share', '30'),
  ('buff_mining_boost_cost', '100'),
  ('buff_mining_boost_value', '20'),
  ('buff_mining_boost_hours', '24'),
  ('buff_defense_bonus_cost', '150'),
  ('buff_defense_bonus_value', '10'),
  ('buff_defense_bonus_hours', '24'),
  ('buff_claim_discount_cost', '120'),
  ('buff_claim_discount_value', '10'),
  ('buff_claim_discount_hours', '24'),
  ('global_event_double_mining_cost', '500'),
  ('global_event_double_mining_hours', '2'),
  ('global_event_war_time_cost', '300'),
  ('global_event_war_time_hours', '1'),
  ('global_event_peace_treaty_cost', '400'),
  ('global_event_peace_treaty_hours', '1'),
  ('commander_daily_event_limit', '1'),
  ('governor_maintenance_per_pixel', '0.01')
ON CONFLICT (key) DO NOTHING;
