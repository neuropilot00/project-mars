(function() {
  var screenshotDataUrl = null;

  function getLang() {
    return window.LANG || document.documentElement.lang || 'ko';
  }

  function textByLang(map) {
    return map[getLang()] || map.en || map.ko || '';
  }

  function getRequiredElement(id) {
    return document.getElementById(id);
  }

  function restoreCapturePlaceholders() {
    var capMsg = getRequiredElement('bugCapturingMsg');
    var ph1 = getRequiredElement('bugSsPlaceholder');
    var ph2 = getRequiredElement('bugSsPlaceholder2');
    if (capMsg) capMsg.style.display = 'none';
    if (ph1) ph1.style.display = '';
    if (ph2) ph2.style.display = '';
  }

  function showScreenshotPreview(dataUrl) {
    screenshotDataUrl = dataUrl;
    var prev = getRequiredElement('bugSsPreview');
    var zone = getRequiredElement('bugScreenshotZone');
    var ph1 = getRequiredElement('bugSsPlaceholder');
    var ph2 = getRequiredElement('bugSsPlaceholder2');
    var btn = getRequiredElement('bugClearSsBtn');

    if (!prev || !zone || !btn) return;
    prev.src = dataUrl;
    prev.style.display = 'block';
    zone.classList.add('has-img');
    if (ph1) ph1.style.display = 'none';
    if (ph2) ph2.style.display = 'none';
    btn.style.display = '';
  }

  function doCapture() {
    var capMsg = getRequiredElement('bugCapturingMsg');
    var ph1 = getRequiredElement('bugSsPlaceholder');
    var ph2 = getRequiredElement('bugSsPlaceholder2');
    var modal = getRequiredElement('bugReportModal');

    if (!modal || typeof window.html2canvas === 'undefined') {
      restoreCapturePlaceholders();
      return;
    }

    if (capMsg) capMsg.style.display = 'block';
    if (ph1) ph1.style.display = 'none';
    if (ph2) ph2.style.display = 'none';

    modal.classList.remove('open');
    setTimeout(function() {
      window.html2canvas(document.body, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#000',
      }).then(function(canvas) {
        screenshotDataUrl = canvas.toDataURL('image/png');
        showScreenshotPreview(screenshotDataUrl);
        modal.classList.add('open');
        if (capMsg) capMsg.style.display = 'none';
      }).catch(function() {
        modal.classList.add('open');
        restoreCapturePlaceholders();
      });
    }, 80);
  }

  function autoCapture() {
    if (typeof window.html2canvas !== 'undefined') {
      doCapture();
      return;
    }

    if (getRequiredElement('h2cScript')) {
      setTimeout(function() {
        if (typeof window.html2canvas === 'undefined') restoreCapturePlaceholders();
      }, 1800);
      return;
    }

    var script = document.createElement('script');
    script.id = 'h2cScript';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = doCapture;
    script.onerror = restoreCapturePlaceholders;
    document.head.appendChild(script);

    setTimeout(function() {
      if (typeof window.html2canvas === 'undefined') restoreCapturePlaceholders();
    }, 1800);
  }

  function resetReporter() {
    var desc = getRequiredElement('bugDescArea');
    var hint = getRequiredElement('bugReportIdHint');
    var status = getRequiredElement('bugStatusMsg');
    var btn = getRequiredElement('bugSubmitBtn');

    if (desc) desc.value = '';
    if (hint) {
      hint.textContent = textByLang({
        ko: 'Claude가 읽고 수정합니다',
        ja: 'Claudeが読んで修正します',
        zh: 'Claude会阅读并修复',
        en: 'Claude will read and fix this',
      });
    }
    if (status) status.style.display = 'none';
    window.bugClearSs();
    if (btn) {
      btn.disabled = false;
      btn.textContent = textByLang({
        ko: '제출하기',
        ja: '送信する',
        zh: '提交',
        en: 'Submit',
      });
    }
  }

  window.openBugReporter = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    var modal = getRequiredElement('bugReportModal');
    var desc = getRequiredElement('bugDescArea');
    if (!modal || !desc) return;
    modal.classList.add('open');
    desc.focus();
    autoCapture();
  };

  window.closeBugReporter = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    var modal = getRequiredElement('bugReportModal');
    if (modal) modal.classList.remove('open');
    resetReporter();
  };

  window.bugSsZoneClick = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    var input = getRequiredElement('bugSsInput');
    if (input) input.click();
  };

  window.bugSsFileChosen = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      showScreenshotPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  window.bugSsDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    var file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      showScreenshotPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  window.bugClearSs = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    screenshotDataUrl = null;
    var prev = getRequiredElement('bugSsPreview');
    var zone = getRequiredElement('bugScreenshotZone');
    var ph1 = getRequiredElement('bugSsPlaceholder');
    var ph2 = getRequiredElement('bugSsPlaceholder2');
    var btn = getRequiredElement('bugClearSsBtn');

    if (prev) {
      prev.style.display = 'none';
      prev.src = '';
    }
    if (zone) zone.classList.remove('has-img');
    if (ph1) ph1.style.display = '';
    if (ph2) ph2.style.display = '';
    if (btn) btn.style.display = 'none';
  };

  document.addEventListener('paste', function(e) {
    var modal = getRequiredElement('bugReportModal');
    if (!modal || !modal.classList.contains('open')) return;
    var items = (e.clipboardData || window.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        var blob = items[i].getAsFile();
        var reader = new FileReader();
        reader.onload = function(ev) {
          showScreenshotPreview(ev.target.result);
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  });

  window.submitBugReport = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    var descEl = getRequiredElement('bugDescArea');
    if (!descEl) return;
    var desc = (descEl.value || '').trim();
    if (!desc) {
      descEl.focus();
      descEl.style.borderColor = 'rgba(239,83,80,.8)';
      setTimeout(function() {
        descEl.style.borderColor = '';
      }, 1200);
      return;
    }

    var btn = getRequiredElement('bugSubmitBtn');
    var status = getRequiredElement('bugStatusMsg');
    if (!btn || !status) return;
    btn.disabled = true;
    btn.textContent = textByLang({
      ko: '전송 중...',
      ja: '送信中...',
      zh: '发送中...',
      en: 'Sending...',
    });
    status.style.display = 'none';

    var wallet = (typeof window.getMyWallet === 'function' && window.getMyWallet())
      || (window.walletState && window.walletState.address)
      || window._walletAddress
      || null;
    var ctx = {
      url: location.href,
      hash: location.hash,
      timestamp: new Date().toISOString(),
      wallet: wallet,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      recentErrors: (window.__recentErrors || []).slice(-10),
      openModals: Array.from(document.querySelectorAll('[id$="Modal"],[id$="modal"],[id*="Modal"]'))
        .filter(function(el) {
          var style = getComputedStyle(el);
          return style.display !== 'none' && el.id !== 'bugReportModal';
        })
        .map(function(el) {
          return el.id;
        }),
    };

    var payload = {
      category: 'other',
      title: desc.split('\n')[0].slice(0, 120),
      body: desc,
      description: desc,
      screenshot: screenshotDataUrl || null,
      wallet: wallet,
      url: location.href,
      viewport: ctx.viewport,
      lang: (document.documentElement.lang || navigator.language || '').slice(0, 16),
      recentErrors: ctx.recentErrors,
      context: ctx,
      userAgent: navigator.userAgent,
    };

    function resetSubmitButton() {
      btn.disabled = false;
      btn.textContent = textByLang({
        ko: '제출하기',
        ja: '送信する',
        zh: '提交',
        en: 'Submit',
      });
    }

    function sendBugReport(endpoint, allowFallback) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (allowFallback && (xhr.status === 404 || xhr.status === 405)) {
          sendBugReport('/bug-report', false);
          return;
        }

        resetSubmitButton();
        if (xhr.status === 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            var hint = getRequiredElement('bugReportIdHint');
            if (hint) {
              hint.textContent = textByLang({
                ko: '저장됨: ',
                ja: '保存済み: ',
                zh: '已保存: ',
                en: 'Saved: ',
              }) + response.id;
            }
          } catch (err) {}
          status.style.display = '';
          status.style.color = '#66bb6a';
          status.textContent = '✓ ' + textByLang({
            ko: '전송 완료',
            ja: '送信完了',
            zh: '发送完成',
            en: 'Sent',
          });
          setTimeout(function() {
            window.closeBugReporter();
            status.style.display = 'none';
          }, 1800);
        } else {
          status.style.display = '';
          status.style.color = '#ef5350';
          status.textContent = '✗ ' + textByLang({
            ko: '전송 실패 (콘솔 확인)',
            ja: '送信失敗 (コンソール確認)',
            zh: '发送失败（检查控制台）',
            en: 'Send failed (check console)',
          });
          console.error('[BugReport] server response:', xhr.status, xhr.responseText);
        }
      };
      xhr.onerror = function() {
        if (allowFallback) {
          sendBugReport('/bug-report', false);
          return;
        }
        resetSubmitButton();
        status.style.display = '';
        status.style.color = '#ef5350';
        status.textContent = '✗ ' + textByLang({
          ko: '네트워크 실패',
          ja: 'ネットワーク失敗',
          zh: '网络失败',
          en: 'Network error',
        });
      };
      xhr.send(JSON.stringify(payload));
    }

    sendBugReport('/api/bug-report', true);
  };
})();
