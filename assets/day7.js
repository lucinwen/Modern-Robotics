/* Day 7 · 具身学习：概念对照、动作块时序、接口合同与证据自检 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); };

  /* ---------- 01 state vs observation ---------- */
  var SO = {
    truth: [
      ['门开角', '0.90 rad（真实值）', '—', '是，但这是特权信息'],
      ['杯子位姿', '(1.24, 0.38, 0.76) m', '画面右下角约 40×40 px', '是，需先做检测与位姿估计'],
      ['机器人关节角', '[0.12, -0.44, 0.87] rad', '编码器读数，含 ±0.002 rad 噪声', '是，直接可用'],
      ['门把手位置', '门板内侧，可见', '被墙挡住，画面里没有', '否，只能靠历史或探索'],
      ['桌面摩擦系数', '0.62', '不可测', '否，必须靠交互感知']
    ],
    obs: [
      ['门开角', '0.90 rad（策略看不到）', '画面只拍到门框一边，角度不可估', '否'],
      ['杯子位姿', '(1.24, 0.38, 0.76) m', '画面右下角约 40×40 px', '是，需先做检测与位姿估计'],
      ['机器人关节角', '[0.12, -0.44, 0.87] rad', '编码器读数，含 ±0.002 rad 噪声', '是，直接可用'],
      ['门把手位置', '门板内侧，可见', '被墙挡住，画面里没有', '否，只能靠历史或探索'],
      ['桌面摩擦系数', '0.62', '不可测', '否，必须靠交互感知']
    ]
  };

  function renderSO(view) {
    var rows = SO[view] || SO.truth;
    var body = $('d7-so-rows');
    if (!body) return;
    body.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (cell, i) {
        var td = document.createElement(i === 0 ? 'th' : 'td');
        td.textContent = cell;
        if (i === 3 && /^否/.test(cell)) td.className = 'text-muted';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    var t = $('d7-view-truth'), o = $('d7-view-obs');
    if (t) t.setAttribute('aria-pressed', view === 'truth' ? 'true' : 'false');
    if (o) o.setAttribute('aria-pressed', view === 'obs' ? 'true' : 'false');
    var note = $('d7-so-note');
    if (note) {
      note.textContent = view === 'truth'
        ? '真值视图里每一格都齐——但这正是问题所在：真实机器人拿不到这张表。训练时如果用它，模型就学到了部署时不存在的信息。'
        : '相机视图里有两格是空的：门开角和把手位置。策略只能靠历史帧、主动探索或先验去补，补不上就会在门前“犹豫”。';
    }
  }

  /* ---------- 02 MDP 五要素 ---------- */
  var MDP = {
    s: { btn: 'd7-mdp-s', title: 'S · 状态', def: '决策所需的全部信息；满足马尔可夫性时，未来只依赖当前状态。', eg: '机器人关节角 + 末端位姿 + 杯子位姿 + 夹爪开合 + 桌子高度。', bad: '把单帧图像当状态——图像不满足马尔可夫性，杯子可能在画面外。' },
    o: { btn: 'd7-mdp-o', title: 'O · 观测', def: '传感器实际读到的部分，是状态的有损投影（partial observability）。', eg: '一帧 RGB-D、编码器读数、末端力。门后的把手不在其中。', bad: '把 observation 当 state 写进训练集，造成特权信息泄漏。' },
    a: { btn: 'd7-mdp-a', title: 'A · 动作', def: '策略可施加的干预；它的空间定义决定了控制器与频率。', eg: '关节增量 [Δq1, Δq2] rad @10 Hz，或末端位姿增量、夹爪开合。', bad: '混用“关节角”和“关节增量”，标签单位一错，策略学到的全是偏移。' },
    r: { btn: 'd7-mdp-r', title: 'R · 奖励', def: '每一步的标量训练信号，用来塑造行为，不等于任务成功判据。', eg: '末端到杯子的距离减少给正奖励，夹爪闭合且有接触给额外奖励。', bad: '把 success 直接当 reward（0/1 稀疏），长任务几乎无梯度；或用 reward 判断成功，被刷分骗过。' },
    p: { btn: 'd7-mdp-p', title: 'π · 策略', def: '从观测（或状态）到动作的映射，是最终要部署的东西。', eg: 'π(a | o)：输入图像+关节角，输出下一步关节增量。', bad: '说“策略学会了开门”，其实只是记住了训练场景里门的位置。' }
  };

  function selectMDP(key) {
    var item = MDP[key];
    if (!item) return;
    Object.keys(MDP).forEach(function (k) {
      var btn = $(MDP[k].btn);
      if (btn) {
        btn.classList.toggle('is-on', k === key);
        btn.setAttribute('aria-pressed', k === key ? 'true' : 'false');
      }
    });
    var t = $('d7-mdp-title'), d = $('d7-mdp-def'), e = $('d7-mdp-eg'), b = $('d7-mdp-bad');
    if (t) t.textContent = item.title;
    if (d) d.textContent = item.def;
    if (e) e.textContent = item.eg;
    if (b) b.textContent = item.bad;
  }

  /* ---------- 03 四方法对照 ---------- */
  var METHODS = {
    bc: {
      name: '行为克隆 BC', note: 'BC 的核心风险是 covariate shift：一旦策略犯一个小错，它就进入了示范数据里从未出现过的状态，之后的动作没有参考答案。',
      rows: [
        ['训练数据来源', '人类遥操作示范的 (observation, action) 对，几十到几千条 episode'],
        ['条件输入', '当前观测（可加语言指令或目标图像）'],
        ['输出', '单步动作，或一小段动作块'],
        ['控制粒度', '高（可按控制频率）或块级'],
        ['保证什么', '在示范分布内，行为接近示范者'],
        ['不保证什么', '偏离分布后的恢复能力、超出示范的新任务'],
        ['部署困难', 'covariate shift、长任务误差累积、多模态示范被平均成“中间动作”']
      ]
    },
    rl: {
      name: '强化学习 RL', note: 'RL 的失败大多不是“学不会”，而是“学会了不该学的”：奖励一旦写歪，它会精确地优化到你没想要的地方。',
      rows: [
        ['训练数据来源', '与环境的交互 rollout（仿真中常达百万级 step）+ 奖励函数'],
        ['条件输入', '状态或观测（+ 目标 / 指令）'],
        ['输出', '动作（连续或离散），按控制频率'],
        ['控制粒度', '高，通常与控制频率一致'],
        ['保证什么', '在给定 MDP 与奖励下优化期望累积回报'],
        ['不保证什么', '奖励写歪时的行为安全、真实世界的可迁移性'],
        ['部署困难', '奖励设计、样本效率、sim2real gap、探索阶段的安全']
      ]
    },
    dp: {
      name: 'Diffusion Policy', note: '它建模的是“动作序列的分布”而不是单一动作，所以能同时表示“从左边绕”和“从右边绕”两种示范——但也因此推理更慢。',
      rows: [
        ['训练数据来源', '示范数据（与 BC 同源）'],
        ['条件输入', '观测 + 一段高斯噪声动作序列'],
        ['输出', '整段动作序列（H × d 维），经多步去噪得到'],
        ['控制粒度', '块级，通常配合 receding horizon 重叠执行'],
        ['保证什么', '能表达多模态动作分布，长序列更平滑'],
        ['不保证什么', '块内突变环境的响应、严格的实时性'],
        ['部署困难', '推理延迟、块边界不连续、去噪步数与控制频率的匹配']
      ]
    },
    vla: {
      name: '视觉-语言-动作模型 VLA', note: 'VLA 把“听懂”做成了可学习的能力，但“不撞墙”仍然是控制器与安全层的责任——这两件事不在同一层。',
      rows: [
        ['训练数据来源', '大规模异构视觉-语言-动作数据（多机器人、网络数据）+ 目标任务微调'],
        ['条件输入', '图像 + 语言指令（常附本体状态）'],
        ['输出', '动作 token、动作块，或末端位姿增量'],
        ['控制粒度', '低到中，常为块级或不定周期'],
        ['保证什么', '在其数据分布内，对物体与指令组合有语义泛化'],
        ['不保证什么', '碰撞避免、力矩限幅、高频闭环稳定性'],
        ['部署困难', '动作空间对齐（tokenizer / 归一化）、推理延迟、精确控制精度、安全兜底']
      ]
    }
  };

  function selectMethod(key) {
    var m = METHODS[key];
    if (!m) return;
    Object.keys(METHODS).forEach(function (k) {
      var btn = $('d7-m-' + k);
      if (btn) btn.setAttribute('aria-pressed', k === key ? 'true' : 'false');
    });
    var name = $('d7-m-name');
    if (name) name.textContent = m.name;
    var body = $('d7-m-rows');
    if (body) {
      body.textContent = '';
      m.rows.forEach(function (r) {
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.textContent = r[0];
        var td = document.createElement('td');
        td.textContent = r[1];
        tr.appendChild(th);
        tr.appendChild(td);
        body.appendChild(tr);
      });
    }
    var note = $('d7-m-note');
    if (note) note.textContent = m.note;
  }

  /* ---------- 04 动作块时序 ---------- */
  function chunk() {
    var hEl = $('d7-h'), fEl = $('d7-f');
    if (!hEl || !fEl) return;
    var H = parseInt(hEl.value, 10);
    var F = parseInt(fEl.value, 10);
    var open = H / F;
    var rate = F / H;
    var doorAt = 0.8;
    var missed = open > doorAt;

    var hOut = $('d7-h-out'), fOut = $('d7-f-out');
    if (hOut) hOut.textContent = String(H);
    if (fOut) fOut.textContent = String(F);
    var tEl = $('d7-chunk-t');
    if (tEl) tEl.textContent = fmt(open, 2) + ' s';
    var rEl = $('d7-chunk-rate');
    if (rEl) rEl.textContent = fmt(rate, 2) + ' 次/s';
    var vEl = $('d7-chunk-verdict');
    if (vEl) {
      vEl.textContent = missed ? '块内错过（开环 ' + fmt(open, 2) + ' s > 0.8 s）' : '块内能发现（开环 ' + fmt(open, 2) + ' s ≤ 0.8 s）';
      vEl.className = missed ? 'flag bad' : 'flag ok';
    }

    var bars = $('d7-chunk-bars');
    if (bars) {
      bars.textContent = '';
      var doorStep = Math.floor(doorAt * F);
      for (var i = 0; i < H; i++) {
        var b = document.createElement('span');
        b.className = 'beat';
        var isDoor = (i === doorStep);
        b.style.height = isDoor ? '88px' : (56 - (i % 3) * 4) + 'px';
        b.style.background = isDoor ? 'var(--viz-series-2)' : (i > doorStep && doorStep < H ? 'var(--border)' : 'var(--viz-series-1)');
        bars.appendChild(b);
      }
    }

    var note = $('d7-chunk-note');
    if (note) {
      note.textContent = missed
        ? '门在 0.8 s 时关闭，但这一整块要执行 ' + fmt(open, 2) + ' s。块内策略不会重新观测，所以它会把“推门”这个动作一直执行到门已经关上为止。'
        : '门在 0.8 s 时关闭，而这一块只占 ' + fmt(open, 2) + ' s，策略会在门变化后 ' + fmt(Math.max(0, doorAt - open), 2) + ' s 内重新观测到，有机会纠正。';
    }
  }

  /* ---------- 05 五环链路 ---------- */
  var PIPE = {
    1: { title: '① 观测 observation', f: '分辨率、色彩空间、帧率、时间戳来源、相机内参与外参、相对哪个 frame', o: '传感器驱动 + 时间同步（Day 6 的 observation 公平性）', x: '策略看到的是过期帧，动作与场景错位；多相机不同步会导致“手已经在动、画面还没动”' },
    2: { title: '② 策略 policy', f: '输入张量的形状与归一化、推理频率、输出维度、模型版本号', o: '策略学习系统（BC / RL / Diffusion / VLA）', x: '归一化统计量变了但模型没重训，输出整体偏置；模型版本与数据版本不匹配' },
    3: { title: '③ 动作块 chunk', f: '块长 H、维度 d、单位（rad / m）、动作类型（增量/绝对）、是否需要插值', o: '策略 + 执行调度器', x: '把关节增量当成绝对角执行，机械臂直接冲到限位；块边界跳变导致抖动' },
    4: { title: '④ 控制器 controller', f: '控制频率、跟踪律（PD / 阻抗）、速度与力矩限幅、碰撞检查、急停条件', o: 'ROS 2 控制层（Day 5）', x: '策略输出合法但控制器跟不上；无限幅时一次非法动作就能撞坏设备' },
    5: { title: '⑤ 新观测 rollout', f: '时间戳对齐、成功判据、timeout、reset 完整性、seed 记录', o: '仿真环境 / 真机 + 评测脚本（Day 6）', x: 'reset 没清干净，episode 之间互相污染；success 判据与训练奖励不一致，指标虚高' }
  };

  function selectPipe(n) {
    var p = PIPE[n];
    if (!p) return;
    Object.keys(PIPE).forEach(function (k) {
      var btn = $('d7-p-' + k);
      if (btn) btn.classList.toggle('is-active', String(k) === String(n));
    });
    var t = $('d7-p-title'), f = $('d7-p-fields'), o = $('d7-p-owner'), x = $('d7-p-fail');
    if (t) t.textContent = p.title;
    if (f) f.textContent = p.f;
    if (o) o.textContent = p.o;
    if (x) x.textContent = p.x;
  }

  /* ---------- 06 四路线 ---------- */
  var ROUTES = {
    tamp: {
      name: '符号 TAMP', note: 'TAMP 不需要训练数据，但需要准确的符号模型与几何模型；模型错一处，规划出的动作原语就不可执行。',
      rows: [
        ['数据需求', '0 条训练数据；需要 PDDL 域文件、几何/碰撞模型、动作原语参数'],
        ['成功条件', '模型准确 + 原语可靠 + 感知能给出正确的符号状态'],
        ['失败模式', '域模型漏了前置条件（门是锁的）；几何与实际不符（门净宽 0.7 m）；原语执行误差'],
        ['在 minilab 里能验证', '规则层可行性（rule_task_feasible）与几何合法性'],
        ['证据等级', '纸面设计 + 规则层验证；无连续控制']
      ]
    },
    bc: {
      name: '行为克隆 BC', note: 'BC 的最大问题不是“学不像”，而是“错了之后回不来”：它从没见过自己犯错时的状态。',
      rows: [
        ['数据需求', 'N 条示范 episode（量级依任务复杂度差异极大，不能给统一数字）'],
        ['成功条件', '测试初始状态落在示范分布内，且执行误差不累积'],
        ['失败模式', 'covariate shift（分布偏移）；相机视角变化；长任务误差累积到不可恢复'],
        ['在 minilab 里能验证', '只能验证数据 schema、切分与接口；无法验证成功率'],
        ['证据等级', '纸面契约；无训练']
      ]
    },
    rl: {
      name: '强化学习 RL', note: 'RL 的失败大多不是“学不会”，而是“学会了不该学的”：奖励一旦写歪，它会精确优化到你没想要的地方。',
      rows: [
        ['数据需求', '大量交互（仿真中百万级 step）+ 明确定义的奖励函数'],
        ['成功条件', '仿真保真、奖励与成功对齐、探索覆盖到关键状态'],
        ['失败模式', 'reward hacking（把杯子推下桌也算“靠近”）；sim2real gap；训练不稳定'],
        ['在 minilab 里能验证', '奖励与 success 是否分离、termination 与 timeout 是否正确'],
        ['证据等级', '纸面设计；无训练']
      ]
    },
    vla: {
      name: 'VLA', note: 'VLA 最容易被追问的是证据链：你说它“会开这种门”，数据里到底有多少扇这种门？',
      rows: [
        ['数据需求', '大规模异构预训练数据 + 目标任务微调数据 + 动作空间对齐方案'],
        ['成功条件', '语言指令在分布内、动作空间对齐、底层控制器可靠'],
        ['失败模式', '动作空间不对齐（输出维度无意义）；语义对但轨迹不安全；延迟过高导致闭环失效'],
        ['在 minilab 里能验证', '无法验证（规模与算力都不匹配）'],
        ['证据等级', '纯文献理解；无任何个人实测']
      ]
    }
  };

  function selectRoute(key) {
    var r = ROUTES[key];
    if (!r) return;
    Object.keys(ROUTES).forEach(function (k) {
      var btn = $('d7-r-' + k);
      if (btn) btn.setAttribute('aria-pressed', k === key ? 'true' : 'false');
    });
    var name = $('d7-r-name');
    if (name) name.textContent = r.name;
    var body = $('d7-r-rows');
    if (body) {
      body.textContent = '';
      r.rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.textContent = row[0];
        var td = document.createElement('td');
        td.textContent = row[1];
        tr.appendChild(th);
        tr.appendChild(td);
        body.appendChild(tr);
      });
    }
    var note = $('d7-r-note');
    if (note) note.textContent = r.note;
  }

  /* ---------- 07 字段完整性 ---------- */
  var CT = ['d7-ct-1', 'd7-ct-2', 'd7-ct-3', 'd7-ct-4', 'd7-ct-5', 'd7-ct-6'];
  function contract() {
    var n = 0;
    CT.forEach(function (id) { var el = $(id); if (el && el.checked) n++; });
    var c = $('d7-ct-count');
    if (c) c.textContent = n + ' / 6';
    var v = $('d7-ct-verdict');
    if (v) {
      v.textContent = n === 6 ? '可以（仍需固定 seed 与判据）' : (n >= 4 ? '勉强，缺项会被追问' : '不能');
      v.className = 'flag ' + (n === 6 ? 'ok' : (n >= 4 ? 'warn' : 'bad'));
    }
    var note = $('d7-ct-note');
    if (note) {
      note.textContent = n === 6
        ? '六项齐全，这份合同可以支撑一次公平比较——前提是两边用同一份判据与同一批 seed。'
        : '还缺 ' + (6 - n) + ' 项。缺 evidence 最危险：它看起来和真数据一样，却可能全部来自合成渲染。';
    }
  }

  /* ---------- 08 反例 ---------- */
  var CASES = {
    1: {
      title: '反例 A · 训练只见正面摄像头',
      setup: '训练集全部来自正面固定机位；测试时把相机移到侧面 45°，其余条件完全不变。',
      pred: '成功率显著下降。因为输入的观测分布发生了转移（observation distribution shift），而动作标签没变。',
      test: '固定机器人、seed、任务、物体；只改相机外参，跑同一测试集。若不下降，说明策略对该视角确实不变——这才叫证据。',
      where: '观测层（第 1 环），不是策略容量不足。',
      note: '注意区分两种“分布偏移”：观测分布偏移（看到的东西变了）与状态分布偏移（走到的地方变了，即 covariate shift）。前者靠数据增强能缓解一部分，后者只能靠闭环纠错或覆盖更多状态。'
    },
    2: {
      title: '反例 B · 动作块执行中门突然关闭',
      setup: '策略一次输出 H = 16 步 @10 Hz（1.6 s 开环）；门在 0.8 s 时被风关上。',
      pred: '这一块剩余步仍按“门是开的”执行，机器人会撞在门上；直到下一块重新观测才发现。',
      test: '同 seed、同场景，只把 H 改成 2（0.2 s 开环）重跑。若失败率明显下降，就证明失败来自块内无纠错，而不是策略本身不会开门。',
      where: '时序层（第 3 环到第 5 环的闭环频率），不是感知精度问题。',
      note: '这个反例的价值在于：它把“策略能力”与“闭环频率”两个因素分开了。面试里能主动说出这个对照，比说“我们的模型更强”可信得多。'
    }
  };

  function selectCase(n) {
    var c = CASES[n];
    if (!c) return;
    var b1 = $('d7-c-1'), b2 = $('d7-c-2');
    if (b1) b1.setAttribute('aria-pressed', String(n) === '1' ? 'true' : 'false');
    if (b2) b2.setAttribute('aria-pressed', String(n) === '2' ? 'true' : 'false');
    var t = $('d7-c-title'), s = $('d7-c-setup'), p = $('d7-c-pred'), te = $('d7-c-test'), w = $('d7-c-where'), no = $('d7-c-note');
    if (t) t.textContent = c.title;
    if (s) s.textContent = c.setup;
    if (p) p.textContent = c.pred;
    if (te) te.textContent = c.test;
    if (w) w.textContent = c.where;
    if (no) no.textContent = c.note;
  }

  /* ---------- 09 泄漏自检 ---------- */
  var LK = ['d7-lk-1', 'd7-lk-2', 'd7-lk-3', 'd7-lk-4', 'd7-lk-5'];
  function leak() {
    var n = 0;
    LK.forEach(function (id) { var el = $(id); if (el && el.checked) n++; });
    var c = $('d7-lk-count');
    if (c) c.textContent = n + ' / 5';
    var v = $('d7-lk-verdict');
    if (v) {
      v.textContent = n === 5 ? '独立测试集成立' : (n >= 3 ? '部分隔离，仍有泄漏风险' : '存在泄漏风险');
      v.className = 'flag ' + (n === 5 ? 'ok' : (n >= 3 ? 'warn' : 'bad'));
    }
  }

  /* ---------- 10 六栏答卷 ---------- */
  var EX = ['d7-ex-1', 'd7-ex-2', 'd7-ex-3', 'd7-ex-4', 'd7-ex-5', 'd7-ex-6'];
  function exam() {
    var n = 0;
    EX.forEach(function (id) { var el = $(id); if (el && el.checked) n++; });
    var c = $('d7-ex-count');
    if (c) c.textContent = n + ' / 6';
    var l = $('d7-ex-level');
    if (l) {
      var text = '未开始';
      if (n >= 6) text = '完整证据链（含未实测标注）';
      else if (n >= 4) text = '有过推演';
      else if (n >= 1) text = '刚开始';
      l.textContent = text;
    }
  }

  /* ---------- 11 五维自评 ---------- */
  var SC = ['d7-sc-1', 'd7-sc-2', 'd7-sc-3', 'd7-sc-4', 'd7-sc-5'];
  var TIPS = ['概念定义', '因果链条', '工程接口', '验证证据', '经历真实性'];
  function score() {
    var total = 0, min = 99, minIdx = 0;
    SC.forEach(function (id, i) {
      var el = $(id);
      var out = $(id + '-out');
      var v = el ? parseInt(el.value, 10) : 0;
      if (out) out.textContent = String(v);
      total += v;
      if (v < min) { min = v; minIdx = i; }
    });
    var t = $('d7-sc-total');
    if (t) t.textContent = total + ' / 20';
    var tip = $('d7-sc-tip');
    if (tip) tip.textContent = total >= 16 ? '可以进下一轮追问' : ('先补' + TIPS[minIdx]);
    var note = $('d7-sc-note');
    if (note) {
      note.textContent = '“验证”这一维今天给 0 分是诚实的：本页没有训练、没有 rollout、没有成功率。把 0 记下来，才有后面从 0 到 1 的空间。';
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    var t = $('d7-view-truth'), o = $('d7-view-obs');
    if (t) t.addEventListener('click', function () { renderSO('truth'); });
    if (o) o.addEventListener('click', function () { renderSO('obs'); });
    renderSO('obs');

    Object.keys(MDP).forEach(function (k) {
      var btn = $(MDP[k].btn);
      if (btn) btn.addEventListener('click', function () { selectMDP(k); });
    });
    selectMDP('s');

    Object.keys(METHODS).forEach(function (k) {
      var btn = $('d7-m-' + k);
      if (btn) btn.addEventListener('click', function () { selectMethod(k); });
    });
    selectMethod('bc');

    ['d7-h', 'd7-f'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', chunk);
    });
    chunk();

    Object.keys(PIPE).forEach(function (k) {
      var btn = $('d7-p-' + k);
      if (btn) btn.addEventListener('click', function () { selectPipe(k); });
    });
    selectPipe(1);

    Object.keys(ROUTES).forEach(function (k) {
      var btn = $('d7-r-' + k);
      if (btn) btn.addEventListener('click', function () { selectRoute(k); });
    });
    selectRoute('tamp');

    CT.forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', contract); });
    contract();

    var c1 = $('d7-c-1'), c2 = $('d7-c-2');
    if (c1) c1.addEventListener('click', function () { selectCase(1); });
    if (c2) c2.addEventListener('click', function () { selectCase(2); });
    selectCase(1);

    LK.forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', leak); });
    leak();

    EX.forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', exam); });
    exam();

    SC.forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', score); });
    score();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
