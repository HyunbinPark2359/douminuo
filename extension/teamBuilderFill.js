/**
 * 스마트누오 팀빌더: #1~#6 버튼으로 슬롯 요약 샘플을 클립보드에 복사.
 */
(function () {
  'use strict';

  var HOST_ID = 'nuo-fmt-team-float-host';
  var LOCAL_SHOW_TEAM = 'nuo_fmt_showTeamBuilderFloating';

  var SK = {
    includeUrls: 'nuo_fmt_includeUrls',
    includeRealStats: 'nuo_fmt_includeRealStats',
    includeMovePowers: 'nuo_fmt_includeMovePowers',
    includeBulkStats: 'nuo_fmt_includeBulkStats',
    showdownPaste: 'nuo_fmt_showdownPaste',
  };

  var MSG_EXT = 'nuo-team-ext';
  var MSG_BRIDGE = 'nuo-team-bridge';

  function isSmartnuoHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'smartnuo.com' || h === 'www.smartnuo.com';
  }

  function shouldAttachTeamBuilderUi() {
    return isSmartnuoHost();
  }

  function injectTeamBridge() {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: 'INJECT_TEAM_BUILDER_BRIDGE' }, function (r) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'runtime'));
          return;
        }
        if (!r || !r.ok) {
          reject(new Error((r && r.error) || 'team_bridge_inject_failed'));
          return;
        }
        resolve();
      });
    });
  }

  function getSlotsFromBridge() {
    return new Promise(function (resolve) {
      var rid = String(Date.now()) + '-' + Math.random().toString(16).slice(2);

      function onMsg(ev) {
        var d = ev.data;
        if (!d || d.source !== MSG_BRIDGE || d.type !== 'NUO_TEAM_SLOTS_REPLY') return;
        if (String(d.requestId) !== rid) return;
        window.removeEventListener('message', onMsg);
        resolve({
          ok: !!d.ok,
          slots: d.slots,
          filled: d.filled,
          error: d.error,
        });
      }

      window.addEventListener('message', onMsg);
      window.postMessage(
        {
          source: MSG_EXT,
          type: 'NUO_TEAM_GET_SLOTS',
          requestId: rid,
        },
        '*'
      );

      setTimeout(function () {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, slots: null, filled: null, error: 'team_slots_timeout' });
      }, 8000);
    });
  }

  function copyTextBestEffort(text) {
    var s = text != null ? String(text) : '';
    if (!s) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).catch(function () {
        copyViaTextarea(s);
      });
      return;
    }
    copyViaTextarea(s);
  }

  function copyViaTextarea(s) {
    var ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function mountTeamFloatBar() {
    if (document.getElementById(HOST_ID)) return;

    var host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host { all: initial; }' +
      '* { box-sizing: border-box; font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }' +
      '.bar {' +
      '  position: fixed; z-index: 2147483645; left: 50%; bottom: 16px; transform: translateX(-50%);' +
      '  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px;' +
      '  background: rgba(15, 23, 42, 0.92); border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.35);' +
      '  box-shadow: 0 8px 28px rgba(0,0,0,0.35); max-width: calc(100vw - 24px);' +
      '}' +
      '.bar.nuo-tb-off { opacity: 0; pointer-events: none; visibility: hidden; }' +
      '.label { font-size: 11px; color: #94a3b8; margin-right: 4px; font-weight: 600; letter-spacing: -0.02em; }' +
      '.btns { display: flex; flex-wrap: wrap; gap: 4px; }' +
      'button.slot {' +
      '  min-width: 34px; height: 32px; padding: 0 8px; border-radius: 8px; border: none; cursor: pointer;' +
      '  font-size: 13px; font-weight: 700; background: #334155; color: #f1f5f9;' +
      '}' +
      'button.slot:disabled { opacity: 0.35; cursor: not-allowed; }' +
      'button.slot:not(:disabled):hover { background: #475569; }' +
      'button.slot:not(:disabled):active { transform: scale(0.96); }' +
      '.status { font-size: 11px; color: #cbd5e1; margin-left: 4px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.status.err { color: #fca5a5; }' +
      '.status.ok { color: #86efac; }' +
      '</style>' +
      '<div class="bar nuo-tb-off" part="bar">' +
      '  <span class="label">샘플 복사</span>' +
      '  <div class="btns" id="btns"></div>' +
      '  <span class="status" id="st" aria-live="polite"></span>' +
      '</div>';

    var bar = root.querySelector('.bar');
    var btnsWrap = root.getElementById('btns');
    var stEl = root.getElementById('st');
    var slotBtns = [];

    var bi;
    for (bi = 0; bi < 6; bi++) {
      (function (idx1) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.textContent = String(idx1);
        b.setAttribute('aria-label', '#' + idx1 + ' 슬롯 요약 샘플 복사');
        b.disabled = true;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (b.disabled) return;
          runCopySlot(idx1);
        });
        btnsWrap.appendChild(b);
        slotBtns.push(b);
      })(bi + 1);
    }

    var bridgeReady = false;
    var pollTimer = null;

    function setBarVisible(on) {
      bar.classList.toggle('nuo-tb-off', !on);
    }

    function setStatus(msg, kind) {
      stEl.textContent = msg || '';
      stEl.classList.remove('err', 'ok');
      if (kind === 'err') stEl.classList.add('err');
      else if (kind === 'ok') stEl.classList.add('ok');
    }

    function readFormatOptions(callback) {
      chrome.storage.session.get(
        [
          SK.includeUrls,
          SK.includeRealStats,
          SK.includeMovePowers,
          SK.includeBulkStats,
          SK.showdownPaste,
        ],
        function (got) {
          if (chrome.runtime.lastError) {
            callback({
              includeUrls: true,
              includeRealStats: false,
              includeMovePowers: false,
              includeBulkStats: false,
              showdownPaste: false,
            });
            return;
          }
          callback({
            includeUrls: got[SK.includeUrls] !== false,
            includeRealStats: !!got[SK.includeRealStats],
            includeMovePowers: !!got[SK.includeMovePowers],
            includeBulkStats: !!got[SK.includeBulkStats],
            showdownPaste: !!got[SK.showdownPaste],
          });
        }
      );
    }

    function applyFilledState(filled) {
      var i;
      for (i = 0; i < 6; i++) {
        var on = filled && filled[i] === true;
        slotBtns[i].disabled = !on;
      }
    }

    function refreshSlots() {
      if (!bridgeReady) return;
      getSlotsFromBridge().then(function (r) {
        if (!r || !r.ok || !r.slots || !Array.isArray(r.filled)) {
          setBarVisible(false);
          return;
        }
        setBarVisible(true);
        applyFilledState(r.filled);
      });
    }

    function runCopySlot(idx1) {
      setStatus('');
      getSlotsFromBridge().then(function (r) {
        if (!r || !r.ok || !r.slots) {
          setStatus('슬롯을 읽지 못했습니다.', 'err');
          return;
        }
        if (!r.filled || !r.filled[idx1 - 1]) {
          setStatus('빈 슬롯입니다.', 'err');
          return;
        }
        var slotData = r.slots[idx1 - 1];
        readFormatOptions(function (fo) {
          chrome.runtime.sendMessage(
            {
              type: 'FORMAT_BUILDER_SLOT',
              slotIndex: idx1,
              slotData: slotData,
              origin: location.origin,
              pathname: location.pathname || '/',
              formatOptions: fo,
            },
            function (bg) {
              if (chrome.runtime.lastError) {
                setStatus(chrome.runtime.lastError.message || '오류', 'err');
                return;
              }
              if (!bg || !bg.ok) {
                setStatus((bg && bg.error) || '변환 실패', 'err');
                return;
              }
              var t = bg.text != null ? String(bg.text) : '';
              if (!t) {
                setStatus('출력이 비었습니다.', 'err');
                return;
              }
              copyTextBestEffort(t);
              setStatus('클립보드에 복사했습니다.', 'ok');
              setTimeout(function () {
                setStatus('');
              }, 2200);
            }
          );
        });
      });
    }

    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(refreshSlots, 900);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    injectTeamBridge()
      .then(function () {
        bridgeReady = true;
        return getSlotsFromBridge();
      })
      .then(function (r) {
        if (r && r.ok && r.slots && Array.isArray(r.filled)) {
          setBarVisible(true);
          applyFilledState(r.filled);
        } else {
          setBarVisible(false);
        }
        startPolling();
      })
      .catch(function () {
        setBarVisible(false);
      });

    var moTimer = null;
    var mo = new MutationObserver(function () {
      clearTimeout(moTimer);
      moTimer = setTimeout(refreshSlots, 500);
    });
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}

    window.addEventListener('hashchange', function () {
      setTimeout(refreshSlots, 200);
    });

    return function teardown() {
      stopPolling();
      try {
        mo.disconnect();
      } catch (e) {}
      if (host.parentNode) host.parentNode.removeChild(host);
    };
  }

  var teardownFn = null;

  function removeTeamHost() {
    if (typeof teardownFn === 'function') {
      teardownFn();
      teardownFn = null;
    } else {
      var h = document.getElementById(HOST_ID);
      if (h && h.parentNode) h.parentNode.removeChild(h);
    }
  }

  function syncTeamFloatVisibility() {
    if (!shouldAttachTeamBuilderUi()) {
      removeTeamHost();
      return;
    }
    chrome.storage.local.get([LOCAL_SHOW_TEAM], function (got) {
      if (chrome.runtime.lastError) {
        if (!teardownFn) teardownFn = mountTeamFloatBar();
        return;
      }
      if (got[LOCAL_SHOW_TEAM] === false) {
        removeTeamHost();
        return;
      }
      if (!teardownFn) teardownFn = mountTeamFloatBar();
    });
  }

  function initTeamBuilderFloating() {
    syncTeamFloatVisibility();
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, LOCAL_SHOW_TEAM)) {
          return;
        }
        syncTeamFloatVisibility();
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeamBuilderFloating);
  } else {
    initTeamBuilderFloating();
  }

  setInterval(syncTeamFloatVisibility, 1200);
})();
