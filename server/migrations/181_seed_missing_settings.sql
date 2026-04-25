-- ═══════════════════════════════════════════════════
-- 181: 누락된 settings 키 일괄 시드
-- ═══════════════════════════════════════════════════
-- 13개 서비스가 getSetting()으로 키를 읽지만 settings 테이블에 시드되지
-- 않아 항상 코드 default fallback 사용 중. 이는 CLAUDE.md "No Hardcoding"
-- 원칙 위반.
--
-- 모든 키를 시드해서 admin이 admin.html에서 조정할 수 있게 함.
-- 값은 서비스 코드의 기존 default와 동일 → 동작 변화 0, 단지 admin이 만질 수 있게 됨.

BEGIN;

-- ── prestige (Colony, 플레이어 단위) ───────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('prestige', 'prestige_enabled',         'true',                                                  'Colony Prestige (플레이어 랭크) 활성화'),
  ('prestige', 'prestige_cost_gp',         '50',                                                    '랭크 1포인트 구매 GP 비용'),
  ('prestige', 'prestige_points_per_buy',  '1',                                                     '1회 구매 시 획득 포인트'),
  ('prestige', 'prestige_rank_thresholds', '"0,10,30,75,175,400"',                                  '랭크별 포인트 임계값 (콤마 구분)'),
  ('prestige', 'prestige_rank_names',      '"Colonist,Pioneer,Explorer,Commander,Governor,Admiral"','랭크 이름'),
  ('prestige', 'prestige_rank_icons',      '"🪨,⛺,🔭,🚀,🏛️,⭐"',                                  '랭크 아이콘'),
  ('prestige', 'prestige_rank_colors',     '"#9e9e9e,#66bb6a,#42a5f5,#ab47bc,#ffa726,#ef5350"',     '랭크 색상')
ON CONFLICT (key) DO NOTHING;

-- ── news (행성 뉴스 피드) ────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('news', 'news_enabled',           'true', '행성 뉴스 피드 활성화'),
  ('news', 'news_lottery_enabled',   'true', '복권 결과 뉴스 표시'),
  ('news', 'news_battle_enabled',    'true', '주요 전투 뉴스 표시'),
  ('news', 'news_min_trade_gp',      '100',  '뉴스 노출 최소 거래액 (GP)'),
  ('news', 'news_achievement_epic',  'true', '에픽/레전더리 업적 뉴스'),
  ('news', 'news_min_transfer_gp',   '500',  '뉴스 노출 최소 송금액 (GP)'),
  ('news', 'news_max_items',         '50',   '피드에 표시할 최대 뉴스 수'),
  ('news', 'news_retention_days',    '30',   '뉴스 자동 삭제 일수')
ON CONFLICT (key) DO NOTHING;

-- ── branding (영토 브랜딩) ───────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('branding', 'branding_enabled',           'true', '영토 브랜딩 활성화'),
  ('branding', 'branding_name_cost_gp',      '50',   '영토 이름 변경 GP'),
  ('branding', 'branding_tagline_cost_gp',   '25',   '태그라인 변경 GP'),
  ('branding', 'branding_color_cost_gp',     '100',  '테마 컬러 변경 GP'),
  ('branding', 'branding_update_cost_gp',    '15',   '기타 필드 변경 GP'),
  ('branding', 'branding_max_name_length',   '24',   '영토 이름 최대 글자수'),
  ('branding', 'branding_max_tagline_length','60',   '태그라인 최대 글자수')
ON CONFLICT (key) DO NOTHING;

-- ── tdesc (영토 설명) ────────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('tdesc', 'tdesc_enabled',   'true', '영토 설명 기능 활성화'),
  ('tdesc', 'tdesc_first_gp',  '0',    '첫 설명 작성 비용 (무료=0)'),
  ('tdesc', 'tdesc_change_gp', '30',   '설명 변경 GP 비용'),
  ('tdesc', 'tdesc_max_length','200',  '설명 최대 글자수'),
  ('tdesc', 'tdesc_cooldown_h','12',   '변경 쿨다운 (시간)')
ON CONFLICT (key) DO NOTHING;

-- ── tiers (영토 티어 — Bronze~Diamond, territory_tiers 테이블) ────
INSERT INTO settings (category, key, value, description) VALUES
  ('tiers', 'tier_enabled',           'true',                       '영토 티어 시스템 활성화'),
  ('tiers', 'tier_names',             '"Bronze,Silver,Gold,Platinum,Diamond"', '티어 이름'),
  ('tiers', 'tier_icons',             '"🥉,🥈,🥇,💠,💎"',           '티어 아이콘'),
  ('tiers', 'tier_costs_gp',          '"100,300,800,2000,5000"',    '티어 업그레이드 GP 비용'),
  ('tiers', 'tier_mining_bonus_pct',  '"0,10,25,50,100"',           '티어별 채굴 보너스 %'),
  ('tiers', 'tier_pixel_bonus_pct',   '"0,5,15,30,60"',             '티어별 픽셀 보너스 %'),
  ('tiers', 'tier_max',               '5',                          '최대 티어'),
  ('tiers', 'tier_per_wallet_max',    '0',                          '플레이어별 최대 티어 영토 수 (0=무제한)')
ON CONFLICT (key) DO NOTHING;

-- ── donation (기부 월드) ────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('donation', 'donation_enabled',        'true', '기부 시스템 활성화'),
  ('donation', 'donation_min_gp',         '10',   '최소 기부액 GP'),
  ('donation', 'donation_max_gp',         '0',    '최대 기부액 GP (0=무제한)'),
  ('donation', 'donation_max_msg_length', '80',   '메시지 최대 글자수'),
  ('donation', 'donation_wall_size',      '50',   '월에 표시할 최대 항목'),
  ('donation', 'donation_top_donors',     '10',   '랭킹 표시 인원')
ON CONFLICT (key) DO NOTHING;

-- ── capsule (타임 캡슐) ──────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('capsule', 'capsule_enabled',        'true', '타임 캡슐 활성화'),
  ('capsule', 'capsule_cost_gp',        '35',   '캡슐 작성 GP'),
  ('capsule', 'capsule_max_length',     '280',  '메시지 최대 글자수'),
  ('capsule', 'capsule_min_days',       '1',    '최소 보관 일수'),
  ('capsule', 'capsule_max_days',       '365',  '최대 보관 일수'),
  ('capsule', 'capsule_max_per_wallet', '5',    '플레이어별 동시 보관 가능 수'),
  ('capsule', 'capsule_visible_count',  '20',   '공개 목록 표시 수')
ON CONFLICT (key) DO NOTHING;

-- ── sponsor (영토 스폰서) ────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('sponsor', 'sponsor_enabled',           'true', '영토 스폰서 활성화'),
  ('sponsor', 'sponsor_cost_gp',           '50',   '스폰서 등록 GP'),
  ('sponsor', 'sponsor_duration_h',        '24',   '스폰서 노출 시간'),
  ('sponsor', 'sponsor_max_msg_length',    '60',   '메시지 최대 글자수'),
  ('sponsor', 'sponsor_max_per_territory', '3',    '영토별 동시 스폰서 수'),
  ('sponsor', 'sponsor_cooldown_h',        '0',    '같은 플레이어 쿨다운 (0=없음)')
ON CONFLICT (key) DO NOTHING;

-- ── beacon (맵 비콘) ─────────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('beacon', 'beacon_enabled',         'true',                            '비콘 시스템 활성화'),
  ('beacon', 'beacon_cost_gp',         '30',                              '비콘 등록 GP'),
  ('beacon', 'beacon_duration_h',      '4',                               '노출 시간'),
  ('beacon', 'beacon_max_length',      '60',                              '메시지 최대 글자수'),
  ('beacon', 'beacon_max_active_map',  '20',                              '맵 전체 동시 비콘 수'),
  ('beacon', 'beacon_max_per_wallet',  '2',                               '플레이어별 동시 비콘 수'),
  ('beacon', 'beacon_cooldown_h',      '1',                               '재등록 쿨다운'),
  ('beacon', 'beacon_icons',           '"📡,🔥,⭐,🚀,💎,🌟,⚡,🏴,🎯,🛰️"', '선택 가능 아이콘')
ON CONFLICT (key) DO NOTHING;

-- ── status (플레이어 상태 메시지) ────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('status', 'status_enabled',        'true', '상태 메시지 활성화'),
  ('status', 'status_cost_gp',        '20',   '상태 등록 GP'),
  ('status', 'status_duration_h',     '24',   '기본 노출 시간'),
  ('status', 'status_max_length',     '60',   '메시지 최대 글자수'),
  ('status', 'status_max_duration_h', '168',  '최대 노출 시간 (1주)'),
  ('status', 'status_renewal_disc',   '0',    '갱신 할인 % (0=할인없음)')
ON CONFLICT (key) DO NOTHING;

-- ── tevt (영토 이벤트 — mining_rush, harvest_festival, beacon_pulse, fortify_surge, tax_holiday) ───
INSERT INTO settings (category, key, value, description) VALUES
  ('tevt', 'tevt_enabled',                  'true', '영토 이벤트 시스템 활성화'),
  ('tevt', 'tevt_max_concurrent',           '1',    '영토당 동시 진행 이벤트 수'),
  ('tevt', 'tevt_cooldown_h',               '1',    '이벤트 종료 후 쿨다운'),
  ('tevt', 'tevt_mining_rush_gp',           '80',   'Mining Rush GP 비용'),
  ('tevt', 'tevt_mining_rush_h',            '2',    'Mining Rush 지속 시간'),
  ('tevt', 'tevt_mining_rush_bonus_pct',    '75',   'Mining Rush 채굴 보너스 %'),
  ('tevt', 'tevt_harvest_festival_gp',      '60',   'Harvest Festival GP 비용'),
  ('tevt', 'tevt_harvest_festival_h',       '3',    'Harvest Festival 지속 시간'),
  ('tevt', 'tevt_beacon_pulse_gp',          '40',   'Beacon Pulse GP 비용'),
  ('tevt', 'tevt_beacon_pulse_h',           '4',    'Beacon Pulse 지속 시간'),
  ('tevt', 'tevt_fortify_surge_gp',         '100',  'Fortify Surge GP 비용'),
  ('tevt', 'tevt_fortify_surge_h',          '2',    'Fortify Surge 지속 시간'),
  ('tevt', 'tevt_tax_holiday_gp',           '50',   'Tax Holiday GP 비용'),
  ('tevt', 'tevt_tax_holiday_h',            '6',    'Tax Holiday 지속 시간')
ON CONFLICT (key) DO NOTHING;

-- ── polls (커뮤니티 투표) ─────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('polls', 'poll_enabled',          'true', '투표 시스템 활성화'),
  ('polls', 'poll_cost_gp',          '40',   '투표 생성 GP'),
  ('polls', 'poll_min_options',      '2',    '최소 선택지'),
  ('polls', 'poll_max_options',      '6',    '최대 선택지'),
  ('polls', 'poll_max_question_len', '200',  '질문 최대 글자수'),
  ('polls', 'poll_max_duration_h',   '168',  '최대 진행 시간 (1주)'),
  ('polls', 'poll_min_duration_h',   '1',    '최소 진행 시간'),
  ('polls', 'poll_max_active',       '10',   '동시 진행 가능 투표 수'),
  ('polls', 'poll_cooldown_h',       '2',    '재생성 쿨다운')
ON CONFLICT (key) DO NOTHING;

-- ── wager (베팅) ─────────────────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('wager', 'wager_enabled',        'true', '베팅 시스템 활성화'),
  ('wager', 'wager_house_cut_pct',  '10',   '플랫폼 수수료 %'),
  ('wager', 'wager_min_bet_gp',     '10',   '최소 베팅액'),
  ('wager', 'wager_max_bet_gp',     '0',    '최대 베팅액 (0=무제한)'),
  ('wager', 'wager_auto_lock',      'true', '시작 시간 도래 시 자동 잠금')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('181_seed_missing_settings.sql')
ON CONFLICT DO NOTHING;

COMMIT;
