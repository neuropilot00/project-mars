'use strict';
// Both frontier suites use real service SQL in isolated tables and sequences.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL||'');
if(url.hostname!=='localhost'||url.username!=='jongho'||url.port!=='5432'||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact local review clone required');
if(process.env.NODE_ENV!=='development'||process.env.RUN_SCHEDULERS!=='false')throw Error('Development with schedulers disabled required');
const schema='frontier_qa_'+crypto.randomBytes(6).toString('hex');
const admin=new Pool({connectionString:url.href});
const pool=new Pool({connectionString:url.href,options:'-c search_path='+schema+',public -c timezone=Asia/Seoul',application_name:schema,max:20});
const dbId=require.resolve('../db');
require.cache[dbId]={id:dbId,filename:dbId,loaded:true,exports:{pool,getSetting:async(k,f)=>{
 const row=(await pool.query('SELECT value FROM settings WHERE key=$1',[k])).rows[0];return row?.value??f;
}}};
async function setup(){
 await admin.query('CREATE SCHEMA '+schema);
 const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 for(const {tablename:table} of tables){
  await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  const cols=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
  for(const {column_name:col} of cols){const sequence=`${schema}.${table}_${col}_qa_seq`;await admin.query('CREATE SEQUENCE '+sequence);await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col} SET DEFAULT nextval('${sequence}')`);}
 }
 // Read-only configuration/catalogues only; no users, holdings or public-node copies.
 for(const table of ['settings','factions','sectors','ship_types','resources'])await pool.query(`INSERT INTO ${table} SELECT * FROM public.${table}`);
 // Exercise the new SQL in this isolated schema, including when public is still at339.
 const c=await pool.connect();try{await c.query('BEGIN');await c.query(fs.readFileSync(path.join(__dirname,'../migrations/351_frontier_storage_logistics.sql'),'utf8'));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function close(){await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
module.exports={pool,setup,close,schema};
