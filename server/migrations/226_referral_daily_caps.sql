-- 226_referral_daily_caps.sql
-- 추천 커미션 일일 상한(per-upline daily cap) 설정 키 시드.
-- 운영 안전(안티 파밍/인플레이션 방어) 레버. db.js creditReferralCommission()가 읽는다.
--   값 0 = 무제한(레거시 동작 유지). 운영자가 정상 수익 패턴을 관찰한 뒤 admin에서
--   유한값으로 설정하면 그 currency의 업라인 1인당 "오늘 받은 커미션 합"이 상한을 넘지 않도록
--   클램프된다. (referral_rewards.created_at 당일 합산 기준)
-- 권장: 데이터 확인 후 예) pp=50000, gp=20000 수준에서 시작해 조정.
INSERT INTO settings (category, key, value, description) VALUES
  ('referral', 'referral_daily_cap_pp',   '0', '추천 커미션 PP 일일 상한(업라인 1인/일). 0=무제한'),
  ('referral', 'referral_daily_cap_gp',   '0', '추천 커미션 GP 일일 상한(업라인 1인/일). 0=무제한'),
  ('referral', 'referral_daily_cap_usdt', '0', '추천 커미션 USDT 일일 상한(업라인 1인/일). 0=무제한')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('226_referral_daily_caps.sql') ON CONFLICT DO NOTHING;
