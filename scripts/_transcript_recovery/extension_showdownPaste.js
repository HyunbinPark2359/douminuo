/* Pokemon Showdown / PokePaste 스타일보내기 (팝업에서 사용) */
(function (global) {
  'use strict';

  var SR = global.shareToRaw;

  function asInt(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  function readLabel(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.name != null) return readLabel(v.name);
    if (typeof v === 'object' && v.label != null) return readLabel(v.label);
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
    function pushRaw(x) {
      var t = readLabel(x);
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

  function resolveItemEn(modifiersDoc, itemRaw) {
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
    return lab;
  }

  function resolveAbilityEn(modifiersDoc, abilityRaw) {
    var lab = readLabel(abilityRaw);
    if (!lab || lab === '--') return '';
    if (modifiersDoc && modifiersDoc.abilities) {
      var found = findRuleAndSlugInMap(modifiersDoc.abilities, lab);
      if (found && found.slug) return slugToDisplayName(found.slug);
    }
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

  function formatTeraType(raw) {
    var t = String(raw || '').trim();
    if (!t) return '';
    if (/^[a-zA-Z]/.test(t)) return slugToDisplayName(t.replace(/\s+/g, '-').toLowerCase());
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

  function oneSet(slot, ctx) {
    if (!SR || typeof SR.isSlotEmpty !== 'function' || SR.isSlotEmpty(slot)) return '';
    var s = SR.flattenSlot(slot);
    var species = speciesEnglishFromSlot(s);
    if (!species) species = 'Pokemon';

    var itemStr = resolveItemEn(ctx.modifiersDocument, s.equipment || s.item || s.Item || s.hold);
    var head = itemStr ? species + ' @ ' + itemStr : species;

    var lines = [head];
    var ab = resolveAbilityEn(ctx.modifiersDocument, s.ability || s.ab || s.Ability);
    if (ab) lines.push('Ability: ' + ab);

    var lv = getLevel(s);
    if (lv != null && lv > 0) lines.push('Level: ' + lv);

    var nat = natureToEnglish(readLabel(s.personality || s.nature || s.Nature), ctx.koToSlugNature);
    if (nat) lines.push(nat + ' Nature');

    var evs = typeof SR.getEvValuesSix === 'function' ? SR.getEvValuesSix(s) : [0, 0, 0, 0, 0, 0];
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
    if (ter) lines.push('Tera Type: ' + formatTeraType(ter));

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
   * @param {{ modifiersDocument: object, moveKoDoc: object, moveSlugToEnDoc: object, natureKoDoc: object }} opts
   */
  function buildShowdownPaste(slots, opts) {
    if (!SR) return '';
    opts = opts || {};
    var mod = opts.modifiersDocument || { items: {}, abilities: {} };
    var moveKo = opts.moveKoDoc || { byKo: {} };
    var moveEn = (opts.moveSlugToEnDoc && opts.moveSlugToEnDoc.bySlug) || {};
    var natDoc = opts.natureKoDoc || {};
    var koToSlugNature = natDoc.koToSlug || {};

    var ctx = {
      modifiersDocument: mod,
      moveKoDoc: moveKo,
      bySlugMove: moveEn,
      compactMove: buildCompactMoveEnIndex(moveEn),
      koToSlugNature: koToSlugNature,
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
