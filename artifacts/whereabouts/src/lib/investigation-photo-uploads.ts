import type {
  InvestigationInput,
  InvestigationInputContentType,
  UploadUrlRequest,
  UploadUrlResponse,
} from "@workspace/api-client-react";
import type {
  PhotoUploadSlotDefinition,
  PhotoUploadSlotId,
} from "@/components/photo-upload-slot";

export type SelectedInvestigationPhoto = {
  slot: PhotoUploadSlotDefinition;
  file: File;
  requestId: string;
};

export type SavedInvestigationPhoto = {
  id: string;
  title: string;
  slotLabel: string;
};

export type InvestigationPhotoUploadOptions = {
  selected: SelectedInvestigationPhoto[];
  title: string;
  context: string;
  journalismQuestion?: string;
  shotAt: string;
  getContentType: (file: File) => InvestigationInputContentType | null;
  requestUploadUrl: (variables: { data: UploadUrlRequest }) => Promise<UploadUrlResponse>;
  uploadFile: (
    uploadURL: string,
    file: File,
    contentType: InvestigationInputContentType,
  ) => Promise<void>;
  createInvestigation: (variables: {
    data: InvestigationInput;
  }) => Promise<Pick<SavedInvestigationPhoto, "id" | "title">>;
  onProgress?: (message: string) => void;
  onSaved?: (slotId: PhotoUploadSlotId) => void;
};

export type InvestigationPhotoUploadResult = {
  created: SavedInvestigationPhoto[];
  failed: Partial<Record<PhotoUploadSlotId, string>>;
};

function isTransientUploadFailure(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; message?: unknown; response?: { status?: unknown } };
  const status = typeof value.status === "number"
    ? value.status
    : typeof value.response?.status === "number"
      ? value.response.status
      : undefined;
  if (
    status === 429 &&
    typeof value.message === "string" &&
    /analysis provider has no remaining credits/i.test(value.message)
  ) return false;
  return status !== undefined && (status === 408 || status === 429 || status >= 500);
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientUploadFailure(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return operation();
  }
}

export async function processInvestigationPhotoUploads({
  selected,
  title,
  context,
  journalismQuestion = "",
  shotAt,
  getContentType,
  requestUploadUrl,
  uploadFile,
  createInvestigation,
  onProgress,
  onSaved,
}: InvestigationPhotoUploadOptions): Promise<InvestigationPhotoUploadResult> {
  const created: SavedInvestigationPhoto[] = [];
  const failed: Partial<Record<PhotoUploadSlotId, string>> = {};

  for (const [index, { slot, file, requestId }] of selected.entries()) {
    const contentType = getContentType(file);
    if (!contentType) {
      failed[slot.id] = "Choose a supported image format.";
      continue;
    }

    try {
      onProgress?.(`Uploading ${index + 1} of ${selected.length}: ${slot.label}`);
      const upload = await requestUploadUrl({
        data: { name: file.name, size: file.size, contentType },
      });
      await retryOnce(() => uploadFile(upload.uploadURL, file, contentType));

      onProgress?.(`Analyzing ${index + 1} of ${selected.length}: ${slot.label}`);
      const fileTitle = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const caseTitle = `${slot.label} — ${title.trim() || fileTitle || slot.label}`.slice(
        0,
        120,
      );
      const result = await retryOnce(() => createInvestigation({
        data: {
          objectPath: upload.objectPath,
          clientRequestId: requestId,
          desk: slot.id,
          originalName: file.name,
          contentType,
          ...(context.trim() ? { context: context.trim() } : {}),
          ...(slot.id === "fake-news" && journalismQuestion.trim()
            ? { journalismQuestion: journalismQuestion.trim() }
            : {}),
          ...(shotAt ? { shotAt: new Date(shotAt).toISOString() } : {}),
          title: caseTitle,
        },
      }));

      created.push({ id: result.id, title: result.title, slotLabel: slot.label });
      onSaved?.(slot.id);
    } catch (error) {
      failed[slot.id] =
        error instanceof Error
          ? error.message
          : "This photo could not be uploaded and analyzed.";
    }
  }

  return { created, failed };
}

export function clearErrorsForSelectedPhotoSlots(
  errors: Partial<Record<PhotoUploadSlotId, string>>,
  selectedSlotIds: PhotoUploadSlotId[],
): Partial<Record<PhotoUploadSlotId, string>> {
  const remaining = { ...errors };
  for (const slotId of selectedSlotIds) {
    delete remaining[slotId];
  }
  return remaining;
}
