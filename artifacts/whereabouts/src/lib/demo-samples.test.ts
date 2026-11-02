import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { demoSamples, getDemoSample } from "./demo-samples";
import { assessUrgency } from "./urgency";
import { urgencyInputsFromInvestigation } from "./urgency-inputs";

test("demo samples include the three requested scenarios and complete result data", () => {
  assert.deepEqual(
    demoSamples.map((sample) => sample.scenario),
    ["Lost hiker", "Missing grandparent", "Child separated"],
  );

  for (const sample of demoSamples) {
    const { investigation } = sample;
    assert.ok(sample.imageUrl.startsWith("/demo-samples/"));
    assert.ok(["https://images.unsplash.com", "https://www.pexels.com"].includes(new URL(sample.sourceImageUrl).origin));
    assert.ok(sample.licenseUrl.startsWith("https://"));
    assert.equal(investigation.status, "done");
    assert.ok(investigation.clues.length >= 3);
    assert.ok(investigation.candidates.length >= 3);
    assert.equal(investigation.analysis?.search_areas?.length, investigation.candidates.length);
    for (const candidate of investigation.candidates) {
      assert.ok(candidate.confidence >= 0 && candidate.confidence <= 1);
      const coordinates = new URL(candidate.mapsUrl).searchParams.get("query");
      assert.match(coordinates ?? "", /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/);
    }
    investigation.candidates.forEach((candidate, index) => {
      const area = investigation.analysis!.search_areas![index];
      assert.equal(area.name, candidate.place);
      assert.equal(area.score, candidate.confidence);
      const coordinates = new URL(candidate.mapsUrl).searchParams.get("query")!.split(",").map(Number);
      assert.deepEqual(coordinates, [area.latitude, area.longitude]);
    });
  }
});

test("demo sample lookup never creates or persists an investigation", () => {
  assert.equal(getDemoSample("sample-lost-hiker")?.investigation.id, "sample-lost-hiker");
  assert.equal(getDemoSample("not-a-sample"), undefined);
});

test("samples match the requested mountain trail, city park and beach boardwalk", () => {
  assert.deepEqual(demoSamples.map((sample) => sample.investigation.title), [
    "Lost hiker – mountain trail",
    "Missing grandparent – city park",
    "Child separated – beach boardwalk",
  ]);
  assert.deepEqual(demoSamples.map((sample) => sample.urgencyInputs.scene.setting), ["trail", "park", "beach"]);
});

test("supplied urgency module is byte-for-byte unchanged", () => {
  assert.deepEqual(
    readFileSync(new URL("./urgency.ts", import.meta.url)),
    readFileSync(new URL("../../../../attached_assets/urgency_1793659515474.ts", import.meta.url)),
  );
});

test("stored JSON urgency results come from the supplied scorer and only available inputs", () => {
  for (const sample of demoSamples) {
    const inputs = urgencyInputsFromInvestigation(sample.investigation);
    assert.deepEqual(JSON.parse(JSON.stringify(inputs)), sample.urgencyInputs);
    assert.deepEqual(assessUrgency(inputs.scene, inputs.person, new Date(sample.urgencyAssessedAt)), sample.urgency);
    assert.equal(inputs.scene.temperatureC, undefined);
    assert.equal(inputs.scene.photoTakenAt, undefined);
    assert.equal(inputs.scene.timeOfDay, undefined);
    assert.equal(inputs.scene.weather, undefined);
    assert.deepEqual(inputs.person, {});
    assert.equal(sample.urgency.timeSincePhoto, null);
    assert.ok(sample.urgency.risks.some((risk) => risk.label === "Photo time unknown"));
  }
  assert.deepEqual(demoSamples.map((sample) => [sample.urgency.level, sample.urgency.score]), [
    ["Moderate", 3], ["Low", 1], ["Moderate", 3],
  ]);
});

test("adapter never derives health, weather or water facts from case names, guesses or negated prose", () => {
  const record = {
    ...demoSamples[0].investigation,
    title: "Child with dementia near water",
    context: "Needs medication, 32°C, at night.",
    shotAt: "2026-11-01",
    clues: [
      { label: "Setting", observation: "Possibly a beach or a park", significance: "Near water" },
      { label: "Water nearby", observation: "No water is visible", significance: "Uncertain" },
      { label: "Weather", observation: "No rain", significance: "" },
    ],
  };
  assert.deepEqual(urgencyInputsFromInvestigation(record), { scene: {}, person: {} });
});

test("adapter reads explicit observations and qualified capture metadata, preserving unknown temperature", () => {
  const record = {
    ...demoSamples[0].investigation,
    clues: [
      { label: "Setting", observation: "Trail: marked walking route", significance: "" },
      { label: "Terrain", observation: "Steep: sloping ground", significance: "" },
      { label: "Water nearby", observation: "No: none reported", significance: "" },
      { label: "Time of day", observation: "Evening: recorded light clue", significance: "" },
      { label: "Weather", observation: "Rain, wind: explicit observations", significance: "" },
    ],
    analysis: { details: { exif: { timestamp: "2026-11-02T08:00:00Z" } } },
  };
  const person = { needsMedication: true };
  const inputs = urgencyInputsFromInvestigation(record, person);
  assert.deepEqual(inputs.scene, {
    setting: "trail", terrain: "steep", nearWater: false,
    timeOfDay: "evening", weather: ["rain", "wind"],
    photoTakenAt: new Date("2026-11-02T08:00:00Z"),
  });
  assert.deepEqual(inputs.person, person);
  assert.notEqual(inputs.person, person);
  record.analysis.details.exif.timestamp = "2026-11-02";
  assert.equal(urgencyInputsFromInvestigation(record).scene.photoTakenAt, undefined);
  record.analysis.details.exif.timestamp = "invalid timestamp";
  assert.equal(urgencyInputsFromInvestigation(record).scene.photoTakenAt, undefined);
});
