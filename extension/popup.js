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
    // 웹폰트 적용 뒤 높이 — 부모 모달이 이 메시지를 받고 나서 등장하므로 글꼴 교체 번쩍임이 안 보임.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sendEmbedHeight);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sendEmbedHeight);
    } else {
      sendEmbedHeight();
    }
  }

  var LK = {
    tbInlineEnabled: 'nuo_fmt_tbInlineEnabled',
    simpleSpeedCalcEnabled: 'nuo_fmt_simpleSpeedCalcEnabled',
    updateNoticeEnabled: 'nuo_fmt_updateNoticeEnabled',
  };

  /** 샘플 복사 옵션 — teamBuilderFill.readFormatOptions 와 같은 키·기본값 (URL 만 기본 on). */
  var FMT = [
    { id: 'optUrls', key: 'nuo_fmt_includeUrls', def: true },
    { id: 'optReal', key: 'nuo_fmt_includeRealStats', def: false },
    { id: 'optPow', key: 'nuo_fmt_includeMovePowers', def: false },
    { id: 'optBulk', key: 'nuo_fmt_includeBulkStats', def: false },
    { id: 'optSd', key: 'nuo_fmt_showdownPaste', def: false }
  ];
  var FMT_KEYS = FMT.map(function (f) { return f.key; });

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
      if (tbInlineEnabledEl) tbInlineEnabledEl.checked = true;
      if (simpleSpeedCalcEnabledEl) simpleSpeedCalcEnabledEl.checked = true;
      if (updateNoticeEnabledEl) updateNoticeEnabledEl.checked = true;
      return;
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

  /** Showdown 켜지면 나머지 4개 잠금 (옛 FAB applyShowdownLockUi 와 동일 규칙). */
  function applyShowdownLock() {
    var sd = document.getElementById('optSd');
    var on = !!(sd && sd.checked);
    FMT.forEach(function (f) {
      if (f.id === 'optSd') return;
      var el = document.getElementById(f.id);
      if (!el) return;
      el.disabled = on;
      el.parentElement.classList.toggle('is-muted', on);
    });
  }

  function applyFormatOptions(got) {
    var err = !!chrome.runtime.lastError;
    FMT.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      var v = err ? undefined : got[f.key];
      el.checked = f.def ? v !== false : !!v;
    });
    applyShowdownLock();
  }

  var EXTENSION_PREF_KEYS = [
    LK.tbInlineEnabled,
    LK.simpleSpeedCalcEnabled,
    LK.updateNoticeEnabled,
  ];

  chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);
  chrome.storage.local.get(FMT_KEYS, applyFormatOptions);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (FMT_KEYS.some(function (k) { return Object.prototype.hasOwnProperty.call(changes, k); })) {
      chrome.storage.local.get(FMT_KEYS, applyFormatOptions);
    }
    var hit =
      Object.prototype.hasOwnProperty.call(changes, LK.tbInlineEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.simpleSpeedCalcEnabled) ||
      Object.prototype.hasOwnProperty.call(changes, LK.updateNoticeEnabled);
    if (!hit) return;
    chrome.storage.local.get(EXTENSION_PREF_KEYS, applyExtensionPrefsFromLocal);
  });

  FMT.forEach(function (f) {
    var el = document.getElementById(f.id);
    if (!el) return;
    el.addEventListener('change', function () {
      var o = {};
      o[f.key] = !!el.checked;
      chrome.storage.local.set(o);
      applyShowdownLock();
    });
  });

  if (tbInlineEnabledEl) {
    tbInlineEnabledEl.addEventListener('change', function () {
      chrome.storage.local.set({ [LK.tbInlineEnabled]: !!tbInlineEnabledEl.checked });
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
