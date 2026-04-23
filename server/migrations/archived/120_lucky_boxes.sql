-- Migration 120: GP Lucky Box / Mystery Crate System
-- Players spend GP to open mystery crates that yield randomized rewards.
-- Multiple box tiers (basic → legendary) at different GP costs.
-- Admin configures box types, loot tables, probabilities, and daily limits.
-- All GP spent is burned (GP sink). Bonus GP rewards come from the prize pool.

CREATE TABLE IF NOT EXISTS lucky_box_types (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(60)    NOT NULL,
  icon            VARCHAR(10)    NOT NULL DEFAULT '📦',
  description     VARCHAR(200),
  cost_gp         DECIMAL(20,6)  NOT NULL,
  loot_table      JSONB          NOT NULL DEFAULT '[]',
  -- loot entry: [{type:'gp'|'item'|'gp_percent', amount:50, item_type_id:null, weight:30, label:'50 GP'}]
  max_per_day     INT            NOT NULL DEFAULT 10,    -- 0 = unlimited
  category        VARCHAR(20)    NOT NULL DEFAULT 'standard', -- standard | premium | seasonal | event
  sort_order      INT            NOT NULL DEFAULT 0,
  is_active       BOOLEAN        NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lucky_box_openings (
  id              SERIAL PRIMARY KEY,
  wallet          VARCHAR(100)   NOT NULL,
  box_type_id     INT            NOT NULL REFERENCES lucky_box_types(id),
  gp_spent        DECIMAL(20,6)  NOT NULL,
  reward_type     VARCHAR(20)    NOT NULL,               -- gp | item | gp_percent
  reward_amount   DECIMAL(20,6)  NOT NULL DEFAULT 0,     -- GP amount or item quantity
  reward_item_id  INT,                                   -- item_type_id if reward is item
  reward_label    VARCHAR(100),                          -- human-readable reward description
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lucky_box_openings_wallet ON lucky_box_openings(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lucky_box_openings_box    ON lucky_box_openings(box_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lucky_box_types_active    ON lucky_box_types(is_active, sort_order);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('lucky_box_enabled',          'true', 'Enable lucky box system',                            'lucky_box'),
  ('lucky_box_gp_pool_pct',      '30',   'Pct of GP spent that goes to GP prize pool',         'lucky_box'),
  ('lucky_box_daily_global_limit','500',  'Max total opens per day across all players (0=off)', 'lucky_box'),
  ('lucky_box_show_history',     'true', 'Show recent opens feed to players',                  'lucky_box'),
  ('lucky_box_history_limit',    '20',   'Number of recent opens to show in feed',             'lucky_box')
ON CONFLICT (key) DO NOTHING;

-- ── Seed default box types ───────────────────────────────────────────────────
INSERT INTO lucky_box_types (name, icon, description, cost_gp, loot_table, max_per_day, category, sort_order) VALUES
  (
    'Standard Crate', '📦',
    'A basic mystery crate. Win GP or common items.',
    50,
    '[
      {"type":"gp","amount":20,"weight":30,"label":"20 GP"},
      {"type":"gp","amount":50,"weight":20,"label":"50 GP"},
      {"type":"gp","amount":100,"weight":10,"label":"100 GP"},
      {"type":"gp","amount":200,"weight":5,"label":"200 GP"},
      {"type":"gp","amount":10,"weight":35,"label":"10 GP (consolation)"}
    ]'::jsonb,
    10, 'standard', 1
  ),
  (
    'Premium Crate', '🎁',
    'A premium crate with better odds and bigger prizes.',
    200,
    '[
      {"type":"gp","amount":100,"weight":30,"label":"100 GP"},
      {"type":"gp","amount":250,"weight":20,"label":"250 GP"},
      {"type":"gp","amount":500,"weight":12,"label":"500 GP"},
      {"type":"gp","amount":1000,"weight":5,"label":"1,000 GP"},
      {"type":"gp","amount":2500,"weight":2,"label":"2,500 GP"},
      {"type":"gp","amount":50,"weight":31,"label":"50 GP (consolation)"}
    ]'::jsonb,
    5, 'premium', 2
  ),
  (
    'Legendary Crate', '🏆',
    'The ultimate crate. Massive potential rewards.',
    500,
    '[
      {"type":"gp","amount":300,"weight":30,"label":"300 GP"},
      {"type":"gp","amount":750,"weight":20,"label":"750 GP"},
      {"type":"gp","amount":1500,"weight":12,"label":"1,500 GP"},
      {"type":"gp","amount":3000,"weight":6,"label":"3,000 GP"},
      {"type":"gp","amount":7500,"weight":2,"label":"7,500 GP"},
      {"type":"gp","amount":150,"weight":30,"label":"150 GP (consolation)"}
    ]'::jsonb,
    3, 'premium', 3
  )
ON CONFLICT DO NOTHING;
