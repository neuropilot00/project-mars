-- ============================================================
-- Migration 084: 섹터 정의 시스템 (BIBLE Migration 081)
-- sector_definitions + sector_entry_requirements + sector_governance
-- + claims 컬럼 추가 + settings
--
-- ⚠️  users 테이블에 id 컬럼이 없음 (PK = wallet_address)
--     → governor_user_id 대신 governor_wallet VARCHAR(42) 사용
-- ============================================================

-- ── 1. sector_definitions 테이블 ──
CREATE TABLE IF NOT EXISTS sector_definitions (
  id                   SERIAL PRIMARY KEY,
  code                 VARCHAR(30) UNIQUE NOT NULL,
  name_en              VARCHAR(50),
  name_ko              VARCHAR(50),
  name_ja              VARCHAR(50),
  name_zh              VARCHAR(50),
  sector_type          VARCHAR(20) NOT NULL,          -- 'core','mid','frontier'
  price_multiplier     DECIMAL(5,2) DEFAULT 1.0,
  mining_multiplier    DECIMAL(5,2) DEFAULT 1.0,
  defense_multiplier   DECIMAL(5,2) DEFAULT 1.0,
  center_x             INT,
  center_y             INT,
  lore_en              TEXT,
  lore_ko              TEXT,
  lore_ja              TEXT,
  lore_zh              TEXT,
  special_feature      TEXT,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT NOW()
);

-- ── 2. 24섹터 초기 데이터 ──
INSERT INTO sector_definitions
  (code, name_en, name_ko, name_ja, name_zh,
   sector_type, price_multiplier, mining_multiplier, defense_multiplier,
   lore_en, special_feature)
VALUES

-- Core 섹터 (6개)
('olympus_crown',   'Olympus Crown',   '올림푸스 왕관',
  'オリンポス・クラウン', '奥林匹斯皇冠', 'core', 5.0, 1.0, 1.5,
  'Built atop the solar system''s highest volcano. The political heart of Mars. Three major corporations have fallen trying to hold this peak.',
  'Governor 세금 수입 ×1.5. 모든 섹터에서 가장 큰 정치적 명예'),

('tharsis_citadel', 'Tharsis Citadel', '타르시스 요새',
  'タルシス・シタデル', '塔尔西斯要塞', 'core', 5.0, 0.8, 2.0,
  'The volcanic plateau of Tharsis is the most defensible ground on Mars. No siege has ever succeeded here in the first attempt.',
  '방어 최강. 방어 아이템 효과 +20%. Hijack 비용 +30%'),

('pavonis_gate',    'Pavonis Gate',    '파보니스 관문',
  'パヴォニス・ゲート', '帕沃尼斯门', 'core', 5.0, 1.0, 1.0,
  'Every trade route passes through Pavonis Gate. The Governor here controls the flow of goods across half of Mars.',
  '마켓 거래량 +50%. Governor 마켓세 수입 최대'),

('ascraeus_vault',  'Ascraeus Vault',  '아스크라이우스 금고',
  'アスクラエウス・ヴォールト', '阿斯克拉乌斯金库', 'core', 5.0, 1.2, 1.0,
  'The underground storage networks beneath Ascraeus hold the largest GP reserves on Mars.',
  'GP 수익 +15%. Enhancement 비용 -10%'),

('arsia_forge',     'Arsia Forge',     '아르시아 대장간',
  'アルシア・フォージ', '阿尔西亚熔炉', 'core', 5.0, 1.1, 1.0,
  'Volcanic heat makes Arsia the perfect forge. The best Enhancement craftspeople cluster here.',
  'Crafter 직업 버프 추가 +10%. Enhancement 성공률 +5%'),

('noctis_prime',    'Noctis Prime',    '녹티스 프라임',
  'ノクティス・プライム', '诺克提斯首都', 'core', 5.0, 1.0, 1.2,
  'The labyrinth of canyons in Noctis makes it impossible to govern through force alone. Every Governor here has survived through alliances.',
  '외교 보너스. 길드 동맹 효과 +20%'),

-- Mid 섹터 (10개)
('marineris_east',  'Marineris East',  '마리너리스 동부',
  'マリネリス東部', '水手谷东部', 'mid', 2.0, 1.2, 1.0,
  'The eastern mouth of the great canyon. New arrivals often make their first deal here.',
  '신규 유저 보호. Level 10 미만 Hijack 비용 +50%'),

('marineris_west',  'Marineris West',  '마리너리스 서부',
  'マリネリス西部', '水手谷西部', 'mid', 2.0, 1.0, 1.0,
  'Merchants have called the western canyon home for three seasons.',
  'Merchant 직업 버프 추가 +10%. 마켓 수수료 -5%'),

('candor_fields',   'Candor Fields',   '캔도르 평원',
  'カンドル・フィールズ', '坎多尔原野', 'mid', 2.0, 1.4, 1.0,
  'Flat, open, and fertile by Martian standards. The most consistent PP yields.',
  'Mining 수익 +40%. 가장 안정적인 수확'),

('ophir_station',   'Ophir Station',   '오피르 역',
  'オフィル・ステーション', '奥菲尔站', 'mid', 2.0, 1.0, 1.0,
  'Originally a waypoint, Ophir grew into a full settlement. Guilds thrive here.',
  '길드 생성 비용 -20%. 길드 멤버 모집 속도 +20%'),

('hebes_crossing',  'Hebes Crossing',  '헤베스 교차로',
  'ヘベス・クロッシング', '赫伯斯十字路', 'mid', 2.0, 1.1, 1.0,
  'Neutral ground by tradition. A place to trade and negotiate before conflicts escalate.',
  'Bounty 등록 비용 -30%. 중립 협상 지역'),

('coprates_ridge',  'Coprates Ridge',  '코프라테스 능선',
  'コプラテス・リッジ', '科普拉特斯山脊', 'mid', 2.0, 0.9, 1.0,
  'Warriors come to Coprates to prove themselves.',
  'Warrior 직업 버프 추가 +10%. Hijack 성공률 +5%'),

('eos_plateau',     'Eos Plateau',     '에오스 고원',
  'エオス・プラトー', '曙光高原', 'mid', 2.0, 1.0, 0.9,
  'The winds above Eos are legendary. During storm season, it becomes the most dangerous sector.',
  '모래폭풍 이벤트 집중. 폭풍 기간 보상 ×2'),

('melas_basin',     'Melas Basin',     '멜라스 분지',
  'メラス・ベイスン', '梅拉斯盆地', 'mid', 2.0, 1.1, 1.0,
  'Deep in the canyon system, full of secrets. Explorers report finding artifacts.',
  'POI 풍부. 탐험 보상 +30%'),

('tithonium_scars', 'Tithonium Scars', '티토니움 상흔',
  'ティトニウム・スカーズ', '塔托尼乌姆伤疤', 'mid', 2.0, 1.0, 0.8,
  'The most betrayals per capita on Mars. The most dramatic siege upsets.',
  'Siege 비용 -20%. 배신의 땅 — 전략적 공격에 유리'),

('syria_planum',    'Syria Planum',    '시리아 평원',
  'シリア・プラナム', '叙利亚平原', 'mid', 2.0, 1.3, 1.1,
  'One of the few truly flat regions of Mars. Steady, reliable, boring.',
  'Mining 안정성 최고. 날씨 이벤트 없음'),

-- Frontier 섹터 (8개)
('hellas_abyss',    'Hellas Abyss',    '헬라스 심연',
  'ヘラス・アビス', '赫拉斯深渊', 'frontier', 1.0, 2.0, 0.7,
  'The deepest impact crater on Mars. Ancient Metal has been found here that appears nowhere else.',
  '희귀 자원 확률 최고. Ancient Metal 독점. 위험도 최상'),

('elysium_wastes',  'Elysium Wastes',  '엘리시움 황무지',
  'エリシウム・ウェイスツ', '极乐世界废土', 'frontier', 1.0, 1.5, 0.8,
  'When rockets fail, they crash in Elysium. The sector is littered with salvageable cargo.',
  '로켓 낙하 다발. Meteorite Fragment 획득률 ×3'),

('utopia_flats',    'Utopia Flats',    '유토피아 평지',
  'ユートピア・フラッツ', '乌托邦平地', 'frontier', 1.0, 1.3, 0.9,
  'Named ironically. Exploration teams keep finding things underground.',
  'POI 탐험 최다. 탐험 보상 +50%'),

('arcadia_ridge',   'Arcadia Ridge',   '아르카디아 능선',
  'アルカディア・リッジ', '阿卡迪亚山脊', 'frontier', 1.0, 1.2, 1.0,
  'The veterans who settled here first made a pact: no attacking accounts younger than 14 days.',
  '신규 유저 전통적 보호 구역. 온보딩 추천 섹터'),

('cerberus_scars',  'Cerberus Scars',  '케르베로스 상흔',
  'ケルベロス・スカーズ', '地狱三头犬伤疤', 'frontier', 1.0, 1.8, 0.6,
  'Three independent power bases have fought for control since Season 1. None has won.',
  '고위험 고수익. 상시 전투. Hijack 비용 -10% (공격자 유리)'),

('phlegra_deep',    'Phlegra Deep',    '플레그라 심부',
  'プレグラ・ディープ', '弗莱格拉深处', 'frontier', 1.0, 1.6, 0.9,
  'The ice formations in Phlegra are unlike anywhere else. Ice Crystal found here is premium.',
  'Ice Crystal 확률 ×2. 냉각 자원 특화'),

('amazonis_sink',   'Amazonis Sink',   '아마조니스 함몰지',
  'アマゾニス・シンク', '亚马逊尼斯沉降地', 'frontier', 1.0, 1.4, 1.1,
  'The geological stability of Amazonis makes it an anomaly in the Frontier. No earthquakes.',
  '가장 안전한 Frontier. 날씨 이벤트 없음'),

('borealis_edge',   'Borealis Edge',   '보레알리스 끝자락',
  'ボレアリス・エッジ', '北极边缘', 'frontier', 1.0, 1.5, 0.8,
  'The northernmost territory on Mars. Supply lines take three times as long. Isolation has value.',
  '특수 아이템 드롭 보너스. Bounty Hunter 우세')

ON CONFLICT (code) DO NOTHING;

-- ── 3. sector_entry_requirements 테이블 ──
CREATE TABLE IF NOT EXISTS sector_entry_requirements (
  id                       SERIAL PRIMARY KEY,
  sector_code              VARCHAR(30) UNIQUE NOT NULL
                             REFERENCES sector_definitions(code),
  min_level                INT DEFAULT 0,
  required_mid_territories INT DEFAULT 0,
  is_active                BOOLEAN DEFAULT TRUE
);

INSERT INTO sector_entry_requirements
  (sector_code, min_level, required_mid_territories)
SELECT code,
  CASE sector_type
    WHEN 'frontier' THEN 0
    WHEN 'mid'      THEN 10
    WHEN 'core'     THEN 25
  END,
  CASE sector_type WHEN 'core' THEN 1 ELSE 0 END
FROM sector_definitions
ON CONFLICT (sector_code) DO NOTHING;

-- ── 4. sector_governance 테이블 ──
-- ⚠️  users.id 없음 → governor_wallet VARCHAR(42) 사용
CREATE TABLE IF NOT EXISTS sector_governance (
  id                    SERIAL PRIMARY KEY,
  sector_code           VARCHAR(30) UNIQUE NOT NULL
                          REFERENCES sector_definitions(code),
  governor_wallet       VARCHAR(42) REFERENCES users(wallet_address),
  governor_since        TIMESTAMP,
  tax_rate              DECIMAL(5,2) DEFAULT 2.0,
  market_cut_rate       DECIMAL(5,4) DEFAULT 0.01,
  sector_policy         VARCHAR(20) DEFAULT 'open',
  declaration_text      TEXT,
  declaration_updated   TIMESTAMP,
  total_tax_collected   DECIMAL(20,8) DEFAULT 0,
  active_siege_id       INT,
  created_at            TIMESTAMP DEFAULT NOW()
);

INSERT INTO sector_governance (sector_code)
SELECT code FROM sector_definitions
ON CONFLICT (sector_code) DO NOTHING;

-- ── 5. claims 테이블 컬럼 추가 ──
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS sector_code     VARCHAR(30)
    REFERENCES sector_definitions(code),
  ADD COLUMN IF NOT EXISTS price_paid_pp   DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS adjacency_bonus DECIMAL(5,4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_claims_sector_code ON claims(sector_code);

-- ── 6. settings 추가 (이미 있으면 SKIP) ──
INSERT INTO settings (key, value, description) VALUES
  ('sector_mid_min_level',      '10', 'Mid 섹터 최소 레벨'),
  ('sector_core_min_level',     '25', 'Core 섹터 최소 레벨'),
  ('sector_core_mid_required',  '1',  'Core 진입 필요 Mid 영토 수'),
  ('sector_entry_check_enabled','true','섹터 진입 레벨 제한 활성화')
ON CONFLICT (key) DO NOTHING;

-- ── 7. 인덱스 ──
CREATE INDEX IF NOT EXISTS idx_sector_defs_type     ON sector_definitions(sector_type);
CREATE INDEX IF NOT EXISTS idx_sector_gov_wallet    ON sector_governance(governor_wallet);

-- ============================================================
-- ROLLBACK SQL:
--   ALTER TABLE claims
--     DROP COLUMN IF EXISTS sector_code,
--     DROP COLUMN IF EXISTS price_paid_pp,
--     DROP COLUMN IF EXISTS adjacency_bonus;
--   DROP TABLE IF EXISTS sector_governance;
--   DROP TABLE IF EXISTS sector_entry_requirements;
--   DROP TABLE IF EXISTS sector_definitions;
--   DELETE FROM settings WHERE key IN (
--     'sector_mid_min_level','sector_core_min_level',
--     'sector_core_mid_required','sector_entry_check_enabled'
--   );
-- ============================================================
