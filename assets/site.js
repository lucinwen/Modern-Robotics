(function () {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let preferredTheme = null;
  try { preferredTheme = localStorage.getItem('mr-notes-theme'); } catch (_) {}
  function setTheme(theme) {
    root.dataset.theme = theme;
    if (themeButton) {
      themeButton.textContent = theme === 'dark' ? '浅色模式' : '深色模式';
      themeButton.setAttribute('aria-label', '切换到' + (theme === 'dark' ? '浅色' : '深色') + '模式');
    }
  }
  setTheme(preferredTheme || (media && media.matches ? 'dark' : 'light'));
  if (themeButton) themeButton.addEventListener('click', function () {
    preferredTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(preferredTheme);
    try { localStorage.setItem('mr-notes-theme', preferredTheme); } catch (_) {}
  });
  if (media && media.addEventListener) media.addEventListener('change', function (event) {
    if (!preferredTheme) setTheme(event.matches ? 'dark' : 'light');
  });

  const sections = Array.from(document.querySelectorAll('[data-nav]'));
  const links = Array.from(document.querySelectorAll('.lesson-nav a'));
  let scheduled = false;
  function updateNavigation() {
    let current = sections[0];
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= Math.min(190, innerHeight * .3)) current = section;
    });
    links.forEach(function (link) {
      const active = current && link.hash === '#' + current.id;
      link.classList.toggle('is-current', Boolean(active));
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  window.addEventListener('scroll', function () {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
  }, {passive: true});
  updateNavigation();

  const note = document.getElementById('learning-note');
  const noteStatus = document.getElementById('note-status');
  const exportButton = document.getElementById('export-note');
  const lessonKey = document.body.dataset.lessonKey || 'day-01';
  const lessonTitle = document.body.dataset.lessonTitle || 'Day 01 · 我的学习笔记';
  const lessonTopic = document.body.dataset.lessonTopic || 'Modern Robotics 空间基础与 Day 1 应用';
  const noteKey = 'mr-learning-notes:' + lessonKey + ':v1';
  if (note) {
    try {
      const saved = localStorage.getItem(noteKey);
      if (saved) { note.value = saved; noteStatus.textContent = '已恢复此浏览器中的笔记'; }
    } catch (_) { noteStatus.textContent = '此浏览器无法保存，请使用导出'; }
    note.addEventListener('input', function () {
      try { localStorage.setItem(noteKey, note.value); noteStatus.textContent = '已保存到此浏览器'; }
      catch (_) { noteStatus.textContent = '保存不可用，请导出保留笔记'; }
    });
  }
  if (note && exportButton) exportButton.addEventListener('click', function () {
    const text = '# ' + lessonTitle + '\n\n' + note.value + '\n\n---\n课程：' + lessonTopic + '\nhttps://github.com/lucinwen/Modern-Robotics\n';
    const blob = new Blob([text], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = lessonKey + '-my-notes.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    noteStatus.textContent = '已生成笔记下载';
  });
})();
