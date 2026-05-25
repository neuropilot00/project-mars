-- Migration 221: Referral safety + decimal economy settings
-- 목적:
-- 1) 3단계 DYNASTY 추천/커미션을 실제 설정키 기준으로 복구
-- 2) 운영 손해를 키우는 채굴 커미션을 기본 비활성화
-- 3) 함선 수리/실드의 소수점 설정이 실제 코드와 맞도록 기본값을 정리

-- ── Referral triggers / admin-visible settings ─────────────────────────────
INSERT INTO settings (key, value, description, category)
VALUES
  ('referral_market_fee_pct', '100', 'Marketplace referral base → upline % (0=off). Applied to marketplace_referral_commission_pct_of_fee slice.', 'referral'),
  ('referral_enhance_pct', '5', 'Enhancement GP spend → upline % (0=off)', 'referral'),
  ('referral_auction_buy_pct', '3', 'Auction buy GP spend → upline % (0=off)', 'referral'),
  ('marketplace_referral_commission_pct_of_fee', '25', 'Share of marketplace fee exposed as referral commission base %', 'referral')
ON CONFLICT (key) DO NOTHING;

-- 운영 EV 보호: 순수 채굴 민팅 기반 추천 보상은 기본 OFF
UPDATE settings
SET value = '0'
WHERE key = 'referral_harvest_pct';

-- Cantina는 총 베팅액이 아니라 하우스엣지 기준으로 계산되므로 기존 비율 유지
INSERT INTO settings (key, value, description, category)
VALUES ('referral_cantina_pct', '2', 'Cantina house-edge base → upline % (0=off)', 'referral')
ON CONFLICT (key) DO NOTHING;

-- ── Decimal economy defaults actually used by ship services ───────────────
INSERT INTO settings (key, value, description, category)
VALUES
  ('ship_repair_gp_per_hp', '0.01', 'HP당 수리 GP', 'fleet'),
  ('ship_repair_iron_per_10hp', '0.2', '10 HP당 iron_ore', 'fleet'),
  ('shield_gp_per_unit', '0.05', '실드 1당 GP', 'fleet')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

INSERT INTO schema_migrations (filename)
VALUES ('221_referral_safety_and_decimal_economy.sql')
ON CONFLICT DO NOTHING;
