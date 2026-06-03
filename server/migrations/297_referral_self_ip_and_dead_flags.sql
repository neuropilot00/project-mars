-- ============================================================
-- Migration 297: 추천 시스템 — 셀프-IP 허용(#1) + 죽은 플래그 정리(#3)
--
-- #1 referral_self_ip_block = false (운영자 추천 정책: 같은 IP 추천 허용)
--    주의: 이 플래그는 "일회성 가입 보너스(referral_signup_bonus_pp)"만 게이트한다.
--    지속 추천 수수료(creditReferralCommission)는 원래 IP를 보지 않으므로 영향 없음.
--    가입 보너스도 현재 0이라 실질 효과는 향후 보너스>0 설정 시에만 발생.
--
-- #3 코드에서 전혀 사용되지 않는(grep 0건) 죽은 설정 제거:
--    - referral_deposit_reward_enabled  (chain.js는 이 플래그 무시, deposit_pct로만 동작)
--    - referral_gameplay_reward_enabled (사용처 없음)
--    - referral_tier2_rate / referral_tier3_rate (tier2/3_percent의 죽은 중복, 값 0)
--
-- 주의: settings.key 단독 UNIQUE 없음 → UPDATE(중복행 전부) + 없을때 INSERT 패턴.
-- ============================================================

-- #1
UPDATE settings SET value = 'false' WHERE key = 'referral_self_ip_block';
INSERT INTO settings (category, key, value, description)
  SELECT 'referral', 'referral_self_ip_block', 'false', '셀프-IP 추천 가입보너스 차단 (false=허용)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'referral_self_ip_block');

-- #3
DELETE FROM settings WHERE key IN (
  'referral_deposit_reward_enabled',
  'referral_gameplay_reward_enabled',
  'referral_tier2_rate',
  'referral_tier3_rate'
);

INSERT INTO schema_migrations (filename) VALUES ('297_referral_self_ip_and_dead_flags.sql') ON CONFLICT DO NOTHING;
