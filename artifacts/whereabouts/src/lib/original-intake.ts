import type { InvestigationInput, UploadUrlRequest, UploadUrlResponse, Investigation } from "@workspace/api-client-react";
import { processInvestigationPhotoUploads } from "./investigation-photo-uploads";
import { MAX_ORIGINAL_PHOTOS, mediaContentType, validateOriginalMedia } from "./media-types";

export type IntakeStatus = "ready" | "uploading" | "analyzing" | "saved" | "error";
export type IntakeItem = {
  id: string;
  file: File;
  requestId: string;
  kind: "image" | "video";
  status: IntakeStatus;
  error?: string;
  savedId?: string;
  analysisStatus?: Investigation["status"];
};

export const originalSlot = { id: "original" as const, label: "Investigations", description: "The image you want to investigate." };

export function planSelection(
  existing: IntakeItem[],
  files: File[],
  videoEnabled: boolean,
  makeId: () => string = () => crypto.randomUUID(),
): { items: IntakeItem[]; errors: string[] } {
  const errors: string[] = [];
  const items = [...existing];
  const note = (file: File, message: string) => errors.push(files.length === 1 ? message : `${file.name}: ${message}`);
  const valid = files.map((file) => ({ file, result: validateOriginalMedia(file, videoEnabled) }));
  for (const { file, result } of valid) {
    if (!result.ok) { note(file, result.error); continue; }
    if (result.kind === "video") {
      if (items.length > 0 || valid.filter((entry) => entry.result.ok).length > 1) {
        note(file, "A video is analyzed on its own. Remove the other files first.");
        continue;
      }
    } else if (items.some((item) => item.kind === "video")) {
      note(file, "Remove the video first to add photos.");
      continue;
    } else if (items.length >= MAX_ORIGINAL_PHOTOS) {
      note(file, `You can add up to ${MAX_ORIGINAL_PHOTOS} photos at a time.`);
      continue;
    }
    items.push({ id: makeId(), file, requestId: makeId(), kind: result.kind, status: "ready" });
  }
  return { items, errors };
}

export type RunItemDeps = {
  title: string;
  context: string;
  shotAt: string;
  apiKey?: string;
  requestUploadUrl: (variables: { data: UploadUrlRequest }) => Promise<UploadUrlResponse>;
  uploadFile: (uploadURL: string, file: File, contentType: NonNullable<ReturnType<typeof mediaContentType>>) => Promise<void>;
  createInvestigation: (variables: { data: InvestigationInput }) => Promise<Investigation>;
  onPhase?: (phase: "uploading" | "analyzing") => void;
};

/** Uploads and analyzes one item. Reuses the item's stable requestId so retries never duplicate it. */
export async function runIntakeItem(item: IntakeItem, deps: RunItemDeps): Promise<Pick<IntakeItem, "status" | "error" | "savedId" | "analysisStatus">> {
  let analysisStatus: Investigation["status"];
  const { created, failed } = await processInvestigationPhotoUploads({
    selected: [{ slot: originalSlot, file: item.file, requestId: item.requestId }],
    title: deps.title,
    context: deps.context,
    apiKey: deps.apiKey,
    shotAt: deps.shotAt,
    getContentType: mediaContentType,
    requestUploadUrl: deps.requestUploadUrl,
    uploadFile: deps.uploadFile,
    createInvestigation: async (variables) => {
      const saved = await deps.createInvestigation(variables);
      analysisStatus = saved.status;
      return saved;
    },
    onProgress: (message) => deps.onPhase?.(message.startsWith("Analyzing") ? "analyzing" : "uploading"),
  });
  if (created[0]) return { status: "saved", savedId: created[0].id, analysisStatus, error: undefined };
  return { status: "error", error: failed.original ?? "This file could not be uploaded and analyzed." };
}
