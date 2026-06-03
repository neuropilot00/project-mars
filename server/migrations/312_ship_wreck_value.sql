-- ============================================================
-- Migration 312: 킬메일 카드용 격침 함선 가치/MOD 기록
--
-- full-loss로 함선이 영구 소멸하면 데이터가 사라지므로, 격침 시점에 그 함선의 추정 가치
-- (건조비 + 강화 MOD 투자분)와 MOD 레벨을 ship_wrecks에 박제한다 → "내가 N GP짜리 함선 격파"
-- 킬메일 카드의 도파민/과시 재료.
-- ============================================================

ALTER TABLE ship_wrecks ADD COLUMN IF NOT EXISTS ship_value_gp BIGINT DEFAULT 0;
ALTER TABLE ship_wrecks ADD COLUMN IF NOT EXISTS mods INT DEFAULT 0;

INSERT INTO schema_migrations (filename) VALUES ('312_ship_wreck_value.sql') ON CONFLICT DO NOTHING;
