-- 258_siege_fleet_combat.sql
-- ════════════════════════════════════════════════════════════════
-- 길드 공성전 Phase 1a — 섹터 공성을 실제 함대전으로 해결
--   설계: docs/GUILD_TERRITORY_WAR_DESIGN_2026-05-29.md (Phase 1)
--   안전: siege_fleet_combat_enabled 기본 false → 켜기 전까지 기존 픽셀 비교 동작 유지.
-- ════════════════════════════════════════════════════════════════

-- governor_sieges: 양측 함대 커밋 + 해결 모드 컬럼 (idempotent)
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS challenger_fleet_id BIGINT;
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS defender_fleet_id   BIGINT;
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS resolution_mode     TEXT DEFAULT 'pixel_fallback';
-- mig 096 create_siege_battle() 가 참조하는 컬럼 재보장 (구버전 DB 방어)
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS fleet_battle_id     BIGINT;
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS uses_fleet_combat   BOOLEAN DEFAULT false;

-- 결전 전투 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_governor_sieges_fleet_battle
  ON governor_sieges(fleet_battle_id) WHERE fleet_battle_id IS NOT NULL;

-- 설정값 (settings PK = key 단독, value 는 JSONB)
INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_fleet_combat_enabled', 'false',
   '섹터 공성을 실제 함대전으로 해결할지. true 면 양측 함대 커밋 시 결전 시각에 fleet_battle 자동 생성. false 면 기존 픽셀 비교.'),
  ('siege', 'siege_full_loss_enabled', 'false',
   '공성 패배 함선 영구 전사 여부. 경제 재균형(docs §12) 완료 전까지 false 유지.'),
  ('siege', 'siege_fleet_commit_deadline_min', '0',
   '결전 시작 전 함대 커밋 마감(분). 0 = siege_starts_at 까지.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('258_siege_fleet_combat.sql')
ON CONFLICT DO NOTHING;
