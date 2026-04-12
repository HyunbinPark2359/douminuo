(function () {
  'use strict';

  function postShareSlot(slotIndex1Based, slotData) {
    if (slotData == null) return Promise.resolve('');
    if (typeof slotData === 'object' && !Array.isArray(slotData) && Object.keys(slotData).length === 0) {
      return Promise.resolve('');
    }
    var origin = location.origin;
    var pathname = location.pathname || '/';
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
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error('HTTP ' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
          });
        }
        return res.json();
      })
      .then(function (j) {
        var id = j.id != null ? j.id : j.data && j.data.id;
        if (!id) throw new Error('no_share_id');
        return origin + pathname + '#ps=' + id;
      });
  }

  function injectGetPartySlots() {
    return new Promise(function (resolve, reject) {
      var nuoId = 'nuo' + Math.random().toString(36).slice(2, 12);
      var done = false;
      var timeout = setTimeout(function () {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMsg);
        reject(new Error('timeout'));
      }, 10000);

      function onMsg(ev) {
        if (ev.source !== window || !ev.data || ev.data.type !== 'NUO_FORMATTER_SLOTS') return;
        if (ev.data.nuoId !== nuoId) return;
        if (done) return;
        done = true;
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
        if (ev.data.ok) resolve(ev.data.slots || []);
        else reject(new Error(ev.data.error || 'no_store'));
      }

      window.addEventListener('message', onMsg);

      var fn = function (id) {
        try {
          var el = document.querySelector('#app');
          var vm = el && el.__vue__;
          if (!vm || !vm.$store) {
            window.postMessage({ type: 'NUO_FORMATTER_SLOTS', nuoId: id, ok: false, error: 'no_store' }, '*');
            return;
          }
          var raw = vm.$store.state.party_slots || [];
          var serialized = raw.map(function (slot) {
            try {
              return JSON.parse(JSON.stringify(slot));
            } catch (e) {
              return null;
            }
          });
          window.postMessage({ type: 'NUO_FORMATTER_SLOTS', nuoId: id, ok: true, slots: serialized }, '*');
        } catch (e) {
          window.postMessage(
            {
              type: 'NUO_FORMATTER_SLOTS',
              nuoId: id,
              ok: false,
              error: String((e && e.message) || e),
            },
            '*'
          );
        }
      };

      var script = document.createElement('script');
      script.textContent = '(' + fn.toString() + ')(' + JSON.stringify(nuoId) + ');';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    });
  }

  function partyUrlFromLocation() {
    return location.origin + location.pathname + location.search + location.hash;
  }

  function collectShareUrls() {
    return injectGetPartySlots().then(function (slots) {
      var tasks = [];
      for (var i = 0; i < 6; i++) {
        (function (idx) {
          tasks.push(
            postShareSlot(idx + 1, slots[idx]).catch(function () {
              return '';
            })
          );
        })(i);
      }
      return Promise.all(tasks).then(function (urls) {
        return {
          partyUrl: partyUrlFromLocation(),
          sampleUrls: urls,
        };
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'FETCH_SHARE_URLS') return;
    collectShareUrls()
      .then(function (data) {
        sendResponse({ ok: true, partyUrl: data.partyUrl, sampleUrls: data.sampleUrls });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
      });
    return true;
  });
})();
