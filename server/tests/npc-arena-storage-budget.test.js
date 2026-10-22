'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../services/npcArena.js'), 'utf8');
const MiB = 1024 * 1024;
const stopAt = (128 - 20) * MiB;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture({ bytes = '0', storageError = null, storageRows = null, enabled = true,
  liveArena = 0, liveTotal = 0, active = 8 } = {}) {
  const sqls = [], writes = [], dispatched = [], densityCalls = [], warnings = [];
  let connections = 0, densityCount = active;
  const pool = {
    async query(sql, args) {
      sqls.push({ sql, args });
      if (sql.includes('FROM settings')) return { rows: [{ key: 'npc_arena_enabled', value: enabled }] };
      if (sql.includes('pg_total_relation_size')) {
        if (storageError) throw Error(storageError);
        return { rows: storageRows || [{ size_bytes: bytes }] };
      }
      if (sql.includes('AS ships_alive')) return { rows: [
        { fleet_id: '1', owner_wallet: 'npc-a', faction_code: 'MCC', ships_alive: '2' },
        { fleet_id: '2', owner_wallet: 'npc-b', faction_code: 'CV', ships_alive: '2' },
      ] };
      if (sql.includes('FROM (')) return { rows: [{ n: densityCount }] };
      if (sql.includes("battle_summary->>'arena'")) return { rows: [{ n: liveArena }] };
      if (sql.includes('FROM fleet_battles')) return { rows: [{ n: liveTotal }] };
      throw Error('Unexpected pool SQL: ' + sql);
    },
    async connect() {
      connections++;
      return { async query(sql, args) {
        writes.push({ sql, args });
        if (sql.includes('FOR UPDATE OF f')) return { rows: [{ id: '1', is_in_battle: false }, { id: '2', is_in_battle: false }] };
        if (sql.includes('INSERT INTO fleet_battles')) return { rows: [{ id: '991' }] };
        return { rows: [] };
      }, release() {} };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, console: { log() {}, warn(message) { warnings.push(message); }, error() {} },
    require(name) {
      if (name === '../db') return { pool };
      if (name === './battleScheduler') return { runBattle: async id => { dispatched.push(id); } };
      if (name === './aiFleetManager') return { ensureAiFleets: async () => { densityCalls.push(true); densityCount = 8; return { created: 1 }; } };
      throw Error('Unavailable optional collaborator');
    },
  });
  return { service: module.exports, sqls, writes, dispatched, densityCalls, warnings, get connections() { return connections; } };
}
function assertNoNewBattle(f) {
  assert.equal(f.connections, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.dispatched.length, 0);
  assert.ok(!f.sqls.some(q => q.sql.includes('AS ships_alive')), 'no fleet selection, reservation or participant writes');
}

test('missing replay relation resolves to zero using fixed public relation metadata and permits only the normal NPC flow', async () => {
  const f = fixture();
  const result = await f.service.runArenaTick();
  assert.equal(result.spawned, true);
  const reads = f.sqls.filter(q => q.sql.includes('pg_total_relation_size'));
  assert.equal(reads.length, 1);
  assert.match(reads[0].sql, /COALESCE\(pg_total_relation_size\(to_regclass\('public\.fleet_battle_timelines'\)\), 0\)::text AS size_bytes/);
  assert.doesNotMatch(reads[0].sql, /\bFROM\b|\bSUM\b|\bCOUNT\b|wallet|DELETE|UPDATE/i);
  assert.equal(reads[0].args, undefined, 'no dynamic relation or user data');
  assert.deepEqual(f.dispatched, ['991']);
  assert.equal(f.warnings.length, 0, 'ordinary matches do not add storage status logs');
  const created = f.writes.find(q => q.sql.includes('INSERT INTO fleet_battles'));
  assert.deepEqual(JSON.parse(created.args[0]), { arena: true, is_ai_battle: true, npc_vs_npc: true, created_by: 'npc_arena' });
  assert.ok(f.writes.some(q => q.sql === 'COMMIT'));
});

test('108MiB soft stop reserves 20MiB inside the 128MiB budget without deleting records or blocking player services', async () => {
  const below = fixture({ bytes: String(stopAt - 1) });
  assert.equal((await below.service.runArenaTick()).spawned, true);
  for (const bytes of [stopAt, 128 * MiB, 500 * MiB]) {
    const f = fixture({ bytes: String(bytes) });
    assert.deepEqual(plain(await f.service.runArenaTick()), { skipped: 'timeline_storage_budget' });
    assertNoNewBattle(f);
    assert.ok(f.sqls.every(q => /^\s*SELECT\b/.test(q.sql)), 'only metadata/settings/concurrency reads');
    assert.deepEqual(f.warnings, [`[npcArena] background match skipped: timeline_storage_budget (bytes=${bytes}, startLimit=${stopAt})`]);
  }
  // This check belongs solely to runArenaTick; there is no storage-policy hook
  // in battleScheduler, battleTimeline, player/NPC PvE or reward services.
  assert.equal(source.match(/pg_total_relation_size/g).length, 1);
});

test('permission and availability failures skip safely without leaking the database error or mutating battles', async () => {
  for (const storageError of ['permission denied for relation', 'connection unavailable']) {
    const f = fixture({ storageError });
    assert.deepEqual(plain(await f.service.runArenaTick()), { skipped: 'timeline_storage_unavailable' });
    assertNoNewBattle(f);
    assert.deepEqual(f.warnings, ['[npcArena] background match skipped: timeline_storage_unavailable']);
  }
});

test('missing, NaN, malformed, fractional, negative and unsafe metadata fail closed', async () => {
  for (const bytes of [undefined, null, NaN, Infinity, 0, '', 'NaN', '-1', '1.5', '0oops', '9007199254740992']) {
    const f = fixture({ storageRows: [{ size_bytes: bytes }] });
    assert.deepEqual(plain(await f.service.runArenaTick()), { skipped: 'timeline_storage_unavailable' });
    assertNoNewBattle(f);
    assert.deepEqual(f.warnings, ['[npcArena] background match skipped: timeline_storage_unavailable']);
  }
  const empty = fixture({ storageRows: [] });
  assert.deepEqual(plain(await empty.service.runArenaTick()), { skipped: 'timeline_storage_unavailable' });
  assertNoNewBattle(empty);
});

test('disabled and concurrency caps retain their existing results before any storage read', async () => {
  for (const [options, expected] of [[{ enabled: false }, 'disabled'], [{ liveArena: 2 }, 'arena_concurrent_cap'],
    [{ liveTotal: 3 }, 'global_battle_cap']]) {
    const f = fixture({ ...options, storageError: 'must not be read' });
    assert.equal((await f.service.runArenaTick()).skipped, expected);
    assert.ok(!f.sqls.some(q => q.sql.includes('pg_total_relation_size')));
    assertNoNewBattle(f);
  }
});

test('NPC density replenishment remains available even when replay metadata is unavailable or beyond budget', async () => {
  const f = fixture({ bytes: String(500 * MiB), storageError: 'unavailable', active: 7 });
  assert.deepEqual(plain(await f.service.ensureNpcDensity()), { topped_up: true, before: 7, after: 8, created: 1, min: 8 });
  assert.equal(f.densityCalls.length, 1);
  assert.ok(!f.sqls.some(q => q.sql.includes('pg_total_relation_size')));
  assert.equal(f.writes.length, 0);
});
