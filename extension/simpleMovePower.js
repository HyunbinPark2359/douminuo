/**
 * 결정력: 위력(테크니션→태그→우격→노말스킨/-ate→타입특성→[조건부:맹화·모래의힘·날씨·필드·선파워]→도구)→STAB→실수치×배율→최종배율
 * computeMovePowers: { base, buffed } — base 는 조건부 특성 효과 제외(표기용).
 * 한글 기술명 → moveKoMap.json 조회 (PokeAPI 공식 한글명 + 소수 별칭).
 * 맹화·모래의힘·선파워: HP·실제 날씨는 보지 않고 배율만 적용.
 * 날씨·필드: 이 포켓몬 특성의 setsWeather / setsTerrain 만 반영.
 *
 * 비표준 공격 스탯(분자): Body Press(bodypress)=방어 실수치, 물리·STAB 등은 그대로.
 * Photon Geyser(photongeyser)=공격·특공 중 더 큰 쪽; 동률(atk<=spa)은 특수 취급. 유효 물리/특수에 맞춰 도구·맹화 등 분기.
 */
(function (global) {
  'use strict';

  var FC = global.nuoFmtCommon;
  var readLabel = FC.readLabel;
  var collectHoldLabels = FC.collectHoldLabels;
  var findRuleAndSlugInMap = FC.findRuleAndSlugInMap;

  /** 한글 타입명 → PokeAPI type.name */
  var TYPE_KO_TO_EN = {
    노말: 'normal',
    불꽃: 'fire',
    물: 'water',
    전기: 'electric',
    풀: 'grass',
    얼음: 'ice',
    격투: 'fighting',
    독: 'poison',
    땅: 'ground',
    비행: 'flying',
    에스퍼: 'psychic',
    벌레: 'bug',
    바위: 'rock',
    고스트: 'ghost',
    드래곤: 'dragon',
    악: 'dark',
    강철: 'steel',
    페어리: 'fairy',
    스텔라: 'stellar',
  };

  function koByNameTable(moveKoMap) {
    if (moveKoMap && moveKoMap.byKo && typeof moveKoMap.byKo === 'object') return moveKoMap.byKo;
    return null;
  }

  function normalizeTypeToEn(t) {
    if (t == null || t === '') return '';
    var s = String(t).trim();
    if (!s) return '';
    var low = s.toLowerCase();
    if (/^[a-z]+$/.test(low) && low.length <= 12) return low;
    return TYPE_KO_TO_EN[s] || TYPE_KO_TO_EN[s.replace(/\s/g, '')] || '';
  }

  function findRuleInMap(map, label) {
    var r = findRuleAndSlugInMap(map, label);
    return r ? r.rule : null;
  }

  function findRuleFromLabels(rules, sectionKey, raw) {
    var map = rules && rules[sectionKey] && typeof rules[sectionKey] === 'object' ? rules[sectionKey] : null;
    var labels = collectHoldLabels(raw);
    var li;
    for (li = 0; li < labels.length; li++) {
      var r = findRuleInMap(map, labels[li]);
      if (r) return r;
    }
    return null;
  }

  function findItemRule(rules, hold) {
    return findRuleFromLabels(rules, 'items', hold);
  }

  function findAbilityRule(rules, abilityRaw) {
    return findRuleFromLabels(rules, 'abilities', abilityRaw);
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0) return fallback;
    return n;
  }

  function showdownMoveIdFromLabel(lab, moveKoMap) {
    var raw = readLabel(lab);
    if (!raw) return '';
    var table = koByNameTable(moveKoMap);
    if (table) {
      var noSpace = raw.replace(/\s+/g, '');
      if (table[noSpace]) return table[noSpace];
      if (table[raw]) return table[raw];
    }
    var s = raw.trim().toLowerCase();
    return s.replace(/[^a-z0-9]/g, '');
  }

  function showdownMoveIdFromMove(mv, moveKoMap) {
    if (mv == null || typeof mv !== 'object' || Array.isArray(mv)) {
      return showdownMoveIdFromLabel(mv, moveKoMap);
    }
    var order = [
      'nameEn',
      'name_en',
      'englishName',
      'name',
      'nameKr',
      'name_kr',
      'titleKr',
      'label',
    ];
    var seen = {};
    var i;
    for (i = 0; i < order.length; i++) {
      var t = readLabel(mv[order[i]]);
      if (!t || seen[t]) continue;
      seen[t] = true;
      var id = showdownMoveIdFromLabel(t, moveKoMap);
      if (id) return id;
    }
    return '';
  }

  function getMoveTags(moveTagsBundle, mv, moveKoMap) {
    var out = {};
    if (!moveTagsBundle || !moveTagsBundle.moves || typeof moveTagsBundle.moves !== 'object') return out;
    var id = showdownMoveIdFromMove(mv, moveKoMap);
    if (!id) return out;
    var row = moveTagsBundle.moves[id];
    if (!row || typeof row !== 'object') return out;
    var k;
    for (k in row) {
      if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
      var v = row[k];
      if (v) out[k] = true;
    }
    return out;
  }

  /** 쾌청·비: 불꽃·물 위력 보정(공격기준). strongwinds 등은 빈 객체 */
  var WEATHER_TYPE_POWER_MUL = {
    sun: { fire: 1.5, water: 0.5 },
    rain: { water: 1.5, fire: 0.5 },
    sand: {},
    snow: {},
    strongwinds: {},
  };

  /** 지형: 해당 타입 위력(지면에 있다고 상정). 전기·풀·페어리 1.3, 에스퍼 1.5 */
  var TERRAIN_TYPE_POWER_MUL = {
    electric: { electric: 1.3 },
    grassy: { grass: 1.3 },
    misty: { fairy: 1.3 },
    psychic: { psychic: 1.5 },
  };

  /** 표기용: 맹화·모래의힘·날씨/필드 깔기·선파워(특공)만 '버프 후' 전제 */
  function abilityHasConditionalPowerDisplay(ar) {
    var a = ar || {};
    return !!(
      a.pinchBoostType != null ||
      a.sandForce === true ||
      a.setsWeather != null ||
      a.setsTerrain != null ||
      a.spaBoostInSun != null
    );
  }

  /** 재앙·절운 등 루인 배율: Photon Geyser는 유효 물리/특수 기준 */
  function effectiveDamageClassForRuin(mv, atkReal, spaReal, moveKoMap) {
    if (!mv || typeof mv !== 'object') return String(mv && mv.damage_class ? mv.damage_class : '').toLowerCase();
    if (showdownMoveIdFromMove(mv, moveKoMap) !== 'photongeyser') {
      return String(mv.damage_class || '').toLowerCase();
    }
    var pa = atkReal != null && !isNaN(atkReal) ? atkReal : null;
    var ps = spaReal != null && !isNaN(spaReal) ? spaReal : null;
    if (pa == null && ps == null) return String(mv.damage_class || '').toLowerCase();
    if (pa == null) return 'special';
    if (ps == null) return 'physical';
    return pa > ps ? 'physical' : 'special';
  }

  /**
   * F8: 한 번의 호출로 base 와 buffed 결정력을 동시에 계산.
   * - 옛 코드는 `oneMovePowerInternal(...skipConditionalAbility)` 을 2회 호출 (true / false).
   * - 신 코드는 pEff 를 (Base, Buffed) 두 변수로 병렬 추적. 공통 곱은 둘 다 적용,
   *   조건부 곱(맹화·모래의힘·setsWeather/setsTerrain·spaBoostInSun) 은 Buffed 에만 적용.
   * - Math.round 위치는 옛 코드와 동일하게 보존 — 동등성 임시 Node 러너로 검증됨.
   * - abilityHasConditionalPowerDisplay 가 false 인(또는 조건부가 매치 안 되는) 경우
   *   base === buffed 가 되어 결과가 옛 코드와 1:1 일치.
   *
   * @returns {{ base: number, buffed: number, cls: 'physical'|'special' }|null}
   *   cls 는 호출자(ruin 보정 분기)가 활용. null 이면 변화기/위력 0/비공격기.
   */
  function oneMovePowerInternalDual(
    mv,
    atkReal,
    spaReal,
    defReal,
    speciesTypesEn,
    itemRule,
    abilityRule,
    moveTagsBundle,
    moveKoMap
  ) {
    if (!mv || typeof mv !== 'object') return null;
    var p = mv.power;
    if (p == null || p === '') return null;
    var pnum = parseInt(p, 10);
    if (isNaN(pnum) || pnum <= 0) return null;

    var cls = String(mv.damage_class || '').toLowerCase();
    if (cls === 'status') return null;

    var isPhys = cls === 'physical';
    var isSpec = cls === 'special';
    if (!isPhys && !isSpec) return null;

    var moveId = showdownMoveIdFromMove(mv, moveKoMap);
    var stat;
    if (moveId === 'photongeyser') {
      var pa = atkReal != null && !isNaN(atkReal) ? atkReal : null;
      var ps = spaReal != null && !isNaN(spaReal) ? spaReal : null;
      if (pa == null && ps == null) return null;
      if (pa == null) {
        isPhys = false;
        isSpec = true;
        stat = ps;
      } else if (ps == null) {
        isPhys = true;
        isSpec = false;
        stat = pa;
      } else if (pa > ps) {
        isPhys = true;
        isSpec = false;
        stat = pa;
      } else {
        isPhys = false;
        isSpec = true;
        stat = ps;
      }
    } else if (moveId === 'bodypress') {
      stat = defReal;
      if (stat == null || isNaN(stat)) return null;
    } else {
      stat = isPhys ? atkReal : spaReal;
      if (stat == null || isNaN(stat)) return null;
    }

    var moveTypeEn = normalizeTypeToEn(mv.type);
    if (!moveTypeEn) return null;

    var ar = abilityRule || {};
    // pEff 를 (Base, Buffed) 두 갈래로 추적. 동일 round 시퀀스를 양쪽에 적용.
    var pBase = pnum;
    var pBuffed = pnum;

    // ───────── 공통: ar.powerMul, tags 보정, 우격다짐, ate/normalize, boostType ─────────
    if (ar.powerMul != null && !ar.ifSheerForceMove) {
      var cap = ar.ifBasePowerAtMost;
      if (cap == null || pnum <= cap) {
        var mul0 = num(ar.powerMul, 1);
        pBase = Math.round(pBase * mul0);
        pBuffed = Math.round(pBuffed * mul0);
      }
    }

    var tags = getMoveTags(moveTagsBundle, mv, moveKoMap);

    var btags = ar.boostIfMoveTags;
    if (btags && typeof btags === 'object') {
      var need = btags.all;
      if (Array.isArray(need) && need.length) {
        var tagOk = true;
        var ti;
        for (ti = 0; ti < need.length; ti++) {
          if (!tags[need[ti]]) {
            tagOk = false;
            break;
          }
        }
        if (tagOk) {
          if (btags.physicalOnly && !isPhys) tagOk = false;
          if (btags.specialOnly && !isSpec) tagOk = false;
          if (tagOk) {
            var mul1 = num(btags.powerMul, 1);
            pBase = Math.round(pBase * mul1);
            pBuffed = Math.round(pBuffed * mul1);
          }
        }
      }
    }

    if (ar.ifSheerForceMove && tags.sheerForceEligible) {
      var mul2 = num(ar.sheerForcePowerMul, 1.3);
      pBase = Math.round(pBase * mul2);
      pBuffed = Math.round(pBuffed * mul2);
    }

    if (ar.normalizeAllMoves) {
      moveTypeEn = 'normal';
      var mul3 = num(ar.normalizePowerMul, 1.2);
      pBase = Math.round(pBase * mul3);
      pBuffed = Math.round(pBuffed * mul3);
    } else if (ar.ateType && moveTypeEn === 'normal') {
      moveTypeEn = String(ar.ateType).toLowerCase().trim();
      var mul4 = num(ar.atePowerMul, 1.2);
      pBase = Math.round(pBase * mul4);
      pBuffed = Math.round(pBuffed * mul4);
    }

    var abBoostT = ar.boostType != null ? String(ar.boostType).toLowerCase().trim() : '';
    if (abBoostT && moveTypeEn === abBoostT) {
      var mul5 = num(ar.typedPowerMul, 1);
      pBase = Math.round(pBase * mul5);
      pBuffed = Math.round(pBuffed * mul5);
    }

    // ───────── 조건부 (Buffed only): 맹화·모래의힘·setsWeather·setsTerrain ─────────
    if (ar.pinchBoostType != null) {
      var pbt = String(ar.pinchBoostType).toLowerCase().trim();
      if (moveTypeEn === pbt) {
        pBuffed = Math.round(pBuffed * num(ar.pinchPowerMul, 1.5));
      }
    }

    if (ar.sandForce) {
      if (moveTypeEn === 'ground' || moveTypeEn === 'rock' || moveTypeEn === 'steel') {
        pBuffed = Math.round(pBuffed * num(ar.sandForcePowerMul, 1.3));
      }
    }

    var weatherKey =
      ar.setsWeather != null ? String(ar.setsWeather).toLowerCase().trim() : '';
    if (weatherKey && WEATHER_TYPE_POWER_MUL[weatherKey]) {
      var wm = WEATHER_TYPE_POWER_MUL[weatherKey][moveTypeEn];
      if (wm != null && !isNaN(wm)) {
        pBuffed = Math.round(pBuffed * wm);
      }
    }

    var terrainKey =
      ar.setsTerrain != null ? String(ar.setsTerrain).toLowerCase().trim() : '';
    if (terrainKey && TERRAIN_TYPE_POWER_MUL[terrainKey]) {
      var tm = TERRAIN_TYPE_POWER_MUL[terrainKey][moveTypeEn];
      if (tm != null && !isNaN(tm)) {
        pBuffed = Math.round(pBuffed * tm);
      }
    }

    // ───────── 공통: 도구 ─────────
    var ir = itemRule || {};

    var bt = ir.boostType != null ? String(ir.boostType).toLowerCase().trim() : '';
    if (bt && moveTypeEn === bt) {
      var mul6 = num(ir.typedPowerMul, 1);
      pBase = Math.round(pBase * mul6);
      pBuffed = Math.round(pBuffed * mul6);
    }

    if (isPhys && ir.powerMulPhysical != null) {
      var mul7 = num(ir.powerMulPhysical, 1);
      pBase = Math.round(pBase * mul7);
      pBuffed = Math.round(pBuffed * mul7);
    }
    if (isSpec && ir.powerMulSpecial != null) {
      var mul8 = num(ir.powerMulSpecial, 1);
      pBase = Math.round(pBase * mul8);
      pBuffed = Math.round(pBuffed * mul8);
    }
    if (ir.powerMul != null) {
      var mul9 = num(ir.powerMul, 1);
      pBase = Math.round(pBase * mul9);
      pBuffed = Math.round(pBuffed * mul9);
    }

    // ───────── STAB (공통) ─────────
    var stab = false;
    if (speciesTypesEn && speciesTypesEn.length) {
      var i;
      for (i = 0; i < speciesTypesEn.length; i++) {
        if (speciesTypesEn[i] === moveTypeEn) {
          stab = true;
          break;
        }
      }
    }
    var stabMul = num(ar.stabMul, 1.5);
    var adjBase = stab ? Math.round(pBase * stabMul) : pBase;
    var adjBuffed = stab ? Math.round(pBuffed * stabMul) : pBuffed;

    // ───────── 스탯 곱 (조건부 spaBoostInSun 만 Buffed 에) ─────────
    var atkM = num(ir.atkMulPhysical, 1) * num(ar.atkMulPhysical, 1);
    var spaMBase = num(ir.spaMulSpecial, 1) * num(ar.spaMulSpecial, 1);
    var spaMBuffed = spaMBase;
    if (ar.spaBoostInSun != null && isSpec) {
      spaMBuffed *= num(ar.spaBoostInSun, 1.5);
    }
    var statMulBase = isPhys ? atkM : spaMBase;
    var statMulBuffed = isPhys ? atkM : spaMBuffed;

    // ───────── 최종 (공통) ─────────
    var fin = num(ir.finalDamageMul, 1) * num(ar.finalDamageMul, 1);
    var finalBase = Math.round(adjBase * stat * statMulBase * fin);
    var finalBuffed = Math.round(adjBuffed * stat * statMulBuffed * fin);

    return { base: finalBase, buffed: finalBuffed };
  }

  /**
   * @param {object} slotData Smartnuo 공유 data 객체
   * @param {string[]} speciesTypesEn
   * @param {object|null} rules modifiers 전체 또는 null
   * @param {object|null} moveTagsJson moveTags.json 전체 또는 null
   * @param {object|null} moveKoMap moveKoMap.json (byKo: 한글→Showdown id)
   * @returns {({ base: number, buffed: number }|null)[]}
   */
  function computeMovePowers(slotData, speciesTypesEn, rules, moveTagsJson, moveKoMap) {
    var out = [null, null, null, null];
    var poke = slotData && slotData.pokemon;
    if (!poke || !Array.isArray(poke.moves)) return out;

    // F10: SR.flattenSlot 단일 출처 사용 (옛 flattenPokemonSlot 사본 제거).
    var flat = globalThis.shareToRaw.flattenSlot(slotData);
    var itemRule = findItemRule(rules || {}, flat.equipment || flat.item || flat.Item || flat.hold);
    var abilityRule = findAbilityRule(rules || {}, flat.ability || flat.ab || flat.Ability);

    var stats = poke.stats || {};
    var atk =
      stats.attack && stats.attack.real != null ? parseInt(stats.attack.real, 10) : null;
    var spa =
      stats.special_attack && stats.special_attack.real != null
        ? parseInt(stats.special_attack.real, 10)
        : null;
    var def =
      stats.defense && stats.defense.real != null ? parseInt(stats.defense.real, 10) : null;
    if (atk != null && isNaN(atk)) atk = null;
    if (spa != null && isNaN(spa)) spa = null;
    if (def != null && isNaN(def)) def = null;

    var moves = poke.moves;
    var i;
    for (i = 0; i < 4 && i < moves.length; i++) {
      // F8: 단일 호출로 base + buffed 동시 산출.
      var pair = oneMovePowerInternalDual(
        moves[i],
        atk,
        spa,
        def,
        speciesTypesEn || [],
        itemRule,
        abilityRule,
        moveTagsJson,
        moveKoMap
      );
      if (pair == null) {
        out[i] = null;
        continue;
      }
      var ar0 = abilityRule || {};
      var cls0 = effectiveDamageClassForRuin(moves[i], atk, spa, moveKoMap);
      var ruinM = 1;
      if (cls0 === 'physical') {
        ruinM = num(ar0.movePowerFoeDefenseRuinMul, 1);
      } else if (cls0 === 'special') {
        ruinM = num(ar0.movePowerFoeSpDefenseRuinMul, 1);
      }
      var buffed = pair.buffed;
      var baseVal = pair.base;
      if (ruinM !== 1) {
        buffed = Math.round(buffed * ruinM);
        baseVal = Math.round(baseVal * ruinM);
      }
      out[i] = { base: baseVal, buffed: buffed };
    }
    return out;
  }

  global.simpleMovePower = {
    computeMovePowers: computeMovePowers,
    normalizeTypeToEn: normalizeTypeToEn,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
