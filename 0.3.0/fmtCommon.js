/**
 * formatter.js · simpleMovePower.js 공통: 도구/특성/항목 라벨 정규화.
 * popup: fmtCommon → formatter 순서. SW: fmtCommon → simpleMovePower 순서.
 */
(function (g) {
  'use strict';

  function readLabel(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.name != null) return readLabel(v.name);
    if (typeof v === 'object' && v.label != null) return readLabel(v.label);
    if (typeof v === 'object' && v.title != null) return readLabel(v.title);
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

  g.nuoFmtCommon = {
    readLabel: readLabel,
    normalizeMatchKey: normalizeMatchKey,
    slugifyForMatch: slugifyForMatch,
    collectHoldLabels: collectHoldLabels,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
