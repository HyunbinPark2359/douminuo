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

  function mapErr(code) {
    return typeof globalThis.mapCalcFillError === 'function'
      ? globalThis.mapCalcFillError(code)
      : String(code || '');
  }

  function injectBridgeFromBackground() {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: 'INJECT_CALC_BRIDGE' }, function (r) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'runtime'));
          return;
        }
        if (!r || !r.ok) {
          reject(new Error((r && r.error) || 'bridge_inject_failed'));
          return;
        }
        resolve();
      });
    });
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

  /** calcFillBridge.js 의 isCalculatorContext 와 동일 휴리스틱. */
  function isLikelyCalculatorView() {
    var t = document.body && document.body.innerText;
    if (!t) return false;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
  }

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

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'NUO_CALC_FILL') return;
    applyPayloads(msg.payloads, {
      requestId: msg.requestId,
      onlyAttacker: msg.onlyAttacker,
      onlyDefender: msg.onlyDefender,
    })
      .then(function (r) {
        sendResponse(r);
      })
      .catch(function (e) {
        sendResponse({ ok: false, error: mapErr((e && e.message) || e) });
      });
    return true;
  });

  function mountCalcSamplePanel() {
    if (document.getElementById(PANEL_HOST_ID)) return;

    var host = document.createElement('div');
    host.id = PANEL_HOST_ID;
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host { all: initial; }' +
      '* { box-sizing: border-box; font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }' +
      '@keyframes nuo-drift-atk {' +
      '  0%, 100% { transform: translate(0, 0) rotate(0deg); }' +
      '  18% { transform: translate(3px, -4px) rotate(1.1deg); }' +
      '  35% { transform: translate(-4px, 2px) rotate(-0.85deg); }' +
      '  52% { transform: translate(4px, 4px) rotate(0.75deg); }' +
      '  70% { transform: translate(-3px, -3px) rotate(-0.65deg); }' +
      '  88% { transform: translate(2px, 3px) rotate(0.4deg); }' +
      '}' +
      '@keyframes nuo-drift-def {' +
      '  0%, 100% { transform: translate(0, 0) rotate(0deg); }' +
      '  22% { transform: translate(-3px, -3px) rotate(-0.95deg); }' +
      '  40% { transform: translate(4px, 2px) rotate(1deg); }' +
      '  58% { transform: translate(-2px, 4px) rotate(-0.55deg); }' +
      '  75% { transform: translate(3px, -2px) rotate(0.7deg); }' +
      '  92% { transform: translate(-4px, 1px) rotate(-0.35deg); }' +
      '}' +
      '@keyframes nuo-glow-atk {' +
      '  0%, 100% { box-shadow: 0 6px 22px rgba(180, 83, 9, 0.35), 0 0 0 1px rgba(251, 191, 36, 0.45); }' +
      '  50% { box-shadow: 0 10px 28px rgba(217, 119, 6, 0.48), 0 0 0 1px rgba(252, 211, 77, 0.55); }' +
      '}' +
      '@keyframes nuo-glow-def {' +
      '  0%, 100% { box-shadow: 0 6px 22px rgba(4, 120, 87, 0.32), 0 0 0 1px rgba(52, 211, 153, 0.4); }' +
      '  50% { box-shadow: 0 10px 28px rgba(5, 150, 105, 0.45), 0 0 0 1px rgba(110, 231, 183, 0.5); }' +
      '}' +
      '@keyframes nuo-spin { to { transform: rotate(360deg); } }' +
      '.nuo-wrap {' +
      '  --nuo-z: 2147483646;' +
      '  --calc-atk: #b45309;' +
      '  --calc-def: #047857;' +
      '}' +
      '.nuo-wrap.nuo-off {' +
      '  visibility: hidden; pointer-events: none; opacity: 0;' +
      '  transition: opacity 0.25s ease;' +
      '}' +
      '.dock {' +
      '  position: fixed; top: 50%; transform: translateY(-50%); z-index: var(--nuo-z);' +
      '}' +
      '.dock-left:not(.has-custom-pos) { left: clamp(28px, 8vw, 200px); }' +
      '.dock-right:not(.has-custom-pos) { right: clamp(28px, 8vw, 200px); }' +
      '.nuo-sway {' +
      '  display: block;' +
      '  overflow: visible;' +
      '  border-radius: 50%;' +
      '  transition: border-radius 0.36s cubic-bezier(0.34, 1.1, 0.45, 1);' +
      '}' +
      '.nuo-sway-atk:not(.nuo-sway-muted) {' +
      '  animation: nuo-drift-atk 7.8s ease-in-out infinite;' +
      '}' +
      '.nuo-sway-def:not(.nuo-sway-muted) {' +
      '  animation: nuo-drift-def 8.6s ease-in-out -1.1s infinite;' +
      '}' +
      '.dock-left .morph:not(.is-open) .morph-puck {' +
      '  animation: nuo-glow-atk 3.2s ease-in-out infinite;' +
      '}' +
      '.dock-right .morph:not(.is-open) .morph-puck {' +
      '  animation: nuo-glow-def 3.4s ease-in-out -0.6s infinite;' +
      '}' +
      '.nuo-sway-muted {' +
      '  animation: none !important;' +
      '  border-radius: 14px;' +
      '}' +
      '.morph {' +
      '  position: relative;' +
      '  width: 72px;' +
      '  min-height: 72px;' +
      '  border-radius: 50%;' +
      '  overflow: visible;' +
      '  cursor: pointer;' +
      '  transition: transform 0.22s ease, width 0.42s cubic-bezier(0.34, 1.18, 0.45, 1),' +
      '    min-height 0.42s cubic-bezier(0.34, 1.18, 0.45, 1), border-radius 0.38s cubic-bezier(0.34, 1.1, 0.45, 1),' +
      '    box-shadow 0.35s ease, margin-left 0.42s cubic-bezier(0.34, 1.18, 0.45, 1);' +
      '}' +
      '.morph.is-open { overflow: hidden; }' +
      '.morph:not(.is-open):hover { transform: scale(1.1); }' +
      '.morph-puck {' +
      '  position: absolute; inset: 0; border-radius: 50%;' +
      '  pointer-events: auto; touch-action: none;' +
      '}' +
      '.morph.is-open .morph-puck {' +
      '  animation: none !important;' +
      '  opacity: 0; pointer-events: none;' +
      '  transform: scale(0.45); transition: opacity 0.2s ease, transform 0.25s ease;' +
      '}' +
      '.morph.is-open {' +
      '  transform: none !important;' +
      '  width: min(92vw, 302px);' +
      '  min-height: 156px;' +
      '  border-radius: 14px;' +
      '  cursor: default;' +
      '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.35);' +
      '}' +
      '.morph-atk .morph-puck {' +
      '  background: linear-gradient(155deg, #fffbeb 0%, #fde68a 42%, #fbbf24 100%);' +
      '}' +
      '.morph-atk.is-open { background: linear-gradient(180deg, #fffdf7 0%, #ffffff 40%, #fffbeb 100%); }' +
      '.morph-def .morph-puck {' +
      '  background: linear-gradient(155deg, #ecfdf5 0%, #6ee7b7 42%, #34d399 100%);' +
      '}' +
      '.morph-def.is-open { background: linear-gradient(180deg, #f8fffc 0%, #ffffff 40%, #ecfdf5 100%); }' +
      '.dock-right .morph.is-open {' +
      '  margin-left: calc(72px - min(92vw, 302px));' +
      '}' +
      '.morph-orb {' +
      '  position: absolute; inset: 0; margin: 0; padding: 0; border: none; background: transparent;' +
      '  cursor: pointer; display: flex; align-items: center; justify-content: center;' +
      '  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34, 1.2, 0.45, 1);' +
      '}' +
      '.morph-orb:focus-visible { outline: 2px solid #0f172a; outline-offset: 3px; }' +
      '.morph.is-open .morph-orb {' +
      '  opacity: 0; pointer-events: none; transform: scale(0.4);' +
      '}' +
      '.ico {' +
      '  width: 32px; height: 32px; color: var(--calc-atk);' +
      '}' +
      '.morph-def .ico { color: var(--calc-def); }' +
      '.morph-body {' +
      '  opacity: 0; pointer-events: none;' +
      '  padding: 0 11px 11px;' +
      '  transition: opacity 0.26s ease 0.07s;' +
      '}' +
      '.morph.is-open .morph-body {' +
      '  opacity: 1; pointer-events: auto;' +
      '}' +
      '.morph:not(.is-open) .morph-body { position: absolute; width: 0; height: 0; overflow: hidden; padding: 0; }' +
      '.morph-head {' +
      '  display: flex; align-items: center; justify-content: space-between; gap: 8px;' +
      '  padding: 10px 2px 6px 2px;' +
      '}' +
      '.morph-head span {' +
      '  font-size: 12px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;' +
      '}' +
      '.morph-head-atk span { color: var(--calc-atk); }' +
      '.morph-head-def span { color: var(--calc-def); }' +
      '.morph-mini {' +
      '  flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; border: 1px solid #cbd5e1;' +
      '  background: #f1f5f9; color: #475569; font-size: 18px; line-height: 1; cursor: pointer;' +
      '  display: flex; align-items: center; justify-content: center; padding: 0;' +
      '}' +
      '.morph-mini:hover { background: #e2e8f0; }' +
      '.morph-inp {' +
      '  width: 100%; padding: 8px 10px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 8px;' +
      '  background: #fff; color: #0f172a;' +
      '}' +
      '.morph-inp:focus { outline: none; border-color: #64748b; box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.2); }' +
      '.morph-atk .morph-inp:focus { border-color: #d97706; box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.22); }' +
      '.morph-def .morph-inp:focus { border-color: #059669; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.22); }' +
      '.morph-apply {' +
      '  margin-top: 8px; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 10px;' +
      '  padding: 8px 12px; font-size: 12px; font-weight: 600; border: none; border-radius: 8px;' +
      '  cursor: pointer; color: #fff;' +
      '  transition: opacity 0.2s ease, filter 0.2s ease, background-color 0.15s ease;' +
      '}' +
      '.morph-apply-atk { background: #ca8a04; }' +
      '.morph-apply-atk:hover:not(:disabled) { background: #eab308; }' +
      '.morph-apply-atk:disabled {' +
      '  opacity: 0.72; filter: saturate(0.55) brightness(0.9); cursor: not-allowed; box-shadow: none;' +
      '}' +
      '.morph-apply-atk:disabled:hover { background: #ca8a04; }' +
      '.morph-apply-def { background: #047857; }' +
      '.morph-apply-def:hover:not(:disabled) { background: #059669; }' +
      '.morph-apply-def:disabled {' +
      '  opacity: 0.72; filter: saturate(0.55) brightness(0.9); cursor: not-allowed; box-shadow: none;' +
      '}' +
      '.morph-apply-def:disabled:hover { background: #047857; }' +
      '.morph-apply-spinner {' +
      '  width: 14px; height: 14px; flex-shrink: 0; border-radius: 50%;' +
      '  border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: rgba(255, 255, 255, 0.95);' +
      '  animation: nuo-spin 0.7s linear infinite;' +
      '}' +
      '.morph-apply-spinner[hidden] { display: none !important; }' +
      '.morph-status {' +
      '  margin: 7px 0 0; min-height: 1.15em; font-size: 11px; line-height: 1.35; color: #64748b;' +
      '}' +
      '.morph-status.err { color: #b91c1c; }' +
      '.morph-status.ok { color: #15803d; }' +
      '</style>' +
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
    function refreshHeuristic() {
      syncCalcHeuristic();
    }

    var mo = new MutationObserver(function () {
      clearTimeout(heuristicTimer);
      heuristicTimer = setTimeout(refreshHeuristic, 400);
    });
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}

    window.addEventListener('hashchange', function () {
      setTimeout(refreshHeuristic, 100);
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
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, LOCAL_SHOW_FLOAT)) {
          return;
        }
        if (changes[LOCAL_SHOW_FLOAT].newValue === false) {
          removeCalcPanelHost();
        } else {
          tryMountPanel();
        }
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingPanelGate);
  } else {
    initFloatingPanelGate();
  }
})();
