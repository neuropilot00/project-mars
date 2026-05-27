-- 238_npc_arena_infighting.sql
-- ═══════════════════════════════════════════════════════════════
-- NPC Arena — NPC끼리 다투기(인파이팅) + 초반 밀도 설정
--
-- 실유저 유입 시 세계가 살아있어 보이게(유령도시 방지) NPC 함대가 주기적으로
-- 서로 함대전을 벌이고 라이브 피드에 노출된다.
-- NPC↔NPC 전투는 battle_summary.is_ai_battle=true 로 마킹돼 보상 mint 가 차단된다.
--
-- 기본 OFF 로 출시 — 운영자가 검증 후 npc_arena_enabled 를 켠다.
-- settings PK 는 key 단독. JSONB value: 불린 'true'/'false', 숫자 '42'.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('ai', 'npc_arena_enabled',        'false', 'NPC끼리 함대전(인파이팅) 스케줄러 활성화 (기본 OFF, 운영자가 켬)'),
  ('ai', 'npc_arena_interval_sec',   '120',   'NPC vs NPC 전투 생성 주기(초)'),
  ('ai', 'npc_arena_max_concurrent', '2',     '동시 진행 가능한 NPC vs NPC 전투 수 cap'),
  ('ai', 'npc_min_active_fleets',    '8',     '유지할 활성 NPC 함대 최소치 (미만이면 자동 보충)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('238_npc_arena_infighting.sql') ON CONFLICT DO NOTHING;
