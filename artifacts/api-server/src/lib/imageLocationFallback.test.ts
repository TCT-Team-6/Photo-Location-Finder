import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLocationVisionFallback,
  requestLocationVisionFallback,
} from "./imageLocationFallback.js";

test("parses low-confidence guesses and drops generic unknown results", () => {
  const result = parseLocationVisionFallback(JSON.stringify({
    candidates: [
      { place: "Unknown location", region: "Unknown", country: "Unknown" },
      {
        place: "Harbor district",
        region: "North Coast",
        country: "Exampleland",
        rationale: "The waterfront buildings and terrain look consistent with this broad area.",
        clues: ["A broad harbor inlet", "Low-rise waterfront buildings"],
      },
      {
        place: "Harbor district",
        region: "North Coast",
        country: "Exampleland",
      },
      { place: "Second coast", region: "West", country: "Exampleland" },
      { place: "Third coast", region: "East", country: "Exampleland" },
      { place: "Fourth coast", region: "South", country: "Exampleland" },
    ],
    observations: [
      { label: "Water", observation: "A wide harbor is visible." },
      { label: "Unknown", observation: "Unknown location" },
    ],
  }));

  assert.deepEqual(result.candidates.map((candidate) => candidate.place), [
    "Harbor district",
    "Second coast",
    "Third coast",
  ]);
  assert.deepEqual(result.candidates.map((candidate) => candidate.confidence), [
    0.25,
    0.18,
    0.12,
  ]);
  assert.match(result.candidates[0]!.rationale, /not verified/i);
  assert.match(result.candidates[0]!.rationale, /not probability/i);
  assert.match(result.candidates[0]!.mapsUrl, /Harbor\+district/);
  assert.deepEqual(result.clues.map((clue) => clue.observation), [
    "A wide harbor is visible.",
  ]);
});

test("requests only visual, unverified location guesses from the fallback model", async () => {
  let prompt = "";
  let imageDataUrl = "";

  const result = await requestLocationVisionFallback(
    Buffer.from("image bytes"),
    "image/jpeg",
    async (requestPrompt, dataUrl) => {
      prompt = requestPrompt;
      imageDataUrl = dataUrl;
      return JSON.stringify({
        candidates: [{ place: "Possible city", region: "Possible region", country: "Possible country" }],
        observations: [],
      });
    },
  );

  assert.match(prompt, /visible pixels/i);
  assert.match(prompt, /rather than 'unknown'/i);
  assert.match(imageDataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(imageDataUrl, `data:image/jpeg;base64,${Buffer.from("image bytes").toString("base64")}`);
  assert.equal(result.candidates[0]?.place, "Possible city");
});

test("returns no candidates for malformed or unusable fallback output", () => {
  assert.deepEqual(parseLocationVisionFallback("not JSON"), {
    candidates: [],
    clues: [],
  });
  assert.deepEqual(
    parseLocationVisionFallback('{"candidates":[{"place":"Unknown"}]}').candidates,
    [],
  );
});
