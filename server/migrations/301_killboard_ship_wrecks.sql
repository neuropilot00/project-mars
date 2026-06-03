-- ============================================================
-- Migration 301: 킬보드 — ship_wrecks 격침 귀속 (배신 시스템 Phase 2 / 시스템3)
--
-- 기존 ship_wrecks 테이블(잔해 회수용으로 설계됐으나 0행·코드 INSERT 없던 phantom)을
-- 재사용한다. original_owner(피해자)는 있으나 killer 귀속이 없어, 격침 귀속 컬럼을 추가.
--   → full-loss 전투에서 함선이 영구 파괴될 때 applyBattleResults가 wreck을 기록.
--   → "누가 누구 함선을 격침했는가" 킬보드 + (향후) 잔해 회수(salvage) 둘 다 지원.
--
-- 배신 루프와 연결: 변절자(guild_betrayer)에게 걸린 현상금을 사냥 → 함대전 격침 →
--   ship_wrecks에 killer 귀속 기록 → 현상금 청구/킬보드 노출.
-- ============================================================

-- [Codex P1] 신규/클린 배포 방어: 활성 마이그에 ship_wrecks CREATE가 없어 ALTER 전 실패 가능.
--   존재하면 no-op, 없으면 풀 스키마로 생성(잔해 회수 + 킬보드 공용).
CREATE TABLE IF NOT EXISTS ship_wrecks (
  id               BIGSERIAL PRIMARY KEY,
  battle_id        BIGINT,
  ship_instance_id BIGINT,
  ship_type        VARCHAR(20) NOT NULL,
  ship_name        VARCHAR(50),
  original_owner   VARCHAR(42),
  sector_code      VARCHAR(30),
  location_x       NUMERIC(10,4) DEFAULT 0,
  location_y       NUMERIC(10,4) DEFAULT 0,
  resources        JSONB NOT NULL DEFAULT '{}',
  salvaged_by      VARCHAR(42),
  salvaged_at      TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- battle_id가 레거시 ship_battles(id)를 참조하는 FK 제거 — 현 전투 시스템은 fleet_battles 사용.
ALTER TABLE ship_wrecks DROP CONSTRAINT IF EXISTS ship_wrecks_battle_id_fkey;

ALTER TABLE ship_wrecks ADD COLUMN IF NOT EXISTS killer_wallet VARCHAR(42);
ALTER TABLE ship_wrecks ADD COLUMN IF NOT EXISTS killer_side   VARCHAR(8);
ALTER TABLE ship_wrecks ADD COLUMN IF NOT EXISTS victim_side   VARCHAR(8);

CREATE INDEX IF NOT EXISTS idx_ship_wrecks_killer ON ship_wrecks(killer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_wrecks_victim ON ship_wrecks(original_owner, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_wrecks_battle ON ship_wrecks(battle_id);

-- 잔해 만료(회수 가능 시간) 설정
INSERT INTO settings (category, key, value, description)
  SELECT 'fleet', 'ship_wreck_salvage_hours', '24', '격침 잔해(ship_wrecks) 회수 가능 시간'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ship_wreck_salvage_hours');

INSERT INTO schema_migrations (filename) VALUES ('301_killboard_ship_wrecks.sql') ON CONFLICT DO NOTHING;
