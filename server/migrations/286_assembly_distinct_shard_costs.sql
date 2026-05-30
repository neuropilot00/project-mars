-- 286_assembly_distinct_shard_costs.sql
-- 조각 교환비용이 유닛/슬롯 전반에서 전부 고유하도록 유닛별 base를 차등 설정.
-- 코드(_slotShardCost)가 base + 슬롯오프셋(0/2/4/6/8)을 적용 → 10유닛×5슬롯=50개 전부 고유(30~128).
UPDATE assembly_units SET shard_exchange_cost = 30  WHERE unit_code='pilgrim_voltaris';
UPDATE assembly_units SET shard_exchange_cost = 40  WHERE unit_code='pilgrim_ignis';
UPDATE assembly_units SET shard_exchange_cost = 50  WHERE unit_code='pilgrim_glacius';
UPDATE assembly_units SET shard_exchange_cost = 60  WHERE unit_code='pilgrim_umbra';
UPDATE assembly_units SET shard_exchange_cost = 70  WHERE unit_code='pilgrim_aurum';
UPDATE assembly_units SET shard_exchange_cost = 80  WHERE unit_code='pilgrim_tempest';
UPDATE assembly_units SET shard_exchange_cost = 90  WHERE unit_code='alien_devourer';
UPDATE assembly_units SET shard_exchange_cost = 100 WHERE unit_code='alien_leviathan';
UPDATE assembly_units SET shard_exchange_cost = 110 WHERE unit_code='alien_hive';
UPDATE assembly_units SET shard_exchange_cost = 120 WHERE unit_code='alien_voidmaw';

INSERT INTO schema_migrations (filename) VALUES ('286_assembly_distinct_shard_costs.sql') ON CONFLICT DO NOTHING;
