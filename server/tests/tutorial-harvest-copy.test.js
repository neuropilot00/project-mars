'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../assets/season-base.js'),'utf8');
function fixture(lang){
 const elements={obOverlay:{style:{display:'none'}},obContent:{innerHTML:''}};let closed=0;
 const context={LANG:lang,_lang:'en',_obState:null,document:{getElementById:id=>elements[id]},_obSetDots:()=>{},closeOnboardingHint:()=>{closed++;},tl:(...copy)=>copy[0]};
 vm.createContext(context);const start=source.indexOf('var _OB_STEPS = {');vm.runInContext(source.slice(start,source.indexOf('async function obNextStep(',start)),context);
 return{context,elements,get closed(){return closed;}};
}
test('actual tutorial harvest renderer follows LANG in seven locales and describes GP plus chance-based minerals',()=>{
 const rendered=[];
 for(const lang of ['en','ko','ja','zh','id','vi','th']){
  const f=fixture(lang);f.context.showOnboardingStep(2);const html=f.elements.obContent.innerHTML;
  assert.match(html,/<b>GP<\/b>/);assert.doesNotMatch(html,/\bPP\b/);assert.match(html,/onclick="obNextStep\(2\)"/);
  assert.equal(f.elements.obOverlay.style.display,'flex');assert.equal(f.closed,1);
  const dictionary=f.context._OB_STEPS[2];assert.ok(dictionary['body_'+lang]);assert.ok(dictionary['next_'+lang]);assert.match(html,new RegExp(dictionary['next_'+lang]));
  rendered.push(dictionary['body_'+lang]);
 }
 assert.equal(new Set(rendered).size,7);
 const ko=fixture('ko');assert.match(ko.context._obStepContent(2),/영토에서 수확하세요/);assert.match(ko.context._obStepContent(2),/확률/);
 const en=fixture('en');assert.match(en.context._obStepContent(2),/not guaranteed with every harvest/);
});
test('visible legacy tutorial overlay blocks competing journey hint without an active class',()=>{
 const social=fs.readFileSync(path.join(__dirname,'../../assets/social-live-modal.js'),'utf8');const f=fixture('ko');let overlayVisible=false;
 f.context.document.querySelector=selector=>{assert.ok(selector.includes('#obOverlay[style*="display: flex"]'));return overlayVisible?f.elements.obOverlay:null;};
 f.elements.obOverlay.classList={contains:()=>false};
 vm.runInContext(social.slice(social.indexOf('function journeyHintIsBlocked()'),social.indexOf('function showJourneyRequestState(')),f.context);
 assert.equal(f.context.journeyHintIsBlocked(),false);f.context.showOnboardingStep(2);overlayVisible=true;assert.equal(f.context.journeyHintIsBlocked(),true);
 const css=fs.readFileSync(path.join(__dirname,'../../assets/utility-overlays.css'),'utf8');assert.ok(css.includes('#obOverlay[style*="display: flex"]'));
});

test('all five existing tutorial steps render explicit seven-language copy with matching markup and unchanged actions',()=>{
 const languages=['en','ko','ja','zh','id','vi','th'];
 const baseline=fixture('en').context._OB_STEPS;
 for(let step=1;step<=5;step++)for(const lang of languages){
  const f=fixture(lang),copy=f.context._OB_STEPS[step];f.context.showOnboardingStep(step);const html=f.elements.obContent.innerHTML;
  for(const field of ['title','body','next']){assert.ok(copy[field+'_'+lang].trim(),step+':'+lang+':'+field);assert.ok(html.includes(copy[field+'_'+lang]));}
  assert.match(html,new RegExp('onclick="obNextStep\\('+step+'\\)"'));
  const tags=value=>value.match(/<[^>]+>/g)||[];assert.deepEqual(tags(copy['body_'+lang]),tags(baseline[step].body_en),step+':'+lang+' markup');
  assert.doesNotMatch(copy['body_'+lang],/\bPP\b/);
 }
 const steps=fixture('en').context._OB_STEPS;
 assert.match(steps[1].body_en,/Choose beginner area/);assert.match(steps[1].body_en,/eligible first small claim/);assert.doesNotMatch(steps[1].body_en,/25|red zone/);
 assert.match(steps[4].body_en,/Base → Command → Missions/);assert.match(steps[4].body_en,/five starting operations/);assert.match(steps[4].body_en,/story campaign is optional/);
});
