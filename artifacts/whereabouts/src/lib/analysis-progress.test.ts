import assert from "node:assert/strict";
import test from "node:test";
import {
  pipelineLinks, pipelineStatuses, pipelineSteps, stageAnnouncement, statusText,
  pipelineTools, pipelineToolNote,
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

test("location-analysis labels do not invent undisclosed AI models", () => {
  const tools = pipelineTools("original");
  assert.equal(tools.length, 5);
  assert.equal(tools[1].label, "Image Locator");
  assert.match(tools[1].detail, /undisclosed/);
  assert.match(tools[0].detail, /no AI/);
  assert.equal(tools[4].label, "PostgreSQL");
  assert.match(tools[4].detail, /no AI/);
  assert.match(pipelineToolNote("original"), /Optional.*OpenAI web search/);
});

test("Recreation uses location analysis while Journalism keeps image-integrity review", () => {
  const recreation = pipelineTools("recreation");
  const journalism = pipelineTools("fake-news");
  assert.deepEqual(recreation, pipelineTools("original"));
  assert.doesNotMatch(JSON.stringify(recreation), /Source.image|Source.match/i);
  assert.equal(journalism[2].label, "OpenAI vision");
  assert.doesNotMatch(JSON.stringify(journalism), /Image Locator|web search/);
  assert.match(pipelineToolNote("fake-news"), /server configuration/);
});
