-- 199: FSP Campaign Ch5~6 seed data

ALTER TABLE location_definitions ADD COLUMN IF NOT EXISTS population INT;
ALTER TABLE npc_definitions ADD COLUMN IF NOT EXISTS role VARCHAR(80);
ALTER TABLE item_definitions ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS dead_drop_messages (
  id VARCHAR(80) PRIMARY KEY,
  sender_npc_id VARCHAR(80),
  recipient_npc_id VARCHAR(80),
  trigger_chapter VARCHAR(80),
  contents_json JSONB DEFAULT '{}'::jsonb,
  cross_route_unlock_flag VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS location_internal_zones (
  id VARCHAR(80) PRIMARY KEY,
  parent_location_id VARCHAR(80),
  zone_function TEXT,
  access_requirement TEXT
);

CREATE TABLE IF NOT EXISTS investigation_clue_pool (
  id VARCHAR(80) PRIMARY KEY,
  chapter_id VARCHAR(80),
  zone_id VARCHAR(80),
  type VARCHAR(60),
  reveals_text_key VARCHAR(80),
  access_method VARCHAR(120),
  points_to VARCHAR(80),
  conditional_expression TEXT,
  requires_advisor BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS clue_combination_rules (
  id VARCHAR(80) PRIMARY KEY,
  chapter_id VARCHAR(80),
  required_clues JSONB DEFAULT '[]'::jsonb,
  unlocks TEXT,
  effect TEXT
);

CREATE TABLE IF NOT EXISTS investigation_suspect_pool (
  chapter_id VARCHAR(80),
  npc_id VARCHAR(80),
  is_actual_culprit BOOLEAN,
  initial_suspicion NUMERIC(3,2),
  red_herring_clue_count INT,
  exoneration_combo_id VARCHAR(80),
  wrong_accusation_consequences_json JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (chapter_id, npc_id)
);

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('low_gravity_crater', '{"gravity_mod":-0.3,"agility":20,"momentum_decay":-30,"laser":-10,"railgun":15}'::jsonb, 'continuous', '{"altitude_km_below":-1}'::jsonb),
  ('oxygen_supply_critical', '{"oxygen_reserve_hours":24,"supply_eta_required":true}'::jsonb, 'countdown', '{"deadline_sec":1800,"failure":"crater_evacuation"}'::jsonb),
  ('settlement_interior', '{"no_combat_zone":true,"surveillance_mod":20,"investigation_enabled":true}'::jsonb, 'continuous', '{"internal_zones":5}'::jsonb),
  ('time_pressure_attack', '{"countdown_sec":1800,"jitter_sec":600,"civilian_panic_curve":"linear_to_60"}'::jsonb, 'countdown', '{"failure":"settlement_attacked_no_warning","success":"correct_culprit_identified"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO location_definitions (id, faction_control, region, altitude_km, ambient_temp, lore_state, population)
VALUES
  ('kepler_crater', 'disputed', 'arabia_terra', -3, -68, 'pilgrim_3_disappearance_site', NULL),
  ('hellas_central_settlement', 'fsp', 'hellas_basin', -7, -65, 'fsp_political_capital', 1800)
ON CONFLICT (id) DO UPDATE SET faction_control = EXCLUDED.faction_control, region = EXCLUDED.region, altitude_km = EXCLUDED.altitude_km, ambient_temp = EXCLUDED.ambient_temp, lore_state = EXCLUDED.lore_state, population = EXCLUDED.population;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled, role)
VALUES
  ('liang_wei', 'fsp', 'fsp_campaign_ch5', TRUE, 'mineralogist_commons_author'),
  ('kenji_tanaka', 'fsp_mcc_agent', 'fsp_campaign_ch6', TRUE, 'communication_relay_officer'),
  ('sarah_mendel', 'fsp', 'fsp_campaign_ch6', TRUE, 'communication_relay_officer_secondary'),
  ('diego_cole', 'fsp', 'fsp_campaign_ch6', TRUE, 'assembly_aide_to_amara')
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, first_chapter_appearance = EXCLUDED.first_chapter_appearance, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled, role = EXCLUDED.role;

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('ch5_commons_proposed', 'FSP Ch5 Commons 제안', 'ch5_outcome', 'player'),
  ('ch5_arbitration_proposed', 'FSP Ch5 중립 중재자 제안', 'ch5_outcome', 'player'),
  ('ch5_evidence_lever_used', 'FSP Ch5 Roth 데이터 압박 사용', 'ch5_outcome', 'player'),
  ('ch5_combat_forced_by_fsp', 'FSP Ch5 군사 점거 선택', 'ch5_outcome', 'player'),
  ('ch5_global_disclosure', 'FSP Ch5 외계 기원 즉시 공개', 'ch5_outcome', 'player'),
  ('liang_wei_legitimized', 'Liang Wei 정치적 정당성 확보', 'ch5_relation', 'player'),
  ('liang_wei_full_picture', 'Liang Wei가 Roth 데이터 전체 그림 확보', 'ch5_intel', 'player'),
  ('liang_wei_killed', 'Liang Wei 사망', 'ch5_critical_fail', 'player'),
  ('liang_wei_political_career_started', 'Liang Wei 정치 커리어 시작', 'ch5_relation', 'player'),
  ('amara_killed_at_kepler', 'Kepler 회담에서 Amara 사망', 'ch5_critical_fail', 'player'),
  ('kepler_commons_treaty', 'Kepler Commons 협정 성립', 'ch5_treaty', 'player'),
  ('kepler_militarily_held', 'Kepler 군사 점거', 'ch5_treaty', 'player'),
  ('kepler_evacuated_unresolved', 'Kepler 미해결 철수', 'ch5_failure', 'player'),
  ('summit_total_collapse', 'Kepler 회담 완전 붕괴', 'ch5_failure', 'player'),
  ('ancient_metal_origin_disclosed', 'Ancient Metal 외계 기원 공개', 'ch5_intel', 'player'),
  ('mcc_publicly_humiliated', 'MCC 공개 굴욕', 'ch5_intel', 'player'),
  ('alien_metal_publicly_known', '외계 금속 정보 전면 공개', 'ch5_world_state', 'player'),
  ('roth_legacy_keeper', 'Roth 유산 보관자', 'ch5_relation', 'player'),
  ('fsp_neutral_arbiter_recognized', 'FSP 중립 중재자 인정', 'ch5_treaty', 'player'),
  ('ch6_kenji_executed', 'Kenji 처형', 'ch6_outcome', 'player'),
  ('ch6_kenji_handler', 'Kenji 이중첩자 활용', 'ch6_outcome', 'player'),
  ('ch6_kenji_exiled', 'Kenji 추방', 'ch6_outcome', 'player'),
  ('ch6_wrong_culprit_accused', 'Ch6 무고한 용의자 지목', 'ch6_critical_fail', 'player'),
  ('ch6_time_expired', 'Ch6 시간 초과', 'ch6_critical_fail', 'player'),
  ('spy_executed_publicly', '두더지 공개 처형', 'ch6_relation', 'player'),
  ('spy_double_agent_active', '이중첩자 작전 활성', 'ch6_relation', 'player'),
  ('spy_exiled_mercifully', '두더지 인도주의적 추방', 'ch6_relation', 'player'),
  ('innocent_punished', '무고한 시민 처벌', 'ch6_critical_fail', 'player'),
  ('real_spy_at_large', '진짜 두더지 도주', 'ch6_critical_fail', 'player'),
  ('kenji_family_killed_in_retaliation', 'Kenji 가족 보복 사망', 'ch6_consequence', 'player'),
  ('kenji_full_truth', 'Kenji가 진실 공개', 'ch6_intel', 'player'),
  ('kenji_family_location_known', 'Kenji 가족 위치 확인', 'ch6_intel', 'player'),
  ('kenji_resigned', 'Kenji 체념 상태', 'ch6_state', 'player'),
  ('kenji_suicide_in_cell', 'Kenji 감방 자살', 'ch6_consequence', 'player'),
  ('master_investigator', '모든 단서 수집', 'ch6_mastery', 'player'),
  ('settlement_attacked_no_warning', '정착지 무경고 공격', 'ch6_state', 'player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('mcc_revenge_priority', 'fsp_campaign_ch9', 'Roth 데이터 압박으로 MCC 보복 우선순위 상승', '{"AND":[{"flag":"ch5_evidence_lever_used"}]}'::jsonb, '{"ch9_modifier":"mcc_assault_on_settlement","intensity":1.5}'::jsonb),
  ('martian_world_state_changed', 'fsp_campaign_ch9', '외계 기원 공개로 세계 상태 변경', '{"AND":[{"flag":"ch5_global_disclosure"}]}'::jsonb, '{"ch9_modifier":"un_intervention_threat","ch10_modifier":"alt_ending_disclosure_path"}'::jsonb),
  ('fsp_neutral_arbiter', 'fsp_campaign_ch9', 'FSP 중립 중재자 권위', '{"AND":[{"flag":"ch5_arbitration_proposed"}]}'::jsonb, '{"ch9_modifier":"tripartite_meeting_easier","ch10_modifier":"diplomatic_legitimacy"}'::jsonb),
  ('fsp_leadership_vacuum_severe', 'fsp_campaign_ch7', 'Kepler에서 Amara 사망으로 지도부 공백 심화', '{"AND":[{"flag":"amara_killed_at_kepler"}]}'::jsonb, '{"ch7_modifier":"assembly_no_chair","ch10_modifier":"alt_ending_required"}'::jsonb),
  ('commons_legitimacy_diplomatic', 'fsp_campaign_ch9', 'Commons 협정의 외교적 정당성', '{"AND":[{"flag":"kepler_commons_treaty"}]}'::jsonb, '{"reputation_buffer":15}'::jsonb),
  ('assembly_militarized_critique', 'fsp_campaign_ch7', 'Kepler 군사 점거 비판', '{"AND":[{"flag":"ch5_combat_forced_by_fsp"}]}'::jsonb, '{"assembly_militarized_critique":true}'::jsonb),
  ('mcc_full_offensive', 'fsp_campaign_ch9', 'Kepler 이후 MCC 전면 공세', '{"AND":[{"flag":"ch5_combat_forced_by_fsp"}]}'::jsonb, '{"mcc_full_offensive":true}'::jsonb),
  ('policy_line_weakened', 'fsp_campaign_ch7', 'Liang 사망으로 정책 라인 약화', '{"AND":[{"flag":"liang_wei_killed"}]}'::jsonb, '{"policy_line_weakened":true}'::jsonb),
  ('kepler_disputed_renewed_combat', 'fsp_campaign_ch9', 'Kepler 미해결로 재전투', '{"AND":[{"flag":"kepler_evacuated_unresolved"}]}'::jsonb, '{"kepler_status":"disputed"}'::jsonb),
  ('assembly_fearful_atmosphere', 'fsp_campaign_ch7', 'Kenji 처형으로 의회 분위기 경직', '{"AND":[{"flag":"ch6_kenji_executed"}]}'::jsonb, '{"civilian_morale_buffer":-15}'::jsonb),
  ('kenji_intelligence_pipeline', 'fsp_campaign_ch7', 'Kenji 이중첩자 정보 파이프라인', '{"AND":[{"flag":"ch6_kenji_handler"}]}'::jsonb, '{"disinfo_active_chapters":2}'::jsonb),
  ('kenji_family_rescue_attempt', 'fsp_campaign_ch9', 'Kenji 가족 구출 작전 분기', '{"AND":[{"flag":"ch6_kenji_handler"}]}'::jsonb, '{"unlocks_side_op":"ch9_kenji_family_rescue_op"}'::jsonb),
  ('handler_discovery_risk', 'fsp_campaign_ch9', '이중첩자 발각 위험', '{"AND":[{"flag":"ch6_kenji_handler"}]}'::jsonb, '{"risk_factor":"high"}'::jsonb),
  ('assembly_humanitarian_signal', 'fsp_campaign_ch7', 'Kenji 추방으로 인도주의 의회 톤', '{"AND":[{"flag":"ch6_kenji_exiled"}]}'::jsonb, '{"diplomatic_legitimacy_buffer":true}'::jsonb),
  ('no_intel_advantage', 'fsp_campaign_ch9', 'Kenji 추방으로 정보 우위 없음', '{"AND":[{"flag":"ch6_kenji_exiled"}]}'::jsonb, '{"no_intel_advantage":true}'::jsonb),
  ('assembly_loss_of_trust', 'fsp_campaign_ch7', '오판으로 의회 신뢰 하락', '{"AND":[{"flag":"ch6_wrong_culprit_accused"}]}'::jsonb, '{"reputation_buffer":-25}'::jsonb),
  ('real_spy_continues_leaks', 'fsp_campaign_ch9', '진짜 두더지가 계속 정보 유출', '{"AND":[{"flag":"real_spy_at_large"}]}'::jsonb, '{"real_spy_at_large":true}'::jsonb),
  ('settlement_damaged_no_warning', 'fsp_campaign_ch7', '무경고 공격으로 정착지 피해', '{"OR":[{"flag":"ch6_time_expired"},{"flag":"ch6_wrong_culprit_accused"}]}'::jsonb, '{"starting_morale":-20}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects) VALUES
  ('commons_architect', 'title', 'tag.commons_architect.name', 'tag.commons_architect.desc', FALSE, FALSE, '{"diplomatic_dialog_unlocks":true,"morality":15}'::jsonb),
  ('the_lever', 'tag', 'tag.the_lever.name', 'tag.the_lever.desc', TRUE, FALSE, '{"mcc_dialog_hostile":true,"morality":-5}'::jsonb),
  ('crater_baron', 'tag', 'tag.crater_baron.name', 'tag.crater_baron.desc', TRUE, FALSE, '{"diplomatic_reputation":-15,"morality":-10}'::jsonb),
  ('the_disclosurist', 'title', 'tag.the_disclosurist.name', 'tag.the_disclosurist.desc', FALSE, FALSE, '{"world_state_change":true,"morality":5}'::jsonb),
  ('civilian_protector', 'title', 'tag.civilian_protector.name', 'tag.civilian_protector.desc', FALSE, FALSE, '{"fsp_dialog_warmer":true,"morality":10}'::jsonb),
  ('failed_protector', 'tag', 'tag.failed_protector.name', 'tag.failed_protector.desc', TRUE, FALSE, '{"morality":-10}'::jsonb),
  ('coercive_executor', 'tag', 'tag.coercive_executor.name', 'tag.coercive_executor.desc', TRUE, FALSE, '{"morality":-10}'::jsonb),
  ('coercive_executor_extra', 'tag', 'tag.coercive_executor_extra.name', 'tag.coercive_executor_extra.desc', TRUE, FALSE, '{"morality":-15}'::jsonb),
  ('the_handler', 'title', 'tag.the_handler.name', 'tag.the_handler.desc', FALSE, FALSE, '{"intel_advantage":true,"risk_factor":"high"}'::jsonb),
  ('the_merciful', 'title', 'tag.the_merciful.name', 'tag.the_merciful.desc', FALSE, FALSE, '{"morality":10,"fsp_dialog_warmer":true}'::jsonb),
  ('paranoid_judge', 'tag', 'tag.paranoid_judge.name', 'tag.paranoid_judge.desc', TRUE, FALSE, '{"morality":-20,"fsp_dialog_cooler":true}'::jsonb),
  ('too_slow', 'tag', 'tag.too_slow.name', 'tag.too_slow.desc', TRUE, FALSE, '{"morality":-5}'::jsonb),
  ('thorough_judge', 'title', 'tag.thorough_judge.name', 'tag.thorough_judge.desc', FALSE, FALSE, '{"morality":15,"investigation_reputation":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO item_definitions (id, type, persistent, stackable, description)
VALUES
  ('scholar_corvette_blueprint', 'ship_blueprint', TRUE, FALSE, 'FSP Scholar Corvette blueprint'),
  ('ancient_metal', 'rare_resource', TRUE, TRUE, 'Ancient Metal resource'),
  ('investigator_corvette_blueprint', 'ship_blueprint', TRUE, FALSE, 'FSP Investigator Corvette blueprint'),
  ('mcc_attack_intel_full', 'consumable_intel', TRUE, FALSE, 'Full MCC attack intelligence'),
  ('mcc_attack_intel_minimal', 'consumable_intel', TRUE, FALSE, 'Minimal MCC attack intelligence'),
  ('kenji_handler_token', 'recurring_intel', TRUE, FALSE, 'Kenji double-agent handler token')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, stackable = EXCLUDED.stackable, description = EXCLUDED.description;

INSERT INTO dead_drop_messages (id, sender_npc_id, recipient_npc_id, trigger_chapter, contents_json, cross_route_unlock_flag)
VALUES
  ('roth_to_liang_wei_partial', 'dr_roth', 'liang_wei', 'fsp_campaign_ch5', '{"isotope_ratios":true,"sample_coordinates":3,"last_meeting":"li_fang"}'::jsonb, 'cross_route_dr_roth_data_obtained')
ON CONFLICT (id) DO UPDATE SET sender_npc_id = EXCLUDED.sender_npc_id, recipient_npc_id = EXCLUDED.recipient_npc_id, trigger_chapter = EXCLUDED.trigger_chapter, contents_json = EXCLUDED.contents_json, cross_route_unlock_flag = EXCLUDED.cross_route_unlock_flag;

INSERT INTO location_internal_zones (id, parent_location_id, zone_function, access_requirement)
VALUES
  ('hc_assembly_hall', 'hellas_central_settlement', '의회·심문·발표', 'liang_wei OR amara OR authenticated_citizen'),
  ('hc_communication_center', 'hellas_central_settlement', '통신 로그 분석', 'kenji_tanaka OR sarah_mendel OR investigator'),
  ('hc_powerplant', 'hellas_central_settlement', '발전소', 'powerplant_staff OR authenticated_engineer'),
  ('hc_hangar', 'hellas_central_settlement', '함선 출입 + 외부 통신 백업', 'hangar_staff OR lena_torres'),
  ('hc_residential_quarter', 'hellas_central_settlement', '시민 거주 + 증언 단서', 'public')
ON CONFLICT (id) DO UPDATE SET parent_location_id = EXCLUDED.parent_location_id, zone_function = EXCLUDED.zone_function, access_requirement = EXCLUDED.access_requirement;

INSERT INTO investigation_clue_pool (id, chapter_id, zone_id, type, reveals_text_key, access_method, points_to, conditional_expression, requires_advisor)
VALUES
  ('clue_powerplant_log', 'fsp_campaign_ch6', 'hc_powerplant', 'digital_log', 'ch6.clue.powerplant', 'lena_torres_assist', 'kenji_tanaka_alibi_weak', NULL, FALSE),
  ('clue_comm_center_door_log', 'fsp_campaign_ch6', 'hc_communication_center', 'physical_access_log', 'ch6.clue.door_log', 'liang_wei_assist OR self_investigation', 'kenji_tanaka_alibi_broken', NULL, TRUE),
  ('clue_outbound_signal', 'fsp_campaign_ch6', 'hc_communication_center', 'signal_trace', 'ch6.clue.outbound_signal', 'lena_torres_assist', 'information_leak_confirmed', NULL, FALSE),
  ('clue_kenji_family_photo', 'fsp_campaign_ch6', 'hc_residential_quarter', 'physical_evidence', 'ch6.clue.family_photo', 'warrant_or_yuna_witness', 'kenji_motive_family_hostage', NULL, FALSE),
  ('clue_sarah_vacation_request', 'fsp_campaign_ch6', 'hc_assembly_hall', 'paper_record', 'ch6.clue.sarah_vacation', 'diego_cole_provides', 'sarah_red_herring', NULL, FALSE),
  ('clue_yuna_medical_record', 'fsp_campaign_ch6', 'hc_residential_quarter', 'medical_record', 'ch6.clue.yuna_med', 'yuna_kim_provides', 'sarah_exoneration', 'yuna_kim_alive', FALSE),
  ('clue_diego_assembly_minutes', 'fsp_campaign_ch6', 'hc_assembly_hall', 'meeting_record', 'ch6.clue.diego_minutes', 'assembly_records_access', 'diego_exoneration', NULL, FALSE),
  ('clue_kenji_communication_history', 'fsp_campaign_ch6', 'hc_communication_center', 'archived_history', 'ch6.clue.kenji_pattern', 'liang_wei_assist + lena_torres_assist', 'kenji_pattern_systematic', NULL, TRUE),
  ('clue_kenji_mcc_credential_residue', 'fsp_campaign_ch6', 'hc_communication_center', 'digital_forensics', 'ch6.clue.credential_residue', 'liang_wei_full_picture_required OR roth_legacy_keeper', 'kenji_mcc_intelligence_ops', 'liang_wei_full_picture OR roth_legacy_keeper', TRUE)
ON CONFLICT (id) DO UPDATE SET chapter_id = EXCLUDED.chapter_id, zone_id = EXCLUDED.zone_id, type = EXCLUDED.type, reveals_text_key = EXCLUDED.reveals_text_key, access_method = EXCLUDED.access_method, points_to = EXCLUDED.points_to, conditional_expression = EXCLUDED.conditional_expression, requires_advisor = EXCLUDED.requires_advisor;

INSERT INTO clue_combination_rules (id, chapter_id, required_clues, unlocks, effect)
VALUES
  ('kenji_alibi_broken_combo', 'fsp_campaign_ch6', '["clue_powerplant_log","clue_comm_center_door_log","clue_outbound_signal"]'::jsonb, 'interrogation_scenario_kenji_pressured', NULL),
  ('kenji_motive_revealed', 'fsp_campaign_ch6', '["clue_kenji_family_photo"]'::jsonb, 'interrogation_branch_humanitarian', 'unlocks_choice:ch6_use_as_handler'),
  ('sarah_full_exoneration', 'fsp_campaign_ch6', '["clue_sarah_vacation_request","clue_yuna_medical_record"]'::jsonb, NULL, 'removes_suspect:sarah_mendel'),
  ('diego_full_exoneration', 'fsp_campaign_ch6', '["clue_diego_assembly_minutes"]'::jsonb, NULL, 'removes_suspect:diego_cole')
ON CONFLICT (id) DO UPDATE SET chapter_id = EXCLUDED.chapter_id, required_clues = EXCLUDED.required_clues, unlocks = EXCLUDED.unlocks, effect = EXCLUDED.effect;

INSERT INTO investigation_suspect_pool (chapter_id, npc_id, is_actual_culprit, initial_suspicion, red_herring_clue_count, exoneration_combo_id, wrong_accusation_consequences_json)
VALUES
  ('fsp_campaign_ch6', 'kenji_tanaka', TRUE, 0.30, 0, NULL, '{}'::jsonb),
  ('fsp_campaign_ch6', 'sarah_mendel', FALSE, 0.40, 3, 'sarah_full_exoneration', '{"flag":"innocent_punished","tag":"paranoid_judge","rep":-25}'::jsonb),
  ('fsp_campaign_ch6', 'diego_cole', FALSE, 0.35, 3, 'diego_full_exoneration', '{"flag":"innocent_punished","tag":"paranoid_judge","rep":-25}'::jsonb)
ON CONFLICT (chapter_id, npc_id) DO UPDATE SET is_actual_culprit = EXCLUDED.is_actual_culprit, initial_suspicion = EXCLUDED.initial_suspicion, red_herring_clue_count = EXCLUDED.red_herring_clue_count, exoneration_combo_id = EXCLUDED.exoneration_combo_id, wrong_accusation_consequences_json = EXCLUDED.wrong_accusation_consequences_json;

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('fsp_campaign_ch5', 'fsp_route', 5, 'fsp', 'Kepler 공유지', 'Kepler Commons', 5, 'server_simulation', 1800, '{"environment":{"type":"low_gravity_crater","secondary":"oxygen_supply_critical"},"conditional_combat":true}'::jsonb),
  ('fsp_campaign_ch6', 'fsp_route', 6, 'fsp', '두더지', 'The Mole', 6, 'server_simulation', 1800, '{"environment":{"type":"settlement_interior","secondary":"time_pressure_attack"},"investigation":true}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('fsp_campaign_ch5', 'fsp_route', 5, 'campaign.fsp.ch5.title', 'fsp_campaign_ch4', 5, '{"fsp":35}'::jsonb, '["war_criminal"]'::jsonb, 1800, 'server_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch5","conditional_combat":true}'::jsonb),
  ('fsp_campaign_ch6', 'fsp_route', 6, 'campaign.fsp.ch6.title', 'fsp_campaign_ch5', 6, '{"fsp":45}'::jsonb, '["war_criminal"]'::jsonb, 1800, 'server_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch6","investigation":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('fsp_campaign_ch5', 'low_gravity_crater', 'oxygen_supply_critical', '{"phases":[{"phase":0,"start":0,"gravity":-0.3,"oxygen_h":24},{"phase":1,"start":600,"oxygen_h":22},{"phase":2,"start":1200,"oxygen_h":18},{"phase":3,"start":1800,"oxygen_h":15}],"supply_window":{"deadline":1800}}'::jsonb, '[1200,1500]'::jsonb),
  ('fsp_campaign_ch6', 'settlement_interior', 'time_pressure_attack', '{"phases":[{"phase":0,"start":0,"panic":0},{"phase":1,"start":600,"panic":20},{"phase":2,"start":1200,"panic":40},{"phase":3,"start":1800,"panic":60}],"attack_window":{"base":1800,"jitter":600}}'::jsonb, '[1200,1500]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
