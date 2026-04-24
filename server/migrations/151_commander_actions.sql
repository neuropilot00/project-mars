-- Migration 151: Commander Actions (Pre-battle strategy declarations)
-- ═══════════════════════════════════════════════════════════════════
-- 함대전 선언 → 승인 → 시뮬레이션 시작 사이 윈도우에 플레이어가
-- 전술 행동을 미리 선언. battleEngine 이 loadBattleData 시 함께 로드.
--
-- 지원 액션:
--   - focus_fire: 특정 적 함대에 집중 공격 (targetFleetId params)
--   - emp:        특정 tick 에 EMP 발동, 적 발사주기 N배로 느려짐
--   - wedge:      시작부터 atk 쪽 wedge 전술 강제 (speed/atk ↑, def ↓)
--   - reinforce:  시작부터 N척 추가 투입 (프로토타입 증원)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS commander_actions (
  id BIGSERIAL PRIMARY KEY,
  battle_id BIGINT NOT NULL REFERENCES fleet_battles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('atk','def')),
  action_type TEXT NOT NULL CHECK (action_type IN ('focus_fire','emp','wedge','reinforce')),
  params JSONB NOT NULL DEFAULT '{}',
  applied_at_tick INTEGER NOT NULL DEFAULT 0,
  gp_cost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmd_act_battle ON commander_actions(battle_id);
CREATE INDEX IF NOT EXISTS idx_cmd_act_wallet ON commander_actions(wallet_address);

-- wallet 당 battle 당 같은 action_type 중복 방지 (1인 1전투 1액션)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cmd_act_unique_per_wallet_battle_type
  ON commander_actions(battle_id, wallet_address, action_type);

-- 설정 값
INSERT INTO settings (category, key, value, description) VALUES
  ('battle', 'commander_actions_enabled', 'true', 'Enable commander actions in fleet battles'),
  ('battle', 'commander_action_max_per_player', '2', 'Max actions per player per battle'),
  ('battle', 'commander_action_gp_cost', '50', 'GP cost per commander action'),
  ('battle', 'emp_duration_ticks', '30', 'EMP effect duration in ticks (1 tick = 200ms)'),
  ('battle', 'emp_fire_interval_mult', '5.0', 'EMP multiplies enemy fireInterval (higher = slower)'),
  ('battle', 'emp_default_start_tick', '1200', 'Default EMP activation tick if not specified (~4 minutes in)'),
  ('battle', 'wedge_speed_mult', '1.25', 'Wedge tactic speed multiplier'),
  ('battle', 'wedge_atk_mult', '1.20', 'Wedge tactic attack multiplier'),
  ('battle', 'wedge_def_mult', '0.80', 'Wedge tactic defense multiplier'),
  ('battle', 'focus_fire_dmg_bonus_pct', '15', 'Extra damage when focus-firing a designated fleet (%)')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE commander_actions IS 'Pre-battle tactical directives (focus_fire, emp, wedge, reinforce)';
