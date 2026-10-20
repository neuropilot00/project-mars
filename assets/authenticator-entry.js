(function () {
  'use strict';
  function refreshAuthenticatorEntry() {
    var entry = document.getElementById('authenticatorEntry');
    if (!entry || entry.hidden) return;
      entry.href = '/authenticator.html?lang=' + encodeURIComponent(typeof LANG === 'string' ? LANG : document.documentElement.lang || 'en');
      entry.textContent = typeof tl === 'function' ? tl('Username + Google Authenticator (no email)', '아이디 + Google Authenticator (이메일 불필요)', 'ID＋Google Authenticator（メール不要）', '用户名＋Google Authenticator（无需邮箱）', 'Nama pengguna + Google Authenticator (tanpa email)', 'Tên người dùng + Google Authenticator (không cần email)', 'ชื่อผู้ใช้ + Google Authenticator (ไม่ต้องใช้อีเมล)') : 'Username + Google Authenticator (no email)';
  }
  window.refreshAuthenticatorEntry = refreshAuthenticatorEntry;
  function init() {
    var legal = new URLSearchParams(window.location.search).get('legal');
    if (legal === 'terms' && typeof openTosModal === 'function') openTosModal();
    if (legal === 'privacy' && typeof openPrivacyModal === 'function') openPrivacyModal();
    if (new URLSearchParams(window.location.search).get('login') === '1' && typeof openAuthModal === 'function') openAuthModal();
    var entry = document.getElementById('authenticatorEntry');
    if (!entry) return;
    fetch('/api/auth/totp/config', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (config) {
      if (!config || config.enabled !== true) return;
      entry.hidden = false; entry.style.display = 'block';
      refreshAuthenticatorEntry();
    }).catch(function () { /* Existing login remains available. */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
}());
