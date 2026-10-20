'use strict';
const assert = require('node:assert/strict');
const {clearance, pointSegmentDistance, checkPolyline, planarReach, feedbackCase} = require('../assets/day3-geometry.js');
let checked = 0;
function equal(actual, expected) { assert.deepEqual(actual, expected); checked += 1; }
function near(actual, expected, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) < tolerance, actual + ' differs from ' + expected); checked += 1; }

// Domain and chosen-candidate feasibility must remain separate.
const centered = clearance(90, 60, 10, 0);
equal([centered.low, centered.high, centered.possible, centered.current], [-5, 5, true, true]);
equal(clearance(90, 60, 10, 5).current, true);
equal(clearance(90, 60, 10, 5.0001).current, false);
const offcenter = clearance(90, 60, 10, 20);
equal([offcenter.possible, offcenter.current, offcenter.bodyClear], [true, false, false]);
equal([clearance(90, 60, 10, 10).bodyClear, clearance(90, 60, 10, 10).current], [true, false]);
equal([clearance(50, 60, 10, 0).possible, clearance(50, 60, 10, 0).current], [false, false]);
equal([clearance(60, 60, 0, 0).low, clearance(60, 60, 0, 0).high, clearance(60, 60, 0, 0).current], [0, 0, true]);
equal(clearance(60, 60, 0, .001).current, false);
assert.throws(() => clearance(90, 60, -1, 0), RangeError); checked += 1;

// The closest point may lie inside a segment, at either endpoint, or on a zero-length segment.
equal(pointSegmentDistance([0, 0], [-100, 0], [100, 0]), {distance: 0, closest: [0, 0], t: .5});
equal(pointSegmentDistance([0, 0], [30, 40], [60, 80]), {distance: 50, closest: [30, 40], t: 0});
equal(pointSegmentDistance([0, 0], [60, 80], [30, 40]), {distance: 50, closest: [30, 40], t: 1});
equal(pointSegmentDistance([0, 0], [30, 40], [30, 40]), {distance: 50, closest: [30, 40], t: 0});
const obstacle = {center: [0, 0], radius: 35};
const straight = checkPolyline([[-120, 0], [120, 0]], obstacle, 20, 5);
equal([straight.endpointsPass, straight.pass, straight.minimum, straight.threshold], [true, false, 0, 60]);
const detour = checkPolyline([[-120, 0], [-65, 85], [65, 85], [120, 0]], obstacle, 20, 5);
equal([detour.endpointsPass, detour.pass], [true, true]);
near(detour.minimum, 85);
equal(checkPolyline([[-120, 60], [120, 60]], obstacle, 20, 5).pass, true);
equal(checkPolyline([[-120, 59.999], [120, 59.999]], obstacle, 20, 5).pass, false);
equal(checkPolyline([[-120, 60.001], [120, 60.001]], obstacle, 20, 5).pass, true);

// Position reachability uses a base-relative vector, with both inner and outer limits.
equal(planarReach(55, 45, 60, 170, 70).reason, 'too_far');
equal(planarReach(55, 45, 5, 70, 70).reason, 'too_close');
equal(planarReach(55, 45, 0, 70, 70).reachable, false);
equal(planarReach(55, 45, 100, 70, 70).reachable, true);
equal(planarReach(55, 45, 100.0001, 70, 70).reachable, false);
equal(planarReach(55, 45, 10, 70, 70).reachable, true);
equal(planarReach(55, 45, 9.9999, 70, 70).reachable, false);
equal(planarReach(55, 45, 0, 170, 70).reachable, true);
equal(planarReach(55, 45, 0, 170.0001, 70).reachable, false);
const targetCases = [[50, 110], [60, 110], [100, 70], [10, 70], [0, 170], [30, 30]];
targetCases.forEach(([x, h]) => {
  const result = planarReach(55, 45, x, h, 70);
  equal(result.reachable, true);
  result.solutions.forEach(solution => {
    // Verify each reconstructed physical segment and the requested endpoint independently.
    near(Math.hypot(solution.elbow[0], solution.elbow[1] - 70), 55);
    near(Math.hypot(solution.end[0] - solution.elbow[0], solution.end[1] - solution.elbow[1]), 45);
    near(solution.end[0], x); near(solution.end[1], h);
  });
});
equal(planarReach(55, 45, 100, 70, 70).coincident, true);
equal(planarReach(55, 45, 50, 110, 70).coincident, false);

// Feedback preserves the original model and identifies which action needs a geometric condition.
equal([feedbackCase('standard', 1).symbolic, feedbackCase('standard', 1).passed], [true, true]);
const missing = feedbackCase('missing_key', 1);
equal([missing.symbolic, missing.plan.length, missing.failure.kind, missing.failure.condition], [false, 0, 'symbolic', 'has-key(r,k)']);
const narrow = feedbackCase('narrow', 1), revisedNarrow = feedbackCase('narrow', 2);
equal([narrow.symbolic, narrow.passed, narrow.failure.action], [true, false, 'move(r,a,b,d)']);
equal([narrow.world.door, revisedNarrow.world.door, revisedNarrow.passed], [50, 90, true]);
equal(feedbackCase('narrow', 1).world.door, 50);
const high = feedbackCase('high', 1), revisedHigh = feedbackCase('high', 2);
equal([high.symbolic, high.passed, high.failure.action], [true, false, 'open(r,d,a)']);
equal([high.world.height, revisedHigh.world.height, revisedHigh.world.x, revisedHigh.passed], [170, 110, 60, true]);
equal(feedbackCase('standard', 1).plan, ['unlock(r,d,k,a)', 'open(r,d,a)', 'move(r,a,b,d)', 'pickup(r,cup,b)']);
assert.throws(() => feedbackCase('missing_key', 2), RangeError); checked += 1;
console.log('PASS: ' + checked + ' Day 3 geometry and feedback checks.');
