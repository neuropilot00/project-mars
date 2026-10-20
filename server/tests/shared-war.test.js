'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(file, imports) {
  const box = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
    require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw new Error('Unconfigured collaborator ' + name); } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../' + file), 'utf8'), box, { filename: file });
  return box.module.exports;
}
const originalSiege = () => ({ id: '7', status: 'pending', challenger_wallet: 'principal-atk', defender_wallet: 'principal-def', challenger_guild_id: '1', defender_guild_id: '2', sector_code: 'relay', siege_starts_at: '2026-10-22T12:00:00Z', siege_ends_at: '2026-10-23T12:00:00Z' });
function fixture(overrides = {}) {
  const siege = Object.assign(originalSiege(), overrides.siege);
  const calls = [], chronicles = [], commits = overrides.commits || [], members = overrides.members || { newcomer: { guild_id: 1 } };
  const settings = { guild_governance_enabled: 'true', siege_max_fleets_per_side: '2', ...overrides.settings };
  const query = async (sql, params = []) => {
    sql = sql.trim();
    calls.push({ sql, params });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.startsWith('SELECT * FROM governor_sieges')) return { rows: [siege] };
    if (sql.includes('FROM guild_members')) return { rows: members[params[0]] ? [members[params[0]]] : [] };
    if (sql.includes('SELECT id, is_in_battle FROM fleets')) return { rows: overrides.noFleet ? [] : [{ id: params[0], is_in_battle: !!overrides.busy }] };
    if (sql.includes('FROM ship_mining_jobs')) return { rows: overrides.mining ? [{}] : [] };
    if (sql.includes('COUNT(*) AS cnt FROM ships')) return { rows: [{ cnt: overrides.empty ? 0 : 1 }] };
    if (sql.includes('COUNT(*)::int AS c FROM siege_fleet_commits')) return { rows: [{ c: overrides.sideCount || 0 }] };
    if (sql.includes('FROM siege_fleet_commits c JOIN fleets')) return { rows: commits };
    if (sql.includes('INSERT INTO fleet_battles')) { siege.fleet_battle_id = '81'; return { rows: [{ id: '81' }] }; }
    if (sql.includes('INSERT INTO siege_fleet_commits')) { commits.push({ wallet: params[1], fleet_id: params[2], side: params[3] }); return { rows: [] }; }
    if (sql.includes('UPDATE governor_sieges SET fleet_battle_id')) { siege.fleet_battle_id = params[0]; return { rows: [] }; }
    if (sql.startsWith('UPDATE governor_sieges SET challenger_fleet_id') || sql.startsWith('UPDATE governor_sieges SET defender_fleet_id') || sql.includes('INSERT INTO fleet_battle_participants') || sql.startsWith('UPDATE fleets SET')) return { rows: [] };
    if (sql.startsWith('SELECT fb.winner_side')) return { rows: [{ winner_side: overrides.winnerSide || 'atk', battle_status: overrides.battleStatus || 'ended', governor_siege_id: '7', siege_id: '7', challenger_wallet: 'principal-atk', defender_wallet: 'principal-def', status: siege.status }] };
    if (sql.startsWith('SELECT status, winner_side FROM fleet_battles')) return { rows: [{ status: overrides.battleStatus || 'ended', winner_side: overrides.winnerSide || 'atk' }] };
    if (overrides.resolve) {
      if (sql.startsWith('SELECT 1 FROM sector_governance')) return { rows: [{}] };
      if (sql.includes('COUNT(*) AS cnt FROM pixels')) return { rows: [{ cnt: params[0] === 'principal-atk' ? 3 : 9 }] };
      if (sql.includes('SET status = \'resolved\'')) { siege.status = 'resolved'; siege.winner_wallet = params[0]; return { rows: [] }; }
      if (sql.startsWith('SELECT governor_since')) return { rows: [] };
      if (sql.includes('UPDATE sector_governance')) return { rows: [] };
    }
    throw new Error('Unexpected fixture SQL ' + sql);
  };
  const client = { query, release() {} };
  const db = { pool: { query, connect: async () => client }, getSetting: async (key, fallback) => settings[key] ?? fallback };
  const service = load('services/siege.js', { '../db': db, './chronicle': { record: async (type, data) => chronicles.push({ type, data }) } });
  const bridge = load('services/siegeFleetBridge.js', { '../db': db, './siege': service, './fleetOccupancy': { assertFleetsNotMining: async () => {} } });
  return { siege, calls, chronicles, commits, service, bridge };
}
test('newcomer guild member joins their side with owned fleet, membership lock and one-wallet upsert', async () => {
  const f = fixture();
  const receipt = await f.service.getSiegeParticipation('7', 'newcomer');
  assert.equal(receipt.side, 'atk'); assert.equal(receipt.canCommit, true);
  assert.equal(receipt.maxFleetsPerPlayer, 1); assert.equal(receipt.supplyAffectsSiege, false);
  assert.equal(Object.keys(receipt).some(key => /wallet|nickname|chat|email/i.test(key)), false);
  const result = await f.service.commitSiegeFleet('7', 'NEWCOMER', '31');
  assert.equal(result.success, true); assert.equal(result.side, 'atk');
  assert.ok(f.calls.some(c => /guild_members.*FOR SHARE/.test(c.sql)));
  assert.ok(f.calls.some(c => c.sql.includes('ON CONFLICT (siege_id, wallet) DO UPDATE')));
  assert.equal(f.calls.at(-1).sql, 'COMMIT');
});
for (const [label, options, who, error] of [
  ['unrelated guild', { members: { newcomer: { guild_id: '3' } } }, 'newcomer', 'not_a_participant'],
  ['outsider', {}, 'outsider', 'not_a_participant'],
  ['governance disabled', { settings: { guild_governance_enabled: 'false' } }, 'newcomer', 'not_a_participant'],
  ['side cap', { sideCount: 2 }, 'newcomer', 'side_full'],
  ['not owned', { noFleet: true }, 'newcomer', 'fleet_not_found'],
  ['busy', { busy: true }, 'newcomer', 'fleet_in_battle'],
  ['mining', { mining: true }, 'newcomer', 'fleet_mining'],
  ['empty', { empty: true }, 'newcomer', 'fleet_empty'],
  ['closed admission', { siege: { fleet_battle_id: '81' } }, 'newcomer', 'battle_already_created']
]) test(label + ' cannot contribute a new siege commitment', async () => {
  const f = fixture(options); const result = await f.service.commitSiegeFleet('7', who, '31');
  assert.equal(result.success, false); assert.equal(result.error, error); assert.equal(f.commits.length, 0);
});
const assembly = () => ({ siege: { status: 'active' }, commits: [
  { wallet: 'newcomer', fleet_id: '31', side: 'atk', owner_wallet: 'newcomer', is_in_battle: false },
  { wallet: 'principal-def', fleet_id: '32', side: 'def', owner_wallet: 'principal-def', is_in_battle: false }
] });
test('two-sided assembly creates exactly one common battle; second attempt returns persisted id', async () => {
  const f = fixture(assembly());
  assert.equal(await f.bridge.createSiegeBattleMulti({ governor_siege_id: '7' }), '81');
  assert.equal(f.calls.filter(c => c.sql.includes('INSERT INTO fleet_battle_participants')).length, 2);
  assert.ok(f.calls.some(c => c.sql.includes('SELECT * FROM governor_sieges') && c.sql.includes('FOR UPDATE')));
  assert.equal(await f.bridge.createSiegeBattleMulti({ governor_siege_id: '7' }), '81');
  assert.equal(f.calls.filter(c => c.sql.includes('INSERT INTO fleet_battles')).length, 1);
});
for (const changed of ['owner', 'allegiance']) test(changed + ' change before assembly blocks admission', async () => {
  const options = assembly();
  if (changed === 'owner') options.commits[0].owner_wallet = 'buyer';
  else options.members = { newcomer: { guild_id: 2 } };
  const f = fixture(options);
  await assert.rejects(f.bridge.createSiegeBattleMulti({ governor_siege_id: '7' }), new RegExp(changed === 'owner' ? 'FLEET_OWNER_CHANGED' : 'PARTICIPANT_ALLEGIANCE_CHANGED'));
  assert.equal(f.calls.filter(c => c.sql.includes('INSERT INTO fleet_battles')).length, 0);
  assert.equal(f.calls.at(-1).sql, 'ROLLBACK');
});
test('shared result uses existing governor resolution and chronicle, then exposes rebuild receipt without currency grants', async () => {
  const f = fixture({ siege: { status: 'active', resolution_mode: 'fleet_battle', fleet_battle_id: '81' }, resolve: true });
  await f.bridge.applySiegeResult('81');
  assert.equal(f.siege.status, 'resolved'); assert.equal(f.siege.winner_wallet, 'principal-atk');
  assert.ok(f.calls.some(c => c.sql.includes('UPDATE sector_governance') && c.params[0] === 'principal-atk'));
  assert.equal(f.chronicles[0].type, 'siege_resolved'); assert.equal('actor_wallet' in f.chronicles[0].data, false); assert.equal(f.chronicles[0].data.extra.winner_side, 'atk'); assert.equal(f.chronicles[0].data.extra.siege_id, '7');
  const receipt = await f.service.getSiegeParticipation('7', 'newcomer');
  assert.equal(receipt.result, 'atk'); assert.equal(receipt.canCommit, false); assert.equal(receipt.nextAction, 'repair_and_rebuild');
  assert.equal(f.calls.some(c => /gp_balance\s*=.*\+|INSERT INTO.*transactions/i.test(c.sql)), false);
});

for (const winnerSide of ['def', 'draw']) test(winnerSide + ' result keeps governance and publishes an accurate aggregate defense record', async () => {
  const f = fixture({ siege: { status: 'active', resolution_mode: 'fleet_battle', fleet_battle_id: '81' }, resolve: true, winnerSide });
  await f.bridge.applySiegeResult('81');
  assert.equal(f.siege.winner_wallet, 'principal-def');
  assert.equal(f.chronicles[0].data.extra.winner_side, 'def');
  assert.match(f.chronicles[0].data.title_en, /defender retained/);
  assert.equal('target_wallet' in f.chronicles[0].data, false);
  const before = f.chronicles.length;
  await f.bridge.applySiegeResult('81');
  assert.equal(f.chronicles.length, before, 'resolved siege does not publish another result');
});

for (const battleStatus of ['preparing', 'active']) test(battleStatus + ' cannot settle governance through bridge or a stale winner hint', async () => {
  for (const direct of [false, true]) {
    const f = fixture({ siege: { status: 'active', resolution_mode: 'fleet_battle', fleet_battle_id: '81' }, resolve: true, battleStatus });
    if (direct) await f.service.resolveSiege('7', { battleWinnerWallet: 'principal-atk' });
    else await f.bridge.applySiegeResult('81');
    assert.equal(f.siege.status, 'active');
    assert.equal(f.chronicles.length, 0);
    assert.equal(f.calls.some(c => c.sql.includes('UPDATE sector_governance')), false);
  }
});
test('fleet battle siege without an assembled battle stays pending instead of awarding an area victory', async () => {
  const f = fixture({ siege: { status: 'active', resolution_mode: 'fleet_battle' }, resolve: true });
  const result = await f.service.resolveSiege('7');
  assert.equal(result.pending, true); assert.equal(f.siege.status, 'active');
  assert.equal(f.chronicles.length, 0);
});
