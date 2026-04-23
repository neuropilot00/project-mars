-- Migration 122: GP Expedition System
-- Players spend GP to launch expeditions from their territory.
-- After the configured duration, the expedition returns with random rewards
-- (GP, items, or territory bonuses). Bigger territory = better base rewards.
-- One active expedition per claim at a time. Pure GP sink + idle loop mechanic.

CREATE TABLE IF NOT EXISTS expeditions (
  id              SERIAL PRIMARY KEY,
  wallet          VARCHAR(100)   NOT NULL,
  claim_id        INT            NOT NULL,              -- territory that launched the expedition
  expedition_type VARCHAR(30)    NOT NULL DEFAULT 'salvage', -- salvage | survey | raid | deep_dive
  gp_spent        DECIMAL(20,6)  NOT NULL,
  duration_h      INT            NOT NULL,              -- expedition length in hours
  launched_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  returns_at      TIMESTAMPTZ    NOT NULL,              -- when expedition returns
  status          VARCHAR(20)    NOT NULL DEFAULT 'active',  -- active | completed | cancelled | expired
  reward_type     VARCHAR(20),                          -- gp | item | buff | nothing
  reward_amount   DECIMAL(20,6)  NOT NULL DEFAULT 0,    -- GP amount or item quantity
  reward_item_id  INT,                                  -- item_type_id if reward is item
  reward_label    VARCHAR(100),                         -- human-readable reward
  completed_at    TIMESTAMPTZ,
  claim_size      INT            NOT NULL DEFAULT 1     -- snapshot of territory size at launch
);

CREATE INDEX IF NOT EXISTS idx_expedition_wallet  ON expeditions(wallet, launched_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedition_claim   ON expeditions(claim_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_expedition_returns ON expeditions(returns_at) WHERE status='active';

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('expedition_enabled',           'true',      'Enable expedition system',                          'expedition'),
  ('expedition_max_duration_h',    '24',        'Maximum expedition duration in hours',              'expedition'),
  ('expedition_base_cost_gp',      '30',        'Base GP cost per expedition hour',                  'expedition'),
  ('expedition_size_bonus_pct',    '2',         'Extra reward % per 100 territory pixels owned',     'expedition'),
  ('expedition_vip_bonus_pct',     '20',        'Extra reward % for VIP pass holders',               'expedition'),
  ('expedition_reward_table',      '{"gp_min":0.5,"gp_max":3.0,"jackpot_mult":10,"jackpot_pct":3}',
                                                'Reward multiplier table (JSON)',                     'expedition'),
  ('expedition_nothing_pct',       '10',        'Pct chance expedition returns empty-handed',        'expedition'),
  ('expedition_durations',         '1,3,6,12,24','Available expedition durations (hours)',            'expedition')
ON CONFLICT (key) DO NOTHING;
