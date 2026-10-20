'use strict';
// Loopback-only fixture: real UI + actual marketplace source in a VM with an
// allowlisted dummy DB. Never loads app/db/env/auth or external resources.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const assetFiles = ['assets/main.css','assets/core-navigation.css','assets/game-icons.css','assets/item-art.css','assets/item-art.js','assets/game-dialogs.js','assets/market-transport.js','assets/i18n.js','assets/i18n-sea.js','assets/items/item-art-a.webp'];
const requests = [];
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); }
function dialog() {
  const s = source('index.html'), hit = s.indexOf('id="gameConfirm"'), start = s.lastIndexOf('<div', hit);
  const re = /<\/?div\b[^>]*>/g; re.lastIndex = start; let depth = 0;
  for (let m; (m = re.exec(s));) { depth += m[0].startsWith('</') ? -1 : 1; if (!depth) return s.slice(start, re.lastIndex); }
  throw Error('Missing confirmation markup');
}
function market() {
  const writes = [];
  const settings = { marketplace_listing_fee_gp:'5', marketplace_dynamic_fee_5:'2', marketplace_dynamic_fee_10:'4', marketplace_fee_pct:'5' };
  const pool = { query: async (sql, args = []) => {
    if (/COUNT\(\*\) AS cnt FROM marketplace_listings/.test(sql)) return {rows:[{cnt:0}]};
    if (/SELECT gp_balance FROM users/.test(sql)) return {rows:[{gp_balance:100}]};
    if (/SELECT sector_id FROM pixels/.test(sql)) return {rows:[]};
    if (/listing_count/.test(sql)) return {rows:[{listing_count:2,min_unit_price:'0.6'}]};
    if (/SELECT \* FROM resources/.test(sql)) return {rows:[{name_en:'Iron ore',icon_emoji:'ore',rarity:'common'}]};
    if (/SELECT inv.quantity/.test(sql)) return {rows:[{quantity:10}]};
    if (/^(UPDATE|INSERT)/.test(sql.trim())) {
      writes.push({sql,args});
      if (/INSERT INTO marketplace_listings/.test(sql)) return {rows:[{id:1,price:args[4],currency:args[5],resource_quantity:args[10]}],rowCount:1};
      return {rows:[],rowCount:1};
    }
    throw Error('Unsupported dummy SQL');
  }};
  const module = {exports:{}};
  const context = {module,exports:module.exports,console:{warn(){},log(){}},require(name) {
    if (name === '../db') return {pool,getSetting:async key=>settings[key],logGPActivity:async()=>{}};
    if (name === './job') return {getJobBuff:async (_w,_key,fallback)=>fallback};
    if (name === './territoryCondition') return {marketFeeMultiplier:async()=>1};
    throw Error('Fixture blocks dependency: '+name);
  }};
  vm.runInNewContext(source('server/services/marketplace.js'),context,{filename:'marketplace.js'});
  return {service:module.exports,pool,writes};
}
function page() { return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local market release UI</title>
${assetFiles.filter(f=>f.endsWith('.css')).map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')}
<style>body{overflow:auto;height:auto;padding:12px;background:var(--bg);color:var(--tx);font:14px/1.5 system-ui}#fixtureActions{display:flex;flex-wrap:wrap;gap:8px}#fixtureActions button{min-height:44px;padding:8px 12px}#fixtureStatus{position:fixed;bottom:8px;left:8px;right:8px;z-index:100100;background:#251b14;color:#ffd6b3;padding:8px;pointer-events:none}#fixtureStatus:empty{display:none}#requestLog{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}</style><body>
<h1 style="font-size:18px">로컬 마켓 검수 · 실자금/DB 없음</h1><div id="fixtureActions"><button onclick="openResourceMarketListing('iron_ore')">자원 등록</button><button onclick="loadAuctions()">경매 보기</button></div><pre id="requestLog"></pre><div id="auctionGrid"></div><div id="fixtureStatus" role="status"></div>${dialog()}
<script src="/assets/i18n.js"></script><script src="/assets/i18n-sea.js"></script><script>
var params=new URLSearchParams(location.search);LANG=params.get('lang')||'ko';
var walletState={address:'fixed_local_fixture_wallet',gameGP:100,gpBalance:100,ppBalance:100},_resourceInventory=[{code:'iron_ore',name:'철광석',quantity:10,base_pp_value:1}];
function getAuthHeaders(){return {};}function _setActiveTimeout(){return 0;}function _setActiveInterval(fn,n){return setInterval(fn,n);}function _clearActiveInterval(id){clearInterval(id);}function loadBaseInventory(){}function refreshBalance(){}function srvErr(s){return s;}
function escapeHtmlSafe(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}var escapeHtml=escapeHtmlSafe;
var toastTimer;function showToast(text){clearTimeout(toastTimer);document.getElementById('fixtureStatus').textContent=text;toastTimer=setTimeout(()=>document.getElementById('fixtureStatus').textContent='',5000);}
var nativeFetch=window.fetch.bind(window);window.fetch=async function(url,opts){var parsed=new URL(url,location.href);if(parsed.origin!==location.origin)throw Error('External requests forbidden');var r=await nativeFetch(url,opts);document.getElementById('requestLog').textContent+=((opts||{}).method||'GET')+' '+parsed.pathname+' → '+r.status+'\\n';return r;};
</script><script src="/assets/item-art.js"></script><script src="/fixture-economy.js"></script><script src="/assets/game-dialogs.js"></script><script src="/assets/market-transport.js"></script><script>if(params.get('view')==='auction')loadAuctions();else openResourceMarketListing('iron_ore');</script></body></html>`; }
const auctions = [
  {id:7,status:'active',escrow_version:0,read_only:true,escrow_review_required:true,seller_wallet:'another_fixture',listing_type:'currency',bundle_currency:'PP',bundle_amount:10,currency:'GP',start_price:10,buyout_price:20,current_bid:0,ends_at:'2026-10-22T00:00:00Z'},
  {id:8,status:'active',escrow_version:0,read_only:true,escrow_review_required:true,seller_wallet:'fixed_local_fixture_wallet',listing_type:'resource',resource_code:'iron_ore',resource_quantity:5,currency:'GP',start_price:10,current_bid:0,ends_at:'2026-10-22T00:00:00Z'}
];
const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'");
  const url = new URL(req.url,'http://127.0.0.1');
  if (url.pathname === '/') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(page()); }
  if (url.pathname === '/health') return json(res,200,{ok:true,fixtureOnly:true,database:false});
  if (url.pathname === '/requests') return json(res,200,requests);
  if (url.pathname === '/favicon.ico') {res.writeHead(204);return res.end();}
  if (url.pathname === '/fixture-economy.js') {res.setHeader('Content-Type','text/javascript');return res.end(source('assets/economy-inventory.js').split('/* ── UI Helpers')[0]);}
  if (assetFiles.includes(url.pathname.slice(1))) {const f=url.pathname.slice(1);res.setHeader('Content-Type',f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':'text/javascript');return res.end(fs.readFileSync(path.join(root,f)));}
  let input={};
  try {
    let body=''; for await (const chunk of req) {body+=chunk;if(body.length>4096)return json(res,413,{error:'fixture_body_limit'});}
    input=JSON.parse(body||'{}');
    requests.push({method:req.method,path:url.pathname,input});
    if (url.pathname === '/api/auctions') return json(res,200,{auctions});
    if (/^\/api\/auctions\/\d+$/.test(url.pathname)) return json(res,200,{auction:auctions.find(a=>a.id===Number(url.pathname.split('/').pop())),bids:[]});
    if (/^\/api\/auctions\/\d+\//.test(url.pathname)) return json(res,400,{error:'escrow_review_required'});
    if (url.pathname === '/api/marketplace/listing-quote') {const f=market();return json(res,200,await f.service.quoteListing('fixed_local_fixture_wallet','resource',input));}
    if (url.pathname === '/api/marketplace/list') {const f=market();const listing=await f.service.createListing(f.pool,'fixed_local_fixture_wallet','resource',input);return json(res,200,{success:true,listing,fixtureOnly:true,dummyWriteCount:f.writes.length});}
    return json(res,404,{error:'fixture_route_not_found'});
  } catch (e) { return json(res,400,{error:e.message,fixtureOnly:true}); }
});
server.listen(Number(process.argv[2]||0),'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
