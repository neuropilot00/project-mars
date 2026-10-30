'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(check,{redis=false,declareAction,battleStatus='active'}={}){
  let server,upgrades=0;
  const redisClients=[],published=[],dbQueries=[];
  class Redis { constructor(){this.events={};redisClients.push(this);} on(name,fn){this.events[name]=fn;} subscribe(channel,done){done(null);} publish(channel,raw){published.push(JSON.parse(raw));redisClients[1].events.message(channel,raw);return Promise.resolve();} }
  class Socket { constructor(){this.events={};this.readyState=1;this.closed=null;this.sent=[];this.bufferedAmount=0;} on(name,fn){this.events[name]=fn;} send(raw){this.sent.push(JSON.parse(raw));} close(...args){this.closed=args;this.readyState=3;} }
  class WebSocketServer { constructor(){server=this;this.events={};this.connections=[];} on(name,fn){this.events[name]=fn;} emit(name,...args){return this.events[name](...args);} handleUpgrade(req,socket,head,done){upgrades++;const ws=new Socket();this.connections.push(ws);done(ws);} }
  const context={module:{exports:{}},process:{env:redis?{REDIS_URL:'fixture-no-network'}:{}},console:{log(){},warn(){},error(){}},setInterval:()=>({unref(){}}),clearInterval(){},setTimeout,clearTimeout,Buffer,require(name){
    if(name==='crypto')return{randomUUID:()=> 'public-fixture-command-id'};
    if(name==='ws')return{WebSocketServer};if(name==='url')return require('node:url');
    if(name==='./services/battleVisualJournal')return require('../services/battleVisualJournal');
    if(name==='./utils/totpSessionBoundary')return{validateToken:check};
    if(name==='./db')return{pool:{query:async(sql,args)=>{dbQueries.push({sql,args});return{rows:[{status:battleStatus}]};}}};
    if(name==='ioredis'&&redis)return Redis;
    if(name==='./services/liveBattle'&&declareAction)return{isActive:()=>false};
    if(name==='./services/commanderActions'&&declareAction)return{declareAction};
    throw new Error('Unexpected socket fixture dependency '+name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wsServer.js'),'utf8'),context);
  const http={events:{},on(name,fn){this.events[name]=fn;}};context.module.exports.attachWsServer(http);
  function request(token='fixture',battleId='1'){return{url:'/ws/battle/'+battleId+'?token='+token,headers:{},socket:{remoteAddress:'127.0.0.1'}};}
  function transport(){return{destroyed:false,written:'',once(){},write(value){this.written+=value;},destroy(){this.destroyed=true;}};}
  return{http,request,transport,api:context.module.exports,published,dbQueries,get server(){return server;},get upgrades(){return upgrades;}};
}
test('actual socket handler rejects revoked TOTP reconnection and commands after recovery',async()=>{
  let current=true;
  const f=fixture(async()=>current?{wallet:'0x'+'1'.repeat(40),totp:true,revoked:false}:{wallet:null,totp:true,revoked:true});
  const transport=f.transport();await f.http.events.upgrade(f.request(),transport,Buffer.alloc(0));assert.equal(f.upgrades,1);
  current=false;const ws=f.server.connections[0];await ws.events.message(JSON.stringify({type:'cmd',cmd:'formation'}));
  assert.deepEqual(ws.closed,[1008,'session_expired']);
  const reconnect=f.transport();await f.http.events.upgrade(f.request(),reconnect,Buffer.alloc(0));assert.equal(f.upgrades,1);assert.equal(reconnect.destroyed,true);assert.match(reconnect.written,/401/);
  assert.equal(f.dbQueries.length,1,'revoked reconnection never queries battle state');
});
test('a socket closed during asynchronous validation is never upgraded',async()=>{
  let resolveCheck;
  const f=fixture(()=>new Promise(resolve=>{resolveCheck=resolve;}));const transport=f.transport();
  const pending=f.http.events.upgrade(f.request(),transport,Buffer.alloc(0));transport.destroy();resolveCheck({wallet:'0x'+'1'.repeat(40),totp:true,revoked:false});await pending;
  assert.equal(f.upgrades,0);
});
test('legacy spectator connection remains available without new authentication state',async()=>{
  const f=fixture(async()=>({wallet:null,totp:false,revoked:false}));await f.http.events.upgrade(f.request(),f.transport(),Buffer.alloc(0));
  assert.equal(f.upgrades,1);assert.equal(f.server.connections[0].wallet,null);assert.equal(f.server.connections[0].totpToken,null);
});

const owner='0x'+'1'.repeat(40),otherWallet='0x'+'2'.repeat(40);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('an authorized reconnect sees a cancelled battle without exposing session data',async()=>{
  const f=fixture(async()=>({wallet:owner,totp:true,revoked:false}),{battleStatus:'cancelled'});
  await f.http.events.upgrade(f.request('fixture','71'),f.transport(),Buffer.alloc(0));await flush();
  assert.equal(f.dbQueries.length,1);assert.equal(f.dbQueries[0].args[0],'71');
  const message=f.server.connections[0].sent.find(m=>m.type==='queue');
  assert.deepEqual(message,{type:'queue',battleId:'71',reason:'battle_cancelled'});
  assert.equal('wallet' in message,false);assert.equal('token' in message,false);
});
for(const redis of [false,true]){
  test('idle revoked TOTP socket cannot receive wallet command results via '+(redis?'Redis fanout':'local delivery'),async()=>{
    let revoked=false,checks=0;
    const battleId='9223372036854775807';
    const f=fixture(async token=>{
      checks++;
      if(token==='spectator')return{wallet:null,totp:false,revoked:false};
      if(token==='legacy')return{wallet:owner,totp:false,revoked:false};
      if(token==='other')return{wallet:otherWallet,totp:true,revoked:false};
      return token==='old'&&revoked?{wallet:null,totp:true,revoked:true}:{wallet:owner,totp:true,revoked:false};
    },{redis});
    for(const token of ['old','replacement','other','spectator','legacy']){
      await f.http.events.upgrade(f.request(token,battleId),f.transport(),Buffer.alloc(0));
    }
    const [old,replacement,other,spectator,legacy]=f.server.connections;
    await f.http.events.upgrade(f.request('replacement','9223372036854775806'),f.transport(),Buffer.alloc(0));
    const neighbor=f.server.connections[5];
    const result={wallet:owner.toUpperCase(),commandId:'idle-fixture',cmd:'formation',fleetId:'11',tick:null,status:'rejected',reason:'battle_ended'};
    f.api.broadcastBattleCommandResult(battleId,result);await flush();
    assert.equal(old.sent.filter(m=>m.type==='cmd_result').length,1);
    old.sent=[];replacement.sent=[];legacy.sent=[];revoked=true;
    const before=checks;
    f.api.broadcastBattleCommandResult(battleId,result);await flush();
    assert.deepEqual(old.closed,[1008,'session_expired']);
    assert.equal(old.sent.length,0);
    assert.equal(checks-before,2,'only matching TOTP recipients are rechecked');
    for(const ws of [replacement,legacy]){
      assert.equal(ws.sent.length,1);assert.equal(ws.sent[0].type,'cmd_result');
      assert.equal(ws.sent[0].battleId,battleId);assert.equal(ws.sent[0].commandId,result.commandId);
      assert.equal('wallet' in ws.sent[0],false);
    }
    assert.equal(other.sent.filter(m=>m.type==='cmd_result').length,0);
    assert.equal(spectator.sent.filter(m=>m.type==='cmd_result').length,0);
    assert.deepEqual(neighbor.sent.map(m=>m.type),['hello']);
    f.api.broadcastBattleFrame(battleId,{tick:7});f.api.broadcastBattleEnd(battleId,{winner_side:'a'});
    assert.deepEqual(spectator.sent.map(m=>m.type),['hello','frame','end']);
    assert.equal(spectator.closed,null);
    if(redis)assert.equal(f.published.filter(m=>m.kind==='battleCmdResult').length,2);
  });
}

for(const failure of ['expired','different-wallet','unavailable']){
  test('wallet result delivery fails closed when TOTP validation is '+failure,async()=>{
    let connected=false;
    const f=fixture(async()=>{
      if(!connected)return{wallet:owner,totp:true,revoked:false};
      if(failure==='unavailable')throw new Error('fixture unavailable');
      return{wallet:failure==='expired'?null:otherWallet,totp:true,revoked:false};
    });
    await f.http.events.upgrade(f.request(),f.transport(),Buffer.alloc(0));connected=true;
    const ws=f.server.connections[0];
    f.api.broadcastBattleCommandResult('1',{wallet:owner,commandId:'must-not-leak'});await flush();
    assert.deepEqual(ws.closed,[1008,'session_expired']);
    assert.deepEqual(ws.sent.map(m=>m.type),['hello']);
  });
}

test('socket closed during result validation is never sent a late result',async()=>{
  let connected=false,resolveCheck;
  const f=fixture(()=>connected?new Promise(resolve=>{resolveCheck=resolve;}):Promise.resolve({wallet:owner,totp:true,revoked:false}));
  await f.http.events.upgrade(f.request(),f.transport(),Buffer.alloc(0));connected=true;
  const ws=f.server.connections[0];
  f.api.broadcastBattleCommandResult('1',{wallet:owner,commandId:'late-fixture'});
  ws.close(1000,'fixture closed');
  assert.equal(typeof resolveCheck,'function');
  resolveCheck({wallet:owner,totp:true,revoked:false});await flush();
  assert.deepEqual(ws.sent.map(m=>m.type),['hello']);
});

test('current session command acknowledgements preserve command id and declared status',async()=>{
  const calls=[];
  const f=fixture(async()=>({wallet:owner,totp:true,revoked:false}),{
    declareAction:async(...args)=>{calls.push(args);return{fixture:'declared'};}
  });
  await f.http.events.upgrade(f.request('fixture','9223372036854775807'),f.transport(),Buffer.alloc(0));
  const ws=f.server.connections[0];
  await ws.events.message(JSON.stringify({type:'cmd',cmd:'formation',commandId:'stable-ack-id',payload:{formation:'wedge'}}));await flush();
  assert.equal(calls.length,1);assert.equal(calls[0][0],'9223372036854775807');
  assert.equal(calls[0][1],owner);assert.equal(calls[0][2],'formation_change');
  const ack=ws.sent.find(m=>m.type==='cmd_ok');
  assert.equal(ack.commandId,'stable-ack-id');assert.equal(ack.status,'declared');assert.equal(ack.live,false);
  assert.equal(ws.closed,null);
});
