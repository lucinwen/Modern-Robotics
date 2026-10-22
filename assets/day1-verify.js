/* Day 1 · 五层合法性、十约束、三个必须分开的失败、六栏答卷与五维自评。 */
(function () {
  'use strict';
  var LK = window.LK;
  if (!LK) return;
  var KEY = 'mr-day1-verify-v1';

  /* ---------- 五层 ---------- */
  var LAYERS = [
    {
      name: '① 拓扑层：有没有一条路',
      question: '房间 A 与 B 之间是否存在一条被声明为可通行的边？',
      counter: 'A 与 B 只有共享墙面、墙上没有开洞，但图里仍画了一条 A–B 边。',
      evidence: '房间多边形 + 邻接表（room_graph），以及每条边的开口记录。',
      cost: '最便宜：改图、改邻接表即可。'
    },
    {
      name: '② 几何层：这条路够不够宽',
      question: '门洞净宽、净高、接触面长度是否满足机器人足迹与通过余量？',
      counter: '门宽 0.45 m、机器人宽 0.6 m。图边存在，但物理上过不去。',
      evidence: 'shared_wall_length、net_width、footprint（含安全余量）。',
      cost: '中等：改场景尺寸或改机器人规格。'
    },
    {
      name: '③ 状态层：此刻让不让过',
      question: '门是开是关、是否 locked、钥匙在谁手里、物体是否已被拿走？',
      counter: '几何全部合法，但门 locked 且手中无钥匙，plan 里也没有 unlock 动作。',
      evidence: '状态谓词真值表 + 前置条件检查（precondition）。',
      cost: '低：改规则、加动作，但要保证规划器不“猜”状态。'
    },
    {
      name: '④ 能力层：机器人会不会用',
      question: '机器人有没有对应技能：开门、伸手、抓取、推拉？关节限位允许吗？',
      counter: '能走到门前，但没有转把手的技能；或门把手高 1.05 m，超出可达高度。',
      evidence: '技能库（skill library）+ 关节限位 / 可达工作空间。',
      cost: '高：补技能、改硬件或改任务。'
    },
    {
      name: '⑤ 执行层：真机跑一次成不成',
      question: '真实 rollout 里是否成功？标定误差、动力学、打滑、延迟是否致命？',
      counter: '仿真全通过；实机门把手高度差 3 cm，抓空，30 次里成功 4 次。',
      evidence: '实机 rollout 日志：成功率、失败原因标签、重复次数。',
      cost: '最高：要重做标定、控制器或场景假设。'
    }
  ];

  function renderLayer(idx) {
    var d = LAYERS[idx];
    var panel = LK.$('d1-layer-panel');
    if (!panel || !d) return;
    panel.innerHTML = '<h4>' + d.name + '</h4><dl>'
      + '<dt>这一层问什么</dt><dd>' + d.question + '</dd>'
      + '<dt>典型反例</dt><dd>' + d.counter + '</dd>'
      + '<dt>需要的证据</dt><dd>' + d.evidence + '</dd>'
      + '<dt>改错的代价</dt><dd>' + d.cost + '</dd>'
      + '</dl>';
    LK.text('d1-layer-note', '第 ' + (idx + 1) + ' / 5 层。上层通过不代表下层通过；反过来，下层失败也不能回头否定上层的结论。');
  }

  LK.$$('.tabs [id^="d1-layer-"]').forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      LK.$$('.tabs [id^="d1-layer-"]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      renderLayer(i);
    });
  });
  renderLayer(0);

  /* ---------- 十约束 ---------- */
  var CONS = [
    { n: 1, t: 'A 与 B 在房间图里相邻（存在边）', b: '图关系', f: '规划器根本不会考虑进入 B' },
    { n: 2, t: '相邻边有真实开口支撑（不是只有共墙）', b: '图关系', f: '图上能走，几何上没有洞' },
    { n: 3, t: '门洞净宽 ≥ 机器人宽 + 安全余量', b: '几何', f: '卡在门口，或规划出穿模路径' },
    { n: 4, t: '门洞净高 ≥ 机器人最高点', b: '几何', f: '俯身才能过，站立姿态碰撞' },
    { n: 5, t: '共享墙面接触长度 > 0（Contact Witness）', b: '几何', f: '误把“贴近”当成“连通”' },
    { n: 6, t: '目标点在机器人可达工作空间内', b: '几何', f: '走到位置但手够不到杯子' },
    { n: 7, t: '门的开合 / 锁定状态满足当前动作前置条件', b: '状态', f: '规划出“穿门”动作，执行时门是锁的' },
    { n: 8, t: '目标物体仍在原位、未被移动或遮挡', b: '状态', f: '到达后发现杯子已经不在了' },
    { n: 9, t: '关节限位与自由度支持所需姿态', b: '机器人能力', f: '路径合法但逆解无解' },
    { n: 10, t: '具备所需技能（开门、抓取、推拉）与力矩', b: '机器人能力', f: '停在门前，或抓起即滑落' }
  ];

  function renderCons(bucket) {
    var rows = LK.$('d1-con-rows');
    if (!rows) return;
    rows.innerHTML = CONS.filter(function (c) { return bucket === '全部 10 条' || c.b === bucket; })
      .map(function (c) {
        return '<tr><td class="tabular-nums">' + c.n + '</td><td>' + c.t + '</td><td>' + c.b + '</td><td>' + c.f + '</td></tr>';
      }).join('');
  }

  var chips = ['d1-con-all', 'd1-con-graph', 'd1-con-geom', 'd1-con-state', 'd1-con-cap'];
  var chipBucket = { 'd1-con-all': '全部 10 条', 'd1-con-graph': '图关系', 'd1-con-geom': '几何', 'd1-con-state': '状态', 'd1-con-cap': '机器人能力' };
  chips.forEach(function (id) {
    var el = LK.$(id);
    if (!el) return;
    el.addEventListener('click', function () {
      chips.forEach(function (o) { var b = LK.$(o); if (b) b.classList.toggle('is-on', o === id); });
      renderCons(chipBucket[id]);
    });
  });
  renderCons('全部 10 条');

  /* ---------- 三个必须分开的失败 ---------- */
  var ANSWERS = {
    1: { layer: 2, why: '门宽 0.45 < 机器人宽 0.6：图上的边仍然存在，失败发生在净宽检查。要拿的是净宽与足迹的数值对比，以及检查器输出的 blocked_geometry。' },
    2: { layer: 1, why: '房间 B 移开后 A 与 B 不再共享墙面，那条边的几何支撑消失。shared_wall_length = 0，说明拓扑声明与几何不一致——这是拓扑层的错误，不是门宽问题。' },
    3: { layer: 3, why: '几何与净宽全部合法，卡住的是 locked 这个状态谓词，以及缺少 unlock 动作。修法是补状态与前置条件，不能让求解器“猜”门是开的。' }
  };
  var LAYER_NAME = { 1: '① 拓扑', 2: '② 几何', 3: '③ 状态', 4: '④ 能力', 5: '⑤ 执行' };

  function checkFailures() {
    var right = 0;
    [1, 2, 3].forEach(function (i) {
      var sel = LK.$('d1-fail-' + i);
      var out = LK.$('d1-fail-' + i + '-out');
      if (!sel || !out) return;
      var v = parseInt(sel.value, 10);
      if (!v) {
        LK.setFlag(out, '未作答', 'warn');
        return;
      }
      if (v === ANSWERS[i].layer) {
        right += 1;
        LK.setFlag(out, '✓ ' + LAYER_NAME[v], 'ok');
      } else {
        LK.setFlag(out, '✗ 应为 ' + LAYER_NAME[ANSWERS[i].layer], 'bad');
      }
    });
    var note = LK.$('d1-fail-note');
    if (!note) return;
    note.textContent = '答对 ' + right + ' / 3。' + ANSWERS[1].why + ' ｜ ' + ANSWERS[2].why + ' ｜ ' + ANSWERS[3].why;
  }

  var checkBtn = LK.$('d1-fail-check');
  if (checkBtn) checkBtn.addEventListener('click', checkFailures);

  /* ---------- 六栏答卷 ---------- */
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 隐私模式下忽略 */ }
  }

  function updateExam() {
    var done = 0;
    for (var i = 1; i <= 6; i += 1) {
      var cb = LK.$('d1-ex-' + i);
      if (!cb) continue;
      if (cb.checked) done += 1;
    }
    LK.text('d1-ex-count', done + ' / 6');
    var level = '未开始';
    if (done === 6) level = '可提交';
    else if (done >= 4) level = '缺关键栏';
    else if (done >= 1) level = '草稿';
    LK.text('d1-ex-level', level);
    var note = LK.$('d1-ex-note');
    if (note) {
      note.textContent = done === 6
        ? '六栏齐了，但第 ⑤ 栏必须写真实运行输出。没运行就写“未运行”，这仍然是诚实的完成。'
        : (done === 0 ? '左起第一栏往往被跳过：先写单位和原点，后面的推理才不会漂。' : '还差第 ' + (6 - done) + ' 栏。第 ⑤ 栏不能靠推断补，必须有检查器输出或明确写“未运行”。');
    }
  }

  for (var i = 1; i <= 6; i += 1) {
    (function (idx) {
      var cb = LK.$('d1-ex-' + idx);
      if (!cb) return;
      if (store['ex' + idx]) cb.checked = true;
      cb.addEventListener('change', function () {
        store['ex' + idx] = cb.checked;
        save();
        updateExam();
      });
    })(i);
  }
  updateExam();

  /* ---------- 五维自评 ---------- */
  function updateScore() {
    var total = 0;
    for (var k = 1; k <= 5; k += 1) {
      var input = LK.$('d1-sc-' + k);
      var out = LK.$('d1-sc-' + k + '-out');
      if (!input) continue;
      var v = parseInt(input.value, 10) || 0;
      if (out) out.textContent = v;
      total += v;
    }
    LK.text('d1-sc-total', total + ' / 20');
    var tip = '先补验证';
    if (total >= 16) tip = '可以做 D+1 复述';
    else if (total >= 12) tip = '补接口与验证';
    else if (total >= 8) tip = '重做一次例题';
    else tip = '回到五层重读';
    LK.text('d1-sc-tip', tip);
    store.score = total;
    save();
  }

  for (var k2 = 1; k2 <= 5; k2 += 1) {
    var el = LK.$('d1-sc-' + k2);
    if (el) el.addEventListener('input', updateScore);
  }
  if (store.score) {
    var each = Math.round(store.score / 5);
    for (var m = 1; m <= 5; m += 1) {
      var s = LK.$('d1-sc-' + m);
      if (s) s.value = String(each);
    }
  }
  updateScore();
})();
