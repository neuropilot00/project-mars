-- Migration 213: 함선 강화 재료를 T1 광물로 변경
-- 기존 T2/T3 재료 → 초반 플레이어도 보유 가능한 T1 광물로 낮춤
-- atk  → carbon_fiber  (탄소섬유, T1)
-- def  → iron_ore      (철광석, T1)
-- hp   → silicon_chip  (실리콘 칩, T1)
-- speed→ basalt_chip   (현무암 조각, T1)
-- 기본 수량도 3 → 2 로 조정

UPDATE settings SET value = '"carbon_fiber"'  WHERE key = 'ship_upgrade_atk_material';
UPDATE settings SET value = '"iron_ore"'       WHERE key = 'ship_upgrade_def_material';
UPDATE settings SET value = '"silicon_chip"'   WHERE key = 'ship_upgrade_hp_material';
UPDATE settings SET value = '"basalt_chip"'    WHERE key = 'ship_upgrade_speed_material';
UPDATE settings SET value = '2'                WHERE key = 'ship_upgrade_material_base_qty';

INSERT INTO schema_migrations (filename) VALUES ('213_ship_upgrade_materials_fix.sql') ON CONFLICT DO NOTHING;
