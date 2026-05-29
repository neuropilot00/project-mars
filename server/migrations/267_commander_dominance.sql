-- 267_commander_dominance.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 맹주(Commander) = sov 지배 1위 길드 (섹터 최다 지배).
--   getSovMap 이 leaderboard 1위를 commander 로 산정(최소 점유 + 단독 1위). 파생 메트릭(안전).
--   ※ 거버너들이 한 전장에서 싸우는 '커맨더 공성 전투'는 별도 큰 증분(후속).
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'commander_min_sectors', '3', '맹주(Commander) 인정 최소 지배 섹터 수')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('267_commander_dominance.sql')
ON CONFLICT DO NOTHING;
