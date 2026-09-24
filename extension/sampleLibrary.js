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
    var h = '<div class="head"><span class="nm">' + esc(item.name) + '</span>' +
      '<button type="button" class="del" data-id="' + id + '" aria-label="삭제">' + TRASH_SVG + '</button></div>' +
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
      var mName = m ? String(m.name_kr || '') : '';
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

  function renderList(items, hint) {
    if (!items.length) {
      return '<p class="msg" role="status"></p>' +
        '<p class="empty">저장한 샘플이 없습니다 · 샘플 이름 칸의 저장 버튼으로 저장할 수 있어요</p>';
    }
    return '<p class="count">저장한 샘플 · ' + items.length + (hint ? ' — ' + esc(hint) : '') + '</p>' +
      '<p class="msg" role="status"></p>' +
      '<div class="list">' + items.map(renderCard).join('') + '</div>';
  }

  /**
   * box(Shadow 안 요소)에 목록을 그리고 저장소 변경을 따라감. 카드 클릭 = onPick, 휴지통 = 확인 후 삭제.
   * box 가 속한 Shadow root 에 nuoSampleCardCss 가 있어야 함.
   * @param {Element} box
   * @param {{ hint?: string, onPick: function(object, function(string)) }} opts
   * @returns {function} teardown
   */
  function mountList(box, opts) {
    var items = [];
    function draw() { box.innerHTML = renderList(items, opts.hint); }
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
      var del = e.target.closest('.del');
      if (del) {
        var d = itemOf(del);
        if (!d) return;
        confirmDialog('\'' + d.name + '\' 샘플을 삭제할까요?', '삭제').then(function (yes) {
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
    return off;
  }

  /* ===== 다이얼로그 (Task 4 에서 채움) ===== */

  function confirmDialog() {
    return Promise.resolve(false);
  }

  function openListDialog() {}

  g.nuoSampleLibrary = {
    normName: normName,
    findByName: findByName,
    isLoadable: isLoadable,
    readAll: readAll,
    saveEntry: saveEntry,
    removeEntry: removeEntry,
    renderCard: renderCard,
    mountList: mountList,
    confirmDialog: function (q, ok) { return confirmDialog(q, ok); },
    openListDialog: function (o) { return openListDialog(o); },
    _pure: {
      normName: normName, findByName: findByName, withSaved: withSaved, withoutId: withoutId,
      isLoadable: isLoadable, spColor: spColor, natureDot: natureDot, typeBg: typeBg, esc: esc, renderCard: renderCard
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
