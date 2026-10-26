import assert from "node:assert/strict";
import test from "node:test";
import { analyzeImageLocation, normalizeImageLocationResponse } from "./imageLocationAnalysis.js";
import { extractImageLocationMetadata } from "./imageLocationMetadata.js";

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

const fullMetadata = {
  latitude: 47.84,
  longitude: -120.02,
  map_url: "https://www.google.com/maps?q=47.84,-120.02",
  address: "Lake Chelan, Washington",
  confidence: 0.742,
  source: "AI visual analysis + map lookup",
  verified: "partial",
  warning: "Map verification incomplete.",
  meets_defined_radius: false,
  defined_radius_km: 2,
  precision_m: 1200,
  elevation_m: -15,
  search_areas: [{
    rank: 1, name: "Lake Chelan", country: "United States",
    latitude: 47.84, longitude: -120.02, search_radius_km: 15,
    score: 0.742, map_status: "partial",
  }],
  rejected: [{ name: "Other region", reason: "Lake not found." }],
  nearby_places: [{ title: "Public landmark", distance_km: 1.2 }],
  forensics: {
    has_gps: false, authenticity: "unknown", edited: false,
    is_screenshot: false, metadata_stripped: true, notes: ["Metadata stripped."],
  },
  reasoning_trace: [
    { stage: "Map verification", details: ["Lake found.", "Some checks unavailable."] },
    { step: "Conclusion", detail: "Treat as an estimate." },
  ],
  details: { exif: { timestamp: "2026:10:25 12:30:00" } },
};

test("preserves all requested metadata without changing candidates or clues", () => {
  const input = { success: true, location_name: "Lake Chelan", ...fullMetadata };
  const result = normalizeImageLocationResponse(input);
  assert.deepEqual(result.analysis, fullMetadata);
  assert.equal(result.candidates[0]?.place, "Lake Chelan");
  assert.equal(result.candidates[0]?.confidence, 0.742);
});

test("missing metadata stays absent and malformed optional fields do not fail analysis", () => {
  for (const value of [undefined, null, [], {}, "not an object"]) {
    assert.deepEqual(extractImageLocationMetadata(value), {});
  }
  const result = normalizeImageLocationResponse({
    location_name: "Known place",
    latitude: "47.84", longitude: Infinity, confidence: "high",
    map_url: "javascript:alert(1)", address: 42, verified: true,
    meets_defined_radius: "false", defined_radius_km: -2,
    precision_m: -3, elevation_m: NaN,
    search_areas: [null, false, { latitude: 100, longitude: -200, score: 2, rank: 1.5 }],
    rejected: "not a list", forensics: { has_gps: "false", notes: [false] },
    details: { exif: { timestamp: 123 } },
    reasoning_trace: [null, { stage: 5, details: "wrong type" }],
  });
  assert.equal(result.candidates[0]?.place, "Known place");
  assert.deepEqual(result.analysis, {
    search_areas: [], forensics: { notes: [] }, reasoning_trace: [],
  });
});

test("metadata allowlist strips unknown nested fields and caps every list at ten", () => {
  const repeat = (value: unknown) => Array.from({ length: 15 }, () => value);
  const result = extractImageLocationMetadata({
    ...fullMetadata,
    secret: "must not persist",
    search_areas: repeat({ ...fullMetadata.search_areas[0], extra: true }),
    rejected: repeat({ name: "Wrong", reason: "No match", latitude: 50 }),
    nearby_places: repeat({ title: "Nearby", distance_km: 0, extra: "ignored" }),
    forensics: { notes: repeat("x".repeat(2000)), raw: { private: true } },
    reasoning_trace: repeat({ stage: "Vision", details: repeat("clue"), raw: "ignored" }),
    details: { exif: { timestamp: "2026:10:25 12:30:00", raw: "ignored" }, vision: {} },
  });
  assert.equal(result.search_areas?.length, 10);
  assert.equal(result.rejected?.length, 10);
  assert.equal(result.nearby_places?.length, 10);
  assert.equal(result.forensics?.notes?.length, 10);
  assert.equal(result.forensics?.notes?.[0]?.length, 1200);
  assert.equal(result.reasoning_trace?.length, 10);
  assert.equal(result.reasoning_trace?.[0]?.details?.length, 10);
  assert.deepEqual(result.search_areas?.[0], fullMetadata.search_areas[0]);
  assert.deepEqual(result.rejected?.[0], { name: "Wrong", reason: "No match" });
  assert.deepEqual(result.details, fullMetadata.details);
  assert.doesNotMatch(JSON.stringify(result), /must not persist|ignored|private/);
});

test("metadata preserves zero, false, and empty warning; excludes unsafe map URLs", () => {
  assert.deepEqual(extractImageLocationMetadata({
    latitude: 0, longitude: 0, confidence: 0, warning: "",
    precision_m: 0, elevation_m: 0, meets_defined_radius: false,
  }), {
    latitude: 0, longitude: 0, confidence: 0, warning: "",
    precision_m: 0, elevation_m: 0, meets_defined_radius: false,
  });
  for (const map_url of ["javascript:alert(1)", "https://user:password@example.org", "/relative"]) {
    assert.deepEqual(extractImageLocationMetadata({ map_url }), {});
  }
});

test("request uses configurable service URL, original multipart bytes, and existing timeout", async (t) => {
  const oldUrl = process.env.IMAGE_LOCATOR_URL;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.IMAGE_LOCATOR_URL;
    else process.env.IMAGE_LOCATOR_URL = oldUrl;
  });
  const requestedUrls: string[] = [];
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, "timeout", (delay: number) => {
    timeouts.push(delay);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    requestedUrls.push(url);
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    const image = options.body.get("image") as File;
    assert.equal(image.name, "upload.jpg");
    assert.equal(image.type, "image/jpeg");
    assert.equal(await image.text(), "original image bytes");
    return Response.json({ success: true, location_name: "A place", ...fullMetadata });
  });
  for (const configuredUrl of [undefined, "https://locator.example/", "https://locator.example/analyze/"]) {
    if (configuredUrl === undefined) delete process.env.IMAGE_LOCATOR_URL;
    else process.env.IMAGE_LOCATOR_URL = configuredUrl;
    const result = await analyzeImageLocation(Buffer.from("original image bytes"), "image/jpeg", "photo.jpg");
    assert.deepEqual(result.analysis, fullMetadata);
  }
  assert.deepEqual(requestedUrls, [
    "https://mit-app-inventor-backend.onrender.com/analyze",
    "https://locator.example/analyze",
    "https://locator.example/analyze",
  ]);
  assert.deepEqual(timeouts, [180_000, 180_000, 180_000]);
});

test("keeps upstream success flag, HTTP, invalid JSON, and response-size protections", async (t) => {
  let response = Response.json({ success: false, error: "No usable image" });
  t.mock.method(globalThis, "fetch", async () => response);
  const analyze = () => analyzeImageLocation(Buffer.from("image"), "image/jpeg", "photo.jpg");
  await assert.rejects(analyze, /could not analyze/);
  response = new Response("", { status: 429 });
  await assert.rejects(analyze, /HTTP 429/);
  response = new Response("not json");
  await assert.rejects(analyze, /invalid JSON/);
  response = new Response("x".repeat(2 * 1024 * 1024 + 1));
  await assert.rejects(analyze, /too large/);
});
