import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { mock, test } from "node:test";
import type { InvestigationAnalysis, LocationCandidate, VisualClue } from "@workspace/db";
import { GetInvestigationResponse, ListInvestigationsResponse } from "@workspace/api-zod";
import {
  investigationsTable,
  pendingPhotoUploadsTable,
} from "@workspace/db/schema";

type Analysis = {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
  analysis?: InvestigationAnalysis;
};

const sourceImageMatch = {
  imageUrl: "https://images.example/source.jpg",
  thumbnailUrl: "https://images.example/source-thumb.jpg",
  sourceUrl: "https://archive.example/photo",
  caption: "A matching archival photograph",
};

const originalAnalysis: Analysis = {
  analysis: {
    latitude: 47.84, longitude: -120.02,
    verified: "unavailable", warning: "Map service unavailable.",
    meets_defined_radius: false, defined_radius_km: 2,
    forensics: { has_gps: false },
    details: { exif: { timestamp: "2026:10:25 12:30:00" } },
  },
  summary: "Original desk summary from the image locator.",
  candidates: [{
    place: "Alpine valley",
    region: "Tyrol",
    country: "Austria",
    confidence: 0.82,
    rationale: "The ridgeline and valley shape are consistent.",
    clues: ["distinctive ridgeline"],
    mapsUrl: "https://maps.example/alpine-valley",
  }],
  clues: [{
    label: "Ridgeline",
    observation: "A steep ridge runs behind the settlement.",
    significance: "Its profile may distinguish this valley.",
  }],
};

const recreationAnalysis: Analysis = {
  summary: "Recreation desk source-image analysis.",
  candidates: [{
    place: "A matching archival photograph",
    region: null,
    country: null,
    confidence: 0,
    rationale: "The public image has a closely matching composition.",
    clues: [],
    mapsUrl: "https://archive.example/photo",
    photoReferences: [sourceImageMatch],
    photoSearchStatus: "found",
  }],
  clues: [],
};

const journalismAnalysis: Analysis = {
  summary: "Journalism desk image-integrity assessment.",
  candidates: [],
  clues: [{
    label: "Edge detail",
    observation: "A narrow halo appears along a high-contrast boundary.",
    significance: "This can occur during editing, but may also result from compression.",
  }],
};

const analyses: Record<string, Analysis> = {
  original: originalAnalysis,
  recreation: recreationAnalysis,
  "fake-news": journalismAnalysis,
};

let persistedValues: Record<string, unknown> | undefined;
let analyzerCalls: string[] = [];
let selectQueryCount = 0;
let selectedReport: Record<string, unknown> | undefined;
let updatedValues: Record<string, unknown> | undefined;
let videoAvailable = true;
let downloadCalls = 0;
let originalAnalyzerCalls = 0;
let uploadContentType = "image/jpeg";

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          selectQueryCount += 1;
          return selectedReport ? [selectedReport] : selectQueryCount === 1
            ? []
            : [{
                objectPath: "/objects/uploads/test-photo",
                userId: "test-user",
                contentType: uploadContentType,
                expiresAt: new Date(Date.now() + 60_000),
              }];
        },
      }),
    }),
  }),
  insert: () => ({
    values: (values: Record<string, unknown>) => {
      persistedValues = values;
      return {
        onConflictDoNothing: () => ({
          returning: async () => [{
            ...values,
            id: "2f61f497-e0d9-4a17-b765-74a1063bc064",
            createdAt: new Date("2026-10-20T12:00:00.000Z"),
            updatedAt: new Date("2026-10-20T12:00:00.000Z"),
          }],
        }),
      };
    },
  }),
  delete: () => ({
    where: async () => [],
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      updatedValues = values;
      return {
        where: () => ({
          returning: async () => [{ ...selectedReport, ...values }],
        }),
      };
    },
  }),
};

class MockOpenAI {
  responses = {
    create: async () => ({ output: [] }),
  };
}

class MockObjectNotFoundError extends Error {}

class MockObjectStorageService {
  getObjectEntityFile() {
    return {
      getMetadata: async () => [{
        size: "9",
        contentType: uploadContentType,
      }],
      download: async () => { downloadCalls += 1; return [Buffer.from("mock image")]; },
    };
  }

  trySetObjectEntityAclPolicy = async () => {};
}

mock.module("@workspace/db", {
  namedExports: {
    db: mockDb,
    investigationsTable,
    pendingPhotoUploadsTable,
  },
});
mock.module("@clerk/express", {
  namedExports: {
    getAuth: () => ({ userId: "test-user" }),
  },
});
mock.module("../middlewares/requireUser.js", {
  namedExports: {
    requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
  },
});
mock.module("openai", {
  defaultExport: MockOpenAI,
});
mock.module("../lib/objectStorage.js", {
  namedExports: {
    ObjectNotFoundError: MockObjectNotFoundError,
    ObjectStorageService: MockObjectStorageService,
  },
});
mock.module("../lib/imageLocationAnalysis.js", {
  namedExports: {
    analyzeImageLocation: async () => { originalAnalyzerCalls += 1; return analyses.original; },
    locatorHealth: async () => ({ video_enabled: videoAvailable }),
  },
});
mock.module("../lib/deskImageAnalysis.js", {
  namedExports: {
    analyzeDeskImage: async (_client: unknown, _image: Buffer, _contentType: string, desk: string) => {
      analyzerCalls.push(desk);
      return analyses[desk]!;
    },
  },
});
mock.module("../lib/locationPhotoSearch.js", {
  namedExports: {
    searchLocationPhotoReferences: async () => [sourceImageMatch],
  },
});

const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "mock-provider-key";
const { default: investigationsRouter } = await import("./investigations.js");
if (originalApiKey === undefined) {
  delete process.env.OPENAI_API_KEY;
} else {
  process.env.OPENAI_API_KEY = originalApiKey;
}

const app = express();
app.use(express.json());
app.use(investigationsRouter);
const server = app.listen(0);
await once(server, "listening");
const serverAddress = server.address();
if (!serverAddress || typeof serverAddress === "string") {
  throw new Error("Could not determine the test server address.");
}
const listenPort = serverAddress.port;

test("create investigation persists and returns the Original desk analysis", async () => {
  await assertDeskReportMatches("original", originalAnalysis, {
    ...originalAnalysis,
    candidates: [{
      ...originalAnalysis.candidates[0]!,
      photoReferences: [sourceImageMatch],
      photoSearchStatus: "found",
    }],
  });
});

test("create investigation persists and returns the Recreation source-image matches", async () => {
  await assertDeskReportMatches("recreation", recreationAnalysis, recreationAnalysis);
});

test("create investigation persists and returns the Journalism summary and clues", async () => {
  await assertDeskReportMatches("fake-news", journalismAnalysis, journalismAnalysis);
});

async function assertDeskReportMatches(
  desk: string,
  analysis: Analysis,
  expectedReport: Analysis,
): Promise<void> {
  selectQueryCount = 0;
  persistedValues = undefined;
  analyzerCalls = [];

  const response = await fetch(`http://127.0.0.1:${listenPort}/investigations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      objectPath: "/objects/uploads/test-photo",
      clientRequestId: "d4864dca-0654-41ea-83bf-96791047c59f",
      originalName: "test-photo.jpg",
      contentType: "image/jpeg",
      desk,
      ...(desk === "fake-news"
        ? { journalismQuestion: "Does the image show signs of editing?" }
        : {}),
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json() as Record<string, unknown>;
  const savedValues = persistedValues as Record<string, unknown> | undefined;
  assert.ok(savedValues);
  assert.equal(savedValues.desk, desk);
  assert.equal(savedValues.summary, analysis.summary);
  assert.deepEqual(savedValues.candidates, expectedReport.candidates);
  assert.deepEqual(savedValues.clues, analysis.clues);
  assert.equal(body.desk, desk);
  assert.equal(body.summary, analysis.summary);
  assert.deepEqual(body.candidates, expectedReport.candidates);
  assert.deepEqual(body.clues, analysis.clues);
  assert.deepEqual(savedValues.analysis, desk === "original" ? analysis.analysis : null);
  assert.deepEqual(body.analysis, desk === "original" ? analysis.analysis : null);
  assert.deepEqual(analyzerCalls, desk === "original" ? [] : [desk]);
}

function reportFixture(analysis?: InvestigationAnalysis | null): Record<string, unknown> {
  return {
    id: "2f61f497-e0d9-4a17-b765-74a1063bc064",
    userId: "test-user", title: "Existing investigation", desk: "original",
    originalName: "photo.jpg", contentType: "image/jpeg",
    objectPath: "/objects/uploads/test-photo", context: null, shotAt: null,
    summary: originalAnalysis.summary, candidates: originalAnalysis.candidates,
    clues: originalAnalysis.clues,
    createdAt: new Date("2026-10-20T12:00:00.000Z"),
    updatedAt: new Date("2026-10-20T12:00:00.000Z"),
    ...(analysis === undefined ? {} : { analysis }),
  };
}

test("old investigations and new metadata survive the generated detail and list contracts", async () => {
  try {
    for (const metadata of [undefined, null, originalAnalysis.analysis]) {
      selectedReport = reportFixture(metadata);
      const response = await fetch(`http://127.0.0.1:${listenPort}/investigations/${selectedReport.id}`);
      assert.equal(response.status, 200);
      const body = GetInvestigationResponse.parse(await response.json());
      assert.equal(ListInvestigationsResponse.safeParse([body]).success, true);
      assert.deepEqual(body.analysis, metadata);
    }
  } finally {
    selectedReport = undefined;
  }
});

test("refresh saves fresh metadata with the new leads for Original investigations", async () => {
  try {
    selectedReport = {
      ...reportFixture({ verified: "verified" }),
      candidates: [{ ...originalAnalysis.candidates[0], place: "Previous lead" }],
    };
    updatedValues = undefined;
    const response = await fetch(
      `http://127.0.0.1:${listenPort}/investigations/${selectedReport.id}/refresh-candidates`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excludePlaces: ["Previous lead"] }),
      },
    );
    assert.equal(response.status, 200);
    const savedUpdate = updatedValues as Record<string, unknown> | undefined;
    assert.ok(savedUpdate);
    assert.deepEqual(savedUpdate.analysis, originalAnalysis.analysis);
    const body = GetInvestigationResponse.parse(await response.json());
    assert.deepEqual(body.analysis, originalAnalysis.analysis);
    assert.equal(body.candidates[0].place, originalAnalysis.candidates[0]?.place);
  } finally {
    selectedReport = undefined;
  }
});

test("unsuccessful lead refresh leaves existing report metadata unchanged", async () => {
  try {
    selectedReport = reportFixture({ verified: "partial" });
    updatedValues = undefined;
    const response = await fetch(
      `http://127.0.0.1:${listenPort}/investigations/${selectedReport.id}/refresh-candidates`,
      {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ excludePlaces: [] }),
      },
    );
    assert.equal(response.status, 409);
    assert.equal(updatedValues, undefined);
    assert.deepEqual(selectedReport.analysis, { verified: "partial" });
  } finally {
    selectedReport = undefined;
  }
});

test("locator health exposes only the safe video capability", async () => {
  videoAvailable = false;
  const response = await fetch(`http://127.0.0.1:${listenPort}/locator-health`);
  assert.deepEqual(await response.json(), { video_enabled: false });
  videoAvailable = true;
});

test("non-Original desks reject videos before any analyzer runs", async () => {
  const response = await fetch(`http://127.0.0.1:${listenPort}/investigations`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      objectPath: "/objects/uploads/test-photo",
      clientRequestId: "d4864dca-0654-41ea-83bf-96791047c59f",
      originalName: "test.mp4", contentType: "video/mp4", desk: "recreation",
    }),
  });
  assert.equal(response.status, 400);
});

test("retrying a failed video queues its existing record and clears the error", async () => {
  try {
    selectedReport = {
      ...reportFixture(), contentType: "video/mp4", originalName: "test.mp4",
      status: "failed", analysisError: "No clear frames", analysisAttempts: 3,
    };
    updatedValues = undefined;
    const response = await fetch(
      `http://127.0.0.1:${listenPort}/investigations/${selectedReport.id}/retry-analysis`,
      { method: "POST" },
    );
    assert.equal(response.status, 200);
    const body = GetInvestigationResponse.parse(await response.json());
    assert.equal(body.id, selectedReport.id);
    assert.equal(body.status, "analyzing");
    assert.equal(body.analysisError, null);
    assert.equal((updatedValues as Record<string, unknown> | undefined)?.analysisAttempts, 0);
  } finally { selectedReport = undefined; }
});

test("creating a video saves a pending record without waiting for downloads or analysis", async () => {
  selectQueryCount = 0;
  uploadContentType = "video/mp4";
  persistedValues = undefined;
  originalAnalyzerCalls = 0;
  downloadCalls = 0;
  try {
    const response = await fetch(`http://127.0.0.1:${listenPort}/investigations`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        objectPath: "/objects/uploads/test-photo",
        clientRequestId: "d4864dca-0654-41ea-83bf-96791047c59f",
        originalName: "test.mp4", contentType: "video/mp4", desk: "original",
      }),
    });
    assert.equal(response.status, 201);
    const body = GetInvestigationResponse.parse(await response.json());
    assert.equal(body.status, "analyzing");
    assert.deepEqual(body.candidates, []);
    assert.equal(body.analysis, null);
    assert.equal(originalAnalyzerCalls, 0);
    assert.equal(downloadCalls, 0);
  } finally { uploadContentType = "image/jpeg"; }
});

test("retry is idempotent for a running video and does not restart it", async () => {
  try {
    selectedReport = { ...reportFixture(), contentType: "video/mp4", status: "analyzing" };
    updatedValues = undefined;
    const response = await fetch(
      `http://127.0.0.1:${listenPort}/investigations/${selectedReport.id}/retry-analysis`,
      { method: "POST" },
    );
    assert.equal(response.status, 200);
    assert.equal(updatedValues, undefined);
  } finally { selectedReport = undefined; }
});

test.after(() => {
  server.close();
});
