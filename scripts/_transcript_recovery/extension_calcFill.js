/**
 * smartnuo.com — 브리지는 background INJECT_CALC_BRIDGE 로 MAIN 월드에 주입.
 */
(function () {
  'use strict';

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

  function applyPayloads(payloads, opts) {
    opts = opts || {};
    var requestId = opts.requestId != null ? String(opts.requestId) : String(Date.now());
    var onlyAttacker = !!opts.onlyAttacker;
    var onlyDefender = !!opts.onlyDefender;

    return injectBridgeFromBackground().then(function () {
      return new Promise(function (resolve, reject) {
        function onMsg(ev) {
          var d = ev.data;
          if (!d || d.source !== 'nuo-calc-page' || d.type !== 'NUO_CALC_RESULT') return;
          if (String(d.requestId) !== requestId) return;
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
        setTimeout(function () {
          window.removeEventListener('message', onMsg);
          reject(new Error('calc_apply_timeout'));
        }, 45000);
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
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      });
    return true;
  });
})();
