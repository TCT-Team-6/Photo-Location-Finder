import test from "node:test";
import assert from "node:assert/strict";
import { caseLeadInput, isCalendarDate, isSafeSourceUrl, privateCaseInput } from "./case-validation";

const caseData = { clientRequestId: "db0622c6-7319-4f92-9ce1-248651a4863d", firstName: "Example", responderRole: "other", privacyAcknowledged: true };
const lead = { clientRequestId: caseData.clientRequestId, kind: "tip", title: "Example tip", source: "Authorized contact", notes: "Unverified example", permissionGranted: true };

test("case intake requires privacy acknowledgement, a real date and a nonblank name", () => {
  assert.equal(privateCaseInput.safeParse(caseData).success, true);
  for (const override of [{ privacyAcknowledged: false }, { firstName: "   " }, { lastKnownDate: "2026-02-30" }]) {
    assert.equal(privateCaseInput.safeParse({ ...caseData, ...override }).success, false);
  }
});
test("calendar dates preserve day-only values and reject impossible dates", () => {
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(isCalendarDate("2025-02-29"), false);
  assert.equal(isCalendarDate(null), true);
});
test("source links cannot be scripts, local relative URLs or contain credentials", () => {
  for (const url of ["javascript:alert(1)", "file:///tmp/test", "/local", "https://user:pass@example.com"]) assert.equal(isSafeSourceUrl(url), false);
  assert.equal(isSafeSourceUrl("https://example.com/post"), true);
});
test("leads require source, permission and content matching their type", () => {
  assert.equal(caseLeadInput.safeParse(lead).success, true);
  for (const override of [{ permissionGranted: false }, { source: " " }, { notes: "" }, { kind: "photo" }, { kind: "link", sourceUrl: "javascript:alert(1)" }]) {
    assert.equal(caseLeadInput.safeParse({ ...lead, ...override }).success, false);
  }
  assert.equal(caseLeadInput.safeParse({ ...lead, kind: "link", sourceUrl: "https://example.com/post" }).success, true);
});
