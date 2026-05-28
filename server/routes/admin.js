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
      // Split real users vs NPCs so the dashboard doesn't overstate activity.
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE wallet_address NOT LIKE '0xnpc_%') AS real_cnt,
          COUNT(*) FILTER (WHERE wallet_address LIKE '0xnpc_%') AS npc_cnt,
          COUNT(*) AS all_cnt
        FROM users
      `),
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
        (
          SELECT COALESCE(SUM(
            CASE
              WHEN type = 'withdraw_all' THEN COALESCE(NULLIF(meta->>'totalOut','')::numeric, usdt_amount)
              ELSE usdt_amount
            END
          ),0)
          FROM transactions
          WHERE type IN ('withdraw','withdraw_all')
        )
        as contract_balance
    `);

    res.json({
      totalUsers: parseInt(users.rows[0].all_cnt),
      realUsers: parseInt(users.rows[0].real_cnt),
      npcUsers: parseInt(users.rows[0].npc_cnt),
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
    // kind: 'all' (default) | 'real' (exclude NPCs) | 'npc' (only NPCs)
    // NPCs follow the project convention: wallet_address LIKE '0xnpc_%'
    const kind = (req.query.kind || 'all').toLowerCase();

    const validSorts = ['created_at', 'usdt_balance', 'pp_balance', 'wallet_address'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';

    const clauses = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`(LOWER(wallet_address) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(nickname) LIKE $${params.length})`);
    }
    if (kind === 'real') clauses.push(`wallet_address NOT LIKE '0xnpc_%'`);
    else if (kind === 'npc') clauses.push(`wallet_address LIKE '0xnpc_%'`);
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM users ${where}`, params);
    const total = parseInt(countRes.rows[0].cnt);

    // Counts for the filter badges (always return all three so UI can show totals)
    const kindCounts = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE wallet_address NOT LIKE '0xnpc_%') AS real_cnt,
         COUNT(*) FILTER (WHERE wallet_address LIKE '0xnpc_%') AS npc_cnt,
         COUNT(*) AS all_cnt
       FROM users`
    );

    const usersRes = await pool.query(
      `SELECT u.wallet_address, u.email, u.nickname, u.usdt_balance, u.pp_balance, COALESCE(u.gp_balance,0) as gp_balance, u.created_at, u.faction_code,
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
        wallet_address: r.wallet_address,
        email: r.email || '',
        nickname: r.nickname || '',
        faction_code: r.faction_code || null,
        isNpc: r.wallet_address.startsWith('0xnpc_'),
        usdtBalance: parseFloat(r.usdt_balance),
        ppBalance: parseFloat(r.pp_balance),
        gpBalance: parseFloat(r.gp_balance),
        claimCount: parseInt(r.claim_count),
        totalDeposited: parseFloat(r.total_deposited),
        createdAt: r.created_at
      })),
      counts: {
        all: parseInt(kindCounts.rows[0].all_cnt),
        real: parseInt(kindCounts.rows[0].real_cnt),
        npc: parseInt(kindCounts.rows[0].npc_cnt)
      },
      kind,
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
      `SELECT t.*,
              u_from.nickname AS from_nickname,
              u_to.nickname AS to_nickname
         FROM transactions t
         LEFT JOIN users u_from ON u_from.wallet_address = t.from_wallet
         LEFT JOIN users u_to   ON u_to.wallet_address   = t.to_wallet
         ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      transactions: txRes.rows.map(r => ({
        id: r.id, type: r.type,
        fromWallet: r.from_wallet, toWallet: r.to_wallet,
        fromNickname: r.from_nickname || null,
        toNickname: r.to_nickname || null,
        fromIsNpc: r.from_wallet ? r.from_wallet.startsWith('0xnpc_') : false,
        toIsNpc: r.to_wallet ? r.to_wallet.startsWith('0xnpc_') : false,
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

    // ── Sync zone entry_min_level to sectors table ──
    const k = req.params.key;
    let _touchedSectors = false;
    if (k === 'sector_core_min_level') {
      const lv = parseInt(value) || 0;
      if (lv > 0) { await pool.query(`UPDATE sectors SET entry_min_level = $1 WHERE tier = 'core'`, [lv]); _touchedSectors = true; }
    } else if (k === 'sector_mid_min_level') {
      const lv = parseInt(value) || 0;
      if (lv > 0) { await pool.query(`UPDATE sectors SET entry_min_level = $1 WHERE tier = 'mid'`, [lv]); _touchedSectors = true; }
    }
    // settings 자체가 sector pricing 영향 (price_pixel_*) 또는 sector_*_min_level 이면 캐시 무효화
    if (_touchedSectors || /^(price_pixel_|sector_)/.test(k)) {
      try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
    }
    // [v7.166] resource rate 영향 키들 — admin 변경 즉시 반영
    if (/^(resource_|mining_|harvest_|drop_rate)/.test(k)) {
      try { require('../services/resource').invalidateRateCache(); } catch(_) {}
    }

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
    const [totalRefs, totalRewards, topReferrers, recentRewards, triggerBreakdown] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt FROM users WHERE referred_by IS NOT NULL AND wallet_address NOT LIKE '0xnpc_%'"),
      pool.query('SELECT COALESCE(SUM(pp_amount), 0) as total, COUNT(*) as cnt FROM referral_rewards'),
      pool.query(`
        SELECT rr.to_wallet,
               u.nickname AS to_nickname,
               COUNT(*) as reward_count,
               SUM(rr.pp_amount) as total_earned,
               (SELECT COUNT(*) FROM users WHERE referred_by = rr.to_wallet) as referral_count
          FROM referral_rewards rr
          LEFT JOIN users u ON u.wallet_address = rr.to_wallet
         WHERE rr.to_wallet NOT LIKE '0xnpc_%'
         GROUP BY rr.to_wallet, u.nickname
         ORDER BY total_earned DESC
         LIMIT 10
      `),
      pool.query(`
        SELECT rr.from_wallet, rr.to_wallet, rr.tier, rr.pp_amount, rr.trigger_type, rr.created_at,
               u_from.nickname AS from_nickname,
               u_to.nickname   AS to_nickname
          FROM referral_rewards rr
          LEFT JOIN users u_from ON u_from.wallet_address = rr.from_wallet
          LEFT JOIN users u_to   ON u_to.wallet_address   = rr.to_wallet
         ORDER BY rr.created_at DESC
         LIMIT 20
      `),
      // Per-trigger revenue breakdown — answers 'which money source feeds the referral tree most?'
      pool.query(`
        SELECT trigger_type,
               COUNT(*) as cnt,
               COALESCE(SUM(pp_amount), 0) as total
          FROM referral_rewards
         GROUP BY trigger_type
         ORDER BY total DESC
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
      triggerBreakdown: triggerBreakdown.rows.map(r => ({
        trigger: r.trigger_type, count: parseInt(r.cnt), total: parseFloat(r.total)
      })),
      topReferrers: topReferrers.rows.map(r => ({
        wallet: r.to_wallet,
        nickname: r.to_nickname || null,
        rewardCount: parseInt(r.reward_count),
        totalEarned: parseFloat(r.total_earned),
        referralCount: parseInt(r.referral_count)
      })),
      recentRewards: recentRewards.rows.map(r => ({
        from: r.from_wallet, to: r.to_wallet,
        fromNickname: r.from_nickname || null,
        toNickname: r.to_nickname || null,
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
    const {
      name, tier, base_price, governor_wallet,
      tax_rate, entry_min_level, entry_required_mid_owns, entry_check_active
    } = req.body;

    const updates = [];
    const vals = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); vals.push(name); }
    if (tier !== undefined) { updates.push(`tier = $${idx++}`); vals.push(tier); }
    if (base_price !== undefined) { updates.push(`base_price = $${idx++}`); vals.push(base_price); }
    if (governor_wallet !== undefined) { updates.push(`governor_wallet = $${idx++}`); vals.push(governor_wallet || null); }
    if (tax_rate !== undefined) {
      const t = parseFloat(tax_rate);
      if (Number.isNaN(t) || t < 0 || t > 50) return res.status(400).json({ error: 'tax_rate out of range (0..50)' });
      updates.push(`tax_rate = $${idx++}`); vals.push(t);
    }
    if (entry_min_level !== undefined) {
      const lv = parseInt(entry_min_level);
      if (Number.isNaN(lv) || lv < 0 || lv > 999) return res.status(400).json({ error: 'entry_min_level out of range' });
      updates.push(`entry_min_level = $${idx++}`); vals.push(lv);
    }
    if (entry_required_mid_owns !== undefined) {
      const n = parseInt(entry_required_mid_owns);
      if (Number.isNaN(n) || n < 0 || n > 99) return res.status(400).json({ error: 'entry_required_mid_owns out of range' });
      updates.push(`entry_required_mid_owns = $${idx++}`); vals.push(n);
    }
    if (entry_check_active !== undefined) {
      updates.push(`entry_check_active = $${idx++}`); vals.push(!!entry_check_active);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    await pool.query(`UPDATE sectors SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    // 변경 즉시 frontend/server 양쪽 캐시 무효화 — admin 변경이 즉시 반영되도록
    try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
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
        await client.query('UPDATE users SET rank_level = $1 WHERE LOWER(wallet_address) = LOWER($2)', [newLevel, w]);
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
      where += ` AND (c.owner ILIKE $${params.length} OR u.nickname ILIKE $${params.length})`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM claims c LEFT JOIN users u ON u.wallet_address = c.owner ${where}`, params
    );
    const total = parseInt(countRes.rows[0].cnt);

    const claimsRes = await pool.query(
      `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
              c.image_url, c.original_image_url, c.link_url, c.total_paid, c.created_at,
              u.nickname AS owner_nickname
       FROM claims c
       LEFT JOIN users u ON u.wallet_address = c.owner
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const claims = claimsRes.rows.map(r => ({
      id: r.id,
      owner: r.owner,
      ownerNickname: r.owner_nickname || null,
      ownerIsNpc: r.owner ? r.owner.startsWith('0xnpc_') : false,
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

// ── Migration 173: 함대 전투 손실 회수율 대시보드 ──
// GET /admin/api/fleet-battle-stats
router.get('/fleet-battle-stats', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);

    // 총 전투 수 + 공/방 생존율 (fleet_battles 요약 컬럼 사용)
    const overall = await pool.query(`
      SELECT
        COUNT(*)::int AS total_battles,
        COUNT(*) FILTER (WHERE status = 'ended')::int AS ended_battles,
        COALESCE(SUM(atk_ships_total),0)::int AS atk_deployed,
        COALESCE(SUM(atk_ships_lost),0)::int  AS atk_lost,
        COALESCE(SUM(def_ships_total),0)::int AS def_deployed,
        COALESCE(SUM(def_ships_lost),0)::int  AS def_lost,
        AVG(duration_seconds)::numeric AS avg_duration_sec
      FROM fleet_battles
      WHERE COALESCE(battle_started_at, created_at) > NOW() - ($1::int || ' days')::interval
    `, [days]).catch(() => ({ rows: [{}] }));

    // 참가자별 손실 집계 (wallet별)
    const topLosers = await pool.query(`
      SELECT
        fbp.wallet_address AS wallet,
        COALESCE(u.nickname, fbp.wallet_address) AS nickname,
        COUNT(*)::int AS battles,
        COALESCE(SUM(fbp.ships_lost),0)::int AS ships_lost,
        COALESCE(SUM(fbp.ships_at_start),0)::int AS ships_deployed
      FROM fleet_battle_participants fbp
      LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(fbp.wallet_address)
      JOIN fleet_battles fb ON fb.id = fbp.battle_id
      WHERE COALESCE(fb.battle_started_at, fb.created_at) > NOW() - ($1::int || ' days')::interval
      GROUP BY fbp.wallet_address, u.nickname
      ORDER BY ships_lost DESC
      LIMIT 20
    `, [days]).catch(() => ({ rows: [] }));

    // 일별 집계
    const daily = await pool.query(`
      SELECT
        DATE_TRUNC('day', COALESCE(fb.battle_started_at, fb.created_at))::date AS day,
        COUNT(*)::int AS battles,
        COALESCE(SUM(fb.atk_ships_lost + fb.def_ships_lost),0)::int  AS ships_lost,
        COALESCE(SUM(fb.atk_ships_total + fb.def_ships_total),0)::int AS ships_deployed
      FROM fleet_battles fb
      WHERE COALESCE(fb.battle_started_at, fb.created_at) > NOW() - ($1::int || ' days')::interval
      GROUP BY 1 ORDER BY 1 DESC
    `, [days]).catch(() => ({ rows: [] }));

    // 해체 통계 (Migration 173 신규 테이블) — Core sink 추적
    const scrap = await pool.query(`
      SELECT
        COUNT(*)::int AS total_scraps,
        COALESCE(SUM(gp_refunded),0)::numeric AS gp_refunded_total
      FROM ship_scrap_log
      WHERE created_at > NOW() - ($1::int || ' days')::interval
    `, [days]).catch(() => ({ rows: [{}] }));

    const ov = overall.rows[0] || {};
    const atkDep = parseInt(ov.atk_deployed) || 0;
    const defDep = parseInt(ov.def_deployed) || 0;
    const atkLost = parseInt(ov.atk_lost) || 0;
    const defLost = parseInt(ov.def_lost) || 0;
    const atkSurvivalPct = atkDep > 0 ? Math.round((atkDep - atkLost) / atkDep * 10000) / 100 : 0;
    const defSurvivalPct = defDep > 0 ? Math.round((defDep - defLost) / defDep * 10000) / 100 : 0;
    const overallSurvivalPct = (atkDep + defDep) > 0
      ? Math.round((atkDep + defDep - atkLost - defLost) / (atkDep + defDep) * 10000) / 100
      : 0;

    res.json({
      days,
      overall: {
        ...ov,
        atk_survival_pct: atkSurvivalPct,
        def_survival_pct: defSurvivalPct,
        overall_survival_pct: overallSurvivalPct
      },
      topLosers: topLosers.rows,
      daily: daily.rows,
      scrap: scrap.rows[0] || {}
    });
  } catch (e) {
    console.error('[Admin] fleet-battle-stats error:', e.message);
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
              s.entry_min_level, s.entry_required_mid_owns, s.entry_check_active,
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
//  GUILD WARS ADMIN
// ══════════════════════════════════════════════════

router.get('/guild-wars', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT w.*, ag.name AS attacker_name, dg.name AS defender_name
       FROM guild_wars w
       LEFT JOIN guilds ag ON ag.id = w.attacker_guild_id
       LEFT JOIN guilds dg ON dg.id = w.defender_guild_id
       ORDER BY w.created_at DESC LIMIT 50`
    );
    res.json({ wars: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/guild-wars/:id/resolve', adminAuth, async (req, res) => {
  try {
    const warId = parseInt(req.params.id);
    const w = await pool.query('SELECT * FROM guild_wars WHERE id = $1', [warId]);
    if (!w.rows.length) return res.status(404).json({ error: 'War not found' });
    const war = w.rows[0];
    let winnerId = null;
    if (war.attacker_score > war.defender_score) winnerId = war.attacker_guild_id;
    else if (war.defender_score > war.attacker_score) winnerId = war.defender_guild_id;

    const { getSetting } = require('../db');
    const rewardGP = parseFloat(await getSetting('guild_war_winner_gp') || '500');

    await pool.query(
      'UPDATE guild_wars SET status = $1, winner_guild_id = $2, reward_pp = $3, war_end = NOW() WHERE id = $4',
      ['resolved', winnerId, winnerId ? rewardGP : 0, warId]
    );

    // Award GP to winner's treasury
    if (winnerId && rewardGP > 0) {
      await pool.query('UPDATE guilds SET gp_treasury = gp_treasury + $1 WHERE id = $2', [rewardGP, winnerId]);
      await pool.query(
        `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
         VALUES ($1, 'admin', 'war_reward', $2,
                 (SELECT gp_treasury FROM guilds WHERE id = $1), $3)`,
        [winnerId, rewardGP, `Admin force-resolve war GP reward (War #${warId})`]
      );
    }

    await auditLog(req, 'guild_war_force_resolve', 'guild_war', { warId, winnerId, rewardGP: winnerId ? rewardGP : 0 });
    res.json({ success: true, winnerId, rewardGP: winnerId ? rewardGP : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
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

// ── POI Reset: expired only ──
router.post('/poi-reset-expired', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM exploration_pois WHERE expires_at < NOW() RETURNING id');
    res.json({ success: true, deleted: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POI Reset: all ──
router.post('/poi-reset-all', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM exploration_pois RETURNING id');
    res.json({ success: true, deleted: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════
// ENHANCEMENT SYSTEM ADMIN
// ══════════════════════════════════════

// GET /admin/enhancement/stats — enhancement statistics
router.get('/enhancement/stats', adminAuth, async (req, res) => {
  try {
    let enhService;
    try { enhService = require('../services/enhancement'); } catch (_) {}
    if (!enhService) return res.json({ total_attempts: 0, successes: 0, stays: 0, downgrades: 0, destroys: 0, total_gp_spent: 0, topItems: [], recentAttempts: [] });

    const stats = await enhService.getEnhancementStats();
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/enhancement/instances — all enhanced items (with filters)
router.get('/enhancement/instances', adminAuth, async (req, res) => {
  try {
    const minLevel = parseInt(req.query.minLevel) || 0;
    const result = await pool.query(
      `SELECT ii.*, it.name, it.icon, it.code, it.category
       FROM item_instances ii JOIN item_types it ON it.id = ii.item_type_id
       WHERE ii.enhancement_level >= $1
       ORDER BY ii.enhancement_level DESC, ii.created_at DESC
       LIMIT 100`, [minLevel]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/enhancement/log — recent enhancement attempts
router.get('/enhancement/log', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const wallet = (req.query.wallet || '').toLowerCase();
    let q = `SELECT el.*, it.name AS item_name, it.icon AS item_icon
             FROM enhancement_log el
             LEFT JOIN item_instances ii ON ii.id = el.instance_id
             LEFT JOIN item_types it ON it.id = ii.item_type_id`;
    const params = [];
    if (wallet) { q += ' WHERE el.wallet = $1'; params.push(wallet); }
    q += ' ORDER BY el.created_at DESC LIMIT ' + limit;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════
// MARKETPLACE ADMIN
// ══════════════════════════════════════

// GET /admin/marketplace/stats
router.get('/marketplace/stats', adminAuth, async (req, res) => {
  try {
    let mktService;
    try { mktService = require('../services/marketplace'); } catch (_) {}
    if (!mktService) return res.json({ active_listings: 0, total_sold: 0, total_volume: 0, total_fees: 0, recentSales: [] });
    const stats = await mktService.getMarketplaceStats();
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/marketplace/listings — all listings (with filters)
router.get('/marketplace/listings', adminAuth, async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT ml.*, u.nickname AS seller_name
       FROM marketplace_listings ml
       LEFT JOIN users u ON u.wallet_address = ml.seller
       WHERE ml.status = $1
       ORDER BY ml.listed_at DESC LIMIT $2`,
      [status, limit]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/marketplace/cancel — force cancel a listing
router.post('/marketplace/cancel', adminAuth, async (req, res) => {
  const { listingId } = req.body;
  if (!listingId) return res.status(400).json({ error: 'listingId required' });
  let mktService;
  try { mktService = require('../services/marketplace'); } catch (_) {}
  if (!mktService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await mktService.adminCancelListing(client, parseInt(listingId));
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /admin/api/ship-upgrades — upgrade stats + recent log + settings
router.get('/ship-upgrades', adminAuth, async (req, res) => {
  try {
    const [statsRes, logRes, settingsRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                         AS total_upgrades,
          COALESCE(SUM(gp_cost), 0)        AS total_gp_spent,
          COUNT(DISTINCT s.id) FILTER (
            WHERE s.upgrade_level >= (
              SELECT COALESCE(value::int, 5) FROM settings WHERE key='ship_upgrade_max_level' LIMIT 1
            )
          )                                AS max_level_ships
        FROM ship_upgrade_log ul
        JOIN user_ships s ON s.id = ul.ship_id
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT ul.id, ul.ship_id, ul.wallet, ul.from_level, ul.to_level, ul.gp_cost, ul.created_at,
               u.nickname
          FROM ship_upgrade_log ul
          LEFT JOIN users u ON u.wallet_address = ul.wallet
         ORDER BY ul.created_at DESC LIMIT 50
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT key, value FROM settings
         WHERE key LIKE 'ship_upgrade_%'
         ORDER BY key
      `).catch(() => ({ rows: [] })),
    ]);

    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
    const s = statsRes.rows[0] || {};

    res.json({
      total_upgrades:  parseInt(s.total_upgrades)  || 0,
      total_gp_spent:  parseFloat(s.total_gp_spent) || 0,
      max_level_ships: parseInt(s.max_level_ships)  || 0,
      log:      logRes.rows,
      settings: settingsMap,
    });
  } catch (e) {
    console.error('[Admin] ship-upgrades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/gp-transfers — GP transfer stats + recent log + settings
router.get('/gp-transfers', adminAuth, async (req, res) => {
  try {
    const [statsRes, todayRes, logRes, settingsRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total_count, COALESCE(SUM(amount), 0) AS total_volume
          FROM gp_transfers
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT COUNT(*) AS today_count, COALESCE(SUM(amount), 0) AS today_volume
          FROM gp_transfers WHERE created_at >= CURRENT_DATE
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT t.id, t.from_wallet, t.to_wallet, t.amount, t.note, t.created_at,
               uf.nickname AS from_nick, ut.nickname AS to_nick
          FROM gp_transfers t
          LEFT JOIN users uf ON uf.wallet_address = t.from_wallet
          LEFT JOIN users ut ON ut.wallet_address = t.to_wallet
         ORDER BY t.created_at DESC LIMIT 100
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT key, value FROM settings WHERE key LIKE 'gp_transfer_%' ORDER BY key
      `).catch(() => ({ rows: [] })),
    ]);

    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
    const s = statsRes.rows[0] || {};
    const td = todayRes.rows[0] || {};

    res.json({
      total_count:  parseInt(s.total_count)  || 0,
      total_volume: parseFloat(s.total_volume) || 0,
      today_count:  parseInt(td.today_count)  || 0,
      today_volume: parseFloat(td.today_volume) || 0,
      log:      logRes.rows,
      settings: settingsMap,
    });
  } catch (e) {
    console.error('[Admin] gp-transfers error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/marketplace/price-analytics — price history aggregate stats (Migration 103)
router.get('/marketplace/price-analytics', adminAuth, async (req, res) => {
  try {
    const [totalRes, claimRes, topRes, settingsRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)                                                   AS total_sales,
               COALESCE(SUM(sale_price), 0)                              AS total_volume,
               COUNT(*) FILTER (WHERE sold_at >= NOW() - INTERVAL '7 days')        AS sales_7d,
               COALESCE(SUM(sale_price) FILTER (
                 WHERE sold_at >= NOW() - INTERVAL '7 days'), 0)         AS volume_7d
          FROM marketplace_price_history
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT COUNT(*) AS claim_sales
          FROM marketplace_price_history WHERE claim_id IS NOT NULL
      `).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT item_type_id, enhancement_level,
               COUNT(*)              AS cnt,
               AVG(sale_price)       AS avg_price,
               MAX(sold_at)          AS last_sale
          FROM marketplace_price_history
         WHERE item_type_id IS NOT NULL
         GROUP BY item_type_id, enhancement_level
         ORDER BY cnt DESC
         LIMIT 20
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT key, value FROM settings WHERE key LIKE 'mkt_%' ORDER BY key
      `).catch(() => ({ rows: [] })),
    ]);

    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
    const t = totalRes.rows[0] || {};
    const c = claimRes.rows[0] || {};

    res.json({
      total_sales:  parseInt(t.total_sales)    || 0,
      total_volume: parseFloat(t.total_volume) || 0,
      sales_7d:     parseInt(t.sales_7d)       || 0,
      volume_7d:    parseFloat(t.volume_7d)    || 0,
      claim_sales:  parseInt(c.claim_sales)    || 0,
      top_items:    topRes.rows.map(r => ({
        item_type_id:       r.item_type_id,
        enhancement_level:  parseInt(r.enhancement_level),
        cnt:                parseInt(r.cnt),
        avg_price:          parseFloat(r.avg_price),
        last_sale:          r.last_sale,
      })),
      settings: settingsMap,
    });
  } catch (e) {
    console.error('[Admin] marketplace/price-analytics error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ACHIEVEMENTS ADMIN (Migration 104) ────────────────────────────────────────
// GET /admin/api/achievements — stats + achievement list with unlock counts + settings
router.get('/achievements', adminAuth, async (req, res) => {
  let achSvc;
  try { achSvc = require('../services/achievements'); } catch (_) {}

  try {
    const statsPromise = achSvc ? achSvc.getAdminStats() : Promise.resolve({ total_unlocks: 0, total_gp_given: 0, today_unlocks: 0, top: [] });
    const [stats, settingsRes] = await Promise.all([
      statsPromise,
      pool.query(`SELECT key, value FROM settings WHERE key LIKE 'achievement%' ORDER BY key`).catch(() => ({ rows: [] })),
    ]);

    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

    res.json({ ...stats, settings: settingsMap });
  } catch (e) {
    console.error('[Admin] achievements error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/achievements/grant — manually grant achievement to player
router.post('/achievements/grant', adminAuth, async (req, res) => {
  const { wallet, achievementKey } = req.body;
  if (!wallet || !achievementKey) return res.status(400).json({ error: 'wallet and achievementKey required' });
  let achSvc;
  try { achSvc = require('../services/achievements'); } catch (_) {}
  if (!achSvc) return res.status(503).json({ error: 'Achievement service unavailable' });
  try {
    // Get reward_gp for this achievement
    const achRes = await pool.query(`SELECT reward_gp FROM achievements WHERE key = $1`, [achievementKey]);
    if (!achRes.rows.length) return res.status(404).json({ error: 'Achievement not found' });
    const unlocked = await achSvc.unlockAchievement(wallet.toLowerCase(), achievementKey, parseFloat(achRes.rows[0].reward_gp));
    res.json({ success: true, alreadyHad: !unlocked });
  } catch (e) {
    console.error('[Admin] grant achievement error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── LOTTERY ADMIN (Migration 105) ────────────────────────────────────────────
// GET /admin/api/lottery — stats + recent rounds + settings
router.get('/lottery', adminAuth, async (req, res) => {
  let lotteryService;
  try { lotteryService = require('../services/lottery'); } catch (_) {}
  try {
    if (!lotteryService) return res.json({ total_rounds: 0, total_tickets: 0, settings: {}, recent_rounds: [] });
    const stats = await lotteryService.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] lottery error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/lottery/force-draw — manually trigger draw on current open round
router.post('/lottery/force-draw', adminAuth, async (req, res) => {
  let lotteryService;
  try { lotteryService = require('../services/lottery'); } catch (_) {}
  if (!lotteryService) return res.status(503).json({ error: 'Lottery service unavailable' });
  try {
    const round = (await pool.query(`SELECT * FROM lottery_rounds WHERE status='open' ORDER BY id DESC LIMIT 1`)).rows[0];
    if (!round) return res.status(400).json({ error: 'No open round found' });
    // Force-expire by setting ends_at to past
    await pool.query(`UPDATE lottery_rounds SET ends_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [round.id]);
    const n = await lotteryService.drawExpiredRounds();
    res.json({ success: true, drew: n });
  } catch (e) {
    console.error('[Admin] lottery force-draw error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PLANET NEWS ADMIN (Migration 106) ─────────────────────────────────────────
// GET /admin/api/news?limit=&type= — latest news items for admin view
router.get('/news', adminAuth, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 100);
  const type  = req.query.type || null;
  let newsSvc;
  try { newsSvc = require('../services/news'); } catch (_) {}
  try {
    if (!newsSvc) return res.json({ news: [] });
    const [news, settingsRes] = await Promise.all([
      newsSvc.getNews({ limit, eventType: type }),
      pool.query(`SELECT key, value FROM settings WHERE key LIKE 'news_%' ORDER BY key`).catch(() => ({ rows: [] })),
    ]);
    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
    res.json({ news, settings: settingsMap });
  } catch (e) {
    console.error('[Admin] news error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/api/news/:id — delete a news item
router.delete('/news/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    await pool.query('DELETE FROM planet_news WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GP Dividends Admin (Migration 110) ───────────────────────────────────────

// GET /admin/api/dividends — pool history + settings
router.get('/dividends', adminAuth, async (req, res) => {
  try {
    let divSvc;
    try { divSvc = require('../services/dividends'); } catch (_) {}
    if (!divSvc) return res.status(503).json({ error: 'Dividend service unavailable' });
    const stats = await divSvc.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] dividends error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/dividends/setting
router.post('/dividends/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('dividends_')) return res.status(400).json({ error: 'Invalid dividends key' });
  try {
    await pool.query(`UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, [key, String(value)]);
    await auditLog(req, 'update_dividends_setting', key, { value });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/dividends/force-distribute — manually trigger distribution
router.post('/dividends/force-distribute', adminAuth, async (req, res) => {
  try {
    let divSvc;
    try { divSvc = require('../services/dividends'); } catch (_) {}
    if (!divSvc) return res.status(503).json({ error: 'Dividend service unavailable' });
    const n = await divSvc.distributeLastWeek();
    await auditLog(req, 'force_dividend_distribution', 'all', { recipients: n });
    res.json({ success: true, recipients: n });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Weekly Challenges Admin (Migration 109) ───────────────────────────────────
function removedLegacyService(res, service) {
  return res.status(410).json({
    error: 'LEGACY_SERVICE_REMOVED',
    service,
  });
}

// GET /admin/api/weekly — stats + this week's instances
router.get('/weekly', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'weeklyChallenges');
});

// POST /admin/api/weekly/setting
router.post('/weekly/setting', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'weeklyChallenges');
});

// POST /admin/api/weekly/settle — manually settle competitive challenges
router.post('/weekly/settle', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'weeklyChallenges');
});

// ── GP Burn Admin (Migration 108) ────────────────────────────────────────────

// GET /admin/api/burn — stats + settings
router.get('/burn', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'gpBurn');
});

// POST /admin/api/burn/setting — update a burn setting
router.post('/burn/setting', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'gpBurn');
});

// ── GP Staking Admin (Migration 107) ─────────────────────────────────────────

// GET /admin/api/staking — stats + settings
router.get('/staking', adminAuth, async (req, res) => {
  try {
    let stakingService;
    try { stakingService = require('../services/staking'); } catch (_) {}
    if (!stakingService) return res.status(503).json({ error: 'Staking service unavailable' });
    const stats = await stakingService.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] staking error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/staking/setting — update a staking setting
router.post('/staking/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('staking_')) return res.status(400).json({ error: 'Invalid staking key' });
  try {
    await pool.query(
      `UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`,
      [key, String(value)]
    );
    await auditLog(req, 'update_staking_setting', key, { value });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/staking/force-withdraw — admin force-withdraw a specific stake
router.post('/staking/force-withdraw', adminAuth, async (req, res) => {
  const { stakeId } = req.body;
  if (!stakeId) return res.status(400).json({ error: 'stakeId required' });
  try {
    const stakeRes = await pool.query(
      `SELECT * FROM gp_stakes WHERE id = $1`, [parseInt(stakeId)]
    );
    if (!stakeRes.rows.length) return res.status(404).json({ error: 'Stake not found' });
    const stake = stakeRes.rows[0];
    if (stake.status === 'withdrawn') return res.status(400).json({ error: 'Stake already withdrawn' });

    const totalReturn = +(parseFloat(stake.amount) + parseFloat(stake.yield_earned)).toFixed(6);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
        [stake.wallet, totalReturn]
      );
      await client.query(
        `UPDATE gp_stakes SET status = 'withdrawn', withdrawn_at = NOW() WHERE id = $1`,
        [stakeId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await auditLog(req, 'force_withdraw_stake', `stake:${stakeId}`, { wallet: stake.wallet, totalReturn });
    res.json({ success: true, totalReturn, wallet: stake.wallet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Territory Monuments Admin ──────────────────────────────────────────────────

// GET /admin/api/monuments
router.get('/monuments', adminAuth, async (req, res) => {
  try {
    let monumentSvc;
    try { monumentSvc = require('../services/monuments'); } catch (_) {}
    if (!monumentSvc) return res.status(503).json({ error: 'Monument service unavailable' });
    const stats = await monumentSvc.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] monuments error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/monuments/setting
router.post('/monuments/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('monument_')) return res.status(400).json({ error: 'Invalid monument key' });
  try {
    await pool.query(`UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, [key, String(value)]);
    await auditLog(req, 'update_setting', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/monuments/moderate/:id  — hide/restore a monument
router.post('/monuments/moderate/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body; // action: 'hide' | 'restore'
  if (!['hide', 'restore'].includes(action)) return res.status(400).json({ error: 'action must be hide or restore' });
  try {
    const isActive = action === 'restore';
    await pool.query(
      `UPDATE territory_monuments
          SET is_active = $2, moderated_at = NOW(), moderation_note = $3
        WHERE id = $1`,
      [id, isActive, note || null]
    );
    await auditLog(req, `monument_${action}`, `monument:${id}`, { note });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Territory Upgrades Admin ───────────────────────────────────────────────────

// GET /admin/api/upgrades
router.get('/upgrades', adminAuth, async (req, res) => {
  try {
    let upgradeSvc;
    try { upgradeSvc = require('../services/claimUpgrades'); } catch (_) {}
    if (!upgradeSvc) return res.status(503).json({ error: 'Upgrade service unavailable' });
    const stats = await upgradeSvc.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] upgrades error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/upgrades/setting
router.post('/upgrades/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('upgrade_')) return res.status(400).json({ error: 'Invalid upgrade key' });
  try {
    await pool.query(`UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, [key, String(value)]);
    await auditLog(req, 'update_setting', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bounty Board Admin ─────────────────────────────────────────────────────────

// GET /admin/api/bounties
router.get('/bounties', adminAuth, async (req, res) => {
  try {
    let bountySvc;
    try { bountySvc = require('../services/bounty'); } catch (_) {}
    if (!bountySvc) return res.status(503).json({ error: 'Bounty service unavailable' });
    const stats = await bountySvc.getAdminStats();
    res.json(stats);
  } catch (e) {
    console.error('[Admin] bounties error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/bounties/setting
router.post('/bounties/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('bounty_')) return res.status(400).json({ error: 'Invalid bounty key' });
  try {
    await pool.query(`UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, [key, String(value)]);
    await auditLog(req, 'update_setting', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Territory Shield Admin ────────────────────────────────────────────────────

// GET /admin/api/shields
router.get('/shields', adminAuth, async (req, res) => {
  try {
    let shieldSvc;
    try { shieldSvc = require('../services/shield'); } catch (_) {}
    if (!shieldSvc) return res.status(503).json({ error: 'Shield service unavailable' });
    const stats = await shieldSvc.getAdminStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/shields/setting
router.post('/shields/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!key.startsWith('shield_')) return res.status(400).json({ error: 'Invalid shield key' });
  try {
    await pool.query(`UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1`, [key, String(value)]);
    await auditLog(req, 'update_setting', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/shields/revoke/:claimId — admin force remove shield
router.post('/shields/revoke/:claimId', adminAuth, async (req, res) => {
  const { claimId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE territory_shields SET is_active = false WHERE claim_id = $1 AND is_active = true RETURNING *`,
      [claimId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No active shield on this territory' });
    await auditLog(req, 'shield_revoke', `claim:${claimId}`, {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/bounties/cancel/:id — admin force cancel
router.post('/bounties/cancel/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const res2 = await pool.query(
      `UPDATE gp_bounties SET status='cancelled'
        WHERE id=$1 AND status='active' RETURNING *`, [id]
    );
    if (!res2.rows.length) return res.status(404).json({ error: 'Bounty not found or not active' });
    const b = res2.rows[0];
    // Refund poster
    await pool.query(`UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`, [b.poster, b.gp_amount]);
    await auditLog(req, 'bounty_admin_cancel', `bounty:${id}`, { poster: b.poster, amount: b.gp_amount });
    res.json({ ok: true, refunded: b.gp_amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRAFTING SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/crafting — stats + recipes + settings
router.get('/crafting', adminAuth, async (req, res) => {
  let craftingSvc;
  try { craftingSvc = require('../services/crafting'); } catch (_) {}
  if (!craftingSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const [stats, recipes] = await Promise.all([
      craftingSvc.getAdminStats(),
      craftingSvc.getRecipes(null, null)
    ]);
    res.json({ ...stats, recipes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/crafting/setting — update a crafting setting
router.post('/crafting/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('crafting_')) {
    return res.status(400).json({ error: 'Invalid setting key' });
  }
  try {
    await pool.query(
      `UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]
    );
    await auditLog(req, 'crafting_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/crafting/recipe — create new recipe
router.post('/crafting/recipe', adminAuth, async (req, res) => {
  let craftingSvc;
  try { craftingSvc = require('../services/crafting'); } catch (_) {}
  if (!craftingSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const recipe = await craftingSvc.adminCreateRecipe(req.body);
    await auditLog(req, 'crafting_recipe_create', `recipe:${recipe.id}`, { name: recipe.name });
    res.json(recipe);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /admin/api/crafting/recipe/:id — update recipe
router.put('/crafting/recipe/:id', adminAuth, async (req, res) => {
  let craftingSvc;
  try { craftingSvc = require('../services/crafting'); } catch (_) {}
  if (!craftingSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const recipe = await craftingSvc.adminUpdateRecipe(parseInt(req.params.id, 10), req.body);
    await auditLog(req, 'crafting_recipe_update', `recipe:${req.params.id}`, req.body);
    res.json(recipe);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /admin/api/crafting/recipe/:id — deactivate recipe
router.delete('/crafting/recipe/:id', adminAuth, async (req, res) => {
  let craftingSvc;
  try { craftingSvc = require('../services/crafting'); } catch (_) {}
  if (!craftingSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    await craftingSvc.adminDeleteRecipe(parseInt(req.params.id, 10));
    await auditLog(req, 'crafting_recipe_delete', `recipe:${req.params.id}`, {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/crafting/item-types — for recipe ingredient picker
router.get('/crafting/item-types', adminAuth, async (req, res) => {
  let craftingSvc;
  try { craftingSvc = require('../services/crafting'); } catch (_) {}
  if (!craftingSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    res.json(await craftingSvc.getItemTypes());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PIXEL ART CONTESTS — admin
// ═══════════════════════════════════════════════════════════════════════════

router.get('/contests', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/contest'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/contests/create', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/contest'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const contest = await svc.adminCreateContest(req.body);
    await auditLog(req, 'contest_create', `contest:${contest.id}`, { title: contest.title });
    res.json(contest);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/contests/:id', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/contest'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const contest = await svc.adminUpdateContest(parseInt(req.params.id, 10), req.body);
    await auditLog(req, 'contest_update', `contest:${req.params.id}`, req.body);
    res.json(contest);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/contests/:id/finalize', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/contest'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const result = await svc.finalizeContest(parseInt(req.params.id, 10));
    await auditLog(req, 'contest_finalize', `contest:${req.params.id}`, result);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/contests/entry/:id/disqualify', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/contest'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    await svc.adminDisqualifyEntry(parseInt(req.params.id, 10));
    await auditLog(req, 'contest_dq_entry', `entry:${req.params.id}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/contests/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('contest_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'contest_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERRITORY RENTAL — admin
// ═══════════════════════════════════════════════════════════════════════════

router.get('/rental', adminAuth, async (req, res) => {
  let svc;
  try { svc = require('../services/rental'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/rental/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('rental_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'rental_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/rental/cancel/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE territory_rentals SET status='cancelled' WHERE id=$1 AND status='listed'`, [id]);
    await auditLog(req, 'rental_admin_cancel', `rental:${id}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GP DUEL SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/duels — stats + recent + settings
router.get('/duels', adminAuth, async (req, res) => {
  let duelSvc;
  try { duelSvc = require('../services/duel'); } catch (_) {}
  if (!duelSvc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    res.json(await duelSvc.getAdminStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/duels/setting
router.post('/duels/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('duel_')) {
    return res.status(400).json({ error: 'Invalid setting key' });
  }
  try {
    await pool.query(
      `UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]
    );
    await auditLog(req, 'duel_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/duels/cancel/:id — admin force cancel + refund
router.post('/duels/cancel/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM gp_duels WHERE id=$1 AND status IN ('pending','accepted')`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Active duel not found' });
    const d = rows[0];

    // Refund challenger (wager was escrowed)
    await pool.query(
      'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [d.wager_gp, d.challenger]
    );
    await pool.query(
      `UPDATE gp_duels SET status='cancelled' WHERE id=$1`, [id]);
    await auditLog(req, 'duel_admin_cancel', `duel:${id}`, { challenger: d.challenger });
    res.json({ ok: true, refunded: d.wager_gp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ALLIANCE SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/alliances — stats + alliance list + settings
router.get('/alliances', adminAuth, async (req, res) => {
  let svc;
  try { svc = require('../services/alliance'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/api/alliances/:id/log — alliance activity log
router.get('/alliances/:id/log', adminAuth, async (req, res) => {
  let svc;
  try { svc = require('../services/alliance'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAllianceLog(parseInt(req.params.id, 10), 50)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/alliances/setting — update alliance_* setting
router.post('/alliances/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('alliance_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'alliance_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/alliances/:id/dissolve — force-dissolve an alliance (refund treasury 50%)
router.post('/alliances/:id/dissolve', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM alliances WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const a = rows[0];
    // Refund 50% of treasury to leader
    if (Number(a.treasury_gp) > 0) {
      const refund = parseFloat((Number(a.treasury_gp) * 0.5).toFixed(6));
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [refund, a.leader]);
    }
    await client.query(`DELETE FROM alliances WHERE id=$1`, [id]);
    await client.query('COMMIT');
    await auditLog(req, 'alliance_admin_dissolve', `alliance:${id}`, { name: a.name });
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /admin/api/alliances/:id/kick/:wallet — kick member from alliance
router.post('/alliances/:id/kick/:wallet', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const wallet = req.params.wallet.toLowerCase();
  try {
    const { rows } = await pool.query(`SELECT leader FROM alliances WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Alliance not found' });
    if (rows[0].leader === wallet) return res.status(400).json({ error: 'Cannot kick leader — use dissolve' });
    await pool.query(`DELETE FROM alliance_members WHERE alliance_id=$1 AND wallet=$2`, [id, wallet]);
    await pool.query(`UPDATE alliances SET member_count = member_count - 1 WHERE id=$1`, [id]);
    await pool.query(
      `INSERT INTO alliance_log (alliance_id, wallet, event_type, note) VALUES ($1,$2,'kicked','Admin kick')`,
      [id, wallet]);
    await auditLog(req, 'alliance_admin_kick', `alliance:${id}`, { wallet });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// LUCKY BOX SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/lucky-boxes — stats + box types + settings
router.get('/lucky-boxes', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'luckyBox');
});

// POST /admin/api/lucky-boxes/type — create a new box type
router.post('/lucky-boxes/type', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'luckyBox');
});

// PUT /admin/api/lucky-boxes/type/:id — update box type
router.put('/lucky-boxes/type/:id', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'luckyBox');
});

// DELETE /admin/api/lucky-boxes/type/:id — soft-delete (deactivate) box type
router.delete('/lucky-boxes/type/:id', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'luckyBox');
});

// POST /admin/api/lucky-boxes/setting — update lucky_box_* settings
router.post('/lucky-boxes/setting', adminAuth, async (req, res) => {
  return removedLegacyService(res, 'luckyBox');
});

// ═══════════════════════════════════════════════════════════════════════════
// VIP PASS SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/vip — stats + active passes + tiers + settings
router.get('/vip', adminAuth, async (req, res) => {
  let svc;
  try { svc = require('../services/vip'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/vip/tier — create VIP tier
router.post('/vip/tier', adminAuth, async (req, res) => {
  const { name, badge, badge_color, cost_gp, period_days, mining_boost_pct,
          fee_discount_pct, gp_earn_bonus_pct, sort_order } = req.body || {};
  if (!name || !cost_gp) return res.status(400).json({ error: 'name and cost_gp required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO vip_tiers (name, badge, badge_color, cost_gp, period_days,
         mining_boost_pct, fee_discount_pct, gp_earn_bonus_pct, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, badge||'⭐', badge_color||'#ffcc02', parseFloat(cost_gp),
       parseInt(period_days||30), parseInt(mining_boost_pct||0),
       parseInt(fee_discount_pct||0), parseInt(gp_earn_bonus_pct||0), parseInt(sort_order||0)]);
    await auditLog(req, 'vip_tier_create', `tier:${rows[0].id}`, { name });
    res.json({ ok: true, id: rows[0].id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /admin/api/vip/tier/:id — update VIP tier
router.put('/vip/tier/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, badge, badge_color, cost_gp, period_days, mining_boost_pct,
          fee_discount_pct, gp_earn_bonus_pct, sort_order, is_active } = req.body || {};
  try {
    await pool.query(
      `UPDATE vip_tiers SET name=$1, badge=$2, badge_color=$3, cost_gp=$4, period_days=$5,
         mining_boost_pct=$6, fee_discount_pct=$7, gp_earn_bonus_pct=$8, sort_order=$9, is_active=$10
       WHERE id=$11`,
      [name, badge||'⭐', badge_color||'#ffcc02', parseFloat(cost_gp),
       parseInt(period_days||30), parseInt(mining_boost_pct||0),
       parseInt(fee_discount_pct||0), parseInt(gp_earn_bonus_pct||0), parseInt(sort_order||0),
       is_active !== false && is_active !== 'false', id]);
    await auditLog(req, 'vip_tier_update', `tier:${id}`, { name });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/vip/revoke/:wallet — revoke VIP from a player
router.post('/vip/revoke/:wallet', adminAuth, async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  try {
    await pool.query(
      `UPDATE vip_passes SET is_active=false WHERE wallet=$1 AND is_active=true`, [wallet]);
    await auditLog(req, 'vip_admin_revoke', wallet, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/vip/setting — update vip_* settings
router.post('/vip/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('vip_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'vip_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDITION SYSTEM — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/expeditions — stats + recent + settings
router.get('/expeditions', adminAuth, async (req, res) => {
  let svc;
  try { svc = require('../services/expedition'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/expeditions/setting — update expedition_* setting
router.post('/expeditions/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('expedition_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'expedition_setting_update', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/expeditions/:id/cancel — admin force-cancel
router.post('/expeditions/:id/cancel', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      `SELECT wallet, gp_spent FROM expeditions WHERE id=$1 AND status='active'`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found or not active' });
    const exp = rows[0];
    await pool.query(`UPDATE expeditions SET status='cancelled' WHERE id=$1`, [id]);
    // Full refund on admin cancel
    await pool.query(
      `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
      [exp.gp_spent, exp.wallet]);
    await auditLog(req, 'expedition_admin_cancel', `expedition:${id}`, { wallet: exp.wallet });
    res.json({ ok: true, refunded: exp.gp_spent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERRITORY BRANDING — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/branding — stats + recent + settings
router.get('/branding', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/branding'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/branding/setting — update branding_* setting
router.post('/branding/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('branding_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query('UPDATE game_settings SET value=$1::jsonb WHERE key=$2', [JSON.stringify(value), key]);
    await auditLog(req, 'branding_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/branding/:claimId — clear branding for a territory
router.delete('/branding/:claimId', adminAuth, async (req, res) => {
  const claimId = parseInt(req.params.claimId, 10);
  let svc; try { svc = require('../services/branding'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    await svc.adminClearBranding(claimId);
    await auditLog(req, 'branding_clear', `claim:${claimId}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERRITORY SPELLS — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/spells — stats + active + recent + settings
router.get('/spells', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/spells'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/spells/setting — update spell_* setting
router.post('/spells/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('spell_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query('UPDATE game_settings SET value=$1::jsonb WHERE key=$2', [JSON.stringify(value), key]);
    await auditLog(req, 'spell_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/spells/:id — force-expire a spell
router.delete('/spells/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query("UPDATE territory_spells SET is_active=false WHERE id=$1", [id]);
    await auditLog(req, 'spell_expire', `spell:${id}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TOURNAMENTS — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/tournaments — stats + list
router.get('/tournaments', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/tournaments/create
router.post('/tournaments/create', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const t = await svc.adminCreateTournament(req.body || {});
    await auditLog(req, 'tournament_create', `tournament:${t.id}`, { name: t.name });
    res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/tournaments/:id/status  { status }
router.post('/tournaments/:id/status', adminAuth, async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    await svc.adminUpdateStatus(id, status);
    await auditLog(req, 'tournament_status', `tournament:${id}`, { status });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/tournaments/:id/winner  { wallet }
router.post('/tournaments/:id/winner', adminAuth, async (req, res) => {
  const id = req.params.id;
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const r = await svc.adminPickWinner(id, wallet);
    await auditLog(req, 'tournament_winner', `tournament:${id}`, r);
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/tournaments/:id/cancel
router.post('/tournaments/:id/cancel', adminAuth, async (req, res) => {
  const id = req.params.id;
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const r = await svc.adminCancelTournament(id);
    await auditLog(req, 'tournament_cancel', `tournament:${id}`, r);
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /admin/api/tournaments/:id/entries
router.get('/tournaments/:id/entries', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tournaments'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const t = await svc.getTournament(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t.entries || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/tournaments/setting — tournament_* setting
router.post('/tournaments/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tournament_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query('UPDATE game_settings SET value=$1::jsonb WHERE key=$2', [JSON.stringify(value), key]);
    await auditLog(req, 'tournament_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GP BROADCASTS — admin
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/api/broadcasts — stats + active + recent + settings
router.get('/broadcasts', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/broadcasts'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try { res.json(await svc.getAdminStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/broadcasts/:id — moderate (remove) broadcast
router.delete('/broadcasts/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let svc; try { svc = require('../services/broadcasts'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    await svc.adminRemoveBroadcast(id);
    await auditLog(req, 'broadcast_remove', `broadcast:${id}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/broadcasts/setting
router.post('/broadcasts/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('broadcast_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query('UPDATE game_settings SET value=$1::jsonb WHERE key=$2', [JSON.stringify(value), key]);
    await auditLog(req, 'broadcast_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Profile Customization Admin (Migration 127) ──────────────────────────────

// GET /admin/api/profile — stats + recent changes
router.get('/profile', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/profile'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try {
    const [stats, recentRes] = await Promise.all([
      svc.getAdminStats(),
      require('../db').pool.query(
        `SELECT wallet, field, old_value, new_value, gp_spent, created_at
           FROM profile_change_log ORDER BY created_at DESC LIMIT 50`
      )
    ]);
    res.json({ stats, recent: recentRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/profile/setting
router.post('/profile/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('profile_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'profile_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/profile/nickname/:wallet — admin force-reset nickname
router.delete('/profile/nickname/:wallet', adminAuth, async (req, res) => {
  const wallet = req.params.wallet;
  try {
    const { pool } = require('../db');
    const old = await pool.query(`SELECT nickname FROM users WHERE LOWER(wallet_address)=LOWER($1)`, [wallet]);
    await pool.query(`UPDATE users SET nickname=NULL WHERE LOWER(wallet_address)=LOWER($1)`, [wallet]);
    await auditLog(req, 'profile_reset_nickname', `wallet:${wallet}`, { old: old.rows[0]?.nickname });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Tiers Admin (Migration 128) ────────────────────────────────────

// GET /admin/api/tiers
router.get('/tiers', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tiers'); } catch (_) {}
  if (!svc) return res.json({ stats: null, distribution: [], recent: [] });
  try {
    const [adminStats, recentRes] = await Promise.all([
      svc.getAdminStats(),
      require('../db').pool.query(
        `SELECT l.claim_id, l.wallet, l.from_tier, l.to_tier, l.gp_spent, l.created_at,
                u.nickname
           FROM territory_tier_log l
           LEFT JOIN users u ON LOWER(l.wallet)=LOWER(u.wallet_address)
           ORDER BY l.created_at DESC LIMIT 50`
      )
    ]);
    res.json({ ...adminStats, recent: recentRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/tiers/setting
router.post('/tiers/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tier_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tier_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/tiers/claim/:claimId — admin reset tier to 1
router.delete('/tiers/claim/:claimId', adminAuth, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  try {
    const { pool } = require('../db');
    await pool.query(`DELETE FROM territory_tiers WHERE claim_id=$1`, [claimId]);
    await auditLog(req, 'tier_reset', `claim:${claimId}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Raffle Admin (Migration 129) ─────────────────────────────────────────────

// GET /admin/api/raffle — stats + all raffles
router.get('/raffle', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/raffle'); } catch (_) {}
  if (!svc) return res.json({ stats: null, raffles: [] });
  try {
    const { pool } = require('../db');
    const [stats, rafflesRes] = await Promise.all([
      svc.getAdminStats(),
      pool.query(`SELECT * FROM raffles ORDER BY created_at DESC LIMIT 50`)
    ]);
    res.json({ stats, raffles: rafflesRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/api/raffle/:id/entrants
router.get('/raffle/:id/entrants', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/raffle'); } catch (_) {}
  if (!svc) return res.json([]);
  try {
    const entrants = await svc.getEntrants(parseInt(req.params.id));
    res.json(entrants);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/raffle/create
router.post('/raffle/create', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/raffle'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const rf = await svc.adminCreateRaffle(req.body || {});
    await auditLog(req, 'raffle_create', `raffle:${rf.id}`, { title: rf.title });
    res.json(rf);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/raffle/:id/draw — force draw
router.post('/raffle/:id/draw', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/raffle'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const result = await svc.drawWinner(parseInt(req.params.id));
    await auditLog(req, 'raffle_draw', `raffle:${req.params.id}`, result);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/raffle/:id/cancel
router.post('/raffle/:id/cancel', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/raffle'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const result = await svc.adminCancelRaffle(parseInt(req.params.id));
    await auditLog(req, 'raffle_cancel', `raffle:${req.params.id}`, result);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/raffle/setting
router.post('/raffle/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('raffle_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'raffle_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Wager Pool Admin (Migration 130) ─────────────────────────────────────────

// GET /admin/api/wager
router.get('/wager', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/wager'); } catch (_) {}
  if (!svc) return res.json({ stats: null, pools: [] });
  try {
    const { pool } = require('../db');
    const [stats, poolsRes] = await Promise.all([
      svc.getAdminStats(),
      pool.query(
        `SELECT p.*, (SELECT COUNT(*) FROM wager_bets WHERE pool_id=p.id) AS bet_count
           FROM wager_pools p ORDER BY p.created_at DESC LIMIT 50`
      )
    ]);
    res.json({ stats, pools: poolsRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /admin/api/wager/:id/bets
router.get('/wager/:id/bets', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/wager'); } catch (_) {}
  if (!svc) return res.json([]);
  try { res.json(await svc.getPoolBets(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/wager/create
router.post('/wager/create', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/wager'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const wp = await svc.adminCreatePool(req.body || {});
    await auditLog(req, 'wager_create', `wager:${wp.id}`, { title: wp.title });
    res.json(wp);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/wager/:id/settle  { winnerWallet }
router.post('/wager/:id/settle', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/wager'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const { winnerWallet } = req.body || {};
    if (!winnerWallet) return res.status(400).json({ error: 'winnerWallet required' });
    const result = await svc.settlePool(parseInt(req.params.id), winnerWallet);
    await auditLog(req, 'wager_settle', `wager:${req.params.id}`, result);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/wager/:id/cancel
router.post('/wager/:id/cancel', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/wager'); } catch (_) {}
  if (!svc) return res.status(503).json({ error: 'Service unavailable' });
  try {
    const result = await svc.adminCancelPool(parseInt(req.params.id));
    await auditLog(req, 'wager_cancel', `wager:${req.params.id}`, result);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /admin/api/wager/setting
router.post('/wager/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('wager_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'wager_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Events Admin (Migration 131) ───────────────────────────────────

// GET /admin/api/tevt
router.get('/tevt', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tevt'); } catch (_) {}
  if (!svc) return res.json({ stats: null, active: [] });
  try {
    const [stats, active] = await Promise.all([
      svc.getAdminStats(),
      svc.getActiveEvents()
    ]);
    res.json({ stats, active });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/api/tevt/:id — force-expire an event
router.delete('/tevt/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE territory_events SET is_active=false WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'tevt_force_expire', `tevt:${req.params.id}`, {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/tevt/setting
router.post('/tevt/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tevt_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tevt_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Colony Prestige Admin (Migration 132) ────────────────────────────────────

// GET /admin/api/prestige
router.get('/prestige', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/prestige'); } catch (_) {}
  if (!svc) return res.json({ stats: null, dist: [] });
  try {
    const [{ stats, dist }, lb] = await Promise.all([svc.getAdminStats(), svc.getLeaderboard()]);
    res.json({ stats, dist, leaderboard: lb.slice(0, 20) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/api/prestige/setting
router.post('/prestige/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('prestige_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'prestige_setting', key, { value });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Map Beacon Admin (Migration 133) ─────────────────────────────────────────

router.get('/beacons', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/beacon'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/beacons/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE map_beacons SET is_active=false WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'beacon_expire', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/beacons/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('beacon_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'beacon_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Donation Wall Admin (Migration 134) ──────────────────────────────────────

router.get('/donation', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/donation'); } catch (_) {}
  if (!svc) return res.json({ stats: null, top: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/donation/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('donation_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'donation_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GP Polls Admin (Migration 135) ───────────────────────────────────────────

router.get('/polls', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/polls'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/polls/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE gp_polls SET is_active=false WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'poll_close', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/polls/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('poll_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'poll_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GP Status Messages Admin (Migration 136) ─────────────────────────────────

router.get('/status', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/status'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/status/:wallet', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`DELETE FROM player_status WHERE wallet=$1`, [req.params.wallet]);
    await auditLog(req, 'status_clear', req.params.wallet, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/status/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('status_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'status_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GP Territory Description Admin (Migration 137) ───────────────────────────

router.get('/tdesc', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tdesc'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tdesc/:claimId', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`DELETE FROM territory_descriptions WHERE claim_id=$1`, [req.params.claimId]);
    await auditLog(req, 'tdesc_delete', req.params.claimId, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tdesc/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tdesc_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tdesc_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GP Time Capsule Admin (Migration 138) ────────────────────────────────────

router.get('/capsule', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/capsule'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/capsule/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`DELETE FROM time_capsules WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'capsule_delete', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/capsule/reveal/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE time_capsules SET is_revealed=true, revealed_at=NOW() WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'capsule_force_reveal', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/capsule/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('capsule_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'capsule_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GP Territory Sponsor Admin (Migration 139) ───────────────────────────────

router.get('/sponsor', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/sponsor'); } catch (_) {}
  if (!svc) return res.json({ stats: null, recent: [] });
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sponsor/:id', adminAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE territory_sponsors SET is_active=false WHERE id=$1`, [req.params.id]);
    await auditLog(req, 'sponsor_expire', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/sponsor/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('sponsor_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    const { pool } = require('../db');
    await pool.query(`UPDATE game_settings SET value=$1::jsonb WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'sponsor_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Colony Milestone Admin (Migration 150) ──
router.get('/milestone', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/milestone'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/milestone/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/milestone'); } catch(_) {}
    await svc.adminDeleteMilestone(req.params.id);
    await auditLog(req, 'milestone_delete', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/milestone/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('milestone_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'milestone_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Tombstone Admin (Migration 149) ──
router.get('/tombstone', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tombstone'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tombstone/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/tombstone'); } catch(_) {}
    await svc.adminRemoveTombstone(req.params.id);
    await auditLog(req, 'tombstone_remove', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tombstone/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tombstone_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tombstone_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Colony Announcement Admin (Migration 148) ──
router.get('/announce', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/announcement'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/announce/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/announcement'); } catch(_) {}
    await svc.adminExpireAnnouncement(req.params.id);
    await auditLog(req, 'announce_expire', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/announce/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('announce_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'announce_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Prestige Frame Admin (Migration 147) ──
router.get('/tprestige', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tprestige'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tprestige/:claimId', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/tprestige'); } catch(_) {}
    await svc.adminResetPrestige(req.params.claimId);
    await auditLog(req, 'tprestige_reset', req.params.claimId, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tprestige/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tprestige_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tprestige_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Colony Journal Admin (Migration 146) ──
router.get('/journal', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/journal'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/journal/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/journal'); } catch(_) {}
    await svc.adminDeleteEntry(req.params.id);
    await auditLog(req, 'journal_delete', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/journal/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('journal_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'journal_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Victory Banner Admin (Migration 145) ──
router.get('/banner', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/banner'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/banner/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/banner'); } catch(_) {}
    await svc.adminRemoveBanner(req.params.id);
    await auditLog(req, 'banner_remove', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/banner/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('banner_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'banner_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Rating Admin (Migration 144) ──
router.get('/rating', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/rating'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rating/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('rating_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'rating_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Highlight Admin (Migration 143) ──
router.get('/highlight', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/highlight'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/highlight/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/highlight'); } catch(_) {}
    await svc.adminRemoveHighlight(req.params.id);
    await auditLog(req, 'highlight_remove', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/highlight/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('highlight_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'highlight_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Graffiti Admin (Migration 142) ──
router.get('/graffiti', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/graffiti'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/graffiti/:id', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/graffiti'); } catch(_) {}
    await svc.adminDeleteGraffiti(req.params.id);
    await auditLog(req, 'graffiti_delete', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/graffiti/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('graffiti_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'graffiti_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Territory Tribute Admin (Migration 141) ──
router.get('/tribute', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/tribute'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tribute/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM territory_tributes WHERE id = $1', [req.params.id]);
    await auditLog(req, 'tribute_delete', req.params.id, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tribute/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('tribute_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'tribute_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Vanity Tag Admin (Migration 140) ──
router.get('/vtag', adminAuth, async (req, res) => {
  let svc; try { svc = require('../services/vtag'); } catch(_) {}
  try { res.json(await svc.getAdminStats()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/vtag/:wallet', adminAuth, async (req, res) => {
  try {
    let svc; try { svc = require('../services/vtag'); } catch(_) {}
    await svc.adminDeleteTag(req.params.wallet);
    await auditLog(req, 'vtag_delete', req.params.wallet, {});
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/vtag/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !key.startsWith('vtag_')) return res.status(400).json({ error: 'Invalid key' });
  try {
    await pool.query(`UPDATE settings SET value=$1 WHERE key=$2`, [JSON.stringify(value), key]);
    await auditLog(req, 'vtag_setting', key, { value });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
//  PHASE D: Guild-War 72h + 1:1 Duel + 3-Guild Alliance admin
// ══════════════════════════════════════════════════════════════════

const PHASE_D_SETTING_KEYS = [
  // Guild War
  'guild_war_duration_hours_default',
  'guild_war_min_stake_gp',
  'guild_war_max_stake_gp',
  'guild_war_truce_min_hours',
  'guild_war_winner_pot_pct',
  // Duel
  'duel_default_expiry_hours',
  'duel_min_stake_gp',
  'duel_max_stake_gp',
  'duel_max_pending_per_pair',
  'duel_max_active_per_user',
  // Alliance
  'alliance_max_guilds',
  'alliance_min_guilds',
  'alliance_betrayal_cooldown_hours',
  'alliance_chronicle_betrayal_enabled'
];

// GET /admin/api/phase-d/settings — fetch all 14 Phase D settings
router.get('/phase-d/settings', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT key, value, description, category FROM settings WHERE key = ANY($1::text[])',
      [PHASE_D_SETTING_KEYS]
    );
    const out = {};
    for (const row of r.rows) {
      // JSONB value: unwrap to primitive for editing
      let v = row.value;
      if (typeof v === 'string' && /^".*"$/.test(v)) v = v.slice(1, -1);
      out[row.key] = {
        value: row.value,
        description: row.description,
        category: row.category
      };
    }
    res.json({ settings: out, keys: PHASE_D_SETTING_KEYS });
  } catch (e) {
    console.error('[Admin] phase-d/settings error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/phase-d/setting — update a single Phase D setting
router.post('/phase-d/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !PHASE_D_SETTING_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid or non-Phase-D key' });
  }
  try {
    const r = await pool.query(
      'UPDATE settings SET value=$1, updated_at=NOW() WHERE key=$2 RETURNING key',
      [JSON.stringify(value), key]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Setting not found' });
    await auditLog(req, 'phase_d_setting_update', key, { value });
    res.json({ ok: true, key, value });
  } catch (e) {
    console.error('[Admin] phase-d/setting error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-d/duel-stats — per-status counts + GP volume + recent fought
router.get('/phase-d/duel-stats', adminAuth, async (req, res) => {
  try {
    let svc = null;
    try { svc = require('../services/duel'); } catch (_) {}
    const stats = svc && svc.getAdminStats ? await svc.getAdminStats() : { total: 0, by_status: {}, total_gp: 0 };
    const recent = await pool.query(
      `SELECT d.id, d.challenger, d.defender, d.wager_gp, d.status, d.winner,
              d.created_at, d.resolved_at,
              uc.nickname AS challenger_nick, ud.nickname AS defender_nick
         FROM gp_duels d
         LEFT JOIN users uc ON uc.wallet_address = d.challenger
         LEFT JOIN users ud ON ud.wallet_address = d.defender
        ORDER BY d.created_at DESC
        LIMIT 30`
    );
    res.json({ stats, recent: recent.rows });
  } catch (e) {
    console.error('[Admin] phase-d/duel-stats error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-d/alliance-guilds — active 길드-동맹 composition
router.get('/phase-d/alliance-guilds', adminAuth, async (req, res) => {
  try {
    const composition = await pool.query(
      `SELECT ag.alliance_id,
              a.name AS alliance_name,
              COUNT(*) FILTER (WHERE ag.left_at IS NULL) AS active_guilds,
              ARRAY_AGG(
                JSON_BUILD_OBJECT(
                  'guild_id', ag.guild_id,
                  'guild_name', g.name,
                  'guild_tag', g.tag,
                  'joined_at', ag.joined_at,
                  'left_at', ag.left_at,
                  'betrayed_to', ag.betrayed_to
                ) ORDER BY ag.joined_at DESC
              ) AS guilds
         FROM alliance_guilds ag
         LEFT JOIN alliances a ON a.id = ag.alliance_id
         LEFT JOIN guilds g ON g.id = ag.guild_id
        WHERE ag.left_at IS NULL
        GROUP BY ag.alliance_id, a.name
        ORDER BY active_guilds DESC, ag.alliance_id ASC
        LIMIT 50`
    );
    res.json({ alliances: composition.rows });
  } catch (e) {
    console.error('[Admin] phase-d/alliance-guilds error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-d/betrayal-log — recent betrayals (guild switched alliance)
router.get('/phase-d/betrayal-log', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ag.id, ag.guild_id, g.name AS guild_name, g.tag AS guild_tag,
              ag.alliance_id AS from_alliance_id, af.name AS from_alliance_name,
              ag.betrayed_to AS to_alliance_id, at_.name AS to_alliance_name,
              ag.betrayed_at
         FROM alliance_guilds ag
         LEFT JOIN guilds g ON g.id = ag.guild_id
         LEFT JOIN alliances af ON af.id = ag.alliance_id
         LEFT JOIN alliances at_ ON at_.id = ag.betrayed_to
        WHERE ag.betrayed_at IS NOT NULL
        ORDER BY ag.betrayed_at DESC
        LIMIT 50`
    );
    res.json({ betrayals: r.rows });
  } catch (e) {
    console.error('[Admin] phase-d/betrayal-log error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
//  PHASE A: Sector tariff + entry admin
// ══════════════════════════════════════════════════════════════════

const SECTOR_PHASE_A_KEYS = [
  'sector_entry_check_enabled',
  'sector_tariff_enabled',
  'sector_tariff_pct',
  'sector_tariff_uses_per_sector',
  'sector_tariff_guild_exempt',
  'sector_tariff_min_listing_pp'
];

// GET /admin/api/sector-access/settings — Phase A sector-level settings
router.get('/sector-access/settings', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT key, value, description, category FROM settings WHERE key = ANY($1::text[])',
      [SECTOR_PHASE_A_KEYS]
    );
    const out = {};
    for (const row of r.rows) {
      out[row.key] = { value: row.value, description: row.description, category: row.category };
    }
    res.json({ settings: out, keys: SECTOR_PHASE_A_KEYS });
  } catch (e) {
    console.error('[Admin] sector-access/settings error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/sector-access/setting — update one
router.post('/sector-access/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !SECTOR_PHASE_A_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  try {
    const r = await pool.query(
      'UPDATE settings SET value=$1, updated_at=NOW() WHERE key=$2 RETURNING key',
      [JSON.stringify(value), key]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    await auditLog(req, 'sector_access_setting_update', key, { value });
    res.json({ ok: true, key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/sector-access/tariff-log — recent tariff revenue events
router.get('/sector-access/tariff-log', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.id, t.sector_id, s.name AS sector_name, t.governor_wallet, t.payer_wallet,
              t.source, t.source_ref_id, t.gross_amount, t.tariff_pct, t.tariff_amount,
              t.guild_exempted, t.created_at,
              gu.nickname AS governor_nick, pu.nickname AS payer_nick
         FROM sector_tariff_log t
         LEFT JOIN sectors s ON s.id = t.sector_id
         LEFT JOIN users gu ON gu.wallet_address = t.governor_wallet
         LEFT JOIN users pu ON pu.wallet_address = t.payer_wallet
        ORDER BY t.created_at DESC
        LIMIT 50`
    );
    // Aggregate summary
    const summary = await pool.query(
      `SELECT COUNT(*)::int AS events,
              COALESCE(SUM(tariff_amount),0)::numeric(20,8) AS total_collected,
              COUNT(*) FILTER (WHERE guild_exempted)::int AS exempted_count
         FROM sector_tariff_log
        WHERE created_at > NOW() - INTERVAL '30 days'`
    );
    res.json({ log: r.rows, summary: summary.rows[0] || {} });
  } catch (e) {
    console.error('[Admin] tariff-log error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/phase-d/duel/:id/cancel — force-cancel a pending/accepted duel, refund wager
router.post('/phase-d/duel/:id/cancel', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid duel id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = await client.query(
      'SELECT * FROM gp_duels WHERE id=$1 FOR UPDATE', [id]
    );
    if (!d.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const duel = d.rows[0];
    if (!['pending', 'accepted'].includes(duel.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not cancellable (status=' + duel.status + ')' });
    }
    // Refund wager to challenger (and defender if accepted)
    if (duel.wager_gp > 0) {
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [duel.wager_gp, duel.challenger]
      );
      if (duel.status === 'accepted') {
        await client.query(
          'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [duel.wager_gp, duel.defender]
        );
      }
    }
    await client.query(
      `UPDATE gp_duels SET status='cancelled', resolved_at=NOW() WHERE id=$1`,
      [id]
    );
    await client.query('COMMIT');
    await auditLog(req, 'phase_d_duel_force_cancel', 'duel:'+id, { refundedGp: duel.wager_gp });
    res.json({ ok: true, id, refundedGp: duel.wager_gp });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Admin] phase-d/duel cancel error:', e.message);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ══════════════════════════════════════════════════════════════════
//  PHASE C: Transport + Raid admin
// ══════════════════════════════════════════════════════════════════

const PHASE_C_SETTING_KEYS = [
  // Transport (9)
  'transport_enabled',
  'transport_base_duration_minutes',
  'transport_distance_multiplier',
  'transport_reward_pct_of_cargo',
  'transport_reward_distance_bonus_pct',
  'transport_min_cargo_gp',
  'transport_max_cargo_gp',
  'transport_max_concurrent_per_user',
  'transport_entry_level_check',
  // Raid (8)
  'transport_raid_enabled',
  'transport_raid_success_base_pct',
  'transport_raid_loot_pct',
  'transport_raid_cooldown_minutes',
  'transport_raid_min_progress_pct',
  'transport_raid_max_progress_pct',
  'transport_raid_self_exempt',
  'transport_raid_guild_exempt'
];

// GET /admin/api/phase-c/settings — all 17 Phase C settings
router.get('/phase-c/settings', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT key, value, description, category FROM settings WHERE key = ANY($1::text[])',
      [PHASE_C_SETTING_KEYS]
    );
    const out = {};
    for (const row of r.rows) {
      out[row.key] = { value: row.value, description: row.description, category: row.category };
    }
    res.json({ settings: out, keys: PHASE_C_SETTING_KEYS });
  } catch (e) {
    console.error('[Admin] phase-c/settings error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/phase-c/setting — update one setting (whitelist-enforced)
router.post('/phase-c/setting', adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !PHASE_C_SETTING_KEYS.includes(key)) {
    return res.status(400).json({ error: 'invalid_key' });
  }
  try {
    const jsonVal = (typeof value === 'string') ? JSON.stringify(value) : JSON.stringify(value);
    await pool.query(
      `INSERT INTO settings (category, key, value, description)
         VALUES ('transport', $1, $2::jsonb, '')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, jsonVal]
    );
    await auditLog(req, 'phase_c_setting_update', key, { value });
    res.json({ ok: true, key, value });
  } catch (e) {
    console.error('[Admin] phase-c/setting error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-c/stats — transport + raid aggregate stats
router.get('/phase-c/stats', adminAuth, async (req, res) => {
  try {
    const transportSvc = require('../services/transport');
    const s = await transportSvc.getAdminStats();
    res.json(s);
  } catch (e) {
    console.error('[Admin] phase-c/stats error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-c/recent-transports?limit=20
router.get('/phase-c/recent-transports', adminAuth, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 20);
  try {
    const r = await pool.query(
      `SELECT t.id, t.carrier_wallet, u.nickname AS carrier_nick,
              t.origin_sector_id, t.dest_sector_id,
              so.name AS origin_name, sd.name AS dest_name,
              t.cargo_value, t.reward_gp, t.status, t.merchant_bonus,
              t.started_at, t.arrives_at, t.completed_at,
              t.raided_by, t.raid_loot_gp
         FROM transport_jobs t
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(t.carrier_wallet)
         LEFT JOIN sectors so ON so.id = t.origin_sector_id
         LEFT JOIN sectors sd ON sd.id = t.dest_sector_id
        ORDER BY t.started_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ transports: r.rows });
  } catch (e) {
    console.error('[Admin] phase-c/recent-transports error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/api/phase-c/recent-raids?limit=20
router.get('/phase-c/recent-raids', adminAuth, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 20);
  try {
    const r = await pool.query(
      `SELECT r.id, r.transport_id, r.raider_wallet, ru.nickname AS raider_nick,
              r.success, r.loot_gp, r.fight_roll, r.success_threshold, r.created_at,
              t.carrier_wallet, cu.nickname AS carrier_nick,
              t.cargo_value, t.origin_sector_id, t.dest_sector_id
         FROM transport_raids r
         LEFT JOIN transport_jobs t ON t.id = r.transport_id
         LEFT JOIN users ru ON LOWER(ru.wallet_address) = LOWER(r.raider_wallet)
         LEFT JOIN users cu ON LOWER(cu.wallet_address) = LOWER(t.carrier_wallet)
        ORDER BY r.created_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ raids: r.rows });
  } catch (e) {
    console.error('[Admin] phase-c/recent-raids error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/phase-c/transport/:id/force-complete — manually settle a stuck transport
router.post('/phase-c/transport/:id/force-complete', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tr = await client.query(
      'SELECT * FROM transport_jobs WHERE id=$1 FOR UPDATE', [id]
    );
    if (!tr.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const t = tr.rows[0];
    if (t.status !== 'in_transit') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'not_in_transit' }); }
    const payout = (parseInt(t.cargo_value) || 0) + (parseInt(t.reward_gp) || 0);
    await client.query(
      'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [payout, t.carrier_wallet]
    );
    await client.query(
      `UPDATE transport_jobs SET status='completed', completed_at=NOW(), arrives_at=NOW() WHERE id=$1`,
      [id]
    );
    await client.query('COMMIT');
    await auditLog(req, 'phase_c_force_complete', 'transport:'+id, { payout });
    res.json({ ok: true, id, payout });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Admin] phase-c/force-complete error:', e.message);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ══════════════════════════════════════════════════
// GET /admin/api/ships — 함선 현황 (Fleet Overview)
// ══════════════════════════════════════════════════
router.get('/ships', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const { rows: ships } = await pool.query(`
      SELECT s.id, s.owner_wallet, u.nickname,
             s.ship_type_code AS ship_type,
             s.current_hp AS hp, s.max_hp,
             st.base_atk AS attack, st.base_def AS defense,
             CASE WHEN s.is_alive THEN 'active' ELSE 'destroyed' END AS status,
             s.built_at AS created_at
      FROM ships s
      JOIN users u ON u.wallet_address = s.owner_wallet
      LEFT JOIN ship_types st ON st.code = s.ship_type_code
      ORDER BY s.built_at DESC
      LIMIT $1
    `, [limit]);

    const { rows: stats } = await pool.query(`
      SELECT s.ship_type_code AS ship_type,
             CASE WHEN s.is_alive THEN 'active' ELSE 'destroyed' END AS status,
             COUNT(*) AS cnt
      FROM ships s
      GROUP BY s.ship_type_code, s.is_alive
      ORDER BY s.ship_type_code
    `);

    const { rows: totals } = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE is_alive) AS alive,
             COUNT(*) FILTER (WHERE NOT is_alive) AS destroyed,
             COUNT(*) AS total
      FROM ships
    `);

    res.json({ ships, stats, totals: totals[0] });
  } catch (e) {
    console.error('[Admin] ships error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
// POST /admin/api/fleet/grant-starter — 파벌 스타터 팩 수동 지급 (함선 + 광물)
// ══════════════════════════════════════════════════
router.post('/fleet/grant-starter', adminAuth, async (req, res) => {
  const { wallet, faction: forceFaction } = req.body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  const input = wallet.trim();

  // wallet 주소 조회 — ILIKE(대소문자 무시) + 닉네임 fallback
  let w;
  try {
    // 1) 지갑주소로 직접 검색 (대소문자 무시)
    const { rows: byWallet } = await pool.query(
      `SELECT wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1`, [input]
    );
    if (byWallet[0]) {
      w = byWallet[0].wallet_address;
    } else {
      // 2) 닉네임으로 검색
      const { rows: byNick } = await pool.query(
        `SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1`, [input]
      );
      if (!byNick[0]) return res.status(404).json({ error: 'user_not_found', hint: `'${input}' 유저를 찾을 수 없음` });
      w = byNick[0].wallet_address;
    }
  } catch (lookupErr) {
    return res.status(500).json({ error: 'lookup_failed: ' + lookupErr.message });
  }

  // 자가치유: Railway에 migration 169가 안 돌았을 수 있으므로 트리거 함수를 매번 강제 최신화
  // (settings.value가 JSONB인데 구버전 트리거가 NULLIF(value,'')로 비교하면 'invalid input syntax for type json' 발생)
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_player_ship_limit() RETURNS TRIGGER AS $FN$
      DECLARE
        v_max_per_player INTEGER;
        v_current_count  INTEGER;
        v_total_count    INTEGER;
        v_global_max     INTEGER;
        v_raw_text       TEXT;
      BEGIN
        SELECT max_per_player INTO v_max_per_player FROM ship_types WHERE code = NEW.ship_type_code;
        IF v_max_per_player IS NOT NULL THEN
          SELECT COUNT(*) INTO v_current_count FROM ships
            WHERE owner_wallet = NEW.owner_wallet AND ship_type_code = NEW.ship_type_code AND is_alive = true;
          IF v_current_count >= v_max_per_player THEN
            RAISE EXCEPTION 'SHIP_PLAYER_TYPE_LIMIT: % (max % per player)', NEW.ship_type_code, v_max_per_player;
          END IF;
        END IF;
        SELECT value #>> '{}' INTO v_raw_text FROM settings WHERE category = 'fleet' AND key = 'max_ships_per_player' LIMIT 1;
        BEGIN
          v_global_max := COALESCE(NULLIF(TRIM(v_raw_text), ''), '200')::INTEGER;
        EXCEPTION WHEN OTHERS THEN v_global_max := 200;
        END;
        IF v_global_max IS NULL OR v_global_max <= 0 THEN v_global_max := 200; END IF;
        SELECT COUNT(*) INTO v_total_count FROM ships WHERE owner_wallet = NEW.owner_wallet AND is_alive = true;
        IF v_total_count >= v_global_max THEN
          RAISE EXCEPTION 'SHIP_PLAYER_TOTAL_LIMIT: max % ships per player', v_global_max;
        END IF;
        RETURN NEW;
      END;
      $FN$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_titan_server_limit() RETURNS TRIGGER AS $FN$
      DECLARE
        v_max_per_server INTEGER;
        v_current_count  INTEGER;
      BEGIN
        SELECT max_per_server INTO v_max_per_server FROM ship_types WHERE code = NEW.ship_type_code;
        IF v_max_per_server IS NOT NULL THEN
          SELECT COUNT(*) INTO v_current_count FROM ships
            WHERE ship_type_code = NEW.ship_type_code AND is_alive = true;
          IF v_current_count >= v_max_per_server THEN
            RAISE EXCEPTION 'SHIP_SERVER_LIMIT_REACHED: % (max %)', NEW.ship_type_code, v_max_per_server;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $FN$ LANGUAGE plpgsql;
    `);
  } catch (healErr) {
    console.warn('[Admin] grant-starter trigger heal warning:', healErr.message);
  }

  const client = await pool.connect();
  let step = 'begin';
  try {
    await client.query('BEGIN');
    // 유저 파벌 확인
    const { rows: uRows } = await client.query(
      `SELECT faction_code FROM users WHERE wallet_address = $1`, [w]
    );
    if (!uRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'user_not_found' }); }
    // 파벌: 유저 파벌 우선, 없으면 forceFaction, 그래도 없으면 mcc 기본
    let factionCode = uRows[0].faction_code || forceFaction || 'mcc';
    if (!uRows[0].faction_code) {
      // 파벌 DB에도 저장
      await client.query(`UPDATE users SET faction_code = $1 WHERE LOWER(wallet_address) = LOWER($2)`, [factionCode, w]);
    }

    // 함대 생성 or 조회
    let fleetId;
    step = 'fleet_select';
    const { rows: existingFleets } = await client.query(
      `SELECT id FROM fleets WHERE owner_wallet = $1 LIMIT 1`, [w]
    );
    if (existingFleets.length === 0) {
      step = 'fleet_insert';
      // is_npc 컬럼 없는 구 버전 DB 대응
      const hasIsNpc = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name='fleets' AND column_name='is_npc'`);
      const fleetSql = hasIsNpc.rows.length
        ? `INSERT INTO fleets (owner_wallet, name, is_npc) VALUES ($1, '1함대', false) RETURNING id`
        : `INSERT INTO fleets (owner_wallet, name) VALUES ($1, '1함대') RETURNING id`;
      const { rows: nf } = await client.query(fleetSql, [w]);
      fleetId = nf[0].id;
    } else {
      fleetId = existingFleets[0].id;
    }

    // 스타터 함선 지급
    step = 'ship_check';
    let shipGranted = null;
    const { rows: shipCheck } = await client.query(
      `SELECT 1 FROM ships WHERE owner_wallet = $1 AND is_alive = true LIMIT 1`, [w]
    );
    if (shipCheck.length === 0) {
      step = 'ship_type_select';
      const { rows: stTypes } = await client.query(
        `SELECT code, name_ko, base_hp FROM ship_types
         WHERE faction_code = $1 AND is_active = true AND size_class = 'frigate'
         ORDER BY build_gp_cost ASC LIMIT 1`,
        [factionCode]
      );
      if (stTypes.length > 0) {
        const st = stTypes[0];
        step = 'ship_insert';
        // built_by_wallet 컬럼 없는 구 버전 DB 대응
        const hasBbw = await client.query(`
          SELECT 1 FROM information_schema.columns
          WHERE table_name='ships' AND column_name='built_by_wallet'`);
        const shipSql = hasBbw.rows.length
          ? `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, built_by_wallet) VALUES ($1,$2,$3,$4,$4,true,$3)`
          : `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship) VALUES ($1,$2,$3,$4,$4,true)`;
        await client.query(shipSql, [fleetId, st.code, w, st.base_hp]);
        shipGranted = { code: st.code, name: st.name_ko };
      }
    } else {
      shipGranted = 'already_has_ships';
    }

    // 스타터 광물 지급 (resources/user_resource_inventory 없으면 스킵)
    const starterMinerals = { iron_ore: 20, carbon_fiber: 20, silicon_chip: 10 };
    let mineralsGranted = {};
    try {
      // 테이블 존재 여부 체크
      const { rows: tCheck } = await client.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_name IN ('resources','user_resource_inventory')
        AND table_schema = 'public'
      `);
      if (tCheck.length === 2) {
        for (const [code, qty] of Object.entries(starterMinerals)) {
          const { rows: rRows } = await client.query(`SELECT id FROM resources WHERE code = $1 LIMIT 1`, [code]);
          if (!rRows[0]) continue;
          await client.query(`
            INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (wallet_address, resource_id)
            DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity
          `, [w, rRows[0].id, qty]);
          mineralsGranted[code] = qty;
        }
      }
    } catch (mineralErr) {
      console.warn('[Admin] grant-starter mineral skip:', mineralErr.message);
    }

    await client.query('COMMIT');
    try { await auditLog(req, 'grant_starter_pack', w, { shipGranted, minerals: mineralsGranted, fleetId: String(fleetId) }); } catch(_) {}
    res.json({ success: true, wallet: w, faction: factionCode, fleet_id: fleetId, ship: shipGranted, minerals: mineralsGranted });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch(_) {}
    console.error('[Admin] grant-starter error at step=' + (typeof step !== 'undefined' ? step : '?') + ':', e.message);
    res.status(500).json({ error: '[' + (typeof step !== 'undefined' ? step : '?') + '] ' + e.message });
  } finally { client.release(); }
});

// ══════════════════════════════════════════════════
// POST /admin/api/fleet/grant-starter-all-npcs — 모든 NPC에 스타터 일괄 지급
// ══════════════════════════════════════════════════
router.post('/fleet/grant-starter-all-npcs', adminAuth, async (req, res) => {
  // 트리거 자가치유 (위 grant-starter와 동일 — Railway migration 누락 대응)
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_player_ship_limit() RETURNS TRIGGER AS $FN$
      DECLARE
        v_max_per_player INTEGER; v_current_count INTEGER;
        v_total_count INTEGER; v_global_max INTEGER; v_raw_text TEXT;
      BEGIN
        SELECT max_per_player INTO v_max_per_player FROM ship_types WHERE code = NEW.ship_type_code;
        IF v_max_per_player IS NOT NULL THEN
          SELECT COUNT(*) INTO v_current_count FROM ships
            WHERE owner_wallet = NEW.owner_wallet AND ship_type_code = NEW.ship_type_code AND is_alive = true;
          IF v_current_count >= v_max_per_player THEN
            RAISE EXCEPTION 'SHIP_PLAYER_TYPE_LIMIT: % (max % per player)', NEW.ship_type_code, v_max_per_player;
          END IF;
        END IF;
        SELECT value #>> '{}' INTO v_raw_text FROM settings WHERE category = 'fleet' AND key = 'max_ships_per_player' LIMIT 1;
        BEGIN v_global_max := COALESCE(NULLIF(TRIM(v_raw_text), ''), '200')::INTEGER;
        EXCEPTION WHEN OTHERS THEN v_global_max := 200; END;
        IF v_global_max IS NULL OR v_global_max <= 0 THEN v_global_max := 200; END IF;
        SELECT COUNT(*) INTO v_total_count FROM ships WHERE owner_wallet = NEW.owner_wallet AND is_alive = true;
        IF v_total_count >= v_global_max THEN
          RAISE EXCEPTION 'SHIP_PLAYER_TOTAL_LIMIT: max % ships per player', v_global_max;
        END IF;
        RETURN NEW;
      END;
      $FN$ LANGUAGE plpgsql;
    `);
  } catch (_) {}

  // 픽셀 소유 NPC 먼저 users에 등록 (없는 경우만)
  try {
    await pool.query(`
      INSERT INTO users (wallet_address, email, password_hash, nickname, is_ai, ai_difficulty, faction_code, faction_chosen_at, gp_balance, pp_balance, usdt_balance)
      SELECT DISTINCT
        p.owner,
        p.owner || '@npc.mars',
        '$npc$',
        replace(replace(p.owner, '0xnpc_', ''), '_', ' '),
        true, 'easy',
        (ARRAY['mcc','fsp','cv'])[1 + floor(random()*3)::int],
        NOW(), 50000, 0, 0
      FROM pixels p
      WHERE p.owner LIKE '0xnpc_%' AND p.owner IS NOT NULL
      ON CONFLICT (wallet_address) DO NOTHING
    `);
  } catch (_) {}

  // NPC 목록 조회 — 픽셀 소유 NPC 우선, 나머지도 포함
  let npcs;
  try {
    const r = await pool.query(
      `SELECT wallet_address, faction_code FROM users WHERE wallet_address LIKE '0xnpc_%' ORDER BY wallet_address`
    );
    npcs = r.rows;
  } catch (e) {
    return res.status(500).json({ error: 'list_failed: ' + e.message });
  }

  if (npcs.length === 0) return res.json({ success: true, total: 0, granted: 0, skipped: 0, message: 'No NPCs found' });

  // 컬럼/테이블 존재 여부 (한 번만 체크)
  const hasIsNpc      = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='fleets' AND column_name='is_npc'`)).rows.length > 0;
  const hasBbw        = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='ships' AND column_name='built_by_wallet'`)).rows.length > 0;
  const hasResources  = (await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name IN ('resources','user_resource_inventory') AND table_schema='public'`)).rows.length === 2;

  const starterMinerals = { iron_ore: 20, carbon_fiber: 20, silicon_chip: 10 };
  const factionDefault = ['mcc', 'fsp', 'cv'];

  const summary = { total: npcs.length, granted: 0, alreadyHad: 0, errors: [] };

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const w = npc.wallet_address;
    const faction = npc.faction_code || factionDefault[i % 3];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!npc.faction_code) {
        await client.query(`UPDATE users SET faction_code=$1 WHERE LOWER(wallet_address)=LOWER($2)`, [faction, w]);
      }
      // 함대 확보
      let fleetId;
      const { rows: ef } = await client.query(`SELECT id FROM fleets WHERE owner_wallet=$1 LIMIT 1`, [w]);
      if (ef[0]) fleetId = ef[0].id;
      else {
        const fSql = hasIsNpc
          ? `INSERT INTO fleets (owner_wallet, name, is_npc) VALUES ($1, '1함대', true) RETURNING id`
          : `INSERT INTO fleets (owner_wallet, name) VALUES ($1, '1함대') RETURNING id`;
        const { rows: nf } = await client.query(fSql, [w]);
        fleetId = nf[0].id;
      }
      // 함선 체크 후 지급
      const { rows: sc } = await client.query(`SELECT 1 FROM ships WHERE owner_wallet=$1 AND is_alive=true LIMIT 1`, [w]);
      if (sc.length === 0) {
        const { rows: stTypes } = await client.query(
          `SELECT code, base_hp FROM ship_types WHERE faction_code=$1 AND is_active=true AND size_class='frigate' ORDER BY build_gp_cost ASC LIMIT 1`,
          [faction]
        );
        if (stTypes[0]) {
          const st = stTypes[0];
          const sSql = hasBbw
            ? `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, built_by_wallet) VALUES ($1,$2,$3,$4,$4,true,$3)`
            : `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship) VALUES ($1,$2,$3,$4,$4,true)`;
          await client.query(sSql, [fleetId, st.code, w, st.base_hp]);
          summary.granted++;
        }
      } else {
        summary.alreadyHad++;
      }
      // 광물
      if (hasResources) {
        for (const [code, qty] of Object.entries(starterMinerals)) {
          const { rows: rr } = await client.query(`SELECT id FROM resources WHERE code=$1 LIMIT 1`, [code]);
          if (!rr[0]) continue;
          await client.query(
            `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity) VALUES ($1,$2,$3)
             ON CONFLICT (wallet_address, resource_id) DO UPDATE SET quantity=user_resource_inventory.quantity+EXCLUDED.quantity`,
            [w, rr[0].id, qty]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch(_) {}
      summary.errors.push({ wallet: w, error: e.message });
    } finally {
      client.release();
    }
  }

  try { await auditLog(req, 'grant_starter_all_npcs', null, summary); } catch(_) {}
  res.json({ success: true, ...summary });
});

// ══════════════════════════════════════════════════
// GET /admin/api/fleet/npc-status — NPC 함대/함선 현황 진단
// "왜 하이젝이 자동승리로 끝나는가" 추적용
// ══════════════════════════════════════════════════
router.get('/fleet/npc-status', adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        powners.owner AS wallet_address,
        COALESCE(u.nickname, replace(replace(powners.owner,'0xnpc_',''),'_',' ')) AS nickname,
        u.faction_code,
        COUNT(DISTINCT px.lat)::int AS pixel_count,
        COUNT(DISTINCT f.id)::int   AS fleet_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive = true)::int AS alive_ships
      FROM (SELECT DISTINCT owner FROM pixels WHERE owner LIKE '0xnpc_%' AND owner IS NOT NULL) powners
      JOIN pixels px ON px.owner = powners.owner
      LEFT JOIN users u ON u.wallet_address = powners.owner
      LEFT JOIN fleets f ON f.owner_wallet = powners.owner
      LEFT JOIN ships s ON s.fleet_id = f.id
      GROUP BY powners.owner, u.nickname, u.faction_code
      ORDER BY powners.owner
    `);
    const total = rows.length;
    const withShips = rows.filter(r => r.alive_ships > 0).length;
    const willAutoWin = total - withShips;
    res.json({
      summary: { total, withFleet: rows.filter(r => r.fleet_count > 0).length, withShips, willAutoWin },
      hint: willAutoWin > 0
        ? `${willAutoWin}명의 맵 NPC가 함선 없음 — hijack 시 자동 승리. 'NPC 일괄 지급' 버튼을 눌러 지급하세요.`
        : '모든 맵 NPC가 함선 보유 — hijack 시 정상 fleet battle 발생.',
      npcs: rows
    });
  } catch (e) {
    console.error('[admin /fleet/npc-status] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
// Governance cleanup — 거버너/커맨더/공지 강제 정리
// "임기 종료된 거버너가 화면에 남는다" 신고 대응. 자동 expire 로직 없으므로
// admin 이 강제로 클리어할 수 있는 path 제공.
// ══════════════════════════════════════════════════

// POST /admin/api/governance/commander/clear — commander 자리 비우기 + announcement 클리어
router.post('/governance/commander/clear', adminAuth, async (req, res) => {
  try {
    await pool.query("UPDATE commander SET commander_wallet = NULL, commander_since = NULL, vice_commander_wallet = NULL, vice_commander_since = NULL, announcement = NULL WHERE id = 1");
    try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
    await auditLog(req, 'governance_commander_clear', null, {});
    res.json({ success: true });
  } catch (e) {
    console.error('[admin /governance/commander/clear]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/governance/sector/:id/clear — 특정 섹터 governor 자리 비우기 + sector announcement 클리어
router.post('/governance/sector/:id/clear', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid sector id' });
    await pool.query("UPDATE sectors SET governor_wallet = NULL, governor_since = NULL, vice_governor_wallet = NULL, vice_governor_since = NULL, announcement = NULL WHERE id = $1", [id]);
    await pool.query("DELETE FROM governance_positions WHERE sector_id = $1", [id]);
    try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
    await auditLog(req, 'governance_sector_clear', `sector:${id}`, {});
    res.json({ success: true });
  } catch (e) {
    console.error('[admin /governance/sector/clear]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/api/governance/clear-all — 모든 거버너 + 커맨더 + 공지 클리어 (claims/pixels 는 유지)
router.post('/governance/clear-all', adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE sectors SET governor_wallet = NULL, governor_since = NULL, vice_governor_wallet = NULL, vice_governor_since = NULL, announcement = NULL");
    await client.query("DELETE FROM governance_positions");
    await client.query("UPDATE commander SET commander_wallet = NULL, commander_since = NULL, vice_commander_wallet = NULL, vice_commander_since = NULL, announcement = NULL WHERE id = 1");
    await client.query('COMMIT');
    try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
    await auditLog(req, 'governance_clear_all', null, {});
    res.json({ success: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch(_) {}
    console.error('[admin /governance/clear-all]', e.message);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ─── [v7.166] Sybil chain 감지 — 의심 wallet 목록 / 수동 스캔 / 검토 처리 ───
router.get('/suspicious-wallets', async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toLowerCase(); // 'pending'|'reviewed'|'all'
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const where = status === 'pending' ? 'WHERE reviewed = false' : status === 'reviewed' ? 'WHERE reviewed = true' : '';
    const { rows } = await pool.query(
      `SELECT id, wallet, pair_wallet, flag_type, severity, evidence, detected_at, reviewed, action_taken
         FROM suspicious_wallet_flags ${where}
         ORDER BY severity DESC, detected_at DESC LIMIT $1`, [limit]
    );
    res.json({ count: rows.length, flags: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suspicious-wallets/scan', async (req, res) => {
  // 즉시 수동 스캔 — 스케줄러 대기 없이 운영자가 트리거
  try {
    const r = await require('../services/sybilDetect').detectSelfTradeChains();
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suspicious-wallets/:id/review', async (req, res) => {
  // 검토 처리 — action_taken: 'observe' | 'restrict' | 'ban' | 'dismiss'
  try {
    const action = (req.body?.action || 'observe').toLowerCase();
    const reviewer = req.headers['x-admin-key'] || 'admin';
    await pool.query(
      `UPDATE suspicious_wallet_flags
         SET reviewed = true, reviewed_at = NOW(), reviewed_by = $1, action_taken = $2
         WHERE id = $3`,
      [reviewer.slice(0, 64), action.slice(0, 32), parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
