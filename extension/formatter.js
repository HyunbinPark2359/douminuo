/* 요약 포맷 로직. 웹 UI는 없음 — popup 에서 formatSample 으로 사용 */
(function (global) {
  'use strict';

  var FC = global.nuoFmtCommon;
  var readLabel = FC.readLabel;
  var normalizeMatchKey = FC.normalizeMatchKey;
  var collectHoldLabels = FC.collectHoldLabels;
  var findRuleAndSlugInMap = FC.findRuleAndSlugInMap;

  var STAT_MAP = [
    { keys: ['HP', 'hp'], letter: 'H' },
    { keys: ['공격'], letter: 'A' },
    { keys: ['방어'], letter: 'B' },
    { keys: ['특수공격', '특공'], letter: 'C' },
    { keys: ['특수방어', '특방'], letter: 'D' },
    { keys: ['스피드'], letter: 'S' },
  ];

  var STAT_ORDER = 'HABCDS';

  /** 나무위키·커뮤 관행: (HP실×방어실)/k, (HP실×특방실)/k. 괄호: modifiers.json 도구·특성·패앙·고대활성 등 + 모래날림/눈퍼뜨리기(타입 조건). README「내구력 — 구현 범위」참고. */
  var BULK_REAL_DIVISOR = 0.411;

  function findItemBulkRule(modifiersDoc, itemRaw) {
    if (!modifiersDoc || !modifiersDoc.items) return null;
    var labels = collectHoldLabels(itemRaw);
    var li;
    for (li = 0; li < labels.length; li++) {
      var found = findRuleAndSlugInMap(modifiersDoc.items, labels[li]);
      var r = found && found.rule;
      if (r && (r.bulkDefMul != null || r.bulkSpdMul != null)) return r;
    }
    return null;
  }

  function findAbilityRuleWithSlug(modifiersDoc, abilityRaw) {
    if (!modifiersDoc || !modifiersDoc.abilities) return null;
    var labels = collectHoldLabels(abilityRaw);
    var li;
    for (li = 0; li < labels.length; li++) {
      var found = findRuleAndSlugInMap(modifiersDoc.abilities, labels[li]);
      if (found && found.rule) return found;
    }
    return null;
  }

  function numBulkMul(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0) return fallback;
    return n;
  }

  /** 고대활성·쿼크차지(protosynthesis·quark-drive): 공격·방·특공·특방·스피드만 최고값; 동률 시 공격→방→특공→특방→스피드. 방 최고→물리×, 특방 최고→특수×. */
  function protoQuarkBulkMul(realByLetter, ar) {
    var dM = ar && ar.bulkHighestDefMul != null ? numBulkMul(ar.bulkHighestDefMul, 1.3) : 1.3;
    var sM = ar && ar.bulkHighestSpdMul != null ? numBulkMul(ar.bulkHighestSpdMul, 1.3) : 1.3;
    var order = ['A', 'B', 'C', 'D', 'S'];
    var maxV = -Infinity;
    var i;
    for (i = 0; i < order.length; i++) {
      var v = realByLetter[order[i]];
      if (v == null || isNaN(v)) return { def: 1, spd: 1 };
      if (v > maxV) maxV = v;
    }
    var win = 'S';
    for (i = 0; i < order.length; i++) {
      var L = order[i];
      if (realByLetter[L] === maxV) {
        win = L;
        break;
      }
    }
    if (win === 'B') return { def: dM, spd: 1 };
    if (win === 'D') return { def: 1, spd: sM };
    return { def: 1, spd: 1 };
  }

  /** 초상투영: 종/제목에 주춧돌·우물(영·한) 패턴. */
  function embodyBulkMulFromContext(ctx) {
    var t = normalizeMatchKey(ctx || '');
    if (!t) return { def: 1, spd: 1 };
    if (t.indexOf('주춧돌') !== -1 || t.indexOf('cornerstone') !== -1 || t.indexOf('코너스톤') !== -1) {
      return { def: 1.5, spd: 1 };
    }
    if (t.indexOf('우물') !== -1 || t.indexOf('wellspring') !== -1 || t.indexOf('웰스프링') !== -1) {
      return { def: 1, spd: 1.5 };
    }
    return { def: 1, spd: 1 };
  }

  function bulkMultipliersFromRule(rule) {
    var bd = rule && rule.bulkDefMul != null ? Number(rule.bulkDefMul) : 1;
    var bs = rule && rule.bulkSpdMul != null ? Number(rule.bulkSpdMul) : 1;
    if (isNaN(bd) || bd <= 0) bd = 1;
    if (isNaN(bs) || bs <= 0) bs = 1;
    return { defM: bd, spdM: bs };
  }

  function hasTypeEn(typesArr, want) {
    if (!typesArr || !typesArr.length) return false;
    var w = String(want || '').toLowerCase().trim();
    var ti;
    for (ti = 0; ti < typesArr.length; ti++) {
      if (String(typesArr[ti] || '').toLowerCase().trim() === w) return true;
    }
    return false;
  }

  /** 모래날림(sand-stream)+바위 타입 → 특방×1.5, 눈퍼뜨리기(snow-warning)+얼음 → 방×1.5. 이 두 특성·타입 조합만 적용. */
  function weatherBulkMulSandSnowOnly(aslug, speciesTypesEn) {
    if (!aslug || !speciesTypesEn || !speciesTypesEn.length) return { def: 1, spd: 1 };
    if (aslug === 'sand-stream' && hasTypeEn(speciesTypesEn, 'rock')) return { def: 1, spd: 1.5 };
    if (aslug === 'snow-warning' && hasTypeEn(speciesTypesEn, 'ice')) return { def: 1.5, spd: 1 };
    return { def: 1, spd: 1 };
  }

  function formatOneBulkLine(title, base, buffed) {
    if (buffed === base) return title + ':' + base;
    return title + ':' + base + ' (' + buffed + ')';
  }

  /**
   * @returns {{ physBase: number, specBase: number, physBuffed: number, specBuffed: number }|null}
   */
  function computeBulkPhysSpecBuffed(
    realByLetter,
    modifiersDoc,
    itemRaw,
    abilityRaw,
    speciesTitleContext,
    speciesTypesEn
  ) {
    var h = realByLetter.H;
    var b = realByLetter.B;
    var d = realByLetter.D;
    if (h == null || b == null || d == null) return null;
    var physBase = Math.round((h * b) / BULK_REAL_DIVISOR);
    var specBase = Math.round((h * d) / BULK_REAL_DIVISOR);

    var itemRule = findItemBulkRule(modifiersDoc, itemRaw);
    var defM = 1;
    var spdM = 1;
    if (itemRule) {
      var im = bulkMultipliersFromRule(itemRule);
      defM = im.defM;
      spdM = im.spdM;
    }

    var abFound = findAbilityRuleWithSlug(modifiersDoc, abilityRaw);
    if (abFound) {
      var aslug = abFound.slug;
      var arule = abFound.rule || {};
      if (aslug === 'embody-aspect' && arule.bulkEmbodyAspect) {
        var em = embodyBulkMulFromContext(speciesTitleContext || '');
        defM *= em.def;
        spdM *= em.spd;
      } else if (arule.bulkHighestOfAtkFamily) {
        var pq = protoQuarkBulkMul(realByLetter, arule);
        defM *= pq.def;
        spdM *= pq.spd;
      } else {
        if (arule.bulkDefMul != null) defM *= numBulkMul(arule.bulkDefMul, 1);
        if (arule.bulkSpdMul != null) spdM *= numBulkMul(arule.bulkSpdMul, 1);
      }
      var wx = weatherBulkMulSandSnowOnly(aslug, speciesTypesEn);
      defM *= wx.def;
      spdM *= wx.spd;
    }

    var bEff = Math.round(b * defM);
    var dEff = Math.round(d * spdM);
    var physBuffed = Math.round((h * bEff) / BULK_REAL_DIVISOR);
    var specBuffed = Math.round((h * dEff) / BULK_REAL_DIVISOR);

    return { physBase: physBase, specBase: specBase, physBuffed: physBuffed, specBuffed: specBuffed };
  }

  function formatBulkLinesFromReals(
    realByLetter,
    enabled,
    modifiersDoc,
    itemRaw,
    abilityRaw,
    speciesTitleContext,
    speciesTypesEn
  ) {
    if (!enabled) return '';
    var comp = computeBulkPhysSpecBuffed(
      realByLetter,
      modifiersDoc,
      itemRaw,
      abilityRaw,
      speciesTitleContext,
      speciesTypesEn
    );
    if (!comp) return '';
    return (
      formatOneBulkLine('물리내구력', comp.physBase, comp.physBuffed) +
      '\n' +
      formatOneBulkLine('특수내구력', comp.specBase, comp.specBuffed)
    );
  }

  /** 팀빌더 인라인: 물리·특수 내구 최종값만 `물리/특수` */
  function formatBulkCompactSlash(
    realByLetter,
    enabled,
    modifiersDoc,
    itemRaw,
    abilityRaw,
    speciesTitleContext,
    speciesTypesEn
  ) {
    if (!enabled) return '';
    var comp = computeBulkPhysSpecBuffed(
      realByLetter,
      modifiersDoc,
      itemRaw,
      abilityRaw,
      speciesTitleContext,
      speciesTypesEn
    );
    if (!comp) return '';
    return String(comp.physBuffed) + '/' + String(comp.specBuffed);
  }

  function trimOrDash(s) {
    var t = (s || '').trim();
    return t ? t : '--';
  }

  function parseKeyValueLine(line) {
    var m = line.match(/^(.+?)\s*:\s*(.*)$/);
    if (!m) return null;
    return { key: m[1].trim(), value: m[2].trim() };
  }

  function parseEvFromValue(value) {
    var nums = value.match(/\d+/g);
    if (!nums || nums.length < 2) return null;
    return parseInt(nums[1], 10);
  }

  function parseRealFromValue(value) {
    var nums = value.match(/\d+/g);
    if (!nums || nums.length < 1) return null;
    return parseInt(nums[0], 10);
  }

  function statLetterForKey(key) {
    for (var r = 0; r < STAT_MAP.length; r++) {
      var row = STAT_MAP[r];
      for (var k = 0; k < row.keys.length; k++) {
        var kk = row.keys[k];
        if (key === kk || key.indexOf(kk + ' ') === 0) return row.letter;
      }
    }
    return null;
  }

  /** 테라스탈 줄 생략: 비어 있음, 없음, 대시류 등 */
  function shouldOmitTerastal(value) {
    var t = (value || '').trim();
    if (!t) return true;
    if (/^[-–—.]+$/.test(t)) return true;
    var low = t.toLowerCase();
    if (low === '없음' || low === 'none' || low === 'n/a') return true;
    if (t === '無') return true;
    return false;
  }

  function isNameLine(line) {
    if (!line || line.indexOf(':') !== -1) return false;
    if (parseKeyValueLine(line)) return false;
    var t = line.trim();
    if (/^기술\s*\d/.test(t)) return false;
    return true;
  }

  function extractNameFromTitle(title) {
    var pipe = title.indexOf('|');
    if (pipe === -1) return '';
    return title.slice(pipe + 1).trim();
  }

  /** 줄 앞쪽이 #숫자 로 시작하면 새 샘플 블록의 시작으로 본다. */
  function isSampleTitleLine(trimmed) {
    return /^#\d+/.test(trimmed);
  }

  var BLOCK_SPLIT = '\n---\n';

  function splitIntoSampleBlocks(raw) {
    var normalized = raw.replace(/^\uFEFF/, '').replace(/\s+$/, '');
    if (normalized.indexOf(BLOCK_SPLIT) !== -1) {
      return normalized
        .split(BLOCK_SPLIT)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    }
    var lines = normalized.split(/\r?\n/);
    var starts = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      if (isSampleTitleLine(lines[i].trim())) {
        starts.push(i);
      }
    }
    if (starts.length === 0) {
      var t = normalized;
      return t ? [t] : [];
    }
    var blocks = [];
    for (i = 0; i < starts.length; i++) {
      var from = starts[i];
      var to = i + 1 < starts.length ? starts[i + 1] : lines.length;
      blocks.push(lines.slice(from, to).join('\n'));
    }
    return blocks;
  }

  function movePowerSuffix(cell) {
    if (cell == null) return null;
    if (typeof cell === 'number') return '(' + cell + ')';
    if (
      typeof cell === 'object' &&
      cell !== null &&
      typeof cell.base === 'number' &&
      typeof cell.buffed === 'number'
    ) {
      if (cell.base === cell.buffed) return '(' + cell.base + ')';
      return '(' + cell.base + '->' + cell.buffed + ')';
    }
    return null;
  }

  function formatSingleSample(raw, options) {
    options = options || {};
    var includeRealStats = !!options.includeRealStats;

    var lines = raw.split(/\r?\n/).map(function (l) {
      return l.replace(/\s+$/, '');
    });
    if (!lines.length || !lines[0].trim()) {
      return '';
    }

    var title = lines[0].trim();
    var name = '';
    var ability = { raw: '' };
    var item = { raw: '' };
    var nature = { raw: '' };
    var terastal = { raw: '' };
    var moves = ['', '', '', ''];
    var evParts = [];
    var realByLetter = {};

    var i = 1;
    if (i < lines.length && lines[i].trim()) {
      var candidate = lines[i].trim();
      if (isNameLine(candidate) && !parseKeyValueLine(candidate)) {
        name = candidate;
        i++;
      }
    }

    for (; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var kv = parseKeyValueLine(line);
      if (!kv) continue;

      var key = kv.key.replace(/\s+/g, ' ').trim();
      var val = kv.value;

      if (key === '특성') {
        ability.raw = val;
        continue;
      }
      if (key === '도구') {
        item.raw = val;
        continue;
      }
      if (key === '성격') {
        nature.raw = val;
        continue;
      }
      if (key === '테라스탈') {
        terastal.raw = val;
        continue;
      }

      var moveMatch = key.match(/^기술\s*(\d)/);
      if (moveMatch) {
        var idx = parseInt(moveMatch[1], 10) - 1;
        if (idx >= 0 && idx < 4) moves[idx] = val;
        continue;
      }

      var letter = statLetterForKey(key);
      if (letter) {
        var ev = parseEvFromValue(val);
        if (ev !== null && ev !== 0) evParts.push({ letter: letter, ev: ev });
        var real = parseRealFromValue(val);
        if (real !== null) realByLetter[letter] = real;
      }
    }

    if (!name) name = extractNameFromTitle(title);

    evParts.sort(function (a, b) {
      return STAT_ORDER.indexOf(a.letter) - STAT_ORDER.indexOf(b.letter);
    });
    var evLine = evParts
      .map(function (p) {
        return p.letter + p.ev;
      })
      .join(' ');

    var realStatsLine = '';
    if (includeRealStats) {
      var seq = [];
      var ok = true;
      for (var ri = 0; ri < STAT_ORDER.length; ri++) {
        var L = STAT_ORDER.charAt(ri);
        if (realByLetter[L] === undefined) {
          ok = false;
          break;
        }
        seq.push(String(realByLetter[L]));
      }
      if (ok && seq.length === 6) {
        realStatsLine = seq.join('-');
      }
    }

    var terastalLine = '';
    if (!shouldOmitTerastal(terastal.raw)) {
      terastalLine = '테라스탈: ' + terastal.raw.trim();
    }

    var bulkContext = title.trim() + '\n' + (name || '').trim();
    var bulkBlock = formatBulkLinesFromReals(
      realByLetter,
      !!options.includeBulkStats,
      options.modifiersDocument,
      item.raw,
      ability.raw,
      bulkContext,
      options.speciesTypesEn
    );

    var includeMovePowers = !!options.includeMovePowers;
    var movePowers = options.movePowers;
    var moveLine = moves
      .map(function (m, idx) {
        var base = trimOrDash(m);
        var suf =
          includeMovePowers && Array.isArray(movePowers)
            ? movePowerSuffix(movePowers[idx])
            : null;
        if (suf && base !== '--') {
          return base + ' ' + suf;
        }
        return base;
      })
      .join(' / ');

    var out = [
      title,
      trimOrDash(name) + ' @' + trimOrDash(item.raw),
      trimOrDash(nature.raw) + ' / ' + trimOrDash(ability.raw),
    ];
    if (evLine) out.push(evLine);
    if (realStatsLine) out.push(realStatsLine);
    if (terastalLine) out.push(terastalLine);
    if (bulkBlock) out.push(bulkBlock);
    out.push(moveLine);

    return out.join('\n');
  }

  function formatSample(raw, options) {
    options = options || {};
    var blocks = splitIntoSampleBlocks(raw);
    if (blocks.length === 0) {
      return '';
    }
    var includeUrls = options.includeUrls !== false;
    var partyUrl = includeUrls ? (options.partyUrl && String(options.partyUrl).trim()) || '' : '';
    var sampleUrls = includeUrls && Array.isArray(options.sampleUrls) ? options.sampleUrls : [];

    var bmp = options.blockMovePowers;
    var bst = options.blockSpeciesTypes;
    var parts = [];
    for (var b = 0; b < blocks.length; b++) {
      var blockOpts = Object.assign({}, options);
      if (bmp && Array.isArray(bmp[b])) {
        blockOpts.movePowers = bmp[b];
      } else {
        delete blockOpts.movePowers;
      }
      if (bst && Array.isArray(bst[b])) {
        blockOpts.speciesTypesEn = bst[b];
      } else {
        delete blockOpts.speciesTypesEn;
      }
      var one = formatSingleSample(blocks[b], blockOpts);
      if (!one) continue;
      var su =
        includeUrls && sampleUrls[b] != null ? String(sampleUrls[b]).trim() : '';
      if (su) parts.push(su + '\n' + one);
      else parts.push(one);
    }
    var body = parts.join('\n\n');
    if (partyUrl) return partyUrl + '\n\n' + body;
    return body;
  }

  global.formatSample = formatSample;
  global.formatBulkLinesFromReals = formatBulkLinesFromReals;
  global.formatBulkCompactSlash = formatBulkCompactSlash;
  global.movePowerSuffixFormatter = movePowerSuffix;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
