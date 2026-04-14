/**
 * 스마트누오 팀빌더: 우하단 FAB — 파티 대형 버튼, 호버 시 위쪽 6슬롯·왼쪽 설정.
 * 파티/슬롯: 서버·포맷 로직은 기존과 동일. 옵션은 chrome.storage.local(팝업과 동일).
 * 성공: 버튼 피드백(스피너→체크 애니메이션 후 페이드). 오류: FAB 위 토스트.
 * 계산기 화면은 calcFill.js 와 같은 본문 휴리스틱으로 플로팅 숨김.
 * 슬롯 갱신: MutationObserver + hashchange.
 * 슬롯 썸네일: teamBuilderBridge가 슬롯별 `pokemon.sprite`(PokeAPI raw)로 slotArt[6] 제공.
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
          slotArt: d.slotArt,
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
    var CHECK_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
      '</svg>';

    /** Font Awesome Free v7.2.0 "copy" solid — https://fontawesome.com/icons/copy?f=classic&s=solid — https://fontawesome.com/license/free */
    var COPY_ICON_SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">' +
      '<path d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/>' +
      '</svg>';

    var SPINNER_SVG =
      '<span class="fab-spinner-wrap">' +
      '<svg class="fab-spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-dasharray="14 32"/>' +
      '</svg></span>';
    var BAN_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" />' +
      '<path stroke-linecap="round" d="M7 7l10 10" />' +
      '</svg>';
    var BAN_SVG_SLIM =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10" />' +
      '<path d="M4.9 4.9l14.2 14.2" />' +
      '</svg>';
    /** 테이블 + 우하단 포켓볼(사용자 SVG 합성). mask 로 겹치는 격자선 제거, 그림자로 포켓볼 위 레이어 느낌 */
    var PARTY_ICON_SVG =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4.75 -8 66 88" fill="none" overflow="visible" aria-hidden="true">' +
      '<defs>' +
      '<mask id="nuoTbPartyTblMask">' +
      '<rect x="-4.75" y="-8" width="66" height="88" fill="white"/>' +
      '<circle cx="41" cy="57.5" r="25" fill="black"/>' +
      '</mask>' +
      '<filter id="nuoTbPartyBallLift" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feDropShadow dx="0" dy="1.25" stdDeviation="1.35" flood-color="#0f172a" flood-opacity="0.3"/>' +
      '</filter>' +
      '</defs>' +
      '<g mask="url(#nuoTbPartyTblMask)">' +
      '<rect x="4" y="4" width="40" height="56" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
      '<line x1="4" y1="22.66" x2="44" y2="22.66" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="4" y1="41.33" x2="44" y2="41.33" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="24" y1="4" x2="24" y2="60" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '</g>' +
      '<g filter="url(#nuoTbPartyBallLift)" transform="translate(41, 57.5) scale(0.88) translate(-24, -24)">' +
      '<circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
      '<line x1="4" y1="24" x2="17" y2="24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="31" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
      '</g>' +
      '</svg>';
    function fabFeedbackHtml() {
      return (
        '<span class="fab-btn-feedback" aria-hidden="true">' +
        '<span class="fab-fb-hover"><span class="fab-fb-hover-bg"></span><span class="fab-fb-hover-ic">' +
        COPY_ICON_SVG +
        '</span></span>' +
        '<span class="fab-fb-busy"><span class="fab-fb-busy-bg"></span><span class="fab-fb-busy-ic">' +
        SPINNER_SVG +
        '</span></span>' +
        '<span class="fab-fb-done"><span class="fab-fb-done-bg"></span><span class="fab-fb-done-ic">' +
        CHECK_SVG +
        '</span></span>' +
        '<span class="fab-fb-err"><span class="fab-fb-err-bg"></span><span class="fab-fb-err-ic">' +
        BAN_SVG +
        '</span></span></span>'
      );
    }
    /** 슬롯만: 호버 시 복사 대신 회색 금지 아이콘(빈 칸용) */
    function fabSlotFeedbackHtml() {
      return (
        '<span class="fab-btn-feedback" aria-hidden="true">' +
        '<span class="fab-fb-hover"><span class="fab-fb-hover-bg"></span>' +
        '<span class="fab-fb-hover-ic">' +
        COPY_ICON_SVG +
        '</span>' +
        '<span class="fab-fb-hover-ban-ic">' +
        BAN_SVG_SLIM +
        '</span></span>' +
        '<span class="fab-fb-busy"><span class="fab-fb-busy-bg"></span><span class="fab-fb-busy-ic">' +
        SPINNER_SVG +
        '</span></span>' +
        '<span class="fab-fb-done"><span class="fab-fb-done-bg"></span><span class="fab-fb-done-ic">' +
        CHECK_SVG +
        '</span></span>' +
        '<span class="fab-fb-err"><span class="fab-fb-err-bg"></span><span class="fab-fb-err-ic">' +
        BAN_SVG +
        '</span></span></span>'
      );
    }
    root.innerHTML =
      '<style>' +
      ':host { all: initial; }' +
      '* { box-sizing: border-box; font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }' +
      '@keyframes nuo-tb-glow {' +
      '  0%, 100% { box-shadow: 0 4px 14px rgba(156, 207, 229, 0.32), 0 0 0 1px rgba(156, 207, 229, 0.35); }' +
      '  50% { box-shadow: 0 6px 18px rgba(120, 185, 210, 0.34), 0 0 0 1px rgba(156, 207, 229, 0.48); }' +
      '}' +
      '.fab-root {' +
      '  position: fixed; z-index: 2147483645; right: clamp(24px, 5vw, 48px); bottom: clamp(24px, 5vw, 48px);' +
      '  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;' +
      '}' +
      '.fab-root.nuo-tb-off { opacity: 0; pointer-events: none; visibility: hidden; }' +
      '.fab-per-btn-toast {' +
      '  padding: 8px 10px; font-size: 12px; line-height: 1.35;' +
      '  color: #991b1b; background: #fff1f2; border: 1px solid #fecaca;' +
      '  border-radius: 10px; word-break: keep-all; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);' +
      '  flex-shrink: 0; z-index: 6;' +
      '}' +
      '.fab-per-btn-toast.nuo-hidden { display: none; }' +
      '.fab-slot-row .fab-per-btn-toast {' +
      '  max-width: min(220px, calc(100vw - 128px));' +
      '}' +
      '.fab-per-btn-toast--below {' +
      '  max-width: min(280px, calc(100vw - 48px)); width: max-content; align-self: center;' +
      '}' +
      '.fab-inner {' +
      '  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;' +
      '}' +
      '.fab-dock { position: relative; display: inline-block; vertical-align: bottom; }' +
      '.fab-dock-main {' +
      '  position: relative; width: 80px; display: flex; flex-direction: column; align-items: center;' +
      '}' +
      '.fab-party-col {' +
      '  position: relative; width: 80px; min-height: 80px; display: flex; flex-direction: column;' +
      '  align-items: center; justify-content: flex-end;' +
      '}' +
      '.fab-party-wrap {' +
      '  position: relative; display: flex; flex-direction: column; align-items: center; width: 80px;' +
      '}' +
      '.fab-slot-row {' +
      '  position: relative; width: 80px; height: 62px; display: flex; align-items: center; justify-content: center;' +
      '  flex-shrink: 0; overflow: visible;' +
      '}' +
      '.fab-slot-row .fab-per-btn-toast {' +
      '  position: absolute; right: calc(100% + 8px); top: 50%; transform: translateY(-50%);' +
      '  text-align: left;' +
      '}' +
      '.fab-per-btn-toast--below {' +
      '  position: static; margin-top: 8px; transform: none; text-align: center;' +
      '}' +
      '.fab-slots {' +
      '  position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 1;' +
      '  display: flex; flex-direction: column; align-items: center; gap: 8px; width: 80px;' +
      '  overflow: visible;' +
      '  opacity: 0; visibility: hidden; pointer-events: none;' +
      '  transition: opacity 0.09s ease, visibility 0.09s;' +
      '}' +
      '.fab-dock--open .fab-slots {' +
      '  opacity: 1; visibility: visible; pointer-events: auto;' +
      '}' +
      '.fab-settings-wrap {' +
      '  position: absolute; right: calc(100% + 12px); bottom: 0; z-index: 2;' +
      '  opacity: 0; visibility: hidden; pointer-events: none;' +
      '  transition: opacity 0.09s ease, visibility 0.09s;' +
      '}' +
      '.fab-dock--open .fab-settings-wrap {' +
      '  opacity: 1; visibility: visible; pointer-events: auto;' +
      '}' +
      '.fab-btn {' +
      '  position: relative; border: none; cursor: pointer; display: inline-flex; align-items: center;' +
      '  justify-content: center; flex-shrink: 0; border-radius: 50%; color: #0f172a;' +
      '}' +
      '.fab-btn:not(:disabled) {' +
      '  background: linear-gradient(155deg, #f7fcfe 0%, #c5e8f4 40%, #9ccfe5 100%);' +
      '  animation: nuo-tb-glow 3.4s ease-in-out -0.6s infinite;' +
      '  transition: transform 0.22s ease, filter 0.2s ease, opacity 0.2s ease;' +
      '}' +
      '.fab-btn:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):not(.fab-copy-error):hover {' +
      '  transform: scale(1.06); filter: brightness(1.02) saturate(1.03);' +
      '}' +
      '/* 슬롯 빈/안빈·파티 동일: nuo-tb-glow + fab-click-bounce. 빈슬롯 기본 animation:none 은 !important 로 덮음 */' +
      '.fab-btn.fab-copy-click-pulse:not(:disabled):not(.fab-copy-error) {' +
      '  animation: nuo-tb-glow 3.4s ease-in-out -0.6s infinite, fab-click-bounce 0.1s cubic-bezier(0.22, 1, 0.36, 1) !important;' +
      '}' +
      '/* 눌림: 즉시 축소. 뗌 후에는 fab-copy-click-pulse 바운스로 복귀 */' +
      '.fab-btn:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):not(.fab-copy-error):active,' +
      '.fab-btn.fab-btn--press:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):not(.fab-copy-error) {' +
      '  transform: scale(0.92); filter: brightness(0.98) saturate(0.98);' +
      '  transition: none !important;' +
      '}' +
      '.fab-btn:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):not(.fab-copy-error):hover:active,' +
      '.fab-btn.fab-btn--press:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):not(.fab-copy-error):hover {' +
      '  transform: scale(0.975); filter: brightness(1) saturate(1.01);' +
      '  transition: none !important;' +
      '}' +
      '.fab-btn:disabled {' +
      '  cursor: not-allowed; opacity: 0.72; filter: saturate(0.45) brightness(0.96);' +
      '  animation: none;' +
      '  background: linear-gradient(155deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%);' +
      '  color: #64748b; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.35);' +
      '}' +
      '.fab-slot { width: 62px; height: 62px; border-radius: 50%; font-size: 16px; font-weight: 700; overflow: hidden; }' +
      '.fab-slot-label { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }' +
      '.fab-slot-mon {' +
      '  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);' +
      '  max-width: 82%; max-height: 82%; width: auto; height: auto;' +
      '  object-fit: contain; display: none; pointer-events: none;' +
      '}' +
      '.fab-slot.fab-slot--has-mon .fab-slot-mon { display: block; }' +
      '.fab-slot.fab-slot--has-mon .fab-slot-fallback-num { display: none; }' +
      '.fab-slot-fallback-num { pointer-events: none; }' +
      '.fab-fb-hover-ban-ic {' +
      '  display: none; position: relative; z-index: 1; align-items: center; justify-content: center;' +
      '  width: 100%; height: 100%;' +
      '}' +
      '.fab-fb-hover-ban-ic svg {' +
      '  width: 105%; height: 105%; max-width: none; max-height: none; flex-shrink: 0; color: #a8b3c4;' +
      '}' +
      '.fab-btn.fab-slot:not(.fab-slot--empty) .fab-fb-hover-ban-ic {' +
      '  display: none !important;' +
      '}' +
      '.fab-btn.fab-slot.fab-slot--empty .fab-fb-hover-ic {' +
      '  display: none !important;' +
      '}' +
      '.fab-btn.fab-slot.fab-slot--empty .fab-fb-hover-ban-ic {' +
      '  display: flex;' +
      '}' +
      '.fab-btn.fab-slot.fab-slot--empty {' +
      '  cursor: pointer;' +
      '  animation: none !important;' +
      '  opacity: 0.72; filter: saturate(0.45) brightness(0.96);' +
      '  background: linear-gradient(155deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%);' +
      '  color: #64748b; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.35);' +
      '}' +
      '.fab-party {' +
      '  width: 80px; height: 80px; border-radius: 50%; overflow: visible;' +
      '}' +
      '.fab-btn.fab-party:not(:disabled) {' +
      '  color: #2a6f8f;' +
      '}' +
      '.fab-party .fab-party-icon {' +
      '  display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: visible;' +
      '}' +
      '.fab-party .fab-party-icon svg {' +
      '  display: block; width: auto; height: 52px; max-height: 65%; flex-shrink: 0; margin: 0 auto;' +
      '  color: inherit; overflow: visible;' +
      '}' +
      '.fab-settings-morph {' +
      '  position: relative; width: 52px; min-height: 52px; max-height: 52px; border-radius: 26px;' +
      '  overflow: hidden;' +
      '  background: linear-gradient(155deg, #f7fcfe 0%, #c5e8f4 40%, #9ccfe5 100%);' +
      '  color: #2a6f8f;' +
      '  animation: nuo-tb-glow 3.4s ease-in-out -0.6s infinite;' +
      '  cursor: pointer;' +
      '  transition: width 0.22s ease, min-height 0.24s ease, max-height 0.24s ease, border-radius 0.2s ease,' +
      '    box-shadow 0.35s ease, filter 0.2s ease, transform 0.22s ease;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-morph {' +
      '  display: flex; flex-direction: column; cursor: default;' +
      '  width: min(92vw, 147px); min-height: 168px; max-height: min(52vh, 300px); border-radius: 14px;' +
      '  overflow: hidden; animation: none;' +
      '  background: linear-gradient(180deg, #f7fcfe 0%, #ffffff 42%, #e8f4fa 100%);' +
      '  color: #0f172a;' +
      '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(156, 207, 229, 0.65);' +
      '}' +
      '.fab-settings-gear {' +
      '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
      '  pointer-events: none; transition: opacity 0.12s ease;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-gear {' +
      '  opacity: 0;' +
      '}' +
      '.fab-settings-morph:focus-visible { outline: 2px solid #6eb0cc; outline-offset: 3px; }' +
      '.fab-btn-label { pointer-events: none; position: relative; z-index: 0; }' +
      '.fab-slot .fab-btn-label { position: absolute; inset: 0; }' +
      '@keyframes fab-click-bounce {' +
      '  0% { transform: scale(1); }' +
      '  9% { transform: scale(0.993); }' +
      '  20% { transform: scale(0.982); }' +
      '  32% { transform: scale(0.972); }' +
      '  44% { transform: scale(0.964); }' +
      '  52% { transform: scale(0.96); }' +
      '  62% { transform: scale(0.966); }' +
      '  73% { transform: scale(0.976); }' +
      '  84% { transform: scale(0.988); }' +
      '  93% { transform: scale(0.996); }' +
      '  100% { transform: scale(1); }' +
      '}' +
      '@keyframes fab-spin-rot { to { transform: rotate(360deg); } }' +
      '@keyframes fab-fb-busy-out {' +
      '  from { opacity: 1; }' +
      '  to { opacity: 0; }' +
      '}' +
      '@keyframes fab-fb-spin-ic {' +
      '  from { transform: scale(1); opacity: 1; }' +
      '  to { transform: scale(0.32); opacity: 0; }' +
      '}' +
      '@keyframes fab-fb-done-layer {' +
      '  from { opacity: 0; }' +
      '  to { opacity: 1; }' +
      '}' +
      '@keyframes fab-fb-check-pop {' +
      '  from { transform: scale(0.28); opacity: 0; }' +
      '  to { transform: scale(1); opacity: 1; }' +
      '}' +
      '@keyframes fab-err-shake-btn {' +
      '  0%, 100% { transform: translateX(0); }' +
      '  9% { transform: translateX(-9px); }' +
      '  21% { transform: translateX(8px); }' +
      '  33% { transform: translateX(-4.5px); }' +
      '  45% { transform: translateX(3.5px); }' +
      '  57% { transform: translateX(-2px); }' +
      '  69% { transform: translateX(1.2px); }' +
      '  81% { transform: translateX(-0.55px); }' +
      '  91% { transform: translateX(0.25px); }' +
      '}' +
      '.fab-btn-feedback {' +
      '  position: absolute; inset: 0; border-radius: inherit; z-index: 2; pointer-events: none;' +
      '  overflow: hidden;' +
      '}' +
      '.fab-fb-hover, .fab-fb-busy, .fab-fb-done, .fab-fb-err {' +
      '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
      '  border-radius: inherit; opacity: 0;' +
      '}' +
      '.fab-fb-hover-bg, .fab-fb-busy-bg, .fab-fb-done-bg, .fab-fb-err-bg {' +
      '  position: absolute; inset: 0; border-radius: inherit;' +
      '}' +
      '.fab-fb-hover-bg { background: rgba(255, 255, 255, 0.52); }' +
      '.fab-fb-busy-bg { background: rgba(15, 23, 42, 0.28); }' +
      '.fab-fb-done-bg { background: rgba(255, 255, 255, 0.5); }' +
      '.fab-fb-err-bg { background: rgba(15, 23, 42, 0.28); }' +
      '.fab-fb-hover-ic, .fab-fb-busy-ic, .fab-fb-done-ic, .fab-fb-err-ic {' +
      '  position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;' +
      '  width: 100%; height: 100%;' +
      '}' +
      '.fab-fb-hover-ic svg, .fab-fb-done-ic svg, .fab-fb-err-ic svg {' +
      '  width: 46%; height: 46%; max-width: 38px; max-height: 38px; flex-shrink: 0;' +
      '}' +
      '.fab-spinner-wrap {' +
      '  display: flex; align-items: center; justify-content: center;' +
      '  width: 100%; height: 100%; flex-shrink: 0;' +
      '}' +
      '.fab-spinner-wrap .fab-spinner-svg {' +
      '  width: 46%; height: 46%; max-width: 38px; max-height: 38px; flex-shrink: 0;' +
      '  display: block; overflow: visible;' +
      '  transform-origin: 50% 50%;' +
      '}' +
      '.fab-fb-hover-ic svg { color: #475569; }' +
      '.fab-fb-busy-ic svg { color: #475569; }' +
      '.fab-fb-done-ic svg { color: #16a34a; }' +
      '.fab-fb-err-ic svg { color: #dc2626; }' +
      '.fab-btn:not(:disabled):not(.fab-copy-loading):not(.fab-copy-success):hover .fab-fb-hover {' +
      '  opacity: 1; transition: opacity 0.14s ease;' +
      '}' +
      '.fab-copy-loading .fab-fb-busy { opacity: 1; transition: opacity 0.12s ease; }' +
      '.fab-copy-loading .fab-spinner-wrap .fab-spinner-svg {' +
      '  animation: fab-spin-rot 1.1s linear infinite;' +
      '}' +
      '.fab-copy-success .fab-fb-busy {' +
      '  animation: fab-fb-busy-out 0.26s ease forwards;' +
      '}' +
      '.fab-copy-success .fab-fb-busy-ic { animation: fab-fb-spin-ic 0.28s ease forwards; }' +
      '.fab-copy-success .fab-fb-done {' +
      '  animation: fab-fb-done-layer 0.32s ease 0.1s forwards;' +
      '}' +
      '.fab-copy-success .fab-fb-done-ic { animation: fab-fb-check-pop 0.44s cubic-bezier(0.34, 1.45, 0.64, 1) 0.14s both; }' +
      '.fab-btn.fab-copy-error:not(.fab-copy-dimout) {' +
      '  animation: fab-err-shake-btn 0.42s cubic-bezier(0.32, 0.72, 0.27, 1) forwards;' +
      '}' +
      '.fab-copy-error .fab-fb-err {' +
      '  opacity: 1; transition: opacity 0.1s ease;' +
      '}' +
      '.fab-copy-error .fab-fb-hover, .fab-copy-error .fab-fb-busy, .fab-copy-error .fab-fb-done {' +
      '  opacity: 0 !important;' +
      '}' +
      '.fab-copy-dimout .fab-btn-feedback { opacity: 0; transition: opacity 0.45s ease; }' +
      '.fab-settings-panel {' +
      '  position: absolute; left: 0; top: 0; width: 100%; padding: 0 10px; box-sizing: border-box;' +
      '  opacity: 0; visibility: hidden; pointer-events: none; height: 0; overflow: hidden;' +
      '}' +
      '.fab-settings-wrap:hover .fab-settings-panel {' +
      '  position: relative; height: auto; cursor: default; opacity: 1; visibility: visible; pointer-events: auto; overflow: visible;' +
      '  flex: 1 1 auto; min-height: 0; margin: 0;' +
      '  display: flex; flex-direction: column; justify-content: space-evenly; align-items: stretch;' +
      '  padding: 10px 10px 8px;' +
      '}' +
      '.fab-settings-panel .opt-row {' +
      '  display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; color: #0f172a;' +
      '  margin: 0; flex-shrink: 0; cursor: pointer;' +
      '}' +
      '.fab-settings-panel .opt-row input[type="checkbox"] {' +
      '  -webkit-appearance: none; appearance: none; width: 15px; height: 15px; flex-shrink: 0; margin: 0;' +
      '  border: 1px solid #cbd5e1; border-radius: 3px; background: #fff; cursor: pointer;' +
      '  transition: border-color 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background-color 0.15s ease;' +
      '}' +
      '.fab-settings-panel .opt-row input[type="checkbox"]:enabled:hover {' +
      '  border-color: #9ccfe5; box-shadow: 0 0 0 2px rgba(156, 207, 229, 0.45); filter: brightness(1.03);' +
      '}' +
      '.fab-settings-panel .opt-row input[type="checkbox"]:checked:enabled:hover {' +
      '  border-color: #7ebad9; box-shadow: 0 0 0 2px rgba(156, 207, 229, 0.4); filter: brightness(1.08);' +
      '}' +
      '.fab-settings-panel .opt-row input[type="checkbox"]:checked {' +
      '  border-color: #5aa8cc; background-color: #5aa8cc;' +
      '  background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23ffffff%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M5 13l4 4L19 7%27/%3E%3C/svg%3E");' +
      '  background-size: 11px 11px; background-position: center; background-repeat: no-repeat;' +
      '}' +
      '.fab-settings-panel .opt-row input[type="checkbox"]:focus-visible {' +
      '  outline: 2px solid #9ccfe5; outline-offset: 2px;' +
      '}' +
      '.fab-settings-panel .opt-row.opt-muted { color: #94a3b8; cursor: default; }' +
      '.fab-settings-panel .opt-row.opt-muted input[type="checkbox"] {' +
      '  cursor: not-allowed; opacity: 0.45; background: #fff; border-color: #e2e8f0;' +
      '}' +
      '.fab-settings-panel .opt-row.opt-muted input[type="checkbox"]:checked {' +
      '  background-color: #94a3b8; border-color: #64748b;' +
      '  background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23ffffff%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M5 13l4 4L19 7%27/%3E%3C/svg%3E");' +
      '  background-size: 11px 11px; background-position: center; background-repeat: no-repeat;' +
      '}' +
      '.settings-hr { border: none; border-top: 1px solid #e2e8f0; margin: 0; flex-shrink: 0; cursor: default; }' +
      '</style>' +
      '<div class="fab-root nuo-tb-off" part="fab">' +
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
        '          <div class="fab-party-wrap">' +
        '          <button type="button" class="fab-btn fab-party" id="fabPartyBtn" disabled' +
        '            aria-label="현재 팀 파티 샘플 복사">' +
        '            <span class="fab-btn-label fab-party-icon">' +
      PARTY_ICON_SVG +
        '            </span>' +
      fabFeedbackHtml() +
        '          </button>' +
        '          <div class="fab-per-btn-toast fab-per-btn-toast--below nuo-hidden" id="fabPartyErrToast" role="alert" aria-live="assertive"></div>' +
        '          </div>' +
        '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var fabRoot = root.querySelector('.fab-root');
    var partyToastEl = root.getElementById('fabPartyErrToast');
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
    var slotToastEls = [];
    var fabPressAnchor = null;
    function fabPressAllowed(btn) {
      if (!btn || btn.disabled) return false;
      return (
        !btn.classList.contains('fab-copy-loading') &&
        !btn.classList.contains('fab-copy-success') &&
        !btn.classList.contains('fab-copy-error')
      );
    }
    function fabPressEnd() {
      if (fabPressAnchor) {
        try {
          fabPressAnchor.classList.remove('fab-btn--press');
        } catch (ePr) {}
        fabPressAnchor = null;
      }
      document.removeEventListener('pointerup', fabPressEnd, true);
      document.removeEventListener('pointercancel', fabPressEnd, true);
    }
    function fabPressDetachIf(btn) {
      if (!btn) return;
      if (fabPressAnchor === btn) fabPressEnd();
      else {
        try {
          btn.classList.remove('fab-btn--press');
        } catch (ePd) {}
      }
    }
    function bindFabPressBehavior(btn) {
      btn.addEventListener(
        'pointerdown',
        function (ev) {
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          if (!fabPressAllowed(btn)) return;
          if (fabPressAnchor && fabPressAnchor !== btn) fabPressEnd();
          fabPressAnchor = btn;
          btn.classList.add('fab-btn--press');
          document.addEventListener('pointerup', fabPressEnd, true);
          document.addEventListener('pointercancel', fabPressEnd, true);
        },
        true
      );
    }

    /** 클릭 바운스(안빈슬롯·빈슬롯·파티 공통): 리플로우로 연타 시에도 애니 재시작 */
    function fabTriggerClickBounce(btn) {
      if (!btn || btn.disabled || btn.classList.contains('fab-copy-error')) return;
      try {
        btn.classList.remove('fab-copy-click-pulse');
      } catch (eTb) {}
      try {
        void btn.offsetWidth;
      } catch (eOf) {}
      try {
        btn.classList.add('fab-copy-click-pulse');
      } catch (eAdd) {}
      setTimeout(function () {
        try {
          btn.classList.remove('fab-copy-click-pulse');
        } catch (eRm) {}
      }, 130);
    }

    var bi;
    for (bi = 0; bi < 6; bi++) {
      (function (idx1) {
        var row = document.createElement('div');
        row.className = 'fab-slot-row';
        var toastEl = document.createElement('div');
        toastEl.className = 'fab-per-btn-toast nuo-hidden';
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fab-btn fab-slot';
        b.innerHTML =
          '<span class="fab-btn-label fab-slot-label">' +
          '<img class="fab-slot-mon" alt="" decoding="async" />' +
          '<span class="fab-slot-fallback-num">' +
          idx1 +
          '</span></span>' +
          fabSlotFeedbackHtml();
        b.setAttribute('aria-label', '#' + idx1 + ' 슬롯 요약 샘플 복사');
        b.disabled = true;
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (b.classList.contains('fab-slot--empty')) {
            fabTriggerClickBounce(b);
            return;
          }
          runCopySlot(idx1, b);
        });
        row.appendChild(toastEl);
        row.appendChild(b);
        fabSlotsWrap.appendChild(row);
        slotToastEls.push(toastEl);
        slotBtns.push(b);
      })(bi + 1);
    }

    partyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      runCopyPartyShareUrl(partyBtn);
    });
    bindFabPressBehavior(partyBtn);
    for (bi = 0; bi < slotBtns.length; bi++) {
      bindFabPressBehavior(slotBtns[bi]);
    }

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
      }, 90);
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
    var errTimerMap = new Map();
    /** 금지 아이콘 전체 표시(흔들림 후 유지) 후 dimout까지 — 성공 체크보다 0.5s 짧게 */
    var ERR_FEEDBACK_HOLD_MS = 1500;
    var ERR_FEEDBACK_FADE_MS = 480;
    var successHoldTimer = null;
    var successFadeTimer = null;
    var successFlashBtn = null;

    function setFabVisible(on) {
      fabRoot.classList.toggle('nuo-tb-off', !on);
    }

    function getToastByButton(btn) {
      if (!btn) return null;
      if (btn === partyBtn) return partyToastEl;
      var ix = slotBtns.indexOf(btn);
      return ix >= 0 ? slotToastEls[ix] : null;
    }

    function clearErrTimersForButton(btn) {
      if (!btn) return;
      var t = errTimerMap.get(btn);
      if (!t) return;
      if (t.hold) clearTimeout(t.hold);
      if (t.fade) clearTimeout(t.fade);
      errTimerMap.delete(btn);
    }

    /** 해당 버튼의 오류 토스트·금지 아이콘만 정리 (다른 슬롯은 유지) */
    function clearErrorVisualForButton(btn) {
      clearErrTimersForButton(btn);
      var toastEl = getToastByButton(btn);
      if (toastEl) {
        toastEl.textContent = '';
        toastEl.classList.add('nuo-hidden');
      }
      if (btn) {
        btn.classList.remove('fab-copy-error', 'fab-copy-dimout');
      }
    }

    function clearAllErrorToasts() {
      var i;
      for (i = 0; i < slotBtns.length; i++) {
        clearErrorVisualForButton(slotBtns[i]);
      }
      clearErrorVisualForButton(partyBtn);
    }

    /**
     * 버튼별 독립 토스트 + 금지 아이콘. 토스트는 홀드 종료 시 바로 숨김(페이드 없음).
     * 금지 레이어는 ERR_FEEDBACK_HOLD_MS 후 dimout → ERR_FEEDBACK_FADE_MS 후 정리.
     */
    function showErrorToastNearButton(anchorBtn, msg) {
      if (!anchorBtn) return;
      var toastEl = getToastByButton(anchorBtn);
      if (!toastEl) return;
      clearErrTimersForButton(anchorBtn);
      anchorBtn.classList.remove('fab-copy-dimout');
      anchorBtn.classList.add('fab-copy-error');
      toastEl.textContent = msg != null ? String(msg) : '';
      toastEl.classList.remove('nuo-hidden');
      var hold = setTimeout(function () {
        toastEl.textContent = '';
        toastEl.classList.add('nuo-hidden');
        anchorBtn.classList.add('fab-copy-dimout');
        var fade = setTimeout(function () {
          clearErrorVisualForButton(anchorBtn);
        }, ERR_FEEDBACK_FADE_MS);
        errTimerMap.set(anchorBtn, { hold: null, fade: fade });
      }, ERR_FEEDBACK_HOLD_MS);
      errTimerMap.set(anchorBtn, { hold: hold, fade: null });
    }

    function clearCopyUiTimers() {
      if (successHoldTimer) {
        clearTimeout(successHoldTimer);
        successHoldTimer = null;
      }
      if (successFadeTimer) {
        clearTimeout(successFadeTimer);
        successFadeTimer = null;
      }
    }

    function clearCopySuccessVisual(btn) {
      if (!btn) return;
      fabPressDetachIf(btn);
      btn.classList.remove(
        'fab-copy-success',
        'fab-copy-dimout',
        'fab-copy-loading',
        'fab-copy-click-pulse',
        'fab-copy-error'
      );
      try {
        btn.removeAttribute('aria-busy');
      } catch (eAbs) {}
    }

    function startCopyFeedback(btn) {
      if (!btn) return;
      fabPressDetachIf(btn);
      clearCopyUiTimers();
      clearErrorVisualForButton(btn);
      if (successFlashBtn && successFlashBtn !== btn) {
        clearCopySuccessVisual(successFlashBtn);
      }
      successFlashBtn = btn;
      btn.classList.remove('fab-copy-success', 'fab-copy-dimout', 'fab-copy-error');
      btn.classList.add('fab-copy-loading');
      fabTriggerClickBounce(btn);
      try {
        btn.setAttribute('aria-busy', 'true');
      } catch (eBusy) {}
    }

    function finishCopyError(btn) {
      if (!btn) return;
      btn.classList.remove('fab-copy-loading');
      try {
        btn.removeAttribute('aria-busy');
      } catch (eErr) {}
      if (successFlashBtn === btn) successFlashBtn = null;
    }

    function finishCopySuccess(btn) {
      if (!btn) return;
      clearCopyUiTimers();
      btn.classList.remove('fab-copy-loading', 'fab-copy-error');
      try {
        btn.removeAttribute('aria-busy');
      } catch (eOk) {}
      btn.classList.remove('fab-copy-dimout');
      btn.classList.add('fab-copy-success');
      successFlashBtn = btn;
      successHoldTimer = setTimeout(function () {
        successHoldTimer = null;
        btn.classList.add('fab-copy-dimout');
        successFadeTimer = setTimeout(function () {
          successFadeTimer = null;
          clearCopySuccessVisual(btn);
          if (successFlashBtn === btn) successFlashBtn = null;
        }, 480);
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
        slotBtns[i].disabled = false;
        slotBtns[i].classList.toggle('fab-slot--empty', !on);
      }
    }

    function applySlotVisuals(slotArt, filled) {
      var i;
      for (i = 0; i < 6; i++) {
        var btn = slotBtns[i];
        var img = btn.querySelector('.fab-slot-mon');
        if (!img) continue;
        var hasFill = filled && filled[i] === true;
        var url = hasFill && slotArt && slotArt[i] ? String(slotArt[i]).trim() : '';
        btn.classList.remove('fab-slot--has-mon');
        img.onload = null;
        img.onerror = null;
        if (!url) {
          img.removeAttribute('src');
          continue;
        }
        img.onload = (function (im, b, u) {
          return function () {
            if (im.getAttribute('src') !== u) return;
            if (im.naturalWidth > 0) b.classList.add('fab-slot--has-mon');
          };
        })(img, btn, url);
        img.onerror = (function (im, b) {
          return function () {
            im.removeAttribute('src');
            b.classList.remove('fab-slot--has-mon');
          };
        })(img, btn);
        if (img.getAttribute('src') === url) {
          if (img.complete && img.naturalWidth > 0) btn.classList.add('fab-slot--has-mon');
        } else {
          img.src = url;
        }
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
        applySlotVisuals(r.slotArt, r.filled);
        setPartyButtonEnabled(true);
      });
    }

    function runCopyPartyShareUrl(sourceBtn) {
      if (isLikelyCalculatorView()) return;
      var fbBtn = sourceBtn || partyBtn;
      startCopyFeedback(fbBtn);

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
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, chrome.runtime.lastError.message || '오류');
                return;
              }
              if (!bg || !bg.ok) {
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, (bg && bg.error) || '처리하지 못했습니다.');
                return;
              }
              var t = bg.text != null ? String(bg.text) : '';
              if (!t) {
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, '출력이 비었습니다.');
                return;
              }
              copyTextBestEffort(t);
              finishCopySuccess(fbBtn);
            }
          );
        });
      });
    }

    function runCopySlot(idx1, sourceBtn) {
      if (isLikelyCalculatorView()) return;
      var fbBtn = sourceBtn || slotBtns[idx1 - 1];
      startCopyFeedback(fbBtn);

      getSlotsFromBridge().then(function (r) {
        if (!r || !r.ok || !r.slots) {
          finishCopyError(fbBtn);
          showErrorToastNearButton(fbBtn, '슬롯을 읽지 못했습니다.');
          return;
        }
        if (!r.filled || !r.filled[idx1 - 1]) {
          finishCopyError(fbBtn);
          showErrorToastNearButton(fbBtn, '빈 슬롯입니다.');
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
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, chrome.runtime.lastError.message || '오류');
                return;
              }
              if (!bg || !bg.ok) {
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, (bg && bg.error) || '변환 실패');
                return;
              }
              var t = bg.text != null ? String(bg.text) : '';
              if (!t) {
                finishCopyError(fbBtn);
                showErrorToastNearButton(fbBtn, '출력이 비었습니다.');
                return;
              }
              copyTextBestEffort(t);
              finishCopySuccess(fbBtn);
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
      clearAllErrorToasts();
      clearCopyUiTimers();
      clearCopySuccessVisual(successFlashBtn);
      successFlashBtn = null;
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
