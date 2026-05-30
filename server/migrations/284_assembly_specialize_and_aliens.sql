-- 284_assembly_specialize_and_aliens.sql
-- 1) 기존 합체 로봇 5종 역할/무기 특화(전부 dps/laser → 차별화)
-- 2) 로봇 1종 추가(템페스트) → 로봇 6종
-- 3) 외계 대형생명체 4종 추가(kind='alien', 공격 특화). 전투 프레임은 size_class='assembled' 공유, role/무기로 차별.
-- battleEngine getShipMatchupMult 가 role(tank/sniper/bomb/ewar/tackle/dps) 기반이라 role 배정만으로 특성 자동 반영.

-- ── 1) 기존 로봇 특화 ──
UPDATE ship_types SET role='dps',    fire_type='laser'     WHERE code='pilgrim_voltaris';  -- 균형 주력
UPDATE ship_types SET role='bomb',   fire_type='missile'   WHERE code='pilgrim_ignis';     -- 대형함 폭격
UPDATE ship_types SET role='tank',   fire_type='railgun'   WHERE code='pilgrim_glacius';   -- 요새 방어
UPDATE ship_types SET role='ewar',   fire_type='disruptor' WHERE code='pilgrim_umbra';     -- 전자전 교란
UPDATE ship_types SET role='sniper', fire_type='lance'     WHERE code='pilgrim_aurum';      -- 장거리 저격

-- ── 2) 신규 로봇: 템페스트 (고속 선봉/소형 사냥) ──
INSERT INTO ship_types (code,faction_code,size_class,role,tier,name_en,name_ko,name_ja,name_zh,class_label,description_en,description_ko,base_hp,base_atk,base_def,base_speed,fire_interval,fire_type,shots,render_radius,build_time_seconds,min_player_rank,build_gp_cost,recipe_minerals,is_capital,is_flagship_capable,is_active,sort_order) VALUES
 ('pilgrim_tempest','pilgrim','assembled','tackle',5,'Tempest','템페스트','テンペスト','疾风',
   'Assembled Unit','Pilgrim Arms high-speed vanguard combination mech.','필그림 아머스 고속 선봉 합체병기.',
   1500000,760,520,0.22,300,'swarm',3,14,0,0,0,'{}'::jsonb,true,true,true,106)
ON CONFLICT (code) DO NOTHING;

INSERT INTO assembly_units (unit_code,ship_type_code,kind,name_en,name_ko,name_ja,name_zh,icon_emoji,faction_code,season_code,part_count,gacha_price_gp,hard_pity_pulls,dup_shard_yield,shard_exchange_cost,assemble_gp_cost,max_per_player,sort_order) VALUES
 ('pilgrim_tempest','pilgrim_tempest','robot','Tempest','템페스트','テンペスト','疾风','⚡','pilgrim','permanent',5,500,30,15,40,0,1,6)
ON CONFLICT (unit_code) DO NOTHING;

-- ── 3) 외계 대형생명체 4종 (공격 특화) ──
INSERT INTO ship_types (code,faction_code,size_class,role,tier,name_en,name_ko,name_ja,name_zh,class_label,description_en,description_ko,base_hp,base_atk,base_def,base_speed,fire_interval,fire_type,shots,render_radius,build_time_seconds,min_player_rank,build_gp_cost,recipe_minerals,is_capital,is_flagship_capable,is_active,sort_order) VALUES
 ('alien_devourer','pilgrim','assembled','dps',5,'Devourer','디바우러','ディヴァウラー','吞噬者',
   'Alien Lifeform','Acid-spewing predator beast — wide-area attacker.','산성 광역 포식 생명체.',
   1700000,950,500,0.18,420,'spread',4,15,0,0,0,'{}'::jsonb,true,true,true,110),
 ('alien_leviathan','pilgrim','assembled','tank',5,'Leviathan','레비아탄','リヴァイアサン','利维坦',
   'Alien Lifeform','Colossal abyssal beast with living bio-armor.','거대 생체장갑 심해 거수.',
   2200000,720,800,0.12,500,'plasma',1,16,0,0,0,'{}'::jsonb,true,true,true,111),
 ('alien_hive','pilgrim','assembled','tackle',5,'Hive Queen','하이브 퀸','ハイヴクイーン','蜂巢女王',
   'Alien Lifeform','Spawns swarming broodlings — overwhelms small ships.','군체를 쏟아내는 여왕 생명체.',
   1650000,820,540,0.20,260,'swarm',5,15,0,0,0,'{}'::jsonb,true,true,true,112),
 ('alien_voidmaw','pilgrim','assembled','bomb',5,'Void Maw','보이드 모','ヴォイドモウ','虚口',
   'Alien Lifeform','Devours capital ships whole — single massive strike.','대형함을 통째로 삼키는 한방 포식자.',
   1750000,1050,560,0.15,640,'torpedo',1,16,0,0,0,'{}'::jsonb,true,true,true,113)
ON CONFLICT (code) DO NOTHING;

INSERT INTO assembly_units (unit_code,ship_type_code,kind,name_en,name_ko,name_ja,name_zh,icon_emoji,faction_code,season_code,part_count,gacha_price_gp,hard_pity_pulls,dup_shard_yield,shard_exchange_cost,assemble_gp_cost,max_per_player,sort_order) VALUES
 ('alien_devourer','alien_devourer','alien','Devourer','디바우러','ディヴァウラー','吞噬者','🦠','pilgrim','permanent',5,800,30,15,40,0,1,20),
 ('alien_leviathan','alien_leviathan','alien','Leviathan','레비아탄','リヴァイアサン','利维坦','🐙','pilgrim','permanent',5,800,30,15,40,0,1,21),
 ('alien_hive','alien_hive','alien','Hive Queen','하이브 퀸','ハイヴクイーン','蜂巢女王','🐝','pilgrim','permanent',5,800,30,15,40,0,1,22),
 ('alien_voidmaw','alien_voidmaw','alien','Void Maw','보이드 모','ヴォイドモウ','虚口','👁','pilgrim','permanent',5,800,30,15,40,0,1,23)
ON CONFLICT (unit_code) DO NOTHING;

-- ── 파츠: 로봇은 기계 부위 5종, 외계는 유전자 샘플 5종 ──
-- 템페스트(로봇 5파츠)
INSERT INTO assembly_parts (part_code,unit_code,slot,name_en,name_ko,name_ja,name_zh,icon_emoji,sort_order) VALUES
 ('tempest_scout','pilgrim_tempest',1,'Scout Core','스카우트 코어','スカウトコア','侦察核心','🛰',1),
 ('tempest_assault','pilgrim_tempest',2,'Assault Limb','돌격 유닛','アサルト','突击单元','⚔',2),
 ('tempest_artillery','pilgrim_tempest',3,'Artillery Limb','포격 유닛','アーティラリー','炮击单元','☄',3),
 ('tempest_shield','pilgrim_tempest',4,'Shield Limb','방패 유닛','シールド','防护单元','🛡',4),
 ('tempest_command','pilgrim_tempest',5,'Command Core','지휘 코어','コマンドコア','指挥核心','🜲',5)
ON CONFLICT (part_code) DO NOTHING;

-- 외계 4종 × 유전자 샘플 5종(머리/심장/발톱/외피/촉수)
INSERT INTO assembly_parts (part_code,unit_code,slot,name_en,name_ko,name_ja,name_zh,icon_emoji,sort_order) VALUES
 ('devourer_cortex','alien_devourer',1,'Neural Cortex','신경 피질','神経皮質','神经皮质','🧠',1),
 ('devourer_heart','alien_devourer',2,'Bio Heart','생체 심장','生体心臓','生体心脏','🫀',2),
 ('devourer_claw','alien_devourer',3,'Acid Claw','산성 발톱','酸の爪','酸爪','🦂',3),
 ('devourer_hide','alien_devourer',4,'Chitin Hide','키틴 외피','キチン外皮','甲壳外皮','🐚',4),
 ('devourer_tendril','alien_devourer',5,'Tendril Cluster','촉수 다발','触手群','触手群','🌿',5),
 ('leviathan_cortex','alien_leviathan',1,'Neural Cortex','신경 피질','神経皮質','神经皮质','🧠',1),
 ('leviathan_heart','alien_leviathan',2,'Bio Heart','생체 심장','生体心臓','生体心脏','🫀',2),
 ('leviathan_claw','alien_leviathan',3,'Crush Claw','분쇄 발톱','粉砕の爪','粉碎爪','🦂',3),
 ('leviathan_hide','alien_leviathan',4,'Chitin Hide','키틴 외피','キチン外皮','甲壳外皮','🐚',4),
 ('leviathan_tendril','alien_leviathan',5,'Tendril Cluster','촉수 다발','触手群','触手群','🌿',5),
 ('hive_cortex','alien_hive',1,'Neural Cortex','신경 피질','神経皮質','神经皮质','🧠',1),
 ('hive_heart','alien_hive',2,'Bio Heart','생체 심장','生体心臓','生体心脏','🫀',2),
 ('hive_claw','alien_hive',3,'Brood Claw','군체 발톱','群体の爪','群体爪','🦂',3),
 ('hive_hide','alien_hive',4,'Chitin Hide','키틴 외피','キチン外皮','甲壳外皮','🐚',4),
 ('hive_tendril','alien_hive',5,'Tendril Cluster','촉수 다발','触手群','触手群','🌿',5),
 ('voidmaw_cortex','alien_voidmaw',1,'Neural Cortex','신경 피질','神経皮質','神经皮质','🧠',1),
 ('voidmaw_heart','alien_voidmaw',2,'Bio Heart','생체 심장','生体心臓','生体心脏','🫀',2),
 ('voidmaw_claw','alien_voidmaw',3,'Void Claw','공허 발톱','虚空の爪','虚空爪','🦂',3),
 ('voidmaw_hide','alien_voidmaw',4,'Chitin Hide','키틴 외피','キチン外皮','甲壳外皮','🐚',4),
 ('voidmaw_tendril','alien_voidmaw',5,'Maw Tendril','아가리 촉수','口の触手','口触手','🌿',5)
ON CONFLICT (part_code) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('284_assembly_specialize_and_aliens.sql') ON CONFLICT DO NOTHING;
