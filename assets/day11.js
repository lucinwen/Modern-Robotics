/* Day 11 — FMCW mmWave, micro-motion, risk closure. Vanilla, offline, synthetic only. */
(function () {
  'use strict';

  var C = 3e8;            /* speed of light, m/s */
  var LAMBDA = 0.005;     /* 60 GHz -> 5 mm */
  var T_CHIRP = 40e-6;    /* 40 us sweep */

  var redraws = [];
  function d(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function fixed(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }
  function hash(i) { return (Math.sin(i * 12.9898) * 43758.5453) % 1; }

  function hexRgb(hex) {
    var h = (hex || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  /* ------------------------------------------------------------ 01 chains */
  var CHAINS = {
    mmwave: {
      title: '毫米波雷达（FMCW）',
      rows: [
        ['测量值', '拍频 → 距离；距离单元相位的实部/虚部；RSSI。单位：m / rad / dB'],
        ['推断状态', '“这个距离单元在以约 4 秒的周期做微动”→ 呼吸周期趋势；“有一个零速目标在场”→ 有人'],
        ['不能做什么', '不能给出 CO₂ 浓度；不能在多人时把相位分配给某个人；不能声称心率准确度'],
        ['边界句', '我输出的是“有条件的微动趋势”，不是生命体征诊断。']
      ]
    },
    co2: {
      title: 'CO₂ 传感器（NDIR）',
      rows: [
        ['测量值', '某波长红外吸收量 → 换算成 ppm（百万分之一体积比）'],
        ['推断状态', '“浓度在 40 分钟内从 600 升到 1400 ppm”→ 房间通风不足；“夜间持续偏高”→ 可能门窗紧闭'],
        ['不能做什么', '不能判断是谁在里面；不能测呼吸频率；单点浓度不能代表全屋；传感器本身会漂移，需要基线校准'],
        ['边界句', 'CO₂ 是空气质量量，不是人体状态量；它只能作为“有人且不通风”的间接线索。']
      ]
    },
    voice: {
      title: '语音助手（ASR + 对话）',
      rows: [
        ['测量值', '音频波形 → 文本；话轮边界（VAD/端点检测）；响应时延'],
        ['推断状态', '“用户说了一句完整的话”“用户在 2 秒内没有继续”→ 可以回话；“语调偏低/语速变慢”→ 可能情绪低落（极弱证据）'],
        ['不能做什么', '不能通过声音诊断抑郁或疾病；嘈杂环境下文本会错；打断与抢占需要额外状态机，不是 ASR 的职责'],
        ['边界句', '语音给的是“内容和意图的线索”，不是生理量。']
      ]
    }
  };

  var chainKey = 'mmwave';

  function renderChain() {
    var host = d('d11-ch-body');
    if (!host) return;
    var data = CHAINS[chainKey];
    host.innerHTML = '';
    data.rows.forEach(function (row) {
      var div = document.createElement('div');
      div.className = 'cond-row';
      var a = document.createElement('span');
      a.textContent = row[0];
      var b = document.createElement('span');
      b.textContent = row[1];
      div.appendChild(a);
      div.appendChild(b);
      host.appendChild(div);
    });
    var note = d('d11-ch-note');
    if (note) {
      note.innerHTML = '四行按「测量值 → 推断状态 → 不能做什么 → 边界句」排列。' +
        '三层分开标完之后，“我们能感知老人状态”这句话会自动裂成三句更小、更真的话。<strong>能说清“不能做什么”的那一句，才是可以被追问的。</strong>';
    }
  }

  function initChain() {
    var tabs = d('d11-ch-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-chain]');
      if (!btn) return;
      chainKey = btn.dataset.chain;
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderChain();
    });
    renderChain();
  }

  /* ------------------------------------------------------------- 02 chirp */
  var chirpState = null;

  function drawChirp() {
    if (!chirpState) return;
    var P = LK.palette();
    var s = chirpState;
    var R = parseFloat(d('d11-c-r').value);
    var S = parseFloat(d('d11-c-s').value) * 1e12;
    var tau = 2 * R / C;
    var fb = S * tau;
    var B = S * T_CHIRP;

    LK.text('d11-c-r-out', fixed(R, 1) + ' m');
    LK.text('d11-c-s-out', fixed(S / 1e12, 0) + ' THz/s');
    LK.text('d11-c-tau', tau * 1e9 < 1000 ? fixed(tau * 1e9, 0) + ' ns' : fixed(tau * 1e6, 2) + ' µs');
    LK.text('d11-c-fb', fb >= 1e6 ? fixed(fb / 1e6, 2) + ' MHz' : fixed(fb / 1e3, 0) + ' kHz');
    LK.text('d11-c-ratio', fixed(tau / T_CHIRP * 100, 2) + ' %');

    var note = d('d11-c-note');
    if (note) {
      note.innerHTML = '图中回波的延迟被<strong>放大约 ' + 70 + ' 倍</strong>才画得出来（真实比值只有 ' +
        fixed(tau / T_CHIRP * 100, 2) + '%）；两条线的垂直间距也按拍频缩放显示。' +
        '带宽 B = S·T = ' + fixed(B / 1e6, 0) + ' MHz，对应距离分辨率 ΔR = c/2B = ' + fixed(C / (2 * B) * 100, 1) + ' cm。';
    }

    var ctx = s.ctx;
    LK.clear(s, P.card);
    var mL = 52, mR = 18, mT = 26, mB = 40;
    var w = s.w - mL - mR, h = s.h - mT - mB;

    /* grid */
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (var gy = 0; gy <= 4; gy++) {
      var y = mT + h * gy / 4;
      ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(mL + w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* time axis: 1.14 T */
    var tMax = 1.14 * T_CHIRP;
    function X(t) { return mL + (t / tMax) * w; }
    function Y(level) { return mT + h * (1 - level); }

    /* TX ramp 0 -> A, RX ramp gap -> gap+A, so the vertical gap IS the beat (scaled) */
    var RDISP = 70;
    var tShift = tau * RDISP;
    var gap = clamp(fb / 1.1e6, 0.07, 0.46);
    var A = 1 - gap;
    var txColor = P.s1;
    ctx.strokeStyle = txColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(T_CHIRP), Y(A));
    ctx.stroke();

    var rxColor = P.s2;
    ctx.strokeStyle = rxColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(X(tShift), Y(gap));
    ctx.lineTo(X(T_CHIRP + tShift), Y(gap + A));
    ctx.stroke();

    /* vertical gap at t = 0.78 T, computed on both lines */
    var tm = 0.78 * T_CHIRP;
    var lvlTX = A * tm / T_CHIRP;
    var lvlRX = gap + A * (tm - tShift) / T_CHIRP;
    var yTop = Y(lvlRX), yBot = Y(lvlTX);
    ctx.strokeStyle = P.fg;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(X(tm), yTop); ctx.lineTo(X(tm), yBot); ctx.stroke();
    ctx.setLineDash([]);
    LK.arrow(ctx, X(tm), yBot, X(tm), yTop, P.fg, 1.4);
    LK.arrow(ctx, X(tm), yTop, X(tm), yBot, P.fg, 1.4);
    LK.label(ctx, 'f_b = S·τ', X(tm) + 10, (yTop + yBot) / 2 - 9, P.fg, 12, 'left');
    LK.label(ctx, '（垂直间距已放大）', X(tm) + 10, (yTop + yBot) / 2 + 7, P.muted, 10, 'left');

    /* legend */
    LK.label(ctx, '● 发射', mL + 4, mT - 10, txColor, 12, 'left');
    LK.label(ctx, '● 回波', mL + 66, mT - 10, rxColor, 12, 'left');
    LK.label(ctx, '纵轴：相对频率（间距已放大）', s.w - mR, mT - 10, P.muted, 11, 'right');

    /* axis lines */
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    LK.label(ctx, '时间 t（一个 chirp 的时长记为 T）', mL + w / 2, mT + h + 26, P.muted, 11, 'center');
    ctx.strokeStyle = P.border;
    ctx.beginPath(); ctx.moveTo(X(T_CHIRP), mT + h); ctx.lineTo(X(T_CHIRP), mT + h + 5); ctx.stroke();
    LK.label(ctx, 'T', X(T_CHIRP), mT + h + 14, P.muted, 11, 'center');
  }

  function initChirp() {
    var s = LK.canvas('d11-c-canvas', 300);
    if (!s) return;
    chirpState = s;
    s.onresize = drawChirp;
    d('d11-c-r').addEventListener('input', drawChirp);
    d('d11-c-s').addEventListener('input', drawChirp);
    redraws.push(drawChirp);
    drawChirp();
  }

  /* --------------------------------------------------------------- 03 fft */
  var fftState = null;

  function drawFft() {
    if (!fftState) return;
    var P = LK.palette();
    var s = fftState;
    var B = parseFloat(d('d11-f-b').value) * 1e6;
    var sep = parseFloat(d('d11-f-sep').value);
    var S = B / T_CHIRP;
    var dR = C / (2 * B);
    var R1 = 3.0, R2 = 3.0 + sep;

    LK.text('d11-f-b-out', fixed(B / 1e9, 2) + ' GHz');
    LK.text('d11-f-sep-out', fixed(sep, 2) + ' m');
    LK.text('d11-f-dres', dR * 100 < 10 ? fixed(dR * 100, 1) + ' cm' : fixed(dR * 100, 1) + ' cm');
    LK.text('d11-f-fb', fixed(2 * S * 3.0 / C / 1e6, 2) + ' MHz');

    var ok = sep >= dR;
    var verdict = d('d11-f-verdict');
    if (verdict) {
      verdict.textContent = ok ? '能分开' : '合成一根胖峰';
      verdict.className = ok ? 'ok' : 'bad';
    }
    var note = d('d11-f-note');
    if (note) {
      note.innerHTML = ok
        ? '间距 ' + fixed(sep, 2) + ' m ≥ ΔR ' + fixed(dR * 100, 1) + ' cm，两个峰分开。<strong>注意 f_b 同时变了</strong>：带宽变宽 → 斜率变陡 → 同一个距离的拍频变高，但距离轴的读数不变。'
        : '间距 ' + fixed(sep, 2) + ' m < ΔR ' + fixed(dR * 100, 1) + ' cm，两个目标落进同一个分辨单元，频谱上只剩一根被抬高的胖峰。<strong>再加算法也分不开</strong>——信息在带宽里，不在后处理里。';
    }

    var ctx = s.ctx;
    LK.clear(s, P.card);
    var mL = 52, mR = 16, mT = 22, mB = 38;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var R0 = 2.0, R9 = 5.6;
    function X(r) { return mL + (r - R0) / (R9 - R0) * w; }

    /* grid */
    ctx.strokeStyle = P.grid;
    ctx.globalAlpha = 0.5;
    for (var i = 0; i <= 6; i++) {
      var gx = mL + w * i / 6;
      ctx.beginPath(); ctx.moveTo(gx, mT); ctx.lineTo(gx, mT + h); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* resolve cells */
    var cellPx = dR / (R9 - R0) * w;
    ctx.fillStyle = P.grid;
    ctx.globalAlpha = 0.35;
    for (var r = R0; r < R9; r += 2 * dR) {
      ctx.fillRect(X(r), mT, Math.max(1, cellPx - 1), h);
    }
    ctx.globalAlpha = 1;

    /* spectrum */
    function sinc(x) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }
    var pts = [];
    var N = 520;
    for (var k = 0; k <= N; k++) {
      var rr = R0 + (R9 - R0) * k / N;
      var v = Math.abs(sinc((rr - R1) / dR)) + Math.abs(sinc((rr - R2) / dR));
      v += 0.035 * (0.5 + 0.5 * hash(k * 3.7));
      pts.push([X(rr), mT + h - clamp(v, 0, 1.25) / 1.25 * h]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], mT + h);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(pts[pts.length - 1][0], mT + h);
    ctx.closePath();
    ctx.fillStyle = P.primary;
    ctx.globalAlpha = 0.14;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    pts.forEach(function (p, idx) { if (idx === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
    ctx.strokeStyle = P.primary;
    ctx.lineWidth = 1.9;
    ctx.stroke();

    /* target markers */
    [[R1, 'R₁'], [R2, 'R₂']].forEach(function (t) {
      ctx.strokeStyle = P.s2;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(t[0]), mT); ctx.lineTo(X(t[0]), mT + h); ctx.stroke();
      ctx.setLineDash([]);
      LK.label(ctx, t[1], X(t[0]), mT + 9, P.s2, 11, 'center');
    });

    /* axis */
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    LK.label(ctx, '距离 R（m）', mL + w / 2, mT + h + 26, P.muted, 12, 'center');
    LK.label(ctx, '|FFT|', mL - 8, mT + 8, P.muted, 11, 'right');
    [2, 3, 4, 5].forEach(function (v2) {
      LK.label(ctx, String(v2), X(v2), mT + h + 12, P.muted, 10, 'center');
    });

    /* legend */
    LK.label(ctx, '▮ 一个分辨单元 ΔR = c/2B', mL + w, mT + h + 26, P.muted, 11, 'right');
  }

  function initFft() {
    var s = LK.canvas('d11-f-canvas', 280);
    if (!s) return;
    fftState = s;
    s.onresize = drawFft;
    d('d11-f-b').addEventListener('input', drawFft);
    d('d11-f-sep').addEventListener('input', drawFft);
    redraws.push(drawFft);
    drawFft();
  }

  /* -------------------------------------------------------------- 04 phase */
  var phaseState = null;

  function drawPhase() {
    if (!phaseState) return;
    var P = LK.palette();
    var s = phaseState;
    var bpm = parseFloat(d('d11-p-rate').value);
    var ampMm = parseFloat(d('d11-p-amp').value);
    var dist = parseFloat(d('d11-p-dist').value);
    var noise0 = parseFloat(d('d11-p-noise').value);
    var f = bpm / 60;
    var Tp = 1 / f;
    var ampM = ampMm * 1e-3;

    var pp = 4 * Math.PI * ampM / LAMBDA;
    var sens = 4 * Math.PI / LAMBDA;
    LK.text('d11-p-rate-out', bpm + ' 次/分');
    LK.text('d11-p-amp-out', fixed(ampMm, 1) + ' mm');
    LK.text('d11-p-dist-out', fixed(dist, 1) + ' m');
    LK.text('d11-p-noise-out', fixed(noise0, 2) + ' rad');
    LK.text('d11-p-pp', fixed(pp, 2) + ' rad');
    LK.text('d11-p-deg', fixed(pp * 180 / Math.PI, 0) + '°');
    LK.text('d11-p-sens', Math.round(sens) + ' rad/m');

    /* phase noise grows with range^2 (received power ~ 1/R^4) */
    var sigma = noise0 + 0.03 * Math.max(0, dist * dist - 0.25);
    var ratio = sigma / Math.max(0.15, pp);
    var snrEl = d('d11-p-snr');
    if (snrEl) {
      if (ratio < 0.08) { snrEl.textContent = '充足'; snrEl.className = 'ok'; }
      else if (ratio < 0.25) { snrEl.textContent = '边缘'; snrEl.className = 'warn'; }
      else { snrEl.textContent = '不可用'; snrEl.className = 'bad'; }
    }
    var note = d('d11-p-note');
    if (note) {
      note.innerHTML = '相位噪声按 <strong>σ ∝ R²</strong> 增长（回波功率 ∝ 1/R⁴，相位噪声 ∝ 1/√功率），所以同一个人走远两步就会从“充足”掉到“边缘”。' +
        '位移峰峰值 ' + fixed(ampMm, 1) + ' mm 对应 ' + fixed(pp, 2) + ' rad，即 ' + fixed(pp * 180 / Math.PI, 0) + '°；' +
        '而 λ/4 = 1.25 mm 就会让相位绕一圈——<strong>本图全程要 wrap ' + Math.floor(ampMm / 2.5) + ' 次以上</strong>。';
    }

    var ctx = s.ctx;
    LK.clear(s, P.card);
    var mL = 56, mR = 16, mT = 12, mB = 30;
    var w = s.w - mL - mR;
    var totalH = s.h - mT - mB;
    var head = 16;
    var panelH = (totalH - 3 * head) / 3;
    var tMax = Math.min(14, Math.max(6, Tp * 3.2));

    function X(t) { return mL + t / tMax * w; }
    function noiseAt(t, seed) {
      return sigma * (0.52 * Math.sin(t * 17.3 + seed) +
        0.31 * Math.sin(t * 31.7 + 1.1 + seed) +
        0.17 * Math.sin(t * 53.9 + 2.3 + seed));
    }
    function panel(idx, title, note) {
      var top = mT + idx * (panelH + head);
      LK.label(ctx, title, mL, top + 6, P.muted, 11, 'left');
      if (note) LK.label(ctx, note, mL + w, top + 6, P.muted, 10, 'right');
      var y0 = top + head;
      ctx.strokeStyle = P.grid;
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(mL, y0, w, panelH);
      ctx.globalAlpha = 1;
      return y0;
    }

    /* panel 1: displacement */
    var y1 = panel(0, '① 胸壁位移 ΔR(t)　单位 mm', '虚线 = ±λ/4 = ±1.25 mm，越界就绕一圈');
    var maxMm = Math.max(ampMm * 0.6, 0.35);
    /* unambiguous band */
    var bandHalf = Math.min(1.25, maxMm) / maxMm * (panelH / 2 - 6);
    ctx.fillStyle = P.s2;
    ctx.globalAlpha = 0.10;
    ctx.fillRect(mL, y1 + panelH / 2 - bandHalf, w, bandHalf * 2);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (var i = 0; i <= 420; i++) {
      var t = tMax * i / 420;
      var v = (ampM / 2) * Math.sin(2 * Math.PI * f * t) * 1000;
      var yy = y1 + panelH / 2 - v / maxMm * (panelH / 2 - 6);
      if (i === 0) ctx.moveTo(X(t), yy); else ctx.lineTo(X(t), yy);
    }
    ctx.strokeStyle = P.s3;
    ctx.lineWidth = 2;
    ctx.stroke();
    /* +/- lambda/4 lines */
    [-1, 1].forEach(function (sgn) {
      var lvl = sgn * 1.25;
      if (Math.abs(lvl) > maxMm) return;
      var yv = y1 + panelH / 2 - lvl / maxMm * (panelH / 2 - 6);
      ctx.strokeStyle = P.s2;
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(mL, yv); ctx.lineTo(mL + w, yv); ctx.stroke();
      ctx.setLineDash([]);
    });

    /* panel 2: unwrapped phase */
    var y2 = panel(1, '② 解缠相位 φ(t)　单位 rad（含相位噪声）',
      '峰峰 ' + fixed(pp, 2) + ' rad ≈ ' + fixed(pp * 180 / Math.PI, 0) + '°');
    var maxPhi = Math.max(pp * 0.6, 0.4);
    ctx.beginPath();
    for (var j = 0; j <= 420; j++) {
      var t2 = tMax * j / 420;
      var phi = 4 * Math.PI * (ampM / 2) * Math.sin(2 * Math.PI * f * t2) / LAMBDA + noiseAt(t2, 0);
      var yy2 = y2 + panelH / 2 - phi / maxPhi * (panelH / 2 - 6);
      yy2 = clamp(yy2, y2 + 2, y2 + panelH - 2);
      if (j === 0) ctx.moveTo(X(t2), yy2); else ctx.lineTo(X(t2), yy2);
    }
    ctx.strokeStyle = P.s1;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    /* panel 3: wrapped phase (noise-free, so the wrapping structure is legible) */
    var y3 = panel(2, '③ 缠绕后的相位　单位 rad（接收机真正看到的，此处不含噪声）', '锯齿 = 每越界一次绕一圈');
    var N3 = 3000;
    ctx.strokeStyle = P.s4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    var prevY = null;
    var prevW = null;
    var pen = false;
    for (var m = 0; m <= N3; m++) {
      var t3 = tMax * m / N3;
      var raw = 4 * Math.PI * (ampM / 2) * Math.sin(2 * Math.PI * f * t3) / LAMBDA;
      var wr = Math.atan2(Math.sin(raw), Math.cos(raw));
      var yy3 = y3 + panelH / 2 - wr / Math.PI * (panelH / 2 - 6);
      if (prevW === null) { ctx.moveTo(X(t3), yy3); pen = true; }
      else if (Math.abs(wr - prevW) > Math.PI) {
        /* draw the discontinuity as a crisp vertical jump, then continue */
        if (pen) ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(X(t3), prevY);
        ctx.lineTo(X(t3), yy3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(X(t3), yy3);
        pen = true;
      } else {
        ctx.lineTo(X(t3), yy3);
      }
      prevW = wr;
      prevY = yy3;
    }
    ctx.strokeStyle = P.s4;
    ctx.lineWidth = 2;
    ctx.stroke();
    [-Math.PI, 0, Math.PI].forEach(function (v3) {
      var yv2 = y3 + panelH / 2 - v3 / Math.PI * (panelH / 2 - 6);
      LK.label(ctx, v3 === 0 ? '0' : (v3 > 0 ? '+π' : '−π'), mL - 8, yv2, P.muted, 10, 'right');
    });

    LK.label(ctx, '0 s', mL, s.h - 10, P.muted, 10, 'center');
    LK.label(ctx, '时间 t（s）', mL + w / 2, s.h - 10, P.muted, 11, 'center');
    LK.label(ctx, fixed(tMax, 1) + ' s', mL + w, s.h - 10, P.muted, 10, 'right');
  }

  function initPhase() {
    var s = LK.canvas('d11-p-canvas', 400);
    if (!s) return;
    phaseState = s;
    s.onresize = drawPhase;
    ['d11-p-rate', 'd11-p-amp', 'd11-p-dist', 'd11-p-noise'].forEach(function (id) {
      d(id).addEventListener('input', drawPhase);
    });
    redraws.push(drawPhase);
    drawPhase();
  }

  /* ------------------------------------------------------------ 05 doppler */
  var dopplerState = null;
  var dopplerScene = 'sit';
  var SCENES = {
    sit: {
      blobs: [
        { r: 1.7, v: 0.0, rw: 0.10, vw: 0.030, a: 0.95 },
        { r: 0.55, v: 0.0, rw: 0.05, vw: 0.020, a: 0.55 },
        { r: 5.4, v: 0.0, rw: 0.07, vw: 0.020, a: 0.35 }
      ],
      verdict: '可以', cls: 'ok',
      note: '静坐时能量集中在零速附近一小团，呼吸带来的微动让它在速度轴上有一点点“厚度”。<strong>这一小团厚度就是你要的相位信号所在</strong>。墙（5.4 m）和近处杂波也在零速上，但距离不同，可以按距离单元分开。'
    },
    walk: {
      blobs: [
        { r: 3.3, v: 1.05, rw: 0.34, vw: 0.22, a: 0.95 },
        { r: 0.5, v: 0.0, rw: 0.06, vw: 0.03, a: 0.5 },
        { r: 5.4, v: 0.0, rw: 0.08, vw: 0.02, a: 0.4 }
      ],
      verdict: '可以（但测不到呼吸）', cls: 'warn',
      note: '走动的人是一条明显的非零速亮斑，可以判断“有人且移动”。但身体速度把呼吸微动完全淹没——<strong>走动时无法同时测呼吸是物理约束，不是算法不够好</strong>。'
    },
    crowd: {
      blobs: [
        { r: 1.2, v: 0.02, rw: 0.10, vw: 0.03, a: 0.9 },
        { r: 2.6, v: -0.03, rw: 0.11, vw: 0.03, a: 0.85 },
        { r: 3.9, v: -0.95, rw: 0.30, vw: 0.20, a: 0.9 },
        { r: 4.6, v: 0.62, rw: 0.16, vw: 0.10, a: 0.45 }
      ],
      verdict: '不能分配到人', cls: 'bad',
      note: '三团亮斑 + 一团多径“鬼影”（4.6 m，通常是金属家具的反射）。距离接近的两个人，其相位在同一个距离单元里已经叠在一起——<strong>“三个亮斑”不等于“三个人”，更不等于“这是张阿姨”</strong>。'
    }
  };

  function drawDoppler() {
    if (!dopplerState) return;
    var P = LK.palette();
    var s = dopplerState;
    var scene = SCENES[dopplerScene];
    var ctx = s.ctx;
    LK.clear(s, P.card);

    var mL = 62, mR = 92, mT = 24, mB = 42;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var VMAX = 1.9;
    var cell = 4;
    var cols = Math.floor(w / cell), rows = Math.floor(h / cell);

    /* heat: render low-res then scale up smoothly (continuous look, no cell gaps) */
    var off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    var octx = off.getContext('2d');
    var img = octx.createImageData(cols, rows);
    /* single-hue ramp: card white -> mid green -> deep teal, so weak returns stay visible */
    var cBase = hexRgb(P.card), cMid = mixRgb(hexRgb(P.card), hexRgb(P.s1), 0.42), cStrong = hexRgb(P.s1);
    for (var ix = 0; ix < cols; ix++) {
      var rr = 6 * (ix + 0.5) / cols;
      for (var iy = 0; iy < rows; iy++) {
        var vv = VMAX * (1 - 2 * (iy + 0.5) / rows);
        var val = 0;
        for (var bi = 0; bi < scene.blobs.length; bi++) {
          var b = scene.blobs[bi];
          var dr = (rr - b.r) / Math.max(b.rw, 0.09);
          var dv = (vv - b.v) / Math.max(b.vw, 0.06);
          val += b.a * Math.exp(-(dr * dr + dv * dv) * 1.35);
        }
        if (val <= 0.006) continue;
        val = clamp(val, 0, 1);
        var tv = Math.pow(val, 0.72);
        var col = tv < 0.5
          ? mixRgb(cBase, cMid, tv / 0.5)
          : mixRgb(cMid, cStrong, (tv - 0.5) / 0.5);
        var p4 = (iy * cols + ix) * 4;
        img.data[p4] = col[0];
        img.data[p4 + 1] = col[1];
        img.data[p4 + 2] = col[2];
        img.data[p4 + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, mL, mT, w, h);

    /* axes */
    ctx.strokeStyle = P.grid;
    ctx.globalAlpha = 0.6;
    for (var gx = 0; gx <= 6; gx++) {
      var gxp = mL + gx / 6 * w;
      ctx.beginPath(); ctx.moveTo(gxp, mT); ctx.lineTo(gxp, mT + h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    ctx.strokeStyle = P.fg;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(mL, mT + h / 2); ctx.lineTo(mL + w, mT + h / 2); ctx.stroke();
    ctx.globalAlpha = 1;
    LK.label(ctx, '0', mL - 8, mT + h / 2, P.muted, 10, 'right');
    LK.label(ctx, '+1.9', mL - 8, mT + 6, P.muted, 10, 'right');
    LK.label(ctx, '−1.9', mL - 8, mT + h - 6, P.muted, 10, 'right');
    LK.label(ctx, '径向速度 v（m/s）', mL, mT - 10, P.muted, 10, 'left');
    for (var rv = 0; rv <= 6; rv++) {
      LK.label(ctx, String(rv), mL + rv / 6 * w, mT + h + 14, P.muted, 10, 'center');
    }
    LK.label(ctx, '距离 R（m）', mL + w / 2, mT + h + 30, P.muted, 11, 'center');

    /* colour bar */
    var bx = mL + w + 26, by = mT, bh = h;
    for (var q = 0; q < 48; q++) {
      var tq = 1 - q / 47;
      var colq = tq < 0.5 ? mixRgb(cBase, cMid, tq / 0.5) : mixRgb(cMid, cStrong, (tq - 0.5) / 0.5);
      ctx.fillStyle = 'rgb(' + colq[0] + ',' + colq[1] + ',' + colq[2] + ')';
      ctx.fillRect(bx, by + bh * q / 48, 14, bh / 48 + 0.8);
    }
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, 14, bh);
    LK.label(ctx, '强', bx + 20, by + 6, P.muted, 10, 'left');
    LK.label(ctx, '弱', bx + 20, by + bh - 6, P.muted, 10, 'left');
    LK.label(ctx, '回波强度 |S|', bx + 7, mT - 12, P.muted, 10, 'center');

    var verdict = d('d11-d-verdict');
    if (verdict) { verdict.textContent = scene.verdict; verdict.className = scene.cls; }
    var note = d('d11-d-note');
    if (note) note.innerHTML = scene.note;
  }

  function initDoppler() {
    var s = LK.canvas('d11-d-canvas', 320);
    if (!s) return;
    dopplerState = s;
    s.onresize = drawDoppler;
    var tabs = d('d11-d-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-scene]');
        if (!btn) return;
        dopplerScene = btn.dataset.scene;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        drawDoppler();
      });
    }
    redraws.push(drawDoppler);
    drawDoppler();
  }

  /* -------------------------------------------------------------- 06 synth */
  var synthState = null;
  var synthKind = 'clean';

  function genSignal(kind, win, Tp) {
    var n = Math.round(win * 50);
    var arr = [];
    for (var i = 0; i < n; i++) {
      var t = win * i / n;
      var v = Math.sin(2 * Math.PI * t / Tp);
      if (kind === 'clean') {
        v += 0.04 * hash(i * 0.77);
      } else if (kind === 'motion') {
        /* 转身/起身：一个幅度远超呼吸的慢分量 + 一次阶跃 */
        var t0 = 0.45 * win;
        v += 2.2 * Math.sin(2 * Math.PI * t / (2.6 * Tp) + 0.6);
        if (t > t0) v -= 0.9;
        v += 0.05 * hash(i * 0.77);
      } else {
        v += 0.75 * Math.sin(2 * Math.PI * t / (Tp * 0.71) + 1.1);
        v += 0.04 * hash(i * 0.77);
      }
      arr.push(v);
    }
    return arr;
  }

  function smooth(arr, win) {
    var out = [];
    var half = Math.max(1, Math.round(win / 2));
    for (var i = 0; i < arr.length; i++) {
      var sum = 0, n = 0;
      for (var k = -half; k <= half; k++) {
        var idx = i + k;
        if (idx >= 0 && idx < arr.length) { sum += arr[idx]; n++; }
      }
      out.push(sum / n);
    }
    return out;
  }

  function detectPeaks(arr, minGap) {
    var a = smooth(arr, 11);
    var mx = -1e9, mn = 1e9;
    a.forEach(function (v) { if (v > mx) mx = v; if (v < mn) mn = v; });
    var thr = mn + 0.5 * (mx - mn);
    var peaks = [];
    var lastIdx = -1e9;
    for (var i = 1; i < a.length - 1; i++) {
      if (a[i] > a[i - 1] && a[i] >= a[i + 1] && a[i] > thr) {
        if (i - lastIdx >= (minGap || 6)) { peaks.push(i); lastIdx = i; }
      }
    }
    return peaks;
  }

  function drawSynth() {
    if (!synthState) return;
    var P = LK.palette();
    var s = synthState;
    var win = parseFloat(d('d11-s-win').value);
    var bpm = parseFloat(d('d11-s-rate').value);
    var Tp = 60 / bpm;
    LK.text('d11-s-win-out', fixed(win, 0) + ' s');
    LK.text('d11-s-rate-out', bpm + ' 次/分');

    var arr = genSignal(synthKind, win, Tp);
    var samplesPerSec = arr.length / win;
    var peaks = detectPeaks(arr, Math.round(Math.max(0.75, Tp * 0.4) * samplesPerSec));
    var diffs = [];
    for (var i = 1; i < peaks.length; i++) diffs.push((peaks[i] - peaks[i - 1]) * win / arr.length);
    diffs.sort(function (a, b) { return a - b; });
    var est = diffs.length ? diffs[Math.floor(diffs.length / 2)] : NaN;
    var err = isFinite(est) ? Math.abs(est - Tp) / Tp : 1;

    LK.text('d11-s-truth', fixed(Tp, 2) + ' s');
    LK.text('d11-s-est', isFinite(est) ? fixed(est, 2) + ' s' : '—');
    LK.text('d11-s-err', isFinite(est) ? fixed(err * 100, 1) + ' %' : '—');

    var vEl = d('d11-s-verdict');
    var vTxt, vCls;
    if (!isFinite(est) || peaks.length < 2) { vTxt = '不可用'; vCls = 'bad'; }
    else if (err < 0.08) { vTxt = '可用'; vCls = 'ok'; }
    else if (err < 0.22) { vTxt = '降置信'; vCls = 'warn'; }
    else { vTxt = '不可用'; vCls = 'bad'; }
    if (vEl) { vEl.textContent = vTxt; vEl.className = vCls; }

    var note = d('d11-s-note');
    if (note) {
      var base = '<strong>合成信号（synthetic）：</strong>不是硬件采集。检测器 = 迟滞峰值检测 + 相邻峰间隔取中位数，只有 3 行逻辑，故意做得很笨，这样你能看清是哪一步被污染打坏。';
      if (synthKind === 'clean') note.innerHTML = base + ' 干净信号下误差只来自噪声（' + fixed(err * 100, 1) + '%），周期估计稳定——这是“理想基线”，用来校准你对误差的直觉。';
      else if (synthKind === 'motion') note.innerHTML = base + ' 慢分量（约 ' + fixed(2.6 * Tp, 1) + ' s 周期）幅度是呼吸的 2 倍以上，峰值检测于是跟着慢分量走，估出的“周期”跳到 ' + fixed(est, 1) + ' s。<strong>这不是误差变大，这是测错了对象</strong>——正确反应是判定该窗口被运动污染并丢弃，而不是调参数把它拉回来。';
      else note.innerHTML = base + ' 两个不同周期的信号叠加 → 峰间隔被“拍”调制，估计值落在两者之间（' + fixed(est, 2) + ' s），而且<strong>序列看起来平滑、毫不报警</strong>。这是最危险的一类错误：它给了一个稳定的错数。';
    }

    var ctx = s.ctx;
    LK.clear(s, P.card);
    var mL = 40, mR = 16, mT = 26, mB = 46;
    var w = s.w - mL - mR, h = s.h - mT - mB;
    var mx = -1e9, mn = 1e9;
    arr.forEach(function (v) { if (v > mx) mx = v; if (v < mn) mn = v; });
    var pad = (mx - mn) * 0.12 || 0.2;
    mx += pad; mn -= pad;
    function X(i) { return mL + i / (arr.length - 1) * w; }
    function Y(v) { return mT + h - (v - mn) / (mx - mn) * h; }

    /* truth period grid */
    for (var t = 0; t <= win; t += Tp) {
      var gx = mL + t / win * w;
      ctx.strokeStyle = P.grid;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(gx, mT); ctx.lineTo(gx, mT + h); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* signal */
    ctx.beginPath();
    arr.forEach(function (v, i) { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); });
    ctx.strokeStyle = P.s3;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    /* peaks */
    peaks.forEach(function (idx) {
      LK.dot(ctx, X(idx), Y(arr[idx]), 3.4, P.s1);
    });

    /* axes */
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(mL, mT); ctx.lineTo(mL, mT + h); ctx.lineTo(mL + w, mT + h); ctx.stroke();
    for (var tick = 0; tick <= win; tick += Math.max(5, Math.round(win / 4))) {
      var tx = mL + tick / win * w;
      LK.label(ctx, String(tick), tx, mT + h + 11, P.muted, 10, 'center');
    }
    LK.label(ctx, '时间 t（s）', mL + w / 2, s.h - 8, P.muted, 11, 'center');
    LK.label(ctx, '● 检测到的峰（' + peaks.length + ' 个）', mL + w - 4, mT - 10, P.s1, 11, 'right');
  }

  function initSynth() {
    var s = LK.canvas('d11-s-canvas', 270);
    if (!s) return;
    synthState = s;
    s.onresize = drawSynth;
    var tabs = d('d11-s-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-kind]');
        if (!btn) return;
        synthKind = btn.dataset.kind;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        drawSynth();
      });
    }
    ['d11-s-win', 'd11-s-rate'].forEach(function (id) {
      d(id).addEventListener('input', drawSynth);
    });
    redraws.push(drawSynth);
    drawSynth();
  }

  /* ------------------------------------------------------------ 07 quality */
  function calcQuality() {
    var host = d('d11-q-body');
    if (!host) return;
    var snr = parseFloat(d('d11-q-snr').value);
    var motion = parseFloat(d('d11-q-motion').value);
    var persons = parseInt(d('d11-q-persons').value, 10);
    var pose = d('d11-q-pose').value;

    LK.text('d11-q-snr-out', fixed(snr, 0) + ' dB');
    LK.text('d11-q-motion-out', fixed(motion, 1) + ' mm');
    LK.text('d11-q-persons-out', persons === 0 ? '无人在视野' : persons + ' 人');
    var poseName = { front: '正对雷达', side: '侧身', back: '背对', covered: '被毯子/家具遮挡' }[pose];
    LK.text('d11-q-pose-out', poseName);

    var reasons = [];
    var state, cls, allow, forbid, extra;

    if (persons === 0) {
      state = '④ 需其他源'; cls = 'warn';
      reasons.push('视野内无目标：没有回波主体，任何“生命体征”都是噪声');
      allow = '报告“未检测到在场”';

      forbid = '报告呼吸/心率；把空房间当成异常';
      extra = '门磁、床垫压力、语音唤醒——用另一条链路确认是否真的没人';
    } else if (persons >= 2) {
      state = '③ 无法估计'; cls = 'bad';
      reasons.push('在场 ' + persons + ' 人：回波在多个距离单元与同一距离单元内混叠，相位不对应单个人');
      allow = '报告“可能 ' + persons + ' 人在场”';
      forbid = '把某个生命体征分配给某个人；做单值趋势';
      extra = '语音点名、可穿戴、座位压力垫——先解决身份关联';
    } else if (motion > 6) {
      state = '③ 无法估计'; cls = 'bad';
      reasons.push('窗口内运动量 ' + fixed(motion, 1) + ' mm 远大于呼吸幅度：运动伪影主导相位');
      allow = '报告“检测到明显运动”';
      forbid = '在运动窗口上做周期估计';
      extra = '等静坐后重新取窗；或改用短窗只判定“在动”';
    } else if (snr < 6) {
      state = '③ 无法估计'; cls = 'bad';
      reasons.push('回波信噪比 ' + fixed(snr, 0) + ' dB 过低：相位噪声淹没了微动');
      allow = '报告“信号质量不足”';
      forbid = '输出任何周期数字';
      extra = '调整安装角度/距离，避开遮挡';
    } else if (pose === 'covered' || pose === 'back' || pose === 'side') {
      state = '② 降置信'; cls = 'warn';
      reasons.push('朝向为“' + poseName + '”：胸壁微动在视线方向上的投影变小' +
        (pose === 'side' ? '（约按 cosθ 衰减，幅度可能只剩正对时的一半）' : '，且胸腔可能被遮挡'));
      if (snr < 14) reasons.push('同时信噪比只有 ' + fixed(snr, 0) + ' dB（偏低）');
      allow = '记录但降置信，不进入报警';
      forbid = '把“幅度变小”解释为“呼吸变浅”';
      extra = '建议用户调整坐姿/位置，或换安装点';
    } else if (snr < 12 || motion > 2) {
      state = '② 降置信'; cls = 'warn';
      if (snr < 12) reasons.push('信噪比 ' + fixed(snr, 0) + ' dB 偏低（< 12 dB 教学阈值）');
      if (motion > 2) reasons.push('运动量 ' + fixed(motion, 1) + ' mm 接近呼吸幅度，存在伪影风险');
      allow = '记录趋势，仅用于“最近好像变慢了”这类软提示';
      forbid = '触发任何等级告警；对外宣称准确度';
      extra = '延长窗口 / 要求保持静坐 30 秒后重取';
    } else {
      state = '① 可报告趋势'; cls = 'ok';
      reasons.push('单人、正对、无遮挡；信噪比 ' + fixed(snr, 0) + ' dB 与运动量 ' + fixed(motion, 1) + ' mm 都在教学阈值内');
      allow = '输出周期趋势 + 置信档位，进入长期统计';
      forbid = '输出“心率 XX bpm”；宣称医疗级准确度';
      extra = '仍然需要定期用对照仪器抽检，并记录失败窗口';
    }

    host.innerHTML = '';
    [['结论', state], ['允许', allow], ['禁止', forbid], ['该补的观测', extra]].forEach(function (row, idx) {
      var div = document.createElement('div');
      div.className = 'cond-row';
      var a = document.createElement('span');
      a.textContent = row[0];
      var b = document.createElement('span');
      if (idx === 0) {
        var f = document.createElement('span');
        f.className = 'flag ' + cls;
        f.textContent = row[1];
        b.appendChild(f);
      } else {
        b.textContent = row[1];
      }
      div.appendChild(a);
      div.appendChild(b);
      host.appendChild(div);
    });

    var note = d('d11-q-note');
    if (note) {
      note.innerHTML = '<strong>判据（按优先级从上到下）：</strong>' + reasons.join('；') +
        '。<span class="mono">这些阈值是教学示例，不是标准</span>——真实阈值只能由固定型号 + 固定安装 + 真实房间 + 对照仪器的实验确定。';
    }
  }

  function initQuality() {
    ['d11-q-snr', 'd11-q-motion', 'd11-q-persons', 'd11-q-pose'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener(el.type === 'range' ? 'input' : 'change', calcQuality);
    });
    calcQuality();
  }

  /* ------------------------------------------------------------- 08 safety */
  var STEPS = ['sensor', 'quality gate', 'trend estimate', 'context fusion', 'ask user', 'risk response', 'authorized human'];
  var safetyIdx = -1;

  function renderSafetyChain() {
    var host = d('d11-sf-chain');
    if (!host) return;
    host.innerHTML = '';
    STEPS.forEach(function (name, i) {
      var n = document.createElement('span');
      n.className = 'node' + (i === safetyIdx ? ' is-active' : '');
      n.textContent = (i + 1) + ' ' + name;
      host.appendChild(n);
      if (i < STEPS.length - 1) {
        var a = document.createElement('span');
        a.className = 'arrow';
        a.textContent = '→';
        host.appendChild(a);
      }
    });
  }

  function pushLog(host, text, cls) {
    var p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    host.appendChild(p);
    host.scrollTop = host.scrollHeight;
  }

  function safetyStep() {
    var log = d('d11-sf-log');
    if (!log) return;
    var refuse = d('d11-sf-refuse').checked;
    var offline = d('d11-sf-offline').checked;
    var nofamily = d('d11-sf-nofamily').checked;
    if (safetyIdx >= STEPS.length - 1) return;

    safetyIdx += 1;
    renderSafetyChain();
    var state = d('d11-sf-state');

    if (safetyIdx === 0) {
      pushLog(log, '01 sensor         : 采集一个 20 s 窗口，输出复距离像 + 每距离单元相位 + RSSI');
      if (state) state.textContent = '进行中 · 1/7';
    } else if (safetyIdx === 1) {
      pushLog(log, '02 quality gate   : SNR 18 dB / 运动 0.6 mm / 单人 / 正对 → ① 可报告趋势');
      pushLog(log, '   ↳ 若落到 ③：写“不可用”，请求换位置后重取，禁止进入趋势层', 'is-bad');
    } else if (safetyIdx === 2) {
      pushLog(log, '03 trend estimate : 周期 ≈ 4.2 s（14 次/分），置信档 ①；附窗口 id 与算法版本');
      pushLog(log, '   ↳ 所有估计值必须携带「窗口 id + 质量档 + 版本号」三件套，否则不可审计');
    } else if (safetyIdx === 3) {
      pushLog(log, '04 context fusion : 融合 CO₂ 1420 ppm（独立来源）、门磁 3 h 未开、语音 2 次无应答');
      pushLog(log, '   ↳ 各源独立记录，不把不同模态的置信度相加或平均', 'is-good');
    } else if (safetyIdx === 4) {
      if (refuse) {
        pushLog(log, '05 ask user       : 用户明确拒绝上报 → 授权状态置 DECLINED，降级为「仅本人提醒」', 'is-bad');
        pushLog(log, '   ↳ 记录拒绝时间与话术版本；连续高风险时进入人工复核，不静默越权');
      } else {
        pushLog(log, '05 ask user       : 语音询问“今天感觉怎么样？需要我联系家人吗？”→ 用户未回应（超时 60 s）');
        pushLog(log, '   ↳ 超时是信息，不是失败：升级依据是「无应答 + 多源同向」，不是单点数值');
      }
    } else if (safetyIdx === 5) {
      if (offline) {
        pushLog(log, '06 risk response  : 无网 → 本地声光提醒 + 缓存证据（含原始窗口与质量分）', 'is-bad');
        pushLog(log, '   ↳ 告警不得被网络阻塞；恢复后补传，并标注「延迟上报」时间戳');
      } else {
        pushLog(log, '06 risk response  : L2「需要关注」→ 通知本人 + 授权家属；话术只陈述观测与时间');
        pushLog(log, '   ↳ 禁止输出疾病名与诊断结论；LLM 只负责组织语言，不负责定级', 'is-good');
      }
    } else {
      if (nofamily) {
        pushLog(log, '07 authorized     : 家属电话 2 次未接 → 阶梯升级：备用联系人 → 社区值班（每级超时 5 min）', 'is-bad');
        pushLog(log, '   ↳ 每级写入「已尝试」幂等标记，避免重复轰炸，也避免静默失败');
      } else {
        pushLog(log, '07 authorized     : 家属确认收到 → 事件闭合，写入处理结果与用户反馈');
        pushLog(log, '   ↳ 闭合记录要能被下一次误报纠正回灌，形成闭环', 'is-good');
      }
      if (state) state.textContent = '完成 · 7/7';
    }

    var note = d('d11-sf-note');
    if (note) {
      note.innerHTML = '勾选框代表三种典型异常分支。注意：<strong>无论走哪条分支，“由模型直接下诊断”这一步都不存在</strong>——' +
        '它不在流程图里，也不该在代码里。风险定级由规则引擎 + 人工定义阈值负责，模型只做语言层。';
    }
  }

  function initSafety() {
    var next = d('d11-sf-next');
    var reset = d('d11-sf-reset');
    if (next) next.addEventListener('click', safetyStep);
    if (reset) {
      reset.addEventListener('click', function () {
        safetyIdx = -1;
        renderSafetyChain();
        var log = d('d11-sf-log');
        if (log) {
          log.innerHTML = '';
          pushLog(log, '00 待触发         : 勾选下方异常分支，然后点「推进一步」逐步走完 7 个环节');
        }
        var state = d('d11-sf-state');
        if (state) state.textContent = '未开始';
      });
    }
    ['d11-sf-refuse', 'd11-sf-offline', 'd11-sf-nofamily'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', function () {
        var note = d('d11-sf-note');
        if (note) {
          var on = ['d11-sf-refuse', 'd11-sf-offline', 'd11-sf-nofamily']
            .filter(function (x) { return d(x) && d(x).checked; }).length;
          note.innerHTML = on
            ? '已开启 ' + on + ' 条异常分支。<strong>点击「推进一步」看流程如何改道</strong>——如果中途改了勾选，新分支从下一步开始生效。'
            : '勾选框代表三种典型异常分支。注意：<strong>无论走哪条分支，“由模型直接下诊断”这一步都不存在</strong>——它不在流程图里，也不该在代码里。';
        }
      });
    });
    renderSafetyChain();
    var log0 = d('d11-sf-log');
    if (log0 && !log0.children.length) {
      pushLog(log0, '00 待触发         : 勾选下方异常分支，然后点「推进一步」逐步走完 7 个环节');
    }
    var note0 = d('d11-sf-note');
    if (note0) {
      note0.innerHTML = '勾选框代表三种典型异常分支。注意：<strong>无论走哪条分支，“由模型直接下诊断”这一步都不存在</strong>——它不在流程图里，也不该在代码里。风险定级由规则引擎 + 人工定义阈值负责，模型只做语言层。';
    }
  }

  /* --------------------------------------------------------------- 09 exam */
  function initExam() {
    var boxes = [];
    for (var i = 1; i <= 6; i++) {
      var el = d('d11-ex-' + i);
      if (el) { boxes.push(el); el.addEventListener('change', calcExam); }
    }
    window.__d11examBoxes = boxes;
    calcExam();
  }

  function calcExam() {
    var boxes = window.__d11examBoxes || [];
    var done = boxes.filter(function (b) { return b.checked; }).length;
    var total = boxes.length || 6;
    LK.text('d11-ex-count', done + ' / ' + total);
    var level = '未开始';
    if (done >= 1) level = '草稿';
    if (done >= 4) level = '基本完整';
    if (done === total) level = '完整 · 待追问';
    LK.text('d11-ex-level', level);
  }

  /* -------------------------------------------------------------- 10 score */
  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d11-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d11-sc-' + i);
      var v = el ? parseInt(el.value, 10) : 0;
      var out = d('d11-sc-' + i + '-out');
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d11-sc-total', total + ' / 20');
    var tip = d('d11-sc-tip');
    if (tip) {
      tip.textContent = total >= 17 ? '可以上场' : (total >= 12 ? '补验证与真实性' : (total >= 7 ? '先推式子' : '回到第 02 节'));
    }
    var note = d('d11-sc-note');
    if (note) {
      if (total >= 17) {
        note.innerHTML = '四项以上到 3 分的状态下，下一步不是继续刷课，而是<strong>准备连续两轮“为什么”</strong>：为什么用相位而不只用幅度？为什么多人就不能分？为什么不能说医疗级？';
      } else if (total >= 12) {
        note.innerHTML = '“原理”够了但“验证”还是 0 分是常见的假高分：你能解释系统，但没有任何一次带对照的采集。<strong>最低成本的补法：借开发板采一段静坐 + 胸带参考</strong>，一次就够。';
      } else {
        note.innerHTML = '先把第 02 节的 <code>f_b = 2SR/c</code> 推一遍、量纲对上、算出 400 kHz；再把第 04 节的 0.5 mm → 72° 算一遍。<strong>这两个数算出来，分数立刻不一样</strong>，因为它们可以被追问。';
      }
    }
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    initChain();
    initChirp();
    initFft();
    initPhase();
    initDoppler();
    initSynth();
    initQuality();
    initSafety();
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
