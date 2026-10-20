(function () {
  'use strict';
  const L1 = 1;
  const L2 = 0.7;
  const POSITION_TOLERANCE = 0.01;
  const ANGLE_TOLERANCE = Math.PI / 180;
  const TAU = 2 * Math.PI;
  function wrap(angle) { return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function forward(q1, q2) {
    const elbow = [L1 * Math.cos(q1), L1 * Math.sin(q1)];
    return { elbow: elbow, point: [elbow[0] + L2 * Math.cos(q1 + q2), elbow[1] + L2 * Math.sin(q1 + q2)], heading: wrap(q1 + q2) };
  }
  function inverse(x, y) {
    const radius = Math.hypot(x, y);
    if (!Number.isFinite(radius) || radius < Math.abs(L1 - L2) - 1e-10 || radius > L1 + L2 + 1e-10) return [];
    const cosine = Math.max(-1, Math.min(1, (x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const q2 = Math.acos(cosine);
    return [q2, -q2].map(function (angle) {
      return { q1: wrap(Math.atan2(y, x) - Math.atan2(L2 * Math.sin(angle), L1 + L2 * Math.cos(angle))), q2: wrap(angle) };
    });
  }
  function analyze(x, y, q1, q2, desiredHeading) {
    const arm = forward(q1, q2);
    const solutions = inverse(x, y);
    const positionError = Math.hypot(arm.point[0] - x, arm.point[1] - y);
    const headingError = Math.abs(wrap(arm.heading - desiredHeading));
    const exactPositionHeadingExists = solutions.some(function (solution) {
      return Math.abs(wrap(solution.q1 + solution.q2 - desiredHeading)) <= ANGLE_TOLERANCE + 1e-10;
    });
    // For a fixed final-link heading, possible tips lie on a radius-L1 circle
    // centered at L2*[cos(heading), sin(heading)]. Check the heading interval's
    // endpoints and stationary distances, in addition to exact-position IK.
    const bearing = Math.atan2(y, x);
    const headingCandidates = [desiredHeading, desiredHeading - ANGLE_TOLERANCE, desiredHeading + ANGLE_TOLERANCE, bearing, bearing + Math.PI].filter(function (heading) {
      return Math.abs(wrap(heading - desiredHeading)) <= ANGLE_TOLERANCE + 1e-10;
    });
    const minimumPosePositionError = exactPositionHeadingExists ? 0 : Math.min.apply(null, headingCandidates.map(function (heading) {
      return Math.abs(Math.hypot(x - L2 * Math.cos(heading), y - L2 * Math.sin(heading)) - L1);
    }));
    const poseReachable = minimumPosePositionError <= POSITION_TOLERANCE + 1e-10;
    return { arm: arm, solutions: solutions, positionReachable: solutions.length > 0, poseReachable: poseReachable, positionError: positionError, headingError: headingError, positionReached: positionError <= POSITION_TOLERANCE, poseReached: positionError <= POSITION_TOLERANCE && headingError <= ANGLE_TOLERANCE + 1e-10 };
  }
  if (typeof module === 'object' && module.exports) module.exports = { forward: forward, inverse: inverse, analyze: analyze, wrap: wrap, lengths: [L1, L2] };
  if (typeof document === 'undefined') return;
  const root = document.getElementById('mr-workspace');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = root.querySelector('.ws-scene');
  const state = { mode: 'position', x: 1, y: 0.8, q1: 35, q2: 80, phi: 0 };
  const inputs = { x: root.querySelector('#ws-target-x'), y: root.querySelector('#ws-target-y'), q1: root.querySelector('#ws-q1'), q2: root.querySelector('#ws-q2'), phi: root.querySelector('#ws-phi') };
  function radians(angle) { return angle * Math.PI / 180; }
  function degrees(angle) { return angle * 180 / Math.PI; }
  function number(value, precision) { return (Math.abs(value) < Math.pow(10, -precision) / 2 ? 0 : value).toFixed(precision); }
  function sync() {
    Object.keys(inputs).forEach(function (key) {
      inputs[key].value = String(state[key]);
      const value = root.querySelector('#' + inputs[key].id + '-value');
      value.textContent = key === 'x' || key === 'y' ? number(state[key], 2) + ' m' : number(state[key], key === 'phi' ? 0 : 1) + '°';
    });
    root.querySelectorAll('[data-ws-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.wsMode === state.mode)); });
    root.querySelectorAll('[data-ws-pose]').forEach(function (element) { element.hidden = state.mode !== 'pose'; });
    root.querySelector('[data-ws-current-heading]').hidden = state.mode !== 'pose';
  }
  function draw() {
    const result = analyze(state.x, state.y, radians(state.q1), radians(state.q2), radians(state.phi));
    root.dataset.workspaceState = JSON.stringify({ target: [state.x, state.y], tip: result.arm.point, q: [state.q1, state.q2], positionReachable: result.positionReachable, poseReachable: result.poseReachable, positionReached: result.positionReached, poseReached: result.poseReached });
    root.querySelector('#ws-reach-result').textContent = result.positionReachable ? '位于位置可达域内' : (Math.hypot(state.x, state.y) < L1 - L2 ? '位于内圈空隙，够不到' : '超过最大伸展范围，够不到');
    root.querySelector('#ws-current-result').textContent = (result.positionReached ? '已到达目标位置' : '尚未到达目标位置') + ' · 误差 ' + number(result.positionError, 3) + ' m';
    root.querySelector('#ws-coordinates').textContent = '（' + number(result.arm.point[0], 2) + ', ' + number(result.arm.point[1], 2) + '）m';
    root.querySelector('#ws-pose-result').textContent = result.poseReached ? '当前已满足两项要求' : result.poseReachable ? '容差内存在满足两项要求的解，当前尚未满足' : '容差内无解；位置可达也不保证朝向可达';
    root.querySelectorAll('[data-ws-solve]').forEach(function (button) { button.disabled = !result.positionReachable; });
    const width = Math.max(280, svg.getBoundingClientRect().width);
    const height = parseFloat(getComputedStyle(svg).height) || 370;
    const scale = Math.min((width - 70) / 4.6, (height - 54) / 4.6);
    const center = [width / 2, height / 2];
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    Array.from(svg.children).filter(function (child) { return child.tagName !== 'title' && child.tagName !== 'desc'; }).forEach(function (child) { child.remove(); });
    function element(tag, attrs, text) {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(function (pair) { node.setAttribute(pair[0], String(pair[1])); });
      if (text !== undefined) node.textContent = text;
      svg.appendChild(node); return node;
    }
    function project(point) { return [center[0] + point[0] * scale, center[1] - point[1] * scale]; }
    function line(a, b, attrs) {
      const start = project(a), finish = project(b);
      return element('line', Object.assign({ x1: start[0], y1: start[1], x2: finish[0], y2: finish[1], stroke: 'var(--border)', 'stroke-width': 1 }, attrs || {}));
    }
    function label(point, text, offsetX, offsetY, anchor) {
      const p = project(point);
      return element('text', { x: p[0] + (offsetX || 0), y: p[1] + (offsetY || 0), 'text-anchor': anchor || 'start', class: 'ws-direct-label' }, text);
    }
    function arrow(point, angle, color) {
      const end = [point[0] + 0.32 * Math.cos(angle), point[1] + 0.32 * Math.sin(angle)];
      line(point, end, { stroke: color, 'stroke-width': 2 });
      line(end, [end[0] - 0.11 * Math.cos(angle - 0.45), end[1] - 0.11 * Math.sin(angle - 0.45)], { stroke: color, 'stroke-width': 2 });
      line(end, [end[0] - 0.11 * Math.cos(angle + 0.45), end[1] - 0.11 * Math.sin(angle + 0.45)], { stroke: color, 'stroke-width': 2 });
    }
    for (let value = -2; value <= 2.01; value += 0.5) { line([value, -2.1], [value, 2.1]); line([-2.1, value], [2.1, value]); }
    const outer = (L1 + L2) * scale, inner = (L1 - L2) * scale, cx = center[0], cy = center[1];
    const ring = 'M ' + (cx + outer) + ' ' + cy + ' A ' + outer + ' ' + outer + ' 0 1 0 ' + (cx - outer) + ' ' + cy + ' A ' + outer + ' ' + outer + ' 0 1 0 ' + (cx + outer) + ' ' + cy + ' Z M ' + (cx + inner) + ' ' + cy + ' A ' + inner + ' ' + inner + ' 0 1 0 ' + (cx - inner) + ' ' + cy + ' A ' + inner + ' ' + inner + ' 0 1 0 ' + (cx + inner) + ' ' + cy + ' Z';
    element('path', { d: ring, fill: 'var(--viz-series-1)', 'fill-opacity': 0.12, 'fill-rule': 'evenodd' });
    line([-2.12, 0], [2.12, 0], { stroke: 'var(--muted-foreground)' });
    line([0, -2.12], [0, 2.12], { stroke: 'var(--muted-foreground)' });
    label([2.12, 0], 'x（m）', 0, 18, 'end'); label([0, 2.12], 'y（m）', 8, 0);
    [-2, 2].forEach(function (v) { label([v, 0], String(v), 0, -7, 'middle'); label([0, v], String(v), -9, 4, 'end'); });
    line([0, 0], result.arm.elbow, { stroke: 'var(--viz-series-1)', 'stroke-width': 8, 'stroke-linecap': 'round' });
    line(result.arm.elbow, result.arm.point, { stroke: 'var(--viz-series-1)', 'stroke-width': 6, 'stroke-linecap': 'round' });
    const base = project([0, 0]), joint = project(result.arm.elbow), tip = project(result.arm.point), target = project([state.x, state.y]);
    element('circle', { cx: base[0], cy: base[1], r: 6, fill: 'var(--foreground)' });
    element('circle', { cx: joint[0], cy: joint[1], r: 5, fill: 'var(--background)', stroke: 'var(--viz-series-1)', 'stroke-width': 2 });
    element('circle', { cx: tip[0], cy: tip[1], r: 5, fill: 'var(--viz-series-1)', stroke: 'var(--background)', 'stroke-width': 1.5 });
    element('path', { d: 'M ' + target[0] + ' ' + (target[1] - 7) + ' L ' + (target[0] + 7) + ' ' + target[1] + ' L ' + target[0] + ' ' + (target[1] + 7) + ' L ' + (target[0] - 7) + ' ' + target[1] + ' Z', fill: 'var(--background)', stroke: 'var(--viz-series-2)', 'stroke-width': 2 });
    label([0, 0], '基座', -9, 19, 'end');
    label([state.x, state.y], '目标', 10, -10);
    if (result.positionError > 0.25) label(result.arm.point, '末端', 8, 18);
    if (state.mode === 'pose') { arrow(result.arm.point, result.arm.heading, 'var(--viz-series-1)'); arrow([state.x, state.y], radians(state.phi), 'var(--viz-series-2)'); }
    const note = element('text', { x: 8, y: height - 8, class: 'ws-direct-label' }, '可达距离：0.30–1.70 m');
    note.setAttribute('aria-hidden', 'true');
    svg.querySelectorAll('text').forEach(function (text) {
      try {
        const box = text.getBBox();
        const dx = box.x < 4 ? 4 - box.x : box.x + box.width > width - 4 ? width - 4 - box.x - box.width : 0;
        const dy = box.y < 4 ? 4 - box.y : box.y + box.height > height - 4 ? height - 4 - box.y - box.height : 0;
        if (dx || dy) text.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
      } catch (error) { /* Layout measurement can be unavailable while the section is hidden. */ }
    });
  }
  Object.keys(inputs).forEach(function (key) { inputs[key].addEventListener('input', function () { state[key] = Number(inputs[key].value); sync(); draw(); }); });
  root.querySelectorAll('[data-ws-mode]').forEach(function (button) { button.addEventListener('click', function () { state.mode = button.dataset.wsMode; sync(); draw(); }); });
  root.querySelectorAll('[data-ws-solve]').forEach(function (button) {
    button.addEventListener('click', function () {
      const solution = inverse(state.x, state.y)[Number(button.dataset.wsSolve)];
      if (!solution) return;
      state.q1 = degrees(solution.q1); state.q2 = degrees(solution.q2); sync(); draw();
    });
  });
  root.querySelector('[data-ws-current-heading]').addEventListener('click', function () { state.phi = Math.round(degrees(wrap(radians(state.q1 + state.q2)))); sync(); draw(); });
  sync(); draw();
  new ResizeObserver(draw).observe(svg);
})();
