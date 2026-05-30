-- 285_assembly_lore.sql
-- 합체 유닛 10종(로봇6+외계4) 세계관 설명. ship_types.description_ko/en 갱신.
-- 로봇 = Pilgrim Arms 봉인 합체병기 / 외계 = 화성 심층에서 깨어난 거대 생물함.

-- ── 로봇 6종 ──
UPDATE ship_types SET
 description_ko='필그림 아머스가 가장 먼저 봉인한 0호기. 다섯 부품이 하나로 결합하면 어떤 전선에도 대응하는 균형형 주력기가 된다. 쌍열 레이저포는 과하지도 모자라지도 않게, 정확히 적의 약점을 태운다.',
 description_en='Pilgrim Arms'' sealed prototype Unit-0. When its five parts combine it becomes a perfectly balanced frontline striker. Its twin laser cannons burn exactly where the enemy is weakest — no more, no less.'
WHERE code='pilgrim_voltaris';

UPDATE ship_types SET
 description_ko='용광로를 심장으로 단 강습 합체병기. 전신의 미사일 포드가 일제히 열리면 하늘이 불비로 뒤덮인다. 전함과 타이탄 같은 거대 표적을 통째로 무너뜨리기 위해 만들어졌다.',
 description_en='An assault unit with a furnace for a heart. When every missile pod on its frame opens at once, the sky fills with raining fire. Built to bring down battleships and titans whole.'
WHERE code='pilgrim_ignis';

UPDATE ship_types SET
 description_ko='움직이는 요새. 극저온 합금 장갑과 어깨에 얹은 거대 레일건으로, 전열을 홀로 틀어막는다. 글라키우스가 버티는 한 아군의 후방은 결코 무너지지 않는다.',
 description_en='A walking fortress. With cryo-alloy plating and a massive shoulder railgun, it holds the line alone. As long as Glacius stands, the rear never breaks.'
WHERE code='pilgrim_glacius';

UPDATE ship_types SET
 description_ko='전장의 유령. 광학 위장 패널과 디스럽터 가시로 적의 조준과 통신을 마비시킨다. 적이 방아쇠를 당기기도 전에 전열은 이미 무너져 있다.',
 description_en='The ghost of the battlefield. Cloaking panels and disruptor spines jam enemy targeting and comms. The enemy line collapses before a single trigger is pulled.'
WHERE code='pilgrim_umbra';

UPDATE ship_types SET
 description_ko='필그림 아머스의 지휘 기함. 황금 장갑 안에 봉인된 정밀 랜스는 전장 끝에서도 대형함의 심장을 정확히 꿰뚫는다. 그 한 발이 전투의 결말을 정한다.',
 description_en='Pilgrim Arms'' command flagship. The precision lance sealed within its gilded armor pierces a capital ship''s heart from across the battlefield. A single shot decides the battle.'
WHERE code='pilgrim_aurum';

UPDATE ship_types SET
 description_ko='가장 마지막에 깨어난 고속 선봉기. 번개를 두른 추진기로 전선을 가장 먼저 돌파해, 스웜 기관포로 소형함과 호위막을 순식간에 찢어발긴다. 적 기함에게 도달하는 첫 번째 칼날이다.',
 description_en='The last to awaken — a high-speed vanguard. Lightning-wreathed thrusters breach the line first, swarm autocannons shred small ships and screens in an instant. The first blade to reach the enemy flagship.'
WHERE code='pilgrim_tempest';

-- ── 외계 거대생물함 4종 ──
UPDATE ship_types SET
 description_ko='화성 심층 동굴에서 끌려 올라온 가오리형 거대 생명체. 막처럼 펼쳐진 날개를 따라 늘어선 산성 주머니가 광역으로 부식 에너지를 분사한다. 함대 한 무리를 한 번에 녹여버린다.',
 description_en='A colossal manta-shaped organism dragged up from Mars'' deep caverns. Acid pods lining its membrane wings spray corrosive energy across a wide area, melting an entire formation at once.'
WHERE code='alien_devourer';

UPDATE ship_types SET
 description_ko='전함만 한 거대 갑각 생명체. 결정질 외피는 어지간한 포격을 통째로 튕겨낸다. 느리지만 무엇으로도 멈출 수 없으며, 함대의 모든 화력을 제 몸으로 받아낸다.',
 description_en='A battleship-sized armored leviathan. Its crystalline carapace deflects nearly any bombardment. Slow but unstoppable, it soaks an entire fleet''s firepower on its own body.'
WHERE code='alien_leviathan';

UPDATE ship_types SET
 description_ko='산호초처럼 자라난 군체 생명체. 몸 곳곳의 발광 주머니에서 끝없이 무리 포자를 토해낸다. 셀 수 없는 포자떼가 소형함을 에워싸 산 채로 집어삼킨다.',
 description_en='A colony organism grown like a living reef. Glowing pods across its body endlessly spew swarm spores. Countless spore-broods surround small ships and devour them alive.'
WHERE code='alien_hive';

UPDATE ship_types SET
 description_ko='하나의 거대한 눈을 가진 두족류형 생명체. 코어가 완전히 충전되면, 별조차 꿰뚫을 듯한 단일 에너지 랜스를 토해낸다. 그 한 줄기에 대형함이 통째로 사라진다.',
 description_en='A cephalopod-shaped organism with a single immense eye. When its core fully charges, it unleashes one energy lance that could pierce a star — a single beam erases a capital ship whole.'
WHERE code='alien_voidmaw';

INSERT INTO schema_migrations (filename) VALUES ('285_assembly_lore.sql') ON CONFLICT DO NOTHING;
