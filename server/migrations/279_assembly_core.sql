-- 279_assembly_core.sql
-- P1 합체 슈퍼유닛 코어: Pilgrim Arms 실험병기 + 5파츠 수집/합체 기반
-- 기획서: docs/MECHA_ASSEMBLY_GACHA_PLAN_2026-05-30.md
-- 이 마이그레이션은 "수집·합체" 코어만 깐다. 가챠 라인(P2)/전투통합(P3)은 별도.

-- ── Pilgrim Arms (숨겨진 4세력, NPC) ──
-- ship_types.faction_code FK 충족용. is_active=false 로 두어 조선소/크레이트 cross-faction 롤에 끼지 않게 한다.
INSERT INTO factions (code, name_en, name_ko, name_ja, name_zh, color_primary, color_dark, color_bright, visual_style, icon_emoji, is_active, sort_order)
VALUES ('pilgrim', 'Pilgrim Arms', '필그림 아머스', 'ピルグリム・アームズ', '朝圣者军备', '#b388ff', '#6a1b9a', '#e1bee7', 'mecha', '🜲', false, 99)
ON CONFLICT (code) DO NOTHING;

-- ── 합체체 ship_type (중상위 = 타이탄 호각, 단일 최고스탯 초과 금지) ──
-- size_class='assembled' 신규 함급. build_gp_cost=0 (조선소 건조 불가, 합체로만 생성).
INSERT INTO ship_types (
  code, faction_code, size_class, role, tier,
  name_en, name_ko, name_ja, name_zh, class_label,
  description_en, description_ko,
  base_hp, base_atk, base_def, base_speed,
  fire_interval, fire_type, shots, render_radius,
  build_time_seconds, max_per_server, max_per_player, min_player_rank,
  build_gp_cost, recipe_minerals, is_capital, is_flagship_capable, is_active, sort_order
) VALUES (
  'pilgrim_voltaris', 'pilgrim', 'assembled', 'dps', 5,
  'Voltaris', '볼타리스', 'ヴォルタリス', '沃尔塔利斯', 'Assembled Unit',
  'Pilgrim Arms sealed combination weapon. Five parts unite into one super-unit.',
  '필그림 아머스가 봉인했던 합체병기. 5개 파츠가 하나로 합체한다.',
  1800000, 820, 640, 0.16,
  455, 'laser', 1, 14.00,
  0, NULL, NULL, 0,
  0, '{}'::jsonb, true, true, true, 100
) ON CONFLICT (code) DO NOTHING;

-- ── 파츠 카탈로그 (5함급 변형 테마) ──
CREATE TABLE IF NOT EXISTS assembly_parts (
  part_code   VARCHAR(40) PRIMARY KEY,
  unit_code   VARCHAR(40) NOT NULL DEFAULT 'pilgrim_voltaris',  -- 어떤 합체체용 파츠인지
  slot        SMALLINT NOT NULL,                                 -- 1~5
  name_en     VARCHAR(60) NOT NULL,
  name_ko     VARCHAR(60) NOT NULL,
  name_ja     VARCHAR(60),
  name_zh     VARCHAR(60),
  icon_emoji  VARCHAR(8),
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

INSERT INTO assembly_parts (part_code, slot, name_en, name_ko, name_ja, name_zh, icon_emoji, sort_order) VALUES
  ('voltaris_scout',     1, 'Scout Core',     '스카우트 코어', 'スカウトコア',   '侦察核心', '🛰', 1),
  ('voltaris_assault',   2, 'Assault Limb',   '돌격 유닛',     'アサルトユニット', '突击单元', '⚔', 2),
  ('voltaris_artillery', 3, 'Artillery Limb', '포격 유닛',     'アーティラリー',   '炮击单元', '☄', 3),
  ('voltaris_shield',    4, 'Shield Limb',    '방패 유닛',     'シールドユニット', '防护单元', '🛡', 4),
  ('voltaris_command',   5, 'Command Core',   '지휘 코어',     'コマンドコア',   '指挥核心', '🜲', 5)
ON CONFLICT (part_code) DO NOTHING;

-- ── 유저 보유 파츠 ──
CREATE TABLE IF NOT EXISTS user_assembly_parts (
  wallet     VARCHAR(64) NOT NULL,
  part_code  VARCHAR(40) NOT NULL REFERENCES assembly_parts(part_code),
  qty        INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet, part_code)
);
CREATE INDEX IF NOT EXISTS idx_user_assembly_parts_wallet ON user_assembly_parts (wallet);

-- ── 유저 조각(소프트 천장) ──
CREATE TABLE IF NOT EXISTS user_assembly_shards (
  wallet     VARCHAR(64) PRIMARY KEY,
  shards     INTEGER NOT NULL DEFAULT 0 CHECK (shards >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 합체/분해 로그 ──
CREATE TABLE IF NOT EXISTS assembly_events (
  id         BIGSERIAL PRIMARY KEY,
  wallet     VARCHAR(64) NOT NULL,
  unit_code  VARCHAR(40) NOT NULL,
  action     VARCHAR(20) NOT NULL,   -- 'assemble' | 'disassemble' | 'exchange' | 'grant'
  ship_id    BIGINT,
  detail     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assembly_events_wallet ON assembly_events (wallet, created_at DESC);

-- ── settings (기획서 §8 — 전부 조정 가능, 하드코딩 금지) ──
INSERT INTO settings (category, key, value, description) VALUES
  ('assembly', 'assembly_enabled', 'true', '합체 슈퍼유닛 기능 활성'),
  ('assembly', 'assembly_unit_code', '"pilgrim_voltaris"', '기본 합체체 코드'),
  ('assembly', 'assembly_part_count', '5', '합체에 필요한 파츠 종류 수'),
  ('assembly', 'assembly_assemble_gp_cost', '0', '합체 1회 GP 비용 (P1: 0, P3 튜닝)'),
  ('assembly', 'assembly_dup_shard_yield', '15', '중복 파츠 1개 분해 시 획득 조각'),
  ('assembly', 'assembly_shard_exchange_cost', '40', '파츠 1개 교환에 필요한 조각'),
  ('assembly', 'assembly_max_per_player', '1', '계정당 보유 합체체 상한'),
  ('assembly', 'assembly_disassemble_enabled', 'true', '분해 허용 여부')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('279_assembly_core.sql') ON CONFLICT DO NOTHING;
