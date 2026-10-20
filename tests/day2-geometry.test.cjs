'use strict';
const assert = require('node:assert/strict');
const {nonoverlap, packTwoSquares, sharedWalls, analyzeContact} = require('../assets/day2-geometry.js');
let checks = 0;
function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
function truth(value) { assert.ok(value); checks++; }
const A = {x: 0, y: 0, w: 2, h: 2};
function B(x, y) { return {x, y, w: 2, h: 2}; }

equal(nonoverlap(A, B(1, 1)).directions, [false, false, false, false]);
equal(nonoverlap(A, B(1, 1)).overlapArea, 1);
equal(nonoverlap(A, B(2, 0)).directions, [true, false, false, false]);
equal(nonoverlap(A, B(-2, 0)).directions, [false, true, false, false]);
equal(nonoverlap(A, B(0, 2)).directions, [false, false, true, false]);
equal(nonoverlap(A, B(0, -2)).directions, [false, false, false, true]);
equal(nonoverlap(A, B(2, 2)).directions, [true, false, true, false]);
equal(nonoverlap(A, B(2, 2)).interiorOverlap, false);
equal(nonoverlap(A, B(0, 0)).overlapArea, 4);
// Positive boxes cannot satisfy both opposing inequalities at once.
for (const x of [-3, -2, -1, 0, 1, 2, 3]) for (const y of [-3, -2, -1, 0, 1, 2, 3]) {
  const result = nonoverlap(A, B(x, y));
  equal(result.and, false);
  equal(result.or, !result.interiorOverlap);
}

const packingCases = [
  [4, 3, true], [3, 3, false], [3, 4, true], [2, 4, true],
  [4, 2, true], [1.5, 6, false], [5, 5, true], [2, 2, false],
  [3.999, 3.999, false], [4.001, 2, true], [4, 1.999, false], [0, 5, false]
];
for (const [w, h, expected] of packingCases) {
  const result = packTwoSquares(w, h);
  equal(result.possible, expected);
  if (result.witness) {
    const [a, b] = result.witness;
    truth(nonoverlap(a, b).or);
    truth(result.witness.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h));
  } else equal(result.witness, null);
}
truth(3 * 3 >= 2 * 2 * 2); equal(packTwoSquares(3, 3).possible, false);
equal(packTwoSquares(300, 400, 200).possible, packTwoSquares(3, 4, 2).possible);

equal(sharedWalls(A, B(2, 1)), [{axis: 'vertical', coordinate: 2, low: 1, high: 2}]);
equal(sharedWalls(A, B(-2, 0)), [{axis: 'vertical', coordinate: 0, low: 0, high: 2}]);
equal(sharedWalls(A, B(0.5, 2)), [{axis: 'horizontal', coordinate: 2, low: 0.5, high: 2}]);
equal(sharedWalls(A, B(0, -2)), [{axis: 'horizontal', coordinate: 0, low: 0, high: 2}]);
equal(sharedWalls(A, B(2, 2)), []);
equal(sharedWalls(A, B(2.000001, 0)), []);
equal(sharedWalls(A, B(1.999999, 0)), []);
equal(sharedWalls(A, B(0, 0)), []);
equal(analyzeContact(A, B(2, 2), 1, 0.5, 0.3, 0).cornerOnly, true);
equal(analyzeContact(A, B(2.5, 0), 1, 0.5, 0.3, 0).cornerOnly, false);

// UI geometry uses integer centimeters, including door endpoints and margins.
const Acm = {x: 0, y: 0, w: 200, h: 200};
const Bcm = {x: 200, y: 0, w: 200, h: 200};
equal(analyzeContact(Acm, Bcm, 100, 90, 60, 10).feasible, true);
equal(analyzeContact(Acm, Bcm, 100, 80, 60, 10).feasible, true);
equal(analyzeContact(Acm, Bcm, 100, 79, 60, 10).widthFits, false);
equal(analyzeContact(Acm, Bcm, 100, 200, 60, 10).openingContained, true);
equal(analyzeContact(Acm, Bcm, 100, 201, 60, 10).openingContained, false);
equal(analyzeContact(Acm, Bcm, 40, 80, 60, 10).openingContained, true);
equal(analyzeContact(Acm, Bcm, 39, 80, 60, 10).openingContained, false);
equal(analyzeContact(Acm, {...Bcm, y: 100}, 150, 100, 60, 10).feasible, true);
equal(analyzeContact(Acm, {...Bcm, y: 100}, 115, 90, 60, 10).openingContained, false);
equal(analyzeContact(Acm, {x: 0, y: 200, w: 200, h: 200}, 100, 90, 60, 10).feasible, true);
equal(analyzeContact(Acm, {...Bcm, x: 225}, 100, 90, 60, 10).wall, null);
equal(analyzeContact(Acm, {...Bcm, x: 150}, 100, 90, 60, 10).feasible, false);
equal(analyzeContact(Acm, Bcm, 100, 60, 60, 0).feasible, true);
equal(analyzeContact(Acm, Bcm, 100, 60, 60, 1).feasible, false);

console.log('day2-geometry: ' + checks + ' checks passed (OR vs AND, contact boundaries, packing witnesses, width and margin).');
