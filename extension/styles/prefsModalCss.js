/**
 * 환경설정 모달 + 중앙 `도우미` 버튼 CSS (REDESIGN §4.1 C). prefsEntry.js 전용.
 * nuoTokens.js 뒤, prefsEntry.js 앞 로드.
 * 모달 = 사이트 계산 팝업(PrimeVue Dialog) 실측 복제 (2026-09-23): mask rgba(0,0,0,.5) 150ms fade,
 * dialog radius 10 · 테두리 surface-200 · 아래로 떨어지는 그림자, 열림/닫힘 scale .75 + opacity 150ms.
 * REDESIGN §5 scale 금지의 예외 — 사이트 자체 모션 그대로.
 */
(function (g) {
  'use strict';
  g.nuoPrefsModalCss = [
    '.backdrop {',
    '  position: fixed; inset: 0; z-index: 2147483646;',
    '  background: rgba(0, 0, 0, 0); transition: background-color 0.15s ease;',
    '  display: flex; align-items: center; justify-content: center;',
    '}',
    '.backdrop.on { background: rgba(0, 0, 0, 0.5); }',
    '.box {',
    '  position: relative; background: #fff; overflow: hidden;',
    '  border: 1px solid var(--p-surface-200, #e2e8f0); border-radius: 10px;',
    '  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);',
    '  opacity: 0; scale: 0.75;',
    '  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), scale 0.15s cubic-bezier(0.4, 0, 0.2, 1);',
    '}',
    '.backdrop.on .box.ready { opacity: 1; scale: 1; transition-timing-function: cubic-bezier(0, 0, 0.2, 1); }',
    '.frame { display: block; width: min(380px, 92vw); height: min(560px, 88vh); border: 0; }',
    '.close {',
    '  position: absolute; top: 14px; right: 12px; z-index: 1;',
    '  width: 20px; height: 20px; padding: 0; border: 0; background: none;',
    '  color: var(--nuo-text-muted); cursor: pointer; line-height: 0;',
    '  transition: color 0.15s;',
    '}',
    '.close:hover { color: var(--nuo-primary); }',
    '.close:focus-visible, .entry:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 2px; }',
    '.entry {',
    '  display: block; width: 64px; height: 26px; padding: 0; border: 0; border-radius: 8px;',
    '  background: var(--nuo-neutral-btn); color: #fff; cursor: pointer;',
    '  font: 300 14px var(--nuo-font);',
    '}',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
