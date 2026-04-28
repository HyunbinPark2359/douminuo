(function () {
  'use strict';

  var LK = {
    theme: 'nuo_fmt_theme',
    tbInlineAnnotate: 'nuo_fmt_teamBuilderInlineAnnotate',
    showCalcFloating: 'nuo_fmt_showCalcFloating',
    calcGhostRingEnabled: 'nuo_fmt_calcGhostRingEnabled',
    showTeamBuilderFloating: 'nuo_fmt_showTeamBuilderFloating',
    tbInlineMovePower: 'nuo_fmt_tbInlineMovePower',
    tbInlineBulk: 'nuo_fmt_tbInlineBulk',
    simpleSpeedCalcEnabled: 'nuo_fmt_simpleSpeedCalcEnabled',
    speedTableShow: 'nuo_fmt_speedTableShow',
    speedTableTrigger: 'nuo_fmt_speedTableTrigger',
  };

  function normalizeTheme(v) {
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function normalizeSpeedTableTrigger(v) {
    return v === 'click' ? 'click' : 'hover';
  }

  function applyPopupTheme(mode) {
    document.documentElement.setAttribute('data-theme', normalizeTheme(mode));
  }

  var themeSelectEl = document.getElementById('themeSelect');
  var showCalcFloatingEl = document.getElementById('showCalcFloating');
  var calcGhostRingEnabledEl = document.getElementById('calcGhostRingEnabled');
  var showTeamBuilderFloatingEl = document.getElementById('showTeamBuilderFloating');
  var tbInlineMoveEl = document.getElementById('tbInlineMovePower');
  var tbInlineBulkEl = document.getElementById('tbInlineBulk');
  var simpleSpeedCalcEnabledEl = document.getElementById('simpleSpeedCalcEnabled');
  var speedTableShowEl = document.getElementById('speedTableShow');

  function syncSpeedTableOptionsDisabled() {
    var masterOn = simpleSpeedCalcEnabledEl && simpleSpeedCalcEnabledEl.checked;
    if (speedTableShowEl) {
      speedTableShowEl.disabled = !masterOn;
    }
    var tableOn = masterOn && speedTableShowEl && speedTableShowEl.checked;
    var hov = document.getElementById('speedTableTriggerHover');
    var clk = document.getElementById('speedTableTriggerClick');
    if (hov) hov.disabled = !tableOn;
    if (clk) clk.disabled = !tableOn;
  }

  function syncFloatingHighlightDisabled() {
    var calcOn = showCalcFloatingEl && showCalcFloatingEl.checked;
    if (calcGhostRingEnabledEl) {
      calcGhostRingEnabledEl.disabled = !calcOn;
    }
  }

  function applyExtensionPrefsFromLocal(got) {
    if (chrome.runtime.lastError) {
      applyPopupTheme('system');
      if (themeSelectEl) themeSelectEl.value = 'system';
      if (showCalcFloatingEl) showCalcFloatingEl.checked = true;
      if (calcGhostRingEnabledEl) calcGhostRingEnabledEl.checked = true;
      if (showTeamBuilderFloatingEl) showTeamBuilderFloatingEl.checked = true;
      if (tbInlineMoveEl) tbInlineMoveEl.checked = true;
      if (tbInlineBulkEl) tbInlineBulkEl.checked = true;
      if (simpleSpeedCalcEnabledEl) simpleSpeedCalcEnabledEl.checked = true;
      if (speedTableShowEl) speedTableShowEl.checked = true;
      var hov = document.getElementById('speedTableTriggerHover');
      var clk = document.getElementById('speedTableTriggerClick');
      if (hov) hov.checked = true;
      if (clk) clk.checked = false;
      syncSpeedTableOptionsDisabled();
      syncFloatingHighlightDisabled();
      return;
    }
    var v = normalizeTheme(got[LK.theme]);
    applyPopupTheme(v);
    if (themeSelectEl) themeSelectEl.value = v;
    if (showCalcFloatingEl) {
      showCalcFloatingEl.checked = got[LK.showCalcFloating] !== false;
    }
    if (calcGhostRingEnabledEl) {
      calcGhostRingEnabledEl.checked = got[LK.calcGhostRingEnabled] !== false;
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

    if (simpleSpeedCalcEnabledEl) {
      simpleSpeedCalcEnabledEl.checked = got[LK.simpleSpeedCalcEnabled] !== false;
    }
    if (speedTableShowEl) {
      speedTableShowEl.checked = got[LK.speedTableShow] !== false;
    }
    var trig = normalizeSpeedTableTrigger(got[LK.speedTableTrigger]);
    var hovEl = document.getElementById('speedTableTriggerHover');
    var clkEl = document.getElementById('speedTableTriggerClick');
    if (hovEl && clkEl) {
      if (trig === 'click') {
        clkEl.checked = true;
        hovEl.checked = false;
      } else {
        hovEl.checked = true;
        clkEl.checked = false;
      }
    }
    syncSpeedTableOptionsDisabled();
    syncFloatingHighlightDisabled();
  }

  var EXTENSION_PREF_KEYS = [
    LK.theme,
    LK.showCalcFloating,
    LK.calcGhostRingEnabled,
    LK.showTeamBuilderFloating,
    LK.tbInlineMovePower,
    LK.tbInlineBulk,
    LK.tbInlineAnnotate,
    LK.simpleSpeedCalcEnabled,
    LK.speedTableShow,
    LK.speedTableTrigger,
  ];

  chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var hit =
      Object.prototype.hasOwnProperty.call(changes, LK.theme) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showCalcFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.calcGhostRingEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.showTeamBuilderFloating) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineMovePower) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineBulk) ||
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineAnnotate) ||
      Object.prototype.hasOwnProperty.call(changes, LK.simpleSpeedCalcEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.speedTableShow) ||
      Object.prototype.hasOwnProperty.call(changes, LK.speedTableTrigger);
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
      syncFloatingHighlightDisabled();
    });
  }
  if (calcGhostRingEnabledEl) {
    calcGhostRingEnabledEl.addEventListener('change', function () {
      chrome.storage.local.set({
        [LK.calcGhostRingEnabled]: !!calcGhostRingEnabledEl.checked,
      });
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
      syncSpeedTableOptionsDisabled();
    });
  }
  if (speedTableShowEl) {
    speedTableShowEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.speedTableShow]: !!speedTableShowEl.checked });
      syncSpeedTableOptionsDisabled();
    });
  }

  function persistSpeedTableTriggerFromRadios() {
    var clkEl = document.getElementById('speedTableTriggerClick');
    var v =
      clkEl && clkEl.checked ? 'click' : 'hover';
    chrome.storage.local.set({ [LK.speedTableTrigger]: v });
  }

  var hovRadio = document.getElementById('speedTableTriggerHover');
  var clkRadio = document.getElementById('speedTableTriggerClick');
  if (hovRadio) {
    hovRadio.addEventListener('change', function () {
      if (hovRadio.checked) persistSpeedTableTriggerFromRadios();
    });
  }
  if (clkRadio) {
    clkRadio.addEventListener('change', function () {
      if (clkRadio.checked) persistSpeedTableTriggerFromRadios();
    });
  }
})();
