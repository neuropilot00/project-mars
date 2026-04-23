-- Migration 121: VIP Pass System
-- Players spend GP monthly to maintain VIP status.
-- VIP tiers provide mining boosts, fee discounts, and cosmetic prestige badges.
-- Passes expire after the configured period. Multiple tiers available.
-- Strong recurring GP sink + social status system.

CREATE TABLE IF NOT EXISTS vip_tiers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(40)    NOT NULL,             -- e.g. "Pioneer", "Colonist", "Commander"
  badge           VARCHAR(10)    NOT NULL DEFAULT '⭐', -- emoji badge displayed next to nickname
  badge_color     VARCHAR(20)    NOT NULL DEFAULT '#ffcc02', -- hex color for UI
  cost_gp         DECIMAL(20,6)  NOT NULL,             -- GP cost per period
  period_days     INT            NOT NULL DEFAULT 30,  -- how many days the pass lasts
  mining_boost_pct SMALLINT      NOT NULL DEFAULT 5,   -- % mining speed bonus
  fee_discount_pct SMALLINT      NOT NULL DEFAULT 0,   -- % discount on marketplace/crafting fees
  gp_earn_bonus_pct SMALLINT     NOT NULL DEFAULT 0,   -- % extra GP from mining/quests
  max_lucky_per_day SMALLINT     NOT NULL DEFAULT 0,   -- extra lucky box opens per day (0=no bonus)
  sort_order      INT            NOT NULL DEFAULT 0,
  is_active       BOOLEAN        NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vip_passes (
  id              SERIAL PRIMARY KEY,
  wallet          VARCHAR(100)   NOT NULL,
  tier_id         INT            NOT NULL REFERENCES vip_tiers(id),
  gp_spent        DECIMAL(20,6)  NOT NULL,
  activated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ    NOT NULL,
  is_active       BOOLEAN        NOT NULL DEFAULT true,
  auto_renewed    BOOLEAN        NOT NULL DEFAULT false,
  UNIQUE (wallet)   -- one active pass per player (overwritten on renew)
);

CREATE TABLE IF NOT EXISTS vip_log (
  id              SERIAL PRIMARY KEY,
  wallet          VARCHAR(100)   NOT NULL,
  tier_id         INT            NOT NULL,
  event_type      VARCHAR(20)    NOT NULL DEFAULT 'purchased', -- purchased | renewed | expired | upgraded
  gp_spent        DECIMAL(20,6)  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_passes_wallet   ON vip_passes(wallet) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_vip_passes_expires  ON vip_passes(expires_at) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_vip_log_wallet      ON vip_log(wallet, created_at DESC);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('vip_enabled',           'true', 'Enable VIP pass system',                        'vip'),
  ('vip_auto_expire_check', 'true', 'Auto-deactivate expired passes on check',       'vip'),
  ('vip_show_badges',       'true', 'Display VIP badges next to nicknames in game',  'vip'),
  ('vip_upgrade_refund_pct','50',   'Pct of remaining value refunded when upgrading','vip')
ON CONFLICT (key) DO NOTHING;

-- ── Seed default VIP tiers ───────────────────────────────────────────────────
INSERT INTO vip_tiers (name, badge, badge_color, cost_gp, period_days, mining_boost_pct, fee_discount_pct, gp_earn_bonus_pct, sort_order) VALUES
  ('Pioneer',   '⭐', '#ffcc02', 100,  30, 5,  0, 0, 1),
  ('Colonist',  '🌟', '#81d4fa', 300,  30, 12, 5, 5, 2),
  ('Commander', '💫', '#ce93d8', 800,  30, 20, 10, 10, 3)
ON CONFLICT DO NOTHING;
