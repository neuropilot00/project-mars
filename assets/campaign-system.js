// ═══ CAMPAIGN SYSTEM (MVP server simulation) ═══
var _campaignData=null;
var _campaignActive=null;
var _campaignShowLocked=false;
var _campaignScenes=null;
var _campaignSceneIndex=0;
var _campaignTypingTimer=null;
var _campaignEditorLayout=null; // 서버에서 로드한 에디터 레이아웃 캐시
var _campaignTypingDone=false;
var _campaignSceneLineIndex=0;
var _campaignTypingElement=null;
var _campaignTypingFullText='';
var _campaignBattleTimer=null;
var _campaignTypingFrame=null;
var _campaignSimTimer=null;
var _campaignImageCache={};
function loadCampaignStatus(){
  var el=document.getElementById('campaignList');
  var w=walletState.address;
  if(!el) return Promise.resolve();
  if(!w){el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:8px 0">'+tl('Login to view campaign chapters.','로그인하면 캠페인 챕터를 볼 수 있습니다.','ログインするとキャンペーンチャプターを表示できます。','登录后可查看战役章节。')+'</div>';return Promise.resolve();}
  // 파벌 정보가 아직 로드되지 않았으면 먼저 로드한다 — 파벌별 필터링이 정확하게 동작해야 한다.
  var factionPromise=(typeof factionState!=='undefined'&&factionState&&factionState.current!==null)
    ? Promise.resolve()
    : (typeof loadFactions==='function' ? Promise.resolve(loadFactions()).catch(function(){}) : Promise.resolve());
  return factionPromise.then(function(){
    return fetch('/api/campaign/status/'+encodeURIComponent(w))
      .then(function(r){return r.json()})
      .then(function(d){
        _campaignData=d;
        renderCampaignReputation(d.reputation||{},d.tierLabels||{});
        renderCampaignRewardInbox(d.rewardInbox||[]);
        renderCampaignList(d.chapters||[]);
      })
      .catch(function(){
        renderCampaignRewardInbox([]);
        el.innerHTML='<div style="font-size:9px;color:var(--mars);padding:8px 0">'+tl('Campaign unavailable.','캠페인을 불러올 수 없습니다.','キャンペーンを読み込めません。','无法加载战役。')+'</div>';
      });
  });
}

// [v7.172 D-Crit-2/3 fix] 캠페인 프로필 모달 — 칭호 장착 + 평판 history.
//   백엔드 /api/tags/:wallet, /api/tags/set-active-title, /api/reputation/history/:wallet 완비됐는데 UI 0건이었음.
//   이 한 모달이 두 가지를 다 처리: TITLES 탭(보유 칭호 클릭→활성), HISTORY 탭(최근 30건 평판 변동).
function openCampaignProfileModal(){
  if (typeof isLoggedIn === 'function' && !isLoggedIn()){
    showFactionToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  var w = (walletState && walletState.address) || '';
  if (!w) { showToast(tl('Wallet not ready','지갑이 준비되지 않았습니다','ウォレットが準備できていません','钱包尚未就绪'), 'error'); return; }
  var old = document.getElementById('campaignProfileModal'); if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'campaignProfileModal';
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  // [v7.215] iOS phantom-click 가드 — backdrop close 가 모달 open 350ms 안엔 무시.
  el.dataset.openedAt = String(Date.now());
  el.onclick = function(e){
    if (e.target !== el) return; // inner 클릭은 무시
    if (Date.now() - parseInt(el.dataset.openedAt || '0', 10) < 350) return; // phantom-click
    el.remove();
  };
  el.innerHTML =
    // [v7.215] inner card 에 stopPropagation — 자식 클릭이 el.onclick 까지 버블되지 않게 명시.
    '<div onclick="event.stopPropagation()" style="position:relative;width:min(540px,94vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;border-radius:14px;background:radial-gradient(circle at 50% 0%,rgba(184,140,255,.18),rgba(10,12,22,.98) 65%);border:1.5px solid rgba(184,140,255,.55);box-shadow:0 0 30px rgba(184,140,255,.25),0 18px 60px rgba(0,0,0,.7);padding:18px;animation:crPop .3s cubic-bezier(.2,1.3,.5,1)">'
    +   '<div style="text-align:center;font-size:14px;font-weight:900;letter-spacing:1.5px;color:#caa8ff">🎖 '+tl('CAMPAIGN PROFILE','캠페인 프로필','キャンペーンプロフィール','战役档案')+'</div>'
    +   '<div style="display:flex;gap:6px;margin-top:12px">'
    +     '<button id="cpTabTitles" onclick="_cpSwitchTab(\'titles\')" style="flex:1;padding:9px;border-radius:7px;background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.5);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">🎖 '+tl('TITLES','칭호','称号','称号')+'</button>'
    +     '<button id="cpTabHistory" onclick="_cpSwitchTab(\'history\')" style="flex:1;padding:9px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">📜 '+tl('REP HISTORY','평판 이력','評判履歴','声誉历史')+'</button>'
    +   '</div>'
    +   '<div id="cpTitlesPane" style="margin-top:13px;overflow-y:auto;max-height:50vh"><div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px">'+tl('Loading...','로딩 중...','読み込み中...','加载中...')+'</div></div>'
    +   '<div id="cpHistoryPane" style="display:none;margin-top:13px;overflow-y:auto;max-height:50vh"></div>'
    +   '<button type="button" onclick="document.getElementById(\'campaignProfileModal\').remove()" style="margin-top:13px;width:100%;padding:11px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">'+tl('CLOSE','닫기','閉じる','关闭')+'</button>'
    + '</div>';
  document.body.appendChild(el);
  _cpLoadTitles(w);
}
function _cpSwitchTab(tab){
  var t = document.getElementById('cpTabTitles'), h = document.getElementById('cpTabHistory');
  var tp = document.getElementById('cpTitlesPane'), hp = document.getElementById('cpHistoryPane');
  if (!t||!h||!tp||!hp) return;
  var active = 'background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.5);color:#fff';
  var inactive = 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7)';
  if (tab==='titles'){
    t.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+active;
    h.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+inactive;
    tp.style.display=''; hp.style.display='none';
  } else {
    h.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+active;
    t.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+inactive;
    hp.style.display=''; tp.style.display='none';
    var w = (walletState && walletState.address) || '';
    if (w && !hp.dataset.loaded) _cpLoadHistory(w);
  }
}
function _cpLoadTitles(w){
  fetch('/api/tags/'+encodeURIComponent(w), { headers: getAuthHeaders() })
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      var pane = document.getElementById('cpTitlesPane'); if (!pane) return;
      if (!d) { pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; return; }
      var tags = (d.tags || d.list || []);
      var active = d.activeTitle || d.active_title || null;
      if (!tags.length) {
        pane.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px;line-height:1.6">'+tl('No titles yet.','아직 받은 칭호가 없습니다.','まだ称号がありません。','尚无称号。')+'<br><span style="color:rgba(255,255,255,.3);font-size:9px">'+tl('Complete campaign chapters to earn titles.','캠페인 챕터를 완료하면 칭호를 받습니다.','キャンペーンを完了すると獲得できます。','完成战役章节可获得称号。')+'</span></div>';
        return;
      }
      // [v7.211] inline onclick 깨짐 위험 차단 — data-* + delegated listener (영토 업그레이드와 동일 패턴).
      //   사용자 보고: '장착 눌러도 반응 없음'. 트랙 키 escape edge case 가능성.
      pane.innerHTML = tags.map(function(tag){
        var id = tag.tag_id || tag.id || tag.code || '';
        var label = tag.label || tag.name || tag.tag_label || id;
        var isActive = (active === id);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-radius:8px;background:'+(isActive?'rgba(184,140,255,.16)':'rgba(255,255,255,.04)')+';border:1px solid '+(isActive?'rgba(184,140,255,.55)':'rgba(255,255,255,.08)')+';margin-bottom:5px">'
          + '<div><div style="font-size:11px;font-weight:800;color:'+(isActive?'#caa8ff':'#fff')+'">🎖 '+escapeHtmlSafe(label)+(isActive?' <span style="font-size:9px;color:#69f0ae">'+tl('· ACTIVE','· 활성','· 装着中','· 已装备')+'</span>':'')+'</div>'
          + (tag.description?'<div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:2px">'+escapeHtmlSafe(tag.description)+'</div>':'')
          + '</div>'
          + (isActive
              ? '<button type="button" data-cp-action="unequip" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.6);font-family:var(--fn);cursor:pointer">'+tl('Unequip','해제','解除','卸下')+'</button>'
              : '<button type="button" data-cp-action="equip" data-cp-tag-id="'+escapeHtmlSafe(id)+'" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.45);color:#fff;font-family:var(--fn);cursor:pointer">'+tl('Equip','장착','装着','装备')+'</button>')
          + '</div>';
      }).join('');
      // [v7.211] delegated click listener — 모든 장착/해제 버튼 한 번에 처리.
      pane.onclick = function(ev){
        var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-cp-action]') : null;
        if (!btn || !pane.contains(btn)) return;
        ev.stopPropagation();
        var action = btn.getAttribute('data-cp-action');
        var tagId = btn.getAttribute('data-cp-tag-id') || '';
        console.log('[BTN] title action', action, tagId);
        if (action === 'unequip') _cpSetActiveTitle('');
        else if (action === 'equip' && tagId) _cpSetActiveTitle(tagId);
      };
    })
    .catch(function(){ var pane = document.getElementById('cpTitlesPane'); if (pane) pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; });
}
function _cpSetActiveTitle(tagId){
  fetch('/api/tags/set-active-title', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()), body: JSON.stringify({ tag_id: tagId || null }) })
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d || d.error) { showToast(d&&d.error || tl('Failed','실패','失敗','失败'), 'error'); return; }
      showToast(tagId?tl('Title equipped','칭호 장착됨','称号装着','称号已装备'):tl('Title removed','칭호 해제됨','称号解除','称号已卸下'),'success');
      var w = (walletState && walletState.address) || ''; if (w) _cpLoadTitles(w);
    })
    .catch(function(){ showToast(tl('Failed','실패','失敗','失败'),'error'); });
}
function _cpLoadHistory(w){
  fetch('/api/reputation/history/'+encodeURIComponent(w), { headers: getAuthHeaders() })
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      var pane = document.getElementById('cpHistoryPane'); if (!pane) return;
      pane.dataset.loaded = '1';
      var hist = (d && d.history) || [];
      if (!hist.length) {
        pane.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px">'+tl('No reputation changes yet.','아직 평판 변동이 없습니다.','評判の変動がありません。','尚无声誉变动。')+'</div>';
        return;
      }
      var facColor = { mcc:'#4fc3f7', fsp:'#81c784', cv:'#ef5350', pilgrim_arms:'#c08bff' };
      var facLabel = { mcc:'MCC', fsp:'FSP', cv:'CV', pilgrim_arms:'Pilgrim Arms' };
      pane.innerHTML = hist.map(function(h){
        var col = facColor[h.faction] || '#fff';
        var lbl = facLabel[h.faction] || h.faction;
        var sign = (h.delta > 0) ? '+' : '';
        var sCol = (h.delta > 0) ? '#69f0ae' : (h.delta < 0 ? '#ff5252' : '#fff');
        var src = h.source_type ? (h.source_type + (h.source_id ? (' · '+h.source_id) : '')) : '';
        var when = h.created_at ? new Date(h.created_at).toLocaleString() : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:4px">'
          + '<div><div style="font-size:10px;font-weight:800;color:'+col+'">'+lbl+'</div>'
          +   (src?'<div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:1px">'+escapeHtmlSafe(src)+'</div>':'')
          +   (when?'<div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:1px">'+when+'</div>':'')
          + '</div>'
          + '<div style="font-size:13px;font-weight:900;color:'+sCol+'">'+sign+h.delta+'</div>'
          + '</div>';
      }).join('');
    })
    .catch(function(){ var pane = document.getElementById('cpHistoryPane'); if (pane) pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; });
}

function renderCampaignReputation(rep,tiers){
  // [v7.170 D-Crit-1 fix] Pilgrim Arms 평판 추가 — campaign.js FACTIONS=['mcc','fsp','cv','pilgrim_arms'] 4종.
  //   기존엔 3종만 순회해 보상으로 받은 pilgrim_arms 평판이 UI에서 안 보였음. Ending 4 분기 추적 가능해짐.
  var el=document.getElementById('campaignReputation');
  if(!el) return;
  var colors={mcc:'#4fc3f7',fsp:'#81c784',cv:'#ef5350',pilgrim_arms:'#c08bff'};
  var labels={mcc:'MCC',fsp:'FSP',cv:'CV',pilgrim_arms:'Pilgrim Arms'};
  var html='<div class="campaign-rep">';
  ['mcc','fsp','cv','pilgrim_arms'].forEach(function(f){
    if (rep[f] === undefined && f === 'pilgrim_arms') return; // 응답에 pilgrim_arms 없으면 행 자체 생략(legacy 호환)
    var v=parseInt(rep[f]||0,10);
    var pct=Math.max(0,Math.min(100,v+100)/2);
    html+='<div class="campaign-rep-item"><div class="campaign-rep-top"><span>'+labels[f]+'</span><span>'+v+' · '+escapeHtmlSafe(tiers[f]||'Neutral')+'</span></div><div class="campaign-rep-track"><div class="campaign-rep-fill" style="width:'+pct+'%;background:'+colors[f]+'"></div></div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function campaignRewardLabel(r){
  var p=(r&&r.payload&&typeof r.payload==='object')?r.payload:{};
  return p.label||p.labelKo||r.reward_code||tl('Campaign Reward','캠페인 보상','キャンペーン報酬','战役奖励');
}
function campaignRewardTypeLabel(type){
  var maps={
    ko:{ship:'함선',ship_fleet:'함대',ship_blueprint:'설계도',ship_choice:'함선 선택권',resource:'자원',resource_stream:'자원 계약',gp_stream:'GP 계약',data_artifact:'데이터',asset:'자산',permanent_buff:'영구 효과',title_position:'칭호',safe_house_access:'권한'},
    ja:{ship:'艦船',ship_fleet:'艦隊',ship_blueprint:'設計図',ship_choice:'艦船選択',resource:'資源',resource_stream:'資源契約',gp_stream:'GP契約',data_artifact:'データ',asset:'資産',permanent_buff:'永久効果',title_position:'称号',safe_house_access:'アクセス権'},
    zh:{ship:'舰船',ship_fleet:'舰队',ship_blueprint:'设计图',ship_choice:'舰船选择权',resource:'资源',resource_stream:'资源合约',gp_stream:'GP合约',data_artifact:'数据',asset:'资产',permanent_buff:'永久效果',title_position:'称号',safe_house_access:'访问权限'},
    en:{ship:'Ship',ship_fleet:'Fleet',ship_blueprint:'Blueprint',ship_choice:'Ship Choice',resource:'Resource',resource_stream:'Resource Contract',gp_stream:'GP Contract',data_artifact:'Data Artifact',asset:'Asset',permanent_buff:'Permanent Buff',title_position:'Title',safe_house_access:'Access'}
  };
  var lang=(typeof LANG!=='undefined'?LANG:'en');
  var map=maps[lang]||maps.en;
  return map[type]||String(type||(lang==='ko'?'보상':lang==='ja'?'報酬':lang==='zh'?'奖励':'Reward'));
}
function renderCampaignRewardInbox(inbox){
  var el=document.getElementById('campaignRewardInbox');
  if(!el) return;
  if(!Array.isArray(inbox)||!inbox.length){el.innerHTML='';return;}
  // [v7.168] inbox 표시 한도 4→12 (서버 LIMIT 20 — 5건 이상도 노출). 스크롤 가능 컨테이너.
  var html='<div class="campaign-reward-inbox" style="max-height:340px;overflow-y:auto">';
  inbox.slice(0,12).forEach(function(r){
    var id=parseInt(r.id,10)||0;
    var qty=parseInt(r.quantity,10)||1;
    var type=campaignRewardTypeLabel(r.reward_type);
    var label=campaignRewardLabel(r);
    html+='<div class="campaign-reward-card">';
    html+='<div><div class="campaign-reward-label">🎁 '+escapeHtmlSafe(label)+(qty>1?' ×'+qty:'')+'</div><div class="campaign-reward-meta">'+escapeHtmlSafe(type)+' · '+escapeHtmlSafe(r.quest_id||'campaign')+'</div></div>';
    html+='<button class="campaign-reward-claim" onclick="claimCampaignReward('+id+',this)">'+(LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim')+'</button>';
    html+='</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

async function claimCampaignReward(id,btn){
  if(!isLoggedIn()){showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');return;}
  if(!id){showToast(LANG==='ko'?'보상 정보가 없습니다':LANG==='ja'?'報酬情報がありません':LANG==='zh'?'没有奖励信息':'No reward info','error');return;}
  var _claimWallet=(walletState&&walletState.address)||getMyWallet();
  if(!_claimWallet){showFactionToast(LANG==='ko'?'지갑을 연결해주세요':LANG==='ja'?'ウォレットを接続してください':LANG==='zh'?'请先连接钱包':'Connect wallet first','error');return;}
  if(btn){btn.disabled=true;btn.textContent=LANG==='ko'?'수령중':LANG==='ja'?'受取中':LANG==='zh'?'领取中':'Claiming';}
  try{
    var r=await fetch('/api/campaign/reward/claim',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:_claimWallet,reward_id:id})
    });
    var d=await r.json().catch(function(){return {};});
    if(!r.ok||d.error) throw new Error(d.error||'claim failed');
    var _aLabels={ship:LANG==='ko'?'함선 ':LANG==='ja'?'艦船 ':LANG==='zh'?'舰船 ':'Ship ',resource:LANG==='ko'?'자원 ':LANG==='ja'?'資源 ':LANG==='zh'?'资源 ':'Resource ',item:LANG==='ko'?'아이템 ':LANG==='ja'?'アイテム ':LANG==='zh'?'道具 ':'Item '};
    var noteMsg=d.note||(d.applied&&d.applied.length?d.applied.map(function(a){return((_aLabels[a.kind]||'')+a.code+(a.quantity&&a.quantity>1?' ×'+a.quantity:''));}).join(', '):(LANG==='ko'?'캠페인 보상을 수령했습니다':LANG==='ja'?'キャンペーン報酬を受け取りました':LANG==='zh'?'已领取活动奖励':'Campaign reward claimed'));
    showToast(noteMsg,'success');
    await loadCampaignStatus();
    try{loadInventory&&loadInventory();}catch(_){}
    try{loadResourceInventory&&loadResourceInventory();}catch(_){}
  }catch(e){
    showToast((LANG==='ko'?'보상 수령 실패: ':LANG==='ja'?'報酬受取失敗: ':LANG==='zh'?'领取奖励失败: ':'Claim failed: ')+(e&&e.message?e.message:(LANG==='ko'?'오류':LANG==='ja'?'エラー':LANG==='zh'?'错误':'error')),'error');
    if(btn){btn.disabled=false;btn.textContent=LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim';}
  }
}

function campaignProgressStatus(progress){
  var p=progress||{};
  return String(p.status||p.state||'').trim().toLowerCase();
}
function isCampaignProgressDone(progress){
  var st=campaignProgressStatus(progress);
  return st==='completed'||st==='claimed'||!!(progress&&progress.completedAt);
}
function isCampaignProgressActive(progress){
  return campaignProgressStatus(progress)==='in_progress';
}
function campaignStatusLabel(progress,fallback){
  return campaignProgressStatus(progress)||fallback||'new';
}
function campaignBranchLabel(id){
  var map={
    mcc_route_a_active:'MCC Branch A',
    mcc_route_b_active:'MCC Branch B',
    mcc_route_c_active:'MCC Branch C',
    ending_1_pathway_aligned:'FSP Ending 1 path',
    ending_1_pathway_strengthened:'FSP Ending 1 path',
    ending_2_pathway_aligned:'FSP Ending 2 path',
    ending_2_pathway_strengthened:'FSP Ending 2 path',
    ending_2_alt_path_cv_alliance:'FSP-CV alliance path',
    gaia_captain_offer_unlocked:'Gaia Captain offer',
    ending_3_pathway_unlocked:'FSP Ending 3 path',
    ending_3_pathway_unavoidable:'FSP Ending 3 path',
    ending_3_pathway_strengthened:'FSP Ending 3 path',
    ending_4_pathway_unlocked:'FSP Ending 4 path',
    ending_4_pathway_unavoidable:'FSP Ending 4 path',
    ending_4_pathway_strengthened:'FSP Ending 4 path'
  };
  return map[id]||String(id||'route');
}
function campaignLockedReason(ch){
  if(ch&&ch.lockReason&&ch.lockReason.error) return campaignStartErrorMessage(ch,ch.lockReason);
  var data=_campaignData||{};
  var rep=data.reputation||{};
  var completed=data.completedChapters||[];
  var tags=data.tags||[];
  var branchRows=data.branchModifiers||[];
  var branchIds=[];
  branchRows.forEach(function(b){var id=b&&((b.modifier_id)||(b.modifier_key));if(id&&branchIds.indexOf(id)<0)branchIds.push(id);});
  var missingRep=Object.entries(ch.requiredReputation||{}).filter(function(pair){return (parseInt(rep[pair[0]]||0,10)||0)<pair[1];});
  if(missingRep.length){
    var mr=missingRep[0], f=String(mr[0]||'').toUpperCase();
    return LANG==='ko'?f+' 평판 '+mr[1]+' 필요':LANG==='ja'?f+' 評判 '+mr[1]+' が必要':LANG==='zh'?'需要 '+f+' 声望 '+mr[1]:'Requires '+f+' reputation '+mr[1];
  }
  if(ch.prerequisiteChapter&&completed.indexOf(ch.prerequisiteChapter)<0){
    return LANG==='ko'?'선행 챕터 완료 필요':LANG==='ja'?'前提チャプター完了が必要':LANG==='zh'?'需要先完成前置章节':'Complete the prerequisite chapter';
  }
  var blocking=(ch.blockingTags||[]).filter(function(t){return tags.indexOf(t)>=0;});
  if(blocking.length){
    return LANG==='ko'?'현재 태그로 차단됨: '+blocking[0]:LANG==='ja'?'現在のタグでブロック: '+blocking[0]:LANG==='zh'?'当前标签阻止: '+blocking[0]:'Blocked by current tag: '+blocking[0];
  }
  var requiredBranches=ch.requiredBranchAny||[];
  if(requiredBranches.length&&!requiredBranches.some(function(b){return branchIds.indexOf(b)>=0;})){
    var label=requiredBranches.slice(0,2).map(campaignBranchLabel).join(' / ');
    return LANG==='ko'?'필요 분기: '+label:LANG==='ja'?'必要ルート: '+label:LANG==='zh'?'需要路线: '+label:'Requires route: '+label;
  }
  return LANG==='ko'?'시작 조건 미충족':LANG==='ja'?'開始条件未達':LANG==='zh'?'未满足开始条件':'Start requirements not met';
}

function renderCampaignList(chapters){
  var el=document.getElementById('campaignList');
  if(!el) return;
  // 파벌 필터 — 유저가 속한 파벌의 시나리오만 노출한다.
  // 파벌 미선택 상태에서는 안내 카드만 보여 다른 루트가 노출되지 않도록 한다.
  var myFaction=(typeof factionState!=='undefined'&&factionState&&factionState.current&&factionState.current.code)?factionState.current.code:null;
  if(!myFaction){
    el.innerHTML='<div style="font-size:10px;color:var(--gold);padding:14px;border:1px dashed rgba(255,209,102,.35);border-radius:8px;line-height:1.7">'+t('campaign_no_faction')+'</div>';
    return;
  }
  var visible=chapters.filter(function(c){
    if(!c||!c.faction) return false;
    if(c.faction==='hidden') return false; // 히든 루트는 별도 조건으로만 공개
    return c.faction===myFaction;
  });
  if(!visible.length){el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:8px 0">'+t('campaign_no_chapters')+'</div>';return;}
  var html='';
  var lockedHtml='';
  var lockedCount=0;
  visible.forEach(function(ch){
    var p=ch.progress||{};
    var pSt=campaignProgressStatus(p);
    var failed=pSt==='failed';
    var locked=((_campaignData&&_campaignData.lockedChapters)||[]).indexOf(ch.questId)>=0;
    var done=isCampaignProgressDone(p);
    var active=isCampaignProgressActive(p);
    var title=_campaignStoryText(ch.title)||ch.questId;
    var _lang=(typeof LANG!=='undefined'?LANG:'ko');
    var retryLabel=_lang==='ko'?'🔄 재도전':(_lang==='ja'?'🔄 再挑戦':(_lang==='zh'?'🔄 重试':'🔄 RETRY'));
    var btn=locked?t('campaign_btn_locked'):(done?t('campaign_btn_results'):(active?t('campaign_btn_continue'):(failed?retryLabel:t('campaign_btn_start'))));
    var route=((ch.campaignId||'').replace('_route','')||ch.faction||'').toUpperCase();
    var card='';
    if(locked){
      lockedCount++;
      var lockedReason=campaignLockedReason(ch);
      card+='<div class="campaign-card compact">';
      card+='<div class="campaign-icon">⚡</div><div class="campaign-top"><div style="flex:1;min-width:0"><div class="campaign-meta">'+route+' · '+t('campaign_label_ch')+' '+ch.chapterNumber+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
      card+='<button class="campaign-btn secondary" disabled style="opacity:.55;cursor:not-allowed">'+btn+'</button>';
      card+='<div class="campaign-lock-reason">🔒 '+escapeHtmlSafe(lockedReason)+'</div>';
      card+='</div>';
      lockedHtml+=card;
      return;
    }
    if(done){
      var doneChapterLabel=Number(ch.chapterNumber)===0?t('campaign_label_prologue'):t('campaign_label_ch')+' '+ch.chapterNumber;
      card+='<div class="campaign-card compact done">';
      card+='<div class="campaign-icon">✓</div><div class="campaign-top"><div style="flex:1;min-width:0"><div class="campaign-meta">'+route+' '+t('campaign_label_route')+' · '+doneChapterLabel+' · '+t('campaign_label_completed')+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
      card+='<button class="campaign-btn secondary" onclick="openCampaignChapter(\''+ch.questId+'\')">'+t('campaign_btn_results')+'</button>';
      card+='</div>';
      html+=card;
      return;
    }
    card+='<div class="campaign-card'+(failed?' failed':'')+'">';
    card+='<div class="campaign-top"><div class="campaign-icon">'+(failed?'✗':'⚡')+'</div><div style="flex:1"><div class="campaign-meta">'+route+' '+t('campaign_label_route')+' · '+t('campaign_label_ch')+' '+ch.chapterNumber+(failed?' · <span style="color:var(--mars);font-weight:800">'+(_lang==='ko'?'임무 실패':'FAILED')+'</span>':'')+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
    var _locLang=(typeof LANG!=='undefined'?LANG:'ko');
    var _locDisplay=ch.location&&(_campaignStoryText(ch.location.displayName)||((_locLang!=='ko'&&ch.location.displayNameEn)||ch.location.displayNameKo));
    card+='<div class="campaign-desc">'+escapeHtmlSafe(_locDisplay||'Mars')+'</div>';
    card+=campaignObjectivesHtml(ch,3);
    if(done||active||failed){
      var m=p.metrics||{};
      card+=campaignStatsHtml(m,campaignStatusLabel(p,'NEW'));
    }
    card+='<button class="campaign-btn'+(failed?' secondary':'')+'" style="'+(failed?'background:rgba(255,80,30,.15);border-color:rgba(255,80,30,.4);color:var(--mars)':'')+'" onclick="openCampaignChapter(\''+ch.questId+'\')">'+btn+'</button>';
    card+='</div>';
    html+=card;
  });
  if(lockedCount){
    html+='<button class="campaign-locked-toggle" onclick="toggleCampaignLockedList()">'+(_campaignShowLocked?t('campaign_hide_locked'):t('campaign_show_locked'))+' · '+lockedCount+'</button>';
    if(_campaignShowLocked) html+=lockedHtml;
  }
  el.innerHTML=html;
}

function toggleCampaignLockedList(){
  _campaignShowLocked=!_campaignShowLocked;
  renderCampaignList((_campaignData&&_campaignData.chapters)||[]);
}

function openCampaignHub(){
  openBaseModal();
  setTimeout(function(){
    var tab=document.getElementById('baseTabQuests');
    switchBaseTab('quests',tab);
    try{clearBaseTabDot('quests')}catch(_){}
    loadCampaignStatus().then(function(){
      var panel=document.getElementById('campaignPanel');
      if(panel) panel.scrollIntoView({block:'start',behavior:'smooth'});
    });
  },0);
}

function _findCampaignChapter(questId){
  var arr=(_campaignData&&_campaignData.chapters)||[];
  for(var i=0;i<arr.length;i++) if(arr[i].questId===questId) return arr[i];
  return null;
}
function campaignStatsHtml(m,status){
  var a=m.oxygen_recovery_pct!=null?{v:m.oxygen_recovery_pct+'%',l:'OXYGEN'}:
    m.facility_hp_percent!=null?{v:m.facility_hp_percent+'%',l:'FACILITY'}:
    m.subsidiary_target?{v:String(m.subsidiary_target).toUpperCase(),l:'TARGET'}:
    m.helion_destroyed!=null?{v:m.helion_destroyed+'/14',l:'RAID'}:{v:'--',l:'METRIC'};
  var b=m.ships_destroyed!=null?{v:m.ships_destroyed+'/9',l:'SHIPS'}:
    m.militia_destroyed!=null?{v:m.militia_destroyed+'/4',l:'MILITIA'}:
    m.eclipse_kill_count!=null?{v:m.eclipse_kill_count,l:'ECLIPSE'}:
    m.helion_escapes!=null?{v:m.helion_escapes,l:'ESCAPED'}:{v:'--',l:'RESULT'};
  return '<div class="campaign-stats"><div class="campaign-stat"><b>'+escapeHtmlSafe(String(a.v))+'</b><span>'+a.l+'</span></div><div class="campaign-stat"><b>'+escapeHtmlSafe(String(b.v))+'</b><span>'+b.l+'</span></div><div class="campaign-stat"><b>'+escapeHtmlSafe(String(status).toUpperCase())+'</b><span>STATUS</span></div></div>';
}
function campaignObjectivesHtml(ch,limit){
  var objectives=(ch&&Array.isArray(ch.objectives))?ch.objectives:[];
  if(!objectives.length) return '';
  var list=objectives.slice(0,limit||3);
  // [v7.222 upgrade #5] objective 진행률 바 + 다음 목표 힌트 — 초반 이탈 방지, 완료율 가시화.
  var _doneN=objectives.filter(function(o){return o.state==='done';}).length;
  var _totN=objectives.length;
  var _pct=_totN?Math.round(_doneN/_totN*100):0;
  var _next=objectives.find(function(o){return o.state!=='done';});
  var _lang5=(typeof LANG!=='undefined'?LANG:'ko');
  var _nextLbl=_next?(_campaignStoryText(_next.label)||_next.labelKo||_next.label||''):'';
  var html='';
  html+='<div style="margin:6px 0 4px">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
  html+='<span style="font-size:8px;color:var(--tx3);letter-spacing:.5px">'+(_lang5==='ko'?'작전 진행도':_lang5==='ja'?'作戦進行度':_lang5==='zh'?'作战进度':'PROGRESS')+'</span>';
  html+='<span style="font-size:9px;font-weight:800;color:'+(_pct>=100?'#69f0ae':'#ffd166')+'">'+_doneN+'/'+_totN+' · '+_pct+'%</span>';
  html+='</div>';
  html+='<div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+_pct+'%;background:linear-gradient(90deg,#ffd166,#ff9030);border-radius:3px;transition:width .4s"></div></div>';
  if(_next&&_nextLbl){
    html+='<div style="font-size:8px;color:#ffab40;margin-top:3px">▶ '+(_lang5==='ko'?'다음: ':_lang5==='ja'?'次: ':_lang5==='zh'?'下一步: ':'Next: ')+escapeHtmlSafe(_nextLbl)+'</div>';
  }
  html+='</div>';
  html+='<div class="campaign-objectives">';
  list.forEach(function(o){
    var state=o.state||'pending';
    var icon=state==='done'?'✓':(state==='active'?'▶':'•');
    var count=(o.current!=null&&o.target!=null)?'<span class="co-count">'+escapeHtmlSafe(String(o.current))+'/'+escapeHtmlSafe(String(o.target))+'</span>':'';
    var action=campaignObjectiveActionTarget(o.action);
    var actionable=state!=='done'&&!!action;
    var attrs=actionable?' actionable" onclick="handleCampaignObjectiveAction(event,\''+action+'\')"':'"';
    var actionHtml=actionable?'<span class="co-action">'+campaignObjectiveActionLabel(action)+'</span>':'';
    var _oLabel=_campaignStoryText(o.label)||o.labelKo||o.label||o.id||tl('Objective','목표','目標','目标');
    // [depth #B] 완료된 objective 에 서버가 reputation/reward 메타를 줄 때만 '★ 평판 +N' 미니 라벨.
    // 서버 메타가 없으면 라벨 생략 — 임의 수치 날조 금지.
    var repHtml=(state==='done')?_campaignObjectiveRepLabel(o):'';
    html+='<div class="campaign-objective '+state+attrs+'><span class="co-dot">'+icon+'</span><span class="co-label">'+escapeHtmlSafe(_oLabel)+'</span>'+count+repHtml+actionHtml+'</div>';
  });
  html+='</div>';
  return html;
}
// [depth #B] objective 에 서버가 내려준 평판 보상 수치가 있을 때만 미니 라벨을 만든다.
// 지원 필드(읽기 전용): o.reputation / o.reputationReward / o.repReward / o.reward.reputation (숫자).
// 어떤 필드도 숫자가 아니면 빈 문자열을 반환 — 수치를 만들어내지 않는다.
function _campaignObjectiveRepLabel(o){
  if(!o||typeof o!=='object') return '';
  var v=null;
  var cand=[o.reputation,o.reputationReward,o.repReward,(o.reward&&o.reward.reputation)];
  for(var i=0;i<cand.length;i++){
    var n=cand[i];
    if(typeof n==='number'&&isFinite(n)&&n!==0){ v=n; break; }
  }
  if(v==null) return '';
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  var word=lang==='ko'?'평판':lang==='ja'?'評判':lang==='zh'?'声望':'REP';
  var sign=v>0?'+':'';
  return '<span class="co-rep" style="margin-left:6px;font-size:8px;font-weight:800;color:#ffd166;white-space:nowrap">★ '+escapeHtmlSafe(word)+' '+sign+escapeHtmlSafe(String(v))+'</span>';
}
function campaignObjectiveActionTarget(action){
  var map={territory:'territory',territory_art:'territory',shipyard:'shipyard',fleet:'fleet',fleet_battle:'battle',market:'market'};
  return map[action]||'';
}
function campaignObjectiveActionLabel(action){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  if(lang==='ko'){
    var mapKo={territory:'영토 확인',territory_art:'영토 확인',shipyard:'함선 준비',fleet:'함대 편성',fleet_battle:'전투 진입',market:'마켓 확인'};
    return mapKo[action]||t('campaign_objective_go');
  }
  if(lang==='ja'){
    var mapJa={territory:'領地確認',territory_art:'領地確認',shipyard:'艦船準備',fleet:'艦隊編成',fleet_battle:'戦闘開始',market:'マーケット確認'};
    return mapJa[action]||t('campaign_objective_go');
  }
  if(lang==='zh'){
    var mapZh={territory:'查看领地',territory_art:'查看领地',shipyard:'准备舰船',fleet:'编成舰队',fleet_battle:'进入战斗',market:'查看市场'};
    return mapZh[action]||t('campaign_objective_go');
  }
  var map={territory:'CHECK TERRITORY',territory_art:'CHECK TERRITORY',shipyard:'PREP SHIPS',fleet:'FORM FLEET',fleet_battle:'ENTER BATTLE',market:'CHECK MARKET'};
  return map[action]||t('campaign_objective_go');
}
function handleCampaignObjectiveAction(ev,action){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(!isLoggedIn()){showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');return;}
  closeCampaignModal();
  if(action==='territory'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabTerritory');
      switchBaseTab('territory',tab);
      showToast(LANG==='ko'?'영토 화면에서 목표를 진행하세요':LANG==='ja'?'領地画面で目標を進めてください':LANG==='zh'?'请在领地界面推进目标':'Continue the objective from your territory','info');
    },0);
  }else if(action==='shipyard'){
    openShipyard();
    setTimeout(function(){try{switchSyTab('blueprints')}catch(_){}},0);
  }else if(action==='fleet'){
    openFleetCmd();
  }else if(action==='battle'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabPvp');
      switchBaseTab('pvp',tab);
      try{openBattleHub()}catch(_){showToast(LANG==='ko'?'함대전을 열고 전투 목표를 진행하세요':LANG==='ja'?'艦隊戦を開いて戦闘目標を進めてください':LANG==='zh'?'请打开舰队战并推进战斗目标':'Open fleet battle and continue the combat objective','info');}
    },0);
  }else if(action==='market'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabMarket');
      switchBaseTab('market',tab);
      try{loadMarketTab()}catch(_){}
    },0);
  }
}
function _campaignClearSimTimer(){
  if(_campaignSimTimer) _clearActiveTimeout(_campaignSimTimer);
  _campaignSimTimer=null;
}
function _campaignSimIsOpen(){
  var m=document.getElementById('campaignModal');
  return !!(m&&m.style.display==='flex');
}
function _scheduleCampaignProgress(ms){
  _campaignClearSimTimer();
  _campaignSimTimer=_setActiveTimeout(function(){
    _campaignSimTimer=null;
    if(_pageIsActive()) pollCampaignProgress(false);
  },ms);
}
function closeCampaignModal(){var m=document.getElementById('campaignModal');if(m)m.style.display='none';_campaignClearSimTimer();}
function _setCampaignModal(ch, html){
  _campaignClearSimTimer();
  document.getElementById('campaignModalTitle').textContent=_campaignStoryText(ch.title)||ch.questId;
  // 라우트 표시는 챕터의 실제 파벌(MCC/FSP/CV) 기반으로 동적으로 만든다 — 프롤로그/CV 챕터에서도 정확한 라우트가 보이도록 한다.
  var route=((ch.campaignId||'').replace('_route','')||ch.faction||'mcc').toUpperCase();
  document.getElementById('campaignModalMeta').textContent=route+' ROUTE · CHAPTER '+ch.chapterNumber;
  var _locName=ch.location&&(_campaignStoryText(ch.location.displayName)||(LANG==='ko'?ch.location.displayNameKo:ch.location.displayNameEn||ch.location.displayNameKo)||'Mars');
  document.getElementById('campaignModalSub').textContent=(_locName||'Mars')+' · '+((ch.environment&&ch.environment.type)||'simulation');
  document.getElementById('campaignModalBody').innerHTML=html;
  document.getElementById('campaignModal').style.display='flex';
}

function _campaignStoryText(value){
  // 스토리 JSON 다국어 필드에서 현재 LANG에 맞는 텍스트를 반환한다.
  if(value==null) return '';
  if(typeof value==='string') return value;
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  // 한국어 사용자: ko → en → ja → zh 순 폴백
  // 비한국어 사용자: lang → en → ko → ja → zh 순 폴백 (영어가 ko보다 우선)
  if(lang==='ko') return value.ko||value.en||value.ja||value.zh||'';
  return value[lang]||value.en||value.ko||value.ja||value.zh||'';
}

function _campaignStorySpeakerName(id){
  // 캐릭터 ID를 에셋 파일명과 분리하지 않도록 표시명만 로컬에서 보정한다.
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  var namesKo={player:'당신',lifang:'리팡',chen:'천 회장',mikhail:'미하일',butcher:'정육점',hale:'헤일 신부',lena:'레나',kara_vex:'Kara Vex',cinder:'신더',amara:'아마라',liang:'량 웨이',samuel:'사무엘',hagar:'하가르',mcc_operator:'MCC 오퍼레이터',helion_captain:'헬리온 선장',miner_elder:'광부 어르신',crow:'크로우',roth:'로스',sal_cruz:'살 크루즈',kenji:'켄지',wei:'웨이',grace:'그레이스',pilgrim:'필그림'};
  var namesEn={player:'You',lifang:'Li Fang',chen:'Chairman Chen',mikhail:'Mikhail',butcher:'The Butcher',hale:'Father Hale',lena:'Lena',kara_vex:'Kara Vex',cinder:'Cinder Grace',amara:'Amara',liang:'Liang Wei',samuel:'Samuel',hagar:'Hagar',mcc_operator:'MCC Operator',helion_captain:'Helion Captain',miner_elder:'Elder Miner',crow:'Crow',roth:'Roth',sal_cruz:'Sal Cruz',kenji:'Kenji',wei:'Wei',grace:'Grace',pilgrim:'Pilgrim'};
  var namesJa={player:'あなた',lifang:'リー・ファン',chen:'チェン会長',mikhail:'ミハイル',butcher:'ブッチャー',hale:'ヘイル神父',lena:'レナ',kara_vex:'カラ・ヴェックス',cinder:'シンダー',amara:'アマラ',liang:'リャン・ウェイ',samuel:'サミュエル',hagar:'ハガー',mcc_operator:'MCCオペレーター',helion_captain:'ヘリオン艦長',miner_elder:'鉱夫の長老',crow:'クロウ',roth:'ロス',sal_cruz:'サル・クルス',kenji:'ケンジ',wei:'ウェイ',grace:'グレース',pilgrim:'ピルグリム'};
  var namesZh={player:'你',lifang:'李芳',chen:'陈主席',mikhail:'米哈伊尔',butcher:'屠夫',hale:'黑尔神父',lena:'列娜',kara_vex:'卡拉·维克斯',cinder:'辛德',amara:'阿玛拉',liang:'梁伟',samuel:'塞缪尔',hagar:'哈加尔',mcc_operator:'MCC操作员',helion_captain:'赫利昂舰长',miner_elder:'矿工长老',crow:'克劳',roth:'罗斯',sal_cruz:'萨尔·克鲁兹',kenji:'健二',wei:'伟',grace:'格雷斯',pilgrim:'朝圣者'};
  var maps={ko:namesKo,en:namesEn,ja:namesJa,zh:namesZh};
  var names=maps[lang]||namesKo;
  return names[id]||String(id||'Narrator').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
}

function _campaignStorySceneById(id){
  // branch/options의 goto와 dialogue next가 문자열 ID를 쓰는 실제 씬 데이터를 지원한다.
  if(!_campaignScenes||!id) return -1;
  for(var i=0;i<_campaignScenes.length;i++) if(_campaignScenes[i]&&_campaignScenes[i].id===id) return i;
  return -1;
}

function _campaignHasServerChoice(choiceId){
  var choices=_campaignActive&&_campaignActive.chapter&&_campaignActive.chapter.choices;
  if(!choiceId||!Array.isArray(choices)) return false;
  return choices.some(function(c){return c&&c.id===choiceId;});
}

function _advanceCampaignSceneChoice(choiceId,target){
  // Scene-local narrative choices are part of the VN script, not the server
  // campaign choice whitelist. They should keep the story moving locally.
  var idx=-1;
  if(target!==undefined&&target!==null&&String(target)!==''){
    var next=String(target);
    idx=/^\d+$/.test(next)?parseInt(next,10):_campaignStorySceneById(next);
  }
  if(idx>=0&&_campaignScenes&&idx<_campaignScenes.length){
    _campaignSceneIndex=idx;
    _campaignSceneLineIndex=0;
    renderCampaignScene();
    return;
  }
  advanceCampaignScene();
}

function showCampaignStory(chapter){
  // 서버가 full story document 또는 scenes 배열을 줄 수 있어 둘 다 허용한다.
  closeCampaignStory();
  var story=chapter&&chapter.scenes;
  _campaignScenes=Array.isArray(story)?story:((story&&Array.isArray(story.scenes))?story.scenes:null);
  _campaignSceneIndex=0;
  _campaignSceneLineIndex=0;
  if(!_campaignScenes||!_campaignScenes.length){showCampaignBriefing(chapter,chapter&&chapter.progress);return;}
  var oldModal=document.getElementById('campaignModal');
  if(oldModal) oldModal.style.display='none';
  var overlay=document.createElement('div');
  overlay.className='story-overlay';
  // story-stage = 세로형 포트레이트 컨테이너 (모바일 기준, 데스크탑은 중앙 모달)
  overlay.innerHTML='<div class="story-stage">'
    +'<div class="story-background"></div>'
    +'<img class="story-character-left" alt="">'
    +'<img class="story-character-right" alt="">'
    +'<img class="story-detail-overlay" alt="">'
    +'<div class="story-controls">'
      +'<button type="button" class="story-ctrl-btn" id="storySkipBtn" title="'+t('story_skip_title')+'">▶ '+t('story_skip')+'</button>'
      +'<button type="button" class="story-ctrl-btn danger" id="storyAbandonBtn" title="'+t('story_abandon_title')+'">✕ '+t('story_abandon')+'</button>'
    +'</div>'
    +'<div class="story-dialog-box"></div>'
    +'<div class="story-tap-hint">▶ '+t('story_tap_hint')+'</div>'
    +'</div>';
  overlay.addEventListener('click',function(ev){
    // stage 밖(어두운 배경) 클릭은 무시 — 컨테이너 안만 반응
    if(ev.target&&ev.target.closest&&!ev.target.closest('.story-stage')) return;
    // 컨트롤(스킵/나가기) 버튼과 선택지 버튼은 자체 핸들러로만 진행한다.
    if(ev.target&&ev.target.closest){
      if(ev.target.closest('.story-controls')) return;
      if(ev.target.closest('.story-choice-btn')) return;
    }
    var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
    if(!scene) return;
    if(scene.type==='choice'||scene.type==='branch') return;
    if(!_campaignTypingDone){
      _campaignClearTypingTimer();
      if(_campaignTypingElement) _campaignTypingElement.textContent=_campaignTypingFullText;
      _campaignTypingDone=true;
      return;
    }
    advanceCampaignScene();
  });
  document.body.appendChild(overlay);
  // 스킵: 타이핑 중이면 즉시 완료, 끝났으면 다음 장면으로 이동
  document.getElementById('storySkipBtn').addEventListener('click',function(ev){
    ev.stopPropagation();
    if(!_campaignTypingDone){
      _campaignClearTypingTimer();
      if(_campaignTypingElement) _campaignTypingElement.textContent=_campaignTypingFullText;
      _campaignTypingDone=true;
      return;
    }
    advanceCampaignScene();
  });
  // 나가기: 챕터 진행 포기 후 오버레이 닫기
  document.getElementById('storyAbandonBtn').addEventListener('click',function(ev){
    ev.stopPropagation();
    abandonCampaignFromStory();
  });
  // 인게임은 서버에 저장된 에디터 레이아웃만 신뢰한다. 에디터 localStorage는
  // 같은 브라우저의 오래된 좌표를 되살릴 수 있어 게임 화면에서는 사용하지 않는다.
  var cachedServerLayout=_campaignCachedServerEditorLayout();
  if(cachedServerLayout) _campaignEditorLayout=_campaignComposeEditorLayout(cachedServerLayout,null);
  renderCampaignScene();
  fetch('/api/campaign/editor-layout?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
    if(d&&typeof d==='object'){
      var before=JSON.stringify(_campaignEditorLayout||{});
      _campaignStoreServerEditorLayout(d);
      _campaignEditorLayout=_campaignComposeEditorLayout(d,null);
      if(document.querySelector('.story-overlay')&&JSON.stringify(_campaignEditorLayout||{})!==before){
        renderCampaignScene();
      }
    }
  }).catch(function(){});
}

// 스토리 화면에서 "나가기" 클릭 시 호출. 진행 중인 세션을 서버에 abandon 요청한 뒤 화면을 닫는다.
async function abandonCampaignFromStory(){
  var ok=await gameConfirm({
    icon:'⚠',
    title:t('story_abandon_confirm_title'),
    body:t('story_abandon_confirm_body'),
    confirmText:t('story_abandon')
  });
  if(!ok) return;
  var w=walletState.address, a=_campaignActive;
  closeCampaignStory();
  closeCampaignModal();
  if(w&&a&&a.sessionId){
    try{
      await fetch('/api/campaign/abandon',{
        method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,session_id:a.sessionId})
      });
    }catch(e){/* 네트워크 실패는 무시한다 — 다음 진입에서 새 세션 생성 가능 */}
  }
  _campaignActive=null;
  try{ loadCampaignStatus(); }catch(_){}
}

var CAMPAIGN_ASSET_VERSION='20260502c';
function campaignAssetUrl(path){
  return path+(path.indexOf('?')>=0?'&':'?')+'v='+CAMPAIGN_ASSET_VERSION;
}

function _campaignPreloadImage(src){
  if(!src) return null;
  var cached=_campaignImageCache[src];
  if(cached) return cached;
  var img=new Image();
  img.decoding='async';
  img.src=src;
  _campaignImageCache[src]=img;
  if(img.decode) img.decode().catch(function(){});
  return img;
}

function _campaignClearTypingTimer(){
  if(_campaignTypingTimer) clearInterval(_campaignTypingTimer);
  if(_campaignTypingFrame) cancelAnimationFrame(_campaignTypingFrame);
  _campaignTypingTimer=null;
  _campaignTypingFrame=null;
}

function _campaignIsStoryMobile(){
  return !!(window.matchMedia&&window.matchMedia('(max-width:520px)').matches);
}

function _campaignMergeLayout(target,src){
  if(!src||typeof src!=='object') return target;
  Object.keys(src).forEach(function(k){
    var v=src[k];
    if(v&&typeof v==='object'&&!Array.isArray(v)&&target[k]&&typeof target[k]==='object'&&!Array.isArray(target[k])){
      _campaignMergeLayout(target[k],v);
    }else{
      target[k]=v;
    }
  });
  return target;
}

function _campaignStoryLayout(scene,line){
  var layout={};
  [_campaignEditorLayout,scene&&scene.layout,scene&&scene.editorLayout,scene&&scene.stageLayout,line&&line.layout,line&&line.editorLayout,line&&line.stageLayout].forEach(function(src){
    _campaignMergeLayout(layout,src);
  });
  var mode=_campaignIsStoryMobile()?'mobile':'desktop';
  if(layout[mode]) _campaignMergeLayout(layout,layout[mode]);
  return layout;
}

function _campaignComposeEditorLayout(serverLayout,localLayout){
  var serverAt=_campaignLayoutUpdatedAt(serverLayout);
  var localAt=_campaignLayoutUpdatedAt(localLayout);
  var localShouldWin=!!localLayout&&localAt>0&&localAt>=serverAt;
  var merged={};
  _campaignMergeLayout(merged,localShouldWin?{}:(serverLayout||{}));
  // The editor syncs on a short debounce. Local layout should only override
  // the server when it has a fresh timestamp; otherwise stale gameplay
  // localStorage can keep resurrecting old coordinates after server saves.
  if(localShouldWin) _campaignMergeLayout(merged,serverLayout||{});
  _campaignMergeLayout(merged,localShouldWin?(localLayout||{}):{});
  return Object.keys(merged).length?merged:null;
}

function _campaignLayoutUpdatedAt(layout){
  if(!layout||typeof layout!=='object') return 0;
  var raw=layout.updatedAt||layout.updated_at||layout.savedAt||layout.saved_at||0;
  if(typeof raw==='string'&&raw.indexOf('-')>=0){
    var t=Date.parse(raw);
    return isFinite(t)?t:0;
  }
  var n=Number(raw);
  return isFinite(n)?n:0;
}

function _campaignLocalEditorLayout(){
  try{
    var chars=JSON.parse(localStorage.getItem('editorCharacters')||'{}');
    var overlays=JSON.parse(localStorage.getItem('editorOverlays')||'{}');
    var dialog=JSON.parse(localStorage.getItem('editorDialog')||'null');
    var fontsize=parseFloat(localStorage.getItem('editorFontSize')||'');
    var payload={};
    if(chars&&Object.keys(chars).length) payload.characters=chars;
    if(overlays&&Object.keys(overlays).length) payload.overlays=overlays;
    if(dialog&&typeof dialog==='object') payload.dialog=dialog;
    if(isFinite(fontsize)) payload.fontsize=fontsize;
    var updatedAt=Number(localStorage.getItem('editorLayoutUpdatedAt')||'0')||0;
    if(updatedAt) payload.updatedAt=updatedAt;
    return Object.keys(payload).length?payload:null;
  }catch(_){return null;}
}

function _campaignCachedServerEditorLayout(){
  try{
    var raw=sessionStorage.getItem('campaignEditorServerLayout')||localStorage.getItem('campaignEditorServerLayout')||'';
    if(!raw) return null;
    var parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch(_){return null;}
}

function _campaignStoreServerEditorLayout(layout){
  try{
    if(layout&&typeof layout==='object'){
      var raw=JSON.stringify(layout);
      sessionStorage.setItem('campaignEditorServerLayout',raw);
      localStorage.setItem('campaignEditorServerLayout',raw);
    }
  }catch(_){}
}

function _campaignLayoutPick(obj,names){
  if(!obj||typeof obj!=='object') return null;
  for(var i=0;i<names.length;i++){
    if(obj[names[i]]!==undefined&&obj[names[i]]!==null) return obj[names[i]];
  }
  return null;
}

function _campaignLayoutBox(layout,names){
  for(var i=0;i<names.length;i++){
    var v=_campaignLayoutPick(layout,[names[i]]);
    if(v&&typeof v==='object') return v;
  }
  return null;
}

function _campaignLayoutUnit(v,fallback){
  if(v===undefined||v===null||v==='') return fallback;
  if(typeof v==='number'&&isFinite(v)) return v+'%';
  if(typeof v==='string') return v;
  return fallback;
}

function _campaignLayoutNumber(v,fallback){
  if(v===undefined||v===null||v==='') return fallback;
  var n=Number(v);
  return isFinite(n)?n:fallback;
}

function _campaignLayoutHasValue(box){
  return !!(box&&typeof box==='object'&&Object.keys(box).some(function(k){return k!=='desktop'&&k!=='mobile';}));
}

function _campaignDefaultCharacterLayout(pos,count){
  if(count<=1||pos==='center') return {x:50,y:55,w:60};
  return pos==='right'?{x:72,y:55,w:50}:{x:28,y:55,w:50};
}

function _campaignResetStoryLayout(overlay){
  var bg=overlay.querySelector('.story-background');
  var left=overlay.querySelector('.story-character-left');
  var right=overlay.querySelector('.story-character-right');
  var detail=overlay.querySelector('.story-detail-overlay');
  var box=overlay.querySelector('.story-dialog-box');
  if(bg){
    // Keep the current background image visible until the next one has loaded.
    // Removing the whole style here briefly exposes the default purple/blue CSS
    // background during scene changes.
    bg.style.backgroundPosition='50% 50%';
    bg.style.backgroundSize='cover';
    bg.style.opacity='';
    bg.style.filter='';
    bg.style.transitionDuration='';
  }
  [left,right].forEach(function(el){
    if(!el) return;
    el.removeAttribute('style');
    el.className=el.classList.contains('story-character-right')?'story-character-right':'story-character-left';
    el.style.display='none';
  });
  if(detail){
    detail.removeAttribute('style');
    detail.classList.remove('visible');
  }
  if(box) box.removeAttribute('style');
}

function _campaignApplyRectLayout(el,box,opts){
  if(!el||!box) return;
  opts=opts||{};
  var x=_campaignLayoutPick(box,['x','left','cx','centerX']);
  var y=_campaignLayoutPick(box,['y','top','cy','centerY']);
  var w=_campaignLayoutPick(box,['w','width']);
  var h=_campaignLayoutPick(box,['h','height']);
  if(x!==null||y!==null){
    el.style.left=_campaignLayoutUnit(x,el.style.left||'50%');
    el.style.top=_campaignLayoutUnit(y,el.style.top||'50%');
    el.style.right='auto';
    el.style.bottom='auto';
    el.style.transform=opts.transform||'translate(-50%,-50%)';
  }
  if(box.right!==undefined){el.style.right=_campaignLayoutUnit(box.right,'auto');el.style.left='auto';}
  if(box.bottom!==undefined){el.style.bottom=_campaignLayoutUnit(box.bottom,'auto');el.style.top='auto';}
  if(w!==null) el.style.width=_campaignLayoutUnit(w,'auto');
  if(h!==null) el.style.height=_campaignLayoutUnit(h,'auto');
  if(box.z!==undefined||box.zIndex!==undefined) el.style.zIndex=String(_campaignLayoutPick(box,['z','zIndex']));
  if(box.opacity!==undefined) el.style.opacity=String(_campaignLayoutNumber(box.opacity,1));
}

function _campaignApplyCharacterLayout(el,box){
  if(!el||!box) return;
  var centerX=_campaignLayoutPick(box,['cx','centerX']);
  var centerY=_campaignLayoutPick(box,['cy','centerY']);
  var hasCenter=centerX!==null||centerY!==null;
  var hasY=_campaignLayoutPick(box,['y','top'])!==null||box.bottom!==undefined||hasCenter;
  var hasX=_campaignLayoutPick(box,['x','left'])!==null||hasCenter;
  if(hasCenter){
    _campaignApplyRectLayout(el,box,{transform:'translate(-50%,-50%)'});
    el.style.transformOrigin='50% 50%';
  }else if(hasX&&hasY){
    // Campaign editor stores character boxes as center-point percent + width.
    // Keep the game renderer on the same coordinate model so editor previews
    // and in-game scenes match exactly for every character.
    el.style.left=_campaignLayoutUnit(_campaignLayoutPick(box,['x','left']),'50%');
    el.style.top=_campaignLayoutUnit(_campaignLayoutPick(box,['y','top']),'50%');
    el.style.right='auto';
    el.style.bottom='auto';
    el.style.transform=(box.anchor==='top-left'||box.origin==='top-left')?'none':'translate(-50%,-50%)';
    el.style.transformOrigin=(box.anchor==='top-left'||box.origin==='top-left')?'0 0':'50% 50%';
  }else if(hasX&&!hasY){
    el.style.left=_campaignLayoutUnit(_campaignLayoutPick(box,['x','left','cx','centerX']),'50%');
    el.style.right='auto';
    el.style.top='auto';
    el.style.bottom='0';
    el.style.transform='translateX(-50%)';
    el.style.transformOrigin='50% 100%';
  }else{
    _campaignApplyRectLayout(el,box,{transform:'translate(-50%,-50%)'});
    el.style.transformOrigin='50% 50%';
  }
  var w=_campaignLayoutPick(box,['w','width']);
  var h=_campaignLayoutPick(box,['h','height']);
  if(w!==null) el.style.width=_campaignLayoutUnit(w,'auto');
  if(h!==null) el.style.height=_campaignLayoutUnit(h,'auto');
  el.style.maxWidth='none';
  el.style.maxHeight=hasY?'none':'92%';
  if(box.scale!==undefined){
    var scale=_campaignLayoutNumber(box.scale,1);
    var baseTransform=(!el.style.transform||el.style.transform==='none')?'':el.style.transform;
    el.style.transform=(baseTransform?baseTransform+' ':'')+'scale('+scale+')';
  }
  if(box.fit||box.objectFit) el.style.objectFit=box.fit||box.objectFit;
}

function _campaignCharacterLayout(layout,charId,pos){
  var chars=layout&&(layout.characters||layout.characterLayouts||layout.character);
  var found=null;
  if(Array.isArray(chars)){
    chars.forEach(function(c){
      if(found||!c) return;
      if(c.id===charId||c.characterId===charId||c.speaker===charId||c.position===pos) found=c;
    });
  }else if(chars&&typeof chars==='object'){
    found=chars[charId]||chars[pos]||chars[(pos==='right')?'right':'left'];
  }
  if(!found&&layout) found=layout['character_'+charId]||layout[pos+'Character'];
  return found;
}

function _campaignApplyBackgroundLayout(bg,layout){
  var box=_campaignLayoutBox(layout,['background','bg','image']);
  if(!bg||!box) return;
  var x=_campaignLayoutPick(box,['x','positionX','left']);
  var y=_campaignLayoutPick(box,['y','positionY','top']);
  if(x!==null||y!==null) bg.style.backgroundPosition=_campaignLayoutUnit(x,'50%')+' '+_campaignLayoutUnit(y,'50%');
  var size=_campaignLayoutPick(box,['size','backgroundSize','fit']);
  if(size) bg.style.backgroundSize=size;
  else if(box.scale!==undefined) bg.style.backgroundSize=_campaignLayoutNumber(box.scale,100)+'% auto';
  if(box.opacity!==undefined) bg.style.opacity=String(_campaignLayoutNumber(box.opacity,1));
}

function _campaignApplyDialogLayout(box,scene,line){
  var layout=_campaignStoryLayout(scene,line);
  var cfg=_campaignLayoutBox(layout,['dialog','dialogue','dialogBox','textbox','textBox','box']);
  if(!cfg) return;
  var centerMode=cfg.x!==undefined||cfg.cx!==undefined||cfg.centerX!==undefined||cfg.y!==undefined||cfg.cy!==undefined||cfg.centerY!==undefined;
  _campaignApplyRectLayout(box,cfg,{transform:centerMode?'translate(-50%,-50%)':'none'});
  box.style.boxSizing='border-box';
  // The editor preview uses a compact content box. The in-game default has a
  // large mobile safe-area bottom padding, so applying editor x/y/w without
  // replacing padding makes the textbox look far taller than the editor.
  box.style.padding=cfg.padding!==undefined?cfg.padding:'4% 5% 5%';
  box.style.paddingBottom=cfg.paddingBottom!==undefined?_campaignLayoutUnit(cfg.paddingBottom,'5%'):'5%';
  if(cfg.background!==undefined) box.style.background=cfg.background;
  if(cfg.border!==undefined) box.style.border=cfg.border;
  if(cfg.borderTop!==undefined) box.style.borderTop=cfg.borderTop;
}

function _campaignApplyStoryFontSize(box,scene,line){
  if(!box) return;
  var layout=_campaignStoryLayout(scene,line);
  var fs=_campaignLayoutPick(layout,['fontsize','fontSize','textSize']);
  var el=box.querySelector('.story-text');
  if(el&&fs!==null) el.style.fontSize=(typeof fs==='number'?fs+'rem':fs);
}

function _campaignStorySetBackground(scene,overlay,lineBg,line){
  // line.background 가 있으면 라인 전용 배경(전용 dedicated 씬 배경)으로 swap, 없으면 scene.background.
  // 에셋이 없거나 로드 실패하면 화성풍 그라디언트 폴백.
  var bg=overlay.querySelector('.story-background');
  if(!bg) return;
  var speed=scene.transition==='fade_slow'?'0.28s':(scene.transition==='fade_medium'?'0.18s':'0s');
  bg.style.transitionDuration=speed;
  var bgChoice=lineBg||scene.background;
  if(!bgChoice){
    bg.style.backgroundImage='linear-gradient(135deg, #1a0a2e, #2d1b4e)';
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
    return;
  }
  // 배경 ID → 파일명 매핑. 전용 에셋이 생긴 ID는 직접 참조,
  // 아직 파일이 없거나 별칭이 필요한 ID만 폴백을 유지한다.
  var _bgMap={
    // 전용 에셋 없는 ID만 폴백 유지 (184장 Codex 배치 이후 직접 파일 생긴 항목은 제거)
    'hellas_central_underground':'mcc_briefing_room',
    'hellas_outer_relay_interior':'hellas_outer_relay',
    'erebus_base_medical':'erebus_base_interior',
    'hellas_various_night':'hellas_labor_district_night',
    'mcc_25deg_lounge':'mcc_briefing_room',
    'new_athens_shipyard_launch':'new_athens_shipyard_dawn'
  };
  var bgId=_bgMap[bgChoice]||bgChoice;
  var src=campaignAssetUrl('/assets/campaign/backgrounds/'+bgId+'.png');
  if(bg.getAttribute('data-bg-src')===src){
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
    return;
  }
  var img=_campaignPreloadImage(src);
  var applyLoadedBg=function(){
    bg.style.backgroundImage='url("'+src+'")';
    bg.setAttribute('data-bg-src',src);
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
  };
  if(img&&img.complete&&img.naturalWidth>0){
    applyLoadedBg();
    return;
  }
  img.onload=applyLoadedBg;
  img.onerror=function(){
    if(!bg.style.backgroundImage){
      bg.style.backgroundImage='linear-gradient(135deg, #1a0a2e, #2d1b4e)';
    }
  };
}

function _campaignStoryRenderCharacters(scene,line,overlay){
  // scene.characters가 있으면 우선 사용하고, 없으면 현재 씬 대사의 speaker에서 좌/우 초상화를 추론한다.
  var left=overlay.querySelector('.story-character-left');
  var right=overlay.querySelector('.story-character-right');
  if(!left||!right) return;
  left.style.display='none'; right.style.display='none';
  if(scene.type!=='dialogue') return;
  var chars=[];
  if(Array.isArray(scene.characters)){
    chars=scene.characters.map(function(c,i){return typeof c==='string'?{id:c,position:scene.characters.length===1?'center':(i===0?'left':'right')}:c;});
    if(chars.length===1&&!chars[0].position) chars[0].position='center';
  }else{
    var speakers=(scene.lines||[]).map(function(l){return l.speaker;}).filter(Boolean);
    speakers.forEach(function(s){if(chars.map(function(c){return c.id;}).indexOf(s)<0) chars.push({id:s,position:s==='player'?'right':'left'});});
    if(chars.length===1) chars[0].position='center';
  }
  chars.slice(0,2).forEach(function(c,i){
    var pos=c.position||(chars.length===1?'center':(i===0?'left':'right'));
    var el=pos==='right'?right:left;
    var id=c.id||c.characterId||c.speaker;
    if(!id) return;
    el.className=pos==='center'?'story-character-left story-character-center':(pos==='right'?'story-character-right':'story-character-left');
    if(line&&line.speaker&&line.speaker!==id) el.className+=' story-character-inactive';
    el.onerror=function(){el.style.display='none';};
    // 파일명이 다르거나 새 캐릭터를 기존 초상화로 임시 매핑한다
    var _portraitMap={
      'player':'player_silhouette','observer':'player_silhouette',
      'rev_hale':'hale','young_butcher':'butcher','crow':'crow',
      'liang':'liang_wei','kara_vex':'crow_reyes'
    };
    var charSrc=campaignAssetUrl('/assets/campaign/characters/'+(_portraitMap[id]||id)+'.png');
    _campaignPreloadImage(charSrc);
    el.src=charSrc;
    el.style.display='block';
    var charLayout=_campaignMergeLayout({},_campaignDefaultCharacterLayout(pos,chars.length));
    _campaignMergeLayout(charLayout,_campaignCharacterLayout(_campaignStoryLayout(scene,line),id,pos)||{});
    if(_portraitMap[id]) _campaignMergeLayout(charLayout,_campaignCharacterLayout(_campaignStoryLayout(scene,line),_portraitMap[id],pos)||{});
    _campaignMergeLayout(charLayout,c.layout||c.editorLayout||{});
    _campaignApplyCharacterLayout(el,charLayout);
  });
}

// 씬 디테일 오버레이 — line.overlay 필드 (e.g., "cv_ch10_from_flames_l00_00_fire_small")
// 가 명시된 line 에서만 중앙 closeup 표시. 한 location 의 base 배경은 그대로 두고
// overlay 만 한정적으로 점멸 → 화면 churn 없이 시각적 강조.
function _showStoryDetailOverlay(overlayName,layout){
  var el = document.querySelector('.story-detail-overlay');
  if(!el) return;
  el.classList.remove('visible');
  if(!overlayName) return;
  var src = campaignAssetUrl('/assets/campaign/backgrounds/' + overlayName + '.png');
  _campaignApplyRectLayout(el,_campaignLayoutBox(layout||{},['overlay','detailOverlay','closeup','cutin']),{transform:'translate(-50%,-50%)'});
  if(el.getAttribute('data-src') === src && el.complete && el.naturalWidth > 0){
    el.classList.add('visible');
    return;
  }
  el.setAttribute('data-src', src);
  el.onload = function(){ el.classList.add('visible'); };
  el.onerror = function(){ el.classList.remove('visible'); };
  el.src = src;
}

function _campaignPreloadSceneAssets(scene,line){
  if(!scene) return;
  var bgChoice=(line&&line.background)||scene.background;
  if(bgChoice){
    var _bgMap={
      'hellas_central_underground':'mcc_briefing_room',
      'hellas_outer_relay_interior':'hellas_outer_relay',
      'erebus_base_medical':'erebus_base_interior',
      'hellas_various_night':'hellas_labor_district_night',
      'mcc_25deg_lounge':'mcc_briefing_room',
      'new_athens_shipyard_launch':'new_athens_shipyard_dawn'
    };
    _campaignPreloadImage(campaignAssetUrl('/assets/campaign/backgrounds/'+(_bgMap[bgChoice]||bgChoice)+'.png'));
  }
  if(line&&line.overlay) _campaignPreloadImage(campaignAssetUrl('/assets/campaign/backgrounds/'+line.overlay+'.png'));
  var ids=[];
  if(Array.isArray(scene.characters)){
    scene.characters.forEach(function(c){ids.push(typeof c==='string'?c:(c&&(c.id||c.characterId||c.speaker)));});
  }else if(Array.isArray(scene.lines)){
    scene.lines.forEach(function(l){if(l&&l.speaker&&ids.indexOf(l.speaker)<0) ids.push(l.speaker);});
  }
  var map={'player':'player_silhouette','observer':'player_silhouette','rev_hale':'hale','young_butcher':'butcher','crow':'crow','liang':'liang_wei','kara_vex':'crow_reyes'};
  ids.filter(Boolean).forEach(function(id){
    _campaignPreloadImage(campaignAssetUrl('/assets/campaign/characters/'+(map[id]||id)+'.png'));
  });
}

function typeText(element,text,onComplete){
  // 클릭 즉시완료를 위해 타이머와 전체 텍스트를 전역에 보관한다.
  _campaignClearTypingTimer();
  _campaignTypingElement=element;
  _campaignTypingFullText=text||'';
  _campaignTypingDone=false;
  element.textContent='';
  var start=performance.now();
  var lastLen=0;
  var cps=48;
  function step(now){
    if(!_pageIsActive()){
      _campaignTypingFrame=null;
      _onPageVisibleOnce(function(){
        if(!_campaignTypingDone&&_campaignTypingElement===element) _campaignTypingFrame=requestAnimationFrame(step);
      });
      return;
    }
    var len=Math.min(_campaignTypingFullText.length,Math.floor((now-start)/1000*cps));
    if(len!==lastLen){
      element.textContent=_campaignTypingFullText.slice(0,len);
      lastLen=len;
    }
    if(len>=_campaignTypingFullText.length){
      _campaignClearTypingTimer();
      _campaignTypingDone=true;
      if(onComplete) onComplete();
      return;
    }
    _campaignTypingFrame=requestAnimationFrame(step);
  }
  _campaignTypingFrame=requestAnimationFrame(step);
}

function renderCampaignScene(){
  var overlay=document.querySelector('.story-overlay');
  var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
  if(!overlay||!scene){closeCampaignStory();return;}
  _campaignClearTypingTimer();
  if(_campaignBattleTimer) _clearActiveTimeout(_campaignBattleTimer);
  _campaignBattleTimer=null; _campaignTypingDone=true;
  var currentLine=null;
  if(scene.type==='dialogue'||scene.type==='narration'||scene.type==='ending'){
    currentLine=(scene.lines||[])[_campaignSceneLineIndex]||{};
  }
  _campaignResetStoryLayout(overlay);
  _campaignStorySetBackground(scene,overlay,currentLine&&currentLine.background,currentLine);
  var box=overlay.querySelector('.story-dialog-box');
  var hint=overlay.querySelector('.story-tap-hint');
  var title=overlay.querySelector('.story-title-card');
  if(title) title.remove();
  if(box){
    box.style.display='block';
    box.style.background='rgba(0,0,0,.75)';
    box.style.borderTop='1px solid rgba(255,255,255,.12)';
    box.style.backdropFilter='blur(4px)';
    try{
      var _edDlg=_campaignEditorLayout&&_campaignEditorLayout.dialog;
      if(_edDlg){
        // 에디터와 동일한 center-point 기준 transform 적용
        box.style.position='absolute';
        box.style.transform='translate(-50%,-50%)';
        box.style.left=_edDlg.x+'%';
        box.style.top=_edDlg.y+'%';
        box.style.width=_edDlg.w+'%';
        box.style.bottom='auto';
        box.style.right='auto';
      }
    }catch(_){}
  }
  if(hint) hint.style.display='block';

  if(scene.type==='narration'||scene.type==='ending'){
    var nLine=currentLine||{};
    _campaignStoryRenderCharacters(scene,nLine,overlay);
    box.style.background='transparent';
    box.style.borderTop='none';
    box.style.backdropFilter='none';
    box.innerHTML='<div class="story-text story-narration-text"></div>';
    var _nText=_campaignStoryText(nLine.text);
    _campaignApplyDialogLayout(box,scene,nLine);
    _showStoryDetailOverlay(nLine.overlay||null,_campaignStoryLayout(scene,nLine));
    _campaignApplyStoryFontSize(box,scene,nLine);
    _campaignPreloadSceneAssets(scene,nLine);
    var nNextScene=_campaignScenes[_campaignSceneIndex+1];
    var nNextLine=(scene.lines||[])[_campaignSceneLineIndex+1]||(nNextScene&&nNextScene.lines&&nNextScene.lines[0]);
    _campaignPreloadSceneAssets(nNextScene||scene,nNextLine);
    typeText(box.querySelector('.story-text'),_nText,null);
    return;
  }

  if(scene.type==='dialogue'){
    var dLine=currentLine||{};
    _campaignStoryRenderCharacters(scene,dLine,overlay);
    box.innerHTML='<div class="story-speaker-name">'+escapeHtmlSafe(_campaignStorySpeakerName(dLine.speaker||scene.speaker))+'</div><div class="story-text"></div>';
    var _dText=_campaignStoryText(dLine.text);
    _campaignApplyDialogLayout(box,scene,dLine);
    _showStoryDetailOverlay(dLine.overlay||null,_campaignStoryLayout(scene,dLine));
    _campaignApplyStoryFontSize(box,scene,dLine);
    _campaignPreloadSceneAssets(scene,dLine);
    var dNextScene=_campaignScenes[_campaignSceneIndex+1];
    var dNextLine=(scene.lines||[])[_campaignSceneLineIndex+1]||(dNextScene&&dNextScene.lines&&dNextScene.lines[0]);
    _campaignPreloadSceneAssets(dNextScene||scene,dNextLine);
    typeText(box.querySelector('.story-text'),_dText,null);
    return;
  }

  if(scene.type==='choice'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(hint) hint.style.display='none';
    var html='<div class="story-text">'+escapeHtmlSafe(_campaignStoryText(scene.prompt))+'</div><div class="story-choices">';
    (scene.choices||[]).forEach(function(choice){
      var label=_campaignStoryText(choice.text||choice.label);
      var hintText=_campaignStoryText(choice.preview_hint);
      html+='<button class="story-choice-btn" data-choice="'+escapeHtmlSafe(choice.value||choice.id||'')+'" data-next="'+escapeHtmlSafe(choice.next_scene||choice.goto||'')+'">'+escapeHtmlSafe(label+(hintText?'\n'+hintText:''))+'</button>';
    });
    html+='</div>';
    box.innerHTML=html;
    _campaignApplyDialogLayout(box,scene,null);
    Array.prototype.forEach.call(box.querySelectorAll('.story-choice-btn'),function(btn){
      btn.addEventListener('click',function(ev){
        ev.stopPropagation();
        var value=btn.getAttribute('data-choice');
        var target=btn.getAttribute('data-next');
        if(_campaignHasServerChoice(value)){
          closeCampaignStory();
          chooseCampaignOption(value);
          return;
        }
        _advanceCampaignSceneChoice(value,target);
      });
    });
    return;
  }

  if(scene.type==='branch'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(hint) hint.style.display='none';
    var opts=scene.choices||scene.options||[];
    var branchHtml='<div class="story-text">'+escapeHtmlSafe(_campaignStoryText(scene.prompt))+'</div><div class="story-choices">';
    opts.forEach(function(choice,i){
      branchHtml+='<button class="story-choice-btn" data-next="'+escapeHtmlSafe(choice.next_scene||choice.goto||i)+'">'+escapeHtmlSafe(_campaignStoryText(choice.text||choice.label))+'</button>';
    });
    branchHtml+='</div>';
    box.innerHTML=branchHtml;
    _campaignApplyDialogLayout(box,scene,null);
    Array.prototype.forEach.call(box.querySelectorAll('.story-choice-btn'),function(btn){
      btn.addEventListener('click',function(ev){
        ev.stopPropagation();
        var target=btn.getAttribute('data-next');
        var idx=/^\d+$/.test(target)?parseInt(target,10):_campaignStorySceneById(target);
        if(idx>=0&&idx<_campaignScenes.length){_campaignSceneIndex=idx;_campaignSceneLineIndex=0;renderCampaignScene();}
        else advanceCampaignScene();
      });
    });
    return;
  }

  if(scene.type==='battle_transition'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(box) box.style.display='none';
    if(hint) hint.style.display='none';
    var card=document.createElement('div');
    card.className='story-title-card';
    card.innerHTML=escapeHtmlSafe(_campaignStoryText(scene.title))+'<small>'+escapeHtmlSafe(_campaignStoryText(scene.subtitle))+'</small>';
    overlay.appendChild(card);
    _campaignTypingDone=true;
    _campaignBattleTimer=_setActiveTimeout(function(){advanceCampaignScene();},3000);
    return;
  }

  // 아직 전투 결과 서버 응답 연동 전인 result 씬은 기존 시뮬레이션 흐름으로 넘긴다.
  if(scene.type==='result'){closeCampaignStory();if(_campaignActive)showCampaignSim(_campaignActive.chapter,_campaignActive.progress||{});return;}
  advanceCampaignScene();
}

function advanceCampaignScene(){
  var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
  if(!scene){_finishCampaignNoChoiceFlow();return;}
  var lines=scene.lines||[];
  if((scene.type==='dialogue'||scene.type==='narration'||scene.type==='ending')&&_campaignSceneLineIndex<lines.length-1){
    _campaignSceneLineIndex++;
    renderCampaignScene();
    return;
  }
  if(scene.type==='ending'){
    _finishCampaignNoChoiceFlow();
    return;
  }
  if(scene.next){
    var idx=_campaignStorySceneById(scene.next);
    if(idx>=0){_campaignSceneIndex=idx;_campaignSceneLineIndex=0;renderCampaignScene();return;}
  }
  _campaignSceneIndex++;
  _campaignSceneLineIndex=0;
  if(!_campaignScenes||_campaignSceneIndex>=_campaignScenes.length){_finishCampaignNoChoiceFlow();return;}
  renderCampaignScene();
}

function _campaignShouldAutoCompleteAfterStory(chapter){
  if(!chapter) return false;
  var resolution=chapter.battleResolution||'';
  return Number(chapter.chapterNumber)===0 || resolution==='none' || resolution==='cinematic_only' || resolution==='ending_evaluation_and_cinematic';
}

function _campaignFormatDuration(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  var m=Math.floor(sec/60), s=sec%60;
  return m>0?(m+'m '+String(s).padStart(2,'0')+'s'):(s+'s');
}

// 순수 스토리 챕터만 마지막 씬에서 자동 완료한다. 작전/퀘스트 챕터는 서버 진행률
// 폴링으로 넘겨야 "시작하자마자 클리어"가 되지 않는다.
function _finishCampaignNoChoiceFlow(){
  var a=_campaignActive;
  var hasChoices=a&&a.chapter&&Array.isArray(a.chapter.choices)&&a.chapter.choices.length>0;
  if(a&&a.sessionId&&!hasChoices){
    closeCampaignStory();
    if(_campaignShouldAutoCompleteAfterStory(a.chapter)) completeCampaignMission();
    else showCampaignSim(a.chapter,a.progress||{});
    return;
  }
  closeCampaignStory();
}

function closeCampaignStory(){
  // 오버레이와 타이머를 정리해 기존 캠페인 모달/시뮬레이션 흐름으로 안전하게 복귀한다.
  var overlay=document.querySelector('.story-overlay');
  if(overlay) overlay.remove();
  _campaignClearTypingTimer();
  if(_campaignBattleTimer) _clearActiveTimeout(_campaignBattleTimer);
  _campaignBattleTimer=null;
  _campaignTypingDone=false;
  _campaignTypingElement=null;
  _campaignTypingFullText='';
  _campaignScenes=null;
  _campaignSceneIndex=0;
  _campaignSceneLineIndex=0;
}

async function openCampaignChapter(questId){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return;}
  var ch=_findCampaignChapter(questId);
  if(!ch){await loadCampaignStatus();ch=_findCampaignChapter(questId);}
  if(!ch){showToast(tl('Campaign not loaded','캠페인을 불러오지 못했습니다','キャンペーンを読み込めませんでした','未能加载战役'));return;}
  var p=ch.progress||{};
  if(isCampaignProgressDone(p)) return showCampaignResult(ch,p);
  if(isCampaignProgressActive(p)&&p.sessionId){
    _campaignActive={chapter:ch,progress:p,sessionId:p.sessionId};
    if(Array.isArray(p.choices)&&p.choices.length>0) showCampaignSim(ch,p);
    else if(ch.scenes) showCampaignStory(ch);
    else showCampaignBriefing(ch,p);
    return;
  }
  try{
    var resp=await fetch('/api/campaign/start',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,quest_id:questId})});
    var d=await resp.json();
    if(!resp.ok){showCampaignStartBlocked(ch,d);return;}
    ch=d.chapter||ch; p=d.progress||{};
    _campaignActive={chapter:ch,progress:p,sessionId:d.sessionId||p.sessionId};
    if(ch.scenes) showCampaignStory(ch);
    else showCampaignBriefing(ch,p);
  }catch(e){showToast(tl('Campaign start failed','캠페인 시작에 실패했습니다','キャンペーン開始に失敗しました','战役开始失败'));}
}

function campaignStartErrorMessage(ch,payload){
  // [v7.170 D-M1 fix] lockReason 4언어 모두 매핑 — 기존엔 ko/en만 있어 ja/zh 사용자는 영어로 폴백됨.
  var err=(payload&&payload.error)||'Campaign start failed';
  if(err==='INSUFFICIENT_REPUTATION'){
    var faction=((payload&&payload.faction)||'').toUpperCase();
    var current=payload&&payload.current!=null?payload.current:0;
    var required=payload&&payload.required!=null?payload.required:0;
    return tl(
      'Insufficient reputation. Current '+current+', required '+required+'.',
      (faction||'평판')+' 평판이 부족합니다. 현재 '+current+', 필요 '+required+'.',
      (faction||'評判')+'評判が不足しています。現在 '+current+', 必要 '+required+'.',
      (faction||'声誉')+'声誉不足。当前 '+current+'，需要 '+required+'.'
    );
  }
  if(err==='PREREQUISITE_NOT_MET') return tl('Complete the prerequisite chapter first.','선행 챕터를 먼저 완료해야 합니다.','先行チャプターを先に完了してください。','请先完成前置章节。');
  if(err==='LEVEL_REQUIRED'){
    var requiredLevel=payload&&payload.requiredLevel!=null?payload.requiredLevel:0;
    return tl(
      requiredLevel?'Required level '+requiredLevel+' or higher.':'Required level not met.',
      requiredLevel?'레벨 '+requiredLevel+' 이상 필요합니다.':'레벨 조건이 부족합니다.',
      requiredLevel?'レベル '+requiredLevel+' 以上が必要です。':'レベル条件が不足しています。',
      requiredLevel?'需要 '+requiredLevel+' 级以上。':'等级条件不足。'
    );
  }
  if(err==='BLOCKED_BY_TAG') return tl('This chapter is blocked by your current state.','현재 상태에서는 이 챕터를 시작할 수 없습니다.','現在の状態ではこのチャプターを開始できません。','当前状态下无法开始本章节。');
  if(err==='BRANCH_REQUIRED') return tl('This chapter requires a prior route choice.','이 챕터에 필요한 이전 선택 분기가 없습니다.','このチャプターに必要な前の選択分岐がありません。','本章节缺少所需的前置选择分支。');
  if(err==='FSP_DELEGATION_ABSENT') return tl('The delegation state changed. Continue through the alternate FSP chapter.','대표단 조건이 바뀌어 대체 FSP 챕터로 진행해야 합니다.','代表団の状態が変わったため、代替FSPチャプターで進めてください。','代表团状态已变,请通过备用 FSP 章节继续。');
  if(err==='FSP_POLITICAL_COLLAPSE') return tl('The political state collapsed. Continue through the alternate FSP chapter.','정치 상황이 붕괴되어 대체 FSP 챕터로 진행해야 합니다.','政治状況が崩壊したため、代替FSPチャプターで進めてください。','政治局势已崩溃,请通过备用 FSP 章节继续。');
  return err;
}

function showCampaignStartBlocked(ch,payload){
  var npc=(ch&&ch.briefing&&ch.briefing.npcName)||'Mission Control';
  var reason=campaignStartErrorMessage(ch,payload);
  var lines=((ch&&ch.briefing||{}).lines||[]).map(function(l){return '<div class="campaign-dialog"><b>'+escapeHtmlSafe(npc)+'</b><br>'+escapeHtmlSafe(_campaignStoryText(l)||l.ko||'')+'</div>';}).join('');
  var meta='';
  if(ch&&ch.location){
    var loc=_campaignStoryText(ch.location.displayName)||ch.location.displayNameKo||ch.location.displayNameEn||'Mars';
    meta+='<div class="campaign-desc" style="margin-bottom:8px">'+escapeHtmlSafe(loc)+'</div>';
  }
  meta+='<div class="campaign-dialog" style="border-color:rgba(255,80,30,.35);color:var(--gold)">'+escapeHtmlSafe(reason)+'</div>';
  _setCampaignModal(ch, meta+lines+campaignObjectivesHtml(ch,4)+'<button class="campaign-btn" style="margin-top:12px" onclick="closeCampaignModal()">'+t('campaign_result_confirm')+'</button>');
}

function showCampaignBriefing(ch,p){
  var npc=(ch.briefing&&ch.briefing.npcName)||'Mission Control';
  var lines=((ch.briefing||{}).lines||[]).map(function(l){return '<div class="campaign-dialog"><b>'+escapeHtmlSafe(npc)+'</b><br>'+escapeHtmlSafe(_campaignStoryText(l)||l.ko||'')+'</div>';}).join('');
  var choices=(ch.choices||[]).map(function(c){
    return '<button class="campaign-choice" onclick="chooseCampaignOption(\''+escapeHtmlSafe(c.id)+'\')">'+escapeHtmlSafe(_campaignStoryText(c.label)||c.labelKo||c.id)+'</button>';
  }).join('');
  _setCampaignModal(ch, lines+campaignObjectivesHtml(ch,4)+'<div style="font-size:10px;color:var(--gold);margin:12px 0">⚠ '+escapeHtmlSafe((ch.environment&&ch.environment.type)||'operation')+' · '+t('campaign_meta_sim')+'</div>'+choices);
}

async function chooseCampaignOption(choiceId){
  var w=walletState.address, a=_campaignActive;
  if(!w||!a){showToast(tl('Campaign session missing','캠페인 세션이 없습니다','キャンペーンセッションがありません','缺少战役会话'));return;}
  try{
    var r=await fetch('/api/campaign/choice',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId,choice_id:choiceId})});
    var d=await r.json();
    if(!r.ok){showToast(srvErr(d.error)||tl('Choice failed','선택에 실패했습니다','選択に失敗しました','选择失败'),'error');return;}
    a.progress=d.progress||a.progress;
    // [depth #A] 서버가 선택을 확정한 직후에만 "YOU CHOSE" 1회성 강조 팝업을 띄운다.
    try{ _campaignChoiceMadePopup(a.chapter,choiceId); }catch(_){}
    try{loadCampaignStatus();}catch(_){}
    showCampaignSim(a.chapter,a.progress);
  }catch(e){showToast(tl('Choice failed','선택에 실패했습니다','選択に失敗しました','选择失败'));}
}

// [depth #A] 분기 선택 영구성 강조 — 'YOU CHOSE [route]' 1회성 팝업 (sessionStorage 중복 억제).
// 서버가 choice 를 확정한 직후에만 호출된다. 표시 전용 — 진행/보상 로직 무변경.
function _campaignChoiceMadePopup(ch,choiceId){
  if(!ch) return;
  var sid=(_campaignActive&&_campaignActive.sessionId)||'';
  var key='campaignChoiceShown:'+sid+':'+choiceId;
  try{ if(sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'1'); }catch(_){}
  // 라우트/파벌 라벨 — _setCampaignModal 과 동일 규칙으로 챕터에서 파생 (날조 없음).
  var route=((ch.campaignId||'').replace('_route','')||ch.faction||'mcc').toUpperCase();
  var choiceLabel='';
  try{
    var list=(ch.choices||[]);
    for(var i=0;i<list.length;i++){ if(list[i]&&list[i].id===choiceId){ choiceLabel=_campaignStoryText(list[i].label)||list[i].labelKo||''; break; } }
  }catch(_){}
  var titleTxt=tl('YOU CHOSE','선택했습니다','選択しました','你已选择');
  var routeTxt=tl('Route','루트','ルート','路线');
  var permTxt=tl('This choice is permanent. It shapes the chapters ahead.',
                 '이 선택은 영구적입니다. 앞으로의 챕터에 영향을 줍니다.',
                 'この選択は永続的です。今後の章に影響します。',
                 '此选择是永久的，将影响后续章节。');
  var okTxt=tl('CONTINUE','계속','続ける','继续');
  var old=document.getElementById('campaignChoiceMadeModal'); if(old) old.remove();
  var el=document.createElement('div');
  el.id='campaignChoiceMadeModal';
  el.style.cssText='position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  el.dataset.openedAt=String(Date.now());
  el.onclick=function(e){
    if(e.target!==el) return;
    if(Date.now()-parseInt(el.dataset.openedAt||'0',10)<350) return;
    el.remove();
  };
  el.innerHTML='<div style="max-width:340px;width:100%;background:linear-gradient(180deg,rgba(20,16,32,.98),rgba(12,9,20,.98));border:1px solid rgba(255,209,102,.45);border-radius:14px;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.6);text-align:center">'
    +'<div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#ffd166">'+escapeHtmlSafe(titleTxt)+'</div>'
    +'<div style="font-size:9px;letter-spacing:1px;color:var(--tx3);margin-top:4px">'+escapeHtmlSafe(route+' '+routeTxt)+'</div>'
    +(choiceLabel?('<div style="font-size:14px;font-weight:800;color:#fff;margin:14px 4px 4px;line-height:1.35">"'+escapeHtmlSafe(choiceLabel)+'"</div>'):'')
    +'<div style="font-size:10px;color:#ffab40;margin:14px 0 16px;line-height:1.5">🔒 '+escapeHtmlSafe(permTxt)+'</div>'
    +'<button type="button" data-action="closeChoiceMade" style="width:100%;padding:11px;border-radius:9px;background:linear-gradient(90deg,#ffd166,#ff9030);border:0;color:#1a1208;font-family:var(--fn);font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer">'+escapeHtmlSafe(okTxt)+'</button>'
    +'</div>';
  el.addEventListener('click',function(ev){
    var btn=ev.target.closest&&ev.target.closest('button[data-action="closeChoiceMade"]');
    if(!btn) return;
    ev.stopPropagation();
    el.remove();
  });
  document.body.appendChild(el);
}

function showCampaignSim(ch,p){
  _campaignClearSimTimer();
  var radio=((ch.briefing||{}).radio||[])[0];
  var _radioText=_campaignStoryText(radio)||(radio&&radio.ko)||t('campaign_sim_radio_default');
  var _npcName=escapeHtmlSafe((ch.briefing&&ch.briefing.npcName)||'Mission Control');
  _setCampaignModal(ch,
    '<div style="font-size:13px;color:var(--tx);margin-bottom:10px">'+t('campaign_sim_in_progress')+'</div>'
    +'<div class="campaign-dialog">'+_npcName+' '+t('campaign_sim_radio_prefix')+' '+escapeHtmlSafe(_radioText)+'</div>'
    +'<div class="qc-bar" style="height:10px;margin:16px 0"><div id="campaignSimFill" class="qc-fill activity" style="width:0%"></div></div>'
    +'<div id="campaignSimStatus" style="font-size:10px;color:var(--gold);text-align:center">'+t('campaign_sim_syncing')+'</div>'
    +'<div id="campaignSimDetail" style="font-size:8px;color:var(--tx3);text-align:center;margin-top:6px">'+t('campaign_sim_detail')+'</div>'
    +'<div id="campaignSimObjectives" style="margin-top:12px"></div>');
  pollCampaignProgress(true);
}

async function pollCampaignProgress(immediate){
  _campaignClearSimTimer();
  var w=walletState.address, a=_campaignActive;
  if(!w||!a||!a.sessionId) return;
  if(!_pageIsActive()||!_campaignSimIsOpen()) return;
  try{
    var r=await fetch('/api/campaign/progress',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId})});
    var d=await r.json();
    if(!r.ok){showToast(srvErr(d.error)||tl('Campaign progress failed','캠페인 진행 조회에 실패했습니다','キャンペーン進行の取得に失敗しました','获取战役进度失败'),'error');return;}
    a.progress=d.progress||a.progress;
    var preview=d.preview||{};
    var pct=Math.max(0,Math.min(100,Number(preview.progressPct||preview.oxygenRecoveryPct||0)));
    var fill=document.getElementById('campaignSimFill');
    var status=document.getElementById('campaignSimStatus');
    var detail=document.getElementById('campaignSimDetail');
    var objectivesEl=document.getElementById('campaignSimObjectives');
    var objectives=Array.isArray(d.objectives)?d.objectives:(Array.isArray(preview.objectives)?preview.objectives:[]);
    var missing=Array.isArray(d.missingObjectives)?d.missingObjectives:(Array.isArray(preview.missingObjectives)?preview.missingObjectives:[]);
    if(fill) fill.style.width=pct+'%';
    if(status) status.textContent=(LANG==='ko'?'작전 진행률 ':LANG==='ja'?'作戦進行率 ':LANG==='zh'?'作战进度 ':'Operation progress ')+Math.round(pct)+'%';
    var _remLbl=LANG==='ko'?'남은 시간':LANG==='ja'?'残り時間':LANG==='zh'?'剩余时间':'Time left';
    var _elLbl=LANG==='ko'?'경과':LANG==='ja'?'経過':LANG==='zh'?'已经过':'Elapsed';
    if(detail) detail.textContent=_remLbl+' '+_campaignFormatDuration(preview.remainingSec||0)+' · '+_elLbl+' '+_campaignFormatDuration(preview.elapsedSec||0);
    var _objWarnMsg=LANG==='ko'?'남은 목표를 완료해야 결과를 받을 수 있습니다.':LANG==='ja'?'残りの目標を完了してください。':LANG==='zh'?'请先完成剩余目标。':'Complete remaining objectives first.';
    if(objectivesEl&&objectives.length){
      objectivesEl.innerHTML=(pct>=100&&missing.length?'<div style="font-size:10px;color:var(--gold);margin-bottom:6px;text-align:center">'+_objWarnMsg+'</div>':'')
        +campaignObjectivesHtml({objectives:objectives},4);
    }
    if(preview.readyToComplete){
      completeCampaignMission();
      return;
    }
    if(pct>=100&&missing.length){
      if(status) status.textContent=t('campaign_objectives_gate');
      if(detail) detail.textContent=missing[0]?(_campaignStoryText(missing[0].label)||missing[0].labelKo||t('campaign_objectives_gate_sub')):t('campaign_objectives_gate_sub');
      _scheduleCampaignProgress(5000);
      return;
    }
    _scheduleCampaignProgress(immediate?1200:3000);
  }catch(e){
    _scheduleCampaignProgress(5000);
  }
}

_onPageVisible(function(){
  if(_campaignSimIsOpen()&&_campaignActive&&_campaignActive.sessionId&&!_campaignSimTimer){
    pollCampaignProgress(true);
  }
});

async function completeCampaignMission(){
  var w=walletState.address, a=_campaignActive;
  if(!w||!a) return;
  try{
    var r=await fetch('/api/campaign/complete',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId})});
    var d=await r.json();
    if(!r.ok){
      if(d.error==='MISSION_IN_PROGRESS'){
        showCampaignSim(a.chapter,a.progress||{});
        return;
      }
      if(d.error==='OBJECTIVE_REQUIREMENTS_NOT_MET'){
        var objectives=d.objectives||(d.chapter&&d.chapter.objectives)||d.missingObjectives||[];
        var html='<div style="font-size:13px;color:var(--gold);margin-bottom:8px">'+t('campaign_objectives_gate')+'</div>'
          +'<div class="campaign-dialog">'+t('campaign_objectives_gate_sub')+'</div>'
          +campaignObjectivesHtml({objectives:objectives},5)
          +'<button class="campaign-btn" style="margin-top:12px" onclick="showCampaignSim(_campaignActive.chapter,_campaignActive.progress||{})">'+t('campaign_result_recheck')+'</button>';
        _setCampaignModal(d.chapter||a.chapter,html);
        return;
      }
      showToast(srvErr(d.error)||tl('Campaign complete failed','캠페인 완료에 실패했습니다','キャンペーン完了に失敗しました','战役完成失败'),'error');return;
    }
    showCampaignResult(a.chapter,d.progress,d);
    loadCampaignStatus();
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(tl('Campaign complete failed','캠페인 완료에 실패했습니다','キャンペーン完了に失敗しました','战役完成失败'));}
}

function showCampaignResult(ch,p,result){
  var m=(result&&result.metrics)||p.metrics||{};
  var rw=(result&&result.rewards)||p.rewards||{};
  var ok=(result&&result.success)!==false && campaignProgressStatus(p)!=='failed';
  var html='<div style="font-size:18px;color:'+(ok?'var(--gn)':'var(--mars)')+';font-weight:900;margin-bottom:10px">'+(ok?t('campaign_result_success'):t('campaign_result_failure'))+'</div>';
  html+=campaignStatsHtml(m,campaignStatusLabel(p,'RESULT')).replace('campaign-stats','campaign-result-grid');
  html+='<div class="campaign-dialog"><b>'+escapeHtmlSafe((ch.briefing&&ch.briefing.npcName)||'Mission Control')+'</b><br>'+(ok?t('campaign_result_npc_success'):t('campaign_result_npc_failure'))+'</div>';
  html+='<div style="font-size:11px;color:var(--gold);line-height:1.8">'+t('campaign_result_reward')+' +'+(rw.GP||0)+' GP · +'+(rw.XP||0)+' XP'+((rw.items&&rw.items.length)?' · Blueprint queued':'')+'</div>';
  html+='<button class="campaign-btn" style="margin-top:12px" onclick="closeCampaignModal()">'+t('campaign_result_confirm')+'</button>';
  _setCampaignModal(ch,html);
}
