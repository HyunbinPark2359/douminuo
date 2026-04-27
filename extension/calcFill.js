/**
 * smartnuo.com — 브리지는 background INJECT_CALC_BRIDGE 로 MAIN 월드에 주입.
 * 사이트 내 샘플 URL 패널(Shadow DOM) + GET_CALC_PAYLOADS → applyPayloads.
 */
(function () {
  'use strict';

  var SK = {
    calcAtkUrl: 'nuo_fmt_calcAtkUrl',
    calcDefUrl: 'nuo_fmt_calcDefUrl',
    dockAtkPos: 'nuo_fmt_calcDockAtk',
    dockDefPos: 'nuo_fmt_calcDockDef',
  };

  var PANEL_HOST_ID = 'nuo-fmt-calc-panel-host';
  var LOCAL_SHOW_FLOAT = 'nuo_fmt_showCalcFloating';

  var CS = globalThis.nuoCsCommon || {};

  function mapErr(code) {
    return typeof globalThis.mapCalcFillError === 'function'
      ? globalThis.mapCalcFillError(code)
      : String(code || '');
  }

  function injectBridgeFromBackground() {
    return CS.requestBridgeInject('INJECT_CALC_BRIDGE', 'bridge_inject_failed');
  }

  /** 브리지 주입 직후 Vue가 아직 안 붙은 프레임이면 실패할 수 있어 한 틱 양보 (로드 완료 후 클릭 대응). */
  function waitForPageFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(resolve, 90);
        });
      });
    });
  }

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
            },
            '*'
          );
        });
      });
  }

  var isLikelyCalculatorView = CS.isLikelyCalculatorView;

  function getCalcPayloadsFromBackground(atkUrl, defUrl) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        { type: 'GET_CALC_PAYLOADS', atkUrl: atkUrl || '', defUrl: defUrl || '' },
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
   * @param {{ atkUrl?: string, defUrl?: string, onlyAttacker?: boolean, onlyDefender?: boolean }} opts
   */
  function orchestrateCalcFillSide(opts) {
    opts = opts || {};
    var onlyAttacker = !!opts.onlyAttacker;
    var onlyDefender = !!opts.onlyDefender;
    var atkUrl = opts.atkUrl != null ? String(opts.atkUrl) : '';
    var defUrl = opts.defUrl != null ? String(opts.defUrl) : '';
    var a = atkUrl.trim();
    var d = defUrl.trim();

    if (onlyAttacker && !a) {
      return Promise.reject(new Error(mapErr('empty_url')));
    }
    if (onlyDefender && !d) {
      return Promise.reject(new Error(mapErr('empty_url')));
    }
    if (!onlyAttacker && !onlyDefender && !a && !d) {
      return Promise.reject(new Error('공격 또는 수비 URL 중 하나 이상 입력해 주세요.'));
    }

    return getCalcPayloadsFromBackground(atkUrl, defUrl).then(function (pl) {
      var va = pl.attacker && !pl.attacker.error;
      var vd = pl.defender && !pl.defender.error;

      if (onlyAttacker) {
        if (!va) {
          if (a && pl.attacker && pl.attacker.error) {
            throw new Error(mapErr(pl.attacker.error));
          }
          throw new Error(mapErr('no_valid_payload'));
        }
      } else if (onlyDefender) {
        if (!vd) {
          if (d && pl.defender && pl.defender.error) {
            throw new Error(mapErr(pl.defender.error));
          }
          throw new Error(mapErr('no_valid_payload'));
        }
      } else {
        if (!va && !vd) {
          var parts = [];
          if (a && pl.attacker && pl.attacker.error) {
            parts.push('공격측: ' + mapErr(pl.attacker.error));
          }
          if (d && pl.defender && pl.defender.error) {
            parts.push('수비측: ' + mapErr(pl.defender.error));
          }
          throw new Error(parts.length ? parts.join(' ') : mapErr('no_valid_payload'));
        }
      }

      return applyPayloads(pl, {
        requestId: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
        onlyAttacker: onlyAttacker,
        onlyDefender: onlyDefender,
      });
    });
  }

  /* Shadow DOM styles/markup for mountCalcSamplePanel.
   * F7: CSS 는 styles/calcPanel.js 가 globalThis.nuoCalcPanelCss 로 export. */
  function buildCalcShadowStylesAndMarkup(root) {
  root.innerHTML =
    '<style>' + (globalThis.nuoCalcPanelCss || '') + '</style>' +
    '<div class="nuo-wrap">' +
    '  <div class="dock dock-left">' +
    '    <div class="nuo-sway nuo-sway-atk">' +
    '    <div class="morph morph-atk" data-side="atk">' +
    '      <div class="morph-puck">' +
    '        <button type="button" class="morph-orb" aria-expanded="false" aria-label="공격측 샘플 URL">' +
    '          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '            <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />' +
    '            <path d="M13 19l6-6" />' +
    '            <path d="M16 16l4 4" />' +
    '            <path d="M19 21l2-2" />' +
    '          </svg>' +
    '        </button>' +
    '      </div>' +
    '      <div class="morph-body">' +
    '        <div class="morph-head morph-head-atk">' +
    '          <span>공격 샘플 URL</span>' +
    '          <button type="button" class="morph-mini" data-close="atk" aria-label="접기">×</button>' +
    '        </div>' +
    '        <input type="text" class="morph-inp" id="nuo-inp-atk" spellcheck="false" autocomplete="off" placeholder="https://smartnuo.com/#ps=..." />' +
    '        <button type="button" class="morph-apply morph-apply-atk" data-action="atk">' +
    '          <span class="morph-apply-label">입력</span>' +
    '          <span class="morph-apply-spinner" hidden aria-hidden="true"></span>' +
    '        </button>' +
    '        <p class="morph-status" id="nuo-st-atk" role="status" aria-live="polite"></p>' +
    '      </div>' +
    '    </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="dock dock-right">' +
    '    <div class="nuo-sway nuo-sway-def">' +
    '    <div class="morph morph-def" data-side="def">' +
    '      <div class="morph-puck">' +
    '        <button type="button" class="morph-orb" aria-expanded="false" aria-label="수비측 샘플 URL">' +
    '          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />' +
    '          </svg>' +
    '        </button>' +
    '      </div>' +
    '      <div class="morph-body">' +
    '        <div class="morph-head morph-head-def">' +
    '          <span>수비 샘플 URL</span>' +
    '          <button type="button" class="morph-mini" data-close="def" aria-label="접기">×</button>' +
    '        </div>' +
    '        <input type="text" class="morph-inp" id="nuo-inp-def" spellcheck="false" autocomplete="off" placeholder="https://smartnuo.com/#ps=..." />' +
    '        <button type="button" class="morph-apply morph-apply-def" data-action="def">' +
    '          <span class="morph-apply-label">입력</span>' +
    '          <span class="morph-apply-spinner" hidden aria-hidden="true"></span>' +
    '        </button>' +
    '        <p class="morph-status" id="nuo-st-def" role="status" aria-live="polite"></p>' +
    '      </div>' +
    '    </div>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  }

  function mountCalcSamplePanel() {
    if (document.getElementById(PANEL_HOST_ID)) return;

    var host = document.createElement('div');
    host.id = PANEL_HOST_ID;
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });
    buildCalcShadowStylesAndMarkup(root);

    var wrap = root.querySelector('.nuo-wrap');
    var dockLeft = root.querySelector('.dock-left');
    var dockRight = root.querySelector('.dock-right');
    var morphAtk = root.querySelector('.morph-atk');
    var morphDef = root.querySelector('.morph-def');
    var puckAtk = morphAtk.querySelector('.morph-puck');
    var puckDef = morphDef.querySelector('.morph-puck');
    var orbAtk = morphAtk.querySelector('.morph-orb');
    var orbDef = morphDef.querySelector('.morph-orb');
    var inpAtk = root.getElementById('nuo-inp-atk');
    var inpDef = root.getElementById('nuo-inp-def');
    var btnAtk = root.querySelector('[data-action="atk"]');
    var btnDef = root.querySelector('[data-action="def"]');
    var spinAtk = btnAtk.querySelector('.morph-apply-spinner');
    var spinDef = btnDef.querySelector('.morph-apply-spinner');
    var stAtk = root.getElementById('nuo-st-atk');
    var stDef = root.getElementById('nuo-st-def');

    function clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    }

    function dockHalfFromDockEl(dock) {
      var ow = dock.offsetWidth;
      var oh = dock.offsetHeight;
      if (ow < 4) ow = 72;
      if (oh < 4) oh = 72;
      return { hw: ow / 2, hh: oh / 2 };
    }

    function applyDockPosition(dock, pos) {
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
        dock.style.left = '';
        dock.style.right = '';
        dock.style.top = '';
        dock.style.transform = '';
        dock.classList.remove('has-custom-pos');
        return;
      }
      dock.classList.add('has-custom-pos');
      var w = window.innerWidth;
      var h = window.innerHeight;
      var m = 10;
      var half = dockHalfFromDockEl(dock);
      var hw = half.hw;
      var hh = half.hh;
      var cx = pos.x * w;
      var cy = pos.y * h;
      cx = clamp(cx, m + hw, w - m - hw);
      cy = clamp(cy, m + hh, h - m - hh);
      dock.style.left = Math.round(cx - hw) + 'px';
      dock.style.removeProperty('right');
      dock.style.top = Math.round(cy) + 'px';
      dock.style.transform = 'translateY(-50%)';
    }

    function persistDockPos(side, pos) {
      try {
        var o = {};
        o[side === 'atk' ? SK.dockAtkPos : SK.dockDefPos] = pos;
        chrome.storage.session.set(o);
      } catch (e) {}
    }

    function setupDockDrag(morph, dock, side, puck) {
      var suppressClick = false;
      var dragState = null;

      function detachDoc() {
        document.removeEventListener('pointermove', onDocMove, true);
        document.removeEventListener('pointerup', onDocUp, true);
        document.removeEventListener('pointercancel', onDocUp, true);
        dragState = null;
      }

      function onDocMove(ev) {
        if (!dragState || ev.pointerId !== dragState.pid) return;
        var dx = ev.clientX - dragState.lastX;
        var dy = ev.clientY - dragState.lastY;
        dragState.lastX = ev.clientX;
        dragState.lastY = ev.clientY;
        if (!dragState.dragging) {
          var ox = ev.clientX - dragState.startX;
          var oy = ev.clientY - dragState.startY;
          if (ox * ox + oy * oy < 144) return;
          dragState.dragging = true;
        }
        ev.preventDefault();
        var rect = dock.getBoundingClientRect();
        var hw = rect.width / 2;
        var hh = rect.height / 2;
        var cx = rect.left + rect.width / 2 + dx;
        var cy = rect.top + rect.height / 2 + dy;
        var w = window.innerWidth;
        var h = window.innerHeight;
        var m = 10;
        cx = clamp(cx, m + hw, w - m - hw);
        cy = clamp(cy, m + hh, h - m - hh);
        dock.style.left = Math.round(cx - hw) + 'px';
        dock.style.removeProperty('right');
        dock.style.top = Math.round(cy) + 'px';
        dock.style.transform = 'translateY(-50%)';
        dock.classList.add('has-custom-pos');
      }

      function onDocUp(ev) {
        if (!dragState || ev.pointerId !== dragState.pid) return;
        if (dragState.dragging) {
          var r = dock.getBoundingClientRect();
          var cx = r.left + r.width / 2;
          var cy = r.top + r.height / 2;
          persistDockPos(side, { x: cx / window.innerWidth, y: cy / window.innerHeight });
          suppressClick = true;
          setTimeout(function () {
            suppressClick = false;
          }, 150);
        }
        detachDoc();
      }

      function onPuckDown(ev) {
        if (morph.classList.contains('is-open') || ev.button !== 0) return;
        dragState = {
          pid: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          lastX: ev.clientX,
          lastY: ev.clientY,
          dragging: false,
        };
        document.addEventListener('pointermove', onDocMove, true);
        document.addEventListener('pointerup', onDocUp, true);
        document.addEventListener('pointercancel', onDocUp, true);
      }

      puck.addEventListener('pointerdown', onPuckDown);

      return function () {
        return suppressClick;
      };
    }

    var suppressOrbAtk = setupDockDrag(morphAtk, dockLeft, 'atk', puckAtk);
    var suppressOrbDef = setupDockDrag(morphDef, dockRight, 'def', puckDef);

    function setWrapVisible(on) {
      wrap.classList.toggle('nuo-off', !on);
    }

    function setMorphOpen(morph, orb, open) {
      morph.classList.toggle('is-open', !!open);
      var sway = morph.parentElement;
      if (sway && sway.classList.contains('nuo-sway')) {
        sway.classList.toggle('nuo-sway-muted', !!open);
      }
      orb.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeMorph(morph, orb) {
      setMorphOpen(morph, orb, false);
    }

    function closeAllMorphs() {
      closeMorph(morphAtk, orbAtk);
      closeMorph(morphDef, orbDef);
    }

    function openMorph(side) {
      closeAllMorphs();
      if (side === 'atk') {
        setMorphOpen(morphAtk, orbAtk, true);
        setTimeout(function () {
          inpAtk.focus();
        }, 120);
      } else {
        setMorphOpen(morphDef, orbDef, true);
        setTimeout(function () {
          inpDef.focus();
        }, 120);
      }
    }

    orbAtk.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (suppressOrbAtk()) return;
      if (morphAtk.classList.contains('is-open')) return;
      openMorph('atk');
    });
    orbDef.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (suppressOrbDef()) return;
      if (morphDef.classList.contains('is-open')) return;
      openMorph('def');
    });

    root.querySelector('[data-close="atk"]').addEventListener('click', function (e) {
      e.stopPropagation();
      closeMorph(morphAtk, orbAtk);
    });
    root.querySelector('[data-close="def"]').addEventListener('click', function (e) {
      e.stopPropagation();
      closeMorph(morphDef, orbDef);
    });

    morphAtk.addEventListener('click', function (e) {
      if (!morphAtk.classList.contains('is-open')) return;
      e.stopPropagation();
    });
    morphDef.addEventListener('click', function (e) {
      if (!morphDef.classList.contains('is-open')) return;
      e.stopPropagation();
    });

    function onDocPointerDown(ev) {
      var path = ev.composedPath ? ev.composedPath() : [];
      var i;
      for (i = 0; i < path.length; i++) {
        if (path[i] === host) return;
      }
      closeAllMorphs();
    }

    function onKeyDown(ev) {
      if (ev.key === 'Escape') closeAllMorphs();
    }

    document.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);

    var persistTimer = null;
    function schedulePersist() {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(function () {
        try {
          var o = {};
          o[SK.calcAtkUrl] = inpAtk.value;
          o[SK.calcDefUrl] = inpDef.value;
          chrome.storage.session.set(o);
        } catch (e) {}
      }, 200);
    }

    function setStatusAtk(msg, kind) {
      stAtk.textContent = msg || '';
      stAtk.classList.remove('err', 'ok');
      if (kind === 'err') stAtk.classList.add('err');
      else if (kind === 'ok') stAtk.classList.add('ok');
    }
    function setStatusDef(msg, kind) {
      stDef.textContent = msg || '';
      stDef.classList.remove('err', 'ok');
      if (kind === 'err') stDef.classList.add('err');
      else if (kind === 'ok') stDef.classList.add('ok');
    }

    function setAtkLoading(on) {
      btnAtk.disabled = !!on;
      spinAtk.hidden = !on;
      btnAtk.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    function setDefLoading(on) {
      btnDef.disabled = !!on;
      spinDef.hidden = !on;
      btnDef.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    inpAtk.addEventListener('input', schedulePersist);
    inpDef.addEventListener('input', schedulePersist);

    btnAtk.addEventListener('click', function (e) {
      e.stopPropagation();
      setStatusAtk('');
      setAtkLoading(true);
      orchestrateCalcFillSide({
        atkUrl: inpAtk.value,
        defUrl: '',
        onlyAttacker: true,
        onlyDefender: false,
      })
        .then(function (r) {
          var w = r && r.warnings;
          if (Array.isArray(w) && w.length) {
            setStatusAtk('입력을 완료했습니다. 참고: ' + w.join(' '), 'ok');
          } else {
            setStatusAtk('입력을 완료했습니다.', 'ok');
          }
          schedulePersist();
        })
        .catch(function (err) {
          setStatusAtk((err && err.message) || mapErr(''), 'err');
        })
        .then(function () {
          setAtkLoading(false);
        });
    });

    btnDef.addEventListener('click', function (e) {
      e.stopPropagation();
      setStatusDef('');
      setDefLoading(true);
      orchestrateCalcFillSide({
        atkUrl: '',
        defUrl: inpDef.value,
        onlyAttacker: false,
        onlyDefender: true,
      })
        .then(function (r) {
          var w = r && r.warnings;
          if (Array.isArray(w) && w.length) {
            setStatusDef('입력을 완료했습니다. 참고: ' + w.join(' '), 'ok');
          } else {
            setStatusDef('입력을 완료했습니다.', 'ok');
          }
          schedulePersist();
        })
        .catch(function (err) {
          setStatusDef((err && err.message) || mapErr(''), 'err');
        })
        .then(function () {
          setDefLoading(false);
        });
    });

    function syncCalcHeuristic() {
      setWrapVisible(isLikelyCalculatorView());
    }

    function reapplyDockPositions() {
      chrome.storage.session.get([SK.dockAtkPos, SK.dockDefPos], function (got) {
        if (chrome.runtime.lastError) return;
        applyDockPosition(dockLeft, got[SK.dockAtkPos]);
        applyDockPosition(dockRight, got[SK.dockDefPos]);
      });
    }

    window.addEventListener('resize', reapplyDockPositions);

    chrome.storage.session.get(
      [SK.calcAtkUrl, SK.calcDefUrl, SK.dockAtkPos, SK.dockDefPos],
      function (got) {
        if (chrome.runtime.lastError) {
          syncCalcHeuristic();
          return;
        }
        if (got[SK.calcAtkUrl] != null) inpAtk.value = got[SK.calcAtkUrl];
        if (got[SK.calcDefUrl] != null) inpDef.value = got[SK.calcDefUrl];
        applyDockPosition(dockLeft, got[SK.dockAtkPos]);
        applyDockPosition(dockRight, got[SK.dockDefPos]);
        syncCalcHeuristic();
      }
    );

    var heuristicTimer = null;

    var mo = new MutationObserver(function () {
      clearTimeout(heuristicTimer);
      heuristicTimer = setTimeout(syncCalcHeuristic, 400);
    });
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}

    window.addEventListener('hashchange', function () {
      setTimeout(syncCalcHeuristic, 100);
    });
  }

  function tryMountPanel() {
    if (!document.body) return;
    mountCalcSamplePanel();
  }

  function removeCalcPanelHost() {
    var h = document.getElementById(PANEL_HOST_ID);
    if (h) h.remove();
  }

  function startCalcFloatingFromSettings() {
    chrome.storage.local.get([LOCAL_SHOW_FLOAT], function (got) {
      if (chrome.runtime.lastError) {
        tryMountPanel();
        return;
      }
      if (got[LOCAL_SHOW_FLOAT] === false) return;
      tryMountPanel();
    });
  }

  function initFloatingPanelGate() {
    startCalcFloatingFromSettings();
    // F13: shared 헬퍼로 storage 변경 핸들러 보일러플레이트 통합.
    if (CS.onLocalPrefChange) {
      CS.onLocalPrefChange([LOCAL_SHOW_FLOAT], function (got) {
        if (got[LOCAL_SHOW_FLOAT] === false) removeCalcPanelHost();
        else tryMountPanel();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingPanelGate);
  } else {
    initFloatingPanelGate();
  }
})();
