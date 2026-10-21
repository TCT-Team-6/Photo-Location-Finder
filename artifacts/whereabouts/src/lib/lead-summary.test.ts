import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadSummary, scoreOutOf100 } from "./lead-summary";
import { toDateInputValue } from "./photo-date";

test("scoreOutOf100 handles 0–1 and 0–100 scores", () => {
  assert.equal(scoreOutOf100(0.6), 60);
  assert.equal(scoreOutOf100(93), 93);
  assert.equal(scoreOutOf100(1.7), 2);
  assert.equal(scoreOutOf100(-1), 0);
});

test("buildLeadSummary lists leads in the order given with map links", () => {
  const text = buildLeadSummary(
    { title: "Stone bridge", originalName: "bridge.jpg", shotAt: "2007-06-03", context: "Island trip" },
    [
      { place: "North Island", region: "", country: "New Zealand", confidence: 0.6, mapsUrl: "https://maps.example/nz" },
      { place: "Azores", region: "Azores", country: "Portugal", confidence: 0.173, mapsUrl: "https://maps.example/az" },
    ],
  );
  assert.match(text, /1\. North Island \(New Zealand\) — score 60\/100/);
  assert.match(text, /2\. Azores \(Azores, Portugal\) — score 17\/100/);
  assert.match(text, /Map: https:\/\/maps\.example\/az/);
  assert.match(text, /Taken: 2007-06-03/);
  assert.match(text, /Notes: Island trip/);
});

test("buildLeadSummary explains when there are no leads", () => {
  const text = buildLeadSummary({ title: "Empty", originalName: "x.png" }, []);
  assert.match(text, /No likely places were found\./);
});

test("toDateInputValue formats dates and rejects unset camera clocks", () => {
  assert.equal(toDateInputValue(new Date(2007, 5, 3, 17, 6)), "2007-06-03");
  assert.equal(toDateInputValue(new Date(1970, 0, 1)), null);
  assert.equal(toDateInputValue(new Date("not a date")), null);
  assert.equal(toDateInputValue(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)), null);
});
