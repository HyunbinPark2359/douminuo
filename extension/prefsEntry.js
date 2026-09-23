/**
 * 중앙 버튼 열 `도우미` 버튼 + 환경설정 모달(popup.html?embed=1 iframe). REDESIGN §4.1 C.
 * 옛 계산기/팀빌더 FAB gear 의 중복 openPrefsModal 을 대체하는 단일 소유자.
 */
(function () {
  'use strict';

  var CS = globalThis.nuoCsCommon || {};
  if (typeof CS.keepInjected !== 'function') return;

  var MODAL_HOST_ID = 'nuo-fmt-prefs-modal-host';
  var X_SVG = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="1.5" y1="1.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="1.5" x2="1.5" y2="10.5"/></svg>';
  var css = (globalThis.nuoTokensCss || '') + '\n' + (globalThis.nuoPrefsModalCss || '');
  var escHandler = null;
  var heightHandler = null;
  var LEAVE_MS = 150; // 사이트 p-dialog-leave-active 와 동일

  function onSupportedRoute() {
    var r = CS.getRoute ? CS.getRoute() : 'other';
    return r === 'calc' || r === 'calc-speed' || r === 'team';
  }

  /** 중앙 버튼 열 = 보이는 `초기화` 버튼의 부모 (파티·계산기·스피드 공통). 맨 끝에 추가. */
  function findCenterColumn() {
    var list = document.querySelectorAll('button');
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].textContent.trim() === '초기화' && list[i].offsetParent !== null) {
        return { parent: list[i].parentElement, before: null };
      }
    }
    return null;
  }

  /** 닫힘 = 사이트 Dialog leave 모션(역재생) 후 제거. 재진입 가드는 host id 가 제거 시점까지 유지. */
  function close() {
    var h = document.getElementById(MODAL_HOST_ID);
    if (h && !h.getAttribute('data-leaving')) {
      h.setAttribute('data-leaving', '1');
      var bd = h.shadowRoot && h.shadowRoot.querySelector('.backdrop');
      if (bd) bd.classList.remove('on');
      setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, LEAVE_MS);
    }
    if (escHandler) { document.removeEventListener('keydown', escHandler, true); escHandler = null; }
    if (heightHandler) { window.removeEventListener('message', heightHandler); heightHandler = null; }
  }

  function open() {
    if (document.getElementById(MODAL_HOST_ID)) return;
    if (!chrome.runtime || !chrome.runtime.id) return;
    var host = document.createElement('div');
    host.id = MODAL_HOST_ID;
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' + css + '</style>' +
      '<div class="backdrop" role="dialog" aria-modal="true" aria-label="환경설정">' +
      '  <div class="box">' +
      '    <button type="button" class="close" aria-label="닫기">' + X_SVG + '</button>' +
      '    <iframe class="frame" title="환경설정"></iframe>' +
      '  </div>' +
      '</div>';
    var frame = root.querySelector('.frame');
    var box = root.querySelector('.box');
    var backdrop = root.querySelector('.backdrop');
    // dim 은 바로, 박스는 iframe 이 제 높이를 알려 준 뒤 등장 — 빈 박스·높이 점프 안 보이게.
    // 메시지가 안 오면(로드 실패 등) 600ms 뒤 그냥 보임.
    function reveal() { box.classList.add('ready'); }
    var revealTimer = setTimeout(reveal, 600);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { backdrop.classList.add('on'); });
    });
    frame.src = chrome.runtime.getURL('popup.html') + '?embed=1';
    frame.addEventListener('load', function () {
      try { frame.contentWindow.focus(); } catch (eF) {}
    });
    root.querySelector('.close').addEventListener('click', close);
    root.querySelector('.backdrop').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) close();
    });
    escHandler = function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) close();
    };
    document.addEventListener('keydown', escHandler, true);
    heightHandler = function (ev) {
      if (!ev.data || ev.data.source !== 'nuo-popup-embed' || ev.data.type !== 'NUO_POPUP_EMBED_HEIGHT') return;
      var h = Number(ev.data.height);
      if (h > 0) frame.style.height = Math.min(h + 2, 580) + 'px';
      clearTimeout(revealTimer);
      requestAnimationFrame(reveal);
    };
    window.addEventListener('message', heightHandler);
  }

  CS.keepInjected({
    key: 'prefs-entry',
    enabled: onSupportedRoute,
    find: findCenterColumn,
    build: function (root) {
      root.innerHTML = '<style>:host{all:initial;display:block}\n' + css + '</style>' +
        '<button type="button" class="entry" aria-label="도우미누오 환경설정">도우미</button>';
      root.querySelector('.entry').addEventListener('click', open);
    }
  });

  if (CS.onRouteChange) CS.onRouteChange(close);

  globalThis.nuoPrefsModal = { open: open, close: close };
})();
