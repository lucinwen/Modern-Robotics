/* 术语表：本地过滤（不联网、不请求任何资源） */
(function () {
  'use strict';

  var input = document.getElementById('glossary-filter');
  var count = document.getElementById('glossary-count');
  var clear = document.getElementById('glossary-clear');
  var empty = document.getElementById('glossary-empty');
  if (!input || !count) { return; }

  var terms = Array.prototype.slice.call(document.querySelectorAll('.term'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.term-group'));
  var total = terms.length;
  var ASCII = /^[\x20-\x7e]+$/;

  terms.forEach(function (term) {
    var raw = (term.textContent || '').toLowerCase();
    term.dataset.raw = raw.replace(/\s+/g, '');
    term.dataset.words = (raw.match(/[a-z0-9][a-z0-9+#.\-]*/g) || []).filter(function (w) { return /[a-z]/.test(w); }).join(' ');
  });

  function parts() {
    return input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function hit(term, part) {
    var words = term.dataset.words || '';
    if (ASCII.test(part)) {
      /* 英文按“整词或词首”匹配，避免 tf 命中 beat frequency 这类误报 */
      var list = words ? words.split(' ') : [];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] === part || list[i].indexOf(part) === 0) { return true; }
      }
      return false;
    }
    return (term.dataset.raw || '').indexOf(part) !== -1;
  }

  function run() {
    var list = parts();
    var shown = 0;
    terms.forEach(function (term) {
      var ok = list.every(function (part) { return hit(term, part); });
      term.hidden = !ok;
      if (ok) { shown += 1; }
    });
    groups.forEach(function (group) {
      group.hidden = !group.querySelector('.term:not([hidden])');
    });
    count.textContent = list.length ? '找到 ' + shown + ' / ' + total + ' 个词' : '共 ' + total + ' 个词';
    if (empty) { empty.hidden = shown !== 0; }
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { input.value = ''; run(); }
  });
  if (clear) {
    clear.addEventListener('click', function () {
      input.value = '';
      input.focus();
      run();
    });
  }
  count.textContent = '共 ' + total + ' 个词';
  run();
})();
