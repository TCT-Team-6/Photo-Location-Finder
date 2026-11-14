import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepLoupeSpring } from './loupe-physics';

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
  assert.deepEqual(stepLoupeSpring(initial, 400, 100), stepLoupeSpring(initial, 400, 1 / 10));
  assert.deepEqual(stepLoupeSpring(initial, 400, -1), initial);
});
test('170/22 position spring has one small controlled overshoot, not a tween', () => {
  let state = { position: 0, velocity: 0 };
  let maximum=0;
  for (let i = 0; i < 360; i++) {
    state = stepLoupeSpring(state, 100, 1 / 60);
    maximum=Math.max(maximum,state.position);
  }
  assert.ok(maximum>100&&maximum<102);
});
