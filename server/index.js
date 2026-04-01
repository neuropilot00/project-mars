require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./db');
const { init: initSigner } = require('./services/signer');
const { startListeners } = require('./services/chain');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/admin/api', adminRoutes);

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
    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════╗`);
      console.log(`║  OCCUPY MARS — Server Running             ║`);
      console.log(`║  http://localhost:${PORT}                    ║`);
      console.log(`║  Admin: http://localhost:${PORT}/admin        ║`);
      console.log(`╚══════════════════════════════════════════╝\n`);
    });
  } catch (e) {
    console.error('[Server] Failed to start:', e.message);
    process.exit(1);
  }
}

start();
