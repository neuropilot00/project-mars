'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/world-globe.js'),'utf8');
function fixture(bounds,width=1024){
  function node(){return {style:{},children:[],innerHTML:'',appendChild(child){this.children.push(child);},insertBefore(child){this.children.unshift(child);}};}
  const nodes={myTerritoryCount:node(),myTerritoryList:node(),myTerritoriesSection:node()},views=[],details=[],mobileDetails=[],baseLists=[];
  const claim={id:690,owner:'COMMANDER',lat:43.12,lng:133.98,w:5,h:5,price:0};
  const group={claimIndices:[0],bounds};
  const grouped={claims:[claim],primaryId:690,centerLat:43.12,centerLng:133.98,totalPx:25,hasImg:false};
  const c={window:{innerWidth:width,_baseTerritoryGroups:[grouped]},walletState:{address:'COMMANDER',connected:true},claims:[claim],_ownerGroups:bounds?{COMMANDER:[group]}:{},_forSaleMap:{},
    document:{getElementById:id=>nodes[id]||null,createElement:node},tl:en=>en,
    _myTerritoryGroups:()=>[grouped],_updateBaseTerritoryGroupList:list=>baseLists.push(list),
    globe:{pointOfView:view=>views.push(view),controls:()=>({})},showTerritoryInfo:plot=>details.push(plot),showMobInfoBtn:plot=>mobileDetails.push(plot),
    compositeClaimsOnTexture(){},showToast(){},_buildMergedPlot:()=>claim,closeBaseModal(){}};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('var _myLandMode=false;'),source.indexOf('function _updateBaseTerritoryGroupList(')),c);
  vm.runInContext(source.slice(source.indexOf('function _baseTerritoryGlobe('),source.indexOf('function _baseTerritoryTap(')),c);
  return {c,nodes,claim,views,details,mobileDetails,baseLists};
}
test('owned territory list renders and zooms with the actual owner group bounds',()=>{
  const f=fixture({minLng:100,maxLng:140,minLat:20,maxLat:45});
  assert.doesNotThrow(()=>f.c._updateMyTerritories());
  assert.equal(f.nodes.myTerritoryCount.textContent,1);
  assert.equal(f.nodes.myTerritoryList.children.length,1);
  f.nodes.myTerritoryList.children[0].children[0].onclick();
  assert.equal(f.views[0].lat,43.12);assert.equal(f.views[0].lng,133.98);assert.equal(f.views[0].altitude,1.2);
  assert.equal(f.c.selectedPlot,f.claim);assert.equal(f.details[0],f.claim);assert.equal(f.baseLists.length,1);
});
test('owned territory list can navigate before owner group bounds are available',()=>{
  const f=fixture();f.c._updateMyTerritories();
  f.nodes.myTerritoryList.children[0].children[0].onclick();
  assert.equal(f.views[0].altitude,0.4);assert.equal(f.details[0],f.claim);
});
test('empty owned territory list remains a normal empty state',()=>{
  const f=fixture();f.c.claims=[];f.c._updateMyTerritories();
  assert.equal(f.nodes.myTerritoryCount.textContent,'0');
  assert.match(f.nodes.myTerritoryList.innerHTML,/No territories yet/);assert.equal(f.views.length,0);
});
for(const width of [320,390,768])test('MY LAND and list selection expose the existing mobile info button at '+width+'px',()=>{
  const f=fixture({minLng:133,maxLng:134,minLat:43,maxLat:44},width);
  f.c.toggleMyLand();
  assert.equal(f.c._myLandMode,true);assert.equal(f.c.selectedPlot,f.claim);
  assert.equal(f.mobileDetails[0],f.claim);assert.equal(f.details.length,0);
  f.nodes.myTerritoryList.children[0].children[0].onclick();
  assert.equal(f.mobileDetails[1],f.claim);assert.equal(f.details.length,0);
  assert.equal(f.views.length,2);
});
for(const width of [390,769])test('BASE map selection uses the visible info surface at '+width+'px',()=>{
  const f=fixture({minLng:133,maxLng:134,minLat:43,maxLat:44},width);
  f.c._baseTerritoryGlobe(0);
  assert.equal(f.views.length,1);assert.equal(f.c.selectedPlot,f.claim);
  assert.equal(f.mobileDetails.length,width<=768?1:0);assert.equal(f.details.length,width>768?1:0);
});
