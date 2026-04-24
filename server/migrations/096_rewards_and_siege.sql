-- ═══════════════════════════════════════════════════════════════
-- Migration 096: Phase B - Rewards & Siege Integration
-- ═══════════════════════════════════════════════════════════════
-- Phase B 추가 기능을 위한 DB 확장:
--   - 전투 보상 설정
--   - Siege → fleet_battle 연동 트리거 지원
--   - 함대 검색 인덱스
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. 전투 보상 설정 ──────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'reward_base_gp_pvp',       '100',  '기본 PvP 승리 보상 GP'),
  ('fleet', 'reward_base_gp_siege',     '500',  'Siege 승리 보상 GP'),
  ('fleet', 'reward_per_ship_destroyed','10',   '격침한 함선당 GP'),
  ('fleet', 'reward_loser_consolation','20',   '패자 위로 GP (완전 패배 아닐 시)'),
  ('fleet', 'reward_mineral_drop_chance','40',  '광물 드랍 확률 %')
ON CONFLICT (key) DO NOTHING;


-- ── 2. 전투 보상 로그 테이블 ───────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_battle_rewards (
  id                BIGSERIAL PRIMARY KEY,
  battle_id         BIGINT NOT NULL REFERENCES fleet_battles(id) ON DELETE CASCADE,
  wallet_address    VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  side              VARCHAR(8) NOT NULL,
  is_winner         BOOLEAN NOT NULL,
  gp_awarded        INTEGER DEFAULT 0,
  minerals_awarded  JSONB DEFAULT '{}',
  breakdown         JSONB DEFAULT '{}',  -- {base: 100, per_kill: 50, damage_share: 20}
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_rewards_wallet 
  ON fleet_battle_rewards(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battle_rewards_battle 
  ON fleet_battle_rewards(battle_id);


-- ── 3. Siege → fleet_battle 연동 함수 ─────────────────────────

/**
 * governor_sieges 에서 siege 시작 시 fleet_battle을 생성하는 헬퍼
 * 서비스 코드에서 호출
 */
CREATE OR REPLACE FUNCTION create_siege_battle(
  p_governor_siege_id INTEGER,
  p_atk_wallet  VARCHAR(42),
  p_def_wallet  VARCHAR(42),
  p_atk_fleet_id BIGINT,
  p_def_fleet_id BIGINT,
  p_sector_id   INTEGER DEFAULT NULL,
  p_claim_id    INTEGER DEFAULT NULL,
  p_delay_hours INTEGER DEFAULT 24
) RETURNS BIGINT AS $$
DECLARE
  v_battle_id BIGINT;
BEGIN
  -- fleet_battle 생성
  INSERT INTO fleet_battles (
    battle_type, status, phase,
    sector_id, claim_id, governor_siege_id,
    prepare_started_at, scheduled_start_at
  ) VALUES (
    'siege', 'preparing', 'main',
    p_sector_id, p_claim_id, p_governor_siege_id,
    NOW(), NOW() + (p_delay_hours || ' hours')::INTERVAL
  ) RETURNING id INTO v_battle_id;
  
  -- 참가자 등록
  INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side) VALUES
    (v_battle_id, p_atk_fleet_id, p_atk_wallet, 'atk'),
    (v_battle_id, p_def_fleet_id, p_def_wallet, 'def');
  
  -- governor_sieges에 역참조
  UPDATE governor_sieges 
  SET fleet_battle_id = v_battle_id, uses_fleet_combat = true
  WHERE id = p_governor_siege_id;
  
  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql;


-- ── 4. 함대 검색용 인덱스 ──────────────────────────────────────

-- 닉네임 기반 검색 지원
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower 
  ON users (LOWER(nickname)) WHERE nickname IS NOT NULL;

-- 함대 이름 기반 검색
CREATE INDEX IF NOT EXISTS idx_fleets_name_lower
  ON fleets (LOWER(name)) WHERE name IS NOT NULL;


-- ── 5. 보상 분배용 뷰 ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_battle_participant_damage_share AS
SELECT 
  p.battle_id,
  p.wallet_address,
  p.side,
  p.damage_dealt,
  p.ships_lost,
  SUM(p.damage_dealt) OVER (PARTITION BY p.battle_id, p.side) AS side_total_damage,
  CASE 
    WHEN SUM(p.damage_dealt) OVER (PARTITION BY p.battle_id, p.side) > 0 
    THEN p.damage_dealt::NUMERIC / SUM(p.damage_dealt) OVER (PARTITION BY p.battle_id, p.side)
    ELSE 0 
  END AS damage_share_pct
FROM fleet_battle_participants p;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증
-- ═══════════════════════════════════════════════════════════════
-- \d fleet_battle_rewards
-- SELECT proname FROM pg_proc WHERE proname='create_siege_battle';
-- SELECT * FROM v_battle_participant_damage_share LIMIT 3;
