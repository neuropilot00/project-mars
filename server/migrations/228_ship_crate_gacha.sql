-- 228_ship_crate_gacha.sql
-- 함선 가챠(Ship Crate) 시스템.
-- 상자를 GP(추후 USDC)로 구매·개봉 → 가중치 랜덤으로 함선 1척 획득.
-- 함선은 기존 함선 마켓에서 거래 가능한 실자산이므로 가챠 자체가 2차 시장 가치를 가진다.
-- 서버 권위 RNG + 천장(pity) + 타이탄 서버 캡 존중 + 확률 공개(법적 의무 대응).

-- ── 상자 등급 정의 ──
CREATE TABLE IF NOT EXISTS ship_crate_types (
  code          TEXT PRIMARY KEY,
  label_ko      TEXT,
  label_en      TEXT,
  price_gp      INTEGER       NOT NULL DEFAULT 0,
  price_usdt    NUMERIC(18,6) NOT NULL DEFAULT 0,
  -- size_class(frigate/destroyer/cruiser/battleship/titan)별 가중치
  rarity_weights JSONB        NOT NULL DEFAULT '{}'::jsonb,
  pity_pulls    INTEGER       NOT NULL DEFAULT 0,  -- N회 내 cruiser+ 확정. 0=없음
  active        BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 풀(개봉) 로그 ──
CREATE TABLE IF NOT EXISTS ship_crate_pulls (
  id             BIGSERIAL PRIMARY KEY,
  wallet         TEXT NOT NULL,
  crate_code     TEXT NOT NULL,
  ship_type_code TEXT,
  rarity         TEXT,
  was_pity       BOOLEAN     NOT NULL DEFAULT FALSE,
  price_gp       INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ship_crate_pulls_wallet ON ship_crate_pulls(wallet, created_at DESC);

-- ── 천장 카운터(유저×상자별 마지막 희귀 이후 누적 풀) ──
CREATE TABLE IF NOT EXISTS ship_crate_pity (
  wallet           TEXT    NOT NULL,
  crate_code       TEXT    NOT NULL,
  pulls_since_rare INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet, crate_code)
);

-- ── 3등급 시드 (가격/확률은 admin에서 조정 가능) ──
INSERT INTO ship_crate_types (code, label_ko, label_en, price_gp, rarity_weights, pity_pulls, sort_order) VALUES
  ('standard_crate',  '표준 보급 상자', 'Standard Crate',  300,
    '{"frigate":65,"destroyer":30,"cruiser":5}'::jsonb, 0, 1),
  ('premium_crate',   '프리미엄 상자',  'Premium Crate',   1000,
    '{"frigate":25,"destroyer":40,"cruiser":28,"battleship":7}'::jsonb, 10, 2),
  ('legendary_crate', '레전더리 상자',  'Legendary Crate', 3000,
    '{"destroyer":25,"cruiser":48,"battleship":24,"titan":3}'::jsonb, 5, 3)
ON CONFLICT (code) DO NOTHING;

-- 가챠 활성 토글 (settings)
INSERT INTO settings (category, key, value, description) VALUES
  ('shop', 'ship_crate_enabled', 'true', '함선 가챠(Ship Crate) 활성화')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('228_ship_crate_gacha.sql') ON CONFLICT DO NOTHING;
