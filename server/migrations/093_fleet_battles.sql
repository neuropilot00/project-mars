-- ═══════════════════════════════════════════════════════════════
-- Migration 093: Fleet Combat - Battle Sessions
-- ═══════════════════════════════════════════════════════════════
-- 함대전 세션 관리 (Siege, Hijack, 개인전 모두 포함)
-- 기존 `battles` (픽셀 전투)와 분리를 위해 `fleet_battles` 네이밍 사용
--
-- 테이블:
--   - fleet_battles: 전투 세션
--   - fleet_battle_participants: 참여 함대
--   - fleet_battle_events: 이벤트 로그 (Chronicle 연동)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. fleet_battles 테이블 ───────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_battles (
  id                  BIGSERIAL PRIMARY KEY,
  battle_type         VARCHAR(16) NOT NULL,  -- siege|hijack|pvp_duel|raid|event
  
  -- 컨텍스트
  sector_id           INTEGER REFERENCES sectors(id),
  claim_id            INTEGER REFERENCES claims(id),   -- siege/hijack 대상 영토
  governor_siege_id   INTEGER,                         -- siege일 때 governor_sieges.id
  
  -- 상태
  status              VARCHAR(16) DEFAULT 'preparing',  -- preparing|active|ended|cancelled
  winner_side         VARCHAR(8),                       -- atk|def|draw|null
  
  -- Hijack 2단계 전투 지원
  phase               VARCHAR(16) DEFAULT 'main',       -- main|hijack_phase1|hijack_phase2
  parent_battle_id    BIGINT REFERENCES fleet_battles(id),  -- phase2가 phase1을 참조
  
  -- 타이밍
  prepare_started_at  TIMESTAMPTZ DEFAULT NOW(),
  battle_started_at   TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  scheduled_start_at  TIMESTAMPTZ,                      -- Siege 예약 시작 시각
  
  -- 결과 요약
  atk_ships_total     INTEGER DEFAULT 0,
  def_ships_total     INTEGER DEFAULT 0,
  atk_ships_lost      INTEGER DEFAULT 0,
  def_ships_lost      INTEGER DEFAULT 0,
  duration_seconds    INTEGER,
  
  -- 전투 로그 (상세는 fleet_battle_events, 요약만 여기)
  battle_summary      JSONB DEFAULT '{}',
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (battle_type IN ('siege','hijack','pvp_duel','raid','event')),
  CHECK (status IN ('preparing','active','ended','cancelled')),
  CHECK (winner_side IS NULL OR winner_side IN ('atk','def','draw')),
  CHECK (phase IN ('main','hijack_phase1','hijack_phase2'))
);

CREATE INDEX IF NOT EXISTS idx_fleet_battles_status  ON fleet_battles(status) WHERE status IN ('preparing','active');
CREATE INDEX IF NOT EXISTS idx_fleet_battles_sector  ON fleet_battles(sector_id);
CREATE INDEX IF NOT EXISTS idx_fleet_battles_claim   ON fleet_battles(claim_id);
CREATE INDEX IF NOT EXISTS idx_fleet_battles_type    ON fleet_battles(battle_type);
CREATE INDEX IF NOT EXISTS idx_fleet_battles_siege   ON fleet_battles(governor_siege_id) WHERE governor_siege_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_battles_parent  ON fleet_battles(parent_battle_id) WHERE parent_battle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_battles_scheduled ON fleet_battles(scheduled_start_at) WHERE status = 'preparing';


-- ── 2. 참여 함대 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_battle_participants (
  battle_id         BIGINT NOT NULL REFERENCES fleet_battles(id) ON DELETE CASCADE,
  fleet_id          BIGINT NOT NULL REFERENCES fleets(id),
  wallet_address    VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  
  side              VARCHAR(8) NOT NULL,  -- atk|def
  spawn_x           NUMERIC(10,2),
  spawn_y           NUMERIC(10,2),
  
  -- 전투 시작 시점 스냅샷
  ships_at_start    INTEGER DEFAULT 0,
  hp_at_start       BIGINT DEFAULT 0,
  
  -- 종료 시점
  ships_alive       INTEGER DEFAULT 0,
  ships_lost        INTEGER DEFAULT 0,
  damage_dealt      BIGINT  DEFAULT 0,
  
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  left_at           TIMESTAMPTZ,  -- 전투 도중 이탈 시
  
  PRIMARY KEY (battle_id, fleet_id),
  CHECK (side IN ('atk','def'))
);

CREATE INDEX IF NOT EXISTS idx_battle_participants_wallet ON fleet_battle_participants(wallet_address);
CREATE INDEX IF NOT EXISTS idx_battle_participants_side   ON fleet_battle_participants(battle_id, side);


-- ── 3. 이벤트 로그 (Chronicle Engine 연동) ────────────────────

CREATE TABLE IF NOT EXISTS fleet_battle_events (
  id              BIGSERIAL PRIMARY KEY,
  battle_id       BIGINT NOT NULL REFERENCES fleet_battles(id) ON DELETE CASCADE,
  
  event_type      VARCHAR(32) NOT NULL,
  -- 가능한 타입:
  --   ship_destroyed, flagship_destroyed
  --   formation_changed, movement_changed
  --   fleet_retreated, fleet_scattered, fleet_rallied
  --   reinforcement_arrived, laser_focus_detected
  --   hijack_phase1_success, hijack_phase2_start
  --   battle_started, battle_ended
  
  fleet_id        BIGINT REFERENCES fleets(id),
  ship_id         BIGINT REFERENCES ships(id),
  actor_wallet    VARCHAR(42),
  target_wallet   VARCHAR(42),
  
  payload         JSONB DEFAULT '{}',  -- {from:'advance', to:'retreat', hp_ratio:0.38}
  tick            INTEGER,              -- 전투 tick 번호
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_events_battle ON fleet_battle_events(battle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_battle_events_type   ON fleet_battle_events(battle_id, event_type);


-- ── 4. fleets.current_battle_id FK 연결 ───────────────────────

ALTER TABLE fleets 
  ADD CONSTRAINT fk_fleets_current_battle
  FOREIGN KEY (current_battle_id) REFERENCES fleet_battles(id) 
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;


-- ── 5. Hijack 2단계 전투용 설정 추가 ──────────────────────────

CREATE TABLE IF NOT EXISTS hijack_battles (
  id                    BIGSERIAL PRIMARY KEY,
  attacker_wallet       VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  target_claim_id       INTEGER NOT NULL REFERENCES claims(id),
  
  phase                 VARCHAR(16) DEFAULT 'phase1',  -- phase1|phase2|completed|failed
  phase1_battle_id      BIGINT REFERENCES fleet_battles(id),
  phase2_battle_id      BIGINT REFERENCES fleet_battles(id),
  
  -- 제약: Phase 1은 frigate/destroyer만
  allowed_size_classes_phase1 TEXT[] DEFAULT ARRAY['frigate','destroyer'],
  
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  final_result          VARCHAR(16),  -- attacker_won|defender_won|timeout
  
  CHECK (phase IN ('phase1','phase2','completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_hijack_battles_attacker ON hijack_battles(attacker_wallet);
CREATE INDEX IF NOT EXISTS idx_hijack_battles_target   ON hijack_battles(target_claim_id);
CREATE INDEX IF NOT EXISTS idx_hijack_battles_phase    ON hijack_battles(phase) WHERE phase IN ('phase1','phase2');


-- ── 6. Settings ──────────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'battle_tick_rate_ms',            '200',    'Server battle simulation tick rate (5 tick/sec)'),
  ('fleet', 'battle_max_duration_seconds',    '1800',   'Maximum battle duration (30 min)'),
  ('fleet', 'battle_prepare_seconds',         '60',     'Preparation phase before battle starts'),
  ('fleet', 'battle_max_concurrent',          '3',      'Max concurrent battles per server (Railway CPU limit)'),
  ('fleet', 'hijack_phase1_duration_seconds', '300',    'Hijack phase 1 (infiltration) max duration'),
  ('fleet', 'hijack_phase1_ships_max',        '20',     'Max ships per side in hijack phase 1'),
  ('fleet', 'siege_prepare_hours',            '24',     'Hours between siege declaration and battle start'),
  ('fleet', 'reward_damage_share_pct',        '60',     '% of rewards distributed by damage dealt'),
  ('fleet', 'reward_kill_share_pct',          '40',     '% of rewards distributed by ship kills')
ON CONFLICT (key) DO NOTHING;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- \d fleet_battles
-- \d fleet_battle_participants
-- \d fleet_battle_events
-- \d hijack_battles
-- 
-- SELECT category, key, value FROM settings WHERE category='fleet' ORDER BY key;
