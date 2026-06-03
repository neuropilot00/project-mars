-- ═══════════════════════════════════════════════════════════════
-- Migration 099: 직업 시스템 (Job System)
-- 바이블 V4 PART 3 § 3.4 기준
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. 직업 정의 테이블 ───

CREATE TABLE IF NOT EXISTS jobs (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(20) UNIQUE NOT NULL,
  name_en             VARCHAR(50),
  name_ko             VARCHAR(50),
  name_ja             VARCHAR(50),
  name_zh             VARCHAR(50),
  description_en      TEXT,
  description_ko      TEXT,
  description_ja      TEXT,
  description_zh      TEXT,
  icon_emoji          VARCHAR(10),
  color_hex           VARCHAR(7),
  recommended_sector  VARCHAR(30),
  is_active           BOOLEAN DEFAULT TRUE,
  sort_order          INT DEFAULT 0
);

-- (배포 안전 v7.368) 구버전 080_job_system이 jobs를 recommended_sector 없이 먼저
-- 만들었으면 위 CREATE가 스킵되어 아래 INSERT(...recommended_sector...)가 깨진다 → 보강.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_sector VARCHAR(30);

-- ─── 2. 직업별 버프 테이블 ───

CREATE TABLE IF NOT EXISTS job_buffs (
  id          SERIAL PRIMARY KEY,
  job_id      INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  buff_key    VARCHAR(60) NOT NULL,
  buff_value  DECIMAL(10,4) NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, buff_key)
);

-- ─── 3. users 테이블 컬럼 추가 ───

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_job_id     INT REFERENCES jobs(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_selected_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_changed_at     TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_job_changes INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_reset_at    TIMESTAMPTZ DEFAULT NOW();

-- ─── 4. 직업 변경 로그 ───

CREATE TABLE IF NOT EXISTS job_change_log (
  id          BIGSERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  from_job_id INT REFERENCES jobs(id),
  to_job_id   INT NOT NULL REFERENCES jobs(id),
  change_type VARCHAR(20),  -- 'free', 'paid', 'onboarding'
  gp_cost     INT DEFAULT 0,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- (배포 안전 v7.368) 구버전 080_job_system이 job_change_log를 user_id 스키마로 먼저
-- 만들었으면 위 CREATE IF NOT EXISTS가 스킵된다. 코드(services/job.js)와 prod는
-- wallet_address를 쓰므로 컬럼을 보강하고, 구버전 user_id NOT NULL은 해제해
-- 런타임 INSERT(wallet_address만 제공)가 깨지지 않게 한다.
ALTER TABLE job_change_log ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(100);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='job_change_log' AND column_name='user_id') THEN
    ALTER TABLE job_change_log ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_change_log_wallet ON job_change_log(wallet_address, changed_at DESC);

-- ─── 5. 직업 초기 데이터 ───

INSERT INTO jobs (code, name_en, name_ko, name_ja, name_zh, icon_emoji, color_hex,
  description_en, description_ko, recommended_sector, sort_order)
VALUES
(
  'miner', 'Miner', '광부', 'マイナー', '矿工', '⛏️', '#F4A460',
  'Mining specialist. Earns the most but struggles in combat.',
  '위험한 Frontier에서 자원을 캐는 전문가. 싸움은 못하지만 제일 많이 번다.',
  'hellas_abyss', 1
),
(
  'warrior', 'Warrior', '전사', 'ウォリアー', '战士', '⚔️', '#DC143C',
  'Combat specialist. Only job that earns directly through Hijack.',
  '공격과 방어가 전문. Hijack으로 직접 돈 버는 유일한 직업.',
  'coprates_ridge', 2
),
(
  'crafter', 'Crafter', '제작자', 'クラフター', '制作者', '🔨', '#9370DB',
  'Enhancement specialist. Supplies premium items to the market.',
  'Enhancement 전문가. 시장에 고가 아이템을 공급한다.',
  'arsia_forge', 3
),
(
  'merchant', 'Merchant', '상인', 'マーチャント', '商人', '💼', '#20B2AA',
  'Trading specialist. Lowest fees, most listings.',
  '거래 전문가. 가장 낮은 수수료로 가장 많은 리스팅 가능.',
  'pavonis_gate', 4
)
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  description_ko = EXCLUDED.description_ko,
  icon_emoji = EXCLUDED.icon_emoji,
  color_hex = EXCLUDED.color_hex,
  is_active = true;

-- ─── 6. 직업별 버프 초기 데이터 ───

-- MINER 버프
DO $$
DECLARE v_id INT;
BEGIN
  SELECT id INTO v_id FROM jobs WHERE code = 'miner';

  INSERT INTO job_buffs (job_id, buff_key, buff_value, description) VALUES
    (v_id, 'miner_mining_rate',            1.50, 'Mining PP 수익 +50%'),
    (v_id, 'miner_harvest_cooldown',       0.70, 'Harvest 쿨다운 ×0.7'),
    (v_id, 'miner_active_prospecting',     5,    '일일 능동 채굴 횟수 +5'),
    (v_id, 'miner_deep_dig_daily',         5,    '일일 Deep Dig 횟수'),
    (v_id, 'miner_poi_reward',             1.40, 'POI 탐험 보상 +40%'),
    (v_id, 'miner_rare_resource_chance',   1.30, '희귀 자원 발견 확률 +30%'),
    (v_id, 'miner_resource_drop_quantity', 1.20, '자원 드롭 수량 +20%'),
    (v_id, 'miner_combat_power',           0.70, '전투력 -30%'),
    (v_id, 'miner_enhancement_success',    0.95, '강화 성공률 -5%'),
    (v_id, 'miner_market_fee',             1.00, '마켓 수수료 변화 없음')
  ON CONFLICT (job_id, buff_key) DO UPDATE SET buff_value = EXCLUDED.buff_value;
END $$;

-- WARRIOR 버프
DO $$
DECLARE v_id INT;
BEGIN
  SELECT id INTO v_id FROM jobs WHERE code = 'warrior';

  INSERT INTO job_buffs (job_id, buff_key, buff_value, description) VALUES
    (v_id, 'warrior_combat_power',              1.30, '전투력 +30%'),
    (v_id, 'warrior_hijack_success',            1.20, 'Hijack 성공률 ×1.2'),
    (v_id, 'warrior_hijack_damage',             1.15, 'Hijack 시 추가 PP 탈취 +15%'),
    (v_id, 'warrior_defense_item_effect',       1.25, '방어 아이템 효과 +25%'),
    (v_id, 'warrior_attack_item_effect',        1.20, '공격 아이템 효과 +20%'),
    (v_id, 'warrior_siege_participation',       1.50, 'Siege 기간 영토 구매 비용 -33%'),
    (v_id, 'warrior_spy_resistance',            1.30, 'Decoy 아이템에 속을 확률 -30%'),
    (v_id, 'warrior_mining_rate',               0.80, 'Mining 수익 -20%'),
    (v_id, 'warrior_enhancement_success',       0.90, '강화 성공률 -10%'),
    (v_id, 'warrior_market_fee',                1.00, '마켓 수수료 변화 없음')
  ON CONFLICT (job_id, buff_key) DO UPDATE SET buff_value = EXCLUDED.buff_value;
END $$;

-- CRAFTER 버프
DO $$
DECLARE v_id INT;
BEGIN
  SELECT id INTO v_id FROM jobs WHERE code = 'crafter';

  INSERT INTO job_buffs (job_id, buff_key, buff_value, description) VALUES
    (v_id, 'crafter_enhancement_success',          1.30, '강화 성공률 +30%'),
    (v_id, 'crafter_enhancement_cost',             0.80, '강화 GP 비용 -20%'),
    (v_id, 'crafter_enhancement_break_protection', 0.40, '파괴 확률 ×0.4'),
    (v_id, 'crafter_enhancement_material_saving',  0.85, '자원 소모 -15%'),
    (v_id, 'crafter_daily_enhancement_limit',      20,   '일일 강화 시도 20회'),
    (v_id, 'crafter_special_recipe_unlock',        1.00, '특수 제작 레시피 접근'),
    (v_id, 'crafter_mining_rate',                  0.80, 'Mining 수익 -20%'),
    (v_id, 'crafter_combat_power',                 0.80, '전투력 -20%'),
    (v_id, 'crafter_market_fee',                   0.90, '마켓 수수료 -10%')
  ON CONFLICT (job_id, buff_key) DO UPDATE SET buff_value = EXCLUDED.buff_value;
END $$;

-- MERCHANT 버프
DO $$
DECLARE v_id INT;
BEGIN
  SELECT id INTO v_id FROM jobs WHERE code = 'merchant';

  INSERT INTO job_buffs (job_id, buff_key, buff_value, description) VALUES
    (v_id, 'merchant_market_fee',                    0.65, '마켓 수수료 35% 할인'),
    (v_id, 'merchant_auction_fee',                   0.65, '옥션 수수료 35% 할인'),
    (v_id, 'merchant_listing_limit',                 2.00, '최대 리스팅 2배'),
    (v_id, 'merchant_price_history_days',            60,   '가격 히스토리 60일'),
    (v_id, 'merchant_market_insight',                1.00, '최근 10건 거래 가격 열람'),
    (v_id, 'merchant_governor_market_cut_reduction', 0.50, 'Governor 마켓세 50% 면제'),
    (v_id, 'merchant_cross_sector_fee',              0.85, '섹터 간 이동 비용 -15%'),
    (v_id, 'merchant_mining_rate',                   0.85, 'Mining 수익 -15%'),
    (v_id, 'merchant_combat_power',                  0.80, '전투력 -20%'),
    (v_id, 'merchant_enhancement_success',           0.95, '강화 성공률 -5%')
  ON CONFLICT (job_id, buff_key) DO UPDATE SET buff_value = EXCLUDED.buff_value;
END $$;

-- ─── 7. 인덱스 ───

CREATE INDEX IF NOT EXISTS idx_users_job ON users(current_job_id) WHERE current_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_buffs_job_key ON job_buffs(job_id, buff_key);

-- ─── 8. 주간 리셋 함수 ───

CREATE OR REPLACE FUNCTION reset_weekly_job_changes()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET weekly_job_changes = 0,
      weekly_reset_at = NOW()
  WHERE weekly_reset_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ─── 완료 알림 ───
DO $$
BEGIN
  RAISE NOTICE '[migration 099] job system: jobs(4), job_buffs applied, users columns added';
END $$;

COMMIT;

-- 검증:
-- SELECT code, name_ko, icon_emoji FROM jobs ORDER BY sort_order;
-- SELECT j.code, jb.buff_key, jb.buff_value FROM jobs j JOIN job_buffs jb ON jb.job_id=j.id ORDER BY j.sort_order, jb.buff_key;
-- \d users (current_job_id 컬럼 확인)
