/**
 * smartnuo.com 계산기 자동 입력 — 본 라운드 “팀 슬롯 원클릭” 으로 UI 재작성.
 *
 * 옛 좌/우 puck(공격/수비 두 dock) → 폐기. 단일 FAB(우하단, 팀빌더 FAB 와 같은 자리·크기)
 * 로 통합:
 *  - 큰 버튼 = 공격/수비 모드 토글 (검·방패 SVG, 텍스트 라벨 없음). yellowish(공) /
 *    greenish(수) 색은 styles/calcPanel.js 의 CSS 변수가 .is-mode-atk / .is-mode-def 로
 *    동적 전환.
 *  - 위에서 아래 7칸: Write 슬롯 + 슬롯 1~6.
 *      Write 클릭 → 좌측으로 펼치는 URL 입력 morph (옛 puck 의 URL 입력 흐름을 한 곳에
 *      축약). orchestrateCalcFillSide(URL 경로) 그대로 재사용.
 *      슬롯 1~6 클릭 → 현재 토글 모드 측 패널에 즉시 자동 입력. SW 메시지
 *      GET_CALC_PAYLOADS_FROM_SLOT 으로 페이로드 변환 → applyPayloads.
 *  - 슬롯 데이터: 콘텐츠 스크립트 isolated world 의 hot snapshot → chrome.storage.local
 *    영속 캐시 순서로 read. **bridge 호출 안 함**(T-1) — 계산기 라우트로 이동하면 팀빌더
 *    Vue store 가 unmount 되었을 가능성이 높아 빈 결과로 hot/캐시 를 덮어쓸 위험 회피.
 *    둘 다 비어 있으면 슬롯 6칸 회색 placeholder + 헤더 토스트(C-3).
 *  - 좌측 설정 트레이는 만들지 않음(C-6) — 클립보드 복사 옵션은 계산기 자동입력 흐름과
 *    무관. “있어도 동작 안 하는 UI” 가 되므로 통째로 생략.
 *  - 슬롯 hover 아이콘 = 검(공) / 방패(수), 토글 색을 그대로 따라감 — “지금 누르면 어디로
 *    가는가” 가 토글 + hover 두 곳에서 일관됨.
 *
 * 브리지(MAIN bridge calcFillBridge.js) 주입은 background.js 의 INJECT_CALC_BRIDGE 로
 * 그대로. 페이로드 적용 측은 변경 없음 — 본 라운드는 “페이로드를 어떻게 만드는가” 만 확장.
 */
(function () {
  'use strict';

  /** session 에만 보관하는 UX state. atk/def 토글 모드는 콘텐츠 스크립트 메모리에만 유지
   *  (사용자 답변 §9-2: 항상 '공' 으로 시작 — 새로고침 시 자동 리셋이 자연스러움) */
  var SK = {
    calcWriteUrlAtk: 'nuo_fmt_calcAtkUrl',  // 옛 키 그대로 — Write morph 의 URL 입력 자동복원
    calcWriteUrlDef: 'nuo_fmt_calcDefUrl',
  };

  var PANEL_HOST_ID = 'nuo-fmt-calc-panel-host';
  var LOCAL_SHOW_FLOAT = 'nuo_fmt_showCalcFloating';
  var LOCAL_GHOST_RING_ENABLED = 'nuo_fmt_calcGhostRingEnabled';

  var CS = globalThis.nuoCsCommon || {};
  var TBS = globalThis.nuoTeamBuilderShared || {};

  var isLikelyCalculatorView = CS.isLikelyCalculatorView;

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
            },
            '*'
          );
        });
      });
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

  /** 슬롯 객체 한 개 → 한쪽 페이로드 (SW 메시지). bridge 와 무관. */
  function getCalcPayloadsFromSlot(slot, side) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        {
          type: 'GET_CALC_PAYLOADS_FROM_SLOT',
          slot: slot,
          side: side === 'defender' ? 'defender' : 'attacker',
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

  /* ===== Shadow DOM 마크업 ===== */

  /** 공격(검) — 옛 calcFill `morph-orb` 의 SVG 그대로 재사용. */
  var SWORD_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14.5 17.5L3 6V3h3l11.5 11.5" />' +
    '<path d="M13 19l6-6" />' +
    '<path d="M16 16l4 4" />' +
    '<path d="M19 21l2-2" />' +
    '</svg>';

  /** 수비(방패) — 옛 calcFill `morph-orb` 의 SVG 그대로 재사용. */
  var SHIELD_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />' +
    '</svg>';

  /**
   * 슬롯 hover — Font Awesome Free v7.2.0 "file-import" 솔리드. “이 슬롯의 샘플을 가져오기”
   * 의 의미. 모드(공/수) 무관 단일 아이콘 — 모드 색은 부모 .lyr-ic 의 color 가 mode-tint.
   * https://fontawesome.com/license/free  Copyright 2026 Fonticons, Inc.
   */
  var FILE_IMPORT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">' +
    '<path d="M192 64C156.7 64 128 92.7 128 128L128 368L310.1 368L279.1 337C269.7 327.6 269.7 312.4 279.1 303.1C288.5 293.8 303.7 293.7 313 303.1L385 375.1C394.4 384.5 394.4 399.7 385 409L313 481C303.6 490.4 288.4 490.4 279.1 481C269.8 471.6 269.7 456.4 279.1 447.1L310.1 416.1L128 416.1L128 512.1C128 547.4 156.7 576.1 192 576.1L448 576.1C483.3 576.1 512 547.4 512 512.1L512 234.6C512 217.6 505.3 201.3 493.3 189.3L386.7 82.7C374.7 70.7 358.5 64 341.5 64L192 64zM453.5 240L360 240C346.7 240 336 229.3 336 216L336 122.5L453.5 240z"/>' +
    '</svg>';

  /**
   * Write 슬롯 — Font Awesome Free v7.2.0 "pen-to-square" 솔리드.
   * https://fontawesome.com/license/free  Copyright 2026 Fonticons, Inc.
   * 사용자 지정(§5.4 SVG 본문 인라인 보존).
   */
  var PEN_TO_SQUARE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">' +
    '<path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/>' +
    '</svg>';

  var SPINNER_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-dasharray="14 32"/>' +
    '</svg>';

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
    '</svg>';

  var BAN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9" />' +
    '<path stroke-linecap="round" d="M7 7l10 10" />' +
    '</svg>';

  var BAN_SVG_SLIM =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10" />' +
    '<path d="M4.9 4.9l14.2 14.2" />' +
    '</svg>';

  /** 슬롯/토글 공통 피드백 layer (hover/busy/done/err). */
  function feedbackHtmlForSlot() {
    return (
      '<span class="fab-fb" aria-hidden="true">' +
      '<span class="lyr lyr-hover">' +
      '<span class="lyr-bg"></span>' +
      '<span class="lyr-ic lyr-ic-import">' + FILE_IMPORT_SVG + '</span>' +
      '<span class="lyr-ic lyr-ic-ban">' + BAN_SVG_SLIM + '</span>' +
      '</span>' +
      '<span class="lyr lyr-busy"><span class="lyr-bg"></span><span class="lyr-ic">' + SPINNER_SVG + '</span></span>' +
      '<span class="lyr lyr-done"><span class="lyr-bg"></span><span class="lyr-ic">' + CHECK_SVG + '</span></span>' +
      '<span class="lyr lyr-err"><span class="lyr-bg"></span><span class="lyr-ic">' + BAN_SVG + '</span></span>' +
      '</span>'
    );
  }

  /** 토글 버튼 피드백 — hover 는 안 쓰고 busy/done/err 만. */
  function feedbackHtmlForToggle() {
    return (
      '<span class="fab-fb" aria-hidden="true">' +
      '<span class="lyr lyr-busy"><span class="lyr-bg"></span><span class="lyr-ic">' + SPINNER_SVG + '</span></span>' +
      '<span class="lyr lyr-done"><span class="lyr-bg"></span><span class="lyr-ic">' + CHECK_SVG + '</span></span>' +
      '<span class="lyr lyr-err"><span class="lyr-bg"></span><span class="lyr-ic">' + BAN_SVG + '</span></span>' +
      '</span>'
    );
  }

  function buildShadowMarkup(root) {
    root.innerHTML =
      '<style>' + (globalThis.nuoCalcPanelCss || '') + '</style>' +
      '<div class="fab-root nuo-off is-mode-atk" id="fabRoot" part="fab">' +
      '  <div class="fab-inner">' +
      '    <div class="fab-dock" id="fabDock">' +
      '      <div class="fab-head-toast" id="fabHeadToast" role="alert" aria-live="assertive"></div>' +
      '      <div class="fab-dock-main">' +
      '        <div class="fab-write-wrap" id="fabWriteWrap">' +
      '          <div class="fab-write-morph" id="fabWriteMorph" tabindex="0" role="group" aria-label="공유 URL 입력">' +
      '            <span class="fab-write-bg-expanded" aria-hidden="true"></span>' +
      '            <div class="fab-write-gear" aria-hidden="true">' + PEN_TO_SQUARE_SVG + '</div>' +
      '            <div class="fab-write-panel-content">' +
      '              <div class="fab-write-head">' +
      '                <span id="fabWriteHeadLabel">공격 샘플 URL</span>' +
      '              </div>' +
      '              <input type="text" class="fab-write-inp" id="fabWriteInp" spellcheck="false" autocomplete="off" placeholder="https://smartnuo.com/#ps=..." />' +
      '              <button type="button" class="fab-write-apply" id="fabWriteApply">' +
      '                <span class="fab-write-apply-label">입력</span>' +
      '                <span class="fab-write-spinner" hidden aria-hidden="true"></span>' +
      '              </button>' +
      '              <p class="fab-write-status" id="fabWriteStatus" role="status" aria-live="polite"></p>' +
      '            </div>' +
      '          </div>' +
      '        </div>' +
      '        <div class="fab-party-col">' +
      '          <div class="fab-slots" id="fabSlots"></div>' +
      '          <div class="fab-party-wrap">' +
      '            <button type="button" class="fab-btn fab-mode-toggle" id="fabModeToggle" aria-label="공격으로 적용 / 클릭 시 수비로 전환">' +
      '              <span class="fab-toggle-ic fab-toggle-ic-atk">' + SWORD_SVG + '</span>' +
      '              <span class="fab-toggle-ic fab-toggle-ic-def">' + SHIELD_SVG + '</span>' +
      feedbackHtmlForToggle() +
      '            </button>' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
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
    buildShadowMarkup(root);

    var fabRoot = root.getElementById('fabRoot');
    var fabDock = root.getElementById('fabDock');
    var fabSlots = root.getElementById('fabSlots');
    var modeToggle = root.getElementById('fabModeToggle');
    var headToast = root.getElementById('fabHeadToast');

    var writeWrap = root.getElementById('fabWriteWrap');
    var writeMorph = root.getElementById('fabWriteMorph');       // 단일 엘리먼트 — hover 시 자기 자신을 panel 로 변형 (팀빌더 .fab-settings-morph 패턴)
    var writeHeadLabel = root.getElementById('fabWriteHeadLabel');
    var writeInp = root.getElementById('fabWriteInp');
    var writeApply = root.getElementById('fabWriteApply');
    var writeSpin = writeApply.querySelector('.fab-write-spinner');
    var writeStatus = root.getElementById('fabWriteStatus');

    /** 현재 토글 모드 — 메모리에만 보관 (페이지 새로고침 시 atk 으로 리셋). */
    var modeAtk = true;

    function applyModeClass() {
      if (!fabRoot) return;
      fabRoot.classList.toggle('is-mode-atk', modeAtk);
      fabRoot.classList.toggle('is-mode-def', !modeAtk);
      // Write panel head 라벨도 mode 따라 — 좌측 puck hover 시 보임.
      if (writeHeadLabel) {
        writeHeadLabel.textContent = modeAtk ? '공격 샘플 URL' : '수비 샘플 URL';
      }
      // aria-label: “지금 보이는 게 아니라 누르면 어디로 가는가” 기조
      modeToggle.setAttribute(
        'aria-label',
        modeAtk
          ? '공격 모드 — 클릭 시 수비로 전환'
          : '수비 모드 — 클릭 시 공격으로 전환'
      );
    }

    /* ===== 슬롯 1~6 DOM 생성 (Write 는 이제 좌측 puck — markup 에 박혀 있음) ===== */

    var slotBtns = [];
    var bi;
    for (bi = 1; bi <= 6; bi++) {
      (function (idx1) {
        var row = document.createElement('div');
        row.className = 'fab-slot-row';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fab-btn fab-slot is-empty';
        b.disabled = true;
        b.setAttribute('data-slot-idx', String(idx1));
        b.setAttribute('aria-label', '#' + idx1 + ' 슬롯');
        b.innerHTML =
          '<span class="fab-slot-label">' +
          '<img class="fab-slot-mon" alt="" decoding="async" />' +
          '<span class="fab-slot-fallback-num">' + idx1 + '</span>' +
          '</span>' +
          feedbackHtmlForSlot();
        row.appendChild(b);
        fabSlots.appendChild(row);
        slotBtns.push(b);
      })(bi);
    }

    /* ===== 슬롯 visuals: hot/cache 데이터로 image/disabled 갱신 ===== */

    /** in-memory 의 “현재 슬롯 데이터” — 클릭 시점에 사용. */
    var currentSlots = null;
    /** 슬롯 데이터 갱신 1회 진행중 가드. */
    var snapshotInflight = false;

    function applySlotVisuals(slotArt, filledArr) {
      var i, b, art, hasMon, imgEl;
      for (i = 0; i < 6; i++) {
        b = slotBtns[i];
        if (!b) continue;
        art = (slotArt && slotArt[i]) || '';
        hasMon = !!(filledArr && filledArr[i] && art);
        // 팀빌더 FAB 와 동일 패턴: disabled 안 걸고 .is-empty 클래스로만 “비어있음” 표시.
        // 그래야 빈 슬롯에도 hover 가 살아있어 ban 아이콘이 뜸 (disabled 상태에선
        // .fab-btn:not(:disabled):hover 셀렉터 발화 안 됨).
        b.disabled = false;
        b.classList.toggle('is-empty', !hasMon);
        b.classList.toggle('has-mon', !!hasMon);
        imgEl = b.querySelector('.fab-slot-mon');
        if (imgEl) {
          if (hasMon) {
            if (imgEl.getAttribute('src') !== art) imgEl.setAttribute('src', art);
          } else {
            imgEl.removeAttribute('src');
          }
        }
      }
    }

    /** 슬롯 6칸 모두 회색 + 비활성. */
    function clearAllSlotVisuals() {
      applySlotVisuals(null, null);
    }

    function deriveFilled(slots) {
      var i, out = [];
      for (i = 0; i < 6; i++) {
        var s = slots && slots[i];
        if (!s || typeof s !== 'object') { out.push(false); continue; }
        // 매우 단순한 휴리스틱: nameKr / species / name 또는 stats 가 있으면 채워진 것으로 간주.
        // teamBuilderBridge.flattenSlot/slotEmpty 와 의미는 같지만 content script 에 SR 없음.
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

    function setHeadToast(msg) {
      if (!headToast) return;
      headToast.textContent = msg || '';
      headToast.classList.toggle('show', !!msg);
    }

    function refreshSlotsFromSnapshot() {
      if (snapshotInflight) return;
      snapshotInflight = true;
      getSlotsFromHotOrCache().then(function (snap) {
        snapshotInflight = false;
        if (snap && Array.isArray(snap.slots) && snap.slots.length > 0) {
          currentSlots = snap.slots;
          var filled = deriveFilled(snap.slots);
          applySlotVisuals(snap.slotArt || [], filled);
          setHeadToast('');
          return;
        }
        currentSlots = null;
        clearAllSlotVisuals();
        setHeadToast('팀빌더 페이지를 한 번 열어 주세요.');
      }).catch(function () {
        snapshotInflight = false;
        currentSlots = null;
        clearAllSlotVisuals();
        setHeadToast('팀 정보를 불러오지 못했습니다.');
      });
    }

    /* ===== 피드백 helper ===== */

    function setBtnState(b, state) {
      if (!b) return;
      b.classList.remove('fab-busy', 'fab-done', 'fab-err', 'fab-bounce');
      if (state) b.classList.add('fab-' + state);
    }

    function flashClickBounce(b) {
      if (!b || b.disabled || b.classList.contains('fab-err')) return;
      b.classList.remove('fab-bounce');
      // reflow
      try { void b.offsetWidth; } catch (e) {}
      b.classList.add('fab-bounce');
      setTimeout(function () {
        try { b.classList.remove('fab-bounce'); } catch (eRm) {}
      }, 200);
    }

    function showSlotError(b, msg) {
      setBtnState(b, 'err');
      // 헤더 토스트 영역을 슬롯 에러 메시지로 일시 노출
      setHeadToast(msg || '입력에 실패했습니다.');
      setTimeout(function () {
        if (b.classList.contains('fab-err')) setBtnState(b, '');
      }, 1300);
      setTimeout(function () {
        // 슬롯 데이터 자체는 유효하므로 토스트는 다시 비움
        setHeadToast('');
      }, 2200);
    }

    function showSlotSuccess(b) {
      setBtnState(b, 'done');
      setTimeout(function () {
        if (b.classList.contains('fab-done')) setBtnState(b, '');
      }, 1100);
    }

    /* ===== 슬롯 클릭 → 자동 입력 ===== */

    function onSlotClick(idx0) {
      var b = slotBtns[idx0];
      if (!b) return;
      // 빈 슬롯: 시각 피드백(bounce) 만, 실제 자동입력은 진행 안 함. 팀빌더 FAB 와 동일 패턴.
      if (b.classList.contains('is-empty')) {
        flashClickBounce(b);
        return;
      }
      if (b.classList.contains('fab-busy') || b.classList.contains('fab-done') || b.classList.contains('fab-err')) {
        return;
      }
      var slot = currentSlots && currentSlots[idx0];
      if (!slot) {
        showSlotError(b, '슬롯을 읽지 못했습니다.');
        return;
      }
      flashClickBounce(b);
      setBtnState(b, 'busy');
      orchestrateCalcFillFromSlot(slot, modeAtk ? 'attacker' : 'defender')
        .then(function () {
          showSlotSuccess(b);
        })
        .catch(function (err) {
          var msg = (err && err.message) || mapErr('');
          showSlotError(b, msg);
        });
    }

    var si;
    for (si = 0; si < 6; si++) {
      (function (idx0) {
        slotBtns[idx0].addEventListener('click', function (ev) {
          ev.stopPropagation();
          onSlotClick(idx0);
        });
      })(si);
    }

    /* ===== Write puck (좌측, hover 진입점) ===== */

    /**
     * 현재 토글 모드에 맞는 URL 을 session storage 에서 다시 읽어 input 에 표시.
     * mode 토글 / dock 펼침 / 초기 마운트 시 호출.
     */
    function refreshWriteInputForMode() {
      try {
        chrome.storage.session.get([SK.calcWriteUrlAtk, SK.calcWriteUrlDef], function (got) {
          if (chrome.runtime.lastError) return;
          if (!writeInp) return;
          var v = modeAtk ? got[SK.calcWriteUrlAtk] : got[SK.calcWriteUrlDef];
          writeInp.value = v != null ? String(v) : '';
        });
      } catch (e) {}
      setWriteStatus('');
    }

    // morph 클릭 — 빈 영역(gear/bg) 이면 input 으로 focus 이동(편의용 단축).
    // 입력란/apply 버튼 자체 클릭은 native 이벤트가 bubble 되어 여기 도달하지만 input 에 다시 focus
    // 하는 건 무해. apply 클릭은 자기 핸들러에서 stopPropagation.
    writeMorph.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (writeInp && ev.target !== writeApply) {
        try { writeInp.focus(); } catch (eFc) {}
      }
    });

    function setWriteStatus(msg, kind) {
      writeStatus.textContent = msg || '';
      writeStatus.classList.remove('err', 'ok');
      if (kind === 'err') writeStatus.classList.add('err');
      else if (kind === 'ok') writeStatus.classList.add('ok');
    }

    function setWriteApplyBusy(on) {
      writeApply.disabled = !!on;
      writeSpin.hidden = !on;
      writeApply.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    var writePersistTimer = null;
    function scheduleWritePersist() {
      clearTimeout(writePersistTimer);
      writePersistTimer = setTimeout(function () {
        try {
          var o = {};
          if (modeAtk) o[SK.calcWriteUrlAtk] = writeInp.value;
          else o[SK.calcWriteUrlDef] = writeInp.value;
          chrome.storage.session.set(o);
        } catch (e) {}
      }, 200);
    }
    writeInp.addEventListener('input', scheduleWritePersist);

    writeApply.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setWriteStatus('');
      setWriteApplyBusy(true);
      var url = writeInp.value;
      var opts = modeAtk
        ? { atkUrl: url, defUrl: '', onlyAttacker: true, onlyDefender: false }
        : { atkUrl: '', defUrl: url, onlyAttacker: false, onlyDefender: true };
      orchestrateCalcFillSide(opts)
        .then(function (r) {
          var w = r && r.warnings;
          if (Array.isArray(w) && w.length) {
            setWriteStatus('입력을 완료했습니다. 참고: ' + w.join(' '), 'ok');
          } else {
            setWriteStatus('입력을 완료했습니다.', 'ok');
          }
          scheduleWritePersist();
        })
        .catch(function (err) {
          setWriteStatus((err && err.message) || mapErr(''), 'err');
        })
        .then(function () {
          setWriteApplyBusy(false);
        });
    });

    /* ===== 모드 토글 ===== */

    modeToggle.addEventListener('click', function (ev) {
      ev.stopPropagation();
      flashClickBounce(modeToggle);
      modeAtk = !modeAtk;
      applyModeClass();
      refreshWriteInputForMode();   // 모드 변경 시 URL 입력란도 해당 모드 값으로 교체
    });

    // input focus 시 dock 자동 닫힘 차단 / blur 시 다시 close 스케줄.
    writeInp.addEventListener('focus', function () {
      cancelDockCloseTimer();
    });
    writeInp.addEventListener('blur', function () {
      // 마우스가 dock 위면 mouseover 가 cancel 시키니, 그 외 케이스에서만 닫힘.
      scheduleDockClose();
    });

    /* ===== Dock open/close: hover 기반 (팀빌더 FAB 와 동일) ===== */

    var dockCloseTimer = null;
    function cancelDockCloseTimer() {
      if (dockCloseTimer) {
        clearTimeout(dockCloseTimer);
        dockCloseTimer = null;
      }
    }
    function openDock() {
      if (!fabDock) return;
      cancelDockCloseTimer();
      fabDock.classList.add('fab-dock--open');
      // 펼치는 시점에 슬롯 visuals 재갱신 (사용자가 다른 탭에서 팀빌더 변경한 후 돌아온 케이스)
      refreshSlotsFromSnapshot();
      refreshWriteInputForMode();
    }
    function scheduleDockClose() {
      if (!fabDock) return;
      cancelDockCloseTimer();
      dockCloseTimer = setTimeout(function () {
        dockCloseTimer = null;
        if (!fabDock) return;
        // input 에 focus 가 있으면 dock 유지 (사용자가 키보드로 입력 중일 수 있음).
        if (writeInp && root.activeElement === writeInp) return;
        fabDock.classList.remove('fab-dock--open');
      }, 90);
    }
    function onDockMouseOut(ev) {
      if (!fabDock) return;
      var rt = ev.relatedTarget;
      if (rt && fabDock.contains(rt)) return;
      scheduleDockClose();
    }
    function onDockMouseOver() {
      cancelDockCloseTimer();
    }
    if (fabDock) {
      modeToggle.addEventListener('mouseenter', openDock);
      fabDock.addEventListener('mouseout', onDockMouseOut);
      fabDock.addEventListener('mouseover', onDockMouseOver);
    }

    /* ===== 외부 클릭 / Esc — hover-only panel 이라 morph close 핸들러는 더 이상 없음. ESC 는 input blur. ===== */

    function onKeyDown(ev) {
      if (ev.key === 'Escape') {
        if (root.activeElement === writeInp) {
          try { writeInp.blur(); } catch (eEsc) {}
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true);

    /* ===== 표시 휴리스틱 (계산기 화면일 때만 보이기) ===== */

    function setWrapVisible(on) {
      if (!fabRoot) return;
      fabRoot.classList.toggle('nuo-off', !on);
    }

    function syncCalcHeuristic() {
      var on = isLikelyCalculatorView();
      setWrapVisible(on);
      if (on) {
        // 표시 시점에 1회 갱신
        refreshSlotsFromSnapshot();
        refreshWriteInputForMode();
      } else {
        // 숨겨질 때 dock 도 접음 — write panel 은 hover-only 라 자동으로 사라짐.
        if (fabDock) fabDock.classList.remove('fab-dock--open');
        if (writeInp && root.activeElement === writeInp) {
          try { writeInp.blur(); } catch (eBl) {}
        }
      }
    }

    /* ===== 초기화 ===== */

    applyModeClass();
    syncCalcHeuristic();
    refreshWriteInputForMode();

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

    // 슬롯 데이터가 다른 콘텐츠 스크립트(팀빌더 FAB / 인라인 어노)에 의해 갱신되었을 때
    // 우리도 visuals 즉시 갱신할 수 있도록, dock 펼칠 때 + heuristic on 일 때 이미 갱신함.
    // 여기에 추가로 chrome.storage.onChanged 리스너로 영속 캐시 변경에도 반응 — 다른 탭에서
    // 팀빌더를 수정한 케이스 보강.
    if (CS.onLocalPrefChange) {
      CS.onLocalPrefChange(['nuo_fmt_teamSlotsCache'], function () {
        if (fabRoot && !fabRoot.classList.contains('nuo-off')) {
          refreshSlotsFromSnapshot();
        }
      });
    }

    // REMOVE_GHOST_RING: 아래 한 블록과 extension/calcGhostRing.js, manifest 의 해당 라인만
    // 지우면 ghost ring 기능을 깨끗이 제거 가능 (CALC_PARTY_FILL_PLAN.md §4 격리 가이드).
    var ghostRingPref = { enabled: true };
    var ghostRingHandle = null;
    if (globalThis.nuoGhostRing && fabRoot) {
      try {
        ghostRingHandle = globalThis.nuoGhostRing.attach(
          fabRoot,
          function () {
            return modeAtk ? 'attacker' : 'defender';
          },
          {
            getGhostRingEnabled: function () {
              return ghostRingPref.enabled;
            },
          }
        );
      } catch (eGr) {}
    }
    chrome.storage.local.get([LOCAL_GHOST_RING_ENABLED], function (got) {
      if (!chrome.runtime.lastError) {
        ghostRingPref.enabled = got[LOCAL_GHOST_RING_ENABLED] !== false;
      }
      if (ghostRingHandle && ghostRingHandle.refresh) ghostRingHandle.refresh();
    });
    if (CS.onLocalPrefChange) {
      CS.onLocalPrefChange([LOCAL_GHOST_RING_ENABLED], function (got) {
        ghostRingPref.enabled = got[LOCAL_GHOST_RING_ENABLED] !== false;
        if (ghostRingHandle && ghostRingHandle.refresh) ghostRingHandle.refresh();
      });
    }
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
