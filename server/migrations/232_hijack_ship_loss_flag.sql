-- Migration 232: 하이젝 함선 영구파괴 토글 (EVE full-loss 수요엔진) — 기본 OFF
-- ───────────────────────────────────────────────────────────────────────────
-- EVE 경제의 핵심: 전투로 함선이 영구 파괴 → 재건조 수요 → 생산/시장 순환.
-- 현행은 하이젝 전투에서 함선 HP 만 깎고 보존(파괴 없음). 일반 전투(AI/토너먼트)는
-- 원래부터 영구파괴. 이 토글을 켜면 하이젝 격침 함선도 영구 파괴된다.
-- 기본 false: 현행 동작 유지. 운영자가 밸런스(수리/재건조 비용/보험) 정비 후 켜는 것을 권장.

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'hijack_ship_loss_enabled', 'false', '하이젝 전투에서 격침 함선 영구파괴(EVE full-loss). 기본 OFF(HP 보존)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('232_hijack_ship_loss_flag.sql') ON CONFLICT DO NOTHING;
