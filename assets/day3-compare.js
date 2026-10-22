/* Day 3 · 三条路径推演与 Checkpoint A 留痕。 */
(function () {
  'use strict';
  var LK = window.LK;
  if (!LK) return;
  var KEY = 'mr-day3-compare-v1';

  var PATHS = {
    ok: {
      chain: [
        ['unlock(doorD)', 'is-active'],
        ['open(doorD)', ''],
        ['move(roomA→roomB)', ''],
        ['pickup(cupC)', '']
      ],
      cards: [
        ['前置条件逐条成立', 'has(robot,keyK) 为真；机器人位于门旁；具备开锁技能。三条同时成立，unlock 才允许发生。'],
        ['效果是“事实替换”', 'unlock 的效果是 not locked(doorD)。它不产生“门变宽”，也不产生“机器人会走路”。'],
        ['每步之后重新检查', 'move 需要 open(doorD) 且门净宽 ≥ 机器人宽；pickup 需要手空且杯子可达。任何一条不满足，计划就在那一步断掉。']
      ],
      note: '这条路径能走通，是因为符号层与连续层的条件在每一步都同时成立——不是因为“规划器比较强”。'
    },
    sym: {
      chain: [
        ['unlock(doorD)', 'is-active'],
        ['前置 has(robot,keyK) = 假', ''],
        ['无替代动作', ''],
        ['计划无解（符号层）', '']
      ],
      cards: [
        ['失败发生在状态层', '缺的是 has(robot,keyK) 这个事实，不是门宽，也不是运动学。归因写错层，修法就会全部跑偏。'],
        ['正确行为是“报无解”', '不能把 locked(doorD) 悄悄改成假来凑一个计划；那等于改题目。也不能让求解器“猜”钥匙在哪里。'],
        ['补什么才是真修复', '若已有合法取钥匙动作，就把它纳入计划；若没有，就需要修订动作域或能力配置，并明确记为模型改动。']
      ],
      note: '这是三种失败里最容易被掩盖的一种：把隐含前提塞进初态，demo 会很好看，但经不起“你的钥匙是哪来的”这一问。'
    },
    mot: {
      chain: [
        ['符号计划存在', 'is-active'],
        ['open 需要 reach(handle)', ''],
        ['把手 1.30 m > 可达 1.05 m', ''],
        ['连续层无解 → 回灌任务层', '']
      ],
      cards: [
        ['符号层完全合法', 'unlock → open → move → pickup 每一步的 precondition 都被满足，PDDL 会给出“成功”的计划。'],
        ['连续层拿不到解', 'reach(handle) 需要把手在可达工作空间内。1.30 m 超出 1.05 m 的上限，逆解不存在，open 无法执行。'],
        ['回灌要带五个字段', '哪个世界（含把手高度）、哪个动作／对象、哪条条件、什么证据、结论范围。缺一项，上层就无法判断该换抓取还是该改环境。']
      ],
      note: '这类失败证明了一件事：符号计划有解，只说明“顺序成立”；能不能执行，必须由连续层另外回答。'
    }
  };

  function renderPath(key) {
    var p = PATHS[key];
    if (!p) return;
    var chain = LK.$('d3-path-chain');
    if (chain) {
      chain.innerHTML = p.chain.map(function (c, i) {
        var node = '<span class="node ' + c[1] + '">' + c[0] + '</span>';
        return i === 0 ? node : '<span class="arrow">→</span>' + node;
      }).join('');
    }
    var cards = LK.$('d3-path-cards');
    if (cards) {
      cards.innerHTML = p.cards.map(function (c) {
        return '<article class="case-card"><h4>' + c[0] + '</h4><dl><div><dd>' + c[1] + '</dd></div></dl></article>';
      }).join('');
    }
    LK.text('d3-path-note', p.note);
  }

  var tabs = [['d3-path-ok', 'ok'], ['d3-path-sym', 'sym'], ['d3-path-mot', 'mot']];
  tabs.forEach(function (t) {
    var el = LK.$(t[0]);
    if (!el) return;
    el.addEventListener('click', function () {
      tabs.forEach(function (o) { var b = LK.$(o[0]); if (b) b.setAttribute('aria-pressed', o[0] === t[0] ? 'true' : 'false'); });
      renderPath(t[1]);
    });
  });
  renderPath('ok');

  /* ---------- Checkpoint A ---------- */
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 忽略 */ }
  }

  function updateCpa() {
    var first = 0;
    var rev = 0;
    for (var i = 1; i <= 4; i += 1) {
      var a = LK.$('d3-cpa-' + i + 'a');
      var b = LK.$('d3-cpa-' + i + 'b');
      if (a && a.checked) first += 1;
      if (b && b.checked) rev += 1;
    }
    LK.text('d3-cpa-first', first + ' / 4');
    LK.text('d3-cpa-rev', rev + ' / 4');
    var note = LK.$('d3-cpa-note');
    if (!note) return;
    if (first === 4 && rev === 4) {
      note.textContent = '首次与修订都齐了。现在对比两列内容：修订版如果只是“写得更长”，说明还没真正改变理解；好的修订会换掉某个归因层或补上一条以前没写的证据。';
    } else if (first === 4) {
      note.textContent = '首次答案已完整。先别急着看参考答案，隔一天再修订——同一小时内改，往往只是润色。';
    } else {
      note.textContent = '还剩 ' + (4 - first) + ' 条首次答案。四类冲突里，“几何冲突”最容易和“状态冲突”混在一起，写的时候先问：改的是事实，还是改的是身体能不能做到。';
    }
  }

  for (var i = 1; i <= 4; i += 1) {
    ['a', 'b'].forEach(function (sfx) {
      (function (idx, s) {
        var cb = LK.$('d3-cpa-' + idx + s);
        if (!cb) return;
        if (store[idx + s]) cb.checked = true;
        cb.addEventListener('change', function () {
          store[idx + s] = cb.checked;
          save();
          updateCpa();
        });
      })(i, sfx);
    });
  }
  updateCpa();
})();
