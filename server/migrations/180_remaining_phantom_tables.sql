-- ═══════════════════════════════════════════════════
-- 180: 잔여 phantom 테이블 일괄 처리 (achievements / rental / claimUpgrades / profile_change_log)
-- ═══════════════════════════════════════════════════
-- 사용자 검토 결과 모두 살리기로 결정된 기능들.
-- §13.A의 잔여 phantom 7개 중 5개를 여기서 해소.
-- 나머지 (tournaments tournament_entries, achievements user_ships, battle_ships) 는
-- 코드 측 컬럼 정정으로 처리 (서비스 코드 패치).

BEGIN;

-- ═════════════════════════════════════════════════════════
-- 1) achievements (services/achievements.js)
-- ═════════════════════════════════════════════════════════
-- 업적 정의 + 유저별 진행 상태. 다국어 지원.
CREATE TABLE IF NOT EXISTS achievements (
  key             VARCHAR(64) PRIMARY KEY,
  name_en         VARCHAR(100) NOT NULL,
  name_ko         VARCHAR(100),
  name_ja         VARCHAR(100),
  name_zh         VARCHAR(100),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  rarity          VARCHAR(20) DEFAULT 'common',  -- common / rare / epic / legendary
  category        VARCHAR(32),                    -- 'territory' / 'combat' / 'economy' / 'social'
  icon            VARCHAR(32),
  condition_value INTEGER NOT NULL DEFAULT 1,
  condition_type  VARCHAR(32) NOT NULL,           -- 'claim_count', 'ship_count', 'battle_wins', 'gp_balance', etc.
  reward_gp       NUMERIC(20,6) DEFAULT 0,
  xp_reward       INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS user_achievements (
  wallet           VARCHAR(42) NOT NULL,
  achievement_key  VARCHAR(64) NOT NULL REFERENCES achievements(key) ON DELETE CASCADE,
  unlocked_at      TIMESTAMPTZ DEFAULT NOW(),
  claimed          BOOLEAN DEFAULT false,
  claimed_at       TIMESTAMPTZ,
  PRIMARY KEY (wallet, achievement_key)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_wallet ON user_achievements(wallet);

-- ═════════════════════════════════════════════════════════
-- 2) rental (services/rental.js — 영토 임대)
-- ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_rentals (
  id              BIGSERIAL PRIMARY KEY,
  claim_id        INTEGER NOT NULL,
  owner           VARCHAR(42) NOT NULL,
  tenant          VARCHAR(42),
  gp_per_period   NUMERIC(20,6) NOT NULL,
  period_hours    INTEGER NOT NULL,
  periods_paid    INTEGER DEFAULT 0,
  boost_pct       INTEGER DEFAULT 0,             -- 임대 시 채굴 부스트 %
  fee_pct         NUMERIC(5,2) NOT NULL,         -- 플랫폼 수수료 %
  status          VARCHAR(16) NOT NULL DEFAULT 'listed', -- listed / rented / expired / cancelled
  rented_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_rentals_owner ON territory_rentals(owner) WHERE status IN ('listed','rented');
CREATE INDEX IF NOT EXISTS idx_territory_rentals_tenant ON territory_rentals(tenant) WHERE status = 'rented';
CREATE INDEX IF NOT EXISTS idx_territory_rentals_claim ON territory_rentals(claim_id);
CREATE INDEX IF NOT EXISTS idx_territory_rentals_status ON territory_rentals(status, expires_at);

CREATE TABLE IF NOT EXISTS rental_log (
  id            BIGSERIAL PRIMARY KEY,
  rental_id     BIGINT NOT NULL REFERENCES territory_rentals(id) ON DELETE CASCADE,
  claim_id      INTEGER NOT NULL,
  owner         VARCHAR(42) NOT NULL,
  tenant        VARCHAR(42) NOT NULL,
  gp_paid       NUMERIC(20,6) NOT NULL,
  gp_to_owner   NUMERIC(20,6) NOT NULL,
  gp_fee        NUMERIC(20,6) NOT NULL,
  periods       INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rental_log_owner ON rental_log(owner, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_log_tenant ON rental_log(tenant, created_at DESC);

-- ═════════════════════════════════════════════════════════
-- 3) claimUpgrades (services/claimUpgrades.js — 영토 업그레이드)
-- ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_upgrades (
  id              BIGSERIAL PRIMARY KEY,
  claim_id        INTEGER NOT NULL,
  owner           VARCHAR(42) NOT NULL,
  upgrade_type    VARCHAR(32) NOT NULL,          -- 'mining_boost', 'shield', 'defense', 등
  level           INTEGER NOT NULL DEFAULT 1,
  gp_spent        NUMERIC(20,6) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  destroyed_at    TIMESTAMPTZ,                    -- hijack 등으로 파괴된 시각
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_upgrades_claim_active ON territory_upgrades(claim_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_territory_upgrades_owner ON territory_upgrades(owner) WHERE is_active = true;

-- ═════════════════════════════════════════════════════════
-- 4) profile_change_log (services/profile.js — 프로필 변경 감사)
-- ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profile_change_log (
  id           BIGSERIAL PRIMARY KEY,
  wallet       VARCHAR(42) NOT NULL,
  field        VARCHAR(32) NOT NULL,             -- 'nickname', 'avatar_color', 'motto'
  old_value    TEXT,
  new_value    TEXT,
  gp_spent     NUMERIC(20,6) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_change_log_wallet ON profile_change_log(wallet, created_at DESC);

-- ═════════════════════════════════════════════════════════
-- 5) tournament_entries (services/tournaments.js — 단순 GP 토너먼트)
-- ═════════════════════════════════════════════════════════
-- 별도 시스템: tournament_participants는 fleet 기반 매치업,
-- tournament_entries는 단순 entry-fee → prize-pool 모델 (다른 기능).
CREATE TABLE IF NOT EXISTS tournament_entries (
  id              BIGSERIAL PRIMARY KEY,
  tournament_id   BIGINT NOT NULL,
  wallet          VARCHAR(42) NOT NULL,
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_wallet ON tournament_entries(wallet);

-- ═════════════════════════════════════════════════════════
-- 6) achievements 시드 (admin이 추후 수정 가능, 기본 14개 제공)
-- ═════════════════════════════════════════════════════════
INSERT INTO achievements (key, name_en, name_ko, description_en, description_ko, rarity, category, icon, condition_value, condition_type, reward_gp, xp_reward) VALUES
  ('first_claim',       'First Steps',      '첫 발자국',     'Claim your first territory',         '첫 영토를 점령하세요',                'common',    'territory', '🚩', 1,    'claim_count',  10,  50),
  ('claim_10',          'Settler',          '정착민',        'Claim 10 territories',               '영토 10개 점령',                      'rare',      'territory', '🏘️', 10,   'claim_count',  50,  200),
  ('claim_50',          'Colonizer',        '식민지 개척자', 'Claim 50 territories',               '영토 50개 점령',                      'epic',      'territory', '🏰', 50,   'claim_count',  200, 1000),
  ('claim_100',         'Empire Builder',   '제국 건설자',   'Claim 100 territories',              '영토 100개 점령',                     'legendary', 'territory', '👑', 100,  'claim_count',  500, 3000),
  ('first_ship',        'Captain',          '선장',          'Build your first ship',              '첫 함선 건조',                        'common',    'combat',    '🚢', 1,    'ship_count',   20,  100),
  ('ship_fleet_10',     'Admiral',          '제독',          'Own 10 active ships',                '함선 10척 보유',                      'rare',      'combat',    '⚓', 10,   'ship_count',   100, 500),
  ('battle_winner',     'Warrior',          '전사',          'Win your first battle',              '첫 전투 승리',                        'common',    'combat',    '⚔️', 1,    'battle_wins',  30,  150),
  ('battle_10_wins',    'Champion',         '챔피언',        'Win 10 battles',                     '10회 전투 승리',                      'rare',      'combat',    '🏆', 10,   'battle_wins',  150, 750),
  ('gp_1000',           'Investor',         '투자자',        'Hold 1,000 GP',                      'GP 1,000 보유',                       'common',    'economy',   '💰', 1000, 'gp_balance',   0,   100),
  ('gp_10000',          'Tycoon',           '타이쿤',        'Hold 10,000 GP',                     'GP 10,000 보유',                      'epic',      'economy',   '💎', 10000,'gp_balance',   0,   1000),
  ('marketplace_buyer', 'Collector',        '컬렉터',        'Buy 5 items from marketplace',       '마켓에서 5개 구매',                   'common',    'economy',   '🛍️', 5,    'market_bought',50,  300),
  ('marketplace_seller','Merchant',         '상인',          'Sell 5 items on marketplace',        '마켓에서 5개 판매',                   'rare',      'economy',   '🏪', 5,    'market_sold',  50,  300),
  ('guild_member',      'Brotherhood',      '형제단',        'Join a guild',                       '길드 가입',                           'common',    'social',    '🤝', 1,    'guild_member', 25,  100),
  ('referral_3',        'Recruiter',        '리크루터',      'Refer 3 players',                    '3명 추천',                            'rare',      'social',    '🎯', 3,    'referrals',    100, 500)
ON CONFLICT (key) DO NOTHING;

-- ═════════════════════════════════════════════════════════
INSERT INTO schema_migrations (filename) VALUES ('180_remaining_phantom_tables.sql')
ON CONFLICT DO NOTHING;

COMMIT;
