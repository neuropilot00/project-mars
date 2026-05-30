-- 282_assembly_units_catalog.sql
-- 합체/수집형 한정 유닛을 "코드 추가 없이 데이터만으로" 늘리기 위한 카탈로그 프레임워크화.
-- 기존 단일 유닛(pilgrim_voltaris) 하드코딩(settings 전역값)을 unit별 행 설정으로 이관.
-- 새 한정 유닛(로봇/함선/우주인 등) 추가 = ship_types + assembly_units + assembly_parts 행 INSERT 만으로 끝.

-- ── 합체 유닛 카탈로그 (유닛별 전 설정 보유) ──
CREATE TABLE IF NOT EXISTS assembly_units (
  unit_code            VARCHAR(40) PRIMARY KEY,
  ship_type_code       VARCHAR(40) NOT NULL,             -- 합체 결과 함선(ship_types.code)
  kind                 VARCHAR(20) NOT NULL DEFAULT 'robot', -- robot|ship|astronaut|mech|... (확장 자유)
  name_en              VARCHAR(80) NOT NULL,
  name_ko              VARCHAR(80) NOT NULL,
  name_ja              VARCHAR(80),
  name_zh              VARCHAR(80),
  icon_emoji           VARCHAR(8) DEFAULT '🜲',
  faction_code         VARCHAR(20),                      -- 공급 세력(서사/필터용, NULL 허용)
  season_code          VARCHAR(40) DEFAULT 'permanent',  -- 한정 시즌 코드 ('permanent'=상시)
  part_count           SMALLINT NOT NULL DEFAULT 5,
  gacha_enabled        BOOLEAN DEFAULT true,
  gacha_price_gp       INTEGER DEFAULT 500,
  hard_pity_pulls      INTEGER DEFAULT 30,
  dup_shard_yield      INTEGER DEFAULT 15,
  shard_exchange_cost  INTEGER DEFAULT 40,
  assemble_gp_cost     INTEGER DEFAULT 0,
  max_per_player       INTEGER DEFAULT 1,
  disassemble_enabled  BOOLEAN DEFAULT true,
  active               BOOLEAN DEFAULT true,
  sort_order           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 Voltaris를 카탈로그로 이관 (현 settings 기본값과 동일하게 시드)
INSERT INTO assembly_units (unit_code, ship_type_code, kind, name_en, name_ko, name_ja, name_zh, icon_emoji, faction_code, season_code, part_count, gacha_price_gp, hard_pity_pulls, dup_shard_yield, shard_exchange_cost, assemble_gp_cost, max_per_player, sort_order)
VALUES ('pilgrim_voltaris', 'pilgrim_voltaris', 'robot', 'Voltaris', '볼타리스', 'ヴォルタリス', '沃尔塔利斯', '🜲', 'pilgrim', 'permanent', 5, 500, 30, 15, 40, 0, 1, 1)
ON CONFLICT (unit_code) DO NOTHING;

-- ── 유닛별 천장(per-unit pity) — 기존 PK(wallet) → PK(wallet, unit_code) ──
ALTER TABLE user_assembly_gacha ADD COLUMN IF NOT EXISTS unit_code VARCHAR(40) NOT NULL DEFAULT 'pilgrim_voltaris';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_assembly_gacha_pkey') THEN
    ALTER TABLE user_assembly_gacha DROP CONSTRAINT user_assembly_gacha_pkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_assembly_gacha_pk_unit') THEN
    ALTER TABLE user_assembly_gacha ADD CONSTRAINT user_assembly_gacha_pk_unit PRIMARY KEY (wallet, unit_code);
  END IF;
END$$;

-- 가챠 로그에도 unit_code (감사/통계용)
ALTER TABLE assembly_gacha_pulls ADD COLUMN IF NOT EXISTS unit_code VARCHAR(40) DEFAULT 'pilgrim_voltaris';

INSERT INTO schema_migrations (filename) VALUES ('282_assembly_units_catalog.sql') ON CONFLICT DO NOTHING;
