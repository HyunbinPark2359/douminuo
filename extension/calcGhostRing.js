/**
 * Ghost ring — 계산기 페이지의 attacker / defender 패널 카드 주변에 가벼운 ring 을 그려
 * “지금 적용 대상이 어느 쪽인가”를 시각화한다.
 *
 * 발화 조건 (사용자 결정 — 2026-04-27):
 *   FAB dock 펼쳐져 있는 동안 (`.fab-dock--open`) 항상 ON. 접히면 OFF.
 *   토글 모드 (atk / def) 에 따라 한쪽만 표시 — 다른 쪽은 즉시 hide.
 *
 * 격리 (CALC_PARTY_FILL_PLAN.md §4 Ghost-ring 격리 가이드):
 *   - 본 모듈 단일 파일. calcFill.js 는 한 줄(`globalThis.nuoGhostRing.attach(...)`) 만 호출.
 *   - 자체 <style> 1회 주입. styles/calcPanel.js 등 공용 CSS 에 흘리지 않음.
 *   - 사용자 환경설정 `nuo_fmt_calcGhostRingEnabled`(기본 true)는 calcFill.js 가 읽어
 *     attach 옵션으로 전달한다. 본 파일은 storage 를 직접 조회하지 않음.
 *   - 본 모듈을 빼고 싶으면 (1) manifest 의 calcGhostRing.js 줄 삭제 (2) 본 파일 삭제
 *     (3) calcFill.js 의 호출 한 줄 삭제 — 그 이상 손댈 곳 없음.
 *
 * 주의: 사이트(스마트누오) 의 패널 DOM 구조에 의존하는 휴리스틱(`공격`/`수비` 헤딩 텍스트
 *   기반 매칭 + 카드-like 조상 찾기) 을 쓴다. 사이트가 라벨 텍스트를 바꾸면 ring 이 사라질
 *   뿐 다른 회귀를 만들지 않게 설계 — 못 찾으면 그냥 표시 안 함.
 */
(function (g) {
  'use strict';

  var STYLE_ID = 'nuo-cf-ghost-ring-style';
  var ATK_RING_ID = 'nuo-cf-ghost-ring-atk';
  var DEF_RING_ID = 'nuo-cf-ghost-ring-def';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.nuo-cf-ghost-ring {',
      '  position: fixed; pointer-events: none; z-index: 2147483640;',
      '  border-radius: 16px;',
      '  border: 2px solid;',
      /* box-sizing: border-box — border 를 width/height 안으로 → 좌표 계산이 패널 rect 와 정확히 일치. */
      '  box-sizing: border-box;',
      '  opacity: 0;',
      /* geometry 는 인라인으로 즉시 반영; is-show 로만 opacity 페이드 (~0.32s). */
      '  transition: opacity 0.18s ease;',
      '}',
      '.nuo-cf-ghost-ring.is-atk {',
      '  border-color: rgba(245, 158, 11, 0.68);',
      '  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.14), 0 10px 26px rgba(245, 158, 11, 0.16);',
      '}',
      '.nuo-cf-ghost-ring.is-def {',
      '  border-color: rgba(16, 185, 129, 0.68);',
      '  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.14), 0 10px 26px rgba(16, 185, 129, 0.16);',
      '}',
      '.nuo-cf-ghost-ring.is-show { opacity: 1; }',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /**
   * 패널 찾기 — 두 단 layered (사이트 변경 robust 화):
   *
   *   1순위: 사용자가 inspect 해서 알려준 layout selector (2026-04-27 캡처).
   *          컨테이너 = `div.d-flex.justify-space-between.mt-5.pb-10` (mx-auto.align-center 등은
   *          redundant 라 selector 에서 뺌 — 클래스 하나 빠져도 잡히도록). 자식 3개 중
   *          nth-child(1) = 공격, nth-child(3) = 수비, 가운데 nth-child(2) 는 swap UI.
   *
   *   2순위 (fallback): 헤딩 텍스트 휴리스틱. 1순위 selector 가 깨지면 (사이트가 layout
   *          유틸 클래스 셋을 바꾸면) 헤딩 검색으로 재시도. 헤딩 후보를 더 넓게 — 흔한
   *          사이트 패턴들도 추가.
   */
  function findCalcPanels() {
    // 1순위 — layout selector
    var c = document.querySelector('div.d-flex.justify-space-between.mt-5.pb-10');
    if (c && c.children && c.children.length >= 3) {
      var atk0 = c.children[0];
      var def0 = c.children[2];
      if (atk0 && def0 && atk0.nodeType === 1 && def0.nodeType === 1) {
        var ra = atk0.getBoundingClientRect();
        var rd = def0.getBoundingClientRect();
        if (ra.width > 50 && ra.height > 50 && rd.width > 50 && rd.height > 50) {
          return { atk: atk0, def: def0 };
        }
      }
    }
    // 2순위 — 헤딩 텍스트 휴리스틱 fallback
    return { atk: findPanelByHeading('공격'), def: findPanelByHeading('수비') };
  }

  function isPanelLikeClass(node) {
    if (!node || node.nodeType !== 1) return false;
    var cls = node.className;
    if (!cls || typeof cls !== 'string') return false;
    return /v-card|panel|card|wrap|d-flex/i.test(cls);
  }

  function findPanelByHeading(label) {
    var sel = 'h1, h2, h3, h4, h5, h6, .v-card-title, .v-toolbar__title, .v-list-item__title, [class*="title"], [class*="header"], [class*="label"]';
    var headings = document.querySelectorAll(sel);
    var best = null;
    var bestArea = 0;
    var i;
    for (i = 0; i < headings.length; i++) {
      var h = headings[i];
      var t = (h.textContent || '').trim();
      if (!t || t.length > 30) continue;
      if (t.indexOf(label) < 0) continue;
      var anc = h.parentElement;
      var depth = 0;
      while (anc && anc !== document.body && depth < 10) {
        if (isPanelLikeClass(anc)) {
          var r = anc.getBoundingClientRect();
          if (r.width > 100 && r.height > 80) {
            var area = r.width * r.height;
            if (area > bestArea) {
              best = anc;
              bestArea = area;
            }
            break;
          }
        }
        anc = anc.parentElement;
        depth++;
      }
    }
    return best;
  }

  function makeRing(side) {
    var r = document.createElement('div');
    r.className = 'nuo-cf-ghost-ring is-' + (side === 'attacker' ? 'atk' : 'def');
    r.id = side === 'attacker' ? ATK_RING_ID : DEF_RING_ID;
    document.body.appendChild(r);
    return r;
  }

  function positionRing(ring, el, padding) {
    if (!ring || !el) return;
    var r = el.getBoundingClientRect();
    var p = padding != null ? padding : 2;
    ring.style.top = Math.round(r.top - p) + 'px';
    ring.style.left = Math.round(r.left - p) + 'px';
    ring.style.width = Math.round(r.width + p * 2) + 'px';
    ring.style.height = Math.round(r.height + p * 2) + 'px';
  }

  /**
   * @param {HTMLElement} fabRootEl  계산기 FAB 의 .fab-root (Shadow DOM 안의 노드).
   * @param {() => 'attacker'|'defender'} sideGetter 현재 토글 mode 반환.
   * @param {{ getGhostRingEnabled?: () => boolean }} [options]
   * @returns {{refresh: () => void} | null}
   */
  function attach(fabRootEl, sideGetter, options) {
    if (!fabRootEl || typeof sideGetter !== 'function') return null;

    options = options || {};
    var getEnabled =
      typeof options.getGhostRingEnabled === 'function'
        ? options.getGhostRingEnabled
        : function () {
            return true;
          };

    ensureStyle();

    var atkRing = makeRing('attacker');
    var defRing = makeRing('defender');

    var dockEl = fabRootEl.querySelector ? fabRootEl.querySelector('.fab-dock') : null;

    function isDockOpen() {
      return !!(dockEl && dockEl.classList && dockEl.classList.contains('fab-dock--open'));
    }

    var rafPending = false;

    function refresh() {
      if (!getEnabled()) {
        atkRing.classList.remove('is-show');
        defRing.classList.remove('is-show');
        return;
      }
      if (!isDockOpen()) {
        atkRing.classList.remove('is-show');
        defRing.classList.remove('is-show');
        return;
      }
      var side = sideGetter();
      var pair = findCalcPanels();
      if (pair.atk) positionRing(atkRing, pair.atk);
      if (pair.def) positionRing(defRing, pair.def);
      if (side === 'attacker') {
        if (pair.atk) atkRing.classList.add('is-show');
        else atkRing.classList.remove('is-show');
        defRing.classList.remove('is-show');
      } else {
        if (pair.def) defRing.classList.add('is-show');
        else defRing.classList.remove('is-show');
        atkRing.classList.remove('is-show');
      }
    }

    function scheduleRefresh() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        refresh();
      });
    }

    // dock 의 .fab-dock--open 클래스 변화, fabRoot 의 mode 클래스 변화 모두 관찰.
    try {
      if (dockEl) {
        var moDock = new MutationObserver(scheduleRefresh);
        moDock.observe(dockEl, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (e0) {}
    try {
      var moRoot = new MutationObserver(scheduleRefresh);
      moRoot.observe(fabRootEl, { attributes: true, attributeFilter: ['class'] });
    } catch (e1) {}

    // 사이트 페이지 스크롤·리사이즈에 ring 좌표 따라가기 (capture 단계로 일찍 잡음).
    window.addEventListener('resize', scheduleRefresh, true);
    window.addEventListener('scroll', scheduleRefresh, true);

    refresh();

    return { refresh: refresh };
  }

  g.nuoGhostRing = { attach: attach };
})(typeof globalThis !== 'undefined' ? globalThis : self);
