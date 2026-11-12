import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceGuide, emptyFacts, groundActions, mapGuideToCase, normalizeFacts, parseGuideFacts, readGuide, responderSummary, safetyGate, syncGuideForm, type GuideFacts, type GuideAction } from "./guide";
import { guideJsonSchema } from "./guide-ai";
import type { PrivateCaseData } from "@workspace/db";

const facts: GuideFacts = { ...emptyFacts, ageGroup: "older_adult", mayWanderOrBeConfused: true, needsMedication: true,
  lastSeenTime: "2 hours ago", lastSeenPlace: "Reported town park", safetyReason: "Has dementia and is missing", purpose: "find_missing_person", missingFields: [] };
const data: PrivateCaseData = { clientRequestId: "00000000-0000-4000-8000-000000000001", firstName: "Test", responderRole: "family-or-guardian", privacyAcknowledged: true, notes: "Keep original notes." };
test("strict structured facts preserve false and null distinctly", () => {
  const value = parseGuideFacts(JSON.stringify({ ...facts, nonverbal: false }));
  assert.equal(value.nonverbal, false);
  assert.equal(value.called911, null);
});
test("schema rejects missing, extra, coerced and invalid fields", () => {
  const { called911: _omit, ...missing } = facts;
  for (const value of [missing, { ...facts, location: "invented" }, { ...facts, needsMedication: "yes" }, { ...facts, ageGroup: "elderly" }, { ...facts, purpose: "surveillance" }, { ...facts, missingFields: ["phone"] }]) {
    assert.throws(() => parseGuideFacts(JSON.stringify(value)));
  }
  assert.throws(() => parseGuideFacts("```json\n{}\n```"));
  assert.throws(() => parseGuideFacts("{invalid"));
});
test("OpenAI JSON schema requires all fields and rejects additional properties", () => {
  assert.equal(guideJsonSchema.additionalProperties, false);
  assert.deepEqual([...guideJsonSchema.required].sort(), Object.keys(guideJsonSchema.properties).sort());
});
test("missing fields are derived in code instead of trusted to the model", () => {
  const result = normalizeFacts({ ...facts, lastSeenPlace: " Not sure ", missingFields: [] });
  assert.equal(result.lastSeenPlace, null);
  assert.deepEqual(result.missingFields, ["lastSeenPlace"]);
});
test("tracking stays blocked even when accompanied by a safety claim", () => {
  assert.equal(safetyGate({ ...facts, purpose: "tracking_concern" }), "blocked");
  const old = advanceGuide(undefined, { ...facts, purpose: "tracking_concern" }, "input", "fixed");
  assert.equal(advanceGuide(old, facts, "correction", "fixed").gate, "blocked");
});
test("unclear and absent safety reasons cannot pass", () => {
  assert.equal(safetyGate({ ...facts, purpose: "unclear" }), "needs_clarification");
  assert.equal(safetyGate({ ...facts, safetyReason: null }), "needs_clarification");
  for (const safetyReason of ["none", "no danger", "just curious", "no safety concern"]) {
    assert.equal(safetyGate({ ...facts, safetyReason }), "blocked");
  }
  assert.equal(safetyGate(facts), "allowed");
});
test("first reply is emergency instruction when appropriate, with a saved gate decision", () => {
  const state = advanceGuide(undefined, facts, "input", "fixed");
  assert.equal(state.emergency, true);
  assert.ok(state.log.find((entry) => entry.role === "assistant")?.text.startsWith("Please call 911 now."));
  assert.ok(state.log.some((entry) => entry.role === "gate"));
  assert.equal(advanceGuide(undefined, { ...facts, called911: true }, "input", "fixed").emergency, false);
});
test("followups are one at a time, never repeated, and bounded to three", () => {
  let state = advanceGuide(undefined, emptyFacts, "input", "fixed");
  const asked = new Set([state.question]);
  for (let i = 0; i < 5; i++) {
    state = advanceGuide(state, emptyFacts, "Not sure", "fixed");
    if (state.question) {
      assert.ok(!asked.has(state.question));
      asked.add(state.question);
    }
  }
  assert.equal(state.questionsAsked, 3);
  assert.equal(state.question, null);
  assert.equal(state.gate, "blocked");
});
test("complete facts ask no unnecessary required question", () => {
  const state = advanceGuide(undefined, facts, "input", "fixed");
  assert.equal(state.question, null);
  assert.equal(state.questionsAsked, 0);
});
test("grounding rejects mismatched names, IDs, confidence and action types", () => {
  const sources = [{ id: "park", label: "Saved park", confidence: 0.7, reason: "Saved clue" }];
  const good: GuideAction = { kind: "share_report", sourceId: "park", sourceLabel: "Saved park", confidence: 0.7, reason: "Invented lake." };
  assert.deepEqual(groundActions([good], sources), [{ ...good, reason: "Saved clue" }]);
  for (const bad of [{ ...good, sourceId: "lake" }, { ...good, sourceLabel: "Other park" }, { ...good, confidence: 0.99 }, { ...good, kind: "auto_send" }]) {
    assert.deepEqual(groundActions([bad as GuideAction], sources), []);
  }
  assert.deepEqual(groundActions([good], []), []);
});
test("grounding deduplicates actions and preserves null confidence without inventing a score", () => {
  const source = { id: "reported", label: "Reported area", confidence: null, reason: "Unverified" };
  const action: GuideAction = { kind: "share_report", sourceId: source.id, sourceLabel: source.label, confidence: null, reason: "" };
  assert.equal(groundActions([action, action], [source]).length, 1);
  assert.equal(groundActions([action], [source])[0].confidence, null);
});
test("case mapping preserves unrelated fields and regular-form corrections survive reload", () => {
  const state = advanceGuide(undefined, facts, "input", "fixed");
  const mapped = mapGuideToCase(data, state);
  assert.equal(mapped.lastKnownArea, facts.lastSeenPlace);
  assert.equal(mapped.notes, data.notes);
  const edited = syncGuideForm(mapped, { ...mapped, lastKnownArea: "Corrected general area", lastKnownDate: "2026-11-12", ageDescription: "78" });
  const restored = readGuide(edited.guide)!;
  assert.equal(restored.facts.lastSeenPlace, "Corrected general area");
  assert.equal(restored.facts.lastSeenTime, "2026-11-12");
  assert.equal(restored.facts.ageGroup, null);
  assert.equal(restored.revision, state.revision + 1);
});
test("summary includes notes and evidence but no invented location or confidence", () => {
  const state = advanceGuide(undefined, facts, "input", "fixed");
  state.log.push({ role: "note", text: "Phone is off", at: "fixed" });
  const summary = responderSummary(mapGuideToCase(data, state), state, [{ data: { title: "Last photo", source: "Family", notes: "Reported yesterday" } }]);
  for (const text of ["unverified", "2 hours ago", "Phone is off", "Last photo", "Reference", "Unknown"]) {
    assert.ok(summary.toLowerCase().includes(text.toLowerCase()), text);
  }
  assert.ok(!summary.includes("latitude"));
});
