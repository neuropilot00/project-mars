-- Migration 094: Economy Integration
-- Wire referral commissions + season score tracking into
-- enhancement, marketplace, auction, ship-building, and battle systems.

-- ── 1. Referral commission settings for new trigger types ──────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('referral_enhance_pct',      '2', 'Enhancement GP cost → referral chain commission % (0=off)', 'referral'),
  ('referral_market_buy_pct',   '1', 'Marketplace instant purchase → referral commission % of price', 'referral'),
  ('referral_auction_buy_pct',  '1', 'Auction settlement/buyout → referral commission % of winning bid', 'referral'),
  ('referral_ship_build_pct',   '1', 'Ship construction GP cost → referral commission %', 'referral'),
  ('referral_battle_stake_pct', '0', 'Battle GP stake → referral commission % (0=off by default)', 'referral')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Season score multipliers for new activity categories ───────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('season_mult_enhance',    '1', 'Season score pts per GP spent on enhancement',             'season'),
  ('season_mult_trade',      '5', 'Season score pts per completed marketplace/auction trade',  'season'),
  ('season_mult_naval_win', '20', 'Season score pts per naval battle victory',                'season'),
  ('season_mult_ship_build', '3', 'Season score pts per ship constructed',                    'season')
ON CONFLICT (key) DO NOTHING;

-- ── 3. New tracking columns in season_scores ───────────────────────────────
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS enhancements_done  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trades_completed   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naval_wins         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ships_built        INTEGER NOT NULL DEFAULT 0;
