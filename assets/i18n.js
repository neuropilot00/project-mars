/* ââââââââââââââââââââââââââââââââââââââââââââââââââ
   i18n â Internationalization
   ââââââââââââââââââââââââââââââââââââââââââââââââââ */
var SUPPORTED_LANGS = ['en','ko','ja','zh','id','vi','th'];
var GAME_VOICE_LANG = 'en';
window.GAME_VOICE_LANG = GAME_VOICE_LANG;
function normalizeLang(lang){
  lang = String(lang || 'en').toLowerCase();
  if (lang === 'in') lang = 'id';
  if (lang === 'vn') lang = 'vi';
  if (lang === 'thai') lang = 'th';
  return SUPPORTED_LANGS.indexOf(lang) >= 0 ? lang : 'en';
}
var LANG = normalizeLang(localStorage.getItem('pw_lang') || 'en');
var I18N = {
  en: {
    login: 'LOGIN', register: 'REGISTER', logout: 'LOGOUT', account: 'ACCOUNT',
    email_login: 'EMAIL LOGIN / REGISTER', my_wallet: 'MY WALLET',
    wallet_cta_desc: 'Login to deposit USDT,<br>claim territories & earn rewards',
    email_placeholder: 'email@example.com', password_placeholder: 'Password (8+ chars Â· Aa1!)',
    nickname_placeholder: 'Nickname (optional)', referral_placeholder: 'Referral code (optional)',
    or: 'OR', email_wallet_note: 'Your email account has a built-in game wallet.<br>Use DEPOSIT to get your deposit address.',
    game_wallet: 'GAME WALLET', usdt_balance: 'USDT BALANCE', pp_balance: 'PP BALANCE',
    global_stats: 'GLOBAL STATS', total_pixels: 'TOTAL PIXELS', pixels_sold: 'PIXELS SOLD',
    total_volume: 'TOTAL VOLUME', hijacks_hr: 'HIJACKS / HR', active_users: 'ACTIVE USERS',
    leaderboard: 'LEADERBOARD', search_owner: 'SEARCH OWNER', territory_info: 'TERRITORY INFO',
    coords: 'COORDS', owner: 'OWNER', size: 'SIZE', price_paid: 'PRICE PAID',
    hijack_cost: 'HIJACK COST', hijack_this: 'HIJACK THIS PLOT',
    my_alerts: 'MY ALERTS', live_feed: 'LIVE FEED', place_image: 'PLACE YOUR IMAGE',
    choose_file: 'CHOOSE IMAGE FILE', item_shop: 'ITEM SHOP', open_shop: 'OPEN SHOP',
    referral_program: 'REFERRAL PROGRAM', referral_desc: 'Share your code & earn PP<br>from live referral commission activity!',
    codex_open: 'GAME GUIDEBOOK', codex_tagline: 'Learn the lore & mechanics', profile_prefs: 'PREFERENCES', profile_language: 'LANGUAGE', codex_prev: 'PREV', codex_next: 'NEXT',
    ref_tiers: 'Tier 1: 15% Â· Tier 2: 10% Â· Tier 3: 5%',
    ref_sources: 'Base live sources: deposit Â· swap Â· shop Â· cantina Â· market fees (other sources vary by operator settings)',
    view_dynasty: 'ð VIEW DYNASTY', dyn_leaderboard: 'LEADERBOARD', dyn_my_tree: 'MY TREE',
    my_ref_code: 'MY REFERRAL CODE', enter_ref_code: 'ENTER REFERRAL CODE',
    referrals: 'REFERRALS', total_earned: 'TOTAL EARNED', coming_soon: 'COMING SOON',
    deposit_usdt: 'DEPOSIT USDT', withdraw_usdt: 'WITHDRAW USDT', swap_pp: 'SWAP PP â USDT',
    claim_territory: 'CLAIM TERRITORY', confirm_claim: 'CONFIRM CLAIM',
    approve_deposit: 'APPROVE & DEPOSIT', request_withdrawal: 'REQUEST WITHDRAWAL',
    confirm_swap: 'CONFIRM SWAP', cancel: 'CANCEL', copy: 'COPY', apply: 'APPLY',
    click_mars: 'CLICK MARS TO SELECT TERRITORY', click_stamp: 'CLICK MARS TO STAMP!',
    bug_report_label: 'BUG', bug_report_title: 'REPORT A BUG',
    bug_report_sub: 'Tell us what went wrong. Reports go straight to the dev team for review and fixing.',
    bug_report_category: 'Category',
    bug_cat_ui: 'UI', bug_cat_gameplay: 'GAMEPLAY', bug_cat_payment: 'PAYMENT',
    bug_cat_performance: 'PERFORMANCE', bug_cat_other: 'OTHER',
    bug_report_summary: 'Short summary',
    bug_report_summary_ph: 'e.g. Hijack button does nothing on enemy claim',
    bug_report_detail: 'What happened?',
    bug_report_detail_ph: 'Steps to reproduce, what you expected, what actually happened...',
    bug_report_auto_meta: 'We auto-attach: page URL, browser, recent console errors, your wallet (if connected).',
    bug_report_submit: 'SEND REPORT', bug_report_sending: 'SENDING...',
    bug_report_thanks: 'ð Report sent. Thank you!',
    bug_report_empty: 'Please describe the bug',
    registered: 'REGISTERED!', login_success: 'LOGGED IN!', wallet_connected: 'WALLET CONNECTED',
    wallet_disconnected: 'WALLET DISCONNECTED', copied: 'REFERRAL LINK COPIED!',
    stats_label: 'STATS', live_label: 'LIVE',
    find_email: 'FIND ID', forgot_password: 'FORGOT PASSWORD',
    find_email_title: 'FIND YOUR ID', reset_password_title: 'RESET PASSWORD',
    send_reset_code: 'SEND RESET CODE', change_password: 'CHANGE PASSWORD',
    enter_nickname: 'Enter your nickname', enter_email: 'Enter your email',
    reset_code_placeholder: '6-digit code', new_password: 'New password', confirm_password: 'Confirm password',
    back_to_login: 'â Back to Login', search_btn: 'SEARCH',
    code_sent_to: 'Code sent to',
    tut_howto: 'HOW TO PLAY',
    tut_step1: 'Connect your wallet to begin â claim Mars territory, build a fleet, and follow the campaign story.',
    tut_step2: 'Tap CLAIM to buy pixel territory on the Mars map. Your land produces PP you can harvest.',
    tut_step3: 'Open BASE to harvest PP, clear the Daily Ops Board for GP, upgrade territory, and enter the Shipyard.',
    tut_step4: 'Visit the CANTINA for items and mini-games that boost your strategy.',
    tut_step5: 'Follow the CAMPAIGN â the main story. Build fleets, win PvP battles, and invite friends with your referral link for bonus rewards!',
    tut_next: 'NEXT', tut_skip: 'SKIP', tut_done: 'START PLAYING!',
    help_claim: 'CLAIM TERRITORY',
    help_claim_body: 'Drag on Mars to select pixels, then pay USDT to claim them as your territory. You earn PP (Potato Points) by harvesting your land. You can also HIJACK other players\' territory by paying a premium!',
    help_cantina: 'CANTINA',
    help_cantina_body: 'The PvP battle arena! Enter the Cantina to fight other players, buy battle items from the shop, and earn rewards. Use shields to protect your territory and weapons to attack others.',
    help_base: 'MY BASE',
    help_base_body: 'Your command center. View your territory stats, harvest PP from your land, manage your inventory, equip cosmetics, and access governance if you\'re a sector governor.',
    help_harvest: 'HARVEST PP',
    help_harvest_body: 'Your territory generates PP (Potato Points) over time. Tap HARVEST to collect them. PP can be converted to USDT or used to buy items. Weather and Starlink boosts can increase harvest rates!',
    help_governance: 'GOVERNANCE',
    help_governance_body: 'Own the most pixels in a sector to become its Governor! Governors can set tax rates (earn PP from all transactions in their sector), post announcements, and activate sector-wide buffs.',
    help_referral: 'REFERRAL PROGRAM',
    help_referral_body: 'Share your referral code with friends. You earn commission when they deposit, shop, swap, or play in the Cantina â across 3 tiers: Tier 1: 15%, Tier 2: 10%, Tier 3: 5%.',
    help_currency: 'PP & USDT',
    help_currency_body: 'USDT: Stablecoin used to buy and hijack territory. Deposit from your wallet.\nPP (Potato Points): In-game currency earned by harvesting land. Convert PP to USDT anytime, or spend PP on items and cosmetics.',
    help_weather: 'WEATHER EVENTS',
    help_weather_body: 'Mars weather affects gameplay! Sandstorms reduce defense but boost mining. Solar flares double mining but weaken shields. Meteor showers drop bonus PP. Dust devils reduce claim costs but boost attacks.',
    help_about: 'ABOUT OCCUPY MARS',
    help_about_body: 'Occupy Mars is a blockchain territory game on Mars!',
    help_game_crash: 'CRASH',
    help_game_crash_body: 'A rocket launches and the multiplier rises! Place your bet and cash out before it crashes. The longer you wait, the higher the reward â but if the rocket explodes before you cash out, you lose everything. Bet PP to play.',
    help_game_mines: 'MINES',
    help_game_mines_body: 'A 5x5 grid hides gems and mines. Choose how many mines (more mines = higher multiplier). Reveal tiles one by one â each gem increases your payout. Hit a mine and you lose. Cash out anytime to keep your winnings!',
    help_game_sandstorm: 'COINFLIP',
    help_game_sandstorm_body: 'Classic coin flip. Pick HEADS or TAILS, place your bet, and flip. Win = 1.96Ã your bet. Simple, fast, 50/50. Perfect for quick plays.',
    help_game_meteorite: 'DICE',
    help_game_meteorite_body: 'Roll the dice! Set a target range (the narrower the range, the higher the multiplier). If the roll lands in your range, you win. Adjust risk vs reward to your preference.',
    help_game_hilo: 'HI-LO',
    help_game_hilo_body: 'A card is shown face up. Guess whether the next card will be HIGHER or LOWER. Each correct guess increases your multiplier. You can cash out after any correct guess, or keep going for bigger rewards. Wrong guess = lose all!',
    lore_era: 'A LONG TIME FROM NOW, ON A PLANET NOT SO FAR AWAY...',
    lore_title: 'OCCUPY MARS',
    lore_body: '<p>The year is <span class="lore-highlight">2157</span>. Earth is dying. Rising seas have swallowed the great coastal cities. The air itself has become poison. Seven billion souls cling to a world that no longer wants them.</p><p>But humanity refused to go quietly into the dark.</p><p>The <span class="lore-highlight">ARES INITIATIVE</span> â a desperate, last-chance mission â launched a fleet of colony ships toward the Red Planet. After three brutal years crossing the void of space, the survivors made landfall on <span class="lore-red">Mars</span>.</p><p>They found no paradise. Only red dust, freezing winds, and endless silence. But they also found something unexpected: <span class="lore-cyan">Rare mineral deposits</span> buried deep beneath the Martian surface â resources powerful enough to build a new civilization... or tear one apart.</p><p>Now, factions wage war across the crimson wastes. <span class="lore-highlight">Sector Governors</span> rule their domains with iron fists. Raiders <span class="lore-red">hijack</span> territory under cover of sandstorms. Supply rockets crash-land with precious cargo, and only the fastest survive to claim the spoils.</p><p>There is no law here. No government. No rescue coming.<br>There is only <span class="lore-red">Mars</span>. And those bold enough to <span class="lore-highlight">occupy</span> it.</p>',
    lore_tagline: 'YOUR TERRITORY. YOUR RULES. YOUR PLANET.',
    lore_close: 'ENTER MARS',
    // ââ BASE tab labels ââ
    base_tab_territory: 'MY TERRITORY', base_tab_sectors: 'SECTORS', base_tab_season: 'SEASON',
    base_tab_mining: 'â RESOURCE RUN', base_tab_quests: 'QUESTS', base_tab_ops: 'OPS CONSOLE',
    base_tab_shop: 'SHOP', base_tab_market: 'MARKET', base_tab_items: 'MY ITEMS', base_tab_guild: 'GUILD', base_tab_govern: 'GOVERN', shop_cat_material: 'â MATERIALS',
    base_tab_transport: 'TRANSPORT', base_tab_quests_full: 'CAMPAIGN/QUESTS',
    bcat_territory: 'Territory', bcat_fleet: 'Fleet', bcat_economy: 'Economy', bcat_mission: 'Mission', bcat_community: 'Community',
    fcmd_open_shipyard_short: 'Shipyard', fcmd_my_fleets_short: 'My Fleets', fcmd_mining_short: 'Resource Run', mining_ops_title: 'RESOURCE RUN', mining_ops_desc: 'Send fleets out for GP & materials â no land needed.', mining_ops_btn: 'â DEPLOY', fcmd_tactical_lab: 'Tactical Lab', fcmd_tactical_lab_short: 'Tactical Lab', fcmd_ace_mode_short: 'ACE Mode',
    fleet_status_label: 'Fleet Status', fleet_world_events: 'Active World Events', btn_refresh: 'â» Refresh',
    hijack_no_fleet_auto_win: 'No enemy fleet â Auto Win (instant territory transfer)',
    hijack_no_fleet_label: 'No Fleet â Hijack Unavailable',
    hijack_no_fleet_hint: 'Go to BASE â FLEET tab to create a fleet first',
    hijack_fleet_loading: 'Loading fleet info...',
    siege_info_block: '<b style="color:var(--red);font-size:10px">âï¸ What is Sector Siege?</b><br>Wage war to usurp the largest territory holder (Governor) in a sector.<br><b style="color:var(--tx2)">â  Select Sector</b> â <b style="color:var(--tx2)">â¡ Declare Siege (GP cost)</b> â <b style="color:var(--tx2)">â¢ Warning Period</b> â <b style="color:var(--tx2)">â£ Battle Period</b><br>The side with the highest occupation rate becomes Governor.<br><span style="color:var(--gold)">ð¡ Entry Requirement: Must own territory in the target sector</span>',
    fleet_battle_info_block: '<b style="color:var(--cyan);font-size:10px">â What is Fleet Battle?</b><br>Lead your fleet and declare PvP battle against other players.<br><b style="color:var(--tx2)">â  Build ships in Shipyard</b> â <b style="color:var(--tx2)">â¡ Form fleet</b> â <b style="color:var(--tx2)">â¢ Declare in Battle Hub</b> â <b style="color:var(--tx2)">â£ Check results</b>',
    fleet_battle_hub_btn: 'OPEN FLEET BATTLE HUB',
    pvp_ai_practice: 'AI Practice', pvp_tournament: 'TOURNAMENT', pvp_shipyard: 'SHIPYARD',
    inv_cat_all: 'All', inv_cat_defense: 'Defense', inv_cat_attack: 'Attack',
    inv_cat_utility: 'Utility', inv_cat_boost: 'Boost', inv_cat_cosmetic: 'Cosmetic',
    my_territory_title: 'My Territory', login_to_view_territory: 'Login to view your territory',
    hijack_fleet_info_fail: 'Failed to load enemy fleet info',
    // ââ Transport (M-158 Phase C) ââ
    transport_title: 'INTER-SECTOR TRANSPORT',
    transport_desc: 'Ship GP cargo between sectors. Merchants earn bonuses. Raiders can steal mid-transit.',
    transport_sub_launch: 'LAUNCH', transport_sub_my: 'MY SHIPMENTS', transport_sub_raid: 'ð´ RAID TARGETS',
    transport_info_title: 'ð What is GP Cargo Transport?',
    transport_info_desc: 'Ship GP as "cargo" from sector A â B in a PvP profit system.',
    transport_info_merchant: 'â <b style="color:#FFB347">Merchant job</b> earns bonus GP on delivery',
    transport_info_raid: 'â Other players can intercept and <b style="color:#FF6B6B">steal your cargo</b> mid-transit',
    transport_info_targets: 'ð´ Check RAID TARGETS tab to raid other shipments',
    transport_info_note: 'ð¡ Separate from the item marketplace â use the MARKET tab for that',
    transport_launch_new: 'NEW SHIPMENT',
    transport_origin: 'ORIGIN SECTOR', transport_dest: 'DEST SECTOR', transport_cargo: 'CARGO GP',
    transport_launch_btn: 'ð LAUNCH SHIPMENT â¶',
    transport_my_empty: 'No shipments yet. Launch one!',
    transport_raid_empty: 'No raidable shipments right now.',
    transport_raid_warning: 'â  Raid: pirate other players\' cargo. Your own + guild members are exempt. Cooldown applies per attempt.',
    transport_cancel_btn: 'â CANCEL',
    transport_raid_btn: 'ð´ RAID',
    // ââ Job System ââ
    job_label: 'JOB', job_none: 'Choose Your Destiny', job_locked: 'Reach Lv.{n} to Unlock',
    job_choose_btn: 'CHOOSE â¶', job_change_btn: 'CHANGE JOB',
    job_cooldown: 'Change available after {t}', job_free_change: 'Free change: {n} remaining',
    job_paid_change: 'Change costs {n} GP', job_current: 'CURRENT',
    job_modal_title: 'CHOOSE YOUR DESTINY', job_modal_sub: 'Select a specialization that matches your playstyle',
    job_modal_cancel: 'LATER', job_modal_confirm: 'CONFIRM SELECTION',
    job_modal_free: 'Free change â {n} remaining this week',
    job_modal_paid: 'Costs {n} GP (weekly free change used)',
    job_modal_cooldown_warn: 'Job change on cooldown â cannot change now',
    job_selected_toast: 'Job selected: {n}',
    // ââ Marketplace ââ
    mkt_browse: 'ðª BROWSE', mkt_sell: 'ð° SELL', mkt_my_listings: 'ð MY LISTINGS',
    mkt_sort_newest: 'NEWEST', mkt_sort_cheap: 'CHEAPEST', mkt_sort_expensive: 'EXPENSIVE', mkt_sort_ending: 'ENDING SOON',
    mkt_loading: 'Loading marketplace...', mkt_empty: 'No listings found',
    mkt_recent_sales: 'ð RECENT SALES', mkt_no_sales: 'No recent sales yet',
    // Notifications
    notif_title: 'ð NOTIFICATIONS', notif_read_all: 'MARK ALL READ',
    notif_loading: 'Loading...', notif_empty: 'No notifications yet',
    gp_activity_title: 'GP ACTIVITY', gp_activity_login: 'Login to view GP activity.', gp_activity_empty: 'No GP activity yet.',
    gp_send_title: 'ð¸ SEND GP', gp_send_subtitle: 'Send GP to another player', gp_send_btn: 'SEND',
    gp_send_no_recipient: 'Enter recipient wallet or nickname', gp_send_invalid_amount: 'Enter a valid amount',
    gp_send_amount_label: 'Amount', gp_transfer_history: 'TRANSFER HISTORY', gp_transfer_empty: 'No transfers yet.',
    career_stats_title: 'ð MY CAREER STATS', cat_naval: 'Naval Wins', cat_enhance: 'Enhancements', cat_ships: 'Ships Built', cat_trades: 'Trades',
    mkt_buy: 'BUY', mkt_cancel: 'CANCEL', mkt_list_sell: 'SELL',
    mkt_buy_title: 'Purchase Item', mkt_price: 'Price', mkt_your_balance: 'Your Balance',
    mkt_buy_confirm: 'BUY NOW', mkt_bought: 'Purchase successful!',
    mkt_cancel_title: 'Cancel Listing', mkt_cancel_body: 'Cancel this listing and return the item?',
    mkt_cancel_confirm: 'CANCEL LISTING', mkt_cancelled: 'Listing cancelled',
    mkt_list_title: 'List for Sale', mkt_list_confirm: 'LIST FOR SALE',
    mkt_fee_note: 'Listing fee: 2 GP Â· Sale fee: 5%', mkt_listed: 'Item listed on marketplace!', mkt_listed_territory: 'Territory listed on marketplace!',
    mkt_sellable_items: 'SELLABLE ITEMS', mkt_no_items: 'No items to sell. Materialize cosmetics from SHOP â MY ITEMS first.',
    mkt_sellable_terr: 'MY TERRITORIES', mkt_no_territories: 'No territories owned.',
    mkt_no_listings: 'No listings yet',
    // ââ AUCTION section ââ
    mkt_auction: 'ð¨ AUCTION',
    auc_none: 'No active auctions', auc_ended: 'ENDED', auc_current_bid: 'Bid',
    auc_buyout: 'Buyout', auc_bid: 'BID', auc_buy_now: 'BUY NOW', auc_cancel: 'CANCEL',
    auc_bid_title: 'Place Bid', auc_min_bid: 'Minimum bid', auc_your_bid: 'Your bid',
    auc_confirm_bid: 'PLACE BID', auc_too_low: 'Bid must be at least ',
    auc_bid_placed: 'Bid placed!', auc_buyout_title: 'Buy Now',
    auc_buyout_confirm: 'Purchase this item at the buyout price?',
    auc_confirm_buyout: 'BUY NOW', auc_bought: 'Item purchased!',
    auc_cancel_title: 'Cancel Auction',
    auc_cancel_confirm: 'Cancel this auction? (Only allowed with no bids)',
    auc_confirm_cancel: 'CANCEL AUCTION', auc_cancelled: 'Auction cancelled',
    // ââ TERRITORY VISUAL section ââ
    terr_sell_btn: 'ð° SELL', terr_for_sale: 'ð° FOR SALE', terr_auction_label: 'ð¨ AUCTION',
    // ââ RESOURCE section ââ
    res_section_title: 'RESOURCES',
    res_empty: 'No resources yet. Harvest your territory to find minerals!',
    res_sell: 'SELL',
    res_sell_title: 'Sell Resource',
    // ââ SEASON tab ââ
    season_no_active: 'No Active Season',
    season_check_back: 'Check back soon for the next season!',
    season_activities_placeholder: 'Season activities will appear here when a season starts.',
    season_how_to_earn: 'HOW TO EARN POINTS',
    season_rewards_title: 'SEASON REWARDS',
    season_reward_1st: '<b>1st place per category</b>: GP + XP + Items + Title',
    season_reward_top3: '<b>Top 3</b>: GP + Items',
    season_reward_top10: '<b>Top 10</b>: GP',
    season_reward_overall: 'Overall #1 also earns rare <span style="color:var(--gold)">PP</span>!',
    season_reward_multi: 'You can win rewards in <b>multiple categories</b> at once!',
    season_rewards_blurb: 'ð¥ <b>1st place per category</b>: GP + XP + Items + Title<br>ð¥ <b>Top 3</b>: GP + Items<br>ð¥ <b>Top 10</b>: GP<br>ð Overall #1 also earns rare <span style="color:var(--gold)">PP</span>!<br>â¡ You can win rewards in <b>multiple categories</b> at once!',
    season_my_rank: 'MY SEASON RANK',
    season_pts_suffix: 'pts',
    season_leaderboard: 'SEASON LEADERBOARD',
    season_refresh: 'â» REFRESH',
    season_loading: 'Loading...',
    season_no_scores: 'No season scores yet',
    season_your_rewards: 'ð YOUR REWARDS',
    season_pass_tip: 'Earn XP by playing (claim, harvest, invade, explore, quest). Unlock tier rewards as you level up! Premium pass doubles rewards.',
    season_pass_buy_title: 'PREMIUM PASS',
    season_pass_buy_body: 'Unlock the premium reward track for this season. Double rewards at every tier!',
    season_pass_cost_label: 'Cost',
    season_pass_balance_label: 'Your GP',
    season_pass_buy_confirm: 'PURCHASE',
    season_categories_title: "THIS SEASON'S RANKING CATEGORIES",
    season_default_desc: 'Compete for the top of the leaderboard!',
    season_ending_soon: 'Season ending soon!',
    season_ended: 'ENDED',
    season_days_remaining: '{d}d {h}h remaining',
    season_rank_suffix: 'Rank',
    season_claim_btn: 'CLAIM',
    season_claim_success: 'Claimed {amount} {type}!',
    season_claim_failed: 'Failed to claim',
    season_theme_volcanic: 'Volcanic Dawn',
    season_theme_ice_age: 'Ice Age',
    season_theme_solar_storm: 'Solar Storm',
    season_theme_dust_epoch: 'Dust Epoch',
    season_theme_volcanic_desc: 'Volcanic activity surges across Mars. Mining yields are boosted but shields weaken!',
    season_theme_ice_age_desc: 'Frozen tundras spread. Cold slows mining but defense is strong.',
    season_theme_solar_storm_desc: 'Solar radiation floods the surface. Maximum mining, but shields fail fast!',
    season_theme_dust_epoch_desc: 'Massive dust storms rage. Visibility drops but meteors bring surprises.',
    // ââ Season categories ââ
    season_cat_overall: 'Overall Champion', season_cat_overall_d: 'Earn the highest total score across all activities',
    season_cat_territory: 'Territory King', season_cat_territory_d: 'Claim the most land pixels on Mars',
    season_cat_mining: 'Mining Master', season_cat_mining_d: 'Harvest resources from your territory the most',
    season_cat_combat: 'Combat Legend', season_cat_combat_d: 'Win the most hijack battles against other players',
    season_cat_defender: 'Resilient Fighter', season_cat_defender_d: 'Survive the most attacks on your territory',
    season_cat_explorer: 'Explorer Elite', season_cat_explorer_d: 'Discover the most POI markers on the globe',
    season_cat_active: 'Most Active', season_cat_active_d: 'Click & tap the most â just play the game!',
    season_cat_shopper: 'Item Master', season_cat_shopper_d: 'Buy and use the most items from the shop',
    season_cat_quester: 'Quest Hero', season_cat_quester_d: 'Complete the most daily missions',
    season_cat_big_spender: 'Big Spender', season_cat_big_spender_d: 'Spend the most GP on items, hijacks, and upgrades',
    season_cat_investor: 'PP Investor', season_cat_investor_d: 'Spend the most PP on premium features',
    season_cat_fortifier: 'Fortress Builder', season_cat_fortifier_d: 'Place the most shields on your territories',
    season_cat_wanderer: 'Sector Wanderer', season_cat_wanderer_d: 'Explore and visit the most different sectors',
    season_cat_dedicated: 'Most Dedicated', season_cat_dedicated_d: 'Log in every day â consistency is key!',
    season_cat_fashionista: 'Mars Fashionista', season_cat_fashionista_d: 'Equip the most cosmetic items to your territory',
    season_cat_gambler: 'Cantina Regular', season_cat_gambler_d: 'Play the most mini-games in the Cantina',
    season_cat_team_player: 'Team Player', season_cat_team_player_d: 'Contribute the most to your guild activities',
    season_cat_recruiter: 'Top Recruiter', season_cat_recruiter_d: 'Invite the most new players via referral',
    season_cat_social: 'Social Butterfly', season_cat_social_d: 'Send the most chat messages to other players',
    season_cat_earner: 'GP Tycoon', season_cat_earner_d: 'Earn the most GP from all sources combined',
    season_cat_whale: 'PP Whale', season_cat_whale_d: 'Earn the most PP from mining and discoveries',
    season_cat_loser: 'Never Give Up', season_cat_loser_d: 'Lost pixels to hijacks? Keep fighting back!',
    season_cat_streaker: 'Streak Master', season_cat_streaker_d: 'Maintain the longest daily login streak',
    season_cat_astronaut: 'Rocket Rider', season_cat_astronaut_d: 'Claim loot from the most rocket supply drops',
    season_cat_weatherman: 'Storm Chaser', season_cat_weatherman_d: 'Check the Mars weather forecast frequently',
    season_cat_namer: 'Name Artist', season_cat_namer_d: 'Rename your territories the most times',
    season_cat_influencer: 'Mars Influencer', season_cat_influencer_d: 'Share your stats and territory the most',
    // ââ QUESTS tab ââ
    quests_loading: 'Loading quests...',
    achievements_title: 'ACHIEVEMENTS', achievements_loading: 'Loading achievements...',
    news_title: 'PLANET NEWS',
    lottery_title: 'GP LOTTERY', lottery_disabled: 'Lottery disabled', lottery_round: 'ROUND', lottery_ends: 'ENDS IN', lottery_recent_winners: 'RECENT WINNERS',
    staking_title: 'GP STAKING', staking_stake_btn: 'ð STAKE GP', staking_confirm_title: 'STAKE GP', staking_confirm_btn: 'STAKE', staking_withdraw_title: 'WITHDRAW STAKE', staking_withdraw_btn: 'WITHDRAW',
    burn_title: 'GP BURN',
    weekly_title: 'WEEKLY CHALLENGES',
    shield_title: 'TERRITORY SHIELD', shield_activate_btn: 'ACTIVATE SHIELD',
    bounty_title: 'BOUNTY BOARD', bounty_post_btn: '+ POST BOUNTY', bounty_tab_active: 'ACTIVE', bounty_tab_mine: 'MY BOUNTIES', bounty_tab_onme: 'ON ME', bounty_modal_title: 'POST BOUNTY', bounty_modal_sub: 'Reward the first player to hijack this territory', bounty_target_label: 'TARGET WALLET / NICKNAME', bounty_amount_label: 'GP REWARD', bounty_msg_label: 'TAUNT MESSAGE', bounty_post_submit: 'ð¯ POST BOUNTY',
    upgrades_title: 'TERRITORY UPGRADES', upgrades_upgrade_btn: 'UPGRADE TERRITORY',
    monuments_title: 'MY MONUMENTS', monument_place_title: 'PLACE MONUMENT', monument_place_btn: 'PLACE MONUMENT', monument_territory: 'TERRITORY', monument_type: 'TYPE', monument_name_label: 'MONUMENT NAME', monument_inscription: 'INSCRIPTION', monument_cost: 'Cost',
    base_craft_btn: 'âï¸ CRAFT', craft_cat_all: 'ALL', craft_cat_general: 'GENERAL', craft_cat_elite: 'ELITE', craft_cat_seasonal: 'SEASONAL', craft_cat_event: 'EVENT', craft_btn: 'âï¸ CRAFT', craft_history_btn: 'ð MY CRAFT HISTORY', craft_no_recipes: 'No recipes available', craft_load_fail: 'Failed to load recipes', craft_no_history: 'No crafting history', craft_success: 'Craft success!', craft_fail: 'Craft failed', craft_refund_partial: 'Partial GP refunded', craft_confirm_title: 'Confirm Craft', craft_missing_ingredients: 'Missing ingredients',
    contest_title: 'PIXEL ART CONTESTS', contest_none: 'No contests yet. Check back soon!', contest_view_btn: 'ð VIEW ENTRIES', contest_submit_btn: 'âï¸ SUBMIT', contest_vote_btn: 'ð³ï¸ VOTE', contest_title_prompt: 'Your artwork title:', contest_image_prompt: 'Image URL (optional):', contest_desc_prompt: 'Brief description (optional):',
    rental_title: 'TERRITORY RENTAL', rental_tab_browse: 'BROWSE', rental_tab_my: 'MY RENTALS', rental_list_btn: '+ LIST TERRITORY', rental_rent_btn: 'ðï¸ RENT', rental_cancel_btn: 'CANCEL LISTING', rental_no_listings: 'No territories listed for rent', rental_no_my: 'No rental activity yet', rental_no_territories: 'No territories to list', rental_cancelled: 'Listing cancelled', rental_gp_prompt: 'GP per period:',
    duel_title: 'GP DUELS', duel_challenge_btn: 'âï¸ CHALLENGE', duel_tab_pending: 'INCOMING', duel_tab_my: 'MY DUELS', duel_tab_recent: 'LEADERBOARD', duel_modal_title: 'CHALLENGE TO DUEL', duel_modal_sub: 'Winner takes pot minus 5% house fee', duel_target_label: 'OPPONENT WALLET / NICKNAME', duel_wager_label: 'YOUR WAGER (GP)', duel_challenge_submit: 'âï¸ SEND CHALLENGE', duel_accept_btn: 'âï¸ ACCEPT', duel_decline_btn: 'â DECLINE', duel_cancel_btn: 'CANCEL', duel_no_pending: 'No incoming challenges', duel_no_history: 'No duel history', duel_no_recent: 'No recent duels', duel_accept_confirm: 'Accept duel and match the wager?', duel_decline_confirm: 'Decline this duel challenge?', duel_cancelled_refund: 'Duel cancelled. GP refunded.', duel_challenge_sent: 'âï¸ Challenge sent! Opponent has 30 min to accept.', duel_enter_target: 'Enter opponent wallet or nickname', duel_enter_wager: 'Enter a valid wager',
    alliance_title: 'ALLIANCES', alliance_members: 'MEMBERS', alliance_treasury: 'TREASURY', alliance_defense: 'DEFENSE BONUS', alliance_join_btn: 'JOIN', alliance_join_confirm: 'Join Alliance?', alliance_leave_btn: 'ðª LEAVE', alliance_leave_title: 'Leave Alliance?', alliance_leave_confirm: 'You will be removed from the alliance.', alliance_deposit_btn: 'ð° DEPOSIT', alliance_withdraw_btn: 'ð¤ WITHDRAW', alliance_deposit_prompt: 'How much GP to deposit?', alliance_withdraw_prompt: 'Withdraw GP from treasury (fee applies):', alliance_withdraw_note_prompt: 'Note (optional):', alliance_create_title: 'CREATE ALLIANCE', alliance_create_btn: 'ð¡ï¸ CREATE ALLIANCE', alliance_browse_title: 'BROWSE ALLIANCES', alliance_browse_hint: 'Search or scroll to find alliances',
    base_lucky_btn: 'ð¦ CRATES', lucky_box_open_btn: 'ð OPEN', lucky_box_recent_title: 'ð RECENT OPENS', lucky_box_my_history: 'ð MY HISTORY', lucky_box_confirm_title: 'Open Crate?',
    base_vip_btn: 'ð« VIP', vip_buy_btn: 'ð« GET VIP', vip_status_active: 'VIP ACTIVE', vip_expires: 'Expires', vip_purchase_title: 'Get VIP Pass?', vip_confirm: 'GET VIP',
    connect_wallet: 'Connect wallet first', connect_wallet_first: 'Connect wallet first', err_connect_wallet: 'Connect wallet first', err_network: 'Network error. Please retry.',
    use_shipyard: 'Use Shipyard to build', use_fleet_cmd: 'Use Fleet Command', gov_battle_use_fleet: 'PVP battles use the Fleet system + Hijack.', gov_battle_use_fleet_hint: 'Build ships in Fleet tab and use the HIJACK button to capture territory.',
    duel_declined_msg: 'Duel declined.',
    expedition_title: 'EXPEDITIONS', expedition_returns: 'Returns', expedition_cancel_btn: 'CANCEL', expedition_launch_btn: 'ð LAUNCH EXPEDITION', expedition_history_btn: 'ð EXPEDITION LOG', expedition_select_claim: 'SELECT TERRITORY & TYPE', expedition_launch_confirm: 'Launch Expedition?', expedition_cancel_confirm: 'Cancel Expedition?',
    branding_title: 'TERRITORY BRANDING', branding_select_territory: 'Select a territory to brand:', branding_name_label: 'TERRITORY NAME', branding_tagline_label: 'TAGLINE', branding_color_label: 'THEME COLOR', branding_set_btn: 'SET', branding_set_name_title: 'Set Territory Name?', branding_set_tag_title: 'Set Tagline?', branding_set_color_title: 'Set Theme Color?',
    spells_title: 'TERRITORY SPELLS', spells_select_target: 'Target territory (enter claim # or select yours):', spells_active_label: 'ACTIVE SPELLS:', spells_history_btn: 'ð SPELL HISTORY', spells_cast_confirm: 'Cast Spell?',
    tiers_title: 'TERRITORY TIERS', tiers_desc: 'Upgrade your territories for permanent mining and pixel capacity bonuses.', tiers_my_label: 'MY TERRITORIES', tiers_table_label: 'TIER BENEFITS', tiers_upgrade_btn: 'â¬ UPGRADE', tiers_none: 'No tiered territories yet.', tiers_upgrade_confirm: 'Upgrade Territory Tier?',
    tournament_title: 'TOURNAMENTS', tournament_none: 'No open tournaments right now', tournament_join_btn: 'JOIN TOURNAMENT', tournament_join_confirm: 'Join Tournament?', tournament_my_btn: 'ð MY TOURNAMENTS',
    broadcast_title: 'GP BROADCASTS', broadcast_buy_btn: 'ð¢ BUY BROADCAST', broadcast_modal_title: 'ð¢ BROADCAST MESSAGE', broadcast_modal_desc: 'Your message will be featured to all players for the selected duration.', broadcast_duration_label: 'Duration:', broadcast_submit_btn: 'ð¢ BROADCAST', broadcast_confirm_title: 'Buy Broadcast?', broadcast_none: 'No active broadcasts right now.',
    raffle_title: 'GP RAFFLES', raffle_none: 'No open raffles right now.', raffle_my_btn: 'ðï¸ MY TICKETS', raffle_buy_btn: 'ðï¸ BUY', raffle_tickets_label: 'Tickets:', raffle_buy_confirm: 'Buy Raffle Tickets?',
    wager_title: 'GP WAGER POOLS', wager_none: 'No active wager pools right now.', wager_my_btn: 'ð¯ MY BETS', wager_bet_btn: 'ð¯ BET', wager_target_label: 'Bet on (wallet/nickname):', wager_amount_label: 'Amount:', wager_confirm: 'Place Bet?',
    tevt_title: 'TERRITORY EVENTS', tevt_desc: 'Activate time-limited boosts on your territory using GP.', tevt_select_label: 'Select a Claim:', tevt_load_btn: 'â¡ LOAD EVENTS', tevt_active_label: 'ACTIVE EVENTS', tevt_none: 'No active events.', tevt_activate_confirm: 'Activate Territory Event?',
    prestige_btn: 'â­ PRESTIGE', prestige_buy_btn: 'â­ BUY PRESTIGE POINT', prestige_buy_confirm: 'Buy Prestige Point?', prestige_lb_title: 'ð PRESTIGE LEADERS', prestige_lb_none: 'No prestige players yet.',
    beacon_title: 'MAP BEACONS', beacon_desc: 'Place a visible beacon on the map for other players to see.', beacon_icon_label: 'ICON', beacon_msg_label: 'MESSAGE (optional)', beacon_x_label: 'X', beacon_y_label: 'Y', beacon_use_plot: 'ð PLOT', beacon_place_btn: 'ð¡ PLACE BEACON', beacon_active_label: 'ACTIVE BEACONS', beacon_none: 'No active beacons.', beacon_place_confirm: 'Place Map Beacon?', beacon_no_plot: 'Select a plot on the map first', beacon_coords_required: 'Enter coordinates first',
    donation_title: 'COLONY FUND', donation_amount_label: 'AMOUNT (GP)', donation_msg_label: 'MESSAGE (optional)', donation_donate_btn: 'ðï¸ DONATE', donation_none: 'No donations yet. Be the first!', donation_top_btn: 'ð TOP DONORS', donation_top_title: 'TOP DONORS', donation_confirm: 'Donate to Colony Fund?', donation_min_hint: 'Enter an amount',
    poll_title: 'COMMUNITY POLLS', poll_create_btn: '+ POLL', poll_create_title: 'CREATE POLL', poll_question_label: 'QUESTION', poll_options_label: 'OPTIONS', poll_add_option: '+ ADD OPTION', poll_duration_label: 'DURATION (h):', poll_publish_btn: 'ð PUBLISH', poll_none: 'No active polls. Create the first one!', poll_publish_confirm: 'Publish Poll?', poll_question_required: 'Enter a question', poll_min_options_hint: 'Need at least 2 options',
    status_label: 'ð¬ STATUS MESSAGE', status_set_btn: 'SET', status_none: 'No active status', status_required: 'Enter a status message', status_set_confirm: 'Set Status Message?',
    vtag_label: 'ð·ï¸ VANITY TAG', vtag_set_btn: 'SET', vtag_clear_btn: 'â', vtag_none: 'No vanity tag set', vtag_required: 'Enter a tag', vtag_set_confirm: 'Set Vanity Tag?', vtag_clear_confirm: 'Remove Vanity Tag?', vtag_free: 'Free', vtag_set_success: 'ð·ï¸ Vanity tag set!', vtag_cleared: 'Tag removed', vtag_cost_hint: 'First tag: {first} GP Â· Change: {change} GP', vtag_disabled: 'Vanity tags disabled',
    tribute_label: 'TRIBUTES', tribute_btn: 'ðª TRIBUTE', tribute_modal_title: 'TRIBUTE TERRITORY', tribute_modal_desc: 'Send a GP tribute to the owner of territory', tribute_amount_label: 'AMOUNT (GP)', tribute_msg_label: 'MESSAGE (optional)', tribute_send_btn: 'ðª TRIBUTE', tribute_confirm: 'Send GP Tribute?', tribute_sent: 'ðª Tribute sent!', tribute_amount_required: 'Enter a valid GP amount',
    graffiti_label: 'GRAFFITI', graffiti_btn: 'âï¸ GRAFFITI', graffiti_modal_title: 'SPRAY GRAFFITI', graffiti_modal_desc: 'Spray graffiti on territory', graffiti_text_label: 'TEXT / EMOJI (max 30)', graffiti_spray_btn: 'âï¸ SPRAY', graffiti_confirm: 'Spray Graffiti?', graffiti_placed: 'âï¸ Graffiti placed!', graffiti_text_required: 'Enter graffiti text',
    banner_label: 'VICTORY BANNERS', banner_btn: 'ð© PLANT BANNER', banner_modal_title: 'PLANT VICTORY BANNER', banner_modal_desc: 'Plant a victory banner on territory', banner_emoji_label: 'BANNER EMOJI', banner_msg_label: 'WAR CRY (optional)', banner_plant_btn: 'ð© PLANT', banner_confirm: 'Plant Victory Banner?', banner_planted: 'ð© Banner planted!',
    rating_your_label: 'YOUR RATING', rating_confirm: 'Rate Territory?', rating_submitted: 'â­ Rating submitted!',
    highlight_btn: 'â¨ HIGHLIGHT', highlight_modal_title: 'HIGHLIGHT TERRITORY', highlight_modal_desc: 'Make your territory glow on the map', highlight_color_label: 'GLOW COLOR', highlight_activate_btn: 'â¨ ACTIVATE', highlight_confirm: 'Highlight Territory?', highlight_activated: 'â¨ Territory highlighted!', highlight_active_label: 'HIGHLIGHTED',
    tdesc_title: 'TERRITORY DESCRIPTION', tdesc_desc: 'Add a custom description to your territory. Visible to all players.', tdesc_claim_label: 'CLAIM #', tdesc_use_claim: 'ð MINE', tdesc_current_label: 'CURRENT', tdesc_text_label: 'DESCRIPTION', tdesc_save_btn: 'ð SAVE DESCRIPTION', tdesc_my_label: 'MY DESCRIPTIONS', tdesc_none: 'No descriptions set yet.', tdesc_save_confirm: 'Save Territory Description?', tdesc_required: 'Enter a description', tdesc_claim_required: 'Enter a Claim #', tdesc_no_claim: 'Select a territory first', tdesc_free: 'Free', tdesc_saved: 'â Description saved!', tdesc_free_hint: 'First description is free. Updates cost {cost} GP.',
    sponsor_label: 'SPONSORS', sponsor_btn: 'ðï¸ SPONSOR', sponsor_modal_title: 'SPONSOR TERRITORY', sponsor_modal_desc: 'Sponsor territory #', sponsor_msg_label: 'MESSAGE (optional)', sponsor_place_btn: 'ðï¸ SPONSOR', sponsor_confirm: 'Sponsor Territory?', sponsor_placed: 'ðï¸ Sponsored!',
    hijack_btn_short: 'â HIJACK TERRITORY',
    capsule_title: 'TIME CAPSULE', capsule_desc: 'Bury a sealed message to be revealed to all players in the future.', capsule_msg_label: 'MESSAGE (max 280 chars)', capsule_days_label: 'REVEAL IN (days)', capsule_bury_btn: 'â³ BURY CAPSULE', capsule_revealed_label: 'RECENTLY REVEALED', capsule_none: 'No revealed capsules yet.', capsule_none_pending: 'No capsules buried yet. Be the first!', capsule_bury_confirm: 'Bury Time Capsule?', capsule_msg_required: 'Enter a message', capsule_days_required: 'Enter days > 0', capsule_buried: 'â³ Capsule buried!',
    milestone_title: 'COLONY MILESTONES', milestone_desc: 'Record a personal milestone in the colony\'s history.', milestone_cat_label: 'CATEGORY', milestone_title_label: 'TITLE (max 50 chars)', milestone_desc_label: 'DESCRIPTION (max 200 chars)', milestone_record_btn: 'ð RECORD MILESTONE', milestone_write_btn: 'â RECORD MILESTONE', milestone_refresh_btn: 'âº REFRESH', milestone_cost_hint: 'Cost: {gp} GP', milestone_empty: 'No milestones recorded yet. Be the first!', milestone_login_required: 'Login required', milestone_title_required: 'Enter a title', milestone_desc_required: 'Enter a description', milestone_confirm_title: 'Record Milestone?', milestone_confirm_body: 'Record {cat} milestone "{title}" for {gp} GP?', milestone_recorded: 'Milestone recorded in colony history!',
    tombstone_label: 'TOMBSTONES', tombstone_btn: 'ðª¦ PLACE TOMBSTONE', tombstone_modal_title: 'PLACE TOMBSTONE', tombstone_modal_desc: 'Leave an epitaph on this territory you once owned.', tombstone_epitaph_label: 'EPITAPH (max 60 chars)', tombstone_place_btn: 'ðª¦ PLACE', tombstone_cost_hint: 'Cost: {gp} GP', tombstone_confirm_title: 'Place Tombstone?', tombstone_confirm_body: 'Place a permanent tombstone for {gp} GP?', tombstone_placed: 'Tombstone placed.',
    gpannounce_title: 'COLONY BROADCAST', gpannounce_desc: 'Broadcast a message to all active players in the scrolling ticker.', gpannounce_msg_label: 'MESSAGE (max 80 chars)', gpannounce_dur_label: 'DURATION (min)', gpannounce_post_btn: 'ð¢ BROADCAST', gpannounce_login_required: 'Login required', gpannounce_msg_required: 'Enter a message to broadcast', gpannounce_confirm_title: 'Post Colony Broadcast?', gpannounce_confirm_body: 'Broadcast for {dur}min costs {gp} GP. Your message will scroll for all active players.', gpannounce_posted: 'Broadcast is live!',
    prestige_label: 'PRESTIGE', prestige_upgrade_btn: 'ð UPGRADE PRESTIGE', prestige_modal_title: 'PRESTIGE UPGRADE', prestige_confirm_btn: 'UPGRADE', prestige_permanent_note: 'Prestige is permanent and cannot be downgraded.', prestige_login_required: 'Login required', prestige_max_reached: 'Territory already at maximum prestige!', prestige_upgraded: 'ð Territory upgraded to {name}!',
    journal_title: 'COLONY JOURNAL', journal_desc: 'Publish a permanent entry to the colony\'s public record. Your words live forever on the frontier.', journal_title_label: 'TITLE (max 60 chars)', journal_content_label: 'ENTRY (max 500 chars)', journal_publish_btn: 'ð PUBLISH ENTRY', journal_write_btn: 'â WRITE AN ENTRY', journal_feed_label: 'COLONY CHRONICLE', journal_refresh_btn: 'âº REFRESH', journal_cost_hint: 'Cost: {gp} GP to publish', journal_empty: 'No journal entries yet. Be the first colonist to write history!', journal_login_required: 'Login required to publish', journal_title_required: 'Enter a title', journal_content_required: 'Enter your journal entry', journal_confirm_title: 'Publish Journal Entry?', journal_confirm_body: 'Publish "{title}" for {gp} GP? This entry is permanent and public.', journal_published: 'Entry published to the colony chronicle!',
    base_profile_btn: 'ð¤ PROFILE', profile_nickname_label: 'NICKNAME', profile_motto_label: 'MOTTO', profile_color_label: 'AVATAR COLOR', profile_set_btn: 'SET', profile_history_btn: 'ð CHANGE HISTORY', profile_no_motto: 'No motto set', profile_nick_confirm: 'Set Nickname?', profile_motto_confirm: 'Set Motto?', profile_color_confirm: 'Set Avatar Color?',
    quests_failed: 'Failed to load quests',
    quests_none_active: 'No active quests. Check back soon!',
    quests_pool_depleted: 'REWARD POOL DEPLETED â Rewards temporarily paused',
    quests_pool_low: 'LOW POOL â Rewards reduced to {pct}%',
    quests_tier_free: 'FREE MISSIONS',
    quests_tier_activity: 'ACTIVITY MISSIONS',
    quests_tier_spending: 'SPECIAL OPS',
    quests_claim_btn: 'CLAIM',
    quests_claim_prefix: 'CLAIM',
    quests_claiming: 'CLAIMING...',
    quests_pool_empty_unavailable: 'Pool empty â reward unavailable',
    quests_recently_completed: 'RECENTLY COMPLETED',
    quests_expired: 'Expired',
    quests_remaining: 'remaining',
    quests_claim_failed: 'Claim failed',
    quests_claim_success: '+{gp} GP from "{title}"!',
    quests_network_error: 'Network error',
    quests_login_first: 'LOGIN FIRST',
    quests_completed_toast: 'Quest complete: "{title}" â Claim your reward!',
    // Daily check-in
    daily_checkin_title: 'ð DAILY CHECK-IN',
    daily_streak_days: 'ð¥ {n} DAYS',
    daily_day_of: 'Day {cur} of {total}',
    daily_day_prefix: 'DAY',
    daily_done: 'DONE',
    daily_gp_suffix: 'GP',
    daily_bonus_suffix: 'BONUS',
    daily_checked_in: 'â Checked in today!',
    daily_today_label: 'Today:',
    daily_checkin_btn: 'â CHECK IN',
    daily_missions_title: 'DAILY MISSIONS',
    daily_resets_prefix: 'RESETS',
    daily_all_bonus_title: 'ð +50 GP BONUS!',
    daily_all_bonus_sub: 'ALL DAILY MISSIONS COMPLETE',
    daily_login_required: 'Login required',
    daily_already_checked: 'Already checked in today!',
    daily_check_in_failed: 'Check-in failed, try again',
    daily_gp_claimed: '+{n} GP CLAIMED!',
    daily_streak_bonus: '+{n} GP STREAK BONUS!',
    daily_checkin_complete: 'CHECK-IN COMPLETE',
    daily_streak_msg: 'Day {n} streak!',
    daily_mission_complete_toast: '+{n} GP MISSION COMPLETE!',
    daily_all_missions_bonus_toast: 'ð +50 GP ALL MISSIONS BONUS!',
    daily_mission_claim_failed: 'Claim failed',
    daily_mission_claim_conn_failed: 'Claim failed â check connection',
    // Mission titles & descriptions (7 types)
    dm_claim_pixels: 'Expand Territory', dm_claim_pixels_d: 'Claim land pixels on the Mars globe',
    dm_harvest: 'Collect Resources', dm_harvest_d: 'Harvest PP from your owned territory',
    dm_explore_poi: 'Recon Mission', dm_explore_poi_d: 'Discover a POI marker on the globe',
    dm_hijack: 'Hostile Takeover', dm_hijack_d: 'Hijack enemy territory with GP',
    dm_play_cantina: 'Cantina Night', dm_play_cantina_d: 'Play a mini-game in the Cantina',
    dm_equip_cosmetic: 'Mars Fashion', dm_equip_cosmetic_d: 'Equip a cosmetic item from your inventory',
    dm_view_weather: 'Storm Chaser', dm_view_weather_d: 'Check the Mars weather forecast',
    dm_enhance_item: 'Enhancement Lab', dm_enhance_item_d: 'Attempt to enhance a cosmetic item',
    dm_marketplace_trade: 'Market Day', dm_marketplace_trade_d: 'Buy an item on the marketplace',
    dm_win_naval_battle: 'Naval Victory', dm_win_naval_battle_d: 'Win a naval battle against another fleet',
    dm_build_ship: 'Shipyard Rush', dm_build_ship_d: 'Order a new ship for your fleet',
    dm_daily_checkin: 'Daily Check-in', dm_daily_checkin_d: 'Log in and check in today',
    dm_claim_fallback: 'CLAIM TERRITORY', dm_claim_fallback_d: 'Claim land pixels on the Mars globe',
    dm_explore_fallback: 'EXPLORE SECTORS', dm_explore_fallback_d: 'Discover a POI marker on the globe',
    dm_play_fallback: 'DAILY ACTIVITY', dm_play_fallback_d: 'Perform any game action (claim, mine, hijack, etc.)',
    // ââ GUILD tab ââ
    guild_join_or_create: 'JOIN OR CREATE A GUILD',
    guild_teamup_desc: 'Team up with other colonists to dominate Mars',
    guild_pending_invites: 'PENDING INVITES',
    guild_find_title: 'FIND A GUILD',
    guild_find_hint: '(ID Â· TAG Â· NAME)',
    guild_find_placeholder: 'e.g.  42 Â· MARS Â· Red Legion',
    guild_search_btn: 'SEARCH',
    guild_create_title: 'CREATE NEW GUILD',
    guild_create_cost_hint: '(costs 50 GP)',
    guild_name_placeholder: 'Guild name (2-50 chars)',
    guild_tag_placeholder: 'TAG (2-4)',
    guild_desc_placeholder: 'Description (optional)',
    guild_create_btn: 'CREATE GUILD (50 GP)',
    guild_members_label: 'MEMBERS',
    guild_total_pixels_label: 'TOTAL PIXELS',
    guild_gp_treasury_label: 'GP TREASURY',
    guild_edit_btn: 'â EDIT',
    guild_upgrades_title: 'GUILD UPGRADES',
    guild_pp_treasury: 'PP TREASURY',
    guild_next_prefix: 'Next:',
    guild_next_dash: 'Next: â',
    guild_max_level: 'MAX LEVEL',
    guild_levelup_btn: 'LEVEL UP â²',
    guild_my_contribution: 'MY HARVEST CONTRIBUTION',
    guild_contribution_hint: 'Portion of every harvest siphoned into the guild treasury.',
    guild_research_title: 'RESEARCH',
    guild_research_unlocked: 'â UNLOCKED',
    research_mining_eff_1: 'â MINING EFF. I', research_shield_disc: 'ð¡ SHIELD DISCIPL.', research_diplomatic: 'ð DIPLOMATIC',
    research_orbital_scan: 'ð° ORBITAL SCAN', research_rapid_deploy: 'ð RAPID DEPLOY', research_logistics: 'ð¦ LOGISTICS', research_mars_dominion: 'ð¥ MARS DOMINION',
    guild_join_requests: 'JOIN REQUESTS',
    guild_no_requests: 'No pending requests.',
    guild_invite_title: 'INVITE PLAYER',
    guild_invite_hint: '(SEARCH BY NICKNAME OR WALLET)',
    guild_invite_placeholder: 'Type 1+ char to search...',
    guild_invite_btn: 'INVITE',
    guild_chat_title: 'ð¬ GUILD CHAT',
    guild_chat_refresh: 'â» REFRESH',
    guild_chat_empty: 'No messages yet. Say hi!',
    guild_chat_loading: 'Loading chat...',
    guild_chat_placeholder: 'Type message...',
    guild_chat_send: 'SEND',
    guild_leaderboard_title: 'GUILD LEADERBOARD',
    guild_leave_btn: 'LEAVE GUILD',
    guild_danger_zone: 'DANGER ZONE',
    guild_disband_btn: 'DISBAND GUILD',
    guild_lb_empty: 'No guilds yet. Be the first!',
    guild_lb_members_suffix: 'members',
    guild_lb_leader_prefix: 'Leader:',
    guild_lb_unknown: 'Unknown',
    guild_lb_pixels: 'PIXELS',
    guild_level_prefix: 'Lv.',
    guild_invited_by: 'Invited by',
    guild_accept_btn: 'ACCEPT',
    guild_promote_btn: 'PROMOTE',
    guild_demote_btn: 'DEMOTE',
    guild_kick_btn: 'KICK',
    guild_transfer_btn: 'LEADER',
    guild_member_role: 'member',
    guild_officer_role: 'officer',
    guild_leader_role: 'leader',
    guild_search_searching: 'Searchingâ¦',
    guild_search_none: 'No guilds match "{q}"',
    guild_search_failed: 'Search failed',
    guild_search_join_btn: 'JOIN',
    guild_invite_no_matches: 'No matches.',
    guild_invite_pending: 'PENDING',
    guild_invite_search_failed: 'Search failed.',
    guild_pixels_owned: 'px owned',
    guild_pixels_short: 'px',
    guild_toast_login_first: 'Login first',
    guild_toast_no_guild: 'No guild',
    guild_toast_need_name_tag: 'Enter guild name and tag',
    guild_toast_created: 'Guild [{tag}] created!',
    guild_toast_create_failed: 'Failed to create guild',
    guild_toast_enter_target: 'Enter wallet or nickname',
    guild_toast_invite_sent: 'Invite sent!',
    guild_toast_invite_failed: 'Failed to invite',
    guild_toast_joined: 'Joined guild!',
    guild_toast_accept_failed: 'Failed to accept',
    guild_toast_declined: 'Invite declined',
    guild_toast_generic_failed: 'Failed',
    guild_toast_player_added: 'Player added to guild',
    guild_toast_sign_in_first: 'Sign in first',
    guild_confirm_join_request: 'Send a join request to {name}?\n\nA leader or officer of this guild must approve your request.',
    guild_toast_join_request_sent: 'Join request sent to {name}',
    guild_toast_join_request_failed: 'Failed to send request',
    guild_confirm_leave: 'Leave this guild?',
    guild_toast_left: 'Left guild',
    guild_confirm_kick: 'Kick this member?',
    guild_toast_kicked: 'Member kicked',
    guild_toast_promoted: 'Promoted to officer',
    guild_toast_demoted: 'Demoted to member',
    guild_confirm_transfer: 'Transfer leadership? This cannot be undone.',
    guild_toast_transferred: 'Leadership transferred',
    guild_toast_leveled_up: 'Guild leveled up to Lv.{n}!',
    guild_toast_levelup_failed: 'Level up failed',
    guild_toast_research_unlocked: 'Research unlocked!',
    guild_toast_research_failed: 'Research failed',
    guild_confirm_disband: 'â  DISBAND guild "{name}"?\n\nAll members will be removed.\nThis cannot be undone!',
    guild_prompt_disband_type: 'To confirm, type the guild name exactly:\n\n{name}',
    guild_toast_disband_mismatch: 'Guild name mismatch â disband cancelled',
    guild_toast_disbanded: 'Guild disbanded',
    guild_toast_no_guild_data: 'No guild data',
    guild_toast_send_failed: 'Failed to send',
    // ââ Global UI ââ
    nav_claim: 'CLAIM', nav_cantina: 'CANTINA', nav_base: 'BASE', nav_items: 'ITEMS',
    nav_my_land: 'MY LAND', sectors_btn: 'SECTORS', open_gacha_label: 'SHIP CRATES', open_gacha_sub: 'GACHA', my_assets_btn: 'MY ASSETS', full_loss_optin_label: '⚔ Opt in to PvP full-loss (ships destroyed only in mutually-agreed battles)',
    open_base: 'OPEN BASE', open_gacha: 'ð² SHIP CRATES', enter_cantina: 'â ENTER THE CANTINA',
    my_base: 'MY BASE', deposit_btn: 'DEPOSIT', withdraw_btn: 'WITHDRAW', logout_btn: 'LOGOUT',
    harvest_all_btn: 'â HARVEST ALL', tend_all_btn: 'ð§ TEND ALL', export_key_btn: 'ð KEY', export_key_title: 'ð EXPORT WALLET KEY', export_key_disclaimer: 'â  This reveals your wallet PRIVATE KEY. Anyone with it controls your funds. Store it offline and never share it. <b>You alone are responsible â if it is lost or stolen, the operator cannot recover it or your assets.</b>', export_key_ack: 'I understand and accept full responsibility for safekeeping my key.', export_key_pw_ph: 'Confirm your password', export_key_reveal_btn: 'REVEAL PRIVATE KEY', export_key_addr: 'ADDRESS', export_key_priv: 'PRIVATE KEY', export_key_copy: 'ð COPY KEY', export_key_close_warn: 'Close this window after saving. The key is not shown again automatically.',
    address_copied: 'Address copied!',
    // ââ Territory Info (left panel) ââ
    top_governors: 'ð TOP GOVERNORS', loading_dots: 'Loading...',
    no_alerts: 'No alerts yet', live_feed_title: 'LIVE FEED', live_feed_empty: 'No live events yet.',
    claim_land: 'CLAIM TERRITORY', drag_select: 'DRAG TO SELECT LAND',
    land_size: 'SIZE', land_pixels: 'PIXELS', land_cost: 'COST',
    confirm_btn: 'CONFIRM', cancel_btn: 'CANCEL',
    claim_add_img: 'Claim land first, add image later',
    my_territories: 'MY TERRITORIES', no_territories: 'No territories yet',
    info_guild: 'GUILD', info_link: 'LINK', info_name: 'NAME',
    share_btn: 'ð¤ SHARE', rename_btn: 'RENAME', edit_image: 'EDIT IMAGE', customize_btn: 'â¨ CUSTOMIZE', merge_btn: 'ð MERGE TERRITORIES',
    cosmetics_title: 'COSMETICS', promo_link: 'PROMO LINK', save_btn: 'SAVE',
    // ââ Claim Modal ââ
    hijack_warn_title: 'â  HIJACK TERRITORY',
    hijack_current_owner: 'Current owner:',
    hijack_refund: 'They receive: refund + 10% bonus',
    hijack_you_pay: 'You pay:',
    claim_location: 'LOCATION', claim_chain: 'CHAIN', claim_cost: 'COST',
    claim_pay_with: 'PAY WITH', claim_note: 'Owner receives 100% refund + 10% bonus Â· Fee: 10%',
    // ââ Image Editor ââ
    image_editor: 'IMAGE EDITOR', upload_click: 'Click to upload image',
    upload_hint: 'PNG, JPG, GIF Â· Max 5MB',
    editor_drag_hint: 'Drag to move Â· Scroll to zoom Â· Use controls to rotate',
    // ââ Deposit/Withdraw/Swap ââ
    swap_fee: 'Swap fee:', you_receive: 'You receive:',
    // ââ Shop Modal ââ
    item_shop_title: 'ð¡ï¸ ITEM SHOP',
    shop_tab_shop: 'ð SHOP', shop_tab_inv: 'ð¦ MY ITEMS',
    shop_cat_all: 'ALL', shop_cat_defense: 'DEFENSE', shop_cat_attack: 'ATTACK',
    shop_cat_utility: 'UTILITY', shop_cat_boost: 'BOOST', shop_cat_cosmetic: 'COSMETIC',
    shop_active_effects: 'ACTIVE EFFECTS', shop_my_inventory: 'MY INVENTORY',
    shop_confirm_title: 'Confirm Purchase',
    shop_loading: 'Loading items...', shop_inv_loading: 'Loading inventory...',
    // ââ Enhancement ââ
    enh_enhance: 'ENHANCE', enh_workshop: 'ENHANCEMENT WORKSHOP',
    enh_materialized: 'Item ready for enhancement!', enh_returned: 'Item returned to inventory',
    enh_materialize_tip: 'Convert to individual item for enhancement',
    enh_return_tip: 'Return to inventory stack',
    enh_current_level: 'Current Level', enh_next_level: 'Next Level',
    enh_cost: 'Cost', enh_balance: 'Balance', enh_success_rate: 'Success Rate',
    enh_body: 'Attempt to enhance this item. On failure: level may stay, drop, or the item may be destroyed.',
    enh_maxed_body: 'This item has reached maximum enhancement.',
    enh_confirm: 'ENHANCE', enh_success: 'Enhancement succeeded!',
    enh_fail_stay: 'Enhancement failed. Level unchanged.',
    enh_fail_down: 'Enhancement failed! Level dropped to',
    enh_fail_destroy: 'Enhancement failed! Item destroyed!',
    // ââ MY TERRITORY tab (base) ââ
    cmd_message: "COMMANDER'S MESSAGE",
    total_px_label: 'TOTAL PIXELS', usdt_bal_label: 'USDT BALANCE', pp_bal_label: 'PP BALANCE',
    level_label: 'LEVEL', xp_next: 'Next: {n} XP', max_level: 'MAX LEVEL',
    share_stats: 'ð¤ SHARE MY STATS', breakthrough_title: 'BREAKTHROUGH',
    all_ranks: 'ALL RANKS', show_label: 'â¼ SHOW', hide_label: 'â² HIDE',
    rank_tbl_lv: 'LV', rank_tbl_name: 'NAME', rank_tbl_xp: 'XP', rank_tbl_reward: 'PP REWARD',
    my_sectors: 'MY SECTORS', no_sectors_yet: 'No territories claimed yet. Explore the map!',
    login_to_view: 'Login to view your territories.',
    // ââ SECTORS tab ââ
    all_24_sectors: 'ALL 24 SECTORS',
    sector_all: 'ALL', sector_core: 'CORE', sector_mid: 'MID', sector_frontier: 'FRONTIER',
    sector_my: 'â­ MY SECTORS', sector_loading: 'Loading sectors...',
    sector_claims_24h: '{n} claims in 24h', sector_occupied: 'OCCUPIED',
    sector_avg_price: 'AVG PRICE', sector_cur_price: 'CUR. PRICE', sector_owners: 'OWNERS',
    sector_top_holder: 'TOP HOLDER', sector_gov: 'GOVERNOR', sector_vice_gov: 'VICE GOV',
    sector_tax: 'TAX RATE', sector_my_px: 'MY PIXELS', sector_go: 'GO',
    sector_empty_hint: "You don't own any pixels yet. Claim territory to see your sectors here.",
    // ââ MINING tab ââ
    harvestable_pp: 'HARVESTABLE PP', total_mined: 'TOTAL MINED',
    harvest_pp: 'â MINE', harvest_now: 'â¡ INSTANT MINE ({cost} PP)', mine_btn: 'â MINE',
    mine_timer_prefix: 'Next harvest available in',
    harvest_available: 'Harvest available now!', harvest_ready: 'Ready!',
    claim_to_mine: 'Claim pixels to start mining!',
    mining_rates: 'MINING RATES',
    rate_reward_range: 'Reward Range', rate_interval: 'Harvest Interval',
    rate_core: 'Core Bonus', rate_mid: 'Mid Bonus', rate_frontier: 'Frontier Bonus',
    // ââ GOVERN tab ââ
    governance_title: 'â GOVERNANCE',
    gov_active_events: 'ACTIVE EVENTS', gov_my_positions: 'MY POSITIONS',
    gov_login_positions: 'Login to view your governance positions.',
    gov_commander: 'COMMANDER', gov_commander_controls: 'COMMANDER CONTROLS',
    gov_global_event: 'GLOBAL EVENT (1/day)',
    gov_double_mining: 'â DOUBLE MINING', gov_war_time: 'â WAR TIME', gov_peace: 'ð PEACE',
    gov_announcement: 'ANNOUNCEMENT', gov_announce_placeholder: 'Global message...',
    gov_set: 'SET', gov_bounty: 'BOUNTY', gov_target_nick: 'Target nickname',
    gov_place: 'PLACE', gov_rocket_drop: 'ROCKET SUPPLY DROP',
    gov_launch_drop: 'ð LAUNCH SUPPLY DROP',
    gov_governor_controls: 'GOVERNOR CONTROLS', gov_select_sector: 'SELECT SECTOR â¾',
    gov_tax_rate: 'TAX RATE', gov_sector_buffs: 'SECTOR BUFFS',
    gov_mining_20: 'â MINING +20%', gov_defense_10: 'ð¡ DEFENSE +10%', gov_claim_10: 'ð° CLAIM -10%',
    gov_sector_announce: 'SECTOR ANNOUNCEMENT', gov_sector_msg: 'Sector message...',
    gov_bounty_board: 'BOUNTY BOARD', gov_no_bounties: 'No active bounties.',
    gov_siege_title: 'âï¸ SECTOR SIEGE', gov_select_sector_siege: 'Select sector...',
    gov_select_siege_hint: 'Select a sector to view siege status.',
    gov_challenge_btn: 'âï¸ CHALLENGE FOR GOVERNOR',
    gov_betting_title: 'ð° SIEGE BETTING', gov_bet_challenger: 'âï¸ Challenger', gov_bet_governor: 'ð¡ Governor',
    gov_declaration: 'GOVERNOR DECLARATION (5 GP)',
    gov_declare_save: 'DECLARE',
    gov_policy_open: 'Open (All Welcome)', gov_policy_ally: 'Allies Only', gov_policy_closed: 'Closed',
    gov_titles_title: 'ð MY TITLES', gov_titles_hint: 'Connect wallet to view your titles.',
    gov_fleet_title: 'â MY FLEET', gov_fleet_hint: 'Connect wallet to view your fleet.',
    gov_faction_btn: 'ð¡ FACTION', gov_hijack_btn: 'â HIJACK', gov_registry_btn: 'ð REGISTRY', gov_minerals_btn: 'ð MINERALS',
    gov_fleet_empty: 'No ships yet â open the shipyard below to start building.',
    gov_fleet_my: 'MY SHIPS', gov_fleet_max: '10 max', gov_shipyard: 'SHIPYARD',
    gov_ship_build: 'BUILD SHIP', gov_ship_built: 'built!', gov_ship_repair: 'REPAIR',
    gov_ship_repaired: 'Ship repaired!', gov_ship_repair_confirm: 'Repair this ship to full HP?',
    gov_ship_upgrade: 'UPGRADE', gov_ship_upgraded: 'upgraded!', gov_ship_upgrade_cost: 'Upgrade Cost',
    sy_tab_blueprints: 'BLUEPRINTS', sy_tab_queue: 'BUILD QUEUE', sy_tab_fleet: 'MY FLEET', sy_tab_market: 'SHIP MARKET', sy_tab_crates: 'CRATES', sy_tab_assembly: 'ACTIVATE', sy_crate_intro: 'Open a crate to receive a random ship. Ships you receive are tradeable on the Ship Market. Drop rates are disclosed on each crate.',
    sy_filter_size: 'SIZE:', sy_size_all: 'ALL', sy_size_frigate: 'Frigate', sy_size_destroyer: 'Destroyer', sy_size_cruiser: 'Cruiser', sy_size_battleship: 'Battleship', sy_size_titan: 'Titan',
    sy_filter_faction: 'FACTION:', sy_filter_size2: 'SIZE:',
    sy_mineral_label: 'Minerals Owned', sy_ships_label: 'Ships',
    ship_mkt_buy: 'Buy', ship_mkt_cancel: 'Cancel Listing',
    gov_battle_title: 'âï¸ NAVAL BATTLES', gov_battle_hint: 'Connect wallet to view battles.',
    gov_battle_active: 'ACTIVE BATTLES', gov_battle_declare: 'DECLARE ATTACK',
    gov_battle_declared: 'Battle declared! Awaiting defender response.',
    gov_battle_history: 'BATTLE HISTORY', gov_battle_no_ships: 'Build ships first! No docked ships available.',
    gov_battle_target_label: 'Target wallet', gov_battle_select_ships: 'Select ships (max 5)',
    gov_battle_declare_confirm: 'DECLARE BATTLE', gov_battle_respond: 'Respond to Battle',
    gov_battle_select_defender: 'Select ships to defend with', gov_battle_accept: 'ACCEPT & FIGHT',
    gov_battle_fighting: 'Battle started! Results in ~60 seconds.',
    gov_battle_cancelled_ok: 'Battle cancelled. GP refunded.',
    gov_hall_of_fame: 'ð HALL OF FAME', gov_select_sector_hof: 'Select sector...',
    gov_select_hof_hint: 'Select a sector to view history.',
    // ââ OPS tab ââ
    ops_title: 'OPS MISSION CONSOLE',
    ops_desc: 'Launch and manage invasion & exploration missions from your territory pads',
    ops_pads_ready: 'PADS READY',
    ops_launch_new: 'LAUNCH NEW MISSION',
    ops_invasion: 'â INVASION', ops_explore: 'ð° EXPLORE',
    ops_select_pad: 'SELECT LAUNCH PAD', ops_bigger_reward: '(bigger pad â bigger reward)',
    ops_target_lat: 'Target Lat', ops_target_lng: 'Target Lng',
    ops_target_wallet: 'Target wallet / nickname (invasion only)',
    ops_launch_btn: 'LAUNCH MISSION â¶',
    ops_active: 'ACTIVE OPERATIONS', ops_no_missions: 'No active missions. Launch one above.',
    ops_no_pads: "â You don't own any territory yet â claim a pixel patch first to get a launch pad.",
    ops_launched: 'LAUNCHED', ops_ready_status: 'â READY',
    ops_territory: 'TERRITORY', ops_merged: 'merged',
    ops_ready_claim: 'READY TO CLAIM', ops_failed: 'FAILED',
    ops_claim: 'CLAIM', ops_abort: 'ABORT',
    ops_abort_title: 'ABORT MISSION',
    ops_abort_body: 'Recall this mission back to base? Only a partial fuel refund will be issued.',
    ops_abort_btn: 'ABORT',
    ops_connect_first: 'Connect wallet first', ops_pick_pad: 'Pick a launch pad first',
    ops_enter_coords: 'Enter target coordinates', ops_target_required: 'Target wallet or nickname required',
    ops_mission_launched: 'Mission launched!', ops_launch_failed: 'Launch failed:',
    ops_claim_failed: 'Claim failed:', ops_load_failed: 'Failed to load missions.',
    ops_mission_aborted: 'Mission aborted Â· {pp} PP refunded',
    ops_cancel_failed: 'Cancel failed:', ops_no_reward: 'No reward',
    ops_pick_hint: 'â Pick a launch pad above',
    ops_await_target: 'â Awaiting target lockâ¦',
    ops_computing: 'â¦computing trajectory',
    ops_browse: 'ð¯ BROWSE',
    ops_invade_label: 'INVADE', ops_explore_label: 'EXPLORE',
    // ââ Shop (base tab) ââ
    base_shop_btn: 'ð SHOP', base_inv_btn: 'ð MY ITEMS',
    // ââ Arena / Cantina ââ
    arena_connect: 'CONNECT',
    crash_title: 'CRASH', mines_title: 'MINES', coinflip_title: 'COINFLIP',
    dice_title: 'DICE', hilo_title: 'HI-LO',
    crash_guide_1: 'BET', crash_guide_2: 'WATCH RISE', crash_guide_3: 'CASHOUT!',
    crash_waiting: 'WAITING...', crash_next_round: 'Next round starting soon',
    crash_bets_round: 'BETS THIS ROUND', bet_amount: 'BET AMOUNT',
    auto_cashout: 'AUTO CASHOUT', place_bet: 'PLACE BET',
    mines_count: 'MINES COUNT', gems_found: 'GEMS FOUND',
    multiplier: 'MULTIPLIER', next_mult: 'NEXT MULT', potential_win: 'POTENTIAL WIN',
    start_game: 'START GAME',
    pick_side: 'PICK A SIDE', heads: 'HEADS', tails: 'TAILS',
    flip_coin: 'FLIP COIN',
    roll_to_play: 'ROLL TO PLAY', roll_over: 'ROLL OVER', roll_under: 'ROLL UNDER',
    dice_target: 'TARGET', win_chance: 'WIN CHANCE', roll_dice: 'ROLL DICE',
    hilo_higher: 'â¬ HIGHER', hilo_cashout: 'CASHOUT', hilo_lower: 'â¬ LOWER',
    // ââ Profile / Account ââ
    prof_referral: 'REFERRAL', prof_live_feed: 'LIVE FEED', prof_alerts: 'ALERTS',
    prof_settings: 'SETTINGS',
    ref_share_desc: 'Share your code & earn PP from live referral commission activity (deposit, swap, shop, cantina, market fees).',
    ref_my_code: 'MY REFERRAL CODE', ref_code_copied: 'Code copied!',
    ref_enter_code: 'ENTER REFERRAL CODE', ref_code_placeholder: 'CODE...',
    ref_referred_by: 'Referred by:', prof_no_alerts: 'No alerts yet',
    settings_display: 'DISPLAY', settings_notifications: 'NOTIFICATIONS',
    settings_account: 'ACCOUNT',
    disp_weather: 'Show Weather Bar', disp_commander: 'Show Commander Banner',
    disp_rocket: 'Show Rocket Event Banner', disp_announce: 'Show Announce Marquee',
    disp_emblem: 'Show Guild Emblems', disp_tag: 'Show Guild Tags',
    notif_hijack: 'Hijack Alerts', notif_weather: 'Weather Events',
    notif_rocket: 'Rocket Drops', notif_mining: 'Mining Complete', notif_sound: 'Sound Effects',
    acct_change_pw: 'ð Change Password', acct_export: 'ð¦ Export My Data', acct_delete: 'ð Delete Account',
    nick_new_placeholder: 'New nickname',
    prof_photo_updated: 'PROFILE PHOTO UPDATED!',
    rank_up_title: 'RANK UP!', rank_up_msg: 'You reached Level {n}!',
    // ââ Weather ââ
    wx_active: 'ACTIVE',
    wx_sector: 'Sector', wx_time_left: 'Time Left',
    wx_sandstorm: 'Sandstorm', wx_sandstorm_desc: 'Harsh winds carry abrasive particles across the surface',
    wx_solar_flare: 'Solar Flare', wx_solar_flare_desc: 'Intense radiation from the sun disrupts electronics',
    wx_meteor_shower: 'Meteor Shower', wx_meteor_shower_desc: 'Debris from passing asteroids rains down on the surface',
    wx_dust_devil: 'Dust Devil', wx_dust_devil_desc: 'Swirling columns of dust reduce operational efficiency',
    wx_mining_yield: 'Mining Yield', wx_movement_speed: 'Movement Speed', wx_visibility: 'Visibility',
    wx_shield_strength: 'Shield Strength', wx_hijack_cost: 'Hijack Cost',
    wx_rare_drop: 'Rare Drop Chance', wx_harvest_bonus: 'Harvest Bonus',
    wx_structure_damage: 'Structure Damage', wx_claim_cost: 'Claim Cost',
    wx_exploration_speed: 'Exploration Speed',
    wx_reduced: 'Reduced', wx_possible: 'Possible',
    wx_unknown: 'Unknown weather event',
    // ââ Mode badge / misc ââ
    mode_claim: 'ð´ CLICK MARS TO SELECT TERRITORY',
    confirm_purchase: 'Confirm Purchase',
    global_stats_label: 'ð GLOBAL STATS',
    active_users_24h: 'ACTIVE USERS (24H)',
    top_pixel_holders: 'ð TOP PIXEL HOLDERS',
    refresh_btn: 'â» REFRESH',
    // ââ Fleet Command / World Events / Misc (global) ââ
    fcmd_title: 'â FLEET COMMAND',
    fcmd_sub: 'Fleets Â· Shipyard Â· Void Raider',
    fcmd_open_shipyard: 'ð¨ SHIPYARD',
    fcmd_my_fleets: 'â MY FLEETS',
    fcmd_tactical_lab: 'ð§ª TACTICAL LAB â FORMATION v11.2',
    tlab_title: 'ð§ª TACTICAL LAB',
    tlab_sub: 'FORMATION / MANEUVER v11.2 â LIVE SIMULATION',
    tlab_close: 'â CLOSE',
    ace_title: 'â ACE MODE',
    ace_sub: 'DIRECT PILOT â CONTROLLED CHASE CAM',
    ace_close: 'â CLOSE',
    we_active_title: 'â  ACTIVE WORLD EVENTS',
    we_none_active: 'No active events',
    we_engage: 'â ENGAGE',
    btn_refresh: 'REFRESH',
    refresh_short: 'â»',
    guild_alliance_title: 'ð¤ ALLIANCE (UP TO 3 GUILDS)',
    war_declare_subtitle: 'Select a guild to declare war on',
    war_declare_title: 'DECLARE WAR',
    war_stake_label: 'â¡ STAKE (OPTIONAL): bet GP from treasury â winner takes pot',
    war_declare_cost_label: 'Declaration Cost', war_treasury_label: 'Guild Treasury',
    war_search_placeholder: 'ð Filter: guild name or tag', war_search_hint: 'Enter 2+ characters to search',
    bd_search_hint: 'Enter 2+ characters to search', battle_attack_start: 'Attack!',
    reward_battle_title: 'ð Battle Reward', btn_confirm: 'Confirm', btn_cancel: 'Cancel',
    tn_tab_open: 'Open', tn_tab_running: 'Running', tn_tab_completed: 'Completed',
    rp_tab_featured: 'Featured', rp_tab_mine: 'My Shares',
    bd_my_fleet_label: 'My Fleet (Attacker)', bd_recommended_label: 'Recommended Opponents (Similar Skill)', bd_search_label: 'Search Opponent', bd_search_input_placeholder: 'Nickname or fleet name (2+ chars)...',
    ca_subtitle: '// Pre-battle tactical directives (max <span id="caMaxSel">2</span>)', ca_doctrines_label: 'ð DOCTRINE PRESETS â One-click tactical presets (recommended)', ca_sniper_actions: 'focus_fire (save 1 GP)',
    ca_focus_desc: 'Focus fire on target fleet â <b style="color:#ffd54f">+15% Damage</b>', ca_emp_desc: 'EMP at specific tick â enemy fire rate <b style="color:#ffd54f">Ã5 slowdown</b> for 30 ticks', ca_wedge_desc: 'Force charge tactics â Speed/ATK â, DEF â', ca_reinforce_desc: 'Deploy additional ships at start (1~20)',
    ca_focus_target_label: 'Target Enemy Fleet', ca_focus_auto_hint: 'Declared opponent fleet auto-assigned', ca_emp_tick_label: 'EMP trigger tick (0~8000, default 1200 â 4min)', ca_emp_tick_hint: '1 tick = 200ms, duration 30 ticks', ca_wedge_hint: 'No parameters â applies to all my fleet ships', ca_reinforce_label: 'Reinforcement Ships', ca_reinforce_hint: 'Max 20 ships â ship code Ã quantity',
    ca_quota: 'Selected <b id="caSelectedN">0</b> / <span id="caMaxSel2">2</span>', ca_skip_btn: 'Skip & Start Battle', ca_apply_btn: 'Apply Directives & Fight',
    ai_practice_desc: 'Practice battles against AI fleets of various difficulties. Rewards are 50% of regular battles.', tn_create_btn: 'Host Tournament',
    bh_title_kr: 'Fleet Battle', bh_tab_recent: 'Recent', bh_tab_history: 'My Records', bh_declare_btn: 'Declare Battle', bd_subtitle: '// Find your opponent',
    war_duration_label: 'â± DURATION (h): default 72h',
    war_declare_btn: 'âï¸ DECLARE WAR',
    war_declaring_btn: 'DECLARING...',
    war_treasury_low: 'Insufficient treasury GP ({need} needed, have {have})',
    codex_subtitle: 'Official game guidebook',
    loading: 'Loadingâ¦',
    // Campaign
    campaign_profile_btn: 'ð PROFILE', // [i18n backfill v7.172]
    campaign_btn_start: 'BEGIN OP', campaign_btn_continue: 'RESUME OP',
    campaign_btn_results: 'VIEW RESULT', campaign_btn_locked: 'LOCKED',
    campaign_label_completed: 'COMPLETED', campaign_label_prologue: 'PROLOGUE',
    campaign_label_route: 'ROUTE', campaign_label_ch: 'CH',
    campaign_no_chapters: 'No campaign chapters available.',
    campaign_no_faction: 'Select a faction to unlock the campaign.<br>Tap the faction badge â MCC / FSP / CV.',
    campaign_show_locked: 'SHOW LOCKED', campaign_hide_locked: 'HIDE LOCKED',
    campaign_meta_sim: 'Server simulation',
    campaign_reward_claimed: 'Reward claimed',
    campaign_objective_go: 'GO',
    campaign_result_success: 'MISSION COMPLETE',
    campaign_result_failure: 'MISSION FAILED',
    campaign_result_npc_success: 'Objective achieved. Proceeding to next phase.',
    campaign_result_npc_failure: 'Mission failed. Results recorded.',
    campaign_result_reward: 'Reward:',
    campaign_result_confirm: 'CONFIRM',
    campaign_result_recheck: 'RECHECK',
    campaign_objectives_gate: 'Complete remaining objectives first.',
    campaign_objectives_gate_sub: 'Timer expired but play conditions not yet met.',
    campaign_sim_in_progress: 'Operation in progress...',
    campaign_sim_radio_prefix: 'Radio:',
    campaign_sim_radio_default: 'Operation status update.',
    campaign_sim_syncing: 'Syncing operation status...',
    campaign_sim_detail: 'Completes based on server progress.',
    story_skip: 'SKIP',
    story_skip_title: 'Skip to next scene',
    story_abandon: 'EXIT',
    story_abandon_title: 'Exit scenario and abandon chapter progress',
    story_tap_hint: 'Tap to continue',
    story_abandon_confirm_title: 'EXIT SCENARIO',
    story_abandon_confirm_body: 'Abandon the chapter and exit. Choices already made are kept.',
    btn_close: 'â Close',
    lo_tagline: 'Claim Mars territory and<br>build your empire',
    lo_feat1: 'Real-time pixel territory claims on the Mars map',
    lo_feat2: 'Fleet Battles Â· Sieges Â· 1:1 GP Duels',
    lo_feat3: 'Build alliances through factions and guilds',
    lo_feat4: 'Mine Â· Upgrade Â· Marketplace',
    lo_btn_start: 'ð Get Started',
    lo_btn_browse: 'Explore the globe first',
    wb_tab_active: 'ð¥ Active Events', wb_tab_recent: 'ð Recent Results', wb_tab_mine: 'ð My Bets',
    sy_sort_price_asc: 'Price: Low to High', sy_sort_price_desc: 'Price: High to Low',
    sy_sort_power_desc: 'Upgrade: Highest', sy_sort_newest_listed: 'Newest Listed',
    bv_share: 'Share',
    bv_my_victory: 'ð VICTORY!', bv_my_defeat: 'ð DEFEATED',
    bv_atk_won: 'Attackers Won', bv_def_won: 'Defenders Won', bv_draw_result: 'Draw',
    bv_stat_total_ships: 'Total Ships', bv_stat_losses: 'Losses', bv_stat_damage: 'Damage',
    bv_my_badge: 'YOU',
    bv_performance: 'Performance', bv_rating: 'Rating', bv_efficiency: 'Efficiency',
    bv_highlights: 'Battle Highlights', bv_view_report: 'ð Full Report', bv_my_stats: 'ð My Stats',
    bv_mvp: 'MVP', bv_flagship_ok: 'Flagship Survived', bv_flagship_lost: 'Flagship Destroyed',
    bv_report_loading: 'Loading reportâ¦', bv_report_error: 'Report unavailable',
    bv_stat_survived: 'Survived', bv_stat_efficiency: 'Efficiency',
    bvstat_w: 'W', bvstat_l: 'L', bvstat_d: 'D',
    bvstat_kd: 'K/D', bvstat_winrate: 'Win Rate', bvstat_streak: 'Best Streak',
    bvstat_best: 'Best Rating', bvstat_title: 'My Battle Stats',
    bvstat_total: 'Total Battles', bvstat_close: 'Close',
    daily_ops_title: 'â¡ DAILY OPS', daily_ops_subtitle: 'Reset: UTC 00:00',
    daily_ops_no_missions: 'Complete your daily missions for GP rewards',
    daily_ops_claim: 'Claim', daily_ops_claimed: 'Claimed', daily_ops_completed: 'Done',
    daily_ops_event_today: "Today's Event",
    daily_ops_loading: 'Loading missionsâ¦',
    daily_ops_all_claimed: 'All missions claimed! Come back tomorrow.',
    territory_identity_title: 'Territory Identity', territory_fr: 'Field Rating',
    territory_nickname: 'Name', territory_bio: 'Description',
    territory_edit_identity: 'â Edit Name/Bio', territory_save_identity: 'Save',
    territory_badge_pioneer: 'â Pioneer (7d)', territory_badge_settler: 'ð  Settler (30d)',
    territory_badge_veteran: 'ð Veteran (90d)', territory_badge_fortress: 'ð¡ Fortress',
    territory_defense_wins: 'Defense Wins', territory_times_hijacked: 'Times Hijacked',
    territory_hold_days: 'Hold Days', territory_hold_bonus: 'Harvest Bonus',
    territory_fr_tier_newcomer: 'Newcomer', territory_fr_tier_pioneer: 'Pioneer',
    territory_fr_tier_settler: 'Settler', territory_fr_tier_fortress: 'Fortress',
    territory_fr_tier_legend: 'Legend',
    bounty_title: 'ð° BOUNTY BOARD', bounty_post: 'Post Bounty',
    bounty_post_target: 'Target Wallet', bounty_post_amount: 'Reward GP',
    bounty_post_reason: 'Reason (optional)', bounty_post_submit: 'Post Bounty',
    bounty_no_bounties: 'No active bounties',
    bounty_reward: 'Reward', bounty_expires: 'Expires',
    bounty_on_me: 'On Me', bounty_claim_hint: 'Win a battle against the target to claim',
    bounty_cancel: 'Cancel & Refund',
    pvp_rec_title: 'ð¯ RECOMMENDED OPPONENTS',
    pvp_rec_cpi: 'CPI', pvp_rec_ships: 'Ships', pvp_rec_wins: 'Wins',
    pvp_rec_challenge: 'Challenge', pvp_rec_loading: 'Searching for opponentsâ¦',
    pvp_rec_no_opponents: 'No suitable opponents found',
    pvp_rec_cpi_diff: 'Power Diff',
    fleet_no_fleet_hint: 'No fleets â build ships in the Shipyard',
    fleet_no_ships_hint: 'No ships<br>Build in the Shipyard',
    fleet_no_combat_fleet: 'No combat-ready fleet. Build ships in the Shipyard!',
    fleet_both_no_fleet: 'Neither side has a combat-ready fleet.',
    fleet_enemy_no_fleet: 'The enemy guild has no combat-ready fleet.',
    bc_waiting: 'Waiting', bc_atk_win: 'ATK WIN', bc_def_win: 'DEF WIN',
    bc_in_progress: 'In Progress', bc_scheduled: 'Scheduled',
    bc_type_duel: 'PvP Duel', bc_type_siege: 'Siege', bc_type_hijack: 'Hijack',
    bc_type_raid: 'Raid', bc_type_event: 'Event',
    gw_auto_win_title: 'Auto Victory',
    gw_auto_win_body: 'The enemy guild has no combat-ready fleet.',
    gw_auto_win_pts: 'Win auto-victory and earn guild war points (+10 pts)',
    gw_auto_win_limit: '1 use per 24 hours',
    gw_auto_win_btn: 'ð Claim Auto Victory',
    gw_auto_win_toast: 'ð Auto Victory! +{pts} pts earned',
    gw_auto_win_cooldown: 'Auto victory already used within 24 hours',
    gw_enemy_has_fleets: 'Enemy now has fleets â fight directly',
    ob_line1: '"2067. Earth\'s resources have run out."',
    ob_line2: '"Mars is the last hope."',
    ob_line3: '"Today you take your first steps as a pioneer."',
    ob_btn_land: 'ð Land on Mars', ob_btn_skip: 'Skip',
    ob_step1_title: 'Choose Your Destiny',
    ob_step1_sub: 'What kind of pioneer will you be on Mars?',
    ob_job_change_note: 'Can be changed later (1 free change / week)',
    ob_step1_choose: 'Choose a job',
    ob_step2_title: 'Choose Your Faction',
    ob_step2_sub: 'Join one of the three powers of Mars',
    ob_step2_free_note: 'First choice free Â· 500 GP to change later',
    ob_step2_already: 'Faction already selected.',
    ob_step2_continue: 'Continue â',
    ob_step2_loading: 'Loading...',
    ob_step2_load_fail: 'Load failed â click Select Later',
    ob_step2_choose: 'Choose a faction', ob_step2_skip: 'Select Later',
    ob_confirm: 'Confirm Selection', ob_processing: 'Processing...',
    ob_faction_error: 'Faction selection failed: ',
    ob_faction_success: 'ð¡ Faction selected!',
    ob_step3_title: 'Claim Your First Territory',
    ob_step3_sub: 'Click any empty area on the map to claim it',
    ob_step3_free: 'â¨ First territory is free',
    ob_step3_tip1: 'Close this panel to see the globe',
    ob_step3_tip2: 'Click an empty area on Mars to open the claim panel',
    ob_step3_tip3: 'Press CONFIRM to claim the territory',
    ob_step3_got_it: 'ðºï¸ Got it, let\'s start!',
    ob_step3_next: 'Next',
    ob_step4_title: 'Ready!', ob_step4_sub: 'Welcome to Mars, Pioneer',
    ob_step4_mission_label: 'First Mission Today',
    ob_step4_mission_reward: 'Reward on completion: +{gp} GP',
    ob_step4_start: 'ð Start Exploring Mars!',
    ob_reward_pioneer: 'ð Pioneer',
    ob_reward_gp: '+{n} GP earned!', ob_reward_pp: '+{n} PP earned!',
    ob_reward_item: '{code} acquired!', ob_reward_title: 'Title "{name}" earned!',
    ob_starter_ship: 'ð Starter ship granted! {name} Ã 1',
    guild_donate_placeholder: 'Enter GP amount', guild_donate_btn: 'Donate',
    auth_motto_placeholder: 'Colony Mottoâ¦', auth_status_placeholder: 'Status messageâ¦', auth_vtag_placeholder: 'Tagâ¦',
    mt_rename: 'âï¸ Rename', mt_decorate: 'â¨ Decorate', mt_sell: 'ð° Sell', mt_shield: 'ð¡ï¸ Shield', mt_upgrade: 'ð§ Upgrade', mt_hijack: 'â HIJACK',
    br_hint: 'Claude reads and fixes reports', br_label_desc: 'Bug Description *', br_desc_placeholder: 'Describe the bug.\nE.g. GP not rewarded after battle',
    br_label_ss: 'Screenshot (optional)', br_ss_placeholder: 'ð¸ Click or paste screenshot (Cmd+V / Ctrl+V)', br_ss_drag: 'or drag file here', br_capturing: 'Capturing screen...', br_submit: 'Submit', br_clear_ss: 'Clear Screenshot',
    ops_board_title: 'ð Today\'s Ops Board', ops_legend_done: 'ð¢ Done', ops_legend_pending: 'âª Pending', ops_legend_urgent: 'ð´ Urgent',
    pvp_rewards_btn: 'ð Reward History', // [i18n backfill v7.172]
    pvp_declare_btn: 'â Declare Battle', pvp_tab_rec: 'ð¯ Recommended', pvp_tab_bounty: 'ð° Bounty', pvp_tab_conflict: 'ð¥ Sector Conflict',
    kb_hub_title: 'KILLBOARD & INTEL', kb_tab_board: 'KILLBOARD', kb_tab_scout: 'SCOUT',
    betrayer_mark_title: 'BETRAYER MARK', betrayer_mark_desc: 'You carry a betrayer mark. Clear your name by spending GP.', betrayer_redeem_btn: 'REDEEM',
    wb_title: 'ð¯ WAR BETTING', forge_upgrading: 'ð¨ Upgrading...',
    we_select_fleet: 'Select fleet...', we_fleet_min: 'At least 1 ship required',
    pvp_goto_tab: 'â PVP TAB â', pvp_from_tab: 'â IN PVP TAB â',
    guild_gp_donate_lbl: 'ð° GP Donate', prof_customize_title: 'âï¸ Customize Profile',
    vip_pass_title: 'ð« What is VIP Pass?',
    vip_pass_desc: 'A <b style="color:#ce93d8">time-limited premium subscription</b> purchased with PP (Planet Points).<br>â¢ â <b>Mining Speed +%</b> (varies by tier)<br>â¢ ð° <b>GP Acquisition Bonus</b><br>â¢ ð <b>Monthly Crate</b><br>â¢ ð <b>VIP Exclusive Title/Avatar</b><br>PP can be obtained by purchase or as season rewards.',
    crate_what_title: 'ð¦ What is a Crate?',
    crate_what_desc: 'A <b style="color:#ffcc02">random item box</b> purchased with GP or PP.<br>â¢ ð¯ <b>Defense Items</b> â Territory reinforcement Â· defense devices<br>â¢ â <b>Combat Items</b> â Ship upgrades Â· attack boosts<br>â¢ ð <b>Cosmetics</b> â Titles, avatars Â· territory frames<br>â¢ â¨ <b>Rare Items</b> â Elite tier at low chance<br>Opened items can be checked in inventory and sold on the market.',
    prestige_what_title: 'â­ What is Prestige?',
    prestige_what_desc: 'A system that consumes GP to accumulate <b style="color:#ffd54f">permanent ranking score</b>.<br>â¢ ðª¨ Colonist â ð¥ Pioneer â ð¥ Commander â ð¥ Vanguard â ð Sovereign<br>â¢ Higher ranks gain <b>leaderboard visibility</b> + exclusive titles Â· frames<br>â¢ Prestige points are <b style="color:#ff8a80">permanent</b> with no downgrade<br>â¢ <b>Prestige frames</b> can also be applied to territory claims',
    /* === static markup i18n (added) === */
    ref_code_ph: 'CODE...',
    prod_section: '⚙ PRODUCTION',
    upgrades_section: '🔧 UPGRADES',
    edit_label: '✏ Edit',
    campaign_quick: 'CAMPAIGN',
    campaign_quick_sub: 'STORY',
    select_your_fleet: '⚔ SELECT YOUR FLEET',
    change_image_btn: 'CHANGE IMAGE',
    save_image_btn: 'SAVE IMAGE',
    current_balance: 'CURRENT BALANCE',
    first_deposit_bonus: 'FIRST DEPOSIT BONUS',
    select_chain: 'SELECT CHAIN',
    deposit_address: 'DEPOSIT ADDRESS',
    copy_address: '📋 COPY ADDRESS',
    available_usdt: 'AVAILABLE USDT',
    withdraw_amount: 'WITHDRAW AMOUNT',
    max_btn: 'MAX',
    swap_pp_usdt_title: 'SWAP PP → USDT',
    swap_amount_pp: 'SWAP AMOUNT (PP)',
    exchange_pp_gp_title: 'EXCHANGE PP → GP',
    gp_balance: 'GP BALANCE',
    exchange_amount_pp: 'EXCHANGE AMOUNT (PP)',
    confirm_exchange: 'CONFIRM EXCHANGE',
    mg_invaders: 'Invaders',
    mg_invaders_sub: 'Shoot & Survive',
    mg_runner: 'Runner',
    mg_runner_sub: 'Run & Dodge',
    mg_digger: 'Digger',
    mg_digger_sub: 'Dig & Collect',
    close_btn: 'CLOSE',
    game_over: 'GAME OVER',
    mg_continue: 'CONTINUE',
    mg_submit_score: 'Submit Score',
    check_in_today: 'CHECK IN TODAY',
    prof_motto: 'MOTTO',
    prof_set: 'SET',
    prof_status: '💬 STATUS',
    prof_vanity_tag: '🏷️ VANITY TAG',
    prof_avatar_color: 'AVATAR COLOR',
    tos_title: 'TERMS OF SERVICE',
    privacy_title: 'PRIVACY POLICY',
    cantina_disclaimer_title: 'CANTINA GAMES DISCLAIMER',
    cantina_enter: 'I UNDERSTAND — ENTER CANTINA',
    cookie_accept: 'ACCEPT',
    footer_tos: 'Terms of Service',
    footer_privacy: 'Privacy Policy',
    faction_selection: 'FACTION SELECTION',
    faction_select_sub: '// Select your faction',
    faction_cancel: 'Cancel',
    faction_select: 'Select',
    edit_guild_title: 'EDIT GUILD',
    edit_guild_sub: 'Rename · customize emblem · update description',
    ge_preview: 'PREVIEW',
    ge_preview_hint: 'Pixel-art emblem is auto-resized to 32×32. PNG/JPG under 2MB.',
    ge_guild_name: 'GUILD NAME',
    ge_description: 'DESCRIPTION',
    ge_desc_ph: 'Guild slogan / description...',
    ge_emblem: 'EMBLEM',
    ge_emoji: 'EMOJI',
    ge_upload: 'UPLOAD',
    ge_choose_image: '📁 CHOOSE IMAGE (AUTO 32×32)',
    ge_clear: 'CLEAR',
    ge_emblem_hint: 'Bold silhouettes work best at 32×32. Transparent PNG is recommended for crisp pixel art.',
    ge_total_cost: 'TOTAL COST',
    cancel_changes: 'CANCEL',
    save_changes: 'SAVE CHANGES',
    onboarding_first_landing: 'FIRST LANDING',
    onboarding_first_landing_body: 'Start by claiming your first Mars territory.',
    onboarding_open_base: 'OPEN BASE',
    onboarding_dismiss: 'DISMISS',
    comms_label: '💬 COMMS',
    settings_legal: 'LEGAL',
    acct_tos: '📜 Terms of Service',
    acct_privacy: '🔒 Privacy Policy',
    change_password_title: 'CHANGE PASSWORD',
    current_password_ph: 'Current password',
    new_password_ph: 'New password (8+ chars)',
    confirm_password_ph: 'Confirm new password',
    join_telegram: '✈ JOIN TELEGRAM',
    agree_terms: 'I agree to the <a onclick="openTosModal();event.stopPropagation()">Terms of Service</a> and <a onclick="openPrivacyModal();event.stopPropagation()">Privacy Policy</a>',
    remember_id_pw: 'REMEMBER ID/PW',
    auto_login: 'AUTO LOGIN',
    select_image_file: 'SELECT IMAGE FILE',
    scale_label: 'SCALE',
    min_btn: 'MIN',
    link_url_label: 'LINK URL',
    link_url_ph: 'https://your-site.com',
    preview_on_mars: 'PREVIEW ON MARS',
    stamp_cancel: '✕ CANCEL',
    drag_to_position: 'DRAG TO POSITION',
    stamp_ok: '✓ OK',
    tos_body: '<h3>1. ABOUT OCCUPY MARS</h3><p>Occupy Mars is a browser-based territory strategy game set on a virtual Mars. Players claim land, mine resources, battle opponents, and trade in-game currency. The game is provided "as is" for entertainment purposes.</p><h3>2. PLANET POINTS (PP) &mdash; IN-GAME CURRENCY</h3><p>Potato Points (PP) is the primary in-game currency used within Occupy Mars. PP is <strong>not</strong> real money, legal tender, or a cryptocurrency. PP has no inherent monetary value outside the game.</p><p>PP can be earned through gameplay (mining, quests, battles) or purchased via supported payment methods. All PP purchases are final and non-refundable unless required by applicable law.</p><h3>3. USDT WITHDRAWALS</h3><p>Under certain conditions, players may convert PP to USDT and request withdrawals. Withdrawal availability is subject to:</p><ul><li>Minimum balance and verification requirements</li><li>Anti-fraud and anti-money-laundering checks</li><li>Processing times (may vary)</li><li>Network fees deducted from the withdrawal amount</li><li>The game operator’s right to suspend withdrawals for security or maintenance</li></ul><p>The exchange rate between PP and USDT is determined by the game and may change without notice.</p><h3>4. USER CONDUCT</h3><p>By using this service, you agree not to:</p><ul><li>Use bots, scripts, or automation tools</li><li>Exploit bugs or glitches (report them instead)</li><li>Harass, threaten, or impersonate other players</li><li>Attempt to manipulate the game economy</li><li>Create multiple accounts to gain unfair advantages</li><li>Engage in real-money trading of accounts or in-game assets outside official channels</li></ul><h3>5. ACCOUNT TERMINATION</h3><p>We reserve the right to suspend or terminate accounts that violate these terms, including but not limited to:</p><ul><li>Cheating, botting, or exploiting</li><li>Fraudulent deposits or chargebacks</li><li>Abusive behavior toward other players or staff</li><li>Violation of any applicable law</li></ul><p>Terminated accounts may forfeit any remaining PP balance. We will make reasonable efforts to notify you before termination, except in cases of fraud or security threats.</p><h3>6. INTELLECTUAL PROPERTY</h3><p>All game content, code, art, text, and design are the property of the Occupy Mars team. Player-uploaded images remain the property of their creators, but you grant us a license to display them in-game. You may not copy, distribute, or reverse-engineer any part of the game.</p><h3>7. LIMITATION OF LIABILITY</h3><p>The game is provided without warranties of any kind. We are not liable for:</p><ul><li>Loss of in-game currency or progress due to bugs, server issues, or maintenance</li><li>Blockchain network delays or failures</li><li>Unauthorized access to your account (please use a strong password)</li><li>Any indirect, incidental, or consequential damages</li></ul><p>Our total liability shall not exceed the amount you have paid to us in the 12 months prior to any claim.</p><h3>8. CHANGES TO TERMS</h3><p>We may update these terms at any time. Continued use of the game after changes constitutes acceptance. We will notify users of significant changes via in-game announcement.</p><h3>9. GOVERNING LAW</h3><p>These terms are governed by the laws of the jurisdiction in which the game operator is registered. Disputes shall be resolved through good-faith negotiation first.</p><h3>10. CONTACT</h3><p>For questions about these terms, contact us via the in-game support channel or at the email provided on our official website.</p><div class="legal-update">Last updated: April 9, 2026 &mdash; Version 1.0</div>',
    privacy_body: '<h3>1. DATA WE COLLECT</h3><p>When you use Occupy Mars, we may collect:</p><ul><li><strong>Account info:</strong> Email address, nickname, password (hashed &mdash; we never store plaintext)</li><li><strong>Wallet address:</strong> Your custodial game wallet address (generated at registration)</li><li><strong>Gameplay data:</strong> Territory claims, battles, transactions, quest progress, game statistics</li><li><strong>Device info:</strong> Browser type, screen size, IP address (for security and rate limiting)</li><li><strong>Usage data:</strong> Pages visited, features used, session duration</li></ul><h3>2. HOW WE USE YOUR DATA</h3><ul><li>Provide and maintain game services</li><li>Process in-game transactions and withdrawals</li><li>Prevent fraud, cheating, and abuse</li><li>Improve game performance and features</li><li>Send important account notifications (security alerts, terms changes)</li><li>Generate anonymized analytics to improve the game</li></ul><h3>3. DATA STORAGE &amp; SECURITY</h3><p>Your data is stored on secured servers with encryption at rest and in transit. Passwords are hashed using bcrypt. We implement rate limiting, input validation, and regular security audits. However, no system is 100% secure &mdash; please use a strong, unique password.</p><h3>4. THIRD-PARTY SERVICES</h3><p>We integrate with the following types of third-party services:</p><ul><li><strong>Blockchain networks:</strong> For processing USDT deposits and withdrawals (transaction data is public on-chain)</li><li><strong>Email services:</strong> For password resets and account notifications</li><li><strong>CDN/hosting:</strong> For delivering game assets</li></ul><p>We do not sell your personal data to third parties.</p><h3>5. YOUR RIGHTS</h3><p>Depending on your jurisdiction, you may have the right to:</p><ul><li><strong>Access:</strong> Request a copy of the personal data we hold about you</li><li><strong>Correction:</strong> Update inaccurate or incomplete data</li><li><strong>Deletion:</strong> Request deletion of your account and associated data</li><li><strong>Export:</strong> Receive your data in a portable format</li><li><strong>Objection:</strong> Object to certain processing of your data</li></ul><p>To exercise these rights, contact us through the in-game support channel. We will respond within 30 days.</p><h3>6. COOKIES &amp; LOCAL STORAGE</h3><p>We use browser cookies and localStorage for:</p><ul><li>Authentication (keeping you logged in)</li><li>Remembering your preferences (language, settings)</li><li>Game state caching (for faster loading)</li></ul><p>We do not use third-party tracking cookies. You can clear cookies at any time through your browser settings, but this may log you out.</p><h3>7. DATA RETENTION</h3><p>We retain your data for as long as your account is active. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law (e.g., financial transaction records).</p><h3>8. CHILDREN</h3><p>Occupy Mars is not intended for users under 18 years of age. We do not knowingly collect data from minors. If you believe a minor has created an account, please contact us.</p><h3>9. CHANGES TO THIS POLICY</h3><p>We may update this policy from time to time. We will notify users of significant changes via in-game announcement. Continued use after changes constitutes acceptance.</p><h3>10. CONTACT</h3><p>For privacy-related questions or requests, contact us via the in-game support channel or at the email provided on our official website.</p><div class="legal-update">Last updated: April 9, 2026 &mdash; Version 1.0</div>',
    cantina_disclaimer_body: 'The Cantina contains games of chance and skill.<br><strong>You may lose PP (Potato Points). Play responsibly.</strong><br><br>PP spent in games is gone &mdash; wins are not guaranteed.<br>You must be <strong>18 years or older</strong> to play.<br><br>If you feel you are developing a problem with gambling,<br>please take a break and seek help.',
    cookie_banner_text: 'We use cookies and localStorage for authentication, saving your preferences, and improving your experience.',
  },
  ko: {
    login: 'ë¡ê·¸ì¸', register: 'íìê°ì', logout: 'ë¡ê·¸ìì', account: 'ê³ì ',
    email_login: 'ì´ë©ì¼ ë¡ê·¸ì¸ / ê°ì', my_wallet: 'ë´ ì§ê°',
    wallet_cta_desc: 'ë¡ê·¸ì¸íì¬ USDTë¥¼ ìê¸íê³ ,<br>ìí ë¥¼ ì ë ¹íê³  ë³´ìì ë°ì¼ì¸ì',
    email_placeholder: 'email@example.com', password_placeholder: 'ë¹ë°ë²í¸ (6ì ì´ì)',
    nickname_placeholder: 'ëë¤ì (ì í)', referral_placeholder: 'ì¶ì² ì½ë (ì í)',
    or: 'ëë', email_wallet_note: 'ì´ë©ì¼ ê³ì ì ê²ì ì§ê°ì´ ë´ì¥ëì´ ììµëë¤.<br>DEPOSIT ë²í¼ì¼ë¡ ìê¸ ì£¼ìë¥¼ íì¸íì¸ì.',
    game_wallet: 'ê²ì ì§ê°', usdt_balance: 'USDT ìì¡', pp_balance: 'PP ìì¡',
    global_stats: 'ì ì²´ íµê³', total_pixels: 'ì´ í½ì', pixels_sold: 'íë§¤ë í½ì',
    total_volume: 'ì´ ê±°ëë', hijacks_hr: 'íì·¨/ìê°', active_users: 'íì± ì ì ',
    leaderboard: 'ë¦¬ëë³´ë', search_owner: 'ìì ì ê²ì', territory_info: 'ìí  ì ë³´',
    coords: 'ì¢í', owner: 'ìì ì', size: 'í¬ê¸°', price_paid: 'êµ¬ë§¤ ê°ê²©',
    hijack_cost: 'íì·¨ ë¹ì©', hijack_this: 'ì´ ìí  íì·¨íê¸°',
    my_alerts: 'ë´ ìë¦¼', live_feed: 'ì¤ìê° í¼ë', place_image: 'ì´ë¯¸ì§ ë°°ì¹',
    choose_file: 'ì´ë¯¸ì§ íì¼ ì í', item_shop: 'ìì´í ìì ', open_shop: 'ìì  ì´ê¸°',
    referral_program: 'ì¶ì² íë¡ê·¸ë¨', referral_desc: 'ì½ëë¥¼ ê³µì íê³  ì¶ì²ì¸ì ë¼ì´ë¸ ì»¤ë¯¸ì íëìì PPë¥¼ íëíì¸ì!',
    codex_open: 'ê²ì ê°ì´ëë¶', codex_tagline: 'ì¸ê³ê´ê³¼ ê²ì êµ¬ì¡° ìë´', profile_prefs: 'íê²½ ì¤ì ', profile_language: 'ì¸ì´', codex_prev: 'ì´ì ', codex_next: 'ë¤ì',
    ref_tiers: '1ë¨ê³: 15% Â· 2ë¨ê³: 10% Â· 3ë¨ê³: 5%',
    ref_sources: 'ê¸°ë³¸ ììµì: ìê¸ Â· ì¤ì Â· ìì  Â· ì¹¸í°ë Â· ë§ì¼ ììë£ (ê¸°í ìì¤ë ì´ì ì¤ì ì ë°ë¼ ë³ë)',
    view_dynasty: 'ð ë¤ì´ëì¤í° ë³´ê¸°', dyn_leaderboard: 'ë¦¬ëë³´ë', dyn_my_tree: 'ë´ í¸ë¦¬',
    my_ref_code: 'ë´ ì¶ì² ì½ë', enter_ref_code: 'ì¶ì² ì½ë ìë ¥',
    referrals: 'ì¶ì² ì', total_earned: 'ì´ ììµ', coming_soon: 'ì¤ë¹ ì¤',
    deposit_usdt: 'USDT ìê¸', withdraw_usdt: 'USDT ì¶ê¸', swap_pp: 'PP â USDT êµí',
    claim_territory: 'ìí  ì ë ¹', confirm_claim: 'ì ë ¹ íì¸',
    approve_deposit: 'ì¹ì¸ & ìê¸', request_withdrawal: 'ì¶ê¸ ìì²­',
    confirm_swap: 'êµí íì¸', cancel: 'ì·¨ì', copy: 'ë³µì¬', apply: 'ì ì©',
    click_mars: 'íì±ì í´ë¦­íì¬ ìí ë¥¼ ì ííì¸ì', click_stamp: 'íì±ì í´ë¦­íì¬ ë°°ì¹!',
    bug_report_label: 'ë²ê·¸', bug_report_title: 'ë²ê·¸ ë¦¬í¬í¸',
    bug_report_sub: 'ë¬´ì¨ ì¼ì´ ììëì? ì ì¶íìë©´ ê°ë°íì´ ë°ë¡ íì¸ í ìì í©ëë¤.',
    bug_report_category: 'ì¹´íê³ ë¦¬',
    bug_cat_ui: 'UI', bug_cat_gameplay: 'ê²ìíë ì´', bug_cat_payment: 'ê²°ì ',
    bug_cat_performance: 'ì±ë¥', bug_cat_other: 'ê¸°í',
    bug_report_summary: 'í ì¤ ìì½',
    bug_report_summary_ph: 'ì: íì´ì­ ë²í¼ì´ ì  ìí ìì ë°ì ìì',
    bug_report_detail: 'ë¬´ì¨ ì¼ì´ ììëì?',
    bug_report_detail_ph: 'ì¬í ì ì°¨, ê¸°ëí ëì, ì¤ì  ëìì ì ì´ì£¼ì¸ì...',
    bug_report_auto_meta: 'ìë ì²¨ë¶: íì´ì§ URL, ë¸ë¼ì°ì , ìµê·¼ ì½ì ìë¬, ì°ê²°ë ì§ê°.',
    bug_report_submit: 'ë¦¬í¬í¸ ì ì¡', bug_report_sending: 'ì ì¡ ì¤...',
    bug_report_thanks: 'ð ë¦¬í¬í¸ ì ì¡ ìë£! ê°ì¬í©ëë¤.',
    bug_report_empty: 'ë²ê·¸ ë´ì©ì ìë ¥í´ì£¼ì¸ì',
    registered: 'ê°ì ìë£!', login_success: 'ë¡ê·¸ì¸ ì±ê³µ!', wallet_connected: 'ì§ê° ì°ê²°ë¨',
    wallet_disconnected: 'ì§ê° ì°ê²° í´ì ë¨', copied: 'ì¶ì² ë§í¬ ë³µì¬ë¨!',
    stats_label: 'íµê³', live_label: 'ì¤ìê°',
    find_email: 'ìì´ë ì°¾ê¸°', forgot_password: 'ë¹ë°ë²í¸ ì°¾ê¸°',
    find_email_title: 'ìì´ë ì°¾ê¸°', reset_password_title: 'ë¹ë°ë²í¸ ì¬ì¤ì ',
    send_reset_code: 'ì¸ì¦ì½ë ë°ì¡', change_password: 'ë¹ë°ë²í¸ ë³ê²½',
    enter_nickname: 'ëë¤ìì ìë ¥íì¸ì', enter_email: 'ì´ë©ì¼ì ìë ¥íì¸ì',
    reset_code_placeholder: '6ìë¦¬ ì¸ì¦ì½ë', new_password: 'ì ë¹ë°ë²í¸', confirm_password: 'ë¹ë°ë²í¸ íì¸',
    back_to_login: 'â ë¡ê·¸ì¸ì¼ë¡ ëìê°ê¸°', search_btn: 'ê²ì',
    code_sent_to: 'ì¸ì¦ì½ë ë°ì¡ ìë£',
    tut_howto: 'ê²ì ë°©ë²',
    tut_step1: 'ì§ê°ì ì°ê²°í´ ììíì¸ì â íì± ìí ë¥¼ ì ë ¹íê³ , í¨ëë¥¼ ë§ë¤ê³ , ìº íì¸ ì¤í ë¦¬ë¥¼ ë°ë¼ê°ì¸ì.',
    tut_step2: 'CLAIMì ëë¬ íì± ì§ëìì í½ì ìí ë¥¼ êµ¬ë§¤íì¸ì. ìí ë ìí ê°ë¥í PPë¥¼ ìì°í©ëë¤.',
    tut_step3: 'BASEìì PPë¥¼ ìííê³ , ì¤ëì ìì  ë³´ëë¡ GPë¥¼ ë°ê³ , ìí ë¥¼ ìê·¸ë ì´ëíê³ , ì¡°ì ìì ë¤ì´ê°ì¸ì.',
    tut_step4: 'CANTINAìì ì ëµì ê°ííë ìì´íê³¼ ë¯¸ëê²ìì ì¦ê¸°ì¸ì.',
    tut_step5: 'ìº íì¸(ë©ì¸ ì¤í ë¦¬)ì ë°ë¼ê°ì¸ì. í¨ëë¥¼ ë§ë¤ì´ PvP ì í¬ìì ì¹ë¦¬íê³ , ì¶ì² ë§í¬ë¡ ì¹êµ¬ë¥¼ ì´ëí´ ë³´ëì¤ ë³´ìì ë°ì¼ì¸ì!',
    tut_next: 'ë¤ì', tut_skip: 'ê±´ëë°ê¸°', tut_done: 'ììíê¸°!',
    help_claim: 'ìí  ì ë ¹',
    help_claim_body: 'íì±ì ëëê·¸íì¬ í½ìì ì ííê³  USDTë¡ êµ¬ë§¤íì¸ì. ìí ìì PP(Potato Points)ë¥¼ ìíí  ì ììµëë¤. ë¤ë¥¸ íë ì´ì´ì ìí ë¥¼ íë¦¬ë¯¸ìì ë´ê³  íì´ì­í  ìë ììµëë¤!',
    help_cantina: 'ì¹¸í°ë',
    help_cantina_body: 'PvP ë°°í ìë ë! ì¹¸í°ëìì ë¤ë¥¸ íë ì´ì´ì ì¸ì°ê³ , ìì ìì ì í¬ ìì´íì êµ¬ë§¤íê³ , ë³´ìì íëíì¸ì. ì´ëë¡ ìí ë¥¼ ë°©ì´íê³  ë¬´ê¸°ë¡ ê³µê²©íì¸ì.',
    help_base: 'ë§ì´ ë² ì´ì¤',
    help_base_body: 'ë¹ì ì ì¬ë ¹ë¶ìëë¤. ìí  íí© íì¸, PP ìí, ì¸ë²¤í ë¦¬ ê´ë¦¬, ì½ì¤ë©í± ì¥ì°©, ì´ëì´ë¼ë©´ ê±°ë²ëì¤ ê¸°ë¥ì ì´ì©í  ì ììµëë¤.',
    help_harvest: 'PP ìí',
    help_harvest_body: 'ìí ë ìê°ì´ ì§ëë©´ PPë¥¼ ìì±í©ëë¤. HARVESTë¥¼ ëë¬ ìì§íì¸ì. PPë USDTë¡ ë³ííê±°ë ìì´í êµ¬ë§¤ì ì¬ì©í  ì ììµëë¤. ë ì¨ì ì¤íë§í¬ ë¶ì¤í¸ê° ìíë¥ ì ëì¬ì¤ëë¤!',
    help_governance: 'ê±°ë²ëì¤',
    help_governance_body: 'ì¹í°ìì ê°ì¥ ë§ì í½ìì ìì íë©´ ì´ëì´ ë©ëë¤! ì´ëì ì¸ì¨ ì¤ì (ì¹í° ë´ ëª¨ë  ê±°ëìì PP ììµ), ê³µì§ ê²ì, ì¹í° ì ì²´ ë²í íì±íê° ê°ë¥í©ëë¤.',
    help_referral: 'ì¶ì²ì¸ íë¡ê·¸ë¨',
    help_referral_body: 'ì¶ì² ì½ëë¥¼ ì¹êµ¬ìê² ê³µì íì¸ì. ì¹êµ¬ê° ìê¸Â·ìì  êµ¬ë§¤Â·ì¤ìÂ·ì¹¸í°ë íë ì´ë¥¼ íë©´ ì»¤ë¯¸ìì ë°ìµëë¤ â 3ë¨ê³: 1ë¨ê³ 15%, 2ë¨ê³ 10%, 3ë¨ê³ 5%.',
    help_currency: 'PP & USDT',
    help_currency_body: 'USDT: ìí  êµ¬ë§¤/íì´ì­ì ì¬ì©íë ì¤íì´ë¸ì½ì¸. ì§ê°ìì ìê¸íì¸ì.\nPP (Potato Points): ìí  ìíì¼ë¡ ì»ë ê²ì ë´ íí. PPë¥¼ USDTë¡ êµííê±°ë ìì´í/ì½ì¤ë©í± êµ¬ë§¤ì ì¬ì©íì¸ì.',
    help_weather: 'ë ì¨ ì´ë²¤í¸',
    help_weather_body: 'íì± ë ì¨ê° ê²ìì ìí¥ì ì¤ëë¤! ëª¨ëí­í: ë°©ì´â ì±êµ´â. íì íë ì´: ì±êµ´ 2ë°°, ì´ëâ. ì ì±ì°: ë³´ëì¤ PP ëë. ë¨¼ì§ ìì©ëì´: í´ë ì ë¹ì©â ê³µê²©â.',
    help_about: 'OCCUPY MARS ìê°',
    help_about_body: 'Occupy Marsë íì± ì ë¸ë¡ì²´ì¸ ìí  ê²ììëë¤!',
    help_game_crash: 'CRASH',
    help_game_crash_body: 'ë¡ì¼ì´ ë°ì¬ëê³  ë°°ì¨ì´ ì¬ë¼ê°ëë¤! ë² í í í­ë° ì ì ìºìììíì¸ì. ì¤ë ê¸°ë¤ë¦´ìë¡ ë³´ìì´ ì»¤ì§ì§ë§, ìºììì ì ì í­ë°íë©´ ì ë¶ ììµëë¤. PPë¡ ë² í.',
    help_game_mines: 'MINES',
    help_game_mines_body: '5x5 ê·¸ë¦¬ëì ë³´ìê³¼ ì§ë¢°ê° ì¨ê²¨ì ¸ ììµëë¤. ì§ë¢° ìë¥¼ ì ííì¸ì(ë§ììë¡ ë°°ì¨â). íì¼ì íëì© ì´ì´ë³´ì¸ì â ë³´ìë§ë¤ ë¹ì²¨ê¸ ì¦ê°. ì§ë¢°ë¥¼ ë°ì¼ë©´ ë! ì¸ì ë  ìºììì ê°ë¥.',
    help_game_sandstorm: 'COINFLIP',
    help_game_sandstorm_body: 'í´ëì ëì  ëì§ê¸°. HEADS ëë TAILS ì ííê³  ë² í, ë¤ì§ê¸°. ë§ì¶ë©´ 1.96ë°°. ê°ë¨íê³  ë¹ ë¥¸ 50/50 ê²ì.',
    help_game_meteorite: 'DICE',
    help_game_meteorite_body: 'ì£¼ì¬ì êµ´ë¦¬ê¸°! ëª©í ë²ìë¥¼ ì¤ì íì¸ì(ì¢ììë¡ ë°°ì¨â). ê²°ê³¼ê° ë²ì ìì ë¤ë©´ ì¹ë¦¬. ìí ë ë³´ìì ì·¨í¥ì ë§ê² ì¡°ì .',
    help_game_hilo: 'HI-LO',
    help_game_hilo_body: 'ì¹´ëê° í ì¥ ê³µê°ë©ëë¤. ë¤ì ì¹´ëê° ë ëìì§ ë®ìì§ ë§ì¶ì¸ì. ë§ì¶ ëë§ë¤ ë°°ì¨ ì¦ê°. ë§ì¶ í ì¸ì ë  ìºììì ê°ë¥, ëë ë í° ë³´ìì ìí´ ê³ì! íë¦¬ë©´ ì ë¶ ììµëë¤.',
    lore_era: 'ë¨¸ì§ìì ë¯¸ë, ê·¸ë¦¬ ë©ì§ ìì íì±ìì...',
    lore_title: 'OCCUPY MARS',
    lore_body: '<p><span class="lore-highlight">2157ë</span>. ì§êµ¬ë ì£½ì´ê°ê³  ìë¤. í´ìë©´ ìì¹ì´ ê±°ëí í´ì ëìë¤ì ì¼ì¼°ë¤. ê³µê¸° ìì²´ê° ëì´ ëìë¤. 70ìµ ìí¼ì´ ë ì´ì ê·¸ë¤ì ìíì§ ìë ì¸ê³ì ë§¤ë¬ë ¤ ìë¤.</p><p>íì§ë§ ì¸ë¥ë ì¡°ì©í ì¬ë¼ì§ê¸¸ ê±°ë¶íë¤.</p><p><span class="lore-highlight">ìë ì¤ ì´ëìí°ë¸</span> â ì ë°í ìµíì ë¯¸ì â ì´ ë¶ì íì±ì í¥í´ ìë¯¼ í¨ëë¥¼ ë°ì¬íë¤. ì°ì£¼ì ê³µíë¥¼ ê°ë¡ì§ë¥´ë 3ëê°ì ìí¹í ì¬ì  ëì, ìì¡´ìë¤ì <span class="lore-red">íì±</span>ì ì°©ë¥íë¤.</p><p>ëìì ììë¤. ë¶ì ë¨¼ì§, ì¼ì´ë¶ë ë°ë, ëìë ì ì ë¿. íì§ë§ ììì¹ ëª»í ê²ì ë°ê²¬íë¤: íì± ì§íë©´ ê¹ìì´ ë¬»í <span class="lore-cyan">í¬ê· ê´ë¬¼ ë§¤ì¥ì§</span> â ìë¡ì´ ë¬¸ëªì ê±´ì¤íê±°ë... ì°ì°ì¡°ê° ë¼ ì ìë ìì.</p><p>ì´ì  ì¸ë ¥ë¤ì´ ì§íë¹ í©ë¬´ì§ìì ì ìì ë²ì¸ë¤. <span class="lore-highlight">ì¹í° ì´ë</span>ë¤ì´ ì² ê¶ì¼ë¡ ìí ë¥¼ ì§ë°°íë¤. ì½íìë¤ì´ ëª¨ëí­íì íí ìí ë¥¼ <span class="lore-red">íì´ì­</span>íë¤. ë³´ê¸ ë¡ì¼ì´ ê·ì¤í íë¬¼ê³¼ í¨ê» ì¶ë½íê³ , ê°ì¥ ë¹ ë¥¸ ìë§ì´ ì ë¦¬íì ì°¨ì§íë¤.</p><p>ì¬ê¸°ì ë²ì ìë¤. ì ë¶ë ìë¤. êµ¬ì¡°ëë ì¤ì§ ìëë¤.<br>ì¤ì§ <span class="lore-red">íì±</span>ë§ì´ ìì ë¿. ê·¸ë¦¬ê³  ê·¸ê²ì <span class="lore-highlight">ì ë ¹</span>í  ë§í¼ ëë´í ìë¤.</p>',
    lore_tagline: 'ëì ìí . ëì ê·ì¹. ëì íì±.',
    lore_close: 'íì± ì§ì',
    // ââ BASE tab labels ââ
    base_tab_territory: 'ë´ ìí ', base_tab_sectors: 'ì¹í°', base_tab_season: 'ìì¦',
    base_tab_mining: 'â ìì ì¶í­', base_tab_quests: 'íì¤í¸', base_tab_ops: 'ìì  ì½ì',
    base_tab_shop: 'ìì ', base_tab_market: 'ë§ì¼', base_tab_items: 'ë´ ìì´í', base_tab_guild: 'ê¸¸ë', base_tab_govern: 'ê±°ë²ëì¤', shop_cat_material: 'â ì¬ë£',
    base_tab_transport: 'ìì¡', base_tab_quests_full: 'ìº íì¸/íì¤í¸',
    bcat_territory: 'ìí ', bcat_fleet: 'í¨ë ì§íë¶', bcat_economy: 'ê²½ì ', bcat_mission: 'ìë¬´', bcat_community: 'ì»¤ë®¤ëí°',
    fcmd_open_shipyard_short: 'ì¡°ì ì', fcmd_my_fleets_short: 'ë´ í¨ë', fcmd_mining_short: 'ìì ì¶í­', mining_ops_title: 'ìì ì¶í­', mining_ops_desc: 'í¨ëë¥¼ ë³´ë´ GPÂ·ì¬ë£ ìê¸ â ë íì ìì.', mining_ops_btn: 'â ì¶í­', fcmd_tactical_lab: 'ì ì ë©', fcmd_tactical_lab_short: 'ì ì  ì¤íì¤', fcmd_ace_mode_short: 'ìì´ì¤ ëª¨ë',
    fleet_status_label: 'ë´ í¨ë íí©', fleet_world_events: 'íì± ìë ì´ë²¤í¸', btn_refresh: 'â» ìë¡ê³ ì¹¨',
    hijack_no_fleet_auto_win: 'ìëë°© í¨ë ìì â ìë ì¹ë¦¬ (ì¦ì í½ì ì´ì )',
    hijack_no_fleet_label: 'í¨ë ìì â íì´ì  ë¶ê°',
    hijack_no_fleet_hint: 'BASE â FLEET í­ìì í¨ëë¥¼ ë¨¼ì  ìì±íì¸ì',
    hijack_fleet_loading: 'í¨ë ì ë³´ ë¡ë© ì¤...',
    siege_info_block: '<b style="color:var(--red);font-size:10px">âï¸ ì¹í° ê³µì±ì ì´ë?</b><br>ì¹í° ë´ ìµë ì ì ì(ê±°ë²ë)ì ìë¦¬ë¥¼ ë¹¼ìë ì ììëë¤.<br><b style="color:var(--tx2)">â  ì¹í° ì í</b> â <b style="color:var(--tx2)">â¡ ê³µì±ì  ì ì¸ (GP ìëª¨)</b> â <b style="color:var(--tx2)">â¢ ê²½ê³  ê¸°ê°</b> â <b style="color:var(--tx2)">â£ ì í¬ ê¸°ê°</b><br>ì ì ì¨ì´ ëì ìª½ì´ ê±°ë²ëë¡ ë±ê·¹í©ëë¤.<br><span style="color:var(--gold)">ð¡ ì§ì ì¡°ê±´: í´ë¹ ì¹í°ì ìµì ìí  ë³´ì  íì</span>',
    fleet_battle_info_block: '<b style="color:var(--cyan);font-size:10px">â í¨ë ì í¬ë?</b><br>ë´ í¨ëë¥¼ ì´ëê³  ë¤ë¥¸ íë ì´ì´ìê² ì í¬ë¥¼ ì ì¸íë PvP ì í¬ìëë¤.<br><b style="color:var(--tx2)">â  ì¡°ì ììì í¨ì  ê±´ì¡°</b> â <b style="color:var(--tx2)">â¡ í¨ë í¸ì±</b> â <b style="color:var(--tx2)">â¢ ì í¬ íë¸ìì ì í¬</b> â <b style="color:var(--tx2)">â£ ê²°ê³¼ íì¸</b>',
    fleet_battle_hub_btn: 'FLEET BATTLE HUB ì´ê¸°',
    pvp_ai_practice: 'AI ì°ìµì ', pvp_tournament: 'í ëë¨¼í¸', pvp_shipyard: 'ì¡°ì ì',
    inv_cat_all: 'ì ì²´', inv_cat_defense: 'ë°©ì´', inv_cat_attack: 'ê³µê²©',
    inv_cat_utility: 'ì í¸', inv_cat_boost: 'ë¶ì¤í¸', inv_cat_cosmetic: 'ì½ì¤ë©í±',
    my_territory_title: 'ë´ ìí ', login_to_view_territory: 'ë¡ê·¸ì¸íë©´ ìí ê° íìë©ëë¤',
    hijack_fleet_info_fail: 'ìë í¨ë ì ë³´ íì¸ ì¤í¨',
    // ââ ì§ì ìì¤í ââ
    job_label: 'ì§ì', job_none: 'ì´ëªì ì ííì¸ì', job_locked: 'Lv.{n} ë¬ì± í í´ê¸',
    job_choose_btn: 'ì í â¶', job_change_btn: 'ì§ì ë³ê²½',
    job_cooldown: '{t} ì´í ë³ê²½ ê°ë¥', job_free_change: 'ë¬´ë£ ë³ê²½ {n}í ë¨ì',
    job_paid_change: 'ë³ê²½ ë¹ì©: {n} GP', job_current: 'íì¬ ì§ì',
    job_modal_title: 'ì´ëªì ì ííì¸ì', job_modal_sub: 'ëì íë ì´ ì¤íì¼ì ë§ë ì§ìì ì ííì¸ì',
    job_modal_cancel: 'ëì¤ì', job_modal_confirm: 'ì í íì ',
    job_modal_free: 'ë¬´ë£ ë³ê²½ â ì´ë² ì£¼ {n}í ë¨ì',
    job_modal_paid: '{n} GP ìëª¨ (ì´ë² ì£¼ ë¬´ë£ ë³ê²½ ì¬ì©ë¨)',
    job_modal_cooldown_warn: 'ì§ì ë³ê²½ ì¿¨ë¤ì´ ì¤ â ì§ê¸ ë³ê²½ ë¶ê°',
    job_selected_toast: 'ì§ì ì í: {n}',
    // ââ ë§ì¼íë ì´ì¤ ââ
    mkt_browse: 'ðª ëë¬ë³´ê¸°', mkt_sell: 'ð° íë§¤', mkt_my_listings: 'ð ë´ ë¦¬ì¤í',
    mkt_sort_newest: 'ìµì ì', mkt_sort_cheap: 'ì ë ´íì', mkt_sort_expensive: 'ë¹ì¼ì', mkt_sort_ending: 'ë§ê°ìë°',
    mkt_loading: 'ë§ì¼ ë¡ë© ì¤...', mkt_empty: 'ë±ë¡ë ìíì´ ììµëë¤',
    mkt_recent_sales: 'ð ìµê·¼ ê±°ë', mkt_no_sales: 'ìµê·¼ ê±°ë ë´ì­ì´ ììµëë¤',
    notif_title: 'ð ìë¦¼', notif_read_all: 'ëª¨ë ì½ìì¼ë¡ íì',
    notif_loading: 'ë¡ë© ì¤...', notif_empty: 'ìë¦¼ì´ ììµëë¤',
    gp_activity_title: 'GP íë ë´ì­', gp_activity_login: 'ë¡ê·¸ì¸ í íì¸íì¸ì.', gp_activity_empty: 'GP íë ë´ì­ì´ ììµëë¤.',
    gp_send_title: 'ð¸ GP ì ì¡', gp_send_subtitle: 'ë¤ë¥¸ íë ì´ì´ìê² GP ë³´ë´ê¸°', gp_send_btn: 'ì ì¡',
    gp_send_no_recipient: 'ìì ì ì§ê° ëë ëë¤ì ìë ¥', gp_send_invalid_amount: 'ì í¨í ê¸ì¡ì ìë ¥íì¸ì',
    gp_send_amount_label: 'ê¸ì¡', gp_transfer_history: 'ì ì¡ ë´ì­', gp_transfer_empty: 'ì ì¡ ë´ì­ì´ ììµëë¤.',
    career_stats_title: 'ð ë´ ì»¤ë¦¬ì´ íµê³', cat_naval: 'í´ì  ì¹ë¦¬', cat_enhance: 'ê°í ìë', cat_ships: 'ê±´ì¡°í í¨ì ', cat_trades: 'ê±°ë',
    mkt_buy: 'êµ¬ë§¤', mkt_cancel: 'ì·¨ì', mkt_list_sell: 'íë§¤',
    mkt_buy_title: 'ìì´í êµ¬ë§¤', mkt_price: 'ê°ê²©', mkt_your_balance: 'ë´ ìì¡',
    mkt_buy_confirm: 'ì§ê¸ êµ¬ë§¤', mkt_bought: 'êµ¬ë§¤ ì±ê³µ!',
    mkt_cancel_title: 'ë¦¬ì¤í ì·¨ì', mkt_cancel_body: 'ë¦¬ì¤íì ì·¨ìíê³  ìì´íì ë°ííìê² ìµëê¹?',
    mkt_cancel_confirm: 'ë¦¬ì¤í ì·¨ì', mkt_cancelled: 'ë¦¬ì¤íì´ ì·¨ìëììµëë¤',
    mkt_list_title: 'íë§¤ ë±ë¡', mkt_list_confirm: 'íë§¤ ë±ë¡',
    mkt_fee_note: 'ë±ë¡ë¹: 2 GP Â· íë§¤ ììë£: 5%', mkt_listed: 'ë§ì¼ì ë±ë¡ëììµëë¤!', mkt_listed_territory: 'ìí ê° ë§ì¼ì ë±ë¡ëììµëë¤!',
    mkt_sellable_items: 'íë§¤ ê°ë¥ ìì´í', mkt_no_items: 'íë§¤í  ìì´íì´ ììµëë¤. ìì âë´ ìì´íìì ì½ì¤ë©í±ì ë¨¼ì  ë³ííì¸ì.',
    mkt_sellable_terr: 'ë´ ìí ', mkt_no_territories: 'ë³´ì  ìí ê° ììµëë¤.',
    mkt_no_listings: 'ë±ë¡ë ë¦¬ì¤íì´ ììµëë¤',
    // ââ AUCTION section ââ
    mkt_auction: 'ð¨ ê²½ë§¤',
    auc_none: 'ì§í ì¤ì¸ ê²½ë§¤ê° ììµëë¤', auc_ended: 'ì¢ë£ë¨', auc_current_bid: 'ìì°°ê°',
    auc_buyout: 'ì¦êµ¬', auc_bid: 'ìì°°', auc_buy_now: 'ì¦êµ¬', auc_cancel: 'ì·¨ì',
    auc_bid_title: 'ìì°°íê¸°', auc_min_bid: 'ìµì ìì°°ê°', auc_your_bid: 'ë´ ìì°°ê°',
    auc_confirm_bid: 'ìì°°íê¸°', auc_too_low: 'ìµì ìì°°ê°ë ',
    auc_bid_placed: 'ìì°° ìë£!', auc_buyout_title: 'ì¦ì êµ¬ë§¤',
    auc_buyout_confirm: 'ì¦êµ¬ê°ë¡ ìì´íì êµ¬ë§¤íìê² ìµëê¹?',
    auc_confirm_buyout: 'ì¦êµ¬íê¸°', auc_bought: 'êµ¬ë§¤ ìë£!',
    auc_cancel_title: 'ê²½ë§¤ ì·¨ì',
    auc_cancel_confirm: 'ê²½ë§¤ë¥¼ ì·¨ìíìê² ìµëê¹? (ìì°° ìë ê²½ì°ë§ ê°ë¥)',
    auc_confirm_cancel: 'ê²½ë§¤ ì·¨ì', auc_cancelled: 'ê²½ë§¤ê° ì·¨ìëììµëë¤',
    // ââ TERRITORY VISUAL section ââ
    terr_sell_btn: 'ð° íë§¤', terr_for_sale: 'ð° íë§¤ì¤', terr_auction_label: 'ð¨ ê²½ë§¤ì¤',
    // ââ RESOURCE section ââ
    res_section_title: 'ê´ë¬¼ ìì',
    res_empty: 'ììì´ ììµëë¤. ìí ë¥¼ ìííë©´ ê´ë¬¼ì´ ëë¡­ë©ëë¤!',
    res_sell: 'íë§¤',
    res_sell_title: 'ìì íë§¤',
    // ââ SEASON tab ââ
    season_no_active: 'ì§í ì¤ì¸ ìì¦ ìì',
    season_check_back: 'ë¤ì ìì¦ì ê¸°ë¤ë ¤ ì£¼ì¸ì!',
    season_activities_placeholder: 'ìì¦ì´ ììëë©´ ì´ê³³ì íëì´ íìë©ëë¤.',
    season_how_to_earn: 'ì ì íë ë°©ë²',
    season_rewards_title: 'ìì¦ ë³´ì',
    season_reward_1st: '<b>ë¶ë¬¸ë³ 1ì</b>: GP + XP + ìì´í + ì¹­í¸',
    season_reward_top3: '<b>ìì 3ì</b>: GP + ìì´í',
    season_reward_top10: '<b>ìì 10ì</b>: GP',
    season_reward_overall: 'ì¢í© 1ììê²ë í¬ê· <span style="color:var(--gold)">PP</span>ê¹ì§!',
    season_reward_multi: '<b>ì¬ë¬ ë¶ë¬¸</b>ìì ëìì ë³´ìì ë°ì ì ìì´ì!',
    season_rewards_blurb: 'ð¥ <b>ë¶ë¬¸ë³ 1ì</b>: GP + XP + ìì´í + ì¹­í¸<br>ð¥ <b>ìì 3ì</b>: GP + ìì´í<br>ð¥ <b>ìì 10ì</b>: GP<br>ð ì¢í© 1ììê²ë í¬ê· <span style="color:var(--gold)">PP</span>ê¹ì§!<br>â¡ <b>ì¬ë¬ ë¶ë¬¸</b>ìì ëìì ë³´ìì ë°ì ì ìì´ì!',
    season_my_rank: 'ë´ ìì¦ ìì',
    season_pts_suffix: 'ì ',
    season_leaderboard: 'ìì¦ ë¦¬ëë³´ë',
    season_refresh: 'â» ìë¡ê³ ì¹¨',
    season_loading: 'ë¶ë¬ì¤ë ì¤...',
    season_no_scores: 'ìì§ ìì¦ ê¸°ë¡ì´ ììµëë¤',
    season_your_rewards: 'ð íë ë³´ì',
    season_pass_tip: 'íë ì´íë©´ XP íë (í´ë ì, ì±êµ´, ì¹¨ê³µ, íì¬, íì¤í¸). í°ì´ë¥¼ ì¬ë ¤ ë³´ìì ë°ì¼ì¸ì! íë¦¬ë¯¸ì í¨ì¤ë ë³´ì 2ë°°!',
    season_pass_buy_title: 'íë¦¬ë¯¸ì í¨ì¤',
    season_pass_buy_body: 'ì´ë² ìì¦ íë¦¬ë¯¸ì ë³´ì í¸ëì ì ê¸ í´ì í©ëë¤. ëª¨ë  í°ì´ìì 2ë°° ë³´ì!',
    season_pass_cost_label: 'ë¹ì©',
    season_pass_balance_label: 'ë³´ì  GP',
    season_pass_buy_confirm: 'êµ¬ë§¤íê¸°',
    season_categories_title: 'ì´ë² ìì¦ ë­í¹ ë¶ë¬¸',
    season_default_desc: 'ë¦¬ëë³´ë ìµììë¥¼ ë¸ë¦¬ì¸ì!',
    season_ending_soon: 'ìì¦ì´ ê³§ ì¢ë£ë©ëë¤!',
    season_ended: 'ì¢ë£ë¨',
    season_days_remaining: '{d}ì¼ {h}ìê° ë¨ì',
    season_rank_suffix: 'ìì',
    season_claim_btn: 'ìë ¹',
    season_claim_success: '{amount} {type} ìë ¹ ìë£!',
    season_claim_failed: 'ìë ¹ì ì¤í¨íìµëë¤',
    season_theme_volcanic: 'íì° ì¬ëª',
    season_theme_ice_age: 'ë¹íê¸°',
    season_theme_solar_storm: 'íì í­í',
    season_theme_dust_epoch: 'ë¨¼ì§ ìë',
    season_theme_volcanic_desc: 'íì° íëì´ íì± ì ì­ì ë¤ë®ìµëë¤. ì±êµ´ëì ì¦ê°íì§ë§ ì¤ëë ì½í´ì ¸ì!',
    season_theme_ice_age_desc: 'ì¼ì´ë¶ì í°ëë¼ê° íì°ë©ëë¤. ì¶ìë¡ ì±êµ´ì ëë ¤ì§ì§ë§ ë°©ì´ë ¥ì ê°í´ì§ëë¤.',
    season_theme_solar_storm_desc: 'íì ë³µì¬ê° íë©´ì ë®ì¹©ëë¤. ì±êµ´ì ìµëì¹, ì¤ëë ë¹ ë¥´ê² ë¶ê´´!',
    season_theme_dust_epoch_desc: 'ê±°ëí ë¨¼ì§í­íì´ ëª°ìì¹©ëë¤. ìì¼ë ëë¹ ì§ì§ë§ ì ì±ì´ ëë¼ìì ê°ì ¸ë¤ ì¤ëë¤.',
    // ââ Season categories ââ
    season_cat_overall: 'ì¢í© ì±í¼ì¸', season_cat_overall_d: 'ëª¨ë  íëìì ìµê³  ì´ì ì íëíì¸ì',
    season_cat_territory: 'ìí ì ì', season_cat_territory_d: 'íì±ìì ê°ì¥ ë§ì í½ìì ì ë ¹íì¸ì',
    season_cat_mining: 'ì±êµ´ ë¬ì¸', season_cat_mining_d: 'ìí ìì ììì ê°ì¥ ë§ì´ ìííì¸ì',
    season_cat_combat: 'ì í¬ ì ì¤', season_cat_combat_d: 'ë¤ë¥¸ íë ì´ì´ìì íì·¨ì ìì ê°ì¥ ë§ì´ ì´ê¸°ì¸ì',
    season_cat_defender: 'ë¶êµ´ì í¬ì¬', season_cat_defender_d: 'ìí ì ëí ê³µê²©ì ê°ì¥ ë§ì´ ë²í¨ë´ì¸ì',
    season_cat_explorer: 'ìë¦¬í¸ ííê°', season_cat_explorer_d: 'ì§êµ¬ë³¸ìì POI ë§ì»¤ë¥¼ ê°ì¥ ë§ì´ ë°ê²¬íì¸ì',
    season_cat_active: 'ìµë¤ íë', season_cat_active_d: 'ê°ì¥ ë§ì´ í´ë¦­íê³  í­íì¸ì â ê·¸ë¥ íë ì´!',
    season_cat_shopper: 'ìì´í ë§ì¤í°', season_cat_shopper_d: 'ìì ìì ìì´íì ê°ì¥ ë§ì´ êµ¬ë§¤íê³  ì¬ì©íì¸ì',
    season_cat_quester: 'íì¤í¸ ìì', season_cat_quester_d: 'ë°ì¼ë¦¬ ë¯¸ìì ê°ì¥ ë§ì´ ìë£íì¸ì',
    season_cat_big_spender: 'í° ì', season_cat_big_spender_d: 'ìì´í, íì·¨, ìê·¸ë ì´ëì GPë¥¼ ê°ì¥ ë§ì´ ì°ì¸ì',
    season_cat_investor: 'PP í¬ìì', season_cat_investor_d: 'íë¦¬ë¯¸ì ê¸°ë¥ì PPë¥¼ ê°ì¥ ë§ì´ í¬ìíì¸ì',
    season_cat_fortifier: 'ìì ê±´ì¤ì', season_cat_fortifier_d: 'ìí ì ë°©í¨ë¥¼ ê°ì¥ ë§ì´ ì¤ì¹íì¸ì',
    season_cat_wanderer: 'ì¹í° ë°©ëì', season_cat_wanderer_d: 'ê°ì¥ ë§ì ë¤ë¥¸ ì¹í°ë¥¼ íííê³  ë°©ë¬¸íì¸ì',
    season_cat_dedicated: 'ìµê³  ì±ì¤', season_cat_dedicated_d: 'ë§¤ì¼ ë¡ê·¸ì¸íì¸ì â ê¾¸ì¤í¨ì´ íµì¬!',
    season_cat_fashionista: 'íì± í¨ìëì¤í', season_cat_fashionista_d: 'ìí ì ì½ì¤ë©í± ìì´íì ê°ì¥ ë§ì´ ì¥ì°©íì¸ì',
    season_cat_gambler: 'ì¹¸í°ë ë¨ê³¨', season_cat_gambler_d: 'ì¹¸í°ëìì ë¯¸ëê²ìì ê°ì¥ ë§ì´ íë ì´íì¸ì',
    season_cat_team_player: 'í íë ì´ì´', season_cat_team_player_d: 'ê¸¸ë íëì ê°ì¥ ë§ì´ ê¸°ì¬íì¸ì',
    season_cat_recruiter: 'ìµê³  ëª¨ì§ê´', season_cat_recruiter_d: 'ì¶ì²ì¼ë¡ ìë¡ì´ íë ì´ì´ë¥¼ ê°ì¥ ë§ì´ ì´ëíì¸ì',
    season_cat_social: 'ìì ëë¹', season_cat_social_d: 'ë¤ë¥¸ íë ì´ì´ìê² ì±í ë©ìì§ë¥¼ ê°ì¥ ë§ì´ ë³´ë´ì¸ì',
    season_cat_earner: 'GP ì¬ë²', season_cat_earner_d: 'ëª¨ë  ìì¤ìì í©ì° GPë¥¼ ê°ì¥ ë§ì´ íëíì¸ì',
    season_cat_whale: 'PP ê³ ë', season_cat_whale_d: 'ì±êµ´ê³¼ ë°ê²¬ì¼ë¡ PPë¥¼ ê°ì¥ ë§ì´ íëíì¸ì',
    season_cat_loser: 'í¬ê¸°íì§ ë§', season_cat_loser_d: 'íì·¨ë¡ í½ìì ììëì? ê³ì ë°ê²©íì¸ì!',
    season_cat_streaker: 'ì°ì ê¸°ë¡ì', season_cat_streaker_d: 'ìµì¥ ì¼ì¼ ë¡ê·¸ì¸ ì°ì ê¸°ë¡ì ì ì§íì¸ì',
    season_cat_astronaut: 'ë¡ì¼ ë¼ì´ë', season_cat_astronaut_d: 'ë³´ê¸ ë¡ì¼ í¬íìì ì ë¦¬íì ê°ì¥ ë§ì´ íëíì¸ì',
    season_cat_weatherman: 'í­í ì¶ì ì', season_cat_weatherman_d: 'íì± ë ì¨ ìë³´ë¥¼ ìì£¼ íì¸íì¸ì',
    season_cat_namer: 'ì´ë¦ ì¥ì¸', season_cat_namer_d: 'ìí  ì´ë¦ì ê°ì¥ ë§ì´ ë³ê²½íì¸ì',
    season_cat_influencer: 'íì± ì¸íë£¨ì¸ì', season_cat_influencer_d: 'ì ì ê³¼ ìí ë¥¼ ê°ì¥ ë§ì´ ê³µì íì¸ì',
    // ââ QUESTS tab ââ
    quests_loading: 'íì¤í¸ë¥¼ ë¶ë¬ì¤ë ì¤...',
    achievements_title: 'ìì ', achievements_loading: 'ìì  ë¡ë© ì¤...',
    news_title: 'íì± ë´ì¤',
    lottery_title: 'GP ë³µê¶', lottery_disabled: 'ë³µê¶ ë¹íì±í', lottery_round: 'ë¼ì´ë', lottery_ends: 'ì¢ë£ê¹ì§', lottery_recent_winners: 'ìµê·¼ ë¹ì²¨ì',
    staking_title: 'GP ì¤íì´í¹', staking_stake_btn: 'ð GP ì¤íì´í¬', staking_confirm_title: 'GP ì¤íì´í¹', staking_confirm_btn: 'ì¤íì´í¬', staking_withdraw_title: 'ì¤íì´í¬ ì¸ì¶', staking_withdraw_btn: 'ì¸ì¶',
    burn_title: 'GP ìê°',
    weekly_title: 'ì£¼ê° ì±ë¦°ì§',
    shield_title: 'ìí  ë³´í¸ë§', shield_activate_btn: 'ë³´í¸ë§ íì±í',
    bounty_title: 'íìê¸ ê²ìí', bounty_post_btn: '+ íìê¸ ê²ì', bounty_tab_active: 'íì±', bounty_tab_mine: 'ë´ íìê¸', bounty_tab_onme: 'ëìê²', bounty_modal_title: 'íìê¸ ê²ì', bounty_modal_sub: 'ìí ë¥¼ íì·¨íë ì²« ë²ì§¸ íë ì´ì´ìê² ë³´ì', bounty_target_label: 'ëì ì§ê°/ëë¤ì', bounty_amount_label: 'GP ë³´ì', bounty_msg_label: 'ëë° ë©ìì§', bounty_post_submit: 'ð¯ íìê¸ ê²ì',
    upgrades_title: 'ìí  ê°í', upgrades_upgrade_btn: 'ìí  ê°í',
    monuments_title: 'ë´ ê¸°ëë¹', monument_place_title: 'ê¸°ëë¹ ì¤ì¹', monument_place_btn: 'ê¸°ëë¹ ì¤ì¹', monument_territory: 'ìí ', monument_type: 'ì í', monument_name_label: 'ê¸°ëë¹ ì´ë¦', monument_inscription: 'ë¹ë¬¸', monument_cost: 'ë¹ì©',
    base_craft_btn: 'âï¸ ì ì', craft_cat_all: 'ì ì²´', craft_cat_general: 'ì¼ë°', craft_cat_elite: 'ê³ ê¸', craft_cat_seasonal: 'ìì¦', craft_cat_event: 'ì´ë²¤í¸', craft_btn: 'âï¸ ì ì', craft_history_btn: 'ð ì ì ê¸°ë¡', craft_no_recipes: 'ë ìí¼ ìì', craft_load_fail: 'ë ìí¼ ë¡ë© ì¤í¨', craft_no_history: 'ì ì ê¸°ë¡ ìì', craft_success: 'ì ì ì±ê³µ!', craft_fail: 'ì ì ì¤í¨', craft_refund_partial: 'GP ë¶ë¶ íê¸', craft_confirm_title: 'ì ì íì¸', craft_missing_ingredients: 'ì¬ë£ ë¶ì¡±',
    contest_title: 'í½ì ìí¸ ì½íì¤í¸', contest_none: 'ì§í ì¤ì¸ ì½íì¤í¸ ìì. ê³§ ëìì¤ì¸ì!', contest_view_btn: 'ð ì°¸ê°ì ë³´ê¸°', contest_submit_btn: 'âï¸ ì ì¶', contest_vote_btn: 'ð³ï¸ í¬í', contest_title_prompt: 'ìí ì ëª©:', contest_image_prompt: 'ì´ë¯¸ì§ URL (ì í):', contest_desc_prompt: 'ê°ë¨í ì¤ëª (ì í):',
    rental_title: 'ìí  ìë', rental_tab_browse: 'ëë¬ë³´ê¸°', rental_tab_my: 'ë´ ìë', rental_list_btn: '+ ìí  ë±ë¡', rental_rent_btn: 'ðï¸ ìëíê¸°', rental_cancel_btn: 'ë±ë¡ ì·¨ì', rental_no_listings: 'ìë ê°ë¥í ìí  ìì', rental_no_my: 'ìë íë ìì', rental_no_territories: 'ë±ë¡í  ìí  ìì', rental_cancelled: 'ë±ë¡ ì·¨ìë¨', rental_gp_prompt: 'ê¸°ê°ë¹ GP:',
    duel_title: 'GP ê²°í¬', duel_challenge_btn: 'âï¸ ëì ', duel_tab_pending: 'ë°ì ëì ', duel_tab_my: 'ë´ ê²°í¬', duel_tab_recent: 'ë¦¬ëë³´ë', duel_modal_title: 'ê²°í¬ ëì ', duel_modal_sub: 'ì¹ìê° í ê°ì ¸ê° (5% ììë£ ì°¨ê°)', duel_target_label: 'ìë ì§ê°/ëë¤ì', duel_wager_label: 'ë² í ê¸ì¡ (GP)', duel_challenge_submit: 'âï¸ ëì ì¥ ë³´ë´ê¸°', duel_accept_btn: 'âï¸ ìë½', duel_decline_btn: 'â ê±°ì ', duel_cancel_btn: 'ì·¨ì', duel_no_pending: 'ë°ì ëì  ìì', duel_no_history: 'ê²°í¬ ê¸°ë¡ ìì', duel_no_recent: 'ìµê·¼ ê²°í¬ ìì', duel_accept_confirm: 'ëì ì ìë½íê³  GPë¥¼ ë² ííìê² ìµëê¹?', duel_decline_confirm: 'ì´ ê²°í¬ ëì ì ê±°ì íìê² ìµëê¹?', duel_cancelled_refund: 'ê²°í¬ ì·¨ì. GP íê¸ë¨.', duel_challenge_sent: 'âï¸ ëì ì¥ ì ì¡! ìëë°©ì´ 30ë¶ ë´ì ìë½í´ì¼ í©ëë¤.', duel_enter_target: 'ìë ì§ê° ëë ëë¤ìì ìë ¥íì¸ì', duel_enter_wager: 'ì í¨í ë² í ê¸ì¡ì ìë ¥íì¸ì',
    alliance_title: 'ëë§¹', alliance_members: 'ë©¤ë²', alliance_treasury: 'ê¸ê³ ', alliance_defense: 'ë°©ì´ ë³´ëì¤', alliance_join_btn: 'ê°ì', alliance_join_confirm: 'ëë§¹ì ê°ìíìê² ìµëê¹?', alliance_leave_btn: 'ðª íí´', alliance_leave_title: 'ëë§¹ íí´?', alliance_leave_confirm: 'ëë§¹ìì ì ê±°ë©ëë¤.', alliance_deposit_btn: 'ð° ìê¸', alliance_withdraw_btn: 'ð¤ ì¶ê¸', alliance_deposit_prompt: 'ìê¸í  GP ê¸ì¡:', alliance_withdraw_prompt: 'ê¸ê³ ìì ì¶ê¸ (ììë£ ì ì©):', alliance_withdraw_note_prompt: 'ë©ëª¨ (ì í):', alliance_create_title: 'ëë§¹ ì°½ì¤', alliance_create_btn: 'ð¡ï¸ ëë§¹ ì°½ì¤', alliance_browse_title: 'ëë§¹ ëª©ë¡', alliance_browse_hint: 'ê²ìíê±°ë ì¤í¬ë¡¤íì¬ ëë§¹ì ì°¾ì¼ì¸ì',
    base_lucky_btn: 'ð¦ í¬ë ì´í¸', lucky_box_open_btn: 'ð ì´ê¸°', lucky_box_recent_title: 'ð ìµê·¼ ì¤í', lucky_box_my_history: 'ð ë´ ê¸°ë¡', lucky_box_confirm_title: 'í¬ë ì´í¸ ì¤í?',
    base_vip_btn: 'ð« VIP', vip_buy_btn: 'ð« VIP êµ¬ë§¤', vip_status_active: 'VIP íì±', vip_expires: 'ë§ë£', vip_purchase_title: 'VIP í¨ì¤ êµ¬ë§¤?', vip_confirm: 'VIP êµ¬ë§¤',
    connect_wallet: 'ì§ê°ì ë¨¼ì  ì°ê²°íì¸ì', connect_wallet_first: 'ì§ê°ì ë¨¼ì  ì°ê²°íì¸ì', err_connect_wallet: 'ì§ê°ì ë¨¼ì  ì°ê²°íì¸ì', err_network: 'ë¤í¸ìí¬ ì¤ë¥. ë¤ì ìëí´ ì£¼ì¸ì.',
    use_shipyard: 'ì¡°ì ììì í¨ì ì ê±´ì¡°íì¸ì', use_fleet_cmd: 'í¨ë ì§íë¶ë¥¼ ì¬ì©íì¸ì', gov_battle_use_fleet: 'PVPë í¨ë ìì¤í + Hijackìì ì§íë©ëë¤.', gov_battle_use_fleet_hint: 'í¨ë í­ìì í¨ì ì ê±´ì¡°íê³ , ìí  íì·¨ë HIJACK ë²í¼ì ì¬ì©íì¸ì.',
    duel_declined_msg: 'ê²°í¬ë¥¼ ê±°ì íìµëë¤.',
    expedition_title: 'ìì ë', expedition_returns: 'ê·í', expedition_cancel_btn: 'ì·¨ì', expedition_launch_btn: 'ð ìì  ì¶ë°', expedition_history_btn: 'ð ìì  ê¸°ë¡', expedition_select_claim: 'ìí  ë° ì í ì í', expedition_launch_confirm: 'ìì  ì¶ë°?', expedition_cancel_confirm: 'ìì  ì·¨ì?',
    branding_title: 'ìí  ë¸ëë©', branding_select_territory: 'ë¸ëë©í  ìí  ì í:', branding_name_label: 'ìí  ì´ë¦', branding_tagline_label: 'íê·¸ë¼ì¸', branding_color_label: 'íë§ ìì', branding_set_btn: 'ì¤ì ', branding_set_name_title: 'ìí  ì´ë¦ ì¤ì ?', branding_set_tag_title: 'íê·¸ë¼ì¸ ì¤ì ?', branding_set_color_title: 'íë§ ìì ì¤ì ?',
    spells_title: 'ìí  ì£¼ë¬¸', spells_select_target: 'ëì ìí  (í´ë ì ë²í¸ ìë ¥):', spells_active_label: 'íì± ì£¼ë¬¸:', spells_history_btn: 'ð ì£¼ë¬¸ ê¸°ë¡', spells_cast_confirm: 'ì£¼ë¬¸ ìì ?',
    tiers_title: 'ìí  í°ì´', tiers_desc: 'ìí ë¥¼ ìê·¸ë ì´ëíì¬ ì±êµ´ ë° í½ì ì©ë ë³´ëì¤ë¥¼ ìêµ¬ì ì¼ë¡ ë°ì¼ì¸ì.', tiers_my_label: 'ë´ ìí ', tiers_table_label: 'í°ì´ íí', tiers_upgrade_btn: 'â¬ ìê·¸ë ì´ë', tiers_none: 'í°ì´ê° ì§ì ë ìí ê° ììµëë¤.', tiers_upgrade_confirm: 'ìí  í°ì´ ìê·¸ë ì´ë?',
    tournament_title: 'í ëë¨¼í¸', tournament_none: 'íì¬ ì´ë¦° í ëë¨¼í¸ ìì', tournament_join_btn: 'ì°¸ê°íê¸°', tournament_join_confirm: 'í ëë¨¼í¸ ì°¸ê°?', tournament_my_btn: 'ð ë´ í ëë¨¼í¸',
    broadcast_title: 'GP ë°©ì¡', broadcast_buy_btn: 'ð¢ ë°©ì¡ êµ¬ë§¤', broadcast_modal_title: 'ð¢ ë°©ì¡ ë©ìì§', broadcast_modal_desc: 'ì íí ìê° ëì ëª¨ë  íë ì´ì´ìê² ë©ìì§ê° ë¸ì¶ë©ëë¤.', broadcast_duration_label: 'ê¸°ê°:', broadcast_submit_btn: 'ð¢ ë°©ì¡íê¸°', broadcast_confirm_title: 'ë°©ì¡ êµ¬ë§¤?', broadcast_none: 'íì¬ íì± ë°©ì¡ì´ ììµëë¤.',
    raffle_title: 'GP ëí', raffle_none: 'íì¬ ì´ë¦° ëíì´ ììµëë¤.', raffle_my_btn: 'ðï¸ ë´ í°ì¼', raffle_buy_btn: 'ðï¸ êµ¬ë§¤', raffle_tickets_label: 'í°ì¼ ì:', raffle_buy_confirm: 'ëí í°ì¼ êµ¬ë§¤?',
    wager_title: 'GP ìì¸¡ ë² í', wager_none: 'íì¬ íì± ë² í íì´ ììµëë¤.', wager_my_btn: 'ð¯ ë´ ë² í', wager_bet_btn: 'ð¯ ë² í', wager_target_label: 'ë² í ëì (ì§ê°/ëë¤ì):', wager_amount_label: 'ê¸ì¡:', wager_confirm: 'ë² í íì¸?',
    tevt_title: 'ìí  ì´ë²¤í¸', tevt_desc: 'GPë¥¼ ì¬ì©í´ ìí ì ìê° ì í ë¶ì¤í¸ë¥¼ íì±ííì¸ì.', tevt_select_label: 'í´ë ì ì í:', tevt_load_btn: 'â¡ ì´ë²¤í¸ ë¡ë', tevt_active_label: 'íì± ì´ë²¤í¸', tevt_none: 'íì± ì´ë²¤í¸ ìì.', tevt_activate_confirm: 'ìí  ì´ë²¤í¸ íì±í?',
    prestige_btn: 'â­ íë ì¤í°ì§', prestige_buy_btn: 'â­ íë ì¤í°ì§ í¬ì¸í¸ êµ¬ë§¤', prestige_buy_confirm: 'íë ì¤í°ì§ í¬ì¸í¸ êµ¬ë§¤?', prestige_lb_title: 'ð íë ì¤í°ì§ ìì', prestige_lb_none: 'íë ì¤í°ì§ íë ì´ì´ ìì.',
    beacon_title: 'ë§µ ë¹ì½', beacon_desc: 'ë§µ ìì ë¤ë¥¸ íë ì´ì´ìê² ë³´ì´ë ë¹ì½ì ì¤ì¹íì¸ì.', beacon_icon_label: 'ìì´ì½', beacon_msg_label: 'ë©ìì§ (ì í)', beacon_x_label: 'X ì¢í', beacon_y_label: 'Y ì¢í', beacon_use_plot: 'ð íì¬ íë¡¯', beacon_place_btn: 'ð¡ ë¹ì½ ì¤ì¹', beacon_active_label: 'íì± ë¹ì½', beacon_none: 'íì± ë¹ì½ ìì.', beacon_place_confirm: 'ë§µ ë¹ì½ ì¤ì¹?', beacon_no_plot: 'ë¨¼ì  ë§µìì íë¡¯ì ì ííì¸ì', beacon_coords_required: 'ì¢íë¥¼ ìë ¥íì¸ì',
    donation_title: 'ì½ë¡ë íë', donation_amount_label: 'ê¸ì¡ (GP)', donation_msg_label: 'ë©ìì§ (ì í)', donation_donate_btn: 'ðï¸ ê¸°ë¶íê¸°', donation_none: 'ìì§ ê¸°ë¶ ìì.', donation_top_btn: 'ð ìµê³  ê¸°ë¶ì', donation_top_title: 'ìµê³  ê¸°ë¶ì', donation_confirm: 'ì½ë¡ë íëì ê¸°ë¶?', donation_min_hint: 'ê¸ì¡ì ìë ¥íì¸ì',
    poll_title: 'ì»¤ë®¤ëí° í¬í', poll_create_btn: '+ í¬í', poll_create_title: 'í¬í ë§ë¤ê¸°', poll_question_label: 'ì§ë¬¸', poll_options_label: 'ì íì§', poll_add_option: '+ ì íì§ ì¶ê°', poll_duration_label: 'ê¸°ê°(h):', poll_publish_btn: 'ð ê²ì', poll_none: 'íì¬ ì§í ì¤ì¸ í¬íê° ììµëë¤.', poll_publish_confirm: 'í¬í ê²ì?', poll_question_required: 'ì§ë¬¸ì ìë ¥íì¸ì', poll_min_options_hint: 'ì íì§ 2ê° ì´ì íì',
    status_label: 'ð¬ ìí ë©ìì§', status_set_btn: 'ì¤ì ', status_none: 'íì± ìí ìì', status_required: 'ìí ë©ìì§ë¥¼ ìë ¥íì¸ì', status_set_confirm: 'ìí ë©ìì§ ì¤ì ?',
    vtag_label: 'ð·ï¸ ë°°ëí° íê·¸', vtag_set_btn: 'ì¤ì ', vtag_clear_btn: 'â', vtag_none: 'ë°°ëí° íê·¸ ìì', vtag_required: 'íê·¸ë¥¼ ìë ¥íì¸ì', vtag_set_confirm: 'ë°°ëí° íê·¸ ì¤ì ?', vtag_clear_confirm: 'ë°°ëí° íê·¸ ì­ì ?', vtag_free: 'ë¬´ë£', vtag_set_success: 'ð·ï¸ ë°°ëí° íê·¸ ì¤ì !', vtag_cleared: 'íê·¸ ì­ì ë¨', vtag_cost_hint: 'ì²« íê·¸: {first} GP Â· ë³ê²½: {change} GP', vtag_disabled: 'ë°°ëí° íê·¸ ë¹íì±íë¨',
    tribute_label: 'ê³µë¬¼', tribute_btn: 'ðª ê³µë¬¼', tribute_modal_title: 'ìí  ê³µë¬¼', tribute_modal_desc: 'ì´ ìí  ìì ììê² GP ê³µë¬¼ì ë³´ëëë¤', tribute_amount_label: 'ê¸ì¡ (GP)', tribute_msg_label: 'ë©ìì§ (ì í)', tribute_send_btn: 'ðª ê³µë¬¼ ë³´ë´ê¸°', tribute_confirm: 'GP ê³µë¬¼ì ë³´ë´ìê² ìµëê¹?', tribute_sent: 'ðª ê³µë¬¼ ì ì¡!', tribute_amount_required: 'ì í¨í GP ê¸ì¡ì ìë ¥íì¸ì',
    graffiti_label: 'ëì', graffiti_btn: 'âï¸ ëì', graffiti_modal_title: 'ëì ë¶ì¬', graffiti_modal_desc: 'ì´ ìí ì ëìë¥¼ ë¨ê¹ëë¤', graffiti_text_label: 'íì¤í¸/ì´ëª¨ì§ (ìµë 30)', graffiti_spray_btn: 'âï¸ ë¶ì¬', graffiti_confirm: 'ëìë¥¼ ë¨ê¸°ìê² ìµëê¹?', graffiti_placed: 'âï¸ ëì ìë£!', graffiti_text_required: 'íì¤í¸ë¥¼ ìë ¥íì¸ì',
    banner_label: 'ì¹ë¦¬ ê¹ë°', banner_btn: 'ð© ê¹ë° ê½ê¸°', banner_modal_title: 'ì¹ë¦¬ ê¹ë° ê½ê¸°', banner_modal_desc: 'ìí ì ì¹ë¦¬ ê¹ë°ì ê½ìµëë¤', banner_emoji_label: 'ê¹ë° ì´ëª¨ì§', banner_msg_label: 'ì í¬ êµ¬í¸ (ì í)', banner_plant_btn: 'ð© ê½ê¸°', banner_confirm: 'ì¹ë¦¬ ê¹ë° ê½ê¸°?', banner_planted: 'ð© ê¹ë° ê½í!',
    rating_your_label: 'ë´ íì ', rating_confirm: 'ìí  íì ?', rating_submitted: 'â­ íì  ì ì¶!',
    highlight_btn: 'â¨ íì´ë¼ì´í¸', highlight_modal_title: 'ìí  íì´ë¼ì´í¸', highlight_modal_desc: 'ì§ëìì ìí ë¥¼ ë¹ëê² íì¸ì', highlight_color_label: 'ê¸ë¡ì° ìì', highlight_activate_btn: 'â¨ íì±í', highlight_confirm: 'ìí  íì´ë¼ì´í¸?', highlight_activated: 'â¨ ìí  íì´ë¼ì´í¸ ìë£!', highlight_active_label: 'íì´ë¼ì´í¸ ì¤',
    tdesc_title: 'ìí  ì¤ëª', tdesc_desc: 'ë´ ìí ì ì¤ëªì ì¶ê°íì¸ì. ëª¨ë  íë ì´ì´ìê² ë³´ìëë¤.', tdesc_claim_label: 'í´ë ì #', tdesc_use_claim: 'ð ë´ ê²', tdesc_current_label: 'íì¬ ì¤ëª', tdesc_text_label: 'ì¤ëª', tdesc_save_btn: 'ð ì¤ëª ì ì¥', tdesc_my_label: 'ë´ ì¤ëª ëª©ë¡', tdesc_none: 'ìì§ ì¤ëª ìì.', tdesc_save_confirm: 'ìí  ì¤ëª ì ì¥?', tdesc_required: 'ì¤ëªì ìë ¥íì¸ì', tdesc_claim_required: 'í´ë ì ë²í¸ë¥¼ ìë ¥íì¸ì', tdesc_no_claim: 'ë¨¼ì  ìí ë¥¼ ì ííì¸ì', tdesc_free: 'ë¬´ë£', tdesc_saved: 'â ì¤ëª ì ì¥ ìë£!', tdesc_free_hint: 'ì²« ì¤ëªì ë¬´ë£ìëë¤. ìì  ì {cost} GP.',
    sponsor_label: 'íìì', sponsor_btn: 'ðï¸ íìíê¸°', sponsor_modal_title: 'ìí  íì', sponsor_modal_desc: 'ìí  #', sponsor_msg_label: 'ë©ìì§ (ì í)', sponsor_place_btn: 'ðï¸ íì', sponsor_confirm: 'ìí ë¥¼ íì?', sponsor_placed: 'ðï¸ íì ìë£!',
    hijack_btn_short: 'â ìí  HIJACK',
    capsule_title: 'íììº¡ì', capsule_desc: 'ë´ì¸ë ë©ìì§ë¥¼ ë¬»ì´ëë©´ ë¯¸ëì ëª¨ë  íë ì´ì´ìê² ê³µê°ë©ëë¤.', capsule_msg_label: 'ë©ìì§ (ìµë 280ì)', capsule_days_label: 'ê³µê° ìì  (ì¼)', capsule_bury_btn: 'â³ ìº¡ì ë¬»ê¸°', capsule_revealed_label: 'ìµê·¼ ê³µê°ë¨', capsule_none: 'ìì§ ê³µê°ë ìº¡ì ìì.', capsule_none_pending: 'ìì§ ë¬»í ìº¡ì ìì. ì²« ë²ì§¸ê° ëì´ë³´ì¸ì!', capsule_bury_confirm: 'íììº¡ì ë¬»ê¸°?', capsule_msg_required: 'ë©ìì§ë¥¼ ìë ¥íì¸ì', capsule_days_required: '1ì¼ ì´ì ìë ¥', capsule_buried: 'â³ ìº¡ìì´ ë¬»íìµëë¤!',
    milestone_title: 'ìë¯¼ì§ ì´ì í', milestone_desc: 'ìë¯¼ì§ ì­ì¬ì ê°ì¸ ì´ì íë¥¼ ê¸°ë¡íì¸ì.', milestone_cat_label: 'ì¹´íê³ ë¦¬', milestone_title_label: 'ì ëª© (ìµë 50ì)', milestone_desc_label: 'ì¤ëª (ìµë 200ì)', milestone_record_btn: 'ð ì´ì í ê¸°ë¡', milestone_write_btn: 'â ì´ì í ê¸°ë¡íê¸°', milestone_refresh_btn: 'âº ìë¡ê³ ì¹¨', milestone_cost_hint: 'ë¹ì©: {gp} GP', milestone_empty: 'ìì§ ê¸°ë¡ë ì´ì í ìì. ì²« ë²ì§¸ê° ëì¸ì!', milestone_login_required: 'ë¡ê·¸ì¸ íì', milestone_title_required: 'ì ëª©ì ìë ¥íì¸ì', milestone_desc_required: 'ì¤ëªì ìë ¥íì¸ì', milestone_confirm_title: 'ì´ì í ê¸°ë¡?', milestone_confirm_body: '{cat} ì´ì í "{title}"ì(ë¥¼) {gp} GPë¡ ê¸°ë¡?', milestone_recorded: 'ì´ì íê° ìë¯¼ì§ ì­ì¬ì ê¸°ë¡ëììµëë¤!',
    tombstone_label: 'ë¬ë¹', tombstone_btn: 'ðª¦ ë¬ë¹ ëê¸°', tombstone_modal_title: 'ë¬ë¹ ëê¸°', tombstone_modal_desc: 'íë ìì íë ìí ì ë¬ë¹ëªì ë¨ê¸°ì¸ì.', tombstone_epitaph_label: 'ë¬ë¹ëª (ìµë 60ì)', tombstone_place_btn: 'ðª¦ ëê¸°', tombstone_cost_hint: 'ë¹ì©: {gp} GP', tombstone_confirm_title: 'ë¬ë¹ ëê¸°?', tombstone_confirm_body: '{gp} GPë¡ ìêµ¬ ë¬ë¹ë¥¼ ëì¼ìê² ìµëê¹?', tombstone_placed: 'ë¬ë¹ê° ëììµëë¤.',
    gpannounce_title: 'ìë¯¼ì§ ë°©ì¡', gpannounce_desc: 'ì¤í¬ë¡¤ í°ì»¤ìì ëª¨ë  íì± íë ì´ì´ìê² ë©ìì§ë¥¼ ë°©ì¡í©ëë¤.', gpannounce_msg_label: 'ë©ìì§ (ìµë 80ì)', gpannounce_dur_label: 'ì§ì ìê° (ë¶)', gpannounce_post_btn: 'ð¢ ë°©ì¡íê¸°', gpannounce_login_required: 'ë¡ê·¸ì¸ íì', gpannounce_msg_required: 'ë°©ì¡í  ë©ìì§ë¥¼ ìë ¥íì¸ì', gpannounce_confirm_title: 'ìë¯¼ì§ ë°©ì¡ ê²ì?', gpannounce_confirm_body: '{dur}ë¶ ë°©ì¡ ë¹ì©: {gp} GP. ë©ìì§ê° íì± íë ì´ì´ ëª¨ëìê² íìë©ëë¤.', gpannounce_posted: 'ë°©ì¡ì´ ììë©ëë¤!',
    prestige_label: 'íë ì¤í°ì§', prestige_upgrade_btn: 'ð íë ì¤í°ì§ ìê·¸ë ì´ë', prestige_modal_title: 'íë ì¤í°ì§ ìê·¸ë ì´ë', prestige_confirm_btn: 'ìê·¸ë ì´ë', prestige_permanent_note: 'íë ì¤í°ì§ë ìêµ¬ì ì´ë©° ë¤ì´ê·¸ë ì´ëí  ì ììµëë¤.', prestige_login_required: 'ë¡ê·¸ì¸ íì', prestige_max_reached: 'ì´ë¯¸ ìµê³  íë ì¤í°ì§(ë¤ì´ìëª¬ë)ìëë¤!', prestige_upgraded: 'ð {name} íë ì¤í°ì§ë¡ ìê·¸ë ì´ë!',
    journal_title: 'ìë¯¼ì§ ì ë', journal_desc: 'ìë¯¼ì§ ê³µì ê¸°ë¡ì ìêµ¬ í­ëª©ì ê²ìíì¸ì. ë¹ì ì ê¸ì ê°ì²ì§ì ììí ë¨ìµëë¤.', journal_title_label: 'ì ëª© (ìµë 60ì)', journal_content_label: 'ë´ì© (ìµë 500ì)', journal_publish_btn: 'ð í­ëª© ê²ì', journal_write_btn: 'â í­ëª© ìì±', journal_feed_label: 'ìë¯¼ì§ ì°ëê¸°', journal_refresh_btn: 'âº ìë¡ê³ ì¹¨', journal_cost_hint: 'ë¹ì©: {gp} GP', journal_empty: 'ìì§ ì ë í­ëª© ìì. ì²« ë²ì§¸ ì­ì¬ë¥¼ ì°ì¸ì!', journal_login_required: 'ê²ìíë ¤ë©´ ë¡ê·¸ì¸íì¸ì', journal_title_required: 'ì ëª©ì ìë ¥íì¸ì', journal_content_required: 'ë´ì©ì ìë ¥íì¸ì', journal_confirm_title: 'ì ë í­ëª© ê²ì?', journal_confirm_body: '"{title}"ì(ë¥¼) {gp} GPë¡ ê²ì? ìêµ¬ì ì¼ë¡ ê³µê°ë©ëë¤.', journal_published: 'ìë¯¼ì§ ì°ëê¸°ì í­ëª©ì´ ê²ìëììµëë¤!',
    base_profile_btn: 'ð¤ íë¡í', profile_nickname_label: 'ëë¤ì', profile_motto_label: 'ì¢ì°ëª', profile_color_label: 'ìë°í ìì', profile_set_btn: 'ì¤ì ', profile_history_btn: 'ð ë³ê²½ ê¸°ë¡', profile_no_motto: 'ì¢ì°ëª ìì', profile_nick_confirm: 'ëë¤ì ì¤ì ?', profile_motto_confirm: 'ì¢ì°ëª ì¤ì ?', profile_color_confirm: 'ìë°í ìì ì¤ì ?',
    quests_failed: 'íì¤í¸ ë¡ë© ì¤í¨',
    quests_none_active: 'ì§í ì¤ì¸ íì¤í¸ê° ììµëë¤. ì ì í ë¤ì íì¸í´ ì£¼ì¸ì!',
    quests_pool_depleted: 'ë³´ì í ê³ ê° â ë³´ìì´ ì¼ì ì¤ë¨ëììµëë¤',
    quests_pool_low: 'í ë¶ì¡± â ë³´ìì´ {pct}%ë¡ ê°ìë©ëë¤',
    quests_tier_free: 'ë¬´ë£ ë¯¸ì',
    quests_tier_activity: 'íë ë¯¸ì',
    quests_tier_spending: 'í¹ì ìì ',
    quests_claim_btn: 'ìë ¹',
    quests_claim_prefix: 'ìë ¹',
    quests_claiming: 'ìë ¹ ì¤...',
    quests_pool_empty_unavailable: 'íì´ ë¹ì´ ë³´ìì ë°ì ì ììµëë¤',
    quests_recently_completed: 'ìµê·¼ ìë£',
    quests_expired: 'ë§ë£ë¨',
    quests_remaining: 'ë¨ì',
    quests_claim_failed: 'ìë ¹ì ì¤í¨íìµëë¤',
    quests_claim_success: '"{title}" ìë£ë¡ +{gp} GP íë!',
    quests_network_error: 'ë¤í¸ìí¬ ì¤ë¥',
    quests_login_first: 'ë¨¼ì  ë¡ê·¸ì¸íì¸ì',
    quests_completed_toast: 'íì¤í¸ ìë£: "{title}" â ë³´ìì ìë ¹íì¸ì!',
    // Daily check-in
    daily_checkin_title: 'ð ì¼ì¼ ì¶ìì²´í¬',
    daily_streak_days: 'ð¥ {n}ì¼ ì°ì',
    daily_day_of: '{total}ì¼ ì¤ {cur}ì¼ì°¨',
    daily_day_prefix: 'ì¼ì°¨',
    daily_done: 'ìë£',
    daily_gp_suffix: 'GP',
    daily_bonus_suffix: 'ë³´ëì¤',
    daily_checked_in: 'â ì¤ë ì¶ì ìë£!',
    daily_today_label: 'ì¤ë:',
    daily_checkin_btn: 'â ì¶ìì²´í¬',
    daily_missions_title: 'ë°ì¼ë¦¬ ë¯¸ì',
    daily_resets_prefix: 'ì´ê¸°í',
    daily_all_bonus_title: 'ð +50 GP ë³´ëì¤!',
    daily_all_bonus_sub: 'ëª¨ë  ë°ì¼ë¦¬ ë¯¸ì ìë£',
    daily_login_required: 'ë¡ê·¸ì¸ì´ íìí©ëë¤',
    daily_already_checked: 'ì´ë¯¸ ì¤ë ì¶ìíìµëë¤!',
    daily_check_in_failed: 'ì¶ìì²´í¬ ì¤í¨, ë¤ì ìëí´ ì£¼ì¸ì',
    daily_gp_claimed: '+{n} GP íë!',
    daily_streak_bonus: '+{n} GP ì°ì ë³´ëì¤!',
    daily_checkin_complete: 'ì¶ìì²´í¬ ìë£',
    daily_streak_msg: '{n}ì¼ ì°ì ì¶ì!',
    daily_mission_complete_toast: '+{n} GP ë¯¸ì ìë£!',
    daily_all_missions_bonus_toast: 'ð +50 GP ì ì²´ ë¯¸ì ë³´ëì¤!',
    daily_mission_claim_failed: 'ìë ¹ ì¤í¨',
    daily_mission_claim_conn_failed: 'ìë ¹ ì¤í¨ â ì°ê²°ì íì¸í´ ì£¼ì¸ì',
    dm_claim_pixels: 'ìí  íì¥', dm_claim_pixels_d: 'íì± ê¸ë¡ë¸ìì í½ìì ì ë ¹íì¸ì',
    dm_harvest: 'ìì ì±êµ´', dm_harvest_d: 'ë³´ì  ìí ìì PPë¥¼ ìííì¸ì',
    dm_explore_poi: 'ì ì°° ìë¬´', dm_explore_poi_d: 'ê¸ë¡ë¸ìì POI ë§ì»¤ë¥¼ ë°ê²¬íì¸ì',
    dm_hijack: 'ì ëì  íì·¨', dm_hijack_d: 'GPë¡ ì  ìí ë¥¼ íì·¨íì¸ì',
    dm_play_cantina: 'ì¹¸í°ë ëì´í¸', dm_play_cantina_d: 'ì¹¸í°ëìì ë¯¸ëê²ìì íë ì´íì¸ì',
    dm_equip_cosmetic: 'íì± í¨ì', dm_equip_cosmetic_d: 'ì¸ë²¤í ë¦¬ìì ì½ì¤ë©í±ì ì¥ì°©íì¸ì',
    dm_view_weather: 'í­í ì¶ì ì', dm_view_weather_d: 'íì± ë ì¨ ìë³´ë¥¼ íì¸íì¸ì',
    dm_enhance_item: 'ê°í ì¤íì¤', dm_enhance_item_d: 'ì½ì¤ë©í± ìì´í ê°íì ëì íì¸ì',
    dm_marketplace_trade: 'ë§ì¼ ë°ì´', dm_marketplace_trade_d: 'ë§ì¼íë ì´ì¤ìì ìì´íì êµ¬ë§¤íì¸ì',
    dm_win_naval_battle: 'í´ì  ì¹ë¦¬', dm_win_naval_battle_d: 'ë¤ë¥¸ í¨ëì í´ì ì ë²ì¬ ì¹ë¦¬íì¸ì',
    dm_build_ship: 'ì¡°ì ì ê°ë', dm_build_ship_d: 'í¨ëì ì í¨ì ì ë°ì£¼íì¸ì',
    dm_daily_checkin: 'ì¼ì¼ ì²´í¬ì¸', dm_daily_checkin_d: 'ì¤ë ë¡ê·¸ì¸íê³  ì¶ìíì¸ì',
    dm_claim_fallback: 'ìí  ì ë ¹', dm_claim_fallback_d: 'íì± ê¸ë¡ë¸ìì í½ìì ì ë ¹íì¸ì',
    dm_explore_fallback: 'ì¹í° íì¬', dm_explore_fallback_d: 'ê¸ë¡ë¸ìì POI ë§ì»¤ë¥¼ ë°ê²¬íì¸ì',
    dm_play_fallback: 'ì¼ì¼ íë', dm_play_fallback_d: 'ê²ì íëì ìííì¸ì (ì ë ¹, ì±êµ´, íì·¨ ë±)',
    // ââ GUILD tab ââ
    guild_join_or_create: 'ê¸¸ë ê°ì ëë ìì±',
    guild_teamup_desc: 'ë¤ë¥¸ ê°ì²ìë¤ê³¼ ë­ì³ íì±ì ì§ë°°íì¸ì',
    guild_pending_invites: 'ë°ì ì´ë',
    guild_find_title: 'ê¸¸ë ì°¾ê¸°',
    guild_find_hint: '(ID Â· íê·¸ Â· ì´ë¦)',
    guild_find_placeholder: 'ì) 42 Â· MARS Â· Red Legion',
    guild_search_btn: 'ê²ì',
    guild_create_title: 'ì ê¸¸ë ë§ë¤ê¸°',
    guild_create_cost_hint: '(50 GP ìëª¨)',
    guild_name_placeholder: 'ê¸¸ë ì´ë¦ (2~50ì)',
    guild_tag_placeholder: 'íê·¸ (2~4ì)',
    guild_desc_placeholder: 'ì¤ëª (ì í)',
    guild_create_btn: 'ê¸¸ë ìì± (50 GP)',
    guild_members_label: 'ë©¤ë²',
    guild_total_pixels_label: 'ì´ í½ì',
    guild_gp_treasury_label: 'GP ê¸ê³ ',
    guild_edit_btn: 'â í¸ì§',
    guild_upgrades_title: 'ê¸¸ë ìê·¸ë ì´ë',
    guild_pp_treasury: 'PP ê¸ê³ ',
    guild_next_prefix: 'ë¤ì:',
    guild_next_dash: 'ë¤ì: â',
    guild_max_level: 'ìµë ë ë²¨',
    guild_levelup_btn: 'ë ë²¨ì â²',
    guild_my_contribution: 'ë´ ìí ê¸°ì¬ë',
    guild_contribution_hint: 'ë§¤ ìíë ì¤ ì¼ë¶ê° ê¸¸ë ê¸ê³ ë¡ ì ë¦½ë©ëë¤.',
    guild_research_title: 'ì°êµ¬',
    guild_research_unlocked: 'â í´ê¸ë¨',
    research_mining_eff_1: 'â ì±êµ´ í¨ì¨ I', research_shield_disc: 'ð¡ ë°©í¨ íë ¨', research_diplomatic: 'ð ì¸êµì ',
    research_orbital_scan: 'ð° ê¶¤ë ì¤ìº', research_rapid_deploy: 'ð ì ì ë°°ì¹', research_logistics: 'ð¦ ë³ì°¸ ê´ë¦¬', research_mars_dominion: 'ð¥ íì± ì§ë°°',
    guild_join_requests: 'ê°ì ìì²­',
    guild_no_requests: 'ëê¸° ì¤ì¸ ìì²­ì´ ììµëë¤.',
    guild_invite_title: 'íë ì´ì´ ì´ë',
    guild_invite_hint: '(ëë¤ì ëë ì§ê° ì£¼ìë¡ ê²ì)',
    guild_invite_placeholder: '1ê¸ì ì´ì ìë ¥íì¬ ê²ì...',
    guild_invite_btn: 'ì´ë',
    guild_chat_title: 'ð¬ ê¸¸ë ì±í',
    guild_chat_refresh: 'â» ìë¡ê³ ì¹¨',
    guild_chat_empty: 'ìì§ ë©ìì§ê° ììµëë¤. ì¸ì¬ë¥¼ ë¨ê²¨ë³´ì¸ì!',
    guild_chat_loading: 'ì±í ë¶ë¬ì¤ë ì¤...',
    guild_chat_placeholder: 'ë©ìì§ë¥¼ ìë ¥íì¸ì...',
    guild_chat_send: 'ì ì¡',
    guild_leaderboard_title: 'ê¸¸ë ë¦¬ëë³´ë',
    guild_leave_btn: 'ê¸¸ë íí´',
    guild_danger_zone: 'ìí êµ¬ì­',
    guild_disband_btn: 'ê¸¸ë í´ì²´',
    guild_lb_empty: 'ìì§ ê¸¸ëê° ììµëë¤. ì²« ê¸¸ëê° ëì´ë³´ì¸ì!',
    guild_lb_members_suffix: 'ëª',
    guild_lb_leader_prefix: 'ê¸¸ëì¥:',
    guild_lb_unknown: 'ë¯¸ì',
    guild_lb_pixels: 'í½ì',
    guild_level_prefix: 'Lv.',
    guild_invited_by: 'ì´ëì',
    guild_accept_btn: 'ìë½',
    guild_promote_btn: 'ì¹ê¸',
    guild_demote_btn: 'ê°ë±',
    guild_kick_btn: 'ì¶ë°©',
    guild_transfer_btn: 'ìë',
    guild_member_role: 'ë©¤ë²',
    guild_officer_role: 'ìì',
    guild_leader_role: 'ê¸¸ëì¥',
    guild_search_searching: 'ê²ì ì¤â¦',
    guild_search_none: '"{q}"ì(ê³¼) ì¼ì¹íë ê¸¸ëê° ììµëë¤',
    guild_search_failed: 'ê²ì ì¤í¨',
    guild_search_join_btn: 'ê°ì',
    guild_invite_no_matches: 'ê²°ê³¼ê° ììµëë¤.',
    guild_invite_pending: 'ëê¸° ì¤',
    guild_invite_search_failed: 'ê²ì ì¤í¨.',
    guild_pixels_owned: 'í½ì ë³´ì ',
    guild_pixels_short: 'í½ì',
    guild_toast_login_first: 'ë¨¼ì  ë¡ê·¸ì¸íì¸ì',
    guild_toast_no_guild: 'ê¸¸ë ìì',
    guild_toast_need_name_tag: 'ê¸¸ë ì´ë¦ê³¼ íê·¸ë¥¼ ìë ¥íì¸ì',
    guild_toast_created: 'ê¸¸ë [{tag}] ìì± ìë£!',
    guild_toast_create_failed: 'ê¸¸ë ìì± ì¤í¨',
    guild_toast_enter_target: 'ì§ê° ì£¼ì ëë ëë¤ìì ìë ¥íì¸ì',
    guild_toast_invite_sent: 'ì´ëë¥¼ ë³´ëìµëë¤!',
    guild_toast_invite_failed: 'ì´ë ì¤í¨',
    guild_toast_joined: 'ê¸¸ëì ê°ìíìµëë¤!',
    guild_toast_accept_failed: 'ìë½ ì¤í¨',
    guild_toast_declined: 'ì´ëë¥¼ ê±°ì íìµëë¤',
    guild_toast_generic_failed: 'ì¤í¨',
    guild_toast_player_added: 'íë ì´ì´ê° ê¸¸ëì ì¶ê°ëììµëë¤',
    guild_toast_sign_in_first: 'ë¨¼ì  ë¡ê·¸ì¸íì¸ì',
    guild_confirm_join_request: '{name} ê¸¸ëì ê°ì ìì²­ì ë³´ë¼ê¹ì?\n\nì´ ê¸¸ëì ê¸¸ëì¥ ëë ììì´ ì¹ì¸í´ì¼ ê°ìë©ëë¤.',
    guild_toast_join_request_sent: '{name} ê¸¸ëì ê°ì ìì²­ì ë³´ëìµëë¤',
    guild_toast_join_request_failed: 'ìì²­ ì ì¡ ì¤í¨',
    guild_confirm_leave: 'ì´ ê¸¸ëìì íí´íìê² ìµëê¹?',
    guild_toast_left: 'ê¸¸ëìì íí´íìµëë¤',
    guild_confirm_kick: 'ì´ ë©¤ë²ë¥¼ ì¶ë°©íìê² ìµëê¹?',
    guild_toast_kicked: 'ë©¤ë²ë¥¼ ì¶ë°©íìµëë¤',
    guild_toast_promoted: 'ììì¼ë¡ ì¹ê¸íìµëë¤',
    guild_toast_demoted: 'ë©¤ë²ë¡ ê°ë±íìµëë¤',
    guild_confirm_transfer: 'ê¸¸ëì¥ ê¶íì ìëíìê² ìµëê¹? ëëë¦´ ì ììµëë¤.',
    guild_toast_transferred: 'ê¸¸ëì¥ ê¶íì ìëíìµëë¤',
    guild_toast_leveled_up: 'ê¸¸ëê° Lv.{n}ì¼ë¡ ë ë²¨ìíìµëë¤!',
    guild_toast_levelup_failed: 'ë ë²¨ì ì¤í¨',
    guild_toast_research_unlocked: 'ì°êµ¬ í´ê¸ ìë£!',
    guild_toast_research_failed: 'ì°êµ¬ ì¤í¨',
    guild_confirm_disband: 'â  ê¸¸ë "{name}"ì(ë¥¼) í´ì²´íìê² ìµëê¹?\n\nëª¨ë  ë©¤ë²ê° ì ê±°ë©ëë¤.\nëëë¦´ ì ììµëë¤!',
    guild_prompt_disband_type: 'íì¸ì ìí´ ê¸¸ë ì´ë¦ì ì íí ìë ¥í´ ì£¼ì¸ì:\n\n{name}',
    guild_toast_disband_mismatch: 'ê¸¸ë ì´ë¦ ë¶ì¼ì¹ â í´ì²´ ì·¨ìë¨',
    guild_toast_disbanded: 'ê¸¸ëê° í´ì²´ëììµëë¤',
    guild_toast_no_guild_data: 'ê¸¸ë ì ë³´ ìì',
    guild_toast_send_failed: 'ì ì¡ ì¤í¨',
    // ââ Global UI ââ
    nav_claim: 'ì ë ¹', nav_cantina: 'ì¹¸í°ë', nav_base: 'ë² ì´ì¤', nav_items: 'ìì´í',
    nav_my_land: 'ë´ ìí ', sectors_btn: 'ì¹í°', open_gacha_label: 'í¨ì  ê°ì± ', open_gacha_sub: 'ê°ì± ', my_assets_btn: 'ë´ ìì°', full_loss_optin_label: '⚔ PvP 영구손실 동의 — 양측 동의 전투에서만 격침 함선이 영구 소멸',
    open_base: 'ë² ì´ì¤ ì´ê¸°', open_gacha: 'ð² í¨ì  ê°ì± ', enter_cantina: 'â ì¹¸í°ë ìì¥',
    my_base: 'ë§ì´ ë² ì´ì¤', deposit_btn: 'ìê¸', withdraw_btn: 'ì¶ê¸', logout_btn: 'ë¡ê·¸ìì',
    harvest_all_btn: 'â ì¼ê´ ìí', tend_all_btn: 'ð§ ì¼ê´ ì ë¹', export_key_btn: 'ð í¤', export_key_title: 'ð ì§ê° í¤ ë´ë³´ë´ê¸°', export_key_disclaimer: 'â  ì§ê°ì ê°ì¸í¤ë¥¼ íìí©ëë¤. ì´ í¤ë¥¼ ê°ì§ ëêµ¬ë ìê¸ì íµì í  ì ììµëë¤. ì¤íë¼ì¸ì ë³´ê´íê³  ì ë ê³µì íì§ ë§ì¸ì. <b>ë³´ê´ ì±ìì ì ì ì¼ë¡ ë³¸ì¸ìê² ìì¼ë©°, ë¶ì¤Â·ëë ì ì´ììë í¤ë ìì°ì ë³µêµ¬í  ì ììµëë¤.</b>', export_key_ack: 'í¤ ë³´ê´ ì±ìì´ ì ì ì¼ë¡ ëìê² ììì ì´í´íê³  ëìí©ëë¤.', export_key_pw_ph: 'ë¹ë°ë²í¸ íì¸', export_key_reveal_btn: 'ê°ì¸í¤ íì', export_key_addr: 'ì£¼ì', export_key_priv: 'ê°ì¸í¤', export_key_copy: 'ð í¤ ë³µì¬', export_key_close_warn: 'ì ì¥ í ì´ ì°½ì ë«ì¼ì¸ì. í¤ë ìëì¼ë¡ ë¤ì íìëì§ ììµëë¤.',
    address_copied: 'ì£¼ìê° ë³µì¬ëììµëë¤!',
    // ââ Territory Info ââ
    top_governors: 'ð ìµê³  ì´ë', loading_dots: 'ë¡ë© ì¤...',
    no_alerts: 'ìë¦¼ì´ ììµëë¤', live_feed_title: 'ì¤ìê° í¼ë', live_feed_empty: 'ìì§ ì¤ìê° ì´ë²¤í¸ê° ììµëë¤.',
    claim_land: 'ìí  ì ë ¹', drag_select: 'ëëê·¸íì¬ ìí  ì í',
    land_size: 'í¬ê¸°', land_pixels: 'í½ì', land_cost: 'ë¹ì©',
    confirm_btn: 'íì¸', cancel_btn: 'ì·¨ì',
    claim_add_img: 'ë¨¼ì  ìí ë¥¼ ì ë ¹íê³  ì´ë¯¸ì§ë ëì¤ì ì¶ê°',
    my_territories: 'ë´ ìí ', no_territories: 'ìí ê° ììµëë¤',
    info_guild: 'ê¸¸ë', info_link: 'ë§í¬', info_name: 'ì´ë¦',
    share_btn: 'ð¤ ê³µì ', rename_btn: 'ì´ë¦ ë³ê²½', edit_image: 'ì´ë¯¸ì§ ìì ', customize_btn: 'â¨ ê¾¸ë¯¸ê¸°', merge_btn: 'ð ìí  ë³í©',
    cosmetics_title: 'ì½ì¤ë©í±', promo_link: 'íë¡ëª¨ ë§í¬', save_btn: 'ì ì¥',
    // ââ Claim Modal ââ
    hijack_warn_title: 'â  ìí  íì·¨',
    hijack_current_owner: 'íì¬ ìì ì:',
    hijack_refund: 'ìì ì ìë ¹: íë¶ + 10% ë³´ëì¤',
    hijack_you_pay: 'ì§ë¶ ê¸ì¡:',
    claim_location: 'ìì¹', claim_chain: 'ì²´ì¸', claim_cost: 'ë¹ì©',
    claim_pay_with: 'ê²°ì  ìë¨', claim_note: 'ìì ìë 100% íë¶ + 10% ë³´ëì¤ ìë ¹ Â· ììë£: 10%',
    // ââ Image Editor ââ
    image_editor: 'ì´ë¯¸ì§ í¸ì§ê¸°', upload_click: 'í´ë¦­íì¬ ì´ë¯¸ì§ ìë¡ë',
    upload_hint: 'PNG, JPG, GIF Â· ìµë 5MB',
    editor_drag_hint: 'ëëê·¸ë¡ ì´ë Â· ì¤í¬ë¡¤ë¡ íë Â· ë²í¼ì¼ë¡ íì ',
    // ââ Deposit/Withdraw/Swap ââ
    swap_fee: 'êµí ììë£:', you_receive: 'ìë ¹ ê¸ì¡:',
    // ââ Shop Modal ââ
    item_shop_title: 'ð¡ï¸ ìì´í ìì ',
    shop_tab_shop: 'ð ìì ', shop_tab_inv: 'ð¦ ë´ ìì´í',
    shop_cat_all: 'ì ì²´', shop_cat_defense: 'ë°©ì´', shop_cat_attack: 'ê³µê²©',
    shop_cat_utility: 'ì í¸', shop_cat_boost: 'ë¶ì¤í¸', shop_cat_cosmetic: 'ì½ì¤ë©í±',
    shop_active_effects: 'íì± í¨ê³¼', shop_my_inventory: 'ë´ ì¸ë²¤í ë¦¬',
    shop_confirm_title: 'êµ¬ë§¤ íì¸',
    shop_loading: 'ìì´í ë¶ë¬ì¤ë ì¤...', shop_inv_loading: 'ì¸ë²¤í ë¦¬ ë¶ë¬ì¤ë ì¤...',
    // ââ ê°í ââ
    enh_enhance: 'ê°í', enh_workshop: 'ê°í ììì¥',
    enh_materialized: 'ê°í ì¤ë¹ ìë£!', enh_returned: 'ì¸ë²¤í ë¦¬ë¡ ë°íë¨',
    enh_materialize_tip: 'ê°íë¥¼ ìí´ ê°ë³ ìì´íì¼ë¡ ë³í',
    enh_return_tip: 'ì¸ë²¤í ë¦¬ ì¤íì¼ë¡ ë°í',
    enh_current_level: 'íì¬ ë ë²¨', enh_next_level: 'ë¤ì ë ë²¨',
    enh_cost: 'ë¹ì©', enh_balance: 'ìì¡', enh_success_rate: 'ì±ê³µë¥ ',
    enh_body: 'ìì´í ê°íë¥¼ ìëí©ëë¤. ì¤í¨ ì: ë ë²¨ ì ì§, íë½ ëë íê´´ë  ì ììµëë¤.',
    enh_maxed_body: 'ì´ ìì´íì ìµë ê°í ë ë²¨ì ëë¬íìµëë¤.',
    enh_confirm: 'ê°í', enh_success: 'ê°í ì±ê³µ!',
    enh_fail_stay: 'ê°í ì¤í¨. ë ë²¨ ì ì§.',
    enh_fail_down: 'ê°í ì¤í¨! ë ë²¨ì´ íë½íìµëë¤:',
    enh_fail_destroy: 'ê°í ì¤í¨! ìì´íì´ íê´´ëììµëë¤!',
    // ââ MY TERRITORY tab ââ
    cmd_message: 'ì¬ë ¹ê´ ë©ìì§',
    total_px_label: 'ì´ í½ì', usdt_bal_label: 'USDT ìì¡', pp_bal_label: 'PP ìì¡',
    level_label: 'ë ë²¨', xp_next: 'ë¤ì: {n} XP', max_level: 'ìµë ë ë²¨',
    share_stats: 'ð¤ ë´ ì ì  ê³µì ', breakthrough_title: 'ëí',
    all_ranks: 'ì ì²´ ë±ê¸', show_label: 'â¼ í¼ì¹ê¸°', hide_label: 'â² ì ê¸°',
    rank_tbl_lv: 'LV', rank_tbl_name: 'ì´ë¦', rank_tbl_xp: 'XP', rank_tbl_reward: 'PP ë³´ì',
    my_sectors: 'ë´ ì¹í°', no_sectors_yet: 'ìì§ ìí ê° ììµëë¤. ì§ëë¥¼ ííí´ ë³´ì¸ì!',
    login_to_view: 'ë¡ê·¸ì¸íì¬ ìí ë¥¼ íì¸íì¸ì.',
    // ââ SECTORS tab ââ
    all_24_sectors: 'ì ì²´ 24ê° ì¹í°',
    sector_all: 'ì ì²´', sector_core: 'ì½ì´', sector_mid: 'ì¤ê°', sector_frontier: 'íë¡ í°ì´',
    sector_my: 'â­ ë´ ì¹í°', sector_loading: 'ì¹í° ë¶ë¬ì¤ë ì¤...',
    sector_claims_24h: '24ìê° ë´ {n}ê±´ ì ë ¹', sector_occupied: 'ì ì ',
    sector_avg_price: 'íê·  ê°ê²©', sector_cur_price: 'íì¬ ê°ê²©', sector_owners: 'ìì ì ì',
    sector_top_holder: 'ìµë¤ ë³´ì ì', sector_gov: 'ì´ë', sector_vice_gov: 'ë¶ì´ë',
    sector_tax: 'ì¸ì¨', sector_my_px: 'ë´ í½ì', sector_go: 'ì´ë',
    sector_empty_hint: 'ìì§ ë³´ì í í½ìì´ ììµëë¤. ìí ë¥¼ ì ë ¹íë©´ ì¬ê¸°ì íìë©ëë¤.',
    // ââ MINING tab ââ
    harvestable_pp: 'ìí ê°ë¥ PP', total_mined: 'ì´ ì±êµ´ë',
    harvest_pp: 'â ì±êµ´íê¸°', harvest_now: 'â¡ ì¦ì ì±êµ´ ({cost} PP)', mine_btn: 'â ì±êµ´íê¸°',
    mine_timer_prefix: 'ë¤ì ìíê¹ì§',
    harvest_available: 'ì§ê¸ ë°ë¡ ìí ê°ë¥!', harvest_ready: 'ì¤ë¹ ìë£!',
    claim_to_mine: 'í½ìì ì ë ¹íë©´ ì±êµ´ì ììí  ì ììµëë¤!',
    mining_rates: 'ì±êµ´ ë¹ì¨',
    rate_reward_range: 'ë³´ì ë²ì', rate_interval: 'ìí ê°ê²©',
    rate_core: 'ì½ì´ ë³´ëì¤', rate_mid: 'ì¤ê° ë³´ëì¤', rate_frontier: 'íë¡ í°ì´ ë³´ëì¤',
    // ââ GOVERN tab ââ
    governance_title: 'â ê±°ë²ëì¤',
    gov_active_events: 'íì± ì´ë²¤í¸', gov_my_positions: 'ë´ ì§ì',
    gov_login_positions: 'ë¡ê·¸ì¸íì¬ ê±°ë²ëì¤ ì§ìë¥¼ íì¸íì¸ì.',
    gov_commander: 'ì¬ë ¹ê´', gov_commander_controls: 'ì¬ë ¹ê´ ì»¨í¸ë¡¤',
    gov_global_event: 'ê¸ë¡ë² ì´ë²¤í¸ (1ì¼ 1í)',
    gov_double_mining: 'â ì±êµ´ 2ë°°', gov_war_time: 'â ì ì', gov_peace: 'ð íí',
    gov_announcement: 'ê³µì§ì¬í­', gov_announce_placeholder: 'ì ì²´ ë©ìì§...',
    gov_set: 'ì¤ì ', gov_bounty: 'íìê¸', gov_target_nick: 'ëì ëë¤ì',
    gov_place: 'ê±¸ê¸°', gov_rocket_drop: 'ë³´ê¸ ë¡ì¼ í¬í',
    gov_launch_drop: 'ð ë³´ê¸í í¬í',
    gov_governor_controls: 'ì´ë ì»¨í¸ë¡¤', gov_select_sector: 'ì¹í° ì í â¾',
    gov_tax_rate: 'ì¸ì¨', gov_sector_buffs: 'ì¹í° ë²í',
    gov_mining_20: 'â ì±êµ´ +20%', gov_defense_10: 'ð¡ ë°©ì´ +10%', gov_claim_10: 'ð° ì ë ¹ -10%',
    gov_sector_announce: 'ì¹í° ê³µì§', gov_sector_msg: 'ì¹í° ë©ìì§...',
    gov_bounty_board: 'íìê¸ ê²ìí', gov_no_bounties: 'íì± íìê¸ì´ ììµëë¤.',
    gov_siege_title: 'âï¸ ì¹í° ê³µì±ì ', gov_select_sector_siege: 'ì¹í° ì í...',
    gov_select_siege_hint: 'ì¹í°ë¥¼ ì ííì¬ ê³µì±ì  íí©ì íì¸íì¸ì.',
    gov_challenge_btn: 'âï¸ ì´ë ëì ',
    gov_betting_title: 'ð° ê³µì±ì  ë² í', gov_bet_challenger: 'âï¸ ëì ì', gov_bet_governor: 'ð¡ ì´ë',
    gov_declaration: 'ì´ë ì ì¸ë¬¸ (5 GP)',
    gov_declare_save: 'ì ì¸',
    gov_policy_open: 'ê°ë°© (ëª¨ë íì)', gov_policy_ally: 'ëë§¹ë§', gov_policy_closed: 'íì',
    gov_titles_title: 'ð ë´ ì¹­í¸', gov_titles_hint: 'ì§ê°ì ì°ê²°íì¬ ì¹­í¸ë¥¼ íì¸íì¸ì.',
    gov_fleet_title: 'â ë´ í¨ë', gov_fleet_hint: 'ì§ê°ì ì°ê²°íì¬ í¨ëë¥¼ íì¸íì¸ì.',
    gov_faction_btn: 'ð¡ íë²', gov_hijack_btn: 'â íì´ì­', gov_registry_btn: 'ð í¨ì  ëê°', gov_minerals_btn: 'ð ê´ë¬¼ ëê°',
    gov_fleet_empty: 'ìì§ í¨ì  ìì â ìë ì¡°ì ììì ê±´ì¡°ë¥¼ ììíì¸ì.',
    gov_fleet_my: 'ë´ í¨ì ', gov_fleet_max: 'ìµë 10', gov_shipyard: 'ì¡°ì ì',
    gov_ship_build: 'í¨ì  ê±´ì¡°', gov_ship_built: 'ê±´ì¡° ìë£!', gov_ship_repair: 'ìë¦¬',
    gov_ship_repaired: 'í¨ì  ìë¦¬ ìë£!', gov_ship_repair_confirm: 'í¨ì ì ìì í ìë¦¬íìê² ìµëê¹?',
    gov_ship_upgrade: 'ê°í', gov_ship_upgraded: 'ê°í ìë£!', gov_ship_upgrade_cost: 'ê°í ë¹ì©',
    sy_tab_blueprints: 'ì²­ì¬ì§', sy_tab_queue: 'ê±´ì¡° ëê¸°ì´', sy_tab_fleet: 'ë´ í¨ì ', sy_tab_market: 'í¨ì  ë§ì¼', sy_tab_crates: 'ê°ì± ', sy_tab_assembly: 'ê¸°ë', sy_crate_intro: 'í¨ì  ê°ì± ë¥¼ ëë ¤ ë¬´ìì í¨ì ì íëíì¸ì. íëí í¨ì ì í¨ì  ë§ì¼ìì ê±°ëí  ì ììµëë¤. íë¥ ì ê° ê°ì± ì ê³µê°ë©ëë¤.',
    sy_filter_size: 'í¨ê¸:', sy_size_all: 'ì ì²´', sy_size_frigate: 'íë¦¬ê¹', sy_size_destroyer: 'êµ¬ì¶í¨', sy_size_cruiser: 'ììí¨', sy_size_battleship: 'ì í¨', sy_size_titan: 'íì´í',
    sy_filter_faction: 'íë²:', sy_filter_size2: 'í¬ê¸°:',
    sy_mineral_label: 'ê´ë¬¼ ë³´ì ', sy_ships_label: 'í¨ì ',
    ship_mkt_buy: 'êµ¬ë§¤', ship_mkt_cancel: 'íë§¤ ì·¨ì',
    gov_battle_title: 'âï¸ í´ì ì í¬', gov_battle_hint: 'ì§ê°ì ì°ê²°íì¬ ì í¬ë¥¼ íì¸íì¸ì.',
    gov_battle_active: 'ì§í ì¤ì¸ ì í¬', gov_battle_declare: 'ì í¬ ì í¬',
    gov_battle_declared: 'ì í¬ ì í¬ ìë£! ìë¹ìì ìëµì ê¸°ë¤ë¦¬ë ì¤.',
    gov_battle_history: 'ì í¬ ê¸°ë¡', gov_battle_no_ships: 'í¨ì ì ë¨¼ì  ê±´ì¡°íì¸ì!',
    gov_battle_target_label: 'ëì ì§ê° ì£¼ì', gov_battle_select_ships: 'í¨ì  ì í (ìµë 5)',
    gov_battle_declare_confirm: 'ì í¬ ì í¬', gov_battle_respond: 'ì í¬ ìëµ',
    gov_battle_select_defender: 'ë°©ì´ì ì¬ì©í  í¨ì  ì í', gov_battle_accept: 'ìì !',
    gov_battle_fighting: 'ì í¬ ìì! ì½ 60ì´ í ê²°ê³¼ íì¸.',
    gov_battle_cancelled_ok: 'ì í¬ ì·¨ìë¨. GP íë¶.',
    gov_hall_of_fame: 'ð ëªìì ì ë¹', gov_select_sector_hof: 'ì¹í° ì í...',
    gov_select_hof_hint: 'ì¹í°ë¥¼ ì ííì¬ ì´ë ¥ì íì¸íì¸ì.',
    // ââ OPS tab ââ
    ops_title: 'ìì  ì¤í ì½ì',
    ops_desc: 'ìí  ë°ì¬ í¨ëìì ì¹¨ê³µÂ·íì¬ ìì ì ì¤ííê³  ì§í ìí©ì ê´ë¦¬íì¸ì',
    ops_pads_ready: 'ë°ì¬ë ì¤ë¹',
    ops_launch_new: 'ì ë¯¸ì ì¤í',
    ops_invasion: 'â ì¹¨ê³µ', ops_explore: 'ð° íì¬',
    ops_select_pad: 'ë°ì¬ë ì í', ops_bigger_reward: '(í° ë°ì¬ë â í° ë³´ì)',
    ops_target_lat: 'ëª©í ìë', ops_target_lng: 'ëª©í ê²½ë',
    ops_target_wallet: 'ëì ì§ê° / ëë¤ì (ì¹¨ê³µ ì ì©)',
    ops_launch_btn: 'ë¯¸ì ì¤í â¶',
    ops_active: 'ì§í ì¤ì¸ ìì ', ops_no_missions: 'íì± ë¯¸ìì´ ììµëë¤. ììì ì¤ííì¸ì.',
    ops_no_pads: 'â ìì§ ìí ê° ììµëë¤. ë¨¼ì  í½ìì ì ë ¹íì¬ ë°ì¬ëë¥¼ íë³´íì¸ì.',
    ops_launched: 'ì¤íë¨', ops_ready_status: 'â ì¤ë¹',
    ops_territory: 'ìí ', ops_merged: 'ë³í©ë¨',
    ops_ready_claim: 'ë³´ì ìë ¹ ê°ë¥', ops_failed: 'ì¤í¨',
    ops_claim: 'ìë ¹', ops_abort: 'ì¤ë¨',
    ops_abort_title: 'ë¯¸ì ì¤ë¨',
    ops_abort_body: 'ë¯¸ìì ê¸°ì§ë¡ ìííìê² ìµëê¹? ì°ë£ ì¼ë¶ë§ íë¶ë©ëë¤.',
    ops_abort_btn: 'ì¤ë¨',
    ops_connect_first: 'ë¨¼ì  ì§ê°ì ì°ê²°íì¸ì', ops_pick_pad: 'ë¨¼ì  ë°ì¬ëë¥¼ ì ííì¸ì',
    ops_enter_coords: 'ëª©í ì¢íë¥¼ ìë ¥íì¸ì', ops_target_required: 'ëì ì§ê° ëë ëë¤ìì´ íìí©ëë¤',
    ops_mission_launched: 'ë¯¸ì ì¤í ìë£!', ops_launch_failed: 'ì¤í ì¤í¨:',
    ops_claim_failed: 'ìë ¹ ì¤í¨:', ops_load_failed: 'ë¯¸ì ë¶ë¬ì¤ê¸° ì¤í¨.',
    ops_mission_aborted: 'ë¯¸ì ì¤ë¨ Â· {pp} PP íë¶ë¨',
    ops_cancel_failed: 'ì·¨ì ì¤í¨:', ops_no_reward: 'ë³´ì ìì',
    ops_pick_hint: 'â ììì ë°ì¬ëë¥¼ ì ííì¸ì',
    ops_await_target: 'â ëª©í ì¢í ëê¸° ì¤â¦',
    ops_computing: 'â¦ê¶¤ì  ê³ì° ì¤',
    ops_browse: 'ð¯ ì°¾ìë³´ê¸°',
    ops_invade_label: 'ì¹¨ê³µ', ops_explore_label: 'íì¬',
    // ââ Shop (base tab) ââ
    base_shop_btn: 'ð ìì ', base_inv_btn: 'ð ë´ ìì´í',
    // ââ Arena / Cantina ââ
    arena_connect: 'ì°ê²°',
    crash_title: 'CRASH', mines_title: 'MINES', coinflip_title: 'COINFLIP',
    dice_title: 'DICE', hilo_title: 'HI-LO',
    crash_guide_1: 'ë² í', crash_guide_2: 'ìì¹ ê´ì°°', crash_guide_3: 'ìºììì!',
    crash_waiting: 'ëê¸° ì¤...', crash_next_round: 'ë¤ì ë¼ì´ë ê³§ ìì',
    crash_bets_round: 'ì´ë² ë¼ì´ë ë² í', bet_amount: 'ë² í ê¸ì¡',
    auto_cashout: 'ìë ìºììì', place_bet: 'ë² ííê¸°',
    mines_count: 'ì§ë¢° ì', gems_found: 'ë°ê²¬í ë³´ì',
    multiplier: 'ë°°ì¨', next_mult: 'ë¤ì ë°°ì¨', potential_win: 'ìì ë¹ì²¨ê¸',
    start_game: 'ê²ì ìì',
    pick_side: 'íìª½ ì í', heads: 'HEADS', tails: 'TAILS',
    flip_coin: 'ëì  ëì§ê¸°',
    roll_to_play: 'íë ì´íë ¤ë©´ êµ´ë ¤ë¼', roll_over: 'ì¤ë²', roll_under: 'ì¸ë',
    dice_target: 'ëª©í', win_chance: 'ì¹ë¥ ', roll_dice: 'ì£¼ì¬ì êµ´ë¦¬ê¸°',
    hilo_higher: 'â¬ ëì', hilo_cashout: 'ìºììì', hilo_lower: 'â¬ ë®ì',
    // ââ Profile / Account ââ
    prof_referral: 'ì¶ì²', prof_live_feed: 'ì¤ìê° í¼ë', prof_alerts: 'ìë¦¼',
    prof_settings: 'ì¤ì ',
    ref_share_desc: 'ì½ëë¥¼ ê³µì íê³  ì¶ì²ì¸ì ë¼ì´ë¸ ì»¤ë¯¸ì íë(ìê¸Â·ì¤ìÂ·ìì Â·ì¹¸í°ëÂ·ë§ì¼ ììë£)ìì PPë¥¼ ë°ì¼ì¸ì.',
    ref_my_code: 'ë´ ì¶ì² ì½ë', ref_code_copied: 'ì½ë ë³µì¬ ìë£!',
    ref_enter_code: 'ì¶ì² ì½ë ìë ¥', ref_code_placeholder: 'ì½ë...',
    ref_referred_by: 'ì¶ì²ì¸:', prof_no_alerts: 'ìë¦¼ì´ ììµëë¤',
    settings_display: 'íë©´ ì¤ì ', settings_notifications: 'ìë¦¼ ì¤ì ',
    settings_account: 'ê³ì ',
    disp_weather: 'ë ì¨ ë° íì', disp_commander: 'ì¬ë ¹ê´ ë°°ë íì',
    disp_rocket: 'ë¡ì¼ ì´ë²¤í¸ ë°°ë íì', disp_announce: 'ê³µì§ ìë§ íì',
    disp_emblem: 'ê¸¸ë ì ë¸ë¼ íì', disp_tag: 'ê¸¸ë íê·¸ íì',
    notif_hijack: 'íì·¨ ìë¦¼', notif_weather: 'ë ì¨ ì´ë²¤í¸',
    notif_rocket: 'ë¡ì¼ ëë', notif_mining: 'ì±êµ´ ìë£', notif_sound: 'í¨ê³¼ì',
    acct_change_pw: 'ð ë¹ë°ë²í¸ ë³ê²½', acct_export: 'ð¦ ë´ ë°ì´í° ë´ë³´ë´ê¸°', acct_delete: 'ð ê³ì  ì­ì ',
    nick_new_placeholder: 'ì ëë¤ì',
    prof_photo_updated: 'íë¡í ì¬ì§ ë³ê²½ ìë£!',
    rank_up_title: 'ë±ê¸ ìì¹!', rank_up_msg: 'ë ë²¨ {n} ë¬ì±!',
    // ââ Weather ââ
    wx_active: 'íì±',
    wx_sector: 'ì¹í°', wx_time_left: 'ë¨ì ìê°',
    wx_sandstorm: 'ëª¨ëí­í', wx_sandstorm_desc: 'ê±°ì¹ ë°ëì´ ì°ë§ ììë¥¼ íë©´ì ì´ë°í©ëë¤',
    wx_solar_flare: 'íì íë ì´', wx_solar_flare_desc: 'íìì ê°í ë³µì¬ê° ì ìì¥ë¹ë¥¼ êµëí©ëë¤',
    wx_meteor_shower: 'ì ì±ì°', wx_meteor_shower_desc: 'ìíì± íí¸ì´ íë©´ì ììì§ëë¤',
    wx_dust_devil: 'ë¨¼ì§ ìì©ëì´', wx_dust_devil_desc: 'ìì©ëì´ì¹ë ë¨¼ì§ ê¸°ë¥ì´ ìì  í¨ì¨ì ë®ì¶¥ëë¤',
    wx_mining_yield: 'ì±êµ´ë', wx_movement_speed: 'ì´ë ìë', wx_visibility: 'ìì¼',
    wx_shield_strength: 'ì¤ë ê°ë', wx_hijack_cost: 'íì·¨ ë¹ì©',
    wx_rare_drop: 'í¬ê· ëë íë¥ ', wx_harvest_bonus: 'ìí ë³´ëì¤',
    wx_structure_damage: 'êµ¬ì¡°ë¬¼ í¼í´', wx_claim_cost: 'ì ë ¹ ë¹ì©',
    wx_exploration_speed: 'íì¬ ìë',
    wx_reduced: 'ê°ì', wx_possible: 'ê°ë¥',
    wx_unknown: 'ì ì ìë ë ì¨ ì´ë²¤í¸',
    // ââ Mode badge / misc ââ
    mode_claim: 'ð´ íì±ì í´ë¦­íì¬ ìí  ì í',
    confirm_purchase: 'êµ¬ë§¤ íì¸',
    global_stats_label: 'ð ì ì²´ íµê³',
    active_users_24h: 'íì± ì ì  (24ìê°)',
    top_pixel_holders: 'ð ìµë¤ í½ì ë³´ì ì',
    refresh_btn: 'â» ìë¡ê³ ì¹¨',
    // ââ Transport (M-158) ââ
    transport_title: 'ì¹í° ê° ì´ì¡',
    transport_desc: 'GP íë¬¼ì ì¹í° ê°ì ì´ì¡í©ëë¤. ìì¸ì ë³´ëì¤, í´ì ì ì¤ê°ì ì½íí  ì ììµëë¤.',
    transport_sub_launch: 'ì´ì¡ ìì', transport_sub_my: 'ë´ ì´ì¡', transport_sub_raid: 'ð´ ì½í ëì',
    transport_info_title: 'ð GP íë¬¼ ìì¡ì´ë?',
    transport_info_desc: 'ì¹í° A â ì¹í° Bë¡ GPë¥¼ "íë¬¼"ì²ë¼ ìì¡íë PvP ììµ ìì¤íìëë¤.',
    transport_info_merchant: 'â <b style="color:#FFB347">ìì¸(Merchant) ì§ì</b>ì ìì¡ ìë£ ì <b>ì¶ê° GP ë³´ëì¤</b>ë¥¼ íë',
    transport_info_raid: 'â ë¤ë¥¸ íë ì´ì´ê° ì¤ê°ì <b style="color:#FF6B6B">íë¬¼ì ì½í</b>í  ì ìì´ ìí/ë³´ì PvP ìì',
    transport_info_targets: 'ð´ RAID TARGETS í­ìì ë¤ë¥¸ ì ì  ìì¡ íë¬¼ì ì½í ê°ë¥',
    transport_info_note: 'ð¡ ìì´í ê±°ëì(ë§ì¼íë ì´ì¤)ì ë³ê°ìëë¤ â ë§ì¼ì MARKET í­ìì',
    transport_launch_new: 'ì ì´ì¡',
    transport_origin: 'ì¶ë° ì¹í°', transport_dest: 'ëì°© ì¹í°', transport_cargo: 'íë¬¼ GP',
    transport_launch_btn: 'ð ì´ì¡ ìì â¶',
    transport_my_empty: 'ì§í ì¤ì¸ ì´ì¡ì´ ììµëë¤. ììí´ë³´ì¸ì!',
    transport_raid_empty: 'ì§ê¸ ì½í ê°ë¥í ì´ì¡ì´ ììµëë¤.',
    transport_raid_warning: 'â  ì½í: ë¤ë¥¸ íë ì´ì´ì íë¬¼ì ìµê²©í©ëë¤. ë³¸ì¸ê³¼ ê¸¸ëìì ëììì ì ì¸ë©ëë¤. ìëë§ë¤ ì¿¨ë¤ì´ ì ì©.',
    transport_cancel_btn: 'â ì·¨ì',
    transport_raid_btn: 'ð´ ì½í',
    // ââ Fleet Command / World Events / Misc (global) ââ
    fcmd_title: 'â í¨ë ì§íë¶',
    fcmd_sub: 'í¨ë Â· ì¡°ì ì Â· Void Raider',
    fcmd_open_shipyard: 'ð¨ ì¡°ì ì',
    fcmd_my_fleets: 'â ë´ í¨ë',
    fcmd_tactical_lab: 'ð§ª ì ì  ì¤íì¤ â ì§í v11.2',
    tlab_title: 'ð§ª ì ì  ì¤íì¤',
    tlab_sub: 'ì§í / ê¸°ë v11.2 â ì¤ìê° ìë®¬ë ì´ì',
    tlab_close: 'â ë«ê¸°',
    ace_title: 'â ìì´ì¤ ëª¨ë',
    ace_sub: 'ì§ì  ì¡°ì¢ â íµì í ì¶ê²© ì¹´ë©ë¼',
    ace_close: 'â ë«ê¸°',
    we_active_title: 'â  ì§í ì¤ì¸ ìë ì´ë²¤í¸',
    we_none_active: 'íì± ì´ë²¤í¸ê° ììµëë¤',
    we_engage: 'â ì°¸ì ',
    btn_refresh: 'ìë¡ê³ ì¹¨',
    refresh_short: 'â»',
    guild_alliance_title: 'ð¤ ëë§¹ (ìµë 3ê¸¸ë)',
    war_declare_subtitle: 'ì ìì ì í¬í  ê¸¸ëë¥¼ ì ííì¸ì',
    war_declare_title: 'ì ì ì í¬',
    war_stake_label: 'â¡ íë (ì í): ê¸ê³ ìì GP í¬ì â ì¹ì ëì',
    war_declare_cost_label: 'ì í¬ ë¹ì©', war_treasury_label: 'ê¸¸ë ì¬ë¬´',
    war_search_placeholder: 'ð íí°: ê¸¸ë ì´ë¦ ëë íê·¸', war_search_hint: '2ê¸ì ì´ì ìë ¥íì¸ì',
    bd_search_hint: '2ì ì´ì ìë ¥íë©´ ê²ìë©ëë¤', battle_attack_start: 'ê³µê²© ìì',
    reward_battle_title: 'ð ì í¬ ë³´ì', btn_confirm: 'íì¸', btn_cancel: 'ì·¨ì',
    tn_tab_open: 'ëª¨ì§ì¤', tn_tab_running: 'ì§íì¤', tn_tab_completed: 'ìë£',
    rp_tab_featured: 'ì¶ì²', rp_tab_mine: 'ë´ ê³µì ',
    bd_my_fleet_label: 'ë´ í¨ë (ê³µê²©ì)', bd_recommended_label: 'ì¶ì² ìë (ë¹ì·í ì¤ë ¥)', bd_search_label: 'ìë ê²ì', bd_search_input_placeholder: 'ëë¤ì ëë í¨ëëª (2ì ì´ì)...',
    ca_subtitle: '// ìë®¬ë ì´ì ì  ì ì  ì§ì (ìµë <span id="caMaxSel">2</span>ê°)', ca_doctrines_label: 'ð DOCTRINE PRESETS â ìí´ë¦­ ì ì  íë¦¬ì (ëíë ì¶ì²)', ca_sniper_actions: 'focus_fire (1 GP ì ì½)',
    ca_focus_desc: 'ì§ì  ì  í¨ëì ì§ì¤ ê³µê²© â <b style="color:#ffd54f">+15% ë°ë¯¸ì§</b>', ca_emp_desc: 'í¹ì  tickì EMP â ì  ë°ì¬ì£¼ê¸° <b style="color:#ffd54f">Ã5ë°° ê°ì</b> 30tick', ca_wedge_desc: 'ëê²© ì ì  ê°ì  â ìë/ê³µê²© â, ë°©ì´ â', ca_reinforce_desc: 'ìì ì ì¶ê° í¨ì  í¬ì (1~20ì²)',
    ca_focus_target_label: 'ëì ì  í¨ë', ca_focus_auto_hint: 'ì ì¸ ìë í¨ëê° ìë ì§ì ë©ëë¤', ca_emp_tick_label: 'EMP ë°ë tick (0~8000, ê¸°ë³¸ 1200 â 4ë¶)', ca_emp_tick_hint: '1 tick = 200ms, ì§ì 30 tick', ca_wedge_hint: 'íë¼ë¯¸í° ìì â ë´ í¨ë ì ìì ì ì©ë©ëë¤', ca_reinforce_label: 'ì¦ì í¨ì ', ca_reinforce_hint: 'ìµë 20ì² â í¨ì  ì½ë Ã ìë',
    ca_quota: 'ì í <b id="caSelectedN">0</b> / <span id="caMaxSel2">2</span>', ca_skip_btn: 'ê±´ëë°ê³  ì í¬ ìì', ca_apply_btn: 'ì§ì ì ì© & ì í¬',
    ai_practice_desc: 'ëì´ëë³ AI í¨ëì ì°ìµ ì í¬. ë³´ìì ì¼ë° ì í¬ì 50%.', tn_create_btn: 'í ëë¨¼í¸ ê°ìµ',
    bh_title_kr: 'í¨ëì ', bh_tab_recent: 'ìµê·¼', bh_tab_history: 'ë´ ê¸°ë¡', bh_declare_btn: 'ì í¬ ì ì¸', bd_subtitle: '// ê³µê²©í  ìëë¥¼ ì°¾ì¼ì¸ì',
    war_duration_label: 'â± ì§ììê° (ì): ê¸°ë³¸ 72ìê°',
    war_declare_btn: 'âï¸ ì ì ì í¬',
    war_declaring_btn: 'ì í¬ ì¤...',
    war_treasury_low: 'ì¬ë¬´ GP ë¶ì¡± ({need} íì, ë³´ì  {have})',
    codex_subtitle: 'ê³µì ê²ì ê°ì´ëë¶',
    loading: 'ë¶ë¬ì¤ë ì¤â¦',
    // ìº íì¸
    campaign_profile_btn: 'ð íë¡í', // [i18n backfill v7.172]
    campaign_btn_start: 'ìì  ìì', campaign_btn_continue: 'ìì  ê³ì',
    campaign_btn_results: 'ê²°ê³¼ íì¸', campaign_btn_locked: 'ì ê¹',
    campaign_label_completed: 'ìë£', campaign_label_prologue: 'íë¡¤ë¡ê·¸',
    campaign_label_route: 'ë£¨í¸', campaign_label_ch: 'CH',
    campaign_no_chapters: 'ì´ì© ê°ë¥í ìº íì¸ ì±í°ê° ììµëë¤.',
    campaign_no_faction: 'íë²ì ë¨¼ì  ì ííë©´ ìº íì¸ì´ ì´ë¦½ëë¤.<br>íë² ë°°ì§ë¥¼ ëë¬ MCC / FSP / CV ì¤ íëë¥¼ ì ííì¸ì.',
    campaign_show_locked: 'ì ê¸´ ì±í° ë³´ê¸°', campaign_hide_locked: 'ì ê¸´ ì±í° ì¨ê¸°ê¸°',
    campaign_meta_sim: 'ìë² ìë®¬ë ì´ì',
    campaign_reward_claimed: 'ë³´ì ìë ¹ ìë£',
    campaign_objective_go: 'ì´ë',
    campaign_result_success: 'ìë¬´ ìë£',
    campaign_result_failure: 'ìë¬´ ì¤í¨',
    campaign_result_npc_success: 'ìì  ëª©í ë¬ì±. ë¤ì ë¨ê³ë¡ ëì´ê°ë¤.',
    campaign_result_npc_failure: 'ìì  ì¤í¨. ê²°ê³¼ë ê¸°ë¡ëë¤.',
    campaign_result_reward: 'ë³´ì:',
    campaign_result_confirm: 'íì¸',
    campaign_result_recheck: 'ëª©í ë¤ì íì¸',
    campaign_objectives_gate: 'ìì§ ìë£í  íëì´ ë¨ì ììµëë¤.',
    campaign_objectives_gate_sub: 'ë¨ì ëª©íë¥¼ ë¨¼ì  ì§íí ë¤ ê²°ê³¼ë¥¼ íì¸íì¸ì.',
    campaign_sim_in_progress: 'ìì  ì§í ì¤...',
    campaign_sim_radio_prefix: 'ë¬´ì :',
    campaign_sim_radio_default: 'ìì  ì§í ìí© ìë°ì´í¸.',
    campaign_sim_syncing: 'ìì  ìí ëê¸°í ì¤...',
    campaign_sim_detail: 'ìë² ì§íë¥  ê¸°ë°ì¼ë¡ ìë£ë©ëë¤.',
    story_skip: 'ê±´ëë°ê¸°',
    story_skip_title: 'ë¤ì ì¥ë©´ì¼ë¡',
    story_abandon: 'ëê°ê¸°',
    story_abandon_title: 'ìëë¦¬ì¤ë¥¼ ì¢ë£íê³  ì±í° ì§íì í¬ê¸°í©ëë¤',
    story_tap_hint: 'í­íì¬ ê³ì',
    story_abandon_confirm_title: 'ìëë¦¬ì¤ ì¢ë£',
    story_abandon_confirm_body: 'ì§í ì¤ì¸ ì±í°ë¥¼ í¬ê¸°íê³  ìëë¦¬ì¤ë¥¼ ì¢ë£í©ëë¤. ì´ë¯¸ ë§ë  ì íì ì ì§ë©ëë¤.',
    btn_close: 'â ë«ê¸°',
    lo_tagline: 'íì± ìí ë¥¼ í´ë ìíê³ <br>ì êµ­ì ê±´ì¤íì¸ì',
    lo_feat1: 'íì± ì§ëìì ì¤ìê° í½ì ìí  í´ë ì',
    lo_feat2: 'í¨ëì  Â· ê³µì±ì  Â· 1:1 GP ê²°í¬',
    lo_feat3: 'íë²ê³¼ ê¸¸ëë¡ ëë§¹ êµ¬ì¶',
    lo_feat4: 'ì±êµ´ Â· ê°í Â· ë§ì¼íë ì´ì¤',
    lo_btn_start: 'ð ì§ê¸ ììíê¸°',
    lo_btn_browse: 'ì§êµ¬ë³¸ ë¨¼ì  ëë¬ë³¼ê²ì',
    wb_tab_active: 'ð¥ íì± ì´ë²¤í¸', wb_tab_recent: 'ð ìµê·¼ ê²°ê³¼', wb_tab_mine: 'ð ë´ ë² í',
    sy_sort_price_asc: 'ê°ê²© ë®ìì', sy_sort_price_desc: 'ê°ê²© ëìì',
    sy_sort_power_desc: 'ê°í ëìì', sy_sort_newest_listed: 'ìµì  ë±ë¡ì',
    bv_share: 'ê³µì íê¸°',
    bv_my_victory: 'ð ì¹ë¦¬!', bv_my_defeat: 'ð í¨ë°°',
    bv_atk_won: 'ê³µê²©êµ° ì¹ë¦¬', bv_def_won: 'ìë¹êµ° ì¹ë¦¬', bv_draw_result: 'ë¬´ì¹ë¶',
    bv_stat_total_ships: 'ì´ í¨ì ', bv_stat_losses: 'ìì¤', bv_stat_damage: 'ë°ë¯¸ì§',
    bv_my_badge: 'ë',
    bv_performance: 'í¼í¬ë¨¼ì¤', bv_rating: 'ë ì´í', bv_efficiency: 'í¨ì¨',
    bv_highlights: 'ì í¬ íì´ë¼ì´í¸', bv_view_report: 'ð ìì¸ ë¦¬í¬í¸', bv_my_stats: 'ð ë´ ì í¬ ê¸°ë¡',
    bv_mvp: 'MVP', bv_flagship_ok: 'ê¸°í¨ ìì¡´', bv_flagship_lost: 'ê¸°í¨ ê²©ì¹¨',
    bv_report_loading: 'ë¦¬í¬í¸ ë¡ë© ì¤â¦', bv_report_error: 'ë¦¬í¬í¸ ë¶ë¬ì¤ê¸° ì¤í¨',
    bv_stat_survived: 'ìì¡´', bv_stat_efficiency: 'í¨ì¨',
    bvstat_w: 'ì¹', bvstat_l: 'í¨', bvstat_d: 'ë¬´',
    bvstat_kd: 'K/D', bvstat_winrate: 'ì¹ë¥ ', bvstat_streak: 'ìµì¥ ì°ì¹',
    bvstat_best: 'ìµê³  ë ì´í', bvstat_title: 'ë´ ì í¬ ê¸°ë¡',
    bvstat_total: 'ì´ ì í¬', bvstat_close: 'ë«ê¸°',
    daily_ops_title: 'â¡ DAILY OPS', daily_ops_subtitle: 'ë¦¬ì: UTC 00:00',
    daily_ops_no_missions: 'ë°ì¼ë¦¬ ë¯¸ìì ìë£íê³  GP ë³´ìì ë°ì¼ì¸ì',
    daily_ops_claim: 'ìë ¹', daily_ops_claimed: 'ìë ¹ìë£', daily_ops_completed: 'ìë£',
    daily_ops_event_today: 'ì¤ëì ì´ë²¤í¸',
    daily_ops_loading: 'ë¯¸ì ë¡ë© ì¤â¦',
    daily_ops_all_claimed: 'ì¤ë ë¯¸ì ëª¨ë ìë ¹! ë´ì¼ ë¤ì ì¤ì¸ì.',
    territory_identity_title: 'ìí  ì ì²´ì±', territory_fr: 'íë ë ì´í',
    territory_nickname: 'ì´ë¦', territory_bio: 'ì¤ëª',
    territory_edit_identity: 'â ì´ë¦/ì¤ëª í¸ì§', territory_save_identity: 'ì ì¥',
    territory_badge_pioneer: 'â ê°ì²ì (7ì¼)', territory_badge_settler: 'ð  ì ì°©ë¯¼ (30ì¼)',
    territory_badge_veteran: 'ð ë² íë (90ì¼)', territory_badge_fortress: 'ð¡ ìì',
    territory_defense_wins: 'ë°©ì´ ì¹ë¦¬', territory_times_hijacked: 'í¼ê²© íì',
    territory_hold_days: 'ë³´ì  ê¸°ê°', territory_hold_bonus: 'ì±êµ´ ë³´ëì¤',
    territory_fr_tier_newcomer: 'ì ê·', territory_fr_tier_pioneer: 'ê°ì²ì',
    territory_fr_tier_settler: 'ì ì°©ë¯¼', territory_fr_tier_fortress: 'ìì',
    territory_fr_tier_legend: 'ì ì¤',
    bounty_title: 'ð° íìê¸ ê²ìí', bounty_post: 'íìê¸ ë±ë¡',
    bounty_post_target: 'ëì ì§ê°', bounty_post_amount: 'ë³´ì GP',
    bounty_post_reason: 'ì¬ì  (ì í)', bounty_post_submit: 'íìê¸ ë±ë¡',
    bounty_no_bounties: 'íì± íìê¸ ìì',
    bounty_reward: 'ë³´ì', bounty_expires: 'ë§ë£',
    bounty_on_me: 'ëìê² ê±¸ë¦°', bounty_claim_hint: 'ëìê³¼ì ì í¬ìì ì´ê¸°ë©´ ìë ¹ ê°ë¥',
    bounty_cancel: 'ì·¨ì & íë¶',
    pvp_rec_title: 'ð¯ ì¶ì² ìë', pvp_rec_cpi: 'CPI', pvp_rec_ships: 'í¨ì ',
    pvp_rec_wins: 'ì¹ë¦¬', pvp_rec_challenge: 'ëì ',
    pvp_rec_loading: 'ìë íì ì¤â¦', pvp_rec_no_opponents: 'ì í©í ìëë¥¼ ì°¾ì ì ììµëë¤',
    pvp_rec_cpi_diff: 'ì ë ¥ ì°¨ì´',
    fleet_no_fleet_hint: 'ë³´ì  í¨ë ìì â ì¡°ì ììì í¨ì ì ê±´ì¡°íì¸ì',
    fleet_no_ships_hint: 'ë³´ì  í¨ì  ìì<br>ì¡°ì ììì í¨ì ì ê±´ì¡°íì¸ì',
    fleet_no_combat_fleet: 'ì í¬ ê°ë¥í í¨ëê° ììµëë¤. í¨ì ì ê±´ì¡°íì¸ì!',
    fleet_both_no_fleet: 'ìì¸¡ ëª¨ë ì í¬ ê°ë¥í í¨ëê° ììµëë¤.',
    fleet_enemy_no_fleet: 'ì  ê¸¸ëì ì í¬ ê°ë¥í í¨ëê° ììµëë¤.',
    bc_waiting: 'ëê¸°ì¤', bc_atk_win: 'ê³µê²© ì¹', bc_def_win: 'ìë¹ ì¹',
    bc_in_progress: 'ì§í ì¤', bc_scheduled: 'ìì ',
    bc_type_duel: 'PvP ê²°í¬', bc_type_siege: 'ê³µì±ì ', bc_type_hijack: 'íì´ì¬í¹',
    bc_type_raid: 'ë ì´ë', bc_type_event: 'ì´ë²¤í¸',
    gw_auto_win_title: 'ìë ì¹ë¦¬',
    gw_auto_win_body: 'ì  ê¸¸ëì ì í¬ ê°ë¥í í¨ëê° ììµëë¤.',
    gw_auto_win_pts: 'ìë ì¹ë¦¬ ì²ë¦¬ í ê¸¸ëì  í¬ì¸í¸ë¥¼ íëí©ëë¤ (+10 pts)',
    gw_auto_win_limit: '24ìê°ì 1í ê°ë¥',
    gw_auto_win_btn: 'ð ìë ì¹ë¦¬ íë',
    gw_auto_win_toast: 'ð ìë ì¹ë¦¬! +{pts} pts íë',
    gw_auto_win_cooldown: '24ìê° ë´ ì´ë¯¸ ìë ì¹ë¦¬ë¥¼ ì¬ì©íìµëë¤',
    gw_enemy_has_fleets: 'ì ìê² í¨ëê° ìê²¼ìµëë¤ â ì§ì  ì í¬íì¸ì',
    ob_line1: '"2067ë. ì§êµ¬ì ììì´ ê³ ê°ëë¤."',
    ob_line2: '"íì±ì´ ë§ì§ë§ í¬ë§ì´ë¤."',
    ob_line3: '"ë¹ì ì ì¤ë ì²« ë°ì ë´ëë ê°ì²ìë¤."',
    ob_btn_land: 'ð íì±ì ì°©ë¥íê¸°', ob_btn_skip: 'ê±´ëë°ê¸°',
    ob_step1_title: 'ì´ëªì ì ííì¸ì',
    ob_step1_sub: 'ì´ë¤ ë°©ìì¼ë¡ íì±ìì ì´ìë¨ì ê²ì¸ê°',
    ob_job_change_note: 'ëì¤ì ë³ê²½ ê°ë¥ (ì£¼ 1í ë¬´ë£)',
    ob_step1_choose: 'ì§ìì ì ííì¸ì',
    ob_step2_title: 'íë²ì ì ííì¸ì',
    ob_step2_sub: 'íì±ì ì¸ ì¸ë ¥ ì¤ íëì í©ë¥íì¸ì',
    ob_step2_free_note: 'ì²« ì í ë¬´ë£ Â· ì´í ë³ê²½ ì 500 GP',
    ob_step2_already: 'íë²ì´ ì´ë¯¸ ì íëì´ ììµëë¤.',
    ob_step2_continue: 'ê³ì â',
    ob_step2_loading: 'ë¡ë© ì¤...',
    ob_step2_load_fail: 'ë¡ë ì¤í¨ â ëì¤ì ì ííê¸°ë¥¼ ëë¬ì£¼ì¸ì',
    ob_step2_choose: 'íë²ì ì ííì¸ì', ob_step2_skip: 'ëì¤ì ì ííê¸°',
    ob_confirm: 'ì í íì ', ob_processing: 'ì²ë¦¬ ì¤...',
    ob_faction_error: 'íë² ì í ì¤í¨: ',
    ob_faction_success: 'ð¡ íë² ì í ìë£!',
    ob_step3_title: 'ì²« ìí ë¥¼ ì ë ¹íì¸ì',
    ob_step3_sub: 'ì§ëìì ë¹ ìì­ì í´ë¦­íë©´ í´ë ìí  ì ììµëë¤',
    ob_step3_free: 'â¨ ì²« ë²ì§¸ ìí  ë¹ì© ë©´ì ',
    ob_step3_tip1: 'ì´ ì°½ì ë«ì¼ë©´ ì§êµ¬ë³¸ì´ ë³´ìëë¤',
    ob_step3_tip2: 'íì± ì ë¹ ìì­ì í´ë¦­íë©´ í´ë ì ì°½ì´ ì´ë¦½ëë¤',
    ob_step3_tip3: 'CONFIRMì ëë¥´ë©´ ìí ê° ìê¹ëë¤',
    ob_step3_got_it: 'ðºï¸ ì´í´íì´ì, ììí©ëë¤!',
    ob_step3_next: 'ë¤ìì¼ë¡',
    ob_step4_title: 'ì¤ë¹ ìë£!', ob_step4_sub: 'íì±ì ì¤ì  ê²ì íìí©ëë¤, ê°ì²ìì¬',
    ob_step4_mission_label: 'ì¤ëì ì²« ë¯¸ì',
    ob_step4_mission_reward: 'ìë£ ì +{gp} GP',
    ob_step4_start: 'ð íì± íí ìì!',
    ob_reward_pioneer: 'ð ê°ì²ì',
    ob_reward_gp: '+{n} GP íë!', ob_reward_pp: '+{n} PP íë!',
    ob_reward_item: '{code} íë!', ob_reward_title: 'ì¹­í¸ "{name}" íë!',
    ob_starter_ship: 'ð ì¤íí° í¨ì  ì§ê¸! {name} Ã 1',
    guild_donate_placeholder: 'ê¸°ë¶í  GP ìë ¥', guild_donate_btn: 'ê¸°ë¶',
    auth_motto_placeholder: 'ì½ë¡ë ëª¨í â¦', auth_status_placeholder: 'ìí ë©ìì§â¦', auth_vtag_placeholder: 'íê·¸â¦',
    mt_rename: 'âï¸ ì´ë¦ë³ê²½', mt_decorate: 'â¨ ê¾¸ë¯¸ê¸°', mt_sell: 'ð° íë§¤', mt_shield: 'ð¡ï¸ ë³´í¸ë§', mt_upgrade: 'ð§ ìê·¸ë ì´ë', mt_hijack: 'â HIJACK ìí ',
    br_hint: 'Claudeê° ì½ê³  ìì í©ëë¤', br_label_desc: 'ë²ê·¸ ì¤ëª *', br_desc_placeholder: 'ì´ë¤ ë²ê·¸ì¸ì§ ì¤ëªí´ì£¼ì¸ì.\nì) ì í¬ í GPê° ì§ê¸ëì§ ìì',
    br_label_ss: 'ì¤í¬ë¦°ì· (ì í)', br_ss_placeholder: 'ð¸ í´ë¦­íê±°ë ì¤í¬ë¦°ì·ì ë¶ì¬ë£ê¸° (Cmd+V / Ctrl+V)', br_ss_drag: 'ëë íì¼ì ì¬ê¸°ì ëëê·¸íì¸ì', br_capturing: 'íë©´ ìº¡ì² ì¤...', br_submit: 'ì ì¶íê¸°', br_clear_ss: 'ì¤í¬ë¦°ì· ì§ì°ê¸°',
    ops_board_title: 'ð ì¤ëì ìì  ë³´ë', ops_legend_done: 'ð¢ ìë£', ops_legend_pending: 'âª ë¯¸ìë£', ops_legend_urgent: 'ð´ ê¸´ê¸',
    pvp_rewards_btn: 'ð ë³´ì ì´ë ¥', // [i18n backfill v7.172]
    pvp_declare_btn: 'â ì í¬ ì ì¸', pvp_tab_rec: 'ð¯ ì¶ì² ìë', pvp_tab_bounty: 'ð° íìê¸', pvp_tab_conflict: 'ð¥ ì¹í° ë¶ì',
    kb_hub_title: 'í¬ë³´ë & ì ë³´', kb_tab_board: 'í¬ë³´ë', kb_tab_scout: 'ì ì°°',
    betrayer_mark_title: 'ë°°ì ì ëì¸', betrayer_mark_desc: 'ë°°ì ì ëì¸ì´ ì°í ììµëë¤. GPë¥¼ ì§ë¶í´ ííì íë³µíì¸ì.', betrayer_redeem_btn: 'ìì£',
    wb_title: 'ð¯ WAR BETTING Â· ì ì ë² í', forge_upgrading: 'ð¨ ê°í ì¤...',
    we_select_fleet: 'í¨ë ì í...', we_fleet_min: 'ìµì 1ì² ì´ìì í¨ì ì´ ìì´ì¼ í©ëë¤',
    pvp_goto_tab: 'â PVP í­ì¼ë¡ â', pvp_from_tab: 'â PVP í­ìì â',
    guild_gp_donate_lbl: 'ð° GP ê¸°ë¶', prof_customize_title: 'âï¸ íë¡í ê¾¸ë¯¸ê¸°',
    vip_pass_title: 'ð« VIP í¨ì¤ë?',
    vip_pass_desc: 'PP(íëë í¬ì¸í¸)ë¡ êµ¬ë§¤íë <b style="color:#ce93d8">ê¸°ê°ì  íë¦¬ë¯¸ì êµ¬ë</b>ìëë¤.<br>â¢ â <b>ì±êµ´ ìë +%</b> (ë±ê¸ë³ ìì´)<br>â¢ ð° <b>GP íëë ë³´ëì¤</b><br>â¢ ð <b>ìê° í¬ë ì´í¸ ì§ê¸</b><br>â¢ ð <b>VIP ì ì© ì¹­í¸/ìë°í</b><br>PPë ì¤ì  êµ¬ë§¤íê±°ë ìì¦ ë³´ìì¼ë¡ íëí©ëë¤.',
    crate_what_title: 'ð¦ í¬ë ì´í¸ë?',
    crate_what_desc: 'GP ëë PPë¡ êµ¬ë§¤íë <b style="color:#ffcc02">ëë¤ ìì´í ìì</b>ìëë¤.<br>â¢ ð¯ <b>ë°©ì´ ìì´í</b> â ìí  ê°íÂ·ë°©ì´ ì¥ì¹<br>â¢ â <b>ì í¬ ìì´í</b> â í¨ì  ê°íÂ·ê³µê²© ë¶ì¤í¸<br>â¢ ð <b>ì½ì¤ë©í±</b> â ì¹­í¸Â·ìë°íÂ·ìí  íë ì<br>â¢ â¨ <b>í¬ê· ìì´í</b> â ë®ì íë¥ ë¡ ìë¦¬í¸ ë±ê¸<br>ì´ë¦° ìì´íì ì¸ë²¤í ë¦¬ìì íì¸íê³  ë§ì¼ì íë§¤í  ì ììµëë¤.',
    prestige_what_title: 'â­ íë ì¤í°ì§ë?',
    prestige_what_desc: 'GPë¥¼ ìëª¨í´ <b style="color:#ffd54f">ìêµ¬ ë­í¹ ì ì</b>ë¥¼ ìë ìì¤íìëë¤.<br>â¢ ðª¨ Colonist â ð¥ Pioneer â ð¥ Commander â ð¥ Vanguard â ð Sovereign<br>â¢ ëì ë±ê¸ì¼ìë¡ <b>ë¦¬ëë³´ë ìì ë¸ì¶</b> + ì ì© ì¹­í¸Â·íë ì íë<br>â¢ íë ì¤í°ì§ í¬ì¸í¸ë <b style="color:#ff8a80">ìêµ¬ì </b>ì´ë©° ë¤ì´ê·¸ë ì´ë ìì<br>â¢ ìí  í´ë ììë <b>íë ì¤í°ì§ íë ì</b>ì ì ì©í  ì ììµëë¤',
    /* === static markup i18n (added) === */
    ref_code_ph: '코드...',
    prod_section: '⚙ 생산',
    upgrades_section: '🔧 업그레이드',
    edit_label: '✏ 편집',
    campaign_quick: '캠페인',
    campaign_quick_sub: '스토리',
    select_your_fleet: '⚔ 함대 선택',
    change_image_btn: '이미지 변경',
    save_image_btn: '이미지 저장',
    current_balance: '현재 잔액',
    first_deposit_bonus: '첫 입금 보너스',
    select_chain: '체인 선택',
    deposit_address: '입금 주소',
    copy_address: '📋 주소 복사',
    available_usdt: '출금 가능 USDT',
    withdraw_amount: '출금 금액',
    max_btn: '최대',
    swap_pp_usdt_title: 'PP → USDT 교환',
    swap_amount_pp: '교환 금액 (PP)',
    exchange_pp_gp_title: 'PP → GP 교환',
    gp_balance: 'GP 잔액',
    exchange_amount_pp: '교환 금액 (PP)',
    confirm_exchange: '교환 확정',
    mg_invaders: '인베이더',
    mg_invaders_sub: '쏘고 살아남기',
    mg_runner: '러너',
    mg_runner_sub: '달리고 피하기',
    mg_digger: '디거',
    mg_digger_sub: '캐고 모으기',
    close_btn: '닫기',
    game_over: '게임 오버',
    mg_continue: '계속하기',
    mg_submit_score: '점수 제출',
    check_in_today: '오늘 출석',
    prof_motto: '모토',
    prof_set: '설정',
    prof_status: '💬 상태',
    prof_vanity_tag: '🏷️ 배니티 태그',
    prof_avatar_color: '아바타 색상',
    tos_title: '이용약관',
    privacy_title: '개인정보 처리방침',
    cantina_disclaimer_title: '칸티나 게임 고지',
    cantina_enter: '이해했습니다 — 칸티나 입장',
    cookie_accept: '동의',
    footer_tos: '이용약관',
    footer_privacy: '개인정보 처리방침',
    faction_selection: '파벌 선택',
    faction_select_sub: '// 파벌을 선택하세요',
    faction_cancel: '취소',
    faction_select: '선택',
    edit_guild_title: '길드 편집',
    edit_guild_sub: '이름 변경 · 엠블럼 꾸미기 · 설명 수정',
    ge_preview: '미리보기',
    ge_preview_hint: '픽셀아트 엠블럼은 32×32로 자동 조정됩니다. PNG/JPG 2MB 이하.',
    ge_guild_name: '길드 이름',
    ge_description: '설명',
    ge_desc_ph: '길드 슬로건 / 설명...',
    ge_emblem: '엠블럼',
    ge_emoji: '이모지',
    ge_upload: '업로드',
    ge_choose_image: '📁 이미지 선택 (자동 32×32)',
    ge_clear: '지우기',
    ge_emblem_hint: '32×32에서는 굵은 실루엣이 가장 잘 보입니다. 선명한 픽셀아트를 위해 투명 PNG 권장.',
    ge_total_cost: '총 비용',
    cancel_changes: '취소',
    save_changes: '변경 저장',
    onboarding_first_landing: '첫 착륙',
    onboarding_first_landing_body: '첫 화성 영토를 점령하며 시작하세요.',
    onboarding_open_base: 'BASE 열기',
    onboarding_dismiss: '닫기',
    comms_label: '💬 통신',
    settings_legal: '법적 고지',
    acct_tos: '📜 이용약관',
    acct_privacy: '🔒 개인정보 처리방침',
    change_password_title: '비밀번호 변경',
    current_password_ph: '현재 비밀번호',
    new_password_ph: '새 비밀번호 (8자 이상)',
    confirm_password_ph: '새 비밀번호 확인',
    join_telegram: '✈ 텔레그램 참여',
    agree_terms: '<a onclick="openTosModal();event.stopPropagation()">이용약관</a> 및 <a onclick="openPrivacyModal();event.stopPropagation()">개인정보 처리방침</a>에 동의합니다',
    remember_id_pw: '아이디/비밀번호 저장',
    auto_login: '자동 로그인',
    select_image_file: '이미지 파일 선택',
    scale_label: '크기',
    min_btn: '최소',
    link_url_label: '링크 URL',
    link_url_ph: 'https://your-site.com',
    preview_on_mars: '화성에서 미리보기',
    stamp_cancel: '✕ 취소',
    drag_to_position: '드래그로 위치 조정',
    stamp_ok: '✓ 확인',
    tos_body: '<h3>1. OCCUPY MARS 소개</h3><p>Occupy Mars는 가상의 화성을 배경으로 한 브라우저 기반 영토 전략 게임입니다. 플레이어는 토지를 점유하고, 자원을 채굴하며, 상대와 전투하고, 게임 내 재화를 거래합니다. 본 게임은 오락 목적으로 "있는 그대로(as is)" 제공됩니다.</p><h3>2. PLANET POINTS (PP) &mdash; 게임 내 재화</h3><p>Potato Points(PP)는 Occupy Mars 내에서 사용되는 기본 게임 내 재화입니다. PP는 실제 화폐, 법정화폐, 암호화폐가 <strong>아닙니다</strong>. PP는 게임 밖에서 자체적인 금전적 가치를 가지지 않습니다.</p><p>PP는 게임플레이(채굴, 퀘스트, 전투)를 통해 획득하거나 지원되는 결제 수단으로 구매할 수 있습니다. 모든 PP 구매는 관련 법령이 요구하지 않는 한 최종적이며 환불되지 않습니다.</p><h3>3. USDT 출금</h3><p>일정 조건에서 플레이어는 PP를 USDT로 전환하고 출금을 요청할 수 있습니다. 출금 가능 여부는 다음에 따라 달라집니다:</p><ul><li>최소 잔고 및 인증 요구사항</li><li>사기 방지 및 자금세탁방지(AML) 검증</li><li>처리 시간(변동될 수 있음)</li><li>출금액에서 차감되는 네트워크 수수료</li><li>보안 또는 점검을 위해 출금을 중단할 수 있는 게임 운영자의 권리</li></ul><p>PP와 USDT 간의 교환 비율은 게임이 결정하며 사전 예고 없이 변경될 수 있습니다.</p><h3>4. 이용자 행동 규정</h3><p>본 서비스를 이용함으로써 귀하는 다음 행위를 하지 않을 것에 동의합니다:</p><ul><li>봇, 스크립트, 자동화 도구 사용</li><li>버그나 결함 악용(대신 신고할 것)</li><li>다른 플레이어를 괴롭히거나 위협하거나 사칭</li><li>게임 경제 조작 시도</li><li>부당한 이익을 위해 다수의 계정 생성</li><li>공식 채널 외부에서 계정이나 게임 내 자산의 현금 거래</li></ul><h3>5. 계정 종료</h3><p>당사는 본 약관을 위반하는 계정을 정지 또는 종료할 권리를 가지며, 이에는 다음이 포함되지만 이에 한정되지 않습니다:</p><ul><li>치팅, 봇팅, 악용</li><li>부정 입금 또는 결제 취소(차지백)</li><li>다른 플레이어 또는 운영진에 대한 학대 행위</li><li>관련 법령 위반</li></ul><p>종료된 계정은 남은 PP 잔고를 상실할 수 있습니다. 사기 또는 보안 위협의 경우를 제외하고, 종료 전에 합리적인 범위에서 통지하도록 노력합니다.</p><h3>6. 지적재산권</h3><p>모든 게임 콘텐츠, 코드, 아트, 텍스트, 디자인은 Occupy Mars 팀의 소유입니다. 플레이어가 업로드한 이미지는 해당 제작자의 소유로 남지만, 귀하는 당사가 이를 게임 내에서 표시할 수 있는 라이선스를 부여합니다. 귀하는 게임의 어떤 부분도 복제, 배포, 역공학(리버스 엔지니어링)할 수 없습니다.</p><h3>7. 책임의 제한</h3><p>본 게임은 어떤 종류의 보증도 없이 제공됩니다. 당사는 다음에 대해 책임을 지지 않습니다:</p><ul><li>버그, 서버 문제, 점검으로 인한 게임 내 재화 또는 진행 상황의 손실</li><li>블록체인 네트워크의 지연 또는 장애</li><li>계정에 대한 무단 접근(강력한 비밀번호를 사용하세요)</li><li>간접적, 부수적, 결과적 손해</li></ul><p>당사의 총 책임은 어떤 청구 이전 12개월 동안 귀하가 당사에 지불한 금액을 초과하지 않습니다.</p><h3>8. 약관의 변경</h3><p>당사는 언제든지 본 약관을 업데이트할 수 있습니다. 변경 후 게임을 계속 이용하는 것은 이에 대한 동의로 간주됩니다. 중요한 변경 사항은 게임 내 공지를 통해 알려드립니다.</p><h3>9. 준거법</h3><p>본 약관은 게임 운영자가 등록된 관할권의 법률의 적용을 받습니다. 분쟁은 먼저 성실한 협의를 통해 해결합니다.</p><h3>10. 문의</h3><p>본 약관에 관한 문의는 게임 내 고객지원 채널 또는 공식 웹사이트에 안내된 이메일로 연락 바랍니다.</p><div class="legal-update">최종 업데이트: 2026년 4월 9일 &mdash; 버전 1.0</div>',
    privacy_body: '<h3>1. 수집하는 정보</h3><p>귀하가 Occupy Mars를 이용할 때 당사는 다음을 수집할 수 있습니다:</p><ul><li><strong>계정 정보:</strong> 이메일 주소, 닉네임, 비밀번호(해시 처리 &mdash; 평문은 저장하지 않음)</li><li><strong>지갑 주소:</strong> 귀하의 수탁형 게임 지갑 주소(가입 시 생성)</li><li><strong>게임플레이 데이터:</strong> 영토 점유, 전투, 거래, 퀘스트 진행, 게임 통계</li><li><strong>기기 정보:</strong> 브라우저 종류, 화면 크기, IP 주소(보안 및 요청 제한용)</li><li><strong>이용 데이터:</strong> 방문 페이지, 사용 기능, 세션 지속 시간</li></ul><h3>2. 데이터 이용 방식</h3><ul><li>게임 서비스 제공 및 유지</li><li>게임 내 거래 및 출금 처리</li><li>사기, 치팅, 악용 방지</li><li>게임 성능 및 기능 개선</li><li>중요한 계정 알림 발송(보안 경고, 약관 변경)</li><li>게임 개선을 위한 익명 분석 생성</li></ul><h3>3. 데이터 저장 및 보안</h3><p>귀하의 데이터는 저장 시 및 전송 시 암호화되어 보안 서버에 저장됩니다. 비밀번호는 bcrypt로 해시 처리됩니다. 당사는 요청 제한, 입력 검증, 정기 보안 감사를 시행합니다. 다만 어떤 시스템도 100% 안전하지는 않으므로 &mdash; 강력하고 고유한 비밀번호를 사용하세요.</p><h3>4. 제3자 서비스</h3><p>당사는 다음 종류의 제3자 서비스와 연동합니다:</p><ul><li><strong>블록체인 네트워크:</strong> USDT 입금 및 출금 처리용(거래 데이터는 온체인에 공개됨)</li><li><strong>이메일 서비스:</strong> 비밀번호 재설정 및 계정 알림용</li><li><strong>CDN/호스팅:</strong> 게임 에셋 전달용</li></ul><p>당사는 귀하의 개인정보를 제3자에게 판매하지 않습니다.</p><h3>5. 귀하의 권리</h3><p>관할권에 따라 귀하는 다음의 권리를 가질 수 있습니다:</p><ul><li><strong>접근:</strong> 당사가 보유한 귀하의 개인정보 사본 요청</li><li><strong>정정:</strong> 부정확하거나 불완전한 데이터 수정</li><li><strong>삭제:</strong> 계정 및 관련 데이터의 삭제 요청</li><li><strong>내보내기:</strong> 이동 가능한 형식으로 데이터 수령</li><li><strong>반대:</strong> 특정 데이터 처리에 대한 반대</li></ul><p>이러한 권리를 행사하려면 게임 내 고객지원 채널을 통해 연락 바랍니다. 당사는 30일 이내에 답변드립니다.</p><h3>6. 쿠키 및 로컬 스토리지</h3><p>당사는 다음 용도로 브라우저 쿠키와 localStorage를 사용합니다:</p><ul><li>인증(로그인 상태 유지)</li><li>설정 기억(언어, 설정)</li><li>게임 상태 캐싱(더 빠른 로딩을 위해)</li></ul><p>당사는 제3자 추적 쿠키를 사용하지 않습니다. 브라우저 설정을 통해 언제든지 쿠키를 삭제할 수 있지만, 이 경우 로그아웃될 수 있습니다.</p><h3>7. 데이터 보존</h3><p>당사는 귀하의 계정이 활성인 동안 데이터를 보존합니다. 계정 삭제를 요청하면 30일 이내에 개인정보를 삭제하며, 다만 법령이 보존을 요구하는 경우(예: 금융 거래 기록)는 예외로 합니다.</p><h3>8. 아동</h3><p>Occupy Mars는 18세 미만 이용자를 대상으로 하지 않습니다. 당사는 미성년자의 데이터를 고의로 수집하지 않습니다. 미성년자가 계정을 만들었다고 생각되면 당사에 연락 바랍니다.</p><h3>9. 본 방침의 변경</h3><p>당사는 수시로 본 방침을 업데이트할 수 있습니다. 중요한 변경 사항은 게임 내 공지를 통해 알려드립니다. 변경 후 계속 이용하는 것은 이에 대한 동의로 간주됩니다.</p><h3>10. 문의</h3><p>개인정보 관련 문의나 요청은 게임 내 고객지원 채널 또는 공식 웹사이트에 안내된 이메일로 연락 바랍니다.</p><div class="legal-update">최종 업데이트: 2026년 4월 9일 &mdash; 버전 1.0</div>',
    cantina_disclaimer_body: '칸티나에는 운과 기술의 게임이 포함되어 있습니다.<br><strong>PP(Potato Points)를 잃을 수 있습니다. 책임감 있게 플레이하세요.</strong><br><br>게임에 쓴 PP는 사라지며 &mdash; 승리는 보장되지 않습니다.<br>플레이하려면 <strong>만 18세 이상</strong>이어야 합니다.<br><br>도박 문제가 생기고 있다고 느껴진다면,<br>잠시 멈추고 도움을 찾으세요.',
    cookie_banner_text: '당사는 인증, 설정 저장, 이용 경험 개선을 위해 쿠키와 localStorage를 사용합니다.',
  },
  ja: {
    login: 'ã­ã°ã¤ã³', register: 'æ°è¦ç»é²', logout: 'ã­ã°ã¢ã¦ã', account: 'ã¢ã«ã¦ã³ã',
    email_login: 'ã¡ã¼ã«ã­ã°ã¤ã³ / ç»é²', my_wallet: 'ãã¤ã¦ã©ã¬ãã',
    wallet_cta_desc: 'ã­ã°ã¤ã³ãã¦USDTãå¥éã<br>é åãç²å¾ãã¦å ±é¬ãå¾ãã',
    email_placeholder: 'email@example.com', password_placeholder: 'ãã¹ã¯ã¼ã (6æå­ä»¥ä¸)',
    nickname_placeholder: 'ããã¯ãã¼ã  (ä»»æ)', referral_placeholder: 'ç´¹ä»ã³ã¼ã (ä»»æ)',
    or: 'ã¾ãã¯', email_wallet_note: 'ã¡ã¼ã«ã¢ã«ã¦ã³ãã«ã²ã¼ã ã¦ã©ã¬ãããåèµããã¦ãã¾ãã<br>DEPOSITãã¿ã³ã§å¥éã¢ãã¬ã¹ãç¢ºèªã§ãã¾ãã',
    game_wallet: 'ã²ã¼ã ã¦ã©ã¬ãã', usdt_balance: 'USDTæ®é«', pp_balance: 'PPæ®é«',
    global_stats: 'å¨ä½çµ±è¨', total_pixels: 'ç·ãã¯ã»ã«', pixels_sold: 'è²©å£²æ¸ã¿',
    total_volume: 'ç·åå¼é', hijacks_hr: 'å¥ªå/æ', active_users: 'ã¢ã¯ãã£ãã¦ã¼ã¶ã¼',
    leaderboard: 'ãªã¼ãã¼ãã¼ã', search_owner: 'ãªã¼ãã¼æ¤ç´¢', territory_info: 'é åæå ±',
    coords: 'åº§æ¨', owner: 'ãªã¼ãã¼', size: 'ãµã¤ãº', price_paid: 'è³¼å¥ä¾¡æ ¼',
    hijack_cost: 'å¥ªåã³ã¹ã', hijack_this: 'ãã®é åãå¥ªå',
    my_alerts: 'ã¢ã©ã¼ã', live_feed: 'ã©ã¤ããã£ã¼ã', place_image: 'ç»åãéç½®',
    choose_file: 'ç»åãã¡ã¤ã«ãé¸æ', item_shop: 'ã¢ã¤ãã ã·ã§ãã', open_shop: 'ã·ã§ãããéã',
    referral_program: 'ç´¹ä»ãã­ã°ã©ã ', referral_desc: 'ã³ã¼ããå±æãã¦ç´¹ä»èã®<br>ã©ã¤ãã³ããã·ã§ã³æ´»åã§PPãç²å¾ï¼',
    codex_open: 'ã²ã¼ã ã¬ã¤ã', codex_tagline: 'ä¸çè¦³ã¨ã·ã¹ãã è§£èª¬', profile_prefs: 'ç°å¢è¨­å®', profile_language: 'è¨èª', codex_prev: 'åã¸', codex_next: 'æ¬¡ã¸',
    ref_tiers: 'Tier 1: 15% Â· Tier 2: 10% Â· Tier 3: 5%',
    ref_sources: 'åçæº(æ¢å®): å¥é Â· ã¹ã¯ãã Â· ã·ã§ãã Â· ã«ã³ãã£ã¼ã Â· ãã¼ã±ããææ°æ (ãã®ä»ã¯éå¶è¨­å®ã§å¤å)',
    view_dynasty: 'ð ãã¤ãã¹ãã£è¡¨ç¤º', dyn_leaderboard: 'ã©ã³ã­ã³ã°', dyn_my_tree: 'ãã¤ããªã¼',
    my_ref_code: 'ç´¹ä»ã³ã¼ã', enter_ref_code: 'ç´¹ä»ã³ã¼ãå¥å',
    referrals: 'ç´¹ä»æ°', total_earned: 'ç·åç', coming_soon: 'æºåä¸­',
    deposit_usdt: 'USDTå¥é', withdraw_usdt: 'USDTåºé', swap_pp: 'PP â USDTäº¤æ',
    claim_territory: 'é åç²å¾', confirm_claim: 'ç²å¾ç¢ºèª',
    approve_deposit: 'æ¿èª & å¥é', request_withdrawal: 'åºéãªã¯ã¨ã¹ã',
    confirm_swap: 'äº¤æç¢ºèª', cancel: 'ã­ã£ã³ã»ã«', copy: 'ã³ãã¼', apply: 'é©ç¨',
    click_mars: 'ç«æãã¯ãªãã¯ãã¦é åãé¸æ', click_stamp: 'ç«æãã¯ãªãã¯ãã¦éç½®ï¼',
    bug_report_label: 'ãã°', bug_report_title: 'ãã°å ±å',
    bug_report_sub: 'ä½ãèµ·ãããæãã¦ãã ãããéçºãã¼ã ãç¢ºèªãã¦ä¿®æ­£ãã¾ãã',
    bug_report_category: 'ã«ãã´ãª',
    bug_cat_ui: 'UI', bug_cat_gameplay: 'ã²ã¼ã ãã¬ã¤', bug_cat_payment: 'æ±ºæ¸',
    bug_cat_performance: 'ããã©ã¼ãã³ã¹', bug_cat_other: 'ãã®ä»',
    bug_report_summary: 'ç°¡åãªè¦ç´',
    bug_report_summary_ph: 'ä¾: ãã¤ã¸ã£ãã¯ãã¿ã³ãåå¿ããªã',
    bug_report_detail: 'ä½ãèµ·ãã¾ãããï¼',
    bug_report_detail_ph: 'åç¾æé ãæå¾ããåä½ãå®éã®åä½ãè¨å¥ãã¦ãã ãã...',
    bug_report_auto_meta: 'èªåæ·»ä»: ãã¼ã¸URLããã©ã¦ã¶ãæè¿ã®ã³ã³ã½ã¼ã«ã¨ã©ã¼ãæ¥ç¶ä¸­ã®ã¦ã©ã¬ããã',
    bug_report_submit: 'ã¬ãã¼ãéä¿¡', bug_report_sending: 'éä¿¡ä¸­...',
    bug_report_thanks: 'ð éä¿¡å®äºï¼ãããã¨ããããã¾ãã',
    bug_report_empty: 'ãã°ã®åå®¹ãå¥åãã¦ãã ãã',
    registered: 'ç»é²å®äºï¼', login_success: 'ã­ã°ã¤ã³æåï¼', wallet_connected: 'ã¦ã©ã¬ããæ¥ç¶æ¸ã¿',
    wallet_disconnected: 'ã¦ã©ã¬ããåæ­æ¸ã¿', copied: 'ç´¹ä»ãªã³ã¯ãã³ãã¼ãã¾ããï¼',
    stats_label: 'çµ±è¨', live_label: 'ã©ã¤ã',
    find_email: 'IDæ¤ç´¢', forgot_password: 'ãã¹ã¯ã¼ãåè¨­å®',
    find_email_title: 'IDæ¤ç´¢', reset_password_title: 'ãã¹ã¯ã¼ãåè¨­å®',
    send_reset_code: 'èªè¨¼ã³ã¼ãéä¿¡', change_password: 'ãã¹ã¯ã¼ãå¤æ´',
    enter_nickname: 'ããã¯ãã¼ã ãå¥å', enter_email: 'ã¡ã¼ã«ã¢ãã¬ã¹ãå¥å',
    reset_code_placeholder: '6æ¡ã®èªè¨¼ã³ã¼ã', new_password: 'æ°ãããã¹ã¯ã¼ã', confirm_password: 'ãã¹ã¯ã¼ãç¢ºèª',
    back_to_login: 'â ã­ã°ã¤ã³ã«æ»ã', search_btn: 'æ¤ç´¢',
    code_sent_to: 'èªè¨¼ã³ã¼ãéä¿¡å',
    tut_howto: 'éã³æ¹',
    tut_step1: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦éå§ â ç«æã®é åãç²å¾ããè¦éãç·¨æããã­ã£ã³ãã¼ã³ã¹ãã¼ãªã¼ãé²ãããã',
    tut_step2: 'CLAIMãã¿ãããã¦ç«æãããã§ãã¯ã»ã«é åãè³¼å¥ãé åã¯åç©«ã§ããPPãçç£ãã¾ãã',
    tut_step3: 'BASEã§PPãåç©«ããä»æ¥ã®ä½æ¦ãã¼ãã§GPãç²å¾ãé åãã¢ããã°ã¬ã¼ãããé è¹æã¸ã',
    tut_step4: 'CANTINAã§æ¦ç¥ãå¼·åããã¢ã¤ãã ãããã²ã¼ã ãæ¥½ãããã',
    tut_step5: 'ã­ã£ã³ãã¼ã³ï¼ã¡ã¤ã³ã¹ãã¼ãªã¼ï¼ãé²ããããè¦éãç·¨æãã¦PvPæ¦ã«åå©ããç´¹ä»ãªã³ã¯ã§åéãæå¾ãã¦ãã¼ãã¹å ±é¬ãç²å¾ï¼',
    tut_next: 'æ¬¡ã¸', tut_skip: 'ã¹ã­ãã', tut_done: 'ãã¬ã¤éå§!',
    help_claim: 'é åç²å¾',
    help_claim_body: 'ç«æããã©ãã°ãã¦ãã¯ã»ã«ãé¸æããUSDTã§è³¼å¥ãã¾ããããé åããPPï¼ããããã¤ã³ãï¼ãåç©«ã§ãã¾ããä»ãã¬ã¤ã¤ã¼ã®é åããã¬ãã¢ã ä»ãã§ä¹ã£åããã¨ãå¯è½ã§ãï¼',
    help_cantina: 'ã«ã³ãã£ã¼ã',
    help_cantina_body: 'PvPããã«ã¢ãªã¼ãï¼ã«ã³ãã£ã¼ãã§ä»ãã¬ã¤ã¤ã¼ã¨æ¦ããã·ã§ããã§ããã«ã¢ã¤ãã ãè³¼å¥ããå ±é¬ãç²å¾ãã¾ããããã·ã¼ã«ãã§é åãå®ããæ­¦å¨ã§æ»æãã¾ãããã',
    help_base: 'ãã¤ãã¼ã¹',
    help_base_body: 'ããªãã®å¸ä»¤é¨ã§ããé åçµ±è¨ã®ç¢ºèªãPPåç©«ãã¤ã³ãã³ããªç®¡çãã³ã¹ã¡ãã£ãã¯è£åãã»ã¯ã¿ã¼ç·ç£ãªãã¬ããã³ã¹æ©è½ãå©ç¨ã§ãã¾ãã',
    help_harvest: 'PPåç©«',
    help_harvest_body: 'é åã¯æéçµéã§PPãçæãã¾ããHARVESTãã¿ãããã¦åéãã¾ããããPPã¯USDTã«å¤æããããã¢ã¤ãã è³¼å¥ã«ä½¿ãã¾ããå¤©åãã¹ã¿ã¼ãªã³ã¯ãã¼ã¹ãã§åç©«çã¢ããï¼',
    help_governance: 'ã¬ããã³ã¹',
    help_governance_body: 'ã»ã¯ã¿ã¼ã§æå¤ãã¯ã»ã«ãææããã¨ç·ç£ã«ãªãã¾ãï¼ç·ç£ã¯ç¨çè¨­å®ï¼ã»ã¯ã¿ã¼åå¨åå¼ããPPåçï¼ãåç¥æç¨¿ãã»ã¯ã¿ã¼å¨ä½ããçºåãå¯è½ã§ãã',
    help_referral: 'ç´¹ä»ãã­ã°ã©ã ',
    help_referral_body: 'ç´¹ä»ã³ã¼ããåéã«å±æãã¾ããããåéãå¥éã»ã·ã§ããè³¼å¥ã»ã¹ã¯ããã»ã«ã³ãã£ãããã¬ã¤ããã¨ã³ããã·ã§ã³ãç²å¾ â 3æ®µé: Tier 1: 15%, Tier 2: 10%, Tier 3: 5%ã',
    help_currency: 'PP & USDT',
    help_currency_body: 'USDT: é åè³¼å¥ã»ä¹ã£åãã«ä½¿ç¨ããã¹ãã¼ãã«ã³ã¤ã³ãã¦ã©ã¬ããããå¥éã\nPPï¼ããããã¤ã³ãï¼: é ååç©«ã§ç²å¾ããã²ã¼ã åéè²¨ãUSDTã«å¤æãã¢ã¤ãã ã»ã³ã¹ã¡ãã£ãã¯è³¼å¥ã«ä½¿ç¨ã',
    help_weather: 'å¤©åã¤ãã³ã',
    help_weather_body: 'ç«æã®å¤©åãã²ã¼ã ã«å½±é¿ï¼ç åµï¼é²å¾¡âæ¡æâãå¤ªé½ãã¬ã¢ï¼æ¡æ2åãã·ã¼ã«ãâãæµæç¾¤ï¼ãã¼ãã¹PPãã­ããããã¹ãããã«ï¼ã¯ã¬ã¼ã ã³ã¹ãâæ»æâã',
    help_about: 'OCCUPY MARSã«ã¤ãã¦',
    help_about_body: 'Occupy Marsã¯ç«æä¸ã®ãã­ãã¯ãã§ã¼ã³é åã²ã¼ã ã§ãï¼',
    help_game_crash: 'CRASH',
    help_game_crash_body: 'ã­ã±ãããçºå°ããåçãä¸æï¼ççºåã«ã­ã£ãã·ã¥ã¢ã¦ãããããé·ãå¾ã¤ã»ã©å ±é¬ã¯å¤§ããããã­ã£ãã·ã¥ã¢ã¦ãåã«ççºããã¨å¨é¡å¤±ããPPã§ãããã',
    help_game_mines: 'MINES',
    help_game_mines_body: '5x5ã°ãªããã«å®ç³ã¨å°é·ãé ããã¦ãããå°é·æ°ãé¸æï¼å¤ãã»ã©åçâï¼ãã¿ã¤ã«ã1ã¤ãã¤éããã â å®ç³ãã¨ã«éå½å¢å ãå°é·ãè¸ãã ãçµäºï¼ãã¤ã§ãã­ã£ãã·ã¥ã¢ã¦ãå¯è½ã',
    help_game_sandstorm: 'COINFLIP',
    help_game_sandstorm_body: 'ç«æé¢¨ã³ã¤ã³ãã¹ï¼DUSTãSTORMãé¸ãã§ããããå½ããã°1.96åãã·ã³ãã«ã§éã50/50ã²ã¼ã ã',
    help_game_meteorite: 'DICE',
    help_game_meteorite_body: 'ãµã¤ã³ã­ãæ¯ããï¼ç®æ¨ç¯å²ãè¨­å®ï¼ç­ãã»ã©åçâï¼ãçµæãç¯å²åãªãåå©ããªã¹ã¯ã¨å ±é¬ãå¥½ã¿ã«èª¿æ´ã',
    help_game_hilo: 'HI-LO',
    help_game_hilo_body: 'ã«ã¼ãã1æå¬éãæ¬¡ã®ã«ã¼ããé«ããä½ããå½ã¦ãããæ­£è§£ãã¨ã«åçä¸æããã¤ã§ãã­ã£ãã·ã¥ã¢ã¦ãå¯è½ãã¾ãã¯å¤§ããªå ±é¬ãçã£ã¦ç¶è¡ï¼ä¸æ­£è§£ã§å¨é¡å¤±ãã',
    lore_era: 'é ããªãæªæ¥ãããé ããªãææã§...',
    lore_title: 'OCCUPY MARS',
    lore_body: '<p><span class="lore-highlight">2157å¹´</span>ãå°çã¯æ­»ã«ããã¦ãããæµ·é¢ä¸æãåå¤§ãªæ²¿å²¸é½å¸ãé£²ã¿è¾¼ãã ãå¤§æ°ãã®ãã®ãæ¯ã¨åããã70åã®é­ãããã¯ãå½¼ããæã¾ãªãä¸çã«ããã¿ã¤ãã¦ããã</p><p>ãããäººé¡ã¯éãã«éã«æ¶ãããã¨ãæãã ã</p><p><span class="lore-highlight">ã¢ã¬ã¹ã»ã¤ãã·ã¢ãã</span> â çµ¶æçãªæå¾ã®ããã·ã§ã³ â ãèµ¤ãææã¸æ¤æ°è¹å£ãçºé²ããããå®å®ã®èç©ºãæ¸¡ãéé·ãª3å¹´éã®å¾ãçå­èãã¡ã¯<span class="lore-red">ç«æ</span>ã«çé¸ããã</p><p>æ¥½åã¯ãªãã£ããèµ¤ãç å¡µãåã¦ã¤ãé¢¨ãæã¦ããªãéå¯ã ããã ãäºæ³å¤ã®ãã®ãçºè¦ããï¼ç«æã®å°è¡¨æ·±ãã«åã¾ã<span class="lore-cyan">å¸å°é±ç©ã®é±è</span> â æ°ææãç¯ãã...ç ´å£ãããã®åãæã¤è³æºã</p><p>ä»ãå¢åãçç´ã®èéã§æ¦äºãç¹°ãåºããã<span class="lore-highlight">ã»ã¯ã¿ã¼ç·ç£</span>ãéæ³ã§é åãæ¯éãããç¥å¥ªèãç åµã«ç´ãã¦é åã<span class="lore-red">ãã¤ã¸ã£ãã¯</span>ãããè£çµ¦ã­ã±ãããè²´éãªç©è·ã¨å±ã«å¢è½ããæãéãèã ããæ¦å©åãæã«ããã</p><p>ããã«æ³ã¯ãªããæ¿åºããªããæå©ãæ¥ãªãã<br>ããã®ã¯<span class="lore-red">ç«æ</span>ã ããããã¦ããã<span class="lore-highlight">å é </span>ããåæ°ãæã¤èãã¡ã</p>',
    lore_tagline: 'ãåã®é åããåã®ã«ã¼ã«ããåã®ææã',
    lore_close: 'ç«æã¸çªå¥',
    // ââ BASE tab labels ââ
    base_tab_territory: 'ãã¤é å', base_tab_sectors: 'ã»ã¯ã¿ã¼', base_tab_season: 'ã·ã¼ãºã³',
    base_tab_mining: 'â è³æºåºèª', base_tab_quests: 'ã¯ã¨ã¹ã', base_tab_ops: 'ä½æ¦ã³ã³ã½ã¼ã«',
    base_tab_shop: 'ã·ã§ãã', base_tab_market: 'ãã¼ã±ãã', base_tab_guild: 'ã®ã«ã', base_tab_govern: 'ã¬ããã³ã¹',
    base_tab_transport: 'è¼¸é', base_tab_quests_full: 'ã­ã£ã³ãã¼ã³/ã¯ã¨ã¹ã',
    bcat_territory: 'é å', bcat_fleet: 'è¦é', bcat_economy: 'çµæ¸', bcat_mission: 'ããã·ã§ã³', bcat_community: 'ã³ãã¥ããã£',
    fcmd_open_shipyard_short: 'é è¹æ', fcmd_my_fleets_short: 'è¦éç®¡ç', fcmd_mining_short: 'è³æºåºèª', mining_ops_title: 'è³æºåºèª', mining_ops_desc: 'è¦éãéã£ã¦GPÂ·ç´ æãå¥æ â é åä¸è¦ã', mining_ops_btn: 'â åºèª', fcmd_tactical_lab: 'æ¦è¡ã©ã', fcmd_tactical_lab_short: 'æ¦è¡ã©ã', fcmd_ace_mode_short: 'ã¨ã¼ã¹ã¢ã¼ã',
    fleet_status_label: 'è¦éç¶æ³', fleet_world_events: 'ã¢ã¯ãã£ãã¤ãã³ã', btn_refresh: 'â» æ´æ°',
    hijack_no_fleet_auto_win: 'æµè¦éãªã â èªååå©ï¼å³æé åç§»è»¢ï¼',
    hijack_fleet_info_fail: 'æµè¦éæå ±ã®èª­ã¿è¾¼ã¿å¤±æ',
    // ââ ã¸ã§ãã·ã¹ãã  ââ
    job_label: 'ã¸ã§ã', job_none: 'éå½ãé¸ãã§ãã ãã', job_locked: 'Lv.{n}ã§è§£æ¾',
    job_choose_btn: 'é¸æ â¶', job_change_btn: 'ã¸ã§ãå¤æ´',
    job_cooldown: '{t}ä»¥éã«å¤æ´å¯è½', job_free_change: 'ç¡æå¤æ´ {n}åæ®ã',
    job_paid_change: 'å¤æ´ã³ã¹ã: {n} GP', job_current: 'ç¾å¨ã®ã¸ã§ã',
    job_modal_title: 'éå½ãé¸ãã§ãã ãã', job_modal_sub: 'ãã¬ã¤ã¹ã¿ã¤ã«ã«åã£ãå°éè·ãé¸æãã¦ãã ãã',
    job_modal_cancel: 'å¾ã§', job_modal_confirm: 'é¸æãç¢ºå®',
    job_modal_free: 'ç¡æå¤æ´ â ä»é±ãã¨{n}å',
    job_modal_paid: '{n} GPæ¶è²»ï¼ä»é±ã®ç¡æå¤æ´ä½¿ç¨æ¸ã¿ï¼',
    job_modal_cooldown_warn: 'ã¸ã§ãå¤æ´ã¯ã¼ã«ãã¦ã³ä¸­',
    job_selected_toast: 'ã¸ã§ãé¸æ: {n}',
    // ââ ãã¼ã±ãããã¬ã¤ã¹ ââ
    mkt_browse: 'ðª é²è¦§', mkt_sell: 'ð° åºå', mkt_my_listings: 'ð ãã¤åºå',
    mkt_sort_newest: 'æ°çé ', mkt_sort_cheap: 'å®ãé ', mkt_sort_expensive: 'é«ãé ', mkt_sort_ending: 'çµäºéè¿',
    mkt_loading: 'ãã¼ã±ããèª­è¾¼ä¸­...', mkt_empty: 'åºåãããã¾ãã',
    mkt_recent_sales: 'ð æè¿ã®åå¼', mkt_no_sales: 'æè¿ã®åå¼ã¯ããã¾ãã',
    notif_title: 'ð éç¥', notif_read_all: 'ãã¹ã¦æ¢èª­',
    notif_loading: 'èª­è¾¼ä¸­...', notif_empty: 'éç¥ã¯ããã¾ãã',
    gp_activity_title: 'GP å±¥æ­´', gp_activity_login: 'ã­ã°ã¤ã³ãã¦ç¢ºèªãã¦ãã ããã', gp_activity_empty: 'GPæ´»åå±¥æ­´ãããã¾ããã',
    gp_send_title: 'ð¸ GPéä¿¡', gp_send_subtitle: 'ä»ã®ãã¬ã¤ã¤ã¼ã«GPãéã', gp_send_btn: 'éä¿¡',
    gp_send_no_recipient: 'ååäººã®ã¦ã©ã¬ããã¾ãã¯ããã¯ãã¼ã ãå¥å', gp_send_invalid_amount: 'æå¹ãªéé¡ãå¥åãã¦ãã ãã',
    gp_send_amount_label: 'éé¡', gp_transfer_history: 'éä¿¡å±¥æ­´', gp_transfer_empty: 'éä¿¡å±¥æ­´ãããã¾ããã',
    career_stats_title: 'ð ã­ã£ãªã¢çµ±è¨', cat_naval: 'æµ·æ¦åå©', cat_enhance: 'å¼·åè©¦è¡', cat_ships: 'å»ºé è¦æ°', cat_trades: 'åå¼æ°',
    mkt_buy: 'è³¼å¥', mkt_cancel: 'ã­ã£ã³ã»ã«', mkt_list_sell: 'åºå',
    mkt_buy_title: 'ã¢ã¤ãã è³¼å¥', mkt_price: 'ä¾¡æ ¼', mkt_your_balance: 'æ®é«',
    mkt_buy_confirm: 'ä»ããè³¼å¥', mkt_bought: 'è³¼å¥æåï¼',
    mkt_cancel_title: 'åºåã­ã£ã³ã»ã«', mkt_cancel_body: 'åºåãã­ã£ã³ã»ã«ãã¦ã¢ã¤ãã ãè¿å´ãã¾ããï¼',
    mkt_cancel_confirm: 'åºåã­ã£ã³ã»ã«', mkt_cancelled: 'åºåãã­ã£ã³ã»ã«ããã¾ãã',
    mkt_list_title: 'åºåãã', mkt_list_confirm: 'åºåãã',
    mkt_fee_note: 'åºåæ: 2 GP Â· è²©å£²ææ°æ: 5%', mkt_listed: 'ãã¼ã±ããã«åºåãã¾ããï¼', mkt_listed_territory: 'é åããã¼ã±ããã«åºåãã¾ããï¼',
    mkt_sellable_items: 'åºåå¯è½ã¢ã¤ãã ', mkt_no_items: 'åºåã§ããã¢ã¤ãã ãããã¾ãããã·ã§ããâãã¤ã¢ã¤ãã ã§ã³ã¹ã¡ãå¤æãã¦ãã ããã',
    mkt_sellable_terr: 'ãã¤é å', mkt_no_territories: 'ææãã¦ããé åãããã¾ããã',
    mkt_no_listings: 'åºåãããã¾ãã',
    // ââ AUCTION section ââ
    mkt_auction: 'ð¨ ãªã¼ã¯ã·ã§ã³',
    auc_none: 'ã¢ã¯ãã£ããªãªã¼ã¯ã·ã§ã³ã¯ããã¾ãã', auc_ended: 'çµäº', auc_current_bid: 'ç¾å¨ã®å¥æ­',
    auc_buyout: 'å³æ±º', auc_bid: 'å¥æ­', auc_buy_now: 'å³æ±º', auc_cancel: 'ã­ã£ã³ã»ã«',
    auc_bid_title: 'å¥æ­ãã', auc_min_bid: 'æä½å¥æ­é¡', auc_your_bid: 'å¥æ­é¡',
    auc_confirm_bid: 'å¥æ­ãã', auc_too_low: 'å¥æ­ã¯æä½ã§ã',
    auc_bid_placed: 'å¥æ­å®äºï¼', auc_buyout_title: 'å³æ±ºè³¼å¥',
    auc_buyout_confirm: 'å³æ±ºä¾¡æ ¼ã§ãã®ã¢ã¤ãã ãè³¼å¥ãã¾ããï¼',
    auc_confirm_buyout: 'å³æ±ºè³¼å¥', auc_bought: 'è³¼å¥å®äºï¼',
    auc_cancel_title: 'ãªã¼ã¯ã·ã§ã³ã­ã£ã³ã»ã«',
    auc_cancel_confirm: 'ãã®ãªã¼ã¯ã·ã§ã³ãã­ã£ã³ã»ã«ãã¾ããï¼ï¼å¥æ­ãªãã®å ´åã®ã¿ï¼',
    auc_confirm_cancel: 'ã­ã£ã³ã»ã«', auc_cancelled: 'ãªã¼ã¯ã·ã§ã³ãã­ã£ã³ã»ã«ããã¾ãã',
    // ââ TERRITORY VISUAL section ââ
    terr_sell_btn: 'ð° å£²ã', terr_for_sale: 'ð° åºåä¸­', terr_auction_label: 'ð¨ ç«¶å£²ä¸­',
    // ââ RESOURCE section ââ
    res_section_title: 'é±ç©è³æº',
    res_empty: 'ã¾ã è³æºãããã¾ãããé åããã¼ãã¹ããã¦é±ç©ãè¦ã¤ãããï¼',
    res_sell: 'å£²ã',
    res_sell_title: 'è³æºãå£²ã',
    // ââ SEASON tab ââ
    season_no_active: 'é²è¡ä¸­ã®ã·ã¼ãºã³ãªã',
    season_check_back: 'æ¬¡ã®ã·ã¼ãºã³ããå¾ã¡ãã ããï¼',
    season_activities_placeholder: 'ã·ã¼ãºã³ãå§ã¾ãã¨ããã«ã¢ã¯ãã£ããã£ãè¡¨ç¤ºããã¾ãã',
    season_how_to_earn: 'ãã¤ã³ãç²å¾æ¹æ³',
    season_rewards_title: 'ã·ã¼ãºã³å ±é¬',
    season_reward_1st: '<b>ã«ãã´ãªå¥1ä½</b>ï¼GP + XP + ã¢ã¤ãã  + ç§°å·',
    season_reward_top3: '<b>ããã3</b>ï¼GP + ã¢ã¤ãã ',
    season_reward_top10: '<b>ããã10</b>ï¼GP',
    season_reward_overall: 'ç·å1ä½ã¯ã¬ã¢ãª<span style="color:var(--gold)">PP</span>ãç²å¾ï¼',
    season_reward_multi: '<b>è¤æ°ã«ãã´ãª</b>ã§åæã«å ±é¬ãç²å¾ã§ãã¾ãï¼',
    season_rewards_blurb: 'ð¥ <b>ã«ãã´ãªå¥1ä½</b>ï¼GP + XP + ã¢ã¤ãã  + ç§°å·<br>ð¥ <b>ããã3</b>ï¼GP + ã¢ã¤ãã <br>ð¥ <b>ããã10</b>ï¼GP<br>ð ç·å1ä½ã¯ã¬ã¢ãª<span style="color:var(--gold)">PP</span>ãç²å¾ï¼<br>â¡ <b>è¤æ°ã«ãã´ãª</b>ã§åæã«å ±é¬ãç²å¾ã§ãã¾ãï¼',
    season_my_rank: 'èªåã®ã·ã¼ãºã³é ä½',
    season_pts_suffix: 'pts',
    season_leaderboard: 'ã·ã¼ãºã³ãªã¼ãã¼ãã¼ã',
    season_refresh: 'â» æ´æ°',
    season_loading: 'èª­è¾¼ä¸­...',
    season_no_scores: 'ã¾ã ã·ã¼ãºã³ã¹ã³ã¢ãããã¾ãã',
    season_your_rewards: 'ð ç²å¾å ±é¬',
    season_pass_tip: 'ãã¬ã¤ã§XPç²å¾ï¼ã¯ã¬ã¼ã ãæ¡æãä¾µæ»ãæ¢ç´¢ãã¯ã¨ã¹ãï¼ããã£ã¢ãä¸ãã¦å ±é¬ãã²ããï¼ãã¬ãã¢ã ãã¹ã§å ±é¬2åï¼',
    season_pass_buy_title: 'ãã¬ãã¢ã ãã¹',
    season_pass_buy_body: 'ä»ã·ã¼ãºã³ã®ãã¬ãã¢ã å ±é¬ãã©ãã¯ãè§£æ¾ãã¾ããå¨ãã£ã¢ã§2åå ±é¬ï¼',
    season_pass_cost_label: 'è²»ç¨',
    season_pass_balance_label: 'ææGP',
    season_pass_buy_confirm: 'è³¼å¥ãã',
    season_categories_title: 'ä»ã·ã¼ãºã³ã®ã©ã³ã­ã³ã°é¨é',
    season_default_desc: 'ãªã¼ãã¼ãã¼ãã®é ç¹ãç®æãã¾ãããï¼',
    season_ending_soon: 'ã·ã¼ãºã³çµäºéè¿ï¼',
    season_ended: 'çµäº',
    season_days_remaining: 'æ®ã{d}æ¥{h}æé',
    season_rank_suffix: 'é ä½',
    season_claim_btn: 'åå',
    season_claim_success: '{amount} {type}ãåãåãã¾ããï¼',
    season_claim_failed: 'ååã«å¤±æãã¾ãã',
    season_theme_volcanic: 'ç«å±±ã®å¤æã',
    season_theme_ice_age: 'æ°·æ²³æ',
    season_theme_solar_storm: 'å¤ªé½åµ',
    season_theme_dust_epoch: 'å¡µã®æä»£',
    season_theme_volcanic_desc: 'ç«æå¨ä½ã§ç«å±±æ´»åãæ´»çºåããã¤ãã³ã°éã¯å¢å ãã¾ããã·ã¼ã«ããå¼±ä½åï¼',
    season_theme_ice_age_desc: 'ååãåºããã¾ããå¯ãã§ãã¤ãã³ã°ã¯éããªãã¾ããé²å¾¡ã¯å¼·åºã',
    season_theme_solar_storm_desc: 'å¤ªé½æ¾å°ãå°è¡¨ãè¦ãã¾ãããã¤ãã³ã°æå¤§ãã·ã¼ã«ãã¯é«éã§å´©å£ï¼',
    season_theme_dust_epoch_desc: 'å·¨å¤§ãªç åµãå¹ãèãã¾ããè¦çã¯æªåãã¾ããéç³ããµãã©ã¤ãºãéã³ã¾ãã',
    // ââ Season categories ââ
    season_cat_overall: 'ç·åãã£ã³ããªã³', season_cat_overall_d: 'å¨æ´»åã§æé«ç·åã¹ã³ã¢ãç²å¾',
    season_cat_territory: 'ããªããªã¼ã­ã³ã°', season_cat_territory_d: 'ç«æã§æãå¤ãã®ãã¯ã»ã«ãå é ',
    season_cat_mining: 'ãã¤ãã³ã°ãã¹ã¿ã¼', season_cat_mining_d: 'ããªããªã¼ããæãå¤ãè³æºãåç©«',
    season_cat_combat: 'æ¦éã¬ã¸ã§ã³ã', season_cat_combat_d: 'ãã¤ã¸ã£ãã¯ããã«ã§æå¤åå©',
    season_cat_defender: 'ä¸å±ã®ãã¡ã¤ã¿ã¼', season_cat_defender_d: 'ããªããªã¼ã¸ã®æ»æãæãå¤ãèãæã',
    season_cat_explorer: 'ã¨ãªã¼ãæ¢æ¤å®¶', season_cat_explorer_d: 'ã°ã­ã¼ãä¸ã§POIãã¼ã«ã¼ãæå¤çºè¦',
    season_cat_active: 'æå¤ã¢ã¯ãã£ã', season_cat_active_d: 'æãå¤ãã¯ãªãã¯ï¼ã¿ãã â ãã¬ã¤ããã ãï¼',
    season_cat_shopper: 'ã¢ã¤ãã ãã¹ã¿ã¼', season_cat_shopper_d: 'ã·ã§ããã§ã¢ã¤ãã ãæå¤è³¼å¥ï¼ä½¿ç¨',
    season_cat_quester: 'ã¯ã¨ã¹ããã¼ã­ã¼', season_cat_quester_d: 'ãã¤ãªã¼ããã·ã§ã³ãæå¤å®äº',
    season_cat_big_spender: 'ããã°ã¹ãã³ãã¼', season_cat_big_spender_d: 'ã¢ã¤ãã ã»ãã¤ã¸ã£ãã¯ã»ã¢ããã°ã¬ã¼ãã«GPãæå¤æ¶è²»',
    season_cat_investor: 'PPæè³å®¶', season_cat_investor_d: 'ãã¬ãã¢ã æ©è½ã«PPãæå¤æè³',
    season_cat_fortifier: 'è¦å¡ãã«ãã¼', season_cat_fortifier_d: 'ããªããªã¼ã«ã·ã¼ã«ããæå¤è¨­ç½®',
    season_cat_wanderer: 'ã»ã¯ã¿ã¼æ¾æµªè', season_cat_wanderer_d: 'æãå¤ãã®ç°ãªãã»ã¯ã¿ã¼ãæ¢æ¤ï¼è¨ªå',
    season_cat_dedicated: 'æãå¤å', season_cat_dedicated_d: 'æ¯æ¥ã­ã°ã¤ã³ â ç¶ç¶ãéµï¼',
    season_cat_fashionista: 'ç«æãã¡ãã·ã§ãã¹ã¿', season_cat_fashionista_d: 'ããªããªã¼ã«ã³ã¹ã¡ãã£ãã¯ãæå¤è£å',
    season_cat_gambler: 'ã«ã³ãã£ãå¸¸é£', season_cat_gambler_d: 'ã«ã³ãã£ãã§ããã²ã¼ã ãæå¤ãã¬ã¤',
    season_cat_team_player: 'ãã¼ã ãã¬ã¤ã¤ã¼', season_cat_team_player_d: 'ã®ã«ãæ´»åã«æãå¤ãè²¢ç®',
    season_cat_recruiter: 'ããããªã¯ã«ã¼ã¿ã¼', season_cat_recruiter_d: 'ç´¹ä»ã§æ°ãã¬ã¤ã¤ã¼ãæå¤æå¾',
    season_cat_social: 'ã½ã¼ã·ã£ã«ãã¿ãã©ã¤', season_cat_social_d: 'ä»ãã¬ã¤ã¤ã¼ã«ãã£ããã¡ãã»ã¼ã¸ãæå¤éä¿¡',
    season_cat_earner: 'GPå¤§ç©', season_cat_earner_d: 'å¨ã½ã¼ã¹åç®ã§GPãæå¤ç²å¾',
    season_cat_whale: 'PPãã¨ã¼ã«', season_cat_whale_d: 'ãã¤ãã³ã°ã¨çºè¦ã§PPãæå¤ç²å¾',
    season_cat_loser: 'è«¦ããªã', season_cat_loser_d: 'ãã¤ã¸ã£ãã¯ã§ãã¯ã»ã«ãå¤±ã£ãï¼åæãç¶ãããï¼',
    season_cat_streaker: 'é£ç¶è¨é²ç', season_cat_streaker_d: 'æé·ãã¤ãªã¼ã­ã°ã¤ã³é£ç¶è¨é²ãç¶­æ',
    season_cat_astronaut: 'ã­ã±ããã©ã¤ãã¼', season_cat_astronaut_d: 'ã­ã±ããè£çµ¦æä¸ã§æ¦å©åãæå¤ç²å¾',
    season_cat_weatherman: 'ã¹ãã¼ã ãã§ã¤ãµã¼', season_cat_weatherman_d: 'ç«æå¤©æ°äºå ±ãé »ç¹ã«ãã§ãã¯',
    season_cat_namer: 'ãã¼ã ã¢ã¼ãã£ã¹ã', season_cat_namer_d: 'ããªããªã¼åãæå¤å¤æ´',
    season_cat_influencer: 'ç«æã¤ã³ãã«ã¨ã³ãµã¼', season_cat_influencer_d: 'æ¦ç¸¾ã¨ããªããªã¼ãæå¤å±æ',
    // ââ QUESTS tab ââ
    quests_loading: 'ã¯ã¨ã¹ããèª­è¾¼ä¸­...',
    achievements_title: 'å®ç¸¾', achievements_loading: 'å®ç¸¾ãèª­è¾¼ä¸­...',
    news_title: 'ææãã¥ã¼ã¹',
    lottery_title: 'GPå®ãã', lottery_disabled: 'å®ããç¡å¹', lottery_round: 'ã©ã¦ã³ã', lottery_ends: 'çµäºã¾ã§', lottery_recent_winners: 'æè¿ã®å½é¸è',
    staking_title: 'GPã¹ãã¼ã­ã³ã°', staking_stake_btn: 'ð ã¹ãã¼ã¯', staking_confirm_title: 'GPã¹ãã¼ã­ã³ã°', staking_confirm_btn: 'ã¹ãã¼ã¯', staking_withdraw_title: 'å¼ãåºã', staking_withdraw_btn: 'å¼ãåºã',
    burn_title: 'GPç¼å´',
    weekly_title: 'ã¦ã£ã¼ã¯ãªã¼ãã£ã¬ã³ã¸',
    shield_title: 'é åã·ã¼ã«ã', shield_activate_btn: 'ã·ã¼ã«ãèµ·å',
    bounty_title: 'è³éãã¼ã', bounty_post_btn: '+ è³éãæ²ç¤º', bounty_tab_active: 'ã¢ã¯ãã£ã', bounty_tab_mine: 'ãã¤è³é', bounty_tab_onme: 'èªåã¸ã®', bounty_modal_title: 'è³éãæ²ç¤º', bounty_modal_sub: 'æåã«é åãå é ãããã¬ã¤ã¤ã¼ã¸ã®å ±é¬', bounty_target_label: 'ã¿ã¼ã²ãã', bounty_amount_label: 'GPå ±é¬', bounty_msg_label: 'æçºã¡ãã»ã¼ã¸', bounty_post_submit: 'ð¯ è³éãæ²ç¤º',
    upgrades_title: 'é åå¼·å', upgrades_upgrade_btn: 'é åãå¼·å',
    monuments_title: 'è¨å¿µç¢', monument_place_title: 'è¨å¿µç¢ãè¨­ç½®', monument_place_btn: 'è¨å¿µç¢ãè¨­ç½®', monument_territory: 'é å', monument_type: 'ã¿ã¤ã', monument_name_label: 'è¨å¿µç¢å', monument_inscription: 'éæ', monument_cost: 'ã³ã¹ã',
    base_craft_btn: 'âï¸ è£½ä½', craft_cat_all: 'å¨ã¦', craft_cat_general: 'ä¸è¬', craft_cat_elite: 'é«ç´', craft_cat_seasonal: 'ã·ã¼ãºã³', craft_cat_event: 'ã¤ãã³ã', craft_btn: 'âï¸ è£½ä½', craft_history_btn: 'ð è£½ä½å±¥æ­´', craft_no_recipes: 'ã¬ã·ããªã', craft_load_fail: 'ã¬ã·ãèª­è¾¼å¤±æ', craft_no_history: 'è£½ä½å±¥æ­´ãªã', craft_success: 'è£½ä½æåï¼', craft_fail: 'è£½ä½å¤±æ', craft_refund_partial: 'GPä¸é¨è¿é', craft_confirm_title: 'è£½ä½ç¢ºèª', craft_missing_ingredients: 'ç´ æä¸è¶³',
    contest_title: 'ãã¯ã»ã«ã¢ã¼ãã³ã³ãã¹ã', contest_none: 'ã³ã³ãã¹ããªããå¾ã§ã¾ãç¢ºèªãã¦ãã ããï¼', contest_view_btn: 'ð ä½åãè¦ã', contest_submit_btn: 'âï¸ æåº', contest_vote_btn: 'ð³ï¸ æç¥¨', contest_title_prompt: 'ä½åã¿ã¤ãã«:', contest_image_prompt: 'ç»åURLï¼ä»»æï¼:', contest_desc_prompt: 'ç°¡åãªèª¬æï¼ä»»æï¼:',
    rental_title: 'é åã¬ã³ã¿ã«', rental_tab_browse: 'åç§', rental_tab_my: 'ãã¤ã¬ã³ã¿ã«', rental_list_btn: '+ é åç»é²', rental_rent_btn: 'ðï¸ è³å', rental_cancel_btn: 'ç»é²åæ¶', rental_no_listings: 'ã¬ã³ã¿ã«å¯è½ãªé åãªã', rental_no_my: 'ã¬ã³ã¿ã«æ´»åãªã', rental_no_territories: 'ç»é²ããé åãªã', rental_cancelled: 'ç»é²åæ¶æ¸', rental_gp_prompt: 'æéãããGP:',
    duel_title: 'GPæ±ºé', duel_challenge_btn: 'âï¸ ææ¦', duel_tab_pending: 'åãåã£ãææ¦', duel_tab_my: 'ãã¤æ±ºé', duel_tab_recent: 'ãªã¼ãã¼ãã¼ã', duel_modal_title: 'æ±ºéã«æã', duel_modal_sub: 'åèããããç²å¾ï¼5%ææ°æï¼', duel_target_label: 'ç¸æã®ã¦ã©ã¬ãã/ããã¯ãã¼ã ', duel_wager_label: 'è³­ãéï¼GPï¼', duel_challenge_submit: 'âï¸ ææ¦ç¶ãéã', duel_accept_btn: 'âï¸ åãå¥ãã', duel_decline_btn: 'â æ­ã', duel_cancel_btn: 'ã­ã£ã³ã»ã«', duel_no_pending: 'åãåã£ãææ¦ãªã', duel_no_history: 'æ±ºéå±¥æ­´ãªã', duel_no_recent: 'æè¿ã®æ±ºéãªã', duel_accept_confirm: 'ææ¦ãåãå¥ãã¦GPãè³­ãã¾ããï¼', duel_decline_confirm: 'ãã®æ±ºéææ¦ãæ­ãã¾ããï¼', duel_cancelled_refund: 'æ±ºéã­ã£ã³ã»ã«ãGPãè¿éããã¾ããã', duel_challenge_sent: 'âï¸ ææ¦ç¶éä¿¡ï¼ç¸æã30åä»¥åã«åãå¥ããå¿è¦ãããã¾ãã', duel_enter_target: 'ç¸æã®ã¦ã©ã¬ããã¾ãã¯ããã¯ãã¼ã ãå¥å', duel_enter_wager: 'æå¹ãªè³­ãéãå¥åãã¦ãã ãã',
    alliance_title: 'åç', alliance_members: 'ã¡ã³ãã¼', alliance_treasury: 'éåº«', alliance_defense: 'é²è¡ãã¼ãã¹', alliance_join_btn: 'åå ', alliance_join_confirm: 'åçã«åå ãã¾ããï¼', alliance_leave_btn: 'ðª è±é', alliance_leave_title: 'åçãè±éï¼', alliance_leave_confirm: 'åçããåé¤ããã¾ãã', alliance_deposit_btn: 'ð° å¥é', alliance_withdraw_btn: 'ð¤ åºé', alliance_deposit_prompt: 'å¥éããGPé¡:', alliance_withdraw_prompt: 'éåº«ããåºéï¼ææ°æããï¼:', alliance_withdraw_note_prompt: 'ã¡ã¢ï¼ä»»æï¼:', alliance_create_title: 'åççµæ', alliance_create_btn: 'ð¡ï¸ åçãçµæ', alliance_browse_title: 'åçä¸è¦§', alliance_browse_hint: 'æ¤ç´¢ã¾ãã¯ã¹ã¯ã­ã¼ã«ãã¦åçãæ¢ã',
    base_lucky_btn: 'ð¦ ã¯ã¬ã¼ã', lucky_box_open_btn: 'ð éãã', lucky_box_recent_title: 'ð æè¿ã®ãªã¼ãã³', lucky_box_my_history: 'ð ãã¤å±¥æ­´', lucky_box_confirm_title: 'ã¯ã¬ã¼ããéãï¼',
    base_vip_btn: 'ð« VIP', vip_buy_btn: 'ð« VIPåå¾', vip_status_active: 'VIPæå¹', vip_expires: 'æå¹æé', vip_purchase_title: 'VIPãã¹è³¼å¥ï¼', vip_confirm: 'VIPè³¼å¥',
    connect_wallet: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦ãã ãã', connect_wallet_first: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦ãã ãã', err_connect_wallet: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦ãã ãã', err_network: 'ãããã¯ã¼ã¯ã¨ã©ã¼ãåè©¦è¡ãã¦ãã ããã',
    use_shipyard: 'é è¹æã§è¦è¹ãå»ºé ãã¦ãã ãã', use_fleet_cmd: 'è¦éææ®é¨ãä½¿ç¨ãã¦ãã ãã', gov_battle_use_fleet: 'PVPæ¦éã¯è¦éã·ã¹ãã +Hijackã§è¡ããã¾ãã', gov_battle_use_fleet_hint: 'è¦éã¿ãã§è¦è¹ãå»ºé ããHIJACKãã¿ã³ã§é åãå¥ªåãã¦ãã ããã',
    duel_declined_msg: 'æ±ºéãæ­ãã¾ããã',
    expedition_title: 'é å¾', expedition_returns: 'å¸°é', expedition_cancel_btn: 'ã­ã£ã³ã»ã«', expedition_launch_btn: 'ð é å¾éå§', expedition_history_btn: 'ð é å¾ã­ã°', expedition_select_claim: 'é åã¨ã¿ã¤ããé¸æ', expedition_launch_confirm: 'é å¾éå§ï¼', expedition_cancel_confirm: 'é å¾ã­ã£ã³ã»ã«ï¼',
    branding_title: 'é åãã©ã³ãã£ã³ã°', branding_select_territory: 'ãã©ã³ãã£ã³ã°ããé åãé¸æ:', branding_name_label: 'é åå', branding_tagline_label: 'ã¿ã°ã©ã¤ã³', branding_color_label: 'ãã¼ãã«ã©ã¼', branding_set_btn: 'è¨­å®', branding_set_name_title: 'é ååãè¨­å®ï¼', branding_set_tag_title: 'ã¿ã°ã©ã¤ã³ãè¨­å®ï¼', branding_set_color_title: 'ãã¼ãã«ã©ã¼ãè¨­å®ï¼',
    spells_title: 'é åã¹ãã«', spells_select_target: 'å¯¾è±¡é åï¼ã¯ã¬ã¼ã çªå·ãå¥åï¼:', spells_active_label: 'æå¹ãªã¹ãã«:', spells_history_btn: 'ð ã¹ãã«å±¥æ­´', spells_cast_confirm: 'ã¹ãã«çºåï¼',
    tiers_title: 'é åãã£ã¢', tiers_desc: 'é åãã¢ããã°ã¬ã¼ããã¦æ¡æã»ãã¯ã»ã«å®¹éã®æ°¸ç¶ãã¼ãã¹ãç²å¾ã', tiers_my_label: 'ãã¤é å', tiers_table_label: 'ãã£ã¢ç¹å¸', tiers_upgrade_btn: 'â¬ ã¢ããã°ã¬ã¼ã', tiers_none: 'ãã£ã¢æå®é åãªãã', tiers_upgrade_confirm: 'é åãã£ã¢ãã¢ããã°ã¬ã¼ãï¼',
    tournament_title: 'ãã¼ãã¡ã³ã', tournament_none: 'ãªã¼ãã³ãã¼ãã¡ã³ããªã', tournament_join_btn: 'åå ãã', tournament_join_confirm: 'ãã¼ãã¡ã³ãã«åå ï¼', tournament_my_btn: 'ð ãã¤ãã¼ãã¡ã³ã',
    broadcast_title: 'GPãã­ã¼ãã­ã£ã¹ã', broadcast_buy_btn: 'ð¢ ãã­ã¼ãã­ã£ã¹ãè³¼å¥', broadcast_modal_title: 'ð¢ ãã­ã¼ãã­ã£ã¹ãã¡ãã»ã¼ã¸', broadcast_modal_desc: 'é¸æããæéãå¨ãã¬ã¤ã¤ã¼ã«ã¡ãã»ã¼ã¸ãè¡¨ç¤ºããã¾ãã', broadcast_duration_label: 'æé:', broadcast_submit_btn: 'ð¢ ãã­ã¼ãã­ã£ã¹ã', broadcast_confirm_title: 'ãã­ã¼ãã­ã£ã¹ãè³¼å¥ï¼', broadcast_none: 'ç¾å¨ã¢ã¯ãã£ããªãã­ã¼ãã­ã£ã¹ãã¯ããã¾ããã',
    raffle_title: 'GPã©ããã«', raffle_none: 'ãªã¼ãã³ãªã©ããã«ã¯ããã¾ããã', raffle_my_btn: 'ðï¸ ãã¤ãã±ãã', raffle_buy_btn: 'ðï¸ è³¼å¥', raffle_tickets_label: 'ãã±ããæ°:', raffle_buy_confirm: 'ã©ããã«ãã±ãããè³¼å¥ï¼',
    wager_title: 'GPäºæ¸¬ããã', wager_none: 'ã¢ã¯ãã£ããªããããã¼ã«ãªãã', wager_my_btn: 'ð¯ ãã¤ããã', wager_bet_btn: 'ð¯ ããã', wager_target_label: 'ãããå¯¾è±¡ï¼ã¦ã©ã¬ãã/ããã¯ãã¼ã ï¼:', wager_amount_label: 'éé¡:', wager_confirm: 'ããããç¢ºå®ï¼',
    tevt_title: 'ããªããªã¼ã¤ãã³ã', tevt_desc: 'GPãä½¿ç¨ãã¦ããªããªã¼ã«æéãã¼ã¹ããæå¹åãã¾ãã', tevt_select_label: 'ã¯ã¬ã¼ã ãé¸æ:', tevt_load_btn: 'â¡ ã¤ãã³ãèª­è¾¼', tevt_active_label: 'ã¢ã¯ãã£ãã¤ãã³ã', tevt_none: 'ã¢ã¯ãã£ããªã¤ãã³ããªãã', tevt_activate_confirm: 'ããªããªã¼ã¤ãã³ããæå¹åï¼',
    prestige_btn: 'â­ ãã¬ã¹ãã¼ã¸', prestige_buy_btn: 'â­ ãã¬ã¹ãã¼ã¸ãã¤ã³ãè³¼å¥', prestige_buy_confirm: 'ãã¬ã¹ãã¼ã¸ãã¤ã³ããè³¼å¥ï¼', prestige_lb_title: 'ð ãã¬ã¹ãã¼ã¸ã©ã³ã­ã³ã°', prestige_lb_none: 'ãã¬ã¹ãã¼ã¸ãã¬ã¤ã¤ã¼ãªãã',
    beacon_title: 'ããããã¼ã³ã³', beacon_desc: 'ä»ã®ãã¬ã¤ã¤ã¼ã«è¦ãããã¼ã³ã³ããããã«è¨­ç½®ãã¾ãã', beacon_icon_label: 'ã¢ã¤ã³ã³', beacon_msg_label: 'ã¡ãã»ã¼ã¸ï¼ä»»æï¼', beacon_x_label: 'X', beacon_y_label: 'Y', beacon_use_plot: 'ð ãã­ãã', beacon_place_btn: 'ð¡ ãã¼ã³ã³è¨­ç½®', beacon_active_label: 'ã¢ã¯ãã£ããã¼ã³ã³', beacon_none: 'ãã¼ã³ã³ãªãã', beacon_place_confirm: 'ããããã¼ã³ã³è¨­ç½®ï¼', beacon_no_plot: 'ã¾ããããã§ãã­ãããé¸æ', beacon_coords_required: 'åº§æ¨ãå¥åãã¦ãã ãã',
    donation_title: 'ã³ã­ãã¼ãã¡ã³ã', donation_amount_label: 'éé¡ï¼GPï¼', donation_msg_label: 'ã¡ãã»ã¼ã¸ï¼ä»»æï¼', donation_donate_btn: 'ðï¸ å¯ä»ãã', donation_none: 'ã¾ã å¯ä»ãªãã', donation_top_btn: 'ð ãããå¯ä»è', donation_top_title: 'ãããå¯ä»è', donation_confirm: 'ã³ã­ãã¼ãã¡ã³ãã«å¯ä»ï¼', donation_min_hint: 'éé¡ãå¥åãã¦ãã ãã',
    poll_title: 'ã³ãã¥ããã£æç¥¨', poll_create_btn: '+ æç¥¨', poll_create_title: 'æç¥¨ä½æ', poll_question_label: 'è³ªå', poll_options_label: 'é¸æè¢', poll_add_option: '+ é¸æè¢è¿½å ', poll_duration_label: 'æéï¼hï¼:', poll_publish_btn: 'ð å¬é', poll_none: 'ç¾å¨é²è¡ä¸­ã®æç¥¨ãªãã', poll_publish_confirm: 'æç¥¨ãå¬éï¼', poll_question_required: 'è³ªåãå¥åãã¦ãã ãã', poll_min_options_hint: 'é¸æè¢2ã¤ä»¥ä¸å¿è¦',
    status_label: 'ð¬ ã¹ãã¼ã¿ã¹ã¡ãã»ã¼ã¸', status_set_btn: 'è¨­å®', status_none: 'ã¢ã¯ãã£ããªã¹ãã¼ã¿ã¹ãªã', status_required: 'ã¹ãã¼ã¿ã¹ãå¥åãã¦ãã ãã', status_set_confirm: 'ã¹ãã¼ã¿ã¹ãè¨­å®ï¼',
    vtag_label: 'ð·ï¸ ãããã£ã¿ã°', vtag_set_btn: 'è¨­å®', vtag_clear_btn: 'â', vtag_none: 'ãããã£ã¿ã°ãªã', vtag_required: 'ã¿ã°ãå¥åãã¦ãã ãã', vtag_set_confirm: 'ãããã£ã¿ã°ãè¨­å®ï¼', vtag_clear_confirm: 'ãããã£ã¿ã°ãåé¤ï¼', vtag_free: 'ç¡æ', vtag_set_success: 'ð·ï¸ ãããã£ã¿ã°è¨­å®ï¼', vtag_cleared: 'ã¿ã°ãåé¤ãã¾ãã', vtag_cost_hint: 'åå: {first} GP Â· å¤æ´: {change} GP', vtag_disabled: 'ãããã£ã¿ã°ç¡å¹',
    tribute_label: 'è´ãç©', tribute_btn: 'ðª è´ã', tribute_modal_title: 'é åã¸ã®è´ãç©', tribute_modal_desc: 'ãã®é åã®ãªã¼ãã¼ã«GPè´ãç©ãéãã¾ã', tribute_amount_label: 'éé¡ (GP)', tribute_msg_label: 'ã¡ãã»ã¼ã¸ï¼ä»»æï¼', tribute_send_btn: 'ðª è´ã', tribute_confirm: 'GPè´ãç©ãéãã¾ããï¼', tribute_sent: 'ðª è´ãç©ãéãã¾ããï¼', tribute_amount_required: 'æå¹ãªGPéé¡ãå¥åãã¦ãã ãã',
    graffiti_label: 'ã°ã©ãã£ãã£', graffiti_btn: 'âï¸ ã°ã©ãã£ãã£', graffiti_modal_title: 'ã°ã©ãã£ãã£ãæã', graffiti_modal_desc: 'ãã®é åã«ã°ã©ãã£ãã£ãæãã¾ã', graffiti_text_label: 'ãã­ã¹ã/çµµæå­ï¼æå¤§30æå­ï¼', graffiti_spray_btn: 'âï¸ æã', graffiti_confirm: 'ã°ã©ãã£ãã£ãæãã¾ããï¼', graffiti_placed: 'âï¸ ã°ã©ãã£ãã£å®äºï¼', graffiti_text_required: 'ãã­ã¹ããå¥åãã¦ãã ãã',
    banner_label: 'åå©ãã©ãã°', banner_btn: 'ð© ãã©ãã°ãç«ã¦ã', banner_modal_title: 'åå©ãã©ãã°ãç«ã¦ã', banner_modal_desc: 'é åã«åå©ãã©ãã°ãç«ã¦ã¾ã', banner_emoji_label: 'ãã©ãã°çµµæå­', banner_msg_label: 'æ¦éã®éå«ã³ï¼ä»»æï¼', banner_plant_btn: 'ð© ç«ã¦ã', banner_confirm: 'åå©ãã©ãã°ãç«ã¦ã¾ããï¼', banner_planted: 'ð© ãã©ãã°å®äºï¼',
    rating_your_label: 'ããªãã®è©ä¾¡', rating_confirm: 'é åãè©ä¾¡ï¼', rating_submitted: 'â­ è©ä¾¡ãéä¿¡ï¼',
    highlight_btn: 'â¨ ãã¤ã©ã¤ã', highlight_modal_title: 'é åãã¤ã©ã¤ã', highlight_modal_desc: 'ãããã§é åãè¼ããã¾ã', highlight_color_label: 'ã°ã­ã¦ã«ã©ã¼', highlight_activate_btn: 'â¨ æå¹å', highlight_confirm: 'é åããã¤ã©ã¤ããã¾ããï¼', highlight_activated: 'â¨ ãã¤ã©ã¤ãå®äºï¼', highlight_active_label: 'ãã¤ã©ã¤ãä¸­',
    tdesc_title: 'é åã®èª¬æ', tdesc_desc: 'èªåã®é åã«èª¬æãè¿½å ãã¾ããå¨ãã¬ã¤ã¤ã¼ã«è¡¨ç¤ºããã¾ãã', tdesc_claim_label: 'ã¯ã¬ã¤ã  #', tdesc_use_claim: 'ð èªåã®', tdesc_current_label: 'ç¾å¨ã®èª¬æ', tdesc_text_label: 'èª¬æ', tdesc_save_btn: 'ð èª¬æãä¿å­', tdesc_my_label: 'èªåã®èª¬æä¸è¦§', tdesc_none: 'èª¬æãªãã', tdesc_save_confirm: 'é åèª¬æãä¿å­ï¼', tdesc_required: 'èª¬æãå¥åãã¦ãã ãã', tdesc_claim_required: 'ã¯ã¬ã¤ã çªå·ãå¥åãã¦ãã ãã', tdesc_no_claim: 'åã«é åãé¸æãã¦ãã ãã', tdesc_free: 'ç¡æ', tdesc_saved: 'â èª¬æãä¿å­ãã¾ããï¼', tdesc_free_hint: 'æåã®èª¬æã¯ç¡æãå¤æ´æã¯{cost} GPã',
    sponsor_label: 'ã¹ãã³ãµã¼', sponsor_btn: 'ðï¸ ã¹ãã³ãµã¼', sponsor_modal_title: 'é åã¹ãã³ãµã¼', sponsor_modal_desc: 'é å #', sponsor_msg_label: 'ã¡ãã»ã¼ã¸ï¼ä»»æï¼', sponsor_place_btn: 'ðï¸ ã¹ãã³ãµã¼', sponsor_confirm: 'é åãã¹ãã³ãµã¼ï¼', sponsor_placed: 'ðï¸ ã¹ãã³ãµã¼å®äºï¼',
    capsule_title: 'ã¿ã¤ã ã«ãã»ã«', capsule_desc: 'å°å°ããã¡ãã»ã¼ã¸ãåããã¨ãå°æ¥ãã¹ã¦ã®ãã¬ã¤ã¤ã¼ã«å¬éããã¾ãã', capsule_msg_label: 'ã¡ãã»ã¼ã¸ï¼æå¤§280æå­ï¼', capsule_days_label: 'å¬éã¾ã§ï¼æ¥æ°ï¼', capsule_bury_btn: 'â³ ã«ãã»ã«ãåãã', capsule_revealed_label: 'æè¿å¬éãããã«ãã»ã«', capsule_none: 'ã¾ã å¬éãããã«ãã»ã«ãªãã', capsule_none_pending: 'ã¾ã åããããã«ãã»ã«ãªãã', capsule_bury_confirm: 'ã¿ã¤ã ã«ãã»ã«ãåããï¼', capsule_msg_required: 'ã¡ãã»ã¼ã¸ãå¥åãã¦ãã ãã', capsule_days_required: '1æ¥ä»¥ä¸å¥åãã¦ãã ãã', capsule_buried: 'â³ ã«ãã»ã«ãåãã¾ããï¼',
    milestone_title: 'ã³ã­ãã¼ãã¤ã«ã¹ãã¼ã³', milestone_desc: 'ã³ã­ãã¼ã®æ­´å²ã«åäººã®ãã¤ã«ã¹ãã¼ã³ãè¨é²ã', milestone_cat_label: 'ã«ãã´ãª', milestone_title_label: 'ã¿ã¤ãã«ï¼æå¤§50æå­ï¼', milestone_desc_label: 'èª¬æï¼æå¤§200æå­ï¼', milestone_record_btn: 'ð ãã¤ã«ã¹ãã¼ã³ãè¨é²', milestone_write_btn: 'â ãã¤ã«ã¹ãã¼ã³è¨é²', milestone_refresh_btn: 'âº æ´æ°', milestone_cost_hint: 'ã³ã¹ã: {gp} GP', milestone_empty: 'ã¾ã è¨é²ãªããæåã«æ­´å²ãå»ãã§ï¼', milestone_login_required: 'ã­ã°ã¤ã³ãå¿è¦ã§ã', milestone_title_required: 'ã¿ã¤ãã«ãå¥åãã¦ãã ãã', milestone_desc_required: 'èª¬æãå¥åãã¦ãã ãã', milestone_confirm_title: 'ãã¤ã«ã¹ãã¼ã³è¨é²ï¼', milestone_confirm_body: '{cat}ãã¤ã«ã¹ãã¼ã³ã{title}ãã{gp} GPã§è¨é²ï¼', milestone_recorded: 'ã³ã­ãã¼ã®æ­´å²ã«ãã¤ã«ã¹ãã¼ã³ãå»ã¾ãã¾ããï¼',
    tombstone_label: 'å¢ç¢', tombstone_btn: 'ðª¦ å¢ç¢ãç½®ã', tombstone_modal_title: 'å¢ç¢ãç½®ã', tombstone_modal_desc: 'ãã¤ã¦ææãã¦ããé åã«å¢ç¢éãæ®ãã', tombstone_epitaph_label: 'å¢ç¢éï¼æå¤§60æå­ï¼', tombstone_place_btn: 'ðª¦ ç½®ã', tombstone_cost_hint: 'ã³ã¹ã: {gp} GP', tombstone_confirm_title: 'å¢ç¢ãç½®ãï¼', tombstone_confirm_body: '{gp} GPã§æ°¸ä¹å¢ç¢ãç½®ãã¾ããï¼', tombstone_placed: 'å¢ç¢ãç½®ããã¾ããã',
    gpannounce_title: 'ã³ã­ãã¼æ¾é', gpannounce_desc: 'ã¹ã¯ã­ã¼ã«ãã£ãã«ã¼ã§å¨ã¢ã¯ãã£ããã¬ã¤ã¤ã¼ã«ã¡ãã»ã¼ã¸ãæ¾éã', gpannounce_msg_label: 'ã¡ãã»ã¼ã¸ï¼æå¤§80æå­ï¼', gpannounce_dur_label: 'æ¾éæéï¼åï¼', gpannounce_post_btn: 'ð¢ æ¾éãã', gpannounce_login_required: 'ã­ã°ã¤ã³ãå¿è¦ã§ã', gpannounce_msg_required: 'ã¡ãã»ã¼ã¸ãå¥åãã¦ãã ãã', gpannounce_confirm_title: 'ã³ã­ãã¼æ¾éãæç¨¿ï¼', gpannounce_confirm_body: '{dur}åæ¾éã®ã³ã¹ã: {gp} GPãå¨ãã¬ã¤ã¤ã¼ã®ãã£ãã«ã¼ã«è¡¨ç¤ºããã¾ãã', gpannounce_posted: 'æ¾ééå§ï¼',
    prestige_label: 'ãã¬ã¹ãã¼ã¸', prestige_upgrade_btn: 'ð ãã¬ã¹ãã¼ã¸ã¢ãã', prestige_modal_title: 'ãã¬ã¹ãã¼ã¸ã¢ããã°ã¬ã¼ã', prestige_confirm_btn: 'ã¢ããã°ã¬ã¼ã', prestige_permanent_note: 'ãã¬ã¹ãã¼ã¸ã¯æ°¸ä¹ã§ãã¦ã³ã°ã¬ã¼ãã§ãã¾ããã', prestige_login_required: 'ã­ã°ã¤ã³ãå¿è¦ã§ã', prestige_max_reached: 'ãã§ã«æé«ã®ãã¬ã¹ãã¼ã¸ï¼ãã¤ã¤ã¢ã³ãï¼ã§ãï¼', prestige_upgraded: 'ð {name}ãã¬ã¹ãã¼ã¸ã«ã¢ããã°ã¬ã¼ãï¼',
    journal_title: 'ã³ã­ãã¼æ¥èª', journal_desc: 'ã³ã­ãã¼ã®å¬å¼è¨é²ã«æ°¸ä¹ã¨ã³ããªãæ²è¼ãã¾ããããªãã®è¨èã¯ãã­ã³ãã£ã¢ã«æ°¸é ã«æ®ãã¾ãã', journal_title_label: 'ã¿ã¤ãã«ï¼æå¤§60æå­ï¼', journal_content_label: 'åå®¹ï¼æå¤§500æå­ï¼', journal_publish_btn: 'ð ã¨ã³ããªãæ²è¼', journal_write_btn: 'â ã¨ã³ããªãæ¸ã', journal_feed_label: 'ã³ã­ãã¼å¹´ä»£è¨', journal_refresh_btn: 'âº æ´æ°', journal_cost_hint: 'ã³ã¹ã: {gp} GP', journal_empty: 'ã¾ã ã¨ã³ããªãªããæåã®æ­´å²ãæ¸ãã¦ãã ããï¼', journal_login_required: 'æ²è¼ã«ã¯ã­ã°ã¤ã³ãå¿è¦ã§ã', journal_title_required: 'ã¿ã¤ãã«ãå¥åãã¦ãã ãã', journal_content_required: 'åå®¹ãå¥åãã¦ãã ãã', journal_confirm_title: 'æ¥èªã¨ã³ããªãæ²è¼ï¼', journal_confirm_body: 'ã{title}ãã{gp} GPã§æ²è¼ï¼æ°¸ç¶çã«å¬éããã¾ãã', journal_published: 'ã³ã­ãã¼å¹´ä»£è¨ã«ã¨ã³ããªãæ²è¼ããã¾ããï¼',
    base_profile_btn: 'ð¤ ãã­ãã£ã¼ã«', profile_nickname_label: 'ããã¯ãã¼ã ', profile_motto_label: 'ã¢ããã¼', profile_color_label: 'ã¢ãã¿ã¼ã«ã©ã¼', profile_set_btn: 'è¨­å®', profile_history_btn: 'ð å¤æ´å±¥æ­´', profile_no_motto: 'ã¢ããã¼ãªã', profile_nick_confirm: 'ããã¯ãã¼ã ãè¨­å®ï¼', profile_motto_confirm: 'ã¢ããã¼ãè¨­å®ï¼', profile_color_confirm: 'ã¢ãã¿ã¼ã«ã©ã¼ãè¨­å®ï¼',
    quests_failed: 'ã¯ã¨ã¹ãã®èª­è¾¼ã«å¤±æ',
    quests_none_active: 'é²è¡ä¸­ã®ã¯ã¨ã¹ãã¯ããã¾ããããã°ãããã¦ããç¢ºèªãã¦ãã ããï¼',
    quests_pool_depleted: 'å ±é¬ãã¼ã«æ¯æ¸ â å ±é¬ã¯ä¸æçã«åæ­¢ä¸­',
    quests_pool_low: 'ãã¼ã«ä¸è¶³ â å ±é¬ã¯{pct}%ã«æ¸é¡',
    quests_tier_free: 'ç¡æããã·ã§ã³',
    quests_tier_activity: 'ã¢ã¯ãã£ããã£ããã·ã§ã³',
    quests_tier_spending: 'ã¹ãã·ã£ã«ãªãã¹',
    quests_claim_btn: 'åå',
    quests_claim_prefix: 'åå',
    quests_claiming: 'ååä¸­...',
    quests_pool_empty_unavailable: 'ãã¼ã«ãç©ºã§å ±é¬ãåãåãã¾ãã',
    quests_recently_completed: 'æè¿å®äº',
    quests_expired: 'æéåã',
    quests_remaining: 'æ®ã',
    quests_claim_failed: 'ååã«å¤±æ',
    quests_claim_success: '"{title}"å®äºã§+{gp} GPç²å¾ï¼',
    quests_network_error: 'ãããã¯ã¼ã¯ã¨ã©ã¼',
    quests_login_first: 'ã¾ãã­ã°ã¤ã³ãã¦ãã ãã',
    quests_completed_toast: 'ã¯ã¨ã¹ãå®äºï¼"{title}" â å ±é¬ãåãåããï¼',
    // Daily check-in
    daily_checkin_title: 'ð ãã¤ãªã¼ãã§ãã¯ã¤ã³',
    daily_streak_days: 'ð¥ {n}æ¥é£ç¶',
    daily_day_of: '{total}æ¥ä¸­{cur}æ¥ç®',
    daily_day_prefix: 'DAY',
    daily_done: 'å®äº',
    daily_gp_suffix: 'GP',
    daily_bonus_suffix: 'ãã¼ãã¹',
    daily_checked_in: 'â æ¬æ¥ãã§ãã¯ã¤ã³æ¸ã¿ï¼',
    daily_today_label: 'æ¬æ¥:',
    daily_checkin_btn: 'â ãã§ãã¯ã¤ã³',
    daily_missions_title: 'ãã¤ãªã¼ããã·ã§ã³',
    daily_resets_prefix: 'ãªã»ãã',
    daily_all_bonus_title: 'ð +50 GP ãã¼ãã¹ï¼',
    daily_all_bonus_sub: 'ãã¤ãªã¼ããã·ã§ã³å¨éæ',
    daily_login_required: 'ã­ã°ã¤ã³ãå¿è¦ã§ã',
    daily_already_checked: 'æ¬æ¥ã¯æ¢ã«ãã§ãã¯ã¤ã³æ¸ã¿ï¼',
    daily_check_in_failed: 'ãã§ãã¯ã¤ã³å¤±æãåè©¦è¡ãã¦ãã ãã',
    daily_gp_claimed: '+{n} GP ç²å¾ï¼',
    daily_streak_bonus: '+{n} GP é£ç¶ãã¼ãã¹ï¼',
    daily_checkin_complete: 'ãã§ãã¯ã¤ã³å®äº',
    daily_streak_msg: '{n}æ¥é£ç¶ï¼',
    daily_mission_complete_toast: '+{n} GP ããã·ã§ã³å®äºï¼',
    daily_all_missions_bonus_toast: 'ð +50 GP å¨ããã·ã§ã³éæãã¼ãã¹ï¼',
    daily_mission_claim_failed: 'ååå¤±æ',
    daily_mission_claim_conn_failed: 'ååå¤±æ â æ¥ç¶ãç¢ºèªãã¦ãã ãã',
    dm_claim_pixels: 'é åæ¡å¤§', dm_claim_pixels_d: 'ç«æã®ã°ã­ã¼ãã§ãã¯ã»ã«ãå é ããã',
    dm_harvest: 'è³æºåé', dm_harvest_d: 'ææé åããPPãåç©«ããã',
    dm_explore_poi: 'åµå¯ä»»å', dm_explore_poi_d: 'ã°ã­ã¼ãã§POIãã¼ã«ã¼ãçºè¦ããã',
    dm_hijack: 'æµå°å¶å§', dm_hijack_d: 'GPã§æµã®é åãå¥ªåããã',
    dm_play_cantina: 'ã«ã³ãã£ã¼ããã¤ã', dm_play_cantina_d: 'ã«ã³ãã£ã¼ãã§ããã²ã¼ã ããã¬ã¤ããã',
    dm_equip_cosmetic: 'ç«æãã¡ãã·ã§ã³', dm_equip_cosmetic_d: 'ã¤ã³ãã³ããªããã³ã¹ã¡ãè£åããã',
    dm_view_weather: 'ã¹ãã¼ã ãã§ã¤ãµã¼', dm_view_weather_d: 'ç«æã®å¤©æ°äºå ±ããã§ãã¯ããã',
    dm_enhance_item: 'å¼·åã©ã', dm_enhance_item_d: 'ã³ã¹ã¡ã¢ã¤ãã ã®å¼·åã«ææ¦ããã',
    dm_marketplace_trade: 'ãã¼ã±ãããã¼', dm_marketplace_trade_d: 'ãã¼ã±ãããã¬ã¤ã¹ã§ã¢ã¤ãã ãè³¼å¥ããã',
    dm_win_naval_battle: 'æµ·æ¦åå©', dm_win_naval_battle_d: 'ä»ã®è¦éã¨ã®æµ·æ¦ã«åå©ããã',
    dm_build_ship: 'é è¹æç¨¼å', dm_build_ship_d: 'è¦éã«æ°ããè¦è¹ãçºæ³¨ããã',
    dm_daily_checkin: 'ãã¤ãªã¼ãã§ãã¯ã¤ã³', dm_daily_checkin_d: 'ä»æ¥ã­ã°ã¤ã³ãã¦ãã§ãã¯ã¤ã³ããã',
    dm_claim_fallback: 'é åå é ', dm_claim_fallback_d: 'ç«æã®ã°ã­ã¼ãã§ãã¯ã»ã«ãå é ããã',
    dm_explore_fallback: 'ã»ã¯ã¿ã¼æ¢ç´¢', dm_explore_fallback_d: 'ã°ã­ã¼ãã§POIãã¼ã«ã¼ãçºè¦ããã',
    dm_play_fallback: 'ãã¤ãªã¼æ´»å', dm_play_fallback_d: 'ã²ã¼ã ã¢ã¯ã·ã§ã³ãå®è¡ãããï¼å é ãæ¡æãå¥ªåãªã©ï¼',
    // ââ GUILD tab ââ
    guild_join_or_create: 'ã®ã«ãã«åå ã¾ãã¯ä½æ',
    guild_teamup_desc: 'ä»ã®å¥æ¤èã¨ååãã¦ç«æãæ¯éããã',
    guild_pending_invites: 'ä¿çä¸­ã®æå¾',
    guild_find_title: 'ã®ã«ããæ¢ã',
    guild_find_hint: '(ID Â· ã¿ã° Â· åå)',
    guild_find_placeholder: 'ä¾ï¼42 Â· MARS Â· Red Legion',
    guild_search_btn: 'æ¤ç´¢',
    guild_create_title: 'æ°è¦ã®ã«ãä½æ',
    guild_create_cost_hint: '(50 GP å¿è¦)',
    guild_name_placeholder: 'ã®ã«ãå (2-50æå­)',
    guild_tag_placeholder: 'ã¿ã° (2-4)',
    guild_desc_placeholder: 'èª¬æï¼ä»»æï¼',
    guild_create_btn: 'ã®ã«ãä½æ (50 GP)',
    guild_members_label: 'ã¡ã³ãã¼',
    guild_total_pixels_label: 'ç·ãã¯ã»ã«',
    guild_gp_treasury_label: 'GP éåº«',
    guild_edit_btn: 'â ç·¨é',
    guild_upgrades_title: 'ã®ã«ãã¢ããã°ã¬ã¼ã',
    guild_pp_treasury: 'PP éåº«',
    guild_next_prefix: 'æ¬¡ï¼',
    guild_next_dash: 'æ¬¡ï¼â',
    guild_max_level: 'æå¤§ã¬ãã«',
    guild_levelup_btn: 'ã¬ãã«ã¢ãã â²',
    guild_my_contribution: 'èªåã®åç©«è²¢ç®',
    guild_contribution_hint: 'åç©«ã®ä¸é¨ãã®ã«ãéåº«ã«å¥ãã¾ãã',
    guild_research_title: 'ç ç©¶',
    guild_research_unlocked: 'â è§£ç¦æ¸ã¿',
    research_mining_eff_1: 'â æ¡æå¹ç I', research_shield_disc: 'ð¡ ã·ã¼ã«ãè¨ç·´', research_diplomatic: 'ð å¤äº¤è¡',
    research_orbital_scan: 'ð° è»éã¹ã­ã£ã³', research_rapid_deploy: 'ð é«éå±é', research_logistics: 'ð¦ åµç«ç®¡ç', research_mars_dominion: 'ð¥ ç«æå¶è¦',
    guild_join_requests: 'åå ãªã¯ã¨ã¹ã',
    guild_no_requests: 'ä¿çä¸­ã®ãªã¯ã¨ã¹ãã¯ããã¾ããã',
    guild_invite_title: 'ãã¬ã¤ã¤ã¼ãæå¾',
    guild_invite_hint: '(ããã¯ãã¼ã /ã¦ã©ã¬ããã§æ¤ç´¢)',
    guild_invite_placeholder: '1æå­ä»¥ä¸ã§æ¤ç´¢...',
    guild_invite_btn: 'æå¾',
    guild_chat_title: 'ð¬ ã®ã«ããã£ãã',
    guild_chat_refresh: 'â» æ´æ°',
    guild_chat_empty: 'ã¾ã ã¡ãã»ã¼ã¸ã¯ããã¾ãããæ¨æ¶ãããï¼',
    guild_chat_loading: 'ãã£ããèª­è¾¼ä¸­...',
    guild_chat_placeholder: 'ã¡ãã»ã¼ã¸ãå¥å...',
    guild_chat_send: 'éä¿¡',
    guild_leaderboard_title: 'ã®ã«ããªã¼ãã¼ãã¼ã',
    guild_leave_btn: 'ã®ã«ããæãã',
    guild_danger_zone: 'å±éºã¾ã¼ã³',
    guild_disband_btn: 'ã®ã«ãè§£æ£',
    guild_lb_empty: 'ã¾ã ã®ã«ããããã¾ãããæåã®ã®ã«ãã«ãªããï¼',
    guild_lb_members_suffix: 'members',
    guild_lb_leader_prefix: 'ãªã¼ãã¼ï¼',
    guild_lb_unknown: 'ä¸æ',
    guild_lb_pixels: 'ãã¯ã»ã«',
    guild_level_prefix: 'Lv.',
    guild_invited_by: 'æå¾èï¼',
    guild_accept_btn: 'åè«¾',
    guild_promote_btn: 'ææ ¼',
    guild_demote_btn: 'éæ ¼',
    guild_kick_btn: 'è¿½æ¾',
    guild_transfer_btn: 'è­²æ¸¡',
    guild_member_role: 'ã¡ã³ãã¼',
    guild_officer_role: 'å½¹å¡',
    guild_leader_role: 'ãªã¼ãã¼',
    guild_search_searching: 'æ¤ç´¢ä¸­â¦',
    guild_search_none: '"{q}"ã«ä¸è´ããã®ã«ãã¯ããã¾ãã',
    guild_search_failed: 'æ¤ç´¢å¤±æ',
    guild_search_join_btn: 'åå ',
    guild_invite_no_matches: 'ä¸è´ãªãã',
    guild_invite_pending: 'ä¿çä¸­',
    guild_invite_search_failed: 'æ¤ç´¢å¤±æã',
    guild_pixels_owned: 'px ææ',
    guild_pixels_short: 'px',
    guild_toast_login_first: 'ã¾ãã­ã°ã¤ã³ãã¦ãã ãã',
    guild_toast_no_guild: 'ã®ã«ããªã',
    guild_toast_need_name_tag: 'ã®ã«ãåã¨ã¿ã°ãå¥åãã¦ãã ãã',
    guild_toast_created: 'ã®ã«ã [{tag}] ãä½æãã¾ããï¼',
    guild_toast_create_failed: 'ã®ã«ãä½æå¤±æ',
    guild_toast_enter_target: 'ã¦ã©ã¬ããã¾ãã¯ããã¯ãã¼ã ãå¥å',
    guild_toast_invite_sent: 'æå¾ãéä¿¡ãã¾ããï¼',
    guild_toast_invite_failed: 'æå¾å¤±æ',
    guild_toast_joined: 'ã®ã«ãã«åå ãã¾ããï¼',
    guild_toast_accept_failed: 'åè«¾å¤±æ',
    guild_toast_declined: 'æå¾ãè¾éãã¾ãã',
    guild_toast_generic_failed: 'å¤±æ',
    guild_toast_player_added: 'ãã¬ã¤ã¤ã¼ãã®ã«ãã«è¿½å ãã¾ãã',
    guild_toast_sign_in_first: 'ã¾ãã­ã°ã¤ã³ãã¦ãã ãã',
    guild_confirm_join_request: '{name}ã«åå ãªã¯ã¨ã¹ããéãã¾ããï¼\n\nãã®ã®ã«ãã®ãªã¼ãã¼ã¾ãã¯å½¹å¡ã®æ¿èªãå¿è¦ã§ãã',
    guild_toast_join_request_sent: '{name}ã«åå ãªã¯ã¨ã¹ããéä¿¡ãã¾ãã',
    guild_toast_join_request_failed: 'ãªã¯ã¨ã¹ãéä¿¡å¤±æ',
    guild_confirm_leave: 'ãã®ã®ã«ããæãã¾ããï¼',
    guild_toast_left: 'ã®ã«ããæãã¾ãã',
    guild_confirm_kick: 'ãã®ã¡ã³ãã¼ãè¿½æ¾ãã¾ããï¼',
    guild_toast_kicked: 'ã¡ã³ãã¼ãè¿½æ¾ãã¾ãã',
    guild_toast_promoted: 'å½¹å¡ã«ææ ¼ãã¾ãã',
    guild_toast_demoted: 'ã¡ã³ãã¼ã«éæ ¼ãã¾ãã',
    guild_confirm_transfer: 'ãªã¼ãã¼æ¨©éãè­²æ¸¡ãã¾ããï¼åã«æ»ãã¾ããã',
    guild_toast_transferred: 'ãªã¼ãã¼æ¨©éãè­²æ¸¡ãã¾ãã',
    guild_toast_leveled_up: 'ã®ã«ããLv.{n}ã«ã¬ãã«ã¢ããï¼',
    guild_toast_levelup_failed: 'ã¬ãã«ã¢ããå¤±æ',
    guild_toast_research_unlocked: 'ç ç©¶ãè§£ç¦ãã¾ããï¼',
    guild_toast_research_failed: 'ç ç©¶å¤±æ',
    guild_confirm_disband: 'â  ã®ã«ã "{name}" ãè§£æ£ãã¾ããï¼\n\nå¨ã¡ã³ãã¼ãè§£æ£ããã¾ãã\nåã«æ»ãã¾ããï¼',
    guild_prompt_disband_type: 'ç¢ºèªã®ãããã®ã«ãåãæ­£ç¢ºã«å¥åãã¦ãã ããï¼\n\n{name}',
    guild_toast_disband_mismatch: 'ã®ã«ãåãä¸è´ãã¾ãã â è§£æ£ãã­ã£ã³ã»ã«',
    guild_toast_disbanded: 'ã®ã«ããè§£æ£ãã¾ãã',
    guild_toast_no_guild_data: 'ã®ã«ããã¼ã¿ãªã',
    guild_toast_send_failed: 'éä¿¡å¤±æ',
    // ââ Global UI ââ
    nav_claim: 'CLAIM', nav_cantina: 'ã«ã³ãã£ã¼ã', nav_base: 'ãã¼ã¹', nav_items: 'ã¢ã¤ãã ',
    nav_my_land: 'ãã¤é å', sectors_btn: 'ã»ã¯ã¿ã¼', open_gacha_label: 'è¦è¹ããã¯ã¹', open_gacha_sub: 'ã¬ãã£', my_assets_btn: 'ãã¤ã¢ã»ãã', full_loss_optin_label: '⚔ PvP フルロス同意 — 双方同意の戦闘でのみ撃沈艦が永久消滅',
    open_base: 'ãã¼ã¹ãéã', open_gacha: 'ð² è¦è¹ããã¯ã¹', enter_cantina: 'â ã«ã³ãã£ã¼ãã«å¥ã',
    my_base: 'ãã¤ãã¼ã¹', deposit_btn: 'å¥é', withdraw_btn: 'åºé', logout_btn: 'ã­ã°ã¢ã¦ã',
    harvest_all_btn: 'â ä¸æ¬åç©«', tend_all_btn: 'ð§ ä¸æ¬æ´å', export_key_btn: 'ð ã­ã¼', export_key_title: 'ð ã¦ã©ã¬ããã­ã¼ãã¨ã¯ã¹ãã¼ã', export_key_disclaimer: 'â  ã¦ã©ã¬ããã®ç§å¯éµãè¡¨ç¤ºãã¾ãããã®éµãæã¤èã¯èª°ã§ãè³éãç®¡çã§ãã¾ãããªãã©ã¤ã³ã§ä¿ç®¡ããçµ¶å¯¾ã«å±æããªãã§ãã ããã<b>ä¿ç®¡è²¬ä»»ã¯å¨ã¦æ¬äººã«ãããç´å¤±ã»çé£æã«éå¶èã¯éµãè³ç£ãå¾©åã§ãã¾ããã</b>', export_key_ack: 'éµã®ä¿ç®¡è²¬ä»»ãå¨ã¦èªåã«ãããã¨ãçè§£ãåæãã¾ãã', export_key_pw_ph: 'ãã¹ã¯ã¼ããç¢ºèª', export_key_reveal_btn: 'ç§å¯éµãè¡¨ç¤º', export_key_addr: 'ã¢ãã¬ã¹', export_key_priv: 'ç§å¯éµ', export_key_copy: 'ð éµãã³ãã¼', export_key_close_warn: 'ä¿å­å¾ãã®ã¦ã£ã³ãã¦ãéãã¦ãã ãããéµã¯èªåçã«åè¡¨ç¤ºããã¾ããã',
    address_copied: 'ã¢ãã¬ã¹ãã³ãã¼ãã¾ããï¼',
    top_governors: 'ð ãããç·ç£', loading_dots: 'èª­è¾¼ä¸­...',
    no_alerts: 'ã¢ã©ã¼ãã¯ã¾ã ããã¾ãã', live_feed_title: 'ã©ã¤ããã£ã¼ã', live_feed_empty: 'ã©ã¤ãã¤ãã³ãã¯ã¾ã ããã¾ããã',
    claim_land: 'é åç²å¾', drag_select: 'ãã©ãï¿½ï¿½ï¿½ãã¦é åãé¸æ',
    land_size: 'ãµã¤ãº', land_pixels: 'ãã¯ã»ã«', land_cost: 'ã³ã¹ã',
    confirm_btn: 'ç¢ºèª', cancel_btn: 'ã­ã£ã³ã»ã«',
    claim_add_img: 'åã«é åãç²å¾ãç»åã¯å¾ããè¿½å ',
    my_territories: 'ãã¤é å', no_territories: 'é åãããã¾ãã',
    info_guild: 'ã®ã«ã', info_link: 'ãªã³ã¯', info_name: 'åå',
    share_btn: 'ð¤ å±æ', rename_btn: 'ãªãã¼ã ', edit_image: 'ç»åç·¨é', customize_btn: 'â¨ ã«ã¹ã¿ãã¤ãº', merge_btn: 'ð é åãã¼ã¸',
    cosmetics_title: 'ã³ã¹ã¡ãã£ãã¯', promo_link: 'ãã­ã¢ãªã³ã¯', save_btn: 'ä¿å­',
    hijack_warn_title: 'â  é åä¹ã£åã',
    hijack_btn_short: 'â é åãHIJACK',
    hijack_current_owner: 'ï¿½ï¿½å¨ã®ãªã¼ãã¼ï¼',
    hijack_refund: 'ãªã¼ãã¼ã«è¿é + 10%ãã¼ãã¹',
    hijack_you_pay: 'æ¯æãé¡ï¼',
    claim_location: 'å ´æ', claim_chain: 'ãã§ã¼ã³', claim_cost: 'ã³ã¹ã',
    claim_pay_with: 'æ¯ï¿½ï¿½ãæ¹æ³', claim_note: 'ãªã¼ãã¼ã¯100%è¿é + 10%ãã¼ãã¹ Â· ææ°æï¼10%',
    image_editor: 'ç»åã¨ãã£ã¿', upload_click: 'ã¯ãªãã¯ãã¦ç»åãã¢ããã­ã¼ã',
    upload_hint: 'PNG, JPG, GIF Â· æå¤§5MB',
    editor_drag_hint: 'ãã©ãã°ã§ç§»å Â· ã¹ã¯ã­ã¼ã«ã§æ¡å¤§ Â· ãã¿ã³ã§åè»¢',
    swap_fee: 'ã¹ã¯ããææ°æï¼', you_receive: 'ååé¡ï¼',
    item_shop_title: 'ð¡ï¸ ï¿½ï¿½ï¿½ã¤ãã ã·ã§ãã',
    shop_tab_shop: 'ð ã·ã§ãã', shop_tab_inv: 'ð¦ ãã¤ã¢ã¤ï¿½ï¿½ï¿½ã ',
    shop_cat_all: 'å¨ã¦', shop_cat_defense: 'é²å¾¡', shop_cat_attack: 'æ»æ',
    shop_cat_utility: 'ã¦ã¼ãã£ãªãã£', shop_cat_boost: 'ãã¼ã¹ã', shop_cat_cosmetic: 'ã³ã¹ã¡',
    shop_active_effects: 'ã¢ã¯ãã£ãå¹æ', shop_my_inventory: 'ãã¤ã¤ã³ãã³ããª',
    shop_confirm_title: 'è³¼å¥ç¢ºèª',
    shop_loading: 'ï¿½ï¿½ï¿½ã¤ãã èª­è¾¼ä¸­...', shop_inv_loading: 'ã¤ã³ãã³ããªèª­è¾¼ä¸­...',
    // ââ å¼·å ââ
    enh_enhance: 'å¼·å', enh_workshop: 'å¼·åå·¥æ¿',
    enh_materialized: 'å¼·åæºåå®äºï¼', enh_returned: 'ã¤ã³ãã³ããªã«è¿å´',
    enh_materialize_tip: 'å¼·åã®ããåå¥ã¢ã¤ãã ã«å¤æ',
    enh_return_tip: 'ã¤ã³ãã³ããªã¹ã¿ãã¯ã«è¿å´',
    enh_current_level: 'ç¾å¨ã¬ãã«', enh_next_level: 'æ¬¡ã®ã¬ãã«',
    enh_cost: 'ã³ã¹ã', enh_balance: 'æ®é«', enh_success_rate: 'æåç',
    enh_body: 'ã¢ã¤ãã å¼·åãè©¦ã¿ã¾ããå¤±ææï¼ã¬ãã«ç¶­æã»ä½ä¸ãã¾ãã¯ã¢ã¤ãã ç ´å£ã®å¯è½æ§ãããã¾ãã',
    enh_maxed_body: 'ãã®ã¢ã¤ãã ã¯æå¤§å¼·åã¬ãã«ã«å°éãã¦ãã¾ãã',
    enh_confirm: 'å¼·å', enh_success: 'å¼·åæåï¼',
    enh_fail_stay: 'å¼·åå¤±æãã¬ãã«ç¶­æã',
    enh_fail_down: 'å¼·åå¤±æï¼ã¬ãã«ãä½ä¸ï¼',
    enh_fail_destroy: 'å¼·åå¤±æï¼ã¢ã¤ãã ãç ´å£ããã¾ããï¼',
    cmd_message: 'å¸ä»¤å®ã¡ãã»ã¼ã¸',
    total_px_label: 'ç·ãã¯ã»ã«', usdt_bal_label: 'USDTæ®é«', pp_bal_label: 'PPæ®é«',
    level_label: 'ã¬ãã«', xp_next: 'æ¬¡ï¼{n} XP', max_level: 'æå¤§ã¬ãã«',
    share_stats: 'ð¤ æ¦ç¸¾ãå±æ', breakthrough_title: 'ãã¬ã¤ã¯ã¹ã«ã¼',
    all_ranks: 'å¨ã©ã³ã¯', show_label: 'â¼ è¡¨ç¤º', hide_label: 'â² éè¡¨ç¤º',
    rank_tbl_lv: 'LV', rank_tbl_name: 'åå', rank_tbl_xp: 'XP', rank_tbl_reward: 'PPå ±é¬',
    my_sectors: 'ãã¤ã»ã¯ã¿ã¼', no_sectors_yet: 'ã¾ã é åãããã¾ãããããããæ¢ç´¢ãã¾ãããï¼',
    login_to_view: 'ã­ã°ã¤ã³ãã¦é åãç¢ºï¿½ï¿½ï¿½ã',
    all_24_sectors: 'å¨24ã»ã¯ã¿ã¼',
    sector_all: 'å¨ã¦', sector_core: 'ã³ã¢', sector_mid: 'ããã', sector_frontier: 'ãã­ã³ãã£ã¢',
    sector_my: 'â­ ãã¤ã»ã¯ã¿ã¼', sector_loading: 'ã»ã¯ã¿ã¼èª­è¾¼ä¸­...',
    sector_claims_24h: '24æéã«{n}ä»¶ã®ç²å¾', sector_occupied: 'å æ',
    sector_avg_price: 'å¹³åä¾¡æ ¼', sector_cur_price: 'ç¾å¨ä¾¡æ ¼', sector_owners: 'ãªã¼ãã¼æ°',
    sector_top_holder: 'ããããã«ãã¼', sector_gov: 'ç·ç£', sector_vice_gov: 'å¯ç·ç£',
    sector_tax: 'ç¨ç', sector_my_px: 'ãã¤ãã¯ã»ã«', sector_go: 'ç§»å',
    sector_empty_hint: 'ã¾ã ãã¯ã»ã«ãææãã¦ãã¾ãããé åãç²å¾ããã¨ããã«è¡¨ï¿½ï¿½ï¿½ããã¾ãã',
    harvestable_pp: 'åç©«å¯è½PP', total_mined: 'ç·æ¡æé',
    harvest_pp: 'â æ¡æ', harvest_now: 'â¡ å³ææ¡æï¼{cost} PPï¼', mine_btn: 'â æ¡æ',
    mine_timer_prefix: 'æ¬¡ã®åç©«ã¾ã§',
    harvest_available: 'ä»ããåç©«å¯è½ï¼', harvest_ready: 'æºåå®äºï¼',
    claim_to_mine: 'ãã¯ã»ã«ãç²å¾ãã¦ãã¤ãã³ã°ãéå§ï¼',
    mining_rates: 'ãã¤ãã³ã°ã¬ã¼ã',
    rate_reward_range: 'å ±é¬ç¯å²', rate_interval: 'åç©«éé',
    rate_core: 'ã³ã¢ãã¼ãã¹', rate_mid: 'ããããã¼ãã¹', rate_frontier: 'ãã­ã³ãã£ã¢ãã¼ãã¹',
    governance_title: 'â ã¬ããã³ã¹',
    gov_active_events: 'ã¢ã¯ãã£ãã¤ãã³ã', gov_my_positions: 'èªåã®å½¹è·',
    gov_login_positions: 'ã­ã°ã¤ã³ãã¦ã¬ããã³ã¹å½¹è·ãç¢ºèªã',
    gov_commander: 'å¸ä»¤å®', gov_commander_controls: 'å¸ä»¤å®ã³ã³ãã­ã¼ã«',
    gov_global_event: 'ã°ã­ã¼ãã«ã¤ãã³ãï¼1æ¥1åï¼',
    gov_double_mining: 'â ãã¤ãã³ã°2å', gov_war_time: 'â æ¦æ', gov_peace: 'ð å¹³å',
    gov_announcement: 'ã¢ãã¦ã³ã¹', gov_announce_placeholder: 'å¨ä½ã¡ãã»ã¼ã¸...',
    gov_set: 'è¨­å®', gov_bounty: 'è³é', gov_target_nick: 'ã¿ã¼ã²ãï¿½ï¿½ã®ããã¯ãã¼ã ',
    gov_place: 'è¨­ç½®', gov_rocket_drop: 'ã­ã±ããè£çµ¦æä¸',
    gov_launch_drop: 'ð è£çµ¦æä¸',
    gov_governor_controls: 'ç·ç£ã³ã³ãã­ã¼ã«', gov_select_sector: 'ã»ã¯ã¿ã¼é¸æ â¾',
    gov_tax_rate: 'ç¨ç', gov_sector_buffs: 'ã»ã¯ã¿ã¼ãã',
    gov_mining_20: 'â ãã¤ãã³ã°+20%', gov_defense_10: 'ð¡ é²å¾¡+10%', gov_claim_10: 'ð° ç²å¾-10%',
    gov_sector_announce: 'ã»ã¯ã¿ã¼ã¢ãã¦ã³ã¹', gov_sector_msg: 'ã»ã¯ã¿ã¼ã¡ãã»ã¼ã¸...',
    gov_bounty_board: 'è³éæ²ç¤ºæ¿', gov_no_bounties: 'ã¢ã¯ãã£ããªè³éã¯ããã¾ããã',
    gov_siege_title: 'âï¸ ã»ã¯ã¿ã¼æ»åæ¦', gov_select_sector_siege: 'ã»ã¯ã¿ã¼é¸æ...',
    gov_select_siege_hint: 'ã»ã¯ã¿ã¼ãé¸æãã¦æ»åç¶æ³ãè¡¨ç¤ºã',
    gov_challenge_btn: 'âï¸ ç·ç£ã«ææ¦',
    gov_betting_title: 'ð° æ»åæ¦ãããã£ã³ã°', gov_bet_challenger: 'âï¸ ææ¦è', gov_bet_governor: 'ð¡ ç·ç£',
    gov_declaration: 'ç·ç£å®£è¨ (5 GP)',
    gov_declare_save: 'å®£è¨',
    gov_policy_open: 'ãªã¼ãã³ï¼èª°ã§ãæ­è¿ï¼', gov_policy_ally: 'åçã®ã¿', gov_policy_closed: 'éé',
    gov_titles_title: 'ð ç§°å·', gov_titles_hint: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦ç§°å·ãç¢ºèªã',
    gov_fleet_title: 'â è¦é', gov_fleet_hint: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦è¦éãç¢ºèªã',
    gov_fleet_empty: 'ã¾ã è¦è¹ãããã¾ãã â ä¸ã®é è¹æã§å»ºé ãå§ãã¦ãã ããã',
    gov_faction_btn: 'ð¡ æ´¾é¥', gov_hijack_btn: 'â å¥ªå', gov_registry_btn: 'ð è¦èå³é', gov_minerals_btn: 'ð é±ç©å³é',
    gov_fleet_my: 'è¦è¹ä¸è¦§', gov_fleet_max: 'æå¤§10é»', gov_shipyard: 'é è¹æ',
    gov_ship_build: 'å»ºé ', gov_ship_built: 'å»ºé å®äºï¼', gov_ship_repair: 'ä¿®ç',
    gov_ship_repaired: 'ä¿®çå®äºï¼', gov_ship_repair_confirm: 'è¦è¹ããã«HPã«ä¿®çãã¾ããï¼',
    gov_ship_upgrade: 'ã¢ããã°ã¬ã¼ã', gov_ship_upgraded: 'ã¢ããã°ã¬ã¼ãå®äºï¼', gov_ship_upgrade_cost: 'ã¢ããã°ã¬ã¼ãè²»ç¨',
    sy_tab_blueprints: 'è¨­è¨å³', sy_tab_queue: 'å»ºé å¾æ©', sy_tab_fleet: 'èªè¦é', sy_tab_market: 'è¦è¹å¸å ´', sy_tab_crates: 'ããã¯ã¹', sy_tab_assembly: 'èµ·å', sy_crate_intro: 'è¦è¹ããã¯ã¹ãéãã¦ã©ã³ãã ãªè¦è¹ãç²å¾ãç²å¾ããè¦è¹ã¯è¦è¹å¸å ´ã§åå¼ã§ãã¾ããç¢ºçã¯åããã¯ã¹ã«å¬éããã¦ãã¾ãã',
    sy_filter_size: 'è¦ç´:', sy_size_all: 'å¨ã¦', sy_size_frigate: 'ããªã²ã¼ã', sy_size_destroyer: 'é§éè¦', sy_size_cruiser: 'å·¡æ´è¦', sy_size_battleship: 'æ¦è¦', sy_size_titan: 'ã¿ã¤ã¿ã³',
    sy_filter_faction: 'å¢å:', sy_filter_size2: 'ãµã¤ãº:',
    sy_mineral_label: 'é±ç©ææ', sy_ships_label: 'è¦è¹',
    ship_mkt_buy: 'è³¼å¥', ship_mkt_cancel: 'åºååæ¶',
    gov_battle_title: 'âï¸ æµ·æ¦', gov_battle_hint: 'ã¦ã©ã¬ãããæ¥ç¶ãã¦æµ·æ¦ãç¢ºèªã',
    gov_battle_active: 'é²è¡ä¸­ã®æ¦é', gov_battle_declare: 'æ¦éå®£è¨',
    gov_battle_declared: 'æ¦éå®£è¨ï¼é²è¡èã®å¿ç­å¾ã¡ã',
    gov_battle_history: 'æ¦éå±¥æ­´', gov_battle_no_ships: 'åã«è¦è¹ãå»ºé ãã¦ãã ããï¼',
    gov_battle_target_label: 'æ¨çã¦ã©ã¬ãã', gov_battle_select_ships: 'è¦è¹é¸æï¼æå¤§5ï¼',
    gov_battle_declare_confirm: 'æ¦éå®£è¨', gov_battle_respond: 'æ¦éå¿ç­',
    gov_battle_select_defender: 'é²è¡ã«ä½¿ãè¦è¹ãé¸æ', gov_battle_accept: 'è¿æï¼',
    gov_battle_fighting: 'æ¦ééå§ï¼ç´60ç§å¾ã«çµæã',
    gov_battle_cancelled_ok: 'æ¦éã­ã£ã³ã»ã«ãGPãè¿éã',
    gov_hall_of_fame: 'ð æ®¿å ', gov_select_sector_hof: 'ã»ã¯ã¿ã¼é¸æ...',
    gov_select_hof_hint: 'ã»ã¯ã¿ã¼ãé¸æãã¦å±¥æ­´ãè¡¨ç¤ºã',
    ops_title: 'ä½æ¦ããã·ã§ã³ã³ã³ã½ã¼ã«',
    ops_desc: 'é åã®çºå°ãããããä¾µæ»ã»æ¢ç´¢ä½æ¦ãéå§ããé²è¡ç¶æ³ãç®¡ç',
    ops_pads_ready: 'çºå°å°æºå',
    ops_launch_new: 'æ°è¦ããã·ã§ã³çºå°',
    ops_invasion: 'â ä¾µæ»', ops_explore: 'ð° æ¢ç´¢',
    ops_select_pad: 'çºå°å°ãé¸æ', ops_bigger_reward: 'ï¼å¤§ããçºå°å°âå¤§ããå ±é¬ï¼',
    ops_target_lat: 'ç®æ¨ç·¯åº¦', ops_target_lng: 'ç®æ¨çµåº¦',
    ops_target_wallet: 'ã¿ã¼ã²ããã¦ã©ã¬ãã/ããã¯ãã¼ã ï¼ä¾µæ»ã®ã¿ï¼',
    ops_launch_btn: 'ããã·ã§ã³çºå° â¶',
    ops_active: 'ã¢ã¯ãã£ãä½æ¦', ops_no_missions: 'ã¢ã¯ãã£ãããã·ã§ã³ãªããä¸ããçºå°ãããã',
    ops_no_pads: 'â ã¾ã é åãããã¾ãããã¾ããã¯ã»ã«ãç²å¾ãã¦çºå°å°ãç¢ºä¿ãããã',
    ops_launched: 'çºå°æ¸', ops_ready_status: 'â æºåå®äº',
    ops_territory: 'é å', ops_merged: 'çµ±å',
    ops_ready_claim: 'ååå¯è½', ops_failed: 'å¤±æ',
    ops_claim: 'åå', ops_abort: 'ä¸­æ­¢',
    ops_abort_title: 'ããã·ã§ã³ä¸­æ­¢',
    ops_abort_body: 'ããã·ã§ã³ãåºå°ã«å¸°éããã¾ããï¼çæã®ä¸é¨ã®ã¿è¿éããã¾ãã',
    ops_abort_btn: 'ä¸­æ­¢',
    ops_connect_first: 'ã¾ãã¦ã©ã¬ãããæ¥ç¶', ops_pick_pad: 'ã¾ãçºå°å°ãé¸æ',
    ops_enter_coords: 'ç®æ¨åº§æ¨ãå¥å', ops_target_required: 'ã¿ã¼ã²ããã¦ã©ã¬ããã¾ãã¯ããã¯ãã¼ã ãå¿è¦',
    ops_mission_launched: 'ããã·ã§ã³çºå°å®äºï¼', ops_launch_failed: 'çºå°å¤±æï¼',
    ops_claim_failed: 'ååå¤±æï¼', ops_load_failed: 'ããã·ã§ã³èª­è¾¼å¤±æã',
    ops_mission_aborted: 'ããã·ã§ã³ä¸­æ­¢ Â· {pp} PP è¿é',
    ops_cancel_failed: 'ã­ã£ã³ã»ã«å¤±æï¼', ops_no_reward: 'å ±é¬ãªã',
    ops_pick_hint: 'â ä¸ã§çºå°å°ãé¸æ', ops_await_target: 'â ã¿ã¼ã²ããã­ãã¯å¾ã¡â¦',
    ops_computing: 'â¦è»éè¨ç®ä¸­',
    ops_browse: 'ð¯ ãã©ã¦ãº',
    ops_invade_label: 'ä¾µæ»', ops_explore_label: 'æ¢ç´¢',
    base_shop_btn: 'ð ã·ã§ãã', base_inv_btn: 'ð ãã¤ã¢ã¤ãã ',
    arena_connect: 'æ¥ç¶',
    crash_title: 'CRASH', mines_title: 'MINES', coinflip_title: 'COINFLIP',
    dice_title: 'DICE', hilo_title: 'HI-LO',
    crash_guide_1: 'ããã', crash_guide_2: 'ä¸æãè¦å®ã', crash_guide_3: 'ã­ã£ãã·ã¥ã¢ã¦ãï¼',
    crash_waiting: 'å¾æ©ä¸­...', crash_next_round: 'æ¬¡ã®ã©ã¦ã³ãã¾ããªãéå§',
    crash_bets_round: 'ä»ã©ã¦ã³ãã®ããã', bet_amount: 'ãããé¡',
    auto_cashout: 'ãªã¼ãã­ã£ãã·ã¥ã¢ã¦ã', place_bet: 'ããããã',
    mines_count: 'å°é·æ°', gems_found: 'çºè¦ããå®ç³',
    multiplier: 'åç', next_mult: 'æ¬¡ã®åç', potential_win: 'äºæ³å½é¸é¡',
    start_game: 'ã²ã¼ã éå§',
    pick_side: 'é¢ãé¸ã¶', heads: 'HEADS', tails: 'TAILS',
    flip_coin: 'ã³ã¤ã³ãã¹',
    roll_to_play: 'ã­ã¼ã«ãã¦ãã¬ã¤', roll_over: 'ãªã¼ãã¼', roll_under: 'ã¢ã³ãã¼',
    dice_target: 'ã¿ã¼ã²ãã', win_chance: 'åç', roll_dice: 'ãµã¤ã³ã­ãæ¯ã',
    hilo_higher: 'â¬ ãã¤', hilo_cashout: 'ã­ã£ãã·ã¥ã¢ã¦ã', hilo_lower: 'â¬ ã­ã¼',
    prof_referral: 'ç´¹ä»', prof_live_feed: 'ã©ã¤ããã£ã¼ã', prof_alerts: 'ã¢ã©ã¼ã',
    prof_settings: 'è¨­å®',
    ref_share_desc: 'ã³ã¼ããå±æãã¦ç´¹ä»èã®ã©ã¤ãã³ããã·ã§ã³æ´»å(å¥éã»ã¹ã¯ããã»ã·ã§ããã»ã«ã³ãã£ãã»ãã¼ã±ããææ°æ)ã§PPãç²å¾ã',
    ref_my_code: 'ç´¹ä»ã³ã¼ã', ref_code_copied: 'ã³ã¼ããã³ãã¼ï¼',
    ref_enter_code: 'ç´¹ä»ã³ã¼ãå¥å', ref_code_placeholder: 'ã³ã¼ã...',
    ref_referred_by: 'ç´¹ä»èï¼', prof_no_alerts: 'ã¢ã©ã¼ãã¯ã¾ã ããã¾ãã',
    settings_display: 'ãã£ã¹ãã¬ã¤', settings_notifications: 'éç¥',
    settings_account: 'ã¢ã«ã¦ã³ã',
    disp_weather: 'å¤©åãã¼è¡¨ç¤º', disp_commander: 'å¸ä»¤å®ããã¼è¡¨ç¤º',
    disp_rocket: 'ã­ã±ããã¤ãã³ãããã¼è¡¨ç¤º', disp_announce: 'ã¢ãã¦ã³ã¹ãã¼ã­ã¼è¡¨ç¤º',
    disp_emblem: 'ã®ã«ãã¨ã³ãã¬ã è¡¨ç¤º', disp_tag: 'ã®ã«ãã¿ã°è¡¨ç¤º',
    notif_hijack: 'ä¹ã£åãã¢ã©ã¼ã', notif_weather: 'å¤©åã¤ãã³ã',
    notif_rocket: 'ã­ã±ãããã­ãã', notif_mining: 'ãã¤ãã³ã°å®äº', notif_sound: 'å¹æé³',
    acct_change_pw: 'ð ãã¹ã¯ã¼ãå¤æ´', acct_export: 'ð¦ ãã¼ã¿ã¨ã¯ã¹ãã¼ã', acct_delete: 'ð ã¢ã«ã¦ã³ãåé¤',
    nick_new_placeholder: 'æ°ããããã¯ãã¼ã ',
    prof_photo_updated: 'ãã­ãã£ã¼ã«ç»åãæ´æ°ãã¾ããï¼',
    rank_up_title: 'ã©ã³ã¯ã¢ããï¼', rank_up_msg: 'ã¬ãã«{n}ã«å°éï¼',
    wx_active: 'ã¢ã¯ãã£ã',
    wx_sector: 'ã»ã¯ã¿ã¼', wx_time_left: 'æ®ãæé',
    wx_sandstorm: 'ç åµ', wx_sandstorm_desc: 'èãé¢¨ãç ç£¨ç²å­ãå°è¡¨ã«éã¶',
    wx_solar_flare: 'å¤ªé½ãã¬ã¢', wx_solar_flare_desc: 'å¤ªé½ããã®å¼·ãæ¾å°ãé»å­æ©å¨ãå¦¨å®³',
    wx_meteor_shower: 'æµæç¾¤', wx_meteor_shower_desc: 'å°ææã®ç ´çãå°è¡¨ã«éãæ³¨ã',
    wx_dust_devil: 'ãã¹ãããã«', wx_dust_devil_desc: 'æ¸¦å·»ãå¡µã®æ±ãä½æ¦å¹çãä½ä¸ããã',
    wx_mining_yield: 'æ¡æé', wx_movement_speed: 'ç§»åéåº¦', wx_visibility: 'è¦ç',
    wx_shield_strength: 'ã·ã¼ã«ãå¼·åº¦', wx_hijack_cost: 'å¥ªåã³ã¹ã',
    wx_rare_drop: 'ã¬ã¢ãã­ããç', wx_harvest_bonus: 'åç©«ãã¼ãã¹',
    wx_structure_damage: 'æ§é ç©ãã¡ã¼ã¸', wx_claim_cost: 'ç²å¾ã³ã¹ã',
    wx_exploration_speed: 'æ¢ç´¢éåº¦',
    wx_reduced: 'ä½ä¸', wx_possible: 'å¯è½',
    wx_unknown: 'ä¸æãªå¤©åã¤ãã³ã',
    mode_claim: 'ð´ ç«æãã¯ãªãã¯ãã¦é åãé¸æ',
    confirm_purchase: 'è³¼å¥ç¢ºèª',
    global_stats_label: 'ð å¨ä½çµ±è¨',
    active_users_24h: 'ã¢ã¯ãã£ãã¦ã¼ã¶ã¼ï¼24æéï¼',
    top_pixel_holders: 'ð ããããã¯ã»ã«ãã«ãã¼',
    refresh_btn: 'â» æ´æ°',
    // ââ Transport (M-158) ââ
    transport_title: 'ã»ã¯ã¿ã¼éè¼¸é',
    transport_desc: 'GPã«ã¼ã´ãã»ã¯ã¿ã¼éã§è¼¸éãåäººã¯ãã¼ãã¹ãæµ·è³ã¯éä¸­ã§ç¥å¥ªå¯è½ã',
    transport_sub_launch: 'åºçº', transport_sub_my: 'ãã¤è¼¸é', transport_sub_raid: 'ð´ ç¥å¥ªå¯¾è±¡',
    transport_info_title: 'ð GPè²¨ç©è¼¸éã¨ã¯ï¼',
    transport_info_desc: 'ã»ã¯ã¿ã¼A â Bã¸ GPããè²¨ç©ãã¨ãã¦è¼¸éããPvPåçã·ã¹ãã ã',
    transport_info_merchant: 'â <b style="color:#FFB347">åäºº(Merchant)è·æ¥­</b>ã¯ééå®äºæã«<b>ãã¼ãã¹GP</b>ãç²å¾',
    transport_info_raid: 'â ä»ãã¬ã¤ã¤ã¼ãéä¸­ã§ <b style="color:#FF6B6B">è²¨ç©ãç¥å¥ª</b>ã§ãããªã¹ã¯/å ±é¬PvPè¦ç´ ',
    transport_info_targets: 'ð´ RAID TARGETSã¿ãã§ä»ã¦ã¼ã¶ã¼ã®è²¨ç©ãç¥å¥ªå¯è½',
    transport_info_note: 'ð¡ ã¢ã¤ãã å¸å ´ã¨ã¯å¥ â ãã¼ã±ããã¯MARKETã¿ããã',
    transport_launch_new: 'æ°è¦è¼¸é',
    transport_origin: 'åºçºã»ã¯ã¿ã¼', transport_dest: 'å°çã»ã¯ã¿ã¼', transport_cargo: 'ã«ã¼ã´GP',
    transport_launch_btn: 'ð è¼¸ééå§ â¶',
    transport_my_empty: 'é²è¡ä¸­ã®è¼¸éã¯ããã¾ãããå§ãã¦ã¿ã¾ãããï¼',
    transport_raid_empty: 'ç¾å¨ç¥å¥ªå¯è½ãªè¼¸éã¯ããã¾ããã',
    transport_raid_warning: 'â  ç¥å¥ª: ä»ãã¬ã¤ã¤ã¼ã®ã«ã¼ã´ãè¥²æãèªåã¨ã®ã«ãã¡ã³ãã¼ã¯é¤å¤ãè©¦è¡æ¯ã«ã¯ã¼ã«ãã¦ã³é©ç¨ã',
    transport_cancel_btn: 'â ã­ã£ã³ã»ã«',
    transport_raid_btn: 'ð´ ç¥å¥ª',
    // ââ Fleet Command / World Events / Misc (global) ââ
    fcmd_title: 'â ããªã¼ãå¸ä»¤é¨',
    fcmd_sub: 'ããªã¼ã Â· é è¹æ Â· Void Raider',
    fcmd_open_shipyard: 'ð¨ é è¹æ',
    fcmd_my_fleets: 'â ãã¤ããªã¼ã',
    fcmd_tactical_lab: 'ð§ª æ¦è¡ã©ã â é£å½¢ v11.2',
    tlab_title: 'ð§ª æ¦è¡ã©ã',
    tlab_sub: 'é£å½¢ / æ©å v11.2 â ã©ã¤ãã·ãã¥ã¬ã¼ã·ã§ã³',
    tlab_close: 'â éãã',
    ace_title: 'â ã¨ã¼ã¹ã¢ã¼ã',
    ace_sub: 'ç´æ¥æç¸¦ â å¶å¾¡è¿½å°¾ã«ã¡ã©',
    ace_close: 'â éãã',
    we_active_title: 'â  é²è¡ä¸­ã®ã¯ã¼ã«ãã¤ãã³ã',
    we_none_active: 'ã¢ã¯ãã£ããªã¤ãã³ããããã¾ãã',
    we_engage: 'â åæ¦',
    btn_refresh: 'æ´æ°',
    refresh_short: 'â»',
    guild_alliance_title: 'ð¤ ã¢ã©ã¤ã¢ã³ã¹ï¼æå¤§3ã®ã«ãï¼',
    war_declare_subtitle: 'å®£æ¦å¸åããã®ã«ããé¸æãã¦ãã ãã',
    war_declare_title: 'å®£æ¦å¸å',
    war_stake_label: 'â¡ æãéï¼ä»»æï¼: éåº«ããGPãè³­ãã â åèç·åã',
    war_declare_cost_label: 'å®£æ¦è²»ç¨', war_treasury_label: 'ã®ã«ãè²¡åº«',
    war_search_placeholder: 'ð ãã£ã«ã¿ã¼: ã®ã«ãåã¾ãã¯ã¿ã°', war_search_hint: '2æå­ä»¥ä¸å¥åãã¦ãã ãã',
    bd_search_hint: '2æå­ä»¥ä¸å¥åãã¦ãã ãã', battle_attack_start: 'æ»æéå§',
    reward_battle_title: 'ð æ¦éå ±é¬', btn_confirm: 'ç¢ºèª', btn_cancel: 'ã­ã£ã³ã»ã«',
    tn_tab_open: 'åéä¸­', tn_tab_running: 'é²è¡ä¸­', tn_tab_completed: 'å®äº',
    rp_tab_featured: 'ãããã', rp_tab_mine: 'ãã¤å±æ',
    bd_my_fleet_label: 'èªè¦é (æ»æå´)', bd_recommended_label: 'æ¨è¦å¯¾æ¦ç¸æ (ä¼¼ãå®å)', bd_search_label: 'å¯¾æ¦ç¸æãæ¤ç´¢', bd_search_input_placeholder: 'ããã¯ãã¼ã ã¾ãã¯è¦éå (2æå­ä»¥ä¸)...',
    ca_subtitle: '// æ¦éåæ¦è¡æç¤º (æå¤§ <span id="caMaxSel">2</span>)', ca_doctrines_label: 'ð DOCTRINE PRESETS â ã¯ã³ã¯ãªãã¯æ¦è¡ããªã»ãã (æ¨è¦)', ca_sniper_actions: 'focus_fire (1 GPç¯ç´)',
    ca_focus_desc: 'æå®æµè¦éã«éä¸­æ»æ â <b style="color:#ffd54f">+15% ãã¡ã¼ã¸</b>', ca_emp_desc: 'æå®tickã«EMP â æµçºå°éé <b style="color:#ffd54f">Ã5åéå»¶</b> 30tick', ca_wedge_desc: 'çªææ¦è¡å¼·å¶ â éåº¦/æ»æ â, é²å¾¡ â', ca_reinforce_desc: 'éå§æã«è¿½å è¦è¹æå¥ (1~20é»)',
    ca_focus_target_label: 'å¯¾è±¡æµè¦é', ca_focus_auto_hint: 'å®£æ¦å¸åç¸æè¦éãèªåæå®ããã¾ã', ca_emp_tick_label: 'EMPçºåtick (0~8000, ããã©ã«ã1200 â 4å)', ca_emp_tick_hint: '1 tick = 200ms, æç¶ 30 tick', ca_wedge_hint: 'ãã©ã¡ã¼ã¿ãªã â èªè¦éå¨å¡ã«é©ç¨ããã¾ã', ca_reinforce_label: 'å¢æ´è¦è¹', ca_reinforce_hint: 'æå¤§20é» â è¦è¹ã³ã¼ã Ã æ°é',
    ca_quota: 'é¸æ <b id="caSelectedN">0</b> / <span id="caMaxSel2">2</span>', ca_skip_btn: 'ã¹ã­ãããã¦æ¦ééå§', ca_apply_btn: 'æç¤ºé©ç¨ & æ¦é',
    ai_practice_desc: 'é£æåº¦å¥AIããªã¼ãã¨ã®ç·´ç¿æ¦éãå ±é¬ã¯éå¸¸æ¦éã®50%ã', tn_create_btn: 'ãã¼ãã¡ã³ãéå¬',
    bh_title_kr: 'è¦éæ¦', bh_tab_recent: 'æè¿', bh_tab_history: 'ãã¤è¨é²', bh_declare_btn: 'æ¦éå®£è¨', bd_subtitle: '// å¯¾æ¦ç¸æãæ¢ãã¦ãã ãã',
    war_duration_label: 'â± æé (æ): ããã©ã«ã72æé',
    war_declare_btn: 'âï¸ å®£æ¦å¸å',
    war_declaring_btn: 'å®£æ¦ä¸­...',
    war_treasury_low: 'éåº«GPä¸è¶³ ({need}å¿è¦ãä¿æ{have})',
    codex_subtitle: 'å¬å¼ã²ã¼ã ã¬ã¤ãããã¯',
    loading: 'èª­ã¿è¾¼ã¿ä¸­â¦',
    campaign_profile_btn: 'ð ãã­ãã£ã¼ã«', // [i18n backfill v7.172]
    campaign_btn_start: 'ã¹ã¿ã¼ã', campaign_btn_continue: 'ç¶ãã',
    campaign_btn_results: 'çµæ', campaign_btn_locked: 'ã­ãã¯æ¸',
    campaign_label_completed: 'å®äº', campaign_label_prologue: 'ãã­ã­ã¼ã°',
    campaign_label_route: 'ã«ã¼ã', campaign_label_ch: 'CH',
    campaign_no_chapters: 'å©ç¨å¯è½ãªã­ã£ã³ãã¼ã³ãããã¾ããã',
    campaign_no_faction: 'æ´¾é¥ãé¸æããã¨ã­ã£ã³ãã¼ã³ãè§£æ¾ããã¾ãã',
    campaign_show_locked: 'ã­ãã¯æ¸ãè¡¨ç¤º', campaign_hide_locked: 'ã­ãã¯æ¸ãé ã',
    campaign_meta_sim: 'ãµã¼ãã¼ã·ãã¥ã¬ã¼ã·ã§ã³',
    campaign_reward_claimed: 'å ±é¬ååå®äº',
    campaign_objective_go: 'ç§»å',
    campaign_result_success: 'ããã·ã§ã³å®äº',
    campaign_result_failure: 'ããã·ã§ã³å¤±æ',
    campaign_result_npc_success: 'ä½æ¦ç®æ¨éæãæ¬¡ã®ãã§ã¼ãºã¸é²ãã',
    campaign_result_npc_failure: 'ä½æ¦å¤±æãçµæã¯è¨é²ãããã',
    campaign_result_reward: 'å ±é¬:',
    campaign_result_confirm: 'ç¢ºèª',
    campaign_result_recheck: 'åç¢ºèª',
    campaign_objectives_gate: 'æ®ãã®ç®æ¨ãåã«å®äºãã¦ãã ããã',
    campaign_objectives_gate_sub: 'ã¿ã¤ãã¼ã¯çµäºãã¾ãããããã¬ã¤æ¡ä»¶ãã¾ã ä¸è¶³ãã¦ãã¾ãã',
    campaign_sim_in_progress: 'ä½æ¦é²è¡ä¸­...',
    campaign_sim_radio_prefix: 'ç¡ç·:',
    campaign_sim_radio_default: 'ä½æ¦ç¶æ³ã¢ãããã¼ãã',
    campaign_sim_syncing: 'ä½æ¦ç¶æãåæä¸­...',
    campaign_sim_detail: 'ãµã¼ãã¼é²æã«åºã¥ãã¦å®äºãã¾ãã',
    story_skip: 'ã¹ã­ãã',
    story_skip_title: 'æ¬¡ã®ã·ã¼ã³ã¸',
    story_abandon: 'çµäº',
    story_abandon_title: 'ã·ããªãªãçµäºãã¦ãã£ãã¿ã¼é²è¡ãæ¾æ£ãã¾ã',
    story_tap_hint: 'ã¿ãããã¦ç¶ãã',
    story_abandon_confirm_title: 'ã·ããªãªçµäº',
    story_abandon_confirm_body: 'é²è¡ä¸­ã®ãã£ãã¿ã¼ãæ¾æ£ãã¦ã·ããªãªãçµäºãã¾ãããã§ã«ããé¸æã¯ç¶­æããã¾ãã',
    btn_close: 'â éãã',
    lo_tagline: 'ç«æã®é åãã¯ã¬ã¼ã ãã¦<br>å¸å½ãç¯ã',
    lo_feat1: 'ç«æãããã§ãªã¢ã«ã¿ã¤ã ãã¯ã»ã«é åã¯ã¬ã¼ã ',
    lo_feat2: 'è¦éæ¦ Â· æ»åæ¦ Â· 1:1 GPæ±ºé',
    lo_feat3: 'ãã¡ã¯ã·ã§ã³ã¨ã®ã«ãã§åçãæ§ç¯',
    lo_feat4: 'æ¡æ Â· å¼·å Â· ãã¼ã±ãããã¬ã¤ã¹',
    lo_btn_start: 'ð ä»ããå§ãã',
    lo_btn_browse: 'ã¾ãå°çåãè¦ã',
    wb_tab_active: 'ð¥ ã¢ã¯ãã£ãã¤ãã³ã', wb_tab_recent: 'ð æè¿ã®çµæ', wb_tab_mine: 'ð ãã¤ããã',
    sy_sort_price_asc: 'ä¾¡æ ¼ï¼ä½ãé ', sy_sort_price_desc: 'ä¾¡æ ¼ï¼é«ãé ',
    sy_sort_power_desc: 'å¼·åï¼é«ãé ', sy_sort_newest_listed: 'ææ°ç»é²é ',
    bv_share: 'å±æãã',
    bv_my_victory: 'ð åå©ï¼', bv_my_defeat: 'ð æå',
    bv_atk_won: 'æ»æè»ã®åå©', bv_def_won: 'é²è¡è»ã®åå©', bv_draw_result: 'å¼ãåã',
    bv_stat_total_ships: 'ç·è¦æ°', bv_stat_losses: 'æå¤±', bv_stat_damage: 'ãã¡ã¼ã¸',
    bv_my_badge: 'èªå',
    fleet_no_fleet_hint: 'è¦éãªã â é è¹æã§è¦è¹ãå»ºé ãã¦ãã ãã',
    fleet_no_ships_hint: 'è¦è¹ãªã<br>é è¹æã§å»ºé ãã¦ãã ãã',
    fleet_no_combat_fleet: 'æ¦éå¯è½ãªè¦éãããã¾ãããé è¹æã§è¦è¹ãå»ºé ãã¦ãã ããï¼',
    fleet_both_no_fleet: 'åæ¹ã¨ãæ¦éå¯è½ãªè¦éãããã¾ããã',
    fleet_enemy_no_fleet: 'æµã®ã«ãã«æ¦éå¯è½ãªè¦éãããã¾ããã',
    ob_line1: 'ã2067å¹´ãå°çã®è³æºãæ¯æ¸ãããã',
    ob_line2: 'ãç«æãæå¾ã®å¸æã ãã',
    ob_line3: 'ãããªãã¯ä»æ¥ãæåã®ä¸æ­©ãè¸ã¿åºãéæèã ãã',
    ob_btn_land: 'ð ç«æã«çé¸', ob_btn_skip: 'ã¹ã­ãã',
    ob_step1_title: 'éå½ãé¸ã¹',
    ob_step1_sub: 'ç«æã§ã©ããªéæèã«ãªãã',
    ob_job_change_note: 'å¾ã§å¤æ´å¯è½ï¼é±1åç¡æï¼',
    ob_step1_choose: 'è·æ¥­ãé¸ãã§ãã ãã',
    ob_step2_title: 'ãã¡ã¯ã·ã§ã³ãé¸ã¹',
    ob_step2_sub: 'ç«æã®ä¸å¢åã®ã²ã¨ã¤ã«å å¥',
    ob_step2_free_note: 'ååé¸æç¡æ Â· å¤æ´ã¯500 GP',
    ob_step2_already: 'ãã¡ã¯ã·ã§ã³ã¯æ¢ã«é¸æããã¦ãã¾ãã',
    ob_step2_continue: 'ç¶ãã â',
    ob_step2_loading: 'èª­ã¿è¾¼ã¿ä¸­...',
    ob_step2_load_fail: 'èª­ã¿è¾¼ã¿å¤±æ â å¾ã§é¸æãæ¼ãã¦ãã ãã',
    ob_step2_choose: 'ãã¡ã¯ã·ã§ã³ãé¸ãã§ãã ãã', ob_step2_skip: 'å¾ã§é¸æ',
    ob_confirm: 'é¸æç¢ºå®', ob_processing: 'å¦çä¸­...',
    ob_faction_error: 'ãã¡ã¯ã·ã§ã³é¸æå¤±æ: ',
    ob_faction_success: 'ð¡ ãã¡ã¯ã·ã§ã³é¸æå®äºï¼',
    ob_step3_title: 'æåã®é åãå é ãã',
    ob_step3_sub: 'å°å³ã®ç©ºç½ã¨ãªã¢ãã¯ãªãã¯ãã¦ã¯ã¬ã¼ã ã§ãã¾ã',
    ob_step3_free: 'â¨ æåã®é åã¯ç¡æ',
    ob_step3_tip1: 'ãã®ããã«ãéããã¨å°çåãè¡¨ç¤ºããã¾ã',
    ob_step3_tip2: 'ç«æã®ç©ºç½ã¨ãªã¢ãã¯ãªãã¯ããã¨ã¯ã¬ã¼ã ããã«ãéãã¾ã',
    ob_step3_tip3: 'CONFIRMãæ¼ãã¨é åãç¢ºå®ãã¾ã',
    ob_step3_got_it: 'ðºï¸ ããã£ããå§ãããï¼',
    ob_step3_next: 'æ¬¡ã¸',
    ob_step4_title: 'æºåå®äºï¼', ob_step4_sub: 'ç«æã¸ãããããéæèã',
    ob_step4_mission_label: 'æ¬æ¥ã®æåã®ããã·ã§ã³',
    ob_step4_mission_reward: 'å®äºã§ +{gp} GP',
    ob_step4_start: 'ð ç«ææ¢æ¤éå§ï¼',
    ob_reward_pioneer: 'ð ãã¤ãªãã¢',
    ob_reward_gp: '+{n} GP ç²å¾ï¼', ob_reward_pp: '+{n} PP ç²å¾ï¼',
    ob_reward_item: '{code} ç²å¾ï¼', ob_reward_title: 'ç§°å·ã{name}ãç²å¾ï¼',
    ob_starter_ship: 'ð ã¹ã¿ã¼ã¿ã¼è¦è¹æ¯çµ¦ï¼{name} Ã 1',
    guild_donate_placeholder: 'å¯ä»ããGPé¡ãå¥å', guild_donate_btn: 'å¯ä»',
    auth_motto_placeholder: 'ã³ã­ãã¼ã¢ããã¼â¦', auth_status_placeholder: 'ã¹ãã¼ã¿ã¹ã¡ãã»ã¼ã¸â¦', auth_vtag_placeholder: 'ã¿ã°â¦',
    // ââ v6.08 Battle Report ââââââââââââââââââââââââââââââââââ
    bv_performance: 'ããã©ã¼ãã³ã¹', bv_rating: 'ã¬ã¼ãã£ã³ã°', bv_efficiency: 'å¹ç',
    bv_highlights: 'æ¦éãã¤ã©ã¤ã', bv_view_report: 'ð è©³ç´°ã¬ãã¼ã', bv_my_stats: 'ð èªåã®æ¦ç¸¾',
    bv_mvp: 'MVP', bv_flagship_ok: 'æè¦ï¼çå­', bv_flagship_lost: 'æè¦ï¼ææ²',
    bv_report_loading: 'ã¬ãã¼ãèª­è¾¼ä¸­â¦', bv_report_error: 'ã¬ãã¼ãåå¾å¤±æ',
    bv_stat_survived: 'çå­', bv_stat_efficiency: 'å¹ç',
    bvstat_w: 'å', bvstat_l: 'æ', bvstat_d: 'å',
    bvstat_kd: 'K/D', bvstat_winrate: 'åç', bvstat_streak: 'æé·é£å',
    bvstat_best: 'æé«ã¬ã¼ãã£ã³ã°', bvstat_title: 'èªåã®æ¦éè¨é²',
    bvstat_total: 'ç·æ¦éæ°', bvstat_close: 'éãã',
    // ââ v6.08 Daily OPS ââââââââââââââââââââââââââââââââââââââ
    daily_ops_title: 'â¡ DAILY OPS', daily_ops_subtitle: 'ãªã»ãã: UTC 00:00',
    daily_ops_no_missions: 'ãã¤ãªã¼ããã·ã§ã³ãå®äºãã¦GPå ±é¬ãç²å¾',
    daily_ops_claim: 'åå', daily_ops_claimed: 'ååæ¸', daily_ops_completed: 'å®äº',
    daily_ops_event_today: 'æ¬æ¥ã®ã¤ãã³ã', daily_ops_loading: 'ããã·ã§ã³èª­è¾¼ä¸­â¦',
    daily_ops_all_claimed: 'æ¬æ¥ã®ããã·ã§ã³å¨ã¦ååæ¸ï¼ææ¥ã¾ãã©ããã',
    // ââ v6.08 Territory Identity âââââââââââââââââââââââââââââ
    territory_identity_title: 'é åã¢ã¤ãã³ãã£ãã£', territory_fr: 'ãã£ã¼ã«ãã¬ã¼ãã£ã³ã°',
    territory_nickname: 'åå', territory_bio: 'èª¬æ',
    territory_edit_identity: 'â åå/èª¬æãç·¨é', territory_save_identity: 'ä¿å­',
    territory_badge_pioneer: 'â éæè (7æ¥)', territory_badge_settler: 'ð  å¥æ¤è (30æ¥)',
    territory_badge_veteran: 'ð ããã©ã³ (90æ¥)', territory_badge_fortress: 'ð¡ è¦å¡',
    territory_defense_wins: 'é²è¡åå©', territory_times_hijacked: 'è¢«è¥²æåæ°',
    territory_hold_days: 'ä¿ææ¥æ°', territory_hold_bonus: 'æ¡æãã¼ãã¹',
    territory_fr_tier_newcomer: 'æ°åè', territory_fr_tier_pioneer: 'éæè',
    territory_fr_tier_settler: 'å¥æ¤è', territory_fr_tier_fortress: 'è¦å¡',
    territory_fr_tier_legend: 'ä¼èª¬',
    // ââ v6.08 Bounty Board ââââââââââââââââââââââââââââââââââââ
    bounty_title: 'ð° è³éæ²ç¤ºæ¿', bounty_post: 'è³éãæ²ç¤º',
    bounty_post_target: 'ã¿ã¼ã²ããã¦ã©ã¬ãã', bounty_post_amount: 'GPå ±é¬',
    bounty_post_reason: 'çç±ï¼ä»»æï¼', bounty_post_submit: 'è³éãæ²ç¤º',
    bounty_no_bounties: 'ã¢ã¯ãã£ããªè³éãªã',
    bounty_reward: 'å ±é¬', bounty_expires: 'æé',
    bounty_on_me: 'èªåã¸ã®è³é', bounty_claim_hint: 'ã¿ã¼ã²ããã¨ã®æ¦éã«åå©ãã¦åå',
    bounty_cancel: 'ã­ã£ã³ã»ã« & è¿é',
    // ââ v6.08 PvP Matchmaking âââââââââââââââââââââââââââââââââ
    pvp_rec_title: 'ð¯ ããããã®å¯¾æ¦ç¸æ',
    pvp_rec_cpi: 'CPI', pvp_rec_ships: 'è¦è¹', pvp_rec_wins: 'åå©',
    pvp_rec_challenge: 'ææ¦', pvp_rec_loading: 'ç¸æãæ¢ç´¢ä¸­â¦',
    pvp_rec_no_opponents: 'é©åãªç¸æãè¦ã¤ããã¾ãã', pvp_rec_cpi_diff: 'æ¦åå·®',
    // ââ Missing keys (added) ââ
    base_tab_items: 'ãã¤ã¢ã¤ãã ', shop_cat_material: 'â ç´ æ',
    hijack_no_fleet_label: 'è¦éãªã â ãã¤ã¸ã£ãã¯ä¸å¯',
    hijack_no_fleet_hint: 'BASE â FLEETã¿ãã§è¦éãä½æãã¦ãã ãã',
    hijack_fleet_loading: 'è¦éæå ±ãèª­ã¿è¾¼ã¿ä¸­...',
    fleet_battle_hub_btn: 'è¦éæ¦HUBãéã',
    pvp_ai_practice: 'AIç·´ç¿', pvp_tournament: 'ãã¼ãã¡ã³ã', pvp_shipyard: 'é è¹æ',
    inv_cat_all: 'å¨ã¦', inv_cat_defense: 'é²å¾¡', inv_cat_attack: 'æ»æ',
    inv_cat_utility: 'ã¦ã¼ãã£ãªãã£', inv_cat_boost: 'ãã¼ã¹ã', inv_cat_cosmetic: 'ã³ã¹ã¡',
    my_territory_title: 'ãã¤ããªããªã¼', login_to_view_territory: 'é åãè¡¨ç¤ºããã«ã¯ã­ã°ã¤ã³ãã¦ãã ãã',
    bc_waiting: 'å¾æ©ä¸­', bc_atk_win: 'æ»æåå©', bc_def_win: 'é²å¾¡åå©',
    bc_in_progress: 'é²è¡ä¸­', bc_scheduled: 'äºå®',
    bc_type_duel: 'PvPæ±ºé', bc_type_siege: 'åå²æ¦', bc_type_hijack: 'ãã¤ã¸ã£ãã¯',
    bc_type_raid: 'ã¬ã¤ã', bc_type_event: 'ã¤ãã³ã',
    gw_auto_win_title: 'èªååå©', gw_auto_win_body: 'æµã®ã«ãã«æ¦éå¯è½ãªè¦éãããã¾ããã',
    gw_auto_win_pts: 'èªååå©ã§ã®ã«ãæ¦ãã¤ã³ããç²å¾ (+10 pts)',
    gw_auto_win_limit: '24æéã«1åä½¿ç¨å¯è½', gw_auto_win_btn: 'ð èªååå©ãç²å¾',
    gw_auto_win_toast: 'ð èªååå©ï¼+{pts} pts ç²å¾',
    gw_auto_win_cooldown: '24æéä»¥åã«èªååå©ãä½¿ç¨æ¸ã¿ã§ã',
    gw_enemy_has_fleets: 'æµã«è¦éãçã¾ãã¾ãã â ç´æ¥æ¦éãã¦ãã ãã',
    siege_info_block: '<b style="color:var(--red);font-size:10px">âï¸ ã»ã¯ã¿ã¼åå²æ¦ã¨ã¯ï¼</b><br>ã»ã¯ã¿ã¼ã§æå¤§é åä¿æèï¼ç¥äºï¼ãåãæ¦äºã<br><b style="color:var(--tx2)">â  ã»ã¯ã¿ã¼é¸æ</b> â <b style="color:var(--tx2)">â¡ åå²å®£è¨ (GPã³ã¹ã)</b> â <b style="color:var(--tx2)">â¢ è­¦åæé</b> â <b style="color:var(--tx2)">â£ æ¦éæé</b><br>å é çãæãé«ãå´ãç¥äºã«ãªãã¾ãã<br><span style="color:var(--gold)">ð¡ è¦ä»¶: å¯¾è±¡ã»ã¯ã¿ã¼ã«é åãææ</span>',
    fleet_battle_info_block: '<b style="color:var(--cyan);font-size:10px">â è¦éæ¦ã¨ã¯ï¼</b><br>è¦éãçãã¦ä»ãã¬ã¤ã¤ã¼ã¨PvPæ¦éãå®£è¨ã<br><b style="color:var(--tx2)">â  é è¹æã§è¦è¹å»ºé </b> â <b style="color:var(--tx2)">â¡ è¦éç·¨æ</b> â <b style="color:var(--tx2)">â¢ Battle Hubã§å®£è¨</b> â <b style="color:var(--tx2)">â£ çµæç¢ºèª</b>',
    mt_rename: 'âï¸ ååå¤æ´', mt_decorate: 'â¨ ã«ã¹ã¿ãã¤ãº', mt_sell: 'ð° å£²å´', mt_shield: 'ð¡ï¸ ã·ã¼ã«ã', mt_upgrade: 'ð§ ã¢ããã°ã¬ã¼ã', mt_hijack: 'â HIJACK ããªããªã¼',
    br_hint: 'Claudeãèª­ãã§ä¿®æ­£ãã¾ã', br_label_desc: 'ãã°ã®èª¬æ *', br_desc_placeholder: 'ãã°ã®åå®¹ãèª¬æãã¦ãã ããã\nä¾)æ¦éå¾ã«GPãä»ä¸ãããªã',
    br_label_ss: 'ã¹ã¯ãªã¼ã³ã·ã§ãã (ä»»æ)', br_ss_placeholder: 'ð¸ ã¯ãªãã¯ã¾ãã¯ã¹ã¯ãªã¼ã³ã·ã§ãããè²¼ãä»ã (Cmd+V / Ctrl+V)', br_ss_drag: 'ã¾ãã¯ãã¡ã¤ã«ãããã«ãã©ãã°', br_capturing: 'ç»é¢ã­ã£ããã£ä¸­...', br_submit: 'éä¿¡ãã', br_clear_ss: 'ã¹ã¯ãªã¼ã³ã·ã§ããåé¤',
    ops_board_title: 'ð ä»æ¥ã®ä½æ¦ãã¼ã', ops_legend_done: 'ð¢ å®äº', ops_legend_pending: 'âª æªå®äº', ops_legend_urgent: 'ð´ ç·æ¥',
    pvp_rewards_btn: 'ð å ±é¬å±¥æ­´', // [i18n backfill v7.172]
    pvp_declare_btn: 'â æ¦éå®£è¨', pvp_tab_rec: 'ð¯ æ¨è¦ç¸æ', pvp_tab_bounty: 'ð° è³é', pvp_tab_conflict: 'ð¥ ã»ã¯ã¿ã¼ç´äº',
    kb_hub_title: 'ã­ã«ãã¼ã & æå ±', kb_tab_board: 'ã­ã«ãã¼ã', kb_tab_scout: 'åµå¯',
    betrayer_mark_title: 'è£åãèã®çå°', betrayer_mark_desc: 'è£åãèã®çå°ãä»ãã¦ãã¾ããGPãæ¯æãè©å¤ãåå¾©ãã¾ãããã', betrayer_redeem_btn: 'è´ç½ª',
    wb_title: 'ð¯ WAR BETTING', forge_upgrading: 'ð¨ å¼·åä¸­...',
    we_select_fleet: 'è¦éé¸æ...', we_fleet_min: 'æä½1é»ã®è¦è¹ãå¿è¦ã§ã',
    pvp_goto_tab: 'â PVPã¿ãã¸ â', pvp_from_tab: 'â PVPã¿ãã§ â',
    guild_gp_donate_lbl: 'ð° GPå¯ä»', prof_customize_title: 'âï¸ ãã­ãã£ã¼ã«ç·¨é',
    vip_pass_title: 'ð« VIPãã¹ã¨ã¯ï¼',
    vip_pass_desc: 'PPï¼ãã©ããããã¤ã³ãï¼ã§è³¼å¥ãã<b style="color:#ce93d8">æééå®ãã¬ãã¢ã ãµãã¹ã¯ãªãã·ã§ã³</b>ã§ãã<br>â¢ â <b>æ¡æéåº¦ +%</b>ï¼ç­ç´ã«ããç°ãªãï¼<br>â¢ ð° <b>GPç²å¾éãã¼ãã¹</b><br>â¢ ð <b>æéã¯ã¬ã¼ãæ¯çµ¦</b><br>â¢ ð <b>VIPå°ç¨ç§°å·ã»ã¢ãã¿ã¼</b><br>PPã¯è³¼å¥ã¾ãã¯ã·ã¼ãºã³å ±é¬ã§ç²å¾ã§ãã¾ãã',
    crate_what_title: 'ð¦ ã¯ã¬ã¼ãã¨ã¯ï¼',
    crate_what_desc: 'GPã¾ãã¯PPã§è³¼å¥ãã<b style="color:#ffcc02">ã©ã³ãã ã¢ã¤ãã ããã¯ã¹</b>ã§ãã<br>â¢ ð¯ <b>é²è¡ã¢ã¤ãã </b> â é åå¼·åã»é²è¡è£ç½®<br>â¢ â <b>æ¦éã¢ã¤ãã </b> â è¦è¹å¼·åã»æ»æãã¼ã¹ã<br>â¢ ð <b>ã³ã¹ã¡ãã£ãã¯</b> â ç§°å·ã»ã¢ãã¿ã¼ã»é åãã¬ã¼ã <br>â¢ â¨ <b>ã¬ã¢ã¢ã¤ãã </b> â ä½ç¢ºçã§ã¨ãªã¼ãç­ç´<br>éããã¢ã¤ãã ã¯ã¤ã³ãã³ããªã§ç¢ºèªããã¼ã±ããã§è²©å£²ã§ãã¾ãã',
    prestige_what_title: 'â­ ãã¬ã¹ãã£ã¼ã¸ã¨ã¯ï¼',
    prestige_what_desc: 'GPãæ¶è²»ãã¦<b style="color:#ffd54f">æ°¸ä¹ã©ã³ã­ã³ã°ã¹ã³ã¢</b>ãç©ã¿ä¸ããã·ã¹ãã ã§ãã<br>â¢ ðª¨ Colonist â ð¥ Pioneer â ð¥ Commander â ð¥ Vanguard â ð Sovereign<br>â¢ é«ãç­ç´ã»ã©<b>ãªã¼ãã¼ãã¼ãä¸ä½è¡¨ç¤º</b>ï¼å°ç¨ç§°å·ã»ãã¬ã¼ã ç²å¾<br>â¢ ãã¬ã¹ãã£ã¼ã¸ãã¤ã³ãã¯<b style="color:#ff8a80">æ°¸ä¹</b>ã§ãã¦ã³ã°ã¬ã¼ããªã<br>â¢ é åã¯ã¬ã¼ã ã«ã<b>ãã¬ã¹ãã£ã¼ã¸ãã¬ã¼ã </b>ãé©ç¨ã§ãã¾ã',
    /* === static markup i18n (added) === */
    ref_code_ph: 'コード...',
    prod_section: '⚙ 生産',
    upgrades_section: '🔧 アップグレード',
    edit_label: '✏ 編集',
    campaign_quick: 'キャンペーン',
    campaign_quick_sub: 'ストーリー',
    select_your_fleet: '⚔ 艦隊を選択',
    change_image_btn: '画像を変更',
    save_image_btn: '画像を保存',
    current_balance: '現在の残高',
    first_deposit_bonus: '初回入金ボーナス',
    select_chain: 'チェーンを選択',
    deposit_address: '入金アドレス',
    copy_address: '📋 アドレスをコピー',
    available_usdt: '利用可能 USDT',
    withdraw_amount: '出金額',
    max_btn: '最大',
    swap_pp_usdt_title: 'PP → USDT スワップ',
    swap_amount_pp: 'スワップ額 (PP)',
    exchange_pp_gp_title: 'PP → GP 交換',
    gp_balance: 'GP 残高',
    exchange_amount_pp: '交換額 (PP)',
    confirm_exchange: '交換を確定',
    mg_invaders: 'インベーダー',
    mg_invaders_sub: '撃って生き残れ',
    mg_runner: 'ランナー',
    mg_runner_sub: '走って避けろ',
    mg_digger: 'ディガー',
    mg_digger_sub: '掘って集めろ',
    close_btn: '閉じる',
    game_over: 'ゲームオーバー',
    mg_continue: 'コンティニュー',
    mg_submit_score: 'スコア送信',
    check_in_today: '今日チェックイン',
    prof_motto: 'モットー',
    prof_set: '設定',
    prof_status: '💬 ステータス',
    prof_vanity_tag: '🏷️ バニティタグ',
    prof_avatar_color: 'アバターの色',
    tos_title: '利用規約',
    privacy_title: 'プライバシーポリシー',
    cantina_disclaimer_title: 'カンティーナゲーム免責事項',
    cantina_enter: '理解しました — カンティーナへ',
    cookie_accept: '同意',
    footer_tos: '利用規約',
    footer_privacy: 'プライバシーポリシー',
    faction_selection: '陣営選択',
    faction_select_sub: '// 陣営を選択',
    faction_cancel: 'キャンセル',
    faction_select: '選択',
    edit_guild_title: 'ギルド編集',
    edit_guild_sub: '名称変更 · エンブレム編集 · 説明更新',
    ge_preview: 'プレビュー',
    ge_preview_hint: 'ピクセルアートのエンブレムは32×32に自動調整。PNG/JPG 2MB以下。',
    ge_guild_name: 'ギルド名',
    ge_description: '説明',
    ge_desc_ph: 'ギルドのスローガン / 説明...',
    ge_emblem: 'エンブレム',
    ge_emoji: '絵文字',
    ge_upload: 'アップロード',
    ge_choose_image: '📁 画像を選択 (自動32×32)',
    ge_clear: 'クリア',
    ge_emblem_hint: '32×32では太いシルエットが最適。鮮明なピクセルアートには透過PNG推奨。',
    ge_total_cost: '合計コスト',
    cancel_changes: 'キャンセル',
    save_changes: '変更を保存',
    onboarding_first_landing: '初上陸',
    onboarding_first_landing_body: '最初の火星領土を確保して始めよう。',
    onboarding_open_base: 'BASEを開く',
    onboarding_dismiss: '閉じる',
    comms_label: '💬 通信',
    settings_legal: '法的情報',
    acct_tos: '📜 利用規約',
    acct_privacy: '🔒 プライバシーポリシー',
    change_password_title: 'パスワード変更',
    current_password_ph: '現在のパスワード',
    new_password_ph: '新しいパスワード (8文字以上)',
    confirm_password_ph: '新しいパスワードの確認',
    join_telegram: '✈ テレグラム参加',
    agree_terms: '<a onclick="openTosModal();event.stopPropagation()">利用規約</a>と<a onclick="openPrivacyModal();event.stopPropagation()">プライバシーポリシー</a>に同意します',
    remember_id_pw: 'ID/PW を記憶',
    auto_login: '自動ログイン',
    select_image_file: '画像ファイルを選択',
    scale_label: 'スケール',
    min_btn: '最小',
    link_url_label: 'リンクURL',
    link_url_ph: 'https://your-site.com',
    preview_on_mars: '火星でプレビュー',
    stamp_cancel: '✕ キャンセル',
    drag_to_position: 'ドラッグで位置調整',
    stamp_ok: '✓ OK',
    tos_body: '<h3>1. OCCUPY MARS について</h3><p>Occupy Marsは仮想の火星を舞台にしたブラウザベースの領土戦略ゲームです。プレイヤーは土地を取得し、資源を採掘し、相手と戦い、ゲーム内通貨を取引します。本ゲームは娯楽目的で「現状のまま(as is)」提供されます。</p><h3>2. PLANET POINTS (PP) &mdash; ゲーム内通貨</h3><p>Potato Points(PP)はOccupy Mars内で使用される主要なゲーム内通貨です。PPは実際の金銭、法定通貨、暗号資産では<strong>ありません</strong>。PPはゲーム外で固有の金銭的価値を持ちません。</p><p>PPはゲームプレイ(採掘、クエスト、戦闘)で獲得するか、対応する決済手段で購入できます。すべてのPP購入は、適用法令で要求される場合を除き、最終的で返金不可です。</p><h3>3. USDT 出金</h3><p>一定の条件下で、プレイヤーはPPをUSDTに変換し出金を申請できます。出金の可否は以下に左右されます:</p><ul><li>最低残高および本人確認の要件</li><li>不正防止およびマネーロンダリング防止(AML)のチェック</li><li>処理時間(変動する場合があります)</li><li>出金額から差し引かれるネットワーク手数料</li><li>セキュリティまたはメンテナンスのために出金を停止するゲーム運営者の権利</li></ul><p>PPとUSDTの交換レートはゲームが決定し、事前通知なく変更される場合があります。</p><h3>4. ユーザーの行動規範</h3><p>本サービスを利用することで、以下の行為を行わないことに同意します:</p><ul><li>ボット、スクリプト、自動化ツールの使用</li><li>バグや不具合の悪用(代わりに報告してください)</li><li>他のプレイヤーへの嫌がらせ、脅迫、なりすまし</li><li>ゲーム経済の操作の試み</li><li>不当な優位を得るための複数アカウント作成</li><li>公式チャネル外でのアカウントやゲーム内資産の現金取引</li></ul><h3>5. アカウントの停止・削除</h3><p>当社は本規約に違反するアカウントを停止または削除する権利を有します。これには以下が含まれますが、これらに限りません:</p><ul><li>チート、ボット使用、悪用</li><li>不正な入金またはチャージバック</li><li>他のプレイヤーやスタッフへの迫害行為</li><li>適用法令の違反</li></ul><p>削除されたアカウントは残ったPP残高を失う場合があります。不正またはセキュリティ上の脅威の場合を除き、削除前に通知するよう努めます。</p><h3>6. 知的財産権</h3><p>すべてのゲームコンテンツ、コード、アート、テキスト、デザインはOccupy Marsチームに帰属します。プレイヤーがアップロードした画像はその作成者の所有物ですが、それをゲーム内で表示するライセンスを当社に付与するものとします。ゲームのいかなる部分も複製、配布、リバースエンジニアリングしてはなりません。</p><h3>7. 責任の制限</h3><p>本ゲームはいかなる種類の保証もなく提供されます。当社は以下について責任を負いません:</p><ul><li>バグ、サーバー障害、メンテナンスによるゲーム内通貨や進行状況の損失</li><li>ブロックチェーンネットワークの遅延または障害</li><li>アカウントへの不正アクセス(強固なパスワードを使用してください)</li><li>間接的、付随的、結果的な損害</li></ul><p>当社の総責任は、いかなる請求の前12ヶ月間に貴方が当社に支払った金額を超えないものとします。</p><h3>8. 規約の変更</h3><p>当社はいつでも本規約を更新することができます。変更後もゲームを使用し続けることは、これへの同意とみなされます。重要な変更はゲーム内お知らせで通知します。</p><h3>9. 準拠法</h3><p>本規約は、ゲーム運営者が登録されている管轄区域の法律に準拠します。紛争はまず誓実な協議を通じて解決されます。</p><h3>10. お問い合わせ</h3><p>本規約に関するご質問は、ゲーム内サポートチャネルまたは公式サイトに記載のメールでお問い合わせください。</p><div class="legal-update">最終更新: 2026年4月9日 &mdash; バージョン 1.0</div>',
    privacy_body: '<h3>1. 収集するデータ</h3><p>貴方がOccupy Marsを利用する際、当社は以下を収集することがあります:</p><ul><li><strong>アカウント情報:</strong> メールアドレス、ニックネーム、パスワード(ハッシュ化 &mdash; 平文は保存しません)</li><li><strong>ウォレットアドレス:</strong> 貴方のカスタディアル型ゲームウォレットアドレス(登録時に生成)</li><li><strong>ゲームプレイデータ:</strong> 領土の取得、戦闘、取引、クエスト進行、ゲーム統計</li><li><strong>デバイス情報:</strong> ブラウザの種類、画面サイズ、IPアドレス(セキュリティとレート制限のため)</li><li><strong>利用データ:</strong> 訪問したページ、使用機能、セッション時間</li></ul><h3>2. データの利用方法</h3><ul><li>ゲームサービスの提供と維持</li><li>ゲーム内取引と出金の処理</li><li>不正、チート、悪用の防止</li><li>ゲーム性能と機能の改善</li><li>重要なアカウント通知の送信(セキュリティ警告、規約変更)</li><li>ゲーム改善のための匿名化された分析の生成</li></ul><h3>3. データの保管とセキュリティ</h3><p>貴方のデータは、保存時及び伝送時に暗号化されてセキュアなサーバーに保管されます。パスワードはbcryptでハッシュ化されます。当社はレート制限、入力検証、定期的なセキュリティ監査を実施します。ただし、100%安全なシステムは存在しないため &mdash; 強固で一意なパスワードをご使用ください。</p><h3>4. 第三者サービス</h3><p>当社は以下の種類の第三者サービスと連携しています:</p><ul><li><strong>ブロックチェーンネットワーク:</strong> USDTの入金・出金処理用(取引データはオンチェーン上で公開)</li><li><strong>メールサービス:</strong> パスワードリセットとアカウント通知用</li><li><strong>CDN/ホスティング:</strong> ゲームアセットの配信用</li></ul><p>当社は貴方の個人データを第三者に販売しません。</p><h3>5. 貴方の権利</h3><p>管轄区域によって、貴方は以下の権利を有する場合があります:</p><ul><li><strong>アクセス:</strong> 当社が保有する貴方の個人データの写しの請求</li><li><strong>訂正:</strong> 不正確または不完全なデータの更新</li><li><strong>削除:</strong> アカウント及び関連データの削除請求</li><li><strong>エクスポート:</strong> ポータブルな形式でのデータ受領</li><li><strong>異議:</strong> 特定のデータ処理への異議</li></ul><p>これらの権利を行使するには、ゲーム内サポートチャネルよりお問い合わせください。当社は30日以内に回答します。</p><h3>6. クッキーとローカルストレージ</h3><p>当社は以下の目的でブラウザのクッキーとlocalStorageを使用します:</p><ul><li>認証(ログイン状態の維持)</li><li>設定の記憶(言語、設定)</li><li>ゲーム状態のキャッシュ(読み込み高速化のため)</li></ul><p>当社は第三者のトラッキングクッキーを使用しません。ブラウザの設定からいつでもクッキーを削除できますが、その場合ログアウトされることがあります。</p><h3>7. データの保持</h3><p>当社は貴方のアカウントが有効な間データを保持します。アカウント削除をご要望の場合、30日以内に個人データを削除しますが、法令で保持が要求される場合(例: 金融取引記録)は除きます。</p><h3>8. 児童</h3><p>Occupy Marsは18歳未満のユーザーを対象としていません。当社は未成年者のデータを意図的に収集しません。未成年者がアカウントを作成したと思われる場合は、当社までご連絡ください。</p><h3>9. 本ポリシーの変更</h3><p>当社は随時本ポリシーを更新することがあります。重要な変更はゲーム内お知らせで通知します。変更後の継続利用は、これへの同意とみなされます。</p><h3>10. お問い合わせ</h3><p>プライバシーに関するご質問やご要望は、ゲーム内サポートチャネルまたは公式サイトに記載のメールでお問い合わせください。</p><div class="legal-update">最終更新: 2026年4月9日 &mdash; バージョン 1.0</div>',
    cantina_disclaimer_body: 'カンティーナには運と技術のゲームが含まれます。<br><strong>PP(Potato Points)を失う可能性があります。責任を持ってプレイしてください。</strong><br><br>ゲームで使ったPPは戻りません &mdash; 勝利は保証されません。<br>プレイするには<strong>18歳以上</strong>である必要があります。<br><br>ギャンブルに問題を感じた場合は、<br>一旦休んで助けを求めてください。',
    cookie_banner_text: '当社は認証、設定の保存、ユーザー体験の改善のためにクッキーとlocalStorageを使用します。',
  },
  zh: {
    login: 'ç»å½', register: 'æ³¨å', logout: 'éåº', account: 'è´¦æ·',
    email_login: 'é®ç®±ç»å½ / æ³¨å', my_wallet: 'æçé±å',
    wallet_cta_desc: 'ç»å½ä»¥å­å¥USDTï¼<br>å é¢é¢åå¹¶è·å¾å¥å±',
    email_placeholder: 'email@example.com', password_placeholder: 'å¯ç ï¼è³å°6ä½ï¼',
    nickname_placeholder: 'æµç§°ï¼å¯éï¼', referral_placeholder: 'æ¨èç ï¼å¯éï¼',
    or: 'æè', email_wallet_note: 'é®ç®±è´¦æ·åç½®æ¸¸æé±åã<br>ç¹å»DEPOSITæ¥çåå¼å°åã',
    game_wallet: 'æ¸¸æé±å', usdt_balance: 'USDTä½é¢', pp_balance: 'PPä½é¢',
    global_stats: 'å¨å±ç»è®¡', total_pixels: 'æ»åç´ ', pixels_sold: 'å·²å®åç´ ',
    total_volume: 'æ»äº¤æé', hijacks_hr: 'å«æ/æ¶', active_users: 'æ´»è·ç¨æ·',
    leaderboard: 'æè¡æ¦', search_owner: 'æç´¢æ¥æè', territory_info: 'é¢åä¿¡æ¯',
    coords: 'åæ ', owner: 'æ¥æè', size: 'å¤§å°', price_paid: 'è´­ä¹°ä»·æ ¼',
    hijack_cost: 'å«æè´¹ç¨', hijack_this: 'å«ææ­¤é¢å',
    my_alerts: 'æçæé', live_feed: 'å®æ¶å¨æ', place_image: 'æ¾ç½®å¾ç',
    choose_file: 'éæ©å¾çæä»¶', item_shop: 'éå·ååº', open_shop: 'æå¼ååº',
    referral_program: 'æ¨èè®¡å', referral_desc: 'åäº«ä½ çæ¨èç ï¼<br>å¨æ¨èäººç live ä½£éæ´»å¨ä¸­è·å¾PPï¼',
    codex_open: 'æ¸¸ææå', codex_tagline: 'äºè§£ä¸çè§ä¸ç©æ³æºå¶', profile_prefs: 'åå¥½è®¾ç½®', profile_language: 'è¯­è¨', codex_prev: 'ä¸ä¸é¡µ', codex_next: 'ä¸ä¸é¡µ',
    ref_tiers: 'ä¸çº§: 15% Â· äºçº§: 10% Â· ä¸çº§: 5%',
    ref_sources: 'æ¶çæ¥æº(é»è®¤): åå¼ Â· åæ¢ Â· ååº Â· å¡æçº³ Â· å¸åºæç»­è´¹ï¼å¶ä»æ¥æºéè¿è¥è®¾ç½®ååï¼',
    view_dynasty: 'ð æ¥ççæ', dyn_leaderboard: 'æè¡æ¦', dyn_my_tree: 'æçæ ',
    my_ref_code: 'æçæ¨èç ', enter_ref_code: 'è¾å¥æ¨èç ',
    referrals: 'æ¨èæ°', total_earned: 'æ»æ¶ç', coming_soon: 'å³å°ä¸çº¿',
    deposit_usdt: 'USDTåå¼', withdraw_usdt: 'USDTæç°', swap_pp: 'PP â USDTåæ¢',
    claim_territory: 'å é¢é¢å', confirm_claim: 'ç¡®è®¤å é¢',
    approve_deposit: 'ææå¹¶åå¼', request_withdrawal: 'ç³è¯·æç°',
    confirm_swap: 'ç¡®è®¤åæ¢', cancel: 'åæ¶', copy: 'å¤å¶', apply: 'åºç¨',
    click_mars: 'ç¹å»ç«æéæ©é¢å', click_stamp: 'ç¹å»ç«ææ¾ç½®ï¼',
    bug_report_label: 'BUG', bug_report_title: 'éè¯¯åé¦',
    bug_report_sub: 'è¯·åè¯æä»¬åºäºä»ä¹é®é¢ãæä»¬ä¼ç«å³æ¥çå¹¶ä¿®å¤ã',
    bug_report_category: 'ç±»å«',
    bug_cat_ui: 'UI', bug_cat_gameplay: 'ç©æ³', bug_cat_payment: 'æ¯ä»',
    bug_cat_performance: 'æ§è½', bug_cat_other: 'å¶ä»',
    bug_report_summary: 'ç®ç­æè¦',
    bug_report_summary_ph: 'ä¾: å«ææé®å¨ææ¹é¢åä¸æ ååº',
    bug_report_detail: 'åçäºä»ä¹ï¼',
    bug_report_detail_ph: 'å¤ç°æ­¥éª¤ãææè¡ä¸ºãå®éè¡ä¸º...',
    bug_report_auto_meta: 'èªå¨éå : é¡µé¢URLãæµè§å¨ãæè¿çæ§å¶å°éè¯¯ãå·²è¿æ¥é±åã',
    bug_report_submit: 'æäº¤åé¦', bug_report_sending: 'åéä¸­...',
    bug_report_thanks: 'ð åé¦å·²åéï¼è°¢è°¢ï¼',
    bug_report_empty: 'è¯·è¾å¥éè¯¯æè¿°',
    registered: 'æ³¨åæåï¼', login_success: 'ç»å½æåï¼', wallet_connected: 'é±åå·²è¿æ¥',
    wallet_disconnected: 'é±åå·²æ­å¼', copied: 'æ¨èé¾æ¥å·²å¤å¶ï¼',
    stats_label: 'ç»è®¡', live_label: 'å®æ¶',
    find_email: 'æ¾åID', forgot_password: 'æ¾åå¯ç ',
    find_email_title: 'æ¾åID', reset_password_title: 'éç½®å¯ç ',
    send_reset_code: 'åééªè¯ç ', change_password: 'ä¿®æ¹å¯ç ',
    enter_nickname: 'è¯·è¾å¥æµç§°', enter_email: 'è¯·è¾å¥é®ç®±',
    reset_code_placeholder: '6ä½éªè¯ç ', new_password: 'æ°å¯ç ', confirm_password: 'ç¡®è®¤å¯ç ',
    back_to_login: 'â è¿åç»å½', search_btn: 'æç´¢',
    code_sent_to: 'éªè¯ç å·²åéè³',
    tut_howto: 'æ¸¸ææ¹æ³',
    tut_step1: 'è¿æ¥é±åå¼å§æ¸¸æ â å é¢ç«æé¢åï¼ç»å»ºè°éï¼è·éæå½¹å§æã',
    tut_step2: 'ç¹å»CLAIMå¨ç«æå°å¾ä¸è´­ä¹°åç´ é¢åãé¢åä¼äº§åºå¯æ¶è·çPPã',
    tut_step3: 'è¿å¥BASEæ¶è·PPï¼å®ææ¯æ¥ä½æé¢æ¿è·åGPï¼åçº§é¢åï¼è¿å¥é è¹åã',
    tut_step4: 'åå¾CANTINAè·åå¢å¼ºç­ç¥çéå·åå°æ¸¸æã',
    tut_step5: 'è·éæå½¹ï¼ä¸»çº¿å§æï¼ãç»å»ºè°éèµ¢å¾PvPææï¼ç¨æ¨èé¾æ¥éè¯·å¥½åè·å¾å¥å±ï¼',
    tut_next: 'ä¸ä¸æ­¥', tut_skip: 'è·³è¿', tut_done: 'å¼å§æ¸¸æ!',
    help_claim: 'å é¢é¢å',
    help_claim_body: 'å¨ç«æä¸æå¨éæ©åç´ ï¼ç¨USDTè´­ä¹°æä¸ºä½ çé¢åãä»é¢åä¸­æ¶è·PPï¼é©¬éè¯ç§¯åï¼ãè¿å¯ä»¥æ¯ä»æº¢ä»·å«æå¶ä»ç©å®¶çé¢åï¼',
    help_cantina: 'éå§',
    help_cantina_body: 'PvPææç«æåºï¼è¿å¥éå§ä¸å¶ä»ç©å®¶ææï¼å¨ååºè´­ä¹°ææéå·ï¼è·å¾å¥å±ãä½¿ç¨æ¤ç¾ä¿æ¤é¢åï¼ä½¿ç¨æ­¦å¨æ»å»æäººã',
    help_base: 'æçåºå°',
    help_base_body: 'ä½ çææ¥ä¸­å¿ãæ¥çé¢åæ°æ®ãæ¶è·PPãç®¡çåºå­ãè£å¤è£é¥°åï¼å¦æä½ æ¯åºåæ»ç£è¿å¯ä»¥ä½¿ç¨æ²»çåè½ã',
    help_harvest: 'æ¶è·PP',
    help_harvest_body: 'ä½ çé¢åä¼éæ¶é´çæPPãç¹å»HARVESTæ¶éãPPå¯ä»¥åæ¢ä¸ºUSDTæç¨äºè´­ä¹°éå·ãå¤©æ°åæé¾å æå¯ä»¥æé«æ¶è·çï¼',
    help_governance: 'æ²»ç',
    help_governance_body: 'å¨åºåä¸­æ¥ææå¤åç´ å³å¯æä¸ºæ»ç£ï¼æ»ç£å¯ä»¥è®¾ç½®ç¨çï¼ä»åºååææäº¤æä¸­è·å¾PPæ¶çï¼ãåå¸å¬åãæ¿æ´»åºåå¨ä½å¢çã',
    help_referral: 'æ¨èè®¡å',
    help_referral_body: 'ææ¨èç åäº«ç»æåãæååå¼ãååºè´­ä¹°ãåæ¢æç©å¡æçº³æ¶ä½ è·å¾ä½£é â ä¸çº§ï¼ä¸çº§15%ï¼äºçº§10%ï¼ä¸çº§5%ã',
    help_currency: 'PP & USDT',
    help_currency_body: 'USDTï¼ç¨äºè´­ä¹°åå«æé¢åçç¨³å®å¸ãä»é±ååå¼ã\nPPï¼é©¬éè¯ç§¯åï¼ï¼éè¿æ¶è·é¢åè·å¾çæ¸¸æè´§å¸ãå¯åæ¢ä¸ºUSDTæç¨äºè´­ä¹°éå·åè£é¥°åã',
    help_weather: 'å¤©æ°äºä»¶',
    help_weather_body: 'ç«æå¤©æ°å½±åæ¸¸æï¼æ²æ´ï¼é²å¾¡âéç¿âãå¤ªé³èæï¼éç¿2åãæ¤ç¾âãæµæé¨ï¼æè½å¥å±PPãå°æé£ï¼é¢å°è´¹ç¨âæ»å»âã',
    help_about: 'å³äºOCCUPY MARS',
    help_about_body: 'Occupy Marsæ¯ç«æä¸çåºåé¾é¢åæ¸¸æï¼',
    help_game_crash: 'CRASH',
    help_game_crash_body: 'ç«ç®­åå°ï¼åçä¸åï¼å¨çç¸åæç°ãç­å¾è¶ä¹å¥å±è¶é«ï¼ä½å¦æå¨æç°åçç¸åå¨é¨æå¤±ãç¨PPä¸æ³¨ã',
    help_game_mines: 'MINES',
    help_game_mines_body: '5x5ç½æ ¼ä¸­éèçå®ç³åå°é·ãéæ©å°é·æ°éï¼è¶å¤åçè¶é«ï¼ãéä¸ªç¿»å¼æ¹åââæ¯é¢å®ç³å¢å å¥éãè¸©å°å°é·å°±ç»æï¼éæ¶å¯ä»¥æç°ã',
    help_game_sandstorm: 'COINFLIP',
    help_game_sandstorm_body: 'ç«æé£æ ¼æç¡¬å¸ï¼éæ©DUSTæSTORMï¼ä¸æ³¨ï¼ç¿»è½¬ãèµ¢äº=1.96åãç®åå¿«éç50/50æ¦çæ¸¸æã',
    help_game_meteorite: 'DICE',
    help_game_meteorite_body: 'æ·éª°å­ï¼è®¾ç½®ç®æ èå´ï¼èå´è¶çªåçè¶é«ï¼ãç»æå¨èå´ååè·èãæ ¹æ®åå¥½è°æ´é£é©ä¸åæ¥ã',
    help_game_hilo: 'HI-LO',
    help_game_hilo_body: 'ç¿»å¼ä¸å¼ çãçä¸ä¸å¼ çæ¯æ´é«è¿æ¯æ´ä½ãæ¯æ¬¡çå¯¹åçå¢å ãçå¯¹åéæ¶å¯ä»¥æç°ï¼æç»§ç»­è¿½æ±æ´å¤§å¥å±ï¼çéåå¨é¨æå¤±ã',
    lore_era: 'ä¸è¿çæªæ¥ï¼å¨ä¸é¢ä¸å¤ªé¥è¿çæçä¸...',
    lore_title: 'OCCUPY MARS',
    lore_body: '<p><span class="lore-highlight">2157å¹´</span>ãå°çæ­£å¨æ­»å»ãæµ·å¹³é¢ä¸ååæ²¡äºä¼å¤§çæ²¿æµ·åå¸ãç©ºæ°æ¬èº«åæäºæ¯è¯ã70äº¿çµé­ç´§ç´§æä½ä¸ä¸ªä¸åéè¦ä»ä»¬çä¸çã</p><p>ä½äººç±»æç»æç¶æ¶éäºé»æä¹ä¸­ã</p><p><span class="lore-highlight">æç¥è®¡å</span> â ä¸æ¬¡å­¤æ³¨ä¸æ·çæåä»»å¡ â åçº¢è²æçåå°äºæ®æ°è°éãç»è¿ç©¿è¶å¤ªç©ºèç©ºçä¸å¹´æ®é·æç¨ï¼å¹¸å­èä»¬éè½å¨äº<span class="lore-red">ç«æ</span>ä¸ã</p><p>è¿éæ²¡æå¤©å ãåªæçº¢è²å°åãåºéª¨å¯é£åæ å°½çæ²å¯ãä½ä»ä»¬åç°äºææ³ä¸å°çä¸è¥¿ï¼æ·±åå¨ç«æå°è¡¨ä¹ä¸ç<span class="lore-cyan">ç¨æç¿è</span> â è¶³ä»¥å»ºé æ°ææâ¦â¦æå°å¶æè£çèµæºã</p><p>å¦ä»ï¼åå¿åå¨ç©çº¢èåä¸å¾æã<span class="lore-highlight">åºåæ»ç£</span>ä»¥éèç»æ²»èªå·±çé¢å°ãæ å¤ºèè¶æ²æ´<span class="lore-red">å«æ</span>é¢åãè¡¥ç»ç«ç®­æºå¸¦çè´µè´§ç©å è½ï¼åªææå¿«çäººæè½å¤ºåæå©åã</p><p>è¿éæ²¡ææ³å¾ãæ²¡ææ¿åºãæ²¡æææ´ä¼æ¥ã<br>åªæ<span class="lore-red">ç«æ</span>ãä»¥åé£äºæ¢äº<span class="lore-highlight">å é¢</span>å®çäººã</p>',
    lore_tagline: 'ä½ çé¢åãä½ çè§åãä½ çæçã',
    lore_close: 'è¿å¥ç«æ',
    // ââ BASE tab labels ââ
    base_tab_territory: 'æçé¢å', base_tab_sectors: 'åºå', base_tab_season: 'èµå­£',
    base_tab_mining: 'â èµæºåºèª', base_tab_quests: 'ä»»å¡', base_tab_ops: 'ä½ææ§å¶å°',
    base_tab_shop: 'ååº', base_tab_market: 'å¸åº', base_tab_guild: 'å¬ä¼', base_tab_govern: 'æ²»ç',
    base_tab_transport: 'è¿è¾', base_tab_quests_full: 'æå½¹/ä»»å¡',
    bcat_territory: 'é¢å', bcat_fleet: 'è°é', bcat_economy: 'ç»æµ', bcat_mission: 'ä»»å¡', bcat_community: 'ç¤¾åº',
    fcmd_open_shipyard_short: 'é è¹å', fcmd_my_fleets_short: 'æçè°é', fcmd_mining_short: 'èµæºåºèª', mining_ops_title: 'èµæºåºèª', mining_ops_desc: 'æ´¾è°éééGPÂ·ç´ æ â æ éé¢å°ã', mining_ops_btn: 'â åºèª', fcmd_tactical_lab: 'ææ¯å®éªå®¤', fcmd_tactical_lab_short: 'ææ¯å®éªå®¤', fcmd_ace_mode_short: 'ççæ¨¡å¼',
    fleet_status_label: 'è°éç¶æ', fleet_world_events: 'æ´»è·ä¸çäºä»¶', btn_refresh: 'â» å·æ°',
    hijack_no_fleet_auto_win: 'æ ææ¹è°é â èªå¨èå©ï¼å³æ¶é¢åè½¬ç§»ï¼',
    hijack_fleet_info_fail: 'å è½½ææ¹è°éä¿¡æ¯å¤±è´¥',
    // ââ èä¸ç³»ç» ââ
    job_label: 'èä¸', job_none: 'éæ©ä½ çå½è¿', job_locked: 'è¾¾å°Lv.{n}åè§£é',
    job_choose_btn: 'éæ© â¶', job_change_btn: 'æ´æ¢èä¸',
    job_cooldown: '{t}ä¹åå¯ä»¥æ´æ¢', job_free_change: 'åè´¹æ´æ¢å©ä½{n}æ¬¡',
    job_paid_change: 'æ´æ¢è´¹ç¨: {n} GP', job_current: 'å½åèä¸',
    job_modal_title: 'éæ©ä½ çå½è¿', job_modal_sub: 'è¯·éæ©ç¬¦åä½ æ¸¸æé£æ ¼çä¸ä¸',
    job_modal_cancel: 'ç¨å', job_modal_confirm: 'ç¡®è®¤éæ©',
    job_modal_free: 'åè´¹æ´æ¢ â æ¬å¨å©ä½{n}æ¬¡',
    job_modal_paid: 'æ¶è{n} GPï¼æ¬å¨åè´¹æ¬¡æ°å·²ç¨å®ï¼',
    job_modal_cooldown_warn: 'èä¸æ´æ¢å·å´ä¸­',
    job_selected_toast: 'èä¸å·²éæ©: {n}',
    // ââ å¸åº ââ
    mkt_browse: 'ðª æµè§', mkt_sell: 'ð° åºå®', mkt_my_listings: 'ð æçä¸æ¶',
    mkt_sort_newest: 'ææ°', mkt_sort_cheap: 'æä¾¿å®', mkt_sort_expensive: 'æè´µ', mkt_sort_ending: 'å³å°ç»æ',
    mkt_loading: 'å è½½å¸åºä¸­...', mkt_empty: 'ææ åå',
    mkt_recent_sales: 'ð æè¿æäº¤', mkt_no_sales: 'ææ æäº¤è®°å½',
    notif_title: 'ð éç¥', notif_read_all: 'å¨é¨æ ä¸ºå·²è¯»',
    notif_loading: 'å è½½ä¸­...', notif_empty: 'ææ éç¥',
    gp_activity_title: 'GP æ´»å¨è®°å½', gp_activity_login: 'ç»å½åæ¥çGPæ´»å¨ã', gp_activity_empty: 'ææ GPæ´»å¨è®°å½ã',
    gp_send_title: 'ð¸ åéGP', gp_send_subtitle: 'åå¶ä»ç©å®¶åéGP', gp_send_btn: 'åé',
    gp_send_no_recipient: 'è¾å¥æ¶æ¬¾äººé±åææµç§°', gp_send_invalid_amount: 'è¯·è¾å¥ææéé¢',
    gp_send_amount_label: 'éé¢', gp_transfer_history: 'è½¬è´¦è®°å½', gp_transfer_empty: 'ææ è½¬è´¦è®°å½ã',
    career_stats_title: 'ð çæ¶¯ç»è®¡', cat_naval: 'æµ·æèå©', cat_enhance: 'å¼ºåæ¬¡æ°', cat_ships: 'å»ºé è°è¹', cat_trades: 'äº¤ææ¬¡æ°',
    mkt_buy: 'è´­ä¹°', mkt_cancel: 'åæ¶', mkt_list_sell: 'åºå®',
    mkt_buy_title: 'è´­ä¹°éå·', mkt_price: 'ä»·æ ¼', mkt_your_balance: 'ä½é¢',
    mkt_buy_confirm: 'ç«å³è´­ä¹°', mkt_bought: 'è´­ä¹°æåï¼',
    mkt_cancel_title: 'åæ¶ä¸æ¶', mkt_cancel_body: 'åæ¶ä¸æ¶å¹¶è¿è¿éå·ï¼',
    mkt_cancel_confirm: 'åæ¶ä¸æ¶', mkt_cancelled: 'å·²åæ¶ä¸æ¶',
    mkt_list_title: 'ä¸æ¶åºå®', mkt_list_confirm: 'ç¡®è®¤ä¸æ¶',
    mkt_fee_note: 'ä¸æ¶è´¹: 2 GP Â· éå®æç»­è´¹: 5%', mkt_listed: 'å·²ä¸æ¶å°å¸åºï¼', mkt_listed_territory: 'é¢åå·²ä¸æ¶å°å¸åºï¼',
    mkt_sellable_items: 'å¯åºå®éå·', mkt_no_items: 'æ²¡æå¯åºå®çéå·ãè¯·åå¨ååºâæçéå·ä¸­è½¬æ¢è£é¥°åã',
    mkt_sellable_terr: 'æçé¢å', mkt_no_territories: 'ææ æ¥æçé¢åã',
    mkt_no_listings: 'ææ ä¸æ¶',
    // ââ AUCTION section ââ
    mkt_auction: 'ð¨ æå',
    auc_none: 'ææ æ´»è·æå', auc_ended: 'å·²ç»æ', auc_current_bid: 'å½ååºä»·',
    auc_buyout: 'ä¸å£ä»·', auc_bid: 'åºä»·', auc_buy_now: 'ç«å³è´­ä¹°', auc_cancel: 'åæ¶',
    auc_bid_title: 'åºä»·', auc_min_bid: 'æä½åºä»·', auc_your_bid: 'æ¨çåºä»·',
    auc_confirm_bid: 'ç¡®è®¤åºä»·', auc_too_low: 'åºä»·è³å°éè¦',
    auc_bid_placed: 'åºä»·æåï¼', auc_buyout_title: 'ç«å³è´­ä¹°',
    auc_buyout_confirm: 'ä»¥ä¸å£ä»·è´­ä¹°æ­¤éå·ï¼',
    auc_confirm_buyout: 'ç«å³è´­ä¹°', auc_bought: 'è´­ä¹°æåï¼',
    auc_cancel_title: 'åæ¶æå',
    auc_cancel_confirm: 'åæ¶æ­¤æåï¼ï¼ä»éæ åºä»·æ¶ï¼',
    auc_confirm_cancel: 'åæ¶æå', auc_cancelled: 'æåå·²åæ¶',
    // ââ TERRITORY VISUAL section ââ
    terr_sell_btn: 'ð° åºå®', terr_for_sale: 'ð° åºå®ä¸­', terr_auction_label: 'ð¨ ç«æä¸­',
    // ââ RESOURCE section ââ
    res_section_title: 'ç¿ç©èµæº',
    res_empty: 'è¿æ²¡æèµæºãæ¶è·é¢åæ¥åç°ç¿ç©ï¼',
    res_sell: 'åºå®',
    res_sell_title: 'åºå®èµæº',
    // ââ SEASON tab ââ
    season_no_active: 'ææ è¿è¡ä¸­çèµå­£',
    season_check_back: 'è¯·æå¾ä¸ä¸ªèµå­£ï¼',
    season_activities_placeholder: 'èµå­£å¼å§åï¼æ´»å¨å°æ¾ç¤ºå¨æ­¤å¤ã',
    season_how_to_earn: 'å¦ä½è·å¾ç§¯å',
    season_rewards_title: 'èµå­£å¥å±',
    season_reward_1st: '<b>åç±»å«ç¬¬1å</b>ï¼GP + XP + éå· + ç§°å·',
    season_reward_top3: '<b>å3å</b>ï¼GP + éå·',
    season_reward_top10: '<b>å10å</b>ï¼GP',
    season_reward_overall: 'æ»æ¦ç¬¬1è¿å¯è·å¾ç¨æ <span style="color:var(--gold)">PP</span>ï¼',
    season_reward_multi: 'å¯åæ¶å¨<b>å¤ä¸ªç±»å«</b>èµ¢å¾å¥å±ï¼',
    season_rewards_blurb: 'ð¥ <b>åç±»å«ç¬¬1å</b>ï¼GP + XP + éå· + ç§°å·<br>ð¥ <b>å3å</b>ï¼GP + éå·<br>ð¥ <b>å10å</b>ï¼GP<br>ð æ»æ¦ç¬¬1è¿å¯è·å¾ç¨æ <span style="color:var(--gold)">PP</span>ï¼<br>â¡ å¯åæ¶å¨<b>å¤ä¸ªç±»å«</b>èµ¢å¾å¥å±ï¼',
    season_my_rank: 'æçèµå­£æå',
    season_pts_suffix: 'å',
    season_leaderboard: 'èµå­£æè¡æ¦',
    season_refresh: 'â» å·æ°',
    season_loading: 'å è½½ä¸­...',
    season_no_scores: 'ææ èµå­£åæ°',
    season_your_rewards: 'ð ä½ çå¥å±',
    season_pass_tip: 'æ¸¸ç©è·å¾XPï¼å é¢ãéç¿ãå¥ä¾µãæ¢ç´¢ãä»»å¡ï¼ãåçº§è§£éå¥å±ï¼é«çº§éè¡è¯ååå¥å±ï¼',
    season_pass_buy_title: 'é«çº§éè¡è¯',
    season_pass_buy_body: 'è§£éæ¬èµå­£é«çº§å¥å±è½¨éãææç­çº§ååå¥å±ï¼',
    season_pass_cost_label: 'è´¹ç¨',
    season_pass_balance_label: 'ä½ çGP',
    season_pass_buy_confirm: 'è´­ä¹°',
    season_categories_title: 'æ¬èµå­£æåç±»å«',
    season_default_desc: 'äºå¤ºæè¡æ¦æ¦é¦ï¼',
    season_ending_soon: 'èµå­£å³å°ç»æï¼',
    season_ended: 'å·²ç»æ',
    season_days_remaining: 'å©ä½{d}å¤©{h}å°æ¶',
    season_rank_suffix: 'æå',
    season_claim_btn: 'é¢å',
    season_claim_success: 'å·²é¢å {amount} {type}ï¼',
    season_claim_failed: 'é¢åå¤±è´¥',
    season_theme_volcanic: 'ç«å±±é»æ',
    season_theme_ice_age: 'å°æ²³æ¶ä»£',
    season_theme_solar_storm: 'å¤ªé³é£æ´',
    season_theme_dust_epoch: 'å°åçºªå',
    season_theme_volcanic_desc: 'ç«æåå°ç«å±±æ´»å¨æ¿å¢ãéç¿äº§éæåä½æ¤ç¾åå¼±ï¼',
    season_theme_ice_age_desc: 'å»åèå»¶ãå¯å·ææ¢éç¿ä½é²å¾¡ååºã',
    season_theme_solar_storm_desc: 'å¤ªé³è¾å°ç¬¼ç½©å°è¡¨ãéç¿æå¤§åï¼æ¤ç¾è¿éå¤±æï¼',
    season_theme_dust_epoch_desc: 'å·¨å¤§æ²å°æ´èèãè§éä¸éä½é¨ç³å¸¦æ¥æåã',
    // ââ Season categories ââ
    season_cat_overall: 'ç»¼åå å', season_cat_overall_d: 'å¨æææ´»å¨ä¸­è·å¾æé«æ»å',
    season_cat_territory: 'é¢åä¹ç', season_cat_territory_d: 'å¨ç«æä¸å é¢æå¤åç´ ',
    season_cat_mining: 'éç¿å¤§å¸', season_cat_mining_d: 'ä»é¢åä¸­ééæå¤èµæº',
    season_cat_combat: 'ææä¼ å¥', season_cat_combat_d: 'å¨å«ææä¸­èµ¢å¾æå¤èå©',
    season_cat_defender: 'ä¸å±æå£«', season_cat_defender_d: 'æ¿åæå¤é¢åæ»å»',
    season_cat_explorer: 'ç²¾è±æ¢é©å®¶', season_cat_explorer_d: 'å¨å°çä»ªä¸åç°æå¤POIæ è®°',
    season_cat_active: 'ææ´»è·', season_cat_active_d: 'ç¹å»åç¹ææå¤ââå°½ææ¸¸æï¼',
    season_cat_shopper: 'ç©åå¤§å¸', season_cat_shopper_d: 'ä»ååºè´­ä¹°åä½¿ç¨æå¤ç©å',
    season_cat_quester: 'ä»»å¡è±é', season_cat_quester_d: 'å®ææå¤æ¯æ¥ä»»å¡',
    season_cat_big_spender: 'å¤§æç¬', season_cat_big_spender_d: 'å¨ç©åãå«æååçº§ä¸è±è´¹æå¤GP',
    season_cat_investor: 'PPæèµè', season_cat_investor_d: 'å¨é«çº§åè½ä¸æå¥æå¤PP',
    season_cat_fortifier: 'å ¡åå»ºé è', season_cat_fortifier_d: 'å¨é¢åä¸æ¾ç½®æå¤æ¤ç¾',
    season_cat_wanderer: 'æåºæ¼«æ¸¸è', season_cat_wanderer_d: 'æ¢ç´¢åè®¿é®æå¤ä¸åæåº',
    season_cat_dedicated: 'æå¤å¥', season_cat_dedicated_d: 'æ¯å¤©ç»å½ââåææ¯å³é®ï¼',
    season_cat_fashionista: 'ç«ææ¶å°è¾¾äºº', season_cat_fashionista_d: 'ä¸ºé¢åè£å¤æå¤è£é¥°ç©å',
    season_cat_gambler: 'éé¦å¸¸å®¢', season_cat_gambler_d: 'å¨éé¦ç©æå¤è¿·ä½ æ¸¸æ',
    season_cat_team_player: 'å¢éç©å®¶', season_cat_team_player_d: 'ä¸ºå¬ä¼æ´»å¨è´¡ç®æå¤',
    season_cat_recruiter: 'é¡¶çº§æåå®', season_cat_recruiter_d: 'éè¿æ¨èéè¯·æå¤æ°ç©å®¶',
    season_cat_social: 'ç¤¾äº¤è´è¶', season_cat_social_d: 'åå¶ä»ç©å®¶åéæå¤èå¤©æ¶æ¯',
    season_cat_earner: 'GPå¤§äº¨', season_cat_earner_d: 'ä»æææ¥æºç´¯è®¡è·å¾æå¤GP',
    season_cat_whale: 'PPé²¸é±¼', season_cat_whale_d: 'éè¿éç¿ååç°è·å¾æå¤PP',
    season_cat_loser: 'æ°¸ä¸æ¾å¼', season_cat_loser_d: 'è¢«å«æå¤±å»åç´ ï¼ç»§ç»­åå»ï¼',
    season_cat_streaker: 'è¿ç»­è®°å½ç', season_cat_streaker_d: 'ä¿ææé¿æ¯æ¥ç»å½è¿ç»­è®°å½',
    season_cat_astronaut: 'ç«ç®­éªå£«', season_cat_astronaut_d: 'ä»ç«ç®­è¡¥ç»ææ¾ä¸­è·å¾æå¤æå©å',
    season_cat_weatherman: 'é£æ´è¿½è¸ªè', season_cat_weatherman_d: 'ç»å¸¸æ¥çç«æå¤©æ°é¢æ¥',
    season_cat_namer: 'å½åèºæ¯å®¶', season_cat_namer_d: 'éå½åé¢åæ¬¡æ°æå¤',
    season_cat_influencer: 'ç«æç½çº¢', season_cat_influencer_d: 'åäº«æç»©åé¢åæ¬¡æ°æå¤',
    // ââ QUESTS tab ââ
    quests_loading: 'æ­£å¨å è½½ä»»å¡...',
    achievements_title: 'æå°±', achievements_loading: 'æ­£å¨å è½½æå°±...',
    news_title: 'æçæ°é»',
    lottery_title: 'GPæ½å¥', lottery_disabled: 'æ½å¥å·²ç¦ç¨', lottery_round: 'è½®æ¬¡', lottery_ends: 'å©ä½æ¶é´', lottery_recent_winners: 'è¿æä¸­å¥è',
    staking_title: 'GPè´¨æ¼', staking_stake_btn: 'ð è´¨æ¼GP', staking_confirm_title: 'GPè´¨æ¼', staking_confirm_btn: 'è´¨æ¼', staking_withdraw_title: 'æåè´¨æ¼', staking_withdraw_btn: 'æå',
    burn_title: 'GPéæ¯',
    weekly_title: 'æ¯å¨ææ',
    shield_title: 'é¢åæ¤ç¾', shield_activate_btn: 'æ¿æ´»æ¤ç¾',
    bounty_title: 'èµéæ¿', bounty_post_btn: '+ åå¸èµé', bounty_tab_active: 'æ´»è·', bounty_tab_mine: 'æçèµé', bounty_tab_onme: 'éå¯¹æ', bounty_modal_title: 'åå¸èµé', bounty_modal_sub: 'å¥å±ç¬¬ä¸ä¸ªå¤ºåè¯¥é¢å°çç©å®¶', bounty_target_label: 'ç®æ é±å/æµç§°', bounty_amount_label: 'GPå¥å±', bounty_msg_label: 'å²è®½æ¶æ¯', bounty_post_submit: 'ð¯ åå¸èµé',
    upgrades_title: 'é¢ååçº§', upgrades_upgrade_btn: 'åçº§é¢å',
    monuments_title: 'æççºªå¿µç¢', monument_place_title: 'æ¾ç½®çºªå¿µç¢', monument_place_btn: 'æ¾ç½®çºªå¿µç¢', monument_territory: 'é¢å', monument_type: 'ç±»å', monument_name_label: 'çºªå¿µç¢åç§°', monument_inscription: 'é­æ', monument_cost: 'è´¹ç¨',
    base_craft_btn: 'âï¸ å¶ä½', craft_cat_all: 'å¨é¨', craft_cat_general: 'éç¨', craft_cat_elite: 'ç²¾è±', craft_cat_seasonal: 'èµå­£', craft_cat_event: 'æ´»å¨', craft_btn: 'âï¸ å¶ä½', craft_history_btn: 'ð å¶ä½è®°å½', craft_no_recipes: 'ææ éæ¹', craft_load_fail: 'éæ¹å è½½å¤±è´¥', craft_no_history: 'ææ å¶ä½è®°å½', craft_success: 'å¶ä½æåï¼', craft_fail: 'å¶ä½å¤±è´¥', craft_refund_partial: 'GPé¨åéè¿', craft_confirm_title: 'ç¡®è®¤å¶ä½', craft_missing_ingredients: 'ææä¸è¶³',
    contest_title: 'åç´ èºæ¯ç«èµ', contest_none: 'ææ ç«èµãè¯·ç¨ååæ¥ï¼', contest_view_btn: 'ð æ¥çåèµä½å', contest_submit_btn: 'âï¸ æäº¤', contest_vote_btn: 'ð³ï¸ æç¥¨', contest_title_prompt: 'ä½åæ é¢:', contest_image_prompt: 'å¾çURLï¼å¯éï¼:', contest_desc_prompt: 'ç®ç­æè¿°ï¼å¯éï¼:',
    rental_title: 'é¢åç§èµ', rental_tab_browse: 'æµè§', rental_tab_my: 'æçç§èµ', rental_list_btn: '+ æçåºç§', rental_rent_btn: 'ðï¸ ç§èµ', rental_cancel_btn: 'åæ¶æç', rental_no_listings: 'ææ å¯ç§é¢å', rental_no_my: 'ææ ç§èµæ´»å¨', rental_no_territories: 'æ å¯æçé¢å', rental_cancelled: 'æçå·²åæ¶', rental_gp_prompt: 'æ¯å¨æGP:',
    duel_title: 'GPå³æ', duel_challenge_btn: 'âï¸ ææ', duel_tab_pending: 'æ¶å°çææ', duel_tab_my: 'æçå³æ', duel_tab_recent: 'æè¡æ¦', duel_modal_title: 'åèµ·å³æ', duel_modal_sub: 'èèè·å¾å¥æ± ï¼æ£é¤5%æç»­è´¹ï¼', duel_target_label: 'å¯¹æé±å/æµç§°', duel_wager_label: 'èµæ³¨ï¼GPï¼', duel_challenge_submit: 'âï¸ åéææ', duel_accept_btn: 'âï¸ æ¥å', duel_decline_btn: 'â æç»', duel_cancel_btn: 'åæ¶', duel_no_pending: 'ææ æ¶å°çææ', duel_no_history: 'ææ å³æè®°å½', duel_no_recent: 'ææ è¿æå³æ', duel_accept_confirm: 'æ¥åå³æå¹¶æ¼æ³¨GPï¼', duel_decline_confirm: 'æç»æ­¤å³æææï¼', duel_cancelled_refund: 'å³æå·²åæ¶ãGPå·²éè¿ã', duel_challenge_sent: 'âï¸ ææå·²åéï¼å¯¹æéå¨30åéåæ¥åã', duel_enter_target: 'è¾å¥å¯¹æé±åææµç§°', duel_enter_wager: 'è¯·è¾å¥ææèµæ³¨',
    alliance_title: 'èç', alliance_members: 'æå', alliance_treasury: 'éåº', alliance_defense: 'é²å¾¡å æ', alliance_join_btn: 'å å¥', alliance_join_confirm: 'å å¥èçï¼', alliance_leave_btn: 'ðª éåº', alliance_leave_title: 'éåºèçï¼', alliance_leave_confirm: 'æ¨å°è¢«ç§»åºèçã', alliance_deposit_btn: 'ð° å­å¥', alliance_withdraw_btn: 'ð¤ æå', alliance_deposit_prompt: 'å­å¥å¤å°GPï¼', alliance_withdraw_prompt: 'ä»éåºæåGPï¼å«æç»­è´¹ï¼:', alliance_withdraw_note_prompt: 'å¤æ³¨ï¼å¯éï¼:', alliance_create_title: 'åå»ºèç', alliance_create_btn: 'ð¡ï¸ åå»ºèç', alliance_browse_title: 'æµè§èç', alliance_browse_hint: 'æç´¢ææ»å¨æ¥æ¾èç',
    base_lucky_btn: 'ð¦ å®ç®±', lucky_box_open_btn: 'ð å¼å¯', lucky_box_recent_title: 'ð æè¿å¼å¯', lucky_box_my_history: 'ð æçè®°å½', lucky_box_confirm_title: 'å¼å¯å®ç®±ï¼',
    base_vip_btn: 'ð« VIP', vip_buy_btn: 'ð« è·åVIP', vip_status_active: 'VIPå·²æ¿æ´»', vip_expires: 'è¿æ', vip_purchase_title: 'è´­ä¹°VIPéè¡è¯ï¼', vip_confirm: 'è´­ä¹°VIP',
    connect_wallet: 'è¯·åè¿æ¥é±å', connect_wallet_first: 'è¯·åè¿æ¥é±å', err_connect_wallet: 'è¯·åè¿æ¥é±å', err_network: 'ç½ç»éè¯¯ï¼è¯·éè¯ã',
    use_shipyard: 'è¯·å¨é è¹åå»ºé è°è¹', use_fleet_cmd: 'è¯·ä½¿ç¨è°éææ¥é¨', gov_battle_use_fleet: 'PVPææéè¿è°éç³»ç»+Hijackè¿è¡ã', gov_battle_use_fleet_hint: 'å¨è°éæ ç­¾é¡µå»ºé è°è¹ï¼ä½¿ç¨HIJACKæé®å¤ºåé¢å°ã',
    duel_declined_msg: 'å·²æç»å³æã',
    expedition_title: 'è¿å¾', expedition_returns: 'å½æ¥', expedition_cancel_btn: 'åæ¶', expedition_launch_btn: 'ð åå¨è¿å¾', expedition_history_btn: 'ð è¿å¾è®°å½', expedition_select_claim: 'éæ©é¢åä¸ç±»å', expedition_launch_confirm: 'åå¨è¿å¾ï¼', expedition_cancel_confirm: 'åæ¶è¿å¾ï¼',
    branding_title: 'é¢ååçå', branding_select_territory: 'éæ©è¦åçåçé¢å:', branding_name_label: 'é¢ååç§°', branding_tagline_label: 'æ è¯­', branding_color_label: 'ä¸»é¢é¢è²', branding_set_btn: 'è®¾ç½®', branding_set_name_title: 'è®¾ç½®é¢ååç§°ï¼', branding_set_tag_title: 'è®¾ç½®æ è¯­ï¼', branding_set_color_title: 'è®¾ç½®ä¸»é¢é¢è²ï¼',
    spells_title: 'é¢åæ³æ¯', spells_select_target: 'ç®æ é¢åï¼è¾å¥å°åç¼å·ï¼:', spells_active_label: 'å½åæ³æ¯:', spells_history_btn: 'ð æ³æ¯è®°å½', spells_cast_confirm: 'æ½æ¾æ³æ¯ï¼',
    tiers_title: 'é¢åç­çº§', tiers_desc: 'åçº§é¢åä»¥è·å¾æ°¸ä¹æç¿ååç´ å®¹éå æã', tiers_my_label: 'æçé¢å', tiers_table_label: 'ç­çº§ç¦å©', tiers_upgrade_btn: 'â¬ åçº§', tiers_none: 'ææ åçº§é¢åã', tiers_upgrade_confirm: 'åçº§é¢åç­çº§ï¼',
    tournament_title: 'é¦æ èµ', tournament_none: 'ææ å¼æ¾çé¦æ èµ', tournament_join_btn: 'å å¥é¦æ èµ', tournament_join_confirm: 'å å¥é¦æ èµï¼', tournament_my_btn: 'ð æçé¦æ èµ',
    broadcast_title: 'GPå¹¿æ­', broadcast_buy_btn: 'ð¢ è´­ä¹°å¹¿æ­', broadcast_modal_title: 'ð¢ å¹¿æ­æ¶æ¯', broadcast_modal_desc: 'æ¨çæ¶æ¯å°å¨æéæ¶é´ååææç©å®¶å±ç¤ºã', broadcast_duration_label: 'æ¶é¿:', broadcast_submit_btn: 'ð¢ å¹¿æ­', broadcast_confirm_title: 'è´­ä¹°å¹¿æ­ï¼', broadcast_none: 'å½åæ²¡ææ´»è·å¹¿æ­ã',
    raffle_title: 'GPæ½å¥', raffle_none: 'ææ å¼æ¾çæ½å¥ã', raffle_my_btn: 'ðï¸ æçç¥¨', raffle_buy_btn: 'ðï¸ è´­ä¹°', raffle_tickets_label: 'å¼ æ°:', raffle_buy_confirm: 'è´­ä¹°æ½å¥ç¥¨ï¼',
    wager_title: 'GPé¢æµææ³¨', wager_none: 'ææ æ´»è·ææ³¨æ± ã', wager_my_btn: 'ð¯ æçææ³¨', wager_bet_btn: 'ð¯ ææ³¨', wager_target_label: 'ææ³¨å¯¹è±¡ï¼é±å/æµç§°ï¼:', wager_amount_label: 'éé¢:', wager_confirm: 'ç¡®è®¤ææ³¨ï¼',
    tevt_title: 'é¢å°äºä»¶', tevt_desc: 'ä½¿ç¨GPä¸ºæ¨çé¢å°æ¿æ´»éæ¶å æã', tevt_select_label: 'éæ©é¢å°:', tevt_load_btn: 'â¡ å è½½äºä»¶', tevt_active_label: 'æ´»è·äºä»¶', tevt_none: 'ææ æ´»è·äºä»¶ã', tevt_activate_confirm: 'æ¿æ´»é¢å°äºä»¶ï¼',
    prestige_btn: 'â­ å£°æ', prestige_buy_btn: 'â­ è´­ä¹°å£°æç¹', prestige_buy_confirm: 'è´­ä¹°å£°æç¹ï¼', prestige_lb_title: 'ð å£°ææè¡æ¦', prestige_lb_none: 'ææ å£°æç©å®¶ã',
    beacon_title: 'å°å¾ä¿¡æ ', beacon_desc: 'å¨å°å¾ä¸æ¾ç½®å¶ä»ç©å®¶å¯è§çä¿¡æ ã', beacon_icon_label: 'å¾æ ', beacon_msg_label: 'æ¶æ¯ï¼å¯éï¼', beacon_x_label: 'X', beacon_y_label: 'Y', beacon_use_plot: 'ð å½åå°å', beacon_place_btn: 'ð¡ æ¾ç½®ä¿¡æ ', beacon_active_label: 'æ´»è·ä¿¡æ ', beacon_none: 'ææ æ´»è·ä¿¡æ ã', beacon_place_confirm: 'æ¾ç½®å°å¾ä¿¡æ ï¼', beacon_no_plot: 'è¯·åå¨å°å¾ä¸éæ©å°å', beacon_coords_required: 'è¯·è¾å¥åæ ',
    donation_title: 'æ®æ°åºé', donation_amount_label: 'éé¢ï¼GPï¼', donation_msg_label: 'æ¶æ¯ï¼å¯éï¼', donation_donate_btn: 'ðï¸ æèµ ', donation_none: 'ææ æèµ è®°å½ã', donation_top_btn: 'ð é¡¶çº§æèµ è', donation_top_title: 'é¡¶çº§æèµ è', donation_confirm: 'åæ®æ°åºéæèµ ï¼', donation_min_hint: 'è¯·è¾å¥éé¢',
    poll_title: 'ç¤¾åºæç¥¨', poll_create_btn: '+ æç¥¨', poll_create_title: 'åå»ºæç¥¨', poll_question_label: 'é®é¢', poll_options_label: 'éé¡¹', poll_add_option: '+ æ·»å éé¡¹', poll_duration_label: 'æ¶é¿ï¼hï¼:', poll_publish_btn: 'ð åå¸', poll_none: 'ææ è¿è¡ä¸­çæç¥¨ã', poll_publish_confirm: 'åå¸æç¥¨ï¼', poll_question_required: 'è¯·è¾å¥é®é¢', poll_min_options_hint: 'è³å°éè¦2ä¸ªéé¡¹',
    status_label: 'ð¬ ç¶ææ¶æ¯', status_set_btn: 'è®¾ç½®', status_none: 'ææ æ´»è·ç¶æ', status_required: 'è¯·è¾å¥ç¶ææ¶æ¯', status_set_confirm: 'è®¾ç½®ç¶ææ¶æ¯ï¼',
    vtag_label: 'ð·ï¸ ä¸ªæ§æ ç­¾', vtag_set_btn: 'è®¾ç½®', vtag_clear_btn: 'â', vtag_none: 'æªè®¾ç½®ä¸ªæ§æ ç­¾', vtag_required: 'è¯·è¾å¥æ ç­¾', vtag_set_confirm: 'è®¾ç½®ä¸ªæ§æ ç­¾ï¼', vtag_clear_confirm: 'å é¤ä¸ªæ§æ ç­¾ï¼', vtag_free: 'åè´¹', vtag_set_success: 'ð·ï¸ ä¸ªæ§æ ç­¾å·²è®¾ç½®ï¼', vtag_cleared: 'æ ç­¾å·²å é¤', vtag_cost_hint: 'é¦æ¬¡: {first} GP Â· ä¿®æ¹: {change} GP', vtag_disabled: 'ä¸ªæ§æ ç­¾å·²ç¦ç¨',
    tribute_label: 'è´¡å', tribute_btn: 'ðª è´¡å', tribute_modal_title: 'é¢åè´¡å', tribute_modal_desc: 'åè¯¥é¢åçææèåéGPè´¡å', tribute_amount_label: 'éé¢ (GP)', tribute_msg_label: 'æ¶æ¯ï¼å¯éï¼', tribute_send_btn: 'ðª åéè´¡å', tribute_confirm: 'åéGPè´¡åï¼', tribute_sent: 'ðª è´¡åå·²åéï¼', tribute_amount_required: 'è¯·è¾å¥ææçGPéé¢',
    graffiti_label: 'æ¶é¸¦', graffiti_btn: 'âï¸ æ¶é¸¦', graffiti_modal_title: 'å·æ¶æ¶é¸¦', graffiti_modal_desc: 'å¨è¯¥é¢åå·æ¶æ¶é¸¦', graffiti_text_label: 'æå­/è¡¨æï¼æå¤30å­ï¼', graffiti_spray_btn: 'âï¸ å·æ¶', graffiti_confirm: 'å·æ¶æ¶é¸¦ï¼', graffiti_placed: 'âï¸ æ¶é¸¦å®æï¼', graffiti_text_required: 'è¯·è¾å¥æå­',
    banner_label: 'èå©æå¸', banner_btn: 'ð© ææ', banner_modal_title: 'æä¸èå©æå¸', banner_modal_desc: 'å¨é¢åä¸æä¸èå©æå¸', banner_emoji_label: 'æå¸è¡¨æ', banner_msg_label: 'ææå£å·ï¼å¯éï¼', banner_plant_btn: 'ð© ææ', banner_confirm: 'æä¸èå©æå¸ï¼', banner_planted: 'ð© æå¸å·²æä¸ï¼',
    rating_your_label: 'æçè¯å', rating_confirm: 'è¯ä»·é¢åï¼', rating_submitted: 'â­ è¯åå·²æäº¤ï¼',
    highlight_btn: 'â¨ é«äº®', highlight_modal_title: 'é¢åé«äº®', highlight_modal_desc: 'è®©æ¨çé¢åå¨å°å¾ä¸åå', highlight_color_label: 'åæé¢è²', highlight_activate_btn: 'â¨ æ¿æ´»', highlight_confirm: 'é«äº®é¢åï¼', highlight_activated: 'â¨ é¢åé«äº®æåï¼', highlight_active_label: 'é«äº®ä¸­',
    tdesc_title: 'é¢å°æè¿°', tdesc_desc: 'ä¸ºæ¨çé¢å°æ·»å èªå®ä¹æè¿°ï¼ææç©å®¶å¯è§ã', tdesc_claim_label: 'é¢å°ç¼å·', tdesc_use_claim: 'ð æç', tdesc_current_label: 'å½åæè¿°', tdesc_text_label: 'æè¿°', tdesc_save_btn: 'ð ä¿å­æè¿°', tdesc_my_label: 'æçæè¿°', tdesc_none: 'ææ æè¿°ã', tdesc_save_confirm: 'ä¿å­é¢å°æè¿°ï¼', tdesc_required: 'è¯·è¾å¥æè¿°', tdesc_claim_required: 'è¯·è¾å¥é¢å°ç¼å·', tdesc_no_claim: 'è¯·åéæ©ä¸ä¸ªé¢å°', tdesc_free: 'åè´¹', tdesc_saved: 'â æè¿°å·²ä¿å­ï¼', tdesc_free_hint: 'é¦æ¬¡æè¿°åè´¹ï¼ä¿®æ¹éè¦{cost} GPã',
    sponsor_label: 'èµå©å', sponsor_btn: 'ðï¸ èµå©', sponsor_modal_title: 'èµå©é¢å°', sponsor_modal_desc: 'èµå©é¢å° #', sponsor_msg_label: 'æ¶æ¯ï¼å¯éï¼', sponsor_place_btn: 'ðï¸ èµå©', sponsor_confirm: 'èµå©æ­¤é¢å°ï¼', sponsor_placed: 'ðï¸ èµå©æåï¼',
    capsule_title: 'æ¶é´è¶å', capsule_desc: 'å°å­ä¸æ¡æ¶æ¯ï¼å¨æªæ¥æå¤©åææç©å®¶æ­ç¤ºã', capsule_msg_label: 'æ¶æ¯ï¼æå¤280å­ç¬¦ï¼', capsule_days_label: 'æ­ç¤ºæ¥æï¼å¤©åï¼', capsule_bury_btn: 'â³ åå¥è¶å', capsule_revealed_label: 'æè¿æ­ç¤º', capsule_none: 'ææ å·²æ­ç¤ºçè¶åã', capsule_none_pending: 'ææ åå¥çè¶åï¼æä¸ºç¬¬ä¸ä¸ªï¼', capsule_bury_confirm: 'åå¥æ¶é´è¶åï¼', capsule_msg_required: 'è¯·è¾å¥æ¶æ¯', capsule_days_required: 'è¯·è¾å¥å¤§äº0çå¤©æ°', capsule_buried: 'â³ è¶åå·²åå¥ï¼',
    milestone_title: 'æ®æ°å°éç¨ç¢', milestone_desc: 'å¨æ®æ°å°åå²ä¸­è®°å½ä¸ªäººéç¨ç¢ã', milestone_cat_label: 'ç±»å«', milestone_title_label: 'æ é¢ï¼æå¤50å­ç¬¦ï¼', milestone_desc_label: 'æè¿°ï¼æå¤200å­ç¬¦ï¼', milestone_record_btn: 'ð è®°å½éç¨ç¢', milestone_write_btn: 'â è®°å½éç¨ç¢', milestone_refresh_btn: 'âº å·æ°', milestone_cost_hint: 'è´¹ç¨: {gp} GP', milestone_empty: 'ææ éç¨ç¢ãæä¸ºç¬¬ä¸ä¸ªï¼', milestone_login_required: 'éè¦ç»å½', milestone_title_required: 'è¯·è¾å¥æ é¢', milestone_desc_required: 'è¯·è¾å¥æè¿°', milestone_confirm_title: 'è®°å½éç¨ç¢ï¼', milestone_confirm_body: 'ä»¥{gp} GPè®°å½{cat}éç¨ç¢"{title}"ï¼', milestone_recorded: 'éç¨ç¢å·²è®°å½å¨æ®æ°å°åå²ä¸­ï¼',
    tombstone_label: 'å¢ç¢', tombstone_btn: 'ðª¦ æ¾ç½®å¢ç¢', tombstone_modal_title: 'æ¾ç½®å¢ç¢', tombstone_modal_desc: 'å¨æ¨æ¾ç»æ¥æçé¢å°ä¸çä¸å¢å¿é­ã', tombstone_epitaph_label: 'å¢å¿é­ï¼æå¤60å­ç¬¦ï¼', tombstone_place_btn: 'ðª¦ æ¾ç½®', tombstone_cost_hint: 'è´¹ç¨: {gp} GP', tombstone_confirm_title: 'æ¾ç½®å¢ç¢ï¼', tombstone_confirm_body: 'è±è´¹{gp} GPæ¾ç½®æ°¸ä¹å¢ç¢ï¼', tombstone_placed: 'å¢ç¢å·²æ¾ç½®ã',
    gpannounce_title: 'æ®æ°å°å¹¿æ­', gpannounce_desc: 'å¨æ»å¨å­å¹ä¸­åæææ´»è·ç©å®¶å¹¿æ­æ¶æ¯ã', gpannounce_msg_label: 'æ¶æ¯ï¼æå¤80å­ç¬¦ï¼', gpannounce_dur_label: 'æç»­æ¶é´ï¼åéï¼', gpannounce_post_btn: 'ð¢ å¹¿æ­', gpannounce_login_required: 'éè¦ç»å½', gpannounce_msg_required: 'è¯·è¾å¥å¹¿æ­æ¶æ¯', gpannounce_confirm_title: 'åå¸æ®æ°å°å¹¿æ­ï¼', gpannounce_confirm_body: '{dur}åéå¹¿æ­è´¹ç¨: {gp} GPãæ¶æ¯å°å¯¹æææ´»è·ç©å®¶æ¾ç¤ºã', gpannounce_posted: 'å¹¿æ­å·²å¼å§ï¼',
    prestige_label: 'å¨æ', prestige_upgrade_btn: 'ð åçº§å¨æ', prestige_modal_title: 'å¨æåçº§', prestige_confirm_btn: 'åçº§', prestige_permanent_note: 'å¨ææ¯æ°¸ä¹çï¼ä¸è½éçº§ã', prestige_login_required: 'éè¦ç»å½', prestige_max_reached: 'é¢å°å·²è¾¾æé«å¨æï¼é»ç³ï¼ï¼', prestige_upgraded: 'ð é¢å°åçº§ä¸º{name}å¨æï¼',
    journal_title: 'æ®æ°å°æ¥å¿', journal_desc: 'åæ®æ°å°å¬å¼è®°å½åå¸æ°¸ä¹æ¡ç®ãæ¨çæå­å°æ°¸è¿çå­äºè¾¹çã', journal_title_label: 'æ é¢ï¼æå¤60å­ç¬¦ï¼', journal_content_label: 'åå®¹ï¼æå¤500å­ç¬¦ï¼', journal_publish_btn: 'ð åå¸æ¡ç®', journal_write_btn: 'â åä¸ç¯æ¡ç®', journal_feed_label: 'æ®æ°å°ç¼å¹´å²', journal_refresh_btn: 'âº å·æ°', journal_cost_hint: 'è´¹ç¨: {gp} GP', journal_empty: 'ææ æ¥å¿æ¡ç®ãæä¸ºç¬¬ä¸ä¸ªä¹¦ååå²çäººï¼', journal_login_required: 'åå¸éè¦ç»å½', journal_title_required: 'è¯·è¾å¥æ é¢', journal_content_required: 'è¯·è¾å¥åå®¹', journal_confirm_title: 'åå¸æ¥å¿æ¡ç®ï¼', journal_confirm_body: 'ä»¥{gp} GPåå¸"{title}"ï¼æ­¤æ¡ç®å°æ°¸ä¹å¬å¼ã', journal_published: 'æ¡ç®å·²åå¸è³æ®æ°å°ç¼å¹´å²ï¼',
    base_profile_btn: 'ð¤ ä¸ªäººèµæ', profile_nickname_label: 'æµç§°', profile_motto_label: 'åº§å³é­', profile_color_label: 'å¤´åé¢è²', profile_set_btn: 'è®¾ç½®', profile_history_btn: 'ð ä¿®æ¹è®°å½', profile_no_motto: 'æªè®¾ç½®åº§å³é­', profile_nick_confirm: 'è®¾ç½®æµç§°ï¼', profile_motto_confirm: 'è®¾ç½®åº§å³é­ï¼', profile_color_confirm: 'è®¾ç½®å¤´åé¢è²ï¼',
    quests_failed: 'ä»»å¡å è½½å¤±è´¥',
    quests_none_active: 'ææ è¿è¡ä¸­çä»»å¡ãè¯·ç¨ååæ¥æ¥çï¼',
    quests_pool_depleted: 'å¥æ± å·²èå°½ â å¥å±ææ¶æå',
    quests_pool_low: 'å¥æ± ä¸è¶³ â å¥å±éè³{pct}%',
    quests_tier_free: 'åè´¹ä»»å¡',
    quests_tier_activity: 'æ´»å¨ä»»å¡',
    quests_tier_spending: 'ç¹æ®è¡å¨',
    quests_claim_btn: 'é¢å',
    quests_claim_prefix: 'é¢å',
    quests_claiming: 'é¢åä¸­...',
    quests_pool_empty_unavailable: 'å¥æ± å·²ç©ºï¼æ æ³é¢åå¥å±',
    quests_recently_completed: 'æè¿å®æ',
    quests_expired: 'å·²è¿æ',
    quests_remaining: 'å©ä½',
    quests_claim_failed: 'é¢åå¤±è´¥',
    quests_claim_success: 'å®æ"{title}"è·å¾ +{gp} GPï¼',
    quests_network_error: 'ç½ç»éè¯¯',
    quests_login_first: 'è¯·åç»å½',
    quests_completed_toast: 'ä»»å¡å®æï¼"{title}" â é¢åå¥å±ï¼',
    // Daily check-in
    daily_checkin_title: 'ð æ¯æ¥ç­¾å°',
    daily_streak_days: 'ð¥ è¿ç»­{n}å¤©',
    daily_day_of: 'ç¬¬{cur}/{total}å¤©',
    daily_day_prefix: 'ç¬¬',
    daily_done: 'å®æ',
    daily_gp_suffix: 'GP',
    daily_bonus_suffix: 'å¥å±',
    daily_checked_in: 'â ä»æ¥å·²ç­¾å°ï¼',
    daily_today_label: 'ä»æ¥:',
    daily_checkin_btn: 'â ç­¾å°',
    daily_missions_title: 'æ¯æ¥ä»»å¡',
    daily_resets_prefix: 'éç½®',
    daily_all_bonus_title: 'ð +50 GP å¥å±ï¼',
    daily_all_bonus_sub: 'å¨é¨æ¯æ¥ä»»å¡å®æ',
    daily_login_required: 'éè¦ç»å½',
    daily_already_checked: 'ä»æ¥å·²ç­¾å°ï¼',
    daily_check_in_failed: 'ç­¾å°å¤±è´¥ï¼è¯·éè¯',
    daily_gp_claimed: '+{n} GP å·²é¢åï¼',
    daily_streak_bonus: '+{n} GP è¿ç»­å¥å±ï¼',
    daily_checkin_complete: 'ç­¾å°å®æ',
    daily_streak_msg: 'ç¬¬{n}å¤©è¿ç»­ç­¾å°ï¼',
    daily_mission_complete_toast: '+{n} GP ä»»å¡å®æï¼',
    daily_all_missions_bonus_toast: 'ð +50 GP å¨ä»»å¡å¥å±ï¼',
    daily_mission_claim_failed: 'é¢åå¤±è´¥',
    daily_mission_claim_conn_failed: 'é¢åå¤±è´¥ â è¯·æ£æ¥ç½ç»',
    dm_claim_pixels: 'æ©å¼ é¢å', dm_claim_pixels_d: 'å¨ç«æä¸å é¢åç´ ',
    dm_harvest: 'ééèµæº', dm_harvest_d: 'ä»ä½ çé¢åæ¶è·PP',
    dm_explore_poi: 'ä¾¦å¯ä»»å¡', dm_explore_poi_d: 'å¨å°çä»ªä¸åç°POIæ è®°',
    dm_hijack: 'æå¯¹å¤ºå', dm_hijack_d: 'ç¨GPå¤ºåæäººé¢å',
    dm_play_cantina: 'éé¦ä¹å¤', dm_play_cantina_d: 'å¨éé¦ç©ä¸ä¸ªå°æ¸¸æ',
    dm_equip_cosmetic: 'ç«ææ¶å°', dm_equip_cosmetic_d: 'ä»èåè£å¤ä¸ä¸ªè£é¥°å',
    dm_view_weather: 'é£æ´è¿½è¸ªè', dm_view_weather_d: 'æ¥çç«æå¤©æ°é¢æ¥',
    dm_enhance_item: 'å¼ºåå®éªå®¤', dm_enhance_item_d: 'å°è¯å¼ºåä¸ä»¶è£é¥°å',
    dm_marketplace_trade: 'å¸åºä¹æ¥', dm_marketplace_trade_d: 'å¨å¸åºä¸è´­ä¹°ä¸ä»¶ç©å',
    dm_win_naval_battle: 'æµ·æèå©', dm_win_naval_battle_d: 'ä¸å¦ä¸æ¯è°éä½æå¹¶è·è',
    dm_build_ship: 'è¹åå²åº', dm_build_ship_d: 'ä¸ºä½ çè°éè®¢è´­ä¸èæ°è¹',
    dm_daily_checkin: 'æ¯æ¥ç­¾å°', dm_daily_checkin_d: 'ä»å¤©ç»å½å¹¶ç­¾å°',
    dm_claim_fallback: 'å é¢é¢å', dm_claim_fallback_d: 'å¨ç«æä¸å é¢åç´ ',
    dm_explore_fallback: 'æ¢ç´¢æåº', dm_explore_fallback_d: 'å¨å°çä»ªä¸åç°POIæ è®°',
    dm_play_fallback: 'æ¯æ¥æ´»å¨', dm_play_fallback_d: 'æ§è¡ä»»ä½æ¸¸ææä½ï¼å é¢ãéç¿ãå¤ºåç­ï¼',
    // ââ GUILD tab ââ
    guild_join_or_create: 'å å¥æåå»ºå¬ä¼',
    guild_teamup_desc: 'ä¸å¶ä»æ®æ°èæºæç§°é¸ç«æ',
    guild_pending_invites: 'å¾å¤ççéè¯·',
    guild_find_title: 'æ¥æ¾å¬ä¼',
    guild_find_hint: '(ID Â· æ ç­¾ Â· åç§°)',
    guild_find_placeholder: 'ä¾å¦ï¼42 Â· MARS Â· Red Legion',
    guild_search_btn: 'æç´¢',
    guild_create_title: 'åå»ºæ°å¬ä¼',
    guild_create_cost_hint: '(æ¶è 50 GP)',
    guild_name_placeholder: 'å¬ä¼åç§° (2-50 å­ç¬¦)',
    guild_tag_placeholder: 'æ ç­¾ (2-4)',
    guild_desc_placeholder: 'è¯´æï¼å¯éï¼',
    guild_create_btn: 'åå»ºå¬ä¼ (50 GP)',
    guild_members_label: 'æå',
    guild_total_pixels_label: 'æ»åç´ ',
    guild_gp_treasury_label: 'GP éåº',
    guild_edit_btn: 'â ç¼è¾',
    guild_upgrades_title: 'å¬ä¼åçº§',
    guild_pp_treasury: 'PP éåº',
    guild_next_prefix: 'ä¸ä¸çº§ï¼',
    guild_next_dash: 'ä¸ä¸çº§ï¼â',
    guild_max_level: 'æ»¡çº§',
    guild_levelup_btn: 'åçº§ â²',
    guild_my_contribution: 'æçæ¶æè´¡ç®',
    guild_contribution_hint: 'æ¯æ¬¡æ¶æçä¸é¨åå°æµå¥å¬ä¼éåºã',
    guild_research_title: 'ç ç©¶',
    guild_research_unlocked: 'â å·²è§£é',
    research_mining_eff_1: 'â éç¿æç I', research_shield_disc: 'ð¡ ç¾çè®­ç»', research_diplomatic: 'ð å¤äº¤æ¯',
    research_orbital_scan: 'ð° è½¨éæ«æ', research_rapid_deploy: 'ð å¿«éé¨ç½²', research_logistics: 'ð¦ åå¤ç®¡ç', research_mars_dominion: 'ð¥ ç«æç»æ²»',
    guild_join_requests: 'å å¥ç³è¯·',
    guild_no_requests: 'ææ å¾å¤çç³è¯·ã',
    guild_invite_title: 'éè¯·ç©å®¶',
    guild_invite_hint: '(ææµç§°æé±åæç´¢)',
    guild_invite_placeholder: 'è¾å¥1ä¸ªä»¥ä¸å­ç¬¦æç´¢...',
    guild_invite_btn: 'éè¯·',
    guild_chat_title: 'ð¬ å¬ä¼èå¤©',
    guild_chat_refresh: 'â» å·æ°',
    guild_chat_empty: 'è¿æ²¡ææ¶æ¯ãæä¸ªæå¼å§ï¼',
    guild_chat_loading: 'æ­£å¨å è½½èå¤©...',
    guild_chat_placeholder: 'è¾å¥æ¶æ¯...',
    guild_chat_send: 'åé',
    guild_leaderboard_title: 'å¬ä¼æè¡æ¦',
    guild_leave_btn: 'ç¦»å¼å¬ä¼',
    guild_danger_zone: 'å±é©åºå',
    guild_disband_btn: 'è§£æ£å¬ä¼',
    guild_lb_empty: 'è¿æ²¡æå¬ä¼ãæä¸ºç¬¬ä¸ä¸ªå§ï¼',
    guild_lb_members_suffix: 'æå',
    guild_lb_leader_prefix: 'ä¼é¿ï¼',
    guild_lb_unknown: 'æªç¥',
    guild_lb_pixels: 'åç´ ',
    guild_level_prefix: 'Lv.',
    guild_invited_by: 'éè¯·èï¼',
    guild_accept_btn: 'æ¥å',
    guild_promote_btn: 'æå',
    guild_demote_btn: 'éçº§',
    guild_kick_btn: 'è¸¢åº',
    guild_transfer_btn: 'è½¬è®©',
    guild_member_role: 'æå',
    guild_officer_role: 'åå®',
    guild_leader_role: 'ä¼é¿',
    guild_search_searching: 'æç´¢ä¸­â¦',
    guild_search_none: 'æªæ¾å°ä¸"{q}"å¹éçå¬ä¼',
    guild_search_failed: 'æç´¢å¤±è´¥',
    guild_search_join_btn: 'å å¥',
    guild_invite_no_matches: 'æ å¹éã',
    guild_invite_pending: 'å¾å¤ç',
    guild_invite_search_failed: 'æç´¢å¤±è´¥ã',
    guild_pixels_owned: 'åç´ æ¥æ',
    guild_pixels_short: 'åç´ ',
    guild_toast_login_first: 'è¯·åç»å½',
    guild_toast_no_guild: 'æ å¬ä¼',
    guild_toast_need_name_tag: 'è¯·è¾å¥å¬ä¼åç§°åæ ç­¾',
    guild_toast_created: 'å¬ä¼ [{tag}] å·²åå»ºï¼',
    guild_toast_create_failed: 'åå»ºå¬ä¼å¤±è´¥',
    guild_toast_enter_target: 'è¯·è¾å¥é±åææµç§°',
    guild_toast_invite_sent: 'éè¯·å·²åéï¼',
    guild_toast_invite_failed: 'éè¯·å¤±è´¥',
    guild_toast_joined: 'å·²å å¥å¬ä¼ï¼',
    guild_toast_accept_failed: 'æ¥åå¤±è´¥',
    guild_toast_declined: 'å·²æç»éè¯·',
    guild_toast_generic_failed: 'å¤±è´¥',
    guild_toast_player_added: 'ç©å®¶å·²å å¥å¬ä¼',
    guild_toast_sign_in_first: 'è¯·åç»å½',
    guild_confirm_join_request: 'å {name} åéå å¥ç³è¯·ï¼\n\néç±è¯¥å¬ä¼çä¼é¿æåå®æ¹åã',
    guild_toast_join_request_sent: 'å å¥ç³è¯·å·²åéè³ {name}',
    guild_toast_join_request_failed: 'åéç³è¯·å¤±è´¥',
    guild_confirm_leave: 'ç¦»å¼æ­¤å¬ä¼ï¼',
    guild_toast_left: 'å·²ç¦»å¼å¬ä¼',
    guild_confirm_kick: 'è¸¢åºè¯¥æåï¼',
    guild_toast_kicked: 'å·²è¸¢åºæå',
    guild_toast_promoted: 'å·²æåä¸ºåå®',
    guild_toast_demoted: 'å·²éçº§ä¸ºæå',
    guild_confirm_transfer: 'è½¬è®©ä¼é¿æéï¼æ­¤æä½æ æ³æ¤éã',
    guild_toast_transferred: 'ä¼é¿æéå·²è½¬è®©',
    guild_toast_leveled_up: 'å¬ä¼åçº§è³ Lv.{n}ï¼',
    guild_toast_levelup_failed: 'åçº§å¤±è´¥',
    guild_toast_research_unlocked: 'ç ç©¶å·²è§£éï¼',
    guild_toast_research_failed: 'ç ç©¶å¤±è´¥',
    guild_confirm_disband: 'â  è§£æ£å¬ä¼ "{name}"ï¼\n\næææåå°è¢«ç§»é¤ã\næ­¤æä½æ æ³æ¤éï¼',
    guild_prompt_disband_type: 'è¯·åç¡®è¾å¥å¬ä¼åç§°ä»¥ç¡®è®¤ï¼\n\n{name}',
    guild_toast_disband_mismatch: 'å¬ä¼åç§°ä¸å¹é â å·²åæ¶è§£æ£',
    guild_toast_disbanded: 'å¬ä¼å·²è§£æ£',
    guild_toast_no_guild_data: 'æ å¬ä¼æ°æ®',
    guild_toast_send_failed: 'åéå¤±è´¥',
    // ââ Global UI ââ
    nav_claim: 'å é¢', nav_cantina: 'éå§', nav_base: 'åºå°', nav_items: 'éå·',
    nav_my_land: 'æçé¢å', sectors_btn: 'åºå', open_gacha_label: 'è°è¹å®ç®±', open_gacha_sub: 'æ½å¡', my_assets_btn: 'æçèµäº§', full_loss_optin_label: '⚔ 同意PvP永久损失 — 仅双方同意的战斗中击沉舰船永久消失',
    open_base: 'æå¼åºå°', open_gacha: 'ð² è°è¹å®ç®±', enter_cantina: 'â è¿å¥éå§',
    my_base: 'æçåºå°', deposit_btn: 'åå¼', withdraw_btn: 'æç°', logout_btn: 'éåº',
    harvest_all_btn: 'â æ¹éæ¶è·', tend_all_btn: 'ð§ æ¹éç»´æ¤', export_key_btn: 'ð å¯é¥', export_key_title: 'ð å¯¼åºé±åå¯é¥', export_key_disclaimer: 'â  è¿å°æ¾ç¤ºæ¨é±åçç§é¥ãä»»ä½æææ­¤å¯é¥çäººé½è½æ§å¶æ¨çèµéãè¯·ç¦»çº¿ä¿å­ï¼åå¿åäº«ã<b>ä¿ç®¡è´£ä»»å®å¨ç±æ¨æ¿æï¼è¥ä¸¢å¤±æè¢«çï¼è¿è¥æ¹æ æ³æ¾åå¯é¥æèµäº§ã</b>', export_key_ack: 'æçè§£å¹¶æ¥åå¦¥åä¿ç®¡å¯é¥çå¨é¨è´£ä»»ã', export_key_pw_ph: 'ç¡®è®¤å¯ç ', export_key_reveal_btn: 'æ¾ç¤ºç§é¥', export_key_addr: 'å°å', export_key_priv: 'ç§é¥', export_key_copy: 'ð å¤å¶å¯é¥', export_key_close_warn: 'ä¿å­åè¯·å³é­æ­¤çªå£ãå¯é¥ä¸ä¼èªå¨åæ¬¡æ¾ç¤ºã',
    address_copied: 'å°åå·²å¤å¶ï¼',
    top_governors: 'ð é¡¶çº§æ»ç£', loading_dots: 'å è½½ä¸­...',
    no_alerts: 'ææ æé', live_feed_title: 'å®æ¶å¨æ', live_feed_empty: 'ææ å®æ¶äºä»¶ã',
    claim_land: 'å é¢é¢å', drag_select: 'æå¨éæ©é¢å',
    land_size: 'å¤§å°', land_pixels: 'åç´ ', land_cost: 'è´¹ç¨',
    confirm_btn: 'ç¡®è®¤', cancel_btn: 'åæ¶',
    claim_add_img: 'åå é¢é¢åï¼ä¹ååæ·»å å¾ç',
    my_territories: 'æçé¢å', no_territories: 'ææ é¢å',
    info_guild: 'å¬ä¼', info_link: 'é¾æ¥', info_name: 'åç§°',
    share_btn: 'ð¤ åäº«', rename_btn: 'éå½å', edit_image: 'ç¼è¾å¾ç', customize_btn: 'â¨ èªå®ä¹', merge_btn: 'ð åå¹¶é¢å°',
    cosmetics_title: 'è£é¥°å', promo_link: 'æ¨å¹¿é¾æ¥', save_btn: 'ä¿å­',
    hijack_warn_title: 'â  å«æé¢å',
    hijack_btn_short: 'â å«æé¢å°',
    hijack_current_owner: 'å½åæ¥æèï¼',
    hijack_refund: 'æ¥æèè·å¾ï¼éæ¬¾ + 10%å¥é',
    hijack_you_pay: 'ä½ æ¯ä»ï¼',
    claim_location: 'ä½ç½®', claim_chain: 'é¾', claim_cost: 'è´¹ç¨',
    claim_pay_with: 'æ¯ä»æ¹å¼', claim_note: 'æ¥æèè·å¾100%éæ¬¾ + 10%å¥é Â· æç»­è´¹ï¼10%',
    image_editor: 'å¾çç¼è¾å¨', upload_click: 'ç¹å»ä¸ä¼ å¾ç',
    upload_hint: 'PNG, JPG, GIF Â· æå¤§5MB',
    editor_drag_hint: 'æå¨ç§»å¨ Â· æ»å¨ç¼©æ¾ Â· æé®æè½¬',
    swap_fee: 'åæ¢è´¹ï¼', you_receive: 'ä½ æ¶å°ï¼',
    item_shop_title: 'ð¡ï¸ éå·ååº',
    shop_tab_shop: 'ð ååº', shop_tab_inv: 'ð¦ æçéå·',
    shop_cat_all: 'å¨é¨', shop_cat_defense: 'é²å¾¡', shop_cat_attack: 'æ»å»',
    shop_cat_utility: 'å®ç¨', shop_cat_boost: 'å¢ç', shop_cat_cosmetic: 'è£é¥°',
    shop_active_effects: 'æ¿æ´»ææ', shop_my_inventory: 'æçåºå­',
    shop_confirm_title: 'ç¡®è®¤è´­ä¹°',
    shop_loading: 'å è½½éå·ä¸­...', shop_inv_loading: 'å è½½åºå­ä¸­...',
    // ââ å¼ºå ââ
    enh_enhance: 'å¼ºå', enh_workshop: 'å¼ºåå·¥å',
    enh_materialized: 'å¼ºååå¤å®æï¼', enh_returned: 'å·²è¿ååºå­',
    enh_materialize_tip: 'è½¬æ¢ä¸ºå¯å¼ºåçåç¬éå·',
    enh_return_tip: 'è¿ååºå­å å ',
    enh_current_level: 'å½åç­çº§', enh_next_level: 'ä¸ä¸ç­çº§',
    enh_cost: 'è´¹ç¨', enh_balance: 'ä½é¢', enh_success_rate: 'æåç',
    enh_body: 'å°è¯å¼ºåæ­¤éå·ãå¤±è´¥å¯è½ï¼ç­çº§ä¸åãéçº§æéå·éæ¯ã',
    enh_maxed_body: 'æ­¤éå·å·²è¾¾æé«å¼ºåç­çº§ã',
    enh_confirm: 'å¼ºå', enh_success: 'å¼ºåæåï¼',
    enh_fail_stay: 'å¼ºåå¤±è´¥ï¼ç­çº§ä¸åã',
    enh_fail_down: 'å¼ºåå¤±è´¥ï¼ç­çº§éè³',
    enh_fail_destroy: 'å¼ºåå¤±è´¥ï¼éå·å·²éæ¯ï¼',
    cmd_message: 'ææ¥å®æ¶æ¯',
    total_px_label: 'æ»åç´ ', usdt_bal_label: 'USDTä½é¢', pp_bal_label: 'PPä½é¢',
    level_label: 'ç­çº§', xp_next: 'ä¸ä¸çº§ï¼{n} XP', max_level: 'æ»¡çº§',
    share_stats: 'ð¤ åäº«æç»©', breakthrough_title: 'çªç ´',
    all_ranks: 'å¨é¨ç­çº§', show_label: 'â¼ å±å¼', hide_label: 'â² æ¶èµ·',
    rank_tbl_lv: 'LV', rank_tbl_name: 'åç§°', rank_tbl_xp: 'XP', rank_tbl_reward: 'PPå¥å±',
    my_sectors: 'æçåºå', no_sectors_yet: 'è¿æ²¡æé¢åãå»æ¢ç´¢å°å¾å§ï¼',
    login_to_view: 'ç»å½ä»¥æ¥çä½ çé¢åã',
    all_24_sectors: 'å¨é¨24ä¸ªåºå',
    sector_all: 'å¨é¨', sector_core: 'æ ¸å¿', sector_mid: 'ä¸­é´', sector_frontier: 'åæ²¿',
    sector_my: 'â­ æçåºå', sector_loading: 'å è½½åºåä¸­...',
    sector_claims_24h: '24å°æ¶å{n}æ¬¡å é¢', sector_occupied: 'å æ',
    sector_avg_price: 'åä»·', sector_cur_price: 'å½åä»·', sector_owners: 'æ¥æèæ°',
    sector_top_holder: 'æå¤§ææè', sector_gov: 'æ»ç£', sector_vice_gov: 'å¯æ»ç£',
    sector_tax: 'ç¨ç', sector_my_px: 'æçåç´ ', sector_go: 'åå¾',
    sector_empty_hint: 'ä½ è¿æ²¡æä»»ä½åç´ ãå é¢é¢ååå°å¨æ­¤æ¾ç¤ºã',
    harvestable_pp: 'å¯æ¶è·PP', total_mined: 'æ»éç¿é',
    harvest_pp: 'â éç¿', harvest_now: 'â¡ ç«å³éç¿ï¼{cost} PPï¼', mine_btn: 'â éç¿',
    mine_timer_prefix: 'è·ä¸æ¬¡æ¶è·è¿æ',
    harvest_available: 'ç°å¨å¯ä»¥æ¶è·ï¼', harvest_ready: 'å°±ç»ªï¼',
    claim_to_mine: 'å é¢åç´ å¼å§éç¿ï¼',
    mining_rates: 'éç¿æ¯ç',
    rate_reward_range: 'å¥å±èå´', rate_interval: 'æ¶è·é´é',
    rate_core: 'æ ¸å¿å æ', rate_mid: 'ä¸­é´å æ', rate_frontier: 'åæ²¿å æ',
    governance_title: 'â æ²»ç',
    gov_active_events: 'æ´»å¨ä¸­çäºä»¶', gov_my_positions: 'æçèä½',
    gov_login_positions: 'ç»å½ä»¥æ¥çæ²»çèä½ã',
    gov_commander: 'ææ¥å®', gov_commander_controls: 'ææ¥å®æ§å¶å°',
    gov_global_event: 'å¨å±äºä»¶ï¼æ¯æ¥1æ¬¡ï¼',
    gov_double_mining: 'â ååéç¿', gov_war_time: 'â ææ¶', gov_peace: 'ð åå¹³',
    gov_announcement: 'å¬å', gov_announce_placeholder: 'å¨å±æ¶æ¯...',
    gov_set: 'è®¾å®', gov_bounty: 'æ¬èµ', gov_target_nick: 'ç®æ æµç§°',
    gov_place: 'åå¸', gov_rocket_drop: 'ç«ç®­è¡¥ç»ææ¾',
    gov_launch_drop: 'ð åå°è¡¥ç»',
    gov_governor_controls: 'æ»ç£æ§å¶å°', gov_select_sector: 'éæ©åºå â¾',
    gov_tax_rate: 'ç¨ç', gov_sector_buffs: 'åºåå¢ç',
    gov_mining_20: 'â éç¿+20%', gov_defense_10: 'ð¡ é²å¾¡+10%', gov_claim_10: 'ð° å é¢-10%',
    gov_sector_announce: 'åºåå¬å', gov_sector_msg: 'åºåæ¶æ¯...',
    gov_bounty_board: 'æ¬èµæ¿', gov_no_bounties: 'ææ æ´»å¨æ¬èµã',
    gov_siege_title: 'âï¸ åºåæ»åæ', gov_select_sector_siege: 'éæ©åºå...',
    gov_select_siege_hint: 'éæ©åºåä»¥æ¥çæ»åç¶æã',
    gov_challenge_btn: 'âï¸ æææ»ç£',
    gov_betting_title: 'ð° æ»åæææ³¨', gov_bet_challenger: 'âï¸ ææè', gov_bet_governor: 'ð¡ æ»ç£',
    gov_declaration: 'æ»ç£å®£è¨ (5 GP)',
    gov_declare_save: 'å®£è¨',
    gov_policy_open: 'å¼æ¾ï¼æ¬¢è¿ææäººï¼', gov_policy_ally: 'ä»åç', gov_policy_closed: 'å°é­',
    gov_titles_title: 'ð æçç§°å·', gov_titles_hint: 'è¿æ¥é±åä»¥æ¥çæ¨çç§°å·ã',
    gov_fleet_title: 'â æçè°é', gov_fleet_hint: 'è¿æ¥é±åä»¥æ¥çæ¨çè°éã',
    gov_fleet_empty: 'ææ è°è¹ â è¯·å¨ä¸æ¹é è¹åå¼å§å»ºé ã',
    gov_faction_btn: 'ð¡ æ´¾ç³»', gov_hijack_btn: 'â å«æ', gov_registry_btn: 'ð è°è¹å¾é´', gov_minerals_btn: 'ð ç¿ç©å¾é´',
    gov_fleet_my: 'æçæè°', gov_fleet_max: 'æå¤10è', gov_shipyard: 'é è¹å',
    gov_ship_build: 'å»ºé è°è¹', gov_ship_built: 'å»ºé å®æï¼', gov_ship_repair: 'ä¿®ç',
    gov_ship_repaired: 'è°è¹ä¿®çå®æï¼', gov_ship_repair_confirm: 'å°æ­¤è°è¹ä¿®çè³æ»¡HPï¼',
    gov_ship_upgrade: 'åçº§', gov_ship_upgraded: 'åçº§å®æï¼', gov_ship_upgrade_cost: 'åçº§è´¹ç¨',
    sy_tab_blueprints: 'èå¾', sy_tab_queue: 'å»ºé éå', sy_tab_fleet: 'æçè°é', sy_tab_market: 'è°è¹å¸åº', sy_tab_crates: 'å®ç®±', sy_tab_assembly: 'å¯å¨', sy_crate_intro: 'æå¼å®ç®±è·å¾éæºè°è¹ãè·å¾çè°è¹å¯å¨è°è¹å¸åºäº¤æãæ¯ä¸ªå®ç®±é½å¬å¼æè½æ¦çã',
    sy_filter_size: 'è°çº§:', sy_size_all: 'å¨é¨', sy_size_frigate: 'æ¤å«è°', sy_size_destroyer: 'é©±éè°', sy_size_cruiser: 'å·¡æ´è°', sy_size_battleship: 'æåè°', sy_size_titan: 'æ³°å¦',
    sy_filter_faction: 'å¿å:', sy_filter_size2: 'å¤§å°:',
    sy_mineral_label: 'ç¿ç³ææ', sy_ships_label: 'è°è¹',
    ship_mkt_buy: 'è´­ä¹°', ship_mkt_cancel: 'åæ¶ä¸æ¶',
    gov_battle_title: 'âï¸ æµ·æ', gov_battle_hint: 'è¿æ¥é±åä»¥æ¥çæµ·æã',
    gov_battle_active: 'è¿è¡ä¸­çææ', gov_battle_declare: 'å®£æ',
    gov_battle_declared: 'å·²å®£æï¼ç­å¾é²å®æ¹ååºã',
    gov_battle_history: 'ææè®°å½', gov_battle_no_ships: 'è¯·åå»ºé æè°ï¼',
    gov_battle_target_label: 'ç®æ é±åå°å', gov_battle_select_ships: 'éæ©æè°ï¼æå¤5èï¼',
    gov_battle_declare_confirm: 'å®£æ', gov_battle_respond: 'ååºææ',
    gov_battle_select_defender: 'éæ©é²å®æè°', gov_battle_accept: 'åºæï¼',
    gov_battle_fighting: 'ææå¼å§ï¼çº¦60ç§åæ¥çç»æã',
    gov_battle_cancelled_ok: 'ææå·²åæ¶ãGPå·²éè¿ã',
    gov_hall_of_fame: 'ð åäººå ', gov_select_sector_hof: 'éæ©åºå...',
    gov_select_hof_hint: 'éæ©åºåä»¥æ¥çåå²ã',
    ops_title: 'ä½æä»»å¡æ§å¶å°',
    ops_desc: 'ä»ä½ çé¢ååå°å°å¯å¨å¹¶ç®¡çå¥ä¾µåæ¢ç´¢ä»»å¡',
    ops_pads_ready: 'åå°å°å°±ç»ª',
    ops_launch_new: 'åå°æ°ä»»å¡',
    ops_invasion: 'â å¥ä¾µ', ops_explore: 'ð° æ¢ç´¢',
    ops_select_pad: 'éæ©åå°å°', ops_bigger_reward: 'ï¼è¶å¤§çåå°å°âè¶å¤§çå¥å±ï¼',
    ops_target_lat: 'ç®æ çº¬åº¦', ops_target_lng: 'ç®æ ç»åº¦',
    ops_target_wallet: 'ç®æ é±å/æµç§°ï¼ä»å¥ä¾µï¼',
    ops_launch_btn: 'åå°ä»»å¡ â¶',
    ops_active: 'è¿è¡ä¸­çè¡å¨', ops_no_missions: 'æ æ´»å¨ä»»å¡ãå¨ä¸æ¹åå°ä¸ä¸ªã',
    ops_no_pads: 'â ä½ è¿æ²¡æé¢åãåå é¢åç´ æ¥è·å¾åå°å°ã',
    ops_launched: 'å·²åå°', ops_ready_status: 'â å°±ç»ª',
    ops_territory: 'é¢å', ops_merged: 'å·²åå¹¶',
    ops_ready_claim: 'å¯ä»¥é¢å', ops_failed: 'å¤±è´¥',
    ops_claim: 'é¢å', ops_abort: 'ä¸­æ­¢',
    ops_abort_title: 'ä¸­æ­¢ä»»å¡',
    ops_abort_body: 'å¬åæ­¤ä»»å¡ï¼åªè½éè¿é¨åçæè´¹ã',
    ops_abort_btn: 'ä¸­æ­¢',
    ops_connect_first: 'è¯·åè¿æ¥é±å', ops_pick_pad: 'è¯·åéæ©åå°å°',
    ops_enter_coords: 'è¯·è¾å¥ç®æ åæ ', ops_target_required: 'éè¦ç®æ é±åææµç§°',
    ops_mission_launched: 'ä»»å¡åå°æåï¼', ops_launch_failed: 'åå°å¤±è´¥ï¼',
    ops_claim_failed: 'é¢åå¤±è´¥ï¼', ops_load_failed: 'å è½½ä»»å¡å¤±è´¥ã',
    ops_mission_aborted: 'ä»»å¡ä¸­æ­¢ Â· {pp} PP å·²éè¿',
    ops_cancel_failed: 'åæ¶å¤±è´¥ï¼', ops_no_reward: 'æ å¥å±',
    ops_pick_hint: 'â è¯·å¨ä¸æ¹éæ©åå°å°', ops_await_target: 'â ç­å¾ç®æ éå®â¦',
    ops_computing: 'â¦è®¡ç®è½¨éä¸­',
    ops_browse: 'ð¯ æµè§',
    ops_invade_label: 'å¥ä¾µ', ops_explore_label: 'æ¢ç´¢',
    base_shop_btn: 'ð ååº', base_inv_btn: 'ð æçéå·',
    arena_connect: 'è¿æ¥',
    crash_title: 'CRASH', mines_title: 'MINES', coinflip_title: 'COINFLIP',
    dice_title: 'DICE', hilo_title: 'HI-LO',
    crash_guide_1: 'ä¸æ³¨', crash_guide_2: 'çæ¶¨', crash_guide_3: 'æç°ï¼',
    crash_waiting: 'ç­å¾ä¸­...', crash_next_round: 'ä¸ä¸è½®å³å°å¼å§',
    crash_bets_round: 'æ¬è½®ä¸æ³¨', bet_amount: 'ä¸æ³¨éé¢',
    auto_cashout: 'èªå¨æç°', place_bet: 'ä¸æ³¨',
    mines_count: 'å°é·æ°', gems_found: 'åç°çå®ç³',
    multiplier: 'åç', next_mult: 'ä¸ä¸åç', potential_win: 'é¢è®¡å¥é',
    start_game: 'å¼å§æ¸¸æ',
    pick_side: 'éæ©ä¸é¢', heads: 'HEADS', tails: 'TAILS',
    flip_coin: 'æç¡¬å¸',
    roll_to_play: 'æ·éª°å¼å§', roll_over: 'å¤§äº', roll_under: 'å°äº',
    dice_target: 'ç®æ ', win_chance: 'èç', roll_dice: 'æ·éª°å­',
    hilo_higher: 'â¬ æ´é«', hilo_cashout: 'æç°', hilo_lower: 'â¬ æ´ä½',
    prof_referral: 'æ¨è', prof_live_feed: 'å®æ¶å¨æ', prof_alerts: 'æé',
    prof_settings: 'è®¾ç½®',
    ref_share_desc: 'åäº«ä½ çæ¨èç ï¼å¨æ¨èäººç live ä½£éæ´»å¨ï¼åå¼Â·åæ¢Â·ååºÂ·å¡æçº³Â·å¸åºæç»­è´¹ï¼ä¸­è·å¾PPã',
    ref_my_code: 'æçæ¨èç ', ref_code_copied: 'æ¨èç å·²å¤å¶ï¼',
    ref_enter_code: 'è¾å¥æ¨èç ', ref_code_placeholder: 'æ¨èç ...',
    ref_referred_by: 'æ¨èäººï¼', prof_no_alerts: 'ææ æé',
    settings_display: 'æ¾ç¤º', settings_notifications: 'éç¥',
    settings_account: 'è´¦æ·',
    disp_weather: 'æ¾ç¤ºå¤©æ°æ ', disp_commander: 'æ¾ç¤ºææ¥å®æ¨ªå¹',
    disp_rocket: 'æ¾ç¤ºç«ç®­äºä»¶æ¨ªå¹', disp_announce: 'æ¾ç¤ºå¬åå­å¹',
    disp_emblem: 'æ¾ç¤ºå¬ä¼å¾½ç« ', disp_tag: 'æ¾ç¤ºå¬ä¼æ ç­¾',
    notif_hijack: 'å«ææé', notif_weather: 'å¤©æ°äºä»¶',
    notif_rocket: 'ç«ç®­ææ¾', notif_mining: 'éç¿å®æ', notif_sound: 'é³æ',
    acct_change_pw: 'ð ä¿®æ¹å¯ç ', acct_export: 'ð¦ å¯¼åºæçæ°æ®', acct_delete: 'ð å é¤è´¦æ·',
    nick_new_placeholder: 'æ°æµç§°',
    prof_photo_updated: 'å¤´åå·²æ´æ°ï¼',
    rank_up_title: 'ç­çº§æåï¼', rank_up_msg: 'è¾¾å°ç­çº§{n}ï¼',
    wx_active: 'æ´»å¨',
    wx_sector: 'åºå', wx_time_left: 'å©ä½æ¶é´',
    wx_sandstorm: 'æ²æ´', wx_sandstorm_desc: 'çççé£æºå¸¦ç ç£¨é¢ç²æ è¿å°è¡¨',
    wx_solar_flare: 'å¤ªé³èæ', wx_solar_flare_desc: 'å¤ªé³çå¼ºçè¾å°å¹²æ°çµå­è®¾å¤',
    wx_meteor_shower: 'æµæé¨', wx_meteor_shower_desc: 'å°è¡æç¢çéè½å°å°è¡¨',
    wx_dust_devil: 'å°æé£', wx_dust_devil_desc: 'æè½¬çå°æ±éä½ä½ææç',
    wx_mining_yield: 'éç¿äº§é', wx_movement_speed: 'ç§»å¨éåº¦', wx_visibility: 'è½è§åº¦',
    wx_shield_strength: 'æ¤ç¾å¼ºåº¦', wx_hijack_cost: 'å«æè´¹ç¨',
    wx_rare_drop: 'ç¨ææè½ç', wx_harvest_bonus: 'æ¶è·å æ',
    wx_structure_damage: 'ç»ææä¼¤', wx_claim_cost: 'å é¢è´¹ç¨',
    wx_exploration_speed: 'æ¢ç´¢éåº¦',
    wx_reduced: 'éä½', wx_possible: 'å¯è½',
    wx_unknown: 'æªç¥å¤©æ°äºä»¶',
    mode_claim: 'ð´ ç¹å»ç«æéæ©é¢å',
    confirm_purchase: 'ç¡®è®¤è´­ä¹°',
    global_stats_label: 'ð å¨å±ç»è®¡',
    active_users_24h: 'æ´»è·ç¨æ·ï¼24å°æ¶ï¼',
    top_pixel_holders: 'ð é¡¶çº§åç´ ææè',
    refresh_btn: 'â» å·æ°',
    // ââ Transport (M-158) ââ
    transport_title: 'è·¨æåºè¿è¾',
    transport_desc: 'å¨æåºé´è¿éGPè´§ç©ãåäººè·å¾å¥å±ï¼æµ·çå¯å¨éä¸­å«æ ã',
    transport_sub_launch: 'åèµ·', transport_sub_my: 'æçè¿è¾', transport_sub_raid: 'ð´ å«æ ç®æ ',
    transport_info_title: 'ð ä»ä¹æ¯GPè´§ç©è¿è¾ï¼',
    transport_info_desc: 'å°GPä½ä¸º"è´§ç©"ä»æåºAè¿è¾å°BçPvPæ¶çç³»ç»ã',
    transport_info_merchant: 'â <b style="color:#FFB347">åäºº(Merchant)èä¸</b>å®æè¿è¾æ¶è·å¾<b>é¢å¤GPå¥å±</b>',
    transport_info_raid: 'â å¶ä»ç©å®¶å¯ä»¥å¨éä¸­ <b style="color:#FF6B6B">æ¦æªè´§ç©</b>ï¼å·æé£é©/æ¶ççPvPè¦ç´ ',
    transport_info_targets: 'ð´ å¨RAID TARGETSæ ç­¾ä¸­å¯ä»¥å«æ å¶ä»ç¨æ·çè´§ç©',
    transport_info_note: 'ð¡ ä¸ç©åäº¤ææï¼å¸åºï¼åå¼ â å¸åºå¨MARKETæ ç­¾',
    transport_launch_new: 'æ°è¿è¾',
    transport_origin: 'èµ·å§æåº', transport_dest: 'ç®çæåº', transport_cargo: 'è´§ç©GP',
    transport_launch_btn: 'ð å¼å§è¿è¾ â¶',
    transport_my_empty: 'ææ è¿è¾ãåèµ·ä¸æ¬¡å§ï¼',
    transport_raid_empty: 'å½åæ²¡æå¯å«æ çè¿è¾ã',
    transport_raid_warning: 'â  å«æ : è¢­å»å¶ä»ç©å®¶çè´§ç©ãæ¬äººä¸å¬ä¼æåé¤å¤ãæ¯æ¬¡å°è¯æå·å´æ¶é´ã',
    transport_cancel_btn: 'â åæ¶',
    transport_raid_btn: 'ð´ å«æ ',
    // ââ Fleet Command / World Events / Misc (global) ââ
    fcmd_title: 'â è°éææ¥é¨',
    fcmd_sub: 'è°é Â· é è¹å Â· Void Raider',
    fcmd_open_shipyard: 'ð¨ é è¹å',
    fcmd_my_fleets: 'â æçè°é',
    fcmd_tactical_lab: 'ð§ª ææ¯å®éªå®¤ â éµå v11.2',
    tlab_title: 'ð§ª ææ¯å®éªå®¤',
    tlab_sub: 'éµå / æºå¨ v11.2 â å®æ¶æ¨¡æ',
    tlab_close: 'â å³é­',
    ace_title: 'â ççæ¨¡å¼',
    ace_sub: 'ç´æ¥é©¾é©¶ â åæ§è¿½å°¾éå¤´',
    ace_close: 'â å³é­',
    we_active_title: 'â  è¿è¡ä¸­çä¸çäºä»¶',
    we_none_active: 'ææ æ´»è·äºä»¶',
    we_engage: 'â åæ',
    btn_refresh: 'å·æ°',
    refresh_short: 'â»',
    guild_alliance_title: 'ð¤ èçï¼æå¤3ä¸ªå¬ä¼ï¼',
    war_declare_subtitle: 'éæ©è¦å®£æçå¬ä¼',
    war_declare_title: 'å®£æ',
    war_stake_label: 'â¡ èµæ³¨ï¼å¯éï¼: ä»éåºæå¥GP â èèéå',
    war_declare_cost_label: 'å®£æè´¹ç¨', war_treasury_label: 'å¬ä¼è´¢åº',
    war_search_placeholder: 'ð ç­é: å¬ä¼åææ ç­¾', war_search_hint: 'è¯·è¾å¥2ä¸ªä»¥ä¸å­ç¬¦',
    bd_search_hint: 'è¯·è¾å¥2ä¸ªä»¥ä¸å­ç¬¦', battle_attack_start: 'å¼å§æ»å»',
    reward_battle_title: 'ð ææå¥å±', btn_confirm: 'ç¡®è®¤', btn_cancel: 'åæ¶',
    tn_tab_open: 'æåä¸­', tn_tab_running: 'è¿è¡ä¸­', tn_tab_completed: 'å·²å®æ',
    rp_tab_featured: 'æ¨è', rp_tab_mine: 'æçåäº«',
    bd_my_fleet_label: 'æçè°é (æ»å»æ¹)', bd_recommended_label: 'æ¨èå¯¹æ (ç¸è¿å®å)', bd_search_label: 'æç´¢å¯¹æ', bd_search_input_placeholder: 'æµç§°æè°éå (2å­ä»¥ä¸)...',
    ca_subtitle: '// æåææ¯æä»¤ (æå¤ <span id="caMaxSel">2</span>)', ca_doctrines_label: 'ð DOCTRINE PRESETS â ä¸é®ææ¯é¢è®¾ (æ¨è)', ca_sniper_actions: 'focus_fire (èç1 GP)',
    ca_focus_desc: 'éä¸­æ»å»æå®æè°é â <b style="color:#ffd54f">+15% ä¼¤å®³</b>', ca_emp_desc: 'æå®tickè§¦åEMP â ææ¹å°é <b style="color:#ffd54f">Ã5åé</b> æç»­30tick', ca_wedge_desc: 'å¼ºå¶çªå»ææ¯ â éåº¦/æ»å» â, é²å¾¡ â', ca_reinforce_desc: 'å¼å§æ¶æå¥é¢å¤è°è¹ (1~20è)',
    ca_focus_target_label: 'ç®æ æè°é', ca_focus_auto_hint: 'å®£æå¯¹æè°éèªå¨æå®', ca_emp_tick_label: 'EMPè§¦åtick (0~8000, é»è®¤1200 â 4å)', ca_emp_tick_hint: '1 tick = 200ms, æç»­ 30 tick', ca_wedge_hint: 'æ åæ° â åºç¨äºæææè°é', ca_reinforce_label: 'å¢æ´è°è¹', ca_reinforce_hint: 'æå¤20è â è°è¹ä»£ç  Ã æ°é',
    ca_quota: 'å·²é <b id="caSelectedN">0</b> / <span id="caMaxSel2">2</span>', ca_skip_btn: 'è·³è¿å¹¶å¼å§ææ', ca_apply_btn: 'åºç¨æä»¤ & ææ',
    ai_practice_desc: 'ä¸åé¾åº¦AIè°éè¿è¡ç»ä¹ ææãå¥å±ä¸ºæ®éææç50%ã', tn_create_btn: 'ä¸¾åé¦æ èµ',
    bh_title_kr: 'è°éæ', bh_tab_recent: 'æè¿', bh_tab_history: 'æçè®°å½', bh_declare_btn: 'å®£æ', bd_subtitle: '// å¯»æ¾å¯¹æ',
    war_duration_label: 'â± æç»­ï¼æ¶ï¼: é»è®¤72å°æ¶',
    war_declare_btn: 'âï¸ å®£æ',
    war_declaring_btn: 'å®£æä¸­...',
    war_treasury_low: 'éåºGPä¸è¶³ï¼éè¦{need}ï¼æ¥æ{have}ï¼',
    codex_subtitle: 'å®æ¹æ¸¸ææå',
    loading: 'å è½½ä¸­â¦',
    campaign_profile_btn: 'ð ä¸ªäººèµæ', // [i18n backfill v7.172]
    campaign_btn_start: 'å¼å§', campaign_btn_continue: 'ç»§ç»­',
    campaign_btn_results: 'ç»æ', campaign_btn_locked: 'éå®',
    campaign_label_completed: 'å·²å®æ', campaign_label_prologue: 'åºç« ',
    campaign_label_route: 'è·¯çº¿', campaign_label_ch: 'CH',
    campaign_no_chapters: 'ææ å¯ç¨ç« èã',
    campaign_no_faction: 'è¯·åéæ©æ´¾ç³»ä»¥è§£éæå½¹ã',
    campaign_show_locked: 'æ¾ç¤ºéå®', campaign_hide_locked: 'éèéå®',
    campaign_meta_sim: 'æå¡å¨æ¨¡æ',
    campaign_reward_claimed: 'å¥å±å·²é¢å',
    campaign_objective_go: 'åå¾',
    campaign_result_success: 'ä»»å¡å®æ',
    campaign_result_failure: 'ä»»å¡å¤±è´¥',
    campaign_result_npc_success: 'ä½æç®æ å·²è¾¾æãè¿å¥ä¸ä¸é¶æ®µã',
    campaign_result_npc_failure: 'ä»»å¡å¤±è´¥ãç»æå·²è®°å½ã',
    campaign_result_reward: 'å¥å±:',
    campaign_result_confirm: 'ç¡®è®¤',
    campaign_result_recheck: 'éæ°ç¡®è®¤',
    campaign_objectives_gate: 'è¯·åå®æå©ä½ç®æ ã',
    campaign_objectives_gate_sub: 'è®¡æ¶å¨å·²ç»æï¼ä½æ¸¸ææ¡ä»¶å°æªæ»¡è¶³ã',
    campaign_sim_in_progress: 'ä½æè¿è¡ä¸­...',
    campaign_sim_radio_prefix: 'æ çº¿çµ:',
    campaign_sim_radio_default: 'ä½æç¶ææ´æ°ã',
    campaign_sim_syncing: 'åæ­¥ä½æç¶æä¸­...',
    campaign_sim_detail: 'å°æ ¹æ®æå¡å¨è¿åº¦å®æã',
    story_skip: 'è·³è¿',
    story_skip_title: 'è·³è³ä¸ä¸å¹',
    story_abandon: 'éåº',
    story_abandon_title: 'éåºå§æå¹¶æ¾å¼å½åç« èè¿åº¦',
    story_tap_hint: 'ç¹å»ç»§ç»­',
    story_abandon_confirm_title: 'éåºå§æ',
    story_abandon_confirm_body: 'æ¾å¼è¿è¡ä¸­çç« èå¹¶éåºå§æãå·²åçéæ©å°è¢«ä¿çã',
    btn_close: 'â å³é­',
    lo_tagline: 'å é¢ç«æé¢å<br>å»ºç«ä½ çå¸å½',
    lo_feat1: 'å¨ç«æå°å¾ä¸å®æ¶åç´ é¢åå é¢',
    lo_feat2: 'è°éæ Â· æ»åæ Â· 1:1 GPå³æ',
    lo_feat3: 'éè¿æ´¾ç³»åå¬ä¼å»ºç«èç',
    lo_feat4: 'éç¿ Â· åçº§ Â· å¸åº',
    lo_btn_start: 'ð ç«å³å¼å§',
    lo_btn_browse: 'åæµè§å°çä»ª',
    wb_tab_active: 'ð¥ æ´»è·äºä»¶', wb_tab_recent: 'ð æè¿ç»æ', wb_tab_mine: 'ð æçææ³¨',
    sy_sort_price_asc: 'ä»·æ ¼ç±ä½å°é«', sy_sort_price_desc: 'ä»·æ ¼ç±é«å°ä½',
    sy_sort_power_desc: 'åçº§æé«', sy_sort_newest_listed: 'ææ°ä¸æ¶',
    bv_share: 'åäº«',
    bv_my_victory: 'ð èå©ï¼', bv_my_defeat: 'ð å¤±è´¥',
    bv_atk_won: 'è¿æ»æ¹èå©', bv_def_won: 'é²å®æ¹èå©', bv_draw_result: 'å¹³å±',
    bv_stat_total_ships: 'æ»è°è¹', bv_stat_losses: 'æå¤±', bv_stat_damage: 'ä¼¤å®³',
    bv_my_badge: 'æ',
    fleet_no_fleet_hint: 'æ è°é â å¨é è¹åå»ºé è°è¹',
    fleet_no_ships_hint: 'æ è°è¹<br>å¨é è¹åå»ºé ',
    fleet_no_combat_fleet: 'æ²¡æå¯ææçè°éãè¯·å¨é è¹åå»ºé è°è¹ï¼',
    fleet_both_no_fleet: 'åæ¹é½æ²¡æå¯ææçè°éã',
    fleet_enemy_no_fleet: 'ææ¹å¬ä¼æ²¡æå¯ææçè°éã',
    ob_line1: '"2067å¹´ãå°çèµæºèå°½äºã"',
    ob_line2: '"ç«ææ¯æåçå¸æã"',
    ob_line3: '"ä»å¤©ä½ è¿åºäºå¼æèçç¬¬ä¸æ­¥ã"',
    ob_btn_land: 'ð ç»éç«æ', ob_btn_skip: 'è·³è¿',
    ob_step1_title: 'éæ©ä½ çå½è¿',
    ob_step1_sub: 'ä½ ä¼ä»¥ä½ç§æ¹å¼å¨ç«æçå­ï¼',
    ob_job_change_note: 'ä¹åå¯ä»¥æ´æ¹ï¼æ¯å¨1æ¬¡åè´¹ï¼',
    ob_step1_choose: 'è¯·éæ©èä¸',
    ob_step2_title: 'éæ©æ´¾ç³»',
    ob_step2_sub: 'å å¥ç«æä¸å¤§å¿åä¹ä¸',
    ob_step2_free_note: 'é¦æ¬¡éæ©åè´¹ Â· ä¹åæ´æ¹é500 GP',
    ob_step2_already: 'å·²éæ©æ´¾ç³»ã',
    ob_step2_continue: 'ç»§ç»­ â',
    ob_step2_loading: 'å è½½ä¸­...',
    ob_step2_load_fail: 'å è½½å¤±è´¥ â è¯·ç¹å»ç¨åéæ©',
    ob_step2_choose: 'è¯·éæ©æ´¾ç³»', ob_step2_skip: 'ç¨åéæ©',
    ob_confirm: 'ç¡®è®¤éæ©', ob_processing: 'å¤çä¸­...',
    ob_faction_error: 'æ´¾ç³»éæ©å¤±è´¥ï¼',
    ob_faction_success: 'ð¡ æ´¾ç³»éæ©å®æï¼',
    ob_step3_title: 'å é¢ä½ çç¬¬ä¸åé¢å',
    ob_step3_sub: 'ç¹å»å°å¾ä¸çç©ºç½åºåå³å¯å é¢',
    ob_step3_free: 'â¨ é¦åé¢ååè´¹',
    ob_step3_tip1: 'å³é­æ­¤é¢æ¿åå¯çå°å°çä»ª',
    ob_step3_tip2: 'ç¹å»ç«æä¸çç©ºç½åºåæå¼å é¢é¢æ¿',
    ob_step3_tip3: 'æä¸CONFIRMå³å¯ç¡®è®¤é¢å',
    ob_step3_got_it: 'ðºï¸ æç½äºï¼å¼å§ï¼',
    ob_step3_next: 'ä¸ä¸æ­¥',
    ob_step4_title: 'åå¤å°±ç»ªï¼', ob_step4_sub: 'æ¬¢è¿æ¥å°ç«æï¼å¼æè',
    ob_step4_mission_label: 'ä»æ¥é¦ä¸ªä»»å¡',
    ob_step4_mission_reward: 'å®æå¥å±ï¼+{gp} GP',
    ob_step4_start: 'ð å¼å§æ¢ç´¢ç«æï¼',
    ob_reward_pioneer: 'ð å¼æè',
    ob_reward_gp: '+{n} GP è·å¾ï¼', ob_reward_pp: '+{n} PP è·å¾ï¼',
    ob_reward_item: '{code} è·å¾ï¼', ob_reward_title: 'ç§°å·"{name}"è·å¾ï¼',
    ob_starter_ship: 'ð åå§è°è¹åæ¾ï¼{name} Ã 1',
    guild_donate_placeholder: 'è¾å¥æèµ GPæ°é', guild_donate_btn: 'æèµ ',
    auth_motto_placeholder: 'æ®æ°å°æ ¼è¨â¦', auth_status_placeholder: 'ç¶ææ¶æ¯â¦', auth_vtag_placeholder: 'æ ç­¾â¦',
    // ââ v6.08 Battle Report ââââââââââââââââââââââââââââââââââ
    bv_performance: 'è¡¨ç°', bv_rating: 'è¯çº§', bv_efficiency: 'æç',
    bv_highlights: 'ææäº®ç¹', bv_view_report: 'ð è¯¦ç»æ¥å', bv_my_stats: 'ð æçæç»©',
    bv_mvp: 'MVP', bv_flagship_ok: 'æè°ï¼å¹¸å­', bv_flagship_lost: 'æè°ï¼å»æ²',
    bv_report_loading: 'æ¥åå è½½ä¸­â¦', bv_report_error: 'æ¥åå è½½å¤±è´¥',
    bv_stat_survived: 'å¹¸å­', bv_stat_efficiency: 'æç',
    bvstat_w: 'è', bvstat_l: 'è´', bvstat_d: 'å¹³',
    bvstat_kd: 'K/D', bvstat_winrate: 'èç', bvstat_streak: 'æé¿è¿è',
    bvstat_best: 'æä½³è¯çº§', bvstat_title: 'æçææè®°å½',
    bvstat_total: 'æ»æææ°', bvstat_close: 'å³é­',
    // ââ v6.08 Daily OPS ââââââââââââââââââââââââââââââââââââââ
    daily_ops_title: 'â¡ æ¯æ¥ä»»å¡', daily_ops_subtitle: 'éç½®: UTC 00:00',
    daily_ops_no_missions: 'å®ææ¯æ¥ä»»å¡è·å¾GPå¥å±',
    daily_ops_claim: 'é¢å', daily_ops_claimed: 'å·²é¢å', daily_ops_completed: 'å·²å®æ',
    daily_ops_event_today: 'ä»æ¥æ´»å¨', daily_ops_loading: 'ä»»å¡å è½½ä¸­â¦',
    daily_ops_all_claimed: 'ä»æ¥ä»»å¡å¨é¨é¢åï¼æå¤©åæ¥å§ã',
    // ââ v6.08 Territory Identity âââââââââââââââââââââââââââââ
    territory_identity_title: 'é¢å°èº«ä»½', territory_fr: 'é¢å°è¯çº§',
    territory_nickname: 'åç§°', territory_bio: 'ç®ä»',
    territory_edit_identity: 'â ç¼è¾åç§°/ç®ä»', territory_save_identity: 'ä¿å­',
    territory_badge_pioneer: 'â å¼æè (7å¤©)', territory_badge_settler: 'ð  å®å±è (30å¤©)',
    territory_badge_veteran: 'ð èåµ (90å¤©)', territory_badge_fortress: 'ð¡ è¦å¡',
    territory_defense_wins: 'é²å¾¡èå©', territory_times_hijacked: 'è¢«è¢­å»æ¬¡æ°',
    territory_hold_days: 'ææå¤©æ°', territory_hold_bonus: 'éç¿å æ',
    territory_fr_tier_newcomer: 'æ°æ', territory_fr_tier_pioneer: 'å¼æè',
    territory_fr_tier_settler: 'å®å±è', territory_fr_tier_fortress: 'è¦å¡',
    territory_fr_tier_legend: 'ä¼ å¥',
    // ââ v6.08 Bounty Board ââââââââââââââââââââââââââââââââââââ
    bounty_title: 'ð° æ¬èµæ¿', bounty_post: 'åå¸æ¬èµ',
    bounty_post_target: 'ç®æ é±å', bounty_post_amount: 'GPå¥å±',
    bounty_post_reason: 'åå ï¼å¯éï¼', bounty_post_submit: 'åå¸æ¬èµ',
    bounty_no_bounties: 'ææ æ´»å¨æ¬èµ',
    bounty_reward: 'å¥å±', bounty_expires: 'å°æ',
    bounty_on_me: 'éå¯¹æçæ¬èµ', bounty_claim_hint: 'å»è´¥ç®æ å³å¯é¢å',
    bounty_cancel: 'åæ¶ & éæ¬¾',
    // ââ v6.08 PvP Matchmaking âââââââââââââââââââââââââââââââââ
    pvp_rec_title: 'ð¯ æ¨èå¯¹æ',
    pvp_rec_cpi: 'CPI', pvp_rec_ships: 'è°è¹', pvp_rec_wins: 'èå©',
    pvp_rec_challenge: 'ææ', pvp_rec_loading: 'æç´¢å¯¹æä¸­â¦',
    pvp_rec_no_opponents: 'æªæ¾å°åéå¯¹æ', pvp_rec_cpi_diff: 'æåå·®è·',
    // ââ Missing keys (added) ââ
    base_tab_items: 'æçç©å', shop_cat_material: 'â ææ',
    hijack_no_fleet_label: 'æ è°é â æ æ³å«å¤º',
    hijack_no_fleet_hint: 'è¯·åå¾ BASE â FLEET éé¡¹å¡ååå»ºè°é',
    hijack_fleet_loading: 'æ­£å¨å è½½è°éä¿¡æ¯...',
    fleet_battle_hub_btn: 'æå¼è°éæHUB',
    pvp_ai_practice: 'AIç»ä¹ ', pvp_tournament: 'é¦æ èµ', pvp_shipyard: 'é è¹å',
    inv_cat_all: 'å¨é¨', inv_cat_defense: 'é²å¾¡', inv_cat_attack: 'æ»å»',
    inv_cat_utility: 'å®ç¨', inv_cat_boost: 'å¢ç', inv_cat_cosmetic: 'å¤è§',
    my_territory_title: 'æçé¢å°', login_to_view_territory: 'ç»å½ä»¥æ¥çæ¨çé¢å°',
    bc_waiting: 'ç­å¾ä¸­', bc_atk_win: 'æ»å»èå©', bc_def_win: 'é²å¾¡èå©',
    bc_in_progress: 'è¿è¡ä¸­', bc_scheduled: 'å·²è®¡å',
    bc_type_duel: 'PvPå³æ', bc_type_siege: 'å´æ»', bc_type_hijack: 'å«å¤º',
    bc_type_raid: 'çªè¢­', bc_type_event: 'æ´»å¨',
    gw_auto_win_title: 'èªå¨èå©', gw_auto_win_body: 'ææ¹å¬ä¼æ²¡æå¯ä½æçè°éã',
    gw_auto_win_pts: 'è·å¾èªå¨èå©å¹¶èµåå¬ä¼æç§¯å (+10 pts)',
    gw_auto_win_limit: 'æ¯24å°æ¶å¯ä½¿ç¨1æ¬¡', gw_auto_win_btn: 'ð è·åèªå¨èå©',
    gw_auto_win_toast: 'ð èªå¨èå©ï¼+{pts} pts å·²è·å¾',
    gw_auto_win_cooldown: '24å°æ¶åå·²ä½¿ç¨è¿èªå¨èå©',
    gw_enemy_has_fleets: 'ææ¹å·²æè°é â è¯·ç´æ¥ææ',
    siege_info_block: '<b style="color:var(--red);font-size:10px">âï¸ ä»ä¹æ¯æåºå´æ»ï¼</b><br>éè¿æäºå¤ºåæåºæå¤§é¢åææèï¼çé¿ï¼çä½ç½®ã<br><b style="color:var(--tx2)">â  éæ©æåº</b> â <b style="color:var(--tx2)">â¡ å®£å¸å´æ» (GPè´¹ç¨)</b> â <b style="color:var(--tx2)">â¢ è­¦åæ</b> â <b style="color:var(--tx2)">â£ æææ</b><br>å é¢çæé«çä¸æ¹æä¸ºçé¿ã<br><span style="color:var(--gold)">ð¡ å¥åºè¦æ±: å¿é¡»å¨ç®æ æåºæ¥æé¢å°</span>',
    fleet_battle_info_block: '<b style="color:var(--cyan);font-size:10px">â ä»ä¹æ¯è°éæï¼</b><br>çé¢è°éåå¶ä»ç©å®¶å®£æPvPææã<br><b style="color:var(--tx2)">â  å¨é è¹åå»ºé è°è¹</b> â <b style="color:var(--tx2)">â¡ ç»å»ºè°é</b> â <b style="color:var(--tx2)">â¢ å¨æææ¢çº½å®£æ</b> â <b style="color:var(--tx2)">â£ æ¥çç»æ</b>',
    mt_rename: 'âï¸ éå½å', mt_decorate: 'â¨ è£é¥°', mt_sell: 'ð° åºå®', mt_shield: 'ð¡ï¸ æ¤ç¾', mt_upgrade: 'ð§ åçº§', mt_hijack: 'â HIJACK é¢å°',
    br_hint: 'Claudeä¼è¯»åå¹¶ä¿®å¤', br_label_desc: 'éè¯¯æè¿° *', br_desc_placeholder: 'è¯·æè¿°éè¯¯åå®¹ã\nä¾)ææåæªåæ¾GPãç»é¢åç½',
    br_label_ss: 'æªå¾ (å¯é)', br_ss_placeholder: 'ð¸ ç¹å»æç²è´´æªå¾ (Cmd+V / Ctrl+V)', br_ss_drag: 'æå°æä»¶ææ¾è³æ­¤', br_capturing: 'æªå¾ä¸­...', br_submit: 'æäº¤', br_clear_ss: 'æ¸é¤æªå¾',
    ops_board_title: 'ð ä»æ¥ä½ææ¿', ops_legend_done: 'ð¢ å®æ', ops_legend_pending: 'âª æªå®æ', ops_legend_urgent: 'ð´ ç´§æ¥',
    pvp_rewards_btn: 'ð å¥å±è®°å½', // [i18n backfill v7.172]
    pvp_declare_btn: 'â å®£æ', pvp_tab_rec: 'ð¯ æ¨èå¯¹æ', pvp_tab_bounty: 'ð° èµé', pvp_tab_conflict: 'ð¥ åºåå²çª',
    kb_hub_title: 'å»ææ¦ & ææ¥', kb_tab_board: 'å»ææ¦', kb_tab_scout: 'ä¾¦å¯',
    betrayer_mark_title: 'åå¾çå°', betrayer_mark_desc: 'ä½ èº«è´åå¾çå°ãæ¯ä»GPä»¥æ¢å¤å£°èªã', betrayer_redeem_btn: 'èµç½ª',
    wb_title: 'ð¯ WAR BETTING Â· æäºä¸æ³¨', forge_upgrading: 'ð¨ å¼ºåä¸­...',
    we_select_fleet: 'éæ©è°é...', we_fleet_min: 'è³å°éè¦1èè°è¹',
    pvp_goto_tab: 'â PVPæ ç­¾ â', pvp_from_tab: 'â å¨PVPæ ç­¾ â',
    guild_gp_donate_lbl: 'ð° GPæèµ ', prof_customize_title: 'âï¸ ç¼è¾ä¸ªäººèµæ',
    vip_pass_title: 'ð« ä»ä¹æ¯VIPéè¡è¯ï¼',
    vip_pass_desc: 'ä½¿ç¨PPï¼æçç§¯åï¼è´­ä¹°ç<b style="color:#ce93d8">éæ¶é«çº§è®¢é</b>ã<br>â¢ â <b>éç¿éåº¦ +%</b>ï¼æç­çº§ä¸åï¼<br>â¢ ð° <b>GPè·åéå æ</b><br>â¢ ð <b>æ¯æç®±å­åæ¾</b><br>â¢ ð <b>VIPä¸å±ç§°å·/å¤´å</b><br>PPå¯éè¿è´­ä¹°æèµå­£å¥å±è·å¾ã',
    crate_what_title: 'ð¦ ä»ä¹æ¯ç®±å­ï¼',
    crate_what_desc: 'ä½¿ç¨GPæPPè´­ä¹°ç<b style="color:#ffcc02">éæºç©åç®±</b>ã<br>â¢ ð¯ <b>é²å¾¡éå·</b> â é¢å°å¼ºåÂ·é²å¾¡è£ç½®<br>â¢ â <b>ææéå·</b> â è°è¹å¼ºåÂ·æ»å»å¢ç<br>â¢ ð <b>å¤è§</b> â ç§°å·Â·å¤´åÂ·é¢å°æ¡æ¶<br>â¢ â¨ <b>ç¨æéå·</b> â ä½æ¦çç²¾è±ç­çº§<br>å¼å¯çéå·å¯å¨ç©åæ æ¥çå¹¶å¨å¸åºåºå®ã',
    prestige_what_title: 'â­ ä»ä¹æ¯å¨æï¼',
    prestige_what_desc: 'æ¶èGPç§¯ç´¯<b style="color:#ffd54f">æ°¸ä¹æååæ°</b>çç³»ç»ã<br>â¢ ðª¨ Colonist â ð¥ Pioneer â ð¥ Commander â ð¥ Vanguard â ð Sovereign<br>â¢ ç­çº§è¶é«<b>æè¡æ¦æååº¦è¶é«</b>ï¼ä¸å±ç§°å·Â·æ¡æ¶<br>â¢ å¨æç§¯å<b style="color:#ff8a80">æ°¸ä¹</b>ï¼ä¸ä¼ä¸é<br>â¢ é¢å°è®¤é¢ä¹å¯ä»¥åºç¨<b>å¨ææ¡æ¶</b>',
    /* === static markup i18n (added) === */
    ref_code_ph: '代码...',
    prod_section: '⚙ 生产',
    upgrades_section: '🔧 升级',
    edit_label: '✏ 编辑',
    campaign_quick: '战役',
    campaign_quick_sub: '剧情',
    select_your_fleet: '⚔ 选择舰队',
    change_image_btn: '更换图片',
    save_image_btn: '保存图片',
    current_balance: '当前余额',
    first_deposit_bonus: '首充奖励',
    select_chain: '选择链',
    deposit_address: '充值地址',
    copy_address: '📋 复制地址',
    available_usdt: '可用 USDT',
    withdraw_amount: '提现金额',
    max_btn: '最大',
    swap_pp_usdt_title: 'PP → USDT 兑换',
    swap_amount_pp: '兑换金额 (PP)',
    exchange_pp_gp_title: 'PP → GP 兑换',
    gp_balance: 'GP 余额',
    exchange_amount_pp: '兑换金额 (PP)',
    confirm_exchange: '确认兑换',
    mg_invaders: '入侵者',
    mg_invaders_sub: '射击求生',
    mg_runner: '跑酷者',
    mg_runner_sub: '奔跑闪避',
    mg_digger: '挖掘者',
    mg_digger_sub: '挖掘收集',
    close_btn: '关闭',
    game_over: '游戏结束',
    mg_continue: '继续',
    mg_submit_score: '提交分数',
    check_in_today: '今日签到',
    prof_motto: '格言',
    prof_set: '设置',
    prof_status: '💬 状态',
    prof_vanity_tag: '🏷️ 个性标签',
    prof_avatar_color: '头像颜色',
    tos_title: '服务条款',
    privacy_title: '隐私政策',
    cantina_disclaimer_title: '酒馆游戏免责声明',
    cantina_enter: '我已了解 — 进入酒馆',
    cookie_accept: '接受',
    footer_tos: '服务条款',
    footer_privacy: '隐私政策',
    faction_selection: '阵营选择',
    faction_select_sub: '// 选择你的阵营',
    faction_cancel: '取消',
    faction_select: '选择',
    edit_guild_title: '编辑公会',
    edit_guild_sub: '改名 · 自定义徽章 · 更新简介',
    ge_preview: '预览',
    ge_preview_hint: '像素徽章自动缩放为 32×32。PNG/JPG 不超过 2MB。',
    ge_guild_name: '公会名称',
    ge_description: '简介',
    ge_desc_ph: '公会口号 / 简介...',
    ge_emblem: '徽章',
    ge_emoji: '表情符号',
    ge_upload: '上传',
    ge_choose_image: '📁 选择图片 (自动 32×32)',
    ge_clear: '清除',
    ge_emblem_hint: '32×32 下粗轮廓效果最佳。建议使用透明 PNG 以获得清晰像素画。',
    ge_total_cost: '总费用',
    cancel_changes: '取消',
    save_changes: '保存更改',
    onboarding_first_landing: '首次登陆',
    onboarding_first_landing_body: '从占领你的第一块火星领地开始。',
    onboarding_open_base: '打开 BASE',
    onboarding_dismiss: '忽略',
    comms_label: '💬 通讯',
    settings_legal: '法律信息',
    acct_tos: '📜 服务条款',
    acct_privacy: '🔒 隐私政策',
    change_password_title: '修改密码',
    current_password_ph: '当前密码',
    new_password_ph: '新密码 (8位以上)',
    confirm_password_ph: '确认新密码',
    join_telegram: '✈ 加入 Telegram',
    agree_terms: '我同意<a onclick="openTosModal();event.stopPropagation()">服务条款</a>和<a onclick="openPrivacyModal();event.stopPropagation()">隐私政策</a>',
    remember_id_pw: '记住账号/密码',
    auto_login: '自动登录',
    select_image_file: '选择图片文件',
    scale_label: '缩放',
    min_btn: '最小',
    link_url_label: '链接 URL',
    link_url_ph: 'https://your-site.com',
    preview_on_mars: '在火星预览',
    stamp_cancel: '✕ 取消',
    drag_to_position: '拖动定位',
    stamp_ok: '✓ 确定',
    tos_body: '<h3>1. 关于 OCCUPY MARS</h3><p>Occupy Mars 是一款以虚拟火星为背景的网页版领土策略游戏。玩家可以占领土地、开采资源、与对手战斗并交易游戏内货币。本游戏按“现状(as is)”以娱乐为目的提供。</p><h3>2. PLANET POINTS (PP) &mdash; 游戏内货币</h3><p>Potato Points(PP)是 Occupy Mars 内使用的主要游戏内货币。PP <strong>不是</strong>真实货币、法定货币或加密货币。PP 在游戏之外没有固有的货币价值。</p><p>PP 可通过游戏(开采、任务、战斗)获得，或通过支持的支付方式购买。除适用法律要求外，所有 PP 购买均为最终交易且不可退款。</p><h3>3. USDT 提现</h3><p>在特定条件下，玩家可将 PP 兑换为 USDT 并申请提现。提现是否可用取决于:</p><ul><li>最低余额及验证要求</li><li>反欺诈与反洗钱(AML)检查</li><li>处理时间(可能有所不同)</li><li>从提现金额中扣除的网络手续费</li><li>游戏运营方出于安全或维护原因暂停提现的权利</li></ul><p>PP 与 USDT 之间的兑换比率由游戏决定，并可能恒不另行通知变更。</p><h3>4. 用户行为规范</h3><p>使用本服务即表示您同意不会:</p><ul><li>使用机器人、脚本或自动化工具</li><li>滥用漏洞或问题(请改为上报)</li><li>骚扰、威胁或冒充其他玩家</li><li>试图操纵游戏经济</li><li>创建多个账号以获取不公平优势</li><li>在官方渠道之外进行账号或游戏内资产的现金交易</li></ul><h3>5. 账号终止</h3><p>我们保留暂停或终止违反本条款的账号的权利，包括但不限于:</p><ul><li>作弊、使用机器人或滥用漏洞</li><li>欺诈性充值或拒付</li><li>对其他玩家或工作人员的虐待行为</li><li>违反任何适用法律</li></ul><p>被终止的账号可能丢失任何剩余的 PP 余额。除欺诈或安全威胁情况外，我们将合理努力在终止前通知您。</p><h3>6. 知识产权</h3><p>所有游戏内容、代码、美术、文本和设计均为 Occupy Mars 团队所有。玩家上传的图像仍归其创作者所有，但您授予我们在游戏内展示它们的许可。您不得复制、分发或逆向工程游戏的任何部分。</p><h3>7. 责任限制</h3><p>本游戏不提供任何形式的担保。我们不对以下情况负责:</p><ul><li>因漏洞、服务器问题或维护导致的游戏内货币或进度损失</li><li>区块链网络延迟或故障</li><li>对您账号的未授权访问(请使用强密码)</li><li>任何间接、附带或结果性损害</li></ul><p>我们的总责任不得超过您在任何索赔前 12 个月内向我们支付的金额。</p><h3>8. 条款变更</h3><p>我们可随时更新本条款。变更后继续使用游戏即视为接受。我们将通过游戏内公告通知用户重大变更。</p><h3>9. 管辖法律</h3><p>本条款受游戏运营方注册所在司法管辖区的法律管辖。争议应首先通过诚信协商解决。</p><h3>10. 联系方式</h3><p>如对本条款有疑问，请通过游戏内支持渠道或我们官方网站提供的邮箱联系我们。</p><div class="legal-update">最后更新: 2026年4月9日 &mdash; 版本 1.0</div>',
    privacy_body: '<h3>1. 我们收集的数据</h3><p>当您使用 Occupy Mars 时，我们可能收集:</p><ul><li><strong>账号信息:</strong> 邮箱地址、昵称、密码(哈希处理 &mdash; 我们从不存储明文)</li><li><strong>钱包地址:</strong> 您的托管型游戏钱包地址(注册时生成)</li><li><strong>游戏数据:</strong> 领土占领、战斗、交易、任务进度、游戏统计</li><li><strong>设备信息:</strong> 浏览器类型、屏幕尺寸、IP 地址(用于安全和限流)</li><li><strong>使用数据:</strong> 访问页面、使用功能、会话时长</li></ul><h3>2. 我们如何使用您的数据</h3><ul><li>提供和维护游戏服务</li><li>处理游戏内交易和提现</li><li>防止欺诈、作弊和滥用</li><li>改进游戏性能和功能</li><li>发送重要账号通知(安全警报、条款变更)</li><li>生成匿名化分析以改进游戏</li></ul><h3>3. 数据存储与安全</h3><p>您的数据存储在安全服务器上，静态和传输中均加密。密码使用 bcrypt 进行哈希处理。我们实施限流、输入验证和定期安全审计。但是，没有任何系统是 100% 安全的 &mdash; 请使用强大且唯一的密码。</p><h3>4. 第三方服务</h3><p>我们与以下类型的第三方服务集成:</p><ul><li><strong>区块链网络:</strong> 用于处理 USDT 充值和提现(交易数据在链上公开)</li><li><strong>邮件服务:</strong> 用于密码重置和账号通知</li><li><strong>CDN/主机:</strong> 用于交付游戏资源</li></ul><p>我们不会向第三方出售您的个人数据。</p><h3>5. 您的权利</h3><p>根据您所在的司法管辖区，您可能有权:</p><ul><li><strong>访问:</strong> 请求获取我们持有的您的个人数据副本</li><li><strong>更正:</strong> 更新不准确或不完整的数据</li><li><strong>删除:</strong> 请求删除您的账号及相关数据</li><li><strong>导出:</strong> 以可移植的格式接收您的数据</li><li><strong>反对:</strong> 反对对您数据的某些处理</li></ul><p>要行使这些权利，请通过游戏内支持渠道联系我们。我们将在 30 天内回复。</p><h3>6. Cookie 与本地存储</h3><p>我们使用浏览器 cookie 和 localStorage 用于:</p><ul><li>身份验证(保持登录状态)</li><li>记住您的偏好(语言、设置)</li><li>游戏状态缓存(以加快加载)</li></ul><p>我们不使用第三方跟踪 cookie。您可随时通过浏览器设置清除 cookie，但这可能会使您退出登录。</p><h3>7. 数据保留</h3><p>只要您的账号活跃，我们就会保留您的数据。如果您请求删除账号，我们将在30天内删除您的个人数据，但法律要求保留的情况除外(例如金融交易记录)。</p><h3>8. 未成年人</h3><p>Occupy Mars 不面向 18 岁以下的用户。我们不会有意收集未成年人的数据。如果您认为某位未成年人创建了账号，请联系我们。</p><h3>9. 本政策的变更</h3><p>我们可能不时更新本政策。我们将通过游戏内公告通知用户重大变更。变更后继续使用即视为接受。</p><h3>10. 联系方式</h3><p>如有隐私相关疑问或请求，请通过游戏内支持渠道或我们官方网站提供的邮箱联系我们。</p><div class="legal-update">最后更新: 2026年4月9日 &mdash; 版本 1.0</div>',
    cantina_disclaimer_body: '酒馆包含运气与技巧类游戏。<br><strong>您可能会损失 PP(Potato Points)。请理性游戏。</strong><br><br>游戏中花费的 PP 不会返还 &mdash; 胜利并无保证。<br>您必须年满 <strong>18 岁及以上</strong> 才能游玩。<br><br>如果您感觉自己可能出现赌博问题，<br>请暂停一下并寻求帮助。',
    cookie_banner_text: '我们使用 cookie 和 localStorage 进行身份验证、保存您的偏好并改善您的体验。',
  }
};

I18N.id = Object.assign({}, I18N.en, {
  login:'MASUK', logout:'KELUAR', email_login:'MASUK / DAFTAR EMAIL', my_wallet:'DOMPET SAYA',
  profile_language:'BAHASA', profile_prefs:'PREFERENSI', tut_howto:'CARA BERMAIN',
  my_assets_btn:'ASET SAYA', global_stats:'STATISTIK GLOBAL', leaderboard:'PAPAN PERINGKAT',
  search_owner:'CARI PEMILIK', territory_info:'INFO WILAYAH', my_alerts:'ALERT SAYA',
  live_feed:'LIVE FEED', claim_territory:'KLAIM WILAYAH', confirm_claim:'KONFIRMASI KLAIM',
  cancel:'BATAL', apply:'TERAPKAN', copy:'SALIN', click_mars:'KLIK MARS UNTUK PILIH WILAYAH',
  base_tab_territory:'WILAYAH SAYA', base_tab_sectors:'SEKTOR', base_tab_shop:'TOKO',
  base_tab_market:'MARKET', base_tab_items:'ITEM SAYA', base_tab_quests_full:'KAMPANYE/QUEST',
  base_tab_mining:'â RESOURCE RUN', base_tab_ops:'â OPS CONSOLE', bcat_territory:'Wilayah',
  bcat_fleet:'Armada', bcat_economy:'Ekonomi', bcat_mission:'Misi', bcat_community:'Komunitas',
  ops_board_title:'ð Papan Operasi Hari Ini', ops_legend_done:'ð¢ Selesai',
  ops_legend_pending:'âª Belum selesai', ops_legend_urgent:'ð´ Darurat',
  fcmd_open_shipyard_short:'Galangan', fcmd_my_fleets_short:'Armada Saya',
  fcmd_tactical_lab_short:'Lab Taktik', fcmd_ace_mode_short:'Mode ACE', fleet_status_label:'Status Armada',
  btn_refresh:'â» Muat ulang', shop_tab_inv:'ð¦ ITEM SAYA', shop_cat_material:'â MATERIAL',
  pvp_declare_btn:'â Nyatakan Perang', pvp_tab_rec:'ð¯ Lawan Rekomendasi',
  pvp_tab_bounty:'ð° Bounty', pvp_tab_conflict:'ð¥ Konflik Sektor',
  bug_report_label:'BUG', bug_report_title:'LAPORKAN BUG', bug_report_submit:'KIRIM LAPORAN'
});
I18N.vi = Object.assign({}, I18N.en, {
  login:'ÄÄNG NHáº¬P', logout:'ÄÄNG XUáº¤T', email_login:'ÄÄNG NHáº¬P / ÄÄNG KÃ EMAIL', my_wallet:'VÃ Cá»¦A TÃI',
  profile_language:'NGÃN NGá»®', profile_prefs:'TÃY CHá»N', tut_howto:'CÃCH CHÆ I',
  my_assets_btn:'TÃI Sáº¢N Cá»¦A TÃI', global_stats:'THá»NG KÃ TOÃN Cáº¦U', leaderboard:'Báº¢NG Xáº¾P Háº NG',
  search_owner:'TÃM CHá»¦ Sá» Há»®U', territory_info:'THÃNG TIN LÃNH THá»', my_alerts:'THÃNG BÃO Cá»¦A TÃI',
  live_feed:'DÃNG Sá»° KIá»N', claim_territory:'CHIáº¾M LÃNH THá»', confirm_claim:'XÃC NHáº¬N CHIáº¾M',
  cancel:'Há»¦Y', apply:'ÃP Dá»¤NG', copy:'SAO CHÃP', click_mars:'NHáº¤N VÃO MARS Äá» CHá»N LÃNH THá»',
  base_tab_territory:'LÃNH THá» Cá»¦A TÃI', base_tab_sectors:'KHU Vá»°C', base_tab_shop:'Cá»¬A HÃNG',
  base_tab_market:'CHá»¢', base_tab_items:'ITEM Cá»¦A TÃI', base_tab_quests_full:'CHIáº¾N Dá»CH/NHIá»M Vá»¤',
  base_tab_mining:'â RESOURCE RUN', base_tab_ops:'â OPS CONSOLE', bcat_territory:'LÃ£nh thá»',
  bcat_fleet:'Háº¡m Äá»i', bcat_economy:'Kinh táº¿', bcat_mission:'Nhiá»m vá»¥', bcat_community:'Cá»ng Äá»ng',
  ops_board_title:'ð Báº£ng TÃ¡c Chiáº¿n HÃ´m Nay', ops_legend_done:'ð¢ HoÃ n thÃ nh',
  ops_legend_pending:'âª ChÆ°a xong', ops_legend_urgent:'ð´ Kháº©n cáº¥p',
  fcmd_open_shipyard_short:'XÆ°á»ng tÃ u', fcmd_my_fleets_short:'Háº¡m Äá»i cá»§a tÃ´i',
  fcmd_tactical_lab_short:'PhÃ²ng chiáº¿n thuáº­t', fcmd_ace_mode_short:'Cháº¿ Äá» ACE', fleet_status_label:'Tráº¡ng thÃ¡i háº¡m Äá»i',
  btn_refresh:'â» LÃ m má»i', shop_tab_inv:'ð¦ ITEM Cá»¦A TÃI', shop_cat_material:'â Váº¬T LIá»U',
  pvp_declare_btn:'â TuyÃªn chiáº¿n', pvp_tab_rec:'ð¯ Äá»i thá»§ Äá» xuáº¥t',
  pvp_tab_bounty:'ð° Truy nÃ£', pvp_tab_conflict:'ð¥ Tranh cháº¥p khu vá»±c',
  bug_report_label:'BUG', bug_report_title:'BÃO Lá»I', bug_report_submit:'Gá»¬I BÃO CÃO'
});
I18N.th = Object.assign({}, I18N.en, {
  login:'à¹à¸à¹à¸²à¸ªà¸¹à¹à¸£à¸°à¸à¸', logout:'à¸­à¸­à¸à¸à¸²à¸à¸£à¸°à¸à¸', email_login:'à¹à¸à¹à¸²à¸ªà¸¹à¹à¸£à¸°à¸à¸ / à¸ªà¸¡à¸±à¸à¸£à¸à¹à¸§à¸¢à¸­à¸µà¹à¸¡à¸¥', my_wallet:'à¸à¸£à¸°à¹à¸à¹à¸²à¸à¸­à¸à¸à¸±à¸',
  profile_language:'à¸ à¸²à¸©à¸²', profile_prefs:'à¸à¸²à¸£à¸à¸±à¹à¸à¸à¹à¸²', tut_howto:'à¸§à¸´à¸à¸µà¹à¸¥à¹à¸',
  my_assets_btn:'à¸à¸£à¸±à¸à¸¢à¹à¸ªà¸´à¸à¸à¸­à¸à¸à¸±à¸', global_stats:'à¸ªà¸à¸´à¸à¸´à¸£à¸§à¸¡', leaderboard:'à¸­à¸±à¸à¸à¸±à¸',
  search_owner:'à¸à¹à¸à¸«à¸²à¹à¸à¹à¸²à¸à¸­à¸', territory_info:'à¸à¹à¸­à¸¡à¸¹à¸¥à¸­à¸²à¸à¸²à¹à¸à¸', my_alerts:'à¸à¸²à¸£à¹à¸à¹à¸à¹à¸à¸·à¸­à¸',
  live_feed:'à¸à¸µà¸à¸ªà¸', claim_territory:'à¸¢à¸¶à¸à¸­à¸²à¸à¸²à¹à¸à¸', confirm_claim:'à¸¢à¸·à¸à¸¢à¸±à¸à¸à¸²à¸£à¸¢à¸¶à¸',
  cancel:'à¸¢à¸à¹à¸¥à¸´à¸', apply:'à¹à¸à¹', copy:'à¸à¸±à¸à¸¥à¸­à¸', click_mars:'à¹à¸à¸°à¸à¸²à¸§à¸­à¸±à¸à¸à¸²à¸£à¹à¸à¸·à¹à¸­à¹à¸¥à¸·à¸­à¸à¸­à¸²à¸à¸²à¹à¸à¸',
  base_tab_territory:'à¸­à¸²à¸à¸²à¹à¸à¸à¸à¸­à¸à¸à¸±à¸', base_tab_sectors:'à¹à¸à¸à¹à¸à¸­à¸£à¹', base_tab_shop:'à¸£à¹à¸²à¸à¸à¹à¸²',
  base_tab_market:'à¸à¸¥à¸²à¸', base_tab_items:'à¹à¸­à¹à¸à¸¡à¸à¸­à¸à¸à¸±à¸', base_tab_quests_full:'à¹à¸à¸¡à¹à¸à¸/à¹à¸à¸§à¸ªà¸à¹',
  base_tab_mining:'â RESOURCE RUN', base_tab_ops:'â OPS CONSOLE', bcat_territory:'à¸­à¸²à¸à¸²à¹à¸à¸',
  bcat_fleet:'à¸à¸­à¸à¸¢à¸²à¸', bcat_economy:'à¹à¸¨à¸£à¸©à¸à¸à¸´à¸', bcat_mission:'à¸ à¸²à¸£à¸à¸´à¸', bcat_community:'à¸à¸¸à¸¡à¸à¸',
  ops_board_title:'ð à¸à¸£à¸°à¸à¸²à¸à¸à¸à¸´à¸à¸±à¸à¸´à¸à¸²à¸£à¸§à¸±à¸à¸à¸µà¹', ops_legend_done:'ð¢ à¹à¸ªà¸£à¹à¸à¹à¸¥à¹à¸§',
  ops_legend_pending:'âª à¸¢à¸±à¸à¹à¸¡à¹à¹à¸ªà¸£à¹à¸', ops_legend_urgent:'ð´ à¸à¹à¸§à¸',
  fcmd_open_shipyard_short:'à¸­à¸¹à¹à¸à¹à¸­à¹à¸£à¸·à¸­', fcmd_my_fleets_short:'à¸à¸­à¸à¸¢à¸²à¸à¸à¸­à¸à¸à¸±à¸',
  fcmd_tactical_lab_short:'à¸«à¹à¸­à¸à¹à¸¥à¹à¸à¸¢à¸¸à¸à¸à¸§à¸´à¸à¸µ', fcmd_ace_mode_short:'à¹à¸«à¸¡à¸ ACE', fleet_status_label:'à¸ªà¸à¸²à¸à¸°à¸à¸­à¸à¸¢à¸²à¸',
  btn_refresh:'â» à¸£à¸µà¹à¸à¸£à¸', shop_tab_inv:'ð¦ à¹à¸­à¹à¸à¸¡à¸à¸­à¸à¸à¸±à¸', shop_cat_material:'â à¸§à¸±à¸ªà¸à¸¸',
  pvp_declare_btn:'â à¸à¸£à¸°à¸à¸²à¸¨à¸ªà¸à¸à¸£à¸²à¸¡', pvp_tab_rec:'ð¯ à¸à¸¹à¹à¸à¹à¸­à¸ªà¸¹à¹à¹à¸à¸°à¸à¸³',
  pvp_tab_bounty:'ð° à¸à¹à¸²à¸«à¸±à¸§', pvp_tab_conflict:'ð¥ à¸à¸§à¸²à¸¡à¸à¸±à¸à¹à¸¢à¹à¸à¹à¸à¸à¹à¸à¸­à¸£à¹',
  bug_report_label:'BUG', bug_report_title:'à¸£à¸²à¸¢à¸à¸²à¸à¸à¸±à¹à¸', bug_report_submit:'à¸ªà¹à¸à¸£à¸²à¸¢à¸à¸²à¸'
});

function t(key){
  var lang = normalizeLang(LANG);
  return (I18N[lang]&&I18N[lang][key]) || I18N.en[key] || key;
}
function tl(en,ko,ja,zh,id,vi,th){
  var L = normalizeLang(LANG);
  var map = { en:en, ko:ko, ja:ja, zh:zh, id:id, vi:vi, th:th };
  var v = map[L];
  if (v != null) return v;
  // SEA(id/vi/th): 인라인 인자가 없으면 보조 사전(assets/i18n-sea.js)에서 en 기준 조회. 없으면 en 폴백.
  if ((L === 'id' || L === 'vi' || L === 'th') && typeof TL_SEA !== 'undefined' && TL_SEA[en] && TL_SEA[en][L] != null) {
    return TL_SEA[en][L];
  }
  return en;
}
