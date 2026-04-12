-- 066: Add 12 new shop items across all categories
-- USDT price = PP price × 0.8

INSERT INTO item_types (code, name, description, category, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack) VALUES
  -- Defense
  ('shield_regen',   'Regenerating Shield',  'Auto-repairs 25% HP every 4h. Lasts 18h.',                  'defense',  4.0,  3.20,  18, 25,   '🔄', 5),
  ('decoy_beacon',   'Decoy Beacon',         'Creates a fake territory marker to mislead raiders. 12h.',   'defense',  2.0,  1.60,  12, 1,    '🎭', 5),

  -- Attack
  ('orbital_strike', 'Orbital Strike',       'Deals 100% damage to target shield — guaranteed break.',     'attack',   5.0,  4.00,  NULL, 100, '💥', 3),
  ('virus_payload',  'Virus Payload',        'Reduces target mining rate by 50% for 6h.',                  'attack',   3.0,  2.40,  6,  50,   '🦠', 5),
  ('siege_ram',      'Siege Ram',            'Boosts attack by 40% for your next claim attempt.',          'attack',   3.5,  2.80,  NULL, 40,  '🏛', 5),

  -- Utility
  ('supply_crate',    'Supply Crate',        'Instantly grants a random 0.1–0.5 PP bonus.',                'utility',  1.0,  0.80,  NULL, NULL, '📦', 10),
  ('recall_beacon',   'Recall Beacon',       'Instantly completes one active OPS mission.',                 'utility',  2.5,  2.00,  NULL, NULL, '🔔', 5),
  ('territory_scan',  'Territory Scanner',   'Shows all players'' territory sizes in your sector.',        'utility',  1.5,  1.20,  NULL, NULL, '🗺', 5),

  -- Boost
  ('harvest_surge',  'Harvest Surge',        'Next harvest gives 3× PP. Single use.',                      'boost',    3.5,  2.80,  NULL, 3,   '🌾', 5),
  ('xp_amplifier',   'XP Amplifier',         'Doubles XP from all sources for 4h.',                        'boost',    2.0,  1.60,  4,  2,    '📈', 5),
  ('gp_generator',   'GP Generator',         'Generates 5 GP per hour for 12h.',                           'boost',    4.0,  3.20,  12, 5,    '🏛', 5),
  ('lucky_charm',    'Lucky Charm',          '+15% cantina win rate for 3h.',                               'boost',    2.5,  2.00,  3,  15,   '🍀', 5)
ON CONFLICT (code) DO NOTHING;
