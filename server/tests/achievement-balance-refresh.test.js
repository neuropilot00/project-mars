'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../assets/daily-engagement.js'),'utf8');
const actual=source.slice(source.indexOf('function loadAchievements()'),source.indexOf('function filterAchievements('));
async function run(data,reject=false){
 const elements={achievementsSection:{style:{}},achievementsGrid:{innerHTML:'existing achievements'}},calls=[];
 const c={document:{getElementById:id=>elements[id]},walletState:{address:'owned-test-account'},tl:s=>s,_engagementRead:()=>reject?Promise.reject(Error('network')):Promise.resolve(data),renderAchievementCards:()=>calls.push('render'),refreshEmailBalances:force=>calls.push({refresh:force})};
 vm.createContext(c);vm.runInContext(actual,c);c.loadAchievements();await new Promise(resolve=>setImmediate(resolve));return {calls,elements};
}
test('after eligibility evaluation, achievement UI refreshes the authoritative balance before a crafting decision',async()=>{const r=await run({achievements:[{key:'warrior',unlocked:true}]});assert.deepEqual(r.calls,['render',{refresh:true}]);});
test('a stale or unavailable achievement response cannot trigger a new balance or invented reward',async()=>{const r=await run(null);assert.deepEqual(r.calls,[]);assert.equal(r.elements.achievementsGrid.innerHTML,'existing achievements');});
test('failed achievement reads show failure and do not pretend a reward was applied',async()=>{const r=await run(null,true);assert.deepEqual(r.calls,[]);assert.ok(r.elements.achievementsGrid.innerHTML.includes('Failed to load'));});
