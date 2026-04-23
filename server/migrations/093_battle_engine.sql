-- ============================================================
-- Migration 093: Battle Engine
--
-- Naval fleet battles between players.
-- Ships from Migration 092 are deployed into battles.
-- ⚠️  wallet-based — no users.id
-- ============================================================

-- ── 1. battles ──
CREATE TABLE IF NOT EXISTS battles (
  id                SERIAL PRIMARY KEY,
  attacker_wallet   VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  defender_wallet   VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  sector_id         INT REFERENCES sectors(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','completed','cancelled')),
  winner_wallet     VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  attacker_power    INT NOT NULL DEFAULT 0,
  defender_power    INT NOT NULL DEFAULT 0,
  gp_stake          INT NOT NULL DEFAULT 0,
  battle_log        JSONB,
  declared_at       TIMESTAMP DEFAULT NOW(),
  resolved_at       TIMESTAMP,
  expires_at        TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attacker_wallet, status);
CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defender_wallet, status);
CREATE INDEX IF NOT EXISTS idx_battles_status   ON battles(status, expires_at);

-- ── 2. battle_ships ── (which ships participated in which battle)
CREATE TABLE IF NOT EXISTS battle_ships (
  id            SERIAL PRIMARY KEY,
  battle_id     INT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  ship_id       INT NOT NULL REFERENCES user_ships(id) ON DELETE CASCADE,
  side          VARCHAR(10) NOT NULL CHECK (side IN ('attacker','defender')),
  hp_at_start   INT NOT NULL DEFAULT 0,
  hp_at_end     INT NOT NULL DEFAULT 0,
  survived      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_battle_ships_battle ON battle_ships(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_ships_ship   ON battle_ships(ship_id);

-- ── 3. Settings ──
INSERT INTO settings (key, value, description, category) VALUES
  ('battle_enabled',            'true',  '함선 전투 시스템 활성화', 'battle'),
  ('battle_min_attacker_ships', '1',     '공격 최소 함선 수', 'battle'),
  ('battle_max_ships_per_side', '5',     '전투당 최대 함선 수 (각 진영)', 'battle'),
  ('battle_duration_secs',      '60',    '전투 지속 시간 (초, 자동 해결)', 'battle'),
  ('battle_gp_stake_min',       '10',    '전투 최소 GP 스테이크', 'battle'),
  ('battle_gp_stake_max',       '500',   '전투 최대 GP 스테이크', 'battle'),
  ('battle_winner_hp_restore',  '50',    '승자 함선 HP 회복 %', 'battle'),
  ('battle_loser_ship_destroy', '30',    '패자 함선 파괴 확률 % (per ship)', 'battle')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS battle_ships;
--   DROP TABLE IF EXISTS battles;
--   DELETE FROM settings WHERE category = 'battle';
-- ============================================================
