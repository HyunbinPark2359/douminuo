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
 *
 * 프리셋 호버 시 `regulationMaSpeedData.js`가 주입한 레귤 M-A 스피드 종족표 기준
 * 표 칸(앵커 위 3·아래 1) 포켓몬 이름을 팝오버로 표시하고, 표 상단 말풍선 뿔은 호버 중인 프리셋 칼럼
 * (최속 / 준속 / 무보정) 중앙을 가리키게 배치함. (원본 JSON 수정 후
 * `node extension/embedSpeedData.js` 로 `regulationMaSpeedData.js` 재생성.)
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
  var SK_SPEED_UI = {
    enabled: 'nuo_fmt_simpleSpeedCalcEnabled',
    tableShow: 'nuo_fmt_speedTableShow',
    tableTrigger: 'nuo_fmt_speedTableTrigger',
  };
  var SPEED_PREF_KEYS = [SK_SPEED.ability, SK_SPEED.item, SK_SPEED.oppScarf, SK_SPEED.collapsed];
  var SPEED_ALL_PREF_KEYS = SPEED_PREF_KEYS.concat([
    SK_SPEED_UI.enabled,
    SK_SPEED_UI.tableShow,
    SK_SPEED_UI.tableTrigger,
  ]);

  /** `regulationMaSpeedData.js` 가 `globalThis.NUO_REGULATION_MA_SPEED` 에 넣음 (페이지에서 fetch 불가 대응). */
  var regulationSpeedBySpeed = null;
  var regulationSpeedMeta = null;

  function hydrateRegulationSpeedTable() {
    try {
      var g = globalThis.NUO_REGULATION_MA_SPEED;
      if (!g || typeof g !== 'object' || !g.bySpeed) return false;
      regulationSpeedMeta = g.meta || {};
      regulationSpeedBySpeed = g.bySpeed;
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadRegulationSpeedTable(done) {
    if (!regulationSpeedBySpeed && !hydrateRegulationSpeedTable()) {
      if (typeof done === 'function') done(new Error('no_embed'));
      return;
    }
    if (typeof done === 'function') done(null, regulationSpeedBySpeed);
  }

  function getTierDescFromMap(map) {
    var keys = Object.keys(map || {});
    var nums = [];
    for (var i = 0; i < keys.length; i++) {
      var n = parseInt(keys[i], 10);
      if (Number.isFinite(n)) nums.push(n);
    }
    nums.sort(function (a, b) {
      return b - a;
    });
    return nums;
  }

  function namesForTier(map, tier) {
    var arr = map[String(tier)];
    if (!arr || !arr.length) return '(없음)';
    return arr.join(', ');
  }

  /**
   * 하이라이트 컷오프: 기준 종족값 A (및 그 아래 = 종족값 ≤ A 행 강조).
   * `buildSpeciesPopoverRows` 와 동일 앵커 규칙.
   */
  function getPopoverAnchorCutoff(V, map) {
    var tierDesc = getTierDescFromMap(map);
    if (tierDesc.length === 0) return null;
    var minT = tierDesc[tierDesc.length - 1];
    var maxT = tierDesc[0];
    if (V < minT) return V;
    if (V > maxT) return maxT;
    var A = minT;
    for (var j = 0; j < tierDesc.length; j++) {
      if (tierDesc[j] <= V) {
        A = tierDesc[j];
        break;
      }
    }
    return A;
  }

  /**
   * 표 칸 기준: 앵커 위 최대 3칸, 아래 1칸(앵커·캡 반영). 반환 행은 화면 위→아래(종족값 큰 순).
   * 각 원소: { labelSpeed, namesText, rowVariant }
   */
  function buildSpeciesPopoverRows(V, map) {
    var tierDesc = getTierDescFromMap(map);
    if (tierDesc.length === 0) return [];

    var minT = tierDesc[tierDesc.length - 1];
    var maxT = tierDesc[0];
    var rows = [];

    if (V < minT) {
      var idxSmall = -1;
      for (var u = tierDesc.length - 1; u >= 0; u--) {
        if (tierDesc[u] > V) {
          idxSmall = u;
          break;
        }
      }
      if (idxSmall - 1 >= 0) {
        rows.push({
          labelSpeed: tierDesc[idxSmall - 1],
          namesText: namesForTier(map, tierDesc[idxSmall - 1]),
          rowVariant: 'muted',
        });
      }
      if (idxSmall >= 0) {
        rows.push({
          labelSpeed: tierDesc[idxSmall],
          namesText: namesForTier(map, tierDesc[idxSmall]),
          rowVariant: 'muted',
        });
      }
      rows.push({
        labelSpeed: V,
        namesText: '(없음)',
        rowVariant: 'center',
      });
      return rows;
    }

    if (V > maxT) {
      rows.push({
        labelSpeed: maxT,
        namesText: namesForTier(map, maxT),
        rowVariant: 'center',
      });
      if (tierDesc.length > 1) {
        rows.push({
          labelSpeed: tierDesc[1],
          namesText: namesForTier(map, tierDesc[1]),
          rowVariant: 'muted',
        });
      }
      return rows;
    }

    var A = minT;
    var iAnchor = -1;
    for (var j = 0; j < tierDesc.length; j++) {
      if (tierDesc[j] <= V) {
        A = tierDesc[j];
        iAnchor = j;
        break;
      }
    }
    if (iAnchor < 0) return rows;

    if (iAnchor - 3 >= 0) {
      rows.push({
        labelSpeed: tierDesc[iAnchor - 3],
        namesText: namesForTier(map, tierDesc[iAnchor - 3]),
        rowVariant: 'muted',
      });
    }
    if (iAnchor - 2 >= 0) {
      rows.push({
        labelSpeed: tierDesc[iAnchor - 2],
        namesText: namesForTier(map, tierDesc[iAnchor - 2]),
        rowVariant: 'muted',
      });
    }
    if (iAnchor - 1 >= 0) {
      rows.push({
        labelSpeed: tierDesc[iAnchor - 1],
        namesText: namesForTier(map, tierDesc[iAnchor - 1]),
        rowVariant: 'muted',
      });
    }
    rows.push({
      labelSpeed: A,
      namesText: namesForTier(map, A),
      rowVariant: 'center',
    });
    if (iAnchor + 1 < tierDesc.length) {
      rows.push({
        labelSpeed: tierDesc[iAnchor + 1],
        namesText: namesForTier(map, tierDesc[iAnchor + 1]),
        rowVariant: 'muted',
      });
    }
    return rows;
  }

  /** 패널 하나만 있으므로 전역 타이머로 호버 해제 지연 처리. */
  var speciesPopoverHideTimer = null;
  var SPECIES_POP_HIDE_DELAY_MS = 100;

  function clearSpeciesPopoverHideTimer() {
    if (speciesPopoverHideTimer) {
      clearTimeout(speciesPopoverHideTimer);
      speciesPopoverHideTimer = null;
    }
  }

  function scheduleSpeciesPopoverHide(root) {
    clearSpeciesPopoverHideTimer();
    speciesPopoverHideTimer = setTimeout(function () {
      speciesPopoverHideTimer = null;
      hideSpeciesPopover(root);
    }, SPECIES_POP_HIDE_DELAY_MS);
  }

  function hideSpeciesPopover(root) {
    clearSpeciesPopoverHideTimer();
    if (!root) return;
    var pop = root.getElementById('species-pop');
    if (pop) pop.hidden = true;
  }

  /** 스피드표 상단 말풍선 뿔 — 호버 중인 최속/준속/무보정 칼럼 중앙으로 정렬. */
  function positionSpeciesPopTail(root, presetIndex) {
    var pop = root.getElementById('species-pop');
    var tail = root.getElementById('species-pop-tail');
    var presets = root.querySelectorAll('.preset');
    if (!pop || !tail || pop.hidden || presetIndex < 0 || presetIndex >= presets.length)
      return;
    var pr = presets[presetIndex];
    if (!pr || !pr.getBoundingClientRect) return;
    var popRect = pop.getBoundingClientRect();
    var preRect = pr.getBoundingClientRect();
    var cx = preRect.left + preRect.width / 2 - popRect.left;
    tail.style.left = cx + 'px';
  }

  function appendSpeciesPopDivider(bodyEl, label, kind) {
    var d = document.createElement('div');
    d.className =
      'species-pop-divider' +
      (kind === 'outspeed' ? ' species-pop-divider--outspeed' : '');
    d.setAttribute('role', 'presentation');
    var left = document.createElement('span');
    left.className = 'species-pop-divider-line';
    var mid = document.createElement('span');
    mid.className = 'species-pop-divider-label';
    mid.textContent = label;
    var right = document.createElement('span');
    right.className = 'species-pop-divider-line';
    d.appendChild(left);
    d.appendChild(mid);
    d.appendChild(right);
    bodyEl.appendChild(d);
  }

  function fillSpeciesPopover(root, centerSpeed, presetIndex) {
    var slot =
      presetIndex === undefined || presetIndex === null
        ? 0
        : Math.max(0, Math.min(2, presetIndex | 0));
    var pop = root.getElementById('species-pop');
    var titleEl = root.getElementById('species-pop-title');
    var bodyEl = root.getElementById('species-pop-body');
    if (!pop || !bodyEl) return;

    function render(map) {
      var list = buildSpeciesPopoverRows(centerSpeed, map);
      var cutoff = getPopoverAnchorCutoff(centerSpeed, map);
      var wrap = root.host && root.host.parentElement;
      var tieB = null;
      if (wrap) {
        var S = readSpeedFromWrap(wrap);
        if (Number.isFinite(S)) {
          var card = findCardRoot(wrap);
          var abName = readHiddenByLabel(card, '특성');
          var itName = readHiddenByLabel(card, '도구');
          var F = computeFinal(S, abName, abilityOn, itName, itemOn);
          if (Number.isFinite(F) && F > 0) {
            var pn = presetEvNat(slot);
            tieB = findTieSpeciesStat(F, centerSpeed, pn.ev, pn.nat, oppScarfOn);
            if (tieB != null && !map[String(tieB)]) tieB = null;
          }
        }
      }
      list = mergePopoverRowsWithTie(list, tieB, map);
      bodyEl.innerHTML = '';
      for (var r = 0; r < list.length; r++) {
        var item = list[r];
        var tierNum =
          typeof item.labelSpeed === 'number'
            ? item.labelSpeed
            : parseInt(String(item.labelSpeed), 10);
        if (tieB != null && Number.isFinite(tierNum) && tierNum === tieB) {
          appendSpeciesPopDivider(bodyEl, '동속');
        }
        if (
          cutoff != null &&
          Number.isFinite(tierNum) &&
          Number.isFinite(cutoff) &&
          tierNum === cutoff
        ) {
          appendSpeciesPopDivider(bodyEl, '추월', 'outspeed');
        }
        var isTie =
          item.rowVariant === 'tie' ||
          (tieB != null && Number.isFinite(tierNum) && tierNum === tieB);
        var hi =
          !isTie &&
          cutoff != null &&
          Number.isFinite(tierNum) &&
          Number.isFinite(cutoff) &&
          tierNum <= cutoff;
        var row = document.createElement('div');
        row.className =
          'species-pop-row' + (isTie ? ' tie' : hi ? ' hi' : ' muted');
        var tierSpan = document.createElement('span');
        tierSpan.className = 'species-pop-tier';
        tierSpan.textContent = String(item.labelSpeed);
        var namesSpan = document.createElement('span');
        namesSpan.className = 'species-pop-names';
        namesSpan.textContent = item.namesText;
        row.appendChild(tierSpan);
        row.appendChild(document.createTextNode(' '));
        row.appendChild(namesSpan);
        bodyEl.appendChild(row);
      }
      pop.hidden = false;
      requestAnimationFrame(function () {
        positionSpeciesPopTail(root, slot);
      });
    }

    loadRegulationSpeedTable(function (err, map) {
      if (err || !map) {
        bodyEl.textContent = '목록을 불러오지 못했습니다.';
        pop.hidden = false;
        requestAnimationFrame(function () {
          positionSpeciesPopTail(root, slot);
        });
        return;
      }
      var titleText =
        (regulationSpeedMeta && regulationSpeedMeta.title) ||
        'Pokémon Champions 「레귤레이션 M-A」 출전 가능 포켓몬 스피드표';
      pop.setAttribute('title', titleText);
      pop.setAttribute('aria-label', titleText);
      if (titleEl) titleEl.textContent = titleText;
      render(map);
    });
  }

  function setupSpeciesPopover(root) {
    var wrap = root.querySelector('.preset-boxes-wrap');
    if (!wrap) return;

    var pop = root.getElementById('species-pop');
    if (!speedTableShow) {
      if (pop) {
        pop.hidden = true;
      }
      loadRegulationSpeedTable(function () {});
      return;
    }

    function onLeaveWrap(ev) {
      if (speedTableTrigger !== 'hover') return;
      var rel = ev.relatedTarget;
      if (rel && wrap.contains(rel)) return;
      scheduleSpeciesPopoverHide(root);
    }
    wrap.addEventListener('mouseleave', onLeaveWrap);

    if (pop) {
      pop.addEventListener('mouseenter', function () {
        if (speedTableTrigger === 'hover') clearSpeciesPopoverHideTimer();
      });
    }

    wrap.classList.toggle('speed-pop-click', speedTableTrigger === 'click');

    var docClickClose = null;
    if (speedTableTrigger === 'click') {
      docClickClose = function (ev) {
        var t = ev.target;
        if (wrap.contains(t) || (pop && pop.contains(t))) return;
        hideSpeciesPopover(root);
      };
      document.addEventListener('mousedown', docClickClose, true);
      root._nuoSpeedPopDocClose = docClickClose;
    }

    var presets = root.querySelectorAll('.preset');
    for (var i = 0; i < presets.length; i++) {
      (function (preset, idx) {
        function openFromPreset() {
          clearSpeciesPopoverHideTimer();
          var inp = preset.querySelector('.v-input-input');
          var raw = inp ? inp.value : '';
          var v = parseInt(raw, 10);
          if (!Number.isFinite(v)) {
            hideSpeciesPopover(root);
            return;
          }
          fillSpeciesPopover(root, v, idx);
        }
        if (speedTableTrigger === 'hover') {
          preset.addEventListener('mouseenter', openFromPreset);
        } else {
          /** disabled readonly input 은 click 이 부모로 안 올라옴 → 캡처 단계 pointerdown + 입력란 pointer-events:none */
          preset.addEventListener(
            'pointerdown',
            function (ev) {
              if (ev.button !== 0) return;
              ev.preventDefault();
              ev.stopPropagation();
              openFromPreset();
            },
            true
          );
        }
      })(presets[i], i);
    }

    loadRegulationSpeedTable(function () {});
  }

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

  /** `computeOutspeedBases` 와 동일한 상대 최종 스피드 (종족값 b 기준). */
  function opponentEffSpeed(b, ev, nat, oppScarf) {
    var scarf = oppScarf ? 1.5 : 1;
    return Math.floor(Math.floor((b + 20 + ev) * nat) * scarf);
  }

  /** 프리셋 슬롯 0=최속, 1=준속, 2=무보정 */
  function presetEvNat(slot) {
    if (slot === 0) return { ev: 32, nat: 1.1 };
    if (slot === 1) return { ev: 32, nat: 1.0 };
    return { ev: 0, nat: 1.0 };
  }

  /**
   * 동속 종족값: `anchor` 초과 중 처음으로 eff(b) === F 인 b. 건너뛰면 null.
   * 호출부에서 레귤 맵 키 존재 여부를 한 번 더 검사.
   */
  function findTieSpeciesStat(F, anchor, ev, nat, oppScarf) {
    if (!Number.isFinite(F) || !Number.isFinite(anchor)) return null;
    for (var b = anchor + 1; b <= 400; b++) {
      var e = opponentEffSpeed(b, ev, nat, oppScarf);
      if (e === F) return b;
      if (e > F) return null;
    }
    return null;
  }

  /**
   * 동속 행이 슬라이스 밖이면 삽입 후 종족값 내림차순 정렬. 해당 행은 rowVariant `tie`.
   */
  function mergePopoverRowsWithTie(rows, tieB, map) {
    var out = rows.slice();
    if (tieB == null || !map[String(tieB)]) return out;
    var i;
    var found = false;
    for (i = 0; i < out.length; i++) {
      if (out[i].labelSpeed === tieB) {
        found = true;
        out[i] = {
          labelSpeed: out[i].labelSpeed,
          namesText: out[i].namesText,
          rowVariant: 'tie',
        };
      }
    }
    if (!found) {
      out.push({
        labelSpeed: tieB,
        namesText: namesForTier(map, tieB),
        rowVariant: 'tie',
      });
    }
    out.sort(function (a, b) {
      return (b.labelSpeed | 0) - (a.labelSpeed | 0);
    });
    return out;
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
      '.preset-boxes-wrap { position: relative; width: 100%; }' +
      '.preset-boxes-wrap.speed-pop-click .preset { cursor: pointer; }' +
      '.preset-boxes-wrap.speed-pop-click .v-input-input {' +
      '  pointer-events: none;' +
      '}' +
      '.boxes { display: flex; gap: 6px; }' +
      '.preset { flex: 0 0 52px; width: 52px; min-width: 0; position: relative; }' +
      '.species-pop {' +
      '  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 25;' +
      '  background: #fff; border: 1px solid #d9d9d9; border-radius: 8px;' +
      '  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14); padding: 8px 10px;' +
      '  font-size: 10px; color: #0f172a; letter-spacing: -0.25px;' +
      '  overflow: visible; pointer-events: auto;' +
      '}' +
      '.species-pop-tail {' +
      '  position: absolute; top: -9px; left: 0; width: 18px; height: 9px;' +
      '  transform: translateX(-50%); pointer-events: none; z-index: 2;' +
      '}' +
      '.species-pop-tail::before {' +
      '  content: ""; position: absolute; left: 50%; bottom: 0;' +
      '  transform: translateX(-50%); width: 0; height: 0;' +
      '  border-left: 9px solid transparent; border-right: 9px solid transparent;' +
      '  border-bottom: 9px solid #d9d9d9;' +
      '}' +
      '.species-pop-tail::after {' +
      '  content: ""; position: absolute; left: 50%; bottom: -1px;' +
      '  transform: translateX(-50%); width: 0; height: 0;' +
      '  border-left: 8px solid transparent; border-right: 8px solid transparent;' +
      '  border-bottom: 8px solid #fff;' +
      '}' +
      '.species-pop[hidden] { display: none !important; }' +
      '.species-pop-title {' +
      '  font-weight: 700; font-size: 9px; color: #636363; margin-bottom: 8px; line-height: 1.35;' +
      '}' +
      '.species-pop-body {' +
      '  max-height: min(96vh, 3600px); overflow-y: auto;' +
      '}' +
      '.species-pop-row { margin-bottom: 6px; }' +
      '.species-pop-row:last-child { margin-bottom: 0; }' +
      '.species-pop-tier {' +
      '  font-weight: 700; display: inline; margin-right: 4px;' +
      '}' +
      '.species-pop-names {' +
      '  display: inline; word-break: keep-all;' +
      '}' +
      '.species-pop-row.hi .species-pop-tier { color: #e4007f; }' +
      '.species-pop-row.hi .species-pop-names { color: #0f172a; }' +
      '.species-pop-row.muted .species-pop-tier,' +
      '.species-pop-row.muted .species-pop-names { color: #94a3b8; }' +
      '.species-pop-divider {' +
      '  display: flex; align-items: center; gap: 8px;' +
      '  margin: 6px 0;' +
      '}' +
      '.species-pop-divider-line {' +
      '  flex: 1; min-width: 0; height: 1px; background: #cbd5e1;' +
      '}' +
      '.species-pop-divider-label {' +
      '  flex: 0 0 auto; font-size: 9px; font-weight: 700;' +
      '  color: #64748b; letter-spacing: -0.2px; padding: 0 6px; background: #fff;' +
      '}' +
      '.species-pop-divider--outspeed .species-pop-divider-label {' +
      '  color: #d6689a;' +
      '}' +
      '.species-pop-row.tie .species-pop-tier,' +
      '.species-pop-row.tie .species-pop-names { color: #0f172a; }' +
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
      '    <div class="preset-boxes-wrap">' +
      '    <div class="boxes">' +
      buildPresetHtml('최속', 'b0') +
      buildPresetHtml('준속', 'b1') +
      buildPresetHtml('무보정', 'b2') +
      '    </div>' +
      '    <div class="species-pop" id="species-pop" hidden role="tooltip">' +
      '      <div class="species-pop-tail" id="species-pop-tail" aria-hidden="true"></div>' +
      '      <div class="species-pop-title" id="species-pop-title"></div>' +
      '      <div class="species-pop-body" id="species-pop-body"></div>' +
      '    </div>' +
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
    setupSpeciesPopover(root);

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
    if (collapsed) hideSpeciesPopover(root);
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
  /** 환경설정: 기능 전체 / 종족표 / 호버·클릭 */
  var simpleSpeedCalcEnabled = true;
  var speedTableShow = true;
  var speedTableTrigger = 'hover';

  function applySpeedPrefsDefaults() {
    abilityOn = false;
    itemOn = true;
    oppScarfOn = false;
    collapsed = false;
    simpleSpeedCalcEnabled = true;
    speedTableShow = true;
    speedTableTrigger = 'hover';
  }

  function applySpeedPrefsFromStorage(got) {
    got = got || {};
    abilityOn = got[SK_SPEED.ability] === true;
    itemOn = got[SK_SPEED.item] !== false;
    oppScarfOn = got[SK_SPEED.oppScarf] === true;
    collapsed = got[SK_SPEED.collapsed] === true;
    simpleSpeedCalcEnabled = got[SK_SPEED_UI.enabled] !== false;
    speedTableShow = got[SK_SPEED_UI.tableShow] !== false;
    speedTableTrigger = got[SK_SPEED_UI.tableTrigger] === 'click' ? 'click' : 'hover';
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
      chrome.storage.local.get(SPEED_ALL_PREF_KEYS, function (got) {
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
    if (currentRoot && currentRoot._nuoSpeedPopDocClose) {
      try {
        document.removeEventListener('mousedown', currentRoot._nuoSpeedPopDocClose, true);
      } catch (e) {}
      delete currentRoot._nuoSpeedPopDocClose;
    }
    if (currentRoot && currentRoot.host && currentRoot.host.parentElement) {
      currentRoot.host.parentElement.removeChild(currentRoot.host);
    }
    currentRoot = null;
    lastWrap = null;
    lastKey = '';
  }

  function tick() {
    if (!simpleSpeedCalcEnabled) {
      if (currentRoot) removeHost();
      return;
    }
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
    loadRegulationSpeedTable(function () {});
    tick();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(tick, 200);
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== 'local') return;
      var hit =
        Object.prototype.hasOwnProperty.call(changes, SK_SPEED_UI.enabled) ||
        Object.prototype.hasOwnProperty.call(changes, SK_SPEED_UI.tableShow) ||
        Object.prototype.hasOwnProperty.call(changes, SK_SPEED_UI.tableTrigger);
      if (!hit) return;
      chrome.storage.local.get(SPEED_ALL_PREF_KEYS, function (got) {
        if (chrome.runtime.lastError) return;
        applySpeedPrefsFromStorage(got);
        removeHost();
        lastKey = '';
        tick();
      });
    });
  }

  loadSpeedPrefsThenInit();
})();
