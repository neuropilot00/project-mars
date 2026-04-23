-- Migration 117: Territory Rental Market
-- Claim owners can list territory for GP rent per period.
-- Tenants pay upfront for N periods. Owner collects GP. Platform takes fee.
-- Tenants get a "mining boost" on the rented claim during their rental window.

CREATE TABLE IF NOT EXISTS territory_rentals (
  id              SERIAL PRIMARY KEY,
  claim_id        INT            NOT NULL,
  owner           VARCHAR(100)   NOT NULL,
  tenant          VARCHAR(100),
  gp_per_period   DECIMAL(20,6)  NOT NULL,         -- rent in GP per period
  period_hours    INT            NOT NULL DEFAULT 24, -- 1 period = N hours
  periods_paid    INT            NOT NULL DEFAULT 0,  -- how many periods tenant paid for
  status          VARCHAR(20)    NOT NULL DEFAULT 'listed',
                                                    -- listed | rented | expired | cancelled
  boost_pct       SMALLINT       NOT NULL DEFAULT 10, -- mining boost % for tenant
  listed_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  rented_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  fee_pct         SMALLINT       NOT NULL DEFAULT 10, -- platform fee % of rent
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_log (
  id          SERIAL PRIMARY KEY,
  rental_id   INT            NOT NULL,
  claim_id    INT            NOT NULL,
  owner       VARCHAR(100)   NOT NULL,
  tenant      VARCHAR(100)   NOT NULL,
  gp_paid     DECIMAL(20,6)  NOT NULL,
  gp_to_owner DECIMAL(20,6)  NOT NULL,
  gp_fee      DECIMAL(20,6)  NOT NULL,
  periods     INT            NOT NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentals_owner    ON territory_rentals(owner);
CREATE INDEX IF NOT EXISTS idx_rentals_tenant   ON territory_rentals(tenant);
CREATE INDEX IF NOT EXISTS idx_rentals_claim    ON territory_rentals(claim_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status   ON territory_rentals(status);
CREATE INDEX IF NOT EXISTS idx_rental_log_claim ON rental_log(claim_id);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('rental_enabled',         'true',  'Enable territory rental market',                'rental'),
  ('rental_min_gp',          '5',     'Min GP per period',                             'rental'),
  ('rental_max_gp',          '10000', 'Max GP per period',                             'rental'),
  ('rental_min_periods',     '1',     'Min periods tenant must rent',                  'rental'),
  ('rental_max_periods',     '30',    'Max periods tenant can pre-pay',                'rental'),
  ('rental_period_options',  '6,12,24,48,72', 'Allowed period lengths in hours',      'rental'),
  ('rental_fee_pct',         '10',    'Platform fee % deducted from rent payment',     'rental'),
  ('rental_boost_pct',       '10',    'Mining GP boost % for tenant during rental',    'rental'),
  ('rental_max_per_owner',   '5',     'Max active rental listings per owner',          'rental'),
  ('rental_auto_expire',     'true',  'Auto-expire and notify when rental ends',       'rental')
ON CONFLICT (key) DO NOTHING;
