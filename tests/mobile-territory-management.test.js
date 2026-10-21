'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../assets',file),'utf8');
const source=read('territory-ui.js');
function fixture(lang='en',owner='COMMANDER'){
 const nodes={},routes=[],reads=[];let created=0;
 function node(id){
  const classes=new Set();return{id,style:{},dataset:{},textContent:'',innerHTML:'',children:[],listeners:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},addEventListener(name,fn){this.listeners[name]=fn;},insertBefore(child){nodes[child.id]=child;this.children.unshift(child);this.firstChild=this.children[0];}};
 }
 for(const id of ['mobInfoBtn','mtCoords','mtOwner','mtGuildRow','mtGuild','mtSize','mtPrice','mtLinkRow','mtImgWrap','mtImgPreview','mtOwnActions','mtOtherActions','mtEditImgLabel','mtHijackBtn','mtLinkInput','mtSellBtn','mobTerritoryModal','mtProdInfo','baseTabTerritory'])nodes[id]=node(id);
 const plot={id:690,claimId:690,owner,lat:1,lng:2,w:5,h:5,price:0,imgUrl:'https://fixture.invalid/existing.png',nickname:'Existing territory'};
 nodes.mobInfoBtn._plot=plot;
 const c={window:{},localStorage:{getItem:()=>lang},walletState:{address:'COMMANDER'},selectedPlot:plot,_forSaleMap:{},document:{getElementById:id=>nodes[id]||null,createElement:()=>{created++;return node('');}},getMyWallet:()=> 'COMMANDER',openBaseModal:()=>routes.push('base'),switchBaseTab:(tab,element)=>routes.push({tab,element}),_territoryReadJson:async(key,url,gap)=>{reads.push({key,url,gap});return{owned:owner==='COMMANDER',condition:100,grade:'B',production:{ppMin:0.005,ppMax:0.25},sector:{type:'frontier'},materials:[]};}};
 vm.createContext(c);vm.runInContext(read('i18n.js'),c);vm.runInContext(read('i18n-sea.js'),c);c.TL_SEA=c.window.TL_SEA;
 vm.runInContext(source.slice(source.indexOf('function hideMobInfoBtn(){'),source.indexOf('function expandMtImg(){')),c);
 return{c,nodes,plot,routes,reads,get created(){return created;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const lang of ['en','ko','ja','zh','id','vi','th'])test('actual mobile territory '+lang+' detail keeps PP-equivalent range and opens existing management with an owned 44px CTA',async()=>{
 const f=fixture(lang);f.c.openMobTerritoryModal();await settle();const button=f.nodes.mtManageTerritoryBtn,html=f.nodes.mtProdInfo.innerHTML;
 assert.ok(button);assert.match(button.style.cssText,/min-height:44px/);assert.ok(button.textContent.length>0);if(lang!=='en')assert.notEqual(button.textContent,'Harvest & production');
 assert.ok(html.includes('0.0050~0.2500 PP'));assert.ok(html.includes('GP'));assert.ok(!html.includes('0.0050~0.2500 GP'));
 if(lang==='en'){assert.ok(html.includes('Harvest estimate (PP equivalent)'));assert.ok(html.includes('harvest pays GP'));}else assert.ok(!html.includes('PP-equivalent estimate;'));
 assert.equal(f.nodes.mtImgPreview.src,f.plot.imgUrl);assert.equal(f.nodes.mtOwner.textContent,'Existing territory');assert.equal(f.nodes.mtPrice.textContent,'0.00 PP');
 assert.deepEqual(f.reads,[{key:'mob-production:690',url:'/api/territory/690/production',gap:8000}]);assert.equal(f.routes.length,0);
 let stopped=false;button.listeners.click({stopPropagation(){stopped=true;}});
 assert.equal(stopped,true);assert.equal(f.nodes.mobTerritoryModal.classList.contains('open'),false);assert.equal(f.routes[0],'base');assert.equal(f.routes[1].tab,'territory');assert.equal(f.routes[1].element,f.nodes.baseTabTerritory);
 assert.equal(f.reads.length,1,'management navigation does not harvest or introduce another API call');assert.equal(button.onclick,undefined);
});
test('other-player territory never gets a management CTA and existing owner actions stay hidden',async()=>{
 const f=fixture('en','OTHER');f.c.openMobTerritoryModal();await settle();assert.equal(f.nodes.mtManageTerritoryBtn,undefined);assert.equal(f.nodes.mtOwnActions.style.display,'none');assert.equal(f.nodes.mtOtherActions.style.display,'');assert.equal(f.routes.length,0);
});
test('mobile management button is reused and verifies current ownership at click time',async()=>{
 const f=fixture();f.c.openMobTerritoryModal();f.c.openMobTerritoryModal();await settle();assert.equal(f.created,1);assert.equal(f.nodes.mtOwnActions.children.length,1);
 const click=()=>f.nodes.mtManageTerritoryBtn.listeners.click({stopPropagation(){}});
 f.c.walletState.address='OTHER';click();assert.equal(f.routes.length,0);
 f.c.walletState.address='COMMANDER';f.c.selectedPlot={...f.plot,owner:'OTHER'};click();assert.equal(f.routes.length,0);
 f.c.selectedPlot=f.plot;delete f.nodes.baseTabTerritory;click();assert.equal(f.routes.length,0);
});
