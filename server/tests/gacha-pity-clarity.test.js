'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/shipyard-modal.js'),'utf8');
const renderer=source.slice(source.indexOf('function _perfectGachaBoxHtml('),source.indexOf('function _bindPerfectGachaBoxCard('));
const languages=['en','ko','ja','zh','id','vi','th'];
function render(lang='en',data={},loading=false){
 const calls=[];const index=languages.indexOf(lang);
 const c={LANG:lang,formatNum:value=>String(value),tl:(...args)=>{calls.push(args);return args[index]||args[0];}};
 vm.createContext(c);vm.runInContext(renderer,c);
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
