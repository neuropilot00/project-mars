-- ============================================================
-- Migration 305: 배포 안전 — 코드가 참조하는 고아 테이블 fresh-DB 생성
--
-- 배경: 라이브 prod DB엔 존재하지만(과거 archived/수동 마이그) active 마이그레이션이
--   생성하지 않는 테이블 4종을 코드가 참조 → fresh/clean 배포 시 "relation does not exist"로
--   해당 기능(주간 연대기/소셜 카드/경매 함선/고급 강화)이 깨짐. (배포 검수 발견)
--   기존 prod엔 이미 있으므로 IF NOT EXISTS = no-op. fresh 배포에서만 빈 테이블 생성 →
--   코드는 빈 결과를 받아 정상 동작(에러 대신).
--
-- 참조처: chronicleEnhanced.js(weekly_chronicles, share_cards),
--   auctionCombat.js(ship_instances), enhancementAdvanced.js(enhancement_material_recipes).
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_chronicles (
  id           SERIAL PRIMARY KEY,
  week_number  INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  headline_ko  TEXT,
  headline_en  TEXT,
  body_json    JSONB,
  discord_sent BOOLEAN DEFAULT false,
  telegram_sent BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_cards (
  id             BIGSERIAL PRIMARY KEY,
  token          VARCHAR(24) NOT NULL,
  card_type      VARCHAR(30) NOT NULL,
  wallet_address VARCHAR(100),
  ref_id         BIGINT,
  title_ko       VARCHAR(200),
  title_en       VARCHAR(200),
  extra_data     JSONB,
  view_count     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_share_cards_token ON share_cards(token);

CREATE TABLE IF NOT EXISTS ship_instances (
  id              BIGSERIAL PRIMARY KEY,
  wallet_address  VARCHAR(42) NOT NULL,
  guild_id        INTEGER,
  blueprint_id    INTEGER NOT NULL,
  ship_name       VARCHAR(50),
  enhance_level   INTEGER DEFAULT 0,
  current_hp      INTEGER NOT NULL,
  max_hp          INTEGER NOT NULL,
  atk             INTEGER NOT NULL,
  def             INTEGER NOT NULL,
  spd             INTEGER NOT NULL,
  range           INTEGER NOT NULL,
  status          VARCHAR(20) DEFAULT 'idle',
  location_sector VARCHAR(30),
  location_x      NUMERIC DEFAULT 0,
  location_y      NUMERIC DEFAULT 0,
  color_hex       VARCHAR(7),
  special_effect  VARCHAR(30),
  built_at        TIMESTAMPTZ DEFAULT NOW(),
  last_combat_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS enhancement_material_recipes (
  id                 SERIAL PRIMARY KEY,
  min_enhance_level  INTEGER NOT NULL,
  resource_code      VARCHAR(30) NOT NULL,
  quantity_required  INTEGER NOT NULL,
  success_rate_bonus NUMERIC DEFAULT 0,
  break_reduction    NUMERIC DEFAULT 0,
  description_ko     VARCHAR(200),
  description_en     VARCHAR(200),
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('305_deploy_safety_orphan_tables.sql') ON CONFLICT DO NOTHING;
