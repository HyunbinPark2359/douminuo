(function () {
  'use strict';
  try {
    var h = location.hash || '';
    if (/^#ps=/i.test(h)) {
      var href = location.origin + location.pathname + location.search + h;
      chrome.storage.session.set({ nuoCapturedPartyUrl: href });
    }
  } catch (e) {}
})();
