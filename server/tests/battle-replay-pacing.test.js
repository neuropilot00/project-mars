'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {replayDelayMs,replaySpeed,replayStreamTtlMs}=require('../services/battleReplayPacing');
test('regular and thinned snapshots retain the same eightfold simulation speed',()=>{
 assert.equal(replayDelayMs({t:0},{t:5},200),125);
 assert.equal(replayDelayMs({t:0},{t:80},200),2000);
 assert.equal(replayDelayMs({t:80},{t:83},200),75);
 const frames=[{t:0},{t:80},{t:160},{t:163}];
 assert.equal(frames.reduce((n,f,i)=>n+replayDelayMs(f,frames[i+1],200),0),4085);
});
test('legacy missing or invalid ticks stay bounded and stream lock survives playback',()=>{
 assert.equal(replayDelayMs({}, {},200),125);
 assert.equal(replayDelayMs({t:10},{t:9},0),125);
 assert.equal(replayDelayMs({t:0},null,200),10);
 const frames=Array.from({length:69},(_,i)=>({t:i*80}));
 assert.equal(replayStreamTtlMs(frames,200),196010);
 assert.equal(replayStreamTtlMs([],200),60000);
});

test('very long recordings speed up proportionally while preserving every frame',()=>{
 const frames=Array.from({length:541},(_,i)=>({t:i*100}));const speed=replaySpeed(frames,200);assert.equal(speed,60);
 const elapsed=frames.reduce((n,f,i)=>n+replayDelayMs(f,frames[i+1],200,speed),0);
 assert.ok(elapsed>=180000&&elapsed<180100);assert.equal(replayStreamTtlMs(frames,200),Math.ceil(elapsed+60000));
});
