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
