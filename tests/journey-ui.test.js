'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function node() {
  const classes = new Set();
  return { dataset: {}, textContent: '', hidden: false, disabled: false, listeners: {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
    removeAttribute() {}, addEventListener(event, handler) { this.listeners[event] = handler; }
  };
}

function fixture(lang = 0) {
  const elements = { onboardingHint: node(), obOverlay: node() };
  const title = node(), body = node(), button = node(), actions = node();
  actions.appendChild = item => { elements[item.id] = item; };
  elements.onboardingHint.querySelector = selector => ({
    '.onboarding-hint__title': title, '.onboarding-hint__body': body,
    '.onboarding-hint__actions button:not(.secondary)': button, '.onboarding-hint__actions': actions
  })[selector];
  const calls = [], timers = [];
  let wallet = '0xplayer';
  const sandbox = {
    window: { _goldenPathState: { fetched: true, completed: false, step: 2, ts: 12 } },
    document: { getElementById: id => elements[id] || null, createElement: () => node() },
    console: { warn() {} }, Date, Number, Object, String, Math, parseInt,
    getMyWallet: () => wallet, getAuthHeaders: () => ({ Authorization: 'fixture' }),
    _pageIsActive: () => true, isLoggedIn: () => true,
    _setActiveTimeout: (fn, delay) => { const token = { fn, delay, key: timers.length + 1, nativeId: 1000 + timers.length }; timers.push(token); return token.key; },
    _clearActiveTimeout: key => { const token = timers.find(item => item.key === key); if (token) token.cancelled = true; },
    clearTimeout: () => assert.fail('active timeout keys must use _clearActiveTimeout'),
    GOLDEN_PATH_TARGET_BY_STEP: { 0: 'territory', 1: 'mining', 2: 'fleet' },
    tl: (...variants) => variants[lang],
    openBaseModal: () => calls.push('base'), switchBaseTab: tab => calls.push(tab),
    loadMarketTab: () => calls.push('loadMarket'), loadGuildTab: () => calls.push('loadGuild'),
    applyGoldenPathGlow: () => calls.push('glow'), fetch: async () => { throw new Error('offline'); }
  };
  const source = fs.readFileSync(path.join(__dirname, '../assets/social-live-modal.js'), 'utf8');
  const start = source.indexOf('function getOnboardingWallet()');
  const end = source.indexOf('// ── override: old initOnboarding');
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end), sandbox, { filename: 'social-live-modal-journey.js' });
  return { sandbox, elements, title, body, button, calls, timers, setWallet: value => { wallet = value; } };
}

function status(step, completed = false) {
  return { step: Math.min(step, 3), completed: step >= 3, journey: { step, completed } };
}

test('loading and request failure show retry without resetting known legacy progress', async () => {
  const f = fixture();
  let reject;
  f.sandbox.fetch = () => new Promise((_resolve, fail) => { reject = fail; });
  const request = f.sandbox.runOnboardingCheck();
  assert.equal(f.elements.onboardingHint.dataset.state, 'loading');
  assert.equal(f.button.disabled, true);
  assert.equal(f.sandbox.window._goldenPathState.step, 2);
  reject(new Error('offline'));
  await request;
  assert.equal(f.elements.onboardingHint.dataset.state, 'error');
  assert.equal(f.button.textContent, 'RETRY');
  assert.equal(f.sandbox.window._goldenPathState.step, 2);
  f.sandbox.fetch = async () => ({ ok: true, json: async () => status(1) });
  await f.sandbox.onboardingAction();
  // onboardingAction starts the same async checker; wait for its JSON continuation.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.elements.onboardingHint.dataset.step, '1');
  assert.equal(f.button.disabled, false);
});

test('GP and chance-based minerals replace PP income copy in all four supported languages', () => {
  for (let lang = 0; lang < 4; lang++) {
    const f = fixture(lang);
    f.sandbox.showOnboardingHint(1);
    assert.match(f.body.textContent, /GP/);
    assert.match(f.body.textContent, /PP/);
    assert.ok(f.body.textContent.length > 20);
    assert.equal(f.elements.onboardingHint.dataset.state, 'ready');
    f.sandbox.onboardingAction();
    assert.ok(f.calls.includes('territory'));
  }
});

test('social stage stays visible after the legacy core completes and links to real market and guild tabs', async () => {
  const f = fixture();
  f.sandbox.fetch = async () => ({ ok: true, json: async () => status(3) });
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.sandbox.window._goldenPathState.completed, true);
  assert.equal(f.elements.onboardingHint.classList.contains('active'), true);
  assert.equal(f.elements.onboardingHint.dataset.step, '3');
  assert.equal(f.button.textContent, 'OPEN MARKET');
  f.sandbox.onboardingAction();
  assert.deepEqual(f.calls.slice(-3), ['base', 'market', 'loadMarket']);
  f.elements.journeyGuildAction.listeners.click();
  assert.deepEqual(f.calls.slice(-3), ['base', 'guild', 'loadGuild']);
  f.sandbox.fetch = async () => ({ ok: true, json: async () => status(4, true) });
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.elements.onboardingHint.classList.contains('active'), false);
});

test('first harvest hint and existing BASE glow both target the territory panel without changing the confirmed step', async () => {
  const f = fixture();
  f.sandbox.fetch = async () => ({ ok: true, json: async () => status(1) });
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.sandbox.window._goldenPathState.step, 1);
  assert.equal(f.sandbox.GOLDEN_PATH_TARGET_BY_STEP[1], 'territory');
  f.sandbox.onboardingAction();
  assert.ok(f.calls.includes('territory'));
});

test('invalid responses and HTTP failure never become confirmed first-landing progress', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }, { ok: true, json: async () => status(3, true) }]) {
    const f = fixture();
    f.sandbox.fetch = async () => response;
    await f.sandbox.runOnboardingCheck();
    assert.equal(f.elements.onboardingHint.dataset.state, 'error');
    assert.equal(f.sandbox.window._goldenPathState.step, 2);
  }
});

test('legacy setup overlay and an explicit dismissal suppress competing journey cards', async () => {
  const f = fixture();
  let requests = 0;
  f.sandbox.fetch = async () => { requests++; return { ok: true, json: async () => status(0) }; };
  f.elements.obOverlay.classList.add('active');
  await f.sandbox.runOnboardingCheck();
  assert.equal(requests, 0);
  assert.equal(f.elements.onboardingHint.classList.contains('active'), false);
  f.elements.obOverlay.classList.remove('active');
  await f.sandbox.runOnboardingCheck();
  await f.sandbox.dismissOnboardingHint();
  const afterDismiss = requests;
  await f.sandbox.runOnboardingCheck();
  assert.equal(requests, afterDismiss);
  assert.equal(f.elements.onboardingHint.classList.contains('active'), false);
});

test('a late response cannot apply another account\'s progress or reopen a dismissed card', async () => {
  const f = fixture();
  let resolve;
  f.sandbox.fetch = () => new Promise(done => { resolve = done; });
  const pending = f.sandbox.runOnboardingCheck();
  f.setWallet('0xother');
  resolve({ ok: true, json: async () => status(3) });
  await pending;
  assert.equal(f.sandbox.window._goldenPathState.step, 2);
  assert.notEqual(f.elements.onboardingHint.dataset.state, 'ready');
  assert.equal(f.elements.onboardingHint.classList.contains('active'), false);

  const dismissed = fixture();
  let finish;
  dismissed.sandbox.fetch = url => url === '/api/onboarding/dismiss'
    ? Promise.resolve({ ok: true })
    : new Promise(done => { finish = done; });
  const pendingDismissed = dismissed.sandbox.runOnboardingCheck();
  await dismissed.sandbox.dismissOnboardingHint();
  finish({ ok: true, json: async () => status(3) });
  await pendingDismissed;
  assert.equal(dismissed.elements.onboardingHint.classList.contains('active'), false);
  assert.equal(dismissed.sandbox.window._goldenPathState.step, 2);
});

test('an unresponsive request times out to retry without changing progress', async () => {
  const f = fixture();
  f.sandbox.AbortController = AbortController;
  f.sandbox.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const pending = f.sandbox.runOnboardingCheck();
  const timeout = f.timers.find(timer => timer.delay === 12000);
  assert.ok(timeout);
  timeout.fn();
  await pending;
  assert.equal(f.button.textContent, 'RETRY');
  assert.equal(f.sandbox.window._goldenPathState.step, 2);
  assert.equal(timeout.cancelled, true);
});

test('first-sortie entry uses the starter operations and suppresses legacy claim guidance', async () => {
  const f = fixture();
  f.sandbox.window.openCommandCenter = tab => f.calls.push('operations:' + tab);
  f.sandbox.window.maybeShowFirstClaimGuide = () => assert.fail('competing first-claim guide');
  f.sandbox.fetch = async url => ({ ok: true, json: async () => url === '/api/starter-ops/state'
    ? { missions: Array.from({ length: 5 }, () => ({ status: 'locked' })) } : status(0) });
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.title.textContent, 'FIRST SORTIE');
  assert.equal(f.button.textContent, 'START OPERATIONS');
  f.sandbox.onboardingAction();
  assert.ok(f.calls.includes('operations:missions'));
});

test('started operations suppress duplicate journey panels until all five rewards are claimed', async () => {
  for (const missionStatus of ['active', 'completed', 'claimed']) {
    const f = fixture();
    f.sandbox.window.openCommandCenter = () => {};
    f.sandbox.fetch = async url => ({ ok: true, json: async () => url === '/api/starter-ops/state'
      ? { missions: [{ status: missionStatus }, ...Array.from({ length: 4 }, () => ({ status: 'locked' }))] } : status(3) });
    await f.sandbox.runOnboardingCheck();
    assert.equal(f.elements.onboardingHint.classList.contains('active'), false);
    f.sandbox.fetch = async url => ({ ok: true, json: async () => url === '/api/starter-ops/state'
      ? { missions: Array.from({ length: 5 }, () => ({ status: 'claimed' })) } : status(3) });
    await f.sandbox.runOnboardingCheck();
    assert.equal(f.elements.onboardingHint.dataset.step, '3');
    assert.equal(f.button.textContent, 'OPEN MARKET');
  }
});

test('unavailable starter evidence does not fabricate an unstarted first-sortie CTA', async () => {
  const f = fixture();
  f.sandbox.window.openCommandCenter = () => assert.fail('unconfirmed operations CTA');
  f.sandbox.fetch = async url => url === '/api/starter-ops/state' ? { ok: false }
    : { ok: true, json: async () => status(0) };
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.elements.onboardingHint.dataset.state, 'error');
  assert.equal(f.button.textContent, 'RETRY');
});

test('an open operations panel suppresses competing journey prompts', async () => {
  const f = fixture();
  f.elements.commandCenter = { hidden: false };
  f.sandbox.fetch = () => assert.fail('no journey request behind an open operations panel');
  await f.sandbox.runOnboardingCheck();
  assert.equal(f.elements.onboardingHint.classList.contains('active'), false);
});
