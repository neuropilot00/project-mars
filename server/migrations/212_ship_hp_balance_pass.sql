-- Migration 212: Ship HP Balance Pass
-- 소형함 기본속도 1v1 기준 최소 1분 생존 목표
-- 프리깃 ×6, 구축함 ×4, 순양함 ×3.5, 전함 ×2, 타이탄 ×1.5
-- cv_bomb: ATK 185→55, HP 3200→12000

-- 1. ship_types.base_hp / base_atk 업데이트
UPDATE ship_types SET base_hp = CASE code
  WHEN 'mcc_int'      THEN 18000
  WHEN 'cv_int'       THEN 15000
  WHEN 'fsp_int'      THEN 24000
  WHEN 'mcc_frg'      THEN 32000
  WHEN 'cv_frg'       THEN 28000
  WHEN 'fsp_logi'     THEN 28000
  WHEN 'mcc_ewar'     THEN 24000
  WHEN 'cv_bomb'      THEN 12000
  WHEN 'mcc_dst'      THEN 60000
  WHEN 'cv_dst'       THEN 48000
  WHEN 'fsp_dst'      THEN 90000
  WHEN 'mcc_crs'      THEN 100000
  WHEN 'cv_crs'       THEN 85000
  WHEN 'fsp_crs'      THEN 95000
  WHEN 'mcc_snp'      THEN 82000
  WHEN 'fsp_logi_crs' THEN 80000
  WHEN 'cv_bs'        THEN 280000
  WHEN 'fsp_bs'       THEN 420000
  WHEN 'mcc_bs'       THEN 340000
  WHEN 'cv_titan'     THEN 1550000
  WHEN 'fsp_titan'    THEN 1750000
  WHEN 'mcc_titan'    THEN 1480000
  ELSE base_hp
END
WHERE code IN ('mcc_int','cv_int','fsp_int','mcc_frg','cv_frg','fsp_logi','mcc_ewar','cv_bomb',
               'mcc_dst','cv_dst','fsp_dst','mcc_crs','cv_crs','fsp_crs','mcc_snp','fsp_logi_crs',
               'cv_bs','fsp_bs','mcc_bs','cv_titan','fsp_titan','mcc_titan');

-- cv_bomb ATK 너프 (185 → 55)
UPDATE ship_types SET base_atk = 55 WHERE code = 'cv_bomb';

-- 2. 기존 보유 함선 HP 비례 스케일 (현재 HP 비율 유지)
UPDATE ships s
SET
  current_hp = GREATEST(1, ROUND(s.current_hp::float / NULLIF(s.max_hp, 0) * st.base_hp)),
  max_hp     = st.base_hp + COALESCE(s.bonus_hp, 0)
FROM ship_types st
WHERE s.ship_type_code = st.code
  AND s.max_hp > 0
  AND s.is_alive = TRUE;

-- 3. 사망 함선도 max_hp 갱신 (부활/수리 후 올바른 max 기준 적용)
UPDATE ships s
SET max_hp = st.base_hp + COALESCE(s.bonus_hp, 0)
FROM ship_types st
WHERE s.ship_type_code = st.code
  AND s.is_alive = FALSE;

INSERT INTO schema_migrations (filename) VALUES ('212_ship_hp_balance_pass.sql') ON CONFLICT DO NOTHING;
