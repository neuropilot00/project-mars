-- ════════════════════════════════════════════════════════════════════
-- Migration 157 — Phase D: Guild War 72h ruleset + 1:1 Duels +
--                          3-guild Alliance cap + Betrayal Chronicle
--
-- 배경:
--   기존 services/duel.js는 존재하지 않는 테이블(gp_duels, game_settings,
--   gp_balances, career_stats, player_notifications)을 참조 → dead code.
--   본 마이그레이션에서 진짜 인프라를 깔고 다음 커밋에서 duel.js를 리라이트.
--
--   guild_wars 테이블은 이미 존재 (M-029~035 계열). 본 마이그레이션은
--   72h 룰셋용 컬럼 + admin settings만 추가 (스키마 깨지 않게 idempotent).
--
--   alliances는 wallet 기반인데 사용자 spec은 "3길드 동맹 상한"이라
--   guild-of-guilds 개념 필요 → alliance_guilds 매핑 테이블 신설.
--
-- 변경:
--   1) gp_duels 테이블 신설 (1:1 challenge)
--   2) alliance_guilds 테이블 신설 (max 3 guilds per alliance)
--   3) guild_wars 컬럼 보강 (gp_pot, ruleset_version)
--   4) settings (모두 admin 편집 가능):
--      - guild_war_duration_hours_default (72)
--      - guild_war_min/max_stake_gp
--      - guild_war_truce_min_hours (재선전 쿨다운)
--      - duel_default_expiry_hours, duel_min/max_stake_gp
--      - alliance_max_guilds (3), alliance_min_guilds (2)
--      - alliance_betrayal_cooldown_hours (168)
--      - chronicle_log_betrayal_enabled (true)
--
-- 모두 idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. gp_duels: 1:1 personal duel (real infra) ─────────────────────
CREATE TABLE IF NOT EXISTS gp_duels (
  id              SERIAL PRIMARY KEY,
  challenger      VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  defender        VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  wager_gp        INT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'fought'
  winner          VARCHAR(42) REFERENCES users(wallet_address),
  fight_seed      VARCHAR(64),         -- 결정론적 시뮬레이션 seed
  fight_log       JSONB DEFAULT '{}',  -- 라운드별 로그
  created_at      TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP,
  resolved_at     TIMESTAMP,
  CHECK (challenger <> defender),
  CHECK (status IN ('pending','accepted','declined','cancelled','expired','fought'))
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger ON gp_duels(challenger, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_defender   ON gp_duels(defender, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_status     ON gp_duels(status) WHERE status IN ('pending','accepted');

-- ── 2. alliance_guilds: guild-level 동맹 (max 3 guilds) ─────────────
-- 기존 alliances/alliance_members는 wallet 기반 (개인 단위). 본 테이블은
-- guild → alliance 매핑을 별도로 추적해서 "3길드 동맹" 룰을 구현.
CREATE TABLE IF NOT EXISTS alliance_guilds (
  id              SERIAL PRIMARY KEY,
  alliance_id     BIGINT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  guild_id        INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  joined_at       TIMESTAMP DEFAULT NOW(),
  left_at         TIMESTAMP,
  betrayed_to     BIGINT REFERENCES alliances(id),  -- 다른 동맹으로 옮김
  betrayed_at     TIMESTAMP,
  invited_by      VARCHAR(42) REFERENCES users(wallet_address)
);

-- 한 길드는 동시에 한 동맹에만 (active)
CREATE UNIQUE INDEX IF NOT EXISTS uq_alliance_guilds_one_active
  ON alliance_guilds(guild_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alliance_guilds_alliance
  ON alliance_guilds(alliance_id) WHERE left_at IS NULL;

-- ── 3. guild_wars 룰셋 보강 ─────────────────────────────────────────
ALTER TABLE guild_wars
  ADD COLUMN IF NOT EXISTS ruleset_version    INT DEFAULT 1,        -- 72h 룰셋 = 1
  ADD COLUMN IF NOT EXISTS pot_attacker_gp    INT DEFAULT 0,        -- 공격측 베팅 GP
  ADD COLUMN IF NOT EXISTS pot_defender_gp    INT DEFAULT 0,        -- 방어측 베팅 GP
  ADD COLUMN IF NOT EXISTS truce_until        TIMESTAMP,            -- 재선전 가능 시각
  ADD COLUMN IF NOT EXISTS sector_id          INT REFERENCES sectors(id); -- 분쟁 섹터(있으면)

CREATE INDEX IF NOT EXISTS idx_guild_wars_truce ON guild_wars(truce_until)
  WHERE truce_until IS NOT NULL;

-- ── 4. settings: Phase D 룰셋 기본값 (모두 admin 편집 가능) ─────────
INSERT INTO settings (category, key, value, description) VALUES
  -- Guild War
  ('war', 'guild_war_duration_hours_default', '72',
   'Guild War 기본 지속 시간 (h). admin이 조정 가능.'),
  ('war', 'guild_war_min_stake_gp', '100',
   'Guild War 선전 시 한 측 최소 GP 베팅액'),
  ('war', 'guild_war_max_stake_gp', '50000',
   'Guild War 한 측 최대 GP 베팅액'),
  ('war', 'guild_war_truce_min_hours', '24',
   '같은 두 길드 간 재선전 쿨다운 (h)'),
  ('war', 'guild_war_winner_pot_pct', '70',
   '승리 길드가 가져가는 pot 비율 (%). 나머지는 시스템 sink/시즌풀'),

  -- Duel
  ('duel', 'duel_default_expiry_hours', '24',
   '도전장 기본 만료 시간 (h)'),
  ('duel', 'duel_min_stake_gp', '10',
   '도전장 최소 GP 베팅'),
  ('duel', 'duel_max_stake_gp', '5000',
   '도전장 최대 GP 베팅'),
  ('duel', 'duel_max_pending_per_pair', '1',
   '같은 두 유저 간 동시에 가능한 pending 도전장 수'),
  ('duel', 'duel_max_active_per_user', '5',
   '한 유저가 동시에 보낼 수 있는 pending 도전장 수'),

  -- Alliance
  ('alliance', 'alliance_max_guilds', '3',
   '동맹 한 개에 들어갈 수 있는 최대 길드 수 (3길드 룰)'),
  ('alliance', 'alliance_min_guilds', '2',
   '동맹 결성 최소 길드 수'),
  ('alliance', 'alliance_betrayal_cooldown_hours', '168',
   '동맹 탈퇴 후 다른 동맹 가입 쿨다운 (h)'),
  ('alliance', 'alliance_chronicle_betrayal_enabled', 'true',
   '동맹 배신 시 Chronicle 자동 기록 활성화')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS gp_duels;
--   DROP TABLE IF EXISTS alliance_guilds;
--   ALTER TABLE guild_wars
--     DROP COLUMN IF EXISTS ruleset_version,
--     DROP COLUMN IF EXISTS pot_attacker_gp,
--     DROP COLUMN IF EXISTS pot_defender_gp,
--     DROP COLUMN IF EXISTS truce_until,
--     DROP COLUMN IF EXISTS sector_id;
--   DELETE FROM settings WHERE key IN (
--     'guild_war_duration_hours_default','guild_war_min_stake_gp',
--     'guild_war_max_stake_gp','guild_war_truce_min_hours',
--     'guild_war_winner_pot_pct','duel_default_expiry_hours',
--     'duel_min_stake_gp','duel_max_stake_gp','duel_max_pending_per_pair',
--     'duel_max_active_per_user','alliance_max_guilds','alliance_min_guilds',
--     'alliance_betrayal_cooldown_hours','alliance_chronicle_betrayal_enabled');
-- ════════════════════════════════════════════════════════════════════
