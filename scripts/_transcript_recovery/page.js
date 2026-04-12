(function () {
  'use strict';

  var inputEl = document.getElementById('input');
  var outputEl = document.getElementById('output');
  var copyBtn = document.getElementById('copyBtn');
  var toast = document.getElementById('copyToast');

  function updateOutput() {
    outputEl.value = typeof formatSample === 'function' ? formatSample(inputEl.value) : '';
  }

  var toastTimer;
  function showToast() {
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.add('hidden');
    }, 2000);
  }

  inputEl.addEventListener('input', updateOutput);

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
    outputEl.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (e) {}
  }
})();
