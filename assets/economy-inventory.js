/* ── UI Helpers ──────────────────────────────────── */
/* ── Mobile Nav Icon Customization ─────────────── */
// To replace emoji icons with custom images, set paths here:
// Example: NAV_ICONS.myland = '/assets/nav/myland.png';
var NAV_ICONS = { myland:null, cantina:null, claim:null, shop:null, base:null };
function applyNavIcons(){
  document.querySelectorAll('.mob-nav-item .nav-icon[data-icon]').forEach(function(el){
    var key=el.getAttribute('data-icon');
    if(NAV_ICONS[key]){
      el.innerHTML='<img src="'+NAV_ICONS[key]+'" style="width:22px;height:22px;object-fit:contain" alt="'+key+'">';
    }
  });
}
// Call after page load or when icons are updated
setTimeout(applyNavIcons, 100);

/* ── Item Shop ──────────────────────────────────── */
var _shopItems=[];
var _shopInventory=[];
var _shopCurFilter='all';
var _shopShowingInventory=false;
var _shopConfirmCb=null;
function _economyReadFetch(key, url, auth, minGap) {
  var walletKey = (walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('economy:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: auth ? { headers: getAuthHeaders() } : {}
    });
  }
  return fetch(url, auth ? { headers: getAuthHeaders() } : {}).then(function(r){ return r.json(); });
}
function shopConfirm(icon,title,msg,btnText){
  return new Promise(function(resolve){
    _shopConfirmCb=resolve;
    document.getElementById('shopConfirmIcon').textContent=icon||'🛒';
    document.getElementById('shopConfirmTitle').textContent=title||tl('Confirm','확인','確認','确认');
    document.getElementById('shopConfirmMsg').innerHTML=msg||'';
    document.getElementById('shopConfirmBtn').textContent=btnText||tl('CONFIRM','확인','確認','确认');
    document.getElementById('shopConfirmModal').style.display='flex';
  });
}
function _shopConfirmResolve(val){
  document.getElementById('shopConfirmModal').style.display='none';
  if(_shopConfirmCb){_shopConfirmCb(val);_shopConfirmCb=null;}
}

var _activeEffects=[];
var _activeEffectsRefreshTimer=null;
var ACTIVE_EFFECT_LEGACY_MAX_MS=24*60*60*1000;
function _effectExpiryMs(e){
  if(!e)return null;
  var raw=e.expires_at||e.expiresAt||e.ends_at||e.endsAt||e.expires;
  if(!raw)return null;
  var t=new Date(raw).getTime();
  return Number.isFinite(t)?t:null;
}
function _effectIcon(e){
  if(e&&e.icon)return e.icon;
  var type=e&&e.effect_type;
  if(type==='attack_boost'||type==='siege_ram')return '🔥';
  if(type==='mining_boost'||type==='harvest_surge')return '⛏️';
  if(type==='pixel_doubler'||type==='xp_amplifier')return '✨';
  if(type==='stealth_cloak'||type==='decoy_beacon')return '👻';
  if(type==='radar_scan'||type==='territory_scan'||type==='recall_beacon')return '📡';
  if(type==='gp_generator'||type==='lucky_charm')return '🪙';
  return '⚡';
}
function _clearActiveEffectsRefresh(){
  if(!_activeEffectsRefreshTimer)return;
  _clearActiveTimeout(_activeEffectsRefreshTimer);
  _activeEffectsRefreshTimer=null;
}
function _filterLiveEffects(effects){
  var now=Date.now();
  return (Array.isArray(effects)?effects:[]).filter(function(e){
    if(!e||e.active===false)return false;
    if(e.uses_remaining!=null&&Number(e.uses_remaining)<=0)return false;
    var exp=_effectExpiryMs(e);
    if(exp!=null){
      if(exp<=now)return false;
    }else if(e.uses_remaining!=null&&e.activated_at){
      var activatedAt=new Date(e.activated_at).getTime();
      if(Number.isFinite(activatedAt)&&activatedAt+ACTIVE_EFFECT_LEGACY_MAX_MS<=now)return false;
    }
    return true;
  });
}
function _formatEffectTimeLeft(e){
  var exp=_effectExpiryMs(e);
  if(exp==null)return '';
  var mins=Math.max(0,Math.round((exp-Date.now())/60000));
  var hh=Math.floor(mins/60), mm=mins%60;
  return hh>0?(hh+'h'+(mm>0?(' '+mm+'m'):'')):(mins+'m');
}
function _formatEffectRemaining(e){
  if(!e)return '';
  var parts=[];
  if(e.uses_remaining!=null) parts.push(e.uses_remaining+(LANG==='ko'?'회':LANG==='ja'?'回':LANG==='zh'?'次':' uses'));
  var timeLeft=_formatEffectTimeLeft(e);
  if(timeLeft) parts.push(timeLeft);
  return parts.join(' · ');
}
function _fetchActiveEffects(){
  var w=(walletState&&walletState.address)||'';
  if(!w)return Promise.resolve([]);
  var walletKey=String(w).toLowerCase();
  if(typeof _guardedJsonFetch==='function'){
    return _guardedJsonFetch('shop-active-effects:'+walletKey, '/api/shop/active-effects', {
      minGap: 3000,
      backoffMs: 120000,
      fetchOptions: { headers: getAuthHeaders() }
    }).then(function(effects){
      return effects===null ? _activeEffects : effects;
    }).catch(function(){return _activeEffects||[];});
  }
  return fetch('/api/shop/active-effects', { headers: getAuthHeaders() }).then(function(r){return r.json()});
}
function _scheduleActiveEffectsRefresh(){
  _clearActiveEffectsRefresh();
  var nextAt=null, now=Date.now();
  (_activeEffects||[]).forEach(function(e){
    var t=_effectExpiryMs(e);
    if(t>now&&(nextAt===null||t<nextAt))nextAt=t;
  });
  if(nextAt!==null){
    _activeEffectsRefreshTimer=_setActiveTimeout(function(){
      loadActiveEffects();
      try{ if(typeof loadBaseInventory==='function')loadBaseInventory(); }catch(_){}
    }, Math.max(1000, nextAt-now+500));
  }
}
function loadActiveEffects(){
  var w=(walletState&&walletState.address)||'';
  if(!w){
    _activeEffects=[];
    _clearActiveEffectsRefresh();
    renderActiveBuffs();
    return Promise.resolve([]);
  }
  return _fetchActiveEffects().then(function(effects){
    _activeEffects=_filterLiveEffects(effects);
    renderActiveBuffs();
    _scheduleActiveEffectsRefresh();
    return _activeEffects;
  }).catch(function(){});
}
function renderActiveBuffs(){
  var el=document.getElementById('tbActiveBuffs');
  if(!el)return;
  _activeEffects=_filterLiveEffects(_activeEffects);
  if(_activeEffects.length===0){el.style.display='none';return;}
  var catMap={attack_boost:'attack',stealth_cloak:'utility',mining_boost:'boost',pixel_doubler:'boost',radar_scan:'utility'};
  el.style.display='flex';
  el.innerHTML=_activeEffects.map(function(e){
    var cat=catMap[e.effect_type]||'utility';
    var nm=_itemName(e.effect_type)||e.name||'';
    // [v7.343] 남은시간 명확화: 'Nh Mm'(예 3h 12m) — 'h'를 'x'로 오인하던 문제. 효과명도 배지에 직접 표기(부모 pointer-events:none이라 title 호버 안 먹음).
    var dur=_formatEffectRemaining(e);
    var label=_effectIcon(e)+' '+nm+(dur?(' · '+dur):'');
    return '<div class="tb-buff '+cat+'" title="'+nm.replace(/"/g,'&quot;')+'">'+label+'</div>';
  }).join('');
}

// Legacy: openItemShop now routes to BASE modal → SHOP tab (single source of truth).
// The old standalone #shopModal is kept in the DOM but is no longer opened anywhere.
function openItemShop(){
  try{ openBaseModal(); }catch(_){}
  setTimeout(function(){
    // Find SHOP tab directly by data-i18n attribute
    var shopTab = document.querySelector('.base-tab[data-i18n="base_tab_shop"]');
    if(shopTab){
      shopTab.click();
      // Switch to shop view (store, not inventory)
      setTimeout(function(){
        switchBaseShopView('shop', document.querySelectorAll('.base-shop-view')[0]);
      },50);
    }
  }, 100);
}
function openMyItems(){
  try{ openBaseModal(); }catch(_){}
  setTimeout(function(){
    var itemsTab = document.getElementById('baseTabItems');
    if(itemsTab){
      try{ switchBaseTab('items', itemsTab); }catch(_){}
      try{ loadBaseInventory(); }catch(_){}
      try{ clearBaseTabDot('items'); }catch(_){}
    }
  }, 100);
}
function closeItemShop(){
  var m=document.getElementById('shopModal'); if(m) m.classList.remove('open');
}

function loadShopData(){
  // Update balance display
  var w=(walletState&&walletState.address)||'';
  if(w){
    // Use live wallet state + daily GP (refreshed via refreshEmailBalances)
    try{ if(typeof refreshEmailBalances==='function') refreshEmailBalances(); }catch(_){}
    document.getElementById('shopBalPP').textContent=(walletState.gamePP||0).toFixed(1)+' PP';
    document.getElementById('shopBalUSDT').textContent=(walletState.gameUsdt||0).toFixed(2)+' USDT';
    var gpEl=document.getElementById('shopBalGP');
    if(gpEl) gpEl.textContent=Math.floor((walletState&&walletState.gameGP)||(_dailyState&&_dailyState.gpBalance)||0)+' GP';
  }
  // Load items
  _economyReadFetch('shop-items', '/api/shop/items', false, 15000).then(function(items){
    if (!items) return;
    if(!items||!Array.isArray(items)){console.error('Shop items: invalid response');return;}
    _shopItems=items;
    renderShopItems();
  }).catch(function(e){
    console.error('Shop load:',e);
    document.getElementById('shopItemsGrid').innerHTML='<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--red);font-size:var(--fs-sm)">'+tl('Failed to load items','아이템을 불러오지 못했습니다','アイテムを読み込めませんでした','无法加载物品')+'</div>';
  });
  // Load inventory
  if(w){
    _economyReadFetch('shop-inventory', '/api/shop/inventory', true, 10000).then(function(inv){
      if (!inv) return;
      _shopInventory=inv;
    }).catch(function(){});
  }
}

function renderShopItems(){
  var grid=document.getElementById('shopItemsGrid');
  var filtered=_shopCurFilter==='all'?_shopItems:_shopItems.filter(function(i){return i.category===_shopCurFilter});
  if(filtered.length===0){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--tx3);font-size:var(--fs-sm)">'+tl('No items in this category','이 카테고리에 아이템이 없습니다','このカテゴリにアイテムがありません','此分类下没有物品')+'</div>';
    return;
  }
  grid.innerHTML=filtered.map(function(item){
    var owned=_shopInventory.find(function(inv){return inv.item_type_id===item.id});
    var ownedQty=owned?owned.quantity:0;
    var durTxt=item.category==='cosmetic'?tl('Permanent','영구','永続','永久'):item.duration_hours>0?item.duration_hours+tl('h duration','시간 지속','時間持続','小时持续'):tl('Single use','1회 사용','1回使用','单次使用');
    var gpPrice=parseFloat(item.price_gp||0);
    var gpBtn=gpPrice>0
      ? '<span class="si-price gp" style="background:linear-gradient(135deg,#FFD166,#FF9030);color:#000;font-weight:700" onclick="event.stopPropagation();buyShopItem(\''+item.code+'\',\'GP\')">'+gpPrice.toFixed(0)+' GP</span>'
      : '';
    return '<div class="shop-item-card" data-code="'+item.code+'">'
      +'<span class="si-cat '+item.category+'">'+item.category+'</span>'
      +'<span class="si-icon">'+item.icon+'</span>'
      +'<div class="si-name">'+(_itemName(item.code)||item.name)+'</div>'
      +'<div class="si-desc">'+(_itemDesc(item.code)||item.description)+'</div>'
      +'<div class="si-effect">'+durTxt+(item.effect_value?' · '+item.effect_value+(item.category==='defense'?tl('% absorb','% 흡수','% 吸収','% 吸收'):item.code==='attack_boost'?tl('% boost','% 강화','% 強化','% 提升'):tl('x effect','x 효과','x 効果','x 效果')):'')+'</div>'
      +'<div class="si-prices">'
      +'<span class="si-price pp" onclick="event.stopPropagation();buyShopItem(\''+item.code+'\',\'PP\')">'+parseFloat(item.price_pp).toFixed(1)+' PP</span>'
      +'<span class="si-price usdt" onclick="event.stopPropagation();buyShopItem(\''+item.code+'\',\'USDT\')">'+parseFloat(item.price_usdt).toFixed(1)+' USDT</span>'
      +gpBtn
      +'</div>'
      +(ownedQty>0?'<div class="si-owned">'+tl('Owned','보유','所持','拥有')+': '+ownedQty+'/'+item.max_stack+'</div>':'<div class="si-qty">'+tl('Max','최대','最大','上限')+': '+item.max_stack+'</div>')
      +'</div>';
  }).join('');
}

function shopFilterCat(cat,btn){
  _shopCurFilter=cat;
  document.querySelectorAll('.shop-cat-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  renderShopItems();
}

function shopSwitchTab(tab){
  _shopShowingInventory=(tab==='inv');
  document.getElementById('shopTabShop').classList.toggle('active',tab==='shop');
  document.getElementById('shopTabInv').classList.toggle('active',tab==='inv');
  document.getElementById('shopItemsGrid').style.display=tab==='shop'?'':'none';
  document.getElementById('shopInventoryView').style.display=tab==='inv'?'':'none';
  document.getElementById('shopCatTabs').style.display=tab==='shop'?'':'none';
  if(tab==='inv') renderShopInventory();
}

function renderShopInventory(){
  var list=document.getElementById('shopInventoryList');
  var w=(walletState&&walletState.address)||'';
  if(!w){list.innerHTML='<div style="text-align:center;padding:24px;color:var(--tx3);font-size:var(--fs-sm)">'+tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包')+'</div>';return;}
  _economyReadFetch('shop-inventory-view', '/api/shop/inventory', true, 5000).then(function(inv){
    if (!inv) return;
    _shopInventory=inv;
    var badge=document.getElementById('shopInvCount');
    var total=inv.reduce(function(s,i){return s+i.quantity},0);
    if(total>0){badge.textContent=total;badge.style.display='';}else{badge.style.display='none';}
    if(inv.length===0){
      list.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--tx3);font-size:var(--fs-sm)">'+tl('No items yet. Visit the shop!','아직 아이템이 없습니다. 상점을 방문하세요!','まだアイテムがありません。ショップをご覧ください！','暂无物品，去商店看看吧！')+'</div>';
      return;
    }
    list.innerHTML=inv.map(function(item){
      var needsClaim=item.code.indexOf('shield')===0||item.code==='emp_strike'||item.code==='orbital_strike'||item.code==='virus_payload'||item.code==='decoy_beacon';
      var isCosmetic=item.category==='cosmetic';
      return '<div class="inv-item">'
        +'<span class="inv-icon">'+item.icon+'</span>'
        +'<div class="inv-info">'
        +'<div class="inv-name">'+(_itemName(item.code)||item.name)+'</div>'
        +'<div class="inv-qty">×'+item.quantity+'</div>'
        +'</div>'
        +(isCosmetic
          ?'<button class="inv-use" style="color:#c088e0;border-color:rgba(180,100,255,.3)" onclick="closeItemShop();showToast(\'Select your territory then click CUSTOMIZE\')">'+tl('EQUIP ON LAND','영토에 장착','領地に装着','装备到领地')+'</button>'
          :needsClaim
          ?'<button class="inv-use" onclick="useShopItem(\''+item.code+'\',true)">'+tl('USE ON LAND','영토에 사용','領地で使用','在领地使用')+'</button>'
          :'<button class="inv-use" onclick="useShopItem(\''+item.code+'\',false)">'+tl('USE','사용','使用','使用')+'</button>')
        +'</div>';
    }).join('');
  }).catch(function(){list.innerHTML='<div style="text-align:center;color:var(--red);font-size:var(--fs-sm)">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'});
  // Render active effects in inventory view (with auto-renew toggles)
  var actSec=document.getElementById('shopActiveSection');
  var actList=document.getElementById('shopActiveList');
  _activeEffects=_filterLiveEffects(_activeEffects);
  if(_activeEffects.length>0){
    actSec.style.display='';
    actList.innerHTML=_activeEffects.map(function(e){
      var info=_effectIcon(e)+' <b>'+(_itemName(e.effect_type)||e.name)+'</b> — ';
      if(e.uses_remaining!==null) info+=e.uses_remaining+' '+tl('uses left','회 남음','回残り','次剩余');
      else if(_effectExpiryMs(e)!=null){
        var mins=Math.max(0,Math.round((_effectExpiryMs(e)-Date.now())/60000));
        info+=(mins>60?Math.floor(mins/60)+'h '+mins%60+'m':mins+'m')+' '+tl('left','남음','残り','剩余');
      }
      // Auto-renew toggle for duration-based effects
      var renewHTML='';
      if(_effectExpiryMs(e)!=null&&e.price_pp){
        var isOn=e.auto_renew===true;
        renewHTML='<div style="margin-top:4px;display:flex;align-items:center;gap:6px">'
          +'<span style="font-size:8px;color:var(--tx3)">'+tl('AUTO-RENEW','자동 갱신','自動更新','自动续期')+' ('+parseFloat(e.price_pp).toFixed(1)+' PP)</span>'
          +'<button onclick="toggleAutoRenew(\'effect\','+e.id+','+isOn+')" style="font-size:8px;padding:2px 8px;border-radius:4px;border:1px solid '+(isOn?'rgba(76,216,154,.4)':'rgba(255,255,255,.15)')+';background:'+(isOn?'rgba(76,216,154,.15)':'rgba(255,255,255,.05)')+';color:'+(isOn?'var(--gn)':'var(--tx3)')+';cursor:pointer;font-family:var(--fn)">'+(isOn?tl('ON','켜짐','オン','开'):tl('OFF','꺼짐','オフ','关'))+'</button>'
          +'</div>';
      }
      return '<div style="padding:6px 10px;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.2);border-radius:8px;font-size:var(--fs-xs);color:var(--gold);font-family:var(--fn)">'+info+renewHTML+'</div>';
    }).join('');
  }else{actSec.style.display='none';}
}

function buyShopItem(code,currency){
  try{_sfx.click()}catch(e){}
  if(!walletState||!walletState.address){showToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'),'error');return;}
  var w=walletState.address;
  // Look up item in whichever catalog has it (BASE shop tab vs standalone ITEM SHOP modal).
  var item=(_baseShopItems&&_baseShopItems.find(function(i){return (i.code||i.item_code)===code}))
        || (_shopItems&&_shopItems.find(function(i){return (i.code||i.item_code)===code}));
  if(!item){showToast(tl('Item not found','아이템을 찾을 수 없습니다','アイテムが見つかりません','未找到物品'),'error');return;}
  var price;
  if(currency==='USDT') price=parseFloat(item.price_usdt).toFixed(1)+' USDT';
  else if(currency==='GP') price=parseFloat(item.price_gp||0).toFixed(0)+' GP';
  else price=parseFloat(item.price_pp).toFixed(1)+' PP';
  shopConfirm(item.icon||'🛒',tl('Purchase Item','아이템 구매','アイテム購入','购买物品'),
    '<div style="font-size:16px;font-weight:700;color:var(--tx);margin-bottom:4px">'+(_itemName(code)||item.name)+'</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">'+price+'</div>',tl('BUY NOW','지금 구매','今すぐ購入','立即购买')
  ).then(function(ok){
    if(!ok)return;
    fetch('/api/shop/buy',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,itemCode:code,currency:currency,quantity:1})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');try{_sfx.error()}catch(e){}return;}
      showToast(tl('Purchased','구매 완료','購入完了','已购买')+' '+(_itemName(code)||item.name)+'!','success');
      try{trackQuestAction('buy_item',1)}catch(e){}
      try{_sfx.purchase()}catch(e){}
      // Refresh balances from server (PP/USDT always, GP needs daily endpoint)
      try{ if(typeof refreshEmailBalances==='function') refreshEmailBalances(); }catch(_){}
      if(currency==='GP'){
        try{ if(typeof checkDailyLogin==='function') checkDailyLogin(); }catch(_){}
      }
      // Refresh whichever shop UI is currently open
      try{ if(typeof loadBaseShopItems==='function') loadBaseShopItems(); }catch(_){}
      try{ if(typeof loadShopData==='function') loadShopData(); }catch(_){}
      // Also refresh inventory view inside BASE shop
      try{ if(typeof loadBaseInventory==='function') loadBaseInventory(); }catch(_){}
    }).catch(function(e){showToast(tl('Purchase failed','구매 실패','購入失敗','购买失败'),'error')});
  });
}

function useShopItem(code,needsClaim){
  if(!walletState||!walletState.address){showToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'),'error');return;}
  var w=walletState.address;
  var wl=(w||'').toLowerCase();
  if(needsClaim){
    // Case-insensitive owner match — claim.owner can be mixed-case from server
    var myClaims=claims.filter(function(c){return (c.owner||'').toLowerCase()===wl});
    if(myClaims.length===0){showToast(tl('You have no territories','보유한 영토가 없습니다','領地を保有していません','您没有任何领地'),'error');return;}
    var isEnemyTarget=code==='emp_strike'||code==='orbital_strike'||code==='virus_payload';
    if(isEnemyTarget){
      // These items target enemy claims
      var targetClaims;
      if(code==='emp_strike'||code==='orbital_strike'){
        targetClaims=claims.filter(function(c){return (c.owner||'').toLowerCase()!==wl && c.shield});
        if(targetClaims.length===0){showToast(tl('No shielded enemy territories found','방어막이 있는 적 영토가 없습니다','シールドのある敵領地がありません','未找到带护盾的敌方领地'),'error');return;}
      }else{
        targetClaims=claims.filter(function(c){return (c.owner||'').toLowerCase()!==wl});
        if(targetClaims.length===0){showToast(tl('No enemy territories found','적 영토를 찾을 수 없습니다','敵領地が見つかりません','未找到敌方领地'),'error');return;}
      }
      var label=code==='emp_strike'?tl('Select target to EMP','EMP 대상 선택','EMP対象を選択','选择EMP目标'):code==='orbital_strike'?tl('Select target to strike','공격 대상 선택','攻撃対象を選択','选择打击目标'):code==='virus_payload'?tl('Select target to infect','감염 대상 선택','感染対象を選択','选择感染目标'):tl('Select enemy target','적 대상 선택','敵対象を選択','选择敌方目标');
      _showClaimPicker(targetClaims,code,label);
    }else{
      _showClaimPicker(myClaims,code,tl('Select your territory','내 영토 선택','自分の領地を選択','选择您的领地'));
    }
  }else{
    var invItem=_shopInventory.find(function(i){return i.code===code});
    shopConfirm(invItem?invItem.icon:'⚡',tl('Use Item','아이템 사용','アイテム使用','使用物品'),
      '<div style="font-size:16px;font-weight:700;color:var(--tx);margin-bottom:4px">'+(_itemName(code)||(invItem?invItem.name:code))+'</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--tx3)">'+tl('This will activate immediately','즉시 활성화됩니다','すぐに有効化されます','将立即生效')+'</div>',tl('USE NOW','지금 사용','今すぐ使用','立即使用')
    ).then(function(ok){
      if(!ok)return;
      _doUseItem(w,code,null);
    });return;
  }
}
// Group adjacent claims (same owner) into merged territories — mirrors
// the server-side union-find used by mission launch pads. Two claims are
// considered touching if their bounding boxes are within ~1 grid cell.
function _cpGroupAdjacent(rows){
  var GRID=0.22;
  var n=rows.length;
  var parent=[]; for(var i=0;i<n;i++) parent.push(i);
  function find(x){ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; }
  function uni(a,b){ var ra=find(a),rb=find(b); if(ra!==rb) parent[ra]=rb; }
  for(var i=0;i<n;i++){
    var a=rows[i];
    var alat=parseFloat(a.lat), alng=parseFloat(a.lng);
    var aw=(a.w||1)*GRID/2, ah=(a.h||1)*GRID/2;
    for(var j=i+1;j<n;j++){
      var b=rows[j];
      // Only group same-owner adjacent claims
      if((a.owner||'').toLowerCase()!==(b.owner||'').toLowerCase()) continue;
      var blat=parseFloat(b.lat), blng=parseFloat(b.lng);
      var bw=(b.w||1)*GRID/2, bh=(b.h||1)*GRID/2;
      var margin=GRID*1.1;
      if(Math.abs(alat-blat)<ah+bh+margin && Math.abs(alng-blng)<aw+bw+margin) uni(i,j);
    }
  }
  var buckets={};
  for(var i=0;i<n;i++){
    var r=find(i);
    if(!buckets[r]) buckets[r]=[];
    buckets[r].push(rows[i]);
  }
  return Object.keys(buckets).map(function(k){ return buckets[k]; });
}
function _showClaimPicker(claimList,itemCode,title){
  // Remove any stale picker first (prevents stacking)
  document.querySelectorAll('.mbg.claim-picker').forEach(function(el){el.remove();});
  var bg=document.createElement('div');
  bg.className='mbg open claim-picker';
  bg.style.cssText='z-index:1200;display:flex';
  var mdl=document.createElement('div');
  mdl.className='mdl';
  mdl.style.cssText='max-width:380px;padding:16px';
  mdl.addEventListener('click',function(e){e.stopPropagation();});
  var w=(walletState&&walletState.address)||'';
  var inner='<div style="font-size:var(--fs-lg);font-weight:700;margin-bottom:12px;color:var(--mars)">'+title+'</div>'
    +'<div style="max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px">';
  if(!claimList||!claimList.length){
    inner+='<div style="padding:16px;text-align:center;color:var(--tx3);font-size:12px">'+tl('No valid targets found','유효한 대상이 없습니다','有効な対象がありません','未找到有效目标')+'</div>';
  }else{
    // Group adjacent claims into merged territories so the picker shows
    // one button per visible territory (matches the launch-pad picker)
    var groups=_cpGroupAdjacent(claimList);
    // Order by total pixel size, biggest first
    groups.sort(function(a,b){
      var ap=a.reduce(function(s,c){return s+(c.w||0)*(c.h||0);},0);
      var bp=b.reduce(function(s,c){return s+(c.w||0)*(c.h||0);},0);
      return bp-ap;
    });
    groups.forEach(function(grp){
      // Use largest claim in the group as the representative target
      var rep=grp.slice().sort(function(a,b){
        return ((b.w||0)*(b.h||0))-((a.w||0)*(a.h||0));
      })[0];
      var totalPx=grp.reduce(function(s,c){return s+(c.w||0)*(c.h||0);},0);
      var anyShield=grp.some(function(c){return c.shield;});
      var shieldInfo=anyShield?' <span style="color:#50C8FF;font-size:10px">🛡️</span>':'';
      var nicks=grp.map(function(c){return c.nickname;}).filter(function(x){return !!x;});
      var lbl=nicks[0]||rep.label||tl('Territory','영토','領地','领地');
      var sub=grp.length>1?(grp.length+' '+tl('merged','병합','統合','合并')):tl('1 claim','1개 클레임','1クレーム','1块领地');
      inner+='<button data-claim-id="'+rep.id+'" class="_cp-btn" '
        +'style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--tx1);cursor:pointer;width:100%;text-align:left;font-size:13px">'
        +'<span><strong>'+lbl+'</strong> <span style="color:var(--tx3);font-size:10px">· '+sub+'</span></span>'
        +'<span style="font-size:11px;color:var(--tx3)">'+Math.round(totalPx)+'px'+shieldInfo+'</span>'
        +'</button>';
    });
  }
  inner+='</div><button class="_cp-cancel" style="margin-top:12px;width:100%;padding:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--tx2);cursor:pointer;font-size:13px">'+tl('CANCEL','취소','キャンセル','取消')+'</button>';
  mdl.innerHTML=inner;
  bg.appendChild(mdl);
  bg.addEventListener('click',function(e){if(e.target===bg) bg.remove();});
  // Wire up buttons
  mdl.querySelectorAll('._cp-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var cid=parseInt(btn.getAttribute('data-claim-id'));
      bg.remove();
      _doUseItem(w,itemCode,cid);
    });
  });
  mdl.querySelector('._cp-cancel').addEventListener('click',function(){bg.remove();});
  document.body.appendChild(bg);
}
function _scanEsc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}
function _showTerritoryScanResult(scan){
  if(!scan||!scan.holders){return;}
  document.querySelectorAll('.mbg.territory-scan-report').forEach(function(el){el.remove();});
  var bg=document.createElement('div');
  bg.className='mbg open territory-scan-report';
  bg.style.cssText='z-index:1250;display:flex';
  var mdl=document.createElement('div');
  mdl.className='mdl';
  mdl.style.cssText='max-width:420px;padding:16px';
  mdl.addEventListener('click',function(e){e.stopPropagation();});
  var rows=scan.holders.map(function(h,i){
    var label=h.nickname||((h.wallet||'').slice(0,6)+'...'+(h.wallet||'').slice(-4));
    var cloak=h.cloaked?' <span style="color:var(--mars);font-size:9px">'+tl('CLOAKED','은폐','隠密','隐身')+'</span>':'';
    return '<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
      +'<span style="color:var(--tx3);font-size:10px">#'+(i+1)+'</span>'
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx1);font-size:11px">'+_scanEsc(label)+cloak+'</span>'
      +'<span style="color:var(--gold);font-size:10px">'+(h.pixels||0)+' px · '+(h.sharePct||0)+'%</span>'
      +'</div>';
  }).join('');
  mdl.innerHTML='<div style="font-size:15px;font-weight:800;color:var(--cyan);letter-spacing:1px;margin-bottom:4px">'+tl('TERRITORY SCAN','영토 스캔','領地スキャン','领地扫描')+'</div>'
    +'<div style="font-size:11px;color:var(--tx2);margin-bottom:12px">'+_scanEsc(scan.sectorName||tl('Sector','섹터','セクター','区域'))+' · '+_scanEsc(scan.tier||'')+' · '+tl('my','내','自分','我的')+' '+(scan.myPixels||0)+' px</div>'
    +'<div style="max-height:45vh;overflow-y:auto">'+(rows||'<div style="color:var(--tx3);font-size:11px;padding:12px">'+tl('No holders found','보유자가 없습니다','保有者がいません','未找到持有者')+'</div>')+'</div>'
    +'<button class="_scan-close" style="margin-top:12px;width:100%;padding:10px;background:rgba(91,184,232,.10);border:1px solid rgba(91,184,232,.35);border-radius:8px;color:var(--cyan);cursor:pointer;font-size:12px;font-weight:700">'+tl('CLOSE','닫기','閉じる','关闭')+'</button>';
  bg.appendChild(mdl);
  bg.addEventListener('click',function(e){if(e.target===bg) bg.remove();});
  mdl.querySelector('._scan-close').addEventListener('click',function(){bg.remove();});
  document.body.appendChild(bg);
}
function _doUseItem(w,code,claimId){
  fetch('/api/shop/use',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:w,itemCode:code,claimId:claimId})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');try{_sfx.error()}catch(e){}return;}
    showToast(d.item+' '+tl('activated!','활성화됨!','有効化！','已激活！'),'success');
    try{trackQuestAction('use_item',1)}catch(e){}
    try{code.indexOf('shield')===0?_sfx.shield():_sfx.purchase()}catch(e){}
    // Visual feedback based on item type
    if(code.indexOf('shield')===0&&claimId) _showItemEffect('shield',claimId);
    else if(code==='emp_strike'&&claimId) _showItemEffect('emp',claimId);
    else if(code==='stealth_cloak') _showItemEffect('stealth',null);
    else if(code==='radar_scan') _showItemEffect('radar',null);
    else if(code==='attack_boost') _showItemEffect('boost',null);
    else if(code==='pixel_doubler') _showItemEffect('doubler',null);
    else if(code==='mining_boost') _showItemEffect('mining',null);
    else if(code==='orbital_strike'&&claimId) _showItemEffect('emp',claimId);
    else if(code==='virus_payload'&&claimId) _showItemEffect('emp',claimId);
    else if(code==='siege_ram') _showItemEffect('boost',null);
    else if(code==='supply_crate') _showItemEffect('mining',null);
    else if(code==='harvest_surge') _showItemEffect('mining',null);
    else if(code==='xp_amplifier') _showItemEffect('boost',null);
    else if(code==='gp_generator') _showItemEffect('boost',null);
    else if(code==='lucky_charm') _showItemEffect('boost',null);
    else if(code==='recall_beacon') _showItemEffect('radar',null);
    else if(code==='territory_scan'){ _showItemEffect('radar',null); _showTerritoryScanResult(d.effect&&d.effect.scan); }
    else if(code==='decoy_beacon') _showItemEffect('stealth',null);
    else if(code==='shield_regen'&&claimId) _showItemEffect('shield',claimId);
    Promise.resolve(loadActiveEffects()).then(function(){
      renderShopInventory();
      try{ if(typeof loadBaseInventory==='function')loadBaseInventory(); }catch(_){}
    });
    // Refresh claims to update shield status on globe
    _setActiveTimeout(function(){
      claimsSnapshot=null;
      _guardedJsonFetch('shop-use-claims-refresh', '/api/claims', {minGap:15000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(sc){
        if(!sc||!sc.length)return;
        // Replace claims array with fresh data
        claims.length=0;
        sc.forEach(function(c){claims.push(c)});
        preCacheAndComposite();
      });
    },500);
  }).catch(function(e){showToast(tl('Failed to use item','아이템 사용 실패','アイテムの使用に失敗','物品使用失败'),'error')});
}
// Visual effect overlay when using items
function _showItemEffect(type,claimId){
  document.querySelectorAll('.item-effect-overlay').forEach(function(el){el.remove();});
  var overlay=document.createElement('div');
  overlay.className='item-effect-overlay';
  var icon='',color='',label='';
  if(type==='shield'){icon='🛡️';color='#50C8FF';label=tl('SHIELD ACTIVATED','방어막 활성화','シールド起動','护盾已激活');}
  else if(type==='emp'){icon='⚡';color='#FF4444';label=tl('EMP STRIKE!','EMP 공격!','EMP攻撃！','EMP打击！');}
  else if(type==='stealth'){icon='👻';color='#AA88FF';label=tl('STEALTH ACTIVE','은폐 활성','隠密起動','隐身已激活');}
  else if(type==='radar'){icon='📡';color='#44FF88';label=tl('RADAR SCANNING...','레이더 스캔 중...','レーダースキャン中...','雷达扫描中...');}
  else if(type==='boost'){icon='🔥';color='#FF8800';label=tl('ATTACK BOOSTED','공격력 강화','攻撃力強化','攻击已强化');}
  else if(type==='doubler'){icon='✨';color='#FFD166';label=tl('PIXEL DOUBLER ON','픽셀 2배 활성','ピクセル2倍起動','像素翻倍开启');}
  else if(type==='mining'){icon='⛏️';color='#88DDFF';label=tl('MINING BOOST ON','채굴 부스트 활성','採掘ブースト起動','采矿加成开启');}
  overlay.innerHTML='<div class="effect-icon">'+icon+'</div><div class="effect-label">'+label+'</div>';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);pointer-events:none;animation:effectFadeOut 1.8s ease-out forwards';
  overlay.querySelector('.effect-icon').style.cssText='font-size:64px;animation:effectPop 0.4s ease-out';
  overlay.querySelector('.effect-label').style.cssText='font-size:24px;font-weight:800;letter-spacing:2px;margin-top:12px;color:'+color+';text-shadow:0 0 20px '+color;
  function removeOverlay(){ if(overlay&&overlay.parentNode) overlay.remove(); }
  overlay.addEventListener('animationend', removeOverlay, { once:true });
  document.body.appendChild(overlay);
  _setActiveTimeout(removeOverlay,2200);
}

/* ── BASE Modal ──────────────────────────────────── */
var _sectorsData=[];
var _ranksData=[];
var _baseUserData=null;

function openBaseModal(){
  document.getElementById('baseModal').classList.add('open');
  try{ if(typeof requestBaseDotPoll==='function') requestBaseDotPoll(true); }catch(_){}
  try{trackQuestAction('visit_base',1)}catch(e){}
  // (v7.371) staking 폐지 — enabled일 때만 섹션 노출(서버 staking_enabled=false면 숨김)
  try{
    _economyReadFetch('staking-info', '/api/staking/info', true, 30000)
      .then(function(d){ var sec=document.getElementById('stakingSection'); if(sec) sec.style.display=(d&&d.enabled)?'':'none'; })
      .catch(function(){});
  }catch(_){}
  // 초기 카테고리: 영토
  try{
    var cat=window._lastBaseCat||'territory';
    var catBtn=document.querySelector('.bcat[data-cat="'+cat+'"]');
    switchBaseCat(cat, catBtn);
  }catch(_){
    try{
      var territoryTab = document.getElementById('baseTabTerritory');
      if(territoryTab){ switchBaseTab('territory', territoryTab); clearBaseTabDot('territory'); }
    }catch(_e){}
  }
  loadBaseData();
  try{ _updateBaseTerritoryGroupList(); }catch(_){}
  _setActiveTimeout(loadNotifCount, 500);
  _setActiveTimeout(function(){ try{ loadOpsCommandBoard(); }catch(_){} }, 200);
  // [v7.137] 레벨 게이트 잠금 표시 (레벨 DOM 채워진 뒤)
  try{ applyBaseTabLocks(); }catch(_){}
  setTimeout(function(){ try{ applyBaseTabLocks(); }catch(_){} }, 600);
}
function closeBaseModal(){
  document.getElementById('baseModal').classList.remove('open');
  stopBaseTransientWork(null);
  _updateBaseBtnDot();
  // Close notif panel if open
  var np=document.getElementById('notifPanel');
  if(np) np.style.display='none';
}

// ── Notification System ──
var _notifPanelOpen = false;
function toggleNotifPanel(){
  var panel=document.getElementById('notifPanel');
  if(!panel) return;
  _notifPanelOpen=!_notifPanelOpen;
  panel.style.display=_notifPanelOpen?'block':'none';
  if(_notifPanelOpen){
    loadNotifications();
    // 다음 tick 에 outside-click 리스너 등록 (현재 클릭 이벤트로 닫히지 않도록)
    setTimeout(function(){ document.addEventListener('click', _notifOutsideClick, true); }, 0);
  }else{
    document.removeEventListener('click', _notifOutsideClick, true);
  }
}
function closeNotifPanel(){
  var panel=document.getElementById('notifPanel');
  if(!panel) return;
  _notifPanelOpen=false;
  panel.style.display='none';
  document.removeEventListener('click', _notifOutsideClick, true);
}
function _notifOutsideClick(e){
  var panel=document.getElementById('notifPanel');
  if(!panel || panel.style.display==='none') return;
  // 알림 토글 버튼이나 패널 내부 클릭은 무시
  var bell=document.getElementById('notifBellBtn');
  if(panel.contains(e.target)) return;
  if(bell && bell.contains(e.target)) return;
  closeNotifPanel();
}
function loadNotifCount(){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  _economyReadFetch('notifications-count', '/api/notifications?limit=1', true, 5000)
    .then(function(d){
      if (!d) return;
      var badge=document.getElementById('notifUnreadBadge');
      if(!badge) return;
      var cnt=d.unread||0;
      badge.textContent=cnt>99?'99+':String(cnt);
      badge.style.display=cnt>0?'block':'none';
    }).catch(function(){});
}
function loadNotifications(){
  var w=(walletState&&walletState.address)||'';
  var el=document.getElementById('notifList');
  if(!el||!w) return;
  el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+(t('notif_loading')||'Loading...')+'</div>';
  _economyReadFetch('notifications-list', '/api/notifications?limit=30', true, 5000)
    .then(function(d){
      if (!d) return;
      var notifs=d.notifications||[];
      if(!notifs.length){
        el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+(t('notif_empty')||'No notifications yet')+'</div>';
        return;
      }
      el.innerHTML=notifs.map(function(n){
        var ago=Math.round((Date.now()-new Date(n.created_at))/60000);
        var agoStr=ago<60?ago+'m':(Math.floor(ago/60)+'h');
        return '<div onclick="markNotifRead('+n.id+',this)" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);'+(n.read?'opacity:.5':'')+'">'
          +'<div style="font-size:10px;color:'+(n.read?'var(--tx3)':'var(--tx)')+';line-height:1.4;margin-bottom:3px">'+n.message+'</div>'
          +'<div style="font-size:8px;color:var(--tx3)">'+agoStr+' '+tl('ago','전','前','前')+'</div>'
          +'</div>';
      }).join('');
      // Update badge
      var badge=document.getElementById('notifUnreadBadge');
      if(badge){badge.textContent=d.unread>99?'99+':String(d.unread||0);badge.style.display=(d.unread>0)?'block':'none';}
    }).catch(function(){el.innerHTML='<div style="color:var(--red);font-size:10px;text-align:center;padding:16px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';});
}
function markNotifRead(id,el){
  var w=(walletState&&walletState.address)||'';
  if(!w||!id) return;
  fetch('/api/notifications/read',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({id:id})})
    .then(function(){if(el)el.style.opacity='.5';loadNotifCount();}).catch(function(){});
}
function markAllNotifsRead(){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  fetch('/api/notifications/read-all',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({})})
    .then(function(){loadNotifications();loadNotifCount();}).catch(function(){});
}

// ── Base Inline Shop ──
var _baseShopItems = [];
var _baseShopFilter = 'all';
function loadBaseShopItems(){
  // Refresh balances (PP/USDT/GP)
  try{ if(typeof refreshEmailBalances==='function') refreshEmailBalances(); }catch(_){}
  _updateBaseShopBalances();
  _economyReadFetch('base-shop-items', '/api/shop/items', false, 15000).then(function(data){
    if (!data) return;
    _baseShopItems = (data.items||data||[]).filter(function(i){return i.active !== false});
    renderBaseShop();
  }).catch(function(){
    document.getElementById('baseShopGrid').innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px;font-size:10px">'+tl('Failed to load shop','상점을 불러오지 못했습니다','ショップを読み込めませんでした','无法加载商店')+'</div>';
  });
}
function _updateBaseShopBalances(){
  var pp=document.getElementById('baseShopBalPP');
  var usdt=document.getElementById('baseShopBalUSDT');
  var gp=document.getElementById('baseShopBalGP');
  if(pp) pp.textContent=(walletState.gamePP||0).toFixed(1);
  if(usdt) usdt.textContent=(walletState.gameUsdt||0).toFixed(2);
  if(gp) gp.textContent=Math.floor((walletState&&walletState.gameGP)||(_dailyState&&_dailyState.gpBalance)||0);
}
function filterBaseShop(cat,el){
  _baseShopFilter = cat;
  document.querySelectorAll('.base-shop-cat').forEach(function(b){
    b.style.borderColor='rgba(255,255,255,.1)';b.style.background='rgba(255,255,255,.03)';b.style.color='var(--tx3)';
  });
  el.style.borderColor='rgba(255,209,102,.3)';el.style.background='rgba(255,209,102,.12)';el.style.color='var(--gold)';
  renderBaseShop();
}
function renderBaseShop(){
  var grid = document.getElementById('baseShopGrid');
  var items = _baseShopItems.filter(function(i){
    if(_baseShopFilter==='all') return true;
    return (i.category||'').toLowerCase() === _baseShopFilter;
  });
  if(!items.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px;font-size:10px">'+tl('No items in this category','이 카테고리에 아이템이 없습니다','このカテゴリにアイテムがありません','此分类下没有物品')+'</div>';
    return;
  }
  var catColors={defense:'var(--cyan)',attack:'var(--red)',utility:'var(--pp)',cosmetic:'#c088e0',boost:'var(--gold)'};
  grid.innerHTML = items.map(function(it){
    var c = catColors[(it.category||'').toLowerCase()]||'var(--tx2)';
    var price = parseFloat(it.price_pp||0);
    var usdtPrice = parseFloat(it.price_usdt||0);
    var gpPrice = parseFloat(it.price_gp||0);
    var code = (it.code||it.item_code||'').replace(/'/g,"\\'");
    var _bs='font-size:8px;font-weight:700;padding:3px 6px;border-radius:4px;cursor:pointer;font-family:var(--fn);flex:1;text-align:center;white-space:nowrap;';
    var ppBtn = price>0
      ? '<button onclick="buyShopItem(\''+code+'\',\'PP\')" style="'+_bs+'border:1px solid rgba(176,136,224,.45);background:rgba(176,136,224,.12);color:#c088e0">'+price.toFixed(1)+' PP</button>'
      : '';
    var usdtBtn = usdtPrice>0
      ? '<button onclick="buyShopItem(\''+code+'\',\'USDT\')" style="'+_bs+'border:1px solid rgba(76,216,154,.45);background:rgba(76,216,154,.12);color:var(--gn)">'+usdtPrice.toFixed(1)+' USDT</button>'
      : '';
    var gpBtn = gpPrice>0
      ? '<button onclick="buyShopItem(\''+code+'\',\'GP\')" style="'+_bs+'border:none;background:linear-gradient(135deg,#FFD166,#FF9030);color:#000">'+gpPrice.toFixed(0)+' GP</button>'
      : '';
    return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:10px;font-weight:700;color:'+c+'">'+(it.icon||'')+ ' ' +(_itemName(it.code||it.item_code)||it.name||it.item_code)+'</span>'
      +'<span style="font-size:8px;padding:2px 6px;border-radius:8px;background:rgba(255,255,255,.06);color:var(--tx3)">'+(it.category||'')+'</span>'
      +'</div>'
      +'<div style="font-size:9px;color:var(--tx3);line-height:1.4">'+(_itemDesc(it.code||it.item_code)||it.description||'')+'</div>'
      +'<div style="display:flex;gap:3px;align-items:center;margin-top:auto">'
      +ppBtn+usdtBtn+gpBtn
      +'</div></div>';
  }).join('');
}

// ── BASE Shop / Inventory / Crafting View Toggle ──
var _baseShopView='shop'; // 'shop' | 'inventory' | 'crafting'
function switchBaseShopView(view,el){
  _baseShopView=view;
  // Update view-toggle button styles
  document.querySelectorAll('.base-shop-view').forEach(function(b){
    b.style.borderColor='rgba(255,255,255,.1)';
    b.style.background='rgba(255,255,255,.03)';
    b.style.color='var(--tx3)';
    b.classList.remove('active');
  });
  if(el){
    if(view==='crafting'){
      el.style.borderColor='rgba(160,232,160,.45)';
      el.style.background='rgba(160,232,160,.15)';
      el.style.color='#a0e8a0';
    }else{
      el.style.borderColor='rgba(255,209,102,.45)';
      el.style.background='rgba(255,209,102,.15)';
      el.style.color='var(--gold)';
    }
    el.classList.add('active');
  }
  var shopGrid=document.getElementById('baseShopGrid');
  var invWrap=document.getElementById('baseInvWrap');
  var craftPanel=document.getElementById('baseCraftingPanel');
  var luckyPanel=document.getElementById('baseLuckyBoxPanel');
  var vipPanel=document.getElementById('baseVipPanel');
  var profilePanel=document.getElementById('baseProfilePanel');
  var prestigePanel=document.getElementById('basePrestigePanel');
  var catRow=document.getElementById('baseShopCatRow');
  shopGrid.style.display='none';
  if(invWrap) invWrap.style.display='none';
  if(craftPanel) craftPanel.style.display='none';
  if(luckyPanel) luckyPanel.style.display='none';
  if(vipPanel) vipPanel.style.display='none';
  if(profilePanel) profilePanel.style.display='none';
  if(prestigePanel) prestigePanel.style.display='none';
  catRow.style.display='none';
  if(view==='inventory'){
    if(invWrap) invWrap.style.display='block';
    loadBaseInventory();
  }else if(view==='crafting'){
    if(craftPanel){ craftPanel.style.display='block'; loadCraftingView(); }
  }else if(view==='lucky'){
    if(el){
      el.style.borderColor='rgba(255,204,2,.45)';
      el.style.background='rgba(255,204,2,.15)';
      el.style.color='#ffcc02';
    }
    if(luckyPanel){ luckyPanel.style.display='block'; loadLuckyBoxView(); }
  }else if(view==='vip'){
    if(el){
      el.style.borderColor='rgba(206,147,216,.45)';
      el.style.background='rgba(206,147,216,.15)';
      el.style.color='#ce93d8';
    }
    if(vipPanel){ vipPanel.style.display='block'; loadVipView(); }
  }else if(view==='profile'){
    if(el){
      el.style.borderColor='rgba(244,143,177,.45)';
      el.style.background='rgba(244,143,177,.15)';
      el.style.color='#f48fb1';
    }
    if(profilePanel){ profilePanel.style.display='block'; }
  }else if(view==='prestige'){
    if(el){
      el.style.borderColor='rgba(255,213,79,.45)';
      el.style.background='rgba(255,213,79,.15)';
      el.style.color='#ffd54f';
    }
    if(prestigePanel){ prestigePanel.style.display='block'; }
  }else{
    shopGrid.style.display='grid';
    catRow.style.display='flex';
  }
}

// ── LUCKY BOX VIEW (Migration 120) ────────────────────────────────────────

function loadLuckyBoxView() {
  renderLuckyBoxUnavailable();
}

function renderLuckyBoxUnavailable() {
  var list = document.getElementById('luckyBoxList');
  var feed = document.getElementById('luckyBoxFeed');
  var history = document.getElementById('luckyBoxHistoryPanel');
  if (list) {
    list.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px;line-height:1.6">'+tl('Crates are currently unavailable.','상자는 현재 이용할 수 없습니다.','クレートは現在利用できません。','宝箱当前不可用。')+'</div>';
  }
  if (feed) {
    feed.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">'+tl('Crate feed is unavailable.','상자 피드를 이용할 수 없습니다.','クレートフィードは利用できません。','宝箱动态不可用。')+'</div>';
  }
  if (history) {
    history.style.display = 'none';
    history.innerHTML = '';
  }
}

function loadLuckyBoxTypes() {
  renderLuckyBoxUnavailable();
}

function loadLuckyBoxRecentFeed() {
  renderLuckyBoxUnavailable();
}

function openLuckyBox(boxId, name, cost) {
  showToast(tl('Crates are currently unavailable','상자는 현재 이용할 수 없습니다','クレートは現在利用できません','宝箱当前不可用'), 'warn');
}

function toggleLuckyBoxHistory() {
  showToast(tl('Crate history is currently unavailable','상자 기록은 현재 이용할 수 없습니다','クレート履歴は現在利用できません','宝箱记录当前不可用'), 'warn');
}

function loadLuckyBoxHistory() {
  renderLuckyBoxUnavailable();
}

// ── VIP PASS VIEW (Migration 121) ─────────────────────────────────────────

function loadVipView() {
  var w = walletState && walletState.address;
  // Load current pass status
  if (w) {
    _economyReadFetch('vip-my', '/api/vip/my', true, 15000)
      .then(function(pass){
        if (!pass) return;
        var statusEl = document.getElementById('myVipStatus');
        if (pass && pass.tier_id) {
          statusEl && (statusEl.style.display = '');
          var badgeEl = document.getElementById('myVipBadge');
          var nameEl  = document.getElementById('myVipTierName');
          var expEl   = document.getElementById('myVipExpiry');
          var minEl   = document.getElementById('myVipMining');
          var earnEl  = document.getElementById('myVipEarn');
          var earnWrap= document.getElementById('myVipEarnWrap');
          if (badgeEl) badgeEl.textContent = pass.badge || '⭐';
          if (nameEl)  nameEl.textContent  = pass.tier_name || '';
          if (expEl)   expEl.textContent   = new Date(pass.expires_at).toLocaleDateString();
          if (minEl)   minEl.textContent   = '+' + pass.mining_boost_pct + '% ' + tl('mining','채굴','採掘','采矿');
          if (earnEl)  earnEl.textContent  = '+' + pass.gp_earn_bonus_pct + '% ' + tl('GP earn','GP 획득','GP獲得','GP获取');
          if (earnWrap) earnWrap.style.display = pass.gp_earn_bonus_pct > 0 ? '' : 'none';
        } else {
          statusEl && (statusEl.style.display = 'none');
        }
      }).catch(function(){});
  }
  // Load tiers
  var el = document.getElementById('vipTierList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+tl('Loading…','불러오는 중…','読み込み中…','加载中…')+'</div>';
  _economyReadFetch('vip-tiers', '/api/vip/tiers', false, 30000).then(function(tiers){
    tiers = Array.isArray(tiers) ? tiers : [];
    if (!tiers.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+tl('No VIP tiers available','이용 가능한 VIP 등급이 없습니다','利用可能なVIPランクがありません','暂无可用的VIP等级')+'</div>';
      return;
    }
    el.innerHTML = tiers.map(function(tier) {
      var color = tier.badge_color || '#ffcc02';
      var perks = [];
      if (tier.mining_boost_pct > 0)  perks.push('⛏ +' + tier.mining_boost_pct + '% ' + tl('mining','채굴','採掘','采矿'));
      if (tier.fee_discount_pct > 0)  perks.push('💰 -' + tier.fee_discount_pct + '% ' + tl('fees','수수료','手数料','手续费'));
      if (tier.gp_earn_bonus_pct > 0) perks.push('⭐ +' + tier.gp_earn_bonus_pct + '% ' + tl('GP earn','GP 획득','GP獲得','GP获取'));
      return '<div style="padding:12px;border-radius:8px;background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.1);display:flex;gap:10px;align-items:flex-start">'
        + '<span style="font-size:32px;line-height:1;flex-shrink:0">' + (tier.badge||'⭐') + '</span>'
        + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:12px;font-weight:700;margin-bottom:3px" style="color:'+color+'">'
            + '<span style="color:'+color+'">' + _escHtml(tier.name) + '</span>'
          + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">'
            + perks.map(function(p){ return '<span style="font-size:9px;color:var(--tx3)">'+p+'</span>'; }).join('')
          + '</div>'
          + '<div style="font-size:9px;color:var(--tx3)">' + tier.period_days + ' ' + tl('days','일','日','天') + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
          + '<div style="font-size:12px;color:'+color+';font-weight:700">' + parseFloat(tier.cost_gp).toFixed(0) + ' GP</div>'
          + '<button onclick="purchaseVipPass(' + tier.id + ',\'' + _escHtml(tier.name) + '\',' + parseFloat(tier.cost_gp) + ')" style="margin-top:6px;font-size:9px;padding:5px 10px;border-radius:5px;background:rgba(206,147,216,.15);border:1px solid rgba(206,147,216,.4);color:#ce93d8;cursor:pointer;font-family:var(--fn);font-weight:700" data-i18n="vip_buy_btn">💫 GET VIP</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:10px;text-align:center;padding:12px">'+e.message+'</div>'; });
}

function purchaseVipPass(tierId, name, cost) {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('err_connect_wallet')||'Connect wallet first','error'); return; }
  var _vipNm='<b>'+_escHtml(name)+'</b>', _vipCost='<b>'+cost+' GP</b>';
  gameConfirm({ icon:'👑', title: t('vip_purchase_title')||'Get VIP Pass?', body: tl('Activate '+_vipNm+' VIP for '+_vipCost+'?', _vipNm+' VIP를 '+_vipCost+'에 활성화하시겠습니까?', _vipNm+' VIPを '+_vipCost+' で有効化しますか？', '以 '+_vipCost+' 激活 '+_vipNm+' VIP？'), confirmText: t('vip_confirm')||'GET VIP' }).then(function(ok){
    if (!ok) return;
    fetch('/api/vip/purchase', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, tierId: tierId })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('💫 ' + d.tierName + ' ' + tl('VIP activated!','VIP 활성화됨!','VIP有効化！','VIP已激活！') + ' ' + (d.badge||''), 'success');
      loadVipView();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── CRAFTING VIEW ──────────────────────────────────────────────────────────
var _craftingRecipes=[];
var _craftingCatFilter='all';

function loadCraftingView(){
  var grid=document.getElementById('craftingGrid');
  if(!grid) return;
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px 0;font-size:10px" data-i18n="loading">Loading…</div>';
  var url='/api/crafting/recipes';
  if(_craftingCatFilter&&_craftingCatFilter!=='all') url+='?category='+encodeURIComponent(_craftingCatFilter);
  _economyReadFetch('crafting-recipes:' + (_craftingCatFilter || 'all'), url, true, 15000).then(function(recipes){
    if (!recipes) {
      grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px 0;font-size:10px">'+tl('Please wait a moment.','잠시만 기다려 주세요.','少々お待ちください。','请稍候。')+'</div>';
      return;
    }
    _craftingRecipes=Array.isArray(recipes)?recipes:[];
    renderCraftingGrid();
  }).catch(function(){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mars);padding:20px 0;font-size:10px" data-i18n="craft_load_fail">Failed to load recipes</div>';
  });
}

function filterCraftingView(cat,el){
  _craftingCatFilter=cat;
  document.querySelectorAll('.craft-cat').forEach(function(b){
    b.style.borderColor='rgba(255,255,255,.1)';
    b.style.background='rgba(255,255,255,.03)';
    b.style.color='var(--tx3)';
    b.classList.remove('active');
  });
  if(el){
    el.style.borderColor='rgba(160,232,160,.3)';
    el.style.background='rgba(160,232,160,.12)';
    el.style.color='#a0e8a0';
    el.classList.add('active');
  }
  loadCraftingView();
}

function renderCraftingGrid(){
  var grid=document.getElementById('craftingGrid');
  if(!grid) return;
  if(!_craftingRecipes.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px 0;font-size:10px" data-i18n="craft_no_recipes">No recipes available</div>';
    return;
  }
  grid.innerHTML=_craftingRecipes.map(function(r){
    var canCraft=!!r.canCraft;
    var ingText=(r.ingredients||[]).map(function(i){
      return (i.item_name||(tl('Item','아이템','アイテム','物品')+' #'+i.item_type_id))+' ×'+i.qty;
    }).join(', ')||'—';
    var costText=Number(r.gp_cost)>0?(Number(r.gp_cost).toFixed(0)+' GP'):tl('Free','무료','無料','免费');
    var rateText=r.success_rate+'%';
    var seasonBadge=r.is_seasonal?'<span style="font-size:8px;background:rgba(255,183,77,.2);color:#ffb74d;border:1px solid rgba(255,183,77,.3);border-radius:8px;padding:1px 5px;margin-left:3px">'+tl('SEASONAL','시즌 한정','シーズン限定','季节限定')+'</span>':'';
    var catBadge=r.category!=='general'?'<span style="font-size:8px;background:rgba(160,232,160,.1);color:#a0e8a0;border:1px solid rgba(160,232,160,.2);border-radius:8px;padding:1px 5px;margin-left:3px">'+r.category.toUpperCase()+'</span>':'';
    var btnStyle=canCraft
      ?'cursor:pointer;background:rgba(160,232,160,.2);border:1px solid rgba(160,232,160,.5);color:#a0e8a0'
      :'cursor:not-allowed;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--tx3);opacity:.6';
    return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(160,232,160,'+(canCraft?'.2':'.07')+');border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:5px">'
      +'<div style="font-size:11px;font-weight:700;color:#a0e8a0">⚗️ '+_escHtml(r.output_name||r.name)+' ×'+r.output_qty+'</div>'
      +(r.description?'<div style="font-size:9px;color:var(--tx3)">'+_escHtml(r.description)+'</div>':'')
      +'<div style="font-size:9px;color:#888">'+seasonBadge+catBadge+'</div>'
      +'<div style="font-size:9px;color:var(--tx3)"><b style="color:#888">'+tl('Need','필요','必要','需要')+':</b> '+_escHtml(ingText)+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:9px">'
        +'<span style="color:var(--gold)">'+costText+'</span>'
        +'<span style="color:'+(Number(r.success_rate)>=80?'#a0e8a0':'#ffb74d')+'">'+rateText+' '+tl('success','성공률','成功率','成功率')+'</span>'
      +'</div>'
      +(Number(r.fail_refund_pct)>0?'<div style="font-size:9px;color:#888">'+tl('Fail refund','실패 환급','失敗返金','失败返还')+': '+r.fail_refund_pct+'%</div>':'')
      +'<button onclick="attemptCraft('+r.id+')" style="width:100%;padding:6px;border-radius:6px;font-size:9px;font-family:var(--fn);font-weight:700;letter-spacing:.5px;'+btnStyle+'" data-i18n="craft_btn">⚗️ CRAFT</button>'
      +'</div>';
  }).join('');
}

function attemptCraft(recipeId){
  var w=(walletState&&walletState.address)||'';
  if(!w){ gameAlert(t('connect_wallet_first')||'Connect wallet first'); return; }
  var recipe=_craftingRecipes.find(function(r){return r.id===recipeId;});
  if(!recipe) return;
  if(!recipe.canCraft){ gameAlert(t('craft_missing_ingredients')||'Missing ingredients'); return; }

  var gpCost=Number(recipe.gp_cost);
  var ingList=(recipe.ingredients||[]).map(function(i){
    return '• '+(i.item_name||(tl('Item','아이템','アイテム','物品')+' #'+i.item_type_id))+' ×'+i.qty;
  }).join('\n');
  var confirmMsg=t('craft_confirm_title')||(tl('Craft','제작','クラフト','制作')+': '+recipe.output_name);
  var subMsg=(ingList?ingList+'\n':'')+(gpCost>0?tl('Cost','비용','コスト','花费')+': '+gpCost+' GP\n':'')+tl('Success','성공률','成功率','成功率')+': '+recipe.success_rate+'%';

  gameConfirm({icon:'⚗️', title:confirmMsg, body:subMsg.replace(/\n/g,'<br>'), confirmText:tl('CRAFT','제작','クラフト','制作')}).then(function(ok){
    if(!ok) return;
    var btn=document.querySelector('[onclick="attemptCraft('+recipeId+')"]');
    if(btn){ btn.disabled=true; btn.textContent=tl('Crafting…','제작 중…','クラフト中…','制作中…'); }
    fetch('/api/crafting/craft',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,recipeId:recipeId})
    }).then(function(r){return r.json();}).then(function(d){
      if(btn){ btn.disabled=false; btn.textContent='⚗️ '+tl('CRAFT','제작','クラフト','制作'); }
      if(d.error){ gameAlert(d.error); return; }
      if(d.success){
        gameAlert('✅ '+(t('craft_success')||'Craft success!')
          +'\n+'+(d.outputQty||1)+'× '+(d.outputName||tl('item','아이템','アイテム','物品')));
      }else{
        var refMsg=d.gpRefunded>0?'\n'+t('craft_refund_partial')||'\nPartial GP refunded: '+d.gpRefunded:'';
        gameAlert('❌ '+(t('craft_fail')||'Craft failed')+refMsg);
      }
      // Refresh recipes & balances
      loadCraftingView();
      if(typeof updateBalanceDisplays==='function') updateBalanceDisplays();
    }).catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent='⚗️ '+tl('CRAFT','제작','クラフト','制作'); }
      gameAlert(tl('Error','오류','エラー','错误')+': '+e.message);
    });
  });
}

var _craftHistoryOpen=false;
function toggleCraftHistory(){
  var panel=document.getElementById('craftHistoryPanel');
  if(!panel) return;
  _craftHistoryOpen=!_craftHistoryOpen;
  if(_craftHistoryOpen){
    panel.style.display='block';
    loadCraftHistory();
  }else{
    panel.style.display='none';
  }
}

function loadCraftHistory(){
  var panel=document.getElementById('craftHistoryPanel');
  if(!panel) return;
  var w=(walletState&&walletState.address)||'';
  if(!w){ panel.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px">'+tl('Connect wallet','지갑 연결','ウォレット接続','连接钱包')+'</div>'; return; }
  panel.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px">'+tl('Loading…','불러오는 중…','読み込み中…','加载中…')+'</div>';
  _economyReadFetch('crafting-log', '/api/crafting/log?limit=20', true, 15000).then(function(log){
      if (!log) {
        panel.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px">'+tl('Please wait a moment.','잠시만 기다려 주세요.','少々お待ちください。','请稍候。')+'</div>';
        return;
      }
      if(!log.length){
        panel.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px" data-i18n="craft_no_history">No crafting history</div>';
        return;
      }
      panel.innerHTML=log.map(function(l){
        var dt=new Date(l.created_at).toLocaleDateString();
        var result=l.success
          ?'<span style="color:#a0e8a0">✅</span>'
          :'<span style="color:var(--mars)">❌</span>';
        var refund=l.gp_refunded>0?' <span style="color:#888;font-size:8px">+'+l.gp_refunded+' '+tl('GP back','GP 환급','GP返金','GP返还')+'</span>':'';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:9px">'
          +'<span>'+result+' '+_escHtml(l.recipe_name||(tl('Recipe','레시피','レシピ','配方')+' #'+l.recipe_id))+'</span>'
          +'<span style="color:#666">'+dt+' · '+l.gp_cost+' GP'+refund+'</span>'
          +'</div>';
      }).join('');
    }).catch(function(){
      panel.innerHTML='<div style="color:var(--mars);font-size:10px;padding:8px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';
    });
}

function _escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// Global aliases used across the codebase
var escHtml = _escHtml;
window.escHtml = _escHtml;

var _baseInventory=[];
var _resourceInventory=[];
var _baseInvCat='all';
function filterBaseInv(cat,el){
  _baseInvCat=cat;
  document.querySelectorAll('.base-inv-cat').forEach(function(b){
    b.classList.remove('active');
    b.style.cssText=''; // CSS 클래스에 위임, 인라인 제거
  });
  if(el){ el.classList.add('active'); }
  renderBaseInventory();
}
function loadBaseInventory(){
  var w=(walletState&&walletState.address)||'';
  var grid=document.getElementById('baseInvGrid');
  var grid2=document.getElementById('baseInvGrid2');
  var loadMsg='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px 0;font-size:10px">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
  if(!w){
    _activeEffects=[];
    _clearActiveEffectsRefresh();
    renderActiveBuffs();
    var noWalletMsg='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:20px 0;font-size:10px">'+tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包')+'</div>';
    if(grid)grid.innerHTML=noWalletMsg;
    if(grid2)grid2.innerHTML=noWalletMsg;
    return;
  }
  if(grid)grid.innerHTML=loadMsg;
  if(grid2)grid2.innerHTML=loadMsg;
  // Load inventory + active effects + instances + resources in parallel
  Promise.all([
    _economyReadFetch('base-shop-inventory', '/api/shop/inventory', true, 8000),
    _fetchActiveEffects(),
    _economyReadFetch('item-instances', '/api/items/instances', true, 10000).catch(function(){return []}),
    _economyReadFetch('resources-my', '/api/resources/my', true, 10000).catch(function(){return {inventory:[]}})
  ]).then(function(results){
    _baseInventory=results[0]||_baseInventory||[];
    _activeEffects=_filterLiveEffects(results[1]||[]);
    _enhInstances=results[2]||[];
    _resourceInventory=(results[3]&&results[3].inventory)||[];
    renderActiveBuffs();
    _scheduleActiveEffectsRefresh();
    renderBaseInventory();
  }).catch(function(){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--red);padding:20px 0;font-size:10px">'+tl('Failed to load inventory','인벤토리를 불러오지 못했습니다','インベントリを読み込めませんでした','无法加载背包')+'</div>';
  });
}

function renderBaseInventory(){
  var grid=document.getElementById('baseInvGrid');
  var grid2=document.getElementById('baseInvGrid2');
  var parts=[];
  _activeEffects=_filterLiveEffects(_activeEffects);
  // Active effects bar
  if(_activeEffects&&_activeEffects.length>0){
    var effHTML=_activeEffects.map(function(e){
      var info=_effectIcon(e)+' <b>'+(_itemName(e.effect_type)||e.name)+'</b>';
      var remaining=_formatEffectRemaining(e);
      if(remaining) info+=' · '+remaining;
      return '<span style="display:inline-block;padding:4px 8px;margin:0 4px 4px 0;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.25);border-radius:6px;font-size:9px;color:var(--gold);font-family:var(--fn)">'+info+'</span>';
    }).join('');
    parts.push('<div style="grid-column:1/-1;padding:6px;background:rgba(255,255,255,.02);border-radius:6px"><div style="font-size:9px;color:var(--tx3);margin-bottom:4px;letter-spacing:.5px">'+tl('ACTIVE EFFECTS','활성 효과','有効効果','生效中效果')+'</div>'+effHTML+'</div>');
  }
  var resWithQty=(_resourceInventory||[]).filter(function(r){return r.quantity>0});
  if((!_baseInventory||_baseInventory.length===0)&&!resWithQty.length){
    parts.push('<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+tl('No items or resources yet. Harvest territory or buy items from the shop.','아직 보유 아이템/재료가 없습니다. 영토를 채굴하거나 상점에서 아이템을 구매하세요.','アイテム/素材がまだありません。領地採掘またはショップ購入を行ってください。','暂无物品或资源。请采集领地或在商店购买。')+'</div>');
    var emptyHtml=parts.join('');
    if(grid)grid.innerHTML=emptyHtml;
    if(grid2)grid2.innerHTML=emptyHtml;
    return;
  }
  var catColors={defense:'var(--cyan)',attack:'var(--red)',utility:'var(--pp)',cosmetic:'#c088e0',boost:'var(--gold)'};
  var catLabels={defense:'🛡 '+tl('DEFENSE','방어','防御','防御'),attack:'⚔ '+tl('ATTACK','공격','攻撃','攻击'),utility:'🔧 '+tl('UTILITY','유틸리티','ユーティリティ','功能'),boost:'⚡ '+tl('BOOST','부스트','ブースト','加成'),cosmetic:'🎨 '+tl('COSMETIC','코스메틱','コスメ','装饰')};
  var catOrder=['defense','attack','utility','boost','cosmetic'];
  var grouped={};
  (_baseInventory||[]).forEach(function(it){
    var cat=(it.category||'utility').toLowerCase();
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(it);
  });
  // 선택 카테고리가 없으면 안내. 단, 리소스 보유분은 같은 탭에서 계속 보여줘야 하므로
  // 여기서 return 하지 않는다.
  var catFilter=_baseInvCat||'all';
  var visibleCats=catFilter==='all'?catOrder:[catFilter];
  var hasAny=visibleCats.some(function(c){return grouped[c]&&grouped[c].length;});
  if(!hasAny){
    parts.push('<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+(LANG==='ko'?'이 카테고리에 보유 아이템이 없습니다':LANG==='ja'?'このカテゴリにアイテムがありません':LANG==='zh'?'此分类下没有物品':'No items in this category')+'</div>');
  }
  visibleCats.forEach(function(cat){
    var items=grouped[cat]; if(!items||!items.length) return;
    var c=catColors[cat]||'var(--tx2)';
    // 전체 뷰에서만 카테고리 헤더 표시
    if(catFilter==='all'){
      parts.push('<div style="grid-column:1/-1;margin-top:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px">'
        +'<span style="font-size:10px;font-weight:800;color:'+c+';letter-spacing:1px">'+(catLabels[cat]||cat.toUpperCase())+'</span>'
        +'<span style="font-size:9px;color:var(--tx3)">('+items.length+')</span>'
        +'</div>');
    }
    items.forEach(function(it){
      var code=(it.code||'').replace(/'/g,"\\'");
      var needsClaim=code.indexOf('shield')===0||code==='emp_strike'||code==='orbital_strike'||code==='virus_payload'||code==='decoy_beacon';
      var isCosmetic=cat==='cosmetic';
      var useBtn;
      if(isCosmetic){
        useBtn='<button onclick="showToast(\'Select your territory then click CUSTOMIZE\',\'info\')" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(192,136,224,.45);background:rgba(192,136,224,.12);color:#c088e0;cursor:pointer;font-family:var(--fn)">'+tl('EQUIP ON LAND','영토에 장착','領地に装着','装备到领地')+'</button>';
        useBtn+=' <button onclick="materializeItem('+it.item_type_id+')" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(255,209,102,.45);background:rgba(255,209,102,.12);color:var(--gold);cursor:pointer;font-family:var(--fn)" title="'+(t('enh_materialize_tip')||'Convert to individual item for enhancement')+'">🔨 '+(t('enh_enhance')||'ENHANCE')+'</button>';
      }else if(needsClaim){
        useBtn='<button onclick="useShopItem(\''+code+'\',true)" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(255,120,60,.45);background:rgba(255,120,60,.12);color:var(--mars);cursor:pointer;font-family:var(--fn)">'+tl('USE ON LAND','영토에 사용','領地で使用','在领地使用')+'</button>';
      }else{
        useBtn='<button onclick="useShopItem(\''+code+'\',false)" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(76,216,154,.45);background:rgba(76,216,154,.12);color:var(--gn);cursor:pointer;font-family:var(--fn)">'+tl('USE','사용','使用','使用')+'</button>';
      }
      parts.push('<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center">'
        +'<span style="font-size:10px;font-weight:700;color:'+c+'">'+(it.icon||'')+' '+(_itemName(it.code)||it.name||it.code)+'</span>'
        +'<span style="font-size:9px;color:var(--gold);font-weight:700">×'+it.quantity+'</span>'
        +'</div>'
        +(function(){var d=_itemDesc(it.code)||it.description;return d?'<div style="font-size:9px;color:var(--tx3);line-height:1.4">'+d+'</div>':'';})()
        +'<div style="display:flex;justify-content:flex-end;gap:4px;margin-top:auto;flex-wrap:wrap">'+useBtn+'</div>'
        +'</div>');
    });
    // Show materialized instances for this cosmetic category
    if(cat==='cosmetic' && _enhInstances && _enhInstances.length>0){
      var cosInst=_enhInstances.filter(function(i){return i.category==='cosmetic'});
      if(cosInst.length>0){
        parts.push('<div style="grid-column:1/-1;margin-top:6px;padding:6px 8px;background:rgba(255,209,102,.04);border:1px solid rgba(255,209,102,.12);border-radius:6px">'
          +'<div style="font-size:9px;color:var(--gold);font-weight:800;letter-spacing:.5px;margin-bottom:6px">🔨 '+(t('enh_workshop')||'ENHANCEMENT WORKSHOP')+'</div>');
        cosInst.forEach(function(inst){
          var lv=inst.enhancement_level||0;
          var lvColor=_enhLevelColor(lv);
          parts.push('<div class="'+_enhGlowClass(lv)+'" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(0,0,0,.15);border:1px solid rgba(255,255,255,.08);border-radius:6px;margin-bottom:4px">'
            +'<div style="display:flex;align-items:center;gap:6px">'
            +'<span style="font-size:10px">'+(inst.icon||'🎨')+'</span>'
            +'<span style="font-size:10px;font-weight:700;color:'+lvColor+'">'+(inst.name||tl('Item','아이템','アイテム','物品'))+_enhBadge(lv)+'</span>'
            +'</div>'
            +'<div style="display:flex;gap:4px">'
            +'<button onclick="openEnhanceModal('+inst.id+')" style="font-size:9px;font-weight:700;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,209,102,.45);background:rgba(255,209,102,.12);color:var(--gold);cursor:pointer;font-family:var(--fn)">'+(lv>=10?'✨ '+tl('MAX','최대','最大','满级'):'🔨 +'+(lv+1))+'</button>'
            +(lv===0?'<button onclick="dematerializeItem('+inst.id+')" style="font-size:8px;padding:4px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.1);background:none;color:var(--tx3);cursor:pointer;font-family:var(--fn)" title="'+(t('enh_return_tip')||'Return to inventory stack')+'">↩</button>':'')
            +'</div>'
            +'</div>');
        });
        parts.push('</div>');
      }
    }
  });

  // ── RESOURCES section (Phase 2) ──
  var rarityColor={common:'var(--tx2)',rare:'var(--cyan)',special:'var(--gold)'};
  var rarityLabel={common:'⚪ COMMON',rare:'🔵 RARE',special:'⭐ SPECIAL'};
  if(resWithQty.length>0){
    parts.push('<div style="grid-column:1/-1;margin-top:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px">'
      +'<span style="font-size:10px;font-weight:800;color:#5cbbff;letter-spacing:1px">⛏️ '+(t('res_section_title')||'RESOURCES')+'</span>'
      +'<span style="font-size:9px;color:var(--tx3)">('+resWithQty.length+')</span>'
      +'</div>');
    // group by rarity
    var resGrouped={common:[],rare:[],special:[]};
    resWithQty.forEach(function(r){ (resGrouped[r.rarity]||resGrouped.common).push(r); });
    ['common','rare','special'].forEach(function(rar){
      var items=resGrouped[rar];if(!items||!items.length)return;
      var c=rarityColor[rar]||'var(--tx2)';
      parts.push('<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px;padding:4px 0">');
      items.forEach(function(r){
        var marketBtn=r.is_tradeable
          ? '<button onclick="openResourceMarketListing(\''+r.code+'\')" style="font-size:8px;padding:3px 7px;border-radius:4px;border:1px solid rgba(160,100,220,.4);background:rgba(160,100,220,.1);color:#c088e0;cursor:pointer;font-family:var(--fn);font-weight:700">'+(t('res_sell')||'SELL')+'</button>'
          : '';
        parts.push('<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;min-width:120px">'
          +'<span style="font-size:18px;line-height:1">'+(r.icon_emoji||'🔷')+'</span>'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:10px;font-weight:700;color:'+c+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(r.name||r.code)+'</div>'
          +'<div style="font-size:9px;color:var(--tx3)">×<b style="color:var(--tx2)">'+r.quantity+'</b> · '+(r.base_pp_value||0)+' PP</div>'
          +'</div>'
          +marketBtn
          +'</div>');
      });
      parts.push('</div>');
    });
  } else {
    parts.push('<div style="grid-column:1/-1;margin-top:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
      +'<span style="font-size:10px;font-weight:800;color:#5cbbff;letter-spacing:1px">⛏️ '+(t('res_section_title')||'RESOURCES')+'</span>'
      +'</div>');
    parts.push('<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:12px 0;font-size:9px">'+(t('res_empty')||'No resources yet. Harvest your territory to find minerals!')+'</div>');
  }

  var html=parts.join('');
  if(grid)grid.innerHTML=html;
  if(grid2)grid2.innerHTML=html;
}
