/* 요약 포맷 로직. 웹 UI는 없음 — extension/formatter.js 와 내용 동일하게 유지 */
(function (global) {
  'use strict';

  var STAT_MAP = [
    { keys: ['HP', 'hp'], letter: 'H' },
    { keys: ['공격'], letter: 'A' },
    { keys: ['방어'], letter: 'B' },
    { keys: ['특수공격', '특공'], letter: 'C' },
    { keys: ['특수방어', '특방'], letter: 'D' },
    { keys: ['스피드'], letter: 'S' },
  ];

  var STAT_ORDER = 'HABCDS';

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

    var includeMovePowers = !!options.includeMovePowers;
    var movePowers = options.movePowers;
    var moveLine = moves
      .map(function (m, idx) {
        var base = trimOrDash(m);
        if (
          includeMovePowers &&
          Array.isArray(movePowers) &&
          movePowers[idx] != null &&
          typeof movePowers[idx] === 'number' &&
          base !== '--'
        ) {
          return base + ' (' + movePowers[idx] + ')';
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
    var parts = [];
    for (var b = 0; b < blocks.length; b++) {
      var blockOpts = options;
      if (bmp && Array.isArray(bmp[b])) {
        blockOpts = Object.assign({}, options, { movePowers: bmp[b] });
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
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
