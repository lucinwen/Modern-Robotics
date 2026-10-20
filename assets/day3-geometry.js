(function () {
  'use strict';

  // Restricted analytic teaching models. These functions do not call a robot,
  // a generic motion planner, or a PDDL solver. Each length uses one consistent unit.
  function clearance(door, body, margin, center) {
    if (![door, body, margin, center].every(Number.isFinite) || door <= 0 || body <= 0 || margin < 0) throw new RangeError('Positive finite door/body sizes and nonnegative margin required.');
    const radius = body / 2, low = -door / 2 + radius + margin, high = door / 2 - radius - margin;
    const leftGap = center - radius + door / 2, rightGap = door / 2 - center - radius;
    return {low: low, high: high, requiredWidth: body + 2 * margin, possible: low <= high, current: low <= high && center >= low && center <= high, leftGap: leftGap, rightGap: rightGap, bodyClear: leftGap >= 0 && rightGap >= 0};
  }
  function pointSegmentDistance(point, start, end) {
    if (![point, start, end].every(function (p) { return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite); })) throw new RangeError('Finite 2D points required.');
    const dx = end[0] - start[0], dy = end[1] - start[1], length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length2));
    const closest = [start[0] + t * dx, start[1] + t * dy];
    return {distance: Math.hypot(point[0] - closest[0], point[1] - closest[1]), closest: closest, t: t};
  }
  function checkPolyline(points, obstacle, bodyRadius, margin) {
    if (!Array.isArray(points) || points.length < 2 || !obstacle || !Number.isFinite(obstacle.radius) || obstacle.radius <= 0 || ![bodyRadius, margin].every(Number.isFinite) || bodyRadius <= 0 || margin < 0) throw new RangeError('A polyline, circular obstacle, positive body radius and nonnegative margin are required.');
    const threshold = obstacle.radius + bodyRadius + margin;
    const segments = points.slice(1).map(function (end, i) {
      const result = pointSegmentDistance(obstacle.center, points[i], end);
      return Object.assign(result, {start: points[i], end: end, pass: result.distance >= threshold});
    });
    const closest = segments.reduce(function (best, item) { return item.distance < best.distance ? item : best; });
    const startDistance = Math.hypot(points[0][0] - obstacle.center[0], points[0][1] - obstacle.center[1]);
    const last = points[points.length - 1], endDistance = Math.hypot(last[0] - obstacle.center[0], last[1] - obstacle.center[1]);
    return {segments: segments, minimum: closest.distance, closest: closest.closest, threshold: threshold, pass: segments.every(function (s) { return s.pass; }), endpointsPass: startDistance >= threshold && endDistance >= threshold};
  }
  function planarReach(l1, l2, x, height, baseHeight) {
    if (![l1, l2, x, height, baseHeight].every(Number.isFinite) || l1 <= 0 || l2 <= 0) throw new RangeError('Finite coordinates and positive link lengths required.');
    const y = height - baseHeight, r2 = x * x + y * y, inner = Math.abs(l1 - l2), outer = l1 + l2;
    const reachable = r2 >= inner * inner && r2 <= outer * outer;
    const result = {reachable: reachable, distance: Math.sqrt(r2), inner: inner, outer: outer, reason: r2 > outer * outer ? 'too_far' : r2 < inner * inner ? 'too_close' : 'position_reachable', coincident: r2 === inner * inner || r2 === outer * outer, solutions: []};
    if (!reachable) return result;
    const c2 = Math.max(-1, Math.min(1, (r2 - l1 * l1 - l2 * l2) / (2 * l1 * l2)));
    [1, -1].forEach(function (sign) {
      const q2 = sign * Math.acos(c2);
      const q1 = r2 === 0 ? 0 : Math.atan2(y, x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
      const elbow = [l1 * Math.cos(q1), baseHeight + l1 * Math.sin(q1)];
      const end = [elbow[0] + l2 * Math.cos(q1 + q2), elbow[1] + l2 * Math.sin(q1 + q2)];
      result.solutions.push({q1: q1, q2: q2, elbow: elbow, end: end});
    });
    return result;
  }
  function feedbackCase(mode, revision) {
    if (!['standard', 'missing_key', 'narrow', 'high'].includes(mode) || ![1, 2].includes(revision)) throw new RangeError('Unknown teaching case or world version.');
    if (revision === 2 && !['narrow', 'high'].includes(mode)) throw new RangeError('This case has no geometry amendment.');
    const world = {version: revision, hasKey: mode !== 'missing_key', door: mode === 'narrow' && revision === 1 ? 50 : 90, body: 60, margin: 10, x: mode === 'high' ? 60 : 50, height: mode === 'high' && revision === 1 ? 170 : 110};
    const opening = clearance(world.door, world.body, world.margin, 0), reach = planarReach(55, 45, world.x, world.height, 70);
    const symbolic = world.hasKey;
    let failure = null;
    if (!symbolic) failure = {kind: 'symbolic', object: 'k', action: 'unlock(r,d,k,a)', condition: 'has-key(r,k)', scope: '当前初态缺少钥匙，且四动作域没有获取钥匙或其他通道。'};
    else if (!reach.reachable) failure = {kind: 'geometry', object: 'handle(d)', action: 'open(r,d,a)', condition: '0.10 ≤ r ≤ 1.00 m', scope: '二维两杆长度为 0.55 / 0.45 m，固定基座高 0.70 m，忽略限位和碰撞的末端点模型。'};
    else if (!opening.possible) failure = {kind: 'geometry', object: 'd', action: 'move(r,a,b,d)', condition: 'd ≥ b + 2s', scope: '直径 0.60 m 的圆盘，固定直门缝，每侧余量 0.10 m。'};
    return {world: world, symbolic: symbolic, opening: opening, reach: reach, failure: failure, passed: symbolic && !failure, plan: symbolic ? ['unlock(r,d,k,a)', 'open(r,d,a)', 'move(r,a,b,d)', 'pickup(r,cup,b)'] : []};
  }
  const api = {clearance: clearance, pointSegmentDistance: pointSegmentDistance, checkPolyline: checkPolyline, planarReach: planarReach, feedbackCase: feedbackCase};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const NS = 'http://www.w3.org/2000/svg';
  function meters(value) { return (value / 100).toFixed(2); }
  function setText(root, selector, text) { const node = root.querySelector(selector); if (node) node.textContent = text; }
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function resetSvg(svg) { Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); }); }
  function scene(svg, bounds) {
    resetSvg(svg);
    const width = Math.max(230, svg.getBoundingClientRect().width || 330), height = svg.getBoundingClientRect().height || 330;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const scale = Math.min((width - 44) / (bounds[2] - bounds[0]), (height - 48) / (bounds[3] - bounds[1]));
    const left = (width - (bounds[2] - bounds[0]) * scale) / 2, top = (height - (bounds[3] - bounds[1]) * scale) / 2;
    function project(p) { return [left + (p[0] - bounds[0]) * scale, top + (bounds[3] - p[1]) * scale]; }
    function node(tag, attrs, text) { const item = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(function (pair) { item.setAttribute(pair[0], String(pair[1])); }); if (text !== undefined) item.textContent = text; svg.appendChild(item); return item; }
    function line(a, b, attrs) { const p = project(a), q = project(b); return node('line', Object.assign({x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: 'var(--border)', 'stroke-width': 1}, attrs || {})); }
    function circle(center, radius, attrs) { const p = project(center); return node('circle', Object.assign({cx: p[0], cy: p[1], r: Math.max(0, radius * scale)}, attrs || {})); }
    function label(p, text, dx, dy, anchor, cls) { const point = project(p); return node('text', {x: point[0] + (dx || 0), y: point[1] + (dy || 0), 'text-anchor': anchor || 'start', class: cls || 'd3g-direct-label'}, text); }
    return {width: width, height: height, scale: scale, project: project, node: node, line: line, circle: circle, label: label};
  }
  function row(list, name, explanation, truth, yes, no) {
    const li = element('li'), description = element('div'); li.dataset.truth = truth === null ? 'unknown' : String(truth);
    description.append(element('strong', '', name), element('small', '', explanation));
    li.append(description, element('span', 'd3g-truth-word', truth === null ? '输入' : truth ? yes || '成立' : no || '不成立')); list.appendChild(li);
  }
  function bindRange(root, id, key, state, render) {
    const input = root.querySelector('#' + id);
    input.addEventListener('input', function () { state[key] = Number(input.value); render(false); });
    input.addEventListener('change', function () { render(true); });
  }
  function rangeText(root, id, value) {
    const input = root.querySelector('#' + id); input.value = value; input.setAttribute('aria-valuetext', meters(value) + ' 米');
    setText(root, '#' + id + '-value', meters(value) + ' m');
  }
  function observe(root, callback) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(callback).observe(root);
    else window.addEventListener('resize', callback);
  }
  function ready(id) { const root = document.getElementById(id); if (!root || root.dataset.d3gReady === 'true') return null; root.dataset.d3gReady = 'true'; return root; }

  function initClearance(root) {
    const state = {door: 90, body: 60, margin: 10, offset: 0}, svg = root.querySelector('.d3g-clearance-scene');
    const presets = {aligned: {door: 90, body: 60, margin: 10, offset: 0}, offcenter: {door: 90, body: 60, margin: 10, offset: 20}, narrow: {door: 50, body: 60, margin: 10, offset: 0}, touch: {door: 60, body: 60, margin: 0, offset: 0}};
    function draw(result) {
      const d = scene(svg, [-145, -125, 145, 125]), wall = {stroke: 'var(--foreground)', 'stroke-width': 8, 'stroke-linecap': 'butt'};
      d.line([-140, 0], [-state.door / 2, 0], wall); d.line([state.door / 2, 0], [140, 0], wall);
      d.label([-120, -100], '房间 A', 0, 0, 'start', 'd3g-large-label'); d.label([-120, 100], '房间 B', 0, 0, 'start', 'd3g-large-label');
      d.line([state.offset, -110], [state.offset, 110], {stroke: result.current ? 'var(--viz-series-1)' : 'var(--destructive)', 'stroke-width': 1.8, 'stroke-dasharray': '5 4'});
      d.circle([state.offset, 0], state.body / 2 + state.margin, {fill: 'none', stroke: 'var(--viz-series-2)', 'stroke-width': 1.7, 'stroke-dasharray': '5 3'});
      d.circle([state.offset, 0], state.body / 2, {fill: 'var(--viz-series-3)', 'fill-opacity': .16, stroke: result.bodyClear ? 'var(--viz-series-3)' : 'var(--destructive)', 'stroke-width': 2});
      if (result.possible) {
        d.line([result.low, 0], [result.high, 0], {stroke: 'var(--viz-series-1)', 'stroke-width': 7, 'stroke-linecap': 'round'});
        [result.low, result.high].forEach(function (x) { d.circle([x, 0], 2.2, {fill: 'var(--viz-series-1)'}); });
      }
      d.circle([state.offset, 0], 3.4, {fill: result.current ? 'var(--viz-series-3)' : 'var(--destructive)', stroke: 'var(--page)', 'stroke-width': 1});
      const y = -84;
      d.line([-state.door / 2, y], [state.door / 2, y], {stroke: 'var(--muted-foreground)', 'stroke-width': 1});
      [-state.door / 2, state.door / 2].forEach(function (x) { d.line([x, y - 4], [x, y + 4], {stroke: 'var(--muted-foreground)'}); });
      d.label([0, y], '门净宽 ' + meters(state.door) + ' m', 0, 19, 'middle');
      d.label([state.offset, 0], '中心', 0, -10, 'middle');
      d.node('text', {x: d.width / 2, y: d.height - 10, 'text-anchor': 'middle', class: 'd3g-small-label'}, '左右是沿门方向；上下是穿门方向');
    }
    function render(announce) {
      const result = clearance(state.door, state.body, state.margin, state.offset), list = root.querySelector('#d3g-clearance-checks'); list.replaceChildren();
      ['door', 'body', 'margin', 'offset'].forEach(function (key) { rangeText(root, 'd3g-clearance-' + key, state[key]); });
      row(list, '① 是否存在允许的穿门中心？', meters(state.door) + ' ≥ ' + meters(state.body) + ' + 2×' + meters(state.margin) + ' m', result.possible, '有', '没有');
      row(list, '② 当前中心是否在区间内？', result.possible ? 'c = ' + meters(state.offset) + ' m；允许 [' + meters(result.low) + ', ' + meters(result.high) + '] m' : '允许中心区间为空，调整中心无法补足宽度。', result.current, '在', '不在');
      row(list, '③ 当前身体与门边的间隙', '左 ' + meters(result.leftGap) + ' m；右 ' + meters(result.rightGap) + ' m；每侧要求 ' + meters(state.margin) + ' m', result.current, '均足够', '有不足');
      let explanation;
      if (!result.possible) explanation = '门洞本身容不下“圆盘直径 + 两侧余量”。在这个固定门缝模型中，换中心线也不够；需要改变已允许修改的尺寸或选择其他通道。';
      else if (!result.current) explanation = result.bodyClear ? '这个中心的身体没有伸进墙里，但至少一侧余量不足。门内存在合格的中心位置，把中心移回绿色区间再检查。' : '门内存在允许中心，但当前中心太偏，身体已伸入门边。这个候选失败，不能据此宣布整扇门都无法通过。';
      else if (state.margin === 0 && result.low === result.high) explanation = '在允许贴边、没有额外余量的数学约定下，只有正中央这一条中心线满足条件。这里只给出截面几何结论。';
      else explanation = '当前中心和要求的两侧余量都合格。这一步还没有验证门扇、转弯、整条路径与实际运动。';
      const verdict = result.current ? '当前门截面检查通过' : result.possible ? '可以选到合格中心；当前中心不合格' : '当前尺寸下没有允许中心';
      setText(root, '#d3g-clearance-result', verdict); root.querySelector('#d3g-clearance-result').dataset.outcome = result.current ? 'pass' : 'fail';
      setText(root, '#d3g-clearance-explanation', explanation); draw(result);
      setText(root, '#d3g-clearance-desc', '门宽 ' + meters(state.door) + ' 米，圆盘直径 ' + meters(state.body) + ' 米，每侧余量 ' + meters(state.margin) + ' 米，中心偏移 ' + meters(state.offset) + ' 米。' + verdict + '。' + explanation);
      if (announce) setText(root, '#d3g-clearance-live', verdict + '。' + explanation);
    }
    ['door', 'body', 'margin', 'offset'].forEach(function (key) { bindRange(root, 'd3g-clearance-' + key, key, state, render); });
    root.querySelectorAll('[data-d3g-clearance]').forEach(function (button) { button.addEventListener('click', function () { Object.assign(state, presets[button.dataset.d3gClearance]); render(true); }); });
    render(false); observe(svg, function () { draw(clearance(state.door, state.body, state.margin, state.offset)); });

    const pathSvg = root.querySelector('.d3g-path-scene'), obstacle = {center: [0, 0], radius: 35};
    // Integer centimeters keep the declared 35 + 20 + 5 cm threshold exact.
    const paths = {straight: [[-120, 0], [120, 0]], detour: [[-120, 0], [-65, 85], [65, 85], [120, 0]]}; let pathMode = 'straight';
    function drawPath(announce) {
      const points = paths[pathMode], result = checkPolyline(points, obstacle, 20, 5), d = scene(pathSvg, [-155, -65, 155, 120]);
      d.circle([0, 0], result.threshold, {fill: 'var(--destructive)', 'fill-opacity': .04, stroke: 'var(--destructive)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4'});
      d.circle([0, 0], obstacle.radius, {fill: 'var(--muted-foreground)', 'fill-opacity': .3, stroke: 'var(--muted-foreground)', 'stroke-width': 2});
      result.segments.forEach(function (segment) { d.line(segment.start, segment.end, {stroke: segment.pass ? 'var(--viz-series-1)' : 'var(--destructive)', 'stroke-width': 3}); });
      d.line([0, 0], result.closest, {stroke: 'var(--viz-series-2)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3'});
      [points[0], points[points.length - 1]].forEach(function (point, i) { d.circle(point, 20, {fill: 'var(--viz-series-3)', 'fill-opacity': .13, stroke: 'var(--viz-series-3)', 'stroke-width': 2}); d.circle(point, 2.5, {fill: 'var(--viz-series-3)'}); d.label(point, i ? '终点' : '起点', 0, 35, 'middle'); });
      points.slice(1, -1).forEach(function (point) { d.circle(point, 3.5, {fill: 'var(--viz-series-1)'}); });
      d.label([0, 0], '障碍', 0, 4, 'middle'); d.label([0, 112], '虚线圈：机器人中心需要避开的范围', 0, 0, 'middle', 'd3g-small-label');
      d.node('text', {x: d.width / 2, y: d.height - 9, 'text-anchor': 'middle', class: 'd3g-small-label'}, '中心距阈值 = 障碍半径 + 身体半径 + 余量');
      root.querySelectorAll('[data-d3g-path]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d3gPath === pathMode)); });
      const verdict = result.pass ? '这条给定折线的全部线段通过该圆障碍检查' : '起终点通过，但直线路径中间被拒绝';
      setText(root, '#d3g-path-result', verdict); root.querySelector('#d3g-path-result').dataset.outcome = result.pass ? 'pass' : 'fail';
      const explanation = '沿整条路径的最小中心距为 ' + (result.minimum / 100).toFixed(3) + ' m，要求至少 ' + meters(result.threshold) + ' m。' + (result.pass ? '这是一条符合本例单障碍几何要求的路径见证；仍没有物理执行记录。' : '两个端点都在允许区域，不保证连接它们的每一段也在允许区域。可以换一条候选路径继续检查。');
      setText(root, '#d3g-path-explanation', explanation); setText(root, '#d3g-path-desc', verdict + '。' + explanation);
      if (announce) setText(root, '#d3g-clearance-live', verdict + '。' + explanation);
    }
    root.querySelectorAll('[data-d3g-path]').forEach(function (button) { button.addEventListener('click', function () { pathMode = button.dataset.d3gPath; drawPath(true); }); });
    drawPath(false); observe(pathSvg, function () { drawPath(false); });
  }

  function initReach(root) {
    const state = {x: 50, height: 110, elbow: 0}, svg = root.querySelector('.d3g-reach-scene');
    const presets = {reachable: {x: 50, height: 110}, high: {x: 60, height: 170}, close: {x: 5, height: 70}, edge: {x: 100, height: 70}};
    function draw(result) {
      const d = scene(svg, [-108, -35, 153, 235]), base = [0, 70], target = [state.x, state.height];
      d.circle(base, 100, {fill: 'var(--viz-series-1)', 'fill-opacity': .10, stroke: 'var(--viz-series-1)', 'stroke-width': 1.5});
      d.circle(base, 10, {fill: 'var(--page)', stroke: 'var(--viz-series-1)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2'});
      d.line([-105, 0], [148, 0], {stroke: 'var(--muted-foreground)', 'stroke-width': 1, 'stroke-dasharray': '4 3'});
      d.label([148, 0], '高度参考 0 m', 0, 17, 'end', 'd3g-small-label');
      d.line(base, target, {stroke: result.reachable ? 'var(--viz-series-2)' : 'var(--destructive)', 'stroke-width': 1.4, 'stroke-dasharray': '4 3'});
      if (result.reachable) {
        [1 - state.elbow, state.elbow].forEach(function (index) {
          const selected = index === state.elbow, solution = result.solutions[index], style = {stroke: selected ? 'var(--viz-series-3)' : 'var(--muted-foreground)', 'stroke-width': selected ? 5 : 2, 'stroke-linecap': 'round', 'stroke-dasharray': selected ? 'none' : '5 4', 'stroke-opacity': selected ? 1 : .65};
          d.line(base, solution.elbow, style); d.line(solution.elbow, target, style);
          d.circle(solution.elbow, selected ? 4 : 2.5, {fill: selected ? 'var(--viz-series-3)' : 'var(--muted-foreground)', stroke: 'var(--page)', 'stroke-width': 1});
        });
      }
      d.circle(base, 5, {fill: 'var(--foreground)', stroke: 'var(--page)', 'stroke-width': 1.5});
      d.circle(target, 4.5, {fill: result.reachable ? 'var(--viz-series-2)' : 'var(--destructive)', stroke: 'var(--page)', 'stroke-width': 1.5});
      d.line([state.x - 8, state.height], [state.x + 8, state.height], {stroke: result.reachable ? 'var(--viz-series-2)' : 'var(--destructive)', 'stroke-width': 1.2});
      d.line([state.x, state.height - 8], [state.x, state.height + 8], {stroke: result.reachable ? 'var(--viz-series-2)' : 'var(--destructive)', 'stroke-width': 1.2});
      d.label(base, '基座', -10, -11, 'end'); d.label(target, '把手', state.x > 100 ? -9 : 9, state.height > 190 ? 19 : -10, state.x > 100 ? 'end' : 'start');
      d.label([-94, 145], '点可达环带', 0, 0, 'start', 'd3g-small-label');
      d.node('text', {x: 12, y: 19, class: 'd3g-small-label'}, '基座 0.70 m · 仅位置检查');
      d.node('text', {x: d.width / 2, y: d.height - 8, 'text-anchor': 'middle', class: 'd3g-small-label'}, '0.55 m 第一杆 + 0.45 m 第二杆');
    }
    function render(announce) {
      const result = planarReach(55, 45, state.x, state.height, 70), list = root.querySelector('#d3g-reach-checks'); list.replaceChildren();
      rangeText(root, 'd3g-reach-x', state.x); rangeText(root, 'd3g-reach-height', state.height);
      row(list, '目标距离要从基座算起', '水平 ' + meters(state.x) + ' m；竖直差 ' + meters(state.height - 70) + ' m；距离 r = ' + meters(result.distance) + ' m', null);
      row(list, '最远能到 1.00 m', 'r = ' + meters(result.distance) + ' m ≤ 1.00 m', result.distance <= 100);
      row(list, '最近只能折到 0.10 m', 'r = ' + meters(result.distance) + ' m ≥ 0.10 m', result.distance >= 10);
      let explanation;
      if (result.reason === 'too_far') explanation = '目标离基座超过两杆长度之和，即使完全伸直也够不到。这个模型中的末端位置要求已被解析条件排除；符号 open 动作本身不会自动改变连杆长度。';
      else if (result.reason === 'too_close') explanation = '两杆长度不同，尽量折回后仍有 0.10 m 的距离。这个目标落在环带中间的空洞；“越近越容易”在此模型里不成立。';
      else explanation = '解析计算找到了让末端点落到目标的关节姿态。换一个肘形再看：同一位置可能有不同姿态，而碰撞、末端朝向和开门过程仍需另外检查。';
      const verdict = result.reachable ? '此二维模型存在末端位置解' : '此二维模型不存在该末端位置解';
      setText(root, '#d3g-reach-result', verdict); root.querySelector('#d3g-reach-result').dataset.outcome = result.reachable ? 'pass' : 'fail';
      setText(root, '#d3g-reach-explanation', explanation);
      setText(root, '#d3g-reach-branches', result.reachable ? result.coincident ? '目标处在伸直或折叠边界，两支肘形在几何上重合。' : '实线为当前选择的肘形，细虚线为另一支解析肘形。这里只画位置解。' : '没有目标位置解，因此不绘制虚构的到达姿态。');
      root.querySelectorAll('[data-d3g-elbow]').forEach(function (button) { button.disabled = !result.reachable; button.setAttribute('aria-pressed', String(Number(button.dataset.d3gElbow) === state.elbow)); });
      draw(result); setText(root, '#d3g-reach-desc', verdict + '。目标水平距离 ' + meters(state.x) + ' 米，高度 ' + meters(state.height) + ' 米。' + explanation);
      if (announce) setText(root, '#d3g-reach-live', verdict + '。' + explanation);
    }
    bindRange(root, 'd3g-reach-x', 'x', state, render); bindRange(root, 'd3g-reach-height', 'height', state, render);
    root.querySelectorAll('[data-d3g-reach]').forEach(function (button) { button.addEventListener('click', function () { Object.assign(state, presets[button.dataset.d3gReach]); render(true); }); });
    root.querySelectorAll('[data-d3g-elbow]').forEach(function (button) { button.addEventListener('click', function () { state.elbow = Number(button.dataset.d3gElbow); render(true); }); });
    render(false); observe(svg, function () { draw(planarReach(55, 45, state.x, state.height, 70)); });
  }

  function initFeedback(root) {
    const state = {mode: 'standard', revision: 1, step: 0};
    const stepNames = ['明确输入', '符号候选', '连续条件', '反馈证据', '下一步决定', '执行边界'];
    function fact(host, name, value) { const node = element('div'); node.append(element('dt', '', name), element('dd', '', value)); host.appendChild(node); }
    function evidence(host, code, detail) { if (code) host.appendChild(element('code', '', code)); if (detail) host.appendChild(element('p', '', detail)); }
    function render(announce) {
      const selected = feedbackCase(state.mode, state.revision), world = selected.world, failure = selected.failure;
      root.querySelectorAll('[data-d3g-feedback]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d3gFeedback === state.mode)); });
      setText(root, '#d3g-feedback-version', '输入世界 v' + state.revision + (state.revision === 2 ? ' · 已修改几何输入' : ' · 原始输入'));
      const inputs = root.querySelector('#d3g-feedback-inputs'); inputs.replaceChildren();
      fact(inputs, '钥匙', world.hasKey ? '物品栏有 k，不占抓杯子的手' : '初态没有 k，域内也无获取钥匙动作');
      fact(inputs, '动作能力', 'unlock / open / move / pickup 均已声明');
      fact(inputs, '门与圆盘', '净宽 ' + meters(world.door) + ' m；直径 ' + meters(world.body) + ' m；每侧余量 ' + meters(world.margin) + ' m');
      fact(inputs, '把手位置', '水平 ' + meters(world.x) + ' m；高 ' + meters(world.height) + ' m；基座高 0.70 m');
      const stageInfo = [
        ['pass', '已列出'],
        [selected.symbolic ? 'pass' : 'fail', selected.symbolic ? '四步候选' : '当前域无计划'],
        [!selected.symbolic ? 'skipped' : selected.passed ? 'pass' : 'fail', !selected.symbolic ? '未进入' : selected.passed ? '两项通过' : '几何拒绝'],
        [failure ? 'fail' : 'pass', failure ? '保留对象与条件' : '保留检查范围'],
        [selected.passed ? 'pass' : 'pending', selected.passed ? '继续后续验证' : '需要明确改动'],
        ['pending', '未做物理执行']
      ];
      const stages = root.querySelector('#d3g-feedback-stages'); stages.replaceChildren();
      stepNames.forEach(function (name, i) {
        const node = element('li'); node.dataset.state = i <= state.step ? stageInfo[i][0] : 'pending';
        if (i === state.step) node.setAttribute('aria-current', 'step');
        node.append(element('span', 'd3g-stage-number', String(i + 1).padStart(2, '0')), element('strong', '', name), element('span', 'd3g-stage-status', i <= state.step ? stageInfo[i][1] : '尚未查看')); stages.appendChild(node);
      });
      setText(root, '#d3g-feedback-step-label', '第 ' + (state.step + 1) + ' / 6 步 · 世界 v' + state.revision);
      const host = root.querySelector('#d3g-feedback-evidence'); host.replaceChildren();
      let title, description;
      if (state.step === 0) {
        title = '先固定同一个问题，再讨论能否完成';
        description = '目标是 holding(r,cup)。初态没有已解锁或已开门的隐藏前提；几何尺寸与符号事实分别列出。这里的图和参数表示输入，尚未执行任何动作。';
        evidence(host, 'at(r,a) · item-at(cup,b) · locked(d) · handempty(r)\ngoal: holding(r,cup)', '钥匙、能力和几何条件都会影响下一层能给出什么证据。');
      } else if (state.step === 1) {
        title = selected.symbolic ? '按固定四动作规则得到一个候选序列' : '缺少第一步需要的事实，当前域到不了目标';
        description = selected.symbolic ? 'unlock 把锁解除，open 才把门打开，move 改变机器人所在房间，pickup 才实现持杯目标。此时只是符号候选，还没有让机械臂或身体动起来。' : 'unlock 需要 has-key(r,k)，而初态没有这条事实。当前域没有取钥匙、调用人类或其他通道，因此在这个有限域中没有可达的目标状态。';
        evidence(host, selected.symbolic ? selected.plan.join('\n→ ') : '缺失前置：has-key(r,k)\n当前动作域：unlock / open / move / pickup', selected.symbolic ? '本组件按固定规则推演；真正 PDDL 解析与搜索的输出见配套实验记录。' : '这里的无计划结论只针对已声明的初态和动作集合。');
      } else if (state.step === 2) {
        title = !selected.symbolic ? '没有符号候选，尚未进入几何细化' : selected.passed ? '两项明确的几何条件通过' : '符号步骤需要的几何条件被拒绝';
        description = !selected.symbolic ? '钥匙问题已经阻断当前符号域。不能把没有检查的运动条件标成“运动通过”，也不能靠加宽门洞补出 has-key 事实。' : selected.passed ? '先检查 open 所需的末端点位置，再检查 move 穿门时的圆盘净宽。通过的是这两项受限几何条件；完整开门与抓取运动仍未验证。' : failure.object === 'handle(d)' ? 'open 的目标把手落在平面两杆可达环带之外，末端点都到不了。此时不会假装已经打开门、再继续移动与拿杯。' : '把手点位置检查通过，但 move 所需的通道中心区间为空。圆盘直径加两侧余量超过门洞净宽。';
        if (selected.symbolic) {
          evidence(host, 'open：r = ' + meters(selected.reach.distance) + ' m；要求 0.10 ≤ r ≤ 1.00 m', selected.reach.reachable ? '末端点位置条件通过。' : '末端点位置条件拒绝。');
          if (selected.reach.reachable) evidence(host, 'move：' + meters(world.door) + ' ≥ ' + meters(world.body) + ' + 2×' + meters(world.margin) + ' m', selected.opening.possible ? '圆盘门截面条件通过。' : '圆盘门截面条件拒绝。');
        }
      } else if (state.step === 3) {
        title = failure ? '把失败对象、动作、条件和世界版本一起返回' : '通过也要说明究竟检查了哪些条件';
        description = failure ? '反馈中保留可定位的信息，上层才知道该核查状态、换动作候选，还是提出几何修订。只有一个“失败”字符串，很容易把错误原因归到别处。' : '没有发现这两项几何冲突，不等于已经拥有所有动作的无碰撞轨迹。还需要检查开门、移动、抓取的完整路径和执行条件。';
        evidence(host, failure ? 'world_version: v' + state.revision + '\nobject: ' + failure.object + '\naction: ' + failure.action + '\ncondition: ' + failure.condition : 'world_version: v' + state.revision + '\nchecked: planar_endpoint_reach, disk_door_clearance\nphysics_execution: not_checked', failure ? failure.scope : '已通过条件之外，机器人模型、碰撞、抓取和控制仍有待验证。');
      } else if (state.step === 4) {
        title = selected.passed ? '继续补齐运动与执行验证' : selected.symbolic ? '确定要换候选，还是要改几何输入' : '先解决状态或动作域的缺口';
        description = selected.passed ? '把这个候选交给后续运动生成、碰撞检查、控制与任务成功判定。若后续检查失败，应带着新的失败范围再返回。' : selected.symbolic ? '若已有其他路线或策略，可以保留原需求并重规划。当前例子没有另一个通道或可移动基座动作；扩大门洞或降低把手属于修改输入，下面的按钮会生成 v2 并要求重新检查。' : '当前域没有获取钥匙的动作。需要确认现实中有哪些可用步骤，再显式扩展动作域或修订初态；此演示不会自动补一把钥匙。';
        evidence(host, selected.passed ? '候选 → 完整运动检查 → 执行/仿真 → 目标判定' : '同样的输入 + 同样的动作域 ≠ 自动产生新能力', '单次数值求解失败或规划超时还需要保留“未找到”的限度；不能随意升级为全部连续解都不存在。');
      } else {
        title = '这份演示还没有控制真实机器人';
        description = selected.passed ? '当前世界得到符号候选，且两项受限几何条件通过。完整轨迹、物理交互、感知误差与最终持杯状态尚未验证，所以这里的结果不能写成任务实机成功。' : '当前候选或初态已被前面的条件阻断，尚未进入物理执行。保留当前失败记录，然后对明确的新候选或新输入重新开始检查。';
        evidence(host, 'symbolic_candidate: ' + (selected.symbolic ? 'present' : 'absent') + '\nlimited_geometry: ' + (!selected.symbolic ? 'not_checked' : selected.passed ? 'passed' : 'rejected') + '\nphysical_rollout: not_run\nreal_goal_observation: not_available');
      }
      setText(root, '#d3g-feedback-step-title', title); setText(root, '#d3g-feedback-step-explanation', description);
      root.querySelector('#d3g-feedback-previous').disabled = state.step === 0;
      root.querySelector('#d3g-feedback-next').disabled = state.step === 5; root.querySelector('#d3g-feedback-all').disabled = state.step === 5;
      const canAmend = ['narrow', 'high'].includes(state.mode), revise = root.querySelector('#d3g-feedback-revise');
      revise.disabled = !canAmend || state.revision === 2 || state.step < 4;
      revise.textContent = state.revision === 2 ? '当前已是 v2；请逐步重查' : state.mode === 'narrow' ? '建立 v2：门宽 0.50 → 0.90 m' : state.mode === 'high' ? '建立 v2：把手高 1.70 → 1.10 m' : '此例无几何修订项';
      setText(root, '#d3g-feedback-revision-explanation', !canAmend ? state.mode === 'missing_key' ? '几何修订不能补出钥匙。当前域没有获取钥匙动作，先保留状态层的阻断。' : '当前例子的两项几何检查没有提出修订。继续检查其他运动与执行要求。' : state.revision === 2 ? '只有下述明确尺寸发生了变化，原版的失败继续保留。v2 必须从输入重新检查，不能沿用上一版的判定。' : '先查看到第 5 步，再把明确提出的尺寸修改作为一个新输入版本；该按钮不会声称原世界已经修好。');
      const history = root.querySelector('#d3g-feedback-history'); history.hidden = state.revision !== 2;
      history.textContent = state.mode === 'narrow' ? '保留 v1：门宽 0.50 m，小于圆盘直径 0.60 m + 两侧余量 0.20 m；v2 将门宽改为 0.90 m。' : '保留 v1：把手 (0.60, 1.70) m，离高 0.70 m 基座约 1.17 m，超出两杆总长 1.00 m；v2 把手高度改为 1.10 m。';
      if (announce) setText(root, '#d3g-feedback-live', '世界 v' + state.revision + '，第 ' + (state.step + 1) + ' 步。' + title + '。' + description);
    }
    root.querySelectorAll('[data-d3g-feedback]').forEach(function (button) { button.addEventListener('click', function () { state.mode = button.dataset.d3gFeedback; state.revision = 1; state.step = 0; render(true); }); });
    root.querySelector('#d3g-feedback-previous').addEventListener('click', function () { state.step = Math.max(0, state.step - 1); render(true); });
    root.querySelector('#d3g-feedback-next').addEventListener('click', function () { state.step = Math.min(5, state.step + 1); render(true); });
    root.querySelector('#d3g-feedback-all').addEventListener('click', function () { state.step = 5; render(true); });
    root.querySelector('#d3g-feedback-reset').addEventListener('click', function () { state.revision = 1; state.step = 0; render(true); });
    root.querySelector('#d3g-feedback-revise').addEventListener('click', function () { if (!['narrow', 'high'].includes(state.mode) || state.step < 4 || state.revision !== 1) return; state.revision = 2; state.step = 0; render(true); });
    render(false);
  }
  const clearanceRoot = ready('day3-clearance'), reachRoot = ready('day3-reach'), feedbackRoot = ready('day3-feedback');
  if (clearanceRoot) initClearance(clearanceRoot);
  if (reachRoot) initReach(reachRoot);
  if (feedbackRoot) initFeedback(feedbackRoot);
})();
