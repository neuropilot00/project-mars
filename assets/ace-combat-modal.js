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
    return typeof ASSET_VER !== 'undefined' ? ASSET_VER : '7464';
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

  // ── parent-side message hook (stub) ──
  // ace-combat.html posts {source:'ace-combat', cmd:'ready'|'ace_result', ...}.
  // Score/economy wiring is a later step — this only logs. Never writes server state.
  function handleAceMessage(ev) {
    if (ev.origin !== location.origin) return;
    var d = ev && ev.data;
    if (!d || d.source !== 'ace-combat') return;
    if (d.cmd === 'ready') { console.log('[ace] ready', d.payload || {}); return; }
    if (d.cmd === 'ace_result') { console.log('[ace] result', d.payload || {}); return; }
  }

  window.addEventListener('message', handleAceMessage);
  document.addEventListener('keydown', handleAceEscape);
  window.buildAceCombatUrl = buildAceCombatUrl;
  window.openAceCombat = openAceCombat;
  window.closeAceCombat = closeAceCombat;
  window.unloadAceFrame = unloadAceFrame;
})();
