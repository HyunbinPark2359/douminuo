(function () {
  'use strict';

  var LK = { theme: 'nuo_fmt_theme' };

  function normalizeTheme(v) {
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', normalizeTheme(mode));
  }

  var radios = document.querySelectorAll('input[name="theme"]');

  chrome.storage.local.get([LK.theme], function (got) {
    if (chrome.runtime.lastError) {
      applyTheme('system');
      var sys = document.querySelector('input[name="theme"][value="system"]');
      if (sys) sys.checked = true;
      return;
    }
    var v = normalizeTheme(got[LK.theme]);
    applyTheme(v);
    radios.forEach(function (r) {
      r.checked = r.value === v;
    });
  });

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      var v = normalizeTheme(r.value);
      chrome.storage.local.set({ [LK.theme]: v });
      applyTheme(v);
    });
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local' || !changes[LK.theme]) return;
    var v = normalizeTheme(changes[LK.theme].newValue);
    applyTheme(v);
    radios.forEach(function (radio) {
      radio.checked = radio.value === v;
    });
  });
})();
