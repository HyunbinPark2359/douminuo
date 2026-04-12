/**
 * Smartnuo GET /api/party/share/:id JSON → formatSingleSample 이 기대하는 줄글.
 * 실제 페이로드 필드명은 사이트 변경 시 shareToRaw.js 만 조정하면 됨.
 */
(function (global) {
  'use strict';

  var STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  var STAT_LABELS_KO = ['HP', '공격', '방어', '특수공격', '특수방어', '스피드'];

  function asInt(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  function str(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.name != null) return str(v.name);
    if (typeof v === 'object' && v.label != null) return str(v.label);
    if (typeof v === 'object' && v.title != null) return str(v.title);
    return String(v).trim();
  }

  function unwrapShareJson(j) {
    if (!j) throw new Error('empty_response');
    if (j.error === true || j.error === 'true') throw new Error('share_not_found');
    if (j.error && j.error !== false) throw new Error(String(j.error));
    return j.data !== undefined ? j.data : j;
  }

  /**
   * @returns {{ type: 'party', slots: object[] } | { type: 'single', slot: object }}
   */
  function classifyShareGetResponse(j) {
    var pack = unwrapShareJson(j);

    if (pack && pack.all === true && Array.isArray(pack.data)) {
      return { type: 'party', slots: pack.data };
    }

    if (pack && Array.isArray(pack.data) && pack.data.length >= 2) {
      return { type: 'party', slots: pack.data };
    }

    if (pack && Array.isArray(pack.data) && pack.data.length === 1) {
      return { type: 'single', slot: pack.data[0] };
    }

    if (pack && pack.all === false && pack.data && typeof pack.data === 'object' && !Array.isArray(pack.data)) {
      return { type: 'single', slot: pack.data };
    }

    if (pack && typeof pack === 'object' && !Array.isArray(pack)) {
      var inner = pack.data;
      if (inner && typeof inner === 'object' && !Array.isArray(inner) && pack.all !== true) {
        if (inner.moves || inner.species || inner.pokemon || inner.name || inner.item) {
          return { type: 'single', slot: inner };
        }
      }
      if ((pack.moves || pack.species || pack.pokemon || pack.name || pack.item || pack.ability) && !Array.isArray(pack)) {
        return { type: 'single', slot: pack };
      }
    }

    throw new Error('unknown_share_shape');
  }

  function flattenSlot(slot) {
    if (!slot || typeof slot !== 'object') return {};
    var s = Object.assign({}, slot);
    var nested = s.pokemon || s.mon || s.poke;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      s = Object.assign({}, nested, s);
    }
    return s;
  }

  function isSlotEmpty(slot) {
    if (slot == null) return true;
    if (typeof slot !== 'object') return true;
    var s = flattenSlot(slot);
    var keys = Object.keys(s).filter(function (k) {
      var v = s[k];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    });
    return keys.length === 0;
  }

  function getEv(s, key) {
    var evs = s.ev || s.evs || s.EV || s.effort || s.effortValues;
    if (!evs || typeof evs !== 'object' || Array.isArray(evs)) return 0;
    var k = key;
    var v = evs[k] != null ? evs[k] : evs[k.toUpperCase()];
    return asInt(v) != null ? asInt(v) : 0;
  }

  function getReal(s, idx) {
    var st = s.stats || s.finalStats || s.stat || s.real || s.baseStats;
    if (Array.isArray(st) && st.length > idx) {
      var n = asInt(st[idx]);
      return n != null ? n : 0;
    }
    if (st && typeof st === 'object' && !Array.isArray(st)) {
      var kk = STAT_KEYS[idx];
      var v = st[kk] != null ? st[kk] : st[kk.toUpperCase()];
      if (v != null) {
        var n2 = asInt(v);
        return n2 != null ? n2 : 0;
      }
    }
    return 0;
  }

  function displayName(s) {
    var nick = str(s.nickname || s.nick || s.cn || s.displayName);
    if (nick) return nick;
    return str(s.name || s.speciesName || s.species || s.baseName || s.pokemonName || s.label) || '--';
  }

  function speciesTitlePart(s) {
    return str(s.speciesName || s.species || s.name || s.baseName || s.pokemonName) || displayName(s);
  }

  function getMoves(s) {
    var m = s.moves || s.move || s.skills || s.techniques;
    if (!m) return ['', '', '', ''];
    if (!Array.isArray(m)) m = [m];
    var out = ['', '', '', ''];
    for (var i = 0; i < 4 && i < m.length; i++) {
      out[i] = str(m[i]) || '';
    }
    return out;
  }

  function teraLine(s) {
    var t = s.tera || s.terastal || s.teraType || s.TeraType || s.teratype;
    return str(t);
  }

  /**
   * @param {object} slot
   * @param {number} blockIndex1Based
   * @returns {string}
   */
  function shareSlotToRaw(slot, blockIndex1Based) {
    var idx = blockIndex1Based | 0;
    if (idx < 1) idx = 1;

    if (isSlotEmpty(slot)) {
      var linesE = ['#' + idx + ' | --', '특성 : --', '도구 : --', '성격 : --'];
      var si;
      for (si = 0; si < 6; si++) {
        linesE.push(STAT_LABELS_KO[si] + ' : 0 0');
      }
      linesE.push('기술1 : --');
      linesE.push('기술2 : --');
      linesE.push('기술3 : --');
      linesE.push('기술4 : --');
      return linesE.join('\n');
    }

    var s = flattenSlot(slot);
    var title = '#' + idx + ' | ' + speciesTitlePart(s);
    var nameLine = displayName(s);
    var speciesForTitle = speciesTitlePart(s);
    var lines = [title];
    if (nameLine && nameLine !== speciesForTitle && nameLine !== '--') {
      lines.push(nameLine);
    }

    lines.push('특성 : ' + (str(s.ability || s.ab || s.Ability) || '--'));
    lines.push('도구 : ' + (str(s.item || s.Item || s.hold) || '--'));
    lines.push('성격 : ' + (str(s.nature || s.Nature) || '--'));

    var ter = teraLine(s);
    if (ter) lines.push('테라스탈 : ' + ter);

    var i;
    for (i = 0; i < 6; i++) {
      var label = STAT_LABELS_KO[i];
      var kk = STAT_KEYS[i];
      var real = getReal(s, i);
      var ev = getEv(s, kk);
      lines.push(label + ' : ' + real + ' ' + ev);
    }

    var moves = getMoves(s);
    for (i = 0; i < 4; i++) {
      lines.push('기술' + (i + 1) + ' : ' + (moves[i] || '--'));
    }

    return lines.join('\n');
  }

  global.shareToRaw = {
    classifyShareGetResponse: classifyShareGetResponse,
    shareSlotToRaw: shareSlotToRaw,
    isSlotEmpty: isSlotEmpty,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
