import type { InvestigationInputContentType } from "@workspace/api-client-react";

export const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * MB;
export const MAX_VIDEO_BYTES = 60 * MB;
export const MAX_ORIGINAL_PHOTOS = 6;
export const VIDEO_UNAVAILABLE_MESSAGE = "Video is not available right now. You can still upload photos.";

const imageTypes = new Set<string>([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
  "image/bmp", "image/x-ms-bmp", "image/tiff", "image/x-tiff", "image/heic", "image/heif",
]);
const videoTypes = new Set<string>([
  "video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo", "video/3gpp",
]);
const typeByExtension: Record<string, InvestigationInputContentType> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff",
  tiff: "image/tiff", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo", "3gp": "video/3gpp",
};

export function isVideoContentType(value: string | null | undefined): boolean {
  return Boolean(value && value.toLowerCase().startsWith("video/"));
}

/** Resolves the upload content type from the declared MIME type, falling back to the extension. */
export function mediaContentType(file: { name: string; type: string }): InvestigationInputContentType | null {
  const declared = file.type.toLowerCase();
  if (imageTypes.has(declared) || videoTypes.has(declared)) return declared as InvestigationInputContentType;
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension ? typeByExtension[extension] ?? null : null;
}

export type MediaValidation =
  | { ok: true; contentType: InvestigationInputContentType; kind: "image" | "video" }
  | { ok: false; error: string };

export function validateOriginalMedia(
  file: { name: string; type: string; size: number },
  videoEnabled: boolean,
): MediaValidation {
  const contentType = mediaContentType(file);
  const looksVideo = isVideoContentType(file.type) || isVideoContentType(contentType);
  if (looksVideo && !videoEnabled) return { ok: false, error: VIDEO_UNAVAILABLE_MESSAGE };
  if (!contentType) {
    return {
      ok: false,
      error: videoEnabled
        ? "Choose a JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC, or HEIF image, or an MP4, MOV, WebM, MKV, AVI, or 3GP video."
        : "Choose a JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC, or HEIF image.",
    };
  }
  const kind = isVideoContentType(contentType) ? "video" : "image";
  if (kind === "video") {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const declared = file.type.toLowerCase();
    const fallbackTypes = ["", "application/octet-stream", "video/avi", "application/x-matroska"];
    if (typeByExtension[extension] !== contentType ||
      (!videoTypes.has(declared) && !fallbackTypes.includes(declared))) {
      return { ok: false, error: "Choose an MP4, MOV, WebM, MKV, AVI, or 3GP video with a matching file type and extension." };
    }
  }
  if (file.size <= 0) return { ok: false, error: "This file is empty." };
  if (kind === "video" && file.size > MAX_VIDEO_BYTES) return { ok: false, error: "This video is larger than 60 MB. Choose a smaller clip." };
  if (kind === "image" && file.size > MAX_IMAGE_BYTES) return { ok: false, error: "This image is larger than 25 MB. Choose a smaller file." };
  return { ok: true, contentType, kind };
}
