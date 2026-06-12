/**
 * server/db.js — 데이터베이스 연결 & 공통 유틸리티
 * ══════════════════════════════════════════════════════════════
 *
 * exports:
 *   pool                    — pg.Pool 인스턴스 (직접 query 사용 가능)
 *   initDB()                — 서버 시작 시 1회 호출, 마이그레이션 + 기본 테이블 생성
 *   getSetting(key, fallback) — settings 테이블에서 값 조회 (fallback=기본값)
 *   getPPToGPRate(client)     — settings.pp_to_gp_exchange_rate 조회 (기본 10)
 *   getSettings()           — settings 테이블 전체 반환 { key: value }
 *   ensureUser(client, wallet) — 지갑이 없으면 users 테이블에 자동 생성
 *   generateReferralCode()  — 유니크 추천인 코드 생성
 *   getReferralChain(client, wallet) — 추천인 체인 조회 (최대 3단계)
 *   creditReferralCommission(client, from, type, amount, currency)
 *                           — 추천인 수수료 분배 (services에서 COMMIT 전에 호출)
 *   awardXP(client, wallet, xp) — XP 부여 + 레벨업 처리
 *   logGPActivity(wallet, delta, source, note) — GP 증감 로그 기록 (fire-and-forget)
 *   notifyPlayer(wallet, type, message, meta)  — 인앱 알림 저장
 *   getActiveEvents()       — 현재 활성 이벤트 목록
 *   checkBreakthroughCondition(client, wallet, condition) — 업적 조건 체크
 *
 * 사용 패턴:
 *   const { pool, getSetting, logGPActivity } = require('../db');
 *   const val = await getSetting('my_key', 'default');
 *   logGPActivity(wallet, -cost, 'action', 'desc').catch(() => {});
 *
 * ══════════════════════════════════════════════════════════════
 */
const { Pool } = require('pg');
const { runMigrations } = require('./migrate');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// [v7.165] 모든 새 connection 에 일관된 TZ 강제. dailyOps 등 30+ 지점이 CURRENT_DATE 를 쓰는데
// 호스트 TZ 가 다르면(예: Railway UTC vs 로컬 KST) 일일 캡/스트릭/미션이 사용자 자정 boundary 에서
// 어긋나 더블 보상 우회 가능. 게임은 한국 운영이므로 KST(Asia/Seoul) 고정.
const DB_SESSION_TZ = process.env.DB_SESSION_TZ || 'Asia/Seoul';
pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${DB_SESSION_TZ}'`).catch((e) => {
    console.warn('[DB] SET TIME ZONE failed:', e.message);
  });
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ── Schema initialization ──
async function initDB() {
  // Run file-based migrations first
  try {
    await runMigrations();
  } catch (err) {
    console.error('[DB] Migration failed, falling back to inline schema:', err.message);
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address VARCHAR(42) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        nickname VARCHAR(50),
        usdt_balance DECIMAL(20,6) DEFAULT 0,
        pp_balance DECIMAL(20,6) DEFAULT 0,
        referred_by VARCHAR(42),
        referral_code VARCHAR(20) UNIQUE,
        withdrawal_nonce INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        pp_bonus DECIMAL(20,6) NOT NULL,
        chain VARCHAR(10) NOT NULL,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        block_number BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pixels (
        lat DECIMAL(8,2) NOT NULL,
        lng DECIMAL(8,2) NOT NULL,
        owner VARCHAR(42),
        price DECIMAL(20,6) DEFAULT 0.1,
        claim_id INT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lat, lng)
      );

      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(42) NOT NULL,
        center_lat DECIMAL(8,2) NOT NULL,
        center_lng DECIMAL(8,2) NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        image_url TEXT,
        original_image_url TEXT,
        link_url TEXT,
        total_paid DECIMAL(20,6) NOT NULL,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all')),
        from_wallet VARCHAR(42),
        to_wallet VARCHAR(42),
        usdt_amount DECIMAL(20,6) DEFAULT 0,
        pp_amount DECIMAL(20,6) DEFAULT 0,
        fee DECIMAL(20,6) DEFAULT 0,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Game settings (key-value config)
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Events (time-limited promotions)
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Game items (future-proof)
      CREATE TABLE IF NOT EXISTS game_items (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price_usdt DECIMAL(20,6) DEFAULT 0,
        price_pp DECIMAL(20,6) DEFAULT 0,
        config JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Admin audit log
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        target VARCHAR(255),
        details JSONB,
        admin_auth VARCHAR(20),
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Referral rewards log
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id SERIAL PRIMARY KEY,
        from_wallet VARCHAR(42) NOT NULL,
        to_wallet VARCHAR(42) NOT NULL,
        tier INT NOT NULL,
        pp_amount DECIMAL(20,6) NOT NULL,
        trigger_type VARCHAR(20) NOT NULL,
        trigger_tx_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      -- Email auth columns (safe to re-run)
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_nonce INTEGER DEFAULT 0;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS original_image_url TEXT;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_to ON referral_rewards(to_wallet);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_from ON referral_rewards(from_wallet);
      CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels(owner);
      CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner);
      CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_wallet);
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_events_active ON events(active, starts_at, ends_at);
      CREATE INDEX IF NOT EXISTS idx_game_items_category ON game_items(category, active);
    `);

    // Seed default settings if empty
    await seedDefaults(client);

    console.log('[DB] Schema initialized');
  } finally {
    client.release();
  }
}

// ── Seed default game settings ──
async function seedDefaults(client) {
  const defaults = [
    // ── Economy: Pixel pricing ──
    { key: 'pixel_base_price', value: 0.10, desc: 'Default base price per unclaimed pixel (USDT)', cat: 'economy' },
    { key: 'price_pixel_core', value: 0.15, desc: 'Core sector pixel price (USDT)', cat: 'economy' },
    { key: 'price_pixel_mid', value: 0.05, desc: 'Mid sector pixel price (USDT)', cat: 'economy' },
    { key: 'price_pixel_frontier', value: 0.02, desc: 'Frontier sector pixel price (USDT)', cat: 'economy' },
    { key: 'dynamic_price_enabled', value: true, desc: 'Enable dynamic pricing based on sector occupancy', cat: 'economy' },
    { key: 'dynamic_price_core_mult', value: 3, desc: 'Dynamic price tier multiplier for Core sectors', cat: 'economy' },
    { key: 'dynamic_price_mid_mult', value: 2, desc: 'Dynamic price tier multiplier for Mid sectors', cat: 'economy' },
    { key: 'dynamic_price_frontier_mult', value: 1, desc: 'Dynamic price tier multiplier for Frontier sectors', cat: 'economy' },

    // ── Economy: Hijack ──
    { key: 'hijack_multiplier', value: 1.2, desc: 'Price multiplier for hijacking owned pixels', cat: 'economy' },
    { key: 'hijack_owner_refund', value: 100, desc: 'Refund % of original price to hijacked owner', cat: 'economy' },
    { key: 'hijack_owner_bonus', value: 50, desc: 'Bonus % of premium to hijacked owner (rest → treasury)', cat: 'economy' },

    // ── Economy: Deposit / Swap / Withdraw ──
    { key: 'deposit_pp_bonus', value: 10, desc: 'PP bonus % on USDT deposit', cat: 'economy' },
    { key: 'swap_fee_percent', value: 5, desc: 'Fee % on PP→USDT swap', cat: 'economy' },
    // [v7.217 ECON-005] 0 → 2 — swap(5%) vs withdraw 비대칭으로 담보 무수수료 유출 차단. fee 는 담보 잔류.
    { key: 'withdraw_fee_percent', value: 2, desc: 'Fee % on USDT withdrawal (담보 유출 방지, 0~20). net=요청액*(1-fee%)만 체인 전송.', cat: 'economy' },
    // [v7.204 critical fix] 신규 가입 PP 보너스 100 → 0 (PP=USDT 1:1 이라 가입만으로 100불 mint = 운영 자살).
    //   온보딩은 가챠(데일리 무료) + 일일로그인 GP + 미션으로 진행 — PP 직접 지급은 제로.
    { key: 'signup_pp_bonus', value: 0, desc: 'PP gifted to new users on registration (0=disabled). KEEP AT 0 — PP=USDT.', cat: 'economy' },

    // ── Sector tax & distribution ──
    { key: 'sector_tax_rate', value: 2, desc: 'Sector transaction tax % on claim/hijack', cat: 'sector' },
    { key: 'tax_platform_share', value: 60, desc: '% of sector tax → platform treasury', cat: 'sector' },
    { key: 'tax_governor_share', value: 20, desc: '% of sector tax → sector governor', cat: 'sector' },
    { key: 'tax_citizen_share', value: 20, desc: '% of sector tax → active citizens pool (proportional)', cat: 'sector' },
    { key: 'governor_in_citizen_pool', value: false, desc: 'Include governor in citizen distribution pool', cat: 'sector' },
    { key: 'governor_min_pixels', value: 10, desc: 'Min pixels to qualify as governor candidate', cat: 'sector' },
    { key: 'governor_election_cycle_hours', value: 168, desc: 'Governor re-election cycle (hours, 168=weekly)', cat: 'sector' },
    { key: 'governor_tax_payout_cycle_hours', value: 168, desc: 'Tax payout cycle (hours)', cat: 'sector' },

    // ── Citizen conditions ──
    { key: 'citizen_min_pixels', value: 1, desc: 'Min pixels in sector to qualify as citizen', cat: 'sector' },
    { key: 'citizen_activity_window_days', value: 7, desc: 'Days of recent activity required for citizen status', cat: 'sector' },
    { key: 'citizen_min_actions_per_week', value: 3, desc: 'Min weekly actions for citizen status', cat: 'sector' },
    { key: 'citizen_snapshot_mode', value: 'average', desc: 'Distribution snapshot mode: average / random / fixed', cat: 'sector' },

    // ── Mining ──
    { key: 'mining_enabled', value: true, desc: 'Enable/disable mining system', cat: 'mining' },
    { key: 'mining_base_rate', value: 0.001, desc: 'Base PP per pixel per harvest cycle', cat: 'mining' },
    { key: 'mining_interval_hours', value: 4, desc: 'Hours between harvest cycles', cat: 'mining' },
    { key: 'mining_bonus_core', value: 1.5, desc: 'Mining multiplier for Core sectors', cat: 'mining' },
    { key: 'mining_bonus_mid', value: 1.2, desc: 'Mining multiplier for Mid sectors', cat: 'mining' },
    { key: 'mining_bonus_frontier', value: 1.0, desc: 'Mining multiplier for Frontier sectors', cat: 'mining' },
    { key: 'mining_governor_bonus', value: 1.2, desc: 'Extra mining multiplier for governor', cat: 'mining' },
    { key: 'mining_global_cap', value: 0, desc: 'Global daily PP mining cap (0=unlimited)', cat: 'mining' },
    { key: 'pp_daily_earn_cap_per_user', value: 0, desc: 'Per-user daily PP earn cap (0=unlimited)', cat: 'mining' },

    // ── Maintenance fee ──
    { key: 'maintenance_fee_enabled', value: true, desc: 'Enable weekly maintenance fee for large holders', cat: 'mining' },
    { key: 'maintenance_fee_threshold', value: 100, desc: 'Pixel count above which maintenance fee applies', cat: 'mining' },
    { key: 'maintenance_fee_rate', value: 0.5, desc: 'Weekly PP fee per pixel above threshold', cat: 'mining' },

    // ── Rank / XP ──
    { key: 'xp_per_claim', value: 2, desc: 'XP per pixel on new claim', cat: 'rank' },
    { key: 'xp_per_hijack', value: 3, desc: 'XP per pixel on hijack', cat: 'rank' },
    { key: 'xp_per_login', value: 5, desc: 'XP for daily login', cat: 'rank' },
    { key: 'xp_first_deposit', value: 50, desc: 'XP bonus for first deposit', cat: 'rank' },
    { key: 'xp_per_survival_day', value: 1, desc: 'XP per pixel per 7-day survival (unhijacked)', cat: 'rank' },
    { key: 'rank_max_level', value: 20, desc: 'Maximum rank level', cat: 'rank' },

    // ── Quest ──
    { key: 'quest_enabled', value: true, desc: 'Enable/disable quest system', cat: 'quest' },
    { key: 'quest_daily_reward_pp', value: 15, desc: 'Average PP reward for daily quests', cat: 'quest' },
    { key: 'quest_weekly_reward_pp', value: 75, desc: 'Average PP reward for weekly quests', cat: 'quest' },
    { key: 'quest_daily_reward_xp', value: 5, desc: 'XP reward for daily quests', cat: 'quest' },
    { key: 'quest_weekly_reward_xp', value: 30, desc: 'XP reward for weekly quests', cat: 'quest' },

    // ── Referral ──
    { key: 'referral_enabled', value: true, desc: 'Enable/disable referral system', cat: 'referral' },
    { key: 'referral_tier1_percent', value: 15, desc: 'Tier 1 referral commission % (direct upline)', cat: 'referral' },
    { key: 'referral_tier2_percent', value: 10, desc: 'Tier 2 referral commission % (grand-upline)', cat: 'referral' },
    { key: 'referral_tier3_percent', value: 5, desc: 'Tier 3 referral commission % (great-grand-upline)', cat: 'referral' },
    // Per-trigger commission rates (% of base amount applied BEFORE tier multipliers).
    // 0 = disabled. These let admin tune which money sources feed the referral tree.
    { key: 'referral_deposit_pct', value: 5, desc: 'Deposit USDT → upline % (0=off). Minted as PP bonus.', cat: 'referral' },
    { key: 'referral_swap_pct', value: 50, desc: 'Swap fee USDT → upline % of fee (0=off)', cat: 'referral' },
    { key: 'referral_shop_pct', value: 8, desc: 'Shop spend → upline % (0=off)', cat: 'referral' },
    { key: 'referral_market_fee_pct', value: 100, desc: 'Marketplace referral base → upline % (0=off). Applied to marketplace_referral_commission_pct_of_fee slice.', cat: 'referral' },
    { key: 'referral_enhance_pct', value: 0, desc: 'Enhancement GP spend → upline % (0=off, disabled by default for operator EV safety)', cat: 'referral' },
    { key: 'referral_auction_buy_pct', value: 0, desc: 'Auction buy GP spend → upline % (0=off, disabled by default for operator EV safety)', cat: 'referral' },
    { key: 'referral_cantina_pct', value: 2, desc: 'Cantina house-edge base → upline % (0=off)', cat: 'referral' },
    { key: 'referral_harvest_pct', value: 0, desc: 'Mining PP harvest → upline % (0=off, disabled by default for operator EV safety)', cat: 'referral' },
    { key: 'referral_hijack_pct', value: 0, desc: 'Hijack premium → upline % (0=off, disabled by default for operator EV safety)', cat: 'referral' },
    { key: 'marketplace_referral_commission_pct_of_fee', value: 25, desc: 'Share of marketplace fee exposed as referral commission base %', cat: 'referral' },

    // ── Arena ──
    { key: 'arena_enabled', value: true, desc: 'Enable/disable arena', cat: 'arena' },
    { key: 'arena_house_edge', value: 5, desc: 'Arena betting house edge %', cat: 'arena' },
    { key: 'arena_sector_mode', value: false, desc: 'Sector-based arena races (future)', cat: 'arena' },

    // ── Limits ──
    { key: 'min_deposit', value: 1, desc: 'Minimum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_deposit', value: 100000, desc: 'Maximum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_claim_width', value: 500, desc: 'Maximum claim width in pixels', cat: 'limits' },
    { key: 'max_claim_height', value: 500, desc: 'Maximum claim height in pixels', cat: 'limits' },
    { key: 'withdraw_min_amount', value: 10, desc: 'Minimum withdrawal amount (USDT)', cat: 'limits' },
    { key: 'max_image_size_mb', value: 5, desc: 'Maximum image upload size (MB)', cat: 'limits' },
    { key: 'max_search_results', value: 50, desc: 'Max search results returned', cat: 'limits' },
    { key: 'claims_load_limit', value: 5000, desc: 'Max claims loaded on frontend init', cat: 'limits' },

    // ── PP economy controls ──
    { key: 'pp_withdrawal_min', value: 100, desc: 'Minimum PP for withdrawal conversion', cat: 'economy' },
    { key: 'pp_withdrawal_fee_rate', value: 5, desc: 'PP withdrawal conversion fee %', cat: 'economy' },

    // ── PP sink mechanisms ──
    { key: 'mining_daily_cap_per_user', value: 50, desc: 'Max PP per user per day from mining (0=unlimited)', cat: 'mining' },
    { key: 'cosmetic_equip_fee_pp', value: 2, desc: 'PP cost to equip cosmetics', cat: 'economy' },
    { key: 'exploration_fee_pp', value: 1, desc: 'PP cost per POI discovery', cat: 'economy' },
    { key: 'territory_rename_fee_pp', value: 5, desc: 'PP cost to set promo link', cat: 'economy' },

    // ── Display / System ──
    { key: 'announcement', value: '', desc: 'Global announcement banner text (empty=hidden)', cat: 'display' },
    { key: 'maintenance_mode', value: false, desc: 'Disable all transactions when true', cat: 'system' },
    { key: 'settings_cache_ttl_ms', value: 30000, desc: 'Settings cache refresh interval (ms)', cat: 'system' },
  ];

  for (const d of defaults) {
    await client.query(
      `INSERT INTO settings (key, value, description, category)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [d.key, JSON.stringify(d.value), d.desc, d.cat]
    );
  }
}

// ── Helper: ensure user exists ──
async function ensureUser(client, wallet) {
  await client.query(
    `INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING`,
    [wallet.toLowerCase()]
  );
}

// ── Helper: get all settings as flat object ──
async function getSettings() {
  const res = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  for (const row of res.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ── Helper: get single setting ──
async function getSetting(key, fallback) {
  // JSONB value를 안전하게 text로 추출 (#>> '{}' 연산자)
  // - JSONB string "200"  → "200" (따옴표 제거)
  // - JSONB number 200    → "200"
  // - JSONB boolean true  → "true"
  // - JSONB object/array  → JSON 문자열
  // - NULL value          → null (→ fallback)
  // parseFloat/parseInt/String 비교 모두 안전하게 동작
  try {
    const res = await pool.query(`SELECT value #>> '{}' AS v FROM settings WHERE key = $1`, [key]);
    if (!res.rows.length || res.rows[0].v === null) return fallback;
    return res.rows[0].v;
  } catch (_) {
    // value 컬럼이 text인 구버전 DB 대응
    try {
      const res2 = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
      return res2.rows.length ? res2.rows[0].value : fallback;
    } catch (__) { return fallback; }
  }
}

// ── Helper: PP-denominated rewards convert to GP at admin exchange rate ──
async function getPPToGPRate(client = pool) {
  // [경제v2 P2] 무료 PP 지급 제거: 기존 PP 보상액은 settings.pp_to_gp_exchange_rate 배 GP로 보존한다.
  try {
    const res = await client.query(`SELECT value #>> '{}' AS v FROM settings WHERE key = $1`, ['pp_to_gp_exchange_rate']);
    const rate = parseFloat(res.rows[0]?.v ?? '10');
    if (rate > 0 && isFinite(rate)) return rate;
  } catch (_) {
    try {
      const res2 = await client.query('SELECT value FROM settings WHERE key = $1', ['pp_to_gp_exchange_rate']);
      const rate2 = parseFloat(res2.rows[0]?.value ?? '10');
      if (rate2 > 0 && isFinite(rate2)) return rate2;
    } catch (__) {}
  }
  return 10;
}

// ── Helper: get active events ──
async function getActiveEvents() {
  const res = await pool.query(
    `SELECT * FROM events WHERE active = true AND starts_at <= NOW() AND ends_at > NOW() ORDER BY starts_at`
  );
  return res.rows;
}

// ── Helper: get referral chain (up to 3 tiers) ──
async function getReferralChain(client, wallet) {
  const chain = [];
  let current = wallet.toLowerCase();
  for (let tier = 1; tier <= 3; tier++) {
    const res = await client.query(
      'SELECT referred_by FROM users WHERE wallet_address = $1',
      [current]
    );
    if (!res.rows.length || !res.rows[0].referred_by) break;
    const referrer = res.rows[0].referred_by;
    // Prevent circular references
    if (chain.some(c => c.wallet === referrer) || referrer === wallet.toLowerCase()) break;
    chain.push({ wallet: referrer, tier });
    current = referrer;
  }
  return chain;
}

// ── Helper: credit referral commission to upline chain ──
// Called from money-flow events (deposit, swap, shop, cantina, harvest, hijack).
// triggerType: 'deposit'|'swap'|'shop'|'cantina'|'harvest'|'hijack'
// currency: 'pp'|'usdt' — which balance column to credit on uplines.
// baseAmount: the gross amount the action moved (e.g. deposit USDT, swap fee, bet PP).
// Returns the array of credited rewards (for logging/UI), [] if disabled or no chain.
async function creditReferralCommission(client, fromWallet, triggerType, baseAmount, currency) {
  if (!fromWallet || !baseAmount || baseAmount <= 0) return [];
  // (오염차단 v7.369) 내부 referral_rewards INSERT/UPDATE가 throw하면 PG가 트랜잭션 전체를
  // abort → 호출측(arena cantina/swap/harvest/shop) COMMIT 실패로 본 결제가 silent 롤백된다.
  // 내부 try/catch는 JS에러만 삼킬 뿐 aborted 상태를 못 푼다. SAVEPOINT로 격리(best-effort).
  let _refSp = false;
  try { await client.query('SAVEPOINT om_referral'); _refSp = true; } catch (_) { return []; }
  try {
    // Master switch
    const enabled = await getSetting('referral_enabled');
    if (enabled === false || enabled === 'false') return [];

    // Per-trigger rate (% of baseAmount sent to the referral tree, before tier split)
    // [v7.165] admin 오타로 >100 또는 음수가 들어와도 fee 초과/음수 분배 차단 — 0~100 clamp.
    const triggerKey = 'referral_' + triggerType + '_pct';
    const triggerPctRaw = await getSetting(triggerKey);
    const triggerPct = Math.max(0, Math.min(100, parseFloat(triggerPctRaw) || 0));
    if (triggerPct <= 0) return [];

    // Tier multipliers (% of the trigger pool that each tier gets)
    // [v7.165] 각 tier 도 0~100 clamp — 음수/초과로 pool 초과 분배 차단.
    const clamp01 = (v) => Math.max(0, Math.min(100, parseFloat(v) || 0));
    const t1 = clamp01(await getSetting('referral_tier1_percent') || '15');
    const t2 = clamp01(await getSetting('referral_tier2_percent') || '10');
    const t3 = clamp01(await getSetting('referral_tier3_percent') || '5');
    const tierPcts = [t1, t2, t3];

    const chain = await getReferralChain(client, fromWallet.toLowerCase());
    if (!chain.length) return [];

    // [v7.353] 추천 수수료 인플레 제거: PP→GP 교차통화 환산(발행) 폐지.
    //   이벤트/수수료와 "같은 통화"로 지급한다 — 이유:
    //   · 게임통화 수수료(swap PP, cantina PP house-edge, marketplace fee)는 대부분 sink라
    //     같은 통화 지급이 sink 상쇄 → net-zero(추가발행 없음). swap은 추가로 호출부에서
    //     quest pool 을 (fee - referral)로 줄여 명시적 carve.
    //   · USDT 이벤트(deposit/shop)는 호출부가 'pp'를 넘겨 PP 지급. 실입금 USDT 담보 유입에
    //     기반하고, referral PP는 redeemable_pp를 올리지 않아(비상환) USDT 페그/솔벤시 불변.
    //   · GP는 더 이상 비-GP 이벤트에서 발행되지 않음(게임 경제 디플레 유지).
    const requestedCur = (currency || 'pp').toLowerCase();
    const cur = requestedCur;
    const balCol = cur === 'usdt' ? 'usdt_balance' : cur === 'gp' ? 'gp_balance' : 'pp_balance';
    const commissionBase = baseAmount;
    const commissionPool = commissionBase * (triggerPct / 100);
    // [v7.190 fix] tier 합계가 100 초과해도 pool 초과 분배 차단 — 누적 trackingPool 로 cap.
    //   기존엔 각 tier 가 independently pool*(pct/100) → t1+t2+t3>100 시 pool 초과 mint.
    let poolRemaining = commissionPool;
    const credited = [];

    // Operator-safety: per-upline daily commission cap (anti-farming/anti-inflation).
    // 0 / unset = no cap (legacy behavior preserved). Configurable per-currency via admin
    // settings: referral_daily_cap_pp / referral_daily_cap_gp / referral_daily_cap_usdt.
    const capKey = cur === 'usdt' ? 'referral_daily_cap_usdt' : cur === 'gp' ? 'referral_daily_cap_gp' : 'referral_daily_cap_pp';
    const dailyCap = parseFloat(await getSetting(capKey)) || 0;
    const capSumCol = cur === 'gp' ? 'gp_amount' : 'pp_amount';

    for (const ref of chain) {
      const tierIdx = ref.tier - 1;
      const pct = tierPcts[tierIdx] || 0;
      if (pct <= 0) continue;
      let reward = Math.round(commissionPool * (pct / 100) * 1000000) / 1000000;
      if (reward <= 0) continue;
      // [v7.190 fix] pool 잔여분 cap — 누적 분배가 pool 초과하지 못하게.
      if (reward > poolRemaining) reward = Math.round(poolRemaining * 1000000) / 1000000;
      if (reward <= 0) break; // pool 소진

      // Clamp to the upline's remaining daily cap, if a cap is configured.
      if (dailyCap > 0) {
        let earnedToday = 0;
        try {
          const er = await client.query(
            `SELECT COALESCE(SUM(${capSumCol}), 0) AS s FROM referral_rewards
             WHERE LOWER(to_wallet) = LOWER($1) AND currency = $2 AND created_at >= date_trunc('day', NOW())`,
            [ref.wallet, cur]
          );
          earnedToday = parseFloat(er.rows[0]?.s || 0);
        } catch (_capErr) { earnedToday = 0; /* schema 미지원 시 캡 미적용(안전 degrade) */ }
        const remaining = dailyCap - earnedToday;
        if (remaining <= 0) continue;                 // 오늘 상한 도달 — 이 업라인 스킵
        if (reward > remaining) reward = Math.round(remaining * 1000000) / 1000000;
      }

      // Credit upline balance (correct column per currency)
      await client.query(
        `UPDATE users SET ${balCol} = ${balCol} + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [reward, ref.wallet]
      );

      // Log to referral_rewards — use gp_amount for GP, pp_amount for PP/USDT
      // Migration 099 adds gp_amount + currency columns
      try {
        if (cur === 'gp') {
          await client.query(
            `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, gp_amount, currency, trigger_type)
             VALUES ($1, $2, $3, 0, $4, 'gp', $5)`,
            [fromWallet.toLowerCase(), ref.wallet, ref.tier, reward, triggerType]
          );
        } else {
          await client.query(
            `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, gp_amount, currency, trigger_type)
             VALUES ($1, $2, $3, $4, 0, $5, $6)`,
            [fromWallet.toLowerCase(), ref.wallet, ref.tier, reward, cur, triggerType + (cur === 'usdt' ? '_usdt' : '')]
          );
        }
      } catch (_le) {
        // Fallback for pre-migration schema (no gp_amount column yet)
        try {
          await client.query(
            `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, trigger_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [fromWallet.toLowerCase(), ref.wallet, ref.tier, reward, triggerType + (cur !== 'pp' ? '_' + cur : '')]
          );
        } catch (_le2) {}
      }

      credited.push({ tier: ref.tier, wallet: ref.wallet, amount: reward, currency: cur });
      poolRemaining = Math.max(0, poolRemaining - reward); // [v7.190 fix] pool 잔여분 갱신
    }
    return credited;
  } catch (e) {
    console.warn('[REFERRAL] commission failed:', e.message);
    if (_refSp) { try { await client.query('ROLLBACK TO SAVEPOINT om_referral'); } catch (_) {} }
    return [];
  } finally {
    if (_refSp) { try { await client.query('RELEASE SAVEPOINT om_referral'); } catch (_) {} }
  }
}

// ── Helper: generate referral code ──
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Check breakthrough conditions ──
async function checkBreakthroughCondition(client, wallet, condition) {
  if (!condition) return true;
  const type = condition.type;

  if (type === 'pixels') {
    const r = await client.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner = $1', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'sectors') {
    const r = await client.query('SELECT COUNT(DISTINCT sector_id) AS cnt FROM pixels WHERE owner = $1', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'quests') {
    const r = await client.query("SELECT COUNT(*) AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'deposit') {
    const r = await client.query('SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE wallet_address = $1', [wallet]);
    return parseFloat(r.rows[0].total) >= condition.min;
  }
  if (type === 'play_days') {
    const r = await client.query('SELECT created_at FROM users WHERE wallet_address = $1', [wallet]);
    if (!r.rows.length) return false;
    const days = (Date.now() - new Date(r.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    return days >= condition.min;
  }
  if (type === 'hijacks') {
    const r = await client.query("SELECT COUNT(*) AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'games_played') {
    const r = await client.query(
      "SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt",
      [wallet]
    );
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'referrals') {
    const r = await client.query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'multi') {
    for (const sub of (condition.conditions || [])) {
      const ok = await checkBreakthroughCondition(client, wallet, sub);
      if (!ok) return false;
    }
    return true;
  }
  return true;
}

// ── Award XP and check rank-up (shared across routes) ──
async function awardXP(client, wallet, xpAmount) {
  if (!xpAmount || xpAmount <= 0) return null;
  // (오염차단 v7.369) awardXP는 users/rank_definitions/user_breakthroughs/
  // checkBreakthroughCondition 등 다수 테이블을 건드리고 레벨업 시 GP까지 지급한다.
  // 모든 호출처(14곳)가 money 트랜잭션(BEGIN..COMMIT) 안이라, 한 쿼리라도 throw하면
  // PG가 트랜잭션 전체를 abort → 호출측 COMMIT 실패로 본 작업(전투보상/건조/클레임/퀘스트
  // /채굴/아레나 등)이 silent 롤백된다. SAVEPOINT로 격리해 XP/레벨업은 best-effort 처리.
  let _xpSp = false;
  try {
    await client.query('SAVEPOINT om_award_xp');
    _xpSp = true;
    return await _awardXPInner(client, wallet, xpAmount);
  } catch (e) {
    if (_xpSp) { try { await client.query('ROLLBACK TO SAVEPOINT om_award_xp'); } catch (_) {} }
    console.error('[awardXP] isolated failure:', e.message);
    return null;
  } finally {
    if (_xpSp) { try { await client.query('RELEASE SAVEPOINT om_award_xp'); } catch (_) {} }
  }
}

async function _awardXPInner(client, wallet, xpAmount) {
  let effectiveXpAmount = xpAmount;
  try {
    await client.query('SAVEPOINT om_xp_amplifier');
    const ampRes = await client.query(
      `SELECT effect_value FROM user_active_effects
       WHERE LOWER(wallet) = LOWER($1)
         AND effect_type = 'xp_amplifier'
         AND active = true
         AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [wallet]
    );
    if (ampRes.rows.length > 0) {
      const mult = Math.max(1, parseFloat(ampRes.rows[0].effect_value) || 1);
      effectiveXpAmount = Math.max(1, Math.round(xpAmount * mult));
    }
    await client.query('RELEASE SAVEPOINT om_xp_amplifier');
  } catch (_ampErr) {
    try { await client.query('ROLLBACK TO SAVEPOINT om_xp_amplifier'); } catch (_) {}
    try { await client.query('RELEASE SAVEPOINT om_xp_amplifier'); } catch (_) {}
  }

  const res = await client.query(
    'UPDATE users SET xp = xp + $1, total_actions = total_actions + 1 WHERE LOWER(wallet_address) = LOWER($2) RETURNING xp, rank_level',
    [effectiveXpAmount, wallet]
  );
  if (!res.rows.length) return null;
  const { xp, rank_level } = res.rows[0];

  // Find highest achievable rank (considering breakthrough gates)
  const rankRes = await client.query(
    'SELECT level, name, reward_pp, breakthrough, breakthrough_condition FROM rank_definitions WHERE level > $1 AND required_xp <= $2 ORDER BY level ASC',
    [rank_level, xp]
  );

  let newLevel = rank_level;
  let newRankName = null;
  let totalRewardPp = 0;
  let blockedAt = null;

  for (const rank of rankRes.rows) {
    if (rank.breakthrough) {
      // Check if already unlocked
      const unlocked = await client.query(
        'SELECT 1 FROM user_breakthroughs WHERE wallet_address = $1 AND level = $2',
        [wallet, rank.level]
      );
      if (!unlocked.rows.length) {
        // Check if condition is met
        const cond = rank.breakthrough_condition;
        const met = await checkBreakthroughCondition(client, wallet, cond);
        if (met) {
          // Auto-unlock
          await client.query(
            'INSERT INTO user_breakthroughs (wallet_address, level) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [wallet, rank.level]
          );
        } else {
          // Blocked! Can't pass this gate
          blockedAt = { level: rank.level, condition: cond };
          break;
        }
      }
    }
    // This rank is reachable
    newLevel = rank.level;
    newRankName = rank.name;
    totalRewardPp += parseFloat(rank.reward_pp) || 0;
  }

  if (newLevel > rank_level) {
    await client.query('UPDATE users SET rank_level = $1 WHERE LOWER(wallet_address) = LOWER($2)', [newLevel, wallet]);
    if (totalRewardPp > 0) {
      const rewardGP = Math.round(totalRewardPp * await getPPToGPRate(client) * 1000000) / 1000000;
      // [경제v2 P2] 레벨업 reward_pp는 PP 발행 대신 가치 보존 GP로 지급.
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [rewardGP, wallet]);
    }
    // 🔔 레벨업 알림
    notifyPlayer(wallet, 'rank_up',
      `🎖 레벨 ${newLevel} 달성! ${newRankName ? '「' + newRankName + '」' : ''}${totalRewardPp > 0 ? ' +' + totalRewardPp + ' PP 상당 GP 보상 지급' : ''}`,
      { newLevel, name: newRankName, rewardPp: totalRewardPp }
    ).catch(() => {});
    return { newLevel, name: newRankName, rewardPp: totalRewardPp, blockedAt };
  }
  return blockedAt ? { blockedAt } : null;
}

// ── Helper: log a GP activity entry (fire-and-forget) ──
// delta > 0 = earned, delta < 0 = spent
async function logGPActivity(wallet, delta, source, note = '') {
  if (!wallet || !delta || delta === 0) return;
  try {
    const enabled = await getSetting('gp_log_enabled');
    if (enabled === false || enabled === 'false') return;
    await pool.query(
      'INSERT INTO gp_activity_log (wallet, delta, source, note) VALUES ($1,$2,$3,$4)',
      [wallet.toLowerCase(), delta, source, note || '']
    );
    // Periodic cleanup of old entries
    if (Math.random() < 0.02) { // ~2% of calls trigger cleanup
      const ttl = parseInt(await getSetting('gp_log_ttl_days') || '30');
      pool.query(`DELETE FROM gp_activity_log WHERE created_at < NOW() - INTERVAL '${ttl} days'`).catch(() => {});
    }
  } catch (e) { /* non-critical */ }
}

// ── Helper: send in-game notification to a player (fire-and-forget) ──
// type: 'battle_declared'|'battle_won'|'battle_lost'|'listing_sold'|'auction_outbid'|'auction_won'
async function notifyPlayer(wallet, type, message, metadata = {}) {
  if (!wallet || !type || !message) return;
  try {
    const enabled = await getSetting('notifications_enabled');
    if (enabled === false || enabled === 'false') return;

    const maxPerUser = parseInt(await getSetting('notifications_max_per_user') || '50');
    const ttlDays    = parseInt(await getSetting('notifications_ttl_days') || '14');

    await pool.query(
      `INSERT INTO player_notifications (wallet, type, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [wallet.toLowerCase(), type, message, JSON.stringify(metadata)]
    );

    // Prune old notifications for this user (keep newest maxPerUser)
    await pool.query(
      `DELETE FROM player_notifications
       WHERE wallet = $1 AND id NOT IN (
         SELECT id FROM player_notifications WHERE wallet = $1 ORDER BY created_at DESC LIMIT $2
       )`,
      [wallet.toLowerCase(), maxPerUser]
    );

    // Global cleanup of expired notifications
    await pool.query(
      `DELETE FROM player_notifications WHERE created_at < NOW() - INTERVAL '${ttlDays} days'`
    );
  } catch (e) {
    // Non-critical — never throw
    console.warn('[NOTIFY] failed:', e.message);
  }
}

module.exports = { pool, initDB, ensureUser, getSettings, getSetting, getPPToGPRate, getActiveEvents, getReferralChain, creditReferralCommission, generateReferralCode, awardXP, notifyPlayer, logGPActivity };
