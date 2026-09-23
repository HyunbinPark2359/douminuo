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
    '.chips { flex: 1 1 auto; display: flex; align-items: center; gap: 4px; min-width: 0; height: 36px; padding: 0 4px; border-radius: 10px; background: var(--nuo-chip-track); }',
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
    '.pill { flex: 0 0 auto; height: 26px; padding: 0 9px; border: 1px solid var(--nuo-pill-bg); border-radius: 15px; background: var(--nuo-pill-bg); color: var(--nuo-pill-text); font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 0.15s, border-color 0.15s, color 0.15s; }',
    '.pill[aria-expanded="true"] { background: #fff; border-color: var(--nuo-pill-border); color: var(--nuo-ink); font-weight: 550; }',
    '.url { display: flex; gap: 6px; margin-top: 12px; }',
    '.url[hidden] { display: none; }',
    '.field { position: relative; flex: 1 1 auto; height: 40px; border: 1px solid var(--nuo-field-border); border-radius: 8px; transition: border-color 0.15s; }',
    '.field:focus-within { border-color: var(--nuo-primary); }',
    '.field label { position: absolute; left: 12px; top: -7px; padding: 0 4px; background: #fff; font-size: 9px; color: var(--nuo-text-muted); }',
    '.field input { width: 100%; height: 100%; padding: 0 12px; border: 0; outline: 0; background: transparent; font-size: 13px; color: var(--nuo-text); }',
    '.apply { flex: 0 0 auto; width: 50px; border: 0; border-radius: 8px; background: var(--nuo-primary); color: #fff; font-size: 14px; font-weight: 300; cursor: pointer; transition: background-color 0.15s, opacity 0.15s; }',
    '.apply:hover:not(:disabled) { background: var(--nuo-primary-hover); }',
    '.apply:disabled { opacity: 0.6; cursor: default; }',
    '.msg { margin: 6px 0 0; font-size: 10px; color: var(--nuo-text-subtle); }',
    '.msg:empty { display: none; }',
    '.msg.err { color: var(--nuo-primary); }',
    'button:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
