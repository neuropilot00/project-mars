const express = require('express');
const bcrypt = require('bcryptjs');
// [v7.191] bcrypt cost 통일. 이전엔 register/reset=10, change-password=12 로 불일치 → cost 다른 hash 가 DB에 혼재.
//   12 로 통일 (현재 보안 권장). 기존 cost=10 hash 는 그대로 valid (bcrypt 가 cost 포함 저장).
const BCRYPT_COST = 12;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool, ensureUser, generateReferralCode, getPPToGPRate } = require('../db');
const { sendResetCode, isSmtpConfigured } = require('../services/email');

const router = express.Router();

// ── Login Attempt Tracking (in-memory) ──
// Map<email, { attempts: number, firstAttemptAt: number, lockedUntil: number }>
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;  // 30 minutes

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of loginAttempts) {
    if (data.lockedUntil && now > data.lockedUntil) {
      loginAttempts.delete(email);
    } else if (!data.lockedUntil && now - data.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      loginAttempts.delete(email);
    }
  }
}, 10 * 60 * 1000);

function checkLoginLockout(email) {
  const data = loginAttempts.get(email);
  if (!data) return null;

  const now = Date.now();

  // Account is locked
  if (data.lockedUntil && now < data.lockedUntil) {
    const remainingMs = data.lockedUntil - now;
    return {
      locked: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      lockedUntil: new Date(data.lockedUntil).toISOString()
    };
  }

  // Lock expired — reset
  if (data.lockedUntil && now >= data.lockedUntil) {
    loginAttempts.delete(email);
    return null;
  }

  // Attempt window expired — reset
  if (now - data.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(email);
    return null;
  }

  return null;
}

function recordFailedLogin(email) {
  const now = Date.now();
  let data = loginAttempts.get(email);

  if (!data || now - data.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    data = { attempts: 1, firstAttemptAt: now, lockedUntil: null };
    loginAttempts.set(email, data);
    return;
  }

  data.attempts += 1;

  if (data.attempts >= MAX_LOGIN_ATTEMPTS) {
    data.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.log(`[Auth] Account locked for 30 minutes due to ${data.attempts} failed attempts: ${email}`);
  }

  loginAttempts.set(email, data);
}

function resetLoginAttempts(email) {
  loginAttempts.delete(email);
}

// ── Auth Rate Limiters ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Try again in 1 hour.' }
});

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
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, nickname, referralCode, tosAccepted } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Require TOS acceptance for registration
  if (!tosAccepted) {
    return res.status(400).json({ error: 'You must accept the Terms of Service to register' });
  }

  // Validate email format and length
  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // [v7.171 A-M6 fix] 닉네임 정규식 — 한글/일본어/중국어 허용. ASCII-only 차단으로 다국어 사용자 가입 막혔던 결함.
  //   허용: Unicode letter(\p{L}) + 숫자 + 일부 기호. 제어 문자·XSS 메타문자(<>"'`) 차단.
  if (nickname !== undefined && nickname !== null && nickname !== '') {
    if (typeof nickname !== 'string' || nickname.length > 50) {
      return res.status(400).json({ error: 'Nickname too long (max 50 chars)' });
    }
    // 허용 문자: 유니코드 글자/숫자(\p{L}/\p{N}) + 일부 안전 기호. 제어/HTML 메타 차단.
    if (!/^[\p{L}\p{N}_\-. ]+$/u.test(nickname)) {
      return res.status(400).json({ error: 'Nickname may only contain letters, numbers, underscores, hyphens, dots, and spaces' });
    }
  }

  const pwError = validatePassword(password);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }

  // 시빌 방어용 클라이언트 식별자 (trust proxy=1 → req.ip 가 실제 IP)
  const signupIp = (req.ip || req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || null;
  const signupUa = (req.headers['user-agent'] || '').toString().slice(0, 300) || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existing = await client.query('SELECT wallet_address FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    // ✅ [시빌 방어] IP당 일일 가입 캡 — 대량 계정 생성으로 가입/추천 보너스 파밍 차단
    if (signupIp) {
      try {
        const capRes = await client.query("SELECT value FROM settings WHERE key = 'signup_max_per_ip_per_day'");
        const ipCap = capRes.rows.length ? Number(capRes.rows[0].value) : 0;
        if (ipCap > 0) {
          const cntRes = await client.query(
            `SELECT COUNT(*)::int AS n FROM account_signups WHERE signup_ip = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
            [signupIp]
          );
          if ((cntRes.rows[0]?.n || 0) >= ipCap) {
            await client.query('ROLLBACK');
            return res.status(429).json({ error: 'signup_ip_limit', message: 'Too many accounts created from this network today. Please try again later.' });
          }
        }
      } catch (_) { /* account_signups 미생성 환경(마이그레이션 전)에서는 캡 미적용 */ }
    }

    // [v7.142] 자동 커스터디: 활성화 시 진짜 EOA 키페어 생성 + 개인키 암호화 저장. 아니면 placeholder 주소.
    let walletAddress, encryptedPrivkey = null, walletType = 'placeholder', _newMnemonicShown = false;
    try {
      const cw = require('../services/custodialWallet');
      if (await cw.isEnabled()) {
        const kp = cw.generateWallet();
        walletAddress = kp.address;
        encryptedPrivkey = cw.encryptPrivateKey(kp.privateKey);
        walletType = 'custodial';
      }
    } catch (e) { console.warn('[Auth] custodial wallet gen failed, fallback placeholder:', e.message); }
    if (!walletAddress) walletAddress = generateCustodialAddress();
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
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

    // [v7.174 A-C3] 이메일 인증 코드 생성 — 가입 직후 SMTP 발송, 15분 유효.
    //   email_verification_enabled=true 일 때만 발송. 코드는 DB 에 저장 후 /verify-email 에서 검증.
    //   기존 사용자는 grandfather(email_verified=true 명시 미설정).
    const _evCode = String(Math.floor(100000 + Math.random() * 900000)); // 6자리
    const _evTtl = parseInt(await getEmailVerifyTtlMin()) || 15;
    const _evEnabled = String(await getEmailVerifyEnabled()).toLowerCase() === 'true';

    // Insert user with TOS acceptance (+ 커스터디 키 암호문/타입 + 이메일 인증 컬럼)
    await client.query(
      `INSERT INTO users (wallet_address, email, password_hash, nickname, referral_code, referred_by, tos_accepted_at, tos_version, encrypted_privkey, wallet_type,
                          email_verified, email_verification_code, email_verification_expires, email_verification_sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), '1.0', $7, $8,
               $9, $10, NOW() + ($11 || ' minutes')::interval, NOW())`,
      [walletAddress, email.toLowerCase(), passwordHash, displayName, refCode, referredBy, encryptedPrivkey, walletType,
       false /* always start unverified */, _evEnabled ? _evCode : null, String(_evTtl)]
    );

    // [v7.174 A-C3] 가입 직후 인증 메일 발송 — non-blocking, 실패해도 가입 자체는 성공.
    //   유저는 LOGIN 후 /verify-email 페이지에서 코드 입력. 미인증이어도 기본 게임 플레이 OK.
    if (_evEnabled) {
      try {
        const { sendEmail, isSmtpConfigured } = require('../services/email');
        if (isSmtpConfigured && isSmtpConfigured()) {
          sendEmail(email.toLowerCase(),
            '[OCCUPY MARS] Verify your email — 인증 코드 ' + _evCode,
            'Your verification code: ' + _evCode + '\n\nThis code expires in ' + _evTtl + ' minutes.\n인증 코드: ' + _evCode + ' (' + _evTtl + '분 유효)'
          ).catch(e => console.warn('[Auth] verification email send failed:', e.message));
        } else {
          console.log('[Auth] SMTP not configured — verification code for ' + email.toLowerCase() + ': ' + _evCode + ' (dev only)');
        }
      } catch (e) { console.warn('[Auth] verification email error:', e.message); }
    }

    // Gift signup bonus to new users (configurable via admin settings)
    const bonusRes = await client.query("SELECT value FROM settings WHERE key = 'signup_pp_bonus'");
    const signupBonus = bonusRes.rows.length ? Number(bonusRes.rows[0].value) : 0;
    if (signupBonus > 0) {
      const signupBonusGP = Math.round(signupBonus * await getPPToGPRate(client) * 1000000) / 1000000;
      // [경제v2 P2] 신규가입 보너스는 PP 발행 대신 가치 보존 GP로 지급.
      await client.query(
        `UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
        [walletAddress, signupBonusGP]
      );
      console.log(`[Auth] Gifted ${signupBonusGP} GP (${signupBonus} PP equivalent) to new user ${walletAddress}`);
    }

    // 양면 추천 보상(invitee side): 추천 코드로 가입한 신규 유저에게 추가 PP 보너스.
    // 추천인만 보상받던 단방향 구조 → 초대받은 사람도 즉시 이득 → 가입 전환율 상승.
    // 금액은 admin 설정 referral_signup_bonus_pp 로 조정(기본은 migration 227에서 시드).
    if (referredBy) {
      // ✅ [시빌 방어] 셀프추천 차단: 추천인이 같은 IP에서 최근 가입했다면 양면 보너스 미지급.
      let selfIpReferral = false;
      if (signupIp) {
        try {
          const blockRes = await client.query("SELECT value FROM settings WHERE key = 'referral_self_ip_block'");
          const blockOn = blockRes.rows.length ? String(blockRes.rows[0].value) === 'true' : false;
          if (blockOn) {
            const refIpRes = await client.query(
              `SELECT 1 FROM account_signups WHERE LOWER(wallet_address) = LOWER($1) AND signup_ip = $2 LIMIT 1`,
              [referredBy, signupIp]
            );
            if (refIpRes.rows.length) selfIpReferral = true;
          }
        } catch (_) { /* 마이그레이션 전 환경: 차단 미적용 */ }
      }
      if (selfIpReferral) {
        console.log(`[Auth] Self-IP referral suppressed (invitee ${walletAddress}, ref ${referredBy}, ip ${signupIp})`);
      } else {
        const refBonusRes = await client.query("SELECT value FROM settings WHERE key = 'referral_signup_bonus_pp'");
        const refBonus = refBonusRes.rows.length ? Number(refBonusRes.rows[0].value) : 0;
        if (refBonus > 0) {
          const refBonusGP = Math.round(refBonus * await getPPToGPRate(client) * 1000000) / 1000000;
          // [경제v2 P2] 추천 가입 보너스는 PP 발행 대신 가치 보존 GP로 지급.
          await client.query(
            `UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
            [walletAddress, refBonusGP]
          );
          console.log(`[Auth] Referred-signup bonus ${refBonusGP} GP (${refBonus} PP equivalent) to ${walletAddress} (ref by ${referredBy})`);
        }
      }
    }

    // 시빌 포렌식/캡 집계용 가입 기록 (실패해도 가입 자체는 진행)
    try {
      await client.query(
        `INSERT INTO account_signups (wallet_address, email, signup_ip, user_agent, referred_by) VALUES ($1, $2, $3, $4, $5)`,
        [walletAddress, email.toLowerCase(), signupIp, signupUa, referredBy]
      );
    } catch (_) { /* account_signups 미생성 환경 */ }

    await client.query('COMMIT');

    // 🏆 Achievement: 추천인이 있으면 referrer의 referral_count 진행 체크
    if (referredBy) {
      try {
        const ach = require('../services/achievements');
        ach.checkAndUnlock(referredBy, 'referral_count').catch(() => {});
      } catch (_) {}
    }
    // 🏆 Achievement: 신규 유저 자체 체크 (gp_balance 등은 시작 시점엔 0이지만 향후 진행 베이스)
    try {
      const ach = require('../services/achievements');
      ach.checkAllForWallet(walletAddress).catch(() => {});
    } catch (_) {}

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
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ error: 'Email too long (max 254 chars)' });
  }

  const normalizedEmail = email.toLowerCase();

  // ── Check login lockout ──
  const lockout = checkLoginLockout(normalizedEmail);
  if (lockout && lockout.locked) {
    return res.status(429).json({
      error: `Account temporarily locked due to too many failed login attempts. Try again after ${lockout.lockedUntil}`,
      lockedUntil: lockout.lockedUntil,
      remainingSeconds: lockout.remainingSeconds
    });
  }

  try {
    const result = await pool.query(
      'SELECT wallet_address, email, password_hash, nickname, referral_code FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (!result.rows.length) {
      recordFailedLogin(normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses wallet login only' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      recordFailedLogin(normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // ── Successful login — reset failed attempts ──
    resetLoginAttempts(normalizedEmail);
    // ── last_login_at 기록 → governance auto-expire 가 비활성 거버너 자동 클리어할 때 사용 ──
    try { pool.query('UPDATE users SET last_login_at = NOW() WHERE wallet_address = $1', [user.wallet_address]).catch(()=>{}); } catch(_) {}

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
    // [v7.174 A-C3] email_verified 포함 — 프론트 verify 배너 표시용.
    // Optional economy/profile columns may lag on a deployed DB; keep auth usable.
    let result;
    try {
      result = await pool.query(
        'SELECT wallet_address, email, nickname, usdt_balance, pp_balance, COALESCE(gp_balance,0) AS gp_balance, referral_code, COALESCE(email_verified,false) AS email_verified FROM users WHERE wallet_address = $1',
        [decoded.wallet]
      );
    } catch (userErr) {
      if (userErr.code !== '42703') throw userErr;
      result = await pool.query(
        'SELECT wallet_address, email, nickname, usdt_balance, pp_balance, 0 AS gp_balance, referral_code, false AS email_verified FROM users WHERE wallet_address = $1',
        [decoded.wallet]
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    // /api/auth/me 호출 = 유저가 최근에 활성화된 증거. last_login_at 갱신 (fire-and-forget)
    try { pool.query('UPDATE users SET last_login_at = NOW() WHERE wallet_address = $1', [u.wallet_address]).catch(()=>{}); } catch(_) {}

    // Sum governance GP from all positions. Governance is optional on older/staged DBs;
    // auth must not fail just because that economy table is not migrated yet.
    let govGP = 0;
    try {
      const govGPRes = await pool.query(
        'SELECT COALESCE(SUM(gp_balance),0)::numeric AS total FROM governance_positions WHERE wallet = $1',
        [u.wallet_address]
      );
      govGP = parseFloat(govGPRes.rows[0]?.total || 0);
    } catch (govErr) {
      if (!['42P01', '42703'].includes(govErr.code)) throw govErr;
    }

    res.json({
      wallet: u.wallet_address,
      email: u.email,
      nickname: u.nickname,
      usdtBalance: parseFloat(u.usdt_balance),
      ppBalance: parseFloat(u.pp_balance),
      gpBalance: parseFloat(u.gp_balance) + govGP,
      referralCode: u.referral_code,
      emailVerified: !!u.email_verified  // [v7.174 A-C3]
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
//  POST /api/auth/reveal-key — 자동 커스터디 개인키 1회 열람 (면책 고지)
//  ⚠️ 개인키는 응답으로만 반환, 로그 금지. 열람 사실(횟수/시각)만 감사.
// ══════════════════════════════════════════════════
router.post('/reveal-key', authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  // 🔐 [보안] 개인키 노출은 30일 JWT 단독으론 부족 → 비밀번호 재확인 필수(Codex 검토 E2)
  if (!password) return res.status(400).json({ error: 'password_required', message: 'Re-enter your password to reveal your key.' });
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch (e) { return res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' }); }
  const wallet = (decoded.wallet || '').toLowerCase();
  if (!wallet) return res.status(401).json({ error: 'Invalid token' });
  try {
    const r = await pool.query('SELECT encrypted_privkey, wallet_type, password_hash FROM users WHERE LOWER(wallet_address) = LOWER($1)', [wallet]);
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    const row = r.rows[0];
    // 비밀번호 재검증
    const okPw = row.password_hash ? await bcrypt.compare(password, row.password_hash) : false;
    if (!okPw) return res.status(401).json({ error: 'bad_password', message: 'Incorrect password.' });
    if (row.wallet_type !== 'custodial' || !row.encrypted_privkey) {
      return res.status(409).json({ error: 'no_custodial_key', message: 'This account has no custodial private key (placeholder wallet).' });
    }
    const cw = require('../services/custodialWallet');
    let pk;
    try { pk = cw.decryptPrivateKey(row.encrypted_privkey); }
    catch (e) { console.error('[Auth] reveal-key decrypt failed'); return res.status(500).json({ error: 'decrypt_failed' }); }
    pool.query('UPDATE users SET key_revealed_at = NOW(), key_reveal_count = COALESCE(key_reveal_count,0) + 1 WHERE LOWER(wallet_address) = LOWER($1)', [wallet]).catch(() => {});
    console.log(`[Auth] private key revealed for ${wallet.slice(0, 10)}… (audit)`);
    return res.json({
      success: true,
      address: wallet,
      privateKey: pk,
      disclaimer: 'You alone are responsible for safekeeping this private key. If it is lost or stolen, the operator cannot recover it or your assets.'
    });
  } catch (e) {
    console.error('[Auth] reveal-key error:', e.message);
    return res.status(500).json({ error: 'internal_error' });
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

  // 🔐 [보안 E3] custodial 계정의 지갑 재할당 = 계정 탈취 위험 → 비밀번호 재확인 필수.
  //    (정식 해법은 신규 주소의 EIP-191 소유권 서명 검증 — 후속 과제)
  try {
    const me = await pool.query('SELECT wallet_type, password_hash FROM users WHERE LOWER(wallet_address) = LOWER($1)', [oldWallet.toLowerCase()]);
    if (me.rows[0]?.wallet_type === 'custodial') {
      const linkPw = req.body.password;
      if (!linkPw) return res.status(400).json({ error: 'password_required', message: 'Re-enter your password to relink a custodial wallet.' });
      const okPw = me.rows[0].password_hash ? await bcrypt.compare(linkPw, me.rows[0].password_hash) : false;
      if (!okPw) return res.status(401).json({ error: 'bad_password', message: 'Incorrect password.' });
    }
  } catch (e) {
    // ⚠️ fail-CLOSED: 인증 게이트 조회 실패 시 지갑 재할당을 진행하면 안 됨(계정 탈취 방지, Codex 검토).
    console.error('[Auth] link-wallet guard error:', e.message);
    return res.status(500).json({ error: 'link_guard_error' });
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
router.post('/find-email', authLimiter, async (req, res) => {
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
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
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

    // [v7.170 A-C2 fix] SMTP 미설정 시 dev 편의로 reset code 응답에 평문 노출 — 단 prod 절대 금지.
    //   NODE_ENV=production 이면 isSmtpConfigured 결과와 무관하게 코드 미반환. dev/test 에서만 inline 반환.
    if (!isSmtpConfigured() && process.env.NODE_ENV !== 'production') {
      response.code = code;
    } else if (!isSmtpConfigured()) {
      console.warn('[Auth] SMTP not configured in production — reset code NOT delivered. Configure SMTP_HOST/PORT/USER/PASS.');
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
router.post('/reset-password/verify', passwordResetLimiter, async (req, res) => {
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
    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
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

// ═══════ CHANGE PASSWORD (authenticated) ═══════
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
    // [v7.191 fix] 이전엔 fallback 'dev-secret' — prod 에서 env 누락 시 약한 시크릿으로 서명 검증 → JWT 위조 위험.
    //   파일 상단 JWT_SECRET 은 부팅 시 누락이면 throw 하므로 보장됨. 그 변수 재사용.
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Need uppercase, lowercase, number, special char' });
    }
    const userWallet = (decoded.wallet || decoded.walletAddress || '').toLowerCase().trim();
    if (!userWallet) return res.status(401).json({ error: 'Invalid token: missing wallet' });
    const user = await pool.query('SELECT password_hash FROM users WHERE LOWER(wallet_address) = $1', [userWallet]);
    if (!user.rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });
    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await pool.query('UPDATE users SET password_hash = $1 WHERE LOWER(wallet_address) = $2', [newHash, userWallet]);
    console.log(`[Auth] Password changed for wallet ${userWallet}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[Auth] change-password error:', e.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ═══════ DELETE ACCOUNT (authenticated) ═══════
router.post('/delete-account', async (req, res) => {
  const client = await pool.connect();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
    // [v7.191 fix] 이전엔 fallback 'dev-secret' — prod 에서 env 누락 시 약한 시크릿으로 서명 검증 → JWT 위조 위험.
    //   파일 상단 JWT_SECRET 은 부팅 시 누락이면 throw 하므로 보장됨. 그 변수 재사용.
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const delWallet = (decoded.wallet || decoded.walletAddress || '').toLowerCase().trim();
    if (!delWallet) return res.status(401).json({ error: 'Invalid token: missing wallet' });
    await client.query('BEGIN');
    // Release all territories (users.wallet_address, claims uses owner+deleted_at)
    await client.query('UPDATE pixels SET owner = NULL WHERE LOWER(owner) = $1', [delWallet]);
    await client.query("UPDATE claims SET deleted_at = NOW() WHERE LOWER(owner) = $1 AND deleted_at IS NULL", [delWallet]);
    // Zero out balances
    await client.query('UPDATE users SET pp_balance = 0, usdt_balance = 0, is_active = false WHERE LOWER(wallet_address) = $1', [delWallet]);
    await client.query('COMMIT');
    console.log(`[Auth] Account deleted: wallet ${delWallet}`);
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Auth] delete-account error:', e.message);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────
// [v7.174 A-C3] 이메일 인증 — verify-email / resend-verification
// ─────────────────────────────────────────────────────────────────
async function getEmailVerifyEnabled() {
  try { const r = await pool.query("SELECT value FROM settings WHERE key='email_verification_enabled'"); return r.rows[0]?.value || 'true'; }
  catch (_) { return 'true'; }
}
async function getEmailVerifyTtlMin() {
  try { const r = await pool.query("SELECT value FROM settings WHERE key='email_verification_ttl_minutes'"); return r.rows[0]?.value || '15'; }
  catch (_) { return '15'; }
}
async function getEmailVerifyResendCooldownSec() {
  try { const r = await pool.query("SELECT value FROM settings WHERE key='email_verification_resend_cooldown_sec'"); return parseInt(r.rows[0]?.value || '60'); }
  catch (_) { return 60; }
}

// POST /api/auth/verify-email — 6자리 코드 검증 → email_verified=true
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'email and code required' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedCode = String(code).trim();
    if (!/^[0-9]{6}$/.test(normalizedCode)) return res.status(400).json({ error: 'invalid_code_format' });

    const { rows } = await pool.query(
      `SELECT wallet_address, email_verified, email_verification_code, email_verification_expires
         FROM users WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    const u = rows[0];
    if (u.email_verified) return res.json({ success: true, already_verified: true });
    if (!u.email_verification_code) return res.status(400).json({ error: 'no_pending_verification' });
    if (u.email_verification_expires && new Date(u.email_verification_expires) < new Date()) {
      return res.status(400).json({ error: 'code_expired', hint: 'Request a new code via /resend-verification' });
    }
    if (u.email_verification_code !== normalizedCode) return res.status(400).json({ error: 'invalid_code' });

    await pool.query(
      `UPDATE users SET email_verified = TRUE, email_verification_code = NULL, email_verification_expires = NULL
        WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );
    console.log('[Auth] Email verified: ' + normalizedEmail);
    res.json({ success: true });
  } catch (e) {
    console.error('[Auth] verify-email error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/auth/resend-verification — 코드 재발송(쿨다운 적용)
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const cooldownSec = await getEmailVerifyResendCooldownSec();

    const { rows } = await pool.query(
      `SELECT email_verified, email_verification_sent_at FROM users WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );
    if (!rows.length) return res.status(404).json({ error: 'user_not_found' });
    if (rows[0].email_verified) return res.json({ success: true, already_verified: true });

    if (rows[0].email_verification_sent_at) {
      const sinceMs = Date.now() - new Date(rows[0].email_verification_sent_at).getTime();
      if (sinceMs < cooldownSec * 1000) {
        return res.status(429).json({ error: 'cooldown', wait_seconds: Math.ceil((cooldownSec * 1000 - sinceMs) / 1000) });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttlMin = parseInt(await getEmailVerifyTtlMin()) || 15;
    await pool.query(
      `UPDATE users SET email_verification_code = $1,
                       email_verification_expires = NOW() + ($2 || ' minutes')::interval,
                       email_verification_sent_at = NOW()
        WHERE LOWER(email) = LOWER($3)`,
      [code, String(ttlMin), normalizedEmail]
    );

    try {
      const { sendEmail, isSmtpConfigured } = require('../services/email');
      if (isSmtpConfigured && isSmtpConfigured()) {
        await sendEmail(normalizedEmail,
          '[OCCUPY MARS] Verification code — 인증 코드 ' + code,
          'Your verification code: ' + code + '\n\nThis code expires in ' + ttlMin + ' minutes.\n인증 코드: ' + code + ' (' + ttlMin + '분 유효)'
        );
        return res.json({ success: true, ttl_minutes: ttlMin });
      }
      // SMTP 미설정 + dev — 코드 인라인 반환(prod 에선 절대 X)
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ success: true, ttl_minutes: ttlMin, code, _dev: 'SMTP not configured' });
      }
      console.warn('[Auth] SMTP not configured in production — verification email NOT sent');
      return res.status(503).json({ error: 'email_service_unavailable' });
    } catch (e) {
      console.error('[Auth] resend send error:', e.message);
      return res.status(500).json({ error: 'send_failed' });
    }
  } catch (e) {
    console.error('[Auth] resend-verification error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
