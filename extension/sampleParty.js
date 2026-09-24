/**
 * 파티 탭 샘플 저장·불러오기 주입 (SAMPLE_LIBRARY_PLAN §5.1·§5.2).
 * 저장 = 우측 패널 `샘플 이름` 칸 안, 사이트 업로드 버튼 왼쪽 버튼.
 * 불러오기 = 사이트 '샘플 불러오기' 다이얼로그 안 목록 (Task 6).
 */
(function (g) {
  'use strict';

  var CS = g.nuoCsCommon || {};
  var TBS = g.nuoTeamBuilderShared || {};
  var LIB = g.nuoSampleLibrary;
  if (typeof CS.keepInjected !== 'function' || !LIB) return;

  var TOKENS = g.nuoTokensCss || '';
  var SAVE_SVG = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Z"/></svg>';

  function mapErr(code) {
    return typeof g.mapCalcFillError === 'function' ? g.mapCalcFillError(code) : String(code || '');
  }

  function isTeamRoute() {
    return typeof CS.isTeamBuilderRoute === 'function' && CS.isTeamBuilderRoute();
  }

  /** `샘플 이름` 라벨 leaf → 부모(relative 래퍼: 라벨 + 입력칸 + 사이트 업로드 버튼). 사이트 버튼 앞에 삽입. */
  function findSaveAnchor() {
    var labs = CS.findTextLeaves(/^샘플 이름$/);
    var i;
    for (i = 0; i < labs.length; i++) {
      var wrap = labs[i].parentElement;
      var inp = wrap && wrap.querySelector('input');
      var btn = wrap && wrap.querySelector('button');
      if (inp && btn) return { parent: wrap, before: btn };
    }
    return null;
  }

  /** 활성 슬롯 좌측 카드의 공식 일러스트 URL (§4.1 art). 헤더 `#N` leaf → 헤더 줄 → 다음 형제 = 카드. */
  function findActiveArt(active) {
    var leaves = CS.findTextLeaves(new RegExp('^#' + active + '$'));
    var i;
    for (i = 0; i < leaves.length; i++) {
      var row = leaves[i].parentElement && leaves[i].parentElement.parentElement;
      var card = row && row.nextElementSibling;
      var img = card && card.querySelector('img[src*="official-artwork"]');
      if (img) return img.src;
    }
    return '';
  }

  function onSave(fb, inputEl) {
    fb.busy();
    TBS.readInputFromBridge().then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'bridge_timeout');
      if (!r.slot) { fb.fail('포켓몬을 먼저 선택해 주세요'); return null; }
      var name = LIB.normName(r.slot.sample_name);
      if (!name) {
        fb.fail('샘플 이름을 입력해 주세요');
        if (inputEl) inputEl.focus();
        return null;
      }
      var art = findActiveArt(r.active) || String(r.slot.pokemon.sprite || '');
      return LIB.readAll().then(function (items) {
        if (!LIB.findByName(items, name)) return true;
        return LIB.confirmDialog('\'' + name + '\' 샘플이 이미 있어요. 덮어쓸까요?', '덮어쓰기', '기존 샘플 내용은 복구할 수 없습니다.');
      }).then(function (go) {
        if (!go) { fb.idle(); return null; }
        return LIB.saveEntry(r.slot, art).then(function () { fb.done('샘플 저장 완료'); });
      });
    }).catch(function (err) {
      fb.fail(mapErr(err && err.message));
    });
  }

  function buildSave(root, host) {
    root.innerHTML = '<style>' + TOKENS + '\n' + (g.nuoSampleSaveCss || '') + '\n' + (g.nuoSampleTipCss || '') + '</style>' +
      '<button type="button" class="sv" aria-label="샘플 저장">' + SAVE_SVG + '</button>' +
      '<div class="tip" role="status" hidden></div>';
    var btn = root.querySelector('.sv');
    var tip = root.querySelector('.tip');
    var timer = null;
    var holding = false; // 피드백 말풍선 표시 중엔 hover 말풍선이 덮지 않음
    function show(text, ms) {
      clearTimeout(timer);
      tip.textContent = text;
      tip.hidden = false;
      holding = !!ms;
      if (ms) timer = setTimeout(function () { tip.hidden = true; holding = false; }, ms);
    }
    btn.addEventListener('mouseenter', function () { if (!holding) show('샘플 저장', 0); });
    btn.addEventListener('mouseleave', function () { if (!holding) tip.hidden = true; });
    var fb = {
      busy: function () { btn.classList.add('busy'); tip.hidden = true; holding = false; },
      idle: function () { btn.classList.remove('busy'); },
      done: function (t) { fb.idle(); show(t, 1500); },
      fail: function (t) { fb.idle(); show(t, 2500); }
    };
    var inp = host.parentElement ? host.parentElement.querySelector('input') : null;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains('busy')) return;
      onSave(fb, inp);
    });
    // 버튼 2개 → 긴 이름이 버튼 밑으로 안 들어가게 입력칸 오른쪽 여백 +24px. 철거 시 원복.
    var prevPad = inp ? inp.style.paddingRight : '';
    if (inp) inp.style.paddingRight = (parseFloat(getComputedStyle(inp).paddingRight) + 24) + 'px';
    return function () {
      clearTimeout(timer);
      if (inp) inp.style.paddingRight = prevPad;
    };
  }

  CS.keepInjected({
    key: 'sample-save',
    enabled: isTeamRoute,
    find: findSaveAnchor,
    // 사이트 업로드 버튼(right 10px, 20px)과 4px 간격. 위치는 inline 이라 사이트 preflight 영향 없음.
    hostStyle: 'position:absolute;right:34px;top:50%;transform:translateY(-50%);width:20px;height:20px;z-index:1;',
    build: buildSave
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
