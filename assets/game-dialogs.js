(function() {
  let confirmResolver = null;
  let inputResolver = null;
  let pickerResolver = null;

  function ensureEscapeHtml() {
    if (typeof window.escapeHTML === 'function') return;
    window.escapeHTML = function(value) {
      return String(value || '').replace(/[&<>"']/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
      });
    };
  }

  ensureEscapeHtml();

  function _tl(en, ko, ja, zh) {
    if (typeof window.tl === 'function') return window.tl(en, ko, ja, zh);
    return en;
  }

  window.gameConfirm = function(opts) {
    return new Promise(function(resolve) {
      confirmResolver = resolve;
      const dlg = document.getElementById('gameConfirm');
      if (!dlg) return resolve(false);

      document.getElementById('gcTitle').textContent = opts.title || _tl('CONFIRM', '확인', '確認', '确认');
      document.getElementById('gcIcon').textContent = opts.icon || '⚠';
      document.getElementById('gcBody').innerHTML = opts.body || '';

      const info = document.getElementById('gcInfo');
      if (opts.info && opts.info.length) {
        info.innerHTML = opts.info.map(function(row) {
          const cls = row.insufficient ? 'gc-insufficient' : (row.ok ? 'gc-ok' : '');
          return '<div class="gc-row ' + cls + '"><span class="gc-k">' + escapeHTML(row.k) + '</span><span class="gc-v">' + escapeHTML(row.v) + '</span></div>';
        }).join('');
        info.style.display = '';
      } else {
        info.style.display = 'none';
      }

      const btn = document.getElementById('gcConfirmBtn');
      btn.textContent = opts.confirmText || _tl('CONFIRM', '확인', '確認', '确认');
      btn.disabled = !!opts.disabled;
      dlg.classList.add('open');
    });
  };

  window.gameConfirmResolve = function(value) {
    const dlg = document.getElementById('gameConfirm');
    if (dlg) dlg.classList.remove('open');
    const resolver = confirmResolver;
    confirmResolver = null;
    if (resolver) resolver(value);
  };

  window.gameInput = function(opts) {
    return new Promise(function(resolve) {
      inputResolver = resolve;
      const dlg = document.getElementById('gameInput');
      if (!dlg) return resolve(null);

      document.getElementById('giTitle').textContent = opts.title || _tl('INPUT', '입력', '入力', '输入');
      document.getElementById('giLabel').textContent = opts.label || '';
      const input = document.getElementById('giInput');
      input.placeholder = opts.placeholder || '';
      input.maxLength = opts.maxLength || 200;
      input.value = opts.defaultValue || '';
      dlg.classList.add('open');
      setTimeout(function() {
        input.focus();
        input.select();
      }, 80);
    });
  };

  window._giSubmit = function() {
    const input = document.getElementById('giInput');
    window.closeGameInput(input ? input.value : null);
  };

  window.closeGameInput = function(value) {
    const dlg = document.getElementById('gameInput');
    if (dlg) dlg.classList.remove('open');
    const resolver = inputResolver;
    inputResolver = null;
    if (resolver) resolver(value === undefined ? null : value);
  };

  window.gamePicker = function(opts) {
    return new Promise(function(resolve) {
      pickerResolver = resolve;
      const dlg = document.getElementById('gamePicker');
      if (!dlg) return resolve(null);

      document.getElementById('gpTitle').textContent = opts.title || _tl('SELECT', '선택', '選択', '选择');
      const list = document.getElementById('gpList');
      if (!opts.items || !opts.items.length) {
        list.innerHTML = '<div class="gp-empty">' + escapeHTML(_tl('No options available', '선택 가능한 항목 없음', '選択肢がありません', '没有可选项')) + '</div>';
      } else {
        list.innerHTML = opts.items.map(function(item) {
          const selected = item.value == opts.selected ? ' selected' : '';
          const icon = item.icon ? '<span style="margin-right:6px">' + item.icon + '</span>' : '';
          return '<div class="gp-item' + selected + '" data-val="' + escapeHTML(String(item.value)) + '">' + icon + escapeHTML(item.label) + '</div>';
        }).join('');
        Array.prototype.forEach.call(list.querySelectorAll('.gp-item'), function(el) {
          el.addEventListener('click', function() {
            const value = el.getAttribute('data-val');
            const resolver = pickerResolver;
            pickerResolver = null;
            dlg.classList.remove('open');
            if (resolver) resolver(value);
          });
        });
      }
      dlg.classList.add('open');
    });
  };

  window.closeGamePicker = function() {
    const dlg = document.getElementById('gamePicker');
    if (dlg) dlg.classList.remove('open');
    const resolver = pickerResolver;
    pickerResolver = null;
    if (resolver) resolver(null);
  };
})();
