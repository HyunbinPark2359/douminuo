/**
 * 샘플 저장·불러오기 공용 (SAMPLE_LIBRARY_PLAN §4). 저장소 CRUD + 사이트 카드 복제 렌더 + 목록 mount + 다이얼로그 셸.
 * 소비자: sampleParty.js (파티 탭), calcFill.js (계산기·스피드 "내 파티" 줄).
 * manifest: styles/sampleCard.js · sampleCardAssets.js · calcFillShared.js 뒤, 소비자 앞.
 */
(function (g) {
  'use strict';

  var CS = g.nuoCsCommon || {};
  var A = g.NUO_SAMPLE_CARD_ASSETS || { stat: [], move: {}, tera: {}, pokeball: '' };
  var KEY = 'nuo_fmt_sampleLibrary';
  var SCHEMA = 1;
  // 2026-09-24 실측: 카드 1장 HTML ≈ 18KB(아이콘 data URI 반복) → 100장 그리기 44~72ms. 넘기려면 아이콘을 CSS 로 한 번만 두고 올릴 것.
  var LIMIT = 100;

  function mapErr(code) {
    return typeof g.mapCalcFillError === 'function' ? g.mapCalcFillError(code) : String(code || '');
  }

  /* ===== 순수 로직 ===== */

  function normName(s) {
    return String(s == null ? '' : s).trim();
  }

  function findByName(items, name) {
    var n = normName(name);
    var i;
    for (i = 0; i < items.length; i++) {
      if (normName(items[i].name) === n) return items[i];
    }
    return null;
  }

  /** 같은 이름 항목을 빼고 entry 를 맨 앞에 (덮어쓰기 = 교체 + 최신 위치). */
  function withSaved(items, entry) {
    var n = normName(entry.name);
    return [entry].concat(items.filter(function (it) { return normName(it.name) !== n; }));
  }

  /** 새 이름은 LIMIT 미만일 때만, 같은 이름 덮어쓰기는 항상 가능. */
  function canAdd(items, name) {
    return items.length < LIMIT || !!findByName(items, name);
  }

  function withoutId(items, id) {
    return items.filter(function (it) { return it.id !== id; });
  }

  function isLoadable(item) {
    return !!(item && item.slot && item.slot.pokemon && item.slot.pokemon.name);
  }

  /* 사이트 번들 list 컴포넌트 규칙 (§3.3) — 수치·조건 그대로. */
  var TYPE_BG = {
    normal: '#E3E3E3', fire: '#F8BFBF', water: '#BFD9FB', grass: '#C6E3BF', electric: '#FEEDB3', ice: '#C6F4FF',
    fighting: '#FFD9B3', poison: '#DEC6F0', ground: '#DECBBD', flying: '#DAEAFB', psychic: '#FBC6D7', bug: '#DEE3BA',
    rock: '#E7E6DA', ghost: '#D5C6D5', dragon: '#CBD0F6', dark: '#CBC6C6', steel: '#D0E3EA', fairy: '#FBD5FB'
  };
  var STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'];
  var NATURE_KEY = { 공격: 'attack', 방어: 'defense', 특공: 'special_attack', 특방: 'special_defense', 스피드: 'speed' };

  function typeBg(t) {
    return TYPE_BG[t] || 'white';
  }

  /** 스탯 포인트 색 — 사이트 Se(): 0 파랑, 32 이상 핑크, 그 외 검정. */
  function spColor(v) {
    var n = Number(v) || 0;
    return n === 0 ? '#4184F3' : n >= 32 ? '#E4007F' : '#272727';
  }

  /** 성격 점 — 사이트 ve(): 상승 스탯 핑크, 하락 스탯 파랑. object 가 아니면 점 없음. */
  function natureDot(personality, key) {
    if (!personality || typeof personality !== 'object' || !personality.up || !personality.down) return 'transparent';
    if (NATURE_KEY[personality.up] === key) return '#E4007F';
    if (NATURE_KEY[personality.down] === key) return '#4184F3';
    return 'transparent';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 이미지 URL 은 https: 또는 사이트 상대경로만 (저장 데이터가 조작돼도 javascript: 등 차단). */
  function safeUrl(u) {
    var s = String(u || '');
    return /^(https:\/\/|\/[^/])/.test(s) ? s : '';
  }

  /** 사이트 G/oe/Ae 헬퍼와 같은 규칙: object 면 kr → name → en, 아니면 문자열 그대로. */
  function textOf(v) {
    if (v && typeof v === 'object') return String(v.kr || v.name || v.en || '');
    return String(v == null ? '' : v);
  }

  // 파티 탭 슬롯 아이콘 줄 요약 복사 아이콘과 같은 모양 (teamBuilderFill.js SUM_SVG).
  var COPY_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7"/></svg>';
  var BOX_SVG = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-80q-33 0-56.5-23.5T120-160v-451q-18-11-29-28.5T80-680v-120q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v120q0 23-11 40.5T840-611v451q0 33-23.5 56.5T760-80H200Zm0-520v440h560v-440H200Zm-40-80h640v-120H160v120Zm200 280h240v-80H360v80Zm120 20Z"/></svg>';
  var TRASH_SVG = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Z"/></svg>';

  /**
   * 저장 항목 → 카드 마크업 (헤더 줄 + 사이트 카드). 어노테이션 없음 (§2).
   * @param {{ id: string, name: string, art: string, slot: object }} item
   * @returns {string}
   */
  function renderCard(item) {
    var p = (item && item.slot && item.slot.pokemon) || {};
    var species = p.name_kr || textOf(p.name);
    var nat = p.personality && typeof p.personality === 'object' ? String(p.personality.name || '') : String(p.personality || '');
    var ability = textOf(p.ability);
    var equip = textOf(p.equipment);
    var tera = p.terastal && A.tera[p.terastal] ? A.tera[p.terastal] : '';
    var moves = Array.isArray(p.moves) ? p.moves : [];
    var stats = p.stats || {};
    var id = esc(item.id);
    var h = '<div class="head"><span class="nm">' + esc(item.name) + '</span><span class="acts">' +
      '<button type="button" class="cp" data-id="' + id + '" aria-label="샘플 복사">' + COPY_SVG + '</button>' +
      '<button type="button" class="del" data-id="' + id + '" aria-label="삭제">' + TRASH_SVG + '</button></span></div>' +
      '<div class="card" role="button" tabindex="0" data-id="' + id + '" style="background:' + typeBg(p.first_type) + '">' +
      '<div class="info"><div class="line"><b>' + esc(species) + '</b>' +
      (nat ? '<span>' + esc(nat) + '</span>' : '') +
      (ability ? '<span>| ' + esc(ability) + '</span>' : '') +
      (equip ? '<span>| ' + esc(equip) + '</span>' : '') +
      (tera ? '<img class="tera" src="' + tera + '" alt="">' : '') +
      '</div><div class="moves">';
    var k;
    for (k = 0; k < 4; k++) {
      var m = moves[k];
      var mName = m ? String(m.name_kr || textOf(m.name)) : ''; // name_kr 빈 문자열 슬롯 있음 → 사이트처럼 name.kr 폴백
      var mIcon = mName && A.move[m.type] ? '<img src="' + A.move[m.type] + '" alt="">' : '';
      h += '<div class="mv">' + (mName ? mIcon + '<span>' + esc(mName) + '</span>' : '') + '</div>';
    }
    var art = safeUrl(item.art);
    h += '</div></div><div class="art">' +
      (art ? '<img class="a" src="' + esc(art) + '" alt="">' : '') +
      (equip ? '<img class="it" src="/data/party/equipment/' + encodeURIComponent(equip) + '.png" alt="">' : '') +
      '</div><div class="stats">';
    for (k = 0; k < STAT_KEYS.length; k++) {
      var sv = stats[STAT_KEYS[k]] || {};
      h += '<div class="st"><i style="background:' + natureDot(p.personality, STAT_KEYS[k]) + '"></i>' +
        (A.stat[k] ? '<img src="' + A.stat[k] + '" alt="">' : '') +
        '<span class="r">' + esc(sv.real == null ? '' : sv.real) + '</span>' +
        '<span class="v" style="color:' + spColor(sv.value) + '">' + esc(Number(sv.value) || 0) + '</span></div>';
    }
    return h + '</div></div>';
  }

  /* ===== 저장소 ===== */

  function readAll() {
    return new Promise(function (resolve, reject) {
      try {
        chrome.storage.local.get([KEY], function (got) {
          if (chrome.runtime.lastError) { reject(new Error('storage_failed')); return; }
          var doc = got && got[KEY];
          resolve(doc && doc.version === SCHEMA && Array.isArray(doc.items) ? doc.items : []);
        });
      } catch (e) {
        reject(new Error('storage_failed'));
      }
    });
  }

  function writeAll(items) {
    return new Promise(function (resolve, reject) {
      try {
        var obj = {};
        obj[KEY] = { version: SCHEMA, items: items };
        chrome.storage.local.set(obj, function () {
          if (chrome.runtime.lastError) { reject(new Error('storage_failed')); return; }
          resolve();
        });
      } catch (e) {
        reject(new Error('storage_failed'));
      }
    });
  }

  /**
   * @param {object} slot bridge 가 읽은 보강 슬롯 (sample_name 포함)
   * @param {string} art 일러스트 URL
   */
  function saveEntry(slot, art) {
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: normName(slot.sample_name),
      savedAt: Date.now(),
      slot: slot,
      art: art || ''
    };
    return readAll().then(function (items) { return writeAll(withSaved(items, entry)); });
  }

  function removeEntry(id) {
    return readAll().then(function (items) { return writeAll(withoutId(items, id)); });
  }

  /** 다른 탭 저장·삭제 즉시 반영. @returns {function} teardown */
  function onItemsChange(cb) {
    if (typeof CS.onLocalPrefChange !== 'function') return function () {};
    return CS.onLocalPrefChange([KEY], function () {
      readAll().then(cb, function () {});
    });
  }

  /* ===== 목록 ===== */

  function renderList(items) {
    if (!items.length) {
      return '<p class="msg" role="status"></p>' +
        '<p class="empty">저장한 샘플이 없습니다</p>';
    }
    // 개수 뱃지 = 파티 탭 우측 패널 "SP 66/66" 뱃지 실측(9px/300, padding 2px 8px, radius 5) + 회색(사용자 선택)
    return '<p class="count">내 샘플 목록<span class="badge">' + BOX_SVG + items.length + '/' + LIMIT + '</span></p>' +
      '<p class="msg" role="status"></p>' +
      '<div class="shell"><div class="list">' + items.map(renderCard).join('') + '</div>' +
      '<div class="sb"><div class="thumb"></div></div><div class="tip" role="status" hidden></div></div>';
  }

  /**
   * box(Shadow 안 요소)에 목록을 그리고 저장소 변경을 따라감. 카드 클릭 = onPick, 휴지통 = 확인 후 삭제,
   * 복사 = 파티 탭 슬롯 복사와 같은 변환(teamBuilderFill.js nuoTeamCopy).
   * box 가 속한 Shadow root 에 nuoSampleCardCss 가 있어야 함.
   * @param {Element} box
   * @param {{ onPick: function(object, function(string)) }} opts
   * @returns {function} teardown
   */
  function mountList(box, opts) {
    var items = [];
    var tipTimer = null;
    function draw() { box.innerHTML = renderList(items); }
    /** 결과 말풍선 — .list 가 overflow 로 자르므로 .shell 기준으로 버튼 위에 띄움. */
    function showTip(btn, text, ms) {
      var tip = box.querySelector('.shell > .tip');
      var shell = box.querySelector('.shell');
      if (!tip || !shell) return;
      var b = btn.getBoundingClientRect();
      var s = shell.getBoundingClientRect();
      tip.textContent = text;
      tip.style.left = (b.left + b.width / 2 - s.left) + 'px';
      tip.style.top = (b.top - s.top) + 'px';
      tip.hidden = false;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { tip.hidden = true; }, ms);
    }
    function setMsg(t) {
      var m = box.querySelector('.msg');
      if (m) m.textContent = t || '';
    }
    function itemOf(el) {
      var id = el.getAttribute('data-id');
      var i;
      for (i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
      return null;
    }
    readAll().then(function (it) { items = it; draw(); }, function () { items = []; draw(); setMsg(mapErr('storage_failed')); });
    var off = onItemsChange(function (it) { items = it; draw(); });

    box.addEventListener('click', function (e) {
      var cp = e.target.closest('.cp');
      if (cp) {
        var c = itemOf(cp);
        var TC = g.nuoTeamCopy;
        if (!c || cp.classList.contains('busy') || !TC) return;
        cp.classList.add('busy');
        TC.copySampleSlot(c.slot).then(function () {
          cp.classList.remove('busy');
          showTip(cp, '샘플 복사 완료', 1500);
        }, function (err) {
          cp.classList.remove('busy');
          showTip(cp, (err && err.message) || '변환 실패', 2500);
        });
        return;
      }
      var del = e.target.closest('.del');
      if (del) {
        var d = itemOf(del);
        if (!d) return;
        confirmDialog('\'' + d.name + '\' 샘플을 삭제할까요?', '삭제하기', '삭제하면 복구할 수 없습니다.').then(function (yes) {
          if (yes) removeEntry(d.id).catch(function () { setMsg(mapErr('storage_failed')); });
        });
        return;
      }
      var card = e.target.closest('.card');
      if (!card) return;
      var it = itemOf(card);
      if (!it) return;
      if (!isLoadable(it)) { setMsg(mapErr('sample_invalid')); return; }
      opts.onPick(it, setMsg);
    });
    // 커스텀 오버레이 스크롤바 — 스피드표 펼치기(speedOutspeedCalc.js updateInlineScrollbar 등)와 같은 모양·동작.
    // 네이티브 바는 숨김(카드 폭 보존), 스크롤하는 동안만 thumb 가 보였다가 1.4s 뒤 fade.
    var sbHideTimer = null;
    var sbDragging = false;
    function syncScrollbar(show) {
      var list = box.querySelector('.list');
      var sb = box.querySelector('.sb');
      var thumb = sb && sb.firstChild;
      if (!list || !thumb) return;
      var sh = list.scrollHeight;
      var ch = list.clientHeight;
      if (sh <= ch + 1) { thumb.style.height = '0px'; return; }
      var th = Math.max(24, Math.round((ch / sh) * sb.clientHeight));
      var maxTop = sb.clientHeight - th;
      thumb.style.height = th + 'px';
      thumb.style.top = (maxTop > 0 ? Math.round((list.scrollTop / (sh - ch)) * maxTop) : 0) + 'px';
      if (!show) return;
      sb.classList.add('show');
      clearTimeout(sbHideTimer);
      sbHideTimer = setTimeout(function () { if (!sbDragging) sb.classList.remove('show'); }, 1400);
    }
    box.addEventListener('scroll', function () {
      syncScrollbar(true);
      var tip = box.querySelector('.shell > .tip');
      if (tip) tip.hidden = true; // 버튼과 함께 안 움직이므로 스크롤 시 숨김
    }, true); // scroll 은 버블 안 함 → capture
    box.addEventListener('mousedown', function (e) {
      if (!e.target.classList || !e.target.classList.contains('thumb')) return;
      e.preventDefault();
      var list = box.querySelector('.list');
      var sb = box.querySelector('.sb');
      sbDragging = true;
      var startY = e.clientY;
      var startScroll = list.scrollTop;
      var range = list.scrollHeight - list.clientHeight;
      var maxTop = sb.clientHeight - e.target.offsetHeight;
      function mm(ev) { list.scrollTop = startScroll + (maxTop > 0 ? ((ev.clientY - startY) / maxTop) * range : 0); }
      function mu() {
        sbDragging = false;
        document.removeEventListener('mousemove', mm, true);
        document.removeEventListener('mouseup', mu, true);
        syncScrollbar(true);
      }
      document.addEventListener('mousemove', mm, true);
      document.addEventListener('mouseup', mu, true);
    });
    box.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) {
        e.preventDefault();
        e.target.click();
      }
    });
    // 도구 아이콘 등 404 → 깨진 이미지 대신 빈 자리 (사이트 카드도 이미지 없으면 비어 보임)
    box.addEventListener('error', function (e) {
      if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden';
    }, true);
    return function () {
      clearTimeout(tipTimer);
      off();
    };
  }

  /* ===== 다이얼로그 셸 — 사이트 PrimeVue Dialog 복제 (§5.4·§5.5) ===== */

  var DIALOG_CSS = (g.nuoTokensCss || '') + '\n' + (g.nuoSampleDialogCss || '') + '\n' + (g.nuoSampleCardCss || '');
  var LEAVE_MS = 150; // 사이트 p-dialog-leave-active 와 동일 (prefsEntry 와 같은 값)
  var MASK_DISMISS = false; // 2026-09-24 실측: 사이트 Dialog 는 마스크 클릭으로 안 닫힘
  var X_SVG = '<svg width="18" height="18" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>';
  var shells = [];

  /** 겹쳐 뜰 수 있음 (목록 위 확인창). Esc·마스크 = 맨 위 것만 닫힘. */
  function openShell(boxClass, html, onDismiss) {
    var host = document.createElement('div');
    host.setAttribute('data-nuo-inject', 'sample-dialog');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + DIALOG_CSS + '</style>' +
      '<div class="backdrop" role="dialog" aria-modal="true"><div class="box ' + boxClass + '">' + html + '</div></div>';
    var bd = root.querySelector('.backdrop');
    var sh = { root: root, closed: false, onDismiss: onDismiss || null, teardown: null };
    sh.close = function () {
      if (sh.closed) return;
      sh.closed = true;
      var ix = shells.indexOf(sh);
      if (ix >= 0) shells.splice(ix, 1);
      if (sh.teardown) { try { sh.teardown(); } catch (eT) {} }
      bd.classList.remove('on');
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, LEAVE_MS);
    };
    bd.addEventListener('click', function (e) {
      if (MASK_DISMISS && e.target === bd) dismiss(sh);
    });
    shells.push(sh);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bd.classList.add('on'); });
    });
    return sh;
  }

  function dismiss(sh) {
    var cb = sh.onDismiss;
    sh.close();
    if (cb) cb();
  }

  try {
    // 사이트 Dialog 는 Esc 무반응이지만 키보드 접근성 위해 우리 창은 Esc = 닫기(취소) 유지
    document.addEventListener('keydown', function (e) {
      if (!shells.length) return;
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      e.stopPropagation(); // 뒤의 사이트 다이얼로그까지 같이 닫히지 않게
      dismiss(shells[shells.length - 1]);
    }, true);
    // 라우트 전환 시 떠 있는 우리 다이얼로그 정리 (prefsEntry 와 같은 처리)
    if (typeof CS.onRouteChange === 'function') {
      CS.onRouteChange(function () { while (shells.length) dismiss(shells[shells.length - 1]); });
    }
  } catch (eWire) {}

  /**
   * 사이트 슬롯 삭제 확인창 복제 — 제목 + 설명 2줄, [취소][확인] 순.
   * @param {string} question 예: "'물리접수' 샘플이 이미 있어요. 덮어쓸까요?"
   * @param {string} okLabel 예: '덮어쓰기' / '삭제하기'
   * @param {string=} sub 설명 줄 예: '삭제하면 복구할 수 없습니다.'
   * @returns {Promise<boolean>}
   */
  function confirmDialog(question, okLabel, sub) {
    return new Promise(function (resolve) {
      var sh = openShell('confirm',
        '<p class="q">' + esc(question) + '</p>' +
        (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
        '<div class="acts"><button type="button" class="btn ghost" data-a="no">취소</button>' +
        '<button type="button" class="btn ok" data-a="yes">' + esc(okLabel) + '</button></div>',
        function () { resolve(false); });
      sh.root.querySelector('.acts').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        sh.close();
        resolve(b.getAttribute('data-a') === 'yes');
      });
      sh.root.querySelector('.btn.ok').focus();
    });
  }

  /**
   * 계산기·스피드 "내 파티" 줄 불러오기 버튼용 목록 다이얼로그.
   * @param {{ onPick: function(object) }} opts
   */
  function openListDialog(opts) {
    var sh = openShell('list-box',
      '<div class="hd"><span class="ttl">' + (A.pokeball ? '<img src="' + A.pokeball + '" alt="">' : '') + '샘플 불러오기</span>' +
      '<button type="button" class="x" aria-label="닫기">' + X_SVG + '</button></div><div class="lib"></div>');
    sh.root.querySelector('.x').addEventListener('click', function () { dismiss(sh); });
    sh.teardown = mountList(sh.root.querySelector('.lib'), {
      onPick: function (item) {
        sh.close();
        opts.onPick(item);
      }
    });
  }

  g.nuoSampleLibrary = {
    LIMIT: LIMIT,
    normName: normName,
    findByName: findByName,
    canAdd: canAdd,
    isLoadable: isLoadable,
    readAll: readAll,
    saveEntry: saveEntry,
    removeEntry: removeEntry,
    renderCard: renderCard,
    mountList: mountList,
    confirmDialog: function (q, ok, sub) { return confirmDialog(q, ok, sub); },
    openListDialog: function (o) { return openListDialog(o); },
    _pure: {
      normName: normName, findByName: findByName, withSaved: withSaved, withoutId: withoutId,
      isLoadable: isLoadable, spColor: spColor, natureDot: natureDot, typeBg: typeBg, esc: esc, renderCard: renderCard,
      renderList: renderList, canAdd: canAdd, LIMIT: LIMIT
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
