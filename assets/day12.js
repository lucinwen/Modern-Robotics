/* Day 12 — SAR, multi-source evidence, independence. Vanilla, offline, schematic only. */
(function () {
  'use strict';

  var C = 3e8;
  var redraws = [];
  function d(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function fixed(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }
  function log10(v) { return Math.log(v) / Math.LN10; }
  function hexRgb(hex) {
    var h = (hex || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function hhmm(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ------------------------------------------------------- 01 scale */
  var SCALE_SRC = [
    { key: 'sar', name: '卫星 SAR', res: [1, 25], cov: [20000, 250000], slot: 's1' },
    { key: 'uav', name: '无人机可见光', res: [0.02, 0.2], cov: [100, 3000], slot: 's3' },
    { key: 'rgbd', name: '机器人 RGB-D', res: [0.004, 0.02], cov: [1, 6], slot: 's4' },
    { key: 'fmcw', name: '近场毫米波', res: [0.04, 0.3], cov: [5, 15], slot: 's2' }
  ];
  var TASKS = {
    patrol: { name: '园区巡查', res: 0.2, cov: 500, unit: 'm',
      note: '园区巡查要的是“几百米范围内能分出人和车”。无人机可见光是唯一同时满足的；卫星 SAR 覆盖够但 1 m 以上的分辨单元分不出人；近场两类传感器覆盖只有十几米。<strong>结论不是“都不行”，而是“这件事必须用平台换尺度”。</strong>' },
    elder: { name: '居家看护', res: 0.05, cov: 8, unit: 'm',
      note: '看护场景要的是“房间里 8 m 内看清姿态与微动”。近场毫米波与 RGB-D 都能覆盖，但一个给不了颜色语义、一个怕遮挡与反光。<strong>这才是真正意义上的“互补”：同一尺度、不同失效轴。</strong>' },
    warehouse: { name: '仓储搬运', res: 0.02, cov: 6, unit: 'm',
      note: '仓储要 2 cm 级几何，只有 RGB-D 与无人机（低空）满足。毫米波的距离分辨率受带宽限制，2 cm 需要 7.5 GHz 带宽——不是算不出来，是那个成本不该花在搬运上。<strong>先问“哪个量真的需要这个精度”，再问“谁能给”。</strong>' }
  };
  var scaleState = null, scaleTask = 'patrol';

  function drawScale() {
    if (!scaleState) return;
    var P = LK.palette();
    var s = scaleState, ctx = s.ctx;
    LK.clear(s, P.card);

    var mL = 70, mR = 26, mT = 26, mB = 46;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var X0 = -2.5, X1 = 2.6, Y0 = 0, Y1 = 5.6;
    function X(v) { return mL + (clamp(log10(v), X0, X1) - X0) / (X1 - X0) * w; }
    function Y(v) { return mT + h - (clamp(log10(v), Y0, Y1) - Y0) / (Y1 - Y0) * h; }

    /* grid + ticks */
    var xTicks = [[0.01, '1 cm'], [0.1, '10 cm'], [1, '1 m'], [10, '10 m'], [100, '100 m']];
    var yTicks = [[1, '1 m'], [10, '10 m'], [100, '100 m'], [1000, '1 km'], [10000, '10 km'], [100000, '100 km']];
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    xTicks.forEach(function (t) {
      ctx.beginPath(); ctx.moveTo(X(t[0]), mT); ctx.lineTo(X(t[0]), mT + h); ctx.stroke();
    });
    yTicks.forEach(function (t) {
      ctx.beginPath(); ctx.moveTo(mL, Y(t[0])); ctx.lineTo(mL + w, Y(t[0])); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    xTicks.forEach(function (t) { LK.label(ctx, t[1], X(t[0]), mT + h + 13, P.muted, 10, 'center'); });
    yTicks.forEach(function (t) { LK.label(ctx, t[1], mL - 7, Y(t[0]), P.muted, 10, 'right'); });
    LK.label(ctx, '空间分辨率（越好越靠右）', mL + w / 2, s.h - 9, P.muted, 11, 'center');
    LK.label(ctx, '单次覆盖 / 作用距离', 4, mT - 12, P.muted, 11, 'left');

    /* task requirement region */
    var tk = TASKS[scaleTask];
    var rx0 = mL, rx1 = X(tk.res), ry0 = mT, ry1 = Y(tk.cov);
    ctx.fillStyle = rgba(P.primary, 0.09);
    ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    ctx.strokeStyle = rgba(P.primary, 0.55);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    ctx.setLineDash([]);
    LK.label(ctx, '任务可接受区', rx0 + 8, ry1 - 12, P.primary, 11, 'left');

    /* sources */
    var fit = [];
    SCALE_SRC.forEach(function (src) {
      var x0 = X(src.res[0]), x1 = X(src.res[1]);
      var y1 = Y(src.cov[0]), y0 = Y(src.cov[1]);
      var col = P[src.slot];
      var ok = src.res[0] <= tk.res && src.cov[1] >= tk.cov;
      if (ok) fit.push(src.name);
      ctx.fillStyle = rgba(col, ok ? 0.42 : 0.16);
      ctx.fillRect(x0, y0, Math.max(4, x1 - x0), Math.max(4, y1 - y0));
      ctx.strokeStyle = col;
      ctx.lineWidth = ok ? 2 : 1.2;
      ctx.globalAlpha = ok ? 1 : 0.65;
      ctx.strokeRect(x0, y0, Math.max(4, x1 - x0), Math.max(4, y1 - y0));
      ctx.globalAlpha = 1;
      var lx = clamp(x1 + 6, mL + 4, mL + w - 4);
      var ly = clamp((y0 + y1) / 2, mT + 8, mT + h - 6);
      LK.label(ctx, src.name + (ok ? ' ✓' : ''), lx, ly, ok ? col : P.muted, 11, 'left');
    });

    LK.text('d12-sc-res', tk.res + ' m');
    LK.text('d12-sc-cov', tk.cov >= 1000 ? fixed(tk.cov / 1000, 1) + ' km' : tk.cov + ' m');
    LK.text('d12-sc-fit', fit.length + ' / 4');
    var note = d('d12-sc-note');
    if (note) {
      note.innerHTML = '<strong>' + tk.name + '：</strong>' + tk.note +
        (fit.length ? ' 当前满足的来源：<strong>' + fit.join('、') + '</strong>。' : ' 当前没有来源满足全部条件。');
    }
  }

  function initScale() {
    var s = LK.canvas('d12-sc-canvas', 430);
    if (!s) return;
    scaleState = s;
    s.onresize = drawScale;
    var tabs = d('d12-sc-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-task]');
        if (!btn) return;
        scaleTask = btn.dataset.task;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        drawScale();
      });
    }
    redraws.push(drawScale);
    drawScale();
  }

  /* ---------------------------------------------------- 02 aperture */
  var apState = null;
  function drawAperture() {
    if (!apState) return;
    var P = LK.palette();
    var s = apState, ctx = s.ctx;
    LK.clear(s, P.card);
    var lambda = 0.03;
    var D = parseFloat(d('d12-ap-d').value);
    var Rkm = parseFloat(d('d12-ap-r').value);
    var R = Rkm * 1000;
    var lmax = lambda * R / D;
    var da = D / 2;
    LK.text('d12-ap-d-out', fixed(D, 1) + ' m');
    LK.text('d12-ap-r-out', fixed(Rkm, 0) + ' km');
    LK.text('d12-ap-lmax', lmax >= 1000 ? fixed(lmax / 1000, 1) + ' km' : fixed(lmax, 0) + ' m');
    LK.text('d12-ap-da', fixed(da, 2) + ' m');
    LK.text('d12-ap-naive', fixed(lambda * R / (2 * lmax), 2) + ' m');

    var mL = 46, mR = 20, mT = 26;
    var w = s.w - mL - mR;
    var topH = 168, botH = 150;
    var topY = mT, botY = mT + topH + 44;

    /* --- top: synthetic aperture geometry --- */
    LK.label(ctx, '① 沿航迹：波束足印 = 合成孔径', mL, topY - 8, P.muted, 11, 'left');
    var pathY = topY + 22;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mL, pathY); ctx.lineTo(mL + w, pathY); ctx.stroke();
    LK.arrow(ctx, mL + w - 60, pathY, mL + w - 4, pathY, P.muted, 1.4);
    LK.label(ctx, '飞行方向', mL + w - 62, pathY - 11, P.muted, 10, 'right');

    var frac = clamp(lmax / 48000, 0.05, 1);
    var half = 0.48 * w * frac;
    var cx = mL + w * 0.5;
    ctx.strokeStyle = P.s1;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(cx - half, pathY); ctx.lineTo(cx + half, pathY); ctx.stroke();
    [cx - half, cx + half].forEach(function (x) {
      ctx.beginPath(); ctx.moveTo(x, pathY - 6); ctx.lineTo(x, pathY + 6); ctx.stroke();
    });
    LK.label(ctx, 'L_max ≈ λR/D = ' + (lmax >= 1000 ? fixed(lmax / 1000, 1) + ' km' : fixed(lmax, 0) + ' m'),
      cx, pathY - 14, P.s1, 10, 'center');

    /* ground line + point target */
    var gY = topY + 132;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, gY); ctx.lineTo(mL + w, gY); ctx.stroke();
    LK.label(ctx, '地面', mL + 4, gY + 10, P.muted, 10, 'left');
    var px = cx + w * 0.18;
    LK.dot(ctx, px, gY, 4, P.s4);
    LK.label(ctx, '点目标 P', px + 8, gY + 12, P.s4, 10, 'left');

    /* beam edges from aperture ends to P */
    ctx.strokeStyle = rgba(P.s2, 0.75);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - half, pathY + 4); ctx.lineTo(px, gY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + half, pathY + 4); ctx.lineTo(px, gY); ctx.stroke();
    ctx.setLineDash([]);
    LK.label(ctx, '每一点都被“看”了很多次，且每次的斜距不同 → 相位史可被聚焦',
      mL, gY + 26, P.muted, 10, 'left');

    /* --- bottom: azimuth impulse response for three antenna lengths --- */
    LK.label(ctx, '② 方位向响应：主瓣宽度 = δa', mL, botY - 8, P.muted, 11, 'left');
    var bh = botH;
    var bx0 = mL + 24, bx1 = mL + w - 46;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx0, botY); ctx.lineTo(bx0, botY + bh); ctx.lineTo(bx1, botY + bh); ctx.stroke();
    var dmax = 8;
    function bx(v) { return bx0 + (v + dmax) / (2 * dmax) * (bx1 - bx0); }
    function by(v) { return botY + bh - v * (bh - 10); }
    [0, 0.5, 1].forEach(function (g) {
      ctx.strokeStyle = P.grid;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(bx0, by(g)); ctx.lineTo(bx1, by(g)); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    LK.label(ctx, '0', bx0 - 6, botY + bh, P.muted, 9, 'right');
    LK.label(ctx, '1', bx0 - 6, by(1), P.muted, 9, 'right');
    LK.label(ctx, '方位偏移 Δa（m）', (bx0 + bx1) / 2, botY + bh + 14, P.muted, 10, 'center');
    [[-dmax, '−8'], [0, '0'], [dmax, '+8']].forEach(function (t) {
      LK.label(ctx, t[1], bx(t[0]), botY + bh + 14, P.muted, 9, 'center');
    });

    var variants = [
      { k: 0.5, col: P.s1, tag: 'D/2' },
      { k: 1, col: P.s4, tag: 'D' },
      { k: 2, col: P.s3, tag: '2D' }
    ];
    variants.forEach(function (v) {
      var dvv = (D * v.k) / 2;
      ctx.beginPath();
      for (var i = 0; i <= 420; i++) {
        var a = -dmax + 2 * dmax * i / 420;
        var u = Math.PI * a / dvv;
        var amp = Math.abs(u) < 1e-6 ? 1 : Math.abs(Math.sin(u) / u);
        var x = bx(a), y = by(amp * 0.92);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = v.col;
      ctx.globalAlpha = v.k === 1 ? 1 : 0.65;
      ctx.lineWidth = v.k === 1 ? 2.1 : 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    LK.label(ctx, '● D=' + fixed(D, 1) + ' m', bx1 - 4, botY + 8, P.s4, 10, 'right');
    LK.label(ctx, '● 天线减半', bx1 - 4, botY + 22, P.s1, 10, 'right');
    LK.label(ctx, '● 天线加倍', bx1 - 4, botY + 36, P.s3, 10, 'right');

    var note = d('d12-ap-note');
    if (note) {
      note.innerHTML = '当前 D = ' + fixed(D, 1) + ' m：波束足印 L_max ≈ ' + (lmax >= 1000 ? fixed(lmax / 1000, 1) + ' km' : fixed(lmax, 0) + ' m') +
        '，方位分辨率 δa ≈ D/2 = <strong>' + fixed(da, 2) + ' m</strong>。右边那格 λR/(2L_max) = ' +
        fixed(lambda * R / (2 * lmax), 2) + ' m <strong>恒等于 D/2</strong>——这不是巧合：把 L_max = λR/D 代回去，R 必然被消掉。' +
        '<strong>所以要警惕任何“方位分辨率随距离变差”的说法：它漏掉了“距离越远、可用孔径也越长”这一层。</strong>当然，这个抵消只在“波束足印决定孔径”的条带模式下成立。</div>';
    }
  }

  function initAperture() {
    var s = LK.canvas('d12-ap-canvas', 430);
    if (!s) return;
    apState = s;
    s.onresize = drawAperture;
    ['d12-ap-d', 'd12-ap-r'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawAperture);
    });
    redraws.push(drawAperture);
    drawAperture();
  }

  /* -------------------------------------------------------- 03 side */
  var sdState = null;
  function drawSide() {
    if (!sdState) return;
    var P = LK.palette();
    var s = sdState, ctx = s.ctx;
    LK.clear(s, P.card);
    var th = parseFloat(d('d12-sd-th').value);
    var hh = parseFloat(d('d12-sd-h').value);
    var rad = th * Math.PI / 180;
    var shift = hh / Math.tan(rad);        /* top image displacement toward radar */
    var shadow = hh * Math.tan(rad);       /* shadow length behind building */
    var footprint = 20;                    /* building ground footprint, m */
    LK.text('d12-sd-th-out', fixed(th, 0) + '°');
    LK.text('d12-sd-h-out', fixed(hh, 0) + ' m');
    LK.text('d12-sd-shift', fixed(shift, 0) + ' m');
    LK.text('d12-sd-shadow', fixed(shadow, 0) + ' m');
    var verdict, vClass, note;
    if (shift > footprint * 1.0) {
      verdict = '叠掩 layover'; vClass = 'bad';
      note = '顶部的像被<strong>推到楼前的街上</strong>（位移 ' + fixed(shift, 0) + ' m，超过楼自身横向尺度 ' + fixed(footprint, 0) + ' m）。图上会出现“楼顶压在路面上”的亮块，位置是错的，但看起来非常自然。此时用这张图做变化检测，会把楼顶当成街上的新目标。';
    } else if (shadow > footprint * 2) {
      verdict = '阴影为主'; vClass = 'warn';
      note = '入射角很大：顶部位移只有 ' + fixed(shift, 0) + ' m（几何畸变轻），但楼后留下 <strong>' + fixed(shadow, 0) + ' m 的无回波阴影</strong>。注意：阴影区“黑”不等于“空”——那里只是没被照到。<strong>把阴影读成空地，是 SAR 判读最常见的错。</strong>';
    } else if (shift > footprint * 0.5) {
      verdict = '透视收缩'; vClass = 'warn';
      note = '顶部像位移 ' + fixed(shift, 0) + ' m，楼被“压短”但还没压到街上。这是最常见的状态：几何可解释，但<strong>绝对不能拿它和光学图直接做像素级变化检测</strong>。';
    } else {
      verdict = '畸变可控'; vClass = 'ok';
      note = '位移 ' + fixed(shift, 0) + ' m、阴影 ' + fixed(shadow, 0) + ' m，都小于楼体尺度，几何基本可读。' +
        '<strong>但“这张图可读”不等于“两张图能直接叠”</strong>——正射纠正、控制点、坐标系一样都不能省。';
    }
    var vEl = d('d12-sd-verdict');
    if (vEl) { vEl.textContent = verdict; vEl.className = vClass; }

    var mL = 30, mR = 30, mT = 26, mB = 40;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var span = Math.max(260, shift * 2.4 + footprint * 3 + shadow * 1.6);
    var groundY = mT + h - 26;
    var scale = w / span;
    function X(m) { return mL + m * scale; }

    /* radar platform */
    var platX = X(0), platY = mT + 6;
    ctx.fillStyle = P.s1;
    ctx.beginPath();
    ctx.moveTo(platX - 10, platY + 14); ctx.lineTo(platX + 10, platY + 14); ctx.lineTo(platX, platY); ctx.closePath(); ctx.fill();
    LK.label(ctx, '雷达平台（高度已压缩）', platX + 16, platY + 6, P.s1, 10, 'left');

    /* ground + building */
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mL, groundY); ctx.lineTo(mL + w, groundY); ctx.stroke();
    var bw = Math.max(18, footprint * scale);
    var bx = X(shift + 30);
    var bTop = groundY - hh * scale;
    ctx.fillStyle = rgba(P.muted === P.muted ? P.fg : P.fg, 0.12);
    ctx.fillRect(bx, bTop, bw, groundY - bTop);
    ctx.strokeStyle = P.fg;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(bx, bTop, bw, groundY - bTop);
    LK.label(ctx, 'h = ' + fixed(hh, 0) + ' m', bx + bw + 6, (bTop + groundY) / 2, P.fg, 10, 'left');

    /* sight lines: to base and to top */
    ctx.strokeStyle = rgba(P.s2, 0.9);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(platX, platY + 12); ctx.lineTo(bx, groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(platX, platY + 12); ctx.lineTo(bx, bTop); ctx.stroke();
    ctx.setLineDash([]);

    /* incidence angle: nadir reference + arc to the base ray (drawing is compressed) */
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(platX, platY + 12); ctx.lineTo(platX, groundY); ctx.stroke();
    ctx.setLineDash([]);
    var angToBase = Math.atan2(groundY - (platY + 12), bx - platX);
    ctx.beginPath();
    ctx.arc(platX, platY + 12, 62, angToBase, Math.PI / 2);
    ctx.stroke();
    var midA = (angToBase + Math.PI / 2) / 2;
    LK.label(ctx, 'θ=' + fixed(th, 0) + '°', platX + 68 * Math.cos(midA) + 6, platY + 12 + 68 * Math.sin(midA), P.muted, 10, 'left');


    /* image positions: base at bx, top displaced toward radar by shift */
    var topImgX = bx - shift * scale;
    ctx.strokeStyle = P.s4;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx, groundY + 8); ctx.lineTo(bx, groundY + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(topImgX, groundY + 8); ctx.lineTo(topImgX, groundY + 16); ctx.stroke();
    LK.dot(ctx, bx, groundY + 12, 3.2, P.s4);
    LK.dot(ctx, topImgX, groundY + 12, 3.2, P.s4);
    LK.label(ctx, '底部像', bx, groundY + 26, P.muted, 9, 'center');
    LK.label(ctx, '顶部像', topImgX, groundY + 26, P.s4, 9, 'center');

    /* displacement bracket */
    if (shift > 2) {
      ctx.strokeStyle = P.s4;
      ctx.lineWidth = 1.2;
      var yb = groundY - 10;
      ctx.beginPath(); ctx.moveTo(topImgX, yb); ctx.lineTo(bx, yb); ctx.stroke();
      LK.arrow(ctx, bx, yb, topImgX + 2, yb, P.s4, 1.2);
      LK.label(ctx, 'h·cotθ = ' + fixed(shift, 0) + ' m', (topImgX + bx) / 2, yb - 9, P.s4, 10, 'center');
    }

    /* shadow behind building */
    var shEnd = bx + bw + shadow * scale;
    ctx.fillStyle = rgba(P.fg, 0.10);
    ctx.fillRect(bx + bw, groundY - 8, Math.max(2, shEnd - bx - bw), 8);
    ctx.strokeStyle = P.fg;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(platX, platY + 12); ctx.lineTo(shEnd, groundY); ctx.stroke();
    ctx.setLineDash([]);
    if (shadow > 3) {
      LK.label(ctx, '阴影 ' + fixed(shadow, 0) + ' m', (bx + bw + shEnd) / 2, groundY + 12, P.fg, 9, 'center');
    }

    var nEl = d('d12-sd-note');
    if (nEl) nEl.innerHTML = note + ' <strong>位移 = h·cotθ，阴影 = h·tanθ，两者乘积恒等于 h²。</strong>所以“叠掩严重”和“阴影很长”不会同时出现——它们分别在入射角很小和很大的两端。';
  }

  function initSide() {
    var s = LK.canvas('d12-sd-canvas', 400);
    if (!s) return;
    sdState = s;
    s.onresize = drawSide;
    ['d12-sd-th', 'd12-sd-h'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawSide);
    });
    redraws.push(drawSide);
    drawSide();
  }

  /* --------------------------------------------------- 04 mechanism */
  var MECH = {
    sar: {
      name: 'SAR 主动微波',
      rows: [
        ['能量来源', '自己发射微波（主动），X/C/L 波段'],
        ['记录的是什么', '后向散射强度 + 相位（复数）'],
        ['天气 / 光照', '几乎不受云雨影响；昼夜都能拍'],
        ['语义强弱', '弱。图上是有明暗纹理的斑点，不是照片'],
        ['几何', '强。距离靠时延、方位靠多普勒，但要做正射纠正'],
        ['失效条件', '平静水面镜面反射 → 全黑；金属角反射器 → 假亮斑；叠掩/阴影区不可判读；语义歧义']
      ],
      chips: ['全天时', '全天候', '穿透云雨', '含相位', '语义弱', '有几何畸变'],
      fails: [
        ['会骗你的三种亮', '金属屋顶、角反射器、湿地面镜面反射都会产生极亮的点，但它们不是目标。SAR 的“亮”= 散射截面大，不等于“重要”。'],
        ['看起来像空地的黑', '阴影区与平静水面都没有回波。前者是“没照到”，后者是“镜面弹走了”。两者在图上都是黑的，含义完全不同。'],
        ['一句话边界', 'SAR 能告诉你“那里有强散射体、大概在哪”，不能告诉你“那是什么、有没有人”。']
      ],
      note: 'SAR 是广域普查的主力：能穿透天气给出“哪里有变化”。它的短板是<strong>语义</strong>——所以它几乎从不单独作为结论，而是作为“派谁去细看”的触发器。'
    },
    optical: {
      name: '光学可见光',
      rows: [
        ['能量来源', '太阳反射（被动），夜间需人造照明'],
        ['记录的是什么', '可见光波段的反射率（RGB）'],
        ['天气 / 光照', '云、雨、雾全部遮挡；夜间失效'],
        ['语义强弱', '强。人眼可读，可交给模型做检测/分割'],
        ['几何', '中。受透视、地形起伏、镜头畸变影响'],
        ['失效条件', '厚云遮挡 → 无效观测；夜间 → 无效；强反光/过曝 → 饱和；阴影 → 目标不可见']
      ],
      chips: ['语义强', '人眼可读', '依赖日照', '怕云', '夜间失效', '易过曝'],
      fails: [
        ['被云挡住 = 观测失败', '这是本页最重要的一条：云遮挡不是“看过了没有”，而是“没看成”。<strong>它在证据计数里权重为 0</strong>，既不能确认也不能否证。'],
        ['阴影也有方向', '同一目标在上午和下午的阴影方向相反，模型如果把阴影当特征，会在下午直接失效。'],
        ['一句话边界', '光学最适合回答“是什么”。但它对时间与天气极度敏感，<strong>它给出的“没有”往往只是“没看见”。</strong>']
      ],
      note: '光学是语义层的主力。多源融合里它的角色通常是<strong>“确认是什么”</strong>，前提是那一次观测真的有效——所以云量、太阳高度角、过曝比例必须进证据字段。'
    },
    thermal: {
      name: '热红外',
      rows: [
        ['能量来源', '目标自身热辐射（被动），8–14 µm 长波红外'],
        ['记录的是什么', '亮温（相对温差），不是绝对温度'],
        ['天气 / 光照', '能穿薄雾，穿不了厚云与雨；昼夜都能用'],
        ['语义强弱', '中弱。只有温差轮廓，没有纹理'],
        ['几何', '中。分辨率通常低于同平台可见光'],
        ['失效条件', '午后地面与建筑同温 → 热对比消失；雨淋降温；玻璃不透过长波红外；发射率差异伪装']
      ],
      chips: ['夜间可用', '看温差', '穿薄雾', '怕厚云', '无纹理', '玻璃不可见'],
      fails: [
        ['温差是相对的', '热红外给你的是“比周围热/冷”，不是“37.2 ℃”。要得到绝对温度必须做发射率与大气校正，否则只能做相对比较。'],
        ['午后会“糊”', '日照把地面和建筑加热到接近同温，热对比消失，图像变成一片均匀灰。<strong>同一台设备在夜里很好用，在下午可能毫无信息。</strong>'],
        ['一句话边界', '热红外回答“有没有活的、热的、刚用过的”，最适合做<strong>存在性提示</strong>，不适合做身份或精细几何。']
      ],
      note: '热红外的价值在<strong>时间维度</strong>：夜里光学失效时它还能工作。但它对“什么时候拍”极度敏感——<strong>同一个场景的凌晨与午后是两张不同的图</strong>。'
    },
    rgbd: {
      name: 'RGB-D 近场',
      rows: [
        ['能量来源', '主动结构光 / ToF，或双目被动测距'],
        ['记录的是什么', '每像素深度（m）+ 颜色'],
        ['天气 / 光照', '以室内为主；强阳光下 ToF 失效'],
        ['语义强弱', '中。有颜色但视角固定、尺度受限'],
        ['几何', '近场厘米级，但随距离平方退化'],
        ['失效条件', '反光/透明/黑色吸光面 → 深度缺失；超出量程；多机互扰；强光干扰结构光']
      ],
      chips: ['厘米级深度', '实时', '近距离', '怕反光', '怕透明', '多机互扰'],
      fails: [
        ['深度图上的黑洞', '玻璃、镜面、黑色绒布会让深度直接缺失。这些“洞”在算法里常被当成远处，导致避障判错。'],
        ['尺度不可外推', '3 m 内 1 cm 的精度，不代表 10 m 外还能用。深度误差通常随距离平方增长。'],
        ['一句话边界', 'RGB-D 是<strong>操作与避障</strong>的传感器，不是广域感知的传感器。它的输出必须带“有效距离范围”和“缺失掩码”。']
      ],
      note: 'RGB-D 的价值在<strong>可操作性</strong>：它给的是“抓得到、躲得开”的几何。把它当成广域感知用，是最常见的越界使用。'
    }
  };
  var mechKey = 'sar';
  function renderMech() {
    var m = MECH[mechKey];
    var kv = d('d12-me-kv');
    if (kv) {
      kv.innerHTML = m.rows.map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
      }).join('');
    }
    var chips = d('d12-me-chips');
    if (chips) {
      chips.innerHTML = m.chips.map(function (c, i) {
        return '<span class="chip' + (i < 3 ? ' is-on' : '') + '">' + c + '</span>';
      }).join('');
    }
    var lane = d('d12-me-fail');
    if (lane) {
      lane.innerHTML = m.fails.map(function (f, i) {
        return '<div class="role-card' + (i === 0 ? ' is-active' : '') + '"><h4>' + f[0] + '</h4><p>' + f[1] + '</p></div>';
      }).join('');
    }
    var note = d('d12-me-note');
    if (note) note.innerHTML = '<strong>' + m.name + '：</strong>' + m.note;
  }
  function initMech() {
    var tabs = d('d12-me-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-src]');
        if (!btn) return;
        mechKey = btn.dataset.src;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderMech();
      });
    }
    renderMech();
  }

  /* -------------------------------------------------------- 05 time */
  var tmState = null;
  var EVENTS = [
    { key: 'sar', name: 'SAR', min: 480, kind: 'valid', slot: 's1' },
    { key: 'opt', name: '光学', min: 720, kind: 'valid', slot: 's3' },
    { key: 'uav', name: '无人机', min: 1020, kind: 'valid', slot: 's4' }
  ];
  function drawTime() {
    if (!tmState) return;
    var P = LK.palette();
    var s = tmState, ctx = s.ctx;
    LK.clear(s, P.card);
    var tau = parseFloat(d('d12-tm-tau').value);
    var robotMin = parseFloat(d('d12-tm-robot').value);
    var cloud = d('d12-tm-cloud').checked;
    var geo = d('d12-tm-geo').checked;
    LK.text('d12-tm-tau-out', '±' + (tau >= 60 ? fixed(tau / 60, 1) + ' h' : fixed(tau, 0) + ' min'));
    LK.text('d12-tm-robot-out', hhmm(robotMin));

    var mL = 74, mR = 24, mT = 30, mB = 40;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    function X(t) { return mL + clamp(t, 0, 1440) / 1440 * w; }

    /* hour grid */
    for (var t = 0; t <= 1440; t += 180) {
      ctx.strokeStyle = P.grid;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(X(t), mT); ctx.lineTo(X(t), mT + h); ctx.stroke();
      ctx.globalAlpha = 1;
      LK.label(ctx, hhmm(t), X(t), mT + h + 13, P.muted, 10, 'center');
    }
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();

    /* tolerance band around SAR */
    var bandL = X(480 - tau), bandR = X(480 + tau);
    ctx.fillStyle = rgba(P.primary, 0.12);
    ctx.fillRect(bandL, mT, Math.max(2, bandR - bandL), h);
    ctx.strokeStyle = rgba(P.primary, 0.5);
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bandL, mT, Math.max(2, bandR - bandL), h);
    ctx.setLineDash([]);
    LK.label(ctx, '±τ 容差窗', bandL + 4, mT + h - 8, P.primary, 9, 'left');

    var lanes = [
      { name: 'SAR 08:00', min: 480, slot: 's1', ok: true, label: '有效' },
      { name: '光学 12:00', min: 720, slot: 's3', ok: !cloud, label: cloud ? '云遮挡 → 无效' : '有效' },
      { name: '无人机 17:00', min: 1020, slot: 's4', ok: true, label: '有效' },
      { name: '机器人 ' + hhmm(robotMin), min: robotMin, slot: 's2', ok: true, label: '有效（近场）' }
    ];
    lanes.forEach(function (ln, i) {
      var y = mT + 26 + i * ((h - 32) / 3.2);
      ctx.strokeStyle = P.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(mL + w, y); ctx.stroke();
      LK.label(ctx, ln.name, mL - 8, y, P.muted, 10, 'right');
      var ex = X(ln.min);
      if (ln.ok) {
        LK.dot(ctx, ex, y, 5, P[ln.slot]);
      } else {
        ctx.strokeStyle = P.muted;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(ex, y, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 3.5, y - 3.5); ctx.lineTo(ex + 3.5, y + 3.5); ctx.stroke();
      }
      LK.label(ctx, ln.label, ex + 9, y - 8, ln.ok ? P[ln.slot] : P.muted, 9, 'left');
    });

    /* pairwise verdicts */
    var rows = [];
    var pairs = [
      { a: 'SAR 08:00', b: '光学 12:00', dt: 240, kind: cloud ? 'invalid' : 'ok' },
      { a: 'SAR 08:00', b: '无人机 17:00', dt: 540, kind: 'ok' },
      { a: 'SAR 08:00', b: '机器人 ' + hhmm(robotMin), dt: robotMin - 480, kind: 'ok' }
    ];
    pairs.forEach(function (p) {
      var verdict, cls, cond;
      if (p.kind === 'invalid') {
        verdict = '不可关联：其中一次是<strong>无效观测</strong>（0 证据）'; cls = 'bad'; cond = '观测失败';
      } else if (Math.abs(p.dt) > tau) {
        verdict = '超出时间容差 → 不可关联（可能已不是同一事件）'; cls = 'warn'; cond = '时间不符';
      } else if (!geo) {
        verdict = '坐标未对齐 → 不可关联（无法证明同一位置）'; cls = 'bad'; cond = '坐标不符';
      } else {
        verdict = '可关联（仍是“同一事件”，不等于“同一结论”）'; cls = 'ok'; cond = '四项均满足';
      }
      rows.push('<tr><td>' + p.a + ' ↔ ' + p.b + '</td><td class="mono">' +
        (Math.abs(p.dt) >= 60 ? fixed(Math.abs(p.dt) / 60, 1) + ' h' : fixed(Math.abs(p.dt), 0) + ' min') +
        '</td><td>' + cond + '</td><td' + (cls === 'bad' ? ' style="color:var(--destructive)"' : '') + '>' + verdict + '</td></tr>');
    });
    var body = d('d12-tm-body');
    if (body) body.innerHTML = rows.join('');

    var note = d('d12-tm-note');
    if (note) {
      if (cloud) {
        note.innerHTML = '当前状态：<strong>光学那次是无效观测</strong>。所以真正有效的独立证据只有 SAR 一条，输出应为 <code>unknown_due_to_quality</code>。把 τ 拉大到 4 h 以上也救不回来——<strong>时间对齐解决的是“同一事件”，解决不了“有没有看到”</strong>。';
      } else {
        note.innerHTML = '关掉云遮挡后，光学与 SAR 的时间差仍是 ' + fixed(240 / 60, 1) + ' h。如果 τ 小于它，两条就只能算<strong>两个不同时刻的两次观测</strong>；只有当 τ ≥ 4 h 且坐标对齐时，才能说“同一事件的两次观测”——<strong>注意这不是“两次确认”，因为两次都是“看到异常”，并没有告诉你异常是什么</strong>。';
      }
    }
  }
  function initTime() {
    var s = LK.canvas('d12-tm-canvas', 300);
    if (!s) return;
    tmState = s;
    s.onresize = drawTime;
    ['d12-tm-tau', 'd12-tm-robot'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawTime);
    });
    ['d12-tm-cloud', 'd12-tm-geo'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', drawTime);
    });
    redraws.push(drawTime);
    drawTime();
  }

  /* ---------------------------------------------------- 06 evidence */
  var FIELD_ROWS = [
    { key: 'geolocation_uncertainty_m', label: 'geolocation_uncertainty_m', num: true,
      deny: '没有控制点或元数据时，“定位误差”这个数只能留 null。填一个“大概 5 米”就是编造。' },
    { key: 'spatial_resolution_m', label: 'spatial_resolution_m', num: true,
      deny: '分辨单元大小必须来自成像参数（带宽、天线、模式），不能靠“看起来挺清楚”估。' },
    { key: 'processing_version', label: 'processing_version', num: false,
      deny: '没有版本号的处理链无法复现，这一项只能由实际处理方提供。' },
    { key: 'claim', label: 'claim', hint: '升级为 confirmed_target', num: false,
      deny: '把 possible 升级为 confirmed，需要<strong>至少两条独立有效证据</strong>。当前独立证据数 = 1。' }
  ];
  var evState = {
    values: {
      sensor: 'SAR', captured_at: '08:00', crs: 'declared_EPSG',
      geolocation_uncertainty_m: null, spatial_resolution_m: null,
      claim: 'possible_target', confidence_basis: 'not_yet_calibrated',
      provenance: 'synthetic_only', processing_version: null
    },
    src: {}, msg: {}, confTried: false
  };
  function evJson() {
    var v = evState.values;
    var order = ['sensor', 'captured_at', 'crs', 'geolocation_uncertainty_m', 'spatial_resolution_m',
      'claim', 'confidence_basis', 'provenance', 'processing_version'];
    var lines = order.map(function (k) {
      var val = v[k];
      var shown = val === null ? 'null' : (typeof val === 'number' ? String(val) : '"' + val + '"');
      return '  "' + k + '": ' + shown;
    });
    return '{\n' + lines.join(',\n') + '\n}';
  }
  function renderEvidence() {
    var body = d('d12-ev-body');
    if (body) {
      body.innerHTML = FIELD_ROWS.map(function (f, i) {
        var opts = ['<option value="">—</option>', '<option value="meta">元数据</option>',
          '<option value="own">自采</option>', '<option value="third">第三方报告</option>',
          '<option value="unknown">未知</option>'].join('');
        return '<tr><td><code>' + f.label + '</code>' + (f.hint ? '<div style="font-size:11px;color:var(--muted-foreground);margin-top:3px">' + f.hint + '</div>' : '') + '</td><td id="d12-ev-v-' + i + '">' +
          (evState.values[f.key] === null ? '<span class="mono">null</span>' : '<span class="mono">' + evState.values[f.key] + '</span>') +
          '</td><td><select id="d12-ev-s-' + i + '" aria-label="' + f.label + ' 的证据来源">' + opts + '</select></td>' +
          '<td><button type="button" class="btn" data-ev="' + i + '">写入</button></td></tr>' +
          (evState.msg[i] ? '<tr><td colspan="4" style="font-size:12px;color:var(--muted-foreground)">' + evState.msg[i] + '</td></tr>' : '');
      }).join('');
    }
    var pre = d('d12-ev-json');
    if (pre) pre.textContent = evJson();
    var filled = 0;
    ['geolocation_uncertainty_m', 'spatial_resolution_m', 'processing_version', 'claim'].forEach(function (k) {
      if (evState.values[k] !== null && k !== 'claim') filled++;
    });
    LK.text('d12-ev-count', filled + ' / 4');
    LK.text('d12-ev-conf', evState.confTried ? '被拒绝' : '未标定');
    var auditOk = evState.values.crs !== null && evState.values.geolocation_uncertainty_m !== null &&
      evState.values.spatial_resolution_m !== null && evState.values.processing_version !== null;
    LK.text('d12-ev-audit', auditOk ? '完整' : '部分');
  }
  function evWrite(idx) {
    var f = FIELD_ROWS[idx];
    var sel = d('d12-ev-s-' + idx);
    var src = sel ? sel.value : '';
    var v = evState.values;
    if (!src || src === 'unknown') {
      evState.msg[idx] = '✗ 拒绝写入。来源未知或未选择时，这个字段<strong>必须保持 null</strong>。' + f.deny;
    } else if (f.key === 'claim') {
      evState.msg[idx] = '✗ 拒绝升级。当前独立有效证据只有 1 条（SAR），把 <code>possible_target</code> 写成 <code>confirmed_target</code> 会制造一条无法追证的断言。' + f.deny;
    } else if (f.key === 'spatial_resolution_m' && src === 'own') {
      evState.msg[idx] = '△ 允许，但只能标为“自采、未标定”：写入 3.0，同时把 <code>confidence_basis</code> 记为 <code>own_declared_uncalibrated</code>。自采的估计不是规格。';
      v.spatial_resolution_m = 3.0;
      v.confidence_basis = 'own_declared_uncalibrated';
    } else if (f.key === 'geolocation_uncertainty_m' && src === 'own') {
      evState.msg[idx] = '✗ 拒绝。定位误差必须由<strong>控制点或元数据</strong>给出；自己看图估的“大概几米”不是误差，是感觉。';
    } else if (f.key === 'processing_version') {
      evState.msg[idx] = '✓ 已写入 ' + (src === 'own' ? 'local-v0' : 'vendor-v1.2') + '。有了版本号，别人才有机会复现同一张图。';
      v.processing_version = src === 'own' ? 'local-v0' : 'vendor-v1.2';
    } else {
      var num = src === 'meta' ? 5.0 : 12.0;
      evState.msg[idx] = '✓ 已写入 ' + num + '（来源：' + (src === 'meta' ? '元数据' : '第三方报告') + '）。<strong>注意：这一项仍然只是单源的自我声明，不是独立复核。</strong>';
      v[f.key] = num;
      v.confidence_basis = 'vendor_declared';
    }
    renderEvidence();
  }
  function initEvidence() {
    var body = d('d12-ev-body');
    if (body) {
      body.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-ev]');
        if (!btn) return;
        evWrite(parseInt(btn.dataset.ev, 10));
      });
    }
    var tryBtn = d('d12-ev-try');
    if (tryBtn) {
      tryBtn.addEventListener('click', function () {
        evState.confTried = true;
        var msg = d('d12-ev-msg');
        if (msg) {
          msg.innerHTML = '✗ <strong>拒绝：</strong>没有标定依据，就不许写百分比。要写 98%，必须先给出测试集规模与划分、对照真值、指标定义、适用范围。';
        }
        renderEvidence();
      });
    }
    var note = d('d12-ev-note');
    if (note) {
      note.innerHTML = '规则很简单：<strong>来源决定能不能填</strong>。元数据/第三方可以填“声明值”，自采只能填“未标定值”，未知一律 null。' +
        '<code>claim</code> 最难升级——它需要两条<strong>独立</strong>有效证据，而当前只有一条。<strong>这就是“不许用格式上的完整，冒充证据上的充分”。</strong>';
    }
    renderEvidence();
  }

  /* ---------------------------------------------------- 07 branches */
  var CASES = {
    time: {
      title: '① 时间差：SAR 08:00 报异常，无人机 17:00 报无异常',
      gate: 0,
      surface: 'conflicting（两源结论相反）', surfaceCls: 'bad',
      after: 'unknown_due_to_quality', afterCls: 'warn',
      rows: [
        ['为什么会这样', '相隔 9 小时。目标可能已经移动/消失，也可能中途出现。两次观测都可能是对的，只是它们看的不是同一时刻的世界。'],
        ['第一层为什么会误判', '系统只比较“结论标签”，不比较“时间戳是否可比”，于是把“不同时刻的两个状态”当成了“同一时刻的矛盾”。'],
        ['必须保存', '两次的采集时刻、观测窗口长度、平台位置、成像模式。<strong>没有时刻的证据不能参与一致性判断。</strong>'],
        ['补什么观测', '同一时相（相干变化检测）、或把 τ 收紧到分钟级的同步观测、或补一次地面/近场测量。']
      ],
      human: '人工复核的是“这两个结论是否在讲同一时刻同一对象”。若不能，就拆成两条独立事件记录，而不是合成一条冲突。'
    },
    space: {
      title: '② 空间误配：两张图叠在一起差 30 m（分辨单元 5 m）',
      gate: 1,
      surface: 'conflicting（同一坐标处结论不同）', surfaceCls: 'bad',
      after: 'needs_human_review', afterCls: 'bad',
      rows: [
        ['为什么会这样', '侧视几何畸变（叠掩/透视收缩）、轨道与姿态误差、DEM 不准、控制点缺失，都会让同一栋楼在不同图里错开几十米。'],
        ['第一层为什么会误判', '系统默认“像素对齐 = 地物对齐”。但 30 m 的残差足以把一个街区的异常算到隔壁街区。'],
        ['必须保存', '配准残差、所用 DEM 与控制点、坐标系与投影、纠正算法版本。<strong>这些是“同一位置”这句话的全部依据。</strong>'],
        ['补什么观测', '重做正射纠正 + 增加控制点；或用同一平台同时相数据先把残差压到一个分辨单元以内。']
      ],
      human: '人工必须在原图上核对控制点（路口、独立建筑角点）是否重合。<strong>自动配准的“成功”只代表相关峰高，不代表地理正确。</strong>'
    },
    occl: {
      title: '③ 遮挡：光学 12:00 过境，目标区云量 95%',
      gate: 3,
      surface: 'unknown_due_to_quality', surfaceCls: 'warn',
      after: 'unknown_due_to_quality', afterCls: 'warn',
      rows: [
        ['为什么会这样', '云是不透明的。目标区可用像元不足，图像上是一片白云，不是“空地”。'],
        ['第一层判断反而是对的', '这条最值得注意：遮挡型失配<strong>不需要</strong>“先冲突再复核”，它在质量闸门就被拦下了——前提是你的系统真的有质量闸门。'],
        ['必须保存', '云量百分比、可用像元占比、太阳高度角、是否做了云掩膜。<strong>要写成 invalid_observation，不是 negative_result。</strong>'],
        ['补什么观测', '换时相、换波段（SAR 可穿云）、或降低要求改用“存在性”证据而非“身份”证据。']
      ],
      human: '不需要人工判读“云里有什么”——那是浪费。人工只需确认“这次观测确实无效”，然后决定补观测还是承认未知。'
    },
    res: {
      title: '④ 分辨率差：SAR 分辨单元 20 m，目标只有 2 m',
      gate: 2,
      surface: 'aligned_and_supported（最危险的一种“成功”）', surfaceCls: 'bad',
      after: 'unknown_due_to_quality', afterCls: 'warn',
      rows: [
        ['为什么会这样', '目标远小于一个分辨单元时，它的回波会和周围地物混在一个像元里。那个像元变亮，可能来自目标，也可能来自旁边任何东西。'],
        ['第一层为什么会误判', '系统看到“两源在同一像元都变亮”，就判为互相支持。<strong>但“同一像元”在 20 m 尺度上根本不代表“同一物体”。</strong>'],
        ['必须保存', '分辨单元尺寸、目标尺度估计、混合像元比例。<strong>“像素级一致”不等于“目标级一致”。</strong>'],
        ['补什么观测', '换更高分辨率的源（无人机/近场），或改用“区域异常”这种与分辨率匹配的表述，而不是“确认某目标存在”。']
      ],
      human: '人工要判断的是“这个 claim 是否超出了分辨率允许的范围”。这是评估指标定义问题，不是调参问题。'
    },
    noise: {
      title: '⑤ 成像噪声：SAR 斑点噪声造成虚警，光学看是空的',
      gate: 3,
      surface: 'conflicting（一源有、一源无）', surfaceCls: 'bad',
      after: 'needs_human_review', afterCls: 'bad',
      rows: [
        ['为什么会这样', '相干成像天然带斑点噪声（speckle），单视图像上会出现随机亮点；低信噪比区更明显。'],
        ['第一层为什么会误判', '把单视斑点当成目标，就会得到“SAR 有、光学无”的冲突——而真相是<strong>SAR 那条本来就是噪声</strong>。'],
        ['必须保存', '原始单视数据、多视数、滤波方式、检测阈值、检测器版本。<strong>滤波后的图不能当作原始证据。</strong>'],
        ['补什么观测', '多视/多时相平均、相干变化检测、换频段复核；必要时人工在原始数据上判读。']
      ],
      human: '人工要看的是“这个亮点在多视/多时相后还在不在”。<strong>只在单视图上存在的亮点，通常不该进结论。</strong>'
    }
  };
  var brCase = 'time';
  function renderBranches() {
    var c = CASES[brCase];
    var gates = ['时间闸门', '坐标闸门', '对象 / 尺度闸门', '观测质量闸门'];
    var chain = d('d12-br-chain');
    if (chain) {
      chain.innerHTML = gates.map(function (g, i) {
        var cls = i === c.gate ? 'node is-fail' : 'node';
        return '<span class="' + cls + '">' + (i + 1) + ' ' + g + '</span>' +
          (i < gates.length - 1 ? '<span class="arrow">→</span>' : '');
      }).join('');
    }
    var kv = d('d12-br-kv');
    if (kv) {
      kv.innerHTML = '<dt>情景</dt><dd>' + c.title + '</dd>' +
        '<dt>第一层输出</dt><dd><span class="flag ' + (c.surfaceCls === 'bad' ? 'bad' : 'warn') + '">' + c.surface + '</span></dd>' +
        '<dt>复核后输出</dt><dd><span class="flag ' + (c.afterCls === 'bad' ? 'bad' : 'warn') + '">' + c.after + '</span></dd>';
    }
    var lane = d('d12-br-lane');
    if (lane) {
      lane.innerHTML = c.rows.map(function (r, i) {
        return '<div class="role-card' + (i === 1 ? ' is-active' : '') + '"><h4>' + r[0] + '</h4><p>' + r[1] + '</p></div>';
      }).join('');
    }
    var note = d('d12-br-note');
    if (note) {
      note.innerHTML = '<strong>人工复核接口：</strong>' + c.human +
        ' 注意这条流程的顺序：<strong>先质量、再独立性、后一致性、最后语义</strong>。任何一步没过，就输出未知状态，而不是让下游“先用着”。';
    }
  }
  function initBranches() {
    var tabs = d('d12-br-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-case]');
        if (!btn) return;
        brCase = btn.dataset.case;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderBranches();
      });
    }
    renderBranches();
  }

  /* -------------------------------------------------------- 08 vote */
  var vtState = null;
  function drawVote() {
    if (!vtState) return;
    var P = LK.palette();
    var s = vtState, ctx = s.ctx;
    LK.clear(s, P.card);
    var dep = d('d12-vt-dep').checked;

    var cx = s.w / 2;
    var upY = 40, midY = 132;
    var nodes = [
      { key: 'up', x: cx, y: upY, label: '共享上游：任务规划 / 地理底图', w: 250, kind: 'up' },
      { key: 'sar', x: cx - 200, y: midY, label: 'SAR：异常', w: 130, kind: 'has' },
      { key: 'uav', x: cx, y: midY, label: '无人机：异常', w: 130, kind: 'has' },
      { key: 'opt', x: cx + 200, y: midY, label: '光学：云遮挡', w: 130, kind: 'none' }
    ];
    function box(n) {
      var w = n.w, h = 38;
      ctx.fillStyle = n.kind === 'up' ? rgba(P.muted, 0.10) : (n.kind === 'has' ? rgba(P.s1, 0.16) : rgba(P.muted, 0.05));
      ctx.strokeStyle = n.kind === 'has' ? P.s1 : P.border;
      ctx.lineWidth = n.kind === 'has' ? 1.8 : 1.2;
      if (n.kind === 'none') ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(n.x - w / 2, n.y - h / 2, w, h, 8);
      else ctx.rect(n.x - w / 2, n.y - h / 2, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      LK.label(ctx, n.label, n.x, n.y, n.kind === 'has' ? P.fg : P.muted, 11, 'center');
    }
    function line(x1, y1, x2, y2, color, dashed, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1.3;
      if (dashed) ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
    }
    line(nodes[0].x, upY + 19, nodes[1].x, midY - 19, rgba(P.muted, 0.5), false);
    line(nodes[0].x, upY + 19, nodes[3].x, midY - 19, rgba(P.muted, 0.22), false);
    if (dep) {
      /* correlated: SAR -> UAV planning, drawn as a labelled straight link */
      line(nodes[1].x + 65, midY + 30, nodes[2].x - 65, midY + 30, P.bad, true, 2);
      LK.arrow(ctx, nodes[2].x - 70, midY + 30, nodes[2].x - 63, midY + 30, P.bad, 1.6);
      LK.label(ctx, '按 SAR 异常点规划航线 → 相关误差', cx, midY + 44, P.bad, 10, 'center');
    } else {
      line(nodes[0].x, upY + 19, nodes[2].x, midY - 19, rgba(P.muted, 0.5), false);
    }
    nodes.forEach(box);

    /* merge result row */
    var my = midY + 82;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(40, my - 22); ctx.lineTo(s.w - 40, my - 22); ctx.stroke();
    ctx.setLineDash([]);
    LK.label(ctx, '合并共享上游之后，图里还剩几条独立路径？', 44, my - 34, P.muted, 10, 'left');
    var merged = dep
      ? [{ t: '节点 A：SAR + 无人机（视为 1 条）', x: cx - 130, k: 'one' }, { t: '节点 B：光学（无效观察，权重 0）', x: cx + 130, k: 'none' }]
      : [{ t: '节点 A：SAR', x: cx - 190, k: 'has' }, { t: '节点 B：无人机（独立）', x: cx, k: 'has' }, { t: '节点 C：光学（无效）', x: cx + 190, k: 'none' }];
    merged.forEach(function (m) {
      var w = 176, h = 34;
      ctx.fillStyle = m.k === 'none' ? rgba(P.muted, 0.05) : rgba(P.s1, 0.12);
      ctx.strokeStyle = m.k === 'none' ? P.border : P.s1;
      ctx.lineWidth = 1.2;
      if (m.k === 'none') ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(m.x - w / 2, my - 17, w, h, 8);
      else ctx.rect(m.x - w / 2, my - 17, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      LK.label(ctx, m.t, m.x, my, m.k === 'none' ? P.muted : P.fg, 10, 'center');
    });
    LK.label(ctx, '独立证据 ' + (dep ? 1 : 2) + ' 条 → ' + (dep ? 'needs_human_review' : 'aligned_and_supported'),
      cx, my + 30, dep ? P.bad : P.s1, 11, 'center');

    var votes = '2 有 / 0 无 / 1 无效';
    var indep = dep ? 1 : 2;
    var out = dep ? 'needs_human_review' : 'aligned_and_supported';
    LK.text('d12-vt-vote', votes);
    LK.text('d12-vt-indep', String(indep));
    LK.text('d12-vt-out', out);

    var note = d('d12-vt-note');
    if (note) {
      if (dep) {
        note.innerHTML = '开关打开时：无人机的航线是<strong>按 SAR 的异常点</strong>规划的，所以“它也看到了异常”这件事，有一部分是上游决定的。' +
          '统计上这叫<strong>相关误差</strong>——两条证据<strong>会一起错</strong>。票面 2:0 看起来无可争议，但有效独立证据只有 <strong>1</strong> 条，正确输出是 <code>needs_human_review</code>。' +
          '<strong>换个说法：这不是两个人在不同地方各自看到了同一件事，而是同一个人看了一遍，又派人去他指的地方看了一下。</strong>';
      } else {
        note.innerHTML = '开关关闭时：无人机独立巡线、恰好也看到了异常，光学那次仍是无效观测。这时独立证据数 = <strong>2</strong>（机制与平台都不同），才可以升级为 <code>aligned_and_supported</code>——但仍然要抽检，因为两条证据都来自同一类“成像异常”，语义仍是未知。' +
          '<strong>注意：结论的变化来自“独立性”，不是来自“票数”。</strong>';
      }
    }
  }

  function initVote() {
    var s = LK.canvas('d12-vt-canvas', 290);
    if (!s) return;
    vtState = s;
    s.onresize = drawVote;
    var cb = d('d12-vt-dep');
    if (cb) cb.addEventListener('change', drawVote);
    redraws.push(drawVote);
    drawVote();
  }

  /* -------------------------------------------------------- 09 exam */
  function calcExam() {
    var n = 0;
    for (var i = 1; i <= 6; i++) {
      var el = d('d12-ex-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d12-ex-count', n + ' / 6');
    var lvl = d('d12-ex-level');
    if (lvl) {
      lvl.textContent = n >= 6 ? '完整答卷' : (n >= 4 ? '接近完整' : (n >= 2 ? '骨架成形' : '未开始'));
    }
  }
  function initExam() {
    for (var i = 1; i <= 6; i++) {
      var el = d('d12-ex-' + i);
      if (el) el.addEventListener('change', calcExam);
    }
    calcExam();
  }

  /* ------------------------------------------------------- 10 score */
  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d12-sc-' + i);
      var v = el ? parseInt(el.value, 10) : 0;
      var out = d('d12-sc-' + i + '-out');
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d12-sc-total', total + ' / 20');
    var tip = d('d12-sc-tip');
    if (tip) tip.textContent = total >= 17 ? '可以上场' : (total >= 12 ? '补验证与真实性' : (total >= 7 ? '先推 D/2' : '回到第 02 节'));
    var note = d('d12-sc-selfnote');
    if (note) {
      if (total >= 17) {
        note.innerHTML = '现在最该练的不是知识，是<strong>在被追问“就这些？”时不慌</strong>：准备三个“我不知道，但我知道怎么验证”的答案，比多背三个结论有用。';
      } else if (total >= 12) {
        note.innerHTML = '典型状态：能讲原理、能画流程，但没有一次真实的坐标对齐。<strong>最低成本的补法：下载一对 Sentinel-1 GRD 与同日光学影像，自己做正射 + 叠图，量残差。</strong>数据免费，一次就够。';
      } else {
        note.innerHTML = '先把第 02 节的 <code>δa = D/2</code> 推一遍（注意 R 怎么被消掉），再把第 03 节的 <code>h·cotθ</code> 与 <code>h·tanθ</code> 各算一个数。<strong>这两个式子一算，这一页的骨架就立起来了。</strong>';
      }
    }
  }
  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d12-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  /* ---------------------------------------------------------- boot */
  function boot() {
    initScale();
    initAperture();
    initSide();
    initMech();
    initTime();
    initEvidence();
    initBranches();
    initVote();
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
