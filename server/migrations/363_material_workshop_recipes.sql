-- Convert only untouched seeded consumable recipes into deterministic material assembly.
-- No balance, inventory, payment price, mission reward or historical log is rewritten.
-- Some installations have NUMERIC(6,4), which cannot represent 100 percent.
-- Widen only its integer portion; never reduce an operator's existing precision/scale.
DO $$
DECLARE precision_now integer; scale_now integer;
BEGIN
  SELECT numeric_precision, numeric_scale INTO precision_now, scale_now
  FROM information_schema.columns
  WHERE table_schema=current_schema() AND table_name='crafting_recipes' AND column_name='success_rate';
  IF precision_now IS NOT NULL AND scale_now IS NOT NULL AND precision_now-scale_now<3 THEN
    EXECUTE format('ALTER TABLE crafting_recipes ALTER COLUMN success_rate TYPE NUMERIC(%s,%s)',scale_now+3,scale_now);
  END IF;
END $$;

WITH policy(name, category, item_code, shop_gp, old_gp, old_rate, old_qty, old_ingredients, new_qty, new_ingredients) AS (
  VALUES
  ('에너지 실드 제작','defense','shield_basic',10,50,80,1,'[{"code":"iron_ore","qty":5},{"code":"silicon_chip","qty":3}]'::jsonb,1,'[{"code":"iron_ore","qty":1}]'::jsonb),
  ('플라즈마 실드 제작','defense','shield_advanced',20,150,65,1,'[{"code":"titanium_alloy","qty":3},{"code":"plasma_crystal","qty":2}]'::jsonb,3,'[{"code":"titanium_alloy","qty":1}]'::jsonb),
  ('EMP 공격 제작','attack','emp_strike',14,80,75,1,'[{"code":"iron_ore","qty":4},{"code":"silicon_chip","qty":4}]'::jsonb,3,'[{"code":"iron_ore","qty":1},{"code":"silicon_chip","qty":1}]'::jsonb),
  ('화성의 분노 제작','attack','attack_boost',8,200,60,1,'[{"code":"exotic_alloy","qty":1},{"code":"iron_ore","qty":5}]'::jsonb,3,'[{"code":"iron_ore","qty":1},{"code":"carbon_fiber","qty":1}]'::jsonb),
  ('레이더 스캔 제작','utility','radar_scan',4,60,85,2,'[{"code":"silicon_chip","qty":5},{"code":"carbon_fiber","qty":2}]'::jsonb,5,'[{"code":"silicon_chip","qty":1}]'::jsonb),
  ('스텔스 망토 제작','utility','stealth_cloak',6,180,70,1,'[{"code":"dark_matter","qty":1},{"code":"silicon_chip","qty":3}]'::jsonb,3,'[{"code":"carbon_fiber","qty":1}]'::jsonb),
  ('채굴 부스트 제작','boost','mining_boost',12,100,80,2,'[{"code":"carbon_fiber","qty":3},{"code":"silicon_chip","qty":3}]'::jsonb,2,'[{"code":"carbon_fiber","qty":1},{"code":"iron_ore","qty":1}]'::jsonb),
  ('픽셀 더블러 제작','boost','pixel_doubler',16,300,55,1,'[{"code":"quantum_core","qty":1},{"code":"titanium_alloy","qty":2}]'::jsonb,2,'[{"code":"silicon_chip","qty":1},{"code":"iron_ore","qty":1}]'::jsonb)
)
UPDATE crafting_recipes cr
SET ingredients=p.new_ingredients, output_qty=p.new_qty, gp_cost=0, success_rate=100, fail_refund_pct=0
FROM policy p, item_types it
WHERE cr.name=p.name AND cr.category=p.category AND cr.output_item_type_id=it.id
  AND it.code=p.item_code AND it.active=true AND it.price_gp=p.shop_gp
  AND it.max_stack>=p.new_qty AND cr.is_active=true
  AND cr.gp_cost=p.old_gp AND cr.success_rate=p.old_rate AND cr.output_qty=p.old_qty
  AND cr.fail_refund_pct=50 AND cr.ingredients=p.old_ingredients
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.new_ingredients) ingredient
    WHERE NOT EXISTS (SELECT 1 FROM resources r WHERE r.code=ingredient->>'code' AND r.is_active=true)
  );

INSERT INTO schema_migrations(filename) VALUES ('363_material_workshop_recipes.sql') ON CONFLICT DO NOTHING;
