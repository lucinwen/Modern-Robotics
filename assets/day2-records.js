(function () {
  'use strict';
  const CASE_IDS = ['S1', 'S2', 'S3', 'U1', 'U2', 'U3'];
  function requireRecord(data, id) {
    const record = data && Array.isArray(data.cases) && data.cases.find(function (item) { return item.id === id; });
    if (!record) throw new Error('缺少案例 ' + id + ' 的运行记录。');
    return record;
  }
  function validateData(data) {
    if (!data || data.schema_version !== 1 || !data.environment || !data.provenance || !Array.isArray(data.cases)) throw new Error('运行数据格式不受当前页面支持。');
    CASE_IDS.forEach(function (id) {
      const record = requireRecord(data, id);
      if (!['sat', 'unsat', 'unknown'].includes(record.status) || !Array.isArray(record.constraints) || !Array.isArray(record.variables) || !record.input || !Number.isFinite(record.elapsed_ms) || record.elapsed_ms < 0) throw new Error('案例 ' + id + ' 的字段不完整。');
      if (record.constraints.some(function (item) { return typeof item.formula !== 'string'; })) throw new Error('案例 ' + id + ' 的公式字段不完整。');
      if (record.status === 'sat' && (!record.model || typeof record.model !== 'object')) throw new Error('案例 ' + id + ' 标为 sat，但没有可显示的模型。');
      if (record.view_geometry) {
        const view = record.view_geometry;
        if (!view.container || !Number.isFinite(view.container.width) || view.container.width <= 0 || !Number.isFinite(view.container.height) || view.container.height <= 0 || !Array.isArray(view.rooms)) throw new Error('案例 ' + id + ' 的几何记录不完整。');
        if (record.status !== 'sat' && view.rooms.length !== 0) throw new Error('非 SAT 记录意外包含房间模型坐标。');
        if (record.status === 'sat' && view.rooms.length !== view.required_room_count) throw new Error('SAT 模型中的房间坐标数量不完整。');
        view.rooms.forEach(function (room) { if (!['x', 'y', 'width', 'height'].every(function (key) { return Number.isFinite(room[key]); }) || room.width <= 0 || room.height <= 0) throw new Error('案例 ' + id + ' 包含无效图形坐标。'); });
      } else if (!record.view_interval || !Number.isFinite(record.view_interval.lower) || !Number.isFinite(record.view_interval.upper)) throw new Error('案例 ' + id + ' 没有对应的输入图形。');
    });
    return data;
  }
  function stage(name, state, status, description) { return {name: name, state: state, status: status, description: description}; }
  function selectPipeline(data, mode) {
    const layout = requireRecord(data, 'S1');
    if (mode === 'layout') {
      if (layout.status !== 'sat' || !layout.independent_geometry_check) throw new Error('布局 SAT 记录或几何复核字段缺失。');
      const check = layout.independent_geometry_check;
      return {mode: mode, state: 'sat', solver: layout, raw: layout, stages: [
        stage('输入', 'complete', '已明确', '2 间 2×2 房间；4×3 外框；整数米坐标。'),
        stage('已编码要求', 'complete', '仅布局', '完整在框内、两房内部不重叠。'),
        stage('求解', 'sat', layout.status, '找到一组满足上述断言的模型。'),
        stage('独立检查', check.inside && check.no_internal_overlap ? 'complete' : 'rejected', check.inside && check.no_internal_overlap ? '这两项通过' : '几何拒绝', '边界：' + (check.inside ? '通过' : '失败') + '；内部非重叠：' + (check.no_internal_overlap ? '通过' : '失败') + '。'),
        stage('执行', 'pending', '未验证', '没有运动路径或机器人物理执行记录。')
      ], insight: '这条记录证明了已编码布局公式有模型，并独立复核了边界与非重叠。门通行、动作状态和物理执行没有因此自动得到验证。'};
    }
    if (mode === 'unsat') {
      const record = requireRecord(data, 'U1');
      if (record.status !== 'unsat') throw new Error('打包 UNSAT 记录与当前数据不匹配。');
      return {mode: mode, state: 'unsat', solver: record, raw: record, stages: [
        stage('输入', 'complete', '已明确', '2 间 2×2 房间；3×3 外框；整数米坐标。'),
        stage('已编码要求', 'complete', '仅布局', '完整在框内、两房内部不重叠。'),
        stage('求解', 'unsat', record.status, '这些断言不能被同时满足。'),
        stage('独立检查', 'skipped', '未进行', '没有满足模型可交给几何检查。'),
        stage('执行', 'skipped', '未进行', '没有可执行候选。')
      ], insight: 'UNSAT 针对当前输入、变量类型与全部断言。它不指定应当修改哪项真实需求，也不是机器人已经试走失败的记录。'};
    }
    if (mode === 'unknown') {
      const record = data.extra && data.extra.unknown;
      if (!record || record.status !== 'unknown' || !Number.isFinite(record.elapsed_ms) || !Array.isArray(record.constraints)) throw new Error('UNKNOWN 实际运行字段缺失或不匹配。');
      return {mode: mode, state: 'unknown', solver: record, raw: record, stages: [
        stage('输入', 'complete', '已明确', '一个数学实数变量 x。'),
        stage('已编码要求', 'complete', '非多项式式子', record.constraints.map(function (item) { return item.formula; }).join('；')),
        stage('求解', 'unknown', record.status, '本次没有作出 sat 或 unsat 判定。'),
        stage('独立检查', 'skipped', '未进行', '本次没有提供已验证的满足模型。'),
        stage('执行', 'skipped', '未进行', '没有据此进入执行阶段。')
      ], insight: '原始 reason_unknown = ' + JSON.stringify(record.reason_unknown) + '。这是记录原文；设置了时间上限并不说明本次触发超时，也不能把 unknown 改写成无解。'};
    }
    if (mode === 'postcheck') {
      const record = data.extra && data.extra.postcheck;
      if (!record || record.solver_status !== 'sat' || record.solver_case_id !== layout.id || !record.independent_check) throw new Error('SAT 后门宽检查的关联记录缺失。');
      const check = record.independent_check;
      if (![check.door_width_m, check.robot_width_m].every(Number.isFinite) || typeof check.passes !== 'boolean') throw new Error('门宽检查的数值或结论缺失。');
      return {mode: mode, state: check.passes ? 'sat' : 'rejected', solver: layout, raw: {layout_run: layout, postcheck: record}, stages: [
        stage('输入', 'complete', '布局加任务尺寸', '门宽 ' + check.door_width_m.toFixed(2) + ' m；机器人宽 ' + check.robot_width_m.toFixed(2) + ' m。'),
        stage('已编码要求', 'complete', '仍然仅布局', '门宽、机器人宽度与路径没有加入这次布局断言。'),
        stage('求解', 'sat', record.solver_status, '复用 S1 的满足模型。'),
        stage('独立检查', check.passes ? 'complete' : 'rejected', check.passes ? '宽度检查通过' : '门宽检查拒绝', check.door_width_m.toFixed(2) + (check.passes ? ' ≥ ' : ' < ') + check.robot_width_m.toFixed(2) + ' m；本例额外余量为 ' + check.extra_margin_m + '。'),
        stage('执行', 'skipped', '未进行', '没有路径或物理执行验证。')
      ], insight: record.conclusion + ' 求解器的 sat 保持其原含义：它满足的是实际交给它的布局断言。'};
    }
    throw new Error('没有这个流程记录。');
  }
  function environmentText(environment) {
    return 'Z3 ' + environment.z3 + ' · Python ' + environment.python + ' · ' + environment.platform + '；生成时间（UTC）：' + environment.generated_at_utc;
  }
  if (typeof module === 'object' && module.exports) module.exports = {validateData: validateData, requireRecord: requireRecord, selectPipeline: selectPipeline};
  if (typeof document === 'undefined') return;
  const pipelineRoot = document.getElementById('day2-pipeline'), resultsRoot = document.getElementById('day2-results');
  if (!pipelineRoot && !resultsRoot) return;
  function showError(root, error) {
    if (!root) return;
    const content = root.querySelector('.d2r-content'), panel = root.querySelector('.d2r-error');
    if (content) content.hidden = true;
    if (panel) { panel.hidden = false; panel.textContent = '这一区域暂时不能显示运行记录：' + error.message + ' 请从教程中的“完整运行数据 JSON”链接查看原始文件。'; }
  }
  let data;
  try {
    const source = document.getElementById('day2-run-data');
    if (!source) throw new Error('页面没有内嵌运行数据。');
    data = validateData(JSON.parse(source.textContent));
  } catch (error) { showError(pipelineRoot, error); showError(resultsRoot, error); return; }
  function setText(root, selector, text) { root.querySelector(selector).textContent = text; }
  function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
  }
  function runOnce(root) { if (!root || root.dataset.d2rReady === 'true') return false; root.dataset.d2rReady = 'true'; return true; }
  function ms(value) { return Number(value).toFixed(3) + ' ms'; }

  if (runOnce(pipelineRoot)) {
    const root = pipelineRoot;
    let mode = 'layout';
    function render(announce) {
      try {
        const selected = selectPipeline(data, mode), list = root.querySelector('#d2r-pipeline-stages');
        list.replaceChildren();
        selected.stages.forEach(function (entry, index) {
          const item = element('li'); item.dataset.state = entry.state;
          item.append(element('span', 'd2r-stage-number', String(index + 1).padStart(2, '0')), element('h4', '', entry.name), element('strong', 'd2r-stage-status', entry.status), element('p', '', entry.description));
          list.appendChild(item);
        });
        root.querySelectorAll('[data-d2r-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2rMode === mode)); });
        setText(root, '#d2r-pipeline-insight', selected.insight); root.querySelector('#d2r-pipeline-insight').dataset.state = selected.state;
        let measure = '本次 check() 耗时：' + ms(selected.solver.elapsed_ms) + '。';
        if (mode === 'unknown') measure += ' 设置的时间上限：' + selected.solver.timeout_ms + ' ms；原始原因：' + JSON.stringify(selected.solver.reason_unknown) + '。';
        if (mode === 'postcheck') measure += ' 耗时来自关联的 S1 布局求解；门宽比较由独立检查器完成。';
        measure += ' 单次记录不是性能基准。';
        setText(root, '#d2r-pipeline-measurement', measure);
        setText(root, '#d2r-pipeline-json', JSON.stringify(selected.raw, null, 2));
        setText(root, '#d2r-pipeline-environment', environmentText(data.environment));
        if (announce) setText(root, '#d2r-pipeline-live', selected.stages.map(function (entry) { return entry.name + '：' + entry.status; }).join('。') + '。' + selected.insight);
      } catch (error) { showError(root, error); }
    }
    root.querySelectorAll('[data-d2r-mode]').forEach(function (button) { button.addEventListener('click', function () { mode = button.dataset.d2rMode; root.querySelector('.d2r-raw').open = false; render(true); }); });
    render(false);
  }

  if (runOnce(resultsRoot)) {
    const root = resultsRoot;
    const state = {id: 'S1', revealed: false};
    const predictions = {};
    CASE_IDS.forEach(function (id) { predictions[id] = {choice: 'unsure', reason: ''}; });
    const caseLabels = ['例 1 · 4×3', '例 2 · 5×5', '例 3 · 单房 2×2', '例 4 · 3×3', '例 5 · 1×3', '例 6 · 门宽上下界'];
    const choices = {unsure: '还不确定', sat: 'sat', unsat: 'unsat', unknown: 'unknown'};
    const selector = root.querySelector('#d2r-prediction-choice'), reason = root.querySelector('#d2r-prediction-reason'), revealButton = root.querySelector('#d2r-reveal');
    const svg = root.querySelector('.d2r-case-scene');
    function fact(list, name, value) { const entry = element('div'); entry.append(element('dt', '', name), element('dd', '', value)); list.appendChild(entry); }
    function svgElement(tag, attrs, text) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs || {}).forEach(function (entry) { node.setAttribute(entry[0], String(entry[1])); });
      if (text !== undefined) node.textContent = text; svg.appendChild(node); return node;
    }
    function draw(record) {
      Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); });
      const width = Math.max(230, svg.getBoundingClientRect().width || 320), height = svg.getBoundingClientRect().height || 290;
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      if (record.view_interval) {
        const lower = record.view_interval.lower, upper = record.view_interval.upper, max = Math.max(lower, upper, 1) + 0.1;
        function at(value) { return 34 + value / max * (width - 68); }
        const lowerY = 84, upperY = 148, axisY = 199;
        svgElement('text', {x: 15, y: 47}, '下界要求：d ≥ ' + lower.toFixed(2) + ' m');
        svgElement('line', {x1: at(lower), y1: lowerY, x2: at(max), y2: lowerY, stroke: 'var(--viz-series-1)', 'stroke-width': 7});
        svgElement('circle', {cx: at(lower), cy: lowerY, r: 5, fill: 'var(--viz-series-1)'});
        svgElement('path', {d: 'M ' + (at(max) - 7) + ' ' + (lowerY - 6) + ' L ' + (at(max) + 2) + ' ' + lowerY + ' L ' + (at(max) - 7) + ' ' + (lowerY + 6), fill: 'var(--viz-series-1)'});
        svgElement('text', {x: 15, y: 120}, '上界要求：d ≤ ' + upper.toFixed(2) + ' m');
        svgElement('line', {x1: at(0), y1: upperY, x2: at(upper), y2: upperY, stroke: 'var(--viz-series-3)', 'stroke-width': 7});
        svgElement('circle', {cx: at(upper), cy: upperY, r: 5, fill: 'var(--viz-series-3)'});
        svgElement('path', {d: 'M ' + (at(0) + 7) + ' ' + (upperY - 6) + ' L ' + (at(0) - 2) + ' ' + upperY + ' L ' + (at(0) + 7) + ' ' + (upperY + 6), fill: 'var(--viz-series-3)'});
        svgElement('line', {x1: at(0), y1: axisY, x2: at(max), y2: axisY, stroke: 'var(--muted-foreground)', 'stroke-width': 1});
        [0, upper, lower, 1].filter(function (v, i, arr) { return arr.indexOf(v) === i; }).forEach(function (v) {
          svgElement('line', {x1: at(v), y1: axisY - 5, x2: at(v), y2: axisY + 5, stroke: 'var(--muted-foreground)'});
          svgElement('text', {x: at(v), y: axisY + 23, 'text-anchor': 'middle'}, v.toFixed(1));
        });
        svgElement('text', {x: width / 2, y: height - 22, 'text-anchor': 'middle', class: 'd2r-scene-message'}, state.revealed ? '本次实际返回：' + record.status : '两条要求有没有共同取值？');
        setText(root, '#d2r-figure-note', '两个色条分别表示一条允许半直线；门宽单位为米。这张数轴表示输入的两条门宽条件。');
        setText(root, '#d2r-case-svg-description', '门宽 d 为实数，下界 ' + lower + ' 米，上界 ' + upper + ' 米。' + (state.revealed ? '实际返回 ' + record.status + '，本次没有满足模型。' : '真实运行状态目前折叠。'));
        return;
      }
      const view = record.view_geometry, W = view.container.width, H = view.container.height;
      const scale = Math.min((width - 74) / W, (height - 105) / H);
      const x0 = (width - W * scale) / 2, y0 = 40 + (height - 105 - H * scale) / 2;
      svgElement('text', {x: width / 2, y: 20, 'text-anchor': 'middle'}, '要求：' + view.required_room_count + ' 间 ' + view.required_room_size.width + '×' + view.required_room_size.height + ' m 房间');
      for (let x = 1; x < W; x += 1) svgElement('line', {x1: x0 + x * scale, y1: y0, x2: x0 + x * scale, y2: y0 + H * scale, stroke: 'var(--border)'});
      for (let y = 1; y < H; y += 1) svgElement('line', {x1: x0, y1: y0 + y * scale, x2: x0 + W * scale, y2: y0 + y * scale, stroke: 'var(--border)'});
      svgElement('rect', {x: x0, y: y0, width: W * scale, height: H * scale, fill: 'none', stroke: 'var(--foreground)', 'stroke-width': 2});
      if (state.revealed && record.status === 'sat') {
        view.rooms.forEach(function (room, i) {
          const color = i % 2 ? 'var(--viz-series-3)' : 'var(--viz-series-1)';
          svgElement('rect', {x: x0 + room.x * scale, y: y0 + (H - room.y - room.height) * scale, width: room.width * scale, height: room.height * scale, fill: color, 'fill-opacity': 0.18, stroke: color, 'stroke-width': 2});
          svgElement('text', {x: x0 + (room.x + room.width / 2) * scale, y: y0 + (H - room.y - room.height / 2) * scale + 6, 'text-anchor': 'middle', class: 'd2r-room-letter'}, room.label);
        });
      } else {
        svgElement('text', {x: width / 2, y: y0 + H * scale / 2 - 3, 'text-anchor': 'middle', class: 'd2r-scene-message'}, state.revealed ? '本次没有满足模型' : '尚未展开输出');
      }
      svgElement('text', {x: width / 2, y: y0 + H * scale + 24, 'text-anchor': 'middle'}, 'W = ' + W + ' m');
      svgElement('text', {x: width - 10, y: 36, 'text-anchor': 'end'}, 'H = ' + H + ' m');
      svgElement('text', {x: 11, y: height - 13}, '左下角原点 · x 向右、y 向上');
      const shown = state.revealed && record.status === 'sat';
      setText(root, '#d2r-figure-note', shown ? '房间坐标取自这次实际模型的几何记录；图中是一种满足断言的摆法。' : state.revealed ? '本次为 UNSAT；外框是已知输入，求解没有返回房间模型坐标。' : '展开前显示已知外框与房间要求，实际模型坐标保持折叠。');
      setText(root, '#d2r-case-svg-description', '外框宽 ' + W + ' 米，高 ' + H + ' 米，需要 ' + view.required_room_count + ' 间 ' + view.required_room_size.width + ' 乘 ' + view.required_room_size.height + ' 米的房间。' + (shown ? view.rooms.map(function (r) { return r.label + ' 左下角（' + r.x + '，' + r.y + '）米'; }).join('；') : state.revealed ? '实际返回 ' + record.status + '，没有满足模型。' : '真实运行状态目前折叠。'));
    }
    function renderModel(record) {
      const host = root.querySelector('#d2r-model-content'); host.replaceChildren();
      if (record.status !== 'sat' || record.model === null) { host.appendChild(element('p', '', '本次没有满足模型，因此没有可列出的变量赋值。')); return; }
      const table = element('table', 'd2r-model-table'), body = element('tbody');
      table.setAttribute('aria-label', '本次模型的变量赋值');
      Object.entries(record.model).forEach(function (entry) { const row = element('tr'); row.append(element('td', '', entry[0]), element('td', '', String(entry[1]))); body.appendChild(row); });
      table.appendChild(body); host.appendChild(table);
    }
    function renderCore(record) {
      const host = root.querySelector('#d2r-core-content'); host.replaceChildren();
      if (record.status !== 'unsat') { host.appendChild(element('p', '', '不适用：本次没有返回 unsat。')); return; }
      const tags = element('div', 'd2r-core-tags');
      (record.unsat_core || []).forEach(function (label) { tags.appendChild(element('code', '', label)); });
      if (tags.children.length) host.appendChild(tags); else host.appendChild(element('p', '', '本次返回空核心；需结合背景断言解释。'));
      host.appendChild(element('p', '', '这些是本次的跟踪标签。请结合上方标签到公式的映射理解，不能直接当成唯一修复方案。'));
    }
    function render(announce) {
      try {
        const record = requireRecord(data, state.id), prediction = predictions[state.id];
        root.querySelectorAll('[data-d2r-case]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2rCase === state.id)); });
        setText(root, '#d2r-case-title', '例 ' + (CASE_IDS.indexOf(state.id) + 1) + ' · ' + record.title);
        const facts = root.querySelector('#d2r-input-facts'); facts.replaceChildren();
        if (record.view_geometry) {
          fact(facts, '外框', record.input.width + ' × ' + record.input.height + ' m');
          fact(facts, '房间', record.input.room_count + ' 间，每间 ' + record.input.room_width + ' × ' + record.input.room_height + ' m');
          fact(facts, '位置类型', record.input.coordinate_sort + '（此例使用整数米坐标）');
          fact(facts, '条件', '轴对齐、不可旋转；' + (record.input.boundary_touch_allowed ? '允许接边' : '不允许接边'));
        } else {
          fact(facts, '下界要求', '门宽 d ≥ ' + record.input.minimum_width + ' m');
          fact(facts, '上界要求', '门宽 d ≤ ' + record.input.maximum_width + ' m');
          fact(facts, '变量类型', 'Real（连续实数门宽）');
          fact(facts, '检查范围', '仅一维门宽上下界');
        }
        setText(root, '#d2r-case-variables', record.variables.map(function (v) { return v.name + ' : ' + v.sort; }).join('；'));
        const formulas = root.querySelector('#d2r-case-constraints'); formulas.replaceChildren();
        record.constraints.forEach(function (constraint, i) { const li = element('li'); li.append(element('span', 'd2r-constraint-label', constraint.label || '未跟踪断言 ' + (i + 1)), element('code', '', constraint.formula)); formulas.appendChild(li); });
        selector.value = prediction.choice;
        if (reason.value !== prediction.reason) reason.value = prediction.reason;
        const panel = root.querySelector('#d2r-result-panel'); panel.hidden = !state.revealed; panel.dataset.status = record.status;
        revealButton.setAttribute('aria-expanded', String(state.revealed)); revealButton.textContent = state.revealed ? '收起真实运行记录' : '展开真实运行记录';
        if (state.revealed) {
          setText(root, '#d2r-actual-status', record.status.toUpperCase());
          setText(root, '#d2r-actual-time', '本次 check()：' + ms(record.elapsed_ms));
          setText(root, '#d2r-prediction-comparison', prediction.choice === 'unsure' ? '你暂未给出确定预测。可以先找出决定结果的条件，再回看自己的解释。' : '你的预测：' + choices[prediction.choice] + '；本次实际：' + record.status + '。请继续核对推理是否覆盖全部条件。');
          renderModel(record); renderCore(record);
          setText(root, '#d2r-result-scope', '本例范围：' + record.scope);
          const check = record.independent_geometry_check;
          setText(root, '#d2r-check-note', check ? '独立几何复核：边界 ' + (check.inside ? '通过' : '失败') + '；内部非重叠 ' + (check.no_internal_overlap ? '通过' : '失败') + '。没有机器人物理执行验证。' : record.returned_core_rechecked_unsat ? '已把本次返回核心对应的公式重新检查为 unsat；这不把该核心变成唯一修复方案。' : '没有额外几何或执行验证记录。');
          setText(root, '#d2r-case-json', JSON.stringify(record, null, 2));
        }
        setText(root, '#d2r-results-environment', environmentText(data.environment));
        draw(record);
        if (announce) setText(root, '#d2r-results-live', record.title + '。' + (state.revealed ? '已展开本次实际结果：' + record.status + '。耗时 ' + ms(record.elapsed_ms) + '。' : '真实结果已折叠，可以先作预测。'));
      } catch (error) { showError(root, error); }
    }
    const buttonHost = root.querySelector('#d2r-case-buttons');
    CASE_IDS.forEach(function (id, i) { const button = element('button', 'btn', caseLabels[i]); button.type = 'button'; button.dataset.d2rCase = id; button.setAttribute('aria-pressed', String(id === state.id)); button.addEventListener('click', function () { state.id = id; state.revealed = false; root.querySelectorAll('.d2r-raw').forEach(function (item) { item.open = false; }); render(true); }); buttonHost.appendChild(button); });
    selector.addEventListener('change', function () { predictions[state.id].choice = selector.value; render(false); setText(root, '#d2r-results-live', '本例预测已改为：' + choices[selector.value] + '。'); });
    reason.addEventListener('input', function () { predictions[state.id].reason = reason.value; });
    revealButton.addEventListener('click', function () { state.revealed = !state.revealed; render(true); });
    render(false);
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { if (!root.querySelector('.d2r-content').hidden) draw(requireRecord(data, state.id)); }).observe(root.querySelector('.d2r-case-picture'));
    else window.addEventListener('resize', function () { if (!root.querySelector('.d2r-content').hidden) draw(requireRecord(data, state.id)); });
  }
})();
