-- v5.58 Ship infinite stat upgrades
-- Owned ships can receive endless per-stat investments without "+N" grade naming.

ALTER TABLE ships ADD COLUMN IF NOT EXISTS bonus_speed NUMERIC(8,2) NOT NULL DEFAULT 0;

ALTER TABLE ships ALTER COLUMN bonus_atk SET DEFAULT 0;
ALTER TABLE ships ALTER COLUMN bonus_def SET DEFAULT 0;
ALTER TABLE ships ALTER COLUMN bonus_hp SET DEFAULT 0;
UPDATE ships
SET bonus_atk = COALESCE(bonus_atk, 0),
    bonus_def = COALESCE(bonus_def, 0),
    bonus_hp = COALESCE(bonus_hp, 0),
    bonus_speed = COALESCE(bonus_speed, 0);

CREATE TABLE IF NOT EXISTS ship_stat_upgrade_log (
  id BIGSERIAL PRIMARY KEY,
  ship_id BIGINT REFERENCES ships(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  stat VARCHAR(12) NOT NULL CHECK (stat IN ('atk', 'def', 'hp', 'speed')),
  from_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  to_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  gp_cost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_stat_upgrade_log_ship ON ship_stat_upgrade_log(ship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ship_stat_upgrade_log_wallet ON ship_stat_upgrade_log(wallet_address, created_at DESC);

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'ship_upgrade_base_gp', '25', '함선 스탯 강화 기본 GP 비용'),
  ('fleet', 'ship_upgrade_growth', '1.14', '함선 스탯 강화 총 투자 횟수별 비용 증가율'),
  ('fleet', 'ship_upgrade_atk_step', '1', '공격력 강화 1회 증가량'),
  ('fleet', 'ship_upgrade_def_step', '1', '방어력 강화 1회 증가량'),
  ('fleet', 'ship_upgrade_hp_step', '200', '체력 강화 1회 증가량'),
  ('fleet', 'ship_upgrade_speed_step', '0.05', '속도 강화 1회 증가량')
ON CONFLICT (key) DO NOTHING;
