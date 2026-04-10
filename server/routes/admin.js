const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, awardXP } = require('../db');

const router = express.Router();

// ── Security checks ──
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.ADMIN_SECRET) {
  if (isProduction) {
    throw new Error('[FATAL] ADMIN_SECRET is not set. Cannot start admin module in production.');
  }
  console.warn('[SECURITY] ADMIN_SECRET is not set — using default. Set a strong secret in production!');
}
if (isProduction && process.env.ADMIN_SECRET === 'admin1234') {
  throw new Error('[FATAL] ADMIN_SECRET is set to the insecure default "admin1234". Cannot start in production.');
}

// ── Admin auth middleware ──
function adminAuth(req, res, next) {
  // Method 1: x-admin-secret header
  const secret = req.headers['x-admin-secret'];
  const adminSecret = process.env.ADMIN_SECRET || (isProduction ? '' : 'admin1234');
  if (secret && adminSecret && secret === adminSecret) {
    req.adminAuth = 'secret';
    return next();
  }
  // Method 2: JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      if (decoded.role === 'admin') { req.adminAuth = 'jwt'; return next(); }
    } catch(e) {}
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Audit log helper ──
async function auditLog(req, action, target, details) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await pool.query(
      'INSERT INTO admin_audit_log (action, target, details, admin_auth, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [action, target, details ? JSON.stringify(details) : null, req.adminAuth || 'unknown', ip]
    );
  } catch(e) { console.error('[Audit] log error:', e.message); }
}

// ── Admin login (no auth required) ──
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return res.status(500).json({ error: 'Admin not configured' });
  if (password !== adminSecret) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, process.env.JWT_SECRET, { expiresIn: '4h' });
  res.json({ success: true, token });
});

// Apply auth middleware to all routes below
router.use(adminAuth);

// ══════════════════════════════════════════════════
//  GET /admin/api/stats — Dashboard overview
// ══════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [users, volume, revenue, active24h, totalClaims, totalPixels] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM users'),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM deposits'),
      pool.query("SELECT COALESCE(SUM(fee), 0) as total FROM transactions WHERE fee > 0"),
      pool.query("SELECT COUNT(*) as cnt FROM deposits WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query('SELECT COUNT(*) as cnt FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) as cnt FROM pixels WHERE owner IS NOT NULL'),
    ]);

    // Revenue breakdown
    const revBreakdown = await pool.query(`
      SELECT type,
        COALESCE(SUM(fee), 0) as fee_total,
        COALESCE(SUM(usdt_amount), 0) as volume_total,
        COUNT(*) as tx_count
      FROM transactions
      GROUP BY type
    `);

    // Contract balance (sum deposits - sum withdrawals)
    const balRes = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount),0) FROM deposits) -
        (SELECT COALESCE(SUM(usdt_amount),0) FROM transactions WHERE type IN ('withdraw','withdraw_all'))
        as contract_balance
    `);

    res.json({
      totalUsers: parseInt(users.rows[0].cnt),
      totalVolume: parseFloat(volume.rows[0].total),
      totalRevenue: parseFloat(revenue.rows[0].total),
      active24h: parseInt(active24h.rows[0].cnt),
      totalClaims: parseInt(totalClaims.rows[0].cnt),
      totalPixelsSold: parseInt(totalPixels.rows[0].cnt),
      contractBalance: parseFloat(balRes.rows[0].contract_balance),
      breakdown: revBreakdown.rows.map(r => ({
        type: r.type,
        feeTotal: parseFloat(r.fee_total),
        volumeTotal: parseFloat(r.volume_total),
        txCount: parseInt(r.tx_count)
      }))
    });
  } catch (e) {
    console.error('[Admin] stats error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/users — User list (paginated)
// ══════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').toLowerCase();
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const validSorts = ['created_at', 'usdt_balance', 'pp_balance', 'wallet_address'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE LOWER(wallet_address) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(nickname) LIKE $1';
      params.push(`%${search}%`);
    }

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM users ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    const usersRes = await pool.query(
      `SELECT u.wallet_address, u.email, u.nickname, u.usdt_balance, u.pp_balance, COALESCE(u.gp_balance,0) as gp_balance, u.created_at,
        (SELECT COUNT(*) FROM claims c WHERE c.owner = u.wallet_address AND c.deleted_at IS NULL) as claim_count,
        (SELECT COALESCE(SUM(amount),0) FROM deposits d WHERE d.wallet_address = u.wallet_address) as total_deposited
       FROM users u ${where}
       ORDER BY ${sortCol} ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      users: usersRes.rows.map(r => ({
        wallet: r.wallet_address,
        email: r.email || '',
        nickname: r.nickname || '',
        usdtBalance: parseFloat(r.usdt_balance),
        ppBalance: parseFloat(r.pp_balance),
        gpBalance: parseFloat(r.gp_balance),
        claimCount: parseInt(r.claim_count),
        totalDeposited: parseFloat(r.total_deposited),
        createdAt: r.created_at
      })),
      total, page, limit,
      pages: Math.ceil(total / limit)
    });
  } catch (e) {
    console.error('[Admin] users error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/users/:wallet — User detail
// ══════════════════════════════════════════════════
router.get('/users/:wallet', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wallet_address, email, nickname, usdt_balance, pp_balance, COALESCE(gp_balance,0) as gp_balance, referral_code, referred_by, created_at
       FROM users WHERE wallet_address = $1`,
      [req.params.wallet]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      wallet: u.wallet_address, email: u.email || '', nickname: u.nickname || '',
      usdtBalance: parseFloat(u.usdt_balance), ppBalance: parseFloat(u.pp_balance),
      gpBalance: parseFloat(u.gp_balance),
      referralCode: u.referral_code || '', referredBy: u.referred_by || '',
      createdAt: u.created_at
    });
  } catch (e) {
    console.error('[Admin] user detail error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/users/:wallet — Update user info
// ══════════════════════════════════════════════════
router.put('/users/:wallet', async (req, res) => {
  const { email, nickname, newPassword, usdtBalance, ppBalance, gpBalance } = req.body;
  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (nickname !== undefined) { updates.push(`nickname = $${idx++}`); params.push(nickname); }
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      updates.push(`password_hash = $${idx++}`); params.push(hash);
    }
    if (usdtBalance !== undefined) { updates.push(`usdt_balance = $${idx++}`); params.push(usdtBalance); }
    if (ppBalance !== undefined) { updates.push(`pp_balance = $${idx++}`); params.push(ppBalance); }
    if (gpBalance !== undefined) { updates.push(`gp_balance = $${idx++}`); params.push(gpBalance); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.wallet);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE wallet_address = $${idx}`,
      params
    );
    const fieldsUpdated = {};
    if (email !== undefined) fieldsUpdated.email = true;
    if (nickname !== undefined) fieldsUpdated.nickname = true;
    if (newPassword) fieldsUpdated.password = true;
    if (usdtBalance !== undefined) fieldsUpdated.usdtBalance = usdtBalance;
    if (ppBalance !== undefined) fieldsUpdated.ppBalance = ppBalance;
    if (gpBalance !== undefined) fieldsUpdated.gpBalance = gpBalance;

    await auditLog(req, 'user_update', req.params.wallet, { fieldsUpdated });
    console.log(`[Admin] Updated user ${req.params.wallet}: ${updates.join(', ')}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] user update error:', e.message);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/transactions — Transaction log
// ══════════════════════════════════════════════════
router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const offset = (page - 1) * limit;
    const type = req.query.type;

    let where = '';
    const params = [];
    if (type && ['deposit', 'claim', 'hijack', 'swap', 'withdraw', 'withdraw_all'].includes(type)) {
      where = 'WHERE type = $1';
      params.push(type);
    }

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM transactions ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    const txRes = await pool.query(
      `SELECT * FROM transactions ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      transactions: txRes.rows.map(r => ({
        id: r.id, type: r.type,
        fromWallet: r.from_wallet, toWallet: r.to_wallet,
        usdtAmount: parseFloat(r.usdt_amount),
        ppAmount: parseFloat(r.pp_amount),
        fee: parseFloat(r.fee),
        meta: r.meta,
        createdAt: r.created_at
      })),
      total, page, limit,
      pages: Math.ceil(total / limit)
    });
  } catch (e) {
    console.error('[Admin] transactions error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/revenue — Revenue over time
// ══════════════════════════════════════════════════
router.get('/revenue', async (req, res) => {
  try {
    const days = Math.min(90, parseInt(req.query.days) || 30);

    const daily = await pool.query(`
      SELECT DATE(created_at) as day,
        SUM(CASE WHEN type = 'claim' THEN fee ELSE 0 END) as claim_rev,
        SUM(CASE WHEN type = 'hijack' THEN fee ELSE 0 END) as hijack_rev,
        SUM(CASE WHEN type = 'swap' THEN fee ELSE 0 END) as swap_rev,
        SUM(CASE WHEN type IN ('withdraw','withdraw_all') THEN fee ELSE 0 END) as withdraw_rev,
        SUM(fee) as total_rev,
        COUNT(*) as tx_count
      FROM transactions
      WHERE created_at > NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `, [days]);

    res.json({
      days: daily.rows.map(r => ({
        date: r.day,
        claimRevenue: parseFloat(r.claim_rev),
        hijackRevenue: parseFloat(r.hijack_rev),
        swapRevenue: parseFloat(r.swap_rev),
        withdrawRevenue: parseFloat(r.withdraw_rev),
        totalRevenue: parseFloat(r.total_rev),
        txCount: parseInt(r.tx_count)
      }))
    });
  } catch (e) {
    console.error('[Admin] revenue error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/migrations — Migration status
// ══════════════════════════════════════════════════
router.get('/migrations', async (req, res) => {
  try {
    const applied = await pool.query('SELECT filename, applied_at FROM schema_migrations ORDER BY filename');
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', 'migrations');
    const allFiles = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
    const appliedSet = new Set(applied.rows.map(r => r.filename));
    const status = allFiles.map(f => ({
      file: f,
      applied: appliedSet.has(f),
      appliedAt: applied.rows.find(r => r.filename === f)?.applied_at || null
    }));
    res.json({ total: allFiles.length, applied: applied.rows.length, pending: allFiles.length - applied.rows.length, migrations: status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/settings — All game settings
// ══════════════════════════════════════════════════
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY category, key');
    res.json(result.rows.map(r => ({
      key: r.key, value: r.value, description: r.description,
      category: r.category, updatedAt: r.updated_at
    })));
  } catch (e) {
    console.error('[Admin] settings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/settings/:key — Update setting
// ══════════════════════════════════════════════════
router.put('/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Missing value' });

    const result = await pool.query(
      'UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [JSON.stringify(value), req.params.key]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Setting not found' });

    await auditLog(req, 'setting_update', req.params.key, { value });
    console.log(`[Admin] Setting updated: ${req.params.key} = ${JSON.stringify(value)}`);
    res.json({ success: true, key: req.params.key, value });
  } catch (e) {
    console.error('[Admin] setting update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/events — All events
// ══════════════════════════════════════════════════
router.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, type: r.type, config: r.config,
      startsAt: r.starts_at, endsAt: r.ends_at, active: r.active,
      createdAt: r.created_at
    })));
  } catch (e) {
    console.error('[Admin] events error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /admin/api/events — Create event
// ══════════════════════════════════════════════════
router.post('/events', async (req, res) => {
  try {
    const { name, type, config, startsAt, endsAt } = req.body;
    if (!name || !type || !startsAt || !endsAt) {
      return res.status(400).json({ error: 'Missing fields: name, type, startsAt, endsAt' });
    }

    const result = await pool.query(
      `INSERT INTO events (name, type, config, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, type, config || {}, startsAt, endsAt]
    );

    await auditLog(req, 'event_create', result.rows[0].id?.toString(), { name, type });
    console.log(`[Admin] Event created: ${name} (${type})`);
    res.json({ success: true, event: result.rows[0] });
  } catch (e) {
    console.error('[Admin] event create error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/events/:id — Update event
// ══════════════════════════════════════════════════
router.put('/events/:id', async (req, res) => {
  try {
    const { name, type, config, startsAt, endsAt, active } = req.body;
    const result = await pool.query(
      `UPDATE events SET
        name = COALESCE($1, name), type = COALESCE($2, type),
        config = COALESCE($3, config),
        starts_at = COALESCE($4, starts_at), ends_at = COALESCE($5, ends_at),
        active = COALESCE($6, active)
       WHERE id = $7 RETURNING *`,
      [name, type, config ? JSON.stringify(config) : null, startsAt, endsAt, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: result.rows[0] });
  } catch (e) {
    console.error('[Admin] event update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  DELETE /admin/api/events/:id — Delete event
// ══════════════════════════════════════════════════
router.delete('/events/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    await auditLog(req, 'event_delete', req.params.id, null);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] event delete error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/items — Game items
// ══════════════════════════════════════════════════
router.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM game_items ORDER BY category, name');
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] items error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /admin/api/items — Create game item
// ══════════════════════════════════════════════════
router.post('/items', async (req, res) => {
  try {
    const { slug, name, category, priceUsdt, pricePp, config } = req.body;
    if (!slug || !name || !category) return res.status(400).json({ error: 'Missing fields' });

    const result = await pool.query(
      `INSERT INTO game_items (slug, name, category, price_usdt, price_pp, config)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [slug, name, category, priceUsdt || 0, pricePp || 0, config || {}]
    );
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] item create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/items/:id — Update game item
// ══════════════════════════════════════════════════
router.put('/items/:id', async (req, res) => {
  try {
    const { name, priceUsdt, pricePp, config, active } = req.body;
    const result = await pool.query(
      `UPDATE game_items SET
        name = COALESCE($1, name), price_usdt = COALESCE($2, price_usdt),
        price_pp = COALESCE($3, price_pp), config = COALESCE($4, config),
        active = COALESCE($5, active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, priceUsdt, pricePp, config ? JSON.stringify(config) : null, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] item update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/referrals — Referral stats
// ══════════════════════════════════════════════════
router.get('/referrals', async (req, res) => {
  try {
    const [totalRefs, totalRewards, topReferrers, recentRewards] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM users WHERE referred_by IS NOT NULL'),
      pool.query('SELECT COALESCE(SUM(pp_amount), 0) as total, COUNT(*) as cnt FROM referral_rewards'),
      pool.query(`
        SELECT to_wallet, COUNT(*) as reward_count, SUM(pp_amount) as total_earned,
          (SELECT COUNT(*) FROM users WHERE referred_by = rr.to_wallet) as referral_count
        FROM referral_rewards rr
        GROUP BY to_wallet ORDER BY total_earned DESC LIMIT 10
      `),
      pool.query(`
        SELECT from_wallet, to_wallet, tier, pp_amount, trigger_type, created_at
        FROM referral_rewards ORDER BY created_at DESC LIMIT 20
      `)
    ]);

    // Tier breakdown
    const tierBreakdown = await pool.query(`
      SELECT tier, COUNT(*) as cnt, COALESCE(SUM(pp_amount), 0) as total
      FROM referral_rewards GROUP BY tier ORDER BY tier
    `);

    res.json({
      totalReferrals: parseInt(totalRefs.rows[0].cnt),
      totalRewardsDistributed: parseFloat(totalRewards.rows[0].total),
      totalRewardTxCount: parseInt(totalRewards.rows[0].cnt),
      tierBreakdown: tierBreakdown.rows.map(r => ({
        tier: r.tier, count: parseInt(r.cnt), total: parseFloat(r.total)
      })),
      topReferrers: topReferrers.rows.map(r => ({
        wallet: r.to_wallet,
        rewardCount: parseInt(r.reward_count),
        totalEarned: parseFloat(r.total_earned),
        referralCount: parseInt(r.referral_count)
      })),
      recentRewards: recentRewards.rows.map(r => ({
        from: r.from_wallet, to: r.to_wallet,
        tier: r.tier, ppAmount: parseFloat(r.pp_amount),
        triggerType: r.trigger_type,
        createdAt: r.created_at
      }))
    });
  } catch (e) {
    console.error('[Admin] referrals error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/errors — Client error log (paginated)
// ══════════════════════════════════════════════════
router.get('/errors', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    const countRes = await pool.query('SELECT COUNT(*) as cnt FROM client_errors');
    const total = parseInt(countRes.rows[0].cnt);

    const result = await pool.query(
      `SELECT id, message, source, line, stack, user_agent, url, ip_address, created_at
       FROM client_errors
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      errors: result.rows.map(r => ({
        id: r.id,
        message: r.message,
        source: r.source,
        line: r.line,
        stack: r.stack,
        userAgent: r.user_agent,
        url: r.url,
        ip: r.ip_address,
        createdAt: r.created_at
      })),
      total, limit, offset
    });
  } catch (e) {
    console.error('[Admin] errors list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  DELETE /admin/api/errors — Clear all client errors
// ══════════════════════════════════════════════════
router.delete('/errors', async (req, res) => {
  try {
    await pool.query('DELETE FROM client_errors');
    console.log('[Admin] All client errors cleared');
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] clear errors error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/sectors — list all sectors with stats
// ══════════════════════════════════════════════════
router.get('/sectors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS occupied_count,
        (SELECT COUNT(DISTINCT p.owner) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS unique_owners
      FROM sectors s ORDER BY s.id
    `);
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] sectors list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/sectors/:id — update sector settings
// ══════════════════════════════════════════════════
router.put('/sectors/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, tier, base_price, governor_wallet } = req.body;

    const updates = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); vals.push(name); }
    if (tier !== undefined) { updates.push(`tier = $${idx++}`); vals.push(tier); }
    if (base_price !== undefined) { updates.push(`base_price = $${idx++}`); vals.push(base_price); }
    if (governor_wallet !== undefined) { updates.push(`governor_wallet = $${idx++}`); vals.push(governor_wallet || null); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    await pool.query(`UPDATE sectors SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    await auditLog(req, 'sector_update', `sector:${id}`, req.body);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] sector update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /admin/api/ranks — list rank definitions
// ══════════════════════════════════════════════════
router.get('/ranks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rank_definitions ORDER BY level');
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] ranks list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /admin/api/ranks/:level — update a rank definition
// ══════════════════════════════════════════════════
router.put('/ranks/:level', async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    const { name, required_xp, reward_pp } = req.body;

    const updates = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); vals.push(name); }
    if (required_xp !== undefined) { updates.push(`required_xp = $${idx++}`); vals.push(required_xp); }
    if (reward_pp !== undefined) { updates.push(`reward_pp = $${idx++}`); vals.push(reward_pp); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(level);
    await pool.query(`UPDATE rank_definitions SET ${updates.join(', ')} WHERE level = $${idx}`, vals);
    await auditLog(req, 'rank_update', `rank:${level}`, req.body);
    res.json({ success: true });
  } catch (e) {
    console.error('[Admin] rank update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════
//  Quest Reward Pool Management
// ══════════════════════════════════

// GET /admin/quest-pool — View pool status
router.get('/quest-pool', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM quest_reward_pool WHERE id = 1');
    res.json(r.rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/quest-pool/fund — Add PP to the pool
router.post('/quest-pool/fund', async (req, res) => {
  try {
    const { amount } = req.body;
    const pp = parseFloat(amount);
    if (!pp || pp <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await pool.query(`
      UPDATE quest_reward_pool SET
        balance = balance + $1,
        total_funded = total_funded + $1,
        updated_at = NOW()
      WHERE id = 1
    `, [pp]);

    const r = await pool.query('SELECT * FROM quest_reward_pool WHERE id = 1');
    res.json({ success: true, pool: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/quest-pool/set — Set pool balance directly
router.post('/quest-pool/set', async (req, res) => {
  try {
    const { balance } = req.body;
    const val = parseFloat(balance);
    if (val === undefined || val < 0) return res.status(400).json({ error: 'Invalid balance' });

    await pool.query('UPDATE quest_reward_pool SET balance = $1, updated_at = NOW() WHERE id = 1', [val]);

    const r = await pool.query('SELECT * FROM quest_reward_pool WHERE id = 1');
    res.json({ success: true, pool: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /admin/api/recalc-ranks — Recalculate all user ranks with breakthrough checks ──
router.post('/recalc-ranks', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all rank definitions with breakthrough info
    const rankRes = await client.query('SELECT * FROM rank_definitions ORDER BY level ASC');
    const ranks = rankRes.rows;

    // Get all users
    const usersRes = await client.query('SELECT wallet_address, xp, rank_level, created_at FROM users');
    const results = [];

    for (const user of usersRes.rows) {
      const w = user.wallet_address;
      let newLevel = 1;

      for (const rank of ranks) {
        if (rank.required_xp > user.xp) break; // Not enough XP

        if (rank.breakthrough) {
          // Check if already unlocked
          const unlocked = await client.query(
            'SELECT 1 FROM user_breakthroughs WHERE wallet_address = $1 AND level = $2', [w, rank.level]
          );
          if (!unlocked.rows.length) {
            // Check conditions
            const cond = rank.breakthrough_condition;
            const conditions = cond.conditions || [cond];
            let allMet = true;

            for (const c of conditions) {
              let met = false;
              if (c.type === 'pixels') {
                const r = await client.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner = $1', [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else if (c.type === 'sectors') {
                const r = await client.query('SELECT COUNT(DISTINCT sector_id) AS cnt FROM pixels WHERE owner = $1', [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else if (c.type === 'quests') {
                const r = await client.query("SELECT COUNT(*) AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else if (c.type === 'deposit') {
                const r = await client.query('SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE wallet_address = $1', [w]);
                met = parseFloat(r.rows[0].total) >= c.min;
              } else if (c.type === 'play_days') {
                const days = (Date.now() - new Date(user.created_at).getTime()) / (1000*60*60*24);
                met = days >= c.min;
              } else if (c.type === 'hijacks') {
                const r = await client.query("SELECT COUNT(*) AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else if (c.type === 'games_played') {
                const r = await client.query("SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt", [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else if (c.type === 'referrals') {
                const r = await client.query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [w]);
                met = parseInt(r.rows[0].cnt) >= c.min;
              } else {
                met = true;
              }
              if (!met) { allMet = false; break; }
            }

            if (allMet) {
              await client.query('INSERT INTO user_breakthroughs (wallet_address, level) VALUES ($1, $2) ON CONFLICT DO NOTHING', [w, rank.level]);
            } else {
              break; // Blocked at this gate
            }
          }
        }
        newLevel = rank.level;
      }

      if (newLevel !== user.rank_level) {
        await client.query('UPDATE users SET rank_level = $1 WHERE wallet_address = $2', [newLevel, w]);
      }
      results.push({ wallet: w.slice(0, 10) + '...', oldRank: user.rank_level, newRank: newLevel, xp: user.xp });
    }

    await client.query('COMMIT');
    res.json({ success: true, results });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Admin] recalc-ranks error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /admin/api/claims — List claims (paginated, searchable) ──
router.get('/claims', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();

    let where = 'WHERE c.deleted_at IS NULL';
    const params = [];
    if (search) {
      params.push('%' + search + '%');
      where += ` AND c.owner ILIKE $${params.length}`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM claims c ${where}`, params
    );
    const total = parseInt(countRes.rows[0].cnt);

    const claimsRes = await pool.query(
      `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
              c.image_url, c.original_image_url, c.link_url, c.total_paid, c.created_at
       FROM claims c ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const claims = claimsRes.rows.map(r => ({
      id: r.id,
      owner: r.owner,
      lat: parseFloat(r.center_lat),
      lng: parseFloat(r.center_lng),
      width: r.width,
      height: r.height,
      image_url: r.image_url,
      total_cost: parseFloat(r.total_paid) || 0,
      pixel_count: r.width * r.height,
      created_at: r.created_at
    }));

    res.json({ claims, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /admin/api/claims/:id — Delete a claim and its pixels ──
router.delete('/claims/:id', async (req, res) => {
  const claimId = parseInt(req.params.id);
  if (!claimId) return res.status(400).json({ error: 'Invalid claim ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get claim info
    const claimRes = await client.query(
      'SELECT id, owner, center_lat, center_lng, width, height FROM claims WHERE id = $1 AND deleted_at IS NULL',
      [claimId]
    );
    if (!claimRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }

    const claim = claimRes.rows[0];

    // Remove pixels owned by this claim
    const lat = parseFloat(claim.center_lat);
    const lng = parseFloat(claim.center_lng);
    const w = parseInt(claim.width) || 1;
    const h = parseInt(claim.height) || 1;
    const step = 0.1;

    let pixelsRemoved = 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const plat = Math.round((lat + dy * step) * 10) / 10;
        const plng = Math.round((lng + dx * step) * 10) / 10;
        const delRes = await client.query(
          'DELETE FROM pixels WHERE lat = $1 AND lng = $2 AND owner = $3',
          [plat, plng, claim.owner]
        );
        pixelsRemoved += delRes.rowCount;
      }
    }

    // Soft-delete the claim
    await client.query(
      'UPDATE claims SET deleted_at = NOW() WHERE id = $1',
      [claimId]
    );

    await client.query('COMMIT');
    console.log(`[Admin] Deleted claim #${claimId} (${pixelsRemoved} pixels removed)`);
    res.json({ success: true, pixelsRemoved });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Admin] Delete claim error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  RESET CLAIMS + NPC DEPLOYMENT
// ══════════════════════════════════════════════════

// POST /admin/api/reset-claims — Delete all claims & pixels, optionally deploy NPCs
router.post('/reset-claims', async (req, res) => {
  const { keepUsers = true, deployNpcs = true } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete all pixels
    const pxDel = await client.query('DELETE FROM pixels');

    // 2. Delete shields linked to claims
    await client.query('DELETE FROM pixel_shields');

    // 3. Soft-delete all claims (or hard-delete)
    const clDel = await client.query("UPDATE claims SET deleted_at = NOW() WHERE deleted_at IS NULL");

    let npcCount = 0;

    // 4. Deploy NPCs if requested
    if (deployNpcs) {
      const GRID_SIZE = 0.22;
      const NPC_TERRITORIES = [
        // Major landmarks
        { name: 'olympus_mons', lat: 18.65, lng: -133.8, w: 30, h: 30 },
        { name: 'valles_marineris', lat: -14.0, lng: -59.0, w: 40, h: 15 },
        { name: 'elysium_mons', lat: 25.02, lng: 147.2, w: 25, h: 25 },
        { name: 'hellas_basin', lat: -42.4, lng: 70.5, w: 35, h: 30 },
        { name: 'tharsis_ridge', lat: -1.0, lng: -112.0, w: 25, h: 20 },
        { name: 'syrtis_major', lat: 8.4, lng: 69.5, w: 20, h: 25 },
        { name: 'arcadia_plains', lat: 47.2, lng: -176.0, w: 30, h: 20 },
        { name: 'chryse_landing', lat: 22.5, lng: -49.8, w: 20, h: 20 },
        { name: 'utopia_basin', lat: 49.7, lng: 118.0, w: 30, h: 25 },
        { name: 'argyre_crater', lat: -49.7, lng: -43.0, w: 25, h: 25 },
        { name: 'isidis_plains', lat: 12.9, lng: 87.0, w: 20, h: 20 },
        { name: 'gale_crater', lat: -5.4, lng: 137.8, w: 15, h: 15 },
        { name: 'jezero_delta', lat: 18.4, lng: 77.7, w: 15, h: 15 },
        { name: 'amazonis_flats', lat: 0.0, lng: -160.0, w: 25, h: 20 },
        { name: 'noachis_terra', lat: -45.0, lng: -10.0, w: 25, h: 20 },
        { name: 'arabia_terra', lat: 20.0, lng: 5.0, w: 20, h: 25 },
        { name: 'acidalia_sea', lat: 46.7, lng: -22.0, w: 25, h: 20 },
        { name: 'cimmeria_ridge', lat: -35.0, lng: 145.0, w: 20, h: 20 },
        { name: 'tyrrhena_mesa', lat: -15.0, lng: 105.0, w: 20, h: 15 },
        { name: 'solis_planum', lat: -25.0, lng: -85.0, w: 20, h: 20 },
      ];

      for (const npc of NPC_TERRITORIES) {
        const owner = '0xnpc_' + npc.name;

        // Insert claim
        const claimRes = await client.query(
          `INSERT INTO claims (owner, center_lat, center_lng, width, height, total_paid)
           VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
          [owner, npc.lat, npc.lng, npc.w, npc.h]
        );
        const claimId = claimRes.rows[0].id;

        // Insert pixels
        const halfW = (npc.w * GRID_SIZE) / 2;
        const halfH = (npc.h * GRID_SIZE) / 2;
        const startLat = Math.ceil((npc.lat - halfH) / GRID_SIZE) * GRID_SIZE;
        const startLng = Math.ceil((npc.lng - halfW) / GRID_SIZE) * GRID_SIZE;
        const maxLat = npc.lat + halfH;
        const maxLng = npc.lng + halfW;

        const pixelValues = [];
        const pixelParams = [];
        let pi = 0;
        for (let plat = startLat; plat < maxLat; plat += GRID_SIZE) {
          for (let plng = startLng; plng < maxLng; plng += GRID_SIZE) {
            const sLat = Math.round(plat * 100) / 100;
            const sLng = Math.round(plng * 100) / 100;
            if (sLat >= -70 && sLat <= 70) {
              pixelValues.push(`($${pi*4+1}, $${pi*4+2}, $${pi*4+3}, $${pi*4+4})`);
              pixelParams.push(sLat, sLng, owner, 0);
              pi++;
            }
          }
        }
        if (pixelValues.length > 0) {
          await client.query(
            `INSERT INTO pixels (lat, lng, owner, price) VALUES ${pixelValues.join(',')}
             ON CONFLICT (lat, lng) DO UPDATE SET owner = EXCLUDED.owner, price = EXCLUDED.price`,
            pixelParams
          );
        }
        npcCount++;
      }
    }

    // 5. Reset governance: clear governors/commanders since all pixels are gone
    await client.query("UPDATE sectors SET governor_wallet = NULL, governor_since = NULL, vice_governor_wallet = NULL, vice_governor_since = NULL, sector_pool_gp = 0, buff_fund_gp = 0");
    await client.query("DELETE FROM governance_positions");
    await client.query("DELETE FROM governance_history");
    await client.query("DELETE FROM sector_buffs WHERE active = true");
    await client.query("UPDATE commander SET commander_wallet = NULL, vice_commander_wallet = NULL, commander_pool_gp = 0");

    await client.query('COMMIT');
    console.log(`[Admin] Reset: ${clDel.rowCount} claims deleted, ${pxDel.rowCount} pixels removed, ${npcCount} NPCs deployed, governance cleared`);
    res.json({
      success: true,
      claimsDeleted: clDel.rowCount,
      pixelsRemoved: pxDel.rowCount,
      npcsDeployed: npcCount
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Admin] Reset error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  ITEM SHOP MANAGEMENT
// ══════════════════════════════════════════════════

// GET /admin/api/shop-items — List all shop items (item_types)
router.get('/shop-items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM item_types ORDER BY category, code');
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] shop-items error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /admin/api/shop-items/:id — Update shop item
router.put('/shop-items/:id', async (req, res) => {
  try {
    const { name, description, price_pp, price_usdt, duration_hours, effect_value, max_stack, active } = req.body;
    const result = await pool.query(
      `UPDATE item_types SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price_pp = COALESCE($3, price_pp), price_usdt = COALESCE($4, price_usdt),
        duration_hours = COALESCE($5, duration_hours), effect_value = COALESCE($6, effect_value),
        max_stack = COALESCE($7, max_stack), active = COALESCE($8, active)
       WHERE id = $9 RETURNING *`,
      [name, description, price_pp, price_usdt, duration_hours, effect_value, max_stack, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] shop-item update error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /admin/api/shop-items — Create new shop item
router.post('/shop-items', async (req, res) => {
  try {
    const { code, name, description, category, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack } = req.body;
    if (!code || !name || !category) return res.status(400).json({ error: 'code, name, category required' });
    const result = await pool.query(
      `INSERT INTO item_types (code, name, description, category, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code, name, description || '', category, price_pp || 0, price_usdt || 0, duration_hours || 0, effect_value || 0, icon || '', max_stack || 5]
    );
    res.json({ success: true, item: result.rows[0] });
  } catch (e) {
    console.error('[Admin] shop-item create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/battles — List recent battles
router.get('/battles', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT b.*,
        (SELECT nickname FROM users WHERE wallet_address = b.attacker) as attacker_name,
        (SELECT nickname FROM users WHERE wallet_address = b.defender) as defender_name
       FROM battles b ORDER BY b.created_at DESC LIMIT $1`, [limit]
    );
    const stats = await pool.query(
      `SELECT count(*) as total, count(CASE WHEN success THEN 1 END) as wins,
        COALESCE(SUM(pixels_won),0) as total_pixels_won,
        COALESCE(SUM(platform_fee),0) as total_fees
       FROM battles`
    );
    res.json({ battles: result.rows, stats: stats.rows[0] });
  } catch (e) {
    console.error('[Admin] battles error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /admin/api/shields — List active shields
router.get('/shields', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, c.center_lat, c.center_lng, c.width, c.height
       FROM pixel_shields ps JOIN claims c ON ps.claim_id = c.id
       WHERE ps.expires_at > NOW()
       ORDER BY ps.expires_at ASC LIMIT 100`
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] shields error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /admin/api/shields/:id — Remove a shield
router.delete('/shields/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pixel_shields WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /admin/api/shop-stats — Item shop statistics
router.get('/shop-stats', async (req, res) => {
  try {
    const [purchases, usage, topItems] = await Promise.all([
      pool.query('SELECT count(*) as total FROM item_usage_log'),
      pool.query(`SELECT it.name, it.code, count(*) as uses FROM item_usage_log iul
        JOIN item_types it ON iul.item_type_id = it.id GROUP BY it.name, it.code ORDER BY uses DESC LIMIT 10`),
      pool.query(`SELECT it.code, it.name, COALESCE(SUM(ui.quantity),0) as total_owned
        FROM item_types it LEFT JOIN user_items ui ON ui.item_type_id = it.id
        GROUP BY it.code, it.name ORDER BY total_owned DESC`)
    ]);
    res.json({
      totalUsages: parseInt(purchases.rows[0].total),
      topUsed: usage.rows,
      ownership: topItems.rows
    });
  } catch (e) {
    console.error('[Admin] shop-stats error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════
//  Governance Admin Endpoints
// ═══════════════════════════════════════════════════════

// GET /admin/api/governance — all governance data for admin panel
router.get('/governance', adminAuth, async (req, res) => {
  try {
    const { getCommanderInfo, getActiveGovEvents, getActiveSectorBuffs } = require('../services/governance');

    // Commander info
    const cmdInfo = await getCommanderInfo();

    // Active events
    const events = await getActiveGovEvents();

    // All sectors with governance data
    const sectorsRes = await pool.query(
      `SELECT s.id, s.name, s.tier, s.tax_rate, s.governor_wallet, s.vice_governor_wallet,
              s.announcement, s.sector_pool_gp, s.buff_fund_gp,
              u1.nickname AS governor_name, u2.nickname AS vice_name
       FROM sectors s
       LEFT JOIN users u1 ON u1.wallet_address = s.governor_wallet
       LEFT JOIN users u2 ON u2.wallet_address = s.vice_governor_wallet
       ORDER BY s.tier, s.name`
    );
    const sectors = [];
    for (const row of sectorsRes.rows) {
      const buffs = await getActiveSectorBuffs(row.id);
      sectors.push({ ...row, activeBuffs: buffs });
    }

    // Active bounties
    const bountiesRes = await pool.query(
      `SELECT id, placed_by, target_wallet, pp_reward, reason, expires_at, created_at
       FROM bounties WHERE status = 'active' ORDER BY pp_reward DESC`
    );

    res.json({
      commander: cmdInfo,
      events,
      sectors,
      bounties: bountiesRes.rows
    });
  } catch (e) {
    console.error('[Admin] governance error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /admin/api/governance/transactions — governance transaction log
router.get('/governance/transactions', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, from_role, to_role, sector_id, wallet, gp_amount, meta, created_at
       FROM governance_transactions ORDER BY created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[Admin] gov tx error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /admin/api/rocket-trigger — manually trigger a rocket drop
router.post('/rocket-trigger', async (req, res) => {
  try {
    let rocketService;
    try { rocketService = require('../services/rocket'); } catch(_e) {}
    if (!rocketService) return res.status(503).json({ error: 'Rocket service not available' });
    const result = await rocketService.scheduleRocketEvent(null);
    if (result && result.error) return res.status(400).json(result);
    res.json({ success: true, event: result });
  } catch (e) {
    console.error('[ADMIN] rocket trigger error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//  LORE MANAGEMENT (Loading Lore + Crawl Story)
// ═══════════════════════════════════════════════

// GET /admin/api/lore — list all loading lore entries
router.get('/lore', adminAuth, async (req, res) => {
  try {
    const lore = await pool.query('SELECT * FROM loading_lore ORDER BY sort_order ASC, id ASC');
    const crawl = await pool.query('SELECT * FROM lore_crawl ORDER BY lang ASC');
    res.json({ lore: lore.rows, crawl: crawl.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/lore — create new lore entry
router.post('/lore', adminAuth, async (req, res) => {
  try {
    const { year, text_en, text_ko, text_ja, text_zh, category, sort_order, active } = req.body;
    if (!text_en) return res.status(400).json({ error: 'text_en is required' });
    const r = await pool.query(
      `INSERT INTO loading_lore (year, text_en, text_ko, text_ja, text_zh, category, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [year || 'TIP', text_en, text_ko || null, text_ja || null, text_zh || null, category || 'timeline', sort_order || 0, active !== false]
    );
    await auditLog(req, 'lore_create', 'loading_lore', { id: r.rows[0].id, year });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /admin/api/lore/:id — update lore entry
router.put('/lore/:id', adminAuth, async (req, res) => {
  try {
    const { year, text_en, text_ko, text_ja, text_zh, category, sort_order, active } = req.body;
    const r = await pool.query(
      `UPDATE loading_lore SET year=COALESCE($1,year), text_en=COALESCE($2,text_en),
       text_ko=COALESCE($3,text_ko), text_ja=COALESCE($4,text_ja), text_zh=COALESCE($5,text_zh),
       category=COALESCE($6,category), sort_order=COALESCE($7,sort_order), active=COALESCE($8,active)
       WHERE id=$9 RETURNING *`,
      [year, text_en, text_ko, text_ja, text_zh, category, sort_order, active, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    await auditLog(req, 'lore_update', 'loading_lore', { id: req.params.id });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/lore/:id — delete lore entry
router.delete('/lore/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM loading_lore WHERE id=$1', [req.params.id]);
    await auditLog(req, 'lore_delete', 'loading_lore', { id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /admin/api/lore-crawl/:lang — update crawl story for a language
router.put('/lore-crawl/:lang', adminAuth, async (req, res) => {
  try {
    const { era_text, title_text, body_html, tagline, close_text } = req.body;
    const r = await pool.query(
      `INSERT INTO lore_crawl (lang, era_text, title_text, body_html, tagline, close_text, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (lang) DO UPDATE SET era_text=COALESCE($2,lore_crawl.era_text),
       title_text=COALESCE($3,lore_crawl.title_text), body_html=COALESCE($4,lore_crawl.body_html),
       tagline=COALESCE($5,lore_crawl.tagline), close_text=COALESCE($6,lore_crawl.close_text),
       updated_at=NOW() RETURNING *`,
      [req.params.lang, era_text, title_text, body_html, tagline, close_text]
    );
    await auditLog(req, 'lore_crawl_update', 'lore_crawl', { lang: req.params.lang });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════
//  GUILD MANAGEMENT
// ══════════════════════════════════════════════════

// GET /admin/api/guilds — list all guilds
router.get('/guilds', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT g.*,
        (SELECT COUNT(*) FROM guild_members gm WHERE gm.guild_id = g.id) as member_count,
        (SELECT COUNT(*) FROM claims c WHERE c.owner IN (SELECT wallet FROM guild_members gm2 WHERE gm2.guild_id = g.id) AND c.deleted_at IS NULL) as pixel_count
       FROM guilds g ORDER BY g.created_at DESC`
    );
    res.json({ guilds: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/guilds/:id — force disband a guild
router.delete('/guilds/:id', adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET guild_id = NULL WHERE guild_id = $1', [req.params.id]);
    await client.query('DELETE FROM guild_invites WHERE guild_id = $1', [req.params.id]);
    await client.query('DELETE FROM guild_members WHERE guild_id = $1', [req.params.id]);
    await client.query('DELETE FROM guilds WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    await auditLog(req, 'guild_disband', 'guild', { guildId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ══════════════════════════════════════════════════
//  SEASON MANAGEMENT
// ══════════════════════════════════════════════════

// GET /admin/api/seasons — list all seasons
router.get('/seasons', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM seasons ORDER BY id DESC');
    res.json({ seasons: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/seasons — create a new season
router.post('/seasons', adminAuth, async (req, res) => {
  try {
    const { name, theme, starts_at, ends_at, rewards_json, visual_tint, active_categories } = req.body;
    const r = await pool.query(
      `INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, visual_tint, active_categories)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7) RETURNING *`,
      [name, theme || 'volcanic', starts_at, ends_at, rewards_json || '[]', visual_tint || '#ff4500',
       active_categories || '["overall","territory","mining","combat","explorer","active"]']
    );
    await auditLog(req, 'season_create', 'season', { seasonId: r.rows[0].id });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /admin/api/seasons/:id — update season (activate/deactivate, edit dates, etc.)
router.put('/seasons/:id', adminAuth, async (req, res) => {
  try {
    const { name, theme, starts_at, ends_at, active, rewards_json, visual_tint, active_categories } = req.body;
    // If activating this season, deactivate all others first
    if (active === true) {
      await pool.query('UPDATE seasons SET active = false WHERE active = true');
    }
    const r = await pool.query(
      `UPDATE seasons SET
        name = COALESCE($1, name), theme = COALESCE($2, theme),
        starts_at = COALESCE($3, starts_at), ends_at = COALESCE($4, ends_at),
        active = COALESCE($5, active), rewards_json = COALESCE($6, rewards_json),
        visual_tint = COALESCE($7, visual_tint),
        active_categories = COALESCE($8, active_categories)
       WHERE id = $9 RETURNING *`,
      [name, theme, starts_at, ends_at, active, rewards_json, visual_tint, active_categories, req.params.id]
    );
    await auditLog(req, 'season_update', 'season', { seasonId: req.params.id, active });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/seasons/:id — delete a season
router.delete('/seasons/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM season_rewards WHERE season_id = $1', [req.params.id]);
    await pool.query('DELETE FROM season_scores WHERE season_id = $1', [req.params.id]);
    await pool.query('DELETE FROM seasons WHERE id = $1', [req.params.id]);
    await auditLog(req, 'season_delete', 'season', { seasonId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/api/seasons/:id/scores — season leaderboard
router.get('/seasons/:id/scores', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ss.*, u.nickname FROM season_scores ss
       LEFT JOIN users u ON u.wallet_address = ss.wallet
       WHERE ss.season_id = $1 ORDER BY ss.score DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ scores: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════
//  GP BULK OPERATIONS
// ══════════════════════════════════════════════════

// POST /admin/api/gp/grant — grant GP to a user
router.post('/gp/grant', adminAuth, async (req, res) => {
  try {
    const { wallet, amount, reason } = req.body;
    if (!wallet || !amount) return res.status(400).json({ error: 'Missing wallet or amount' });
    await pool.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2',
      [amount, wallet.toLowerCase()]
    );
    await auditLog(req, 'gp_grant', wallet, { amount, reason });
    res.json({ success: true, amount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/gp/grant-all — grant GP to all users
router.post('/gp/grant-all', adminAuth, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount) return res.status(400).json({ error: 'Missing amount' });
    const r = await pool.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1',
      [amount]
    );
    await auditLog(req, 'gp_grant_all', 'all_users', { amount, reason, affected: r.rowCount });
    res.json({ success: true, affected: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/api/gp/stats — GP economy overview
router.get('/gp/stats', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
        COALESCE(SUM(gp_balance), 0) as total_gp,
        COALESCE(AVG(gp_balance), 0) as avg_gp,
        COALESCE(MAX(gp_balance), 0) as max_gp,
        COUNT(*) FILTER (WHERE gp_balance > 0) as users_with_gp
       FROM users`
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════
//  POI DROP TABLE MANAGEMENT
// ══════════════════════════════════════

router.get('/poi-drops', adminAuth, async (req, res) => {
  try {
    const drops = await pool.query('SELECT * FROM poi_drop_table ORDER BY weight DESC');
    // Also get POI stats
    const stats = await pool.query(`
      SELECT reward_type, COUNT(*) as cnt, ROUND(AVG(reward_amount)::numeric,2) as avg_amt
      FROM exploration_pois WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY reward_type ORDER BY cnt DESC`);
    const active = await pool.query('SELECT COUNT(*) as cnt FROM exploration_pois WHERE active = true AND expires_at > NOW()');
    res.json({ drops: drops.rows, stats: stats.rows, activePOIs: parseInt(active.rows[0].cnt) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/poi-drops', adminAuth, async (req, res) => {
  try {
    const { itemCode, itemName, icon, weight, minQty, maxQty } = req.body;
    if (!itemCode || !itemName) return res.status(400).json({ error: 'itemCode and itemName required' });
    const r = await pool.query(
      `INSERT INTO poi_drop_table (item_code, item_name, icon, weight, min_qty, max_qty)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [itemCode, itemName, icon || '📦', weight || 10, minQty || 1, maxQty || 1]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/poi-drops/:id', adminAuth, async (req, res) => {
  try {
    const { weight, minQty, maxQty, active } = req.body;
    const r = await pool.query(
      `UPDATE poi_drop_table SET weight = COALESCE($1, weight), min_qty = COALESCE($2, min_qty),
       max_qty = COALESCE($3, max_qty), active = COALESCE($4, active) WHERE id = $5 RETURNING *`,
      [weight, minQty, maxQty, active, req.params.id]
    );
    res.json(r.rows[0] || { error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/poi-drops/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM poi_drop_table WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
