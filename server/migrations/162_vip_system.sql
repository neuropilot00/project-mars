-- Migration 162: VIP Pass System (재작성 — archived/121 수정본)
-- game_settings → settings, gp_balances → users.gp_balance 사용

CREATE TABLE IF NOT EXISTS vip_tiers (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(40)   NOT NULL,
  badge             VARCHAR(10)   NOT NULL DEFAULT '⭐',
  badge_color       VARCHAR(20)   NOT NULL DEFAULT '#ffcc02',
  cost_gp           DECIMAL(20,6) NOT NULL,
  period_days       INT           NOT NULL DEFAULT 30,
  mining_boost_pct  SMALLINT      NOT NULL DEFAULT 5,
  fee_discount_pct  SMALLINT      NOT NULL DEFAULT 0,
  gp_earn_bonus_pct SMALLINT      NOT NULL DEFAULT 0,
  max_lucky_per_day SMALLINT      NOT NULL DEFAULT 0,
  sort_order        INT           NOT NULL DEFAULT 0,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vip_passes (
  id           SERIAL PRIMARY KEY,
  wallet       VARCHAR(100)  NOT NULL,
  tier_id      INT           NOT NULL REFERENCES vip_tiers(id),
  gp_spent     DECIMAL(20,6) NOT NULL,
  activated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ   NOT NULL,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  UNIQUE (wallet)
);

CREATE TABLE IF NOT EXISTS vip_log (
  id         SERIAL PRIMARY KEY,
  wallet     VARCHAR(100)  NOT NULL,
  tier_id    INT           NOT NULL,
  event_type VARCHAR(20)   NOT NULL DEFAULT 'purchased',
  gp_spent   DECIMAL(20,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_passes_wallet  ON vip_passes(wallet) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vip_passes_expires ON vip_passes(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vip_log_wallet     ON vip_log(wallet, created_at DESC);

-- Settings (올바른 settings 테이블 사용)
INSERT INTO settings (category, key, value, description) VALUES
  ('vip', 'vip_enabled',           'true',  'VIP 패스 시스템 활성화'),
  ('vip', 'vip_show_badges',       'true',  '닉네임 옆 VIP 배지 표시'),
  ('vip', 'vip_upgrade_refund_pct','50',    '업그레이드 시 잔여 가치 환불 %')
ON CONFLICT (key) DO NOTHING;

-- Seed VIP tiers
-- Pioneer: 채굴 +10%, 크레이트 1개/월
-- Colonist: 채굴 +20%, GP보너스 +10%, 크레이트 2개/월, 수수료 -5%
-- Commander: 채굴 +35%, GP보너스 +20%, 크레이트 5개/월, 수수료 -10%
INSERT INTO vip_tiers (name, badge, badge_color, cost_gp, period_days, mining_boost_pct, fee_discount_pct, gp_earn_bonus_pct, max_lucky_per_day, sort_order) VALUES
  ('Pioneer',   '⭐', '#ffcc02', 200,  30, 10, 0,  0,  1, 1),
  ('Colonist',  '🌟', '#81d4fa', 500,  30, 20, 5,  10, 2, 2),
  ('Commander', '💫', '#ce93d8', 1200, 30, 35, 10, 20, 5, 3)
ON CONFLICT DO NOTHING;
