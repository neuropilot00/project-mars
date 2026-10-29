-- Preserve custom catalog values and the earlier effective 400ms cruiser cadence.
UPDATE ship_types
SET fire_interval = 400
WHERE code = 'cv_crs' AND fire_interval = 225;
