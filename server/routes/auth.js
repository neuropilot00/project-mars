const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, ensureUser, generateReferralCode } = require('../db');
const { sendResetCode, isSmtpConfigured } = require('../services/email');

const router = express.Router();

// ── Shared input sanitizer ──
function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/<[^>]*>/g, '');
}

if (!process.env.JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET environment variable is not set. Cannot start auth module.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '30d';

// ── Password policy validation ──
function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Password must contain a special character';
  return null;
}

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

  // Validate email format and length
  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate nickname if provided
  if (nickname !== undefined && nickname !== null && nickname !== '') {
    if (typeof nickname !== 'string' || nickname.length > 50) {
      return res.status(400).json({ error: 'Nickname too long (max 50 chars)' });
    }
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(nickname)) {
      return res.status(400).json({ error: 'Nickname may only contain letters, numbers, underscores, hyphens, dots, and spaces' });
    }
  }

  const pwError = validatePassword(password);
  if (pwError) {
    return res.status(400).json({ error: pwError });
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

    // Gift PP bonus to new users (configurable via admin settings)
    const bonusRes = await client.query("SELECT value FROM settings WHERE key = 'signup_pp_bonus'");
    const signupBonus = bonusRes.rows.length ? Number(bonusRes.rows[0].value) : 0;
    if (signupBonus > 0) {
      await client.query(
        `UPDATE users SET pp_balance = pp_balance + $2 WHERE wallet_address = $1`,
        [walletAddress, signupBonus]
      );
      console.log(`[Auth] Gifted ${signupBonus} PP to new user ${walletAddress}`);
    }

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

  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
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
//  POST /api/auth/update-profile — Update nickname
// ══════════════════════════════════════════════════
router.post('/update-profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const { nickname } = req.body;

    if (!nickname || nickname.length > 50) {
      return res.status(400).json({ error: 'Invalid nickname (1-50 chars)' });
    }

    // Reject HTML/script tags
    if (/<[^>]*>/g.test(nickname)) {
      return res.status(400).json({ error: 'Nickname must not contain HTML or script tags' });
    }

    const cleanNickname = sanitize(nickname, 50);

    await pool.query(
      'UPDATE users SET nickname = $1 WHERE wallet_address = $2',
      [cleanNickname, decoded.wallet]
    );

    console.log(`[Auth] Profile updated: ${decoded.wallet} → ${cleanNickname}`);
    res.json({ success: true, nickname: cleanNickname });
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    console.error('[Auth] update-profile error:', e.message);
    res.status(500).json({ error: 'Failed' });
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

  // Basic wallet address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  const newWallet = walletAddress.toLowerCase();

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }

  const oldWallet = decoded.wallet;

  // Cannot link to the same address
  if (newWallet === oldWallet.toLowerCase()) {
    return res.status(400).json({ error: 'New wallet address is the same as current' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check the new walletAddress isn't already registered to another user
    const existing = await client.query(
      'SELECT wallet_address FROM users WHERE wallet_address = $1',
      [newWallet]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Wallet address already registered to another account' });
    }

    // 2. Fetch current user data
    const userRes = await client.query(
      'SELECT wallet_address, email, nickname, usdt_balance, pp_balance, referral_code, referred_by, password_hash, withdrawal_nonce FROM users WHERE wallet_address = $1',
      [oldWallet]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];

    // 3. Insert new user row with the real wallet address and all balances
    await client.query(
      `INSERT INTO users (wallet_address, email, password_hash, nickname, usdt_balance, pp_balance, referral_code, referred_by, withdrawal_nonce)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [newWallet, user.email, user.password_hash, user.nickname,
       user.usdt_balance, user.pp_balance, user.referral_code, user.referred_by, user.withdrawal_nonce]
    );

    // 4. Transfer all deposits references
    await client.query(
      'UPDATE deposits SET wallet_address = $1 WHERE wallet_address = $2',
      [newWallet, oldWallet]
    );

    // 5. Transfer pixel ownership
    await client.query(
      'UPDATE pixels SET owner = $1 WHERE owner = $2',
      [newWallet, oldWallet]
    );

    // 6. Transfer claim ownership
    await client.query(
      'UPDATE claims SET owner = $1 WHERE owner = $2',
      [newWallet, oldWallet]
    );

    // 7. Update transaction references
    await client.query(
      'UPDATE transactions SET from_wallet = $1 WHERE from_wallet = $2',
      [newWallet, oldWallet]
    );
    await client.query(
      'UPDATE transactions SET to_wallet = $1 WHERE to_wallet = $2',
      [newWallet, oldWallet]
    );

    // 8. Update referral references (users who were referred by old wallet)
    await client.query(
      'UPDATE users SET referred_by = $1 WHERE referred_by = $2',
      [newWallet, oldWallet]
    );

    // 9. Update referral rewards references
    await client.query(
      'UPDATE referral_rewards SET from_wallet = $1 WHERE from_wallet = $2',
      [newWallet, oldWallet]
    );
    await client.query(
      'UPDATE referral_rewards SET to_wallet = $1 WHERE to_wallet = $2',
      [newWallet, oldWallet]
    );

    // 10. Delete the old custodial user row
    await client.query(
      'DELETE FROM users WHERE wallet_address = $1',
      [oldWallet]
    );

    // 11. Log the wallet migration as a transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, to_wallet, meta)
       VALUES ('deposit', $1, $2, $3)`,
      [oldWallet, newWallet, JSON.stringify({ action: 'wallet_link', old_custodial: oldWallet })]
    );

    await client.query('COMMIT');

    // 12. Issue new JWT with updated wallet address
    const newToken = jwt.sign(
      { wallet: newWallet, email: user.email, nickname: user.nickname },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    console.log(`[Auth] Wallet linked: ${oldWallet} → ${newWallet} (${user.email})`);

    res.json({
      success: true,
      message: 'Wallet linked successfully',
      token: newToken,
      user: {
        wallet: newWallet,
        email: user.email,
        nickname: user.nickname,
        referralCode: user.referral_code
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Auth] link-wallet error:', e.message);
    res.status(500).json({ error: 'Failed to link wallet' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/auth/find-email — Find email by nickname + wallet hint
// ══════════════════════════════════════════════════
router.post('/find-email', async (req, res) => {
  const { nickname } = req.body;

  if (!nickname) {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  if (typeof nickname !== 'string' || nickname.length > 50) {
    return res.status(400).json({ error: 'Nickname too long (max 50 chars)' });
  }

  const cleanNick = sanitize(nickname, 50);

  try {
    const result = await pool.query(
      'SELECT email, wallet_address FROM users WHERE LOWER(nickname) = LOWER($1)',
      [cleanNick]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No account found with that nickname' });
    }

    // Mask email for privacy: show first 2 chars + *** + domain
    const email = result.rows[0].email;
    const [local, domain] = email.split('@');
    const masked = local.slice(0, 2) + '***@' + domain;

    res.json({
      success: true,
      maskedEmail: masked,
      walletHint: result.rows[0].wallet_address.slice(0, 8) + '...'
    });
  } catch (e) {
    console.error('[Auth] find-email error:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/auth/reset-password — Step 1: Request a reset code
// ══════════════════════════════════════════════════
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
  }

  const normalizedEmail = email.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email exists and has a password
    const userRes = await client.query(
      'SELECT wallet_address, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No account found with that email' });
    }

    if (!userRes.rows[0].password_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This account uses wallet login only' });
    }

    // Rate limit: max 3 reset requests per email per hour
    const rateLimitRes = await client.query(
      `SELECT COUNT(*) as cnt FROM password_reset_tokens
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [normalizedEmail]
    );
    if (parseInt(rateLimitRes.rows[0].cnt, 10) >= 3) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
    }

    // Generate a random 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store in DB with 10 minute expiry
    await client.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [normalizedEmail, code]
    );

    await client.query('COMMIT');

    // Send the code via email
    const emailSent = await sendResetCode(normalizedEmail, code);

    // Mask email for response
    const [local, domain] = normalizedEmail.split('@');
    const maskedEmail = local.slice(0, 2) + '***@' + domain;

    const response = {
      success: true,
      message: emailSent ? 'Reset code sent to your email' : 'Reset code generated',
      hint: maskedEmail
    };

    // Only include the code in the response if SMTP is not configured (dev fallback)
    if (!isSmtpConfigured()) {
      response.code = code;
    }

    console.log(`[Auth] Reset code generated for: ${normalizedEmail} (email=${emailSent ? 'sent' : 'not_sent'})`);
    res.json(response);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Auth] reset-password error:', e.message);
    res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/auth/reset-password/verify — Step 2: Verify code & set new password
// ══════════════════════════════════════════════════
router.post('/reset-password/verify', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required' });
  }

  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
  }

  const pwError = validatePassword(newPassword);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  const normalizedEmail = email.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find a valid, unused, non-expired token for this email
    const tokenRes = await client.query(
      `SELECT id FROM password_reset_tokens
       WHERE email = $1 AND token = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, code]
    );

    if (!tokenRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const tokenId = tokenRes.rows[0].id;

    // Mark token as used
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [tokenId]
    );

    // Also invalidate all other unused tokens for this email
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE email = $1 AND used = false',
      [normalizedEmail]
    );

    // Update the password
    const newHash = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [newHash, normalizedEmail]
    );

    await client.query('COMMIT');

    console.log(`[Auth] Password reset completed for: ${normalizedEmail}`);
    res.json({ success: true, message: 'Password has been reset' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Auth] reset-password/verify error:', e.message);
    res.status(500).json({ error: 'Reset verification failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
