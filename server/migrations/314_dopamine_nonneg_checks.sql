-- ============================================================
-- Migration 314: 도파민 신규 머니 컬럼 비음수 CHECK (방어적 불변식)
--
-- 앱 레이어(victorySlot spin: FOR UPDATE+클램프+가드차감, killmail: finite 클램프)는 이미
-- 올바르나, 스키마 차원에서도 음수 머니/MOD를 차단해 이상 데이터 유입을 막는다(Codex 권고).
-- 기존 데이터가 음수면 ADD CONSTRAINT가 실패하므로 NOT VALID로 추가(미래 쓰기만 강제).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='victory_slot_pool_nonneg') THEN
    ALTER TABLE victory_slot_pool ADD CONSTRAINT victory_slot_pool_nonneg CHECK (pool_gp >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='victory_slot_claims_nonneg') THEN
    ALTER TABLE victory_slot_claims ADD CONSTRAINT victory_slot_claims_nonneg CHECK (payout_gp >= 0 AND multiplier >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ship_wrecks_value_nonneg') THEN
    ALTER TABLE ship_wrecks ADD CONSTRAINT ship_wrecks_value_nonneg CHECK (ship_value_gp >= 0 AND mods >= 0) NOT VALID;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('314_dopamine_nonneg_checks.sql') ON CONFLICT DO NOTHING;
