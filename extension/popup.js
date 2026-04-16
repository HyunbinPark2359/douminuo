(function () {
  'use strict';

  var LK = {
    theme: 'nuo_fmt_theme',
    tbInlineAnnotate: 'nuo_fmt_teamBuilderInlineAnnotate',
    showCalcFloating: 'nuo_fmt_showCalcFloating',
    showTeamBuilderFloating: 'nuo_fmt_showTeamBuilderFloating',
    tbInlineMovePower: 'nuo_fmt_tbInlineMovePower',
    tbInlineBulk: 'nuo_fmt_tbInlineBulk',
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
  var tbInlineMoveEl = document.getElementById('tbInlineMovePower');
  var tbInlineBulkEl = document.getElementById('tbInlineBulk');

  function applyExtensionPrefsFromLocal(got) {
    if (chrome.runtime.lastError) {
      applyPopupTheme('system');
      if (themeSelectEl) themeSelectEl.value = 'system';
      if (showCalcFloatingEl) showCalcFloatingEl.checked = true;
      if (showTeamBuilderFloatingEl) showTeamBuilderFloatingEl.checked = true;
      if (tbInlineMoveEl) tbInlineMoveEl.checked = true;
      if (tbInlineBulkEl) tbInlineBulkEl.checked = true;
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
    var m = got[LK.tbInlineMovePower];
    var b = got[LK.tbInlineBulk];
    var leg = got[LK.tbInlineAnnotate];
    if (m === undefined && b === undefined && leg !== undefined) {
      m = b = leg !== false;
    } else {
      if (m === undefined) m = true;
      if (b === undefined) b = true;
    }
    if (tbInlineMoveEl) tbInlineMoveEl.checked = m !== false;
    if (tbInlineBulkEl) tbInlineBulkEl.checked = b !== false;
  }

  var EXTENSION_PREF_KEYS = [
    LK.theme,
    LK.showCalcFloating,
    LK.showTeamBuilderFloating,
    LK.tbInlineMovePower,
    LK.tbInlineBulk,
    LK.tbInlineAnnotate,
  ];

  chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var hit =
      Object.prototype.hasOwnProperty.call(changes, LK.theme) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showCalcFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showTeamBuilderFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineMovePower) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineBulk) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineAnnotate);
    if (!hit) return;
    chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);
  });

  if (themeSelectEl) {
    themeSelectEl.addEventListener('change', function () {
      var v = normalizeTheme(themeSelectEl.value);
      chrome.storage.local.set({ [LK.theme]: v });
      applyPopupTheme(v);
    });
  }

  if (tbInlineMoveEl) {
    tbInlineMoveEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.tbInlineMovePower]: !!tbInlineMoveEl.checked });
    });
  }
  if (tbInlineBulkEl) {
    tbInlineBulkEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.tbInlineBulk]: !!tbInlineBulkEl.checked });
    });
  }

  if (showCalcFloatingEl) {
    showCalcFloatingEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.showCalcFloating]: !!showCalcFloatingEl.checked });
    });
  }
  if (showTeamBuilderFloatingEl) {
    showTeamBuilderFloatingEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.showTeamBuilderFloating]: !!showTeamBuilderFloatingEl.checked });
    });
  }
})();
