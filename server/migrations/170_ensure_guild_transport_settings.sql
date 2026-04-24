-- Migration 170: 누락 가능성 있는 guild/transport settings 강제 보장
-- 072 마이그레이션이 Railway에서 rename만 하고 새 key를 만들지 못한 케이스 대응
-- + transport_enabled 보장

-- ── Guild 레벨업 비용 (GP) ──────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('guilds', 'guild_level_max',         '6',     'Max guild level'),
  ('guilds', 'guild_level_2_cost_gp',   '200',   'GP treasury cost to reach level 2'),
  ('guilds', 'guild_level_3_cost_gp',   '500',   'GP treasury cost to reach level 3'),
  ('guilds', 'guild_level_4_cost_gp',   '1500',  'GP treasury cost to reach level 4'),
  ('guilds', 'guild_level_5_cost_gp',   '5000',  'GP treasury cost to reach level 5'),
  ('guilds', 'guild_level_6_cost_gp',   '15000', 'GP treasury cost to reach level 6'),
  ('guilds', 'guild_level_2_member_bonus', '2', '+2 member slots at Lv.2'),
  ('guilds', 'guild_level_3_member_bonus', '3', '+3 member slots at Lv.3'),
  ('guilds', 'guild_level_4_member_bonus', '3', '+3 member slots at Lv.4'),
  ('guilds', 'guild_level_5_member_bonus', '4', '+4 member slots at Lv.5'),
  ('guilds', 'guild_level_6_member_bonus', '5', '+5 member slots at Lv.6'),
  ('guilds', 'guild_research_slots_per_level', '1', 'Research slots per guild level'),
  ('guilds', 'guild_contrib_default_pct', '5', 'Default GP contribution %')
ON CONFLICT (key) DO NOTHING;

-- ── guilds.gp_treasury 컬럼 보장 ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guilds' AND column_name='gp_treasury') THEN
    ALTER TABLE guilds ADD COLUMN gp_treasury NUMERIC(20,6) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild_treasury_ledger' AND column_name='delta_gp') THEN
    ALTER TABLE guild_treasury_ledger ADD COLUMN delta_gp NUMERIC(20,6) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guild_members' AND column_name='gp_contribution_pct') THEN
    ALTER TABLE guild_members ADD COLUMN gp_contribution_pct INT DEFAULT 5;
  END IF;
END $$;

-- ── Transport 설정 보장 ─────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('transport', 'transport_enabled',                'true', '수송 시스템 활성화'),
  ('transport', 'transport_base_duration_minutes',  '15',   '기본 수송 소요 시간(분)'),
  ('transport', 'transport_distance_multiplier',    '1.0',  '거리 가중치'),
  ('transport', 'transport_reward_pct_of_cargo',    '10',   '화물가 대비 보상 %'),
  ('transport', 'transport_reward_distance_bonus_pct', '5',  '거리 보너스 %'),
  ('transport', 'transport_min_cargo_gp',           '100',  '최소 화물 GP'),
  ('transport', 'transport_max_cargo_gp',           '50000','최대 화물 GP'),
  ('transport', 'transport_max_concurrent_per_user','3',    '유저당 동시 수송 최대'),
  ('transport', 'transport_entry_level_check',      'true', '레벨 체크 활성'),
  ('transport', 'transport_raid_enabled',           'true', '수송 탈취 활성'),
  ('transport', 'transport_raid_success_base_pct',  '40',   '탈취 기본 성공률 %'),
  ('transport', 'transport_raid_loot_pct',          '30',   '탈취 시 약탈 %'),
  ('transport', 'transport_raid_cooldown_minutes',  '30',   '탈취 쿨다운(분)'),
  ('transport', 'transport_raid_min_progress_pct',  '20',   '탈취 가능 최소 진행률'),
  ('transport', 'transport_raid_max_progress_pct',  '80',   '탈취 가능 최대 진행률'),
  ('transport', 'transport_raid_self_exempt',       'true', '본인 수송 탈취 금지'),
  ('transport', 'transport_raid_guild_exempt',      'true', '같은 길드 탈취 금지')
ON CONFLICT (key) DO NOTHING;

-- ── schema_migrations ──
INSERT INTO schema_migrations (filename) VALUES ('170_ensure_guild_transport_settings.sql')
ON CONFLICT DO NOTHING;
