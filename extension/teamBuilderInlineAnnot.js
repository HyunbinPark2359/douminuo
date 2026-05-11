/**
 * 팀빌더 좌측 샘플 카드 인라인: 결정력(기술명 직후) · 우상단 물리/특수 내구.
 *
 * F6: 옛 teamBuilderFill.js 에서 분리. FAB(우하단 플로팅) 와 인라인 어노테이션은
 * 독립된 시스템이라 한 IIFE 에 묶을 이유가 없었음. 분리 후 각 파일이 ~700 / ~1400 줄.
 *
 * 의존: globalThis.nuoCsCommon (calcFillShared.js), globalThis.nuoTeamBuilderShared
 * (teamBuilderShared.js). manifest 에서 두 파일이 본 파일보다 먼저 로드되도록 순서 고정.
 */
(function () {
  'use strict';

  var CS = globalThis.nuoCsCommon || {};
  var TBS = globalThis.nuoTeamBuilderShared || {};
  // R2/T1: 옛 "계산기 화면이면 hide" 의 음의 정의 → "팀빌더 화면이면 show" 양의 정의.
  var isTeamBuilderRoute = CS.isTeamBuilderRoute || function () { return true; };
  var isSmartnuoHost = TBS.isSmartnuoHost;
  var injectTeamBridgeOnce = TBS.injectTeamBridgeOnce;
  var getSlotsFromBridge = TBS.getSlotsFromBridge;

  if (typeof isSmartnuoHost !== 'function' || typeof getSlotsFromBridge !== 'function') {
    // shared 가 못 올라온 경우 — 안전하게 종료. manifest 순서 점검.
    return;
  }

  var TB_INLINE_STYLE_ID = 'nuo-fmt-tb-inline-annot-style';
  var LOCAL_TB_INLINE_LEGACY = 'nuo_fmt_teamBuilderInlineAnnotate';
  var LOCAL_TB_INLINE_MOVE = 'nuo_fmt_tbInlineMovePower';
  var LOCAL_TB_INLINE_BULK = 'nuo_fmt_tbInlineBulk';
  var tbInlineGen = 0;
  var tbInlineTimer = null;
  var tbInlineMo = null;
  var tbInlineAnnotInited = false;
  var tbInlineHandlersWired = false;
  var tbInlineMoveEnabled = true;
  var tbInlineBulkEnabled = true;

  function tbInlineAnyEnabled() {
    return tbInlineMoveEnabled || tbInlineBulkEnabled;
  }

  function refreshTbInlineOpt(done) {
    chrome.storage.local.get(
      [LOCAL_TB_INLINE_LEGACY, LOCAL_TB_INLINE_MOVE, LOCAL_TB_INLINE_BULK],
      function (got) {
        if (chrome.runtime.lastError) {
          tbInlineMoveEnabled = true;
          tbInlineBulkEnabled = true;
        } else {
          var m = got[LOCAL_TB_INLINE_MOVE];
          var b = got[LOCAL_TB_INLINE_BULK];
          var leg = got[LOCAL_TB_INLINE_LEGACY];
          if (m === undefined && b === undefined && leg !== undefined) {
            var on = leg !== false;
            m = on;
            b = on;
          } else {
            if (m === undefined) m = true;
            if (b === undefined) b = true;
          }
          tbInlineMoveEnabled = m !== false;
          tbInlineBulkEnabled = b !== false;
        }
        if (typeof done === 'function') done();
      }
    );
  }

  function ensureTbInlineStyle() {
    if (document.getElementById(TB_INLINE_STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = TB_INLINE_STYLE_ID;
    st.textContent =
      '.nuo-fmt-tb-ann{font-size:9px;font-weight:400;color:#64748b;display:inline;}' +
      '.nuo-fmt-tb-ann-num{white-space:nowrap;}' +
      '.nuo-fmt-tb-bulk-corner{position:absolute;top:8px;right:10px;font-size:9px;font-weight:400;color:#64748b;line-height:1.2;text-align:right;white-space:nowrap;pointer-events:none;z-index:4;}';
    document.head.appendChild(st);
  }

  function clearTbInlineAnnotations() {
    document.querySelectorAll('[data-nuo-tb-ann="1"]').forEach(function (n) {
      try {
        if (n.parentNode) n.parentNode.removeChild(n);
      } catch (e) {}
    });
  }

  function tbExtHostSelector() {
    return '#nuo-fmt-team-float-host, #nuo-fmt-calc-panel-host';
  }

  function isInTbExtHost(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!el.closest(tbExtHostSelector());
  }

  /** 팀빌더 좌측 슬롯 리스트 루트 — DOM 변경 시 이 한 줄만 수정. */
  var TB_SLOT_LIST_XPATH = '/html/body/div[1]/div/main/div/div[1]/div/div';

  /**
   * 슬롯 인덱스 0~5 → 해당 슬롯 카드 body element. 없으면 null.
   * list.children[0] = capture-hide 헤더 → 슬롯 i 는 children[i+1];
   * wrapper.children[1] = 카드 본체(라벨 헤더는 [0]).
   */
  function findSlotCardByIndex(slotIdx) {
    if (slotIdx < 0 || slotIdx > 5) return null;
    try {
      var list = document.evaluate(
        TB_SLOT_LIST_XPATH,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      if (!list || !list.children) return null;
      var wrapper = list.children[slotIdx + 1];
      if (!wrapper || !wrapper.children) return null;
      var body = wrapper.children[1] || wrapper.children[0];
      return body || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * filled[i] 가 true 인 슬롯만 카드 body 매핑 (옛 sprite URL 매칭 대체).
   */
  function mapSlotsToCardEls(filled) {
    var out = [null, null, null, null, null, null];
    for (var i = 0; i < 6; i++) {
      if (filled && filled[i]) out[i] = findSlotCardByIndex(i);
    }
    return out;
  }

  /**
   * 페이지에서 주어진 텍스트 요구사항(reqs)을 모두 포함하는 "leaf-most" ancestor 카드 루트를 찾는다.
   *
   * - `textContent.indexOf(req) !== -1` 로 검사하여 "텍스트 + 접미사"가 붙은 노드도 매칭.
   * - leaf-most: 다른 매치 노드를 자손으로 포함하지 않는 것만 선택.
   * - 다중 후보면 좌측 우선·같은 열은 위→아래 (슬롯 카드 vs 우측 패널 혼선 완화).
   * @param {string[]} reqs
   * @param {Element|null} [scopeRoot] 있으면 이 노드 하위만 검색 (카드 XPath 확정 후 좁힘).
   */
  function findLeafAncestorContaining(reqs, scopeRoot) {
    var candidates = [];
    if (scopeRoot && scopeRoot.nodeType === 1) {
      candidates.push(scopeRoot);
      candidates = candidates.concat(
        Array.prototype.slice.call(scopeRoot.querySelectorAll('div, section, article, li'))
      );
    } else {
      candidates = Array.prototype.slice.call(
        document.querySelectorAll('div, section, article, li')
      );
    }
    var matches = [];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (isInTbExtHost(el)) continue;
      var txt = el.textContent || '';
      var ok = true;
      var q;
      for (q = 0; q < reqs.length; q++) {
        if (txt.indexOf(reqs[q]) === -1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      var r;
      try {
        r = el.getBoundingClientRect();
      } catch (eR) {
        continue;
      }
      if (!r || !r.width || !r.height) continue;
      matches.push(el);
    }
    if (!matches.length) return null;
    var leaf = [];
    for (i = 0; i < matches.length; i++) {
      var m = matches[i];
      var hasInner = false;
      var j;
      for (j = 0; j < matches.length; j++) {
        if (j === i) continue;
        if (m.contains(matches[j])) {
          hasInner = true;
          break;
        }
      }
      if (!hasInner) leaf.push(m);
    }
    if (!leaf.length) return null;
    if (leaf.length === 1) return leaf[0];
    leaf.sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      if (Math.abs(ra.left - rb.left) > 50) return ra.left - rb.left;
      if (Math.abs(ra.top - rb.top) > 10) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    return leaf[0];
  }

  /**
   * 시각적 슬롯 카드 wrapper(파스텔 배경 + padding)로 한 단계 상승.
   * - parent 가 자신보다 1.5 배 이상 크면 grid/row 이므로 상승 안 함.
   * - 텍스트 기반 폴백 시 서브박스 대신 카드 단위로 맞추기 위함.
   */
  function ascendToSlotCardWrapper(node) {
    if (!node) return node;
    var p = node.parentElement;
    if (!p) return node;
    var nr, pr;
    try {
      nr = node.getBoundingClientRect();
      pr = p.getBoundingClientRect();
    } catch (eA) {
      return node;
    }
    if (!nr || !pr || !nr.width || !pr.width) return node;
    if (pr.width > nr.width * 1.5) return node;
    if (pr.height > nr.height * 1.5) return node;
    return p;
  }

  /**
   * 이미지 매칭 실패 시(신규 메가 등) 텍스트 시그니처로 슬롯 카드 루트를 찾는 폴백.
   * scopeRoot 가 있으면 그 안에서만 검색 — XPath 로 카드가 잡힌 뒤 결정력 앵커 좁힘용.
   */
  function findCardRootByMoveTexts(moveNames, speciesName, scopeRoot) {
    var want = (moveNames || []).filter(function (n) {
      return n && n !== '--';
    });
    if (want.length < 2) return null;
    var sp = (speciesName || '').trim();
    if (sp) {
      var cardWithSp = findLeafAncestorContaining(want.concat([sp]), scopeRoot);
      if (cardWithSp) return ascendToSlotCardWrapper(cardWithSp);
    }
    var cardMoves = findLeafAncestorContaining(want, scopeRoot);
    if (!cardMoves) return null;
    return ascendToSlotCardWrapper(ascendToSlotCardWrapper(cardMoves));
  }

  function moveDisplayNamesFromSlot(slotData) {
    var s =
      slotData && slotData.pokemon && typeof slotData.pokemon === 'object'
        ? Object.assign({}, slotData.pokemon, slotData)
        : slotData || {};
    if (s.movesKr && Array.isArray(s.movesKr) && s.movesKr.length) {
      var ok = ['', '', '', ''];
      var k;
      for (k = 0; k < 4 && k < s.movesKr.length; k++) ok[k] = String(s.movesKr[k] || '').trim();
      return ok;
    }
    var poke = slotData && slotData.pokemon;
    if (!poke || !Array.isArray(poke.moves)) return ['', '', '', ''];
    var out = ['', '', '', ''];
    var i;
    for (i = 0; i < 4 && i < poke.moves.length; i++) {
      var mv = poke.moves[i];
      if (mv == null) {
        out[i] = '';
        continue;
      }
      if (typeof mv === 'string') {
        out[i] = String(mv).trim();
        continue;
      }
      out[i] = String(
        mv.name_ko ||
          mv.nameKo ||
          mv.name_kr ||
          mv.nameKr ||
          mv.koName ||
          mv.label ||
          mv.name ||
          mv.title ||
          ''
      ).trim();
    }
    return out;
  }

  function findExactTextNodeHost(root, text) {
    var want = String(text || '').trim();
    if (!want || want === '--' || want.length > 48) return null;
    var nodes = root.querySelectorAll('span, div, button, a, p, td, li, label, h3, h4, strong, em');
    var matches = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isInTbExtHost(el)) continue;
      if (el.querySelector('.nuo-fmt-tb-ann')) continue;
      if (el.textContent.trim() !== want) continue;
      if (el.children.length > 6) continue;
      matches.push(el);
    }
    if (!matches.length) return null;
    // 다른 매치를 자손으로 포함하지 않는 노드(leaf-most) 우선 반환.
    // 1기 슬롯에서 기술 행 컨테이너가 잎 span보다 먼저 매치되어 결정력이
    // 카드 좌측 하단으로 떨어지는 회귀 방지.
    var j;
    for (j = 0; j < matches.length; j++) {
      var m = matches[j];
      var hasInner = false;
      var k;
      for (k = 0; k < matches.length; k++) {
        if (j === k) continue;
        if (m.contains(matches[k])) {
          hasInner = true;
          break;
        }
      }
      if (!hasInner) return m;
    }
    return matches[matches.length - 1];
  }

  function requestSlotAnnot(slotData) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: 'ANNOTATE_BUILDER_SLOT', slotData: slotData }, function (r) {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(r && r.ok ? r : null);
      });
    });
  }

  function applyMovePowerSuffixes(cardRoot, moveNames, suff) {
    if (!Array.isArray(suff)) return;
    var mi;
    for (mi = 0; mi < 4; mi++) {
      var suf = suff[mi];
      if (!suf) continue;
      var name = moveNames[mi];
      if (!name || name === '--') continue;
      var el = findExactTextNodeHost(cardRoot, name);
      if (!el) continue;
      if (el.querySelector('.nuo-fmt-tb-ann')) continue;
      // 기술명(한글)과 결정력이 한 줄에 안 들어갈 때 한글 이름 중간이 아닌 이름/결정력
      // 경계에서 줄바꿈되도록 보장:
      //   - el.style.wordBreak = 'keep-all' : 한글은 한 덩어리로 취급(글자 사이 분리 금지)
      //   - outer span(.nuo-fmt-tb-ann)은 nowrap 미적용, 시작에 일반 공백 → 거기서 끊김 허용
      //   - inner span(.nuo-fmt-tb-ann-num)에만 nowrap → "(5040→7560)" 내부 분리 방지
      try {
        el.style.wordBreak = 'keep-all';
      } catch (eWb) {}
      var span = document.createElement('span');
      span.className = 'nuo-fmt-tb-ann';
      span.setAttribute('data-nuo-tb-ann', '1');
      var inner = document.createElement('span');
      inner.className = 'nuo-fmt-tb-ann-num';
      inner.textContent = suf;
      span.appendChild(document.createTextNode(' '));
      span.appendChild(inner);
      el.appendChild(span);
    }
  }

  /** 물리내구/특수내구 최종값만 `숫자/숫자`, 슬롯 카드 우상단 */
  function applyBulkCorner(cardRoot, bulkCompact) {
    if (!bulkCompact || !String(bulkCompact).trim()) return;
    try {
      var cs = window.getComputedStyle(cardRoot);
      if (cs.position === 'static') {
        cardRoot.style.position = 'relative';
        cardRoot.setAttribute('data-nuo-tb-rel', '1');
      }
    } catch (ePos) {}
    var div = document.createElement('div');
    div.className = 'nuo-fmt-tb-bulk-corner';
    div.setAttribute('data-nuo-tb-ann', '1');
    div.textContent = String(bulkCompact).trim();
    cardRoot.appendChild(div);
  }

  function scheduleTeamBuilderInlineAnnotate() {
    if (!isSmartnuoHost()) return;
    if (!tbInlineAnyEnabled()) return;
    clearTimeout(tbInlineTimer);
    tbInlineTimer = setTimeout(function () {
      runTeamBuilderInlineAnnotate();
    }, 520);
  }

  function tbReconnectMo() {
    try {
      if (tbInlineMo && document.body) {
        tbInlineMo.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } catch (eRe) {}
  }

  function runTeamBuilderInlineAnnotate() {
    if (!isSmartnuoHost()) return;
    if (!tbInlineAnyEnabled()) {
      clearTbInlineAnnotations();
      return;
    }
    if (!isTeamBuilderRoute()) {
      clearTbInlineAnnotations();
      return;
    }
    var mo = tbInlineMo;
    if (mo) {
      try {
        mo.disconnect();
      } catch (eDisc) {}
    }
    var myGen = ++tbInlineGen;
    injectTeamBridgeOnce()
      .then(function () {
        return getSlotsFromBridge();
      })
      .then(function (r) {
        if (myGen !== tbInlineGen) return null;
        if (!isTeamBuilderRoute()) {
          clearTbInlineAnnotations();
          return null;
        }
        if (!r || !r.ok || !r.slots) {
          clearTbInlineAnnotations();
          return null;
        }
        // C-5a/b: 인라인 어노테이션도 슬롯 데이터를 받았으니 hot snapshot + 캐시 mirror.
        // FAB 가 안 떠 있어도(옵션 OFF) 인라인이 켜져 있으면 이쪽이 single source.
        if (typeof TBS.setSlotSnapshot === 'function') {
          TBS.setSlotSnapshot({ slots: r.slots, slotArt: r.slotArt });
        }
        ensureTbInlineStyle();
        var filled = r.filled || [];
        var cardMap = mapSlotsToCardEls(filled);
        // Phase 1: 슬롯별 어노테이션을 비동기로 모두 수집. 기존 어노테이션은 그대로 두어
        // 사용자에게는 stale 한 값이 잠깐 보이지만, "빈 상태"는 아예 노출되지 않음.
        var jobs = [];
        var si;
        for (si = 0; si < 6; si++) {
          if (!filled[si]) continue;
          var sd = r.slots[si];
          var cardEl = cardMap[si];
          if (!cardEl) continue;
          (function (slotData, card) {
            jobs.push(
              requestSlotAnnot(slotData).then(function (ann) {
                if (!ann || ann.empty) return null;
                return { slotData: slotData, card: card, ann: ann };
              })
            );
          })(sd, cardEl);
        }
        return Promise.all(jobs);
      })
      .then(function (results) {
        if (myGen !== tbInlineGen) return;
        if (!results) return;
        // Phase 2: 새 데이터가 모두 도착했으니 한 동기 블록에서 atomic swap —
        // 기존 어노테이션 제거 직후 곧바로 새 어노테이션 부착. 브라우저는 중간 프레임을
        // 그리지 않으므로 사용자 시각에는 깜빡임 없이 값이 바뀐 것처럼 보임.
        clearTbInlineAnnotations();
        results.forEach(function (item) {
          if (!item) return;
          var names = moveDisplayNamesFromSlot(item.slotData);
          var card = item.card;
          if (!card) return;
          if (tbInlineMoveEnabled) {
            applyMovePowerSuffixes(card, names, item.ann.movePowerSuffixes || []);
          }
          if (tbInlineBulkEnabled) {
            applyBulkCorner(card, item.ann.bulkCompact || '');
          }
        });
      })
      .catch(function () {
        if (myGen === tbInlineGen) clearTbInlineAnnotations();
      })
      .then(function () {
        if (myGen !== tbInlineGen) return;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            tbReconnectMo();
          });
        });
      });
  }

  function wireTbInlineObserverHandlers() {
    if (tbInlineHandlersWired) return;
    tbInlineHandlersWired = true;
    var onDom = function () {
      scheduleTeamBuilderInlineAnnotate();
    };
    window.addEventListener('hashchange', onDom);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) scheduleTeamBuilderInlineAnnotate();
    });
    // R3: SPA pushState 라우트 전환 시 어노테이션 즉시 갱신/제거.
    if (CS && CS.onRouteChange) {
      CS.onRouteChange(onDom);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDom);
    } else {
      scheduleTeamBuilderInlineAnnotate();
    }
  }

  function tbEnsureMutationObserver() {
    if (!tbInlineAnyEnabled() || tbInlineMo) return;
    tbInlineMo = new MutationObserver(function () {
      scheduleTeamBuilderInlineAnnotate();
    });
    try {
      tbInlineMo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (eMo) {}
  }

  function initTeamBuilderInlineAnnotate() {
    if (!isSmartnuoHost()) return;
    if (tbInlineAnnotInited) return;
    tbInlineAnnotInited = true;

    wireTbInlineObserverHandlers();

    refreshTbInlineOpt(function () {
      tbEnsureMutationObserver();
      if (tbInlineAnyEnabled()) scheduleTeamBuilderInlineAnnotate();
    });

    // F13: shared 헬퍼로 storage 변경 핸들러 보일러플레이트 통합.
    var TB_INLINE_PREF_KEYS = [LOCAL_TB_INLINE_MOVE, LOCAL_TB_INLINE_BULK, LOCAL_TB_INLINE_LEGACY];
    if (CS && CS.onLocalPrefChange) {
      CS.onLocalPrefChange(TB_INLINE_PREF_KEYS, function () {
        refreshTbInlineOpt(function () {
          if (!tbInlineAnyEnabled()) {
            try { if (tbInlineMo) tbInlineMo.disconnect(); } catch (e0) {}
            tbInlineMo = null;
            clearTbInlineAnnotations();
            return;
          }
          tbEnsureMutationObserver();
          scheduleTeamBuilderInlineAnnotate();
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeamBuilderInlineAnnotate);
  } else {
    initTeamBuilderInlineAnnotate();
  }
})();
