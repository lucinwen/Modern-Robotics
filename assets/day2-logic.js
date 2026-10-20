(function () {
  'use strict';

  // Exact interval semantics for the explicitly limited teaching models below.
  // This file neither embeds nor calls Z3. The page separately identifies real runs.
  const CORE_CONSTRAINTS = Object.freeze([
    Object.freeze({id: 'A', variable: 'x', op: '>=', value: 2, label: 'x ≥ 2'}),
    Object.freeze({id: 'B', variable: 'x', op: '<=', value: 1, label: 'x ≤ 1'}),
    Object.freeze({id: 'C', variable: 'y', op: '>=', value: 4, label: 'y ≥ 4'}),
    Object.freeze({id: 'D', variable: 'y', op: '<=', value: 3, label: 'y ≤ 3'}),
    Object.freeze({id: 'E', variable: 'x', op: '<=', value: 10, label: 'x ≤ 10'})
  ]);
  const STACK_ADDITIONS = Object.freeze({
    upper1: Object.freeze({id: 'upper1', variable: 'x', op: '<=', value: 1, label: 'x ≤ 1'}),
    lower4: Object.freeze({id: 'lower4', variable: 'x', op: '>=', value: 4, label: 'x ≥ 4'}),
    upper6: Object.freeze({id: 'upper6', variable: 'x', op: '<=', value: 6, label: 'x ≤ 6'})
  });
  const DOOR_CANDIDATES_CM = Object.freeze([60, 70, 80, 90, 100, 110, 120, 130, 140]);

  function intervalModel(lower, upper, domain) {
    if (typeof lower !== 'number' || typeof upper !== 'number' || Number.isNaN(lower) || Number.isNaN(upper)) throw new TypeError('Bounds must be numbers.');
    if (domain !== 'Int' && domain !== 'Real') throw new TypeError('Use Int or Real.');
    const first = domain === 'Int' ? Math.ceil(lower) : lower;
    const last = domain === 'Int' ? Math.floor(upper) : upper;
    const sat = first <= last && first !== Infinity && last !== -Infinity;
    let witness = null;
    if (sat) {
      if (domain === 'Real' && Number.isFinite(first) && Number.isFinite(last)) witness = first + (last - first) / 2;
      else if (Number.isFinite(first)) witness = first;
      else if (Number.isFinite(last)) witness = last;
      else witness = 0;
    }
    return {sat: sat, domain: domain, lower: lower, upper: upper, first: first, last: last, witness: witness};
  }

  function booleanRule(locked, hasKey) { return !locked || hasKey; }

  function analyzeConstraints(constraints, domain) {
    const chosenDomain = domain || 'Int';
    const bounds = {x: {lower: -Infinity, upper: Infinity}, y: {lower: -Infinity, upper: Infinity}};
    constraints.forEach(function (constraint) {
      if (!bounds[constraint.variable] || !Number.isFinite(constraint.value)) throw new TypeError('Unsupported interval constraint.');
      if (constraint.op === '>=') bounds[constraint.variable].lower = Math.max(bounds[constraint.variable].lower, constraint.value);
      else if (constraint.op === '<=') bounds[constraint.variable].upper = Math.min(bounds[constraint.variable].upper, constraint.value);
      else throw new TypeError('Only closed lower and upper bounds are supported.');
    });
    const x = intervalModel(bounds.x.lower, bounds.x.upper, chosenDomain);
    const y = intervalModel(bounds.y.lower, bounds.y.upper, chosenDomain);
    const sat = x.sat && y.sat;
    return {sat: sat, intervals: {x: x, y: y}, model: sat ? {x: x.witness, y: y.witness} : null};
  }

  function constraintsFor(ids) {
    const unique = Array.from(new Set(ids));
    return unique.map(function (id) {
      const item = CORE_CONSTRAINTS.find(function (constraint) { return constraint.id === id; });
      if (!item) throw new TypeError('Unknown tracked label: ' + id);
      return item;
    });
  }

  function minimalConflictSubsets(activeIds) {
    const ids = constraintsFor(activeIds).map(function (item) { return item.id; });
    const results = [];
    for (let mask = 1; mask < (1 << ids.length); mask++) {
      const subset = ids.filter(function (_, index) { return Boolean(mask & (1 << index)); });
      if (analyzeConstraints(constraintsFor(subset)).sat) continue;
      const minimal = subset.every(function (_, index) {
        return analyzeConstraints(constraintsFor(subset.filter(function (__, i) { return i !== index; }))).sat;
      });
      if (minimal) results.push(subset);
    }
    return results;
  }

  function classifyCore(activeIds, candidateIds) {
    const active = constraintsFor(activeIds).map(function (item) { return item.id; });
    const candidate = constraintsFor(candidateIds).map(function (item) { return item.id; });
    const subset = candidate.every(function (id) { return active.includes(id); });
    const fullResult = analyzeConstraints(constraintsFor(active));
    const candidateResult = analyzeConstraints(constraintsFor(candidate));
    const isCore = subset && !candidateResult.sat;
    const minimalCores = minimalConflictSubsets(active);
    const inclusionMinimal = isCore && candidate.every(function (_, index) {
      return analyzeConstraints(constraintsFor(candidate.filter(function (__, i) { return i !== index; }))).sat;
    });
    const minimumCardinality = minimalCores.length ? Math.min.apply(null, minimalCores.map(function (items) { return items.length; })) : null;
    return {active: active, candidate: candidate, subset: subset, full: fullResult, candidateResult: candidateResult, isCore: isCore, inclusionMinimal: inclusionMinimal, minimumCardinality: minimumCardinality, minimalCores: minimalCores};
  }

  function createIncrementalState() {
    return {layers: [[{id: 'base2', variable: 'x', op: '>=', value: 2, label: 'x ≥ 2'}]], lastCheck: null, history: ['基础层：add(x ≥ 2)']};
  }

  function incrementalConstraints(state) { return state.layers.reduce(function (all, layer) { return all.concat(layer); }, []); }

  function applyIncremental(state, action) {
    if (action.type === 'reset') return createIncrementalState();
    const next = {layers: state.layers.map(function (layer) { return layer.map(function (item) { return Object.assign({}, item); }); }), lastCheck: null, history: state.history.slice()};
    if (action.type === 'push') {
      if (next.layers.length >= 3) throw new RangeError('This teaching model supports two temporary levels.');
      next.layers.push([]);
      next.history.push('push() → 临时层 ' + (next.layers.length - 1));
    } else if (action.type === 'pop') {
      if (next.layers.length <= 1) throw new RangeError('The base layer cannot be popped.');
      const removed = next.layers.pop();
      next.history.push('pop() → 撤回 ' + (removed.length ? removed.map(function (item) { return item.label; }).join('，') : '空临时层'));
    } else if (action.type === 'add') {
      if (next.layers.length <= 1) throw new RangeError('Push a temporary layer first.');
      const addition = STACK_ADDITIONS[action.key];
      if (!addition) throw new TypeError('Unknown addition.');
      const top = next.layers[next.layers.length - 1];
      if (!top.some(function (item) { return item.id === addition.id; })) top.push(Object.assign({}, addition));
      next.history.push('临时层 ' + (next.layers.length - 1) + '：add(' + addition.label + ')');
    } else if (action.type === 'check') {
      next.lastCheck = analyzeConstraints(incrementalConstraints(next));
      next.history.push('check() → ' + (next.lastCheck.sat ? 'sat；一个模型 x = ' + next.lastCheck.model.x : 'unsat'));
    } else throw new TypeError('Unknown incremental action.');
    return next;
  }

  function evaluateCandidates(options) {
    ['capCm', 'robotCm', 'marginCm', 'desiredCm'].forEach(function (key) {
      if (!Number.isFinite(options[key]) || options[key] < 0) throw new TypeError('Door parameters must be non-negative finite numbers.');
    });
    if (options.strategy !== 'desired' && options.strategy !== 'compact') throw new TypeError('Unknown preference strategy.');
    const minimumCm = options.robotCm + 2 * options.marginCm;
    const candidates = DOOR_CANDIDATES_CM.map(function (cm) {
      const feasible = cm >= minimumCm && cm <= options.capCm;
      return {cm: cm, feasible: feasible, belowMinimum: cm < minimumCm, aboveCapacity: cm > options.capCm, cost: options.strategy === 'desired' ? Math.abs(cm - options.desiredCm) : cm};
    });
    const feasible = candidates.filter(function (candidate) { return candidate.feasible; });
    const ranked = feasible.slice().sort(function (a, b) { return a.cost - b.cost || a.cm - b.cm; });
    return {minimumCm: minimumCm, candidates: candidates, feasible: feasible, selected: ranked[0] || null, sat: feasible.length > 0};
  }

  const api = {intervalModel: intervalModel, booleanRule: booleanRule, analyzeConstraints: analyzeConstraints, classifyCore: classifyCore, minimalConflictSubsets: minimalConflictSubsets, createIncrementalState: createIncrementalState, applyIncremental: applyIncremental, incrementalConstraints: incrementalConstraints, evaluateCandidates: evaluateCandidates, coreConstraints: CORE_CONSTRAINTS, doorCandidatesCm: DOOR_CANDIDATES_CM};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const NS = 'http://www.w3.org/2000/svg';
  function number(value, precision) {
    if (value === Infinity) return '+∞';
    if (value === -Infinity) return '−∞';
    const fixed = Math.abs(value) < 1e-10 ? 0 : value;
    return fixed.toFixed(precision === undefined ? 1 : precision).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }
  function metres(cm) { return (cm / 100).toFixed(2) + ' m'; }
  function q(root, selector) { return root.querySelector(selector); }
  function setText(root, selector, text) { q(root, selector).textContent = text; }
  function badge(root, selector, label, kind) { const node = q(root, selector); node.textContent = label; node.dataset.kind = kind; }
  function announce(root, id, message) { q(root, id).textContent = message; }
  function boot(id, initialize) {
    const root = document.getElementById(id);
    if (!root || root.dataset.d2lInitialized === 'true') return;
    root.dataset.d2lInitialized = 'true'; initialize(root);
  }
  function svgContext(svg, height) {
    const width = Math.max(200, svg.getBoundingClientRect().width || 600);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); });
    function add(tag, attributes, text) {
      const node = document.createElementNS(NS, tag);
      Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, String(attributes[key])); });
      if (text !== undefined) node.textContent = text;
      svg.appendChild(node); return node;
    }
    function text(x, y, value, attributes) { return add('text', Object.assign({x: x, y: y}, attributes || {}), value); }
    function line(x1, y1, x2, y2, attributes) { return add('line', Object.assign({x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--border)', 'stroke-width': 1}, attributes || {})); }
    function cross(x, y, color, radius) { const r = radius || 5; line(x - r, y - r, x + r, y + r, {stroke: color, 'stroke-width': 2}); line(x - r, y + r, x + r, y - r, {stroke: color, 'stroke-width': 2}); }
    return {svg: svg, width: width, height: height, add: add, text: text, line: line, cross: cross};
  }
  function numberAxis(ctx, y, min, max, options) {
    const opts = options || {}, left = 24, right = ctx.width - 24;
    const project = function (value) { return left + (value - min) * (right - left) / (max - min); };
    ctx.line(left, y, right, y, {stroke: 'var(--muted-foreground)', 'stroke-width': 1.2});
    const tickEvery = ctx.width < 340 && max - min > 7 ? 2 : 1;
    for (let value = Math.ceil(min); value <= Math.floor(max); value++) {
      ctx.line(project(value), y - 4, project(value), y + 4, {stroke: 'var(--muted-foreground)'});
      if ((value - Math.ceil(min)) % tickEvery === 0 || value === Math.floor(max)) ctx.text(project(value), y + (opts.labelOffset || 24), String(value), {'text-anchor': 'middle', class: 'd2l-plot-muted'});
    }
    return {left: left, right: right, project: project, clamp: function (value) { return project(Math.max(min, Math.min(max, value))); }};
  }
  function arrow(ctx, x, y, direction, color) {
    ctx.line(x - direction * 6, y - 4, x, y, {stroke: color, 'stroke-width': 1.8});
    ctx.line(x - direction * 6, y + 4, x, y, {stroke: color, 'stroke-width': 1.8});
  }
  function observe(svg, draw) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(draw).observe(svg);
    else window.addEventListener('resize', draw);
  }
  function drawBoundIntersection(ctx, y, min, max, interval, label) {
    const axisY = y + 71;
    const axis = numberAxis(ctx, axisY, min, max, {labelOffset: 23});
    ctx.text(12, y + 13, label, {'font-weight': 600});
    const lowerY = y + 33, upperY = y + 48;
    if (interval.lower <= max) {
      ctx.line(axis.clamp(interval.lower), lowerY, axis.right, lowerY, {stroke: 'var(--viz-series-1)', 'stroke-width': 5, 'stroke-linecap': 'round'});
      arrow(ctx, axis.right, lowerY, 1, 'var(--viz-series-1)');
    }
    if (interval.upper >= min) {
      ctx.line(axis.left, upperY, axis.clamp(interval.upper), upperY, {stroke: 'var(--viz-series-2)', 'stroke-width': 5, 'stroke-linecap': 'round'});
      arrow(ctx, axis.left, upperY, -1, 'var(--viz-series-2)');
    }
    for (let value = Math.ceil(min); value <= Math.floor(max); value++) {
      const allowed = interval.sat && value >= interval.first && value <= interval.last;
      ctx.add('circle', {cx: axis.project(value), cy: axisY, r: allowed ? 4.5 : 2, fill: allowed ? 'var(--viz-series-1)' : 'var(--border)'});
    }
    if (!interval.sat) {
      const middle = (Math.max(min, Math.min(max, interval.lower)) + Math.max(min, Math.min(max, interval.upper))) / 2;
      ctx.cross(axis.project(middle), axisY, 'var(--destructive)', 6);
    }
    return axis;
  }

  boot('day2-domains', function (root) {
    const state = {domain: 'Real', lower: 2.2, upper: 2.8};
    const svg = q(root, '.d2l-domain-plot');
    function resultText(result) { return result.sat ? '例如 x = ' + number(result.witness, 2) + '。这只是一个满足赋值。' : '没有任何 ' + (state.domain === 'Int' ? '整数' : '实数') + ' 能同时满足两个界限。'; }
    function draw() {
      const ctx = svgContext(svg, 225);
      ['Real', 'Int'].forEach(function (domain, index) {
        const selected = state.domain === domain, result = intervalModel(state.lower, state.upper, domain);
        const top = index * 109, axisY = top + 61;
        if (selected) ctx.add('rect', {x: 1, y: top + 2, width: ctx.width - 2, height: 105, rx: 7, fill: 'var(--accent)', 'fill-opacity': 0.5});
        ctx.text(12, top + 23, domain + (domain === 'Real' ? ' · 连续实数' : ' · 整数点'), {'font-weight': selected ? 650 : 450});
        const axis = numberAxis(ctx, axisY, -1, 5);
        if (domain === 'Real') {
          if (result.sat) {
            ctx.line(axis.project(state.lower), axisY, axis.project(state.upper), axisY, {stroke: 'var(--viz-series-1)', 'stroke-width': 9, 'stroke-linecap': 'round'});
            [state.lower, state.upper].forEach(function (value) { ctx.add('circle', {cx: axis.project(value), cy: axisY, r: 5, fill: 'var(--viz-series-1)'}); });
          } else ctx.cross(axis.clamp((state.lower + state.upper) / 2), axisY, 'var(--destructive)', 6);
        } else {
          for (let value = -1; value <= 5; value++) {
            const allowed = result.sat && value >= result.first && value <= result.last;
            ctx.add('circle', {cx: axis.project(value), cy: axisY, r: allowed ? 6 : 3.5, fill: allowed ? 'var(--viz-series-1)' : 'var(--border)'});
          }
          if (!result.sat) ctx.cross(axis.clamp((state.lower + state.upper) / 2), axisY, 'var(--destructive)', 6);
        }
        if (selected && result.sat) ctx.add('circle', {cx: axis.project(result.witness), cy: axisY, r: 8.5, fill: 'none', stroke: 'var(--viz-series-2)', 'stroke-width': 2.5});
        ctx.text(ctx.width - 12, top + 23, result.sat ? '有满足值' : '无满足值', {'text-anchor': 'end', class: result.sat ? 'd2l-plot-muted' : 'd2l-plot-error'});
      });
    }
    function sync() {
      ['lower', 'upper'].forEach(function (key) { q(root, '#d2l-domain-' + key).value = state[key]; setText(root, '#d2l-domain-' + key + '-value', number(state[key])); });
      root.querySelectorAll('[data-d2l-domain]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2lDomain === state.domain)); });
      const result = intervalModel(state.lower, state.upper, state.domain);
      const real = intervalModel(state.lower, state.upper, 'Real'), integers = intervalModel(state.lower, state.upper, 'Int');
      setText(root, '#d2l-domain-formula', 'x : ' + state.domain + '；' + number(state.lower) + ' ≤ x ≤ ' + number(state.upper));
      badge(root, '#d2l-domain-badge', result.sat ? '有满足值 · sat' : '无满足值 · unsat', result.sat ? 'sat' : 'unsat');
      setText(root, '#d2l-domain-result', resultText(result));
      let comparison;
      if (!real.sat) comparison = '下界大于上界，实数和整数都没有满足值。';
      else if (!integers.sat) comparison = 'Real 中有满足值；Int 中没有落入这个区间的整数。变量类型改变了问题。';
      else comparison = '两种类型都有满足值。实数允许区间中的所有值，整数只允许其中的整数点。';
      setText(root, '#d2l-domain-comparison', comparison + ' 金色圆圈标出当前类型的一个示例模型。');
      draw();
      return state.domain + '，' + number(state.lower) + ' ≤ x ≤ ' + number(state.upper) + '。' + resultText(result);
    }
    ['lower', 'upper'].forEach(function (key) {
      const input = q(root, '#d2l-domain-' + key);
      input.addEventListener('input', function () { state[key] = Number(input.value); sync(); });
      input.addEventListener('change', function () { announce(root, '#d2l-domain-status', sync()); });
    });
    root.querySelectorAll('[data-d2l-domain]').forEach(function (button) { button.addEventListener('click', function () { state.domain = button.dataset.d2lDomain; announce(root, '#d2l-domain-status', sync()); }); });
    root.querySelectorAll('[data-d2l-domain-preset]').forEach(function (button) { button.addEventListener('click', function () {
      const presets = {fraction: [2.2, 2.8], singleton: [3, 3], conflict: [4, 2]};
      const values = presets[button.dataset.d2lDomainPreset]; state.lower = values[0]; state.upper = values[1]; announce(root, '#d2l-domain-status', sync());
    }); });
    function syncBool(notify) {
      const locked = q(root, '#d2l-bool-locked').checked, key = q(root, '#d2l-bool-key').checked;
      const text = booleanRule(locked, key) ? 'True：' + (!locked ? '门未锁，第一项已经成立。' : '门已锁，但“有钥匙”这一项成立。') : 'False：门已锁，而且没有钥匙。';
      setText(root, '#d2l-bool-result', text);
      if (notify) announce(root, '#d2l-domain-status', '布尔规则：' + text);
    }
    ['locked', 'key'].forEach(function (key) { q(root, '#d2l-bool-' + key).addEventListener('change', function () { syncBool(true); }); });
    sync(); syncBool(false); observe(svg, draw);
  });

  boot('day2-incremental', function (root) {
    let state = createIncrementalState();
    const svg = q(root, '.d2l-stack-plot');
    function intervalText(interval) {
      if (!interval.sat) return '下界 ' + number(interval.lower) + ' > 上界 ' + number(interval.upper) + '，交集为空';
      if (interval.upper === Infinity) return 'x ≥ ' + number(interval.first) + '，且 x 为整数';
      return number(interval.first) + ' ≤ x ≤ ' + number(interval.last) + '，且 x 为整数';
    }
    function draw() {
      const ctx = svgContext(svg, 158), interval = analyzeConstraints(incrementalConstraints(state)).intervals.x;
      drawBoundIntersection(ctx, 8, -1, 7, interval, '绿色满足下界；金色满足上界');
      ctx.text(12, 130, '圆点：满足当前全部断言的整数', {class: 'd2l-plot-muted'});
      ctx.text(12, 150, '图示 −1～7，箭头表示继续延伸', {class: 'd2l-plot-muted'});
    }
    function sync() {
      const layers = q(root, '#d2l-stack-layers'); layers.replaceChildren();
      state.layers.forEach(function (items, index) {
        const block = document.createElement('div'); block.className = 'd2l-stack-layer'; block.dataset.current = String(index === state.layers.length - 1);
        const heading = document.createElement('strong'); heading.textContent = index === 0 ? '基础层 · 始终保留' : '临时层 ' + index + (index === state.layers.length - 1 ? ' · 当前层' : ''); block.appendChild(heading);
        const description = document.createElement('span'); description.textContent = items.length ? items.map(function (item) { return item.label; }).join(' 且 ') : '尚无断言'; block.appendChild(description); layers.appendChild(block);
      });
      q(root, '[data-d2l-stack-action="push"]').disabled = state.layers.length >= 3;
      q(root, '[data-d2l-stack-action="pop"]').disabled = state.layers.length <= 1;
      root.querySelectorAll('[data-d2l-stack-add]').forEach(function (button) { button.disabled = state.layers.length <= 1 || state.layers[state.layers.length - 1].some(function (item) { return item.id === button.dataset.d2lStackAdd; }); });
      setText(root, '#d2l-stack-hint', state.layers.length === 1 ? '先 push，再添加临时条件。' : '新条件进入临时层 ' + (state.layers.length - 1) + '；pop 会撤回这一整层。');
      const interval = analyzeConstraints(incrementalConstraints(state)).intervals.x;
      setText(root, '#d2l-stack-interval', intervalText(interval));
      let message;
      if (!state.lastCheck) { badge(root, '#d2l-stack-badge', '待 check', 'pending'); message = '点击 check，记录当前断言的解析判定。'; }
      else if (state.lastCheck.sat) { badge(root, '#d2l-stack-badge', '本例解析：sat', 'sat'); message = '例如 x = ' + number(state.lastCheck.model.x) + '，满足当前所有断言。'; }
      else { badge(root, '#d2l-stack-badge', '本例解析：unsat', 'unsat'); message = '当前上下界没有交集；没有整数满足全部断言。'; }
      setText(root, '#d2l-stack-result', message);
      const history = q(root, '#d2l-stack-history'); history.replaceChildren();
      state.history.forEach(function (entry) { const li = document.createElement('li'); li.textContent = entry; history.appendChild(li); });
      draw(); return state.history[state.history.length - 1] + '。' + message;
    }
    root.querySelectorAll('[data-d2l-stack-action]').forEach(function (button) { button.addEventListener('click', function () { state = applyIncremental(state, {type: button.dataset.d2lStackAction}); announce(root, '#d2l-stack-status', sync()); }); });
    root.querySelectorAll('[data-d2l-stack-add]').forEach(function (button) { button.addEventListener('click', function () { state = applyIncremental(state, {type: 'add', key: button.dataset.d2lStackAdd}); announce(root, '#d2l-stack-status', sync()); }); });
    sync(); observe(svg, draw);
  });

  boot('day2-core', function (root) {
    let active = CORE_CONSTRAINTS.map(function (item) { return item.id; }), picked = ['A', 'B'];
    const svg = q(root, '.d2l-core-plot');
    function draw() {
      const ctx = svgContext(svg, 244), result = classifyCore(active, picked).candidateResult;
      ['x', 'y'].forEach(function (variable, index) {
        const interval = result.intervals[variable];
        const description = variable + '：下界 ' + number(interval.lower) + '，上界 ' + number(interval.upper);
        drawBoundIntersection(ctx, 7 + index * 115, 0, variable === 'x' ? 11 : 6, interval, description);
      });
    }
    function sync() {
      picked = picked.filter(function (id) { return active.includes(id); });
      const result = classifyCore(active, picked);
      CORE_CONSTRAINTS.forEach(function (item) {
        const activeBox = q(root, '#d2l-core-active-' + item.id), candidateBox = q(root, '#d2l-core-pick-' + item.id);
        activeBox.checked = active.includes(item.id); candidateBox.checked = picked.includes(item.id); candidateBox.disabled = !activeBox.checked;
        const row = activeBox.closest('.d2l-core-row'); row.dataset.active = String(activeBox.checked); row.dataset.selected = String(candidateBox.checked);
      });
      q(root, '[data-d2l-core-preset="x"]').disabled = !['A', 'B'].every(function (id) { return active.includes(id); });
      q(root, '[data-d2l-core-preset="y"]').disabled = !['C', 'D'].every(function (id) { return active.includes(id); });
      const activeNames = active.length ? active.join(' + ') : '空断言集';
      setText(root, '#d2l-core-full', activeNames + '：' + (result.full.sat ? '有满足赋值' : '无满足赋值'));
      const candidateNames = picked.length ? picked.join(' + ') : '空子集';
      let description;
      if (result.isCore) {
        badge(root, '#d2l-core-badge', '候选足以冲突', 'unsat');
        description = candidateNames + ' 已经足以导致无解。它是当前全体公式的一个冲突子集。';
      } else {
        badge(root, '#d2l-core-badge', '候选本身不冲突', 'sat');
        description = candidateNames + ' 有满足赋值，不能作为本例的 unsat core。' + (result.full.sat ? '当前全体也有满足赋值。' : '当前全体仍无解，其他标签之间仍有冲突。');
      }
      setText(root, '#d2l-core-result', description);
      let minimal;
      if (!result.isCore) minimal = result.full.sat ? '全体公式可满足，本次没有需要报告的冲突核心。' : '可以换一组候选标签，寻找足以共同冲突的子集。';
      else minimal = '本候选有 ' + picked.length + ' 条，' + (result.inclusionMinimal ? '是包含极小的核心' : '仍含可以移除的标签，因此不是包含极小的核心') + '。本例最少需要 ' + result.minimumCardinality + ' 条标签形成冲突。';
      setText(root, '#d2l-core-minimal', minimal);
      setText(root, '#d2l-core-all', result.minimalCores.length ? result.minimalCores.map(function (items) { return items.join(' + '); }).join('；') + '。' : '当前全体公式可满足，没有冲突子集。');
      draw(); return '当前全体' + (result.full.sat ? '可满足。' : '不可满足。') + description;
    }
    root.querySelectorAll('[data-d2l-core-active]').forEach(function (input) { input.addEventListener('change', function () {
      const id = input.dataset.d2lCoreActive; active = CORE_CONSTRAINTS.map(function (item) { return item.id; }).filter(function (name) { return name === id ? input.checked : active.includes(name); }); announce(root, '#d2l-core-status', sync());
    }); });
    root.querySelectorAll('[data-d2l-core-pick]').forEach(function (input) { input.addEventListener('change', function () {
      const id = input.dataset.d2lCorePick; picked = CORE_CONSTRAINTS.map(function (item) { return item.id; }).filter(function (name) { return name === id ? input.checked : picked.includes(name); }); announce(root, '#d2l-core-status', sync());
    }); });
    root.querySelectorAll('[data-d2l-core-preset]').forEach(function (button) { button.addEventListener('click', function () {
      const preset = button.dataset.d2lCorePreset;
      if (preset === 'reset') { active = CORE_CONSTRAINTS.map(function (item) { return item.id; }); picked = ['A', 'B']; }
      else picked = preset === 'all' ? active.slice() : preset === 'x' ? ['A', 'B'] : ['C', 'D'];
      announce(root, '#d2l-core-status', sync());
    }); });
    sync(); observe(svg, draw);
  });

  boot('day2-preferences', function (root) {
    const state = {capCm: 120, robotCm: 60, marginCm: 10, desiredCm: 110, strategy: 'desired'};
    const fieldNames = {capCm: 'cap', robotCm: 'robot', marginCm: 'margin', desiredCm: 'desired'};
    const labels = {capCm: '空间上限', robotCm: '机器人宽度', marginCm: '每侧余量', desiredCm: '期望门宽'};
    const svg = q(root, '.d2l-pref-plot');
    function draw() {
      const result = evaluateCandidates(state), ctx = svgContext(svg, 162), left = 25, right = ctx.width - 25;
      const project = function (cm) { return left + (cm - 60) / 80 * (right - left); };
      const clip = function (cm) { return project(Math.max(60, Math.min(140, cm))); };
      ctx.text(12, 17, '圆点：合法候选；×：违反硬条件', {class: 'd2l-plot-muted'});
      if (result.minimumCm <= state.capCm) ctx.line(clip(result.minimumCm), 64, clip(state.capCm), 64, {stroke: 'var(--viz-series-1)', 'stroke-width': 6, 'stroke-linecap': 'round'});
      else ctx.cross(clip((result.minimumCm + state.capCm) / 2), 64, 'var(--destructive)', 6);
      ctx.line(left, 106, right, 106, {stroke: 'var(--muted-foreground)'});
      const desiredX = project(state.desiredCm);
      if (state.strategy === 'desired') {
        ctx.line(desiredX, 42, desiredX, 119, {stroke: 'var(--viz-series-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4'});
        ctx.text(desiredX, 37, '期望值', {'text-anchor': state.desiredCm > 120 ? 'end' : state.desiredCm < 80 ? 'start' : 'middle', class: 'd2l-plot-label'});
      }
      result.candidates.forEach(function (candidate, index) {
        const x = project(candidate.cm);
        if (candidate.feasible) ctx.add('circle', {cx: x, cy: 106, r: 5, fill: 'var(--viz-series-1)'});
        else ctx.cross(x, 106, 'var(--muted-foreground)', 4);
        if (result.selected && candidate.cm === result.selected.cm) ctx.add('circle', {cx: x, cy: 106, r: 9, fill: 'none', stroke: 'var(--viz-series-1)', 'stroke-width': 2.5});
        if (ctx.width >= 400 || index % 2 === 0) ctx.text(x, 131, (candidate.cm / 100).toFixed(1), {'text-anchor': 'middle', class: 'd2l-plot-muted'});
      });
      ctx.text(ctx.width - 12, 154, '门宽 D（m）', {'text-anchor': 'end', class: 'd2l-plot-muted'});
    }
    function sync() {
      Object.keys(fieldNames).forEach(function (key) { q(root, '#d2l-pref-' + fieldNames[key]).value = state[key]; setText(root, '#d2l-pref-' + fieldNames[key] + '-value', metres(state[key])); });
      root.querySelectorAll('[data-d2l-pref-strategy]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2lPrefStrategy === state.strategy)); });
      const result = evaluateCandidates(state);
      setText(root, '#d2l-pref-formula', '硬条件：D ≥ ' + (state.robotCm / 100).toFixed(2) + ' + 2 × ' + (state.marginCm / 100).toFixed(2) + ' = ' + (result.minimumCm / 100).toFixed(2) + '；D ≤ ' + (state.capCm / 100).toFixed(2) + '（m）');
      setText(root, '#d2l-pref-objective', state.strategy === 'desired' ? '在合法候选中，最小化 |D − 期望门宽|；距离相同时选较小门宽。' : '已把可让步的“接近期望值”偏好退让为“门宽较小优先”。硬条件继续全部保留。');
      const candidates = q(root, '#d2l-pref-candidates'); candidates.replaceChildren();
      result.candidates.forEach(function (candidate) {
        const selected = Boolean(result.selected && candidate.cm === result.selected.cm);
        const item = document.createElement('div'); item.className = 'd2l-candidate'; item.dataset.feasible = String(candidate.feasible); item.dataset.selected = String(selected);
        const heading = document.createElement('strong'); heading.textContent = metres(candidate.cm) + (selected ? ' · 首选' : ''); item.appendChild(heading);
        const detail = document.createElement('span');
        if (candidate.feasible) detail.textContent = state.strategy === 'desired' ? '合法 · 偏差 ' + metres(candidate.cost) : '合法 · 按门宽排序';
        else detail.textContent = (candidate.belowMinimum ? '低于必要净宽' : '') + (candidate.belowMinimum && candidate.aboveCapacity ? '；' : '') + (candidate.aboveCapacity ? '超过空间上限' : '');
        item.appendChild(detail); candidates.appendChild(item);
      });
      setText(root, '#d2l-pref-feasible', result.feasible.length + ' / ' + result.candidates.length + ' 个候选');
      badge(root, '#d2l-pref-badge', result.sat ? '有限域中有解' : '有限域中无解', result.sat ? 'sat' : 'unsat');
      const message = result.selected ? '按当前偏好选择 D = ' + metres(result.selected.cm) + '。其他合法候选仍是满足硬条件的方案。' : '九个候选都不满足硬条件。只调整期望门宽或更换排序，仍不会产生满足这些条件的候选。';
      setText(root, '#d2l-pref-result', message); draw(); return message;
    }
    Object.keys(fieldNames).forEach(function (key) {
      const input = q(root, '#d2l-pref-' + fieldNames[key]);
      input.addEventListener('input', function () {
        state[key] = Number(input.value); setText(root, '#d2l-pref-change', key === 'desiredCm' ? '只修改偏好“期望门宽”；硬条件没有改变。' : '已修改硬条件相关输入“' + labels[key] + '”，按新输入重新检查。'); sync();
      });
      input.addEventListener('change', function () { announce(root, '#d2l-pref-status', labels[key] + '改为' + metres(state[key]) + '。' + sync()); });
    });
    root.querySelectorAll('[data-d2l-pref-strategy]').forEach(function (button) { button.addEventListener('click', function () {
      state.strategy = button.dataset.d2lPrefStrategy;
      setText(root, '#d2l-pref-change', '仅切换允许让步的偏好排序；机器人宽度、余量和空间上限全部保留。'); announce(root, '#d2l-pref-status', sync());
    }); });
    root.querySelectorAll('[data-d2l-pref-preset]').forEach(function (button) { button.addEventListener('click', function () {
      if (button.dataset.d2lPrefPreset === 'conflict') Object.assign(state, {capCm: 70, robotCm: 70, marginCm: 10, desiredCm: 110, strategy: 'desired'});
      else Object.assign(state, {capCm: 120, robotCm: 60, marginCm: 10, desiredCm: 110, strategy: 'desired'});
      setText(root, '#d2l-pref-change', '载入教学预设：空间上限、机器人宽度、余量与期望值均已按界面数值更新。'); announce(root, '#d2l-pref-status', sync());
    }); });
    sync(); observe(svg, draw);
  });
})();
