-- ═══════════════════════════════════════════════════
-- 183: Achievements 확장 — 추가 업적 + 다국어 (JA/ZH) + cosmetic/enhancement 종류
-- ═══════════════════════════════════════════════════
-- 기존 14개 업적의 ja/zh 번역 + 새 카테고리 (cosmetic_count, enhancement_count,
-- max_enhancement_level) 14개 추가. 총 28개 업적 시드.

BEGIN;

-- ── 기존 14개에 ja/zh 추가 ──
UPDATE achievements SET name_ja = '初めの一歩',         name_zh = '第一步'         WHERE key = 'first_claim';
UPDATE achievements SET name_ja = '入植者',              name_zh = '定居者'         WHERE key = 'claim_10';
UPDATE achievements SET name_ja = '植民者',              name_zh = '殖民者'         WHERE key = 'claim_50';
UPDATE achievements SET name_ja = '帝国の建設者',        name_zh = '帝国缔造者'     WHERE key = 'claim_100';
UPDATE achievements SET name_ja = '船長',                name_zh = '船长'           WHERE key = 'first_ship';
UPDATE achievements SET name_ja = '提督',                name_zh = '舰队司令'       WHERE key = 'ship_fleet_10';
UPDATE achievements SET name_ja = '戦士',                name_zh = '战士'           WHERE key = 'battle_winner';
UPDATE achievements SET name_ja = 'チャンピオン',        name_zh = '冠军'           WHERE key = 'battle_10_wins';
UPDATE achievements SET name_ja = '投資家',              name_zh = '投资者'         WHERE key = 'gp_1000';
UPDATE achievements SET name_ja = '大富豪',              name_zh = '大亨'           WHERE key = 'gp_10000';
UPDATE achievements SET name_ja = 'コレクター',          name_zh = '收藏家'         WHERE key = 'marketplace_buyer';
UPDATE achievements SET name_ja = '商人',                name_zh = '商人'           WHERE key = 'marketplace_seller';
UPDATE achievements SET name_ja = '同志',                name_zh = '兄弟会'         WHERE key = 'guild_member';
UPDATE achievements SET name_ja = 'リクルーター',        name_zh = '招募者'         WHERE key = 'referral_3';

-- ── 추가 14개 업적 (총 28개) ──
INSERT INTO achievements (key, name_en, name_ko, name_ja, name_zh, description_en, description_ko, rarity, category, icon, condition_value, condition_type, reward_gp, xp_reward) VALUES
  -- 영토 확장 (claim_count 추가)
  ('claim_500',      'Galactic Lord',  '은하의 군주', '銀河の主',      '银河之主',     'Claim 500 territories', '영토 500개 점령',         'legendary', 'territory', '🌌', 500,  'claim_count',          2000, 10000),

  -- 함선 추가 (ship_count)
  ('ship_fleet_50',  'Fleet Commander','함대 사령관', '艦隊司令官',    '舰队指挥官',   'Own 50 ships',          '함선 50척 보유',          'epic',      'combat',    '🛸', 50,   'ship_count',           500,  2500),
  ('ship_fleet_100', 'Star Marshal',   '스타 마샬',   'スターマーシャル','星际元帅',     'Own 100 ships',         '함선 100척 보유',         'legendary', 'combat',    '⚡', 100,  'ship_count',           1500, 7500),

  -- 전투 추가 (battle_win_count)
  ('battle_50_wins', 'War Hero',       '전쟁 영웅',   '戦争の英雄',    '战争英雄',     'Win 50 battles',        '50회 전투 승리',          'epic',      'combat',    '🎖️', 50,   'battle_win_count',     750,  3750),
  ('battle_100_wins','Legend',         '전설',        'レジェンド',    '传奇',         'Win 100 battles',       '100회 전투 승리',         'legendary', 'combat',    '⭐', 100,  'battle_win_count',     2000, 10000),

  -- GP 보유 추가 (gp_balance)
  ('gp_100k',        'Mogul',          '모굴',        'モーグル',      '巨头',         'Hold 100,000 GP',       'GP 100,000 보유',         'legendary', 'economy',   '💸', 100000, 'gp_balance',         0,    5000),

  -- 마켓 거래 추가
  ('marketplace_buyer_25',  'Power Buyer',  '큰손 구매자', 'パワーバイヤー', '大买家',  'Buy 25 items',  '마켓에서 25개 구매', 'rare', 'economy', '🎁', 25, 'marketplace_buy_count',  200, 1000),
  ('marketplace_seller_25', 'Power Seller', '큰손 판매자', 'パワーセラー',   '大卖家',  'Sell 25 items', '마켓에서 25개 판매', 'rare', 'economy', '🏬', 25, 'marketplace_sell_count', 200, 1000),

  -- 추천 추가 (referral_count)
  ('referral_10',    'Influencer',     '인플루언서', 'インフルエンサー', '影响者',    'Refer 10 players',  '10명 추천',                 'epic',      'social',    '📢', 10,   'referral_count',       500,  2500),
  ('referral_50',    'Mass Recruiter', '대규모 모집가','大規模リクルーター','超级招募者', 'Refer 50 players', '50명 추천',                 'legendary', 'social',    '🌟', 50,   'referral_count',       3000, 15000),

  -- 코스메틱 (cosmetic_count) — 보유한 cosmetic 아이템 종류
  ('cosmetic_5',     'Style Setter',   '스타일리스트', 'スタイリスト',  '风格者',     'Own 5 different cosmetics', '코스메틱 5종 보유',  'rare',  'social', '🎨', 5,    'cosmetic_count',  100, 500),
  ('cosmetic_15',    'Fashion Icon',   '패션 아이콘',  'ファッションアイコン','时尚偶像', 'Own 15 different cosmetics','코스메틱 15종 보유','epic',  'social', '👑', 15,   'cosmetic_count',  500, 2500),

  -- 강화 (enhancement_count) — 강화 시도/성공 횟수
  ('enhancement_10', 'Apprentice Forger','수련 단야사','見習い鍛冶師','学徒铁匠', 'Successfully enhance 10 times','강화 10회 성공', 'rare', 'combat', '🔨', 10, 'enhancement_count', 150, 750),

  -- 강화 최대치 (max_enhancement_level) — 최고 강화 레벨 도달
  ('enhance_lvl_5',  'Forge Master',   '단야 명장',   '鍛冶の名人',    '锻造大师',     'Reach +5 enhancement',  '+5 강화 도달',            'epic',      'combat',    '✨', 5,    'max_enhancement_level',  300, 1500),
  ('enhance_lvl_10', 'Mythic Smith',   '신화의 대장장이','神話の鍛冶屋','神话铁匠',    'Reach +10 enhancement', '+10 강화 도달 (전설)',    'legendary', 'combat',    '💫', 10,   'max_enhancement_level',  3000, 15000)

ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('183_achievements_expansion.sql')
ON CONFLICT DO NOTHING;

COMMIT;
