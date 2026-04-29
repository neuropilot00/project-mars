-- 198: FSP Campaign Ch4 Diplomacy seed data

CREATE TABLE IF NOT EXISTS location_definitions (
  id VARCHAR(80) PRIMARY KEY,
  faction_control VARCHAR(40),
  region VARCHAR(80),
  altitude_km NUMERIC(8,2),
  ambient_temp NUMERIC(8,2),
  lore_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_definitions (
  id VARCHAR(80) PRIMARY KEY,
  type VARCHAR(60),
  persistent BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('subterranean_dust', '{"optical":-50,"comm_range":-80,"weapons_unaffected":["point_defense"],"detection_modifier":-40}'::jsonb, 'continuous', '{"led_light_dependency":true}'::jsonb),
  ('equatorial_phobos_pattern', '{"eclipse_frequency":"high","shadow_escape_possible":true}'::jsonb, 'periodic', '{"region":"equatorial_belt","escape_window":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET base_effects = EXCLUDED.base_effects, pattern_type = EXCLUDED.pattern_type, pattern_params = EXCLUDED.pattern_params;

INSERT INTO location_definitions (id, faction_control, region, altitude_km, ambient_temp, lore_state)
VALUES
  ('sandstone_junction', 'neutral_grey_zone', 'equatorial_belt', 1.2, -42, 'abandoned_post_first_collapse')
ON CONFLICT (id) DO UPDATE SET faction_control = EXCLUDED.faction_control, region = EXCLUDED.region, altitude_km = EXCLUDED.altitude_km, ambient_temp = EXCLUDED.ambient_temp, lore_state = EXCLUDED.lore_state;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled)
VALUES
  ('cinder_grace', 'cv', 'fsp_campaign_ch4', TRUE)
ON CONFLICT (id) DO UPDATE SET faction = EXCLUDED.faction, first_chapter_appearance = EXCLUDED.first_chapter_appearance, persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled;

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('pact_settlement_refuge_offered', 'FSP Ch4 정착지 피난소 제공', 'event', 'player'),
  ('pact_supply_share_offered', 'FSP Ch4 보급 공유 제공', 'event', 'player'),
  ('pact_intel_exchange_only', 'FSP Ch4 정보 교환만 합의', 'event', 'player'),
  ('pact_evidence_shared_with_cv', 'FSP Ch4 산소 노예제 증거 공유', 'event', 'player'),
  ('negotiation_walked_away', 'FSP Ch4 협상 중단', 'event', 'player'),
  ('cinder_grace_alliance_strong', 'Cinder Grace 강한 동맹', 'npc_state', 'player'),
  ('cinder_grace_alliance_modest', 'Cinder Grace 제한 동맹', 'npc_state', 'player'),
  ('cinder_grace_alliance_weak', 'Cinder Grace 약한 정보 합의', 'npc_state', 'player'),
  ('cinder_grace_alliance_blood_oath', 'Cinder Grace 혈맹', 'npc_state', 'player'),
  ('cinder_grace_alliance_failed', 'Cinder Grace 협상 실패', 'npc_state', 'player'),
  ('amara_killed_at_sandstone', 'Sandstone Junction에서 Amara 사망', 'event', 'player'),
  ('ch4_mcc_engagement_occurred', 'FSP Ch4 MCC 정찰 교전 발생', 'event', 'player'),
  ('phobos_navigator', 'Phobos 그늘 항로 탈출 성공', 'event', 'player')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category, scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('mcc_oxygen_slavery_evidence_obtained', 'fsp_campaign_ch4', 'FSP Ch3 공식 작전으로 확보한 Helion 산소 노예제 증거', '{"AND":[{"flag":"official_op_chosen"}]}'::jsonb, '{"leverage_mcc_evidence":true}'::jsonb),
  ('fsp_cv_truce_active', 'fsp_campaign_ch5', 'Cinder와 강한 휴전으로 Kepler에서 CV 중립/협력', '{"OR":[{"flag":"pact_settlement_refuge_offered"},{"flag":"pact_evidence_shared_with_cv"}]}'::jsonb, '{"cv_attitude":"allied","ch5_modifier":"cv_neutral_at_kepler","ch7_modifier":"cv_intel_assist_assembly"}'::jsonb),
  ('fsp_cv_truce_modest', 'fsp_campaign_ch5', 'Cinder와 제한 휴전', '{"AND":[{"flag":"pact_supply_share_offered"}]}'::jsonb, '{"cv_attitude":"passive","ch5_modifier":"cv_passive_at_kepler"}'::jsonb),
  ('cv_active_alliance', 'fsp_campaign_ch5', '산소 노예제 증거 공유로 CV 혈맹', '{"AND":[{"flag":"pact_evidence_shared_with_cv"}]}'::jsonb, '{"cv_attitude":"blood_oath","ch5_modifier":"cv_active_alliance_at_kepler","ch7_modifier":"cv_combat_assist_assembly","ch9_modifier":"mcc_targets_fsp_priority"}'::jsonb),
  ('bonus_mcc_intel', 'fsp_campaign_ch6', '정보 교환으로 Mole 추리 보너스', '{"AND":[{"flag":"pact_intel_exchange_only"}]}'::jsonb, '{"mole_investigation_bonus":true}'::jsonb),
  ('cinder_warlord_hostile', 'fsp_campaign_ch5', '협상 실패로 Cinder 적대', '{"OR":[{"flag":"negotiation_walked_away"},{"flag":"amara_killed_at_sandstone"}]}'::jsonb, '{"cv_attitude":"hostile","ch5_modifier":"cv_hostile_at_kepler","ch7_modifier":"cv_assault_assembly"}'::jsonb),
  ('fsp_leadership_vacuum', 'fsp_campaign_ch5', 'Amara 사망으로 FSP 지도부 공백', '{"AND":[{"flag":"amara_killed_at_sandstone"}]}'::jsonb, '{"effect":"no_chair_available","ch7_modifier":"assembly_no_chair","ch10_modifier":"alt_ending_required"}'::jsonb),
  ('assembly_no_chair', 'fsp_campaign_ch7', 'Amara 사망으로 의장 부재', '{"AND":[{"flag":"amara_killed_at_sandstone"}]}'::jsonb, '{"assembly_no_chair":true}'::jsonb),
  ('cv_intel_assist_assembly', 'fsp_campaign_ch7', 'Cinder 정보 지원으로 Assembly 챕터에서 CV 정보 보조', '{"AND":[{"flag":"cinder_grace_alliance_strong"}]}'::jsonb, '{"cv_intel_assist":true}'::jsonb),
  ('mcc_targets_fsp_priority', 'fsp_campaign_ch9', 'CV 혈맹 이후 MCC가 FSP를 우선 보복 대상으로 지정', '{"AND":[{"flag":"cinder_grace_alliance_blood_oath"}]}'::jsonb, '{"mcc_retaliation_priority":"fsp"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET target_chapter = EXCLUDED.target_chapter, description = EXCLUDED.description, activation_conditions = EXCLUDED.activation_conditions, effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('pacifist_envoy', 'title', 'tag.pacifist_envoy.name', 'tag.pacifist_envoy.desc', FALSE, FALSE, '{"diplomatic_dialog_unlocks":true,"morality":5}'::jsonb),
  ('diplomatic_disaster', 'tag', 'tag.diplomatic_disaster.name', 'tag.diplomatic_disaster.desc', TRUE, FALSE, '{"fsp_dialog_cooler":true,"morality":-15}'::jsonb)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, display_name_key = EXCLUDED.display_name_key, description_key = EXCLUDED.description_key, is_negative = EXCLUDED.is_negative, removable = EXCLUDED.removable, effects = EXCLUDED.effects;

INSERT INTO item_definitions (id, type, persistent, description)
VALUES
  ('shadow_frigate_blueprint', 'ship_blueprint', TRUE, 'FSP Shadow Frigate blueprint'),
  ('cv_intel_packet', 'consumable_intel', TRUE, 'Cinder Grace CV intel packet'),
  ('mcc_internal_memo_fragment', 'consumable_intel', TRUE, 'MCC internal memo fragment'),
  ('cinder_grace_blood_oath_token', 'npc_summon_token', TRUE, 'Cinder Grace blood oath token'),
  ('diplomatic_credentials', 'permanent_modifier', TRUE, 'FSP diplomatic credentials')
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, persistent = EXCLUDED.persistent, description = EXCLUDED.description;

INSERT INTO campaign_chapters (quest_id, campaign_id, chapter_number, faction, title_ko, title_en, required_level, battle_resolution, estimated_play_time_seconds, content)
VALUES
  ('fsp_campaign_ch4', 'fsp_route', 4, 'fsp', '외교', 'Diplomacy', 4, 'server_simulation', 1500, '{"environment":{"type":"subterranean_dust","secondary":"equatorial_phobos_pattern"},"conditional_combat":true}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET title_ko = EXCLUDED.title_ko, title_en = EXCLUDED.title_en, required_level = EXCLUDED.required_level, battle_resolution = EXCLUDED.battle_resolution, estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds, content = EXCLUDED.content, active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('fsp_campaign_ch4', 'fsp_route', 4, 'campaign.fsp.ch4.title', 'fsp_campaign_ch3', 4, '{"fsp":25}'::jsonb, '["war_criminal"]'::jsonb, 1500, 'server_simulation', '{"seed":"service.CHAPTERS.fsp_campaign_ch4","conditional_combat":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET campaign_id = EXCLUDED.campaign_id, chapter_number = EXCLUDED.chapter_number, title_key = EXCLUDED.title_key, prerequisite_chapter = EXCLUDED.prerequisite_chapter, required_level = EXCLUDED.required_level, required_reputation = EXCLUDED.required_reputation, blocking_tags = EXCLUDED.blocking_tags, estimated_duration_seconds = EXCLUDED.estimated_duration_seconds, battle_resolution_mode = EXCLUDED.battle_resolution_mode, scenario_data = EXCLUDED.scenario_data, is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('fsp_campaign_ch4', 'subterranean_dust', 'equatorial_phobos_pattern', '{"phases":[{"phase":0,"start":0,"optical":-50,"comm":-80,"detection":-40}],"mcc_recon_window":{"base":1080,"jitter":180}}'::jsonb, '[900,1080]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET primary_env_type = EXCLUDED.primary_env_type, secondary_env_type = EXCLUDED.secondary_env_type, intensity_curve = EXCLUDED.intensity_curve, ui_warning_seconds = EXCLUDED.ui_warning_seconds;
