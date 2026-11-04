import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { demoSamples } from "./demo-samples";
import { CaseHeader, DecisionTrail, NextStepsChecklist } from "../components/demo/demo-parts";
import { DemoStartFlow } from "../components/demo/demo-start-flow";
import { DemoPrintSummary } from "../components/demo/demo-print-summary";

test("case headers render nicknames, last seen, missing counter and two leading risks", () => {
  for (const sample of demoSamples) {
    const html = renderToStaticMarkup(createElement(CaseHeader, { sample, onShare() {} }));
    assert.ok(html.includes(sample.caseFile.nickname));
    assert.ok(html.includes("Last seen"));
    assert.ok(html.includes(sample.lastSeenTime));
    assert.ok(html.includes("Missing for"));
    assert.ok(html.includes(`${sample.urgency.level} urgency`));
    assert.equal((html.match(/data-testid="item-demo-header-risk-/g) ?? []).length, 2);
    assert.equal((html.match(/data-testid="box-demo-annotation-/g) ?? []).length, sample.annotations.length);
    if (sample.urgency.level === "High") assert.ok(html.includes("bg-[#ea6a12] text-white"));
    if (sample.urgency.level === "Critical") assert.ok(html.includes("bg-[#c62828] text-white"));
    if (sample.caseFile.nickname === "Sam") assert.ok(html.includes("Phone unreachable"));
  }
});
test("decision trail starts open with five rows and two LLM chips", () => {
  const html = renderToStaticMarkup(createElement(DecisionTrail, { sample: demoSamples[0] }));
  assert.ok(html.includes('open=""'));
  assert.equal((html.match(/data-testid="row-demo-trail-/g) ?? []).length, 5);
  assert.equal((html.match(/data-testid="chip-demo-trail-llm-/g) ?? []).length, 2);
  assert.ok(!html.includes("Precomputed fictional trail"));
});
test("plan renders checkboxes and print summary contains all places and care notes", () => {
  for (const sample of demoSamples) {
    const checklist = renderToStaticMarkup(createElement(NextStepsChecklist, { steps: sample.urgency.nextSteps }));
    assert.equal((checklist.match(/type="checkbox"/g) ?? []).length, sample.urgency.nextSteps.length);
    const print = renderToStaticMarkup(createElement(DemoPrintSummary, { sample, onClose() {} }));
    assert.ok(print.includes(sample.caseFile.nickname));
    assert.ok(print.includes("Print or save PDF"));
    assert.ok(print.includes("Care notes"));
    assert.ok(print.includes("Possible search area"));
  }
});
test("new investigation begins with editable person details and three short steps", () => {
  const html = renderToStaticMarkup(createElement(DemoStartFlow, { samples: demoSamples, onRun() {} }));
  assert.ok(html.includes("input-demo-nickname"));
  assert.ok(html.includes("input-demo-care-notes"));
  assert.ok(html.includes("Last photo"));
  assert.ok(html.includes("Reason"));
});
