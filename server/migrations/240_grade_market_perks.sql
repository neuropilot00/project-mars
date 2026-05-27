-- Migration 240: 영토 등급 → 마켓 효용 (수수료 할인) + 드롭 확률 보너스 설정
-- ───────────────────────────────────────────────────────────────────────────
-- 자산관리 루프(영토 등급)를 마켓/드롭에 건전하게 확장:
--   - 마켓 가격은 플레이어 자유시장이라 시스템이 가격을 강제하지 않음(왜곡 방지).
--   - 대신 등급에 (1) 마켓 수수료 할인, (2) rare/special 재료 드롭 "확률" 보너스(코드: rareMultiplier 재사용)를 부여.
-- market_fee_grade_discount: 판매자 최고 등급 → feePct 배수(낮을수록 할인). S 50%, A 30%, B 15% 할인.

INSERT INTO settings (category, key, value, description) VALUES
  ('market', 'market_fee_grade_discount', '{"S":0.5,"A":0.7,"B":0.85,"C":1.0,"D":1.0,"F":1.0}', '판매자 최고 등급 영토 → 마켓 수수료 배수(낮을수록 할인)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('240_grade_market_perks.sql') ON CONFLICT DO NOTHING;
