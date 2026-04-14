/**
 * 팀빌더(MAIN). Vue2/3 + store 깊이 스캔으로 파티 슬롯(최대 6) 후보를 찾음.
 */
(function () {
  if (window.__NUO_TEAM_BUILDER_BRIDGE_V3__) return;
  window.__NUO_TEAM_BUILDER_BRIDGE_V3__ = true;

  var MSG_EXT = 'nuo-team-ext';
  var MSG_BRIDGE = 'nuo-team-bridge';

  function flattenSlot(slot) {
    if (!slot || typeof slot !== 'object') return {};
    var nested = slot.pokemon || slot.mon || slot.poke;
    if (!nested && slot.data && typeof slot.data === 'object' && !Array.isArray(slot.data)) {
      nested = slot.data.pokemon || slot.data.mon || slot.data.poke;
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.assign({}, nested, slot);
    }
    if (slot.data && typeof slot.data === 'object' && !Array.isArray(slot.data)) {
      return Object.assign({}, slot.data, slot);
    }
    return Object.assign({}, slot);
  }

  function slotEmpty(s) {
    if (s == null || typeof s !== 'object') return true;
    var flat = flattenSlot(s);
    var keys = Object.keys(flat).filter(function (k) {
      var v = flat[k];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    });
    return keys.length === 0;
  }

  function normalizeSix(arr) {
    var out = [];
    var i;
    for (i = 0; i < 6; i++) {
      out.push(arr[i] != null ? arr[i] : {});
    }
    return out;
  }

  function filledCount(slots) {
    var n = 0;
    var i;
    for (i = 0; i < slots.length; i++) {
      if (!slotEmpty(slots[i])) n++;
    }
    return n;
  }

  function vmArea(vm) {
    var el = vm && vm.$el;
    if (!el || el.nodeType !== 1) return 0;
    var r = el.getBoundingClientRect();
    return Math.max(0, r.width) * Math.max(0, r.height);
  }

  /** 객체 그래프에서 길이 1~6, 원소가 객체(또는 null)인 배열만 수집. */
  function harvestSlotSizedArrays(value, depth, maxDepth, bucket, seenObjs) {
    if (depth > maxDepth || value == null) return;
    if (typeof value !== 'object') return;
    if (value.__v_isRef === true) {
      try {
        harvestSlotSizedArrays(value.value, depth + 1, maxDepth, bucket, seenObjs);
      } catch (e0) {}
      return;
    }
    if (Array.isArray(value)) {
      var len = value.length;
      if (len >= 1 && len <= 6) {
        var ok = true;
        var j;
        for (j = 0; j < len; j++) {
          var e = value[j];
          if (e != null && (typeof e !== 'object' || Array.isArray(e))) ok = false;
        }
        if (ok) bucket.push(value);
      }
      return;
    }
    if (seenObjs.has(value)) return;
    seenObjs.add(value);
    var keys = Object.keys(value);
    var maxK = Math.min(keys.length, 100);
    var i;
    for (i = 0; i < maxK; i++) {
      try {
        harvestSlotSizedArrays(value[keys[i]], depth + 1, maxDepth, bucket, seenObjs);
      } catch (err) {}
    }
  }

  function scorePartySlotArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > 6) return -1;
    var score = arr.length === 6 ? 28 : arr.length * 3;
    var filled = 0;
    var slotMeta = 0;
    var i;
    for (i = 0; i < arr.length; i++) {
      var s = arr[i];
      if (s == null || typeof s !== 'object') {
        score -= 12;
        continue;
      }
      if (!slotEmpty(s)) filled++;
      if ('slot' in s || 'slotIndex' in s || 'slot_index' in s || 'position' in s) slotMeta++;
      if (s.pokemon || (s.data && s.data.pokemon)) score += 22;
      var flat = flattenSlot(s);
      var fk = Object.keys(flat);
      var ki;
      for (ki = 0; ki < fk.length; ki++) {
        var k = fk[ki];
        if (/namekr|species|sample|pokemon|terastal|tera|ability|item|hold|nature|effort|stats/i.test(k)) {
          score += 4;
          break;
        }
      }
      if (fk.some(function (k2) { return /move|Move|skill|waza|technique/i.test(k2); })) score += 10;
      if (flat.stats || (s.data && s.data.stats)) score += 8;
    }
    if (slotMeta >= 2) score += 22;
    if (filled === 0 && slotMeta === 0) score -= 45;
    return score;
  }

  function arrayLooksLikePartySlots(arr) {
    return scorePartySlotArray(arr) >= 12;
  }

  function normalizePartyArrayToSix(a) {
    if (!Array.isArray(a) || a.length === 0 || a.length > 6) return null;
    return normalizeSix(a);
  }

  function slotsFromPartyLikeObject(party) {
    if (!party || typeof party !== 'object' || Array.isArray(party)) return null;
    var keys = ['slots', 'members', 'list', 'pokemon', 'mons', 'team', 'data', 'pokeSlots', 'partySlots'];
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var a = party[keys[ki]];
      if (Array.isArray(a) && a.length >= 1 && a.length <= 6 && arrayLooksLikePartySlots(a)) {
        return normalizeSix(a);
      }
    }
    return null;
  }

  function tryArraysOnVm(vm) {
    var out = [];
    var cands = [
      vm.slots,
      vm.partySlots,
      vm.party_slots,
      vm.pokemonSlots,
      vm.slotList,
      vm.$data && vm.$data.slots,
      vm.$data && vm.$data.partySlots,
      vm.$data && vm.$data.party_slots,
      vm.$data && vm.$data.pokemonSlots,
      vm.$data && vm.$data.slotList,
    ];
    var partyObjs = [vm.party, vm.$data && vm.$data.party];
    var st = vm.$store && vm.$store.state;
    if (st) {
      cands.push(st.slots);
      if (st.party) {
        partyObjs.push(st.party);
        cands.push(st.party.slots);
        cands.push(st.party.data);
      }
      cands.push(st.partySlots);
    }
    var pi;
    for (pi = 0; pi < partyObjs.length; pi++) {
      var fromP = slotsFromPartyLikeObject(partyObjs[pi]);
      if (fromP) out.push(fromP);
    }
    var i;
    for (i = 0; i < cands.length; i++) {
      var a = cands[i];
      if (Array.isArray(a) && a.length >= 1 && a.length <= 6 && arrayLooksLikePartySlots(a)) {
        out.push(normalizeSix(a));
      }
    }
    return out;
  }

  function collectFromTree(vm, depth, acc) {
    if (!vm || depth > 120) return;
    var arrs = tryArraysOnVm(vm);
    var ai;
    for (ai = 0; ai < arrs.length; ai++) {
      acc.push({ slots: arrs[ai], depth: depth, area: vmArea(vm) });
    }
    var ch = vm.$children;
    if (!ch || !ch.length) return;
    var j;
    for (j = 0; j < ch.length; j++) {
      collectFromTree(ch[j], depth + 1, acc);
    }
  }

  function dedupeArrays(bucket) {
    var seen = new WeakSet();
    var out = [];
    var i;
    for (i = 0; i < bucket.length; i++) {
      var a = bucket[i];
      if (!a || seen.has(a)) continue;
      seen.add(a);
      out.push(a);
    }
    return out;
  }

  function pickBestFromBucket(bucket) {
    var uniq = dedupeArrays(bucket);
    var best = null;
    var bestScore = -1e9;
    var i;
    for (i = 0; i < uniq.length; i++) {
      var arr = uniq[i];
      var sc = scorePartySlotArray(arr);
      if (sc > bestScore) {
        bestScore = sc;
        best = arr;
      }
    }
    if (!best || bestScore < 10) return null;
    return normalizeSix(best);
  }

  function deepHarvestIntoBucket(bucket) {
    var appEl = document.querySelector('#app');

    if (appEl && appEl.__vue__) {
      var v2 = appEl.__vue__;
      try {
        if (v2.$data) harvestSlotSizedArrays(v2.$data, 0, 7, bucket, new Set());
      } catch (e) {}
      try {
        if (v2.$store && v2.$store.state) harvestSlotSizedArrays(v2.$store.state, 0, 10, bucket, new Set());
      } catch (e2) {}
    }

    if (appEl && appEl.__vue_app__) {
      try {
        var ap = appEl.__vue_app__;
        var gp = ap.config && ap.config.globalProperties;
        if (gp) {
          var st = gp.$store;
          if (st && st.state) harvestSlotSizedArrays(st.state, 0, 10, bucket, new Set());
          var pinia = gp.$pinia;
          if (pinia && pinia.state && pinia.state.value) {
            harvestSlotSizedArrays(pinia.state.value, 0, 12, bucket, new Set());
          }
        }
      } catch (e3) {}
    }

    var nodes = document.querySelectorAll('*');
    var max = Math.min(nodes.length, 14000);
    var k;
    for (k = 0; k < max; k++) {
      var inst = nodes[k].__vueParentComponent;
      if (!inst) continue;
      try {
        if (inst.setupState) harvestSlotSizedArrays(inst.setupState, 0, 6, bucket, new Set());
      } catch (e4) {}
      try {
        if (inst.ctx) harvestSlotSizedArrays(inst.ctx, 0, 5, bucket, new Set());
      } catch (e5) {}
      try {
        if (inst.proxy) harvestSlotSizedArrays(inst.proxy, 0, 6, bucket, new Set());
      } catch (e6) {}
    }
  }

  function pickBestSlots() {
    var bucket = [];

    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      var acc = [];
      collectFromTree(app.__vue__, 0, acc);
      var ai;
      for (ai = 0; ai < acc.length; ai++) {
        bucket.push(acc[ai].slots);
      }
    }

    if (bucket.length === 0) {
      var nodes = document.querySelectorAll('*');
      var max = Math.min(nodes.length, 8000);
      var k;
      for (k = 0; k < max; k++) {
        var vm = nodes[k].__vue__;
        if (!vm) continue;
        var arrs = tryArraysOnVm(vm);
        var bi;
        for (bi = 0; bi < arrs.length; bi++) {
          bucket.push(arrs[bi]);
        }
      }
    }

    deepHarvestIntoBucket(bucket);

    return pickBestFromBucket(bucket);
  }

  function cloneSlots(slots) {
    try {
      return JSON.parse(JSON.stringify(slots));
    } catch (e) {
      return null;
    }
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== MSG_EXT || d.type !== 'NUO_TEAM_GET_SLOTS') return;
    var rid = d.requestId != null ? String(d.requestId) : '';
    var slots = pickBestSlots();
    if (!slots) {
      window.postMessage(
        {
          source: MSG_BRIDGE,
          type: 'NUO_TEAM_SLOTS_REPLY',
          requestId: rid,
          ok: false,
          error: 'no_party_slots',
          slots: null,
          filled: null,
        },
        '*'
      );
      return;
    }
    var cloned = cloneSlots(slots);
    if (!cloned) {
      window.postMessage(
        {
          source: MSG_BRIDGE,
          type: 'NUO_TEAM_SLOTS_REPLY',
          requestId: rid,
          ok: false,
          error: 'clone_failed',
          slots: null,
          filled: null,
        },
        '*'
      );
      return;
    }
    var filled = [];
    var i;
    for (i = 0; i < 6; i++) {
      filled.push(!slotEmpty(slots[i]));
    }
    window.postMessage(
      {
        source: MSG_BRIDGE,
        type: 'NUO_TEAM_SLOTS_REPLY',
        requestId: rid,
        ok: true,
        slots: cloned,
        filled: filled,
      },
      '*'
    );
  });

  window.__NUO_DUMP_TEAM_SLOTS = function () {
    var s = pickBestSlots();
    console.log('[nuo-fmt] team slots picked, filled:', s ? filledCount(s) : 0, s);
    return s;
  };

  /** 콘솔 디버그: 점수 상위 후보 배열과 첫 원소 키 요약 */
  window.__NUO_SCAN_TEAM_CANDIDATES = function () {
    var bucket = [];
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      var acc = [];
      collectFromTree(app.__vue__, 0, acc);
      var ai;
      for (ai = 0; ai < acc.length; ai++) {
        bucket.push(acc[ai].slots);
      }
    }
    deepHarvestIntoBucket(bucket);
    var uniq = dedupeArrays(bucket);
    var rows = uniq.map(function (arr) {
      var sc = scorePartySlotArray(arr);
      var first = arr[0];
      var keys0 = first && typeof first === 'object' ? Object.keys(first).slice(0, 14) : [];
      return { len: arr.length, score: sc, keysFirst: keys0.join(',') };
    });
    rows.sort(function (a, b) {
      return b.score - a.score;
    });
    console.log('[nuo-fmt] top slot-array candidates (len, score, keys of [0]):');
    console.table(rows.slice(0, 25));
    return rows;
  };
})();
