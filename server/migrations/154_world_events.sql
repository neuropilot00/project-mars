-- ════════════════════════════════════════════════════════════════════
-- Migration 154 — World Events (Void Raider 외계함선 NPC 이벤트)
--
-- 목적:
--   기존 함선 전투 엔진을 그대로 재사용해서 NPC 보스 이벤트를 만든다.
--   참여자가 데미지 비례로 보상을 받고, 격퇴 실패 시 섹터에 디버프.
--
-- 핵심 설계:
--   1) NPC 시드 유저 1명 추가 ('0xnpc...') — 모든 NPC fleet의 owner_wallet
--   2) fleets.is_npc 플래그 추가 (UI/통계 필터링용)
--   3) world_events 테이블 — 활성 이벤트 1건당 1행
--   4) world_event_participants — 데미지 누적
--   5) settings — 어드민이 모두 조정 가능
-- ════════════════════════════════════════════════════════════════════

-- ── 1) NPC 시스템 유저 ─────────────────────────────────────────────
INSERT INTO users (wallet_address, nickname, gp_balance, pp_balance, created_at)
VALUES ('0xnpc0000000000000000000000000000000000000', 'Void Raider', 0, 0, NOW())
ON CONFLICT (wallet_address) DO NOTHING;

-- ── 2) fleets.is_npc 플래그 ─────────────────────────────────────────
ALTER TABLE fleets
  ADD COLUMN IF NOT EXISTS is_npc BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fleets_npc ON fleets(is_npc) WHERE is_npc = true;

-- ── 3) world_events 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_events (
  id              BIGSERIAL PRIMARY KEY,
  event_type      VARCHAR(40) NOT NULL,        -- 'void_raider' | 'pirate_fleet' | 'meteor' (확장)
  event_code      VARCHAR(60) NOT NULL,        -- 'VR-2026-04-24-A' 등 외부 식별자
  sector_id       INT REFERENCES sectors(id) ON DELETE SET NULL,
  fleet_id        BIGINT REFERENCES fleets(id) ON DELETE SET NULL,
  hp_max          BIGINT NOT NULL DEFAULT 0,
  hp_current      BIGINT NOT NULL DEFAULT 0,
  spawned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  reward_pool     JSONB DEFAULT '{}'::jsonb,
  meta            JSONB DEFAULT '{}'::jsonb,    -- {ship_type_code, ship_count, ...}
  resolved_at     TIMESTAMPTZ,
  resolution      VARCHAR(20),                  -- 'defeated' | 'escaped' | 'expired'
  created_by      VARCHAR(42),                  -- 수동 스폰: 어드민 wallet, 자동: 'system'
  CHECK (status IN ('active','engaged','defeated','escaped','expired'))
);

CREATE INDEX IF NOT EXISTS idx_world_events_status ON world_events(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_world_events_sector ON world_events(sector_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_world_events_type   ON world_events(event_type, status);
CREATE INDEX IF NOT EXISTS idx_world_events_fleet  ON world_events(fleet_id) WHERE fleet_id IS NOT NULL;

-- ── 4) 참여자 누적 테이블 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_event_participants (
  event_id        BIGINT NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  wallet          VARCHAR(42) NOT NULL,
  damage_dealt    BIGINT NOT NULL DEFAULT 0,
  ships_lost      INT NOT NULL DEFAULT 0,
  battles_count   INT NOT NULL DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_battle_at  TIMESTAMPTZ,
  rewarded        BOOLEAN NOT NULL DEFAULT false,
  reward_meta     JSONB,
  PRIMARY KEY (event_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_wep_wallet ON world_event_participants(wallet);
CREATE INDEX IF NOT EXISTS idx_wep_damage ON world_event_participants(event_id, damage_dealt DESC);

-- ── 5) 섹터 디버프 (실패 시 mining 패널티) ──────────────────────────
CREATE TABLE IF NOT EXISTS sector_debuffs (
  id              BIGSERIAL PRIMARY KEY,
  sector_id       INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  debuff_type     VARCHAR(40) NOT NULL,         -- 'mining_penalty'
  magnitude_pct   NUMERIC(5,2) NOT NULL,        -- -30.00 (마이너스 = 패널티)
  source_event_id BIGINT REFERENCES world_events(id) ON DELETE SET NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_sector_debuffs_active ON sector_debuffs(sector_id, active, ends_at);

-- ── 6) 어드민 설정값 (모두 settings 테이블에 — 하드코딩 금지) ───────
INSERT INTO settings (category, key, value, description) VALUES
  ('world_events', 'void_raider_enabled',              'false', 'Void Raider 시스템 마스터 토글'),
  ('world_events', 'void_raider_auto_spawn',           'false', '자동 스폰 활성화 (false=어드민 수동만)'),
  ('world_events', 'void_raider_duration_hours',       '48',    '이벤트 지속 시간 (시간)'),
  ('world_events', 'void_raider_spawn_hour_utc',       '19',    '자동 스폰 시각 UTC (0-23)'),
  ('world_events', 'void_raider_spawn_interval_days',  '3',     '자동 스폰 주기 (일)'),
  ('world_events', 'void_raider_target_tier',          '"frontier"', '타겟 섹터 tier (frontier/mid/core)'),
  ('world_events', 'void_raider_ship_type',            '"cv_titan"', 'NPC 함선 타입 (ship_types.code)'),
  ('world_events', 'void_raider_ship_count',           '15',    'NPC 보유 함선 수'),
  ('world_events', 'void_raider_max_concurrent',       '1',     '동시 활성 가능 이벤트 수'),
  ('world_events', 'void_raider_engage_min_ships',     '5',     '교전 최소 함선 수 (참여자 함대)'),
  ('world_events', 'void_raider_engage_cooldown_min',  '30',    '교전 후 다음 교전까지 쿨다운(분)'),
  ('world_events', 'void_raider_reward_iron_dust',     '100',   '참여자 보상: iron_dust'),
  ('world_events', 'void_raider_reward_ice_crystal',   '10',    '참여자 보상: ice_crystal'),
  ('world_events', 'void_raider_reward_xp',            '500',   '참여자 보상: XP'),
  ('world_events', 'void_raider_reward_gp',            '200',   '참여자 보상: GP'),
  ('world_events', 'void_raider_reward_top_metal',     '5',     '최다 피해 1위 보상: ancient_metal'),
  ('world_events', 'void_raider_reward_top_title',     '"Void Hunter"', '최다 피해 1위 칭호'),
  ('world_events', 'void_raider_fail_mining_debuff_pct','30',   '실패 시 섹터 mining 디버프(%) — 마이너스로 적용'),
  ('world_events', 'void_raider_fail_debuff_days',     '3',     '디버프 지속 일수')
ON CONFLICT (key) DO NOTHING;

-- ── 7) 뷰 — 활성 이벤트 한눈에 보기 ────────────────────────────────
CREATE OR REPLACE VIEW v_active_world_events AS
SELECT
  we.id,
  we.event_type,
  we.event_code,
  we.status,
  we.hp_current,
  we.hp_max,
  ROUND((we.hp_current::numeric / NULLIF(we.hp_max, 0) * 100), 1) AS hp_pct,
  we.spawned_at,
  we.ends_at,
  EXTRACT(EPOCH FROM (we.ends_at - NOW()))::INT AS seconds_remaining,
  s.id   AS sector_id,
  s.name AS sector_name,
  s.tier AS sector_tier,
  we.fleet_id,
  (SELECT COUNT(*) FROM world_event_participants wep WHERE wep.event_id = we.id) AS participant_count,
  (SELECT COALESCE(SUM(damage_dealt), 0) FROM world_event_participants wep WHERE wep.event_id = we.id) AS total_damage,
  we.meta
FROM world_events we
LEFT JOIN sectors s ON s.id = we.sector_id
WHERE we.status IN ('active', 'engaged');

COMMENT ON TABLE world_events IS 'NPC 보스 이벤트 (Void Raider 등) — 한 행 = 1개 활성 이벤트';
COMMENT ON TABLE world_event_participants IS '이벤트별 참여자 누적 데미지 — 보상 분배 기준';
COMMENT ON TABLE sector_debuffs IS '이벤트 실패 등으로 섹터에 부여되는 일시적 디버프';
