'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { projectPlayerJourney, getPlayerJourney, JOURNEY_SQL } = require('../server/services/playerJourney');

const evidence = (overrides = {}) => ({ territory: false, harvest: false, ship: false, human_sale: false, guild_contribution: false, ...overrides });

test('journey progresses through territory, harvest, ship and a completed social action', () => {
  const samples = [
    [evidence(), 0, false],
    [evidence({ territory: true }), 1, false],
    [evidence({ territory: true, harvest: true }), 2, false],
    [evidence({ territory: true, harvest: true, ship: true }), 3, false],
    [evidence({ territory: true, harvest: true, ship: true, human_sale: true }), 4, true],
    [evidence({ territory: true, harvest: true, ship: true, guild_contribution: true }), 4, true]
  ];
  for (const [input, step, completed] of samples) {
    const state = projectPlayerJourney(input);
    assert.equal(state.journey.step, step);
    assert.equal(state.journey.completed, completed);
    assert.equal(state.journey.totalSteps, 4);
    assert.equal(state.step, Math.min(step, 3));
    assert.equal(state.completed, step >= 3, 'legacy BASE contract stays complete at first ship');
  }
});

test('a social action alone cannot skip missing core milestones or treat truthy strings as proof', () => {
  assert.equal(projectPlayerJourney(evidence({ human_sale: true, guild_contribution: true })).journey.step, 0);
  assert.equal(projectPlayerJourney(evidence({ territory: 'false', harvest: 'true', ship: 1 })).journey.step, 0);
});

test('query uses one read-only snapshot and parameters; no database module is loaded', async () => {
  const calls = [];
  const queryable = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [evidence({ territory: true })] };
  } };
  const state = await getPlayerJourney(queryable, ' 0xPlayer ');
  assert.equal(state.step, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['0xplayer']);
  assert.doesNotMatch(calls[0].sql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CALL)\b/i);
  assert.doesNotMatch(calls[0].sql, /0xplayer/);
});

test('social evidence requires sold records, distinct human accounts and positive harvest contribution', () => {
  // SQL contract assertions supplement fixture tests; no PostgreSQL is contacted here.
  assert.match(JOURNEY_SQL, /m\.status = 'sold' AND m\.sold_at IS NOT NULL AND m\.price > 0/);
  assert.match(JOURNEY_SQL, /FROM ship_market_sale_log m/);
  assert.match(JOURNEY_SQL, /LOWER\(m\.buyer\) <> LOWER\(m\.seller\)/);
  assert.match(JOURNEY_SQL, /LOWER\(m\.buyer_wallet\) <> LOWER\(m\.seller_wallet\)/);
  assert.equal((JOURNEY_SQL.match(/seller\.is_ai IS FALSE AND buyer\.is_ai IS FALSE/g) || []).length, 2);
  assert.equal((JOURNEY_SQL.match(/NOT LIKE '0xnpc%'/g) || []).length, 4);
  assert.match(JOURNEY_SQL, /kind IN \('harvest_contrib', 'donate'\) AND delta_gp > 0/);
  assert.doesNotMatch(JOURNEY_SQL, /total_contributed|gp_contribution_pct/);
  assert.match(JOURNEY_SQL, /status = 'completed' AND completed_at IS NOT NULL/);
});

test('unavailable evidence rejects rather than projecting a new-player status', async () => {
  await assert.rejects(getPlayerJourney({ query: async () => { throw new Error('offline'); } }, '0xplayer'), /offline/);
  await assert.rejects(getPlayerJourney({ query: async () => ({ rows: [] }) }, '0xplayer'), /JOURNEY_UNAVAILABLE/);
  await assert.rejects(getPlayerJourney({ query: () => assert.fail('must not query') }, ''), /WALLET_REQUIRED/);
});

function loadStatusRoute(getJourney) {
  const routes = [];
  const router = { get: (url, ...handlers) => routes.push({ url, handler: handlers.at(-1) }), post: () => {} };
  const auth = () => {};
  const source = fs.readFileSync(path.join(__dirname, '../server/routes/playerStatusRoutes.js'), 'utf8');
  const sandbox = {
    module: { exports: {} }, console: { error() {}, warn() {} },
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../utils/rateLimiters') return { makeRateLimiter: () => auth };
      if (name === '../db') return { pool: { fixture: true } };
      if (name === '../utils/apiHelpers') return { requireAuth: auth, getAuthWallet: req => req.wallet };
      if (name === '../services/playerJourney') return { getPlayerJourney: getJourney };
      throw new Error('unstubbed dependency: ' + name);
    }
  };
  vm.runInNewContext(source, sandbox, { filename: 'playerStatusRoutes.js' });
  return routes.find(route => route.url === '/onboarding/status').handler;
}

test('status route returns additive journey and reports 503 without false step zero on failure', async () => {
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  let received;
  const success = loadStatusRoute(async (pool, wallet) => { received = { pool, wallet }; return projectPlayerJourney(evidence({ territory: true })); });
  const res = response();
  await success({ wallet: '0xplayer' }, res);
  assert.deepEqual(received, { pool: { fixture: true }, wallet: '0xplayer' });
  assert.equal(res.body.journey.step, 1);
  const failure = loadStatusRoute(async () => { throw new Error('database unavailable'); });
  const failedRes = response();
  await failure({ wallet: '0xplayer' }, failedRes);
  assert.equal(failedRes.code, 503);
  assert.equal(failedRes.body.error, 'JOURNEY_UNAVAILABLE');
  assert.equal('step' in failedRes.body, false);
  const unauthenticated = response();
  await failure({}, unauthenticated);
  assert.equal(unauthenticated.code, 401);
});
