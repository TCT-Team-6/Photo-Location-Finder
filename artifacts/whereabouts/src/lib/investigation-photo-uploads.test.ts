import assert from "node:assert/strict";
import test from "node:test";
import type {
  InvestigationInput,
  InvestigationInputContentType,
  UploadUrlRequest,
} from "@workspace/api-client-react";
import type {
  PhotoUploadSlotDefinition,
  PhotoUploadSlotId,
} from "@/components/photo-upload-slot";
import {
  clearErrorsForSelectedPhotoSlots,
  processInvestigationPhotoUploads,
  type InvestigationPhotoUploadOptions,
} from "./investigation-photo-uploads";

const slots: PhotoUploadSlotDefinition[] = [
  { id: "original", label: "Investigations", description: "Original" },
  { id: "recreation", label: "Recreation", description: "Recreation" },
  { id: "fake-news", label: "Investigative journalism", description: "Journalism" },
];

function selectedPhotos(slotIds: PhotoUploadSlotId[]) {
  return slots
    .filter((slot) => slotIds.includes(slot.id))
    .map((slot) => ({
      slot,
      file: new File([slot.id], `${slot.id}.jpg`, { type: "image/jpeg" }),
      requestId: `request-${slot.id}`,
    }));
}

function validContentType(): InvestigationInputContentType {
  return "image/jpeg";
}

test("creates one distinct investigation with shared metadata for every non-empty slot selection", async () => {
  const combinations = [
    ["original"],
    ["recreation"],
    ["fake-news"],
    ["original", "recreation"],
    ["original", "fake-news"],
    ["recreation", "fake-news"],
    ["original", "recreation", "fake-news"],
  ] as PhotoUploadSlotId[][];

  for (const slotIds of combinations) {
    const uploadRequests: UploadUrlRequest[] = [];
    const investigationInputs: InvestigationInput[] = [];
    let uploadNumber = 0;

    const options: InvestigationPhotoUploadOptions = {
      selected: selectedPhotos(slotIds),
      title: "  Mountain trip  ",
      context: "  Light came from the west.  ",
      journalismQuestion: "  Is the shadow direction consistent?  ",
      shotAt: "2024-03-05",
      getContentType: validContentType,
      requestUploadUrl: async ({ data }) => {
        uploadRequests.push(data);
        uploadNumber += 1;
        return {
          uploadURL: `https://upload.example/${uploadNumber}`,
          objectPath: `/objects/uploads/photo-${uploadNumber}`,
          metadata: data,
        };
      },
      uploadFile: async () => {},
      createInvestigation: async ({ data }) => {
        investigationInputs.push(data);
        return { id: `investigation-${investigationInputs.length}`, title: data.title ?? "" };
      },
    };

    const result = await processInvestigationPhotoUploads(options);

    assert.equal(result.created.length, slotIds.length);
    assert.deepEqual(Object.keys(result.failed), []);
    assert.equal(uploadRequests.length, slotIds.length);
    assert.equal(investigationInputs.length, slotIds.length);
    assert.equal(new Set(investigationInputs.map((input) => input.objectPath)).size, slotIds.length);
    assert.deepEqual(
      investigationInputs.map((input) => input.clientRequestId),
      slotIds.map((slotId) => `request-${slotId}`),
    );
    assert.deepEqual(
      result.created.map((item) => item.slotLabel),
      slots.filter((slot) => slotIds.includes(slot.id)).map((slot) => slot.label),
    );
    assert.deepEqual(investigationInputs.map((input) => input.desk), slotIds);
    for (const input of investigationInputs) {
      assert.match(input.title ?? "", /^((Investigations)|(Recreation)|(Investigative journalism)) — Mountain trip$/);
      assert.equal(input.context, "Light came from the west.");
      assert.equal(
        input.journalismQuestion,
        input.desk === "fake-news" ? "Is the shadow direction consistent?" : undefined,
      );
      assert.equal(input.shotAt, "2024-03-05T00:00:00.000Z");
    }
  }
});

test("keeps successful slots cleared and retries only a failed slot", async () => {
  const remaining = new Map(selectedPhotos(["original", "recreation", "fake-news"]).map((item) => [item.slot.id, item]));
  const createCalls: string[] = [];
  let failRecreationOnce = true;
  let nextUploadId = 0;

  const runBatch = () =>
    processInvestigationPhotoUploads({
      selected: [...remaining.values()],
      title: "",
      context: "",
      shotAt: "",
      getContentType: validContentType,
      requestUploadUrl: async () => {
        nextUploadId += 1;
        return {
          uploadURL: `https://upload.example/${nextUploadId}`,
          objectPath: `/objects/uploads/${nextUploadId}`,
        };
      },
      uploadFile: async () => {},
      createInvestigation: async ({ data }) => {
        if (data.originalName === "recreation.jpg" && failRecreationOnce) {
          failRecreationOnce = false;
          throw new Error("Analysis temporarily failed");
        }
        createCalls.push(data.originalName);
        return { id: `saved-${createCalls.length}`, title: data.title ?? "" };
      },
      onSaved: (slotId) => remaining.delete(slotId),
    });

  const firstAttempt = await runBatch();
  assert.deepEqual(
    firstAttempt.created.map((item) => item.slotLabel),
    ["Investigations", "Investigative journalism"],
  );
  assert.deepEqual(firstAttempt.failed, { recreation: "Analysis temporarily failed" });
  assert.deepEqual([...remaining.keys()], ["recreation"]);

  const retry = await runBatch();
  assert.equal(retry.created.length, 1);
  assert.deepEqual(retry.failed, {});
  assert.deepEqual([...remaining.keys()], []);
  assert.deepEqual(createCalls.sort(), ["fake-news.jpg", "original.jpg", "recreation.jpg"]);
});

test("does not retry analysis failures caused by exhausted provider credits", async () => {
  let createCalls = 0;
  const result = await processInvestigationPhotoUploads({
    selected: selectedPhotos(["original"]),
    title: "",
    context: "",
    shotAt: "",
    getContentType: validContentType,
    requestUploadUrl: async ({ data }) => ({
      uploadURL: "https://upload.example/one",
      objectPath: "/objects/uploads/photo-one",
      metadata: data,
    }),
    uploadFile: async () => {},
    createInvestigation: async () => {
      createCalls += 1;
      const error = new Error(
        "HTTP 429: Image analysis is unavailable because the analysis provider has no remaining credits.",
      ) as Error & { status: number };
      error.status = 429;
      throw error;
    },
  });
  assert.equal(createCalls, 1);
  assert.equal(result.created.length, 0);
  assert.match(result.failed.original ?? "", /no remaining credits/);
});

test("reuses the selected photo request ID after a committed save response is lost", async () => {
  const remaining = new Map(selectedPhotos(["original"]).map((item) => [item.slot.id, item]));
  const savedByRequestId = new Map<
    string,
    { id: string; title: string }
  >();
  const requestInputs: InvestigationInput[] = [];
  let nextUploadId = 0;
  let loseFirstResponse = true;

  const runBatch = () =>
    processInvestigationPhotoUploads({
      selected: [...remaining.values()],
      title: "",
      context: "",
      shotAt: "",
      getContentType: validContentType,
      requestUploadUrl: async () => {
        nextUploadId += 1;
        return {
          uploadURL: `https://upload.example/${nextUploadId}`,
          objectPath: `/objects/uploads/${nextUploadId}`,
        };
      },
      uploadFile: async () => {},
      createInvestigation: async ({ data }) => {
        requestInputs.push(data);
        const existing = savedByRequestId.get(data.clientRequestId);
        if (existing) return existing;

        const committed = {
          id: "saved-once",
          title: data.title ?? "",
        };
        savedByRequestId.set(data.clientRequestId, committed);
        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error("Connection lost after the server committed the save");
        }
        return committed;
      },
      onSaved: (slotId) => remaining.delete(slotId),
    });

  const firstAttempt = await runBatch();
  assert.deepEqual(firstAttempt.failed, {
    original: "Connection lost after the server committed the save",
  });
  assert.equal(savedByRequestId.size, 1);
  assert.equal(remaining.size, 1);

  const retry = await runBatch();
  assert.deepEqual(retry.failed, {});
  assert.deepEqual(retry.created, [
    { id: "saved-once", title: "Investigations — original", slotLabel: "Investigations" },
  ]);
  assert.equal(savedByRequestId.size, 1);
  assert.equal(requestInputs.length, 2);
  assert.equal(requestInputs[0].clientRequestId, requestInputs[1].clientRequestId);
  assert.notEqual(requestInputs[0].objectPath, requestInputs[1].objectPath);
  assert.equal(remaining.size, 0);
});

test("retries transient upload and save errors without storing a duplicate investigation", async () => {
  const photos = selectedPhotos(["original"]);
  const requestInputs: InvestigationInput[] = [];
  const savedByRequestId = new Map<string, { id: string; title: string }>();
  let uploadAttempts = 0;
  let saveAttempts = 0;

  const result = await processInvestigationPhotoUploads({
    selected: photos,
    title: "",
    context: "",
    shotAt: "",
    getContentType: validContentType,
    requestUploadUrl: async () => ({
      uploadURL: "https://upload.example/retry",
      objectPath: "/objects/uploads/retry",
    }),
    uploadFile: async () => {
      uploadAttempts += 1;
      if (uploadAttempts === 1) {
        const error = new Error("Upload service temporarily unavailable") as Error & {
          status: number;
        };
        error.status = 503;
        throw error;
      }
    },
    createInvestigation: async ({ data }) => {
      saveAttempts += 1;
      requestInputs.push(data);
      const existing = savedByRequestId.get(data.clientRequestId);
      if (existing) return existing;

      const saved = { id: "saved-once", title: data.title ?? "" };
      savedByRequestId.set(data.clientRequestId, saved);
      if (saveAttempts === 1) {
        const error = new Error("Save service temporarily unavailable") as Error & {
          status: number;
        };
        error.status = 503;
        throw error;
      }
      return saved;
    },
  });

  assert.deepEqual(result.failed, {});
  assert.deepEqual(result.created, [{
    id: "saved-once",
    title: "Investigations — original",
    slotLabel: "Investigations",
  }]);
  assert.equal(uploadAttempts, 2);
  assert.equal(saveAttempts, 2);
  assert.equal(savedByRequestId.size, 1);
  assert.equal(requestInputs[0]?.clientRequestId, requestInputs[1]?.clientRequestId);
  assert.equal(requestInputs[0]?.objectPath, requestInputs[1]?.objectPath);
});

test("keeps validation failures attached to their slot and preserves errors for untouched slots", async () => {
  const photos = selectedPhotos(["original", "recreation"]);
  const result = await processInvestigationPhotoUploads({
    selected: photos,
    title: "",
    context: "",
    shotAt: "",
    getContentType: (file) => file.name === "recreation.jpg" ? null : validContentType(),
    requestUploadUrl: async () => ({
      uploadURL: "https://upload.example/1",
      objectPath: "/objects/uploads/1",
    }),
    uploadFile: async () => {},
    createInvestigation: async () => ({ id: "saved-original", title: "Investigations — original" }),
  });

  assert.deepEqual(result.failed, { recreation: "Choose a supported image format." });
  assert.equal(result.created.length, 1);
  assert.deepEqual(
    clearErrorsForSelectedPhotoSlots(
      { original: "old upload error", recreation: "bad image format", "fake-news": "wrong slot" },
      ["recreation"],
    ),
    { original: "old upload error", "fake-news": "wrong slot" },
  );
});
