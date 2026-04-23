-- ═══════════════════════════════════════════════════════════════
-- Migration 092: Fleet Combat - Fleet & Ship Instances
-- ═══════════════════════════════════════════════════════════════
-- 유저가 실제로 소유하는 함대와 함선을 저장
--   - fleets: 함대 덩어리 (1 유저 = N개 가능)
--   - ships: 개별 함선 인스턴스 (1 함대 = N개)
--   - ship_build_jobs: 함선 건조 큐
--
-- 제약:
--   - 유저당 최대 200척 (settings로 조절)
--   - 함대당 최대 1000척 (길드 연합 대비)
--   - Titan은 서버당 3척 (트리거로 보호)
--   - 기함(flagship) 1함대 = 1척
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. fleets 테이블 ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleets (
  id                BIGSERIAL PRIMARY KEY,
  owner_wallet      VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  guild_id          BIGINT REFERENCES guilds(id) ON DELETE SET NULL,
  
  name              VARCHAR(64),             -- "KimWarrior의 제1함대"
  sector_id         INTEGER REFERENCES sectors(id),
  
  -- 섹터 내 위치 (지도상 좌표)
  pos_x             NUMERIC(10,2),
  pos_y             NUMERIC(10,2),
  
  -- 상태
  is_in_battle      BOOLEAN DEFAULT false,
  current_battle_id BIGINT,                  -- (나중에 fleet_battles 연결)
  
  -- 전술 (v11 프로토타입 기반)
  formation         VARCHAR(16) DEFAULT 'sphere',  -- sphere|wedge|screen|pincer
  movement          VARCHAR(16) DEFAULT 'advance', -- advance|retreat|flank|scatter|rally
  
  -- 통계
  total_kills       INTEGER DEFAULT 0,
  battles_won       INTEGER DEFAULT 0,
  battles_lost      INTEGER DEFAULT 0,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (formation IN ('sphere','wedge','screen','pincer')),
  CHECK (movement  IN ('advance','retreat','flank','scatter','rally'))
);

CREATE INDEX IF NOT EXISTS idx_fleets_owner  ON fleets(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_fleets_guild  ON fleets(guild_id) WHERE guild_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fleets_sector ON fleets(sector_id);
CREATE INDEX IF NOT EXISTS idx_fleets_battle ON fleets(current_battle_id) WHERE is_in_battle;


-- ── 2. ships 테이블 (개별 함선 인스턴스) ──────────────────────

CREATE TABLE IF NOT EXISTS ships (
  id                BIGSERIAL PRIMARY KEY,
  fleet_id          BIGINT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  ship_type_code    VARCHAR(24) NOT NULL REFERENCES ship_types(code),
  owner_wallet      VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  
  -- 현재 상태
  current_hp        INTEGER NOT NULL,
  max_hp            INTEGER NOT NULL,
  is_flagship       BOOLEAN DEFAULT false,
  is_alive          BOOLEAN DEFAULT true,
  
  -- 전투 중 좌표 (기함 기준 상대좌표 · 진형 슬롯)
  slot_x            NUMERIC(6,2) DEFAULT 0,
  slot_y            NUMERIC(6,2) DEFAULT 0,
  
  -- 업그레이드 (나중에 Phase 4에서 활용)
  upgrade_level     SMALLINT DEFAULT 0,
  bonus_atk         INTEGER DEFAULT 0,
  bonus_def         INTEGER DEFAULT 0,
  bonus_hp          INTEGER DEFAULT 0,
  
  -- 통계
  kills_dealt       INTEGER DEFAULT 0,
  damage_dealt      BIGINT DEFAULT 0,
  
  -- 이력
  built_at          TIMESTAMPTZ DEFAULT NOW(),
  built_by_wallet   VARCHAR(42) REFERENCES users(wallet_address),   -- 거래로 소유권 이전 추적
  destroyed_at      TIMESTAMPTZ,
  
  CHECK (current_hp >= 0),
  CHECK (current_hp <= max_hp + bonus_hp)
);

CREATE INDEX IF NOT EXISTS idx_ships_fleet    ON ships(fleet_id);
CREATE INDEX IF NOT EXISTS idx_ships_owner    ON ships(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_ships_type     ON ships(ship_type_code);
CREATE INDEX IF NOT EXISTS idx_ships_alive    ON ships(fleet_id, is_alive) WHERE is_alive;
CREATE INDEX IF NOT EXISTS idx_ships_flagship ON ships(fleet_id) WHERE is_flagship AND is_alive;

-- 함대당 기함 1척 제약
CREATE UNIQUE INDEX IF NOT EXISTS uq_ships_one_flagship_per_fleet
  ON ships(fleet_id) 
  WHERE is_flagship = true AND is_alive = true;


-- ── 3. Titan 서버 한도 트리거 ──────────────────────────────────

CREATE OR REPLACE FUNCTION check_titan_server_limit() RETURNS TRIGGER AS $$
DECLARE
  v_max_per_server INTEGER;
  v_current_count  INTEGER;
BEGIN
  SELECT max_per_server INTO v_max_per_server 
  FROM ship_types WHERE code = NEW.ship_type_code;
  
  IF v_max_per_server IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM ships
    WHERE ship_type_code = NEW.ship_type_code AND is_alive = true;
    
    IF v_current_count >= v_max_per_server THEN
      RAISE EXCEPTION 'SHIP_SERVER_LIMIT_REACHED: % (max %)', 
        NEW.ship_type_code, v_max_per_server;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ships_server_limit ON ships;
CREATE TRIGGER trg_ships_server_limit 
  BEFORE INSERT ON ships
  FOR EACH ROW 
  EXECUTE FUNCTION check_titan_server_limit();


-- ── 4. 유저 함선 수 체크 트리거 ────────────────────────────────

CREATE OR REPLACE FUNCTION check_player_ship_limit() RETURNS TRIGGER AS $$
DECLARE
  v_max_per_player INTEGER;
  v_current_count  INTEGER;
  v_total_count    INTEGER;
  v_global_max     INTEGER;
BEGIN
  -- 함선 타입별 유저 한도
  SELECT max_per_player INTO v_max_per_player
  FROM ship_types WHERE code = NEW.ship_type_code;
  
  IF v_max_per_player IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM ships
    WHERE owner_wallet = NEW.owner_wallet 
      AND ship_type_code = NEW.ship_type_code 
      AND is_alive = true;
    
    IF v_current_count >= v_max_per_player THEN
      RAISE EXCEPTION 'SHIP_PLAYER_TYPE_LIMIT: % (max % per player)', 
        NEW.ship_type_code, v_max_per_player;
    END IF;
  END IF;
  
  -- 유저 전체 함선 한도
  SELECT COALESCE(NULLIF(value,''),'200')::INTEGER INTO v_global_max
  FROM settings WHERE category='fleet' AND key='max_ships_per_player';
  
  IF v_global_max IS NULL THEN v_global_max := 200; END IF;
  
  SELECT COUNT(*) INTO v_total_count
  FROM ships WHERE owner_wallet = NEW.owner_wallet AND is_alive = true;
  
  IF v_total_count >= v_global_max THEN
    RAISE EXCEPTION 'SHIP_PLAYER_TOTAL_LIMIT: max % ships per player', v_global_max;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ships_player_limit ON ships;
CREATE TRIGGER trg_ships_player_limit
  BEFORE INSERT ON ships
  FOR EACH ROW
  EXECUTE FUNCTION check_player_ship_limit();


-- ── 5. 건조 작업 큐 ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ship_build_jobs (
  id                 BIGSERIAL PRIMARY KEY,
  wallet_address     VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  fleet_id           BIGINT REFERENCES fleets(id) ON DELETE SET NULL,  -- 완료 시 함선이 들어갈 함대
  ship_type_code     VARCHAR(24) NOT NULL REFERENCES ship_types(code),
  
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  completes_at       TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,
  
  status             VARCHAR(16) DEFAULT 'building',  -- building|completed|cancelled
  
  -- 비용 기록 (로그용 + 취소 시 환불)
  gp_cost            INTEGER NOT NULL DEFAULT 0,
  minerals_used      JSONB NOT NULL DEFAULT '{}',
  
  -- 결과
  result_ship_id     BIGINT REFERENCES ships(id),
  
  CHECK (status IN ('building','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_ship_build_wallet ON ship_build_jobs(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_ship_build_status ON ship_build_jobs(status, completes_at) WHERE status = 'building';


-- ── 6. 함선 건조 로그 (히스토리) ──────────────────────────────

CREATE TABLE IF NOT EXISTS ship_build_log (
  id                 BIGSERIAL PRIMARY KEY,
  wallet_address     VARCHAR(42) NOT NULL,
  ship_type_code     VARCHAR(24) NOT NULL,
  gp_cost            INTEGER NOT NULL DEFAULT 0,
  minerals_used      JSONB NOT NULL DEFAULT '{}',
  result             VARCHAR(16) NOT NULL,  -- success|cancelled|failed
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_build_log_wallet ON ship_build_log(wallet_address, created_at DESC);


-- ── 7. Settings ──────────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'max_ships_per_player',       '200',  'Maximum ships a single player can own (alive)'),
  ('fleet', 'max_ships_per_fleet',        '1000', 'Maximum ships in a single fleet (coalition cap)'),
  ('fleet', 'max_fleets_per_player',      '5',    'Maximum fleet groups per player'),
  ('fleet', 'ship_build_cancel_refund_pct','50',  'Refund % when cancelling a build job in progress'),
  ('fleet', 'flagship_required',          'true', 'Every fleet must have exactly one flagship')
ON CONFLICT (key) DO NOTHING;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- \d fleets
-- \d ships
-- \d ship_build_jobs
-- 
-- -- Trigger 존재 확인
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'ships';
-- 기대: trg_ships_server_limit, trg_ships_player_limit 2개
