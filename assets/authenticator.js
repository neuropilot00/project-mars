(function () {
  'use strict';
  var text = window.MARS_AUTH_COPY;
  var lang = 'en', mode = 'login', enabled = false, busy = false, enrollment = null, deadline = 0, timer = null, generation = 0, statusKey = 'checking', statusError = false;
  var $ = function (id) { return document.getElementById(id); };
  function copy(key) { return (text[lang] && text[lang][key]) || text.en[key] || key; }
  function status(key, error) { statusKey = key; statusError = !!error; var el = $('authenticatorStatus'); el.textContent = copy(key); el.dataset.error = error ? 'true' : 'false'; }
  function setBusy(value) {
    busy = value;
    ['totpSubmit','totpVerify','totpActivate','recoveryDownload','totpRestart','totpCopyKey','authAvailabilityRetry','totpUsername','totpTos'].forEach(function (id) { $(id).disabled = value; });
    document.querySelectorAll('[data-mode]').forEach(function (el) { el.disabled = value || !!enrollment; });
  }
  function translate() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-copy]').forEach(function (el) { el.textContent = copy(el.dataset.copy); });
    $('totpRestart').textContent = copy('restart');
    $('totpQr').setAttribute('aria-label', copy('qrLabel'));
    $('authenticatorTabs').setAttribute('aria-label', copy('actions'));
    status(statusKey, statusError);
    if (!enrollment) $('totpSubmit').textContent = copy(mode === 'signup' ? 'signup' : mode === 'recover' ? 'recover' : 'login');
  }
  function clearPrivate() {
    enrollment = null; deadline = 0;
    if (timer) window.clearInterval(timer); timer = null;
    ['totpSetupKey','totpFirstCode','recoveryCodes','recoveryConfirmCode','totpRecoveryLoginCode','totpLoginCode'].forEach(function (id) { $(id).value = ''; });
    $('recoverySaved').checked = false;
    $('totpQr').width = 0; $('totpQr').height = 0;
    $('enrollmentPanel').hidden = true; $('recoveryPanel').hidden = true;
    $('enrollmentCountdown').hidden = true; $('totpRestart').hidden = true;
  }
  function showMode(value) {
    if (busy || enrollment) return;
    mode = value;
    $('loginCodeGroup').hidden = mode !== 'login';
    $('recoveryLoginGroup').hidden = mode !== 'recover';
    $('signupTerms').hidden = mode !== 'signup';
    $('totpLoginCode').required = mode === 'login';
    $('totpRecoveryLoginCode').required = mode === 'recover';
    document.querySelectorAll('[data-mode]').forEach(function (el) { el.setAttribute('aria-pressed', String(el.dataset.mode === mode)); });
    translate(); status('ready');
  }
  async function request(path, body) {
    var requestGeneration = generation;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout;
    try {
      return await Promise.race([
        fetch('/api/auth/totp/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type':'application/json' }, credentials:'same-origin', cache:'no-store', signal:controller ? controller.signal : undefined, body: JSON.stringify(body) }).then(async function (response) {
          var data = await response.json();
          if (requestGeneration !== generation) { var stale = new Error('abandoned_request'); stale.abandoned = true; throw stale; }
          if (!response.ok) { var err = new Error('request_failed'); err.status = response.status; throw err; }
          return data;
        }),
        new Promise(function (_, reject) { timeout = window.setTimeout(function () { if (controller) controller.abort(); reject(new Error('request_timeout')); }, 10000); })
      ]);
    } finally { if (timeout) window.clearTimeout(timeout); }
  }
  function fail(error) { if (error && error.abandoned) return; status(error && error.status === 429 ? 'wait' : error && error.status >= 500 ? 'offline' : error && error.status ? 'invalid' : 'offline', true); }
  function acceptSession(data) {
    if (!data || typeof data.token !== 'string' || !data.user || !/^0x[a-f0-9]{40}$/i.test(data.user.wallet || '')) throw new Error('invalid_session');
    clearPrivate();
    try { localStorage.setItem('pw_token', data.token); } catch (_) { $('authenticatorForm').hidden = !enabled; showMode('login'); status('storage', true); return; }
    status('savedSession'); window.location.assign('/');
  }
  function drawQr(uri) {
    var qr = window.qrcode(0, 'M'); qr.addData(uri, 'Byte'); qr.make();
    var count = qr.getModuleCount(), scale = 5, margin = 4, canvas = $('totpQr');
    canvas.width = canvas.height = (count + margin * 2) * scale;
    var ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas_unavailable');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (var y = 0; y < count; y++) for (var x = 0; x < count; x++) if (qr.isDark(y,x)) ctx.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
  }
  function receiveEnrollment(data) {
    if (!data || typeof data.enrollmentId !== 'string' || typeof data.enrollmentSecret !== 'string' || !/^[A-Z2-7]{32}$/.test(data.secret || '') || !/^otpauth:\/\/totp\//.test(data.otpauthUri || '')) throw new Error('invalid_enrollment');
    enrollment = { id:data.enrollmentId, secret:data.enrollmentSecret, confirmationNonce:null };
    deadline = Date.now() + Math.min(300, Math.max(1, Number(data.expiresIn) || 300)) * 1000;
    $('authenticatorForm').hidden = true; $('enrollmentPanel').hidden = false;
    $('enrollmentCountdown').hidden = false; $('totpRestart').hidden = false; $('totpQr').hidden = false;
    $('totpSetupKey').value = data.secret; status('pending');
    try { drawQr(data.otpauthUri); } catch (_) { $('totpQr').hidden = true; status('qrFallback'); }
    function tick() {
      var left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      $('enrollmentCountdown').textContent = left + copy('seconds');
      if (left === 0) { clearPrivate(); $('authenticatorForm').hidden = false; setBusy(false); status('expired', true); }
    }
    tick(); timer = window.setInterval(tick, 1000);
    if ($('totpFirstCode').focus) $('totpFirstCode').focus({ preventScroll:true });
  }
  async function submit(event) {
    event.preventDefault(); if (!enabled || busy || enrollment) return;
    if (mode === 'signup' && !$('totpTos').checked) { status('tos', true); return; }
    setBusy(true); status('working');
    try {
      var username = $('totpUsername').value.trim().toLowerCase();
      if (mode === 'signup') receiveEnrollment(await request('enroll/start', { username:username, tosAccepted:true }));
      else if (mode === 'recover') receiveEnrollment(await request('recover', { username:username, recoveryCode:$('totpRecoveryLoginCode').value }));
      else acceptSession(await request('login', { username:username, code:$('totpLoginCode').value }));
      $('totpLoginCode').value = ''; $('totpRecoveryLoginCode').value = '';
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function verify(event) {
    event.preventDefault(); if (!enrollment || busy || Date.now() >= deadline) return;
    setBusy(true); status('working');
    try {
      var data = await request('enroll/verify', { enrollmentId:enrollment.id, enrollmentSecret:enrollment.secret, code:$('totpFirstCode').value });
      if (!Array.isArray(data.recoveryCodes) || data.recoveryCodes.length < 2 || typeof data.confirmationNonce !== 'string') throw new Error('invalid_recovery_response');
      enrollment.confirmationNonce = data.confirmationNonce;
      $('recoveryCodes').value = data.recoveryCodes.join('\n'); $('totpSetupKey').value = ''; $('totpFirstCode').value = '';
      $('totpQr').width = 0; $('totpQr').height = 0; $('enrollmentPanel').hidden = true; $('recoveryPanel').hidden = false; status('save');
      if ($('recoveryPanel').focus) $('recoveryPanel').focus({ preventScroll:true });
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function activate(event) {
    event.preventDefault(); if (!enrollment || !enrollment.confirmationNonce || busy || Date.now() >= deadline) return;
    if (!$('recoverySaved').checked || !$('recoveryConfirmCode').value.trim()) { status('saveRequired', true); return; }
    setBusy(true); status('working');
    try { acceptSession(await request('enroll/activate', { enrollmentId:enrollment.id, enrollmentSecret:enrollment.secret, confirmationNonce:enrollment.confirmationNonce, recoveryCode:$('recoveryConfirmCode').value })); }
    catch (error) { fail(error); } finally { setBusy(false); }
  }
  function download() {
    if (!enrollment || !$('recoveryCodes').value) return;
    var content = 'OCCUPY MARS\nUsername: ' + $('totpUsername').value.trim() + '\nKeep offline. Each code is single-use. The confirmation code is consumed at signup.\n\n' + $('recoveryCodes').value + '\n';
    var href = URL.createObjectURL(new Blob([content], { type:'text/plain;charset=utf-8' }));
    var link = document.createElement('a'); link.href = href; link.download = 'occupy-mars-recovery-codes.txt'; link.click();
    window.setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
  }
  async function checkAvailability() {
    setBusy(true); status('checking'); $('authAvailabilityRetry').hidden = true;
    try { var config = await request('config'); enabled = !!(config && config.enabled === true); status(enabled ? 'ready' : 'disabled'); }
    catch (error) { enabled = false; fail(error); $('authAvailabilityRetry').hidden = false; }
    finally { setBusy(false); }
    $('authenticatorTabs').hidden = !enabled; $('authenticatorForm').hidden = !enabled;
    if (enabled) showMode('login');
  }
  async function init() {
    var selected = new URLSearchParams(window.location.search).get('lang');
    if (text[selected]) lang = selected;
    else if (navigator.language && text[navigator.language.slice(0,2)]) lang = navigator.language.slice(0,2);
    $('authLanguage').value = lang; translate(); status('checking');
    document.querySelectorAll('[data-mode]').forEach(function (el) { el.addEventListener('click', function () { showMode(el.dataset.mode); }); });
    $('authLanguage').addEventListener('change', function () { if (text[this.value]) { lang = this.value; translate(); } });
    $('authenticatorForm').addEventListener('submit', submit); $('enrollmentVerifyForm').addEventListener('submit', verify); $('enrollmentActivateForm').addEventListener('submit', activate);
    $('recoveryDownload').addEventListener('click', download);
    $('authAvailabilityRetry').addEventListener('click', checkAvailability);
    $('totpCopyKey').addEventListener('click', async function () {
      if (!enrollment || busy || !$('totpSetupKey').value) return;
      try { await navigator.clipboard.writeText($('totpSetupKey').value); status('keyCopied'); }
      catch (_) { $('totpSetupKey').focus(); $('totpSetupKey').select(); status('copyFailed'); }
    });
    $('totpRestart').addEventListener('click', function () {
      if (busy) return;
      clearPrivate(); setBusy(false); mode = 'login'; $('authenticatorForm').hidden = !enabled; showMode('login');
    });
    window.addEventListener('pagehide', function () { generation++; clearPrivate(); });
    window.addEventListener('pageshow', function (event) {
      if (!event.persisted) return;
      // BFCache restores the old DOM, including hidden forms and disabled tabs.
      // Restart with no secrets or stale in-flight results and recheck availability.
      generation++; clearPrivate(); enabled = false; mode = 'login'; setBusy(false);
      $('authenticatorTabs').hidden = true; $('authenticatorForm').hidden = true;
      checkAvailability();
    });
    await checkAvailability();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
}());
