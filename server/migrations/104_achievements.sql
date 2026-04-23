-- Migration 104: Achievement System
-- Permanent milestone achievements that reward players for exploring all game features.
-- Rewards are auto-granted on unlock (no separate claim step).

CREATE TABLE IF NOT EXISTS achievements (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(60)  UNIQUE NOT NULL,
  category        VARCHAR(30)  NOT NULL,           -- territory | economy | combat | social | collection
  icon            VARCHAR(10)  NOT NULL DEFAULT '🏆',
  name_en         TEXT         NOT NULL,
  name_ko         TEXT,
  name_ja         TEXT,
  name_zh         TEXT,
  desc_en         TEXT,
  desc_ko         TEXT,
  desc_ja         TEXT,
  desc_zh         TEXT,
  condition_type  VARCHAR(40)  NOT NULL,
  condition_value INT          NOT NULL DEFAULT 1,
  reward_gp       DECIMAL(20,6) NOT NULL DEFAULT 0,
  rarity          VARCHAR(20)  NOT NULL DEFAULT 'common',  -- common | rare | epic | legendary
  sort_order      INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id               SERIAL PRIMARY KEY,
  wallet           VARCHAR(100) NOT NULL,
  achievement_key  VARCHAR(60)  NOT NULL REFERENCES achievements(key) ON DELETE CASCADE,
  unlocked_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(wallet, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_user_ach_wallet  ON user_achievements(wallet, unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_cat ON achievements(category, sort_order);

-- ── Settings ────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('achievements_enabled',     'true', 'Enable the achievement system',                     'system'),
  ('achievement_reward_mult',  '1.0',  'Global GP reward multiplier for achievements (1.0 = normal)', 'system')
ON CONFLICT (key) DO NOTHING;

-- ── Seed Achievements ────────────────────────────────────────────────────────
INSERT INTO achievements (key, category, icon, name_en, name_ko, name_ja, name_zh,
  desc_en, desc_ko, desc_ja, desc_zh,
  condition_type, condition_value, reward_gp, rarity, sort_order)
VALUES
  -- ── Territory ────────────────────────────────────────────────────────────
  ('first_territory', 'territory', '🌍',
   'Stake Your Claim',     '첫 영토 확보',        '初めての領土',     '首块领土',
   'Own your first territory', '첫 영토를 확보하세요', '最初の領土を所有する', '拥有第一块领土',
   'claim_count', 1, 50, 'common', 10),

  ('territories_3', 'territory', '🗺️',
   'Small Landlord',       '소지주',              '小地主',           '小地主',
   'Own 3 territories',    '영토 3개를 보유하세요', '3つの領土を所有する', '拥有3块领土',
   'claim_count', 3, 150, 'rare', 20),

  ('territories_10', 'territory', '🏰',
   'Land Baron',           '대지주',              '大地主',           '土地大亨',
   'Own 10 territories',   '영토 10개를 보유하세요', '10の領土を所有する', '拥有10块领土',
   'claim_count', 10, 500, 'epic', 30),

  -- ── Economy ──────────────────────────────────────────────────────────────
  ('first_marketplace_buy', 'economy', '🛒',
   'First Trade',          '첫 거래',             '初取引',           '首次交易',
   'Buy an item on the marketplace', '마켓에서 아이템을 구매하세요', 'マーケットでアイテムを購入する', '在市场购买物品',
   'marketplace_buy_count', 1, 30, 'common', 10),

  ('first_marketplace_sell', 'economy', '🏪',
   'Open for Business',    '첫 판매 등록',        '初出品',           '首次上架',
   'List your first item for sale', '처음으로 아이템을 마켓에 등록하세요', '初めてアイテムを出品する', '首次挂牌出售物品',
   'marketplace_sell_count', 1, 30, 'common', 20),

  ('gp_balance_1000', 'economy', '💰',
   'Thousand GP Club',     'GP 1천 클럽',         'GP千の会',         'GP千人俱乐部',
   'Hold 1,000 GP',        'GP 잔액 1,000 달성',  'GP残高1,000達成',  '持有1,000 GP',
   'gp_balance', 1000, 100, 'rare', 30),

  ('gp_balance_10000', 'economy', '💎',
   'GP Magnate',           'GP 대부호',           'GP大富豪',         'GP大亨',
   'Hold 10,000 GP',       'GP 잔액 10,000 달성', 'GP残高10,000達成', '持有10,000 GP',
   'gp_balance', 10000, 500, 'epic', 40),

  -- ── Combat ───────────────────────────────────────────────────────────────
  ('first_ship', 'combat', '🚀',
   'Shipwright',           '첫 함선 건조',        '初造船',           '首艘舰船',
   'Build your first ship','첫 번째 함선을 건조하세요', '初めての艦船を建造する', '建造第一艘舰船',
   'ship_count', 1, 50, 'common', 10),

  ('ships_5', 'combat', '🛸',
   'Small Fleet',          '소함대',              '小艦隊',           '小舰队',
   'Command a fleet of 5 ships', '5척의 함선을 보유하세요', '5隻の艦船を所有する', '指挥5艘舰船',
   'ship_count', 5, 200, 'rare', 20),

  ('first_battle_win', 'combat', '⚔️',
   'Battle-Tested',        '첫 승리',             '初勝利',           '首次获胜',
   'Win your first naval battle', '첫 해전에서 승리하세요', '初めての海戦に勝利する', '赢得第一场海战',
   'battle_win_count', 1, 100, 'rare', 30),

  ('battles_won_10', 'combat', '🎖️',
   'Admiral',              '제독',                '提督',             '海军上将',
   'Win 10 naval battles', '해전 10승을 달성하세요', '海戦10勝達成',    '赢得10场海战',
   'battle_win_count', 10, 400, 'epic', 40),

  -- ── Social ───────────────────────────────────────────────────────────────
  ('joined_guild', 'social', '🤝',
   'Band Together',        '길드 가입',           'ギルド加入',       '加入公会',
   'Join a guild',         '길드에 가입하세요',    'ギルドに加入する',  '加入一个公会',
   'guild_membership', 1, 30, 'common', 10),

  ('first_referral', 'social', '📢',
   'Recruiter',            '첫 추천인',           '初リクルート',     '首次推荐',
   'Refer your first player', '처음으로 다른 플레이어를 초대하세요', '初めてのプレイヤー招待', '推荐第一位玩家',
   'referral_count', 1, 100, 'rare', 20),

  ('referrals_5', 'social', '📣',
   'Talent Scout',         '스카우터',            'スカウター',       '星探',
   'Refer 5 players',      '5명의 플레이어를 초대하세요', '5人のプレイヤーを招待する', '推荐5位玩家',
   'referral_count', 5, 500, 'epic', 30),

  -- ── Collection ───────────────────────────────────────────────────────────
  ('first_cosmetic', 'collection', '✨',
   'Fashionista',          '패셔니스타',          'ファッショニスタ',  '时尚达人',
   'Buy your first cosmetic', '첫 번째 코스메틱을 구매하세요', '初めてのコスメティックを購入する', '购买第一个装饰品',
   'cosmetic_count', 1, 30, 'common', 10),

  ('cosmetics_5', 'collection', '🎨',
   'Collector',            '수집가',              'コレクター',       '收藏家',
   'Own 5 cosmetics',      '코스메틱 5개를 보유하세요', 'コスメティック5個を所有する', '拥有5件装饰品',
   'cosmetic_count', 5, 150, 'rare', 20),

  ('first_enhancement', 'collection', '⚡',
   'Blacksmith',           '대장장이',            '鍛冶師',           '铁匠',
   'Successfully enhance an item', '아이템을 강화하는 데 성공하세요', 'アイテムの強化に成功する', '成功强化一件物品',
   'enhancement_count', 1, 50, 'common', 30),

  ('enhancement_plus5', 'collection', '🔮',
   'Master Enhancer',      '마스터 강화사',       'マスター強化師',   '强化大师',
   'Enhance an item to +5 or higher', '아이템을 +5 이상으로 강화하세요', 'アイテムを+5以上に強化する', '将物品强化至+5或更高',
   'max_enhancement_level', 5, 300, 'epic', 40)

ON CONFLICT (key) DO NOTHING;
