/**
 * smartnuo.com 계산기·스피드 자동 입력 — 좌/우 패널 "내 파티" 줄 (REDESIGN §4.1 A).
 *
 *  - 프로필 헤더 아래 섹션으로 삽입 (calcFillShared.keepInjected). 누른 패널 = 적용 측
 *    (좌 = 공격, 우 = 수비) — 옛 FAB 의 공격/수비 모드 토글은 폐지.
 *  - 칩 1~6 클릭 → SW GET_CALC_PAYLOADS_FROM_SLOT 로 페이로드 변환 → applyPayloads.
 *  - 슬롯 데이터: 콘텐츠 스크립트 isolated world 의 hot snapshot → chrome.storage.local
 *    영속 캐시 순서로 read. **bridge 호출 안 함**(T-1) — 계산기 라우트로 이동하면 팀빌더
 *    Vue store 가 unmount 되었을 가능성이 높아 빈 결과로 hot/캐시 를 덮어쓸 위험 회피.
 *    둘 다 비어 있으면 칩 대신 안내 문구.
 *
 * 브리지(MAIN bridge calcFillBridge.js) 주입은 background.js 의 INJECT_CALC_BRIDGE 로 그대로.
 */
(function () {
  'use strict';

  var CS = globalThis.nuoCsCommon || {};
  var TBS = globalThis.nuoTeamBuilderShared || {};

  // SPEED_FILL Phase 2: 표시 게이트는 'calc' OR 'calc-speed' 합집합 — nuoCsCommon.isCalcOrSpeedRoute().
  // SW/bridge 에 넘기는 page 는 송신 직전 currentPage() 로만 평가(SPA 전환 후 stale 방지).
  var isCalcOrSpeedRoute = CS.isCalcOrSpeedRoute || function () { return false; };
  var isCalcSpeedRoute = CS.isCalcSpeedRoute || function () { return false; };

  /** @returns {'calc'|'speed'} */
  function currentPage() {
    if (isCalcSpeedRoute()) return 'speed';
    return 'calc';
  }

  function mapErr(code) {
    return typeof globalThis.mapCalcFillError === 'function'
      ? globalThis.mapCalcFillError(code)
      : String(code || '');
  }

  function injectBridgeFromBackground() {
    return CS.requestBridgeInject('INJECT_CALC_BRIDGE', 'bridge_inject_failed');
  }

  /** 브리지 주입 직후 Vue가 아직 안 붙은 프레임이면 실패할 수 있어 한 틱 양보. */
  function waitForPageFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(resolve, 90);
        });
      });
    });
  }

  /**
   * 계산기 페이지의 MAIN-world bridge 에 페이로드 전송 → applyAttackerScalars/applyDefenderScalars.
   * onlyAttacker / onlyDefender 옵션은 그대로 — 본 라운드의 슬롯 경로도 한쪽만 적용한다.
   */
  function applyPayloads(payloads, opts) {
    opts = opts || {};
    var requestId = opts.requestId != null ? String(opts.requestId) : String(Date.now());
    var onlyAttacker = !!opts.onlyAttacker;
    var onlyDefender = !!opts.onlyDefender;

    return injectBridgeFromBackground()
      .then(waitForPageFrame)
      .then(function () {
        return new Promise(function (resolve, reject) {
          var settled = false;
          var to = setTimeout(function () {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', onMsg);
            reject(new Error('calc_apply_timeout'));
          }, 45000);

          function onMsg(ev) {
            var d = ev.data;
            if (!d || d.source !== 'nuo-calc-page' || d.type !== 'NUO_CALC_RESULT') return;
            if (String(d.requestId) !== requestId) return;
            if (settled) return;
            settled = true;
            clearTimeout(to);
            window.removeEventListener('message', onMsg);
            if (d.ok) {
              resolve({ ok: true, warnings: d.warnings });
            } else {
              reject(new Error(d.error || 'apply_failed'));
            }
          }
          window.addEventListener('message', onMsg);
          window.postMessage(
            {
              source: 'nuo-calc-ext',
              type: 'NUO_APPLY_CALC_V30',
              requestId: requestId,
              payloads: payloads || {},
              onlyAttacker: onlyAttacker,
              onlyDefender: onlyDefender,
              page: currentPage(),
            },
            '*'
          );
        });
      });
  }

  /** 슬롯 객체 한 개 → 한쪽 페이로드 (SW 메시지). bridge 와 무관. */
  function getCalcPayloadsFromSlot(slot, side) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        {
          type: 'GET_CALC_PAYLOADS_FROM_SLOT',
          slot: slot,
          side: side === 'defender' ? 'defender' : 'attacker',
          page: currentPage(),
        },
        function (bg) {
          if (chrome.runtime.lastError) {
            reject(new Error(mapErr(chrome.runtime.lastError.message)));
            return;
          }
          if (!bg || !bg.ok) {
            reject(new Error(mapErr(bg && bg.error) || '페이로드를 만들지 못했습니다.'));
            return;
          }
          resolve(bg.payloads || {});
        }
      );
    });
  }

  /**
   * 슬롯 직접 입력 — 한 슬롯을 한쪽(공/수) 패널에 적용.
   * @param {object} slot
   * @param {'attacker'|'defender'} side
   */
  function orchestrateCalcFillFromSlot(slot, side) {
    if (!slot || typeof slot !== 'object') {
      return Promise.reject(new Error(mapErr('empty_slot')));
    }
    var role = side === 'defender' ? 'defender' : 'attacker';
    return getCalcPayloadsFromSlot(slot, role).then(function (pl) {
      var v;
      if (role === 'attacker') v = pl.attacker && !pl.attacker.error;
      else v = pl.defender && !pl.defender.error;
      if (!v) {
        var errCode = (role === 'attacker' ? pl.attacker : pl.defender);
        if (errCode && errCode.error) throw new Error(mapErr(errCode.error));
        throw new Error(mapErr('no_valid_payload'));
      }
      return applyPayloads(pl, {
        requestId: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
        onlyAttacker: role === 'attacker',
        onlyDefender: role === 'defender',
      });
    });
  }

  /**
   * 슬롯 데이터 출처 (우선순위, T-1):
   *   1. hot snapshot (같은 탭 isolated world 메모리)
   *   2. chrome.storage 영속 캐시
   *   3. null (호출자가 회색 + 토스트로 처리)
   */
  function getSlotsFromHotOrCache() {
    if (typeof TBS.getHotSnapshot === 'function') {
      var hot = TBS.getHotSnapshot();
      if (hot && Array.isArray(hot.slots) && hot.slots.length > 0) {
        return Promise.resolve(hot);
      }
    }
    if (typeof TBS.getCacheSnapshot === 'function') {
      return TBS.getCacheSnapshot();
    }
    return Promise.resolve(null);
  }

  /* ===== "내 파티" 줄 (REDESIGN §4.1 A) ===== */

  var ROW_CSS = (globalThis.nuoTokensCss || '') + '\n' + (globalThis.nuoCalcPartyRowCss || '');
  var snap = { slots: null, art: [], filled: [], msg: '' };
  var renderers = [];                // 붙어 있는 줄들의 render

  /** 슬롯 객체에 비어 있지 않은 값이 하나라도 있으면 채워진 것 (teamBuilderBridge.slotEmpty 와 동의). */
  function deriveFilled(slots) {
    var i, out = [];
    for (i = 0; i < 6; i++) {
      var s = slots && slots[i];
      if (!s || typeof s !== 'object') { out.push(false); continue; }
      var keys = Object.keys(s).filter(function (k) {
        var v = s[k];
        if (v == null || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
        return true;
      });
      out.push(keys.length > 0);
    }
    return out;
  }

  function renderAll() {
    renderers.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  var snapInflight = false;
  function refreshSnapshot() {
    if (snapInflight) return;
    snapInflight = true;
    getSlotsFromHotOrCache().then(function (s) {
      snapInflight = false;
      if (s && Array.isArray(s.slots) && s.slots.length > 0) {
        snap = { slots: s.slots, art: s.slotArt || [], filled: deriveFilled(s.slots), msg: '' };
      } else {
        snap = { slots: null, art: [], filled: [], msg: '파티 페이지를 한 번 열어 주세요' };
      }
      renderAll();
    }).catch(function () {
      snapInflight = false;
      snap = { slots: null, art: [], filled: [], msg: '팀 정보를 불러오지 못했습니다.' };
      renderAll();
    });
  }

  /** 좌(idx 0) / 우(idx 1) 패널 프로필 헤더(`시즌…` 줄을 품은 border-bottom 박스) 다음 형제 자리. */
  function findProfileHeaderSlot(idx) {
    var leaves = CS.findTextLeaves(/^시즌/);
    var el = leaves[idx];
    while (el && el !== document.body) {
      var cs = getComputedStyle(el);
      if (cs.borderBottomStyle !== 'none' && parseFloat(cs.borderBottomWidth) > 0 && el.offsetHeight >= 40) {
        return { parent: el.parentElement, before: el.nextElementSibling };
      }
      el = el.parentElement;
    }
    return null;
  }

  function buildPartyRow(root, side) {
    var chipsHtml = '';
    var i;
    for (i = 1; i <= 6; i++) {
      chipsHtml += '<button type="button" class="chip" aria-label="#' + i + ' 슬롯">' +
        '<img alt="" decoding="async" /><span class="num">' + i + '</span></button>';
    }
    root.innerHTML = '<style>' + ROW_CSS + '</style>' +
      '<div class="sec"><div class="row"><p class="ttl">내 파티</p>' +
      '<div class="chips">' + chipsHtml + '<span class="empty" hidden></span></div></div>' +
      '<p class="msg" role="status" aria-live="polite"></p></div>';

    var chips = [].slice.call(root.querySelectorAll('.chip'));
    var emptyEl = root.querySelector('.empty');
    var msgEl = root.querySelector('.msg');
    var msgTimer = null;

    function setMsg(text, kind, holdMs) {
      clearTimeout(msgTimer);
      msgEl.textContent = text || '';
      msgEl.classList.toggle('err', kind === 'err');
      if (text && holdMs) msgTimer = setTimeout(function () { setMsg(''); }, holdMs);
    }

    function render() {
      var has = !!snap.slots;
      emptyEl.hidden = has;
      emptyEl.textContent = has ? '' : snap.msg;
      chips.forEach(function (c, k) {
        c.hidden = !has;
        var on = has && snap.filled[k] === true;
        c.disabled = !on;
        var img = c.querySelector('img');
        var art = on && snap.art[k] ? String(snap.art[k]) : '';
        if (art) {
          if (img.getAttribute('src') !== art) img.setAttribute('src', art);
        } else {
          img.removeAttribute('src');
        }
        c.classList.toggle('has-art', !!art);
      });
    }

    chips.forEach(function (c, k) {
      c.querySelector('img').addEventListener('error', function () {
        this.removeAttribute('src');
        c.classList.remove('has-art');
      });
      c.addEventListener('click', function () {
        if (c.disabled || c.classList.contains('busy')) return;
        var slot = snap.slots && snap.slots[k];
        if (!slot) { setMsg('슬롯을 읽지 못했습니다.', 'err', 2500); return; }
        c.classList.remove('done', 'err');
        c.classList.add('busy');
        setMsg('');
        orchestrateCalcFillFromSlot(slot, side).then(function () {
          c.classList.remove('busy');
          c.classList.add('done');
          setTimeout(function () { c.classList.remove('done'); }, 1200);
        }).catch(function (err) {
          c.classList.remove('busy');
          c.classList.add('err');
          setTimeout(function () { c.classList.remove('err'); }, 1200);
          setMsg((err && err.message) || mapErr(''), 'err', 2500);
        });
      });
    });

    renderers.push(render);
    render();
    return function teardown() {
      clearTimeout(msgTimer);
      var ix = renderers.indexOf(render);
      if (ix >= 0) renderers.splice(ix, 1);
    };
  }

  function rowSpec(side, idx) {
    return {
      key: 'calc-party-' + side,
      enabled: isCalcOrSpeedRoute,
      find: function () { return findProfileHeaderSlot(idx); },
      build: function (root) {
        refreshSnapshot();
        return buildPartyRow(root, side);
      }
    };
  }

  function init() {
    if (typeof CS.keepInjected !== 'function') return;
    CS.keepInjected(rowSpec('attacker', 0));
    CS.keepInjected(rowSpec('defender', 1));
    if (CS.onLocalPrefChange) {
      CS.onLocalPrefChange(['nuo_fmt_teamSlotsCache'], function () {
        if (renderers.length) refreshSnapshot();
      });
    }
    if (CS.onRouteChange) {
      CS.onRouteChange(function () { if (isCalcOrSpeedRoute()) refreshSnapshot(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
