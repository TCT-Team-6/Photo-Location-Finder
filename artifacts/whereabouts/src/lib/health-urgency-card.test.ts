import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HealthUrgencyCard } from "../components/health-urgency-card";
import { demoSamples } from "./demo-samples";
import { assessUrgency, DISCLAIMER, type SceneClues, type PersonFactors } from "./urgency";
import { urgencyInputsFromInvestigation } from "./urgency-inputs";

const now = new Date("2026-11-02T12:00:00Z");
const base = demoSamples[0].investigation;

test("real-style returned observations map terrain, setting, water, weather and lighting without temperature guesses", () => {
  const investigation = { ...base, clues: [
    { label: "Terrain", observation: "Steep rocky mountain trail above a river.", significance: "" },
    { label: "Lighting", observation: "Evening light falls across the path.", significance: "" },
    { label: "Weather", observation: "Fog and rain obscure the distant slopes.", significance: "" },
    { label: "Climate", observation: "Cool temperate climate.", significance: "" },
  ] };
  const { scene, person } = urgencyInputsFromInvestigation(investigation, {}, now);
  assert.equal(scene.setting, "trail");
  assert.equal(scene.terrain, "steep");
  assert.equal(scene.nearWater, true);
  assert.equal(scene.timeOfDay, "evening");
  assert.deepEqual(scene.weather?.slice().sort(), ["fog", "rain"]);
  assert.equal(scene.temperatureC, undefined);
  assert.deepEqual(person, {});
  const score = assessUrgency(scene, person, now);
  assert.equal(score.level, "High");
  assert.ok(score.risks.some((risk) => risk.label === "Water nearby"));
  assert.ok(score.risks.some((risk) => risk.label === "Remote terrain"));
  assert.ok(!score.risks.some((risk) => risk.label === "Cold exposure"));
});

test("uncertain observations, snow on peaks and ambiguous settings do not fabricate current weather or temperature", () => {
  const investigation = { ...base, clues: [
    { label: "Scene observation", observation: "Snow-covered peaks are visible.", significance: "" },
    { label: "Scene features", observation: "Possibly a lake; no visible river.", significance: "" },
    { label: "Setting", observation: "A public park or a beach.", significance: "" },
    { label: "Lighting", observation: "A dark forest in the shade.", significance: "" },
  ] };
  const { scene } = urgencyInputsFromInvestigation(investigation, {}, now);
  assert.deepEqual(scene, {});
});

test("boolean scene features returned as a comma-separated list remain usable inputs", () => {
  const { scene } = urgencyInputsFromInvestigation({ ...base, clues: [
    { label: "Scene features", observation: "Park, water, nighttime.", significance: "" },
  ] }, {}, now);
  assert.deepEqual(scene, { setting: "park", nearWater: true, timeOfDay: "night" });
});

test("only valid, timezone-qualified past capture times become elapsed hours", () => {
  const record = (timestamp: string) => ({
    ...base, analysis: { details: { exif: { timestamp } } },
  });
  for (const timestamp of ["2026:11:02 08:00:00", "2026-11-02T08:00:00", "2026-11-03T08:00:00Z", "2026-02-30T08:00:00Z"]) {
    assert.equal(urgencyInputsFromInvestigation(record(timestamp), {}, now).scene.photoTakenAt, undefined);
  }
  const inputs = urgencyInputsFromInvestigation(record("2026-11-02T08:00:00-02:00"), {}, now);
  assert.equal(assessUrgency(inputs.scene, {}, now).timeSincePhoto, "about 2 hours ago");
});

test("each sample renders its stored assessment, next steps, unknown inputs and disclaimer", () => {
  for (const sample of demoSamples) {
    const html = renderToStaticMarkup(createElement(HealthUrgencyCard, {
      investigation: sample.investigation,
      stored: { assessedAt: sample.urgencyAssessedAt, inputs: sample.urgencyInputs, result: sample.urgency },
    }));
    assert.ok(html.includes("Health risk &amp; urgency"));
    assert.ok(html.includes(`${sample.urgency.level} urgency`));
    assert.ok(html.includes("Precomputed sample assessment"));
    assert.ok(html.includes("Detected risk factors"));
    assert.ok(html.includes("Suggested next steps"));
    assert.ok(html.includes("Unknown — usable capture metadata unavailable"));
    assert.ok(html.includes("Unknown — not supplied"));
    assert.ok(html.includes("How this was scored"));
    assert.ok(html.includes(DISCLAIMER));
    assert.ok(html.includes("A Low result does not mean someone is safe"));
    for (const risk of sample.urgency.risks) assert.ok(html.includes(risk.label));
  }
});

test("all four scorer levels have distinct colour badges and readable labels", () => {
  const cases: Array<[SceneClues, PersonFactors]> = [
    [{}, {}],
    [{ setting: "trail" }, {}],
    [{ setting: "trail", terrain: "steep", nearWater: true, timeOfDay: "night" }, {}],
    [{ setting: "trail", terrain: "steep", nearWater: true, timeOfDay: "night" }, { needsMedication: true }],
  ];
  const levels = [];
  const colours = new Set<string>();
  for (const [scene, person] of cases) {
    const result = assessUrgency(scene, person, now);
    levels.push(result.level);
    const html = renderToStaticMarkup(createElement(HealthUrgencyCard, {
      investigation: base, stored: { assessedAt: now.toISOString(), inputs: { scene: { ...scene, photoTakenAt: undefined }, person }, result },
    }));
    assert.ok(html.includes(`${result.level} urgency`));
    colours.add(html.match(/background-color:([^;]+)/)?.[1] ?? "");
  }
  assert.deepEqual(levels, ["Low", "Moderate", "High", "Critical"]);
  assert.equal(colours.size, 4);
});

test("incomplete analysis never presents a reassuring Low urgency assessment", () => {
  for (const status of ["analyzing", "failed"] as const) {
    const html = renderToStaticMarkup(createElement(HealthUrgencyCard, {
      investigation: { ...base, status },
    }));
    assert.ok(html.includes("Assessment unavailable"));
    assert.ok(!html.includes("Low urgency"));
    assert.ok(!html.includes('data-testid="button-urgency-scoring"'));
    assert.ok(html.includes(DISCLAIMER));
  }
});

test("real result rendering reads capture metadata, not the record's upload date", () => {
  const html = renderToStaticMarkup(createElement(HealthUrgencyCard, {
    investigation: { ...base, createdAt: "2000-01-01T00:00:00Z", analysis: {
      details: { exif: { timestamp: new Date(Date.now() - 3 * 3_600_000).toISOString() } },
    } },
  }));
  assert.ok(html.includes("about 3 hours ago"));
  assert.ok(!html.includes("Precomputed sample assessment"));
});
