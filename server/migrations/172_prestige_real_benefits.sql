-- Migration 172: Colony Prestige + Territory Prestige 에 실효과 추가
-- 기존엔 GP만 소각되고 랭크 표시만 됨 → 실제 게임플레이 보너스 부여

-- ── Colony Prestige (플레이어 랭크) 보너스 ──────────────────────────
-- 각 랭크별 채굴량 %, GP earn %, Hijack 방어 % (콤마 구분)
-- 0=Colonist, 1=Pioneer, 2=Explorer, 3=Commander, 4=Governor, 5=Admiral
INSERT INTO settings (category, key, value, description) VALUES
  ('prestige', 'prestige_rank_mining_bonus_pct',  '"0,3,6,10,15,20"',  '랭크별 채굴량 보너스 %'),
  ('prestige', 'prestige_rank_gp_earn_bonus_pct', '"0,2,4,7,10,15"',   '랭크별 GP 획득 보너스 %'),
  ('prestige', 'prestige_rank_hijack_def_pct',    '"0,2,5,8,12,18"',   '랭크별 hijack 방어 보너스 %')
ON CONFLICT (key) DO NOTHING;

-- ── Territory Prestige (클레임 티어) 보너스 ────────────────────────
-- 티어 0~5: None, Bronze, Silver, Gold, Platinum, Diamond
INSERT INTO settings (category, key, value, description) VALUES
  ('tprestige', 'tprestige_tier_mining_bonus_pct', '"0,5,10,18,28,40"', '티어별 해당 클레임 채굴 보너스 %'),
  ('tprestige', 'tprestige_tier_hijack_def_pct',   '"0,3,7,12,18,25"',  '티어별 해당 클레임 hijack 방어 %'),
  ('tprestige', 'tprestige_tier_shield_bonus_pct', '"0,5,10,15,22,30"', '티어별 실드 지속시간 보너스 %')
ON CONFLICT (key) DO NOTHING;

-- ── schema_migrations ──────────────────────────────────────────
INSERT INTO schema_migrations (filename) VALUES ('172_prestige_real_benefits.sql')
ON CONFLICT DO NOTHING;
