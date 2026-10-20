(function () {
  'use strict';

  // These functions are geometric predicates, not a general SMT solver.
  // They accept any consistent length unit. UI sliders use integer centimeters;
  // the two-square theorem remains valid for continuous positions and sizes.
  function validBox(box) {
    return ['x', 'y', 'w', 'h'].every(function (k) { return Number.isFinite(box[k]); }) && box.w > 0 && box.h > 0;
  }
  function nonoverlap(a, b) {
    if (!validBox(a) || !validBox(b)) throw new RangeError('Boxes must have finite coordinates and positive dimensions.');
    const directions = [a.x + a.w <= b.x, b.x + b.w <= a.x, a.y + a.h <= b.y, b.y + b.h <= a.y];
    const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return {directions: directions, or: directions.some(Boolean), and: directions.every(Boolean), overlapX: overlapX, overlapY: overlapY, overlapArea: overlapX * overlapY, interiorOverlap: overlapX > 0 && overlapY > 0};
  }
  function packTwoSquares(width, height, side) {
    side = side === undefined ? 2 : side;
    if (![width, height, side].every(Number.isFinite) || width < 0 || height < 0 || side <= 0) throw new RangeError('Container dimensions must be nonnegative and square side positive.');
    const fitsOne = width >= side && height >= side;
    const horizontal = fitsOne && width >= 2 * side;
    const vertical = fitsOne && height >= 2 * side;
    const possible = horizontal || vertical;
    const witness = possible ? [{x: 0, y: 0, w: side, h: side}, {x: horizontal ? side : 0, y: horizontal ? 0 : side, w: side, h: side}] : null;
    return {possible: possible, fitsOne: fitsOne, horizontal: horizontal, vertical: vertical, witness: witness};
  }
  function sharedWalls(a, b) {
    const separation = nonoverlap(a, b);
    if (separation.interiorOverlap) return [];
    const yLow = Math.max(a.y, b.y), yHigh = Math.min(a.y + a.h, b.y + b.h);
    const xLow = Math.max(a.x, b.x), xHigh = Math.min(a.x + a.w, b.x + b.w);
    const result = [];
    if (yHigh > yLow) {
      if (a.x + a.w === b.x) result.push({axis: 'vertical', coordinate: b.x, low: yLow, high: yHigh});
      if (b.x + b.w === a.x) result.push({axis: 'vertical', coordinate: a.x, low: yLow, high: yHigh});
    }
    if (xHigh > xLow) {
      if (a.y + a.h === b.y) result.push({axis: 'horizontal', coordinate: b.y, low: xLow, high: xHigh});
      if (b.y + b.h === a.y) result.push({axis: 'horizontal', coordinate: a.y, low: xLow, high: xHigh});
    }
    return result;
  }
  function analyzeContact(a, b, doorCenter, doorWidth, robotWidth, margin) {
    if (![doorCenter, doorWidth, robotWidth, margin].every(Number.isFinite) || doorWidth <= 0 || robotWidth <= 0 || margin < 0) throw new RangeError('Opening and body widths must be positive; margin must be nonnegative.');
    const separation = nonoverlap(a, b), walls = sharedWalls(a, b), wall = walls[0] || null;
    const doorLow = doorCenter - doorWidth / 2, doorHigh = doorCenter + doorWidth / 2;
    const openingContained = Boolean(wall && doorLow >= wall.low && doorHigh <= wall.high);
    const requiredWidth = robotWidth + 2 * margin;
    const widthFits = doorWidth >= requiredWidth;
    const touches = Math.min(a.x + a.w, b.x + b.w) >= Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) >= Math.max(a.y, b.y);
    return {separation: separation, wall: wall, doorLow: doorLow, doorHigh: doorHigh, openingContained: openingContained, requiredWidth: requiredWidth, widthFits: widthFits, cornerOnly: !wall && !separation.interiorOverlap && touches, feasible: separation.or && Boolean(wall) && openingContained && widthFits};
  }
  const api = {nonoverlap: nonoverlap, packTwoSquares: packTwoSquares, sharedWalls: sharedWalls, analyzeContact: analyzeContact};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const NS = 'http://www.w3.org/2000/svg';
  const A = {x: 0, y: 0, w: 200, h: 200};
  function meters(value) { return (value / 100).toFixed(2); }
  function formatArea(value) { return (value / 10000).toFixed(2); }
  function setText(root, selector, value) { const el = root.querySelector(selector); if (el) el.textContent = value; }
  function resetSvg(svg) {
    Array.from(svg.children).forEach(function (child) { if (child.tagName.toLowerCase() !== 'title' && child.tagName.toLowerCase() !== 'desc') child.remove(); });
  }
  function scene(svg, bounds) {
    resetSvg(svg);
    const width = Math.max(230, svg.getBoundingClientRect().width || 320);
    const height = svg.getBoundingClientRect().height || 320;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const scale = Math.min((width - 50) / (bounds[2] - bounds[0]), (height - 52) / (bounds[3] - bounds[1]));
    const left = (width - (bounds[2] - bounds[0]) * scale) / 2;
    const top = (height - (bounds[3] - bounds[1]) * scale) / 2;
    function project(p) { return [left + (p[0] - bounds[0]) * scale, top + (bounds[3] - p[1]) * scale]; }
    function element(tag, attrs, text) {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(function (pair) { el.setAttribute(pair[0], String(pair[1])); });
      if (text !== undefined) el.textContent = text;
      svg.appendChild(el); return el;
    }
    function line(p, q, attrs) {
      const u = project(p), v = project(q);
      return element('line', Object.assign({x1: u[0], y1: u[1], x2: v[0], y2: v[1], stroke: 'var(--border)', 'stroke-width': 1}, attrs || {}));
    }
    function label(p, text, dx, dy, anchor, cls) {
      const q = project(p);
      return element('text', {x: q[0] + (dx || 0), y: q[1] + (dy || 0), 'text-anchor': anchor || 'start', class: cls || 'd2g-direct-label'}, text);
    }
    function rect(box, attrs) {
      const p = project([box.x, box.y + box.h]);
      return element('rect', Object.assign({x: p[0], y: p[1], width: box.w * scale, height: box.h * scale}, attrs || {}));
    }
    function room(box, name, color, invalid) {
      rect(box, {fill: color, 'fill-opacity': invalid ? 0.04 : 0.16, stroke: invalid ? 'var(--destructive)' : color, 'stroke-width': 2, 'stroke-dasharray': invalid ? '5 4' : 'none', rx: 2});
      if (name) label([box.x + box.w / 2, box.y + box.h / 2], name, 0, 6, 'middle', 'd2g-room-label');
    }
    for (let x = Math.ceil(bounds[0] / 100) * 100; x <= bounds[2]; x += 100) line([x, bounds[1]], [x, bounds[3]]);
    for (let y = Math.ceil(bounds[1] / 100) * 100; y <= bounds[3]; y += 100) line([bounds[0], y], [bounds[2], y]);
    if (bounds[1] <= 0 && bounds[3] >= 0) {
      line([bounds[0], 0], [bounds[2], 0], {stroke: 'var(--muted-foreground)', 'stroke-width': 1.1});
      for (let x = Math.ceil(bounds[0] / 200) * 200; x <= bounds[2]; x += 200) label([x, 0], String(x / 100), 0, 17, 'middle');
      label([bounds[2], 0], 'x', 8, 4);
    }
    if (bounds[0] <= 0 && bounds[2] >= 0) {
      line([0, bounds[1]], [0, bounds[3]], {stroke: 'var(--muted-foreground)', 'stroke-width': 1.1});
      for (let y = Math.ceil(bounds[1] / 200) * 200; y <= bounds[3]; y += 200) if (y !== 0) label([0, y], String(y / 100), -7, 4, 'end');
      label([0, bounds[3]], 'y', 0, -8, 'middle');
    }
    element('text', {x: 10, y: height - 8, class: 'd2g-direct-label'}, '坐标单位：m');
    return {element: element, line: line, label: label, rect: rect, room: room, project: project, scale: scale, width: width, height: height};
  }
  function overlapFill(draw, a, b) {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    if (w > 0 && h > 0) draw.rect({x: x, y: y, w: w, h: h}, {fill: 'var(--destructive)', 'fill-opacity': 0.32, stroke: 'var(--destructive)', 'stroke-width': 1});
  }
  function roomPairLabels(draw, a, b) {
    const centerA = [a.x + a.w / 2, a.y + a.h / 2], centerB = [b.x + b.w / 2, b.y + b.h / 2];
    const pa = draw.project(centerA), pb = draw.project(centerB), close = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 30;
    draw.label(centerA, 'A', close ? -10 : 0, close ? -3 : 6, 'middle', 'd2g-room-label');
    draw.label(centerB, 'B', close ? 10 : 0, close ? 15 : 6, 'middle', 'd2g-room-label');
  }
  function row(list, label, explanation, truth, trueWord, falseWord) {
    const item = document.createElement('li');
    item.dataset.truth = truth === null ? 'unknown' : String(truth);
    const text = document.createElement('div'), title = document.createElement('strong'), formula = document.createElement('code'), word = document.createElement('span');
    title.textContent = label; formula.textContent = explanation;
    word.className = 'd2g-truth-word'; word.textContent = truth === null ? '待检查' : truth ? (trueWord || '真') : (falseWord || '假');
    text.append(title, formula); item.append(text, word); list.appendChild(item);
  }
  function syncSliders(root, inputs, state) {
    Object.entries(inputs).forEach(function (entry) {
      const key = entry[0], input = entry[1];
      input.value = state[key]; input.setAttribute('aria-valuetext', meters(state[key]) + ' 米');
      setText(root, '#' + input.id + '-value', meters(state[key]) + ' m');
    });
  }
  function bindSliders(inputs, state, render, beforeRender) {
    Object.entries(inputs).forEach(function (entry) {
      function update(announce) { state[entry[0]] = Number(entry[1].value); if (beforeRender) beforeRender(); render(announce); }
      entry[1].addEventListener('input', function () { update(false); });
      entry[1].addEventListener('change', function () { update(true); });
    });
  }
  function observe(root, render) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { render(false); }).observe(root.querySelector('.d2g-picture'));
    else window.addEventListener('resize', function () { render(false); });
  }
  function initialize(id) {
    const root = document.getElementById(id);
    if (!root || root.dataset.d2gReady === 'true') return null;
    root.dataset.d2gReady = 'true'; return root;
  }

  (function initNonoverlap() {
    const root = initialize('day2-nonoverlap'); if (!root) return;
    const state = {x: 200, y: 0, mode: 'or'};
    const inputs = {x: root.querySelector('#d2g-no-x'), y: root.querySelector('#d2g-no-y')};
    const names = ['① A 在 B 左侧', '② A 在 B 右侧', '③ A 在 B 下方', '④ A 在 B 上方'];
    const symbolic = ['xA + 2 ≤ xB', 'xB + 2 ≤ xA', 'yA + 2 ≤ yB', 'yB + 2 ≤ yA'];
    function render(announce) {
      syncSliders(root, inputs, state);
      root.querySelectorAll('[data-d2g-no-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2gNoMode === state.mode)); });
      const b = {x: state.x, y: state.y, w: 200, h: 200}, result = nonoverlap(A, b);
      const values = ['2.00 ≤ ' + meters(b.x), meters(b.x + 200) + ' ≤ 0.00', '2.00 ≤ ' + meters(b.y), meters(b.y + 200) + ' ≤ 0.00'];
      const list = root.querySelector('#d2g-no-predicates'); list.replaceChildren();
      names.forEach(function (name, i) { row(list, name, symbolic[i] + '  →  ' + values[i], result.directions[i]); });
      const truth = result[state.mode], text = state.mode.toUpperCase() + ' 当前为' + (truth ? '真' : '假') + ' · ' + (state.mode === 'or' ? (result.or ? '当前摆放没有内部重叠' : '当前摆放存在内部重叠') : '同时要求四个方向，会把正确的非重叠条件写得过强');
      setText(root, '#d2g-no-result', text); root.querySelector('#d2g-no-result').dataset.outcome = truth ? 'pass' : 'fail';
      const svg = root.querySelector('.d2g-scene'), draw = scene(svg, [-280, -280, 525, 525]);
      draw.room(A, '', 'var(--viz-series-1)'); draw.room(b, '', 'var(--viz-series-3)'); overlapFill(draw, A, b);
      roomPairLabels(draw, A, b);
      const desc = svg.querySelector('desc'); desc.textContent = '方块 A 左下角为原点，方块 B 左下角为（' + meters(b.x) + '，' + meters(b.y) + '）米，两块边长均为 2 米。' + text + '。内部重叠面积为 ' + formatArea(result.overlapArea) + ' 平方米。';
      if (announce) setText(root, '#d2g-no-live', desc.textContent);
    }
    bindSliders(inputs, state, render);
    root.querySelectorAll('[data-d2g-no-mode]').forEach(function (button) { button.addEventListener('click', function () { state.mode = button.dataset.d2gNoMode; render(true); }); });
    const presets = {overlap: [100, 75], edge: [200, 0], gap: [250, 0], above: [25, 200]};
    root.querySelectorAll('[data-d2g-no-preset]').forEach(function (button) { button.addEventListener('click', function () { const preset = presets[button.dataset.d2gNoPreset]; state.x = preset[0]; state.y = preset[1]; render(true); }); });
    render(false); observe(root, render);
  })();

  (function initPacking() {
    const root = initialize('day2-packing'); if (!root) return;
    const state = {w: 400, h: 300, layout: 'horizontal'};
    const inputs = {w: root.querySelector('#d2g-pack-w'), h: root.querySelector('#d2g-pack-h')};
    function chooseWitness() { const result = packTwoSquares(state.w, state.h, 200); if (result.possible) state.layout = result.horizontal ? 'horizontal' : 'vertical'; }
    function render(announce) {
      syncSliders(root, inputs, state);
      const result = packTwoSquares(state.w, state.h, 200), currentFits = state.layout === 'horizontal' ? result.horizontal : result.vertical;
      root.querySelectorAll('[data-d2g-pack-layout]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d2gPackLayout === state.layout)); });
      const verdict = result.possible ? '整体有解 · ' + (currentFits ? '图中是一组合法摆放' : '当前尝试越界，但另一方向有合法摆放') : '整体无解 · 在这些条件下，两房无法同时装入';
      setText(root, '#d2g-pack-result', verdict); root.querySelector('#d2g-pack-result').dataset.outcome = result.possible ? 'pass' : 'fail';
      setText(root, '#d2g-pack-area', formatArea(state.w * state.h) + ' m²');
      const list = root.querySelector('#d2g-pack-conditions'); list.replaceChildren();
      row(list, '① 先装得下单个房间', 'W ≥ 2 且 H ≥ 2', result.fitsOne, '满足', '不满足');
      row(list, '② 左右方向能否分离', 'W ≥ 4，且 H ≥ 2', result.horizontal, '可以', '不可以');
      row(list, '③ 上下方向能否分离', 'H ≥ 4，且 W ≥ 2', result.vertical, '可以', '不可以');
      let explanation;
      if (!result.fitsOne) explanation = '有一条边连单个 2 m 房间都容不下。即使总面积够，细长外框也无法解决这条边界约束。';
      else if (!result.possible) explanation = '左右摆放至少需要 4 m 宽，上下摆放至少需要 4 m 高。两条都被边界排除，四项分离析取没有一项能成立。';
      else if (!currentFits) explanation = '一次尝试失败，不代表整体无解。切换到“' + (result.horizontal ? '左右' : '上下') + '摆放”，就能看到另一组满足条件的坐标。';
      else explanation = '两房左下角分别是 (0, 0) 与 ' + (state.layout === 'horizontal' ? '(2, 0)' : '(0, 2)') + ' m。这是一组可行见证；有解并不要求只有这一种摆法。';
      setText(root, '#d2g-pack-explanation', explanation);
      const b = {x: state.layout === 'horizontal' ? 200 : 0, y: state.layout === 'vertical' ? 200 : 0, w: 200, h: 200};
      const svg = root.querySelector('.d2g-scene');
      const draw = scene(svg, [-45, -65, Math.max(state.w, b.x + 200) + 40, Math.max(state.h, b.y + 200) + 45]);
      draw.rect({x: 0, y: 0, w: state.w, h: state.h}, {fill: 'none', stroke: 'var(--foreground)', 'stroke-width': 2.5});
      draw.room(A, 'A', 'var(--viz-series-1)', !result.fitsOne); draw.room(b, 'B', 'var(--viz-series-3)', !currentFits);
      draw.label([state.w / 2, state.h], 'W = ' + meters(state.w) + ' m', 0, -10, 'middle');
      // Height is placed as a separate readable label, never rotated or outside the viewport.
      draw.element('text', {x: draw.width - 9, y: 16, 'text-anchor': 'end', class: 'd2g-direct-label'}, 'H = ' + meters(state.h) + ' m');
      const desc = svg.querySelector('desc'); desc.textContent = '外框宽 ' + meters(state.w) + ' 米，高 ' + meters(state.h) + ' 米；' + verdict + '。' + explanation;
      if (announce) setText(root, '#d2g-pack-live', desc.textContent);
    }
    bindSliders(inputs, state, render, chooseWitness);
    root.querySelectorAll('[data-d2g-pack-layout]').forEach(function (button) { button.addEventListener('click', function () { state.layout = button.dataset.d2gPackLayout; render(true); }); });
    const presets = {wide: [400, 300], square: [300, 300], tall: [300, 400], thin: [150, 600]};
    root.querySelectorAll('[data-d2g-pack-preset]').forEach(function (button) { button.addEventListener('click', function () { const preset = presets[button.dataset.d2gPackPreset]; state.w = preset[0]; state.h = preset[1]; chooseWitness(); render(true); }); });
    render(false); observe(root, render);
  })();

  (function initContact() {
    const root = initialize('day2-contact'); if (!root) return;
    const state = {x: 200, y: 0, center: 100, door: 90, robot: 60, margin: 10};
    const inputs = {}; Object.keys(state).forEach(function (key) { inputs[key] = root.querySelector('#d2g-contact-' + key); });
    function render(announce) {
      syncSliders(root, inputs, state);
      const b = {x: state.x, y: state.y, w: 200, h: 200}, result = analyzeContact(A, b, state.center, state.door, state.robot, state.margin), wall = result.wall;
      const list = root.querySelector('#d2g-contact-steps'); list.replaceChildren();
      row(list, '① 房间内部不重叠', result.separation.or ? '四向分离至少一项成立' : '交叠面积 ' + formatArea(result.separation.overlapArea) + ' m²', result.separation.or, '成立', '不成立');
      row(list, '② 存在正长度共墙', wall ? '[' + meters(wall.low) + ', ' + meters(wall.high) + '] m，长度 ' + meters(wall.high - wall.low) + ' m' : result.cornerOnly ? '只有一个接触点，长度为 0' : result.separation.interiorOverlap ? '内部重叠，不能用交叠区域作共墙' : '墙的坐标没有对齐到共墙段', Boolean(wall), '成立', '不成立');
      row(list, '③ 门洞完整落在共墙内', '[' + meters(result.doorLow) + ', ' + meters(result.doorHigh) + '] m ⊆ 共墙区间', wall ? result.openingContained : null, '成立', '不成立');
      row(list, '④ 净宽容纳身体与两侧余量', meters(state.door) + ' ≥ ' + meters(state.robot) + ' + 2 × ' + meters(state.margin) + ' m', result.widthFits, '成立', '不成立');
      const verdict = result.feasible ? '这四项几何条件均成立' : '这四项几何条件尚未同时成立';
      setText(root, '#d2g-contact-result', verdict); root.querySelector('#d2g-contact-result').dataset.outcome = result.feasible ? 'pass' : 'fail';
      let explanation;
      if (result.separation.interiorOverlap) explanation = '先解决房间内部重叠。把交叠区域画成门洞，不能修复房间几何。';
      else if (result.cornerOnly) explanation = '碰到一个角，接面长度仍是零；这里放不下任何正宽度门洞。';
      else if (!wall) explanation = '不重叠并不保证相邻。两间房可以相隔一段距离，或沿另一个方向错开。';
      else if (!result.openingContained && state.door > wall.high - wall.low) explanation = '门洞净宽大于整段共墙长度；无论怎样移动中心，都无法完整放入。';
      else if (!result.openingContained) explanation = '门洞宽度可以放进这段共墙，但当前中心使开口端点越界；需要检查沿墙位置。';
      else if (!result.widthFits) explanation = '几何接面存在，但门净宽小于身体宽度加两侧余量。';
      else explanation = '这里得到的是门口的局部几何证据。门状态、转弯、连续路径与实际执行仍需要另外检查。';
      setText(root, '#d2g-contact-explanation', explanation);
      setText(root, '#d2g-contact-axis-note', wall ? '当前共墙' + (wall.axis === 'vertical' ? '竖直，门中心读 y 坐标。' : '水平，门中心读 x 坐标。') + '身体宽度沿门洞方向比较。' : '当前没有正长度共墙，因此图中不定位门洞；滑条保留候选门洞的尺寸与中心参数。');
      const svg = root.querySelector('.d2g-scene'), draw = scene(svg, [-280, -280, 485, 485]);
      draw.room(A, '', 'var(--viz-series-1)'); draw.room(b, '', 'var(--viz-series-3)'); overlapFill(draw, A, b);
      if (wall) {
        function point(along, offset) { return wall.axis === 'vertical' ? [wall.coordinate + (offset || 0), along] : [along, wall.coordinate + (offset || 0)]; }
        draw.line(point(wall.low), point(wall.high), {stroke: 'var(--viz-series-1)', 'stroke-width': 7, 'stroke-linecap': 'butt'});
        draw.line(point(result.doorLow), point(result.doorHigh), {stroke: 'var(--viz-series-2)', 'stroke-width': 5, 'stroke-linecap': 'butt'});
        const halfRequired = result.requiredWidth / 2, halfRobot = state.robot / 2;
        draw.line(point(state.center - halfRequired, 19), point(state.center + halfRequired, 19), {stroke: 'var(--viz-series-3)', 'stroke-width': 3, 'stroke-dasharray': '3 3'});
        draw.line(point(state.center - halfRobot, 19), point(state.center + halfRobot, 19), {stroke: 'var(--viz-series-3)', 'stroke-width': 4});
      }
      roomPairLabels(draw, A, b);
      const desc = svg.querySelector('desc'); desc.textContent = '房间 B 左下角为（' + meters(b.x) + '，' + meters(b.y) + '）米。' + verdict + '。' + explanation;
      if (announce) setText(root, '#d2g-contact-live', desc.textContent);
    }
    bindSliders(inputs, state, render);
    const presets = {baseline: {x: 200, y: 0, center: 100, door: 90}, corner: {x: 200, y: 200, center: 100, door: 90}, gap: {x: 225, y: 0, center: 100, door: 90}, overlap: {x: 150, y: 0, center: 100, door: 90}, offwall: {x: 200, y: 100, center: 115, door: 90}, narrow: {x: 200, y: 0, center: 100, door: 50}};
    root.querySelectorAll('[data-d2g-contact-preset]').forEach(function (button) { button.addEventListener('click', function () { Object.assign(state, presets[button.dataset.d2gContactPreset], {robot: 60, margin: 10}); render(true); }); });
    render(false); observe(root, render);
  })();
})();
