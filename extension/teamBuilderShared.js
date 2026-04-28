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

  /**
   * 슬롯 스냅샷 — 계산기 자동입력의 “팀 슬롯 원클릭” 흐름을 위한 두 층 mirror.
   *
   * - Hot snapshot (C-5a): 콘텐츠 스크립트 isolated world 의 `_hot` 변수.
   *   같은 탭에서 SPA 라우트가 바뀌어도 살아남음. 풀 리로드 / 탭 종료 시 소멸.
   * - 영속 캐시 (C-5b): `chrome.storage.local.<SLOT_CACHE_KEY>`.
   *   부팅 후 계산기 페이지 직접 접속 시에도 슬롯 버튼이 보이도록.
   *
   * 동시 갱신 — `setSlotSnapshot` 한 호출이 두 곳을 같이 갱신한다.
   * 팀빌더 측 콘텐츠 스크립트(teamBuilderFill / teamBuilderInlineAnnot)가
   * `getSlotsFromBridge` 의 ok 응답 받을 때마다 호출.
   *
   * 계산기 측은 `getHotSnapshot` → `getCacheSnapshot` 순서로 read. bridge 호출 없음(T-1).
   */
  var SLOT_CACHE_KEY = 'nuo_fmt_teamSlotsCache';
  var SLOT_CACHE_SCHEMA = 1;

  /** SPA 라우트 전환에 살아남는 isolated-world 변수. 풀 리로드 시 자연 소멸. */
  var _hot = null;

  /**
   * Hot snapshot + 영속 캐시 동시 갱신.
   * @param {{ slots: object[], slotArt?: string[] }} payload
   *   slots: 길이 1~6 의 flat slot 배열 (빈 슬롯은 {} 또는 비슷한 모양 OK).
   *   slotArt: 같은 길이의 스프라이트 URL 배열 (없으면 빈 배열).
   */
  function setSlotSnapshot(payload) {
    if (!payload || typeof payload !== 'object') return;
    var slots = Array.isArray(payload.slots) ? payload.slots.slice(0, 6) : null;
    if (!slots || slots.length === 0) return;
    var slotArt = Array.isArray(payload.slotArt) ? payload.slotArt.slice(0, 6) : [];
    var snap = {
      slots: slots,
      slotArt: slotArt,
      savedAt: Date.now(),
      schema: SLOT_CACHE_SCHEMA,
    };
    _hot = snap;
    // 영속 캐시 — 실패는 조용히 (TEMPLATES §0 “조용한 실패”).
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var obj = {};
        obj[SLOT_CACHE_KEY] = snap;
        chrome.storage.local.set(obj, function () {
          // chrome.runtime.lastError 무시
        });
      }
    } catch (e) {}
  }

  /** 동기 — hot only. 콘텐츠 스크립트 isolated world 의 _hot 을 그대로 반환. */
  function getHotSnapshot() {
    return _hot;
  }

  /**
   * Promise — chrome.storage.local 비동기 GET.
   * 결과: 유효 스냅샷 또는 null (스토리지 실패 / 스키마 미스매치 / 빈 배열).
   */
  function getCacheSnapshot() {
    return new Promise(function (resolve) {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve(null);
          return;
        }
        chrome.storage.local.get([SLOT_CACHE_KEY], function (got) {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          var c = got && got[SLOT_CACHE_KEY];
          if (!c || c.schema !== SLOT_CACHE_SCHEMA) {
            resolve(null);
            return;
          }
          if (!Array.isArray(c.slots) || c.slots.length === 0) {
            resolve(null);
            return;
          }
          resolve(c);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  g.nuoTeamBuilderShared = {
    isSmartnuoHost: isSmartnuoHost,
    injectTeamBridge: injectTeamBridge,
    injectTeamBridgeOnce: injectTeamBridgeOnce,
    getSlotsFromBridge: getSlotsFromBridge,
    setSlotSnapshot: setSlotSnapshot,
    getHotSnapshot: getHotSnapshot,
    getCacheSnapshot: getCacheSnapshot,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
