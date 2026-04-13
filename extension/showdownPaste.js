/* Pokemon Showdown / PokePaste 스타일 (shareToRaw + 맵 JSON) */
(function (global) {
  'use strict';

  var SR = global.shareToRaw;
  var FC = global.nuoFmtCommon;
  var readLabel = FC.readLabel;
  var normalizeMatchKey = FC.normalizeMatchKey;
  var slugifyForMatch = FC.slugifyForMatch;
  var collectHoldLabels = FC.collectHoldLabels;

  function asInt(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  function findRuleAndSlugInMap(map, label) {
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
        return { slug: String(slug), rule: map[slug] };
      }
      var rule = map[slug];
      if (rule && rule.nameKo && normalizeMatchKey(rule.nameKo) === want) {
        return { slug: String(slug), rule: rule };
      }
      var aliases = rule && Array.isArray(rule.aliases) ? rule.aliases : [];
      var ai;
      for (ai = 0; ai < aliases.length; ai++) {
        if (normalizeMatchKey(aliases[ai]) === want) {
          return { slug: String(slug), rule: rule };
        }
      }
    }
    return null;
  }

  function slugToDisplayName(slug) {
    if (!slug) return '';
    return String(slug)
      .trim()
      .toLowerCase()
      .split('-')
      .filter(Boolean)
      .map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }

  function formatSpeciesFromSlug(slug) {
    if (!slug) return '';
    return String(slug)
      .trim()
      .toLowerCase()
      .split('-')
      .filter(Boolean)
      .map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join('-');
  }

  function speciesEnglishFromSlot(s) {
    var poke = s.pokemon || s.mon || s.poke;
    if (poke && typeof poke === 'object' && typeof poke.name === 'string') {
      var pn = poke.name.trim();
      if (/^[a-z0-9-]+$/i.test(pn)) return formatSpeciesFromSlug(pn);
    }
    if (typeof s.name === 'string') {
      var sn = s.name.trim();
      if (/^[a-z0-9-]+$/i.test(sn)) return formatSpeciesFromSlug(sn);
    }
    return readLabel(s.nameKr || s.speciesName || s.speciesKo || s.species) || '';
  }

  function resolveItemEn(modifiersDoc, itemKoDoc, itemRaw) {
    var found = null;
    if (modifiersDoc && modifiersDoc.items) {
      var labels = collectHoldLabels(itemRaw);
      var li;
      for (li = 0; li < labels.length; li++) {
        found = findRuleAndSlugInMap(modifiersDoc.items, labels[li]);
        if (found && found.slug) break;
      }
    }
    if (found && found.slug) return slugToDisplayName(found.slug);
    var lab = readLabel(
      typeof itemRaw === 'object' && itemRaw && !Array.isArray(itemRaw)
        ? itemRaw.slug || itemRaw.id || itemRaw.name
        : itemRaw
    );
    if (!lab || lab === '--') return '';
    if (/^[a-z0-9-]+$/i.test(lab.replace(/\s/g, '')) && lab.indexOf(' ') < 0)
      return slugToDisplayName(lab.replace(/\s+/g, '-').toLowerCase());
    var slugI = itemKoDoc && itemKoDoc.byKo && itemKoDoc.byKo[lab];
    if (slugI) return slugToDisplayName(slugI);
    return lab;
  }

  function resolveAbilityEn(modifiersDoc, abilityKoDoc, abilityRaw) {
    var lab = readLabel(abilityRaw);
    if (!lab || lab === '--') return '';
    if (modifiersDoc && modifiersDoc.abilities) {
      var found = findRuleAndSlugInMap(modifiersDoc.abilities, lab);
      if (found && found.slug) return slugToDisplayName(found.slug);
    }
    var slugA = abilityKoDoc && abilityKoDoc.byKo && abilityKoDoc.byKo[lab];
    if (slugA) return slugToDisplayName(slugA);
    if (/^[a-z0-9-]+$/i.test(lab.replace(/\s/g, '')) && lab.indexOf(' ') < 0)
      return slugToDisplayName(lab.replace(/\s+/g, '-').toLowerCase());
    return lab;
  }

  function natureToEnglish(raw, koToSlug) {
    var t = String(raw || '').trim();
    if (!t || t === '--') return '';
    if (/^[a-zA-Z]/.test(t)) {
      var low = t.toLowerCase();
      return low.charAt(0).toUpperCase() + low.slice(1);
    }
    var slug = koToSlug && koToSlug[t];
    if (slug) return slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();
    return t;
  }

  function buildCompactMoveEnIndex(bySlug) {
    var compact = Object.create(null);
    var k;
    for (k in bySlug) {
      if (!Object.prototype.hasOwnProperty.call(bySlug, k)) continue;
      var c = String(k).replace(/-/g, '');
      compact[c] = bySlug[k];
    }
    return compact;
  }

  function moveToEnglish(moveKoDoc, bySlug, compactIdx, koLabel) {
    var k = String(koLabel || '').trim();
    if (!k || k === '--') return '';
    var slug = (moveKoDoc && moveKoDoc.byKo && moveKoDoc.byKo[k]) || '';
    if (slug) {
      if (bySlug[slug]) return bySlug[slug];
      var comp = String(slug).replace(/-/g, '');
      if (compactIdx[comp]) return compactIdx[comp];
      return slugToDisplayName(slug);
    }
    if (/^[a-z0-9-]+$/i.test(k)) {
      var low = k.toLowerCase();
      if (bySlug[low]) return bySlug[low];
      var c2 = low.replace(/-/g, '');
      if (compactIdx[c2]) return compactIdx[c2];
      return slugToDisplayName(low);
    }
    return k;
  }

  function shouldOmitTerastal(value) {
    var t = (value || '').trim();
    if (!t) return true;
    if (/^[-–—.]+$/.test(t)) return true;
    var low = t.toLowerCase();
    if (low === '없음' || low === 'none' || low === 'n/a') return true;
    if (t === '無') return true;
    return false;
  }

  function formatTeraType(raw, typeKoDoc) {
    var t = String(raw || '').trim();
    if (!t) return '';
    if (/^[a-zA-Z]/.test(t)) return slugToDisplayName(t.replace(/\s+/g, '-').toLowerCase());
    var en = typeKoDoc && typeKoDoc.byKo && typeKoDoc.byKo[t];
    if (en) return en;
    return t;
  }

  function getLevel(flat) {
    var poke = flat.pokemon || flat.mon || flat.poke;
    return (
      asInt(flat.level) ||
      asInt(flat.lv) ||
      (poke && asInt(poke.level)) ||
      (poke && asInt(poke.lv)) ||
      null
    );
  }

  /**
   * 스마트누오(챔피언스형) 1:1 노력 → 쇼다운 고전 EV의 “증가 실수치” g(EV).
   * 약 50레벨 기준 계단: EV 4당 첫 1칸, 이후 8EV당 1칸 → floor((EV+4)/8), 상한 252.
   */
  function classicBoostFromEv(ev) {
    var e = ev | 0;
    if (e < 0) e = 0;
    else if (e > 252) e = 252;
    return Math.floor((e + 4) / 8);
  }

  function minClassicEvForNuoBoost(b) {
    var k = b | 0;
    if (k <= 0) return 0;
    if (k >= 32) return 252;
    return 8 * k - 4;
  }

  /** 구형 총합 510 중 2는 실수치에 반영되지 않음 → 유효 상한 508. */
  var MAX_CLASSIC_EV_TOTAL = 508;

  /** 종목당 0~32, 합 ≤66. 초과 시 Spe→HP 순으로 깎음. */
  function clampNuoBoostsSix(raw) {
    var b = [];
    var i;
    for (i = 0; i < 6; i++) {
      var v = raw[i] | 0;
      if (v < 0) v = 0;
      else if (v > 32) v = 32;
      b.push(v);
    }
    var sum = 0;
    for (i = 0; i < 6; i++) sum += b[i];
    var j = 5;
    while (sum > 66 && j >= 0) {
      if (b[j] > 0) {
        b[j]--;
        sum--;
      } else {
        j--;
      }
    }
    return b;
  }

  function sumMinClassicEvSix(bArr) {
    var s = 0;
    var i;
    for (i = 0; i < 6; i++) {
      s += minClassicEvForNuoBoost(bArr[i]);
    }
    return s;
  }

  /**
   * sum(minClassic) ≤ 508 이 될 때까지 누오 증가칸 b를 깎음.
   * invested[i]인 종목은 b를 1 미만으로 내리지 않음(쇼다운에서도 같은 종목 수 유지).
   * HP가 32(풀)면 후보에서 HP 제외 → 막히면 HP 포함. 그 외는 b 최소·동률 시 뒤쪽 인덱스 우선.
   */
  function reduceNuoBoostsUntilClassicCap(b, invested) {
    var guard = 0;
    while (sumMinClassicEvSix(b) > MAX_CLASSIC_EV_TOTAL && guard < 256) {
      guard++;
      function buildCand(allowHpBlock) {
        var c = [];
        var j;
        for (j = 0; j < 6; j++) {
          if (b[j] <= 0) continue;
          if (invested[j] && b[j] <= 1) continue;
          if (!allowHpBlock && j === 0 && b[0] >= 32) continue;
          c.push(j);
        }
        return c;
      }
      var cand = buildCand(false);
      if (!cand.length) cand = buildCand(true);
      if (!cand.length) break;
      var pick = cand[0];
      var ci;
      for (ci = 1; ci < cand.length; ci++) {
        var idx = cand[ci];
        if (b[idx] < b[pick]) pick = idx;
        else if (b[idx] === b[pick] && idx > pick) pick = idx;
      }
      b[pick]--;
    }
  }

  /** g(EV)에 맞는 최소 EV(4+8n-4)만 남김. 잉여 1~3 제거. */
  function canonicalizeClassicEvInPlace(e) {
    var i;
    for (i = 0; i < 6; i++) {
      var g = classicBoostFromEv(e[i]);
      e[i] = minClassicEvForNuoBoost(g);
    }
  }

  /**
   * 누오 목표 증가칸 b[6] → 쇼다운 EV[6] (유효 합 ≤508, 종목별 min EV만 출력).
   * 클램프 직후 b[i]>0인 종목 집합과 쇼다운에서 EV>0인 종목 집합을 동일하게 유지(추가·삭제 없음).
   */
  function nuoBoostsToShowdownEvs(rawSix) {
    var b = clampNuoBoostsSix(rawSix);
    var invested = [];
    var iq;
    for (iq = 0; iq < 6; iq++) {
      invested.push(b[iq] > 0);
    }
    var bWork = b.slice();
    reduceNuoBoostsUntilClassicCap(bWork, invested);

    var sumMin = sumMinClassicEvSix(bWork);
    if (sumMin <= MAX_CLASSIC_EV_TOTAL) {
      var outMin = [];
      var si;
      for (si = 0; si < 6; si++) {
        outMin.push(minClassicEvForNuoBoost(bWork[si]));
      }
      return outMin;
    }

    var INF = 1e9;
    var MAX_T = MAX_CLASSIC_EV_TOTAL;
    var N = 6;
    var pen = [];
    var gsum = [];
    var pickEv = [];
    var prevT = [];
    var ii;
    var tt;
    for (ii = 0; ii <= N; ii++) {
      pen[ii] = [];
      gsum[ii] = [];
      pickEv[ii] = [];
      prevT[ii] = [];
      for (tt = 0; tt <= MAX_T; tt++) {
        pen[ii][tt] = INF;
        gsum[ii][tt] = -1;
        pickEv[ii][tt] = 0;
        prevT[ii][tt] = 0;
      }
    }
    pen[0][0] = 0;
    gsum[0][0] = 0;

    var i;
    var t;
    var ev;
    var evLo;
    var evHi;
    var nt;
    var p;
    var gs;
    for (i = 0; i < N; i++) {
      if (invested[i]) {
        evLo = 4;
        evHi = 252;
      } else {
        evLo = 0;
        evHi = 0;
      }
      for (t = 0; t <= MAX_T; t++) {
        if (pen[i][t] >= INF) continue;
        for (ev = evLo; ev <= evHi; ev++) {
          nt = t + ev;
          if (nt > MAX_T) break;
          p = pen[i][t] + Math.abs(classicBoostFromEv(ev) - bWork[i]);
          gs = gsum[i][t] + classicBoostFromEv(ev);
          var better = p < pen[i + 1][nt] || (p === pen[i + 1][nt] && gs > gsum[i + 1][nt]);
          if (better) {
            pen[i + 1][nt] = p;
            gsum[i + 1][nt] = gs;
            pickEv[i + 1][nt] = ev;
            prevT[i + 1][nt] = t;
          }
        }
      }
    }

    var bestT = -1;
    for (t = 0; t <= MAX_T; t++) {
      if (pen[N][t] >= INF) continue;
      if (bestT < 0) {
        bestT = t;
        continue;
      }
      if (
        pen[N][t] < pen[N][bestT] ||
        (pen[N][t] === pen[N][bestT] && gsum[N][t] > gsum[N][bestT]) ||
        (pen[N][t] === pen[N][bestT] && gsum[N][t] === gsum[N][bestT] && t > bestT)
      ) {
        bestT = t;
      }
    }

    if (bestT < 0) {
      return [0, 0, 0, 0, 0, 0];
    }

    var outDp = [0, 0, 0, 0, 0, 0];
    var curT = bestT;
    for (i = N - 1; i >= 0; i--) {
      outDp[i] = pickEv[i + 1][curT];
      curT = prevT[i + 1][curT];
    }
    canonicalizeClassicEvInPlace(outDp);
    return outDp;
  }

  function oneSet(slot, ctx) {
    if (!SR || typeof SR.isSlotEmpty !== 'function' || SR.isSlotEmpty(slot)) return '';
    var s = SR.flattenSlot(slot);
    var species = speciesEnglishFromSlot(s);
    if (!species) species = 'Pokemon';

    var itemStr = resolveItemEn(ctx.modifiersDocument, ctx.itemKoDoc, s.equipment || s.item || s.Item || s.hold);
    var head = itemStr ? species + ' @ ' + itemStr : species;

    var lines = [head];
    var ab = resolveAbilityEn(ctx.modifiersDocument, ctx.abilityKoDoc, s.ability || s.ab || s.Ability);
    if (ab) lines.push('Ability: ' + ab);

    var lv = getLevel(s);
    if (lv != null && lv > 0) lines.push('Level: ' + lv);

    var nat = natureToEnglish(readLabel(s.personality || s.nature || s.Nature), ctx.koToSlugNature);
    if (nat) lines.push(nat + ' Nature');

    /* EV 줄: 누오 → PS 고전(유효 508; 510 중 2는 미반영). g=floor((EV+4)/8), 약 50레벨 근사. */
    var nuoEvs = typeof SR.getEvValuesSix === 'function' ? SR.getEvValuesSix(s) : [0, 0, 0, 0, 0, 0];
    var evs = nuoBoostsToShowdownEvs(nuoEvs);
    var abbr = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
    var evParts = [];
    var ei;
    for (ei = 0; ei < 6; ei++) {
      if (evs[ei]) evParts.push(evs[ei] + ' ' + abbr[ei]);
    }
    if (evParts.length) lines.push('EVs: ' + evParts.join(' / '));

    var ter =
      typeof SR.teraLine === 'function'
        ? SR.teraLine(s)
        : String(s.terastal || s.tera || s.teraType || '').trim();
    if (ter && !shouldOmitTerastal(ter)) lines.push('Tera Type: ' + formatTeraType(ter, ctx.typeKoDoc));

    var moves = SR.getMoves ? SR.getMoves(slot) : ['', '', '', ''];
    var mi;
    for (mi = 0; mi < 4; mi++) {
      var en = moveToEnglish(ctx.moveKoDoc, ctx.bySlugMove, ctx.compactMove, moves[mi]);
      if (en) lines.push('- ' + en);
    }

    return lines.join('\n');
  }

  /**
   * @param {object[]} slots
   * @param {{ modifiersDocument: object, moveKoDoc: object, moveSlugToEnDoc: object, natureKoDoc: object, itemKoDoc?: object, abilityKoDoc?: object, typeKoDoc?: object }} opts
   */
  function buildShowdownPaste(slots, opts) {
    if (!SR) return '';
    opts = opts || {};
    var mod = opts.modifiersDocument || { items: {}, abilities: {} };
    var moveKo = opts.moveKoDoc || { byKo: {} };
    var moveEn = (opts.moveSlugToEnDoc && opts.moveSlugToEnDoc.bySlug) || {};
    var natDoc = opts.natureKoDoc || {};
    var koToSlugNature = natDoc.koToSlug || {};
    var itemKoDoc = opts.itemKoDoc || { byKo: {} };
    var abilityKoDoc = opts.abilityKoDoc || { byKo: {} };
    var typeKoDoc = opts.typeKoDoc || { byKo: {} };

    var ctx = {
      modifiersDocument: mod,
      moveKoDoc: moveKo,
      bySlugMove: moveEn,
      compactMove: buildCompactMoveEnIndex(moveEn),
      koToSlugNature: koToSlugNature,
      itemKoDoc: itemKoDoc,
      abilityKoDoc: abilityKoDoc,
      typeKoDoc: typeKoDoc,
    };

    var list = Array.isArray(slots) ? slots : [];
    var blocks = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var block = oneSet(list[i], ctx);
      if (block) blocks.push(block);
    }
    return blocks.join('\n\n');
  }

  global.buildShowdownPaste = buildShowdownPaste;
})(typeof globalThis !== 'undefined' ? globalThis : self);
