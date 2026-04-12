/**
 * smartnuo.com — 데미지 계산기 Vue 인스턴스에 샘플 payload 반영.
 * 사이트 번들 변경 시 이 파일만 조정.
 */
(function () {
  'use strict';

  var STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'];

  function findCalcVmFromVue2(vm, depth) {
    depth = depth | 0;
    if (depth > 40 || !vm) return null;
    if (vm.attacker && vm.defender && Array.isArray(vm.pokemon_list)) return vm;
    var ch = vm.$children;
    if (!ch || !ch.length) return null;
    var i;
    for (i = 0; i < ch.length; i++) {
      var f = findCalcVmFromVue2(ch[i], depth + 1);
      if (f) return f;
    }
    return null;
  }

  function findCalcVm() {
    var app = document.querySelector('#app');
    if (!app) return null;
    if (app.__vue__) {
      var v2 = findCalcVmFromVue2(app.__vue__, 0);
      if (v2) return { kind: 'vue2', vm: v2 };
    }
    return null;
  }

  function isCalculatorContext(vm) {
    if (!vm || !vm.attacker || !vm.defender) return false;
    var t = document.body && document.body.innerText;
    if (!t) return true;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
  }

  function pickPokemonEn(vm, speciesKo) {
    if (!speciesKo || !vm.pokemon_list) return speciesKo;
    var row = vm.pokemon_list.find(function (p) {
      return p && p.kr === speciesKo;
    });
    return row && row.en ? row.en : speciesKo;
  }

  function pickMoveEn(vm, moveKr) {
    if (!moveKr || !vm.move_list) return moveKr;
    var row = vm.move_list.find(function (m) {
      return m && m.kr === moveKr;
    });
    return row && row.en ? row.en : moveKr;
  }

  function applyStatsEvs(vm, side, evs) {
    var target = side === 'defender' ? vm.defender : vm.attacker;
    if (!target || !target.stats || !evs || evs.length < 6) return;
    var i;
    for (i = 0; i < 6; i++) {
      var key = STAT_KEYS[i];
      var v = evs[i] | 0;
      if (v < 0) v = 0;
      if (v > 252) v = 252;
      vm.$set(target.stats, key, v);
    }
  }

  function applyIvScalars(vm, side, ivs, physicalIncoming) {
    var target = side === 'defender' ? vm.defender : vm.attacker;
    if (!target || !ivs || ivs.length < 6) return;
    var hpIv = ivs[0] | 0;
    var atkIv = ivs[1] | 0;
    if (side === 'attacker') {
      vm.$set(target, 'individual_value', physicalIncoming ? atkIv : ivs[3] | 0);
      return;
    }
    vm.$set(target, 'individual_value_for_hp', hpIv);
    var defIv = physicalIncoming ? ivs[2] | 0 : ivs[4] | 0;
    vm.$set(target, 'individual_value_for_defend', defIv);
  }

  function applyEffortScalars(vm, side, evs, physicalIncoming) {
    var target = side === 'defender' ? vm.defender : vm.attacker;
    if (!target || !evs || evs.length < 6) return;
    if (side === 'attacker') {
      vm.$set(target, 'effort', physicalIncoming ? evs[1] | 0 : evs[3] | 0);
      return;
    }
    vm.$set(target, 'effort_for_hp', evs[0] | 0);
    vm.$set(target, 'effort_for_defend', physicalIncoming ? evs[2] | 0 : evs[4] | 0);
  }

  /**
   * @param {object} vm
   * @param {'attacker'|'defender'} side
   * @param {object} payload calcPayload.buildCalcPayload 결과
   * @param {{ physicalForDefender?: boolean }} opts 공격 측이 물리면 수비는 방어 EV/IV
   */
  function applySide(vm, side, payload, opts) {
    opts = opts || {};
    if (!payload || payload.error) return { ok: false, reason: payload && payload.error };

    var physical =
      side === 'attacker'
        ? payload.physicalMove !== false
        : opts.physicalForDefender !== undefined
          ? opts.physicalForDefender
          : true;

    var nameEn = pickPokemonEn(vm, payload.speciesKo);
    if (side === 'attacker') {
      vm.$set(vm.attacker, 'name', nameEn);
      if (typeof vm.loadAttacker === 'function') vm.loadAttacker();
    } else {
      vm.$set(vm.defender, 'name', nameEn);
      if (typeof vm.loadDefender === 'function') vm.loadDefender();
    }

    vm.$nextTick(function () {
      applyStatsEvs(vm, side, payload.evs);
      applyIvScalars(vm, side, payload.ivs, side === 'attacker' ? physical : physical);
      applyEffortScalars(vm, side, payload.evs, side === 'attacker' ? physical : physical);

      if (side === 'attacker') {
        if (payload.firstMoveKr && vm.attacker.move) {
          var moveEn = pickMoveEn(vm, payload.firstMoveKr);
          vm.$set(vm.attacker.move, 'name', moveEn);
          if (typeof vm.loadMove === 'function') vm.loadMove();
        }
        if (payload.abilityKo) vm.$set(vm.attacker, 'ability', payload.abilityKo);
        if (payload.itemKo) vm.$set(vm.attacker, 'equipment', payload.itemKo);
        var ap = payload.attackerPersonality;
        if (ap === 0.9 || ap === 1 || ap === 1.1) vm.$set(vm.attacker, 'personality', ap);
        if (payload.level) vm.$set(vm.attacker, 'level', payload.level | 0);
      } else {
        if (payload.abilityKo) vm.$set(vm.defender, 'ability', payload.abilityKo);
        if (payload.itemKo) vm.$set(vm.defender, 'equipment', payload.itemKo);
        var dp = payload.defenderPersonality;
        if (dp === 0.9 || dp === 1 || dp === 1.1) vm.$set(vm.defender, 'personality', dp);
        if (payload.level) vm.$set(vm.defender, 'level', payload.level | 0);
      }
    });

    return { ok: true };
  }

  /**
   * @param {{ attacker?: object, defender?: object }} payloads
   */
  function applyCalcFill(payloads) {
    var found = findCalcVm();
    if (!found || found.kind !== 'vue2') {
      return { ok: false, error: 'vue_calc_not_found' };
    }
    var vm = found.vm;
    if (!isCalculatorContext(vm)) {
      return { ok: false, error: 'not_calculator_view' };
    }

    if (vm.dialog) {
      vm.$set(vm.dialog, 'caculate', true);
    }

    var warnings = [];
    var phys = payloads && payloads.attacker && !payloads.attacker.error ? payloads.attacker.physicalMove : true;

    if (payloads && payloads.attacker && !payloads.attacker.error) {
      applySide(vm, 'attacker', payloads.attacker, {});
    } else if (payloads && payloads.attacker) {
      warnings.push('attacker:' + payloads.attacker.error);
    }

    if (payloads && payloads.defender && !payloads.defender.error) {
      applySide(vm, 'defender', payloads.defender, { physicalForDefender: phys });
    } else if (payloads && payloads.defender) {
      warnings.push('defender:' + payloads.defender.error);
    }

    return { ok: true, warnings: warnings };
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'NUO_APPLY_CALC') return;
    try {
      var r = applyCalcFill(msg.payloads || {});
      sendResponse(r);
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
    return true;
  });
})();
