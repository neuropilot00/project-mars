'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/territory-ui.js'),'utf8');
function drag(){
 const handlers={},wrap={addEventListener:(k,f)=>handlers[k]=f},c={Math,landSelectMode:true,landDragStart:{lat:0,lng:0},landDragRect:null,GRID_SIZE:.22,_mobLandW:5,_mobLandH:5,_hoverDirty:false,
  document:{getElementById:()=>wrap},globe:{pointOfView:()=>({altitude:1})},requestAnimationFrame:f=>f(),_setDragPreviewPolygon(){},updateLandSelectUI(){},_updateMobLabels(){}};
 vm.createContext(c);const helper=source.indexOf('function snapLandCenter(');if(helper>=0)vm.runInContext(source.slice(helper,source.indexOf('// Mobile: single-finger',helper)),c);
 const a=source.indexOf('// Mobile: single-finger'),b=source.indexOf('function cancelLandSelect(',a);vm.runInContext(source.slice(a,b),c);
 const ev=(x,y=0,n=1)=>({touches:Array.from({length:n},()=>({clientX:x,clientY:y})),target:wrap,preventDefault(){}});
 return{c,handlers,ev};
}
test('small mobile drag deltas accumulate until the actual grid cell changes',()=>{const f=drag();f.handlers.touchstart(f.ev(0));for(let x=1;x<=4;x++)f.handlers.touchmove(f.ev(x));assert.equal(f.c.landDragRect.lng,.22);});
test('pinch interruption cannot resume a stale single-finger drag and jump the plot',()=>{const f=drag();f.handlers.touchstart(f.ev(0));f.handlers.touchstart(f.ev(100,0,2));f.handlers.touchmove(f.ev(140,0,2));f.handlers.touchmove(f.ev(150));assert.equal(f.c.landDragStart.lng,0);});
test('mobile plot edges remain inside the polar boundary using the real .22 degree grid',()=>{const f=drag();f.c.landDragStart={lat:69,lng:0};f.handlers.touchstart(f.ev(0));f.handlers.touchmove(f.ev(0,-100));assert.ok(f.c.landDragRect.lat+5*.22/2<=70);});
test('snap helper preserves area and wraps longitude when placing or resizing near the date line',()=>{const f=drag();assert.equal(typeof f.c.snapLandCenter,'function');const p=f.c.snapLandCenter(70,181,10,10);assert.ok(p.lat+10*.22/2<=70);assert.ok(p.lng>=-180&&p.lng<=180);assert.equal(p.w,10);assert.equal(p.h,10);});
test('mixed-owner previews count actual overlap without changing prices or charging owned cells',()=>{
 const world=fs.readFileSync(path.join(__dirname,'../assets/world-globe.js'),'utf8');
 const c={Math,walletState:{address:'me'},HIJACK_MULT:1.2,pixelGrid:{a:{owner:'early',price:4},b:{owner:'main',price:1},c:{owner:'main',price:1},d:{owner:'me',price:9}},getClaimPixels:()=>['a','b','c','d','e'].map(lat=>({lat,lng:0})),pxKey:lat=>lat,_getSectorPixelPrice:()=>2};vm.createContext(c);
 vm.runInContext(world.slice(world.indexOf('function calcStampCost('),world.indexOf('// Initialize pixelGrid')),c);const cost=c.calcStampCost(0,0,5,1);
 assert.equal(cost.affectedOwners.main.pixelCount,2);assert.equal(cost.affectedOwners.early.pixelCount,1);assert.equal(cost.ownSkipCount,1);assert.equal(cost.total,11.6);
 const ownerKeys=Object.keys(cost.affectedOwners);c.ownerKeys=ownerKeys;c.costInfo=cost;
 const a=source.indexOf('var _primaryDef ='),b=source.indexOf('var _di =',a);vm.runInContext(source.slice(a,b),c);assert.equal(c._primaryDef,'main');
});
test('a late defender response cannot overwrite a different plot or a closed modal',()=>{
 const a=source.indexOf('.then(function(d){',source.indexOf("fetch('/api/hijack/defender-info")),b=source.indexOf('\n        })',a);
 const body=source.slice(a+'.then(function(d){'.length,b);
 for(const closed of [false,true]){let writes=0;const node={style:{},set textContent(v){writes++;}};const plot={};const c={selectedPlot:closed?plot:{},openingPlot:plot,m:{classList:{contains:()=>!closed}},_dt:node,_di:node,_dic:node,LANG:'en'};vm.createContext(c);vm.runInContext('(function(d){'+body+'})({availableFleets:2,aliveShips:50});',c);assert.equal(writes,0);}
});
