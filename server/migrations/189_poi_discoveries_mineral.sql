-- Migration 189: Allow mineral POI discovery logs
-- 188 added mineral rewards to exploration_pois, but poi_discoveries kept the
-- older pp/gp/item/xp CHECK constraint. Mineral discoveries rolled back at log
-- insert time and surfaced to players as "Discovery failed".

ALTER TABLE poi_discoveries DROP CONSTRAINT IF EXISTS poi_discoveries_reward_type_check;
ALTER TABLE poi_discoveries ADD CONSTRAINT poi_discoveries_reward_type_check
  CHECK (reward_type::text = ANY (ARRAY['pp','gp','item','xp','mineral']::text[]));

