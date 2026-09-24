/**
 * 계산기·스피드 좌/우 패널 "내 파티" 줄 CSS (REDESIGN §4.1 A). 프로필 헤더 다음 형제로 삽입되는
 * 섹션 — 사이트 섹션 규격(padding 10, border-bottom). calcFill.js 앞 로드.
 * 필드형 재배치 (SAMPLE_LIBRARY_PLAN §5.3).
 */
(function (g) {
  'use strict';
  g.nuoCalcPartyRowCss = [
    // 패딩·경계선은 :host 가 아닌 .sec 에 — 사이트 Tailwind preflight(* { padding:0; border:0 })가 host 요소에 걸리면 :host 규칙을 이김.
    // 필드형 (SAMPLE_LIBRARY_PLAN §5.3): 사이트 '포켓몬 이름' 칸과 같은 라벨 필드 — 높이 50, #d8d8d8, radius 8, 라벨 9px.
    ':host { all: initial; display: block; }',
    '.sec { padding: 16px 10px 10px; border-bottom: 1px solid var(--nuo-border); font-family: var(--nuo-font); color: var(--nuo-text); }',
    '* { box-sizing: border-box; font-family: inherit; }',
    // 불러오기 버튼 중심 = 아래 '위력'·'실수값' 칸 중심 (2026-09-24 실측: 칸 왼쪽에서 315px → 오른쪽 여백 12).
    // 구분선↔버튼 여백도 같은 12 → 구분선 위치가 여기서 정해짐 (사용자 조정).
    '.fld { position: relative; display: flex; align-items: center; height: 50px; padding: 0 0 0 12px; border: 1px solid var(--nuo-field-border); border-radius: 8px; background: #fff; }',
    '.ttl { position: absolute; top: -6px; left: 12px; margin: 0; padding: 0 4px; background: #fff; font-size: 9px; font-weight: 400; line-height: 1; color: var(--nuo-text-muted); white-space: nowrap; }',
    // 칸 안 간격 전부 12 (테두리↔첫 칩, 마지막 칩↔구분선, 구분선↔버튼, 버튼↔테두리) — 칩 사이도 space-between 으로 ≈12.
    '.chips { flex: 1; min-width: 0; margin-right: 12px; display: flex; align-items: center; justify-content: space-between; }',
    '.chip { width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer; transition: border-color 0.15s, opacity 0.15s; }',
    '.chip[hidden] { display: none; }',
    '.chip img { width: 32px; height: 32px; object-fit: contain; }',
    '.chip img:not([src]) { display: none; }',
    '.chip .num { font-size: 10px; color: var(--nuo-text-subtle); }',
    '.chip.has-art .num { display: none; }',
    '.chip:hover:not(:disabled), .chip.done { border-color: var(--nuo-primary); }',
    '.chip:disabled { cursor: default; }',
    '.chip.busy { opacity: 0.5; cursor: default; }',
    '.empty { flex: 1; font-size: 10px; color: var(--nuo-text-subtle); padding: 0 6px; }',
    '.empty[hidden] { display: none; }',
    '.bar { flex: none; width: 1px; height: 22px; background: #e6e6e6; }',
    // 불러오기 = 파티 탭 사이트 업로드 버튼과 같은 모양, 26px(아래 줄 사이트 원형 버튼과 같은 리듬) · radius 6 · 아이콘 18px.
    '.load { position: relative; flex: none; width: 26px; height: 26px; margin: 0 12px; padding: 0; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: var(--nuo-neutral-btn); cursor: pointer; }',
    '.load svg { width: 18px; height: 18px; fill: #fff; }',
    'button:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
