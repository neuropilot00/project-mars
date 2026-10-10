-- Migration 212 seeded silicon_dust, but the canonical resource is silicon_chip.
-- Preserve recipe settings, ingredient order, quantities, and custom metadata.
UPDATE crafting_recipes AS recipe
SET ingredients = (
  SELECT jsonb_agg(
    CASE WHEN ingredient->>'resource_code' = 'silicon_dust'
      THEN jsonb_set(
        CASE WHEN ingredient->>'code' = 'silicon_dust'
          THEN jsonb_set(ingredient, '{code}', '"silicon_chip"'::jsonb)
          ELSE ingredient END,
        '{resource_code}', '"silicon_chip"'::jsonb)
      WHEN ingredient->>'code' = 'silicon_dust'
        THEN jsonb_set(ingredient, '{code}', '"silicon_chip"'::jsonb)
      ELSE ingredient
    END ORDER BY ordinal
  )
  FROM jsonb_array_elements(recipe.ingredients) WITH ORDINALITY AS parts(ingredient, ordinal)
)
WHERE jsonb_typeof(recipe.ingredients) = 'array'
  AND (recipe.ingredients @> '[{"code":"silicon_dust"}]'::jsonb
    OR recipe.ingredients @> '[{"resource_code":"silicon_dust"}]'::jsonb)
  AND EXISTS (SELECT 1 FROM resources WHERE code = 'silicon_chip');

INSERT INTO schema_migrations(filename)
VALUES ('348_crafting_silicon_chip.sql')
ON CONFLICT DO NOTHING;
