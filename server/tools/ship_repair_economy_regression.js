#!/usr/bin/env node
'use strict';
// Execute the real repair transaction in disposable tables on the local review clone.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact local review clone required');
if (process.env.NODE_ENV !== 'development' || process.env.RUN_SCHEDULERS !== 'false') throw Error('Development with schedulers disabled required');
const schema = 'ship_repair_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({connectionString:url.href});
const pool = new Pool({connectionString:url.href,options:'-c search_path='+schema+',public'});
const tables = ['users','ships','ship_types','fleets','fleet_battle_participants','fleet_battles','resources','user_resource_inventory'];
const wallet = '0x'+crypto.randomBytes(20).toString('hex');
const settings = {ship_repair_gp_per_hp:'0.03',ship_repair_iron_per_10hp:'0.2',ship_repair_cost_cap_pct_of_build:'60'};
function stub(path,exports) {const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};}
async function hull(type='mcc_frg',bonus=0) {
  return (await pool.query(`INSERT INTO ships(owner_wallet,ship_type_code,current_hp,max_hp,bonus_hp,quality)
    SELECT $1,code,base_hp,base_hp,$3,CASE WHEN $3>0 THEN 'legendary' ELSE 'common' END
    FROM ship_types WHERE code=$2 RETURNING *`,[wallet,type,bonus])).rows[0];
}
async function damage(ship,percent) {
  const hp=Math.floor((ship.max_hp+ship.bonus_hp)*(1-percent/100));
  await pool.query('UPDATE ships SET current_hp=$2 WHERE id=$1',[ship.id,hp]);
}
async function balances() {
  return (await pool.query(`SELECT u.gp_balance,
    (SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code='iron_ore') ore,
    (SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code='iron_dust') dust
    FROM users u WHERE wallet_address=$1`,[wallet])).rows[0];
}
async function main() {
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const cols=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
    for(const col of cols) {
      const sequence=`${schema}.${table}_${col.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE '+sequence);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} SET DEFAULT nextval('${sequence}')`);
    }
  }
  stub('../db',{pool,getSetting:async(k,f)=>settings[k]??f,logGPActivity:async()=>{}});
  stub('../routes/dailyOps',{notifyMissionProgress:async()=>{}});
  stub('../services/season',{addSeasonScore:async()=>{}});
  stub('../services/victorySlot',{feedPool:async()=>{}});
  const service=require('../services/ship');
  await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance) VALUES($1,'Repair QA','mcc',10000)",[wallet]);
  await pool.query('INSERT INTO ship_types SELECT * FROM public.ship_types WHERE is_active=true');
  await pool.query("INSERT INTO resources SELECT * FROM public.resources WHERE code IN ('iron_ore','iron_dust')");
  await pool.query('INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,10000 FROM resources',[wallet]);
  const common=await hull();
  for(const [percent,ore] of [[15,1],[50,2],[85,3]]) {
    await damage(common,percent);
    const quote=await service.getRepairQuote(wallet,common.id);
    const oldOre=Math.ceil(quote.healed/10*0.2);
    assert.equal(quote.iron_used,ore);assert.equal(quote.gp_cost,36);
    const before=await balances();
    const result=await service.repairShip(wallet.toUpperCase(),common.id);
    const after=await balances();
    assert.equal(result.iron_used,quote.iron_used);assert.equal(result.gp_cost,quote.gp_cost);
    assert.equal(result.healed,quote.healed);assert.equal(result.new_hp,32000);
    assert.equal(Number(before.gp_balance)-Number(after.gp_balance),36);
    assert.equal(before.ore-after.ore,ore);assert.equal(before.dust,after.dust);
    assert.equal((await pool.query('SELECT current_hp FROM ships WHERE id=$1',[common.id])).rows[0].current_hp,32000);
    console.log(`PASS ${percent}% damage: ${oldOre}→${ore} iron_ore, unchanged 36 GP; quote equals consumption/HP; iron_dust untouched`);
  }
  await damage(common,50);
  const partial=await service.getRepairQuote(wallet,common.id,75);
  assert.equal(partial.healed,8000);assert.equal(partial.iron_used,1);assert.equal(partial.gp_cost,36);
  assert.equal((await service.repairShip(wallet,common.id,75)).new_hp,24000);
  console.log('PASS partial 50%→75% repair: 160→1 iron_ore, unchanged 36 GP, exactly8000 HP restored');
  settings.ship_repair_max_pct='80';
  assert.equal((await service.getRepairQuote(wallet,common.id,150)).target_hp,25600);
  delete settings.ship_repair_max_pct;
  settings.ship_repair_cost_cap_pct_of_build='40';
  await damage(common,85);
  const capped=await service.getRepairQuote(wallet,common.id);
  assert.equal(capped.gp_cost,24);assert.equal(capped.iron_used,2);
  settings.ship_repair_cost_cap_pct_of_build='60';
  await pool.query('UPDATE ships SET current_hp=max_hp-1 WHERE id=$1',[common.id]);
  assert.equal((await service.getRepairQuote(wallet,common.id)).iron_used,1);
  console.log('PASS configured40% ceiling applies to GP/materials; target max clamp and one-unit minimum');
  const quality=await hull('mcc_frg',21600);
  await damage(quality,85);
  const boosted=await service.getRepairQuote(wallet,quality.id);
  assert.equal(boosted.max_hp,53600);assert.equal(boosted.iron_used,3);assert.equal(boosted.gp_cost,36);
  assert.equal((await service.repairShip(wallet,quality.id)).new_hp,53600);
  console.log(`PASS quality HP included: ${Math.ceil(boosted.healed/10*0.2)}→3 iron_ore at85% damage, full effective53600 HP restored`);
  for(const type of ['mcc_crs','mcc_ewar']) {
    const legacy=await hull(type);await damage(legacy,85);
    const quote=await service.getRepairQuote(wallet,legacy.id);
    const recipe=legacy.ship_type_code==='mcc_crs'?33:76;
    assert.equal(quote.iron_used,Math.ceil(recipe*0.6*quote.healed/(legacy.max_hp+legacy.bonus_hp)));
    const before=await balances();await service.repairShip(wallet,legacy.id);const after=await balances();
    assert.equal(before.ore-after.ore,quote.iron_used);assert.equal(before.dust,after.dust);
    assert.equal(Number(before.gp_balance)-Number(after.gp_balance),quote.gp_cost);
    console.log(`PASS ${type} non-ore blueprint maintenance budget: ${Math.ceil(quote.healed/10*0.2)}→${quote.iron_used} iron_ore, quote equals consumption, no iron_dust conversion`);
  }
  await damage(common,85);
  await pool.query("UPDATE user_resource_inventory SET quantity=0 WHERE wallet_address=$1 AND resource_id=(SELECT id FROM resources WHERE code='iron_ore')",[wallet]);
  const beforeFailure=await balances();
  await assert.rejects(service.repairShip(wallet,common.id),/INSUFFICIENT_IRON/);
  assert.deepEqual(await balances(),beforeFailure);
  assert.equal((await pool.query('SELECT current_hp FROM ships WHERE id=$1',[common.id])).rows[0].current_hp,4800);
  console.log('PASS iron_dust inventory cannot satisfy ordinary repair; insufficient ore rolls back GP/resources/HP');
  await pool.query("UPDATE user_resource_inventory SET quantity=3 WHERE wallet_address=$1 AND resource_id=(SELECT id FROM resources WHERE code='iron_ore')",[wallet]);
  const beforeRace=await balances();
  const concurrent=await Promise.allSettled([service.repairShip(wallet,common.id),service.repairShip(wallet,common.id)]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  assert.match(concurrent.find(r=>r.status==='rejected').reason.message,/ALREADY_FULL/);
  const afterRace=await balances();
  assert.equal(Number(beforeRace.gp_balance)-Number(afterRace.gp_balance),36);assert.equal(afterRace.ore,0);
  console.log('PASS concurrent same-hull repairs commit once:36 GP and3 ore, second request sees full HP');

  // Compare every active blueprint with the preserved GP contract at three damage levels.
  await pool.query('UPDATE users SET gp_balance=1000000000 WHERE wallet_address=$1',[wallet]);
  await pool.query('UPDATE user_resource_inventory SET quantity=1000000000 WHERE wallet_address=$1',[wallet]);
  const catalog=(await pool.query('SELECT code,base_hp,build_gp_cost,recipe_minerals FROM ship_types ORDER BY code')).rows;
  const largestRecipe=Math.max(...catalog.map(type=>Object.values(type.recipe_minerals||{}).reduce((sum,v)=>sum+Number(v),0)));
  console.log('CATALOG | Ship | Build GP | Recipe total | Ore budget | 15% GP/ore old→new | 50% GP/ore old→new | 85% GP/ore old→new |');
  for(const type of catalog) {
    const instance=await hull(type.code);
    const total=Object.values(type.recipe_minerals||{}).reduce((sum,v)=>sum+Number(v),0);
    const budget=Number(type.recipe_minerals?.iron_ore)||total||largestRecipe;
    const cells=[];
    for(const percent of [15,50,85]) {
      await damage(instance,percent);
      const quote=await service.getRepairQuote(wallet,instance.id);
      const oldOre=Math.ceil(quote.healed/10*0.2);
      const gp=Math.ceil(quote.healed*0.03);
      const oldGp=type.build_gp_cost>0?Math.min(gp,Math.floor(type.build_gp_cost*0.6)):gp;
      assert.equal(quote.gp_cost,oldGp);
      const expected=Math.min(oldOre,Math.max(1,Math.ceil(budget*0.6*quote.healed/quote.max_hp)));
      assert.equal(quote.iron_used,expected);
      const before=await balances();
      const repaired=await service.repairShip(wallet,instance.id);
      const after=await balances();
      assert.equal(Number(before.gp_balance)-Number(after.gp_balance),quote.gp_cost);
      assert.equal(before.ore-after.ore,quote.iron_used);assert.equal(before.dust,after.dust);
      assert.equal(repaired.new_hp,type.base_hp);
      cells.push(`${oldGp}/${oldOre}→${quote.gp_cost}/${quote.iron_used}`);
    }
    console.log(`CATALOG | ${type.code} | ${type.build_gp_cost} | ${total} | ${budget||'none'} | ${cells.join(' | ')} |`);
  }
  await pool.query('UPDATE ships SET current_hp=max_hp-10 WHERE id=$1',[common.id]);
  const minor=await service.getRepairQuote(wallet,common.id);assert.equal(minor.gp_cost,1);assert.equal(minor.iron_used,1);
  await pool.query('UPDATE ships SET current_hp=max_hp-100 WHERE id=$1',[common.id]);
  assert.equal((await service.getRepairQuote(wallet,common.id)).gp_cost,3);
  console.log(`PASS all ${catalog.length} active blueprints × three damage levels: exact real consumption and unchanged GP; tiny10/100HP repairs cost1/3GP`);
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{
  await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
});
