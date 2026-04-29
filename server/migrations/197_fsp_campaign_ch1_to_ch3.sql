-- 197: FSP Campaign Ch1~3 seed data

CREATE TABLE IF NOT EXISTS settlement_data (
  id VARCHAR(80) PRIMARY KEY,
  faction VARCHAR(20),
  population_capacity INT DEFAULT 1000,
  current_population INT DEFAULT 0,
  morale_modifier NUMERIC(5,2) DEFAULT 0,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settlement_data ADD COLUMN IF NOT EXISTS population_capacity INT DEFAULT 1000;
ALTER TABLE settlement_data ADD COLUMN IF NOT EXISTS current_population INT DEFAULT 0;
ALTER TABLE settlement_data ADD COLUMN IF NOT EXISTS morale_modifier NUMERIC(5,2) DEFAULT 0;
ALTER TABLE settlement_data ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS item_definitions (
  id VARCHAR(80) PRIMARY KEY,
  type VARCHAR(60),
  persistent BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('tea_ceremony_completed', 'FSP Ch1 차 두 잔 의식', 'event', 'player'),
  ('mikhail_oxygen_mask_revealed', 'Mikhail 의안 사연 공개', 'npc_state', 'player'),
  ('mikhail_trust_deepened', 'Mikhail 깊은 신뢰', 'npc_state', 'player'),
  ('civilian_minded', '민간 우선 마인드 표현', 'event', 'player'),
  ('ch1_patient_died', 'FSP Ch1 환자 사망', 'event', 'player'),
  ('cargo_alpha_lost', 'FSP Ch1 cargo alpha 손실', 'event', 'player'),
  ('cargo_beta_lost', 'FSP Ch1 cargo beta 손실', 'event', 'player'),
  ('new_athens_water_crisis', 'FSP Ch1 양 cargo 손실로 마을 위기', 'world_state', 'player'),
  ('tried_to_negotiate', 'FSP Ch1 단가 협상 시도', 'event', 'player'),
  ('heard_mikhail_backstory', 'FSP Ch1 Mikhail 배경 질문', 'event', 'player'),
  ('lena_collaboration_full', 'FSP Ch2 Lena 풀 협업', 'event', 'player'),
  ('convoy_split', 'FSP Ch2 운반선 분산', 'event', 'player'),
  ('tried_mcc_route', 'FSP Ch2 MCC 단열선 시도', 'event', 'player'),
  ('heard_lena_mother_story', 'FSP Ch2 Lena 어머니 사연', 'npc_state', 'player'),
  ('lena_mother_revealed', 'Lena 어머니 폭풍 사망 공개', 'world_state', 'player'),
  ('lena_dead', 'Lena Torres 사망', 'event', 'player'),
  ('ch2_water_shortage', 'FSP Ch2 얼음 70% 미만', 'world_state', 'player'),
  ('lena_deep_trust', 'Lena 깊은 신뢰', 'npc_state', 'player'),
  ('solo_op_chosen', 'FSP Ch3 단독 작전 선택', 'event', 'player'),
  ('official_op_chosen', 'FSP Ch3 공식 작전 선택', 'event', 'player'),
  ('amara_approves', 'Amara 공식 작전 승인', 'event', 'player'),
  ('amara_17_workers_revealed', 'Amara 17벌 작업복 사연 공개', 'world_state', 'player'),
  ('samuel_cousin_inside', 'Samuel 사촌 광산 내부', 'npc_state', 'player'),
  ('mcc_diplomacy_history_revealed', 'MCC 협상 실패 역사 공개', 'world_state', 'player'),
  ('respected_miner_choice', '60명 결정 존중', 'event', 'player'),
  ('forced_60_miners', '60명 강제 구출', 'event', 'player'),
  ('samuel_trusts_player', 'Samuel 신뢰 획득', 'npc_state', 'player'),
  ('ch3_partial_rescue', 'FSP Ch3 80% 미만 구출', 'event', 'player'),
  ('new_athens_population_350_added', '광부 350명 New Athens 합류', 'world_state', 'player'),
  ('requested_intel', 'FSP Ch3 광부 의사 확인 요청', 'event', 'player'),
  ('tried_diplomacy', 'FSP Ch3 외교 해결 시도', 'event', 'player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('ch2_settlement_water_critical', 'fsp_campaign_ch2', 'Ch1 cargo 손실로 Ch2 응급 보급 임무', '{"OR":[{"flag":"cargo_alpha_lost"},{"flag":"cargo_beta_lost"}]}'::jsonb, '{"ch2_briefing_variant":"emergency_supply_doubled","ch2_time_pressure":0.3}'::jsonb),
  ('npc_yuna_distrust', 'any_fsp', 'Ch1 환자 사망으로 Yuna 협력 감소', '{"AND":[{"flag":"ch1_patient_died"}]}'::jsonb, '{"yuna_kim_dialog":"cold_variant","yuna_kim_cooperation":"reduced"}'::jsonb),
  ('ch3_lena_companion', 'fsp_campaign_ch3', 'Ch2 Lena 깊은 신뢰로 Ch3 동행', '{"AND":[{"flag":"lena_deep_trust"}]}'::jsonb, '{"lena_can_join_ch3":true,"mission_difficulty":-0.1}'::jsonb),
  ('ch3_samuel_hostile', 'fsp_campaign_ch3', 'Ch2 Lena 사망으로 Ch3 Samuel 적대', '{"AND":[{"flag":"lena_dead"}]}'::jsonb, '{"samuel_initial_dialog":"hostile","mission_briefing_variant":"confrontation_first"}'::jsonb),
  ('cross_route_water_crisis', 'any_fsp_post_ch2', 'Ch2 물 부족으로 정착지 사기 저하', '{"AND":[{"flag":"ch2_water_shortage"}]}'::jsonb, '{"settlement_morale":-10,"fsp_resource_baseline":-15}'::jsonb),
  ('ch4_settlement_resource_strain', 'fsp_campaign_ch4', 'Ch3 인구 증가로 Ch4 자원 부담', '{"AND":[{"flag":"new_athens_population_350_added"}]}'::jsonb, '{"settlement_food_pressure":0.3,"mikhail_dialog_burdened":true}'::jsonb),
  ('cross_route_mcc_oxygen_slavery_known', 'any_route_ng_plus', 'FSP Ch3 공식 작전으로 MCC 산소 무기 인지', '{"AND":[{"flag":"official_op_chosen"}]}'::jsonb, '{"player_knows_mcc_oxygen_weapon":true,"mcc_dialog_disgust":true}'::jsonb),
  ('ch4_samuel_companion', 'fsp_campaign_ch4', 'Ch3 Samuel 신뢰로 Ch4 동행', '{"AND":[{"flag":"samuel_trusts_player"}]}'::jsonb, '{"samuel_can_join":true,"battle_strength":0.15}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('failed_the_wounded', 'tag', 'tag.failed_the_wounded.name', 'tag.failed_the_wounded.desc', TRUE, FALSE, '{"yuna_kim_cooperation":"reduced","fsp_dialog_cooler":true}'::jsonb),
  ('lifesaver', 'title', 'tag.lifesaver.name', 'tag.lifesaver.desc', FALSE, FALSE, '{"yuna_kim_dialog":"warmer","fsp_settlement_warmth":true}'::jsonb),
  ('coercive_liberator', 'tag', 'tag.coercive_liberator.name', 'tag.coercive_liberator.desc', TRUE, FALSE, '{"fsp_dialog_cooler":true,"morality":-10}'::jsonb),
  ('true_liberator', 'title', 'tag.true_liberator.name', 'tag.true_liberator.desc', FALSE, FALSE, '{"fsp_dialog_warmer":true,"samuel_trust_bonus":true,"morality":10}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled)
VALUES
  ('mikhail_anders', 'fsp', 'fsp_campaign_ch1', TRUE),
  ('lena_torres', 'fsp', 'fsp_campaign_ch1', TRUE),
  ('yuna_kim', 'fsp', 'fsp_campaign_ch1', TRUE),
  ('samuel_torres', 'fsp', 'fsp_campaign_ch3', TRUE),
  ('sal_cruz', 'cv', 'fsp_campaign_ch2', TRUE),
  ('amara_okafor', 'fsp', 'fsp_campaign_ch3', TRUE)
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled;

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('dust_storm_recovery', '{"optical":-15,"laser_range":-5,"cargo_speed":-10,"weapons_unaffected":["railgun"]}'::jsonb, 'continuous', '{"intensity_decreases_over_time":true}'::jsonb),
  ('solar_exposure_active', '{"ice_loss_per_hour_phases":[0,0,1,3,8],"max_safe_hours":12}'::jsonb, 'accumulation', '{"avoidance":"phobos_eclipse_or_shadow_route"}'::jsonb),
  ('high_altitude_thin_air', '{"breathing_load":20,"crew_eff":-5,"railgun":-10,"missile":5}'::jsonb, 'continuous', '{"trigger_altitude_km":5}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO item_definitions (id, type, persistent, description)
VALUES
  ('grain_canisters', 'consumable_resource', TRUE, 'FSP settlement grain canisters'),
  ('medical_kit', 'consumable_resource', TRUE, 'Field medical kit'),
  ('sprite_speed_kit', 'ship_modification', TRUE, 'Sprite speed modification kit'),
  ('vector_destroyer_captured', 'ship_capital_captured', TRUE, 'Captured MCC Vector Destroyer'),
  ('sprite_frigate_blueprint', 'ship_blueprint', TRUE, 'FSP Sprite Frigate blueprint')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, description = EXCLUDED.description;

INSERT INTO settlement_data (id, faction, population_capacity, current_population, payload)
VALUES
  ('new_athens', 'fsp', 1500, 750, '{"safe_haven":true}'::jsonb),
  ('cold_brook', 'fsp', 800, 450, '{"water_dependency":"high"}'::jsonb),
  ('ridge_town', 'fsp', 1000, 580, '{"water_dependency":"medium"}'::jsonb),
  ('hellas_central', 'fsp', 2500, 1800, '{"fsp_hub":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, population_capacity = EXCLUDED.population_capacity, current_population = EXCLUDED.current_population, payload = EXCLUDED.payload, updated_at = NOW();

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('fsp_campaign_ch1', 'fsp_route', 1, 'fsp', '방파제', 'The Breakwater', 1, 'server_simulation', 900, '{"environment":{"type":"dust_storm_recovery","secondary":"night_freezing"},"tone":"warm_community"}'::jsonb),
  ('fsp_campaign_ch2', 'fsp_route', 2, 'fsp', '얼음 캐러밴', 'The Ice Caravan', 2, 'server_simulation', 1800, '{"environment":{"type":"solar_exposure_active","secondary":"phobos_eclipse_periodic"}}'::jsonb),
  ('fsp_campaign_ch3', 'fsp_route', 3, 'fsp', '피의 광산', 'Blood Mine', 3, 'server_simulation', 1800, '{"environment":{"type":"high_altitude_thin_air","secondary":"olympus_geothermal"}}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('fsp_campaign_ch1', 'fsp_route', 1, 'campaign.fsp.ch1.title', NULL, 1, '{"fsp":0}'::jsonb, '["war_criminal"]'::jsonb, 900, 'mvp_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch1"}'::jsonb),
  ('fsp_campaign_ch2', 'fsp_route', 2, 'campaign.fsp.ch2.title', 'fsp_campaign_ch1', 2, '{"fsp":15}'::jsonb, '[]'::jsonb, 1800, 'mvp_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch2"}'::jsonb),
  ('fsp_campaign_ch3', 'fsp_route', 3, 'campaign.fsp.ch3.title', 'fsp_campaign_ch2', 3, '{"fsp":25}'::jsonb, '["war_criminal"]'::jsonb, 1800, 'mvp_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch3"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('fsp_campaign_ch1', 'dust_storm_recovery', 'night_freezing', '{"phases":[{"phase":0,"start":0,"optical":-15},{"phase":2,"start":600,"freeze_drain":0.5},{"phase":3,"start":900,"freeze_drain":1.0}]}'::jsonb, '[600,750]'::jsonb),
  ('fsp_campaign_ch2', 'solar_exposure_active', 'phobos_eclipse_periodic', '{"accumulation_phases":{"0-720":0,"720-900":1,"900-1080":3,"1080+":8},"phobos_eclipse_count":5}'::jsonb, '[720,900,1080]'::jsonb),
  ('fsp_campaign_ch3', 'high_altitude_thin_air', 'olympus_geothermal', '{"effects":{"breathing":20,"railgun":-10},"oxygen_regulators":5}'::jsonb, '[900]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
