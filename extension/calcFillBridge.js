/**
 * 페이지(MAIN) 컨텍스트에서 실행됨.
 *
 * - VM: attacker/defender/pokemon_list 후보를 점수화(__NUO_DUMP). 준비된 인스턴스 최대 3개에 순차 브로드캐스트·검증 없이 빠르게 완료.
 * - 공격측만 기술 스텁을 두면 수비 loadDefender 시 상대 기술/분류 참조로 터질 수 있어 수비에도 동일 패턴 스텁.
 * - calcFillBridge.js 는 stats.*.real(실수값) 등 종족값/실수 표에 직접 쓰지 않음. effort·individual_* 만 "능력치" 쪽.
 */
(function () {
  if (window.__NUO_CALC_BRIDGE_V30__) return;
  window.__NUO_CALC_BRIDGE_V30__ = true;

  var applyQueue = [];
  var applyBusy = false;

  function isCalcVmShape(vm) {
    return !!(vm && vm.attacker && vm.defender && Array.isArray(vm.pokemon_list));
  }

  /** 부모 체인에 숨김(display:none, visibility:hidden, hidden, aria-hidden)이 있으면 false */
  function cascadeDisplayed(el) {
    var e = el;
    while (e && e.nodeType === 1) {
      if (e.hasAttribute && e.hasAttribute('hidden')) return false;
      var st = window.getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      if (st.opacity === '0') return false;
      if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return false;
      e = e.parentElement;
    }
    return true;
  }

  /**
   * 실제로 그려져 뷰포트와 겹치는 면적이 있는지. 유령 VM은 크기만 있고 visibility:hidden 이거나 화면 밖인 경우가 많음.
   * @returns {{ ok: boolean, viewportArea: number, pixelArea: number, centerDist: number }}
   */
  function vmLayoutMetrics(vm) {
    var el = vm && vm.$el;
    if (!el || el.nodeType !== 1) {
      return { ok: false, viewportArea: 0, pixelArea: 0, centerDist: 1e12 };
    }
    if (!cascadeDisplayed(el)) {
      return { ok: false, viewportArea: 0, pixelArea: 0, centerDist: 1e12 };
    }
    var rects = el.getClientRects();
    if (!rects || rects.length === 0) {
      return { ok: false, viewportArea: 0, pixelArea: 0, centerDist: 1e12 };
    }
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      return { ok: false, viewportArea: 0, pixelArea: 0, centerDist: 1e12 };
    }
    var pixelArea = r.width * r.height;
    var vx = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    var vy = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    var viewportArea = vx * vy;
    var cx = (r.left + r.right) / 2;
    var cy = (r.top + r.bottom) / 2;
    var dx = cx - window.innerWidth / 2;
    var dy = cy - window.innerHeight / 2;
    var centerDist = dx * dx + dy * dy;
    return { ok: true, viewportArea: viewportArea, pixelArea: pixelArea, centerDist: centerDist };
  }

  function collectCalcVmsFromTree(vm, depth, out) {
    if (!vm || depth > 100) return;
    if (isCalcVmShape(vm)) {
      out.push({
        vm: vm,
        depth: depth,
        hasLoad: typeof vm.loadAttacker === 'function',
        metrics: vmLayoutMetrics(vm),
      });
    }
    var ch = vm.$children;
    if (!ch || !ch.length) return;
    var i;
    for (i = 0; i < ch.length; i++) {
      collectCalcVmsFromTree(ch[i], depth + 1, out);
    }
  }

  function scoreEntry(entry) {
    var vm = entry.vm;
    var m = entry.metrics;
    var s = 0;
    if (entry.hasLoad) s += 3200;
    if (!m || !m.ok) return s - 200000;
    s += Math.min(Math.log(m.viewportArea + 1) * 3200, 32000);
    s += Math.min(Math.log(m.pixelArea + 1) * 450, 8000);
    s -= Math.min(m.centerDist / 80000, 1200);
    if (m.viewportArea < 200) s -= 6000;
    var el = vm.$el;
    if (el && el.nodeType === 1 && typeof el.innerText === 'string') {
      var t = el.innerText;
      if (t.indexOf('교체') !== -1) s += 900;
      if (t.indexOf('계산') !== -1) s += 350;
      if (t.indexOf('초기화') !== -1) s += 120;
      if (t.indexOf('수비') !== -1 || t.indexOf('방어') !== -1) s += 500;
    }
    // 스마트누오: 상위 래퍼(DIV·v-app 근처, depth 작음)와 실제 패널(v-sheet 등, depth 큼)이 둘 다 같은 모양일 수 있음.
    // 예전에는 depth 벌점으로 얕은 쪽이 소폭 우위 → 잘못된 VM 선택. 깊은 쪽(실제 UI에 붙은 인스턴스)을 가산.
    var dep = typeof entry.depth === 'number' && entry.depth >= 0 ? entry.depth : 0;
    s += Math.min(dep, 24) * 150;
    return s;
  }

  function pickBestCalcEntry(entries) {
    if (!entries || !entries.length) return null;
    var displayed = entries.filter(function (e) {
      return e.metrics && e.metrics.ok;
    });
    if (!displayed.length) {
      function rawArea(e) {
        var el = e.vm && e.vm.$el;
        if (!el || el.nodeType !== 1) return 0;
        var r = el.getBoundingClientRect();
        return Math.max(0, r.width) * Math.max(0, r.height);
      }
      entries.sort(function (a, b) {
        var ra = rawArea(a);
        var rb = rawArea(b);
        if (rb !== ra) return rb - ra;
        return scoreEntry(b) - scoreEntry(a);
      });
      return entries[0];
    }
    var inView = displayed.filter(function (e) {
      return e.metrics.viewportArea >= 300;
    });
    var pool = inView.length ? inView : displayed;
    pool.sort(function (a, b) {
      return scoreEntry(b) - scoreEntry(a);
    });
    return pool[0];
  }

  /** #app 트리에서만 수집; 없으면 DOM 전역 스캔(기존 동작). */
  function collectAllCalcVmEntries() {
    var out = [];
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      collectCalcVmsFromTree(app.__vue__, 0, out);
    }
    var seen = new Set();
    var i;
    for (i = 0; i < out.length; i++) {
      seen.add(out[i].vm);
    }
    if (out.length === 0) {
      var nodes = document.querySelectorAll('*');
      var max = Math.min(nodes.length, 12000);
      var j;
      for (j = 0; j < max; j++) {
        var vm = nodes[j].__vue__;
        if (!isCalcVmShape(vm) || seen.has(vm)) continue;
        seen.add(vm);
        out.push({
          vm: vm,
          depth: 1,
          hasLoad: typeof vm.loadAttacker === 'function',
          metrics: vmLayoutMetrics(vm),
        });
      }
    }
    return out;
  }

  /**
   * 트리 + DOM 스캔을 합친 전체 후보(유령·중복 포함). 콘솔 디버그용.
   */
  function collectCalcVmEntriesMerged() {
    var out = [];
    var seen = new Set();
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      collectCalcVmsFromTree(app.__vue__, 0, out);
    }
    var i;
    for (i = 0; i < out.length; i++) {
      seen.add(out[i].vm);
    }
    var nodes = document.querySelectorAll('*');
    var max = Math.min(nodes.length, 12000);
    var j;
    for (j = 0; j < max; j++) {
      var vm = nodes[j].__vue__;
      if (!isCalcVmShape(vm) || seen.has(vm)) continue;
      seen.add(vm);
      out.push({
        vm: vm,
        depth: -1,
        hasLoad: typeof vm.loadAttacker === 'function',
        metrics: vmLayoutMetrics(vm),
        fromDomScan: true,
      });
    }
    return out;
  }

  function describeCalcVmEntry(entry, bestVm) {
    var vm = entry.vm;
    var opts = vm.$options || {};
    var el = vm.$el;
    var m = entry.metrics || {};
    var pn = vm.$parent;
    var pOpts = pn && pn.$options;
    return {
      pickedHere: vm === bestVm,
      treeDepth: entry.depth,
      domOnlyFind: !!entry.fromDomScan,
      vueUid: vm._uid,
      optName: opts.name || '',
      optFile: opts.__file || '',
      ctor: vm.constructor && vm.constructor.name,
      parentName: (pOpts && pOpts.name) || '',
      isRoot: vm.$root === vm,
      score: Math.round(scoreEntry(entry) * 10) / 10,
      vpArea: Math.round(m.viewportArea || 0),
      pxArea: Math.round(m.pixelArea || 0),
      metricsOk: !!m.ok,
      atkName: String((vm.attacker && vm.attacker.name) || '').slice(0, 40),
      defName: String((vm.defender && vm.defender.name) || '').slice(0, 40),
      plLen: vm.pokemon_list ? vm.pokemon_list.length : 0,
      elTag: el && el.tagName,
      elId: (el && el.id) || '',
      elClass: el && el.className && String(el.className).replace(/\s+/g, ' ').slice(0, 96),
    };
  }

  /**
   * 스마트누오 계산기 탭에서 DevTools 콘솔에 실행: 후보별 Vue 메타·레이아웃·현재 공/수 이름.
   * 확장이 브리지를 주입한 뒤(계산기 입력 한 번 실행 후)에 호출하는 것이 안전.
   */
  window.__NUO_DUMP_CALC_VMS = function () {
    var entries = collectCalcVmEntriesMerged();
    var best = pickBestCalcEntry(entries.slice());
    var bestVm = best && best.vm;
    var rows = entries.map(function (e) {
      return describeCalcVmEntry(e, bestVm);
    });
    rows.sort(function (a, b) {
      return b.score - a.score;
    });
    console.log(
      '[nuo-fmt] damage-calc Vue candidates:',
      rows.length,
      '| pickedHere = 확장이 고르는 VM'
    );
    console.table(rows);
    return rows;
  };

  function findCalcVm() {
    var out = collectAllCalcVmEntries();
    if (out.length === 0) return null;
    var best = pickBestCalcEntry(out);
    return best ? best.vm : null;
  }

  function isCalculatorContext() {
    var t = document.body && document.body.innerText;
    if (!t) return false;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
  }

  /**
   * 스마트누오 도감: 샘플은 실드폼 한글명만 오는데, 공격측은 블레이드폼 엔트리를 써야 할 종.
   * 수비측은 원본 speciesKo 그대로(pickPokemonEn 에 defender 만 넘김).
   */
  var ATTACKER_SPECIES_KO_REMAP = {
    킬가르도: '킬가르도 (블레이드)',
  };

  function speciesKoForAttacker(speciesKo) {
    var k = String(speciesKo || '').trim();
    if (!k) return speciesKo;
    var mapped = ATTACKER_SPECIES_KO_REMAP[k];
    return mapped || speciesKo;
  }

  function pickPokemonEn(vm, speciesKo) {
    if (!speciesKo || !vm.pokemon_list) return speciesKo;
    var pl = vm.pokemon_list;
    var pi;
    for (pi = 0; pi < pl.length; pi++) {
      var p = pl[pi];
      if (p && p.kr === speciesKo) {
        return p.en ? p.en : speciesKo;
      }
    }
    return speciesKo;
  }

  function clampEv(n) {
    n = n | 0;
    if (n < 0) return 0;
    if (n > 252) return 252;
    return n;
  }

  function normName(x) {
    return String(x == null ? '' : x)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  /**
   * 스마트누오 데미지계산기(Common 번들): v-select 가 attacker.weather / attacker.field 에 한글 문자열로 바인딩됨.
   * weather_list: 모래바람, 설경, 쾌청, 비바라기 — field_list: 그래스필드, 미스트필드, 사이코필드, 일렉트릭필드
   */
  var WX_INTERNAL_TO_NUO = {
    sun: '쾌청',
    rain: '비바라기',
    sand: '모래바람',
    snow: '설경',
    strongwinds: '',
  };

  var FIELD_INTERNAL_TO_NUO = {
    electric: '일렉트릭필드',
    grassy: '그래스필드',
    misty: '미스트필드',
    psychic: '사이코필드',
  };

  function wxSlotLooksEmpty(v) {
    if (v == null || v === '') return true;
    if (typeof v !== 'string') return false;
    var d = v.trim().toLowerCase();
    if (!d) return true;
    if (d === 'none' || d === 'null' || d === '없음' || d === '--') return true;
    return false;
  }

  function wxReadWeather(vm) {
    return vm && vm.attacker ? vm.attacker.weather : null;
  }

  function wxReadField(vm) {
    return vm && vm.attacker ? vm.attacker.field : null;
  }

  function wxApplyWeather(vm, internalKey) {
    if (!vm || !vm.attacker || !internalKey) return;
    var ko = WX_INTERNAL_TO_NUO[String(internalKey).toLowerCase().trim()];
    if (!ko) return;
    try {
      vm.$set(vm.attacker, 'weather', ko);
    } catch (e) {}
  }

  function wxApplyField(vm, internalKey) {
    if (!vm || !vm.attacker || !internalKey) return;
    var ko = FIELD_INTERNAL_TO_NUO[String(internalKey).toLowerCase().trim()];
    if (!ko) return;
    try {
      vm.$set(vm.attacker, 'field', ko);
    } catch (e) {}
  }

  /**
   * 페이로드: abilityWeatherKey / abilityTerrainKey (modifiers.json setsWeather / setsTerrain).
   * 공격측: 날씨·필드 각각 있으면 항상 반영. 수비측: 해당 슬롯이 비어 있을 때만 반영(날씨·필드 독립).
   */
  function applyWeatherAndTerrain(vm, pa, pd) {
    if (!vm) return;
    try {
      if (pa && !pa.error) {
        if (pa.abilityWeatherKey) wxApplyWeather(vm, pa.abilityWeatherKey);
        if (pa.abilityTerrainKey) wxApplyField(vm, pa.abilityTerrainKey);
      }
      if (pd && !pd.error) {
        if (pd.abilityWeatherKey && wxSlotLooksEmpty(wxReadWeather(vm))) {
          wxApplyWeather(vm, pd.abilityWeatherKey);
        }
        if (pd.abilityTerrainKey && wxSlotLooksEmpty(wxReadField(vm))) {
          wxApplyField(vm, pd.abilityTerrainKey);
        }
      }
    } catch (eWx) {}
  }

  /** 스마트누오 데미지계산기: move.damage_class 는 "physical"|"special"|"status" 문자열로 비교함 (객체 아님). */
  function smartNuoMoveDamageClassStr(physical) {
    return physical ? 'physical' : 'special';
  }

  function patchMoveDamageClass(vm, moveObj, physical) {
    if (!moveObj || typeof moveObj !== 'object') return;
    var dcStr = smartNuoMoveDamageClassStr(physical);
    vm.$set(moveObj, 'damage_class', dcStr);
  }

  function ensureSideMovePlaceholder(vm, side, physical) {
    var mon = side === 'defender' ? vm.defender : vm.attacker;
    if (!mon) return;
    var stub = {
      name: 'tackle',
      kr: '몸통박치기',
      power: 40,
      type: '노말',
      damage_class: smartNuoMoveDamageClassStr(physical),
    };
    var propNames = ['move', 'skill', 'technique', 'selectedMove', 'attackMove', 'currentMove'];
    var i;
    for (i = 0; i < propNames.length; i++) {
      var k = propNames[i];
      if (!Object.prototype.hasOwnProperty.call(mon, k)) continue;
      var cur = mon[k];
      if (cur == null || typeof cur !== 'object') {
        vm.$set(mon, k, Object.assign({}, stub));
      } else {
        patchMoveDamageClass(vm, cur, physical);
      }
    }
    if (mon.move == null || typeof mon.move !== 'object') {
      vm.$set(mon, 'move', Object.assign({}, stub));
    } else {
      patchMoveDamageClass(vm, mon.move, physical);
    }
    if (Array.isArray(mon.moves)) {
      for (i = 0; i < mon.moves.length; i++) {
        if (mon.moves[i] && typeof mon.moves[i] === 'object') patchMoveDamageClass(vm, mon.moves[i], physical);
      }
    }
    ['attacks', 'skills', 'techniques'].forEach(function (arrKey) {
      var arr = mon[arrKey];
      if (!Array.isArray(arr)) return;
      var j;
      for (j = 0; j < arr.length; j++) {
        if (arr[j] && typeof arr[j] === 'object') patchMoveDamageClass(vm, arr[j], physical);
      }
    });
  }

  function ensureAttackerMovePlaceholder(vm, physical) {
    ensureSideMovePlaceholder(vm, 'attacker', physical);
  }

  function ensureDefenderMovePlaceholder(vm, physical) {
    ensureSideMovePlaceholder(vm, 'defender', physical);
  }

  function applyAttackerMovePayload(vm, mp) {
    if (!mp || !vm.attacker) return;
    var dcStr = mp.damageClass === 'special' ? 'special' : 'physical';
    var enToKo = {
      normal: '노말',
      fire: '불꽃',
      water: '물',
      grass: '풀',
      electric: '전기',
      ice: '얼음',
      fighting: '격투',
      poison: '독',
      ground: '땅',
      flying: '비행',
      psychic: '에스퍼',
      bug: '벌레',
      rock: '바위',
      ghost: '고스트',
      dragon: '드래곤',
      dark: '악',
      steel: '강철',
      fairy: '페어리',
      stellar: '스텔라',
    };
    var moveTypeKoSet = Object.create(null);
    var sk;
    for (sk in enToKo) {
      if (Object.prototype.hasOwnProperty.call(enToKo, sk)) moveTypeKoSet[enToKo[sk]] = 1;
    }
    var typeKo = mp.typeKo != null ? String(mp.typeKo).trim() : '';
    if (!typeKo && mp.type && typeof mp.type === 'object' && mp.type.kr != null) {
      typeKo = String(mp.type.kr).trim();
    }
    if (!typeKo && mp.type && typeof mp.type === 'object' && mp.type.name != null) {
      var nm = String(mp.type.name).trim();
      var nml = nm.toLowerCase();
      if (enToKo[nml]) typeKo = enToKo[nml];
      else if (moveTypeKoSet[nm]) typeKo = nm;
    }
    if (!typeKo && typeof mp.type === 'string') {
      var ts = String(mp.type).trim().toLowerCase();
      if (enToKo[ts]) typeKo = enToKo[ts];
    }
    if (!typeKo) {
      var typeEn = String(
        mp.typeEn != null
          ? mp.typeEn
          : mp.type && typeof mp.type === 'object' && mp.type.en != null
            ? mp.type.en
            : 'normal'
      ).toLowerCase();
      typeKo = enToKo[typeEn] || '노말';
    }
    var merged = {
      name: mp.name || 'tackle',
      kr: mp.kr || '',
      power: mp.power != null ? mp.power | 0 : 40,
      type: typeKo,
      damage_class: dcStr,
    };
    vm.$set(vm.attacker, 'move', merged);
    try {
      if (typeof vm.damage_class_update_handler === 'function') {
        vm.damage_class_update_handler(dcStr);
      } else if (Object.prototype.hasOwnProperty.call(vm, 'damage_class')) {
        vm.$set(vm, 'damage_class', dcStr);
      }
    } catch (eSync) {}
    try {
      if (typeof vm.$nextTick === 'function') {
        vm.$nextTick(function () {
          try {
            if (typeof vm.loadMove === 'function') vm.loadMove();
          } catch (eLm) {}
        });
      } else if (typeof vm.loadMove === 'function') {
        vm.loadMove();
      }
    } catch (eTick) {}
  }

  function trySyncDerived(vm) {
    try {
      if (typeof vm.syncNuoDamageDerivedState === 'function') {
        vm.syncNuoDamageDerivedState();
      }
    } catch (e) {}
  }

  function applyAttackerScalars(vm, payload, physical) {
    var evs = payload.evs && payload.evs.length >= 6 ? payload.evs : [0, 0, 0, 0, 0, 0];
    var ivs = payload.ivs || [31, 31, 31, 31, 31, 31];
    vm.$set(vm.attacker, 'effort', clampEv(physical ? evs[1] : evs[3]));
    vm.$set(vm.attacker, 'individual_value', physical ? ivs[1] | 0 : ivs[3] | 0);
    if (payload.level != null && payload.level > 0) vm.$set(vm.attacker, 'level', payload.level | 0);
    if (payload.abilityKo) vm.$set(vm.attacker, 'ability', payload.abilityKo);
    if (payload.itemKo) vm.$set(vm.attacker, 'equipment', payload.itemKo);
    var ap = payload.attackerPersonality;
    if (ap === 0.9 || ap === 1 || ap === 1.1) vm.$set(vm.attacker, 'personality', ap);
  }

  function applyDefenderScalars(vm, payload, physicalIncoming) {
    var evs = payload.evs && payload.evs.length >= 6 ? payload.evs : [0, 0, 0, 0, 0, 0];
    var ivs = payload.ivs || [31, 31, 31, 31, 31, 31];
    vm.$set(vm.defender, 'effort_for_hp', clampEv(evs[0]));
    vm.$set(vm.defender, 'effort_for_defend', clampEv(physicalIncoming ? evs[2] : evs[4]));
    vm.$set(vm.defender, 'individual_value_for_hp', ivs[0] | 0);
    vm.$set(vm.defender, 'individual_value_for_defend', physicalIncoming ? ivs[2] | 0 : ivs[4] | 0);
    var dp = payload.defenderPersonality;
    if (dp === 0.9 || dp === 1 || dp === 1.1) vm.$set(vm.defender, 'personality', dp);
    if (payload.level != null && payload.level > 0) vm.$set(vm.defender, 'level', payload.level | 0);
    if (payload.abilityKo) vm.$set(vm.defender, 'ability', payload.abilityKo);
    if (payload.itemKo) vm.$set(vm.defender, 'equipment', payload.itemKo);
  }

  function syncScalars(vm, pa, pd, physAtk, hasD, physDefIncoming) {
    if (physDefIncoming === undefined || physDefIncoming === null) physDefIncoming = physAtk;
    ensureAttackerMovePlaceholder(vm, physAtk);
    if (hasD) ensureDefenderMovePlaceholder(vm, physAtk);
    if (pa) applyAttackerScalars(vm, pa, physAtk);
    if (hasD && pd) applyDefenderScalars(vm, pd, physDefIncoming);
  }

  function postResult(result, requestId) {
    window.postMessage(
      {
        source: 'nuo-calc-page',
        type: 'NUO_CALC_RESULT',
        requestId: requestId,
        ok: result.ok,
        error: result.error,
        warnings: result.warnings,
      },
      '*'
    );
  }

  /** SPA·데이터 로딩: VM만 잡히고 pokemon_list 가 비어 있으면 pickPokemonEn 이 한글 그대로 들어가 로드가 실패하는 경우가 있음. */
  var CALC_READY_MAX_ATTEMPTS = 55;
  var CALC_READY_INTERVAL_MS = 85;

  function calcShellReady(vm) {
    if (!vm || !isCalcVmShape(vm)) return false;
    if (!vm.pokemon_list || !vm.pokemon_list.length) return false;
    var ctxOk = isCalculatorContext();
    if (ctxOk) return true;
    return typeof vm.loadAttacker === 'function' && typeof vm.loadDefender === 'function';
  }

  var MAX_CALC_BROADCAST_VMS = 3;

  function collectBroadcastTargets() {
    var entries = collectCalcVmEntriesMerged().filter(function (e) {
      return calcShellReady(e.vm);
    });
    var seen = new Set();
    var uniq = [];
    var i;
    for (i = 0; i < entries.length; i++) {
      var ent = entries[i];
      if (!ent.vm || seen.has(ent.vm)) continue;
      seen.add(ent.vm);
      uniq.push(ent);
    }
    uniq.sort(function (a, b) {
      return scoreEntry(b) - scoreEntry(a);
    });
    var vms = [];
    for (i = 0; i < uniq.length && i < MAX_CALC_BROADCAST_VMS; i++) {
      vms.push(uniq[i].vm);
    }
    return vms;
  }

  function waitForCalcTargets(then) {
    var n = 0;
    function tick() {
      n++;
      var vms = collectBroadcastTargets();
      if (vms.length > 0) {
        then(vms);
        return;
      }
      if (n >= CALC_READY_MAX_ATTEMPTS) {
        then(null);
        return;
      }
      setTimeout(tick, CALC_READY_INTERVAL_MS);
    }
    tick();
  }

  function runApplyCalcFillBroadcast(job, vms, done) {
    if (!vms || !vms.length) {
      done({ ok: false, error: 'vue_calc_not_found' });
      return;
    }
    var idx = 0;
    var anyOk = false;
    var mergedWarnings = [];
    var lastErr = null;
    function step() {
      if (idx >= vms.length) {
        if (anyOk) {
          done({ ok: true, warnings: mergedWarnings.length ? mergedWarnings : undefined });
        } else {
          done({
            ok: false,
            error: lastErr || 'calc_broadcast_all_failed',
            warnings: mergedWarnings.length ? mergedWarnings : undefined,
          });
        }
        return;
      }
      var vm = vms[idx++];
      runApplyCalcFillCoreOneVm(job, vm, function (r) {
        if (r && r.ok) {
          anyOk = true;
          if (r.warnings && r.warnings.length) {
            var wi;
            for (wi = 0; wi < r.warnings.length; wi++) {
              mergedWarnings.push(r.warnings[wi]);
            }
          }
        } else {
          if (r && r.error) lastErr = r.error;
          if (r && r.warnings && r.warnings.length) {
            var wj;
            for (wj = 0; wj < r.warnings.length; wj++) {
              mergedWarnings.push(r.warnings[wj]);
            }
          }
        }
        step();
      });
    }
    step();
  }

  function runApplyCalcFill(job, done) {
    waitForCalcTargets(function (vms) {
      if (!vms || !vms.length) {
        var cand = collectCalcVmEntriesMerged();
        var anyVm = null;
        var hi;
        for (hi = 0; hi < cand.length; hi++) {
          if (cand[hi].vm && isCalcVmShape(cand[hi].vm)) {
            anyVm = cand[hi].vm;
            break;
          }
        }
        if (!anyVm) {
          done({ ok: false, error: 'vue_calc_not_found' });
        } else if (!anyVm.pokemon_list || !anyVm.pokemon_list.length) {
          done({ ok: false, error: 'calc_dex_not_ready' });
        } else {
          done({ ok: false, error: 'not_calculator_view' });
        }
        return;
      }
      runApplyCalcFillBroadcast(job, vms, done);
    });
  }

  function runApplyCalcFillCoreOneVm(job, vm, done) {
    var payloads = job.payloads || {};
    var onlyAttacker = !!job.onlyAttacker;
    var onlyDefender = !!job.onlyDefender;

    var warnings = [];

    var paFull = payloads.attacker && !payloads.attacker.error ? payloads.attacker : null;
    var pdFull = payloads.defender && !payloads.defender.error ? payloads.defender : null;

    var physAtk = true;
    var physDef = true;
    if (paFull) {
      physAtk = paFull.physicalMove !== false;
      if (pdFull && typeof pdFull.incomingPhysical === 'boolean') physDef = pdFull.incomingPhysical;
      else physDef = physAtk;
    } else if (pdFull && typeof pdFull.incomingPhysical === 'boolean') {
      physAtk = pdFull.incomingPhysical;
      physDef = pdFull.incomingPhysical;
    }

    var hasA = !!paFull && !onlyDefender;
    var hasD = !!pdFull && !onlyAttacker;

    if (payloads.attacker && payloads.attacker.error) {
      warnings.push('공격측:' + payloads.attacker.error);
    }
    if (payloads.defender && payloads.defender.error) {
      warnings.push('수비측:' + payloads.defender.error);
    }

    if (!hasA && !hasD) {
      done({ ok: false, error: 'no_valid_payload', warnings: warnings });
      return;
    }

    var pa = hasA ? paFull : null;
    var pd = hasD ? pdFull : null;

    var RESYNC_TAIL_MS = 90;

    function finishSuccess() {
      trySyncDerived(vm);
      done({ ok: true, warnings: warnings });
    }

    function scheduleDelayedResyncThenFinish(pax, pdx) {
      setTimeout(function () {
        try {
          syncScalars(vm, pax, pdx, physAtk, !!pdx, physDef);
          applyWeatherAndTerrain(vm, pax, pdx);
          trySyncDerived(vm);
          finishSuccess();
        } catch (e) {
          done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
        }
      }, RESYNC_TAIL_MS);
    }

    try {
      if (hasA) {
        vm.$set(vm.attacker, 'name', pickPokemonEn(vm, speciesKoForAttacker(pa.speciesKo)));
        ensureAttackerMovePlaceholder(vm, physAtk);
        if (typeof vm.loadAttacker === 'function') vm.loadAttacker();
        ensureAttackerMovePlaceholder(vm, physAtk);
        vm.$nextTick(function () {
          try {
            ensureAttackerMovePlaceholder(vm, physAtk);
            vm.$set(vm.attacker, 'name', pickPokemonEn(vm, speciesKoForAttacker(pa.speciesKo)));
            applyAttackerScalars(vm, pa, physAtk);
            if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
            vm.$nextTick(function () {
              try {
                ensureAttackerMovePlaceholder(vm, physAtk);
                vm.$set(vm.attacker, 'name', pickPokemonEn(vm, speciesKoForAttacker(pa.speciesKo)));
                if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
                if (hasD) {
                  ensureDefenderMovePlaceholder(vm, physAtk);
                  vm.$set(vm.defender, 'name', pickPokemonEn(vm, pd.speciesKo));
                  if (typeof vm.loadDefender === 'function') vm.loadDefender();
                  ensureDefenderMovePlaceholder(vm, physAtk);
                  vm.$nextTick(function () {
                    try {
                      ensureDefenderMovePlaceholder(vm, physAtk);
                      vm.$set(vm.defender, 'name', pickPokemonEn(vm, pd.speciesKo));
                      applyDefenderScalars(vm, pd, physDef);
                      vm.$nextTick(function () {
                        try {
                          syncScalars(vm, pa, pd, physAtk, true, physDef);
                          if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
                          trySyncDerived(vm);
                          scheduleDelayedResyncThenFinish(pa, pd);
                        } catch (e) {
                          done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
                        }
                      });
                    } catch (e) {
                      done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
                    }
                  });
                } else {
                  syncScalars(vm, pa, null, physAtk, false);
                  if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
                  trySyncDerived(vm);
                  scheduleDelayedResyncThenFinish(pa, null);
                }
              } catch (e) {
                done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
              }
            });
          } catch (e) {
            done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
          }
        });
      } else if (hasD) {
        var pdOnly = pd;
        ensureAttackerMovePlaceholder(vm, physAtk);
        ensureDefenderMovePlaceholder(vm, physAtk);

        function applyDefenderBranch() {
          vm.$set(vm.defender, 'name', pickPokemonEn(vm, pdOnly.speciesKo));
          ensureDefenderMovePlaceholder(vm, physAtk);
          if (typeof vm.loadDefender === 'function') vm.loadDefender();
          ensureDefenderMovePlaceholder(vm, physAtk);
          vm.$nextTick(function () {
            try {
              ensureAttackerMovePlaceholder(vm, physAtk);
              ensureDefenderMovePlaceholder(vm, physAtk);
              vm.$set(vm.defender, 'name', pickPokemonEn(vm, pdOnly.speciesKo));
              applyDefenderScalars(vm, pdOnly, physDef);
              vm.$nextTick(function () {
                try {
                  syncScalars(vm, null, pdOnly, physAtk, true, physDef);
                  trySyncDerived(vm);
                  scheduleDelayedResyncThenFinish(null, pdOnly);
                } catch (e) {
                  done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
                }
              });
            } catch (e) {
              done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
            }
          });
        }

        var atkEmpty = !normName(vm.attacker && vm.attacker.name);
        if (atkEmpty && vm.pokemon_list && vm.pokemon_list[0]) {
          var ph =
            (vm.pokemon_list[0].en && String(vm.pokemon_list[0].en).trim()) ||
            (vm.pokemon_list[0].kr && String(vm.pokemon_list[0].kr).trim()) ||
            'pikachu';
          vm.$set(vm.attacker, 'name', ph);
          ensureAttackerMovePlaceholder(vm, physAtk);
          if (typeof vm.loadAttacker === 'function') vm.loadAttacker();
          ensureAttackerMovePlaceholder(vm, physAtk);
          vm.$nextTick(function () {
            setTimeout(applyDefenderBranch, 70);
          });
        } else {
          applyDefenderBranch();
        }
      }
    } catch (e) {
      done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
    }
  }

  function pumpQueue() {
    if (applyBusy || applyQueue.length === 0) return;
    applyBusy = true;
    var job = applyQueue.shift();
    var rid = job.requestId;

    function finish(result) {
      postResult(result, rid);
      applyBusy = false;
      pumpQueue();
    }

    try {
      runApplyCalcFill(job, finish);
    } catch (e) {
      finish({ ok: false, error: String((e && e.message) || e) });
    }
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'nuo-calc-ext' || d.type !== 'NUO_APPLY_CALC_V30') return;
    var rid = d.requestId != null ? d.requestId : '';
    applyQueue.push({
      payloads: d.payloads,
      requestId: rid,
      onlyAttacker: !!d.onlyAttacker,
      onlyDefender: !!d.onlyDefender,
    });
    pumpQueue();
  });
})();
