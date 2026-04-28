-- 196: MCC Campaign Ch8~10 seed data

CREATE TABLE IF NOT EXISTS item_definitions (
  id VARCHAR(80) PRIMARY KEY,
  type VARCHAR(60),
  persistent BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS special_assets (
  id VARCHAR(80) PRIMARY KEY,
  type VARCHAR(60),
  hp INTEGER,
  deploys_in JSONB DEFAULT '[]'::jsonb,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('prometheus_completed', 'Prometheus 건조 완료', 'world_state', 'player'),
  ('prometheus_destroyed', 'Prometheus 파괴됨', 'world_state', 'player'),
  ('prometheus_destroyed_by_player', 'Branch A에서 플레이어가 Prometheus 파괴', 'event', 'player'),
  ('prometheus_construction_failed', 'Prometheus 건조 실패', 'event', 'player'),
  ('amara_okafor_dead', 'Amara Okafor 사망', 'event', 'player'),
  ('kara_vex_dead', 'Kara Vex 사망', 'event', 'player'),
  ('chen_killed_in_prometheus', 'Prometheus 작전 중 Chen 사망', 'event', 'player'),
  ('ch8_accelerated_construction', 'Ch8 건조 가속 선택', 'event', 'player'),
  ('ch8_wave3_intel', 'Ch8 적 본대 사전 정찰', 'event', 'player'),
  ('ch8_chen_alibi', 'Ch8 Chen 의심에 알리바이 제출', 'event', 'player'),
  ('ch8_partial_truth', 'Ch8 Chen에게 부분 고백', 'event', 'player'),
  ('ch8_kara_command', 'Ch8 Kara 지휘 수용', 'event', 'player'),
  ('ch8_distributed_attack', 'Ch8 분산 공격 선택', 'event', 'player'),
  ('ch8_chen_hunt', 'Ch8 Chen 추적 선택', 'event', 'player'),
  ('ch9_chose_olympus', 'Ch9 Olympus 지휘', 'event', 'player'),
  ('ch9_chose_hellas', 'Ch9 Hellas 지휘', 'event', 'player'),
  ('ch9_chose_valles', 'Ch9 Valles 지휘', 'event', 'player'),
  ('ch9_chose_kepler', 'Ch9 Kepler 지휘', 'event', 'player'),
  ('amara_dead', 'Amara 사망', 'event', 'player'),
  ('amara_captured', 'Amara 포로', 'event', 'player'),
  ('butcher_dead', 'Butcher Vasquez 사망', 'event', 'player'),
  ('butcher_escaped', 'Butcher 도주 허용', 'event', 'player'),
  ('chen_weiss_at_kepler', 'Branch A Kepler에서 Chen 직접 조우', 'event', 'player'),
  ('pilgrim_arms_revealed_to_player', 'Pilgrim Arms 4번째 파벌 공개', 'world_state', 'player'),
  ('all_pilgrim_arms_destroyed', 'Pilgrim Arms 24척 전부 격파', 'event', 'player'),
  ('roth_data_permanent_secure', 'Roth 데이터 영구 확보', 'world_state', 'player'),
  ('mcc_route_completed', 'MCC 루트 완료', 'world_state', 'player'),
  ('chose_ending_1', 'Ending 1 The Loyal Hire 선택', 'event', 'player'),
  ('chose_ending_2', 'Ending 2 The Executive 선택', 'event', 'player'),
  ('chose_ending_3', 'Ending 3 The Whistleblower 선택', 'event', 'player'),
  ('chose_ending_4', 'Ending 4 The Traitor 선택', 'event', 'player'),
  ('chose_bad_ending', 'Bad Ending fallback 선택', 'event', 'player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('ch9_prometheus_active', 'mcc_campaign_ch9', 'Prometheus 완성으로 Ch9 MCC 전력 강화', '{"AND":[{"flag":"prometheus_completed"}]}'::jsonb, '{"mcc_fleet_strength":30,"ch9_difficulty":-0.2}'::jsonb),
  ('ch9_prometheus_lost', 'mcc_campaign_ch9', 'Prometheus 손실로 Ch9 MCC 전력 약화', '{"OR":[{"flag":"prometheus_destroyed"},{"flag":"prometheus_construction_failed"}]}'::jsonb, '{"mcc_fleet_strength":-30,"ch9_difficulty":0.3}'::jsonb),
  ('ch10_chen_pre_warned', 'mcc_campaign_ch10', 'Branch C Chen 의심 누적', '{"AND":[{"flag":"ch6_chose_copy_silent"},{"flag":"chen_loyalty_test_failed"}]}'::jsonb, '{"ch10_blackmail_difficulty":1,"chen_dialog":"cold_pre_warned"}'::jsonb),
  ('ch10_npc_amara_dead', 'mcc_campaign_ch10', 'Amara 사망으로 Ending 3 변형', '{"AND":[{"flag":"amara_dead"}]}'::jsonb, '{"fsp_eternal_hostility":true,"ending_3_modified":true}'::jsonb),
  ('ch10_npc_amara_captured', 'mcc_campaign_ch10', 'Amara 포로 상태로 Ch10 등장', '{"AND":[{"flag":"amara_captured"}]}'::jsonb, '{"ch10_npc":"amara_in_chains"}'::jsonb),
  ('ch10_npc_butcher_active', 'mcc_campaign_ch10', 'Butcher 도주로 Ch10 개입 가능', '{"AND":[{"flag":"butcher_escaped"}]}'::jsonb, '{"ch10_butcher_intervention":"possible"}'::jsonb),
  ('ch10_pilgrim_revealed', 'mcc_campaign_ch10', 'Pilgrim Arms 공개로 Ending 4 맥락 강화', '{"AND":[{"flag":"pilgrim_arms_revealed_to_player"}]}'::jsonb, '{"ending_4_pilgrim_context":"enriched"}'::jsonb),
  ('ch10_weakened_position', 'mcc_campaign_ch10', 'Ch9 전장 패배로 Ch10 협상력 약화', '{"OR":[{"flag":"ch9_battlefield_lost"}]}'::jsonb, '{"weakened_position":true}'::jsonb),
  ('cross_route_pilgrim_arms_exists', 'any_route_ng_plus', 'Ending 4 이후 NG+에서 Pilgrim Arms 활성', '{"AND":[{"flag":"chose_ending_4"}]}'::jsonb, '{"pilgrim_arms_npc_faction_active":true}'::jsonb),
  ('cross_route_chen_dead', 'any_route', 'Chen 사망 또는 Ending 3 이후 Chen 비활성', '{"OR":[{"flag":"chen_killed_in_prometheus"},{"flag":"chose_ending_3"}]}'::jsonb, '{"chen_npc_unavailable":true,"mcc_post_chen_state":true}'::jsonb),
  ('cross_route_lifang_alive', 'any_route_ng_plus', 'Ending 3 이후 Li Fang 연방 정부 등장', '{"AND":[{"flag":"chose_ending_3"}]}'::jsonb, '{"lifang_in_federal_government":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('titan_killer', 'title', 'tag.titan_killer.name', 'tag.titan_killer.desc', FALSE, FALSE, '{"cv_recruitment_bonus":10}'::jsonb),
  ('fourth_faction_slayer', 'title', 'tag.fourth_faction_slayer.name', 'tag.fourth_faction_slayer.desc', FALSE, FALSE, '{"all_factions_respect":5}'::jsonb),
  ('shareholder', 'title', 'tag.shareholder.name', 'tag.shareholder.desc', FALSE, FALSE, '{"mcc_employment_perks":true,"olympus_residence":true}'::jsonb),
  ('future_chairman', 'title', 'tag.future_chairman.name', 'tag.future_chairman.desc', FALSE, FALSE, '{"mcc_equity_dividend":25000,"reserved_chairman":true}'::jsonb),
  ('the_fourth_faction', 'title', 'tag.the_fourth_faction.name', 'tag.the_fourth_faction.desc', FALSE, FALSE, '{"fourth_faction_leader":true,"new_route_unlock":true}'::jsonb),
  ('the_traitor', 'title', 'tag.the_traitor.name', 'tag.the_traitor.desc', FALSE, FALSE, '{"all_factions_distrust":true}'::jsonb),
  ('forgotten_freelancer', 'title', 'tag.forgotten_freelancer.name', 'tag.forgotten_freelancer.desc', TRUE, FALSE, '{"campaign_completion_undocumented":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled)
VALUES
  ('butcher_vasquez', 'cv', 'mcc_campaign_ch9', TRUE),
  ('pilgrim_arms_squadron', 'pilgrim_arms', 'mcc_campaign_ch9', FALSE),
  ('chen_command_pod', 'mcc', 'mcc_campaign_ch8_branch_a_optional', FALSE)
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, first_chapter_appearance = EXCLUDED.first_chapter_appearance, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled;

INSERT INTO special_assets (id, type, hp, deploys_in, payload)
VALUES
  ('prometheus_titan', 'npc_ally_titan', 1000000, '["mcc_campaign_ch9","mcc_campaign_ch10"]'::jsonb, '{"weapons":[{"type":"laser","dmg":700}],"can_be_destroyed_in_ch9":false}'::jsonb)
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, hp = EXCLUDED.hp, deploys_in = EXCLUDED.deploys_in, payload = EXCLUDED.payload;

INSERT INTO item_definitions (id, type, persistent, description)
VALUES
  ('tessellate_battleship', 'ship_capital', TRUE, 'MCC capital ship reward'),
  ('captured_sequoia', 'ship_capital_captured', TRUE, 'Captured FSP Sequoia'),
  ('captured_ironclad', 'ship_capital_captured', TRUE, 'Captured CV Ironclad'),
  ('pilgrim_pa3', 'ship_special', TRUE, 'Captured Pilgrim Arms PA-3'),
  ('mcc_equity_8pct', 'corporate_asset', TRUE, 'MCC equity 8 percent'),
  ('pilgrim_arms_starter_fleet', 'ship_fleet_30', TRUE, 'Pilgrim Arms starter fleet'),
  ('kepler_territory', 'territory_ownership', TRUE, 'Kepler crater territory ownership'),
  ('olympus_residence', 'residence_olympus_4th', TRUE, 'Olympus 4th Ridge residence')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, description = EXCLUDED.description;

INSERT INTO achievements (key, name_en, name_ko, description_en, description_ko, rarity, category, icon, condition_value, condition_type, reward_gp, xp_reward)
VALUES
  ('ending_1_loyal_hire', 'Ending 1: The Loyal Hire', '엔딩 1: 충직한 고용인', 'Complete MCC route with Ending 1', 'MCC 루트를 엔딩 1로 완료', 'legendary', 'campaign', 'E1', 1, 'lore_flag', 0, 5000),
  ('ending_2_executive', 'Ending 2: The Executive', '엔딩 2: 임원', 'Complete MCC route with Ending 2', 'MCC 루트를 엔딩 2로 완료', 'legendary', 'campaign', 'E2', 1, 'lore_flag', 0, 6000),
  ('ending_3_whistleblower', 'Ending 3: The Whistleblower', '엔딩 3: 내부고발자', 'Complete MCC route with Ending 3', 'MCC 루트를 엔딩 3으로 완료', 'legendary', 'campaign', 'E3', 1, 'lore_flag', 0, 5500),
  ('ending_4_traitor', 'Ending 4: The Traitor', '엔딩 4: 배신자', 'Complete MCC route with Ending 4', 'MCC 루트를 엔딩 4로 완료', 'legendary', 'campaign', 'E4', 1, 'lore_flag', 0, 7000),
  ('mcc_route_completed', 'MCC Route Completed', 'MCC 루트 완료', 'Complete the MCC campaign route', 'MCC 캠페인 루트 완료', 'legendary', 'campaign', 'MCC', 1, 'lore_flag', 0, 10000)
ON CONFLICT (key) DO UPDATE SET name_en = EXCLUDED.name_en, name_ko = EXCLUDED.name_ko, description_en = EXCLUDED.description_en, description_ko = EXCLUDED.description_ko, rarity = EXCLUDED.rarity, category = EXCLUDED.category, icon = EXCLUDED.icon, condition_value = EXCLUDED.condition_value, condition_type = EXCLUDED.condition_type, reward_gp = EXCLUDED.reward_gp, xp_reward = EXCLUDED.xp_reward;

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('ch8_environmental_sequence', '{"sequence":true}'::jsonb, 'sequence', '{"phases":[1,2,3,4]}'::jsonb),
  ('parallel_4_environments', '{"parallel_battlefields":4}'::jsonb, 'parallel', '{"battlefields":["olympus","hellas","valles","kepler"]}'::jsonb),
  ('cinematic', '{"no_combat":true}'::jsonb, 'cinematic', '{}'::jsonb),
  ('olympus_geothermal', '{"heat_bonus":true,"terrain":"plains"}'::jsonb, 'continuous', '{"region":"olympus_orbit"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('mcc_campaign_ch8', 'mcc_route', 8, 'mcc', '프로메테우스', 'Prometheus', 8, 'server_simulation', 2160, '{"environment":{"type":"ch8_environmental_sequence"},"variant_by_branch":true}'::jsonb),
  ('mcc_campaign_ch9', 'mcc_route', 9, 'mcc', '깨진 동맹', 'Broken Alliance', 9, 'server_simulation', 2400, '{"environment":{"type":"parallel_4_environments"},"parallel_battlefields":true}'::jsonb),
  ('mcc_campaign_ch10', 'mcc_route', 10, 'mcc', '주주 엔딩', 'Shareholder Ending', 10, 'cinematic_only', 900, '{"environment":{"type":"cinematic"},"ending_choice":true}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('mcc_campaign_ch8', 'mcc_route', 8, 'campaign.mcc.ch8.title', 'mcc_campaign_ch7', 8, '{}'::jsonb, '[]'::jsonb, 2160, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch8","variant_by_branch":true}'::jsonb),
  ('mcc_campaign_ch9', 'mcc_route', 9, 'campaign.mcc.ch9.title', 'mcc_campaign_ch8', 9, '{}'::jsonb, '[]'::jsonb, 2400, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch9","parallel_battlefields":true}'::jsonb),
  ('mcc_campaign_ch10', 'mcc_route', 10, 'campaign.mcc.ch10.title', 'mcc_campaign_ch9', 10, '{}'::jsonb, '[]'::jsonb, 900, 'cinematic_only', '{"seed":"service.CHAPTERS.mcc_campaign_ch10","ending_choice":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('mcc_campaign_ch8', 'ch8_environmental_sequence', NULL, '{"phases":[{"id":1,"start":0,"end":720,"effects":"normal"},{"id":2,"start":720,"end":1080,"type":"phobos_eclipse","pattern":"30sec_per_30sec"},{"id":3,"start":1080,"end":1800,"type":"solar_wind","drain":0.5},{"id":4,"start":1800,"end":2160,"type":"local_ion","fleet_command":"disabled","emp":50}]}'::jsonb, '[720,1080,1800]'::jsonb),
  ('mcc_campaign_ch9', 'parallel_4_environments', NULL, '{"olympus":{"type":"olympus_geothermal"},"hellas":{"type":"night_freezing"},"valles":{"type":"ion_storm_active"},"kepler":{"type":"low_gravity_pocket"}}'::jsonb, '[1200]'::jsonb),
  ('mcc_campaign_ch10', 'cinematic', NULL, '{"no_combat":true}'::jsonb, '[]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
