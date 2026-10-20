(function () {
  'use strict';
  const PLAN = ['unlock · 解锁', 'open · 开门', 'move · 进入 B', 'pickup · 拿杯'];
  const PHASES = {ready: '准备下一动作', waiting: '等待执行反馈', blocked: '停止并复核', complete: '此计划已完成'};
  function initialExecutor() { return {phase: 'ready', cursor: 0, event: '初态：门锁着，准备执行已给定的四步计划。'}; }
  function transitionExecutor(previous, event) {
    if (event === 'reset') return initialExecutor();
    const next = Object.assign({}, previous);
    if (event === 'send' && previous.phase === 'ready') {
      next.phase = 'waiting'; next.event = '已发出 ' + PLAN[previous.cursor] + ' 请求；尚未收到成功确认。';
    } else if (event === 'success' && previous.phase === 'waiting') {
      next.cursor += 1; next.phase = next.cursor === PLAN.length ? 'complete' : 'ready';
      next.event = '本次示例收到 ' + PLAN[previous.cursor] + ' 成功反馈，才推进计划指针。';
    } else if (event === 'failure' && previous.phase === 'waiting') {
      next.phase = 'blocked'; next.event = '收到失败反馈；没有加入该动作的预期效果。实际世界是否部分变化，需要重新观测。';
    } else if (event === 'observe' && previous.phase === 'blocked') {
      next.phase = 'ready'; next.event = '教学输入：重新观测并确认仍是上一步的状态，因此可重新请求当前动作；真实系统需自行取得这份证据。';
    }
    return next;
  }
  function formatClock(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function checkpointStage(remaining) {
    const elapsed = Math.max(0, 35 * 60 * 1000 - Math.max(0, remaining));
    const stages = ['分层表示', '谓词与动作', '失败归因', '反馈与重新求解', '自评与待补问题'];
    return {index: Math.min(4, Math.floor(elapsed / (8 * 60 * 1000))), label: stages[Math.min(4, Math.floor(elapsed / (8 * 60 * 1000)))]};
  }
  if (typeof module === 'object' && module.exports) module.exports = {initialExecutor: initialExecutor, transitionExecutor: transitionExecutor, formatClock: formatClock, checkpointStage: checkpointStage};
  if (typeof document === 'undefined') return;
  function text(root, selector, value) { root.querySelector(selector).textContent = value; }
  function node(tag, attrs, value) {
    const result = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(function (entry) { result.setAttribute(entry[0], String(entry[1])); });
    if (value !== undefined) result.textContent = value; return result;
  }
  function svgText(svg, x, y, value, extra) { svg.appendChild(node('text', Object.assign({x: x, y: y, 'text-anchor': 'middle', fill: 'var(--foreground)', 'font-size': 12}, extra || {}), value)); }
  function resetSVG(svg, height) {
    Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); });
    const width = Math.max(280, svg.getBoundingClientRect().width || 600); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height); return width;
  }
  function watchWidth(svg, render) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(render).observe(svg);
    else window.addEventListener('resize', render);
  }
  function download(name, contents) {
    const url = URL.createObjectURL(new Blob([contents], {type: 'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  const layers = document.getElementById('day3-layers');
  if (layers) {
    const state = {layer: 'topology', caseId: 'standard'}, svg = layers.querySelector('#d3p-layer-scene');
    const info = {
      topology: {question: 'A 与 B 是否有声明的连接？', answer: '有。门 D 连接 A 与 B，图上的边成立。拿走钥匙或改变门宽，不会自动把这条“声明连接”删掉。', limit: '这层只描述连接关系；不判断门锁、门宽或操作能力。'},
      geometry: {question: '当前门的尺寸，是否满足这个身体的净宽要求？', answer: '', limit: '这里仅比较门净宽与 0.60 m 圆盘直径，余量取 0。真实接面、门扇、路径和其他碰撞另验。'},
      state: {question: '此刻机器人、门、钥匙和杯子是什么状态？', answer: '', limit: '当前没有把“未来可能解锁”当作“已经打开”。杯子也还没有在机器人手里。'},
      ability: {question: '机器人被声明具备哪些操作能力？', answer: '', limit: '声明具有能力，不等于这次具体姿态和轨迹已经验证通过。'}
    };
    function render(announce) {
      const W = resetSVG(svg, 310), middle = W / 2, left = W / 4 + 10, right = W * .75 - 10;
      const doorWidth = state.caseId === 'narrow' ? .5 : .9, hasKey = state.caseId !== 'missing-key', canOpen = state.caseId !== 'missing-open';
      const base = node('g', {opacity: state.layer === 'topology' ? .25 : 1}); svg.appendChild(base);
      base.appendChild(node('rect', {x: 18, y: 55, width: W - 36, height: 195, rx: 4, fill: 'var(--muted)', stroke: 'var(--border)', 'stroke-width': 2}));
      base.appendChild(node('line', {x1: middle, y1: 55, x2: middle, y2: 250, stroke: 'var(--foreground)', 'stroke-width': 3}));
      const gap = doorWidth * 50;
      base.appendChild(node('line', {x1: middle, y1: 151 - gap / 2, x2: middle, y2: 151 + gap / 2, stroke: 'var(--viz-series-2)', 'stroke-width': 7}));
      base.appendChild(node('circle', {cx: left, cy: 155, r: 15, fill: 'var(--viz-series-1)'}));
      base.appendChild(node('text', {x: left, y: 160, 'text-anchor': 'middle', fill: 'var(--primary-foreground)', 'font-size': 14}, 'R'));
      base.appendChild(node('path', {d: 'M ' + (right - 9) + ' 141 h 18 v 20 q -9 10 -18 0 z M ' + (right + 9) + ' 145 q 15 -1 12 11 q -2 5 -12 5', fill: 'var(--viz-series-3)', stroke: 'var(--viz-series-3)', 'stroke-width': 2}));
      svgText(svg, left, 39, 'A 房间'); svgText(svg, right, 39, 'B 房间');
      if (state.layer === 'topology') {
        svg.appendChild(node('line', {x1: left, y1: 150, x2: right, y2: 150, stroke: 'var(--viz-series-1)', 'stroke-width': 4}));
        [[left, 'A'], [middle, 'D'], [right, 'B']].forEach(function (entry) { svg.appendChild(node('circle', {cx: entry[0], cy: 150, r: 22, fill: 'var(--background)', stroke: 'var(--viz-series-1)', 'stroke-width': 3})); svgText(svg, entry[0], 156, entry[1], {'font-size': 16}); });
        svgText(svg, middle, 217, '连接关系 A—D—B 已声明');
      } else if (state.layer === 'geometry') {
        svgText(svg, middle, 103, '净宽 ' + doorWidth.toFixed(2) + ' m');
        svgText(svg, left, 198, '直径 0.60 m');
        svgText(svg, right, 198, '杯子');
        svgText(svg, middle, 279, doorWidth >= .6 ? '0.90 ≥ 0.60：这项净宽条件成立' : '0.50 < 0.60：这项净宽条件失败', {fill: doorWidth >= .6 ? 'var(--primary)' : 'var(--destructive)'});
      } else if (state.layer === 'state') {
        svgText(svg, middle, 107, '门锁着');
        svgText(svg, left, 199, '机器人在 A'); svgText(svg, right, 199, '杯子在 B');
        svgText(svg, left, 226, hasKey ? '物品栏：有钥匙 K' : '物品栏：没有钥匙');
        svgText(svg, middle, 279, '目标 holding(r,cup)：尚未成立');
      } else {
        svgText(svg, left, 201, '有移动、解锁能力');
        svgText(svg, right, 201, '有抓取能力');
        svgText(svg, middle, 280, canOpen ? '开门能力：已声明' : '开门能力：没有声明', {fill: canOpen ? 'var(--primary)' : 'var(--destructive)'});
      }
      const entry = info[state.layer]; let answer = entry.answer;
      if (state.layer === 'geometry') answer = '门宽 ' + doorWidth.toFixed(2) + ' m，机器人直径 0.60 m。' + (doorWidth >= .6 ? '这项尺寸条件成立，仍需检查其他条件。' : '门洞比圆盘身体窄，这个固定身体模型不能穿过该净宽。');
      if (state.layer === 'state') answer = '机器人在 A，杯子在 B，门锁着、尚未打开；' + (hasKey ? '物品栏里有匹配钥匙。' : '物品栏里没有钥匙。');
      if (state.layer === 'ability') answer = '移动、解锁、抓取能力已声明；' + (canOpen ? '开门能力也已声明。' : '开门能力被移除，不能把“会解锁”代替“会开门”。');
      text(layers, '#d3p-layer-question', entry.question); text(layers, '#d3p-layer-answer', answer); text(layers, '#d3p-layer-limit', entry.limit);
      text(layers, '#d3p-layer-desc', entry.question + answer + entry.limit);
      layers.querySelectorAll('[data-d3p-layer]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d3pLayer === state.layer)); });
      if (announce) text(layers, '#d3p-layer-live', entry.question + answer);
    }
    layers.querySelectorAll('[data-d3p-layer]').forEach(function (button) { button.addEventListener('click', function () { state.layer = button.dataset.d3pLayer; render(true); }); });
    layers.querySelector('#d3p-layer-case').addEventListener('change', function (event) { state.caseId = event.target.value; render(true); });
    render(false); watchWidth(svg, function () { render(false); });
  }

  const fsm = document.getElementById('day3-fsm');
  if (fsm) {
    let state = initialExecutor(), history = [state.event]; const svg = fsm.querySelector('#d3p-fsm-scene');
    function render(announce) {
      const W = resetSVG(svg, 370), center = W / 2, topWidth = 136, sideWidth = Math.min(154, (W - 54) / 2);
      const topLeft = center - topWidth / 2, topRight = center + topWidth / 2;
      const leftCenter = 18 + sideWidth / 2, rightCenter = W - 18 - sideWidth / 2;
      const boxes = {ready: [topLeft, 36, topWidth], waiting: [topLeft, 148, topWidth], complete: [18, 294, sideWidth], blocked: [W - 18 - sideWidth, 294, sideWidth]};
      const defs = node('defs'), marker = node('marker', {id: 'd3p-fsm-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'});
      marker.appendChild(node('path', {d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--muted-foreground)'})); defs.appendChild(marker); svg.appendChild(defs);
      function arrow(path) { svg.appendChild(node('path', {d: path, fill: 'none', stroke: 'var(--muted-foreground)', 'stroke-width': 1.6, 'marker-end': 'url(#d3p-fsm-arrow)'})); }
      arrow('M ' + center + ' 88 V 148');
      svgText(svg, center + 24, 123, '请求', {'font-size': 11});
      arrow('M ' + topLeft + ' 174 H 12 V 62 H ' + topLeft);
      svgText(svg, topLeft / 2 + 6, 111, '成功', {'font-size': 10});
      svgText(svg, topLeft / 2 + 6, 127, '还有下一步', {'font-size': 10});
      arrow('M ' + (center - 25) + ' 200 L ' + leftCenter + ' 294');
      svgText(svg, leftCenter - 8, 249, '末步成功', {'font-size': 11});
      arrow('M ' + (center + 25) + ' 200 L ' + rightCenter + ' 294');
      svgText(svg, rightCenter, 249, '失败', {'font-size': 11});
      arrow('M ' + (W - 18) + ' 320 H ' + (W - 8) + ' V 62 H ' + topRight);
      svgText(svg, (topRight + W - 8) / 2, 111, '复核确认', {'font-size': 10});
      svgText(svg, (topRight + W - 8) / 2, 127, '后再请求', {'font-size': 10});
      Object.entries(boxes).forEach(function (entry) { const position = entry[1], active = state.phase === entry[0]; svg.appendChild(node('rect', {x: position[0], y: position[1], width: position[2], height: 52, rx: 7, fill: active ? 'var(--accent)' : 'var(--background)', stroke: active ? 'var(--primary)' : 'var(--border)', 'stroke-width': active ? 2.5 : 1.5})); svgText(svg, position[0] + position[2] / 2, position[1] + 32, PHASES[entry[0]], {'font-size': 12, 'font-weight': active ? 650 : 400}); });
      const list = fsm.querySelector('#d3p-fsm-plan'); list.replaceChildren();
      PLAN.forEach(function (action, index) { const item = document.createElement('li'); item.textContent = action + (index < state.cursor ? ' · 已确认' : index === state.cursor ? ' · 当前' : ''); item.dataset.state = index < state.cursor ? 'done' : index === state.cursor ? 'current' : 'later'; list.appendChild(item); });
      text(fsm, '#d3p-fsm-pointer', '已确认 ' + state.cursor + ' / 4 步；' + (state.cursor < 4 ? '当前指向 ' + PLAN[state.cursor] : '计划指针已经到末尾'));
      text(fsm, '#d3p-fsm-status', PHASES[state.phase]); text(fsm, '#d3p-fsm-explanation', state.event);
      fsm.querySelector('#d3p-fsm-send').disabled = state.phase !== 'ready';
      fsm.querySelector('#d3p-fsm-success').disabled = state.phase !== 'waiting';
      fsm.querySelector('#d3p-fsm-failure').disabled = state.phase !== 'waiting';
      fsm.querySelector('#d3p-fsm-observe').disabled = state.phase !== 'blocked';
      const log = fsm.querySelector('#d3p-fsm-log'); log.replaceChildren(); history.slice(-12).forEach(function (event) { const item = document.createElement('li'); item.textContent = event; log.appendChild(item); });
      if (announce) text(fsm, '#d3p-fsm-live', PHASES[state.phase] + '。' + state.event);
    }
    ['send', 'success', 'failure', 'observe', 'reset'].forEach(function (event) { fsm.querySelector('#d3p-fsm-' + event).addEventListener('click', function () { state = transitionExecutor(state, event); if (event === 'reset') history = []; history.push(state.event); render(true); }); });
    render(false); watchWidth(svg, function () { render(false); });
  }

  const checkpoint = document.getElementById('day3-checkpoint');
  if (checkpoint) {
    const KEY = 'mr-checkpoint:day-03:v1', criteria = ['概念', '因果', '接口', '验证', '真实性'];
    const fields = checkpoint.querySelector('#d3p-score-fields');
    criteria.forEach(function (label, index) {
      const wrapper = document.createElement('label'); wrapper.className = 'form-label'; wrapper.htmlFor = 'd3p-score-' + index; wrapper.append(label + ' ');
      const select = document.createElement('select'); select.className = 'form-select'; select.id = 'd3p-score-' + index; select.dataset.d3pAnswer = 'score-' + index;
      [['', '未评分'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']].forEach(function (entry) { const option = document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; select.appendChild(option); });
      wrapper.appendChild(select); fields.appendChild(wrapper);
    });
    const inputs = Array.from(checkpoint.querySelectorAll('[data-d3p-answer]'));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      inputs.forEach(function (input) { if (typeof saved[input.dataset.d3pAnswer] === 'string') input.value = saved[input.dataset.d3pAnswer]; });
      if (Object.keys(saved).length) text(checkpoint, '#d3p-checkpoint-save', '已恢复此浏览器中的首答、修订与自评。');
    } catch (_) { text(checkpoint, '#d3p-checkpoint-save', '此浏览器暂不能恢复记录；可导出保留。'); }
    function currentAnswers() { const saved = {}; inputs.forEach(function (input) { saved[input.dataset.d3pAnswer] = input.value; }); return saved; }
    function scores() {
      const values = criteria.map(function (_, index) { return checkpoint.querySelector('#d3p-score-' + index).value; });
      if (values.some(function (value) { return !/^[0-4]$/.test(value); })) { text(checkpoint, '#d3p-score-summary', '尚有未评分项目；页面不会替你判定掌握程度。'); return; }
      const total = values.reduce(function (sum, value) { return sum + Number(value); }, 0);
      text(checkpoint, '#d3p-score-summary', '你的自评：' + total + ' / 20。' + (total <= 11 ? '按原计划，Day 4 的非核心阅读先让位给本部分复习。' : '带着仍不确定的条件进入下一天；分数不代替自己的解释与证据。'));
    }
    inputs.forEach(function (input) { input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', function () { try { localStorage.setItem(KEY, JSON.stringify(currentAnswers())); text(checkpoint, '#d3p-checkpoint-save', '已保存到此浏览器。'); } catch (_) { text(checkpoint, '#d3p-checkpoint-save', '保存不可用，请导出保留。'); } scores(); }); });
    checkpoint.querySelector('#d3p-export-checkpoint').addEventListener('click', function () {
      const answers = currentAnswers(), titles = ['分层表示', '谓词与动作', '失败归因', '反馈与重新求解'];
      let content = '# Day 03 · Checkpoint A\n\n题目：场景图 A–D–B 连通，但门锁着，机械臂够不着把手，如何处理？\n\n';
      titles.forEach(function (title, index) { const prefix = 'q' + (index + 1); content += '## ' + (index + 1) + '. ' + title + '\n\n### 我的首次回答\n\n' + (answers[prefix + '-first'] || '未填写') + '\n\n### 后来修订与原因\n\n' + (answers[prefix + '-revised'] || '未填写') + '\n\n'; });
      content += '## 自评\n\n' + criteria.map(function (title, index) { return '- ' + title + '：' + (answers['score-' + index] || '未评分'); }).join('\n') + '\n\n## 待补问题\n\n' + (answers['q5-review'] || '未填写') + '\n\n---\n这是个人填写记录；页面不自动判定完成或掌握。\n';
      download('day-03-checkpoint-a.md', content); text(checkpoint, '#d3p-checkpoint-save', '已生成含首答、修订与自评的 Markdown 下载。');
    });
    scores();
    const DURATION = 35 * 60 * 1000; let remaining = DURATION, end = null, interval = null, announcedStage = -1;
    function renderClock() {
      if (end !== null) remaining = Math.max(0, end - Date.now());
      text(checkpoint, '#d3p-clock', formatClock(remaining));
      const stage = checkpointStage(remaining);
      text(checkpoint, '#d3p-clock-stage', remaining === 0 ? '35 分钟计时结束；可以继续整理答案，不会自动提交。' : '当前建议：第 ' + (stage.index + 1) + ' 段 · ' + stage.label + (end === null ? '（计时暂停）' : ''));
      if (end !== null && stage.index !== announcedStage) { announcedStage = stage.index; text(checkpoint, '#d3p-clock-live', '建议进入：' + stage.label); }
      if (remaining === 0 && end !== null) { clearInterval(interval); interval = null; end = null; text(checkpoint, '#d3p-clock-live', '35 分钟计时结束，可以继续保存和整理答案。'); }
      const button = checkpoint.querySelector('#d3p-clock-toggle'); button.textContent = end === null ? (remaining === DURATION ? '开始计时' : '继续计时') : '暂停计时'; button.disabled = remaining === 0;
    }
    checkpoint.querySelector('#d3p-clock-toggle').addEventListener('click', function () { if (end === null) { end = Date.now() + remaining; interval = setInterval(renderClock, 500); } else { remaining = Math.max(0, end - Date.now()); end = null; clearInterval(interval); interval = null; } renderClock(); });
    checkpoint.querySelector('#d3p-clock-reset').addEventListener('click', function () { if (interval !== null) clearInterval(interval); interval = null; end = null; remaining = DURATION; announcedStage = -1; renderClock(); text(checkpoint, '#d3p-clock-live', '计时已重置为35分钟，答案保持原样。'); });
  }
})();
