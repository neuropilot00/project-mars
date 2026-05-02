-- v5.49 Ship role balance: make EW/support ships readable and strategically useful.

UPDATE ship_types
SET description_ko = '범용 DPS 프리깃 · 저렴한 주력 화력, 초반 대량 편성 핵심'
WHERE code = 'mcc_frg';

UPDATE ship_types
SET
  description_ko = '전자전 프리깃 · 적 함대 사격 지연/화력 저하를 중첩시키는 지원함',
  build_gp_cost = 240,
  build_time_seconds = 2700,
  recipe_minerals = '{"iron_dust":65,"ice_crystal":8,"plasma_coil":2,"alloy_frame":1}'::jsonb
WHERE code = 'mcc_ewar';
