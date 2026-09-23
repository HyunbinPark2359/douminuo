/**
 * 파티 페이지 복사 아이콘 CSS (REDESIGN §4.1 B). 슬롯 `#N` 옆 12px 회색 아이콘 줄 /
 * `파티 리스트` 초록 그룹 14px 흰 아이콘 줄에 합류. teamBuilderFill.js 앞 로드.
 * 말풍선 = 사이트 아이콘 줄 "복사 완료" 말풍선 실측 복제 (2026-09-23): #333 bg, 흰 11px/400,
 * padding 4px 8px, radius 4, 아이콘 중앙 위 4px, 그림자·모션 없음.
 */
(function (g) {
  'use strict';
  g.nuoTeamCopyIconsCss = [
    ':host { all: initial; display: inline-flex; position: relative; vertical-align: middle; }',
    '.ic { display: inline-flex; padding: 0; border: 0; background: none; cursor: pointer; line-height: 0; transition: color 0.15s, opacity 0.15s; }',
    '.ic svg { width: 100%; height: 100%; display: block; }',
    '.ic.slot { width: 12px; height: 12px; color: #808080; }',
    '.ic.slot:hover { color: var(--nuo-primary); }',
    '.ic.party { width: 14px; height: 14px; color: #fff; }',
    '.ic.busy { opacity: 0.5; cursor: default; }',
    '.ic:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '.tip {',
    '  position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); z-index: 9999;',
    '  white-space: nowrap; pointer-events: none; padding: 4px 8px; border-radius: 4px;',
    '  background: #333; font: 400 11px/1.5 var(--nuo-font); color: #fff;',
    '}',
    '.tip[hidden] { display: none; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
