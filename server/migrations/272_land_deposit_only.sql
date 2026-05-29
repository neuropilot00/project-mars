-- 272_land_deposit_only.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 (docs/ECONOMY_V2_SHIP_F2P_2026-05-29.md) P1 — 땅 = 입금 유저 전용.
--   영토(땅)는 유한 자원 → 무료 PP로 사들이지 못하게, PP 결제를 입금 연동(redeemable_pp)으로만 허용.
--   USDT 결제는 그대로(입금자만 USDT 보유). 무입금 유저는 함선 F2P 루프(GP)로 플레이.
--   off 시 기존 동작(전체 pp_balance 결제)으로 폴백.
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'land_requires_deposit_pp', 'true',
   '땅(영토) 클레임 PP 결제를 입금 연동(redeemable_pp)으로만 허용. 무료 PP로 땅 구매 차단. off=기존 전체 PP 결제.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('272_land_deposit_only.sql')
ON CONFLICT DO NOTHING;
