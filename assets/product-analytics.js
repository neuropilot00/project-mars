/* First-party product analytics SDK. Call window.trackProductEvent only with
 * session_start/ui_view; gameplay and commerce events must be recorded server-side. */
(function () {
  'use strict';

  var SESSION_KEY = 'om_product_analytics_session_v1';
  var START_KEY = 'om_product_analytics_start_event_v1';
  var memory = {};

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function getSessionId() {
    var value;
    try { value = sessionStorage.getItem(SESSION_KEY); } catch (_) { value = memory[SESSION_KEY]; }
    if (!value) {
      value = uuid();
      try { sessionStorage.setItem(SESSION_KEY, value); } catch (_) { memory[SESSION_KEY] = value; }
    }
    return value;
  }

  function getToken() {
    try { return localStorage.getItem('pw_token') || ''; } catch (_) { return ''; }
  }

  function post(eventName, eventKey, view) {
    var token = getToken();
    if (!token) return Promise.resolve(false);
    var body = { eventName: eventName, eventKey: eventKey, sessionId: getSessionId() };
    if (eventName === 'ui_view' && view) body.view = String(view).slice(0, 80);
    return fetch('/api/analytics/client-event', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    }).then(function (response) { return response.ok; }).catch(function () { return false; });
  }

  function startSession() {
    var key;
    try { key = sessionStorage.getItem(START_KEY); } catch (_) { key = memory[START_KEY]; }
    if (!key) {
      key = uuid();
      try { sessionStorage.setItem(START_KEY, key); } catch (_) { memory[START_KEY] = key; }
    }
    return post('session_start', key);
  }

  window.trackProductEvent = function (eventName, properties) {
    if (eventName !== 'session_start' && eventName !== 'ui_view') return Promise.resolve(false);
    if (!getToken()) return Promise.resolve(false);
    if (eventName === 'session_start') return startSession();
    var view = properties && typeof properties.view === 'string' ? properties.view : location.pathname;
    return startSession().then(function () { return post('ui_view', uuid(), view); });
  };

  function recordCurrentView() {
    window.trackProductEvent('ui_view', { view: document.body && document.body.dataset.analyticsView || location.pathname });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recordCurrentView, { once: true });
  else recordCurrentView();
}());
