/* Day 10 — representations, driving, rendering, sync. Vanilla, offline. */
(function () {
  'use strict';

  var P;
  var redraws = [];
  function d(id) { return document.getElementById(id); }

  /* ----------------------------------------------------------------- reps */
  var REPS = {
    gs: {
      name: '静态 3DGS',
      data: '每个高斯：三维位置 μ、协方差 Σ（尺度 + 旋转）、不透明度 α、球谐颜色系数',
      out: '可光栅化的显式场景表示 → 任意视角的二维图像',
      never: '没有关节与骨骼层级、没有碰撞体、没有语义标签；不能直接驱动表情',
      misuse: '拿它做表情驱动，靠“每帧重新重建”硬凑',
      one: '它存的是一堆可见的小团，不是一套可动的骨头。'
    },
    flame: {
      name: 'FLAME',
      data: '模板网格 + 形状基 + 表情基 + 姿态（颈 / 颌 / 眼球）+ 关节回归器',
      out: '给定一组系数 → 一张具体的三维人脸网格',
      never: '不识别情绪、不把语音变成表情、不含身体与手',
      misuse: '以为给了表情系数就等于“系统理解了情绪”',
      one: '它把脸变成一组旋钮，但不告诉你该拧到哪。'
    },
    smplx: {
      name: 'SMPL-X',
      data: '体型系数 + 姿态（身体 / 手 / 脸）+ 关节',
      out: '全身含手与脸的参数化人体网格',
      never: '不保证传感器动作已经同步准确；不含外观纹理细节',
      misuse: '以为有 SMPL-X 就等于动作捕捉已经做好了',
      one: '它是人体坐标系，不是动作采集器。'
    },
    blend: {
      name: 'Blendshape',
      data: '一组网格形变目标 + 权重向量（如 ARKit 的 52 个表情通道）',
      out: '按权重混合后的表情形状',
      never: '不理解意图、不保证情绪正确、权重语义依具体模型而定',
      misuse: '把权重数值当成情绪标签（“jawOpen 大 = 生气”）',
      one: '它是驱动接口，不是语义。'
    },
    vrm: {
      name: 'VRM',
      data: '人形骨架命名规范 + 表情与视线约定 + 可移植文件格式',
      out: '跨软件可加载的三维人形角色资产',
      never: '不含 LLM、不含实时性保证、不保证表情正确',
      misuse: '以为用了 VRM 就等于“标准化完成、可以直接上线”',
      one: '它是集装箱规范，不是内容。'
    },
    live2d: {
      name: 'Live2D',
      data: '二维图层 + 变形参数（网格变形器）',
      out: '二维角色动画，成本低、风格强',
      never: '没有三维全空间几何，转身与侧后视角无数据',
      misuse: '拿它做需要自由视角或全身动作的场景',
      one: '成本低、可控性好，但它只有一面。'
    }
  };

  function renderRep(key) {
    var r = REPS[key];
    var host = d('d10-rep-detail');
    if (!r || !host) return;
    host.innerHTML =
      '<div class="case-card"><h4>' + r.name + ' · 数据结构</h4><p>' + r.data + '</p></div>' +
      '<div class="case-card"><h4>输出</h4><p>' + r.out + '</p></div>' +
      '<div class="case-card"><h4>不能自动保证</h4><p><strong>' + r.never + '</strong></p></div>' +
      '<div class="case-card"><h4>典型误用</h4><p>' + r.misuse + '</p><p class="demo-note" style="margin:0">记法：' + r.one + '</p></div>';
  }

  function initReps() {
    var chips = LK.$$('#d10-rep-chips .chip');
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        renderRep(b.dataset.rep);
      });
    });
    renderRep('gs');
  }

  /* --------------------------------------------------------------- matrix */
  var MATRIX = [
    {
      name: '① 写实展示',
      stack: '3DGS / 多视角重建 + 实时光栅化',
      why: '没有驱动需求，只要“看起来像”。3DGS 的显式表示 + 快速光栅化最直接：不用网络查询，不用沿光线采样。',
      cost: '采集要求高（多视角、标定、足够覆盖）；存储随高斯数量增长；侧后视角与遮挡区依赖数据覆盖。',
      myth: '以为“重建质量高”就等于“低端设备也能实时跑”。桌面 60 fps 不等于头显 60 fps。',
      skip: '表情驱动、骨骼动画——这些它不提供'
    },
    {
      name: '② 语音 + 表情驱动',
      stack: 'FLAME 或 ARKit 式 blendshape + viseme 映射 + 参数化渲染',
      why: '要口型，就必须有 viseme 级、帧级可控的参数。参数化模型天然提供这些旋钮；3DGS 不提供。',
      cost: '真实感弱于纯重建；口型与情绪会耦合（笑的时候张嘴，嘴型就变了）；跨说话人要处理泛化。',
      myth: '以为“3DGS + 每帧重建”能替代驱动——延迟与帧间一致性都不成立。',
      skip: '全身动作；它只覆盖脸'
    },
    {
      name: '③ 动作同步',
      stack: 'SMPL-X 或 VRM 人形骨架 + 动作捕捉 / 重定向 + IK 修正',
      why: '要承接动作数据，必须有关节层级与全身自由度。骨架模型是唯一能“接收”动作的结构。',
      cost: '需要动作数据源；重定向要处理比例差异；脚底滑步要 IK 修；多坐标系 + 时间戳对齐（和 Day 5 的 TF 同构）。',
      myth: '以为“有骨架就自动同步”——时间基准、坐标系、单位都得单独对齐。',
      skip: '手指细节、面部微表情（要额外通道）'
    }
  ];
  var needIdx = 0;

  function renderNeed(i) {
    needIdx = i;
    var m = MATRIX[i];
    var host = d('d10-m-detail');
    if (host) {
      host.innerHTML =
        '<div class="case-card"><h4>' + m.name + ' · 推荐组合</h4><p>' + m.stack + '</p></div>' +
        '<div class="case-card"><h4>为什么是它</h4><p>' + m.why + '</p></div>' +
        '<div class="case-card"><h4>代价</h4><p>' + m.cost + '</p></div>' +
        '<div class="case-card"><h4>常见误解</h4><p>' + m.myth + '</p></div>' +
        '<div class="case-card"><h4>这个组合不覆盖</h4><p>' + m.skip + '</p></div>';
    }
    LK.text('d10-m-note', m.name + ' 的关键取舍是：' + m.cost);
    var tabs = LK.$$('#d10-m-tabs button');
    tabs.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  function initMatrix() {
    var tabs = LK.$$('#d10-m-tabs button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { renderNeed(parseInt(b.dataset.need, 10) || 0); });
    });
    renderNeed(0);
  }

  /* ------------------------------------------------------------------- gs */
  /* A 2-D stand-in for 3DGS: sample gaussians from a target silhouette,
     splat them back-to-front, and score coverage against the target mask. */
  var SHAPES = [
    { cx: 0.50, cy: 0.705, rx: 0.335, ry: 0.150, rot: 0, color: [63, 111, 99] },   /* shoulders */
    { cx: 0.50, cy: 0.520, rx: 0.058, ry: 0.058, rot: 0, color: [186, 132, 106] },  /* neck */
    { cx: 0.50, cy: 0.348, rx: 0.118, ry: 0.142, rot: 0, color: [219, 170, 143] },  /* face */
    { cx: 0.50, cy: 0.315, rx: 0.176, ry: 0.182, rot: 0, color: [52, 62, 72] }      /* hair */
  ];
  /* draw order: hair back, face, neck, shoulders front-ish */
  var DRAW_ORDER = [3, 0, 1, 2];
  /* per-shape depth base: keeps hair behind the face instead of speckling it */
  var SHAPE_DEPTH = [0.34, 0.58, 0.72, 0.10];

  function inEllipse(x, y, s) {
    var dx = (x - s.cx) / s.rx;
    var dy = (y - s.cy) / s.ry;
    return dx * dx + dy * dy <= 1;
  }

  function inAny(x, y) {
    for (var i = 0; i < SHAPES.length; i++) if (inEllipse(x, y, SHAPES[i])) return true;
    return false;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Halton low-discrepancy sequence: keeps the splats evenly spread instead of
     clumping the way pure random sampling does. */
  function halton(i, base) {
    var f = 1, r = 0;
    while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
    return r;
  }

  /* Total covered area is held roughly constant by shrinking each splat as the
     count grows (sigma ~ 1/sqrt(N)) — this mirrors what optimisation does. */
  function sampleGaussians(n, seed) {
    var rnd = mulberry32(seed || 7);
    var sizeK = Math.sqrt(180 / Math.max(20, n));
    var out = [];
    var i = 1, guard = 0;
    while (out.length < n && guard < n * 80) {
      var u = halton(i, 2), v = halton(i, 3);
      i++; guard++;
      var x = 0.04 + u * 0.92, y = 0.03 + v * 0.94;
      var si = -1;
      for (var k = 0; k < SHAPES.length; k++) {
        if (inEllipse(x, y, SHAPES[k])) { si = k; break; }
      }
      if (si < 0) continue;
      var s = SHAPES[si];
      var jitter = 0.9 + rnd() * 0.2;
      var base = 0.024 * sizeK * (0.85 + rnd() * 0.3);
      out.push({
        x: x, y: y,
        sx: base,
        sy: base * (0.75 + rnd() * 0.5),
        rot: rnd() * Math.PI,
        color: [Math.round(s.color[0] * jitter), Math.round(s.color[1] * jitter), Math.round(s.color[2] * jitter)],
        depth: SHAPE_DEPTH[si] + rnd() * 0.06
      });
    }
    out.sort(function (p, q) { return p.depth - q.depth; });
    return out;
  }

  var gsState = { count: 320, scale: 1.0 };
  var gsCanvas = null;
  var offCanvas = null;
  var gsCache = { n: -1, list: null };

  function gsList() {
    if (gsCache.n !== gsState.count) {
      gsCache.n = gsState.count;
      gsCache.list = sampleGaussians(gsState.count, 20261022);
    }
    return gsCache.list;
  }

  function drawGs() {
    if (!gsCanvas) return;
    var s = gsCanvas;
    var p = P();
    LK.clear(s, p.card);
    var gap = 14;
    var padTop = 22;
    var panelW = (s.w - gap) / 2;
    var panelH = s.h - padTop - 6;

    function frame(x0) {
      s.ctx.save();
      s.ctx.fillStyle = p.accent;
      s.ctx.fillRect(x0, padTop, panelW, panelH);
      s.ctx.strokeStyle = p.border;
      s.ctx.lineWidth = 1;
      s.ctx.strokeRect(x0, padTop, panelW, panelH);
      s.ctx.restore();
    }
    frame(0);
    frame(panelW + gap);

    LK.label(s.ctx, '目标（想还原的东西）', 6, 12, p.muted, 10);
    LK.label(s.ctx, '用 ' + gsState.count + ' 个高斯近似', panelW + gap + 6, 12, p.muted, 10);

    /* A square drawing area per panel keeps the normalised space isotropic,
       so the target shape and the splats share one scale on both axes. */
    var S = Math.min(panelW, panelH) * 0.99;
    var insX = (panelW - S) / 2;
    var insY = (panelH - S) / 2;

    /* left: target */
    var tx0 = insX, ty0 = padTop + insY;
    s.ctx.save();
    s.ctx.beginPath();
    s.ctx.rect(0, padTop, panelW, panelH);
    s.ctx.clip();
    DRAW_ORDER.forEach(function (si) {
      var sh = SHAPES[si];
      s.ctx.save();
      s.ctx.translate(tx0 + sh.cx * S, ty0 + sh.cy * S);
      s.ctx.fillStyle = 'rgb(' + sh.color.join(',') + ')';
      s.ctx.beginPath();
      s.ctx.ellipse(0, 0, sh.rx * S, sh.ry * S, sh.rot, 0, Math.PI * 2);
      s.ctx.fill();
      s.ctx.restore();
    });
    s.ctx.restore();

    /* right: splats — solid ellipses on an offscreen layer, blurred once at the
       end. Overlapping solid fills keep one flat colour (no quilting), and the
       single blur softens the outer boundary like a real splat rasteriser. */
    var x0 = panelW + gap;
    var sx0 = x0 + insX, sy0 = padTop + insY;
    var list = gsList();
    if (!offCanvas) offCanvas = document.createElement('canvas');
    var dprO = s.dpr || 1;
    offCanvas.width = Math.max(1, Math.round(panelW * dprO));
    offCanvas.height = Math.max(1, Math.round(panelH * dprO));
    var octx = offCanvas.getContext('2d');
    octx.setTransform(dprO, 0, 0, dprO, 0, 0);
    octx.clearRect(0, 0, panelW, panelH);
    list.forEach(function (g) {
      var cx = sx0 - x0 + g.x * S;
      var cy = g.y * S + insY;
      var rx = g.sx * S * gsState.scale * 2.0;
      var ry = g.sy * S * gsState.scale * 2.0;
      if (rx < 0.5 || ry < 0.5) return;
      octx.save();
      octx.translate(cx, cy);
      octx.rotate(g.rot);
      octx.scale(1, ry / rx);
      octx.fillStyle = 'rgb(' + g.color.join(',') + ')';

      octx.beginPath();
      octx.arc(0, 0, rx, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    });

    s.ctx.save();
    s.ctx.beginPath();
    s.ctx.rect(x0, padTop, panelW, panelH);
    s.ctx.clip();
    s.ctx.filter = 'blur(1.4px)';
    s.ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, x0, padTop, panelW, panelH);
    s.ctx.filter = 'none';
    s.ctx.restore();
  }

  function scoreGs() {
    /* IoU on a 60 x 40 grid in normalized space, using 1.6 sigma as the mask. */
    var W = 60, H = 40, inter = 0, uni = 0, targetCount = 0, covCount = 0;
    var list = gsList();
    var sig = gsState.scale * 1.6;
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var x = (i + 0.5) / W, y = (j + 0.5) / H;
        var t = inAny(x, y);
        var c = false;
        for (var k = 0; k < list.length; k++) {
          var g = list[k];
          var dx = (x - g.x) / (g.sx * sig);
          var dy = (y - g.y) / (g.sy * sig);
          if (dx * dx + dy * dy <= 1) { c = true; break; }
        }
        if (t) targetCount++;
        if (c) covCount++;
        if (t && c) inter++;
        if (t || c) uni++;
      }
    }
    var iou = uni ? inter / uni : 0;
    LK.text('d10-gs-iou', (iou * 100).toFixed(1) + '%');

    var flaw;
    if (iou < 0.60) flaw = '欠覆盖：形状残缺、边缘漏空';
    else if (iou < 0.75) flaw = '轮廓能认出来，细节糊';
    else if (iou < 0.85) flaw = '形态接近，边缘仍毛糙';
    else flaw = '已接近本演示的上限（再加密收益很小）';
    LK.text('d10-gs-flaw', flaw);

    var note = d('d10-gs-note');
    if (note) {
      note.innerHTML = '左边是“目标”，右边是用 ' + gsState.count + ' 个高斯近似的结果。覆盖率 = 重建 ∩ 目标 / 并集。' +
        '这里让单个高斯的尺度随数量自动缩小（σ ∝ 1/√N），所以总数越多、每个越小、重叠越少——' +
        '<strong>这正是真实优化里发生的事</strong>，也是“加高斯”能提升细节的原因。' +
        '真实 3DGS 的参数是<strong>通过可微光栅化 + 梯度下降反推</strong>的，本演示用的是低差异序列采样，' +
        '所以这个百分比只说明“覆盖关系”，<strong>不是 PSNR，也不是任何论文指标</strong>。' +
        (gsState.scale > 1.5 ? ' 当前尺度偏大：相邻高斯严重重叠，形状糊成一片。' : '') +
        (gsState.scale < 0.65 ? ' 当前尺度偏小：高斯之间露缝，表面出现颗粒感——真实训练里这会表现为薄片状伪影。' : '');
    }
  }

  function redrawGs() { drawGs(); scoreGs(); }

  function initGs() {
    var c = d('d10-gs-count');
    if (c) LK.range(c, 'd10-gs-count-out', function (v) { return String(v); }, function (v) { gsState.count = v; redrawGs(); });
    var sc = d('d10-gs-scale');
    if (sc) LK.range(sc, 'd10-gs-scale-out', function (v) { return v + '%'; }, function (v) { gsState.scale = v / 100; redrawGs(); });
    var host = d('d10-gs-canvas');
    if (host) {
      gsCanvas = LK.canvas(host, 230);
      if (gsCanvas) { gsCanvas.onresize = drawGs; redraws.push(drawGs); }
    }
    redrawGs();
  }

  /* ----------------------------------------------------------------- face */
  var faceState = { shape: 0, smile: 20, jaw: 10, yaw: 0 };
  var faceCanvas = null;

  function drawFace() {
    if (!faceCanvas) return;
    var s = faceCanvas;
    var p = P();
    LK.clear(s, p.card);
    var w = s.w, h = s.h;
    var cx = w / 2;
    var yaw = faceState.yaw;
    var yawPx = yaw * 0.55;
    var widthK = 1 + faceState.shape / 100 * 0.16;
    var headRx = 54 * widthK;
    var headRy = 70;
    var headCy = h * 0.44;

    var skin = 'rgba(216,166,138,0.20)';
    var line = p.primary;
    var muted = p.muted;

    /* neck: ends just above the shoulder line, filled only — no bottom edge */
    var neckTop = headCy + headRy - 14;
    var neckBottom = h - 54;
    s.ctx.save();
    s.ctx.fillStyle = 'rgba(186,132,106,0.34)';
    s.ctx.beginPath();
    s.ctx.rect(cx - 15, neckTop, 30, Math.max(6, neckBottom - neckTop));
    s.ctx.fill();
    s.ctx.restore();

    /* shoulders */
    s.ctx.save();
    s.ctx.fillStyle = 'rgba(63,111,99,0.18)';
    s.ctx.strokeStyle = line;
    s.ctx.lineWidth = 1.4;
    s.ctx.beginPath();
    s.ctx.moveTo(cx - 96, h - 8);
    s.ctx.quadraticCurveTo(cx - 88, h - 44, cx - 34, h - 52);
    s.ctx.lineTo(cx + 34, h - 52);
    s.ctx.quadraticCurveTo(cx + 88, h - 44, cx + 96, h - 8);
    s.ctx.stroke();
    s.ctx.fill();
    s.ctx.restore();

    /* head */
    s.ctx.save();
    s.ctx.translate(cx + yawPx * 0.35, headCy);
    s.ctx.fillStyle = skin;
    s.ctx.strokeStyle = line;
    s.ctx.lineWidth = 1.6;
    s.ctx.beginPath();
    s.ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
    s.ctx.fill();
    s.ctx.stroke();
    s.ctx.restore();

    /* ear on the far side (indicates yaw) */
    if (Math.abs(yaw) > 4) {
      s.ctx.save();
      s.ctx.strokeStyle = muted;
      s.ctx.lineWidth = 1.1;
      var earX = cx + yawPx * 0.35 - Math.sign(yaw) * headRx;
      s.ctx.beginPath();
      s.ctx.ellipse(earX, headCy + 4, 6, 13, 0, 0, Math.PI * 2);
      s.ctx.stroke();
      s.ctx.restore();
    }

    /* eyes: shift with yaw, slightly narrowed by smile */
    var eyeY = headCy - 14;
    var eyeDx = 21 * widthK;
    var squint = faceState.smile / 100 * 4;
    [-1, 1].forEach(function (sgn) {
      var ex = cx + yawPx * 0.85 + sgn * eyeDx;
      s.ctx.save();
      s.ctx.strokeStyle = line;
      s.ctx.lineWidth = 1.4;
      s.ctx.beginPath();
      s.ctx.ellipse(ex, eyeY, 8, Math.max(2.5, 5.5 - squint * 0.5), 0, 0, Math.PI * 2);
      s.ctx.stroke();
      s.ctx.fillStyle = p.fg;
      s.ctx.beginPath();
      s.ctx.arc(ex + yaw * 0.10, eyeY, 2.6, 0, Math.PI * 2);
      s.ctx.fill();
      s.ctx.restore();
    });

    /* brows */
    var browLift = faceState.smile / 100 * 3;
    [-1, 1].forEach(function (sgn) {
      var bx = cx + yawPx * 0.85 + sgn * eyeDx;
      s.ctx.save();
      s.ctx.strokeStyle = muted;
      s.ctx.lineWidth = 1.6;
      s.ctx.beginPath();
      s.ctx.moveTo(bx - 9, eyeY - 13 - browLift);
      s.ctx.quadraticCurveTo(bx, eyeY - 17 - browLift, bx + 9, eyeY - 13 - browLift);
      s.ctx.stroke();
      s.ctx.restore();
    });

    /* nose */
    s.ctx.save();
    s.ctx.strokeStyle = muted;
    s.ctx.lineWidth = 1.1;
    s.ctx.beginPath();
    s.ctx.moveTo(cx + yawPx * 0.9, eyeY + 4);
    s.ctx.lineTo(cx + yawPx * 0.9 - 3, eyeY + 22);
    s.ctx.stroke();
    s.ctx.restore();

    /* mouth: smile controls curvature, jaw controls opening */
    var mouthY = headCy + 34;
    var mouthW = (16 + faceState.smile / 100 * 12) * widthK;
    var curve = faceState.smile / 100 * 9;
    var open = faceState.jaw / 100 * 16;
    var mx = cx + yawPx * 0.95;
    s.ctx.save();
    s.ctx.strokeStyle = line;
    s.ctx.lineWidth = 1.6;
    s.ctx.beginPath();
    s.ctx.moveTo(mx - mouthW, mouthY);
    s.ctx.quadraticCurveTo(mx, mouthY + curve, mx + mouthW, mouthY);
    s.ctx.stroke();
    if (open > 1) {
      s.ctx.beginPath();
      s.ctx.moveTo(mx - mouthW, mouthY);
      s.ctx.quadraticCurveTo(mx, mouthY + curve + open * 1.6, mx + mouthW, mouthY);
      s.ctx.quadraticCurveTo(mx, mouthY + curve * 0.4, mx - mouthW, mouthY);
      s.ctx.fillStyle = 'rgba(90,50,55,0.30)';
      s.ctx.fill();
      s.ctx.stroke();
    }
    s.ctx.restore();

    /* parameter readout */
    LK.label(s.ctx, 'shape ' + faceState.shape + '   smile ' + faceState.smile +
      '   jaw ' + faceState.jaw + '   yaw ' + faceState.yaw + '°', 8, h - 10, p.muted, 10);
  }

  function initFace() {
    var defs = [
      ['d10-p-shape', 'shape', function (v) { return String(v); }],
      ['d10-p-smile', 'smile', function (v) { return String(v); }],
      ['d10-p-jaw', 'jaw', function (v) { return String(v); }],
      ['d10-p-yaw', 'yaw', function (v) { return v + '°'; }]
    ];
    defs.forEach(function (t) {
      var el = d(t[0]);
      if (!el) return;
      LK.range(el, t[0] + '-out', t[2], function (v) { faceState[t[1]] = v; drawFace(); });
    });
    var host = d('d10-face-canvas');
    if (host) {
      faceCanvas = LK.canvas(host, 240);
      if (faceCanvas) { faceCanvas.onresize = drawFace; redraws.push(drawFace); }
    }
    drawFace();
  }

  /* --------------------------------------------------------------- timing */
  var tm = { tts: 180, vis: 40, render: 16, buf: 60 };
  var tmCanvas = null;

  function drawTiming() {
    if (!tmCanvas) return;
    var s = tmCanvas;
    var p = P();
    LK.clear(s, p.card);
    var padL = 56, padR = 16, top = 26;
    var laneH = 26, gapY = 26;
    var windowMs = Math.max(500, tm.tts + tm.vis + tm.render + tm.buf + 260);
    var usable = Math.max(80, s.w - padL - padR);
    var scale = usable / windowMs;
    function x(t) { return padL + t * scale; }

    LK.label(s.ctx, '音频', 12, top + laneH / 2, p.s3, 11);
    LK.label(s.ctx, '动画', 12, top + laneH + gapY + laneH / 2, p.s1, 11);

    var audioStart = tm.tts + tm.buf;
    var animStart = tm.tts + tm.vis + tm.render;

    /* baseline */
    [top, top + laneH + gapY].forEach(function (y) {
      s.ctx.save();
      s.ctx.strokeStyle = p.border;
      s.ctx.lineWidth = 1;
      s.ctx.beginPath();
      s.ctx.moveTo(padL, y + laneH);
      s.ctx.lineTo(padL + usable, y + laneH);
      s.ctx.stroke();
      s.ctx.restore();
    });

    /* audio: generated → buffered → playing */
    s.ctx.save();
    s.ctx.fillStyle = p.s3;
    s.ctx.globalAlpha = 0.22;
    s.ctx.fillRect(x(0), top, Math.max(2, x(tm.tts) - x(0)), laneH);
    s.ctx.restore();
    s.ctx.save();
    s.ctx.fillStyle = p.s3;
    s.ctx.globalAlpha = 0.40;
    s.ctx.fillRect(x(tm.tts), top, Math.max(2, x(audioStart) - x(tm.tts)), laneH);
    s.ctx.restore();
    s.ctx.save();
    s.ctx.fillStyle = p.s3;
    s.ctx.globalAlpha = 0.85;
    s.ctx.fillRect(x(audioStart), top, Math.max(3, x(windowMs - 20) - x(audioStart)), laneH);
    s.ctx.restore();
    LK.label(s.ctx, '生成', (x(0) + x(tm.tts)) / 2, top + laneH / 2, p.muted, 9, 'center');
    LK.label(s.ctx, '缓冲', (x(tm.tts) + x(audioStart)) / 2, top + laneH / 2, p.muted, 9, 'center');
    LK.label(s.ctx, '出声', (x(audioStart) + x(windowMs - 20)) / 2, top + laneH / 2, '#ffffff', 9, 'center');

    /* animation: viseme + render head start */
    var ay = top + laneH + gapY;
    s.ctx.save();
    s.ctx.fillStyle = p.s1;
    s.ctx.globalAlpha = 0.30;
    s.ctx.fillRect(x(tm.tts), ay, Math.max(2, x(animStart) - x(tm.tts)), laneH);
    s.ctx.restore();
    s.ctx.save();
    s.ctx.fillStyle = p.s1;
    s.ctx.globalAlpha = 0.85;
    s.ctx.fillRect(x(animStart), ay, Math.max(3, x(windowMs - 20) - x(animStart)), laneH);
    s.ctx.restore();
    LK.label(s.ctx, 'viseme+渲染', (x(tm.tts) + x(animStart)) / 2, ay + laneH / 2, p.muted, 9, 'center');
    LK.label(s.ctx, '显示', (x(animStart) + x(windowMs - 20)) / 2, ay + laneH / 2, '#ffffff', 9, 'center');

    /* markers — labels alternate rows so near-coincident marks stay readable */
    var marks = [['①', 0], ['②', tm.tts], ['③', audioStart], ['④', tm.tts + tm.vis], ['⑤', animStart]];
    var rowLast = [-1e9, -1e9];
    marks.forEach(function (m) {
      var mx = x(m[1]);
      s.ctx.save();
      s.ctx.strokeStyle = p.muted;
      s.ctx.setLineDash([2, 3]);
      s.ctx.lineWidth = 1;
      s.ctx.beginPath();
      s.ctx.moveTo(mx, top - 6);
      s.ctx.lineTo(mx, ay + laneH + 8);
      s.ctx.stroke();
      s.ctx.restore();
      /* pick whichever label row has the most horizontal room left */
      var row = (mx - rowLast[0] >= mx - rowLast[1]) ? 0 : 1;
      rowLast[row] = mx;
      LK.label(s.ctx, m[0], mx, top - 11 - row * 10, p.muted, 9, 'center');
    });

    /* offset bracket */
    var offset = animStart - audioStart;
    if (Math.abs(offset) <= 8) {
      LK.label(s.ctx, '≈ 对齐（' + Math.round(offset) + ' ms）', x(audioStart) + 16, ay + laneH + 12, p.primary, 9, 'left');
    } else if (Math.abs(offset) > 2) {
      var y = ay + laneH + 16;
      s.ctx.save();
      s.ctx.strokeStyle = Math.abs(offset) > 160 ? p.bad : (Math.abs(offset) > 80 ? p.s2 : p.primary);
      s.ctx.lineWidth = 1.6;
      s.ctx.beginPath();
      s.ctx.moveTo(x(audioStart), y);
      s.ctx.lineTo(x(animStart), y);
      s.ctx.stroke();
      s.ctx.restore();
      LK.label(s.ctx, (offset > 0 ? '嘴慢 ' : '嘴快 ') + Math.abs(Math.round(offset)) + ' ms',
        (x(audioStart) + x(animStart)) / 2, y + 12, p.muted, 9, 'center');
    }
  }

  function calcTiming() {
    var offset = (tm.vis + tm.render) - tm.buf;
    var el = d('d10-t-offset');
    if (el) el.textContent = (offset > 0 ? '+' : '') + Math.round(offset) + ' ms';
    var a = Math.abs(offset);
    var verdict, color = '';
    if (a <= 80) verdict = '不易察觉';
    else if (a <= 160) verdict = '可察觉，勉强可接受';
    else { verdict = (offset > 0 ? '嘴明显慢于声音' : '嘴明显早于声音'); color = (P().bad || '#bd403b'); }
    var v = d('d10-t-verdict');
    if (v) { v.textContent = verdict; v.style.color = color; }
    var note = d('d10-t-note');
    if (note) {
      note.innerHTML = '偏移 = (viseme 计算 ' + tm.vis + ' ms + 渲染一帧 ' + tm.render + ' ms) − 音频缓冲 ' + tm.buf +
        ' ms = <strong>' + (offset > 0 ? '+' : '') + Math.round(offset) + ' ms</strong>。' +
        (offset > 0
          ? ' 正则代表<strong>嘴慢于声音</strong>：观众会看到“声音先出来，嘴才动”。'
          : offset < 0
            ? ' 负值代表<strong>嘴早于声音</strong>：画面比声音先动，这通常因为音频缓冲比动画链更长。'
            : ' 恰好对齐——但这是静态参数下的巧合，负载一变就会漂。') +
        ' 阈值 80 / 160 ms 是<strong>经验量级</strong>，不是某个标准的硬性规定。';
    }
    drawTiming();
  }

  function initTiming() {
    [['d10-t-tts', 'tts'], ['d10-t-vis', 'vis'], ['d10-t-render', 'render'], ['d10-t-buf', 'buf']].forEach(function (pair) {
      var el = d(pair[0]);
      if (!el) return;
      LK.range(el, pair[0] + '-out', function (v) { return v + ' ms'; }, function (v) { tm[pair[1]] = v; calcTiming(); });
    });
    var host = d('d10-t-canvas');
    if (host) {
      tmCanvas = LK.canvas(host, 142);
      if (tmCanvas) { tmCanvas.onresize = drawTiming; redraws.push(drawTiming); }
    }
    calcTiming();
  }

  /* ------------------------------------------------------------- failures */
  var FAILS = [
    {
      name: '① 声音到了嘴不动',
      symptom: '音频已经出声，嘴形还是中性或上一个口型，持续几十到几百毫秒',
      how: '先量两个时刻：音频真正出声（含设备缓冲）与 viseme 首帧显示。若后者晚，问题在驱动链；若两者都晚但音频先到，问题在缓冲',
      cause: 'viseme 在音频之后串行计算；动画帧率过低；口型权重没有在音频起点重置',
      fix: '用音频时钟驱动动画；viseme 预计算；在音频起点强制对齐首帧口型',
      layer: '驱动（部分在同步）',
      verify: '未运行。只能写“设计上应消除，待测偏移量”，不能写“已改善 X ms”'
    },
    {
      name: '② 嘴先动，声音后到',
      symptom: '画面已经开始说话，声音延迟才出来；越到后面差距越明显',
      how: '量音频缓冲深度与动画启动基准。如果动画用的是“文本生成时刻”而不是“出声时刻”，必然提前',
      cause: '设备缓冲深；播放器预填充；动画起点取了错误的时间基准',
      fix: '降低缓冲（有卡顿风险）；或把动画 0 点锚定到出声时刻；最佳是按播放位置反查 viseme',
      layer: '同步',
      verify: '未运行。缓冲深度依设备而异，没有实测就没有数字'
    },
    {
      name: '③ 旧情绪污染新话轮',
      symptom: '用户打断后，新回答仍沿用上一句的愤怒表情 / 语气，几秒后才缓和',
      how: '检查表情指令是否携带 turn_id / epoch；检查打断时是否有显式“回中性”动作与过渡时长',
      cause: '表情参数是状态量，没有随 epoch 重置；动作层没有 cancel 语义',
      fix: '表情指令带版本；打断时插入回中性过渡；渲染层拒绝旧 epoch 的指令（与 Day 9 的四道闸门同构）',
      layer: '状态（不是时序）',
      verify: '未运行。这条只能靠构造“打断 + 情绪切换”的合成用例来测'
    }
  ];
  var failIdx = 0;

  function renderFail(i) {
    failIdx = i;
    var f = FAILS[i];
    var host = d('d10-f-detail');
    if (host) {
      host.innerHTML =
        '<div class="case-card"><h4>症状</h4><p>' + f.symptom + '</p></div>' +
        '<div class="case-card"><h4>怎么定位</h4><p>' + f.how + '</p></div>' +
        '<div class="case-card"><h4>可能原因</h4><p>' + f.cause + '</p></div>' +
        '<div class="case-card"><h4>修复方案</h4><p>' + f.fix + '</p></div>' +
        '<div class="case-card"><h4>验证状态</h4><p>' + f.verify + '</p></div>';
    }
    LK.text('d10-f-name', f.name);
    LK.text('d10-f-layer', f.layer);
    var note = d('d10-f-note');
    if (note) {
      note.textContent = f.name + ' 的病灶在「' + f.layer + '」。' +
        (i === 2 ? '把它当成时序问题去调延迟永远调不好——它的错误不在时间上，在版本上。' : '它属于时序问题，可以用偏移量来量化。');
    }
    var tabs = LK.$$('#d10-f-tabs button');
    tabs.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  function initFails() {
    var tabs = LK.$$('#d10-f-tabs button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { renderFail(parseInt(b.dataset.fail, 10) || 0); });
    });
    renderFail(0);
  }

  /* ---------------------------------------------------------------- scope */
  var SCOPE = [
    '用开源渲染器加载角色并出画',
    '把语音切成音素并映射到口型权重',
    '设计“情绪标签 → 表情参数”的映射规则',
    '改造上游驱动模块以支持打断后回中性',
    '实现多人并发会话的状态隔离',
    '把系统接到人形机器人并做触摸安全限位'
  ];
  var SCOPE_OPTS = ['未标注', '本人做过', '团队成果', '开源现有功能', '拟研究'];

  function renderScope() {
    var host = d('d10-s-rows');
    if (!host) return;
    host.innerHTML = SCOPE.map(function (txt, i) {
      var opts = SCOPE_OPTS.map(function (o) {
        return '<option value="' + o + '"' + (o === '未标注' ? ' selected' : '') + '>' + o + '</option>';
      }).join('');
      return '<tr><td>' + txt + '</td><td><select class="form-select" id="d10-s-' + i + '" aria-label="条目 ' + (i + 1) + ' 的类别">' + opts + '</select></td></tr>';
    }).join('');
    for (var i = 0; i < SCOPE.length; i++) {
      var sel = d('d10-s-' + i);
      if (sel) sel.addEventListener('change', calcScope);
    }
    calcScope();
  }

  function calcScope() {
    var counts = {};
    var marked = 0;
    for (var i = 0; i < SCOPE.length; i++) {
      var sel = d('d10-s-' + i);
      var v = sel ? sel.value : '未标注';
      if (v !== '未标注') marked++;
      counts[v] = (counts[v] || 0) + 1;
    }
    LK.text('d10-s-count', marked + ' / ' + SCOPE.length);
    var verdict = d('d10-s-verdict');
    if (verdict) {
      if (marked < SCOPE.length) verdict.textContent = '还有 ' + (SCOPE.length - marked) + ' 行未标注';
      else if ((counts['本人做过'] || 0) >= 5) verdict.textContent = '高风险：几乎全归自己';
      else if ((counts['开源现有功能'] || 0) >= 3) verdict.textContent = '偏保守，可信度高';
      else verdict.textContent = '标注完成';
      verdict.style.color = (marked === SCOPE.length && (counts['本人做过'] || 0) >= 5) ? (P().bad || '#bd403b') : '';
    }
    var note = d('d10-s-note');
    if (!note) return;
    if (marked < SCOPE.length) {
      note.textContent = '还有 ' + (SCOPE.length - marked) + ' 行没标。四类里最容易出事的是“开源现有功能”被写成“我实现了”——判断标准：如果上游仓库明天删掉，我的系统还能不能跑？';
    } else if ((counts['本人做过'] || 0) >= 5) {
      note.textContent = '六行里五行都标成“本人做过”，这在面试第二层追问下几乎一定会露。真实项目里通常至少有一两行是开源底座或团队协作。';
    } else {
      note.textContent = '标注完成。这个分布（本人 ' + (counts['本人做过'] || 0) + ' / 团队 ' + (counts['团队成果'] || 0) +
        ' / 开源 ' + (counts['开源现有功能'] || 0) + ' / 拟研究 ' + (counts['拟研究'] || 0) + '）看起来可信——它承认了依赖，也没把设想说成成果。';
    }
  }

  /* ----------------------------------------------------------------- exam */
  function calcExam() {
    var n = 0;
    for (var i = 1; i <= 6; i++) {
      var el = d('d10-ex-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d10-ex-count', n + ' / 6');
    var level = d('d10-ex-level');
    if (level) {
      var text;
      if (n === 0) text = '未开始';
      else if (n < 4) text = '纸面设计';
      else if (n < 6) text = '接近完整';
      else text = '概念 + 纸面设计（验证待补）';
      level.textContent = text;
    }
  }

  function initExam() {
    for (var i = 1; i <= 6; i++) {
      var el = d('d10-ex-' + i);
      if (el) el.addEventListener('change', calcExam);
    }
    calcExam();
  }

  /* ---------------------------------------------------------------- score */
  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d10-sc-' + i);
      var out = d('d10-sc-' + i + '-out');
      var v = el ? parseInt(el.value, 10) : 0;
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d10-sc-total', total + ' / 20');
    var tip = '先分清四层';
    if (total >= 17) tip = '可以进入下一轮追问';
    else if (total >= 13) tip = '补一条实测偏移';
    else if (total >= 9) tip = '把贡献四格标完';
    LK.text('d10-sc-tip', tip);
    var note = d('d10-sc-note');
    if (note) {
      note.textContent = total >= 17
        ? '这个分数说明四层都分得清了。下一步准备“连续两次为什么”：为什么用这个表示、为什么这个延迟可接受。'
        : '总分 ' + total + ' / 20。最短的补法是先把六行贡献标完（真实性），再给音画偏移做一次实测（验证）——这两项都不需要跑模型。';
    }
  }

  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d10-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    P = LK.palette;
    initReps();
    initMatrix();
    initGs();
    initFace();
    initTiming();
    initFails();
    renderScope();
    initExam();
    initScore();
  }

  if (window.MutationObserver) {
    new MutationObserver(function () {
      redraws.forEach(function (fn) { try { fn(); } catch (e) {} });
      calcScope();
      calcScore();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
