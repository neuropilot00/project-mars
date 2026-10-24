'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/shipyard-modal.js'),'utf8');
const renderer=source.slice(source.indexOf('function _perfectGachaBoxHtml('),source.indexOf('function _bindPerfectGachaBoxCard('));
const oddsRenderer=source.slice(source.indexOf('function _assemblyOddsHtml('),source.indexOf('function _asmRenderUnitModal('));
const languages=['en','ko','ja','zh','id','vi','th'];
function render(lang='en',data={},loading=false){
 const calls=[];const index=languages.indexOf(lang);
 const c={LANG:lang,formatNum:value=>String(value),escapeHtmlSafe:value=>String(value).replaceAll('<','&lt;'),_asmName:p=>p.name_en,_cratePercent:n=>Number(n).toFixed(2)+'%',_qLabel:q=>q,tl:(...args)=>{calls.push(args);return args[index]||args[0];}};
 vm.createContext(c);vm.runInContext(oddsRenderer+'\n'+renderer,c);
 return{html:c._perfectGachaBoxHtml(Object.freeze({enabled:true,price_gp:700,pity_remaining:7,pool_size:48,...data}),loading),calls};
}
test('actual perfect-part renderer places conditional one-part and separate assembly disclosures before purchase controls',()=>{
 const{html}=render();assert.match(html,/Pity in 7 pulls · Pool 48/);
 assert.match(html,/Pity grants 1 random unowned part if any remain, not a complete unit/);assert.match(html,/A new part resets the counter/);
 assert.match(html,/every required part for that unit and its separately listed GP cost/);
 assert.ok(html.indexOf('data-gacha-pity-rule')<html.indexOf('data-action="gacha-box-pull"'));
 assert.ok(html.indexOf('data-gacha-assembly-rule')<html.indexOf('data-action="gacha-box-pull"'));
 assert.match(html,/assets\/banners\/crate_perfect_assembly\.png/);
 assert.match(html,/data-count="1"[^>]*>1회 · 700GP/);assert.match(html,/data-count="10"[^>]*>10연차 · 7000GP/);
 assert.equal((html.match(/data-action="gacha-box-pull"/g)||[]).length,2);
});
for(const lang of languages)test('actual renderer has explicit guarantee and assembly copy in '+lang,()=>{
 const{html,calls}=render(lang);const rules=calls.filter(args=>/^(Pity grants 1 random unowned part|Assembly still needs every required part)/.test(args[0]));
 assert.equal(rules.length,2);for(const args of rules){assert.equal(args.length,7);assert.ok(args.every(text=>typeof text==='string'&&text.length>10));assert.ok(html.includes(args[languages.indexOf(lang)]));if(lang!=='en')assert.notEqual(args[languages.indexOf(lang)],args[0]);}
});
test('loading and login/error states retain their existing disabled pull behavior',()=>{
 for(const[options,loading,label]of[[{},true,'Loading…'],[{enabled:false,error:'LOGIN_REQUIRED'},false,'Login required'],[{enabled:false,error:'NETWORK'},false,'Unavailable']]){
  const{html}=render('en',options,loading);assert.ok(html.includes(label));assert.equal((html.match(/data-count="(?:1|10)" disabled/g)||[]).length,2);assert.ok(html.includes('data-gacha-pity-rule'));
 }
});
test('a refreshed pity counter uses the new server number without promising a complete unit or changing GP totals',()=>{
 const before=render('en',{pity_remaining:2}).html,after=render('en',{pity_remaining:50}).html;
 assert.ok(before.includes('Pity in 2 pulls'));assert.ok(after.includes('Pity in 50 pulls'));
 for(const html of[before,after]){assert.ok(html.includes('not a complete unit'));assert.ok(html.includes('10연차 · 7000GP'));}
});
for(const lang of languages)test('next-draw disclosure renders real part odds and retained duplicates in '+lang,()=>{
 const{html,calls}=render(lang,{disclosure:{dup_shard_yield:15,duplicate_pct:40,outcomes:[{part_code:'a',name_en:'<part>',probability_pct:20}]}});
 assert.ok(html.includes('data-assembly-odds'));assert.ok(html.includes('20.00%'));assert.ok(html.includes('40.00%'));assert.ok(html.includes('&lt;part>'));
 assert.ok(html.indexOf('data-assembly-odds')<html.indexOf('data-action="gacha-box-pull"'));
 for(const args of calls.filter(a=>/^(Next-draw|Duplicates keep|Duplicate chance|The next draw)/.test(a[0]))){assert.equal(args.length,7);assert.ok(html.includes(args[languages.indexOf(lang)]));}
});
const handler=source.slice(source.indexOf('async function _onPerfectGachaBoxClick('),source.indexOf('async function _refreshPerfectGachaBoxCard('));
for(const scenario of ['cancel','owner-change','price-change'])test('actual box handler protects purchase on '+scenario,async()=>{
 let owner='qa-owner';const posts=[],videos=[],prompts=[];
 const button={disabled:false,textContent:'10 pulls',isConnected:true,getAttribute:()=> '10'};
 const c={console:{log(){}},document:{getElementById:()=>({})},_asmBoxBusy:false,getMyWallet:()=>owner,getAuthHeaders:()=>({}),
  fetch:async()=>({ok:true,json:async()=>({enabled:true,price_gp:700,disclosure:{outcomes:[]}})}),formatNum:String,tl:(...a)=>a[0],_assemblyOddsHtml:()=>'<details>odds</details>',
  _asmConfirm:async p=>{prompts.push(p);if(scenario==='owner-change')owner='different-owner';return scenario!=='cancel';},
  _asmPost:async(...args)=>{posts.push(args);return {error:'PRICE_CHANGED'};},_playBoxOpenVideo:async()=>videos.push('video'),showFactionToast(){},_asmErr:()=>'',_refreshPerfectGachaBoxCard:async()=>{},_asmRefreshAfterBoxPull:async()=>{}};
 vm.createContext(c);vm.runInContext(handler,c);await c._onPerfectGachaBoxClick({target:{closest:()=>button},preventDefault(){},stopPropagation(){}});
 assert.equal(prompts.length,1);assert.ok(prompts[0].body.includes('7000 GP'));assert.ok(prompts[0].body.includes('not a complete unit'));
 assert.equal(posts.length,scenario==='price-change'?1:0);assert.equal(videos.length,0);assert.equal(c._asmBoxBusy,false);assert.equal(button.disabled,false);
 if(posts.length){assert.equal(posts[0][2].count,10);assert.equal(posts[0][2].expected_price_gp,700);}
});
