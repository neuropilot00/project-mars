#!/usr/bin/env node
// Actual HTTP/JWT/SQL purchase regression, restricted to the disposable local clone.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') {
  throw Error('Disposable local upgrade review database required');
}
process.env.JWT_SECRET = 'disposable-item-purchase-regression';
const { pool } = require('../db');
// Background scoring is outside purchase atomicity and must not mutate fixtures.
for (const name of ['season', 'achievements', 'missions', 'enhancement']) {
  const file = path.resolve(__dirname, '../services/' + name + '.js');
  require.cache[file] = { id: file, filename: file, loaded: true, exports: null };
}
const app = require('express')();
app.use(require('express').json());
// Isolate purchase validation from the unrelated per-IP write quota.
const limiterFile = path.resolve(__dirname, '../utils/rateLimiters.js');
require.cache[limiterFile] = { id: limiterFile, filename: limiterFile, loaded: true, exports: { makeRateLimiter: () => (_req, _res, next) => next() } };
app.use('/api', require('../routes/itemEconomyRoutes'));
const suffix = crypto.randomBytes(4).toString('hex');
const wallet = '0x' + crypto.randomBytes(20).toString('hex');
const itemCode = 'qa_buy_' + suffix;
const resourceCode = 'qa_' + suffix;
const materialCode = 'mat_' + resourceCode;
const missingCode = 'mat_missing_' + suffix;
const codes = [itemCode, materialCode, missingCode];
const checks = [];
let server, base, itemId, resourceId;
async function call(body, authenticated = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Authorization = 'Bearer ' + require('jsonwebtoken').sign({ wallet_address: wallet }, process.env.JWT_SECRET);
  const res = await fetch(base + '/api/shop/buy', { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function snapshot() {
  return {
    balances: (await pool.query('SELECT pp_balance,gp_balance,usdt_balance FROM users WHERE wallet_address=$1', [wallet])).rows,
    items: (await pool.query('SELECT item_type_id,quantity FROM user_items WHERE wallet=$1 ORDER BY item_type_id', [wallet])).rows,
    resources: (await pool.query('SELECT resource_id,quantity FROM user_resource_inventory WHERE wallet_address=$1 ORDER BY resource_id', [wallet])).rows,
    ledger: (await pool.query('SELECT id,type,usdt_amount,pp_amount,meta FROM transactions WHERE from_wallet=$1 ORDER BY id', [wallet])).rows,
  };
}
async function rejectedUnchanged(body, status = 400) {
  const before = await snapshot();
  const result = await call(body);
  assert.equal(result.status, status, JSON.stringify({ body, result }));
  assert.deepEqual(await snapshot(), before);
}
async function reset(pp = 100) {
  await pool.query('UPDATE users SET pp_balance=$2,gp_balance=100,usdt_balance=100 WHERE wallet_address=$1', [wallet, pp]);
  await pool.query('DELETE FROM user_items WHERE wallet=$1', [wallet]);
}
async function concurrentBuys(body) {
  const blocker = await pool.connect();
  let pending;
  let waiting = 0;
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]);
    pending = Promise.all([call(body), call(body)]);
    // Force both requests to wait on the same user lock. The old code read
    // both inventories before waiting and therefore exceeded max_stack.
    for (let attempt = 0; attempt < 100 && waiting < 2; attempt++) {
      await blocker.query('SELECT pg_stat_clear_snapshot()');
      waiting = Number((await blocker.query(`SELECT COUNT(*) AS n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'
          AND query LIKE 'SELECT pp_balance as bal FROM users%FOR UPDATE'`)).rows[0].n);
      if (waiting < 2) await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally {
    await blocker.query('COMMIT');
    blocker.release();
  }
  const results = await pending;
  assert.ok(waiting >= 2, 'Both purchase requests must reach the database lock');
  return results;
}
async function main() {
  await pool.query("INSERT INTO users(wallet_address,nickname,pp_balance,gp_balance,usdt_balance) VALUES($1,'Item purchase regression',100,100,100)", [wallet]);
  itemId = (await pool.query("INSERT INTO item_types(code,name,category,price_pp,price_gp,price_usdt,max_stack,active) VALUES($1,'QA item','utility',2,3,1,3,true) RETURNING id", [itemCode])).rows[0].id;
  resourceId = (await pool.query('INSERT INTO resources(code,name_en) VALUES($1,$1) RETURNING id', [resourceCode])).rows[0].id;
  await pool.query("INSERT INTO item_types(code,name,category,price_pp,price_gp,price_usdt,effect_value,max_stack,active) VALUES($1,'QA material','material',2,3,1,5,3,true),($2,'QA missing material','material',2,3,1,5,3,true)", [materialCode, missingCode]);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await call({ itemCode }, false)).status, 401);
  const invalid = [-1, 0, 1.5, '-1', '0', '1.5', '1x', 'abc', null, true, {}, [], 2147483648, 9007199254740992, '999999999999999999999999'];
  for (const quantity of invalid) await rejectedUnchanged({ itemCode, quantity });
  for (const currency of ['FAKE', '', null, {}, 1]) await rejectedUnchanged({ itemCode, quantity: 1, currency });
  checks.push('unauthenticated blocked; invalid negative/zero/fraction/nonnumeric/unsafe quantities and currencies change no balance, inventory or ledger');
  const defaultBuy = await call({ itemCode });
  assert.equal(defaultBuy.status, 200);assert.equal(defaultBuy.data.quantity, 1);assert.equal(defaultBuy.data.cost, 2);assert.equal(defaultBuy.data.currency, 'PP');
  const gpBuy = await call({ itemCode, quantity: '1', currency: 'gp' });assert.equal(gpBuy.status, 200);assert.equal(gpBuy.data.cost, 3);
  const usdtBuy = await call({ itemCode, quantity: 1, currency: 'USDT' });assert.equal(usdtBuy.status, 200);assert.equal(usdtBuy.data.cost, 1);
  const paid = await snapshot();assert.equal(Number(paid.balances[0].pp_balance), 98);assert.equal(Number(paid.balances[0].gp_balance), 97);assert.equal(Number(paid.balances[0].usdt_balance), 99);assert.equal(paid.items[0].quantity, 3);
  assert.equal(paid.ledger.length, 3);assert.deepEqual(paid.ledger.map(x => x.meta.currency), ['PP', 'GP', 'USDT']);
  for (const [i, receipt] of [defaultBuy.data, gpBuy.data, usdtBuy.data].entries()) {
    assert.equal(String(receipt.transactionId), String(paid.ledger[i].id));
    assert.equal(receipt.itemCode, itemCode);assert.equal(receipt.category, 'utility');
    assert.equal(receipt.unitCost * receipt.quantity, receipt.cost);
    assert.equal(paid.ledger.filter(row => String(row.id) === String(receipt.transactionId)).length, 1);
  }
  checks.push('omitted quantity defaults to one, strict integer string accepted, PP/GP/USDT committed receipt IDs each match exactly one actual ledger debit');
  await rejectedUnchanged({ itemCode, quantity: 1 });
  await reset();
  const first = await concurrentBuys({ itemCode, quantity: 2 });
  assert.deepEqual(first.map(x => x.status).sort(), [200, 400]);
  let state = await snapshot();assert.equal(state.items[0].quantity, 2);assert.equal(Number(state.balances[0].pp_balance), 96);
  const existing = await concurrentBuys({ itemCode, quantity: 1 });
  assert.deepEqual(existing.map(x => x.status).sort(), [200, 400]);
  state = await snapshot();assert.equal(state.items[0].quantity, 3);assert.equal(Number(state.balances[0].pp_balance), 94);
  checks.push('concurrent purchases enforce cap from both missing and existing inventory rows, rejected purchase never charges');
  await reset(2);
  const funds = await concurrentBuys({ itemCode, quantity: 1 });
  assert.deepEqual(funds.map(x => x.status).sort(), [200, 400]);state = await snapshot();assert.equal(state.items[0].quantity, 1);assert.equal(Number(state.balances[0].pp_balance), 0);
  checks.push('concurrent affordable-once purchase cannot double-spend');
  await reset();
  for (let i = 0; i < 2; i++) assert.equal((await call({ itemCode: materialCode, quantity: 2, currency: 'GP' })).status, 200);
  state = await snapshot();assert.equal(state.resources.find(x => x.resource_id === resourceId).quantity, 20);assert.equal(Number(state.balances[0].gp_balance), 88);
  await rejectedUnchanged({ itemCode: materialCode, quantity: 4, currency: 'GP' });
  await rejectedUnchanged({ itemCode: missingCode, quantity: 1, currency: 'GP' });
  await pool.query('UPDATE item_types SET effect_value=0 WHERE code=$1', [materialCode]);
  await rejectedUnchanged({ itemCode: materialCode, quantity: 1, currency: 'GP' });
  await pool.query('UPDATE item_types SET effect_value=5 WHERE code=$1', [materialCode]);
  await pool.query('UPDATE user_resource_inventory SET quantity=2147483647 WHERE wallet_address=$1 AND resource_id=$2', [wallet, resourceId]);
  await rejectedUnchanged({ itemCode: materialCode, quantity: 1, currency: 'GP' });
  checks.push('materials preserve per-order bundle cap, grant exact resources, and rollback charge for missing resource/invalid grant/inventory overflow');
  await pool.query("UPDATE item_types SET price_pp='NaN' WHERE id=$1", [itemId]);
  await rejectedUnchanged({ itemCode, quantity: 1 });
  await pool.query('UPDATE item_types SET price_pp=0 WHERE id=$1', [itemId]);
  await rejectedUnchanged({ itemCode, quantity: 1 });
  await pool.query('UPDATE item_types SET price_pp=2 WHERE id=$1', [itemId]);
  checks.push('NaN and non-positive catalog prices reject without mutations');
  console.log(JSON.stringify({ passed: checks.length, checks, database: url.pathname.slice(1), externalServicesUsed: false }));
}
main().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.query('DELETE FROM transactions WHERE from_wallet=$1', [wallet]);
  await pool.query('DELETE FROM user_items WHERE wallet=$1', [wallet]);
  await pool.query('DELETE FROM user_resource_inventory WHERE wallet_address=$1', [wallet]);
  await pool.query('DELETE FROM item_types WHERE code=ANY($1::text[])', [codes]);
  await pool.query('DELETE FROM resources WHERE code=$1', [resourceCode]);
  await pool.query('DELETE FROM users WHERE wallet_address=$1', [wallet]);
  await pool.end();
});
