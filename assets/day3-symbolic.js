(function () {
  'use strict';
  const GOAL = ['(holding r cup)'];
  function fact(name) { return '(' + Array.from(arguments).join(' ') + ')'; }
  function sortedFacts(facts) { return Array.from(new Set(facts)).sort(); }
  function stateKey(facts) { return sortedFacts(facts).join('|'); }
  function hasGoal(facts, goal) { const set = new Set(facts); return (goal || GOAL).every(function (item) { return set.has(item); }); }
  function initialFacts(preset) {
    const set = new Set([
      '(at r a)', '(item-at cup b)', '(door-side d a)', '(door-side d b)',
      '(connected a b d)', '(connected b a d)', '(fits k d)', '(has-key r k)',
      '(locked d)', '(handempty r)', '(graspable cup)', '(can-unlock r)',
      '(can-open r)', '(can-move r)', '(can-pickup r)'
    ]);
    const selected = preset || 'success';
    if (selected === 'missing_key') set.delete('(has-key r k)');
    else if (selected === 'missing_unlock') set.delete('(can-unlock r)');
    else if (selected === 'missing_open') set.delete('(can-open r)');
    else if (selected === 'no_grasp') set.delete('(can-pickup r)');
    else if (selected === 'ungraspable') set.delete('(graspable cup)');
    else if (selected === 'already_open') { set.delete('(locked d)'); set.add('(unlocked d)'); set.add('(opened d)'); }
    else if (selected !== 'success' && selected !== 'narrow_door') throw new Error('Unknown teaching-world preset: ' + selected);
    return sortedFacts(set);
  }
  function makeAction(name, args, pre, add, del) {
    return {name: name, args: args, raw: '(' + [name].concat(args).join(' ') + ')', pre: pre, add: add, del: del};
  }
  function groundActions() {
    const actions = [], rooms = ['a', 'b'];
    rooms.forEach(function (room) {
      actions.push(makeAction('unlock', ['r', 'd', 'k', room],
        [fact('at', 'r', room), fact('door-side', 'd', room), '(has-key r k)', '(fits k d)', '(can-unlock r)', '(locked d)'],
        ['(unlocked d)'], ['(locked d)']));
    });
    rooms.forEach(function (room) {
      actions.push(makeAction('open', ['r', 'd', room],
        [fact('at', 'r', room), fact('door-side', 'd', room), '(unlocked d)', '(can-open r)'],
        ['(opened d)'], []));
    });
    rooms.forEach(function (from) {
      const to = from === 'a' ? 'b' : 'a';
      actions.push(makeAction('move', ['r', from, to, 'd'],
        [fact('at', 'r', from), fact('connected', from, to, 'd'), '(opened d)', '(can-move r)'],
        [fact('at', 'r', to)], [fact('at', 'r', from)]));
    });
    rooms.forEach(function (room) {
      actions.push(makeAction('pickup', ['r', 'cup', room],
        [fact('at', 'r', room), fact('item-at', 'cup', room), '(graspable cup)', '(handempty r)', '(can-pickup r)'],
        ['(holding r cup)'], [fact('item-at', 'cup', room), '(handempty r)']));
    });
    return actions;
  }
  function applyAction(facts, action) {
    const before = new Set(facts), missing = action.pre.filter(function (item) { return !before.has(item); });
    if (missing.length) return {applicable: false, missing: missing, facts: sortedFacts(before), added: [], deleted: [], unchanged: sortedFacts(before)};
    const after = new Set(before);
    action.del.forEach(function (item) { after.delete(item); });
    action.add.forEach(function (item) { after.add(item); });
    return {
      applicable: true, missing: [], facts: sortedFacts(after),
      added: sortedFacts(Array.from(after).filter(function (item) { return !before.has(item); })),
      deleted: sortedFacts(Array.from(before).filter(function (item) { return !after.has(item); })),
      unchanged: sortedFacts(Array.from(before).filter(function (item) { return after.has(item); }))
    };
  }
  function stateInvariants(facts) {
    const set = new Set(facts), count = function (items) { return items.filter(function (item) { return set.has(item); }).length; };
    return {
      one_robot_room: count(['(at r a)', '(at r b)']) === 1,
      exactly_one_lock_status: count(['(locked d)', '(unlocked d)']) === 1,
      opened_implies_unlocked: !set.has('(opened d)') || set.has('(unlocked d)'),
      cup_has_one_location_or_is_held: count(['(item-at cup a)', '(item-at cup b)', '(holding r cup)']) === 1,
      hand_matches_cup_state: set.has('(handempty r)') !== set.has('(holding r cup)')
    };
  }
  function createSearch(facts, goal) {
    const start = sortedFacts(facts);
    return {
      nodes: [{id: 0, facts: start, parent: null, action: null, depth: 0, expanded: false}],
      queue: [0], seen: new Map([[stateKey(start), 0]]), goal: (goal || GOAL).slice(),
      status: 'searching', current: null, candidates: [], expanded: 0, plan: null
    };
  }
  function extractPlan(search, node) {
    const result = [];
    let cursor = node;
    while (cursor.parent !== null) { result.push(cursor.action); cursor = search.nodes[cursor.parent]; }
    return result.reverse();
  }
  function stepSearch(search) {
    if (search.status !== 'searching') return search;
    if (!search.queue.length) { search.status = 'no_plan'; return search; }
    const id = search.queue.shift(), node = search.nodes[id];
    search.current = id; search.candidates = []; search.expanded += 1; node.expanded = true;
    if (hasGoal(node.facts, search.goal)) {
      search.status = 'plan_found'; search.plan = extractPlan(search, node); return search;
    }
    groundActions().forEach(function (action) {
      const result = applyAction(node.facts, action);
      if (!result.applicable) { search.candidates.push({action: action, kind: 'rejected', missing: result.missing}); return; }
      const key = stateKey(result.facts);
      if (search.seen.has(key)) {
        search.candidates.push({action: action, kind: 'duplicate', target: search.seen.get(key), missing: []}); return;
      }
      const child = {id: search.nodes.length, facts: result.facts, parent: id, action: action, depth: node.depth + 1, expanded: false};
      search.nodes.push(child); search.seen.set(key, child.id); search.queue.push(child.id);
      search.candidates.push({action: action, kind: 'new', target: child.id, missing: []});
    });
    if (!search.queue.length) search.status = 'no_plan';
    return search;
  }
  function runSearch(facts, goal, limit) {
    const search = createSearch(facts, goal), budget = limit === undefined ? 1024 : limit;
    if (!Number.isInteger(budget) || budget < 0) throw new Error('Search expansion budget must be a nonnegative integer.');
    while (search.status === 'searching' && search.expanded < budget) stepSearch(search);
    if (search.status === 'searching') search.status = 'budget_exhausted';
    return search;
  }
  function factDescription(item) {
    const words = item.slice(1, -1).split(' '), kind = words[0];
    if (kind === 'at') return '机器人在房间 ' + words[2].toUpperCase();
    if (kind === 'item-at') return '杯子在房间 ' + words[2].toUpperCase();
    if (kind === 'door-side') return '门 D 邻接房间 ' + words[2].toUpperCase();
    if (kind === 'connected') return words[1].toUpperCase() + ' 与 ' + words[2].toUpperCase() + ' 有门 D 连接';
    const labels = {
      'fits': '钥匙 K 与锁 D 匹配', 'has-key': '机器人物品栏中有钥匙 K',
      'locked': '门 D 上锁', 'unlocked': '门 D 已解锁', 'opened': '门 D 已打开',
      'handempty': '抓杯子的手是空的', 'holding': '机器人拿着杯子',
      'graspable': '杯子被声明为可抓取', 'can-unlock': '机器人被赋予解锁能力',
      'can-open': '机器人被赋予开门能力', 'can-move': '机器人被赋予移动能力',
      'can-pickup': '机器人被赋予拿杯能力'
    };
    return labels[kind] || item;
  }
  function actionDescription(action) {
    if (action.name === 'unlock') return '在 ' + action.args[3].toUpperCase() + ' 一侧解锁门';
    if (action.name === 'open') return '在 ' + action.args[2].toUpperCase() + ' 一侧开门';
    if (action.name === 'move') return '从 ' + action.args[1].toUpperCase() + ' 移到 ' + action.args[2].toUpperCase();
    if (action.name === 'pickup') return '在 ' + action.args[2].toUpperCase() + ' 拿杯子';
    return action.raw;
  }
  function stateDescription(facts) {
    const set = new Set(facts);
    return {
      room: set.has('(at r a)') ? 'A' : 'B',
      door: set.has('(opened d)') ? '已打开' : set.has('(unlocked d)') ? '已解锁，仍关着' : '上锁，仍关着',
      cup: set.has('(holding r cup)') ? '机器人手中' : set.has('(item-at cup a)') ? '房间 A' : '房间 B',
      key: set.has('(has-key r k)'), held: set.has('(holding r cup)')
    };
  }
  function selectedAction(name, facts) {
    const room = new Set(facts).has('(at r a)') ? 'a' : 'b';
    return groundActions().find(function (action) {
      return action.name === name && (name === 'move' ? action.args[1] === room : action.args[action.args.length - 1] === room);
    });
  }
  const api = {
    goal: GOAL.slice(), initialFacts: initialFacts, groundActions: groundActions, applyAction: applyAction,
    stateKey: stateKey, hasGoal: hasGoal, stateInvariants: stateInvariants, createSearch: createSearch,
    stepSearch: stepSearch, runSearch: runSearch, factDescription: factDescription,
    actionDescription: actionDescription, selectedAction: selectedAction
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  window.Day3Symbolic = api;
  function q(root, selector) { return root.querySelector(selector); }
  function put(root, selector, text) { q(root, selector).textContent = text; }
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function factList(host, facts, empty) {
    host.replaceChildren();
    if (!facts.length) { host.appendChild(node('li', 'd3s-empty', empty || '无')); return; }
    sortedFacts(facts).forEach(function (item) {
      const row = node('li'), code = node('code', '', item); code.title = factDescription(item); row.appendChild(code); host.appendChild(row);
    });
  }
  function setGoal(root, selector, facts) {
    const element = q(root, selector), reached = hasGoal(facts);
    element.textContent = reached ? '当前符号状态已满足' : '当前还未满足'; element.dataset.true = String(reached);
  }
  function status(root, selector, message) { put(root, selector, message); }
  function begin(id) {
    const root = document.getElementById(id);
    if (!root || root.dataset.d3sReady === 'true') return null;
    root.dataset.d3sReady = 'true'; return root;
  }
  function observe(svg, redraw) {
    if (typeof ResizeObserver === 'function') new ResizeObserver(redraw).observe(svg);
    else window.addEventListener('resize', redraw);
  }
  function drawWorld(svg, facts) {
    Array.from(svg.children).forEach(function (child) { if (!['title', 'desc'].includes(child.tagName.toLowerCase())) child.remove(); });
    const width = Math.max(250, svg.getBoundingClientRect().width || 410), height = 260, middle = width / 2;
    const left = 16, right = width - 16, top = 43, bottom = 221, gapLow = 123, gapHigh = 175;
    const aX = (left + middle) / 2, bX = (right + middle) / 2, description = stateDescription(facts);
    const set = new Set(facts), robotX = description.room === 'A' ? aX : bX;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    function shape(tag, attrs, text) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach(function (name) { element.setAttribute(name, String(attrs[name])); });
      if (text !== undefined) element.textContent = text;
      svg.appendChild(element); return element;
    }
    shape('rect', {x: left, y: top, width: middle - left, height: bottom - top, fill: 'var(--viz-series-1)', 'fill-opacity': 0.07});
    shape('rect', {x: middle, y: top, width: right - middle, height: bottom - top, fill: 'var(--viz-series-3)', 'fill-opacity': 0.07});
    shape('rect', {x: left, y: top, width: right - left, height: bottom - top, fill: 'none', stroke: 'var(--border)', 'stroke-width': 2, rx: 4});
    shape('path', {d: 'M ' + middle + ' ' + top + ' V ' + gapLow + ' M ' + middle + ' ' + gapHigh + ' V ' + bottom, stroke: 'var(--foreground)', 'stroke-width': 3, fill: 'none'});
    shape('text', {x: aX, y: 66, 'text-anchor': 'middle', class: 'd3s-svg-room'}, '房间 A');
    shape('text', {x: bX, y: 66, 'text-anchor': 'middle', class: 'd3s-svg-room'}, '房间 B');
    shape('text', {x: middle, y: 25, 'text-anchor': 'middle', class: set.has('(locked d)') ? 'd3s-svg-label d3s-svg-error' : 'd3s-svg-label'}, '门 D · ' + description.door);
    if (set.has('(opened d)')) {
      shape('line', {x1: middle, y1: gapHigh, x2: middle + Math.min(39, (right - middle) / 3), y2: gapHigh, stroke: 'var(--viz-series-1)', 'stroke-width': 4, 'stroke-linecap': 'round'});
      shape('path', {d: 'M ' + (middle - 13) + ' 149 H ' + (middle + 13) + ' M ' + (middle + 7) + ' 144 L ' + (middle + 13) + ' 149 L ' + (middle + 7) + ' 154', stroke: 'var(--viz-series-1)', 'stroke-width': 1.5, fill: 'none'});
    } else {
      shape('line', {x1: middle, y1: gapLow, x2: middle, y2: gapHigh, stroke: set.has('(locked d)') ? 'var(--destructive)' : 'var(--viz-series-2)', 'stroke-width': 5, 'stroke-linecap': 'round'});
      shape('circle', {cx: middle + 6, cy: gapLow + 12, r: 3, fill: 'var(--foreground)'});
      if (set.has('(locked d)')) {
        shape('rect', {x: middle - 6, y: 146, width: 12, height: 11, rx: 2, fill: 'var(--page)', stroke: 'var(--destructive)', 'stroke-width': 1.5});
        shape('path', {d: 'M ' + (middle - 4) + ' 146 v -4 a 4 4 0 0 1 8 0 v 4', fill: 'none', stroke: 'var(--destructive)', 'stroke-width': 1.5});
      }
    }
    shape('circle', {cx: robotX, cy: 104, r: 16, fill: 'var(--viz-series-1)'});
    shape('rect', {x: robotX - 9, y: 95, width: 18, height: 12, rx: 3, fill: 'var(--page)'});
    shape('circle', {cx: robotX - 4, cy: 101, r: 1.7, fill: 'var(--viz-series-1)'});
    shape('circle', {cx: robotX + 4, cy: 101, r: 1.7, fill: 'var(--viz-series-1)'});
    shape('text', {x: robotX, y: 135, 'text-anchor': 'middle', class: 'd3s-svg-label'}, '机器人 R');
    const cupX = description.held ? robotX + 20 : set.has('(item-at cup a)') ? aX : bX;
    const cupY = description.held ? 105 : 170;
    shape('path', {d: 'M ' + (cupX - 7) + ' ' + (cupY - 8) + ' h 14 l -2 16 h -10 Z', fill: 'var(--viz-series-3)', 'fill-opacity': 0.3, stroke: 'var(--viz-series-3)', 'stroke-width': 1.8});
    shape('path', {d: 'M ' + (cupX + 6) + ' ' + (cupY - 5) + ' h 4 q 6 5 0 9 h -5', fill: 'none', stroke: 'var(--viz-series-3)', 'stroke-width': 1.8});
    if (!description.held) shape('text', {x: cupX, y: 199, 'text-anchor': 'middle', class: 'd3s-svg-label'}, '杯子 C');
    else shape('text', {x: robotX, y: 159, 'text-anchor': 'middle', class: 'd3s-svg-muted'}, '杯子已在手中');
    if (description.key) {
      shape('circle', {cx: 25, cy: 244, r: 5, stroke: 'var(--viz-series-2)', 'stroke-width': 2, fill: 'none'});
      shape('path', {d: 'M 30 244 h 12 m -4 0 v 4 m 4 -4 v 3', stroke: 'var(--viz-series-2)', 'stroke-width': 2, fill: 'none'});
    }
    shape('text', {x: description.key ? 52 : 18, y: 248, class: 'd3s-svg-muted'}, description.key ? 'R 的物品栏：钥匙 K' : 'R 的物品栏：没有钥匙');
    const desc = svg.querySelector('desc');
    if (desc) desc.textContent = '机器人在房间 ' + description.room + '；门 ' + description.door + '；杯子在' + description.cup + '；' + (description.key ? '物品栏有钥匙 K。' : '物品栏没有钥匙。') + '这是符号状态的示意图，不代表连续运动轨迹。';
  }
  function truthList(host, facts, queries) {
    const set = new Set(facts); host.replaceChildren();
    queries.forEach(function (item) {
      const li = node('li'), value = set.has(item), badge = node('span', 'd3s-truth', value ? '真' : '假');
      badge.dataset.true = String(value);
      const content = node('div', '', factDescription(item)); content.appendChild(node('code', '', item));
      li.append(badge, content); host.appendChild(li);
    });
  }

  const stateRoot = begin('day3-state');
  if (stateRoot) {
    const snapshots = [initialFacts()], sequence = ['(unlock r d k a)', '(open r d a)', '(move r a b d)', '(pickup r cup b)'];
    sequence.forEach(function (raw) { snapshots.push(applyAction(snapshots[snapshots.length - 1], groundActions().find(function (action) { return action.raw === raw; })).facts); });
    const explanations = [
      '初态：机器人在 A、杯子在 B、门上锁。目标是拿着杯子，目前还没有满足；“钥匙在物品栏”与“手空”可以同时为真。',
      '解锁只把 locked 删除、把 unlocked 加入。opened 仍是假，所以门还关着，不能直接移动到 B。',
      '开门把 opened 加入真事实。unlocked 仍保留：门已经打开，也仍处于解锁状态。',
      '移动增加 at(r,b)，同时删除 at(r,a)。杯子仍在 B，还没有变成机器人拿着杯子。',
      '拿杯增加 holding(r,cup)，删除 item-at(cup,b) 和 handempty(r)。目标在这个符号状态中成立；实际抓取是否成功还需执行验证。'
    ];
    let selected = 0;
    function renderState(announce) {
      const facts = snapshots[selected];
      drawWorld(q(stateRoot, '.d3s-scene'), facts);
      truthList(q(stateRoot, '#d3s-state-truth'), facts, ['(at r a)', '(at r b)', '(unlocked d)', '(opened d)', '(holding r cup)', '(handempty r)']);
      factList(q(stateRoot, '#d3s-state-facts'), facts);
      setGoal(stateRoot, '#d3s-state-goal', facts); put(stateRoot, '#d3s-state-explanation', explanations[selected]);
      stateRoot.querySelectorAll('[data-d3s-snapshot]').forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.d3sSnapshot) === selected)); });
      if (announce) status(stateRoot, '#d3s-state-live', '快照 ' + (selected + 1) + '。' + explanations[selected]);
    }
    stateRoot.querySelectorAll('[data-d3s-snapshot]').forEach(function (button) { button.addEventListener('click', function () { selected = Number(button.dataset.d3sSnapshot); renderState(true); }); });
    renderState(false); observe(q(stateRoot, '.d3s-scene'), function () { drawWorld(q(stateRoot, '.d3s-scene'), snapshots[selected]); });
  }

  const actionsRoot = begin('day3-actions');
  if (actionsRoot) {
    let preset = 'success', facts = initialFacts(), choice = 'open', history = [], last = null;
    function renderActions(announce, message) {
      const action = selectedAction(choice, facts), result = applyAction(facts, action);
      drawWorld(q(actionsRoot, '.d3s-scene'), facts); setGoal(actionsRoot, '#d3s-actions-goal', facts);
      put(actionsRoot, '#d3s-actions-selected', action.raw + ' · ' + actionDescription(action));
      truthList(q(actionsRoot, '#d3s-actions-preconditions'), facts, action.pre);
      put(actionsRoot, '#d3s-actions-readiness', result.applicable ? '当前全部符号前置成立，可以尝试这一步。' : '目前缺少：' + result.missing.map(factDescription).join('；') + '。');
      actionsRoot.querySelectorAll('[data-d3s-action]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.d3sAction === choice)); });
      q(actionsRoot, '#d3s-actions-undo').disabled = history.length === 0;
      q(actionsRoot, '#d3s-actions-diff').hidden = !last || !last.result.applicable;
      q(actionsRoot, '#d3s-actions-unchanged-box').hidden = !last || !last.result.applicable;
      if (last && last.result.applicable) {
        factList(q(actionsRoot, '#d3s-actions-added'), last.result.added, '本次没有新增真事实。');
        factList(q(actionsRoot, '#d3s-actions-deleted'), last.result.deleted, '本次没有删除真事实。');
        factList(q(actionsRoot, '#d3s-actions-unchanged'), last.result.unchanged);
      }
      const list = q(actionsRoot, '#d3s-actions-history'); list.replaceChildren();
      if (!history.length) list.appendChild(node('li', '', '尚未迁移。'));
      history.forEach(function (entry) { const row = node('li'); row.append(node('code', '', entry.action.raw), document.createTextNode(' · ' + actionDescription(entry.action))); list.appendChild(row); });
      if (message) { put(actionsRoot, '#d3s-actions-message', message); q(actionsRoot, '#d3s-actions-message').dataset.kind = last && !last.result.applicable ? 'blocked' : 'normal'; }
      if (announce && message) status(actionsRoot, '#d3s-actions-live', message);
    }
    actionsRoot.querySelectorAll('[data-d3s-action]').forEach(function (button) { button.addEventListener('click', function () { choice = button.dataset.d3sAction; renderActions(false); status(actionsRoot, '#d3s-actions-live', '已选择' + actionDescription(selectedAction(choice, facts)) + '。请核对当前前置条件。'); }); });
    q(actionsRoot, '#d3s-actions-try').addEventListener('click', function () {
      const action = selectedAction(choice, facts), result = applyAction(facts, action);
      last = {action: action, result: result};
      if (!result.applicable) { renderActions(true, '本次 ' + action.raw + ' 被拒绝：' + result.missing.map(factDescription).join('；') + '。当前状态没有改变。'); return; }
      history.push({facts: facts.slice(), action: action}); facts = result.facts;
      let message = '已按符号规则完成 ' + action.raw + '。下方显示这一次的新增、删除与不变事实；上方前置表已更新为当前状态下的下一次尝试。';
      if (!result.added.length && !result.deleted.length) message = '这次 ' + action.raw + ' 的前置成立，但真事实集合没有变化。重复开一扇已开的门没有得到新的状态。';
      renderActions(true, message);
    });
    q(actionsRoot, '#d3s-actions-undo').addEventListener('click', function () {
      if (!history.length) return;
      const previous = history.pop(); facts = previous.facts; last = null;
      renderActions(true, '已撤回 ' + previous.action.raw + '，恢复到这一步之前的符号状态。');
    });
    function resetActions() {
      facts = initialFacts(preset); history = []; last = null; choice = 'open';
      q(actionsRoot, '#d3s-actions-unchanged-box').open = false;
      renderActions(true, '已恢复所选初态。先预测每个动作能不能执行，再点击尝试。');
    }
    q(actionsRoot, '#d3s-actions-reset').addEventListener('click', resetActions);
    q(actionsRoot, '#d3s-actions-preset').addEventListener('change', function (event) { preset = event.target.value; resetActions(); });
    renderActions(false); observe(q(actionsRoot, '.d3s-scene'), function () { drawWorld(q(actionsRoot, '.d3s-scene'), facts); });
  }

  const domainRoot = begin('day3-domain');
  if (domainRoot) {
    let preset = 'success', domainPart = 'unlock', problemPart = 'init';
    const snippets = {
      types: ['(:types robot room door key item)'],
      predicates: [
        '(:predicates',
        '  (at ?r - robot ?x - room)',
        '  (item-at ?o - item ?x - room)',
        '  (door-side ?d - door ?x - room)',
        '  (connected ?x ?y - room ?d - door)',
        '  (fits ?k - key ?d - door)',
        '  (has-key ?r - robot ?k - key)',
        '  (locked ?d - door)',
        '  (unlocked ?d - door)',
        '  (opened ?d - door)',
        '  (handempty ?r - robot)',
        '  (holding ?r - robot ?o - item)',
        '  (graspable ?o - item)',
        '  (can-unlock ?r - robot)',
        '  (can-open ?r - robot)',
        '  (can-move ?r - robot)',
        '  (can-pickup ?r - robot))'
      ],
      unlock: [
        '(:action unlock',
        '  :parameters (?r - robot ?d - door',
        '               ?k - key ?x - room)',
        '  :precondition (and',
        '    (at ?r ?x) (door-side ?d ?x)',
        '    (has-key ?r ?k) (fits ?k ?d)',
        '    (can-unlock ?r) (locked ?d))',
        '  :effect (and',
        '    (unlocked ?d)',
        '    (not (locked ?d))))'
      ],
      open: [
        '(:action open',
        '  :parameters (?r - robot ?d - door',
        '               ?x - room)',
        '  :precondition (and',
        '    (at ?r ?x) (door-side ?d ?x)',
        '    (unlocked ?d) (can-open ?r))',
        '  :effect (opened ?d))'
      ],
      move: [
        '(:action move',
        '  :parameters (?r - robot',
        '    ?from ?to - room ?d - door)',
        '  :precondition (and',
        '    (at ?r ?from)',
        '    (connected ?from ?to ?d)',
        '    (opened ?d) (can-move ?r))',
        '  :effect (and',
        '    (at ?r ?to)',
        '    (not (at ?r ?from))))'
      ],
      pickup: [
        '(:action pickup',
        '  :parameters (?r - robot ?o - item',
        '               ?x - room)',
        '  :precondition (and',
        '    (at ?r ?x) (item-at ?o ?x)',
        '    (graspable ?o) (handempty ?r)',
        '    (can-pickup ?r))',
        '  :effect (and',
        '    (holding ?r ?o)',
        '    (not (item-at ?o ?x))',
        '    (not (handempty ?r))))'
      ]
    };
    const explanations = {
      types: '类型规定参数可以填什么对象。例如门参数不能直接填一个房间；类型本身不提供门的宽度。',
      predicates: '谓词在这里声明“可以说哪些类型的事实”。声明 locked，并没有自动断言这次的门已经上锁。',
      unlock: '参数填具体对象后，前置要全部为真。效果添加 unlocked，并删除 locked；它没有添加 opened。',
      open: '先要求已解锁和开门能力，再把 opened 加入。真实把手可达与门扇运动没有由这几行代码保证。',
      move: '目标位置写入，同时删除原位置。若漏写删除效果，符号模型可能把机器人留在两个房间。',
      pickup: '拿杯后把 holding 写入，并删除杯子的原位置与 handempty。其他没有被提及的事实保持不变。'
    };
    function showCode(host, lines, focus) {
      host.replaceChildren();
      lines.forEach(function (line, index) {
        const span = node('span', 'd3s-code-line' + (focus && focus(line, index) ? ' d3s-code-focus' : ''), line || ' ');
        host.appendChild(span);
      });
    }
    function renderDomain(announce) {
      put(domainRoot, '#d3s-domain-explain', explanations[domainPart]);
      showCode(q(domainRoot, '#d3s-domain-code'), snippets[domainPart], function (line) { return /:precondition|:effect|\(not /.test(line); });
      let lines, explanation;
      if (problemPart === 'objects') {
        lines = ['(:objects', '  r - robot', '  a b - room', '  d - door', '  k - key', '  cup - item)'];
        explanation = '这一次世界里有这些具体对象。钥匙对象 K 仍然存在，不代表机器人已经拥有它；拥有关系要在 :init 中声明。';
      } else if (problemPart === 'goal') {
        lines = ['(:goal (holding r cup))'];
        explanation = '目标只要求最终 holding(r,cup) 为真。完成顺序由动作规则和初态共同决定，不写在目标里。';
      } else {
        lines = ['(:init'].concat(initialFacts(preset).map(function (item) { return '  ' + item; }), [')']);
        explanation = '初态只列当前为真的事实。缺钥匙时没有 has-key；门已开时用 unlocked 和 opened，不保留 locked。';
      }
      put(domainRoot, '#d3s-problem-explain', explanation);
      showCode(q(domainRoot, '#d3s-problem-code'), lines, function (line) { return /has-key|locked d|opened d|:goal/.test(line); });
      const change = preset === 'missing_key'
        ? '本次只从 :init 删除 (has-key r k)。钥匙 K 的对象声明、unlock 的前置和 holding 的目标都没有改；当前域也没有“去取钥匙”的动作。'
        : preset === 'already_open'
          ? '本次把初态的 (locked d) 换成 (unlocked d) 与 (opened d)。通用规则仍然一样，因此计划可以直接从移动开始。'
          : '标准初态：机器人在 A、杯子在 B、门上锁，钥匙与四种能力齐全。完整问题文件还包含名称与 :domain 对应关系。';
      put(domainRoot, '#d3s-domain-change', change);
      if (announce) status(domainRoot, '#d3s-domain-live', change + '当前查看 domain 的 ' + domainPart + ' 与 problem 的 ' + problemPart + '。');
    }
    q(domainRoot, '#d3s-domain-preset').addEventListener('change', function (event) { preset = event.target.value; problemPart = 'init'; q(domainRoot, '#d3s-problem-section').value = 'init'; renderDomain(true); });
    q(domainRoot, '#d3s-domain-section').addEventListener('change', function (event) { domainPart = event.target.value; renderDomain(true); });
    q(domainRoot, '#d3s-problem-section').addEventListener('change', function (event) { problemPart = event.target.value; renderDomain(true); });
    renderDomain(false);
  }

  const searchRoot = begin('day3-search');
  if (searchRoot) {
    let preset = 'success', search = createSearch(initialFacts());
    function renderSearch(announce) {
      const terminal = search.status !== 'searching', current = search.current === null ? search.nodes[0] : search.nodes[search.current];
      put(searchRoot, '#d3s-search-seen', String(search.seen.size));
      put(searchRoot, '#d3s-search-expanded', String(search.expanded));
      put(searchRoot, '#d3s-search-status', search.status === 'plan_found' ? '找到符号计划' : search.status === 'no_plan' ? '队列穷尽：本域无计划' : '搜索中，尚不能下结论');
      q(searchRoot, '#d3s-search-step').disabled = terminal; q(searchRoot, '#d3s-search-run').disabled = terminal;
      const queue = q(searchRoot, '#d3s-search-queue'); queue.replaceChildren();
      if (!search.queue.length) queue.appendChild(node('span', 'd3s-queue-empty', '空队列'));
      search.queue.forEach(function (id) { queue.appendChild(node('span', '', 'S' + id + ' · ' + search.nodes[id].depth + ' 步')); });
      const levels = q(searchRoot, '#d3s-search-levels'); levels.replaceChildren();
      const depths = Array.from(new Set(search.nodes.map(function (item) { return item.depth; })));
      depths.forEach(function (depth) {
        const row = node('div', 'd3s-level'), items = node('div', 'd3s-level-nodes');
        row.append(node('span', '', depth + ' 步'), items);
        search.nodes.filter(function (entry) { return entry.depth === depth; }).forEach(function (entry) {
          const item = node('div', 'd3s-node'), description = stateDescription(entry.facts);
          item.dataset.state = search.status === 'plan_found' && entry.id === search.current ? 'goal' : entry.id === search.current ? 'current' : entry.expanded ? 'expanded' : 'queued';
          item.append(node('strong', '', 'S' + entry.id + ' · ' + (entry.id === search.current ? '本次检查' : entry.expanded ? '已检查' : '等待检查')));
          item.append(node('span', '', entry.action ? 'S' + entry.parent + ' → ' + actionDescription(entry.action) : '初态'));
          item.append(node('span', '', 'R 在 ' + description.room + '；门' + description.door + '；杯子在' + description.cup));
          items.appendChild(item);
        });
        levels.appendChild(row);
      });
      const currentPanel = q(searchRoot, '#d3s-search-current'), description = stateDescription(current.facts);
      currentPanel.replaceChildren();
      currentPanel.append(node('strong', '', 'S' + current.id + ' · 距初态 ' + current.depth + ' 步'));
      currentPanel.append(node('span', '', search.current === null ? '尚未从队列取出。点击“展开下一个状态”开始。' : '机器人在 ' + description.room + '；门' + description.door + '；杯子在' + description.cup + '。'));
      currentPanel.append(node('span', '', '目标 holding(r,cup)：' + (hasGoal(current.facts) ? '成立' : '不成立')));
      factList(q(searchRoot, '#d3s-search-facts'), current.facts);
      const candidates = q(searchRoot, '#d3s-search-candidates'); candidates.replaceChildren();
      if (!search.candidates.length) {
        candidates.appendChild(node('li', '', search.status === 'plan_found' ? '目标已成立，停止扩展后续动作。' : '尚未展开动作。'));
      }
      search.candidates.forEach(function (entry) {
        const row = node('li'), label = node('span', 'd3s-candidate-label', entry.kind === 'new' ? '新状态入队' : entry.kind === 'duplicate' ? '重复，跳过' : '前置不成立');
        label.dataset.kind = entry.kind;
        const detail = node('div'); detail.appendChild(node('code', '', entry.action.raw));
        const text = entry.kind === 'rejected'
          ? '缺少：' + entry.missing.map(factDescription).join('；') + '。'
          : entry.kind === 'duplicate'
            ? '得到已经发现的 S' + entry.target + '，不再重复入队；避免反复开门或往返形成循环。'
            : '得到 S' + entry.target + '，加入队尾，之后再检查它是否达到目标。';
        detail.appendChild(node('p', '', text)); row.append(label, detail); candidates.appendChild(row);
      });
      let explanation;
      if (search.status === 'plan_found') explanation = '取出的 S' + search.current + ' 满足目标。沿父节点回溯得到 ' + search.plan.length + ' 个动作；这是当前符号域中最少动作数的计划，尚未检查连续路径或实际执行。';
      else if (search.status === 'no_plan') explanation = '等待队列已经为空，而且所有发现的状态都不满足目标。当前有限对象、完整动作集合与初态下没有符号计划；这不是对任何现实办法都不可能的断言。';
      else if (search.current === null) explanation = '程序先把初态 S0 放入队列。现在还没有搜索，不能因为“门锁着”就直接判任务失败：解锁可能是可用动作。';
      else explanation = '刚检查 S' + search.current + '，目标尚未成立。当前仍有 ' + search.queue.length + ' 个状态等待检查；某个动作被拒绝不等于整个问题无计划。';
      put(searchRoot, '#d3s-search-explanation', explanation);
      q(searchRoot, '#d3s-search-explanation').dataset.kind = search.status === 'no_plan' ? 'blocked' : 'normal';
      q(searchRoot, '#d3s-search-plan-box').hidden = search.status !== 'plan_found';
      const plan = q(searchRoot, '#d3s-search-plan'); plan.replaceChildren();
      if (search.plan) search.plan.forEach(function (action) { const row = node('li'); row.append(node('code', '', action.raw), node('span', '', actionDescription(action))); plan.appendChild(row); });
      if (announce) status(searchRoot, '#d3s-search-live', explanation);
    }
    q(searchRoot, '#d3s-search-step').addEventListener('click', function () { stepSearch(search); renderSearch(true); });
    q(searchRoot, '#d3s-search-run').addEventListener('click', function () {
      while (search.status === 'searching' && search.expanded < 1024) stepSearch(search);
      if (search.status === 'searching') { status(searchRoot, '#d3s-search-live', '已达到保护性步数上限，不能据此报告无计划。'); return; }
      renderSearch(true);
    });
    function resetSearch() { search = createSearch(initialFacts(preset)); renderSearch(true); }
    q(searchRoot, '#d3s-search-reset').addEventListener('click', resetSearch);
    q(searchRoot, '#d3s-search-preset').addEventListener('change', function (event) { preset = event.target.value; resetSearch(); });
    renderSearch(false);
  }
})();
