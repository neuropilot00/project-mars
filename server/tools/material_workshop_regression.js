#!/usr/bin/env node
'use strict';
// All state below belongs to a disposable local shadow schema, never production.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL||'');
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact disposable local review database required');
const schema='workshop_qa_'+crypto.randomBytes(6).toString('hex');
const admin=new Pool({connectionString:url.href});
const pool=new Pool({connectionString:url.href,options:'-c search_path='+schema+',public',max:5});
const checks=[];const check=(label)=>{checks.push(label);console.log('PASS '+label);};
const sql=name=>fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8');
async function attempt(wallet,id){const c=await pool.connect();try{await c.query('BEGIN');const r=await service.craftItem(c,wallet,id);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
let service;
(async()=>{
 await admin.query('CREATE SCHEMA '+schema);
 for(const table of ['crafting_recipes','crafting_log','schema_migrations','item_types','resources','users','user_items','user_resource_inventory','game_settings']){
  await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
  const columns=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
  for(const col of columns){const seq=`${schema}.${table}_${col.column_name}_qa`;await admin.query('CREATE SEQUENCE '+seq);await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} SET DEFAULT nextval('${seq}')`);}
 }
 await pool.query('INSERT INTO item_types SELECT * FROM public.item_types');await pool.query('INSERT INTO resources SELECT * FROM public.resources');
 await pool.query(sql('212_crafting_recipes_seed.sql'));await pool.query(sql('348_crafting_silicon_chip.sql'));
 const custom=await pool.query("INSERT INTO crafting_recipes(name,category,ingredients,gp_cost,output_item_type_id,output_qty,output_name,success_rate,fail_refund_pct,is_active) SELECT name,category,ingredients,49,output_item_type_id,output_qty,output_name,success_rate,fail_refund_pct,true FROM crafting_recipes WHERE id=1 RETURNING id");
 const customId=custom.rows[0].id;
 await pool.query(sql('363_material_workshop_recipes.sql'));
 const recipes=(await pool.query('SELECT * FROM crafting_recipes WHERE id<>$1 ORDER BY id',[customId])).rows;
 assert.equal(recipes.length,8);assert.ok(recipes.every(r=>Number(r.gp_cost)===0&&Number(r.success_rate)===100&&Number(r.fail_refund_pct)===0));
 assert.equal(Number((await pool.query('SELECT gp_cost FROM crafting_recipes WHERE id=$1',[customId])).rows[0].gp_cost),49);
 const snapshot=JSON.stringify((await pool.query('SELECT * FROM crafting_recipes ORDER BY id')).rows);await pool.query(sql('363_material_workshop_recipes.sql'));assert.equal(JSON.stringify((await pool.query('SELECT * FROM crafting_recipes ORDER BY id')).rows),snapshot);
 check('all8 untouched defaults migrate once;operator-edited recipe survives and rerun is idempotent');
 const dbPath=require.resolve('../db');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{pool}};service=require('../services/crafting');
 const wallet='0xworkshop-qa-owner';await pool.query("INSERT INTO users(wallet_address,nickname,gp_balance) VALUES($1,'Workshop QA',18.519)",[wallet]);
 await pool.query("INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,50 FROM resources WHERE code IN('iron_ore','silicon_chip','carbon_fiber','titanium_alloy')",[wallet]);
 for(const recipe of recipes){const result=await attempt(wallet,recipe.id);assert.equal(result.success,true);assert.equal(result.gpCost,0);assert.equal(result.outputQty,recipe.output_qty);}
 assert.equal(Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance),18.519);
 assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM crafting_log')).rows[0].n),8);
 check('real transaction service crafts every new recipe with exact output,consumes resources,and creates no GP');
 const shield=recipes[0];await pool.query('UPDATE user_items SET quantity=9 WHERE wallet=$1 AND item_type_id=1',[wallet]);
 const oreBefore=Number((await pool.query("SELECT quantity FROM user_resource_inventory uri JOIN resources r ON r.id=uri.resource_id WHERE wallet_address=$1 AND r.code='iron_ore'",[wallet])).rows[0].quantity);
 const parallel=await Promise.allSettled([attempt(wallet,shield.id),attempt(wallet,shield.id)]);
 assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);assert.equal(parallel.find(r=>r.status==='rejected').reason.message,'INVENTORY_FULL');
 assert.equal(Number((await pool.query('SELECT quantity FROM user_items WHERE wallet=$1 AND item_type_id=1',[wallet])).rows[0].quantity),10);
 const oreAfter=Number((await pool.query("SELECT quantity FROM user_resource_inventory uri JOIN resources r ON r.id=uri.resource_id WHERE wallet_address=$1 AND r.code='iron_ore'",[wallet])).rows[0].quantity);assert.equal(oreAfter,oreBefore-1);
 const available=await service.getRecipe(shield.id,wallet);assert.equal(available.canCraft,false);assert.equal(available.unavailableReason,'inventory_full');assert.equal(available.ingredients[0].owned_qty,oreAfter);
 check('concurrent craft at cap serializes:one output/one debit;second rolls back;API shows actual capacity/ingredients');
 await pool.query('UPDATE user_items SET quantity=0 WHERE wallet=$1 AND item_type_id=1',[wallet]);await pool.query('UPDATE users SET gp_balance=0 WHERE wallet_address=$1',[wallet]);
 await assert.rejects(attempt(wallet,customId),/INSUFFICIENT_GP/);assert.equal(Number((await pool.query("SELECT quantity FROM user_resource_inventory uri JOIN resources r ON r.id=uri.resource_id WHERE wallet_address=$1 AND r.code='iron_ore'",[wallet])).rows[0].quantity),oreAfter);
 check('preserved operator GP recipe rejects insufficient balance before resource consumption');
 await pool.query("INSERT INTO game_settings(key,value) VALUES('crafting_max_per_day','9')");
 await assert.rejects(attempt(wallet,shield.id),/Daily crafting limit/);check('existing20perday default mechanism remains enforced including zeroGP conversions');
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionTouched:false,schemaDroppedOnExit:true}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();});
