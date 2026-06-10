const rateLimit = require('express-rate-limit');

function makeRateLimiter(options = {}) {
  const {
    windowMs,
    max,
    message,
    store,
    skip,
    passOnStoreError,
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(store ? { store } : {}),
    ...(skip ? { skip } : {}),
    passOnStoreError: passOnStoreError ?? Boolean(store),
    message: typeof message === 'string' ? { error: message } : message,
  });
}

module.exports = {
  makeRateLimiter,
};
