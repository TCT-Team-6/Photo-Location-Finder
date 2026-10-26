import assert from "node:assert/strict";
import test from "node:test";
import { planSelection, runIntakeItem, type IntakeItem } from "./original-intake.ts";
import { validateOriginalMedia, VIDEO_UNAVAILABLE_MESSAGE } from "./media-types.ts";
import { formatTimestamp, keyMoments, embeddedGps } from "./video-analysis.ts";

const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });
let n = 0;
const id = () => `id-${++n}`;

test("video is rejected with the exact message when video is off", () => {
  const r = validateOriginalMedia(file("a.mp4", "video/mp4"), false);
  assert.deepEqual(r, { ok: false, error: VIDEO_UNAVAILABLE_MESSAGE });
  assert.equal(validateOriginalMedia(file("a.mov", ""), false).ok, false);
});

test("video limits and extension fallback", () => {
  assert.equal(validateOriginalMedia(file("clip.mkv", "", 10), true).ok, true);
  assert.equal(validateOriginalMedia({ name: "big.mp4", type: "video/mp4", size: 61 * 1024 * 1024 }, true).ok, false);
  assert.equal(validateOriginalMedia({ name: "big.jpg", type: "image/jpeg", size: 26 * 1024 * 1024 }, true).ok, false);
  assert.equal(validateOriginalMedia(file("x.heic", ""), true).ok, true);
  assert.equal(validateOriginalMedia(file("x.pdf", "application/pdf"), true).ok, false);
  assert.equal(validateOriginalMedia(file("clip.exe", "video/mp4"), true).ok, false);
  assert.equal(validateOriginalMedia(file("clip.mov", "video/mp4"), true).ok, false);
  assert.equal(validateOriginalMedia(file("clip.mp4", "application/pdf"), true).ok, false);
});

test("up to 6 photos, video stays alone", () => {
  const files = Array.from({ length: 8 }, (_, i) => file(`p${i}.jpg`, "image/jpeg"));
  const plan = planSelection([], files, false, id);
  assert.equal(plan.items.length, 6);
  assert.equal(plan.errors.length, 2);
  assert.equal(new Set(plan.items.map((i) => i.requestId)).size, 6);
  const withVideo = planSelection(plan.items, [file("v.mp4", "video/mp4")], true, id);
  assert.equal(withVideo.items.length, 6);
  assert.equal(planSelection([], [file("v.mp4", "video/mp4")], true, id).items[0].kind, "video");
});

test("retry reuses the same requestId", async () => {
  const item: IntakeItem = { id: "1", file: file("a.jpg", "image/jpeg"), requestId: "req-1", kind: "image", status: "ready" };
  const seen: string[] = [];
  let fail = true;
  const deps = {
    title: "", context: "", shotAt: "",
    requestUploadUrl: async () => ({ uploadURL: "u", objectPath: "/objects/uploads/x" }),
    uploadFile: async () => {},
    createInvestigation: async ({ data }: { data: { clientRequestId: string } }) => {
      seen.push(data.clientRequestId);
      if (fail) { fail = false; throw new Error("nope"); }
      return { id: "inv", title: "t", status: "analyzing" };
    },
  };
  const first = await runIntakeItem(item, deps as never);
  assert.equal(first.status, "error");
  const second = await runIntakeItem(item, deps as never);
  assert.equal(second.status, "saved");
  assert.equal(second.analysisStatus, "analyzing");
  assert.deepEqual(seen, ["req-1", "req-1"]);
});

test("key moments and gps are backwards compatible", () => {
  assert.equal(formatTimestamp(4.9), "0:04");
  assert.deepEqual(keyMoments(null), []);
  assert.equal(embeddedGps({}), null);
  const m = keyMoments({ contributing_frames: [{ timestamp_s: 65, candidates: ["Lisbon"] }, { timestamp_s: 4, candidates: [] }] });
  assert.equal(m[0].label, "0:04");
  assert.equal(m[1].label, "1:05");
  assert.equal(m[0].cluesFound, undefined);
  assert.equal(embeddedGps({ video: { embedded_gps: { latitude: 1.5, longitude: 2.5 } } })?.label, "1.50000, 2.50000");
});
