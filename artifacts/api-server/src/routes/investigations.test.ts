import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { mock, test } from "node:test";
import type { LocationCandidate, VisualClue } from "@workspace/db";
import {
  investigationsTable,
  pendingPhotoUploadsTable,
} from "@workspace/db/schema";

type Analysis = {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
};

const sourceImageMatch = {
  imageUrl: "https://images.example/source.jpg",
  thumbnailUrl: "https://images.example/source-thumb.jpg",
  sourceUrl: "https://archive.example/photo",
  caption: "A matching archival photograph",
};

const originalAnalysis: Analysis = {
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

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          selectQueryCount += 1;
          return selectQueryCount === 1
            ? []
            : [{
                objectPath: "/objects/uploads/test-photo",
                userId: "test-user",
                contentType: "image/jpeg",
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
        contentType: "image/jpeg",
      }],
      download: async () => [Buffer.from("mock image")],
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
    analyzeImageLocation: async () => analyses.original,
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
  assert.deepEqual(analyzerCalls, desk === "original" ? [] : [desk]);
}

test.after(() => {
  server.close();
});
