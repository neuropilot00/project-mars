-- 192: Campaign foundation + MCC Ch1 "Oxygen Rush" MVP

CREATE TABLE IF NOT EXISTS campaign_chapters (
  quest_id VARCHAR(64) PRIMARY KEY,
  campaign_id VARCHAR(64) NOT NULL,
  chapter_number INT NOT NULL,
  faction VARCHAR(16),
  title_ko VARCHAR(120) NOT NULL,
  title_en VARCHAR(120),
  title_ja VARCHAR(120),
  title_zh VARCHAR(120),
  required_level INT DEFAULT 1,
  battle_resolution VARCHAR(32) DEFAULT 'server_simulation',
  estimated_play_time_seconds INT DEFAULT 840,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_reputation (
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  faction VARCHAR(16) NOT NULL,
  value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet, faction)
);

CREATE TABLE IF NOT EXISTS player_campaign_progress (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL REFERENCES campaign_chapters(quest_id),
  campaign_id VARCHAR(64) NOT NULL,
  chapter_number INT NOT NULL,
  session_id VARCHAR(80) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_progress','completed','failed','claimed')),
  battle_resolution VARCHAR(32) DEFAULT 'server_simulation',
  ng_plus_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  oxygen_recovery_pct DECIMAL(5,2),
  environmental_phase_reached INT DEFAULT 0,
  choices_payload JSONB DEFAULT '[]'::jsonb,
  metrics_payload JSONB DEFAULT '{}'::jsonb,
  outcome_payload JSONB DEFAULT '{}'::jsonb,
  rewards_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_progress_wallet ON player_campaign_progress(wallet, status);
CREATE INDEX IF NOT EXISTS idx_campaign_progress_session ON player_campaign_progress(session_id);

CREATE TABLE IF NOT EXISTS player_chapter_choices (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(80),
  choice_id VARCHAR(80) NOT NULL,
  chosen_at TIMESTAMPTZ DEFAULT NOW(),
  effects_applied JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_player_chapter_choices ON player_chapter_choices(wallet, quest_id, chosen_at DESC);

CREATE TABLE IF NOT EXISTS player_environment_mastery (
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  environment_type VARCHAR(40) NOT NULL,
  encounter_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  mastery_level INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet, environment_type)
);

CREATE TABLE IF NOT EXISTS player_tags (
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  tag_id VARCHAR(80) NOT NULL,
  source_quest_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet, tag_id)
);

CREATE TABLE IF NOT EXISTS player_lore_flags (
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  flag_id VARCHAR(80) NOT NULL,
  source_quest_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet, flag_id)
);

CREATE TABLE IF NOT EXISTS chapter_branch_modifiers (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  target_chapter VARCHAR(64) NOT NULL,
  modifier_key VARCHAR(80) NOT NULL,
  modifier_value JSONB DEFAULT '{}'::jsonb,
  source_quest_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet, target_chapter, modifier_key, source_quest_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_modifiers_target ON chapter_branch_modifiers(wallet, target_chapter);

CREATE TABLE IF NOT EXISTS campaign_reward_inbox (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL,
  reward_type VARCHAR(32) NOT NULL,
  reward_code VARCHAR(80) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  payload JSONB DEFAULT '{}'::jsonb,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_reward_inbox_wallet ON campaign_reward_inbox(wallet, claimed, created_at DESC);

INSERT INTO campaign_chapters (
  quest_id, campaign_id, chapter_number, faction,
  title_ko, title_en, title_ja, title_zh,
  required_level, battle_resolution, estimated_play_time_seconds, content
) VALUES (
  'mcc_campaign_ch1', 'mcc_route', 1, 'mcc',
  '산소 쟁탈', 'Oxygen Rush', '酸素争奪', '氧气争夺',
  1, 'server_simulation', 840,
  '{
    "location":{"id":"erebus_crater","displayNameKo":"에레부스 분화구 정제소 단지","region":"equator"},
    "environment":{"type":"dust_storm_incoming","durationSec":840,"warningAt":[280,560,750]},
    "dialog":["프로필 봤어. 첫 계약 환영해. 시간 짧아 — 본론.","Helion Dynamics가 내일 Erebus 정제소 7기 매각해. 화성 북반구 산소 41%.","Helion이 매각 직전 산소 850 kT 본사로 빼돌리는 중. 1,200만 명 일주일치.","호송 — 화물선 3, 호위 프리깃 6. 격파. 화물 손상 없이.","Dust Storm 5시간 58분 후 도래. 회수 못 하면 산소 폭풍 안에 사라져."],
    "choices":[
      {"id":"ch1_accept","labelKo":"이해했습니다. 시간 안에 끝내죠.","effects":{"reputationDelta":{}}},
      {"id":"ch1_moral_concern","labelKo":"산소 탱크 손상 시 정착지 동결 문제는?","effects":{"reputationDelta":{"fsp":2},"flag":"showed_concern_for_civilians"}},
      {"id":"ch1_tactical","labelKo":"Helion이 Dust Storm 알면 가속할 텐데요.","effects":{"reputationDelta":{"mcc":3},"flag":"tactical_thinker"}},
      {"id":"ch1_negotiate","labelKo":"보수 협상부터.","effects":{"reputationDelta":{"mcc":-2},"rewardModifier":{"creditsMaxBonus":8000}}}
    ],
    "rewards":{"base":{"GP":12000,"XP":500,"reputation":{"mcc":15,"fsp":-5}}}
  }'::jsonb
) ON CONFLICT (quest_id) DO UPDATE SET
  title_ko = EXCLUDED.title_ko,
  title_en = EXCLUDED.title_en,
  battle_resolution = EXCLUDED.battle_resolution,
  content = EXCLUDED.content,
  active = TRUE;
