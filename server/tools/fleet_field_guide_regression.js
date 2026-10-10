'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:3187';
 const response=await fetch(origin+'/api/tactical-lab/catalog');assert.equal(response.status,200);const catalog=await response.json();
 let requests=0;
 function node(tag){return {tag,children:[],open:false,style:{},setAttribute(){},appendChild(n){this.children.push(n);},replaceChildren(...n){this.children=n;},querySelector(tag){return this.children.flatMap(n=>[n,...n.children]).find(n=>n.tag===tag);},showModal(){this.open=true;},close(){this.open=false;}};}
 const document={body:node('body'),createElement:node};const window={};
 const ctx=vm.createContext({document,window,LANG:'ko',localStorage:{getItem:()=>null},fetch:async()=>{requests++;return {ok:true,json:async()=>catalog};}});
 const source=fs.readFileSync(path.join(__dirname,'../../assets/fleet-field-guide.js'),'utf8');new vm.Script(source);vm.runInContext(source,ctx);
 assert.equal(requests,0);assert.equal(document.body.children.length,0);await window.openFleetFieldGuide();assert.equal(requests,1);
 const dialog=document.body.children[0];assert.equal(dialog.open,true);const grid=dialog.children[1].children[1];assert.equal(grid.children.length,6);
 const allRoles=new Set();
 for(const card of grid.children){const img=card.children[0];assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');const code=path.basename(img.src,'.png');assert.ok(catalog.ships.some(s=>s.code===code));allRoles.add(catalog.ships.find(s=>s.code===code).role);assert.ok(fs.existsSync(path.join(__dirname,'../..',img.src)));assert.ok(card.children.some(n=>String(n.textContent).includes('HP ')));}
 assert.deepEqual([...allRoles].sort(),['bomb','ewar','logi','sniper','tackle','tank']);await window.openFleetFieldGuide();assert.equal(requests,1);
 dialog.querySelector('button').onclick();assert.equal(dialog.open,false);
 console.log('PASS: live catalog six actual ship roles/art; zero request before guide open; lazy images; real stats; cached reopen; native dialog close.');
})().catch(e=>{console.error(e);process.exitCode=1;});
