-- 330_signup_starter_minerals.sql
-- 신규 첫 세션에 "첫 함선 건조" aha 도달용 스타터 광물 설정.
--   무료 첫 클레임(땅) + 스타터 GP(signup_pp_bonus) + 이 광물 → 신규가 어느 파벌이든
--   최저 인터셉터(cv_int 20GP / mcc_int 25 / fsp_int 35)를 첫 세션에 즉시 건조 가능.
--   채굴→건조 루프는 2번째 함선부터. 광물=환금 불가(비인플레), 계정당 1회 bounded seed.
--   지급 위치: server/routes/auth.js 가입 처리. 조절: 이 설정(JSON) admin 에서.

INSERT INTO settings (category, key, value, description) VALUES
  ('onboarding', 'signup_starter_minerals', '{"iron_ore":6,"carbon_fiber":6,"silicon_chip":3}', '신규 가입 스타터 광물(첫 프리깃 건조분, 3파벌 최저 인터셉터 커버)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('330_signup_starter_minerals.sql') ON CONFLICT DO NOTHING;
