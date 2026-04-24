-- Migration 159: 길드전 승리 버프 시스템
-- 길드가 전쟁에서 이기면 일정 시간 동안 GP 보너스 등 버프를 받는다.

-- 길드 테이블에 전쟁 승리 버프 컬럼 추가
ALTER TABLE guilds
  ADD COLUMN IF NOT EXISTS war_buff_type    VARCHAR(20) DEFAULT NULL,   -- 'gp_bonus' 등
  ADD COLUMN IF NOT EXISTS war_buff_pct     INT         DEFAULT 0,      -- 보너스 % (예: 20 = +20%)
  ADD COLUMN IF NOT EXISTS war_buff_expires_at TIMESTAMPTZ DEFAULT NULL; -- 버프 만료 시각

-- 설정값
INSERT INTO settings (category, key, value, description) VALUES
  ('guild', 'guild_war_victory_buff_type',      '"gp_bonus"',  '길드전 승리 시 적용 버프 타입 (gp_bonus)'),
  ('guild', 'guild_war_victory_buff_pct',       '20',          '승리 버프 보너스 퍼센트 (예: 20 = +20% GP 수익)'),
  ('guild', 'guild_war_victory_buff_hours',     '48',          '승리 버프 지속 시간 (시간)')
ON CONFLICT (key) DO NOTHING;
