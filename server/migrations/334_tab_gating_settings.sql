-- 334_tab_gating_settings.sql
-- BASE 고급 탭 레벨 게이팅(스코프 축소 — 신규 퍼널 집중)을 admin 에서 튜닝 가능하게 서버 설정화.
--   기존엔 base-navigation.js 에 BASE_TAB_MIN_LEVEL 가 하드코딩되어 오너가 못 바꿨다.
--   이제 /api/config 가 이 값을 내려주고, 클라가 하드코딩 기본값을 덮어쓴다(값 부재 시 기본값 유지 = 되돌림 안전).
--
--   level_gating_enabled = false 로 두면 게이팅 전체 OFF(모든 탭 즉시 개방).
--   base_tab_min_levels 는 {탭키: 최소레벨} 맵. 키를 추가/삭제해 신규에게 노출할 탭을 직접 통제.
--   기본값은 현행 하드코딩과 동일(fleet3/transport4/pvp6/guild8/govern10) — 이 마이그레이션만으로는 동작 불변.

INSERT INTO settings (category, key, value, description) VALUES
  ('ui', 'level_gating_enabled', 'true',
     'BASE 고급 탭 레벨 게이팅 ON/OFF (false=전 탭 즉시 개방)'),
  ('ui', 'base_tab_min_levels', '{"fleet":3,"transport":4,"pvp":6,"guild":8,"govern":10}',
     'BASE 탭별 최소 해금 레벨 맵. 키 추가/삭제로 신규 노출 범위 통제(스코프 축소)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key IN ('level_gating_enabled','base_tab_min_levels');
-- ============================================================

INSERT INTO schema_migrations (filename) VALUES ('334_tab_gating_settings.sql') ON CONFLICT DO NOTHING;
