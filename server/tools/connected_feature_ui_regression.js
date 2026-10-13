#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = name => fs.readFileSync(path.resolve(__dirname, '../../', name), 'utf8');
function commandHarness() {
  let token='player-a'; const calls=[];
  const body={innerHTML:''},status={textContent:'',classList:{toggle(){}}},root={hidden:false};
  const window={walletState:{gameGP:0}};
  const missions={currentMissionId:'restore_fleet',starterFleet:{fleetId:7},missions:[{id:'restore_fleet',status:'active',objectives:[{key:'fleet_ready',current:0,target:1}]}]};
  const frontier={mode:'solo_training',ownerKey:'wallet:player-a',nodes:[{id:1,node_type:'resource',owner_key:'wallet:player-a',name:'Ares',stored_batches:0,production_at:new Date().toISOString()}],stocks:[],cargo:[],battles:[],raidTargets:[]};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const context={window,document,localStorage:{getItem:()=>token},getAuthHeaders:()=>({Authorization:'Bearer '+token}),console,LANG:'en',fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=> url.endsWith('/fleets')?{fleets:[{id:7,name:'starter',ships_alive:3,total_hp:300,total_max_hp:300}]}:url.endsWith('/state')&&!url.includes('frontier')?missions:url.endsWith('frontier-state')?frontier:{success:true,ready:true,completed:true}};}};
  let source=read('assets/command-center.js');
  source=source.replace('window.openCommandCenter=open;', 'window.__connected={state:state,renderFront:renderFront,action:action,setRoot:function(r,b,s){root=r;body=b;status=s;}};window.openCommandCenter=open;');
  vm.createContext(context);vm.runInContext(source,context);
  window.__connected.setRoot(root,body,status);
  Object.assign(window.__connected.state,{tab:'front',training:true,missions,frontier,fleets:[{id:7,name:'starter',ships_alive:3,total_hp:300,total_max_hp:300}],fleetId:'7'});
  return {window,calls,missions,body,set token(value){token=value;}};
}
async function main(){
  const h=commandHarness(),control=h.window.__connected;
  const html=control.renderFront();assert.ok(html.includes('data-cc="inspect-fleet"'),'Full-HP fleet still has a readiness action');assert.ok(html.includes('Inspect fleet readiness'));
  await control.action('inspect-fleet');const request=h.calls.find(r=>r.url==='/api/starter-ops/restore_fleet/action');assert.ok(request);assert.equal(request.options.headers.Authorization,'Bearer player-a');assert.deepEqual(JSON.parse(request.options.body),{action:'inspect_fleet'});assert.ok(!('sourceId' in JSON.parse(request.options.body)));assert.ok(!h.calls.some(r=>r.url.endsWith('/repair')),'Readiness inspection never spends repair materials');
  h.missions.missions[0].status='claimed';assert.ok(!control.renderFront().includes('data-cc="inspect-fleet"'),'Readiness action belongs only to the active restore operation');
  const badgeElements={};for(const id of ['recordsDot','questsDot','mobBaseDot'])badgeElements[id]={style:{display:'none'}};
  const context={window:{},document:{getElementById:id=>badgeElements[id],querySelectorAll:()=>[],querySelector:()=>null},localStorage:{getItem:()=>null,setItem(){}},_setActiveTimeout(){},_setActiveInterval(){},getComputedStyle:el=>el.style,_sectorsData:[],getAuthHeaders:()=>({Authorization:'Bearer badge-user'}),console,loadNotifCount(){},_dailyState:{todayClaimed:true,missions:[]},_guardedJsonFetch:async(key)=>key==='dot-quests'?{quests:[{status:'completed'}]}:null};
  context.window=context;vm.createContext(context);vm.runInContext(read('assets/base-navigation.js'),context);context._shouldRunBaseDotPoll=()=>true;
  context._pollBaseTabDots(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(badgeElements.recordsDot.style.display,'block');assert.equal(badgeElements.questsDot.style.display,'none','Completed quests must not light Campaign');
  const daily=read('assets/daily-engagement.js');vm.runInContext(daily.slice(daily.indexOf('function updateDailyHudDot(){'),daily.indexOf('function openDailyPanel(){')),context);
  context._dailyDotReady=true;context._dailyState={todayClaimed:false,missions:[]};context.updateDailyHudDot();assert.equal(badgeElements.recordsDot.style.display,'block');assert.equal(badgeElements.questsDot.style.display,'none');assert.equal(badgeElements.mobBaseDot.style.display,'block');
  context._dailyState.todayClaimed=true;context.updateDailyHudDot();assert.equal(badgeElements.recordsDot.style.display,'block','Daily refresh must preserve another completed quest');
  const guild=read('assets/guild-ops.js');const guildCalls=[];
  const guildContext={openCommandCenter:tab=>guildCalls.push(tab),openBattleHub:()=>guildCalls.push('battle-hub'),switchBaseTab:tab=>guildCalls.push(tab)};
  vm.createContext(guildContext);vm.runInContext(guild.slice(guild.indexOf('function _guildGotoFirstBattle(){'),guild.indexOf('// Start/stop chat poll')),guildContext);guildContext._guildGotoFirstBattle();assert.deepEqual(guildCalls,['front'],'Guild welcome goes directly to actual shared industry');
  const documentHtml=read('index.html');assert.match(documentHtml, /id="baseTabRecords"[^>]*onclick="switchBaseTab\('records',this\)"[\s\S]*?id="recordsDot"/);assert.ok(read('assets/quest-economy.js').includes("setBaseTabDot('records', true)"));
  console.log('PASS connected feature UI: full-HP restore inspection uses authenticated server verification without cost or client evidence; only active restore renders CTA; quest/check-in badges target Records and reach painted Base badge without lighting Campaign.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
