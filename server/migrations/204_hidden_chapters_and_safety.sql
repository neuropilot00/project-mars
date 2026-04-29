-- ═══════════════════════════════════════════════════════════════
-- 204: hidden_campaign_ch1~5 시드 + 캠페인 안전장치
-- ═══════════════════════════════════════════════════════════════
-- 1. hidden_campaign_ch1 ~ ch5 를 campaign_chapters 에 시드한다.
--    services/campaign.js 의 CHAPTERS 딕셔너리가 이들을 정의하지만
--    campaign_chapters 테이블에 row 가 없어 startChapter() 가
--    player_campaign_progress INSERT 시 FK 위반으로 500 에러를 반환했다.
--
-- 2. reputation_history 테이블 / player_campaign_progress 확장 컬럼을
--    CREATE/ALTER IF NOT EXISTS 로 재보장한다 — 193 마이그레이션이 일부
--    환경에서 롤백된 경우에 대비한 방어적 재적용.
--
-- 3. choose() 에서 삽입하는 player_lore_flags.source_chapter 컬럼도
--    IF NOT EXISTS 로 보장한다.
-- ═══════════════════════════════════════════════════════════════

-- ── 방어적 컬럼/테이블 재보장 ────────────────────────────────────

ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS best_metrics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS last_metrics JSONB DEFAULT '{}'::jsonb;

ALTER TABLE player_lore_flags ADD COLUMN IF NOT EXISTS source_chapter VARCHAR(80);
ALTER TABLE player_lore_flags ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE player_tags ADD COLUMN IF NOT EXISTS acquired_from VARCHAR(80);

CREATE TABLE IF NOT EXISTS reputation_history (
  id BIGSERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  faction VARCHAR(20) NOT NULL,
  delta INT NOT NULL,
  before_value INT NOT NULL DEFAULT 0,
  after_value INT NOT NULL DEFAULT 0,
  source_type VARCHAR(40),
  source_id VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_history_wallet_time ON reputation_history(wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_sessions (
  session_id VARCHAR(80) PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  chapter_id VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  current_metrics JSONB DEFAULT '{}'::jsonb,
  random_seed BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','expired','abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_branch_modifiers (
  id BIGSERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  modifier_id VARCHAR(80) NOT NULL,
  target_chapter VARCHAR(80) NOT NULL,
  source_chapter VARCHAR(80),
  set_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  UNIQUE(wallet, modifier_id, target_chapter, source_chapter)
);

CREATE INDEX IF NOT EXISTS idx_player_branch_modifiers_target ON player_branch_modifiers(wallet, target_chapter, consumed_at);

-- ── hidden_campaign_ch1 ~ ch5 시드 ───────────────────────────────

INSERT INTO campaign_chapters (
  quest_id, campaign_id, chapter_number, faction,
  title_ko, title_en,
  required_level, battle_resolution, estimated_play_time_seconds, content
) VALUES
  ('hidden_campaign_ch1', 'hidden_route', 1, NULL,
   '숨겨진 루트 — 1장', 'Hidden Route — Chapter 1',
   5, 'server_simulation', 1200, '{}'::jsonb),
  ('hidden_campaign_ch2', 'hidden_route', 2, NULL,
   '숨겨진 루트 — 2장', 'Hidden Route — Chapter 2',
   6, 'server_simulation', 1500, '{}'::jsonb),
  ('hidden_campaign_ch3', 'hidden_route', 3, NULL,
   '숨겨진 루트 — 3장', 'Hidden Route — Chapter 3',
   7, 'server_simulation', 1800, '{}'::jsonb),
  ('hidden_campaign_ch4', 'hidden_route', 4, NULL,
   '숨겨진 루트 — 4장', 'Hidden Route — Chapter 4',
   8, 'server_simulation', 2100, '{}'::jsonb),
  ('hidden_campaign_ch5', 'hidden_route', 5, NULL,
   '숨겨진 루트 — 5장', 'Hidden Route — Chapter 5',
   9, 'server_simulation', 2400, '{}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET
  title_ko = EXCLUDED.title_ko,
  title_en = EXCLUDED.title_en,
  battle_resolution = EXCLUDED.battle_resolution,
  active = TRUE;

INSERT INTO schema_migrations (filename) VALUES ('204_hidden_chapters_and_safety.sql')
ON CONFLICT DO NOTHING;
