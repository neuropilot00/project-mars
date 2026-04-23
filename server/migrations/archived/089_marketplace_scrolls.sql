-- ============================================================
-- Migration 089: Marketplace Dynamic Fee + Protection Scrolls
-- ============================================================

-- ── 1. 보호권 아이템 추가 ──
INSERT INTO item_types
  (code, name, description, category, price_pp, price_gp, price_usdt,
   duration_hours, effect_value, icon, max_stack, active)
VALUES
  ('protect_scroll',
   'Protection Scroll',
   'Prevents enhancement level loss on failure (not destruction)',
   'enhancement', 0, 500, NULL,
   0, 1, '📜', 99, true),
  ('blessed_scroll',
   'Blessed Scroll',
   'Prevents ALL negative enhancement effects (loss AND destruction)',
   'enhancement', 0, NULL, 2.0,
   0, 2, '✨', 99, true)
ON CONFLICT (code) DO NOTHING;

-- ── 2. 동적 등록비 설정 ──
INSERT INTO settings (key, value, description) VALUES
  ('marketplace_dynamic_fee_5',  '1.5', '5개 이상 리스팅 시 등록비 배율'),
  ('marketplace_dynamic_fee_10', '2.0', '10개 이상 리스팅 시 등록비 배율'),
  ('item_protect_scroll_gp',    '500',  'Protection Scroll GP 가격'),
  ('item_blessed_scroll_usdt',  '2.0',  'Blessed Scroll USDT 가격')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM item_types WHERE code IN ('protect_scroll','blessed_scroll');
--   DELETE FROM settings WHERE key IN (
--     'marketplace_dynamic_fee_5','marketplace_dynamic_fee_10',
--     'item_protect_scroll_gp','item_blessed_scroll_usdt'
--   );
-- ============================================================
