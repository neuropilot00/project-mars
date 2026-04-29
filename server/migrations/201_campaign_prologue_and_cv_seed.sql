-- ═══════════════════════════════════════════════════════════
-- 201: Campaign — 프롤로그 3종 + CV 루트 10챕터를 campaign_chapters 에 시드한다.
-- ═══════════════════════════════════════════════════════════
-- 배경: services/campaign.js 의 CHAPTERS 딕셔너리는 mcc_prologue / fsp_prologue /
-- cv_prologue 와 cv_campaign_ch1~10 을 정의하지만, campaign_chapters 테이블에는
-- 해당 row 가 없었다. player_campaign_progress.quest_id 가 campaign_chapters.quest_id
-- 를 FK 로 참조하기 때문에, 프롤로그 START 또는 CV 챕터 START 시 FK 위반이 일어나
-- INSERT 가 실패하고 라우트 핸들러가 500 ('Internal error') 를 반환했다.
--
-- 해결: 해당 챕터들을 campaign_chapters 에 시드한다. 모든 메타데이터는 서비스
-- 코드에 있으므로 여기서는 테이블 row 만 만들어 FK 를 만족시킨다.

INSERT INTO campaign_chapters (
  quest_id, campaign_id, chapter_number, faction,
  title_ko, title_en, required_level, battle_resolution,
  estimated_play_time_seconds, content
) VALUES
  -- Prologue (chapterNumber 0) — 시나리오 전용, 전투/선택지 없음.
  ('mcc_prologue', 'mcc_route', 0, 'mcc',
   '프롤로그: 카리오페호', 'Prologue: The Kariyope',
   1, 'none', 480,
   '{"location":{"id":"earth_to_mars_transit","displayNameKo":"지구-화성 화물 항로"}}'::jsonb),
  ('fsp_prologue', 'fsp_route', 0, 'fsp',
   '프롤로그: 카리오페호', 'Prologue: The Kariyope',
   1, 'none', 480,
   '{"location":{"id":"new_athens_settlement","displayNameKo":"New Athens 정착지"}}'::jsonb),
  ('cv_prologue', 'cv_route', 0, 'cv',
   '프롤로그: 카리오페호', 'Prologue: The Kariyope',
   1, 'none', 480,
   '{"location":{"id":"outer_colony_ruins","displayNameKo":"외곽 식민지 폐허"}}'::jsonb),
  -- CV 루트 — 10챕터 (메타만 시드, 시나리오/선택지/시뮬은 서비스 코드에 위임)
  ('cv_campaign_ch1',  'cv_route', 1,  'cv', '세례',                'Baptism',                        1,  'server_simulation', 900,  '{}'::jsonb),
  ('cv_campaign_ch2',  'cv_route', 2,  'cv', '약탈',                'The Raid',                       2,  'server_simulation', 1200, '{}'::jsonb),
  ('cv_campaign_ch3',  'cv_route', 3,  'cv', '광산왕',              'Mine King',                      3,  'server_simulation', 1500, '{}'::jsonb),
  ('cv_campaign_ch4',  'cv_route', 4,  'cv', '신더',                'Cinder',                         4,  'server_simulation', 1500, '{}'::jsonb),
  ('cv_campaign_ch5',  'cv_route', 5,  'cv', '케플러의 왕',         'King of Kepler',                 5,  'server_simulation', 1800, '{}'::jsonb),
  ('cv_campaign_ch6',  'cv_route', 6,  'cv', '30년',                'Thirty Years',                   6,  'server_simulation', 1500, '{}'::jsonb),
  ('cv_campaign_ch7',  'cv_route', 7,  'cv', '최후의 전쟁',         'The Last War',                   7,  'server_simulation', 2100, '{}'::jsonb),
  ('cv_campaign_ch8',  'cv_route', 8,  'cv', '붉은 의회 — CV',      'Red Parliament — CV',            8,  'server_simulation', 1800, '{}'::jsonb),
  ('cv_campaign_ch9',  'cv_route', 9,  'cv', '올림푸스의 밤',       'Olympus Night',                  9,  'server_simulation', 2100, '{}'::jsonb),
  ('cv_campaign_ch10', 'cv_route', 10, 'cv', '가시 면류관',         'The Thorn Crown',                10, 'server_simulation', 2400, '{}'::jsonb)
ON CONFLICT (quest_id) DO UPDATE SET
  title_ko = EXCLUDED.title_ko,
  title_en = EXCLUDED.title_en,
  battle_resolution = EXCLUDED.battle_resolution,
  active = TRUE;

INSERT INTO schema_migrations (filename) VALUES ('201_campaign_prologue_and_cv_seed.sql')
ON CONFLICT DO NOTHING;
