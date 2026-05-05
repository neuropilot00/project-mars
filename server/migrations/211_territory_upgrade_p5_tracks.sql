-- Migration 211: P5 Territory Upgrade Tracks
-- Adds extractor/refinery/shield_grid/relay_tower/art_beacon upgrade type settings.
-- These augment production (extractor → material drop boost),
-- defense (shield_grid), sector visibility (relay_tower), and PP (art_beacon).
-- Works with existing territory_upgrades table (upgrade_type is VARCHAR).

-- Extractor: boosts material drop quantity/chance
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_extractor_enabled',       'true',         'Enable Extractor upgrade track'),
  ('territory', 'upgrade_extractor_costs',         '"50,150,350,800,2000"', 'GP costs per level (comma-separated)'),
  ('territory', 'upgrade_extractor_bonus',         '"15,30,50,75,100"',    'Material drop bonus % per level'),
  ('territory', 'upgrade_extractor_mat_costs',     '"iron_dust:2,iron_dust:5,basalt_chip:3,basalt_chip:6,regolith_ore:4"',
                                                                   'Additional material cost per level')
ON CONFLICT (key) DO NOTHING;

-- Refinery: converts common materials into advanced chance
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_refinery_enabled',        'true',         'Enable Refinery upgrade track'),
  ('territory', 'upgrade_refinery_costs',          '"80,200,500,1200,3000"', 'GP costs per level'),
  ('territory', 'upgrade_refinery_bonus',          '"5,12,22,35,50"',      'Advanced material chance bonus % per level'),
  ('territory', 'upgrade_refinery_mat_costs',      '"iron_dust:3,silicon_chip:2,silicon_chip:4,nano_polymer:2,nano_polymer:5"',
                                                                   'Additional material cost per level')
ON CONFLICT (key) DO NOTHING;

-- Shield Grid: hijack defense boost + shield duration
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_shield_grid_enabled',     'true',         'Enable Shield Grid upgrade track'),
  ('territory', 'upgrade_shield_grid_costs',       '"120,300,700,1600,4000"', 'GP costs per level'),
  ('territory', 'upgrade_shield_grid_bonus',       '"10,22,38,55,75"',     'Defense bonus % per level'),
  ('territory', 'upgrade_shield_grid_mat_costs',   '"ice_crystal:2,ice_crystal:4,plasma_crystal:2,plasma_crystal:4,plasma_dust:3"',
                                                                   'Additional material cost per level')
ON CONFLICT (key) DO NOTHING;

-- Relay Tower: sector visibility, objective support, range
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_relay_tower_enabled',     'true',         'Enable Relay Tower upgrade track'),
  ('territory', 'upgrade_relay_tower_costs',       '"60,160,380,900,2200"', 'GP costs per level'),
  ('territory', 'upgrade_relay_tower_bonus',       '"1,2,3,4,5"',          'Sector visibility radius bonus per level'),
  ('territory', 'upgrade_relay_tower_mat_costs',   '"iron_dust:1,carbon_fiber:2,carbon_fiber:4,silicon_chip:3,silicon_chip:6"',
                                                                   'Additional material cost per level')
ON CONFLICT (key) DO NOTHING;

-- Art Beacon: image/brand visibility, small PP bonus
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_art_beacon_enabled',      'true',         'Enable Art Beacon upgrade track'),
  ('territory', 'upgrade_art_beacon_costs',        '"40,100,250,600,1500"', 'GP costs per level'),
  ('territory', 'upgrade_art_beacon_bonus',        '"3,6,10,15,20"',       'PP yield bonus % per level'),
  ('territory', 'upgrade_art_beacon_mat_costs',    '",,,,,"',              'No material cost — GP only')
ON CONFLICT (key) DO NOTHING;

-- Global P5 upgrade settings
INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'upgrade_p5_max_level',            '5',            'Max level for P5 upgrade tracks'),
  ('territory', 'upgrade_p5_enabled',              'true',         'Enable P5 territory upgrade tracks')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('211_territory_upgrade_p5_tracks.sql') ON CONFLICT DO NOTHING;
