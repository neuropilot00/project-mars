-- 283_assembly_more_units_and_box.sql
-- 퍼펙트 가챠 유닛 4종 추가(전부 5파츠 통일) + 단일 "퍼펙트 가챠 박스"(여러 유닛 파츠가 한 박스에서 드롭) 설정.
-- 스탯은 중상위(타이탄급 generalist, 단일 최고스탯 초과 금지). size_class='assembled', faction='pilgrim'.

-- ── 신규 합체체 ship_types 4종 ──
INSERT INTO ship_types (code,faction_code,size_class,role,tier,name_en,name_ko,name_ja,name_zh,class_label,description_en,description_ko,base_hp,base_atk,base_def,base_speed,fire_interval,fire_type,shots,render_radius,build_time_seconds,min_player_rank,build_gp_cost,recipe_minerals,is_capital,is_flagship_capable,is_active,sort_order) VALUES
 ('pilgrim_ignis','pilgrim','assembled','dps',5,'Ignis','이그니스','イグニス','燃焰',
   'Assembled Unit','Pilgrim Arms assault combination mech.','필그림 아머스 강습 합체병기.',
   1600000,890,560,0.17,455,'laser',1,14,0,0,0,'{}'::jsonb,true,true,true,102),
 ('pilgrim_glacius','pilgrim','assembled','dps',5,'Glacius','글라키우스','グラキウス','寒霜',
   'Assembled Unit','Pilgrim Arms fortress combination mech.','필그림 아머스 요새형 합체병기.',
   1900000,700,720,0.14,455,'laser',1,14,0,0,0,'{}'::jsonb,true,true,true,103),
 ('pilgrim_umbra','pilgrim','assembled','dps',5,'Umbra','움브라','ウンブラ','幽影',
   'Assembled Unit','Pilgrim Arms stealth EW combination mech.','필그림 아머스 은신 전자전 합체병기.',
   1600000,840,600,0.18,455,'laser',1,14,0,0,0,'{}'::jsonb,true,true,true,104),
 ('pilgrim_aurum','pilgrim','assembled','dps',5,'Aurum','아우룸','アウルム','黄金',
   'Assembled Unit','Pilgrim Arms command titan combination mech.','필그림 아머스 지휘 타이탄 합체병기.',
   1850000,830,680,0.15,455,'laser',1,14,0,0,0,'{}'::jsonb,true,true,true,105)
ON CONFLICT (code) DO NOTHING;

-- ── 유닛 카탈로그 4종 ──
INSERT INTO assembly_units (unit_code,ship_type_code,kind,name_en,name_ko,name_ja,name_zh,icon_emoji,faction_code,season_code,part_count,gacha_price_gp,hard_pity_pulls,dup_shard_yield,shard_exchange_cost,assemble_gp_cost,max_per_player,sort_order) VALUES
 ('pilgrim_ignis','pilgrim_ignis','robot','Ignis','이그니스','イグニス','燃焰','🔥','pilgrim','permanent',5,500,30,15,40,0,1,2),
 ('pilgrim_glacius','pilgrim_glacius','robot','Glacius','글라키우스','グラキウス','寒霜','❄️','pilgrim','permanent',5,500,30,15,40,0,1,3),
 ('pilgrim_umbra','pilgrim_umbra','robot','Umbra','움브라','ウンブラ','幽影','🌑','pilgrim','permanent',5,500,30,15,40,0,1,4),
 ('pilgrim_aurum','pilgrim_aurum','robot','Aurum','아우룸','アウルム','黄金','👑','pilgrim','permanent',5,500,30,15,40,0,1,5)
ON CONFLICT (unit_code) DO NOTHING;

-- ── 파츠 5종 × 4유닛 (통일 스킴: scout/assault/artillery/shield/command) ──
INSERT INTO assembly_parts (part_code,unit_code,slot,name_en,name_ko,name_ja,name_zh,icon_emoji,sort_order) VALUES
 ('ignis_scout','pilgrim_ignis',1,'Scout Core','스카우트 코어','スカウトコア','侦察核心','🛰',1),
 ('ignis_assault','pilgrim_ignis',2,'Assault Limb','돌격 유닛','アサルト','突击单元','⚔',2),
 ('ignis_artillery','pilgrim_ignis',3,'Artillery Limb','포격 유닛','アーティラリー','炮击单元','☄',3),
 ('ignis_shield','pilgrim_ignis',4,'Shield Limb','방패 유닛','シールド','防护单元','🛡',4),
 ('ignis_command','pilgrim_ignis',5,'Command Core','지휘 코어','コマンドコア','指挥核心','🜲',5),
 ('glacius_scout','pilgrim_glacius',1,'Scout Core','스카우트 코어','スカウトコア','侦察核心','🛰',1),
 ('glacius_assault','pilgrim_glacius',2,'Assault Limb','돌격 유닛','アサルト','突击单元','⚔',2),
 ('glacius_artillery','pilgrim_glacius',3,'Artillery Limb','포격 유닛','アーティラリー','炮击单元','☄',3),
 ('glacius_shield','pilgrim_glacius',4,'Shield Limb','방패 유닛','シールド','防护单元','🛡',4),
 ('glacius_command','pilgrim_glacius',5,'Command Core','지휘 코어','コマンドコア','指挥核心','🜲',5),
 ('umbra_scout','pilgrim_umbra',1,'Scout Core','스카우트 코어','スカウトコア','侦察核心','🛰',1),
 ('umbra_assault','pilgrim_umbra',2,'Assault Limb','돌격 유닛','アサルト','突击单元','⚔',2),
 ('umbra_artillery','pilgrim_umbra',3,'Artillery Limb','포격 유닛','アーティラリー','炮击单元','☄',3),
 ('umbra_shield','pilgrim_umbra',4,'Shield Limb','방패 유닛','シールド','防护单元','🛡',4),
 ('umbra_command','pilgrim_umbra',5,'Command Core','지휘 코어','コマンドコア','指挥核心','🜲',5),
 ('aurum_scout','pilgrim_aurum',1,'Scout Core','스카우트 코어','スカウトコア','侦察核心','🛰',1),
 ('aurum_assault','pilgrim_aurum',2,'Assault Limb','돌격 유닛','アサルト','突击单元','⚔',2),
 ('aurum_artillery','pilgrim_aurum',3,'Artillery Limb','포격 유닛','アーティラリー','炮击单元','☄',3),
 ('aurum_shield','pilgrim_aurum',4,'Shield Limb','방패 유닛','シールド','防护单元','🛡',4),
 ('aurum_command','pilgrim_aurum',5,'Command Core','지휘 코어','コマンドコア','指挥核心','🜲',5)
ON CONFLICT (part_code) DO NOTHING;

-- ── 단일 퍼펙트 가챠 박스 설정 (활성 유닛 전체 파츠 풀에서 드롭) ──
INSERT INTO settings (category, key, value, description) VALUES
  ('assembly', 'assembly_box_enabled', 'true', '퍼펙트 가챠 박스 활성'),
  ('assembly', 'assembly_box_price_gp', '700', '박스 1회 GP 가격'),
  ('assembly', 'assembly_box_hard_pity', '50', '박스 하드천장(풀 큼 — 누적 N회 시 미보유 파츠 확정)'),
  ('assembly', 'assembly_box_dup_shard_yield', '15', '박스 중복→조각')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('283_assembly_more_units_and_box.sql') ON CONFLICT DO NOTHING;
