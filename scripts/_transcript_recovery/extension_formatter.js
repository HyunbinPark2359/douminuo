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

  function formatSample(raw) {
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
    var moves = ['', '', '', ''];
    var evParts = [];

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
      }
    }

    if (!name) name = extractNameFromTitle(title);

    var order = 'HABCDS';
    evParts.sort(function (a, b) {
      return order.indexOf(a.letter) - order.indexOf(b.letter);
    });
    var evLine = evParts
      .map(function (p) {
        return p.letter + p.ev;
      })
      .join(' ');
    var moveLine = moves
      .map(function (m) {
        return trimOrDash(m);
      })
      .join(' / ');

    var out = [
      title,
      trimOrDash(name) + ' @' + trimOrDash(item.raw),
      trimOrDash(nature.raw) + ' / ' + trimOrDash(ability.raw),
      evLine,
      moveLine,
    ];

    return out.join('\n');
  }

  global.formatSample = formatSample;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
