-- Migration 189: commander_actions 에 formation_change / maneuver_change action_type 추가
-- v4.6 — Phase 3-B: tactical-lab 의 진형/기동 컨트롤이 실제 commanderActions API 로 갈 때 CHECK 통과 가능하게.

ALTER TABLE commander_actions DROP CONSTRAINT IF EXISTS commander_actions_action_type_check;
ALTER TABLE commander_actions ADD CONSTRAINT commander_actions_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'focus_fire', 'emp', 'wedge', 'reinforce', 'formation_change', 'maneuver_change'
  ]::text[]));

-- formation/maneuver 액션은 GP 무료가 적합 (잦은 변경)
INSERT INTO settings (category, key, value, description) VALUES
  ('commander', 'commander_action_formation_gp_cost', '0',
     '진형 변경 GP 비용 (formation_change). 기본 0 — 잦은 컨트롤이라 무료'),
  ('commander', 'commander_action_maneuver_gp_cost',  '0',
     '기동 변경 GP 비용 (maneuver_change). 기본 0 — 잦은 컨트롤이라 무료')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('189_commander_actions_formation_maneuver.sql') ON CONFLICT DO NOTHING;
