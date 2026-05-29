-- 270_siege_qa_fixes.sql
-- ════════════════════════════════════════════════════════════════
-- 공성전 풀스택 QA 후속 — 라이브 전투 동시성 완화.
--   QA: 라이브 시즈가 전역 battle_max_concurrent(3) 슬롯을 wall-clock 동안 점유 → 타 전투 적체.
--   완화: 라이브 전투 wall-clock 한도를 10→6분으로 낮춰 최악 점유 시간 단축(정상 전투는 1~2분 종료).
--   근본책(라이브 전용 동시성 lane)은 별도 증분(AUDIT 후속).
-- ════════════════════════════════════════════════════════════════

UPDATE settings SET value = '6' WHERE key = 'siege_realtime_wallclock_min';
-- 키 부재 시 보강
INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_realtime_wallclock_min', '6', '라이브 전투 최대 진행 시간(분) — hang 방지 + 동시성 슬롯 점유 완화')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('270_siege_qa_fixes.sql')
ON CONFLICT DO NOTHING;
