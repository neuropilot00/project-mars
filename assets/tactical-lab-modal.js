(function () {
  'use strict';

  function getLang() {
    return typeof LANG !== 'undefined' ? LANG : 'en';
  }

  function getTacticalLabAssetVersion() {
    return typeof ASSET_VER !== 'undefined' ? ASSET_VER : '7407';
  }

  function buildTacticalLabUrl(opts) {
    opts = opts || {};
    var params = new URLSearchParams();
    var lang = typeof normalizeLang === 'function' ? normalizeLang(getLang()) : getLang();
    params.set('mode', opts.mode || (opts.battleId ? 'battle' : 'sandbox'));
    params.set('lang', lang);
    params.set('v', getTacticalLabAssetVersion());
    params.set('t', Date.now());
    if (opts.battleId) params.set('bid', String(parseInt(opts.battleId)));
    if (opts.wallet) params.set('wallet', String(opts.wallet).toLowerCase());
    if (opts.bg) params.set('bg', String(opts.bg));
    if (opts.startTick && Number.isFinite(Number(opts.startTick)) && Number(opts.startTick) > 0) {
      params.set('startTick', String(Math.floor(Number(opts.startTick))));
    }
    return '/assets/tactical-lab-v11.html?' + params.toString();
  }

  function pickBattlefieldKey(battleId) {
    var keys = [
      'orbit_territory',
      'garrison',
      'mining_site',
      'canyon_outpost',
      'polar_ice',
      'lava_tube',
      'crater_relay',
      'refinery_yard'
    ];
    var n = Math.abs(parseInt(battleId, 10) || 0);
    return keys[n % keys.length];
  }

  function unloadTacticalLabFrame(frame) {
    if (!frame) return;
    try { frame.src = 'about:blank'; } catch (_) {}
  }

  function showBattleToast(message, type) {
    if (typeof showFactionToast === 'function') showFactionToast(message, type);
  }

  function bvFinalizeResult() {
    try {
      if (typeof bv === 'undefined') return;
      if (bv._finalShown) return;
      bv._finalShown = true;
      if (bv._finalFallback) {
        clearTimeout(bv._finalFallback);
        bv._finalFallback = null;
      }
      if (typeof showBattleResult === 'function') showBattleResult();
    } catch (_) {}
  }

  function handleTacticalLabForfeitMessage(d) {
    var lang = getLang();
    if (!d.payload || d.payload.success !== true) {
      var forfeitErr = (d.payload && d.payload.error) || 'FORFEIT_FAILED';
      showBattleToast((lang === 'ko' ? '후퇴 실패: ' : lang === 'ja' ? '撤退失敗: ' : lang === 'zh' ? '撤退失败: ' : 'Retreat failed: ') + forfeitErr, 'error');
      console.warn('[battle] forfeit failed:', d);
      return;
    }
    if (typeof closeBattleViewer === 'function') closeBattleViewer();
    showBattleToast(lang === 'ko' ? '🏳 후퇴 완료 — 조선소에서 함선을 수리하세요' : lang === 'ja' ? '🏳 撤退完了 — 造船所で艦船を修理してください' : lang === 'zh' ? '🏳 撤退完成 — 请在船坞修理舰船' : '🏳 Retreat complete — repair ships at shipyard', 'info');
    setTimeout(function () {
      if (typeof openShipyard === 'function') openShipyard();
      setTimeout(function () {
        if (typeof switchSyTab === 'function') switchSyTab('fleet');
      }, 200);
    }, 800);
  }

  function applyTacticalLabBattleEndPayload(d) {
    try {
      if (typeof bv === 'undefined') return;
      bv.battle = bv.battle || {};
      if (!d.payload) return;
      if (d.cmd === 'ws_end') {
        bv.battle.winner_side = d.payload.winner_side || bv.battle.winner_side;
        bv.battle.duration_seconds = d.payload.duration_seconds;
        if (d.payload.stats) {
          bv.battle.atk_ships_total = d.payload.stats.atk?.ships_total || bv.battle.atk_ships_total;
          bv.battle.atk_ships_lost = d.payload.stats.atk?.ships_lost || 0;
          bv.battle.def_ships_total = d.payload.stats.def?.ships_total || bv.battle.def_ships_total;
          bv.battle.def_ships_lost = d.payload.stats.def?.ships_lost || 0;
          bv.battle.battle_summary = { atk: d.payload.stats.atk, def: d.payload.stats.def };
        }
      } else if (!bv.battle.winner_side && d.payload.winner_side) {
        bv.battle.winner_side = d.payload.winner_side;
      }
    } catch (_) {}
  }

  function handleTacticalLabBattleEndMessage(d) {
    applyTacticalLabBattleEndPayload(d);
    if (d.cmd === 'battle_final_done') {
      bvFinalizeResult();
    } else if (typeof bv !== 'undefined' && !bv._finalShown && !bv._finalFallback) {
      bv._finalFallback = setTimeout(bvFinalizeResult, 25000);
    }
  }

  function getTacticalLabCommandLabel(cmd) {
    var lang = getLang();
    var labels = {
      formation: lang === 'ko' ? '🛡 진형' : lang === 'ja' ? '🛡 陣形' : lang === 'zh' ? '🛡 阵型' : '🛡 Formation',
      maneuver: lang === 'ko' ? '→ 기동' : lang === 'ja' ? '→ 機動' : lang === 'zh' ? '→ 机动' : '→ Maneuver',
      focus: lang === 'ko' ? '⚡ 집중공격' : lang === 'ja' ? '⚡ 集中攻撃' : lang === 'zh' ? '⚡ 集中攻击' : '⚡ Focus Fire',
      emp: '💥 EMP'
    };
    return labels[cmd] || cmd;
  }

  function submitTacticalLabCommanderAction(d) {
    var actionMap = {
      formation: { actionType: 'formation_change', params: { formation: d.payload && d.payload.formation } },
      maneuver: { actionType: 'maneuver_change', params: { maneuver: d.payload && d.payload.maneuver } },
      focus: { actionType: 'focus_fire', params: { targetFleetId: d.payload && (d.payload.targetFleetId || d.payload.target) } },
      emp: { actionType: 'emp', params: { startTick: d.payload && d.payload.startTick } },
      beam_cannon: { actionType: 'beam', params: {} },
      missile_barrage: { actionType: 'missile', params: {} }
    };
    var mapped = actionMap[d.cmd];
    if (!mapped) return;
    fetch('/api/battles/' + d.battleId + '/commander-action', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({
        action_type: mapped.actionType,
        params: mapped.params || {}
      })
    }).then(function (r) {
      var lang = getLang();
      var label = getTacticalLabCommandLabel(d.cmd);
      if (r.ok) {
        showBattleToast(label + (lang === 'ko' ? ' 명령 적용' : lang === 'ja' ? ' コマンド適用' : lang === 'zh' ? ' 命令已执行' : ' applied'), 'success');
      } else if (r.status === 401 || r.status === 403) {
        showBattleToast(label + (lang === 'ko' ? ' — 로그인 또는 권한 필요' : lang === 'ja' ? ' — ログインまたは権限が必要' : lang === 'zh' ? ' — 需要登录或权限' : ' — login or permission required'), 'error');
      } else {
        showBattleToast(label + (lang === 'ko' ? ' 명령 실패 (' : lang === 'ja' ? ' コマンド失敗 (' : lang === 'zh' ? ' 命令失败 (' : ' failed (') + r.status + ')', 'error');
        console.warn('[battle-cmd] API failed:', r.status, d);
      }
    }).catch(function (e) {
      console.warn('[battle-cmd] fetch error:', e.message);
    });
  }

  function handleTacticalLabMessage(ev) {
    if (ev.origin !== location.origin) return;
    var d = ev && ev.data;
    if (!d || d.source !== 'tactical-lab' || d.cmd === 'ready' || !d.battleId) return;
    if (d.cmd === 'forfeit') return handleTacticalLabForfeitMessage(d);
    if (d.cmd === 'ws_end' || d.cmd === 'battle_final_done') return handleTacticalLabBattleEndMessage(d);
    submitTacticalLabCommanderAction(d);
  }

  function getTacticalLabModalElements() {
    var backdrop = document.getElementById('tacticalLabBackdrop');
    return {
      backdrop: backdrop,
      frame: document.getElementById('tacticalLabFrame'),
      title: backdrop && backdrop.querySelector('.tlab-title'),
      sub: backdrop && backdrop.querySelector('.tlab-sub'),
      close: backdrop && backdrop.querySelector('.tlab-close')
    };
  }

  function syncTacticalLabModalText(elements) {
    try {
      if (elements.title) elements.title.textContent = t('tlab_title');
      if (elements.sub) elements.sub.textContent = t('tlab_sub');
      if (elements.close) elements.close.textContent = t('tlab_close');
    } catch (_) {}
  }

  function openTacticalLab() {
    var elements = getTacticalLabModalElements();
    if (!elements.backdrop) return;
    if (elements.frame) elements.frame.src = buildTacticalLabUrl({ mode: 'sandbox', bg: pickBattlefieldKey(Date.now()) });
    syncTacticalLabModalText(elements);
    elements.backdrop.classList.add('active');
  }

  function closeTacticalLab() {
    var elements = getTacticalLabModalElements();
    if (!elements.backdrop) return;
    elements.backdrop.classList.remove('active');
    unloadTacticalLabFrame(elements.frame);
  }

  function handleTacticalLabEscape(e) {
    var elements = getTacticalLabModalElements();
    if (e.key === 'Escape' && elements.backdrop && elements.backdrop.classList.contains('active')) closeTacticalLab();
  }

  window.addEventListener('message', handleTacticalLabMessage);
  document.addEventListener('keydown', handleTacticalLabEscape);
  window.buildTacticalLabUrl = buildTacticalLabUrl;
  window.pickBattlefieldKey = pickBattlefieldKey;
  window.unloadTacticalLabFrame = unloadTacticalLabFrame;
  window.openTacticalLab = openTacticalLab;
  window.closeTacticalLab = closeTacticalLab;
})();
