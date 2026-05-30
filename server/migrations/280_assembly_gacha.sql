-- 280_assembly_gacha.sql
-- P2 합체 파츠 가챠 (박스가챠 + 하드천장 + 중복→조각)
-- 기획서 §8: 5종 균등 20%, 하드천장 30회(미보유 파츠 확정), 중복=조각15, 교환=조각40
-- 컴플리트가챠 회피: 합체체를 가챠로 직접 주지 않고 "파츠"만 공급, 합체는 결정론적(P1).

-- 유저별 가챠 천장 카운터
CREATE TABLE IF NOT EXISTS user_assembly_gacha (
  wallet           VARCHAR(64) PRIMARY KEY,
  pulls_since_new  INTEGER NOT NULL DEFAULT 0,   -- 마지막 '신규(미보유) 파츠' 이후 누적 뽑기 → 하드천장 트리거
  total_pulls      INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 가챠 뽑기 로그 (확률 감사용 — 한국 확률공개법 대비 불변 로그)
CREATE TABLE IF NOT EXISTS assembly_gacha_pulls (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(64) NOT NULL,
  part_code   VARCHAR(40) NOT NULL,
  was_pity    BOOLEAN NOT NULL DEFAULT false,
  was_dup     BOOLEAN NOT NULL DEFAULT false,
  shards_gain INTEGER NOT NULL DEFAULT 0,
  price_gp    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assembly_gacha_pulls_wallet ON assembly_gacha_pulls (wallet, created_at DESC);

INSERT INTO settings (category, key, value, description) VALUES
  ('assembly', 'assembly_gacha_enabled', 'true', '합체 파츠 가챠 활성'),
  ('assembly', 'assembly_gacha_price_gp', '500', '가챠 1회 GP 가격'),
  ('assembly', 'assembly_hard_pity_pulls', '30', '하드천장: 누적 N회 시 미보유 파츠 확정 (기획 §8)'),
  ('assembly', 'assembly_gacha_max_multi', '10', '한 번에 뽑을 수 있는 최대 횟수')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('280_assembly_gacha.sql') ON CONFLICT DO NOTHING;
