-- Migration 239: 재료 수급 균형 보정 (신규 유저 진행 봉쇄 해소) — 경제 균형 감사 반영
-- ───────────────────────────────────────────────────────────────────────────
-- 감사 결과 진행을 막는 2대 봉쇄:
--   (1) frontier(신규 유저 주거점)에 tier-2 제작 재료(titanium_alloy/plasma_crystal/
--       nano_polymer)가 0개 → 신규 유저가 cruiser조차 제작 불가.
--   (2) exotic_alloy/dark_matter/quantum_core 가 SRR core 섹터에만 존재 →
--       BS/Titan 진입이 후반 core 섹터 독점 → 사실상 봉쇄.
-- 수정: faucet "추가"만 한다(소스 사이드). 레시피/요구량은 건드리지 않아 기존 빌드 밸런스 무영향.
--   - frontier 에 tier-2 소량(진입로만, mid 보다 낮게) → 신규 유저 cruiser 진입 가능.
--   - mid 에 core 전용 t3 소량 → BS/Titan 진입로 개방(core 는 여전히 주 공급원).

INSERT INTO sector_resource_rates (sector_type, resource_code, base_rate, miner_bonus, is_active) VALUES
  -- (1) 신규존 tier-2 진입로 (mid 0.20~0.25 대비 낮게)
  ('frontier','titanium_alloy', 0.0800, 0.0300, true),
  ('frontier','plasma_crystal', 0.0600, 0.0200, true),
  ('frontier','nano_polymer',   0.0600, 0.0200, true),
  -- (2) BS/Titan 진입로 (core base 0.10~0.15 대비 낮게)
  ('mid','exotic_alloy', 0.0300, 0.0100, true),
  ('mid','dark_matter',  0.0250, 0.0100, true),
  ('mid','quantum_core', 0.0200, 0.0100, true)
ON CONFLICT (sector_type, resource_code)
  DO UPDATE SET base_rate = EXCLUDED.base_rate, miner_bonus = EXCLUDED.miner_bonus, is_active = true;

-- 참고: xenomatter/hull_plate/meteorite_fragment 등 "고사 재료"(sink 없음)는 레시피 변경이
-- 필요해 기존 빌드 밸런스에 영향 → 별도 디자인 검토 후 적용(이 마이그레이션 범위 밖).

INSERT INTO schema_migrations (filename) VALUES ('239_material_supply_balance.sql') ON CONFLICT DO NOTHING;
