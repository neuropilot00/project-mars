-- 062: USDT shop discount adjusted from 0.7x → 0.8x
--
-- Player feedback: 30% off felt too aggressive — real-cash buyers were
-- skipping PP entirely. Settling on a 20% discount: still rewards using
-- USDT (irreversible, no refund risk for the platform), but PP remains
-- meaningful for grinders.

UPDATE settings
   SET value = '0.8',
       description = 'USDT shop price = PP price × this multiplier (0.8 = 20% real-cash discount)'
 WHERE key = 'usdt_shop_multiplier';

-- Recompute every active item's USDT price using the new multiplier.
UPDATE item_types
   SET price_usdt = ROUND((price_pp * 0.8)::numeric, 2)
 WHERE price_pp > 0 AND active = true;
