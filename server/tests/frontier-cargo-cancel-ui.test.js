'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),runner=fs.readFileSync(path.join(root,'server/tools/command_center_regression.js'),'utf8'),moduleFixture={exports:{}};
vm.runInNewContext(runner.slice(0,runner.indexOf('async function main()'))+'\nmodule.exports=harness;',{module:moduleFixture,require,__dirname:path.join(root,'server/tools'),URL,console,setImmediate});
function fixture(overrides={}){
  const f=moduleFixture.exports();let clock=Date.now();f.context.Date=class extends Date{static now(){return clock;}};
  f.window.walletState={address:'newcomer'};
  f.cargo=[{id:12,fleet_id:41,wallet:'newcomer',status:'moving',resource_code:'iron_dust',amount:20,started_at:new Date(clock-1000).toISOString(),arrives_at:new Date(clock+599000).toISOString(),...overrides}];
  return {f,advance:value=>{clock+=value;}};
}

test('only owned moving cargo within the first minute and without an escort battle offers cancellation',async()=>{
  const cases=[
    [{wallet:'guildmate'},/Only the cargo owner/],
    [{raid_battle_id:81},/Escort battle started/],
    [{started_at:new Date(Date.now()-120000).toISOString()},/after the first minute/],
    [{started_at:null},/Refresh to verify/]
  ];
  for(const [overrides,reason] of cases){const {f}=fixture(overrides);await f.open('front');
    assert.match(f.body.innerHTML,/<button disabled aria-disabled="true"[^>]*data-cc="cancel-cargo"/);
    assert.match(f.body.innerHTML,reason);await f.click('cancel-cargo',12);
    assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  }
  const {f}=fixture();await f.open('front');await f.click('cancel-cargo',12);
  assert.equal(f.calls.find(c=>c.method==='POST').url,'/api/frontier/cargo/12/cancel');
});

test('exactly sixty seconds is eligible, but a stale allowed button rechecks time before sending any POST',async()=>{
  const {f,advance}=fixture();advance(59000);await f.open('front');
  assert.doesNotMatch(f.body.innerHTML,/<button disabled[^>]*data-cc="cancel-cargo"/);
  advance(1);await f.click('cancel-cargo',12);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.match(f.status.textContent,/after the first minute/);
});

test('a server race closing the window shows the specific policy explanation rather than a generic failure',async()=>{
  const {f}=fixture();f.router=c=>c.method==='POST'?f.response({error:'CARGO_CANCEL_WINDOW_CLOSED'},false):null;
  await f.open('front');await f.click('cancel-cargo',12);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.match(f.status.textContent,/more than one minute has passed or an escort battle has started/);
  assert.doesNotMatch(f.status.textContent,/Could not complete the request/);
});
