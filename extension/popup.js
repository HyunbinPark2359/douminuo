(function () {
  'use strict';

  var LK = {
    showCalcFloating: 'nuo_fmt_showCalcFloating',
    theme: 'nuo_fmt_theme',
  };

  function normalizeTheme(v) {
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  }

  function applyPopupTheme(mode) {
    document.documentElement.setAttribute('data-theme', normalizeTheme(mode));
  }

  chrome.storage.local.get([LK.theme], function (got) {
    if (chrome.runtime.lastError) {
      applyPopupTheme('system');
      return;
    }
    applyPopupTheme(got[LK.theme]);
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local' || !changes[LK.theme]) return;
    applyPopupTheme(changes[LK.theme].newValue);
  });

  var SK = {
    urlInput: 'nuo_fmt_urlInput',
    includeUrls: 'nuo_fmt_includeUrls',
    includeRealStats: 'nuo_fmt_includeRealStats',
    includeMovePowers: 'nuo_fmt_includeMovePowers',
    includeBulkStats: 'nuo_fmt_includeBulkStats',
    showdownPaste: 'nuo_fmt_showdownPaste',
    calcAtkUrl: 'nuo_fmt_calcAtkUrl',
    calcDefUrl: 'nuo_fmt_calcDefUrl',
    activeTab: 'nuo_fmt_activeTab',
  };

  var urlInputEl = document.getElementById('urlInput');
  var includeUrlsEl = document.getElementById('includeUrls');
  var includeRealEl = document.getElementById('includeRealStats');
  var includeMovePowersEl = document.getElementById('includeMovePowers');
  var includeBulkStatsEl = document.getElementById('includeBulkStats');
  var showdownPasteEl = document.getElementById('showdownPaste');
  var outputEl = document.getElementById('output');
  var copyBtn = document.getElementById('copyBtn');
  var toast = document.getElementById('copyToast');
  var urlErrorEl = document.getElementById('urlError');
  var urlSpinnerEl = document.getElementById('urlSpinner');

  var tabFormat = document.getElementById('tabFormat');
  var tabCalc = document.getElementById('tabCalc');
  var panelFormat = document.getElementById('panelFormat');
  var panelCalc = document.getElementById('panelCalc');
  var calcAtkUrlEl = document.getElementById('calcAtkUrl');
  var calcDefUrlEl = document.getElementById('calcDefUrl');
  var calcFillBtn = document.getElementById('calcFillBtn');
  var calcErrorEl = document.getElementById('calcError');
  var calcSpinnerEl = document.getElementById('calcSpinner');
  var calcResultEl = document.getElementById('calcResult');
  var calcFloatingEl = document.getElementById('calcFloatingEnabled');

  function emptyResolved() {
    return {
      partyUrl: '',
      sampleUrls: [],
      pasteRaw: '',
      shareSlots: null,
      blockMovePowers: null,
      blockSpeciesTypes: null,
    };
  }

  var lastResolved = emptyResolved();

  var modifiersDocument = null;
  var modifiersLoadPromise = null;
  function ensureModifiersDocument(callback) {
    if (modifiersDocument) {
      callback(modifiersDocument);
      return;
    }
    if (!modifiersLoadPromise) {
      modifiersLoadPromise = fetch(chrome.runtime.getURL('modifiers.json'))
        .then(function (res) {
          return res.json();
        })
        .then(function (j) {
          modifiersDocument = j;
          return j;
        })
        .catch(function () {
          modifiersDocument = { version: 0, items: {}, abilities: {} };
          return modifiersDocument;
        });
    }
    modifiersLoadPromise.then(function () {
      callback(modifiersDocument);
    });
  }

  var moveKoDoc = null;
  var moveSlugToEnDoc = null;
  var natureKoDoc = null;
  var itemKoDoc = null;
  var abilityKoDoc = null;
  var typeKoDoc = null;
  var bundlesLoadPromise = null;
  function ensurePasteBundles(callback) {
    if (moveKoDoc && moveSlugToEnDoc && natureKoDoc && itemKoDoc && abilityKoDoc && typeKoDoc) {
      callback();
      return;
    }
    if (!bundlesLoadPromise) {
      function loadJsonDoc(url, empty) {
        return fetch(chrome.runtime.getURL(url))
          .then(function (r) {
            return r.json();
          })
          .catch(function () {
            return empty;
          });
      }
      function mergeByKo(baseDoc, fallbackDoc) {
        var base = baseDoc && baseDoc.byKo;
        var fb = fallbackDoc && fallbackDoc.byKo;
        if (!base || !fb) return;
        var k;
        for (k in fb) {
          if (!Object.prototype.hasOwnProperty.call(fb, k)) continue;
          if (base[k] == null) base[k] = fb[k];
        }
      }
      bundlesLoadPromise = Promise.all([
        loadJsonDoc('moveKoMap.json', { byKo: {} }),
        loadJsonDoc('moveSlugToEn.json', { bySlug: {} }),
        loadJsonDoc('natureKoMap.json', { koToSlug: {} }),
        loadJsonDoc('itemKoMap.json', { byKo: {} }),
        loadJsonDoc('abilityKoMap.json', { byKo: {} }),
        loadJsonDoc('typeKoMap.json', { byKo: {} }),
        loadJsonDoc('moveKoFallback.json', { byKo: {} }),
        loadJsonDoc('itemKoFallback.json', { byKo: {} }),
        loadJsonDoc('abilityKoFallback.json', { byKo: {} }),
      ]).then(function (arr) {
        moveKoDoc = arr[0] || { byKo: {} };
        moveSlugToEnDoc = arr[1] || { bySlug: {} };
        natureKoDoc = arr[2] || { koToSlug: {} };
        itemKoDoc = arr[3] || { byKo: {} };
        abilityKoDoc = arr[4] || { byKo: {} };
        typeKoDoc = arr[5] || { byKo: {} };
        mergeByKo(moveKoDoc, arr[6]);
        mergeByKo(itemKoDoc, arr[7]);
        mergeByKo(abilityKoDoc, arr[8]);
      });
    }
    bundlesLoadPromise.then(function () {
      callback();
    });
  }

  var resolveTimer = null;
  var resolveGeneration = 0;

  function setLoading(on) {
    urlSpinnerEl.hidden = !on;
  }

  function setUrlError(msg) {
    if (!msg) {
      urlErrorEl.hidden = true;
      urlErrorEl.textContent = '';
      return;
    }
    urlErrorEl.hidden = false;
    urlErrorEl.textContent = msg;
  }

  function persist() {
    try {
      chrome.storage.session.set({
        [SK.urlInput]: urlInputEl.value,
        [SK.calcAtkUrl]: calcAtkUrlEl ? calcAtkUrlEl.value : '',
        [SK.calcDefUrl]: calcDefUrlEl ? calcDefUrlEl.value : '',
        [SK.activeTab]: tabCalc && tabCalc.getAttribute('aria-selected') === 'true' ? 'calc' : 'format',
      });
      chrome.storage.local.set({
        [SK.includeUrls]: includeUrlsEl.checked,
        [SK.includeRealStats]: includeRealEl.checked,
        [SK.includeMovePowers]: includeMovePowersEl.checked,
        [SK.includeBulkStats]: includeBulkStatsEl.checked,
        [SK.showdownPaste]: showdownPasteEl.checked,
      });
    } catch (e) {}
  }

  function renderKoreanSample(mod) {
    var opts = {
      includeUrls: includeUrlsEl.checked,
      includeRealStats: includeRealEl.checked,
      includeMovePowers: includeMovePowersEl.checked,
      includeBulkStats: includeBulkStatsEl.checked,
      modifiersDocument: mod,
      partyUrl: lastResolved.partyUrl,
      sampleUrls: lastResolved.sampleUrls,
      blockMovePowers: lastResolved.blockMovePowers,
      blockSpeciesTypes: lastResolved.blockSpeciesTypes,
    };
    outputEl.value =
      typeof formatSample === 'function' ? formatSample(lastResolved.pasteRaw, opts) : '';
  }

  function renderOutput() {
    if (!lastResolved.pasteRaw) {
      outputEl.value = '';
      return;
    }
    ensureModifiersDocument(function (mod) {
      if (showdownPasteEl.checked) {
        var slots = lastResolved.shareSlots;
        if (!Array.isArray(slots) || !slots.length || typeof buildShowdownPaste !== 'function') {
          renderKoreanSample(mod);
          return;
        }
        ensurePasteBundles(function () {
          var out = buildShowdownPaste(slots, {
            modifiersDocument: mod,
            moveKoDoc: moveKoDoc,
            moveSlugToEnDoc: moveSlugToEnDoc,
            natureKoDoc: natureKoDoc,
            itemKoDoc: itemKoDoc,
            abilityKoDoc: abilityKoDoc,
            typeKoDoc: typeKoDoc,
          });
          outputEl.value = out || lastResolved.pasteRaw;
        });
        return;
      }
      renderKoreanSample(mod);
    });
  }

  var toastTimer;
  function showToast() {
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('visible');
    }, 2000);
  }

  function scheduleResolve() {
    clearTimeout(resolveTimer);
    resolveTimer = setTimeout(runResolve, 450);
  }

  function runResolve() {
    var raw = urlInputEl.value.trim();
    if (!raw) {
      setLoading(false);
      setUrlError('');
      lastResolved = emptyResolved();
      renderOutput();
      persist();
      return;
    }

    var gen = ++resolveGeneration;
    setUrlError('');
    setLoading(true);

    chrome.runtime.sendMessage({ type: 'RESOLVE_SHARE_INPUT', urlText: urlInputEl.value }, function (bg) {
      if (gen !== resolveGeneration) return;

      setLoading(false);

      if (chrome.runtime.lastError) {
        lastResolved = emptyResolved();
        setUrlError('연결 실패: ' + (chrome.runtime.lastError.message || ''));
        renderOutput();
        persist();
        return;
      }
      if (!bg || !bg.ok) {
        lastResolved = emptyResolved();
        setUrlError((bg && bg.error) || '불러오지 못했습니다.');
        renderOutput();
        persist();
        return;
      }

      setUrlError('');
      lastResolved = {
        partyUrl: (bg.partyUrl && String(bg.partyUrl).trim()) || '',
        sampleUrls: Array.isArray(bg.sampleUrls) ? bg.sampleUrls : [],
        pasteRaw: (bg.pasteRaw && String(bg.pasteRaw)) || '',
        shareSlots: Array.isArray(bg.shareSlots) ? bg.shareSlots : null,
        blockMovePowers: Array.isArray(bg.blockMovePowers) ? bg.blockMovePowers : null,
        blockSpeciesTypes: Array.isArray(bg.blockSpeciesTypes) ? bg.blockSpeciesTypes : null,
      };
      renderOutput();
      persist();
    });
  }

  urlInputEl.addEventListener('input', function () {
    persist();
    scheduleResolve();
  });

  includeUrlsEl.addEventListener('change', function () {
    persist();
    renderOutput();
  });

  includeRealEl.addEventListener('change', function () {
    persist();
    renderOutput();
  });

  includeMovePowersEl.addEventListener('change', function () {
    persist();
    renderOutput();
  });

  includeBulkStatsEl.addEventListener('change', function () {
    persist();
    renderOutput();
  });

  showdownPasteEl.addEventListener('change', function () {
    persist();
    renderOutput();
  });

  var FORMAT_LOCAL_OPT_KEYS = [
    SK.includeUrls,
    SK.includeRealStats,
    SK.includeMovePowers,
    SK.includeBulkStats,
    SK.showdownPaste,
  ];

  function applyFormatOptionsFromLocal(got) {
    if (typeof got[SK.includeUrls] === 'boolean') includeUrlsEl.checked = got[SK.includeUrls];
    else includeUrlsEl.checked = true;
    if (typeof got[SK.includeRealStats] === 'boolean') includeRealEl.checked = got[SK.includeRealStats];
    if (typeof got[SK.includeMovePowers] === 'boolean') includeMovePowersEl.checked = got[SK.includeMovePowers];
    else includeMovePowersEl.checked = false;
    if (typeof got[SK.includeBulkStats] === 'boolean') includeBulkStatsEl.checked = got[SK.includeBulkStats];
    else includeBulkStatsEl.checked = false;
    if (typeof got[SK.showdownPaste] === 'boolean') showdownPasteEl.checked = got[SK.showdownPaste];
    else showdownPasteEl.checked = false;
  }

  function migrateSessionFormatToLocalIfNeeded(done) {
    chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (lg) {
      if (chrome.runtime.lastError) {
        if (typeof done === 'function') done();
        return;
      }
      var has = false;
      var i;
      for (i = 0; i < FORMAT_LOCAL_OPT_KEYS.length; i++) {
        if (typeof lg[FORMAT_LOCAL_OPT_KEYS[i]] === 'boolean') {
          has = true;
          break;
        }
      }
      if (has) {
        if (typeof done === 'function') done();
        return;
      }
      chrome.storage.session.get(FORMAT_LOCAL_OPT_KEYS, function (sg) {
        if (chrome.runtime.lastError) {
          if (typeof done === 'function') done();
          return;
        }
        var patch = {};
        var j;
        for (j = 0; j < FORMAT_LOCAL_OPT_KEYS.length; j++) {
          var k = FORMAT_LOCAL_OPT_KEYS[j];
          if (typeof sg[k] === 'boolean') patch[k] = sg[k];
        }
        if (Object.keys(patch).length === 0) {
          if (typeof done === 'function') done();
          return;
        }
        chrome.storage.local.set(patch, function () {
          if (typeof done === 'function') done();
        });
      });
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var hit = false;
    var fi;
    for (fi = 0; fi < FORMAT_LOCAL_OPT_KEYS.length; fi++) {
      if (changes[FORMAT_LOCAL_OPT_KEYS[fi]]) {
        hit = true;
        break;
      }
    }
    if (!hit) return;
    chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (got) {
      if (chrome.runtime.lastError) return;
      applyFormatOptionsFromLocal(got);
      renderOutput();
    });
  });

  copyBtn.addEventListener('click', function () {
    var text = outputEl.value;
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showToast).catch(function () {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  });

  function fallbackCopy() {
    outputEl.focus();
    outputEl.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (e) {}
  }

  function setCalcPanel(on) {
    tabFormat.setAttribute('aria-selected', on ? 'false' : 'true');
    tabCalc.setAttribute('aria-selected', on ? 'true' : 'false');
    panelFormat.classList.toggle('tab-panel-hidden', on);
    panelFormat.hidden = !!on;
    panelCalc.classList.toggle('tab-panel-hidden', !on);
    panelCalc.hidden = !on;
  }

  function setCalcError(msg) {
    if (!msg) {
      calcErrorEl.hidden = true;
      calcErrorEl.textContent = '';
      return;
    }
    setCalcResult('');
    calcErrorEl.hidden = false;
    calcErrorEl.textContent = msg;
  }

  function setCalcResult(msg) {
    if (!msg) {
      calcResultEl.hidden = true;
      calcResultEl.textContent = '';
      return;
    }
    setCalcError('');
    calcResultEl.hidden = false;
    calcResultEl.textContent = msg;
  }

  function findSmartnuoTabId(callback) {
    function isNuoUrl(u) {
      return u && String(u).toLowerCase().indexOf('smartnuo.com') !== -1;
    }
    function newestTabId(tabs) {
      var list = (tabs || []).filter(function (t) {
        return isNuoUrl(t.url);
      });
      if (!list.length) return null;
      list.sort(function (a, b) {
        return (b.lastAccessed || 0) - (a.lastAccessed || 0);
      });
      return list[0].id;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (act) {
      if (chrome.runtime.lastError) {
        callback(null);
        return;
      }
      var cur = act && act[0];
      if (cur && isNuoUrl(cur.url)) {
        callback(cur.id);
        return;
      }
      chrome.tabs.query(
        { url: ['https://smartnuo.com/*', 'https://www.smartnuo.com/*'] },
        function (byUrl) {
          var id = newestTabId(byUrl);
          if (id != null) {
            callback(id);
            return;
          }
          chrome.tabs.query({}, function (all) {
            if (chrome.runtime.lastError) {
              callback(null);
              return;
            }
            callback(newestTabId(all));
          });
        }
      );
    });
  }

  function setCalcLoading(on) {
    calcSpinnerEl.hidden = !on;
    calcFillBtn.disabled = !!on;
    calcFillBtn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function runCalcFill() {
    setCalcError('');
    setCalcResult('');
    var atkUrl = calcAtkUrlEl.value.trim();
    var defUrl = calcDefUrlEl.value.trim();

    if (!atkUrl && !defUrl) {
      setCalcError('공격 또는 수비 URL 중 하나 이상 입력해 주세요.');
      return;
    }

    setCalcLoading(true);

    chrome.runtime.sendMessage(
      {
        type: 'GET_CALC_PAYLOADS',
        atkUrl: calcAtkUrlEl.value,
        defUrl: calcDefUrlEl.value,
      },
      function (bg) {
        if (!bg || !bg.ok) {
          setCalcLoading(false);
          setCalcError((bg && bg.error) || '페이로드를 만들지 못했습니다.');
          return;
        }

        var pl = bg.payloads || {};
        var va = pl.attacker && !pl.attacker.error;
        var vd = pl.defender && !pl.defender.error;
        if (!va && !vd) {
          setCalcLoading(false);
          var parts = [];
          if (atkUrl && pl.attacker && pl.attacker.error) {
            parts.push('공격측: ' + mapCalcFillError(pl.attacker.error));
          }
          if (defUrl && pl.defender && pl.defender.error) {
            parts.push('수비측: ' + mapCalcFillError(pl.defender.error));
          }
          if (!parts.length) {
            parts.push('적용할 수 있는 페이로드가 없습니다.');
          }
          setCalcError(parts.join(' '));
          return;
        }

        findSmartnuoTabId(function (tabId) {
          if (tabId == null) {
            setCalcLoading(false);
            setCalcError('스마트누오 탭을 연 뒤 다시 시도해 주세요.');
            return;
          }

          chrome.tabs.sendMessage(
            tabId,
            {
              type: 'NUO_CALC_FILL',
              payloads: pl,
              requestId: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
              onlyAttacker: false,
              onlyDefender: false,
            },
            function (r) {
              setCalcLoading(false);
              if (chrome.runtime.lastError) {
                setCalcError(mapCalcFillError(chrome.runtime.lastError.message));
                return;
              }
              if (!r || !r.ok) {
                setCalcError(mapCalcFillError(r && r.error));
                return;
              }
              var w = r.warnings;
              if (Array.isArray(w) && w.length) {
                setCalcResult('입력을 완료했습니다. 참고: ' + w.join(' '));
              } else {
                setCalcResult('입력을 완료했습니다.');
              }
              persist();
            }
          );
        });
      }
    );
  }

  tabFormat.addEventListener('click', function () {
    setCalcPanel(false);
    persist();
  });
  tabCalc.addEventListener('click', function () {
    setCalcPanel(true);
    persist();
  });

  calcAtkUrlEl.addEventListener('input', persist);
  calcDefUrlEl.addEventListener('input', persist);

  calcFillBtn.addEventListener('click', function () {
    runCalcFill();
  });

  function syncCalcFloatingSwitchA11y() {
    if (!calcFloatingEl) return;
    calcFloatingEl.setAttribute('aria-checked', calcFloatingEl.checked ? 'true' : 'false');
  }

  if (calcFloatingEl) {
    chrome.storage.local.get([LK.showCalcFloating], function (got) {
      if (chrome.runtime.lastError) {
        calcFloatingEl.checked = true;
      } else {
        calcFloatingEl.checked = got[LK.showCalcFloating] !== false;
      }
      syncCalcFloatingSwitchA11y();
    });
    calcFloatingEl.addEventListener('change', function () {
      syncCalcFloatingSwitchA11y();
      try {
        chrome.storage.local.set({ [LK.showCalcFloating]: calcFloatingEl.checked });
      } catch (e) {}
    });
  }

  migrateSessionFormatToLocalIfNeeded(function () {
    chrome.storage.local.get(FORMAT_LOCAL_OPT_KEYS, function (lgot) {
      if (!chrome.runtime.lastError) {
        applyFormatOptionsFromLocal(lgot);
      }
      chrome.storage.session.get(
        [SK.urlInput, SK.calcAtkUrl, SK.calcDefUrl, SK.activeTab],
        function (got) {
          if (chrome.runtime.lastError) {
            return;
          }
          if (got[SK.urlInput] != null) urlInputEl.value = got[SK.urlInput];

          if (got[SK.calcAtkUrl] != null) calcAtkUrlEl.value = got[SK.calcAtkUrl];
          if (got[SK.calcDefUrl] != null) calcDefUrlEl.value = got[SK.calcDefUrl];
          if (got[SK.activeTab] === 'calc') {
            setCalcPanel(true);
          }

          if (urlInputEl.value.trim()) {
            scheduleResolve();
          } else {
            renderOutput();
          }
        }
      );
    });
  });
})();
