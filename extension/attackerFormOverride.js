/**
 * 결정력 계산 직전, 폼 고정 종(현재는 킬가르도 실드→블레이드)을
 * 공격형 폼의 Atk/SpA 실수치로 패치한 slotData 클론을 만든다.
 * 내구력 계산용 원본 slotData 는 호출자가 따로 보유해야 한다.
 */
(function (g) {
  'use strict';

  // 검출 후보. 현재는 킬가르도(실드)만.
  // 7세대 너프 이후: 블레이드 Atk/SpA 140, 실드 Def/SpD 140
  // baseStats 시그니처: HP60·Atk50·Def140·SpA50·SpD140·Spe60
  var OVERRIDES = [
    {
      label: 'aegislash-shield→blade',
      match: function (poke) {
        var nm = String((poke && poke.name) || '').toLowerCase();
        if (nm === 'aegislash' || nm === 'aegislash-shield') return true;
        var bs = bsArr(poke && poke.baseStats);
        return (
          !!bs &&
          bs[0] === 60 &&
          bs[1] === 50 &&
          bs[2] === 140 &&
          bs[3] === 50 &&
          bs[4] === 140 &&
          bs[5] === 60
        );
      },
      bladeAtkBase: 140,
      bladeSpaBase: 140,
    },
  ];

  function bsArr(bs) {
    if (Array.isArray(bs) && bs.length >= 6) return bs;
    if (bs && typeof bs === 'object') {
      return [
        bs.hp,
        bs.attack,
        bs.defense,
        bs.special_attack,
        bs.special_defense,
        bs.speed,
      ];
    }
    return null;
  }

  /**
   * 비-HP 실수치 (포켓몬 챔피언스 신공식, 스마트누오/본 확장과 동일):
   *   base = floor((floor((2*BS + IV) * L/100) + 5) * natureMul)
   *   real = base + floor(EV * natureMul)
   * 노력치 1당 실수치 1(중립 성격), 보정 성격에서는 EV 항에도 nature 적용 후 floor.
   * 구형 `floor(EV/4)` 합산 공식이 아님에 유의.
   */
  function computeRealNonHp(baseStat, iv, ev, level, natureMul) {
    var inner = Math.floor(((2 * baseStat + iv) * level) / 100);
    var base = Math.floor((inner + 5) * natureMul);
    var evGain = Math.floor(ev * natureMul);
    return base + evGain;
  }

  function natureMulFor(natureKo, statKey, natureKoDoc, natureStatMulDoc) {
    var slug =
      (natureKoDoc && natureKoDoc.koToSlug && natureKoDoc.koToSlug[natureKo]) || '';
    var row =
      slug &&
      natureStatMulDoc &&
      natureStatMulDoc.bySlug &&
      natureStatMulDoc.bySlug[slug];
    if (!row) return 1;
    var v = row[statKey];
    return typeof v === 'number' && v > 0 ? v : 1;
  }

  function deepClone(o) {
    try {
      return JSON.parse(JSON.stringify(o));
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {object} slotData 원본 (절대 변형 금지)
   * @param {object} natureKoDoc { koToSlug }
   * @param {object} natureStatMulDoc { bySlug }
   * @returns {object} 클론(블레이드 적용) 또는 원본 참조(해당 없음)
   */
  function applyAttackerFormOverride(slotData, natureKoDoc, natureStatMulDoc) {
    if (!slotData || typeof slotData !== 'object') return slotData;
    var poke = slotData.pokemon;
    if (!poke || typeof poke !== 'object') return slotData;

    var rule = null;
    var i;
    for (i = 0; i < OVERRIDES.length; i++) {
      if (OVERRIDES[i].match(poke)) {
        rule = OVERRIDES[i];
        break;
      }
    }
    if (!rule) return slotData;

    var clone = deepClone(slotData);
    if (!clone || !clone.pokemon) return slotData;
    var p = clone.pokemon;
    var stats = p.stats || (p.stats = {});

    var lvl = parseInt(p.level, 10);
    if (!lvl || lvl < 1) lvl = 50;
    var natureKo = String(p.personality || '').trim();

    var atkObj = stats.attack || (stats.attack = {});
    var spaObj = stats.special_attack || (stats.special_attack = {});
    var atkEv = parseInt(atkObj.value, 10) | 0;
    var spaEv = parseInt(spaObj.value, 10) | 0;
    // IV 가정: 31. 폼 변환은 표기용 추정 — 실제 계산기 입력 흐름과 무관.
    var atkIv = 31;
    var spaIv = 31;

    var atkMul = natureMulFor(natureKo, 'atk', natureKoDoc, natureStatMulDoc);
    var spaMul = natureMulFor(natureKo, 'spa', natureKoDoc, natureStatMulDoc);

    atkObj.real = computeRealNonHp(rule.bladeAtkBase, atkIv, atkEv, lvl, atkMul);
    spaObj.real = computeRealNonHp(rule.bladeSpaBase, spaIv, spaEv, lvl, spaMul);

    if (Array.isArray(p.baseStats) && p.baseStats.length >= 6) {
      p.baseStats[1] = rule.bladeAtkBase;
      p.baseStats[3] = rule.bladeSpaBase;
    } else if (p.baseStats && typeof p.baseStats === 'object') {
      p.baseStats.attack = rule.bladeAtkBase;
      p.baseStats.special_attack = rule.bladeSpaBase;
    }

    return clone;
  }

  g.attackerFormOverride = {
    applyAttackerFormOverride: applyAttackerFormOverride,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
