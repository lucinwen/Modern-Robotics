'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/day3-symbolic.js');
let checks = 0;
function equal(actual, expected, reason) { assert.deepEqual(actual, expected, reason); checks += 1; }
function ok(value, reason) { assert.ok(value, reason); checks += 1; }
function sorted(items) { return [...items].sort(); }
const actions = model.groundActions();
const find = raw => actions.find(action => action.raw === raw);
const start = model.initialFacts();

// Failed attempts cannot alter the state; unlocking does not silently open a door.
const blockedOpen = model.applyAction(start, find('(open r d a)'));
equal(blockedOpen.applicable, false, 'A locked door is not an openable door in this domain.');
equal(blockedOpen.facts, start, 'A failed precondition must leave every fact unchanged.');
equal(blockedOpen.missing, ['(unlocked d)']);
const unlocked = model.applyAction(start, find('(unlock r d k a)'));
equal(unlocked.deleted, ['(locked d)']);
equal(unlocked.added, ['(unlocked d)']);
ok(!unlocked.facts.includes('(opened d)'), 'Unlock must not imply opened.');
equal(model.applyAction(unlocked.facts, find('(move r a b d)')).applicable, false, 'Unlocked but closed cannot be traversed.');
const opened = model.applyAction(unlocked.facts, find('(open r d a)'));
ok(opened.facts.includes('(unlocked d)'), 'Opening preserves the unlocked fact.');
const repeatedOpen = model.applyAction(opened.facts, find('(open r d a)'));
equal(repeatedOpen.applicable, true);
equal(repeatedOpen.added, [], 'An already true effect does not create a new fact.');
equal(model.stateKey(repeatedOpen.facts), model.stateKey(opened.facts), 'Repeated open is a self-loop.');
const moved = model.applyAction(opened.facts, find('(move r a b d)'));
equal(moved.added, ['(at r b)']);
equal(moved.deleted, ['(at r a)']);
ok(!moved.facts.includes('(holding r cup)'), 'Being in the cup room is not the goal.');
const held = model.applyAction(moved.facts, find('(pickup r cup b)'));
equal(held.added, ['(holding r cup)']);
equal(held.deleted, ['(handempty r)', '(item-at cup b)']);
ok(held.facts.includes('(has-key r k)'), 'The key is inventory, not the grasping hand.');
equal(model.applyAction(held.facts, find('(pickup r cup b)')).applicable, false, 'The same cup cannot be picked up twice.');
equal(start, model.initialFacts(), 'Transitions must not mutate their input snapshot.');
equal(model.stateKey([...start].reverse()), model.stateKey(start), 'State identity is independent of fact display order.');
equal(model.stateKey([...start, start[0]]), model.stateKey(start), 'Repeated factual assertions do not create a new state.');

// A no-plan conclusion requires exhausting this finite graph, including loops.
let search = model.createSearch(start);
equal(search.status, 'searching');
equal(search.expanded, 0);
model.stepSearch(search);
equal(search.status, 'searching', 'A single rejected open action is not a no-plan proof.');
equal(search.queue.length, 1, 'The legal unlock successor remains available.');
const successful = model.runSearch(start);
equal(successful.status, 'plan_found');
equal(successful.plan.map(action => action.raw), ['(unlock r d k a)', '(open r d a)', '(move r a b d)', '(pickup r cup b)']);
equal(successful.plan.length, 4);
const noKey = model.runSearch(model.initialFacts('missing_key'));
equal(noKey.status, 'no_plan');
equal(noKey.queue, []);
equal(noKey.seen.size, 1, 'No invented obtain-key action exists.');
const noGrasp = model.runSearch(model.initialFacts('no_grasp'));
equal(noGrasp.status, 'no_plan');
equal(noGrasp.queue, []);
ok(noGrasp.candidates.some(candidate => candidate.kind === 'duplicate'), 'Returning through the door must be detected as a repeated state.');
equal(noGrasp.seen.size, 4, 'Opening and movement loops cannot create infinitely many states.');
equal(model.runSearch(model.initialFacts('already_open')).plan.length, 2);
const zero = model.runSearch(held.facts);
equal(zero.status, 'plan_found');
equal(zero.plan, [], 'An initial goal state is a valid zero-action plan.');
equal(model.runSearch(start, undefined, 0).status, 'budget_exhausted', 'A search budget is not an impossibility proof.');
ok(!model.stateInvariants([...start, '(at r b)']).one_robot_room, 'The invariant audit detects two robot rooms.');
ok(!model.stateInvariants([...start, '(opened d)']).opened_implies_unlocked, 'The invariant audit detects a locked-open contradiction.');

// Independent Python/PDDL parser + BFS records are the semantic cross-check.
const records = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/day-03-results.json'), 'utf8'));
equal(records.schema_version, 1);
equal(records.planning_cases.length, 9);
records.planning_cases.forEach(record => {
  const actual = model.runSearch(record.initial_facts, record.goal);
  equal(actual.status, record.status, record.id + ': independent search status');
  equal(actual.plan ? actual.plan.length : null, record.plan_length, record.id + ': shortest action count');
  actual.nodes.forEach(entry => {
    ok(Object.values(model.stateInvariants(entry.facts)).every(Boolean), record.id + ': every reached state preserves exclusivity and hand/cup invariants.');
  });
  if (record.status === 'no_plan') {
    equal(actual.queue.length, 0, record.id + ': failure was exhaustive');
    equal(record.search_exhausted, true, record.id + ': Python record reports exhaustive search');
    return;
  }
  let replay = record.initial_facts;
  equal(replay, record.states[0], record.id + ': complete initial state including static facts');
  record.plan.forEach((step, index) => {
    const local = find(step.raw);
    ok(local, record.id + ': recorded action is in the declared finite domain');
    ['pre', 'add', 'del'].forEach(field => equal(sorted(local[field]), sorted(step[field]), record.id + ': source PDDL ' + field));
    const result = model.applyAction(replay, local);
    equal(result.applicable, true, record.id + ': recorded plan satisfies full original preconditions');
    equal(result.facts, record.states[index + 1], record.id + ': complete state after step ' + (index + 1));
    replay = result.facts;
  });
  ok(model.hasGoal(replay, record.goal), record.id + ': replay reaches the stated goal');
});
['success', 'missing_key', 'missing_unlock', 'missing_open', 'no_grasp', 'ungraspable', 'already_open', 'narrow_door'].forEach(id => {
  equal(model.initialFacts(id), records.planning_cases.find(record => record.id === id).initial_facts, id + ': interactive preset matches PDDL input');
});

console.log('day3-symbolic: ' + checks + ' semantic checks passed (state transitions, frame facts, loops, exhaustive BFS, and 9 independent PDDL records).');
