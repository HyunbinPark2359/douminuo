/**
 * updateToast.js — 업데이트 알림 인페이지 토스트.
 * smartnuo.com 페이지 로드 시 nuo_fmt_pendingUpdateNotice 가 있으면
 * 우상단에 Shadow DOM 토스트를 표시한다.
 * 자체 완결 (nuoCsCommon 의존 없음).
 */
(function () {
  'use strict';

  var CHANGELOG_URL =
    'https://github.com/HyunbinPark2359/douminuo/blob/main/CHANGELOG.md';
  var HOST_ID = 'nuo-fmt-update-toast-host';
  var SK_NOTICE = 'nuo_fmt_pendingUpdateNotice';
  var SK_LAST_SEEN = 'nuo_fmt_lastSeenVersion';
  var AUTO_DISMISS_MS = 8000;

  function isSmartnuoHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'smartnuo.com' || h === 'www.smartnuo.com';
  }

  // TEMPLATES.md v7: context invalidated 방어
  function isExtValid() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch (e) { return false; }
  }

  function teardown() {
    var host = document.getElementById(HOST_ID);
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  function mountToast(version) {
    if (document.getElementById(HOST_ID)) return; // 중복 마운트 방지

    var host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });
    var autoTimer;

    function doActualDismiss() {
      teardown();
      if (!isExtValid()) return;
      chrome.storage.local.set(
        { nuo_fmt_pendingUpdateNotice: null, nuo_fmt_lastSeenVersion: version },
        function () { if (chrome.runtime.lastError) {} }
      );
    }

    function startDismiss() {
      clearTimeout(autoTimer);
      var toastEl = shadow.querySelector('.toast');
      if (!toastEl) { doActualDismiss(); return; }
      var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (rm) { doActualDismiss(); return; }
      toastEl.classList.add('hiding');
      var done = false;
      function onEnd() { if (done) return; done = true; doActualDismiss(); }
      toastEl.addEventListener('animationend', onEnd);
      setTimeout(onEnd, 500);
    }

    var css = [
      ':host { all: initial; }',
      '*, *::before, *::after { box-sizing: border-box; }',
      '.toast {',
      '  position: fixed;',
      '  top: 80px;',
      '  right: 16px;',
      '  z-index: 2147483647;',
      '  background: linear-gradient(180deg, #f7fcfe 0%, #ffffff 42%, #e8f4fa 100%);',
      '  border-radius: 14px;',
      '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(156, 207, 229, 0.65);',
      '  padding: 11px 14px;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  font-family: system-ui, -apple-system, "Malgun Gothic", sans-serif;',
      '  font-size: 13px;',
      '  color: #1e293b;',
      '  line-height: 1.5;',
      '  max-width: 340px;',
      '  animation: nuo-toast-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);',
      '}',
      '@keyframes nuo-toast-in {',
      '  from { opacity: 0; transform: translateX(calc(100% + 32px)); }',
      '  to   { opacity: 1; transform: translateX(0); }',
      '}',
      '@keyframes nuo-toast-out {',
      '  from { opacity: 1; }',
      '  to   { opacity: 0; }',
      '}',
      '.toast.hiding {',
      '  animation: nuo-toast-out 0.25s ease forwards;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .toast         { animation: none !important; }',
      '  .toast.hiding  { animation: none !important; opacity: 0; }',
      '}',
      '.msg { flex: 1; white-space: nowrap; }',
      '.version {',
      '  color: #2563eb;',
      '  text-decoration: underline;',
      '  cursor: pointer;',
      '  font-weight: 600;',
      '}',
      '.version:hover { color: #1d4ed8; }',
      '.dismiss {',
      '  background: none;',
      '  border: none;',
      '  cursor: pointer;',
      '  color: #94a3b8;',
      '  font-size: 15px;',
      '  line-height: 1;',
      '  padding: 0 2px;',
      '  flex-shrink: 0;',
      '}',
      '.dismiss:hover { color: #475569; }',
    ].join('\n');

    // 구조: "도우미누오가 [v1.5.0]으로 업데이트됐어요! [아이콘] [✕]"
    shadow.innerHTML =
      '<style>' + css + '</style>' +
      '<div class="toast">' +
        '<span class="msg">' +
          '도우미누오가 <span class="version"></span>으로 업데이트됐어요!' +
        '</span>' +
        '<button class="dismiss" aria-label="닫기">✕</button>' +
      '</div>';

    // textContent로 삽입 (XSS 방지)
    shadow.querySelector('.version').textContent = 'v' + version;

    // 타이머 상태 추적 (폴링 없이 Date.now() 한 번만 읽음)
    var timerDuration = AUTO_DISMISS_MS;
    var timerStart = Date.now();
    var frozen = false;
    var FREEZE_THRESHOLD = 3000;

    function startAutoTimer(duration) {
      clearTimeout(autoTimer);
      timerDuration = duration;
      timerStart = Date.now();
      autoTimer = setTimeout(startDismiss, duration);
    }

    startAutoTimer(AUTO_DISMISS_MS);

    var toastEl = shadow.querySelector('.toast');
    var isHovered = false;
    var hoverFreezeTimer = null; // hover 중 3초선 진입 감지용

    toastEl.addEventListener('mouseenter', function () {
      isHovered = true;
      if (frozen) return;
      var remaining = timerDuration - (Date.now() - timerStart);
      if (remaining <= FREEZE_THRESHOLD) {
        // 이미 3초 이하: 즉시 동결
        clearTimeout(autoTimer);
        autoTimer = null;
        frozen = true;
      } else {
        // 3초 초과: 타이머 그대로 유지하되,
        // hover 중 3초선 진입 시점에 동결되도록 예약
        clearTimeout(hoverFreezeTimer);
        hoverFreezeTimer = setTimeout(function () {
          if (!isHovered || frozen) return;
          clearTimeout(autoTimer);
          autoTimer = null;
          frozen = true;
        }, remaining - FREEZE_THRESHOLD);
      }
    });

    toastEl.addEventListener('mouseleave', function () {
      isHovered = false;
      clearTimeout(hoverFreezeTimer);
      hoverFreezeTimer = null;
      if (!frozen) return;
      frozen = false;
      // 동결 해제: 3초 타이머 시작
      startAutoTimer(FREEZE_THRESHOLD);
    });

    // 버전 클릭 → CHANGELOG 새 탭 (토스트 유지)
    shadow.querySelector('.version').addEventListener('click', function () {
      window.open(CHANGELOG_URL, '_blank');
    });

    // 닫기 버튼 → fade-out 후 dismiss
    shadow.querySelector('.dismiss').addEventListener('click', function () {
      startDismiss();
    });
  }

  function init() {
    if (!isSmartnuoHost()) return;
    if (!isExtValid()) return;

    chrome.storage.local.get([SK_NOTICE, 'nuo_fmt_updateNoticeEnabled'], function (got) {
      if (chrome.runtime.lastError) return;
      if (got['nuo_fmt_updateNoticeEnabled'] === false) return; // 알림 꺼짐
      var notice = got[SK_NOTICE];
      if (!notice || !notice.version) return; // 알림 없음
      if (notice.shownInPage) return;          // 같은 세션 다른 탭에서 이미 표시

      // shownInPage 먼저 기록한 뒤 마운트 (탭 중복 표시 방지)
      chrome.storage.local.set(
        { nuo_fmt_pendingUpdateNotice: { version: notice.version, shownInPage: true } },
        function () {
          if (chrome.runtime.lastError) return;
          mountToast(notice.version);
        }
      );
    });
  }

  init();
})();
