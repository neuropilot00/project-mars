function getAdminSecret(req) {
  return req.headers['x-admin-secret'] || req.headers['x-admin-key'] || '';
}

function isAdmin(req) {
  return !!(process.env.ADMIN_SECRET && getAdminSecret(req) === process.env.ADMIN_SECRET);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  next();
}

module.exports = {
  getAdminSecret,
  isAdmin,
  requireAdmin
};
