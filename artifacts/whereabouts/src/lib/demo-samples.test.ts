import assert from "node:assert/strict";
import test from "node:test";
import { demoSamples, getDemoSample } from "./demo-samples";

test("demo samples include the three requested scenarios and complete result data", () => {
  assert.deepEqual(
    demoSamples.map((sample) => sample.scenario),
    ["Lost hiker", "Missing grandparent", "Child separated"],
  );

  for (const sample of demoSamples) {
    const { investigation } = sample;
    assert.ok(sample.imageUrl.startsWith("/demo-samples/"));
    assert.ok(sample.sourceImageUrl.startsWith("https://images.unsplash.com/"));
    assert.equal(investigation.status, "done");
    assert.ok(investigation.clues.length >= 3);
    assert.ok(investigation.candidates.length >= 3);
    assert.equal(investigation.analysis?.search_areas?.length, investigation.candidates.length);
    for (const candidate of investigation.candidates) {
      assert.ok(candidate.confidence >= 0 && candidate.confidence <= 1);
      const coordinates = new URL(candidate.mapsUrl).searchParams.get("query");
      assert.match(coordinates ?? "", /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/);
    }
  }
});

test("demo sample lookup never creates or persists an investigation", () => {
  assert.equal(getDemoSample("sample-lost-hiker")?.investigation.id, "sample-lost-hiker");
  assert.equal(getDemoSample("not-a-sample"), undefined);
});
