/**
 * 파티 페이지 복사 아이콘 CSS (REDESIGN §4.1 B). 슬롯 `#N` 옆 12px 회색 아이콘 줄 /
 * `파티 리스트` 초록 그룹 14px 흰 아이콘 줄에 합류. teamBuilderFill.js 앞 로드.
 */
(function (g) {
  'use strict';
  g.nuoTeamCopyIconsCss = [
    ':host { all: initial; display: inline-flex; position: relative; vertical-align: middle; }',
    '.ic { display: inline-flex; padding: 0; border: 0; background: none; cursor: pointer; line-height: 0; transition: color 0.15s, opacity 0.15s; }',
    '.ic svg { width: 100%; height: 100%; display: block; }',
    '.ic.slot { width: 12px; height: 12px; margin-left: 4px; color: #808080; }',
    '.ic.slot:hover, .ic.slot.done { color: var(--nuo-primary); }',
    '.ic.party { width: 14px; height: 14px; margin-right: 4px; color: #fff; }',
    '.ic .ok { display: none; }',
    '.ic.done .base { display: none; }',
    '.ic.done .ok { display: block; }',
    '.ic.busy { opacity: 0.5; cursor: default; }',
    '.ic:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '.tip {',
    '  position: absolute; top: calc(100% + 6px); right: -4px; z-index: 30; white-space: nowrap;',
    '  background: #fff; border: 1px solid var(--nuo-border); border-radius: 8px; box-shadow: var(--nuo-shadow);',
    '  padding: 6px 8px; font: 400 12px var(--nuo-font); color: var(--nuo-text);',
    '}',
    '.tip[hidden] { display: none; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
