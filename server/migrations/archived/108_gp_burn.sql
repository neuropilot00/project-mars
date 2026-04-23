-- Migration 108: GP Burn Sink
-- Players permanently destroy GP to receive exclusive time-limited buffs,
-- cosmetic titles/auras, or rare drop-rate boosts that can't be obtained otherwise.
-- Pure sink: no rollover, no refund — GP is gone forever.

CREATE TABLE IF NOT EXISTS gp_burn_log (
  id          SERIAL PRIMARY KEY,
  wallet      VARCHAR(100)   NOT NULL,
  burn_type   VARCHAR(50)    NOT NULL,   -- 'power_surge' | 'territory_aura' | 'lucky_streak' | 'battle_frenzy' | 'harvest_boost'
  gp_burned   DECIMAL(20,6)  NOT NULL,
  duration_h  INT            NOT NULL,
  expires_at  TIMESTAMPTZ    NOT NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_burn_wallet ON gp_burn_log(wallet, expires_at);

-- Active burn effects (quick lookup for effect checks)
CREATE TABLE IF NOT EXISTS gp_burn_active (
  id          SERIAL PRIMARY KEY,
  wallet      VARCHAR(100)   NOT NULL,
  burn_type   VARCHAR(50)    NOT NULL,
  multiplier  DECIMAL(8,4)   NOT NULL DEFAULT 1.0,
  expires_at  TIMESTAMPTZ    NOT NULL,
  burn_log_id INT REFERENCES gp_burn_log(id) ON DELETE CASCADE,
  UNIQUE (wallet, burn_type)          -- only one active effect per type per wallet
);

CREATE INDEX IF NOT EXISTS idx_gp_burn_active_wallet ON gp_burn_active(wallet);
CREATE INDEX IF NOT EXISTS idx_gp_burn_active_expire ON gp_burn_active(expires_at) WHERE expires_at > NOW();

-- ── Settings ─────────────────────────────────────────────────────────────────
-- burn_types is a JSON array defining each burn option
INSERT INTO game_settings (key, value, description, category) VALUES
  ('burn_enabled',                    'true',   'Enable GP burn sink',                                      'burn'),
  ('burn_power_surge_cost',           '500',    'GP cost for Power Surge (2× GP earning) 24h',             'burn'),
  ('burn_power_surge_hours',          '24',     'Duration (h) for Power Surge',                            'burn'),
  ('burn_power_surge_mult',           '2.0',    'GP earn multiplier for Power Surge',                      'burn'),
  ('burn_territory_aura_cost',        '300',    'GP cost for Territory Aura (cosmetic glow) 48h',          'burn'),
  ('burn_territory_aura_hours',       '48',     'Duration (h) for Territory Aura',                        'burn'),
  ('burn_lucky_streak_cost',          '200',    'GP cost for Lucky Streak (+50% POI drop rate) 12h',       'burn'),
  ('burn_lucky_streak_hours',         '12',     'Duration (h) for Lucky Streak',                           'burn'),
  ('burn_lucky_streak_mult',          '1.5',    'POI drop rate multiplier for Lucky Streak',               'burn'),
  ('burn_battle_frenzy_cost',         '400',    'GP cost for Battle Frenzy (+30% battle GP) 6h',          'burn'),
  ('burn_battle_frenzy_hours',        '6',      'Duration (h) for Battle Frenzy',                         'burn'),
  ('burn_battle_frenzy_mult',         '1.3',    'Battle GP multiplier for Battle Frenzy',                 'burn'),
  ('burn_harvest_boost_cost',         '250',    'GP cost for Harvest Boost (+40% PP mining) 24h',         'burn'),
  ('burn_harvest_boost_hours',        '24',     'Duration (h) for Harvest Boost',                         'burn'),
  ('burn_harvest_boost_mult',         '1.4',    'PP harvest multiplier for Harvest Boost',                'burn')
ON CONFLICT (key) DO NOTHING;
