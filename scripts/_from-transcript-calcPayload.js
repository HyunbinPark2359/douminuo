/**
 * Service worker: 샘플 공유 URL → 계산기 기입용 페이로드.
 * globalThis.nuoCalcPayload.buildSidePayloads(atkUrl, defUrl, docs)
 */
(function () {
  'use strict';

  var SR = globalThis.shareToRaw;
  var moveMetaCache = Object.create(null);

  function str(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && v.name != null) return str(v.name);
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

  function fetchShareGET(fullUrl) {
    var id = extractPsId(fullUrl);
    if (!id) return Promise.reject(new Error('no_ps_id'));
    var baseUrl = new URL(normalizePartyUrlInput(fullUrl));
    return fetch(baseUrl.origin + '/api/party/share/' + encodeURIComponent(id), {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error('GET ' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
      });
      return res.json();
    });
  }

  function asInt(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }

  var SMARTNUO_STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'];

  function flattenSlot(slot) {
    if (!slot || typeof slot !== 'object') return {};
    var nested = slot.pokemon || slot.mon || slot.poke;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.assign({}, nested, slot);
    }
    return Object.assign({}, slot);
  }

  function getIvForStat(flat, statIdx) {
    var defIv = 31;
    var st = flat.stats;
    var apiKey = SMARTNUO_STAT_KEYS[statIdx];
    if (st && st[apiKey] && typeof st[apiKey] === 'object') {
      var iv = asInt(st[apiKey].individual_value);
      if (iv != null) return Math.max(0, Math.min(31, iv));
    }
    var ivs = flat.iv || flat.ivs || flat.IV || flat.individual_value || flat.individualValues;
    if (ivs && typeof ivs === 'object' && !Array.isArray(ivs)) {
      var keys = [
        ['hp', 'HP'],
        ['atk', 'attack', 'Atk'],
        ['def', 'defense', 'Def'],
        ['spa', 'special_attack', 'spatk', 'SpA'],
        ['spd', 'special_defense', 'spdef', 'SpD'],
        ['spe', 'speed', 'Spe'],
      ][statIdx];
      var ki;
      for (ki = 0; ki < keys.length; ki++) {
        var v = asInt(ivs[keys[ki]]);
        if (v != null) return Math.max(0, Math.min(31, v));
      }
    }
    return defIv;
  }

  function getIvSix(flat) {
    var out = [];
    var i;
    for (i = 0; i < 6; i++) {
      out.push(getIvForStat(flat, i));
    }
    return out;
  }

  function speciesKoFromFlat(flat) {
    return (
      str(flat.nameKr) ||
      str(flat.speciesName || flat.speciesKo) ||
      str(flat.species) ||
      str(flat.name) ||
      ''
    );
  }

  function natureKoFromFlat(flat) {
    return str(flat.personality || flat.nature || flat.Nature);
  }

  function abilityKoFromFlat(flat) {
    return str(flat.ability || flat.ab || flat.Ability);
  }

  function itemKoFromFlat(flat) {
    return str(flat.equipment || flat.item || flat.Item || flat.hold);
  }

  function levelFromFlat(flat) {
    var n = asInt(flat.level || flat.lv || flat.Level);
    return n != null && n > 0 ? n : 50;
  }

  function personalityScalar(mul) {
    if (mul > 1) return 1.1;
    if (mul < 1) return 0.9;
    return 1;
  }

  function natureRowForKo(natureKo, natureKoDoc, natureStatMulDoc) {
    var slug = (natureKoDoc && natureKoDoc.koToSlug && natureKoDoc.koToSlug[natureKo]) || '';
    var row =
      slug &&
      natureStatMulDoc &&
      natureStatMulDoc.bySlug &&
      natureStatMulDoc.bySlug[slug]
        ? natureStatMulDoc.bySlug[slug]
        : null;
    return { slug: slug, row: row };
  }

  function fetchMoveMetaBySlug(slug) {
    if (!slug) return Promise.resolve(null);
    var k = String(slug).toLowerCase();
    if (moveMetaCache[k]) return Promise.resolve(moveMetaCache[k]);
    var url = 'https://pokeapi.co/api/v2/move/' + encodeURIComponent(k) + '/';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (j) {
        if (!j) {
          moveMetaCache[k] = null;
          return null;
        }
        var dc = j.damage_class && j.damage_class.name ? String(j.damage_class.name).toLowerCase() : '';
        var typ = j.type && j.type.name ? String(j.type.name).toLowerCase() : 'normal';
        var power = j.power;
        var meta = {
          slug: k,
          nameEn: j.name || k,
          power: power,
          damage_class: dc,
          typeEn: typ,
        };
        moveMetaCache[k] = meta;
        return meta;
      })
      .catch(function () {
        moveMetaCache[k] = null;
        return null;
      });
  }

  function slugFromKoMove(ko, moveKoDoc) {
    if (!ko || !moveKoDoc || !moveKoDoc.byKo) return null;
    return moveKoDoc.byKo[ko] || null;
  }

  function firstDamagingMoveMeta(slot, moveKoDoc) {
    var moves = SR.getMoves(slot);
    var chain = Promise.resolve(null);
    var mi;
    for (mi = 0; mi < moves.length; mi++) {
      (function (idx) {
        chain = chain.then(function (found) {
          if (found) return found;
          var ko = (moves[idx] || '').trim();
          if (!ko || ko === '--') return null;
          var slug = slugFromKoMove(ko, moveKoDoc);
          return fetchMoveMetaBySlug(slug || '').then(function (meta) {
            if (!meta) return null;
            if (meta.damage_class === 'status') return null;
            if (meta.power != null && meta.power !== '' && asInt(meta.power) === 0) return null;
            return { ko: ko, slug: slug || meta.slug, meta: meta };
          });
        });
      })(mi);
    }
    return chain;
  }

  function buildAttackerMovePayload(pack) {
    if (!pack || !pack.meta) return null;
    var m = pack.meta;
    var dc = m.damage_class === 'special' ? 'special' : 'physical';
    return {
      name: m.slug || 'tackle',
      kr: pack.ko || '',
      power: m.power != null && m.power !== '' ? asInt(m.power) : 40,
      type: m.typeEn || 'normal',
      damageClass: dc,
    };
  }

  function buildOneSide(urlText, docs, role) {
    var full = normalizePartyUrlInput(urlText);
    if (!full) return Promise.resolve({ error: 'empty_url' });

    return fetchShareGET(full).then(function (j) {
      var cls = SR.classifyShareGetResponse(j);
      if (cls.type === 'party') {
        return { error: 'party_url_not_supported' };
      }
      if (cls.type !== 'single') {
        return { error: 'unknown_share_shape' };
      }
      var slot = cls.slot;
      if (SR.isSlotEmpty(slot)) {
        return { error: 'empty_slot' };
      }
      var flat = flattenSlot(slot);
      var speciesKo = speciesKoFromFlat(flat);
      if (!speciesKo) {
        return { error: 'no_species' };
      }

      var evs = SR.getEvValuesSix(slot);
      var ivs = getIvSix(flat);
      var natureKo = natureKoFromFlat(flat);
      var nr = natureRowForKo(natureKo, docs.natureKoDoc, docs.natureStatMulDoc);
      var level = levelFromFlat(flat);

      return firstDamagingMoveMeta(slot, docs.moveKoDoc).then(function (movePack) {
        var physicalMove = true;
        if (movePack && movePack.meta && movePack.meta.damage_class === 'special') {
          physicalMove = false;
        }

        var attackerPersonality = 1;
        var defenderPersonality = 1;
        if (nr.row) {
          if (role === 'attacker') {
            attackerPersonality = personalityScalar(physicalMove ? nr.row.atk : nr.row.spa);
          } else {
            defenderPersonality = personalityScalar(physicalMove ? nr.row.def : nr.row.spd);
          }
        }

        var out = {
          speciesKo: speciesKo,
          evs: evs,
          ivs: ivs,
          level: level,
          abilityKo: abilityKoFromFlat(flat),
          itemKo: itemKoFromFlat(flat),
          physicalMove: physicalMove,
          attackerPersonality: attackerPersonality,
          defenderPersonality: defenderPersonality,
          attackerMove: role === 'attacker' ? buildAttackerMovePayload(movePack) : null,
        };

        if (role === 'defender') {
          delete out.attackerPersonality;
          delete out.attackerMove;
        } else {
          delete out.defenderPersonality;
        }

        return out;
      });
    });
  }

  /**
   * @param {string} atkUrl
   * @param {string} defUrl
   * @param {{ natureKoDoc: object, natureStatMulDoc: object, moveKoDoc: object }} docs
   */
  function buildSidePayloads(atkUrl, defUrl, docs) {
    docs = docs || {};
    var pAtk = (atkUrl || '').trim()
      ? buildOneSide(atkUrl, docs, 'attacker')
      : Promise.resolve(null);
    var pDef = (defUrl || '').trim()
      ? buildOneSide(defUrl, docs, 'defender')
      : Promise.resolve(null);

    return Promise.all([pAtk, pDef]).then(function (pair) {
      var attacker = pair[0];
      var defender = pair[1];
      if (defender && !defender.error && attacker && !attacker.error) {
        defender.incomingPhysical = attacker.physicalMove !== false;
      }
      return { attacker: attacker, defender: defender };
    });
  }

  globalThis.nuoCalcPayload = {
    buildSidePayloads: buildSidePayloads,
  };
})();
