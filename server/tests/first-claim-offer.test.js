'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../assets/territory-ui.js'),'utf8');
function ui({offer={eligible:true,maxPixels:25,playerLevel:1},sector={id:4,tier:'frontier'},pixels=true}={}){
 const elements=new Map(),toasts=[],camera=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',className:'',classList:{add(){},remove(){}},appendChild(){},parentNode:{insertBefore(){}}});return elements.get(id);};
 const state={walletState:{connected:true,address:'0xfixture'},_pixelsLoaded:false,_sectorsData:[sector],GRID_SIZE:.22,isMobile:true,stampMode:false,stampImgUrl:null,selectedPlot:null,uploadedUrl:'old-image',
 document:{getElementById:get,createElement:()=>({appendChild(){},style:{}})},globe:{pointOfView:value=>camera.push(value),controls:()=>({})},getAuthHeaders:()=>({}),setTimeout,clearTimeout,AbortController,
 fetch:async url=>url==='/api/pixels'?({ok:pixels,headers:{get:()=>null},json:async()=>({})}):({ok:true,json:async()=>({firstClaim:offer})}),tl:(...x)=>x[0],showToast:message=>toasts.push(message),t:()=>'',refreshSectors:async()=>{},
 findSectorAtLatLng:()=>sector,getClaimPixels:(lat,lng,w,h)=>Array.from({length:w*h},()=>({lat,lng})),calcStampCost:(lat,lng,w,h)=>({newCount:w*h,overlapCount:0,total:15}),_getBlockedSector:()=>null};
 state.claims=[];state.pixelGrid={};state._serverPixels={};state.pxKey=(lat,lng)=>lat+','+lng;state._rebuildOwnerData=()=>{};
 vm.createContext(state);
 const globeSource=fs.readFileSync(path.join(__dirname,'../../assets/world-globe.js'),'utf8');
 vm.runInContext(globeSource.slice(globeSource.indexOf('function initPixelGridFromServer('),globeSource.indexOf('var _pixelsLoaded=',globeSource.indexOf('function initPixelGridFromServer('))),state);
 vm.runInContext(source.slice(source.indexOf('// Fresh server eligibility'),source.indexOf('// Mobile land size state')),state);
 vm.runInContext('var _mobLandW=10,_mobLandH=10;function _showMobSizeControls(){}',state);
 state.cancelLandSelect=()=>{};state.openClaimModal=async()=>{};
 return{state,get,toasts,camera};
}
test('actual server cap sets first mobile footprint and preserves returning player default',async()=>{
 for(const [offer,size] of [[{eligible:true,maxPixels:25,playerLevel:1},5],[{eligible:true,maxPixels:9,playerLevel:1},3],[{eligible:false,maxPixels:25,playerLevel:1},10],[null,10]]){
  const f=ui({offer});await f.state.activateLandSelect();assert.equal(f.state._mobLandW,size);assert.equal(f.state._mobLandH,size);
 }
});
test('free quote requires eligibility, loaded pixels, all-new footprint, cap and accessible sector',async()=>{
 const f=ui();await Promise.all([f.state._refreshFirstClaimOffer(),f.state._refreshFirstClaimPixels()]);const quote=(w,h,cost)=>f.state._firstClaimFreeAt(0,0,w,h,cost);
 assert.equal(quote(5,5,{newCount:25,overlapCount:0}),true);
 assert.equal(quote(10,10,{newCount:100,overlapCount:0}),false);
 assert.equal(quote(5,5,{newCount:24,overlapCount:1}),false);
 assert.equal(quote(5,5,{newCount:24,overlapCount:0}),false);
 f.state._firstClaimPixelsWallet=null;assert.equal(quote(5,5,{newCount:25,overlapCount:0}),false);await f.state._refreshFirstClaimPixels();
 f.state.findSectorAtLatLng=()=>null;assert.equal(quote(5,5,{newCount:25,overlapCount:0}),false);
 f.state.findSectorAtLatLng=()=>({tier:'core',entryMinLevel:25,entryRequiredMidOwns:1});assert.equal(quote(5,5,{newCount:25,overlapCount:0}),false);
 f.state.walletState.address='0xother';assert.equal(quote(5,5,{newCount:25,overlapCount:0}),false);
});
test('beginner action uses actual frontier geometry and vacancy without granting ownership',async()=>{
 const sector={id:19,tier:'frontier',bounds:{latMin:12,latMax:16,lngMin:40,lngMax:44}};
 const f=ui({sector});await f.state._chooseFirstClaimArea();
 assert.equal(f.state.selectedPlot.w,5);assert.equal(f.state.selectedPlot.h,5);assert.equal(f.state.selectedPlot.owner,null);
 assert.ok(f.state.selectedPlot.lat>=12&&f.state.selectedPlot.lat<=16);assert.ok(f.state.selectedPlot.lng>=40&&f.state.selectedPlot.lng<=44);
 assert.equal(f.state.uploadedUrl,null);assert.equal(f.camera.length,1);
});
test('occupied, unknown, outside-polygon and unloaded regions never fabricate a selection',async()=>{
 for(const reason of ['occupied','polygon','unknown','pixels']){
  const sector={id:8,tier:'frontier',bounds:{latMin:1,latMax:3,lngMin:20,lngMax:24}};
  const f=ui({sector,offer:reason==='unknown'?null:undefined,pixels:reason!=='pixels'});
  if(reason==='occupied')f.state.calcStampCost=()=>({newCount:0,overlapCount:25});
  if(reason==='polygon')f.state.findSectorAtLatLng=()=>null;
  await f.state._chooseFirstClaimArea();assert.equal(f.state.selectedPlot,null);assert.equal(f.camera.length,0);assert.equal(f.toasts.length,1);
 }
});
function status(row,{fails=false}={}){
 const routes=[];const context={console:{error(){}},module:{exports:{}},require(name){
  if(name==='express')return{Router:()=>({get:(url,...handlers)=>routes.push({url,handler:handlers.at(-1)}),post(){}})};
  if(name==='../utils/rateLimiters')return{makeRateLimiter:()=>()=>{}};
  if(name==='../db')return{pool:{query:async()=>{if(fails)throw Error('fixture unavailable');return{rows:row?[row]:[]};}}};
  if(name==='../utils/apiHelpers')return{requireAuth:()=>{},getAuthWallet:()=> '0xfixture'};
  if(name==='../services/playerJourney')return{getPlayerJourney:async()=>({step:0,completed:false})};
  throw Error('optional dependency unavailable');
 }};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../routes/playerStatusRoutes.js'),'utf8'),context);
 const response={json(body){this.body=body;},status(){return this;}};
 return routes.find(x=>x.url==='/onboarding/status').handler({},response).then(()=>response.body);
}
const fresh={rank_level:1,completed:null,skipped:null,claim_count:0,onboarding_enabled:'true',free_enabled:'true',free_size:25};
test('read-only status returns exact cap and rejects existing/skipped/completed/disabled eligibility',async()=>{
 const first=await status(fresh);assert.equal(first.firstClaim.eligible,true);assert.equal(first.firstClaim.maxPixels,25);
 for(const patch of [{claim_count:1},{completed:true},{skipped:true},{onboarding_enabled:false},{free_enabled:'false'},{free_size:0}])assert.equal((await status({...fresh,...patch})).firstClaim.eligible,false);
 assert.equal((await status(null)).firstClaim,null);assert.equal((await status(fresh,{fails:true})).firstClaim,null);
});

test('actual grid initializer accepts authoritative empty world while legacy loaded flag stays false',async()=>{
 const f=ui();await f.state._refreshFirstClaimPixels();
 assert.equal(f.state._pixelsLoaded,false);assert.equal(f.state._firstClaimPixelsReady(),true);
 assert.deepEqual(Object.keys(f.state.pixelGrid),[]);
 await f.state._chooseFirstClaimArea(); // default fixture has no bounded region; no invented position
 assert.equal(f.state.selectedPlot,null);
});
test('pixel refresh preserves actual owner tuple and rejects deferred or malformed responses',async()=>{
 const f=ui();const owner='0x'+'1'.repeat(40);
 f.state.fetch=async()=>({ok:true,headers:{get:()=>null},json:async()=>({[owner]:[[12.1,40.04,7,0]]})});
 await f.state._refreshFirstClaimPixels();assert.equal(f.state._firstClaimPixelsReady(),true);
 assert.equal(f.state.pixelGrid['12.1,40.04'].owner,owner);assert.equal(f.state.pixelGrid['12.1,40.04'].claimId,7);
 for(const response of [
  {ok:true,headers:{get:()=> 'public-hud'},json:async()=>({})},
  {ok:false,headers:{get:()=>null},json:async()=>({})},
  {ok:true,headers:{get:()=>null},json:async()=>({error:'unavailable'})},
  {ok:true,headers:{get:()=>null},json:async()=>({[owner]:[['bad',40,7,0]]})}
 ]){f.state.fetch=async()=>response;await f.state._refreshFirstClaimPixels();assert.equal(f.state._firstClaimPixelsReady(),false);}
});

test('starting land selection immediately clears guidance and blocks its return while metadata loads',async()=>{
 const f=ui();let active=true,removed=0;
 f.state.closeOnboardingHint=()=>{active=false;};f.state._removeFirstClaimGuide=()=>{removed++;};
 f.get('claimModal').classList.contains=()=>false;
 const previousFetch=f.state.fetch;
 // Both metadata reads are concurrent; keep all pending resolvers.
 const pending=[];f.state.fetch=(...args)=>new Promise(resolve=>pending.push(()=>previousFetch(...args).then(resolve)));
 const activation=f.state.activateLandSelect();
 assert.equal(active,false);assert.equal(removed,1);assert.equal(f.state._isFirstClaimFlowActive(),true);
 for(const resolve of pending)resolve();await activation;
 assert.equal(f.state.landSelectMode,true);assert.equal(f.state._isFirstClaimFlowActive(),true);
 f.state.landSelectMode=false;assert.equal(f.state._isFirstClaimFlowActive(),false);
});
test('actual journey renderer suppresses claim-flow hints and preserves FIRST SORTIE outside the flow',()=>{
 const f=ui();f.state.landSelectMode=false;let claimOpen=false;
 f.get('claimModal').classList.contains=name=>name==='open'&&claimOpen;
 f.get('obOverlay').classList.contains=()=>false;f.get('commandCenter').hidden=true;
 const hint=f.get('onboardingHint'),classes=new Set();hint.dataset={};hint.classList={add:value=>classes.add(value),remove:value=>classes.delete(value)};
 const part=()=>({textContent:'',removeAttribute(){},disabled:false});const title=part(),body=part(),button=part();
 hint.querySelector=selector=>selector.includes('__title')?title:selector.includes('__body')?body:button;
 const social=fs.readFileSync(path.join(__dirname,'../../assets/social-live-modal.js'),'utf8');
 vm.runInContext(social.slice(social.indexOf('function journeyHintIsBlocked()'),social.indexOf('function showJourneyRequestState(')),f.state);
 vm.runInContext(social.slice(social.indexOf('function showOnboardingHint('),social.indexOf('async function dismissOnboardingHint(')),f.state);
 f.state.showOnboardingHint(0,true);assert.equal(title.textContent,'FIRST SORTIE');assert.equal(classes.has('active'),true);
 f.state.landSelectMode=true;f.state.showOnboardingHint(0,true);assert.equal(classes.has('active'),false);
 f.state.landSelectMode=false;claimOpen=true;f.state.showOnboardingHint(0,false);assert.equal(classes.has('active'),false);
 claimOpen=false;f.state.showOnboardingHint(0,true);assert.equal(classes.has('active'),true);assert.equal(title.textContent,'FIRST SORTIE');
});
test('delayed first-claim guide cannot recreate itself inside the active selection or claim modal',()=>{
 const f=ui();f.state.landSelectMode=true;f.get('claimModal').classList.contains=()=>false;
 const begin=source.indexOf('function showFirstClaimGuide()');
 vm.runInContext(source.slice(begin,source.indexOf('// 온보딩 미완료',begin)),f.state);
 assert.doesNotThrow(()=>f.state.showFirstClaimGuide());
 f.state.landSelectMode=false;f.get('claimModal').classList.contains=()=>true;
 assert.doesNotThrow(()=>f.state.showFirstClaimGuide());
});

test('actual modal classes block journey hints and leave first-sortie available after closing',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const f=ui();f.state.landSelectMode=false;
 f.get('claimModal').classList.contains=()=>false;f.get('obOverlay').classList.contains=()=>false;f.get('commandCenter').hidden=true;
 let activeModal=null,selector;
 f.state.document.querySelector=value=>{selector=value;return activeModal;};
 const social=fs.readFileSync(path.join(__dirname,'../../assets/social-live-modal.js'),'utf8');
 vm.runInContext(social.slice(social.indexOf('function journeyHintIsBlocked()'),social.indexOf('function showJourneyRequestState(')),f.state);
 for(const [id,className,state]of [['authModal','mbg','open'],['baseModal','base-modal','open'],['shipyardModal','shipyard-modal-backdrop','active'],['replayModal','rp-modal-backdrop','active'],['battleViewer','bv-backdrop','active'],['tacticalLabBackdrop','tlab-backdrop','active']]){
  const opening=html.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'))[0];assert.ok(opening.includes('class="'+className+'"'),id+' uses actual DOM class');
  activeModal={id,className:className+' '+state};assert.equal(f.state.journeyHintIsBlocked(),true,id);
 }
 activeModal=null;assert.equal(f.state.journeyHintIsBlocked(),false);
 assert.ok(selector.includes('.mbg.open'));assert.ok(selector.includes('[class*="-modal-backdrop"].active'));assert.ok(selector.includes('.bv-backdrop.active'));
 const css=fs.readFileSync(path.join(__dirname,'../../assets/utility-overlays.css'),'utf8');
 assert.ok(css.includes('body:has('+selector+') :is(.onboarding-hint,#firstClaimGuide,#chatOverlay,#bugReportBtn,.zc,.mob-toggle){visibility:hidden;pointer-events:none}'),'CSS suppresses hints and map helpers for the same real modal selectors');
});

test('rendered FREE0 quote is frozen into actual claim POST before optimistic ownership, paid path stays false',async()=>{
 for(const eligible of [true,false]){
  const f=ui({offer:{eligible,maxPixels:25,playerLevel:1}});await Promise.all([f.state._refreshFirstClaimOffer(),f.state._refreshFirstClaimPixels()]);
  const s=f.state;s.selectedPlot={lat:20.02,lng:40.04,w:5,h:5};s.lastStampCost={newCount:25,totalPixels:25,overlapCount:0,total:3.75};s.stampW=5;s.stampH=5;s.selectedPayMethod='pp';s.claims=[];s.PIXEL_PRICE=.15;
  s.getClaimPixels=(lat,lng)=>[{lat,lng}];s.compositeClaimsOnTexture=()=>{};s.showFactionFlavor=async()=>{};
  s.emailAuth={token:'fixture-only'};s.uploadedUrl='';s.console={error:(...args)=>assert.fail(args.join(' '))};s.srvErr=value=>value;s._sfx={click(){},error(){}};
  f.get('stampLinkInput').value='';
  s.closeClaimModal=()=>{};
  const updateStart=source.indexOf('function updateCostDisplayUnit()');vm.runInContext(source.slice(updateStart,source.indexOf('var lastStampCost=',updateStart)),s);
  s.updateCostDisplayUnit();assert.equal(f.get('modalCostDisplay').textContent.startsWith('FREE first territory · 0 PP'),eligible);
  const quote=s._firstClaimFreeAt;let snapshots=0;
  s._firstClaimFreeAt=(...args)=>{snapshots++;assert.equal(Object.keys(s.pixelGrid).length,0,'quote checked before optimistic pixels');return quote(...args);};
  let body;
  s.fetch=async(url,options)=>{assert.equal(url,'/api/claim');assert.equal(options.method,'POST');body=JSON.parse(options.body);assert.equal(Object.keys(s.pixelGrid).length,1,'optimistic update precedes request but must not change expected-free snapshot');return{ok:false,status:eligible?409:400,json:async()=>({error:eligible?'TUTORIAL_FREE_CLAIM_CHANGED':'paid-fixture-error'})};};
  const start=source.indexOf('async function confirmClaim()');vm.runInContext(source.slice(start,source.indexOf('/* ── Old Image Upload',start)),s);
  await s.confirmClaim();assert.equal(snapshots,1);assert.equal(body.expectedTutorialFree,eligible);assert.equal(body.payMethod,'pp');assert.equal(body.width,5);assert.equal(body.height,5);
  assert.equal(Object.keys(s.pixelGrid).length,0,'rejected claim rolls back optimistic pixels');
  if(eligible){assert.equal(s._firstClaimOffer,null);assert.match(f.toasts.at(-1),/eligibility changed/);}else assert.equal(f.toasts.at(-1),'paid-fixture-error');
 }
});
