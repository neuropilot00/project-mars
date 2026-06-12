// ── Guild System ──────────────────────────────────
var _myGuildData=null;

function _guildReadJson(key, url, minGap, auth){
  var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('guild-ops:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function loadGuildTab(){
  var w=walletState.address;
  if(!w) return;
  // Load my guild + leaderboard in parallel
  Promise.all([
    _guildReadJson('my', '/api/guild/my', 10000),
    _guildReadJson('leaderboard', '/api/guild/leaderboard', 30000, false),
    _guildReadJson('invites', '/api/guild/invites', 15000)
  ]).then(function(results){
    if(!results[0]&&!results[1]&&!results[2]) return;
    var myGuild=results[0] ? results[0].guild : _myGuildData;
    var lb=results[1] ? (results[1].guilds||[]) : [];
    var invites=results[2] ? (results[2].invites||[]) : [];
    _myGuildData=myGuild;
    renderGuildState(myGuild, w);
    if(results[1]) renderGuildLeaderboard(lb);
    if(results[2]) renderGuildInvites(invites);
    _syncGuildChatPoll();
    try{ _checkBetrayerMark(w); }catch(_){}
    try{ _checkAwayBriefing(); }catch(_){}
  }).catch(function(e){console.warn('[GUILD] load error:',e)});
}

// Start/stop chat poll based on whether user is in a guild
function _syncGuildChatPoll(){
  if(_myGuildData && _isGuildChatVisible()) startGuildChatPoll();
  else stopGuildChatPoll();
}

function _isGuildChatVisible(){
  if(!_pageIsActive()) return false;
  var pane=document.getElementById('basePane_guild');
  return !!(pane&&pane.classList&&pane.classList.contains('active'));
}

function renderGuildState(guild, wallet){
  var noGuild=document.getElementById('guildNoGuild');
  var myGuild=document.getElementById('guildMyGuild');
  if(!guild){
    noGuild.style.display='';
    myGuild.style.display='none';
    // Also hide the leave/disband sections (they live outside guildMyGuild)
    var _ls=document.getElementById('guildLeaderSection'); if(_ls) _ls.style.display='none';
    var _lv=document.getElementById('guildLeaveSection'); if(_lv) _lv.style.display='none';
    return;
  }
  noGuild.style.display='none';
  myGuild.style.display='';
  // Emblem: prefer custom pixel-art image over emoji
  var emblemSpan=document.getElementById('guildEmblem');
  var emblemImg=document.getElementById('guildEmblemImg');
  if(guild.emblemImage){
    emblemSpan.style.display='none';
    emblemImg.style.display='';
    emblemImg.src=guild.emblemImage;
  } else {
    emblemSpan.style.display='';
    emblemImg.style.display='none';
    emblemSpan.textContent=guild.emblem||'🔴';
  }
  document.getElementById('guildName').textContent=guild.name;
  document.getElementById('guildTag').textContent='['+guild.tag+']';
  document.getElementById('guildDesc').textContent=guild.description||'';
  document.getElementById('guildMemberCount').textContent=guild.memberCount;
  document.getElementById('guildTotalPx').textContent=(guild.totalPixels||0).toLocaleString();
  document.getElementById('guildTreasury').textContent=Math.floor(guild.gpTreasury||0);

  // 전쟁 승리 버프 표시
  var buffEl = document.getElementById('guildWarBuff');
  if(buffEl){
    var buffExp = guild.war_buff_expires_at ? new Date(guild.war_buff_expires_at) : null;
    var buffActive = buffExp && buffExp > Date.now();
    if(buffActive && guild.war_buff_pct > 0){
      var mins = Math.round((buffExp - Date.now())/60000);
      var buffLabel = mins >= 60 ? (Math.floor(mins/60)+'h '+mins%60+'m') : mins+'m';
      buffEl.style.display='';
      buffEl.innerHTML='<div style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,rgba(255,209,102,.12),rgba(255,209,102,.04));border:1px solid rgba(255,209,102,.3);border-radius:6px;padding:6px 10px">'
        +'<span style="font-size:14px">🏆</span>'
        +'<div style="flex:1"><div style="font-size:10px;font-weight:700;color:var(--gold)">'+(LANG==='ko'?'전쟁 승리 버프 활성!':LANG==='ja'?'戦争勝利バフ発動中!':LANG==='zh'?'战争胜利增益激活!':'War Victory Buff Active!')+'</div>'
        +'<div style="font-size:9px;color:var(--tx3)">GP +'+(LANG==='ko'?'수익':LANG==='ja'?'収益':LANG==='zh'?'收益':'income')+' +'+guild.war_buff_pct+'% · '+(LANG==='ko'?'남은 시간: ':LANG==='ja'?'残り時間: ':LANG==='zh'?'剩余时间: ':'Time left: ')+buffLabel+'</div></div>'
        +'</div>';
    }else{
      buffEl.style.display='none';
      buffEl.innerHTML='';
    }
  }

  // Render members
  var ml=document.getElementById('guildMembersList');
  var myRole='member';
  ml.innerHTML=(guild.members||[]).map(function(m){
    if(m.wallet===wallet) myRole=m.role;
    var roleIcon=m.role==='leader'?'👑':m.role==='officer'?'⚔️':'';
    var roleLabel=m.role==='leader'?t('guild_leader_role'):m.role==='officer'?t('guild_officer_role'):t('guild_member_role');
    var actions='';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">'+
      '<span style="font-size:12px">'+roleIcon+'</span>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:11px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(m.nickname||m.wallet.slice(0,10)+'...')+'</div>'+
        '<div style="font-size:8px;color:var(--tx3)">'+m.pixelCount+' '+t('guild_pixels_short')+' · '+roleLabel+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px" data-wallet="'+m.wallet+'" data-role="'+m.role+'"></div>'+
    '</div>';
  }).join('');

  // Show/hide management sections based on role
  document.getElementById('guildInviteSection').style.display=(myRole==='leader'||myRole==='officer')?'':'none';
  var reqSec=document.getElementById('guildRequestsSection');
  if(reqSec) reqSec.style.display=(myRole==='leader'||myRole==='officer')?'':'none';
  if(myRole==='leader'||myRole==='officer') loadGuildJoinRequests(guild.id);
  document.getElementById('guildLeaderSection').style.display=(myRole==='leader')?'':'none';
  document.getElementById('guildLeaveSection').style.display=(myRole!=='leader')?'':'none';
  // Edit button: leader only
  var editBtn=document.getElementById('guildEditBtn');
  if(editBtn) editBtn.style.display=(myRole==='leader')?'':'none';

  // Add action buttons for leader
  if(myRole==='leader'){
    ml.querySelectorAll('[data-wallet]').forEach(function(el){
      var mw=el.dataset.wallet;
      var mr=el.dataset.role;
      if(mw===wallet) return;
      var btns='';
      if(mr==='member') btns+='<button onclick="guildPromote(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(91,184,232,.1);border:1px solid rgba(91,184,232,.2);color:var(--cyan);cursor:pointer">'+t('guild_promote_btn')+'</button>';
      if(mr==='officer') btns+='<button onclick="guildDemote(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,.05);border:1px solid var(--bdr);color:var(--tx3);cursor:pointer">'+t('guild_demote_btn')+'</button>';
      btns+='<button onclick="guildKick(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);color:var(--red);cursor:pointer">'+t('guild_kick_btn')+'</button>';
      btns+='<button onclick="guildTransfer(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.2);color:var(--gold);cursor:pointer">'+t('guild_transfer_btn')+'</button>';
      el.innerHTML=btns;
    });
  }

  // ── Guild upgrade panel (migration 058) ──
  try{ renderGuildUpgrades(guild, myRole); }catch(_e){}
  // ── Guild wars ──
  try{ renderGuildWars(guild.id); }catch(_e){}
  // ── Guild alliance (M-157) ──
  try{ renderGuildAlliance(guild, myRole); }catch(_e){}
}

// ═══════════════════════════════════════
//  GUILD ALLIANCE (M-157, 3-guild cap)
// ═══════════════════════════════════════
function _esc(s){ return (typeof escapeHTML==='function')?escapeHTML(s):String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }

function _phaseDAuthHeaders(){
  var h = {'Content-Type':'application/json'};
  try {
    var tok = localStorage.getItem('pw_token');
    if(tok) h['Authorization'] = 'Bearer '+tok;
  } catch(_){}
  return h;
}

// Lightweight inline modal — uses an existing #gameConfirm-style overlay div if present,
// else falls back to the section itself for picker rendering.
function _phdShowPicker(title, bodyHtml){
  var ov = document.getElementById('_phdPickerOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = '_phdPickerOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px';
    ov.onclick = function(e){ if(e.target===ov) _phdClosePicker(); };
    var inner = document.createElement('div');
    inner.style.cssText = 'width:100%;max-width:420px;background:linear-gradient(160deg,#0f1419,#191f26);border:1px solid rgba(128,203,196,.35);border-radius:14px;padding:14px 16px;box-shadow:0 24px 80px rgba(0,0,0,.7)';
    inner.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div id="_phdPickerTitle" style="flex:1;font-size:12px;color:#80cbc4;font-family:var(--fn);font-weight:800;letter-spacing:1px"></div><button onclick="_phdClosePicker()" style="background:none;border:1px solid rgba(255,255,255,.15);color:var(--tx2);font-size:14px;width:26px;height:26px;border-radius:6px;cursor:pointer">✕</button></div><div id="_phdPickerBody"></div>';
    ov.appendChild(inner);
    document.body.appendChild(ov);
  }
  document.getElementById('_phdPickerTitle').textContent = title || '';
  document.getElementById('_phdPickerBody').innerHTML = bodyHtml || '';
  ov.style.display = 'flex';
}
function _phdClosePicker(){ var ov = document.getElementById('_phdPickerOverlay'); if(ov) ov.style.display='none'; }

function renderGuildAlliance(guild, myRole){
  var box = document.getElementById('guildAllianceSection');
  if(!box || !guild) return;
  var isLeader = myRole === 'leader';
  fetch('/api/guilds/'+guild.id+'/alliance').then(function(r){return r.json()}).then(function(d){
    var a = d && d.alliance;
    if(!a){
      // Not in any alliance
      var html = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:6px">'+
        (LANG==='ko'?'동맹 미가입':LANG==='ja'?'同盟未加入':LANG==='zh'?'未加入联盟':'Not in any alliance')+
      '</div>';
      if(isLeader){
        html += '<div style="display:flex;gap:4px;margin-top:6px">'+
          '<button onclick="openJoinAllianceModal('+guild.id+')" style="flex:1;padding:6px;border-radius:6px;background:rgba(128,203,196,.1);border:1px solid rgba(128,203,196,.3);color:#80cbc4;font-size:9px;cursor:pointer;font-family:var(--fn)">🤝 JOIN ALLIANCE</button>'+
        '</div>';
      }
      box.innerHTML = html;
      return;
    }
    // In an alliance: list member guilds
    fetch('/api/alliances/'+a.id+'/guilds').then(function(r){return r.json()}).then(function(g){
      var guilds = g.guilds || [];
      var html = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:700;color:#80cbc4">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
        '<div style="font-size:8px;color:var(--tx3);margin-left:auto">'+guilds.length+'/3</div>'+
      '</div>';
      html += guilds.map(function(mg){
        var emblem = mg.emblem_emoji || '🔴';
        var name = '['+mg.guild_tag+'] '+mg.guild_name;
        var leaderName = mg.leader_nickname || (mg.leader_wallet ? mg.leader_wallet.slice(0,8)+'...' : '');
        var marker = mg.guild_id === guild.id ? '<span style="font-size:8px;color:var(--cyan)">• YOU</span>' : '';
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed rgba(128,203,196,.1)">'+
          '<span style="font-size:13px">'+_esc(emblem)+'</span>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:10px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(name)+'</div>'+
            '<div style="font-size:8px;color:var(--tx3)">Lv.'+(mg.level||1)+' · '+(mg.member_count||0)+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+_esc(leaderName)+'</div>'+
          '</div>'+
          marker+
        '</div>';
      }).join('');
      // Leader actions
      if(isLeader){
        html += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">';
        if(guilds.length < 3){
          html += '<button onclick="openInviteGuildToAllianceModal('+a.id+','+guild.id+')" style="flex:1;min-width:100px;padding:6px;border-radius:6px;background:rgba(128,203,196,.1);border:1px solid rgba(128,203,196,.3);color:#80cbc4;font-size:9px;cursor:pointer;font-family:var(--fn)">+ INVITE GUILD</button>';
        }
        html += '<button onclick="leaveAllianceAsGuild('+a.id+','+guild.id+')" style="flex:1;min-width:80px;padding:6px;border-radius:6px;background:rgba(255,140,66,.08);border:1px solid rgba(255,140,66,.25);color:#ff8c42;font-size:9px;cursor:pointer;font-family:var(--fn)">⚡ LEAVE</button>';
        html += '<button onclick="openBetrayAllianceModal('+guild.id+','+a.id+')" style="flex:1;min-width:80px;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);color:var(--red);font-size:9px;cursor:pointer;font-family:var(--fn)" title="Switch to another alliance immediately">⚔️ BETRAY</button>';
        html += '</div>';
      }
      box.innerHTML = html;
    }).catch(function(){
      box.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load alliance guilds</div>';
    });
  }).catch(function(){
    box.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load alliance</div>';
  });
}

function openJoinAllianceModal(guildId){
  fetch('/api/alliances').then(function(r){return r.json()}).then(function(d){
    var alliances = (d.alliances||[]).filter(function(a){ return !a.disbanded_at; });
    if(!alliances.length){ showAlert('No alliances exist. Create one in the QUESTS tab → Alliance panel.'); return; }
    var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Pick an alliance to join. (Leader cooldown applies after leaving.)</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">';
    alliances.forEach(function(a){
      html += '<button onclick="addGuildToAlliance('+a.id+','+guildId+');_phdClosePicker();" style="padding:8px 10px;background:rgba(128,203,196,.08);border:1px solid rgba(128,203,196,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">'+
        '<div style="font-weight:700;color:#80cbc4">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
        '<div style="font-size:8px;color:var(--tx3)">members: '+(a.member_count||0)+'/'+(a.max_members||0)+'</div>'+
      '</button>';
    });
    html += '</div>';
    _phdShowPicker('JOIN ALLIANCE', html);
  });
}

function addGuildToAlliance(allianceId, guildId){
  fetch('/api/alliances/'+allianceId+'/guilds/add',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error + (d.meta ? ' ('+JSON.stringify(d.meta)+')' : '')); return; }
    showToast('🤝 Joined alliance');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

function openInviteGuildToAllianceModal(allianceId, myGuildId){
  var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Enter target guild ID or name to invite:</div>'+
    '<input type="text" id="_invGuildInput" placeholder="guild name or ID" style="width:100%;padding:8px 10px;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:11px;border-radius:6px;font-family:var(--fn);box-sizing:border-box">'+
    '<button onclick="_doInviteGuildToAlliance('+allianceId+')" style="margin-top:8px;width:100%;padding:8px;background:linear-gradient(135deg,rgba(128,203,196,.3),rgba(128,203,196,.1));border:1px solid rgba(128,203,196,.5);color:#80cbc4;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;font-family:var(--fn)">INVITE</button>';
  _phdShowPicker('INVITE GUILD TO ALLIANCE', html);
}

function _doInviteGuildToAlliance(allianceId){
  var input = document.getElementById('_invGuildInput');
  if(!input || !input.value.trim()) return;
  var v = input.value.trim();
  if(/^\d+$/.test(v)) { addGuildToAlliance(allianceId, parseInt(v)); _phdClosePicker(); return; }
  fetch('/api/guild/search?q='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(d){
    var matches = d.guilds || [];
    if(!matches.length){ showAlert('No guild found with that name'); return; }
    if(matches.length === 1){ addGuildToAlliance(allianceId, matches[0].id); _phdClosePicker(); return; }
    var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Multiple guilds match — pick one:</div>';
    matches.forEach(function(g){
      html += '<button onclick="addGuildToAlliance('+allianceId+','+g.id+');_phdClosePicker();" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;background:rgba(128,203,196,.08);border:1px solid rgba(128,203,196,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">['+_esc(g.tag)+'] '+_esc(g.name)+'</button>';
    });
    _phdShowPicker('PICK GUILD', html);
  });
}

async function leaveAllianceAsGuild(allianceId, guildId){
  var ok=await gameConfirm({icon:'🤝',title:LANG==='ko'?'동맹 탈퇴':LANG==='ja'?'同盟脱退':LANG==='zh'?'退出联盟':'Leave Alliance',body:LANG==='ko'?'탈퇴 후 쿨다운 기간 동안 재가입이 제한됩니다.':LANG==='ja'?'脱退後のクールダウン期間中は再加入が制限されます。':LANG==='zh'?'退出后冷却期间内将限制重新加入。':'A cooldown period will restrict rejoining after leaving.',confirmText:LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'});
  if(!ok) return;
  fetch('/api/alliances/'+allianceId+'/guilds/remove',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showToast('Left alliance');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

function openBetrayAllianceModal(guildId, fromAllianceId){
  fetch('/api/alliances').then(function(r){return r.json()}).then(function(d){
    var alliances = (d.alliances||[]).filter(function(a){
      return !a.disbanded_at && parseInt(a.id) !== parseInt(fromAllianceId);
    });
    if(!alliances.length){ showAlert('No other alliance available to defect to.'); return; }
    var html = '<div style="font-size:10px;color:var(--red);margin-bottom:8px">⚠️ BETRAYAL is permanent and recorded in the Chronicle. Pick the new alliance:</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">';
    alliances.forEach(function(a){
      html += '<button onclick="confirmBetrayAlliance('+guildId+','+fromAllianceId+','+a.id+');_phdClosePicker();" style="padding:8px 10px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">'+
        '<div style="font-weight:700;color:var(--red)">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
      '</button>';
    });
    html += '</div>';
    _phdShowPicker('⚔️ BETRAY ALLIANCE', html);
  });
}

function confirmBetrayAlliance(guildId, fromAllianceId, toAllianceId){
  fetch('/api/alliances/betray',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId, fromAllianceId: fromAllianceId, toAllianceId: toAllianceId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error + (d.meta ? ' ('+JSON.stringify(d.meta)+')' : '')); return; }
    showToast('⚔️ BETRAYED — defected to new alliance!');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

// ── Guild upgrade panel ──
var _guildLevelCosts = {2:200, 3:500, 4:1500, 5:5000, 6:15000};
var _guildResearchCatalog = [
  {key:'mining_eff_1',  labelKey:'research_mining_eff_1',  cost:500,  desc:{ko:'채굴 PP +3%',ja:'採掘 PP +3%',zh:'采矿 PP +3%',en:'Mining PP +3%'}, icon:'⛏️'},
  {key:'shield_disc',   labelKey:'research_shield_disc',   cost:500,  desc:{ko:'침공 방어 +15%',ja:'侵攻防御 +15%',zh:'入侵防御 +15%',en:'Invasion Defense +15%'}, icon:'🛡️'},
  {key:'diplomatic',    labelKey:'research_diplomatic',    cost:500,  desc:{ko:'침공 성공률 -10%',ja:'侵攻成功率 -10%',zh:'入侵成功率 -10%',en:'Invasion Success Rate -10%'}, icon:'🕊️'},
  {key:'orbital_scan',  labelKey:'research_orbital_scan',  cost:2000, desc:{ko:'탐험 보상 +15%',ja:'探索報酬 +15%',zh:'探索奖励 +15%',en:'Exploration Reward +15%'}, icon:'🔭'},
  {key:'rapid_deploy',  labelKey:'research_rapid_deploy',  cost:2000, desc:{ko:'미션 시간 -20%',ja:'ミッション時間 -20%',zh:'任务时间 -20%',en:'Mission Time -20%'}, icon:'⚡'},
  {key:'logistics',     labelKey:'research_logistics',     cost:2000, desc:{ko:'비용 -10%',ja:'コスト -10%',zh:'费用 -10%',en:'Cost -10%'}, icon:'📦'},
  {key:'mars_dominion', labelKey:'research_mars_dominion', cost:5000,  desc:{ko:'전체 +5% 중첩',ja:'全体 +5% スタック',zh:'全体 +5% 叠加',en:'All +5% stack'}, icon:'👑'}
];
function renderGuildUpgrades(guild, myRole){
  var lvl = parseInt(guild.level||1);
  var treasury = parseFloat(guild.gpTreasury||guild.gp_treasury||0);
  var maxMembers = guild.maxMembers || 20;
  var memberCount = (guild.members||[]).length;
  var researchSlots = guild.researchSlots || (1 + lvl); // fallback: 2 base + 1 per level
  document.getElementById('guildLevelBadge').textContent = 'LV.'+lvl;
  document.getElementById('guildPpTreasury').textContent = Math.floor(treasury)+' GP';
  var nextCost = _guildLevelCosts[lvl+1];
  var btn = document.getElementById('guildLevelupBtn');
  var costEl = document.getElementById('guildNextLevelCost');
  if(!nextCost){
    costEl.textContent = t('guild_max_level');
    btn.style.display='none';
  } else {
    var nextSlots = Math.min(7, researchSlots + 1);
    var memberDefaults = {2:5,3:5,4:10,5:10,6:10};
    var nextMembers = maxMembers + (memberDefaults[lvl+1]||0);
    costEl.innerHTML = t('guild_next_prefix')+' '+nextCost+' GP (→ Lv.'+(lvl+1)+')'+
      '<br><span style="color:var(--gn);font-size:7px">🔬 '+(LANG==='ko'?'연구 '+nextSlots+'슬롯':LANG==='ja'?'研究 '+nextSlots+'スロット':LANG==='zh'?'研究 '+nextSlots+'槽':'Research '+nextSlots+' slots')+' · 👥 '+(LANG==='ko'?'최대 '+nextMembers+'명':LANG==='ja'?'最大 '+nextMembers+'人':LANG==='zh'?'最多 '+nextMembers+'人':'Max '+nextMembers)+'</span>';
    btn.style.display = '';
    btn.disabled = treasury < nextCost;
    btn.style.opacity = (treasury < nextCost) ? 0.5 : 1;
  }
  // Member count / cap display
  var treasuryEl = document.getElementById('guildPpTreasury');
  if(treasuryEl) treasuryEl.innerHTML = Math.floor(treasury)+' GP<br><span style="font-size:7px;color:var(--tx3)">👥 '+memberCount+'/'+maxMembers+' · 🔬 '+researchSlots+'/7</span>';
  // Contribution slider — populate with my current %
  var me = (guild.members||[]).find(function(m){return m.wallet===walletState.address});
  var myPct = (me && me.contributionPct!=null) ? me.contributionPct : 5;
  var slider = document.getElementById('guildContribSlider');
  if(slider){
    slider.value = myPct;
    document.getElementById('guildContribPctLabel').textContent = myPct+'%';
  }
  // Show my GP balance in donate section
  var donateGPEl = document.getElementById('guildDonateMyGP');
  var myGP = walletState.gameGP || (_dailyState&&_dailyState.gpBalance) || 0;
  if(donateGPEl) donateGPEl.textContent = (LANG==='ko'?'내 GP: ':LANG==='ja'?'自分のGP: ':LANG==='zh'?'我的GP: ':'My GP: ')+Math.floor(myGP);
  // Research grid — slot-locked based on guild level
  var flags = guild.researchFlags || guild.research_flags || {};
  var canSpend = (myRole==='leader'||myRole==='officer');
  var grid = document.getElementById('guildResearchGrid');
  grid.innerHTML = _guildResearchCatalog.map(function(r, idx){
    var unlocked = !!flags[r.key];
    var slotLocked = idx >= researchSlots;
    var affordable = treasury >= r.cost;
    if(slotLocked){
      // Locked slot — greyed out with lock icon
      var neededLvl = Math.max(2, idx); // approximate level needed
      return '<div style="padding:5px 6px;border-radius:6px;background:rgba(255,255,255,.01);border:1px solid rgba(255,255,255,.06);cursor:default;min-height:0;opacity:.4">'+
        '<div style="color:var(--tx3);font-weight:700;font-size:11px">🔒 '+t(r.labelKey)+'</div>'+
        '<div style="color:var(--tx3);font-size:8px;margin-top:1px">'+(typeof r.desc==='object'?r.desc[LANG]||r.desc.en:r.desc)+'</div>'+
        '<div style="color:var(--tx3);font-size:8px;margin-top:2px">Lv.'+(idx)+(LANG==='ko'?' 필요':LANG==='ja'?' 必要':LANG==='zh'?' 需要':' req.')+'</div>'+
      '</div>';
    }
    var bg = unlocked ? 'rgba(76,216,154,.1)' : 'rgba(255,255,255,.03)';
    var bdr = unlocked ? 'rgba(76,216,154,.35)' : 'rgba(184,136,224,.2)';
    var col = unlocked ? 'var(--gn)' : (affordable ? 'var(--pp)' : 'var(--tx3)');
    var status = unlocked ? t('guild_research_unlocked') : (r.cost+' GP');
    var click = (unlocked||!canSpend||!affordable) ? '' : ' onclick="guildUnlockResearch(\''+r.key+'\')"';
    return '<div'+click+' style="padding:5px 6px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';cursor:'+(click?'pointer':'default')+';min-height:0">'+
      '<div style="color:'+col+';font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+t(r.labelKey)+'</div>'+
      '<div style="color:var(--tx3);font-size:8px;margin-top:1px">'+(typeof r.desc==='object'?r.desc[LANG]||r.desc.en:r.desc)+'</div>'+
      '<div style="color:'+(unlocked?'var(--gn)':'var(--tx3)')+';font-size:9px;margin-top:2px;font-weight:600">'+status+'</div>'+
    '</div>';
  }).join('');
}

function guildDonateGP(){
  if(!_myGuildData) return;
  var amt = parseInt(document.getElementById('guildDonateAmt').value);
  if(!amt||amt<=0){ showToast(LANG==='ko'?'금액을 입력하세요':LANG==='ja'?'金額を入力してください':LANG==='zh'?'请输入金额':'Enter an amount'); return; }
  fetch('/api/guild/donate',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address, guildId:_myGuildData.id, amount:amt})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    walletState.gameGP = d.gpBalance!=null ? d.gpBalance : (walletState.gameGP - amt);
    refreshEmailBalances();
    document.getElementById('guildDonateAmt').value = '';
    showToast('💰 '+amt+' GP '+(LANG==='ko'?'기부 완료!':LANG==='ja'?'寄付完了!':LANG==='zh'?'捐赠完成!':'donated!'),'success');
    loadGuildTab();
  }).catch(function(e){ showToast((LANG==='ko'?'기부 실패: ':LANG==='ja'?'寄付失敗: ':LANG==='zh'?'捐赠失败: ':'Donate failed: ')+e.message,'error'); });
}
function guildLevelUp(){
  if(!_myGuildData) return;
  fetch('/api/guild/levelup',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,guildId:_myGuildData.id})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert(t('guild_toast_leveled_up').replace('{n}', d.level),'success');
    loadGuildTab();
  }).catch(function(e){ showAlert(t('guild_toast_levelup_failed')+': '+e.message); });
}
function guildSetContribution(pct){
  fetch('/api/guild/contribution',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,pct:parseInt(pct)})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); }
  }).catch(function(){});
}
function guildUnlockResearch(key){
  if(!_myGuildData) return;
  fetch('/api/guild/research',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,guildId:_myGuildData.id,key:key})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert(t('guild_toast_research_unlocked'),'success');
    loadGuildTab();
  }).catch(function(e){ showAlert(t('guild_toast_research_failed')+': '+e.message); });
}

// ═══════════════════════════════════════
//  GUILD WARS UI
// ═══════════════════════════════════════

function guildWarIntel(myScore, theirScore, hrs, mins){
  var diff = (parseInt(myScore,10)||0) - (parseInt(theirScore,10)||0);
  var totalMin = Math.max(0, (parseInt(hrs,10)||0)*60 + (parseInt(mins,10)||0));
  var close = Math.abs(diff) <= 10;
  var late = totalMin <= 180;
  var color = diff > 0 ? 'var(--gn)' : diff < 0 ? 'var(--red)' : 'var(--gold)';
  var status = diff > 0
    ? (LANG==='ko'?'우세':LANG==='ja'?'優勢':LANG==='zh'?'优势':'ADVANTAGE')
    : diff < 0
      ? (LANG==='ko'?'열세':LANG==='ja'?'劣勢':LANG==='zh'?'劣势':'BEHIND')
      : (LANG==='ko'?'동점':LANG==='ja'?'同点':LANG==='zh'?'平分':'EVEN');
  var advice;
  if(late && diff > 0) advice = LANG==='ko'?'종반 방어: 적 주력 함대를 묶고 무리한 추가 교전은 줄이세요.':LANG==='ja'?'終盤防衛: 敵主力を拘束し、無理な追加交戦は抑える。':LANG==='zh'?'终局防守：牵制敌方主力，减少冒险交战。':'Endgame defense: pin enemy main fleets and avoid unnecessary extra fights.';
  else if(late && diff <= 0) advice = LANG==='ko'?'종반 역전: 준비된 함대로 즉시 함대전을 걸어 점수차를 줄이세요.':LANG==='ja'?'終盤逆転: 準備済み艦隊で即時交戦し点差を縮める。':LANG==='zh'?'终局翻盘：用可战舰队立即交战缩小分差。':'Endgame comeback: use ready fleets now to cut the score gap.';
  else if(close) advice = LANG==='ko'?'접전: 승률 높은 표적을 골라 안정적으로 +10점을 쌓으세요.':LANG==='ja'?'接戦: 勝率の高い標的を選び安定して+10点を積む。':LANG==='zh'?'胶着：选择胜率高的目标稳定拿+10分。':'Close war: pick favorable targets and stack reliable +10 point wins.';
  else if(diff > 0) advice = LANG==='ko'?'리드 유지: 적 준비 함대 수를 확인하고 반격 타이밍을 막으세요.':LANG==='ja'?'リード維持: 敵の準備艦隊数を見て反撃タイミングを潰す。':LANG==='zh'?'保持领先：观察敌方可战舰队，压制反击窗口。':'Hold the lead: watch enemy ready fleets and deny their counter window.';
  else advice = LANG==='ko'?'추격 필요: 고위험 표적보다 이길 수 있는 적 함대를 우선 치세요.':LANG==='ja'?'追撃必要: 高リスク標的より勝てる敵艦隊を優先。':LANG==='zh'?'需要追分：优先攻击能赢的敌舰队，而非高风险目标。':'Chase points: prioritize beatable enemy fleets over high-risk targets.';
  return '<div style="margin:6px 0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);font-size:8.5px;line-height:1.55">'
    + '<span style="color:'+color+';font-weight:900">'+status+' '+(diff>0?'+':'')+diff+' pts</span>'
    + '<span style="color:var(--tx3)"> · '+(late?(LANG==='ko'?'종반':LANG==='ja'?'終盤':LANG==='zh'?'终局':'endgame'):(LANG==='ko'?'진행중':LANG==='ja'?'進行中':LANG==='zh'?'进行中':'active'))+'</span><br>'
    + '<span style="color:var(--tx2)">'+advice+'</span>'
    + '</div>';
}

function renderGuildWars(guildId){
  var warBox = document.getElementById('guildWarSection');
  if(!warBox) return;
  _guildReadJson('war-active:' + guildId, '/api/guild/war/active?guildId='+guildId, 15000, false).then(function(d){
    if(!d) return;
    var wars = d.wars||[];
    if(!wars.length){
      warBox.innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+
        (LANG==='ko'?'⚔️ 전쟁 없음':LANG==='ja'?'⚔️ 戦争なし':LANG==='zh'?'⚔️ 暂无战争':'⚔️ No active wars')+
        '<br><button onclick="showDeclareWarModal()" style="margin-top:8px;padding:6px 16px;border-radius:6px;background:linear-gradient(135deg,#E84855,#C62828);border:none;color:#fff;font-size:10px;font-weight:700;cursor:pointer">⚔️ '+(LANG==='ko'?'전쟁 선포':LANG==='ja'?'宣戦布告':LANG==='zh'?'宣战':'Declare War')+'</button>'+
      '</div>';
      return;
    }
    warBox.innerHTML=wars.map(function(w){
      var isAtk = w.attacker_guild_id === guildId;
      var enemy = isAtk ? w.defender_name : w.attacker_name;
      var enemyTag = isAtk ? w.defender_tag : w.attacker_tag;
      var myScore = isAtk ? w.attacker_score : w.defender_score;
      var theirScore = isAtk ? w.defender_score : w.attacker_score;
      var total = Math.max(1, myScore+theirScore);
      var pct = Math.round(myScore/total*100);
      var endMs = new Date(w.war_end).getTime()-Date.now();
      var hrs = Math.max(0,Math.floor(endMs/3600000));
      var mins = Math.max(0,Math.floor((endMs%3600000)/60000));
      return '<div style="background:rgba(232,72,85,.06);border:1px solid rgba(232,72,85,.2);border-radius:8px;padding:10px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<span style="font-size:11px;font-weight:700;color:var(--red)">⚔️ vs ['+enemyTag+'] '+enemy+'</span>'+
          '<span style="font-size:8px;color:var(--tx3)">'+hrs+'h '+mins+'m</span>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
          '<span style="font-size:12px;font-weight:700;color:var(--cyan)">'+myScore+'</span>'+
          '<div style="flex:1;height:8px;background:rgba(255,255,255,.05);border-radius:4px;overflow:hidden">'+
            '<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,var(--cyan),var(--pp));border-radius:4px"></div>'+
          '</div>'+
          '<span style="font-size:12px;font-weight:700;color:var(--red)">'+theirScore+'</span>'+
        '</div>'+
          '<div style="font-size:8px;color:var(--tx3);margin:4px 0 5px;line-height:1.5">'+(LANG==='ko'?'⚔️ 적 길드 멤버에게 <b style="color:#ff8a80">함대전</b>을 선포하여 길드전 포인트를 획득하세요! (승리 시 <b style="color:var(--gold)">+10 pts</b>)':LANG==='ja'?'⚔️ 敵ギルドメンバーに<b style="color:#ff8a80">艦隊戦</b>を宣戦してギルド戦ポイントを獲得！(勝利で<b style="color:var(--gold)">+10 pts</b>)':LANG==='zh'?'⚔️ 向敌方公会成员宣战<b style="color:#ff8a80">舰队战</b>获取公会战积分！(胜利<b style="color:var(--gold)">+10 pts</b>)':'⚔️ Declare fleet battle vs enemy guild members to earn points! (Win: <b style="color:var(--gold)">+10 pts</b>)')+'</div>'+
        guildWarIntel(myScore, theirScore, hrs, mins)+
        '<div style="display:flex;gap:4px;margin-top:2px">'+
          '<button onclick="openGuildWarFight('+w.id+','+guildId+')" style="flex:2;padding:6px;border-radius:6px;background:linear-gradient(135deg,rgba(232,72,85,.28),rgba(200,40,40,.12));border:1px solid rgba(232,72,85,.5);color:#ff8a80;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.5px">⚔️ '+(LANG==='ko'?'함대전 선포':LANG==='ja'?'艦隊戦宣戦':LANG==='zh'?'宣战舰队战':'Declare Battle')+'</button>'+
          '<button onclick="viewWarScoreboard('+w.id+')" style="flex:1;padding:6px;border-radius:6px;background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);color:var(--gn);font-size:9px;cursor:pointer">📊 SCORES</button>'+
        '</div>'+
      '</div>';
    }).join('')+
    '<button onclick="showDeclareWarModal()" style="margin-top:6px;width:100%;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);color:var(--red);font-size:9px;cursor:pointer">+ '+(LANG==='ko'?'전쟁 선포':LANG==='ja'?'宣戦布告':LANG==='zh'?'宣战':'Declare War')+'</button>';
  }).catch(function(){ warBox.innerHTML=''; });
}

var _warDeclareTarget = null;
var _warAllGuilds = [];
function showDeclareWarModal(){
  if(!_myGuildData) return;
  _warDeclareTarget = null;
  var treasury = parseFloat(_myGuildData.gpTreasury||_myGuildData.gp_treasury||0);
  var balEl = document.getElementById('warTreasuryBal');
  balEl.textContent = Math.floor(treasury)+' GP';
  // Parse cost from the already-displayed warDeclareCost label (set from guild data or default 200)
  var costLabel = document.getElementById('warDeclareCost');
  var declareCost = costLabel ? (parseInt(costLabel.textContent) || 200) : 200;
  balEl.style.color = treasury < declareCost ? 'var(--red)' : 'var(--gn)';
  document.getElementById('warConfirmSection').style.display = 'none';
  document.getElementById('warTargetList').innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'로딩중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...')+'</div>';
  var inp = document.getElementById('warSearchInput');
  if(inp) inp.value = '';
  document.getElementById('declareWarModal').style.display='flex';
  // Auto-load all guilds
  _guildReadJson('war-targets', '/api/guild/leaderboard?limit=50', 30000, false).then(function(d){
    if(!d) {
      if(_warAllGuilds.length) _renderWarGuildList(_warAllGuilds);
      else document.getElementById('warTargetList').innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'요청이 식는 중입니다. 잠시 후 다시 시도하세요.':LANG==='ja'?'リクエスト待機中です。少し後に再試行してください。':LANG==='zh'?'请求正在冷却，请稍后再试。':'Request is cooling down. Try again in a moment.')+'</div>';
      return;
    }
    _warAllGuilds = (d.guilds||[]).filter(function(g){return g.id!==_myGuildData.id});
    _renderWarGuildList(_warAllGuilds);
  }).catch(function(){ document.getElementById('warTargetList').innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'길드 목록을 불러올 수 없습니다':LANG==='ja'?'ギルドリストを読み込めません':LANG==='zh'?'无法加载公会列表':'Failed to load guild list')+'</div>'; });
}
function closeDeclareWarModal(){
  document.getElementById('declareWarModal').style.display='none';
}
function searchWarTargetModal(q){
  var filtered = _warAllGuilds;
  if(q && q.length>=1){
    var lq = q.toLowerCase();
    filtered = _warAllGuilds.filter(function(g){
      return (g.name||'').toLowerCase().indexOf(lq)>=0 || (g.tag||'').toLowerCase().indexOf(lq)>=0;
    });
  }
  _renderWarGuildList(filtered);
}
function _renderWarGuildList(guilds){
  var box=document.getElementById('warTargetList');
  if(!box) return;
  if(!guilds.length){ box.innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'선포 가능한 길드가 없습니다':LANG==='ja'?'宣戦可能なギルドがありません':LANG==='zh'?'没有可宣战的公会':'No guilds available to declare war')+'</div>'; return; }
  box.innerHTML=guilds.map(function(g){
    var emblem = g.emblem||g.emblem_emoji||'🔴';
    var name = g.name||'';
    var tag = g.tag||'';
    var lvl = g.level||1;
    var cnt = g.memberCount||g.member_count||0;
    var px = g.totalPixels||g.total_pixels||0;
    return '<div onclick="selectWarTarget('+g.id+')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--bdr);margin-bottom:6px;cursor:pointer;transition:all .12s" '+
      'onmouseenter="this.style.background=\'rgba(232,72,85,.1)\';this.style.borderColor=\'rgba(232,72,85,.35)\'" '+
      'onmouseleave="this.style.background=\'rgba(255,255,255,.03)\';this.style.borderColor=\'var(--bdr)\'" '+
      'data-gid="'+g.id+'">'+
      '<span style="font-size:22px">'+emblem+'</span>'+
      '<div style="flex:1"><div style="font-size:12px;color:var(--tx);font-weight:700">['+tag+'] '+name+'</div>'+
      '<div style="font-size:9px;color:var(--tx3);margin-top:2px">Lv.'+lvl+' · '+cnt+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+px+' PX</div></div>'+
      '<span style="font-size:16px;color:var(--red)">⚔️</span>'+
    '</div>';
  }).join('');
}
function selectWarTarget(id){
  _warDeclareTarget = id;
  var g = _warAllGuilds.find(function(x){return x.id===id});
  if(!g) return;
  document.getElementById('warTargetEmblem').textContent = g.emblem||g.emblem_emoji||'🔴';
  document.getElementById('warTargetName').textContent = '['+g.tag+'] '+g.name;
  document.getElementById('warTargetInfo').textContent = 'Lv.'+(g.level||1)+' · '+(g.memberCount||g.member_count||0)+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+(g.totalPixels||g.total_pixels||0)+' PX';
  document.getElementById('warConfirmSection').style.display = 'block';
  // Highlight selected
  var items = document.querySelectorAll('#warTargetList > div[data-gid]');
  items.forEach(function(el){
    if(parseInt(el.getAttribute('data-gid'))===id){
      el.style.background='rgba(232,72,85,.15)';
      el.style.borderColor='rgba(232,72,85,.5)';
    } else {
      el.style.background='rgba(255,255,255,.03)';
      el.style.borderColor='var(--bdr)';
    }
  });
}
function confirmDeclareWar(){
  if(!_warDeclareTarget||!_myGuildData) return;
  var btn = document.getElementById('warConfirmBtn');
  btn.disabled=true; btn.textContent=t('war_declaring_btn');
  var stakeInput = document.getElementById('warStakeInput');
  var durInput = document.getElementById('warDurationInput');
  var stake = stakeInput ? parseInt(stakeInput.value) : 0;
  var dur = durInput ? parseInt(durInput.value) : 0;
  var body = {
    wallet: walletState.address,
    guildId: _myGuildData.id,
    targetGuildId: _warDeclareTarget,
  };
  if (stake && stake > 0) body.stakeGp = stake;
  if (dur && dur > 0) body.durationHours = dur;
  fetch('/api/guild/war/declare',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify(body)
  }).then(function(r){return r.json()}).then(function(d){
    btn.disabled=false; btn.textContent=t('war_declare_btn');
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    closeDeclareWarModal();
    var msg = '⚔️ '+(LANG==='ko'?'전쟁 선포 완료!':LANG==='ja'?'宣戦布告完了!':LANG==='zh'?'宣战完成!':'War declared!');
    if (stake > 0) msg += ' (+'+stake+' GP stake)';
    showToast(msg,'success');
    loadGuildTab();
  }).catch(function(e){ btn.disabled=false; btn.textContent=t('war_declare_btn'); showToast(e.message,'error'); });
}

async function viewWarScoreboard(warId){
  try{
    var resp = await fetch('/api/guild/war/'+warId+'/scores');
    var d = await resp.json();
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    var gs = d.guildScores||{};
    var atkName = gs.attacker?gs.attacker.name:'Attacker';
    var defName = gs.defender?gs.defender.name:'Defender';
    var atkPts  = gs.attacker?gs.attacker.total:0;
    var defPts  = gs.defender?gs.defender.total:0;
    var topHtml = '';
    if(d.topPlayers&&d.topPlayers.length){
      topHtml += '<div style="font-size:9px;color:var(--tx3);margin:8px 0 4px;letter-spacing:1px">TOP PLAYERS</div>';
      d.topPlayers.slice(0,10).forEach(function(p,i){
        topHtml += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;border-bottom:1px solid rgba(255,255,255,.06)">'
          +'<span style="color:var(--tx)">'+(i+1)+'. '+(p.nickname||shortAddr(p.wallet))+'</span>'
          +'<span style="color:var(--gn)">'+p.total_points+' pts</span>'
          +'</div>';
      });
    }
    if(d.gameBreakdown&&d.gameBreakdown.length){
      topHtml += '<div style="font-size:9px;color:var(--tx3);margin:8px 0 4px;letter-spacing:1px">BY GAME</div>';
      d.gameBreakdown.forEach(function(g){
        topHtml += '<div style="font-size:10px;color:var(--tx);padding:2px 0">'+g.game_type+': <b style="color:var(--gn)">'+g.total_points+' pts</b> ('+g.play_count+' plays)</div>';
      });
    }
    gameConfirm({
      title:'WAR SCOREBOARD', icon:'📊',
      body:'<div style="font-family:var(--fn)">'
        +'<div style="display:flex;justify-content:space-between;background:rgba(255,255,255,.04);border-radius:8px;padding:10px;margin-bottom:8px">'
          +'<div style="text-align:center"><div style="font-size:10px;color:var(--cyan);font-weight:700">'+atkName+'</div><div style="font-size:22px;font-weight:900;color:var(--cyan)">'+atkPts+'</div></div>'
          +'<div style="font-size:11px;color:var(--tx3);align-self:center">VS</div>'
          +'<div style="text-align:center"><div style="font-size:10px;color:var(--red);font-weight:700">'+defName+'</div><div style="font-size:22px;font-weight:900;color:var(--red)">'+defPts+'</div></div>'
        +'</div>'
        +topHtml
      +'</div>',
      confirmText:LANG==='ko'?'닫기':LANG==='ja'?'閉じる':LANG==='zh'?'关闭':'Close'
    });
  }catch(e){ showToast('Failed to load scoreboard','error'); }
}

// ── 길드전 함대전 선포 ──────────────────────────────────────────
async function openGuildWarFight(warId, guildId){
  if(!walletState||!walletState.address){ showToast(LANG==='ko'?'로그인이 필요합니다':LANG==='ja'?'ログインが必要です':LANG==='zh'?'请先登录':'Login required','error'); return; }
  showToast(LANG==='ko'?'적 길드 정보 불러오는 중...':LANG==='ja'?'敵ギルド情報を読込中...':LANG==='zh'?'正在加载敌方公会信息...':'Loading enemy guild data...','info');
  try{
    var [myData, enemyData] = await Promise.all([
      _guildReadJson('war-fleets', '/api/fleets', 8000),
      _guildReadJson('war-enemies:' + guildId + ':' + warId, '/api/guild/war/enemies?guildId='+guildId+'&warId='+warId, 10000)
    ]);
    if(!myData || !enemyData){ showToast(LANG==='ko'?'잠시 후 다시 시도하세요':LANG==='ja'?'少し後に再試行してください':LANG==='zh'?'请稍后重试':'Try again shortly','error'); return; }
    if(enemyData.error){ showToast(enemyData.error,'error'); return; }

    var myFleets = (myData.fleets||[]).filter(function(f){ return f.ships_alive>0 && !f.is_in_battle; });
    var enemies  = enemyData.enemies||[];
    var enemiesWithFleet = enemies.filter(function(e){ return parseInt(e.ready_fleets||0)>0; });

    // 둘 다 함대 없음
    if(myFleets.length===0 && enemiesWithFleet.length===0){
      showToast(t('fleet_both_no_fleet'),'error'); return;
    }
    // 내 함대 없음
    if(myFleets.length===0){
      showToast(t('fleet_no_combat_fleet'),'error'); return;
    }
    // 적 함대 없음 → 자동 승리
    if(enemiesWithFleet.length===0){
      var ok = await gameConfirm({
        title:t('gw_auto_win_title'),icon:'🏆',
        body:'<div style="text-align:center;padding:8px 0">'
          +'<div style="font-size:13px;color:var(--tx);margin-bottom:8px">'+t('gw_auto_win_body')+'</div>'
          +'<div style="font-size:11px;color:var(--gold)">'+t('gw_auto_win_pts')+'</div>'
          +'<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+t('gw_auto_win_limit')+'</div>'
          +'</div>',
        confirmText:t('gw_auto_win_btn')
      });
      if(!ok) return;
      var r = await fetch('/api/guild/war/auto-win',{
        method:'POST',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({war_id:warId,guild_id:guildId,wallet:walletState.address})
      });
      var rd = await r.json();
      if(!r.ok){
        var errMap={'AUTO_WIN_COOLDOWN':t('gw_auto_win_cooldown'),'ENEMY_HAS_FLEETS':t('gw_enemy_has_fleets')};
        showToast(errMap[rd.error]||('Error: '+rd.error),'error'); return;
      }
      showToast(t('gw_auto_win_toast').replace('{pts}',rd.points),'success');
      try{ renderGuildWars(guildId); }catch(_){}
      return;
    }

    // 양측 함대 있음 → 적 선택 피커
    window._gwfWarId  = warId;
    window._gwfGuildId= guildId;
    window._gwfTarget = null;

    var rowsHtml = enemies.map(function(e){
      var has = parseInt(e.ready_fleets||0)>0;
      var wallet = e.wallet||'';
      var nick   = escapeHtml(e.nickname || (wallet.slice(0,8)+'…'+wallet.slice(-4)));
      var lv     = e.rank_level||1;
      if(has){
        return '<div class="gwf-row" onclick="window._gwfTarget=\''+wallet+'\';'
          +'this.parentNode.querySelectorAll(\'.gwf-row.sel\').forEach(function(el){el.classList.remove(\'sel\')});'
          +'this.classList.add(\'sel\');'
          +'document.getElementById(\'gcConfirmBtn\').disabled=false;" '
          +'style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;'
          +'border-radius:6px;margin-bottom:4px;cursor:pointer;'
          +'background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25)">'
          +'<div><div style="font-size:11px;font-weight:700;color:var(--tx)">'+nick+'</div>'
          +'<div style="font-size:9px;color:var(--tx3)">Lv '+lv+'</div></div>'
          +'<div style="font-size:10px;color:var(--cyan)">⚔ '+e.ready_fleets+(LANG==='ko'?'함대':LANG==='ja'?'艦隊':LANG==='zh'?'舰队':' fleet(s)')+'</div>'
          +'</div>';
      }else{
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;'
          +'border-radius:6px;margin-bottom:4px;opacity:.35;'
          +'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">'
          +'<div><div style="font-size:11px;color:var(--tx2)">'+nick+'</div>'
          +'<div style="font-size:9px;color:var(--tx3)">Lv '+lv+'</div></div>'
          +'<div style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'함대 없음':LANG==='ja'?'艦隊なし':LANG==='zh'?'无舰队':'No fleet')+'</div>'
          +'</div>';
      }
    }).join('');

    var ok2 = await gameConfirm({
      title:LANG==='ko'?'함대전 선포':LANG==='ja'?'艦隊戦宣戦':LANG==='zh'?'宣战舰队战':'Declare Fleet Battle',icon:'⚔️',
      body:'<div style="font-family:var(--fn)">'
        +'<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">'+(LANG==='ko'?'공격할 적 길드원을 선택하세요 — 이기면 <b style="color:var(--gold)">+10 pts</b>':LANG==='ja'?'攻撃する敵ギルドメンバーを選択 — 勝利で <b style="color:var(--gold)">+10 pts</b>':LANG==='zh'?'选择要攻击的敌方公会成员 — 胜利可获得 <b style="color:var(--gold)">+10 pts</b>':'Select enemy member to attack — Win: <b style="color:var(--gold)">+10 pts</b>')+'</div>'
        +rowsHtml
        +'</div>',
      confirmText:LANG==='ko'?'선포하기':LANG==='ja'?'宣戦する':LANG==='zh'?'宣战':'Declare',
      disabled:true
    });
    if(!ok2||!window._gwfTarget) return;
    // 선택한 적 월렛으로 declare 모달 열기
    _openDeclareBattleVsWallet(window._gwfTarget);
  }catch(e){
    console.error('openGuildWarFight:',e);
    showToast(LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error','error');
  }
}

// declare battle 모달을 열고 대상 월렛으로 함대 검색 자동 수행
async function _openDeclareBattleVsWallet(targetWallet){
  // 1. 일반 declare 모달 열기
  await openDeclareBattle();
  // 2. 검색창에 대상 월렛 입력 후 자동 검색
  setTimeout(async function(){
    var inp = document.getElementById('declareTargetSearch');
    if(inp){
      inp.value = targetWallet;
      await doSearchTargets();
    }
  }, 150);
}

// declareWar replaced by confirmDeclareWar (modal-based)

// Quick-launch: open BASE → OPS with a mission type pre-selected.
function openOpsLauncher(type){
  try{
    if(!walletState||!walletState.address){ showToast('Sign in first','error'); return; }
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabOps');
      if(tab){ switchBaseTab('ops', tab); try{clearBaseTabDot('ops')}catch(_e){} loadOpsTab(); }
      setTimeout(function(){ if(typeof setOpsType==='function') setOpsType(type||'invasion'); }, 80);
    }, 120);
  }catch(e){ console.warn('openOpsLauncher failed', e); }
}

// ══════════════════════════════════════════════════════════
//  OPS (Missions) — launch / list / claim / canvas routes
// ══════════════════════════════════════════════════════════
window._opsType = 'invasion';
window._opsMissions = [];
window._opsSlotCap = 0;
var _opsTimer = window._opsTimer = null;

function setOpsType(t){
  window._opsType = t;
  var inv = document.getElementById('opsTypeInvasion');
  var exp = document.getElementById('opsTypeExplore');
  var targetW = document.getElementById('opsTargetWallet');
  var browseBtn = document.getElementById('opsBrowseTargetsBtn');
  if(inv) inv.classList.toggle('active', t==='invasion');
  if(exp) exp.classList.toggle('active', t==='exploration');
  if(targetW) targetW.style.display = (t==='invasion') ? '' : 'none';
  if(browseBtn) browseBtn.style.display = (t==='invasion') ? '' : 'none';
  updateOpsLaunchPreview();
}
function opsPickRandom(){
  // Invasion → random ENEMY territory (someone else's claim).
  // Exploration → random Mars coordinate.
  if(window._opsType === 'invasion'){
    var me = (walletState&&walletState.address||'').toLowerCase();
    var enemies = (window.claims||[]).filter(function(c){
      return c && c.owner && (c.owner||'').toLowerCase() !== me
        && typeof c.lat==='number' && typeof c.lng==='number';
    });
    if(!enemies.length){
      showToast('No enemy territories found on the map yet','error');
      return;
    }
    var pick = enemies[Math.floor(Math.random()*enemies.length)];
    document.getElementById('opsTargetLat').value = pick.lat.toFixed(2);
    document.getElementById('opsTargetLng').value = pick.lng.toFixed(2);
    document.getElementById('opsTargetWallet').value = pick.owner;
    document.getElementById('opsTargetWallet').dataset.display = pick.nickname || pick.owner.slice(0,10);
    updateOpsLaunchPreview();
    var who = pick.nickname || (pick.owner.slice(0,6)+'…'+pick.owner.slice(-4));
    showToast('Target locked: '+who+' @ '+pick.lat.toFixed(1)+'°, '+pick.lng.toFixed(1)+'°','success');
    return;
  }
  // Exploration: free-form Mars coord
  var lat = (Math.random()*140 - 70).toFixed(2);
  var lng = (Math.random()*360 - 180).toFixed(2);
  document.getElementById('opsTargetLat').value = lat;
  document.getElementById('opsTargetLng').value = lng;
  updateOpsLaunchPreview();
}

// Browse all enemy territories in a picker modal — pick by click.
function opsBrowseTargets(){
  var me = (walletState&&walletState.address||'').toLowerCase();
  var enemies = (window.claims||[]).filter(function(c){
    return c && c.owner && (c.owner||'').toLowerCase() !== me
      && typeof c.lat==='number' && typeof c.lng==='number';
  });
  if(!enemies.length){
    showToast('No enemy territories on the map yet','error');
    return;
  }
  // Sort by hijack count (juiciest first), then pixel-area
  enemies.sort(function(a,b){
    var ha=a.hijackCount||0, hb=b.hijackCount||0;
    if(ha!==hb) return hb-ha;
    return ((b.w||0)*(b.h||0)) - ((a.w||0)*(a.h||0));
  });
  var items = enemies.slice(0,80).map(function(c){
    var label = c.nickname || (c.owner.slice(0,6)+'…'+c.owner.slice(-4));
    var sub = c.lat.toFixed(1)+'°, '+c.lng.toFixed(1)+'°';
    if(c.guildTag) sub += ' · ['+c.guildTag+']';
    if(c.hijackCount) sub += ' · '+c.hijackCount+'⚔';
    return { value:String(c.id), label:label+'  —  '+sub };
  });
  gamePicker({ title:'SELECT INVASION TARGET', items:items }).then(function(id){
    if(!id) return;
    var pick = enemies.find(function(c){return String(c.id)===id});
    if(!pick) return;
    document.getElementById('opsTargetLat').value = pick.lat.toFixed(2);
    document.getElementById('opsTargetLng').value = pick.lng.toFixed(2);
    document.getElementById('opsTargetWallet').value = pick.owner;
    updateOpsLaunchPreview();
  });
}
// ── Launch pad picker state ────────────────────────────────────
window._opsPads = [];
window._opsSelectedPad = null;       // { id, lat, lng, ... }
window._opsPreviewData = null;        // last successful preview { tier, durationSec, costPP, multiplier }
window._opsPreviewTarget = null;      // { lat, lng } pair the preview is for

function loadOpsPads(){
  var w=walletState&&walletState.address; if(!w) return Promise.resolve();
  return _guildReadJson('mission-pads', '/api/missions/pads', 10000)
    .then(function(d){
      if(!d) return;
      window._opsPads = d.pads || [];
      // Drop selection if the pad is now busy or gone
      if(window._opsSelectedPad){
        var still = window._opsPads.find(function(p){return p.id===window._opsSelectedPad.id});
        if(!still || still.activeMission) window._opsSelectedPad = null;
      }
      // Auto-select the first ready pad if nothing is selected
      if(!window._opsSelectedPad){
        var ready = window._opsPads.find(function(p){return !p.activeMission});
        if(ready) window._opsSelectedPad = ready;
      }
      renderOpsPadList();
      var slotEl=document.getElementById('opsSlotInfo');
      if(slotEl){
        var freeCnt = window._opsPads.filter(function(p){return !p.activeMission}).length;
        slotEl.textContent = freeCnt+'/'+window._opsPads.length;
      }
      updateOpsLaunchPreview();
    })
    .catch(function(){});
}

function renderOpsPadList(){
  var el=document.getElementById('opsPadList'); if(!el) return;
  if(!window._opsPads.length){
    el.innerHTML='<div class="ops-pad-empty">'+t('ops_no_pads')+'</div>';
    return;
  }
  // Sort: READY pads first, LAUNCHED pads last
  var sorted = window._opsPads.slice().sort(function(a,b){
    var aB = a.activeMission ? 1 : 0;
    var bB = b.activeMission ? 1 : 0;
    return aB - bB;
  });
  var html = sorted.map(function(p){
    var busy = p.activeMission;
    var sel = (window._opsSelectedPad && window._opsSelectedPad.id===p.id);
    var classes='ops-pad-card';
    if(busy){
      classes += ' busy '+(busy.type==='invasion'?'invade':'explore');
    } else if(sel){
      classes += ' selected';
    }
    // Reward multiplier preview from pad pixel count (matches backend padRewardMultiplier)
    var px=p.pixelCount||0;
    var mult = px>0 ? Math.max(0.5, Math.min(3.0, Math.sqrt(px/25))) : 0.5;
    var multLabel = '×'+mult.toFixed(1);
    var statusLine;
    if(busy){
      var typIcon = busy.type==='invasion'?'⚔':'🛰';
      statusLine='<div class="pad-status">'+typIcon+' '+t('ops_launched')+'</div>';
    } else {
      statusLine='<div class="pad-status ready">'+t('ops_ready_status')+'</div>';
    }
    var memberLbl = (p.claimCount && p.claimCount>1) ? (' · '+p.claimCount+' '+t('ops_merged')) : '';
    return '<div class="'+classes+'" '+(busy?'':'onclick="selectOpsPad('+p.id+')"')+'">'
      + '<div class="pad-mult">'+multLabel+'</div>'
      + '<div>'
      +   '<div class="pad-id">'+t('ops_territory')+memberLbl+'</div>'
      +   '<div class="pad-coord">'+p.lat.toFixed(1)+'°, '+p.lng.toFixed(1)+'°</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-end">'
      +   statusLine
      +   '<div class="pad-px">'+px+' px</div>'
      + '</div>'
    + '</div>';
  }).join('');
  el.innerHTML = html;
}

function selectOpsPad(padId){
  var pad = window._opsPads.find(function(p){return p.id===padId});
  if(!pad || pad.activeMission) return;
  window._opsSelectedPad = pad;
  renderOpsPadList();
  updateOpsLaunchPreview();
}

var _opsPreviewTimer=null;
var _opsPreviewSeq=0;
function updateOpsLaunchPreview(){
  var latRaw=document.getElementById('opsTargetLat').value;
  var lngRaw=document.getElementById('opsTargetLng').value;
  var lat=parseFloat(latRaw);
  var lng=parseFloat(lngRaw);
  var el=document.getElementById('opsLaunchPreview');
  if(!el) return;
  // Update the live route preview on the map regardless of API state
  window._opsPreviewTarget = (isFinite(lat)&&isFinite(lng)) ? {lat:lat,lng:lng} : null;
  if(typeof requestRedraw==='function') requestRedraw();
  if(!window._opsSelectedPad){
    el.classList.remove('locked');
    el.innerHTML='<span class="ops-prev-hint">⌖ Pick a launch pad above</span>';
    window._opsPreviewData = null;
    return;
  }
  if(isNaN(lat)||isNaN(lng)){
    el.classList.remove('locked');
    el.innerHTML='<span class="ops-prev-hint">⌖ Awaiting target lock…</span>';
    window._opsPreviewData = null;
    return;
  }
  el.classList.add('locked');
  el.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+window._opsSelectedPad.id+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
    +'<span class="ops-prev-eta scanning">…computing trajectory</span>';
  if(_opsPreviewTimer) _clearActiveTimeout(_opsPreviewTimer);
  var seq=++_opsPreviewSeq;
  var padId = window._opsSelectedPad.id;
  // For invasion, pass the target wallet so the preview can include the
  // defender-size factor in the multiplier + duration
  var tgtParam = '';
  if((window._opsType||'invasion')==='invasion'){
    var twEl = document.getElementById('opsTargetWallet');
    var tw = twEl ? (twEl.value||'').trim() : '';
    if(/^0x[a-fA-F0-9]{40}$/.test(tw)) tgtParam = '&targetWallet='+encodeURIComponent(tw.toLowerCase());
  }
  _opsPreviewTimer=_setActiveTimeout(function(){
    _opsPreviewTimer=null;
    var w=walletState&&walletState.address; if(!w) return;
    fetch('/api/missions/preview?type='+encodeURIComponent(window._opsType||'invasion')
      +'&originClaimId='+encodeURIComponent(padId)
      +'&lat='+encodeURIComponent(lat)+'&lng='+encodeURIComponent(lng)+tgtParam, { headers: getAuthHeaders() })
      .then(function(r){return r.json()})
      .then(function(d){
        if(seq!==_opsPreviewSeq) return;
        var el2=document.getElementById('opsLaunchPreview');
        if(!el2) return;
        if(d.error){
          window._opsPreviewData = null;
          el2.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+padId+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
            +'<span class="ops-prev-eta error">⚠ '+escapeHTML(d.error)+'</span>';
          if(typeof requestRedraw==='function') requestRedraw();
          return;
        }
        window._opsPreviewData = d;
        var tierCol={near:'var(--gn)',mid:'var(--gold)',far:'var(--mars)'}[d.tier]||'var(--cyan)';
        var tierLabel=(d.tier||'').toUpperCase();
        var travel=_opsFormatTime(d.durationSec*1000);
        var multStr='×'+(d.multiplier||1).toFixed(2);
        el2.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+padId+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
          +'<span class="ops-prev-eta">'
          +'<span class="ops-prev-tier" style="color:'+tierCol+';border-color:'+tierCol+'">'+tierLabel+'</span>'
          +'<span class="ops-prev-dist">'+d.distanceDeg.toFixed(1)+'°</span>'
          +'<span class="ops-prev-time">⌛ '+travel+'</span>'
          +'<span class="ops-prev-cost">⛽ '+d.costPP.toFixed(2)+' PP</span>'
          +'<span class="ops-prev-cost" style="color:var(--gold);font-weight:800">🏆 '+multStr+'</span>'
          +'</span>';
        if(typeof requestRedraw==='function') requestRedraw();
      })
      .catch(function(){});
  },150);
}
document.addEventListener('input', function(e){
  if(e.target && (e.target.id==='opsTargetLat'||e.target.id==='opsTargetLng'||e.target.id==='opsTargetWallet')) updateOpsLaunchPreview();
});

function loadOpsTab(){
  var w = walletState.address; if(!w) return;
  loadOpsPads();
  _guildReadJson('missions-active', '/api/missions/active', 10000)
    .then(function(d){
      if(!d) return;
      window._opsMissions = d.missions || [];
      renderOpsMissionList();
      // Set OPS dot if any mission is claimable
      var hasClaimableOps = (d.missions||[]).some(function(m){ return m.status==='complete' || m.readyToClaim; });
      if(hasClaimableOps){ setBaseTabDot('ops', true); }
      if(typeof requestRedraw==='function') requestRedraw();
    })
    .catch(function(){ document.getElementById('opsMissionList').innerHTML='Failed to load missions.'; });
  if(!_opsTimer) _opsTimer = _setActiveInterval(renderOpsMissionList, 1000);
}

function renderOpsMissionList(){
  var el = document.getElementById('opsMissionList');
  if(!el) return;
  if(!_opsMissions.length){ el.innerHTML='<div style="color:var(--tx3);padding:12px;text-align:center">'+t('ops_no_missions')+'</div>'; return; }
  var now = Date.now();
  el.innerHTML = _opsMissions.map(function(m){
    var start = new Date(m.startTime).getTime();
    var end = start + m.durationSec*1000;
    var remaining = Math.max(0, end - now);
    var pct = Math.min(100, 100*(1 - remaining/(m.durationSec*1000)));
    var typIcon = m.type==='invasion' ? '⚔' : '🛰';
    var typCol = m.type==='invasion' ? 'var(--mars)' : 'var(--gn)';
    var ready = m.readyToClaim;
    var barCol = ready ? 'var(--gold)' : typCol;
    var label = ready
      ? (m.status==='failed' ? t('ops_failed') : t('ops_ready_claim'))
      : _opsFormatTime(remaining);
    var tgt = m.type==='invasion'
      ? ('VS '+(m.targetWallet||'').slice(0,8)+'...')
      : (t('ops_explore_label')+' '+m.targetLat.toFixed(1)+'°, '+m.targetLng.toFixed(1)+'°');
    var btn;
    if(ready && m.status!=='failed'){
      btn = '<button onclick="playMissionMinigame('+m.id+',\''+m.type+'\')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,#00E676,#00C853);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer;margin-right:4px">🎮 PLAY</button>'+
        '<button onclick="claimOpsMission('+m.id+')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,var(--gold),#FFA040);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+t('ops_claim')+' (1x)</button>';
    } else if(ready){
      btn = '<button onclick="claimOpsMission('+m.id+')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,var(--gold),#FFA040);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+t('ops_claim')+'</button>';
    } else {
      btn = '<button onclick="cancelOpsMission('+m.id+')" style="padding:4px 8px;border-radius:5px;background:rgba(255,255,255,.05);border:1px solid var(--bdr);color:var(--tx3);font-family:var(--fn);font-size:8px;cursor:pointer">'+t('ops_abort')+'</button>';
    }
    return '<div style="padding:8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid var(--bdr);margin-bottom:6px">'+
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
        '<span style="font-size:14px">'+typIcon+'</span>'+
        '<span style="font-size:10px;color:'+typCol+';font-weight:700">'+m.type.toUpperCase()+'</span>'+
        '<span style="font-size:8px;color:var(--tx3);margin-left:auto">'+label+'</span>'+
      '</div>'+
      '<div style="font-size:9px;color:var(--tx2);font-family:var(--fn);margin-bottom:4px">'+tgt+' · '+m.distanceDeg.toFixed(1)+'°</div>'+
      '<div class="ops-mission-bar" style="margin-bottom:6px"><div class="ops-mission-bar-fill'+(ready?' ready':'')+'" style="width:'+pct+'%;background-color:'+barCol+';transition:width .5s"></div></div>'+
      '<div style="display:flex;justify-content:flex-end">'+btn+'</div>'+
    '</div>';
  }).join('');
}
function _opsFormatTime(ms){
  var s = Math.floor(ms/1000);
  var h = Math.floor(s/3600); s -= h*3600;
  var m = Math.floor(s/60); s -= m*60;
  if(h>0) return h+'h '+m+'m';
  if(m>0) return m+'m '+s+'s';
  return s+'s';
}
function launchOpsMission(){
  var w = walletState.address; if(!w){ showAlert(t('ops_connect_first')); return; }
  if(!window._opsSelectedPad){ showAlert(t('ops_pick_pad')); return; }
  var lat = parseFloat(document.getElementById('opsTargetLat').value);
  var lng = parseFloat(document.getElementById('opsTargetLng').value);
  if(isNaN(lat)||isNaN(lng)){ showAlert(t('ops_enter_coords')); return; }
  var body = { wallet:w, type:_opsType, originClaimId:window._opsSelectedPad.id, targetLat:lat, targetLng:lng };
  if(_opsType==='invasion'){
    var tgt = (document.getElementById('opsTargetWallet').value||'').trim();
    if(!tgt){ showAlert(t('ops_target_required')); return; }
    body.targetWallet = tgt;
  }
  fetch('/api/missions/launch',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){ showAlert(srvErr?srvErr(d.error):d.error); return; }
      showAlert(t('ops_mission_launched'),'success');
      try{ if(typeof refreshBalance==='function') refreshBalance(); }catch(_){} // [v7.275] PP 연료 차감 후 잔액 갱신
      // Reset input fields
      document.getElementById('opsTargetLat').value = '';
      document.getElementById('opsTargetLng').value = '';
      document.getElementById('opsTargetWallet').value = '';
      window._opsPreviewData = null;
      window._opsPreviewTarget = null;
      var prevEl = document.getElementById('opsPreviewInfo');
      if(prevEl) prevEl.innerHTML = '';
      if(_opsType==='invasion'){try{trackQuestAction('launch_invasion',1)}catch(e){}}
      if(_opsType==='exploration'){try{trackQuestAction('launch_exploration',1)}catch(e){}}
      loadOpsTab();
    })
    .catch(function(e){ showAlert(t('ops_launch_failed')+' '+e.message); });
}
function claimOpsMission(id){
  fetch('/api/missions/'+id+'/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    var r = d.mission.reward || {};
    var parts = [];
    if(r.pp>0) parts.push(r.pp.toFixed(3)+' PP');
    if(r.gp>0) parts.push(r.gp+' GP');
    if(r.xp>0) parts.push(r.xp+' XP');
    if(r.item) parts.push(r.item.name);
    if(!parts.length) parts.push('No reward');
    showAlert('✓ '+parts.join(' · '),'success');
    if(d.mission.type==='invasion'){try{trackQuestAction('complete_invasion',1)}catch(e){}}
    if(d.mission.type==='exploration'){try{trackQuestAction('complete_exploration',1)}catch(e){}}
    // [v7.192 fix] 동일한 stale UI 문제 — claimOpsMission 도 모든 관련 UI 즉시 갱신.
    try { loadOpsTab(); } catch(_){}
    try { if(typeof loadUserData==='function') loadUserData(); } catch(_){}
    try { if(typeof updateDailyHint==='function') updateDailyHint(); } catch(_){}
    try { if(typeof loadDailyMissions==='function') loadDailyMissions(); } catch(_){}
    try { if(typeof refreshGP==='function') refreshGP(); } catch(_){}
    try { if(typeof _pollBaseTabDots==='function') _pollBaseTabDots(); } catch(_){}
  }).catch(function(e){ showAlert(t('ops_claim_failed')+' '+e.message); });
}
function cancelOpsMission(id){
  gameConfirm({
    title:t('ops_abort_title'),
    icon:'⚠',
    body:t('ops_abort_body'),
    confirmText:t('ops_abort_btn')
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/missions/'+id+'/cancel',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){ showToast(srvErr(d.error),'error'); return; }
      showToast('Mission aborted · '+(d.refund||0).toFixed(2)+' PP refunded','success');
      loadOpsTab();
    }).catch(function(e){ showToast('Cancel failed: '+e.message,'error'); });
  });
}

// ══ DAILY OPS BOARD ═══════════════════════════════════════════

// ─ OPS COMMAND BOARD ─────────────────────────────────────────
var _opsBoardCountdownTimer = null;

function _startOpsBoardCountdown() {
  if (_opsBoardCountdownTimer) _clearActiveInterval(_opsBoardCountdownTimer);
  function _tick() {
    var now = new Date();
    var msUntilReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) - now;
    var s = Math.floor(msUntilReset / 1000);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var str = (LANG==='ko'?'리셋까지 ':LANG==='ja'?'リセットまで ':LANG==='zh'?'重置倒计时 ':'Reset in ') + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    var el = document.getElementById('opsBoardCountdown');
    if (el) el.textContent = str;
  }
  _tick();
  _opsBoardCountdownTimer = _setActiveInterval(_tick, 1000);
}

function _fmtDuration(sec) {
  if (sec <= 0) return (LANG==='ko'?'만료':LANG==='ja'?'期限切れ':LANG==='zh'?'已过期':'Expired');
  var h = Math.floor(sec / 3600); var m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + (LANG==='ko'?'시간 ':LANG==='ja'?'時間 ':LANG==='zh'?'小时 ':' hr ') + m + (LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分':'m');
  return m + (LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分':'m');
}

// GO 버튼 네비게이션 헬퍼 (onclick 직접 호출용 — 이벤트리스너 대신)
// 작전보드 GO 버튼 — 미션 타입별로 실제 동작 화면으로 이동시킨다.
// 탭 이동은 tab 버튼 .click() 으로 처리해 해당 탭의 onclick 로더(loadMarketTab 등)도 함께 발동시킨다.
function _opsClickTab(tabId) {
  var btn = document.getElementById(tabId);
  if (btn) { btn.click(); return true; }
  return false;
}
function _opsOpenBaseTab(tabId, afterOpen) {
  try { openBaseModal(); } catch(_) {}
  setTimeout(function(){
    var clicked = _opsClickTab(tabId);
    if (clicked && typeof afterOpen === 'function') {
      try { afterOpen(); } catch(_) {}
    }
  }, 120);
}
window.opsMissionGo = function(type) {
  try {
    // ─ 영토 채굴/업그레이드/이미지: 실제 동작은 화성 지도(글로브)에서 한다.
    //   작전보드는 BASE 모달 > 내 영토 탭 안에 있으므로, 같은 탭으로 "이동"해도
    //   화면 변화가 없어 GO가 안 먹는 것처럼 보였다. 모달을 닫고 MY LAND 모드로 보낸다. ─
    if (['harvest_pp','harvest_3','harvest_5','territory_art','territory_upgrade','territory_upgrade_3'].includes(type)) {
      try { closeBaseModal(); } catch(_) {}
      setTimeout(function(){
        try { if (typeof toggleMyLand === 'function' && !window._myLandMode) toggleMyLand(); } catch(_) {}
        var msg = (type.indexOf('harvest') === 0)
          ? tl('Tap your territory on Mars to harvest PP','화성 지도에서 내 영토를 눌러 채굴하세요','火星マップで自分の領土をタップして採掘','在火星地图上点击你的领地进行采集')
          : (type === 'territory_art'
              ? tl('Open one of your territories to register its image','내 영토를 열어 이미지를 등록하세요','自分の領土を開いて画像を登録','打开你的领地注册图片')
              : tl('Open one of your territories to upgrade it','내 영토를 열어 업그레이드하세요','自分の領土を開いてアップグレード','打开你的领地进行升级'));
        try { showToast(msg); } catch(_) {}
      }, 280);
    // ─ 영토 클레임: 모달 닫고 지도 클레임 모드 진입 ─
    } else if (type === 'territory_claim') {
      try { closeBaseModal(); } catch(_) {}
      setTimeout(function(){
        try {
          if (typeof activateLandSelect === 'function') activateLandSelect();
          else showToast(tl('Pick an empty spot on Mars to claim','화성의 빈 곳을 골라 클레임하세요','火星の空き地を選んでクレーム','在火星上选择空地进行占领'));
        } catch(_) {}
      }, 280);
    // ─ 전투 계열 → PvP 탭 (.click 으로 로더 포함 발동) ─
    } else if (['battle_participate','battle_win','battle_participate_3','battle_win_3','battle_forfeit'].includes(type)) {
      _opsOpenBaseTab('baseTabPvp');
    } else if (['salvage_wreck','salvage_wreck_3'].includes(type)) {
      _opsOpenBaseTab('baseTabPvp', function(){
        try {
          if (typeof openBattleHub === 'function') openBattleHub();
          if (typeof bhSwitchTab === 'function') setTimeout(function(){ bhSwitchTab('killboard'); }, 120);
        } catch(_) {}
      });
    } else if (['ai_battle','ai_battle_3'].includes(type)) {
      _opsOpenBaseTab('baseTabPvp');
      try { setTimeout(function(){ if (typeof openAiFight === 'function') openAiFight(); }, 450); } catch(_) {}
    // ─ 함선/함대 계열 → 조선소 / 함대지휘 ─
    } else if (['upgrade_ship','upgrade_ship_3','upgrade_ship_5','build_ship','repair_ship','repair_ship_3'].includes(type)) {
      try { openShipyard(); } catch(_) { _opsClickTab('baseTabPvp'); }
    } else if (type === 'fleet_formation') {
      try { openFleetCmd(); } catch(_) {}
    // ─ 경제 계열 → 마켓 탭 ─
    } else if (['craft_resource','craft_resource_3','craft_resource_5'].includes(type)) {
      _opsOpenBaseTab('baseTabItems', function(){
        try { if (typeof loadBaseInventory === 'function') loadBaseInventory(); } catch(_) {}
        try { showToast(tl('Check your resource inventory here','보유 재료는 여기서 확인하세요','所持素材はここで確認できます','在这里查看你的资源库存'), 'info'); } catch(_) {}
      });
    } else if (['market_list','market_buy','market_activity'].includes(type)) {
      _opsOpenBaseTab('baseTabMarket', function(){ try { if (typeof loadMarketTab === 'function') loadMarketTab(); } catch(_) {} });
    } else if (['transport_launch','transport_collect','transport_raid'].includes(type)) {
      _opsOpenBaseTab('baseTabTransport', function(){
        try { if (typeof loadTransportTab === 'function') loadTransportTab(); } catch(_) {}
        try {
          if (typeof switchTransportSub === 'function') {
            setTimeout(function(){
              switchTransportSub(type === 'transport_raid' ? 'raid' : (type === 'transport_collect' ? 'my' : 'launch'));
            }, 150);
          }
        } catch(_) {}
      });
    } else if (type === 'siege_fleet_commit') {
      _opsOpenBaseTab('baseTabGovern', function(){
        try {
          var sec = document.getElementById('siegeSection');
          if (sec && sec.style.display === 'none' && typeof toggleSiegeSection === 'function') toggleSiegeSection();
        } catch(_) {}
        try { showToast(tl('Pick an active sector siege and commit a fleet','진행 중인 섹터 공성을 골라 함대를 배치하세요','進行中のセクター攻城を選んで艦隊を配置','选择进行中的扇区攻城并部署舰队'), 'info'); } catch(_) {}
      });
    // ─ 캠페인 계열 → CAMPAIGN/QUESTS 탭. (이전엔 존재하지 않는 'quests' 카테고리를
    //   switchBaseCat 에 넘겨 모든 탭이 숨겨지며 이동이 깨졌다. 실제 탭 data-cat 은 'mission'.) ─
    } else if (['campaign_progress','campaign_complete'].includes(type)) {
      _opsOpenBaseTab('baseTabQuests');
    // ─ 자동 완료 (로그인 확인 등) ─
    } else if (type === 'daily_login') {
      showToast(LANG==='ko'?'오늘 로그인 확인! 자동 완료됩니다.':LANG==='ja'?'今日のログイン確認！自動完了します。':LANG==='zh'?'今日登录确认！自动完成。':'Daily login confirmed! Auto-completing.');
      // daily login OPS 진행도는 /api/daily/login 성공 시 서버가 처리한다.
      try { loadOpsCommandBoard(); } catch(_) {}
    } else {
      // 알 수 없는 타입 — 최소한 사용자에게 피드백
      try { showToast(tl('No destination for this mission','이 작전은 이동할 화면이 없습니다','この作戦に移動先はありません','该任务无可跳转页面')); } catch(_) {}
    }
  } catch(_) {}
};

async function loadOpsCommandBoard() {
  var wallet = walletState.address;
  _startOpsBoardCountdown();
  var el = document.getElementById('opsBoardContent');
  var weeklyEl = document.getElementById('opsBoardWeekly');
  if (!wallet || !el) return;

  el.innerHTML = '<span style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読み込み中…':LANG==='zh'?'加载中…':'Loading…')+'</span>';

  try {
    var res = await fetch('/api/daily-ops/' + encodeURIComponent(wallet));
    var data = await res.json();
    if (!data.success) throw new Error('failed');

    var missions = data.missions || [];
    var we = data.weekly_event;
    var weeklyDone = data.weekly_done || 0;
    var weeklyTotal = data.weekly_total || 7;
    var weeklyReward = data.weekly_reward_label || '';
    var urgentEvents = data.urgent_events || [];
    var expectedPP = data.expected_pp || 0;

    // (이동 액션은 opsMissionGo() 가 onclick 으로 직접 처리한다. 과거의 missionNav 매핑은
    //  미사용 죽은 코드라 제거됨 — v7.96.)

    var html = '';

    // 🔴 긴급 이벤트 먼저
    urgentEvents.forEach(function(ev, idx) {
      html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,82,82,.12)">'
        + '<span style="font-size:11px;line-height:1.4;flex-shrink:0">🔴</span>'
        + '<div style="flex:1">'
        + '<div style="font-size:10px;color:#ff5252;font-weight:700">' + (LANG==='ko' ? ev.label_ko : ev.label_en) + '</div>'
        + '<div style="font-size:9px;color:var(--tx3)">(' + _fmtDuration(ev.time_remaining_sec) + ' '+(LANG==='ko'?'남음':LANG==='ja'?'残り':LANG==='zh'?'剩余':'left')+')</div>'
        + '</div>'
        + '<button type="button" id="opsUrgentBtn' + idx + '" style="flex-shrink:0;font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(255,82,82,.15);border:1px solid rgba(255,82,82,.4);color:#ff5252;cursor:pointer;font-family:var(--fn);font-weight:700">'+(LANG==='ko'?'지금 참여 →':LANG==='ja'?'今すぐ参加 →':LANG==='zh'?'立即参与 →':'Join Now →')+'</button>'
        + '</div>';
    });

    // ⚪/🟢 미션 행
    var localOpsState = null;
    try { localOpsState = _loadDailyOpsState(); } catch(_) {}
    missions.forEach(function(m, idx) {
      var label = LANG==='ko' ? m.label_ko : m.label_en;
      var dest = LANG==='ko' ? (m.dest_ko || '') : (m.dest_en || '');
      var target = Math.max(1, parseInt(m.target, 10) || 1);
      var current = parseInt(m.current, 10) || 0;
      var localTask = localOpsState && localOpsState.tasks ? localOpsState.tasks[m.type] : null;
      if (localTask) current = Math.min(target, Math.max(current, parseInt(localTask.current, 10) || 0));
      var done = !!(m.completed || m.reward_claimed || current >= target || Number(m.progress_pct) >= 100);
      var dot = done ? '🟢' : '⚪';
      var labelColor = m.reward_claimed ? 'var(--gn)' : (done ? 'var(--gold)' : 'var(--tx)');

      var rewardStr;
      if (m.type === 'harvest_pp' && expectedPP > 0) {
        rewardStr = '→ +' + expectedPP + ' PP '+(LANG==='ko'?'예상':LANG==='ja'?'予想':LANG==='zh'?'预计':'est.');
      } else if (dest) {
        rewardStr = '→ ' + dest;
      } else {
        rewardStr = '+' + m.reward_gp + ' GP';
      }

      var rightBtn;
      if (m.reward_claimed) {
        rightBtn = '<span style="font-size:9px;color:var(--gn)">✓ '+(LANG==='ko'?'수령완료':LANG==='ja'?'受取済':LANG==='zh'?'已领取':'Claimed')+'</span>';
      } else if (done) {
        rightBtn = '<button type="button" onclick="claimDailyOps(' + m.id + ')" style="font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(76,216,154,.15);border:1px solid rgba(76,216,154,.45);color:var(--gn);cursor:pointer;font-family:var(--fn)">+' + m.reward_gp + ' GP '+(LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim')+'</button>';
      } else {
        rightBtn = '<button type="button" onclick="opsMissionGo(\'' + m.type + '\')" style="font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--tx2);cursor:pointer;font-family:var(--fn)">GO →</button>';
      }

      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<span style="font-size:11px;flex-shrink:0">' + dot + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:10px;color:' + labelColor + ';font-weight:600">' + label + '</div>'
        + '<div style="font-size:9px;color:var(--tx3)">' + rewardStr + '</div>'
        + '</div>'
        + '<div style="flex-shrink:0">' + rightBtn + '</div>'
        + '</div>';
    });

    if (!html) {
      html = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+(LANG==='ko'?'미션 없음':LANG==='ja'?'ミッションなし':LANG==='zh'?'没有任务':'No missions')+'</div>';
    }

    el.innerHTML = html;

    // 긴급 이벤트 버튼만 이벤트 등록 (GO/CLAIM은 onclick 직접 사용)
    urgentEvents.forEach(function(ev, idx) {
      var btn = document.getElementById('opsUrgentBtn' + idx);
      if (btn) btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        try { eval(ev.action); } catch(_) {}
      });
    });

    // 주간 이벤트 + 주간 진척도
    var weeklyHtml = '';
    if (we) {
      weeklyHtml += '<div style="font-size:9px;color:var(--gold);margin-bottom:6px">'
        + (we.icon || '') + ' ' + (LANG==='ko'?'오늘의 이벤트':LANG==='ja'?'今日のイベント':LANG==='zh'?'今日活动':'Today\'s Event') + ': ' + (LANG==='ko' ? we.label_ko : we.label_en) + '</div>';
    }
    // 주간 진척도 — 요일 라벨 포함 7칸 표시
    var dayLabels = LANG==='ja'?['日','月','火','水','木','金','土']:LANG==='zh'?['日','一','二','三','四','五','六']:LANG==='ko'?['일','월','화','수','목','금','토']:['S','M','T','W','T','F','S'];
    var todayDow = new Date().getUTCDay();
    // [v7.211] 주간 진척도 시인성 — 빈 칸 rgba(.15)는 모바일 다크 배경에서 검정으로 보임.
    //   bg 살짝 밝게 + border 더 진하게 + height 8→10px + label 추가.
    var blocks = '<div style="display:flex;gap:3px;width:100%">';
    for (var i = 0; i < weeklyTotal; i++) {
      var dayIdx = (1 + i) % 7;
      var isToday = dayIdx === todayDow;
      var isDone = i < weeklyDone;
      var bg = isDone ? 'var(--cyan)' : 'rgba(255,255,255,.06)';
      var border = isToday ? '1px solid rgba(255,215,0,.85)' : '1px solid rgba(255,255,255,.25)';
      var labelColor = isDone ? '#fff' : (isToday ? '#ffd700' : 'rgba(255,255,255,.45)');
      blocks += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<div style="font-size:8px;color:'+labelColor+';font-family:var(--fn);font-weight:'+(isToday?'800':'600')+'">'+dayLabels[dayIdx]+'</div>'
        + '<div style="width:100%;height:10px;border-radius:3px;background:' + bg + ';border:' + border + (isDone?';box-shadow:0 0 6px rgba(91,184,232,.5)':'')+'"></div>'
        + '</div>';
    }
    blocks += '</div>';
    weeklyHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      + '<span style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'이번 주 완료일':LANG==='ja'?'今週の完了日':LANG==='zh'?'本周完成天数':'Days completed')+'</span>'
      + '<span style="font-size:9px;color:var(--cyan);font-weight:700">' + weeklyDone + ' / ' + weeklyTotal + (LANG==='ko'?'일':LANG==='ja'?'日':LANG==='zh'?'天':' day(s)')+'</span>'
      + '</div>'
      + blocks
      + (weeklyReward ? '<div style="font-size:9px;color:var(--gold);margin-top:5px">🎁 '+(LANG==='ko'?'이번 주 보상: ':LANG==='ja'?'今週の報酬: ':LANG==='zh'?'本周奖励: ':'Weekly reward: ') + weeklyReward + '</div>' : '');

    if (weeklyEl) weeklyEl.innerHTML = weeklyHtml;

    // Daily OPS board is single-source in BASE > 내 영토.
    // Put claimable status on the territory tab, not the separate OPS mission console.
    var hasClaimable = missions.some(function(m){
      var target = Math.max(1, parseInt(m.target, 10) || 1);
      var current = parseInt(m.current, 10) || 0;
      return (m.completed || current >= target || Number(m.progress_pct) >= 100) && !m.reward_claimed;
    });
    if (hasClaimable) { try { setBaseTabDot('territory', true); } catch(_){} }

  } catch(err) {
    if (el) el.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'OPS Board 로딩 실패':LANG==='ja'?'OPS Boardの読み込み失敗':LANG==='zh'?'OPS Board加载失败':'OPS Board failed to load')+'</div>';
  }
}

async function loadDailyOpsBoard() {
  return loadOpsCommandBoard();
}

async function claimDailyOps(missionId) {
  var wallet = walletState.address;
  if (!wallet) return;
  try {
    var body = { wallet: wallet };
    if (missionId) body.mission_id = missionId;
    var res = await fetch('/api/daily-ops/claim', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!data.success) { showToast(srvErr(data.error || 'Claim failed'), 'error'); return; }
    showToast('+' + data.total_gp + ' GP', 'success');
    // [v7.192 fix] dailyOps claim 직후 모든 관련 UI 즉시 갱신 — 이전엔 이 함수가
    //   loadDailyOpsBoard + loadUserData 만 호출 → 메인 화면 "오늘의 추천" 카드,
    //   BASE 임무 dot, CAMPAIGN/QUESTS 탭의 미션 리스트가 페이지 리로드 전까지 stale.
    try { loadDailyOpsBoard(); } catch(_){}
    try { if (typeof loadUserData === 'function') loadUserData(); } catch(_){}
    try { if (typeof updateDailyHint === 'function') updateDailyHint(); } catch(_){}        // 오늘의 추천 카드 갱신
    try { if (typeof loadDailyMissions === 'function') loadDailyMissions(); } catch(_){}    // QUESTS 탭 미션 리스트
    try { if (typeof refreshGP === 'function') refreshGP(); } catch(_){}                    // GP HUD
    try { if (typeof _pollBaseTabDots === 'function') _pollBaseTabDots(); } catch(_){}      // BASE 카테고리 dot 재평가
  } catch(e) { showToast(srvErr('NETWORK_ERROR'), 'error'); }
}

async function claimAllDailyOps() {
  await claimDailyOps(null);
}

function renderGuildInvites(invites){
  var sec=document.getElementById('guildInvitesSection');
  var list=document.getElementById('guildInvitesList');
  if(!invites||!invites.length){sec.style.display='none';return;}
  sec.style.display='';
  list.innerHTML=invites.map(function(inv){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,209,102,.04);border:1px solid rgba(255,209,102,.15);border-radius:6px;margin-bottom:4px">'+
      '<span style="font-size:16px">'+(inv.emblem_emoji||'🔴')+'</span>'+
      '<div style="flex:1"><div style="font-size:11px;color:var(--tx);font-weight:700">'+(inv.guild_name||'Guild')+'</div>'+
      '<div style="font-size:8px;color:var(--tx3)">'+t('guild_invited_by')+' '+(inv.invited_by_nickname||inv.invited_by.slice(0,8)+'...')+'</div></div>'+
      '<button onclick="guildAcceptInvite('+inv.id+')" style="padding:4px 10px;border-radius:4px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.3);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn)">'+t('guild_accept_btn')+'</button>'+
      '<button onclick="guildDeclineInvite('+inv.id+')" style="padding:4px 8px;border-radius:4px;background:rgba(255,255,255,.04);border:1px solid var(--bdr);color:var(--tx3);font-size:9px;cursor:pointer;font-family:var(--fn)">✕</button>'+
    '</div>';
  }).join('');
}

function renderGuildLeaderboard(guilds){
  var el=document.getElementById('guildLeaderboard');
  if(!guilds||!guilds.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px;font-size:10px">'+t('guild_lb_empty')+'</div>';return;}
  el.innerHTML=guilds.map(function(g,i){
    var myGuild=_myGuildData&&_myGuildData.id===g.id;
    var emblemHtml=g.emblemImage
      ? '<img src="'+g.emblemImage+'" style="width:20px;height:20px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:3px;border:1px solid rgba(255,255,255,.1);flex-shrink:0">'
      : '<span style="font-size:14px">'+(g.emblem||'🔴')+'</span>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;'+(myGuild?'background:rgba(255,120,60,.06);border:1px solid rgba(255,120,60,.15)':'border-bottom:1px solid var(--bdr)')+'">'+
      '<span style="font-size:11px;color:'+(i<3?'var(--gold)':'var(--tx3)')+';font-weight:700;min-width:20px">#'+(i+1)+'</span>'+
      emblemHtml+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:11px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+g.name+' <span style="color:var(--mars);font-size:9px">['+g.tag+']</span></div>'+
        '<div style="font-size:8px;color:var(--tx3)">'+g.memberCount+' '+t('guild_lb_members_suffix')+' · '+t('guild_lb_leader_prefix')+' '+(g.leaderNickname||t('guild_lb_unknown'))+'</div>'+
      '</div>'+
      '<div style="text-align:right"><div style="font-size:12px;color:var(--gold);font-weight:700">'+(g.totalPixels||0).toLocaleString()+'</div><div style="font-size:7px;color:var(--tx3)">'+t('guild_lb_pixels')+'</div></div>'+
    '</div>';
  }).join('');
}

// ── Guild Chat (polling) ──
var _lastGuildMsgId=0;
var _guildChatPoll=null;
function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }
function appendGuildChatMsgs(msgs){
  var box=document.getElementById('guildChatBox');
  if(!box||!msgs||!msgs.length) return;
  // Remove placeholder
  var ph=box.querySelector('[data-placeholder]');
  if(ph) ph.remove();
  // Also strip the default empty-state div if still present
  if(box.children.length===1 && box.children[0].textContent && box.children[0].textContent.indexOf('No messages')>=0) box.innerHTML='';
  var w=walletState.address||'';
  msgs.forEach(function(m){
    if(m.id<=_lastGuildMsgId) return;
    _lastGuildMsgId=m.id;
    var mine=(m.wallet||'').toLowerCase()===w.toLowerCase();
    var ts=new Date(m.at||m.createdAt||m.created_at||Date.now());
    var hh=String(ts.getHours()).padStart(2,'0'), mm=String(ts.getMinutes()).padStart(2,'0');
    var name=escapeHTML(m.nickname||(m.wallet||'').slice(0,8)+'...');
    var div=document.createElement('div');
    div.style.cssText='display:flex;gap:6px;align-items:flex-start';
    div.innerHTML='<span style="color:'+(mine?'var(--mars)':'var(--cyan)')+';font-weight:700;flex-shrink:0">'+name+'</span>'+
      '<span style="flex:1;color:var(--tx);word-break:break-word">'+escapeHTML(m.message)+'</span>'+
      '<span style="color:var(--tx3);font-size:8px;flex-shrink:0">'+hh+':'+mm+'</span>';
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}
function refreshGuildChat(){
  var w=walletState.address;
  if(!w||!_myGuildData) return;
  if(!_isGuildChatVisible()) { stopGuildChatPoll(); return; }
  var url='/api/guild/chat/'+_myGuildData.id+(_lastGuildMsgId?('?sinceId='+_lastGuildMsgId):'');
  _guildReadJson('chat:' + _myGuildData.id + ':' + (_lastGuildMsgId || 0), url, 12000).then(function(data){
    if(!data) return;
    if(data.error) return;
    appendGuildChatMsgs(data.messages||[]);
  }).catch(function(){});
}
function sendGuildChat(){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_login_first'),'error');return;}
  if(!_myGuildData){showToast(t('guild_toast_no_guild'),'error');return;}
  var input=document.getElementById('guildChatInput');
  var msg=(input.value||'').trim();
  if(!msg) return;
  input.disabled=true;
  fetch('/api/guild/chat',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:_myGuildData.id,message:msg})})
    .then(function(r){return r.json()}).then(function(data){
      input.disabled=false;
      if(data.error){showToast(data.error,'error');return;}
      try{trackQuestAction('guild_chat',1)}catch(e){}
      input.value='';
      input.focus();
      refreshGuildChat();
    }).catch(function(){input.disabled=false;showToast(t('guild_toast_send_failed'),'error')});
}
function startGuildChatPoll(){
  if(_guildChatPoll) return;
  if(!_isGuildChatVisible()) return;
  _lastGuildMsgId=0;
  // Reset chat box
  var box=document.getElementById('guildChatBox');
  if(box) box.innerHTML='<div data-placeholder style="color:var(--tx3);text-align:center;font-size:9px;margin:auto">'+t('guild_chat_loading')+'</div>';
  refreshGuildChat();
  _guildChatPoll=_setActiveInterval(refreshGuildChat, 15000);
}
function stopGuildChatPoll(){
  if(_guildChatPoll){ _clearActiveInterval(_guildChatPoll); _guildChatPoll=null; }
}

function createGuild(){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_login_first'),'error');return;}
  var name=document.getElementById('guildNameInput').value.trim();
  var tag=document.getElementById('guildTagInput').value.trim();
  var emoji=document.getElementById('guildEmojiSelect').value;
  var desc=document.getElementById('guildDescInput').value.trim();
  if(!name||!tag){showToast(t('guild_toast_need_name_tag'),'error');return;}
  fetch('/api/guild/create',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,name:name,tag:tag,emoji:emoji,description:desc})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_created').replace('{tag}',data.tag),'success');
    loadGuildTab();
    // Refresh GP display
    try{ refreshEmailBalances(); }catch(_re){}
  }).catch(function(){showToast(t('guild_toast_create_failed'),'error')});
}

function guildInviteMember(targetOverride){
  var w=walletState.address;
  if(!w||!_myGuildData){showToast(t('guild_toast_no_guild'),'error');return;}
  // Preserve original case — server resolves nickname→wallet case-insensitively.
  var target=targetOverride||document.getElementById('guildInviteInput').value.trim();
  if(!target){showToast(t('guild_toast_enter_target'),'error');return;}
  fetch('/api/guild/invite',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:target,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_invite_sent'),'success');
    var inp=document.getElementById('guildInviteInput'); if(inp) inp.value='';
    var box=document.getElementById('guildInviteSearchResults'); if(box) box.innerHTML='';
  }).catch(function(){showToast(t('guild_toast_invite_failed'),'error')});
}

// ── Live search for invite candidates (debounced) ──
var _guildInviteSearchTimer=null;
function onGuildInviteSearchInput(){
  if(_guildInviteSearchTimer) _clearActiveTimeout(_guildInviteSearchTimer);
  _guildInviteSearchTimer=_setActiveTimeout(function(){
    _guildInviteSearchTimer=null;
    runGuildInviteSearch();
  },200);
}
function runGuildInviteSearch(){
  var inp=document.getElementById('guildInviteInput');
  var box=document.getElementById('guildInviteSearchResults');
  if(!inp||!box||!_myGuildData) return;
  var q=(inp.value||'').trim();
  if(!q){ box.innerHTML=''; return; }
  var w=walletState&&walletState.address; if(!w) return;
  fetch('/api/guild/'+_myGuildData.id+'/search-users?q='+encodeURIComponent(q), { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(d){
      var users=(d&&d.users)||[];
      if(!users.length){ box.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px 6px">'+t('guild_invite_no_matches')+'</div>'; return; }
      box.innerHTML=users.map(function(u){
        var label=u.nickname?escapeHTML(u.nickname):shortAddr(u.wallet);
        var sub=u.nickname?('<span style="font-size:8px;color:var(--tx3);margin-left:6px">'+shortAddr(u.wallet)+'</span>'):'';
        var pix='<span style="font-size:8px;color:var(--tx3);margin-left:6px">'+(u.pixelCount||0)+t('guild_pixels_short')+'</span>';
        var btn=u.hasPendingInvite
          ? '<span style="font-size:8px;color:var(--tx3);padding:3px 8px">'+t('guild_invite_pending')+'</span>'
          : '<button onclick="guildInviteMember(\''+u.wallet+'\')" style="padding:3px 8px;border-radius:3px;background:rgba(91,184,232,.14);border:1px solid rgba(91,184,232,.35);color:var(--cyan);font-size:8px;cursor:pointer;font-family:var(--fn)">'+t('guild_invite_btn')+'</button>';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:var(--surface1);border:1px solid var(--bdr);border-radius:4px"><div style="font-size:10px;color:var(--tx)">'+label+sub+pix+'</div>'+btn+'</div>';
      }).join('');
    })
    .catch(function(){ box.innerHTML='<div style="font-size:9px;color:var(--rd);padding:4px 6px">'+t('guild_invite_search_failed')+'</div>'; });
}

function guildAcceptInvite(inviteId){
  var w=walletState.address;
  fetch('/api/guild/invite/accept',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_joined'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_accept_failed'),'error')});
}

function guildDeclineInvite(inviteId){
  var w=walletState.address;
  fetch('/api/guild/invite/decline',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_declined'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// ── Search guilds by id/tag/name (join screen) ──
function searchGuildsQuery(){
  var inp=document.getElementById('guildSearchInput');
  var out=document.getElementById('guildSearchResults');
  if(!inp||!out) return;
  var q=(inp.value||'').trim();
  if(!q){out.innerHTML='';return;}
  out.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px">'+t('guild_search_searching')+'</div>';
  fetch('/api/guild/search?q='+encodeURIComponent(q)+'&limit=15')
    .then(function(r){return r.json()})
    .then(function(data){
      var gs=(data&&data.guilds)||[];
      if(!gs.length){out.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:6px 4px">'+t('guild_search_none').replace('{q}',escapeHTML(q))+'</div>';return;}
      out.innerHTML=gs.map(function(g){
        var emblem=g.emblemImage
          ? '<img src="'+g.emblemImage+'" style="width:22px;height:22px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:3px;border:1px solid rgba(255,255,255,.1);flex-shrink:0">'
          : '<span style="font-size:16px">'+(g.emblem||'🔴')+'</span>';
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid var(--bdr)">'+
          emblem+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:11px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHTML(g.name)+' <span style="color:var(--mars);font-size:9px">['+escapeHTML(g.tag)+']</span><span style="color:var(--tx3);font-size:8px;margin-left:4px">#'+g.id+'</span></div>'+
            '<div style="font-size:8px;color:var(--tx3)">'+t('guild_level_prefix')+(g.level||1)+' · '+g.memberCount+' '+t('guild_lb_members_suffix')+' · '+(g.totalPixels||0).toLocaleString()+' '+t('guild_pixels_short')+' · '+escapeHTML(g.leaderNickname||'—')+'</div>'+
          '</div>'+
          '<button onclick="requestJoinGuild('+g.id+',\''+escapeHTML(g.name).replace(/\'/g,'&#39;')+'\')" style="padding:6px 10px;border-radius:5px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.35);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn);font-weight:700;flex-shrink:0">'+t('guild_search_join_btn')+'</button>'+
        '</div>';
      }).join('');
    })
    .catch(function(){out.innerHTML='<div style="font-size:9px;color:var(--red);padding:4px">'+t('guild_search_failed')+'</div>'});
}

// ── Leader/officer: incoming join requests ──
function loadGuildJoinRequests(guildId){
  var w=walletState.address;
  if(!w||!guildId) return;
  fetch('/api/guild/'+guildId+'/requests', { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(data){
      var list=(data&&data.requests)||[];
      var el=document.getElementById('guildRequestsList');
      var cnt=document.getElementById('guildRequestsCount');
      var sec=document.getElementById('guildRequestsSection');
      if(cnt) cnt.textContent=list.length?('('+list.length+')'):'';
      if(!list.length){
        if(el) el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px 0">'+t('guild_no_requests')+'</div>';
        return;
      }
      if(el){
        el.innerHTML=list.map(function(r){
          var name=escapeHTML(r.nickname||r.wallet);
          return '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(76,216,154,.04);border:1px solid rgba(76,216,154,.18);border-radius:6px">'+
            '<div style="flex:1;min-width:0">'+
              '<div style="font-size:10px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>'+
              '<div style="font-size:8px;color:var(--tx3)">'+(r.pixel_count||0).toLocaleString()+' '+t('guild_pixels_owned')+'</div>'+
            '</div>'+
            '<button onclick="approveGuildRequest('+r.id+')" style="font-size:8px;padding:4px 8px;border-radius:4px;background:rgba(76,216,154,.15);border:1px solid rgba(76,216,154,.4);color:var(--gn);cursor:pointer;font-family:var(--fn);font-weight:700">'+t('guild_accept_btn')+'</button>'+
            '<button onclick="rejectGuildRequest('+r.id+')" style="font-size:8px;padding:4px 8px;border-radius:4px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);color:var(--red);cursor:pointer;font-family:var(--fn)">✕</button>'+
          '</div>';
        }).join('');
      }
    })
    .catch(function(){});
}
function approveGuildRequest(inviteId){
  var w=walletState.address;
  fetch('/api/guild/request/approve',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      showToast(t('guild_toast_player_added'),'success');
      loadGuildTab();
    }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}
function rejectGuildRequest(inviteId){
  var w=walletState.address;
  fetch('/api/guild/request/reject',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      if(_myGuildData&&_myGuildData.id) loadGuildJoinRequests(_myGuildData.id);
    }).catch(function(){});
}

// Send a self-invite so a leader/officer can approve the join.  Uses the
// existing guild_invites table; the server marks invited_by = requester so
// leaders see the row as an incoming request instead of a normal invite.
async function requestJoinGuild(guildId, guildName){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_sign_in_first'),'error');return;}
  var ok=await gameConfirm({icon:'🏰',title:LANG==='ko'?'길드 가입 신청':LANG==='ja'?'ギルド加入申請':LANG==='zh'?'申请加入公会':'Guild Join Request',body:'<b>'+escapeHTML(guildName)+'</b>'+(LANG==='ko'?'에 가입 신청을 보냅니다.':LANG==='ja'?'に加入申請を送ります。':LANG==='zh'?'发送加入申请。':' — Send a join request?'),confirmText:LANG==='ko'?'신청':LANG==='ja'?'申請':LANG==='zh'?'申请':'Request'});
  if(!ok) return;
  fetch('/api/guild/join-request',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:guildId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      showToast(t('guild_toast_join_request_sent').replace('{name}',guildName),'success');
    })
    .catch(function(){showToast(t('guild_toast_join_request_failed'),'error')});
}

async function guildLeave(){
  var ok=await gameConfirm({icon:'🏰',title:LANG==='ko'?'길드 탈퇴':LANG==='ja'?'ギルド脱退':LANG==='zh'?'退出公会':'Leave Guild',body:LANG==='ko'?'길드에서 탈퇴합니다. 쿨다운 기간 동안 재가입이 제한됩니다.':LANG==='ja'?'ギルドを脱退します。クールダウン期間中は再加入が制限されます。':LANG==='zh'?'退出公会。冷却期间内限制重新加入。':'Leave this guild. Rejoining will be restricted during the cooldown.',confirmText:LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/leave',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_left'),'info');
    _myGuildData=null;
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// [v7.357] 길드 변절(배신) — 금고 탈취 + 배신자 낙인 + 자동 현상금 + 쿨다운
async function guildDefect(){
  var body=LANG==='ko'?'길드 금고의 일부를 들고 변절합니다.<br><br>• 금고 일부를 탈취해 내 GP로<br>• <b style="color:#E84855">배신자 낙인</b>이 영구히 찍힘<br>• 남은 금고로 당신에게 <b style="color:#FFD166">현상금</b>이 걸림 (다른 플레이어가 사냥)<br>• 일정 시간 길드 재가입 불가<br><br>돌이킬 수 없습니다.'
    :LANG==='ja'?'ギルド金庫の一部を持って裏切ります。<br><br>• 金庫の一部を奪取して自分のGPに<br>• <b style="color:#E84855">裏切り者の烙印</b>が永久に付く<br>• 残った金庫からあなたに<b style="color:#FFD166">賞金</b>がかかる(他プレイヤーが狩る)<br>• 一定時間ギルド再加入不可<br><br>取り消せません。'
    :LANG==='zh'?'带走部分公会金库后叛变。<br><br>• 夺取部分金库为个人GP<br>• 永久打上<b style="color:#E84855">叛徒烙印</b><br>• 用剩余金库对你发布<b style="color:#FFD166">悬赏</b>(其他玩家追杀)<br>• 一段时间内无法重新加入公会<br><br>不可撤销。'
    :'Defect, taking a cut of the guild treasury.<br><br>• Steal part of the treasury as your GP<br>• Permanent <b style="color:#E84855">betrayer mark</b><br>• A <b style="color:#FFD166">bounty</b> is placed on you from the remaining treasury (others will hunt you)<br>• Cannot rejoin a guild during a cooldown<br><br>This cannot be undone.';
  var ok=await gameConfirm({
    icon:'⚔',
    title:LANG==='ko'?'길드 변절 (배신)':LANG==='ja'?'ギルド裏切り':LANG==='zh'?'公会叛变':'Defect (Betray Guild)',
    body:body,
    confirmText:LANG==='ko'?'변절한다':LANG==='ja'?'裏切る':LANG==='zh'?'叛变':'DEFECT'
  });
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/defect',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){
      var msg=data.error==='DEFECTION_COOLDOWN'?(LANG==='ko'?('재가입 쿨다운 중 ('+(data.cooldownHours||'')+'h)'):LANG==='ja'?'再加入クールダウン中':LANG==='zh'?'重新加入冷却中':'Rejoin cooldown active')
        :data.error==='LEADER_CANNOT_DEFECT'?(LANG==='ko'?'리더는 변절할 수 없습니다 (해산/위임 필요)':LANG==='ja'?'リーダーは裏切れません':LANG==='zh'?'会长无法叛变':'Leader cannot defect')
        :data.error==='NOT_IN_GUILD'?(LANG==='ko'?'길드에 속해있지 않습니다':'Not in a guild')
        :data.error;
      showToast(msg,'error');return;
    }
    var done=LANG==='ko'?('변절 완료 — '+Math.round(data.stolen||0).toLocaleString()+' GP 탈취, 당신에게 '+Math.round(data.bounty_gp||0).toLocaleString()+' GP 현상금')
      :LANG==='ja'?('裏切り完了 — '+Math.round(data.stolen||0).toLocaleString()+' GP奪取、賞金'+Math.round(data.bounty_gp||0).toLocaleString()+' GP')
      :LANG==='zh'?('叛变完成 — 夺取 '+Math.round(data.stolen||0).toLocaleString()+' GP，被悬赏 '+Math.round(data.bounty_gp||0).toLocaleString()+' GP')
      :('Defected — stole '+Math.round(data.stolen||0).toLocaleString()+' GP, '+Math.round(data.bounty_gp||0).toLocaleString()+' GP bounty on you');
    showToast(done,'info');
    _myGuildData=null;
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// [v7.360] 킬보드 & PvP 정찰 UI (배신 시스템) — 4개국어 로컬라이징
function _kbL(en,ko,ja,zh){return LANG==='ko'?ko:LANG==='ja'?ja:LANG==='zh'?zh:en;}
var _kbTab='board';
function kbSwitchTab(tab){
  _kbTab=tab;
  var b=document.getElementById('kbTab_board'), s=document.getElementById('kbTab_scout');
  if(b&&s){
    b.style.borderBottomColor=tab==='board'?'var(--red)':'transparent'; b.style.color=tab==='board'?'#ff8a80':'var(--tx3)'; b.style.background=tab==='board'?'rgba(232,72,85,.08)':'transparent';
    s.style.borderBottomColor=tab==='scout'?'#5cbbff':'transparent'; s.style.color=tab==='scout'?'#5cbbff':'var(--tx3)'; s.style.background=tab==='scout'?'rgba(92,187,255,.08)':'transparent';
  }
  if(tab==='board') loadKillboard(); else renderScoutPanel();
}
function kbRefresh(){ if(_kbTab==='board') loadKillboard(); else { renderScoutPanel(); } }
function _kbShort(w){ return w?(w.slice(0,6)+'…'+w.slice(-4)):'?'; }
function _kbName(nick,w){ return escapeHtmlSafe(String(nick||_kbShort(w))); } // (v7.396) 출력 이스케이프(방어선)

async function loadKillboard(){
  var el=document.getElementById('kbContent'); if(!el) return;
  el.innerHTML='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">'+_kbL('Loading…','로딩 중…','読み込み中…','加载中…')+'</div>';
  var my=(walletState.address||'').toLowerCase();
  try{
    var results = await Promise.all([
      _guildReadJson('killboard-global', '/api/killboard?limit=15', 30000, false),
      my?_guildReadJson('killboard-mine:' + my, '/api/killboard/'+my, 30000, false):Promise.resolve(null)
    ]);
    if(!results[0]&&!results[1]) return;
    var board=results[0], mine=results[1];
    var html='';
    var _kbGp=function(n){ n=parseInt(n)||0; return n>=1000?((n/1000).toFixed(n>=10000?0:1)+'K'):String(n); };
    if(mine){
      html+='<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<div style="flex:1;text-align:center;padding:6px;border-radius:6px;background:rgba(76,216,154,.08);border:1px solid rgba(76,216,154,.2)"><div style="font-size:14px;font-weight:800;color:#4cd89a">'+(mine.kills||0)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('KILLS','격침','撃沈','击沉')+'</div></div>'+
        '<div style="flex:1;text-align:center;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2)"><div style="font-size:14px;font-weight:800;color:#ff8a80">'+(mine.losses||0)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('LOSSES','피격','被撃','被击')+'</div></div>'+
        '<div style="flex:1.5;text-align:center;padding:6px;border-radius:6px;background:rgba(255,209,102,.09);border:1px solid rgba(255,209,102,.28)"><div style="font-size:14px;font-weight:800;color:#ffd166">'+_kbGp(mine.destroyedValue)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('GP DESTROYED','격파 가치','撃破価値','击破价值')+'</div></div>'+
      '</div>'+
      ((mine.bestKillValue>0)?'<div style="text-align:center;font-size:8px;color:#ffd166;margin-bottom:8px">🏆 '+_kbL('Best kill','최고 격파','最高撃破','最佳击破')+': '+_kbGp(mine.bestKillValue)+' GP</div>':'');
    }
    var kills=(board&&board.kills)||[];
    if(!kills.length){
      html+='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:10px">'+_kbL('No recent kills.','최근 격침 없음.','撃沈なし。','暂无击沉。')+'</div>';
    } else {
      html+=kills.map(function(k){
        var betr=k.victim_is_betrayer?' <span style="color:#FFD166;font-size:8px">⚑'+_kbL('TRAITOR','배신자','裏切り','叛徒')+'</span>':'';
        var val=parseInt(k.ship_value_gp)||0;
        var big=val>=5000; // 고가치 격파 강조
        var modsBadge=(k.mods>0)?'<span style="color:#7ee787;font-size:7px;font-weight:800"> +'+k.mods+'M</span>':'';
        var valHtml=val>0?'<span style="color:'+(big?'#ffd166':'var(--tx3)')+';font-size:8px;font-weight:'+(big?'800':'400')+'">'+(big?'💥 ':'')+_kbGp(val)+' GP'+modsBadge+'</span>':'';
        return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:9px'+(big?';background:rgba(255,209,102,.04)':'')+'">'+
          '<span style="color:#4cd89a;font-weight:700">'+_kbName(k.killer_nick,k.killer_wallet)+'</span>'+
          '<span style="color:var(--tx3)">⚔</span>'+
          '<span style="color:#ff8a80">'+_kbName(k.victim_nick,k.victim_wallet)+'</span>'+betr+
          '<span style="color:var(--tx3);font-size:7px">'+escapeHtmlSafe(String(k.ship_name||k.ship_type||''))+'</span>'+
          '<span style="margin-left:auto">'+valHtml+'</span>'+
        '</div>';
      }).join('');
    }
    el.innerHTML=html;
  }catch(e){ el.innerHTML='<div style="color:var(--red);font-size:10px;text-align:center;padding:10px">'+_kbL('Failed to load.','불러오기 실패.','読込失敗。','加载失败。')+'</div>'; }
}

function renderScoutPanel(){
  var el=document.getElementById('kbContent'); if(!el) return;
  el.innerHTML=
    '<div style="font-size:9px;color:var(--tx3);line-height:1.6;margin-bottom:8px">'+_kbL(
      'Scout an enemy to reveal their hidden fleet composition before you attack. Costs GP. The target may detect you.',
      '공격 전 적 함대의 숨겨진 구성을 정찰로 노출합니다. GP가 들고, 표적이 탐지할 수 있습니다.',
      '攻撃前に敵艦隊の隠れた構成を偵察で暴きます。GPが必要で、標的に探知される場合があります。',
      '攻击前侦察敌方隐藏的舰队构成。消耗GP，可能被目标察觉。')+'</div>'+
    '<div style="display:flex;gap:6px;margin-bottom:8px">'+
      '<input id="kbScoutTarget" type="text" placeholder="'+_kbL('Target wallet','대상 지갑','対象ウォレット','目标钱包')+'" style="flex:1;font-size:10px;padding:7px 9px;border-radius:6px;background:rgba(0,0,0,.25);border:1px solid rgba(92,187,255,.25);color:var(--tx);font-family:var(--fn)">'+
      '<button onclick="kbScout()" style="font-size:10px;padding:7px 12px;border-radius:6px;background:rgba(92,187,255,.15);border:1px solid rgba(92,187,255,.45);color:#5cbbff;font-weight:700;cursor:pointer;font-family:var(--fn)">🛰 '+_kbL('SCOUT','정찰','偵察','侦察')+'</button>'+
    '</div>'+
    '<div id="kbScoutResult"></div>'+
    '<div id="kbScoutReports" style="margin-top:8px"></div>';
  loadScoutReports();
}

function _kbIntelCard(intel,meta){
  var c=intel.composition||{};
  var chip=function(label,val,color){ return val>0?('<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);font-size:8px;color:'+(color||'var(--tx2)')+'">'+label+' '+val+'</span>'):''; };
  return '<div style="border-radius:7px;background:rgba(92,187,255,.05);border:1px solid rgba(92,187,255,.22);padding:9px 11px;margin-bottom:6px">'+
    (meta?('<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">'+meta+'</div>'):'')+
    '<div style="font-size:10px;font-weight:700;color:#5cbbff;margin-bottom:5px">'+_kbL('Fleet Intel','함대 정보','艦隊情報','舰队情报')+' — '+(intel.ships_alive||0)+' '+_kbL('ships','척','隻','艘')+' / '+(intel.fleet_count||0)+' '+_kbL('fleets','함대','艦隊','舰队')+'</div>'+
    '<div>'+
      chip(_kbL('Frig','프리','フリ','护'),c.frigate)+chip(_kbL('Dest','구축','駆','驱'),c.destroyer)+chip(_kbL('Cru','순양','巡','巡'),c.cruiser)+
      chip('BS',c.battleship,'#ffd166')+chip('Titan',c.titan,'#ff8a80')+chip(_kbL('Unit','유닛','ユニ','单位'),c.assembled,'#bb86fc')+
    '</div>'+
    '<div style="display:flex;gap:10px;margin-top:5px;font-size:9px">'+
      '<span style="color:#ff8a80">⚔ '+(intel.total_atk||0).toLocaleString()+'</span>'+
      '<span style="color:#5cbbff">🛡 '+(intel.total_def||0).toLocaleString()+'</span>'+
      '<span style="color:#4cd89a">❤ '+Math.round((intel.total_current_hp||0)/1000)+'k/'+Math.round((intel.total_max_hp||0)/1000)+'k</span>'+
    '</div>'+
  '</div>';
}

async function kbScout(){
  var my=walletState.address; if(!my){ showToast(_kbL('Connect wallet','지갑 연결 필요','ウォレット接続','请连接钱包'),'error'); return; }
  var tgtEl=document.getElementById('kbScoutTarget'); var target=(tgtEl&&tgtEl.value||'').trim();
  if(!target){ showToast(_kbL('Enter a target','대상을 입력하세요','対象を入力','请输入目标'),'error'); return; }
  var resEl=document.getElementById('kbScoutResult'); if(resEl) resEl.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:6px">'+_kbL('Scouting…','정찰 중…','偵察中…','侦察中…')+'</div>';
  try{
    var r=await fetch('/api/spy/scout',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({target_wallet:target})}).then(function(x){return x.json()});
    if(r.error){
      var msg=r.error==='INSUFFICIENT_GP'?_kbL('Not enough GP','GP 부족','GP不足','GP不足')
        :r.error==='TARGET_NOT_FOUND'?_kbL('Target not found','대상 없음','対象なし','未找到目标')
        :r.error==='CANNOT_SCOUT_SELF'?_kbL('Cannot scout yourself','자신은 정찰 불가','自分は偵察不可','无法侦察自己')
        :r.error;
      if(resEl) resEl.innerHTML='<div style="color:var(--red);font-size:10px;padding:6px">'+msg+'</div>';
      return;
    }
    var meta=_kbL('Cost','비용','コスト','花费')+' '+(r.cost_gp||0)+' GP'+(r.double_agent?' · '+_kbL('double-agent discount','이중첩자 할인','二重スパイ割引','双面间谍折扣'):'')+(r.detected?' · ⚠ '+_kbL('DETECTED','탐지됨','探知された','已被察觉'):'');
    if(resEl) resEl.innerHTML=_kbIntelCard(r.intel||{},meta);
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
    loadScoutReports();
  }catch(e){ if(resEl) resEl.innerHTML='<div style="color:var(--red);font-size:10px;padding:6px">'+_kbL('Scout failed','정찰 실패','偵察失敗','侦察失败')+'</div>'; }
}

async function loadScoutReports(){
  var el=document.getElementById('kbScoutReports'); if(!el) return;
  try{
    var d=await _guildReadJson('spy-reports', '/api/spy/reports?limit=5', 15000);
    if(!d) return;
    var reps=(d&&d.reports)||[];
    if(!reps.length){ el.innerHTML=''; return; }
    el.innerHTML='<div style="font-size:8px;color:var(--tx3);letter-spacing:1px;margin:4px 0">'+_kbL('RECENT INTEL','최근 정보','最近の情報','最近情报')+'</div>'+
      reps.map(function(rp){ return _kbIntelCard(rp.intel||{}, _kbShort(rp.target_wallet)+(rp.stale?' · '+_kbL('stale','만료','期限切れ','已过期'):'')); }).join('');
  }catch(e){ el.innerHTML=''; }
}

// (도파민 #6 v7.394) 부재 중 손실 브리핑 — 복귀 시 손실회피 훅(D7/D30 리텐션).
function _checkAwayBriefing(){
  try{
    _guildReadJson('away-briefing', '/api/me/away-briefing', 30000).then(function(d){
      if(!d || !d.hasNews) return;
      // 같은 손실을 매번 띄우지 않게 lastLoss 시점 기준 1회만
      var key='away_briefing_seen_'+(walletState.address||'');
      var seen=localStorage.getItem(key)||'';
      var stamp=String(d.lastLoss||'')+'|'+d.bounties;
      if(seen===stamp) return;
      localStorage.setItem(key, stamp);
      var parts=[];
      if(d.shipsLost>0) parts.push((LANG==='ko'?('함선 '+d.shipsLost+'척 격침'):LANG==='ja'?(d.shipsLost+'隻撃沈'):LANG==='zh'?('损失'+d.shipsLost+'舰'):(d.shipsLost+' ships lost'))+(d.lostValue>0?(' ('+(d.lostValue>=1000?(d.lostValue/1000).toFixed(0)+'K':d.lostValue)+' GP)'):''));
      if(d.bounties>0) parts.push((LANG==='ko'?('현상금 '+d.bounties+'건'):LANG==='ja'?('賞金'+d.bounties+'件'):LANG==='zh'?('悬赏'+d.bounties+'个'):(d.bounties+' bounties on you')));
      if(!parts.length) return;
      var title=(LANG==='ko'?'⚠ 부재 중 피해 보고':LANG==='ja'?'⚠ 不在中の被害':LANG==='zh'?'⚠ 离开期间损失':'⚠ While you were away');
      var cta=(LANG==='ko'?'복수하러 가기 ⚔':LANG==='ja'?'反撃へ ⚔':LANG==='zh'?'去复仇 ⚔':'Strike back ⚔');
      // 손실회피 배너 (토스트보다 강하게 — 클릭 시 킬보드/PVP로)
      var b=document.createElement('div');
      b.style.cssText='position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:99990;max-width:340px;width:calc(100% - 28px);background:linear-gradient(135deg,rgba(40,12,12,.97),rgba(20,8,10,.97));border:1px solid rgba(255,90,90,.5);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 18px rgba(255,70,70,.25);padding:13px 14px;font-family:var(--fn)';
      b.innerHTML='<div style="font-size:11px;font-weight:900;color:#ff8a80;letter-spacing:1px;margin-bottom:5px">'+title+'</div>'
        +'<div style="font-size:10px;color:rgba(255,255,255,.82);line-height:1.5;margin-bottom:9px">'+parts.join(' · ')+'</div>'
        +'<div style="display:flex;gap:7px">'
        +'<button type="button" id="_awayCta" style="flex:1;padding:8px;border-radius:8px;background:linear-gradient(135deg,#ff5a5a,#ff8a3d);border:none;color:#fff;font-weight:800;font-size:10px;cursor:pointer">'+cta+'</button>'
        +'<button type="button" id="_awayClose" style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--tx3);font-size:10px;cursor:pointer">✕</button>'
        +'</div>';
      document.body.appendChild(b);
      var _rm=function(){ try{ b.remove(); }catch(_){} };
      b.querySelector('#_awayClose').onclick=_rm;
      b.querySelector('#_awayCta').onclick=function(){ _rm(); try{ if(typeof openBaseModal==='function'){ openBaseModal(); setTimeout(function(){ try{ switchBaseTab('pvp', document.getElementById('baseTabPvp')); if(typeof clearBaseTabDot==='function') clearBaseTabDot('pvp'); }catch(_){} }, 250); } }catch(_){} };
      try{ if(window._sfx) _sfx.error(); }catch(_){}
      setTimeout(_rm, 15000);
    }).catch(function(){});
  }catch(_){}
}
// [v7.361] 배신자 낙인 속죄(유료 제거)
function _checkBetrayerMark(w){
  var banner=document.getElementById('betrayerRedeemBanner'); if(!banner||!w) return;
  fetch('/api/tags/'+encodeURIComponent(w), { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
    var tags=(d&&(d.tags||d))||[];
    var has=Array.isArray(tags)&&tags.some(function(tg){ return (tg.tag_id||tg.id||tg)==='guild_betrayer'; });
    banner.style.display = has ? '' : 'none';
  }).catch(function(){});
}
async function guildRedeemBetrayal(){
  var ok=await gameConfirm({
    icon:'⚖',
    title:LANG==='ko'?'배신자 낙인 제거':LANG==='ja'?'裏切り者の烙印を消す':LANG==='zh'?'清除叛徒烙印':'Clear Betrayer Mark',
    body:LANG==='ko'?'GP를 지불해 배신자 낙인을 영구히 제거합니다. 지불한 GP는 소각됩니다.':LANG==='ja'?'GPを支払い裏切り者の烙印を永久に消します。支払ったGPは焼却されます。':LANG==='zh'?'支付GP永久清除叛徒烙印。支付的GP将被销毁。':'Pay GP to permanently clear your betrayer mark. The GP is burned.',
    confirmText:LANG==='ko'?'속죄':LANG==='ja'?'贖罪':LANG==='zh'?'赎罪':'REDEEM'
  });
  if(!ok) return;
  fetch('/api/guild/redeem-betrayal',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){
      var msg=data.error==='INSUFFICIENT_GP'?(LANG==='ko'?('GP 부족 ('+(data.required||'')+' 필요)'):LANG==='ja'?'GP不足':LANG==='zh'?'GP不足':'Not enough GP')
        :data.error==='NO_BETRAYER_MARK'?(LANG==='ko'?'낙인이 없습니다':LANG==='ja'?'烙印なし':LANG==='zh'?'无烙印':'No mark'):data.error;
      showToast(msg,'error');return;
    }
    showToast(LANG==='ko'?('낙인 제거 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP 소각'):LANG==='ja'?('烙印を消去 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP'):LANG==='zh'?('烙印已清除 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP'):('Mark cleared — '+Math.round(data.cost_gp||0).toLocaleString()+' GP burned'),'info');
    var banner=document.getElementById('betrayerRedeemBanner'); if(banner) banner.style.display='none';
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

async function guildKick(targetWallet){
  var ok=await gameConfirm({icon:'⚔',title:LANG==='ko'?'멤버 추방':LANG==='ja'?'メンバー追放':LANG==='zh'?'踢出成员':'Kick Member',body:LANG==='ko'?'해당 멤버를 길드에서 추방합니다.':LANG==='ja'?'このメンバーをギルドから追放します。':LANG==='zh'?'将该成员踢出公会。':'Remove this member from the guild.',confirmText:LANG==='ko'?'추방':LANG==='ja'?'追放':LANG==='zh'?'踢出':'Kick'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/kick',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_kicked'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

function guildPromote(targetWallet){
  var w=walletState.address;
  fetch('/api/guild/promote',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_promoted'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

function guildDemote(targetWallet){
  var w=walletState.address;
  fetch('/api/guild/demote',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_demoted'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

async function guildTransfer(targetWallet){
  var ok=await gameConfirm({icon:'👑',title:LANG==='ko'?'길드장 양도':LANG==='ja'?'ギルドマスター移譲':LANG==='zh'?'转让会长':'Transfer Leadership',body:LANG==='ko'?'길드장 권한을 해당 멤버에게 영구 양도합니다.':LANG==='ja'?'ギルドマスター権限を該当メンバーに永久移譲します。':LANG==='zh'?'将会长权限永久转让给该成员。':'Permanently transfer guild leadership to this member.',confirmText:LANG==='ko'?'양도':LANG==='ja'?'移譲':LANG==='zh'?'转让':'Transfer'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/transfer',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_transferred'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// ── Guild Edit Modal (leader only) ─────────────────
// Lineage-style pixel-art emblem: any image is canvas-resized to 32×32.
var _guildEmblemDataUrl=null;      // staged image payload
var _guildEmblemMode='emoji';      // 'emoji' | 'image' | 'clear'

function openGuildEditModal(){
  if(!_myGuildData){ showToast('No guild','error'); return; }
  var g=_myGuildData;
  document.getElementById('geName').value=g.name||'';
  document.getElementById('geDesc').value=g.description||'';
  document.getElementById('geEmojiSelect').value=g.emblem||'🔴';
  _guildEmblemDataUrl=null;
  _guildEmblemMode='emoji';
  // Preview: show current emblem
  var prev=document.getElementById('gePreview');
  if(g.emblemImage){
    prev.innerHTML='<img src="'+g.emblemImage+'" style="width:64px;height:64px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px;border:1px solid var(--bdr)">';
    _guildEmblemMode='image';
    _guildEmblemDataUrl=g.emblemImage; // keep current until user changes
  } else {
    prev.innerHTML='<div style="font-size:48px">'+(g.emblem||'🔴')+'</div>';
  }
  document.getElementById('guildEditModal').style.display='flex';
  updateGuildEditCost();
}

function closeGuildEditModal(){
  document.getElementById('guildEditModal').style.display='none';
  _guildEmblemDataUrl=null;
}

// Calculate total GP cost based on which fields changed
function updateGuildEditCost(){
  if(!_myGuildData) return;
  var g=_myGuildData;
  var nm=document.getElementById('geName').value.trim();
  var ds=document.getElementById('geDesc').value;
  var em=document.getElementById('geEmojiSelect').value;
  var cost=0;
  var parts=[];
  // Cost constants mirror server settings (guild_rename_cost_gp etc.)
  if(nm && nm !== g.name)       { cost += 100; parts.push('Name 100'); }
  if(ds !== (g.description||'')){ cost += 20;  parts.push('Desc 20'); }
  if(_guildEmblemMode==='image' && _guildEmblemDataUrl && _guildEmblemDataUrl !== g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  else if(_guildEmblemMode==='clear' && g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  else if(_guildEmblemMode==='emoji' && em !== g.emblem && !g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  document.getElementById('geCost').textContent=cost;
  document.getElementById('geCostBreakdown').textContent=parts.length?('('+parts.join(' · ')+')'):'(no changes)';
  var btn=document.getElementById('geSaveBtn');
  btn.disabled=(cost===0);
  btn.style.opacity=(cost===0)?'0.4':'1';
}

// File picker: resize uploaded image to 32×32 with nearest-neighbor (pixelated)
function onGuildEmblemFile(input){
  var f=input.files && input.files[0];
  if(!f) return;
  if(f.size > 2*1024*1024){ showToast('Max 2MB image','error'); return; }
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      // Downscale to 32×32 on an offscreen canvas
      var SIZE=32;
      var c=document.createElement('canvas'); c.width=SIZE; c.height=SIZE;
      var ctx=c.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      // Contain the source into the square (letterbox transparent)
      var s=Math.max(img.width,img.height);
      var dx=(s-img.width)/2, dy=(s-img.height)/2;
      // Draw on a temp full-size canvas first so scaling is exact
      var tmp=document.createElement('canvas'); tmp.width=s; tmp.height=s;
      var tctx=tmp.getContext('2d');
      tctx.imageSmoothingEnabled=false;
      tctx.drawImage(img, dx, dy);
      ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
      var dataUrl=c.toDataURL('image/png');
      if(dataUrl.length > 8192){
        showToast('Image too complex — try a simpler one','error');
        return;
      }
      _guildEmblemDataUrl=dataUrl;
      _guildEmblemMode='image';
      document.getElementById('gePreview').innerHTML=
        '<img src="'+dataUrl+'" style="width:64px;height:64px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px;border:1px solid var(--bdr);background:#000">';
      updateGuildEditCost();
    };
    img.onerror=function(){ showToast('Invalid image','error'); };
    img.src=e.target.result;
  };
  reader.readAsDataURL(f);
}

// Clear custom image, revert to emoji
function clearGuildEmblemImage(){
  _guildEmblemDataUrl=null;
  _guildEmblemMode='clear';
  var em=document.getElementById('geEmojiSelect').value;
  document.getElementById('gePreview').innerHTML='<div style="font-size:48px">'+em+'</div>';
  updateGuildEditCost();
}

function onGuildEmojiChange(){
  if(_guildEmblemMode==='image') return; // don't stomp image preview
  var em=document.getElementById('geEmojiSelect').value;
  document.getElementById('gePreview').innerHTML='<div style="font-size:48px">'+em+'</div>';
  _guildEmblemMode='emoji';
  updateGuildEditCost();
}

function saveGuildEdit(){
  if(!_myGuildData || !walletState.address){ showToast('Login first','error'); return; }
  var g=_myGuildData;
  var nm=document.getElementById('geName').value.trim();
  var ds=document.getElementById('geDesc').value;
  var em=document.getElementById('geEmojiSelect').value;
  var body={ wallet: walletState.address, guildId: g.id };
  if(nm && nm !== g.name) body.name = nm;
  if(ds !== (g.description||'')) body.description = ds;
  if(_guildEmblemMode==='image' && _guildEmblemDataUrl && _guildEmblemDataUrl !== g.emblemImage) body.emblemImage = _guildEmblemDataUrl;
  if(_guildEmblemMode==='clear' && g.emblemImage) body.emblemImage = null;
  if(_guildEmblemMode==='emoji' && em !== g.emblem && !g.emblemImage) body.emblemEmoji = em;

  if(Object.keys(body).length <= 2){ showToast('No changes','info'); return; }

  var btn=document.getElementById('geSaveBtn');
  btn.disabled=true; btn.textContent='SAVING…';
  fetch('/api/guild/update',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(data){
      btn.disabled=false; btn.textContent='SAVE CHANGES';
      if(data.error){ showToast(data.error,'error'); return; }
      showToast('Guild updated (-'+data.cost+' GP)','success');
      closeGuildEditModal();
      loadGuildTab();
      try{ refreshEmailBalances(); }catch(_re){}
    })
    .catch(function(){ btn.disabled=false; btn.textContent='SAVE CHANGES'; showToast('Failed to update','error'); });
}

async function guildDisband(){
  if(!_myGuildData || !_myGuildData.name){ showToast(t('guild_toast_no_guild_data'),'error'); return; }
  var name=_myGuildData.name;
  var ok=await gameConfirm({icon:'💀',title:LANG==='ko'?'길드 해산':LANG==='ja'?'ギルド解散':LANG==='zh'?'解散公会':'Disband Guild',body:'<b>'+escapeHTML(name)+'</b> '+(LANG==='ko'?'길드를 영구 해산합니다. 되돌릴 수 없습니다.':LANG==='ja'?'ギルドを永久解散します。元に戻せません。':LANG==='zh'?'公会将被永久解散，不可撤销。':'will be permanently disbanded. This cannot be undone.'),confirmText:LANG==='ko'?'해산':LANG==='ja'?'解散':LANG==='zh'?'解散':'Disband'});
  if(!ok) return;
  var typed=await gameInput({title:LANG==='ko'?'길드 해산 확인':LANG==='ja'?'ギルド解散確認':LANG==='zh'?'确认解散公会':'Confirm Disband',label:LANG==='ko'?'길드 이름을 정확히 입력하세요':LANG==='ja'?'ギルド名を正確に入力してください':LANG==='zh'?'请准确输入公会名称':'Type the guild name exactly to confirm',placeholder:name,maxLength:60});
  if(typed===null||typed===undefined) return;
  if(typed.trim()!==name){
    showToast(t('guild_toast_disband_mismatch'),'error');
    return;
  }
  var w=walletState.address;
  fetch('/api/guild/disband',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_disbanded'),'info');
    _myGuildData=null;
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}
