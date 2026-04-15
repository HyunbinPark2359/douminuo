(function () {
  'use strict';

  var LK = { theme: 'nuo_fmt_theme', tbInlineAnnotate: 'nuo_fmt_teamBuilderInlineAnnotate' };

  function normalizeTheme(v) {
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', normalizeTheme(mode));
  }

  var radios = document.querySelectorAll('input[name="theme"]');
  var tbInlineChk = document.getElementById('tbInlineAnnotate');

  chrome.storage.local.get([LK.theme, LK.tbInlineAnnotate], function (got) {
    if (chrome.runtime.lastError) {
      applyTheme('system');
      var sys = document.querySelector('input[name="theme"][value="system"]');
      if (sys) sys.checked = true;
      if (tbInlineChk) tbInlineChk.checked = true;
      return;
    }
    var v = normalizeTheme(got[LK.theme]);
    applyTheme(v);
    radios.forEach(function (r) {
      r.checked = r.value === v;
    });
    if (tbInlineChk) {
      tbInlineChk.checked = got[LK.tbInlineAnnotate] !== false;
    }
  });

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      var v = normalizeTheme(r.value);
      chrome.storage.local.set({ [LK.theme]: v });
      applyTheme(v);
    });
  });

  if (tbInlineChk) {
    tbInlineChk.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.tbInlineAnnotate]: !!tbInlineChk.checked });
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes[LK.theme]) {
      var v = normalizeTheme(changes[LK.theme].newValue);
      applyTheme(v);
      radios.forEach(function (radio) {
        radio.checked = radio.value === v;
      });
    }
    if (changes[LK.tbInlineAnnotate] && tbInlineChk) {
      tbInlineChk.checked = changes[LK.tbInlineAnnotate].newValue !== false;
    }
  });
})();
