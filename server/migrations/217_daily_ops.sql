-- Migration 217: Daily OPS 미션 시스템
-- 매일 UTC 00:00 리셋, 3개 미션 자동 생성

CREATE TABLE IF NOT EXISTS daily_ops (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) NOT NULL,
  ops_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mission_type VARCHAR(50) NOT NULL,
  target_count INT NOT NULL DEFAULT 1,
  current_count INT NOT NULL DEFAULT 0,
  reward_gp INT NOT NULL DEFAULT 50,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, ops_date, mission_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_ops_wallet_date ON daily_ops(wallet_address, ops_date);
CREATE INDEX IF NOT EXISTS idx_daily_ops_date_unclaimed ON daily_ops(ops_date, completed, reward_claimed);

-- 미션 타입 및 보상 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('daily_ops', 'mission_harvest_gp',       '50',   'Daily OPS: 채굴 1회 보상 GP'),
  ('daily_ops', 'mission_battle_gp',        '100',  'Daily OPS: 전투 참여 1회 보상 GP'),
  ('daily_ops', 'mission_upgrade_gp',       '75',   'Daily OPS: 함선 강화 1회 보상 GP'),
  ('daily_ops', 'mission_craft_gp',         '60',   'Daily OPS: 재료 제작 1회 보상 GP'),
  ('daily_ops', 'mission_territory_art_gp', '80',   'Daily OPS: 영토 이미지 등록 1회 보상 GP'),
  ('daily_ops', 'enabled',                  'true', 'Daily OPS 시스템 활성화')
ON CONFLICT (key) DO NOTHING;

-- 주간 이벤트 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('weekly_events', 'mon_type',        '"mining_bonus"',    '월요일 이벤트 타입'),
  ('weekly_events', 'mon_multiplier',  '1.5',               '월요일 이벤트 배율'),
  ('weekly_events', 'mon_label_en',    '"Mining Bonus +50%"','월요일 이벤트 영문 라벨'),
  ('weekly_events', 'mon_label_ko',    '"채굴 보너스 +50%"', '월요일 이벤트 한글 라벨'),
  ('weekly_events', 'wed_type',        '"battle_gp_boost"', '수요일 이벤트 타입'),
  ('weekly_events', 'wed_multiplier',  '1.3',               '수요일 이벤트 배율'),
  ('weekly_events', 'wed_label_en',    '"Battle GP +30%"',  '수요일 이벤트 영문 라벨'),
  ('weekly_events', 'wed_label_ko',    '"전투 GP +30%"',    '수요일 이벤트 한글 라벨'),
  ('weekly_events', 'fri_type',        '"upgrade_discount"','금요일 이벤트 타입'),
  ('weekly_events', 'fri_multiplier',  '0.8',               '금요일 이벤트 배율'),
  ('weekly_events', 'fri_label_en',    '"Upgrade -20%"',    '금요일 이벤트 영문 라벨'),
  ('weekly_events', 'fri_label_ko',    '"강화 비용 -20%"',  '금요일 이벤트 한글 라벨'),
  ('weekly_events', 'sat_type',        '"double_bounty"',   '토요일 이벤트 타입'),
  ('weekly_events', 'sat_multiplier',  '2.0',               '토요일 이벤트 배율'),
  ('weekly_events', 'sat_label_en',    '"Double Bounty"',   '토요일 이벤트 영문 라벨'),
  ('weekly_events', 'sat_label_ko',    '"현상금 2배"',      '토요일 이벤트 한글 라벨')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('217_daily_ops.sql') ON CONFLICT DO NOTHING;
