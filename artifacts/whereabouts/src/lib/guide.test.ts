import assert from 'node:assert/strict';
import test from 'node:test';
import type { GuideState } from '@workspace/api-client-react';
import { groundAction, groundActions, mapUrlFor, nextUncheckedPlace, orderPlaces, type SavedResults } from './guide-grounding';
import { demoFactsWithAnswers, demoGroundedActions, demoResults, demoUrgency, guideDemos, getGuideDemo, GUIDE_DEMO_NOW } from './guide-demos';
import { buildResponderSummary, canPlan, hasOpenQuestion, chatFromGuide, CALL_911_NOW, factRows, isYesNoQuestion, needsCallNow, SAMPLE_LABEL } from './guide-state';
import { assessUrgency } from './urgency';

const results: SavedResults = {
  urgencyLevel: 'High',
  risks: [{ sourceId: 'risk-1', name: 'Cold exposure', confidence: null, reason: 'It is cold.', points: 3 }],
  places: [
    { sourceId: 'place-1', name: 'North Park', confidence: 0.7, latitude: 10, longitude: 20, rationale: 'Canonical rationale.', clues: ['Pond'] },
    { sourceId: 'place-2', name: 'South Park', confidence: 0.5, latitude: 11, longitude: 21, rationale: 'Second.', clues: ['Bench'] },
  ],
  reportFacts: ['Last seen: noon (user-reported)'],
};

test('grounding rejects unknown source id', () => {
  assert.equal(groundAction({ kind: 'map', sourceId: 'place-7', sourceName: 'North Park', confidence: 0.7 }, results), null);
});
test('grounding rejects mismatched name', () => {
  assert.equal(groundAction({ kind: 'map', sourceId: 'place-1', sourceName: 'North Parc', confidence: 0.7 }, results), null);
});
test('grounding rejects mismatched confidence', () => {
  assert.equal(groundAction({ kind: 'map', sourceId: 'place-1', sourceName: 'North Park', confidence: 0.9 }, results), null);
  assert.equal(groundAction({ kind: 'call', sourceId: 'risk-1', sourceName: 'Cold exposure', confidence: 0.5 }, results), null);
});
test('grounding rejects kind and source mismatch', () => {
  assert.equal(groundAction({ kind: 'call', sourceId: 'place-1', sourceName: 'North Park', confidence: 0.7 }, results), null);
  assert.equal(groundAction({ kind: 'map', sourceId: 'risk-1', sourceName: 'Cold exposure', confidence: null }, results), null);
  assert.equal(groundAction({ kind: 'share', sourceId: 'risk-1', sourceName: 'Cold exposure', confidence: null }, results), null);
});
test('call names a canonical risk; share names a place and score', () => {
  const call = groundAction({ kind: 'call', sourceId: 'risk-1', sourceName: 'Cold exposure', confidence: null }, results);
  assert.equal(call?.title, 'Call 911: Cold exposure');
  assert.ok(call?.reason.includes('not a probability'));
  const share = groundAction({ kind: 'share', sourceId: 'place-1', sourceName: 'North Park', confidence: 0.7 }, results);
  assert.ok(share?.reason.includes('North Park (match score 70%)'));
  assert.ok(share?.reason.includes('not a confirmed location'));
});
test('grounded text comes from canonical evidence, not prose', () => {
  const g = groundAction({ kind: 'map', sourceId: 'place-1', sourceName: 'North Park', confidence: 0.7, prose: 'They are definitely here' }, results);
  assert.ok(g);
  assert.equal(g.reason, 'Top saved search suggestion (match score 70%). Canonical rationale.');
  assert.equal(g.title, 'Open North Park on a map');
  assert.ok(!JSON.stringify(g).includes('definitely'));
  assert.equal(g.mapUrl, mapUrlFor(results.places[0]));
});
test('map URLs come from coordinates only', () => {
  assert.equal(mapUrlFor({ latitude: 37.7694, longitude: -122.4862 }), 'https://www.google.com/maps/search/?api=1&query=37.7694%2C-122.4862');
  assert.equal(mapUrlFor({ latitude: 200, longitude: 0 }), null);
});
test('duplicates removed and empty input gives no actions', () => {
  const a = { kind: 'share' as const, sourceId: 'place-1', sourceName: 'North Park', confidence: 0.7 };
  assert.equal(groundActions([a, a], results).length, 1);
  assert.equal(groundActions([], results).length, 0);
});
test('checking a place moves the next unchecked place to top', () => {
  const checked = new Set(['place-1']);
  assert.equal(nextUncheckedPlace(results.places, checked)?.sourceId, 'place-2');
  assert.deepEqual(orderPlaces(results.places, checked).map((p) => p.sourceId), ['place-2', 'place-1']);
  assert.equal(nextUncheckedPlace(results.places, new Set(['place-1', 'place-2'])), null);
});

test('demos produce exactly 3 grounded actions and drop invented ones', () => {
  for (const demo of Object.values(guideDemos)) {
    const actions = demoGroundedActions(demo);
    assert.equal(actions.length, 3, demo.slug);
    assert.deepEqual(actions.map((a) => a.kind), ['call', 'map', 'share']);
    const ids = new Set(demoResults(demo).places.map((p) => p.sourceId));
    for (const a of actions) if (a.kind !== 'call') assert.ok(ids.has(a.sourceId));
    const riskNames = demoResults(demo).risks.map((r) => r.name);
    assert.ok(riskNames.includes(actions[0].sourceName));
  }
  assert.equal(getGuideDemo('nobody'), null);
});
test('demo urgency uses unchanged scorer with a fixed clock', () => {
  const joe = guideDemos.joe;
  const expected = assessUrgency({ ...joe.scene, photoTakenAt: new Date(GUIDE_DEMO_NOW.getTime() - 2 * 3_600_000) }, joe.person, GUIDE_DEMO_NOW);
  assert.deepEqual(demoUrgency(joe), expected);
  assert.deepEqual(demoUrgency(joe), demoUrgency(joe));
  assert.equal(joe.facts.needsMedication, true);
  assert.equal(joe.facts.mayWanderOrBeConfused, true);
});

const facts = { ageGroup: 'older_adult' as const, mayWanderOrBeConfused: true, needsMedication: null, limitedMobility: null, nonverbal: null, lastSeenTime: '2 hours ago', lastSeenPlace: null, clothing: null, called911: false, safetyReason: 'dementia', purpose: 'find_missing_person' as const, missingFields: ['lastSeenPlace' as const] };
const state: GuideState = { facts, gate: 'needs_clarification', emergency: true, question: 'Where was he last seen?', questionsAsked: 1, revision: 2, log: [{ role: 'user', text: 'He walked out', at: '2026-01-01T00:00:00Z' }] };

test('emergency without 911 call leads with call message', () => {
  assert.ok(needsCallNow(state));
  const chat = chatFromGuide(state);
  assert.equal(chat[1].text, CALL_911_NOW);
  assert.equal(chat[chat.length - 1].text, 'Where was he last seen?');
  assert.ok(!needsCallNow({ ...state, facts: { ...facts, called911: true } }));
});
test('plan only when allowed', () => {
  assert.equal(canPlan(state), false);
  assert.equal(canPlan({ ...state, gate: 'blocked' }), false);
  assert.equal(canPlan({ ...state, gate: 'allowed' }), true);
});
test('unknown facts are labelled and summary is marked unverified', () => {
  assert.equal(factRows(facts).find((r) => r.key === 'lastSeenPlace')?.value, 'Unknown');
  const s = buildResponderSummary({ name: 'Joe', facts, sample: true });
  assert.ok(s.startsWith(SAMPLE_LABEL));
  assert.ok(s.includes('unverified'));
  assert.ok(s.includes('Last seen (place): Unknown'));
});
test('yes/no detection', () => {
  assert.ok(isYesNoQuestion('Have you called 911?'));
  assert.ok(!isYesNoQuestion('Where was he last seen?'));
});

test('demo first replies lead with the 911 line and the tapped answer sets called911', () => {
  for (const demo of Object.values(guideDemos)) {
    assert.ok(demo.steps[0].ai.startsWith('Please call 911 now.'), demo.slug);
    assert.equal(demoFactsWithAnswers(demo, ['Yes']).called911, true);
    assert.equal(demoFactsWithAnswers(demo, ['No']).called911, false);
    assert.equal(demoFactsWithAnswers(demo, ['Not sure']).called911, null);
    for (const s of demo.steps.slice(1)) assert.ok(!/called 911|thank you for calling/i.test(s.ai));
  }
});
test('question shown even when gate allowed, and not duplicated when embedded', () => {
  const allowed: GuideState = { ...state, gate: 'allowed', emergency: false, question: 'Where was he last seen?' };
  assert.ok(hasOpenQuestion(allowed));
  assert.equal(chatFromGuide(allowed).at(-1)?.text, 'Where was he last seen?');
  const embedded: GuideState = { ...allowed, log: [...allowed.log, { role: 'assistant', text: 'Please call 911 now. Where was he last seen?', at: 'x' }] };
  assert.equal(chatFromGuide(embedded).filter((m) => m.text.includes('Where was he last seen?')).length, 1);
  assert.ok(!hasOpenQuestion({ ...allowed, gate: 'blocked' }));
  assert.ok(!hasOpenQuestion({ ...allowed, question: null }));
});
