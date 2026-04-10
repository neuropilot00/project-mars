-- 052_gp_shop_items.sql
-- Make all existing shop items purchasable with GP at a configurable multiplier of their PP price.
-- Default: GP price = PP price × 4 (GP is "free" from daily engagement, PP comes from active play).
--
-- Design rationale:
--   * GP comes from daily check-in (5-50/day) and daily missions (30-60/day) → ~60-110 GP/day passive
--   * PP comes from harvesting territory → active play
--   * 4× multiplier means a 2.5 PP shield costs 10 GP — affordable for daily players
--     without devaluing PP. Admin can raise this via the `gp_shop_multiplier` setting.

ALTER TABLE item_types ADD COLUMN IF NOT EXISTS price_gp DECIMAL(20,6) NOT NULL DEFAULT 0;

-- Admin-tunable multiplier for GP pricing
INSERT INTO settings (key, value, category, description) VALUES
  ('gp_shop_multiplier', '4', 'gp_shop', 'GP shop price = PP price × this multiplier. Raise to make GP items more expensive.')
ON CONFLICT (key) DO NOTHING;

-- Backfill price_gp for all active items using current multiplier.
-- Rows with a nonzero price_pp get: price_gp = ROUND(price_pp * multiplier).
-- Items with price_pp = 0 (free / admin-gifted) stay GP-unpurchasable.
UPDATE item_types
SET price_gp = ROUND((price_pp * COALESCE((SELECT value::numeric FROM settings WHERE key = 'gp_shop_multiplier'), 4))::numeric, 0)
WHERE price_pp > 0 AND active = true;
