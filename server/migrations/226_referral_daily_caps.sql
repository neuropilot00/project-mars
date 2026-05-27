-- 226_referral_daily_caps.sql
-- 추천 커미션 일일 상한(per-upline daily cap) 설정 키 시드.
-- 운영 안전(안티 파밍/인플레이션 방어) 레버. db.js creditReferralCommission()가 읽는다.
--   값 0 = 무제한(레거시 동작 유지). 운영자가 정상 수익 패턴을 관찰한 뒤 admin에서
--   유한값으로 설정하면 그 currency의 업라인 1인당 "오늘 받은 커미션 합"이 상한을 넘지 않도록
--   클램프된다. (referral_rewards.created_at 당일 합산 기준)
-- 기본값은 "봇/파밍만 걸리고 정상 유저는 거의 닿지 않는" 안전망 수준으로 시드한다.
--   pp/gp = 10000/일, usdt = 500/일 (업라인 1인당). 실제 트래픽 데이터 확인 후 admin에서 조정.
--   값 0 으로 두면 무제한(레거시). 정상 고래 유저가 걸리면 상향, 어뷰징 보이면 하향.
INSERT INTO settings (category, key, value, description) VALUES
  ('referral', 'referral_daily_cap_pp',   '10000', '추천 커미션 PP 일일 상한(업라인 1인/일). 0=무제한'),
  ('referral', 'referral_daily_cap_gp',   '10000', '추천 커미션 GP 일일 상한(업라인 1인/일). 0=무제한'),
  ('referral', 'referral_daily_cap_usdt', '500',   '추천 커미션 USDT 일일 상한(업라인 1인/일). 0=무제한')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('226_referral_daily_caps.sql') ON CONFLICT DO NOTHING;
