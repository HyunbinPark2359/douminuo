/**
 * 계산기 기입 오류 코드 → 사용자 메시지 + 콘텐츠 스크립트 공용 유틸.
 *
 * R1 (2026-05-09): 페이지 식별을 본문 텍스트 휴리스틱에서 URL pathname 기반으로 교체.
 * 사이트 리뉴얼(Nuxt 3 + Tailwind) 후 path 분리됨 — '/' = 데미지 계산기, '/party' = 팀빌더,
 * '/speed' = 신규 스피드 계산기 탭. 옛 isLikelyCalculatorView 는 한 사이클 동안 alias 로 유지.
 *
 * R3 (2026-05-09): SPA pushState 라우트 전환 감지. 500ms pathname 폴링 + popstate/hashchange/
 * visibilitychange 에서 즉시 체크. 변경 감지 시 'nuofmt:locchange' CustomEvent 발생.
 */
(function (g) {
  'use strict';

  /* ===== R1: URL 기반 페이지 라우트 식별 ===== */

  /**
   * 현재 페이지 라우트.
   * @returns {'calc' | 'team' | 'calc-speed' | 'other'}
   */
  function getRoute() {
    var h = '';
    try { h = (location.hostname || '').toLowerCase(); } catch (eHost) { return 'other'; }
    if (h !== 'smartnuo.com' && h !== 'www.smartnuo.com') return 'other';
    // trailing slash 제거 후 비교 — 'smartnuo.com/' 도 'smartnuo.com' 과 같은 라우트.
    var p = '/';
    try { p = (location.pathname || '/').replace(/\/+$/, '') || '/'; } catch (ePath) { return 'other'; }
    if (p === '/' || p === '/index' || p.indexOf('/index.') === 0) return 'calc';
    if (p === '/party' || p.indexOf('/party/') === 0) return 'team';
    if (p === '/speed' || p.indexOf('/speed/') === 0) return 'calc-speed';
    if (p === '/docs' || p.indexOf('/docs/') === 0) return 'pokedex';
    return 'other';
  }

  function isCalculatorRoute()  { return getRoute() === 'calc'; }
  function isTeamBuilderRoute() { return getRoute() === 'team'; }
  function isCalcSpeedRoute()   { return getRoute() === 'calc-speed'; }
  function isPokedexRoute()     { return getRoute() === 'pokedex'; }

  /**
   * 옛 호출자 호환 alias — "데미지 계산기-ish 화면인가" 의도이므로 /speed 도 true 로 흡수.
   * 새 코드는 isCalculatorRoute / isTeamBuilderRoute / isCalcSpeedRoute 를 직접 사용.
   * 본 alias 는 다음 사이클에 제거 예정.
   */
  function isLikelyCalculatorView() {
    var r = getRoute();
    return r === 'calc' || r === 'calc-speed';
  }

  /* ===== R3: SPA pushState 라우트 전환 감지 ===== */

  /**
   * 콘텐츠 스크립트 isolated world 의 history 와 MAIN world 의 history 는 별개 객체이므로
   * isolated 측에서 monkey-patch 를 걸어도 사이트 라우터(MAIN)의 pushState 는 못 잡는다.
   * Vue Router 류의 pushState 는 popstate 도 발생시키지 않으므로 가장 안전·저비용 방안은
   * pathname 폴링. 비용: 500ms 마다 location.pathname read 한 번.
   *
   * 추가로 popstate/hashchange/visibilitychange 에서도 즉시 체크 — full reload 가 아닌 일반
   * 브라우저 탐색에서는 이쪽이 폴링보다 먼저 발생.
   */
  var lastPathSeen = (function () {
    try { return location.pathname || '/'; } catch (eInit) { return '/'; }
  })();

  function dispatchLocChange() {
    try {
      window.dispatchEvent(new CustomEvent('nuofmt:locchange', {
        detail: { pathname: location.pathname, route: getRoute() }
      }));
    } catch (eDisp) {}
  }

  function checkPathChange() {
    var p;
    try { p = location.pathname || '/'; } catch (eRead) { return; }
    if (p !== lastPathSeen) {
      lastPathSeen = p;
      dispatchLocChange();
    }
  }

  try {
    window.addEventListener('popstate', checkPathChange);
    window.addEventListener('hashchange', checkPathChange);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkPathChange();
    });
    setInterval(checkPathChange, 500);
  } catch (eWire) {}

  /**
   * 라우트 변경 구독. 'nuofmt:locchange' 의 얇은 wrapper.
   * @param {(detail: { pathname: string, route: string }) => void} cb
   * @returns {() => void} teardown — listener 제거.
   */
  function onRouteChange(cb) {
    if (typeof cb !== 'function') return function () {};
    var listener = function (ev) {
      try {
        cb(ev && ev.detail ? ev.detail : { pathname: location.pathname, route: getRoute() });
      } catch (eCb) {}
    };
    window.addEventListener('nuofmt:locchange', listener);
    return function () {
      try { window.removeEventListener('nuofmt:locchange', listener); } catch (eRm) {}
    };
  }

  /* ===== 브리지 주입 요청 (변경 없음) ===== */

  /**
   * background 에게 MAIN 월드 브리지 주입 요청.
   * @param {string} type INJECT_CALC_BRIDGE | INJECT_TEAM_BUILDER_BRIDGE
   * @param {string=} fallbackError 백그라운드가 에러 문자열을 안 주었을 때 쓸 코드
   */
  function requestBridgeInject(type, fallbackError) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: type }, function (r) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'runtime'));
          return;
        }
        if (!r || !r.ok) {
          reject(new Error((r && r.error) || fallbackError || 'bridge_inject_failed'));
          return;
        }
        resolve();
      });
    });
  }

  /* ===== 에러 매퍼 (변경 없음) ===== */

  /**
   * F14: 옛 if-체인을 dict lookup 으로. 같은 의미의 alias 들은 한 줄씩 나란히 적어 둠.
   * SW측 mapShareError 와 cross-context 동기화는 코드 공유 불가하므로 주석으로 가이드:
   *   `no_ps_id`·`unknown_share_shape` 두 키만 양측에서 같이 쓰임 — 메시지 동일하게 유지.
   */
  var CALC_FILL_ERR_MSG = {
    party_url_not_supported: '파티 공유 URL은 계산기 입력에 사용할 수 없습니다. 샘플 URL만 넣어 주세요.',
    empty_url: '해당 칸에 URL을 입력해 주세요.',
    no_ps_id: '#ps= 가 포함된 스마트누오 URL인지 확인해 주세요.',
    empty_slot: '샘플이 비어 있거나 종 이름을 읽지 못했습니다.',
    no_species: '샘플이 비어 있거나 종 이름을 읽지 못했습니다.',
    unknown_share_shape: '지원하지 않는 공유 형식입니다.',
    vue_calc_not_found: '계산기 상태(attacker/defender)를 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
    nuxt_state_not_found: '페이지 상태(Nuxt)를 읽지 못했습니다. 스마트누오를 새로고침한 뒤 다시 시도해 주세요.',
    species_not_in_dex: '도감에서 해당 종을 찾지 못했습니다. 이름·폼을 확인해 주세요.',
    species_not_in_def_dex: '도감에서 수비 포켓몬 종을 찾지 못했습니다. 이름·폼을 확인해 주세요.',
    calc_dex_not_ready: '도감(종 목록)이 아직 로드 중입니다. 잠시 후 다시 시도해 주세요.',
    calc_broadcast_all_failed: '계산기 인스턴스 모두에 반영하지 못했습니다. 탭을 새로고침한 뒤 다시 시도해 주세요.',
    not_calculator_view: '데미지 계산기 화면인지 확인해 주세요.',
    no_valid_payload: '적용할 수 있는 페이로드가 없습니다.',
    bridge_inject_failed: '브리지 주입에 실패했습니다. 탭을 새로고침한 뒤 확장을 다시 로드해 보세요.',
    calc_apply_timeout: '시간 초과. 계산기 탭을 활성화한 뒤 다시 시도해 주세요.',
    calc_payload_unavailable: '계산기용 스크립트를 불러오지 못했습니다. 확장 프로그램을 다시 로드해 주세요.',
  };

  function mapCalcFillError(code) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        var le = String(chrome.runtime.lastError.message || '');
        if (le.indexOf('Receiving end') !== -1) {
          return '탭과 연결되지 않았습니다. 스마트누오 탭을 새로고침해 주세요.';
        }
      }
    } catch (e) {}

    var c = String(code || '');
    if (Object.prototype.hasOwnProperty.call(CALC_FILL_ERR_MSG, c)) return CALC_FILL_ERR_MSG[c];
    // bridge_inject_failed 는 dict 에 있고, 그 외 'inject' 가 들어간 미래 코드들도 같은 메시지로.
    if (c.indexOf('inject') !== -1) {
      return CALC_FILL_ERR_MSG.bridge_inject_failed;
    }
    return c || '알 수 없는 오류';
  }

  /* ===== storage.onChanged 헬퍼 (변경 없음) ===== */

  /**
   * F13: chrome.storage.onChanged 보일러플레이트 통합.
   * 콘텐츠 스크립트 5+ 곳에서 같은 패턴(area 검사 → keys 변경 검출 → 전체 keys 재조회)을
   * 반복하던 것을 한 줄 호출로. callback 은 keys 모두를 포함한 storage 결과를 받는다.
   *
   * @param {string[]} keys 관심 키 목록
   * @param {(got: object) => void} callback 변경 감지 시 호출. got = chrome.storage.local.get 결과.
   * @returns {() => void} teardown 함수 — listener 제거. 호출자가 라이프사이클 끝낼 때 사용.
   */
  function onLocalPrefChange(keys, callback) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
      return function () {};
    }
    var listener = function (changes, area) {
      if (area !== 'local') return;
      var hit = false;
      var k;
      for (k = 0; k < keys.length; k++) {
        if (changes[keys[k]]) { hit = true; break; }
      }
      if (!hit) return;
      try {
        chrome.storage.local.get(keys, function (got) {
          if (chrome.runtime.lastError) return;
          callback(got);
        });
      } catch (e) {}
    };
    chrome.storage.onChanged.addListener(listener);
    return function () {
      try { chrome.storage.onChanged.removeListener(listener); } catch (e) {}
    };
  }

  g.mapCalcFillError = mapCalcFillError;
  g.nuoCsCommon = {
    getRoute: getRoute,
    isCalculatorRoute: isCalculatorRoute,
    isTeamBuilderRoute: isTeamBuilderRoute,
    isCalcSpeedRoute: isCalcSpeedRoute,
    isPokedexRoute: isPokedexRoute,
    // 옛 이름 — 다음 사이클에 제거 예정. 의미는 'calc' OR 'calc-speed' 합집합.
    isLikelyCalculatorView: isLikelyCalculatorView,
    onRouteChange: onRouteChange,
    requestBridgeInject: requestBridgeInject,
    onLocalPrefChange: onLocalPrefChange,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
