-- Migration 230: Treasury 담보(collateral) 원장 + 솔벤시 가드 (뱅크런 구조적 차단)
-- ───────────────────────────────────────────────────────────────────────────
-- 문제: PP 는 채굴/가입/추천/데일리 등으로 무제한에 가깝게 mint 되는데,
--   (a) /swap   PP→USDT 1:1 (수수료만 차감) 으로 usdt_balance 발행,
--   (b) /withdraw-all 은 보유 PP 전체를 on-chain USDT 출금액에 그대로 합산.
--   → 담보(실입금 USDT) 없이 USDT 부채가 발행됨. 먼저 출금한 PP 파머가 트레저리를
--     말리고, 실입금 예치자가 출금 불가(409)가 되는 전형적 뱅크런이 가능.
--
-- 불변식(solvency invariant): SUM(users.usdt_balance) ≤ collateral_usdt
--   - deposit      : collateral += amount,  usdt_balance += amount  (room 불변)
--   - withdraw     : collateral -= amount,  usdt_balance -= amount  (room 불변)
--   - withdraw-all : collateral -= totalOut, usdt_balance -= usdtBal (room -= ppRedeemed)
--   - swap(PP→USDT): collateral 불변,        usdt_balance += received (room -= received)
--   - operator topup: collateral += Y                                  (room += Y)
--   room = collateral_usdt - SUM(usdt_balance). swap/withdraw-all 의 PP유래 발행은 room 이내만 허용.
--
-- 효과: 운영자가 명시적으로 redemption pool(담보)을 적립한 만큼만 PP→USDT 환금 가능.
--   USDT=0 인 현재는 room=0 → PP→USDT 환금 OFF(안전). 운영자가 광고/판매수익으로
--   담보를 적립하면 그만큼 환금 허용. EVE 처럼 "현금화는 실수익 백킹 내에서만".

CREATE TABLE IF NOT EXISTS treasury_ledger (
  id              INT PRIMARY KEY DEFAULT 1,
  collateral_usdt NUMERIC(20,6) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treasury_ledger_singleton CHECK (id = 1)
);

INSERT INTO treasury_ledger (id, collateral_usdt) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- 초기 담보 = 순 실입금(누적 deposits − 누적 withdraw). 현재 0.
UPDATE treasury_ledger SET collateral_usdt = GREATEST(0,
  COALESCE((SELECT SUM(amount)      FROM deposits), 0)
  - COALESCE((SELECT SUM(usdt_amount) FROM transactions WHERE type = 'withdraw'), 0)
), updated_at = NOW() WHERE id = 1;

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'swap_solvency_guard_enabled', 'true', 'PP→USDT 환금 시 담보 초과 발행 차단(뱅크런 방지). false=구버전(위험)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('230_treasury_solvency_guard.sql') ON CONFLICT DO NOTHING;
