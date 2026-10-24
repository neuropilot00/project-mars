'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../assets',file),'utf8');
const economy=read('economy-inventory.js'),shipyard=read('shipyard-modal.js');
function part(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function fixture(lang){
 const grid={innerHTML:''};
 const c={window:{},walletState:{address:'COMMANDER',gameGP:100},localStorage:{getItem:()=>lang},document:{getElementById:()=>grid},_baseShopItems:[],_shopItems:[],_itemName:code=>code==='known_item'?'Localized catalog item':'',_escHtml:String};
 vm.createContext(c);
 vm.runInContext(read('i18n.js'),c);vm.runInContext(read('i18n-sea.js'),c);c.TL_SEA=c.window.TL_SEA;
 vm.runInContext(part(shipyard,'var MINERAL_KO = {','var MINERAL_EN = {')+'\n'+shipyard.match(/var MINERAL_EN = \{[\s\S]*?\n\};/)[0]+'\n'+part(shipyard,'function syResourceName(','function syRequirementStatusText('),c);
 vm.runInContext(economy.slice(0,economy.indexOf('(function(){'))+'\n'+part(economy,'var _craftingRecipes=','var _craftHistoryOpen='),c);
 c._craftingRecipes=[{id:'1',name:'Existing recipe',output_qty:1,ingredients:[{code:'iron_ore',item_name:'iron_ore',qty:5},{resource_code:'silicon_chip',item_name:'silicon_chip',qty:2},{code:'known_item',item_name:'Server catalog name',qty:1}],gp_cost:50,success_rate:80,fail_refund_pct:50,category:'defense',canCraft:true}];
 return{c,grid};
}
for(const lang of ['en','ko','ja','zh','id','vi','th'])test('actual crafting card renders existing '+lang+' translations and mineral names without waiting for applyI18n',()=>{
 const {c,grid}=fixture(lang);c.renderCraftingGrid();const html=grid.innerHTML;
 const craftLabel='⚗️ '+c.tl('CRAFT','제작','製作','制作','BUAT','CHẾ TẠO','คราฟต์');
 assert.ok(html.includes('>'+craftLabel+'</button>'));
 assert.ok(!html.includes('data-i18n="craft_btn"'), 'stale generated craft_btn must not overwrite the localized dynamic button');
 assert.ok(html.includes('>'+c.t('inv_cat_defense')+'</span>'));
 assert.ok(html.includes((lang==='ko'?'철광석':'Iron Ore')+' ×5'));
 assert.ok(html.includes((lang==='ko'?'실리콘칩':'Silicon Chip')+' ×2'));
 assert.ok(html.includes('Localized catalog item ×1'));
 assert.doesNotMatch(html,/>iron_ore ×|>silicon_chip ×/);
 assert.ok(html.includes('data-craft-recipe="1"'));assert.ok(html.includes('50 GP'));assert.ok(html.includes('80%'));assert.ok(html.includes('cursor:pointer'));
 if(lang!=='en')assert.notEqual(craftLabel,'⚗️ CRAFT');
 c._craftingRecipes[0].canCraft=false;c.renderCraftingGrid();assert.ok(grid.innerHTML.includes('cursor:not-allowed'));assert.ok(grid.innerHTML.includes('data-craft-recipe="1"'));
});
test('unknown crafting categories and ingredients retain escaped existing fallbacks',()=>{
 const {c,grid}=fixture('ko');Object.assign(c._craftingRecipes[0],{category:'unknown_category',ingredients:[{code:'unknown_code',item_name:'Existing <name>',qty:3}]});
 c.renderCraftingGrid();assert.ok(grid.innerHTML.includes('UNKNOWN_CATEGORY'));assert.ok(grid.innerHTML.includes('Existing &lt;name&gt; ×3'));
 c._craftingRecipes[0].category='elite';c.renderCraftingGrid();assert.ok(grid.innerHTML.includes('>'+c.t('craft_cat_elite')+'</span>'));
});
for(const lang of ['en','ko','ja','zh','id','vi','th'])test('actual '+lang+' card and confirmation share exact-catalog quantity cost warning without changing craft prices',async()=>{
 const {c,grid}=fixture(lang),dialogs=[];let requests=0;
 Object.assign(c._craftingRecipes[0],{output_item_type_id:'7',output_qty:2});
 c._baseShopItems=[{id:7,price_gp:'10',code:'existing_output'}];
 c.walletState={address:'COMMANDER',gameGP:100};c.gameConfirm=async d=>{dialogs.push(d);return false;};c.fetch=()=>{requests++;throw Error('unexpected request');};
 c.renderCraftingGrid();const warning=c._craftingShopWarning(c._craftingRecipes[0]);
 assert.ok(warning.includes('20'));assert.ok(warning.includes('2'));assert.ok(grid.innerHTML.includes('data-craft-shop-warning'));assert.ok(grid.innerHTML.includes(warning));
 assert.ok(grid.innerHTML.includes('50 GP'));assert.ok(grid.innerHTML.includes('80%'));assert.equal(c._craftingRecipes[0].gp_cost,50);assert.equal(c._baseShopItems[0].price_gp,'10');
 c.attemptCraft(1);await new Promise(resolve=>setImmediate(resolve));assert.equal(dialogs.length,1);assert.ok(dialogs[0].body.includes(warning));assert.equal(requests,0);
 if(lang==='en')assert.equal(warning,'Direct shop purchase: 20 GP for 2. Crafting costs more GP plus materials; check your crafting mission before continuing.');
 else assert.ok(!warning.startsWith('Direct shop purchase:'));
});
test('craft shop warning ignores unknown IDs/prices/quantities and equal or higher totals; uses only actual GP price',()=>{
 const {c}=fixture('en');const recipe={...c._craftingRecipes[0],output_item_type_id:'7',output_qty:2};
 for(const item of [{id:8,price_gp:10},{id:7},{id:7,gp_price:10},{id:7,price_gp:0},{id:7,price_gp:-1},{id:7,price_gp:'unknown'},{id:7,price_gp:Infinity},{id:7,price_gp:25},{id:7,price_gp:30},{id:7,price_gp:10,active:false}]){
  c._baseShopItems=[item];assert.equal(c._craftingShopWarning(recipe),'');
 }
 c._baseShopItems=[{id:'7',price_gp:10}];
 for(const output_qty of [undefined,null,0,-1,1.5,Infinity,'unknown'])assert.equal(c._craftingShopWarning({...recipe,output_qty}),'');
 assert.equal(c._craftingShopWarning({...recipe,output_item_type_id:undefined}),'');
 c._baseShopItems=[];c._shopItems=[{item_type_id:7,price_gp:10}];assert.match(c._craftingShopWarning(recipe),/20 GP for 2/);
});
