-- ═══════════════════════════════════════════════════════
--  006: Redesign sectors — full coverage, no gaps
--  4 lat bands × 6 lng columns = 24 sectors
--  Lat: -70 to 70 (4 bands of 35°)
--  Lng: -180 to 180 (6 columns of 60°)
-- ═══════════════════════════════════════════════════════

-- Clear old sectors
DELETE FROM sectors;

-- Reset sequence
ALTER SEQUENCE sectors_id_seq RESTART WITH 1;

-- Row 1: lat 35~70 (North polar) — all FRONTIER
-- Row 2: lat 0~35 (North equatorial) — 2 CORE + 4 MID
-- Row 3: lat -35~0 (South equatorial) — 2 CORE + 4 MID
-- Row 4: lat -70~-35 (South polar) — all FRONTIER

INSERT INTO sectors (name, tier, center_lat, center_lng, lat_min, lat_max, lng_min, lng_max, base_price) VALUES
  -- ── ROW 1: North Polar (lat 35 ~ 70) — FRONTIER ──
  ('Vastitas Borealis',   'frontier',  52.5, -150.0,   35.0, 70.0, -180.0, -120.0, 0.02),
  ('Arcadia Planitia',    'frontier',  52.5,  -90.0,   35.0, 70.0, -120.0,  -60.0, 0.02),
  ('Utopia Planitia',     'frontier',  52.5,  -30.0,   35.0, 70.0,  -60.0,    0.0, 0.02),
  ('Acidalia Planitia',   'frontier',  52.5,   30.0,   35.0, 70.0,    0.0,   60.0, 0.02),
  ('Arabia Terra',        'frontier',  52.5,   90.0,   35.0, 70.0,   60.0,  120.0, 0.02),
  ('Tempe Terra',         'frontier',  52.5,  150.0,   35.0, 70.0,  120.0,  180.0, 0.02),

  -- ── ROW 2: North Equatorial (lat 0 ~ 35) — 2 CORE + 4 MID ──
  ('Amazonis Planitia',   'mid',       17.5, -150.0,    0.0, 35.0, -180.0, -120.0, 0.05),
  ('Olympus Mons',        'core',      17.5,  -90.0,    0.0, 35.0, -120.0,  -60.0, 0.15),
  ('Tharsis Plateau',     'mid',       17.5,  -30.0,    0.0, 35.0,  -60.0,    0.0, 0.05),
  ('Syrtis Major',        'mid',       17.5,   30.0,    0.0, 35.0,    0.0,   60.0, 0.05),
  ('Elysium Mons',        'core',      17.5,   90.0,    0.0, 35.0,   60.0,  120.0, 0.15),
  ('Isidis Planitia',     'mid',       17.5,  150.0,    0.0, 35.0,  120.0,  180.0, 0.05),

  -- ── ROW 3: South Equatorial (lat -35 ~ 0) — 2 CORE + 4 MID ──
  ('Terra Sirenum',       'mid',      -17.5, -150.0,  -35.0,  0.0, -180.0, -120.0, 0.05),
  ('Valles Marineris',    'core',     -17.5,  -90.0,  -35.0,  0.0, -120.0,  -60.0, 0.15),
  ('Chryse Planitia',     'mid',      -17.5,  -30.0,  -35.0,  0.0,  -60.0,    0.0, 0.05),
  ('Terra Cimmeria',      'mid',      -17.5,   30.0,  -35.0,  0.0,    0.0,   60.0, 0.05),
  ('Hellas Basin',         'core',    -17.5,   90.0,  -35.0,  0.0,   60.0,  120.0, 0.15),
  ('Lunae Planum',        'mid',      -17.5,  150.0,  -35.0,  0.0,  120.0,  180.0, 0.05),

  -- ── ROW 4: South Polar (lat -70 ~ -35) — FRONTIER ──
  ('Aonia Terra',         'frontier', -52.5, -150.0,  -70.0, -35.0, -180.0, -120.0, 0.02),
  ('Argyre Basin',        'frontier', -52.5,  -90.0,  -70.0, -35.0, -120.0,  -60.0, 0.02),
  ('Noachis Terra',       'frontier', -52.5,  -30.0,  -70.0, -35.0,  -60.0,    0.0, 0.02),
  ('Promethei Terra',     'frontier', -52.5,   30.0,  -70.0, -35.0,    0.0,   60.0, 0.02),
  ('Daedalia Planum',     'frontier', -52.5,   90.0,  -70.0, -35.0,   60.0,  120.0, 0.02),
  ('Malea Planum',        'frontier', -52.5,  150.0,  -70.0, -35.0,  120.0,  180.0, 0.02);
