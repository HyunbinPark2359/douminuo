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
      verifyRegulationEmbedFreshness();  // F-data-1: 1회 비동기 검증, idempotent
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * F-data-1: regulationMaSpeedTable.json 편집 후 embedSpeedData.js 재실행을 잊었을 때
   * silent stale 을 콘솔 경고로 잡는다. embedSpeedData 가 임베드한 fnv1a 해시 vs 런타임에
   * source JSON 을 다시 fnv1a 한 결과를 비교.
   *
   * 비용: 한 번만 fetch + JSON 파싱. 실패는 무시 (옛 빌드면 hash 가 없어 skip).
   */
  var regulationFreshnessChecked = false;
  function fnv1aHash(str) {
    var h = 0x811c9dc5 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (Math.imul ? Math.imul(h, 0x01000193) : (h * 0x01000193)) >>> 0;
    }
    var s = h.toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
  }
  function verifyRegulationEmbedFreshness() {
    if (regulationFreshnessChecked) return;
    regulationFreshnessChecked = true;
    var embedded = globalThis.NUO_REGULATION_MA_SPEED_SOURCE_HASH;
    if (typeof embedded !== 'string') return;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return;
    try {
      fetch(chrome.runtime.getURL('regulationMaSpeedTable.json'))
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (text) {
          if (text == null) return;
          var actual = fnv1aHash(text);
          if (actual !== embedded) {
            console.warn(
              '[도우미누오] regulationMaSpeedData.js stale — ' +
              'JSON 편집 후 `node extension/embedSpeedData.js` 재실행 필요.\n' +
              '  embedded: ' + embedded + ' / actual: ' + actual
            );
          }
        })
        .catch(function () {});
    } catch (eVer) {}
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

  /**
   * 우측 편집 패널 "스피드 수치" 실수값 `.v-input` 래퍼 반환. 못 찾으면 null.
   *
   * F9: 마지막으로 찾은 wrap 이 여전히 DOM 에 살아있고 우리가 기대하는 모양이면 그대로 재사용.
   * 200ms tick 마다 전 문서 `p.mb-0` selector + DOM walk 을 도는 부담을 줄인다 — 정상 케이스
   * (포켓몬 전환 없음) 에선 캐시 hit, Vuetify가 wrap 을 교체하면 isConnected 로 자동 미스.
   */
  function findSpeedRealWrap() {
    if (lastWrap && lastWrap.isConnected) {
      var cachedInput = lastWrap.querySelector('input[disabled][readonly][type="text"]');
      if (cachedInput) return lastWrap;
    }
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

  /**
   * F3: 0..500 선형 탐색을 닫힌형 후보 ±2 검증으로 (200ms tick × 3 프리셋 = 1500 step → ~6 step).
   * 부동소수점 경계 케이스를 잡기 위해 후보 주변 5칸만 직접 검증한다.
   *
   * 닫힌형 유도:
   *   floor(floor((b + 20 + ev) * nat) * scarf) < S
   *   ⟹ u = floor((b + 20 + ev) * nat) ≤ uMax = floor((S - 1) / scarf)
   *   ⟹ b + 20 + ev < (uMax + 1) / nat
   *   ⟹ b ≤ floor((uMax + 1) / nat - 20 - ev - epsilon)
   */
  function computeOutspeedBases(S, oppScarf) {
    if (!Number.isFinite(S) || S <= 0) {
      return { fastest: null, neutral: null, uninvested: null };
    }
    var scarf = oppScarf ? 1.5 : 1;
    function valid(b, ev, nat) {
      return Math.floor(Math.floor((b + 20 + ev) * nat) * scarf) < S;
    }
    function solve(ev, nat) {
      if (S <= 1) return null;
      var uMax = Math.floor((S - 1) / scarf);
      if (uMax < 0) return null;
      var bCand = Math.floor((uMax + 1) / nat - 20 - ev);
      // 옛 선형 탐색이 0..500 범위를 cap으로 사용했던 것과 동작을 맞춘다.
      // 실제로 현실 게임 종족값은 ≤ 150 이므로 500 cap을 넘는 영역은 회귀 의미 없음.
      if (bCand > 500) bCand = 500;
      // 후보 ±2 안에서 유효한 최대 b (부동소수 floor 보정).
      var hi = bCand + 2;
      if (hi > 500) hi = 500;
      var lo = bCand - 2;
      var b;
      for (b = hi; b >= lo; b--) {
        if (b < 0) break;
        if (valid(b, ev, nat)) return b;
      }
      // 닫힌형 후보가 어긋난 비정상 케이스: 옛 선형 탐색 fallback.
      for (b = 500; b >= 0; b--) {
        if (valid(b, ev, nat)) return b;
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
   *
   * F3: 닫힌형. 가장 작은 b s.t. eff(b) ≥ F 를 직접 계산한 뒤 ±2 검증.
   *   floor(u * scarf) ≥ F ⟹ u ≥ ceil(F / scarf)
   *   floor((b + 20 + ev) * nat) ≥ uMin ⟹ b ≥ ceil(uMin / nat - 20 - ev)
   */
  function findTieSpeciesStat(F, anchor, ev, nat, oppScarf) {
    if (!Number.isFinite(F) || !Number.isFinite(anchor)) return null;
    var scarf = oppScarf ? 1.5 : 1;
    var uMin = Math.ceil(F / scarf);
    var bRaw = uMin / nat - 20 - ev;
    var bCand = Math.max(anchor + 1, Math.ceil(bRaw - 1e-9));
    var b;
    for (b = bCand - 2; b <= bCand + 2; b++) {
      if (b <= anchor) continue;
      if (b > 400) break;
      var e = opponentEffSpeed(b, ev, nat, oppScarf);
      if (e === F) return b;
      if (e > F) return null;
    }
    // 닫힌형 후보가 어긋난 비정상 케이스: 옛 선형 탐색 fallback.
    for (b = anchor + 1; b <= 400; b++) {
      var e2 = opponentEffSpeed(b, ev, nat, oppScarf);
      if (e2 === F) return b;
      if (e2 > F) return null;
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
     *
     * F7: CSS 는 styles/speedPanel.js 가 globalThis.nuoSpeedPanelCss 로 export.
     */
    root.innerHTML =
      '<style>' + (globalThis.nuoSpeedPanelCss || '') + '</style>' +
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

  /**
   * F9: 마스터 스위치가 꺼졌으면 폴 인터벌 자체를 멈춰서 idle CPU 0 보장.
   * storage 변경 핸들러가 다시 켤 때 ensurePollTimer() 로 재가동.
   */
  function ensurePollTimer() {
    if (pollTimer) return;
    pollTimer = setInterval(tick, 200);
  }
  function stopPollTimer() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function tick() {
    if (!simpleSpeedCalcEnabled) {
      if (currentRoot) removeHost();
      stopPollTimer();
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
    stopPollTimer();
    if (simpleSpeedCalcEnabled) ensurePollTimer();
  }

  // F13: shared 헬퍼로 storage 변경 핸들러 통합. 변경 트리거 키만 한정해서 듣고
  // 콜백에선 SPEED_ALL_PREF_KEYS 전체를 다시 한 번 받아 일관성 유지.
  // (CS.onLocalPrefChange 가 자체적으로 storage.local.get(keys) 호출 → got 에는
  //  SK_SPEED_UI 3 키만 들어옴. 우리는 옛 동작과 동일하게 SPEED_ALL_PREF_KEYS 전체를 다시 가져온다.)
  var CSS = globalThis.nuoCsCommon;
  if (CSS && CSS.onLocalPrefChange) {
    CSS.onLocalPrefChange(
      [SK_SPEED_UI.enabled, SK_SPEED_UI.tableShow, SK_SPEED_UI.tableTrigger],
      function () {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
        chrome.storage.local.get(SPEED_ALL_PREF_KEYS, function (got) {
          if (chrome.runtime.lastError) return;
          applySpeedPrefsFromStorage(got);
          removeHost();
          lastKey = '';
          // F9: 비활성→활성 토글 시 인터벌 재가동, 활성→비활성 토글은 tick 안에서 stop.
          if (simpleSpeedCalcEnabled) ensurePollTimer();
          tick();
        });
      }
    );
  }

  loadSpeedPrefsThenInit();
})();
