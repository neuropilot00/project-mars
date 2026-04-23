-- ============================================================
-- Migration 083: 온보딩 튜토리얼 (MASTER_PLAN Phase 3)
-- 신규 유저 5단계 온보딩 흐름 + 무료 첫 클레임 + 완료 보상
-- ============================================================

-- ── 1. 온보딩 진행 상태 테이블 ──
CREATE TABLE IF NOT EXISTS user_onboarding (
  id                   SERIAL PRIMARY KEY,
  wallet_address       VARCHAR(42) UNIQUE NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  current_step         INT DEFAULT 0,          -- 0~5 (5 = 완료)
  completed            BOOLEAN DEFAULT FALSE,
  skipped              BOOLEAN DEFAULT FALSE,
  reward_claimed       BOOLEAN DEFAULT FALSE,
  tutorial_claim_id    INT,                    -- 튜토리얼 무료 클레임 ID (claims.id FK)
  step_completed_at    JSONB DEFAULT '{}',     -- {"1":"2026-01-01T00:00:00Z", ...}
  skipped_at           TIMESTAMP,
  completed_at         TIMESTAMP,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);

-- ── 2. 인덱스 ──
CREATE INDEX IF NOT EXISTS idx_user_onboarding_wallet ON user_onboarding(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed ON user_onboarding(completed, skipped);

-- ── 3. settings 추가 (이미 있으면 SKIP) ──
INSERT INTO settings (key, value, description) VALUES
  ('onboarding_enabled',           'true',  '온보딩 튜토리얼 활성화 여부'),
  ('onboarding_pp_reward',         '50',    '온보딩 완료 PP 보상'),
  ('onboarding_gp_reward',         '100',   '온보딩 완료 GP 보상'),
  ('onboarding_xp_reward',         '200',   '온보딩 완료 XP 보상'),
  ('onboarding_skip_allowed',      'true',  '온보딩 건너뛰기 허용 여부'),
  ('onboarding_free_claim_enabled','true',  '온보딩 튜토리얼 무료 첫 클레임 허용'),
  ('onboarding_free_claim_size',   '25',    '튜토리얼 무료 클레임 픽셀 크기 (25 = 5×5)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS user_onboarding;
--   DELETE FROM settings WHERE key IN (
--     'onboarding_enabled','onboarding_pp_reward','onboarding_gp_reward',
--     'onboarding_xp_reward','onboarding_skip_allowed',
--     'onboarding_free_claim_enabled','onboarding_free_claim_size'
--   );
-- ============================================================
