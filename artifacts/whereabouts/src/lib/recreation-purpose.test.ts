import assert from "node:assert/strict";
import test from "node:test";
import { isLegacyRecreationReport } from "./recreation-purpose";

test("new Recreation location reports are distinct from legacy source-image reports", () => {
  assert.equal(isLegacyRecreationReport({ desk: "recreation", analysis: { media_type: "image" } }), false);
  assert.equal(isLegacyRecreationReport({ desk: "recreation", analysis: null }), true);
  assert.equal(isLegacyRecreationReport({ desk: "recreation" }), true);
  assert.equal(isLegacyRecreationReport({ desk: "original" }), false);
  assert.equal(isLegacyRecreationReport({ desk: "fake-news" }), false);
});
