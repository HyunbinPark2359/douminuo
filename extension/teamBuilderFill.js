/**
 * 스마트누오 팀빌더: 우하단 FAB — 파티 대형 버튼, 호버 시 위쪽 6슬롯·왼쪽 설정.
 * 파티/슬롯: 서버·포맷 로직은 기존과 동일. 옵션은 chrome.storage.local(팝업과 동일).
 * 성공: 버튼 위 반투명 오버레이+초록 체크. 오류: FAB 위 토스트.
 * 계산기 화면은 calcFill.js 와 같은 본문 휴리스틱으로 플로팅 숨김.
 * 슬롯 갱신: MutationObserver + hashchange.
 */
(function () {
  'use strict';

  var HOST_ID = 'nuo-fmt-team-float-host';
  /** 팝업「플로팅」스위치와 동일: 계산기·팀빌더 바 모두 제어 */
  var LOCAL_SHOW_ALL_FLOATING = 'nuo_fmt_showCalcFloating';

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

  /** calcFill.js 의 isLikelyCalculatorView 와 동일 */
  function isLikelyCalculatorView() {
    var t = document.body && document.body.innerText;
    if (!t) return false;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
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
    var DONE_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
      '</svg>';
    root.innerHTML =
      '<style>' +
      ':host { all: initial; }' +
      '* { box-sizing: border-box; font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }' +
      '@keyframes nuo-tb-glow {' +
      '  0%, 100% { box-shadow: 0 6px 22px rgba(4, 120, 87, 0.32), 0 0 0 1px rgba(52, 211, 153, 0.4); }' +
      '  50% { box-shadow: 0 10px 28px rgba(5, 150, 105, 0.45), 0 0 0 1px rgba(110, 231, 183, 0.5); }' +
      '}' +
      '.fab-root {' +
      '  position: fixed; z-index: 2147483645; right: clamp(24px, 5vw, 48px); bottom: clamp(24px, 5vw, 48px);' +
      '  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;' +
      '}' +
      '.fab-root.nuo-tb-off { opacity: 0; pointer-events: none; visibility: hidden; }' +
      '.fab-error-toast {' +
      '  max-width: min(280px, calc(100vw - 32px)); padding: 8px 10px; font-size: 12px; line-height: 1.35;' +
      '  color: #991b1b; background: #fff1f2; border: 1px solid #fecaca;' +
      '  border-radius: 10px; word-break: keep-all; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);' +
      '}' +
      '.fab-error-toast.nuo-hidden { display: none; }' +
      '.fab-inner {' +
      '  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;' +
      '}' +
      '.fab-dock { position: relative; display: inline-block; vertical-align: bottom; }' +
      '.fab-dock-main {' +
      '  position: relative; width: 72px; display: flex; flex-direction: column; align-items: center;' +
      '}' +
      '.fab-party-col {' +
      '  position: relative; width: 72px; min-height: 72px; display: flex; flex-direction: column;' +
      '  align-items: center; justify-content: flex-end;' +
      '}' +
      '.fab-slots {' +
      '  position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 1;' +
      '  display: flex; flex-direction: column; align-items: center; gap: 8px; width: 72px;' +
      '  opacity: 0; visibility: hidden; pointer-events: none;' +
      '  transition: opacity 0.15s ease, visibility 0.15s;' +
      '}' +
      '.fab-dock--open .fab-slots {' +
      '  opacity: 1; visibility: visible; pointer-events: auto;' +
      '}' +
      '.fab-settings-wrap {' +
      '  position: absolute; right: calc(100% + 12px); bottom: 0; z-index: 2;' +
      '  opacity: 0; visibility: hidden; pointer-events: none;' +
      '  transition: opacity 0.15s ease, visibility 0.15s;' +
      '}' +
      '.fab-dock--open .fab-settings-wrap {' +
      '  opacity: 1; visibility: visible; pointer-events: auto;' +
      '}' +
      '.fab-btn {' +
      '  position: relative; border: none; cursor: pointer; display: inline-flex; align-items: center;' +
      '  justify-content: center; flex-shrink: 0; border-radius: 50%; color: #0f172a;' +
      '}' +
      '.fab-btn:not(:disabled) {' +
      '  background: linear-gradient(155deg, #ecfdf5 0%, #6ee7b7 42%, #34d399 100%);' +
      '  animation: nuo-tb-glow 3.4s ease-in-out -0.6s infinite;' +
      '  transition: transform 0.22s ease, filter 0.2s ease, opacity 0.2s ease;' +
      '}' +
      '.fab-btn:not(:disabled):hover { transform: scale(1.08); filter: brightness(1.04) saturate(1.05); }' +
      '.fab-btn:disabled {' +
      '  cursor: not-allowed; opacity: 0.72; filter: saturate(0.45) brightness(0.96);' +
      '  animation: none;' +
      '  background: linear-gradient(155deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%);' +
      '  color: #64748b; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.35);' +
      '}' +
      '.fab-slot { width: 56px; height: 56px; border-radius: 50%; font-size: 15px; font-weight: 700; }' +
      '.fab-party {' +
      '  width: 72px; height: 72px; border-radius: 50%; font-size: 12px; font-weight: 800;' +
      '  letter-spacing: -0.02em;' +
      '}' +
      '.fab-settings-morph {' +
      '  position: relative; width: 52px; min-height: 52px; max-height: 52px; border-radius: 26px;' +
      '  overflow: hidden;' +
      '  background: linear-gradient(155deg, #ecfdf5 0%, #6ee7b7 42%, #34d399 100%);' +
      '  color: #047857;' +
      '  animation: nuo-tb-glow 3.4s ease-in-out -0.6s infinite;' +
      '  cursor: pointer;' +
      '  transition: width 0.22s ease, min-height 0.24s ease, max-height 0.24s ease, border-radius 0.2s ease,' +
      '    box-shadow 0.35s ease, filter 0.2s ease, transform 0.22s ease;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-morph {' +
      '  width: min(92vw, 220px); min-height: 168px; max-height: min(52vh, 300px); border-radius: 14px;' +
      '  overflow: hidden; animation: none;' +
      '  background: linear-gradient(180deg, #f8fffc 0%, #ffffff 40%, #ecfdf5 100%);' +
      '  color: #0f172a;' +
      '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.35);' +
      '}' +
      '.fab-settings-gear {' +
      '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
      '  pointer-events: none; transition: opacity 0.12s ease;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-gear {' +
      '  opacity: 0;' +
      '}' +
      '.fab-settings-morph:focus-visible { outline: 2px solid #047857; outline-offset: 3px; }' +
      '.fab-btn-label { pointer-events: none; }' +
      '.fab-done {' +
      '  position: absolute; inset: 0; border-radius: inherit; background: rgba(255, 255, 255, 0.55);' +
      '  display: none; align-items: center; justify-content: center; color: #15803d;' +
      '}' +
      '.fab-btn.fab-show-done .fab-done { display: flex; }' +
      '.fab-done svg { width: 52%; height: 52%; max-height: 40px; flex-shrink: 0; }' +
      '.fab-settings-panel {' +
      '  position: absolute; left: 0; top: 0; width: 100%; padding: 0 10px; box-sizing: border-box;' +
      '  opacity: 0; visibility: hidden; pointer-events: none; height: 0; overflow: hidden;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-panel {' +
      '  position: relative; opacity: 1; visibility: visible; pointer-events: auto; height: auto; overflow: visible;' +
      '  padding: 10px 10px 8px;' +
      '}' +
      '.fab-settings-panel .opt-row {' +
      '  display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; color: #0f172a; margin: 6px 0; cursor: pointer;' +
      '}' +
      '.fab-settings-panel .opt-row input { width: 15px; height: 15px; accent-color: #059669; cursor: pointer; flex-shrink: 0; }' +
      '.fab-settings-panel .opt-row.opt-muted { color: #94a3b8; cursor: default; }' +
      '.fab-settings-panel .opt-row.opt-muted input { cursor: not-allowed; opacity: 0.45; }' +
      '.settings-hr { border: none; border-top: 1px solid #e2e8f0; margin: 10px 0 8px; }' +
      '</style>' +
      '<div class="fab-root nuo-tb-off" part="fab">' +
      '  <div class="fab-error-toast nuo-hidden" id="errToast" role="alert" aria-live="assertive"></div>' +
      '  <div class="fab-inner" tabindex="-1">' +
      '    <div class="fab-dock" id="fabDock">' +
      '      <div class="fab-dock-main">' +
      '        <div class="fab-settings-wrap">' +
      '          <div class="fab-settings-morph" id="settingsMorph" tabindex="0" role="group" aria-label="샘플 복사 옵션">' +
      '            <div class="fab-settings-gear">' +
      '              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>' +
      '                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' +
      '              </svg>' +
      '            </div>' +
      '            <div class="fab-settings-panel" id="settingsPanel">' +
      '              <label class="opt-row" id="optRowUrls"><input type="checkbox" id="optUrls" /><span>URL</span></label>' +
      '              <label class="opt-row" id="optRowReal"><input type="checkbox" id="optReal" /><span>실수치</span></label>' +
      '              <label class="opt-row" id="optRowPow"><input type="checkbox" id="optPow" /><span>결정력</span></label>' +
      '              <label class="opt-row" id="optRowBulk"><input type="checkbox" id="optBulk" /><span>내구력</span></label>' +
      '              <hr class="settings-hr" />' +
      '              <label class="opt-row" id="optRowSd"><input type="checkbox" id="optSd" /><span>Showdown</span></label>' +
      '            </div>' +
      '          </div>' +
      '        </div>' +
      '        <div class="fab-party-col">' +
      '          <div class="fab-slots" id="fabSlots"></div>' +
      '          <button type="button" class="fab-btn fab-party" id="fabPartyBtn" disabled' +
      '            title="현재 팀 전체 샘플(톱니 옵션)을 클립보드에 넣습니다." aria-label="현재 팀 파티 샘플 복사">' +
      '            <span class="fab-btn-label">파티</span>' +
      '            <span class="fab-done" aria-hidden="true">' +
      DONE_SVG +
      '            </span>' +
      '          </button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var fabRoot = root.querySelector('.fab-root');
    var errToastEl = root.getElementById('errToast');
    var fabDock = root.getElementById('fabDock');
    var fabSlotsWrap = root.getElementById('fabSlots');
    var partyBtn = root.getElementById('fabPartyBtn');
    var settingsMorph = root.getElementById('settingsMorph');
    var settingsWrap = root.querySelector('.fab-settings-wrap');
    var optUrls = root.getElementById('optUrls');
    var optReal = root.getElementById('optReal');
    var optPow = root.getElementById('optPow');
    var optBulk = root.getElementById('optBulk');
    var optSd = root.getElementById('optSd');
    var slotBtns = [];

    var bi;
    for (bi = 0; bi < 6; bi++) {
      (function (idx1) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fab-btn fab-slot';
        b.innerHTML =
          '<span class="fab-btn-label">' +
          idx1 +
          '</span><span class="fab-done" aria-hidden="true">' +
          DONE_SVG +
          '</span>';
        b.setAttribute('aria-label', '#' + idx1 + ' 슬롯 요약 샘플 복사');
        b.disabled = true;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (b.disabled) return;
          runCopySlot(idx1, b);
        });
        fabSlotsWrap.appendChild(b);
        slotBtns.push(b);
      })(bi + 1);
    }

    partyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      runCopyPartyShareUrl(partyBtn);
    });

    var dockCloseTimer = null;
    function cancelFabDockCloseTimer() {
      if (dockCloseTimer) {
        clearTimeout(dockCloseTimer);
        dockCloseTimer = null;
      }
    }
    function openFabDockFromParty() {
      if (!fabDock) return;
      cancelFabDockCloseTimer();
      fabDock.classList.add('fab-dock--open');
    }
    function scheduleFabDockClose() {
      if (!fabDock) return;
      cancelFabDockCloseTimer();
      dockCloseTimer = setTimeout(function () {
        dockCloseTimer = null;
        if (fabDock) fabDock.classList.remove('fab-dock--open');
      }, 260);
    }
    function onFabDockMouseOut(ev) {
      if (!fabDock) return;
      var rt = ev.relatedTarget;
      if (rt && fabDock.contains(rt)) return;
      scheduleFabDockClose();
    }
    function onFabDockMouseOver() {
      cancelFabDockCloseTimer();
    }
    if (fabDock) {
      partyBtn.addEventListener('mouseenter', openFabDockFromParty);
      fabDock.addEventListener('mouseout', onFabDockMouseOut);
      fabDock.addEventListener('mouseover', onFabDockMouseOver);
    }

    var FORMAT_LOCAL_OPT_KEYS = [
      SK.includeUrls,
      SK.includeRealStats,
      SK.includeMovePowers,
      SK.includeBulkStats,
      SK.showdownPaste,
    ];

    function migrateSessionFormatToLocalIfNeeded(done) {
      chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (lg) {
        if (chrome.runtime.lastError) {
          if (typeof done === 'function') done();
          return;
        }
        var has = false;
        var i;
        for (i = 0; i < FORMAT_LOCAL_OPT_KEYS.length; i++) {
          if (typeof lg[FORMAT_LOCAL_OPT_KEYS[i]] === 'boolean') {
            has = true;
            break;
          }
        }
        if (has) {
          if (typeof done === 'function') done();
          return;
        }
        chrome.storage.session.get(FORMAT_LOCAL_OPT_KEYS, function (sg) {
          if (chrome.runtime.lastError) {
            if (typeof done === 'function') done();
            return;
          }
          var patch = {};
          var j;
          for (j = 0; j < FORMAT_LOCAL_OPT_KEYS.length; j++) {
            var k = FORMAT_LOCAL_OPT_KEYS[j];
            if (typeof sg[k] === 'boolean') patch[k] = sg[k];
          }
          if (Object.keys(patch).length === 0) {
            if (typeof done === 'function') done();
            return;
          }
          chrome.storage.local.set(patch, function () {
            if (typeof done === 'function') done();
          });
        });
      });
    }

    function applyShowdownLockUi() {
      var sd = optSd.checked;
      [optUrls, optReal, optPow, optBulk].forEach(function (inp) {
        inp.disabled = sd;
        var lab = inp.closest('label');
        if (lab) lab.classList.toggle('opt-muted', sd);
      });
    }

    function persistFormatOptionsFromUi() {
      try {
        chrome.storage.local.set({
          [SK.includeUrls]: optUrls.checked,
          [SK.includeRealStats]: optReal.checked,
          [SK.includeMovePowers]: optPow.checked,
          [SK.includeBulkStats]: optBulk.checked,
          [SK.showdownPaste]: optSd.checked,
        });
      } catch (e) {}
    }

    function syncFormatOptionsFromLocal(done) {
      migrateSessionFormatToLocalIfNeeded(function () {
        chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (got) {
          if (chrome.runtime.lastError) {
            optUrls.checked = true;
            optReal.checked = false;
            optPow.checked = false;
            optBulk.checked = false;
            optSd.checked = false;
          } else {
            optUrls.checked = got[SK.includeUrls] !== false;
            optReal.checked = !!got[SK.includeRealStats];
            optPow.checked = !!got[SK.includeMovePowers];
            optBulk.checked = !!got[SK.includeBulkStats];
            optSd.checked = !!got[SK.showdownPaste];
          }
          applyShowdownLockUi();
          if (typeof done === 'function') done();
        });
      });
    }

    if (settingsMorph) {
      settingsMorph.addEventListener('mouseenter', function () {
        syncFormatOptionsFromLocal();
      });
      settingsMorph.addEventListener('focus', function () {
        syncFormatOptionsFromLocal();
      });
    }

    function blurSettingsMorphFocus() {
      if (!settingsMorph) return;
      var ae = root.activeElement;
      if (ae && settingsMorph.contains(ae)) {
        try {
          ae.blur();
        } catch (eb) {}
      }
      if (root.activeElement === settingsMorph) {
        try {
          settingsMorph.blur();
        } catch (ec) {}
      }
    }
    if (settingsWrap) {
      settingsWrap.addEventListener('mouseleave', blurSettingsMorphFocus);
    }

    function onFormatOptChange() {
      persistFormatOptionsFromUi();
      applyShowdownLockUi();
    }

    optUrls.addEventListener('change', onFormatOptChange);
    optReal.addEventListener('change', onFormatOptChange);
    optPow.addEventListener('change', onFormatOptChange);
    optBulk.addEventListener('change', onFormatOptChange);
    optSd.addEventListener('change', onFormatOptChange);

    function onLocalFormatStorageChanged(changes, area) {
      if (area !== 'local') return;
      var hit = false;
      var ki;
      for (ki = 0; ki < FORMAT_LOCAL_OPT_KEYS.length; ki++) {
        if (changes[FORMAT_LOCAL_OPT_KEYS[ki]]) {
          hit = true;
          break;
        }
      }
      if (!hit) return;
      syncFormatOptionsFromLocal();
    }

    chrome.storage.onChanged.addListener(onLocalFormatStorageChanged);

    syncFormatOptionsFromLocal();

    var bridgeReady = false;
    var errHideTimer = null;
    var successHideTimer = null;
    var successFlashBtn = null;

    function setFabVisible(on) {
      fabRoot.classList.toggle('nuo-tb-off', !on);
    }

    function clearErrorToast() {
      if (errHideTimer) {
        clearTimeout(errHideTimer);
        errHideTimer = null;
      }
      errToastEl.textContent = '';
      errToastEl.classList.add('nuo-hidden');
    }

    function showErrorToast(msg) {
      clearErrorToast();
      errToastEl.textContent = msg != null ? String(msg) : '';
      errToastEl.classList.remove('nuo-hidden');
      errHideTimer = setTimeout(function () {
        errHideTimer = null;
        errToastEl.textContent = '';
        errToastEl.classList.add('nuo-hidden');
      }, 3500);
    }

    function showCopySuccessOnButton(btn) {
      if (!btn) return;
      if (successHideTimer) {
        clearTimeout(successHideTimer);
        successHideTimer = null;
      }
      if (successFlashBtn && successFlashBtn !== btn) {
        successFlashBtn.classList.remove('fab-show-done');
      }
      successFlashBtn = btn;
      btn.classList.add('fab-show-done');
      successHideTimer = setTimeout(function () {
        btn.classList.remove('fab-show-done');
        successHideTimer = null;
        successFlashBtn = null;
      }, 2000);
    }

    function readFormatOptions(callback) {
      migrateSessionFormatToLocalIfNeeded(function () {
        chrome.storage.local.get(
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
      });
    }

    function applyFilledState(filled) {
      var i;
      for (i = 0; i < 6; i++) {
        var on = filled && filled[i] === true;
        slotBtns[i].disabled = !on;
      }
    }

    function setPartyButtonEnabled(on) {
      partyBtn.disabled = !on;
    }

    function refreshSlots() {
      if (!bridgeReady) return;
      if (isLikelyCalculatorView()) {
        setFabVisible(false);
        setPartyButtonEnabled(false);
        return;
      }
      getSlotsFromBridge().then(function (r) {
        if (isLikelyCalculatorView()) {
          setFabVisible(false);
          setPartyButtonEnabled(false);
          return;
        }
        if (!r || !r.ok || !r.slots || !Array.isArray(r.filled)) {
          setFabVisible(false);
          setPartyButtonEnabled(false);
          return;
        }
        setFabVisible(true);
        applyFilledState(r.filled);
        setPartyButtonEnabled(true);
      });
    }

    function runCopyPartyShareUrl(sourceBtn) {
      clearErrorToast();
      if (isLikelyCalculatorView()) return;

      getSlotsFromBridge().then(function (r) {
        var partySlots = r && r.ok && r.slots && r.slots.length === 6 ? r.slots : null;

        readFormatOptions(function (fo) {
          chrome.runtime.sendMessage(
            {
              type: 'COPY_PARTY_SHARE_URL',
              origin: location.origin,
              pathname: location.pathname || '/',
              partySlots: partySlots,
              formatOptions: fo,
            },
            function (bg) {
              if (chrome.runtime.lastError) {
                showErrorToast(chrome.runtime.lastError.message || '오류');
                return;
              }
              if (!bg || !bg.ok) {
                showErrorToast((bg && bg.error) || '처리하지 못했습니다.');
                return;
              }
              var t = bg.text != null ? String(bg.text) : '';
              if (!t) {
                showErrorToast('출력이 비었습니다.');
                return;
              }
              copyTextBestEffort(t);
              showCopySuccessOnButton(sourceBtn || partyBtn);
            }
          );
        });
      });
    }

    function runCopySlot(idx1, sourceBtn) {
      clearErrorToast();
      if (isLikelyCalculatorView()) return;
      getSlotsFromBridge().then(function (r) {
        if (!r || !r.ok || !r.slots) {
          showErrorToast('슬롯을 읽지 못했습니다.');
          return;
        }
        if (!r.filled || !r.filled[idx1 - 1]) {
          showErrorToast('빈 슬롯입니다.');
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
                showErrorToast(chrome.runtime.lastError.message || '오류');
                return;
              }
              if (!bg || !bg.ok) {
                showErrorToast((bg && bg.error) || '변환 실패');
                return;
              }
              var t = bg.text != null ? String(bg.text) : '';
              if (!t) {
                showErrorToast('출력이 비었습니다.');
                return;
              }
              copyTextBestEffort(t);
              showCopySuccessOnButton(sourceBtn || slotBtns[idx1 - 1]);
            }
          );
        });
      });
    }

    injectTeamBridge()
      .then(function () {
        bridgeReady = true;
        refreshSlots();
      })
      .catch(function () {
        setFabVisible(false);
        setPartyButtonEnabled(false);
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
      cancelFabDockCloseTimer();
      try {
        partyBtn.removeEventListener('mouseenter', openFabDockFromParty);
      } catch (eDock) {}
      try {
        if (fabDock) {
          fabDock.removeEventListener('mouseout', onFabDockMouseOut);
          fabDock.removeEventListener('mouseover', onFabDockMouseOver);
        }
      } catch (eDock2) {}
      try {
        if (settingsWrap) {
          settingsWrap.removeEventListener('mouseleave', blurSettingsMorphFocus);
        }
      } catch (eSet) {}
      try {
        chrome.storage.onChanged.removeListener(onLocalFormatStorageChanged);
      } catch (e) {}
      try {
        mo.disconnect();
      } catch (e3) {}
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
    if (!isSmartnuoHost()) {
      removeTeamHost();
      return;
    }
    chrome.storage.local.get([LOCAL_SHOW_ALL_FLOATING], function (got) {
      if (chrome.runtime.lastError) {
        if (!teardownFn) teardownFn = mountTeamFloatBar();
        return;
      }
      if (got[LOCAL_SHOW_ALL_FLOATING] === false) {
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
        if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, LOCAL_SHOW_ALL_FLOATING)) {
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
})();
