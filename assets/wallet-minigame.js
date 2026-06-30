/* ══════════════════════════════════════════════════
   Wallet & Chain (No MetaMask — deposit address only)
   ══════════════════════════════════════════════════ */

// Chain configs (for display & deposit address routing)
var CHAINS={
  base:{
    chainId:'0x2105',chainIdDec:8453,name:'Base',
    explorer:'https://basescan.org',color:'#5BB8E8',symbol:'ETH',decimals:6
  },
  bnb:{
    chainId:'0x38',chainIdDec:56,name:'BNB Chain',
    explorer:'https://bscscan.com',color:'#E8B040',symbol:'BNB',decimals:18
  },
  eth:{
    chainId:'0x1',chainIdDec:1,name:'Ethereum',
    explorer:'https://etherscan.io',color:'#A080E0',symbol:'ETH',decimals:6
  }
};

// Wallet state (DB-based, no on-chain provider)
var walletState={
  connected:false,
  address:null,
  chain:'base',
  usdtBalance:0,
  gameUsdt:0,
  gamePP:0
};

function walletReadJson(key, url, minGap, auth) {
  var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('wallet:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function shortAddr(addr){
  return addr?addr.slice(0,6)+'...'+addr.slice(-4):'--';
}

// [v7.175 Task 2] 오늘의 추천 행동 카드 — opsQuick 자리 동적 콘텐츠.
//   우선순위: ① 미완료 일일 미션 → ② 진행중 캠페인 → ③ 진행중 시즌 → ④ 기본(상자 개봉)
//   클릭 시 적절한 화면 라우팅. 비로그인 시 카드 숨김.
// [v7.176] 커스텀 select 모달 — 모바일 native dropdown 차단(게임 분위기 깨짐 방지).
//   기존 <select> 는 hidden 으로 두고, trigger 버튼 클릭 → 풀스크린 모달.
//   호환성: select.value 갱신 + 'change' 이벤트 발동 → 기존 onchange 콜백 그대로 동작.
function openSelectModal(selectId, title){
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var opts = Array.prototype.map.call(sel.options, function(o){ return { value:o.value, label:o.textContent||o.value }; });
  var current = sel.value;
  var old = document.getElementById('customSelectModal'); if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'customSelectModal';
  el.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:flex-end;justify-content:center;background:rgba(4,6,12,.78);backdrop-filter:blur(6px);animation:crFade .15s ease';
  el.onclick = function(e){ if (e.target===el) el.remove(); };
  var rows = opts.map(function(o){
    var active = (o.value === current);
    return '<button type="button" data-val="'+escapeHtmlSafe(o.value).replace(/"/g,'&quot;')+'" style="width:100%;padding:14px 18px;border:none;background:'+(active?'rgba(184,140,255,.18)':'transparent')+';border-bottom:1px solid rgba(255,255,255,.06);color:'+(active?'#caa8ff':'#fff')+';font-family:var(--fn);font-size:13px;font-weight:'+(active?'900':'600')+';text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px">'
      + '<span style="width:14px;height:14px;border-radius:50%;border:2px solid '+(active?'#caa8ff':'rgba(255,255,255,.3)')+';background:'+(active?'#caa8ff':'transparent')+';flex:0 0 auto"></span>'
      + '<span>'+escapeHtmlSafe(o.label)+'</span></button>';
  }).join('');
  el.innerHTML =
    '<div style="width:100%;max-width:540px;max-height:75vh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;background:linear-gradient(180deg,rgba(20,16,30,.98),rgba(10,12,22,.98));border:1px solid rgba(184,140,255,.4);border-bottom:none;box-shadow:0 -10px 40px rgba(0,0,0,.6);animation:crSlideUp .25s ease">'
    +   '<div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between">'
    +     '<div style="font-size:11px;font-weight:900;letter-spacing:1.5px;color:#caa8ff">'+escapeHtmlSafe(title||'SELECT')+'</div>'
    +     '<button type="button" onclick="document.getElementById(\'customSelectModal\').remove()" style="background:none;border:none;color:rgba(255,255,255,.5);font-size:18px;cursor:pointer;padding:0 4px">×</button>'
    +   '</div>'
    +   '<div style="overflow-y:auto;flex:1">'+rows+'</div>'
    + '</div>';
  // delegated click for option buttons
  el.querySelectorAll('[data-val]').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.getAttribute('data-val') || '';
      sel.value = v;
      // 트리거 label 즉시 갱신
      var lbl = document.getElementById(selectId+'Label');
      var opt = Array.prototype.find.call(sel.options, function(o){ return o.value===v; });
      if (lbl && opt) lbl.textContent = (opt.textContent||v).trim();
      try { sel.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) { if (typeof sel.onchange==='function') sel.onchange(); }
      el.remove();
    });
  });
  document.body.appendChild(el);
}
// keyframes for slide-up
if (!document.getElementById('_crSlideUpKf')) {
  var _kfStyle = document.createElement('style');
  _kfStyle.id = '_crSlideUpKf';
  _kfStyle.textContent = '@keyframes crSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(_kfStyle);
}

function updateDailyHint(){
  // [v7.195] 오늘의 추천 카드 제거 — early return. 호출자(claim fan-out) 가 여전히 호출하지만 no-op.
  //   향후 carousel 부활 시 이 early return 만 제거. _setDailyHint / dailyHintClick 도 그대로 보존.
  return;
  /* dead code below — kept for quick rollback
  var card = document.getElementById('opsQuick');
  if (!card) return;
  if (!walletState || !walletState.connected) { card.style.display='none'; return; }
  card.style.display = '';
  var btn = document.getElementById('dailyHintBtn'); */
  // 폴백 기본값 (캠페인/미션 로드 실패 시)
  // [v7.185] 폴백 아이콘 🎲 → 📅 (달력) — 가챠보다 "오늘의 추천 행동" 정체성에 맞게.
  _setDailyHint('📅', tl("TODAY'S OPS","오늘의 추천","今日のオプス",'今日推荐'), tl('Open a Ship Crate','상자 개봉하기','艦船ボックスを開ける','开启舰船宝箱'), tl('Free Recruit daily','매일 무료 상자','毎日無料','每日免费'), 'openGacha');
  // 1) 미완료 일일 미션 — dailyOps 또는 daily missions 사용
  try {
    walletReadJson('daily-ops', '/api/daily-ops/'+encodeURIComponent(walletState.address), 30000).then(function(d){
      if (!d) return;
      var pending = (d.missions||[]).find(function(m){ return m && !m.completed && !m.claimed; });
      if (pending) {
        _setDailyHint('🎯', tl("TODAY'S OPS","오늘의 작전","今日のオプス",'今日作战'), pending.title || pending.id, (pending.progress!=null && pending.target ? (pending.progress+'/'+pending.target) : tl('In progress','진행 중','進行中','进行中')), 'openBaseQuests');
        return;
      }
      // 2) 진행중 캠페인 fallback
      walletReadJson('campaign-status', '/api/campaign/status/'+encodeURIComponent(walletState.address), 30000).then(function(c){
        if (!c) return;
        var active = (c.chapters||[]).find(function(ch){ return ch && ch.progress && ch.progress.status && ch.progress.status !== 'completed' && ch.progress.status !== 'claimed'; });
        if (active) {
          _setDailyHint('⚡', tl('CAMPAIGN','캠페인','キャンペーン','战役'), active.title || active.id, tl('Continue your story','이야기 이어가기','物語を続ける','继续你的故事'), 'openCampaignHub');
          return;
        }
        // 3) 시즌 진행 fallback — 기본값 유지
      }).catch(function(){});
    }).catch(function(){});
  } catch(_) {}
}
function _setDailyHint(icon, label, title, sub, actionKey){
  var i=document.getElementById('dailyHintIcon'); if(i) i.textContent=icon;
  var l=document.getElementById('dailyHintLabel'); if(l) l.textContent=label;
  var t=document.getElementById('dailyHintTitle'); if(t) t.textContent=title;
  var s=document.getElementById('dailyHintSub'); if(s) s.textContent=sub||'';
  var btn=document.getElementById('dailyHintBtn'); if(btn) btn.dataset.action=actionKey||'';
}
function dailyHintClick(){
  var btn=document.getElementById('dailyHintBtn');
  var action=(btn&&btn.dataset.action)||'openGacha';
  try {
    if (action==='openGacha' && typeof openGacha==='function') return openGacha();
    if (action==='openBaseQuests' && typeof openBaseModal==='function') { openBaseModal(); try{switchBaseTab('quests',document.querySelector('[onclick*=quests]'));}catch(_){} return; }
    if (action==='openCampaignHub' && typeof openCampaignHub==='function') return openCampaignHub();
  } catch(_) {}
}

function updateWalletUI(){
  var el;
  if((el=document.getElementById('walletCTA'))) el.style.display='none';
  if((el=document.getElementById('walletSection'))) el.style.display='';
  if((el=document.getElementById('alertsSection'))) el.style.display='';
  if((el=document.getElementById('walletAddr'))) el.textContent=walletState.address;
  // [v7.175 Task 1] 로그인 상태일 때 MY ASSETS 메인 상단 버튼 노출
  // [v7.181] 신규 topbar inline 버튼(#tbMyAssetsBtnTop) 사용. 구 floating 버튼(#tbMyAssetsBtn)은 항상 숨김.
  var maBtnOld = document.getElementById('tbMyAssetsBtn');
  if (maBtnOld) maBtnOld.classList.remove('show');
  var maBtnTop = document.getElementById('tbMyAssetsBtnTop');
  if (maBtnTop) maBtnTop.style.display = (walletState && walletState.connected) ? 'inline-flex' : 'none';
  try{loadActiveEffects()}catch(e){}
  // [v7.175 Task 2] 로그인 직후 추천 행동 카드 갱신
  try{ updateDailyHint(); }catch(_){}
  // Load equipped title badge
  if (walletState.address) {
    walletReadJson('user-titles', '/api/user/titles', 30000)
      .then(function(d) {
        if (!d) return;
        var badge = document.getElementById('equippedTitleBadge');
        if (!badge) return;
        if (d.equipped) {
          var lang = window._currentLang || 'en';
          var titleTxt = d.equipped['title_'+lang] || d.equipped.title_en || d.equipped.title_code;
          badge.style.display = '';
          badge.innerHTML = '<span style="font-size:9px;color:var(--gold);font-family:var(--fn);background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.25);border-radius:3px;padding:1px 6px">🎖 '+escapeHtmlSafe(titleTxt)+'</span>';
        } else {
          badge.style.display = 'none';
        }
      }).catch(function(){});
  }
}

function escapeHtmlSafe(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateChainUI(){
  var ch=walletState.chain||'base';
  var cfg=CHAINS[ch];
  if(!cfg)return;
  var ind=document.getElementById('chainIndicator');
  if(ind){
    ind.style.display='flex';
    ind.style.borderColor=cfg.color+'44';
    ind.style.color=cfg.color;
  }
  var cdt=document.getElementById('chainDotTop');
  if(cdt) cdt.className='chain-dot '+ch;
  var cnt=document.getElementById('chainNameTop');
  if(cnt) cnt.textContent=cfg.name.toUpperCase();
  var wc=document.getElementById('walletChain');
  if(wc){wc.textContent=cfg.name;wc.style.color=cfg.color;}
  var cdp=document.getElementById('chainDotPanel');
  if(cdp) cdp.className='chain-dot '+ch;
  try{selectChain(ch);}catch(e){}
}

function selectChain(ch){
  selectedChain=ch;
  document.getElementById('chainBase').classList.toggle('sel',ch==='base');
  document.getElementById('chainBnb').classList.toggle('sel',ch==='bnb');
  document.getElementById('chainEth').classList.toggle('sel',ch==='eth');
}

// ── Deposit Modal (address display) ──
var depChain='base';

function openDepositModal(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  document.getElementById('depCurBal').textContent=walletState.gameUsdt.toFixed(2)+' USDT';
  selectDepChain(depChain);
  updateDepositAddr();
  document.getElementById('depositModal').classList.add('open');
  // [v7.167] 첫 입금 보너스 강조 — 자격 있으면 배너 노출
  try {
    var banner = document.getElementById('depFirstBonusBanner');
    if (banner) banner.style.display = 'none'; // reset (혹시 이전 호출 잔여)
    walletReadJson('deposit-bonus-info', '/api/wallet/deposit-bonus-info', 30000)
      .then(function(d){
        if (!d || !banner) return;
        if (d.first_deposit_eligible && d.first_deposit_bonus_pct > 0) {
          var titleEl = document.getElementById('depFirstBonusTitle');
          var bodyEl  = document.getElementById('depFirstBonusBody');
          if (titleEl) titleEl.textContent = tl('FIRST DEPOSIT BONUS','첫 입금 보너스','初回入金ボーナス','首次充值奖励');
          if (bodyEl) {
            bodyEl.innerHTML = tl(
              'Your <b>first</b> deposit gets an extra <b style="color:#ffd166">+'+d.first_deposit_bonus_pct+'%</b> PP on top of the base <b>+'+d.base_bonus_pct+'%</b>. <span style="color:#69f0ae">Total +'+d.total_bonus_pct_if_first+'% PP — one-time offer.</span>',
              '<b>첫</b> 입금에는 기본 <b>+'+d.base_bonus_pct+'%</b>에 추가로 <b style="color:#ffd166">+'+d.first_deposit_bonus_pct+'%</b> PP 보너스. <span style="color:#69f0ae">총 +'+d.total_bonus_pct_if_first+'% PP — 일회성 기회.</span>',
              '<b>初回</b>入金は基本<b>+'+d.base_bonus_pct+'%</b>に加えて<b style="color:#ffd166">+'+d.first_deposit_bonus_pct+'%</b>PPボーナス。<span style="color:#69f0ae">合計 +'+d.total_bonus_pct_if_first+'% PP — 一回限り。</span>',
              '<b>首次</b>充值在基础<b>+'+d.base_bonus_pct+'%</b>之上额外赠送<b style="color:#ffd166">+'+d.first_deposit_bonus_pct+'%</b>PP。<span style="color:#69f0ae">合计 +'+d.total_bonus_pct_if_first+'% PP — 限一次。</span>'
            );
          }
          banner.style.display = '';
        }
      })
      .catch(function(){});
  } catch(_) {}
}
function closeDepositModal(){document.getElementById('depositModal').classList.remove('open')}

function selectDepChain(ch){
  depChain=ch;
  document.getElementById('depChainBase').classList.toggle('sel',ch==='base');
  document.getElementById('depChainBnb').classList.toggle('sel',ch==='bnb');
  document.getElementById('depChainEth').classList.toggle('sel',ch==='eth');
  updateDepositAddr();
}

function updateDepositAddr(){
  var el=document.getElementById('depAddrDisplay');
  if(el) el.textContent=walletState.address||'--';
}

function copyDepositAddr(){
  var addr=walletState.address;
  if(!addr){showToast(tl('NO ADDRESS','주소 없음','アドレスなし','无地址'));return}
  navigator.clipboard.writeText(addr).then(function(){
    showToast(tl('ADDRESS COPIED!','주소 복사됨!','アドレスをコピーしました!','地址已复制!'));
  }).catch(function(){
    // Fallback
    var ta=document.createElement('textarea');
    ta.value=addr;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    showToast(tl('ADDRESS COPIED!','주소 복사됨!','アドレスをコピーしました!','地址已复制!'));
  });
}

// ── Withdraw Modal ──
function openWithdrawModal(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  document.getElementById('wdrAvail').textContent=walletState.gameUsdt.toFixed(2)+' USDT';
  document.getElementById('wdrAmount').value='';
  document.getElementById('withdrawModal').classList.add('open');
}
function closeWithdrawModal(){document.getElementById('withdrawModal').classList.remove('open')}

// ── Export Private Key (자동 커스터디 키 열람 + 면책) ──
function openExportKeyModal(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  // reset state
  document.getElementById('exportKeyWarn').style.display='';
  document.getElementById('exportKeyResult').style.display='none';
  var ack=document.getElementById('exportKeyAck'); if(ack) ack.checked=false;
  var btn=document.getElementById('exportKeyRevealBtn'); if(btn) btn.disabled=true;
  document.getElementById('exportKeyAddr').textContent='';
  document.getElementById('exportKeyPriv').textContent='';
  document.getElementById('exportKeyModal').classList.add('open');
}
function closeExportKeyModal(){
  document.getElementById('exportKeyModal').classList.remove('open');
  // 보안: 닫을 때 화면의 키 제거
  document.getElementById('exportKeyPriv').textContent='';
  document.getElementById('exportKeyResult').style.display='none';
}
function confirmRevealKey(){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  if(!(typeof emailAuth!=='undefined'&&emailAuth&&emailAuth.token)){ showToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  var pw=(document.getElementById('exportKeyPw')||{}).value||'';
  if(!pw){ showToast(tl('Enter your password','비밀번호를 입력하세요','パスワードを入力','请输入密码'),'error'); return; }
  var btn=document.getElementById('exportKeyRevealBtn'); if(btn){ btn.disabled=true; btn.textContent='...'; }
  fetch('/api/auth/reveal-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:emailAuth.token,password:pw})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){
        document.getElementById('exportKeyAddr').textContent=d.address||'';
        document.getElementById('exportKeyPriv').textContent=d.privateKey||'';
        document.getElementById('exportKeyWarn').style.display='none';
        document.getElementById('exportKeyResult').style.display='';
      } else {
        // [v7.171 A-M2 fix] reveal-key 에러 4언어 — 기존엔 no_custodial_key 1개만 다국어, 나머지는 영문 raw.
        var em = {
          no_custodial_key: tl('This account has no exportable key (external wallet).','이 계정은 내보낼 키가 없습니다(외부 지갑).','このアカウントにエクスポート可能な鍵はありません','此账户无可导出密钥'),
          invalid_password: tl('Incorrect password.','비밀번호가 일치하지 않습니다.','パスワードが正しくありません','密码不正确'),
          invalid_token: tl('Session expired — please log in again.','세션이 만료됐습니다 — 다시 로그인하세요.','セッション期限切れ — 再ログインしてください','会话已过期，请重新登录'),
          rate_limited: tl('Too many attempts — try again later.','시도 횟수 초과 — 잠시 후 다시 시도하세요.','試行回数超過 — 後で再試行','尝试次数过多，请稍后再试'),
          server_error: tl('Server error — try again.','서버 오류 — 다시 시도하세요.','サーバーエラー — 再試行してください','服务器错误，请重试')
        };
        var msg = em[d.error] || d.message || d.error || tl('Failed','실패','失敗','失败');
        showToast(msg,'error');
        if(btn){ btn.disabled=false; btn.textContent=t('export_key_reveal_btn')||'REVEAL PRIVATE KEY'; }
      }
    })
    .catch(function(e){ showToast(tl('Error:','오류:','エラー:','错误:')+' '+e.message,'error'); if(btn){ btn.disabled=false; } });
}
function copyExportKey(){
  var pk=document.getElementById('exportKeyPriv').textContent||'';
  if(!pk) return;
  try{ navigator.clipboard.writeText(pk); showToast(tl('Key copied — store it safely','키 복사됨 — 안전하게 보관하세요','鍵をコピーしました','密钥已复制 — 请妥善保管'),'success'); }
  catch(_){ showToast(tl('Copy failed','복사 실패','コピー失敗','复制失败'),'error'); }
}
function setWdrMax(){document.getElementById('wdrAmount').value=walletState.gameUsdt.toFixed(2)}

// ═══════════════════════════════════════
//  PP → GP EXCHANGE
// ═══════════════════════════════════════
var _exchInfo = { rate:10, min:0.1, max:5, fee:5, dailyLimit:50, enabled:true };

async function openExchangeModal(){
  if(!walletState.connected){ showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')); return; }
  try{
    var d = await walletReadJson('pp-to-gp-info', '/api/exchange/pp-to-gp/info', 30000, false);
    if(d.rate) _exchInfo = d;
  }catch(e){}
  document.getElementById('exchPPBal').textContent = (walletState.gamePP||0).toFixed(2)+' PP';
  document.getElementById('exchGPBal').textContent = Math.floor(walletState.gameGP||0)+' GP';
  document.getElementById('exchRate').textContent = '1 PP = '+_exchInfo.rate+' GP';
  document.getElementById('exchFee').textContent = _exchInfo.fee+'%';
  document.getElementById('exchDailyLeft').textContent = _exchInfo.dailyLimit;
  document.getElementById('exchAmount').value = '';
  document.getElementById('exchReceive').textContent = '0 GP';
  document.getElementById('exchangeModal').classList.add('open');
}
function closeExchangeModal(){ document.getElementById('exchangeModal').classList.remove('open'); }
function setExchMax(){
  var max = Math.min(walletState.gamePP||0, _exchInfo.max);
  document.getElementById('exchAmount').value = max.toFixed(2);
  updateExchangePreview();
}
function updateExchangePreview(){
  var amt = parseFloat(document.getElementById('exchAmount').value)||0;
  var fee = amt * (_exchInfo.fee/100);
  var gp = Math.floor((amt-fee)*_exchInfo.rate);
  document.getElementById('exchReceive').textContent = gp.toLocaleString()+' GP';
}
async function confirmExchange(){
  var amt = parseFloat(document.getElementById('exchAmount').value);
  if(!amt||amt<=0){ showToast(tl('ENTER AMOUNT','금액을 입력하세요','金額を入力','请输入金额')); return; }
  if(amt > (walletState.gamePP||0)){ showToast(tl('INSUFFICIENT PP','PP 부족','PP不足','PP不足')); return; }
  try{
    var resp = await fetch('/api/exchange/pp-to-gp',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(emailAuth&&emailAuth.token||'')},
      body:JSON.stringify({ wallet:walletState.address, amount:amt })
    });
    var d = await resp.json();
    if(!resp.ok){ showToast(srvErr(d.error)||tl('EXCHANGE FAILED','환전 실패','交換失敗','兑换失败'),'error'); return; }
    walletState.gamePP = d.ppBalance!=null ? d.ppBalance : (walletState.gamePP-amt);
    walletState.gameGP = d.gpBalance!=null ? d.gpBalance : (walletState.gameGP+(d.gpReceived||0));
    refreshEmailBalances();
    closeExchangeModal();
    showToast('💱 '+amt.toFixed(2)+' PP → '+(d.gpReceived||0)+' GP','success');
    addFeed('💱 '+shortAddr(walletState.address)+' '+tl('exchanged','환전함','交換','兑换了')+' '+amt.toFixed(1)+' PP → '+(d.gpReceived||0)+' GP');
  }catch(e){ showToast(tl('EXCHANGE FAILED','환전 실패','交換失敗','兑换失败')); console.error(e); }
}

// ═══════════════════════════════════════
//  MINI-GAME OVERLAY (Guild War Games)
// ═══════════════════════════════════════
var _mgCurrentGame = null;    // 'invaders'|'runner'|'digger'
var _mgCurrentEngine = null;  // MarsInvaders|MarsRunner|MarsDigger
var _mgWarId = null;
var _mgContinueNum = 0;
var _mgFinalScore = 0;
var _mgContinueCosts = { gpCosts:[5,15,30], ppBase:0.1, ppMult:2, maxContinues:10 };

function openMinigameOverlay(warId){
  _mgWarId = warId;
  _mgCurrentGame = null;
  _mgCurrentEngine = null;
  _mgContinueNum = 0;
  document.getElementById('mgSelectPanel').style.display = '';
  document.getElementById('mgCanvasWrap').style.display = 'none';
  document.getElementById('mgContinueOverlay').style.display = 'none';
  document.getElementById('mgWarInfo').textContent = tl('War #','전쟁 #','戦争 #','战争 #')+warId+tl(' — Play games to earn points for your guild!',' — 게임을 플레이해 길드 점수를 획득하세요!',' — ゲームをプレイしてギルドのポイントを獲得!',' — 玩游戏为公会赢取积分!');
  // Load continue costs
  walletReadJson('war-continue-cost', '/api/guild/war/continue-cost', 30000, false).then(function(d){
    if(d.gpCosts) _mgContinueCosts = d;
  }).catch(function(){});
  document.getElementById('minigameOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMinigameOverlay(){
  if(_mgCurrentEngine){ try{ _mgCurrentEngine.stop(); }catch(e){} }
  _mgCurrentEngine = null;
  _mgCurrentGame = null;
  document.getElementById('minigameOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function backToGameSelect(){
  if(_mgCurrentEngine){ try{ _mgCurrentEngine.stop(); }catch(e){} }
  _mgCurrentEngine = null;
  _mgCurrentGame = null;
  document.getElementById('mgCanvasWrap').style.display = 'none';
  document.getElementById('mgContinueOverlay').style.display = 'none';
  document.getElementById('mgSelectPanel').style.display = '';
}

function launchMinigame(type){
  _mgCurrentGame = type;
  _mgContinueNum = 0;
  document.getElementById('mgSelectPanel').style.display = 'none';
  document.getElementById('mgCanvasWrap').style.display = '';
  document.getElementById('mgContinueOverlay').style.display = 'none';
  var canvas = document.getElementById('mgCanvas');
  var engines = { invaders: window.MarsInvaders, runner: window.MarsRunner, digger: window.MarsDigger };
  _mgCurrentEngine = engines[type];
  if(!_mgCurrentEngine){ showToast(tl('Game not found','게임을 찾을 수 없음','ゲームが見つかりません','找不到游戏')); return; }
  _mgCurrentEngine.init(canvas, function(score){
    // Game ended - show continue overlay
    _mgFinalScore = score;
    showContinueOverlay(score);
  });
  _mgCurrentEngine.start();
}

function showContinueOverlay(score){
  var ov = document.getElementById('mgContinueOverlay');
  ov.style.display = 'flex';
  document.getElementById('mgFinalScore').textContent = tl('SCORE: ','점수: ','スコア: ','分数: ')+score;
  var nextNum = _mgContinueNum + 1;
  var btn = document.getElementById('mgContinueBtn');
  if(nextNum > _mgContinueCosts.maxContinues){
    btn.style.display = 'none';
    document.getElementById('mgContinueCost').textContent = tl('Max continues reached','컨티뉴 한도 도달','コンティニュー上限に達しました','已达续命上限');
    return;
  }
  btn.style.display = '';
  var costText = '';
  var gc = _mgContinueCosts.gpCosts;
  if(nextNum <= gc.length){
    costText = gc[nextNum-1]+' GP';
    btn.style.background = 'linear-gradient(135deg,#00E676,#00C853)';
    btn.style.color = '#000';
  }else{
    var ppCost = _mgContinueCosts.ppBase * Math.pow(_mgContinueCosts.ppMult, nextNum - gc.length - 1);
    costText = ppCost.toFixed(2)+' PP';
    btn.style.background = 'linear-gradient(135deg,#B388FF,#7C4DFF)';
    btn.style.color = '#fff';
  }
  document.getElementById('mgContinueCost').textContent = tl('Continue #','컨티뉴 #','コンティニュー #','续命 #')+nextNum+': '+costText;
  btn.textContent = tl('CONTINUE','컨티뉴','コンティニュー','续命')+' ('+costText+')';
}

async function payAndContinue(){
  if(!_mgCurrentEngine || !_mgWarId) return;
  var nextNum = _mgContinueNum + 1;
  try{
    var resp = await fetch('/api/guild/war/continue',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(emailAuth&&emailAuth.token||'')},
      body:JSON.stringify({ wallet:walletState.address, warId:_mgWarId, continueNum:nextNum })
    });
    var d = await resp.json();
    if(!resp.ok){ showToast(srvErr(d.error)||tl('CONTINUE FAILED','컨티뉴 실패','コンティニュー失敗','续命失败'),'error'); return; }
    // Update balances
    if(d.ppBalance!=null) walletState.gamePP = d.ppBalance;
    if(d.gpBalance!=null) walletState.gameGP = d.gpBalance;
    refreshEmailBalances();
    // Continue the game
    _mgContinueNum = nextNum;
    document.getElementById('mgContinueOverlay').style.display = 'none';
    _mgCurrentEngine.continueGame();
    showToast('▶ '+tl('CONTINUE!','컨티뉴!','コンティニュー!','续命!')+' ('+tl('paid','지불','支払い','已支付')+' '+d.paid.amount+(d.paid.type==='pp'?' PP':' GP')+')');
  }catch(e){ showToast(tl('CONTINUE FAILED','컨티뉴 실패','コンティニュー失敗','续命失败')); console.error(e); }
}

async function submitMinigameScore(){
  if(!_mgCurrentEngine) return;
  var score = _mgCurrentEngine.getScore();
  document.getElementById('mgContinueOverlay').style.display = 'none';
  try{
    var resp = await fetch('/api/guild/war/score',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(emailAuth&&emailAuth.token||'')},
      body:JSON.stringify({ wallet:walletState.address, warId:_mgWarId, gameType:_mgCurrentGame, score:score })
    });
    var d = await resp.json();
    if(!resp.ok){ showToast(srvErr(d.error)||tl('SUBMIT FAILED','제출 실패','送信失敗','提交失败'),'error'); return; }
    showToast('🎮 '+tl('Score','점수','スコア','分数')+' '+score+' '+tl('submitted!','제출됨!','送信完了!','已提交!')+' ('+tl('Plays left:','남은 플레이:','残りプレイ:','剩余次数:')+' '+(d.playsRemaining||0)+')','success');
    // Go back to game select
    _mgCurrentEngine = null;
    document.getElementById('mgCanvasWrap').style.display = 'none';
    document.getElementById('mgSelectPanel').style.display = '';
    if(d.playsRemaining!=null) document.getElementById('mgPlaysLeft').textContent = d.playsRemaining+' '+tl('plays remaining today','회 오늘 남음','回 本日残り','次 今日剩余');
  }catch(e){ showToast(tl('SUBMIT FAILED','제출 실패','送信失敗','提交失败')); console.error(e); }
}

// ═══════════════════════════════════════
//  MISSION MINIGAME (invasion/exploration bonus)
// ═══════════════════════════════════════
var _missionMgId = null;       // mission id to claim after game
var _missionMgType = null;     // 'invasion' | 'exploration'

function playMissionMinigame(missionId, missionType){
  _missionMgId = missionId;
  _missionMgType = missionType;
  _mgWarId = null; // not guild war mode
  _mgCurrentGame = null;
  _mgCurrentEngine = null;
  _mgContinueNum = 0;
  // Show game select panel
  document.getElementById('mgSelectPanel').style.display = '';
  document.getElementById('mgCanvasWrap').style.display = 'none';
  document.getElementById('mgContinueOverlay').style.display = 'none';
  var typeLabel = missionType==='invasion' ? '⚔️ '+tl('INVASION BONUS','침공 보너스','侵攻ボーナス','入侵奖励') : '🛰 '+tl('EXPLORATION BONUS','탐사 보너스','探査ボーナス','探索奖励');
  document.getElementById('mgWarInfo').textContent = typeLabel+tl(' — Play a game to boost your rewards!',' — 게임을 플레이해 보상을 늘리세요!',' — ゲームをプレイして報酬を増やそう!',' — 玩游戏提升你的奖励!');
  document.getElementById('minigameOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function _isMissionMinigame(){ return _missionMgId && !_mgWarId; }

// Override submit for mission mode
var _origSubmitMinigameScore = submitMinigameScore;
submitMinigameScore = async function(){
  if(!_isMissionMinigame()) return _origSubmitMinigameScore();
  // Mission mode: claim with score
  if(!_mgCurrentEngine) return;
  var score = _mgCurrentEngine.getScore();
  document.getElementById('mgContinueOverlay').style.display = 'none';
  _mgCurrentEngine.stop();
  _mgCurrentEngine = null;
  closeMinigameOverlay();
  // Calculate bonus preview
  var bonus = 1.0;
  if(score>=2000) bonus=2.0;
  else if(score>=1000) bonus=1.8;
  else if(score>=500) bonus=1.5;
  else if(score>=300) bonus=1.3;
  else if(score>=100) bonus=1.15;
  showToast('🎮 '+tl('Score:','점수:','スコア:','分数:')+' '+score+' → '+tl('Bonus:','보너스:','ボーナス:','奖励:')+' '+bonus+'x','success');
  // Claim mission with minigame score
  try{
    var resp = await fetch('/api/missions/'+_missionMgId+'/claim',{
      method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address, minigameScore:score})
    });
    var d = await resp.json();
    _missionMgId = null;
    _missionMgType = null;
    if(d.error){ showAlert(d.error); return; }
    var r = d.mission.reward||{};
    var parts=[];
    if(r.pp>0) parts.push(r.pp.toFixed(3)+' PP');
    if(r.gp>0) parts.push(r.gp+' GP');
    if(r.xp>0) parts.push(r.xp+' XP');
    if(r.item) parts.push(r.item.name);
    if(!parts.length) parts.push(tl('No reward','보상 없음','報酬なし','无奖励'));
    var bonusTag = r.minigameBonus>1 ? ' (🎮×'+r.minigameBonus+')' : '';
    showAlert('✓ '+parts.join(' · ')+bonusTag,'success');
    if(d.mission.type==='invasion'){try{trackQuestAction('complete_invasion',1)}catch(e){}}
    if(d.mission.type==='exploration'){try{trackQuestAction('complete_exploration',1)}catch(e){}}
    loadOpsTab();
    if(typeof loadUserData==='function') loadUserData();
  }catch(e){ showAlert(tl('Claim failed:','수령 실패:','受取失敗:','领取失败:')+' '+e.message); }
};

// Override payAndContinue for mission mode (free continues, no payment)
var _origPayAndContinue = payAndContinue;
payAndContinue = async function(){
  if(!_isMissionMinigame()) return _origPayAndContinue();
  // Mission mode: free continue (limited to 1)
  if(_mgContinueNum >= 1){ showToast(LANG==='ko'?'미션 미니게임은 컨티뉴 1회만 가능':LANG==='ja'?'ミッションミニゲームのコンティニューは1回のみ':LANG==='zh'?'任务小游戏只能继续1次':'Mission mini-game: continue limited to 1'); return; }
  _mgContinueNum = 1;
  document.getElementById('mgContinueOverlay').style.display = 'none';
  _mgCurrentEngine.continueGame();
  showToast('▶ '+tl('FREE CONTINUE!','무료 컨티뉴!','無料コンティニュー!','免费续命!'));
};

// Override showContinueOverlay for mission mode
var _origShowContinueOverlay = showContinueOverlay;
showContinueOverlay = function(score){
  if(!_isMissionMinigame()) return _origShowContinueOverlay(score);
  var ov = document.getElementById('mgContinueOverlay');
  ov.style.display = 'flex';
  document.getElementById('mgFinalScore').textContent = tl('SCORE: ','점수: ','スコア: ','分数: ')+score;
  _mgFinalScore = score;
  var btn = document.getElementById('mgContinueBtn');
  if(_mgContinueNum >= 1){
    btn.style.display = 'none';
    document.getElementById('mgContinueCost').textContent = tl('No more continues','더 이상 컨티뉴 불가','これ以上コンティニュー不可','无法继续续命');
  } else {
    btn.style.display = '';
    btn.style.background = 'linear-gradient(135deg,#00E676,#00C853)';
    btn.style.color = '#000';
    btn.textContent = tl('FREE CONTINUE','무료 컨티뉴','無料コンティニュー','免费续命');
    document.getElementById('mgContinueCost').textContent = LANG==='ko'?'무료 컨티뉴 1회 (미션 보너스)':LANG==='ja'?'無料コンティニュー1回 (ミッションボーナス)':LANG==='zh'?'免费续命1次 (任务奖励)':'FREE CONTINUE ×1 (Mission Bonus)';
  }
};

async function confirmWithdraw(){
  var amt=parseFloat(document.getElementById('wdrAmount').value);
  if(!amt||amt<=0){showToast(tl('ENTER AMOUNT','금액을 입력하세요','金額を入力','请输入金额'));return}
  if(amt>walletState.gameUsdt){showToast(tl('INSUFFICIENT BALANCE','잔액 부족','残高不足','余额不足'));return}

  var btn=document.getElementById('wdrConfirmBtn');
  btn.textContent=tl('REQUESTING...','요청 중...','リクエスト中...','请求中...');btn.disabled=true;

  try{
    var resp=await fetch('/api/withdraw',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
      body:JSON.stringify({amount:amt,chain:walletState.chain||'base'})
    });
    var d=await resp.json();
    if(!resp.ok){showToast(srvErr(d.error)||tl('WITHDRAW FAILED','출금 실패','出金失敗','提现失败'),'error');return}

    walletState.gameUsdt=d.usdtBalance!=null?d.usdtBalance:walletState.gameUsdt-amt;
    refreshEmailBalances();
    closeWithdrawModal();
    showToast(tl('WITHDRAWAL REQUESTED:','출금 요청됨:','出金リクエスト済み:','提现已请求:')+' '+amt.toFixed(2)+' USDT');
    try{_sfx.purchase()}catch(e){}
    addFeed('💸 '+shortAddr(walletState.address)+' '+tl('withdrew','출금함','出金','提现了')+' $'+amt.toFixed(2));
  }catch(e){
    showToast(tl('WITHDRAW FAILED','출금 실패','出金失敗','提现失败'));
    console.error(e);
  }finally{
    btn.textContent=tl('REQUEST WITHDRAWAL','출금 요청','出金リクエスト','请求提现');btn.disabled=false;
  }
}

// ── Swap Modal (PP → USDT) ──
var _swpFeePct = 0.05; // [v7.168] 서버 setting 으로 동적 갱신
function openSwapModal(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  document.getElementById('swpPPBal').textContent=walletState.gamePP.toFixed(2)+' PP';
  document.getElementById('swpAmount').value='';
  document.getElementById('swpReceive').textContent='0.00 USDT';
  document.getElementById('swapModal').classList.add('open');
  // [v7.168] swap fee % 동적 표시 — admin 변경 즉시 반영 (이전엔 5% 하드코딩)
  try {
    walletReadJson('pp-to-gp-info-swap', '/api/exchange/pp-to-gp/info', 30000, false).then(function(d){
      // pp-to-gp/info 는 GP 환전 정보 — swap 은 별도. 차라리 swap 전용 info 가 없으니 cfg 노출 안 함.
    }).catch(function(){});
    walletReadJson('public-swap-info', '/api/public/swap-info', 30000, false).then(function(d){
      if (d && typeof d.fee_percent === 'number') {
        _swpFeePct = d.fee_percent / 100;
        var el = document.getElementById('swpFeePctDisplay'); if (el) el.textContent = d.fee_percent + '%';
      }
    }).catch(function(){});
  } catch(_) {}
}
function closeSwapModal(){document.getElementById('swapModal').classList.remove('open')}
function setSwpMax(){
  document.getElementById('swpAmount').value=walletState.gamePP.toFixed(2);
  updateSwapPreview();
}
function updateSwapPreview(){
  var amt=parseFloat(document.getElementById('swpAmount').value)||0;
  var fee=amt*_swpFeePct;
  document.getElementById('swpReceive').textContent=(amt-fee).toFixed(2)+' USDT ('+tl('fee:','수수료:','手数料:','手续费:')+' '+fee.toFixed(2)+')';
}

async function confirmSwap(){
  var amt=parseFloat(document.getElementById('swpAmount').value);
  if(!amt||amt<=0){showToast(tl('Enter amount','금액을 입력하세요','金額を入力','请输入金额'));return}
  if(amt>walletState.gamePP){showToast(tl('Insufficient PP','PP 부족','PP不足','PP不足'));return}
  var fee=amt*_swpFeePct;
  var received=amt-fee;

  try{
    var resp=await fetch('/api/swap',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
      body:JSON.stringify({amount:amt})
    });
    var d=await resp.json();
    if(!resp.ok){
      // [v7.168] swap 에러 4언어 매핑(이전 영문 only) — 환금 풀 부족이 가장 자주 발생
      var em = {
        swap_pool_insufficient: tl('Swap pool insufficient — try a smaller amount or later','환금 풀이 부족합니다 — 금액을 줄이거나 잠시 후 다시 시도하세요','スワッププールが不足しています','兑换池余额不足'),
        amount_too_small: tl('Amount too small','금액이 너무 적습니다','金額が小さすぎます','金额过小'),
        insufficient_pp: tl('Insufficient PP balance','PP 잔액 부족','PP残高不足','PP余额不足'),
        invalid_amount: tl('Invalid amount','유효하지 않은 금액','無効な金額','无效金额')
      };
      showToast(em[d.error] || d.error || tl('Swap failed','환금 실패','スワップ失敗','兑换失败'));
      return;
    }

    walletState.gamePP=d.ppBalance!=null?d.ppBalance:walletState.gamePP-amt;
    walletState.gameUsdt=d.usdtBalance!=null?d.usdtBalance:walletState.gameUsdt+received;
    refreshEmailBalances();
    closeSwapModal();
    showToast(tl('SWAPPED','환금 완료','スワップ完了','兑换完成')+' '+amt.toFixed(2)+' PP → '+received.toFixed(2)+' USDT');
    addFeed('🔄 '+shortAddr(walletState.address)+' '+tl('swapped','환금함','スワップ','兑换了')+' '+amt.toFixed(0)+' PP');
  }catch(e){
    showToast(tl('SWAP FAILED','환금 실패','スワップ失敗','兑换失败'));
    console.error(e);
  }
}
