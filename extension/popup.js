(function () {
  'use strict';

  // iframe embed 모드 (?embed=1): body.embed 클래스 부여 + 콘텐츠 높이를 부모 프레임에 전달
  if (location.search.indexOf('embed=1') >= 0) {
    document.body.classList.add('embed');
    function sendEmbedHeight() {
      var h = document.body.scrollHeight;
      if (h > 0) {
        window.parent.postMessage({
          source: 'nuo-popup-embed',
          type: 'NUO_POPUP_EMBED_HEIGHT',
          height: h
        }, '*');
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sendEmbedHeight);
    } else {
      sendEmbedHeight();
    }
  }

  var LK = {
    theme: 'nuo_fmt_theme',
    showCalcFloating: 'nuo_fmt_showCalcFloating',
    showTeamBuilderFloating: 'nuo_fmt_showTeamBuilderFloating',
    tbInlineEnabled: 'nuo_fmt_tbInlineEnabled',
    simpleSpeedCalcEnabled: 'nuo_fmt_simpleSpeedCalcEnabled',
    updateNoticeEnabled: 'nuo_fmt_updateNoticeEnabled',
  };

  function normalizeTheme(v) {
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function applyPopupTheme(mode) {
    document.documentElement.setAttribute('data-theme', normalizeTheme(mode));
  }

  var themeSelectEl = document.getElementById('themeSelect');
  var showCalcFloatingEl = document.getElementById('showCalcFloating');
  var showTeamBuilderFloatingEl = document.getElementById('showTeamBuilderFloating');
  var tbInlineEnabledEl = document.getElementById('tbInlineEnabled');
  var simpleSpeedCalcEnabledEl = document.getElementById('simpleSpeedCalcEnabled');
  var updateNoticeEnabledEl = document.getElementById('updateNoticeEnabled');

  // 헤더 우상단의 버전 표시. manifest 의 version 을 단일 진실로 삼고
  // 동적으로 주입한다 — 매니페스트 한 곳만 갱신하면 팝업도 따라옴.
  var popupVersionEl = document.getElementById('popupVersion');
  if (popupVersionEl) {
    try {
      var mf = chrome.runtime.getManifest();
      var ver = mf && mf.version ? String(mf.version) : '';
      if (ver) {
        popupVersionEl.textContent = 'v' + ver;
      } else {
        popupVersionEl.style.display = 'none';
      }
    } catch (e) {
      popupVersionEl.style.display = 'none';
    }
  }

  function applyExtensionPrefsFromLocal(got) {
    if (chrome.runtime.lastError) {
      applyPopupTheme('system');
      if (themeSelectEl) themeSelectEl.value = 'system';
      if (showCalcFloatingEl) showCalcFloatingEl.checked = true;
      if (showTeamBuilderFloatingEl) showTeamBuilderFloatingEl.checked = true;
      if (tbInlineEnabledEl) tbInlineEnabledEl.checked = true;
      if (simpleSpeedCalcEnabledEl) simpleSpeedCalcEnabledEl.checked = true;
      if (updateNoticeEnabledEl) updateNoticeEnabledEl.checked = true;
      return;
    }
    var v = normalizeTheme(got[LK.theme]);
    applyPopupTheme(v);
    if (themeSelectEl) themeSelectEl.value = v;
    if (showCalcFloatingEl) {
      showCalcFloatingEl.checked = got[LK.showCalcFloating] !== false;
    }
    if (showTeamBuilderFloatingEl) {
      var teamF = got[LK.showTeamBuilderFloating];
      if (teamF === undefined) teamF = got[LK.showCalcFloating];
      showTeamBuilderFloatingEl.checked = teamF !== false;
    }
    if (tbInlineEnabledEl) {
      tbInlineEnabledEl.checked = got[LK.tbInlineEnabled] !== false;
    }
    if (simpleSpeedCalcEnabledEl) {
      simpleSpeedCalcEnabledEl.checked = got[LK.simpleSpeedCalcEnabled] !== false;
    }
    if (updateNoticeEnabledEl) {
      updateNoticeEnabledEl.checked = got[LK.updateNoticeEnabled] !== false;
    }
  }

  var EXTENSION_PREF_KEYS = [
    LK.theme,
    LK.showCalcFloating,
    LK.showTeamBuilderFloating,
    LK.tbInlineEnabled,
    LK.simpleSpeedCalcEnabled,
    LK.updateNoticeEnabled,
  ];

  chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var hit =
      Object.prototype.hasOwnProperty.call(changes, LK.theme) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showCalcFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showTeamBuilderFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.simpleSpeedCalcEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.updateNoticeEnabled);
    if (!hit) return;
    chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);
  });

  if (themeSelectEl) {
    themeSelectEl.addEventListener('change', function () {
      var nv = normalizeTheme(themeSelectEl.value);
      chrome.storage.local.set({ [LK.theme]: nv });
      applyPopupTheme(nv);
    });
  }

  if (tbInlineEnabledEl) {
    tbInlineEnabledEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.tbInlineEnabled]: !!tbInlineEnabledEl.checked });
    });
  }

  if (showCalcFloatingEl) {
    showCalcFloatingEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.showCalcFloating]: !!showCalcFloatingEl.checked });
    });
  }
  if (showTeamBuilderFloatingEl) {
    showTeamBuilderFloatingEl.addEventListener('change', function () {
      chrome.storage.local.set({
        [LK.showTeamBuilderFloating]: !!showTeamBuilderFloatingEl.checked,
      });
    });
  }

  if (simpleSpeedCalcEnabledEl) {
    simpleSpeedCalcEnabledEl.addEventListener('change', function () {
      chrome.storage.local.set({
        [LK.simpleSpeedCalcEnabled]: !!simpleSpeedCalcEnabledEl.checked,
      });
    });
  }

  if (updateNoticeEnabledEl) {
    updateNoticeEnabledEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.updateNoticeEnabled]: !!updateNoticeEnabledEl.checked });
    });
  }
})();
