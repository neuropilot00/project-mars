#!/usr/bin/env node
'use strict';
// Execute the actual mobile upload queue, lifecycle helpers and editor handlers without browser/DB.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=process.argv[2]||require('node:path').resolve(__dirname,'../..');
const read=p=>fs.readFileSync(repo+'/'+p,'utf8');
function clock(){let now=10000,id=0;const jobs=new Map();return {jobs,Date:{now:()=>now},setTimeout:(fn,ms)=>{jobs.set(++id,{fn,at:now+ms});return id},clearTimeout:i=>jobs.delete(i),advance(ms){now+=ms;for(const [i,j]of [...jobs])if(j.at<=now){jobs.delete(i);j.fn()}},now:()=>now};}
const c=clock(),listeners={},uploads=[];let canvasState='initial';
const ctx={...c,window:{addEventListener(){}},document:{visibilityState:'visible',addEventListener:(n,fn)=>listeners[n]=fn},console,globe:{globeImageUrl:url=>uploads.push(url)},marsCanvas:{toDataURL:(type,q)=>canvasState+':'+q}};vm.createContext(ctx);
const core=read('assets/core-runtime.js');
vm.runInContext(core.slice(core.indexOf('function _pageIsActive'),core.indexOf('function _activeSleep'))+core.slice(core.indexOf('function _clearActiveTimeout'),core.indexOf('function _clearActiveInterval')),ctx);
const world=read('assets/world-globe.js');assert.ok(world.includes('_queueMobileTextureUpload(previewOnly);'), 'Mobile composite must call the upload queue');vm.runInContext(world.slice(world.indexOf('var _mobileTexPending'),world.indexOf('// Per-user territory color')),ctx);
ctx._queueMobileTextureUpload(false);assert.deepEqual(uploads,['initial:0.92']);
canvasState='preview';ctx._queueMobileTextureUpload(true);assert.equal(c.jobs.size,1);c.advance(160);assert.equal(uploads.at(-1),'preview:0.6');assert.equal(c.jobs.size,0);
canvasState='full';ctx._queueMobileTextureUpload(false);c.advance(60);canvasState='latest-preview';ctx._queueMobileTextureUpload(true);assert.equal(c.jobs.size,1);c.advance(440);assert.equal(uploads.at(-1),'latest-preview:0.92');assert.equal(ctx._activeTimeouts.length,0);
canvasState='early';ctx._queueMobileTextureUpload(true);c.advance(30);canvasState='final';ctx._queueMobileTextureUpload(true);c.advance(130);assert.equal(uploads.at(-1),'final:0.6');assert.equal(c.jobs.size,0);
canvasState='hidden-pending';ctx._queueMobileTextureUpload(false);ctx.document.visibilityState='hidden';listeners.visibilitychange();c.advance(500);assert.notEqual(uploads.at(-1),'hidden-pending:0.92');assert.equal(ctx._activeTimeouts.length,1);ctx.document.visibilityState='visible';listeners.visibilitychange();assert.equal(uploads.at(-1),'hidden-pending:0.92');assert.equal(ctx._activeTimeouts.length,0);assert.equal(c.jobs.size,0);
console.log('PASS texture: immediate/full then preview, latest-state coalescing, full-quality priority, final update, hidden/resume cleanup');
const handlers={},canvas={style:{},addEventListener:(n,fn)=>handlers['canvas:'+n]=fn,getBoundingClientRect:()=>({width:100})};let open=true,draws=0,zooms=[];const hidden=[];
const ed={window:{addEventListener:(n,fn)=>handlers['window:'+n]=fn},document:{getElementById:id=>id==='editorCanvas'?canvas:{classList:{contains:()=>open}},addEventListener:(n,fn)=>handlers[n]=fn},setTimeout:fn=>fn(),_onPageHidden:fn=>hidden.push(fn),_editor:{img:{width:100,height:100},canvasW:100,canvasH:100,ox:0,oy:0,dragging:false},_editorDraw:()=>draws++,editorZoom:n=>zooms.push(n)};vm.createContext(ed);const territory=read('assets/territory-ui.js');vm.runInContext(territory.slice(territory.indexOf('// Drag to move image\n'),territory.indexOf('// File upload for editor')),ed);
function event(touches,x=0,y=0){return{touches,clientX:x,clientY:y,prevented:false,preventDefault(){this.prevented=true}}}const touch=(x,target=canvas)=>({clientX:x,clientY:0,target});
let e=event([touch(0,{}),touch(10,{})]);handlers['window:touchmove'](e);assert.equal(e.prevented,false);assert.equal(zooms.length,0);
e=event([touch(0)]);handlers['canvas:touchstart'](e);e=event([touch(10)]);handlers['window:touchmove'](e);assert.equal(e.prevented,true);assert.equal(draws,1);handlers['window:touchcancel']();e=event([touch(20)]);handlers['window:touchmove'](e);assert.equal(e.prevented,false);assert.equal(ed._editor.dragging,false);
handlers['canvas:touchstart'](event([touch(0),touch(10)]));e=event([touch(0),touch(30)]);handlers['window:touchmove'](e);assert.equal(e.prevented,true);assert.deepEqual(zooms,[3]);e=event([touch(0),touch(40,{})]);handlers['window:touchmove'](e);assert.equal(e.prevented,false);assert.equal(zooms.length,1);hidden[0]();e=event([touch(0),touch(50)]);handlers['window:touchmove'](e);assert.equal(e.prevented,false);
open=false;e=event([touch(0)]);handlers['canvas:touchstart'](e);assert.equal(e.prevented,false);
console.log('PASS editor: unrelated gestures ignored, canvas drag/pinch preserved, mixed-origin pinch ignored, cancellation/page-hide reset, closed editor ignored');
