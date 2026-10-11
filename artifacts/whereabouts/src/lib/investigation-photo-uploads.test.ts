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
  { id: "fake-news", label: "Fake News", description: "Fake News" },
];

function selectedPhotos(slotIds: PhotoUploadSlotId[]) {
  return slots
    .filter((slot) => slotIds.includes(slot.id))
    .map((slot) => ({
      slot,
      file: new File([slot.id], `${slot.id}.jpg`, { type: "image/jpeg" }),
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
      result.created.map((item) => item.slotLabel),
      slots.filter((slot) => slotIds.includes(slot.id)).map((slot) => slot.label),
    );
    assert.deepEqual(investigationInputs.map((input) => input.desk), slotIds);
    for (const input of investigationInputs) {
      assert.match(input.title ?? "", /^((Investigations)|(Recreation)|(Fake News)) — Mountain trip$/);
      assert.equal(input.context, "Light came from the west.");
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
    ["Investigations", "Fake News"],
  );
  assert.deepEqual(firstAttempt.failed, { recreation: "Analysis temporarily failed" });
  assert.deepEqual([...remaining.keys()], ["recreation"]);

  const retry = await runBatch();
  assert.equal(retry.created.length, 1);
  assert.deepEqual(retry.failed, {});
  assert.deepEqual([...remaining.keys()], []);
  assert.deepEqual(createCalls.sort(), ["fake-news.jpg", "original.jpg", "recreation.jpg"]);
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
