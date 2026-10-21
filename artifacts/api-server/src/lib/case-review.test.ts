import test from "node:test";
import assert from "node:assert/strict";
import { SaveCaseReviewBody } from "@workspace/api-zod";
import { buildCaseReview } from "./case-review";

test("an existing case with no review starts at revision zero", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  assert.deepEqual(buildCaseReview(undefined, {
    observations: "Reported source date is uncertain.", nextSteps: "Ask the submitter to clarify.", expectedRevision: 0,
  }, now), {
    observations: "Reported source date is uncertain.", nextSteps: "Ask the submitter to clarify.",
    revision: 1, updatedAt: now.toISOString(),
  });
});

test("review updates allow clearing both text fields", () => {
  const current = { observations: "Old note", nextSteps: "Old action", revision: 2, updatedAt: "2026-10-20T12:00:00Z" };
  const updated = buildCaseReview(current, { observations: "", nextSteps: "", expectedRevision: 2 });
  assert.equal(updated?.observations, "");
  assert.equal(updated?.nextSteps, "");
  assert.equal(updated?.revision, 3);
  assert.equal(current.observations, "Old note");
});

test("stale or invented revision cannot overwrite a saved review", () => {
  const current = { observations: "Keep this", nextSteps: "", revision: 2, updatedAt: "2026-10-20T12:00:00Z" };
  for (const expectedRevision of [0, 1, 3]) {
    assert.equal(buildCaseReview(current, { observations: "Overwrite", nextSteps: "", expectedRevision }), null);
  }
  assert.equal(current.observations, "Keep this");
});

test("review input requires both bounded strings and an integer base revision", () => {
  const valid = { observations: "", nextSteps: "", expectedRevision: 0 };
  assert.equal(SaveCaseReviewBody.safeParse(valid).success, true);
  for (const invalid of [
    { ...valid, observations: "x".repeat(10001) },
    { ...valid, nextSteps: "x".repeat(10001) },
    { ...valid, observations: null },
    { ...valid, nextSteps: undefined },
    { ...valid, expectedRevision: -1 },
    { ...valid, expectedRevision: 0.5 },
    { observations: "", nextSteps: "" },
  ]) assert.equal(SaveCaseReviewBody.safeParse(invalid).success, false);
});
