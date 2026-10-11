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

export async function processInvestigationPhotoUploads({
  selected,
  title,
  context,
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

  for (const [index, { slot, file }] of selected.entries()) {
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
      await uploadFile(upload.uploadURL, file, contentType);

      onProgress?.(`Analyzing ${index + 1} of ${selected.length}: ${slot.label}`);
      const fileTitle = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const caseTitle = `${slot.label} — ${title.trim() || fileTitle || slot.label}`.slice(
        0,
        120,
      );
      const result = await createInvestigation({
        data: {
          objectPath: upload.objectPath,
          desk: slot.id,
          originalName: file.name,
          contentType,
          ...(context.trim() ? { context: context.trim() } : {}),
          ...(shotAt ? { shotAt: new Date(shotAt).toISOString() } : {}),
          title: caseTitle,
        },
      });

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
