-- ============================================================
-- Migration 308: 함대 리버리(accent color) 코스메틱 — GP 싱크
--
-- 함대 단위 강조색. 진형 미리보기/전투에서 함선 글로우 색으로 표시되어 멀리서도 "한 세력"으로
-- 식별된다(함대 귀속이라 개별 함선 격침과 무관 = full-loss 모순 회피). 설정 비용만큼 GP를
-- carve 소각(반인플레 sink). 임의 hex 주입 방지를 위해 허용 팔레트를 설정으로 제한.
-- ============================================================

ALTER TABLE fleets ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7);

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'fleet_livery_cost_gp', '200', '함대 리버리(강조색) 변경 GP 비용 — 소각(sink)'),
  ('fleet', 'fleet_livery_palette',
    '["#4fc3f7","#ff7043","#7ee787","#ffd54f","#ba68c8","#f06292","#4dd0e1","#a1887f","#ff5252","#82b1ff"]',
    '함대 리버리 허용 색 팔레트(임의 hex 차단)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('308_fleet_livery_cosmetic.sql') ON CONFLICT DO NOTHING;
