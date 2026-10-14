import assert from "node:assert/strict";
import test from "node:test";
import { normalizeImageLocationResponse } from "./imageLocationAnalysis.js";

test("ranks the highest-scored lead first and keeps the summary aligned", () => {
  const result = normalizeImageLocationResponse({
    location_name: "Front Range",
    country: "USA",
    region: "Colorado",
    latitude: 40.015,
    longitude: -105.2705,
    confidence: 0.573,
    summary: "Front Range, USA (Latitude 40.015 Longitude -105.2705)",
    alternatives: [
      { name: "Alberta Foothills", country: "Canada", latitude: 51.0486, longitude: -114.0708, confidence: 0.6 },
      { name: "Cantabrian Mountains", country: "Spain", latitude: 43.361, longitude: -5.8494, confidence: 0.4 },
    ],
  });

  assert.equal(result.candidates[0]?.place, "Alberta Foothills");
  assert.equal(result.candidates[0]?.confidence, 0.6);
  assert.match(result.summary, /Alberta Foothills/);
  assert.doesNotMatch(result.summary, /Front Range/);
});

test("replaces underscores in visual clue details with spaces", () => {
  const result = normalizeImageLocationResponse({
    details: {
      vision: {
        candidates: [{ name: "Alpine valley", confidence: 0.8 }],
      },
    },
    reasoning_trace: [
      { stage: "Visual clues", details: ["Scene features: snow_capped_mountains, pine_trees."] },
    ],
  });

  assert.equal(result.clues[0]?.label, "Scene features");
  assert.equal(result.clues[0]?.observation, "snow capped mountains, pine trees.");
  assert.doesNotMatch(JSON.stringify(result.clues), /_/);
});
