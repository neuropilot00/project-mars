-- Migration 080: 직업 시스템 (Job System)
-- MASTER_PLAN.md Phase 1 기준

-- 직업 정의 테이블
CREATE TABLE IF NOT EXISTS jobs (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name_en     VARCHAR(50) NOT NULL,
  name_ko     VARCHAR(50) NOT NULL,
  name_ja     VARCHAR(50) NOT NULL,
  name_zh     VARCHAR(50) NOT NULL,
  description_en TEXT,
  description_ko TEXT,
  description_ja TEXT,
  description_zh TEXT,
  icon_emoji  VARCHAR(10) DEFAULT '⚔️',
  color_hex   VARCHAR(7)  DEFAULT '#888888',
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 직업별 버프 수치 (settings 패턴과 동일)
CREATE TABLE IF NOT EXISTS job_buffs (
  id          SERIAL PRIMARY KEY,
  job_id      INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  buff_key    VARCHAR(60) NOT NULL,
  buff_value  DECIMAL(8, 4) NOT NULL,
  description TEXT,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, buff_key)
);

-- users 테이블 확장
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_job_id         INT REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS job_selected_at         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS job_changed_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS weekly_job_change_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_job_reset_at     TIMESTAMP DEFAULT NOW();

-- 직업 변경 로그
CREATE TABLE IF NOT EXISTS job_change_log (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  from_job_id INT REFERENCES jobs(id),
  to_job_id   INT NOT NULL REFERENCES jobs(id),
  change_type VARCHAR(20) DEFAULT 'free',  -- 'free', 'paid'
  gp_cost     INT DEFAULT 0,
  changed_at  TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_job          ON users(current_job_id);
CREATE INDEX IF NOT EXISTS idx_job_buffs_job      ON job_buffs(job_id, buff_key);
CREATE INDEX IF NOT EXISTS idx_job_change_log_user ON job_change_log(user_id, changed_at);

-- ─────────────────────────────────────────
-- 초기 데이터: 직업 4종
-- ─────────────────────────────────────────
INSERT INTO jobs (code, name_en, name_ko, name_ja, name_zh,
  description_en, description_ko, description_ja, description_zh,
  icon_emoji, color_hex, sort_order)
VALUES
  ('miner',
   'Miner',    '광부',   'マイナー',   '矿工',
   'Specializes in mining and exploration. Higher resource yields and POI rewards.',
   '채굴과 탐험 전문가. 자원 수익과 POI 보상이 높습니다.',
   '採掘と探索のスペシャリスト。資源収益とPOI報酬が高い。',
   '专注采矿与探索。资源收益和POI奖励更高。',
   '⛏️', '#F4A460', 1),

  ('warrior',
   'Warrior',  '전사',   'ウォリアー', '战士',
   'Dominates combat. Higher Hijack success rate and powerful item effects.',
   '전투의 지배자. Hijack 성공률과 아이템 효과가 강력합니다.',
   '戦闘を支配する。ハイジャック成功率とアイテム効果が強力。',
   '战斗主宰。更高的劫持成功率和强力道具效果。',
   '⚔️', '#DC143C', 2),

  ('crafter',
   'Crafter',  '제작자', 'クラフター', '制作者',
   'Masters enhancement. Better success rates, lower costs, and break protection.',
   '강화의 장인. 성공률 향상, 비용 절감, 파괴 방지 효과.',
   '強化のマスター。成功率向上・コスト削減・破壊防止。',
   '强化大师。提升成功率、降低费用、防止破坏。',
   '🔨', '#9370DB', 3),

  ('merchant',
   'Merchant', '상인',   'マーチャント','商人',
   'Rules the marketplace. Discounted fees and expanded listing capacity.',
   '마켓의 지배자. 수수료 할인과 리스팅 한도 확장.',
   'マーケットの支配者。手数料割引とリスティング枠拡張。',
   '市场主宰。手续费折扣和更多挂单额度。',
   '💼', '#20B2AA', 4)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────
-- 초기 데이터: Miner 버프 (job_id = 1 보장을 위해 subquery 사용)
-- ─────────────────────────────────────────
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_mining_rate',         1.50, 'Mining 수익률 +50%'         FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_harvest_speed',       1.30, 'Harvest 쿨다운 -30%'        FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_poi_reward',          1.40, 'POI 탐험 보상 +40%'          FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_rare_resource_chance',1.30, '희귀 자원 발견 확률 +30%'    FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_combat_power',        0.70, '전투력 -30% (약점)'          FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_enhancement_success', 1.00, '강화 성공률 변화 없음'        FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'miner_market_fee',          1.00, '마켓 수수료 변화 없음'        FROM jobs WHERE code = 'miner'
ON CONFLICT (job_id, buff_key) DO NOTHING;

-- Warrior 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_combat_power',         1.30, '전투력 +30%'              FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_hijack_success',       1.20, 'Hijack 성공 확률 +20%'    FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_defense_item_effect',  1.25, '방어 아이템 효과 +25%'    FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_attack_item_effect',   1.20, '공격 아이템 효과 +20%'    FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_mining_rate',          0.80, 'Mining 수익률 -20% (약점)' FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_enhancement_success',  0.90, '강화 성공률 -10%'          FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'warrior_market_fee',           1.00, '마켓 수수료 변화 없음'      FROM jobs WHERE code = 'warrior'
ON CONFLICT (job_id, buff_key) DO NOTHING;

-- Crafter 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_enhancement_success',         1.25, '강화 성공률 +25%'        FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_enhancement_cost',            0.85, '강화 GP 비용 -15%'       FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_enhancement_break_protection',0.50, '파괴 확률 ×0.5 감소'    FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_mining_rate',                 0.80, 'Mining 수익률 -20%'       FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_combat_power',                0.80, '전투력 -20%'              FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'crafter_market_fee',                  0.90, '마켓 수수료 -10%'         FROM jobs WHERE code = 'crafter'
ON CONFLICT (job_id, buff_key) DO NOTHING;

-- Merchant 버프
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_market_fee',           0.70, '마켓 수수료 30% 할인'         FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_listing_limit',        1.50, '최대 활성 리스팅 ×1.5 (30개)' FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_price_history_days',  30.00, '가격 히스토리 30일'            FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_mining_rate',          0.85, 'Mining 수익률 -15%'            FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_combat_power',         0.80, '전투력 -20%'                   FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT id, 'merchant_enhancement_success',  0.95, '강화 성공률 -5%'               FROM jobs WHERE code = 'merchant'
ON CONFLICT (job_id, buff_key) DO NOTHING;

-- ─────────────────────────────────────────
-- settings 테이블에 직업 관련 설정 5개 추가
-- ─────────────────────────────────────────
INSERT INTO settings (key, value, description) VALUES
  ('job_change_cost_gp',       '50',   '유료 직업 변경 GP 비용'),
  ('job_change_weekly_free',   '1',    '주당 무료 직업 변경 횟수'),
  ('job_change_cooldown_hours','24',   '직업 변경 쿨다운 (시간)'),
  ('job_system_enabled',       'true', '직업 시스템 활성화 여부'),
  ('job_required_level',       '5',    '직업 선택 최소 레벨')
ON CONFLICT (key) DO NOTHING;
