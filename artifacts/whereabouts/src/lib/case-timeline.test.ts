import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCaseTimeline } from './case-timeline';

const l = (id: string, r: string | null, p: string | null, c: string) => ({ id, reportedTakenOn: r, postedOn: p, createdAt: c });

test('reported date takes precedence over posted date', () => {
  const t = buildCaseTimeline([l('a', '2024-03-01', '2024-01-01', '2024-05-01T00:00:00Z')]);
  assert.equal(t.dated[0].basis, 'reported');
  assert.equal(t.dated[0].date, '2024-03-01');
});
test('falls back to posted and orders chronologically', () => {
  const t = buildCaseTimeline([l('a', null, '2024-04-01', 'x'), l('b', '2024-02-01', null, 'x'), l('c', '2024-04-01', null, 'y')]);
  assert.deepEqual(t.dated.map((e) => e.lead.id), ['b', 'c', 'a']);
  assert.equal(t.dated[2].basis, 'posted');
});
test('undated leads are separate, ordered by added time', () => {
  const t = buildCaseTimeline([l('a', null, null, '2024-02-01'), l('b', null, null, '2024-01-01')]);
  assert.equal(t.dated.length, 0);
  assert.deepEqual(t.undated.map((x) => x.id), ['b', 'a']);
});
