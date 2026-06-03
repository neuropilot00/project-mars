-- ============================================================
-- Migration 306: staking 폐지 — 무담보 yield 발행 인플레 제거
--
-- 배경: GP staking은 stake 시 amount를 일시 lock할 뿐, withdraw 시 (원금 + yield)를
--   지급하는데 yield(15% APY + 최대 1.5배)가 어떤 pool/fee sink에서도 carve되지 않는
--   순발행이었다 → "모든 GP 이동은 carve(발행 0)" 경제 불변식 위반(인플레 누수).
--   사용자 결정에 따라 staking 기능을 비활성화한다.
--
-- 효과: createStake는 staking_enabled 게이트로 차단되고(services/staking.js#createStake),
--   withdrawStake는 게이트가 없어 기존 잠긴 stake의 원금/이미 약정된 yield는 계속 출금 가능
--   (잠긴 GP가 갇히지 않도록). 프론트는 /api/staking/info의 enabled=false면 섹션을 숨긴다.
-- ============================================================

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'staking_enabled', 'false', 'GP staking 활성화 — 무담보 yield 발행 인플레로 폐지(v7.371)')
ON CONFLICT (key) DO UPDATE SET value = 'false';

INSERT INTO schema_migrations (filename) VALUES ('306_disable_staking_inflation.sql') ON CONFLICT DO NOTHING;
