const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract real production functions, injecting only DOM/HTTP collaborators.
// The test preload rejects actual sockets, DB clients and credential reads.
function extract(file, start, end) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
const guard = extract('assets/core-runtime.js', 'function _guardedJsonFetch(', 'function _clearActiveTimeout(');
const keyed = extract('assets/battle-hub-modal.js', 'function battleHubReadFetch(', 'function normalizeBattleSummary(');
const tournaments = extract('assets/battle-hub-modal.js', 'async function tnLoad()', 'function renderTournamentCard(');
const closeTournament = extract('assets/battle-hub-modal.js', 'function closeTournaments()', 'function tnSwitchTab(');
const campaign = extract('assets/campaign-system.js', 'function loadCampaignStatus()', '// [v7.172 D-Crit-2/3 fix]');
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => null }, json: async () => body });

function tournamentFixture(responses) {
  let now = 100000;
  const node = { innerHTML: '' }, calls = [];
  const nodes = { tnListContent: node, tnRetryDelay: { textContent: '' }, tnRetryButton: { disabled: true }, tournamentModal: { classList: { remove() {} } } };
  const timers = new Map(); let timerId = 0;
  const c = {
    tnState: { currentTab: 'open' }, LANG: 'en', tl: en => en,
    document: { getElementById: id => nodes[id] }, AbortController,
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, due: now + ms }); return timerId; },
    setInterval: (fn, ms) => { timers.set(++timerId, { fn, due: now + ms, repeat: true }); return timerId; },
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    _apiFetchGuards: {}, _apiEndpointGuards: {}, _apiPublicHudBackoffUntil: 0,
    _isPublicHudFetchPath: () => false, _guardedFetchEndpointKey: () => 'GET /api/tournaments',
    getAuthHeaders: () => ({}), getMyWallet: () => 'fixture', Date: { now: () => now },
    renderTournamentCard: value => '<article>' + value.name + '</article>',
    fetch: async url => {
      calls.push(url);
      assert.ok(responses.length, 'unexpected synthetic request');
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result;
    }, console: { error() {} },
  };
  vm.createContext(c); vm.runInContext(guard + keyed + closeTournament + tournaments, c);
  return { c, node, nodes, calls, timers, advance: ms => { now += ms; for (const [id, t] of [...timers]) if (t.due <= now) { if (!t.repeat) timers.delete(id); t.fn(); } } };
}

for (const [label, response] of [
  ['HTTP 500', reply(500, { error: 'fixture' })],
  ['network rejection', new Error('synthetic failure')],
  ['invalid payload', reply(200, { tournaments: {} })],
]) test('tournament ' + label + ' exits Loading and can retry successfully', async () => {
  const f = tournamentFixture([response, reply(200, { tournaments: [{ name: 'fixture tournament' }] })]);
  await f.c.tnLoad();
  assert.doesNotMatch(f.node.innerHTML, /Loading\.\.\.|No open tournaments/);
  assert.match(f.node.innerHTML, /Could not load tournaments/);
  assert.match(f.node.innerHTML, /onclick="tnLoad\(\)"/);
  f.advance(30001);
  await f.c.tnLoad();
  assert.match(f.node.innerHTML, /<article>fixture tournament/);
});

test('tournament 429 shows a rate-limit state and preserves backoff on retry', async () => {
  const f = tournamentFixture([reply(429, {}), reply(200, { tournaments: [] })]);
  await f.c.tnLoad();
  assert.match(f.node.innerHTML, /Too many requests/);
  assert.doesNotMatch(f.node.innerHTML, /Loading\.\.\.|No open tournaments/);
  await f.c.tnLoad();
  assert.equal(f.calls.length, 1, 'retry must not bypass server backoff');
  f.advance(90001);
  assert.equal(f.nodes.tnRetryButton.disabled, false);
  assert.equal(f.nodes.tnRetryDelay.textContent, '');
  await f.c.tnLoad();
  assert.equal(f.calls.length, 2);
  assert.match(f.node.innerHTML, /No open tournaments/);
});

test('tournament success with no rows stays a normal empty state', async () => {
  const f = tournamentFixture([reply(200, { tournaments: [] })]);
  await f.c.tnLoad();
  assert.match(f.node.innerHTML, /No open tournaments/);
  assert.doesNotMatch(f.node.innerHTML, /onclick="tnLoad|Could not load/);
});

test('a late tournament response cannot replace the newly selected tab', async () => {
  const f = tournamentFixture([]);
  let resolveOld;
  f.c.battleHubReadKeyed = key => key === 'tournaments:open'
    ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ tournaments: [{ name: 'running fixture' }] });
  const old = f.c.tnLoad();
  f.c.tnState.currentTab = 'running';
  await f.c.tnLoad();
  resolveOld({ tournaments: [{ name: 'obsolete open fixture' }] });
  await old;
  assert.match(f.node.innerHTML, /running fixture/);
  assert.doesNotMatch(f.node.innerHTML, /obsolete/);
});

test('closing the tournament or changing wallet ignores the old response', async () => {
  for (const action of ['close', 'wallet']) {
    const f = tournamentFixture([]); let finish;
    f.c.battleHubReadKeyed = () => new Promise(resolve => { finish = resolve; });
    const pending = f.c.tnLoad(), before = f.node.innerHTML;
    if (action === 'close') f.c.closeTournaments();
    else f.c.getMyWallet = () => 'changed_fixture';
    finish({ tournaments: [{ name: 'obsolete' }] }); await pending;
    assert.equal(f.node.innerHTML, before);
  }
});

test('a tournament request with no response aborts and exits Loading', async () => {
  const f = tournamentFixture([]);
  f.c.fetch = (_, opts) => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('fixture abort'))));
  const pending = f.c.tnLoad(); f.advance(8000); await pending;
  assert.match(f.node.innerHTML, /Could not load tournaments/);
  assert.equal(f.c._apiFetchGuards['battle-hub:tournaments:open:fixture'].inFlight, false);
});

function campaignFixture(responses) {
  const node = { innerHTML: '' }, reputation = { innerHTML: 'stale reputation' }, rendered = { lists: [], reputation: [], inbox: [] };
  const c = {
    _campaignData: { chapters: [{ id: 'stale' }] }, _campaignStatusRequest: 0,
    AbortController, setTimeout, clearTimeout,
    document: { getElementById: id => id === 'campaignReputation' ? reputation : node }, walletState: { address: 'fixed_fixture_wallet' },
    factionState: { current: 'fixture' }, tl: en => en,
    fetch: async () => {
      assert.ok(responses.length, 'unexpected synthetic request');
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result;
    },
    renderCampaignReputation: value => rendered.reputation.push(value),
    renderCampaignRewardInbox: value => rendered.inbox.push(value),
    renderCampaignList: value => { rendered.lists.push(Array.from(value)); node.innerHTML = value.length ? 'fixture chapters' : 'fixture empty'; },
  };
  vm.createContext(c); vm.runInContext(campaign, c);
  return { c, node, reputation, rendered };
}

for (const [label, response] of [
  ['HTTP 500', reply(500, { error: 'fixture' })],
  ['HTTP 429', reply(429, { error: 'fixture' })],
  ['network rejection', new Error('synthetic failure')],
  ['malformed JSON', { ok: true, json: async () => { throw new SyntaxError('fixture'); } }],
  ['missing chapters', reply(200, {})],
  ['non-array chapters', reply(200, { chapters: {} })],
  ['invalid chapter row', reply(200, { chapters: [null] })],
  ['error payload with chapters', reply(200, { error: 'fixture', chapters: [] })],
]) test('campaign ' + label + ' is an error, clears stale data, and supports retry', async () => {
  const f = campaignFixture([response, reply(200, { chapters: [{ id: 'fixture' }] })]);
  await f.c.loadCampaignStatus();
  assert.match(f.node.innerHTML, /Campaign unavailable\./);
  assert.match(f.node.innerHTML, /onclick="loadCampaignStatus\(\)"/);
  assert.equal(f.rendered.lists.length, 0, 'failure must not render an empty success');
  assert.equal(f.c._campaignData, null);
  assert.equal(f.reputation.innerHTML, '', 'failure must not invent zero/Neutral reputation');
  assert.equal(f.rendered.reputation.length, 0);
  await f.c.loadCampaignStatus();
  assert.equal(f.rendered.lists[0].length, 1);
  assert.match(f.node.innerHTML, /fixture chapters/);
});

test('campaign HTTP 200 with chapters [] is a valid empty result', async () => {
  const f = campaignFixture([reply(200, { chapters: [] })]);
  await f.c.loadCampaignStatus();
  assert.equal(f.rendered.lists.length, 1);
  assert.equal(f.rendered.lists[0].length, 0);
  assert.equal(f.node.innerHTML, 'fixture empty');
});

test('a late failed campaign response cannot clear a newer successful retry', async () => {
  let resolveOld;
  const pending = new Promise(resolve => { resolveOld = resolve; });
  const f = campaignFixture([pending, reply(200, { chapters: [{ id: 'new' }] })]);
  const old = f.c.loadCampaignStatus();
  await Promise.resolve();
  await f.c.loadCampaignStatus();
  resolveOld(reply(500, { error: 'obsolete error' }));
  await old;
  assert.equal(f.c._campaignData.chapters[0].id, 'new');
  assert.equal(f.node.innerHTML, 'fixture chapters');
});

test('a campaign response for the previous account is not rendered', async () => {
  let resolveOld;
  const f = campaignFixture([new Promise(resolve => { resolveOld = resolve; })]);
  const pending = f.c.loadCampaignStatus();
  await Promise.resolve();
  f.c.walletState.address = 'another_fixture_wallet';
  resolveOld(reply(200, { chapters: [{ id: 'previous account' }] }));
  await pending;
  assert.equal(f.rendered.lists.length, 0);
});

test('a campaign request with no response aborts and offers retry', async () => {
  const f = campaignFixture([]); let expire;
  f.c.setTimeout = fn => { expire = fn; return 1; }; f.c.clearTimeout = () => {};
  f.c.fetch = (_, opts) => new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('fixture abort'))));
  const pending = f.c.loadCampaignStatus(); await Promise.resolve(); expire(); await pending;
  assert.match(f.node.innerHTML, /Campaign unavailable/);
});
