-- ============================================================
-- Migration 091: Territory Visual — FOR SALE Map Markers
--
-- No new tables — uses existing marketplace_locked / auction_locked
-- from migrations 077 and 090.
-- ============================================================

-- Settings
INSERT INTO settings (key, value, description, category) VALUES
  ('territory_sale_overlay_enabled', 'true',  'Show FOR SALE / AUCTION overlays on map', 'marketplace'),
  ('territory_sale_badge',           '💰',    'Badge icon for marketplace-listed territories', 'marketplace'),
  ('territory_auction_badge',        '🔨',    'Badge icon for auction-listed territories', 'marketplace')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key IN (
--     'territory_sale_overlay_enabled',
--     'territory_sale_badge', 'territory_auction_badge'
--   );
-- ============================================================
