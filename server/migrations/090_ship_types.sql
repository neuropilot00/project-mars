-- ═══════════════════════════════════════════════════════════════
-- Migration 090: Fleet Combat - Ship Types (함선 정의 22종)
-- ═══════════════════════════════════════════════════════════════
-- 프로토타입 v11 기반 22종 함선 시드
-- 3 파벌 × 4 크기(frigate/destroyer/cruiser/battleship) + 각 파벌 Titan 1종
--
-- 광물 레시피는 실제 resources.code 참조:
--   Tier 0: iron_dust, red_sand, regolith_ore
--   Tier 1: basalt_chip, ice_crystal, volcanic_shard
--   Tier 2: plasma_dust, ancient_metal, meteorite_fragment
--   Tier 3: hull_plate, plasma_coil, alloy_frame (Migration 091에서 생성)
--   Titan : xenomatter (Migration 091에서 생성)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. ship_types 테이블 ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ship_types (
  code            VARCHAR(24)  PRIMARY KEY,
  faction_code    VARCHAR(8)   NOT NULL REFERENCES factions(code),
  
  -- 분류
  size_class      VARCHAR(16)  NOT NULL,  -- frigate|destroyer|cruiser|battleship|titan
  role            VARCHAR(16)  NOT NULL,  -- dps|tackle|ewar|logi|tank
  tier            SMALLINT     NOT NULL,  -- 1=T1, 2=T2
  
  -- 다국어 이름
  name_en         VARCHAR(32)  NOT NULL,
  name_ko         VARCHAR(32)  NOT NULL,
  name_ja         VARCHAR(32),
  name_zh         VARCHAR(32),
  class_label     VARCHAR(64),
  description_en  TEXT,
  description_ko  TEXT,
  
  -- 전투 스탯
  base_hp         INTEGER      NOT NULL,
  base_atk        INTEGER      NOT NULL,
  base_def        INTEGER      NOT NULL,
  base_speed      NUMERIC(4,2) NOT NULL,
  fire_interval   INTEGER      NOT NULL,  -- ms
  fire_type       VARCHAR(16)  NOT NULL,  -- bullet|laser|mixed|missile|repair|ew|stealth_bomb
  shots           SMALLINT     DEFAULT 1,
  render_radius   NUMERIC(4,2),
  
  -- 건조 요구사항
  build_time_seconds  INTEGER NOT NULL,
  max_per_server      INTEGER,            -- Titan=3, 나머지 NULL
  max_per_player      INTEGER,            -- Titan/Battleship 제한
  min_player_rank     INTEGER DEFAULT 1,
  
  -- 건조 비용
  build_gp_cost       INTEGER NOT NULL DEFAULT 0,
  recipe_minerals     JSONB   NOT NULL DEFAULT '{}',   -- {"iron_dust":50,"plasma_coil":2}
  
  -- 메타
  is_capital          BOOLEAN DEFAULT false,
  is_flagship_capable BOOLEAN DEFAULT true,
  is_active           BOOLEAN DEFAULT true,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_types_faction ON ship_types(faction_code);
CREATE INDEX IF NOT EXISTS idx_ship_types_size    ON ship_types(size_class);
CREATE INDEX IF NOT EXISTS idx_ship_types_role    ON ship_types(role);
CREATE INDEX IF NOT EXISTS idx_ship_types_active  ON ship_types(is_active, sort_order) WHERE is_active;


-- ═══════════════════════════════════════════════════════════════
-- MCC 파벌 (기하학 · 레일건) — 8종
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ship_types (
  code, faction_code, size_class, role, tier,
  name_en, name_ko, name_ja, name_zh, class_label, description_ko,
  base_hp, base_atk, base_def, base_speed,
  fire_interval, fire_type, shots, render_radius,
  build_time_seconds, max_per_server, max_per_player, min_player_rank,
  build_gp_cost, recipe_minerals, is_capital, sort_order
) VALUES

-- Frigate 3종
('mcc_int', 'mcc', 'frigate', 'tackle', 1,
 'Prism', '프리즘', 'プリズム', '棱镜', 'Interceptor · T1', '고속 정찰·태클',
 3000, 6, 3, 2.40, 110, 'bullet', 1, 1.80,
 600, NULL, NULL, 1,
 50, '{"iron_dust":30,"red_sand":10}'::jsonb, false, 10),

('mcc_frg', 'mcc', 'frigate', 'dps', 1,
 'Shard', '샤드', 'シャード', '碎片', 'Frigate · T1', '범용 DPS 프리깃',
 6000, 14, 7, 1.80, 130, 'bullet', 2, 2.50,
 1500, NULL, NULL, 1,
 120, '{"iron_dust":50,"red_sand":20}'::jsonb, false, 11),

('mcc_ewar', 'mcc', 'frigate', 'ewar', 2,
 'Jammer', '재머', 'ジャマー', '干扰者', 'EW Frigate · T2', '적 사격 방해 · 전자전',
 4500, 5, 6, 1.70, 180, 'ew', 1, 2.40,
 3600, NULL, NULL, 3,
 300, '{"iron_dust":80,"ice_crystal":10,"plasma_coil":3,"alloy_frame":1}'::jsonb, false, 12),

-- Destroyer 1종
('mcc_dst', 'mcc', 'destroyer', 'dps', 1,
 'Vector', '벡터', 'ベクター', '矢量', 'Destroyer · T1', '프리깃 사냥 특화',
 14000, 32, 15, 1.20, 145, 'bullet', 3, 4.00,
 7200, NULL, NULL, 2,
 500, '{"iron_dust":140,"regolith_ore":50,"hull_plate":3}'::jsonb, false, 20),

-- Cruiser 2종
('mcc_crs', 'mcc', 'cruiser', 'dps', 1,
 'Obelisk', '오벨리스크', 'オベリスク', '方尖碑', 'Cruiser · T1', '중거리 레일건 순양함',
 28000, 65, 38, 0.80, 180, 'mixed', 2, 5.00,
 21600, NULL, NULL, 3,
 2000, '{"iron_dust":400,"regolith_ore":150,"hull_plate":8,"plasma_coil":12,"alloy_frame":4}'::jsonb, false, 30),

('mcc_snp', 'mcc', 'cruiser', 'dps', 2,
 'Longeye', '롱아이', 'ロングアイ', '远眼', 'Sniper Cruiser · T2', '장거리 저격 전문',
 24000, 105, 30, 0.70, 260, 'laser', 1, 4.80,
 64800, NULL, NULL, 5,
 4000, '{"iron_dust":600,"basalt_chip":20,"hull_plate":10,"plasma_coil":18,"alloy_frame":8,"volcanic_shard":15}'::jsonb, false, 31),

-- Battleship 1종
('mcc_bs', 'mcc', 'battleship', 'dps', 1,
 'Tessellate', '테셀레이트', 'テセレート', '镶嵌', 'Battleship · T1', '주력 포격 전함',
 170000, 290, 200, 0.30, 300, 'laser', 1, 8.50,
 172800, NULL, 3, 7,
 10000, '{"iron_dust":3000,"regolith_ore":1200,"hull_plate":50,"plasma_coil":80,"alloy_frame":40,"basalt_chip":30,"ancient_metal":5}'::jsonb, true, 40),

-- Titan 1종 (서버 3척 제한)
('mcc_titan', 'mcc', 'titan', 'dps', 2,
 'Prometheus', '프로메테우스', 'プロメテウス', '普罗米修斯', 'Titan · SERVER MAX 3', 'MCC 사령함',
 1000000, 700, 500, 0.15, 450, 'laser', 1, 13.00,
 259200, 3, 1, 10,
 50000, '{"iron_dust":20000,"basalt_chip":500,"hull_plate":350,"plasma_coil":700,"alloy_frame":250,"ancient_metal":120,"meteorite_fragment":35,"xenomatter":6}'::jsonb, true, 50)

ON CONFLICT (code) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- FSP 파벌 (유기적 · 드론/로지) — 7종
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ship_types (
  code, faction_code, size_class, role, tier,
  name_en, name_ko, name_ja, name_zh, class_label, description_ko,
  base_hp, base_atk, base_def, base_speed,
  fire_interval, fire_type, shots, render_radius,
  build_time_seconds, max_per_server, max_per_player, min_player_rank,
  build_gp_cost, recipe_minerals, is_capital, sort_order
) VALUES

('fsp_int', 'fsp', 'frigate', 'dps', 1,
 'Sprite', '스프라이트', 'スプライト', '精灵', 'Light Frigate · T1', '드론 발사대 경량',
 4000, 9, 4, 2.20, 115, 'bullet', 2, 2.00,
 1200, NULL, NULL, 1,
 80, '{"iron_dust":40,"regolith_ore":15}'::jsonb, false, 10),

('fsp_logi', 'fsp', 'frigate', 'logi', 2,
 'Verdant', '버던트', 'バーダント', '翠绿', 'Logi Frigate · T2', '아군 HP 회복',
 5000, 2, 10, 1.60, 160, 'repair', 1, 2.50,
 3600, NULL, NULL, 2,
 250, '{"iron_dust":60,"ice_crystal":15,"plasma_coil":2,"alloy_frame":2}'::jsonb, false, 11),

('fsp_dst', 'fsp', 'destroyer', 'tank', 1,
 'Bulwark', '벌웍', 'バルワーク', '壁垒', 'Armored Destroyer · T1', '중장갑 방어 구축함',
 22000, 26, 30, 1.00, 160, 'bullet', 2, 3.80,
 10800, NULL, NULL, 2,
 700, '{"iron_dust":180,"red_sand":80,"hull_plate":5}'::jsonb, false, 20),

('fsp_crs', 'fsp', 'cruiser', 'dps', 1,
 'Grove', '그로브', 'グローブ', '丛林', 'Drone Cruiser · T1', '드론 운용 자율 공격',
 26000, 55, 45, 0.70, 200, 'mixed', 1, 5.00,
 21600, NULL, NULL, 3,
 1800, '{"iron_dust":500,"regolith_ore":200,"hull_plate":10,"plasma_coil":8,"alloy_frame":6}'::jsonb, false, 30),

('fsp_logi_crs', 'fsp', 'cruiser', 'logi', 2,
 'Nova', '노바', 'ノヴァ', '新星', 'Logi Cruiser · T2', '범위 수리 전문',
 22000, 5, 60, 0.70, 140, 'repair', 1, 4.80,
 72000, NULL, NULL, 5,
 4500, '{"iron_dust":700,"ice_crystal":40,"hull_plate":14,"plasma_coil":6,"alloy_frame":10,"basalt_chip":25}'::jsonb, false, 31),

('fsp_bs', 'fsp', 'battleship', 'tank', 1,
 'Sequoia', '세쿼이아', 'セコイア', '红杉', 'Battleship · T1', '초중장갑 전함 · 드론 4기',
 210000, 230, 280, 0.25, 340, 'mixed', 2, 8.80,
 187200, NULL, 3, 7,
 11000, '{"iron_dust":3500,"red_sand":1500,"hull_plate":65,"plasma_coil":60,"alloy_frame":55,"ice_crystal":80,"ancient_metal":4}'::jsonb, true, 40),

('fsp_titan', 'fsp', 'titan', 'tank', 2,
 'Gaia', '가이아', 'ガイア', '盖亚', 'Titan · SERVER MAX 3', 'FSP 요새 타이탄',
 1150000, 550, 700, 0.14, 480, 'laser', 1, 13.50,
 280800, 3, 1, 10,
 52000, '{"iron_dust":22000,"ice_crystal":600,"hull_plate":400,"plasma_coil":600,"alloy_frame":280,"ancient_metal":130,"meteorite_fragment":30,"xenomatter":7}'::jsonb, true, 50)

ON CONFLICT (code) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- CV 파벌 (조립식 · 돌격) — 7종
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ship_types (
  code, faction_code, size_class, role, tier,
  name_en, name_ko, name_ja, name_zh, class_label, description_ko,
  base_hp, base_atk, base_def, base_speed,
  fire_interval, fire_type, shots, render_radius,
  build_time_seconds, max_per_server, max_per_player, min_player_rank,
  build_gp_cost, recipe_minerals, is_capital, sort_order
) VALUES

('cv_int', 'cv', 'frigate', 'tackle', 1,
 'Slasher', '슬래셔', 'スラッシャー', '劈砍者', 'Fast Attack · T1', '최속 탄막 프리깃',
 2500, 11, 2, 2.80, 90, 'bullet', 2, 1.70,
 720, NULL, NULL, 1,
 45, '{"iron_dust":25,"red_sand":10}'::jsonb, false, 10),

('cv_frg', 'cv', 'frigate', 'dps', 1,
 'Jagged', '재그드', 'ジャグド', '锯齿', 'Frigate · T1', '근접전 특화 고DPS',
 5000, 18, 5, 1.90, 110, 'bullet', 3, 2.40,
 1320, NULL, NULL, 1,
 100, '{"iron_dust":45,"red_sand":25}'::jsonb, false, 11),

('cv_bomb', 'cv', 'frigate', 'dps', 2,
 'Reaper', '리퍼', 'リーパー', '收割者', 'Stealth Bomber · T2', '은신 접근 폭격기',
 3500, 160, 3, 1.70, 550, 'stealth_bomb', 1, 2.10,
 7200, NULL, NULL, 4,
 600, '{"iron_dust":100,"volcanic_shard":20,"plasma_coil":4,"alloy_frame":2,"basalt_chip":8}'::jsonb, false, 12),

('cv_dst', 'cv', 'destroyer', 'dps', 1,
 'Butcher', '부처', 'ブッチャー', '屠夫', 'Assault Destroyer · T1', '고DPS 돌격 구축함',
 11000, 45, 12, 1.30, 125, 'bullet', 4, 3.50,
 9000, NULL, NULL, 2,
 600, '{"iron_dust":160,"volcanic_shard":25,"hull_plate":4}'::jsonb, false, 20),

('cv_crs', 'cv', 'cruiser', 'dps', 1,
 'Mauler', '몰러', 'モーラー', '重击者', 'Missile Cruiser · T1', '중거리 미사일 순양함',
 24000, 80, 35, 0.80, 220, 'missile', 1, 4.70,
 18000, NULL, NULL, 3,
 1700, '{"iron_dust":450,"volcanic_shard":60,"hull_plate":8,"plasma_coil":14,"alloy_frame":5}'::jsonb, false, 30),

('cv_bs', 'cv', 'battleship', 'dps', 1,
 'Ironclad', '아이언클래드', 'アイアンクラッド', '铁甲舰', 'Battleship · T1', '고화력 중거리 전함',
 155000, 350, 180, 0.35, 280, 'laser', 1, 8.50,
 158400, NULL, 3, 7,
 9500, '{"iron_dust":2800,"volcanic_shard":400,"hull_plate":55,"plasma_coil":95,"alloy_frame":38,"basalt_chip":25,"meteorite_fragment":3}'::jsonb, true, 40),

('cv_titan', 'cv', 'titan', 'dps', 2,
 'Carnage', '카네이지', 'カーネイジ', '杀戮', 'Titan · SERVER MAX 3', 'CV 전격 타이탄',
 1100000, 800, 480, 0.16, 440, 'laser', 1, 13.00,
 259200, 3, 1, 10,
 51000, '{"iron_dust":25000,"volcanic_shard":3000,"hull_plate":400,"plasma_coil":800,"alloy_frame":300,"ancient_metal":150,"meteorite_fragment":40,"xenomatter":8}'::jsonb, true, 50)

ON CONFLICT (code) DO NOTHING;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- SELECT faction_code, size_class, COUNT(*) FROM ship_types GROUP BY faction_code, size_class ORDER BY faction_code, size_class;
-- SELECT code, name_ko, build_gp_cost FROM ship_types WHERE size_class='titan';
-- 기대: 총 22행 (MCC 8, FSP 7, CV 7). Titan 3종 각각 max_per_server=3
