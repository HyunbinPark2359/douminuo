/**
 * 환경설정 모달 + 중앙 `도우미` 버튼 CSS (REDESIGN §4.1 C). prefsEntry.js 전용.
 * nuoTokens.js 뒤, prefsEntry.js 앞 로드.
 */
(function (g) {
  'use strict';
  g.nuoPrefsModalCss = [
    '.backdrop {',
    '  position: fixed; inset: 0; z-index: 2147483646;',
    '  background: rgba(0, 0, 0, 0.3);',
    '  display: flex; align-items: center; justify-content: center;',
    '}',
    '.box {',
    '  position: relative; background: #fff; overflow: hidden;',
    '  border: 1px solid var(--nuo-border); border-radius: 12px; box-shadow: var(--nuo-shadow);',
    '}',
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
