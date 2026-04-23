-- ═══════════════════════════════════════════════════════════════
-- Migration 094: Fleet Combat - Integration with Siege & Hijack
-- ═══════════════════════════════════════════════════════════════
-- 기존 시스템과 함대전 연결
--   - governor_sieges (Migration 085): 공성전 → 함대전 트리거
--   - users.hijack_count: Hijack 통계 업데이트
--   - Chronicle 이벤트 타입 확장
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. governor_sieges에 fleet_battle 연결 ────────────────────

-- governor_sieges 테이블은 이미 Migration 085에 존재
-- 함대전이 발동되면 fleet_battle_id로 연결

ALTER TABLE governor_sieges 
  ADD COLUMN IF NOT EXISTS fleet_battle_id BIGINT REFERENCES fleet_battles(id),
  ADD COLUMN IF NOT EXISTS uses_fleet_combat BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_governor_sieges_fleet_battle 
  ON governor_sieges(fleet_battle_id) WHERE fleet_battle_id IS NOT NULL;


-- ── 2. hijack 통계 보강 ───────────────────────────────────────

-- users.hijack_count는 이미 있음 (기본 통계)
-- 추가로 세부 통계 테이블

CREATE TABLE IF NOT EXISTS hijack_stats (
  wallet_address        VARCHAR(42) PRIMARY KEY REFERENCES users(wallet_address) ON DELETE CASCADE,
  
  -- 공격 측 통계
  hijacks_attempted     INTEGER DEFAULT 0,
  hijacks_succeeded     INTEGER DEFAULT 0,
  hijacks_failed        INTEGER DEFAULT 0,
  
  -- 수비 측 통계
  hijacks_defended      INTEGER DEFAULT 0,
  hijacks_lost          INTEGER DEFAULT 0,
  
  -- Phase별 통계
  phase1_wins           INTEGER DEFAULT 0,
  phase2_wins           INTEGER DEFAULT 0,
  
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ── 3. Chronicle 이벤트 확장 ──────────────────────────────────

-- Chronicle Engine (Migration 086)에 함대전 이벤트 타입 추가
-- server_chronicles 테이블의 event_type에 새 값 사용 (enum 아니면 그냥 INSERT 가능)

-- Chronicle 발행 헬퍼 함수 (함대전 종료 시 호출)
CREATE OR REPLACE FUNCTION publish_fleet_battle_chronicle(
  p_battle_id BIGINT,
  p_event_subtype VARCHAR
) RETURNS VOID AS $$
DECLARE
  v_battle RECORD;
  v_atk_count INTEGER;
  v_def_count INTEGER;
BEGIN
  SELECT * INTO v_battle FROM fleet_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  SELECT COUNT(*) INTO v_atk_count 
  FROM fleet_battle_participants WHERE battle_id = p_battle_id AND side='atk';
  SELECT COUNT(*) INTO v_def_count 
  FROM fleet_battle_participants WHERE battle_id = p_battle_id AND side='def';
  
  INSERT INTO server_chronicles (
    event_type, 
    payload, 
    significance,
    created_at
  ) VALUES (
    'fleet_battle_' || p_event_subtype,
    jsonb_build_object(
      'battle_id',       p_battle_id,
      'battle_type',     v_battle.battle_type,
      'winner_side',     v_battle.winner_side,
      'sector_id',       v_battle.sector_id,
      'atk_fleets',      v_atk_count,
      'def_fleets',      v_def_count,
      'atk_ships_lost',  v_battle.atk_ships_lost,
      'def_ships_lost',  v_battle.def_ships_lost,
      'duration_seconds',v_battle.duration_seconds
    ),
    -- 중요도: 총 함선 수 기반
    CASE 
      WHEN (v_battle.atk_ships_total + v_battle.def_ships_total) >= 500 THEN 'legendary'
      WHEN (v_battle.atk_ships_total + v_battle.def_ships_total) >= 100 THEN 'epic'
      WHEN (v_battle.atk_ships_total + v_battle.def_ships_total) >= 20  THEN 'rare'
      ELSE 'common'
    END,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;


-- ── 4. 시즌 통계 컬럼 (season_scores 확장) ────────────────────

-- 기존 season_scores 테이블이 있는지 확인하고 확장
-- Migration 047 (season_system) 또는 별도 위치에 있음

-- 안전하게: 컬럼 존재 여부 체크 후 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='season_scores') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='season_scores' AND column_name='fleet_battles_won') THEN
      ALTER TABLE season_scores ADD COLUMN fleet_battles_won INTEGER DEFAULT 0;
      ALTER TABLE season_scores ADD COLUMN fleet_ships_destroyed INTEGER DEFAULT 0;
      ALTER TABLE season_scores ADD COLUMN fleet_damage_dealt BIGINT DEFAULT 0;
      ALTER TABLE season_scores ADD COLUMN ships_built INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;


-- ── 5. GP 활동 로그 확장 (함대전 용) ──────────────────────────

-- 기존 gp_activity_log가 있는지 확인 (Migration 097, 092-106 미적용이면 없음)
-- 없으면 간단한 버전 생성

CREATE TABLE IF NOT EXISTS fleet_gp_activity (
  id                BIGSERIAL PRIMARY KEY,
  wallet_address    VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  activity_type     VARCHAR(32) NOT NULL,  
  -- ship_build_gp_spent, ship_build_refund, battle_reward, faction_change_fee
  gp_delta          INTEGER NOT NULL,  -- 음수면 소모, 양수면 획득
  related_ship_id   BIGINT REFERENCES ships(id) ON DELETE SET NULL,
  related_battle_id BIGINT REFERENCES fleet_battles(id) ON DELETE SET NULL,
  meta              JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_gp_activity_wallet ON fleet_gp_activity(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_gp_activity_type   ON fleet_gp_activity(activity_type);


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- \d governor_sieges
-- \d hijack_stats
-- \d fleet_gp_activity
-- 
-- -- publish_fleet_battle_chronicle 함수 존재 확인
-- SELECT proname FROM pg_proc WHERE proname = 'publish_fleet_battle_chronicle';
