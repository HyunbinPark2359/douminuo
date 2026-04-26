/**
 * 계산기 기입 오류 코드 → 사용자 메시지 + calcFill·teamBuilderFill 공용 유틸.
 */
(function (g) {
  'use strict';

  /**
   * body 텍스트 기반: 계산기 화면 여부(계산기·팀빌더 플로팅 공용 숨김 조건).
   *
   * F2: `body.innerText` 는 layout flush 비용 큰 호출. 콘텐츠 스크립트 여러 곳의
   * hot path (200ms tick · 500ms MO 디바운스 · refreshSlots · 인라인 어노테이션)
   * 에서 자주 호출되므로 250ms TTL 메모로 dedupe. SPA 네비게이션 이벤트에선 즉시 무효화.
   */
  var calcViewMemoResult = false;
  var calcViewMemoTime = 0;
  var CALC_VIEW_MEMO_TTL_MS = 250;

  function isLikelyCalculatorView() {
    var now = Date.now();
    if (now - calcViewMemoTime < CALC_VIEW_MEMO_TTL_MS) {
      return calcViewMemoResult;
    }
    var t = document.body && document.body.innerText;
    if (!t) {
      calcViewMemoResult = false;
    } else {
      calcViewMemoResult =
        t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
    }
    calcViewMemoTime = now;
    return calcViewMemoResult;
  }

  function invalidateCalcViewMemo() {
    calcViewMemoTime = 0;
  }

  try {
    window.addEventListener('hashchange', invalidateCalcViewMemo);
    window.addEventListener('popstate', invalidateCalcViewMemo);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) invalidateCalcViewMemo();
    });
  } catch (eMemo) {}

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
    vue_calc_not_found: '계산기 화면의 Vue 인스턴스를 찾지 못했습니다.',
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
    isLikelyCalculatorView: isLikelyCalculatorView,
    requestBridgeInject: requestBridgeInject,
    onLocalPrefChange: onLocalPrefChange,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
