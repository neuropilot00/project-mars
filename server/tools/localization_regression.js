#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const sea=require('../../tools/sea-i18n');
function context(document={}){
  const c={window:{walletState:{gameGP:200}},localStorage:{getItem:key=>key==='pw_lang'?'en':'test-player'},document,console};
  vm.createContext(c);vm.runInContext(read('assets/i18n.js'),c);c.TL_SEA=undefined;
  vm.runInContext(read('assets/i18n-sea.js'),c);c.TL_SEA=c.window.TL_SEA;
  return c;
}
function dictionaryChecks(){
  const c=context(),langs=['en','ko','ja','zh','id','vi','th'];
  const literal="'((?:[^'\\\\]|\\\\.)*)'";
  let pairs=0;
  for(const [file,fn,reverse]of [['assets/command-center.js','L|copy',true],['assets/core-navigation.js','label|operationButton',false],['assets/ship-card-workshop.js','text',false]]){
    const pattern=new RegExp('\\b(?:'+fn+')\\(\\s*'+literal+'\\s*,\\s*'+literal,'g');
    for(const match of read(file).matchAll(pattern)){
      const values=[match[1],match[2]].map(value=>vm.runInNewContext("'"+value+"'"));
      const en=values[reverse?1:0],ko=values[reverse?0:1];
      assert.ok(c.GAME_UI_TEXT[en],file+' untranslated literal: '+en);
      for(const [index,lang]of langs.entries()){
        c.LANG=lang;
        assert.equal(c.gameUiText(en,ko),index<2?values[reverse?1-index:index]:c.GAME_UI_TEXT[en][index-2],lang+': '+en);
      }
      pairs++;
    }
  }
  for(const [en,row]of Object.entries(c.GAME_UI_TEXT)){
    assert.equal(row.length,5,en);
    for(const value of row){assert.ok(typeof value==='string'&&value.length>0,en);assert.notEqual(value,en,'untranslated explicit UI row: '+en);assert.deepEqual(sea.tokens(value),sea.tokens(en),en);assert.deepEqual(sea.htmlTags(value),sea.htmlTags(en),en);}
  }
  for(const lang of langs){
    c.LANG=lang;assert.equal(c.gameLocale(),{en:'en-US',ko:'ko-KR',ja:'ja-JP',zh:'zh-CN',id:'id-ID',vi:'vi-VN',th:'th-TH'}[lang]);
    assert.notEqual(c.t('sov_map_btn'),'SOV MAP');assert.ok(!c.t('terr_upgrade_modal_title').includes('DEPOT UPGRADE'));
  }
  for(const [alias,expected]of [['in','id'],['vn','vi'],['thai','th'],['unavailable','en']])assert.equal(c.normalizeLang(alias),expected);
  assert.equal(c.gameUiRelocalize('Unknown server detail','en'),'Unknown server detail');
  const audit=sea.audit(sea.collectTargets(),sea.loadExisting());
  assert.equal(audit.missing.length,0);assert.equal(audit.leaks.length,0);assert.equal(audit.tokenFailures.length,0);
  assert.ok(audit.items.some(item=>item.t==='tl'&&item.en==="TODAY'S OPS"),'Double-quoted literals must be collected');
  assert.ok(audit.items.some(item=>item.t==='key'&&item.k==='sov_map_btn'&&item.en==='Sovereignty map'),'Static targets must use runtime dictionary overrides');
  assert.ok(audit.items.some(item=>item.t==='key'&&item.k==='land_claimers_24h'),'Static key names containing digits must be collected');
  for(const target of audit.items){if(target.t!=='tl')continue;for(const lang of ['id','vi','th']){c.LANG=lang;assert.equal(c.tl(target.en),audit.ex.TL_SEA[target.k][lang],lang+': '+target.en);}}
  return {pairs,rows:Object.keys(c.GAME_UI_TEXT).length,targets:audit.items.length};
}
function gateChecks(){
  const en='<b>Count {n}</b>',valid={TL_SEA:{[en]:{id:'<b>{n}</b> hasil',vi:'<b>{n}</b> kết quả',th:'<b>{n}</b> ผล'}},id:{},vi:{},th:{}};
  const items=[{t:'tl',k:en,en}];
  const check=(translations,expected)=>{
    const script='require('+JSON.stringify(path.join(ROOT,'tools/sea-i18n.js'))+').check('+JSON.stringify(items)+','+JSON.stringify(translations)+')';
    const result=spawnSync(process.execPath,['-e',script],{encoding:'utf8'});assert.equal(result.status,expected,result.stdout+result.stderr);
  };
  check(valid,0);check({TL_SEA:{},id:{},vi:{},th:{}},1);
  assert.equal(sea.audit([{t:'key',k:'unknown_label',en:'unknown_label',missingEnglish:true}],{TL_SEA:{},id:{unknown_label:'translated'},vi:{unknown_label:'translated'},th:{unknown_label:'translated'}}).missing.length,1,'An absent English source key must not disappear from coverage');
  for(const value of [en,'<b>1</b> hasil','<i>{n}</i> hasil','<b class="changed">{n}</b> hasil']){const invalid=structuredClone(valid);invalid.TL_SEA[en].id=value;check(invalid,1);}
  const currency=sea.audit([{t:'tl',k:' GP!',en:' GP!'},{t:'tl',k:'💫 VIP',en:'💫 VIP'}],{TL_SEA:{' GP!':{id:' GP!',vi:' GP!',th:' GP!'},'💫 VIP':{id:'💫 VIP',vi:'💫 VIP',th:'💫 VIP'}},id:{},vi:{},th:{}});
  assert.equal(currency.leaks.length,0);
}
function commandRefreshChecks(){
  let fields=[],focused='',html='';
  const body={scrollTop:81,contains:el=>fields.includes(el),querySelectorAll:selector=>selector==='input,select,textarea'?fields:[]};
  Object.defineProperty(body,'innerHTML',{get:()=>html,set:value=>{html=value;fields=[['ccFleetSelect','7'],['ccCargoResource','iron_dust'],['ccCargoAmount','20']].map(([id,value])=>({id,value,focus(){focused=id;}}));}});
  const heading={},control={setAttribute(){}},status={textContent:'',classList:{toggle(){}}};
  const root={hidden:false,querySelector:selector=>selector==='h2'?heading:control};
  let chatCollapsed=true;
  const chat={classList:{contains:()=>chatCollapsed}},chatButton={attrs:{},setAttribute(key,value){this.attrs[key]=value;}};
  const document={readyState:'loading',addEventListener(){},querySelectorAll:()=>[],getElementById:id=>id==='chatOverlay'?chat:id==='chatToggleBtn'?chatButton:fields.find(el=>el.id===id)};
  const c=context(document);
  let source=read('assets/command-center.js').replace('window.openCommandCenter=open;', 'window.__locale={state:state,setBody:setBody,renderFront:renderFront,roots:function(r,b,s){root=r;body=b;status=s;}};window.openCommandCenter=open;');
  vm.runInContext(source,c);const h=c.window.__locale;h.roots(root,body,status);
  Object.assign(h.state,{tab:'front',fleetId:'7',training:false,missions:{missions:[]},frontierScope:'personal',frontier:{scope:'personal',mode:'personal_front',ownerKey:'test',availableScopes:['personal','guild'],cargoCapacity:200,balance:{batchCap:16,batchMinutes:30},nodes:[{id:1,node_type:'resource',owner_key:'test',name:'Ares',stored_batches:3,production_at:'2026-10-13T00:00:00Z'}],stocks:[{depot:'repair',resource_code:'hull_plate',quantity:200}],cargo:[],battles:[],raidTargets:[]},fleets:[{id:7,name:'Starter',ships_alive:3}]});
  c.gameUiText('Saved on the server.','서버에 저장했습니다.');
  for(const lang of ['en','ko','ja','zh','id','vi','th']){
    const from=c.LANG;h.setBody(h.renderFront);fields.find(el=>el.id==='ccCargoResource').value='hull_plate';fields.find(el=>el.id==='ccCargoAmount').value='137';document.activeElement=fields.find(el=>el.id==='ccCargoAmount');
    status.textContent=c.gameUiText('Saved on the server.','서버에 저장했습니다.');c.LANG=lang;c.window.refreshCommandCenterLocale();
    assert.equal(fields.find(el=>el.id==='ccCargoResource').value,'hull_plate');assert.equal(fields.find(el=>el.id==='ccCargoAmount').value,'137');assert.equal(focused,'ccCargoAmount');assert.equal(body.scrollTop,81);assert.equal(h.state.fleetId,'7');assert.equal(h.state.frontierScope,'personal');
    assert.equal(status.textContent,c.gameUiText('Saved on the server.','서버에 저장했습니다.'),from+' → '+lang);
    assert.equal(chatButton.attrs['aria-label'],c.gameUiText('Open communications','통신 열기'));
    assert.ok(html.includes('16')&&html.includes('8')&&html.includes('200'));assert.ok(!/\{(?:batches|hours|capacity|amount)\}/.test(html));
    if(lang!=='en')assert.ok(!html.includes('Choose front')&&!html.includes('Cargo material')&&!html.includes('Take 100 for crafting'));
  }
  h.state.busy=true;const before=html;c.LANG='en';c.window.refreshCommandCenterLocale();assert.equal(html,before,'Language switch must not rebuild an in-flight action');
  h.roots(null,body,status);chatCollapsed=false;
  for(const lang of ['en','ko','ja','zh','id','vi','th']){c.LANG=lang;c.window.refreshCommandCenterLocale();assert.equal(chatButton.attrs['aria-label'],c.gameUiText('Close communications','통신 닫기'),'Chat labels update even before command panel initialization');}
}
function staticRuntimeChecks(){
  const keys=['land_claimers_24h','referral_desc','fleet_command_heading','fleet_cmd_subtitle','fleet_cmd_new','fleet_cmd_select','fcmd_my_fleets_short'];
  const elements=keys.map(key=>({getAttribute:()=>key,textContent:'',innerHTML:''}));
  const document={documentElement:{},querySelectorAll:selector=>selector==='[data-i18n]'?elements:[],getElementById:()=>null,querySelector:()=>null};
  const c=context(document),main=read('assets/main-game.js');
  vm.runInContext(main.slice(main.indexOf('function applyI18n(){'),main.indexOf('var _tutStep =')),c);
  for(const lang of ['en','ko','ja','zh','id','vi','th']){c.LANG=lang;c.applyI18n();for(const [index,key]of keys.entries()){const value=c.t(key);assert.equal(value.includes('<')?elements[index].innerHTML:elements[index].textContent,value);if(lang!=='en')assert.notEqual(value,c.I18N.en[key],lang+' static fallback: '+key);}}
  const html=read('index.html');assert.match(html,/<div[^>]+data-i18n="referral_desc">\s*Share your code/);assert.match(html,/<div class="fleet-list-title"><span data-i18n="fcmd_my_fleets_short">[^<]*<\/span> \(<span id="fleetCountLabel">/,'Localizing the fleet heading must preserve its live counter sibling');
  const fleet=read('assets/fleet-command-modal.js');assert.ok(fleet.includes("subtitle.textContent = t('fleet_cmd_subtitle')")&&fleet.includes("newBtn.textContent = t('fleet_cmd_new')")&&fleet.includes("hint.textContent = t('fleet_cmd_select')"),'Opening legacy fleet command must retain SEA static translations');
}
const counts=dictionaryChecks();gateChecks();commandRefreshChecks();staticRuntimeChecks();
console.log('PASS localization: '+counts.targets+' SEA targets; '+counts.rows+' explicit UI rows; '+counts.pairs+' literal call sites across 7 languages; runtime SEA fallback/aliases/placeholders; checker rejects missing sources/translations/leaks/HTML/placeholder errors; command refresh preserves scope/fleet/cargo input/focus/scroll/status and busy view; seven-language static land/referral/fleet copy and collapsed/expanded chat aria labels.');
