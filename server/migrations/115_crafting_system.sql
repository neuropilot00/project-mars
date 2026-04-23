-- Migration 115: Item Crafting System
-- Players combine items + GP to craft new items using admin-defined recipes.
-- Recipes have configurable success rates, ingredient requirements, and GP costs.
-- Failed crafts consume ingredients but may return partial GP.

CREATE TABLE IF NOT EXISTS crafting_recipes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80)    NOT NULL,
  description     VARCHAR(300),
  category        VARCHAR(30)    NOT NULL DEFAULT 'general',  -- general | seasonal | elite | event
  ingredients     JSONB          NOT NULL DEFAULT '[]',       -- [{item_type_id, qty, item_name}]
  gp_cost         DECIMAL(20,6)  NOT NULL DEFAULT 0,
  output_item_type_id INT        NOT NULL,
  output_qty      INT            NOT NULL DEFAULT 1,
  output_name     VARCHAR(80),                                 -- cached for display
  success_rate    SMALLINT       NOT NULL DEFAULT 80,          -- 0-100 %
  fail_refund_pct SMALLINT       NOT NULL DEFAULT 0,           -- % of GP refunded on fail
  is_active       BOOLEAN        NOT NULL DEFAULT true,
  is_seasonal     BOOLEAN        NOT NULL DEFAULT false,       -- shows "SEASONAL" badge
  sort_order      INT            NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crafting_log (
  id          SERIAL PRIMARY KEY,
  wallet      VARCHAR(100)   NOT NULL,
  recipe_id   INT            NOT NULL,
  recipe_name VARCHAR(80),
  gp_cost     DECIMAL(20,6)  NOT NULL,
  gp_refunded DECIMAL(20,6)  NOT NULL DEFAULT 0,
  success     BOOLEAN        NOT NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craft_wallet  ON crafting_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_craft_recipe  ON crafting_log(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_active ON crafting_recipes(is_active, category, sort_order);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('crafting_enabled',          'true', 'Enable item crafting system',                           'crafting'),
  ('crafting_max_per_day',      '20',   'Max craft attempts per wallet per day',                 'crafting'),
  ('crafting_show_success_rate','true', 'Show success rate % to players',                        'crafting')
ON CONFLICT (key) DO NOTHING;

-- ── Seed a few starter recipes ──────────────────────────────────────────────
-- (item_type_ids must match your game's actual item types; using placeholder IDs)
-- Admin can add/edit more recipes in the admin panel.
-- Example: 3x Common Shield → 1x Rare Shield (placeholder using item_type_id 1,2)
-- Real recipes should be added by admin after deployment.
