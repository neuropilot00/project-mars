'use strict';

// Existing JWTs retain their existing contract. New authenticator sessions must
// also match the account's current version on every privileged HTTP/WS entry.
function createBoundary({ verify, checkSession, timeoutMs = 5000 }) {
  async function validateToken(token) {
    let claims;
    try { claims = verify(token); } catch (_) { return { wallet: null, totp: false, revoked: false }; }
    const totp = claims && claims.auth_kind === 'totp';
    const wallet = String(claims && (claims.wallet_address || claims.wallet || claims.walletAddress) || '').trim().toLowerCase();
    if (!totp) return { wallet: wallet || null, claims, totp: false, revoked: false };
    if (!/^0x[a-f0-9]{40}$/.test(wallet) || !Number.isSafeInteger(claims.auth_version) || claims.auth_version < 1 ||
        typeof claims.jti !== 'string' || !/^[a-f0-9]{32}$/.test(claims.jti)) {
      return { wallet: null, totp: true, revoked: true };
    }
    let timer;
    try {
      const current = await Promise.race([
        Promise.resolve().then(() => checkSession(claims)),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })
      ]);
      return current === true ? { wallet, claims, totp: true, revoked: false } : { wallet: null, totp: true, revoked: true };
    } catch (_) { return { wallet: null, totp: true, revoked: true }; }
    finally { if (timer) clearTimeout(timer); }
  }
  async function middleware(req, res, next) {
    const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    // Legacy key-reveal/wallet-link endpoints also accept a body token. Cover
    // that boundary, not only the Authorization header.
    const bodyToken = req.body && typeof req.body.token === 'string' ? req.body.token : null;
    // Old route verifiers accept raw JWTs, replace('Bearer ', ''), or split(' ')[1].
    // Cover every existing accepted shape; this is an additional revocation check,
    // not a new authorization grant or a reason to loosen the route verifiers.
    const tokens = [...new Set([header, header.replace(/^Bearer\s+/i, ''), header.replace('Bearer ', ''), header.split(' ')[1], bodyToken].filter(Boolean))];
    for (const token of tokens) {
      const result = await validateToken(token);
      if (result.revoked) return res.status(401).json({ error: 'session_expired' });
      if (result.totp && String(req.path || '').endsWith('/auth/link-wallet')) {
        return res.status(403).json({ error: 'authenticator_wallet_link_unavailable' });
      }
    }
    return next();
  }
  return { validateToken, middleware };
}

let checker = async () => false; // Missing integration fails closed for TOTP.
let singleton;
function setSessionChecker(value) {
  if (typeof value !== 'function') throw new TypeError('Session checker required');
  checker = value;
}
function getBoundary() {
  if (!singleton) singleton = createBoundary({
    verify: token => require('jsonwebtoken').verify(token, process.env.JWT_SECRET),
    checkSession: claims => checker(claims)
  });
  return singleton;
}
module.exports = {
  createBoundary, setSessionChecker,
  validateToken: token => getBoundary().validateToken(token),
  middleware: (req, res, next) => getBoundary().middleware(req, res, next)
};
