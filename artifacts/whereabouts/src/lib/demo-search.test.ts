import assert from "node:assert/strict";
import test from "node:test";
import { demoSamples, refreshDemoSample } from "./demo-samples";
import { missingDuration, searchArea } from "./demo-search";

const now = new Date("2030-07-01T12:00:00Z");
test("all four JSON case files have bounded photo boxes and five decision rows", () => {
  for (const sample of demoSamples) {
    assert.ok(sample.caseFile.nickname);
    assert.ok(sample.caseFile.careNotes);
    assert.ok(sample.annotations.length >= 3);
    for (const box of sample.annotations) {
      assert.ok(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0);
      assert.ok(box.x + box.width <= 100 && box.y + box.height <= 100);
    }
    assert.equal(sample.decisionTrail.length, 5);
    assert.deepEqual(sample.decisionTrail.map((row) => Boolean(row.llm)), [false, true, false, true, false]);
  }
});
test("walking radius uses elapsed hours, terrain speed and age adjustment", () => {
  const samples = demoSamples.map((s) => refreshDemoSample(s, now));
  assert.deepEqual(samples.map((s) => searchArea(s, now).radiusKm), [15, 3, 0.375, 4.5]);
  assert.deepEqual(samples.map((s) => searchArea(s, now).speedKmh), [3, 1, 0.75, 1.5]);
  assert.equal(searchArea(samples[0], new Date(now.getTime() + 24 * 3_600_000)).radiusKm, 25);
  assert.equal(searchArea(samples[0], new Date(now.getTime() + 3_600_000)).radiusKm, 18);
});
test("live elapsed counter handles minute rollover and invalid timestamps", () => {
  assert.equal(missingDuration("2030-07-01T06:01:00Z", now).label, "5h 59m");
  assert.equal(missingDuration("2030-07-01T06:00:00Z", now).label, "6h 0m");
  assert.equal(missingDuration("invalid", now).label, "0h 0m");
  assert.equal(missingDuration("2030-07-02T12:00:00Z", now).label, "0h 0m");
});
test("start-flow overrides stay in memory and age flows into the supplied scorer", () => {
  const original = demoSamples[0];
  const sample = refreshDemoSample(original, now, { nickname: "Taylor", ageGroup: "child", careNotes: "Blue coat", reason: "Welfare check" });
  assert.equal(sample.caseFile.nickname, "Taylor");
  assert.equal(sample.caseFile.careNotes, "Blue coat");
  assert.equal(sample.reason, "Welfare check");
  assert.equal(sample.urgencyInputs.person.ageGroup, "child");
  assert.equal(sample.urgency.score, 8);
  assert.ok(sample.familyFacts.includes("Child"));
  assert.ok(!sample.familyFacts.includes("Adult"));
  assert.equal(original.caseFile.nickname, "Alex");
  assert.equal(original.urgencyInputs.person.ageGroup, "adult");
});
