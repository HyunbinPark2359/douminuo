/**
 * Service worker: 샘플 공유 URL → 계산기 기입용 페이로드.
 * globalThis.nuoCalcPayload.buildSidePayloads(atkUrl, defUrl, docs)
 */
(function () {
  'use strict';

  var SR = globalThis.shareToRaw;
  var moveMetaCache = Object.create(null);

  var KO_SLUG_STORAGE_KEY = 'nuo_calc_move_ko_slug_map';
  var KO_SLUG_MIN_KEYS = 650;
  var POKEAPI_MOVE_PAGE = 100;
  var POKEAPI_MOVE_FETCH_CHUNK = 12;

  var koSlugMapMem = null;
  var koSlugBuildPromise = null;

  function str(v) {
    return SR.str(v);
  }

  function asInt(v) {
    return SR.asInt(v);
  }

  function fetchShareGET(fullUrl) {
    var id = SR.extractPsId(fullUrl);
    if (!id) return Promise.reject(new Error('no_ps_id'));
    var baseUrl = new URL(SR.normalizePartyUrlInput(fullUrl));
    return fetch(baseUrl.origin + '/api/party/share/' + encodeURIComponent(id), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error('GET ' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
      });
      return res.json();
    });
  }

  var SMARTNUO_STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'];

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

  /**
   * modifiers.json abilities: nameKo 일치 시 setsWeather / setsTerrain (simpleMovePower 와 동일 키).
   * @returns {{ abilityWeatherKey: string|null, abilityTerrainKey: string|null }}
   */
  function envKeysFromAbilityKo(abilityKo, modifiersDoc) {
    var out = { abilityWeatherKey: null, abilityTerrainKey: null };
    var k = str(abilityKo);
    if (!k || !modifiersDoc || !modifiersDoc.abilities || typeof modifiersDoc.abilities !== 'object') {
      return out;
    }
    var abs = modifiersDoc.abilities;
    var slug;
    for (slug in abs) {
      if (!Object.prototype.hasOwnProperty.call(abs, slug)) continue;
      var r = abs[slug];
      if (!r || typeof r !== 'object') continue;
      if (String(r.nameKo || '').trim() !== k) continue;
      if (r.setsWeather != null && String(r.setsWeather).trim() !== '') {
        out.abilityWeatherKey = String(r.setsWeather).toLowerCase().trim();
      }
      if (r.setsTerrain != null && String(r.setsTerrain).trim() !== '') {
        out.abilityTerrainKey = String(r.setsTerrain).toLowerCase().trim();
      }
      break;
    }
    return out;
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

  function moveMetaFromJson(j) {
    if (!j || j.name == null) return null;
    var k = String(j.name).toLowerCase();
    var dc = j.damage_class && j.damage_class.name ? String(j.damage_class.name).toLowerCase() : '';
    var typ = j.type && j.type.name ? String(j.type.name).toLowerCase() : 'normal';
    return {
      slug: k,
      nameEn: j.name || k,
      power: j.power,
      damage_class: dc,
      typeEn: typ,
    };
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
        var meta = moveMetaFromJson(j);
        moveMetaCache[k] = meta;
        return meta;
      })
      .catch(function () {
        moveMetaCache[k] = null;
        return null;
      });
  }

  function mapKeyCount(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    var n = 0;
    var k;
    for (k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) n++;
    }
    return n;
  }

  function loadKoSlugMapFromStorage() {
    return new Promise(function (resolve) {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve(null);
          return;
        }
        chrome.storage.local.get([KO_SLUG_STORAGE_KEY], function (got) {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          var m = got && got[KO_SLUG_STORAGE_KEY];
          if (!m || typeof m !== 'object') {
            resolve(null);
            return;
          }
          resolve(m);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function saveKoSlugMapToStorage(map) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      var payload = {};
      payload[KO_SLUG_STORAGE_KEY] = map;
      chrome.storage.local.set(payload);
    } catch (e) {}
  }

  function fetchJsonUrl(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  function soakMoveUrlIntoMaps(url, koSlugMap) {
    return fetchJsonUrl(url).then(function (j) {
      if (!j) return;
      var meta = moveMetaFromJson(j);
      if (meta && meta.slug) moveMetaCache[meta.slug] = meta;
      var slug = meta && meta.slug ? meta.slug : String(j.name).toLowerCase();
      var names = j.names || [];
      var ni;
      for (ni = 0; ni < names.length; ni++) {
        var row = names[ni];
        if (!row || !row.language || !row.name) continue;
        if (row.language.name !== 'ko') continue;
        var lab = String(row.name).trim();
        if (lab) koSlugMap[lab] = slug;
      }
    });
  }

  function soakMoveUrlsChunked(urls, koSlugMap) {
    var i = 0;
    var chunk = POKEAPI_MOVE_FETCH_CHUNK;
    function step() {
      if (i >= urls.length) return Promise.resolve();
      var slice = urls.slice(i, i + chunk);
      i += chunk;
      return Promise.all(slice.map(function (u) {
        return soakMoveUrlIntoMaps(u, koSlugMap);
      })).then(step);
    }
    return step();
  }

  /** moveKoMap 없이 PokeAPI 각 기술의 names(language=ko)로 한글 표기 → 영문 slug 인덱스 구축. */
  function buildKoSlugMapFromPokeapiNetwork() {
    var koSlugMap = Object.create(null);
    return fetchJsonUrl('https://pokeapi.co/api/v2/move?limit=1')
      .then(function (first) {
        if (!first || first.count == null) return Promise.reject(new Error('pokeapi_move_count'));
        var total = first.count | 0;
        var limit = POKEAPI_MOVE_PAGE;
        var offsets = [];
        var o;
        for (o = 0; o < total; o += limit) offsets.push(o);
        return offsets.reduce(function (chain, offset) {
          return chain.then(function () {
            return fetchJsonUrl(
              'https://pokeapi.co/api/v2/move?limit=' + limit + '&offset=' + offset
            ).then(function (page) {
              if (!page || !page.results) return;
              var urls = page.results.map(function (x) {
                return x.url;
              });
              return soakMoveUrlsChunked(urls, koSlugMap);
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        return koSlugMap;
      });
  }

  function ensureKoSlugMapFromPokeapi() {
    if (koSlugMapMem && mapKeyCount(koSlugMapMem) >= KO_SLUG_MIN_KEYS) {
      return Promise.resolve(koSlugMapMem);
    }
    if (koSlugBuildPromise) return koSlugBuildPromise;
    koSlugBuildPromise = loadKoSlugMapFromStorage()
      .then(function (stored) {
        if (stored && mapKeyCount(stored) >= KO_SLUG_MIN_KEYS) {
          koSlugMapMem = stored;
          return koSlugMapMem;
        }
        return buildKoSlugMapFromPokeapiNetwork().then(function (fresh) {
          koSlugMapMem = fresh;
          saveKoSlugMapToStorage(fresh);
          return koSlugMapMem;
        });
      })
      .catch(function () {
        koSlugMapMem = Object.create(null);
        return koSlugMapMem;
      })
      .then(function (m) {
        koSlugBuildPromise = null;
        return m;
      });
    return koSlugBuildPromise;
  }

  function normalizeMoveLabel(s) {
    return String(s || '').trim();
  }

  /**
   * 스마트누오 UI 표기 ≠ PokeAPI 공식 한글명(예: 섀도클로 vs 섀도크루)일 때 PokeAPI 쪽 키로 우회.
   * 데이터는 여전히 PokeAPI names(ko) 인덱스에서 옴.
   */
  var MOVE_KO_SITE_TO_POKEAPI_KO = {
    섀도클로: '섀도크루',
  };

  /**
   * moveKoFallback 값: Showdown식 하이픈 없는 id. PokeAPI는 보통 하이픈 slug.
   * 원문 → 단일 하이픈 삽입 후보 순으로 조회(캐시 공유).
   */
  function resolveMoveMetaFromShowdownStyleId(raw) {
    var id = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (!id) return Promise.resolve(null);
    return fetchMoveMetaBySlug(id).then(function (meta) {
      if (meta) return meta;
      var len = id.length;
      var i = 1;
      function step() {
        if (i >= len) return Promise.resolve(null);
        var cand = id.slice(0, i) + '-' + id.slice(i);
        i++;
        return fetchMoveMetaBySlug(cand).then(function (m) {
          if (m) return m;
          return step();
        });
      }
      return step();
    });
  }

  /** 순수 영문 slug면 그대로, 아니면 PokeAPI에서 모은 한글명→slug. */
  function slugFromMoveLabel(label, koSlugMap) {
    var t = normalizeMoveLabel(label);
    if (!t || t === '--') return null;
    if (/^[a-z0-9][a-z0-9-]*$/.test(t)) return t;
    var slug = koSlugMap[t];
    if (slug) return slug;
    var canonKo = MOVE_KO_SITE_TO_POKEAPI_KO[t];
    if (canonKo && koSlugMap[canonKo]) return koSlugMap[canonKo];
    return null;
  }

  /**
   * 기술1→기술4 순으로 보며 첫 유효 공격기를 고름.
   * 스킵: 빈 칸, 영문 slug·한글 모두 PokeAPI로 slug 해석 불가, 변화기, 위력 0 고정, PokeAPI 실패.
   * 네 칸 모두 해당 없으면 null → 몸통박치기 스텁.
   */
  function firstDamagingMoveMeta(slot, moveKoFallbackDoc) {
    return ensureKoSlugMapFromPokeapi().then(function (koSlugMap) {
      var moves = SR.getMoves(slot);
      var chain = Promise.resolve(null);
      var mi;
      for (mi = 0; mi < 4; mi++) {
        (function (idx) {
          chain = chain.then(function (found) {
            if (found) return found;
            var ko = (moves[idx] || '').trim();
            if (!ko || ko === '--') return null;
            var slug = slugFromMoveLabel(ko, koSlugMap);
            var byKoFb = moveKoFallbackDoc && moveKoFallbackDoc.byKo;
            var rawFb = byKoFb && Object.prototype.hasOwnProperty.call(byKoFb, ko) ? byKoFb[ko] : null;
            var pMeta;
            if (slug) {
              pMeta = fetchMoveMetaBySlug(slug);
            } else if (rawFb) {
              pMeta = resolveMoveMetaFromShowdownStyleId(rawFb);
            } else {
              pMeta = Promise.resolve(null);
            }
            return pMeta.then(function (meta) {
              if (!meta) return null;
              if (meta.damage_class === 'status') return null;
              if (meta.power != null && meta.power !== '' && asInt(meta.power) === 0) return null;
              return { ko: ko, slug: meta.slug || slug || '', meta: meta };
            });
          });
        })(mi);
      }
      return chain;
    });
  }

  function typeKoFromEnSlug(typeEn, typeKoDoc) {
    var slug = String(typeEn || 'normal').toLowerCase();
    var byKo = typeKoDoc && typeKoDoc.byKo;
    if (!byKo) return '';
    var ko;
    for (ko in byKo) {
      if (!Object.prototype.hasOwnProperty.call(byKo, ko)) continue;
      var enDisp = String(byKo[ko] || '');
      if (enDisp.toLowerCase() === slug) return ko;
    }
    return '';
  }

  function buildAttackerMovePayload(pack, typeKoDoc) {
    if (!pack || !pack.meta) return null;
    var m = pack.meta;
    var dc = m.damage_class === 'special' ? 'special' : 'physical';
    var typeEn = String(m.typeEn || 'normal').toLowerCase();
    var typeKo = typeKoFromEnSlug(typeEn, typeKoDoc);
    return {
      name: m.slug || 'tackle',
      kr: pack.ko || '',
      power: m.power != null && m.power !== '' ? asInt(m.power) : 40,
      typeEn: typeEn,
      typeKo: typeKo,
      damageClass: dc,
    };
  }

  /** PokeAPI/공식: 몸통박치기 tackle — 물리·노말·위력 40 (현행) */
  function defaultAttackerMovePayload(typeKoDoc) {
    var typeEn = 'normal';
    return {
      name: 'tackle',
      kr: '몸통박치기',
      power: 40,
      typeEn: typeEn,
      typeKo: typeKoFromEnSlug(typeEn, typeKoDoc) || '노말',
      damageClass: 'physical',
    };
  }

  function buildOneSide(urlText, docs, role) {
    var full = SR.normalizePartyUrlInput(urlText);
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
      var flat = SR.flattenSlot(slot);
      var speciesKo = speciesKoFromFlat(flat);
      if (!speciesKo) {
        return { error: 'no_species' };
      }

      var evs = SR.getEvValuesSix(slot);
      var ivs = getIvSix(flat);
      var natureKo = natureKoFromFlat(flat);
      var nr = natureRowForKo(natureKo, docs.natureKoDoc, docs.natureStatMulDoc);
      var level = levelFromFlat(flat);

      if (role === 'defender') {
        var defEnv = envKeysFromAbilityKo(abilityKoFromFlat(flat), docs.modifiersDoc);
        return {
          speciesKo: speciesKo,
          evs: evs,
          ivs: ivs,
          level: level,
          abilityKo: abilityKoFromFlat(flat),
          itemKo: itemKoFromFlat(flat),
          natureKo: natureKo,
          _defNatureRow: nr.row,
          abilityWeatherKey: defEnv.abilityWeatherKey,
          abilityTerrainKey: defEnv.abilityTerrainKey,
        };
      }

      return firstDamagingMoveMeta(slot, docs.moveKoFallbackDoc).then(function (movePack) {
        var physicalMove = true;
        if (movePack && movePack.meta && movePack.meta.damage_class === 'special') {
          physicalMove = false;
        }

        var attackerPersonality = 1;
        if (nr.row) {
          attackerPersonality = personalityScalar(physicalMove ? nr.row.atk : nr.row.spa);
        }

        var atkEnv = envKeysFromAbilityKo(abilityKoFromFlat(flat), docs.modifiersDoc);
        return {
          speciesKo: speciesKo,
          evs: evs,
          ivs: ivs,
          level: level,
          abilityKo: abilityKoFromFlat(flat),
          itemKo: itemKoFromFlat(flat),
          physicalMove: physicalMove,
          attackerPersonality: attackerPersonality,
          attackerMove:
            buildAttackerMovePayload(movePack, docs.typeKoDoc) ||
            defaultAttackerMovePayload(docs.typeKoDoc),
          abilityWeatherKey: atkEnv.abilityWeatherKey,
          abilityTerrainKey: atkEnv.abilityTerrainKey,
        };
      });
    });
  }

  /**
   * @param {string} atkUrl
   * @param {string} defUrl
   * @param {{ natureKoDoc: object, natureStatMulDoc: object, typeKoDoc?: object, moveKoFallbackDoc?: { byKo?: Record<string,string> }, modifiersDoc?: { abilities?: object } }} docs
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
      var incPhys = true;
      if (attacker && !attacker.error) {
        incPhys = attacker.physicalMove !== false;
      }
      if (defender && !defender.error) {
        defender.incomingPhysical = incPhys;
        var row = defender._defNatureRow;
        delete defender._defNatureRow;
        if (row) {
          defender.defenderPersonality = personalityScalar(incPhys ? row.def : row.spd);
        } else {
          defender.defenderPersonality = 1;
        }
      }
      return { attacker: attacker, defender: defender };
    });
  }

  globalThis.nuoCalcPayload = {
    buildSidePayloads: buildSidePayloads,
  };
})();
