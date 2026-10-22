/* Day 8 · 相关工作对照、证据分级、公平基线与材料冻结 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function fillTable(bodyId, rows, opts) {
    var body = $(bodyId);
    if (!body) return;
    body.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (cell, i) {
        var el = document.createElement(i === 0 ? 'th' : 'td');
        if (cell && typeof cell === 'object') {
          el.textContent = cell.text;
          if (cell.flag) {
            var span = document.createElement('span');
            span.className = 'flag ' + cell.flag;
            span.textContent = cell.tag || cell.text;
            el.textContent = '';
            el.appendChild(span);
            if (cell.text) {
              el.appendChild(document.createTextNode(' ' + cell.text));
            }
          }
        } else {
          el.textContent = cell;
        }
        tr.appendChild(el);
      });
      body.appendChild(tr);
    });
    if (opts && opts.tabs) {
      opts.tabs.forEach(function (k) {
        var btn = $(opts.prefix + k);
        if (btn) btn.setAttribute('aria-pressed', k === opts.active ? 'true' : 'false');
      });
    }
  }

  /* ---------- 01 三个工作 ---------- */
  var NAMES = {
    mansion: {
      name: 'MANSION',
      rows: [
        ['输入', '语言 / 布局条件驱动的多房间（多楼层）室内场景生成（按摘要层次理解）'],
        ['中间状态', '房间与楼层级的结构化布局，再落到三维资产（具体表示形式待查原文方法节）'],
        ['产物', '带家具与房间结构的三维室内场景（是否可以交互、是否含关节，待查）'],
        ['限制', '主要面向静态场景生成；机器人可执行性、关节状态、动态门锁是否覆盖，待查'],
        ['证据等级', { text: '二手摘要层', flag: 'warn', tag: '论文已展示（摘要）' }]
      ],
      note: '对 MANSION 说得最稳的一句是：“它做多房间/多楼层的室内场景生成”。再往前的每一句，都需要你指到章节。'
    },
    sw: {
      name: 'SceneWeaver（NeurIPS）',
      rows: [
        ['输入', '待查（必须先读原文；与我的个人项目同名，但完全不是同一个工作）'],
        ['中间状态', '待查'],
        ['产物', '待查'],
        ['限制', '待查'],
        ['证据等级', { text: '未读原文', flag: 'bad', tag: '待查' }]
      ],
      note: '同名是最危险的情况：评委很可能读过它。没读就说不熟，比含糊其辞安全一百倍。'
    },
    holo: {
      name: 'Holodeck',
      rows: [
        ['输入', '自然语言描述 → 室内场景（语言指令驱动）'],
        ['中间状态', '物体级布局 + 从资产库检索到的三维模型'],
        ['产物', '可探索的室内三维场景'],
        ['限制', '以静态摆放为主；物理属性、关节交互、机器人可执行性的覆盖范围，待查原文'],
        ['证据等级', { text: '二手摘要层', flag: 'warn', tag: '论文已展示（摘要）' }]
      ],
      note: 'Holodeck 最常被引用的是“语言→房间”的生成能力。它的主张边界在物理与交互层面，这一点必须回原文核对后才能下结论。'
    }
  };

  function selectName(key) {
    var n = NAMES[key];
    if (!n) return;
    var name = $('d8-n-name');
    if (name) name.textContent = n.name;
    fillTable('d8-n-rows', n.rows, { tabs: Object.keys(NAMES), prefix: 'd8-n-', active: key });
    var note = $('d8-n-note');
    if (note) note.textContent = n.note;
  }

  /* ---------- 02 五维矩阵 ---------- */
  var MATRIX = {
    mansion: {
      rows: [
        ['输入任务', '语言 / 布局条件的多房间室内生成', { text: '摘要层', flag: 'warn', tag: '论文已展示' }],
        ['空间表示', '房间与楼层结构化布局 + 三维资产（细节待查）', { text: '待核对方法节', flag: 'warn', tag: '待查' }],
        ['动态状态与交互', '静态场景为主；门/抽屉等关节与状态是否建模，待查', { text: '未核实', flag: 'bad', tag: '待查' }],
        ['实验基线', '论文自带基线；指标与数值本页不复述', { text: '未读全表', flag: 'bad', tag: '待查' }],
        ['已证明范围', '生成质量与场景结构一致性；<不包含> 机器人 rollout 成功率', { text: '可推断的边界', flag: 'warn', tag: '论文已展示' }]
      ],
      note: '“已证明范围”这一行最容易写错：论文证明的是它自己的指标，不是你的任务成功率。'
    },
    sw: {
      rows: [
        ['输入任务', '待查（同名不同物，不能按我的项目去猜）', { text: '未读', flag: 'bad', tag: '待查' }],
        ['空间表示', '待查', { text: '未读', flag: 'bad', tag: '待查' }],
        ['动态状态与交互', '待查', { text: '未读', flag: 'bad', tag: '待查' }],
        ['实验基线', '待查', { text: '未读', flag: 'bad', tag: '待查' }],
        ['已证明范围', '待查', { text: '未读', flag: 'bad', tag: '待查' }]
      ],
      note: '五个“待查”不是偷懒，是准确。读完原文后把它们逐个替换成带章节号的句子，这一格才算真正填上。'
    },
    holo: {
      rows: [
        ['输入任务', '自然语言指令 → 室内场景', { text: '摘要层', flag: 'warn', tag: '论文已展示' }],
        ['空间表示', '物体级布局 + 资产检索', { text: '摘要层', flag: 'warn', tag: '论文已展示' }],
        ['动态状态与交互', '静态摆放为主；物理与关节覆盖待查', { text: '未核实', flag: 'bad', tag: '待查' }],
        ['实验基线', '论文自带基线；数值本页不复述', { text: '未读全表', flag: 'bad', tag: '待查' }],
        ['已证明范围', '生成场景的语义与布局合理性；物理可执行性不在主张内（需核对）', { text: '边界推断', flag: 'warn', tag: '论文已展示' }]
      ],
      note: '注意措辞：是“不在其主张内”，不是“它做不到”。前者是读懂了主张边界，后者是在替作者下判断。'
    },
    mine: {
      rows: [
        ['输入任务', '概念图 / 语言 → UE5 可交互场景（个人项目）', { text: '本人实现', flag: 'ok', tag: '个人已验证' }],
        ['空间表示', '语义分层 + 空间约束（个人实现层次，细节以自查为准）', { text: '本人实现', flag: 'ok', tag: '个人已验证' }],
        ['动态状态与交互', '门/抽屉等关节交互覆盖有限；可通行性随状态变化尚未建模', { text: '已知缺口', flag: 'bad', tag: '待补' }],
        ['实验基线', '暂无公平基线', { text: '最大缺口', flag: 'bad', tag: '待补' }],
        ['已证明范围', '流程端到端跑通；AI 推理尚未接入真实模型', { text: '局部验证', flag: 'warn', tag: '个人已验证（局部）' }]
      ],
      note: '自己这一栏反而要写得最狠。把“暂无公平基线”写在明面上，比等评委指出来好。'
    }
  };

  function selectMatrix(key) {
    var m = MATRIX[key];
    if (!m) return;
    fillTable('d8-x-rows', m.rows, { tabs: Object.keys(MATRIX), prefix: 'd8-x-', active: key });
    var note = $('d8-x-note');
    if (note) note.textContent = m.note;
  }

  /* ---------- 03 两个反例 ---------- */
  var COUNTER = {
    1: {
      title: '反例 A · 二楼的门锁着，机器人没有开锁技能',
      setup: '两层住宅，楼梯净宽 1.1 m、门洞 0.9 m，全部满足几何合法性；但二楼通往目标房间的门处于 locked 状态，且机器人没有开锁动作。',
      layer: '静态拓扑与几何全部合法，失败发生在动态状态层：门的可通行性随状态变化。',
      rows: [
        ['MANSION', { text: '待查', flag: 'warn', tag: '待查' }, '门锁等动态状态是否在其表示内，需核对方法节', '只能说“静态几何可合法；动态状态覆盖待查”'],
        ['SceneWeaver（NeurIPS）', { text: '待查', flag: 'bad', tag: '待查' }, '未读原文，无法判断', '不作判断'],
        ['Holodeck', { text: '待查', flag: 'warn', tag: '待查' }, '以静态摆放为主，锁状态是否建模需核对', '“该反例可能超出其主张范围（待核实）”'],
        ['我的 SceneWeaver', { text: '信息不足', flag: 'bad', tag: '信息不足' }, '当前表示里没有“可通行性随状态变化”的字段', '“我的方法处理不了这个反例，需要补动态状态”']
      ],
      note: '这个反例的价值：它把“几何合法率”与“任务可行率”彻底分开了。前者 100% 的场景，后者可能是 0%。'
    },
    2: {
      title: '反例 B · 楼梯净宽 0.62 m，机器人肩宽 0.58 m',
      setup: '楼梯净宽 0.62 m；机器人肩宽 0.58 m，安全余量要求 0.10 m。总需求 0.68 m > 0.62 m，实际差 0.06 m。',
      layer: '几何层能算出净空，但“够不够”取决于机器人 footprint 与安全余量——这一半信息在场景之外。',
      rows: [
        ['MANSION', { text: '信息不足（未含机器人模型）', flag: 'warn', tag: '待核对' }, '是否报告机器人尺寸/净空判据，需查实验设置', '“净空可算，但可通行性判定需要机器人模型”'],
        ['SceneWeaver（NeurIPS）', { text: '待查', flag: 'bad', tag: '待查' }, '未读原文', '不作判断'],
        ['Holodeck', { text: '信息不足（未含机器人模型）', flag: 'warn', tag: '待核对' }, '同上：生成层面通常不含特定机器人约束', '“它不做机器人可执行性判定（需核对其主张）”'],
        ['我的 SceneWeaver', { text: '信息不足', flag: 'bad', tag: '信息不足' }, '生成约束里没有机器人 footprint 与安全余量', '“需要把机器人尺寸作为生成约束的一部分”']
      ],
      note: '差别 0.06 m 听起来很小，但它决定了“规划器认为可过”和“实际会卡住”。这类边界值必须用具体机器人数值算，不能靠感觉。'
    }
  };

  function selectCounter(n) {
    var c = COUNTER[n];
    if (!c) return;
    var t = $('d8-c-title'), s = $('d8-c-setup'), l = $('d8-c-layer');
    if (t) t.textContent = c.title;
    if (s) s.textContent = c.setup;
    if (l) l.textContent = c.layer;
    fillTable('d8-c-rows', c.rows, { tabs: ['1', '2'], prefix: 'd8-c-', active: String(n) });
    var note = $('d8-c-note');
    if (note) note.textContent = c.note;
  }

  /* ---------- 04 贡献四分类 ---------- */
  var EV_ITEMS = [
    '实习中的仿真环境搭建（团队项目，我负责其中一部分）',
    '个人项目：概念图 → UE5 场景流程',
    '开源仓库里的 PCG 工具（基于他人 MIT 项目修改）',
    '正在写的场景生成方法（尚未实现）',
    '课程作业里的多模态交互 demo',
    '简历上“提升 X%”的指标'
  ];
  var EV_CATS = ['本人做过', '团队成果', '开源现有', '拟研究', '未选择'];

  function buildEvidence() {
    var body = $('d8-e-rows');
    if (!body) return;
    body.textContent = '';
    EV_ITEMS.forEach(function (label, i) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.textContent = label;
      var td = document.createElement('td');
      var sel = document.createElement('select');
      sel.className = 'form-select';
      sel.id = 'd8-e-' + (i + 1);
      sel.setAttribute('aria-label', '为“' + label + '”选择类别');
      EV_CATS.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        sel.appendChild(o);
      });
      sel.value = '未选择';
      sel.addEventListener('change', evidence);
      td.appendChild(sel);
      tr.appendChild(th);
      tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function evidence() {
    var counts = {};
    var marked = 0;
    EV_ITEMS.forEach(function (label, i) {
      var sel = $('d8-e-' + (i + 1));
      var v = sel ? sel.value : '未选择';
      if (v !== '未选择') marked++;
      counts[v] = (counts[v] || 0) + 1;
    });
    var c = $('d8-e-count');
    if (c) c.textContent = marked + ' / ' + EV_ITEMS.length;
    var v = $('d8-e-verdict');
    if (v) {
      if (marked < EV_ITEMS.length) {
        v.textContent = '还有 ' + (EV_ITEMS.length - marked) + ' 项未标注';
        v.className = 'flag warn';
      } else {
        v.textContent = '本人 ' + (counts['本人做过'] || 0) + ' / 团队 ' + (counts['团队成果'] || 0) + ' / 开源 ' + (counts['开源现有'] || 0) + ' / 拟研究 ' + (counts['拟研究'] || 0);
        v.className = 'flag ok';
      }
    }
    var note = $('d8-e-note');
    if (note) {
      note.textContent = marked < EV_ITEMS.length
        ? '四类里最容易出事的是“把团队成果说成个人成果”，以及“把拟研究说成已完成”。先把每一行标完。'
        : '标完不等于安全：每一行还要能回答“时间、我的角色、可指认的产出”。三问答不出，就降一级。';
    }
  }

  /* ---------- 05 公平基线 ---------- */
  function protocol(mode) {
    var rows = [
      ['手工布局', '—（未实测）', '—（未实测）', '—（未实测）'],
      ['规则 PCG', '—（未实测）', '—（未实测）', '—（未实测）'],
      ['我的方法', '—（未实测）', '—（未实测）', '—（未实测）']
    ];
    fillTable('d8-p-rows', rows, { tabs: ['yes', 'no'], prefix: 'd8-p-', active: mode });
    var note = $('d8-p-note');
    if (note) {
      note.textContent = mode === 'no'
        ? '未运行时，三列都必须写“—（未实测）”。空表不是丢人，编数字才是。'
        : '如果已经跑了，那就要报：每格 n、均值、95% 置信区间、完整 seed 列表、判据版本号。只报一个均值，等于没报。';
    }
  }

  /* ---------- 06 90 秒叙事 ---------- */
  var RATE = 3.5;
  var PITCH = ['d8-pitch-1', 'd8-pitch-2', 'd8-pitch-3'];
  function pitch() {
    var total = 0;
    PITCH.forEach(function (id) {
      var el = $(id);
      var out = $(id + '-out');
      var text = el ? el.value.trim() : '';
      var n = text.length;
      var sec = n / RATE;
      total += sec;
      if (out) out.textContent = n + ' 字 · ' + sec.toFixed(1) + ' s';
    });
    var t = $('d8-pitch-total');
    if (t) t.textContent = total.toFixed(1) + ' s';
    var v = $('d8-pitch-verdict');
    if (v) {
      var text = '还没开始写', kind = '';
      if (total === 0) { text = '还没开始写'; kind = ''; }
      else if (total < 30) { text = '太短，信息量不够'; kind = 'warn'; }
      else if (total <= 90) { text = '时长合适'; kind = 'ok'; }
      else { text = '超时，删到 90 秒以内'; kind = 'bad'; }
      v.textContent = text;
      v.className = 'flag ' + kind;
    }
    var note = $('d8-pitch-note');
    if (note) {
      note.textContent = total > 90
        ? '超时了。优先删形容词和背景，保留“做了什么、缺什么、想验证什么”三个动词句。'
        : '三句话里最容易被跳过的是第三句。但评委真正想听的就是它——你有没有一个自己都还没答案、但可以验证的问题。';
    }
  }

  /* ---------- 07 材料冻结 ---------- */
  var FREEZE_ITEMS = [
    'GDC 团队成果',
    '个人腾讯参与部分',
    'INZ Lab 多模态交互',
    '创业营 / 创业项目',
    'NUS 交换',
    'Cambridge AI Summer',
    '在研方向（具身环境生成）'
  ];
  var FREEZE_STATES = ['未填写', '已完成', '团队成果', '计划', '需要核实'];

  function buildFreeze() {
    var body = $('d8-f-rows');
    if (!body) return;
    body.textContent = '';
    FREEZE_ITEMS.forEach(function (label, i) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.textContent = label;
      var td = document.createElement('td');
      var sel = document.createElement('select');
      sel.className = 'form-select';
      sel.id = 'd8-f-' + (i + 1);
      sel.setAttribute('aria-label', '为“' + label + '”选择冻结状态');
      FREEZE_STATES.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
      });
      sel.value = '未填写';
      sel.addEventListener('change', freeze);
      td.appendChild(sel);
      tr.appendChild(th);
      tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function freeze() {
    var marked = 0, needCheck = 0, done = 0;
    FREEZE_ITEMS.forEach(function (label, i) {
      var sel = $('d8-f-' + (i + 1));
      var v = sel ? sel.value : '未填写';
      if (v !== '未填写') marked++;
      if (v === '需要核实') needCheck++;
      if (v === '已完成') done++;
    });
    var c = $('d8-f-count');
    if (c) c.textContent = marked + ' / ' + FREEZE_ITEMS.length;
    var ch = $('d8-f-check');
    if (ch) {
      ch.textContent = needCheck + ' 项';
      ch.className = 'flag ' + (needCheck === 0 ? 'ok' : 'warn');
    }
    var safety = 0;
    ['d8-f-safe-1', 'd8-f-safe-2', 'd8-f-safe-3', 'd8-f-safe-4'].forEach(function (id) {
      var el = $(id);
      if (el && el.checked) safety++;
    });
    var note = $('d8-f-note');
    if (note) {
      note.textContent = marked < FREEZE_ITEMS.length
        ? '还有 ' + (FREEZE_ITEMS.length - marked) + ' 项没标状态。冻结不是“写完”，是“每一行都知道自己在哪一格”。'
        : (safety < 4
          ? '状态标完了，但安全清单还差 ' + (4 - safety) + ' 项。公开仓库里的一条手机号就足够让材料作废。'
          : '状态与安全清单都过了。剩下的是事实核对：每个头衔都要能被追问两层（时间、角色、产出）。');
    }
  }

  /* ---------- 08 六栏答卷 ---------- */
  var EX = ['d8-ex-1', 'd8-ex-2', 'd8-ex-3', 'd8-ex-4', 'd8-ex-5', 'd8-ex-6'];
  function exam() {
    var n = 0;
    EX.forEach(function (id) { var el = $(id); if (el && el.checked) n++; });
    var c = $('d8-ex-count');
    if (c) c.textContent = n + ' / 6';
    var l = $('d8-ex-level');
    if (l) {
      var text = '未开始';
      if (n >= 6) text = '完整六栏（含未实测标注）';
      else if (n >= 4) text = '有过推演';
      else if (n >= 1) text = '刚开始';
      l.textContent = text;
    }
  }

  /* ---------- 09 五维自评 ---------- */
  var SC = ['d8-sc-1', 'd8-sc-2', 'd8-sc-3', 'd8-sc-4', 'd8-sc-5'];
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
    var t = $('d8-sc-total');
    if (t) t.textContent = total + ' / 20';
    var tip = $('d8-sc-tip');
    if (tip) tip.textContent = total >= 16 ? '可以进下一轮追问' : ('先补' + TIPS[minIdx]);
  }

  /* ---------- boot ---------- */
  function boot() {
    Object.keys(NAMES).forEach(function (k) {
      var btn = $('d8-n-' + k);
      if (btn) btn.addEventListener('click', function () { selectName(k); });
    });
    selectName('mansion');

    Object.keys(MATRIX).forEach(function (k) {
      var btn = $('d8-x-' + k);
      if (btn) btn.addEventListener('click', function () { selectMatrix(k); });
    });
    selectMatrix('mansion');

    var c1 = $('d8-c-1'), c2 = $('d8-c-2');
    if (c1) c1.addEventListener('click', function () { selectCounter(1); });
    if (c2) c2.addEventListener('click', function () { selectCounter(2); });
    selectCounter(1);

    buildEvidence();
    evidence();

    var py = $('d8-p-yes'), pn = $('d8-p-no');
    if (py) py.addEventListener('click', function () { protocol('yes'); });
    if (pn) pn.addEventListener('click', function () { protocol('no'); });
    protocol('no');

    PITCH.forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', pitch);
    });
    pitch();

    buildFreeze();
    freeze();
    ['d8-f-safe-1', 'd8-f-safe-2', 'd8-f-safe-3', 'd8-f-safe-4'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', freeze);
    });

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

/* ---------- 06 从一句话到可编辑资产 / 07 多模型异步一致性 ---------- */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  /* ===== 06 四道关 ===== */
  var CAND = [
    {
      k: 'a',
      input: '输入：“一间 4 × 3 米的卧室，门通向走廊。” ｜ A 的输出：{"room":[4,3],"door":{"width":0.9}}',
      cells: [
        ['房间尺寸有、门宽有，但 <code>door.wall</code> 缺失，长度没有单位声明', 'bad'],
        ['未检查（第 1 关就拦下了）', 'skip'],
        ['未检查', 'skip'],
        ['未检查', 'skip']
      ],
      title: '关 1 拦下：缺字段',
      why: '门没有所属的墙，几何阶段无法判断它开在哪。单位不写，"4" 到底是米还是格子，下游只能猜。这种输出看起来最像"能跑"，其实只是把问题推给了下一层。'
    },
    {
      k: 'b',
      input: '输入：“一间 4 × 3 米的卧室，门通向走廊。” ｜ B 的输出：{"w_mm":4000,"h_mm":3000,"unit":"m","door":{"wall":"shared","width":900}}',
      title: '关 1 拦下：单位自相矛盾',
      cells: [
        ['字段名说毫米（<code>w_mm</code>），顶层 <code>unit</code> 又写 m，门宽 900 无单位', 'bad'],
        ['未检查', 'skip'],
        ['未检查', 'skip'],
        ['未检查', 'skip']
      ],
      why: '这种错误最危险的地方是：它<strong>能算出一个结果</strong>。4000 被当成米，得到一间 4 公里长的卧室，求解器照样 sat。单位错误不会让程序崩，只会让结论错。'
    },
    {
      k: 'c',
      input: '输入：“一间 4 × 3 米的卧室，门通向走廊。” ｜ C 的输出：字段齐全、单位 m、门开在共享墙、房间 4 × 3 —— 但地块外框只有 3 × 3。',
      cells: [
        ['字段齐、类型对、单位 m', 'ok'],
        ['<code>unsat</code>：房间必须在地块内，4 &gt; 3', 'bad'],
        ['未检查', 'skip'],
        ['未检查', 'skip']
      ],
      title: '关 2 拦下：约束互相矛盾',
      why: 'unsat 不是"运气不好"，是<strong>你写下的要求之间真的没有交集</strong>。正确的下一步是找出哪两条要求冲突（Day 2 的 unsat core），而不是换个种子重跑。'
    },
    {
      k: 'd',
      input: '输入：“一间 4 × 3 米的卧室，门通向走廊。” ｜ D 的输出：全部 <code>sat</code>、几何后验通过、门宽 0.8 m —— 而机器人宽 0.9 m。',
      cells: [
        ['字段齐、类型对、单位 m', 'ok'],
        ['<code>sat</code>，给出一组坐标', 'ok'],
        ['不重叠、门在共享墙上、净宽 0.8 m 自洽', 'ok'],
        ['门宽 0.8 m &lt; 机身 0.9 m：进不去', 'bad']
      ],
      title: '关 4 拦下：几何合法，任务不可执行',
      why: '这是四关里最容易被跳过的一关，也是面试官最爱问的一关。<strong>前两关只管"这间屋子成不成立"，第四关才管"这台机器人能不能用"</strong>——两者之间没有任何自动推导关系。'
    },
    {
      k: 'e',
      input: '输入：“一间 4 × 3 米的卧室，门通向走廊。” ｜ E 的输出：字段齐、单位 m、<code>sat</code>、几何后验通过、门宽 1.2 m 且开在共享墙上、无锁。',
      cells: [
        ['字段齐、类型对、单位 m', 'ok'],
        ['<code>sat</code>，给出一组坐标', 'ok'],
        ['不重叠、门在共享墙上、净宽 1.2 m', 'ok'],
        ['门宽 1.2 m &gt; 机身 0.9 m，无锁、无门槛：可通行', 'ok']
      ],
      title: '四关全过：这一份可以用',
      why: '注意这一份通过了，也只说明<strong>它能被拿去当候选</strong>。要不要提交、提交后机器人真的能不能走过去，仍然要由下一层（Day 6 的仿真、Day 7 的策略）来回答。'
    }
  ];

  function chainPaint(key) {
    var body = $('d8-ch-gates');
    if (!body) return;
    var c = null;
    CAND.forEach(function (x) { if (x.k === key) c = x; });
    if (!c) return;
    body.textContent = '';
    c.cells.forEach(function (cell, i) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.textContent = (i + 1) + ' · ' + ['结构', '可解', '几何后验', '任务前提'][i];
      var td1 = document.createElement('td');
      td1.innerHTML = cell[0];
      var td2 = document.createElement('td');
      var sp = document.createElement('span');
      sp.className = 'flag ' + (cell[1] === 'ok' ? 'ok' : cell[1] === 'bad' ? 'bad' : 'warn');
      sp.textContent = cell[1] === 'ok' ? '通过' : cell[1] === 'bad' ? '不通过' : '未检查';
      td2.appendChild(sp);
      tr.appendChild(th); tr.appendChild(td1); tr.appendChild(td2);
      body.appendChild(tr);
    });
    var inp = $('d8-ch-input');
    if (inp) inp.textContent = c.input;
    var log = $('d8-ch-log');
    if (log) {
      log.textContent = '';
      var p1 = document.createElement('p');
      p1.className = c.k === 'e' ? 'is-good' : 'is-bad';
      p1.textContent = c.title;
      var p2 = document.createElement('p');
      p2.innerHTML = c.why;
      log.appendChild(p1); log.appendChild(p2);
    }
    ['a', 'b', 'c', 'd', 'e'].forEach(function (k) {
      var b = $('d8-ch-' + k);
      if (b) b.setAttribute('aria-pressed', k === key ? 'true' : 'false');
    });
  }

  ['a', 'b', 'c', 'd', 'e'].forEach(function (k) {
    var b = $('d8-ch-' + k);
    if (b) b.addEventListener('click', function () { chainPaint(k); });
  });
  if ($('d8-ch-gates')) chainPaint('a');

  /* ===== 07 乱序回填 ===== */
  var LAB = { table: '桌子', chair: '椅子', lamp: '灯', rug: '地毯' };
  var SLOTS = ['table', 'chair', 'lamp', 'rug'];
  var EV = [
    { t: '00:01', n: '桌子（taskId=T，v1）生成成功', task: 'table', ver: 1, ok: true },
    { t: '00:02', n: '椅子（taskId=C，v1）生成成功', task: 'chair', ver: 1, ok: true },
    { t: '00:04', n: '灯（taskId=L，v1）超时失败', task: 'lamp', ver: 1, ok: false },
    { t: '00:05', n: '桌子（taskId=T，v1）的重试副本成功', task: 'table', ver: 1, ok: true },
    { t: '00:07', n: '桌子（taskId=T，v0）一小时前的旧结果晚到', task: 'table', ver: 0, ok: true },
    { t: '00:09', n: '地毯（taskId=R，v1）生成成功', task: 'rug', ver: 1, ok: true }
  ];

  function asyncRun() {
    var body = $('d8-a-events');
    if (!body) return;
    var T = $('d8-a-task').checked;
    var I = $('d8-a-idem').checked;
    var V = $('d8-a-ver').checked;
    var A = $('d8-a-atomic').checked;

    var scene = {};
    var arr = 0;
    var failed = false;
    var bad = { mis: false, dup: false, stale: false, fake: false };
    var rows = [];

    EV.forEach(function (ev) {
      if (!ev.ok) {
        failed = true;
        rows.push([ev.t, ev.n, '标为失败，不写入场景']);
        return;
      }
      var slot;
      var action = '';
      if (T) {
        slot = ev.task;
      } else {
        arr += 1;
        if (arr > 4) {
          bad.mis = true;
          rows.push([ev.t, ev.n, '四个槽位已满，直接丢弃']);
          return;
        }
        slot = SLOTS[arr - 1];
        if (slot !== ev.task) bad.mis = true;
        action = '按第 ' + arr + ' 个返回，落进「' + LAB[slot] + '」槽';
      }
      var cur = scene[slot];
      if (T && I && cur && cur.task === ev.task && cur.ver === ev.ver) {
        rows.push([ev.t, ev.n, '幂等丢弃：同一 taskId + version 已提交过']);
        return;
      }
      if (T && V && cur && cur.task === ev.task && ev.ver < cur.ver) {
        rows.push([ev.t, ev.n, '陈旧丢弃：v' + ev.ver + ' 比已提交的 v' + cur.ver + ' 旧']);
        return;
      }
      if (T && !V && cur && cur.task === ev.task && ev.ver < cur.ver) {
        bad.stale = true;
        action = (action ? action + '；' : '') + '旧结果覆盖了新的 v' + cur.ver;
      }
      if (T && !I && cur && cur.task === ev.task && cur.ver === ev.ver) {
        bad.dup = true;
        action = (action ? action + '；' : '') + '重复提交同一版本';
      }
      scene[slot] = { task: ev.task, ver: ev.ver };
      rows.push([ev.t, ev.n, action || ('写入「' + LAB[slot] + '」槽')]);
    });

    if (failed && !A) bad.fake = true;

    body.textContent = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (c, i) {
        var el = document.createElement(i === 0 ? 'th' : 'td');
        el.textContent = c;
        tr.appendChild(el);
      });
      body.appendChild(tr);
    });

    var view;
    if (failed && A) {
      var before = SLOTS.map(function (s2) { return scene[s2] ? LAB[scene[s2].task] : '—'; }).join(' / ');
      view = '整批回滚，未提交 ｜ 回滚前落位：' + before;
    } else {
      view = SLOTS.map(function (s) {
        return LAB[s] + '：' + (scene[s] ? LAB[scene[s].task] + ' v' + scene[s].ver : '—');
      }).join(' ｜ ');
      if (failed && !A) view += ' ｜ 灯：缺（但仍提交）';
    }
    var sv = $('d8-a-scene');
    if (sv) sv.textContent = view;

    var issues = [];
    if (bad.mis) issues.push('串位');
    if (bad.dup) issues.push('重复提交');
    if (bad.stale) issues.push('版本倒退');
    if (bad.fake) issues.push('假成功');
    var vd = $('d8-a-verdict');
    if (vd) {
      vd.textContent = issues.length ? issues.join(' + ') : (failed ? '一致（缺一盏灯，整批未提交）' : '一致');
      vd.style.color = issues.length ? 'var(--destructive)' : '';
    }

    var log = $('d8-a-log');
    if (log) {
      log.textContent = '';
      function line(txt, cls) {
        var p = document.createElement('p');
        if (cls) p.className = cls;
        p.textContent = txt;
        log.appendChild(p);
      }
      if (!T) line('关掉任务 ID 归属：结果只能按到达顺序落位，第四个成功结果（桌子的重试副本）被当成第四个物体，地毯因此丢失。', 'is-bad');
      if (!T && I) line('注意：没有 taskId 时，幂等键根本无从建立——幂等依赖“任务身份”，不是依赖“结果内容”。', 'is-bad');
      if (T && !I) line('关掉幂等：重试副本会被再提交一次。场景里可能看不出差别，账单和实例数上看得出。', 'is-bad');
      if (T && !V) line('关掉版本比较：一小时前的 v0 覆盖了刚提交的 v1，你改好的结果被静悄悄冲掉。', 'is-bad');
      if (!A) line('关掉原子回填：灯失败了，另外三个照样提交，最终状态却写着 success——这就是“假成功”。', 'is-bad');
      if (!issues.length) line('四道保护都在：结果各归各位、重复被丢弃、旧的被丢弃、缺一个就整批不提交。', 'is-good');
      if (!issues.length) line('下一步不是重跑全部，而是只重跑灯，然后重新尝试提交整批。', '');
    }
  }

  ['d8-a-task', 'd8-a-idem', 'd8-a-ver', 'd8-a-atomic'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('change', asyncRun);
  });
  if ($('d8-a-events')) asyncRun();
})();
