'use strict';
// Loopback-only manual browser fixture. Actual UI sources + local HTTP failure
// injection, public dummy data, no game bootstrap, DB, auth, mail or wallets.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const evidence=path.resolve(root,'../../outputs/evidence/ui-mobile-runtime-20261021');
fs.mkdirSync(evidence,{recursive:true});
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
function slice(f,a,b){const s=source(f),i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0)throw Error('Missing source boundary '+f);return s.slice(i,j);}
function div(id){const s=source('index.html'),hit=s.indexOf('id="'+id+'"'),start=s.lastIndexOf('<div',hit);let depth=0;const re=/<\/?div\b[^>]*>/g;re.lastIndex=start;for(let m;(m=re.exec(s));){depth+=m[0].startsWith('</')?-1:1;if(!depth)return s.slice(start,re.lastIndex);}throw Error('Missing DOM '+id);}
const files=['assets/battle-hub-modal.css','assets/shipyard-modal.css','assets/main.css','assets/core-navigation.css','assets/game-icons.css','assets/item-art.css','assets/item-art.js','assets/game-dialogs.js','assets/market-transport.js','assets/campaign-system.js','assets/i18n.js','assets/i18n-sea.js','assets/items/item-art-a.webp'];
const runs=new Map();
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
function page(){return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mars · Local UI verification</title>
${files.filter(f=>f.endsWith('.css')).map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')}
<style>body{overflow:auto;height:auto;padding:12px;font:14px/1.5 system-ui;background:var(--bg);color:var(--tx)}#fixtureBar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#fixtureBar button,#fixtureBar select{min-height:44px;padding:8px;font-size:14px;color:var(--tx);border:1px solid var(--bdr2);background:var(--surface1);border-radius:8px}#fixtureStatus{position:fixed;left:12px;right:12px;bottom:12px;z-index:100100;background:#201717;color:#ffcbad;padding:12px;border:1px solid var(--bdr2);border-radius:8px;pointer-events:none}#fixtureStatus:empty{display:none}#requestLog{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}#campaignPanel{max-width:680px;margin:12px auto}</style>
<body><h1 style="font-size:18px">OCCUPY MARS · 로컬 검수</h1><p>실제 UI 코드 / 로컬 HTTP 더미 응답 / 실계정·거래 없음</p>
<form id="fixtureBar"><select name="view" aria-label="검수 화면"><option value="tournaments">토너먼트</option><option value="campaign">캠페인</option><option value="market">자원 판매</option></select><select name="mode" aria-label="응답 조건"><option value="http500">HTTP 500 → 정상</option><option value="rate">HTTP 429 → 정상</option><option value="network">연결 끊김 (지속)</option><option value="malformed">잘못된 JSON → 정상</option><option value="invalid">잘못된 데이터 → 정상</option><option value="empty">정상 빈 목록</option><option value="success">정상 데이터</option><option value="delay">응답 지연</option><option value="timeout">응답 없음</option></select><select name="lang" aria-label="검수 언어"><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh">中文</option><option value="id">Indonesia</option><option value="vi">Tiếng Việt</option><option value="th">ไทย</option></select><button>조건 적용</button><button type="button" onclick="launchFixture()">화면 열기</button></form>
<pre id="requestLog" aria-label="로컬 요청 기록"></pre><div id="fixtureStatus" role="status"></div>
${div('tournamentModal')}${div('campaignPanel')}${div('gameConfirm')}
<script src="/assets/i18n.js"></script><script src="/assets/i18n-sea.js"></script><script src="/fixture-setup.js"></script><script src="/fixture-tournament.js"></script><script src="/assets/campaign-system.js"></script><script src="/assets/item-art.js"></script><script src="/fixture-economy.js"></script><script src="/assets/game-dialogs.js"></script><script src="/assets/market-transport.js"></script><script>
function launchFixture(){document.getElementById('campaignPanel').hidden=fixtureView!=='campaign';if(fixtureView==='tournaments')openTournaments();else if(fixtureView==='campaign')loadCampaignStatus();else openResourceMarketListing('iron_ore');}
document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)||el.textContent});launchFixture();</script></body></html>`;}
function setup(){return `var fixtureParams=new URLSearchParams(location.search),fixtureView=fixtureParams.get('view')||'tournaments',fixtureMode=fixtureParams.get('mode')||'http500',fixtureRun=crypto.randomUUID();LANG=fixtureParams.get('lang')||'ko';
for(var key of ['view','mode','lang'])document.querySelector('[name='+key+']').value=key==='view'?fixtureView:key==='mode'?fixtureMode:LANG;
var walletState={address:'fixed_local_fixture_wallet',gameGP:100,gpBalance:100,ppBalance:100},factionState={current:{code:'mcc'}},_resourceInventory=[{code:'iron_ore',name:'철광석',quantity:10,base_pp_value:1}];
function getMyWallet(){return walletState.address;}function getAuthHeaders(){return {};}function isLoggedIn(){return true;}
function escapeHtmlSafe(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}var escapeHtml=escapeHtmlSafe;
var _apiFetchGuards={},_apiEndpointGuards={},_apiPublicHudBackoffUntil=0;function _isPublicHudFetchPath(){return false;}
// Lifecycle polling is outside this three-screen fixture; retain registration only.
var _pageVisibleHandlers=[];function _onPageVisible(fn){if(typeof fn==='function')_pageVisibleHandlers.push(fn);}
function _setActiveTimeout(){return 0;}function refreshBalance(){}function loadBaseInventory(){}function loadSellView(){}function srvErr(s){return s;}
var toastTimer;function showToast(text){clearTimeout(toastTimer);document.getElementById('fixtureStatus').textContent=text;toastTimer=setTimeout(()=>{document.getElementById('fixtureStatus').textContent='';},6000);}var showFactionToast=showToast;
const nativeFetch=window.fetch.bind(window);window.fetch=async function(url,opts){opts=opts||{};var headers=new Headers(opts.headers||{});headers.set('X-Fixture-Run',fixtureRun);headers.set('X-Fixture-Mode',fixtureMode);var parsed=new URL(url,location.href);if(parsed.origin!==location.origin)throw Error('Fixture forbids external URL');try{var r=await nativeFetch(url,Object.assign({},opts,{headers:headers}));document.getElementById('requestLog').textContent+=(opts.method||'GET')+' '+parsed.pathname+' → '+r.status+'\\n';return r;}catch(e){document.getElementById('requestLog').textContent+=(opts.method||'GET')+' '+parsed.pathname+' → network/abort\\n';throw e;}};`;}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'");
 if(url.pathname==='/health')return json(res,200,{ok:true,fixtureOnly:true,database:false});
 if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(page());}
 if(url.pathname==='/fixture-setup.js'){res.setHeader('Content-Type','text/javascript');return res.end(setup());}
 if(url.pathname==='/fixture-tournament.js'){res.setHeader('Content-Type','text/javascript');return res.end(slice('assets/core-runtime.js','function _guardedFetchEndpointKey(','function _clearActiveTimeout(')+slice('assets/battle-hub-modal.js','function battleHubReadFetch(','function normalizeBattleSummary(')+slice('assets/battle-hub-modal.js','var tnState =','async function registerTournament('));}
 if(url.pathname==='/fixture-economy.js'){res.setHeader('Content-Type','text/javascript');return res.end(source('assets/economy-inventory.js').split('/* ── UI Helpers')[0]);}
 if(files.includes(url.pathname.slice(1))){const f=url.pathname.slice(1);res.setHeader('Content-Type',f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':'text/javascript');return res.end(fs.readFileSync(path.join(root,f)));}
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'fixture_route_not_found'});
 const run=String(req.headers['x-fixture-run']||'none'),mode=String(req.headers['x-fixture-mode']||'success'),key=run+url.pathname,count=(runs.get(key)||0)+1;runs.set(key,count);
 let body='';for await(const c of req)body+=c;if(body.length>4096)return json(res,413,{});let input={};try{input=JSON.parse(body||'{}');}catch(_){return json(res,400,{error:'fixture_invalid_json'});}
 fs.appendFileSync(path.join(evidence,'requests.jsonl'),JSON.stringify({at:new Date().toISOString(),run,mode,path:url.pathname,method:req.method,count,input})+'\n');
 // Fail every connection: Chrome may transparently retry a dropped GET.
 if(mode==='network'){req.socket.destroy();return;}
 if(mode==='timeout'){req.on('close',()=>res.destroy());return;}
 if(count===1&&mode==='http500')return json(res,500,{error:'fixed_local_error'});
 if(count===1&&mode==='rate'){res.setHeader('Retry-After','3');return json(res,429,{error:'fixed_local_rate_limit'});}
 if(count===1&&mode==='malformed'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{broken');}
 if(count===1&&mode==='invalid')return json(res,200,{unexpected:true});
 if(mode==='delay')await new Promise(r=>setTimeout(r,1800));
 if(url.pathname==='/api/tournaments')return json(res,200,{tournaments:mode==='success'?[{id:1,name:'화성 궤도 훈련 토너먼트',status:'registering',current_participants:2,max_participants:8,entry_fee_gp:0,prize_pool_gp:0}]:[]});
 if(url.pathname.startsWith('/api/campaign/status/'))return json(res,200,{chapters:mode==='success'?[{questId:'fixture_prologue',faction:'mcc',campaignId:'mcc_route',chapterNumber:1,title:{ko:'첫 원정: 화성 항로 확보',en:'First sortie'},progress:{status:'locked'},objectives:[]}]:[],reputation:{mcc:10,fsp:0,cv:0},tierLabels:{mcc:'중립',fsp:'중립',cv:'중립'},rewardInbox:[]});
 if(url.pathname==='/api/marketplace/listing-quote'){
  const price=Number(input.price),q=Number(input.resourceQuantity),fee=price*.05,tariff=price*.02;
  if(!Number.isSafeInteger(q)||q<1||q>10||!Number.isFinite(price)||price<=0)return json(res,400,{error:'fixture_invalid_quantity_or_price'});
  return json(res,200,{price,currency:input.currency,listingFeeGp:5,saleFee:fee,saleFeePct:5,listingDiscountsVerified:true,saleDiscountsVerified:true,receivesMin:price-fee-tariff,receivesMax:price-fee,tariffStatus:'range',tariffMax:tariff,netAfterListingFeeMin:price-fee-tariff-5,netAfterListingFeeMax:price-fee-5,resourceQuantity:q,npcCompetition:{available:true,listingCount:2,minUnitPrice:.6},quotedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()});
 }
 if(url.pathname==='/api/marketplace/list')return json(res,200,{success:true,listing:{id:1},fixtureOnly:true});
 return json(res,404,{error:'unsupported_fixture_action'});
});
server.listen(Number(process.argv[2]||0),'127.0.0.1',()=>{const address='http://127.0.0.1:'+server.address().port;fs.writeFileSync(path.join(evidence,'server.json'),JSON.stringify({address,pid:process.pid,started:new Date().toISOString(),scope:'loopback-only UI fixture with actual HTTP, no DB/bootstrap'},null,2));console.log(address);});
