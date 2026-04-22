/**
 * 팀빌더: 우측 편집 패널 스피드 실수값을 읽어 3 프리셋(최속/준속/무보정)으로
 * outspeed 가능한 최대 상대 base 스피드를 계산, 실수값 `.v-input` 래퍼 우측에
 * inline 으로 붙어있는 Shadow DOM 패널에 표시.
 *
 * 프리셋 공식: `floor((base + 20 + EV) * nature) < S` 를 만족하는 최대 정수 base.
 *   - 최속: EV=32, nature=1.1  (새 EV 시스템: 1 EV = 실수값 1, 최대 32)
 *   - 준속: EV=32, nature=1.0
 *   - 무보정: EV=0, nature=1.0
 *   - IV=V(=31) 고정 → 실수값에 +20 기여
 *
 * 배치 전략:
 *   실수값 `.v-input.rounded-lg` 래퍼는 이미 `position: relative` 이고 10단계
 *   조상 모두 `overflow: visible`. 그래서 호스트 div 를 래퍼 자식으로 넣고
 *   inline style `position:absolute; left:calc(100% + 8px); top:0` 만 주면
 *   시각적으로 샘플 편집 컨테이너 바깥 우측에 자연스럽게 붙음. 스크롤/리사이즈
 *   좌표 추적 불필요.
 *
 * 스피드 실수값 읽기:
 *   "스피드 수치" <p> 라벨 기준 DOM 트래버설 → 같은 row 의 입력 셀에서
 *   `input[disabled][readonly][type="text"]` → 그 `.v-input` 래퍼.
 *   Vuetify 자동 ID(input-2673 등)는 언제든 바뀌므로 사용 안 함.
 *
 * 폴링 200ms: teamBuilderFill 과 동일 전략. Vuetify 가 포켓몬 전환 시 래퍼를
 * 교체하면 tick 이 감지해서 호스트를 재장착.
 */
(function () {
  'use strict';

  var HOST_ID = 'nuo-fmt-speed-outspeed-host';

  /** 팀빌더 샘플 변환 옵션처럼 브라우저에 유지 (`chrome.storage.local`). */
  var SK_SPEED = {
    ability: 'nuo_fmt_speedPanelAbilityOn',
    item: 'nuo_fmt_speedPanelItemOn',
    oppScarf: 'nuo_fmt_speedPanelOppScarf',
    collapsed: 'nuo_fmt_speedPanelCollapsed',
  };
  var SPEED_PREF_KEYS = [SK_SPEED.ability, SK_SPEED.item, SK_SPEED.oppScarf, SK_SPEED.collapsed];

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

  /**
   * 스피드 관련 특성/도구 → 배율 매핑. 토글 ON 이어도 매핑 없으면 배율 1.
   * 이름 표기는 스마트누오 hidden input 에 들어가는 정식 한글 명칭 기준.
   */
  var ABILITY_MUL = {
    '엽록소': 2,
    '쓱쓱': 2,
    '모래헤치기': 2,
    '눈치우기': 2,
  };
  var ITEM_MUL = {
    '구애스카프': 1.5,
    '검은철구': 0.5,
  };

  /** 특성→도구 순차 floor. 토글 OFF 면 해당 배율 1. */
  function computeFinal(S, abilityName, abilityOn, itemName, itemOn) {
    if (!Number.isFinite(S) || S <= 0) return S;
    var ab = abilityOn ? (ABILITY_MUL[abilityName] || 1) : 1;
    var it = itemOn ? (ITEM_MUL[itemName] || 1) : 1;
    var step1 = Math.floor(S * ab);
    return Math.floor(step1 * it);
  }

  /** 우측 편집 패널 "스피드 수치" 실수값 `.v-input` 래퍼 반환. 못 찾으면 null. */
  function findSpeedRealWrap() {
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
    return realInput.closest('.v-input');
  }

  /** 주어진 `.v-input` 래퍼에서 실수값 정수 추출. 못 읽으면 null. */
  function readSpeedFromWrap(wrap) {
    if (!wrap) return null;
    var input = wrap.querySelector('input[disabled][readonly][type="text"]');
    if (!input) return null;
    var v = parseInt(input.value, 10);
    return Number.isFinite(v) ? v : null;
  }

  /** 스피드 실수값 래퍼가 속한 샘플 편집 카드(rounded-12.v-sheet) 를 반환. */
  function findCardRoot(wrap) {
    if (!wrap) return document;
    return wrap.closest('.rounded-12.v-sheet') || wrap.closest('.v-sheet') || document;
  }

  /**
   * 카드 내 특정 라벨 텍스트(`특성`/`도구`) 에 해당하는 `.v-input` 의
   * hidden input 값 반환. 없으면 빈 문자열.
   */
  function readHiddenByLabel(card, labelText) {
    if (!card) return '';
    var labels = card.querySelectorAll('.v-label');
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || '').trim() === labelText) {
        var wrap = labels[i].closest('.v-input');
        if (!wrap) continue;
        var h = wrap.querySelector('input[type="hidden"]');
        return h ? (h.value || '') : '';
      }
    }
    return '';
  }

  function computeOutspeedBases(S, oppScarf) {
    if (!Number.isFinite(S) || S <= 0) {
      return { fastest: null, neutral: null, uninvested: null };
    }
    var scarf = oppScarf ? 1.5 : 1;
    function solve(ev, nat) {
      for (var b = 500; b >= 0; b--) {
        if (Math.floor(Math.floor((b + 20 + ev) * nat) * scarf) < S) return b;
      }
      return null;
    }
    return {
      fastest: solve(32, 1.1),
      neutral: solve(32, 1.0),
      uninvested: solve(0, 1.0),
    };
  }

  /**
   * 지정된 `.v-input` 래퍼 자식으로 Shadow DOM 호스트 생성·부착.
   * 호스트 inline style 로 래퍼 우측 바로 옆에 absolute 배치.
   * Shadow DOM 내부엔 Vuetify outlined 스타일 복제된 3 프리셋 패널 렌더.
   */
  function mountPanelInto(wrap) {
    var host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText =
      'position:absolute;left:calc(100%);top:-47px;left:62px;z-index:10;' +
      'display:block;pointer-events:auto;';
    wrap.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });

    /**
     * 스마트누오 Vuetify outlined 입력 필드 구조를 그대로 복제.
     * 테두리는 `<fieldset>` 이 그리고 `<legend>` 가 상단 노치를 만듦.
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
      '@keyframes nuo-speed-host-in {' +
      '  from { opacity: 0; transform: translateX(-8px); }' +
      '  to { opacity: 1; transform: translateX(0); }' +
      '}' +
      '.wrap {' +
      '  display: block;' +
      '  animation: nuo-speed-host-in .32s cubic-bezier(.25,.8,.5,1) both;' +
      '}' +
      '.panel-shell {' +
      '  transition: max-width .32s cubic-bezier(.25,.8,.5,1);' +
      '}' +
      '.wrap.collapsed .panel-shell { max-width: 0; }' +
      '.panel {' +
      '  position: relative;' +
      '  background: #fff; border: 1px solid #d9d9d9; border-radius: 12px;' +
      '  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);' +
      '  padding: 12px 10px 14px; color: #0f172a; width: 189px;' +
      '  flex-shrink: 0;' +
      '  transition: opacity .26s cubic-bezier(.25,.8,.5,1), transform .32s cubic-bezier(.25,.8,.5,1);' +
      '}' +
      '.wrap.collapsed .panel {' +
      '  opacity: 0;' +
      '  transform: translateX(-10px);' +
      '  pointer-events: none;' +
      '}' +
      '@media (prefers-reduced-motion: reduce) {' +
      '  .wrap { animation: none; }' +
      '  .panel-shell { transition: none; }' +
      '  .panel { transition: none; }' +
      '  .wrap.collapsed .panel { transform: none; }' +
      '}' +
      '.chev {' +
      '  position: absolute; top: 60px; left: -10px;' +
      '  width: 22px; height: 22px;' +
      '  border: 1px solid #d9d9d9;' +
      '  background: #fff;' +
      '  color: #626262; font-size: 10px; line-height: 1;' +
      '  cursor: pointer; padding: 0;' +
      '  border-radius: 50%;' +
      '  font-family: SCDream, sans-serif;' +
      '  display: flex; align-items: center; justify-content: center;' +
      '  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);' +
      '  transition: color .3s cubic-bezier(.25,.8,.5,1);' +
      '}' +
      '.chev:hover { color: #e4007f; }' +
      '.chev::before {' +
      '  content: "\u25C0";' +
      '  display: inline-block;' +
      '  text-indent: -0.1em;' +
      '  transition: transform .3s cubic-bezier(.25,.8,.5,1);' +
      '}' +
      '.wrap.collapsed .chev::before { transform: rotate(-180deg); }' +
      '.topRow {' +
      '  display: flex; align-items: center; justify-content: space-between;' +
      '  gap: 8px; margin-bottom: 14px;' +
      '}' +
      '.tg-group { display: flex; gap: 4px; flex: 0 0 auto; }' +
      '.toggle {' +
      '  flex: 0 0 auto;' +
      '  height: 20px; padding: 0 7px;' +
      '  border-radius: 10px;' +
      '  border: 1px solid rgb(233, 196, 106);' +
      '  background: rgb(233, 196, 106); color: #fff;' +
      '  font-family: SCDream, sans-serif;' +
      '  font-size: 10px; line-height: 1;' +
      '  letter-spacing: -0.3px;' +
      '  cursor: pointer; user-select: none;' +
      '  transition: background .15s, color .15s, border-color .15s;' +
      '}' +
      '.toggle.on {' +
      '  background: #e4007f;' +
      '  border-color: #e4007f;' +
      '  color: #fff;' +
      '}' +
      '.toggle.opp {' +
      '  position: absolute;' +
      '  right: 10px; top: 105px;' +
      '  height: 18px; padding: 0 6px;' +
      '  border-radius: 9px;' +
      '  font-size: 9px;' +
      '}' +
      '.cur {' +
      '  flex: 0 0 auto;' +
      '  font-size: 12px; color: #0f172a;' +
      '  letter-spacing: -0.3px;' +
      '}' +
      '.cur b { font-weight: 700; color: #e4007f; }' +
      '.boxes { display: flex; gap: 6px; }' +
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
      '  font-size: 10px; color: #636363; text-align: center;' +
      '  margin-top: 10px; letter-spacing: -0.3px;' +
      '}' +
      '</style>' +
      '<div class="wrap' +
      (collapsed ? ' collapsed' : '') +
      '" id="wrap">' +
      '  <div class="panel-shell">' +
      '  <div class="panel" id="panel" part="panel">' +
      '    <div class="topRow">' +
      '      <div class="tg-group">' +
      '        <button class="toggle" id="tgl-ab" type="button">특성</button>' +
      '        <button class="toggle" id="tgl-it" type="button">도구</button>' +
      '      </div>' +
      '      <div class="cur">최종: <b id="final">—</b></div>' +
      '    </div>' +
      '    <div class="boxes">' +
      buildPresetHtml('최속', 'b0') +
      buildPresetHtml('준속', 'b1') +
      buildPresetHtml('무보정', 'b2') +
      '    </div>' +
      '    <div class="caption">족 추월</div>' +
      '    <button class="toggle opp" id="tgl-opp" type="button">상대 스카프</button>' +
      '  </div>' +
      '  </div>' +
      '  <button class="chev" id="chv" type="button" aria-label="펼치기/접기"></button>' +
      '</div>';

    /** 초기 legend 노치 너비 계산 — SCDream 폰트 로드 전/후 2회. */
    requestAnimationFrame(function () {
      sizeLegends(root);
    });
    setTimeout(function () {
      sizeLegends(root);
    }, 500);

    /** 토글/쉐브론 클릭 바인딩. */
    var tAb = root.getElementById('tgl-ab');
    var tIt = root.getElementById('tgl-it');
    var tOpp = root.getElementById('tgl-opp');
    var chv = root.getElementById('chv');
    if (tAb) {
      tAb.addEventListener('click', function () {
        abilityOn = !abilityOn;
        syncAllState(root);
        persistSpeedPrefs();
        lastKey = '';
        tick();
      });
    }
    if (tIt) {
      tIt.addEventListener('click', function () {
        itemOn = !itemOn;
        syncAllState(root);
        persistSpeedPrefs();
        lastKey = '';
        tick();
      });
    }
    if (tOpp) {
      tOpp.addEventListener('click', function () {
        oppScarfOn = !oppScarfOn;
        syncAllState(root);
        persistSpeedPrefs();
        lastKey = '';
        tick();
      });
    }
    if (chv) {
      chv.addEventListener('click', function () {
        collapsed = !collapsed;
        syncAllState(root);
        persistSpeedPrefs();
      });
    }
    syncAllState(root);

    return root;
  }

  /**
   * 모듈 상태(abilityOn/itemOn/oppScarfOn/collapsed) → Shadow DOM 동기화.
   * 호스트 top 은 mount 시 -49px 고정 — 쉐브론은 top:63px 고정으로
   * 펼침/접힘 상태 무관히 항상 실수값 세로 중앙(host_y 74)에 위치.
   */
  function syncAllState(root) {
    if (!root) return;
    var tAb = root.getElementById('tgl-ab');
    var tIt = root.getElementById('tgl-it');
    var tOpp = root.getElementById('tgl-opp');
    var wrap = root.getElementById('wrap');
    if (tAb) tAb.classList.toggle('on', abilityOn);
    if (tIt) tIt.classList.toggle('on', itemOn);
    if (tOpp) tOpp.classList.toggle('on', oppScarfOn);
    if (wrap) wrap.classList.toggle('collapsed', collapsed);
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
   * Vuetify 가 런타임에 하는 notch 자동 사이징을 흉내.
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

  function updatePanel(root, F, bases) {
    if (!root) return;
    var fin = root.getElementById('final');
    var b0 = root.getElementById('b0');
    var b1 = root.getElementById('b1');
    var b2 = root.getElementById('b2');
    if (fin) fin.textContent = F == null ? '—' : String(F);
    if (b0) b0.value = bases.fastest == null ? '—' : String(bases.fastest);
    if (b1) b1.value = bases.neutral == null ? '—' : String(bases.neutral);
    if (b2) b2.value = bases.uninvested == null ? '—' : String(bases.uninvested);
  }

  var pollTimer = null;
  /** 마지막으로 장착한 `.v-input` 래퍼. Vuetify 가 교체하면 감지 후 재장착. */
  var lastWrap = null;
  var currentRoot = null;
  /** 변경 감지용 합성 키: `S|abName|abOn|itName|itOn`. */
  var lastKey = '';
  /** 토글·접힘 — 기본: 도구만 ON, 나머지 OFF·펼침; 이후 값은 `chrome.storage.local` 에서 복원. */
  var abilityOn = false;
  var itemOn = true;
  var oppScarfOn = false;
  var collapsed = false;

  function applySpeedPrefsDefaults() {
    abilityOn = false;
    itemOn = true;
    oppScarfOn = false;
    collapsed = false;
  }

  function applySpeedPrefsFromStorage(got) {
    got = got || {};
    abilityOn = got[SK_SPEED.ability] === true;
    itemOn = got[SK_SPEED.item] !== false;
    oppScarfOn = got[SK_SPEED.oppScarf] === true;
    collapsed = got[SK_SPEED.collapsed] === true;
  }

  function persistSpeedPrefs() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.set({
        [SK_SPEED.ability]: !!abilityOn,
        [SK_SPEED.item]: !!itemOn,
        [SK_SPEED.oppScarf]: !!oppScarfOn,
        [SK_SPEED.collapsed]: !!collapsed,
      });
    } catch (e) {}
  }

  function startInitWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  function loadSpeedPrefsThenInit() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(SPEED_PREF_KEYS, function (got) {
        if (chrome.runtime.lastError) applySpeedPrefsDefaults();
        else applySpeedPrefsFromStorage(got);
        startInitWhenReady();
      });
    } else {
      applySpeedPrefsDefaults();
      startInitWhenReady();
    }
  }

  function removeHost() {
    if (currentRoot && currentRoot.host && currentRoot.host.parentElement) {
      currentRoot.host.parentElement.removeChild(currentRoot.host);
    }
    currentRoot = null;
    lastWrap = null;
    lastKey = '';
  }

  function tick() {
    var wrap = null;
    if (isSmartnuoHost() && !isLikelyCalculatorView()) {
      wrap = findSpeedRealWrap();
    }
    if (!wrap) {
      if (currentRoot) removeHost();
      return;
    }
    if (wrap !== lastWrap || !currentRoot || !currentRoot.host.isConnected) {
      if (currentRoot) removeHost();
      currentRoot = mountPanelInto(wrap);
      lastWrap = wrap;
      lastKey = '';
    }
    var S = readSpeedFromWrap(wrap);
    var card = findCardRoot(wrap);
    var abName = readHiddenByLabel(card, '특성');
    var itName = readHiddenByLabel(card, '도구');
    var key = S + '|' + abName + '|' + abilityOn + '|' + itName + '|' + itemOn + '|' + oppScarfOn;
    if (key === lastKey) return;
    lastKey = key;
    var F = computeFinal(S, abName, abilityOn, itName, itemOn);
    updatePanel(currentRoot, F, computeOutspeedBases(F, oppScarfOn));
  }

  function init() {
    if (!isSmartnuoHost()) return;
    tick();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(tick, 200);
  }

  loadSpeedPrefsThenInit();
})();
