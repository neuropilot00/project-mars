-- Migration 231: treasury collateral 초기식 보정 (Codex 독립검토 반영)
-- ───────────────────────────────────────────────────────────────────────────
-- 230 의 초기식은 출금을 type='withdraw' 만 차감했으나, /withdraw-all 은
-- type='withdraw_all' 로 기록되고 실제 빠져나간 금액 = usdt_amount + pp_amount - fee
-- (= totalOut) 이다. 또한 운영자 담보 적립(treasury_topup)도 반영해야 한다.
-- 진짜 담보 = 순 실USDT = 입금 − 출금(withdraw + withdraw_all) + 운영자적립.
-- (PP→USDT swap 은 on-chain 이동이 아니므로 collateral 변화 없음 → 식에 없음이 정상.)
-- 현재 프로덕션은 USDT=0(실입금 전)이라 결과는 0 이지만, 실입금 개시 전 식을 바로잡는다.

UPDATE treasury_ledger SET collateral_usdt = GREATEST(0,
    COALESCE((SELECT SUM(amount) FROM deposits), 0)
  - COALESCE((SELECT SUM(usdt_amount) FROM transactions WHERE type = 'withdraw'), 0)
  - COALESCE((SELECT SUM(COALESCE(usdt_amount,0) + COALESCE(pp_amount,0) - COALESCE(fee,0))
               FROM transactions WHERE type = 'withdraw_all'), 0)
  + COALESCE((SELECT SUM(usdt_amount) FROM transactions WHERE type = 'treasury_topup'), 0)
), updated_at = NOW() WHERE id = 1;

INSERT INTO schema_migrations (filename) VALUES ('231_treasury_collateral_recompute.sql') ON CONFLICT DO NOTHING;
