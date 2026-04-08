// Load environment-specific .env file, fallback to .env
const _path = require('path');
const _envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: _path.join(__dirname, '..', _envFile) });
// Fallback: also load .env for any unset vars
require('dotenv').config({ path: _path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

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

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.trycloudflare.com https://*.railway.app https://*.infura.io https://*.alchemy.com wss://*; font-src 'self' data:;");
  next();
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
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin/api', adminRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/governance', governanceRoutes);

// ── Static files (index.html, admin.html, assets) ──
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

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ──
async function start() {
  try {
    // Initialize database schema
    await initDB();

    // Initialize withdrawal signer
    initSigner();

    // Start on-chain event listeners
    await startListeners();

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
