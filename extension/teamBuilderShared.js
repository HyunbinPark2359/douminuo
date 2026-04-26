/**
 * 팀빌더 콘텐츠 스크립트(FAB / 인라인 어노테이션) 공용 유틸 — F6.
 *
 * teamBuilderFill.js (FAB) 와 teamBuilderInlineAnnot.js (인라인) 두 파일이 모두
 * MAIN-world bridge(teamBuilderBridge.js) 와 통신하므로, 그 통신 코드를 한 곳에 두고
 * 두 소비자가 globalThis.nuoTeamBuilderShared 로 import.
 *
 * manifest 에서 두 소비자보다 먼저 로드되어야 함.
 */
(function (g) {
  'use strict';

  var MSG_EXT = 'nuo-team-ext';
  var MSG_BRIDGE = 'nuo-team-bridge';

  var CS = g.nuoCsCommon || {};

  function isSmartnuoHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'smartnuo.com' || h === 'www.smartnuo.com';
  }

  function injectTeamBridge() {
    return CS.requestBridgeInject('INJECT_TEAM_BUILDER_BRIDGE', 'team_bridge_inject_failed');
  }

  /**
   * F12: 매 호출마다 SW 메시지 + chrome.scripting.executeScript 왕복을 피한다.
   * 페이지 측은 __NUO_TEAM_BUILDER_BRIDGE_V3__ 가드로 어차피 noop이지만 메시지 비용이 남음.
   * 첫 ok 이후엔 같은 promise 재사용. 실패 시 캐시 초기화 → 다음 호출이 재시도.
   */
  var teamBridgeReadyP = null;
  function injectTeamBridgeOnce() {
    if (teamBridgeReadyP) return teamBridgeReadyP;
    teamBridgeReadyP = injectTeamBridge();
    teamBridgeReadyP.catch(function () {
      teamBridgeReadyP = null;
    });
    return teamBridgeReadyP;
  }

  /**
   * MAIN bridge 의 NUO_TEAM_GET_SLOTS / NUO_TEAM_SLOTS_REPLY postMessage RPC.
   * 결과: { ok, slots, filled, slotArt, error }. 8초 timeout.
   */
  function getSlotsFromBridge() {
    return new Promise(function (resolve) {
      var rid = String(Date.now()) + '-' + Math.random().toString(16).slice(2);

      function onMsg(ev) {
        var d = ev.data;
        if (!d || d.source !== MSG_BRIDGE || d.type !== 'NUO_TEAM_SLOTS_REPLY') return;
        if (String(d.requestId) !== rid) return;
        window.removeEventListener('message', onMsg);
        resolve({
          ok: !!d.ok,
          slots: d.slots,
          filled: d.filled,
          slotArt: d.slotArt,
          error: d.error,
        });
      }

      window.addEventListener('message', onMsg);
      window.postMessage(
        {
          source: MSG_EXT,
          type: 'NUO_TEAM_GET_SLOTS',
          requestId: rid,
        },
        '*'
      );

      setTimeout(function () {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, slots: null, filled: null, error: 'team_slots_timeout' });
      }, 8000);
    });
  }

  g.nuoTeamBuilderShared = {
    isSmartnuoHost: isSmartnuoHost,
    injectTeamBridge: injectTeamBridge,
    injectTeamBridgeOnce: injectTeamBridgeOnce,
    getSlotsFromBridge: getSlotsFromBridge,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
