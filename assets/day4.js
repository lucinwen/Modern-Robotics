/* Day 4 · 平面二连杆 FK / IK / Jacobian 交互。纯离线，无外部依赖。 */
(function () {
  'use strict';
  var LK = window.LK;
  if (!LK) return;

  var L1 = 1;
  var L2 = 1;
  var DEG = 180 / Math.PI;
  var RAD = Math.PI / 180;

  var state = { q1: 0, q2: 90, tx: 1, ty: 1, limits: false };

  /* ---------- 数学 ---------- */
  function fk(q1, q2) {
    var x1 = L1 * Math.cos(q1);
    var y1 = L1 * Math.sin(q1);
    return {
      x1: x1, y1: y1,
      x: x1 + L2 * Math.cos(q1 + q2),
      y: y1 + L2 * Math.sin(q1 + q2)
    };
  }

  function jac(q1, q2) {
    var s1 = Math.sin(q1);
    var c1 = Math.cos(q1);
    var s12 = Math.sin(q1 + q2);
    var c12 = Math.cos(q1 + q2);
    return [
      [-L1 * s1 - L2 * s12, -L2 * s12],
      [L1 * c1 + L2 * c12, L2 * c12]
    ];
  }

  function det2(J) { return J[0][0] * J[1][1] - J[0][1] * J[1][0]; }

  function ik(x, y) {
    var r2 = x * x + y * y;
    var r = Math.sqrt(r2);
    if (r < 1e-9) return { ok: false, r: r, reason: 'zero' };
    var c = (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    if (c > 1 + 1e-9 || c < -1 - 1e-9) return { ok: false, r: r, c: c, reason: 'range' };
    var cq = Math.max(-1, Math.min(1, c));
    var q2a = Math.acos(cq);
    var base = Math.atan2(y, x);
    var k = Math.atan2(L2 * Math.sin(q2a), L1 + L2 * Math.cos(q2a));
    return {
      ok: true, r: r, c: cq,
      solutions: [
        { q1: base - k, q2: q2a },
        { q1: base + k, q2: -q2a }
      ]
    };
  }

  function legal(q1, q2) {
    if (!state.limits) return true;
    var lim = 45 + 1e-6;
    return Math.abs(q1 * DEG) <= lim && Math.abs(q2 * DEG) <= lim;
  }

  /* ---------- 画布工具 ---------- */
  var P = LK.palette();

  function frame(s, wm) {
    var s2 = Math.min(s.w / 5.6, s.h / 3.4);
    return {
      s: s2,
      ox: s.w * 0.5,
      oy: s.h * 0.62,
      px: function (x) { return this.ox + x * this.s; },
      py: function (y) { return this.oy - y * this.s; }
    };
  }

  function grid(s, F, span) {
    var ctx = s.ctx;
    ctx.save();
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;
    for (var g = -span; g <= span; g += 0.5) {
      ctx.beginPath();
      ctx.moveTo(F.px(g), F.py(-span));
      ctx.lineTo(F.px(g), F.py(span));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(F.px(-span), F.py(g));
      ctx.lineTo(F.px(span), F.py(g));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(F.px(-span), F.py(0));
    ctx.lineTo(F.px(span), F.py(0));
    ctx.moveTo(F.px(0), F.py(-span));
    ctx.lineTo(F.px(0), F.py(span));
    ctx.stroke();
    LK.label(ctx, 'x', F.px(span) - 10, F.py(0) - 10, P.muted, 11);
    LK.label(ctx, 'y', F.px(0) + 8, F.py(span) + 10, P.muted, 11);
    ctx.restore();
  }

  function arm(s, F, q1, q2, color, width, ghost) {
    var p = fk(q1, q2);
    var ctx = s.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 4;
    ctx.lineCap = 'round';
    if (ghost) { ctx.globalAlpha = 0.45; ctx.setLineDash([5, 4]); }
    ctx.beginPath();
    ctx.moveTo(F.px(0), F.py(0));
    ctx.lineTo(F.px(p.x1), F.py(p.y1));
    ctx.lineTo(F.px(p.x), F.py(p.y));
    ctx.stroke();
    ctx.restore();
    if (!ghost) {
      LK.dot(ctx, F.px(p.x1), F.py(p.y1), 4.5, color);
      LK.dot(ctx, F.px(p.x), F.py(p.y), 5.5, color);
    }
    return p;
  }

  function ellipse(s, F, q1, q2) {
    var J = jac(q1, q2);
    var p = fk(q1, q2);
    var ctx = s.ctx;
    ctx.save();
    ctx.strokeStyle = P.s3;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (var i = 0; i <= 48; i += 1) {
      var t = i / 48 * Math.PI * 2;
      var dx = J[0][0] * Math.cos(t) * 0.45 + J[0][1] * Math.sin(t) * 0.45;
      var dy = J[1][0] * Math.cos(t) * 0.45 + J[1][1] * Math.sin(t) * 0.45;
      var px = F.px(p.x + dx);
      var py = F.py(p.y + dy);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- FK 画布 ---------- */
  var cv = LK.$('d4-canvas');
  var stage = cv ? LK.canvas(cv, 300) : null;

  function fmt(v, d) { return LK.fmt(v, d === undefined ? 3 : d); }

  function drawFk() {
    if (!stage) return;
    var q1 = state.q1 * RAD;
    var q2 = state.q2 * RAD;
    LK.clear(stage, null);
    var F = frame(stage, 2);
    grid(stage, F, 2);
    arm(stage, F, q1, q2, P.primary, 4, false);
    ellipse(stage, F, q1, q2);
    var p = fk(q1, q2);
    LK.label(stage.ctx, '(' + fmt(p.x, 2) + ', ' + fmt(p.y, 2) + ')', F.px(p.x) + 8, F.py(p.y) - 12, P.fg, 11);
    LK.label(stage.ctx, '基座', F.px(0) + 6, F.py(0) + 12, P.muted, 10);
  }

  function updateFk() {
    var q1d = parseFloat(LK.$('d4-q1').value);
    var q2d = parseFloat(LK.$('d4-q2').value);
    state.q1 = q1d;
    state.q2 = q2d;
    LK.text('d4-q1-out', q1d + '°');
    LK.text('d4-q2-out', q2d + '°');
    var p = fk(q1d * RAD, q2d * RAD);
    LK.text('d4-x', fmt(p.x));
    LK.text('d4-y', fmt(p.y));
    var d = det2(jac(q1d * RAD, q2d * RAD));
    LK.text('d4-det', fmt(d, 3));
    var note = LK.$('d4-fk-note');
    if (note) {
      var near = Math.abs(d) < 0.05;
      note.textContent = near
        ? '当前姿态接近奇异：|J| ≈ 0，末端在这个方向上几乎动不了。注意速度椭圆被压成了一条线。'
        : '蓝色椭圆是“关节速度取单位圆”时的末端速度范围。它越扁，说明越接近奇异位形。';
    }
    drawFk();
    drawIk();
    renderLimits();
    renderJacTable();
  }

  if (cv) {
    ['d4-q1', 'd4-q2'].forEach(function (id) {
      var el = LK.$(id);
      if (el) el.addEventListener('input', updateFk);
    });
    stage.onresize = function () { drawFk(); drawIk(); };
  }

  /* ---------- 可达域 / IK 画布 ---------- */
  var cv2 = LK.$('d4-ik-canvas');
  var stage2 = cv2 ? LK.canvas(cv2, 340) : null;

  function drawIk() {
    if (!stage2) return;
    var ctx = stage2.ctx;
    LK.clear(stage2, null);
    var F = frame(stage2, 4);
    /* 可达环 */
    ctx.save();
    ctx.beginPath();
    ctx.arc(F.px(0), F.py(0), 2 * F.s, 0, Math.PI * 2);
    ctx.arc(F.px(0), F.py(0), Math.abs(L1 - L2) * F.s, 0, Math.PI * 2, true);
    ctx.fillStyle = P.accent;
    ctx.globalAlpha = 0.55;
    ctx.fill('evenodd');
    ctx.restore();
    grid(stage2, F, 2.5);

    /* 限位扇区 */
    if (state.limits) {
      ctx.save();
      ctx.fillStyle = P.s2;
      ctx.globalAlpha = 0.12;
      for (var a = -45; a < 45; a += 1) {
        ctx.beginPath();
        ctx.moveTo(F.px(0), F.py(0));
        ctx.arc(F.px(0), F.py(0), 0.55 * F.s, -(a + 1) * RAD, -a * RAD);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    var res = ik(state.tx, state.ty);
    /* 目标点 */
    var txp = F.px(state.tx);
    var typ = F.py(state.ty);
    ctx.save();
    ctx.strokeStyle = res.ok ? P.s1 : P.bad;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(txp - 7, typ); ctx.lineTo(txp + 7, typ);
    ctx.moveTo(txp, typ - 7); ctx.lineTo(txp, typ + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(txp, typ, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (res.ok) {
      res.solutions.forEach(function (sol, i) {
        arm(stage2, F, sol.q1, sol.q2, i === 0 ? P.s1 : P.s3, 3, false);
      });
    } else {
      ctx.save();
      ctx.strokeStyle = P.bad;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(F.px(0), F.py(0));
      ctx.lineTo(txp, typ);
      ctx.stroke();
      ctx.restore();
    }

    LK.text('d4-r', fmt(res.r, 3));
    LK.text('d4-reach', res.ok ? '是' : '否');
    LK.text('d4-branches', res.ok ? String(res.solutions.length) : '0');
    var note = LK.$('d4-ws-note');
    if (note) {
      if (!res.ok) {
        note.textContent = res.reason === 'zero'
          ? '目标与基座重合，两段完全折回：这是退化位置，方向不唯一，|J| 也为 0。'
          : 'r = ' + fmt(res.r, 3) + ' m 超出 l₁ + l₂ = 2 m，cos q₂ = ' + fmt(res.c, 2) + ' 落在 [−1, 1] 之外。正确结论是“无解”，不是“用最近点凑一个”。';
      } else {
        var a = res.solutions[0];
        var b = res.solutions[1];
        note.textContent = '两组解：肘上一组 (q₁, q₂) = ('
          + fmt(a.q1 * DEG, 1) + '°, ' + fmt(a.q2 * DEG, 1) + '°)，肘下另一组 ('
          + fmt(b.q1 * DEG, 1) + '°, ' + fmt(b.q2 * DEG, 1) + '°)。两组末端相同，肘部扫过的空间不同。';
      }
    }
  }

  function updateTarget() {
    state.tx = parseFloat(LK.$('d4-tx').value);
    state.ty = parseFloat(LK.$('d4-ty').value);
    LK.text('d4-tx-out', fmt(state.tx, 2));
    LK.text('d4-ty-out', fmt(state.ty, 2));
    drawIk();
    renderLimits();
  }

  ['d4-tx', 'd4-ty'].forEach(function (id) {
    var el = LK.$(id);
    if (el) el.addEventListener('input', updateTarget);
  });

  /* ---------- 关节限位 ---------- */
  function renderLimits() {
    var rows = LK.$('d4-lim-rows');
    if (!rows) return;
    var res = ik(state.tx, state.ty);
    if (!res.ok) {
      rows.innerHTML = '<tr class="is-fail"><td colspan="4">当前目标无逆解（r = ' + fmt(res.r, 2) + ' m 超出可达域），先挪动目标点。</td></tr>';
      LK.text('d4-lim-ok', '0 / 0');
      LK.text('d4-lim-verdict', '无解');
      LK.text('d4-lim-note', '限位问题只在“有解”的前提下才讨论。先解决可达性，再谈合不合法。');
      return;
    }
    var okCount = 0;
    rows.innerHTML = res.solutions.map(function (s, i) {
      var ok = legal(s.q1, s.q2);
      if (ok) okCount += 1;
      return '<tr class="' + (ok ? '' : 'is-fail') + '"><td>' + (i === 0 ? '① 肘上' : '② 肘下') + '</td><td class="tabular-nums">'
        + fmt(s.q1 * DEG, 1) + '°</td><td class="tabular-nums">' + fmt(s.q2 * DEG, 1) + '°</td><td>'
        + (ok ? '✓ 在限位内' : '✗ 超出 ±45°') + '</td></tr>';
    }).join('');
    LK.text('d4-lim-ok', okCount + ' / ' + res.solutions.length);
    LK.text('d4-lim-verdict', okCount > 0 ? '可执行' : '可达但不可执行');
    LK.text('d4-lim-note', okCount > 0
      ? '至少有一组解同时满足“可达”与“限位”。但这仍然不等于“无碰撞”，第三关还没过。'
      : '目标在可达域里，但两组解都超出 ±45°。这就是“几何可达、关节不允许”——不要说成“无解”，也不要说成“不可达”。');
    drawIk();
  }

  function setLimit(on) {
    state.limits = on;
    var a = LK.$('d4-lim-off');
    var b = LK.$('d4-lim-on');
    if (a) a.classList.toggle('is-on', !on);
    if (b) b.classList.toggle('is-on', on);
    renderLimits();
    drawIk();
  }

  if (LK.$('d4-lim-off')) LK.$('d4-lim-off').addEventListener('click', function () { setLimit(false); });
  if (LK.$('d4-lim-on')) LK.$('d4-lim-on').addEventListener('click', function () { setLimit(true); });

  /* ---------- Jacobian 表 ---------- */
  function renderJacTable() {
    var rows = LK.$('d4-jac-rows');
    var mat = LK.$('d4-jmat');
    if (!rows || !mat) return;
    var poses = [
      ['当前姿态（q₁ = ' + fmt(state.q1, 0) + '°, q₂ = ' + fmt(state.q2, 0) + '°）', state.q1 * RAD, state.q2 * RAD],
      ['q₂ = 0°（全伸展）', 0, 0],
      ['q₂ = 180°（全折回）', 0, Math.PI]
    ];
    rows.innerHTML = poses.map(function (p) {
      var J = jac(p[1], p[2]);
      var d = det2(J);
      var tag = Math.abs(d) < 0.05 ? '奇异：某方向无法生成运动' : '非奇异：两个方向都能动';
      return '<tr><td>' + p[0] + '</td><td class="tabular-nums">[' + fmt(J[0][0], 2) + ', ' + fmt(J[0][1], 2)
        + '; ' + fmt(J[1][0], 2) + ', ' + fmt(J[1][1], 2) + ']</td><td class="tabular-nums">'
        + fmt(d, 3) + '</td><td>' + tag + '</td></tr>';
    }).join('');

    var J = jac(state.q1 * RAD, state.q2 * RAD);
    mat.innerHTML = '<tr><td>' + fmt(J[0][0], 2) + '</td><td>' + fmt(J[0][1], 2) + '</td></tr>'
      + '<tr><td>' + fmt(J[1][0], 2) + '</td><td>' + fmt(J[1][1], 2) + '</td></tr>';
  }

  /* ---------- 预设姿态 ---------- */
  var presets = {
    'd4-preset-a': [0, 0],
    'd4-preset-b': [0, 90],
    'd4-preset-c': [0, 180],
    'd4-sing-a': [0, 0],
    'd4-sing-b': [0, 90],
    'd4-sing-c': [0, 180]
  };
  Object.keys(presets).forEach(function (id) {
    var el = LK.$(id);
    if (!el) return;
    el.addEventListener('click', function () {
      var q1 = LK.$('d4-q1');
      var q2 = LK.$('d4-q2');
      if (q1) q1.value = String(presets[id][0]);
      if (q2) q2.value = String(presets[id][1]);
      LK.$$('.chip[id^="d4-sing-"]').forEach(function (b) { b.classList.toggle('is-on', b.id === id); });
      updateFk();
    });
  });

  /* ---------- 四条失败链 ---------- */
  var FAILS = [
    {
      name: '① 逆解无解',
      symptom: '目标点在可达域之外，比如 (3, 0)：r = 3 m 大于 l₁ + l₂ = 2 m。',
      layer: '任务层 / 场景层',
      fix: '换目标点、换机器人站位，或承认这个任务当前身体做不到。不要用“最近可达点”冒充解。',
      evidence: 'r 与 l₁ + l₂ 的数值对比；IK 返回的“无解”状态。'
    },
    {
      name: '② 有解但超关节限位',
      symptom: '目标 (1, 1) 两组解 (0°, 90°) 与 (90°, −90°)，关节只允许 ±45°。',
      layer: '任务层（先换分支，再换站位）',
      fix: '尝试另一组解；两组都超限，就移动基座或换更大工作空间的臂。',
      evidence: '每组解的角度与限位范围的逐项比较。'
    },
    {
      name: '③ IK 有解但路径碰撞',
      symptom: '角度合法，但从当前姿态转到该解的过程中肘部扫过桌沿。',
      layer: '路径规划层',
      fix: '换中间姿态、换接近方向、换抓取点。“再解一次 IK”解决不了这个问题。',
      evidence: '路径上的碰撞检测结果与最小间距。'
    },
    {
      name: '④ 轨迹可行但控制跟不上',
      symptom: '几何上完全可行，实际跟踪误差大、抖动、末端画圈。',
      layer: '控制层',
      fix: '降速、调增益、平滑轨迹；也可能需要加力矩前馈。',
      evidence: '跟踪误差曲线、关节速度与力矩是否饱和。'
    }
  ];

  function renderFail(idx) {
    var d = FAILS[idx];
    if (!d) return;
    var panel = LK.$('d4-fail-panel');
    if (panel) {
      panel.innerHTML = '<h4>' + d.name + '</h4><dl>'
        + '<div><dt>现象</dt><dd>' + d.symptom + '</dd></div>'
        + '<div><dt>归因在哪一层</dt><dd>' + d.layer + '</dd></div>'
        + '<div><dt>该改什么</dt><dd>' + d.fix + '</dd></div>'
        + '<div><dt>证据</dt><dd>' + d.evidence + '</dd></div></dl>';
    }
    LK.text('d4-fail-note', '这四种失败的共同点是“看起来都叫够不到”，但修复动作完全不同。说清层次，比给出结论更重要。');
    LK.$$('.tabs [id^="d4-fail-"]').forEach(function (b, i) {
      b.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
    });
  }

  ['d4-fail-1', 'd4-fail-2', 'd4-fail-3', 'd4-fail-4'].forEach(function (id, i) {
    var el = LK.$(id);
    if (el) el.addEventListener('click', function () { renderFail(i); });
  });
  renderFail(0);

  /* ---------- 数值校核表 ---------- */
  function renderVerify() {
    var rows = LK.$('d4-ver-rows');
    if (!rows) return;
    var targets = [[1, 1], [3, 0]];
    rows.innerHTML = targets.map(function (t) {
      var res = ik(t[0], t[1]);
      if (!res.ok) {
        return '<tr class="is-fail"><td>(' + t[0] + ', ' + t[1] + ')</td><td class="tabular-nums">' + fmt(res.r, 3)
          + '</td><td class="tabular-nums">' + fmt(res.c, 2) + '</td><td>—</td><td>—</td><td>无解：超出可达域</td></tr>';
      }
      var a = res.solutions[0];
      return '<tr><td>(' + t[0] + ', ' + t[1] + ')</td><td class="tabular-nums">' + fmt(res.r, 3)
        + '</td><td class="tabular-nums">' + fmt(res.c, 3) + '</td><td class="tabular-nums">'
        + fmt(a.q2 * DEG, 1) + '° / ' + fmt(res.solutions[1].q2 * DEG, 1) + '°</td><td class="tabular-nums">'
        + fmt(a.q1 * DEG, 1) + '° / ' + fmt(res.solutions[1].q1 * DEG, 1) + '°</td><td>有解（两组）</td></tr>';
    }).join('');
  }

  /* ---------- 六栏与自评 ---------- */
  function updateExam() {
    var done = 0;
    for (var i = 1; i <= 6; i += 1) {
      var cb = LK.$('d4-ex-' + i);
      if (cb && cb.checked) done += 1;
    }
    LK.text('d4-ex-count', done + ' / 6');
    LK.text('d4-ex-level', done === 6 ? '可提交' : (done >= 4 ? '缺关键栏' : (done >= 1 ? '草稿' : '未开始')));
  }
  for (var e = 1; e <= 6; e += 1) {
    var box = LK.$('d4-ex-' + e);
    if (box) box.addEventListener('change', updateExam);
  }
  updateExam();

  function updateScore() {
    var total = 0;
    for (var i = 1; i <= 5; i += 1) {
      var input = LK.$('d4-sc-' + i);
      var out = LK.$('d4-sc-' + i + '-out');
      if (!input) continue;
      var v = parseInt(input.value, 10) || 0;
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d4-sc-total', total + ' / 20');
    var tip = '回到两连杆重推';
    if (total >= 17) tip = '可以做 D+1 复述';
    else if (total >= 13) tip = '补验证与接口';
    else if (total >= 9) tip = '重做数值校核';
    else tip = '先补 FK/IK 推导';
    LK.text('d4-sc-tip', tip);
  }
  for (var s = 1; s <= 5; s += 1) {
    var rng = LK.$('d4-sc-' + s);
    if (rng) rng.addEventListener('input', updateScore);
  }
  updateScore();

  /* ---------- 启动 ---------- */
  renderVerify();
  updateFk();
})();
