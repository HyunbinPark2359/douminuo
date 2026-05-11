/**
 * 팀빌더(MAIN). Nuxt 3 — `window.__NUXT__.state['$sparty.slots']` 직접 읽기.
 * NUO_TEAM_SLOTS_REPLY.slotArt: pokemon.sprite 우선(검증 통과 시 정규화 URL, 아니면 원문).
 */
(function () {
  if (window.__NUO_TEAM_BUILDER_BRIDGE_V7__) return;
  window.__NUO_TEAM_BUILDER_BRIDGE_V7__ = true;

  var MSG_EXT = 'nuo-team-ext';
  var MSG_BRIDGE = 'nuo-team-bridge';

  function getNuxtState() {
    try {
      var nx = window.__NUXT__;
      if (!nx) return null;
      if (nx.state && typeof nx.state === 'object') return nx.state;
      var pl = nx.payload;
      if (pl && pl.state && typeof pl.state === 'object') return pl.state;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * $spokemon_list 가 채워질 때까지 최대 2초 폴링 — 부팅 직후 augment 가 빈 도감으로 스킵되는 race 방지.
   */
  function waitForPokeListReady(maxMs, intervalMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + (maxMs || 2000);
      var step = intervalMs || 100;
      function tick() {
        var s = getNuxtState();
        if (s) {
          var pl = s['$spokemon_list'];
          if (Array.isArray(pl) && pl.length > 0) return resolve(true);
        }
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(tick, step);
      }
      tick();
    });
  }

  /**
   * 슬롯 pokemon 을 도감($spokemon_list)으로 보강 — 한칭 슬롯은 name(slug) 부실·second_type 누락 가능.
   * 얕은 복사만 해서 Nuxt reactive proxy 원본은 건드리지 않음.
   */
  function augmentSlotWithDex(slot, state) {
    if (!slot || typeof slot !== 'object' || !slot.pokemon) return slot;
    var poke = slot.pokemon;
    var hasSlug = poke.name && typeof poke.name === 'string' && /^[a-z][a-z0-9-]*$/i.test(poke.name);
    var slugFromNameObj = '';
    if (poke.name && typeof poke.name === 'object') {
      slugFromNameObj = String(poke.name.id || poke.name.smogon_id || '').toLowerCase().trim();
    }
    var hasBoth = poke.first_type && poke.second_type;
    if (hasSlug && hasBoth) return slot;

    var pokeList = state && state['$spokemon_list'];
    if (!Array.isArray(pokeList) || pokeList.length === 0) return slot;

    var entry = null;
    var i;
    var kr = String(poke.name_kr || '').trim();
    if (kr) {
      for (i = 0; i < pokeList.length; i++) {
        if (pokeList[i] && String(pokeList[i].kr || '').trim() === kr) {
          entry = pokeList[i];
          break;
        }
      }
    }
    if (!entry && hasSlug) {
      var slugLow = String(poke.name).toLowerCase();
      var slugNoDash = slugLow.replace(/-/g, '');
      for (i = 0; i < pokeList.length; i++) {
        var p = pokeList[i];
        if (!p) continue;
        var pid = String(p.id || '').toLowerCase();
        if (pid === slugLow || pid === slugNoDash) {
          entry = p;
          break;
        }
      }
    }
    if (!entry && slugFromNameObj) {
      var slugObj = slugFromNameObj;
      var slugObjNoDash = slugObj.replace(/-/g, '');
      for (i = 0; i < pokeList.length; i++) {
        p = pokeList[i];
        if (!p) continue;
        pid = String(p.id || '').toLowerCase();
        if (pid === slugObj || pid === slugObjNoDash) {
          entry = p;
          break;
        }
      }
    }
    if (!entry) return slot;

    var types = Array.isArray(entry.types) ? entry.types : [];
    var t0 = types[0] ? String(types[0]).toLowerCase() : '';
    var t1 = types[1] ? String(types[1]).toLowerCase() : '';

    var newPoke = {};
    var k;
    for (k in poke) {
      if (Object.prototype.hasOwnProperty.call(poke, k)) newPoke[k] = poke[k];
    }
    // name 이 이미 객체로 들어있으면 사이트가 의존하는 모양일 수 있어 덮어쓰지 않음.
    if (!newPoke.name && entry.id) newPoke.name = entry.id;
    if (!newPoke.first_type && t0) newPoke.first_type = t0;
    if (!newPoke.second_type && t1) newPoke.second_type = t1;

    var newSlot = {};
    for (k in slot) {
      if (Object.prototype.hasOwnProperty.call(slot, k)) newSlot[k] = slot[k];
    }
    newSlot.pokemon = newPoke;
    return newSlot;
  }

  function pickBestSlots() {
    var s = getNuxtState();
    if (!s) return null;
    var raw = s['$sparty.slots'];
    if (!Array.isArray(raw)) return null;
    var out = [];
    var i;
    for (i = 0; i < 6; i++) {
      var slot = raw[i] != null ? raw[i] : {};
      out.push(augmentSlotWithDex(slot, s));
    }
    return out;
  }

  /**
   * SW측 shareToRaw.flattenSlot 과 의미·alias 동일 사본 (F10). name_kr 등은 nested 에만 있어도 flatten 후 상위와 합쳐짐.
   */
  function flattenSlot(slot) {
    if (!slot || typeof slot !== 'object') return {};
    var nested = slot.pokemon || slot.mon || slot.poke;
    if (!nested && slot.data && typeof slot.data === 'object' && !Array.isArray(slot.data)) {
      nested = slot.data.pokemon || slot.data.mon || slot.data.poke;
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.assign({}, nested, slot);
    }
    if (slot.data && typeof slot.data === 'object' && !Array.isArray(slot.data)) {
      return Object.assign({}, slot.data, slot);
    }
    return Object.assign({}, slot);
  }

  function slotEmpty(s) {
    if (s == null || typeof s !== 'object') return true;
    var flat = flattenSlot(s);
    var keys = Object.keys(flat).filter(function (k) {
      var v = flat[k];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    });
    return keys.length === 0;
  }

  function pokemonBlockFromSlot(slot) {
    if (!slot || typeof slot !== 'object') return null;
    var p = slot.pokemon || slot.mon || slot.poke;
    if (!p && slot.data && typeof slot.data === 'object' && !Array.isArray(slot.data)) {
      p = slot.data.pokemon || slot.data.mon || slot.data.poke;
    }
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    return p;
  }

  function normalizeAndValidatePokeapiRawSpriteUrl(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    var u = raw.trim();
    if (!u || u.length > 900) return '';
    if (u.indexOf('//') === 0) {
      u = (typeof location !== 'undefined' && location.protocol ? location.protocol : 'https:') + u;
    }
    try {
      var parsed = new URL(u);
      if ((parsed.protocol || '').toLowerCase() !== 'http:' && (parsed.protocol || '').toLowerCase() !== 'https:') {
        return '';
      }
      if ((parsed.hostname || '').toLowerCase() !== 'raw.githubusercontent.com') return '';
      var path = parsed.pathname || '';
      if (!/\/sprites\/pokemon\//i.test(path)) return '';
      if (!/\.png$/i.test(path)) return '';
      return parsed.href;
    } catch (e0) {
      return '';
    }
  }

  function normalizeAndValidateSmartnuoSpriteUrl(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    var u = raw.trim();
    if (!u || u.length > 900) return '';
    if (u.indexOf('//') === 0) {
      u = (typeof location !== 'undefined' && location.protocol ? location.protocol : 'https:') + u;
    }
    try {
      var parsed = new URL(u);
      if ((parsed.protocol || '').toLowerCase() !== 'http:' && (parsed.protocol || '').toLowerCase() !== 'https:') {
        return '';
      }
      var host = (parsed.hostname || '').toLowerCase();
      if (host !== 'smartnuo.com' && host !== 'www.smartnuo.com') return '';
      var path = parsed.pathname || '';
      if (path.indexOf('..') !== -1) return '';
      var pl = path.toLowerCase();
      // smartnuo sprite 두 경로: 옛 /upload/sprite/ … · 리뉴얼 후 share 로드 시 /data/sprite/ …
      if (pl.indexOf('/upload/sprite/') !== 0 && pl.indexOf('/data/sprite/') !== 0) return '';
      if (!/\.png$/i.test(path)) return '';
      return parsed.href;
    } catch (eSn) {
      return '';
    }
  }

  function spriteUrlFromSlot(slot) {
    if (slotEmpty(slot)) return '';
    var p = pokemonBlockFromSlot(slot);
    if (!p || typeof p.sprite !== 'string') return '';
    var raw = p.sprite.trim();
    if (!raw) return '';
    var gh = normalizeAndValidatePokeapiRawSpriteUrl(raw);
    if (gh) return gh;
    var sn = normalizeAndValidateSmartnuoSpriteUrl(raw);
    if (sn) return sn;
    return raw;
  }

  function buildSlotArtUrls(slots) {
    var out = [];
    var i;
    for (i = 0; i < 6; i++) {
      out.push(spriteUrlFromSlot(slots[i]));
    }
    return out;
  }

  function cloneSlots(slots) {
    try {
      return JSON.parse(JSON.stringify(slots));
    } catch (e) {
      return null;
    }
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== MSG_EXT || d.type !== 'NUO_TEAM_GET_SLOTS') return;
    var rid = d.requestId != null ? String(d.requestId) : '';
    waitForPokeListReady(2000, 100).then(function () {
      var slots = pickBestSlots();
      if (!slots) {
        window.postMessage(
          {
            source: MSG_BRIDGE,
            type: 'NUO_TEAM_SLOTS_REPLY',
            requestId: rid,
            ok: false,
            error: 'no_party_slots',
            slots: null,
            filled: null,
          },
          '*'
        );
        return;
      }
      var cloned = cloneSlots(slots);
      if (!cloned) {
        window.postMessage(
          {
            source: MSG_BRIDGE,
            type: 'NUO_TEAM_SLOTS_REPLY',
            requestId: rid,
            ok: false,
            error: 'clone_failed',
            slots: null,
            filled: null,
          },
          '*'
        );
        return;
      }
      var filled = [];
      var i;
      for (i = 0; i < 6; i++) {
        filled.push(!slotEmpty(slots[i]));
      }
      var slotArt;
      try {
        slotArt = buildSlotArtUrls(slots);
      } catch (eArt) {
        slotArt = ['', '', '', '', '', ''];
      }
      window.postMessage(
        {
          source: MSG_BRIDGE,
          type: 'NUO_TEAM_SLOTS_REPLY',
          requestId: rid,
          ok: true,
          slots: cloned,
          filled: filled,
          slotArt: slotArt,
        },
        '*'
      );
    });
  });
})();
