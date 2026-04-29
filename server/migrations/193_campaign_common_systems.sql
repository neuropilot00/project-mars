-- 193: Campaign common systems foundation

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(40) PRIMARY KEY,
  faction VARCHAR(16),
  title_key VARCHAR(80),
  description_key VARCHAR(80),
  total_chapters INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT FALSE,
  unlock_conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR(64) PRIMARY KEY,
  campaign_id VARCHAR(40) REFERENCES campaigns(id),
  chapter_number INT NOT NULL,
  title_key VARCHAR(80),
  prerequisite_chapter VARCHAR(64),
  required_level INT DEFAULT 1,
  required_reputation JSONB DEFAULT '{}'::jsonb,
  blocking_tags JSONB DEFAULT '[]'::jsonb,
  estimated_duration_seconds INT,
  battle_resolution_mode VARCHAR(32) DEFAULT 'mvp_simulation',
  scenario_data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapters_campaign_order ON chapters(campaign_id, chapter_number);

CREATE TABLE IF NOT EXISTS campaign_sessions (
  session_id VARCHAR(80) PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  chapter_id VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  current_metrics JSONB DEFAULT '{}'::jsonb,
  random_seed BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','expired','abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sessions_wallet_status ON campaign_sessions(wallet, status);

ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS best_metrics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE player_campaign_progress ADD COLUMN IF NOT EXISTS last_metrics JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS reputation_history (
  id BIGSERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  faction VARCHAR(20) NOT NULL,
  delta INT NOT NULL,
  before_value INT NOT NULL DEFAULT 0,
  after_value INT NOT NULL DEFAULT 0,
  source_type VARCHAR(40),
  source_id VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_history_wallet_time ON reputation_history(wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS tag_definitions (
  id VARCHAR(80) PRIMARY KEY,
  category VARCHAR(32) NOT NULL DEFAULT 'tag',
  display_name_key VARCHAR(80),
  description_key VARCHAR(80),
  icon_url VARCHAR(255),
  is_visible_to_player BOOLEAN DEFAULT TRUE,
  is_negative BOOLEAN DEFAULT FALSE,
  removable BOOLEAN DEFAULT FALSE,
  effects JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_tags ADD COLUMN IF NOT EXISTS acquired_from VARCHAR(80);
ALTER TABLE player_tags ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS player_active_title (
  wallet VARCHAR(42) PRIMARY KEY REFERENCES users(wallet_address) ON DELETE CASCADE,
  title_tag_id VARCHAR(80) REFERENCES tag_definitions(id),
  set_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lore_flag_definitions (
  id VARCHAR(80) PRIMARY KEY,
  description TEXT,
  category VARCHAR(40),
  scope VARCHAR(20) DEFAULT 'player',
  is_reversible BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_lore_flags ADD COLUMN IF NOT EXISTS source_chapter VARCHAR(80);
ALTER TABLE player_lore_flags ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS global_lore_flags (
  flag_id VARCHAR(80) PRIMARY KEY,
  set_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS branch_modifier_definitions (
  id VARCHAR(80) PRIMARY KEY,
  target_chapter VARCHAR(80) NOT NULL,
  description TEXT,
  activation_conditions JSONB DEFAULT '{}'::jsonb,
  effects JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_branch_modifiers (
  id BIGSERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  modifier_id VARCHAR(80) NOT NULL,
  target_chapter VARCHAR(80) NOT NULL,
  source_chapter VARCHAR(80),
  set_at TIMESTAMPTZ DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  UNIQUE(wallet, modifier_id, target_chapter, source_chapter)
);

CREATE INDEX IF NOT EXISTS idx_player_branch_modifiers_target ON player_branch_modifiers(wallet, target_chapter, consumed_at);

CREATE TABLE IF NOT EXISTS environment_definitions (
  id VARCHAR(40) PRIMARY KEY,
  base_effects JSONB DEFAULT '{}'::jsonb,
  pattern_type VARCHAR(20) DEFAULT 'continuous',
  pattern_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapter_environment_configs (
  chapter_id VARCHAR(64) PRIMARY KEY,
  primary_env_type VARCHAR(40) REFERENCES environment_definitions(id),
  secondary_env_type VARCHAR(40),
  intensity_curve JSONB DEFAULT '[]'::jsonb,
  ui_warning_seconds JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campaigns (id, faction, title_key, description_key, total_chapters)
VALUES
  ('mcc_route', 'mcc', 'campaign.mcc.title', 'campaign.mcc.description', 10),
  ('fsp_route', 'fsp', 'campaign.fsp.title', 'campaign.fsp.description', 10),
  ('cv_route', 'cv', 'campaign.cv.title', 'campaign.cv.description', 10),
  ('observer_route', 'observer', 'campaign.observer.title', 'campaign.observer.description', 5)
ON CONFLICT (id) DO UPDATE SET
  faction = EXCLUDED.faction,
  title_key = EXCLUDED.title_key,
  description_key = EXCLUDED.description_key,
  total_chapters = EXCLUDED.total_chapters;

INSERT INTO chapters (
  id, campaign_id, chapter_number, title_key, prerequisite_chapter,
  required_level, required_reputation, blocking_tags,
  estimated_duration_seconds, battle_resolution_mode, scenario_data
) VALUES (
  'mcc_campaign_ch1', 'mcc_route', 1, 'campaign.mcc.ch1.title', NULL,
  1, '{"mcc":0}'::jsonb, '[]'::jsonb,
  840, 'mvp_simulation',
  '{"source":"campaign_chapters","chapter":"mcc_campaign_ch1"}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  campaign_id = EXCLUDED.campaign_id,
  chapter_number = EXCLUDED.chapter_number,
  title_key = EXCLUDED.title_key,
  required_level = EXCLUDED.required_level,
  battle_resolution_mode = EXCLUDED.battle_resolution_mode,
  is_active = TRUE;

INSERT INTO tag_definitions (id, category, display_name_key, description_key, is_negative, removable, effects)
VALUES
  ('cold_death', 'war_status', 'tag.cold_death.name', 'tag.cold_death.desc', TRUE, FALSE, '{"fsp_settlement_access":"restricted","reputation_decay":{"fsp":0.5}}'::jsonb),
  ('efficient_operator', 'title', 'tag.efficient_operator.name', 'tag.efficient_operator.desc', FALSE, FALSE, '{"mcc_chapter_bonus":{"reward_modifier":0.05}}'::jsonb),
  ('war_criminal', 'war_status', 'tag.war_criminal.name', 'tag.war_criminal.desc', TRUE, FALSE, '{"fsp_route_access":"locked","cv_recruitment_unlocked":true}'::jsonb),
  ('whistleblower', 'title', 'tag.whistleblower.name', 'tag.whistleblower.desc', FALSE, FALSE, '{"federal_government_access":true}'::jsonb),
  ('the_traitor', 'title', 'tag.the_traitor.name', 'tag.the_traitor.desc', FALSE, FALSE, '{"pilgrim_arms_access":true}'::jsonb),
  ('lifesaver', 'title', 'tag.lifesaver.name', 'tag.lifesaver.desc', FALSE, FALSE, '{"fsp_dialog_warmer":true}'::jsonb),
  ('titan_killer', 'title', 'tag.titan_killer.name', 'tag.titan_killer.desc', FALSE, FALSE, '{"cv_recruitment_bonus":10}'::jsonb),
  ('peacemaker', 'title', 'tag.peacemaker.name', 'tag.peacemaker.desc', FALSE, FALSE, '{"all_factions_min_neutral":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  display_name_key = EXCLUDED.display_name_key,
  description_key = EXCLUDED.description_key,
  is_negative = EXCLUDED.is_negative,
  removable = EXCLUDED.removable,
  effects = EXCLUDED.effects;

INSERT INTO lore_flag_definitions (id, description, category, scope, is_reversible)
VALUES
  ('cold_sister_frozen', 'MCC Ch1 실패로 Cold Sister 정착지 동결', 'event', 'player', FALSE),
  ('oxygen_lost_to_storm', 'MCC Ch1 산소 호송이 폭풍에 소실됨', 'event', 'player', FALSE),
  ('lifang_personal_arc_unlocked', 'Li Fang 개인 서사 arc 해금', 'npc_state', 'player', FALSE),
  ('dr_roth_data_obtained', 'Dr. Elias Roth의 외계 기원 데이터 확보', 'event', 'player', FALSE),
  ('dr_roth_data_published', 'Roth 데이터가 화성 전체에 공개됨', 'world_state', 'player', FALSE),
  ('prometheus_completed', 'MCC Titan Prometheus 건조 완료', 'world_state', 'player', FALSE),
  ('prometheus_destroyed', 'Prometheus 건조 중 파괴', 'world_state', 'player', FALSE),
  ('chen_assassinated', 'Chen Weiss 사망', 'event', 'player', FALSE),
  ('amara_dead', 'Amara Okafor 사망', 'event', 'player', FALSE),
  ('butcher_dead', 'Butcher Vasquez 사망', 'event', 'player', FALSE),
  ('pilgrim_arms_revealed', 'Pilgrim Arms 4번째 파벌 정체 공개', 'world_state', 'player', FALSE)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  is_reversible = EXCLUDED.is_reversible;

INSERT INTO branch_modifier_definitions (id, target_chapter, description, activation_conditions, effects)
VALUES
  ('chen_distrust_increased', 'mcc_ch6', 'Cold Sister 실패 이후 Chen 불신 증가', '{"tag":"cold_death"}'::jsonb, '{"chen_dialog_variant":"distrustful","difficulty_modifier":1.1}'::jsonb),
  ('ch7_chen_distrust_active', 'mcc_ch7', 'Ch7 Chen distrust branch', '{"AND":[{"tag":"cold_death"},{"OR":[{"lore_flag":"lifang_betrayed"},{"reputation":{"faction":"mcc","lt":50}}]}]}'::jsonb, '{"chen_dialog_variant":"distrustful","blocked_choices":["ch7_diplomatic"],"difficulty_modifier":1.2}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  target_chapter = EXCLUDED.target_chapter,
  description = EXCLUDED.description,
  activation_conditions = EXCLUDED.activation_conditions,
  effects = EXCLUDED.effects;

INSERT INTO environment_definitions (id, base_effects, pattern_type, pattern_params)
VALUES
  ('dust_storm', '{"optical_accuracy":-40,"laser_range":-50,"missile_accuracy":-15,"railgun_accuracy":0,"visual_obstruction":"high","cargo_speed":-30}'::jsonb, 'continuous', '{"regions":["equator"],"season":["spring"]}'::jsonb),
  ('dust_storm_incoming', '{"optical_accuracy":0,"laser_range":0,"missile_accuracy":0,"railgun_accuracy":0,"visual_obstruction":"rising","cargo_speed":0}'::jsonb, 'continuous', '{"base":"dust_storm"}'::jsonb),
  ('phobos_eclipse', '{"optical_tracking":"disabled","missile_advantage":20,"laser_charging":"paused"}'::jsonb, 'periodic', '{"duration_sec":30,"period_min":30}'::jsonb),
  ('solar_radiation', '{"non_armored_hp_drain_per_min":-1,"armored_hp_drain":0,"crew_casualty_buildup":true,"comm_interference":10}'::jsonb, 'continuous', '{"duration_hours":[12,48]}'::jsonb),
  ('ion_storm', '{"fleet_command_mode":"disabled","radar_accuracy":-60,"emp_effect_bonus":50,"comm_blackout":true}'::jsonb, 'random', '{"duration_minutes":[5,20]}'::jsonb),
  ('low_gravity', '{"ship_maneuverability":20,"projectile_accuracy_long_range":-25,"melee_weapon_advantage":20}'::jsonb, 'continuous', '{"regions":["kepler_crater","valles_marineris"],"permanent":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  base_effects = EXCLUDED.base_effects,
  pattern_type = EXCLUDED.pattern_type,
  pattern_params = EXCLUDED.pattern_params;

INSERT INTO chapter_environment_configs (chapter_id, primary_env_type, intensity_curve, ui_warning_seconds)
VALUES (
  'mcc_campaign_ch1',
  'dust_storm_incoming',
  '[
    {"phase":0,"startSec":0,"accuracyMod":0,"rangeMod":0},
    {"phase":1,"startSec":280,"accuracyMod":-10,"rangeMod":0},
    {"phase":2,"startSec":560,"accuracyMod":-25,"rangeMod":-20},
    {"phase":3,"startSec":750,"accuracyMod":-40,"rangeMod":-50}
  ]'::jsonb,
  '[280,560,750]'::jsonb
) ON CONFLICT (chapter_id) DO UPDATE SET
  primary_env_type = EXCLUDED.primary_env_type,
  intensity_curve = EXCLUDED.intensity_curve,
  ui_warning_seconds = EXCLUDED.ui_warning_seconds;
