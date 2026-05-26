-- Migration 225: Backfill operator-safe referral keys on older DBs
-- 목적:
-- 1) 구형 DB에 없는 referral_enhance_pct / referral_auction_buy_pct 키를 안전 기본값 0으로 백필
-- 2) 222/verify 기대값과 실제 settings 상태를 일치시킨다

INSERT INTO settings (key, value, description, category)
VALUES
  ('referral_enhance_pct', '0', 'Enhancement GP spend → upline % (0=off, disabled by default for operator EV safety)', 'referral'),
  ('referral_auction_buy_pct', '0', 'Auction buy GP spend → upline % (0=off, disabled by default for operator EV safety)', 'referral')
ON CONFLICT (key) DO NOTHING;
