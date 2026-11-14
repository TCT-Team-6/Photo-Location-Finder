import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleBinary, stepLoupeSpring } from './loupe-physics';

test('spring follows with lag, then settles without runaway motion', () => {
  let state = { position: 0, velocity: 0 };
  state = stepLoupeSpring(state, 100, 1 / 60);
  assert.ok(state.position > 0 && state.position < 100);
  for (let i = 0; i < 300; i++) state = stepLoupeSpring(state, 100, 1 / 60);
  assert.ok(Math.abs(state.position - 100) < .001);
  assert.ok(Math.abs(state.velocity) < .001);
});
test('long/negative deltas are bounded and do not explode', () => {
  const initial = { position: 5, velocity: 2 };
  assert.deepEqual(stepLoupeSpring(initial, 400, 100), stepLoupeSpring(initial, 400, 1 / 30));
  assert.deepEqual(stepLoupeSpring(initial, 400, -1), initial);
});
test('binary visual is deterministic and changes with image location', () => {
  assert.match(sampleBinary(120, 2, 3), /^[01]{8}$/);
  assert.equal(sampleBinary(120, 2, 3), sampleBinary(120, 2, 3));
  const region = (seed: number) => Array.from({ length: 8 }, (_, row) => sampleBinary(seed, row, 1)).join('');
  assert.notEqual(region(120), region(2190));
});
