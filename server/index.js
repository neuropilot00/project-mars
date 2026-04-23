// Load environment-specific .env file, fallback to .env
const _path = require('path');
const _envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: _path.join(__dirname, '..', _envFile) });
// Fallback: also load .env for any unset vars
require('dotenv').config({ path: _path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// ── Ensure logs directory exists ──
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── Production environment validation ──
if (process.env.NODE_ENV === 'production') {
  const fatal = [];

  // JWT_SECRET: required and must not contain weak patterns
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    fatal.push('JWT_SECRET is not set');
  } else if (/dev|test|change-me/i.test(jwtSecret)) {
    fatal.push('JWT_SECRET contains a weak default (dev/test/change-me)');
  }

  // ADMIN_SECRET: required and must not be the default
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    fatal.push('ADMIN_SECRET is not set');
  } else if (adminSecret === 'admin1234') {
    fatal.push('ADMIN_SECRET is set to the insecure default "admin1234"');
  }

  // DATABASE_URL: required
  if (!process.env.DATABASE_URL) {
    fatal.push('DATABASE_URL is not set');
  }

  // SIGNER_PRIVATE_KEY: warn but don't crash
  if (!process.env.SIGNER_PRIVATE_KEY) {
    console.warn('[SECURITY] SIGNER_PRIVATE_KEY is not set — on-chain signing will fail');
  }

  if (fatal.length) {
    console.error('[FATAL] Production environment validation failed:');
    fatal.forEach(msg => console.error(`  - ${msg}`));
    console.error('[FATAL] Fix the above issues and restart. Exiting.');
    process.exit(1);
  }
} else {
  // Development mode warnings
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || /dev-secret|change-me/i.test(jwtSecret)) {
    console.warn('[SECURITY] Using weak JWT_SECRET — set a strong secret before deploying!');
  }
}

const { pool, initDB } = require('./db');
const { init: initSigner } = require('./services/signer');
const { startListeners } = require('./services/chain');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const arenaRoutes = require('./routes/arena');
const governanceRoutes = require('./routes/governance');
const marketplaceRoutes = require('./routes/marketplace');
const jobRoutes = require('./routes/job');
const resourceRoutes = require('./routes/resource');
const onboardingRoutes = require('./routes/onboarding');
const sectorRoutes = require('./routes/sectors');
const siegeRoutes = require('./routes/siege');
const publicRoutes = require('./routes/public');
const bettingRoutes = require('./routes/betting');
const auctionRoutes = require('./routes/auction');
const shipRoutes    = require('./routes/ships');
const battleRoutes  = require('./routes/battle');
const lotteryRoutes  = require('./routes/lottery');
const stakingRoutes  = require('./routes/staking');
const gpBurnRoutes      = require('./routes/gpBurn');
const weeklyRoutes      = require('./routes/weeklyChallenges');
const dividendRoutes    = require('./routes/dividends');
const monumentRoutes    = require('./routes/monuments');
const upgradeRoutes     = require('./routes/claimUpgrades');
const bountyRoutes      = require('./routes/bounty');
const shieldRoutes      = require('./routes/shield');
const craftingRoutes    = require('./routes/crafting');
const duelRoutes        = require('./routes/duel');
const rentalRoutes      = require('./routes/rental');
const contestRoutes     = require('./routes/contest');
const allianceRoutes    = require('./routes/alliance');
const luckyBoxRoutes    = require('./routes/luckyBox');
const vipRoutes         = require('./routes/vip');
const expeditionRoutes  = require('./routes/expedition');
const brandingRoutes    = require('./routes/branding');
const spellRoutes       = require('./routes/spells');
const tournamentRoutes  = require('./routes/tournaments');
const broadcastRoutes   = require('./routes/broadcasts');
const profileRoutes     = require('./routes/profile');
const tiersRoutes       = require('./routes/tiers');
const raffleRoutes      = require('./routes/raffle');
const wagerRoutes       = require('./routes/wager');
const tevtRoutes        = require('./routes/tevt');
const prestigeRoutes    = require('./routes/prestige');
const beaconRoutes      = require('./routes/beacon');
const donationRoutes    = require('./routes/donation');
const pollsRoutes       = require('./routes/polls');
const statusRoutes      = require('./routes/status');
const tdescRoutes       = require('./routes/tdesc');
const capsuleRoutes     = require('./routes/capsule');
const sponsorRoutes     = require('./routes/sponsor');
const vtagRoutes        = require('./routes/vtag');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Railway, Cloudflare, etc.)
const PORT = process.env.PORT || 3000;

// ── Security Headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.trycloudflare.com https://*.railway.app https://*.infura.io https://*.alchemy.com wss://*; font-src 'self' data: https://fonts.gstatic.com;");
  next();
});

// ── Health Check (before rate limiting) ──
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    dbStatus = 'error';
  }
  const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100;
  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.json({
    status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    memory: memoryMB
  });
});

// ── Rate Limiting ──
const isDev = process.env.NODE_ENV !== 'production';
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests, please try again later.' }
});

app.use(globalLimiter);

// ── CORS ──
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
// In dev mode, also allow trycloudflare.com tunnels
if (isDev) allowedOrigins.push('https://*.trycloudflare.com');
// Always allow Railway domains
allowedOrigins.push('https://*.railway.app');
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    var allowed = allowedOrigins.some(function(ao) {
      if (ao.includes('*')) return origin.endsWith(ao.replace('https://*', ''));
      return ao === origin;
    });
    if (allowed) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret']
}));

// ── Middleware ──
app.use(express.json({ limit: '8mb' }));

// ── Request logging ──
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[${req.method}] ${req.path} → ${res.statusCode} (${ms}ms)`);
    });
  }
  next();
});

// ── API Routes ──
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// ⚠️ job/resource/onboarding/sector routes must come BEFORE apiRoutes to avoid /user/:wallet wildcard conflict
app.use('/api', jobRoutes);
app.use('/api', resourceRoutes);
app.use('/api', onboardingRoutes);
app.use('/api', sectorRoutes);
app.use('/api', siegeRoutes);
app.use('/api', publicRoutes);
app.use('/api', bettingRoutes);
app.use('/api', auctionRoutes);
app.use('/api', shipRoutes);
app.use('/api', battleRoutes);
app.use('/api', lotteryRoutes);
app.use('/api', stakingRoutes);
app.use('/api', gpBurnRoutes);
app.use('/api', weeklyRoutes);
app.use('/api', dividendRoutes);
app.use('/api', monumentRoutes);
app.use('/api', upgradeRoutes);
app.use('/api', bountyRoutes);
app.use('/api', shieldRoutes);
app.use('/api', craftingRoutes);
app.use('/api', duelRoutes);
app.use('/api', rentalRoutes);
app.use('/api', contestRoutes);
app.use('/api', allianceRoutes);
app.use('/api', luckyBoxRoutes);
app.use('/api', vipRoutes);
app.use('/api', expeditionRoutes);
app.use('/api', brandingRoutes);
app.use('/api', spellRoutes);
app.use('/api', tournamentRoutes);
app.use('/api', broadcastRoutes);
app.use('/api', profileRoutes);
app.use('/api', tiersRoutes);
app.use('/api', raffleRoutes);
app.use('/api', wagerRoutes);
app.use('/api', tevtRoutes);
app.use('/api', prestigeRoutes);
app.use('/api', beaconRoutes);
app.use('/api', donationRoutes);
app.use('/api', pollsRoutes);
app.use('/api', statusRoutes);
app.use('/api', tdescRoutes);
app.use('/api', capsuleRoutes);
app.use('/api', sponsorRoutes);
app.use('/api', vtagRoutes);
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin/api', adminRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// ── Public Leaderboard Page ──
app.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.wallet_address,
         u.nickname,
         COUNT(DISTINCT c.id) AS claim_count,
         COALESCE(SUM(c.width * c.height), 0) AS pixel_count
       FROM users u
       LEFT JOIN claims c ON c.owner = u.wallet_address AND c.deleted_at IS NULL
       GROUP BY u.wallet_address, u.nickname
       HAVING COUNT(DISTINCT c.id) > 0
       ORDER BY claim_count DESC
       LIMIT 50`
    );

    const rows = result.rows.map((r, i) => ({
      rank: i + 1,
      nickname: r.nickname || null,
      wallet: r.wallet_address.slice(0, 6) + '...' + r.wallet_address.slice(-4),
      claimCount: parseInt(r.claim_count),
      pixelCount: parseInt(r.pixel_count)
    }));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OCCUPY MARS - Leaderboard</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0D0B14;color:#E8DCC8;font-family:'Orbitron',monospace;min-height:100vh}
.container{max-width:720px;margin:0 auto;padding:20px 16px}
.header{text-align:center;padding:40px 0 30px}
.logo{font-size:32px;font-weight:900;color:#FF7840;letter-spacing:6px;text-shadow:0 0 30px rgba(255,120,60,.5)}
.subtitle{font-size:12px;color:#C8A882;letter-spacing:2px;margin-top:8px}
.play-btn{display:inline-block;margin-top:20px;padding:14px 40px;background:linear-gradient(135deg,#FF7840,#E84855);color:#fff;font-family:'Orbitron',monospace;font-size:13px;font-weight:700;letter-spacing:3px;border:none;border-radius:8px;cursor:pointer;text-decoration:none;transition:all .3s}
.play-btn:hover{transform:scale(1.05);box-shadow:0 0 30px rgba(255,120,60,.4)}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{font-size:10px;color:#6A5848;letter-spacing:1.5px;text-align:left;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
th:last-child,th:nth-child(3),th:nth-child(4){text-align:right}
td{font-size:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:#C8A882}
td:last-child,td:nth-child(3),td:nth-child(4){text-align:right}
tr:hover td{background:rgba(255,120,60,.04)}
.rank-num{font-weight:700;color:#FF7840;font-size:14px}
.rank-1{color:#FFD166;font-size:16px}
.rank-2{color:#C0C0C0;font-size:15px}
.rank-3{color:#CD7F32;font-size:15px}
.nickname{color:#E8DCC8;font-weight:700}
.wallet{color:#6A5848;font-size:10px}
.gold{color:#FFD166}
.mars{color:#FF7840}
.footer{text-align:center;padding:40px 0 20px;font-size:10px;color:#3A3020}
@media(max-width:480px){
  .logo{font-size:22px;letter-spacing:3px}
  th,td{padding:8px 6px;font-size:10px}
  .rank-num{font-size:12px}
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">OCCUPY MARS</div>
    <div class="subtitle">TOP 50 COLONIZERS</div>
    <a href="/" class="play-btn">PLAY NOW</a>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>COLONIZER</th><th>TERRITORIES</th><th>PIXELS</th></tr>
    </thead>
    <tbody>
${rows.map(r => {
  const rankClass = r.rank === 1 ? 'rank-1' : r.rank === 2 ? 'rank-2' : r.rank === 3 ? 'rank-3' : '';
  const medal = r.rank === 1 ? ' \uD83E\uDD47' : r.rank === 2 ? ' \uD83E\uDD48' : r.rank === 3 ? ' \uD83E\uDD49' : '';
  const name = r.nickname ? '<span class="nickname">' + r.nickname + '</span><br><span class="wallet">' + r.wallet + '</span>' : '<span class="wallet">' + r.wallet + '</span>';
  return '      <tr><td class="rank-num ' + rankClass + '">' + r.rank + medal + '</td><td>' + name + '</td><td class="mars">' + r.claimCount + '</td><td class="gold">' + r.pixelCount.toLocaleString() + '</td></tr>';
}).join('\n')}
    </tbody>
  </table>
  <div class="footer">OCCUPY MARS &mdash; Claim Your Territory on the Red Planet</div>
</div>
</body>
</html>`;
    res.type('html').send(html);
  } catch (e) {
    console.error('[LEADERBOARD] Error:', e.message);
    res.status(500).send('Leaderboard temporarily unavailable');
  }
});

// ── Static files (index.html, admin.html, assets) ──
// Cache headers per file type
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    // HTML: no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(req.path)) {
    // Images: 7 days + CORS for canvas access
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (/\.(js|css)$/i.test(req.path)) {
    // JS/CSS: 1 day
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  next();
});
app.use(express.static(path.join(__dirname, '..'), {
  index: 'index.html',
  extensions: ['html']
}));

// ── SPA fallback ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});
app.get('/arena', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'arena.html'));
});

// ── OG Share Card: /share/chronicle/:id ──
app.get('/share/chronicle/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).send('Invalid ID');
  try {
    const { pool: dbPool } = require('./db');
    const result = await dbPool.query(
      `SELECT sc.*, u.nickname AS actor_nickname
       FROM server_chronicles sc
       LEFT JOIN users u ON u.wallet_address = sc.actor_wallet
       WHERE sc.id = $1 AND sc.is_public = true`,
      [id]
    );
    if (!result.rows.length) return res.status(404).send('Chronicle not found');
    const c = result.rows[0];
    const title = c.title_en || c.event_type;
    const desc  = c.body_en  || `Occupy Mars chronicle event: ${c.event_type}`;
    const url   = `https://occupymars.io/share/chronicle/${id}`;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — Occupy Mars</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Occupy Mars">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta http-equiv="refresh" content="2;url=/">
  <style>
    body{margin:0;background:#0d1b2a;color:#eee;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;padding:20px;text-align:center}
    h1{color:#5bb8e8;font-size:1.4em;margin:0}
    p{color:#aaa;font-size:.9em;margin:0}
    a{color:#5bb8e8}
  </style>
</head>
<body>
  <div style="font-size:2em">📋</div>
  <h1>${title}</h1>
  <p>${desc}</p>
  <p style="margin-top:8px;font-size:.8em;color:#555">Redirecting to <a href="/">Occupy Mars</a>...</p>
</body>
</html>`);
  } catch (err) {
    console.error('[SHARE] chronicle error:', err.message);
    res.status(500).send('Error');
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  // Append to error log file
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url} | ${err.message}\n${err.stack || ''}\n---\n`;
  fs.appendFile(path.join(logsDir, 'error.log'), logEntry, (writeErr) => {
    if (writeErr) console.error('[Server] Failed to write error log:', writeErr.message);
  });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ──
async function start() {
  try {
    // Initialize database schema
    await initDB();

    // Run pending SQL migrations automatically
    try {
      const { runMigrations } = require('./migrate');
      await runMigrations();
    } catch (migErr) {
      console.error('[migrate] Auto-migration failed:', migErr.message);
      // Don't crash — existing tables still work
    }

    // Initialize withdrawal signer
    initSigner();

    // Start on-chain event listeners
    await startListeners();

    // ── Governance Scheduled Tasks ──
    try {
      const { expireGovernanceItems, applyDailyMaintenance, distributeCommanderPool } = require('./services/governance');
      // Expire buffs/events/bounties every 5 minutes
      setInterval(async () => {
        try { await expireGovernanceItems(); } catch(e) { console.warn('[GOV] expire task error:', e.message); }
      }, 5 * 60 * 1000);
      // Daily maintenance + pool distribution every 24 hours
      setInterval(async () => {
        try {
          await applyDailyMaintenance();
          await distributeCommanderPool();
          console.log('[GOV] Daily maintenance + pool distribution completed');
        } catch(e) { console.warn('[GOV] daily task error:', e.message); }
      }, 24 * 60 * 60 * 1000);
      console.log('[GOV] Scheduled tasks initialized (expire: 5min, maintenance: 24h)');
    } catch(e) { console.warn('[GOV] Could not init scheduled tasks:', e.message); }

    // ── Weather Scheduled Tasks ──
    try {
      const { spawnWeatherEvents, expireWeather } = require('./services/weather');
      // Expire weather every 5 minutes
      setInterval(async () => {
        try { await expireWeather(); } catch(e) { console.warn('[WEATHER] expire error:', e.message); }
      }, 5 * 60 * 1000);
      // Spawn weather events every 6 hours
      setInterval(async () => {
        try { await spawnWeatherEvents(); } catch(e) { console.warn('[WEATHER] spawn error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      // Initial spawn on startup (after 30s delay)
      setTimeout(async () => {
        try { await spawnWeatherEvents(); } catch(e) { console.warn('[WEATHER] initial spawn error:', e.message); }
      }, 30 * 1000);
      console.log('[WEATHER] Scheduled tasks initialized (expire: 5min, spawn: 6h)');
    } catch(e) { console.warn('[WEATHER] Could not init scheduled tasks:', e.message); }

    // ── Exploration Scheduled Tasks ──
    try {
      const { spawnPOIs, expirePOIs, updateStarlinkPasses, expireStarlinkPasses } = require('./services/exploration');
      // Expire POIs every 5 minutes
      setInterval(async () => {
        try { await expirePOIs(); await expireStarlinkPasses(); } catch(e) { console.warn('[EXPLORE] expire error:', e.message); }
      }, 5 * 60 * 1000);
      // Spawn POIs every 4 hours
      setInterval(async () => {
        try { await spawnPOIs(); } catch(e) { console.warn('[EXPLORE] spawn error:', e.message); }
      }, 4 * 60 * 60 * 1000);
      // Update starlink passes every 10 minutes
      setInterval(async () => {
        try { await updateStarlinkPasses(); } catch(e) { console.warn('[STARLINK] update error:', e.message); }
      }, 10 * 60 * 1000);
      // Initial spawn on startup (after 45s delay)
      setTimeout(async () => {
        try { await spawnPOIs(); await updateStarlinkPasses(); } catch(e) { console.warn('[EXPLORE] initial spawn error:', e.message); }
      }, 45 * 1000);
      console.log('[EXPLORE] Scheduled tasks initialized (expire: 5min, POI spawn: 4h, starlink: 10min)');
    } catch(e) { console.warn('[EXPLORE] Could not init scheduled tasks:', e.message); }

    // ── Missions Scheduler (resolves elapsed missions) ──
    try {
      const { tickMissions } = require('./services/missions');
      // Resolve due missions every 30 seconds
      setInterval(async () => {
        try { await tickMissions(); } catch(e) { console.warn('[MISSION] tick error:', e.message); }
      }, 30 * 1000);
      console.log('[MISSION] Scheduled tasks initialized (tick: 30s)');
    } catch(e) { console.warn('[MISSION] Could not init scheduled tasks:', e.message); }

    // ── Guild War Resolution ──
    try {
      const guildService = require('./services/guild');
      setInterval(async () => {
        try { await guildService.resolveExpiredWars(); } catch(e) { console.warn('[GUILD WAR] resolve error:', e.message); }
      }, 60 * 1000); // check every minute
      console.log('[GUILD WAR] War resolution timer initialized (60s)');
    } catch(e) { console.warn('[GUILD WAR] Could not init:', e.message); }

    // ── Maintenance Fee Scheduled Tasks ──
    try {
      const { processMaintenanceFees } = require('./services/maintenance');
      // Check daily if weekly maintenance fees are due
      setInterval(async () => {
        try { await processMaintenanceFees(); } catch(e) { console.warn('[MAINTENANCE] process error:', e.message); }
      }, 24 * 60 * 60 * 1000);
      // Initial check on startup (after 90s delay)
      setTimeout(async () => {
        try { await processMaintenanceFees(); } catch(e) { console.warn('[MAINTENANCE] initial check error:', e.message); }
      }, 90 * 1000);
      console.log('[MAINTENANCE] Scheduled tasks initialized (check: 24h, runs weekly)');
    } catch(e) { console.warn('[MAINTENANCE] Could not init scheduled tasks:', e.message); }

    // ── Rocket Scheduled Tasks ──
    try {
      const { autoScheduleRocket, processRocketLanding, processRocketCompletion } = require('./services/rocket');
      // Process landings + completions every minute
      setInterval(async () => {
        try { await processRocketLanding(); await processRocketCompletion(); } catch(e) { console.warn('[ROCKET] process error:', e.message); }
      }, 60 * 1000);
      // Auto-schedule every 12 hours
      setInterval(async () => {
        try { await autoScheduleRocket(); } catch(e) { console.warn('[ROCKET] schedule error:', e.message); }
      }, 12 * 60 * 60 * 1000);
      // Initial schedule on startup (after 60s delay)
      setTimeout(async () => {
        try { await autoScheduleRocket(); } catch(e) { console.warn('[ROCKET] initial schedule error:', e.message); }
      }, 60 * 1000);
      console.log('[ROCKET] Scheduled tasks initialized (process: 1min, auto-schedule: 12h)');
    } catch(e) { console.warn('[ROCKET] Could not init scheduled tasks:', e.message); }

    // ── Auto-Renewal Micro-Transaction Cron (every 5 minutes) ──
    try {
      setInterval(async () => {
        try {
          // Auto-renew expired shields
          const expiredShields = await pool.query(
            `SELECT ps.id, ps.claim_id, ps.owner, ps.shield_type, ps.auto_renew
             FROM pixel_shields ps
             WHERE ps.expires_at <= NOW() AND ps.auto_renew = true`
          );
          for (const shield of expiredShields.rows) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              // Get item info for the shield type
              const itemRes = await client.query('SELECT * FROM item_types WHERE code = $1 AND active = true', [shield.shield_type]);
              if (!itemRes.rows.length) { await client.query('ROLLBACK'); client.release(); continue; }
              const item = itemRes.rows[0];
              const cost = parseFloat(item.price_pp);

              // Check user balance
              const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [shield.owner]);
              const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);

              if (ppBal < cost) {
                // Insufficient PP — disable auto-renew
                await client.query('UPDATE pixel_shields SET auto_renew = false WHERE id = $1', [shield.id]);
                await client.query('COMMIT');
                console.log(`[AUTO-RENEW] Shield #${shield.id} — insufficient PP (${ppBal}/${cost}), auto-renew disabled`);
                client.release();
                continue;
              }

              // Deduct PP
              await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2', [cost, shield.owner]);

              // Delete old shield, create new
              await client.query('DELETE FROM pixel_shields WHERE id = $1', [shield.id]);
              const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
              const hp = item.effect_value;
              await client.query(
                'INSERT INTO pixel_shields (claim_id, owner, shield_type, hp, max_hp, expires_at, auto_renew) VALUES ($1,$2,$3,$4,$5,$6,true)',
                [shield.claim_id, shield.owner, shield.shield_type, hp, hp, expiresAt]
              );

              // Log transaction
              await client.query(
                `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
                 VALUES ('auto_renew', $1, $2, 0, $3)`,
                [shield.owner, cost, JSON.stringify({ itemCode: shield.shield_type, claimId: shield.claim_id, type: 'shield' })]
              );

              await client.query('COMMIT');
              console.log(`[AUTO-RENEW] Shield ${shield.shield_type} renewed for claim #${shield.claim_id} (${cost} PP)`);
            } catch (e) {
              await client.query('ROLLBACK');
              console.warn(`[AUTO-RENEW] Shield #${shield.id} renewal failed:`, e.message);
            } finally {
              client.release();
            }
          }

          // Auto-renew expired duration-based effects
          const expiredEffects = await pool.query(
            `SELECT uae.id, uae.wallet, uae.effect_type, uae.auto_renew, uae.source_item_code
             FROM user_active_effects uae
             WHERE uae.active = true AND uae.auto_renew = true
               AND uae.expires_at IS NOT NULL AND uae.expires_at <= NOW()`
          );
          for (const effect of expiredEffects.rows) {
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              const itemCode = effect.source_item_code || effect.effect_type;
              const itemRes = await client.query('SELECT * FROM item_types WHERE code = $1 AND active = true', [itemCode]);
              if (!itemRes.rows.length) {
                await client.query('UPDATE user_active_effects SET active = false, auto_renew = false WHERE id = $1', [effect.id]);
                await client.query('COMMIT'); client.release(); continue;
              }
              const item = itemRes.rows[0];
              const cost = parseFloat(item.price_pp);

              const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [effect.wallet]);
              const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);

              if (ppBal < cost) {
                await client.query('UPDATE user_active_effects SET active = false, auto_renew = false WHERE id = $1', [effect.id]);
                await client.query('COMMIT');
                console.log(`[AUTO-RENEW] Effect ${effect.effect_type} — insufficient PP (${ppBal}/${cost}), disabled`);
                client.release();
                continue;
              }

              // Deduct PP
              await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2', [cost, effect.wallet]);

              // Deactivate old, create new
              await client.query('UPDATE user_active_effects SET active = false WHERE id = $1', [effect.id]);
              const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
              await client.query(
                `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, auto_renew, source_item_code)
                 VALUES ($1, $2, $3, $4, true, $5)`,
                [effect.wallet, effect.effect_type, item.effect_value, expiresAt, itemCode]
              );

              await client.query(
                `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
                 VALUES ('auto_renew', $1, $2, 0, $3)`,
                [effect.wallet, cost, JSON.stringify({ itemCode, type: 'effect', effectType: effect.effect_type })]
              );

              await client.query('COMMIT');
              console.log(`[AUTO-RENEW] Effect ${effect.effect_type} renewed for ${effect.wallet} (${cost} PP)`);
            } catch (e) {
              await client.query('ROLLBACK');
              console.warn(`[AUTO-RENEW] Effect #${effect.id} renewal failed:`, e.message);
            } finally {
              client.release();
            }
          }
        } catch (e) { console.warn('[AUTO-RENEW] cron error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[AUTO-RENEW] Scheduled tasks initialized (check: 5min)');
    } catch(e) { console.warn('[AUTO-RENEW] Could not init scheduled tasks:', e.message); }

    // ── Season Auto-Rotation ──
    try {
      const { autoRotateSeason } = require('./services/season');
      // Check on startup (after 2 min delay to let DB settle)
      setTimeout(async () => {
        try { await autoRotateSeason(); } catch(e) { console.warn('[SEASON] startup rotation error:', e.message); }
      }, 120 * 1000);
      // Check every 1 hour
      setInterval(async () => {
        try { await autoRotateSeason(); } catch(e) { console.warn('[SEASON] rotation error:', e.message); }
      }, 60 * 60 * 1000);
      console.log('[SEASON] Auto-rotation scheduled (check: startup+2min, then 1h)');
    } catch(e) { console.warn('[SEASON] Could not init auto-rotation:', e.message); }

    // ── Weekly Job Change Count Reset (every Monday UTC 00:00) ──
    try {
      const { resetWeeklyJobChangeCounts } = require('./services/job');
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCDay() === 1 && now.getUTCHours() === 0) {
            await resetWeeklyJobChangeCounts();
            console.log('[JOB] Weekly job change counts reset');
          }
        } catch(e) { console.warn('[JOB] weekly reset error:', e.message); }
      }, 60 * 60 * 1000); // Check every hour
      console.log('[JOB] Weekly reset scheduler started (check: 1h)');
    } catch(e) { console.warn('[JOB] Could not init weekly reset scheduler:', e.message); }

    // ── Siege Auto-Resolve (every 5 minutes) ──
    try {
      const { resolveExpiredSieges } = require('./services/siege');
      setInterval(async () => {
        try {
          const n = await resolveExpiredSieges();
          if (n > 0) console.log(`[SIEGE] Auto-resolved ${n} expired siege(s)`);
        } catch(e) { console.warn('[SIEGE] auto-resolve error:', e.message); }
      }, 5 * 60 * 1000); // every 5 minutes
      console.log('[SIEGE] Auto-resolve scheduler started (5min interval)');
    } catch(e) { console.warn('[SIEGE] Could not init auto-resolve scheduler:', e.message); }

    // ── War Betting: Close Expired Events (every 5 minutes) ──
    try {
      const { closeExpiredEvents } = require('./services/betting');
      setInterval(async () => {
        try {
          const n = await closeExpiredEvents();
          if (n > 0) console.log(`[BETTING] Auto-closed ${n} expired betting event(s)`);
        } catch(e) { console.warn('[BETTING] closeExpired error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[BETTING] Close-expired-events scheduler started (5min interval)');
    } catch(e) { console.warn('[BETTING] Could not init close-expired scheduler:', e.message); }

    // ── Auction: Settle Expired Auctions (every 5 minutes) ──
    try {
      const { settleExpiredAuctions } = require('./services/auction');
      setInterval(async () => {
        try {
          const n = await settleExpiredAuctions();
          if (n > 0) console.log(`[AUCTION] Auto-settled ${n} expired auction(s)`);
        } catch(e) { console.warn('[AUCTION] settle error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[AUCTION] Auto-settle scheduler started (5min interval)');
    } catch(e) { console.warn('[AUCTION] Could not init auto-settle scheduler:', e.message); }

    // ── Battle Engine: Settle Expired Battles (every 30 seconds) ──
    try {
      const { settleExpiredBattles } = require('./services/battle');
      setInterval(async () => {
        try { await settleExpiredBattles(); } catch(e) { console.warn('[BATTLE] settle error:', e.message); }
      }, 30 * 1000);
      console.log('[BATTLE] Auto-settle scheduler started (30s interval)');
    } catch(e) { console.warn('[BATTLE] Could not init auto-settle scheduler:', e.message); }

    // ── Marketplace Listing Expiry ──
    try {
      const { expireListings } = require('./services/marketplace');
      setInterval(async () => {
        try { const n = await expireListings(); if (n > 0) console.log(`[MARKET] Expired ${n} listings`); } catch(e) { console.warn('[MARKET] expiry error:', e.message); }
      }, 5 * 60 * 1000); // every 5 minutes
      console.log('[MARKET] Listing expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[MARKET] Could not init expiry scheduler:', e.message); }

    // ── Daily Engagement Cleanup ──
    try {
      // Daily cleanup - remove old mission data
      setInterval(async () => {
        try {
          await pool.query("DELETE FROM daily_missions WHERE mission_date < CURRENT_DATE - INTERVAL '7 days'");
          await pool.query("DELETE FROM daily_logins WHERE login_date < CURRENT_DATE - INTERVAL '90 days'");
          console.log('[DAILY] Cleanup completed');
        } catch(e) { console.error('[DAILY] cleanup error:', e.message); }
      }, 24 * 60 * 60 * 1000);
      console.log('[DAILY] Scheduled tasks initialized (cleanup: 24h)');
    } catch(e) { console.warn('[DAILY] Could not init scheduled tasks:', e.message); }

    // ── Title: Governor Milestone Check (every 6 hours) ──
    try {
      const { checkGovernorTitleMilestones } = require('./services/title');
      setInterval(async () => {
        try { await checkGovernorTitleMilestones(); } catch(e) { console.warn('[TITLE] governor milestone error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      console.log('[TITLE] Governor milestone scheduler started (6h interval)');
    } catch(e) { console.warn('[TITLE] Could not init governor milestone scheduler:', e.message); }

    // ── Planet News: Clean old news (every 24 hours) ──
    try {
      const { cleanOldNews } = require('./services/news');
      setInterval(async () => {
        try { const n = await cleanOldNews(); if (n > 0) console.log(`[NEWS] Cleaned ${n} old items`); } catch(e) { console.warn('[NEWS] cleanup error:', e.message); }
      }, 24 * 60 * 60 * 1000);
      console.log('[NEWS] Cleanup scheduler started (24h interval)');
    } catch(e) { console.warn('[NEWS] Could not init cleanup scheduler:', e.message); }

    // ── Lottery: Draw expired rounds (every 1 minute) ──
    try {
      const { drawExpiredRounds } = require('./services/lottery');
      setInterval(async () => {
        try {
          const n = await drawExpiredRounds();
          if (n > 0) console.log(`[LOTTERY] Drew ${n} round(s)`);
        } catch(e) { console.warn('[LOTTERY] draw error:', e.message); }
      }, 60 * 1000);
      console.log('[LOTTERY] Draw scheduler started (1min interval)');
    } catch(e) { console.warn('[LOTTERY] Could not init draw scheduler:', e.message); }

    // ── GP Burn: Clean expired burn effects (every 10 minutes) ──
    try {
      const { cleanExpiredBurns } = require('./services/gpBurn');
      setInterval(async () => {
        try {
          const n = await cleanExpiredBurns();
          if (n > 0) console.log(`[BURN] Cleaned ${n} expired burn effect(s)`);
        } catch(e) { console.warn('[BURN] cleanup error:', e.message); }
      }, 10 * 60 * 1000);
      console.log('[BURN] Expired-burn cleanup scheduler started (10min interval)');
    } catch(e) { console.warn('[BURN] Could not init cleanup scheduler:', e.message); }

    // ── Staking: Mark matured stakes as ready (every 5 minutes) ──
    try {
      const { markReadyStakes } = require('./services/staking');
      setInterval(async () => {
        try {
          const rows = await markReadyStakes();
          if (rows.length > 0) console.log(`[STAKING] Marked ${rows.length} stake(s) as ready`);
        } catch(e) { console.warn('[STAKING] markReady error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[STAKING] Ready-check scheduler started (5min interval)');
    } catch(e) { console.warn('[STAKING] Could not init scheduler:', e.message); }

    // ── GP Dividends: Distribute last week's pool (every Monday, checked hourly) ──
    try {
      const { distributeLastWeek, ensureCurrentPool } = require('./services/dividends');
      // Ensure pool exists on startup
      setTimeout(async () => {
        try { await ensureCurrentPool(); } catch(e) { console.warn('[DIV] startup pool error:', e.message); }
      }, 30 * 1000);
      // Check every 6 hours; distribute if Monday
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCDay() === 1) { // Monday
            const n = await distributeLastWeek();
            if (n > 0) console.log(`[DIV] Distributed to ${n} stakers`);
          }
          await ensureCurrentPool();
        } catch(e) { console.warn('[DIV] hourly task error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      console.log('[DIV] Dividend scheduler started (6h check, distributes on Monday)');
    } catch(e) { console.warn('[DIV] Could not init dividend scheduler:', e.message); }

    // ── Weekly Challenges: Ensure instances + settle competitive (every 1 hour) ──
    try {
      const { ensureWeekInstances, settleCompetitiveChallenges } = require('./services/weeklyChallenges');
      // Ensure instances on startup
      setTimeout(async () => {
        try { await ensureWeekInstances(); } catch(e) { console.warn('[WEEKLY] startup ensure error:', e.message); }
      }, 30 * 1000);
      // Hourly: ensure instances for new week + settle last week's competitive
      setInterval(async () => {
        try {
          await ensureWeekInstances();
          await settleCompetitiveChallenges();
        } catch(e) { console.warn('[WEEKLY] hourly task error:', e.message); }
      }, 60 * 60 * 1000);
      console.log('[WEEKLY] Challenge scheduler started (hourly)');
    } catch(e) { console.warn('[WEEKLY] Could not init scheduler:', e.message); }

    // ── Chronicle: Weekly Report (every Monday UTC 00:00) ──
    try {
      const { sendWeeklyReport } = require('./services/chronicle');
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCDay() === 1 && now.getUTCHours() === 0) {
            await sendWeeklyReport();
            console.log('[CHRONICLE] Weekly report sent');
          }
        } catch(e) { console.warn('[CHRONICLE] weekly report error:', e.message); }
      }, 60 * 60 * 1000); // Check every hour
      console.log('[CHRONICLE] Weekly report scheduler started (check: 1h)');
    } catch(e) { console.warn('[CHRONICLE] Could not init weekly report scheduler:', e.message); }

    // ── Bounty: Expire stale bounties (every 1 hour) ──
    try {
      const { expireBounties } = require('./services/bounty');
      setInterval(async () => {
        try { await expireBounties(); } catch(e) { console.warn('[BOUNTY] expire error:', e.message); }
      }, 60 * 60 * 1000);
      console.log('[BOUNTY] Expiry scheduler started (1h interval)');
    } catch(e) { console.warn('[BOUNTY] Could not init expiry scheduler:', e.message); }

    // ── Shield: Expire expired shields (every 5 minutes) ──
    try {
      const { expireShields } = require('./services/shield');
      setInterval(async () => {
        try { await expireShields(); } catch(e) { console.warn('[SHIELD] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[SHIELD] Expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[SHIELD] Could not init expiry scheduler:', e.message); }

    // ── Contest: Advance statuses + auto-finalize (every 5 minutes) ──
    try {
      const { advanceContestStatuses } = require('./services/contest');
      setInterval(async () => {
        try { await advanceContestStatuses(); } catch(e) { console.warn('[CONTEST] advance error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[CONTEST] Status scheduler started (5min interval)');
    } catch(e) { console.warn('[CONTEST] Could not init scheduler:', e.message); }

    // ── Rental: Expire ended rentals (every 5 minutes) ──
    try {
      const { expireRentals } = require('./services/rental');
      setInterval(async () => {
        try { await expireRentals(); } catch(e) { console.warn('[RENTAL] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[RENTAL] Expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[RENTAL] Could not init expiry scheduler:', e.message); }

    // ── Duel: Expire pending duels (every 5 minutes) ──
    try {
      const { expireDuels } = require('./services/duel');
      setInterval(async () => {
        try { await expireDuels(); } catch(e) { console.warn('[DUEL] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[DUEL] Expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[DUEL] Could not init expiry scheduler:', e.message); }

    // ── Expedition: Resolve completed expeditions (every 2 minutes) ──
    try {
      const { resolveExpeditions } = require('./services/expedition');
      setInterval(async () => {
        try { await resolveExpeditions(); } catch(e) { console.warn('[EXPEDITION] resolve error:', e.message); }
      }, 2 * 60 * 1000);
      console.log('[EXPEDITION] Resolution scheduler started (2min interval)');
    } catch(e) { console.warn('[EXPEDITION] Could not init scheduler:', e.message); }

    // ── VIP: Expire stale passes (every 15 minutes) ──
    try {
      const { expireOldPasses } = require('./services/vip');
      setInterval(async () => {
        try { await expireOldPasses(); } catch(e) { console.warn('[VIP] expire error:', e.message); }
      }, 15 * 60 * 1000);
      console.log('[VIP] Pass expiry scheduler started (15min interval)');
    } catch(e) { console.warn('[VIP] Could not init expiry scheduler:', e.message); }

    // ── Spells: Expire old spells (every 5 minutes) ──
    try {
      const { expireSpells } = require('./services/spells');
      setInterval(async () => {
        try { await expireSpells(); } catch(e) { console.warn('[SPELLS] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[SPELLS] Spell expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[SPELLS] Could not init expiry scheduler:', e.message); }

    // ── Broadcasts: Expire old broadcasts (every 5 minutes) ──
    try {
      const { expireBroadcasts } = require('./services/broadcasts');
      setInterval(async () => {
        try { await expireBroadcasts(); } catch(e) { console.warn('[BROADCASTS] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[BROADCASTS] Expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[BROADCASTS] Could not init expiry scheduler:', e.message); }

    try {
      const { autoDrawExpired } = require('./services/raffle');
      setInterval(async () => {
        try { await autoDrawExpired(); } catch(e) { console.warn('[RAFFLE] draw error:', e.message); }
      }, 60 * 1000); // every 1 min
      console.log('[RAFFLE] Auto-draw scheduler started (1min interval)');
    } catch(e) { console.warn('[RAFFLE] Could not init draw scheduler:', e.message); }

    try {
      const { autoLockExpired } = require('./services/wager');
      setInterval(async () => {
        try { await autoLockExpired(); } catch(e) { console.warn('[WAGER] lock error:', e.message); }
      }, 60 * 1000);
      console.log('[WAGER] Auto-lock scheduler started (1min interval)');
    } catch(e) { console.warn('[WAGER] Could not init lock scheduler:', e.message); }

    try {
      const { expireEvents } = require('./services/tevt');
      setInterval(async () => {
        try { await expireEvents(); } catch(e) { console.warn('[TEVT] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[TEVT] Event expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[TEVT] Could not init expiry scheduler:', e.message); }

    try {
      const { expireBeacons } = require('./services/beacon');
      setInterval(async () => {
        try { await expireBeacons(); } catch(e) { console.warn('[BEACON] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[BEACON] Beacon expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[BEACON] Could not init expiry scheduler:', e.message); }

    try {
      const { expirePolls } = require('./services/polls');
      setInterval(async () => {
        try { await expirePolls(); } catch(e) { console.warn('[POLLS] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[POLLS] Poll expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[POLLS] Could not init expiry scheduler:', e.message); }

    try {
      const { expireStatuses } = require('./services/status');
      setInterval(async () => {
        try { await expireStatuses(); } catch(e) { console.warn('[STATUS] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[STATUS] Status expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[STATUS] Could not init expiry scheduler:', e.message); }

    try {
      const { expireSponsors } = require('./services/sponsor');
      setInterval(async () => {
        try { await expireSponsors(); } catch(e) { console.warn('[SPONSOR] expire error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[SPONSOR] Sponsor expiry scheduler started (5min interval)');
    } catch(e) { console.warn('[SPONSOR] Could not init expiry scheduler:', e.message); }

    try {
      const { revealDueCapsules } = require('./services/capsule');
      setInterval(async () => {
        try {
          const revealed = await revealDueCapsules();
          if (revealed.length > 0) console.log(`[CAPSULE] Revealed ${revealed.length} time capsule(s)`);
        } catch(e) { console.warn('[CAPSULE] reveal error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[CAPSULE] Reveal scheduler started (5min interval)');
    } catch(e) { console.warn('[CAPSULE] Could not init reveal scheduler:', e.message); }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════╗`);
      console.log(`║  OCCUPY MARS — Server Running             ║`);
      console.log(`║  http://localhost:${PORT}                    ║`);
      console.log(`║  Admin: http://localhost:${PORT}/admin        ║`);
      console.log(`╚══════════════════════════════════════════╝\n`);
    });

    // ── Graceful Shutdown ──
    function gracefulShutdown() {
      console.log('[Server] Shutting down gracefully...');
      server.close(() => {
        pool.end(() => {
          console.log('[Server] Closed all connections');
          process.exit(0);
        });
      });
      setTimeout(() => { process.exit(1); }, 10000);
    }

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (e) {
    console.error('[Server] Failed to start:', e.message);
    process.exit(1);
  }
}

start();
