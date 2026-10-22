/* Day 13 — OpenXR frames, WebRTC, latency/drift, haptics safety. Vanilla, offline, schematic. */
(function () {
  'use strict';

  var redraws = [];
  function d(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function fixed(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }
  function rad(deg) { return deg * Math.PI / 180; }
  function rgba(hex, a) {
    var h = (hex || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* -------------------------------------------------------- 01 chain */
  var chState = null;
  var P_A = [0.20, 0.15];
  function rot(v, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  }
  function drawChain() {
    if (!chState) return;
    var P = LK.palette();
    var s = chState, ctx = s.ctx;
    LK.clear(s, P.card);
    var ax = parseFloat(d('d13-c-ax').value);
    var bx = parseFloat(d('d13-c-bx').value);
    var ayA = parseFloat(d('d13-c-ay').value);
    var ayB = parseFloat(d('d13-c-by').value);
    LK.text('d13-c-ax-out', fixed(ax, 1) + ' m');
    LK.text('d13-c-bx-out', fixed(bx, 1) + ' m');
    LK.text('d13-c-ay-out', fixed(ayA, 0) + '°');
    LK.text('d13-c-by-out', fixed(ayB, 0) + '°');

    var rA = rot(P_A, rad(ayA));
    var worldP = [rA[0] + ax, rA[1]];
    var relB = [worldP[0] - bx, worldP[1]];
    var pB = rot(relB, rad(-ayB));
    var naive = [P_A[0] - bx, P_A[1]];

    LK.text('d13-c-pa', '(' + fixed(P_A[0], 2) + ', ' + fixed(P_A[1], 2) + ')');
    LK.text('d13-c-ps', '(' + fixed(worldP[0], 2) + ', ' + fixed(worldP[1], 2) + ')');
    LK.text('d13-c-pb', '(' + fixed(pB[0], 2) + ', ' + fixed(pB[1], 2) + ')');
    LK.text('d13-c-bad', '(' + fixed(naive[0], 2) + ', ' + fixed(naive[1], 2) + ')');

    var mL = 30, mR = 30, mT = 26, mB = 34;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var x0 = -3.6, x1 = 6.6, y0 = -1.7, y1 = 1.7;
    var sc = Math.min(w / (x1 - x0), h / (y1 - y0));
    function X(m) { return mL + (m - x0) * sc + (w - (x1 - x0) * sc) / 2; }
    function Y(m) { return mT + h - ((m - y0) * sc + (h - (y1 - y0) * sc) / 2); }

    /* 1 m grid */
    ctx.strokeStyle = P.grid;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    for (var gx = Math.ceil(x0); gx <= x1; gx++) {
      ctx.beginPath(); ctx.moveTo(X(gx), mT); ctx.lineTo(X(gx), mT + h); ctx.stroke();
    }
    for (var gy = Math.ceil(y0); gy <= y1; gy++) {
      ctx.beginPath(); ctx.moveTo(mL, Y(gy)); ctx.lineTo(mL + w, Y(gy)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    LK.label(ctx, '单位：米（俯视图）', mL + 4, mT + h - 10, P.muted, 10, 'left');
    /* 1 m scale bar */
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(mL + w - 70, mT + h - 12); ctx.lineTo(mL + w - 70 + sc, mT + h - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mL + w - 70, mT + h - 16); ctx.lineTo(mL + w - 70, mT + h - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mL + w - 70 + sc, mT + h - 16); ctx.lineTo(mL + w - 70 + sc, mT + h - 8); ctx.stroke();
    LK.label(ctx, '1 m', mL + w - 70 + sc / 2, mT + h - 26, P.muted, 9, 'center');

    function frame(origin, yaw, name, color, below) {
      var len = 0.9;
      var ux = rot([len, 0], rad(yaw)), uy = rot([0, len], rad(yaw));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(origin[0]), Y(origin[1])); ctx.lineTo(X(origin[0] + ux[0]), Y(origin[1] + ux[1])); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(origin[0]), Y(origin[1])); ctx.lineTo(X(origin[0] + uy[0]), Y(origin[1] + uy[1])); ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.beginPath(); ctx.arc(X(origin[0]), Y(origin[1]), 0.34 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      LK.dot(ctx, X(origin[0]), Y(origin[1]), 4.5, color);
      LK.label(ctx, name, X(origin[0]) - (below ? -8 : 6) * 0 + (below ? 10 : -6), Y(origin[1]) + (below ? 19 : -17), color, 11, below ? 'left' : 'right');
    }
    frame([0, 0], 0, '共享世界原点', P.fg, true);
    frame([ax, 0], ayA, 'A_local', P.s1);
    frame([bx, 0], ayB, 'B_local', P.s3);

    /* hand point in world */
    ctx.fillStyle = P.s4;
    ctx.beginPath(); ctx.arc(X(worldP[0]), Y(worldP[1]), 6, 0, Math.PI * 2); ctx.fill();
    LK.label(ctx, '手（世界坐标）', X(worldP[0]) + 10, Y(worldP[1]) - 15, P.s4, 10, 'left');

    /* vector A origin -> hand (this is T_shared_A * p_A) */
    LK.arrow(ctx, X(ax), Y(0), X(worldP[0]), Y(worldP[1]), P.s1, 1.5);

    /* vector B -> hand (p_B expressed in B, drawn in world shape) */
    LK.arrow(ctx, X(bx), Y(0), X(worldP[0]), Y(worldP[1]), P.s3, 1.5);
    LK.label(ctx, 'A→手：T_shared_A·p_A（绿）　B→手：T_shared_B⁻¹·…（蓝）', mL + 4, mT + 16, P.muted, 10, 'left');

    /* naive point */
    ctx.strokeStyle = rgba(P.bad, 0.8);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(X(bx), Y(0)); ctx.lineTo(X(naive[0]), Y(naive[1])); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(X(naive[0]), Y(naive[1]), 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = P.bad; ctx.stroke();
    LK.label(ctx, '直接相减', X(naive[0]), Y(naive[1]) + 20, P.bad, 10, 'center');

    var diff = d('d13-c-diff');
    if (diff) {
      var dxy = Math.hypot(pB[0] - naive[0], pB[1] - naive[1]);
      if (Math.abs(ayA) < 1 && Math.abs(ayB) < 1) {
        diff.innerHTML = '当前两端朝向都是 0°，所以旋转不起作用。此时“直接相减”与正确结果的差 = <strong>' + fixed(dxy, 2) +
          ' m</strong>，差的那一段正好是 <code>T_shared_A</code> 的平移 <strong>' + fixed(ax, 1) +
          ' m</strong>——因为直接相减根本没把 A 的本地原点放进共享世界。<strong>这一项在朝向为 0 时都躲不掉，有旋转时还会多一项。</strong>';
      } else {
        diff.innerHTML = '当前有旋转（A ' + fixed(ayA, 0) + '°，B ' + fixed(ayB, 0) + '°）。正确结果 <code>(' + fixed(pB[0], 2) + ', ' + fixed(pB[1], 2) +
          ')</code>，直接相减 <code>(' + fixed(naive[0], 2) + ', ' + fixed(naive[1], 2) + ')</code>，两者差 <strong>' + fixed(dxy, 2) +
          ' m</strong>。<strong>注意：正确结果的长度等于 A 到手的距离（' + fixed(Math.hypot(relB[0], relB[1]), 2) +
          ' m），只是方向被 B 的朝向转了一下——所以“距离对不对”完全无法证明“方向对不对”。</strong>';
      }
    }
    var note = d('d13-c-note');
    if (note) {
      note.innerHTML = '当前 <code>p_B = (' + fixed(pB[0], 2) + ', ' + fixed(pB[1], 2) + ')</code>。' +
        '手算顺序永远是：<strong>① 用 <code>T_shared_A</code> 把 A 本地的点搬进共享世界；② 减去 B 在共享世界的位置；③ 乘 <code>R(−yaw_B)</code> 转进 B 的朝向。</strong>' +
        '第 ③ 步最常被忘——忘了它，人会在“距离对、方向错”的地方，这比彻底错更难查。';
    }
  }
  function initChain() {
    var s = LK.canvas('d13-c-canvas', 360);
    if (!s) return;
    chState = s;
    s.onresize = drawChain;
    ['d13-c-ax', 'd13-c-bx', 'd13-c-ay', 'd13-c-by'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawChain);
    });
    redraws.push(drawChain);
    drawChain();
  }

  /* ------------------------------------------------------- 02 spaces */
  var SPACES = {
    view: {
      name: 'VIEW',
      rows: [
        ['原点', '头显本身（跟着头动）'],
        ['会不会动', '永远在动——它就是头'],
        ['表达什么', '“头在某个参考空间里的位姿”'],
        ['典型用途', '渲染相机、判断用户看向哪里'],
        ['Rove 里的角色', '不能用来做共享对齐：它的数值随头转动，无法当作世界锚点']
      ],
      warn: [
        ['最大的误用', '把 VIEW 里的手部坐标当成世界坐标发出去。对方的虚拟人会跟着你的头一起转——看起来“很灵敏”，其实完全是错的。'],
        ['怎么识别', '静止不动时数值稳定、一转头数值全变。看到这个特征，先怀疑参考空间用错。']
      ],
      note: '<strong>VIEW 是一个“观测量”，不是一个“场地”。</strong>问“这东西在世界哪里”不能以 VIEW 为基准。'
    },
    local: {
      name: 'LOCAL',
      rows: [
        ['原点', '会话开始时的头部附近（不是地面）'],
        ['会不会动', '<strong>会</strong>：用户重新居中/重置时原点移动'],
        ['表达什么', '相对于“本次会话起点”的位置'],
        ['典型用途', '坐姿体验、纯相对交互、一次性对齐'],
        ['Rove 里的角色', '只能做相对量（“比刚才远了 3 cm”）；不能作为长期共享锚点']
      ],
      warn: [
        ['最隐蔽的故障', '用户在会话中途按了“重新居中”，LOCAL 原点跳了一下，共享锚点静默失效。<strong>网络指标一切正常</strong>，但两端的相对关系已经变了。'],
        ['怎么防', '把参考空间类型写进协议；监听重置事件并触发重新对齐；或干脆改用 LOCAL_FLOOR / STAGE。']
      ],
      note: '<strong>LOCAL 的“原点会动”是设计如此，不是 bug。</strong>把它当固定世界用，就是把自己的假设建在流沙上。'
    },
    floor: {
      name: 'LOCAL_FLOOR',
      rows: [
        ['原点', '地面（原点高度有保证，通常在脚底平面）'],
        ['会不会动', '高度稳定；偏航可能在重置时改变'],
        ['表达什么', '“离地多高、离起点多远”'],
        ['典型用途', '站姿交互、需要“脚踩在地上”的场景'],
        ['Rove 里的角色', '两端都用它时，至少<strong>高度是同一套约定</strong>，比 LOCAL 稳；偏航仍需对齐']
      ],
      warn: [
        ['它解决了什么', '解决了“两台设备的高度基准不一致”这个最常见的可见错误——虚拟人半截埋在地里或飘在空中。'],
        ['它没解决什么', '水平朝向与原点位置仍需共享锚点。<strong>地面一致 ≠ 站在同一处。</strong>']
      ],
      note: '<strong>这是远程共处里最实用的默认选择</strong>：先保证地面一致，再谈水平对齐。'
    },
    stage: {
      name: 'STAGE',
      rows: [
        ['原点', '预设的舞台中心（若设备/场地提供）'],
        ['会不会动', '相对稳定，但依赖设备能力与场地标定'],
        ['表达什么', '“在这个已标定的场地里的绝对位置”'],
        ['典型用途', '房间级共享、多人同场景、跨设备对齐'],
        ['Rove 里的角色', '最接近“共享世界”，但<strong>不是所有设备都支持</strong>，要写降级路径']
      ],
      warn: [
        ['依赖条件', '需要设备/运行时支持，并且场地做过标定。没有 STAGE 时必须回退到“LOCAL_FLOOR + 共享锚点”。'],
        ['工程写法', '代码里不要硬编码“一定有 STAGE”，要写成能力探测 + 降级分支，并在日志里记下实际用了哪一种。']
      ],
      note: '<strong>“有没有 STAGE”是一个能力问题，不是一个假设。</strong>把它写进配置探测，而不是写进注释。'
    }
  };
  function renderSpaces() {
    var sp = SPACES[spaceKey];
    var kv = d('d13-sp-kv');
    if (kv) kv.innerHTML = sp.rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
    var lane = d('d13-sp-warn');
    if (lane) {
      lane.innerHTML = sp.warn.map(function (w, i) {
        return '<div class="role-card' + (i === 0 ? ' is-active' : '') + '"><h4>' + w[0] + '</h4><p>' + w[1] + '</p></div>';
      }).join('');
    }
    var note = d('d13-sp-note');
    if (note) note.innerHTML = sp.note;
  }
  var spaceKey = 'view';
  function initSpaces() {
    var tabs = d('d13-sp-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-space]');
        if (!btn) return;
        spaceKey = btn.dataset.space;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderSpaces();
      });
    }
    renderSpaces();
  }

  /* -------------------------------------------------------- 03 comms */
  var NET_STEPS = ['Signaling', 'SDP', 'ICE / STUN / TURN', 'PeerConnection'];
  var SP_STEPS = ['HMD / Hand tracking', 'local frame', 'shared anchor', 'remote avatar'];
  function renderComms() {
    var net = d('d13-cm-net').checked;
    var space = d('d13-cm-space').checked;
    function chain(host, steps, on) {
      if (!host) return;
      host.innerHTML = steps.map(function (s, i) {
        return '<span class="node' + (on ? ' is-active' : '') + '">' + s + '</span>' +
          (i < steps.length - 1 ? '<span class="arrow">→</span>' : '');
      }).join('');
    }
    chain(d('d13-cm-net-chain'), NET_STEPS, net);
    chain(d('d13-cm-space-chain'), SP_STEPS, space);

    var symptom, hint, note;
    if (net && space) {
      symptom = '位置正确'; hint = '两条都通';
      note = '两条链都通时，才轮到讨论质量：姿态年龄、抖动、漂移速率。<strong>“能看见”是连通性的证据，“站对位置”是对齐的证据，两者不能互相替代。</strong>';
    } else if (net && !space) {
      symptom = '能看见，但站错地方'; hint = '先查空间链（变换/参考空间）';
      note = '<strong>这就是今天开头那个故障。</strong>网络指标全绿，人却偏了一两米。排查顺序：① 打印 <code>p_A / p_shared / p_B</code> 三段数值；② 检查有没有漏掉逆变换；③ 检查两端参考空间是否一致、用户是否重置过。' +
        '注意此时<strong>不要动网络参数</strong>——改 RTT、改码率都不会让它变好。';
    } else if (!net && space) {
      symptom = '没有画面（几何是对的）'; hint = '先查网络链（信令/ICE）';
      note = '空间对齐是“计算出来”的，它不依赖网络。所以你可以<strong>在没有连接的情况下验证对齐是否正确</strong>（本地打印两端坐标即可）。这条正好说明两条链的独立：' +
        '<strong>对齐可以先离线验证，连通性不行。</strong>';
    } else {
      symptom = '什么都没有'; hint = '先连网，再对齐';
      note = '两条都断时先恢复连通性，因为对齐的验证往往需要两端交换数据。<strong>但验证顺序不要搞反：连通之后先验坐标系，再看画质。</strong>';
    }
    LK.text('d13-cm-symptom', symptom);
    LK.text('d13-cm-hint', hint);
    var n = d('d13-cm-note');
    if (n) n.innerHTML = note;
  }
  function initComms() {
    ['d13-cm-net', 'd13-cm-space'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', renderComms);
    });
    renderComms();
  }

  /* ------------------------------------------------------ 04 latency */
  var laState = null;
  function drawLatency() {
    if (!laState) return;
    var P = LK.palette();
    var s = laState, ctx = s.ctx;
    LK.clear(s, P.card);
    var rtt = parseFloat(d('d13-l-rtt').value);
    var jit = parseFloat(d('d13-l-jit').value);
    var loss = parseFloat(d('d13-l-loss').value);
    LK.text('d13-l-rtt-out', fixed(rtt, 0) + ' ms');
    LK.text('d13-l-jit-out', fixed(jit, 0) + ' ms');
    LK.text('d13-l-loss-out', fixed(loss, 1) + ' %');

    var one = rtt / 2;
    var buf = Math.max(10, 2 * jit);
    var age = one + buf;
    var HAND = 1.5; /* m/s */
    var err = HAND * age / 1000 * 100; /* cm */

    LK.text('d13-l-one', fixed(one, 0) + ' ms');
    LK.text('d13-l-buf', fixed(buf, 0) + ' ms');
    LK.text('d13-l-age', fixed(age, 0) + ' ms');
    LK.text('d13-l-err', fixed(err, 1) + ' cm');

    var verdict, vCls, haptic, hCls, note;
    if (age < 60 && loss < 2) {
      verdict = '可用'; vCls = 'ok'; haptic = '允许'; hCls = 'ok';
      note = '姿态年龄 ' + fixed(age, 0) + ' ms，外推误差约 ' + fixed(err, 1) + ' cm。这个量级下平滑插值就够，不需要激进的预测。' +
        '<strong>注意：这只是“示例阈值”，真实阈值必须由你自己的实验定。</strong>';
    } else if (age < 120) {
      verdict = '可用但需平滑'; vCls = 'warn'; haptic = age < 80 ? '允许' : '禁止'; hCls = age < 80 ? 'ok' : 'bad';
      note = '姿态年龄 ' + fixed(age, 0) + ' ms，外推误差约 ' + fixed(err, 1) + ' cm。视觉上要接受“虚拟手稍微落后”，' +
        '用插值+短窗外推混合，不要用长窗外推（会冲过头）。' + (age < 80 ? '' : '<strong>触觉建议关闭：手感和画面已经明显不同步。</strong>');
    } else if (age < 220) {
      verdict = '降级'; vCls = 'bad'; haptic = '禁止'; hCls = 'bad';
      note = '姿态年龄 ' + fixed(age, 0) + ' ms，外推误差约 ' + fixed(err, 1) + ' cm。' +
        '<strong>此时应该做的是“降低交互等级”，不是“加更多算法”</strong>：关掉触觉、把精细抓取改成“确认式”交互、必要时冻结远端姿态并给出提示。';
    } else {
      verdict = '停止远端动作'; vCls = 'bad'; haptic = '禁止'; hCls = 'bad';
      note = '姿态年龄 ' + fixed(age, 0) + ' ms，外推误差约 ' + fixed(err, 1) + ' cm。这个量级已经不能用于任何有物理后果的动作。' +
        '<strong>正确动作：停止、提示、等网络恢复——而不是让虚拟人继续“猜”对方在哪。</strong>';
    }
    var vEl = d('d13-l-verdict');
    if (vEl) { vEl.textContent = verdict; vEl.className = vCls; }
    var hEl = d('d13-l-haptic');
    if (hEl) { hEl.textContent = haptic; hEl.className = hCls; }
    var nEl = d('d13-l-note');
    if (nEl) nEl.innerHTML = note;

    /* --- timeline --- */
    var mL = 30, mR = 30, mT = 18;
    var w = s.w - mL - mR;
    var T = Math.max(220, (one + buf) * 1.6);
    function X(ms) { return mL + clamp(ms, 0, T) / T * w; }
    var y1 = mT + 18, y2 = mT + 76;

    /* grid + axis */
    for (var t = 0; t <= T; t += Math.max(50, Math.round(T / 5 / 50) * 50)) {
      ctx.strokeStyle = P.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(t), y1 - 10); ctx.lineTo(X(t), y2 + 40); ctx.stroke();
    }
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, y2 + 40); ctx.lineTo(mL + w, y2 + 40); ctx.stroke();
    for (var t2 = 0; t2 <= T; t2 += Math.max(50, Math.round(T / 5 / 50) * 50)) {
      LK.label(ctx, t2 + ' ms', X(t2), y2 + 52, P.muted, 9, 'center');
    }

    /* row 1: 采集 -> 到达 */
    ctx.strokeStyle = rgba(P.s1, 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(0), y1); ctx.lineTo(X(one), y1); ctx.stroke();
    LK.dot(ctx, X(0), y1, 4.5, P.s1);
    LK.dot(ctx, X(one), y1, 4.5, P.s1);
    LK.label(ctx, '网络单程 RTT/2 = ' + fixed(one, 0) + ' ms', X(one / 2), y1 - 12, P.s1, 10, 'center');
    LK.label(ctx, '采集', X(0), y1 + 15, P.muted, 9, 'center');

    /* jitter band around arrival */
    ctx.fillStyle = rgba(P.s2, 0.16);
    ctx.fillRect(X(Math.max(0, one - jit)), y1 - 9, Math.max(2, X(one + jit) - X(Math.max(0, one - jit))), 18);
    LK.label(ctx, '到达（抖动 ±' + fixed(jit, 0) + ' ms）', Math.min(X(one + jit) + 8, mL + w - 4), y1 - 2, P.s2, 9, 'left');

    /* row 2: 缓冲 -> 显示 */
    ctx.strokeStyle = rgba(P.s4, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(one), y2); ctx.lineTo(X(one + buf), y2); ctx.stroke();
    LK.dot(ctx, X(one), y2, 4, P.s4);
    LK.dot(ctx, X(one + buf), y2, 4.5, P.s4);
    LK.label(ctx, '插值缓冲 ' + fixed(buf, 0) + ' ms', X(one + buf / 2), y2 - 12, P.s4, 10, 'center');
    LK.label(ctx, '显示', X(one + buf) + 8, y2 + 2, P.s4, 9, 'left');

    /* age bracket */
    ctx.strokeStyle = P.fg;
    ctx.lineWidth = 1.2;
    var yb = y2 + 16;
    ctx.beginPath(); ctx.moveTo(X(0), yb); ctx.lineTo(X(one + buf), yb); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), yb - 4); ctx.lineTo(X(0), yb + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(one + buf), yb - 4); ctx.lineTo(X(one + buf), yb + 4); ctx.stroke();
    LK.label(ctx, '姿态年龄 = ' + fixed(age, 0) + ' ms（用户此刻看到的“过去”）', X((one + buf) / 2), yb + 10, P.fg, 10, 'center');

    /* error bar */
    var ey = y2 + 104;
    var maxErr = 40; /* cm */
    var bx0 = mL + 10, bx1 = mL + w - 10;
    LK.label(ctx, '外推误差 = 手速 ' + HAND + ' m/s × 姿态年龄 = ' + fixed(err, 1) + ' cm', mL, ey - 18, P.muted, 10, 'left');
    ctx.fillStyle = rgba(P.s4, 0.12);
    ctx.fillRect(bx0, ey - 5, bx1 - bx0, 10);
    ctx.fillStyle = rgba(P.s4, 0.7);
    var ew = (clamp(err, 0, maxErr) / maxErr) * (bx1 - bx0);
    ctx.fillRect(bx0, ey - 5, Math.max(2, ew), 10);
    [3, 10, 25].forEach(function (m) {
      var mx = bx0 + m / maxErr * (bx1 - bx0);
      ctx.strokeStyle = P.muted;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, ey - 9); ctx.lineTo(mx, ey + 9); ctx.stroke();
      LK.label(ctx, m + ' cm', mx, ey + 18, P.muted, 9, 'center');
    });
  }

  function initLatency() {
    var s = LK.canvas('d13-l-canvas', 250);
    if (!s) return;
    laState = s;
    s.onresize = drawLatency;
    ['d13-l-rtt', 'd13-l-jit', 'd13-l-loss'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawLatency);
    });
    redraws.push(drawLatency);
    drawLatency();
  }

  /* -------------------------------------------------------- 05 drift */
  var drState = null;
  function drawDrift() {
    if (!drState) return;
    var P = LK.palette();
    var s = drState, ctx = s.ctx;
    LK.clear(s, P.card);
    var rate = parseFloat(d('d13-d-rate').value);
    var tNow = parseFloat(d('d13-d-t').value);
    LK.text('d13-d-rate-out', fixed(rate, 1) + ' cm/min');
    LK.text('d13-d-t-out', fixed(tNow, 0) + ' min');
    var off = rate * tNow;
    LK.text('d13-d-off', fixed(off, 1) + ' cm');
    var TH = 3;
    var cross = rate > 0 ? TH / rate : Infinity;
    LK.text('d13-d-cross', isFinite(cross) && cross <= 40 ? fixed(cross, 1) + ' min' : '40 min 内不会');
    var bad = off > TH;
    var vEl = d('d13-d-verdict');
    if (vEl) { vEl.textContent = bad ? '需要重定位' : '可接受'; vEl.className = bad ? 'bad' : 'ok'; }

    var mL = 52, mR = 26, mT = 26, mB = 42;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var tMax = 40, yMax = Math.max(6, rate * tMax * 1.05);
    function X(t) { return mL + t / tMax * w; }
    function Y(v) { return mT + h - clamp(v, 0, yMax) / yMax * h; }

    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    for (var t = 0; t <= tMax; t += 10) {
      ctx.beginPath(); ctx.moveTo(X(t), mT); ctx.lineTo(X(t), mT + h); ctx.stroke();
      LK.label(ctx, t + ' min', X(t), mT + h + 14, P.muted, 9, 'center');
    }
    for (var k = 0; k <= 4; k++) {
      var vv = yMax * k / 4;
      LK.label(ctx, fixed(vv, 1), mL - 8, Y(vv), P.muted, 9, 'right');
    }
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    LK.label(ctx, '累计偏移（cm）', mL - 8, mT - 12, P.muted, 10, 'left');
    LK.label(ctx, '运行时长', mL + w / 2, s.h - 8, P.muted, 10, 'center');

    /* threshold */
    ctx.strokeStyle = P.bad;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(mL, Y(TH)); ctx.lineTo(mL + w, Y(TH)); ctx.stroke();
    ctx.setLineDash([]);
    LK.label(ctx, '门限 ' + TH + ' cm（示例值）', mL + w - 4, Y(TH) - 10, P.bad, 10, 'right');

    /* curve */
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) {
      var tt = tMax * i / 200;
      var x = X(tt), y = Y(rate * tt);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = P.s1;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    /* current point */
    LK.dot(ctx, X(tNow), Y(off), 5, bad ? P.bad : P.s1);
    LK.label(ctx, fixed(off, 1) + ' cm', X(tNow) + 8, Y(off) - 10, bad ? P.bad : P.s1, 10, 'left');

    var note = d('d13-d-note');
    if (note) {
      note.innerHTML = (bad
        ? '已经超过门限：两端对“同一张桌子在哪”的理解差了 <strong>' + fixed(off, 1) + ' cm</strong>。这个偏移<strong>不会自己回落</strong>，加缓冲、调平滑都没用——只能重新对齐或触发重定位。'
        : '当前偏移 ' + fixed(off, 1) + ' cm，还在门限内。但注意它是<strong>线性累积</strong>的：按这个速率，大约 ' + (isFinite(cross) ? fixed(cross, 1) + ' 分钟' : '—') + '后就会超限。'
        ) + ' 所以运维上应该<strong>定期用外部参照物做残差检验</strong>，而不是等用户抱怨“东西位置不对”。';
    }
  }
  function initDrift() {
    var s = LK.canvas('d13-d-canvas', 300);
    if (!s) return;
    drState = s;
    s.onresize = drawDrift;
    ['d13-d-rate', 'd13-d-t'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawDrift);
    });
    redraws.push(drawDrift);
    drawDrift();
  }

  /* ------------------------------------------------------- 06 schema */
  function renderSchema() {
    var useTs = d('d13-s-ts').checked;
    var useValid = d('d13-s-valid').checked;
    var useConf = d('d13-s-conf').checked;
    var useFrame = d('d13-s-frame').checked;
    var usePerm = d('d13-s-perm').checked;

    var lines = ['{', '  "type": "hand_pose",'];
    if (useFrame) lines.push('  "frame": "A_local",');
    if (useTs) lines.push('  "t_ms": 123456,');
    if (useValid) lines.push('  "tracking_valid": true,');
    if (useConf) lines.push('  "confidence": "measured_or_unknown",');
    lines.push('  "pose": {"position_m": [0.2, 0, 0], "orientation_xyzw": [0, 0, 0, 1]},');
    if (usePerm) lines.push('  "permission_haptics": false');
    else lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
    lines.push('}');
    var pre = d('d13-s-json');
    if (pre) pre.textContent = lines.join('\n');

    var checks = [];
    function push(label, ok, detail) {
      checks.push('<tr><td>' + label + '</td><td class="' + (ok ? 'flag ok' : 'flag bad') + '">' + detail + '</td></tr>');
    }
    push('有没有 <code>t_ms</code>？能算姿态年龄吗？', useTs, useTs ? '可以算 → 可判新旧' : '无法判断新鲜度 → 拒收');
    push('有没有 <code>tracking_valid</code>？能区分“测到的”和“保持的”吗？', useValid, useValid ? '可以区分' : '无法区分 → 拒收');
    push('有没有 <code>frame</code>？数值属于哪个坐标系？', useFrame, useFrame ? '已声明' : '坐标含义不明 → 拒收');
    push('有没有 <code>confidence</code>？能表达不确定吗？', useConf, useConf ? '可表达' : '只能假装都可信 → 降级使用');
    push('有没有 <code>permission_haptics</code>？能触发触觉吗？', usePerm, usePerm ? '按字段判定' : '无法确认授权 → 禁止触觉');
    var body = d('d13-s-checks');
    if (body) body.innerHTML = checks.join('');

    var fatal = 0;
    if (!useTs) fatal++;
    if (!useValid) fatal++;
    if (!useFrame) fatal++;
    var soft = 0;
    if (!useConf) soft++;
    if (!usePerm) soft++;
    var v = d('d13-s-verdict');
    if (v) {
      v.textContent = fatal ? '拒收' : (soft ? '降级可用' : '可以');
      v.className = fatal ? 'bad' : (soft ? 'warn' : 'ok');
    }
    LK.text('d13-s-miss', String(fatal + soft));
    var note = d('d13-s-note');
    if (note) {
      note.innerHTML = fatal
        ? '<strong>缺了“致命三件套”之一（时间戳 / 有效性 / 坐标系），接收端没有安全的处理方式</strong>——它要么假设数据是新的，要么假设坐标是世界坐标，两个假设在故障时都会导致错误动作。所以正确反应是拒收并降级，而不是“先画上去”。'
        : (soft
          ? '还能用，但必须降级：<strong>没有 confidence 就只能标注“不确定”，没有 permission_haptics 就一律不发触觉</strong>。这类字段缺失不致命，但会让系统失去“表达不确定性”的能力。'
          : '五个字段齐全。<strong>注意这并不代表数据正确</strong>——它只代表接收端有能力判断“新不新、可不可信、在哪个坐标系、能不能碰”。判断能力来自字段，正确性来自标定。');
    }
  }
  function initSchema() {
    ['d13-s-ts', 'd13-s-valid', 'd13-s-conf', 'd13-s-frame', 'd13-s-perm'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', renderSchema);
    });
    renderSchema();
  }

  /* ------------------------------------------------------ 07 haptics */
  var HAP_STATES = ['IDLE', 'REQUESTED', 'GRANTED', 'ACTIVE', 'STOPPED'];
  var hap = { state: 'IDLE', log: [] };
  var HAP_INFO = {
    IDLE: { allow: '无（默认关闭）', deny: '任何触觉输出' },
    REQUESTED: { allow: '等待用户决定', deny: '任何触觉输出' },
    GRANTED: { allow: '可开始反馈（需用户在场）', deny: '后台自动开始' },
    ACTIVE: { allow: '按授权的强度与时长发反馈', deny: '超时/超强度/对未授权用户' },
    STOPPED: { allow: '无', deny: '任何触觉输出（含缓存旧指令）' }
  };
  function hapLog(text, cls) {
    hap.log.push({ t: text, c: cls || '' });
    var host = d('d13-h-log');
    if (host) {
      host.innerHTML = hap.log.map(function (l) {
        return '<p class="' + l.c + '">' + l.t + '</p>';
      }).join('');
      host.scrollTop = host.scrollHeight;
    }
  }
  function renderHaptics() {
    var chain = d('d13-h-chain');
    if (chain) {
      chain.innerHTML = HAP_STATES.map(function (st, i) {
        var cls = 'node' + (st === hap.state ? ' is-active' : '');
        return '<span class="' + cls + '">' + st + '</span>' + (i < HAP_STATES.length - 1 ? '<span class="arrow">→</span>' : '');
      }).join('');
    }
    LK.text('d13-h-state', hap.state);
    var info = HAP_INFO[hap.state];
    LK.text('d13-h-allow', info.allow);
    LK.text('d13-h-deny', info.deny);
    var actions = d('d13-h-actions');
    if (actions) {
      var defs = [
        { k: 'req', label: '请求授权', ok: hap.state === 'IDLE' || hap.state === 'STOPPED' },
        { k: 'grant', label: '用户授予', ok: hap.state === 'REQUESTED' },
        { k: 'start', label: '开始反馈', ok: hap.state === 'GRANTED' },
        { k: 'pause', label: '暂停', ok: hap.state === 'ACTIVE' },
        { k: 'revoke', label: '撤回授权', ok: true },
        { k: 'lost', label: '模拟断线', ok: true },
        { k: 'replay', label: '试播缓存旧指令', ok: true },
        { k: 'reset', label: '重置', ok: true }
      ];
      actions.innerHTML = defs.map(function (x) {
        return '<button type="button" class="btn" data-hap="' + x.k + '">' + x.label + '</button>';
      }).join('');
    }
  }
  function hapAction(k) {
    if (k === 'req') {
      if (hap.state === 'IDLE' || hap.state === 'STOPPED') {
        hap.state = 'REQUESTED';
        hapLog('→ REQUESTED：向用户明确询问“是否允许触觉反馈”，默认仍是关闭的');
      } else hapLog('✗ 忽略：当前状态 ' + hap.state + ' 不允许重复请求', 'is-bad');
    } else if (k === 'grant') {
      if (hap.state === 'REQUESTED') {
        hap.state = 'GRANTED';
        hapLog('→ GRANTED：记录授权人、时刻、作用范围（本次会话 / 长期）');
      } else hapLog('✗ 忽略：未发出请求就“授予”是无效授权', 'is-bad');
    } else if (k === 'start') {
      if (hap.state === 'GRANTED') {
        hap.state = 'ACTIVE';
        hapLog('→ ACTIVE：开始输出触觉；同时开超时计时与强度上限');
      } else hapLog('✗ 拒绝：' + hap.state + ' 状态下输出触觉属于越权', 'is-bad');
    } else if (k === 'pause') {
      if (hap.state === 'ACTIVE') {
        hap.state = 'STOPPED';
        hapLog('→ STOPPED：暂停即停止输出；已排队未播的指令<strong>全部作废</strong>', 'is-bad');
      } else hapLog('✗ 忽略：当前没有正在进行的反馈', 'is-bad');
    } else if (k === 'revoke') {
      var was = hap.state;
      hap.state = 'STOPPED';
      hapLog('→ STOPPED：用户撤回授权（from ' + was + '）。撤回是<strong>高优先级 + 幂等</strong>：重复撤回结果相同，不会报错、不会恢复', 'is-bad');
      hapLog('   持久化：把“用户不同意”写入授权状态，下次会话需重新征询');
    } else if (k === 'lost') {
      if (hap.state === 'ACTIVE') {
        hap.state = 'STOPPED';
        hapLog('→ STOPPED：链路超时，<strong>自动停止</strong>（不是“保持最后一个动作”）', 'is-bad');
        hapLog('   记录停止原因 = LINK_LOST，并写入本地日志（离线也要留证）');
      } else {
        hapLog('链路超时：当前未在输出，状态保持 ' + hap.state + '；仍记录事件');
      }
    } else if (k === 'replay') {
      hapLog('✗ 拒绝重播：缓冲区里的旧指令在 STOPPED / 撤回之后<strong>一律丢弃</strong>。' +
        '否则会出现“用户已经说停，手却又被推了一下”——这是最典型的安全事故形态', 'is-bad');
    } else if (k === 'reset') {
      hap.state = 'IDLE';
      hap.log = [];
      var host = d('d13-h-log');
      if (host) host.innerHTML = '';
      hapLog('00 待触发：默认关闭。点「请求授权」开始');
    }
    renderHaptics();
  }
  function initHaptics() {
    var host = d('d13-h-actions');
    if (host) {
      host.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-hap]');
        if (!btn) return;
        hapAction(btn.dataset.hap);
      });
    }
    var note = d('d13-h-note');
    if (note) {
      note.innerHTML = '建议按顺序试一遍：<strong>请求 → 授予 → 开始 → 撤回 → 试播缓存旧指令</strong>。' +
        '特别注意最后一步永远被拒绝——<strong>“停止”必须同时清空队列</strong>，否则撤回只是把开关关了，管道里还留着会动的指令。' +
        '再试一次<strong>开始 → 模拟断线</strong>：状态会自动落到 STOPPED，而不是停在 ACTIVE。';
    }
    renderHaptics();
    hapLog('00 待触发：默认关闭。点「请求授权」开始');
  }

  /* ------------------------------------------------------- 08 faults */
  var FAULTS = {
    track: {
      title: '① 跟踪失效（网络正常）',
      rows: [
        ['现象', '手部/头部位姿突然停止更新，或 <code>tracking_valid=false</code>，但音视频仍在流动'],
        ['姿态怎么处理', '<strong>立刻不再使用旧位姿</strong>。远端显示“对方暂时不可定位”，而不是继续画一只静止的手'],
        ['音视频怎么处理', '继续。语音仍然有价值（“我看不到你的手了”），不要一起断掉'],
        ['触觉怎么处理', '立即停止。基于失效位姿的触觉等于在错误位置施加力'],
        ['恢复条件', '<code>tracking_valid</code> 连续 N 帧为真 + 与上一有效位姿的跳变在阈值内（否则视为“瞬移”，需要重新确认）'],
        ['反直觉点', '“画面没卡”会让人以为一切正常。<strong>姿态通道和媒体通道是两条独立的数据流，一条坏不代表另一条坏。</strong>']
      ],
      note: '<strong>关键设计：</strong>把“有效性”做成消息里的显式字段，而不是靠“数值有没有变”去猜。猜的结果是：手真的静止时，你会误判成失效；手抖时，你会把失效当成正常。'
    },
    net: {
      title: '② WebRTC 断线',
      rows: [
        ['现象', '<code>connectionState</code> 变为 disconnected / failed，数据不再到达'],
        ['姿态怎么处理', '进入“最后已知位姿 + 过期标记”，超出阈值后<strong>冻结并提示</strong>，不继续插值'],
        ['音视频怎么处理', '尝试 ICE 重启；同时给出明确的“重连中”状态，避免用户以为对方不动了'],
        ['触觉怎么处理', '<strong>超时即停</strong>；重连后不自动恢复输出，需重新确认'],
        ['恢复条件', '重连成功 + 参考空间/锚点重新校验通过（<strong>不能只凭 connectionState 就恢复</strong>）'],
        ['反直觉点', '网络恢复不等于状态恢复。断线期间用户可能重置过 LOCAL 原点，<strong>重连后坐标系可能已经变了</strong>。']
      ],
      note: '<strong>重连流程里最容易被省掉的一步：</strong>重新校验坐标。很多 demo 在重连后直接复用旧变换，结果人突然跳到另一个位置。'
    },
    anchor: {
      title: '③ 共享锚点漂移',
      rows: [
        ['现象', '一切“正常”：连着、流畅、位姿有效，但两端的相对位置慢慢错开'],
        ['姿态怎么处理', '位姿本身没问题，<strong>错的是变换</strong>。要在变换层检测与修正，而不是过滤位姿'],
        ['音视频怎么处理', '不受影响（这也是它难被发现的原因）'],
        ['触觉怎么处理', '一旦偏移超阈值，禁止触觉——因为“碰到的东西”可能已经不在那个位置'],
        ['恢复条件', '用外部参照（共同可见的标记/物体）算残差；超阈值触发重定位或重新对齐'],
        ['反直觉点', '<strong>所有健康指标都是绿的。</strong>唯一能发现它的办法是“拿一个两端都能看到的东西对一下”。']
      ],
      note: '<strong>这就是“网络通了但位置错”的另一半答案：</strong>漂移不在网络度量里，必须有独立的几何健康检查。'
    }
  };
  var faultKey = 'track';
  function renderFaults() {
    var f = FAULTS[faultKey];
    var kv = d('d13-f-kv');
    if (kv) {
      kv.innerHTML = '<dt>情景</dt><dd>' + f.title + '</dd>' + f.rows.map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
      }).join('');
    }
    var lane = d('d13-f-lane');
    if (lane) {
      lane.innerHTML = '<div class="role-card is-active"><h4>这一组的要点</h4><p>' + f.note + '</p></div>';
    }
    var note = d('d13-f-note');
    if (note) {
      note.innerHTML = '三组反例的共同点：<strong>都在“看起来正常”的时候发生</strong>。所以产品的健康检查必须覆盖三层——' +
        '连通性（connectionState）、时效性（姿态年龄）、几何一致性（外部参照残差）。<strong>只查第一层，就等于什么都没查。</strong>';
    }
  }
  function initFaults() {
    var tabs = d('d13-f-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-fault]');
        if (!btn) return;
        faultKey = btn.dataset.fault;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderFaults();
      });
    }
    renderFaults();
  }

  /* --------------------------------------------------------- 09 exam */
  function calcExam() {
    var n = 0;
    for (var i = 1; i <= 6; i++) {
      var el = d('d13-ex-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d13-ex-count', n + ' / 6');
    var lvl = d('d13-ex-level');
    if (lvl) lvl.textContent = n >= 6 ? '完整答卷' : (n >= 4 ? '接近完整' : (n >= 2 ? '骨架成形' : '未开始'));
  }
  function initExam() {
    for (var i = 1; i <= 6; i++) {
      var el = d('d13-ex-' + i);
      if (el) el.addEventListener('change', calcExam);
    }
    calcExam();
  }

  /* -------------------------------------------------------- 10 score */
  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d13-sc-' + i);
      var v = el ? parseInt(el.value, 10) : 0;
      var out = d('d13-sc-' + i + '-out');
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d13-sc-total', total + ' / 20');
    var tip = d('d13-sc-tip');
    if (tip) tip.textContent = total >= 17 ? '可以上场' : (total >= 12 ? '补验证与真实性' : (total >= 7 ? '先算 −1.8' : '回到第 01 节'));
    var note = d('d13-sc-note');
    if (note) {
      if (total >= 17) {
        note.innerHTML = '现在最该练的是<strong>被追问“你怎么知道是漂移而不是延迟”时，能在 15 秒内说清判据</strong>：偏移恒定 → 变换错；随时间增长 → 漂移；只在运动时出现 → 时效。三个判据背下来，比多讲三个项目有用。';
      } else if (total >= 12) {
        note.innerHTML = '典型状态：能画两条链，但没跑过双端。<strong>最低成本的补法：两台手机 + 一个打印二维码当共享参照物，把偏移和姿态年龄记下来。</strong>一次就够。';
      } else {
        note.innerHTML = '先把第 01 节的 <code>p_B = T_shared_B<sup>−1</sup>·T_shared_A·p_A</code> 手算一遍得到 <strong>(−1.8, 0)</strong>，再把第 04 节的 <code>RTT/2 + 缓冲</code> 算一遍。<strong>这两个数能当场写在纸上，是最硬的证据。</strong>';
      }
    }
  }
  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d13-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  function boot() {
    initChain();
    initSpaces();
    initComms();
    initLatency();
    initDrift();
    initSchema();
    initHaptics();
    initFaults();
    initExam();
    initScore();
  }

  if (window.MutationObserver) {
    new MutationObserver(function () {
      redraws.forEach(function (fn) { try { fn(); } catch (e) {} });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
