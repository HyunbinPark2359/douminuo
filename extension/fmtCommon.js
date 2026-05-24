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
    // F50 (2026-05-24): 리뉴얼 후 slot.equipment/ability 등 hold 객체의 한칭은 `kr` 필드.
    // 다른 코드(`shareToRaw.koFromMaybeObj`, `teamBuilderInlineAnnot.moveDisplayNamesFromSlot`,
    // `teamBuilderBridge.augmentSlotWithDex`) 가 이미 `kr` 을 1차 진실로 다룸 — 본 함수만
    // 누락이었어 화력증강도구(목탄/구애머리띠 등) 결정력 매치가 끊겨 있었음.
    // 'kr' 가 first-match-wins (seen 가드) 라 옛 공유 URL 의 문자열 케이스는 무영향.
    var keys = [
      'kr',
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

  /** F38: map 객체당 정규화 키 인덱스 — slug in map 순서 first-set-wins. */
  var sectionIxCache = new WeakMap();

  function buildSectionIx(map) {
    var out = Object.create(null);
    if (!map || typeof map !== 'object') return out;
    function push(rawKey, slug, rule) {
      if (rawKey == null || rawKey === '') return;
      var key = normalizeMatchKey(rawKey);
      if (key && !out[key]) out[key] = { slug: String(slug), rule: rule };
    }
    var slug;
    var rule;
    var ai;
    for (slug in map) {
      if (!Object.prototype.hasOwnProperty.call(map, slug)) continue;
      rule = map[slug];
      push(slug, slug, rule);
      push(String(slug).replace(/-/g, ' '), slug, rule);
      push(slugifyForMatch(slug), slug, rule);
      if (rule && rule.nameKo) push(rule.nameKo, slug, rule);
      if (rule && Array.isArray(rule.aliases)) {
        for (ai = 0; ai < rule.aliases.length; ai++) push(rule.aliases[ai], slug, rule);
      }
    }
    return out;
  }

  /**
   * modifiers.json 의 items/abilities 맵에서 라벨(한글/영문/별칭)에 해당하는 { slug, rule } 검색.
   * formatter.js / showdownPaste.js / simpleMovePower.js 공용.
   */
  function findRuleAndSlugInMap(map, label) {
    var lab = readLabel(label);
    if (!lab || lab === '--') return null;
    if (!map || typeof map !== 'object') return null;

    var want = normalizeMatchKey(lab);
    var wantSlug = slugifyForMatch(lab);
    var ix = sectionIxCache.get(map);
    if (!ix) {
      ix = buildSectionIx(map);
      sectionIxCache.set(map, ix);
    }
    return ix[want] || ix[wantSlug] || null;
  }

  g.nuoFmtCommon = {
    readLabel: readLabel,
    normalizeMatchKey: normalizeMatchKey,
    slugifyForMatch: slugifyForMatch,
    collectHoldLabels: collectHoldLabels,
    findRuleAndSlugInMap: findRuleAndSlugInMap,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
