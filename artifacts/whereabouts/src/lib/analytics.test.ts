import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { trackEvent } from "./analytics";

test("analytics is optional and failures do not interrupt the demo", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Reflect.deleteProperty(globalThis, "window");
    assert.doesNotThrow(() => trackEvent("demo_sample_open", { scenario_id: "sample-lost-hiker" }));

    const calls: unknown[][] = [];
    const fakeWindow: { umami?: Window["umami"] } = {};
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    assert.doesNotThrow(() => trackEvent("demo_sample_open"));
    fakeWindow.umami = { track: (...args) => { calls.push(args); } };
    for (const name of ["demo_sample_open", "demo_sample_run"]) {
      trackEvent(name, { scenario_id: "sample-lost-hiker" });
    }
    assert.deepEqual(calls, [
      ["demo_sample_open", { scenario_id: "sample-lost-hiker" }],
      ["demo_sample_run", { scenario_id: "sample-lost-hiker" }],
    ]);

    fakeWindow.umami = { track: () => { throw new Error("Tracker blocked"); } };
    assert.doesNotThrow(() => trackEvent("demo_sample_open"));
    fakeWindow.umami = { track: () => Promise.reject(new Error("Network unavailable")) };
    assert.doesNotThrow(() => trackEvent("demo_sample_run"));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("demo actions send only the fixed sample identifier, separately from result rendering", () => {
  const source = readFileSync(new URL("../components/demo-experience.tsx", import.meta.url), "utf8");
  const trackingCalls = source.match(/trackEvent\([^;]+;/g);
  assert.deepEqual(trackingCalls, [
    "trackEvent('demo_sample_open', { scenario_id: sample.investigation.id });",
    "trackEvent('demo_sample_run', { scenario_id: sample.investigation.id });",
  ]);
  assert.match(source, /const openSample = [\s\S]*?trackEvent\('demo_sample_open'/);
  assert.match(source, /const startSimulation = [\s\S]*?trackEvent\('demo_sample_run'/);
});
