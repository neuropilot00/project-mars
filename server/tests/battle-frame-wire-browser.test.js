'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { createVisualJournal } = require('../services/battleVisualJournal');

const root = path.resolve(__dirname, '../..');
const codecSource = fs.readFileSync(path.join(root, 'assets/battle-frame-wire.js'), 'utf8');
const lab = fs.readFileSync(path.join(root, 'assets/tactical-lab-v11.html'), 'utf8');
const connectSource = lab.slice(lab.indexOf('function connectBattleWs() {'), lab.indexOf('function renderBattleSafetyLimit('));
test('battle iframe requests the v2 wire helper with a fresh cache key', () => {
  assert.match(lab, /<script src="battle-frame-wire\.js\?v=20261030-gzip2"><\/script>/);
});

function makeCodec(overrides = {}) {
  const window = { DecompressionStream, Blob, TextDecoder, atob, ...overrides };
  vm.runInNewContext(codecSource, { window, Uint8Array, Number, String, JSON, Error, Object });
  return window.OccupyBattleFrameWire;
}
function envelope(frame) {
  const bytes = Buffer.from(JSON.stringify(frame));
  const data = zlib.gzipSync(bytes).toString('base64');
  const codec = makeCodec(), visual_digest = codec.summarize(frame);
  return { type: 'frame_gzip_v1', bytes: bytes.length, data, visual_digest,
    visual_checksum: codec.checksum(data, visual_digest, frame._continuity, frame._continuity_before), ...(frame._continuity ? {_continuity:frame._continuity} : {}),
    ...(frame._continuity_before ? {_continuity_before:frame._continuity_before} : {}) };
}
async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw Error('timed out waiting for websocket handler');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
function socketFixture(codec) {
  const sockets = [], received = [], timers = [], logs = [];
  class Socket {
    constructor(url) { this.url = url; this.readyState = 1; this.closeArgs = null; this.sent = []; sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close(...args) { this.closeArgs = args; this.readyState = 3; queueMicrotask(() => this.onclose?.()); }
  }
  const sandbox = {
    tlDisposed: false, document: { hidden: false }, _parentReplay: false, TL_MODE: 'battle', _battleUiReady: true,
    tlQuery: () => '71', _wsBattle: null, _wsReconnectTimer: null, _battleWireDisabled: false,
    _waitingLiveSlot: false, _battleSyncWaiting:false, _battleAwaitFrame:false, _pendingCommands: new Map(),
    window: { parent: { localStorage: { getItem: () => '' } } },
    location: { protocol: 'https:', host: 'game.invalid' }, URLSearchParams, WebSocket: Socket,
    OccupyBattleFrameWire: codec, Promise, console, addLog: (...args) => logs.push(args),
    commandText: text => text, updateCommandDeck() {}, processBattleMessage: m => received.push(m),
    setTimeout: (fn, ms) => { if (ms !== 1500) return setTimeout(fn, ms); timers.push(fn); return timers.length; }, clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(connectSource, sandbox);
  sandbox.connectBattleWs();
  return { sockets, received, timers, logs, sandbox };
}

test('gzip codec round trips UTF-8 frame and accepts original JSON messages', async () => {
  const codec = makeCodec();
  assert.equal(codec.supported(), true);
  const frame = { type: 'frame', battleId: '71', t: 50, ships: [{ id: '1', text: '함선 🚀' }] };
  assert.equal(JSON.stringify(await codec.decode(JSON.stringify(envelope(frame)), '71')), JSON.stringify(frame));
  const ack = { type: 'cmd_ok', commandId: 'one' };
  assert.equal(JSON.stringify(await codec.decode(JSON.stringify(ack), '71')), JSON.stringify(ack));
});

test('gzip codec rejects invalid checksum, lengths, oversized data, and wrong battle', async () => {
  const codec = makeCodec();
  const frame = { type: 'frame', battleId: '71', t: 1 };
  const good = envelope(frame);
  const broken = Buffer.from(good.data, 'base64'); broken[broken.length - 8] ^= 0xff;
  const cases = [
    { ...good, data: broken.toString('base64') },
    { ...good, bytes: good.bytes - 1 },
    { ...good, bytes: good.bytes + 1 },
    { ...good, bytes: 2 * 1024 * 1024 + 1 },
    { ...good, data: 'A'.repeat(Math.ceil((2 * 1024 * 1024 + 1024) / 3) * 4 + 4) },
    { ...good, data: '!!!!' },
    envelope({ ...frame, battleId: '72' }),
    envelope({ ...frame, type: 'end' }),
  ];
  for (const value of cases) await assert.rejects(codec.decode(JSON.stringify(value), '71'));
});

test('unsupported browsers keep plain JSON and never request gzip', async () => {
  const codec = makeCodec({ DecompressionStream: undefined });
  assert.equal(codec.supported(), false);
  const f = socketFixture(codec), socket = f.sockets[0];
  assert.equal(new URL(socket.url).searchParams.has('wire'), false);
  socket.onmessage({ data: JSON.stringify({ type: 'frame', battleId: '71', t: 2 }) });
  await waitFor(() => f.received.length === 1);
  assert.equal(f.received[0].t, 2);
});

test('compressed frame, acknowledgement and end are delivered in socket order before close', async () => {
  const f = socketFixture(makeCodec()), socket = f.sockets[0];
  assert.equal(new URL(socket.url).searchParams.get('wire'), 'gzip-v2');
  socket.onmessage({ data: JSON.stringify(envelope({ type: 'frame', battleId: '71', t: 3 })) });
  socket.onmessage({ data: JSON.stringify({ type: 'cmd_ok', commandId: 'c' }) });
  socket.onmessage({ data: JSON.stringify({ type: 'end', winner_side: 'atk' }) });
  socket.readyState = 3; socket.onclose();
  await waitFor(() => f.timers.length === 1);
  assert.deepEqual(f.received.map(m => m.type), ['frame', 'cmd_ok', 'end']);
});

test('corrupt compressed frame closes, suppresses queued messages and reconnects without gzip', async () => {
  const f = socketFixture(makeCodec()), socket = f.sockets[0];
  const broken = envelope({ type: 'frame', battleId: '71', t: 4 });
  broken.data = Buffer.from('invalid gzip').toString('base64');
  socket.onmessage({ data: JSON.stringify(broken) });
  socket.onmessage({ data: JSON.stringify({ type: 'end', winner_side: 'atk' }) });
  await waitFor(() => f.timers.length === 1);
  assert.equal(socket.closeArgs[0], 4000);
  assert.deepEqual(f.received, []);
  f.timers[0]();
  assert.equal(f.sockets.length, 2);
  assert.equal(new URL(f.sockets[1].url).searchParams.has('wire'), false);
  f.sockets[1].onmessage({ data: JSON.stringify({ type: 'frame', battleId: '71', t: 5 }) });
  await waitFor(() => f.received.length === 1);
  assert.equal(f.received[0].t, 5);
});

test('slow consumers retain newest bounded frames and preserve ordered command and end messages', async () => {
  let resume;
  const pause = new Promise(resolve => { resume = resolve; });
  const codec = { supported: () => true, async decode(message) { await pause; return { type: 'frame', t: message.t }; } };
  const f = socketFixture(codec), socket = f.sockets[0];
  for (let i = 0; i < 20; i++) {
    if (i === 5) socket.onmessage({ data: JSON.stringify({ type: 'cmd_ok', commandId: 'five' }) });
    socket.onmessage({ data: JSON.stringify({ type: 'frame_gzip_v1', t: i }) });
  }
  socket.onmessage({ data: JSON.stringify({ type: 'end', winner_side: 'atk' }) });
  socket.readyState = 3; socket.onclose();
  assert.equal(f.timers.length, 0);
  resume();
  await waitFor(() => f.timers.length === 1);
  assert.deepEqual(f.received.map(m => m.type), ['frame', 'cmd_ok', 'frame', 'frame', 'frame', 'end']);
  assert.deepEqual(f.received.filter(m => m.type === 'frame').map(m => m.t), [0,17,18,19]);
  assert.equal(f.received[1].commandId, 'five');
});

test('unbounded control-message backlog closes the connection rather than retaining unlimited memory', async () => {
  const codec = { supported: () => true, decode: () => new Promise(() => {}) };
  const f = socketFixture(codec), socket = f.sockets[0];
  socket.onmessage({ data: JSON.stringify({ type: 'frame_gzip_v1', bytes: 10, data: 'AA==' }) });
  for (let i = 0; i < 65; i++) socket.onmessage({ data: JSON.stringify({ type: 'cmd_ok', commandId: String(i) }) });
  assert.equal(socket.closeArgs[0], 4001);
  await waitFor(() => f.timers.length === 1);
  f.timers[0]();
  assert.equal(new URL(f.sockets[1].url).searchParams.get('wire'), 'gzip-v2');
});

test('stalled decompression times out and cannot prevent an uncompressed reconnect', async () => {
  const codec = { supported: () => true, decode: () => new Promise(() => {}) };
  const f = socketFixture(codec), socket = f.sockets[0];
  f.sandbox.setTimeout = (fn, ms) => { if (ms === 2000) return setTimeout(fn, 10); f.timers.push(fn); return f.timers.length; };
  socket.onmessage({ data: JSON.stringify({ type: 'frame_gzip_v1', bytes: 100, data: 'AA==' }) });
  await waitFor(() => f.timers.length === 1);
  assert.equal(socket.closeArgs[0], 4000);
  f.timers[0]();
  assert.equal(new URL(f.sockets[1].url).searchParams.has('wire'), false);
});


test('invalid gzip transport JSON reconnects without negotiated compression', async () => {
  const f = socketFixture(makeCodec()), socket = f.sockets[0];
  socket.onmessage({ data: '{"type":"frame_gzip_v1",' });
  await waitFor(() => f.timers.length === 1);
  assert.equal(socket.closeArgs[0], 4000);
  f.timers[0]();
  assert.equal(new URL(f.sockets[1].url).searchParams.has('wire'), false);
});

test('only applied frames are acknowledged, duplicates are suppressed, and the applied cursor resumes', async () => {
  const journal = createVisualJournal(), codec = makeCodec(), f = socketFixture(codec), socket = f.sockets[0];
  const before = journal.currentCursor();
  const frame = {type:'frame',battleId:'71',t:1,combat_events:[],combat_salvos:[]};
  frame._continuity = journal.push(frame); frame._continuity_before = before;
  const message = JSON.stringify(envelope(frame));
  socket.onmessage({data:message}); socket.onmessage({data:message});
  await waitFor(() => socket.sent.length === 1);
  assert.equal(f.received.length, 1);
  assert.equal(socket.sent[0].type, 'frame_ack'); assert.equal(socket.sent[0].cursor.seq, 1);
  socket.readyState = 3; socket.onclose(); await waitFor(() => f.timers.length === 1); f.timers[0]();
  assert.equal(JSON.parse(new URL(f.sockets[1].url).searchParams.get('resume')).seq, 1);
});

test('first corrupt frame reconnects with its signed predecessor, never acknowledging it', async () => {
  const journal = createVisualJournal(), f = socketFixture(makeCodec()), socket = f.sockets[0];
  const frame = {type:'frame',battleId:'71',t:1,combat_events:[],combat_salvos:[]};
  frame._continuity_before = journal.currentCursor(); frame._continuity = journal.push(frame);
  const broken = envelope(frame); broken.data = Buffer.from('bad').toString('base64');
  socket.onmessage({data:JSON.stringify(broken)}); await waitFor(() => f.timers.length === 1);
  assert.equal(socket.sent.length, 0); f.timers[0]();
  assert.equal(JSON.parse(new URL(f.sockets[1].url).searchParams.get('resume')).seq, 0);
});

test('adjacent cursor totals detect a modified visual digest even if its checksum is recomputed', async () => {
  const journal = createVisualJournal(), codec = makeCodec(), f = socketFixture(codec), socket = f.sockets[0];
  function next(t) {
    const frame = {type:'frame',battleId:'71',t,combat_events:[{type:'shot_hit',seq:t,source_side:'atk',fire_type:'laser',from:{x:1,y:2},to:{x:3,y:4}}]};
    frame._continuity_before = journal.currentCursor(); frame._continuity = journal.push(frame); return frame;
  }
  socket.onmessage({data:JSON.stringify(envelope(next(1)))}); await waitFor(() => socket.sent.length === 1);
  const altered = envelope(next(2)); altered.visual_digest[0].count = 2;
  altered.visual_checksum = codec.checksum(altered.data, altered.visual_digest, altered._continuity, altered._continuity_before);
  socket.onmessage({data:JSON.stringify(altered)}); await waitFor(() => f.timers.length === 1);
  assert.equal(socket.closeArgs[0], 4000); assert.equal(f.received.length, 1);
  f.timers[0](); assert.equal(JSON.parse(new URL(f.sockets[1].url).searchParams.get('resume')).seq, 1);
});
