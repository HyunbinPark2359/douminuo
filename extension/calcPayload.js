/**
 * Service worker: 샘플 공유 URL → 계산기 기입용 페이로드.
 * globalThis.nuoCalcPayload.buildSidePayloads(atkUrl, defUrl, docs)
 */
(function () {
  'use strict';

  var SR = globalThis.shareToRaw;
  var moveMetaCache = Object.create(null);

  // F0: 옛 런타임 PokéAPI 인덱스의 storage 캐시 키. 이제 사용 안 함 — 다음
  // SW 부팅 시 1회 청소해서 사용자 디스크에 stale ~수십KB가 남지 않게.
  var LEGACY_KO_SLUG_STORAGE_KEY = 'nuo_calc_move_ko_slug_map';
  var legacyKoSlugCleanupDone = false;
  function cleanupLegacyKoSlugStorage() {
    if (legacyKoSlugCleanupDone) return;
    legacyKoSlugCleanupDone = true;
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.remove(LEGACY_KO_SLUG_STORAGE_KEY, function () {
        // chrome.runtime.lastError 무시 (이미 없으면 아무 일도 안 일어남)
      });
    } catch (e) {}
  }

  function str(v) {
    return SR.str(v);
  }

  function asInt(v) {
    return SR.asInt(v);
  }

  /**
   * F18: SW 라이프타임 동안 같은 share id는 한 번만 GET (어머니 사이트 보호 §A.2 #2).
   * 사용자가 같은 공유 URL로 계산기 입력을 반복할 때 누오에 같은 GET을 다시 보내지 않는다.
   * - key: origin + '|' + id (도메인 분리 보호)
   * - TTL: 60초 (보수적; 사이트가 의미 있는 갱신을 했을 가능성을 감안)
   * - 실패한 응답은 캐시하지 않음 (재시도 허용)
   */
  var SHARE_GET_TTL_MS = 60 * 1000;
  var shareGetCache = Object.create(null);

  function fetchShareGET(fullUrl) {
    var id = SR.extractPsId(fullUrl);
    if (!id) return Promise.reject(new Error('no_ps_id'));
    var baseUrl = new URL(SR.normalizePartyUrlInput(fullUrl));
    var key = baseUrl.origin + '|' + id;
    var entry = shareGetCache[key];
    if (entry && Date.now() - entry.t < SHARE_GET_TTL_MS) {
      return entry.p;
    }
    var p = fetch(baseUrl.origin + '/api/party/share/' + encodeURIComponent(id), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error('GET ' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
      });
      return res.json();
    });
    shareGetCache[key] = { p: p, t: Date.now() };
    p.catch(function () {
      // 실패 응답은 캐시 무효화 — 다음 호출에서 재시도 허용
      if (shareGetCache[key] && shareGetCache[key].p === p) delete shareGetCache[key];
    });
    return p;
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

  /** 특수(damage_class special)지만 피해 계산 시 방어·방어종족값·방어 노력치를 쓰는 기술 — PokeAPI move `name` slug. */
  var INCOMING_USES_DEFENSE_ON_SPECIAL_SLUG = Object.create(null);
  ['psyshock', 'psystrike', 'secret-sword'].forEach(function (s) {
    INCOMING_USES_DEFENSE_ON_SPECIAL_SLUG[s] = 1;
  });

  function defenderIncomingUsesDefenseStat(attackerPayload) {
    if (!attackerPayload || attackerPayload.error) return true;
    var slug = '';
    if (attackerPayload.attackerMove && attackerPayload.attackerMove.name) {
      slug = String(attackerPayload.attackerMove.name).toLowerCase().trim();
    }
    if (slug && INCOMING_USES_DEFENSE_ON_SPECIAL_SLUG[slug]) return true;
    return attackerPayload.physicalMove !== false;
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

  function normalizeMoveLabel(s) {
    return String(s || '').trim();
  }

  /**
   * 스마트누오 UI 표기 ≠ PokéAPI 공식 한글명(예: 섀도클로 vs 섀도크루)일 때 PokéAPI 쪽 키로 우회.
   * moveKoMap.byKo 의 키는 PokéAPI 공식 한글명이므로 사이트 표기를 정정한 뒤 lookup.
   */
  var MOVE_KO_SITE_TO_POKEAPI_KO = {
    섀도클로: '섀도크루',
  };

  /**
   * Showdown식 하이픈 없는 id (예: shadowclaw) → PokéAPI meta.
   * 원문 그대로 시도 → 1자리씩 하이픈 삽입 후보 (shadow-claw 등) 순.
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

  /**
   * F0: 한글/영문 기술명 → Showdown식 id (하이픈 없는 형태).
   * 빌드 타임 번들(moveKoMap, moveKoFallback)을 단일 출처로 사용 — 런타임 PokéAPI 호출 없음.
   * - 영문 slug 입력은 그대로 (소문자, 하이픈 제거).
   * - 한글 입력은 moveKoMap.byKo → moveKoFallback.byKo → 사이트→PokéAPI 표기 정정 후 재시도.
   */
  function showdownIdFromMoveLabel(label, moveKoDoc, moveKoFallbackDoc) {
    var t = normalizeMoveLabel(label);
    if (!t || t === '--') return null;
    if (/^[a-z0-9][a-z0-9-]*$/.test(t)) {
      return t.toLowerCase().replace(/-/g, '');
    }
    var byKo = (moveKoDoc && moveKoDoc.byKo) || null;
    var byKoFb = (moveKoFallbackDoc && moveKoFallbackDoc.byKo) || null;
    if (byKo && Object.prototype.hasOwnProperty.call(byKo, t)) return byKo[t];
    if (byKoFb && Object.prototype.hasOwnProperty.call(byKoFb, t)) return byKoFb[t];
    var canonKo = MOVE_KO_SITE_TO_POKEAPI_KO[t];
    if (canonKo) {
      if (byKo && Object.prototype.hasOwnProperty.call(byKo, canonKo)) return byKo[canonKo];
      if (byKoFb && Object.prototype.hasOwnProperty.call(byKoFb, canonKo)) return byKoFb[canonKo];
    }
    return null;
  }

  /**
   * 기술1→기술4 순으로 보며 첫 유효 공격기를 고름.
   * 스킵: 빈 칸, slug 해석 불가, 변화기, 위력 0 고정, PokéAPI 응답 실패.
   * 네 칸 모두 해당 없으면 null → 호출자가 몸통박치기 스텁.
   *
   * F0 이후: PokéAPI 호출은 fetchMoveMetaBySlug 1건/슬롯 정도 (처음 발견되는 공격기에만).
   * 콜드 스타트 시 ~900건 페이징 빌드 단계 제거됨.
   */
  function firstDamagingMoveMeta(slot, moveKoDoc, moveKoFallbackDoc) {
    var moves = SR.getMoves(slot);
    var chain = Promise.resolve(null);
    var mi;
    for (mi = 0; mi < 4; mi++) {
      (function (idx) {
        chain = chain.then(function (found) {
          if (found) return found;
          var ko = (moves[idx] || '').trim();
          if (!ko || ko === '--') return null;
          var sdId = showdownIdFromMoveLabel(ko, moveKoDoc, moveKoFallbackDoc);
          if (!sdId) return null;
          return resolveMoveMetaFromShowdownStyleId(sdId).then(function (meta) {
            if (!meta) return null;
            if (meta.damage_class === 'status') return null;
            if (meta.power != null && meta.power !== '' && asInt(meta.power) === 0) return null;
            return { ko: ko, slug: meta.slug || '', meta: meta };
          });
        });
      })(mi);
    }
    return chain;
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

      return firstDamagingMoveMeta(slot, docs.moveKoDoc, docs.moveKoFallbackDoc).then(function (movePack) {
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
   * @param {{
   *   natureKoDoc: object,
   *   natureStatMulDoc: object,
   *   typeKoDoc?: object,
   *   moveKoDoc?: { byKo?: Record<string,string> },
   *   moveKoFallbackDoc?: { byKo?: Record<string,string> },
   *   modifiersDoc?: { abilities?: object }
   * }} docs
   */
  function buildSidePayloads(atkUrl, defUrl, docs) {
    docs = docs || {};
    cleanupLegacyKoSlugStorage();  // F0: 옛 storage 캐시 1회 청소
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
        incPhys = defenderIncomingUsesDefenseStat(attacker);
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
