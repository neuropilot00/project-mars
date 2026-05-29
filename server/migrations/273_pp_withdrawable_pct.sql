-- 273_pp_withdrawable_pct.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 (docs/ECONOMY_V2_SHIP_F2P_2026-05-29.md) P4 — PP→USDT 출금 한도 80%.
--   PP 는 입금 발행 전용(무료 faucet 없음, GP→PP 는 경매 P2P만) → PP 총량=입금량 고정 →
--   입금 origin PP 의 80%까지 USDT 출금 허용해도 담보 안전. 20%는 영구 게임 내 버퍼.
--   구현: 입금 시 redeemable_pp(환매 버킷)에 보너스의 withdrawablePct% 만 적립(chain.js).
--   swap 게이트는 기존 redeemable_pp 캡 유지(mig 271).
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'pp_withdrawable_pct', '80',
   '입금 origin PP 중 USDT 환매(출금) 가능 비율 %. 나머지는 영구 게임 내 버퍼. PP=입금전용이라 안전.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('273_pp_withdrawable_pct.sql')
ON CONFLICT DO NOTHING;
