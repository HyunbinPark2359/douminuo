/**
 * 계산기 기입 오류 코드 → 사용자 메시지 + calcFill·teamBuilderFill 공용 유틸.
 */
(function (g) {
  'use strict';

  /** body 텍스트 기반: 계산기 화면 여부(계산기·팀빌더 플로팅 공용 숨김 조건). */
  function isLikelyCalculatorView() {
    var t = document.body && document.body.innerText;
    if (!t) return false;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
  }

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
    if (c === 'party_url_not_supported') {
      return '파티 공유 URL은 계산기 입력에 사용할 수 없습니다. 샘플 URL만 넣어 주세요.';
    }
    if (c === 'empty_url') return '해당 칸에 URL을 입력해 주세요.';
    if (c === 'no_ps_id') return '#ps= 가 포함된 스마트누오 URL인지 확인해 주세요.';
    if (c === 'empty_slot' || c === 'no_species') return '샘플이 비어 있거나 종 이름을 읽지 못했습니다.';
    if (c === 'unknown_share_shape') return '지원하지 않는 공유 형식입니다.';
    if (c === 'vue_calc_not_found') return '계산기 화면의 Vue 인스턴스를 찾지 못했습니다.';
    if (c === 'calc_dex_not_ready') return '도감(종 목록)이 아직 로드 중입니다. 잠시 후 다시 시도해 주세요.';
    if (c === 'calc_broadcast_all_failed') {
      return '계산기 인스턴스 모두에 반영하지 못했습니다. 탭을 새로고침한 뒤 다시 시도해 주세요.';
    }
    if (c === 'not_calculator_view') return '데미지 계산기 화면인지 확인해 주세요.';
    if (c === 'no_valid_payload') return '적용할 수 있는 페이로드가 없습니다.';
    if (c === 'bridge_inject_failed' || c.indexOf('inject') !== -1) {
      return '브리지 주입에 실패했습니다. 탭을 새로고침한 뒤 확장을 다시 로드해 보세요.';
    }
    if (c === 'calc_apply_timeout') return '시간 초과. 계산기 탭을 활성화한 뒤 다시 시도해 주세요.';
    if (c === 'calc_payload_unavailable') {
      return '계산기용 스크립트를 불러오지 못했습니다. 확장 프로그램을 다시 로드해 주세요.';
    }
    return c || '알 수 없는 오류';
  }

  g.mapCalcFillError = mapCalcFillError;
  g.nuoCsCommon = {
    isLikelyCalculatorView: isLikelyCalculatorView,
    requestBridgeInject: requestBridgeInject,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
