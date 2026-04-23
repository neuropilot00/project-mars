-- Migration 143: GP Territory Highlight
-- Territory owners pay GP to make their territory glow/pulse on the map
-- with a custom color for N hours. Visible as a colored border in the map view.

CREATE TABLE IF NOT EXISTS territory_highlights (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL UNIQUE,
  wallet      TEXT         NOT NULL,
  color       VARCHAR(7)   NOT NULL DEFAULT '#ff7840',
  gp_paid_total INTEGER    NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ  NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_highlights_active  ON territory_highlights(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_highlights_wallet  ON territory_highlights(wallet);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('highlight_enabled',    'true', 'highlight', 'Enable Territory Highlight'),
  ('highlight_cost_gp',    '40',   'highlight', 'GP cost per highlight period'),
  ('highlight_duration_h', '24',   'highlight', 'Highlight duration (hours)'),
  ('highlight_max_active', '50',   'highlight', 'Max active highlights (global cap)')
ON CONFLICT (key) DO NOTHING;
