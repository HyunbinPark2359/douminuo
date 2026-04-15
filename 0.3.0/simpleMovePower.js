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
  var normalizeMatchKey = FC.normalizeMatchKey;
  var slugifyForMatch = FC.slugifyForMatch;
  var collectHoldLabels = FC.collectHoldLabels;

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
    var lab = readLabel(label);
    if (!lab || lab === '--') return null;
    if (!map || typeof map !== 'object') return null;

    var want = normalizeMatchKey(lab);
    var wantSlug = slugifyForMatch(lab);

    var slug;
    for (slug in map) {
      if (!Object.prototype.hasOwnProperty.call(map, slug)) continue;
      var slugAsWords = normalizeMatchKey(String(slug).replace(/-/g, ' '));
      if (
        normalizeMatchKey(slug) === want ||
        slugAsWords === want ||
        slugifyForMatch(slug) === wantSlug
      ) {
        return map[slug];
      }
      var rule = map[slug];
      if (rule && rule.nameKo && normalizeMatchKey(rule.nameKo) === want) {
        return rule;
      }
      var aliases = rule && Array.isArray(rule.aliases) ? rule.aliases : [];
      var ai;
      for (ai = 0; ai < aliases.length; ai++) {
        if (normalizeMatchKey(aliases[ai]) === want) {
          return rule;
        }
      }
    }
    return null;
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

  function oneMovePowerInternal(
    mv,
    atkReal,
    spaReal,
    defReal,
    speciesTypesEn,
    itemRule,
    abilityRule,
    moveTagsBundle,
    moveKoMap,
    skipConditionalAbility
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
    var pEff = pnum;

    if (ar.powerMul != null && !ar.ifSheerForceMove) {
      var cap = ar.ifBasePowerAtMost;
      if (cap == null || pnum <= cap) {
        pEff = Math.round(pEff * num(ar.powerMul, 1));
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
            pEff = Math.round(pEff * num(btags.powerMul, 1));
          }
        }
      }
    }

    if (ar.ifSheerForceMove && tags.sheerForceEligible) {
      pEff = Math.round(pEff * num(ar.sheerForcePowerMul, 1.3));
    }

    if (ar.normalizeAllMoves) {
      moveTypeEn = 'normal';
      pEff = Math.round(pEff * num(ar.normalizePowerMul, 1.2));
    } else if (ar.ateType && moveTypeEn === 'normal') {
      moveTypeEn = String(ar.ateType).toLowerCase().trim();
      pEff = Math.round(pEff * num(ar.atePowerMul, 1.2));
    }

    var abBoostT = ar.boostType != null ? String(ar.boostType).toLowerCase().trim() : '';
    if (abBoostT && moveTypeEn === abBoostT) {
      pEff = Math.round(pEff * num(ar.typedPowerMul, 1));
    }

    if (!skipConditionalAbility && ar.pinchBoostType != null) {
      var pbt = String(ar.pinchBoostType).toLowerCase().trim();
      if (moveTypeEn === pbt) {
        pEff = Math.round(pEff * num(ar.pinchPowerMul, 1.5));
      }
    }

    if (!skipConditionalAbility && ar.sandForce) {
      if (moveTypeEn === 'ground' || moveTypeEn === 'rock' || moveTypeEn === 'steel') {
        pEff = Math.round(pEff * num(ar.sandForcePowerMul, 1.3));
      }
    }

    var weatherKey =
      ar.setsWeather != null ? String(ar.setsWeather).toLowerCase().trim() : '';
    if (!skipConditionalAbility && weatherKey && WEATHER_TYPE_POWER_MUL[weatherKey]) {
      var wm = WEATHER_TYPE_POWER_MUL[weatherKey][moveTypeEn];
      if (wm != null && !isNaN(wm)) {
        pEff = Math.round(pEff * wm);
      }
    }

    var terrainKey =
      ar.setsTerrain != null ? String(ar.setsTerrain).toLowerCase().trim() : '';
    if (!skipConditionalAbility && terrainKey && TERRAIN_TYPE_POWER_MUL[terrainKey]) {
      var tm = TERRAIN_TYPE_POWER_MUL[terrainKey][moveTypeEn];
      if (tm != null && !isNaN(tm)) {
        pEff = Math.round(pEff * tm);
      }
    }

    var ir = itemRule || {};

    var bt = ir.boostType != null ? String(ir.boostType).toLowerCase().trim() : '';
    if (bt && moveTypeEn === bt) {
      pEff = Math.round(pEff * num(ir.typedPowerMul, 1));
    }

    if (isPhys && ir.powerMulPhysical != null) {
      pEff = Math.round(pEff * num(ir.powerMulPhysical, 1));
    }
    if (isSpec && ir.powerMulSpecial != null) {
      pEff = Math.round(pEff * num(ir.powerMulSpecial, 1));
    }
    if (ir.powerMul != null) {
      pEff = Math.round(pEff * num(ir.powerMul, 1));
    }

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
    var adjPower = stab ? Math.round(pEff * stabMul) : pEff;

    var atkM = num(ir.atkMulPhysical, 1) * num(ar.atkMulPhysical, 1);
    var spaM = num(ir.spaMulSpecial, 1) * num(ar.spaMulSpecial, 1);
    if (!skipConditionalAbility && ar.spaBoostInSun != null && isSpec) {
      spaM *= num(ar.spaBoostInSun, 1.5);
    }
    var statMul = isPhys ? atkM : spaM;

    var base = adjPower * stat * statMul;
    var fin = num(ir.finalDamageMul, 1) * num(ar.finalDamageMul, 1);
    return Math.round(base * fin);
  }

  function flattenPokemonSlot(slotData) {
    if (!slotData || typeof slotData !== 'object') return {};
    var nested = slotData.pokemon || slotData.mon || slotData.poke;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.assign({}, nested, slotData);
    }
    return Object.assign({}, slotData);
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

    var flat = flattenPokemonSlot(slotData);
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
      var buffed = oneMovePowerInternal(
        moves[i],
        atk,
        spa,
        def,
        speciesTypesEn || [],
        itemRule,
        abilityRule,
        moveTagsJson,
        moveKoMap,
        false
      );
      if (buffed == null) {
        out[i] = null;
        continue;
      }
      var baseVal = buffed;
      if (abilityHasConditionalPowerDisplay(abilityRule)) {
        baseVal = oneMovePowerInternal(
          moves[i],
          atk,
          spa,
          def,
          speciesTypesEn || [],
          itemRule,
          abilityRule,
          moveTagsJson,
          moveKoMap,
          true
        );
      }
      var ar0 = abilityRule || {};
      var cls0 = effectiveDamageClassForRuin(moves[i], atk, spa, moveKoMap);
      var ruinM = 1;
      if (cls0 === 'physical') {
        ruinM = num(ar0.movePowerFoeDefenseRuinMul, 1);
      } else if (cls0 === 'special') {
        ruinM = num(ar0.movePowerFoeSpDefenseRuinMul, 1);
      }
      if (ruinM !== 1) {
        buffed = Math.round(buffed * ruinM);
        if (baseVal != null) baseVal = Math.round(baseVal * ruinM);
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
