/**
 * 스마트누오 파티(팀빌더) 페이지 복사 아이콘 — 사이트 슬롯 `#N` 아이콘 줄 · `파티 리스트` 초록
 * 그룹에 합류 (REDESIGN §4.1 B). 슬롯 요약 복사 / 파티 복사. 서버·포맷 로직은 기존과 동일.
 * 복사 옵션 UI 는 환경설정(popup)으로 이관 — 여기선 chrome.storage.local 값만 읽음.
 * 피드백 = 사이트 아이콘 줄 방식 — hover 툴팁 없음, 성공은 클릭 후 아이콘 위 말풍선
 * ("샘플 복사 완료" 1.5s — 사이트 실측), 오류는 사이트처럼 네이티브 alert.
 * 슬롯 갱신: MutationObserver + hashchange + 라우트 전환. 슬롯 스냅샷(hot/캐시)은 계산기
 * "내 파티" 줄이 읽는다.
 *
 * F6: 인라인 어노테이션은 teamBuilderInlineAnnot.js, 공용 유틸은 teamBuilderShared.js.
 */
(function () {
  'use strict';

  var SK = {
    includeUrls: 'nuo_fmt_includeUrls',
    includeRealStats: 'nuo_fmt_includeRealStats',
    includeMovePowers: 'nuo_fmt_includeMovePowers',
    includeBulkStats: 'nuo_fmt_includeBulkStats',
    showdownPaste: 'nuo_fmt_showdownPaste',
  };

  var CS = globalThis.nuoCsCommon || {};
  var TBS = globalThis.nuoTeamBuilderShared || {};
  // R2/T1: 옛 "계산기 화면이면 hide" 의 음의 정의 → "팀빌더 화면이면 show" 양의 정의.
  var isTeamBuilderRoute = CS.isTeamBuilderRoute || function () { return true; };
  var isSmartnuoHost = TBS.isSmartnuoHost;
  var injectTeamBridgeOnce = TBS.injectTeamBridgeOnce;
  var getSlotsFromBridge = TBS.getSlotsFromBridge;

  if (typeof isSmartnuoHost !== 'function' || typeof getSlotsFromBridge !== 'function' ||
      typeof CS.keepInjected !== 'function') {
    // teamBuilderShared / calcFillShared 가 못 올라왔으면 안전하게 종료. manifest 순서 점검.
    return;
  }

  function mapErr(code) {
    return typeof globalThis.mapCalcFillError === 'function'
      ? globalThis.mapCalcFillError(code)
      : String(code || '');
  }

  function copyTextBestEffort(text) {
    var s = text != null ? String(text) : '';
    if (!s) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).catch(function () {
        copyViaTextarea(s);
      });
      return;
    }
    copyViaTextarea(s);
  }

  function copyViaTextarea(s) {
    var ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ===== 복사 옵션 (값은 popup 이 씀) ===== */

  var FORMAT_LOCAL_OPT_KEYS = [
    SK.includeUrls,
    SK.includeRealStats,
    SK.includeMovePowers,
    SK.includeBulkStats,
    SK.showdownPaste,
  ];

  function migrateSessionFormatToLocalIfNeeded(done) {
    chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (lg) {
      if (chrome.runtime.lastError) {
        if (typeof done === 'function') done();
        return;
      }
      var has = false;
      var i;
      for (i = 0; i < FORMAT_LOCAL_OPT_KEYS.length; i++) {
        if (typeof lg[FORMAT_LOCAL_OPT_KEYS[i]] === 'boolean') {
          has = true;
          break;
        }
      }
      if (has) {
        if (typeof done === 'function') done();
        return;
      }
      chrome.storage.session.get(FORMAT_LOCAL_OPT_KEYS, function (sg) {
        if (chrome.runtime.lastError) {
          if (typeof done === 'function') done();
          return;
        }
        var patch = {};
        var j;
        for (j = 0; j < FORMAT_LOCAL_OPT_KEYS.length; j++) {
          var k = FORMAT_LOCAL_OPT_KEYS[j];
          if (typeof sg[k] === 'boolean') patch[k] = sg[k];
        }
        if (Object.keys(patch).length === 0) {
          if (typeof done === 'function') done();
          return;
        }
        chrome.storage.local.set(patch, function () {
          if (typeof done === 'function') done();
        });
      });
    });
  }

  function readFormatOptions(callback) {
    migrateSessionFormatToLocalIfNeeded(function () {
      chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (got) {
        if (chrome.runtime.lastError) {
          callback({
            includeUrls: true,
            includeRealStats: false,
            includeMovePowers: false,
            includeBulkStats: false,
            showdownPaste: false,
          });
          return;
        }
        callback({
          includeUrls: got[SK.includeUrls] !== false,
          includeRealStats: !!got[SK.includeRealStats],
          includeMovePowers: !!got[SK.includeMovePowers],
          includeBulkStats: !!got[SK.includeBulkStats],
          showdownPaste: !!got[SK.showdownPaste],
        });
      });
    });
  }

  /* ===== 사이트 아이콘 줄 합류 (REDESIGN §4.1 B) ===== */

  var SUM_SVG = '<svg class="base" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7"/></svg>';
  var ICON_CSS = (globalThis.nuoTokensCss || '') + '\n' + (globalThis.nuoTeamCopyIconsCss || '');
  // 간격은 host 인라인 — .ic 에 두면 host 폭에 섞여 말풍선 중앙이 어긋남. 인라인이라 사이트 preflight 도 이김.
  var HOST_INLINE = 'display:inline-flex;vertical-align:middle;';

  var filled = [false, false, false, false, false, false];
  var bridgeReady = false;
  var injectors = [];

  /** `#N` 슬롯 헤더 줄의 사이트 아이콘 컨테이너(img 줄) — 첫 자식 앞 삽입. */
  function findSlotIconRow(idx1) {
    var list = TBS.getTbSlotListRoot ? TBS.getTbSlotListRoot() : null;
    var leaves = CS.findTextLeaves(new RegExp('^#' + idx1 + '$'), list || document.body);
    var i;
    for (i = 0; i < leaves.length; i++) {
      var row = leaves[i].parentElement && leaves[i].parentElement.parentElement;
      var icons = row && row.children && row.children[1];
      if (icons && icons.querySelector('img')) return { parent: icons, before: icons.firstChild };
    }
    return null;
  }

  /** `파티 리스트` 헤더 옆 초록 아이콘 그룹 — 첫 자식 앞 삽입. */
  function findPartyIconGroup() {
    var leaves = CS.findTextLeaves(/^파티 리스트$/);
    var i;
    for (i = 0; i < leaves.length; i++) {
      var grp = leaves[i].nextElementSibling;
      if (grp && grp.querySelector('img')) return { parent: grp, before: grp.firstChild };
    }
    return null;
  }

  /**
   * 아이콘 1개 렌더 + 피드백 핸들 fb = { busy(), done(), fail(msg) }.
   * @returns {function} teardown (타이머 정리)
   */
  function buildIcon(root, kind, label, onClick) {
    root.innerHTML = '<style>' + ICON_CSS + '</style>' +
      '<button type="button" class="ic ' + kind + '"></button><div class="tip" role="status" hidden></div>';
    var btn = root.querySelector('.ic');
    var tip = root.querySelector('.tip');
    btn.innerHTML = SUM_SVG;
    btn.setAttribute('aria-label', label);
    var timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function showTip(text, ms) {
      tip.textContent = text;
      tip.hidden = false;
      timers.push(setTimeout(function () { tip.hidden = true; }, ms));
    }
    var fb = {
      busy: function () {
        clearTimers();
        tip.hidden = true;
        btn.classList.add('busy');
        btn.setAttribute('aria-busy', 'true');
      },
      done: function () {
        btn.classList.remove('busy');
        btn.removeAttribute('aria-busy');
        showTip('샘플 복사 완료', 1500);
      },
      fail: function (msg) {
        btn.classList.remove('busy');
        btn.removeAttribute('aria-busy');
        window.alert(msg ? String(msg) : mapErr(''));
      }
    };
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (btn.classList.contains('busy')) return;
      onClick(fb);
    });
    return clearTimers;
  }

  /* ===== 복사 실행 ===== */

  function runCopyPartyShareUrl(fb) {
    if (!isTeamBuilderRoute()) return;
    fb.busy();

    getSlotsFromBridge().then(function (r) {
      var partySlots = r && r.ok && r.slots && r.slots.length === 6 ? r.slots : null;

      readFormatOptions(function (fo) {
        chrome.runtime.sendMessage(
          {
            type: 'COPY_PARTY_SHARE_URL',
            origin: location.origin,
            pathname: location.pathname || '/',
            partySlots: partySlots,
            formatOptions: fo,
          },
          function (bg) {
            if (chrome.runtime.lastError) {
              fb.fail(mapErr('')); // 매퍼가 lastError 를 한국어로 (영문 원문 노출 금지)
              return;
            }
            if (!bg || !bg.ok) {
              fb.fail((bg && bg.error) || '처리하지 못했습니다.');
              return;
            }
            var t = bg.text != null ? String(bg.text) : '';
            if (!t) {
              fb.fail('출력이 비었습니다.');
              return;
            }
            copyTextBestEffort(t);
            fb.done();
          }
        );
      });
    });
  }

  function runCopySlot(idx1, fb) {
    if (!isTeamBuilderRoute()) return;
    fb.busy();

    getSlotsFromBridge().then(function (r) {
      if (!r || !r.ok || !r.slots) {
        fb.fail('슬롯을 읽지 못했습니다.');
        return;
      }
      if (!r.filled || !r.filled[idx1 - 1]) {
        fb.fail('빈 슬롯입니다.');
        return;
      }
      var slotData = r.slots[idx1 - 1];
      readFormatOptions(function (fo) {
        chrome.runtime.sendMessage(
          {
            type: 'FORMAT_BUILDER_SLOT',
            slotIndex: idx1,
            slotData: slotData,
            origin: location.origin,
            pathname: location.pathname || '/',
            formatOptions: fo,
          },
          function (bg) {
            if (chrome.runtime.lastError) {
              fb.fail(mapErr('')); // 매퍼가 lastError 를 한국어로 (영문 원문 노출 금지)
              return;
            }
            if (!bg || !bg.ok) {
              fb.fail((bg && bg.error) || '변환 실패');
              return;
            }
            var t = bg.text != null ? String(bg.text) : '';
            if (!t) {
              fb.fail('출력이 비었습니다.');
              return;
            }
            copyTextBestEffort(t);
            fb.done();
          }
        );
      });
    });
  }

  /**
   * 저장한 샘플 복사 (sampleLibrary 목록 카드 복사 버튼) — runCopySlot 과 같은 변환·환경설정.
   * 샘플은 파티 슬롯 번호가 없으므로 slotIndex 1 (공유 URL 옵션일 때 share POST 메타 값일 뿐).
   * pathname '/party' 고정 — 계산기·스피드 탭에서 눌러도 링크가 파티 탭 복사와 같은 경로로 나오게.
   * @param {object} slotData 저장된 슬롯 원본
   * @returns {Promise<void>} 실패 시 reject(Error(한국어 문구))
   */
  function copySampleSlot(slotData) {
    return new Promise(function (resolve, reject) {
      readFormatOptions(function (fo) {
        chrome.runtime.sendMessage(
          {
            type: 'FORMAT_BUILDER_SLOT',
            slotIndex: 1,
            slotData: slotData,
            origin: location.origin,
            pathname: '/party',
            formatOptions: fo,
          },
          function (bg) {
            if (chrome.runtime.lastError || !bg) { reject(new Error('변환 실패')); return; }
            if (!bg.ok) { reject(new Error(bg.error || '변환 실패')); return; }
            var t = bg.text != null ? String(bg.text) : '';
            if (!t) { reject(new Error('출력이 비었습니다.')); return; }
            copyTextBestEffort(t);
            resolve();
          }
        );
      });
    });
  }
  globalThis.nuoTeamCopy = { copySampleSlot: copySampleSlot };

  /* ===== 삽입 등록 · 슬롯 갱신 ===== */

  function registerInjectors() {
    var i;
    for (i = 1; i <= 6; i++) {
      (function (idx1) {
        injectors.push(CS.keepInjected({
          key: 'tb-slot-copy-' + idx1,
          hostStyle: HOST_INLINE + 'margin-left:4px;',
          enabled: function () { return bridgeReady && isTeamBuilderRoute() && filled[idx1 - 1] === true; },
          find: function () { return findSlotIconRow(idx1); },
          build: function (root) {
            return buildIcon(root, 'slot', '요약 샘플 복사', function (fb) {
              runCopySlot(idx1, fb);
            });
          }
        }));
      })(i);
    }
    injectors.push(CS.keepInjected({
      key: 'tb-party-copy',
      hostStyle: HOST_INLINE + 'margin-right:4px;',
      enabled: function () { return bridgeReady && isTeamBuilderRoute() && filled.indexOf(true) >= 0; },
      find: findPartyIconGroup,
      build: function (root) {
        return buildIcon(root, 'party', '파티 샘플 복사', function (fb) { runCopyPartyShareUrl(fb); });
      }
    }));
  }

  function refreshInjectors() {
    injectors.forEach(function (h) { h.refresh(); });
  }

  function clearFilled() {
    filled = [false, false, false, false, false, false];
    refreshInjectors();
  }

  function refreshSlots() {
    if (!bridgeReady) return;
    if (!isTeamBuilderRoute()) {
      clearFilled();
      return;
    }
    getSlotsFromBridge().then(function (r) {
      if (!isTeamBuilderRoute() || !r || !r.ok || !r.slots || !Array.isArray(r.filled)) {
        clearFilled();
        return;
      }
      // C-5a/b: 슬롯 hot snapshot + 영속 캐시 갱신. 계산기 페이지가 같은 탭 내에서
      // (또는 다음 부팅 후) 이 데이터를 읽어 "내 파티" 줄에 사용.
      if (typeof TBS.setSlotSnapshot === 'function') {
        TBS.setSlotSnapshot({ slots: r.slots, slotArt: r.slotArt });
      }
      filled = r.filled.slice(0, 6);
      refreshInjectors();
    });
  }

  function init() {
    if (!isSmartnuoHost()) return;
    registerInjectors();
    injectTeamBridgeOnce().then(function () {
      bridgeReady = true;
      refreshSlots();
    }).catch(function () {});
    var tbMoTouchSlot =
      typeof TBS.tbMoRecordsTouchSlotList === 'function'
        ? TBS.tbMoRecordsTouchSlotList
        : function () {
            return true;
          };
    var moTimer = null;
    var mo = new MutationObserver(function (records) {
      if (!tbMoTouchSlot(records)) return;
      clearTimeout(moTimer);
      moTimer = setTimeout(refreshSlots, 500);
    });
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (eMo) {}
    window.addEventListener('hashchange', function () {
      setTimeout(refreshSlots, 200);
    });
    // R3: SPA pushState 라우트 전환 시 즉시 갱신.
    if (CS.onRouteChange) {
      CS.onRouteChange(refreshSlots);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // 인라인 어노테이션은 teamBuilderInlineAnnot.js 가 자체 DOMContentLoaded 에서 초기화 (F6).
})();
