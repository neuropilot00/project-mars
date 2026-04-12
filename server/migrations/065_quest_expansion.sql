-- 065_quest_expansion.sql
-- Expand quest_templates from 14 to 120 (FREE:50, ACTIVITY:40, SPENDING:30)
-- Clean slate: delete all existing templates first

DELETE FROM quest_templates;

-- =============================================================
-- FREE TIER (50 quests) — 0.01~0.05 PP
-- =============================================================

INSERT INTO quest_templates (tier, quest_type, title_template, description_template, requirement_type, requirement_min, requirement_max, reward_pp_min, reward_pp_max, cooldown_hours) VALUES

-- LOGIN / CONSECUTIVE LOGIN
('free', 'daily',     'Daily Check-In',          'Log in to the colony terminal.',                       'login',             1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Morning Patrol',          'Report for duty — log in today.',                      'login',             1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Colony Roll Call',         'Confirm your presence at base.',                       'login',             1,  1,  0.01, 0.02, 24),
('free', 'streak',    'Steady Colonist',          'Log in {n} days in a row.',                            'consecutive_login', 3,  3,  0.03, 0.05, 0),
('free', 'streak',    'Dedicated Settler',        'Maintain a {n}-day login streak.',                     'consecutive_login', 5,  5,  0.04, 0.05, 0),
('free', 'streak',    'Week-Long Vigil',          'Log in for {n} consecutive days.',                     'consecutive_login', 7,  7,  0.05, 0.05, 0),

-- CLAIM PIXELS
('free', 'daily',     'First Footprint',          'Claim {n} pixel of Mars terrain.',                     'claim_pixels',      1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Small Claim',              'Claim {n} pixels today.',                              'claim_pixels',      3,  3,  0.02, 0.03, 24),
('free', 'daily',     'Land Grab',                'Claim {n} pixels of territory.',                       'claim_pixels',      5,  5,  0.02, 0.04, 24),
('free', 'daily',     'Territory Scout',          'Claim {n} pixels across the map.',                     'claim_pixels',      8,  8,  0.03, 0.05, 24),
('free', 'weekly',    'Expansion Order',          'Claim {n} pixels this week.',                          'claim_pixels',     15, 15,  0.04, 0.05, 168),

-- HARVEST
('free', 'daily',     'Dust Harvest',             'Harvest PP from your territory.',                      'harvest',           1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Resource Sweep',           'Harvest {n} times today.',                             'harvest',           2,  2,  0.02, 0.03, 24),
('free', 'weekly',    'Diligent Farmer',          'Harvest {n} times this week.',                         'harvest',           5,  5,  0.03, 0.05, 168),

-- VIEW SECTORS
('free', 'daily',     'Recon Scan',               'Open the sector map.',                                 'view_sectors',      1,  1,  0.01, 0.01, 24),
('free', 'daily',     'Map Review',               'Check sector status {n} times.',                       'view_sectors',      2,  2,  0.01, 0.02, 24),
('free', 'daily',     'Tactical Overview',        'Review sectors {n} times.',                            'view_sectors',      3,  3,  0.02, 0.03, 24),

-- VIEW LEADERBOARD
('free', 'daily',     'Rank Check',               'View the leaderboard.',                                'view_leaderboard',  1,  1,  0.01, 0.01, 24),
('free', 'daily',     'Know Your Rivals',         'Check rankings {n} times.',                            'view_leaderboard',  2,  2,  0.01, 0.02, 24),
('free', 'weekly',    'Intel Report',             'View leaderboard {n} times.',                          'view_leaderboard',  5,  5,  0.02, 0.03, 168),

-- VISIT BASE
('free', 'daily',     'Base Inspection',          'Open your base dashboard.',                            'visit_base',        1,  1,  0.01, 0.01, 24),
('free', 'daily',     'HQ Briefing',              'Visit base {n} times today.',                          'visit_base',        2,  2,  0.01, 0.02, 24),
('free', 'daily',     'Ops Center Run',           'Check your base {n} times.',                           'visit_base',        3,  3,  0.02, 0.03, 24),

-- CANTINA
('free', 'daily',     'Cantina Break',            'Play a cantina minigame.',                             'cantina_play',      1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Game Night',               'Play {n} cantina games.',                              'cantina_play',      3,  3,  0.02, 0.04, 24),
('free', 'daily',     'Lucky Round',              'Win a cantina game.',                                  'cantina_win',       1,  1,  0.02, 0.03, 24),
('free', 'weekly',    'Cantina Regular',          'Play {n} cantina games.',                              'cantina_play',      7,  7,  0.03, 0.05, 168),

-- GUILD CHAT
('free', 'daily',     'Comms Check',              'Send a guild chat message.',                           'guild_chat',        1,  1,  0.01, 0.01, 24),
('free', 'daily',     'Squad Talk',               'Send {n} guild messages.',                             'guild_chat',        3,  3,  0.01, 0.02, 24),
('free', 'daily',     'Active Comms',             'Send {n} guild messages today.',                       'guild_chat',        5,  5,  0.02, 0.03, 24),
('free', 'weekly',    'Chatterbox',               'Send {n} guild messages.',                             'guild_chat',       15, 15,  0.03, 0.05, 168),

-- HIJACK (light)
('free', 'daily',     'Border Skirmish',          'Hijack {n} enemy pixel.',                              'hijack',            1,  1,  0.02, 0.03, 24),
('free', 'daily',     'Raider Instinct',          'Hijack {n} enemy pixels.',                             'hijack',            2,  2,  0.03, 0.05, 24),

-- MISSIONS (light)
('free', 'daily',     'Scout Launch',             'Launch an exploration mission.',                        'launch_exploration', 1, 1, 0.02, 0.03, 24),
('free', 'daily',     'Sortie Order',             'Launch an invasion mission.',                           'launch_invasion',   1, 1, 0.02, 0.03, 24),
('free', 'weekly',    'Explorer Badge',           'Complete an exploration mission.',                      'complete_exploration', 1, 1, 0.03, 0.05, 168),
('free', 'weekly',    'Combat Veteran',           'Complete an invasion mission.',                         'complete_invasion',  1, 1, 0.03, 0.05, 168),

-- USE ITEM
('free', 'daily',     'Field Kit',                'Use an item from your inventory.',                     'use_item',          1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Gear Up',                  'Use {n} items today.',                                 'use_item',          2,  2,  0.02, 0.03, 24),

-- CLAIM SECTOR / CORE
('free', 'daily',     'Sector Claim',             'Claim pixels in a specific sector.',                   'claim_pixels_sector', 1, 1, 0.02, 0.03, 24),
('free', 'daily',     'Core Probe',               'Claim {n} pixel in a core zone.',                      'claim_core_pixels',   1, 1, 0.02, 0.04, 24),

-- MIXED DAILY VARIETY
('free', 'daily',     'Routine Ops',              'Log in and view the sector map.',                      'login',             1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Patrol Sweep',             'Harvest after checking base.',                         'harvest',           1,  1,  0.01, 0.02, 24),
('free', 'daily',     'Signal Ping',              'Send a message in guild chat.',                        'guild_chat',        1,  1,  0.01, 0.01, 24),
('free', 'daily',     'Daily Recon',              'View sectors and leaderboard.',                        'view_sectors',      1,  1,  0.01, 0.01, 24),
('free', 'daily',     'Terrain Walk',             'Claim {n} pixels today.',                              'claim_pixels',      2,  2,  0.01, 0.03, 24),
('free', 'daily',     'Quick Harvest',            'Harvest once from your land.',                         'harvest',           1,  1,  0.01, 0.02, 24),
('free', 'weekly',    'Weekly Settler',           'Log in {n} days this week.',                           'login',             5,  5,  0.04, 0.05, 168),
('free', 'weekly',    'Map Analyst',              'View sectors {n} times.',                              'view_sectors',      7,  7,  0.03, 0.05, 168),
('free', 'weekly',    'Base Commander',           'Visit base {n} times.',                                'visit_base',        7,  7,  0.03, 0.05, 168);


-- =============================================================
-- ACTIVITY TIER (40 quests) — 0.05~0.25 PP
-- =============================================================

INSERT INTO quest_templates (tier, quest_type, title_template, description_template, requirement_type, requirement_min, requirement_max, reward_pp_min, reward_pp_max, cooldown_hours) VALUES

-- CLAIM PIXELS (scaled up)
('activity', 'daily',   'Land Rush',              'Claim {n} pixels in one day.',                         'claim_pixels',       10, 10, 0.05, 0.10, 24),
('activity', 'daily',   'Territory Push',         'Claim {n} pixels today.',                              'claim_pixels',       15, 15, 0.08, 0.15, 24),
('activity', 'weekly',  'Expansion Campaign',     'Claim {n} pixels this week.',                          'claim_pixels',       30, 30, 0.12, 0.20, 168),
('activity', 'weekly',  'Colony Growth',          'Claim {n} pixels this week.',                          'claim_pixels',       50, 50, 0.15, 0.25, 168),

-- CLAIM SECTOR / CORE
('activity', 'daily',   'Sector Assault',         'Claim {n} pixels in one sector.',                      'claim_pixels_sector', 5, 5, 0.06, 0.12, 24),
('activity', 'daily',   'Core Incursion',         'Claim {n} core zone pixels.',                          'claim_core_pixels',   3, 3, 0.08, 0.15, 24),
('activity', 'weekly',  'Sector Domination',      'Claim {n} sector pixels.',                             'claim_pixels_sector',15,15, 0.12, 0.20, 168),
('activity', 'weekly',  'Core Lockdown',          'Claim {n} core zone pixels.',                          'claim_core_pixels',  10,10, 0.15, 0.25, 168),

-- HARVEST (scaled up)
('activity', 'daily',   'Harvest Cycle',          'Harvest {n} times today.',                             'harvest',             3, 3, 0.05, 0.10, 24),
('activity', 'daily',   'Full Harvest',           'Harvest {n} times in one day.',                        'harvest',             5, 5, 0.08, 0.15, 24),
('activity', 'weekly',  'Harvest Marathon',       'Harvest {n} times this week.',                         'harvest',            15,15, 0.12, 0.20, 168),

-- HIJACK (scaled up)
('activity', 'daily',   'Raid Party',             'Hijack {n} enemy pixels.',                             'hijack',              3, 3, 0.08, 0.15, 24),
('activity', 'daily',   'Hostile Takeover',       'Hijack {n} enemy pixels.',                             'hijack',              5, 5, 0.10, 0.18, 24),
('activity', 'weekly',  'Warlord''s March',       'Hijack {n} pixels this week.',                         'hijack',             15,15, 0.15, 0.25, 168),

-- MISSIONS (scaled up)
('activity', 'daily',   'Double Sortie',          'Launch {n} invasion missions.',                        'launch_invasion',     2, 2, 0.08, 0.12, 24),
('activity', 'daily',   'Recon Fleet',            'Launch {n} exploration missions.',                     'launch_exploration',  2, 2, 0.08, 0.12, 24),
('activity', 'daily',   'Blitz Command',          'Launch {n} invasions today.',                          'launch_invasion',     3, 3, 0.10, 0.18, 24),
('activity', 'weekly',  'Invasion Spree',         'Complete {n} invasion missions.',                      'complete_invasion',   3, 3, 0.12, 0.20, 168),
('activity', 'weekly',  'Expedition Corps',       'Complete {n} explorations.',                           'complete_exploration', 3, 3, 0.12, 0.20, 168),
('activity', 'weekly',  'War Council',            'Launch {n} missions total.',                           'launch_invasion',     5, 5, 0.15, 0.25, 168),
('activity', 'weekly',  'Deep Space Survey',      'Complete {n} explorations.',                           'complete_exploration', 5, 5, 0.15, 0.25, 168),

-- CANTINA (scaled up)
('activity', 'daily',   'Cantina Champion',       'Win {n} cantina games.',                               'cantina_win',         2, 2, 0.06, 0.12, 24),
('activity', 'daily',   'High Roller',            'Play {n} cantina games.',                              'cantina_play',        5, 5, 0.05, 0.10, 24),
('activity', 'weekly',  'Cantina Legend',         'Win {n} cantina games.',                               'cantina_win',         5, 5, 0.10, 0.18, 168),
('activity', 'weekly',  'Arcade Addict',          'Play {n} cantina games.',                              'cantina_play',       15,15, 0.10, 0.18, 168),

-- GUILD CHAT (scaled up)
('activity', 'daily',   'Rally The Troops',       'Send {n} guild messages.',                             'guild_chat',         10,10, 0.05, 0.08, 24),
('activity', 'weekly',  'Comms Officer',          'Send {n} guild messages.',                             'guild_chat',         30,30, 0.08, 0.15, 168),

-- USE ITEM (scaled up)
('activity', 'daily',   'Supply Run',             'Use {n} items today.',                                 'use_item',            3, 3, 0.06, 0.10, 24),
('activity', 'daily',   'Loadout Swap',           'Use {n} items in one day.',                            'use_item',            5, 5, 0.08, 0.15, 24),
('activity', 'weekly',  'Quartermaster',          'Use {n} items this week.',                             'use_item',           10,10, 0.12, 0.20, 168),

-- CONSECUTIVE LOGIN (extended)
('activity', 'streak',  'Iron Discipline',        'Log in {n} consecutive days.',                         'consecutive_login',  10,10, 0.10, 0.15, 0),
('activity', 'streak',  'Fortnight Watch',        'Log in {n} consecutive days.',                         'consecutive_login',  14,14, 0.15, 0.20, 0),
('activity', 'streak',  'Monthly Devotion',       'Log in {n} consecutive days.',                         'consecutive_login',  30,30, 0.20, 0.25, 0),

-- MIXED ADVANCED
('activity', 'daily',   'Frontline Ops',          'Hijack pixels and launch a mission.',                  'hijack',              2, 2, 0.06, 0.12, 24),
('activity', 'daily',   'Combat Patrol',          'Complete invasion and harvest.',                        'complete_invasion',   1, 1, 0.08, 0.15, 24),
('activity', 'weekly',  'Colony Builder',         'Claim {n} pixels and harvest.',                        'claim_pixels',       25,25, 0.12, 0.20, 168),
('activity', 'daily',   'Sector Scout',           'View sectors {n} times.',                              'view_sectors',        5, 5, 0.05, 0.08, 24),
('activity', 'weekly',  'Rank Climber',           'Check leaderboard {n} times.',                         'view_leaderboard',   10,10, 0.06, 0.10, 168),
('activity', 'daily',   'Mission Ready',          'Launch any {n} missions.',                             'launch_exploration',  2, 2, 0.07, 0.12, 24),
('activity', 'weekly',  'Full Spectrum Ops',      'Complete {n} missions of any type.',                   'complete_invasion',   5, 5, 0.18, 0.25, 168);


-- =============================================================
-- SPENDING TIER (30 quests) — 0.30~1.50 PP (cashback ~2-5%)
-- =============================================================

INSERT INTO quest_templates (tier, quest_type, title_template, description_template, requirement_type, requirement_min, requirement_max, reward_pp_min, reward_pp_max, cooldown_hours) VALUES

-- DEPOSIT USDT
('spending', 'daily',   'Supply Drop',            'Deposit {n} USDT to your account.',                    'deposit_usdt',        5,  5, 0.30, 0.50, 24),
('spending', 'daily',   'War Chest',              'Deposit {n} USDT today.',                              'deposit_usdt',       10, 10, 0.40, 0.70, 24),
('spending', 'daily',   'Treasury Fill',          'Deposit {n} USDT in one day.',                         'deposit_usdt',       20, 20, 0.60, 1.00, 24),
('spending', 'weekly',  'Big Investor',           'Deposit {n} USDT this week.',                          'deposit_usdt',       50, 50, 0.80, 1.20, 168),
('spending', 'weekly',  'Whale''s Bounty',        'Deposit {n} USDT this week.',                          'deposit_usdt',      100,100, 1.00, 1.50, 168),

-- SWAP USDT
('spending', 'daily',   'Token Exchange',         'Swap {n} USDT worth of tokens.',                       'swap_usdt',           5,  5, 0.30, 0.50, 24),
('spending', 'daily',   'Market Maker',           'Swap {n} USDT in tokens.',                             'swap_usdt',          10, 10, 0.40, 0.70, 24),
('spending', 'daily',   'Liquidity Provider',     'Swap {n} USDT today.',                                 'swap_usdt',          20, 20, 0.60, 1.00, 24),
('spending', 'weekly',  'Trading Mogul',          'Swap {n} USDT this week.',                             'swap_usdt',          50, 50, 0.80, 1.20, 168),
('spending', 'weekly',  'Exchange Baron',         'Swap {n} USDT this week.',                             'swap_usdt',         100,100, 1.00, 1.50, 168),

-- BUY ITEM
('spending', 'daily',   'Quick Purchase',         'Buy {n} item from the shop.',                          'buy_item',            1,  1, 0.30, 0.50, 24),
('spending', 'daily',   'Shopping Spree',         'Buy {n} items from the shop.',                         'buy_item',            3,  3, 0.50, 0.80, 24),
('spending', 'daily',   'Bulk Order',             'Buy {n} shop items today.',                            'buy_item',            5,  5, 0.60, 1.00, 24),
('spending', 'weekly',  'Supply Contract',        'Buy {n} items this week.',                             'buy_item',           10, 10, 0.80, 1.20, 168),
('spending', 'weekly',  'Arsenal Stockpile',      'Buy {n} items this week.',                             'buy_item',           20, 20, 1.00, 1.50, 168),

-- CLAIM PIXELS (high volume = implies spending for energy/items)
('spending', 'daily',   'Blitz Expansion',        'Claim {n} pixels in one day.',                         'claim_pixels',       25, 25, 0.30, 0.50, 24),
('spending', 'daily',   'Mass Colonization',      'Claim {n} pixels today.',                              'claim_pixels',       50, 50, 0.50, 0.80, 24),
('spending', 'weekly',  'Terraform Initiative',   'Claim {n} pixels this week.',                          'claim_pixels',      100,100, 0.80, 1.20, 168),
('spending', 'weekly',  'Continental Claim',      'Claim {n} pixels this week.',                          'claim_pixels',      200,200, 1.00, 1.50, 168),

-- CORE PIXELS (premium zones)
('spending', 'daily',   'Core Strike',            'Claim {n} core zone pixels.',                          'claim_core_pixels',   5,  5, 0.40, 0.70, 24),
('spending', 'weekly',  'Core Supremacy',         'Claim {n} core zone pixels.',                          'claim_core_pixels',  15, 15, 0.80, 1.20, 168),

-- MISSIONS (heavy)
('spending', 'daily',   'Invasion Fleet',         'Launch {n} invasions today.',                          'launch_invasion',     5,  5, 0.40, 0.70, 24),
('spending', 'weekly',  'Grand Offensive',        'Launch {n} invasions.',                                'launch_invasion',    10, 10, 0.80, 1.20, 168),
('spending', 'weekly',  'Conqueror''s Path',      'Complete {n} invasions.',                               'complete_invasion',  10, 10, 1.00, 1.50, 168),
('spending', 'daily',   'Survey Armada',          'Launch {n} explorations.',                             'launch_exploration',  5,  5, 0.40, 0.70, 24),
('spending', 'weekly',  'Charted Frontier',       'Complete {n} explorations.',                           'complete_exploration',10,10, 1.00, 1.50, 168),

-- HIJACK (heavy)
('spending', 'daily',   'Siege Operations',       'Hijack {n} enemy pixels.',                             'hijack',             10, 10, 0.40, 0.70, 24),
('spending', 'weekly',  'Total War',              'Hijack {n} pixels this week.',                         'hijack',             30, 30, 0.80, 1.20, 168),

-- USE ITEM (heavy spending)
('spending', 'daily',   'Arsenal Deploy',         'Use {n} items today.',                                 'use_item',           10, 10, 0.40, 0.70, 24),
('spending', 'weekly',  'Armory Burn',            'Use {n} items this week.',                             'use_item',           25, 25, 0.80, 1.20, 168);
