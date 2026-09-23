/**
 * 계산기·스피드 좌/우 패널 "내 파티" 줄 CSS (REDESIGN §4.1 A). 프로필 헤더 다음 형제로 삽입되는
 * 섹션 — 사이트 섹션 규격(padding 10, border-bottom). calcFill.js 앞 로드.
 */
(function (g) {
  'use strict';
  g.nuoCalcPartyRowCss = [
    // 패딩·경계선은 :host 가 아닌 .sec 에 — 사이트 Tailwind preflight(* { padding:0; border:0 })가 host 요소에 걸리면 :host 규칙을 이김.
    ':host { all: initial; display: block; }',
    '.sec { padding: 10px; border-bottom: 1px solid var(--nuo-border); font-family: var(--nuo-font); color: var(--nuo-text); }',
    '* { box-sizing: border-box; font-family: inherit; }',
    '.row { display: flex; align-items: center; gap: 8px; }',
    '.ttl { flex: 0 0 auto; margin: 0; font-size: 14px; font-weight: 500; letter-spacing: -0.35px; color: var(--nuo-text-strong); }',
    '.chips { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; min-width: 0; height: 36px; padding: 0 4px; border-radius: 10px; background: var(--nuo-chip-track); }',
    '.chip { width: 30px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 8px; background: #fff; cursor: pointer; transition: border-color 0.15s, opacity 0.15s; }',
    '.chip[hidden] { display: none; }',
    '.chip img { width: 28px; height: 28px; object-fit: contain; }',
    '.chip img:not([src]) { display: none; }',
    '.chip .num { font-size: 10px; color: var(--nuo-text-subtle); }',
    '.chip.has-art .num { display: none; }',
    '.chip:hover:not(:disabled), .chip.done, .chip.err { border-color: var(--nuo-primary); }',
    '.chip:disabled { background: transparent; cursor: default; }',
    '.chip.busy { opacity: 0.5; cursor: default; }',
    '.empty { font-size: 10px; color: var(--nuo-text-subtle); padding: 0 6px; }',
    '.empty[hidden] { display: none; }',
    '.msg { margin: 6px 0 0; font-size: 10px; color: var(--nuo-text-subtle); }',
    '.msg:empty { display: none; }',
    '.msg.err { color: var(--nuo-primary); }',
    'button:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
