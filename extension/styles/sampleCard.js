/**
 * 샘플 저장·불러오기 CSS (SAMPLE_LIBRARY_PLAN §3.3·§5). sampleLibrary.js / sampleParty.js / calcFill.js 앞 로드.
 * 카드 = 사이트 파티 리스트 카드(번들 list 컴포넌트) 실측 복제 — 수치 바꾸지 말 것 (§3.3 대조 검증 완료값).
 * 말풍선 = styles/teamCopyIcons.js .tip 과 같은 실측값 — 한쪽 바꾸면 다른 쪽도.
 */
(function (g) {
  'use strict';
  g.nuoSampleTipCss = [
    '.tip {',
    '  position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); z-index: 9999;',
    '  white-space: nowrap; pointer-events: none; padding: 4px 8px; border-radius: 4px;',
    '  background: #333; font: 400 11px/1.5 var(--nuo-font); color: #fff;',
    '}',
    '.tip[hidden] { display: none; }'
  ].join('\n');

  g.nuoSampleCardCss = [
    '* { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--nuo-font); }',
    '.count { margin-bottom: 6px; font-size: 11px; color: var(--nuo-text-muted); }',
    '.empty { padding: 8px 0 2px; font-size: 11px; color: var(--nuo-text-muted); text-align: center; word-break: keep-all; }',
    '.msg { margin-bottom: 6px; font-size: 11px; color: var(--nuo-primary); }',
    '.msg:empty { display: none; }',
    // 네이티브 스크롤바 숨김(Windows 기본 바가 카드 폭을 14px 깎음) + 오버레이 thumb — styles/speedPanel.js .inline-sb 와 같은 값.
    '.shell { position: relative; }',
    '.list { max-height: 395px; overflow-y: auto; scrollbar-width: none; }',
    '.list::-webkit-scrollbar { width: 0; height: 0; }',
    '.list > .card:last-child { margin-bottom: 0; }',
    '.sb { position: absolute; top: 0; bottom: 0; right: 1px; width: 6px; opacity: 0; transition: opacity .35s ease; pointer-events: none; z-index: 20; }',
    '.sb.show { opacity: 1; pointer-events: auto; }',
    '.thumb { position: absolute; left: 1px; right: 1px; border-radius: 3px; background: rgba(148, 163, 184, 0.55); cursor: pointer; }',
    '.thumb:hover { background: rgba(148, 163, 184, 0.8); }',
    '.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 12px; color: #272727; }',
    '.head .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.del { flex: none; width: 12px; height: 12px; padding: 0; border: 0; background: none; color: #808080; cursor: pointer; line-height: 0; }',
    '.del:hover { color: var(--nuo-primary); }',
    '.del svg { width: 12px; height: 12px; fill: currentColor; }',
    '.card { position: relative; display: flex; align-items: center; height: 120px; padding: 10px; margin-bottom: 10px; border: 1px solid transparent; border-radius: 8px; cursor: pointer; user-select: none; }',
    '.card:hover, .card:focus-visible { border-color: #E4007F; outline: none; }',
    '.info { flex: 1; min-width: 0; }',
    '.line { display: flex; align-items: center; margin-top: -3px; font-size: 10px; font-weight: 400; white-space: nowrap; }',
    '.line b { font-size: 14px; font-weight: 500; color: #000; }',
    '.line span { margin-left: 4px; color: #434343; }',
    '.line .tera { width: 12px; height: 12px; margin-left: 4px; }',
    '.moves { display: flex; flex-direction: column; width: 120px; height: 75px; margin-top: 7px; }',
    '.mv { display: flex; align-items: center; height: 18.75px; font-size: 10px; font-weight: 500; line-height: 13px; color: #000; }',
    '.mv img { width: 15px; height: 15px; margin-right: 3px; }',
    '.mv span { word-break: keep-all; }',
    '.art { position: absolute; right: 120px; bottom: 10px; height: 75px; display: flex; align-items: center; justify-content: center; }',
    '.art .a { width: 75px; height: 75px; object-fit: contain; }',
    '.art .it { position: absolute; right: 0; bottom: 0; width: 30px; height: 30px; z-index: 10; }',
    '.stats { position: absolute; right: 10px; bottom: 10px; font-size: 11px; line-height: 13px; }',
    '.st { display: flex; align-items: center; height: 14px; }',
    '.st i { display: block; flex: none; width: 4px; height: 4px; margin: 0 4px 1px 0; }',
    '.st img { width: 12px; height: 11px; margin-right: 4px; }',
    '.st .r, .st .v { display: inline-block; width: 20px; text-align: right; }',
    '.st .r { color: #272727; }',
    '.st .v { font-weight: 500; }'
  ].join('\n');

  // 사이트 PrimeVue Dialog 복제 — 모션·마스크는 styles/prefsModalCss.js 실측값 계승.
  // 2026-09-24 실측: 헤더 없는 Dialog, radius 12 (rounded-lg 클래스보다 PrimeVue 테마가 이김), content padding 0 20px 20px
  // (샘플 불러오기 창은 제목 줄이 윗변에 붙음), 확인창 = 폭 360 + 내부 p-4 text-center, 제목+설명 2줄.
  g.nuoSampleDialogCss = [
    ':host { all: initial; }',
    '.backdrop { position: fixed; inset: 0; z-index: 2147483646; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0); transition: background-color 0.15s ease; font-family: var(--nuo-font); }',
    '.backdrop.on { background: rgba(0, 0, 0, 0.5); }',
    '.box { position: relative; padding: 0 20px 20px; background: #fff; border: 1px solid var(--p-surface-200, #e2e8f0); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); opacity: 0; scale: 0.75; transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), scale 0.15s cubic-bezier(0.4, 0, 0.2, 1); }',
    '.backdrop.on .box { opacity: 1; scale: 1; transition-timing-function: cubic-bezier(0, 0, 0.2, 1); }',
    '.box.list-box { width: 380px; }',
    '.hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }',
    '.ttl { display: flex; align-items: center; font-size: 15px; font-weight: 500; color: #E4007F; }',
    '.ttl img { width: 24px; height: 24px; margin-right: 6px; }',
    '.x { width: 18px; height: 18px; padding: 0; border: 0; background: none; color: #000; cursor: pointer; line-height: 0; }',
    '.box.confirm { width: 360px; padding: 16px 36px 36px; text-align: center; }',
    '.q { margin: 0 0 4px; font-size: 16px; font-weight: 600; line-height: 24px; color: #334155; word-break: keep-all; }',
    '.sub { margin: 0 0 12px; font-size: 11px; line-height: 16.5px; color: #334155; word-break: keep-all; }',
    '.acts { display: flex; justify-content: center; gap: 6px; }',
    '.btn { width: 50px; height: 20px; padding: 0; border: 0; border-radius: 5px; font: 300 10px var(--nuo-font); cursor: pointer; }',
    '.btn.ghost { background: #EBEBED; color: #272727; }',
    '.btn.ok { background: #E9C46A; color: #fff; }',
    '.x:focus-visible, .btn:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }',
    '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }'
  ].join('\n');

  // 파티 탭 샘플 이름 칸 저장 버튼 — 사이트 업로드 버튼(20×20, #a1a4ba, radius 5, 흰 14px 아이콘) 복제.
  g.nuoSampleSaveCss = [
    ':host { all: initial; }',
    '.sv { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 5px; background: var(--nuo-neutral-btn); cursor: pointer; }',
    '.sv svg { width: 14px; height: 14px; fill: #fff; }',
    '.sv.busy { opacity: 0.5; cursor: default; }',
    '.sv:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }'
  ].join('\n');
})(typeof globalThis !== 'undefined' ? globalThis : self);
