// ─── Phase D: Alliance / Replay / Mobile ───
// ═════════════════════════════════════════════════════════════════
// Alliance
// ═════════════════════════════════════════════════════════════════

async function openAlliance() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  document.getElementById('allianceModal').classList.add('active');
  await loadAlliance();
}

function closeAlliance() {
  document.getElementById('allianceModal').classList.remove('active');
}

async function loadAlliance() {
  const container = document.getElementById('allianceContent');
  container.innerHTML = `<div class="bh-empty" style="padding:40px">${LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...'}</div>`;
  
  try {
    // 내 동맹 조회
    const myRes = await fetch('/api/alliances/mine', { headers: getAuthHeaders() });
    const myData = await myRes.json();
    
    if (myData.alliance) {
      renderMyAlliance(myData.alliance);
    } else {
      await renderAllianceList();
    }
  } catch (err) {
    console.error('loadAlliance:', err);
    container.innerHTML = `<div class="bh-empty" style="padding:40px">${LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed'}</div>`;
  }
}

function renderMyAlliance(al) {
  const container = document.getElementById('allianceContent');
  
  container.innerHTML = `
    <div class="al-header-info" style="border-left: 3px solid ${al.color_primary || '#4fc3f7'}">
      <div class="al-name">
        ${al.tag ? `<span class="al-tag">[${escapeHtml(al.tag)}]</span>` : ''}
        ${escapeHtml(al.name)}
      </div>
      <div class="al-meta">
        <span>${LANG==='ko'?'멤버':LANG==='ja'?'メンバー':LANG==='zh'?'成员':'Members'} <b>${al.member_count}/${al.max_members}</b></span>
        <span>${LANG==='ko'?'전적':LANG==='ja'?'戦績':LANG==='zh'?'战绩':'Record'} <b>${al.battles_won}W ${al.battles_lost}L</b></span>
        <span>${LANG==='ko'?'금고':LANG==='ja'?'金庫':LANG==='zh'?'金库':'Vault'} <b>${al.alliance_gp || 0}</b> GP</span>
        ${al.faction_name ? `<span>${LANG==='ko'?'소속':LANG==='ja'?'所属':LANG==='zh'?'所属':'Faction'} <b>${al.faction_name}</b></span>` : ''}
      </div>
      <div style="margin-top:10px;display:flex;gap:6px">
        ${al.role === 'leader' 
          ? `<span class="al-role-badge al-role-leader">👑 LEADER</span>` 
          : al.role === 'officer'
            ? `<span class="al-role-badge al-role-officer">★ OFFICER</span>`
            : `<span class="al-role-badge al-role-member">MEMBER</span>`}
        <button class="fd-btn" onclick="leaveMyAlliance()">${LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'}</button>
      </div>
    </div>
    <div class="al-members">
      <div class="al-members-title">${LANG==='ko'?'멤버':LANG==='ja'?'メンバー':LANG==='zh'?'成员':'Members'} (${al.members?.length || 0})</div>
      ${(al.members || []).map(m => `
        <div class="al-member">
          <span class="al-role-badge al-role-${m.role}">${m.role === 'leader' ? '👑' : m.role === 'officer' ? '★' : '•'}</span>
          <div>
            <div style="font-weight:700">${escapeHtml(m.nickname || '')}</div>
            <div style="color:rgba(255,255,255,.4);font-size:9px">⚔ ${m.ships_count || 0}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships'}</div>
          </div>
          <span style="font-size:9px;color:rgba(255,255,255,.4)">기여 ${m.contribution || 0}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderAllianceList() {
  const container = document.getElementById('allianceContent');
  
  try {
    const res = await fetch('/api/alliances');
    const data = await res.json();
    const list = data.alliances || [];
    
    container.innerHTML = `
      <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,.05)">
        <button class="bh-declare-btn" style="font-size:10px;padding:8px 16px;width:100%" 
                onclick="openCreateAlliance()">
          + ${LANG==='ko'?'동맹 창설':LANG==='ja'?'同盟創設':LANG==='zh'?'创建联盟':'Create Alliance'} (5000 GP)
        </button>
      </div>
      <div style="padding:14px 20px;overflow-y:auto">
        <div class="al-members-title">${LANG==='ko'?'기존 동맹':LANG==='ja'?'既存の同盟':LANG==='zh'?'现有联盟':'Alliances'} (${list.length})</div>
        ${list.length === 0 
          ? `<div class="bh-empty">${LANG==='ko'?'아직 동맹이 없습니다':LANG==='ja'?'まだ同盟がありません':LANG==='zh'?'暂无联盟':'No alliances yet'}</div>`
          : list.map(a => `
            <div class="al-list-card" style="border-left:3px solid ${a.color_primary || '#4fc3f7'}">
              <div>
                <div style="font-weight:700">
                  ${a.tag ? `<span style="color:rgba(255,255,255,.4)">[${escapeHtml(a.tag)}]</span> ` : ''}
                  ${escapeHtml(a.name)}
                </div>
                <div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:2px">
                  ${LANG==='ko'?'멤버':LANG==='ja'?'メンバー':LANG==='zh'?'成员':'Members'} ${a.member_count}/${a.max_members} · ${a.battles_won}W/${a.battles_lost}L · ${LANG==='ko'?'함선':LANG==='ja'?'艦船':LANG==='zh'?'舰船':'Ships'} ${a.total_ships_alive || 0}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':''}
                </div>
              </div>
              <button class="bc-btn primary" data-action="joinAllianceConfirm" data-alliance-id="${escapeHTML(a.id)}" data-alliance-name="${escapeHTML(a.name)}">
                ${LANG==='ko'?'가입':LANG==='ja'?'加入':LANG==='zh'?'加入':'Join'}
              </button>
            </div>
          `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="bh-empty" style="padding:40px">${LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed'}</div>`;
  }
}

async function openCreateAlliance() {
  const name = await gameInput({title:LANG==='ko'?'동맹 창설':LANG==='ja'?'同盟創設':LANG==='zh'?'创建联盟':'Create Alliance',label:LANG==='ko'?'동맹 이름 (60자 이하)':LANG==='ja'?'同盟名 (60文字以内)':LANG==='zh'?'联盟名称 (60字以内)':'Alliance name (max 60)',placeholder:LANG==='ko'?'예: 화성 연합':LANG==='ja'?'例: 火星連合':LANG==='zh'?'例: 火星联盟':'e.g. Mars Union',maxLength:60});
  if (!name || !name.trim()) return;

  const tag = await gameInput({title:LANG==='ko'?'동맹 태그':LANG==='ja'?'同盟タグ':LANG==='zh'?'联盟标签':'Alliance Tag',label:LANG==='ko'?'태그 (2~6자, 선택)':LANG==='ja'?'タグ (2~6文字、任意)':LANG==='zh'?'标签 (2~6字，可选)':'Tag (2-6 chars, optional)',placeholder:'e.g. MRS',maxLength:6});
  
  var ok=await gameConfirm({icon:'🤝',title:LANG==='ko'?'동맹 창설':LANG==='ja'?'同盟創設':LANG==='zh'?'创建联盟':'Create Alliance',body:(LANG==='ko'?'이름: ':LANG==='ja'?'名前: ':LANG==='zh'?'名称: ':'Name: ')+'<b>'+escapeHTML(name)+'</b>'+(tag?(` · ${LANG==='ko'?'태그':LANG==='ja'?'タグ':LANG==='zh'?'标签':'Tag'}: <b>`+escapeHTML(tag)+'</b>'):'')+'<br>'+(LANG==='ko'?'비용: ':LANG==='ja'?'費用: ':LANG==='zh'?'费用: ':'Cost: ')+'<b>5000 GP</b>',confirmText:LANG==='ko'?'창설':LANG==='ja'?'創設':LANG==='zh'?'创建':'Create'});
  if(!ok) return;
  
  try {
    const res = await fetch('/api/alliances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name: name.trim(), tag: tag?.trim() || null })
    });
    const data = await res.json();
    
    if (!res.ok) {
      const msgMap = {
        'NAME_TAKEN': LANG==='ko'?'이미 사용 중인 이름':LANG==='ja'?'すでに使用中の名前':LANG==='zh'?'名称已被使用':'Name already taken',
        'TAG_TAKEN': LANG==='ko'?'이미 사용 중인 태그':LANG==='ja'?'すでに使用中のタグ':LANG==='zh'?'标签已被使用':'Tag already taken',
        'INSUFFICIENT_GP': LANG==='ko'?'GP 부족 (5000 필요)':LANG==='ja'?'GP不足 (5000必要)':LANG==='zh'?'GP不足 (需要5000)':'Insufficient GP (need 5000)',
        'ALREADY_IN_ALLIANCE': LANG==='ko'?'이미 다른 동맹 소속':LANG==='ja'?'すでに他の同盟に所属':LANG==='zh'?'已加入其他联盟':'Already in an alliance',
      };
      showFactionToast(msgMap[data.error] || (LANG==='ko'?`오류: ${data.error}`:LANG==='ja'?`エラー: ${data.error}`:LANG==='zh'?`错误: ${data.error}`:`Error: ${data.error}`), 'error');
      return;
    }
    
    showFactionToast(`🤝 ${LANG==='ko'?`동맹 "${data.name}" 창설됨`:LANG==='ja'?`同盟「${data.name}」創設`:LANG==='zh'?`联盟「${data.name}」已创建`:`Alliance "${data.name}" created`}`, 'success');
    await loadAlliance();
  } catch (err) {
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

async function joinAllianceConfirm(allianceId, name) {
  var ok=await gameConfirm({icon:'🤝',title:LANG==='ko'?'동맹 가입':LANG==='ja'?'同盟加入':LANG==='zh'?'加入联盟':'Join Alliance',body:'<b>'+escapeHTML(name)+'</b> '+(LANG==='ko'?'동맹에 가입합니다.':LANG==='ja'?'同盟に加入します。':LANG==='zh'?'联盟，确认加入？':'— confirm join?'),confirmText:LANG==='ko'?'가입':LANG==='ja'?'加入':LANG==='zh'?'加入':'Join'});
  if(!ok) return;
  
  try {
    const res = await fetch(`/api/alliances/${allianceId}/join`, {
      method: 'POST', headers: getAuthHeaders()
    });
    const data = await res.json();
    
    if (!res.ok) {
      const msgMap = {
        'ALLIANCE_FULL': LANG==='ko'?'정원 초과':LANG==='ja'?'定員超過':LANG==='zh'?'人数已满':'Alliance full',
        'ALREADY_IN_ALLIANCE': LANG==='ko'?'이미 다른 동맹 소속':LANG==='ja'?'すでに他の同盟に所属':LANG==='zh'?'已加入其他联盟':'Already in an alliance',
      };
      showFactionToast(msgMap[data.error] || (LANG==='ko'?`오류: ${data.error}`:LANG==='ja'?`エラー: ${data.error}`:LANG==='zh'?`错误: ${data.error}`:`Error: ${data.error}`), 'error');
      return;
    }
    
    showFactionToast(`🤝 ${LANG==='ko'?'가입 완료':LANG==='ja'?'加入完了':LANG==='zh'?'加入成功':'Joined'}`, 'success');
    await loadAlliance();
  } catch (err) {
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

async function leaveMyAlliance() {
  var ok=await gameConfirm({icon:'🤝',title:LANG==='ko'?'동맹 탈퇴':LANG==='ja'?'同盟脱退':LANG==='zh'?'退出联盟':'Leave Alliance',body:LANG==='ko'?'동맹에서 탈퇴합니다. 쿨다운 기간 동안 재가입이 제한됩니다.':LANG==='ja'?'同盟から脱退します。クールダウン期間中は再加入が制限されます。':LANG==='zh'?'您将退出联盟。冷却期间内不能重新加入。':'Leave the alliance. Rejoin is restricted during cooldown.',confirmText:LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'});
  if(!ok) return;
  
  try {
    const res = await fetch('/api/alliances/leave', {
      method: 'POST', headers: getAuthHeaders()
    });
    const data = await res.json();
    
    if (!res.ok) {
      if (data.error === 'LEADER_MUST_TRANSFER') {
        showFactionToast(LANG==='ko'?'리더는 먼저 다른 멤버에게 이양해야 합니다':LANG==='ja'?'リーダーは先に他のメンバーに引き継がなければなりません':LANG==='zh'?'领袖必须先将职位移交给其他成员':'Leader must transfer to another member first','error');
      } else {
        showFactionToast((LANG==='ko'?`오류: `:LANG==='ja'?`エラー: `:LANG==='zh'?`错误: `:`Error: `) + data.error, 'error');
      }
      return;
    }

    showFactionToast(LANG==='ko'?'동맹에서 탈퇴했습니다':LANG==='ja'?'同盟から脱退しました':LANG==='zh'?'已退出联盟':'Left alliance','success');
    await loadAlliance();
  } catch (err) {
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

// ═════════════════════════════════════════════════════════════════
// Replay Share
// ═════════════════════════════════════════════════════════════════

let rpState = { currentTab: 'featured' };

async function openReplays() {
  document.getElementById('replayModal').classList.add('active');
  await rpLoad();
}

function closeReplays() {
  document.getElementById('replayModal').classList.remove('active');
}

function rpSwitchTab(tab) {
  rpState.currentTab = tab;
  document.querySelectorAll('#replayModal .bh-tab').forEach(t => 
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  rpLoad();
}

async function rpLoad() {
  const grid = document.getElementById('replayGrid');
  grid.innerHTML = '<div class="bh-empty" style="grid-column:1/-1">' + (LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...') + '</div>';
  
  try {
    const url = rpState.currentTab === 'mine' ? '/api/replays/mine' : '/api/replays/featured';
    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    const replays = data.replays || [];
    
    if (replays.length === 0) {
      grid.innerHTML = `<div class="bh-empty" style="grid-column:1/-1">
        ${rpState.currentTab === 'mine' ? (LANG==='ko'?'공유한 리플레이 없음':LANG==='ja'?'共有したリプレイなし':LANG==='zh'?'没有分享的回放':'No shared replays') : (LANG==='ko'?'추천 리플레이 없음':LANG==='ja'?'おすすめリプレイなし':LANG==='zh'?'没有推荐回放':'No featured replays')}
      </div>`;
      return;
    }
    
    // [v7.214 fix] share_token 인라인 onclick — index cache + delegated.
    window._replayCards = replays.slice();
    grid.innerHTML = replays.map((r, idx) => renderReplayCard(r, idx)).join('');
    if (!grid.dataset.delegated) {
      grid.dataset.delegated = '1';
      grid.addEventListener('click', function(ev){
        var card = ev.target && ev.target.closest ? ev.target.closest('div[data-action="viewReplay"]') : null;
        if (!card) return;
        var idx = parseInt(card.getAttribute('data-idx'), 10);
        var r = (window._replayCards || [])[idx];
        if (!r) return;
        console.log('[BTN] viewReplay triggered', r.share_token);
        viewReplay(r.share_token, r.battle_id || null);
      });
    }
  } catch (err) {
    grid.innerHTML = '<div class="bh-empty" style="grid-column:1/-1">' + (LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed') + '</div>';
  }
}

function renderReplayCard(r, idx) {
  const typeLabel = {
    'pvp_duel': 'PvP',
    'siege': '공성전',
    'hijack': '하이잭',
    'event': '이벤트',
    'raid': '레이드',
  }[r.battle_type] || r.battle_type;
  // [v7.214] data-action + data-idx, listener 는 loadReplays 안에서 한 번만 등록.
  return `
    <div class="rp-card" data-action="viewReplay" data-idx="${idx != null ? idx : ''}">
      <div class="rp-card-thumb">${r.is_featured ? '⭐' : '🎬'}</div>
      <div class="rp-card-body">
        <div class="rp-card-title">${escapeHtml(r.title || `[${typeLabel}]`)}</div>
        <div class="rp-card-meta">
          <span>${r.shared_by_nickname || '?'}</span>
          <span>👁 ${r.view_count || 0}</span>
        </div>
      </div>
    </div>
  `;
}

async function viewReplay(shareToken, battleId) {
  // 토큰으로 조회 → battle_id 얻어서 openBattleViewer 재사용
  try {
    const res = await fetch(`/api/replays/t/${shareToken}`);
    const data = await res.json();
    if (!res.ok) {
      showFactionToast(LANG==='ko'?'리플레이를 찾을 수 없음':LANG==='ja'?'リプレイが見つかりません':LANG==='zh'?'找不到回放':'Replay not found','error');
      return;
    }
    
    closeReplays();
    openBattleViewer(data.replay.battle_id);
  } catch (err) {
    showFactionToast(LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed','error');
  }
}

/**
 * 배틀 뷰어에서 "공유하기" 버튼으로 호출
 */
async function shareCurrentBattle() {
  if (!bv.battle) { showFactionToast(LANG==='ko'?'공유할 전투 없음':LANG==='ja'?'共有する戦闘がありません':LANG==='zh'?'没有可分享的战斗':'No battle to share','error'); return; }
  
  const battleId = bv.battle.id;
  const title = await gameInput({ title:LANG==='ko'?'📼 리플레이 공유':LANG==='ja'?'📼 リプレイ共有':LANG==='zh'?'📼 回放分享':'📼 Share Replay', label:LANG==='ko'?'제목 (선택)':LANG==='ja'?'タイトル (任意)':LANG==='zh'?'标题 (可选)':'Title (optional)', placeholder:LANG==='ko'?'나의 함대 대전':LANG==='ja'?'私の艦隊戦':LANG==='zh'?'我的舰队战':'My Fleet Battle', maxLength:60 });
  if (title === null) return; // cancelled

  try {
    const res = await fetch('/api/replays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        battle_id: battleId,
        title: title.trim() || undefined,
        is_public: true,
      })
    });
    const data = await res.json();

    if (!res.ok) {
      const msgMap = {
        'NOT_PARTICIPANT': LANG==='ko'?'참가자만 공유 가능':LANG==='ja'?'参加者のみ共有可能':LANG==='zh'?'仅参与者可分享':'Participants only',
        'BATTLE_NOT_ENDED': LANG==='ko'?'전투가 아직 끝나지 않음':LANG==='ja'?'戦闘がまだ終了していません':LANG==='zh'?'战斗尚未结束':'Battle not ended yet',
        'REPLAY_LIMIT_REACHED': LANG==='ko'?'공유 한도 초과 (최대 50개)':LANG==='ja'?'共有制限超過 (最大50)':LANG==='zh'?'分享已达上限 (最多50)':'Share limit reached (max 50)',
      };
      showFactionToast(msgMap[data.error] || (LANG==='ko'?`오류: ${data.error}`:LANG==='ja'?`エラー: ${data.error}`:LANG==='zh'?`错误: ${data.error}`:`Error: ${data.error}`), 'error');
      return;
    }

    const shareUrl = `${window.location.origin}/replay/${data.share_token}`;
    // 링크 복사 가능한 gameInput으로 보여주기
    await gameInput({ title:LANG==='ko'?'📼 공유 링크':LANG==='ja'?'📼 共有リンク':LANG==='zh'?'📼 分享链接':'📼 Share Link', label: data.already_shared ? (LANG==='ko'?'이미 공유된 전투입니다':LANG==='ja'?'すでに共有された戦闘です':LANG==='zh'?'该战斗已分享':'Already shared') : (LANG==='ko'?'아래 URL을 복사해서 공유하세요':LANG==='ja'?'以下のURLをコピーして共有してください':LANG==='zh'?'复制下方URL进行分享':'Copy the URL below to share'), defaultValue: shareUrl });

    showFactionToast(LANG==='ko'?'📼 공유 링크 생성 완료':LANG==='ja'?'📼 共有リンク作成完了':LANG==='zh'?'📼 分享链接已创建':'📼 Share link created', 'success');
  } catch (err) {
    console.error('shareCurrentBattle:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

// ═════════════════════════════════════════════════════════════════
// 모바일: 터치 제스처 & 뷰포트 조정
// ═════════════════════════════════════════════════════════════════

// 뷰포트 meta 자동 추가 (없으면)
(function ensureViewport() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);
  }
})();

// Battle Viewer에 터치 스와이프 추가 (seek)
(function addTouchControls() {
  // openBattleViewer 이후에 attach되어야 함
  document.addEventListener('touchstart', (e) => {
    if (!document.getElementById('battleViewer')?.classList.contains('active')) return;
    if (!bv || !bv.timeline) return;
    
    const bar = document.getElementById('bvTimelineBar');
    if (e.target === bar || bar?.contains(e.target)) {
      const rect = bar.getBoundingClientRect();
      const pct = (e.touches[0].clientX - rect.left) / rect.width;
      bv.currentTick = Math.max(0, Math.min(getLastTick(), pct * getLastTick()));
      for (const ev of bv.events) {
        if (ev.tick < bv.currentTick) bv.shownEvents.add(ev.id || `${ev.tick}-${ev.type}`);
      }
      redrawCurrentFrame();
    }
  }, { passive: true });
  
  // 더블탭 → 재생/일시정지
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    if (!document.getElementById('battleViewer')?.classList.contains('active')) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      // Canvas 영역 더블탭
      if (e.target === bv.canvas || e.target?.classList?.contains('bv-canvas')) {
        togglePlayback();
      }
    }
    lastTap = now;
  });
})();

// 모바일 기기 감지 후 UI 조정
(function detectMobile() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    document.body.classList.add('is-mobile');
    console.log('[Phase D] Mobile detected');
  }
})();


// ══ Onboarding v3 + Landing Overlay ══

// ─── 온보딩 상태 ───
var ob = { currentStep:0, selectedJob:null, selectedGuildId:null, status:null, _factions:[], _selectedFaction:null };

// ─── Landing Overlay ───
function checkLandingOverlay() {
  if (typeof isLoggedIn === 'function' && isLoggedIn()) return;
  if (sessionStorage.getItem('lo_dismissed')) return;
  var el = document.getElementById('landingOverlay');
  if (el) el.classList.add('active');
}
function startFromLanding() {
  sessionStorage.setItem('lo_dismissed', '1');
  var el = document.getElementById('landingOverlay');
  if (el) el.classList.remove('active');
  try { openAuthModal(); } catch(e) {}
}
function browseLanding() {
  sessionStorage.setItem('lo_dismissed', '1');
  var el = document.getElementById('landingOverlay');
  if (el) el.classList.remove('active');
}

// ── Open Beta Notice (first-entry, one-time per browser) ──
function showBetaNoticeOnce() {
  try { if (localStorage.getItem('pw_beta_notice_v1')) return; } catch (_) {}
  var el = document.getElementById('betaNotice'); if (!el) return;
  var $ = function(id){ return document.getElementById(id); };
  if ($('bnBadge')) $('bnBadge').textContent = tl('OPEN BETA','오픈베타','オープンベータ','公开测试');
  if ($('bnTitle')) $('bnTitle').textContent = tl('Welcome, Commander','커맨더, 환영합니다','指揮官、ようこそ','指挥官，欢迎');
  var rows = [
    ['🧪', tl(
      'This is an <b>experimental open beta</b> — things may break or change without notice.',
      '현재 <b>오픈베타(시험 운영)</b> 단계입니다. 예고 없이 오류·변경·점검이 있을 수 있습니다.',
      '現在<b>オープンベータ(試験運用)</b>です。予告なく不具合・変更・メンテナンスが発生する場合があります。',
      '当前为<b>公开测试(实验运营)</b>阶段，可能在无预告的情况下出现错误、变更或维护。')],
    ['🗂️', tl(
      'Game data (territory, fleets, GP/PP) may be <b>reset</b> during balancing or seasons.',
      '게임 데이터(영토·함대·GP/PP)는 밸런스 조정·시즌 개편으로 <b>초기화될 수 있습니다.</b>',
      'ゲームデータ(領土・艦隊・GP/PP)はバランス調整やシーズンで<b>リセットされる場合があります。</b>',
      '游戏数据(领地·舰队·GP/PP)可能因平衡调整或赛季而<b>被重置。</b>')],
    ['💱', tl(
      'In-game currencies (GP·PP) are for testing only and have <b>no cash value or refunds</b>.',
      '게임 내 재화(GP·PP)는 시험 운영용으로 <b>현금 가치나 환불을 보장하지 않습니다.</b>',
      'ゲーム内通貨(GP・PP)はテスト用で<b>現金価値や返金はありません。</b>',
      '游戏内货币(GP·PP)仅供测试，<b>无现金价值且不可退款。</b>')],
    ['🐛', tl(
      'Found a bug? Report it via the in-game 🐛 button — it really helps.',
      '버그를 발견하면 인게임 🐛 버튼으로 신고해 주세요. 큰 도움이 됩니다.',
      'バグを見つけたらゲーム内の🐛ボタンから報告してください。とても助かります。',
      '发现错误请通过游戏内🐛按钮反馈，非常感谢。')]
  ];
  if ($('bnBody')) $('bnBody').innerHTML = rows.map(function(r){
    return '<div class="bn-row"><span class="bn-ic">'+r[0]+'</span><span class="bn-tx">'+r[1]+'</span></div>';
  }).join('');
  if ($('bnAgree')) $('bnAgree').textContent = tl(
    'By continuing, you agree to these beta terms.',
    '계속 진행하면 위 베타 안내에 동의하는 것으로 간주됩니다.',
    '続行すると、上記のベータ規約に同意したものとみなされます。',
    '继续即表示您同意上述测试条款。');
  if ($('bnBtn')) $('bnBtn').textContent = tl('ENTER MARS','확인하고 시작','確認して開始','确认并开始');
  el.classList.add('open');
}
function acceptBetaNotice() {
  try { localStorage.setItem('pw_beta_notice_v1', '1'); } catch (_) {}
  var el = document.getElementById('betaNotice'); if (el) el.classList.remove('open');
}

// ─── Onboarding v3 ───
async function checkOnboarding() {
  try {
    const res = await fetch('/api/onboarding', { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const status = data.onboarding;
    if (!status) return;
    ob.status = status;
    if (status.completed || status.skipped) return;
    ob.currentStep = status.current_step || 0;
    ob.selectedJob = status.job_selected || null;
    browseLanding(); // 랜딩 닫기
    openOnboarding();
  } catch (err) {
    console.warn('[onboarding] check failed:', err);
  }
}

function openOnboarding() {
  var el = document.getElementById('obOverlay');
  if (el) el.classList.add('active');
  renderStep(ob.currentStep);
}

function updateProgress(step) {
  const total = 4;
  const pct = Math.round((step / total) * 100);
  var fill = document.getElementById('obProgressFill');
  var label = document.getElementById('obStepLabel');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = step === 0 ? 'OCCUPY MARS' : 'STEP ' + step + ' / ' + total;
}

// ─── 스텝 라우터 ───
function renderStep(step) {
  ob.currentStep = step;
  updateProgress(step);
  var content = document.getElementById('obContent');
  if (!content) return;
  switch (step) {
    case 0: renderObStep0(content); break;
    case 1: renderObStep1(content); break;
    case 2: renderObStep2(content); break;
    case 3: renderObStep3(content); break;
    case 4: renderObStep4(content); break;
    default: closeOnboarding(); break;
  }
}

// STEP 0: 착륙 인트로
function renderObStep0(el) {
  el.innerHTML = `
    <div class="ob-intro-text">
      <div style="font-size:56px;margin-bottom:16px;animation:ob-bounce .8s ease">🪐</div>
      <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:900;letter-spacing:6px;color:#fff;margin-bottom:20px;text-shadow:0 0 30px rgba(255,100,50,.5)">OCCUPY MARS</div>
      <p class="ob-intro-line" style="animation-delay:0s">${t('ob_line1')}</p>
      <p class="ob-intro-line" style="animation-delay:.8s">${t('ob_line2')}</p>
      <p class="ob-intro-line" style="animation-delay:1.6s">${t('ob_line3')}</p>
    </div>
    <button class="ob-btn-primary" onclick="advanceStep(0)" style="margin-top:16px;background:linear-gradient(135deg,#8b1a1a,#e74c3c);border-color:rgba(231,76,60,.7)">
      ${t('ob_btn_land')}
    </button>
    <button class="ob-btn-skip" onclick="skipOnboarding()">${t('ob_btn_skip')}</button>
  `;
}

// STEP 1: 직업 선택
function renderObStep1(el) {
  var _jobData = {
    miner:    { icon:'⛏️', name_en:'Miner',    name_ko:'광부',   name_ja:'採掘者',   name_zh:'矿工',   desc_en:'Accumulate wealth through mining', desc_ko:'채굴로 부를 쌓는다', desc_ja:'採掘で富を積む', desc_zh:'通过采矿积累财富', buff_en:'Mining +50%', buff_ko:'채굴 +50%', buff_ja:'採掘 +50%', buff_zh:'采矿 +50%', weak_en:'Battle -30%', weak_ko:'전투 -30%', weak_ja:'戦闘 -30%', weak_zh:'战斗 -30%' },
    warrior:  { icon:'⚔️', name_en:'Warrior',  name_ko:'전사',   name_ja:'戦士',     name_zh:'战士',   desc_en:'Seize and defend territory',       desc_ko:'영토를 빼앗고 지킨다', desc_ja:'領土を奪い守る', desc_zh:'夺取并守卫领地', buff_en:'ATK +20%', buff_ko:'공격력 +20%', buff_ja:'攻撃力 +20%', buff_zh:'攻击力 +20%', weak_en:'Mining -20%', weak_ko:'채굴 -20%', weak_ja:'採掘 -20%', weak_zh:'采矿 -20%' },
    crafter:  { icon:'🔨', name_en:'Crafter',  name_ko:'제작자', name_ja:'クラフター', name_zh:'工匠',  desc_en:'Craft and enhance items',          desc_ko:'아이템을 만들고 강화', desc_ja:'アイテムを作り強化', desc_zh:'制作并强化物品', buff_en:'Enhance +30%', buff_ko:'강화 +30%', buff_ja:'強化 +30%', buff_zh:'强化 +30%', weak_en:'Battle -20%', weak_ko:'전투 -20%', weak_ja:'戦闘 -20%', weak_zh:'战斗 -20%' },
    merchant: { icon:'💼', name_en:'Merchant', name_ko:'상인',   name_ja:'商人',     name_zh:'商人',   desc_en:'Maximize profits through trade',   desc_ko:'거래로 이익을 극대화', desc_ja:'取引で利益を最大化', desc_zh:'通过交易最大化利润', buff_en:'Fee -35%', buff_ko:'수수료 -35%', buff_ja:'手数料 -35%', buff_zh:'手续费 -35%', weak_en:'Battle -20%', weak_ko:'전투 -20%', weak_ja:'戦闘 -20%', weak_zh:'战斗 -20%' },
  };
  var _jobLng = function(j,k){ return LANG==='ko'?j[k+'_ko']:LANG==='ja'?j[k+'_ja']:LANG==='zh'?j[k+'_zh']:j[k+'_en']; };
  el.innerHTML = `
    <div class="ob-title" style="font-size:15px">${t('ob_step1_title')}</div>
    <div class="ob-subtitle">${t('ob_step1_sub')}</div>
    <div class="ob-job-grid">
      ${Object.keys(_jobData).map(function(code){var j=_jobData[code]; return `
        <div class="ob-job-card ${code} ${ob.selectedJob===code?'selected':''}" onclick="obSelectJob('${code}')">
          <div class="ob-job-icon">${j.icon}</div>
          <div class="ob-job-name ${code}">${_jobLng(j,'name')}</div>
          <div class="ob-job-desc">${_jobLng(j,'desc')}</div>
          <div class="ob-job-buff">✓ ${_jobLng(j,'buff')}</div>
          <div class="ob-job-weak">✗ ${_jobLng(j,'weak')}</div>
        </div>`}).join('')}
    </div>
    <div style="font-size:9px;color:rgba(255,255,255,.25);text-align:center;margin-bottom:8px">${t('ob_job_change_note')}</div>
    <button class="ob-btn-primary" id="obJobConfirmBtn" onclick="advanceStep(1)" ${ob.selectedJob?'':'disabled'}>
      ${ob.selectedJob ? (obGetJobName(ob.selectedJob)+' — '+t('ob_confirm')) : t('ob_step1_choose')}
    </button>
  `;
}
function obSelectJob(code) { ob.selectedJob = code; renderStep(1); }
function obGetJobName(code) {
  var _n={miner:{en:'Miner',ko:'광부',ja:'採掘者',zh:'矿工'},warrior:{en:'Warrior',ko:'전사',ja:'戦士',zh:'战士'},crafter:{en:'Crafter',ko:'제작자',ja:'クラフター',zh:'工匠'},merchant:{en:'Merchant',ko:'상인',ja:'商人',zh:'商人'}};
  return (_n[code]&&(_n[code][LANG]||_n[code].en))||code;
}

// STEP 2: 파벌 선택 (inline)
async function renderObStep2(el) {
  // 이미 파벌 있으면 바로 통과
  if (typeof factionState !== 'undefined' && factionState.current && factionState.current.code) {
    el.innerHTML = `
      <div class="ob-complete-center" style="padding:20px 0">
        <div style="font-size:42px;margin-bottom:12px">${factionState.current.icon_emoji||'🛡️'}</div>
        <div class="ob-title" style="font-size:14px">${LANG==='ko'?(factionState.current.name_ko||factionState.current.code):LANG==='ja'?(factionState.current.name_ja||factionState.current.name_en||factionState.current.code):LANG==='zh'?(factionState.current.name_zh||factionState.current.name_en||factionState.current.code):(factionState.current.name_en||factionState.current.code)}</div>
        <div class="ob-subtitle">${t('ob_step2_already')}</div>
      </div>
      <button class="ob-btn-primary" onclick="advanceStep(2)">${t('ob_step2_continue')}</button>`;
    return;
  }
  el.innerHTML = `
    <div class="ob-title" style="font-size:15px">${t('ob_step2_title')}</div>
    <div class="ob-subtitle">${t('ob_step2_sub')}<br>
      <span style="color:rgba(255,255,255,.3);font-size:10px">${t('ob_step2_free_note')}</span></div>
    <div class="ob-faction-grid" id="obFactionGrid">
      <div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:10px;grid-column:1/-1">${t('ob_step2_loading')}</div>
    </div>
    <button class="ob-btn-primary" id="obFactionConfirmBtn" onclick="obConfirmFaction()" disabled>${t('ob_step2_choose')}</button>
    <button class="ob-btn-skip" onclick="advanceStep(2)">${t('ob_step2_skip')}</button>
  `;
  try {
    var factions = (typeof factionState!=='undefined' && factionState.list && factionState.list.length)
      ? factionState.list
      : await fetch('/api/factions').then(function(r){return r.json()}).then(function(d){return d.factions||[]});
    ob._factions = factions;
    ob._selectedFaction = null;
    var gridEl = document.getElementById('obFactionGrid');
    if (!gridEl) return;
    var colorMap = {mcc:'#ef5350', fsp:'#4fc3f7', cv:'#81c784'};
    gridEl.innerHTML = factions.map(function(f){
      var c = colorMap[f.code]||'#fff';
      var _fname = LANG==='ko'?(f.name_ko||f.code):LANG==='ja'?(f.name_ja||f.name_en||f.code):LANG==='zh'?(f.name_zh||f.name_en||f.code):(f.name_en||f.code);
      var _fdesc = LANG==='ko'?(f.description_ko||''):LANG==='ja'?(f.description_ja||f.description_en||f.description_ko||''):LANG==='zh'?(f.description_zh||f.description_en||f.description_ko||''):(f.description_en||f.description_ko||'');
      return '<div class="ob-faction-card '+f.code+'" id="obFCard_'+f.code+'" onclick="obSelectFaction(\''+f.code+'\')">'
        +'<div style="font-size:28px;margin-bottom:8px">'+(f.icon_emoji||'⬢')+'</div>'
        +'<div style="font-family:\'Orbitron\',monospace;font-size:10px;font-weight:900;letter-spacing:2px;color:'+c+';margin-bottom:6px">'+_fname+'</div>'
        +'<div style="font-size:9px;color:rgba(255,255,255,.4);line-height:1.5;margin-bottom:8px">'+_fdesc+'</div>'
        +'<div style="font-size:9px;color:rgba(255,255,255,.45);line-height:1.7">'
        +'<div>⚔ ATK ×'+f.atk_multiplier+'</div>'
        +'<div>🛡 DEF ×'+f.def_multiplier+'</div>'
        +'<div>💨 SPD ×'+f.spd_multiplier+'</div>'
        +'</div></div>';
    }).join('');
  } catch(e) {
    var gridEl = document.getElementById('obFactionGrid');
    if (gridEl) gridEl.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:10px;text-align:center;grid-column:1/-1;padding:16px">'+t('ob_step2_load_fail')+'</div>';
  }
}
function obSelectFaction(code) {
  ob._selectedFaction = code;
  document.querySelectorAll('.ob-faction-card').forEach(function(el){
    el.classList.toggle('selected', el.id === 'obFCard_'+code);
  });
  var btn = document.getElementById('obFactionConfirmBtn');
  if (btn) { btn.disabled = false; btn.textContent = t('ob_confirm'); }
}
async function obConfirmFaction() {
  if (!ob._selectedFaction) return;
  var btn = document.getElementById('obFactionConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('ob_processing'); }
  try {
    var res = await fetch('/api/factions/choose', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ faction_code: ob._selectedFaction })
    });
    var data = await res.json();
    if (!res.ok) {
      showFactionToast(t('ob_faction_error')+(data.error||'error'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = t('ob_confirm'); }
      return;
    }
    showFactionToast(t('ob_faction_success'), 'success');
    if (data.starter_ship) {
      var _sname = syShipName(data.starter_ship)||(LANG==='ko'?'프리깃':LANG==='ja'?'フリゲート':LANG==='zh'?'护卫舰':'Frigate');
      setTimeout(function() {
        showToast(t('ob_starter_ship').replace('{name}',_sname), 'success');
      }, 800);
    }
    try { await loadFactions(); } catch(_) {}
    advanceStep(2);
  } catch(e) {
    showFactionToast(t('err_network')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = t('ob_confirm'); }
  }
}

// STEP 3: 첫 영토 안내
async function renderObStep3(el) {
  var sectorName = 'Arcadia Ridge', sectorReason = LANG==='ko'?'자원이 풍부하고 방어가 쉬운 지역입니다':LANG==='ja'?'資源が豊富で守りやすい地域です':LANG==='zh'?'资源丰富且易于防守的地区':'Resource-rich and easy to defend';
  try {
    var res = await fetch('/api/onboarding/sector?job_code='+(ob.selectedJob||'miner'));
    var d = await res.json();
    if (d.sector) {
      sectorName = d.sector.name||d.sector.code||sectorName;
      sectorReason = LANG==='ko'?(d.sector.reason_ko||sectorReason):LANG==='ja'?(d.sector.reason_ja||d.sector.reason_en||d.sector.reason_ko||sectorReason):LANG==='zh'?(d.sector.reason_zh||d.sector.reason_en||d.sector.reason_ko||sectorReason):(d.sector.reason_en||d.sector.reason_ko||sectorReason);
    }
  } catch(_) {}
  el.innerHTML = `
    <div class="ob-title" style="font-size:15px">${t('ob_step3_title')}</div>
    <div class="ob-subtitle">${t('ob_step3_sub')}</div>
    <div class="ob-sector-card">
      <div class="ob-sector-icon">🗺️</div>
      <div class="ob-sector-info">
        <div class="ob-sector-name">${sectorName}</div>
        <div class="ob-sector-reason">${sectorReason}</div>
      </div>
    </div>
    <div class="ob-free-badge">${t('ob_step3_free')}</div>
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 14px;margin:12px 0;font-size:10px;color:rgba(255,255,255,.5);line-height:1.9">
      <b style="color:#4fc3f7">①</b> ${t('ob_step3_tip1')}<br>
      <b style="color:#4fc3f7">②</b> ${t('ob_step3_tip2')}<br>
      <b style="color:#4fc3f7">③</b> ${t('ob_step3_tip3')}
    </div>
    <button class="ob-btn-primary" onclick="advanceStep(3)">${t('ob_step3_got_it')}</button>
    <button class="ob-btn-skip" onclick="advanceStep(3)">${t('ob_step3_next')}</button>
  `;
}

// STEP 4: 완료 + 보상
async function renderObStep4(el) {
  var mission = { desc_ko:'첫 영토를 클레임하세요', desc_en:'Claim your first territory', gp_reward:50 };
  try {
    var res = await fetch('/api/onboarding/mission?job_code='+(ob.selectedJob||'miner'));
    var d = await res.json();
    if (d.mission) mission = d.mission;
  } catch(_) {}
  var _missionDesc = LANG==='ko'?(mission.desc_ko||mission.desc_en):LANG==='ja'?(mission.desc_ja||mission.desc_en||mission.desc_ko):LANG==='zh'?(mission.desc_zh||mission.desc_en||mission.desc_ko):(mission.desc_en||mission.desc_ko);
  el.innerHTML = `
    <div class="ob-complete-center">
      <div class="ob-complete-emoji">🎉</div>
      <div class="ob-title" style="font-size:16px">${t('ob_step4_title')}</div>
      <div class="ob-subtitle">${t('ob_step4_sub')}</div>
      <div class="ob-rewards-grid">
        <div class="ob-reward-chip gp">💰 +75 GP</div>
        <div class="ob-reward-chip pp">🔵 +0.5 PP</div>
        <div class="ob-reward-chip title">${t('ob_reward_pioneer')}</div>
      </div>
      <div style="background:rgba(79,195,247,.05);border:1px solid rgba(79,195,247,.15);border-radius:8px;padding:12px 16px;margin:12px 0;text-align:left">
        <div style="font-size:9px;letter-spacing:2px;color:rgba(255,255,255,.3);margin-bottom:4px">${t('ob_step4_mission_label')}</div>
        <div style="font-size:12px;color:#4fc3f7">${_missionDesc}</div>
        <div style="font-size:10px;color:#ffd700;margin-top:4px">${t('ob_step4_mission_reward').replace('{gp}',mission.gp_reward)}</div>
      </div>
    </div>
    <button class="ob-btn-primary" onclick="finishOnboarding()" style="background:linear-gradient(135deg,#1a5c1a,#4caf50);border-color:rgba(76,175,80,.6)">
      ${t('ob_step4_start')}
    </button>
  `;
}

// ─── 진행/스킵/완료 ───
async function advanceStep(currentStep) {
  try {
    var stepData = {};
    if (currentStep === 1 && ob.selectedJob) stepData.job_code = ob.selectedJob;
    var res = await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ step: currentStep, data: stepData })
    });
    var data = await res.json();
    if (data.rewards && data.rewards.length) {
      data.rewards.forEach(function(r) {
        if (r.type==='gp')    showFactionToast(t('ob_reward_gp').replace('{n}',r.amount), 'success');
        if (r.type==='pp')    showFactionToast(t('ob_reward_pp').replace('{n}',r.amount), 'success');
        if (r.type==='item')  showFactionToast(t('ob_reward_item').replace('{code}',r.code), 'success');
        if (r.type==='title') {
          var _tname = LANG==='ko'?(r.name_ko||r.name_en||r.code):LANG==='ja'?(r.name_ja||r.name_en||r.name_ko||r.code):LANG==='zh'?(r.name_zh||r.name_en||r.name_ko||r.code):(r.name_en||r.name_ko||r.code);
          showFactionToast(t('ob_reward_title').replace('{name}',_tname), 'success');
        }
      });
    }
    renderStep(data.completed ? 4 : Math.min(currentStep + 1, 4));
  } catch(err) {
    console.error('[onboarding] advanceStep error:', err);
    renderStep(Math.min(currentStep + 1, 4));
  }
}

async function skipOnboarding() {
  try { await fetch('/api/onboarding/skip', { method:'POST', headers: getAuthHeaders() }); } catch(_) {}
  closeOnboarding();
}

async function finishOnboarding() {
  try {
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ step: 4, data: { finished: true } })
    });
  } catch(_) {}
  closeOnboarding();
  showFactionToast(`🚀 ${LANG==='ko'?'화성에 오신 걸 환영합니다!':LANG==='ja'?'火星へようこそ！':LANG==='zh'?'欢迎来到火星！':'Welcome to Mars!'}`, 'success');
  try { refreshGP(); } catch(_) {}
}

function closeOnboarding() {
  var el = document.getElementById('obOverlay');
  if (el) el.classList.remove('active');
}

function getOnboardingWallet() {
  var w = null;
  try { if (typeof getMyWallet === 'function') w = getMyWallet(); } catch (_) {}
  if (!w && typeof walletState !== 'undefined' && walletState && walletState.address) w = walletState.address;
  return (w || '').toLowerCase().trim();
}

async function runOnboardingCheck() {
  if (!_pageIsActive()) return;
  if (typeof isLoggedIn === 'function' && !isLoggedIn()) return;
  var wallet = getOnboardingWallet();
  if (!wallet) return;
  try {
    var res = await fetch('/api/onboarding/status', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    var status = await res.json();
    if (!status || status.completed) return;
    showOnboardingHint(status.step || 0);
  } catch (err) {
    console.warn('[onboarding] status failed:', err);
  }
}

function showOnboardingHint(step) {
  var el = document.getElementById('onboardingHint');
  if (!el) return;
  var title = el.querySelector('.onboarding-hint__title');
  var body = el.querySelector('.onboarding-hint__body');
  // 4개 언어 현지화 + 골든패스(첫 영토→채굴→함대→캠페인 메인 스토리) 유도.
  // 기존엔 영어 하드코딩이라 KO/JA/ZH 유저에게 영어로 노출되던 문제를 함께 수정.
  var messages = [
    { title: tl('FIRST LANDING','첫 상륙','ファーストランディング','首次登陆'),
      body: tl('Claim your first Mars territory to stake your claim.','첫 화성 영토를 점령해 거점을 마련하세요.','最初の火星領土を獲得して拠点を築こう。','占领你的第一块火星领土，建立据点。') },
    { title: tl('START MINING','채굴 시작','採掘開始','开始采矿'),
      body: tl('Harvest PP from your territory — your first income.','영토에서 PP를 채굴하세요 — 첫 수입입니다.','領土からPPを採掘 — 最初の収入です。','从领土收获PP——你的第一笔收入。') },
    { title: tl('BUILD & ADVANCE','함대 & 진격','艦隊 & 進撃','舰队 & 推进'),
      body: tl('Build your first ship in BASE, then follow the CAMPAIGN — the main story.','BASE에서 첫 함선을 만들고, 메인 스토리인 캠페인을 따라가세요.','BASEで最初の艦船を建造し、メインストーリーのキャンペーンを進めよう。','在BASE建造第一艘舰船，然后跟随主线剧情战役。') }
  ];
  var msg = messages[Math.max(0, Math.min(step, messages.length - 1))];
  if (title) title.textContent = msg.title;
  if (body) body.textContent = msg.body;
  el.dataset.step = String(step);
  el.classList.add('active');
}

function closeOnboardingHint() {
  var el = document.getElementById('onboardingHint');
  if (el) el.classList.remove('active');
}

async function dismissOnboardingHint() {
  var wallet = getOnboardingWallet();
  closeOnboardingHint();
  try {
    await fetch('/api/onboarding/dismiss', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({})
    });
  } catch (_) {}
}

function onboardingAction() {
  var el = document.getElementById('onboardingHint');
  var step = parseInt(el && el.dataset.step, 10) || 0;
  closeOnboardingHint();
  if (step === 0) {
    try { openBaseModal(); switchBaseTab('territory', document.querySelector('[onclick*=territory]')); } catch (_) { try { openBaseModal(); } catch (_) {} }
    return;
  }
  if (step === 1) {
    try { openBaseModal(); switchBaseTab('territory', document.getElementById('baseTabTerritory')); } catch (_) { try { openBaseModal(); } catch (_) {} }
    return;
  }
  try { openBaseModal(); switchBaseTab('fleet', document.getElementById('baseTabFleet')); } catch (_) { try { openBaseModal(); } catch (_) {} }
}

// ── override: old initOnboarding → v3 ──
async function initOnboarding(wallet) {
  browseLanding();
  _setActiveTimeout(runOnboardingCheck, 1500);
}

// ── CHAT SYSTEM ──────────────────────────────────────────────
let _chatChannel = 'global';
let _chatSince = null;
let _chatSinceId = null;
let _chatPollTimer = null;
let _chatUnread = 0;
let _chatExpanded = false;
let _chatLoading = false;
let _chatLoadQueued = false;
let _chatSeenIds = new Set();
let _chatSeenContent = new Map();
let _chatSending = false;
let _chatFetchTimer = null;
let _chatLastFetchAt = 0;
let _chatBackoffUntil = 0;
let _chatErrorStreak = 0;
const CHAT_FETCH_MIN_GAP_MS = 1500;
const CHAT_DUP_WINDOW_MS = 600000;
const CHAT_POLL_FALLBACK_MS = 30000;
const CHAT_SEEN_ID_LIMIT = 250;
const CHAT_MAX_BACKOFF_MS = 120000;

function toggleChat() {
  const el = document.getElementById('chatOverlay');
  _chatExpanded = !_chatExpanded;
  el.classList.toggle('collapsed', !_chatExpanded);
  if (_chatExpanded) {
    _chatUnread = 0;
    const badge = document.getElementById('chatUnreadBadge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
    requestChatMessages(0);
    _setActiveTimeout(() => {
      const msgs = document.getElementById('chatMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  }
}

function switchChatChannel(ch) {
  _chatChannel = ch === 'sector' ? (window._chatCurrentSector || 'global') : 'global';
  _chatSince = null;
  _chatSinceId = null;
  _chatSeenIds = new Set();
  _chatSeenContent = new Map();
  document.getElementById('chatMessages').innerHTML = '';
  document.querySelectorAll('.chat-ch').forEach(b => b.classList.remove('active'));
  const idx = ch === 'sector' ? 1 : 0;
  document.querySelectorAll('.chat-ch')[idx]?.classList.add('active');
  requestChatMessages(0);
  try { _liveWSSubscribe(); } catch(_) {}  // 새 채널 실시간 구독 갱신
}

async function sendChatMessage() {
  if (_chatSending) return;
  const input = document.getElementById('chatInput');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  const wallet = window._walletAddress || (window.walletState && walletState.address) || localStorage.getItem('wallet') || '';
  if (!wallet) { if(typeof showToast === 'function') showToast('로그인이 필요합니다'); return; }
  const token = localStorage.getItem('pw_token') || localStorage.getItem('token') || localStorage.getItem('jwt') || '';
  _chatSending = true;
  const sendBtn = document.getElementById('chatSendBtn');
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  try {
    const r = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? {'Authorization': 'Bearer ' + token} : {}) },
      body: JSON.stringify({ channel: _chatChannel, message: msg })
    });
    if (r.status === 429) { if(typeof showToast === 'function') showToast('메시지를 너무 빠르게 전송하고 있습니다'); return; }
    if (!r.ok) { if(typeof showToast === 'function') showToast('전송 실패'); return; }
    const sent = await r.json().catch(() => null);
    input.value = '';
    if (sent && sent.message) _appendChatMessages([sent.message]);
  } catch(e) { if(typeof showToast === 'function') showToast('전송 오류'); }
  finally {
    _chatSending = false;
    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

function requestChatMessages(delay) {
  if (!_chatExpanded && _liveWSIsOpen()) return;
  if (_chatFetchTimer) _clearActiveTimeout(_chatFetchTimer);
  _chatFetchTimer = _setActiveTimeout(function(){
    _chatFetchTimer = null;
    loadChatMessages();
  }, Math.max(0, delay || 0));
}

async function loadChatMessages() {
  if (_chatLoading) { _chatLoadQueued = true; return; }
  const now = Date.now();
  if (now < _chatBackoffUntil) {
    requestChatMessages(_chatBackoffUntil - now + 250);
    return;
  }
  const gap = now - _chatLastFetchAt;
  if (gap < CHAT_FETCH_MIN_GAP_MS) {
    requestChatMessages(CHAT_FETCH_MIN_GAP_MS - gap);
    return;
  }
  _chatLoading = true;
  _chatLastFetchAt = now;
  try {
    // Skip polling when page is hidden (tab not visible) AND chat is collapsed —
    // avoids competing with the Globe.GL render loop for network/CPU bandwidth.
    if (!_pageIsActive() && !_chatExpanded) return;
    const url = '/api/chat/messages?channel=' + encodeURIComponent(_chatChannel)
      + (_chatSinceId != null ? '&since_id=' + encodeURIComponent(_chatSinceId) : (_chatSince ? '&since=' + encodeURIComponent(_chatSince) : ''));
    const r = await fetch(url);
    if (r.status === 429) {
      _chatErrorStreak = Math.min(_chatErrorStreak + 1, 6);
      _chatBackoffUntil = Date.now() + _chatRetryDelay(r, _chatErrorStreak);
      return;
    }
    if (!r.ok) {
      _chatErrorStreak = Math.min(_chatErrorStreak + 1, 6);
      _chatBackoffUntil = Date.now() + _chatRetryDelay(r, _chatErrorStreak);
      return;
    }
    const data = await r.json();
    _chatErrorStreak = 0;
    _chatBackoffUntil = 0;
    const msgs = data.messages || [];
    if (!msgs.length) return;
    _chatSince = msgs[msgs.length - 1].created_at;
    const lastId = msgs.reduce((max, m) => Math.max(max, parseInt(m.id, 10) || 0), _chatSinceId || 0);
    if (lastId > 0) _chatSinceId = lastId;
    _appendChatMessages(msgs);
  } catch(e) {
    _chatErrorStreak = Math.min(_chatErrorStreak + 1, 6);
    _chatBackoffUntil = Date.now() + _chatRetryDelay(null, _chatErrorStreak);
  }
  finally {
    _chatLoading = false;
    if (_chatLoadQueued) {
      _chatLoadQueued = false;
      requestChatMessages(CHAT_FETCH_MIN_GAP_MS);
    }
  }
}

function _chatRetryDelay(resp, streak) {
  var retryAfter = 0;
  try { retryAfter = parseInt(resp && resp.headers && resp.headers.get('Retry-After'), 10) || 0; } catch(_) {}
  if (retryAfter > 0) return Math.min(CHAT_MAX_BACKOFF_MS, retryAfter * 1000);
  return Math.min(CHAT_MAX_BACKOFF_MS, 5000 * Math.pow(2, Math.max(0, (streak || 1) - 1)));
}

function _appendChatMessages(msgs) {
  if (!msgs || !msgs.length) return;
  const last = msgs[msgs.length - 1];
  if (last && last.created_at) _chatSince = last.created_at;
  const lastId = msgs.reduce((max, m) => Math.max(max, parseInt(m.id, 10) || 0), _chatSinceId || 0);
  if (lastId > 0) _chatSinceId = lastId;
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
  let appended = 0;
  msgs.forEach(m => {
    const msgKey = m.id != null ? String(m.id) : [m.channel, m.created_at, m.wallet, m.message].join('|');
    if (_chatSeenIds.has(msgKey)) return;
    const nick = m.nickname || (m.wallet || '').substring(0, 8);
    const contentKeys = _chatContentKeys(m, nick);
    const msgTime = new Date(m.created_at).getTime() || Date.now();
    const isDuplicateContent = contentKeys.some(key => {
      const lastSame = _chatSeenContent.get(key);
      return lastSame && Math.abs(msgTime - lastSame) < CHAT_DUP_WINDOW_MS;
    });
    if (isDuplicateContent) {
      _chatSeenIds.add(msgKey);
      return;
    }
    _chatSeenIds.add(msgKey);
    contentKeys.forEach(key => _chatSeenContent.set(key, msgTime));
    _pruneChatDedupe(msgTime);
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.dataset.msgId = msgKey;
    const t = new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.innerHTML = '<span class="chat-msg-nick">' + _escapeHtml(nick) + '</span><span class="chat-msg-text">' + _escapeHtml(m.message) + '</span><span class="chat-msg-time">' + t + '</span>';
    container.appendChild(div);
    appended++;
  });
  if (!appended) return;
  if (wasAtBottom || !_chatExpanded) {
    container.scrollTop = container.scrollHeight;
  }
  if (!_chatExpanded && appended > 0) {
    _chatUnread += appended;
    const badge = document.getElementById('chatUnreadBadge');
    if (badge) { badge.style.display = 'inline'; badge.textContent = _chatUnread > 99 ? '99+' : String(_chatUnread); }
  }
}

function _chatContentKeys(m, nick) {
  const channel = String(m.channel || _chatChannel || 'global').trim();
  const message = String(m.message || '').trim().replace(/\s+/g, ' ');
  const wallet = String(m.wallet || '').trim().toLowerCase();
  const display = String(nick || '').trim().toLowerCase();
  return [
    wallet ? [channel, 'wallet', wallet, message].join('|') : '',
    display ? [channel, 'display', display, message].join('|') : ''
  ].filter(Boolean);
}

function _pruneChatDedupe(now) {
  const cutoff = (now || Date.now()) - CHAT_DUP_WINDOW_MS;
  _chatSeenContent.forEach((ts, key) => {
    if (!ts || ts < cutoff) _chatSeenContent.delete(key);
  });
  while (_chatSeenIds.size > CHAT_SEEN_ID_LIMIT) {
    const first = _chatSeenIds.values().next().value;
    if (first == null) break;
    _chatSeenIds.delete(first);
  }
}

function _escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _socialLiveHasSession() {
  if (window.walletState && walletState.connected && walletState.address) return true;
  try { return !!localStorage.getItem('pw_token'); } catch (_) { return false; }
}

function _socialLiveShouldRun() {
  return _pageIsActive() && _socialLiveHasSession();
}

function startChatPolling() {
  if (!_socialLiveShouldRun()) return;
  if (_chatPollTimer) _clearActiveInterval(_chatPollTimer);
  requestChatMessages(0);
  // WebSocket(/ws/live)이 실시간 푸시를 담당 → 폴링은 느린 폴백만 유지.
  _chatPollTimer = _setActiveInterval(() => {
    if (!_socialLiveShouldRun()) return;
    if (_liveWSIsOpen() && !_chatExpanded) return;
    requestChatMessages(0);
  }, CHAT_POLL_FALLBACK_MS);
}

var _feedSince = null;
var _feedTimer = null;

async function loadActivityFeed() {
  try {
    // Skip when the tab is hidden — keeps the render loop smooth.
    if (!_socialLiveShouldRun()) return;
    var url = '/api/activity/feed?limit=15' + (_feedSince ? '&since=' + encodeURIComponent(_feedSince) : '');
    var data = await _guardedJsonFetch('activity-feed', url, {minGap:20000, backoffMs:120000});
    if (!data) return;
    var events = data.events || [];
    if (!events.length) return;
    _feedSince = events[0].created_at;
    var container = document.getElementById('liveFeedList') || document.getElementById('liveFeed');
    if (!container) return;
    var empty = document.getElementById('liveFeedEmpty');
    if (empty) empty.remove();
    var icons = { claim: '📍', harvest: '⛏', battle: '⚔', build: '⚓' };
    var labels = { claim: '영토 확보', harvest: '채굴', battle: '전투 승리', build: '함선 건조' };
    events.forEach(function(e) {
      var el = document.createElement('div');
      el.className = 'feed-item feed-new';
      var icon = icons[e.type] || '•';
      var label = labels[e.type] || e.type;
      var escFn = typeof _escapeHtmlSafe === 'function' ? _escapeHtmlSafe : (typeof _escapeHtml === 'function' ? _escapeHtml : function(s){ return String(s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); });
      var agoFn = typeof _timeAgo === 'function' ? _timeAgo : function(d){ var s=Math.floor((Date.now()-d)/1000); return s<60?s+'s ago':Math.floor(s/60)+'m ago'; };
      var ago = agoFn(new Date(e.created_at));
      el.innerHTML = '<span class="feed-icon">' + icon + '</span>'
        + '<span class="feed-text"><b>' + escFn(e.actor || '?') + '</b> ' + label
        + (e.target ? ' <span class="feed-target">' + escFn(e.target) + '</span>' : '')
        + (e.meta ? ' <span class="feed-meta">(' + escFn(e.meta) + ')</span>' : '')
        + '</span><span class="feed-time">' + ago + '</span>';
      container.insertBefore(el, container.firstChild);
      setTimeout(function(){ el.classList.remove('feed-new'); }, 300);
    });
    while (container.children.length > 30) container.removeChild(container.lastChild);
  } catch(e) {}
}

function startFeedPolling() {
  if (!_socialLiveShouldRun()) return;
  if (_feedTimer) _clearActiveInterval(_feedTimer);
  loadActivityFeed();
  // WebSocket 푸시(broadcastFeed)가 즉시 갱신 → 폴링은 폴백 15s (소스 일부만 WS 연결됨).
  _feedTimer = _setActiveInterval(function(){
    if (!_socialLiveShouldRun()) return;
    if (_liveWSIsOpen()) return;
    loadActivityFeed();
  }, 15000);
}

function startSocialLive() {
  if (!_socialLiveShouldRun()) return;
  try { if (_chatPollTimer) requestChatMessages(0); else startChatPolling(); } catch (_) {}
  try { if (_feedTimer) loadActivityFeed(); else startFeedPolling(); } catch (_) {}
  try { connectLiveWS(); } catch (_) {}
}

// ── 실시간 라이브 WebSocket (/ws/live) — 채팅/피드 즉시 갱신 ──
// WS 메시지는 "즉시 fetch 트리거(poke)"로만 쓴다 → 기존 렌더/커서 중복제거 로직 재사용.
// 연결 실패/끊김 시 위 폴링 폴백이 계속 동작하므로 안전.
var _liveWS = null, _liveWSRetry = 0, _liveWSTimer = null;
function _liveWSIsOpen() {
  return !!(_liveWS && _liveWS.readyState === 1);
}
function _liveWSSubscribe() {
  if (!_liveWS || _liveWS.readyState !== 1) return;
  try {
    _liveWS.send(JSON.stringify({ type: 'sub', channels: [ (typeof _chatChannel!=='undefined'?_chatChannel:'global'), 'feed' ] }));
  } catch (_) {}
}
function connectLiveWS() {
  if (!_socialLiveShouldRun()) return;
  try {
    if (_liveWS && (_liveWS.readyState === 0 || _liveWS.readyState === 1)) return;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var tok = '';
    try { tok = localStorage.getItem('pw_token') || ''; } catch (_) {}
    _liveWS = new WebSocket(proto + '//' + location.host + '/ws/live' + (tok ? ('?token=' + encodeURIComponent(tok)) : ''));
    _liveWS.onopen = function(){ _liveWSRetry = 0; _liveWSSubscribe(); };
    _liveWS.onmessage = function(ev){
      // [v7.170 G-Crit-1 fix] WS 핸들러 보강 — 서버 송신 8 타입 중 chat/feed 2종만 처리하던 결함.
      //   cmd_err/error/notification 추가 처리 → 함대 명령 실패·알림이 사일런트로 묻히던 문제 해소.
      //   battle frame/end 는 battle viewer iframe 이 별도 처리하므로 여기선 명시 무시.
      var d = null; try { d = JSON.parse(ev.data); } catch(_) { return; }
      if (!d || !d.type) return;
      if (d.type === 'chat') {
        // 서버 push payload를 바로 렌더한다. GET 재호출은 30s fallback poll에 맡겨 429 위험을 낮춘다.
        if (d.channel === (typeof _chatChannel!=='undefined'?_chatChannel:'global') && d.message) { try { _appendChatMessages([d.message]); } catch(_){} }
      } else if (d.type === 'feed') {
        try { loadActivityFeed(); } catch(_){}
      } else if (d.type === 'cmd_err' || d.type === 'error') {
        // 함대 명령 / 일반 오류 — 토스트로 즉시 안내(이전엔 silent 무시였음)
        try { showToast(d.message || d.error || tl('Command failed','명령 실패','コマンド失敗','命令失败'), 'error'); } catch(_){}
      } else if (d.type === 'notification') {
        // 서버가 직접 푸시한 알림 — polling 갱신
        try { if (typeof loadNotifications === 'function') loadNotifications(); } catch(_){}
      } else if (d.type === 'frame' || d.type === 'end' || d.type === 'cmd_ok' || d.type === 'pong' || d.type === 'hello') {
        // 무시 — battle viewer iframe 이 자체 수신/처리
      }
    };
    _liveWS.onclose = function(){
      if (!_socialLiveShouldRun()) return;
      // 지수 백오프 재연결 (최대 30s)
      _liveWSRetry = Math.min(_liveWSRetry + 1, 6);
      if (_liveWSTimer) _clearActiveTimeout(_liveWSTimer);
      _liveWSTimer = _setActiveTimeout(function(){
        _liveWSTimer = null;
        if (_socialLiveShouldRun()) connectLiveWS();
      }, Math.min(1000 * Math.pow(2, _liveWSRetry), 30000));
    };
    _liveWS.onerror = function(){ try { _liveWS.close(); } catch(_){} };
  } catch (_) {}
}
_onPageVisible(function() {
  if (!_socialLiveShouldRun()) return;
  try { if (_chatPollTimer) requestChatMessages(0); else startChatPolling(); } catch(_) {}
  try { if (_feedTimer) loadActivityFeed(); else startFeedPolling(); } catch(_) {}
  try { connectLiveWS(); } catch(_) {}
});
_onPageHidden(function() {
  if (_liveWSTimer) { _clearActiveTimeout(_liveWSTimer); _liveWSTimer = null; }
  try { if (_liveWS) _liveWS.close(1000, 'hidden'); } catch(_) {}
  _liveWS = null;
});

// ── END CHAT SYSTEM ───────────────────────────────────────────
