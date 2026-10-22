/* Day 5 · ROS2 通信语义、消息拓扑、TF、Costmap、Action 状态机与接口合同。 */
(function () {
  'use strict';
  var LK = window.LK;
  if (!LK) return;

  /* ---------- 通信语义 ---------- */
  var COMM = [
    {
      title: '每 50 ms 上报一次轮速',
      pick: 'Topic',
      why: '周期性、单向、没人需要“这次上报的结果”。订阅者可以有 0 个或多个，发布者不关心谁在听。',
      wrong: '如果用 Service：发布者必须等每个订阅者应答，20 Hz 会被拖垮；如果用 Action：完全没有必要。'
    },
    {
      title: '查询当前地图版本号',
      pick: 'Service',
      why: '一问一答、耗时极短、不需要进度反馈，也不需要取消。',
      wrong: '如果用 Topic：调用方要等下一次广播，无法保证“立刻拿到当前值”。'
    },
    {
      title: '去 B 房间，中途要能取消',
      pick: 'Action',
      why: '长时任务，需要周期性进度反馈、可取消、有明确终态（成功 / 失败 / 已取消）。',
      wrong: '如果用 Service：执行期间调用方被阻塞，无法反馈进度，也无法取消。'
    },
    {
      title: '开门，需要 8 秒且可能卡住',
      pick: 'Action',
      why: '同样是长时动作，且“卡住”必须能被上层看见并中止，而不是一直等。',
      wrong: '如果用 Service：卡住时没有中间状态可观测，只能等超时——而超时并不能告诉你卡在哪。'
    }
  ];

  function renderComm(i) {
    var d = COMM[i];
    if (!d) return;
    var panel = LK.$('d5-comm-panel');
    if (panel) {
      panel.innerHTML = '<h4>推荐：' + d.pick + '</h4><dl>'
        + '<div><dt>为什么</dt><dd>' + d.why + '</dd></div>'
        + '<div><dt>选错会缺什么</dt><dd>' + d.wrong + '</dd></div></dl>';
    }
    LK.text('d5-comm-note', '判断口诀：问“要不要进度、要不要取消、要不要终态”。三个都要 → Action；只要一个即时答案 → Service；只是持续告诉别人 → Topic。');
    LK.$$('.tabs [id^="d5-c-"]').forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  ['d5-c-1', 'd5-c-2', 'd5-c-3', 'd5-c-4'].forEach(function (id, i) {
    var el = LK.$(id);
    if (el) el.addEventListener('click', function () { renderComm(i); });
  });
  renderComm(0);

  /* ---------- 消息拓扑 ---------- */
  var EDGES = [
    {
      name: '① goal_pose：任务层 → Nav2 Action',
      rows: [
        ['消息含义', '目标位姿：去哪个位置、朝哪个方向'],
        ['方向', '任务层 → ActionServer（请求）'],
        ['单位', '米 / 弧度'],
        ['参考坐标系', '<code>map</code>'],
        ['发布者 / 消费者', '任务层 / Nav2 ActionServer'],
        ['断掉的表现', '目标直接拒收，或落到墙里']
      ]
    },
    {
      name: '② 规划请求：ActionServer → Planner',
      rows: [
        ['消息含义', '起点、终点、当前代价地图'],
        ['方向', 'ActionServer → Planner'],
        ['单位', '米 / 弧度；代价为无量纲 0–255'],
        ['参考坐标系', '<code>map</code>'],
        ['发布者 / 消费者', 'ActionServer / 全局规划器'],
        ['断掉的表现', '无 path 产生，Action 以 aborted 结束']
      ]
    },
    {
      name: '③ path：Planner → Controller',
      rows: [
        ['消息含义', '一串位姿（路径），可能带速度约束'],
        ['方向', 'Planner → Controller'],
        ['单位', '米 / 弧度'],
        ['参考坐标系', '<code>map</code>（局部控制时常转到 <code>odom</code>）'],
        ['发布者 / 消费者', '全局规划器 / 局部控制器'],
        ['断掉的表现', '控制器没有参考，原地不动或报“无有效路径”']
      ]
    },
    {
      name: '④ cmd_vel：Controller → 机器人',
      rows: [
        ['消息含义', '线速度与角速度指令'],
        ['方向', 'Controller → 底盘'],
        ['单位', 'm/s、rad/s'],
        ['参考坐标系', '<code>base_link</code>（车体系）'],
        ['发布者 / 消费者', '局部控制器 / 底盘驱动'],
        ['断掉的表现', '有路径但车不动：控制链断在最后一米']
      ]
    },
    {
      name: '⑤ odom / TF：机器人 → 系统',
      rows: [
        ['消息含义', '里程计位姿与 <code>odom → base_link</code> 变换'],
        ['方向', '底盘 → TF 树（广播）'],
        ['单位', '米 / 弧度；带时间戳'],
        ['参考坐标系', '<code>odom</code>'],
        ['发布者 / 消费者', '轮式里程计 / 所有需要位姿的模块'],
        ['断掉的表现', 'TF 树断裂，规划与控制同时失效']
      ]
    },
    {
      name: '⑥ 传感 → costmap',
      rows: [
        ['消息含义', '激光 / 点云 / 深度，转成障碍观测'],
        ['方向', '传感器 → 代价地图层'],
        ['单位', '米；点云为米制坐标'],
        ['参考坐标系', '传感器 frame，经 TF 转到 <code>map</code>'],
        ['发布者 / 消费者', '传感器驱动 / costmap 观测层'],
        ['断掉的表现', '障碍不更新：地图上是空的，现实里有东西']
      ]
    },
    {
      name: '⑦ costmap → 规划与控制',
      rows: [
        ['消息含义', '占据栅格 + 膨胀层 + 代价'],
        ['方向', 'costmap → Planner / Controller'],
        ['单位', '栅格分辨率（m/cell）、代价 0–255'],
        ['参考坐标系', '<code>map</code>（全局）/ <code>odom</code>（局部）'],
        ['发布者 / 消费者', '代价地图 / 规划器与控制器'],
        ['断掉的表现', '规划出穿越障碍的路径，或干脆无解']
      ]
    },
    {
      name: '⑧ Action 反馈：ActionServer → 任务层',
      rows: [
        ['消息含义', '剩余距离、当前位姿、预计时间、失败码'],
        ['方向', 'ActionServer → 任务层（反馈流 + 结果）'],
        ['单位', '米 / 秒 / 枚举'],
        ['参考坐标系', '<code>map</code>'],
        ['发布者 / 消费者', 'ActionServer / 任务层'],
        ['断掉的表现', '上层无法区分“在走”和“卡住”，只能靠超时']
      ]
    }
  ];

  function renderEdge(i) {
    var d = EDGES[i];
    if (!d) return;
    var body = LK.$('d5-topo-rows');
    if (body) {
      body.innerHTML = d.rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
      }).join('');
    }
    LK.text('d5-topo-note', d.name + '。这六项填满，才算把这条箭头定义清楚；缺一项，对接时就会变成“你那边看是通的啊”。');
    var chips = ['d5-t-1', 'd5-t-2', 'd5-t-3', 'd5-t-4', 'd5-t-5', 'd5-t-6', 'd5-t-7', 'd5-t-8'];
    chips.forEach(function (id, k) {
      var el = LK.$(id);
      if (el) el.classList.toggle('is-on', k === i);
    });
  }

  ['d5-t-1', 'd5-t-2', 'd5-t-3', 'd5-t-4', 'd5-t-5', 'd5-t-6', 'd5-t-7', 'd5-t-8'].forEach(function (id, i) {
    var el = LK.$(id);
    if (el) el.addEventListener('click', function () { renderEdge(i); });
  });
  renderEdge(0);

  /* ---------- TF 年龄 ---------- */
  function renderTf(age) {
    var stale = age > 0.5;
    var chain = LK.$('d5-tf-chain');
    if (chain) {
      chain.innerHTML = '<span class="node">map</span><span class="arrow">→</span>'
        + '<span class="node ' + (stale ? '' : 'is-active') + '">odom</span><span class="arrow">→</span>'
        + '<span class="node ' + (stale ? '' : 'is-active') + '">base_link</span>'
        + '<span class="arrow">·</span><span class="node ' + (stale ? 'is-active' : '') + '">最新变换 ' + LK.fmt(age, 2) + ' s 前</span>';
    }
    LK.text('d5-tf-age-out', LK.fmt(age, 2) + ' s');
    LK.text('d5-tf-state', stale ? '陈旧（超阈值）' : '可用');
    LK.text('d5-tf-act', stale ? '停止执行并报 tf_unavailable' : '继续执行');
    var note = LK.$('d5-tf-note');
    if (note) {
      note.textContent = stale
        ? '阈值 0.5 s 已超过。此时系统仍然算得出一个变换，只是它描述的是 ' + LK.fmt(age, 2) + ' 秒前的世界——这正是“不报错但走错”的来源。正确反应是停止并上报，而不是继续用旧变换。'
        : '在 0.5 s 以内仍可用于控制。注意这只是“够新”，不代表“够准”：标定错误、外参错位同样会让变换失效，但时间戳是健康的。';
    }
  }

  var tfAge = LK.$('d5-tf-age');
  if (tfAge) tfAge.addEventListener('input', function () { renderTf(parseFloat(tfAge.value)); });
  renderTf(tfAge ? parseFloat(tfAge.value) : 0.1);

  /* ---------- Costmap ---------- */
  var cv = LK.$('d5-costmap-canvas');
  var stage = cv ? LK.canvas(cv, 260) : null;

  function cmValues() {
    return {
      door: parseFloat(LK.$('d5-door').value),
      robot: parseFloat(LK.$('d5-robot').value),
      infl: parseFloat(LK.$('d5-infl').value)
    };
  }

  function drawCostmap() {
    if (!stage) return;
    var v = cmValues();
    var P = LK.palette();
    var s = stage;
    var spanM = 3.2;
    var scale = Math.min(s.w / spanM, s.h / 1.6);
    var cx = s.w / 2;
    var cy = s.h / 2;
    var ctx = s.ctx;
    LK.clear(s, null);

    function X(x) { return cx + x * scale; }
    function Y(y) { return cy - y * scale; }

    var half = v.door / 2;
    var wallH = 0.16;
    /* 墙 */
    ctx.save();
    ctx.fillStyle = P.muted;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(X(-1.6), Y(wallH), (-half + 1.6) * scale, wallH * 2 * scale);
    ctx.fillRect(X(half), Y(wallH), (1.6 - half) * scale, wallH * 2 * scale);
    ctx.restore();

    /* 膨胀 */
    ctx.save();
    ctx.fillStyle = P.s2;
    ctx.globalAlpha = 0.22;
    var inflW = Math.min(v.infl, half * 2);
    ctx.fillRect(X(-half), Y(wallH + v.infl), inflW * scale, (wallH + v.infl) * 2 * scale);
    ctx.fillRect(X(half - inflW), Y(wallH + v.infl), inflW * scale, (wallH + v.infl) * 2 * scale);
    ctx.restore();

    /* 有效通道标注 */
    var eff = v.door - 2 * v.infl;
    ctx.save();
    ctx.strokeStyle = eff >= v.robot ? P.s1 : P.bad;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(-eff / 2), Y(-0.42));
    ctx.lineTo(X(-eff / 2), Y(0.42));
    ctx.moveTo(X(eff / 2), Y(-0.42));
    ctx.lineTo(X(eff / 2), Y(0.42));
    ctx.stroke();
    ctx.restore();

    /* 机器人 */
    ctx.save();
    ctx.fillStyle = eff >= v.robot ? P.primary : P.bad;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), v.robot / 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    LK.label(ctx, '门 ' + LK.fmt(v.door, 2) + ' m', X(0), Y(-0.78), P.muted, 11, 'center');
    LK.label(ctx, '有效通道 ' + LK.fmt(eff, 2) + ' m', X(0), Y(0.03), P.fg, 11, 'center');
    LK.label(ctx, '机器人 ' + LK.fmt(v.robot, 2) + ' m', X(0), Y(0.62), P.muted, 11, 'center');
  }

  function updateCostmap() {
    if (!LK.$('d5-door')) return;
    var v = cmValues();
    LK.text('d5-door-out', LK.fmt(v.door, 2));
    LK.text('d5-robot-out', LK.fmt(v.robot, 2));
    LK.text('d5-infl-out', LK.fmt(v.infl, 2));
    var eff = v.door - 2 * v.infl;
    LK.text('d5-eff', LK.fmt(eff, 2) + ' m');
    var verdict = '可通过';
    var note;
    if (v.door < v.robot) {
      verdict = '几何不可通过';
      note = '净宽本身就小于机器人宽度：这属于场景或机器人选型问题，调膨胀半径没有意义。';
    } else if (eff < v.robot) {
      verdict = '膨胀后不可通过';
      note = '几何够宽，但膨胀层把通道吃掉了：有效通道 ' + LK.fmt(eff, 2) + ' m < 机器人 ' + LK.fmt(v.robot, 2) + ' m。要么减小膨胀，要么换更窄的机器人，要么改门。';
    } else {
      verdict = '可通过';
      note = '有效通道 ' + LK.fmt(eff, 2) + ' m ≥ 机器人 ' + LK.fmt(v.robot, 2) + ' m。注意仍有第三类失败可能：代价地图分辨率、起点落在障碍里、规划器超时。';
    }
    LK.text('d5-verdict', verdict);
    LK.text('d5-cm-note', note);
    drawCostmap();
  }

  ['d5-door', 'd5-robot', 'd5-infl'].forEach(function (id) {
    var el = LK.$(id);
    if (el) el.addEventListener('input', updateCostmap);
  });
  if (stage) stage.onresize = drawCostmap;

  /* ---------- Action 状态机 ---------- */
  var ACT = { state: 'idle', event: '—' };
  var STATE_LABEL = {
    idle: '空闲', accepted: 'accepted', executing: 'executing',
    succeeded: 'succeeded', canceled: 'canceled', aborted: 'aborted'
  };

  function renderAction() {
    var chain = LK.$('d5-act-chain');
    if (chain) {
      var order = ['idle', 'accepted', 'executing', ACT.state === 'succeeded' ? 'succeeded' : (ACT.state === 'canceled' ? 'canceled' : (ACT.state === 'aborted' ? 'aborted' : '') )];
      var html = '';
      var terminal = ACT.state === 'succeeded' || ACT.state === 'canceled' || ACT.state === 'aborted';
      var show = ['idle', 'accepted', 'executing'];
      if (terminal) show.push(ACT.state);
      show.forEach(function (st, i) {
        var active = (st === ACT.state) ? 'is-active' : '';
        html += '<span class="node ' + active + '">' + STATE_LABEL[st] + '</span>';
        if (i < show.length - 1) html += '<span class="arrow">→</span>';
      });
      chain.innerHTML = html;
    }
    LK.text('d5-act-state', STATE_LABEL[ACT.state]);
    LK.text('d5-act-event', ACT.event);
    var note = LK.$('d5-act-note');
    if (!note) return;
    var notes = {
      idle: '空闲：还没有目标。此时“取消”没有意义，正确的反应是拒绝而不是忽略。',
      accepted: 'accepted：目标已接受但还没开始。这个状态可以取消，而且应该设一个超时——一直停在 accepted 说明执行资源被占满了。',
      executing: 'executing：正在执行并周期性反馈。上层应监控“剩余距离是否在减少”，只看到消息不叫有进度。',
      succeeded: 'succeeded：终态。仍然建议用 success 谓词再确认一次（比如是否真的到达目标区域），不要只信终态。',
      canceled: 'canceled：终态。要区分“人主动取消”和“系统超时取消”，两者的日志与责任不同。',
      aborted: 'aborted：终态。必须读失败码：是规划无解、控制失败，还是 TF 不可用。只有终态没有失败码，排查就只能靠猜。'
    };
    note.textContent = notes[ACT.state] || '';
  }

  function bindAct(id, fn) {
    var el = LK.$(id);
    if (el) el.addEventListener('click', function () { fn(); renderAction(); });
  }

  bindAct('d5-act-send', function () {
    if (ACT.state === 'executing' || ACT.state === 'accepted') { ACT.event = '忽略：已有目标在执行'; return; }
    ACT.state = 'executing';
    ACT.event = '目标已接受并开始执行';
  });
  bindAct('d5-act-cancel', function () {
    if (ACT.state === 'accepted' || ACT.state === 'executing') {
      ACT.state = 'canceled';
      ACT.event = '收到取消请求 → canceled';
    } else {
      ACT.event = '拒绝：当前状态没有可取消的目标';
    }
  });
  bindAct('d5-act-fail', function () {
    if (ACT.state === 'executing') {
      ACT.state = 'aborted';
      ACT.event = '执行失败 → aborted（失败码：controller_failed）';
    } else {
      ACT.event = '拒绝：没有正在执行的目标';
    }
  });
  bindAct('d5-act-timeout', function () {
    if (ACT.state === 'executing' || ACT.state === 'accepted') {
      ACT.state = 'aborted';
      ACT.event = '超时 → aborted（失败码：timeout）';
    } else {
      ACT.event = '拒绝：没有正在执行的目标';
    }
  });
  bindAct('d5-act-reset', function () {
    ACT.state = 'idle';
    ACT.event = '已重置';
  });
  renderAction();

  /* ---------- 故障注入 ---------- */
  var FAULTS = [
    {
      title: 'TF 时间戳陈旧',
      rows: [
        ['先诊断什么', 'TF 的最新时间戳、发布频率、frame 方向是否写反'],
        ['上层应看到什么', '<code>tf_unavailable</code>，并在继续执行前停止'],
        ['绝不能假设', '“再等等就好了”。陈旧变换仍能算出结果，不会自己报错'],
        ['责任方', '定位 / TF 发布者，不是规划器']
      ]
    },
    {
      title: '门洞宽度不足',
      rows: [
        ['先诊断什么', 'costmap 中门处的有效通道、footprint、膨胀半径'],
        ['上层应看到什么', '<code>blocked</code> + 失败位置 + 来源（几何 / 膨胀）'],
        ['绝不能假设', '“控制器调参能挤过去”'],
        ['责任方', '场景几何或机器人选型']
      ]
    },
    {
      title: '门锁了但地图是空洞的',
      rows: [
        ['先诊断什么', '物体状态模型：门是否有 locked / open 状态，是否有 unlock 动作'],
        ['上层应看到什么', '任务语义缺失（不是导航失败）'],
        ['绝不能假设', '“Nav2 会自动开门”——导航只负责到达，不负责改变世界'],
        ['责任方', '任务层与状态模型']
      ]
    }
  ];

  function renderFault(i) {
    var d = FAULTS[i];
    if (!d) return;
    var panel = LK.$('d5-fault-panel');
    if (panel) {
      panel.innerHTML = '<h4>' + d.title + '</h4><dl>' + d.rows.map(function (r) {
        return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
      }).join('') + '</dl>';
    }
    LK.text('d5-fault-note', '三条故障的共同点：现象都是“停在门口”，但第一行日志应该完全不同。说不出第一行该看什么，就是接口没定义。');
    LK.$$('.tabs [id^="d5-f-"]').forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  ['d5-f-1', 'd5-f-2', 'd5-f-3'].forEach(function (id, i) {
    var el = LK.$(id);
    if (el) el.addEventListener('click', function () { renderFault(i); });
  });
  renderFault(0);

  /* ---------- 接口合同 ---------- */
  function updateContract() {
    var done = 0;
    for (var i = 1; i <= 6; i += 1) {
      var cb = LK.$('d5-ct-' + i);
      if (cb && cb.checked) done += 1;
    }
    LK.text('d5-ct-count', done + ' / 6');
    LK.text('d5-ct-verdict', done === 6 ? '纸面可交接' : '还不能');
  }
  for (var c = 1; c <= 6; c += 1) {
    var box = LK.$('d5-ct-' + c);
    if (box) box.addEventListener('change', updateContract);
  }
  updateContract();

  /* ---------- 六栏与自评 ---------- */
  function updateExam() {
    var done = 0;
    for (var i = 1; i <= 6; i += 1) {
      var cb = LK.$('d5-ex-' + i);
      if (cb && cb.checked) done += 1;
    }
    LK.text('d5-ex-count', done + ' / 6');
    LK.text('d5-ex-level', done === 6 ? '可提交' : (done >= 4 ? '缺关键栏' : (done >= 1 ? '草稿' : '未开始')));
  }
  for (var e = 1; e <= 6; e += 1) {
    var eb = LK.$('d5-ex-' + e);
    if (eb) eb.addEventListener('change', updateExam);
  }
  updateExam();

  function updateScore() {
    var total = 0;
    for (var i = 1; i <= 5; i += 1) {
      var input = LK.$('d5-sc-' + i);
      var out = LK.$('d5-sc-' + i + '-out');
      if (!input) continue;
      var v = parseInt(input.value, 10) || 0;
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d5-sc-total', total + ' / 20');
    var tip = '先补验证';
    if (total >= 17) tip = '可以做接口答辩';
    else if (total >= 13) tip = '补失败码与证据';
    else if (total >= 9) tip = '重画一次拓扑';
    else tip = '回到三种语义';
    LK.text('d5-sc-tip', tip);
  }
  for (var s = 1; s <= 5; s += 1) {
    var rng = LK.$('d5-sc-' + s);
    if (rng) rng.addEventListener('input', updateScore);
  }
  updateScore();

  /* ---------- 启动 ---------- */
  updateCostmap();
})();
