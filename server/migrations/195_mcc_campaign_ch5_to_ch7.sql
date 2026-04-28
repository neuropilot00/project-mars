-- 195: MCC Campaign Ch5~7 seed data

CREATE TABLE IF NOT EXISTS data_artifact_definitions (
  id VARCHAR(80) PRIMARY KEY,
  type VARCHAR(40),
  persistent BOOLEAN DEFAULT TRUE,
  used_in_chapters JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('ch5_chose_block_fsp', 'Ch5 FSP 측면 차단 선택', 'event', 'player'),
  ('ch5_chose_escort', 'Ch5 보급선 호위 선택', 'event', 'player'),
  ('ch5_chose_solo_data', 'Ch5 데이터 단독 탈취 선택', 'event', 'player'),
  ('ch5_chose_cv_strike', 'Ch5 CV 자급 격파 선택', 'event', 'player'),
  ('dr_roth_data_obtained', 'Roth 외계 기원 메시지 수신', 'world_state', 'player'),
  ('dr_roth_data_published_to_player', 'Roth 데이터 플레이어에게 공개', 'world_state', 'player'),
  ('cv_plague_ship_destroyed', 'CV 자급 모선 격파', 'event', 'player'),
  ('kepler_data_server_secured', 'Kepler 서버 MCC 확보', 'event', 'player'),
  ('kepler_data_server_player_solo', 'Kepler 서버 플레이어 단독 확보', 'event', 'player'),
  ('dr_roth_disappeared', 'Dr. Roth 영구 실종 확정', 'world_state', 'player'),
  ('insubordination_attempt', 'Ch5 명령 불복종 시도', 'event', 'player'),
  ('ch6_chose_help_lifang', 'Ch6 Branch A 선택', 'event', 'player'),
  ('ch6_chose_report_chen', 'Ch6 Branch B 선택', 'event', 'player'),
  ('ch6_chose_copy_silent', 'Ch6 Branch C 선택', 'event', 'player'),
  ('lifang_arrested', 'Li Fang 체포', 'event', 'player'),
  ('lifang_died_in_escape', 'Li Fang 도주 중 사망', 'event', 'player'),
  ('lifang_escaped', 'Li Fang 단독 도주', 'event', 'player'),
  ('chen_no_suspicion', 'Chen 의심 없음', 'world_state', 'player'),
  ('chen_suspicion_active', 'Chen 의심 활성화', 'world_state', 'player'),
  ('chen_secret_meeting_offered', 'Ch3 Helion 격파로 비밀 회의 초대', 'event', 'player'),
  ('cv_warlords_killed', 'CV 군벌 2명 제거', 'world_state', 'player'),
  ('cv_warlord_cruz_dead', 'Cruz 사망', 'event', 'player'),
  ('cv_warlord_vain_dead', 'Vain 사망', 'event', 'player'),
  ('helion_stock_collapsed', 'Helion 주가 폭락', 'world_state', 'player'),
  ('helion_subsidiary_acquired', 'Helion 자회사 인수', 'world_state', 'player'),
  ('ch7_market_war_exposed', 'Ch7 작전 노출', 'event', 'player'),
  ('chen_loyalty_test_passed', 'Ch7c Chen 의심 통과', 'event', 'player'),
  ('chen_loyalty_test_failed', 'Ch7c Chen 의심 실패', 'event', 'player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('ending_2_executive_eligible', 'mcc_campaign_ch10', 'Ch5 solo_data + reputation MCC >=80', '{"AND":[{"lore_flag":"dr_roth_data_obtained"},{"flag":"ch5_chose_solo_data"},{"reputation":{"faction":"mcc","gte":80}}]}'::jsonb, '{"ch10_ending_options_add":["ending_2_executive"]}'::jsonb),
  ('ending_4_traitor_eligible', 'mcc_campaign_ch10', 'Ch5 데이터 + Ch6 사본', '{"AND":[{"lore_flag":"dr_roth_data_obtained"},{"flag":"ch6_chose_copy_silent"}]}'::jsonb, '{"ch10_ending_options_add":["ending_4_traitor"]}'::jsonb),
  ('mcc_route_a_active', 'any_mcc_post_ch6', 'Ch6 Branch A 도주극 루트', '{"AND":[{"flag":"ch6_chose_help_lifang"}]}'::jsonb, '{"ch7_route":"branch_a","ch8_route":"branch_a","ch9_route":"branch_a","ch10_endings_available":["ending_3_whistleblower"]}'::jsonb),
  ('mcc_route_b_active', 'any_mcc_post_ch6', 'Ch6 Branch B 충실 루트', '{"AND":[{"flag":"ch6_chose_report_chen"}]}'::jsonb, '{"ch7_route":"branch_b","ch10_endings_available":["ending_1_loyal_hire","ending_2_executive"]}'::jsonb),
  ('mcc_route_c_active', 'any_mcc_post_ch6', 'Ch6 Branch C 이중 플레이 루트', '{"AND":[{"flag":"ch6_chose_copy_silent"}]}'::jsonb, '{"ch7_route":"branch_c","ch10_endings_available":["ending_1_loyal_hire","ending_2_executive","ending_4_traitor"]}'::jsonb),
  ('ending_3_locked_in', 'mcc_campaign_ch10', 'Ch6 Branch A locks whistleblower ending', '{"AND":[{"flag":"ch6_chose_help_lifang"}]}'::jsonb, '{"ending":"ending_3_whistleblower"}'::jsonb),
  ('ending_1_eligible', 'mcc_campaign_ch10', 'Ch6 Branch B loyal hire ending eligible', '{"AND":[{"flag":"ch6_chose_report_chen"}]}'::jsonb, '{"ending":"ending_1_loyal_hire"}'::jsonb),
  ('ending_4_unlocked', 'mcc_campaign_ch10', 'Ch6 Branch C unlocks traitor ending', '{"AND":[{"flag":"ch6_chose_copy_silent"}]}'::jsonb, '{"ending":"ending_4_traitor"}'::jsonb),
  ('ch9_cv_destabilized', 'mcc_campaign_ch9', 'Ch7a CV 군벌 제거', '{"AND":[{"flag":"cv_warlords_killed"}]}'::jsonb, '{"cv_internal_chaos":true,"cv_fleet_strength":-20}'::jsonb),
  ('ch8_chen_surveillance', 'mcc_campaign_ch8', 'Ch7c Chen 의심 실패', '{"OR":[{"flag":"chen_loyalty_test_failed"}]}'::jsonb, '{"surveillance_intensity":"high","ch8_difficulty_modifier":1.2}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('whistleblower', 'title', 'tag.whistleblower.name', 'tag.whistleblower.desc', FALSE, FALSE, '{"fsp_dialog_warmer":true,"mcc_dialog_hostile":true,"federal_government_access":true}'::jsonb),
  ('secret_keeper', 'tag', 'tag.secret_keeper.name', 'tag.secret_keeper.desc', FALSE, FALSE, '{"chen_dialog_no_change":true}'::jsonb),
  ('traitor_executed', 'war_status', 'tag.traitor_executed.name', 'tag.traitor_executed.desc', TRUE, FALSE, '{"blocks_revival":true}'::jsonb),
  ('insubordinate', 'tag', 'tag.insubordinate.name', 'tag.insubordinate.desc', TRUE, FALSE, '{"mcc_promotion_blocked":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled)
VALUES
  ('amara_okafor', 'fsp', 'mcc_campaign_ch6_branch_a', TRUE),
  ('marcus_reeve', 'mcc', 'mcc_campaign_ch6_branch_b', TRUE),
  ('dr_elias_roth', 'independent', 'mcc_campaign_ch5', FALSE)
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, first_chapter_appearance = EXCLUDED.first_chapter_appearance, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled;

INSERT INTO data_artifact_definitions (id, type, persistent, used_in_chapters, description)
VALUES
  ('roth_data_copy', 'data_artifact', TRUE, '["mcc_ch6","mcc_ch10","fsp_routes","cv_routes"]'::jsonb, 'Roth 외계 기원 분석'),
  ('lifang_blackmail_data', 'data_artifact', TRUE, '["mcc_ch10"]'::jsonb, 'Chen-CV 47건 자금 이체'),
  ('plague_burner', 'weapon_system', TRUE, '[]'::jsonb, 'CV 모선 격파 무기')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, used_in_chapters = EXCLUDED.used_in_chapters, description = EXCLUDED.description;

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('low_gravity_pocket', '{"ship_maneuverability":20,"long_range_accuracy":-25,"railgun_effective_modifier":-15,"missile_effective_modifier":20,"drone_effective_modifier":10}'::jsonb, 'continuous', '{"permanent":true}'::jsonb),
  ('oxygen_supply_pressure', '{"oxygen_drain_per_interval":-25,"fleet_efficiency_depleted":-50}'::jsonb, 'continuous', '{"interval_sec":1800,"full_depletion_sec":3600}'::jsonb),
  ('solar_radiation_storm', '{"non_armored_hp_drain_per_min":-1,"armored_hp_drain":0,"crew_casualty_buildup":10,"satellite_tracking_accuracy":-80}'::jsonb, 'continuous', '{"duration_hours":36}'::jsonb),
  ('dust_storm_season_peak', '{"optical_accuracy":-40,"laser_range":-50,"missile_accuracy":-15,"railgun_accuracy":0,"visual_obstruction":"high","satellite_tracking":-80}'::jsonb, 'continuous', '{"duration_hours":18}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('mcc_campaign_ch5', 'mcc_route', 5, 'mcc', '케플러 분쟁', 'Kepler Commons', 5, 'server_simulation', 1200, '{"environment":{"type":"low_gravity_pocket","secondary":"oxygen_supply_pressure"}}'::jsonb),
  ('mcc_campaign_ch6', 'mcc_route', 6, 'mcc', '내부고발자', 'Whistleblower', 6, 'server_simulation', 1500, '{"environment":{"type":"solar_radiation_storm"},"route_defining":true}'::jsonb),
  ('mcc_campaign_ch7', 'mcc_route', 7, 'mcc', '시장 전쟁', 'Market War', 7, 'server_simulation', 1500, '{"environment":{"type":"dust_storm_season_peak"},"variant_by_branch":true}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('mcc_campaign_ch5', 'mcc_route', 5, 'campaign.mcc.ch5.title', 'mcc_campaign_ch4', 5, '{"mcc":40}'::jsonb, '[]'::jsonb, 1200, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch5"}'::jsonb),
  ('mcc_campaign_ch6', 'mcc_route', 6, 'campaign.mcc.ch6.title', 'mcc_campaign_ch5', 6, '{"mcc":50}'::jsonb, '[]'::jsonb, 1500, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch6"}'::jsonb),
  ('mcc_campaign_ch7', 'mcc_route', 7, 'campaign.mcc.ch7.title', 'mcc_campaign_ch6', 7, '{}'::jsonb, '[]'::jsonb, 1500, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch7","variant_by_branch":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('mcc_campaign_ch5', 'low_gravity_pocket', 'oxygen_supply_pressure', '{"permanent":true,"oxygen_supply_pressure":{"interval_sec":1800}}'::jsonb, '[600,900]'::jsonb),
  ('mcc_campaign_ch6', 'solar_radiation_storm', NULL, '{"duration_hours":36,"non_armored_drain":-1,"satellite_tracking":-80}'::jsonb, '[300]'::jsonb),
  ('mcc_campaign_ch7', 'dust_storm_season_peak', NULL, '{"optical":-40,"laser_range":-50,"missile":-15,"railgun":0,"satellite_tracking":-80}'::jsonb, '[500,1100]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
