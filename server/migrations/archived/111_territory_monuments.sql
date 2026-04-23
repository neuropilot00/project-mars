-- Migration 111: Territory Monuments
-- Players permanently spend GP to place a named monument on their territory.
-- Monument shows on the map as a marker with custom icon + message.
-- Costs GP based on territory size. Admin can moderate.
-- Monument is destroyed if territory is hijacked (attackers can also preserve it for a GP fee).

CREATE TABLE IF NOT EXISTS territory_monuments (
  id             SERIAL PRIMARY KEY,
  claim_id       INT            NOT NULL,                -- references claims.id
  owner          VARCHAR(100)   NOT NULL,
  monument_type  VARCHAR(30)    NOT NULL DEFAULT 'pillar', -- pillar | obelisk | shrine | beacon | fortress
  name           VARCHAR(60)    NOT NULL,                -- monument name
  message        VARCHAR(200),                           -- optional inscription
  icon           VARCHAR(20)    NOT NULL DEFAULT '🗿',
  gp_spent       DECIMAL(20,6)  NOT NULL DEFAULT 0,
  is_active      BOOLEAN        NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  destroyed_at   TIMESTAMPTZ,                            -- set when territory is hijacked
  preserved_by   VARCHAR(100),                           -- hijacker who chose to preserve it
  moderated_at   TIMESTAMPTZ,                            -- admin moderation
  moderation_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_monument_claim  ON territory_monuments(claim_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monument_owner  ON territory_monuments(owner) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monument_active ON territory_monuments(is_active, created_at DESC);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('monument_enabled',          'true',  'Enable territory monument system',                      'monument'),
  ('monument_cost_base',        '150',   'Base GP cost for a monument (smallest territories)',     'monument'),
  ('monument_cost_per_pixel',   '0.5',   'Additional GP cost per pixel of territory',             'monument'),
  ('monument_max_per_wallet',   '10',    'Maximum active monuments per wallet',                    'monument'),
  ('monument_max_per_claim',    '1',     'Maximum monuments per territory (0 = unlimited)',        'monument'),
  ('monument_preserve_cost',    '50',    'GP cost for attacker to preserve conquered monument',    'monument'),
  ('monument_name_max_len',     '60',    'Max monument name length',                              'monument'),
  ('monument_msg_max_len',      '200',   'Max monument inscription length',                       'monument')
ON CONFLICT (key) DO NOTHING;
