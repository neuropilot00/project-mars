'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../assets/campaign-system.js'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../server/services/campaign.js'),'utf8');
function part(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));}
test('rare resource campaign awards use the real resource inventory and exact declared quantity',async()=>{
 const calls=[],client={async query(sql,args){calls.push({sql,args});return {rows:sql.startsWith('SELECT id FROM resources')?[{id:19}]:[]};}};
 const c={};vm.createContext(c);vm.runInContext(part(source,'async function applyClaimedInboxReward(','function campaignShipRewardPlan('),c);
 const r=await c.applyClaimedInboxReward(client,'owner',{reward_type:'rare_resource',reward_code:'ancient_metal',quantity:280,payload:{}});
 assert.equal(r.applied[0].kind,'resource');assert.equal(r.applied[0].quantity,280);assert.ok(calls.some(x=>/INSERT INTO user_resource_inventory/.test(x.sql)&&x.args[2]===280));assert.equal(r.record,undefined);
});
test('unknown narrative items return an explicit permanent story record without promising missing systems',async()=>{
 const calls=[],client={async query(sql){calls.push(sql);return{rows:[]};}};
 const c={};vm.createContext(c);vm.runInContext(part(source,'async function applyClaimedInboxReward(','function campaignShipRewardPlan('),c);
 const r=await c.applyClaimedInboxReward(client,'owner',{reward_type:'ship_choice',reward_code:'unknown_option',quantity:1,payload:{label:'Story choice'}});
 assert.equal(r.applied.length,0);assert.equal(r.record.effect,'story_record');assert.equal(r.record.code,'unknown_option');assert.doesNotMatch(r.note,/future|will be|정기.*배송|추후/i);assert.equal(calls.some(x=>/INSERT|UPDATE/.test(x)),false);
});
test('recent receipts distinguish delivered, narrative and legacy outcomes and escape chapter labels',()=>{
 const node={innerHTML:''},c={LANG:'en',document:{getElementById:()=>node},tl:(en)=>en,escapeHtmlSafe:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
 vm.createContext(c);vm.runInContext(part(ui,'function campaignRewardLabel(','async function claimCampaignReward('),c);
 c.renderCampaignRewardInbox([{id:1,reward_type:'rare_resource',reward_code:'iron_ore',quantity:2}], [
  {id:2,reward_code:'mcc_int',quantity:1,payload:{receipt:{applied:[{kind:'ship'}]}}},
  {id:3,reward_code:'<script>bad</script>',quantity:1,payload:{receipt:{applied:[],record:{effect:'story_record'}}}},
  {id:4,reward_code:'legacy',quantity:1,payload:{}}
 ]);
 assert.match(node.innerHTML,/data-campaign-claim="1"/);assert.doesNotMatch(node.innerHTML,/onclick=|<script>/);assert.match(node.innerHTML,/&lt;script&gt;/);assert.match(node.innerHTML,/data-core-route="fleet"/);assert.match(node.innerHTML,/no item or automatic bonus/);assert.match(node.innerHTML,/detailed effect unavailable/);assert.doesNotMatch(node.innerHTML,/<details[^>]+open/);
});
