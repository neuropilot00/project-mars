'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/wallet-minigame.js'), 'utf8');
const start = source.indexOf('async function confirmWithdraw(){');
const end = source.indexOf('// ── Swap Modal', start);
assert.ok(start >= 0 && end > start);
function fixture(options = {}) {
  const calls = [], toasts = [], feeds = [];
  const amount = { value: options.amount ?? '80' };
  const button = { disabled: false, textContent: 'Request withdrawal' };
  let closed = 0, refreshed = 0;
  const context = {
    Number, console: { error() {} },
    emailAuth: { token: 'public-fixture-token' },
    walletState: { gameUsdt: options.balance ?? 100, chain: 'base', address: 'fixture' },
    document: { getElementById: id => id === 'wdrAmount' ? amount : button },
    tl: en => en, srvErr: code => code, shortAddr: v => v,
    showToast: (...v) => toasts.push(v), addFeed: v => feeds.push(v),
    refreshBalance() { refreshed++; }, closeWithdrawModal() { closed++; },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (options.wait) await options.wait;
      if (options.throw) throw Error('fixture unavailable');
      if (options.changeAccount) context.emailAuth.token = 'different-fixture-token';
      return { ok: options.ok !== false,
        json: async () => options.body ?? { success: true, signature: 'public-dummy-signature', requested: 80, usdtBalance: '20', pending: true } };
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, calls, toasts, feeds, button, amount,
    get closed() { return closed; }, get refreshed() { return refreshed; } };
}

test('a reservation displays only the server balance and never creates a paid withdrawal feed', async () => {
  const f = fixture(); await f.context.confirmWithdraw();
  assert.equal(f.context.walletState.gameUsdt, 20);
  assert.equal(f.calls.length, 1); assert.equal(f.closed, 1); assert.equal(f.refreshed, 1);
  assert.match(f.toasts[0][0], /reserved.*not yet confirmed/);
  assert.equal(f.feeds.length, 0); assert.equal(f.button.disabled, false);
});
test('signature reissue cannot double-debit a reservation locally', async () => {
  const f = fixture({ balance: 20, amount: '10', body: { success: true, reissued: true, requested: 80,
    signature: 'same-public-dummy-signature', usdtBalance: 20 } });
  await f.context.confirmWithdraw();
  assert.equal(f.context.walletState.gameUsdt, 20); assert.equal(f.feeds.length, 0);
});
test('an older response without an authoritative balance never invents a debit', async () => {
  const f = fixture({ body: { success: true, signature: 'public-dummy-signature' } });
  await f.context.confirmWithdraw();
  assert.equal(f.context.walletState.gameUsdt, 100); assert.equal(f.refreshed, 1);
});
test('unknown settlement remains an error without changing funds or implying payment', async () => {
  const f = fixture({ ok: false, body: { error: 'withdrawal_pending_reconciliation' } });
  await f.context.confirmWithdraw();
  assert.match(f.toasts[0][0], /still reserved.*settlement/);
  assert.equal(f.context.walletState.gameUsdt, 100); assert.equal(f.closed, 0); assert.equal(f.feeds.length, 0);
});
test('invalid quantities are rejected before a request', async () => {
  for (const amount of ['', 'Infinity', '1abc', '-1', '0', '101']) {
    const f = fixture({ amount }); await f.context.confirmWithdraw();
    assert.equal(f.calls.length, 0, amount); assert.equal(f.context.walletState.gameUsdt, 100);
  }
});
test('duplicate click is blocked while a reservation request is in flight', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const f = fixture({ wait }); const first = f.context.confirmWithdraw();
  await f.context.confirmWithdraw(); assert.equal(f.calls.length, 1);
  release(); await first; assert.equal(f.button.disabled, false);
});
test('malformed responses, transport failures and account switches cannot update another account', async () => {
  for (const options of [{ body: {} }, { throw: true }, { changeAccount: true }]) {
    const f = fixture(options); await f.context.confirmWithdraw();
    assert.equal(f.context.walletState.gameUsdt, 100); assert.equal(f.feeds.length, 0);
    assert.equal(f.closed, 0); assert.equal(f.button.disabled, false);
  }
});
