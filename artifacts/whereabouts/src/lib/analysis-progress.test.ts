import assert from "node:assert/strict";
import test from "node:test";
import {
  pipelineLinks, pipelineStatuses, pipelineSteps, stageAnnouncement, statusText,
} from "../components/analysis-progress-model";

test("the overview always contains five distinct workflow stages", () => {
  assert.equal(pipelineSteps.length, 5);
  assert.equal(new Set(pipelineSteps.map((step) => step.id)).size, 5);
  assert.equal(pipelineSteps.at(-1)?.id, "save");
});

test("uploading confirms no downstream progress or completed stage", () => {
  assert.deepEqual(pipelineStatuses("uploading"), ["active", "pending", "pending", "pending", "pending"]);
  assert.deepEqual(pipelineLinks("uploading"), ["idle", "idle", "idle", "idle"]);
});

test("analysis confirms only upload and keeps saving unconfirmed", () => {
  const statuses = pipelineStatuses("analyzing");
  assert.deepEqual(statuses, ["done", "working", "working", "working", "awaiting"]);
  assert.equal(statuses.filter((status) => status === "done").length, 1);
  assert.equal(pipelineLinks("analyzing").at(-1), "idle");
  assert.match(statusText("working"), /not confirmed/i);
  assert.equal(statusText("awaiting"), "Awaiting response");
});

test("screen-reader announcements describe only observed request states", () => {
  assert.equal(stageAnnouncement("uploading"), "Uploading your photo.");
  assert.match(stageAnnouncement("analyzing"), /waiting for the response/i);
  assert.doesNotMatch(stageAnnouncement("analyzing"), /report saved|matching complete|ranked|%/i);
});
