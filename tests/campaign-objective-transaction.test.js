'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../server/services/campaign.js'),'utf8');
function part(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
function fixture({missingArtTable=false}={}){
 const calls=[];let active=0,aborted=false,poolReads=0;
 const progress={quest_id:'qa',session_id:'session',status:'in_progress'};
 const client={release(){calls.push('release');},async query(sql){
  calls.push(sql);active++;assert.equal(active,1,'transaction queries must not overlap');await Promise.resolve();active--;
  if(sql.startsWith('ROLLBACK TO SAVEPOINT')){aborted=false;return{rows:[]};}
  if(aborted)throw Error('transaction aborted');
  if(sql.includes("COALESCE(image_url, '')")&&missingArtTable){aborted=true;throw Error('legacy art column unavailable');}
  if(sql.includes('COUNT(')||sql.includes('SUM('))return{rows:[{count:2}]};
  if(sql.includes('FROM player_campaign_progress'))return{rows:[progress]};
  return{rows:[]};
 }};
 const c={pool:{connect:async()=>client,query:async()=>{poolReads++;throw Error('no spare pooled connection');}},console:{warn(){}},
  ensureUser:async()=>{},ensureReputationRows:async()=>{},normalizeWallet:w=>w.toLowerCase(),
  CHAPTERS:{qa:{questId:'qa'}},publicChapter:(ch,p,state)=>state,formatProgress:p=>p,
  getChapterRuntimeSeconds:()=>0,getCampaignElapsedSeconds:()=>0,isInstantCampaignCompletion:()=>true,
  buildChapterObjectives:(ch,p,state)=>[{state:'pending',current:state.ownedClaims,target:3}],getMissingRequiredObjectives:o=>o,
 };
 vm.createContext(c);vm.runInContext(part('async function safeCampaignCount(','function objectivePresetForChapter(')+
  part('async function startChapter(','async function getCommittedChapterChoices(')+
  part('async function complete(','async function abandon('),c);
 return{c,client,calls,poolReads:()=>poolReads};
}
test('campaign objectives use the held connection instead of exhausting the pool',async()=>{
 const f=fixture(),s=await f.c.getObjectiveState('OWNER',f.client);
 assert.equal(s.ownedClaims,2);assert.equal(s.shipUpgrades,2);assert.equal(s.marketListings,4);assert.equal(f.poolReads(),0);
});
test('optional legacy objective lookup rolls back only its savepoint and preserves other counts',async()=>{
 const f=fixture({missingArtTable:true}),s=await f.c.getObjectiveState('owner',f.client);
 assert.equal(s.artClaims,0);assert.equal(s.ownedShips,2);assert.equal(s.territoryUpgradeLevels,2);
 assert.ok(f.calls.some(q=>q.startsWith('ROLLBACK TO SAVEPOINT')));assert.equal(f.poolReads(),0);
});
test('read-only objective lookup retains the existing unavailable-schema fallback',async()=>{
 const f=fixture(),s=await f.c.getObjectiveState('owner');assert.equal(s.ownedClaims,0);assert.equal(s.fleetShips,0);assert.ok(f.poolReads()>0);
});
test('campaign resume reads objectives before commit on the same account transaction',async()=>{
 const f=fixture(),r=await f.c.startChapter('owner','qa');assert.equal(r.chapter.ownedClaims,2);assert.equal(f.poolReads(),0);
 assert.ok(f.calls.findIndex(q=>q.includes('FROM claims'))<f.calls.indexOf('COMMIT'));assert.equal(f.calls.at(-1),'release');
});
test('campaign completion evaluates the real locked-account counts and releases its connection on rejection',async()=>{
 const f=fixture(),r=await f.c.complete('owner','session');assert.equal(r.error,'OBJECTIVE_REQUIREMENTS_NOT_MET');
 assert.equal(r.missingObjectives[0].current,2);assert.equal(f.poolReads(),0);assert.equal(f.calls.at(-2),'ROLLBACK');assert.equal(f.calls.at(-1),'release');
});
