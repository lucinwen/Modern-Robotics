/* Day 9 — interruptible voice sessions. Vanilla, offline. */
(function () {
  'use strict';

  var P;
  var redraws = [];
  function d(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- chain */
  var CHAIN = {
    mic: {
      name: 'Mic · 声波 → PCM',
      rows: [
        ['输入', '空气中的声压'],
        ['输出', '16 kHz 单声道 PCM 帧（常 20 ms / 帧）'],
        ['典型耗时', '≈ 0（实时流）'],
        ['失败长什么样', '削波（离太近）、直流偏置、双麦相位差、回声被自己听见'],
        ['能被取消吗', '不能。已经采到的样本不可撤销，只能后续丢弃']
      ],
      note: '打断的第一个事实：源头不可撤销。所以“取消”只能发生在它之后。'
    },
    vad: {
      name: 'VAD · 判断“说完了没有”',
      rows: [
        ['输入', 'PCM 帧序列'],
        ['输出', '语音起点 / 终点事件 + 每帧语音概率'],
        ['典型耗时', '起点 20–100 ms；终点取决于静音容忍（常见 300–700 ms）'],
        ['失败长什么样', '早切：用户句中停顿被当成说完；晚切：用户说完还在等'],
        ['能被取消吗', '不能，但可以调阈值。它是首响延迟里最值钱的 300 ms']
      ],
      note: 'VAD 的“说完”判定是整条链的第一处主观判断——所有后续延迟都建立在这个猜测上。'
    },
    asr: {
      name: 'ASR · 语音 → 文本',
      rows: [
        ['输入', '一段语音 + 语言/热词/上下文提示'],
        ['输出', '部分结果流（会被改写）+ 最终文本 + 置信度'],
        ['典型耗时', '100–600 ms（流式可更早出部分结果）'],
        ['失败长什么样', '同音字、人名与房间号错、部分结果先给后被推翻'],
        ['能被取消吗', '能（丢弃最终文本），但部分结果已经驱动下游时不算真取消']
      ],
      note: '“部分结果会回改”是很多人忽略的一点：下游如果拿部分结果就动手，回改后就无法收回。'
    },
    llm: {
      name: 'LLM · 文本 → token 流',
      rows: [
        ['输入', '对话历史 + 本轮用户文本 + 系统约束'],
        ['输出', 'token 流（逐步到达）'],
        ['典型耗时', '首 token 200–1500 ms；总时长取决于长度'],
        ['失败长什么样', '事实错误、答非所问、停不下来、被注入的指令带跑'],
        ['能被取消吗', '能停止生成，但已生成的 token 必须靠版本号作废']
      ],
      note: 'LLM 完全不知道扬声器停了。你不停它，它会一直生成到自然结束——这就是“旧回答晚到”的来源。'
    },
    tts: {
      name: 'TTS · 文本 → 音频块',
      rows: [
        ['输入', '文本片段（可按句切）'],
        ['输出', '音频块 + 每块的相对时间戳 + 音素/viseme 对齐'],
        ['典型耗时', '首块 100–400 ms；后续按实时率'],
        ['失败长什么样', '断句怪、数字与缩写读错、情绪标签与内容不匹配'],
        ['能被取消吗', '能，但已合成待播的块必须显式 flush，否则它们还在队列里']
      ],
      note: 'TTS 是“已经付出算力但还没被听见”的缓冲区——打断时最容易漏掉的一层。'
    },
    spk: {
      name: 'Speaker · 音频块 → 声波',
      rows: [
        ['输入', '音频块（进入设备缓冲）'],
        ['输出', '声波'],
        ['典型耗时', '缓冲 20–200 ms（设备越“稳”缓冲越深）'],
        ['失败长什么样', '队列堆积导致音画漂移、爆音、取消后仍有余音'],
        ['能被取消吗', '能——这是整条链上唯一“物理可停”的一层']
      ],
      note: '正因为只有这里能物理停，很多实现就只做了这里。于是旧回答在别的层里继续活着。'
    }
  };

  function renderChain(key) {
    var data = CHAIN[key];
    var host = d('d9-chain-detail');
    if (!data || !host) return;
    var rows = data.rows.map(function (r) {
      return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
    }).join('');
    host.innerHTML = '<div class="case-card"><h4>' + data.name + '</h4><dl class="kv">' + rows +
      '</dl><p class="demo-note" style="margin:0">' + data.note + '</p></div>';
  }

  function initChain() {
    var nodes = LK.$$('#d9-chain-nodes .node');
    if (!nodes.length) return;
    nodes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        nodes.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        renderChain(btn.dataset.node);
      });
    });
    nodes[0].classList.add('is-active');
    renderChain('mic');
  }

  /* -------------------------------------------------------------- latency */
  var lat = { vad: 300, asr: 350, llm: 600, tts: 250 };
  var latCanvas = null;

  function drawLatency() {
    if (!latCanvas) return;
    var s = latCanvas;
    var p = P();
    LK.clear(s, p.card);
    var total = lat.vad + lat.asr + lat.llm + lat.tts;
    var maxMs = 4000;
    var padL = 12, padR = 12, top = 28, barH = 28;
    var usable = Math.max(60, s.w - padL - padR);
    var scale = usable / maxMs;

    var segs = [
      ['VAD', lat.vad, p.s1],
      ['ASR', lat.asr, p.s2],
      ['LLM', lat.llm, p.s3],
      ['TTS', lat.tts, p.s4]
    ];

    LK.label(s.ctx, '首响延迟构成（0 – 4 s）', padL, 13, p.muted, 11);

    var x = padL;
    segs.forEach(function (seg) {
      var w = seg[1] * scale;
      s.ctx.save();
      s.ctx.fillStyle = seg[2];
      s.ctx.globalAlpha = 0.85;
      s.ctx.fillRect(x, top, w, barH);
      s.ctx.restore();
      if (w > 34) LK.label(s.ctx, seg[0], x + 6, top + barH / 2, '#ffffff', 10);
      x += w;
    });

    /* patience line at 1500 ms */
    var px = padL + 1500 * scale;
    s.ctx.save();
    s.ctx.strokeStyle = p.x;
    s.ctx.setLineDash([4, 3]);
    s.ctx.lineWidth = 1.4;
    s.ctx.beginPath();
    s.ctx.moveTo(px, top - 10);
    s.ctx.lineTo(px, top + barH + 10);
    s.ctx.stroke();
    s.ctx.restore();
    LK.label(s.ctx, '耐心线 1500 ms', px + 4, top + barH + 18, p.x, 10);

    /* total marker */
    var tx = padL + Math.min(total, maxMs) * scale;
    LK.label(s.ctx, total + ' ms', Math.min(tx + 4, s.w - 34), top - 9, total > 1500 ? p.bad : p.primary, 11, 'left');
  }

  function calcLatency() {
    var total = lat.vad + lat.asr + lat.llm + lat.tts;
    LK.text('d9-l-total', total + ' ms');
    var verdict, kind;
    if (total < 1000) { verdict = '很流畅'; kind = 'ok'; }
    else if (total < 1500) { verdict = '可接受'; kind = 'ok'; }
    else if (total < 2200) { verdict = '能感到停顿'; kind = 'warn'; }
    else { verdict = '用户会重复或放弃'; kind = 'bad'; }
    var el = d('d9-l-verdict');
    if (el) { el.textContent = verdict; el.style.color = kind === 'bad' ? P().bad : ''; }
    LK.text('d9-l-note', total > 1500
      ? '已经越过耐心线（1500 ms）。此时用户的典型反应不是继续等，而是重复一遍或者直接说“你在吗”——这句话会再触发一次 VAD，把延迟叠成两倍。'
      : '还在耐心线以内。注意这个数字是每句话都要付的固定成本：说十句话就付十次。');
    drawLatency();
  }

  function initLatency() {
    var map = [['d9-l-vad', 'vad'], ['d9-l-asr', 'asr'], ['d9-l-llm', 'llm'], ['d9-l-tts', 'tts']];
    map.forEach(function (pair) {
      var input = d(pair[0]);
      if (!input) return;
      LK.range(input, pair[0] + '-out', function (v) { return v + ' ms'; }, function (v) {
        lat[pair[1]] = v;
        calcLatency();
      });
    });
    var host = d('d9-latency-canvas');
    if (host) {
      latCanvas = LK.canvas(host, 96);
      if (latCanvas) {
        latCanvas.onresize = drawLatency;
        redraws.push(drawLatency);
      }
    }
    calcLatency();
  }

  /* --------------------------------------------------------------- states */
  var STATES = ['LISTENING', 'RECOGNIZING', 'THINKING', 'SPEAKING', 'CANCELING', 'CONFIRMING'];
  var LEGAL = {
    LISTENING: { RECOGNIZING: 'VAD 检测到语音起点——这是 LISTENING 唯一的正常出口' },
    RECOGNIZING: {
      THINKING: 'ASR 给出最终文本，交给对话管理',
      LISTENING: 'ASR 判定无人说话（噪声误触发），丢弃本轮流回'
    },
    THINKING: {
      SPEAKING: 'LLM 产出第一个可播块，交给 TTS 开始流式播放',
      CANCELING: '用户插话 / 系统超时 / 需要放弃这次生成',
      CONFIRMING: '计划中的动作风险高，必须先向用户确认再播报'
    },
    SPEAKING: {
      LISTENING: '播放队列清空，本轮自然结束',
      CANCELING: '用户插话，或用户明确说“停”'
    },
    CANCELING: { LISTENING: '旧 generation_epoch 的产物全部确认丢弃（不是“已发出取消”）' },
    CONFIRMING: {
      SPEAKING: '用户明确同意，执行并播报结果',
      LISTENING: '用户拒绝 / 超时，按预设的安全默认动作退场'
    }
  };
  var ILLEGAL = {
    'LISTENING>THINKING': '跳过了识别阶段。没有文本就调 LLM，等于让它凭空生成。',
    'LISTENING>SPEAKING': '还没听见任何内容就开口，是自说自话。',
    'LISTENING>CANCELING': '没有正在进行的生成，取消没有对象；这会掩盖真正的状态错误。',
    'LISTENING>CONFIRMING': '确认必须针对一个具体动作，而此刻还没有动作。',
    'RECOGNIZING>SPEAKING': '跳过了 LLM。除非是固定话术回放，否则不该出现在这条链里。',
    'RECOGNIZING>CANCELING': '识别阶段还没有产生可播产物；直接回到 LISTENING 更准确。',
    'RECOGNIZING>CONFIRMING': '还没理解用户说什么，无法提出有意义的确认。',
    'THINKING>LISTENING': '这是最危险的一条“看似合理”的迁移：直接回听，旧 epoch 的产物还在飞行中，迟早会落到播放队列里。必须经过 CANCELING。',
    'THINKING>RECOGNIZING': '同一轮内不能重新识别；用户要说新内容，那是新的一轮。',
    'SPEAKING>THINKING': '同一轮不能重新生成。要改答案必须开新轮并递增 epoch。',
    'SPEAKING>RECOGNIZING': '播放中直接回到识别，会让两个话轮的产物混在同一个 epoch 里。',
    'SPEAKING>CONFIRMING': '确认应当发生在播报之前，不是播到一半才对用户提问。',
    'CANCELING>SPEAKING': '旧 epoch 还没确认丢弃就开播，迟到的块会插进新音频中间——这正是要避免的那个 bug。',
    'CANCELING>THINKING': '取消还没落地就开新生成，两代产物会同时在飞行。',
    'CANCELING>RECOGNIZING': '还没清干净就重新识别，等于同时开三个话轮。',
    'CANCELING>CONFIRMING': '取消原因是“停止”，不是“需要确认”，不要借用确认状态。',
    'CONFIRMING>THINKING': '确认状态里不应该重新生成；要么执行、要么退场。',
    'CONFIRMING>RECOGNIZING': '用户答复已经在确认流程内处理，不需要再走一遍 ASR 状态机。',
    'CONFIRMING>CANCELING': '确认流程的退场是“不执行并回听”，不是“原来那件事的取消”。'
  };

  function statesRows(from) {
    return STATES.map(function (to) {
      if (to === from) {
        return '<tr><td>' + from + ' → ' + to + '</td><td>忽略</td><td>自迁移不报错，但必须是<strong>显式忽略</strong>，不能当作“重置”使用</td></tr>';
      }
      var ok = LEGAL[from] && LEGAL[from][to];
      return '<tr' + (ok ? '' : ' class="is-fail"') + '><td>' + from + ' → ' + to + '</td><td>' +
        (ok ? '<span class="flag ok">合法</span>' : '<span class="flag bad">非法</span>') + '</td><td>' +
        (ok || ILLEGAL[from + '>' + to] || '需要明确的条件与责任方才允许') + '</td></tr>';
    }).join('');
  }

  function calcStates() {
    var from = (d('d9-s-from') || {}).value || 'LISTENING';
    var to = (d('d9-s-to') || {}).value || 'LISTENING';
    var host = d('d9-s-rows');
    if (host) host.innerHTML = statesRows(from);
    LK.text('d9-s-pair', from + ' → ' + to);
    var verdictEl = d('d9-s-verdict');
    var noteEl = d('d9-s-note');
    if (from === to) {
      if (verdictEl) { verdictEl.textContent = '自迁移（忽略）'; verdictEl.style.color = ''; }
      if (noteEl) noteEl.textContent = '自迁移本身无害，但它经常被写成“重置到初始状态”——那会把上一轮的 epoch 一起清掉，于是迟到的旧块又变成“合法”的了。';
      return;
    }
    var legal = LEGAL[from] && LEGAL[from][to];
    if (verdictEl) {
      verdictEl.textContent = legal ? '合法' : '非法';
      verdictEl.style.color = legal ? '' : (P().bad || '#bd403b');
    }
    if (noteEl) noteEl.textContent = legal || ILLEGAL[from + '>' + to] || '这一对迁移需要你补上明确条件与责任人。';
  }

  function initStates() {
    ['d9-s-from', 'd9-s-to'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', calcStates);
    });
    calcStates();
  }

  /* ------------------------------------------------------------- timeline */
  var TL = [
    {
      t: 't0',
      event: '用户：“今天天气如何？”；生成 T1',
      who: 'VAD 发 speech_start；ASR 发 final；对话管理分配 turn_id=T1、epoch=1',
      handle: '无（还没有可取消的产物）',
      reject: '不适用',
      say: '（还没开口）',
      state: 'LISTENING → THINKING'
    },
    {
      t: 't1',
      event: 'T1 开始流式 TTS 播放',
      who: 'TTS 发 audio_chunk(seq=0..n, epoch=1)；播放器发 play(seq)',
      handle: '播放器持有 queue_handle(T1)；LLM 持有 stream_handle(T1)',
      reject: '播放器丢弃 epoch≠1 的块',
      say: '“今天多云转晴，最高 22 度……”',
      state: 'SPEAKING / T1'
    },
    {
      t: 't2',
      event: '用户说“先停一下”',
      who: 'VAD 发 speech_start（打断）；对话管理发 cancel(T1) 并置 epoch=2',
      handle: '旧 queue_handle 被 flush；LLM stream_handle 被 abort',
      reject: '播放器拒绝任何 epoch=1 的后续块',
      say: '立即静音，等 T2 识别',
      state: 'CANCELING → LISTENING / T2'
    },
    {
      t: 't3',
      event: 'T1 模型迟来的文本片段抵达',
      who: 'TTS 侧仍可能交付 epoch=1 的块；播放器收到后判定',
      handle: '已无有效句柄可挂——只能靠 epoch 判据拒绝',
      reject: '<strong>因 epoch 旧而丢弃</strong>，不入队、不缓存、不重播',
      say: '保持静音（用户不该听到任何 T1 残留）',
      state: 'LISTENING / T2'
    },
    {
      t: 't4',
      event: 'T2 识别结束',
      who: 'ASR 发 final(T2)；对话管理确认本轮意图是“停止”',
      handle: '新的 stream_handle(T2)、queue_handle(T2)',
      reject: '继续拒绝 epoch=1；T2 自身产物正常通过',
      say: '“好的，已停下。”',
      state: 'THINKING → SPEAKING / T2'
    }
  ];
  var tlStep = 0;
  var tlCanvas = null;

  function drawTimeline() {
    if (!tlCanvas) return;
    var s = tlCanvas;
    var p = P();
    LK.clear(s, p.card);
    var padL = 54, padR = 16, top = 24, laneH = 34, gap = 14;
    var usable = Math.max(80, s.w - padL - padR);
    var n = TL.length;
    function xAt(i) { return padL + (usable * i) / Math.max(1, n - 1); }

    /* grid */
    TL.forEach(function (step, i) {
      var x = xAt(i);
      s.ctx.save();
      s.ctx.strokeStyle = p.border;
      s.ctx.lineWidth = 1;
      s.ctx.beginPath();
      s.ctx.moveTo(x, top - 6);
      s.ctx.lineTo(x, top + laneH * 2 + gap + 8);
      s.ctx.stroke();
      s.ctx.restore();
      LK.label(s.ctx, step.t, x, top - 12, p.muted, 10, 'center');
    });

    /* lane labels */
    LK.label(s.ctx, 'T1', 16, top + laneH / 2, p.s3, 11, 'left');
    LK.label(s.ctx, 'T2', 16, top + laneH + gap + laneH / 2, p.s1, 11, 'left');

    /* T1: alive t0 → t2, then cancelled */
    var t1Start = xAt(0), t1End = xAt(2);
    s.ctx.save();
    s.ctx.fillStyle = p.s3;
    s.ctx.globalAlpha = 0.8;
    s.ctx.fillRect(t1Start, top + 8, Math.max(4, t1End - t1Start), laneH - 16);
    s.ctx.restore();
    LK.label(s.ctx, '播放中', (t1Start + t1End) / 2, top + laneH / 2, '#ffffff', 10, 'center');

    /* cancelled tail */
    s.ctx.save();
    s.ctx.strokeStyle = p.muted;
    s.ctx.setLineDash([3, 3]);
    s.ctx.lineWidth = 1.2;
    s.ctx.beginPath();
    s.ctx.moveTo(t1End, top + laneH / 2);
    s.ctx.lineTo(xAt(n - 1), top + laneH / 2);
    s.ctx.stroke();
    s.ctx.restore();
    LK.label(s.ctx, '已作废', (t1End + xAt(n - 1)) / 2, top + laneH / 2 - 15, p.muted, 9, 'center');

    /* cancel marker */
    s.ctx.save();
    s.ctx.strokeStyle = p.x;
    s.ctx.lineWidth = 2;
    s.ctx.beginPath();
    s.ctx.moveTo(t1End, top + 2);
    s.ctx.lineTo(t1End, top + laneH - 2);
    s.ctx.stroke();
    s.ctx.restore();

    /* late chunk marker at t3 */
    var x3 = xAt(3);
    var y3 = top + laneH / 2;
    s.ctx.save();
    s.ctx.strokeStyle = p.bad;
    s.ctx.lineWidth = 2;
    s.ctx.beginPath();
    s.ctx.moveTo(x3 - 5, y3 - 5); s.ctx.lineTo(x3 + 5, y3 + 5);
    s.ctx.moveTo(x3 + 5, y3 - 5); s.ctx.lineTo(x3 - 5, y3 + 5);
    s.ctx.stroke();
    s.ctx.restore();
    LK.label(s.ctx, '丢弃', x3 + 8, y3 + 12, p.bad, 9, 'left');

    /* T2 bar */
    var t2y = top + laneH + gap;
    s.ctx.save();
    s.ctx.fillStyle = p.s1;
    s.ctx.globalAlpha = 0.8;
    s.ctx.fillRect(t1End, t2y + 8, Math.max(4, xAt(n - 1) - t1End), laneH - 16);
    s.ctx.restore();
    LK.label(s.ctx, 'T2 生成与播放', (t1End + xAt(n - 1)) / 2 + 8, t2y + laneH / 2, '#ffffff', 10, 'center');

    /* cursor */
    var cx = xAt(tlStep);
    s.ctx.save();
    s.ctx.strokeStyle = p.primary;
    s.ctx.lineWidth = 2;
    s.ctx.beginPath();
    s.ctx.moveTo(cx, top - 6);
    s.ctx.lineTo(cx, t2y + laneH + 8);
    s.ctx.stroke();
    s.ctx.restore();
  }

  function renderTimeline() {
    var host = d('d9-tl-rows');
    if (host) {
      host.innerHTML = TL.map(function (step, i) {
        var cls = i === tlStep ? ' class="is-done"' : '';
        return '<tr' + cls + '><td><strong>' + step.t + '</strong><br>' + step.event + '</td><td>' +
          '<div class="cond-grid">' +
          '<div class="cond-row"><span>发布者</span><span>' + step.who + '</span></div>' +
          '<div class="cond-row"><span>句柄</span><span>' + step.handle + '</span></div>' +
          '<div class="cond-row"><span>拒绝者</span><span>' + step.reject + '</span></div>' +
          '</div></td></tr>';
      }).join('');
    }
    var cur = TL[tlStep];
    LK.text('d9-tl-now', cur.t);
    LK.text('d9-tl-state', cur.state);
    LK.text('d9-tl-say', cur.say);
    var note = d('d9-tl-note');
    if (note) {
      var notes = [
        't0 只是分配身份：turn_id=T1、epoch=1。这一步看起来多余，但后面所有“这块属于谁”的判断都靠它。',
        't1 是唯一“物理可停”的时刻：声音正在出去。此时打断的代价最低，因为损失只有已播的几百毫秒。',
        't2 要同时做三件事：flush 播放队列、abort 生成流、递增 epoch。少做任何一件，旧版本就还有活路。',
        't3 是全场唯一的真正考验：没有任何句柄能“取消”一个已经出生的块，只能靠 epoch 判据拒绝它。',
        't4 结束时要能回答“用户到底要什么”：是停止播放，还是换话题。这两者的后续动作不同。'
      ];
      note.textContent = notes[tlStep];
    }
    var nodes = LK.$$('#d9-tl-steps .node');
    nodes.forEach(function (b, i) { b.classList.toggle('is-active', i === tlStep); });
    drawTimeline();
  }

  function initTimeline() {
    var nodes = LK.$$('#d9-tl-steps .node');
    nodes.forEach(function (btn, i) {
      btn.addEventListener('click', function () { tlStep = i; renderTimeline(); });
    });
    var host = d('d9-tl-canvas');
    if (host) {
      tlCanvas = LK.canvas(host, 150);
      if (tlCanvas) { tlCanvas.onresize = drawTimeline; redraws.push(drawTimeline); }
    }
    renderTimeline();
  }

  /* ---------------------------------------------------------------- races */
  var RACES = [
    {
      name: '① 旧回答晚到',
      when: '用户在 t2 打断后，LLM 仍在 t3 吐出 token，TTS 在 t3+ 交付对应音频块',
      fix: 'epoch 递增到 2；每个块携带出生时的 epoch；到达时不等即丢弃——不入队、不缓存。同时向 TTS 侧发 cancel，并等待“已丢弃”回执才退出 CANCELING',
      bad: '只停扬声器：迟到块到达时播放器没有判据，被当成新内容播出，用户听到上一句的尾巴',
      test: '日志中不存在 epoch=1 且时间戳晚于 cancel(T1) 的 sink_write 事件',
      trap: '丢弃位置'
    },
    {
      name: '② 用户二次插话',
      when: 'CANCELING 尚未结束，用户再次开口；此时 T2 自己已经产生了半句内容',
      fix: 'epoch 再 +1 到 3；T2 的产物同样作废；CANCELING 的“确认丢弃”计时重置，按最新 epoch 判定',
      bad: '用 turn_id 判断 → T2 与 T3 的产物混在一起；或 CANCELING 提前结束 → T2 的尾巴漏出来',
      test: '连续两次打断后，所有 play 事件的 epoch 序列单调不回头，且不出现跨 epoch 交错',
      trap: 'epoch 单调性'
    },
    {
      name: '③ TTS 队列仍在播放',
      when: '取消信令到达播放器，但队列里已经合成了 N 个块，播放器只是停止取流而没有 flush',
      fix: '队列版本号 +1，flush 并丢弃所有旧版本块；等到“已 flush”回执再退出 CANCELING',
      bad: '不报任何错，用户听见半句后突然接上新回答，或旧块与新块交替出现',
      test: 'cancel 后 300 ms 内扬声器输出能量低于静音阈值，且播放队列长度归零',
      trap: '设备缓冲'
    }
  ];
  var raceIdx = 0;

  function renderRace(i) {
    raceIdx = i;
    var r = RACES[i];
    var host = d('d9-r-detail');
    if (host) {
      host.innerHTML =
        '<div class="case-card"><h4>什么时候发生</h4><p>' + r.when + '</p></div>' +
        '<div class="case-card"><h4>正确处置</h4><p>' + r.fix + '</p></div>' +
        '<div class="case-card"><h4>错误处置的后果</h4><p>' + r.bad + '</p></div>' +
        '<div class="case-card"><h4>测试预期（可复现）</h4><p>' + r.test + '</p></div>';
    }
    LK.text('d9-r-name', r.name);
    LK.text('d9-r-trap', r.trap);
    var btns = LK.$$('#d9-r-tabs button');
    btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  function initRaces() {
    var tabs = LK.$$('#d9-r-tabs button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { renderRace(parseInt(b.dataset.race, 10) || 0); });
    });
    renderRace(0);
  }

  /* ---------------------------------------------------------------- epoch */
  var GATE_INFO = {
    session: '跨会话隔离：上一通电话的残留块不能在新会话里播出',
    turn: '同一轮内：防止旧轮的块被当成这一轮的续写',
    epoch: '版本最新：唯一能拦住“已作废但还在飞”的块的判据',
    queue: '队列版本：防止 flush 之后旧队列里的块被重新取到'
  };

  function calcGates() {
    var ids = [['d9-g-session', '① session'], ['d9-g-turn', '② turn'], ['d9-g-epoch', '③ epoch'], ['d9-g-queue', '④ queue']];
    var off = [];
    ids.forEach(function (pair) {
      var el = d(pair[0]);
      if (!el || !el.checked) off.push(pair[1]);
    });
    var verdict = d('d9-g-verdict');
    if (verdict) {
      verdict.textContent = off.length ? '丢弃（不播放）' : '接受并播放';
      verdict.style.color = off.length ? (P().bad || '#bd403b') : '';
    }
    LK.text('d9-g-which', off.length ? off.join('、') : '无');
    var note = d('d9-g-note');
    if (!note) return;
    if (!off.length) {
      note.textContent = '四道全开：只有当块的身份与当前状态完全一致时才播出。这才是“打断已生效”的定义。';
    } else if (off.length === 1 && off[0] === '③ epoch') {
      note.textContent = '只关掉 epoch 是最常见的错法：看起来还有 session / turn / queue 三道保护。但“迟到的旧块”与当前轮的 session 和 turn 可能完全一致（同一轮内二次打断），队列版本也可能没变（还没 flush 过）——三道都放行，旧块就播出去了。';
    } else if (off.length === 1 && off[0] === '④ queue') {
      note.textContent = '关掉队列版本：flush 之后，某个已经取出但尚未写入设备的块仍会被写进去。这一层保护的就是“最后一次拷贝”。';
    } else if (off.length === 1 && off[0] === '① session') {
      note.textContent = '关掉会话隔离：用户挂断重拨后，上一通电话的残留音频可能在新会话里冒出来。这类 bug 极难复现，但一旦发生就非常影响信任。';
    } else {
      note.textContent = '现在有 ' + off.length + ' 道闸门失效，判定为丢弃。记住它们各自对应一种不同的失效原因——所以不能靠任何单独一道兜住全部。';
    }
  }

  function initGates() {
    ['d9-g-session', 'd9-g-turn', 'd9-g-epoch', 'd9-g-queue'].forEach(function (id) {
      var el = d(id);
      if (el) el.addEventListener('change', calcGates);
    });
    calcGates();
  }

  /* ------------------------------------------------------------ companion */
  var ALARMS = [
    {
      name: 'L0 记录',
      who: '不打扰任何人',
      when: '单次异常值，且信号质量差 / 置信度低 / 与前后数据不连续',
      do: '写入本地日志（带原始信号质量），提高后续判定阈值一段时间，不主动开口',
      never: '不要对用户说“检测到异常”——一次抖动不构成事件',
      exit: '阈值恢复后自动回到常态监测'
    },
    {
      name: 'L1 询问',
      who: '只打扰用户本人',
      when: '连续多次异常，或单次异常但置信度中等以上',
      do: '用中性措辞问“需要我帮你联系谁吗”，同时说明依据（“我注意到……”，不是“检测到你生病了”）',
      never: '不下诊断、不制造紧迫感、不替用户决定要不要通知别人',
      exit: '用户回答“不用” → 记录并回到 L0；无回应超时 → 按预设规则升级'
    },
    {
      name: 'L2 通知家属',
      who: '打扰事先授权的家属',
      when: '用户确认不适，或连续异常且用户多次无回应',
      do: '发送结构化摘要：时间、持续时长、信号类型、用户是否回应，附原始时间线',
      never: '不写诊断结论、不发未经用户同意的健康数据细节',
      exit: '家属确认收到 → 记录；无回执 → 定时重试并有上限'
    },
    {
      name: 'L3 转人工',
      who: '打扰值班人员 / 紧急联系人',
      when: '用户明确求助，或出现高置信度的急症信号（如跌倒后长时间无动作）',
      do: '建立通话通道，同时上报事件摘要；全程记录谁在何时接入',
      never: '不替代医疗判断、不承诺“已经没事了”、不隐藏升级事实',
      exit: '人工接入并给出处置结论后关闭本次事件'
    }
  ];
  var alarmIdx = 0;

  function renderAlarm(i) {
    alarmIdx = i;
    var a = ALARMS[i];
    var host = d('d9-alarm-detail');
    if (host) {
      host.innerHTML =
        '<div class="case-card"><h4>谁被打扰</h4><p>' + a.who + '</p></div>' +
        '<div class="case-card"><h4>触发条件</h4><p>' + a.when + '</p></div>' +
        '<div class="case-card"><h4>该做什么</h4><p>' + a.do + '</p></div>' +
        '<div class="case-card"><h4>绝对不能做</h4><p>' + a.never + '</p></div>' +
        '<div class="case-card"><h4>怎么退出</h4><p>' + a.exit + '</p></div>';
    }
    var note = d('d9-alarm-note');
    if (note) {
      note.textContent = '分级的意义是“决定谁被打扰”。' + a.name + ' 的边界是：' + a.never + '。';
    }
    var btns = LK.$$('#d9-alarm-tabs button');
    btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
  }

  function initAlarm() {
    var tabs = LK.$$('#d9-alarm-tabs button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { renderAlarm(parseInt(b.dataset.alarm, 10) || 0); });
    });
    renderAlarm(0);
  }

  /* --------------------------------------------------------------- verify */
  function calcVerify() {
    var n = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d9-v-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d9-v-count', n + ' / 5');
    var verdict = d('d9-v-verdict');
    if (verdict) {
      if (n === 5) verdict.textContent = '可以作为证据';
      else if (n >= 3) verdict.textContent = '还差关键几条';
      else verdict.textContent = '还不行';
      verdict.style.color = n === 5 ? '' : (P().bad || '#bd403b');
    }
    var note = d('d9-v-note');
    if (!note) return;
    if (n === 5) {
      note.textContent = '五条全有，且都能在日志里机器判定——这就从“我觉得没问题”升级成了“可复现的证据”。注意：这仍然只证明你实现的这个模拟器没双播，不证明真实设备上也一样。';
    } else if (!(d('d9-v-4') && d('d9-v-4').checked)) {
      note.textContent = '缺的第 4 条最关键：它是唯一覆盖“取消信令已发、设备缓冲还在响”的断言，而那一段恰好是用户真正听见的部分。';
    } else {
      note.textContent = '还差 ' + (5 - n) + ' 条。断言的价值在于“机器能判”，写成人话描述不算证据。';
    }
  }

  function initVerify() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d9-v-' + i);
      if (el) el.addEventListener('change', calcVerify);
    }
    calcVerify();
  }

  /* ----------------------------------------------------------------- exam */
  function calcExam() {
    var n = 0;
    for (var i = 1; i <= 6; i++) {
      var el = d('d9-ex-' + i);
      if (el && el.checked) n++;
    }
    LK.text('d9-ex-count', n + ' / 6');
    var level = d('d9-ex-level');
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
      var el = d('d9-ex-' + i);
      if (el) el.addEventListener('change', calcExam);
    }
    calcExam();
  }

  /* ---------------------------------------------------------------- score */
  function calcScore() {
    var total = 0;
    for (var i = 1; i <= 5; i++) {
      var el = d('d9-sc-' + i);
      var out = d('d9-sc-' + i + '-out');
      var v = el ? parseInt(el.value, 10) : 0;
      if (out) out.textContent = String(v);
      total += v;
    }
    LK.text('d9-sc-total', total + ' / 20');
    var tip = '先补验证';
    if (total >= 17) tip = '可以进入下一轮追问';
    else if (total >= 13) tip = '补一条实测断言';
    else if (total >= 9) tip = '先把四闸门讲顺';
    LK.text('d9-sc-tip', tip);
    var note = d('d9-sc-note');
    if (note) {
      note.textContent = total >= 17
        ? '这个分数说明概念与接口都稳了。下一步不是再加知识，而是准备“连续两次为什么”的追问。'
        : '总分 ' + total + ' / 20。今天最该补的是“验证”这一维：一个几十行的事件模拟器，就能把 0 分变成 2–3 分。';
    }
  }

  function initScore() {
    for (var i = 1; i <= 5; i++) {
      var el = d('d9-sc-' + i);
      if (el) el.addEventListener('input', calcScore);
    }
    calcScore();
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    P = LK.palette;
    initChain();
    initLatency();
    initStates();
    initTimeline();
    initRaces();
    initGates();
    initAlarm();
    initVerify();
    initExam();
    initScore();
  }

  if (window.MutationObserver) {
    new MutationObserver(function () {
      redraws.forEach(function (fn) { try { fn(); } catch (e) {} });
      calcGates();
      calcScore();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
