'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const config=read('assets/app-config.js'),shipyard=read('assets/shipyard-modal.js').match(/^var ASSET_VER = .*;.*$/m)[0];
test('shipyard preserves the actual release fingerprint loaded by the main page',()=>{const c={};c.window=c;vm.createContext(c);vm.runInContext(config,c);const version=c.ASSET_VER;vm.runInContext(shipyard,c);assert.equal(c.ASSET_VER,version);});
test('standalone shipyard retains its art version fallback without the main config',()=>{const c={};vm.createContext(c);vm.runInContext(shipyard,c);assert.equal(c.ASSET_VER,'7509');});
test('main page cache keys load the current config and shipyard instead of prior releases',()=>{const c={window:{}};vm.createContext(c);vm.runInContext(config,c);const html=read('index.html');for(const file of ['app-config','shipyard-modal'])assert.ok(html.includes('/assets/'+file+'.js?v='+c.ASSET_VER));});
