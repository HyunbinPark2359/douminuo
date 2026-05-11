/**
 * 페이지(MAIN) 컨텍스트에서 실행됨.
 *
 * Phase 2.A (2026-05-09): 스마트누오 Nuxt 3 — Vue 인스턴스 대신 `window.__NUXT__.state` 의
 * useState payload 에 attacker/defender 를 직접 쓴다. (RENEWAL_FIX_PLAN §15.2~15.3)
 *
 * 격리: isolated world 의 calcFill.js 가 postMessage 로 NUO_APPLY_CALC_V30 보내면
 * 본 파일이 NUO_CALC_RESULT 로 응답한다. 프로토콜 유지.
 */
(function () {
  if (window.__NUO_CALC_BRIDGE_V36__) return;
  window.__NUO_CALC_BRIDGE_V36__ = true;

  var KEY_POKE_LIST = '$spokemon_list';
  var KEY_ATT = '$scalculator.attacker';
  var KEY_DEF = '$scalculator.defender';

  var applyQueue = [];
  var applyBusy = false;

  /** 스마트누오 도감: 공격측 블레이드폼 remap */
  var ATTACKER_SPECIES_KO_REMAP = {
    킬가르도: '킬가르도 (블레이드)',
  };

  function speciesKoForAttacker(speciesKo) {
    var k = String(speciesKo || '').trim();
    if (!k) return speciesKo;
    var mapped = ATTACKER_SPECIES_KO_REMAP[k];
    return mapped || speciesKo;
  }

  function clampEv(n) {
    n = n | 0;
    if (n < 0) return 0;
    if (n > 252) return 252;
    return n;
  }

  function num(x) {
    var n = parseInt(String(x), 10);
    return isNaN(n) ? 0 : n;
  }

  /**
   * @returns {object|null}
   */
  function getNuxtState() {
    try {
      var nx = window.__NUXT__;
      if (!nx) return null;
      if (nx.state && typeof nx.state === 'object') return nx.state;
      var pl = nx.payload;
      if (pl && pl.state && typeof pl.state === 'object') return pl.state;
      return null;
    } catch (e) {
      return null;
    }
  }

  function isCalculatorContext() {
    var p = '/';
    try {
      p = (location.pathname || '/').replace(/\/+$/, '') || '/';
    } catch (eCtx) {
      return false;
    }
    if (p === '/' || p === '/index' || p.indexOf('/index.') === 0) return true;
    if (p === '/speed' || p.indexOf('/speed/') === 0) return true;
    return false;
  }

  function calcShellReady(state) {
    if (!state) return false;
    var pl = state[KEY_POKE_LIST];
    if (!Array.isArray(pl) || pl.length === 0) return false;
    var att = state[KEY_ATT];
    var def = state[KEY_DEF];
    if (!att || typeof att !== 'object' || !def || typeof def !== 'object') return false;
    return isCalculatorContext();
  }

  /** 한글 종명 1순위, share URL 에 영문 slug 만 온 경우 id / smogon_id / name 폴백. */
  function findPokemonEntry(state, species) {
    var list = state[KEY_POKE_LIST];
    if (!Array.isArray(list)) return null;
    var k = String(species || '').trim();
    if (!k) return null;
    var kLow = k.toLowerCase();
    var i;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      if (p && String(p.kr || '').trim() === k) return p;
    }
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (!p) continue;
      if (String(p.id || '').toLowerCase() === kLow) return p;
      if (String(p.smogon_id || '').toLowerCase() === kLow) return p;
      // 구버전 공유 URL: 슬롯 pokemon.name_kr 가 비고 슬러그(예: mimikyu-disguised)가
      // species 로 흘러올 때, $spokemon_list entry 는 id='mimikyu' 지만 db_en 에 폼 슬러그가 들어있음.
      if (String(p.db_en || '').toLowerCase() === kLow) return p;
      if (String(p.name || '').toLowerCase() === kLow) return p;
    }
    return null;
  }

  function deriveSprite(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.sprite) return String(entry.sprite);
    var id = entry.id != null ? entry.id : entry.smogon_id;
    if (id != null) {
      return (
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' +
        num(id) +
        '.png'
      );
    }
    return '';
  }

  function defaultEvsIvs(evs, ivs) {
    var e = evs && evs.length >= 6 ? evs : [0, 0, 0, 0, 0, 0];
    var iv = ivs && ivs.length >= 6 ? ivs : [31, 31, 31, 31, 31, 31];
    return { evs: e, ivs: iv };
  }

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

  function wxApplyWeather(att, internalKey) {
    if (!att || !internalKey) return;
    var ko = WX_INTERNAL_TO_NUO[String(internalKey).toLowerCase().trim()];
    if (!ko) return;
    att.weather = ko;
  }

  function wxApplyField(att, internalKey) {
    if (!att || !internalKey) return;
    var ko = FIELD_INTERNAL_TO_NUO[String(internalKey).toLowerCase().trim()];
    if (!ko) return;
    att.field = ko;
  }

  function applyWeatherAndTerrain(att, pa, pd) {
    if (!att) return;
    try {
      if (pa && !pa.error) {
        if (pa.abilityWeatherKey) wxApplyWeather(att, pa.abilityWeatherKey);
        if (pa.abilityTerrainKey) wxApplyField(att, pa.abilityTerrainKey);
      }
      if (pd && !pd.error) {
        if (pd.abilityWeatherKey && wxSlotLooksEmpty(att.weather)) {
          wxApplyWeather(att, pd.abilityWeatherKey);
        }
        if (pd.abilityTerrainKey && wxSlotLooksEmpty(att.field)) {
          wxApplyField(att, pd.abilityTerrainKey);
        }
      }
    } catch (eWx) {}
  }

  /** NUXT 의 state + data 양쪽에서 도감 배열 검색 — ability/equipment 는 dump 상 data 측에만 있음. */
  function lookupDexArray(state, key) {
    if (state && Array.isArray(state[key])) return state[key];
    try {
      var nx = typeof window !== 'undefined' ? window.__NUXT__ : null;
      if (nx && nx.data && Array.isArray(nx.data[key])) return nx.data[key];
    } catch (e) {}
    return null;
  }

  function lookupAbilityObj(state, kr, defenderSide) {
    var key = defenderSide ? 'ability.cal_def' : 'ability.cal_att';
    var arr = lookupDexArray(state, key);
    var k = String(kr || '').trim();
    if (!k) return { en: '?', kr: '' };
    if (!arr) return { en: '?', kr: k };
    var i;
    for (i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (a && String(a.kr || '').trim() === k) return a;
    }
    return { en: '?', kr: k };
  }

  function lookupEquipmentObj(state, kr, defenderSide) {
    var key = defenderSide ? 'equipment.cal_def' : 'equipment.cal_att';
    var arr = lookupDexArray(state, key);
    var k = String(kr || '').trim();
    if (!k) return { en: '?', kr: '' };
    if (!arr) return { en: '?', kr: k };
    var i;
    for (i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (a && String(a.kr || '').trim() === k) return a;
    }
    return { en: '?', kr: k };
  }

  /** Nuxt 는 `$smove_dex.row_map` 처럼 점 포함 단일 키. kr_map 은 slug → 한글. */
  function findMoveRow(state, mp) {
    if (!mp) return null;
    var rm = state['$smove_dex.row_map'];
    var km = state['$smove_dex.kr_map'];
    if (rm && mp.name) {
      var slug = String(mp.name).trim();
      if (slug && rm[slug]) return rm[slug];
      // 사이트 row_map 키는 dash 제거 slug. SW 페이로드는 play-rough 처럼 dash 포함 가능.
      var noDash = slug.replace(/-/g, '');
      if (noDash && noDash !== slug && rm[noDash]) return rm[noDash];
    }
    var krStr = String(mp.kr || '').trim();
    if (km && krStr) {
      var key;
      for (key in km) {
        if (Object.prototype.hasOwnProperty.call(km, key) && km[key] === krStr) {
          if (rm && rm[key]) return rm[key];
          break;
        }
      }
    }
    return null;
  }

  /** 사이트 STAB 판정이 move.type.en 과 attacker.types[i] 를 대소문자까지 동일 비교함 → 영문 타입은 PascalCase 로 맞춤. */
  function capitalizeType(s) {
    if (!s) return '';
    var t = String(s).trim();
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  /** 사이트 기대: move.name 은 도감 row 객체, damage_class 는 대문자 시작. */
  function buildMoveObject(row, mp, physAtk) {
    var dcStr = 'Physical';
    if (physAtk === false) dcStr = 'Special';
    else if (physAtk === true) dcStr = 'Physical';
    else if (mp && mp.damageClass === 'special') dcStr = 'Special';
    else if (mp && mp.damageClass === 'physical') dcStr = 'Physical';

    // typeEn: nested mp.type.en → SW top-level mp.typeEn (소문자) → row.type 문자열. 기본 'Normal' 은 전부 실패 후.
    var typeEn = '';
    var typeKo = '';
    if (mp && mp.type && typeof mp.type === 'object') {
      if (mp.type.kr) typeKo = String(mp.type.kr).trim();
      if (mp.type.en) typeEn = capitalizeType(mp.type.en);
    }
    if (!typeKo && mp && mp.typeKo) typeKo = String(mp.typeKo).trim();
    if (!typeEn && mp && mp.typeEn) typeEn = capitalizeType(mp.typeEn);
    if (!typeKo && row && row.type) {
      if (typeof row.type === 'object' && row.type.kr) typeKo = String(row.type.kr).trim();
      else if (typeof row.type === 'string') typeKo = row.type;
    }
    if (!typeEn && row && typeof row.type === 'string') {
      typeEn = capitalizeType(row.type);
    }
    if (!typeEn) typeEn = 'Normal';
    if (!typeKo) typeKo = '노말';

    // SW 가 보낸 rich row 가 있으면 최우선. 사이트 특성(rule)이 flags.punch 등을 본다 —
    // row_map placeholder 는 flags 가 없어 철주먹 등 배율이 빠짐.
    var nameObj;
    if (mp && mp.richNameRow && typeof mp.richNameRow === 'object') {
      nameObj = mp.richNameRow;
    } else if (row && typeof row === 'object') {
      nameObj = row;
    } else {
      nameObj = {
        id: (mp && mp.name) || '',
        name: '',
        kr: (mp && mp.kr) || '',
        type: typeEn,
        basePower: (mp && mp.power | 0) || 40,
      };
    }

    var power =
      mp && mp.power != null ? mp.power | 0 : row && row.basePower != null ? row.basePower | 0 : 40;

    return {
      name: nameObj,
      type: { en: typeEn, kr: typeKo },
      power: power,
      damage_class: dcStr,
    };
  }

  function inferIncomingPhysicalFromAttacker(att) {
    if (!att || !att.move) return null;
    var dc = String(att.move.damage_class || '').toLowerCase();
    if (dc === 'special') return false;
    if (dc === 'physical') return true;
    return null;
  }

  function applyAttackerFromPayload(state, pa, physAtk, warnings) {
    var att = state[KEY_ATT];
    var species = speciesKoForAttacker(pa.speciesKo);
    var entry = findPokemonEntry(state, species);
    if (!entry) {
      return { ok: false, error: 'species_not_in_dex' };
    }

    att.name = entry;
    if (entry.types) att.types = entry.types;
    att.sprite = deriveSprite(entry);

    var eiA = defaultEvsIvs(pa.evs, pa.ivs);
    att.effort = clampEv(physAtk ? eiA.evs[1] : eiA.evs[3]);
    att.individual_value = physAtk ? eiA.ivs[1] | 0 : eiA.ivs[3] | 0;
    if (pa.level != null && pa.level > 0) att.level = pa.level | 0;

    var ap = pa.attackerPersonality;
    if (ap === 0.9 || ap === 1 || ap === 1.1) att.personality = ap;

    // move 를 ability/equipment 보다 먼저 set — 그 다음 microtask 에서 move+ability 재주입으로 Vue 배치 후 재평가 유도.
    var moveObj = null;
    if (pa.attackerMove) {
      var row = findMoveRow(state, pa.attackerMove);
      moveObj = buildMoveObject(row, pa.attackerMove, physAtk);
      att.move = moveObj;
    }
    var abilityObj = lookupAbilityObj(state, pa.abilityKo, false);
    var equipmentObj = lookupEquipmentObj(state, pa.itemKo, false);
    att.ability = abilityObj;
    att.equipment = equipmentObj;

    Promise.resolve().then(function () {
      try {
        if (moveObj) att.move = Object.assign({}, moveObj);
        att.ability = Object.assign({}, abilityObj);
      } catch (eKick) {}
    });

    return { ok: true };
  }

  function applyDefenderFromPayload(state, pd, physInc, warnings) {
    var def = state[KEY_DEF];
    var entry = findPokemonEntry(state, pd.speciesKo);
    if (!entry) {
      return { ok: false, error: 'species_not_in_def_dex' };
    }

    def.name = entry;
    if (entry.types) def.types = entry.types;
    def.sprite = deriveSprite(entry);

    var eiD = defaultEvsIvs(pd.evs, pd.ivs);
    def.hp_effort = clampEv(eiD.evs[0]);
    def.hp_individual_value = eiD.ivs[0] | 0;
    def.effort = clampEv(physInc ? eiD.evs[2] : eiD.evs[4]);
    def.individual_value = physInc ? eiD.ivs[2] | 0 : eiD.ivs[4] | 0;

    if (pd.level != null && pd.level > 0) def.level = pd.level | 0;

    var dp = pd.defenderPersonality;
    if (dp === 0.9 || dp === 1 || dp === 1.1) def.personality = dp;

    var defAbility = lookupAbilityObj(state, pd.abilityKo, true);
    var defEquipment = lookupEquipmentObj(state, pd.itemKo, true);
    def.ability = defAbility;
    def.equipment = defEquipment;

    Promise.resolve().then(function () {
      try {
        def.ability = Object.assign({}, defAbility);
        def.equipment = Object.assign({}, defEquipment);
      } catch (eKickDef) {}
    });

    return { ok: true };
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

  function runApplyCalcFillCore(state, job, done) {
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
      var attRef = state[KEY_ATT];
      var inferred = inferIncomingPhysicalFromAttacker(attRef);
      if (inferred === false) {
        physAtk = false;
        physDef = false;
      } else if (inferred === true) {
        physAtk = true;
        physDef = true;
      } else {
        physAtk = pdFull.incomingPhysical;
        physDef = pdFull.incomingPhysical;
      }
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

    try {
      var att = state[KEY_ATT];
      if (hasA) {
        var ra = applyAttackerFromPayload(state, paFull, physAtk, warnings);
        if (!ra.ok) {
          done({ ok: false, error: ra.error, warnings: warnings });
          return;
        }
        applyWeatherAndTerrain(att, paFull, hasD ? pdFull : null);
      }

      if (hasD) {
        var rd = applyDefenderFromPayload(state, pdFull, physDef, warnings);
        if (!rd.ok) {
          done({ ok: false, error: rd.error, warnings: warnings });
          return;
        }
        if (!hasA) {
          applyWeatherAndTerrain(att, null, pdFull);
        }
      }

      done({ ok: true, warnings: warnings.length ? warnings : undefined });
    } catch (e) {
      done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
    }
  }

  function runApplyCalcFill(job, done) {
    var state = getNuxtState();
    if (!state) {
      done({ ok: false, error: 'nuxt_state_not_found' });
      return;
    }
    if (!calcShellReady(state)) {
      var pl = state[KEY_POKE_LIST];
      if (!Array.isArray(pl) || pl.length === 0) {
        done({ ok: false, error: 'calc_dex_not_ready' });
      } else {
        done({ ok: false, error: 'vue_calc_not_found' });
      }
      return;
    }
    runApplyCalcFillCore(state, job, done);
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
