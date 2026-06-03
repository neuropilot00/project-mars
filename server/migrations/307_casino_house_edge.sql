-- ============================================================
-- Migration 307: 카지노 하우스 엣지 통일 설정 (기본 15%)
--
-- 배경: 카지노(coinflip/dice/hilo/mines/crash)의 하우스 엣지가 게임별로 하드코딩(2~4%)되어
--   "하우스가 쉽게 이긴다"는 운영 의도에 못 미쳤다. 단일 설정 casino_house_edge_pct로 통일해
--   어드민이 조절 가능하게 하고, 기본값을 15%(강한 하우스 우위)로 둔다.
--   각 게임 코드는 이 설정을 읽어 배수/instant-crash 빈도에 반영한다(routes/arena.js).
-- ============================================================

INSERT INTO settings (category, key, value, description) VALUES
  ('cantina', 'casino_house_edge_pct', '15', '카지노 공통 하우스 엣지(%) — 클수록 하우스가 유리(coinflip/dice/hilo/mines/crash 일괄)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('307_casino_house_edge.sql') ON CONFLICT DO NOTHING;
