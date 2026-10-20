'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../assets/main-game.js'), 'utf8');
const lore = source.slice(source.indexOf('var _loreReturnFocus = null;'), source.indexOf('\n/* ══════════════════════════════════════════════════\n   Email Auth System'));

// Deliberately small DOM double: lifecycle/keyboard tests, not layout or accessibility proof.
function fixture({ reducedMotion = false, serverData = null } = {}) {
  const listeners = new Map();
  const document = { activeElement: null };
  function eventTarget(target) {
    target.addEventListener = (type, callback) => {
      if (!listeners.has(target)) listeners.set(target, new Map());
      if (!listeners.get(target).has(type)) listeners.get(target).set(type, new Set());
      listeners.get(target).get(type).add(callback);
    };
    target.removeEventListener = (type, callback) => listeners.get(target)?.get(type)?.delete(callback);
    target.dispatch = (type, event = {}) => {
      for (const callback of [...(listeners.get(target)?.get(type) || [])]) callback({ target, ...event });
    };
  }
  class Element {
    constructor(tag, id) {
      this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.style = {};
      this.attributes = new Map(); this.className = ''; this.textContent = ''; this.disabled = false;
      this.tabIndex = tag === 'button' || tag === 'summary' ? 0 : -1;
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: name => { if (!this.classList.contains(name)) this.className = (this.className + ' ' + name).trim(); },
        remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); },
        toggle: (name, force) => force ? this.classList.add(name) : this.classList.remove(name)
      };
      eventTarget(this);
    }
    set innerHTML(html) { this.html = html; this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    hasAttribute(key) { return this.attributes.has(key); }
    contains(child) { return child === this || this.children.some(item => item.contains(child)); }
    closest(selector) { return selector === '[inert]' && this.hasAttribute('inert') ? this : this.parentElement?.closest(selector) || null; }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    getClientRects() {
      for (let branch = this; branch; branch = branch.parentElement) {
        if (branch.style.display === 'none') return [];
        const parent = branch.parentElement;
        if (parent?.tagName === 'DETAILS' && !parent.hasAttribute('open') &&
            !(branch.tagName === 'SUMMARY' && parent.children[0] === branch)) return [];
      }
      return [{}];
    }
    focus() { document.activeElement = this; }
    querySelectorAll(selector) {
      const matches = child => selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName === 'BUTTON' || child.tabIndex >= 0;
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  eventTarget(document);
  document.body = new Element('body');
  const background = document.body.appendChild(new Element('div', 'background'));
  const title = background.appendChild(new Element('button', 'title'));
  const alreadyInert = document.body.appendChild(new Element('div', 'alreadyInert'));
  alreadyInert.setAttribute('inert', 'existing-modal');
  const portal = document.body.appendChild(new Element('div', 'portal'));
  const portalSibling = portal.appendChild(new Element('div', 'portalSibling'));
  const bg = portal.appendChild(new Element('div', 'loreBg'));
  const ids = new Map([['loreBg', bg]]);
  for (const id of ['loreStars', 'loreIntro', 'loreBigTitle', 'loreCrawl', 'loreSkipBtn']) {
    const element = new Element(id === 'loreSkipBtn' ? 'button' : 'div', id);
    ids.set(id, element);
    (id === 'loreCrawl' ? bg.appendChild(new Element('div', 'crawlWrap')) : bg).appendChild(element);
  }
  document.getElementById = id => ids.get(id);
  document.createElement = tag => new Element(tag);
  title.focus();
  const motion = { matches: reducedMotion }; eventTarget(motion);
  const context = { document, window: { matchMedia: () => motion }, LANG: 'en', _loreCrawlData: serverData,
    tl: en => en,
    t: key => ({ lore_era: 'Original era', lore_title: 'OCCUPY MARS', lore_tagline: 'Original tagline', lore_body: '<p>Original story</p>', lore_close: 'ENTER MARS' })[key] };
  vm.runInNewContext(lore, context);
  return { context, document, bg, title, background, alreadyInert, portalSibling, motion, ids,
    listenerCount: (target, type) => listeners.get(target)?.get(type)?.size || 0,
    finish: (event = {}) => ids.get('loreCrawl').dispatch('animationend', { animationName: 'loreCrawl', ...event }) };
}

test('natural crawl end, close, and repeated reopening remove finale and restore focus/background state', () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) {
    f.context.showLorePopup();
    assert.equal(f.bg.querySelector('.lore-finale'), null);
    assert.equal(f.document.activeElement, f.ids.get('loreSkipBtn'));
    assert.ok(f.background.hasAttribute('inert')); assert.ok(f.portalSibling.hasAttribute('inert'));
    assert.equal(f.ids.get('loreStars').children.length, 120);
    assert.equal(f.ids.get('loreCrawl').innerHTML, '<div class="lore-chapter">Original tagline</div><p>Original story</p>');
    f.finish(); f.finish();
    assert.equal(f.bg.querySelectorAll('.lore-finale').length, 1);
    assert.equal(f.document.activeElement.className, 'lore-enter');
    f.document.activeElement.dispatch('click');
    assert.equal(f.bg.querySelector('.lore-finale'), null);
    assert.equal(f.document.activeElement, f.title);
    assert.ok(!f.background.hasAttribute('inert')); assert.ok(!f.portalSibling.hasAttribute('inert'));
    assert.equal(f.alreadyInert.attributes.get('inert'), 'existing-modal');
    assert.equal(f.listenerCount(f.document, 'keydown'), 0);
    assert.equal(f.listenerCount(f.document, 'focusin'), 0);
    assert.equal(f.listenerCount(f.motion, 'change'), 0);
  }
});

test('open while already open resets finale without losing original focus or accumulating handlers', () => {
  const f = fixture(); f.context.showLorePopup(); f.finish(); f.context.showLorePopup();
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  assert.equal(f.listenerCount(f.document, 'keydown'), 1);
  assert.equal(f.listenerCount(f.ids.get('loreCrawl'), 'animationend'), 1);
  f.context.closeLorePopup(); assert.equal(f.document.activeElement, f.title);
});

test('Escape stops underlying handlers; Tab, reverse Tab and escaped focus stay inside dialog', () => {
  const f = fixture(); f.context.showLorePopup();
  for (const shiftKey of [false, true]) {
    let prevented = false, stopped = false;
    f.document.dispatch('keydown', { key: 'Tab', shiftKey, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.ok(prevented && stopped); assert.equal(f.document.activeElement, f.ids.get('loreSkipBtn'));
  }
  f.title.focus(); f.document.dispatch('focusin', { target: f.title });
  assert.equal(f.document.activeElement, f.ids.get('loreSkipBtn'));
  let prevented = false, stopped = false;
  f.document.dispatch('keydown', { key: 'Escape', preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
  assert.ok(prevented && stopped); assert.ok(!f.bg.classList.contains('open')); assert.equal(f.document.activeElement, f.title);
});

test('only actual crawl end completes animated story; skip detaches completion listener', () => {
  const f = fixture(); f.context.showLorePopup();
  f.finish({ animationName: 'loreTwinkle' }); f.finish({ target: f.ids.get('loreStars') });
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  f.context.closeLorePopup(); f.finish();
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  assert.equal(f.listenerCount(f.ids.get('loreCrawl'), 'animationend'), 0);
});

test('reduced motion keeps full story readable without automatic finale and reacts while open', () => {
  const f = fixture({ reducedMotion: true }); f.context.showLorePopup();
  assert.ok(f.bg.classList.contains('lore-static')); f.finish();
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  assert.match(f.ids.get('loreCrawl').innerHTML, /Original story/);
  f.motion.matches = false; f.motion.dispatch('change'); assert.ok(!f.bg.classList.contains('lore-static'));
  f.motion.matches = true; f.motion.dispatch('change'); assert.ok(f.bg.classList.contains('lore-static'));
  f.context.closeLorePopup();
});

test('enabling reduced motion after the finale reveals the complete story and restores a visible exit', () => {
  const f = fixture(); f.context.showLorePopup(); f.finish();
  f.motion.matches = true; f.motion.dispatch('change');
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  assert.equal(f.ids.get('loreCrawl').parentElement.hasAttribute('aria-hidden'), false);
  assert.equal(f.ids.get('loreSkipBtn').style.display, '');
  assert.equal(f.document.activeElement, f.ids.get('loreSkipBtn'));
  assert.match(f.ids.get('loreCrawl').innerHTML, /Original story/);
});

test('server story retains its own finale labels as text', () => {
  const f = fixture({ serverData: { en: { era_text: 'Server era', title_text: '<Server title>', tagline: 'Server tagline', body_html: '<p>Server body</p>', close_text: 'Go to Mars' } } });
  f.context.showLorePopup(); f.finish(); const finale = f.bg.querySelector('.lore-finale');
  assert.equal(finale.children[0].textContent, '<Server title>');
  assert.equal(finale.children[1].textContent, 'Server tagline');
  assert.equal(finale.children[2].textContent, 'Go to Mars');
});

test('crew chatter appears only after the story, starts closed, and joins keyboard navigation on demand', () => {
  const f = fixture(); f.context.showLorePopup();
  assert.equal(f.bg.querySelector('.lore-bonus'), null);
  f.finish();
  const bonus = f.bg.querySelector('.lore-bonus');
  assert.ok(bonus); assert.equal(bonus.hasAttribute('open'), false);
  assert.equal(bonus.querySelectorAll('.lore-bonus-entry').length, 3);
  assert.equal(f.context._loreFocusable().length, 2, 'exit and closed channel summary only');
  bonus.setAttribute('open', '');
  assert.equal(f.context._loreFocusable().length, 5, 'three individual optional records become focusable');
  const entry = bonus.querySelector('.lore-bonus-entry'); entry.setAttribute('open', '');
  f.context.closeLorePopup(); f.context.showLorePopup(); f.finish();
  assert.equal(f.bg.querySelectorAll('.lore-bonus').length, 1);
  assert.equal(f.bg.querySelector('.lore-bonus').hasAttribute('open'), false);
  assert.ok(f.bg.querySelectorAll('.lore-bonus-entry').every(e => !e.hasAttribute('open')));
});

test('static story includes optional chatter without forcing animation and closes without residue', () => {
  const f = fixture({ reducedMotion: true }); f.context.showLorePopup();
  assert.equal(f.bg.querySelectorAll('.lore-bonus').length, 1);
  assert.equal(f.bg.querySelector('.lore-bonus').hasAttribute('open'), false);
  f.motion.matches = false; f.motion.dispatch('change');
  assert.equal(f.bg.querySelector('.lore-bonus'), null);
  f.finish(); assert.equal(f.bg.querySelectorAll('.lore-bonus').length, 1);
  f.motion.matches = true; f.motion.dispatch('change');
  assert.equal(f.bg.querySelector('.lore-finale'), null);
  assert.equal(f.bg.querySelectorAll('.lore-bonus').length, 1);
  f.context.closeLorePopup();
  assert.equal(f.bg.querySelector('.lore-bonus'), null);
  assert.equal(f.document.activeElement, f.title);
});

test('all seven shipped languages provide the three crew records with no SEA English fallback', () => {
  const i18n = fs.readFileSync(path.join(__dirname, '../../assets/i18n.js'), 'utf8');
  const sea = fs.readFileSync(path.join(__dirname, '../../assets/i18n-sea.js'), 'utf8');
  let englishRecords;
  for (const lang of ['en', 'ko', 'ja', 'zh', 'id', 'vi', 'th']) {
    const f = fixture(); f.context.localStorage = { getItem: () => lang };
    vm.runInNewContext(i18n + '\n' + sea, f.context);
    f.context.TL_SEA = f.context.window.TL_SEA; f.context.LANG = lang;
    const bonus = f.context._createLoreBonus();
    const records = bonus.querySelectorAll('.lore-bonus-entry');
    if (lang === 'en') englishRecords = records.map(e => e.children.map(n => n.textContent));
    assert.equal(bonus.children.length, 5);
    if (lang !== 'en') assert.notEqual(bonus.children[0].textContent, 'Crew channel · optional', lang);
    for (const [i, entry] of records.entries()) {
      assert.ok(entry.children[0].textContent.length > 0, lang);
      assert.ok(entry.children[1].textContent.length > 0, lang);
      assert.doesNotMatch(entry.children[1].textContent, /undefined|<script>/);
      if (lang !== 'en') for (const [j, node] of entry.children.entries()) assert.notEqual(node.textContent, englishRecords[i][j], lang);
    }
  }
});
