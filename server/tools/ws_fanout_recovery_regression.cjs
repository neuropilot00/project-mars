'use strict';
// Local-only asymmetric Redis interruption using two real Node WS processes.
// User identities, battle frames, and the database are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const http = require('node:http');
const { fork, spawn } = require('node:child_process');
const WebSocket = require('ws');
const Redis = require('ioredis');
const SERVER_ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label, attempts = 500) {
  for (let i = 0; i < attempts; i++) { if (await test()) return; await sleep(20); }
  throw Error('Timeout: ' + label);
}
async function port() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const result = server.address().port; await new Promise(resolve => server.close(resolve)); return result;
}
async function startRedis(redisPort) {
  const child = spawn('redis-server', ['--port', String(redisPort), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  await until(() => new Promise(resolve => {
    const socket = net.createConnection(redisPort, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false));
  }), 'Redis startup');
  return child;
}
async function createProxy(targetPort) {
  let allowed = true; const connections = new Set();
  const server = net.createServer(inbound => {
    if (!allowed) { inbound.destroy(); return; }
    const outbound = net.createConnection(targetPort, '127.0.0.1');
    connections.add(inbound); connections.add(outbound);
    const clean = () => { connections.delete(inbound); connections.delete(outbound); inbound.destroy(); outbound.destroy(); };
    inbound.on('error', clean); outbound.on('error', clean);
    inbound.on('close', clean); outbound.on('close', clean);
    inbound.pipe(outbound).pipe(inbound);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, down() { allowed = false; for (const socket of connections) socket.destroy(); },
    up() { allowed = true; }, async close() { for (const socket of connections) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
async function worker() {
  const tracked = [];
  class TrackedRedis extends Redis {
    constructor(...args) { if (!tracked.length && process.env.TEST_PUB_URL) args[0]=process.env.TEST_PUB_URL; super(...args); tracked.push(this); }
    publish(channel,raw) {
      let packet; try { packet=JSON.parse(raw); } catch (_) {}
      const delay=Number(process.env.TEST_SYNC_DELAY_MS)||0;
      if (delay&&packet?.kind==='battleSyncResponse') {
        process.send({ event:'syncQueued', battleId:packet.battleId });
        return new Promise((resolve,reject)=>setTimeout(()=>super.publish(channel,raw).then(resolve,reject),delay));
      }
      return super.publish(channel,raw);
    }
  }
  const source = fs.readFileSync(path.join(SERVER_ROOT, 'wsServer.js'), 'utf8');
  const ctx = { module: { exports: {} }, Buffer, Date, JSON, setTimeout, clearTimeout, setInterval, clearInterval,
    process: { pid: process.pid, env: { REDIS_URL: process.env.TEST_REDIS_URL, WS_MAX_PER_IP: '50' } },
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === 'ioredis') return TrackedRedis;
      if (name === 'ws') return WebSocket;
      if (name === 'url') return require('node:url');
      if (name === 'crypto') return require('node:crypto');
      if (name === './utils/totpSessionBoundary') return { validateToken: async token => ({ wallet: token === 'owner' ? 'owner' : token === 'other' ? 'other' : null, totp: false, revoked: token === 'revoked' }) };
      if (name === './db') return { pool: { query: async () => ({ rows: [] }) } };
      if (name === './services/liveBattle') return { isActive: () => true, enqueueCommandResult: () => ({ accepted: true }) };
      if (name.startsWith('./')) return require(path.join(SERVER_ROOT, name.slice(2)));
      throw Error('Unexpected dependency: ' + name);
    } };
  ctx.global = ctx; vm.runInNewContext(source, ctx, { filename: 'wsServer.js' });
  const api = ctx.module.exports, server = http.createServer(), wss = api.attachWsServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const clients = new Map(), ackEnabled = new Map();
  process.on('message', async msg => {
    try {
      let value;
      if (msg.op === 'status') value = tracked.map(client => client.status);
      else if (msg.op === 'open') {
        const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/battle/${msg.battle}?token=${msg.token || ''}${msg.ack ? '&wire=gzip-v2' : ''}`);
        ackEnabled.set(msg.client, !!msg.ack);
        socket.on('message', data => {
          const packet = JSON.parse(data); process.send({ event:'packet', client:msg.client, packet });
          if (packet.type==='frame' && packet._continuity && ackEnabled.get(msg.client)) socket.send(JSON.stringify({type:'frame_ack',cursor:packet._continuity}));
        });
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        clients.set(msg.client, socket); value = true;
      } else if (msg.op === 'ackHold') { ackEnabled.set(msg.client, !msg.hold); value = true; }
      else if (msg.op === 'ackCursor') { clients.get(msg.client).send(JSON.stringify({type:'frame_ack',cursor:msg.cursor})); value = true; }
      else if (msg.op === 'frame') { api.broadcastBattleFrame(msg.battle, msg.frame); value = true; }
      else if (msg.op === 'end') { api.broadcastBattleEnd(msg.battle, msg.summary); value = true; }
      else if (msg.op === 'commandResult') { api.broadcastBattleCommandResult(msg.battle, msg.result); value = true; }
      else if (msg.op === 'quit') {
        for (const socket of clients.values()) socket.terminate(); tracked.forEach(client => client.disconnect());
        wss.close(); server.close(); process.send({ id:msg.id, value:true }); return setTimeout(() => process.exit(0), 50);
      }
      process.send({ id:msg.id, value });
    } catch (error) { process.send({ id:msg.id, error:error.stack }); }
  });
  process.send({ event:'ready', pid:process.pid });
}
function startWorker(redisUrl, pubUrl = '', syncDelayMs = 0) {
  const child = fork(__filename, ['--worker'], { env:{ PATH:process.env.PATH, TEST_REDIS_URL:redisUrl, TEST_PUB_URL:pubUrl, TEST_SYNC_DELAY_MS:String(syncDelayMs) }, stdio:['ignore','ignore','inherit','ipc'] });
  const packets = [], syncEvents = [], requests = new Map(); let next = 0;
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.on('message', msg => {
      if (msg.event === 'ready') resolve(msg.pid);
      else if (msg.event === 'packet') packets.push(msg);
      else if (msg.event === 'syncQueued') syncEvents.push(msg);
      else if (requests.has(msg.id)) { const r = requests.get(msg.id); requests.delete(msg.id); msg.error ? r.reject(Error(msg.error)) : r.resolve(msg.value); }
    });
  });
  return { child, packets, syncEvents, ready, call(op, args={}) { const id=++next; return new Promise((resolve,reject)=>{requests.set(id,{resolve,reject});child.send({id,op,...args});});} };
}
function frame(tick, hp) {
  const event = (side, seq) => ({ id:`71:combat:${seq}`, seq, tick, type:'shot_hit', source_side:side, fire_type:'laser',
    source_ship_id:`s-${side}`, target_ship_id:`s-${side === 'atk' ? 'def' : 'atk'}`,
    from:{x:side === 'atk' ? 1 : 9,y:2}, to:{x:side === 'atk' ? 9 : 1,y:2}, damage:1, destroyed:false });
  return { t:tick, realtime:true, fleets:[], ships:[{ id:'s-def', fid:'f-def', hp }],
    combat_events:[event('atk',tick*10+1),event('def',tick*10+2)], combat_salvos:[] };
}
async function main() {
  const redisPort=await port(); let redis, proxy, producerPubProxy; const workers=[];
  try {
    redis=await startRedis(redisPort); proxy=await createProxy(redisPort); producerPubProxy=await createProxy(redisPort);
    const producer=startWorker(`redis://127.0.0.1:${redisPort}`, `redis://127.0.0.1:${producerPubProxy.port}`,300),viewer=startWorker(`redis://127.0.0.1:${proxy.port}`);
    workers.push(producer,viewer); const pids=await Promise.all(workers.map(x=>x.ready)); assert.notEqual(...pids);
    await Promise.all([producer.call('open',{battle:'71',client:'local',token:'owner'}),viewer.call('open',{battle:'71',client:'remote',token:'other'})]);
    await until(async()=> (await producer.call('status')).every(x=>x==='ready') && (await viewer.call('status')).every(x=>x==='ready'), 'Redis clients ready');
    await sleep(100); await producer.call('frame',{battle:'71',frame:frame(5,100)});
    await until(()=>viewer.packets.some(p=>p.packet.type==='frame'&&p.packet.t===5),'initial remote frame');
    proxy.down(); await until(async()=> (await viewer.call('status')).some(x=>x!=='ready'),'viewer Redis isolated');
    await producer.call('frame',{battle:'71',frame:frame(10,90)}); await producer.call('frame',{battle:'71',frame:frame(15,80)});
    await producer.call('frame',{battle:'71',frame:frame(20,70)}); await sleep(100);
    assert.equal(viewer.packets.filter(p=>p.packet.type==='frame').length,1,'no remote data during interruption');
    proxy.up(); await until(async()=> (await viewer.call('status')).every(x=>x==='ready'),'viewer Redis reconnected',1000);
    // Hold the actual Redis sync response so a newer live frame arrives first.
    await until(()=>producer.syncEvents.some(e=>e.battleId==='71'),'sync response deliberately delayed',1000);
    await producer.call('frame',{battle:'71',frame:frame(25,60)});
    await until(()=>viewer.packets.some(p=>p.packet.type==='frame'&&p.packet.t===20),'recovery frame',1000);
    await until(()=>viewer.packets.some(p=>p.packet.type==='frame'&&p.packet.t===25),'new frame after recovery',1000);
    const rIndex=viewer.packets.findIndex(p=>p.packet.type==='frame'&&p.packet.t===20);
    const nIndex=viewer.packets.findIndex(p=>p.packet.type==='frame'&&p.packet.t===25);
    assert.ok(rIndex<nIndex,'newer frame is held until recovered prior state');
    await producer.call('commandResult',{battle:'71',result:{wallet:'owner',commandId:'private-1',cmd:'hold',status:'applied'}});
    await sleep(150);
    const remote=viewer.packets.filter(p=>p.packet.type==='frame').map(p=>p.packet);
    const local=producer.packets.filter(p=>p.packet.type==='frame').map(p=>p.packet);
    assert.equal(remote.at(-1).ships[0].hp,60,'latest authoritative HP');
    const recovered=remote.find(p=>p.t===20);
    assert.equal(recovered.ships[0].hp,70,'recovery uses latest recorded authority state');
    assert.equal((recovered.combat_events||[]).length,0,'recovery does not reapply individual damage events');
    const totals=Object.fromEntries((recovered.combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(totals.atk,3,'three missed attack-side hits represented');
    assert.equal(totals.def,3,'three missed defence-side hits represented');
    assert.equal(new Set(remote.map(p=>p._continuity?.seq)).size,remote.length,'recovery sequence has no duplicates');
    assert.equal(viewer.packets.some(p=>p.packet.type==='cmd_result'&&p.packet.commandId==='private-1'),false,'private command result never leaks');
    // Run beyond the 128-frame visual ring to verify authenticated cumulative counts.
    proxy.down(); await until(async()=> (await viewer.call('status')).some(x=>x!=='ready'),'second viewer interruption');
    for (let i=1;i<=135;i++) await producer.call('frame',{battle:'71',frame:frame(25+i*5,Math.max(31,60-i*.2))});
    proxy.up(); await until(async()=> (await viewer.call('status')).every(x=>x==='ready'),'second viewer reconnect',1000);
    await until(()=>viewer.packets.some(p=>p.packet.type==='frame'&&p.packet.t===700),'recovery beyond ring limit',1000);
    const longRecovery=viewer.packets.find(p=>p.packet.type==='frame'&&p.packet.t===700).packet;
    const longTotals=Object.fromEntries((longRecovery.combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(longTotals.atk,135,'evicted-ring attack visual counts retained');
    assert.equal(longTotals.def,135,'evicted-ring defence visual counts retained');
    assert.equal(longRecovery.ships[0].hp,33,'evicted-ring latest HP retained');
    redis.kill('SIGTERM'); await new Promise(resolve=>redis.once('exit',resolve)); redis=null;
    await until(async()=> (await producer.call('status')).some(x=>x!=='ready') && (await viewer.call('status')).some(x=>x!=='ready'),'whole Redis stopped');
    await producer.call('frame',{battle:'71',frame:frame(705,30)}); await producer.call('frame',{battle:'71',frame:frame(710,20)});
    await producer.call('frame',{battle:'71',frame:frame(715,10)});
    await producer.call('end',{battle:'71',summary:{winner_side:'draw',duration_seconds:40}});
    redis=await startRedis(redisPort);
    await until(async()=> (await producer.call('status')).every(x=>x==='ready') && (await viewer.call('status')).every(x=>x==='ready'),'whole Redis restarted',1000);
    await until(()=>viewer.packets.some(p=>p.packet.type==='end'&&p.packet.winner_side==='draw'),'end replay after Redis outage',1000);
    const packets=viewer.packets.map(p=>p.packet), endIndex=packets.findIndex(p=>p.type==='end'&&p.winner_side==='draw');
    const recoveredEndIndex=packets.findIndex(p=>p.type==='frame'&&p.t===715);
    assert.ok(recoveredEndIndex >= 0 && recoveredEndIndex < endIndex,'latest recovered state arrives before battle end');
    const recoveredEnd=packets[recoveredEndIndex], endTotals=Object.fromEntries((recoveredEnd.combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(recoveredEnd.ships[0].hp,10,'latest HP recovered before battle end');
    assert.equal(endTotals.atk,3,'whole-Redis outage attack visuals recovered');
    assert.equal(endTotals.def,3,'whole-Redis outage defence visuals recovered');
    assert.equal(packets.filter(p=>p.type==='end').length,1,'end is delivered once');
    // Only producer publisher fails. Viewer's subscriber never disconnects, so
    // publisher reconnection must announce that recovery is available.
    await Promise.all([producer.call('open',{battle:'72',client:'local2',token:'owner'}),viewer.call('open',{battle:'72',client:'remote2',token:'other'})]);
    await sleep(100); await producer.call('frame',{battle:'72',frame:frame(5,100)});
    await until(()=>viewer.packets.some(p=>p.client==='remote2'&&p.packet.type==='frame'&&p.packet.t===5),'publisher-only case initial frame');
    producerPubProxy.down(); await until(async()=> (await producer.call('status'))[0]!=='ready','producer publisher isolated');
    assert.equal((await producer.call('status'))[1],'ready','producer subscriber stays connected');
    assert.ok((await viewer.call('status')).every(x=>x==='ready'),'viewer Redis stays connected');
    await producer.call('frame',{battle:'72',frame:frame(10,90)}); await producer.call('frame',{battle:'72',frame:frame(15,80)});
    await producer.call('end',{battle:'72',summary:{winner_side:'def',duration_seconds:15}}); await sleep(100);
    producerPubProxy.up(); await until(async()=> (await producer.call('status'))[0]==='ready','producer publisher reconnect',1000);
    await until(()=>viewer.packets.some(p=>p.client==='remote2'&&p.packet.type==='end'&&p.packet.winner_side==='def'),'publisher-only end recovered',1000);
    const publishOnly=viewer.packets.filter(p=>p.client==='remote2').map(p=>p.packet);
    const recoveredPublishIndex=publishOnly.findIndex(p=>p.type==='frame'&&p.t===15), publishEndIndex=publishOnly.findIndex(p=>p.type==='end');
    assert.ok(recoveredPublishIndex>=0&&recoveredPublishIndex<publishEndIndex,'publisher recovery frame before end');
    const publishTotals=Object.fromEntries((publishOnly[recoveredPublishIndex].combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(publishTotals.atk,2,'publisher outage attack visuals recovered');
    assert.equal(publishTotals.def,2,'publisher outage defence visuals recovered');
    assert.equal(publishOnly[recoveredPublishIndex].ships[0].hp,80,'publisher outage latest HP recovered');
    assert.equal(publishOnly.filter(p=>p.type==='end').length,1,'publisher outage end delivered once');
    // A received-but-unapplied frame is unacknowledged. Only genuinely sent,
    // proof-matching cursor ACKs may narrow a recovery range.
    await Promise.all([producer.call('open',{battle:'73',client:'local3',token:'owner'}),viewer.call('open',{battle:'73',client:'remote3',token:'other',ack:true})]);
    await sleep(100); await producer.call('frame',{battle:'73',frame:frame(5,100)});
    await until(()=>viewer.packets.some(p=>p.client==='remote3'&&p.packet.type==='frame'&&p.packet.t===5),'ack case initial frame'); await sleep(100);
    await viewer.call('ackHold',{client:'remote3',hold:true}); await producer.call('frame',{battle:'73',frame:frame(10,90)});
    await until(()=>viewer.packets.some(p=>p.client==='remote3'&&p.packet.type==='frame'&&p.packet.t===10),'unapplied frame delivered');
    const unacked=viewer.packets.find(p=>p.client==='remote3'&&p.packet.type==='frame'&&p.packet.t===10).packet._continuity;
    proxy.down(); await until(async()=> (await viewer.call('status')).some(x=>x!=='ready'),'ack case subscriber isolated');
    await producer.call('frame',{battle:'73',frame:frame(15,80)}); await producer.call('frame',{battle:'73',frame:frame(20,70)});
    await until(()=>producer.packets.some(p=>p.client==='local3'&&p.packet.type==='frame'&&p.packet.t===20),'unseen authentic cursor available');
    const unseen=producer.packets.find(p=>p.client==='local3'&&p.packet.type==='frame'&&p.packet.t===20).packet._continuity;
    await viewer.call('ackCursor',{client:'remote3',cursor:{...unacked,proof:'A'.repeat(43)}});
    await viewer.call('ackCursor',{client:'remote3',cursor:unseen});
    await viewer.call('ackCursor',{client:'remote3',cursor:{...unacked,seq:unacked.seq+500}});
    proxy.up(); await until(async()=> (await viewer.call('status')).every(x=>x==='ready'),'ack case subscriber restored',1000);
    await until(()=>viewer.packets.some(p=>p.client==='remote3'&&p.packet.type==='frame'&&p.packet.t===20),'ack case recovery',1000);
    const ackRecovery=viewer.packets.find(p=>p.client==='remote3'&&p.packet.type==='frame'&&p.packet.t===20).packet;
    const ackTotals=Object.fromEntries((ackRecovery.combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(ackTotals.atk,3,'invalid/future/unseen ACKs cannot discard unprocessed attack');
    assert.equal(ackTotals.def,3,'invalid/future/unseen ACKs cannot discard unprocessed defence');
    // A valid delayed ACK while sync is waiting rebases pending recovery.
    await Promise.all([producer.call('open',{battle:'74',client:'local4',token:'owner'}),viewer.call('open',{battle:'74',client:'remote4',token:'other',ack:true})]);
    await sleep(100); await producer.call('frame',{battle:'74',frame:frame(5,100)});
    await until(()=>viewer.packets.some(p=>p.client==='remote4'&&p.packet.type==='frame'&&p.packet.t===5),'rebase case initial frame'); await sleep(100);
    await viewer.call('ackHold',{client:'remote4',hold:true}); await producer.call('frame',{battle:'74',frame:frame(10,90)});
    await until(()=>viewer.packets.some(p=>p.client==='remote4'&&p.packet.type==='frame'&&p.packet.t===10),'rebase frame delivered');
    const delayedAck=viewer.packets.find(p=>p.client==='remote4'&&p.packet.type==='frame'&&p.packet.t===10).packet._continuity;
    proxy.down(); await until(async()=> (await viewer.call('status')).some(x=>x!=='ready'),'rebase subscriber isolated');
    await producer.call('frame',{battle:'74',frame:frame(15,80)}); await producer.call('frame',{battle:'74',frame:frame(20,70)});
    proxy.up(); await until(async()=> (await viewer.call('status')).every(x=>x==='ready'),'rebase subscriber restored',1000);
    await until(()=>producer.syncEvents.some(e=>e.battleId==='74'),'rebase response delayed',1000);
    await viewer.call('ackCursor',{client:'remote4',cursor:delayedAck});
    await until(()=>viewer.packets.some(p=>p.client==='remote4'&&p.packet.type==='frame'&&p.packet.t===20),'rebased recovery',1000);
    const rebased=viewer.packets.find(p=>p.client==='remote4'&&p.packet.type==='frame'&&p.packet.t===20).packet;
    const rebasedTotals=Object.fromEntries((rebased.combat_salvos||[]).map(s=>[s.source_side,s.count]));
    assert.equal(rebasedTotals.atk,2,'valid delayed ACK rebases attack recovery');
    assert.equal(rebasedTotals.def,2,'valid delayed ACK rebases defence recovery');
    console.log(JSON.stringify({result:'passed',scope:'two independent WS processes, actual local Redis, asymmetric proxy and whole Redis interruption; fixture auth/DB, no scheduler/leader',pids,localTicks:local.map(p=>p.t),remoteTicks:packets.filter(p=>p.type==='frame').map(p=>p.t),missedVisualCounts:totals,ringOverflowVisualCounts:longTotals,publisherOnlyVisualCounts:publishTotals,missedBeforeEndVisualCounts:endTotals,recoveredHp:recoveredEnd.ships[0].hp,endAfterRecoveredFrame:true,newFrameHeldUntilSync:true,unackedVisualCounts:ackTotals,rebasedVisualCounts:rebasedTotals,invalidFutureUnseenAckRejected:true,privateCommandLeak:false,productionTraffic:false}));
  } finally {
    for (const w of workers) { try { await w.call('quit'); } catch (_) {} w.child.kill('SIGTERM'); }
    if (proxy) await proxy.close(); if (producerPubProxy) await producerPubProxy.close();
    if (redis) { redis.kill('SIGTERM'); await new Promise(resolve=>redis.once('exit',resolve)); }
  }
}
if (process.argv.includes('--worker')) worker().catch(error=>{console.error(error.stack);process.exit(1);});
else main().catch(error=>{console.error(error.stack);process.exitCode=1;});
