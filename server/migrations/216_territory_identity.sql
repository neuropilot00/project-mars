-- Migration 216: 영토 정체성 시스템
-- claims 테이블에 닉네임, 배지, 전투 이력 컬럼 추가
-- Field Rating (FR) 공식: (보유일수×2) + (방어성공×5) + (업그레이드레벨×3) + (아트등록×10)

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(40),
  ADD COLUMN IF NOT EXISTS bio VARCHAR(200),
  ADD COLUMN IF NOT EXISTS defense_wins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_hijacked INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS battle_wins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS field_rating INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_hold_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_pioneer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_settler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_veteran BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_fortress BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hold_bonus_pct NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP DEFAULT NOW();

-- 기존 영토는 claimed_at이 NULL이면 created_at 기준으로 초기화
UPDATE claims SET claimed_at = NOW() WHERE claimed_at IS NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_claims_owner_fr ON claims(owner, field_rating DESC);
CREATE INDEX IF NOT EXISTS idx_claims_nickname ON claims(nickname) WHERE nickname IS NOT NULL;

-- 영토 장기 보유 보상 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'hold_reward_7d_bonus_pct',  '5',   '7일 보유 PP 채굴 보너스 %'),
  ('territory', 'hold_reward_30d_bonus_pct', '10',  '30일 보유 PP 채굴 보너스 %'),
  ('territory', 'hold_reward_90d_bonus_pct', '20',  '90일 보유 PP 채굴 보너스 %'),
  ('territory', 'fr_days_weight',            '2',   'FR 계산: 보유일수 가중치'),
  ('territory', 'fr_defense_weight',         '5',   'FR 계산: 방어성공 가중치'),
  ('territory', 'fr_upgrade_weight',         '3',   'FR 계산: 업그레이드 레벨 가중치'),
  ('territory', 'fr_art_weight',             '10',  'FR 계산: 아트 등록 가중치')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('216_territory_identity.sql') ON CONFLICT DO NOTHING;
