-- 200: FSP Campaign Ch7~10 MVP seed data

ALTER TABLE item_definitions ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS chair_candidate_pool (
  chapter_id VARCHAR(40),
  candidate_id VARCHAR(40),
  candidate_class VARCHAR(40),
  base_support DECIMAL(3,2),
  enabled_when_expression TEXT,
  signature_speech_id VARCHAR(80),
  chair_outcome_modifier VARCHAR(80),
  ch10_ending_alignment VARCHAR(40),
  PRIMARY KEY (chapter_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS chair_candidate_support_modifiers (
  candidate_id VARCHAR(40),
  modifier_flag VARCHAR(80),
  delta DECIMAL(4,2),
  PRIMARY KEY (candidate_id, modifier_flag)
);

CREATE TABLE IF NOT EXISTS assembly_voter_pool (
  chapter_id VARCHAR(40),
  voter_id VARCHAR(80),
  seat_role VARCHAR(80),
  base_alignment_candidate VARCHAR(40),
  switchable_to_candidate VARCHAR(40),
  switch_requires_expression TEXT,
  vote_weight INT DEFAULT 1,
  conditional_unavailable_expression TEXT,
  PRIMARY KEY (chapter_id, voter_id)
);

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('assembly_session', '{"no_combat_zone":true,"speech_time_pool":1800,"vote_threshold_simple":6,"vote_threshold_super":8}'::jsonb, 'phased_session', '{"phases":["opening","floor_debate","coalition","vote_call","deadline"]}'::jsonb),
  ('dynamic_crisis', '{"crisis_variants_runtime":true,"escalation_curve":"phase_dependent"}'::jsonb, 'parallel_to_primary', '{"variants":["settlement_recovery","mcc_aftermath","cv_external_pressure","pilgrim_arms_intrusion"]}'::jsonb),
  ('civilian_donation_drive', '{"donation_pool_required":120000,"citizen_appeal":true}'::jsonb, 'triphase', '{"phases":["appeal","construction","defense"]}'::jsonb),
  ('shipyard_wave_defense', '{"waves":3,"gaia_hp_enabled":true}'::jsonb, 'wave_defense', '{"wave_starts":[600,1200,1500]}'::jsonb),
  ('neutral_summit', '{"no_combat_start":true,"delegates":["fsp","mcc","cv"]}'::jsonb, 'summit', '{"assault_phase_sec":900}'::jsonb),
  ('pilgrim_arms_assault', '{"fourth_faction_reveal":true,"assassin_squad":4}'::jsonb, 'burst_assault', '{"deadline_sec":1500}'::jsonb),
  ('fsp_ending_cinematic', '{"ending_evaluation":true,"no_combat_zone":true}'::jsonb, 'cinematic', '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO location_definitions (id, faction_control, region, altitude_km, ambient_temp, lore_state, population)
VALUES
  ('new_athens_shipyard', 'fsp', 'hellas_basin', -7, -64, 'gaia_construction_site', 2400),
  ('olympus_neutral_summit', 'neutral', 'olympus_mons', 3, -58, 'three_flags_summit_site', NULL),
  ('fsp_route_finale', 'neutral', 'mars', 0, -60, 'fsp_route_ending_space', NULL)
ON CONFLICT (id) DO UPDATE SET faction_control = EXCLUDED.faction_control, region = EXCLUDED.region, altitude_km = EXCLUDED.altitude_km, ambient_temp = EXCLUDED.ambient_temp, lore_state = EXCLUDED.lore_state, population = EXCLUDED.population;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled, role)
VALUES
  ('father_hale', 'neutral', 'fsp_campaign_ch9', TRUE, 'three_flags_mediator'),
  ('hagar_watanabe', 'fsp', 'fsp_campaign_ch8', TRUE, 'gaia_shipwright'),
  ('butcher_vasquez', 'cv', 'fsp_campaign_ch9', TRUE, 'cv_summit_delegate')
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, first_chapter_appearance = EXCLUDED.first_chapter_appearance, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled, role = EXCLUDED.role;

INSERT INTO chair_candidate_pool VALUES
  ('fsp_campaign_ch7', 'mikhail_anders', 'native_son', 0.40, 'mikhail_anders_alive', 'mikhail_speech_humble_warrior', 'assembly_practical_chair', 'ending_1_citizen'),
  ('fsp_campaign_ch7', 'liang_wei', 'visionary_scholar', 0.25, 'liang_wei_full_chair_candidate', 'liang_speech_commons_extension', 'assembly_visionary_chair', 'ending_2_peacemaker'),
  ('fsp_campaign_ch7', 'amara_okafor', 'established_leader', 0.30, 'amara_full_chair_candidate', 'amara_speech_three_flags_preview', 'assembly_diplomatic_chair', 'ending_2_peacemaker'),
  ('fsp_campaign_ch7', 'diego_cole', 'administrative_continuity', 0.10, 'diego_full_chair_candidate AND amara_okafor_alive', 'diego_speech_steady_hand', 'assembly_administrative_chair', 'ending_1_citizen'),
  ('fsp_campaign_ch7', 'player_self_run', 'outsider_revolutionary', 0.05, 'player_political_weight_high AND fsp_rep_gte_80 AND tea_ceremony_completed', 'player_speech_choose_one_of_3', 'assembly_player_chair', 'ending_4_new_chair')
ON CONFLICT (chapter_id, candidate_id) DO UPDATE SET candidate_class = EXCLUDED.candidate_class, base_support = EXCLUDED.base_support, enabled_when_expression = EXCLUDED.enabled_when_expression, signature_speech_id = EXCLUDED.signature_speech_id, chair_outcome_modifier = EXCLUDED.chair_outcome_modifier, ch10_ending_alignment = EXCLUDED.ch10_ending_alignment;

INSERT INTO chair_candidate_support_modifiers VALUES
  ('mikhail_anders','60_stayers_respected',0.10), ('mikhail_anders','assembly_fearful_atmosphere',0.05), ('mikhail_anders','settlement_damaged_starting_phase',0.15),
  ('liang_wei','liang_strong_chair_candidate',0.20), ('liang_wei','kepler_commons_treaty',0.15), ('liang_wei','ch5_global_disclosure',0.10),
  ('amara_okafor','kepler_commons_treaty',0.15), ('amara_okafor','external_alliance_cv',0.10), ('amara_okafor','assembly_legitimacy_destroyed',-0.20),
  ('diego_cole','amara_killed_at_kepler',0.20), ('player_self_run','master_investigator',0.15), ('player_self_run','crown_seeker',0.10)
ON CONFLICT (candidate_id, modifier_flag) DO UPDATE SET delta = EXCLUDED.delta;

INSERT INTO assembly_voter_pool VALUES
  ('fsp_campaign_ch7','lena_torres','militia_representative','mikhail_anders','player_self_run','60_stayers_respected AND master_investigator AND tea_ceremony_completed',1,NULL),
  ('fsp_campaign_ch7','yuna_kim','medical_representative','amara_okafor','liang_wei','humanitarian_aligned',1,'yuna_kim_killed_by_kenji OR yuna_kim_wrongly_executed'),
  ('fsp_campaign_ch7','samuel_torres','youth_militia','mikhail_anders','liang_wei','60_stayers_respected AND ch5_global_disclosure',1,'samuel_torres_wrongly_executed'),
  ('fsp_campaign_ch7','assembly_member_1_elder_kowalski','elder_native','mikhail_anders','diego_cole','conservative_alignment',1,NULL),
  ('fsp_campaign_ch7','assembly_member_2_doctor_chen','scientific_community','liang_wei','amara_okafor','diplomatic_alignment',1,NULL),
  ('fsp_campaign_ch7','assembly_member_3_farmer_olu','agricultural_collective','amara_okafor','mikhail_anders','environmental_crisis_priority',1,NULL),
  ('fsp_campaign_ch7','assembly_member_4_engineer_kim','infrastructure_workers','liang_wei','mikhail_anders','environmental_crisis_priority',1,NULL),
  ('fsp_campaign_ch7','assembly_member_5_trader_vasquez','external_trade_relations','amara_okafor','liang_wei','external_relations_aligned',1,NULL),
  ('fsp_campaign_ch7','assembly_member_6_youth_advocate','youth_council','liang_wei','player_self_run','master_investigator AND ch5_global_disclosure',1,NULL),
  ('fsp_campaign_ch7','assembly_member_7_miner_representative','mining_workers','liang_wei','mikhail_anders','miner_solidarity',1,NULL),
  ('fsp_campaign_ch7','assembly_member_8_water_council','water_distribution','mikhail_anders','diego_cole','caretaker_alignment',1,NULL)
ON CONFLICT (chapter_id, voter_id) DO UPDATE SET seat_role = EXCLUDED.seat_role, base_alignment_candidate = EXCLUDED.base_alignment_candidate, switchable_to_candidate = EXCLUDED.switchable_to_candidate, switch_requires_expression = EXCLUDED.switch_requires_expression, vote_weight = EXCLUDED.vote_weight, conditional_unavailable_expression = EXCLUDED.conditional_unavailable_expression;

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('ch7_mikhail_chair','FSP Ch7 Mikhail 의장','ch7_outcome','player'),
  ('ch7_liang_chair','FSP Ch7 Liang 의장','ch7_outcome','player'),
  ('ch7_amara_chair','FSP Ch7 Amara 의장','ch7_outcome','player'),
  ('ch7_diego_chair','FSP Ch7 Diego 의장','ch7_outcome','player'),
  ('ch7_player_chair','FSP Ch7 Player 의장','ch7_outcome','player'),
  ('ch7_assembly_deadlock','FSP Ch7 의회 교착','ch7_fail','player'),
  ('ch7_assembly_riot','FSP Ch7 의회 폭동','ch7_fail','player'),
  ('ch7_crisis_resolved','FSP Ch7 외곽 위기 해결','ch7_state','player'),
  ('ch7_crisis_unresolved','FSP Ch7 외곽 위기 미해결','ch7_state','player'),
  ('assembly_unanimity','FSP Ch7 만장일치급 의장 선출','ch7_mastery','player'),
  ('assembly_charter_amended_outsider_eligible','외부인 의장 헌장 개정','ch7_charter','player'),
  ('ch8_player_donated_personal','FSP Ch8 Player 개인 기부','ch8_choice','player'),
  ('ch8_player_pledged_combat','FSP Ch8 전투 상환 약속','ch8_choice','player'),
  ('ch8_player_silent','FSP Ch8 침묵','ch8_choice','player'),
  ('ch8_player_chose_theft','FSP Ch8 MCC 자금 절도 선택','ch8_choice','player'),
  ('ch8_mcc_theft_success','FSP Ch8 MCC 자금 절도 성공','ch8_outcome','player'),
  ('ch8_mcc_theft_detected','FSP Ch8 MCC 자금 절도 발각','ch8_fail','player'),
  ('ch8_gaia_completed','FSP Ch8 Gaia 완성','ch8_outcome','player'),
  ('ch8_gaia_completed_partial','FSP Ch8 Gaia 부분 완성','ch8_outcome','player'),
  ('ch8_gaia_construction_failed','FSP Ch8 Gaia 건조 실패','ch8_fail','player'),
  ('ch8_gaia_destroyed','FSP Ch8 Gaia 격침','ch8_fail','player'),
  ('gaia_full_specs','Gaia 완성 설계 확보','ch8_intel','player'),
  ('gaia_partial_specs','Gaia 부분 설계 확보','ch8_intel','player'),
  ('pilgrim_arms_seed_funded','Pilgrim Arms 자금 시드','ch8_dark_seed','player'),
  ('ch9_amara_protected','FSP Ch9 Amara 보호','ch9_choice','player'),
  ('ch9_chen_protected','FSP Ch9 Chen 보호','ch9_choice','player'),
  ('ch9_butcher_protected','FSP Ch9 Butcher 보호','ch9_choice','player'),
  ('ch9_full_retreat','FSP Ch9 전원 후퇴','ch9_choice','player'),
  ('ch9_chen_killed_by_player_signal','FSP Ch9 Player 신호로 Chen 사망','ch9_dark','player'),
  ('pilgrim_arms_publicly_known','Pilgrim Arms 공개 등장','ch9_world_state','player'),
  ('cross_route_pilgrim_arms_first_appearance','Pilgrim Arms 첫 등장','ch9_world_state','player'),
  ('pilgrim_arms_full_alignment','Pilgrim Arms와 완전 정렬','ch9_dark','player'),
  ('zero_casualty_summit','Three Flags 무사상 회담','ch9_mastery','player'),
  ('fsp_route_terminated_by_betrayal','FSP 루트 배신 종료','ch9_betrayal','player'),
  ('fsp_route_ch10_completed','FSP 루트 최종장 완료','ch10_outcome','player'),
  ('fsp_ending_1_citizen','FSP Ending 1 Citizen','ch10_ending','player'),
  ('fsp_ending_2_peacemaker','FSP Ending 2 Peacemaker','ch10_ending','player'),
  ('fsp_ending_2_alt_gaia_captain','FSP Ending 2 Alt Gaia Captain','ch10_ending','player'),
  ('fsp_ending_3_disillusioned','FSP Ending 3 Disillusioned','ch10_ending','player'),
  ('fsp_ending_4_new_chair','FSP Ending 4 New Chair','ch10_ending','player'),
  ('ch10_bad_ending_assigned','FSP Bad Ending','ch10_ending','player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('gaia_funding_pragmatic_drive','fsp_campaign_ch8','Mikhail 실용 의장 Gaia 펀딩 보정','{"AND":[{"flag":"ch7_mikhail_chair"}]}'::jsonb,'{"funding_buffer":0.1}'::jsonb),
  ('gaia_visionary_design_approved','fsp_campaign_ch8','Liang 비전 설계 승인','{"AND":[{"flag":"ch7_liang_chair"}]}'::jsonb,'{"tech_innovation_buffer":0.15}'::jsonb),
  ('gaia_funding_severely_compromised','fsp_campaign_ch8','의회 교착으로 Gaia 펀딩 악화','{"OR":[{"flag":"ch7_assembly_deadlock"},{"flag":"ch7_assembly_riot"}]}'::jsonb,'{"funding_buffer":-0.3}'::jsonb),
  ('three_flags_proactive_route','fsp_campaign_ch9','Amara 외교 의장 주도 정상회담','{"AND":[{"flag":"ch7_amara_chair"}]}'::jsonb,'{"summit_starts_advantageous":true}'::jsonb),
  ('liang_diplomatic_summit_attendance','fsp_campaign_ch9','Liang 정상회담 참석','{"AND":[{"flag":"ch7_liang_chair"}]}'::jsonb,'{"liang_voice_at_summit":true}'::jsonb),
  ('gaia_at_summit','fsp_campaign_ch9','Gaia 정상회담 출현','{"AND":[{"flag":"ch8_gaia_completed"}]}'::jsonb,'{"gaia_present":true}'::jsonb),
  ('gaia_at_summit_weakened','fsp_campaign_ch9','약화된 Gaia 정상회담 출현','{"AND":[{"flag":"ch8_gaia_completed_partial"}]}'::jsonb,'{"gaia_weakened":true}'::jsonb),
  ('no_gaia_at_summit','fsp_campaign_ch9','Gaia 없음','{"OR":[{"flag":"ch8_gaia_construction_failed"},{"flag":"ch8_gaia_destroyed"}]}'::jsonb,'{"gaia_present":false}'::jsonb),
  ('ending_1_pathway_aligned','fsp_campaign_ch10','Citizen ending 정렬','{"OR":[{"flag":"ch7_mikhail_chair"},{"flag":"ch7_diego_chair"}]}'::jsonb,'{"ending_1":true}'::jsonb),
  ('ending_2_pathway_aligned','fsp_campaign_ch10','Peacemaker ending 정렬','{"OR":[{"flag":"ch7_liang_chair"},{"flag":"ch7_amara_chair"},{"flag":"ch9_full_retreat"}]}'::jsonb,'{"ending_2":true}'::jsonb),
  ('ending_3_pathway_unlocked','fsp_campaign_ch10','Disillusioned ending 해금','{"AND":[{"flag":"ch7_assembly_deadlock"}]}'::jsonb,'{"ending_3":true}'::jsonb),
  ('ending_4_pathway_unlocked','fsp_campaign_ch10','New Chair ending 해금','{"AND":[{"flag":"ch7_player_chair"}]}'::jsonb,'{"ending_4":true}'::jsonb),
  ('ending_1_pathway_strengthened','fsp_campaign_ch10','Citizen ending 강화','{"AND":[{"flag":"ch8_player_donated_personal"}]}'::jsonb,'{"ending_1_strength":1}'::jsonb),
  ('ending_2_pathway_strengthened','fsp_campaign_ch10','Peacemaker ending 강화','{"AND":[{"flag":"ch8_player_pledged_combat"}]}'::jsonb,'{"ending_2_strength":1}'::jsonb),
  ('ending_4_pathway_strengthened','fsp_campaign_ch10','New Chair ending 강화','{"AND":[{"flag":"ch8_mcc_theft_success"}]}'::jsonb,'{"ending_4_strength":1}'::jsonb),
  ('ending_3_pathway_strengthened','fsp_campaign_ch10','Disillusioned ending 강화','{"OR":[{"flag":"ch8_player_silent"},{"flag":"ch8_gaia_construction_failed"}]}'::jsonb,'{"ending_3_strength":1}'::jsonb),
  ('ending_4_pathway_unavoidable','fsp_campaign_ch10','New Chair ending 강제','{"AND":[{"flag":"ch9_chen_killed_by_player_signal"}]}'::jsonb,'{"ending_4_forced":true}'::jsonb),
  ('ending_3_pathway_unavoidable','fsp_campaign_ch10','Disillusioned ending 강제','{"OR":[{"flag":"fsp_route_terminated_by_betrayal"},{"flag":"ch8_gaia_destroyed"}]}'::jsonb,'{"ending_3_forced":true}'::jsonb),
  ('ending_2_alt_path_cv_alliance','fsp_campaign_ch10','CV big-tent peacemaker 대안','{"AND":[{"flag":"ch9_butcher_protected"}]}'::jsonb,'{"ending_2_alt_cv":true}'::jsonb),
  ('gaia_captain_offer_unlocked','fsp_campaign_ch10','Gaia 함장 엔딩 조건','{"AND":[{"flag":"ch8_player_donated_personal"}]}'::jsonb,'{"gaia_captain_offer":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects) VALUES
  ('outsider_chair_aspirant','tag','tag.outsider_chair_aspirant.name','tag.outsider_chair_aspirant.desc',FALSE,FALSE,'{"ending_4_seed":true}'::jsonb),
  ('the_practical_leader','title','tag.the_practical_leader.name','tag.the_practical_leader.desc',FALSE,FALSE,'{"mikhail_dialog_warmer":true}'::jsonb),
  ('the_visionary_chair','title','tag.the_visionary_chair.name','tag.the_visionary_chair.desc',FALSE,FALSE,'{"liang_dialog_warmer":true}'::jsonb),
  ('the_diplomatic_chair','title','tag.the_diplomatic_chair.name','tag.the_diplomatic_chair.desc',FALSE,FALSE,'{"amara_dialog_warmer":true}'::jsonb),
  ('the_caretaker_chair','title','tag.the_caretaker_chair.name','tag.the_caretaker_chair.desc',FALSE,FALSE,'{"stability_buffer":true}'::jsonb),
  ('the_outsider_chair','title','tag.the_outsider_chair.name','tag.the_outsider_chair.desc',FALSE,FALSE,'{"civilian_distrust":true,"power":1}'::jsonb),
  ('crown_seeker','tag','tag.crown_seeker.name','tag.crown_seeker.desc',FALSE,FALSE,'{"ending_4_aligned":true}'::jsonb),
  ('master_legislator','title','tag.master_legislator.name','tag.master_legislator.desc',FALSE,FALSE,'{"political_reputation":true}'::jsonb),
  ('indecisive_settlement','tag','tag.indecisive_settlement.name','tag.indecisive_settlement.desc',TRUE,FALSE,'{"fsp_dialog_disappointed":true}'::jsonb),
  ('distracted_leader','tag','tag.distracted_leader.name','tag.distracted_leader.desc',TRUE,FALSE,'{"civilian_trust":-1}'::jsonb),
  ('riot_president','tag','tag.riot_president.name','tag.riot_president.desc',TRUE,FALSE,'{"civilian_morale_capped":50}'::jsonb),
  ('fsp_brotherhood','title','tag.fsp_brotherhood.name','tag.fsp_brotherhood.desc',FALSE,FALSE,'{"citizen_path":true}'::jsonb),
  ('the_humble_giver','title','tag.the_humble_giver.name','tag.the_humble_giver.desc',FALSE,FALSE,'{"citizen_path":true}'::jsonb),
  ('the_combat_pledger','title','tag.the_combat_pledger.name','tag.the_combat_pledger.desc',FALSE,FALSE,'{"protector_path":true}'::jsonb),
  ('master_protector','title','tag.master_protector.name','tag.master_protector.desc',FALSE,FALSE,'{"protector":true}'::jsonb),
  ('the_silent_one','tag','tag.the_silent_one.name','tag.the_silent_one.desc',TRUE,FALSE,'{"ending_3_aligned":true}'::jsonb),
  ('the_disengaged','tag','tag.the_disengaged.name','tag.the_disengaged.desc',TRUE,FALSE,'{"ending_3_aligned":true}'::jsonb),
  ('the_thief_with_purpose','title','tag.the_thief_with_purpose.name','tag.the_thief_with_purpose.desc',FALSE,FALSE,'{"ending_4_aligned":true}'::jsonb),
  ('the_funder','title','tag.the_funder.name','tag.the_funder.desc',FALSE,FALSE,'{"pilgrim_arms_seed":true}'::jsonb),
  ('the_failed_thief','tag','tag.the_failed_thief.name','tag.the_failed_thief.desc',TRUE,FALSE,'{"mcc_dialog_hostile":true}'::jsonb),
  ('failed_funder','tag','tag.failed_funder.name','tag.failed_funder.desc',TRUE,FALSE,'{"gaia_failed":true}'::jsonb),
  ('the_loyal_protector','title','tag.the_loyal_protector.name','tag.the_loyal_protector.desc',FALSE,FALSE,'{"fsp_dialog_warmer":true}'::jsonb),
  ('the_corporate_servant','tag','tag.the_corporate_servant.name','tag.the_corporate_servant.desc',TRUE,FALSE,'{"mcc_aligned":true}'::jsonb),
  ('fsp_route_betrayer','tag','tag.fsp_route_betrayer.name','tag.fsp_route_betrayer.desc',TRUE,FALSE,'{"fsp_exile":true}'::jsonb),
  ('the_unexpected_ally','title','tag.the_unexpected_ally.name','tag.the_unexpected_ally.desc',FALSE,FALSE,'{"cv_alliance":true}'::jsonb),
  ('the_indecisive_arbiter','tag','tag.the_indecisive_arbiter.name','tag.the_indecisive_arbiter.desc',TRUE,FALSE,'{"summit_postponed":true}'::jsonb),
  ('the_fourth_faction_emergent','title','tag.the_fourth_faction_emergent.name','tag.the_fourth_faction_emergent.desc',FALSE,FALSE,'{"ending_4_forced":true}'::jsonb),
  ('fourth_faction_slayer','title','tag.fourth_faction_slayer.name','tag.fourth_faction_slayer.desc',FALSE,FALSE,'{"assassin_hunter":true}'::jsonb),
  ('fsp_citizen_eternal','title','tag.fsp_citizen_eternal.name','tag.fsp_citizen_eternal.desc',FALSE,FALSE,'{"route_ending":1}'::jsonb),
  ('the_humble_giver_legacy','title','tag.the_humble_giver_legacy.name','tag.the_humble_giver_legacy.desc',FALSE,FALSE,'{"legacy":true}'::jsonb),
  ('the_peacemaker_eternal','title','tag.the_peacemaker_eternal.name','tag.the_peacemaker_eternal.desc',FALSE,FALSE,'{"route_ending":2}'::jsonb),
  ('master_diplomat','title','tag.master_diplomat.name','tag.master_diplomat.desc',FALSE,FALSE,'{"diplomacy":true}'::jsonb),
  ('gaia_first_captain_legendary','title','tag.gaia_first_captain_legendary.name','tag.gaia_first_captain_legendary.desc',FALSE,FALSE,'{"gaia_captain":true}'::jsonb),
  ('fsp_brotherhood_eternal','title','tag.fsp_brotherhood_eternal.name','tag.fsp_brotherhood_eternal.desc',FALSE,FALSE,'{"legacy":true}'::jsonb),
  ('the_drifter','title','tag.the_drifter.name','tag.the_drifter.desc',FALSE,FALSE,'{"route_ending":3}'::jsonb),
  ('the_disillusioned','tag','tag.the_disillusioned.name','tag.the_disillusioned.desc',TRUE,FALSE,'{"disillusioned":true}'::jsonb),
  ('the_fourth_faction_founder','title','tag.the_fourth_faction_founder.name','tag.the_fourth_faction_founder.desc',FALSE,FALSE,'{"route_ending":4}'::jsonb),
  ('ascendant_chair_eternal','title','tag.ascendant_chair_eternal.name','tag.ascendant_chair_eternal.desc',FALSE,FALSE,'{"dark_ending":true}'::jsonb),
  ('failed_arc','tag','tag.failed_arc.name','tag.failed_arc.desc',TRUE,FALSE,'{"bad_ending":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO item_definitions (id, type, persistent, stackable, description)
VALUES
  ('chair_seal','symbolic_item',TRUE,FALSE,'FSP chair seal'),
  ('liang_wei_chair_office_access','access_token',TRUE,FALSE,'Liang Wei chair office access'),
  ('pilgrim_arms_charter_seed','ending_seed',TRUE,FALSE,'Pilgrim Arms charter seed'),
  ('gaia_explorer_corvette','ship_blueprint',TRUE,FALSE,'Gaia explorer corvette blueprint'),
  ('gaia_combat_module','ship_module',TRUE,FALSE,'Gaia combat module'),
  ('hale_blessing_token','summit_token',TRUE,FALSE,'Father Hale blessing token'),
  ('fsp_route_completion_token','route_completion_token',TRUE,FALSE,'FSP route completion token')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, stackable = EXCLUDED.stackable, description = EXCLUDED.description;

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('fsp_campaign_ch7','fsp_route',7,'fsp','의회','Assembly',7,'political_dual_track',1800,'{"environment":{"type":"assembly_session","secondary":"dynamic_crisis"},"mechanic":"political_dual_track"}'::jsonb),
  ('fsp_campaign_ch8','fsp_route',8,'fsp','가이아','Gaia',8,'triphase_construction_defense',1800,'{"environment":{"type":"civilian_donation_drive","secondary":"shipyard_wave_defense"},"mechanic":"triphase_construction_defense"}'::jsonb),
  ('fsp_campaign_ch9','fsp_route',9,'fsp','세 개의 깃발','Three Flags',9,'summit_assault_choice',1800,'{"environment":{"type":"neutral_summit","secondary":"pilgrim_arms_assault"},"mechanic":"summit_assault_choice"}'::jsonb),
  ('fsp_campaign_ch10','fsp_route',10,'fsp','자유의 대가','Freedom''s Price',10,'ending_evaluation_and_cinematic',900,'{"environment":{"type":"fsp_ending_cinematic"},"mechanic":"ending_evaluation_and_cinematic"}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('fsp_campaign_ch7','fsp_route',7,'campaign.fsp.ch7.title','fsp_campaign_ch6',7,'{"fsp":50}'::jsonb,'["war_criminal"]'::jsonb,1800,'political_dual_track','{"seed":"service.CHAPTERS.fsp_campaign_ch7","mechanic":"political_dual_track"}'::jsonb),
  ('fsp_campaign_ch8','fsp_route',8,'campaign.fsp.ch8.title','fsp_campaign_ch7',8,'{"fsp":50}'::jsonb,'["war_criminal"]'::jsonb,1800,'triphase_construction_defense','{"seed":"service.CHAPTERS.fsp_campaign_ch8","mechanic":"triphase_construction_defense"}'::jsonb),
  ('fsp_campaign_ch9','fsp_route',9,'campaign.fsp.ch9.title','fsp_campaign_ch8',9,'{"fsp":50}'::jsonb,'["war_criminal"]'::jsonb,1800,'summit_assault_choice','{"seed":"service.CHAPTERS.fsp_campaign_ch9","mechanic":"summit_assault_choice"}'::jsonb),
  ('fsp_campaign_ch10','fsp_route',10,'campaign.fsp.ch10.title','fsp_campaign_ch9',10,'{"fsp":-100}'::jsonb,'["war_criminal"]'::jsonb,900,'ending_evaluation_and_cinematic','{"seed":"service.CHAPTERS.fsp_campaign_ch10","mechanic":"ending_evaluation_and_cinematic"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('fsp_campaign_ch7','assembly_session','dynamic_crisis','{"phases":[{"phase":0,"start":0,"session":"opening"},{"phase":1,"start":600,"session":"floor_debate"},{"phase":2,"start":1200,"session":"coalition"},{"phase":3,"start":1500,"session":"vote_call"},{"phase":4,"start":1800,"session":"deadline"}]}'::jsonb,'[600,1200,1500]'::jsonb),
  ('fsp_campaign_ch8','civilian_donation_drive','shipyard_wave_defense','{"phases":[{"phase":0,"start":0,"construction":0},{"phase":1,"start":600,"construction":30},{"phase":2,"start":1200,"construction":60},{"phase":3,"start":1500,"construction":90}]}'::jsonb,'[600,1200,1500]'::jsonb),
  ('fsp_campaign_ch9','neutral_summit','pilgrim_arms_assault','{"phases":[{"phase":0,"start":0,"summit":"opening"},{"phase":1,"start":900,"summit":"assault"},{"phase":2,"start":1500,"summit":"resolution"}]}'::jsonb,'[900,1500]'::jsonb),
  ('fsp_campaign_ch10','fsp_ending_cinematic',NULL,'{"phases":[{"phase":0,"start":0,"cinematic":"ending_evaluation"}]}'::jsonb,'[]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
