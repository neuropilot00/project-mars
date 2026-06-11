const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/<[^>]*>/g, '');
}

function isInternalRequest(req) {
  const secret = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  return !!(process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET);
}

module.exports = {
  requireAuth,
  getAuthWallet,
  sanitize,
  isInternalRequest
};
