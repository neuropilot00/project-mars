-- Migration 222: Operator-safe referral defaults for pre-open
-- 목적:
-- 1) gross spend 기반 referral(enhance/auction)을 기본 OFF
-- 2) hijack referral을 별도 설정키로 통제하고 기본 OFF
-- 3) hijack referral을 설정키 기반으로만 열 수 있게 통일

INSERT INTO settings (key, value, description, category)
VALUES
  ('referral_hijack_pct', '0', 'Hijack premium → upline % (0=off, disabled by default for operator EV safety)', 'referral')
ON CONFLICT (key) DO NOTHING;

UPDATE settings
SET value = '0',
    description = 'Enhancement GP spend → upline % (0=off, disabled by default for operator EV safety)',
    category = 'referral'
WHERE key = 'referral_enhance_pct';

UPDATE settings
SET value = '0',
    description = 'Auction buy GP spend → upline % (0=off, disabled by default for operator EV safety)',
    category = 'referral'
WHERE key = 'referral_auction_buy_pct';

UPDATE settings
SET value = '0',
    description = 'Mining PP harvest → upline % (0=off, disabled by default for operator EV safety)',
    category = 'referral'
WHERE key = 'referral_harvest_pct';
