import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoupeDwell, type LoupePhase } from './loupe-dwell';

function harness() {
  let now = 0;
  let nextId = 0;
  const jobs = new Map<number, { at: number; run: () => void }>();
  const phases: LoupePhase[] = [];
  const dwell = createLoupeDwell((phase) => phases.push(phase), {
    schedule(run, delay) { const id = ++nextId; jobs.set(id, { at: now + delay, run }); return id; },
    cancel(id) { jobs.delete(id as number); },
  });
  const tick = (ms: number) => {
    const until = now + ms;
    while (true) {
      const entry = [...jobs.entries()].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      now = entry[1].at;
      jobs.delete(entry[0]);
      entry[1].run();
    }
    now = until;
  };
  return { dwell, phases, tick, jobs };
}
test('starts binary, waits 2000ms, then resolves JSON after a finite decode', () => {
  const { dwell, phases, tick } = harness();
  dwell.move({ x: 20, y: 30 });
  tick(1999);
  assert.deepEqual(phases, ['binary']);
  tick(1);
  assert.equal(phases.at(-1), 'decoding');
  tick(260);
  assert.equal(phases.at(-1), 'json');
});
test('movement resets immediately and jitter does not extend the dwell', () => {
  const { dwell, phases, tick } = harness();
  dwell.move({ x: 20, y: 30 });
  tick(1000);
  dwell.move({ x: 21, y: 31 });
  tick(1000);
  assert.equal(phases.at(-1), 'decoding');
  dwell.move({ x: 40, y: 50 });
  assert.equal(phases.at(-1), 'binary');
  tick(259);
  assert.equal(phases.at(-1), 'binary');
  tick(2001);
  assert.equal(phases.at(-1), 'json');
});
test('pointerleave cancels pending dwell but keeps an already settled JSON usable', () => {
  const { dwell, phases, tick, jobs } = harness();
  dwell.move({ x: 10, y: 10 });
  dwell.leave();
  tick(5000);
  assert.equal(phases.at(-1), 'binary');
  assert.equal(jobs.size, 0);
  dwell.move({ x: 10, y: 10 });
  tick(2260);
  dwell.leave();
  assert.equal(phases.at(-1), 'json');
});
test('sample reset and disposal prevent old timers revealing previous data', () => {
  const { dwell, phases, tick, jobs } = harness();
  dwell.move({ x: 10, y: 10 });
  tick(2000);
  dwell.reset();
  tick(260);
  assert.equal(phases.at(-1), 'binary');
  dwell.move({ x: 10, y: 10 });
  dwell.dispose();
  const length = phases.length;
  tick(5000);
  dwell.move({ x: 40, y: 30 });
  assert.equal(phases.length, length);
  assert.equal(jobs.size, 0);
});
test('movement after resolved JSON immediately returns to binary', () => {
  const { dwell, phases, tick } = harness();
  dwell.move({ x: 12, y: 24 });
  tick(2260);
  assert.equal(phases.at(-1), 'json');
  dwell.move({ x: 52, y: 64 });
  assert.equal(phases.at(-1), 'binary');
  tick(1999);
  assert.equal(phases.at(-1), 'binary');
});
test('callbacks from a cancelled timer cannot resolve a newer inspection', () => {
  const callbacks: Array<() => void> = [];
  const phases: LoupePhase[] = [];
  const dwell = createLoupeDwell((phase) => phases.push(phase), {
    schedule(callback) { callbacks.push(callback); return callbacks.length; },
    cancel() { /* Deliberately retain a stale callback to test generation guard. */ },
  });
  dwell.move({ x: 10, y: 10 });
  dwell.move({ x: 60, y: 10 });
  callbacks[0]();
  assert.equal(phases.at(-1), 'binary');
  dwell.dispose();
  callbacks[1]();
  assert.equal(phases.at(-1), 'binary');
});
