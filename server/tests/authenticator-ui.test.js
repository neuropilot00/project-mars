'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../assets/authenticator.js'),'utf8');
const fixedSecret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const enrollment={enrollmentId:'a'.repeat(64),enrollmentSecret:'b'.repeat(64),secret:fixedSecret,otpauthUri:'otpauth://totp/OCCUPY%20MARS%3Afixture?secret='+fixedSecret,expiresIn:300};
const recoveryCodes=['AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA','BBBB-BBBB-BBBB-BBBB-BBBB-BBBB-BBBB-BBBB'];
const session={token:'fixture.session.not-real',user:{wallet:'0x'+'1'.repeat(40)}};
function fixture({enabled=true,handlers={},storageFails=false,configHandler=null}={}) {
  const elements=new Map(),calls=[],stored=[],visits=[],events={},timeouts=new Map(),intervals=new Map(); let id=0,now=100000;
  function el(name){if(!elements.has(name))elements.set(name,{id:name,value:'',hidden:false,disabled:false,checked:false,textContent:'',dataset:{},listeners:{},width:0,height:0,addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},focus(){},select(){},getContext(){return{fillRect(){},fillStyle:''};}});return elements.get(name);}
  const tabs=['login','signup','recover'].map(mode=>({...el('tab-'+mode),dataset:{mode}}));
  const document={readyState:'complete',documentElement:{lang:'en'},getElementById:el,querySelectorAll:selector=>selector==='[data-mode]'?tabs:[],createElement:()=>({click(){}})};
  const window={location:{search:'?lang=en',assign:value=>visits.push(value)},qrcode:()=>({addData(uri){assert.match(uri,/^otpauth:\/\/totp\//);},make(){},getModuleCount:()=>21,isDark:()=>true}),addEventListener:(name,fn)=>{events[name]=fn;},setTimeout:(fn,delay)=>{timeouts.set(++id,{fn,delay});return id;},clearTimeout:key=>timeouts.delete(key),setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:key=>intervals.delete(key)};
  const context={window,document,navigator:{language:'en'},URLSearchParams,AbortController,Blob,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},Date:class extends Date{static now(){return now;}},localStorage:{setItem:(...args)=>{if(storageFails)throw new Error('storage denied');stored.push(args);}},fetch:async(url,options={})=>{
    calls.push({url,options});
    if(url==='/api/auth/totp/config')return configHandler ? configHandler() : {ok:true,json:async()=>({enabled})};
    const endpoint=url.replace('/api/auth/totp/','');
    assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');
    const data=JSON.parse(options.body);
    const result=handlers[endpoint]?await handlers[endpoint](data):{status:200,data:enrollment};
    return{ok:result.status<400,status:result.status,json:async()=>result.data};
  },console:{log:()=>assert.fail('authentication value logged'),error:()=>assert.fail('authentication value logged')}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets/authenticator-copy.js'),'utf8'),context);
  vm.runInNewContext(source,context);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return{el,calls,stored,visits,events,tabs,settle,async mode(name){tabs.find(tab=>tab.dataset.mode===name).listeners.click();await settle();},async submit(form){await el(form).listeners.submit({preventDefault(){}});await settle();},expire(){now+=301000;for(const fn of intervals.values())fn();},async timeout(){for(const [key,item] of [...timeouts])if(item.delay===10000){timeouts.delete(key);item.fn();}await settle();}};
}
test('disabled feature leaves account creation hidden and existing login intact',async()=>{
  const f=fixture({enabled:false});await f.settle();
  assert.equal(f.el('authenticatorForm').hidden,true);assert.equal(f.el('authenticatorTabs').hidden,true);
  assert.match(f.el('authenticatorStatus').textContent,/not enabled/);assert.equal(f.calls.length,1);assert.deepEqual(f.stored,[]);
});
test('signup proves first code, shows recovery once, then requires saved-code confirmation before session',async()=>{
  const f=fixture({handlers:{'enroll/verify':()=>({status:200,data:{recoveryCodes,confirmationNonce:'fixture-confirm'}}),'enroll/activate':body=>{assert.equal(body.recoveryCode,recoveryCodes[0]);return{status:200,data:session};}}});
  await f.settle();await f.mode('signup');f.el('totpUsername').value='fixture';f.el('totpTos').checked=true;
  await f.submit('authenticatorForm');assert.equal(f.el('totpSetupKey').value,fixedSecret);assert.equal(f.el('enrollmentPanel').hidden,false);assert.deepEqual(f.stored,[]);
  f.el('totpFirstCode').value='287082';await f.submit('enrollmentVerifyForm');assert.equal(f.el('recoveryPanel').hidden,false);assert.equal(f.el('totpSetupKey').value,'');
  await f.submit('enrollmentActivateForm');assert.equal(f.calls.filter(call=>call.url.endsWith('/activate')).length,0);
  f.el('recoverySaved').checked=true;f.el('recoveryConfirmCode').value=recoveryCodes[0];await f.submit('enrollmentActivateForm');
  assert.deepEqual(f.stored,[['pw_token',session.token]]);assert.deepEqual(f.visits,['/']);assert.equal(f.el('recoveryCodes').value,'');
  for(const call of f.calls)assert.ok(!call.url.includes(fixedSecret)&&!call.url.includes(enrollment.enrollmentSecret));
});
test('recovery enrolls a replacement without issuing a session before proof',async()=>{
  const f=fixture();await f.settle();await f.mode('recover');f.el('totpUsername').value='fixture';f.el('totpRecoveryLoginCode').value=recoveryCodes[1];await f.submit('authenticatorForm');
  assert.ok(f.calls.some(call=>call.url.endsWith('/recover')));assert.equal(f.el('enrollmentPanel').hidden,false);assert.equal(f.el('totpRecoveryLoginCode').value,'');assert.deepEqual(f.stored,[]);
});
test('expiry and navigation clear setup secrets and displayed recovery codes',async()=>{
  const f=fixture();await f.settle();await f.mode('signup');f.el('totpUsername').value='fixture';f.el('totpTos').checked=true;await f.submit('authenticatorForm');
  f.expire();assert.equal(f.el('totpSetupKey').value,'');assert.equal(f.el('enrollmentPanel').hidden,true);assert.match(f.el('authenticatorStatus').textContent,/expired/);
  f.el('recoveryCodes').value=recoveryCodes.join('\n');f.events.pagehide();assert.equal(f.el('recoveryCodes').value,'');assert.deepEqual(f.stored,[]);
});
test('restart clears enrollment and re-enables every account action tab',async()=>{
  const f=fixture();await f.settle();await f.mode('signup');f.el('totpUsername').value='fixture';f.el('totpTos').checked=true;await f.submit('authenticatorForm');
  assert.ok(f.tabs.every(tab=>tab.disabled));
  f.el('totpRestart').listeners.click();
  assert.equal(f.el('totpSetupKey').value,'');assert.equal(f.el('enrollmentPanel').hidden,true);assert.ok(f.tabs.every(tab=>!tab.disabled));
  await f.mode('recover');assert.equal(f.el('recoveryLoginGroup').hidden,false);assert.equal(f.el('totpSubmit').textContent,'Lost phone');
});
test('invalid login and rate limit show generic errors without storing credentials',async()=>{
  for(const code of [401,429]){
    const f=fixture({handlers:{login:()=>({status:code,data:{error:'private backend account result'}})}});await f.settle();f.el('totpUsername').value='fixture';f.el('totpLoginCode').value='000000';await f.submit('authenticatorForm');
    assert.ok(!f.el('authenticatorStatus').textContent.includes('private backend'));assert.deepEqual(f.stored,[]);assert.equal(f.el('totpSubmit').disabled,false);
  }
});
test('stalled submit times out and permits a deliberate retry; no late secret is persisted',async()=>{
  const f=fixture({handlers:{login:()=>new Promise(()=>{})}});await f.settle();f.el('totpUsername').value='fixture';f.el('totpLoginCode').value='000000';
  const pending=f.submit('authenticatorForm');await f.settle();assert.equal(f.el('totpSubmit').disabled,true);await f.timeout();await pending;
  assert.equal(f.el('totpSubmit').disabled,false);assert.deepEqual(f.stored,[]);
});
test('QR uses a vendored local encoder and no external or inline secret URL',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../authenticator.html'),'utf8');
  assert.match(html,/src="\/assets\/lib\/qrcode-generator\.js"/);assert.doesNotMatch(html,/(?:src|href)="https?:/);
  assert.doesNotMatch(source,/console\.|localStorage\.setItem\('(?!pw_token)/);
  const qrcode=require('../../assets/lib/qrcode-generator.js');const qr=qrcode(0,'M');qr.addData(enrollment.otpauthUri,'Byte');qr.make();
  assert.ok(qr.getModuleCount()>21);assert.equal(typeof qr.isDark(0,0),'boolean');
});

test('storage failure keeps login reachable after credentials are cleared',async()=>{
  const f=fixture({storageFails:true,handlers:{login:()=>({status:200,data:session})}});await f.settle();
  f.el('totpUsername').value='fixture';f.el('totpLoginCode').value='287082';await f.submit('authenticatorForm');
  assert.equal(f.el('authenticatorForm').hidden,false);assert.match(f.el('authenticatorStatus').textContent,/could not save/);assert.deepEqual(f.visits,[]);
});
test('pagehide discards an enrollment response that arrives after leaving',async()=>{
  let finish;const f=fixture({handlers:{'enroll/start':()=>new Promise(resolve=>{finish=resolve;})}});await f.settle();await f.mode('signup');f.el('totpTos').checked=true;
  const pending=f.submit('authenticatorForm');await f.settle();f.events.pagehide();finish({status:200,data:enrollment});await pending;
  assert.equal(f.el('totpSetupKey').value,'');assert.equal(f.el('enrollmentPanel').hidden,true);assert.deepEqual(f.stored,[]);
});
test('availability timeout exposes retry without enabling enrollment',async()=>{
  const f=fixture({configHandler:()=>new Promise(()=>{})});await f.settle();await f.timeout();await f.settle();
  assert.equal(f.el('authenticatorForm').hidden,true);assert.equal(f.el('authAvailabilityRetry').hidden,false);assert.match(f.el('authenticatorStatus').textContent,/unavailable/);
});
test('all seven authenticator locales cover every English message',()=>{
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets/authenticator-copy.js'),'utf8'),sandbox);
  const text=sandbox.window.MARS_AUTH_COPY,keys=Object.keys(text.en).sort();
  for(const lang of ['en','ko','ja','zh','id','vi','th']){assert.deepEqual(Object.keys(text[lang]).sort(),keys,lang);for(const key of keys)assert.ok(text[lang][key].trim(),lang+':'+key);}
});
test('BFCache return clears enrollment and restores a usable login after availability check',async()=>{
  const f=fixture();await f.settle();await f.mode('signup');f.el('totpTos').checked=true;
  await f.submit('authenticatorForm');assert.equal(f.el('authenticatorForm').hidden,true);
  f.events.pagehide();f.events.pageshow({persisted:true});await f.settle();
  assert.equal(f.el('authenticatorForm').hidden,false);assert.equal(f.el('loginCodeGroup').hidden,false);
  assert.ok(f.tabs.every(tab=>!tab.disabled));assert.equal(f.el('totpSetupKey').value,'');
  assert.equal(f.el('recoveryCodes').value,'');assert.equal(f.el('enrollmentPanel').hidden,true);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/config')).length,2);
});
