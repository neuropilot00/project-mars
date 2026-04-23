-- ============================================================
-- Migration 082: BIBLE Migration 080 — 설정 수정 + 비활성화
-- OCCUPY_MARS_COMPLETE_BIBLE.md Migration 080 기준
-- ============================================================

-- ── 1. 비활성화 설정 (UPSERT: 키 없으면 INSERT, 있으면 UPDATE) ──
INSERT INTO settings (key, value, description) VALUES
  ('cantina_enabled',               'false', 'Cantina (Arena) 미니게임 활성화 여부'),
  ('arcade_enabled',                'false', 'Arcade 미니게임 활성화 여부'),
  ('referral_tier2_rate',           '0',     '레퍼럴 2단계 비율'),
  ('referral_tier3_rate',           '0',     '레퍼럴 3단계 비율'),
  ('referral_deposit_reward_enabled',  'false', '레퍼럴 입금 보상 활성화'),
  ('referral_gameplay_reward_enabled', 'true',  '레퍼럴 게임플레이 보상 활성화')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 2. 마켓 등록비 상향 (2 GP → 10 GP) ──
UPDATE settings SET value = '10' WHERE key = 'marketplace_listing_fee_gp';

-- ── 3. 신규 settings 추가 (이미 존재하면 SKIP) ──
INSERT INTO settings (key, value, description) VALUES
  ('marketplace_dynamic_fee_5',     '2.0',   '5개+ 리스팅 등록비 배율'),
  ('marketplace_dynamic_fee_10',    '4.0',   '10개+ 리스팅 등록비 배율'),
  ('war_betting_enabled',           'false', 'Territory War Betting 활성화 (미구현)'),
  ('governor_max_tax_rate',         '10',    'Governor 최대 세율 (%)'),
  ('governor_market_cut',           '0.01',  'Governor 마켓 거래 자동 귀속 비율'),
  ('governor_declaration_cost_gp',  '5',     'Governor 선언문 게시 GP 비용'),
  ('siege_declaration_cost_gp',     '100',   'Siege 선언 GP 비용'),
  ('siege_warning_hours',           '48',    'Siege 대기 시간 (시간)'),
  ('siege_battle_hours',            '24',    'Siege 결전 시간 (시간)'),
  ('siege_min_territories',         '3',     'Siege 최소 보유 영토 수'),
  ('chronicle_hijack_min_pp',       '500',   'Chronicle 기록 최소 Hijack PP 규모'),
  ('chronicle_siege_min_p',         '5',     'Chronicle Siege 최소 참여자 수'),
  ('discord_webhook_url',           '""',    'Discord Webhook URL'),
  ('telegram_bot_token',            '""',    'Telegram 봇 토큰'),
  ('land_base_price_pp',            '0.1',   '픽셀당 기본 PP 가격'),
  ('land_adjacent_discount',        '0.85',  '인접 영토 구매 할인 배율'),
  ('land_core_price_mult',          '5.0',   'Core 섹터 가격 배율'),
  ('land_mid_price_mult',           '2.0',   'Mid 섹터 가격 배율'),
  ('land_frontier_price_mult',      '1.0',   'Frontier 섹터 가격 배율'),
  ('land_adjacency_5_bonus',        '0.05',  '5개 인접 영토 Mining 보너스'),
  ('land_adjacency_10_bonus',       '0.10',  '10개 인접 영토 Mining 보너스'),
  ('land_adjacency_20_bonus',       '0.20',  '20개 인접 영토 Mining 보너스'),
  ('job_required_level',            '5',     '직업 버프 활성화 최소 레벨'),
  ('job_change_cost_gp',            '50',    '직업 유료 변경 GP 비용'),
  ('job_change_weekly_free',        '1',     '주간 무료 직업 변경 횟수'),
  ('onboarding_enabled',            'true',  '온보딩 튜토리얼 활성화'),
  ('onboarding_pp_reward',          '100',   '온보딩 완료 PP 보상'),
  ('onboarding_gp_reward',          '200',   '온보딩 완료 GP 보상')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   UPDATE settings SET value = '2'     WHERE key = 'marketplace_listing_fee_gp';
--   UPDATE settings SET value = 'true'  WHERE key = 'cantina_enabled';
--   UPDATE settings SET value = 'true'  WHERE key = 'arcade_enabled';
--   DELETE FROM settings WHERE key IN (
--     'referral_tier2_rate','referral_tier3_rate',
--     'referral_deposit_reward_enabled','referral_gameplay_reward_enabled',
--     'marketplace_dynamic_fee_5','marketplace_dynamic_fee_10',
--     'war_betting_enabled','governor_max_tax_rate','governor_market_cut',
--     'governor_declaration_cost_gp','siege_declaration_cost_gp',
--     'siege_warning_hours','siege_battle_hours','siege_min_territories',
--     'chronicle_hijack_min_pp','chronicle_siege_min_p',
--     'discord_webhook_url','telegram_bot_token',
--     'land_base_price_pp','land_adjacent_discount','land_core_price_mult',
--     'land_mid_price_mult','land_frontier_price_mult',
--     'land_adjacency_5_bonus','land_adjacency_10_bonus','land_adjacency_20_bonus',
--     'onboarding_enabled','onboarding_pp_reward','onboarding_gp_reward'
--   );
-- ============================================================
