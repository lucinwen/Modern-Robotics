/* Day 06 interactions: UE scene -> trainable task contract. Teaching models only. */
(function () {
  'use strict';
  var LK = window.LK;
  if (!LK) return;
  var redraws = [];
  function p() { return LK.palette(); }

  /* ---------- 01 geometry ---------- */
  var geoS = LK.canvas('d6-geo-canvas', 200);
  function drawGeo() {
    if (!geoS) return;
    var s = geoS, ctx = s.ctx, W = s.w, H = s.h, c = p();
    LK.clear(s);
    var cm = parseFloat(document.getElementById('d6-cm').value);
    var mode = document.getElementById('d6-collision').value;
    var wallX = W * 0.52, thick = 6 + cm / 18;
    ctx.fillStyle = c.s6;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(wallX, 24, thick, H - 48);
    ctx.globalAlpha = 1;
    LK.label(ctx, '墙 · ' + (mode === 'none' ? '仅视觉' : mode === 'mesh' ? '复杂网格' : '盒体碰撞'), wallX + thick + 8, 34, c.muted, 11);
    var y = H * 0.62, r = 12;
    var startX = W * 0.14;
    if (mode === 'none') {
      ctx.save(); ctx.setLineDash([6, 6]);
      ctx.strokeStyle = c.bad; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(W * 0.86, y); ctx.stroke();
      ctx.restore();
      LK.dot(ctx, W * 0.86, y, r, c.bad);
      LK.label(ctx, '穿墙', W * 0.86, y - 22, c.bad, 12, 'center');
    } else {
      LK.arrow(ctx, startX, y, wallX - 6, y, c.primary, 2);
      LK.dot(ctx, wallX - 22, y, r, c.s1);
      LK.label(ctx, '被阻挡', wallX - 22, y - 22, c.s1, 12, 'center');
    }
    LK.label(ctx, '单位 1 m = 100 cm · 当前 ' + LK.fmt(cm / 100, 2) + ' m', 12, H - 12, c.muted, 11);
  }
  redraws.push(drawGeo);
  if (geoS) { geoS.onresize = drawGeo; }
  LK.range('d6-cm', 'd6-cm-out', function (v) { return String(v); }, function () { calcGeo(); drawGeo(); });
  document.getElementById('d6-collision').addEventListener('change', function () { calcGeo(); drawGeo(); });
  function calcGeo() {
    var cm = parseFloat(document.getElementById('d6-cm').value);
    var mode = document.getElementById('d6-collision').value;
    LK.text('d6-meters', LK.fmt(cm / 100, 2) + ' m');
    LK.text('d6-pass', mode === 'none' ? '会穿过' : '不能');
    LK.text('d6-contact', mode === 'none' ? '否' : '是');
  }

  /* ---------- 02 physics ---------- */
  function calcPhysics() {
    var F = +document.getElementById('d6-force').value;
    var m = +document.getElementById('d6-mass').value;
    var mu = +document.getElementById('d6-mu').value / 10;
    var hz = +document.getElementById('d6-hz').value;
    var net = Math.max(0, F - mu * m * 9.81);
    var a = net / m;
    LK.text('d6-acc', LK.fmt(a, 2) + ' m/s²');
    LK.text('d6-dv', LK.fmt(a / hz, 3) + ' m/s');
    LK.setFlag('d6-move', net > 0.001 ? '能' : '推不动', net > 0.001 ? 'ok' : 'bad');
  }
  LK.range('d6-force', 'd6-force-out', String, calcPhysics);
  LK.range('d6-mass', 'd6-mass-out', String, calcPhysics);
  LK.range('d6-mu', 'd6-mu-out', function (v) { return (v / 10).toFixed(2); }, calcPhysics);
  LK.range('d6-hz', 'd6-hz-out', String, calcPhysics);

  /* ---------- 03 articulation ---------- */
  var doorS = LK.canvas('d6-door-canvas', 180);
  function drawDoor() {
    if (!doorS) return;
    var s = doorS, ctx = s.ctx, W = s.w, H = s.h, c = p();
    LK.clear(s);
    var hingeX = 52, hingeY = H - 32;
    var len = Math.min(W - hingeX - 60, 260);
    var joint = document.getElementById('d6-joint').value === 'yes';
    var tau = +document.getElementById('d6-torque').value;
    var I = +document.getElementById('d6-inertia').value;
    var limit = +document.getElementById('d6-limit').value;
    var alpha = joint ? tau / I : 0;
    var angDeg = joint ? LK.clamp(alpha * 12, 0, limit) : 0;
    var ang = -LK.rad(angDeg);
    ctx.strokeStyle = c.border; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hingeX, hingeY); ctx.lineTo(hingeX + len + 20, hingeY); ctx.stroke();
    ctx.save();
    ctx.strokeStyle = c.border; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(hingeX, hingeY, len, -Math.PI / 2, 0); ctx.stroke();
    ctx.restore();
    var ex = hingeX + len * Math.cos(ang), ey = hingeY + len * Math.sin(ang);
    ctx.strokeStyle = joint ? c.s1 : c.muted; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hingeX, hingeY); ctx.lineTo(ex, ey); ctx.stroke();
    LK.dot(ctx, hingeX, hingeY, 5, c.s2);
    LK.label(ctx, joint ? ('开 ' + LK.fmt(angDeg, 0) + '°') : '静态 / 仅动画', ex, ey - 14, joint ? c.s1 : c.bad, 12, 'center');
    LK.label(ctx, '铰链', hingeX - 6, hingeY + 14, c.muted, 11, 'center');
  }
  redraws.push(drawDoor);
  if (doorS) { doorS.onresize = drawDoor; }
  function calcDoor() {
    var joint = document.getElementById('d6-joint').value === 'yes';
    var tau = +document.getElementById('d6-torque').value;
    var I = +document.getElementById('d6-inertia').value;
    LK.text('d6-alpha', (joint ? LK.fmt(tau / I, 2) : '0.00') + ' rad/s²');
    LK.setFlag('d6-door-result', joint ? '门会转' : '完全不动', joint ? 'ok' : 'bad');
    drawDoor();
  }
  LK.range('d6-torque', 'd6-torque-out', String, calcDoor);
  LK.range('d6-inertia', 'd6-inertia-out', String, calcDoor);
  LK.range('d6-limit', 'd6-limit-out', String, calcDoor);
  document.getElementById('d6-joint').addEventListener('change', calcDoor);

  /* ---------- 04 observation ---------- */
  function calcObs() {
    var t = +document.getElementById('d6-true').value / 100;
    var n = +document.getElementById('d6-noise').value / 100;
    var priv = document.getElementById('d6-priv').value === 'yes';
    LK.text('d6-obs-range', LK.fmt(t, 2) + ' ± ' + LK.fmt(n, 2) + ' m');
    LK.setFlag('d6-fair', priv ? '特权（不公平）' : '公平', priv ? 'bad' : 'ok');
  }
  LK.range('d6-true', 'd6-true-out', function (v) { return (v / 100).toFixed(2); }, calcObs);
  LK.range('d6-noise', 'd6-noise-out', function (v) { return (v / 100).toFixed(2); }, calcObs);
  document.getElementById('d6-priv').addEventListener('change', calcObs);

  /* ---------- 05 time ---------- */
  var timeS = LK.canvas('d6-time-canvas', 180);
  function drawTime() {
    if (!timeS) return;
    var s = timeS, ctx = s.ctx, W = s.w, H = s.h, c = p();
    LK.clear(s);
    var ph = +document.getElementById('d6-phz').value;
    var ch = +document.getElementById('d6-chz').value;
    var ct = +document.getElementById('d6-ctrlhz').value;
    function ticks(freq, y, color, label) {
      var span = 2;
      var n = Math.min(80, Math.round(freq * span / 20));
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(30, y + 14); ctx.lineTo(W - 12, y + 14); ctx.stroke();
      for (var i = 0; i <= n; i++) {
        var x = 30 + (W - 42) * (i / n);
        LK.dot(ctx, x, y, 2.4, color);
      }
      LK.label(ctx, label, 8, y, c.muted, 10);
    }
    ticks(ph, H * 0.28, c.s1, '物理');
    ticks(ch, H * 0.56, c.s2, '相机');
    ticks(ct, H * 0.84, c.s3, '控制');
  }
  redraws.push(drawTime);
  if (timeS) { timeS.onresize = drawTime; }
  function calcTime() {
    var ph = +document.getElementById('d6-phz').value;
    var ch = +document.getElementById('d6-chz').value;
    var ct = +document.getElementById('d6-ctrlhz').value;
    var a = ph / ct, b = ph / ch;
    LK.text('d6-phys-per-ctrl', LK.fmt(a, 2));
    LK.text('d6-phys-per-cam', LK.fmt(b, 2));
    var div = Math.abs(a - Math.round(a)) < 1e-6 && Math.abs(b - Math.round(b)) < 1e-6;
    LK.setFlag('d6-divisible', div ? '是' : '否', div ? 'ok' : 'warn');
    drawTime();
  }
  LK.range('d6-phz', 'd6-phz-out', String, calcTime);
  LK.range('d6-chz', 'd6-chz-out', String, calcTime);
  LK.range('d6-ctrlhz', 'd6-ctrlhz-out', String, calcTime);

  /* ---------- 06 action ---------- */
  function calcAction() {
    var mode = document.getElementById('d6-action-mode').value;
    var raw = +document.getElementById('d6-action-val').value / 100;
    var out = document.getElementById('d6-action-out');
    var unit = document.getElementById('d6-action-unit');
    var consumer = document.getElementById('d6-action-consumer');
    var check = document.getElementById('d6-action-check');
    var explain = document.getElementById('d6-action-explain');
    var val = LK.fmt(raw, 2);
    if (out) out.textContent = val;
    var cfg = {
      vel: ['m/s', '底盘控制器', '限幅 + 碰撞', '策略输出 ' + val + ' m/s 的底盘速度目标；控制器负责加速度限制、轮速换算与避障。'],
      joint: ['rad', '关节控制器', '限位 + 速度上限', '策略输出 ' + val + ' rad 的关节位置目标；它是目标，不是观测到的当前角度。'],
      ee: ['m', 'IK / 运动控制器', '可达性 + 碰撞', '策略输出末端位移目标 ' + val + ' m；需要 IK 映射到关节，并检查可达与碰撞。'],
      grip: ['无量纲', '夹爪控制器', '开合限位 + 力矩', '策略输出 ' + val + ' 的夹爪开合命令；还要有最大力矩与堵转保护。']
    }[mode];
    unit.textContent = cfg[0]; consumer.textContent = cfg[1]; check.textContent = cfg[2]; explain.textContent = cfg[3];
  }
  document.getElementById('d6-action-mode').addEventListener('change', calcAction);
  LK.range('d6-action-val', 'd6-action-out', function (v) { return (v / 100).toFixed(2); }, calcAction);

  /* ---------- 07 reward ---------- */
  var rewardData = {
    a: { rows: [['进度奖励', 1, 8], ['持物奖励', 1, 5], ['碰撞惩罚', 1, 0]], total: 13, success: true },
    b: { rows: [['进度奖励', 1, 12], ['持物奖励', 1, 0], ['碰撞惩罚', 1, 0]], total: 12, success: false }
  };
  var rewardCur = 'a';
  function renderReward() {
    var d = rewardData[rewardCur];
    var body = document.getElementById('d6-reward-rows');
    if (body) {
      body.innerHTML = d.rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
      }).join('');
    }
    LK.text('d6-total-reward', String(d.total));
    LK.setFlag('d6-success', d.success ? '真' : '假', d.success ? 'ok' : 'bad');
    var note = document.getElementById('d6-reward-note');
    if (note) note.textContent = d.success
      ? '奖励与 success 一致：真的把杯子送达。'
      : '奖励 12 > 真正送达的 13？这里接近，但 success 为假：空车冲终点是刷分行为，不能被当成任务完成。';
  }
  document.getElementById('d6-reward-a').addEventListener('click', function () {
    rewardCur = 'a'; this.setAttribute('aria-pressed', 'true');
    document.getElementById('d6-reward-b').setAttribute('aria-pressed', 'false'); renderReward();
  });
  document.getElementById('d6-reward-b').addEventListener('click', function () {
    rewardCur = 'b'; this.setAttribute('aria-pressed', 'true');
    document.getElementById('d6-reward-a').setAttribute('aria-pressed', 'false'); renderReward();
  });

  /* ---------- 08 reset ---------- */
  var resetIds = ['d6-rs-robot', 'd6-rs-vel', 'd6-rs-joint', 'd6-rs-door', 'd6-rs-cup', 'd6-rs-rand'];
  function calcReset() {
    var done = resetIds.filter(function (id) { return document.getElementById(id).checked; }).length;
    LK.text('d6-reset-status', done + ' / ' + resetIds.length);
    var note = document.getElementById('d6-reset-note');
    if (note) note.textContent = done === resetIds.length
      ? 'Reset 合同完整：关键动态状态与复现信息都被恢复/记录。'
      : 'Reset 不完整：下一个 episode 会继承上一局残留的隐藏状态，结果不可复现。';
  }
  resetIds.forEach(function (id) { document.getElementById(id).addEventListener('change', calcReset); });

  /* ---------- 09 seed ---------- */
  function calcSeed() {
    var n = +document.getElementById('d6-trainN').value;
    var leak = document.getElementById('d6-leak').value === 'yes';
    LK.text('d6-train-eff', String(n));
    LK.setFlag('d6-gen', leak ? '不可信' : '可信', leak ? 'bad' : 'ok');
    var note = document.getElementById('d6-seed-note');
    if (note) note.textContent = leak
      ? '测试 seed 与训练重叠：高成功率可能只是记住了这些场景，不是泛化。'
      : '训练/测试 seed 独立：至少排除了“直接背题”这一类泄漏。';
  }
  LK.range('d6-trainN', 'd6-trainN-out', String, calcSeed);
  document.getElementById('d6-leak').addEventListener('change', calcSeed);

  /* ---------- 11 episode ---------- */
  var epS = LK.canvas('d6-episode-canvas', 200);
  var ep = { step: 0, dist: 5, holding: false, term: false };
  function drawEpisode() {
    if (!epS) return;
    var s = epS, ctx = s.ctx, W = s.w, H = s.h, c = p();
    LK.clear(s);
    var floorY = H - 34, leftX = 40, rightX = W - 46;
    ctx.strokeStyle = c.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, floorY); ctx.lineTo(W - 20, floorY); ctx.stroke();
    var t = 1 - ep.dist / 5;
    var rx = leftX + (rightX - leftX) * t;
    LK.dot(ctx, rightX + 6, floorY - 8, 7, c.s2);
    LK.label(ctx, '杯子', rightX + 6, floorY - 24, c.s2, 11, 'center');
    var bx = ep.holding ? rx + 12 : rx;
    LK.dot(ctx, rx, floorY - 12, 11, c.s1);
    if (ep.holding) LK.dot(ctx, rx + 14, floorY - 12, 5, c.s2);
    LK.label(ctx, ep.term ? '已终止' : '机器人', rx, floorY - 30, ep.term ? c.s1 : c.muted, 11, 'center');
    LK.label(ctx, '剩余 ' + LK.fmt(ep.dist, 2) + ' m', 12, 18, c.muted, 11);
    if (ep.holding) LK.label(ctx, '持杯', rx + 14, floorY - 30, c.s2, 11, 'center');
  }
  redraws.push(drawEpisode);
  if (epS) { epS.onresize = drawEpisode; }
  function syncEpisode() {
    LK.text('d6-step-no', String(ep.step));
    LK.text('d6-dist', LK.fmt(ep.dist, 2) + ' m');
    LK.text('d6-holding', ep.holding ? '是' : '否');
    LK.setFlag('d6-term', ep.term ? '成功' : '否', ep.term ? 'ok' : '');
    var phase = ep.step % 6;
    LK.$$('#d6-chain .node').forEach(function (n) {
      n.classList.toggle('is-active', +n.dataset.step === phase);
    });
    drawEpisode();
  }
  document.getElementById('d6-step-btn').addEventListener('click', function () {
    if (ep.term) return;
    ep.step += 1;
    ep.dist = Math.max(0, 5 - ep.step);
    if (ep.step >= 4) ep.holding = true;
    if (ep.dist === 0 && ep.holding) ep.term = true;
    syncEpisode();
  });
  document.getElementById('d6-reset-btn').addEventListener('click', function () {
    ep = { step: 0, dist: 5, holding: false, term: false };
    syncEpisode();
  });

  /* ---------- roles: three owners ---------- */
  var ROLES = {
    ue: {
      title: 'UE / PCG —— 资产层',
      lead: '负责“看起来是什么”，不负责“撞起来是什么”。',
      items: [
        '生产：视觉网格、材质、灯光、关卡布局、门的播放动画',
        '输出：厘米制尺寸、世界原点、资产命名与拆分',
        '不负责：碰撞体、质量、关节驱动、观测公平性'
      ]
    },
    sim: {
      title: 'Isaac Sim —— 物理世界',
      lead: '负责“在物理上会发生什么”，不负责“任务算什么成功”。',
      items: [
        '生产：刚体、碰撞、关节、接触求解、传感器采样',
        '消费：USD 资产 + 质量 / 摩擦 / 关节限位 / drive',
        '不负责：reward 设计、训练循环、评测口径'
      ]
    },
    lab: {
      title: 'Isaac Lab —— 任务与训练接口',
      lead: '负责“任务怎么被定义、被观测、被评分”，不负责资产建模。',
      items: [
        '生产：observation / action / reward / termination / reset 接口',
        '消费：物理世界的状态与传感器采样',
        '不负责：网格精度、求解器步长、碰撞体正确性'
      ]
    }
  };
  function renderRole(key) {
    var box = document.getElementById('d6-role-panel');
    if (!box) return;
    var d = ROLES[key] || ROLES.ue;
    var html = '<div class="role-card is-active"><h4>' + d.title + '</h4><p>' + d.lead + '</p><ul>';
    d.items.forEach(function (t) { html += '<li>' + t + '</li>'; });
    box.innerHTML = html + '</ul></div>';
  }
  ['ue', 'sim', 'lab'].forEach(function (k) {
    var btn = document.getElementById('d6-role-' + k);
    if (!btn) return;
    btn.addEventListener('click', function () {
      ['ue', 'sim', 'lab'].forEach(function (o) {
        var b = document.getElementById('d6-role-' + o);
        if (b) b.setAttribute('aria-pressed', o === k ? 'true' : 'false');
      });
      renderRole(k);
    });
  });

  /* ---------- migration audit: 19 items ---------- */
  var AUDIT = [
    ['世界尺度', '建模 / 导出', '米（1 m = 100 cm）', '物理、策略', '尺度整体错 100 倍'],
    ['世界原点与轴方向', '关卡设计', '右手系、Z 向上、单位米', '导航、TF', '位置与朝向全错'],
    ['资产姿态约定', '美术 / 导出', '旋转顺序、万向节顺序', '抓取、放置', '物体姿态偏移'],
    ['碰撞体 collision', '美术 / 物理', '凸包或盒体，单位米', '物理求解器', '穿墙或卡死在几何里'],
    ['门洞净宽与净空', '关卡设计', '米', '导航、规划', '门看着够宽却过不去'],
    ['机器人 footprint', '机械 / 控制', '半径或长宽，单位米', '导航、costmap', '擦墙或误判可过'],
    ['质量 mass', '机械', 'kg', '动力学求解', '推力响应完全失真'],
    ['惯量 inertia', '机械', 'kg·m²', '动力学求解', '旋转抖动或过度迟钝'],
    ['摩擦与恢复系数', '物理配置', '无量纲', '接触求解', '打滑、异常弹跳'],
    ['关节类型 joint type', '机械', 'revolute / prismatic', '物理、action', '门退化成贴图，推不动'],
    ['关节轴与限位', '机械', '轴向量、弧度', '物理、action', '门往错误方向开或超程'],
    ['关节驱动 drive', '机械 / 控制', '刚度、阻尼、力矩上限', '物理', '门自由摆动或根本推不动'],
    ['传感器外参', '感知 / 标定', '相对位姿，米 / 弧度', '观测、标定流程', '观测与场景整体错位'],
    ['传感器时序', '感知', 'Hz + 时间戳（秒）', '策略、同步模块', '观测陈旧或错帧'],
    ['噪声与遮挡模型', '感知', '标准差、遮挡概率', '策略鲁棒性', '仿真过于乐观，实机崩'],
    ['action 单位与频率', '控制', 'm/s、rad/s、Hz', '策略、底层控制', '动作被放大或高频抖动'],
    ['reset 恢复范围', '任务定义', '列出需恢复的全部动态状态', '评测', '上一局状态污染下一局'],
    ['success / termination / timeout', '任务定义', '谓词 + 超时秒数', '评测', '刷分或 episode 永不结束'],
    ['seed 与场景版本', '任务定义', '整数 seed、资产版本号', '实验复现', '结果不可比较、无法复现']
  ];
  var AUDIT_KEY = 'mr-day6-audit-v1';
  function auditState() {
    try { return JSON.parse(window.localStorage.getItem(AUDIT_KEY) || '[]'); } catch (e) { return []; }
  }
  function renderAudit() {
    var body = document.getElementById('d6-audit-rows');
    if (!body) return;
    var state = auditState();
    var done = 0;
    var html = '';
    AUDIT.forEach(function (row, i) {
      var on = state.indexOf(i) >= 0;
      if (on) done += 1;
      html += '<tr class="' + (on ? 'is-done' : '') + '"><td><input type="checkbox" data-audit="' + i + '"' +
        (on ? ' checked' : '') + ' aria-label="已核对：' + row[0] + '"></td><td>' + row[0] + '</td><td>' +
        row[1] + '</td><td>' + row[2] + '</td><td>' + row[3] + '</td><td>' + row[4] + '</td></tr>';
    });
    body.innerHTML = html;
    var c = document.getElementById('d6-audit-count'), l = document.getElementById('d6-audit-left');
    if (c) c.textContent = done + ' / ' + AUDIT.length;
    if (l) l.textContent = String(AUDIT.length - done);
    var n = document.getElementById('d6-audit-note');
    if (n) {
      n.textContent = done === AUDIT.length
        ? '19 项都勾了。提醒：勾选是“我核对过”，仍然不等于“已经跑通仿真”。'
        : '还剩 ' + (AUDIT.length - done) + ' 项没核对。勾选只代表“我核对过”，不代表“已经跑通仿真”。';
    }
    Array.prototype.forEach.call(body.querySelectorAll('input[data-audit]'), function (box) {
      box.addEventListener('change', function () {
        var idx = parseInt(box.getAttribute('data-audit'), 10);
        var st = auditState();
        var at = st.indexOf(idx);
        if (box.checked && at < 0) st.push(idx);
        if (!box.checked && at >= 0) st.splice(at, 1);
        try { window.localStorage.setItem(AUDIT_KEY, JSON.stringify(st)); } catch (e) {}
        renderAudit();
      });
    });
  }
  var auditReset = document.getElementById('d6-audit-reset');
  if (auditReset) auditReset.addEventListener('click', function () {
    try { window.localStorage.removeItem(AUDIT_KEY); } catch (e) {}
    renderAudit();
  });

  /* ---------- rule checker vs physical rollout ---------- */
  var CHK = [
    ['物体都在房间内、彼此不重叠', 1, '仍需满足，但只是起点'],
    ['门在墙上、净宽大于 footprint', 1, '可过 ≠ 真能过去'],
    ['出生点没有家具占位', 1, '还需检查是否被卡住'],
    ['推门时接触与摩擦是否成立', 0, '只有接触求解能判断'],
    ['加噪后观测是否仍可用', 0, '只有采样 rollout 能判断'],
    ['reset 后状态是否真的一致', 0, 'checker 没有状态演化']
  ];
  function renderChecker() {
    var body = document.getElementById('d6-chk-rows');
    if (!body) return;
    var mode = document.getElementById('d6-chk-mode');
    var seed = document.getElementById('d6-chk-seed');
    var m = mode ? mode.value : 'rule';
    var html = '';
    var covered = 0;
    CHK.forEach(function (row) {
      var ok = m === 'rollout' ? true : row[1] === 1;
      if (ok) covered += 1;
      html += '<tr class="' + (ok ? '' : 'is-fail') + '"><td>' + row[0] + '</td><td>' +
        (row[1] === 1 ? '能' : '不能') + '</td><td>' + (ok ? row[2] : '未覆盖 —— ' + row[2]) + '</td></tr>';
    });
    body.innerHTML = html;
    var c = document.getElementById('d6-chk-covered');
    if (c) c.textContent = covered + ' / ' + CHK.length;
    var l = document.getElementById('d6-chk-level');
    if (l) l.textContent = m === 'rollout' ? '任务可执行（仍需实机）' : '布局合法';
    var n = document.getElementById('d6-chk-note');
    if (n) {
      n.textContent = m === 'rollout'
        ? '加入物理 rollout 后 6 项都能被观察到；但 rollout 仍然只是仿真证据，不等于实机成功。当前场景 seed = ' + (seed ? seed.value : '17') + '。'
        : '只有规则 checker 时，接触、噪声、reset 一致性这 3 项永远无法被判定。换一个 seed 也不会变——这不是样本量问题，是能力问题。';
    }
  }
  ['d6-chk-mode', 'd6-chk-seed'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', renderChecker);
  });

  /* ---------- five-dimension self score ---------- */
  var SCORE_KEY = 'mr-day6-score-v1';
  function renderScore() {
    var total = 0, vals = [];
    for (var i = 1; i <= 5; i += 1) {
      var el = document.getElementById('d6-sc-' + i);
      var out = document.getElementById('d6-sc-' + i + '-out');
      if (!el) return;
      var v = parseInt(el.value, 10) || 0;
      vals.push(v);
      total += v;
      if (out) out.textContent = String(v);
    }
    var t = document.getElementById('d6-sc-total');
    if (t) t.textContent = total + ' / 20';
    var lv = document.getElementById('d6-sc-level');
    var note = document.getElementById('d6-sc-note');
    var level = '只读了文档';
    var msg = '验证维度 ≤ 2：今天只完成了文档阅读与合同设计，不能写成“已运行实验”。';
    if (vals[3] === 3) {
      level = '合同设计（未跑仿真）';
      msg = '你已能独立设计契约但还没跑过实例。写进简历时用“设计了……接口契约”，不要用“实现了……训练环境”。';
    } else if (vals[3] >= 4) {
      level = '有可复现实验（需附日志）';
      msg = '若这一档为真，必须能拿出场景版本、seed、观测、动作与终止日志；拿不出就退回上一档。';
    }
    if (lv) lv.textContent = level;
    if (note) note.textContent = msg + '（五维：概念 / 因果 / 工程接口 / 验证 / 经历真实性，各 0–4 分）';
    try { window.localStorage.setItem(SCORE_KEY, JSON.stringify(vals)); } catch (e) {}
  }
  for (var si = 1; si <= 5; si += 1) {
    var sel = document.getElementById('d6-sc-' + si);
    if (sel) sel.addEventListener('input', renderScore);
  }
  try {
    var savedScore = JSON.parse(window.localStorage.getItem(SCORE_KEY) || 'null');
    if (savedScore && savedScore.length === 5) {
      savedScore.forEach(function (v, i) {
        var el = document.getElementById('d6-sc-' + (i + 1));
        if (el) el.value = String(v);
      });
    }
  } catch (e) {}

  /* ---------- boot ---------- */
  function boot() {
    calcGeo(); calcPhysics(); calcDoor(); calcObs(); calcTime();
    calcAction(); renderReward(); calcReset(); calcSeed(); syncEpisode();
    renderRole('ue'); renderAudit(); renderChecker(); renderScore();
    redraws.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /* Redraw on theme change (site.js flips data-theme). */
  if (window.MutationObserver) {
    new MutationObserver(function () { redraws.forEach(function (fn) { try { fn(); } catch (e) {} }); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
