import assert from 'node:assert/strict';
import test from 'node:test';
import { confidencePercent, confidenceTier, demoPipeline, heatColor, livePipeline, supportingClues, CONFIDENCE_TIERS } from './result-insights';
import { demoSamples } from './demo-samples';

test('Confidence tiers: 75+ strong green, 50-74 possible orange, under 50 weak grey', () => {
  assert.equal(confidenceTier(75).label, 'Strong lead');
  assert.equal(confidenceTier(74).label, 'Possible lead');
  assert.equal(confidenceTier(50).label, 'Possible lead');
  assert.equal(confidenceTier(49).label, 'Weak lead');
  assert.equal(confidenceTier(null).key, 'unavailable');
  assert.equal(confidencePercent(0.82), 82);
  assert.equal(confidencePercent(68), 68);
  assert.equal(confidencePercent(Number.NaN), null);
  assert.deepEqual(heatColor(1), CONFIDENCE_TIERS.strong.rgb);
  assert.deepEqual(heatColor(0), CONFIDENCE_TIERS.weak.rgb);
});
test('supporting clues come only from returned evidence and map to photo tags', () => {
  const clues = supportingClues({ clues: ['Mountain trail', 'Forest slopes'], rationale: '' }, ['Stone trail', 'Conifers', 'Rocky ridge']);
  assert.deepEqual(clues.map((c) => [c.label, c.photoTag]), [['Mountain trail', 'Stone trail'], ['Forest slopes', null]]);
  assert.deepEqual(supportingClues({ clues: [], rationale: 'Nothing matching.' }, ['Conifers']), []);
  assert.equal(supportingClues({ clues: [], rationale: 'Visible conifers near a lake.' }, ['Conifers'])[0]?.source, 'rationale');
});
test('pipeline checks reflect response evidence; demo model is GPT Terra', () => {
  const empty = livePipeline({ clues: [], candidates: [], analysis: null });
  assert.ok(empty.stages.every((s) => !s.complete));
  assert.equal(empty.model, null);
  const partial = livePipeline({ clues: [{}], candidates: [{ confidence: 0.6, mapsUrl: 'https://maps.google.com/?q=nowhere' }], analysis: null });
  assert.deepEqual(partial.stages.map((s) => s.complete), [false, true, true, false, true]);
  for (const sample of demoSamples) {
    const p = demoPipeline(sample.decisionTrail);
    assert.equal(p.model, 'GPT Terra');
    assert.equal(p.stages.length, 5);
    assert.ok(!JSON.stringify(sample.decisionTrail).includes('GPT-4o'));
  }
});
