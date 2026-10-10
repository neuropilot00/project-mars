(function(){
 'use strict';
 var selected=['mcc_int','fsp_bs','fsp_logi_crs','mcc_ewar','mcc_snp','cv_bomb'];
 // Role matchup factors are from battleEngine.getShipMatchupMult. Faction/doctrine/quality also apply.
 var copy={
  ko:{title:'함대 역할 도감',close:'닫기',loading:'실제 함선 도감을 불러오는 중…',error:'도감을 불러오지 못했습니다. 다시 열어 재시도하세요.',note:'역할 상성의 기본 피해 배율입니다. 진영·교리·품질·방어에 따라 최종 피해가 달라집니다. 지원함은 공격보다 아군 수리가 주 역할입니다.',stat:'기본 능력',roles:{tackle:['요격 / 돌격','전자전·지원·소형 상대 ×1.22','대형·보호 상대 ×0.84'],tank:['방어 / 보호','요격·소형 상대 ×1.12','저격·폭격 상대 ×0.90'],logi:['수리 / 지원','손상 아군을 수리','직접 공격 배율 ×0.72'],ewar:['전자전 / 지원','화력·저격·대형 상대 ×1.18','요격·소형 상대 ×0.82'],sniper:['저격 / 돌격','보호·중대형 상대 ×1.25','요격·소형 상대 ×0.78'],bomb:['폭격 / 돌격','보호·대형 상대 ×1.28','요격·소형 상대 ×0.68']}},
  en:{title:'Fleet field guide',close:'Close',loading:'Loading the real ship catalog…',error:'Catalog unavailable. Reopen to retry.',note:'Base role matchup damage factors. Faction, doctrine, quality and defense change final damage. Logistics ships repair allies rather than act as main attackers.',stat:'Base stats',roles:{tackle:['Interceptor / assault','EW, logistics, small targets ×1.22','Heavy or tank targets ×0.84'],tank:['Tank / protection','Interceptors or small targets ×1.12','Sniper or bomber targets ×0.90'],logi:['Logistics / support','Repairs damaged allies','Direct attack factor ×0.72'],ewar:['Electronic warfare / support','DPS, snipers, heavy targets ×1.18','Interceptors or small targets ×0.82'],sniper:['Sniper / assault','Tank, medium, heavy targets ×1.25','Interceptors or small targets ×0.78'],bomb:['Bomber / assault','Tank or heavy targets ×1.28','Interceptors or small targets ×0.68']}}
 };
 var dialog,content,catalog;
 function lang(){try{return (typeof TLANG!=='undefined'?TLANG:typeof LANG!=='undefined'?LANG:localStorage.getItem('pw_lang'))==='ko'?'ko':'en';}catch(_){return 'en';}}
 function node(tag,text,cls){var n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
 function icon(name){return window.GameIcons?window.GameIcons.render(name,{size:18}):'';}
 function render(ships,c){
  content.replaceChildren();content.appendChild(node('p',c.note,'ffg-note'));
  var grid=node('div',null,'ffg-grid');
  selected.forEach(function(code){
   var ship=ships.find(function(s){return s.code===code;});if(!ship)return;
   var role=c.roles[ship.role];if(!role)return;
   var card=node('article',null,'ffg-card');var img=node('img');img.src='/assets/ships/top/'+code+'.png';img.loading='lazy';img.decoding='async';img.width=96;img.height=96;img.alt=(lang()==='ko'?ship.name_ko:ship.name_en)||code;card.appendChild(img);
   card.appendChild(node('h3',img.alt));var roleLine=node('p',null,'ffg-role');roleLine.innerHTML=icon(ship.role);roleLine.appendChild(node('span',role[0]));card.appendChild(roleLine);card.appendChild(node('p',role[1]));card.appendChild(node('p',role[2],'ffg-counter'));card.appendChild(node('p',c.stat+' · HP '+ship.base_hp+' · ATK '+ship.base_atk+' · DEF '+ship.base_def,'ffg-meta'));grid.appendChild(card);
  });content.appendChild(grid);
 }
 async function openFleetFieldGuide(){
  var c=copy[lang()];
  if(!dialog){dialog=node('dialog',null,'fleet-field-guide');dialog.setAttribute('aria-labelledby','ffg-title');var header=node('div',null,'ffg-header');var title=node('h2');title.id='ffg-title';header.appendChild(title);var close=node('button');close.type='button';close.onclick=function(){dialog.close();};header.appendChild(close);dialog.appendChild(header);content=node('div',null,'ffg-content');dialog.appendChild(content);document.body.appendChild(dialog);}
  dialog.querySelector('h2').textContent=c.title;var closeButton=dialog.querySelector('button');closeButton.innerHTML=icon('close');closeButton.appendChild(node('span',c.close));
  if(!dialog.open)dialog.showModal();content.replaceChildren(node('p',c.loading));
  try{if(!catalog){var response=await fetch('/api/tactical-lab/catalog',{cache:'no-cache'});if(!response.ok)throw new Error('catalog');catalog=(await response.json()).ships;}render(catalog||[],c);}catch(_){content.replaceChildren(node('p',c.error));}
 }
 window.openFleetFieldGuide=openFleetFieldGuide;
})();
