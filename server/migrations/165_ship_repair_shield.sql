-- Migration 165: 함선 수리 & 실드 시스템
-- 수리 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'ship_repair_enabled',      'true', '함선 수리 시스템 활성화'),
  ('fleet', 'ship_repair_gp_per_hp',    '2',    'HP 1당 GP 비용'),
  ('fleet', 'ship_repair_iron_per_10hp','1',     'HP 10당 iron_ore 소모 (반올림)'),
  ('fleet', 'ship_repair_max_pct',      '100',  '1회 수리 최대 HP % (100 = 풀회복 가능)')
ON CONFLICT (key) DO NOTHING;

-- 실드 컬럼 추가
ALTER TABLE ships ADD COLUMN IF NOT EXISTS shield_hp  INT NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS shield_max INT NOT NULL DEFAULT 0;

-- 실드 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'shield_enabled',             'true', '함선 실드 시스템 활성화'),
  ('fleet', 'shield_gp_per_unit',         '3',    '실드 HP 1당 GP 비용'),
  ('fleet', 'shield_max_ratio',           '50',   '함선 max_hp 대비 최대 실드 % (50 = max_hp 절반)'),
  ('fleet', 'shield_decay_pct_per_hour',  '5',    '시간당 실드 자연 감소 %')
ON CONFLICT (key) DO NOTHING;
