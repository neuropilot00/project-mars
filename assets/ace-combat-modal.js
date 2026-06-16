/* ACE Combat entry-point module — fullscreen iframe overlay launcher.
   Mirrors assets/tactical-lab-modal.js (buildTacticalLabUrl / open / close /
   escape / unload). Read-only: passes bid so ace-combat.html can fetch the
   real fleet composition via GET /api/tactical-lab/fleet-presets?bid=. Never
   writes battle/economy state. ace-combat.html is NOT modified by this file. */
(function () {
  'use strict';

  function getLang() {
    return typeof LANG !== 'undefined' ? LANG : 'en';
  }

  function getAceAssetVersion() {
    return typeof ASSET_VER !== 'undefined' ? ASSET_VER : '7466';
  }

  // Mirror of buildTacticalLabUrl: same contract shape.
  // /assets/ace-combat.html?mode={battle|demo}&lang=&v=&t=[&bid=N][&wallet=0x..]
  function buildAceCombatUrl(opts) {
    opts = opts || {};
    var params = new URLSearchParams();
    var lang = typeof normalizeLang === 'function' ? normalizeLang(getLang()) : getLang();
    var bid = parseInt(opts.battleId, 10);
    var hasBattle = Number.isFinite(bid) && bid > 0;
    params.set('mode', hasBattle ? 'battle' : 'demo');
    params.set('lang', lang);
    params.set('v', getAceAssetVersion());
    params.set('t', Date.now());
    if (hasBattle) params.set('bid', String(bid));
    if (opts.wallet) params.set('wallet', String(opts.wallet).toLowerCase());
    return '/assets/ace-combat.html?' + params.toString();
  }

  function getAceCombatModalElements() {
    var backdrop = document.getElementById('aceCombatBackdrop');
    return {
      backdrop: backdrop,
      frame: document.getElementById('aceCombatFrame'),
      title: backdrop && backdrop.querySelector('.ace-title'),
      sub: backdrop && backdrop.querySelector('.ace-sub'),
      close: backdrop && backdrop.querySelector('.ace-close')
    };
  }

  function syncAceCombatModalText(elements) {
    try {
      if (typeof t === 'function') {
        if (elements.title) elements.title.textContent = t('ace_title');
        if (elements.sub) elements.sub.textContent = t('ace_sub');
        if (elements.close) elements.close.textContent = t('ace_close');
      }
    } catch (_) {}
  }

  function unloadAceFrame(frame) {
    if (!frame) return;
    // about:blank tears down WebGL context / rAF / WebAudio so the game
    // stops running after close.
    try { frame.src = 'about:blank'; } catch (_) {}
  }

  function openAceCombat(battleId) {
    var elements = getAceCombatModalElements();
    if (!elements.backdrop) return;
    var wallet = '';
    try {
      if (typeof walletState !== 'undefined' && walletState && walletState.address) {
        wallet = String(walletState.address).toLowerCase();
      }
    } catch (_) {}
    if (elements.frame) {
      elements.frame.src = buildAceCombatUrl({ battleId: battleId, wallet: wallet });
    }
    syncAceCombatModalText(elements);
    elements.backdrop.classList.add('active');
  }

  function closeAceCombat() {
    var elements = getAceCombatModalElements();
    if (!elements.backdrop) return;
    elements.backdrop.classList.remove('active');
    unloadAceFrame(elements.frame);
  }

  function handleAceEscape(e) {
    var elements = getAceCombatModalElements();
    if (e.key === 'Escape' && elements.backdrop && elements.backdrop.classList.contains('active')) {
      closeAceCombat();
    }
  }

  // ── ACE honor: cosmetic title localization (mirrors server TITLE_DEFINITIONS) ──
  var ACE_TITLE_NAMES = {
    ace_recruit: { en: 'ACE RECRUIT', ko: '에이스 신병', ja: 'エース新兵', zh: '王牌新兵' },
    ace_pilot:   { en: 'ACE PILOT', ko: '에이스 파일럿', ja: 'エースパイロット', zh: '王牌飞行员' },
    ace_veteran: { en: 'ACE VETERAN', ko: '에이스 베테랑', ja: 'エースベテラン', zh: '王牌老兵' },
    top_gun:     { en: 'TOP GUN', ko: '톱건', ja: 'トップガン', zh: '头号王牌' },
    ace_ace:     { en: 'DOUBLE ACE', ko: '더블 에이스', ja: 'ダブルエース', zh: '双料王牌' }
  };

  function aceL(en, ko, ja, zh) {
    var l = getLang();
    if (l === 'ko') return ko; if (l === 'ja') return ja; if (l === 'zh') return zh;
    return en;
  }

  function aceTitleLabel(code) {
    var m = ACE_TITLE_NAMES[code];
    if (!m) return String(code || '').toUpperCase();
    var l = getLang();
    return m[l] || m.en;
  }

  function aceAuthToken() {
    try { return localStorage.getItem('pw_token') || ''; } catch (_) { return ''; }
  }

  // In-game cosmetic result overlay (§18: no native dialog). Reuses ace HUD center area.
  function showAceResult(payload, stats, titlesAwarded) {
    var overlay = document.getElementById('aceResultOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aceResultOverlay';
      overlay.style.cssText = [
        'position:absolute', 'inset:0', 'z-index:30', 'display:grid',
        'place-items:center', 'pointer-events:auto', 'text-align:center',
        'background:radial-gradient(circle,rgba(0,20,28,.55),rgba(0,0,0,.82))',
        'color:#e8fff6', 'font-family:Consolas,Monaco,"Courier New",monospace'
      ].join(';');
      var host = document.getElementById('aceCombatBackdrop') || document.body;
      host.appendChild(overlay);
    }
    var won = payload && payload.outcome === 'win';
    // Prefer server-clamped run values when present.
    var runKills = 0, runDur = 0;
    try {
      if (payload && payload.clamped) { runKills = payload.clamped.kills; runDur = payload.clamped.durationSec; }
      else if (payload) { runKills = parseInt(payload.kills, 10) || 0; runDur = parseInt(payload.durationSec, 10) || 0; }
    } catch (_) {}
    var totalKills = parseInt(stats && stats.total_kills, 10) || 0;
    var totalWins = parseInt(stats && stats.total_wins, 10) || 0;
    var titlesHtml = '';
    if (titlesAwarded && titlesAwarded.length) {
      titlesHtml = '<div style="margin-top:14px;color:#ffe15d;font-size:14px">'
        + aceL('TITLE EARNED', '획득 칭호', '獲得称号', '获得称号') + '</div>'
        + '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
        + titlesAwarded.map(function (c) {
            return '<span style="border:1px solid rgba(255,225,93,.5);border-radius:5px;'
              + 'padding:4px 10px;color:#ffe15d;font-size:13px">✦ '
              + escapeAceHtml(aceTitleLabel(c)) + '</span>';
          }).join('')
        + '</div>';
    }
    overlay.innerHTML =
      '<div style="max-width:520px;padding:24px">'
      + '<div style="font-size:clamp(26px,4vw,52px);color:' + (won ? '#39ff83' : '#ff6f6f') + ';'
      + 'text-shadow:0 0 18px rgba(0,255,220,.6)">'
      + (won ? aceL('MISSION COMPLETE', '작전 완료', 'ミッション完了', '任务完成')
             : aceL('SHOT DOWN', '격추됨', '撃墜', '被击落')) + '</div>'
      + '<div style="margin-top:14px;font-size:15px;color:#9dffe8;line-height:1.9">'
      + aceL('Kills', '격추', '撃墜', '击落') + ': <b>' + runKills + '</b><br>'
      + aceL('Flight time', '비행 시간', '飛行時間', '飞行时间') + ': <b>' + runDur + 's</b>'
      + '</div>'
      + '<div style="margin-top:10px;font-size:12px;color:#6fdcc4">'
      + aceL('Career', '누적', '通算', '生涯') + ' — '
      + aceL('Kills', '격추', '撃墜', '击落') + ' ' + totalKills + ' · '
      + aceL('Wins', '승', '勝', '胜') + ' ' + totalWins + '</div>'
      + titlesHtml
      + '<button id="aceResultClose" type="button" style="margin-top:22px;cursor:pointer;'
      + 'background:rgba(0,255,206,.12);border:1px solid rgba(0,255,206,.5);color:#bfffe9;'
      + 'border-radius:6px;padding:9px 22px;font-family:inherit;font-size:14px">'
      + aceL('CLOSE', '닫기', '閉じる', '关闭') + '</button>'
      + '</div>';
    overlay.style.display = 'grid';
    var closeBtn = document.getElementById('aceResultClose');
    if (closeBtn) {
      closeBtn.onclick = function () { overlay.style.display = 'none'; };
    }
  }

  function escapeAceHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── parent-side message hook ──
  // ace-combat.html posts {source:'ace-combat', cmd:'ready'|'ace_result', ...}.
  // Cosmetic-only: POST /api/ace/result records honor stats + awards titles. No economy.
  function handleAceMessage(ev) {
    if (ev.origin !== location.origin) return;
    var d = ev && ev.data;
    if (!d || d.source !== 'ace-combat') return;
    if (d.cmd === 'ready') { return; }
    if (d.cmd === 'ace_result') { submitAceResult(d); return; }
  }

  function submitAceResult(d) {
    var p = (d && d.payload) || {};
    var token = aceAuthToken();
    // demo + battle both require auth (server JWT-gates). No token → show local-only result.
    if (!token) { showAceResult(p, null, null); return; }
    var bid = parseInt(d.battleId, 10);
    var hasBattle = Number.isFinite(bid) && bid > 0;
    var body = {
      battleId: hasBattle ? bid : null,
      mode: hasBattle ? 'battle' : 'demo',
      outcome: p.outcome === 'win' ? 'win' : 'loss',
      kills: parseInt(p.kills, 10) || 0,
      durationSec: parseInt(p.durationSec, 10) || 0
    };
    fetch('/api/ace/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || res.error) { showAceResult(p, null, null); return; }
        // Merge server-clamped run values back into payload for accurate display.
        var merged = Object.assign({}, p);
        if (res.clamped) merged.clamped = res.clamped;
        var awarded = (res.titlesAwarded || []);
        showAceResult(merged, res.stats || null, awarded);
        if (awarded.length) {
          try {
            if (typeof showFactionToast === 'function') {
              showFactionToast(aceL('Title earned', '칭호 획득', '称号獲得', '获得称号')
                + ': ' + awarded.map(aceTitleLabel).join(', '), 'success');
            }
          } catch (_) {}
        }
      })
      .catch(function () { showAceResult(p, null, null); });
  }

  window.addEventListener('message', handleAceMessage);
  document.addEventListener('keydown', handleAceEscape);
  window.buildAceCombatUrl = buildAceCombatUrl;
  window.openAceCombat = openAceCombat;
  window.closeAceCombat = closeAceCombat;
  window.unloadAceFrame = unloadAceFrame;
})();
