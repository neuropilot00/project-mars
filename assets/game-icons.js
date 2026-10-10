/* Occupy Mars command glyphs. Decorative SVGs inherit their control's color. */
(function () {
  'use strict';
  var paths = {
    front: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z M4 7.5l8 4.5 8-4.5 M12 12v9"/>',
    territory: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z M9 3v15 M15 6v15"/>',
    fleet: '<path d="m12 3 6 17-6-3-6 3L12 3Z M12 8v9 M5 9l-3 11 4-2 M19 9l3 11-4-2"/>',
    missions: '<path d="M8 4H5v17h14V4h-3 M9 3h6v4H9z M8 12l1.5 1.5L12 11 M14 12h2 M8 17h8"/>',
    base: '<path d="m3 10 9-7 9 7v11H3V10Z M8 21v-7h8v7 M8 10h8"/>',
    collection: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h8 M2 8v10 M9 9h6 M9 13h6 M9 17h3"/>',
    fitting: '<path d="M4 7h16 M4 17h16 M9 4v6 M15 14v6"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    industry: '<path d="M3 21V10l6 3V8l6 3V4h4l2 17H3Z M7 17h1 M12 17h1 M17 17h1"/>',
    mining: '<path d="m5 19 9-9 M4 8c4-5 10-5 16-2l-2 3c-5-3-9-2-12 1L4 8Z M12 12l3 3"/>',
    refining: '<path d="M9 3h6 M10 3v6l-6 10a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3 M7 15h10 M10 18h.1 M14 17h.1"/>',
    assembly: '<path d="M4 17h16v4H4z M7 17v-5l5-3 5 3v5 M12 9V5 M8 5h8 M8 12v3h8v-3"/>',
    salvage: '<path d="m8 4 4-2 4 2v5l-4 2-4-2V4Z M12 2v9 M8 4l4 2 4-2 M4 14v5h5 M20 14v5h-5 M4 19l4-5 M20 19l-4-5"/>',
    market: '<path d="M3 4h18l-2 6H5L3 4Z M5 10v11h14V10 M9 21v-7h6v7 M3 4v3 M21 4v3"/>',
    transport: '<path d="M3 6h11v12H3z M14 10h4l3 4v4h-7 M3 10h11 M17 10v5h4"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
    shop: '<path d="M5 8h14l2 13H3L5 8Z M8 8V6a4 4 0 0 1 8 0v2 M8 12h.1 M16 12h.1"/>',
    claim: '<path d="M6 21V3 M6 4h12l-3 4 3 4H6 M3 21h6"/>',
    cantina: '<path d="M5 7h11v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V7Z M16 9h2a3 3 0 0 1 0 6h-2 M8 3v1 M12 2v2"/>',
    repair: '<path d="M14 4a6 6 0 0 0-7 7L3 15a3 3 0 0 0 4 4l4-4a6 6 0 0 0 7-7l-4 4-3-3 3-5Z M5 17h.1"/>',
    attack: '<path d="m14 3 7 0v7L7 21l-4-4L14 3Z M14 3l7 7 M4 12l8 8 M3 21l3-3"/>',
    defense: '<path d="m12 3 8 3v6c0 4-3.5 7-8 9-4.5-2-8-5-8-9V6l8-3Z M12 7v10 M8 12h8"/>',
    hold: '<path d="M5 3h14v18H5z M10 8v8 M14 8v8"/>',
    retreat: '<path d="M10 5 3 12l7 7 M3 12h11a7 7 0 0 1 7 7"/>',
    resources: '<path d="m12 3 8 5v8l-8 5-8-5V8l8-5Z M4 8l8 5 8-5 M12 13v8 M8 5l8 5"/>',
    close: '<path d="m6 6 12 12 M18 6 6 18"/>',
    plus: '<path d="M12 5v14 M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h16 M14 6l6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    pending: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    timer: '<circle cx="12" cy="14" r="7"/><path d="M9 3h6 M12 3v4 M17 7l2-2 M12 10v4l3 2"/>',
    rank: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 13v5 M8 21v-3h8v3"/>',
    guild: '<path d="m12 3 8 3v6c0 4-3.5 7-8 9-4.5-2-8-5-8-9V6l8-3Z M8 10h8 M8 14h8 M12 8v9"/>',
    settings: '<path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3H9Z"/><circle cx="11" cy="11" r="3"/>',
    refresh: '<path d="M20 7v5h-5 M4 17v-5h5 M20 12a8 8 0 0 0-14-5 M4 12a8 8 0 0 0 14 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6 M12 7h.1"/>',
    warning: '<path d="m12 3 10 18H2L12 3Z M12 9v5 M12 17h.1"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3 M12 14v3"/>',
    weapon: '<path d="m5 18 9-9 M4 20l3-3 M9 14l-2-2 3-3 2 2 M14 9l-1-3 5-3 3 3-3 5-4-2Z M16 7l2-2"/>',
    armor: '<path d="M8 3h8l5 5-4 4v9H7v-9L3 8l5-5Z M8 3l4 4 4-4 M7 12h10 M9 16h6"/>',
    engine: '<path d="M8 3h8v5l3 3v6H5v-6l3-3V3Z M9 7h6 M8 12h8 M8 20l-1 2 M12 20v2 M16 20l1 2"/>',
    radar: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6-6 M3 12h3 M12 18v3 M18 12h3"/><circle cx="12" cy="12" r="4"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3"/>',
    fusion: '<path d="m7 3-4 4 4 4 M3 7h6l3 5 3-5h6 M17 3l4 4-4 4 M12 12v9 M8 17l4 4 4-4"/>',
    credits: '<circle cx="12" cy="12" r="9"/><path d="M15 7H9v10h6 M9 12h5"/>',
    profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    logout: '<path d="M10 3H4v18h6 M9 12h12 M16 7l5 5-5 5"/>',
    save: '<path d="M4 3h13l4 4v14H4V3Z M8 3v6h8V3 M8 21v-7h9v7"/>',
    download: '<path d="M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4"/>',
    upload: '<path d="M12 15V3 M7 8l5-5 5 5 M4 17v4h16v-4"/>',
    chat: '<path d="M3 4h18v13H9l-6 4V4Z M7 9h10 M7 13h6"/>',
    story: '<path d="M12 6C9 3 5 3 3 4v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 2Z M12 6v15"/>',
    formation: '<path d="m12 2 3 5-3 2-3-2 3-5Z M5 12l3 5-3 2-3-2 3-5Z M19 12l3 5-3 2-3-2 3-5Z M12 9v3 M5 12h14"/>',
    orbit: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-30 12 12)"/>',
    fuel: '<path d="M5 21V4h10v17H5Z M7 7h6v5H7z M15 9h2l3 3v6a2 2 0 0 1-4 0v-3 M18 7l3 3 M3 21h14"/>',
    energy: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
    heart: '<path d="M12 21 3.5 12a5 5 0 0 1 8.5-5 5 5 0 0 1 8.5 5L12 21Z"/>',
    notification: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Z M10 21h4 M12 2v2"/>',
    gift: '<path d="M3 8h18v5H3z M5 13v8h14v-8 M12 8v13 M12 8H8a3 3 0 1 1 3-3l1 3Z M12 8h4a3 3 0 1 0-3-3l-1 3Z"/>',
    objective: '<path d="M5 21V3 M5 4h13l-3 4 3 4H5 M3 21h4"/><circle cx="17" cy="18" r="3"/><path d="m16 18 1 1 2-2"/>',
    history: '<path d="M3 4v6h6 M3 10a9 9 0 1 1 2 8 M12 7v5l4 2"/>',
    missile: '<path d="m6 16 8-11 5-2 2 5-11 8-4 0Z M6 16l-3 5 5-3 M12 8l4 4 M6 12l-3 1v4 M12 18l-1 3H7"/>',
    speed: '<path d="M4 19a10 10 0 1 1 16 0 M12 13l5-5 M5 12h2 M17 12h2 M12 4v2"/><circle cx="12" cy="13" r="2"/>',
    cargo: '<path d="M4 5h16v16H4z M9 5v5h6V5 M8 16h8 M8 2h8"/>'
  };
  var aliases = {myland:'territory',land:'territory',inventory:'resources',items:'resources',resource:'resources',logistics:'transport',ship:'fleet',ships:'fleet',craft:'assembly',workshop:'fitting',shield:'defense',tank:'defense',tackle:'attack',dps:'weapon',logi:'repair',ewar:'radar',sniper:'target',bomber:'missile',bomb:'missile',back:'retreat',reward:'gift',crate:'cargo',money:'credits',gp:'credits',menu:'base',help:'info',campaign:'story',battle:'attack',upgrade:'fitting',heal:'repair',sortie:'fleet',move:'speed',join:'guild',leaderboard:'rank',retire:'salvage',reload:'refresh',time:'timer'};
  function render(name, options) {
    options = options || {};
    var key = Object.prototype.hasOwnProperty.call(paths, name) ? name : aliases[name];
    if (!Object.prototype.hasOwnProperty.call(paths, key)) key = 'info';
    var value = Number(options.size), size = Number.isFinite(value) ? Math.max(8, Math.min(128, value)) : 20;
    var className = typeof options.className === 'string' ? options.className.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="game-icon'+(className?' '+className:'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[key]+'</svg>';
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-game-icon]').forEach(function (node) {
      node.innerHTML = render(node.getAttribute('data-game-icon'), {size:node.getAttribute('data-icon-size') || 20});
    });
  }
  window.GameIcons = Object.freeze({render:render,hydrate:hydrate,names:Object.freeze(Object.keys(paths).concat(Object.keys(aliases)))});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {hydrate();});
  else hydrate();
}());
