-- Migration 112: Territory Upgrades
-- Players permanently spend GP to upgrade their territories.
-- 4 upgrade types × 5 levels each.
-- Upgrade bonuses: mine_booster (+PP yield), fortress (+defense), beacon (+GP), vault (+storage).
-- Upgrades are destroyed on hijack — attackers can capture the land but the upgrades burn.

CREATE TABLE IF NOT EXISTS territory_upgrades (
  id             SERIAL PRIMARY KEY,
  claim_id       INT            NOT NULL,                -- references claims.id
  owner          VARCHAR(100)   NOT NULL,
  upgrade_type   VARCHAR(30)    NOT NULL,                -- mine_booster | fortress | beacon | vault
  level          SMALLINT       NOT NULL DEFAULT 1,      -- 1-5
  gp_spent       DECIMAL(20,6)  NOT NULL DEFAULT 0,      -- total GP spent so far on this upgrade
  is_active      BOOLEAN        NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  upgraded_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  destroyed_at   TIMESTAMPTZ,
  UNIQUE(claim_id, upgrade_type)
);

CREATE INDEX IF NOT EXISTS idx_upgrade_claim  ON territory_upgrades(claim_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_upgrade_owner  ON territory_upgrades(owner) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_upgrade_type   ON territory_upgrades(upgrade_type, level) WHERE is_active = true;

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('upgrade_enabled',             'true',               'Enable territory upgrade system',                               'upgrade'),
  ('upgrade_max_per_claim',       '4',                  'Maximum upgrade types per territory (each type upgradeable)',   'upgrade'),
  ('upgrade_max_level',           '5',                  'Maximum upgrade level (1-5)',                                   'upgrade'),
  ('upgrade_destroy_on_hijack',   'true',               'Destroy upgrades when territory is hijacked',                   'upgrade'),

  -- mine_booster: +20/40/60/80/100% PP per mining cycle
  ('upgrade_mine_booster_costs',  '100,250,500,1000,2500', 'GP cost for mine_booster levels 1-5 (comma-separated)',     'upgrade'),
  ('upgrade_mine_booster_bonus',  '20,40,60,80,100',       'PP% bonus for mine_booster levels 1-5',                    'upgrade'),

  -- fortress: +15/30/50/70/90% defense bonus (applied to hijack defense roll)
  ('upgrade_fortress_costs',      '150,350,750,1500,3500', 'GP cost for fortress levels 1-5',                          'upgrade'),
  ('upgrade_fortress_bonus',      '15,30,50,70,90',        'Defense % bonus for fortress levels 1-5',                  'upgrade'),

  -- beacon: +10/20/35/50/75% GP earn bonus from battles/POI in this territory
  ('upgrade_beacon_costs',        '80,200,450,900,2200',   'GP cost for beacon levels 1-5',                            'upgrade'),
  ('upgrade_beacon_bonus',        '10,20,35,50,75',        'GP% bonus for beacon levels 1-5',                         'upgrade'),

  -- vault: doubles storage cap (currently cosmetic — ready for future storage mechanic)
  ('upgrade_vault_costs',         '120,300,650,1300,3000', 'GP cost for vault levels 1-5',                             'upgrade'),
  ('upgrade_vault_bonus',         '25,50,75,100,150',      'Storage % bonus for vault levels 1-5',                    'upgrade')

ON CONFLICT (key) DO NOTHING;
