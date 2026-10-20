const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../server/routes/marketplace.js'), 'utf8');

function fixture(options = {}) {
  const routes = new Map();
  const calls = [];
  const router = { get: (url, ...handlers) => routes.set('GET ' + url, handlers),
    post: (url, ...handlers) => routes.set('POST ' + url, handlers) };
  const market = {
    quoteListing: async (...args) => {
      calls.push(['quoteListing', ...args]);
      if (options.quoteFailure) throw new Error('Fixture quote failure');
      return { currency: 'GP', price: 6, listingFeeGp: 5 };
    },
    createListing: async (...args) => { calls.push(['createListing', ...args]); return { id: 1 }; },
    quotePurchase: async (...args) => { calls.push(['quotePurchase', ...args]); return { buyerPays: 6 }; },
  };
  const client = { query: async sql => calls.push(['query', sql]), release: () => calls.push(['release']) };
  const module = { exports: {} };
  const context = { module, exports: module.exports, process: { env: {} }, console: { error() {} },
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === 'express-rate-limit') return () => (_req, _res, next) => next();
      if (name === 'jsonwebtoken') return { verify: token => {
        if (token !== 'valid-fixture-token') throw new Error('Invalid fixture token');
        return { wallet_address: 'TrustedSeller' };
      } };
      if (name === '../db') return { pool: { connect: async () => { calls.push(['connect']); return client; } } };
      if (name === '../services/marketplace') return market;
      throw new Error('Fixture blocked dependency: ' + name);
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'marketplace-routes.js' });
  async function invoke(key, input = {}) {
    const req = { headers: {}, body: {}, params: {}, query: {}, ...input };
    const res = { statusCode: 200, headers: {}, status(n) { this.statusCode = n; return this; },
      set(k, v) { this.headers[k] = v; return this; }, json(value) { this.body = value; return this; } };
    for (const handler of routes.get(key)) {
      let continued = false;
      await handler(req, res, () => { continued = true; });
      if (!continued) break;
    }
    return res;
  }
  return { calls, routes, invoke };
}

const auth = { authorization: 'Bearer valid-fixture-token' };

test('seller quote requires the existing verified JWT identity', async () => {
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) {
    const f = fixture();
    const res = await f.invoke('POST /listing-quote', { headers, body: { wallet: 'untrusted', type: 'resource', price: 6 } });
    assert.equal(res.statusCode, 401);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  const res = await f.invoke('POST /listing-quote', { headers: auth, body: { wallet: 'untrusted', type: 'resource', price: 6 } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(f.calls[0][0], 'quoteListing');
  assert.equal(f.calls[0][1], 'trustedseller');
  assert.equal(f.calls.some(c => c[0] === 'connect'), false, 'quote route must not begin a transaction');
});

test('quote failure returns a recoverable error without any transaction', async () => {
  const f = fixture({ quoteFailure: true });
  const res = await f.invoke('POST /listing-quote', { headers: auth, body: { type: 'resource', price: 6 } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Fixture quote failure');
  assert.equal(f.calls.some(c => c[0] === 'connect'), false);
});

test('creation forwards preview guards and keeps the existing resource contract', async () => {
  const f = fixture();
  const request = { wallet: 'untrusted', type: 'resource', price: 6, currency: 'PP',
    resourceCode: 'iron_ore', resourceQuantity: 10, expectedListingFeeGp: 5,
    listingQuoteExpiresAt: new Date(Date.now() + 60000).toISOString() };
  const res = await f.invoke('POST /list', { headers: auth, body: request });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  const [, , wallet, type, passed] = f.calls.find(c => c[0] === 'createListing');
  assert.equal(wallet, 'trustedseller');
  assert.equal(type, 'resource');
  assert.equal(passed.price, 6);
  assert.equal(passed.resourceQuantity, 10);
  assert.equal(passed.currency, 'PP');
  assert.equal(passed.expectedListingFeeGp, 5);
  assert.equal(passed.listingQuoteExpiresAt, request.listingQuoteExpiresAt);
  assert.deepEqual(f.calls.filter(c => c[0] === 'query').map(c => c[1]), ['BEGIN', 'COMMIT']);
});

test('the existing buyer purchase quote endpoint stays available and authenticated', async () => {
  const f = fixture();
  assert.ok(f.routes.has('GET /listings/:id/purchase-quote'));
  const res = await f.invoke('GET /listings/:id/purchase-quote', { headers: auth, params: { id: '9' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Array.from(f.calls[0]), ['quotePurchase', 9, 'trustedseller']);
});
