'use strict';
const assert = require('node:assert/strict');
const logic = require('../assets/day2-logic.js');
let checks = 0;
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function ok(actual, message) { assert.ok(actual, message); checks++; }
function throws(fn, message) { assert.throws(fn, message); checks++; }

// Real values are not discretized by the slider or by Int semantics.
equal(logic.intervalModel(2.2, 2.8, 'Real').witness, 2.5, 'A fractional real model exists.');
equal(logic.intervalModel(2.2, 2.8, 'Int').sat, false, 'No integer lies in that interval.');
equal(logic.intervalModel(-2.8, -2.2, 'Int').sat, false, 'Ceil/floor must work for negatives.');
equal(logic.intervalModel(-2.2, -1.8, 'Int').witness, -2, 'A negative integer witness exists.');
['Real', 'Int'].forEach(function (domain) {
  equal(logic.intervalModel(3, 3, domain).witness, 3, 'Closed singleton bounds permit equality.');
  equal(logic.intervalModel(4, 2, domain).sat, false, 'Reversed bounds have no model.');
  equal(logic.intervalModel(-Infinity, Infinity, domain).witness, 0, 'An unbounded variable admits zero.');
});
equal(logic.booleanRule(true, false), false);
equal(logic.booleanRule(true, true), true);
equal(logic.booleanRule(false, false), true);
equal(logic.booleanRule(false, true), true);

// Scope regression: pop must retract every assertion at its level and preserve lower levels.
let state = logic.createIncrementalState();
throws(function () { logic.applyIncremental(state, {type: 'pop'}); }, 'Base scope cannot be retracted.');
state = logic.applyIncremental(state, {type: 'check'});
equal(state.lastCheck.model.x, 2);
state = logic.applyIncremental(state, {type: 'push'});
equal(state.lastCheck, null, 'A mutation invalidates the displayed last check.');
state = logic.applyIncremental(state, {type: 'add', key: 'upper6'});
state = logic.applyIncremental(state, {type: 'add', key: 'lower4'});
state = logic.applyIncremental(state, {type: 'check'});
equal(state.lastCheck.model.x, 4);
state = logic.applyIncremental(state, {type: 'push'});
throws(function () { logic.applyIncremental(state, {type: 'push'}); }, 'The visual stack has an explicit two-level limit.');
state = logic.applyIncremental(state, {type: 'add', key: 'upper1'});
state = logic.applyIncremental(state, {type: 'check'});
equal(state.lastCheck.sat, false);
state = logic.applyIncremental(state, {type: 'pop'});
state = logic.applyIncremental(state, {type: 'check'});
equal(state.lastCheck.model.x, 4, 'Removing upper1 restores the lower scope.');
state = logic.applyIncremental(state, {type: 'pop'});
equal(logic.incrementalConstraints(state).map(function (item) { return item.label; }), ['x ≥ 2'], 'Both assertions in the former scope are removed.');
state = logic.applyIncremental(state, {type: 'check'});
equal(state.lastCheck.model.x, 2);

// One returned core need not explain or repair every simultaneous conflict.
const all = ['A', 'B', 'C', 'D', 'E'];
equal(logic.minimalConflictSubsets(all), [['A', 'B'], ['C', 'D']], 'There are two independent minimal conflicts.');
let core = logic.classifyCore(all, ['A', 'B']);
ok(core.isCore && core.inclusionMinimal);
equal(core.minimumCardinality, 2);
core = logic.classifyCore(all, all);
ok(core.isCore && !core.inclusionMinimal, 'An unsatisfiable whole set may contain redundant labels.');
core = logic.classifyCore(['B', 'C', 'D', 'E'], ['B']);
equal(core.full.sat, false, 'Breaking X conflict leaves Y conflict in the full formula.');
equal(core.isCore, false, 'The remaining candidate B is satisfiable by itself.');
core = logic.classifyCore(['B', 'D', 'E'], ['B', 'D']);
equal(core.full.sat, true, 'Breaking both conflicts restores this explicitly limited model.');
equal(core.minimalCores, []);
equal(logic.classifyCore(['B', 'C', 'D', 'E'], ['A', 'B']).isCore, false, 'A candidate must be a subset of the active formula.');
equal(logic.classifyCore(all, []).isCore, false, 'With no untracked background, an empty candidate is satisfiable.');

// Preferences never rescue an empty hard-feasible set; centimeters avoid slider rounding drift.
const options = {capCm: 120, robotCm: 60, marginCm: 10, desiredCm: 110, strategy: 'desired'};
let doors = logic.evaluateCandidates(options);
equal(doors.minimumCm, 80);
equal(doors.feasible.map(function (item) { return item.cm; }), [80, 90, 100, 110, 120]);
equal(doors.selected.cm, 110);
doors = logic.evaluateCandidates(Object.assign({}, options, {desiredCm: 85}));
equal(doors.selected.cm, 80, 'A tie uses the documented smaller-width tie break.');
doors = logic.evaluateCandidates(Object.assign({}, options, {strategy: 'compact'}));
equal(doors.selected.cm, 80, 'The second preference ranks only feasible candidates.');
doors = logic.evaluateCandidates(Object.assign({}, options, {capCm: 80}));
equal(doors.feasible.map(function (item) { return item.cm; }), [80], 'Equality at both hard bounds is allowed.');
['desired', 'compact'].forEach(function (strategy) {
  doors = logic.evaluateCandidates({capCm: 70, robotCm: 70, marginCm: 10, desiredCm: 60, strategy: strategy});
  equal(doors.sat, false, 'A changed preference leaves contradictory hard bounds infeasible.');
  equal(doors.selected, null);
});
doors = logic.evaluateCandidates({capCm: 89, robotCm: 75, marginCm: 5, desiredCm: 87, strategy: 'desired'});
equal(doors.sat, false, 'A continuous interval 85–89 cm has no candidate in the explicitly discrete domain.');

console.log('day2-logic: ' + checks + ' semantic checks passed (domains, scopes, cores, hard/soft boundaries).');
