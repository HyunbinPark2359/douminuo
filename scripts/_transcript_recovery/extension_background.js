importScripts('shareToRaw.js');
importScripts('simpleMovePower.js');

/**
 * GET /api/party/share/:id → 파티(6슬롯) 또는 단일 샘플.
 * 통합 입력: 한 줄(자동 판별) / 여러 줄(각각 단일 샘플만).
 */
(function () {
  'use strict';

  var SR = globalThis.shareToRaw;
  var SMP = globalThis.simpleMovePower;

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

  function buildDisplayPartyUrl(origin, pathname, id) {
    var p = pathname || '/';
    return origin + p + '#ps=' + id;
  }

  function postShareSlot(origin, pathname, slotIndex1Based, slotData) {
    if (slotData == null) return Promise.resolve('');
    if (typeof slotData === 'object' && !Array.isArray(slotData) && Object.keys(slotData).length === 0) {
      return Promise.resolve('');
    }
    return fetch(origin + '/api/party/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        params: {
          data: { slot: slotIndex1Based, data: slotData },
        },
      }),
    })
      .then(function (res) {
        if (!res.ok) return '';
        return res.json();
      })
      .then(function (j) {
        if (!j) return '';
        var sid = j.id != null ? j.id : j.data && j.data.id;
        if (!sid) return '';
        return origin + (pathname || '/') + '#ps=' + sid;
      })
      .catch(function () {
        return '';
      });
  }

  function fetchShareGET(origin, id) {
    return fetch(origin + '/api/party/share/' + encodeURIComponent(id), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('GET ' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
        });
      }
      return res.json();
    });
  }

  function fetchPokemonTypesEn(name) {
    if (!name) return Promise.resolve([]);
    var url = 'https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(String(name).toLowerCase());
    return fetch(url, {
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) return [];
        return res.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.types)) return [];
        return j.types
          .map(function (t) {
            return t && t.type && t.type.name ? String(t.type.name).toLowerCase() : '';
          })
          .filter(Boolean);
      })
      .catch(function () {
        return [];
      });
  }

  function collectTypesFromSlotPokemon(poke) {
    if (!poke) return [];
    var out = [];
    [poke.firstType, poke.secondType, poke.first_type, poke.second_type].forEach(function (t) {
      if (t == null || t === '') return;
      var e = SMP.normalizeTypeToEn(t);
      if (e && out.indexOf(e) < 0) out.push(e);
    });
    return out;
  }

  function mergeTypeLists(a, b) {
    var out = (a && a.slice()) || [];
    (b || []).forEach(function (t) {
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }

  function resolveSpeciesTypesForSlot(slotData) {
    var poke = slotData && slotData.pokemon;
    var local = collectTypesFromSlotPokemon(poke);
    if (local.length >= 2) return Promise.resolve(local);
    if (poke && poke.name) {
      return fetchPokemonTypesEn(poke.name).then(function (apiTypes) {
        var merged = mergeTypeLists(local, apiTypes);
        return merged.length ? merged : local;
      });
    }
    return Promise.resolve(local);
  }

  function computeBlockPowersForSlot(slotData) {
    if (SR.isSlotEmpty(slotData)) {
      return Promise.resolve([null, null, null, null]);
    }
    return resolveSpeciesTypesForSlot(slotData).then(function (types) {
      return SMP.computeMovePowers(slotData, types);
    });
  }

  function normalizeSlotsToSix(slots) {
    var s = Array.isArray(slots) ? slots.slice(0, 6) : [];
    while (s.length < 6) s.push({});
    return s;
  }

  function resolvePartyWithRaws(origin, pathname, partyId, slots) {
    var slots6 = normalizeSlotsToSix(slots);
    var displayParty = buildDisplayPartyUrl(origin, pathname, partyId);
    var urls = [];
    var raws = [];
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < 6; i++) {
      (function (idx) {
        chain = chain.then(function () {
          var slotData = slots6[idx];
          raws.push(SR.shareSlotToRaw(slotData, idx + 1, { numberedTitle: true }));
          return postShareSlot(origin, pathname, idx + 1, slotData).then(function (u) {
            urls.push(u || '');
          });
        });
      })(i);
    }
    return chain.then(function () {
      var blockMovePowers = [];
      var pchain = Promise.resolve();
      for (i = 0; i < 6; i++) {
        (function (idx) {
          pchain = pchain.then(function () {
            return computeBlockPowersForSlot(slots6[idx]).then(function (row) {
              blockMovePowers[idx] = row;
            });
          });
        })(i);
      }
      return pchain.then(function () {
        return {
          partyUrl: displayParty,
          sampleUrls: urls,
          pasteRaw: raws.join('\n\n'),
          blockMovePowers: blockMovePowers,
        };
      });
    });
  }

  function mapShareError(err) {
    var m = err && err.message ? String(err.message) : String(err);
    if (m === 'empty' || m === 'empty_input') return 'URL을 입력해 주세요.';
    if (m === 'no_party_url' || m === 'bad_url') return 'URL 형식을 확인해 주세요.';
    if (m === 'no_ps_id') return '#ps= 가 포함된 스마트누오 공유 URL인지 확인해 주세요.';
    if (m === 'share_not_found' || m === 'empty_response') {
      return '공유 데이터를 불러오지 못했습니다. URL·네트워크·스마트누오 서버 상태를 확인해 주세요.';
    }
    if (m === 'unknown_share_shape') {
      return '지원하지 않는 공유 형식입니다. 스마트누오 업데이트 시 포맷터 매핑이 필요할 수 있습니다.';
    }
    if (m.indexOf('party_on_multiline') !== -1 || m === '파티 공유는 URL을 한 줄만 입력해 주세요.') {
      return '파티 공유는 URL을 한 줄만 입력해 주세요. 여러 샘플은 각 줄에 샘플 URL만 넣어 주세요.';
    }
    return m;
  }

  function resolveMultiSample(lines) {
    var results = [];
    var chain = Promise.resolve();
    lines.forEach(function (line) {
      chain = chain.then(function () {
        var full = normalizePartyUrlInput(line);
        if (!full) throw new Error('bad_url');
        var id = extractPsId(full);
        if (!id) throw new Error('no_ps_id');
        var baseUrl = new URL(full);
        var origin = baseUrl.origin;
        var pathname = baseUrl.pathname || '/';
        return fetchShareGET(origin, id).then(function (j) {
          var cls = SR.classifyShareGetResponse(j);
          if (cls.type === 'party') throw new Error('party_on_multiline');
          if (cls.type !== 'single') throw new Error('unknown_share_shape');
          var pasteOne = SR.shareSlotToRaw(cls.slot, 1, { numberedTitle: false });
          var displayUrl = buildDisplayPartyUrl(origin, pathname, id);
          results.push({ pasteOne: pasteOne, displayUrl: displayUrl, slot: cls.slot });
        });
      });
    });
    return chain.then(function () {
      var blockMovePowers = [];
      var pchain = Promise.resolve();
      results.forEach(function (r, idx) {
        pchain = pchain.then(function () {
          return computeBlockPowersForSlot(r.slot).then(function (row) {
            blockMovePowers[idx] = row;
          });
        });
      });
      return pchain.then(function () {
        return {
          partyUrl: '',
          sampleUrls: results.map(function (r) {
            return r.displayUrl;
          }),
          pasteRaw: results.map(function (r) {
            return r.pasteOne;
          }).join('\n---\n'),
          blockMovePowers: blockMovePowers,
        };
      });
    });
  }

  function resolveShareInput(urlText) {
    var lines = String(urlText || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    if (lines.length === 0) return Promise.reject(new Error('empty'));

    var first = normalizePartyUrlInput(lines[0]);
    if (!first) return Promise.reject(new Error('bad_url'));
    var id = extractPsId(first);
    if (!id) return Promise.reject(new Error('no_ps_id'));

    var baseUrl = new URL(first);
    var origin = baseUrl.origin;
    var pathname = baseUrl.pathname || '/';

    if (lines.length === 1) {
      return fetchShareGET(origin, id).then(function (j) {
        var cls = SR.classifyShareGetResponse(j);
        if (cls.type === 'party') {
          return resolvePartyWithRaws(origin, pathname, id, cls.slots);
        }
        return computeBlockPowersForSlot(cls.slot).then(function (row) {
          return {
            partyUrl: '',
            sampleUrls: [buildDisplayPartyUrl(origin, pathname, id)],
            pasteRaw: SR.shareSlotToRaw(cls.slot, 1, { numberedTitle: false }),
            blockMovePowers: [row],
          };
        });
      });
    }

    return resolveMultiSample(lines);
  }

  function attachResponse(sendResponse, data) {
    sendResponse({
      ok: true,
      partyUrl: data.partyUrl,
      sampleUrls: data.sampleUrls,
      pasteRaw: data.pasteRaw,
      blockMovePowers: data.blockMovePowers,
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg) return;

    if (msg.type === 'RESOLVE_SHARE_INPUT') {
      resolveShareInput(msg.urlText || '')
        .then(function (data) {
          attachResponse(sendResponse, data);
        })
        .catch(function (err) {
          sendResponse({
            ok: false,
            error: mapShareError(err),
          });
        });
      return true;
    }

    if (msg.type === 'RESOLVE_PARTY_URLS') {
      var line = msg.partyUrl || '';
      resolveShareInput(line)
        .then(function (data) {
          attachResponse(sendResponse, data);
        })
        .catch(function (err) {
          sendResponse({
            ok: false,
            error: mapShareError(err),
          });
        });
      return true;
    }
  });
})();
