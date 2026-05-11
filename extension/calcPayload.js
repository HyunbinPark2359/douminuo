/**
 * Service worker: 샘플 공유 URL → 계산기 기입용 페이로드.
 * globalThis.nuoCalcPayload.buildSidePayloads(atkUrl, defUrl, docs)
 */
(function () {
  'use strict';

  var SR = globalThis.shareToRaw;
  var moveMetaCache = Object.create(null);

  /** Iron Fist 등 — 사이트가 att.move.name.flags 를 본다. 번들 moveTags.json 을 SW 에서 1회 로드. */
  var moveTagsBundleInflight = null;
  var moveTagsBundleResolved = null;
  function ensureMoveTagsLoaded() {
    if (moveTagsBundleResolved) return Promise.resolve(moveTagsBundleResolved);
    if (moveTagsBundleInflight) return moveTagsBundleInflight;
    moveTagsBundleInflight = new Promise(function (resolve) {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
          moveTagsBundleInflight = null;
          resolve({ moves: {} });
          return;
        }
        fetch(chrome.runtime.getURL('moveTags.json'))
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            moveTagsBundleResolved = j && typeof j === 'object' ? j : { moves: {} };
            moveTagsBundleInflight = null;
            resolve(moveTagsBundleResolved);
          })
          .catch(function () {
            moveTagsBundleInflight = null;
            resolve({ moves: {} });
          });
      } catch (eLoad) {
        moveTagsBundleInflight = null;
        resolve({ moves: {} });
      }
    });
    return moveTagsBundleInflight;
  }

  function buildRichMoveRow(slug, slugDashed, ko, typeEn, power, dcStr, moveTagsDoc, moveSlugToEnDoc) {
    var enName = '';
    var byS = moveSlugToEnDoc && moveSlugToEnDoc.bySlug;
    if (byS) {
      if (slugDashed && byS[slugDashed]) enName = String(byS[slugDashed]);
      else if (slug && byS[slug]) enName = String(byS[slug]);
    }

    var rawFlags = null;
    var movesTbl = moveTagsDoc && moveTagsDoc.moves;
    if (movesTbl && typeof movesTbl === 'object' && slug) {
      rawFlags = movesTbl[slug];
    }
    var flags = {};
    if (rawFlags && typeof rawFlags === 'object') {
      var fk;
      for (fk in rawFlags) {
        if (Object.prototype.hasOwnProperty.call(rawFlags, fk) && rawFlags[fk] === true) {
          flags[fk] = 1;
        }
      }
    }

    var category =
      dcStr === 'special' ? 'Special' : dcStr === 'physical' ? 'Physical' : 'Status';
    var typeCapitalized = typeEn
      ? typeEn.charAt(0).toUpperCase() + typeEn.slice(1).toLowerCase()
      : 'Normal';

    return {
      id: slug,
      name: enName,
      kr: ko,
      type: typeCapitalized,
      basePower: power,
      category: category,
      flags: flags,
      secondaries: false,
      recoil: false,
    };
  }

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

  /**
   * 새 샘플 첫 자동입력 시 5초+ 걸리던 병목 두 가지를 해결 (사용자 보고 #5):
   *
   *   A. 빌드타임 슬러그 정규화 맵 — 한글 기술명 번들(moveKoMap)이 hyphenless id 만 주므로
   *      PokéAPI 의 hyphenated slug 를 알 수 없어 옛 코드는 “s-hadowclaw, sh-adowclaw...” 식
   *      hyphen 위치 sequential 추측 (~10개 sequential 404). 이미 갖고 있는 moveSlugToEn.json
   *      의 키(모두 PokéAPI hyphenated slug) 를 한 번 reduce 해 hyphenless → hyphenated 맵으로
   *      만들면 단 1번 fetch 로 끝.
   *
   *   B. 영속 move meta 캐시 — 옛 moveMetaCache 는 SW 라이프타임 메모리. SW 가 idle 로 죽으면
   *      다음 부팅에서 같은 기술 또 fetch. chrome.storage.local 에 mirror 해 SW 재부팅을 넘어
   *      살아남도록.
   */

  /** A. 슬러그 정규화 맵 — moveSlugToEn.json 의 키 list 로부터 한 번만 빌드 (캐시). */
  var slugCanonicalCache = null;
  var slugCanonicalSourceRef = null;
  function getSlugCanonicalMap(moveSlugToEnDoc) {
    if (slugCanonicalCache && slugCanonicalSourceRef === moveSlugToEnDoc) {
      return slugCanonicalCache;
    }
    var bySlug = (moveSlugToEnDoc && moveSlugToEnDoc.bySlug) || {};
    var map = Object.create(null);
    var k;
    for (k in bySlug) {
      if (!Object.prototype.hasOwnProperty.call(bySlug, k)) continue;
      var hyphenless = String(k).replace(/-/g, '');
      if (hyphenless && map[hyphenless] == null) map[hyphenless] = k;
    }
    slugCanonicalCache = map;
    slugCanonicalSourceRef = moveSlugToEnDoc;
    return map;
  }

  /**
   * 슬러그 → 한칭 reverse 맵 — 구버전 공유 URL 에서 mv.name 이 영문 슬러그(예: 'ice-hammer')
   * 만 들어오고 어떤 alias 에도 한칭이 없을 때, 사이트 표시용 ko 를 복구하기 위함.
   * moveKoMap.byKo (한칭→Showdown id) + moveKoFallback.byKo 를 한 번 reduce.
   */
  var koByIdCache = null;
  var koByIdSourceRef = null;
  function getKoByShowdownId(moveKoDoc, moveKoFallbackDoc) {
    if (koByIdCache && koByIdSourceRef === moveKoDoc) return koByIdCache;
    var map = Object.create(null);
    function ingest(doc) {
      var byKo = doc && doc.byKo;
      if (!byKo) return;
      var k;
      for (k in byKo) {
        if (!Object.prototype.hasOwnProperty.call(byKo, k)) continue;
        var id = String(byKo[k] || '').toLowerCase();
        if (id && map[id] == null) map[id] = k;
      }
    }
    ingest(moveKoDoc);
    ingest(moveKoFallbackDoc);
    koByIdCache = map;
    koByIdSourceRef = moveKoDoc;
    return map;
  }

  /** B. 영속 캐시 — chrome.storage.local mirror. SW 라이프타임 동안 1회 load. */
  var MOVE_META_STORAGE_KEY = 'nuo_fmt_moveMetaCache';
  var MOVE_META_SCHEMA = 1;
  var moveMetaLoadPromise = null;
  function ensureMoveMetaCacheLoaded() {
    if (moveMetaLoadPromise) return moveMetaLoadPromise;
    moveMetaLoadPromise = new Promise(function (resolve) {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve();
          return;
        }
        chrome.storage.local.get([MOVE_META_STORAGE_KEY], function (got) {
          if (chrome.runtime.lastError) { resolve(); return; }
          var c = got && got[MOVE_META_STORAGE_KEY];
          if (c && c.schema === MOVE_META_SCHEMA && c.entries && typeof c.entries === 'object') {
            var k;
            for (k in c.entries) {
              if (!Object.prototype.hasOwnProperty.call(c.entries, k)) continue;
              if (!Object.prototype.hasOwnProperty.call(moveMetaCache, k)) {
                moveMetaCache[k] = c.entries[k];
              }
            }
          }
          resolve();
        });
      } catch (e) { resolve(); }
    });
    return moveMetaLoadPromise;
  }

  /** 600ms 디바운스 batch write — 한 슬롯의 4기술 lookup 이 짧은 간격으로 들어오니. */
  var moveMetaPersistTimer = null;
  function schedulePersistMoveMetaCache() {
    if (moveMetaPersistTimer) return;
    moveMetaPersistTimer = setTimeout(function () {
      moveMetaPersistTimer = null;
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
        var entries = Object.create(null);
        var k;
        for (k in moveMetaCache) {
          if (Object.prototype.hasOwnProperty.call(moveMetaCache, k)) {
            // null(404) 도 캐시 — 동일 lookup 반복 방지. 새 PokéAPI 기술이 추가되면
            // SW 재로드 또는 사용자 측 storage 비우기로 회복.
            entries[k] = moveMetaCache[k];
          }
        }
        var obj = {};
        obj[MOVE_META_STORAGE_KEY] = { schema: MOVE_META_SCHEMA, entries: entries, savedAt: Date.now() };
        chrome.storage.local.set(obj, function () {
          // chrome.runtime.lastError 무시
        });
      } catch (e) {}
    }, 600);
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

  /**
   * 인덱스는 HP, Atk, Def, SpA, SpD, Spe 순. Nuxt 슬롯은 stats.<key>.individual_value 형태.
   */
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
      str(flat.name_kr) ||
      str(flat.nameKr) ||
      str(flat.namekr) ||
      str(flat.speciesName || flat.speciesKo) ||
      str(flat.species) ||
      str(flat.name) ||
      ''
    );
  }

  function natureKoFromFlat(flat) {
    var p = flat.personality || flat.nature || flat.Nature;
    if (p == null) return '';
    if (typeof p === 'string') return str(p);
    if (typeof p === 'object') {
      return str(p.name || p.kr || p.koName || p.label || '');
    }
    return '';
  }

  function abilityKoFromFlat(flat) {
    var a = flat.ability || flat.ab || flat.Ability;
    if (a == null) return '';
    if (typeof a === 'string') return str(a);
    if (typeof a === 'object' && a.kr != null) return str(a.kr);
    return '';
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
    var e = flat.equipment || flat.item || flat.Item || flat.hold || flat.holdItem;
    if (e == null) return '';
    if (typeof e === 'string') return str(e);
    if (typeof e === 'object' && e.kr != null) return str(e.kr);
    return '';
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
    return ensureMoveMetaCacheLoaded().then(function () {
      // hasOwnProperty 로 “캐시 안 됨” vs “캐시 된 null(404)” 구분.
      if (Object.prototype.hasOwnProperty.call(moveMetaCache, k)) {
        return moveMetaCache[k];
      }
      var url = 'https://pokeapi.co/api/v2/move/' + encodeURIComponent(k) + '/';
      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (j) {
          if (!j) {
            moveMetaCache[k] = null;
            schedulePersistMoveMetaCache();
            return null;
          }
          var meta = moveMetaFromJson(j);
          moveMetaCache[k] = meta;
          schedulePersistMoveMetaCache();
          return meta;
        })
        .catch(function () {
          moveMetaCache[k] = null;
          schedulePersistMoveMetaCache();
          return null;
        });
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
   *
   * A. slugCanonicalMap 이 있으면 hyphenless → hyphenated 1회 lookup → 단일 fetch (일반 케이스).
   * B. 맵 미커버(신규 폼·기술) 시에만 옛 sequential 추측 폴백 — 옛 “s-hadowclaw, sh-adowclaw...”.
   *
   * @param {string} raw — Showdown식 id (보통 hyphenless, 영문 lowercase)
   * @param {Record<string,string>=} slugCanonicalMap — getSlugCanonicalMap 결과
   */
  function resolveMoveMetaFromShowdownStyleId(raw, slugCanonicalMap) {
    var id = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (!id) return Promise.resolve(null);

    // A. 빌드타임 정규화 맵 hit — 일반 케이스. 단일 fetch.
    var canonical = slugCanonicalMap && slugCanonicalMap[id];
    if (canonical) {
      return fetchMoveMetaBySlug(canonical);
    }

    // 폴백 — 신규 폼/번들 미커버 시. 옛 sequential 추측 그대로.
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
   * F0 이후: 한글 → showdown id 는 빌드타임 번들 lookup. PokéAPI 호출은 meta 조회만.
   * 본 라운드(#5 픽스) 이후: slugCanonicalMap 으로 hyphenless → hyphenated 1회 lookup →
   * 일반 케이스에서 단일 fetch. 신규 폼/번들 미커버 시에만 sequential 추측 폴백.
   */
  function firstDamagingMoveMeta(slot, moveKoDoc, moveKoFallbackDoc, slugCanonicalMap) {
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
          return resolveMoveMetaFromShowdownStyleId(sdId, slugCanonicalMap).then(function (meta) {
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

  /**
   * 팀빌더 슬롯 pokemon.moves[] 만으로 첫 유효 공격기 추출 — PokeAPI·moveKoMap 없음 (신규 기술 대응).
   * URL 공유 경로(buildOneSide)는 옛 firstDamagingMoveMeta 유지.
   */
  function firstDamagingMoveFromSlotPokemon(slot, typeKoDoc, moveKoDoc, moveKoFallbackDoc) {
    var nested = (slot && slot.pokemon) || (slot && typeof slot === 'object' ? slot : null);
    if (!nested) return null;
    var moves = nested.moves;
    if (!Array.isArray(moves) || !moves.length) return null;
    var i;
    for (i = 0; i < 4 && i < moves.length; i++) {
      var mv = moves[i];
      if (!mv || typeof mv !== 'object') continue;
      var dc = String(mv.damage_class || '').toLowerCase();
      if (dc !== 'physical' && dc !== 'special') continue;
      var power = asInt(mv.power);
      if (power == null || power === 0) continue;
      var slug = '';
      if (typeof mv.name === 'string') {
        slug = mv.name.toLowerCase().trim();
      } else if (mv.name && typeof mv.name === 'object') {
        slug = String(mv.name.id || mv.name.slug || '').toLowerCase().trim();
      }
      // 새 공유 URL: 사이트가 lazy 채운 rich row 가 mv.name 객체로 들어옴.
      // 슬롯 직속 alias 들은 빈 string 이고 한칭은 mv.name.kr 에만 있음. (v6)
      var ko = String(mv.name_kr || mv.nameKr || mv.kr || '').trim();
      if (!ko && mv.name && typeof mv.name === 'object') {
        ko = String(mv.name.kr || mv.name.name_kr || mv.name.nameKr || '').trim();
      }
      // 구버전 공유 URL: mv.name 이 영문 슬러그(예: 'ice-hammer')이고 어떤 한칭 alias 도 비어있음.
      // moveKoMap reverse 로 복구해 사이트의 move.name.kr 라벨이 공란으로 그려지지 않게.
      if (!ko && slug) {
        var koMap = getKoByShowdownId(moveKoDoc, moveKoFallbackDoc);
        var slugUndashed = slug.replace(/-/g, '');
        if (koMap[slugUndashed]) ko = koMap[slugUndashed];
      }
      var typeKo = String(mv.type || '').trim();
      var typeEn = '';
      if (mv.name && typeof mv.name === 'object' && mv.name.type) {
        typeEn = String(mv.name.type).toLowerCase();
      }
      if (!typeEn && typeKoDoc && typeKoDoc.byKo) {
        var koLk;
        for (koLk in typeKoDoc.byKo) {
          if (!Object.prototype.hasOwnProperty.call(typeKoDoc.byKo, koLk)) continue;
          if (koLk === typeKo) {
            typeEn = String(typeKoDoc.byKo[koLk] || '').toLowerCase();
            break;
          }
        }
      }
      return {
        ko: ko,
        slug: slug,
        meta: {
          slug: slug,
          power: power,
          typeEn: typeEn || 'normal',
          damage_class: dc,
        },
      };
    }
    return null;
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

  function buildAttackerMovePayload(pack, typeKoDoc, moveTagsDoc, moveSlugToEnDoc) {
    if (!pack || !pack.meta) return null;
    var m = pack.meta;
    var dc = m.damage_class === 'special' ? 'special' : 'physical';
    var typeEn = String(m.typeEn || 'normal').toLowerCase();
    var typeKo = typeKoFromEnSlug(typeEn, typeKoDoc);
    var slugUndashed = String(m.slug || 'tackle')
      .toLowerCase()
      .replace(/-/g, '');
    var canonMap = getSlugCanonicalMap(moveSlugToEnDoc);
    var slugDashed =
      (canonMap && canonMap[slugUndashed]) || String(m.slug || 'tackle').toLowerCase();
    var ko = pack.ko || '';
    var power = m.power != null && m.power !== '' ? asInt(m.power) : 40;
    var richRow = buildRichMoveRow(
      slugUndashed,
      slugDashed,
      ko,
      typeEn,
      power,
      dc,
      moveTagsDoc,
      moveSlugToEnDoc
    );

    return {
      name: slugUndashed,
      kr: ko,
      power: power,
      typeEn: typeEn,
      typeKo: typeKo,
      damageClass: dc,
      richNameRow: richRow,
    };
  }

  /** PokeAPI/공식: 몸통박치기 tackle — 물리·노말·위력 40 (현행) */
  function defaultAttackerMovePayload(typeKoDoc, moveTagsDoc, moveSlugToEnDoc) {
    var typeEn = 'normal';
    var richRow = buildRichMoveRow(
      'tackle',
      'tackle',
      '몸통박치기',
      typeEn,
      40,
      'physical',
      moveTagsDoc,
      moveSlugToEnDoc
    );
    return {
      name: 'tackle',
      kr: '몸통박치기',
      power: 40,
      typeEn: typeEn,
      typeKo: typeKoFromEnSlug(typeEn, typeKoDoc) || '노말',
      damageClass: 'physical',
      richNameRow: richRow,
    };
  }

  /**
   * 슬롯 하나(공유 응답의 single 또는 팀빌더 bridge 의 단일 슬롯)에서 한쪽 페이로드를 만든다.
   * URL 경로(buildOneSide) 와 슬롯 직접 경로(buildOneSideFromSlot) 가 공유한다.
   * @param {object} slot raw slot (SR.flattenSlot 적용 가능한 형태)
   * @param {object} docs natureKoDoc / natureStatMulDoc / typeKoDoc / moveKoDoc / moveKoFallbackDoc / modifiersDoc
   * @param {'attacker'|'defender'} role
   * @returns {Promise<object>} { error } 또는 페이로드
   */
  function buildOneSideFromFlatSlot(slot, docs, role) {
    if (SR.isSlotEmpty(slot)) {
      return Promise.resolve({ error: 'empty_slot' });
    }
    var flat = SR.flattenSlot(slot);
    var speciesKo = speciesKoFromFlat(flat);
    if (!speciesKo) {
      return Promise.resolve({ error: 'no_species' });
    }

    var evs = SR.getEvValuesSix(slot);
    var ivs = getIvSix(flat);
    var natureKo = natureKoFromFlat(flat);
    var nr = natureRowForKo(natureKo, docs.natureKoDoc, docs.natureStatMulDoc);
    var level = levelFromFlat(flat);

    if (role === 'defender') {
      var defEnv = envKeysFromAbilityKo(abilityKoFromFlat(flat), docs.modifiersDoc);
      return Promise.resolve({
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
      });
    }

    var slugMap = getSlugCanonicalMap(docs.moveSlugToEnDoc);
    var localPack = firstDamagingMoveFromSlotPokemon(
      slot,
      docs.typeKoDoc,
      docs.moveKoDoc,
      docs.moveKoFallbackDoc
    );
    var packPromise = localPack
      ? Promise.resolve(localPack)
      : firstDamagingMoveMeta(slot, docs.moveKoDoc, docs.moveKoFallbackDoc, slugMap);
    return packPromise.then(function (movePack) {
      var physicalMove = true;
      if (movePack && movePack.meta && movePack.meta.damage_class === 'special') {
        physicalMove = false;
      }

      var attackerPersonality = 1;
      if (nr.row) {
        attackerPersonality = personalityScalar(physicalMove ? nr.row.atk : nr.row.spa);
      }

      var atkEnv = envKeysFromAbilityKo(abilityKoFromFlat(flat), docs.modifiersDoc);
      return ensureMoveTagsLoaded().then(function (moveTagsDoc) {
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
            buildAttackerMovePayload(
              movePack,
              docs.typeKoDoc,
              moveTagsDoc,
              docs.moveSlugToEnDoc
            ) || defaultAttackerMovePayload(docs.typeKoDoc, moveTagsDoc, docs.moveSlugToEnDoc),
          abilityWeatherKey: atkEnv.abilityWeatherKey,
          abilityTerrainKey: atkEnv.abilityTerrainKey,
        };
      });
    });
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
      return buildOneSideFromFlatSlot(cls.slot, docs, role);
    });
  }

  /**
   * defender 페이로드의 _defNatureRow 후처리 + incomingPhysical 결정.
   * buildSidePayloads(URL 두 개) 와 buildSidePayloadFromSlot(슬롯 한 개) 가 공유한다.
   */
  function finalizePair(attacker, defender) {
    var incPhys = true;
    if (attacker && !attacker.error) {
      incPhys = defenderIncomingUsesDefenseStat(attacker);
    }
    if (defender && !defender.error) {
      defender.incomingPhysical = incPhys;
      var row = defender._defNatureRow;
      delete defender._defNatureRow;
      // 본 라운드(#4 추가 픽스): bridge 가 page 의 실제 attacker damage_class 로 physicalIncoming
      // 을 override 할 수 있으므로, 여기서 한쪽 personality scalar 만 넘기면 bridge 의 override
      // 와 어긋남(EV 는 특수, personality 는 물리 기준 같은 부분 적용 발생). 양쪽 모두 보낸다.
      if (row) {
        defender.defenderPersonalityPhys = personalityScalar(row.def);
        defender.defenderPersonalitySpec = personalityScalar(row.spd);
        defender.defenderPersonality = personalityScalar(incPhys ? row.def : row.spd);
      } else {
        defender.defenderPersonalityPhys = 1;
        defender.defenderPersonalitySpec = 1;
        defender.defenderPersonality = 1;
      }
    }
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
      finalizePair(attacker, defender);
      return { attacker: attacker, defender: defender };
    });
  }

  /**
   * 팀빌더 슬롯 객체 한 개를 한쪽 패널 페이로드로 변환. URL fetch 없음 — 어머니 사이트 트래픽 0.
   * @param {object} slot 팀빌더 bridge 가 준 single slot (SR.flattenSlot 적용 가능)
   * @param {'attacker'|'defender'} side 어느 패널에 적용할지
   * @param {object} docs buildSidePayloads 와 동일한 6개 doc
   * @returns {Promise<{attacker?: object, defender?: object}>} 한쪽만 채워진 모양 (반대쪽은 null).
   *   incomingPhysical 결정: attacker 단독이면 정의 안 됨 — 호출자가 onlyAttacker 를 줄 것.
   *   defender 단독이면 디폴트 true (= URL 경로의 onlyDefender 케이스와 동일 동작).
   */
  function buildSidePayloadFromSlot(slot, side, docs) {
    docs = docs || {};
    cleanupLegacyKoSlugStorage();
    var role = side === 'defender' ? 'defender' : 'attacker';
    return buildOneSideFromFlatSlot(slot, docs, role).then(function (one) {
      if (role === 'attacker') {
        finalizePair(one, null);
        return { attacker: one, defender: null };
      }
      finalizePair(null, one);
      return { attacker: null, defender: one };
    });
  }

  globalThis.nuoCalcPayload = {
    buildSidePayloads: buildSidePayloads,
    buildSidePayloadFromSlot: buildSidePayloadFromSlot,
  };
})();
