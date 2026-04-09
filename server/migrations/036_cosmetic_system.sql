-- Cosmetic system: decorative items for land customization + infamy tracking

-- Add cosmetic items to existing item_types table
INSERT INTO item_types (code, name, description, category, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack) VALUES
  ('neon_border',      'Neon Border',      'Glowing cyan neon outline.',          'cosmetic', 3.0,  3.0,  0, 0, '💠', 99),
  ('flame_border',     'Flame Border',     'Fiery orange border effect.',         'cosmetic', 5.0,  5.0,  0, 0, '🔥', 99),
  ('ice_border',       'Ice Border',       'Frozen crystalline border.',          'cosmetic', 5.0,  5.0,  0, 0, '❄️', 99),
  ('gold_border',      'Gold Border',      'Prestigious gold trim.',              'cosmetic', 15.0, 15.0, 0, 0, '👑', 99),
  ('pulse_glow',       'Pulse Glow',       'Rhythmic pulsing aura.',             'cosmetic', 4.0,  4.0,  0, 0, '💫', 99),
  ('rainbow_glow',     'Rainbow Glow',     'Shifting spectrum glow.',            'cosmetic', 8.0,  8.0,  0, 0, '🌈', 99),
  ('dark_aura',        'Dark Aura',        'Ominous dark energy.',               'cosmetic', 6.0,  6.0,  0, 0, '🌑', 99),
  ('volcanic_terrain', 'Volcanic Terrain',  'Lava-tinted territory fill.',       'cosmetic', 5.0,  5.0,  0, 0, '🌋', 99),
  ('frozen_terrain',   'Frozen Terrain',    'Ice-blue territory fill.',          'cosmetic', 5.0,  5.0,  0, 0, '🧊', 99),
  ('crystal_terrain',  'Crystal Terrain',   'Purple crystal tint.',             'cosmetic', 7.0,  7.0,  0, 0, '💎', 99),
  ('toxic_terrain',    'Toxic Terrain',     'Green toxic haze overlay.',         'cosmetic', 5.0,  5.0,  0, 0, '☣️', 99)
ON CONFLICT (code) DO NOTHING;

-- Equipped cosmetics per claim (one cosmetic per type per claim)
CREATE TABLE IF NOT EXISTS user_cosmetics (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  claim_id INT NOT NULL,
  cosmetic_type VARCHAR(20) NOT NULL CHECK (cosmetic_type IN ('border', 'glow', 'terrain')),
  cosmetic_code VARCHAR(30) NOT NULL,
  equipped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(claim_id, cosmetic_type)
);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_wallet ON user_cosmetics(wallet);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_claim ON user_cosmetics(claim_id);

-- Infamy tracking: hijack count on users table
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS hijack_count INT DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
