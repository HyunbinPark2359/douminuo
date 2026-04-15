/**
 * Smartnuo GET /api/party/share/:id JSON → formatSingleSample 이 기대하는 줄글.
 * 실제 페이로드 필드명은 사이트 변경 시 shareToRaw.js 만 조정하면 됨.
 */
(function (global) {
  'use strict';

  var STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  /** Smartnuo pokemon.stats 키 (value=노력, real=실수치) */
  var SMARTNUO_STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'];
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

  function extractPsId(s) {
    var m = String(s).match(/[#&?]ps=([^&#'"\s]+)/i);
    return m ? m[1].trim() : null;
  }

  function normalizePartyUrlInput(input) {
    var strIn = String(input || '').trim();
    if (!strIn) return null;
    if (/^https?:\/\//i.test(strIn)) return strIn;
    if (/^#ps=/i.test(strIn)) return 'https://smartnuo.com/' + strIn;
    return 'https://smartnuo.com/#ps=' + encodeURIComponent(strIn);
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

    /** 단일 샘플: { slot, data: { sampleName, pokemon, nameKr, movesKr } } */
    if (pack && typeof pack.slot === 'number' && pack.data && pack.data.pokemon) {
      return { type: 'single', slot: pack.data };
    }

    if (Array.isArray(pack)) {
      if (pack.length >= 2) return { type: 'party', slots: pack };
      if (pack.length === 1) return { type: 'single', slot: pack[0] };
      throw new Error('unknown_share_shape');
    }

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
    var nested = slot.pokemon || slot.mon || slot.poke;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.assign({}, nested, slot);
    }
    return Object.assign({}, slot);
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
    var v = evs[key] != null ? evs[key] : evs[key.toUpperCase()];
    return asInt(v) != null ? asInt(v) : 0;
  }

  /** Smartnuo stats.hp = { value: 노력, real: 실수치 } */
  function getRealEvSmartnuo(s, statIdx) {
    var st = s.stats;
    var apiKey = SMARTNUO_STAT_KEYS[statIdx];
    if (st && st[apiKey] && typeof st[apiKey] === 'object') {
      var o = st[apiKey];
      var evNum = asInt(o.value);
      if (evNum == null) evNum = asInt(o.effort_value);
      if (evNum == null) evNum = asInt(o.effort);
      return {
        real: asInt(o.real) != null ? asInt(o.real) : 0,
        ev: evNum != null ? evNum : 0,
      };
    }
    return {
      real: getRealLegacy(s, statIdx),
      ev: getEv(s, STAT_KEYS[statIdx]),
    };
  }

  function getRealLegacy(s, idx) {
    var st = s.stats || s.finalStats || s.stat || s.real || s.baseStats;
    if (Array.isArray(st) && st.length > idx) {
      var n = asInt(st[idx]);
      return n != null ? n : 0;
    }
    if (st && typeof st === 'object' && !Array.isArray(st)) {
      var kk = STAT_KEYS[idx];
      var v = st[kk] != null ? st[kk] : st[kk.toUpperCase()];
      if (v != null && typeof v !== 'object') {
        var n2 = asInt(v);
        return n2 != null ? n2 : 0;
      }
    }
    return 0;
  }

  function displayName(s) {
    var nick = str(s.nickname || s.nick || s.cn || s.displayName);
    if (nick) return nick;
    return (
      str(s.nameKr || s.speciesName || s.species || s.name || s.baseName || s.pokemonName || s.label) || '--'
    );
  }

  /** 제목 `#n | …` 오른쪽: 샘플명(sampleName) 우선, 없으면 한글 종명 */
  function titleRest(s) {
    return str(s.sampleName) || str(s.nameKr) || str(s.speciesName || s.speciesKo) || str(s.species) || str(s.name) || '--';
  }

  /** 종 이름 줄(한글 우선) */
  function speciesNameLine(s) {
    return str(s.nameKr) || str(s.speciesName || s.speciesKo) || str(s.species) || str(s.name) || '';
  }

  function getMoves(s) {
    if (s.movesKr && Array.isArray(s.movesKr) && s.movesKr.length) {
      var outK = ['', '', '', ''];
      var ki;
      for (ki = 0; ki < 4 && ki < s.movesKr.length; ki++) outK[ki] = str(s.movesKr[ki]);
      return outK;
    }
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
    var t = s.terastal || s.tera || s.teraType || s.TeraType || s.teratype;
    return str(t);
  }

  var REAL_LETTERS_SIX = ['H', 'A', 'B', 'C', 'D', 'S'];

  /**
   * 팀빌더 슬롯 → formatter.formatBulkLinesFromReals 용 실수치 맵.
   * @param {object} slot
   * @returns {Record<string, number>}
   */
  function realByLetterFromSlot(slot) {
    if (isSlotEmpty(slot)) return {};
    var s = flattenSlot(slot);
    var out = {};
    var i;
    for (i = 0; i < 6; i++) {
      var pr = getRealEvSmartnuo(s, i);
      var n = pr && pr.real;
      if (n != null && !isNaN(n)) out[REAL_LETTERS_SIX[i]] = n;
    }
    return out;
  }

  /**
   * @param {object} slot
   * @param {number} blockIndex1Based 파티 슬롯 번호(빈 슬롯 표기용). 비넘버 제목일 때는 1 넘겨도 됨.
   * @param {{ numberedTitle?: boolean }|undefined} opts 파티만 true → `#1 | …` 제목
   * @returns {string}
   */
  function shareSlotToRaw(slot, blockIndex1Based, opts) {
    opts = opts || {};
    var numbered = opts.numberedTitle === true;

    var idx = blockIndex1Based | 0;
    if (idx < 1) idx = 1;

    if (isSlotEmpty(slot)) {
      var headEmpty = numbered ? '#' + idx + ' | --' : '--';
      var linesE = [headEmpty, '특성 : --', '도구 : --', '성격 : --'];
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
    var titleStem = titleRest(s);
    var title = numbered ? '#' + idx + ' | ' + titleStem : titleStem;
    var speciesLine = speciesNameLine(s);
    var lines = [title];
    if (speciesLine && speciesLine !== titleStem) {
      lines.push(speciesLine);
    }

    lines.push('특성 : ' + (str(s.ability || s.ab || s.Ability) || '--'));
    lines.push('도구 : ' + (str(s.equipment || s.item || s.Item || s.hold) || '--'));
    lines.push('성격 : ' + (str(s.personality || s.nature || s.Nature) || '--'));

    var ter = teraLine(s);
    if (ter) lines.push('테라스탈 : ' + ter);

    var i;
    for (i = 0; i < 6; i++) {
      var label = STAT_LABELS_KO[i];
      var pr = getRealEvSmartnuo(s, i);
      lines.push(label + ' : ' + pr.real + ' ' + pr.ev);
    }

    var moves = getMoves(s);
    for (i = 0; i < 4; i++) {
      lines.push('기술' + (i + 1) + ' : ' + (moves[i] || '--'));
    }

    return lines.join('\n');
  }

  /** @returns {number[]} six EV values in order HP, Atk, Def, SpA, SpD, Spe */
  function getEvValuesSix(s) {
    var flat = flattenSlot(s);
    var out = [];
    var i;
    for (i = 0; i < 6; i++) {
      out.push(getRealEvSmartnuo(flat, i).ev);
    }
    return out;
  }

  global.shareToRaw = {
    classifyShareGetResponse: classifyShareGetResponse,
    shareSlotToRaw: shareSlotToRaw,
    isSlotEmpty: isSlotEmpty,
    flattenSlot: flattenSlot,
    getMoves: getMoves,
    getEvValuesSix: getEvValuesSix,
    teraLine: teraLine,
    realByLetterFromSlot: realByLetterFromSlot,
    titleRest: titleRest,
    speciesNameLine: speciesNameLine,
    str: str,
    asInt: asInt,
    extractPsId: extractPsId,
    normalizePartyUrlInput: normalizePartyUrlInput,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
