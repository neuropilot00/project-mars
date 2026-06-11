/**
 * server/index.js — OCCUPY MARS 메인 서버 진입점
 * ══════════════════════════════════════════════════════════════
 *
 * 역할:
 *   1. Express 앱 초기화 + 미들웨어 설정
 *   2. 61개 라우트 파일 등록 (모두 /api/* prefix)
 *   3. 정적 파일 서빙 (index.html, admin.html, assets/)
 *   4. 50개+ setInterval 스케줄러 (서비스별 만료/정리/정산 작업)
 *   5. DB 초기화 + 자동 마이그레이션 실행
 *
 * 주요 경로:
 *   GET  /health               — 서버 상태 확인 (DB ping 포함)
 *   /api/*                     — 게임 API (JWT 또는 x-wallet 헤더 인증)
 *   /admin/api/*               — 어드민 API (x-admin-secret 헤더 인증)
 *   /                          — index.html (메인 앱)
 *   /admin                     — admin.html (어드민 패널)
 *
 * 새 라우트 추가 방법:
 *   1. server/routes/xxx.js 작성
 *   2. 이 파일 상단 require 목록에 추가
 *   3. app.use('/api', xxxRoutes); 라인 추가 (~line 285 근처)
 *
 * 새 스케줄러 추가 방법:
 *   start() 함수 내 마지막 setInterval 블록 이후에 동일 패턴으로 추가:
 *   try {
 *     const { myFunc } = require('./services/xxx');
 *     setInterval(async () => {
 *       try { await myFunc(); } catch(e) { console.warn('[XXX] error:', e.message); }
 *     }, 5 * 60 * 1000);
 *   } catch(e) { console.warn('[XXX] Could not init scheduler:', e.message); }
 *
 * ══════════════════════════════════════════════════════════════
 */

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
const { makeRateLimiter } = require('./utils/rateLimiters');
const { safeInitScheduler, scheduleTask } = require('./utils/scheduler');

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
const { requireAdmin } = require('./middleware/adminAuth');

// ══════════════════════════════════════════════════════════════
// 라우트 파일 로드 (61개)
// 등록 순서는 아래 app.use() 섹션과 동일
// ══════════════════════════════════════════════════════════════
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const arenaRoutes = require('./routes/arena');
const governanceRoutes = require('./routes/governance');
const marketplaceRoutes = require('./routes/marketplace');
const jobRoutes = require('./routes/job');
const resourceRoutes = require('./routes/resource');
const chatRoutes = require('./routes/chat');
// Removed: routes/onboarding.js v1 (frontend uses v2 only — onboardingRoutes.js mounted at /api/onboarding)
const sectorRoutes = require('./routes/sectors');
const siegeRoutes = require('./routes/siege');
// Removed: routes/public.js (0 frontend fetches — see also publicV2Routes deletion below)
// Removed: routes/betting.js v1 — 통합 to warBettingRoutes.js (legacy admin/odds endpoints 추가)
const warBettingRoutes = require('./routes/warBettingRoutes'); // War Betting v2
const auctionRoutes = require('./routes/auction');
const shipRoutes    = require('./routes/ships');
// Removed: routes/battle.js (legacy ship-battle, schema mismatch — replaced by fleet_battles)
const fleetBattleRoutes = require('./routes/fleetBattles'); // A-4: Fleet Battle Engine
const fleetSearchRoutes = require('./routes/fleetSearch');   // Phase B: Fleet Search
const battleExtrasRoutes = require('./routes/battleExtras'); // Phase B: Battle Rewards/Siege
const phaseCRoutes = require('./routes/phaseC');             // Phase C: AI/Tournament/Hijack
const phaseDRoutes = require('./routes/phaseD');             // Phase D: Alliance/Replay/Mobile
const jobsRoutes         = require('./routes/jobs');               // Job System (mine/select/buffs)
const onboardingV2Routes = require('./routes/onboardingRoutes');   // Onboarding Tutorial v2
const lotteryRoutes  = require('./routes/lottery');
const stakingRoutes  = require('./routes/staking');
// Removed: gpBurn / weeklyChallenges (phantom tables, 0 fetch refs in index.html)
const dividendRoutes    = require('./routes/dividends');
const monumentRoutes    = require('./routes/monuments');
const upgradeRoutes     = require('./routes/claimUpgrades');
const bountyRoutes         = require('./routes/bounty');           // Bounty Board
const dailyOpsRoutes       = require('./routes/dailyOps');          // Daily OPS 미션
const campaignRoutes       = require('./routes/campaignRoutes');    // Campaign + reputation/tag/lore routes
const itemEconomyRoutes    = require('./routes/itemEconomyRoutes'); // Shop + item instances + enhancement
const missionRoutes        = require('./routes/missionRoutes');     // Mission launch/claim/cancel routes
const territoryIdentityRoutes = require('./routes/territoryIdentity'); // 영토 정체성 + 섹터 갈등맵
const shieldRoutes      = require('./routes/shield');
const craftingRoutes    = require('./routes/crafting');
const duelRoutes        = require('./routes/duel');
const transportRoutes   = require('./routes/transport');     // Phase C: sector transport + raid
const rentalRoutes      = require('./routes/rental');
const contestRoutes     = require('./routes/contest');
const allianceRoutes    = require('./routes/alliance');
// Removed: luckyBox (phantom tables, 0 fetch refs in index.html)
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
const tributeRoutes     = require('./routes/tribute');
const graffitiRoutes    = require('./routes/graffiti');
const highlightRoutes   = require('./routes/highlight');
const ratingRoutes      = require('./routes/rating');
const bannerRoutes      = require('./routes/banner');
const journalRoutes     = require('./routes/journal');
const tprestigeRoutes   = require('./routes/tprestige');
const announceRoutes    = require('./routes/announcement');
const tombstoneRoutes   = require('./routes/tombstone');
const milestoneRoutes   = require('./routes/milestone');
const factionRoutes     = require('./routes/factions');  // A-1: 파벌 선택 시스템
const newResourcesRoutes = require('./routes/resources'); // A-2: 자원 인벤토리 (복수형, 함선 UI용)
const fleetRoutes       = require('./routes/fleets');    // A-3: 함대 편성 시스템
const weatherRoutes     = require('./routes/weatherRoutes'); // Weather Strategic v2
// Removed: routes/publicRoutes.js (0 frontend fetches — Chronicle Enhanced Public API was unused)
const hofRoutes         = require('./routes/hallOfFameRoutes'); // Hall of Fame & Titles

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Railway, Cloudflare, etc.)
const PORT = process.env.PORT || 3000;
// 수평 확장용: 스케줄러(setInterval 잡)와 온체인 입금 리스너를 어느 인스턴스에서 돌릴지 게이트.
// 기본 true(단일 인스턴스 하위호환). 여러 web 인스턴스로 확장할 땐 web=false, 워커 1개만 true.
// (false 인데도 켜지 않으면 중복 스폰/중복 입금 크레딧이 발생하므로 워커 정확히 1개만 true)
const RUN_SCHEDULERS = process.env.RUN_SCHEDULERS !== 'false';

// ── Security Headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Tactical Lab v11.1 simulator is iframed from index.html (same-origin) — allow SAMEORIGIN for that page only
  if (req.path === '/assets/tactical-lab-v11.html' || req.path === '/assets/ace-combat.html') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // [v7.191] HSTS — production HTTPS 강제. Railway/Cloudflare 가 HTTPS 종단처리, 그 뒤 평문 HTTP로 오는 케이스 차단.
  //   max-age=2년, includeSubDomains 미적용 (서브도메인 별도 운영 가능성). preload 도 후순위 (한번 등록되면 되돌리기 어려움).
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000');
  }
  // [v7.174 G-Crit-3 부분] CSP 강화 — object-src none(플래시/PDF 임베드 차단),
  //   base-uri self(base 태그 변조 방지), form-action self(폼 외부 송신 차단),
  //   frame-ancestors — 페이지별 분리: iframe 컨텐츠 (tactical-lab/campaign-editor) 만 'self', 나머지는 'none'.
  //   [v7.186] 'none' 으로 두면 iframe 임베드 차단 → 전술 실험실 시작 안 됨.
  //   [v7.192 F2] 페이지별 정책 — 일반 페이지는 'none' (clickjacking 강화), iframe 자식 페이지만 'self' 허용.
  //   JWT localStorage XSS 완전 차단은 httpOnly cookie 전환 필요(큰 변경 — 별도 스프린트).
  const _iframeChildren = ['/assets/tactical-lab-v11.html', '/assets/ace-combat.html', '/assets/campaign-editor.html'];
  const _frameAncestors = _iframeChildren.includes(req.path) ? "'self'" : "'none'";
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://*.trycloudflare.com https://*.railway.app https://*.infura.io https://*.alchemy.com wss://*; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors " + _frameAncestors + ";");
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
  const httpStatus = status === 'ok' ? 200 : 503;
  // 리더(스케줄러/입금 리스너 실행) 여부 노출 — 모니터링이 "워커 0개" 사고를 감지하도록.
  let leaderStatus = false;
  try { leaderStatus = require('./services/leader').isLeader(); } catch (_) {}
  // Redis 실제 연결 상태 (off=인메모리 / ok=연결 / down=끊김) — 멀티 인스턴스 검증·모니터링.
  let redisStatus = 'off';
  try { redisStatus = await require('./services/cache').cachePing(); } catch (_) {}
  res.status(httpStatus).json({
    status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    memory: memoryMB,
    scheduler_leader: leaderStatus,  // ⚠️ 전체 인스턴스에서 모두 false면 워커 0개 = 입금 처리 중단 경보
    redis: redisStatus               // off=인메모리, ok=Redis 연결, down=Redis 끊김
  });
});

// ── Rate Limiting ──
const isDev = process.env.NODE_ENV !== 'production';
// 멀티 인스턴스 전역 레이트리밋: REDIS_URL 있으면 Redis 공유 스토어, 없으면 메모리 폴백.
const { makeLimiterStore } = require('./services/rateLimitStore');
const globalLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 3000,
  store: makeLimiterStore('global'),
  passOnStoreError: true,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  store: makeLimiterStore('auth'),
  passOnStoreError: true,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

const apiLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 200,
  store: makeLimiterStore('api'),
  passOnStoreError: true,
  message: { error: 'Too many API requests, please try again later.' }
});

// API write limiter — applies to all POST/PUT/PATCH/DELETE under /api
// Covers GP-consuming endpoints that don't have their own writeLimiter
const apiWriteLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 60,
  store: makeLimiterStore('apiwrite'),
  passOnStoreError: true,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many write requests, please try again later.' }
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
    // Local dev is served interchangeably on localhost AND 127.0.0.1 (any port).
    // globe.gl loads textures with crossOrigin='anonymous', which makes the browser
    // send an Origin header even for same-origin requests — so a 127.0.0.1 visitor
    // would otherwise be rejected because only localhost was allow-listed. Allow both.
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // [v7.170 G-Crit-2 fix] CORS wildcard 매칭을 endsWith → 정규식으로 변경.
    //   기존: 'https://*.railway.app' 를 '.railway.app' 로 바꿔 endsWith.
    //          → 'https://evil-railway.app' 같은 도메인이 통과(prefix·subdomain 검증 X).
    //   신규: 'https://*.railway.app' → /^https:\/\/[a-z0-9.-]+\.railway\.app$/ 매칭.
    //          서브도메인 외 어떤 prefix/postfix도 거부.
    var allowed = allowedOrigins.some(function(ao) {
      if (ao.includes('*')) {
        var pattern = ao
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // 메타문자 이스케이프
          .replace(/\\\*/g, '[a-z0-9-]+');         // \* → 서브도메인 1단
        try { return new RegExp('^' + pattern + '$').test(origin); } catch (_) { return false; }
      }
      return ao === origin;
    });
    // Disallowed origin: do NOT throw — a thrown error propagates to the global
    // error handler and becomes a 500, which (for crossOrigin asset requests like
    // Mars textures) makes the planet fail to render. Returning false simply omits
    // CORS headers; the browser still enforces the block client-side, and
    // same-origin asset requests continue to serve normally.
    return callback(null, !!allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'x-wallet', 'X-CSRF-Token'] // [v7.172 G-Crit-4]
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
app.use('/api', apiWriteLimiter); // Write rate limit for all POST/PUT/PATCH/DELETE under /api
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// ⚠️ job/resource/onboarding/sector routes must come BEFORE apiRoutes to avoid /user/:wallet wildcard conflict
app.use('/api', jobRoutes);
app.use('/api', resourceRoutes);
app.use('/api', chatRoutes);
// Removed: onboardingRoutes v1 mount
app.use('/api', sectorRoutes);
app.use('/api', siegeRoutes);
// Removed: publicRoutes mount
app.use('/api/weather', weatherRoutes);    // Weather Strategic v2
app.use('/api/betting', warBettingRoutes); // War Betting (v1 + v2 통합)
// Removed: bettingRoutes v1 mount
app.use('/api/auctions', require('./routes/auctionRoutes')); // M-090: 옥션 (must be before /api auctionRoutes)
// Removed: territoryRoutes (0 frontend fetches — M-091 영토 매매 비주얼 미사용)
// Removed: factionRoutes.js v2 (frontend uses v1 only — see services/factionSystem.js deletion)
app.use('/api', auctionRoutes);
app.use('/api/ships', shipRoutes); // A-2: 함선 건조 (relative paths, must mount at /api/ships)
app.use('/api', phaseCRoutes);               // Phase C: AI/Tournament/Hijack
app.use('/api', phaseDRoutes);               // Phase D: Alliance/Replay/Mobile
app.use('/api/jobs', jobsRoutes);            // Job System (mine/select/buffs)
app.use('/api/onboarding', onboardingV2Routes); // Onboarding Tutorial v2
// Removed: publicV2Routes mount (was Chronicle Enhanced Public API)
// app.use('/api/titles', hofRoutes);             // [v7.172 G-Crit-5 disabled — frontend 호출 0건] Hall of Fame & Titles
// app.use('/api/hof',    hofRoutes);             // [v7.172 G-Crit-5 disabled — frontend 호출 0건] Hall of Fame board
app.use('/api/battles', battleExtrasRoutes); // Phase B: Rewards/Siege extras (before fleetBattles to capture /rewards/mine etc.)
app.use('/api/battles', fleetBattleRoutes); // A-4: Fleet Battle Engine (must be before /api for prefix priority)
try { app.use('/api', require('./routes/commanderActions')); } catch (e) { console.warn('[mount] commanderActions skipped:', e.message); } // M-151: Commander Actions
try { app.use('/api/resource-craft', require('./routes/resourceCraft')); } catch (e) { console.warn('[mount] resourceCraft skipped:', e.message); } // M-091: Tier-3 crafting
try { app.use('/api', require('./routes/worldEvents')); } catch (e) { console.warn('[mount] worldEvents skipped:', e.message); } // M-154: Void Raider
// Removed: battleRoutes mount
app.use('/api', lotteryRoutes);
app.use('/api', stakingRoutes);
// Removed: gpBurnRoutes, weeklyRoutes (phantom tables, 0 UI refs)
app.use('/api', dividendRoutes);
app.use('/api', monumentRoutes);
app.use('/api', upgradeRoutes);
app.use('/api/bounty', bountyRoutes);                         // Bounty Board
app.use('/api/killboard', require('./routes/killboard'));     // Killboard (ship_wrecks 격침 귀속)
app.use('/api/spy', require('./routes/spy'));                 // PvP 스파이/정찰 (적 함대 구성 노출)
app.use('/api/daily-ops', dailyOpsRoutes);                    // Daily OPS 미션
app.use('/api', apiLimiter, campaignRoutes);                  // Campaign + reputation/tag/lore routes
app.use('/api', apiLimiter, itemEconomyRoutes);               // Shop + item instances + enhancement routes
app.use('/api', apiLimiter, missionRoutes);                   // Mission launch/claim/cancel routes
app.use('/api/territory', territoryIdentityRoutes);           // 영토 정체성 (identity/FR)
app.use('/api/sectors',   territoryIdentityRoutes);           // 섹터 갈등맵 (/api/sectors/conflict-map)
app.use('/api', shieldRoutes);
app.use('/api', craftingRoutes);
app.use('/api', duelRoutes);
app.use('/api', transportRoutes);
app.use('/api', rentalRoutes);
app.use('/api', contestRoutes);
app.use('/api', allianceRoutes);
// Removed: luckyBoxRoutes (phantom tables, 0 UI refs)
app.use('/api', vipRoutes);
app.use('/api', expeditionRoutes);
app.use('/api', require('./routes/shipMining')); // 경제 v2 P5 — 함선 채굴 런 (F2P 노가다)
app.use('/api', require('./routes/assembly')); // 합체 슈퍼유닛 P1 — 파츠 수집/합체
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
app.use('/api', tributeRoutes);
app.use('/api', graffitiRoutes);
app.use('/api', highlightRoutes);
app.use('/api', ratingRoutes);
app.use('/api', bannerRoutes);
app.use('/api', journalRoutes);
app.use('/api', tprestigeRoutes);
app.use('/api', announceRoutes);
app.use('/api', tombstoneRoutes);
app.use('/api', milestoneRoutes);
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/auth', authRoutes);
try { app.use('/', require('./routes/bugReport')); } catch (e) { console.warn('[mount] bugReport skipped:', e.message); } // M-192: bug report submit + admin
app.use('/api/admin', require('./routes/adminEconomyRoutes'));
app.use('/api/arena', arenaRoutes);
app.use('/api/factions', factionRoutes);      // A-1: 파벌 선택 시스템
app.use('/api/resources', newResourcesRoutes); // A-2: 자원 인벤토리
app.use('/api/fleets', fleetSearchRoutes);      // Phase B: Fleet Search (before fleetRoutes)
app.use('/api/fleets', fleetRoutes);           // A-3: 함대 편성
app.use('/api/tactical-lab', require('./routes/tacticalLab')); // v11.1 simulator public catalog
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
    // Images: no-cache (assets update frequently) + CORS for canvas access
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (/\.(js|css)$/i.test(req.path)) {
    // JS/CSS: 1 day
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  next();
});
// ── Favicon 204 (no content) — avoid noisy 404 ──
app.get('/favicon.ico', (_req, res) => res.status(204).end());
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
app.get('/assets/campaign-editor.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'assets', 'campaign-editor.html'));
});
app.get('/ace-combat.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'assets', 'ace-combat.html'));
});

const CAMPAIGN_DIR = path.join(__dirname, '..', 'docs', 'campaign-story');

function isSafeCampaignJsonFile(file) {
  return typeof file === 'string' && !file.includes('..') && file.endsWith('.json') && path.basename(file) === file;
}

app.get('/admin/api/campaign-editor/chapters', requireAdmin, (req, res) => {
  try {
    const chapters = fs.readdirSync(CAMPAIGN_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .map(file => {
        const fullPath = path.join(CAMPAIGN_DIR, file);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const rawTitle = data.title || data.id || file.replace(/\.json$/i, '');
        const title = typeof rawTitle === 'object'
          ? (rawTitle.ko || rawTitle.en || file.replace(/\.json$/i, ''))
          : String(rawTitle);
        return {
          id: data.id || data.questId || file.replace(/\.json$/i, ''),
          title,
          file,
          questId: data.questId || null
        };
      });
    res.json({ chapters });
  } catch (e) {
    console.error('[campaign-editor] Failed to list chapters:', e);
    res.status(500).json({ error: 'Failed to list chapters' });
  }
});

app.get('/admin/api/campaign-editor/chapter/:file', requireAdmin, (req, res) => {
  const { file } = req.params;
  if (!isSafeCampaignJsonFile(file)) {
    return res.status(400).json({ error: 'Invalid chapter file' });
  }

  try {
    const fullPath = path.join(CAMPAIGN_DIR, file);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Chapter not found' });
    res.json(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  } catch (e) {
    console.error(`[campaign-editor] Failed to read chapter ${file}:`, e);
    res.status(500).json({ error: 'Failed to read chapter' });
  }
});

app.post('/admin/api/campaign-editor/chapter/:file', requireAdmin, (req, res) => {
  const { file } = req.params;
  if (!isSafeCampaignJsonFile(file)) {
    return res.status(400).json({ error: 'Invalid chapter file' });
  }

  try {
    const fullPath = path.join(CAMPAIGN_DIR, file);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Chapter not found' });
    fs.writeFileSync(fullPath, `${JSON.stringify(req.body, null, 2)}\n`, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    console.error(`[campaign-editor] Failed to save chapter ${file}:`, e);
    res.status(500).json({ error: 'Failed to save chapter' });
  }
});

app.get('/admin/api/campaign-editor/assets', requireAdmin, (req, res) => {
  try {
    const backgroundsDir = path.join(__dirname, '..', 'assets', 'campaign', 'backgrounds');
    const charactersDir = path.join(__dirname, '..', 'assets', 'campaign', 'characters');
    const backgrounds = fs.readdirSync(backgroundsDir)
      .filter(file => file.endsWith('.png'))
      .sort();
    const characters = fs.readdirSync(charactersDir)
      .filter(file => file.endsWith('.png'))
      .map(file => file.replace(/\.png$/i, ''))
      .sort();
    res.json({ backgrounds, characters });
  } catch (e) {
    console.error('[campaign-editor] Failed to list assets:', e);
    res.status(500).json({ error: 'Failed to list assets' });
  }
});

app.use('/admin/api', adminRoutes);

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

    // ── 강제 Cantina 활성화 (매 부팅마다 idempotent) ──
    try {
      const { pool } = require('./db');
      await pool.query(`
        INSERT INTO settings (category, key, value, description)
        VALUES ('cantina', 'cantina_enabled', 'true', 'Cantina (Arena) 활성화')
        ON CONFLICT (key) DO UPDATE SET value = 'true'
      `);
      console.log('[boot] cantina_enabled = true 강제 세팅 완료');
    } catch (cErr) {
      console.warn('[boot] cantina enable failed:', cErr.message);
    }

    // Initialize withdrawal signer (모든 인스턴스 — 출금 서명은 web API에서 처리)
    initSigner();

    // ── 워커 게이트 시작 (leader election) ────────────────────────
    // 온체인 입금 리스너 + 모든 스케줄러는 "리더" 인스턴스 1개에서만 실행한다.
    //  - REDIS_URL 있으면 Redis 락(SET NX PX)으로 정확히 1개 자동 선출 + 하트비트/페일오버.
    //  - REDIS_URL 없으면 단일 인스턴스 기본(RUN_SCHEDULERS=false 면 opt-out).
    // honor-based env 단독 의존(워커 0개/2개+ 사고)을 코드로 차단. (services/leader.js)
    const _runSchedulers = await require('./services/leader').shouldRunSchedulers();
    if (_runSchedulers) {
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
      const { spawnWeatherEvents, expireWeather, activateForecasts } = require('./services/weather');
      // Expire weather every 5 minutes
      setInterval(async () => {
        try { await expireWeather(); } catch(e) { console.warn('[WEATHER] expire error:', e.message); }
      }, 5 * 60 * 1000);
      // Spawn weather events every 6 hours (no-op when weather_random_enabled=false)
      setInterval(async () => {
        try { await spawnWeatherEvents(); } catch(e) { console.warn('[WEATHER] spawn error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      // Initial spawn on startup (after 30s delay)
      setTimeout(async () => {
        try { await spawnWeatherEvents(); } catch(e) { console.warn('[WEATHER] initial spawn error:', e.message); }
      }, 30 * 1000);
      // Activate strategic forecasts every 1 minute
      setInterval(() => activateForecasts().catch(console.error), 60 * 1000);
      console.log('[WEATHER] Scheduled tasks initialized (expire: 5min, spawn: 6h, activateForecasts: 1min)');
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

    // ── Transport (M-158) — settle arrived shipments every 60s ──
    try {
      const transportSvc = require('./services/transport');
      setInterval(async () => {
        try {
          const r = await transportSvc.settleArrivedTransports();
          if (r && r.settled > 0) console.log('[TRANSPORT] Settled ' + r.settled + ' shipment(s)');
        } catch(e) { console.warn('[TRANSPORT] settle error:', e.message); }
      }, 60 * 1000);
      console.log('[TRANSPORT] Arrival-settlement timer initialized (60s)');
    } catch(e) { console.warn('[TRANSPORT] Could not init:', e.message); }

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

    // ── VIP Pass Expiry Check (every hour) ──
    try {
      const vipSvc = require('./services/vip');
      setInterval(async () => {
        try { await vipSvc.expireOldPasses(); } catch(e) { console.warn('[VIP] expire check error:', e.message); }
      }, 60 * 60 * 1000);
      console.log('[VIP] Expiry check scheduled (every 1h)');
    } catch(e) { console.warn('[VIP] Could not init expiry check:', e.message); }

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
              if (!itemRes.rows.length) { await client.query('ROLLBACK'); continue; }
              const item = itemRes.rows[0];
              const cost = parseFloat(item.price_pp);

              // Check user balance
              const balRes = await client.query('SELECT pp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [shield.owner]);
              const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);

              if (ppBal < cost) {
                // Insufficient PP — disable auto-renew
                await client.query('UPDATE pixel_shields SET auto_renew = false WHERE id = $1', [shield.id]);
                await client.query('COMMIT');
                console.log(`[AUTO-RENEW] Shield #${shield.id} — insufficient PP (${ppBal}/${cost}), auto-renew disabled`);
                continue;
              }

              // Deduct PP
              await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [cost, shield.owner]);

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
                await client.query('COMMIT'); continue;
              }
              const item = itemRes.rows[0];
              const cost = parseFloat(item.price_pp);

              const balRes = await client.query('SELECT pp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [effect.wallet]);
              const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);

              if (ppBal < cost) {
                await client.query('UPDATE user_active_effects SET active = false, auto_renew = false WHERE id = $1', [effect.id]);
                await client.query('COMMIT');
                console.log(`[AUTO-RENEW] Effect ${effect.effect_type} — insufficient PP (${ppBal}/${cost}), disabled`);
                continue;
              }

              // Deduct PP
              await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [cost, effect.wallet]);

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
      const { resolveExpiredSieges, prepareSiegeBattles, maybeOpenCommanderSiege } = require('./services/siege');
      setInterval(async () => {
        try {
          const n = await resolveExpiredSieges(); // pending→active 전환 + 만료 siege 해결(픽셀 폴백)
          if (n > 0) console.log(`[SIEGE] Auto-resolved ${n} expired siege(s)`);
        } catch(e) { console.warn('[SIEGE] auto-resolve error:', e.message); }
        // [Phase1] active + 양측 함대 커밋된 siege → 결전 함대전 생성 (siege_fleet_combat_enabled=true 일 때만)
        try {
          if (typeof prepareSiegeBattles === 'function') await prepareSiegeBattles();
        } catch(e) { console.warn('[SIEGE] prepareSiegeBattles error:', e.message); }
        // [Phase3] 월간 자동 커맨더 공성 — 매월 슬롯 1회 자동 개최 / 무도전 시 강등
        try {
          if (typeof maybeOpenCommanderSiege === 'function') await maybeOpenCommanderSiege();
        } catch(e) { console.warn('[SIEGE] maybeOpenCommanderSiege error:', e.message); }
      }, 5 * 60 * 1000); // every 5 minutes
      console.log('[SIEGE] Auto-resolve scheduler started (5min interval)');
    } catch(e) { console.warn('[SIEGE] Could not init auto-resolve scheduler:', e.message); }

    // Removed: betting.js v1 scheduler — warBetting v2가 동일 작업 60초마다 수행
    // ── War Betting v2: Close Expired Events (every 60 seconds) ──
    safeInitScheduler('warBetting', () => {
      const warBettingSvc = require('./services/warBetting');
      scheduleTask('warBetting', 60 * 1000, () => warBettingSvc.closeExpiredEvents(), {
        silent: true,
        startedMessage: '[warBetting] closeExpiredEvents scheduler started (60s interval)',
      });
    });

    // ── 동적 PP↔GP 환율 재계산 (every 1 hour, 기본 OFF) [v7.128] ──
    safeInitScheduler('exchangeRate', () => {
      const { recomputeRate } = require('./services/exchangeRate');
      scheduleTask('exchangeRate', 60 * 60 * 1000, recomputeRate, {
        phase: 'recompute',
        startedMessage: '[exchangeRate] dynamic PP→GP rate scheduler started (1h interval, default OFF)',
      });
    });

    // ── 영토 컨디션 일일 감쇠 (every 24h) [v7.135] ──
    safeInitScheduler('territoryCondition', () => {
      const { applyDailyDecay } = require('./services/territoryCondition');
      scheduleTask('territoryCondition', 24 * 60 * 60 * 1000, applyDailyDecay, {
        phase: 'decay',
        startedMessage: '[territoryCondition] daily decay scheduler started (24h interval)',
      });
    });

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

    // Removed: legacy Battle Engine scheduler (services/battle.js, schema mismatch)
    //          PVP is now handled by fleet_battles (services/fleet.js + battleEngine.js).

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

    // ── Governance Auto-Expire (every 1 hour + boot 30s 후 1회) ──
    // 비활성/탈퇴 governor 와 commander 자동 자리 비움. admin 이 매번 수동 클리어 안 해도 됨.
    try {
      const { expireStaleGovernance } = require('./services/governanceExpire');
      setTimeout(async () => {
        try { await expireStaleGovernance(); } catch(e) { console.warn('[GOV-EXPIRE] startup error:', e.message); }
      }, 30 * 1000);
      setInterval(async () => {
        try { await expireStaleGovernance(); } catch(e) { console.warn('[GOV-EXPIRE] error:', e.message); }
      }, 60 * 60 * 1000);
      console.log('[GOV-EXPIRE] Auto-expire scheduler started (1h interval, boot+30s)');
    } catch(e) { console.warn('[GOV-EXPIRE] Could not init scheduler:', e.message); }

    // ── Rank Auto-Recalc (active users, every 5 min default) ──
    // XP 누적 후 rank_level 자동 재계산. lazy trigger 와 함께 active user 자동 처리.
    // settings: rank_auto_recalc_enabled / rank_recalc_interval_seconds / rank_recalc_lookback_hours / rank_recalc_batch_size
    try {
      const { recalcRecentlyActive } = require('./services/rank');
      const { getSetting } = require('./db');
      const intervalSec = parseInt(await getSetting('rank_recalc_interval_seconds', '300')) || 300;
      setTimeout(async () => {
        try {
          const r = await recalcRecentlyActive();
          if (r && !r.skipped) console.log(`[RANK] startup batch: processed=${r.processed} leveledUp=${r.leveledUp}`);
        } catch(e) { console.warn('[RANK] startup batch error:', e.message); }
      }, 60 * 1000);
      setInterval(async () => {
        try {
          const r = await recalcRecentlyActive();
          if (r && !r.skipped && r.leveledUp > 0) console.log(`[RANK] batch: ${r.leveledUp} users leveled up (of ${r.processed})`);
        } catch(e) { console.warn('[RANK] batch error:', e.message); }
      }, intervalSec * 1000);
      console.log(`[RANK] Auto-recalc scheduler started (${intervalSec}s interval, boot+60s)`);
    } catch(e) { console.warn('[RANK] Could not init scheduler:', e.message); }

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

    // ── Resource Crafting: Auto-claim completed jobs (every 1 minute) — M-091 ──
    try {
      const { processCompletedJobs } = require('./services/resourceCraft');
      setInterval(async () => {
        try {
          const r = await processCompletedJobs();
          if (r.success > 0) console.log(`[CRAFT] Auto-claimed ${r.success} job(s)`);
        } catch(e) { console.warn('[CRAFT] processCompletedJobs error:', e.message); }
      }, 60 * 1000);
      console.log('[CRAFT] Auto-claim scheduler started (1min interval)');
    } catch(e) { console.warn('[CRAFT] Could not init scheduler:', e.message); }

    // ── World Events: Settle expired + maybe auto-spawn (every 2 minutes) — M-154 ──
    try {
      const we = require('./services/worldEvents');
      setInterval(async () => {
        try { await we.settleExpiredEvents(); } catch(e) { console.warn('[WE] settle error:', e.message); }
        try {
          const s = await we.maybeAutoSpawn();
          if (s?.spawned) console.log(`[WE] Auto-spawned Void Raider ${s.event_code}`);
        } catch(e) { console.warn('[WE] auto-spawn error:', e.message); }
      }, 2 * 60 * 1000);
      console.log('[WE] World Events scheduler started (2min interval)');
    } catch(e) { console.warn('[WE] Could not init scheduler:', e.message); }

    // Removed: GP Burn scheduler (phantom tables — gp_burn_active, gp_burn_log)

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

    // Removed: Weekly Challenges scheduler (phantom tables — weekly_challenge_*)

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

    // Removed: Bounty scheduler (phantom tables — gp_bounties)

    // ── Shield: Expire expired shields (every 5 minutes) ──
    safeInitScheduler('SHIELD', () => {
      const { expireShields } = require('./services/shield');
      scheduleTask('SHIELD', 5 * 60 * 1000, expireShields, {
        phase: 'expire',
        startedMessage: '[SHIELD] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Contest: Advance statuses + auto-finalize (every 5 minutes) ──
    safeInitScheduler('CONTEST', () => {
      const { advanceContestStatuses } = require('./services/contest');
      scheduleTask('CONTEST', 5 * 60 * 1000, advanceContestStatuses, {
        phase: 'advance',
        startedMessage: '[CONTEST] Status scheduler started (5min interval)',
      });
    });

    // ── Rental: Expire ended rentals (every 5 minutes) ──
    safeInitScheduler('RENTAL', () => {
      const { expireRentals } = require('./services/rental');
      scheduleTask('RENTAL', 5 * 60 * 1000, expireRentals, {
        phase: 'expire',
        startedMessage: '[RENTAL] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Duel: Expire pending duels (every 5 minutes) ──
    safeInitScheduler('DUEL', () => {
      const { expireDuels } = require('./services/duel');
      scheduleTask('DUEL', 5 * 60 * 1000, expireDuels, {
        phase: 'expire',
        startedMessage: '[DUEL] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Expedition: Resolve completed expeditions (every 2 minutes) ──
    safeInitScheduler('EXPEDITION', () => {
      const { resolveExpeditions } = require('./services/expedition');
      scheduleTask('EXPEDITION', 2 * 60 * 1000, resolveExpeditions, {
        phase: 'resolve',
        startedMessage: '[EXPEDITION] Resolution scheduler started (2min interval)',
      });
    });

    // ── Auction: Settle expired auctions (every 1 minute) — M-090 ──
    try {
      const auctionCombat = require('./services/auctionCombat');
      setInterval(async () => {
        await auctionCombat.processAllAuctions().catch(console.error);
      }, 60 * 1000);
      console.log('[AUCTION] Scheduler started (1min interval)');
    } catch(e) { console.warn('[AUCTION] Could not init scheduler:', e.message); }

    // ── Territory: Update adjacency bonuses (every 10 minutes) — M-091 ──
    try {
      const tv = require('./services/territoryVisual');
      setInterval(() => tv.updateAdjacencyBonuses().catch(console.error), 600000);
      console.log('[TERRITORY] Adjacency bonus scheduler started (10min interval)');
    } catch(e) { console.warn('[TERRITORY] Could not init scheduler:', e.message); }

    // ── VIP: Expire stale passes (every 15 minutes) ──
    safeInitScheduler('VIP', () => {
      const { expireOldPasses } = require('./services/vip');
      scheduleTask('VIP', 15 * 60 * 1000, expireOldPasses, {
        phase: 'expire',
        startedMessage: '[VIP] Pass expiry scheduler started (15min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Spells: Expire old spells (every 5 minutes) ──
    safeInitScheduler('SPELLS', () => {
      const { expireSpells } = require('./services/spells');
      scheduleTask('SPELLS', 5 * 60 * 1000, expireSpells, {
        phase: 'expire',
        startedMessage: '[SPELLS] Spell expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Broadcasts: Expire old broadcasts (every 5 minutes) ──
    safeInitScheduler('BROADCASTS', () => {
      const { expireBroadcasts } = require('./services/broadcasts');
      scheduleTask('BROADCASTS', 5 * 60 * 1000, expireBroadcasts, {
        phase: 'expire',
        startedMessage: '[BROADCASTS] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Raffle: Auto-draw expired rounds (every 1 minute) ──
    safeInitScheduler('RAFFLE', () => {
      const { autoDrawExpired } = require('./services/raffle');
      scheduleTask('RAFFLE', 60 * 1000, autoDrawExpired, {
        phase: 'draw',
        startedMessage: '[RAFFLE] Auto-draw scheduler started (1min interval)',
      });
    }, 'Could not init draw scheduler');

    // ── Wager: Lock expired wagers (every 1 minute) ──
    safeInitScheduler('WAGER', () => {
      const { autoLockExpired } = require('./services/wager');
      scheduleTask('WAGER', 60 * 1000, autoLockExpired, {
        phase: 'lock',
        startedMessage: '[WAGER] Auto-lock scheduler started (1min interval)',
      });
    }, 'Could not init lock scheduler');

    // ── Territory Events (tevt): Expire old events (every 5 minutes) ──
    safeInitScheduler('TEVT', () => {
      const { expireEvents } = require('./services/tevt');
      scheduleTask('TEVT', 5 * 60 * 1000, expireEvents, {
        phase: 'expire',
        startedMessage: '[TEVT] Event expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Beacon: Expire old beacons (every 5 minutes) ──
    safeInitScheduler('BEACON', () => {
      const { expireBeacons } = require('./services/beacon');
      scheduleTask('BEACON', 5 * 60 * 1000, expireBeacons, {
        phase: 'expire',
        startedMessage: '[BEACON] Beacon expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Polls: Expire ended polls (every 5 minutes) ──
    safeInitScheduler('POLLS', () => {
      const { expirePolls } = require('./services/polls');
      scheduleTask('POLLS', 5 * 60 * 1000, expirePolls, {
        phase: 'expire',
        startedMessage: '[POLLS] Poll expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Status: Expire player statuses (every 5 minutes) ──
    safeInitScheduler('STATUS', () => {
      const { expireStatuses } = require('./services/status');
      scheduleTask('STATUS', 5 * 60 * 1000, expireStatuses, {
        phase: 'expire',
        startedMessage: '[STATUS] Status expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Sponsor: Expire territory sponsors (every 5 minutes) ──
    safeInitScheduler('SPONSOR', () => {
      const { expireSponsors } = require('./services/sponsor');
      scheduleTask('SPONSOR', 5 * 60 * 1000, expireSponsors, {
        phase: 'expire',
        startedMessage: '[SPONSOR] Sponsor expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Banner: Expire territory banners (every 5 minutes) ──
    safeInitScheduler('BANNER', () => {
      const { expireBanners } = require('./services/banner');
      scheduleTask('BANNER', 5 * 60 * 1000, expireBanners, {
        phase: 'expire',
        startedMessage: '[BANNER] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Highlight: Expire territory highlights (every 5 minutes) ──
    safeInitScheduler('HIGHLIGHT', () => {
      const { expireHighlights } = require('./services/highlight');
      scheduleTask('HIGHLIGHT', 5 * 60 * 1000, expireHighlights, {
        phase: 'expire',
        startedMessage: '[HIGHLIGHT] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Graffiti: Expire territory graffiti (every 5 minutes) ──
    safeInitScheduler('GRAFFITI', () => {
      const { expireGraffiti } = require('./services/graffiti');
      scheduleTask('GRAFFITI', 5 * 60 * 1000, expireGraffiti, {
        phase: 'expire',
        startedMessage: '[GRAFFITI] Expiry scheduler started (5min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Announcement: Expire old announcements (every 2 minutes) ──
    safeInitScheduler('ANNOUNCE', () => {
      const { expireAnnouncements } = require('./services/announcement');
      scheduleTask('ANNOUNCE', 2 * 60 * 1000, expireAnnouncements, {
        phase: 'expire',
        startedMessage: '[ANNOUNCE] Expiry scheduler started (2min interval)',
      });
    }, 'Could not init expiry scheduler');

    // ── Ship Build Scheduler: Complete finished build jobs (every 30s) ──
    try {
      require('./services/shipScheduler').start();
    } catch(e) { console.warn('[shipScheduler] Could not start:', e.message); }

    // ── Battle Scheduler: Run scheduled fleet battles (every 30s) ──  A-4
    try {
      require('./services/battleScheduler').start();
    } catch(e) { console.warn('[battleScheduler] Could not start:', e.message); }

    // ── Phase C Scheduler: AI fleets + Tournament + Hijack (every 60s) ──
    try {
      require('./services/phaseCScheduler').start();
    } catch(e) { console.warn('[phaseCScheduler] Could not start:', e.message); }

    // ── Time Capsule: Reveal due capsules (every 5 minutes) ──
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

    // ── Veteran Titles: 매일 UTC 00:xx 체크 ──
    try {
      const titleExt = require('./services/titleExtended');
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
            const count = await titleExt.checkVeteranTitles();
            if (count > 0) console.log(`[TITLES] ${count} veteran title(s) awarded`);
          }
        } catch(e) { console.warn('[TITLES] veteran check error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[TITLES] Veteran scheduler started (5min interval)');
    } catch(e) { console.warn('[TITLES] Could not init veteran scheduler:', e.message); }

    // ── Weekly Chronicle (매주 월요일 UTC 00:00 생성) ──
    try {
      const ce = require('./services/chronicleEnhanced');
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCDay() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
            await ce.generateWeeklyChronicle();
          }
        } catch(e) { console.warn('[CHRONICLE] weekly error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[CHRONICLE] Weekly scheduler started (5min interval)');
    } catch(e) { console.warn('[CHRONICLE] Could not init weekly scheduler:', e.message); }

    // ── Shield Decay: 시간당 3% 자연 감소 (매 30분마다 1.5% 차감) ──
    try {
      const { pool: dbPool, getSetting: dbGetSetting } = require('./db');
      setInterval(async () => {
        try {
          const enabled = await dbGetSetting('shield_enabled', 'true');
          if (String(enabled) === 'false') return;
          const decayPctPerHour = parseFloat(await dbGetSetting('shield_decay_pct_per_hour', '3')) || 3;
          const decayThisInterval = decayPctPerHour / 2; // 30분 = 절반 감소
          const { rowCount } = await dbPool.query(`
            UPDATE ships
            SET shield_hp = GREATEST(0, FLOOR(shield_hp - shield_max * $1 / 100))
            WHERE shield_hp > 0 AND is_alive = true
          `, [decayThisInterval]);
          if (rowCount > 0) console.log(`[SHIELD] Decay applied to ${rowCount} ships (-${decayThisInterval.toFixed(1)}%/tick)`);
        } catch(e) { console.warn('[SHIELD] decay error:', e.message); }
      }, 30 * 60 * 1000); // 30분마다
      console.log('[SHIELD] Decay scheduler started (30min interval)');
    } catch(e) { console.warn('[SHIELD] Could not init decay scheduler:', e.message); }

    // ── Territory Field Rating + Badge Update (매일 00:00 UTC) ──
    try {
      const { updateFieldRatings } = require('./routes/territoryIdentity');
      setInterval(async () => {
        try {
          const now = new Date();
          if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
            await updateFieldRatings();
            console.log('[TERRITORY] Field ratings + badges updated');
          }
        } catch(e) { console.warn('[TERRITORY] field rating update error:', e.message); }
      }, 5 * 60 * 1000); // 5분마다 체크
      console.log('[TERRITORY] Field rating scheduler started (5min check)');
    } catch(e) { console.warn('[TERRITORY] Could not init field rating scheduler:', e.message); }

    // ── Bounty Board: 만료 현상금 정리 (매 1시간) ──
    try {
      setInterval(async () => {
        try {
          // (원자성 v7.370) 과거엔 UPDATE...RETURNING으로 status를 일괄 확정한 뒤 별도
          // pool.query로 환불 → 그 사이 크래시/풀오류 시 status는 expired인데 환불이 누락되어
          // GP가 영구 소실됐다. 행별 BEGIN/COMMIT으로 status flip+환불을 원자화하고,
          // WHERE status='active' 가드로 동시 claim과의 중복 환불을 막는다(0건이면 skip).
          const { rows } = await pool.query(
            `SELECT id, poster_wallet, reward_gp, funded_from_guild_id
             FROM bounty_listings WHERE status = 'active' AND expires_at <= NOW()`
          );
          let refunded = 0;
          for (const b of rows) {
            const c = await pool.connect();
            try {
              await c.query('BEGIN');
              const up = await c.query(
                `UPDATE bounty_listings SET status = 'expired' WHERE id = $1 AND status = 'active'`,
                [b.id]
              );
              if (up.rowCount === 1) {
                if (b.funded_from_guild_id) {
                  await c.query(`UPDATE guilds SET gp_treasury = COALESCE(gp_treasury,0) + $1 WHERE id = $2`,
                    [b.reward_gp, b.funded_from_guild_id]);
                } else {
                  await c.query(`UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = $2`,
                    [b.reward_gp, b.poster_wallet]);
                }
                refunded++;
              }
              await c.query('COMMIT');
            } catch (re) {
              try { await c.query('ROLLBACK'); } catch (_) {}
              console.warn('[BOUNTY] refund row error:', re.message);
            } finally {
              c.release();
            }
          }
          if (refunded > 0) console.log(`[BOUNTY] Expired & refunded ${refunded} bounties`);
        } catch(e) { console.warn('[BOUNTY] expiry cleanup error:', e.message); }
      }, 60 * 60 * 1000); // 1시간마다
      console.log('[BOUNTY] Expiry cleanup scheduler started (1h interval)');
    } catch(e) { console.warn('[BOUNTY] Could not init expiry scheduler:', e.message); }

    // ── 비활성 유저 복귀 훅: 7일 이상 미접속 유저에게 알림 (매일 UTC 09:00 체크) ──
    try {
      const { notifyPlayer } = require('./db');
      setInterval(async () => {
        try {
          const now = new Date();
          // UTC 09:00 근처에만 실행 (1시간 윈도우)
          if (now.getUTCHours() !== 9) return;
          const { rows } = await pool.query(`
            SELECT wallet_address FROM users
            WHERE last_login_at IS NOT NULL
              AND last_login_at < NOW() - INTERVAL '7 days'
              AND last_login_at > NOW() - INTERVAL '30 days'
              AND NOT EXISTS (
                SELECT 1 FROM player_notifications
                WHERE wallet_address = LOWER(users.wallet_address)
                  AND type = 'return_reminder'
                  AND created_at > NOW() - INTERVAL '7 days'
              )
            LIMIT 200
          `);
          for (const row of rows) {
            notifyPlayer(
              row.wallet_address.toLowerCase(),
              'return_reminder',
              '화성이 당신을 기다립니다! 오래 비운 사이 영토 수확을 챙기고 함대를 정비하세요.',
              { days_absent: 7 }
            ).catch(() => {});
          }
          if (rows.length > 0) console.log(`[RETURN-HOOK] Sent return reminder to ${rows.length} inactive users`);
        } catch(e) { console.warn('[RETURN-HOOK] error:', e.message); }
      }, 60 * 60 * 1000); // 매 1시간마다 UTC 체크
      console.log('[RETURN-HOOK] Inactive user reminder scheduler started (1h check)');
    } catch(e) { console.warn('[RETURN-HOOK] Could not init scheduler:', e.message); }

    // ── NPC Arena: NPC끼리 다투기(인파이팅) + 초반 밀도 유지 ──
    //  유령도시 방지 — NPC 함대가 주기적으로 서로 함대전(NPC↔NPC). 보상 mint 0 (is_ai_battle).
    //  기본 OFF (npc_arena_enabled). leader 인스턴스에서만 도는 _runSchedulers 블록 내부.
    try {
      const npcArena = require('./services/npcArena');
      // 함대전 생성 tick (설정 주기, 기본 120s) — DB 설정으로 게이팅되므로 interval 은 보수적으로 잡고 내부에서 enabled 체크
      setInterval(async () => {
        try {
          const r = await npcArena.runArenaTick();
          if (r && r.spawned) console.log(`[npcArena] tick: spawned battle ${r.battle_id}`);
        } catch(e) { console.warn('[npcArena] arena tick error:', e.message); }
      }, 120 * 1000);
      // 밀도 보충 tick (5분마다 활성 NPC 함대 수 확인 후 부족분 보충)
      setInterval(async () => {
        try {
          await npcArena.ensureNpcDensity();
        } catch(e) { console.warn('[npcArena] density tick error:', e.message); }
      }, 5 * 60 * 1000);
      console.log('[npcArena] NPC arena scheduler started (arena 120s, density 5min — gated by npc_arena_enabled)');
    } catch(e) { console.warn('[npcArena] Could not init scheduler:', e.message); }

    // ── [v7.166] Sybil chain 감지 (6h마다 자기거래 chain 분석 → suspicious_wallet_flags 적립) ──
    try {
      const sybilDetect = require('./services/sybilDetect');
      setInterval(async () => {
        try {
          const r = await sybilDetect.detectSelfTradeChains();
          if (r && !r.skipped) console.log('[sybilDetect]', JSON.stringify(r));
        } catch(e) { console.warn('[sybilDetect] tick error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      // 시작 직후 1회 즉시 실행(부팅 후 즉시 감지)
      setTimeout(() => sybilDetect.detectSelfTradeChains().catch(()=>{}), 60 * 1000);
      console.log('[sybilDetect] sybil chain scheduler started (every 6h, gated by sybil_detect_enabled)');
    } catch(e) { console.warn('[sybilDetect] Could not init scheduler:', e.message); }

    // [v7.193 F4] wash-trade 누적 sweep — 6시간 마다 같은 buyer/seller 쌍의 반복 거래 패턴 재평가.
    //   단발은 점수 낮아 통과해도 5회+ 누적되면 의심 플래그. sybilDetect 와 별개 (다른 패턴).
    try {
      const washSvc = require('./services/washTradeDetect');
      setInterval(async () => {
        try {
          const r = await washSvc.sweepRecentObservations();
          if (r && r.flagged > 0) console.log('[washTrade] sweep', JSON.stringify(r));
        } catch(e) { console.warn('[washTrade] sweep tick error:', e.message); }
      }, 6 * 60 * 60 * 1000);
      setTimeout(() => washSvc.sweepRecentObservations().catch(()=>{}), 90 * 1000);
      console.log('[washTrade] sweep scheduler started (every 6h)');
    } catch(e) { console.warn('[washTrade] Could not init scheduler:', e.message); }

    } else {
      console.log('[WORKER-GATE] 비리더(web 인스턴스 모드) — 스케줄러/온체인 리스너 스킵');
    }
    // ── 워커 게이트 끝 ────────────────────────────────────────────

    // Start HTTP server
    // [v7.314] 자동 게임 운영 — GP 래플 + 파벌 예측배팅 자동 생성/정산 (어드민 불필요)
    try {
      require('./services/gamblingAuto').start();
    } catch (e) { console.warn('[gamblingAuto] start failed:', e.message); }

    // [v7.315] 자동 컨텐츠 운영 — 컨테스트 + 토너먼트 + 월드이벤트 자동 생성/정산 (어드민 불필요)
    try {
      require('./services/autoContent').start();
    } catch (e) { console.warn('[autoContent] start failed:', e.message); }

    const server = app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════╗`);
      console.log(`║  OCCUPY MARS — Server Running             ║`);
      console.log(`║  http://localhost:${PORT}                    ║`);
      console.log(`║  Admin: http://localhost:${PORT}/admin        ║`);
      console.log(`╚══════════════════════════════════════════╝\n`);
    });

    // WebSocket — Phase 2 실시간 battle frame broadcast (/ws/battle/{id})
    try {
      const { attachWsServer } = require('./wsServer');
      attachWsServer(server);
      console.log('[WS] Battle WebSocket server attached at /ws/battle/{id}');
    } catch (wsErr) {
      console.warn('[WS] attach failed:', wsErr.message);
    }

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
