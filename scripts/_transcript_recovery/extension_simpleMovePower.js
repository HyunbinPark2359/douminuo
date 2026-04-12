/**
 * 단순 결정력: 위력(특성→도구)→STAB → 실수치×특성×도구 → 최종배율
 * modifiers.json 의 items / abilities. 랭크·필드·상대 방어 미반영.
 */
(function (global) {
  'use strict';

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

  function normalizeTypeToEn(t) {
    if (t == null || t === '') return '';
    var s = String(t).trim();
    if (!s) return '';
    var low = s.toLowerCase();
    if (/^[a-z]+$/.test(low) && low.length <= 12) return low;
    return TYPE_KO_TO_EN[s] || TYPE_KO_TO_EN[s.replace(/\s/g, '')] || '';
  }

  function readLabel(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.name != null) return readLabel(v.name);
    if (typeof v === 'object' && v.label != null) return readLabel(v.label);
    return String(v).trim();
  }

  function normalizeMatchKey(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function slugifyForMatch(s) {
    return normalizeMatchKey(s).replace(/\s+/g, '-');
  }

  /**
   * 도구·특성 필드가 문자열 또는 { name, nameKr, … } 일 수 있음.
   */
  function collectHoldLabels(hold) {
    var out = [];
    var seen = {};
    function pushRaw(s) {
      var t = readLabel(s);
      if (!t || t === '--') return;
      var k = normalizeMatchKey(t);
      if (seen[k]) return;
      seen[k] = true;
      out.push(t);
    }
    if (hold == null) return out;
    if (typeof hold !== 'object' || Array.isArray(hold)) {
      pushRaw(hold);
      return out;
    }
    var keys = [
      'nameKr',
      'name_kr',
      'nameKO',
      'labelKr',
      'titleKr',
      'name',
      'label',
      'title',
      'slug',
      'id',
    ];
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      if (hold[keys[ki]] != null) pushRaw(hold[keys[ki]]);
    }
    return out;
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

  /** @deprecated 호환용 */
  function findItemRuleForLabel(rules, label) {
    var items = rules && rules.items && typeof rules.items === 'object' ? rules.items : null;
    return findRuleInMap(items, label);
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0) return fallback;
    return n;
  }

  function oneMovePower(mv, atkReal, spaReal, speciesTypesEn, itemRule, abilityRule) {
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

    var stat = isPhys ? atkReal : spaReal;
    if (stat == null || isNaN(stat)) return null;

    var moveTypeEn = normalizeTypeToEn(mv.type);
    if (!moveTypeEn) return null;

    var ar = abilityRule || {};
    var pEff = pnum;

    if (ar.powerMul != null) {
      var cap = ar.ifBasePowerAtMost;
      if (cap == null || pnum <= cap) {
        pEff = Math.round(pEff * num(ar.powerMul, 1));
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
    var adjPower = stab ? Math.round(pEff * 1.5) : pEff;

    var atkM = num(ir.atkMulPhysical, 1) * num(ar.atkMulPhysical, 1);
    var spaM = num(ir.spaMulSpecial, 1) * num(ar.spaMulSpecial, 1);
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
   * @returns {(number|null)[]}
   */
  function computeMovePowers(slotData, speciesTypesEn, rules) {
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
    if (atk != null && isNaN(atk)) atk = null;
    if (spa != null && isNaN(spa)) spa = null;

    var moves = poke.moves;
    var i;
    for (i = 0; i < 4 && i < moves.length; i++) {
      out[i] = oneMovePower(moves[i], atk, spa, speciesTypesEn || [], itemRule, abilityRule);
    }
    return out;
  }

  global.simpleMovePower = {
    computeMovePowers: computeMovePowers,
    normalizeTypeToEn: normalizeTypeToEn,
    TYPE_KO_TO_EN: TYPE_KO_TO_EN,
    findItemRule: findItemRule,
    findItemRuleForLabel: findItemRuleForLabel,
    findAbilityRule: findAbilityRule,
    findRuleInMap: findRuleInMap,
    collectHoldLabels: collectHoldLabels,
    readLabel: readLabel,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
