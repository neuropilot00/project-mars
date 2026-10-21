'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/world-globe.js'),'utf8');
function fixture(bounds){
  function node(){return {style:{},children:[],innerHTML:'',appendChild(child){this.children.push(child);},insertBefore(child){this.children.unshift(child);}};}
  const nodes={myTerritoryCount:node(),myTerritoryList:node()},views=[],details=[],baseLists=[];
  const claim={id:690,owner:'COMMANDER',lat:43.12,lng:133.98,w:5,h:5,price:0};
  const group={claimIndices:[0],bounds};
  const grouped={claims:[claim],primaryId:690,centerLat:43.12,centerLng:133.98,totalPx:25,hasImg:false};
  const c={walletState:{address:'COMMANDER'},claims:[claim],_ownerGroups:bounds?{COMMANDER:[group]}:{},_forSaleMap:{},
    document:{getElementById:id=>nodes[id]||null,createElement:node},tl:en=>en,
    _myTerritoryGroups:()=>[grouped],_updateBaseTerritoryGroupList:list=>baseLists.push(list),
    globe:{pointOfView:view=>views.push(view)},showTerritoryInfo:plot=>details.push(plot)};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function _updateMyTerritories(){'),source.indexOf('function _updateBaseTerritoryGroupList(')),c);
  return {c,nodes,claim,views,details,baseLists};
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
