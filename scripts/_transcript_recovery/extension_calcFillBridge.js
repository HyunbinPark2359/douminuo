/**
 * 페이지(MAIN) 컨텍스트에서 실행됨.
 *
 * - VM: attacker/defender/pokemon_list 를 가진 후보를 모두 모아 점수화. 화면에 실제로 그려진 $el(가시) 우선.
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

  function elementLikelyVisible(vm) {
    var el = vm && vm.$el;
    if (!el || el.nodeType !== 1) return false;
    var r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function collectCalcVmsFromTree(vm, depth, out) {
    if (!vm || depth > 100) return;
    if (isCalcVmShape(vm)) {
      out.push({
        vm: vm,
        depth: depth,
        hasLoad: typeof vm.loadAttacker === 'function',
        visible: elementLikelyVisible(vm),
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
    var s = entry.depth * 4;
    if (entry.hasLoad) s += 2500;
    if (entry.visible) s += 4000;
    var el = vm.$el;
    if (el && el.nodeType === 1 && typeof el.innerText === 'string') {
      var t = el.innerText;
      if (t.indexOf('교체') !== -1) s += 900;
      if (t.indexOf('계산') !== -1) s += 350;
      if (t.indexOf('초기화') !== -1) s += 120;
    }
    return s;
  }

  function findCalcVm() {
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
          visible: elementLikelyVisible(vm),
        });
      }
    }
    if (out.length === 0) return null;
    out.sort(function (a, b) {
      return scoreEntry(b) - scoreEntry(a);
    });
    return out[0].vm;
  }

  function isCalculatorContext() {
    var t = document.body && document.body.innerText;
    if (!t) return false;
    return t.indexOf('교체') !== -1 && (t.indexOf('계산') !== -1 || t.indexOf('초기화') !== -1);
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

  function pokeapiStyleDamageClass(physical) {
    return { name: physical ? 'physical' : 'special' };
  }

  function patchMoveDamageClass(vm, moveObj, physical) {
    if (!moveObj || typeof moveObj !== 'object') return;
    var dc = pokeapiStyleDamageClass(physical);
    if (moveObj.damage_class == null) {
      vm.$set(moveObj, 'damage_class', dc);
      return;
    }
    if (typeof moveObj.damage_class === 'object' && moveObj.damage_class != null && moveObj.damage_class.name == null) {
      vm.$set(moveObj.damage_class, 'name', dc.name);
    }
  }

  function ensureSideMovePlaceholder(vm, side, physical) {
    var mon = side === 'defender' ? vm.defender : vm.attacker;
    if (!mon) return;
    var stub = {
      name: 'pound',
      kr: '팔뚝치기',
      power: 40,
      damage_class: pokeapiStyleDamageClass(physical),
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
    var dcName = mp.damageClass === 'special' ? 'special' : 'physical';
    var typ = mp.type;
    var typeObj = typeof typ === 'string' ? { name: typ } : typ && typeof typ === 'object' ? typ : { name: 'normal' };
    if (typeObj.name == null && typ) typeObj = { name: String(typ) };
    var merged = {
      name: mp.name || 'tackle',
      kr: mp.kr || '',
      power: mp.power != null ? mp.power | 0 : 40,
      type: typeObj,
      damage_class: { name: dcName },
    };
    vm.$set(vm.attacker, 'move', merged);
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

  function syncScalars(vm, pa, pd, phys, hasD) {
    ensureAttackerMovePlaceholder(vm, phys);
    if (hasD) ensureDefenderMovePlaceholder(vm, phys);
    if (pa) applyAttackerScalars(vm, pa, phys);
    if (hasD && pd) applyDefenderScalars(vm, pd, phys);
  }

  function verifyFill(vm, hasA, hasD, pa, pd, phys) {
    if (hasA && pa && vm.attacker) {
      var wantN = normName(pickPokemonEn(vm, pa.speciesKo));
      var gotN = normName(vm.attacker.name);
      if (wantN && gotN && wantN !== gotN) {
        return { ok: false, detail: 'attacker_name_mismatch' };
      }
      var evs = pa.evs && pa.evs.length >= 6 ? pa.evs : [0, 0, 0, 0, 0, 0];
      var wantEff = clampEv(phys ? evs[1] : evs[3]);
      var ge = vm.attacker.effort;
      if (wantEff !== 0 && ge == null) {
        return { ok: false, detail: 'attacker_effort_missing' };
      }
      if (ge != null && (ge | 0) !== wantEff) {
        return { ok: false, detail: 'attacker_effort_mismatch' };
      }
    }
    if (hasD && pd && vm.defender) {
      var wdn = normName(pickPokemonEn(vm, pd.speciesKo));
      var gdn = normName(vm.defender.name);
      if (wdn && gdn && wdn !== gdn) {
        return { ok: false, detail: 'defender_name_mismatch' };
      }
    }
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

  function runApplyCalcFill(job, done) {
    var payloads = job.payloads || {};
    var onlyAttacker = !!job.onlyAttacker;
    var onlyDefender = !!job.onlyDefender;

    var warnings = [];
    var vm = findCalcVm();
    if (!vm) {
      done({ ok: false, error: 'vue_calc_not_found' });
      return;
    }
    if (!isCalculatorContext()) {
      done({ ok: false, error: 'not_calculator_view' });
      return;
    }

    var paFull = payloads.attacker && !payloads.attacker.error ? payloads.attacker : null;
    var pdFull = payloads.defender && !payloads.defender.error ? payloads.defender : null;

    var phys = paFull ? paFull.physicalMove !== false : true;

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

    var FINAL_DELAY_MS = 280;

    function finishSuccess() {
      trySyncDerived(vm);
      done({ ok: true, warnings: warnings });
    }

    function scheduleDelayedResyncThenFinish(pax, pdx) {
      setTimeout(function () {
        try {
          syncScalars(vm, pax, pdx, phys, !!pdx);
        } catch (e) {
          done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
          return;
        }
        setTimeout(function () {
          try {
            syncScalars(vm, pax, pdx, phys, !!pdx);
          } catch (e) {
            done({ ok: false, error: String((e && e.message) || e), warnings: warnings });
            return;
          }
          var ver = verifyFill(vm, hasA, hasD, pax, pdx, phys);
          if (!ver.ok) {
            done({
              ok: false,
              error: 'calc_verify_failed:' + (ver.detail || ''),
              warnings: warnings,
            });
            return;
          }
          finishSuccess();
        }, 140);
      }, FINAL_DELAY_MS);
    }

    try {
      if (hasA) {
        vm.$set(vm.attacker, 'name', pickPokemonEn(vm, pa.speciesKo));
        ensureAttackerMovePlaceholder(vm, phys);
        if (typeof vm.loadAttacker === 'function') vm.loadAttacker();
        ensureAttackerMovePlaceholder(vm, phys);
        vm.$nextTick(function () {
          try {
            ensureAttackerMovePlaceholder(vm, phys);
            applyAttackerScalars(vm, pa, phys);
            if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
            vm.$nextTick(function () {
              try {
                ensureAttackerMovePlaceholder(vm, phys);
                if (pa.attackerMove) applyAttackerMovePayload(vm, pa.attackerMove);
                if (hasD) {
                  ensureDefenderMovePlaceholder(vm, phys);
                  vm.$set(vm.defender, 'name', pickPokemonEn(vm, pd.speciesKo));
                  if (typeof vm.loadDefender === 'function') vm.loadDefender();
                  ensureDefenderMovePlaceholder(vm, phys);
                  vm.$nextTick(function () {
                    try {
                      ensureDefenderMovePlaceholder(vm, phys);
                      applyDefenderScalars(vm, pd, phys);
                      vm.$nextTick(function () {
                        try {
                          syncScalars(vm, pa, pd, phys, true);
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
                  syncScalars(vm, pa, null, phys, false);
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
        ensureAttackerMovePlaceholder(vm, phys);
        ensureDefenderMovePlaceholder(vm, phys);
        vm.$set(vm.defender, 'name', pickPokemonEn(vm, pdOnly.speciesKo));
        if (typeof vm.loadDefender === 'function') vm.loadDefender();
        ensureDefenderMovePlaceholder(vm, phys);
        vm.$nextTick(function () {
          try {
            ensureAttackerMovePlaceholder(vm, phys);
            ensureDefenderMovePlaceholder(vm, phys);
            applyDefenderScalars(vm, pdOnly, phys);
            vm.$nextTick(function () {
              try {
                syncScalars(vm, null, pdOnly, phys, true);
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
