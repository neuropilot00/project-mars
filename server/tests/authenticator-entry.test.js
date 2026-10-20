'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../assets/authenticator-entry.js'), 'utf8');
function fixture({ enabled = false, ok = true, fails = false, lang = 'en' } = {}) {
  const entry = { hidden: true, style: { display: 'none' }, href: '/authenticator.html', textContent: '' };
  const languages = ['en', 'ko', 'ja', 'zh', 'id', 'vi', 'th'];
  const calls = [];
  const context = {
    window: { location: { search: '' } }, LANG: lang, URLSearchParams,
    document: { readyState: 'complete', documentElement: { lang }, getElementById: id => id === 'authenticatorEntry' ? entry : null },
    tl: (...values) => values[languages.indexOf(context.LANG)],
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fails) throw new Error('fixture unavailable');
      return { ok, json: async () => ({ enabled }) };
    }
  };
  vm.runInNewContext(source, context);
  return { entry, calls, context, settle: () => new Promise(resolve => setImmediate(resolve)) };
}
test('public authenticator entry stays hidden when disabled, unavailable or rejected', async () => {
  for (const options of [{ enabled: false }, { enabled: true, ok: false }, { fails: true }]) {
    const f = fixture(options); await f.settle();
    assert.equal(f.entry.hidden, true); assert.equal(f.entry.style.display, 'none');
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, '/api/auth/totp/config');
    assert.equal(f.calls[0].options.cache, 'no-store');
  }
});
test('enabled entry names Google Authenticator and keeps selected language in all seven locales', async () => {
  for (const lang of ['en', 'ko', 'ja', 'zh', 'id', 'vi', 'th']) {
    const f = fixture({ enabled: true, lang }); await f.settle();
    assert.equal(f.entry.hidden, false); assert.equal(f.entry.style.display, 'block');
    assert.equal(f.entry.href, '/authenticator.html?lang=' + lang);
    assert.match(f.entry.textContent, /Google Authenticator/); assert.ok(f.entry.textContent.length > 20);
  }
});
test('visible entry follows an in-game language change without another request', async () => {
  const f = fixture({ enabled: true }); await f.settle();
  f.context.LANG = 'ko'; f.context.window.refreshAuthenticatorEntry();
  assert.equal(f.entry.href, '/authenticator.html?lang=ko'); assert.match(f.entry.textContent, /이메일 불필요/);
  assert.equal(f.calls.length, 1);
});
