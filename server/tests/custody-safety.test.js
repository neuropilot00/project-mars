'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Actual production sources, injected database/chain/signature collaborators.
// These deterministic lock fixtures are not a PostgreSQL or real-chain test.
function load(relative, dependencies, globals = {}, expose = '') {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, relative), 'utf8') + expose, {
    module, exports: module.exports, process: { env: {} }, console: { log() {}, warn() {}, error() {} },
    require(name) { if (!(name in dependencies)) throw Error('Unexpected dependency: ' + name); return dependencies[name]; },
    ...globals
  }, { filename: relative });
  return module.exports;
}

class BN {
  constructor(value) { this.value = BigInt(value instanceof BN ? value.value : value); }
  sub(value) { return new BN(this.value - new BN(value).value); }
  lt(value) { return this.value < new BN(value).value; }
  gt(value) { return this.value > new BN(value).value; }
  toString() { return String(this.value); }
}
const ethers = { BigNumber: { from: value => new BN(value) }, constants: { Zero: new BN(0) }, utils: {
  parseUnits: (value, decimals) => new BN(BigInt(Math.round(Number(value) * 1e6)) * 10n ** BigInt(decimals - 6)),
  formatUnits: (value, decimals) => String(Number(new BN(value).value) / 10 ** decimals)
} };

function fixture({ balance = 100, liquidity = 100, settings = {} } = {}) {
  const state = { users: new Map([['alice', { balance, last: null }], ['bob', { balance, last: null }]]),
    collateral: balance * 2, pending: [], deposits: [], transactions: [], calls: [], releases: 0,
    clock: 2_000_000_000_000, finalized: { nonce: 0, timestamp: 2_000_000_000, blockNumber: 99, blockHash: 'final' },
    signatureCalls: 0, liquidity, eventFinalized: true };
  const locks = new Map();
  const cfg = { withdrawal_cooldown_hours: 24, withdraw_min_amount: 1, withdraw_fee_percent: 5, ...settings };
  class FixtureDate extends Date { constructor(value) { super(value === undefined ? state.clock : value); } static now() { return state.clock; } }
  async function acquire(client, key) {
    if (client.held.has(key)) return;
    const prior = locks.get(key) || Promise.resolve();
    let unlock;
    const current = new Promise(resolve => { unlock = resolve; });
    locks.set(key, current);
    await prior;
    client.held.set(key, unlock);
  }
  function unlock(client) { for (const release of client.held.values()) release(); client.held.clear(); }
  const pool = {
    async connect() {
      const client = { held: new Map(), released: false, undo: [],
        release() { assert.equal(this.released, false, 'client released once'); this.released = true; state.releases++; unlock(this); },
        async query(sql, args = []) {
          const q = sql.replace(/\s+/g, ' ').trim(); state.calls.push(q);
          if (q === 'BEGIN') return { rows: [] };
          if (q === 'COMMIT' || q === 'ROLLBACK') { if (q === 'ROLLBACK') for (const undo of this.undo.reverse()) undo(); this.undo = []; unlock(this); return { rows: [] }; }
          if (q.includes('pg_advisory_xact_lock')) { await acquire(this, 'chain:' + (args[0] || 'redemption')); return { rows: [] }; }
          if (q.includes('FROM users') && q.includes('FOR UPDATE')) {
            await acquire(this, 'user:' + args[0]); const u = state.users.get(args[0]);
            return { rows: u ? [{ usdt_balance: u.balance, withdrawal_nonce: 888, last_withdrawal_at: u.last }] : [] };
          }
          if (q.startsWith('SELECT amount_units')) return { rows: state.pending.filter(p => p.wallet_address === args[0] && p.status === 'pending').slice(-1) };
          if (q.startsWith('SELECT status FROM pending_withdrawals')) return { rows: state.pending.filter(p => p.id === args[0]).map(p => ({ status: p.status })) };
          if (q.startsWith('SELECT collateral_usdt')) { await acquire(this, 'treasury'); return { rows: [{ collateral_usdt: state.collateral }] }; }
          if (q.includes('SUM(usdt_balance)')) return { rows: [{ s: [...state.users.values()].reduce((sum, u) => sum + u.balance, 0) }] };
          if (q.includes('SUM(gross)')) return { rows: [{ gross: state.pending.filter(p => p.status === 'pending').reduce((n, p) => n + p.gross, 0), net: state.pending.filter(p => p.status === 'pending').reduce((n, p) => n + p.net, 0) }] };
          if (q.includes('SUM(net)')) return { rows: [{ s: state.pending.filter(p => p.chain === args[0] && p.status === 'pending').reduce((n, p) => n + p.net, 0) }] };
          if (q.startsWith('UPDATE users SET usdt_balance = usdt_balance -')) {
            const u = state.users.get(args[1]); if (u.balance < args[0]) return { rowCount: 0 };
            const before = { ...u }; this.undo.push(() => Object.assign(u, before)); u.balance -= args[0]; u.last = new Date(state.clock).toISOString(); return { rowCount: 1, rows: [{ usdt_balance: u.balance }] };
          }
          if (q.startsWith('UPDATE users SET usdt_balance=usdt_balance+')) { state.users.get(args[1]).balance += Number(args[0]); return { rowCount: 1 }; }
          if (q.startsWith('UPDATE treasury_ledger')) { await acquire(this, 'treasury'); const before = state.collateral; this.undo.push(() => { state.collateral = before; }); state.collateral += args[0]; return { rowCount: 1 }; }
          if (q.startsWith('INSERT INTO pending_withdrawals')) {
            const [wallet_address, chain, nonce, gross, net, fee, amount_units, deadline, signature] = args;
            const p = { id: state.pending.length + 1, wallet_address, chain, nonce, gross, net, fee, amount_units, deadline, signature, status: 'pending' };
            state.pending.push(p); this.undo.push(() => { state.pending = state.pending.filter(row => row !== p); }); return { rowCount: 1, rows: [] };
          }
          if (q.startsWith('UPDATE pending_withdrawals')) {
            const matching = args.length === 1 ? state.pending.filter(p => p.id === args[0]) : state.pending.filter(p => p.chain === args[0] && p.wallet_address === args[1] && p.nonce === args[2] && p.status === 'pending');
            for (const p of matching) p.status = q.includes("status='expired'") ? 'expired' : 'settled'; return { rowCount: matching.length };
          }
          if (q.startsWith('INSERT INTO transactions')) { state.transactions.push({ sql: q, args }); return { rowCount: 1 }; }
          if (q.startsWith('SELECT id FROM deposits')) return { rows: state.deposits.filter(d => d.chain === args[0] && d.tx === args[1] && d.log === -1) };
          if (q.startsWith('INSERT INTO deposits')) {
            const [wallet, amount, bonus, chain, tx, block, hash, log] = args;
            if (state.deposits.some(d => d.chain === chain && d.tx === tx && d.log === log)) return { rowCount: 0, rows: [] };
            const d = { id: state.deposits.length + 1, wallet, amount, bonus, chain, tx, block, hash, log }; state.deposits.push(d); return { rowCount: 1, rows: [{ id: d.id }] };
          }
          if (q.startsWith('UPDATE users SET usdt_balance = usdt_balance +')) { state.users.get(args[2]).balance += args[0]; return { rowCount: 1 }; }
          if (q.startsWith('SELECT 1 FROM deposits')) return { rows: state.deposits.filter(d => d.wallet === args[0] && d.id !== args[1]) };
          if (q.startsWith('SELECT value FROM settings')) return { rows: [] };
          throw Error('Unhandled fixture SQL: ' + q);
        }
      }; return client;
    },
    async query(sql) {
      if (sql.includes('FROM pending_withdrawals')) return { rows: state.pending.filter(p => p.status === 'pending' && p.deadline + 120 < state.clock / 1000).map(p => ({ ...p })) };
      if (sql.includes('FROM settings')) return { rows: [] };
      throw Error('Unhandled pool SQL: ' + sql);
    }
  };
  const treasury = load('../services/treasury.js', {});
  const signer = { CHAINS: { base: { chainId: 8453, decimals: 6 }, bnb: { chainId: 56, decimals: 18 }, eth: { chainId: 1, decimals: 6 } },
    getOnchainWithdrawNonce: async () => 0,
    async getFinalizedWithdrawState() { if (state.finalized instanceof Error) throw state.finalized; return state.finalized; },
    async getAvailableLiquidity() { return ethers.utils.parseUnits(String(state.liquidity), 6); },
    async verifyFinalizedEvent() { if (!state.eventFinalized) throw Error('Event is not finalized'); },
    async generateWithdrawSignature(_wallet, _amount, _fee, nonce) { state.signatureCalls++; return { nonce, deadline: state.clock / 1000 + 600, chainId: 8453, signature: 'PUBLIC_FIXTURE_CALLBACK_ONLY' }; }
  };
  const db = { pool, getSetting: async (_key, fallback) => fallback, ensureUser: async () => {}, awardXP: async () => {}, creditReferralCommission: async () => [] };
  function reloadChain() { return load('../services/chain.js', { ethers: { ethers }, '../db': db, './treasury': treasury, './signer': signer }, { Date: FixtureDate }); }
  const handlers = {};
  load('../routes/redemptionRoutes.js', {
    express: { Router: () => ({ post(route, ...functions) { handlers[route] = functions.at(-1); } }) }, ethers: { ethers },
    '../utils/rateLimiters': { makeRateLimiter: () => () => {} }, '../db': db,
    '../services/signer': signer, '../services/treasury': treasury,
    '../utils/apiHelpers': { requireAuth() {}, getAuthWallet: req => req.wallet }, '../utils/settingsCache': { cfg: async () => cfg }
  }, { Date: FixtureDate });
  async function invoke(route, wallet = 'alice', body = { amount: 100, chain: 'base' }) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handlers[route]({ wallet, body }, res); return res;
  }
  return { state, pool, treasury, signer, chain: reloadChain(), reloadChain, invoke };
}

test('committed signature is reissued after lost response despite zero available balance and active cooldown', async () => {
  const f = fixture();
  const first = await f.invoke('/withdraw');
  const second = await f.invoke('/withdraw');
  assert.equal(first.statusCode, 200); assert.equal(second.body.reissued, true);
  assert.equal(second.body.signature, first.body.signature); assert.equal(first.body.nonce, 0);
  assert.equal(first.body.usdtBalance, 0); assert.equal(second.body.usdtBalance, 0);
  assert.equal(first.body.pending, true); assert.equal(second.body.pending, true);
  assert.equal(f.state.signatureCalls, 1); assert.equal(f.state.users.get('alice').balance, 0);
});

test('concurrent cross-wallet reservations cannot exceed observed chain liquidity', async () => {
  const f = fixture({ liquidity: 100 });
  const results = await Promise.all([f.invoke('/withdraw', 'alice'), f.invoke('/withdraw', 'bob')]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  assert.equal(f.state.pending.length, 1); assert.equal(f.state.signatureCalls, 1);
});

test('pending payout and refundable fees remain customer claims, distinct from tracked or physical reserve', async () => {
  const f = fixture(); await f.invoke('/withdraw');
  const client = await f.pool.connect(); await client.query('BEGIN');
  const snapshot = await f.treasury.lockRoom(client, 'bob');
  assert.equal(snapshot.collateral, 105); assert.equal(snapshot.liability, 100);
  assert.equal(snapshot.pendingNet, 95); assert.equal(snapshot.pendingGross, 100);
  assert.equal(snapshot.pendingFeeHold, 5); assert.equal(snapshot.pendingPayoutClaims, 95); assert.equal(snapshot.totalPayoutClaims, 195);
  assert.equal(snapshot.customerClaims, 200); assert.equal(snapshot.trackedReserve, 200);
  assert.equal(snapshot.physicalReserve, null); assert.equal(snapshot.room, 0);
  await client.query('COMMIT'); client.release();
});

test('expired local clock and RPC timeout preserve reservation and reject replacement signatures', async () => {
  const f = fixture(); await f.invoke('/withdraw'); f.state.clock += 900_000;
  f.state.finalized = Error('RPC timeout: outcome unknown');
  await f.chain.reconcilePendingWithdrawals();
  assert.equal(f.state.pending[0].status, 'pending'); assert.equal(f.state.users.get('alice').balance, 0);
  const retry = await f.invoke('/withdraw'); assert.equal(retry.statusCode, 409);
  assert.equal(retry.body.error, 'withdrawal_pending_reconciliation'); assert.equal(f.state.signatureCalls, 1);
});

test('finalized timestamp must be strictly after expiry; stale nonce is not proof', async () => {
  const f = fixture(); await f.invoke('/withdraw'); f.state.clock += 900_000;
  f.state.finalized.timestamp = f.state.pending[0].deadline;
  await f.chain.reconcilePendingWithdrawals(); assert.equal(f.state.pending[0].status, 'pending');
  f.state.finalized.timestamp++; f.state.pending[0].nonce = 1;
  await f.chain.reconcilePendingWithdrawals(); assert.equal(f.state.pending[0].status, 'pending');
  f.state.finalized.nonce = 1;
  await f.chain.reconcilePendingWithdrawals(); assert.equal(f.state.pending[0].status, 'expired');
  assert.equal(f.state.users.get('alice').balance, 100); assert.equal(f.state.collateral, 200);
});

test('concurrent expiry/reconciliation and retry refund once with user-first locks and one release', async () => {
  const f = fixture(); await f.invoke('/withdraw'); f.state.clock += 900_000; f.state.finalized.timestamp = f.state.clock / 1000;
  await Promise.all([f.chain.reconcilePendingWithdrawals(), f.chain.reconcilePendingWithdrawals(), f.invoke('/withdraw')]);
  assert.equal(f.state.users.get('alice').balance, 100); assert.equal(f.state.collateral, 200);
  assert.equal(f.state.transactions.filter(t => t.sql.includes('withdraw_refund')).length, 1);
  assert.equal(f.state.pending[0].status, 'expired');
});

test('finalized execution settles across restart/duplicate events without refunding', async () => {
  const f = fixture(); await f.invoke('/withdraw'); f.state.clock += 900_000; f.state.finalized.nonce = 1;
  const restarted = f.reloadChain();
  await Promise.all([restarted.settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 }), restarted.reconcilePendingWithdrawals()]);
  await restarted.settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 });
  assert.equal(f.state.pending[0].status, 'settled'); assert.equal(f.state.users.get('alice').balance, 0);
  assert.equal(f.state.transactions.filter(t => t.sql.includes('withdraw_refund')).length, 0);
});

test('unfinalized withdrawal event cannot settle pending funds', async () => {
  const f = fixture(); await f.invoke('/withdraw');
  await f.chain.settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 });
  assert.equal(f.state.pending[0].status, 'pending');
});

test('deposit replay/restart credits each finalized log once, including two logs in one transaction', async () => {
  const f = fixture();
  const receipt = { wallet: 'alice', amount: '10', chain: 'base', txHash: '0x' + 'a'.repeat(64), blockNumber: 88, blockHash: 'canonical', logIndex: 1 };
  f.state.eventFinalized = false;
  await assert.rejects(f.chain.processDeposit(receipt), /not finalized/);
  assert.equal(f.state.deposits.length, 0);
  f.state.eventFinalized = true;
  await Promise.all([f.chain.processDeposit(receipt), f.reloadChain().processDeposit(receipt)]);
  await f.reloadChain().processDeposit({ ...receipt, logIndex: 2 });
  assert.equal(f.state.deposits.length, 2); assert.equal(f.state.users.get('alice').balance, 120);
  assert.equal(f.state.collateral, 220);
});

test('legacy full-withdraw never mutates/signs and identifies existing wallet paths', async () => {
  const f = fixture(); const result = await f.invoke('/withdraw-all');
  assert.equal(result.statusCode, 409); assert.equal(result.body.error, 'legacy_withdraw_all_unavailable');
  assert.equal(f.state.calls.length, 0); assert.equal(f.state.signatureCalls, 0);
  assert.deepEqual(Array.from(result.body.supportedPaths), ['/api/swap', '/api/withdraw']);
});

for (const value of ['', 'NaN', 'Infinity', '-1', '5junk']) {
  test('malformed withdrawal fee cannot debit or sign: ' + value, async () => {
    const f = fixture({ settings: { withdraw_fee_percent: value } }); const result = await f.invoke('/withdraw');
    assert.equal(result.statusCode, 500); assert.equal(f.state.signatureCalls, 0); assert.equal(f.state.users.get('alice').balance, 100);
  });
}

test('explicit zero cooldown/fee remains valid; financial settings never parse a numeric prefix', async () => {
  const f = fixture({ settings: { withdrawal_cooldown_hours: 0, withdraw_fee_percent: 0 } });
  const result = await f.invoke('/withdraw'); assert.equal(result.statusCode, 200); assert.equal(result.body.net, 100);
  assert.throws(() => f.treasury.financialNumber('30junk', 'cap'), /Invalid financial/);
});

function finalizedSignerFixture({ block = { number: 50, timestamp: 1234, hash: 'canonical' }, canonical = block, nonce = 7 } = {}) {
  const calls = [];
  const provider = { async getBlock(tag) { calls.push(['block', tag]); return tag === 'finalized' ? block : canonical; } };
  const fakeEthers = {
    providers: { JsonRpcProvider: function () { return provider; } },
    Contract: function () { return { async withdrawNonce(_wallet, opts) { calls.push(['nonce', opts]); return nonce; } }; },
    BigNumber: { from: value => ({ toNumber: () => value }) },
    utils: { isAddress: () => true }, constants: { AddressZero: 'zero' }
  };
  const signer = load('../services/signer.js', { ethers: { ethers: fakeEthers } }, {
    process: { env: { BASE_RPC_URL: 'https://public-fixture.invalid', BASE_DEPOSIT_ADDRESS: 'public-fixture-contract' } }
  });
  return { signer, calls };
}

test('production finality helper pins nonce to finalized block then checks canonical hash', async () => {
  const f = finalizedSignerFixture(); const result = await f.signer.getFinalizedWithdrawState('public-fixture-user', 'base');
  assert.equal(result.timestamp, 1234); assert.equal(result.nonce, 7);
  assert.equal(f.calls[1][1].blockTag, 50); assert.equal(f.calls[2][1], 50);
});

test('unsupported finality, canonical mismatch and unfinalized/reorged deposit logs fail closed', async () => {
  await assert.rejects(finalizedSignerFixture({ block: null }).signer.getFinalizedWithdrawState('fixture', 'base'), /unavailable/);
  await assert.rejects(finalizedSignerFixture({ canonical: { hash: 'reorganized' } }).signer.getFinalizedWithdrawState('fixture', 'base'), /changed/);
  const f = finalizedSignerFixture();
  await assert.rejects(f.signer.verifyFinalizedEvent('base', 51, 'canonical'), /not finalized/);
  await assert.rejects(f.signer.verifyFinalizedEvent('base', 49, 'wrong-hash'), /not canonical/);
  await f.signer.verifyFinalizedEvent('base', 49, 'canonical');
});

test('legacy deposit tombstone prevents historical duplicate credit', async () => {
  const f = fixture(); const txHash = '0x' + 'a'.repeat(64);
  f.state.deposits.push({ id: 1, chain: 'base', tx: txHash, wallet: 'alice', log: -1 });
  await f.chain.processDeposit({ wallet: 'alice', amount: '10', chain: 'base', txHash, blockNumber: 88, blockHash: 'canonical', logIndex: 1 });
  assert.equal(f.state.users.get('alice').balance, 100); assert.equal(f.state.collateral, 200);
});

test('USDT season reward fails closed on a missing custody ledger/migration', async () => {
  const calls = [];
  const client = { release() {}, async query(sql) {
    calls.push(sql);
    if (sql.includes('FROM season_rewards')) return { rows: [{ reward_type: 'usdt', reward_amount: '10', reward_meta: {} }] };
    if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [] };
    throw Error('Unexpected mutation after missing guard: ' + sql);
  } };
  const season = load('../services/season.js', {
    '../db': { pool: { connect: async () => client }, getSetting: async (_key, fallback) => fallback },
    './treasury': { guardEnabled: async () => true, async lockRoom() { const error = Error('Missing ledger'); error.code = '42P01'; throw error; } }
  });
  const result = await season.claimSeasonReward('alice', 1);
  assert.equal(result.error, 'treasury_guard_error'); assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(calls.some(sql => sql.startsWith('UPDATE')), false);
});

test('finalized backfill replays the last block inclusively and stops before a cursor gap', async () => {
  const calls = [];
  const chain = load('../services/chain.js', {
    ethers: { ethers }, './treasury': load('../services/treasury.js', {}),
    '../db': { pool: { query: async () => ({ rows: [{ last_block: '42' }] }) } },
    './signer': { getFinalizedBlock: async () => ({ number: 55 }) }
  }, { process: { env: { BACKFILL_CHUNK: '5' } } }, '\nmodule.exports.backfillFixture = backfillEvents;');
  await assert.rejects(chain.backfillFixture('base', { async queryFilter(_event, start, end) {
    calls.push([start, end]); if (start === 47) throw Error('Public fixture gap'); return [];
  } }, {}, 6), /Finalized backfill gap 47~51/);
  assert.deepEqual(calls, [[42, 46], [47, 51]]);
});
