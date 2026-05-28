-- [v7.204 CRITICAL] 신규 가입 PP 보너스 0 강제.
-- 이전 설정: signup_pp_bonus = 100 PP, referral_signup_bonus_pp = 150 PP
--           → 추천 코드로 가입하면 250 PP mint = USDT 1:1 환산 시 $250 무료 발행.
-- 이건 운영 불가능한 손실. PP=USDT 페그 보장이 깨짐.
--
-- 신규 유저 온보딩은 다음으로 충분:
--   1. 일일 무료 가챠(함선 가챠) — 매일 1회 무료 상자
--   2. 일일 로그인 GP (8~40 GP)
--   3. 일일 미션 GP
--   4. 캠페인 진행 보상
--   → PP 직접 mint는 완전 차단.
--
-- 양면 추천 보상(referral_signup_bonus_pp)도 0 — 추천 시스템은 commission(추천인) 만 유지.
-- 추천 received side는 GP/캠페인 보너스로 별도 구성 (추후 별도 마이그).
--
-- 운영자 노트: 정 추가 보너스가 필요하면 GP 로 (가입 + 500 GP 같은) 별도 설정 추가.
--   PP 는 절대 손대지 말 것.

UPDATE settings SET value = '0' WHERE key = 'signup_pp_bonus';
UPDATE settings SET value = '0' WHERE key = 'referral_signup_bonus_pp';

-- 안전 (UPSERT, 다른 환경에서 시드 누락 시):
INSERT INTO settings (category, key, value, description) VALUES
  ('economy',  'signup_pp_bonus',          '0', 'PP gifted to new users on registration (0=disabled). KEEP AT 0 — PP=USDT.'),
  ('referral', 'referral_signup_bonus_pp', '0', 'Extra PP for users joining with a referral code (0=disabled). KEEP AT 0 — PP=USDT.')
ON CONFLICT (key) DO UPDATE SET value = '0';

INSERT INTO schema_migrations (filename) VALUES ('254_zero_signup_pp_bonus.sql') ON CONFLICT DO NOTHING;
