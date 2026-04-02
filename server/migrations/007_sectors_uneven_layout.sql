-- ═══════════════════════════════════════════════════════
--  007: Sectors — uneven layout, Core = SMALL & scarce
--  Core: 40-45° wide (small, valuable)
--  Mid: 60-100° wide (medium)
--  Frontier: 70-100° wide (huge, cheap)
--  5 lat bands, irregular lng divisions, no gaps
-- ═══════════════════════════════════════════════════════

DELETE FROM sectors;
ALTER SEQUENCE sectors_id_seq RESTART WITH 1;

INSERT INTO sectors (name, tier, center_lat, center_lng, lat_min, lat_max, lng_min, lng_max, base_price) VALUES
  -- ── BAND A: North Polar (lat 45~70, 25° tall) — 4 FRONTIER ──
  ('Vastitas Borealis',   'frontier',  57.5, -135.0,   45.0, 70.0, -180.0, -90.0,  0.02),
  ('Arcadia Planitia',    'frontier',  57.5,  -40.0,   45.0, 70.0,  -90.0,  10.0,  0.02),
  ('Utopia Planitia',     'frontier',  57.5,   55.0,   45.0, 70.0,   10.0, 100.0,  0.02),
  ('Tempe Terra',         'frontier',  57.5,  140.0,   45.0, 70.0,  100.0, 180.0,  0.02),

  -- ── BAND B: North Mid (lat 10~45, 35° tall) — 1F + 2C + 3M ──
  ('Amazonis Planitia',   'frontier',  27.5, -145.0,   10.0, 45.0, -180.0,-110.0,  0.02),
  ('Olympus Mons',        'core',      27.5,  -90.0,   10.0, 45.0, -110.0, -70.0,  0.15),
  ('Tharsis Plateau',     'mid',       27.5,  -40.0,   10.0, 45.0,  -70.0, -10.0,  0.05),
  ('Syrtis Major',        'mid',       27.5,   20.0,   10.0, 45.0,  -10.0,  50.0,  0.05),
  ('Elysium Mons',        'core',      27.5,   70.0,   10.0, 45.0,   50.0,  90.0,  0.15),
  ('Arabia Terra',        'mid',       27.5,  135.0,   10.0, 45.0,   90.0, 180.0,  0.05),

  -- ── BAND C: Equatorial (lat -15~10, 25° tall) — 3M + 1F ──
  ('Terra Sirenum',       'mid',       -2.5, -130.0,  -15.0, 10.0, -180.0, -80.0,  0.05),
  ('Chryse Planitia',     'mid',       -2.5,  -40.0,  -15.0, 10.0,  -80.0,   0.0,  0.05),
  ('Hesperia Planum',     'mid',       -2.5,   45.0,  -15.0, 10.0,    0.0,  90.0,  0.05),
  ('Tyrrhena Terra',      'frontier',  -2.5,  135.0,  -15.0, 10.0,   90.0, 180.0,  0.02),

  -- ── BAND D: South Mid (lat -45~-15, 30° tall) — 2F + 2C + 2M ──
  ('Daedalia Planum',     'frontier', -30.0, -145.0,  -45.0,-15.0, -180.0,-110.0,  0.02),
  ('Valles Marineris',    'core',     -30.0,  -87.5,  -45.0,-15.0, -110.0, -65.0,  0.15),
  ('Noachis Terra',       'mid',      -30.0,  -32.5,  -45.0,-15.0,  -65.0,   0.0,  0.05),
  ('Hellas Basin',        'core',     -30.0,   22.5,  -45.0,-15.0,    0.0,  45.0,  0.15),
  ('Promethei Terra',     'mid',      -30.0,   77.5,  -45.0,-15.0,   45.0, 110.0,  0.05),
  ('Lunae Planum',        'frontier', -30.0,  145.0,  -45.0,-15.0,  110.0, 180.0,  0.02),

  -- ── BAND E: South Polar (lat -70~-45, 25° tall) — 4 FRONTIER ──
  ('Aonia Terra',         'frontier', -57.5, -135.0,  -70.0,-45.0, -180.0, -90.0,  0.02),
  ('Argyre Basin',        'frontier', -57.5,  -45.0,  -70.0,-45.0,  -90.0,   0.0,  0.02),
  ('Malea Planum',        'frontier', -57.5,   50.0,  -70.0,-45.0,    0.0, 100.0,  0.02),
  ('Terra Cimmeria',      'frontier', -57.5,  140.0,  -70.0,-45.0,  100.0, 180.0,  0.02);
