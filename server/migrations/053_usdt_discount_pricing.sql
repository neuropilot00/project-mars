-- 053_usdt_discount_pricing.sql
-- Set USDT price to 70% of PP price for all shop items.
-- Rationale: USDT is real money and irreversible (no refund path), so paying with
-- real cash gets a discount vs. in-game PP earned from gameplay.
-- Admin can retune via the `usdt_shop_multiplier` setting without redeploys.

INSERT INTO settings (key, value, category, description) VALUES
  ('usdt_shop_multiplier', '0.7', 'shop', 'USDT shop price = PP price × this multiplier. Lower = bigger real-cash discount.')
ON CONFLICT (key) DO NOTHING;

UPDATE item_types
SET price_usdt = ROUND((price_pp * COALESCE((SELECT value::numeric FROM settings WHERE key = 'usdt_shop_multiplier'), 0.7))::numeric, 2)
WHERE price_pp > 0 AND active = true;
