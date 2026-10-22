/* 路线总览：三种读法的显示切换（只改高亮与说明，不改内容） */
(function () {
  'use strict';

  var buttons = Array.prototype.slice.call(document.querySelectorAll('.path-picker .btn[data-mode]'));
  var roadmap = document.getElementById('start-roadmap');
  var note = document.getElementById('start-path-note');
  var hint = document.getElementById('start-path-hint');
  if (!buttons.length || !roadmap) { return; }

  var COPY = {
    core: {
      note: '<strong>14 天全读。</strong><span>参考总时长约 17 小时，建议每天一段，不要连读两天以上。</span>',
      hint: ''
    },
    sprint: {
      note: '<strong>只读 4 天：Day 1、Day 6、Day 11、Day 14。</strong><span>约 5.5 小时，外加复习时间。</span>',
      hint: '为什么是这四天：Day 1 决定你会不会讲坐标系；Day 6 决定你写不写得全接口合同；Day 11 决定你分不分得清“测量 / 推断 / 医疗判断”；Day 14 决定你在追问下会不会崩。其余十天变淡，不是不重要，是这两天来不及。'
    },
    search: {
      note: '<strong>不按顺序读。</strong><span>直接搜词，从术语表跳进具体小节。</span>',
      hint: '这种用法不需要通读。但要注意：一个词脱离了它所在的那条链，很容易背成口诀。查到之后，至少把那一节的演示拖一遍，再回到页末的答卷看自己能不能答。'
    }
  };

  function apply(mode) {
    var copy = COPY[mode] || COPY.core;
    roadmap.setAttribute('data-mode', mode);
    buttons.forEach(function (button) {
      var on = button.getAttribute('data-mode') === mode;
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (note) { note.innerHTML = copy.note; }
    if (hint) {
      hint.textContent = copy.hint;
      hint.hidden = !copy.hint;
    }
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      apply(button.getAttribute('data-mode'));
    });
  });

  apply('core');
})();
