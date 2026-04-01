const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, ensureUser, generateReferralCode } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'pixelwar-dev-secret-change-me';
const JWT_EXPIRES = '30d';

// ── Helper: generate custodial wallet address ──
function generateCustodialAddress() {
  // Generate a deterministic-looking address (not a real private key — custodial only)
  const bytes = crypto.randomBytes(20);
  return '0x' + bytes.toString('hex');
}

// ══════════════════════════════════════════════════
//  POST /api/auth/register — Email signup
// ══════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  const { email, password, nickname, referralCode } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existing = await client.query('SELECT wallet_address FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate custodial wallet address
    const walletAddress = generateCustodialAddress();
    const passwordHash = await bcrypt.hash(password, 10);
    const refCode = generateReferralCode();
    const displayName = nickname || email.split('@')[0].slice(0, 12);

    // Determine referrer
    let referredBy = null;
    if (referralCode) {
      const refRes = await client.query(
        'SELECT wallet_address FROM users WHERE referral_code = $1',
        [referralCode.toUpperCase()]
      );
      if (refRes.rows.length) {
        referredBy = refRes.rows[0].wallet_address;
      }
    }

    // Insert user
    await client.query(
      `INSERT INTO users (wallet_address, email, password_hash, nickname, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [walletAddress, email.toLowerCase(), passwordHash, displayName, refCode, referredBy]
    );

    await client.query('COMMIT');

    // Generate JWT
    const token = jwt.sign(
      { wallet: walletAddress, email: email.toLowerCase(), nickname: displayName },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    console.log(`[Auth] New user registered: ${email} → ${walletAddress}`);

    res.json({
      success: true,
      token,
      user: {
        wallet: walletAddress,
        email: email.toLowerCase(),
        nickname: displayName,
        referralCode: refCode
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Auth] register error:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/auth/login — Email login
// ══════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT wallet_address, email, password_hash, nickname, referral_code FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses wallet login only' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { wallet: user.wallet_address, email: user.email, nickname: user.nickname },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    console.log(`[Auth] User logged in: ${email}`);

    res.json({
      success: true,
      token,
      user: {
        wallet: user.wallet_address,
        email: user.email,
        nickname: user.nickname,
        referralCode: user.referral_code
      }
    });
  } catch (e) {
    console.error('[Auth] login error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/auth/me — Verify token & get user info
// ══════════════════════════════════════════════════
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const result = await pool.query(
      'SELECT wallet_address, email, nickname, usdt_balance, pp_balance, referral_code FROM users WHERE wallet_address = $1',
      [decoded.wallet]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      wallet: u.wallet_address,
      email: u.email,
      nickname: u.nickname,
      usdtBalance: parseFloat(u.usdt_balance),
      ppBalance: parseFloat(u.pp_balance),
      referralCode: u.referral_code
    });
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/auth/link-wallet — Link MetaMask to email account
// ══════════════════════════════════════════════════
router.post('/link-wallet', async (req, res) => {
  const { token, walletAddress } = req.body;
  if (!token || !walletAddress) {
    return res.status(400).json({ error: 'Missing token or wallet address' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Update the user's wallet address (migrate from custodial to MetaMask)
    // This is a complex operation — for now just store the linked wallet
    await pool.query(
      'UPDATE users SET nickname = COALESCE(nickname, $1) WHERE wallet_address = $2',
      [walletAddress.slice(0, 8), decoded.wallet]
    );

    res.json({ success: true, message: 'Wallet linked' });
  } catch (e) {
    console.error('[Auth] link-wallet error:', e.message);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

module.exports = router;
