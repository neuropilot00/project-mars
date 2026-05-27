-- 227_referral_signup_bonus.sql
-- 양면 추천 보상: 추천 코드로 가입한 신규 유저(invitee)에게 지급하는 추가 PP 보너스.
-- auth.js 회원가입 트랜잭션에서 referred_by 가 설정된 경우 signup_pp_bonus 위에 추가 지급.
-- 기본 150 PP (signup_pp_bonus=300의 절반 수준 — 친구 코드로 들어오면 명확히 이득이 되도록).
-- 운영자가 admin에서 조정 가능. 0 = 비활성.
INSERT INTO settings (category, key, value, description) VALUES
  ('referral', 'referral_signup_bonus_pp', '150', '추천 코드로 가입한 신규 유저에게 주는 추가 PP 보너스(양면 보상). 0=비활성')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('227_referral_signup_bonus.sql') ON CONFLICT DO NOTHING;
