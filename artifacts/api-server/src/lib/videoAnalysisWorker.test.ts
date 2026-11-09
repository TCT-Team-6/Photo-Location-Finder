import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { investigationsTable, type Investigation } from "@workspace/db/schema";

const baseJob: Investigation = {
  id: "ad887a78-60cb-47d9-aad0-6e1af0339836", userId: "test-video-worker",
  title: "Worker test", desk: "original", originalName: "video.mp4",
  contentType: "video/mp4", objectPath: "/objects/uploads/mock",
  clientRequestId: null, context: null, shotAt: null,
  summary: "Pending", candidates: [], clues: [], analysis: null,
  status: "analyzing", analysisError: null, analysisAttempts: 0,
  analysisLeaseUntil: null, analysisLeaseToken: null, analysisJob: null,
  createdAt: new Date(), updatedAt: new Date(),
};
let stored = { ...baseJob };
let lastValues: Record<string, unknown> = {};
let lastWhere: unknown;
let lockOptions: unknown;
const fakeDb = {
  transaction: async (fn: (tx: unknown) => unknown) => fn(fakeDb),
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            for: async (mode: string, options: unknown) => {
              lockOptions = { mode, options };
              return [stored];
            },
          }),
        }),
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: (where: unknown) => {
        lastValues = values;
        lastWhere = where;
        stored = { ...stored, ...values };
        return Object.assign(Promise.resolve(undefined), {
          returning: async () => [stored],
        });
      },
    }),
  }),
};
mock.module("@workspace/db", { namedExports: { db: fakeDb, investigationsTable } });
mock.module("./objectStorage.js", {
  namedExports: { ObjectStorageService: class {} },
});
mock.module("./logger.js", {
  namedExports: { logger: { warn: () => {}, error: () => {} } },
});
const { claimVideoJob, runVideoJob, videoReport } = await import("./videoAnalysisWorker.js");
const result = {
  summary: "A possible scene", candidates: [], clues: [],
  analysis: { video: { duration_s: 42 }, verified: "unavailable" },
};

test("durable worker claims use skip-locked and a bounded recoverable lease", async () => {
  stored = { ...baseJob };
  const job = await claimVideoJob();
  assert.deepEqual(lockOptions, { mode: "update", options: { skipLocked: true } });
  assert.equal(job?.analysisAttempts, 1);
  assert.ok(job?.analysisLeaseToken);
  const leaseMs = job!.analysisLeaseUntil!.getTime() - Date.now();
  assert.ok(leaseMs > 7 * 60_000 && leaseMs <= 8 * 60_000);
});

test("repeated interrupted jobs become failed instead of retrying forever", async () => {
  stored = { ...baseJob, analysisAttempts: 3 };
  assert.equal(await claimVideoJob(), undefined);
  assert.equal(lastValues.status, "failed");
  assert.match(String(lastValues.analysisError), /interrupted repeatedly/);
});

test("successful job persists results only under the current lease token", async () => {
  stored = { ...baseJob, analysisLeaseToken: "e6c22514-f9fb-453e-91fe-0626091b3d68" };
  await runVideoJob(stored, {
    load: async () => Buffer.from("mock video"),
    analyze: async (bytes, contentType) => {
      assert.equal(bytes.toString(), "mock video");
      assert.equal(contentType, "video/mp4");
      return result;
    },
  });
  assert.equal(lastValues.status, "done");
  assert.equal(lastValues.analysisError, null);
  assert.deepEqual(lastValues.analysis, { ...result.analysis, media_type: "video" });
  const query = new PgDialect().sqlToQuery(lastWhere as Parameters<PgDialect["sqlToQuery"]>[0]);
  assert.ok(query.params.includes("e6c22514-f9fb-453e-91fe-0626091b3d68"));
  assert.ok(query.params.includes("analyzing"));
});

test("video failures keep earlier results and expose friendly errors, not provider secrets", async () => {
  for (const error of [
    "We couldn't find clear frames in this video. Try a sharper or longer clip",
    "internal provider diagnostic with sensitive data",
  ]) {
    stored = { ...baseJob, analysisLeaseToken: "e6c22514-f9fb-453e-91fe-0626091b3d68" };
    await runVideoJob(stored, {
      load: async () => Buffer.from("mock"),
      analyze: async () => { throw new Error(error); },
    });
    assert.equal(lastValues.status, "failed");
    assert.equal(lastValues.analysisLeaseToken, null);
    assert.ok(!("candidates" in lastValues));
    assert.ok(!("analysis" in lastValues));
    assert.doesNotMatch(String(lastValues.analysisError), /sensitive data/);
  }
});

test("unclaimed jobs cannot run and refresh does not fabricate new leads", async () => {
  await assert.rejects(() => runVideoJob(baseJob), /unclaimed/);
  assert.throws(() => videoReport(result, ["An old place"]), /previous report is unchanged/);
  assert.deepEqual(videoReport(result).candidates, []);
});
