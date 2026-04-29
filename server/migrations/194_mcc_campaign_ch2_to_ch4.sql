-- 194: MCC Campaign Ch2~4 seed data

CREATE TABLE IF NOT EXISTS npc_definitions (
  id VARCHAR(80) PRIMARY KEY,
  faction VARCHAR(20),
  first_chapter_appearance VARCHAR(80),
  persistent_relationship_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lore_flag_definitions (id, description, category, scope) VALUES
  ('hellas_civilian_massacre', 'Ch2 민간인 사상 발생', 'event', 'player'),
  ('hellas_facility_lost', 'Ch2 시설 80% 미만', 'event', 'player'),
  ('hellas_facility_acquired', 'Ch2 시설 인수 성공', 'world_state', 'player'),
  ('warned_civilians_ch2', 'Ch2 광부 후퇴 경고', 'event', 'player'),
  ('requested_intel_ch2', 'Ch2 정보 요청', 'event', 'player'),
  ('chapter_refused', '캠페인 챕터 거부', 'event', 'player'),
  ('chose_helion_subsidiary', 'Ch3 Helion 선택', 'event', 'player'),
  ('chose_verin_subsidiary', 'Ch3 Verin 선택', 'event', 'player'),
  ('chose_chromium_subsidiary', 'Ch3 Chromium 선택', 'event', 'player'),
  ('helion_destroyed', 'Ch3 Helion 격파', 'world_state', 'player'),
  ('verin_destroyed', 'Ch3 Verin 격파', 'world_state', 'player'),
  ('chromium_destroyed', 'Ch3 Chromium 격파', 'world_state', 'player'),
  ('chen_first_meeting', 'Chen Weiss 첫 만남', 'event', 'player'),
  ('kara_likes_player', 'Ch4 Kara 호감', 'npc_state', 'player'),
  ('kara_strongly_likes_player', 'Ch4 Kara 강한 호감', 'npc_state', 'player'),
  ('lifang_distrust_player', 'Ch4 Li Fang 의심 시작', 'npc_state', 'player'),
  ('caused_negotiation_tension', 'Ch4 회담 긴장 유발', 'event', 'player'),
  ('lifang_dead', 'Li Fang 사망', 'event', 'player'),
  ('kara_dead', 'Kara Vex 사망', 'event', 'player'),
  ('ch4_intel_leaked', 'Ch4 정보 누설', 'event', 'player'),
  ('ch4_meeting_exposed', 'Ch4 회담 노출', 'event', 'player'),
  ('kara_personal_channel_unlocked', 'Kara 개인 채널 해금', 'world_state', 'player')
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects) VALUES
  ('mcc_route_termination_offered', 'mcc_campaign_ch3', 'Ch2 거부 시 Ch3에서 마지막 기회', '{"AND":[{"flag":"chapter_refused"}]}'::jsonb, '{"ch3_briefing_variant":"termination_warning","available_choices_filter":["accept_or_quit"]}'::jsonb),
  ('ch2_war_criminal_status', 'any_fsp', 'Ch2 민간인 피해로 FSP 루트 차단', '{"AND":[{"tag":"war_criminal"}]}'::jsonb, '{"fsp_route_access":"locked","cv_route_access":"bonus"}'::jsonb),
  ('ch6_chen_invitation', 'mcc_campaign_ch6', 'Helion 격파 시 비밀 회의 초대', '{"AND":[{"flag":"helion_destroyed"}]}'::jsonb, '{"ch6_briefing_variant":"secret_meeting_invited","additional_choice":"ch6_attend_secret_meeting"}'::jsonb),
  ('ch7_chen_distrust', 'mcc_campaign_ch7', 'Chromium 격파 시 Chen이 의심', '{"AND":[{"flag":"chromium_destroyed"}]}'::jsonb, '{"chen_dialog_variant":"distrustful","chen_surveillance_active":true,"ch7_difficulty_modifier":1.15}'::jsonb),
  ('ch10_kara_loyalty', 'mcc_campaign_ch10', 'Ch4 Kara 호감 시 Ch10 충성 변경 가능', '{"OR":[{"flag":"kara_likes_player"},{"flag":"kara_strongly_likes_player"}]}'::jsonb, '{"ch10_kara_can_switch_sides":true,"ch10_kara_dialog":"friendly_variant"}'::jsonb),
  ('ch9_kara_hostile', 'mcc_campaign_ch9', 'Ch4 Kara 호감 0 시 Ch9 적으로', '{"AND":[{"NOT":{"flag":"kara_likes_player"}},{"NOT":{"flag":"kara_strongly_likes_player"}}]}'::jsonb, '{"ch9_kara_appears_as_enemy":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  target_chapter = EXCLUDED.target_chapter,
  description = EXCLUDED.description,
  activation_conditions = EXCLUDED.activation_conditions,
  effects = EXCLUDED.effects;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('clean_operator', 'title', 'tag.clean_operator.name', 'tag.clean_operator.desc', FALSE, FALSE, '{"mcc_chapter_bonus":{"reward_modifier":0.03}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  display_name_key = EXCLUDED.display_name_key,
  description_key = EXCLUDED.description_key,
  is_negative = EXCLUDED.is_negative,
  removable = EXCLUDED.removable,
  effects = EXCLUDED.effects;

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('night_freezing', '{"propulsion":-15,"evasion":-20,"external_hp_drain_per_min":0.5}'::jsonb, 'continuous', '{"temperature_c":-95,"region":"hellas_basin"}'::jsonb),
  ('low_gravity_minor', '{"ship_maneuverability":8,"projectile_accuracy_long_range":-8}'::jsonb, 'continuous', '{"minor":true}'::jsonb),
  ('phobos_eclipse_periodic', '{"optical_tracking":"disabled","missile_advantage":20,"laser_charging":"paused"}'::jsonb, 'periodic', '{"cycle_seconds":1800,"eclipse_duration_sec":30,"eclipses_per_cycle":3}'::jsonb),
  ('ion_storm_active', '{"fleet_command_mode":"disabled","radar_accuracy":-60,"emp_effect_bonus":50,"comm_blackout":true,"player_ship_manual_only":true}'::jsonb, 'continuous', '{"duration_sec":1080}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  base_effects = EXCLUDED.base_effects,
  pattern_type = EXCLUDED.pattern_type,
  pattern_params = EXCLUDED.pattern_params;

INSERT INTO campaign_chapters (
  quest_id, campaign_id, chapter_number, faction, title_ko, title_en,
  required_level, battle_resolution, estimated_play_time_seconds, content
) VALUES
  ('mcc_campaign_ch2', 'mcc_route', 2, 'mcc', '동결된 고속도로', 'Frozen Highway', 2, 'server_simulation', 1800, '{"location":{"id":"hellas_north_mining_outpost","displayNameKo":"Hellas 북부 수소 채굴장"},"environment":{"type":"night_freezing"}}'::jsonb),
  ('mcc_campaign_ch3', 'mcc_route', 3, 'mcc', '이사회', 'Boardroom', 3, 'server_simulation', 1800, '{"location":{"id":"olympus_shareholder7","displayNameKo":"Shareholder-7 궤도 스테이션"},"environment":{"type":"phobos_eclipse_periodic"}}'::jsonb),
  ('mcc_campaign_ch4', 'mcc_route', 4, 'mcc', '해적 매수', 'Pirate''s Payroll', 4, 'server_simulation', 1080, '{"location":{"id":"red_dust_station","displayNameKo":"Red Dust 정거장"},"environment":{"type":"ion_storm_active"}}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET
  title_ko = EXCLUDED.title_ko,
  title_en = EXCLUDED.title_en,
  required_level = EXCLUDED.required_level,
  battle_resolution = EXCLUDED.battle_resolution,
  estimated_play_time_seconds = EXCLUDED.estimated_play_time_seconds,
  content = EXCLUDED.content,
  active = TRUE;

INSERT INTO chapters (id, campaign_id, chapter_number, title_key, prerequisite_chapter, required_level, required_reputation, blocking_tags, estimated_duration_seconds, battle_resolution_mode, scenario_data)
VALUES
  ('mcc_campaign_ch2', 'mcc_route', 2, 'campaign.mcc.ch2.title', 'mcc_campaign_ch1', 2, '{"mcc":10}'::jsonb, '["war_criminal"]'::jsonb, 1800, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch2"}'::jsonb),
  ('mcc_campaign_ch3', 'mcc_route', 3, 'campaign.mcc.ch3.title', 'mcc_campaign_ch2', 3, '{"mcc":25}'::jsonb, '[]'::jsonb, 1800, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch3"}'::jsonb),
  ('mcc_campaign_ch4', 'mcc_route', 4, 'campaign.mcc.ch4.title', 'mcc_campaign_ch3', 4, '{"mcc":30}'::jsonb, '[]'::jsonb, 1080, 'mvp_simulation', '{"seed":"service.CHAPTERS.mcc_campaign_ch4"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  campaign_id = EXCLUDED.campaign_id,
  chapter_number = EXCLUDED.chapter_number,
  title_key = EXCLUDED.title_key,
  prerequisite_chapter = EXCLUDED.prerequisite_chapter,
  required_level = EXCLUDED.required_level,
  required_reputation = EXCLUDED.required_reputation,
  blocking_tags = EXCLUDED.blocking_tags,
  estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
  battle_resolution_mode = EXCLUDED.battle_resolution_mode,
  scenario_data = EXCLUDED.scenario_data,
  is_active = TRUE;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, secondary_env_type, intensity_curve, ui_warning_seconds)
VALUES
  ('mcc_campaign_ch2', 'night_freezing', 'low_gravity_minor', '[{"phase":0,"startSec":0,"propulsionMod":0,"evasionMod":0},{"phase":1,"startSec":600,"propulsionMod":-10,"evasionMod":-15},{"phase":2,"startSec":1200,"propulsionMod":-15,"evasionMod":-20},{"phase":3,"startSec":1800,"hpDrainPerMin":0.5}]'::jsonb, '[600,1200,1500]'::jsonb),
  ('mcc_campaign_ch3', 'phobos_eclipse_periodic', NULL, '[{"phase":0,"startSec":0},{"phase":1,"startSec":600,"opticalTracking":"disabled","missileAdvantage":20},{"phase":2,"startSec":1200,"opticalTracking":"disabled","missileAdvantage":20},{"phase":3,"startSec":1800,"opticalTracking":"disabled","missileAdvantage":20}]'::jsonb, '[600,1200,1800]'::jsonb),
  ('mcc_campaign_ch4', 'ion_storm_active', NULL, '[{"phase":0,"startSec":0,"fleetCommandMode":"disabled","radarAccuracy":-60,"empEffectBonus":50}]'::jsonb, '[360,720,1000]'::jsonb)
ON CONFLICT (chapter_id) DO UPDATE SET
  primary_env_type = EXCLUDED.primary_env_type,
  secondary_env_type = EXCLUDED.secondary_env_type,
  intensity_curve = EXCLUDED.intensity_curve,
  ui_warning_seconds = EXCLUDED.ui_warning_seconds;

INSERT INTO npc_definitions (id, faction, first_chapter_appearance, persistent_relationship_enabled)
VALUES
  ('chen_weiss', 'mcc', 'mcc_campaign_ch3', TRUE),
  ('kara_vex', 'cv', 'mcc_campaign_ch4', TRUE)
ON CONFLICT (id) DO UPDATE SET
  faction = EXCLUDED.faction,
  first_chapter_appearance = EXCLUDED.first_chapter_appearance,
  persistent_relationship_enabled = EXCLUDED.persistent_relationship_enabled;
