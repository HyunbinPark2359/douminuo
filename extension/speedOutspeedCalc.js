/**
 * 팀빌더: 우측 편집 패널 스피드 실수값을 읽어 3 프리셋(최속/준속/무보정)으로
 * outspeed 가능한 최대 상대 base 스피드를 계산, 좌상단 고정 패널에 표시.
 *
 * 프리셋 공식: `floor((base + 20 + EV) * nature) < S` 를 만족하는 최대 정수 base.
 *   - 최속: EV=32, nature=1.1  (새 EV 시스템: 1 EV = 실수값 1, 최대 32)
 *   - 준속: EV=32, nature=1.0
 *   - 무보정: EV=0, nature=1.0
 *   - IV=V(=31) 고정 → 실수값에 +20 기여 (floor(31/2)=15 가 아닌 +20 은 유저 제공 공식 기준)
 *
 * 스피드 실수값 읽기:
 *   "스피드 수치" <p> 라벨 기준으로 DOM 트래버설 → 같은 row 의 입력 셀에서
 *   `input[disabled][readonly][type="text"]` 를 실수값 노드로 채택.
 *   Vuetify 자동 ID(input-2673 등)는 언제든 바뀌므로 사용 안 함.
 *
 * 폴링 200ms: teamBuilderFill 과 동일 전략. MutationObserver 회피(안정성 우선).
 */
(function () {
  'use strict';

  var HOST_ID = 'nuo-fmt-speed-outspeed-host';

  var CS = globalThis.nuoCsCommon || {};
  var isLikelyCalculatorView =
    CS.isLikelyCalculatorView ||
    function () {
      return false;
    };

  function isSmartnuoHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'smartnuo.com' || h === 'www.smartnuo.com';
  }

  /** 우측 편집 패널 "스피드 수치" 실수값을 정수로 반환. 못 읽으면 null. */
  function readSpeedReal() {
    var ps = document.querySelectorAll('p.mb-0');
    var speedLabel = null;
    for (var i = 0; i < ps.length; i++) {
      if ((ps[i].textContent || '').trim() === '스피드 수치') {
        speedLabel = ps[i];
        break;
      }
    }
    if (!speedLabel) return null;

    var labelCell = speedLabel.parentElement;
    var labelRow = labelCell && labelCell.parentElement;
    if (!labelRow) return null;

    /** 라벨 row 의 flex 셀만 수집 (우상단 absolute 뱃지 `SP 66/66` 제외) */
    var flexCells = [];
    var kids = labelRow.children;
    for (var k = 0; k < kids.length; k++) {
      var style = kids[k].getAttribute('style') || '';
      if (/flex:\s*1\s+1\s+0%/.test(style)) flexCells.push(kids[k]);
    }
    var idx = flexCells.indexOf(labelCell);
    if (idx < 0) return null;

    var inputRow = labelRow.nextElementSibling;
    if (!inputRow) return null;
    var inputCells = inputRow.querySelectorAll(':scope > div.d-flex.align-center');
    var cell = inputCells[idx];
    if (!cell) return null;

    var realInput = cell.querySelector('input[disabled][readonly][type="text"]');
    if (!realInput) return null;
    var v = parseInt(realInput.value, 10);
    return Number.isFinite(v) ? v : null;
  }

  function computeOutspeedBases(S) {
    if (!Number.isFinite(S) || S <= 0) {
      return { fastest: null, neutral: null, uninvested: null };
    }
    function solve(ev, nat) {
      for (var b = 500; b >= 0; b--) {
        if (Math.floor((b + 20 + ev) * nat) < S) return b;
      }
      return null;
    }
    return {
      fastest: solve(32, 1.1),
      neutral: solve(32, 1.0),
      uninvested: solve(0, 1.0),
    };
  }

  function mountPanel() {
    var existing = document.getElementById(HOST_ID);
    if (existing && existing.shadowRoot) return existing.shadowRoot;

    var host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });

    /**
     * 스마트누오 Vuetify outlined 입력 필드 구조를 그대로 복제.
     * 테두리는 `<fieldset>` 이 그리고 `<legend>` 가 상단 노치를 만듦.
     * 유저 제공 computed style 을 클래스별로 1:1 전사.
     */
    root.innerHTML =
      '<style>' +
      ':host { all: initial; }' +
      '* {' +
      '  -webkit-text-size-adjust: 100%;' +
      '  word-break: normal; tab-size: 4;' +
      '  text-rendering: optimizeLegibility;' +
      '  -webkit-font-smoothing: antialiased;' +
      '  -webkit-tap-highlight-color: rgba(0,0,0,0);' +
      '  font-family: SCDream, sans-serif;' +
      '  box-sizing: border-box;' +
      '}' +
      '.panel {' +
      '  position: fixed; top: 12px; left: 12px; z-index: 2147483000;' +
      '  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;' +
      '  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);' +
      '  padding: 12px 14px; color: #0f172a; width: 200px;' +
      '  opacity: 0; visibility: hidden; pointer-events: none;' +
      '  transition: opacity 0.14s ease, visibility 0.14s;' +
      '}' +
      '.panel.on { opacity: 1; visibility: visible; pointer-events: auto; }' +
      '.cur {' +
      '  font-size: 12px; color: #0f172a;' +
      '  margin-bottom: 14px; letter-spacing: -0.3px;' +
      '}' +
      '.cur b { font-weight: 700; color: #2a6f8f; }' +
      '.boxes { display: flex; gap: 8px; }' +
      '.preset { flex: 0 0 52px; width: 52px; min-width: 0; position: relative; }' +
      '.v-input__control {' +
      '  line-height: 1.5; font-size: 16px; letter-spacing: normal;' +
      '  text-align: left;' +
      '  background-repeat: no-repeat;' +
      '  padding: 0; margin: 0;' +
      '  display: flex; flex-direction: column;' +
      '  height: auto; flex-grow: 1; flex-wrap: wrap;' +
      '  min-width: 0; width: 100%;' +
      '  border-radius: inherit; color: currentColor;' +
      '}' +
      '.v-input__slot {' +
      '  line-height: 1.5; font-size: 16px; letter-spacing: normal;' +
      '  text-align: left; color: currentColor;' +
      '  margin: 0;' +
      '  display: flex; position: relative;' +
      '  transition: .3s cubic-bezier(.25,.8,.5,1);' +
      '  transition-property: height, min-height;' +
      '  width: 100%;' +
      '  border-radius: 8px;' +
      '  cursor: text; align-items: stretch;' +
      '  background: transparent;' +
      '  margin-bottom: 0;' +
      '  height: 50px; min-height: 40px;' +
      '  padding: 0 12px;' +
      '}' +
      '.v-input__slot > fieldset {' +
      '  line-height: 1.5; font-size: 16px; letter-spacing: normal;' +
      '  text-align: left; cursor: text;' +
      '  background-repeat: no-repeat;' +
      '  padding: 0; margin: 0;' +
      '  border: 1px solid;' +
      '  border-color: #d8d8d8 !important;' +
      '  border-radius: 8px;' +
      '  border-collapse: collapse;' +
      '  border-style: solid; border-width: 1px;' +
      '  bottom: 0; left: 0;' +
      '  pointer-events: none;' +
      '  position: absolute;' +
      '  right: 0; top: -5px;' +
      '  transition-duration: .15s;' +
      '  transition-property: color;' +
      '  transition-timing-function: cubic-bezier(.25,.8,.25,1);' +
      '  color: rgba(0,0,0,.26);' +
      '}' +
      '.v-input__slot > fieldset > legend {' +
      '  font-size: 16px; letter-spacing: normal;' +
      '  cursor: text; border-collapse: collapse;' +
      '  pointer-events: none;' +
      '  background-repeat: no-repeat;' +
      '  margin: 0;' +
      '  border: 0; color: inherit;' +
      '  display: table;' +
      '  white-space: normal;' +
      '  max-width: 100%;' +
      '  line-height: 11px;' +
      '  padding: 0;' +
      '  margin: 0 auto;' +
      '  transition: width .3s cubic-bezier(.25,.8,.5,1);' +
      '  text-align: center !important;' +
      '  width: 28px;' +
      '}' +
      '.v-input__slot > fieldset > legend > span {' +
      '  font-size: 16px; letter-spacing: normal;' +
      '  cursor: text; border-collapse: collapse;' +
      '  pointer-events: none;' +
      '  color: inherit; white-space: normal;' +
      '  line-height: 11px; text-align: center !important;' +
      '  background-repeat: no-repeat;' +
      '  padding: 0; margin: 0;' +
      '}' +
      '.v-text-field__slot {' +
      '  line-height: 1.5; font-size: 16px; letter-spacing: normal;' +
      '  text-align: left; color: currentColor; cursor: text;' +
      '  background-repeat: no-repeat;' +
      '  padding: 0; margin: 0;' +
      '  align-items: center;' +
      '  display: flex;' +
      '  flex: 1 1 auto;' +
      '  position: relative;' +
      '}' +
      '.v-label {' +
      '  text-align: left;' +
      '  margin: 0;' +
      '  min-height: 8px;' +
      '  transition: .3s cubic-bezier(.25,.8,.5,1);' +
      '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' +
      '  max-width: 133%;' +
      '  pointer-events: auto;' +
      '  height: 20px; letter-spacing: normal;' +
      '  transform-origin: top left;' +
      '  top: 10px; left: 50% !important; right: auto;' +
      '  display: flex; justify-content: center;' +
      '  color: #888 !important;' +
      '  font-size: 9px !important;' +
      '  line-height: 20px !important;' +
      '  transform: translateY(-18px) translateX(-50%);' +
      '  padding: 0 4px;' +
      '  background: #fff;' +
      '  position: absolute;' +
      '}' +
      '.v-input-input {' +
      '  background-repeat: no-repeat;' +
      '  margin: 0;' +
      '  border-radius: 0;' +
      '  font: inherit;' +
      '  background-color: transparent;' +
      '  border-style: none;' +
      '  cursor: default;' +
      '  flex: 1 1 auto;' +
      '  line-height: 20px;' +
      '  padding: 8px 0 8px;' +
      '  max-width: 100%; min-width: 0; width: 100%;' +
      '  max-height: 32px;' +
      '  text-align: center;' +
      '  color: #626262 !important;' +
      '  font-size: 14px !important;' +
      '}' +
      '.v-input-input:focus { outline: none; }' +
      '.caption {' +
      '  font-size: 10px; color: #94a3b8; text-align: center;' +
      '  margin-top: 10px; letter-spacing: -0.3px;' +
      '}' +
      '</style>' +
      '<div class="panel" id="panel" part="panel">' +
      '  <div class="cur">실수치: <b id="cur">—</b></div>' +
      '  <div class="boxes">' +
      buildPresetHtml('최속', 'b0') +
      buildPresetHtml('준속', 'b1') +
      buildPresetHtml('무보정', 'b2') +
      '  </div>' +
      '  <div class="caption">족 추월</div>' +
      '</div>';

    /** 초기 legend 노치 너비 계산 — SCDream 폰트 로드 전/후 2회. */
    requestAnimationFrame(function () {
      sizeLegends(root);
    });
    setTimeout(function () {
      sizeLegends(root);
    }, 500);

    return root;
  }

  function buildPresetHtml(labelText, inputId) {
    return (
      '    <div class="preset">' +
      '      <div class="v-input__control">' +
      '        <div class="v-input__slot">' +
      '          <fieldset aria-hidden="true">' +
      '            <legend><span class="notranslate">\u200B</span></legend>' +
      '          </fieldset>' +
      '          <div class="v-text-field__slot">' +
      '            <label class="v-label" for="' + inputId + '">' + labelText + '</label>' +
      '            <input class="v-input-input" disabled readonly type="text" size="1" id="' + inputId + '" />' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </div>'
    );
  }

  /**
   * 라벨 텍스트 실제 너비에 맞춰 각 `<legend>` 의 width 를 설정.
   * Vuetify 가 런타임에 하는 notch 자동 사이징을 흉내. "최속/준속"(2자) 과
   * "무보정"(3자) 이 모두 라벨 뒤의 테두리를 완전히 가리도록 보장.
   */
  function sizeLegends(root) {
    if (!root) return;
    var presets = root.querySelectorAll('.preset');
    for (var i = 0; i < presets.length; i++) {
      var label = presets[i].querySelector('.v-label');
      var legend = presets[i].querySelector('legend');
      if (!label || !legend) continue;
      var w = Math.ceil(label.getBoundingClientRect().width);
      legend.style.width = Math.max(14, w) + 'px';
    }
  }

  function updatePanel(root, S, bases, visible) {
    if (!root) return;
    var panel = root.getElementById('panel');
    if (!panel) return;
    panel.classList.toggle('on', !!visible);
    if (!visible) return;
    var cur = root.getElementById('cur');
    var b0 = root.getElementById('b0');
    var b1 = root.getElementById('b1');
    var b2 = root.getElementById('b2');
    if (cur) cur.textContent = S == null ? '—' : String(S);
    if (b0) b0.value = bases.fastest == null ? '—' : String(bases.fastest);
    if (b1) b1.value = bases.neutral == null ? '—' : String(bases.neutral);
    if (b2) b2.value = bases.uninvested == null ? '—' : String(bases.uninvested);
  }

  var pollTimer = null;
  /** 마지막 반영한 S. undefined = 미초기화, null = 숨김 상태 */
  var lastS;

  function tick(root) {
    if (!isSmartnuoHost() || isLikelyCalculatorView()) {
      if (lastS !== null) {
        updatePanel(root, null, { fastest: null, neutral: null, uninvested: null }, false);
        lastS = null;
      }
      return;
    }
    var S = readSpeedReal();
    if (S === lastS) return;
    lastS = S;
    if (S == null) {
      updatePanel(root, null, { fastest: null, neutral: null, uninvested: null }, false);
      return;
    }
    updatePanel(root, S, computeOutspeedBases(S), true);
  }

  function init() {
    if (!isSmartnuoHost()) return;
    var root = mountPanel();
    tick(root);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      tick(root);
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
