/* Day 14 — mock interview, evidence audit, narrative structure. Vanilla, offline. */
(function () {
  'use strict';

  var redraws = [];
  function d(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function fixed(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }
  function rgba(hex, a) {
    var h = (hex || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* -------------------------------------------------------- 01 cards */
  var TAGS = ['待核实', '本人实做', '团队成果', '开源 / 现成', '未来计划'];
  var FIELDS = [
    ['项目名', '一句话说清它是什么、给谁用'],
    ['真实需求 / 研究问题', '谁提出的？不解决会怎样？'],
    ['我的职责', '只写亲自做过 / 亲自决策过的部分'],
    ['团队公开成果', '不揽为个人独立成果；写清是谁的'],
    ['关键输入 / 中间表示 / 输出', '数据从哪来、变成什么、交给谁'],
    ['为什么用它 / 其他方案', '当时比较过什么，为什么选这个'],
    ['自己遇到的失败与修订', '一次具体的失败 + 你怎么改的'],
    ['现有证据与可披露来源', '代码 / 日志 / 录音 / 回执，能指认到哪一层'],
    ['尚未完成 / 需第三方验证', '明确写出“还没做”的部分'],
    ['入营第一阶段：和谁协作、验收什么', '人 + 交付物 + 判定标准']
  ];
  var PROJECTS = [
    { key: 'intern', name: '实习期项目', tags: [1, 1, 1, 1, 0, 0, 0, 0, 2, 4] },
    { key: 'lab', name: '实验室 / 合作项目', tags: [1, 1, 1, 1, 0, 0, 0, 0, 0, 4] },
    { key: 'startup', name: '创业 / 产品项目', tags: [1, 1, 1, 1, 0, 0, 0, 0, 0, 4] },
    { key: 'personal', name: '个人作品集项目', tags: [1, 1, 1, 2, 1, 0, 1, 0, 1, 4] },
    { key: 'plan', name: '拟研究项目', tags: [1, 4, 4, 2, 0, 0, 0, 2, 0, 4] }
  ];
  var cardKey = 'intern';
  var cardState = {};
  PROJECTS.forEach(function (p) { cardState[p.key] = p.tags.slice(); });

  function renderCards() {
    var tabs = d('d14-cd-tabs');
    if (tabs && !tabs.children.length) {
      tabs.innerHTML = PROJECTS.map(function (p) {
        return '<button type="button" aria-pressed="' + (p.key === cardKey ? 'true' : 'false') + '" data-proj="' + p.key + '">' + p.name + '</button>';
      }).join('');
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-proj]');
        if (!btn) return;
        cardKey = btn.dataset.proj;
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        renderCards();
      });
    }
    var tags = cardState[cardKey];
    var body = d('d14-cd-body');
    if (body) {
      body.innerHTML = FIELDS.map(function (f, i) {
        var t = tags[i];
        var cls = t === 0 ? 'chip' : (t === 1 ? 'chip is-on' : 'chip');
        return '<tr><td><strong>' + f[0] + '</strong></td><td style="font-size:12px;color:var(--muted-foreground)">' + f[1] + '</td>' +
          '<td><button type="button" class="' + cls + '" data-field="' + i + '" style="cursor:pointer">' + TAGS[t] + '</button></td></tr>';
      }).join('');
      body.onclick = function (e) {
        var btn = e.target.closest('button[data-field]');
        if (!btn) return;
        var i = parseInt(btn.dataset.field, 10);
        tags[i] = (tags[i] + 1) % TAGS.length;
        renderCards();
      };
    }
    var known = tags.filter(function (t) { return t !== 0; }).length;
    var unknown = 10 - known;
    var own = tags.filter(function (t) { return t === 1; }).length;
    LK.text('d14-cd-count', known + ' / 10');
    var risk, riskCls;
    if (unknown >= 4) { risk = '高'; riskCls = 'bad'; }
    else if (unknown >= 1) { risk = '中'; riskCls = 'warn'; }
    else if (own >= 9) { risk = '中（可能说过头）'; riskCls = 'warn'; }
    else { risk = '低'; riskCls = 'ok'; }
    var rEl = d('d14-cd-risk');
    if (rEl) { rEl.textContent = risk; rEl.className = riskCls; }
    LK.text('d14-cd-len', '约 ' + Math.max(0.5, known * 0.15).toFixed(1) + ' 分钟');
    var note = d('d14-cd-note');
    if (note) {
      if (unknown >= 4) {
        var pending = [];
        tags.forEach(function (t, i) { if (t === 0) pending.push(i + 1); });
        var first = FIELDS[tags.indexOf(0)];
        note.innerHTML = '还有 <strong>' + unknown + '</strong> 个字段停在“待核实”（第 ' + pending.join('、') + ' 项）。这些格子就是面试官会伸手去戳的地方——' +
          '<strong>任何一个“待核实”被戳破，都会连带削弱你答得最好的那部分</strong>。' +
          '先补离证据最近的那个：<strong>“' + first[0] + '”</strong>——' + first[1] + '。';
      } else if (own >= 9) {
        note.innerHTML = '十个字段里 <strong>' + own + '</strong> 个都标成“本人实做”。这不一定是假的，但它会让面试官进入<strong>验证模式</strong>：' +
          '他会假定你能对每一处细节负责，然后逐项追问。<strong>更稳的做法是主动把至少 2–3 项降级为“团队成果 / 开源 / 未来计划”——这不掉分，反而建立信用。</strong>';
      } else {
        note.innerHTML = '归属已经比较清楚（<strong>' + known + ' / 10</strong>）。现在检查两件事：' +
          '① 第 7 项（失败与修订）有没有一个<strong>具体到参数或现象</strong>的例子；② 第 9 项（尚未完成）有没有写出<strong>明确的不确定点</strong>。' +
          '这两项是“可信度”的主要来源，缺了它们，其余八项都像自述。';
      }
    }
  }
  function initCards() { renderCards(); }

  /* ------------------------------------------------------- 02 claims */
  var EVID = [
    { k: 'memory', label: '只有记忆 / 转述', rank: 1 },
    { k: 'repo', label: '代码或设计文档', rank: 2 },
    { k: 'log', label: '运行日志 / 截图 / 录音', rank: 3 },
    { k: 'official', label: '测试报告 / 回执 / 可查记录', rank: 4 }
  ];
  var CLAIMS = [
    { text: '“在 XX 项目中负责 A 模块”', need: 2,
      limit: '加限定：“负责 A 模块中的 X 部分，Y 是同事做的”',
      drop: '改成“参与 XX 项目的 A 部分”，或只写团队成果' },
    { text: '“独立完成了 XX 系统”', need: 3,
      limit: '加限定：“独立完成 X 到 Y 的链路，其中 Z 用了开源实现”',
      drop: '改成“搭建了 XX 原型（部分模块复用开源）”' },
    { text: '“已上线 / 部署到 N 台设备”', need: 3,
      limit: '加限定：“在 N 台设备上连续运行 X 小时，失败率 Y”',
      drop: '改成“在实验室环境下完成原型验证，未做规模部署”' },
    { text: '“准确率 98%”', need: 4,
      limit: '加限定：给出测试集、对照真值、指标定义与适用范围',
      drop: '删掉百分比，改成“在 XX 条件下主观可用”，或写“未标定”' },
    { text: '“获得 XX 奖 / 入选 XX 营”', need: 4,
      limit: '加限定：注明年份、层级、个人/团队',
      drop: '标“待核实”，拿到回执前不写' },
    { text: '“实习两期 / 两段实习”', need: 4,
      limit: '加限定：写清起止时间与团队归属',
      drop: '标“待核实”，时间与期数必须与记录一致' }
  ];
  var claimSel = ['memory', 'repo', 'log', 'official', 'memory', 'repo'].concat(CLAIMS.map(function () { return 'memory'; })).slice(0, CLAIMS.length);
  function renderClaims() {
    var body = d('d14-cl-body');
    if (body) {
      body.innerHTML = CLAIMS.map(function (c, i) {
        var ev = EVID.filter(function (e) { return e.k === claimSel[i]; })[0];
        var verdict, cls, detail;
        if (ev.rank >= c.need) { verdict = '可原样写'; cls = 'ok'; detail = '证据等级够：' + ev.label; }
        else if (ev.rank === c.need - 1) { verdict = '必须加限定'; cls = 'warn'; detail = c.limit; }
        else { verdict = '必须改写或删掉'; cls = 'bad'; detail = c.drop; }
        return '<tr><td>' + c.text + '</td><td>' +
          '<select id="d14-cl-s-' + i + '" aria-label="' + c.text + ' 的证据">' +
          EVID.map(function (e) {
            return '<option value="' + e.k + '"' + (e.k === claimSel[i] ? ' selected' : '') + '>' + e.label + '</option>';
          }).join('') + '</select></td>' +
          '<td><span class="flag ' + cls + '">' + verdict + '</span><div style="font-size:11.5px;color:var(--muted-foreground);margin-top:3px">' + detail + '</div></td></tr>';
      }).join('');
      body.onchange = function (e) {
        var sel = e.target.closest('select');
        if (!sel) return;
        var i = parseInt(sel.id.replace('d14-cl-s-', ''), 10);
        claimSel[i] = sel.value;
        renderClaims();
      };
    }
    var ok = 0, lim = 0, drop = 0;
    CLAIMS.forEach(function (c, i) {
      var ev = EVID.filter(function (e) { return e.k === claimSel[i]; })[0];
      if (ev.rank >= c.need) ok++;
      else if (ev.rank === c.need - 1) lim++;
      else drop++;
    });
    LK.text('d14-cl-ok', String(ok));
    LK.text('d14-cl-limit', String(lim));
    LK.text('d14-cl-drop', String(drop));
    var note = d('d14-cl-note');
    if (note) {
      if (drop >= 2) {
        note.innerHTML = '有 <strong>' + drop + '</strong> 条断言的证据等级低于它的表述强度。这不是“不诚实”，而是<strong>表述跑到了证据前面</strong>——只要把它降到证据能支撑的那一档，同一个事实反而更可信。' +
          '特别注意带数字的（准确率、台数、期数）和带评级的（获奖、入选）：它们最容易被现场要求出示证据。<strong>降级的成本是几秒钟的措辞，硬撑的成本是整场面试的可信度。</strong>';
      } else if (lim >= 2) {
        note.innerHTML = '大体站得住，但有 <strong>' + lim + '</strong> 条需要加限定。加限定的诀窍是<strong>把条件写进句子</strong>：不是“部署了”，而是“在 N 台设备上跑了 X 小时”；' +
          '不是“98%”，而是“在 XX 测试集上与人工标注对照（指标定义为 …）”。<strong>限定词不会削弱结论，它让结论变得可验证。</strong>';
      } else {
        note.innerHTML = '六条断言和证据基本对齐。最后再做一次<strong>反向检查</strong>：假设面试官只挑一条深挖三层，你会挑哪条？' +
          '<strong>把最经不起追问的那条主动降一级</strong>，比等它被问到更划算。';
      }
    }
  }
  function initClaims() { renderClaims(); }

  /* -------------------------------------------------------- 03 intro */
  var inState = null;
  var inBudget = 90;
  var IN_SEGMENTS = [
    { key: 's1', name: '开场：身份 + 主线', color: 's1' },
    { key: 's2', name: '证据：两个能核实的东西', color: 's4' },
    { key: 's3', name: '取舍：一个真实决定', color: 's2' },
    { key: 's4', name: '计划：入营要做什么', color: 's3' }
  ];
  function drawIntro() {
    if (!inState) return;
    var P = LK.palette();
    var s = inState, ctx = s.ctx;
    LK.clear(s, P.card);
    var vals = IN_SEGMENTS.map(function (sg) { return parseFloat(d('d14-in-' + sg.key).value); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    IN_SEGMENTS.forEach(function (sg, i) { LK.text('d14-in-' + sg.key + '-out', vals[i] + ' s'); });
    LK.text('d14-in-total', total + ' s');
    var over = total - inBudget;
    var overEl = d('d14-in-over');
    if (overEl) {
      overEl.textContent = over > 0 ? '超时 ' + over + ' s' : (over < 0 ? '剩余 ' + (-over) + ' s' : '刚好');
      overEl.className = over > 0 ? 'bad' : (over < -inBudget * 0.15 ? 'warn' : 'ok');
    }
    /* which segment gets cut */
    var cut = '没有';
    var acc = 0;
    for (var i = 0; i < vals.length; i++) {
      acc += vals[i];
      if (acc > inBudget) { cut = IN_SEGMENTS[i].name; break; }
    }
    LK.text('d14-in-cut', cut);

    var mL = 26, mR = 26, mT = 30, mB = 46;
    var w = s.w - mL - mR, h = 96;
    var span = Math.max(total, inBudget) * 1.04;
    function X(t) { return mL + t / span * w; }
    var y = mT;

    /* bars */
    var acc2 = 0;
    IN_SEGMENTS.forEach(function (sg, i) {
      var x0 = X(acc2), x1 = X(acc2 + vals[i]);
      ctx.fillStyle = rgba(P[sg.color], 0.55);
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), h);
      ctx.strokeStyle = P.card;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y, Math.max(1, x1 - x0), h);
      if (x1 - x0 > 46) {
        LK.label(ctx, String(vals[i]) + 's', (x0 + x1) / 2, y + h / 2, P.fg, 12, 'center');
      }
      LK.label(ctx, '①②③④'[i], (x0 + x1) / 2, y - 9, rgba(P[sg.color], 1), 11, 'center');
      acc2 += vals[i];
    });

    /* budget marker */
    var bx = X(inBudget);
    ctx.strokeStyle = P.fg;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(bx, y - 16); ctx.lineTo(bx, y + h + 12); ctx.stroke();
    ctx.setLineDash([]);
    LK.label(ctx, '时间到 ' + inBudget + ' s', bx, y + h + 24, P.fg, 10, 'center');

    /* overflow hatch */
    if (total > inBudget) {
      ctx.fillStyle = rgba(P.bad, 0.5);
      ctx.fillRect(bx, y, Math.max(1, X(total) - bx), h);
      LK.label(ctx, '这部分会被打断', (bx + X(total)) / 2, y + h + 24, P.bad, 10, 'center');
    }

    /* remaining budget: show what the empty space costs */
    if (total < inBudget) {
      ctx.fillStyle = rgba(P.bad, 0.055);
      ctx.fillRect(X(total), y, Math.max(1, bx - X(total)), h);
      if (bx - X(total) > 68) {
        LK.label(ctx, '空着 ' + (inBudget - total) + ' s', (X(total) + bx) / 2, y + h / 2, P.muted, 10, 'center');
      }
    }

    /* legend */
    IN_SEGMENTS.forEach(function (sg, i) {
      LK.label(ctx, '①②③④'.charAt(i) + ' ' + sg.name, mL, y + h + 46 + i * 15, P.muted, 10, 'left');
    });

    var note = d('d14-in-note');
    if (note) {
      if (over > 0) {
        note.innerHTML = '已经超时 <strong>' + over + ' 秒</strong>，第一个被打断的是<strong>' + cut + '</strong>。' +
          '注意这个顺序：<strong>超时永远从后面吃</strong>，而被吃掉的“计划”恰恰是面试官判断“你来了要做什么”的唯一依据。' +
          '所以宁可把“取舍”压短 5 秒，也要给“计划”留完整的一段。';
      } else if (cut === '没有' && total < inBudget * 0.85) {
        note.innerHTML = '只用了 <strong>' + total + ' 秒</strong>，还剩 ' + (inBudget - total) + ' 秒。' +
          '空着的时间会被面试官用提问填满，而提问的方向你无法选择。<strong>主动把它用掉——补一个具体的失败细节，比留白安全。</strong>';
      } else {
        note.innerHTML = '结构完整：<strong>' + total + ' 秒</strong>，四段都在预算内。检查一下比例——' +
          '“证据”段（②）应当是最长的，如果它比“计划”还短，说明你在讲身份而不是在讲能力。' +
          '<strong>面试官记住的永远是证据，不是形容词。</strong>';
      }
    }
  }
  function initIntro() {
    var s = LK.canvas('d14-in-canvas', 232);
    if (!s) return;
    inState = s;
    s.onresize = drawIntro;
    var tabs = d('d14-in-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-len]');
        if (!btn) return;
        inBudget = parseInt(btn.dataset.len, 10);
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        /* re-scale weights into the new budget, then fix rounding drift on the longest one */
        var vals = IN_SEGMENTS.map(function (sg) { return parseFloat(d('d14-in-' + sg.key).value); });
        var tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
        var scaled = vals.map(function (v) { return Math.max(1, Math.round(v / tot * inBudget)); });
        var drift = scaled.reduce(function (a, b) { return a + b; }, 0) - inBudget;
        if (drift !== 0) {
          var big = scaled.indexOf(Math.max.apply(null, scaled));
          scaled[big] = Math.max(1, scaled[big] - drift);
        }
        IN_SEGMENTS.forEach(function (sg, i) { d('d14-in-' + sg.key).value = scaled[i]; });
        drawIntro();
      });
    }
    IN_SEGMENTS.forEach(function (sg) {
      var el = d('d14-in-' + sg.key);
      if (el) el.addEventListener('input', drawIntro);
    });
    redraws.push(drawIntro);
    drawIntro();
  }

  /* ------------------------------------------------------ 04 timebox */
  var tbState = null;
  var tbRound = 1;
  var ROUNDS = {
    1: { name: '第一轮（技术）', q: 3, blocks: [
      { name: '开场 90 秒自介', min: 1.5 },
      { name: '技术深挖：环境 / 场景 / 项目', min: 15 },
      { name: '机器人环境与任务合同', min: 15 },
      { name: '科研方法与入营目标', min: 13.5 }
    ] },
    2: { name: '第二轮（项目）', q: 4, blocks: [
      { name: '腾讯两期 / INZ', min: 20 },
      { name: '陪伴机器人与天穹慧眼', min: 10 },
      { name: 'Rove / AI Partner', min: 5 },
      { name: '真实贡献与产品取舍', min: 8 },
      { name: '反问', min: 2 }
    ] }
  };
  function drawTimebox() {
    if (!tbState) return;
    var P = LK.palette();
    var s = tbState, ctx = s.ctx;
    LK.clear(s, P.card);
    var late = parseFloat(d('d14-tb-late').value);
    var ctrl = parseFloat(d('d14-tb-ctrl').value);
    LK.text('d14-tb-late-out', '+' + late + ' min');
    LK.text('d14-tb-ctrl-out', ['几乎不', '有时', '经常'][ctrl]);
    var R = ROUNDS[tbRound];
    var extra = late * R.q - ctrl * 2;
    extra = Math.max(0, extra);

    /* compress from the end, floor at 40% of original */
    var blocks = R.blocks.map(function (b) { return { name: b.name, min: b.min, lost: 0 }; });
    var need = extra;
    for (var i = blocks.length - 1; i >= 0 && need > 0.01; i--) {
      var floor = blocks[i].min * 0.4;
      var take = Math.min(need, blocks[i].min - floor);
      blocks[i].min -= take;
      blocks[i].lost = take;
      need -= take;
    }
    var total = blocks.reduce(function (a, b) { return a + b.min; }, 0) + need;  /* 挤压后剩余内容 = 45 - (extra - need) */
    var used = 45 + need;                                                        /* 实际会用到：压不下去的部分拖长总时长 */
    LK.text('d14-tb-total', fixed(used, 1) + ' min');

    var mL = 22, mR = 22, mT = 34, mB = 40;
    var w = s.w - mL - mR, h = 84;
    var scale = w / (Math.max(45, used) * 1.08);
    var y = mT;
    var acc = 0;
    blocks.forEach(function (b) {
      var x0 = mL + acc * scale, bw = b.min * scale;
      ctx.fillStyle = rgba(P.s1, 0.45);
      ctx.fillRect(x0, y, Math.max(1, bw), h);
      if (b.lost > 0.1) {
        var lw = b.lost * scale;
        ctx.fillStyle = rgba(P.s2, 0.5);
        ctx.fillRect(x0 + bw, y, Math.max(1, lw), h);
        ctx.strokeStyle = rgba(P.bad, 0.55);
        ctx.lineWidth = 1;
        for (var hx = x0 + bw + 3; hx < x0 + bw + lw; hx += 5) {
          ctx.beginPath(); ctx.moveTo(hx, y + h); ctx.lineTo(hx + 5, y);
          ctx.stroke();
        }
        ctx.strokeStyle = P.card;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + bw, y, Math.max(1, lw), h);
      }
      ctx.strokeStyle = P.card;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y, Math.max(1, bw), h);
      if (bw > 52) {
        LK.label(ctx, fixed(b.min, 1) + ' min', x0 + bw / 2, y + h / 2 - 7, P.fg, 11, 'center');
        LK.label(ctx, b.name.slice(0, 10), x0 + bw / 2, y + h / 2 + 9, P.muted, 9, 'center');
      }
      acc += b.min;
    });
    /* budget line */
    var bx = mL + 45 * scale;
    ctx.strokeStyle = P.bad;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(bx, y - 11); ctx.lineTo(bx, y + h + 10); ctx.stroke();
    ctx.setLineDash([]);
    LK.label(ctx, '45 min 预算', bx - 9, y - 8, P.bad, 10, 'right');
    LK.label(ctx, '深绿 = 讲得完的部分；土黄 = 被追问吃掉的部分（从最后一块往前扣）', mL, y - 8, P.muted, 10, 'left');

    /* per-block table-ish rows */
    blocks.forEach(function (b, i) {
      var by = y + h + 46 + i * 16;
      ctx.fillStyle = rgba(b.lost > 0.1 ? P.bad : P.muted, b.lost > 0.1 ? 0.9 : 0.75);
      LK.label(ctx, b.name + '：' + fixed(b.min, 1) + ' min' + (b.lost > 0.1 ? '（少 ' + fixed(b.lost, 1) + '）' : ''), mL, by, b.lost > 0.1 ? P.bad : P.muted, 10, 'left');
    });

    var worst = blocks.slice().sort(function (a, b) { return b.lost - a.lost; })[0];
    LK.text('d14-tb-worst', worst.lost > 0.1 ? worst.name : '—');
    var riskEl = d('d14-tb-risk');
    var risk, rCls;
    if (need > 0.5) { risk = '会超过 45 分钟'; rCls = 'bad'; }
    else if (worst.lost > worst.min * 0.35 + 0.5) { risk = '关键块被削'; rCls = 'warn'; }
    else { risk = '可控'; rCls = 'ok'; }
    if (riskEl) { riskEl.textContent = risk; riskEl.className = rCls; }

    var note = d('d14-tb-note');
    if (note) {
      note.innerHTML = '每个问题平均多聊 <strong>' + late + ' 分钟</strong>，' + R.q + ' 个追问点就是 +' + fixed(late * R.q, 0) +
        ' 分钟；你主动控场 ' + ['几乎不', '有时', '经常'][ctrl] + '，能拉回约 ' + fixed(ctrl * 2, 0) + ' 分钟。' +
        (extra > 0
          ? '净超时 <strong>+' + fixed(extra, 1) + ' 分钟</strong>，全部从<strong>最后几块</strong>往前扣——扣到“' + (worst.lost > 0.1 ? worst.name : '—') + '”时只剩 ' +
            fixed(worst.min, 1) + ' 分钟' + (need > 0.5 ? '，再扣就讲不完了，于是整场<strong>拖长 ' + fixed(need, 1) + ' 分钟</strong>。' : '。') +
            '<strong>这就是为什么很多人面试完觉得“最重要的没说”</strong>：不是没准备，是它排在最后。'
          : '没有超时压力。<strong>但仍然建议留 3 分钟给最后一块</strong>——它是唯一能让你“反客为主”的部分。');
    }
  }
  function initTimebox() {
    var s = LK.canvas('d14-tb-canvas', 232);
    if (!s) return;
    tbState = s;
    s.onresize = drawTimebox;
    var tabs = d('d14-tb-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-round]');
        if (!btn) return;
        tbRound = parseInt(btn.dataset.round, 10);
        Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        drawTimebox();
      });
    }
    ['d14-tb-late', 'd14-tb-ctrl'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('input', drawTimebox);
    });
    redraws.push(drawTimebox);
    drawTimebox();
  }

  /* --------------------------------------------------------- 05 line */
  var lnState = null;
  var LAYERS = ['① 空间与任务环境', '② 机器人执行验证', '③ 多模态陪伴交互'];
  var LN_PROJECTS = [
    { name: '场景 / 环境生成', layer: 0 },
    { name: 'UE / TA 作品集', layer: 0 },
    { name: '执行与评测', layer: 1 },
    { name: 'Rove 远程共处', layer: 2 },
    { name: '陪伴机器人', layer: 2 },
    { name: 'AI 虚拟人', layer: 2 }
  ];
  function drawLine() {
    if (!lnState) return;
    var P = LK.palette();
    var s = lnState, ctx = s.ctx;
    LK.clear(s, P.card);

    var chips = d('d14-ln-chips');
    if (chips) {
      chips.innerHTML = LN_PROJECTS.map(function (p, i) {
        return '<button type="button" class="chip is-on" data-lp="' + i + '" style="cursor:pointer" title="点一下换一层" aria-label="' + p.name + '，当前在第 ' + (p.layer + 1) + ' 层，点击切换">' + p.name + ' · ' + '①②③'.charAt(p.layer) + '</button>';
      }).join('');
      chips.onclick = function (e) {
        var btn = e.target.closest('button[data-lp]');
        if (!btn) return;
        var i = parseInt(btn.dataset.lp, 10);
        LN_PROJECTS[i].layer = (LN_PROJECTS[i].layer + 1) % 3;
        drawLine();
      };
    }

    var mL = 30, mR = 26, mT = 22;
    var rowH = 60, gap = 16;
    var w = s.w - mL - mR;
    var SCRIPT = [
      '一句话版本：我先把任务变成一个可执行的场景（语义 + 空间约束 → UE）。',
      '一句话版本：再用可复现的判定说它成没成（协议 + 失败模式 + 日志）。',
      '一句话版本：最后处理感知边界与授权（什么时候该拒绝）。'
    ];
    var counts = [0, 0, 0];
    LN_PROJECTS.forEach(function (p) { counts[p.layer]++; });
    /* 左侧竖向导轨：把三层连成一条线，而不是三个孤立盒子 */
    ctx.strokeStyle = rgba(P.primary, 0.28);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(mL - 15, mT + rowH / 2);
    ctx.lineTo(mL - 15, mT + 2 * (rowH + gap) + rowH / 2);
    ctx.stroke();
    for (var ai = 0; ai < 2; ai++) {
      var ay = mT + ai * (rowH + gap) + rowH + gap / 2;
      LK.arrow(ctx, mL - 15, ay - 4, mL - 15, ay + 4, rgba(P.primary, 0.4), 1.4);
    }
    LAYERS.forEach(function (name, li) {
      var y = mT + li * (rowH + gap);
      ctx.fillStyle = rgba(P.primary, counts[li] ? 0.07 : 0.03);
      ctx.fillRect(mL, y, w, rowH);
      ctx.strokeStyle = counts[li] ? rgba(P.primary, 0.35) : P.border;
      ctx.lineWidth = 1;
      if (!counts[li]) ctx.setLineDash([5, 4]);
      ctx.strokeRect(mL, y, w, rowH);
      ctx.setLineDash([]);
      LK.label(ctx, name, mL + 12, y + 15, counts[li] ? P.primary : P.muted, 11, 'left');
      LK.label(ctx, SCRIPT[li], mL + w - 12, y + 15, P.muted, 9.5, 'right');
      var items = LN_PROJECTS.filter(function (p) { return p.layer === li; });
      if (!items.length) {
        LK.label(ctx, '（这一层是空的——面试官会立刻发现这里有断点）', mL + 12, y + 40, P.muted, 10, 'left');
      } else {
        var x = mL + 12;
        items.forEach(function (p) {
          var tw = p.name.length * 10.5 + 18;
          ctx.fillStyle = rgba(P.primary, 0.13);
          ctx.strokeStyle = rgba(P.primary, 0.22);
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y + 27, tw, 23, 5);
          else ctx.rect(x, y + 27, tw, 23);
          ctx.fill(); ctx.stroke();
          LK.label(ctx, p.name, x + tw / 2, y + 38.5, P.fg, 10, 'center');
          x += tw + 8;
        });
      }
    });

    var filled = counts.filter(function (c) { return c > 0; }).length;
    var maxC = Math.max.apply(null, counts);
    var score = filled === 3 ? (maxC <= 3 ? '清晰' : '偏科') : (filled === 2 ? '缺一层' : '未成形');
    LK.text('d14-ln-score', score + '（' + filled + '/3 层）');
    var gapIdx = counts.indexOf(Math.min.apply(null, counts));
    LK.text('d14-ln-gap', LAYERS[gapIdx].slice(2));
    var tip = d('d14-ln-tip');
    var note = d('d14-ln-note');
    if (filled < 3) {
      if (tip) tip.textContent = '补 ' + LAYERS[gapIdx].slice(0, 1) + ' 层';
      if (note) note.innerHTML = '有一层是空的。<strong>不要靠编一个项目来填</strong>——可以填“能力”而不是“项目”：' +
        '例如执行验证层可以填“做过一次带对照的评测设计”，哪怕它只是课程作业。<strong>面试官在意的是这条线有没有断点，不是每一层都有大项目。</strong>';
    } else if (maxC > 3) {
      if (tip) tip.textContent = '收敛到 ≤3 个';
      if (note) note.innerHTML = '三层都有，但有一层堆了 <strong>' + maxC + ' 个</strong>项目。堆太多会稀释主线：' +
        '面试官记不住六个名字，但能记住“这个人在环境层很扎实”。<strong>每层只留最能被追问的一个，其余降为“也做过”。</strong>';
    } else {
      if (tip) tip.textContent = '保持结构';
      if (note) note.innerHTML = '结构很干净：三层各有 <strong>1–3 个</strong>证据，主线立得住。' +
        '下一步是把每层的一句话版本写出来——“环境层我做的是 X，验证层我用 Y 判定，交互层我处理过 Z 的边界”——' +
        '<strong>这三句话就是 90 秒自介的骨架。</strong>';
    }
  }
  function initLine() {
    var s = LK.canvas('d14-ln-canvas', 252);
    if (!s) return;
    lnState = s;
    s.onresize = drawLine;
    redraws.push(drawLine);
    drawLine();
  }

  /* -------------------------------------------------------- 06 drill */
  var DRILL = [
    {
      q: '“你说你做过远程共处系统，具体做了什么？”',
      opts: [
        { t: '我做了双端坐标链和姿态消息格式，跑通的是原型，没做过真实设备的长时测试', d: 0, log: '✓ 具体 + 主动给边界' },
        { t: '整体架构都是我设计的，包括网络层和渲染', d: -25, log: '✗ 范围过大，下一问必被拆' },
        { t: '这个细节不重要，我更擅长系统设计', d: -15, log: '✗ 转移话题，读作回避' }
      ]
    },
    {
      q: '“为什么用共享锚点，而不是直接传世界坐标？”',
      opts: [
        { t: '因为两端本地帧不同源，必须有一个共同参考，否则变换无处落地', d: 0, log: '✓ 因果清晰' },
        { t: '业界都这么做', d: -20, log: '✗ 诉诸惯例，等于没答' },
        { t: '当时没比较过，这是我事后想到的两个方案', d: 5, log: '✓ 承认当时没比较，但给出了现在的思考' }
      ]
    },
    {
      q: '“考虑过别的方案吗？为什么不用？”',
      opts: [
        { t: '考虑过两端都用 STAGE，但设备不保证支持，所以我写了能力探测和降级', d: 5, log: '✓ 有替代方案 + 有降级设计' },
        { t: '没必要比较，我们这个方案就是最优的', d: -25, log: '✗ 绝对化表述，最容易被反例击穿' },
        { t: '还没系统比过，我只验证了这一条路', d: 0, log: '✓ 诚实，但暴露准备不足' }
      ]
    },
    {
      q: '“如果它失败了呢？你怎么知道它什么时候该停？”',
      opts: [
        { t: '预设了降级：断网就冻结姿态并停触觉；偏移超阈值就用参照物残差触发重对齐', d: 10, log: '✓ 有判定条件 + 有止损动作' },
        { t: '不会失败，我们测过', d: -30, log: '✗ 这句话会毁掉前三层的可信度' },
        { t: '还没跑到会失败的地方，这是我下一步要做的', d: 5, log: '✓ 明确边界，可继续深挖' }
      ]
    }
  ];
  var dr = { step: 0, cred: 100, log: [] };
  function renderDrill() {
    var chain = d('d14-dr-chain');
    if (chain) {
      chain.innerHTML = DRILL.map(function (x, i) {
        var cls = 'node' + (i === dr.step ? ' is-active' : (i < dr.step ? ' is-pass' : ''));
        return '<span class="' + cls + '">第 ' + (i + 1) + ' 层</span>' + (i < DRILL.length - 1 ? '<span class="arrow">→</span>' : '');
      }).join('');
    }
    var qHost = d('d14-dr-question');
    var actHost = d('d14-dr-actions');
    if (dr.step < DRILL.length) {
      var cur = DRILL[dr.step];
      if (qHost) qHost.innerHTML = '<div class="role-card is-active"><h4>面试官追问</h4><p style="font-size:13px;color:var(--foreground)">' + cur.q + '</p></div>';
      if (actHost) {
        actHost.innerHTML = cur.opts.map(function (o, i) {
          return '<button type="button" class="btn" data-opt="' + i + '">' + o.t + '</button>';
        }).join('');
        actHost.onclick = function (e) {
          var b = e.target.closest('button[data-opt]');
          if (!b) return;
          var i = parseInt(b.dataset.opt, 10);
          var o = cur.opts[i];
          dr.cred = clamp(dr.cred + o.d, 0, 100);
          dr.log.push('第 ' + (dr.step + 1) + ' 层：' + o.log + '（可信度 ' + (o.d >= 0 ? '+' : '') + o.d + '）');
          dr.step++;
          renderDrill();
        };
      }
    } else {
      if (qHost) {
        var end = dr.cred >= 90 ? '可以继续深挖 —— 这是好结果'
          : (dr.cred >= 70 ? '会被继续追问，但站得住'
            : (dr.cred >= 45 ? '面试官会要求你补证据' : '可信度已经受损，后面的答案都会被折价'));
        qHost.innerHTML = '<div class="role-card is-active"><h4>走完四层</h4><p style="font-size:13px;color:var(--foreground)">' +
          end + '。注意：<strong>每一层你都以为自己只是“答了一个问题”</strong>，但面试官在累积一个判断——这个人说的东西，能不能一直往下追。</p></div>';
      }
      if (actHost) {
        var rr = d('d14-dr-reset');
        if (rr) rr.textContent = '再来一次';
        actHost.innerHTML = '<p class="demo-note" style="margin:0">四层走完了。点右上角「再来一次」，换成“最好听”的那组答案对比一次。</p>';
        actHost.onclick = null;
      }
    }
    var logHost = d('d14-dr-log');
    if (logHost) logHost.innerHTML = dr.log.map(function (t) { return '<p>' + t + '</p>'; }).join('');
    LK.text('d14-dr-cred', String(dr.cred));
    var meter = d('d14-dr-meter');
    if (meter) {
      var fill = meter.firstElementChild;
      if (fill) fill.style.width = Math.max(2, dr.cred) + '%';
      meter.className = 'cred-meter' + (dr.cred < 45 ? ' is-bad' : (dr.cred < 75 ? ' is-warn' : ''));
    }
    LK.text('d14-dr-left', String(DRILL.length - dr.step));
    var endEl = d('d14-dr-end');
    if (endEl) {
      endEl.textContent = dr.step < DRILL.length ? '进行中'
        : (dr.cred >= 90 ? '过关' : (dr.cred >= 70 ? '可接受' : (dr.cred >= 45 ? '需补证据' : '受损')));
      endEl.className = dr.step < DRILL.length ? '' : (dr.cred >= 70 ? 'ok' : 'bad');
    }
    var note = d('d14-dr-note');
    if (note) {
      note.innerHTML = '试两次：第一次全选“最好听”的答案（架构都是我设计的 / 业界都这么做 / 没必要比较 / 不会失败），看可信度掉到哪里；' +
        '第二次全选“承认边界”的答案，看它会掉多少。<strong>你会发现后者几乎不掉分，而且第四层还能加分</strong>——' +
        '因为“我知道什么时候该停”本身就是一项能力。';
    }
  }
  function initDrill() {
    var reset = d('d14-dr-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        dr = { step: 0, cred: 100, log: [] };
        reset.textContent = '从头开始';
        renderDrill();
      });
    }
    renderDrill();
  }

  /* --------------------------------------------------------- 07 pack */
  var PACK = [
    { name: '第 1 页：能力画像', hint: '三层主线 + 一张示意图', lib: 'drawn' },
    { name: '第 2 页：实习研发', hint: '可披露的高层架构 + 你的角色', lib: 'real' },
    { name: '第 3 页：创业产品', hint: '产品流程 + 冲突处理树', lib: 'drawn' },
    { name: '第 4 页：入营验证计划', hint: '第一阶段做什么 + 怎么验收', lib: 'plan' }
  ];
  var LIB = [
    { k: 'public', label: '原始公开图（带出处）' },
    { k: 'drawn', label: '自绘示意（非实测）' },
    { k: 'practice', label: '新练习 / 复现（带 commit）' },
    { k: 'real', label: '真实参与且已完成' },
    { k: 'plan', label: '未来计划（未验证）' }
  ];
  var packState = PACK.map(function (p) { return { lib: p.lib, evid: false, secret: false }; });
  function renderPack() {
    var lane = d('d14-pk-lane');
    var ok = 0, warn = 0, risk = 0;
    if (lane) {
      lane.innerHTML = PACK.map(function (p, i) {
        var st = packState[i];
        var status, cls, detail;
        if (st.secret) {
          status = '✗ 不能用'; cls = 'bad'; risk++;
          detail = '含企业内部或未公开信息。<strong>必须删除或替换</strong>——不是打码，是换掉。';
        } else if (st.lib === 'real' && !st.evid) {
          status = '△ 改标来源'; cls = 'warn'; warn++;
          detail = '标成“真实完成”但没勾“有可披露证据”。<strong>改成“自绘示意 / 原型”</strong>，或补上能指认的证据（脱敏截图、公开链接、录音）。';
        } else if (st.lib === 'plan') {
          status = '△ 可以但要注明'; cls = 'warn'; warn++;
          detail = '计划类内容可以展示，但每张图必须写“拟议，未验证”。<strong>不要把计划图画得像成果图。</strong>';
        } else {
          status = '✓ 可展示'; cls = 'ok'; ok++;
          detail = st.lib === 'public' ? '公开图需带出处与许可。' : (st.lib === 'practice' ? '带仓库链接与 commit，别人可以自己跑。' : '自绘示意图要标“示意，非实测”。');
        }
        return '<div class="role-card' + (cls === 'bad' ? ' is-active' : '') + '">' +
          '<h4>' + p.name + '　<span class="flag ' + cls + '">' + status + '</span></h4>' +
          '<p style="margin-bottom:8px">' + detail + '</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:12.5px">' +
          '<select data-pk-lib="' + i + '" aria-label="' + p.name + ' 的来源层级">' +
          LIB.map(function (l) { return '<option value="' + l.k + '"' + (l.k === st.lib ? ' selected' : '') + '>' + l.label + '</option>'; }).join('') +
          '</select>' +
          '<label style="display:inline-flex;gap:7px;align-items:center;cursor:pointer"><input type="checkbox" data-pk-evid="' + i + '"' + (st.evid ? ' checked' : '') + ' style="width:15px;height:15px;margin:0"> 有可披露证据</label>' +
          '<label style="display:inline-flex;gap:7px;align-items:center;cursor:pointer"><input type="checkbox" data-pk-secret="' + i + '"' + (st.secret ? ' checked' : '') + ' style="width:15px;height:15px;margin:0"> 含内部/未公开信息</label>' +
          '</div></div>';
      }).join('');
      lane.onchange = function (e) {
        var el = e.target;
        if (el.dataset.pkLib !== undefined) packState[parseInt(el.dataset.pkLib, 10)].lib = el.value;
        if (el.dataset.pkEvid !== undefined) packState[parseInt(el.dataset.pkEvid, 10)].evid = el.checked;
        if (el.dataset.pkSecret !== undefined) packState[parseInt(el.dataset.pkSecret, 10)].secret = el.checked;
        renderPack();
      };
    }
    LK.text('d14-pk-ok', ok + ' / 4');
    LK.text('d14-pk-warn', String(warn));
    var riskEl = d('d14-pk-risk');
    if (riskEl) { riskEl.textContent = String(risk); riskEl.className = risk ? 'bad' : 'ok'; }
    var note = d('d14-pk-note');
    if (note) {
      if (risk) {
        note.innerHTML = '有 <strong>' + risk + '</strong> 页被标为含内部信息。这条没有讨价余地：<strong>公开仓库、公开链接、发出去的 PDF 都算公开</strong>。' +
          '正确做法是<strong>替换为同构的自绘示意</strong>——保留你在其中做的设计判断（接口、状态机、取舍），去掉具体系统名、真实数据与内部指标。';
      } else if (warn) {
        note.innerHTML = '有 <strong>' + warn + '</strong> 页需要改标来源或加注。注意“真实完成”这个词的门槛：它要求<strong>可指认的证据</strong>。' +
          '没有证据的“真实完成”，在面试官眼里和“自绘示意”没有区别，但风险高得多——因为它承诺了一个你拿不出的东西。';
      } else {
        note.innerHTML = '四页都站得住。<strong>再检查一遍精简度</strong>：每页只留一张主图 + 三行字。' +
          '面试时没人会读你的字，他们看图和听你说。<strong>图的来源标签要小但要清晰</strong>，那是你诚实的证据。';
      }
    }
  }
  function initPack() { renderPack(); }

  /* -------------------------------------------------------- 08 check */
  var CHECKS = [
    '报名回执已确认（邮件/截图在本地）',
    '两轮 45 分钟模拟已录音',
    '90 秒 / 3 分钟 / 5 分钟三个版本各讲了一遍',
    '四页展示包已标来源、已脱敏',
    '本地离线备份（断网也能打开）',
    '一张只写关键词的临场提纲',
    '前一晚睡眠 ≥ 7 小时',
    '提前 30 分钟到场 / 设备测试完成'
  ];
  function initCheck() {
    var host = d('d14-ck-gate');
    if (host && !host.children.length) {
      host.innerHTML = CHECKS.map(function (c, i) {
        return '<label><input type="checkbox" id="d14-ck-' + i + '"> ' + c + '</label>';
      }).join('');
      host.addEventListener('change', calcCheck);
    }
    calcCheck();
  }
  function calcCheck() {
    var n = 0;
    CHECKS.forEach(function (c, i) {
      var el = d('d14-ck-' + i);
      if (el && el.checked) n++;
    });
    LK.text('d14-ck-count', n + ' / 8');
    var st = d('d14-ck-state');
    if (st) {
      st.textContent = n === 8 ? '就绪' : (n >= 6 ? '差一点' : (n >= 3 ? '还在准备' : '高风险'));
      st.className = n === 8 ? 'ok' : (n >= 6 ? 'warn' : 'bad');
    }
    var note = d('d14-ck-note');
    if (note) {
      if (n === 8) {
        note.innerHTML = '八项齐了。<strong>现在唯一该做的事是睡觉</strong>——熬夜多背三个概念，换来的是一整场反应速度下降。' +
          '<strong>面试考的是你已有的判断力，不是今晚的记忆力。</strong>';
      } else if (n >= 6) {
        note.innerHTML = '还差 <strong>' + (8 - n) + '</strong> 项。优先补<strong>有截止时间的</strong>（回执、备份），再补可以现场凑的（提纲）。' +
          '“三个版本各讲一遍”这项最容易被跳过，但它恰恰是唯一能立刻提升表现的动作。';
      } else {
        note.innerHTML = '现在风险还比较高。别从第 1 项开始按顺序做——<strong>先做“报名回执”和“离线备份”</strong>，' +
          '这两项一旦出问题，其他准备全部作废。<strong>然后再回来补录音与三个版本的口述。</strong>';
      }
    }
  }

  /* --------------------------------------------------------- 09 exam */
  function calcExam() {
    var n = 0;
    for (var i = 1; i <= 6; i++) {
      var el = d('d14-ex-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d14-ex-count', n + ' / 6');
    var lvl = d('d14-ex-level');
    if (lvl) lvl.textContent = n >= 6 ? '完整答卷' : (n >= 4 ? '接近完整' : (n >= 2 ? '骨架成形' : '未开始'));
  }
  function initExam() {
    for (var i = 1; i <= 6; i++) {
      var el = d('d14-ex-' + i);
      if (el) el.addEventListener('change', calcExam);
    }
    calcExam();
  }

  /* -------------------------------------------------------- 10 score */
  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d14-sc-' + i);
      var v = el ? parseInt(el.value, 10) : 0;
      var out = d('d14-sc-' + i + '-out');
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d14-sc-total', total + ' / 20');
    var tip = d('d14-sc-tip');
    if (tip) tip.textContent = total >= 17 ? '可以上场' : (total >= 13 ? '补验证与措辞' : (total >= 9 ? '先降一级措辞' : '先做真实性卡片'));
    var note = d('d14-sc-note');
    if (note) {
      if (total >= 17) {
        note.innerHTML = '状态好的时候最该练的是<strong>“被打断后如何接回主线”</strong>：让朋友在你讲到一半时插一句“等一下，这个数据哪来的”，你要能答完证据再回到原句。<strong>这个动作练三次就够。</strong>';
      } else if (total >= 13) {
        note.innerHTML = '典型状态：概念与接口都够，验证偏弱。<strong>“验证”这一维的补法不是再学，而是补记录</strong>：把一次失败 + 一次修订各写 200 字，它就是一份可讲的验证证据。';
      } else {
        note.innerHTML = '先做第 01 节那张卡片：<strong>十个字段里把“我的职责”和“团队成果”分开写</strong>。这一件事做完，措辞、结构、追问三块的分数会一起动——因为它们都建在同一个基础上：<strong>你清楚自己做过什么。</strong>';
      }
    }
  }
  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d14-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  function boot() {
    initCards();
    initClaims();
    initIntro();
    initTimebox();
    initLine();
    initDrill();
    initPack();
    initCheck();
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
