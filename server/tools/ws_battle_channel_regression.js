// Functional regression on a private ephemeral localhost server; no DB access.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const repo = path.resolve(__dirname, '../..');
process.env.REDIS_URL = ''; // This private test process must not contact Redis.
const WebSocket = require(path.join(repo,'server/node_modules/ws'));
const svc = require(path.join(repo,'server/wsServer'));
const live = require(path.join(repo,'server/services/liveBattle'));
const server = http.createServer();
const wss = svc.attachWsServer(server);
const clients=[];
const results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(id) {
  const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/battle/${id}`);
  const messages=[];
  ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  clients.push(ws);
  await pause(20);
  return {ws,messages};
}
async function expectRejected(id) {
  const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/battle/${id}`);
  const result=await new Promise(resolve=>{
    ws.once('open',()=>resolve(false));ws.once('error',()=>resolve(true));
    setTimeout(()=>{ws.terminate();resolve(false);},400).unref();
  });
  ws.terminate();
  assert.equal(result,true);
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const small=await connect('00077');
  assert.equal(small.messages[0].battleId,'77');
  svc.broadcastBattleFrame('77',{t:5,fleets:[]});
  svc.broadcastBattleFrame(77,{t:10,fleets:[]});
  svc.broadcastBattleEnd(77,{winner_side:'atk'});
  await pause(30);
  assert.deepEqual(small.messages.filter(m=>m.type==='frame').map(m=>m.t),[5,10]);
  assert.equal(small.messages.find(m=>m.type==='end').battleId,'77');
  results.push({check:'string/number frame and end share canonical URL channel',passed:true});
  const bigId='9007199254740993';
  const neighbor=await connect('9007199254740992');
  const big=await connect(bigId);
  svc.broadcastBattleFrame(bigId,{t:15,fleets:[]});
  svc.broadcastBattleEnd(BigInt(bigId),{winner_side:'def'});
  svc.broadcastBattleFrame(Number(bigId),{t:20,fleets:[]}); // already rounded: reject
  await pause(30);
  assert.equal(big.messages[0].battleId,bigId);
  assert.deepEqual(big.messages.filter(m=>m.type==='frame').map(m=>m.t),[15]);
  assert.equal(big.messages.find(m=>m.type==='end').battleId,bigId);
  assert.equal(neighbor.messages.filter(m=>m.type==='frame'||m.type==='end').length,0);
  results.push({check:'BIGINT above safe Number preserved; unsafe numeric id rejected without neighbor leakage',passed:true});
  const max=await connect('9223372036854775807');
  svc.broadcastBattleFrame('9223372036854775807',{t:25,fleets:[]});
  await pause(20);
  assert.equal(max.messages.find(m=>m.type==='frame').t,25);
  await expectRejected('9223372036854775808');
  await expectRejected('0');
  results.push({check:'PostgreSQL positive BIGINT upper bound enforced for websocket URL',passed:true});
  live.markActive(bigId);
  assert.equal(svc.routeBattleCommand(BigInt(bigId),{wallet:'test-wallet',fleetId:'123',action:'formation',params:{formation:'screen'}}),true);
  assert.equal(live.drainCommands(bigId).length,1);
  assert.equal(svc.routeBattleCommand(Number(bigId),{wallet:'test-wallet'}),false);
  live.clearActive(bigId);
  results.push({check:'command routing uses canonical id and rejects unsafe number',passed:true});
  for(const c of clients)c.close();
  await pause(30);
  assert.deepEqual(svc.channelStats(),{_live:0});
  results.push({check:'close removes canonical channel keys',passed:true});
  console.log(JSON.stringify({result:'passed',checks:results}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
  for(const c of clients)c.terminate();
  await new Promise(r=>wss.close(r));
  await new Promise(r=>server.close(r));
});
