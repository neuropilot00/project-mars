'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../assets',file),'utf8');
const source=read('economy-inventory.js'),shipyard=read('shipyard-modal.js');
function part(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start);return s.slice(start,end);}
function fixture(lang='en'){
 const grid={innerHTML:''},grid2={innerHTML:''},art=[];
 const c={window:{ItemArt:{render:(code,options)=>{art.push({code,options});return '<span class="existing-art"></span>';}}},localStorage:{getItem:()=>lang},document:{getElementById:id=>id==='baseInvGrid'?grid:id==='baseInvGrid2'?grid2:null},_itemName:()=>'',_itemDesc:()=>'',_baseShopItems:[],_shopItems:[],_activeEffects:[],_filterLiveEffects:v=>v,_enhInstances:[],_baseInvCat:'all',_baseInventory:[],_resourceInventory:[{resource_code:'iron_ore',quantity:'6',name_ko:'철광석',name_en:'Iron Ore'},{resource_code:'silicon_chip',quantity:'11',name_ko:'실리콘칩',name_en:'Silicon Chip'},{resource_code:'carbon_fiber',quantity:0}]};
 vm.createContext(c);vm.runInContext(read('i18n.js'),c);vm.runInContext(read('i18n-sea.js'),c);c.TL_SEA=c.window.TL_SEA;
 vm.runInContext(part(shipyard,'var MINERAL_KO = {','var MINERAL_EN = {')+'\n'+shipyard.match(/var MINERAL_EN = \{[\s\S]*?\n\};/)[0]+'\n'+part(shipyard,'function syResourceName(','function syRequirementStatusText('),c);
 vm.runInContext(source.slice(0,source.indexOf('(function(){'))+'\n'+source.slice(source.indexOf('function renderBaseInventory(){')),c);
 return{c,grid,grid2,art};
}
for(const lang of ['en','ko','ja','zh','id','vi','th'])test('actual owned-resource renderer handles API resource_code in '+lang+' without invented PP valuation',()=>{
 const {c,grid,grid2,art}=fixture(lang);c.renderBaseInventory();
 assert.ok(grid.innerHTML.includes(lang==='ko'?'철광석':'Iron Ore'));assert.ok(grid.innerHTML.includes(lang==='ko'?'실리콘칩':'Silicon Chip'));
 assert.ok(grid.innerHTML.includes('>6</b>'));assert.ok(grid.innerHTML.includes('>11</b>'));assert.ok(grid.innerHTML.includes('(2)'));
 assert.ok(!grid.innerHTML.includes(' PP'));assert.ok(!grid.innerHTML.includes('Carbon Fiber'));assert.equal(grid.innerHTML,grid2.innerHTML);
 assert.deepEqual(art.map(a=>a.code),['iron_ore','silicon_chip']);assert.ok(art.every(a=>a.options.size===64));
 assert.equal(c._resourceInventory[0].quantity,'6');assert.equal(c._resourceInventory[1].quantity,'11');
});
test('owned resources preserve known catalog names and escape unknown code/name fallbacks',()=>{
 const {c,grid}=fixture();c._itemName=code=>code==='catalog_resource'?'Existing catalog name':'';
 c._resourceInventory=[{resource_code:'unknown_<code>',quantity:3},{code:'legacy_code',name:'Legacy <name>',quantity:4},{resource_code:'catalog_resource',quantity:5},{resource_code:'server_named',name_en:'Server mineral name',quantity:2,base_pp_value:0}];
 c.renderBaseInventory();assert.ok(grid.innerHTML.includes('unknown_&lt;code&gt;'));assert.ok(grid.innerHTML.includes('Legacy &lt;name&gt;'));assert.ok(grid.innerHTML.includes('Existing catalog name'));assert.ok(grid.innerHTML.includes('Server mineral name'));assert.ok(!grid.innerHTML.includes(' PP'));
});
test('resource-only correction leaves owned item quantity and USE ON LAND action unchanged',()=>{
 const {c,grid}=fixture();c._baseInventory=[{code:'shield_basic',name:'Energy Shield',quantity:2,category:'defense'}];c.renderBaseInventory();
 assert.ok(grid.innerHTML.includes('Energy Shield'));assert.ok(grid.innerHTML.includes('>×2</span>'));assert.ok(grid.innerHTML.includes("useShopItem('shield_basic',true)"));assert.ok(grid.innerHTML.includes('USE ON LAND'));
});
