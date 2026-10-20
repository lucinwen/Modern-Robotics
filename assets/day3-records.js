(function () {
  'use strict';
  const KINDS = ['planning', 'minilab'];
  const RULE_STATUSES = ['invalid_input', 'invalid_geometry', 'blocked_topology', 'blocked_geometry', 'blocked_state', 'blocked_action', 'rule_feasible'];
  function strings(value) { return Array.isArray(value) && value.every(function (item) { return typeof item === 'string'; }); }
  function sameFacts(a, b) { return JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort()); }
  function caseList(data, kind) {
    if (!KINDS.includes(kind)) throw new Error('没有这个实验类别。');
    return kind === 'planning' ? data.planning_cases : data.minilab_cases;
  }
  function selectRecord(data, kind, id) {
    const record = caseList(data, kind).find(function (item) { return item.id === id; });
    if (!record) throw new Error('找不到案例 ' + id + '。');
    return record;
  }
  function validateData(data) {
    if (!data || data.schema_version !== 1 || !data.environment || !data.provenance) throw new Error('记录格式不受当前页面支持。');
    ['python', 'pyperplan', 'platform', 'generated_at_utc'].forEach(function (key) { if (typeof data.environment[key] !== 'string') throw new Error('记录环境缺少 ' + key + '。'); });
    KINDS.forEach(function (kind) {
      const list = caseList(data, kind);
      if (!Array.isArray(list) || !list.length) throw new Error(kind + ' 没有可显示的记录。');
      const ids = new Set();
      list.forEach(function (record) {
        if (!record || typeof record.id !== 'string' || ids.has(record.id) || typeof record.title !== 'string' || !strings(record.changes) || !Number.isFinite(record.elapsed_ms) || record.elapsed_ms < 0 || typeof record.scope !== 'string') throw new Error(kind + ' 的案例字段不完整或编号重复。');
        ids.add(record.id);
        if (record.execution_status !== 'not_run') throw new Error('当前查看器只支持明确标为未进行物理执行的教学记录。');
        if (kind === 'planning') {
          if (!['plan_found', 'no_plan'].includes(record.status) || !strings(record.initial_facts) || !strings(record.goal) || !Array.isArray(record.plan) || !Array.isArray(record.states) || !record.states.length || !Array.isArray(record.trace)) throw new Error('规划案例 ' + record.id + ' 的状态或计划字段不完整。');
          record.states.forEach(function (facts) { if (!strings(facts)) throw new Error('规划状态不是事实列表。'); describeFacts(facts); });
          if (!sameFacts(record.states[0], record.initial_facts)) throw new Error('首状态与记录的初态不一致。');
          if (record.status === 'no_plan') {
            if (record.plan_length !== null || record.plan.length || record.states.length !== 1 || record.trace.length || record.search_exhausted !== true) throw new Error('无计划记录包含了意外轨迹，或没有穷尽证据。');
          } else {
            if (!Number.isInteger(record.plan_length) || record.plan_length < 0 || record.plan.length !== record.plan_length || record.states.length !== record.plan_length + 1 || record.trace.length !== record.plan_length) throw new Error('计划长度与状态轨迹不一致。');
            const final = new Set(record.states[record.states.length - 1]);
            if (!record.goal.every(function (item) { return final.has(item); })) throw new Error('记录的最终状态没有满足目标。');
          }
          record.plan.forEach(function (action, index) {
            if (!action || typeof action.raw !== 'string' || typeof action.name !== 'string' || !strings(action.args) || !strings(action.pre) || !strings(action.add) || !strings(action.del)) throw new Error('记录中的动作字段缺失。');
            const trace = record.trace[index];
            if (!trace || trace.step !== index + 1 || trace.action !== action.raw || !strings(trace.added) || !strings(trace.removed)) throw new Error('动作与增删记录不对应。');
          });
          const check = record.geometry_check;
          if (!check || typeof check.checked !== 'boolean' || typeof check.reason !== 'string' || typeof check.scope !== 'string' || (check.checked ? typeof check.passes !== 'boolean' : check.passes !== null) || !check.input) throw new Error('后验门宽检查记录不完整。');
          if (!['door_width_m', 'robot_width_m', 'extra_margin_m'].every(function (key) { return Number.isFinite(check.input[key]); })) throw new Error('门宽检查缺少数值输入。');
        } else {
          if (!RULE_STATUSES.includes(record.status) || !record.input || !record.input.robot || !Array.isArray(record.input.rooms) || !Array.isArray(record.input.doors) || !Array.isArray(record.input.objects) || typeof record.reason !== 'string' || !record.raw_result || record.raw_result.status !== record.status || record.raw_result.reason !== record.reason || typeof record.input_unchanged !== 'boolean') throw new Error('MiniLab 案例 ' + record.id + ' 的输入或原始结果不完整。');
          ['geometry_valid', 'topology_connected', 'rule_task_feasible'].forEach(function (key) { if (typeof record.raw_result[key] !== 'boolean') throw new Error('MiniLab 缺少字段 ' + key + '。'); });
        }
      });
    });
    return data;
  }
  function describeFacts(facts) {
    const set = new Set(facts), robotRooms = ['a', 'b'].filter(function (room) { return set.has('(at r ' + room + ')'); });
    const cupPlaces = ['a', 'b'].filter(function (room) { return set.has('(item-at cup ' + room + ')'); });
    const held = set.has('(holding r cup)'), locked = set.has('(locked d)'), unlocked = set.has('(unlocked d)'), opened = set.has('(opened d)');
    if (robotRooms.length !== 1 || cupPlaces.length + Number(held) !== 1 || locked === unlocked || (opened && !unlocked)) throw new Error('状态不符合本两房间模型，不能据此绘图。');
    return {room: robotRooms[0].toUpperCase(), cup: held ? '手中' : cupPlaces[0].toUpperCase(), held: held, locked: locked, opened: opened, key: set.has('(has-key r k)'), door: opened ? '已打开' : unlocked ? '已解锁，仍关闭' : '上锁，仍关闭'};
  }
  function planningFrame(record, step) {
    if (!Number.isInteger(step) || step < 0 || step >= record.states.length) throw new Error('状态步数超出本次记录。');
    const transition = step > 0 ? record.trace[step - 1] : null;
    return {facts: record.states[step], action: step > 0 ? record.plan[step - 1] : null, added: transition ? transition.added : [], removed: transition ? transition.removed : [], step: step, total: record.states.length - 1};
  }
  function planningInterpretation(record) {
    if (record.status === 'no_plan') return '本次 BFS 穷尽了当前有限对象、动作和初态允许到达的符号状态，没有找到满足目标的计划。记录只保留已知初态；没有生成后续成功状态，也不能据此断言所有现实办法都无效。';
    if (record.plan_length === 0) return '找到 0 步计划：初态本来就满足目标，不需要执行动作。空计划与“没有计划”含义不同；这次的 plan_length 是 0，不是 null。';
    return '本次找到 ' + record.plan_length + ' 步符号计划。下方按真实记录查看每一步的状态与增删事实；这一序列尚未作为连续运动或物理机器人动作执行。';
  }
  function minilabInterpretation(record) {
    const messages = {
      invalid_input: '输入格式或目标超出原检查器支持的范围。',
      invalid_geometry: '原检查器判定房间或共享墙的基础几何要求不成立。',
      blocked_topology: '声明的门连接图中，没有通向目标房间的路线。',
      blocked_geometry: '原检查器报告门净宽阻止通路。这是它对当前声明尺寸的分类，不是物理机器人已经碰撞的记录。',
      blocked_state: '原检查器的锁、钥匙和解锁能力规则阻止通路。在这个实现里，缺钥匙或缺解锁能力都可能返回 blocked_state。',
      blocked_action: '原检查器的动作能力或物体可抓取声明未通过，例如没有 grasp 或物体被标记为不可抓。',
      rule_feasible: '原检查器的声明图、二维几何、锁钥匙和抓取规则通过。它没有返回动作序列，也没有执行解锁、开门、移动或拿杯。'
    };
    return messages[record.status];
  }
  const api = {validateData: validateData, selectRecord: selectRecord, planningFrame: planningFrame, describeFacts: describeFacts, planningInterpretation: planningInterpretation, minilabInterpretation: minilabInterpretation};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const root = document.getElementById('day3-records');
  if (!root || root.dataset.recordsReady === 'true') return;
  root.dataset.recordsReady = 'true';
  function q(selector) { return root.querySelector(selector); }
  function text(selector, value) { q(selector).textContent = value; }
  function element(tag, className, value) { const result = document.createElement(tag); if (className) result.className = className; if (value !== undefined) result.textContent = value; return result; }
  function showError(error) {
    q('.d3p-record-content').hidden = true;
    const panel = q('.d3p-record-error'); panel.hidden = false;
    panel.textContent = '本次记录暂时无法显示：' + error.message + ' 请通过正文“实际输出 JSON”链接查看原始数据。';
  }
  let data;
  try {
    const source = document.getElementById('day3-run-data');
    if (!source) throw new Error('页面缺少内嵌的运行记录。');
    data = validateData(JSON.parse(source.textContent));
  } catch (error) { showError(error); return; }
  const state = {kind: 'planning', ids: {planning: data.planning_cases[0].id, minilab: data.minilab_cases[0].id}, revealed: false, step: 0};
  const predictions = Object.create(null);
  const selector = q('#d3p-record-case'), prediction = q('#d3p-record-prediction'), reveal = q('#d3p-record-reveal');
  function selected() { return selectRecord(data, state.kind, state.ids[state.kind]); }
  function predictionKey() { return state.kind + ':' + state.ids[state.kind]; }
  function ms(value) { return Number(value).toFixed(3) + ' ms'; }
  function factsInto(selectorText, facts, empty) {
    const host = q(selectorText); host.replaceChildren();
    if (!facts.length) { host.appendChild(element('span', 'd3p-fact-empty', empty || '无')); return; }
    facts.forEach(function (item) { host.appendChild(element('code', '', item)); });
  }
  function closeOutputDetails() { q('#d3p-record-output').querySelectorAll('details').forEach(function (item) { item.open = false; }); }
  function frameLabel(record, frame) {
    if (record.status === 'no_plan') return '已知初态；没有返回后续计划状态';
    if (record.plan_length === 0) return '初态即满足目标 · 0 个动作';
    if (frame.step === 0) return '初态 · 尚未应用第 1 个动作';
    return '状态 ' + frame.step + '/' + frame.total + ' · 应用 ' + frame.action.raw + ' 之后';
  }
  function drawWorld(record, frame) {
    const svg = q('#d3p-record-world'), description = describeFacts(frame.facts);
    Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); });
    const width = Math.max(245, svg.getBoundingClientRect().width || 520), height = 285;
    const mid = width / 2, left = 18, right = width - 18, aX = (left + mid) / 2, bX = (right + mid) / 2, robotX = description.room === 'A' ? aX : bX;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    function shape(tag, attrs, label) {
      const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(function (entry) { item.setAttribute(entry[0], String(entry[1])); });
      if (label !== undefined) item.textContent = label;
      svg.appendChild(item);
    }
    shape('rect', {x: left, y: 45, width: mid - left, height: 180, fill: 'var(--viz-series-1)', 'fill-opacity': 0.08});
    shape('rect', {x: mid, y: 45, width: right - mid, height: 180, fill: 'var(--viz-series-3)', 'fill-opacity': 0.08});
    shape('rect', {x: left, y: 45, width: right - left, height: 180, fill: 'none', stroke: 'var(--border)', 'stroke-width': 2, rx: 5});
    shape('path', {d: 'M ' + mid + ' 45 V 124 M ' + mid + ' 178 V 225', stroke: 'var(--foreground)', 'stroke-width': 3, fill: 'none'});
    shape('text', {x: mid, y: 27, 'text-anchor': 'middle', 'font-size': 12, class: description.locked ? 'd3r-svg-error' : ''}, '门 D · ' + description.door);
    shape('text', {x: aX, y: 69, 'text-anchor': 'middle', 'font-size': 13, class: 'd3r-svg-muted'}, '房间 A');
    shape('text', {x: bX, y: 69, 'text-anchor': 'middle', 'font-size': 13, class: 'd3r-svg-muted'}, '房间 B');
    if (description.opened) shape('line', {x1: mid, y1: 178, x2: mid + Math.min(36, (right - mid) / 3), y2: 178, stroke: 'var(--viz-series-1)', 'stroke-width': 4});
    else shape('line', {x1: mid, y1: 124, x2: mid, y2: 178, stroke: description.locked ? 'var(--destructive)' : 'var(--viz-series-2)', 'stroke-width': 5});
    shape('circle', {cx: robotX, cy: 106, r: 15, fill: 'var(--viz-series-1)'});
    shape('rect', {x: robotX - 8, y: 98, width: 16, height: 10, rx: 3, fill: 'var(--page)'});
    shape('circle', {cx: robotX - 4, cy: 103, r: 1.5, fill: 'var(--viz-series-1)'});
    shape('circle', {cx: robotX + 4, cy: 103, r: 1.5, fill: 'var(--viz-series-1)'});
    shape('text', {x: robotX, y: 137, 'text-anchor': 'middle', class: 'd3r-svg-label'}, '机器人 R');
    const cupX = description.held ? robotX + 21 : description.cup === 'A' ? aX : bX, cupY = description.held ? 107 : 176;
    shape('path', {d: 'M ' + (cupX - 7) + ' ' + (cupY - 8) + ' h 14 l -2 16 h -10 Z', stroke: 'var(--viz-series-3)', 'stroke-width': 1.8, fill: 'var(--viz-series-3)', 'fill-opacity': 0.25});
    shape('path', {d: 'M ' + (cupX + 6) + ' ' + (cupY - 5) + ' h 4 q 6 5 0 9 h -5', stroke: 'var(--viz-series-3)', 'stroke-width': 1.8, fill: 'none'});
    shape('text', {x: description.held ? robotX : cupX, y: description.held ? 160 : 205, 'text-anchor': 'middle', 'font-size': 12}, description.held ? '杯子在手中' : '杯子 C');
    shape('text', {x: left, y: 247, 'font-size': 11, class: 'd3r-svg-muted'}, description.key ? '物品栏：有钥匙 K' : '物品栏：没有钥匙');
    shape('text', {x: left, y: 270, 'font-size': 11, class: 'd3r-svg-muted'}, '符号快照 · 无连续运动或物理执行');
    const note = record.status === 'no_plan'
      ? '图中仅有输入中已知的初态；搜索没有返回计划，不能补画一个成功的房间位置。'
      : record.plan_length === 0
        ? '输入状态本来就满足 holding(r,cup)。没有动作，也没有由本次程序执行产生的新世界状态。'
        : '图取自本次 states[' + frame.step + '] 的完整事实记录。它表示按符号动作推演到的状态，不是机器人真实执行照片或轨迹。';
    text('#d3p-record-world-note', note);
    text('#d3p-record-world-title', frameLabel(record, frame));
    text('#d3p-record-world-desc', '机器人在 ' + description.room + '；门' + description.door + '；杯子在' + description.cup + '。' + note);
  }
  function renderPlanning(record, focusStep) {
    const frame = planningFrame(record, state.step), ribbon = q('#d3p-record-plan');
    ribbon.replaceChildren();
    if (record.status === 'no_plan') ribbon.appendChild(element('p', '', '没有返回动作序列；plan_length = null。'));
    else if (record.plan_length === 0) ribbon.appendChild(element('p', '', '空动作序列 []；plan_length = 0。'));
    else {
      const steps = [{label: '初态', raw: null, step: 0}].concat(record.plan.map(function (action, index) { return {label: String(index + 1) + ' · ' + action.name, raw: action.raw, step: index + 1}; }));
      steps.forEach(function (entry) {
        const button = element('button', 'btn'); button.type = 'button'; button.dataset.d3pStep = String(entry.step);
        button.setAttribute('aria-pressed', String(entry.step === state.step)); button.appendChild(element('span', '', entry.label));
        if (entry.raw) button.appendChild(element('code', '', entry.raw));
        button.addEventListener('click', function () { state.step = entry.step; render(true, entry.step); }); ribbon.appendChild(button);
      });
    }
    text('#d3p-record-step', frameLabel(record, frame));
    q('#d3p-record-prev').disabled = state.step === 0;
    q('#d3p-record-next').disabled = state.step === record.states.length - 1;
    factsInto('#d3p-record-added', frame.added, state.step === 0 ? '这是初态，没有应用动作。' : '本步没有新增真事实。');
    factsInto('#d3p-record-removed', frame.removed, state.step === 0 ? '这是初态，没有删除事实。' : '本步没有删除真事实。');
    factsInto('#d3p-record-facts', frame.facts);
    drawWorld(record, frame);
    if (focusStep !== undefined) {
      const button = q('[data-d3p-step="' + focusStep + '"]'); if (button) button.focus({preventScroll: true});
    }
  }
  function geometryText(record) {
    const check = record.geometry_check, input = check.input;
    const requirement = '输入：门宽 ' + input.door_width_m.toFixed(2) + ' m，机器人宽 ' + input.robot_width_m.toFixed(2) + ' m，额外总余量 ' + input.extra_margin_m.toFixed(2) + ' m。';
    return (check.checked ? check.passes ? '本次门宽数值条件通过。' : '本次门宽数值条件拒绝候选。' : '本次未进行该门宽检查。') + requirement + ' ' + check.reason + ' ' + check.scope;
  }
  function environmentText() {
    const environment = data.environment;
    return '制作环境：Python ' + environment.python + '；PDDL 搜索使用 pyperplan ' + environment.pyperplan + '；' + environment.platform + '。记录生成时间（UTC）：' + environment.generated_at_utc + '。耗时是这一次调用的记录，不作为跨机器性能结论。';
  }
  function render(announce, focusStep) {
    try {
      const record = selected(), isPlanning = state.kind === 'planning';
      root.querySelectorAll('[data-d3p-record-kind]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d3pRecordKind === state.kind)); });
      selector.replaceChildren();
      caseList(data, state.kind).forEach(function (item, index) { const option = element('option', '', String(index + 1) + ' · ' + item.title); option.value = item.id; selector.appendChild(option); });
      selector.value = record.id;
      text('#d3p-record-title', record.title);
      const changes = q('#d3p-record-changes'); changes.replaceChildren();
      record.changes.forEach(function (change) { changes.appendChild(element('li', '', change)); });
      if (isPlanning) {
        const description = describeFacts(record.initial_facts);
        text('#d3p-record-input-scope', '本次输入：R 在 ' + description.room + '，门' + description.door + '，杯子在' + description.cup + '，' + (description.key ? '物品栏有钥匙。' : '物品栏没有钥匙。') + ' 目标：' + record.goal.join(' 与 ') + '。完整能力与关系见下方初态。');
        text('#d3p-record-input', JSON.stringify({problem_file: record.problem_file, initial_facts: record.initial_facts, goal: record.goal, separate_geometry_input: record.geometry_check.input}, null, 2));
      } else {
        const input = record.input;
        text('#d3p-record-input-scope', '本次输入：机器人起点 ' + input.robot.start + '，宽度 ' + input.robot.width_m + ' m；能力 [' + input.robot.capabilities.join(', ') + ']；钥匙 [' + input.robot.keys.join(', ') + ']。原检查器只做受限规则判断，没有计划搜索或状态推进。');
        text('#d3p-record-input', JSON.stringify(input, null, 2));
      }
      const saved = predictions[predictionKey()] || '';
      if (prediction.value !== saved) prediction.value = saved;
      q('#d3p-record-output').hidden = !state.revealed;
      reveal.setAttribute('aria-expanded', String(state.revealed)); reveal.textContent = state.revealed ? '收起这次真实记录' : '展开这次真实记录';
      if (state.revealed) {
        text('#d3p-record-status', record.status); q('#d3p-record-status').dataset.status = record.status;
        text('#d3p-record-time', (isPlanning ? 'BFS 搜索：' : 'analyze 检查：') + ms(record.elapsed_ms) + (isPlanning && Number.isFinite(record.parse_ground_ms) ? '；解析与参数实例化：' + ms(record.parse_ground_ms) : ''));
        text('#d3p-record-interpretation', isPlanning ? planningInterpretation(record) : minilabInterpretation(record));
        q('#d3p-record-planning').hidden = !isPlanning;
        q('#d3p-record-reason').hidden = isPlanning;
        if (isPlanning) {
          renderPlanning(record, focusStep);
          text('#d3p-record-geometry', geometryText(record));
          text('#d3p-record-execution', '执行状态原文：' + record.execution_status + '。没有运行物理机器人或仿真动作。符号状态轨迹与这项执行证据分开记录。');
        } else {
          text('#d3p-record-reason', '原始 reason：' + record.reason);
          const raw = record.raw_result;
          text('#d3p-record-geometry', '原始基础房间／共墙检查 geometry_valid = ' + raw.geometry_valid + '；声明拓扑 topology_connected = ' + raw.topology_connected + '；受限任务规则 rule_task_feasible = ' + raw.rule_task_feasible + '。其中基础 geometry_valid 不等于所有通行条件均满足。');
          text('#d3p-record-execution', '输入未修改：' + (record.input_unchanged ? '是（input_unchanged = true）' : '否（input_unchanged = false）') + '。执行状态：' + record.execution_status + '；没有动作序列或物理执行。' + (record.notes ? ' ' + record.notes.join(' ') : ''));
        }
        text('#d3p-record-json', JSON.stringify(record, null, 2));
      }
      text('#d3p-record-environment', environmentText());
      if (announce) text('#d3p-record-live', record.title + '。' + (state.revealed ? '已展开实际记录：' + record.status + '。' + (isPlanning ? frameLabel(record, planningFrame(record, state.step)) : '原始原因：' + record.reason) : '输出已折叠，可以先写预测。'));
    } catch (error) { showError(error); }
  }
  root.querySelectorAll('[data-d3p-record-kind]').forEach(function (button) {
    button.addEventListener('click', function () { state.kind = button.dataset.d3pRecordKind; state.revealed = false; state.step = 0; closeOutputDetails(); render(true); });
  });
  selector.addEventListener('change', function () { state.ids[state.kind] = selector.value; state.revealed = false; state.step = 0; closeOutputDetails(); render(true); });
  prediction.addEventListener('input', function () { predictions[predictionKey()] = prediction.value; });
  reveal.addEventListener('click', function () { state.revealed = !state.revealed; render(true); });
  q('#d3p-record-prev').addEventListener('click', function () { if (state.step > 0) { state.step -= 1; render(true); } });
  q('#d3p-record-next').addEventListener('click', function () { if (state.step + 1 < selected().states.length) { state.step += 1; render(true); } });
  render(false);
  function resize() {
    if (state.kind !== 'planning' || !state.revealed || q('.d3p-record-content').hidden) return;
    try { const record = selected(); drawWorld(record, planningFrame(record, state.step)); } catch (error) { showError(error); }
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(q('#d3p-record-world'));
  else window.addEventListener('resize', resize);
})();
