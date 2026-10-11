#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function loader(ready=false){
 const elements={},timeouts=[],intervals=new Map(),cleared=[],opened=[];let reloads=0,seq=0;
 function el(tag){return {tag,style:{},children:[],events:{},setAttribute(k,v){this[k]=v;},appendChild(child){this.children.push(child);if(child.id)elements[child.id]=child;},addEventListener(k,f){this.events[k]=f;},remove(){delete elements[this.id];}};}
 elements.loadOverlay=el('div');elements.loadMsg=el('div');
 const context={window:{_globeReady:ready,openCommandCenter:t=>opened.push(t)},document:{getElementById:id=>elements[id],createElement:el,body:el('body')},
 location:{reload:()=>reloads++},getComputedStyle:()=>({display:'flex'}),setTimeout:(f,ms)=>timeouts.push({f,ms}),_clearActiveInterval:id=>{intervals.delete(id);cleared.push(id);},_setActiveInterval:f=>{intervals.set(++seq,f);return seq;},_loadPct:20,_loadQuoteTimer:99};
 vm.createContext(context);const source=fs.readFileSync(path.join(root,'assets/core-runtime.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function setLoadProgress(')),context);
 return {context,elements,intervals,opened,cleared,timeouts,get reloads(){return reloads;},timeout(){timeouts.find(t=>t.ms===8000).f();}};
}
let h=loader();h.timeout();let n=h.elements.mapRecoveryNotice;assert.ok(n);assert.equal(n.role,'alert');assert.ok(n.children[0].textContent.includes('unavailable'));assert.equal(n.children.length,3);assert.equal(h.elements.loadOverlay.style.pointerEvents,'none');
n.children[2].events.click();assert.equal(h.reloads,1);h.context._showMapRecovery();assert.equal(h.intervals.size,1,'duplicate notice must not add timers');
h.context.window._globeReady=true;for(const f of h.intervals.values())f();assert.ok(!h.elements.mapRecoveryNotice);assert.equal(h.intervals.size,0,'late success cleans notice and timer');
h=loader();h.timeout();h.elements.mapRecoveryNotice.children[1].events.click();assert.deepEqual(h.opened,['front']);assert.ok(!h.elements.mapRecoveryNotice);assert.equal(h.intervals.size,0);
h=loader(true);h.timeout();assert.ok(!h.elements.mapRecoveryNotice);assert.equal(h.intervals.size,0,'healthy map receives no recovery UI');
const campaign=fs.readFileSync(path.join(root,'assets/campaign-system.js'),'utf8');
let audioCalls=0;const voice={Object,_campaignBgmEnabled:()=>true,_sfx:{volume:.2},Audio:function(){audioCalls++;this.play=()=>Promise.resolve();}};
vm.createContext(voice);vm.runInContext(campaign.slice(campaign.indexOf('var _campaignQuestId=null;'),campaign.indexOf('function renderCampaignScene()')),voice);
voice._campaignQuestId='qa';voice._campaignPlayVoice({id:'s01',type:'dialogue'},0);assert.equal(audioCalls,0);assert.equal(voice._campaignVoiceFile({id:'s01'},0),null);
voice._campaignVoiceAvailableFiles['qa_s01_l0.mp3']=true;voice._campaignPlayVoice({id:'s01',type:'dialogue'},0);assert.equal(audioCalls,1);assert.equal(voice._campaignVoiceFile({id:'s01'},0),'/assets/audio/voice/qa_s01_l0.mp3');
console.log('PASS loader: failed map has retry and command navigation, overlay released, duplicate guarded, late success cleanup, healthy map unaffected; voice only plays explicitly shipped assets');
